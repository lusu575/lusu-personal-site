import { beforeEach, describe, expect, it } from "vitest";
import { env, SELF } from "cloudflare:test";

import { oauthDefaultHandler } from "../src/auth-handler";
import { validateClientRegistration } from "../src/client-registration";
import {
  CANONICAL_ISSUER,
  MCP_RESOURCE,
  OWNER_SCOPES
} from "../src/constants";
import { oauthProviderOptions } from "../src/index";
import { handleOAuthRevocationWithLedgerSync } from "../src/oauth-revocation";
import { hmacSha256Hex, sha256Hex } from "../src/security";

const testEnv = env as unknown as {
  DB: D1Database;
  OAUTH_KV: KVNamespace;
};

const SESSION_TOKEN = "owner-session-token-for-admin-mcp-tests";
const MODERN_META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": {
    name: "site-admin-mcp-worker-tests",
    version: "1.0.0"
  },
  "io.modelcontextprotocol/clientCapabilities": {}
};
const CLIENT_METADATA = {
  client_name: "MCP test client",
  redirect_uris: ["https://client.example/callback"],
  token_endpoint_auth_method: "none",
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  application_type: "web"
};

class MemoryKv {
  readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

function registrationOptions(
  clientMetadata: Record<string, unknown>,
  ip = "203.0.113.17"
): Parameters<typeof validateClientRegistration>[0] {
  return {
    clientMetadata,
    request: new Request("https://lusu575.com/oauth/register", {
      method: "POST",
      headers: { "CF-Connecting-IP": ip }
    })
  };
}

function registrationEnv(
  kv: MemoryKv,
  salt = "test-only-dcr-hmac-salt-at-least-32-bytes"
): Env {
  return {
    DB: testEnv.DB,
    OAUTH_KV: kv,
    ANALYTICS_IP_HASH_SALT: salt
  } as unknown as Env;
}

function authorizeUrl(resources: string[]): string {
  const query = new URLSearchParams({
    response_type: "code",
    client_id: "missing-client",
    redirect_uri: "https://client.example/callback",
    scope: "content:read",
    state: "state-1",
    code_challenge: "A".repeat(43),
    code_challenge_method: "S256"
  });
  for (const resource of resources) query.append("resource", resource);
  return `${CANONICAL_ISSUER}/oauth/authorize?${query}`;
}

async function tokenRequest(resources: string[]): Promise<{
  response: Response;
  body: Record<string, unknown>;
}> {
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: "missing-client",
    code: "missing-code",
    redirect_uri: "https://client.example/callback",
    code_verifier: "B".repeat(43)
  });
  for (const resource of resources) form.append("resource", resource);
  const response = await SELF.fetch(`${CANONICAL_ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });
  return {
    response,
    body: await response.json<Record<string, unknown>>()
  };
}

async function clearOAuthKv(): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await testEnv.OAUTH_KV.list({ cursor });
    await Promise.all(page.keys.map(({ name }) => testEnv.OAUTH_KV.delete(name)));
    if (page.list_complete) return;
    cursor = page.cursor;
  } while (cursor);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function hiddenInput(html: string, name: string): string {
  const match = html.match(new RegExp(`name="${name}" value="([^"]+)"`));
  if (!match) throw new Error(`Missing hidden input: ${name}`);
  return match[1];
}

function applySetCookie(jar: Map<string, string>, setCookie: string): string {
  const pair = String(setCookie || "").split(";", 1)[0];
  const separator = pair.indexOf("=");
  if (separator <= 0) throw new Error("Missing Set-Cookie pair");
  const name = pair.slice(0, separator);
  const value = pair.slice(separator + 1);
  if (value) jar.set(name, value);
  else jar.delete(name);
  return name;
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

type RelayConnection = {
  socket: WebSocket;
  messages: Array<Record<string, any>>;
};

function randomPairingCode(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = crypto.getRandomValues(new Uint8Array(26));
  return [...bytes].map((byte) => alphabet[byte & 31]).join("");
}

async function openGameRelay(pairingCode: string): Promise<RelayConnection> {
  const response = await SELF.fetch(`${CANONICAL_ISSUER}/mcp/browser-games/connect`, {
    headers: {
      Cookie: `lusu_session=${SESSION_TOKEN}`,
      Host: "lusu575.com",
      Origin: CANONICAL_ISSUER,
      "Sec-Fetch-Site": "same-origin",
      Upgrade: "websocket",
      "Sec-WebSocket-Protocol": `lusu-game-v1, pair.${pairingCode}`,
      "Sec-WebSocket-Version": "13"
    }
  });
  expect(response.status).toBe(101);
  expect(response.headers.get("sec-websocket-protocol")).toBe("lusu-game-v1");
  expect(response.webSocket).not.toBeNull();
  const socket = response.webSocket!;
  const messages: Array<Record<string, any>> = [];
  socket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") return;
    try {
      messages.push(JSON.parse(event.data) as Record<string, any>);
    } catch {
      // Invalid frames are asserted by the relay and are not useful to this queue.
    }
  });
  socket.accept();
  return { socket, messages };
}

async function waitForRelayMessage(
  connection: RelayConnection,
  type: string,
  afterIndex = 0,
  timeoutMs = 2_000
): Promise<Record<string, any>> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const message = connection.messages.slice(afterIndex).find((item) => item.type === type);
    if (message) return message;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for relay message: ${type}`);
}

async function authorizeTestClient(
  scopes: string[],
  forcedGrantRef = "",
  captureTokens?: (value: {
    clientId: string;
    accessToken: string;
    refreshToken: string;
  }) => void
): Promise<string> {
  const redirectUri = "http://127.0.0.1:43110/callback";
  const registration = await SELF.fetch(`${CANONICAL_ISSUER}/oauth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.29"
    },
    body: JSON.stringify({
      client_name: "Owner MCP integration test",
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      application_type: "native"
    })
  });
  expect(registration.status).toBe(201);
  const registered = await registration.json<Record<string, unknown>>();
  const clientId = String(registered.client_id || "");
  expect(clientId).not.toBe("");

  const verifier = "owner-mcp-integration-verifier-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  )));
  const state = `state-${crypto.randomUUID()}`;
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: MCP_RESOURCE
  });
  const consent = await SELF.fetch(`${CANONICAL_ISSUER}/oauth/authorize?${query}`, {
    headers: { Cookie: `lusu_session=${SESSION_TOKEN}` },
    redirect: "manual"
  });
  expect(consent.status).toBe(200);
  const consentCookie = String(consent.headers.get("set-cookie") || "").split(";", 1)[0];
  expect(consentCookie).toContain("lusu_mcp_consent_");
  const html = await consent.text();
  const flowId = hiddenInput(html, "flow_id");
  const csrfToken = hiddenInput(html, "csrf_token");
  const requestFingerprint = hiddenInput(html, "request_fingerprint");
  if (forcedGrantRef) {
    const flowKey = `lusu:owner-mcp:consent:${flowId}`;
    const storedFlow = await testEnv.OAUTH_KV.get<Record<string, unknown>>(flowKey, "json");
    expect(storedFlow).not.toBeNull();
    if (!storedFlow) throw new Error("Missing stored OAuth consent flow");
    await testEnv.OAUTH_KV.put(flowKey, JSON.stringify({
      ...storedFlow,
      grantRef: forcedGrantRef
    }), { expirationTtl: 10 * 60 });
  }

  const decision = await SELF.fetch(`${CANONICAL_ISSUER}/oauth/authorize`, {
    method: "POST",
    headers: {
      Cookie: `lusu_session=${SESSION_TOKEN}; ${consentCookie}`,
      Origin: CANONICAL_ISSUER,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      flow_id: flowId,
      csrf_token: csrfToken,
      request_fingerprint: requestFingerprint,
      decision: "approve"
    }).toString(),
    redirect: "manual"
  });
  expect(decision.status).toBe(302);
  const callback = new URL(String(decision.headers.get("location") || ""));
  expect(callback.origin).toBe("http://127.0.0.1:43110");
  expect(callback.searchParams.get("state")).toBe(state);
  expect(callback.searchParams.get("iss")).toBe(CANONICAL_ISSUER);
  const code = String(callback.searchParams.get("code") || "");
  expect(code).not.toBe("");

  const token = await SELF.fetch(`${CANONICAL_ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      resource: MCP_RESOURCE
    }).toString()
  });
  expect(token.status).toBe(200);
  const tokenPayload = await token.json<Record<string, unknown>>();
  expect(tokenPayload.token_type).toBe("bearer");
  const accessToken = String(tokenPayload.access_token || "");
  expect(accessToken).not.toBe("");
  const refreshToken = String(tokenPayload.refresh_token || "");
  expect(refreshToken).not.toBe("");
  captureTokens?.({ clientId, accessToken, refreshToken });
  return accessToken;
}

async function ownerMcpRequest(
  accessToken: string,
  method: string,
  params: Record<string, unknown> = {}
): Promise<{ response: Response; body: Record<string, any> }> {
  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Host: "lusu575.com",
    "Mcp-Method": method,
    "Mcp-Protocol-Version": "2026-07-28"
  });
  if (typeof params.name === "string") headers.set("Mcp-Name", params.name);
  const response = await SELF.fetch(MCP_RESOURCE, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: {
        ...params,
        _meta: MODERN_META
      }
    })
  });
  const responseText = await response.text();
  return {
    response,
    body: responseText ? JSON.parse(responseText) as Record<string, any> : {}
  };
}

function structuredToolResult(body: Record<string, any>): Record<string, any> {
  const result = body.result?.structuredContent;
  return result?.result ?? result ?? {};
}

async function installGameOutcomeAuditFailure(
  result: "pending" | "success" | "error"
): Promise<void> {
  await testEnv.DB.prepare("drop trigger if exists fail_game_outcome_audit").run();
  await testEnv.DB.prepare(`
    create trigger fail_game_outcome_audit
    before insert on mcp_oauth_audit_log
    when new.tool_name = 'game_browser_act' and new.result = '${result}'
    begin
      select raise(abort, 'forced game outcome audit failure');
    end
  `).run();
}

async function clearGameOutcomeAuditFailure(): Promise<void> {
  await testEnv.DB.prepare("drop trigger if exists fail_game_outcome_audit").run();
}

function publishInput(operationId: string, slug: string): Record<string, unknown> {
  return {
    operationId,
    slug,
    category: "notes",
    tags: ["MCP", "integration"],
    translations: {
      zh: {
        title: "OAuth MCP 集成测试",
        summary: "只用于自动化发布与删除闭环。",
        contentMarkdown: "# OAuth MCP 集成测试\n\n本地测试内容。"
      },
      en: {
        title: "OAuth MCP integration test",
        summary: "Used only for the automated publish/delete loop.",
        contentMarkdown: "# OAuth MCP integration test\n\nLocal test content."
      },
      ja: {
        title: "OAuth MCP 統合テスト",
        summary: "自動公開と削除ループのみに使用します。",
        contentMarkdown: "# OAuth MCP 統合テスト\n\nローカルテスト内容。"
      }
    }
  };
}

beforeEach(async () => {
  await clearOAuthKv();
  await clearGameOutcomeAuditFailure();
  await testEnv.DB.batch([
    testEnv.DB.prepare(`create table if not exists users (
      id text primary key,
      email text not null,
      role text not null
    )`),
    testEnv.DB.prepare(`create table if not exists sessions (
      token_hash text primary key,
      user_id text not null,
      created_at text not null,
      expires_at text not null
    )`),
    testEnv.DB.prepare(`create table if not exists articles (
      article_id text primary key,
      slug text not null unique,
      category text not null,
      tags text not null,
      cover_image text,
      status text not null,
      is_pinned integer not null default 0,
      view_count integer not null default 0,
      created_at text not null,
      updated_at text not null,
      published_at text
    )`),
    testEnv.DB.prepare(`create table if not exists article_translations (
      translation_id text primary key,
      article_id text not null references articles(article_id) on delete cascade,
      lang text not null,
      title text not null,
      summary text not null,
      content_markdown text not null,
      created_at text not null,
      updated_at text not null,
      unique(article_id, lang)
    )`),
    testEnv.DB.prepare(`create table if not exists agent_audit_log (
      event_id text primary key,
      actor_user_id text not null default '',
      token_id text not null default '',
      action text not null,
      target_type text not null default '',
      target_id text not null default '',
      scopes text not null default '[]',
      result text not null default '',
      created_at text not null
    )`),
    testEnv.DB.prepare(`create table if not exists agent_article_receipts (
      receipt_id text primary key,
      user_id text not null,
      operation_id text not null,
      action text not null,
      payload_hash text not null,
      article_id text not null default '',
      response_json text not null,
      created_at text not null,
      unique(user_id, operation_id)
    )`),
    testEnv.DB.prepare(`create table if not exists mcp_oauth_grants (
      grant_ref text primary key,
      user_id text not null references users(id) on delete cascade,
      client_id text not null,
      client_name text not null default '',
      resource text not null,
      authorized_scopes text not null default '[]',
      status text not null default 'pending',
      created_at text not null,
      activated_at text not null default '',
      expires_at text not null default '',
      revoked_at text not null default '',
      revoked_reason text not null default '',
      last_used_at text not null default ''
    )`),
    testEnv.DB.prepare(`create table if not exists mcp_oauth_audit_log (
      event_id text primary key,
      user_id text not null default '',
      client_id text not null default '',
      grant_ref text not null default '',
      token_ref_hash text not null default '',
      resource text not null default '',
      capability_id text not null default '',
      tool_name text not null default '',
      operation_id text not null default '',
      target_type text not null default '',
      target_id_hash text not null default '',
      requested_scopes text not null default '[]',
      effective_scopes text not null default '[]',
      action text not null,
      result text not null default '',
      error_code text not null default '',
      ip_hash text not null default '',
      created_at text not null
    )`),
    testEnv.DB.prepare(`create table if not exists mcp_oauth_registration_limits (
      bucket_key text primary key,
      request_count integer not null default 0,
      expires_at text not null,
      updated_at text not null
    )`)
  ]);
  await testEnv.DB.batch([
    testEnv.DB.prepare("delete from mcp_oauth_registration_limits"),
    testEnv.DB.prepare("delete from mcp_oauth_audit_log"),
    testEnv.DB.prepare("delete from mcp_oauth_grants"),
    testEnv.DB.prepare("delete from agent_article_receipts"),
    testEnv.DB.prepare("delete from agent_audit_log"),
    testEnv.DB.prepare("delete from article_translations"),
    testEnv.DB.prepare("delete from articles"),
    testEnv.DB.prepare("delete from sessions"),
    testEnv.DB.prepare("delete from users"),
    testEnv.DB.prepare("insert into users (id, email, role) values (?, ?, ?)")
      .bind("owner-1", "owner@example.test", "admin"),
    testEnv.DB.prepare(`
      insert into sessions (token_hash, user_id, created_at, expires_at)
      values (?, ?, ?, ?)
    `).bind(
      await sha256Hex(SESSION_TOKEN),
      "owner-1",
      "2026-08-07T00:00:00.000Z",
      "2099-01-01T00:00:00.000Z"
    )
  ]);
});

describe("OAuth discovery metadata", () => {
  it("advertises canonical OAuth endpoints, S256, CIMD, and every authorization-server scope", async () => {
    const response = await SELF.fetch(
      `${CANONICAL_ISSUER}/.well-known/oauth-authorization-server`
    );
    expect(response.status).toBe(200);
    const metadata = await response.json<Record<string, unknown>>();

    expect(metadata).toMatchObject({
      issuer: CANONICAL_ISSUER,
      authorization_endpoint: `${CANONICAL_ISSUER}/oauth/authorize`,
      token_endpoint: `${CANONICAL_ISSUER}/oauth/token`,
      registration_endpoint: `${CANONICAL_ISSUER}/oauth/register`,
      code_challenge_methods_supported: ["S256"],
      client_id_metadata_document_supported: true
    });
    expect(metadata.scopes_supported).toEqual([...OWNER_SCOPES]);
    expect(oauthProviderOptions.scopesSupported).toEqual([...OWNER_SCOPES]);
  });

  it("advertises every owner scope in protected-resource discovery", async () => {
    const response = await SELF.fetch(
      `${CANONICAL_ISSUER}/.well-known/oauth-protected-resource/mcp`
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      resource: MCP_RESOURCE,
      authorization_servers: [CANONICAL_ISSUER],
      scopes_supported: [...OWNER_SCOPES],
      bearer_methods_supported: ["header"]
    });
  });
});

describe("request Host and Origin boundary", () => {
  it("accepts an absent Origin and the exact production Origin", async () => {
    const noOrigin = await SELF.fetch(
      `${CANONICAL_ISSUER}/.well-known/oauth-authorization-server`
    );
    expect(noOrigin.status).toBe(200);

    const sameOrigin = await SELF.fetch(
      `${CANONICAL_ISSUER}/.well-known/oauth-authorization-server`,
      { headers: { Origin: CANONICAL_ISSUER } }
    );
    expect(sameOrigin.status).toBe(200);
  });

  it("rejects an untrusted URL host, mismatched Host header, and foreign Origin", async () => {
    const untrustedUrl = await SELF.fetch(
      "https://attacker.example/.well-known/oauth-authorization-server"
    );
    expect(untrustedUrl.status).toBe(403);
    await expect(untrustedUrl.json()).resolves.toMatchObject({
      code: "REQUEST_HOST_REJECTED"
    });

    const mismatchedHost = await SELF.fetch(
      `${CANONICAL_ISSUER}/.well-known/oauth-authorization-server`,
      { headers: { Host: "attacker.example" } }
    );
    expect(mismatchedHost.status).toBe(403);
    await expect(mismatchedHost.json()).resolves.toMatchObject({
      code: "REQUEST_HOST_REJECTED"
    });

    const foreignOrigin = await SELF.fetch(
      `${CANONICAL_ISSUER}/.well-known/oauth-authorization-server`,
      { headers: { Origin: "https://attacker.example" } }
    );
    expect(foreignOrigin.status).toBe(403);
    await expect(foreignOrigin.json()).resolves.toMatchObject({
      code: "REQUEST_ORIGIN_REJECTED"
    });
  });

  it("rejects paths that only match the query-safe Cloudflare route prefix", async () => {
    for (const path of [
      "/mcp-extra",
      "/oauth/authorize/extra",
      "/.well-known/oauth-protected-resource/mcp-extra"
    ]) {
      const response = await SELF.fetch(`${CANONICAL_ISSUER}${path}`);
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({ code: "NOT_FOUND" });
    }
  });
});

describe("dynamic client registration policy", () => {
  it("allows HTTPS and HTTP loopback callbacks but rejects remote plaintext HTTP", async () => {
    const httpsKv = new MemoryKv();
    await expect(validateClientRegistration(
      registrationOptions(CLIENT_METADATA),
      registrationEnv(httpsKv)
    )).resolves.toBeUndefined();

    for (const redirectUri of [
      "http://localhost:43110/callback",
      "http://127.0.0.1:43110/callback",
      "http://[::1]:43110/callback"
    ]) {
      const metadata = {
        ...CLIENT_METADATA,
        application_type: "native",
        redirect_uris: [redirectUri]
      };
      await expect(validateClientRegistration(
        registrationOptions(metadata),
        registrationEnv(new MemoryKv())
      )).resolves.toBeUndefined();
    }

    const rejected = await validateClientRegistration(
      registrationOptions({
        ...CLIENT_METADATA,
        redirect_uris: ["http://client.example/callback"]
      }),
      registrationEnv(new MemoryKv())
    );
    expect(rejected).toMatchObject({
      code: "invalid_client_metadata",
      status: 400
    });
  });

  it("accepts RFC defaults when client_name, grant_types, and response_types are omitted", async () => {
    await expect(validateClientRegistration(
      registrationOptions({
        redirect_uris: ["https://client.example/callback"],
        token_endpoint_auth_method: "none",
        application_type: "web"
      }),
      registrationEnv(new MemoryKv())
    )).resolves.toBeUndefined();
  });

  it("rejects unverified software_statement metadata", async () => {
    const result = await validateClientRegistration(
      registrationOptions({
        ...CLIENT_METADATA,
        software_statement: "unverified.jwt.value"
      }),
      registrationEnv(new MemoryKv())
    );
    expect(result).toEqual({
      code: "invalid_software_statement",
      description: "Unverified software statements are not accepted.",
      status: 400
    });
  });

  it("HMACs the client IP and atomically limits concurrent hourly registrations", async () => {
    const ip = "198.51.100.44";
    const salt = "site-admin-mcp-test-only-hmac-key";
    const responses = await Promise.all(Array.from({ length: 24 }, () => (
      SELF.fetch(`${CANONICAL_ISSUER}/oauth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": ip
        },
        body: JSON.stringify(CLIENT_METADATA)
      })
    )));
    expect(responses.filter((response) => response.status === 201)).toHaveLength(12);
    expect(responses.filter((response) => response.status === 429)).toHaveLength(12);
    for (const response of responses.filter((item) => item.status === 429)) {
      await expect(response.json()).resolves.toMatchObject({ error: "slow_down" });
    }

    const row = await testEnv.DB.prepare(`
      select bucket_key, request_count from mcp_oauth_registration_limits
    `).first<{ bucket_key: string; request_count: number }>();
    expect(row?.bucket_key).not.toContain(ip);
    expect(row?.bucket_key).toMatch(/^mcp-dcr-rate:\d+:[a-f0-9]{64}$/);
    expect(row?.bucket_key).toMatch(new RegExp(`${await hmacSha256Hex(salt, ip)}$`));
    expect(Number(row?.request_count || 0)).toBe(12);
  });

  it("charges malformed and oversized bodies before provider parsing", async () => {
    const ip = "198.51.100.45";
    const malformed = await SELF.fetch(`${CANONICAL_ISSUER}/oauth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": ip
      },
      body: "{not-json"
    });
    expect(malformed.status).toBe(400);

    const oversized = await SELF.fetch(`${CANONICAL_ISSUER}/oauth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": ip
      },
      body: "x".repeat(12 * 1024 + 1)
    });
    expect(oversized.status).toBe(413);
    await expect(oversized.json()).resolves.toMatchObject({
      code: "REQUEST_BODY_TOO_LARGE"
    });

    const row = await testEnv.DB.prepare(`
      select bucket_key, request_count from mcp_oauth_registration_limits
    `).first<{ bucket_key: string; request_count: number }>();
    expect(row?.bucket_key).not.toContain(ip);
    expect(Number(row?.request_count || 0)).toBe(2);
  });
});

describe("canonical OAuth resource policy", () => {
  it("requires exactly one canonical resource on authorization requests", async () => {
    for (const resources of [
      [],
      ["https://lusu575.com/other"],
      [MCP_RESOURCE, MCP_RESOURCE]
    ]) {
      const response = await SELF.fetch(authorizeUrl(resources), {
        headers: { Cookie: `lusu_session=${SESSION_TOKEN}` }
      });
      expect(response.status).toBe(400);
      expect(await response.text()).toContain("invalid_target");
    }

    const canonical = await SELF.fetch(authorizeUrl([MCP_RESOURCE]), {
      headers: { Cookie: `lusu_session=${SESSION_TOKEN}` }
    });
    expect(canonical.status).toBe(400);
    expect(await canonical.text()).not.toContain("invalid_target");
  });

  it("requires exactly one canonical resource on token issuance requests", async () => {
    for (const resources of [
      [],
      ["https://lusu575.com/other"],
      [MCP_RESOURCE, MCP_RESOURCE]
    ]) {
      const { response, body } = await tokenRequest(resources);
      expect(response.status).toBe(400);
      expect(body).toMatchObject({ error: "invalid_target" });
    }

    const canonical = await tokenRequest([MCP_RESOURCE]);
    expect(canonical.response.status).toBe(401);
    expect(canonical.body.error).not.toBe("invalid_target");
  });
});

describe("owner consent page", () => {
  it("renders zh/en/ja consent copy and a warning for loopback callbacks", async () => {
    const redirectUri = "http://127.0.0.1:43110/callback";
    const consentEnv = {
      DB: testEnv.DB,
      OAUTH_KV: testEnv.OAUTH_KV,
      ANALYTICS_IP_HASH_SALT: "test-only-consent-salt",
      OAUTH_PROVIDER: {
        async parseAuthRequest() {
          return {
            responseType: "code",
            clientId: "loopback-client",
            redirectUri,
            scope: ["content:read", "content:write", "content:delete", "games:play"],
            state: "consent-state",
            codeChallenge: "C".repeat(43),
            codeChallengeMethod: "S256",
            resource: MCP_RESOURCE,
            issuer: CANONICAL_ISSUER
          };
        },
        async lookupClient() {
          return {
            clientId: "loopback-client",
            clientName: "Local AI client",
            redirectUris: [redirectUri]
          };
        }
      }
    } as unknown as Env;
    const request = new Request(authorizeUrl([MCP_RESOURCE]), {
      headers: { Cookie: `lusu_session=${SESSION_TOKEN}` }
    });

    const response = await oauthDefaultHandler.fetch(request, consentEnv);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin");
    expect(response.headers.get("cross-origin-opener-policy")).toBe("same-origin-allow-popups");
    expect(response.headers.get("content-security-policy")).toContain(
      "form-action 'self' http://127.0.0.1:43110"
    );
    expect(response.headers.get("content-security-policy")).not.toContain("/callback");
    const html = await response.text();
    expect(html).toContain('<html lang="zh-CN">');
    expect(html).toContain('<span lang="en">');
    expect(html).toContain('<span lang="ja">');
    expect(html).toContain("允许 AI 连接站长 MCP？");
    expect(html).toContain("Allow this AI client?");
    expect(html).toContain("AI クライアントを許可しますか？");
    expect(html).toContain("本机回调 / Local callback / ローカルコールバック");
    expect(html).toContain("Continue only if you just initiated this connection");
    expect(html).toContain(redirectUri);
    expect(html).toContain("content:read");
    expect(html).toContain("content:write");
    expect(html).toContain("content:delete");
    expect(html).toContain("games:play");
    expect(html).toContain("knowledge articles and video records");
    expect(html).toContain("ordinary article or video record");
    expect(html).toContain("Read and control a currently open game after explicit pairing");
  });

  it("adds only the exact registered HTTPS callback origin to consent form-action", async () => {
    const redirectUri = "https://client.example:8443/oauth/callback?tenant=owner";
    const consentEnv = {
      DB: testEnv.DB,
      OAUTH_KV: testEnv.OAUTH_KV,
      ANALYTICS_IP_HASH_SALT: "test-only-consent-salt-at-least-32-bytes",
      OAUTH_PROVIDER: {
        async parseAuthRequest() {
          return {
            responseType: "code",
            clientId: "https-callback-client",
            redirectUri,
            scope: ["content:read"],
            state: "https-callback-state",
            codeChallenge: "F".repeat(43),
            codeChallengeMethod: "S256",
            resource: MCP_RESOURCE,
            issuer: CANONICAL_ISSUER
          };
        },
        async lookupClient() {
          return {
            clientId: "https-callback-client",
            clientName: "HTTPS callback client",
            redirectUris: [redirectUri]
          };
        }
      }
    } as unknown as Env;
    const response = await oauthDefaultHandler.fetch(
      new Request(authorizeUrl([MCP_RESOURCE]), {
        headers: { Cookie: `lusu_session=${SESSION_TOKEN}` }
      }),
      consentEnv
    );
    expect(response.status).toBe(200);
    const csp = String(response.headers.get("content-security-policy") || "");
    expect(csp).toContain("form-action 'self' https://client.example:8443");
    expect(csp).not.toContain("/oauth/callback");
    expect(csp).not.toContain("tenant=owner");
    expect(csp).not.toContain("https:*");
  });

  it("rejects unsafe or unregistered callback URIs without adding them to CSP", async () => {
    const unsafeRedirects = [
      "javascript:alert(1)",
      "data:text/plain,callback",
      "file:///tmp/callback",
      "http://client.example/callback",
      "http://localhost.evil.example/callback",
      "https://user:password@client.example/callback",
      "https://client.example/callback#fragment",
      "https:\\client.example\\callback",
      "https://client.example/call back"
    ];
    for (const redirectUri of unsafeRedirects) {
      const consentEnv = {
        DB: testEnv.DB,
        OAUTH_KV: testEnv.OAUTH_KV,
        ANALYTICS_IP_HASH_SALT: "test-only-consent-salt-at-least-32-bytes",
        OAUTH_PROVIDER: {
          async parseAuthRequest() {
            return {
              responseType: "code",
              clientId: "unsafe-callback-client",
              redirectUri,
              scope: ["content:read"],
              state: "unsafe-callback-state",
              codeChallenge: "G".repeat(43),
              codeChallengeMethod: "S256",
              resource: MCP_RESOURCE,
              issuer: CANONICAL_ISSUER
            };
          },
          async lookupClient() {
            return {
              clientId: "unsafe-callback-client",
              clientName: "Unsafe callback client",
              redirectUris: [redirectUri]
            };
          }
        }
      } as unknown as Env;
      const response = await oauthDefaultHandler.fetch(
        new Request(authorizeUrl([MCP_RESOURCE]), {
          headers: { Cookie: `lusu_session=${SESSION_TOKEN}` }
        }),
        consentEnv
      );
      expect(response.status, redirectUri).toBe(400);
      expect(response.headers.get("location"), redirectUri).toBeNull();
      expect(await response.text(), redirectUri).toContain("OAUTH_REDIRECT_URI_UNSAFE");
      expect(response.headers.get("content-security-policy"), redirectUri).toContain(
        "form-action 'self'"
      );
      expect(response.headers.get("content-security-policy"), redirectUri).not.toContain(
        "client.example"
      );
    }

    const requestedRedirect = "https://client.example/callback";
    const unregisteredEnv = {
      DB: testEnv.DB,
      OAUTH_KV: testEnv.OAUTH_KV,
      ANALYTICS_IP_HASH_SALT: "test-only-consent-salt-at-least-32-bytes",
      OAUTH_PROVIDER: {
        async parseAuthRequest() {
          return {
            responseType: "code",
            clientId: "unregistered-callback-client",
            redirectUri: requestedRedirect,
            scope: ["content:read"],
            state: "unregistered-callback-state",
            codeChallenge: "H".repeat(43),
            codeChallengeMethod: "S256",
            resource: MCP_RESOURCE,
            issuer: CANONICAL_ISSUER
          };
        },
        async lookupClient() {
          return {
            clientId: "unregistered-callback-client",
            clientName: "Unregistered callback client",
            redirectUris: ["https://other.example/callback"]
          };
        }
      }
    } as unknown as Env;
    const unregistered = await oauthDefaultHandler.fetch(
      new Request(authorizeUrl([MCP_RESOURCE]), {
        headers: { Cookie: `lusu_session=${SESSION_TOKEN}` }
      }),
      unregisteredEnv
    );
    expect(unregistered.status).toBe(400);
    expect(unregistered.headers.get("location")).toBeNull();
    expect(await unregistered.text()).toContain("OAUTH_REDIRECT_URI_NOT_REGISTERED");
    expect(unregistered.headers.get("content-security-policy")).toContain("form-action 'self'");
    expect(unregistered.headers.get("content-security-policy")).not.toContain("client.example");
  });

  it("replays one PKCE-bound completion for rapid and sequential duplicate approval posts", async () => {
    const redirectUri = "http://127.0.0.1:43110/callback";
    const providerEntered = deferred();
    const releaseProvider = deferred();
    const secondGrantInsert = deferred();
    let grantInsertCount = 0;
    let completeAuthorizationCalls = 0;
    const signaledDb = {
      prepare(query: string) {
        if (/insert\s+into\s+mcp_oauth_grants/i.test(query)) {
          grantInsertCount += 1;
          if (grantInsertCount === 2) secondGrantInsert.resolve();
        }
        return testEnv.DB.prepare(query);
      },
      batch(statements: D1PreparedStatement[]) {
        return testEnv.DB.batch(statements);
      }
    } as unknown as D1Database;
    const completionRedirect = new URL(redirectUri);
    completionRedirect.searchParams.set("code", "provider-code-bound-to-test-pkce");
    completionRedirect.searchParams.set("state", "duplicate-consent-state");
    completionRedirect.searchParams.set("iss", CANONICAL_ISSUER);
    const consentEnv = {
      DB: signaledDb,
      OAUTH_KV: testEnv.OAUTH_KV,
      ANALYTICS_IP_HASH_SALT: "test-only-consent-salt-at-least-32-bytes",
      OAUTH_PROVIDER: {
        async parseAuthRequest() {
          return {
            responseType: "code",
            clientId: "duplicate-consent-client",
            redirectUri,
            scope: ["content:read", "content:write"],
            state: "duplicate-consent-state",
            codeChallenge: "D".repeat(43),
            codeChallengeMethod: "S256",
            resource: MCP_RESOURCE,
            issuer: CANONICAL_ISSUER
          };
        },
        async lookupClient() {
          return {
            clientId: "duplicate-consent-client",
            clientName: "Duplicate consent test client",
            redirectUris: [redirectUri]
          };
        },
        async completeAuthorization() {
          completeAuthorizationCalls += 1;
          providerEntered.resolve();
          await releaseProvider.promise;
          return { redirectTo: completionRedirect.toString() };
        },
        async listUserGrants() {
          return { items: [] };
        },
        async revokeGrant() {}
      }
    } as unknown as Env;
    const consent = await oauthDefaultHandler.fetch(
      new Request(authorizeUrl([MCP_RESOURCE]), {
        headers: { Cookie: `lusu_session=${SESSION_TOKEN}` }
      }),
      consentEnv
    );
    expect(consent.status).toBe(200);
    const consentCookie = String(consent.headers.get("set-cookie") || "").split(";", 1)[0];
    const html = await consent.text();
    const flowId = hiddenInput(html, "flow_id");
    const csrfToken = hiddenInput(html, "csrf_token");
    const requestFingerprint = hiddenInput(html, "request_fingerprint");
    const postDecision = (
      decision = "approve",
      cookie = consentCookie,
      fingerprint = requestFingerprint
    ) => oauthDefaultHandler.fetch(
      new Request(`${CANONICAL_ISSUER}/oauth/authorize`, {
        method: "POST",
        headers: {
          Cookie: `lusu_session=${SESSION_TOKEN}${cookie ? `; ${cookie}` : ""}`,
          Origin: CANONICAL_ISSUER,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          flow_id: flowId,
          csrf_token: csrfToken,
          request_fingerprint: fingerprint,
          decision
        }).toString()
      }),
      consentEnv
    );

    const firstDecision = postDecision();
    await providerEntered.promise;
    const rapidDuplicate = postDecision();
    await secondGrantInsert.promise;
    releaseProvider.resolve();
    const [firstResponse, rapidResponse] = await Promise.all([
      firstDecision,
      rapidDuplicate
    ]);
    const sequentialResponse = await postDecision();

    for (const response of [firstResponse, rapidResponse, sequentialResponse]) {
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(completionRedirect.toString());
    }
    expect(completeAuthorizationCalls).toBe(1);
    const missingCookie = await postDecision("approve", "");
    expect(missingCookie.status).toBe(403);
    expect(await missingCookie.text()).toContain("OAUTH_CONSENT_CSRF_INVALID");
    const changedDecision = await postDecision("deny");
    expect(changedDecision.status).toBe(409);
    expect(await changedDecision.text()).toContain("OAUTH_CONSENT_DECISION_MISMATCH");
    const changedRequest = await postDecision("approve", consentCookie, "0".repeat(64));
    expect(changedRequest.status).toBe(403);
    expect(await changedRequest.text()).toContain("OAUTH_CONSENT_REQUEST_MISMATCH");
    const grants = await testEnv.DB.prepare(`
      select count(*) as count from mcp_oauth_grants
      where client_id = ? and status = 'active'
    `).bind("duplicate-consent-client").first<{ count: number }>();
    expect(Number(grants?.count || 0)).toBe(1);
  });

  it("isolates overlapping flows and retains each CSRF cookie for receipt replay", async () => {
    const redirectUri = "http://127.0.0.1:43110/callback";
    let completionCount = 0;
    const consentEnv = {
      DB: testEnv.DB,
      OAUTH_KV: testEnv.OAUTH_KV,
      ANALYTICS_IP_HASH_SALT: "test-only-consent-salt-at-least-32-bytes",
      OAUTH_PROVIDER: {
        async parseAuthRequest() {
          return {
            responseType: "code",
            clientId: "overlapping-consent-client",
            redirectUri,
            scope: ["content:read", "content:write"],
            state: "overlapping-consent-state",
            codeChallenge: "E".repeat(43),
            codeChallengeMethod: "S256",
            resource: MCP_RESOURCE,
            issuer: CANONICAL_ISSUER
          };
        },
        async lookupClient() {
          return {
            clientId: "overlapping-consent-client",
            clientName: "Overlapping consent test client",
            redirectUris: [redirectUri]
          };
        },
        async completeAuthorization() {
          completionCount += 1;
          const redirect = new URL(redirectUri);
          redirect.searchParams.set("code", `overlapping-code-${completionCount}`);
          redirect.searchParams.set("state", "overlapping-consent-state");
          redirect.searchParams.set("iss", CANONICAL_ISSUER);
          return { redirectTo: redirect.toString() };
        },
        async listUserGrants() {
          return { items: [] };
        },
        async revokeGrant() {}
      }
    } as unknown as Env;
    const jar = new Map([["lusu_session", SESSION_TOKEN]]);
    const beginFlow = async () => {
      const response = await oauthDefaultHandler.fetch(
        new Request(authorizeUrl([MCP_RESOURCE]), {
          headers: { Cookie: cookieHeader(jar) }
        }),
        consentEnv
      );
      expect(response.status).toBe(200);
      const cookieName = applySetCookie(jar, String(response.headers.get("set-cookie") || ""));
      const html = await response.text();
      return {
        cookieName,
        flowId: hiddenInput(html, "flow_id"),
        csrfToken: hiddenInput(html, "csrf_token"),
        requestFingerprint: hiddenInput(html, "request_fingerprint")
      };
    };
    const postFlow = async (flow: Awaited<ReturnType<typeof beginFlow>>) => {
      const response = await oauthDefaultHandler.fetch(
        new Request(`${CANONICAL_ISSUER}/oauth/authorize`, {
          method: "POST",
          headers: {
            Cookie: cookieHeader(jar),
            Origin: CANONICAL_ISSUER,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            flow_id: flow.flowId,
            csrf_token: flow.csrfToken,
            request_fingerprint: flow.requestFingerprint,
            decision: "approve"
          }).toString()
        }),
        consentEnv
      );
      applySetCookie(jar, String(response.headers.get("set-cookie") || ""));
      return response;
    };

    const firstFlow = await beginFlow();
    const secondFlow = await beginFlow();
    expect(firstFlow.cookieName).not.toBe(secondFlow.cookieName);
    expect(firstFlow.cookieName).toContain(firstFlow.flowId);
    expect(secondFlow.cookieName).toContain(secondFlow.flowId);
    expect(jar.has(firstFlow.cookieName)).toBe(true);
    expect(jar.has(secondFlow.cookieName)).toBe(true);

    const firstDecision = await postFlow(firstFlow);
    expect(firstDecision.status).toBe(302);
    expect(firstDecision.headers.get("set-cookie")).toContain("Max-Age=120");
    expect(jar.has(firstFlow.cookieName)).toBe(true);
    expect(jar.has(secondFlow.cookieName)).toBe(true);
    const firstReplay = await postFlow(firstFlow);
    expect(firstReplay.status).toBe(302);
    expect(firstReplay.headers.get("location")).toBe(firstDecision.headers.get("location"));
    expect(jar.has(firstFlow.cookieName)).toBe(true);
    const secondDecision = await postFlow(secondFlow);
    expect(secondDecision.status).toBe(302);
    expect(jar.has(firstFlow.cookieName)).toBe(true);
    expect(jar.has(secondFlow.cookieName)).toBe(true);
    expect(completionCount).toBe(2);
  });
});

describe("owner browser game relay", () => {
  it("requires exact same-origin WebSocket pairing and an active admin session", async () => {
    const pairingCode = randomPairingCode();
    const baseHeaders = {
      Host: "lusu575.com",
      Upgrade: "websocket",
      "Sec-WebSocket-Protocol": `lusu-game-v1, pair.${pairingCode}`,
      "Sec-WebSocket-Version": "13"
    };
    const missingOrigin = await SELF.fetch(
      `${CANONICAL_ISSUER}/mcp/browser-games/connect`,
      { headers: { ...baseHeaders, Cookie: `lusu_session=${SESSION_TOKEN}` } }
    );
    expect(missingOrigin.status).toBe(403);
    await expect(missingOrigin.json()).resolves.toMatchObject({
      code: "GAME_RELAY_ORIGIN_REJECTED"
    });

    const foreignOrigin = await SELF.fetch(
      `${CANONICAL_ISSUER}/mcp/browser-games/connect`,
      {
        headers: {
          ...baseHeaders,
          Cookie: `lusu_session=${SESSION_TOKEN}`,
          Origin: "https://attacker.example"
        }
      }
    );
    expect(foreignOrigin.status).toBe(403);
    await expect(foreignOrigin.json()).resolves.toMatchObject({
      code: "REQUEST_ORIGIN_REJECTED"
    });

    const missingSession = await SELF.fetch(
      `${CANONICAL_ISSUER}/mcp/browser-games/connect`,
      { headers: { ...baseHeaders, Origin: CANONICAL_ISSUER } }
    );
    expect(missingSession.status).toBe(401);
    await expect(missingSession.json()).resolves.toMatchObject({
      code: "OAUTH_LOGIN_REQUIRED"
    });

    const invalidProtocol = await SELF.fetch(
      `${CANONICAL_ISSUER}/mcp/browser-games/connect`,
      {
        headers: {
          ...baseHeaders,
          Cookie: `lusu_session=${SESSION_TOKEN}`,
          Origin: CANONICAL_ISSUER,
          "Sec-WebSocket-Protocol": `lusu-game-v1, pair.${pairingCode.slice(1)}`
        }
      }
    );
    expect(invalidProtocol.status).toBe(422);
    await expect(invalidProtocol.json()).resolves.toMatchObject({
      code: "GAME_PAIRING_CODE_INVALID"
    });
  });

  it("rejects browser action descriptors that expose raw control fields", async () => {
    const connection = await openGameRelay(randomPairingCode());
    connection.socket.send(JSON.stringify({
      type: "hello",
      protocolVersion: 1,
      gameId: "2048",
      browserSessionId: `browser_${"C".repeat(22)}`,
      revision: 0,
      observation: { score: 0 },
      actions: [{
        actionId: `act_${"D".repeat(22)}`,
        id: "move-left",
        label: "Move left",
        risk: "low",
        requiresConfirmation: false,
        selector: "#game-board"
      }]
    }));
    await expect(waitForRelayMessage(connection, "relay_error")).resolves.toMatchObject({
      code: "GAME_RELAY_ACTIONS_INVALID"
    });
  });

  it("round-trips only opaque action tokens with CAS, receipts, pause, and close", async () => {
    const accessToken = await authorizeTestClient(["games:play"]);
    const pairingCode = randomPairingCode();
    const connection = await openGameRelay(pairingCode);
    const actionId = `act_${"A".repeat(22)}`;
    const initialObservation = { board: [[2, 0], [0, 0]], score: 0 };
    const actions = [{
      actionId,
      id: "move-left",
      label: "Move left",
      group: "move",
      description: "Slide every tile left.",
      risk: "low",
      requiresConfirmation: false
    }];
    connection.socket.send(JSON.stringify({
      type: "hello",
      protocolVersion: 1,
      gameId: "2048",
      browserSessionId: `browser_${"B".repeat(22)}`,
      revision: 0,
      observation: initialObservation,
      actions
    }));
    const ready = await waitForRelayMessage(connection, "relay_ready");
    expect(ready).toMatchObject({
      protocolVersion: 1,
      state: "awaiting_pair"
    });
    const sessionId = String(ready.sessionId || "");
    expect(sessionId).toMatch(/^[a-f0-9]{64}$/);

    const paired = await ownerMcpRequest(accessToken, "tools/call", {
      name: "game_browser_pair",
      arguments: { pairingCode: pairingCode.toLowerCase().match(/.{1,5}/g)?.join("-") }
    });
    expect(paired.response.status, JSON.stringify(paired.body)).toBe(200);
    expect(paired.body.result?.isError, JSON.stringify(paired.body)).not.toBe(true);
    expect(structuredToolResult(paired.body)).toMatchObject({
      ok: true,
      paired: true,
      sessionId,
      gameId: "2048",
      revision: 0,
      actions: [],
      stale: true
    });
    await waitForRelayMessage(connection, "controller_connected");

    const pairReplay = await ownerMcpRequest(accessToken, "tools/call", {
      name: "game_browser_pair",
      arguments: { pairingCode }
    });
    expect(structuredToolResult(pairReplay.body)).toMatchObject({
      ok: true,
      paired: true,
      sessionId,
      actions: [],
      stale: true
    });

    const immediateOldAction = await ownerMcpRequest(accessToken, "tools/call", {
      name: "game_browser_act",
      arguments: {
        sessionId,
        expectedRevision: 0,
        clientActionId: "opaque-action-before-observe-0001",
        actionId
      }
    });
    expect(immediateOldAction.body.result?.isError).toBe(true);
    expect(structuredToolResult(immediateOldAction.body)).toMatchObject({
      code: "GAME_ACTIONS_STALE"
    });

    const secondToken = await authorizeTestClient(["games:play"]);
    const stolenPair = await ownerMcpRequest(secondToken, "tools/call", {
      name: "game_browser_pair",
      arguments: { pairingCode }
    });
    expect(stolenPair.body.result?.isError).toBe(true);
    expect(structuredToolResult(stolenPair.body)).toMatchObject({
      code: "GAME_PAIRING_CODE_USED"
    });

    const firstObserveIndex = connection.messages.length;
    const observePromise = ownerMcpRequest(accessToken, "tools/call", {
      name: "game_browser_observe",
      arguments: { sessionId }
    });
    const firstObserve = await waitForRelayMessage(connection, "observe", firstObserveIndex);
    connection.socket.send(JSON.stringify({
      type: "snapshot",
      protocolVersion: 1,
      commandId: firstObserve.commandId,
      revision: 0,
      observation: initialObservation,
      actions
    }));
    const observed = await observePromise;
    expect(structuredToolResult(observed.body)).toMatchObject({
      sessionId,
      gameId: "2048",
      revision: 0,
      observation: initialObservation
    });

    const observeStartIndex = connection.messages.length;
    const actionsPromise = ownerMcpRequest(accessToken, "tools/call", {
      name: "game_browser_actions",
      arguments: { sessionId }
    });
    const observeCommand = await waitForRelayMessage(
      connection,
      "observe",
      observeStartIndex
    );
    expect(Object.keys(observeCommand).sort()).toEqual([
      "commandId", "protocolVersion", "type"
    ]);
    connection.socket.send(JSON.stringify({
      type: "snapshot",
      protocolVersion: 1,
      commandId: observeCommand.commandId,
      revision: 0,
      observation: initialObservation,
      actions
    }));
    const listedActions = await actionsPromise;
    expect(structuredToolResult(listedActions.body)).toMatchObject({
      sessionId,
      revision: 0,
      actions: [{ actionId, id: "move-left" }]
    });
    expect(JSON.stringify(structuredToolResult(listedActions.body))).not.toContain("selector");

    const clientActionId = "opaque-action-roundtrip-0001";
    const actionStartIndex = connection.messages.length;
    const actionPromise = ownerMcpRequest(accessToken, "tools/call", {
      name: "game_browser_act",
      arguments: {
        sessionId,
        expectedRevision: 0,
        clientActionId,
        actionId
      }
    });
    const actionCommand = await waitForRelayMessage(
      connection,
      "action",
      actionStartIndex
    );
    expect(actionCommand).toEqual({
      type: "action",
      protocolVersion: 1,
      commandId: expect.stringMatching(/^[A-Za-z0-9_-]{16,128}$/),
      expectedRevision: 0,
      clientActionId,
      actionId
    });
    expect(actionCommand).not.toHaveProperty("action");
    expect(actionCommand).not.toHaveProperty("selector");
    const nextObservation = { board: [[2, 0], [0, 0]], score: 4 };
    await installGameOutcomeAuditFailure("success");
    connection.socket.send(JSON.stringify({
      type: "action_result",
      protocolVersion: 1,
      commandId: actionCommand.commandId,
      clientActionId,
      ok: true,
      revision: 1,
      observation: nextObservation,
      actions,
      actionResult: {
        protocolVersion: 1,
        gameId: "2048",
        sessionId: `game_2048_${"c".repeat(32)}`,
        clientActionId,
        status: "applied",
        reason: "moved",
        beforeRevision: 0,
        revision: 1,
        deduplicated: false,
        events: [],
        observation: nextObservation
      }
    }));
    const acted = await actionPromise;
    expect(acted.body.result?.isError, JSON.stringify(acted.body)).toBe(true);
    expect(structuredToolResult(acted.body)).toMatchObject({
      code: "MCP_OAUTH_AUDIT_FAILED"
    });
    await clearGameOutcomeAuditFailure();

    const beforeReplayMessages = connection.messages.length;
    const replayed = await ownerMcpRequest(accessToken, "tools/call", {
      name: "game_browser_act",
      arguments: {
        sessionId,
        expectedRevision: 0,
        clientActionId,
        actionId
      }
    });
    expect(structuredToolResult(replayed.body)).toMatchObject({
      ok: true,
      replayed: true,
      revision: 1,
      clientActionId
    });
    expect(connection.messages.slice(beforeReplayMessages)
      .some((message) => message.type === "action")).toBe(false);

    const reused = await ownerMcpRequest(accessToken, "tools/call", {
      name: "game_browser_act",
      arguments: {
        sessionId,
        expectedRevision: 1,
        clientActionId,
        actionId
      }
    });
    expect(reused.body.result?.isError).toBe(true);
    expect(structuredToolResult(reused.body)).toMatchObject({
      code: "GAME_CLIENT_ACTION_ID_REUSED"
    });

    const stale = await ownerMcpRequest(accessToken, "tools/call", {
      name: "game_browser_act",
      arguments: {
        sessionId,
        expectedRevision: 0,
        clientActionId: "opaque-action-roundtrip-0002",
        actionId
      }
    });
    expect(stale.body.result?.isError).toBe(true);
    expect(structuredToolResult(stale.body)).toMatchObject({
      code: "GAME_REVISION_CONFLICT",
      details: { currentRevision: 1 }
    });

    const pauseStartIndex = connection.messages.length;
    const paused = await ownerMcpRequest(accessToken, "tools/call", {
      name: "game_browser_pause",
      arguments: { sessionId }
    });
    expect(structuredToolResult(paused.body)).toMatchObject({
      ok: true,
      sessionId,
      state: "paused"
    });
    await waitForRelayMessage(connection, "pause", pauseStartIndex);

    await installGameOutcomeAuditFailure("error");
    const whilePausedAuditFailed = await ownerMcpRequest(accessToken, "tools/call", {
      name: "game_browser_act",
      arguments: {
        sessionId,
        expectedRevision: 1,
        clientActionId: "opaque-action-roundtrip-0003",
        actionId
      }
    });
    expect(whilePausedAuditFailed.body.result?.isError).toBe(true);
    expect(structuredToolResult(whilePausedAuditFailed.body)).toMatchObject({
      code: "MCP_OAUTH_AUDIT_FAILED"
    });
    await clearGameOutcomeAuditFailure();

    const whilePaused = await ownerMcpRequest(accessToken, "tools/call", {
      name: "game_browser_act",
      arguments: {
        sessionId,
        expectedRevision: 1,
        clientActionId: "opaque-action-roundtrip-0003",
        actionId
      }
    });
    expect(whilePaused.body.result?.isError).toBe(true);
    expect(structuredToolResult(whilePaused.body)).toMatchObject({
      code: "GAME_SESSION_PAUSED"
    });

    connection.socket.send(JSON.stringify({
      type: "user_resume",
      protocolVersion: 1,
      revision: 1,
      observation: nextObservation,
      actions
    }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const resumedObserveIndex = connection.messages.length;
    const resumedObservePromise = ownerMcpRequest(accessToken, "tools/call", {
      name: "game_browser_observe",
      arguments: { sessionId }
    });
    const resumedObserve = await waitForRelayMessage(
      connection,
      "observe",
      resumedObserveIndex
    );
    connection.socket.send(JSON.stringify({
      type: "snapshot",
      protocolVersion: 1,
      commandId: resumedObserve.commandId,
      revision: 1,
      observation: nextObservation,
      actions
    }));
    expect(structuredToolResult((await resumedObservePromise).body)).toMatchObject({
      sessionId,
      state: "active",
      revision: 1
    });

    const pendingClientActionId = "opaque-action-pending-0001";
    const pendingActionStartIndex = connection.messages.length;
    const pendingActionPromise = ownerMcpRequest(accessToken, "tools/call", {
      name: "game_browser_act",
      arguments: {
        sessionId,
        expectedRevision: 1,
        clientActionId: pendingClientActionId,
        actionId
      }
    });
    await waitForRelayMessage(connection, "action", pendingActionStartIndex);
    const pendingAction = await pendingActionPromise;
    expect(pendingAction.body.result?.isError, JSON.stringify(pendingAction.body)).not.toBe(true);
    expect(structuredToolResult(pendingAction.body)).toMatchObject({
      ok: true,
      status: "pending",
      sessionId,
      retryable: true
    });
    const pendingAudit = await testEnv.DB.prepare(`
      select result
      from mcp_oauth_audit_log
      where tool_name = 'game_browser_act' and operation_id = ? and result <> 'attempt'
      order by created_at desc
      limit 1
    `).bind(pendingClientActionId).first<{ result: string }>();
    expect(pendingAudit?.result).toBe("pending");

    const closeStartIndex = connection.messages.length;
    const closed = await ownerMcpRequest(accessToken, "tools/call", {
      name: "game_browser_close",
      arguments: { sessionId, confirm: true }
    });
    expect(structuredToolResult(closed.body)).toMatchObject({
      ok: true,
      sessionId,
      state: "closed"
    });
    await waitForRelayMessage(connection, "close", closeStartIndex);

    const auditRows = (await testEnv.DB.prepare(`
      select capability_id, tool_name, operation_id, result
      from mcp_oauth_audit_log
      where tool_name like 'game_browser_%'
      order by created_at asc
    `).all()).results || [];
    expect(auditRows.some((row) => (
      row.capability_id === "games.browser.act"
      && row.tool_name === "game_browser_act"
      && row.operation_id === clientActionId
      && row.result === "success"
    ))).toBe(true);
    const auditedCapabilities = new Set(auditRows.map((row) => String(row.capability_id)));
    expect([
        "games.browser.pair",
        "games.browser.observe",
        "games.browser.actions",
        "games.browser.act",
        "games.browser.pause",
        "games.browser.close"
      ].every((capabilityId) => auditedCapabilities.has(capabilityId))).toBe(true);
  });

  it("keeps game tools visible but challenges tokens without games:play", async () => {
    const accessToken = await authorizeTestClient(["content:read"]);
    const listedTools = await ownerMcpRequest(accessToken, "tools/list");
    const tools = listedTools.body.result.tools as Array<Record<string, any>>;
    expect(tools.map((tool) => tool.name)).toContain("game_browser_pair");

    const denied = await ownerMcpRequest(accessToken, "tools/call", {
      name: "game_browser_pair",
      arguments: { pairingCode: randomPairingCode() }
    });
    expect(denied.body.result?.isError).toBe(true);
    expect(structuredToolResult(denied.body)).toMatchObject({
      code: "MCP_OAUTH_SCOPE_REQUIRED"
    });
    expect(denied.body.result?._meta?.["mcp/www_authenticate"]?.[0]).toContain(
      'scope="games:play"'
    );
  });
});

describe("complete owner OAuth MCP flow", () => {
  it("registers, authorizes, lists tools, and completes the atomic article lifecycle", async () => {
    const accessToken = await authorizeTestClient([
      "content:read",
      "content:write",
      "content:delete"
    ]);
    const listedTools = await ownerMcpRequest(accessToken, "tools/list");
    expect(listedTools.response.status, JSON.stringify(listedTools.body)).toBe(200);
    expect(listedTools.body.error).toBeUndefined();
    const tools = listedTools.body.result.tools as Array<Record<string, any>>;
    expect(tools.map((tool) => tool.name)).toEqual([
      "site_capabilities",
      "content_list",
      "content_search",
      "article_get",
      "videos_list",
      "video_get",
      "article_manage_list",
      "article_manage_get",
      "article_publish",
      "article_update",
      "article_delete",
      "game_browser_pair",
      "game_browser_observe",
      "game_browser_actions",
      "game_browser_act",
      "game_browser_pause",
      "game_browser_close",
      "video_manage_list",
      "video_manage_get",
      "video_publish",
      "video_update",
      "video_refresh_metadata",
      "video_delete"
    ]);
    const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
    expect(toolsByName.get("content_list")?._meta?.securitySchemes).toEqual([
      { type: "oauth2", scopes: ["content:read"] }
    ]);
    expect(toolsByName.get("videos_list")?._meta?.securitySchemes).toEqual([
      { type: "oauth2", scopes: ["content:read"] }
    ]);
    expect(toolsByName.get("video_get")?._meta?.securitySchemes).toEqual([
      { type: "oauth2", scopes: ["content:read"] }
    ]);
    expect(toolsByName.get("article_publish")?._meta?.securitySchemes).toEqual([
      { type: "oauth2", scopes: ["content:write"] }
    ]);
    expect(toolsByName.get("article_delete")?._meta?.securitySchemes).toEqual([
      { type: "oauth2", scopes: ["content:delete"] }
    ]);
    expect(toolsByName.get("game_browser_act")?._meta?.securitySchemes).toEqual([
      { type: "oauth2", scopes: ["games:play"] }
    ]);
    expect(toolsByName.get("video_publish")?._meta?.securitySchemes).toEqual([
      { type: "oauth2", scopes: ["content:write"] }
    ]);
    expect(toolsByName.get("video_delete")?._meta?.securitySchemes).toEqual([
      { type: "oauth2", scopes: ["content:delete"] }
    ]);

    const discoveredCapabilities = await ownerMcpRequest(accessToken, "tools/call", {
      name: "site_capabilities",
      arguments: {}
    });
    expect(
      discoveredCapabilities.response.status,
      JSON.stringify(discoveredCapabilities.body)
    ).toBe(200);
    const capabilityResult = structuredToolResult(discoveredCapabilities.body);
    expect(capabilityResult).toMatchObject({
      mode: "public-read-only",
      count: 4
    });
    expect((capabilityResult.capabilities as Array<Record<string, unknown>>)
      .map((capability) => capability.id)).toEqual([
      "content.articles.list",
      "content.articles.search",
      "content.articles.get",
      "content.daily-ai-news.get"
    ]);
    expect((capabilityResult.capabilities as Array<Record<string, unknown>>)
      .every((capability) => (
        capability.domain === "public-content"
        && capability.scope === "content:read"
      ))).toBe(true);

    const payload = publishInput("oauth-publish-integration-0001", "oauth-integration-test");
    const published = await ownerMcpRequest(accessToken, "tools/call", {
      name: "article_publish",
      arguments: payload
    });
    expect(published.response.status, JSON.stringify(published.body)).toBe(200);
    expect(published.body.result?.isError, JSON.stringify(published.body)).not.toBe(true);
    const created = structuredToolResult(published.body);
    expect(created).toMatchObject({ ok: true, duplicate: false });
    const articleId = String(created.articleId || "");
    expect(articleId).not.toBe("");

    const replayed = await ownerMcpRequest(accessToken, "tools/call", {
      name: "article_publish",
      arguments: payload
    });
    expect(structuredToolResult(replayed.body)).toMatchObject({
      ok: true,
      duplicate: true,
      articleId
    });

    const managedList = await ownerMcpRequest(accessToken, "tools/call", {
      name: "article_manage_list",
      arguments: { status: "published", limit: 10 }
    });
    expect(structuredToolResult(managedList.body)).toMatchObject({
      limit: 10,
      articles: [{ articleId, slug: "oauth-integration-test" }]
    });

    const managedGet = await ownerMcpRequest(accessToken, "tools/call", {
      name: "article_manage_get",
      arguments: { articleId }
    });
    const beforeUpdate = structuredToolResult(managedGet.body);
    expect(beforeUpdate).toMatchObject({
      article: { articleId, slug: "oauth-integration-test" }
    });

    const updated = await ownerMcpRequest(accessToken, "tools/call", {
      name: "article_update",
      arguments: {
        articleId,
        operationId: "oauth-update-integration-0001",
        expectedUpdatedAt: beforeUpdate.article.updatedAt,
        tags: ["MCP", "integration", "updated"],
        translations: {
          en: {
            title: "OAuth MCP integration test updated",
            summary: "CAS update completed.",
            contentMarkdown: "# Updated\n\nCAS update completed."
          }
        }
      }
    });
    const updateResult = structuredToolResult(updated.body);
    expect(updateResult).toMatchObject({ ok: true, duplicate: false, articleId });
    expect(updateResult.updatedAt).not.toBe("");

    const deleted = await ownerMcpRequest(accessToken, "tools/call", {
      name: "article_delete",
      arguments: {
        articleId,
        operationId: "oauth-delete-integration-0001",
        expectedUpdatedAt: updateResult.updatedAt,
        confirm: true
      }
    });
    expect(structuredToolResult(deleted.body)).toMatchObject({
      ok: true,
      duplicate: false,
      deleted: true,
      articleId
    });
    const remaining = await testEnv.DB.prepare("select count(*) as count from articles").first();
    expect(Number(remaining?.count || 0)).toBe(0);
  });

  it("completes modern article lifecycles for OAuth grant refs beginning with base64url symbols", async () => {
    const boundaryGrantRefs = [
      `-${"A".repeat(15)}`,
      `_${"z".repeat(127)}`
    ];
    for (const [index, grantRef] of boundaryGrantRefs.entries()) {
      const accessToken = await authorizeTestClient([
        "content:read",
        "content:write",
        "content:delete"
      ], grantRef);
      const suffix = index + 1;
      const slug = `oauth-grant-boundary-${suffix}`;
      const payload = publishInput(`oauth-boundary-publish-000${suffix}`, slug);
      const published = await ownerMcpRequest(accessToken, "tools/call", {
        name: "article_publish",
        arguments: payload
      });
      expect(published.response.status, JSON.stringify(published.body)).toBe(200);
      expect(published.body.result?.isError, JSON.stringify(published.body)).not.toBe(true);
      const created = structuredToolResult(published.body);
      expect(created).toMatchObject({ ok: true, duplicate: false });
      const articleId = String(created.articleId || "");
      expect(articleId).not.toBe("");

      const replayed = await ownerMcpRequest(accessToken, "tools/call", {
        name: "article_publish",
        arguments: payload
      });
      expect(structuredToolResult(replayed.body)).toMatchObject({
        ok: true,
        duplicate: true,
        articleId
      });

      const managedGet = await ownerMcpRequest(accessToken, "tools/call", {
        name: "article_manage_get",
        arguments: { articleId }
      });
      const beforeUpdate = structuredToolResult(managedGet.body);
      expect(beforeUpdate).toMatchObject({ article: { articleId, slug } });

      const updated = await ownerMcpRequest(accessToken, "tools/call", {
        name: "article_update",
        arguments: {
          articleId,
          operationId: `oauth-boundary-update-000${suffix}`,
          expectedUpdatedAt: beforeUpdate.article.updatedAt,
          tags: ["MCP", "grant-boundary"]
        }
      });
      const updateResult = structuredToolResult(updated.body);
      expect(updateResult).toMatchObject({ ok: true, duplicate: false, articleId });

      const deleted = await ownerMcpRequest(accessToken, "tools/call", {
        name: "article_delete",
        arguments: {
          articleId,
          operationId: `oauth-boundary-delete-000${suffix}`,
          expectedUpdatedAt: updateResult.updatedAt,
          confirm: true
        }
      });
      expect(structuredToolResult(deleted.body)).toMatchObject({
        ok: true,
        duplicate: false,
        deleted: true,
        articleId
      });

      const audit = await testEnv.DB.prepare(`
        select token_id from agent_audit_log
        where action = 'agent-article-published' and target_id = ?
        limit 1
      `).bind(articleId).first<{ token_id: string }>();
      expect(audit?.token_id).toBe(`oauth:${grantRef}`);
    }
  });

  it("keeps owner tools visible and returns a scope challenge without writing", async () => {
    const accessToken = await authorizeTestClient(["content:read"]);
    const listedTools = await ownerMcpRequest(accessToken, "tools/list");
    expect(listedTools.response.status, JSON.stringify(listedTools.body)).toBe(200);
    expect((listedTools.body.result.tools as Array<{ name: string }>).map(({ name }) => name))
      .toContain("article_publish");

    const denied = await ownerMcpRequest(accessToken, "tools/call", {
      name: "article_publish",
      arguments: publishInput("oauth-scope-denied-0001", "oauth-scope-denied")
    });
    expect(denied.response.status, JSON.stringify(denied.body)).toBe(200);
    expect(denied.body.result?.isError).toBe(true);
    expect(structuredToolResult(denied.body)).toMatchObject({
      code: "MCP_OAUTH_SCOPE_REQUIRED"
    });
    expect(denied.body.result?._meta?.["mcp/www_authenticate"]).toEqual([
      expect.stringContaining('scope="content:write"')
    ]);
    const remaining = await testEnv.DB.prepare("select count(*) as count from articles").first();
    expect(Number(remaining?.count || 0)).toBe(0);
  });

  it("revokes the ledger when the owner loses admin and returns invalid_token", async () => {
    const accessToken = await authorizeTestClient([
      "content:read",
      "content:write"
    ]);
    await testEnv.DB.prepare("update users set role = 'user' where id = ?")
      .bind("owner-1")
      .run();

    const denied = await ownerMcpRequest(accessToken, "tools/call", {
      name: "article_manage_list",
      arguments: { limit: 10 }
    });
    expect(denied.response.status, JSON.stringify(denied.body)).toBe(200);
    expect(denied.body.result?.isError).toBe(true);
    expect(structuredToolResult(denied.body)).toMatchObject({
      code: "MCP_OAUTH_ADMIN_REQUIRED"
    });
    const challenge = denied.body.result?._meta?.["mcp/www_authenticate"]?.[0];
    expect(challenge).toContain('error="invalid_token"');
    expect(challenge).not.toContain("scope=");

    const grant = await testEnv.DB.prepare(`
      select status, revoked_reason from mcp_oauth_grants limit 1
    `).first<{ status: string; revoked_reason: string }>();
    expect(grant).toMatchObject({
      status: "revoked",
      revoked_reason: "admin-role-lost"
    });

    const afterRevocation = await ownerMcpRequest(accessToken, "tools/list");
    expect(afterRevocation.response.status).toBe(401);
    expect(afterRevocation.response.headers.get("www-authenticate")).toContain(
      'error="invalid_token"'
    );
  });

  it("synchronizes RFC 7009 refresh revocation to D1 exactly once", async () => {
    let credentials: {
      clientId: string;
      accessToken: string;
      refreshToken: string;
    } | undefined;
    await authorizeTestClient(
      ["content:read", "content:write"],
      "",
      (value) => { credentials = value; }
    );
    expect(credentials).toBeDefined();
    if (!credentials) throw new Error("Missing OAuth test credentials");
    const revocationBody = new URLSearchParams({
      token: credentials.refreshToken,
      token_type_hint: "refresh_token",
      client_id: credentials.clientId
    }).toString();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const revoked = await SELF.fetch(`${CANONICAL_ISSUER}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: revocationBody
      });
      expect(revoked.status).toBe(200);
      expect(await revoked.text()).toBe("");
    }

    const grant = await testEnv.DB.prepare(`
      select status, revoked_reason from mcp_oauth_grants limit 1
    `).first<{ status: string; revoked_reason: string }>();
    expect(grant).toEqual({
      status: "revoked",
      revoked_reason: "rfc7009-refresh-token"
    });
    const audit = await testEnv.DB.prepare(`
      select count(*) as count from mcp_oauth_audit_log
      where action = 'mcp-oauth-grant-revoked'
    `).first<{ count: number }>();
    expect(Number(audit?.count || 0)).toBe(1);

    const oldAccess = await ownerMcpRequest(credentials.accessToken, "tools/list");
    expect(oldAccess.response.status).toBe(401);
  });

  it("keeps the D1 grant active when RFC 7009 revokes only an access token", async () => {
    let credentials: {
      clientId: string;
      accessToken: string;
      refreshToken: string;
    } | undefined;
    await authorizeTestClient(
      ["content:read", "content:write"],
      "",
      (value) => { credentials = value; }
    );
    expect(credentials).toBeDefined();
    if (!credentials) throw new Error("Missing OAuth test credentials");

    const refreshParts = credentials.refreshToken.split(":");
    expect(refreshParts).toHaveLength(3);
    const invalidSameGrantToken = `${refreshParts[0]}:${refreshParts[1]}:invalid-refresh-token`;
    const invalid = await SELF.fetch(`${CANONICAL_ISSUER}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: invalidSameGrantToken,
        token_type_hint: "refresh_token",
        client_id: credentials.clientId
      }).toString()
    });
    expect(invalid.status).toBe(200);

    const wrongClient = await SELF.fetch(`${CANONICAL_ISSUER}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: credentials.refreshToken,
        token_type_hint: "refresh_token",
        client_id: "unregistered-client"
      }).toString()
    });
    expect([200, 400, 401]).toContain(wrongClient.status);

    const revoked = await SELF.fetch(`${CANONICAL_ISSUER}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: credentials.accessToken,
        client_id: credentials.clientId
      }).toString()
    });
    expect(revoked.status).toBe(200);

    const grant = await testEnv.DB.prepare(`
      select status, revoked_reason from mcp_oauth_grants limit 1
    `).first<{ status: string; revoked_reason: string }>();
    expect(grant).toEqual({ status: "active", revoked_reason: "" });
    const audit = await testEnv.DB.prepare(`
      select count(*) as count from mcp_oauth_audit_log
      where action = 'mcp-oauth-grant-revoked'
    `).first<{ count: number }>();
    expect(Number(audit?.count || 0)).toBe(0);

    const oldAccess = await ownerMcpRequest(credentials.accessToken, "tools/list");
    expect(oldAccess.response.status).toBe(401);
  });

  it("deletes the verified provider grant when RFC 7009 returns 200 after a refresh rotation", async () => {
    await authorizeTestClient(["content:read", "content:write"]);
    const ledger = await testEnv.DB.prepare(`
      select grant_ref, client_id from mcp_oauth_grants limit 1
    `).first<{ grant_ref: string; client_id: string }>();
    expect(ledger).not.toBeNull();
    if (!ledger) throw new Error("Missing OAuth ledger test grant");

    const providerGrantId = "provider-grant-rotated-1";
    const refreshToken = `owner-1:${providerGrantId}:refresh-token-before-rotation`;
    const providerGrantKey = `grant:owner-1:${providerGrantId}`;
    await testEnv.OAUTH_KV.put(providerGrantKey, JSON.stringify({
      id: providerGrantId,
      clientId: ledger.client_id,
      userId: "owner-1",
      scope: ["content:read", "content:write"],
      metadata: {
        grantRef: ledger.grant_ref,
        resource: MCP_RESOURCE
      },
      encryptedProps: "test-only",
      createdAt: Date.now(),
      refreshTokenId: await sha256Hex(refreshToken)
    }));
    let revokeGrantCalls = 0;
    const oauthApi = {
      async unwrapToken() {
        return null;
      },
      async revokeGrant(grantId: string, userId: string) {
        revokeGrantCalls += 1;
        expect(grantId).toBe(providerGrantId);
        expect(userId).toBe("owner-1");
        await testEnv.OAUTH_KV.delete(providerGrantKey);
      }
    } as any;
    const request = new Request(`${CANONICAL_ISSUER}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: refreshToken,
        token_type_hint: "refresh_token",
        client_id: ledger.client_id
      }).toString()
    });

    const response = await handleOAuthRevocationWithLedgerSync({
      request,
      env: testEnv as unknown as Env,
      oauthApi,
      // A concurrent rotation makes the provider treat the submitted token as
      // invalid, so RFC 7009 returns 200 without deleting the grant.
      providerFetch: async () => new Response("", { status: 200 })
    });
    expect(response?.status).toBe(200);
    expect(revokeGrantCalls).toBe(1);
    expect(await testEnv.OAUTH_KV.get(providerGrantKey)).toBeNull();
    const grant = await testEnv.DB.prepare(`
      select status, revoked_reason from mcp_oauth_grants where grant_ref = ?
    `).bind(ledger.grant_ref).first<{ status: string; revoked_reason: string }>();
    expect(grant).toEqual({
      status: "revoked",
      revoked_reason: "rfc7009-refresh-token"
    });
  });

  it("keeps the D1 revocation pending when explicit provider grant deletion fails", async () => {
    await authorizeTestClient(["content:read", "content:write"]);
    const ledger = await testEnv.DB.prepare(`
      select grant_ref, client_id from mcp_oauth_grants limit 1
    `).first<{ grant_ref: string; client_id: string }>();
    expect(ledger).not.toBeNull();
    if (!ledger) throw new Error("Missing OAuth ledger test grant");

    const providerGrantId = "provider-grant-delete-failure-1";
    const refreshToken = `owner-1:${providerGrantId}:refresh-token-delete-failure`;
    const providerGrantKey = `grant:owner-1:${providerGrantId}`;
    await testEnv.OAUTH_KV.put(providerGrantKey, JSON.stringify({
      id: providerGrantId,
      clientId: ledger.client_id,
      userId: "owner-1",
      scope: ["content:read", "content:write"],
      metadata: {
        grantRef: ledger.grant_ref,
        resource: MCP_RESOURCE
      },
      encryptedProps: "test-only",
      createdAt: Date.now(),
      refreshTokenId: await sha256Hex(refreshToken)
    }));
    let revokeGrantCalls = 0;
    const oauthApi = {
      async unwrapToken() {
        return null;
      },
      async revokeGrant() {
        revokeGrantCalls += 1;
        if (revokeGrantCalls === 1) {
          throw new Error("TEST_PROVIDER_GRANT_DELETE_FAILURE");
        }
        await testEnv.OAUTH_KV.delete(providerGrantKey);
      }
    } as any;
    const createRequest = () => new Request(`${CANONICAL_ISSUER}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: refreshToken,
          token_type_hint: "refresh_token",
          client_id: ledger.client_id
        }).toString()
      });
    const response = await handleOAuthRevocationWithLedgerSync({
      request: createRequest(),
      env: testEnv as unknown as Env,
      oauthApi,
      providerFetch: async () => new Response("", { status: 200 })
    });
    expect(response?.status).toBe(503);
    expect(await response?.json()).toMatchObject({
      code: "OAUTH_REVOCATION_LEDGER_SYNC_FAILED"
    });
    const grant = await testEnv.DB.prepare(`
      select status, revoked_reason from mcp_oauth_grants where grant_ref = ?
    `).bind(ledger.grant_ref).first<{ status: string; revoked_reason: string }>();
    expect(grant).toEqual({ status: "active", revoked_reason: "" });
    const audit = await testEnv.DB.prepare(`
      select result from mcp_oauth_audit_log
      where action = 'mcp-oauth-grant-revoked' and grant_ref = ?
    `).bind(ledger.grant_ref).first<{ result: string }>();
    expect(audit).toEqual({ result: "pending" });

    const recovered = await handleOAuthRevocationWithLedgerSync({
      request: createRequest(),
      env: testEnv as unknown as Env,
      oauthApi,
      providerFetch: async () => new Response("", { status: 200 })
    });
    expect(recovered?.status).toBe(200);
    expect(revokeGrantCalls).toBe(2);
    expect(await testEnv.OAUTH_KV.get(providerGrantKey)).toBeNull();
    const completedGrant = await testEnv.DB.prepare(`
      select status, revoked_reason from mcp_oauth_grants where grant_ref = ?
    `).bind(ledger.grant_ref).first<{ status: string; revoked_reason: string }>();
    expect(completedGrant).toEqual({
      status: "revoked",
      revoked_reason: "rfc7009-refresh-token"
    });
    const completedAudit = await testEnv.DB.prepare(`
      select result from mcp_oauth_audit_log
      where action = 'mcp-oauth-grant-revoked' and grant_ref = ?
    `).bind(ledger.grant_ref).first<{ result: string }>();
    expect(completedAudit).toEqual({ result: "success" });
  });

  it("recovers D1 revocation sync after the provider grant is already gone", async () => {
    await authorizeTestClient(["content:read", "content:write"]);
    const ledger = await testEnv.DB.prepare(`
      select grant_ref, client_id from mcp_oauth_grants limit 1
    `).first<{ grant_ref: string; client_id: string }>();
    expect(ledger).not.toBeNull();
    if (!ledger) throw new Error("Missing OAuth ledger test grant");

    const providerGrantId = "provider-grant-recovery-1";
    const refreshToken = `owner-1:${providerGrantId}:refresh-token-recovery`;
    const providerGrantKey = `grant:owner-1:${providerGrantId}`;
    await testEnv.OAUTH_KV.put(providerGrantKey, JSON.stringify({
      id: providerGrantId,
      clientId: ledger.client_id,
      userId: "owner-1",
      scope: ["content:read", "content:write"],
      metadata: {
        grantRef: ledger.grant_ref,
        resource: MCP_RESOURCE
      },
      encryptedProps: "test-only",
      createdAt: Date.now(),
      refreshTokenId: await sha256Hex(refreshToken)
    }));
    let revokeGrantCalls = 0;
    const oauthApi = {
      async unwrapToken() {
        return null;
      },
      async revokeGrant(grantId: string, userId: string) {
        revokeGrantCalls += 1;
        expect(grantId).toBe(providerGrantId);
        expect(userId).toBe("owner-1");
        await testEnv.OAUTH_KV.delete(providerGrantKey);
      }
    } as any;
    let batchCalls = 0;
    const flakyDb = {
      prepare: (sql: string) => testEnv.DB.prepare(sql),
      async batch(statements: D1PreparedStatement[]) {
        batchCalls += 1;
        if (batchCalls === 2) throw new Error("TEST_D1_SYNC_FAILURE");
        return testEnv.DB.batch(statements);
      }
    } as unknown as D1Database;
    const syncEnv = {
      DB: flakyDb,
      OAUTH_KV: testEnv.OAUTH_KV
    } as unknown as Env;
    const createRequest = () => new Request(`${CANONICAL_ISSUER}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: refreshToken,
        token_type_hint: "refresh_token",
        client_id: ledger.client_id
      }).toString()
    });
    const providerFetch = async () => {
      return new Response("", {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "https://client.example" }
      });
    };

    const first = await handleOAuthRevocationWithLedgerSync({
      request: createRequest(),
      env: syncEnv,
      oauthApi,
      providerFetch
    });
    expect(first?.status).toBe(503);
    expect(await first?.json()).toMatchObject({
      code: "OAUTH_REVOCATION_LEDGER_SYNC_FAILED"
    });
    expect(first?.headers.get("access-control-allow-origin")).toBe("https://client.example");
    expect(revokeGrantCalls).toBe(1);
    expect(await testEnv.OAUTH_KV.get(providerGrantKey)).toBeNull();

    const recovered = await handleOAuthRevocationWithLedgerSync({
      request: createRequest(),
      env: syncEnv,
      oauthApi,
      providerFetch
    });
    expect(recovered?.status).toBe(200);
    expect(revokeGrantCalls).toBe(2);
    const grant = await testEnv.DB.prepare(`
      select status, revoked_reason from mcp_oauth_grants where grant_ref = ?
    `).bind(ledger.grant_ref).first<{ status: string; revoked_reason: string }>();
    expect(grant).toEqual({
      status: "revoked",
      revoked_reason: "rfc7009-refresh-token"
    });
    const audit = await testEnv.DB.prepare(`
      select count(*) as count from mcp_oauth_audit_log
      where action = 'mcp-oauth-grant-revoked' and grant_ref = ?
    `).bind(ledger.grant_ref).first<{ count: number }>();
    expect(Number(audit?.count || 0)).toBe(1);
  });
});
