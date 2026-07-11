import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mergeAudioManifests } from "../../merge-audio-manifests.mjs";

test("parallel audio roots merge by stable IDs without copying work files", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "jp-audio-merge-"));
  const target = path.join(temporary, "target");
  const source = path.join(temporary, "source");
  try {
    await writeFixture(target, "L1-001", 1);
    await writeFixture(source, "L2-001", 2);
    const result = await mergeAudioManifests({ targetRoot: target, sourceRoots: [source] });
    assert.equal(result.stageCount, 2);
    assert.equal(result.stats.scene, 2);
    assert.equal(result.stats.bytes, 6);
    const merged = JSON.parse(await readFile(path.join(target, "manifest.json"), "utf8"));
    assert.ok(merged.items["L1-001-scene"]);
    assert.ok(merged.items["L2-001-scene"]);
    assert.equal(await readFile(path.join(target, "level-2", "L2-001", "scene.mp3"), "utf8"), "mp3");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

async function writeFixture(root, stageId, level) {
  const prefix = `level-${level}/${stageId}`;
  await mkdir(path.join(root, `level-${level}`, stageId), { recursive: true });
  await writeFile(path.join(root, `level-${level}`, stageId, "scene.mp3"), "mp3");
  await writeFile(path.join(root, `level-${level}`, stageId, "timeline.json"), "{}");
  const item = {
    id: `${stageId}-scene`, type: "scene", stageId, level, path: `${prefix}/scene.mp3`,
    contentHash: "a".repeat(64), sha256: "b".repeat(64), durationSeconds: 1, bytes: 3
  };
  const stage = { stageId, contentHash: "c".repeat(64), timelinePath: `${prefix}/timeline.json` };
  await writeFile(path.join(root, "manifest.json"), `${JSON.stringify({
    schemaVersion: 1,
    contentVersion: "1.0.0",
    audioBaseUrl: "./",
    generator: level === 1 ? { name: "fixture", version: 1 } : { version: 1, name: "fixture" },
    voices: level === 1 ? { fixture: { name: "voice", speed: 1 } } : { fixture: { speed: 1, name: "voice" } },
    items: { [item.id]: item },
    stages: { [stageId]: stage },
    stats: { scene: 1, line: 0, option: 0, token: 0, durationSeconds: 1, bytes: 3 }
  }, null, 2)}\n`);
}
