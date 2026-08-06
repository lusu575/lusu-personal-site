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
