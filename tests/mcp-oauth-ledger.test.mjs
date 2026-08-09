import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  MCP_OWNER_RESOURCE,
  McpOAuthLedgerError,
  activateMcpOAuthGrant,
  assertActiveMcpOAuthGrant,
  completeMcpOAuthRevocationIntent,
  createPendingMcpOAuthGrant,
  createMcpOAuthRevocationIntent,
  ensureMcpOAuthLedgerSchema,
  findMcpOAuthRevocationIntent,
  mcpOAuthAuditIpHash,
  recordMcpOAuthAudit,
  revokeMcpOAuthGrant
} from "../functions/api/mcp-oauth-ledger.mjs";

class D1Statement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new D1Statement(this.database, this.sql, values);
  }

  async first() {
    return this.database.sqlite.prepare(this.sql).get(...this.values) || null;
  }

  async run() {
    const result = this.database.sqlite.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes || 0) } };
  }
}

class D1Database {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec("pragma foreign_keys = on");
    this.sqlite.exec(`
      create table users (
        id text primary key,
        email text not null unique,
        password_hash text not null,
        role text not null default 'user',
        created_at text not null,
        updated_at text not null
      )
    `);
  }

  prepare(sql) {
    return new D1Statement(this, sql);
  }

  async batch(statements) {
    this.sqlite.exec("begin immediate");
    try {
      const results = [];
      for (const statement of statements) {
        const result = this.sqlite.prepare(statement.sql).run(...statement.values);
        results.push({ success: true, meta: { changes: Number(result.changes || 0) } });
      }
      this.sqlite.exec("commit");
      return results;
    } catch (error) {
      this.sqlite.exec("rollback");
      throw error;
    }
  }
}

const now = "2026-08-07T09:00:00.000Z";
const grantRef = "grant_test_1234567890";

function createFixture(role = "admin") {
  const DB = new D1Database();
  DB.sqlite.prepare(`
    insert into users (id, email, password_hash, role, created_at, updated_at)
    values (?, ?, 'hash', ?, ?, ?)
  `).run("owner-1", "owner@example.test", role, now, now);
  return { DB };
}

function principal(overrides = {}) {
  return {
    authType: "oauth",
    userId: "owner-1",
    clientId: "https://client.example.test/oauth.json",
    grantRef,
    resource: MCP_OWNER_RESOURCE,
    effectiveScopes: ["content:read", "content:write", "content:delete"],
    ...overrides
  };
}

async function createGrant(env) {
  return createPendingMcpOAuthGrant({
    env,
    grantRef,
    userId: "owner-1",
    clientId: "https://client.example.test/oauth.json",
    clientName: "Test client",
    resource: MCP_OWNER_RESOURCE,
    authorizedScopes: ["content:delete", "content:read", "content:write"],
    createdAt: now
  });
}

test("OAuth grant remains unusable until activated and enforces token scopes", async () => {
  const env = createFixture();
  const pending = await createGrant(env);
  assert.equal(pending.status, "pending");
  await assert.rejects(
    assertActiveMcpOAuthGrant({ env, principal: principal(), requiredScopes: ["content:write"], now }),
    (error) => error instanceof McpOAuthLedgerError && error.code === "MCP_OAUTH_GRANT_INACTIVE"
  );

  await activateMcpOAuthGrant({ env, grantRef, activatedAt: now });
  await assert.rejects(
    assertActiveMcpOAuthGrant({
      env,
      principal: principal({ effectiveScopes: ["content:read"] }),
      requiredScopes: ["content:write"],
      now
    }),
    (error) => error instanceof McpOAuthLedgerError
      && error.status === 403
      && error.code === "MCP_OAUTH_SCOPE_REQUIRED"
  );

  const active = await assertActiveMcpOAuthGrant({
    env,
    principal: principal(),
    requiredScopes: ["content:read", "content:write"],
    requireAdmin: true,
    now
  });
  assert.deepEqual(active.effectiveScopes, ["content:delete", "content:read", "content:write"]);
  assert.equal(active.lastUsedAt, "");
  assert.equal(
    env.DB.sqlite.prepare("select last_used_at from mcp_oauth_grants where grant_ref = ?").get(grantRef).last_used_at,
    now
  );
});

test("admin downgrade and grant revocation take effect on the next call", async () => {
  const env = createFixture();
  await createGrant(env);
  await activateMcpOAuthGrant({ env, grantRef, activatedAt: now });

  env.DB.sqlite.prepare("update users set role = 'user' where id = ?").run("owner-1");
  await assert.rejects(
    assertActiveMcpOAuthGrant({
      env,
      principal: principal(),
      requiredScopes: ["content:write"],
      requireAdmin: true,
      now
    }),
    (error) => error instanceof McpOAuthLedgerError && error.code === "MCP_OAUTH_ADMIN_REQUIRED"
  );

  env.DB.sqlite.prepare("update users set role = 'admin' where id = ?").run("owner-1");
  const revoked = await revokeMcpOAuthGrant({ env, grantRef, reason: "owner-request", revokedAt: now });
  assert.equal(revoked.revoked, true);
  await assert.rejects(
    assertActiveMcpOAuthGrant({ env, principal: principal(), requiredScopes: ["content:read"], now }),
    (error) => error instanceof McpOAuthLedgerError && error.code === "MCP_OAUTH_GRANT_INACTIVE"
  );
});

test("RFC 7009 grant revocation updates the ledger and records one atomic audit", async () => {
  const env = createFixture();
  await createGrant(env);
  await activateMcpOAuthGrant({ env, grantRef, activatedAt: now });
  const tokenRefHash = "a".repeat(64);
  const intent = await createMcpOAuthRevocationIntent({
    env,
    grantRef,
    userId: "owner-1",
    clientId: "https://client.example.test/oauth.json",
    providerGrantId: "provider-grant-test-1",
    tokenRefHash,
    createdAt: now
  });
  assert.deepEqual(intent, {
    eventId: intent.eventId,
    grantRef,
    result: "pending",
    alreadyRevoked: false
  });
  const found = await findMcpOAuthRevocationIntent({
    env,
    userId: "owner-1",
    clientId: "https://client.example.test/oauth.json",
    providerGrantId: "provider-grant-test-1",
    tokenRefHash
  });
  assert.deepEqual(found, {
    eventId: intent.eventId,
    grantRef,
    result: "pending"
  });
  await assert.rejects(
    createMcpOAuthRevocationIntent({
      env,
      grantRef,
      userId: "owner-1",
      clientId: "https://client.example.test/oauth.json",
      providerGrantId: "provider-grant-test-1",
      tokenRefHash: "b".repeat(64),
      createdAt: now
    }),
    (error) => error instanceof McpOAuthLedgerError
      && error.code === "MCP_OAUTH_REVOCATION_INTENT_CONFLICT"
  );

  const first = await completeMcpOAuthRevocationIntent({
    env,
    grantRef,
    eventId: intent.eventId,
    completedAt: now
  });
  assert.deepEqual(first, { revoked: true, completed: true });
  const replay = await completeMcpOAuthRevocationIntent({
    env,
    grantRef,
    eventId: intent.eventId,
    completedAt: now
  });
  assert.deepEqual(replay, { revoked: false, completed: true });

  const grant = env.DB.sqlite.prepare(`
    select status, revoked_reason from mcp_oauth_grants where grant_ref = ?
  `).get(grantRef);
  assert.equal(grant.status, "revoked");
  assert.equal(grant.revoked_reason, "rfc7009-refresh-token");
  const audits = env.DB.sqlite.prepare(`
    select action, result, token_ref_hash from mcp_oauth_audit_log where event_id = ?
  `).all(intent.eventId);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "mcp-oauth-grant-revoked");
  assert.equal(audits[0].result, "success");
  assert.equal(audits[0].token_ref_hash, tokenRefHash);
});

test("activating a replacement grant revokes the previous grant for the same client", async () => {
  const env = createFixture();
  await createGrant(env);
  await activateMcpOAuthGrant({ env, grantRef, activatedAt: now });

  const replacementRef = "grant_replacement_123456";
  await createPendingMcpOAuthGrant({
    env,
    grantRef: replacementRef,
    userId: "owner-1",
    clientId: "https://client.example.test/oauth.json",
    clientName: "Test client",
    resource: MCP_OWNER_RESOURCE,
    authorizedScopes: ["content:read", "content:write"],
    createdAt: "2026-08-07T09:01:00.000Z"
  });
  await activateMcpOAuthGrant({
    env,
    grantRef: replacementRef,
    activatedAt: "2026-08-07T09:01:00.000Z"
  });

  const previous = env.DB.sqlite.prepare(`
    select status, revoked_reason from mcp_oauth_grants where grant_ref = ?
  `).get(grantRef);
  assert.equal(previous.status, "revoked");
  assert.equal(previous.revoked_reason, "superseded");
});

test("OAuth audit stores hashes and bounded metadata, never raw references", async () => {
  const env = createFixture();
  await ensureMcpOAuthLedgerSchema(env);
  const request = new Request("https://lusu575.com/mcp", {
    headers: { "CF-Connecting-IP": "203.0.113.10" }
  });
  const ipHash = await mcpOAuthAuditIpHash(request, {
    ...env,
    ANALYTICS_IP_HASH_SALT: "test-only-secret-that-is-at-least-32-bytes"
  });
  assert.match(ipHash, /^[a-f0-9]{64}$/);

  await recordMcpOAuthAudit({
    env,
    principal: principal(),
    eventId: "audit_event_1234567890",
    capabilityId: "content.articles.publish",
    toolName: "article_publish",
    operationId: "publish_1234567890",
    targetType: "article",
    targetId: "private-article-id",
    requestedScopes: ["content:write"],
    action: "article-publish",
    result: "success",
    tokenRefHash: "raw-access-token-must-not-be-stored",
    ipHash,
    createdAt: now
  });

  const row = env.DB.sqlite.prepare("select * from mcp_oauth_audit_log").get();
  assert.equal(row.token_ref_hash, "");
  assert.match(row.target_id_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(row.target_id_hash, "private-article-id");
  assert.equal(row.ip_hash, ipHash);
  assert.deepEqual(JSON.parse(row.requested_scopes), ["content:write"]);
  assert.deepEqual(JSON.parse(row.effective_scopes), ["content:delete", "content:read", "content:write"]);
  assert.equal(JSON.stringify(row).includes("raw-access-token"), false);
});
