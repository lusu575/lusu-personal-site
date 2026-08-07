import test from "node:test";
import assert from "node:assert/strict";
import { SiteClient, SiteClientError } from "../lib/capabilities/site-client.mjs";
import { deriveTransferRoomSecret } from "../lib/capabilities/transfer-crypto.mjs";

function jsonResponse(value, init = {}) {
  return new Response(JSON.stringify(value), {
    status: init.status || 200,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) }
  });
}

test("SiteClient injects Bearer auth and constrains requests to one origin", async () => {
  const calls = [];
  const client = new SiteClient({
    baseUrl: "https://example.test/prefix",
    accessToken: "token-value",
    fetch: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ articles: [], lang: "en" });
    }
  });
  await client.listArticles({ lang: "en", category: "daily-ai-news", limit: 12 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.origin, "https://example.test");
  assert.equal(calls[0].url.searchParams.get("category"), "daily-ai-news");
  assert.equal(calls[0].options.headers.get("Authorization"), "Bearer token-value");
  await assert.rejects(
    client.requestJson("https://different.test/api/articles"),
    (error) => error.code === "SITE_CROSS_ORIGIN_REJECTED"
  );
});

test("SiteClient keeps transfer secrets out of errors and encrypts text before POST", async () => {
  const secret = await deriveTransferRoomSecret("private-room");
  const calls = [];
  const client = new SiteClient({
    baseUrl: "https://example.test",
    accessToken: "agent-token",
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.pathname.endsWith("/room/join")) return jsonResponse({ room: { id: "room-id", status: "open" } });
      return jsonResponse({ item: { id: "item-1234567890123456", type: "text" } }, { status: 201 });
    }
  });
  await client.joinTransferRoom(secret);
  await client.sendTransferText(secret, "clear text");
  const join = JSON.parse(calls[0].options.body);
  const sent = JSON.parse(calls[1].options.body);
  assert.equal(join.roomKey, secret.roomKey);
  assert.equal(sent.roomKey, secret.roomKey);
  assert.notEqual(sent.encryptedContent, "clear text");
  assert.match(sent.encryptedContent, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(calls[0].options.headers.get("Origin"), "https://example.test");
});

test("SiteClient bounds JSON and returns structured HTTP errors without query secrets", async () => {
  const oversized = new SiteClient({
    baseUrl: "https://example.test",
    maxJsonBytes: 32,
    fetch: async () => jsonResponse({ value: "x".repeat(100) })
  });
  await assert.rejects(
    oversized.requestJson("/api/test"),
    (error) => error instanceof SiteClientError && error.code === "SITE_RESPONSE_TOO_LARGE"
  );

  const denied = new SiteClient({
    baseUrl: "https://example.test",
    fetch: async () => jsonResponse({ error: "Denied", code: "DENIED" }, { status: 403 })
  });
  await assert.rejects(
    denied.requestJson("/api/transfer/items?room=transfer_DO_NOT_EXPOSE"),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.code, "DENIED");
      assert.equal(error.path, "/api/transfer/items");
      assert.equal(JSON.stringify(error).includes("DO_NOT_EXPOSE"), false);
      return true;
    }
  );
});

test("SiteClient uploads exact bytes and streams downloads into a writable", async () => {
  const secret = await deriveTransferRoomSecret("private-room");
  const calls = [];
  const client = new SiteClient({
    baseUrl: "https://example.test",
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.pathname.includes("upload/simple")) {
        return jsonResponse({ item: { id: "item-1234567890123456", type: "file" } }, { status: 201 });
      }
      return new Response(new Uint8Array([1, 2, 3, 4]), {
        headers: { "Content-Length": "4", "Content-Type": "application/octet-stream" }
      });
    }
  });
  await client.uploadTransferFile(secret, {
    filename: "hello.txt",
    mimeType: "text/plain",
    sizeBytes: 3,
    body: new Uint8Array([1, 2, 3])
  });
  assert.equal(calls[0].options.headers.get("Content-Length"), "3");
  assert.equal(calls[0].url.searchParams.get("filename"), "hello.txt");

  const chunks = [];
  let closed = false;
  const result = await client.downloadTransferFile(secret, "item-1234567890123456", {
    async write(chunk) { chunks.push(...chunk); return true; },
    async close() { closed = true; }
  });
  assert.deepEqual(chunks, [1, 2, 3, 4]);
  assert.equal(result.bytesWritten, 4);
  assert.equal(closed, true);
});

test("SiteClient uploads and downloads bounded whiteboard raster assets with separated credentials", async () => {
  const assetId = "0123456789abcdef0123456789abcdef";
  const accessToken = `wbt1.${"z".repeat(80)}`;
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const calls = [];
  const client = new SiteClient({
    baseUrl: "https://example.test",
    accessToken: "agent-token",
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (options.method === "POST") {
        return jsonResponse({
          ok: true,
          replayed: false,
          asset: { assetId, contentType: "image/png", byteLength: png.byteLength, width: 1, height: 1 }
        }, { status: 201 });
      }
      return new Response(png, {
        status: 200,
        headers: { "Content-Type": "image/png", "Content-Length": String(png.byteLength) }
      });
    }
  });
  const uploaded = await client.uploadWhiteboardAsset(accessToken, {
    contentType: "image/png",
    sizeBytes: png.byteLength,
    body: png
  }, { operationId: "asset_upload_0001" });
  assert.equal(uploaded.asset.assetId, assetId);
  assert.equal(calls[0].url.pathname, "/api/whiteboard/agent/assets");
  assert.equal(calls[0].options.headers.get("Authorization"), "Bearer agent-token");
  assert.equal(calls[0].options.headers.get("X-Whiteboard-Access-Token"), accessToken);
  assert.equal(calls[0].options.headers.get("X-Whiteboard-Operation-Id"), "asset_upload_0001");
  assert.equal(calls[0].options.headers.get("Content-Length"), String(png.byteLength));
  await assert.rejects(
    client.uploadWhiteboardAsset(accessToken, {
      contentType: "image/png",
      sizeBytes: png.byteLength + 1,
      body: png
    }, { operationId: "asset_upload_0002" }),
    (error) => error instanceof SiteClientError && error.code === "WHITEBOARD_ASSET_LENGTH_MISMATCH"
  );

  const chunks = [];
  const downloaded = await client.downloadWhiteboardAsset(accessToken, assetId, {
    write(chunk) { chunks.push(new Uint8Array(chunk)); },
    async close() {}
  });
  assert.equal(downloaded.assetId, assetId);
  assert.equal(downloaded.bytesWritten, png.byteLength);
  assert.deepEqual([...chunks[0]], [...png]);
  assert.equal(calls[1].url.pathname, `/api/whiteboard/agent/assets/${assetId}`);
  assert.equal(calls[1].options.headers.get("X-Whiteboard-Access-Token"), accessToken);

  await assert.rejects(
    client.getWhiteboardAsset(accessToken, "../other-room"),
    (error) => error instanceof SiteClientError && error.code === "WHITEBOARD_ASSET_ID_INVALID"
  );
  assert.equal(calls.length, 2);

  const oversized = new SiteClient({
    baseUrl: "https://example.test",
    fetch: async () => new Response(new Uint8Array([1]), {
      status: 200,
      headers: { "Content-Type": "image/png", "Content-Length": String(5 * 1024 * 1024 + 1) }
    })
  });
  await assert.rejects(
    oversized.getWhiteboardAsset(accessToken, assetId),
    (error) => error instanceof SiteClientError && error.code === "WHITEBOARD_ASSET_SIZE_INVALID"
  );
});

test("SiteClient revokes the current agent token through the server contract", async () => {
  let request;
  const client = new SiteClient({
    baseUrl: "https://example.test",
    accessToken: "agent-token",
    fetch: async (url, options) => {
      request = { url, options };
      return jsonResponse({ ok: true });
    }
  });
  await client.revokeAgentToken();
  assert.equal(request.url.pathname, "/api/agent-auth/tokens/current");
  assert.equal(request.options.method, "DELETE");
});

test("SiteClient sends bounded administrator article mutations to the dedicated Agent API", async () => {
  const calls = [];
  const client = new SiteClient({
    baseUrl: "https://example.test",
    accessToken: "admin-agent-token",
    fetch: async (url, options) => {
      calls.push({ url, options, body: options.body ? JSON.parse(options.body) : null });
      return jsonResponse({ ok: true, article: { articleId: "article-1" } }, {
        status: options.method === "POST" ? 201 : 200
      });
    }
  });
  const translations = Object.fromEntries(["zh", "en", "ja"].map((lang) => [lang, {
    title: `${lang} title`,
    contentMarkdown: `# ${lang}\n${"x".repeat(70_000)}`
  }]));
  await client.publishArticle({
    operationId: "publish_article_001",
    slug: "agent-article",
    translations
  });
  await client.updateArticle("article-1", {
    operationId: "update_article_001",
    expectedUpdatedAt: "2026-08-07T10:00:00.000Z",
    tags: ["MCP"]
  });
  await client.deleteArticle("article-1", {
    operationId: "delete_article_001",
    expectedUpdatedAt: "2026-08-07T10:01:00.000Z",
    confirm: true
  });
  assert.deepEqual(calls.map(({ url, options }) => [url.pathname, options.method]), [
    ["/api/agent/articles/publish", "POST"],
    ["/api/agent/articles/article-1", "PUT"],
    ["/api/agent/articles/article-1", "DELETE"]
  ]);
  assert.ok(calls.every(({ options }) => options.headers.get("Authorization") === "Bearer admin-agent-token"));
  assert.ok(calls.every(({ options }) => options.headers.get("Origin") === "https://example.test"));
  await assert.rejects(
    client.updateArticle("../private", {}),
    (error) => error instanceof SiteClientError && error.code === "ARTICLE_ID_INVALID"
  );
  assert.equal(calls.length, 3);
});

test("SiteClient supports per-request JSON limits without raising the client-wide ceiling", async () => {
  const client = new SiteClient({
    baseUrl: "https://example.test",
    maxJsonBytes: 1024,
    fetch: async () => jsonResponse({ value: "x".repeat(100) })
  });
  await assert.rejects(
    client.requestJson("/api/tightly-bounded", { maxResponseBytes: 32 }),
    (error) => error instanceof SiteClientError && error.code === "SITE_RESPONSE_TOO_LARGE"
  );
  assert.deepEqual(await client.requestJson("/api/client-bounded"), { value: "x".repeat(100) });
});

test("SiteClient reads the fixed game catalog path and returns the safe game projection", async () => {
  const calls = [];
  const payload = {
    updated: "2026.08.06",
    games: [
      {
        id: "2048",
        title: "2048",
        titles: { zh: "2048", en: "2048", ja: "2048" },
        summaries: { zh: "数字游戏", en: "Number game", ja: "数字ゲーム" },
        entry: "2048/",
        languageSupport: { zh: true, en: true, ja: true },
        license: { name: "MIT", url: "https://github.com/gabrielecirulli/2048" },
        repo: "https://github.com/gabrielecirulli/2048",
        storage: { scoreOnly: true, keys: ["private-storage-key"] },
        sourceEntry: "source/index.html",
        languageMap: { zh: "zh", en: "en", ja: "ja" }
      }
    ]
  };
  const client = new SiteClient({
    baseUrl: "https://example.test",
    fetch: async (url) => {
      calls.push(url.pathname);
      return jsonResponse(payload);
    }
  });
  const catalog = await client.listGames({ lang: "en", agentOnly: true });
  assert.deepEqual(calls, ["/games/catalog.json"]);
  assert.deepEqual(catalog.games.map((game) => game.id), ["2048"]);
  assert.equal(catalog.games[0].summary, "Number game");
  assert.equal(catalog.games[0].agent.browserBridge, true);
  assert.equal(JSON.stringify(catalog).includes("private-storage-key"), false);

  const game = await client.getGame("2048", { lang: "ja" });
  assert.equal(game.title, "2048");
  assert.equal(game.launchPath, "/games/2048/?lang=ja");
  assert.deepEqual(calls, ["/games/catalog.json", "/games/catalog.json"]);
});

test("SiteClient validates stable video ids before constructing the request path", async () => {
  const calls = [];
  const client = new SiteClient({
    baseUrl: "https://example.test",
    fetch: async (url) => {
      calls.push(url.pathname);
      return jsonResponse({ video: { video_id: "video_ID:1" } });
    }
  });
  assert.equal((await client.getVideo("video_ID:1")).video.video_id, "video_ID:1");
  assert.deepEqual(calls, ["/api/videos/video_ID%3A1"]);

  for (const videoId of [".", "..", "video/../secret", "x".repeat(181), "video id", ""]) {
    await assert.rejects(
      client.getVideo(videoId),
      (error) => error instanceof SiteClientError && error.code === "VIDEO_ID_INVALID" && error.status === 400
    );
  }
  assert.deepEqual(calls, ["/api/videos/video_ID%3A1"]);
});

test("SiteClient reads Japanese progress and submits only a semantic attempt with Bearer auth", async () => {
  const calls = [];
  const client = new SiteClient({
    baseUrl: "https://example.test",
    accessToken: "japanese-progress-token",
    fetch: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse(url.pathname.endsWith("/attempts")
        ? { status: "applied", revision: 8, score: 100 }
        : { revision: 7, stages: [{ stageId: "L1-001" }] });
    }
  });
  const progress = await client.getJapaneseSubtextProgress({ stageId: "L1-001", days: 14 });
  assert.equal(progress.revision, 7);
  const attempt = {
    stageId: "L1-001",
    stageRevision: 3,
    contentHash: "a".repeat(64),
    answers: [{ questionId: "q1", optionIds: ["a"] }],
    expectedRevision: 7,
    operationId: "attempt_client_0001"
  };
  const submitted = await client.submitJapaneseSubtextAttempt(attempt);
  assert.equal(submitted.status, "applied");

  assert.equal(calls[0].url.pathname, "/api/tools/japanese-subtext/agent-progress");
  assert.equal(calls[0].url.searchParams.get("stageId"), "L1-001");
  assert.equal(calls[0].url.searchParams.get("days"), "14");
  assert.equal(calls[0].options.headers.get("Authorization"), "Bearer japanese-progress-token");
  assert.equal(calls[1].url.pathname, "/api/tools/japanese-subtext/attempts");
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[1].options.headers.get("Authorization"), "Bearer japanese-progress-token");
  assert.deepEqual(JSON.parse(calls[1].options.body), attempt);

  await assert.rejects(
    client.submitJapaneseSubtextAttempt({ ...attempt, expectedRevision: 0 }),
    (error) => error instanceof SiteClientError && error.code === "JAPANESE_SUBTEXT_EXPECTED_REVISION_INVALID"
  );
  await assert.rejects(
    client.submitJapaneseSubtextAttempt({ ...attempt, rawProgress: {} }),
    (error) => error instanceof SiteClientError && error.code === "JAPANESE_SUBTEXT_ATTEMPT_INVALID"
  );
  assert.equal(calls.length, 2);
});
