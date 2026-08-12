import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { handleMinimaxH3Api } from "../functions/api/minimax-h3-service.mjs";

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

  async all() {
    return { results: this.database.sqlite.prepare(this.sql).all(...this.values) };
  }

  async run() {
    const result = this.database.sqlite.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes || 0) } };
  }
}

class D1Database {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec("pragma foreign_keys = on; create table users (id text primary key, role text not null default 'user');");
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

test("H3 download ticket stores only a hash and is consumed once by the admin Runner", async () => {
  const DB = new D1Database();
  const env = {
    DB,
    MINIMAX_H3_CONTROL_ENABLED: "true",
    MINIMAX_H3_TRANSFER_ENABLED: "true",
    MINIMAX_H3_BRIDGE_ORIGIN: "https://h3-bridge.lusu575.com"
  };
  const now = new Date().toISOString();
  const sha256 = createHash("sha256").update("verified-result").digest("hex");
  DB.sqlite.prepare("insert into users (id, role) values (?, 'admin')").run("admin-1");

  const adminSession = { user: { id: "admin-1", role: "admin" } };
  const ensureRequest = new Request("https://example.test/api/admin/minimax-h3/runners");
  await handleMinimaxH3Api({ request: ensureRequest, env, parts: ["admin", "minimax-h3", "runners"], adminSession });
  DB.sqlite.prepare(`
    insert into minimax_h3_runners (
      runner_id, owner_user_id, installation_id_hash, label, status, protocol_version,
      agent_version, controller_version, capabilities_json, ready_state, busy_job_id,
      current_token_id, last_seen_at, last_persisted_heartbeat_at, revision, created_at, updated_at
    ) values ('runner_12345678', 'admin-1', 'installation-hash', 'Test Runner', 'active', '1.0', '0.2.0', '2026-08-04_v4', '{}', 'ready', '', '', ?, ?, 0, ?, ?)
  `).run(now, now, now, now);
  DB.sqlite.prepare(`
    insert into minimax_h3_jobs (
      job_id, owner_user_id, runner_id, operation_id, payload_sha256, protocol_version,
      template_version, spec_json, prompt_sha256, state, revision, attempt, result_available,
      result_name, result_mime, result_bytes, result_sha256, retain_until, created_at, updated_at
    ) values ('job_12345678', 'admin-1', 'runner_12345678', 'op_existing', 'payload', '1.0',
      'h3-t2v-mvp-1', '{}', 'prompt', 'ready', 7, 1, 1, 'result.mp4', 'video/mp4', 16, ?, ?, ?, ?)
  `).run(sha256, new Date(Date.now() + 60_000).toISOString(), now, now);

  const ticketResponse = await handleMinimaxH3Api({
    request: new Request("https://example.test/api/admin/minimax-h3/jobs/job_12345678/download-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operationId: "op_ticket_123456" })
    }),
    env,
    parts: ["admin", "minimax-h3", "jobs", "job_12345678", "download-ticket"],
    adminSession
  });
  assert.equal(ticketResponse.status, 201);
  const ticket = await ticketResponse.json();
  assert.match(ticket.secret, /^h3t_[0-9a-f]{64}$/u);
  assert.equal(ticket.bridgeOrigin, "https://h3-bridge.lusu575.com");
  const stored = DB.sqlite.prepare("select secret_sha256, status from minimax_h3_transfer_tickets where ticket_id = ?").get(ticket.ticketId);
  assert.equal(stored.status, "issued");
  assert.equal(typeof stored.secret_sha256, "string");
  assert.equal(stored.secret_sha256, createHash("sha256").update(ticket.secret).digest("hex"));
  assert.notEqual(stored.secret_sha256, ticket.secret);
  assert.doesNotMatch(DB.sqlite.prepare("select response_json from minimax_h3_operation_receipts where operation_id = ?").get("op_ticket_123456").response_json, new RegExp(ticket.secret, "u"));

  const principal = {
    scopes: ["minimax-h3:execute"],
    tokenId: "agent-token-1",
    user: { id: "admin-1", role: "user" }
  };
  const exchangeRequest = () => new Request("https://example.test/api/agent/minimax-h3/transfers/introspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticketId: ticket.ticketId, secret: ticket.secret, runnerId: "runner_12345678" })
  });
  const consumedResponse = await handleMinimaxH3Api({
    request: exchangeRequest(),
    env,
    parts: ["agent", "minimax-h3", "transfers", "introspect"],
    agentPrincipal: principal
  });
  assert.equal(consumedResponse.status, 200);
  assert.equal((await consumedResponse.json()).jobId, "job_12345678");
  assert.equal(DB.sqlite.prepare("select status from minimax_h3_transfer_tickets where ticket_id = ?").get(ticket.ticketId).status, "consumed");

  await assert.rejects(
    () => handleMinimaxH3Api({
      request: exchangeRequest(),
      env,
      parts: ["agent", "minimax-h3", "transfers", "introspect"],
      agentPrincipal: principal
    }),
    (error) => error?.code === "H3_TICKET_UNAVAILABLE"
  );
});
