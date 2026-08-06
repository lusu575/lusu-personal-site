import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SiteClient } from "../lib/capabilities/site-client.mjs";
import { JapaneseSubtextCapabilityError } from "../lib/capabilities/japanese-subtext-adapter.mjs";

const BATCH_PATH = "/tools/japanese-subtext/content/level-1/batch-001-010.json";

function staticContentClient(overrides = new Map()) {
  const calls = [];
  const client = new SiteClient({
    baseUrl: "https://example.test",
    fetch: async (url) => {
      calls.push(url.pathname);
      let body;
      if (overrides.has(url.pathname)) {
        const value = overrides.get(url.pathname);
        body = typeof value === "string" ? value : JSON.stringify(value);
      } else {
        body = await readFile(new URL(`../${url.pathname.slice(1)}`, import.meta.url));
      }
      return new Response(body, {
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(Buffer.byteLength(body))
        }
      });
    }
  });
  return { client, calls };
}

async function contentJson(relativePath) {
  return JSON.parse(await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8"));
}

test("Japanese subtext capability lists validated levels without exposing content indexes", async () => {
  const { client, calls } = staticContentClient();
  const result = await client.listJapaneseSubtextLevels({ lang: "en" });
  assert.equal(result.contentVersion, "1.0.2");
  assert.equal(result.lang, "en");
  assert.equal(result.stageCount, 250);
  assert.equal(result.levels.length, 5);
  assert.equal(result.levels[0].description, "N3 daily language and clear clues");
  assert.equal(result.levels[0].coverUrl, "/tools/japanese-subtext/assets/covers/level-1.webp");
  assert.deepEqual(calls, ["/tools/japanese-subtext/content/catalog.json"]);
  assert.equal(JSON.stringify(result).includes("index.json"), false);
});

test("Japanese subtext capability searches localized summaries through fixed level indexes", async () => {
  const { client, calls } = staticContentClient();
  const result = await client.listJapaneseSubtextStages({
    level: 1,
    query: "lunch invitation",
    limit: 3,
    lang: "en"
  });
  assert.deepEqual(result.stages.map((stage) => stage.id), ["L1-001"]);
  assert.equal(result.stages[0].title, "A Lunch Invitation");
  assert.deepEqual(calls, [
    "/tools/japanese-subtext/content/catalog.json",
    "/tools/japanese-subtext/content/level-1/index.json"
  ]);
  assert.equal(JSON.stringify(result).includes("batch-001-010.json"), false);
});

test("Japanese subtext stage projection keeps learning evidence but omits internal TTS and token data", async () => {
  const { client, calls } = staticContentClient();
  const stage = await client.getJapaneseSubtextStage("L1-001", { lang: "zh" });
  assert.equal(stage.id, "L1-001");
  assert.equal(stage.title, "午休邀约");
  assert.equal(stage.titleJa, "昼休みの誘い");
  assert.equal(stage.lines[0].textJa, "亮くん、今日のお昼、一緒に新しい店へ行かない？");
  assert.equal(stage.questions[0].correctOptionIds[0], "a");
  assert.deepEqual(stage.questions[0].evidenceLineIds, ["line-002", "line-003"]);
  assert.equal(stage.illustration.url, "/tools/japanese-subtext/assets/stages/l1-001.webp");
  assert.deepEqual(calls, [
    "/tools/japanese-subtext/content/catalog.json",
    "/tools/japanese-subtext/content/level-1/index.json",
    BATCH_PATH
  ]);

  const serialized = JSON.stringify(stage);
  for (const forbidden of ["ttsTextJa", "tokens", "batch-001-010", "level-1/index.json"]) {
    assert.equal(serialized.includes(forbidden), false, `did not expose ${forbidden}`);
  }
});

test("Japanese subtext stage ids are canonical and rejected before any fetch", async () => {
  const { client, calls } = staticContentClient();
  for (const stageId of ["L1-000", "L1-051", "l1-001", "../L1-001"]) {
    await assert.rejects(
      client.getJapaneseSubtextStage(stageId),
      (error) => error instanceof JapaneseSubtextCapabilityError
        && error.code === "JAPANESE_SUBTEXT_INPUT_INVALID"
        && error.status === 400
    );
  }
  assert.deepEqual(calls, []);
});

test("Japanese subtext language and limit inputs fail closed before fetching content", async () => {
  const { client, calls } = staticContentClient();
  await assert.rejects(
    client.listJapaneseSubtextLevels({ lang: "fr" }),
    (error) => error instanceof JapaneseSubtextCapabilityError
      && error.code === "JAPANESE_SUBTEXT_INPUT_INVALID"
      && error.status === 400
  );
  for (const limit of [0, 1.5, 51, Number.POSITIVE_INFINITY]) {
    await assert.rejects(
      client.listJapaneseSubtextStages({ level: 1, limit }),
      (error) => error instanceof JapaneseSubtextCapabilityError
        && error.code === "JAPANESE_SUBTEXT_INPUT_INVALID"
        && error.status === 400
    );
  }
  assert.deepEqual(calls, []);
});

test("Japanese subtext content validation fails closed on version, lock, and hash mismatches", async () => {
  const invalidCatalog = await contentJson("tools/japanese-subtext/content/catalog.json");
  invalidCatalog.contentVersion = "9.9.9";
  const versionClient = staticContentClient(new Map([
    ["/tools/japanese-subtext/content/catalog.json", invalidCatalog]
  ])).client;
  await assert.rejects(
    versionClient.listJapaneseSubtextLevels(),
    (error) => error.code === "JAPANESE_SUBTEXT_CONTENT_INVALID"
  );

  const unlockedBatch = await contentJson("tools/japanese-subtext/content/level-1/batch-001-010.json");
  unlockedBatch.stages[0].textLocked = false;
  const unlockedClient = staticContentClient(new Map([[BATCH_PATH, unlockedBatch]])).client;
  await assert.rejects(
    unlockedClient.getJapaneseSubtextStage("L1-001"),
    (error) => error.code === "JAPANESE_SUBTEXT_CONTENT_INVALID"
  );

  const changedBodyBatch = await contentJson("tools/japanese-subtext/content/level-1/batch-001-010.json");
  changedBodyBatch.stages[0].lines[0].text.en += " Tampered.";
  const changedBodyClient = staticContentClient(new Map([[BATCH_PATH, changedBodyBatch]])).client;
  await assert.rejects(
    changedBodyClient.getJapaneseSubtextStage("L1-001"),
    (error) => error.code === "JAPANESE_SUBTEXT_CONTENT_INVALID"
  );

  const forgedIndex = await contentJson("tools/japanese-subtext/content/level-1/index.json");
  const forgedBatch = await contentJson("tools/japanese-subtext/content/level-1/batch-001-010.json");
  forgedBatch.stages[0].lines[0].text.en += " Forged.";
  forgedBatch.stages[0].contentHash = "f".repeat(64);
  forgedIndex.stages[0].contentHash = "f".repeat(64);
  const forgedClient = staticContentClient(new Map([
    ["/tools/japanese-subtext/content/level-1/index.json", forgedIndex],
    [BATCH_PATH, forgedBatch]
  ])).client;
  await assert.rejects(
    forgedClient.getJapaneseSubtextStage("L1-001"),
    (error) => error.code === "JAPANESE_SUBTEXT_CONTENT_INVALID"
  );
});
