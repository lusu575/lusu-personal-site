/*
 * Hextris Agent MCP tests.
 * Copyright (C) 2026 LuSu
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PassThrough } from "node:stream";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createHextrisMcpServer, startHextrisMcpServer } from "../mcp-server.mjs";

const SESSION_ID = `hextris_${"a".repeat(32)}`;
const GPL_V3_TEXT_SHA256 = "4052be61f35ad6a156dcee919b8f99058b24b0417a152ecef746f702c7f34c5c";

function registeredTool(server, name) {
  const tool = server._registeredTools[name];
  assert.ok(tool, `missing MCP tool ${name}`);
  return tool;
}

function createMockStore() {
  const calls = [];
  return {
    calls,
    createSession(options) {
      calls.push(["create", options]);
      return { observation: { sessionId: SESSION_ID, revision: 0, phase: "active" } };
    },
    observeSession(sessionId) {
      calls.push(["observe", sessionId]);
      return { sessionId, revision: 0, phase: "active", score: 0 };
    },
    actionsForSession(sessionId) {
      calls.push(["actions", sessionId]);
      return { sessionId, actions: [{ action: { type: "place", lane: 2 } }] };
    },
    actSession(sessionId, request) {
      calls.push(["act", sessionId, request]);
      return { sessionId, revision: request.expectedRevision + 1, status: "applied", action: request.action };
    },
    closeSession(sessionId, options) {
      calls.push(["close", sessionId, options]);
      return { sessionId, closed: true };
    }
  };
}

test("standalone Hextris Agent carries the audited complete GPLv3 text", async () => {
  const [agentCopying, sourceCopying] = await Promise.all([
    readFile(new URL("../COPYING", import.meta.url)),
    readFile(new URL("../../source/COPYING", import.meta.url))
  ]);
  const canonicalLicense = (value) => value.toString("utf8").replace(/\r\n/g, "\n");
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  const agentText = canonicalLicense(agentCopying);
  const sourceText = canonicalLicense(sourceCopying);
  assert.match(agentText, /^GNU GENERAL PUBLIC LICENSE\n=+\n\nVersion 3, 29 June 2007/m);
  assert.equal(digest(agentText), GPL_V3_TEXT_SHA256);
  assert.equal(digest(agentText), digest(sourceText));
});

test("standalone Hextris MCP registers only the bounded isolated session tools", () => {
  const server = createHextrisMcpServer({ store: createMockStore() });
  assert.deepEqual(Object.keys(server._registeredTools), [
    "hextris_session_create",
    "hextris_session_observe",
    "hextris_session_actions",
    "hextris_session_act",
    "hextris_session_reset",
    "hextris_session_close"
  ]);

  assert.equal(registeredTool(server, "hextris_session_create").annotations.readOnlyHint, false);
  assert.equal(registeredTool(server, "hextris_session_create").annotations.idempotentHint, false);
  assert.equal(registeredTool(server, "hextris_session_observe").annotations.readOnlyHint, true);
  assert.equal(registeredTool(server, "hextris_session_actions").annotations.readOnlyHint, true);
  assert.equal(registeredTool(server, "hextris_session_act").annotations.idempotentHint, true);
  assert.equal(registeredTool(server, "hextris_session_act").annotations.destructiveHint, false);
  assert.equal(registeredTool(server, "hextris_session_reset").annotations.destructiveHint, true);
  assert.equal(registeredTool(server, "hextris_session_close").annotations.destructiveHint, true);
  assert.ok(Object.values(server._registeredTools).every((entry) => entry.annotations.openWorldHint === false));
  assert.match(registeredTool(server, "hextris_session_create").description, /does not attach to or control an open browser game/i);
});

test("standalone Hextris MCP schemas reject extra fields, browser commands, and unsafe values", () => {
  const server = createHextrisMcpServer({ store: createMockStore() });
  const createSchema = registeredTool(server, "hextris_session_create").inputSchema;
  const observeSchema = registeredTool(server, "hextris_session_observe").inputSchema;
  const actSchema = registeredTool(server, "hextris_session_act").inputSchema;
  const resetSchema = registeredTool(server, "hextris_session_reset").inputSchema;
  const closeSchema = registeredTool(server, "hextris_session_close").inputSchema;

  assert.equal(createSchema.safeParse({ seed: 0xffffffff }).success, true);
  assert.equal(createSchema.safeParse({ seed: -1 }).success, false);
  assert.equal(createSchema.safeParse({ seed: 1, browser: true }).success, false);
  assert.equal(observeSchema.safeParse({ sessionId: SESSION_ID }).success, true);
  assert.equal(observeSchema.safeParse({ sessionId: "game_hextris_bad" }).success, false);
  assert.equal(actSchema.safeParse({
    sessionId: SESSION_ID,
    expectedRevision: 0,
    clientActionId: "mcp_place_0001",
    action: { type: "place", lane: 5 }
  }).success, true);
  assert.equal(actSchema.safeParse({
    sessionId: SESSION_ID,
    expectedRevision: 0,
    clientActionId: "mcp_place_0001",
    action: { type: "place", lane: 6 }
  }).success, false);
  assert.equal(actSchema.safeParse({
    sessionId: SESSION_ID,
    expectedRevision: 0,
    clientActionId: "mcp_place_0001",
    action: { type: "keypress", key: "ArrowLeft" }
  }).success, false);
  assert.equal(actSchema.safeParse({
    sessionId: SESSION_ID,
    expectedRevision: 0,
    clientActionId: "mcp_place_0001",
    action: { type: "place", lane: 2, script: "alert(1)" }
  }).success, false);
  assert.equal(resetSchema.safeParse({
    sessionId: SESSION_ID,
    expectedRevision: 1,
    clientActionId: "mcp_reset_0001"
  }).success, false);
  assert.equal(closeSchema.safeParse({ sessionId: SESSION_ID, confirm: true }).success, true);
  assert.equal(closeSchema.safeParse({ sessionId: SESSION_ID, confirm: false }).success, false);
});

test("standalone Hextris MCP delegates lifecycle calls with CAS, dedupe, and confirmation intact", async () => {
  const store = createMockStore();
  const server = createHextrisMcpServer({ store });

  const created = await registeredTool(server, "hextris_session_create").handler({ seed: 123 });
  assert.equal(created.structuredContent.result.observation.sessionId, SESSION_ID);
  await registeredTool(server, "hextris_session_observe").handler({ sessionId: SESSION_ID });
  await registeredTool(server, "hextris_session_actions").handler({ sessionId: SESSION_ID });
  const acted = await registeredTool(server, "hextris_session_act").handler({
    sessionId: SESSION_ID,
    expectedRevision: 0,
    clientActionId: "mcp_place_0001",
    action: { type: "place", lane: 4 }
  });
  assert.equal(acted.structuredContent.result.revision, 1);
  const reset = await registeredTool(server, "hextris_session_reset").handler({
    sessionId: SESSION_ID,
    expectedRevision: 1,
    clientActionId: "mcp_reset_0001",
    confirm: true
  });
  assert.deepEqual(reset.structuredContent.result.action, { type: "reset", confirm: true });
  const closed = await registeredTool(server, "hextris_session_close").handler({
    sessionId: SESSION_ID,
    confirm: true
  });
  assert.equal(closed.structuredContent.result.closed, true);

  assert.deepEqual(store.calls, [
    ["create", { seed: 123 }],
    ["observe", SESSION_ID],
    ["actions", SESSION_ID],
    ["act", SESSION_ID, {
      expectedRevision: 0,
      clientActionId: "mcp_place_0001",
      action: { type: "place", lane: 4 }
    }],
    ["act", SESSION_ID, {
      expectedRevision: 1,
      clientActionId: "mcp_reset_0001",
      action: { type: "reset", confirm: true }
    }],
    ["close", SESSION_ID, { confirm: true }]
  ]);
});

test("standalone Hextris MCP preserves subsystem errors and redacts unexpected failures", async () => {
  const knownStore = createMockStore();
  knownStore.observeSession = () => {
    const error = new Error("The Hextris session was not found.");
    error.code = "HEXTRIS_SESSION_NOT_FOUND";
    throw error;
  };
  const known = await registeredTool(
    createHextrisMcpServer({ store: knownStore }),
    "hextris_session_observe"
  ).handler({ sessionId: SESSION_ID });
  assert.equal(known.isError, true);
  assert.deepEqual(known.structuredContent.result, {
    error: "The Hextris session was not found.",
    code: "HEXTRIS_SESSION_NOT_FOUND",
    status: 0
  });

  const unexpectedStore = createMockStore();
  unexpectedStore.observeSession = () => {
    throw new Error("C:\\private\\session.json contained secret-data");
  };
  const unexpected = await registeredTool(
    createHextrisMcpServer({ store: unexpectedStore }),
    "hextris_session_observe"
  ).handler({ sessionId: SESSION_ID });
  assert.equal(unexpected.isError, true);
  assert.equal(JSON.stringify(unexpected).includes("private"), false);
  assert.deepEqual(unexpected.structuredContent.result, {
    error: "The standalone Hextris MCP operation failed.",
    code: "HEXTRIS_MCP_OPERATION_FAILED",
    status: 0
  });
});

test("standalone Hextris MCP validates real tools/call requests over stdio", async (t) => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "lusu-hextris-mcp-wire-"));
  const input = new PassThrough();
  const output = new PassThrough();
  const messages = [];
  let handle;
  let buffered = "";
  t.after(async () => {
    await handle?.close().catch(() => {});
    await rm(rootDir, { recursive: true, force: true });
  });
  output.setEncoding("utf8");
  output.on("data", (chunk) => {
    buffered += chunk;
    while (buffered.includes("\n")) {
      const index = buffered.indexOf("\n");
      const line = buffered.slice(0, index).trim();
      buffered = buffered.slice(index + 1);
      if (line) messages.push(JSON.parse(line));
    }
  });

  handle = startHextrisMcpServer({
    sessionStoreOptions: { rootDir },
    transport: new StdioServerTransport(input, output)
  });
  input.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "hextris-test-client", version: "1.0.0" }
    }
  })}\n`);
  const initialized = await waitForMessage(messages, (message) => message.id === 1);
  assert.equal(initialized.result.serverInfo.name, "lusu-hextris-agent");
  assert.equal(initialized.result.serverInfo.version, "0.1.0");

  input.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} })}\n`);
  input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
  const listed = await waitForMessage(messages, (message) => message.id === 2);
  assert.deepEqual(listed.result.tools.map((entry) => entry.name), [
    "hextris_session_create",
    "hextris_session_observe",
    "hextris_session_actions",
    "hextris_session_act",
    "hextris_session_reset",
    "hextris_session_close"
  ]);
  assert.ok(listed.result.tools.every((entry) => entry.inputSchema.additionalProperties === false));

  input.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "hextris_session_create",
      arguments: { seed: 123 }
    }
  })}\n`);
  const created = await waitForMessage(messages, (message) => message.id === 3);
  assert.equal(created.jsonrpc, "2.0");
  assert.equal(created.result.isError, undefined);
  const createdResult = created.result.structuredContent.result;
  assert.match(createdResult.sessionId, /^hextris_[a-f0-9]{32}$/);
  assert.deepEqual(JSON.parse(created.result.content[0].text), createdResult);

  input.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "hextris_session_act",
      arguments: {
        sessionId: createdResult.sessionId,
        expectedRevision: "0",
        clientActionId: "mcp_wire_action_0001",
        action: { type: "place", lane: 1 }
      }
    }
  })}\n`);
  const invalid = await waitForMessage(messages, (message) => message.id === 4);
  assert.equal(invalid.jsonrpc, "2.0");
  assert.equal(invalid.result.isError, true);
  assert.equal(JSON.stringify(invalid).includes(rootDir), false);

  input.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "hextris_session_close",
      arguments: { sessionId: createdResult.sessionId, confirm: true }
    }
  })}\n`);
  const closed = await waitForMessage(messages, (message) => message.id === 5);
  assert.equal(closed.jsonrpc, "2.0");
  assert.equal(closed.result.isError, undefined);
  assert.equal(closed.result.structuredContent.result.closed, true);

  await handle.close();
  handle = null;
  assert.deepEqual(await readdir(rootDir), []);
  await rm(rootDir, { recursive: true, force: true });
  await assert.rejects(stat(rootDir), (error) => error?.code === "ENOENT");
});

async function waitForMessage(messages, predicate) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const match = messages.find(predicate);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail("Timed out waiting for Hextris MCP response.");
}
