import test from "node:test";
import assert from "node:assert/strict";
import {
  checkInStats, defaultProgress, defaultSettings, loadLocalState, mergeProgress, mergeSettings,
  hasCompletedModeOnboarding, markModeOnboardingComplete, recordAttempt, resetLocalState,
  sanitizeProgress, saveProgress, saveSettings
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
    hintCount: 0,
    activityDate: "2026-07-11"
  });
  assert.equal(first.stageProgress["L1-001"].medal, "gold");
  assert.ok(first.unlockedStageIds.includes("L1-002"));
  assert.equal(first.activityDays["2026-07-11"].stages["L1-001"].medal, "gold");

  const last = recordAttempt({ ...first, unlockedStageIds: [...first.unlockedStageIds, "L1-050"] }, "L1-050", {
    score: 100,
    cleared: true,
    displayMode: "bilingual",
    kana: true
  });
  assert.ok(last.unlockedStageIds.includes("L2-001"));
  assert.equal(last.stageProgress["L1-050"].medal, "bronze");
});

test("check-in history merges idempotently and calculates calendar streaks", () => {
  const local = sanitizeProgress({
    ...defaultProgress(),
    activityDays: {
      "2026-07-09": { stages: { "L1-001": { cleared: false, medal: "none", updatedAt: "2026-07-09T02:00:00.000Z" } }, updatedAt: "2026-07-09T02:00:00.000Z" },
      "2026-07-10": { stages: { "L1-001": { cleared: true, medal: "silver", updatedAt: "2026-07-10T02:00:00.000Z" } }, updatedAt: "2026-07-10T02:00:00.000Z" }
    }
  });
  const cloud = sanitizeProgress({
    ...defaultProgress(),
    activityDays: {
      "2026-07-10": { stages: { "L1-001": { cleared: true, medal: "gold", updatedAt: "2026-07-10T03:00:00.000Z" } }, updatedAt: "2026-07-10T03:00:00.000Z" },
      "2026-07-11": { stages: { "L1-002": { cleared: false, medal: "none", updatedAt: "2026-07-11T03:00:00.000Z" } }, updatedAt: "2026-07-11T03:00:00.000Z" }
    }
  });
  const merged = mergeProgress(local, cloud);
  assert.equal(merged.activityDays["2026-07-10"].stages["L1-001"].medal, "gold");
  assert.equal(Object.keys(merged.activityDays).length, 3);
  assert.deepEqual(checkInStats(merged, "2026-07-11"), {
    checkedInToday: true,
    currentStreak: 3,
    longestStreak: 3,
    totalDays: 3
  });
  const mergedAgain = mergeProgress(merged, cloud);
  assert.deepEqual(mergedAgain.activityDays, merged.activityDays);
});

test("same-day activity from different devices is unioned without losing a clear", () => {
  const local = sanitizeProgress({
    ...defaultProgress(),
    activityDays: {
      "2026-07-11": { stages: {
        "L1-001": { cleared: true, medal: "silver", updatedAt: "2026-07-11T01:00:00.000Z" }
      }, updatedAt: "2026-07-11T01:00:00.000Z" }
    }
  });
  const cloud = sanitizeProgress({
    ...defaultProgress(),
    activityDays: {
      "2026-07-11": { stages: {
        "L1-001": { cleared: false, medal: "none", updatedAt: "2026-07-11T02:00:00.000Z" },
        "L1-002": { cleared: false, medal: "none", updatedAt: "2026-07-11T02:00:00.000Z" }
      }, updatedAt: "2026-07-11T02:00:00.000Z" }
    }
  });
  const merged = mergeProgress(local, cloud);
  assert.deepEqual(Object.keys(merged.activityDays["2026-07-11"].stages).sort(), ["L1-001", "L1-002"]);
  assert.equal(merged.activityDays["2026-07-11"].stages["L1-001"].cleared, true);
  assert.equal(merged.activityDays["2026-07-11"].stages["L1-001"].medal, "silver");
});

test("oversized activity keeps the newest bounded days", () => {
  const activityDays = {};
  for (let offset = 0; offset < 405; offset += 1) {
    const date = new Date(2025, 0, 1 + offset, 12);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    activityDays[key] = {
      stages: { "L1-001": { cleared: false, medal: "none", updatedAt: date.toISOString() } },
      updatedAt: date.toISOString()
    };
  }
  const clean = sanitizeProgress({ ...defaultProgress(), activityDays });
  const keys = Object.keys(clean.activityDays).sort();
  assert.equal(keys.length, 400);
  assert.equal(keys[0], "2025-01-06");
  assert.equal(keys.at(-1), "2026-02-09");
});

test("legacy 1.0.1 stage timestamps migrate into idempotent check-in days", () => {
  const legacy = {
    ...defaultProgress(),
    stageProgress: {
      "L1-001": {
        cleared: true,
        bestScore: 100,
        medal: "gold",
        attempts: 1,
        updatedAt: "2026-07-09T12:00:00.000Z"
      },
      "L1-002": {
        cleared: false,
        attempts: 1,
        updatedAt: "2026-07-10T12:00:00.000Z"
      }
    }
  };
  delete legacy.activityDays;
  const migrated = sanitizeProgress(legacy);
  assert.equal(Object.keys(migrated.activityDays).length, 2);
  assert.equal(migrated.activityDays["2026-07-09"].stages["L1-001"].medal, "gold");
  assert.equal(migrated.activityDays["2026-07-10"].stages["L1-002"].cleared, false);
  assert.deepEqual(sanitizeProgress(migrated).activityDays, migrated.activityDays);
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

test("mode onboarding stays complete for the session when storage is denied", () => {
  const denied = {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); }
  };
  assert.equal(hasCompletedModeOnboarding(denied), false);
  assert.doesNotThrow(() => markModeOnboardingComplete(denied));
  assert.equal(hasCompletedModeOnboarding(denied), true);
});
