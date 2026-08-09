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

async function authorizeTestClient(
  scopes: string[],
  forcedGrantRef = ""
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

  it("keeps protected-resource discovery at the baseline read scope", async () => {
    const response = await SELF.fetch(
      `${CANONICAL_ISSUER}/.well-known/oauth-protected-resource/mcp`
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      resource: MCP_RESOURCE,
      authorization_servers: [CANONICAL_ISSUER],
      scopes_supported: ["content:read"],
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
            scope: ["content:read", "content:write"],
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
      "article_manage_list",
      "article_manage_get",
      "article_publish",
      "article_update",
      "article_delete"
    ]);
    const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
    expect(toolsByName.get("content_list")?._meta?.securitySchemes).toEqual([
      { type: "oauth2", scopes: ["content:read"] }
    ]);
    expect(toolsByName.get("article_publish")?._meta?.securitySchemes).toEqual([
      { type: "oauth2", scopes: ["content:write"] }
    ]);
    expect(toolsByName.get("article_delete")?._meta?.securitySchemes).toEqual([
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
});
