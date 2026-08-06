import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as Y from "yjs";
import { createLocalMcpServer, startLocalMcpServer } from "../mcp/local/server.mjs";

function tool(server, name) {
  const registered = server._registeredTools[name];
  assert.ok(registered, `missing MCP tool ${name}`);
  return registered;
}

test("local MCP registers the first capability surface with safe annotations", async () => {
  const server = await createLocalMcpServer({
    credential: null,
    allowRoots: [process.cwd()],
    client: { capabilities: () => [] }
  });
  const names = Object.keys(server._registeredTools);
  assert.deepEqual(names, [
    "capabilities_list", "content_list", "content_search", "content_get", "daily_news_get", "videos_list",
    "transfer_join", "transfer_list", "transfer_send_text", "transfer_upload",
    "transfer_download", "transfer_delete", "whiteboard_join", "whiteboard_scene",
    "whiteboard_draw", "whiteboard_export", "game_create", "game_observe",
    "game_actions", "game_act", "game_reset", "game_close"
  ]);
  assert.equal(tool(server, "content_get").annotations.readOnlyHint, true);
  assert.equal(tool(server, "transfer_delete").annotations.destructiveHint, true);
  assert.equal(tool(server, "transfer_upload").annotations.idempotentHint, false);
  assert.equal(tool(server, "transfer_join").annotations.idempotentHint, false);
  assert.equal(tool(server, "transfer_join").inputSchema.safeParse({ password: "forbidden" }).success, false);
  assert.equal(tool(server, "transfer_join").inputSchema.safeParse({ secretRef: "env:LUSU_ROOM_SECRET" }).success, true);
  assert.equal(tool(server, "whiteboard_scene").annotations.readOnlyHint, true);
  assert.equal(tool(server, "whiteboard_draw").annotations.idempotentHint, true);
  assert.equal(tool(server, "whiteboard_join").inputSchema.safeParse({ roomType: "private", password: "forbidden" }).success, false);
  assert.equal(tool(server, "whiteboard_join").inputSchema.safeParse({
    roomType: "private",
    secretRef: "env:LUSU_WHITEBOARD_SECRET"
  }).success, true);
  assert.equal(tool(server, "game_observe").annotations.readOnlyHint, true);
  assert.equal(tool(server, "game_actions").annotations.readOnlyHint, true);
  assert.equal(tool(server, "game_act").annotations.destructiveHint, false);
  assert.equal(tool(server, "game_reset").annotations.destructiveHint, true);
  assert.equal(tool(server, "game_close").inputSchema.safeParse({
    sessionId: "game_2048_1234567890abcdef12345678"
  }).success, false);
});

test("local MCP joins through secretRef and never returns passphrase or roomKey", async (t) => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-mcp-room-"));
  t.after(() => fs.rm(configDir, { recursive: true, force: true }));
  let joinedRoomKey = "";
  const client = {
    capabilities: () => [],
    async joinTransferRoom(secret) {
      joinedRoomKey = secret.roomKey;
      return { room: { id: "room-record", status: "open" } };
    }
  };
  const server = await createLocalMcpServer({
    client,
    credential: null,
    allowRoots: [configDir],
    env: { LUSU_CONFIG_DIR: configDir, LUSU_ROOM_SECRET: "private-room-passphrase" }
  });
  const result = await tool(server, "transfer_join").handler({ secretRef: "env:LUSU_ROOM_SECRET" });
  const serialized = JSON.stringify(result);
  assert.equal(result.isError, undefined);
  assert.match(result.structuredContent.result.roomHandle, /^room_/);
  assert.equal(serialized.includes("private-room-passphrase"), false);
  assert.equal(serialized.includes(joinedRoomKey), false);
  const stateText = await fs.readFile(path.join(configDir, "rooms.json"), "utf8");
  assert.equal(stateText.includes("private-room-passphrase"), false);
  assert.equal(stateText.includes("textKey"), false);
  assert.equal(stateText.includes("env:LUSU_ROOM_SECRET"), true);
});

test("local MCP enforces allow-root and no-clobber for transfer files", async (t) => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-mcp-files-"));
  const allowed = path.join(parent, "allowed");
  const outside = path.join(parent, "outside.txt");
  await fs.mkdir(allowed);
  await fs.writeFile(path.join(allowed, "inside.txt"), "inside");
  await fs.writeFile(outside, "outside");
  t.after(() => fs.rm(parent, { recursive: true, force: true }));

  const configDir = path.join(allowed, ".state");
  const env = { LUSU_CONFIG_DIR: configDir, LUSU_ROOM_SECRET: "private-room-passphrase" };
  const client = {
    capabilities: () => [],
    async joinTransferRoom() { return { room: { id: "room-record", status: "open" } }; },
    async uploadTransferFile(_secret, file) {
      let body = "";
      for await (const chunk of file.body) body += chunk.toString("utf8");
      return { item: { id: "item-1234567890123456", type: "file", filename: file.filename, body } };
    },
    async downloadTransferFile(_secret, _itemId, sink) {
      await sink.write(new Uint8Array([4, 5, 6]));
      await sink.close();
      return { bytesWritten: 3, contentLength: 3 };
    }
  };
  const server = await createLocalMcpServer({ client, credential: null, allowRoots: [allowed], env });
  const joined = await tool(server, "transfer_join").handler({ secretRef: "env:LUSU_ROOM_SECRET" });
  const roomHandle = joined.structuredContent.result.roomHandle;

  const uploaded = await tool(server, "transfer_upload").handler({ roomHandle, fileRef: "inside.txt" });
  assert.equal(uploaded.isError, undefined);
  assert.equal(uploaded.structuredContent.result.item.filename, "inside.txt");

  const rejected = await tool(server, "transfer_upload").handler({ roomHandle, fileRef: outside });
  assert.equal(rejected.isError, true);
  assert.equal(rejected.structuredContent.result.code, "FILE_REF_OUTSIDE_ALLOW_ROOT");

  const downloaded = await tool(server, "transfer_download").handler({
    roomHandle,
    itemId: "item-1234567890123456",
    fileRef: "download.bin"
  });
  assert.equal(downloaded.isError, undefined);
  assert.deepEqual([...await fs.readFile(path.join(allowed, "download.bin"))], [4, 5, 6]);

  const noClobber = await tool(server, "transfer_download").handler({
    roomHandle,
    itemId: "item-1234567890123456",
    fileRef: "download.bin"
  });
  assert.equal(noClobber.isError, true);
  assert.equal(noClobber.structuredContent.result.code, "FILE_ALREADY_EXISTS");
});

test("local MCP joins, reads, draws, and exports a whiteboard without exposing credentials", async (t) => {
  const allowed = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-mcp-whiteboard-"));
  t.after(() => fs.rm(allowed, { recursive: true, force: true }));
  const accessToken = `wbt1.${"b".repeat(80)}`;
  const document = new Y.Doc();
  let documentVersion = 0;
  let joinedPassword = "";
  const client = {
    capabilities: () => [],
    async joinWhiteboardRoom(options) {
      joinedPassword = options.password;
      return {
        room: { type: options.type },
        accessToken,
        accessExpiresAt: "2030-01-01T00:00:00.000Z"
      };
    },
    async getWhiteboardScene(roomToken) {
      assert.equal(roomToken, accessToken);
      return {
        updateBytes: Y.encodeStateAsUpdate(document),
        documentVersion,
        locked: false
      };
    },
    async applyWhiteboardUpdate(roomToken, update, options) {
      assert.equal(roomToken, accessToken);
      assert.equal(options.operationId, "mcp_draw_0001");
      Y.applyUpdate(document, update);
      documentVersion += 1;
      return { ok: true, replayed: false, documentVersion };
    }
  };
  const server = await createLocalMcpServer({
    client,
    credential: null,
    allowRoots: [allowed],
    env: {
      LUSU_CONFIG_DIR: path.join(allowed, ".state"),
      LUSU_WHITEBOARD_SECRET: "private-whiteboard-password"
    }
  });
  const joined = await tool(server, "whiteboard_join").handler({
    roomType: "private",
    secretRef: "env:LUSU_WHITEBOARD_SECRET"
  });
  assert.equal(joinedPassword, "private-whiteboard-password");
  const serializedJoin = JSON.stringify(joined);
  assert.equal(serializedJoin.includes(joinedPassword), false);
  assert.equal(serializedJoin.includes(accessToken), false);
  const boardHandle = joined.structuredContent.result.boardHandle;

  const drawn = await tool(server, "whiteboard_draw").handler({
    boardHandle,
    operationId: "mcp_draw_0001",
    elements: [
      { type: "rectangle", x: 10, y: 10, width: 120, height: 80 },
      { type: "text", x: 25, y: 35, text: "MCP" },
      { type: "arrow", points: [{ x: 130, y: 50 }, { x: 220, y: 50 }] }
    ]
  });
  assert.equal(drawn.isError, undefined);
  assert.equal(drawn.structuredContent.result.scene.elementCount, 3);

  const scene = await tool(server, "whiteboard_scene").handler({ boardHandle });
  assert.equal(scene.structuredContent.result.elementCount, 3);
  const exported = await tool(server, "whiteboard_export").handler({
    boardHandle,
    fileRef: "board.svg",
    format: "svg"
  });
  assert.equal(exported.isError, undefined);
  assert.match(await fs.readFile(path.join(allowed, "board.svg"), "utf8"), /<svg/);
  const noClobber = await tool(server, "whiteboard_export").handler({
    boardHandle,
    fileRef: "board.svg",
    format: "svg"
  });
  assert.equal(noClobber.isError, true);
  assert.equal(noClobber.structuredContent.result.code, "FILE_ALREADY_EXISTS");
});

test("local MCP runs a bounded isolated 2048 session with CAS and explicit destructive tools", async (t) => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-mcp-game-"));
  t.after(() => fs.rm(configDir, { recursive: true, force: true }));
  const server = await createLocalMcpServer({
    client: { capabilities: () => [] },
    credential: null,
    allowRoots: [configDir],
    env: { LUSU_CONFIG_DIR: configDir }
  });
  const created = await tool(server, "game_create").handler({ gameId: "2048" });
  assert.equal(created.isError, undefined);
  const sessionId = created.structuredContent.result.observation.sessionId;
  assert.equal(created.structuredContent.result.observation.gameId, "2048");

  const listed = await tool(server, "game_actions").handler({ sessionId });
  const move = listed.structuredContent.result.actions.find((entry) => entry.action.type === "move").action;
  const acted = await tool(server, "game_act").handler({
    sessionId,
    expectedRevision: 0,
    clientActionId: "mcp_move_0001",
    action: move
  });
  assert.equal(acted.structuredContent.result.status, "applied");
  assert.equal(acted.structuredContent.result.revision, 1);

  const replayed = await tool(server, "game_act").handler({
    sessionId,
    expectedRevision: 0,
    clientActionId: "mcp_move_0001",
    action: move
  });
  assert.equal(replayed.structuredContent.result.deduplicated, true);

  const reset = await tool(server, "game_reset").handler({
    sessionId,
    expectedRevision: 1,
    clientActionId: "mcp_reset_001",
    confirm: true
  });
  assert.equal(reset.structuredContent.result.reason, "reset");
  const closed = await tool(server, "game_close").handler({ sessionId, confirm: true });
  assert.equal(closed.structuredContent.result.closed, true);
});

test("local MCP serves a clean stdio initialize and tools/list exchange", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const messages = [];
  let buffered = "";
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
  const handle = startLocalMcpServer({
    credential: null,
    allowRoots: [process.cwd()],
    client: { capabilities: () => [] },
    transport: new StdioServerTransport(input, output)
  });
  input.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" }
    }
  })}\n`);
  const initialized = await waitForMessage(messages, (message) => message.id === 1);
  assert.equal(initialized.result.serverInfo.name, "lusu-personal-site-local");
  input.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} })}\n`);
  input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
  const listed = await waitForMessage(messages, (message) => message.id === 2);
  assert.ok(listed.result.tools.some((entry) => entry.name === "transfer_upload"));
  assert.ok(listed.result.tools.some((entry) => entry.name === "whiteboard_draw"));
  assert.ok(listed.result.tools.some((entry) => entry.name === "game_act"));
  assert.ok(messages.every((message) => message.jsonrpc === "2.0"));
  await handle.close();
});

async function waitForMessage(messages, predicate) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const match = messages.find(predicate);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail("Timed out waiting for MCP stdio response.");
}
