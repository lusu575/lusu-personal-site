import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as Y from "yjs";
import { createLocalMcpServer, startLocalMcpServer } from "../mcp/local/server.mjs";
import { JapaneseSubtextCapabilityError } from "../lib/capabilities/japanese-subtext-adapter.mjs";

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
    "video_get", "tools_list", "tools_get", "games_list", "game_get",
    "japanese_subtext_levels", "japanese_subtext_stages", "japanese_subtext_stage_get",
    "japanese_subtext_progress_get", "japanese_subtext_attempt_submit",
    "transfer_join", "transfer_list", "transfer_send_text", "transfer_upload",
    "transfer_download", "transfer_delete", "whiteboard_join", "whiteboard_scene",
    "whiteboard_asset_upload", "whiteboard_asset_download", "whiteboard_draw",
    "whiteboard_export", "game_create", "game_observe",
    "game_actions", "game_act", "game_reset", "game_close"
  ]);
  assert.equal(tool(server, "content_get").annotations.readOnlyHint, true);
  assert.equal(tool(server, "video_get").annotations.readOnlyHint, true);
  assert.equal(tool(server, "tools_list").annotations.openWorldHint, false);
  assert.equal(tool(server, "games_list").annotations.openWorldHint, true);
  assert.equal(tool(server, "japanese_subtext_stage_get").annotations.readOnlyHint, true);
  assert.equal(tool(server, "japanese_subtext_progress_get").annotations.readOnlyHint, true);
  assert.equal(tool(server, "japanese_subtext_attempt_submit").annotations.idempotentHint, true);
  assert.equal(tool(server, "japanese_subtext_attempt_submit").annotations.destructiveHint, false);
  assert.equal(tool(server, "transfer_delete").annotations.destructiveHint, true);
  assert.equal(tool(server, "transfer_upload").annotations.idempotentHint, false);
  assert.equal(tool(server, "transfer_join").annotations.idempotentHint, false);
  assert.equal(tool(server, "transfer_join").inputSchema.safeParse({ password: "forbidden" }).success, false);
  assert.equal(tool(server, "transfer_join").inputSchema.safeParse({ secretRef: "env:LUSU_ROOM_SECRET" }).success, true);
  assert.equal(tool(server, "whiteboard_scene").annotations.readOnlyHint, true);
  assert.equal(tool(server, "whiteboard_asset_upload").annotations.idempotentHint, true);
  assert.equal(tool(server, "whiteboard_asset_download").annotations.readOnlyHint, false);
  assert.equal(tool(server, "whiteboard_draw").annotations.idempotentHint, true);
  assert.equal(tool(server, "whiteboard_draw").inputSchema.safeParse({
    boardHandle: "board_123456789012",
    operationId: "draw_image_0001",
    elements: [{
      type: "image",
      assetId: "0123456789abcdef0123456789abcdef",
      x: 0,
      y: 0,
      dataURL: "data:image/png;base64,AAAA"
    }]
  }).success, false);
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
  assert.equal(tool(server, "video_get").inputSchema.safeParse({ videoId: "video/../secret" }).success, false);
  assert.equal(tool(server, "tools_get").inputSchema.safeParse({ toolId: "whiteboard", lang: "en", extra: true }).success, false);
  assert.equal(tool(server, "games_list").inputSchema.safeParse({ lang: "de" }).success, false);
  assert.equal(tool(server, "japanese_subtext_stages").inputSchema.safeParse({
    level: 1,
    query: "x".repeat(201),
    limit: 50,
    lang: "zh"
  }).success, false);
  assert.equal(tool(server, "japanese_subtext_stages").inputSchema.safeParse({
    level: 1,
    query: "   ",
    limit: 50,
    lang: "zh"
  }).success, false);
  assert.equal(tool(server, "japanese_subtext_stage_get").inputSchema.safeParse({
    stageId: "L1-051",
    lang: "ja"
  }).success, false);
  assert.equal(tool(server, "japanese_subtext_progress_get").inputSchema.safeParse({
    stageId: "L1-001",
    days: 91
  }).success, false);
  assert.equal(tool(server, "japanese_subtext_attempt_submit").inputSchema.safeParse({
    stageId: "L1-001",
    stageRevision: 3,
    contentHash: "a".repeat(64),
    answers: [{ questionId: "q1", optionIds: ["a"] }],
    expectedRevision: 1,
    operationId: "mcp_attempt_0001",
    progress: {}
  }).success, false);
});

test("local MCP sends stored credentials only to their matching normalized origin", async () => {
  const requests = [];
  const invoke = async ({ baseUrl, credential, env = {}, accessToken }) => {
    const options = {
      baseUrl,
      credential,
      env,
      allowRoots: [process.cwd()],
      fetch: async (url, request) => {
        requests.push({
          origin: url.origin,
          authorization: request.headers.get("Authorization") || ""
        });
        return new Response(JSON.stringify({ articles: [], lang: "zh" }), {
          headers: { "Content-Type": "application/json" }
        });
      }
    };
    if (accessToken !== undefined) options.accessToken = accessToken;
    const server = await createLocalMcpServer(options);
    return tool(server, "content_list").handler({ lang: "zh", limit: 1 });
  };
  const credential = {
    accessToken: "prod-mcp-credential",
    baseUrl: "https://prod.example/account"
  };

  await invoke({ baseUrl: "https://preview.example/path", credential });
  await invoke({ baseUrl: "https://PROD.example/other", credential });
  await invoke({
    baseUrl: "https://preview.example",
    credential,
    env: { LUSU_ACCESS_TOKEN: "preview-mcp-explicit" }
  });
  await invoke({
    baseUrl: "https://preview.example",
    credential: { accessToken: "invalid-url-token", baseUrl: "not a valid URL" }
  });
  await invoke({
    baseUrl: "https://preview.example",
    credential,
    accessToken: "preview-option-token"
  });

  assert.deepEqual(requests, [
    { origin: "https://preview.example", authorization: "" },
    { origin: "https://prod.example", authorization: "Bearer prod-mcp-credential" },
    { origin: "https://preview.example", authorization: "Bearer preview-mcp-explicit" },
    { origin: "https://preview.example", authorization: "" },
    { origin: "https://preview.example", authorization: "Bearer preview-option-token" }
  ]);
  assert.equal(JSON.stringify(requests).includes("invalid-url-token"), false);
});

test("local MCP serves the Phase 3 public read breadth through bounded adapters", async () => {
  const calls = [];
  const client = {
    capabilities: () => [],
    async getVideo(videoId) {
      calls.push(["video", videoId]);
      return { video: { video_id: videoId, title: "Video" } };
    },
    async listGames(options) {
      calls.push(["games", options]);
      return { lang: options.lang, games: [{ id: "2048" }] };
    },
    async getGame(gameId, options) {
      calls.push(["game", gameId, options]);
      return { id: gameId, lang: options.lang };
    },
    async listJapaneseSubtextLevels(options) {
      calls.push(["levels", options]);
      return { lang: options.lang, levels: [{ level: 1 }] };
    },
    async listJapaneseSubtextStages(options) {
      calls.push(["stages", options]);
      return { lang: options.lang, stages: [{ stageId: "L1-001" }] };
    },
    async getJapaneseSubtextStage(stageId, options) {
      calls.push(["stage", stageId, options]);
      if (stageId === "L1-050") {
        throw new JapaneseSubtextCapabilityError(`Japanese subtext stage not found: ${stageId}`, {
          code: "JAPANESE_SUBTEXT_NOT_FOUND",
          status: 404
        });
      }
      return { stageId, lang: options.lang, textLocked: true };
    },
    async getJapaneseSubtextProgress(options) {
      calls.push(["progress", options]);
      return { revision: 4, stages: [{ stageId: options.stageId }] };
    },
    async submitJapaneseSubtextAttempt(input) {
      calls.push(["attempt", input]);
      return { status: "applied", revision: input.expectedRevision + 1, score: 100 };
    }
  };
  const server = await createLocalMcpServer({ client, credential: null, allowRoots: [process.cwd()] });

  const video = await tool(server, "video_get").handler({ videoId: "video-123" });
  assert.equal(video.structuredContent.result.video.video_id, "video-123");

  const tools = await tool(server, "tools_list").handler({ lang: "en" });
  assert.equal(tools.isError, undefined);
  assert.equal(tools.structuredContent.result.lang, "en");
  assert.equal(tools.structuredContent.result.tools.length, 3);
  const firstToolId = tools.structuredContent.result.tools[0].id;
  const oneTool = await tool(server, "tools_get").handler({ toolId: firstToolId, lang: "ja" });
  assert.equal(oneTool.isError, undefined);
  assert.equal(oneTool.structuredContent.result.id, firstToolId);
  const missingTool = await tool(server, "tools_get").handler({ toolId: "missing-tool", lang: "zh" });
  assert.equal(missingTool.isError, true);
  assert.equal(missingTool.structuredContent.result.code, "not_found");
  assert.equal(missingTool.structuredContent.result.status, 404);

  const games = await tool(server, "games_list").handler({ lang: "ja", agentOnly: true });
  assert.equal(games.structuredContent.result.games[0].id, "2048");
  const game = await tool(server, "game_get").handler({ gameId: "2048", lang: "en" });
  assert.deepEqual(game.structuredContent.result, { id: "2048", lang: "en" });

  const levels = await tool(server, "japanese_subtext_levels").handler({ lang: "zh" });
  assert.equal(levels.structuredContent.result.levels[0].level, 1);
  const stages = await tool(server, "japanese_subtext_stages").handler({
    level: 1,
    query: "context",
    limit: 12,
    lang: "en"
  });
  assert.equal(stages.structuredContent.result.stages[0].stageId, "L1-001");
  const stage = await tool(server, "japanese_subtext_stage_get").handler({ stageId: "L1-001", lang: "ja" });
  assert.equal(stage.structuredContent.result.textLocked, true);
  const missingStage = await tool(server, "japanese_subtext_stage_get").handler({ stageId: "L1-050", lang: "zh" });
  assert.equal(missingStage.isError, true);
  assert.deepEqual(missingStage.structuredContent.result, {
    error: "Japanese subtext stage not found: L1-050",
    code: "JAPANESE_SUBTEXT_NOT_FOUND",
    status: 404
  });
  const progress = await tool(server, "japanese_subtext_progress_get").handler({
    stageId: "L1-001",
    days: 30
  });
  assert.equal(progress.structuredContent.result.revision, 4);
  const attemptInput = {
    stageId: "L1-001",
    stageRevision: 3,
    contentHash: "a".repeat(64),
    answers: [{ questionId: "q1", optionIds: ["a"] }],
    expectedRevision: 4,
    operationId: "mcp_attempt_0001"
  };
  const attempt = await tool(server, "japanese_subtext_attempt_submit").handler(attemptInput);
  assert.equal(attempt.structuredContent.result.status, "applied");

  assert.deepEqual(calls, [
    ["video", "video-123"],
    ["games", { lang: "ja", agentOnly: true }],
    ["game", "2048", { lang: "en" }],
    ["levels", { lang: "zh" }],
    ["stages", { level: 1, query: "context", limit: 12, lang: "en" }],
    ["stage", "L1-001", { lang: "ja" }],
    ["stage", "L1-050", { lang: "zh" }],
    ["progress", { stageId: "L1-001", days: 30 }],
    ["attempt", attemptInput]
  ]);
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

test("local MCP constrains whiteboard assets to verified allow-root raster files and safe output", async (t) => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-mcp-whiteboard-assets-"));
  const allowed = path.join(parent, "allowed");
  await fs.mkdir(allowed);
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const imageBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  );
  const assetId = "0123456789abcdef0123456789abcdef";
  await fs.writeFile(path.join(allowed, "source.png"), imageBytes);
  await fs.writeFile(path.join(parent, "outside.png"), imageBytes);
  await fs.writeFile(path.join(allowed, "too-large.png"), Buffer.alloc(5 * 1024 * 1024 + 1));
  const accessToken = `wbt1.${"d".repeat(80)}`;
  const document = new Y.Doc();
  let documentVersion = 0;
  const client = {
    capabilities: () => [],
    async joinWhiteboardRoom() {
      return { room: { type: "public" }, accessToken, accessExpiresAt: "2030-01-01T00:00:00.000Z" };
    },
    async uploadWhiteboardAsset(roomToken, file, options) {
      assert.equal(roomToken, accessToken);
      assert.equal(options.operationId, "mcp_asset_0001");
      await fs.writeFile(path.join(allowed, "source.png"), "replaced-after-inspection");
      assert.deepEqual(Buffer.from(file.body), imageBytes);
      return {
        ok: true,
        replayed: false,
        asset: { assetId, contentType: "image/png", byteLength: imageBytes.byteLength, width: 1, height: 1 }
      };
    },
    async getWhiteboardAsset(roomToken, requestedAssetId) {
      assert.equal(roomToken, accessToken);
      assert.equal(requestedAssetId, assetId);
      return { assetId, contentType: "image/png", byteLength: imageBytes.byteLength, bytes: imageBytes };
    },
    async downloadWhiteboardAsset(roomToken, requestedAssetId, sink) {
      assert.equal(roomToken, accessToken);
      assert.equal(requestedAssetId, assetId);
      await sink.write(imageBytes);
      await sink.close();
      return {
        assetId,
        contentType: "image/png",
        byteLength: imageBytes.byteLength,
        bytesWritten: imageBytes.byteLength
      };
    },
    async getWhiteboardScene() {
      return { updateBytes: Y.encodeStateAsUpdate(document), documentVersion, locked: false };
    },
    async applyWhiteboardUpdate(_roomToken, update) {
      Y.applyUpdate(document, update);
      documentVersion += 1;
      return { ok: true, replayed: false, documentVersion };
    }
  };
  const server = await createLocalMcpServer({
    client,
    credential: null,
    allowRoots: [allowed],
    env: { LUSU_CONFIG_DIR: path.join(allowed, ".state") }
  });
  const joined = await tool(server, "whiteboard_join").handler({ roomType: "public" });
  const boardHandle = joined.structuredContent.result.boardHandle;
  const uploaded = await tool(server, "whiteboard_asset_upload").handler({
    boardHandle,
    fileRef: "source.png",
    operationId: "mcp_asset_0001"
  });
  assert.equal(uploaded.isError, undefined);
  assert.equal(uploaded.structuredContent.result.asset.assetId, assetId);
  const serializedUpload = JSON.stringify(uploaded);
  assert.equal(serializedUpload.includes(parent), false);
  assert.equal(serializedUpload.includes(accessToken), false);

  const outside = await tool(server, "whiteboard_asset_upload").handler({
    boardHandle,
    fileRef: path.join(parent, "outside.png"),
    operationId: "mcp_asset_0002"
  });
  assert.equal(outside.isError, true);
  assert.equal(outside.structuredContent.result.code, "FILE_REF_OUTSIDE_ALLOW_ROOT");
  const oversized = await tool(server, "whiteboard_asset_upload").handler({
    boardHandle,
    fileRef: "too-large.png",
    operationId: "mcp_asset_0003"
  });
  assert.equal(oversized.isError, true);
  assert.equal(oversized.structuredContent.result.code, "WHITEBOARD_ASSET_FILE_SIZE_INVALID");
  const nonFile = await tool(server, "whiteboard_asset_upload").handler({
    boardHandle,
    fileRef: ".",
    operationId: "mcp_asset_0004"
  });
  assert.equal(nonFile.isError, true);
  assert.equal(nonFile.structuredContent.result.code, "FILE_REF_NOT_FILE");
  for (const fileRef of ["download.png:stream", "CON.png", "trailing.", "NUL"]) {
    const unsafe = await tool(server, "whiteboard_asset_download").handler({
      boardHandle,
      assetId,
      fileRef
    });
    assert.equal(unsafe.isError, true);
    assert.equal(unsafe.structuredContent.result.code, "FILE_REF_UNSAFE_PATH");
  }

  const downloaded = await tool(server, "whiteboard_asset_download").handler({
    boardHandle,
    assetId,
    fileRef: "download.png"
  });
  assert.equal(downloaded.isError, undefined);
  assert.equal(downloaded.structuredContent.result.fileRef, "download.png");
  assert.equal(JSON.stringify(downloaded).includes(parent), false);
  assert.deepEqual(await fs.readFile(path.join(allowed, "download.png")), imageBytes);
  const noClobber = await tool(server, "whiteboard_asset_download").handler({
    boardHandle,
    assetId,
    fileRef: "download.png"
  });
  assert.equal(noClobber.isError, true);
  assert.equal(noClobber.structuredContent.result.code, "FILE_ALREADY_EXISTS");

  const drawn = await tool(server, "whiteboard_draw").handler({
    boardHandle,
    operationId: "mcp_image_draw_0001",
    elements: [{ type: "image", assetId, x: 10, y: 20, width: 100, height: 80 }]
  });
  assert.equal(drawn.isError, undefined);
  assert.equal(drawn.structuredContent.result.scene.assetCount, 1);
  assert.equal(drawn.structuredContent.result.scene.elements[0].assetId, assetId);

  const symlink = path.join(allowed, "source-link.png");
  try {
    await fs.symlink(path.join(allowed, "source.png"), symlink, "file");
    const linked = await tool(server, "whiteboard_asset_upload").handler({
      boardHandle,
      fileRef: "source-link.png",
      operationId: "mcp_asset_0005"
    });
    assert.equal(linked.isError, true);
    assert.equal(linked.structuredContent.result.code, "FILE_REF_SYMLINK_FORBIDDEN");
  } catch (error) {
    if (!["EPERM", "EACCES"].includes(error?.code)) throw error;
  }
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
  assert.equal(initialized.result.serverInfo.version, "0.5.0");
  input.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} })}\n`);
  input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
  const listed = await waitForMessage(messages, (message) => message.id === 2);
  assert.ok(listed.result.tools.some((entry) => entry.name === "transfer_upload"));
  assert.ok(listed.result.tools.some((entry) => entry.name === "whiteboard_draw"));
  assert.ok(listed.result.tools.some((entry) => entry.name === "game_act"));
  assert.ok(listed.result.tools.some((entry) => entry.name === "video_get"));
  assert.ok(listed.result.tools.some((entry) => entry.name === "tools_list"));
  assert.ok(listed.result.tools.some((entry) => entry.name === "games_list"));
  assert.ok(listed.result.tools.some((entry) => entry.name === "japanese_subtext_stage_get"));
  assert.ok(listed.result.tools.some((entry) => entry.name === "japanese_subtext_progress_get"));
  assert.ok(listed.result.tools.some((entry) => entry.name === "japanese_subtext_attempt_submit"));
  for (const name of [
    "video_get", "tools_list", "tools_get", "games_list", "game_get",
    "japanese_subtext_levels", "japanese_subtext_stages", "japanese_subtext_stage_get",
    "japanese_subtext_progress_get", "japanese_subtext_attempt_submit"
  ]) {
    assert.equal(listed.result.tools.find((entry) => entry.name === name).inputSchema.additionalProperties, false);
  }
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
