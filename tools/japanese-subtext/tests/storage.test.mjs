import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultProgress, defaultSettings, loadLocalState, mergeProgress, mergeSettings,
  recordAttempt, resetLocalState, sanitizeProgress, saveProgress, saveSettings
} from "../lib/storage.mjs";

class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test("damaged local JSON recovers without crashing", () => {
  const storage = new MemoryStorage({
    "lusu.japaneseSubtext.progress.v1": "{broken",
    "lusu.japaneseSubtext.settings.v1": JSON.stringify({ uiLanguage: "ja", playbackRate: 99 })
  });
  const result = loadLocalState(storage, "zh");
  assert.equal(result.damaged, true);
  assert.equal(result.progress.currentLevel, 1);
  assert.equal(result.settings.uiLanguage, "ja");
  assert.equal(result.settings.playbackRate, 1);
});

test("clearing a stage unlocks the next stage and awards the right medal", () => {
  const first = recordAttempt(defaultProgress(), "L1-001", {
    score: 100,
    cleared: true,
    displayMode: "listening",
    kana: false,
    replayCount: 0,
    hintCount: 0
  });
  assert.equal(first.stageProgress["L1-001"].medal, "gold");
  assert.ok(first.unlockedStageIds.includes("L1-002"));

  const last = recordAttempt({ ...first, unlockedStageIds: [...first.unlockedStageIds, "L1-050"] }, "L1-050", {
    score: 100,
    cleared: true,
    displayMode: "bilingual",
    kana: true
  });
  assert.ok(last.unlockedStageIds.includes("L2-001"));
  assert.equal(last.stageProgress["L1-050"].medal, "bronze");
});

test("cloud merge never loses clears, scores, medals, or unlocks", () => {
  const local = sanitizeProgress({
    ...defaultProgress(),
    unlockedStageIds: ["L1-001", "L1-002"],
    stageProgress: {
      "L1-001": { cleared: true, bestScore: 70, medal: "silver", attempts: 2, updatedAt: "2026-07-11T00:00:00.000Z" }
    }
  });
  const cloud = sanitizeProgress({
    ...defaultProgress(),
    currentStage: 2,
    unlockedStageIds: ["L1-001", "L1-002", "L1-003"],
    stageProgress: {
      "L1-001": { cleared: true, bestScore: 100, medal: "bronze", attempts: 3, updatedAt: "2026-07-11T01:00:00.000Z" },
      "L1-002": { cleared: true, bestScore: 80, medal: "bronze", attempts: 1, updatedAt: "2026-07-11T01:00:00.000Z" }
    }
  });
  const merged = mergeProgress(local, cloud);
  assert.equal(merged.stageProgress["L1-001"].bestScore, 100);
  assert.equal(merged.stageProgress["L1-001"].medal, "silver");
  assert.equal(merged.stageProgress["L1-002"].cleared, true);
  assert.ok(merged.unlockedStageIds.includes("L1-003"));
});

test("a newer failed attempt cannot erase an older first-clear mode", () => {
  const cloud = sanitizeProgress({
    ...defaultProgress(),
    unlockedStageIds: ["L1-001", "L1-002"],
    stageProgress: {
      "L1-001": {
        cleared: true,
        bestScore: 80,
        medal: "silver",
        attempts: 1,
        firstAccuracy: 80,
        firstClearMode: "japanese",
        updatedAt: "2026-07-11T00:00:00.000Z"
      }
    }
  });
  const local = sanitizeProgress({
    ...defaultProgress(),
    stageProgress: {
      "L1-001": {
        cleared: false,
        bestScore: 20,
        medal: "none",
        attempts: 2,
        firstAccuracy: 20,
        firstClearMode: "",
        updatedAt: "2026-07-11T01:00:00.000Z"
      }
    }
  });
  const merged = mergeProgress(local, cloud);
  assert.equal(merged.stageProgress["L1-001"].cleared, true);
  assert.equal(merged.stageProgress["L1-001"].medal, "silver");
  assert.equal(merged.stageProgress["L1-001"].firstClearMode, "japanese");
  assert.ok(merged.stageProgress["L1-001"].attempts >= 1);
});

test("newer settings win while reset stays tool-scoped", () => {
  const local = { ...defaultSettings("zh"), displayMode: "listening", updatedAt: "2026-07-11T02:00:00.000Z" };
  const cloud = { ...defaultSettings("en"), displayMode: "bilingual", updatedAt: "2026-07-11T01:00:00.000Z" };
  assert.equal(mergeSettings(local, cloud).displayMode, "listening");
  const storage = new MemoryStorage({ unrelated: "keep" });
  resetLocalState(storage, "ja");
  assert.equal(storage.getItem("unrelated"), "keep");
});

test("denied storage never blocks the in-memory training session", () => {
  const denied = {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); },
    removeItem() { throw new Error("denied"); }
  };
  assert.doesNotThrow(() => saveSettings(defaultSettings("ja"), denied));
  assert.doesNotThrow(() => saveProgress(defaultProgress(), denied));
  assert.doesNotThrow(() => resetLocalState(denied, "ja"));
  assert.equal(loadLocalState(denied, "ja").damaged, true);
});
