import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { loadAllStages, readJson, toolRoot } from "../scripts/content-utils.mjs";

const stages = await loadAllStages();
const voices = (await readJson(path.join(toolRoot, "content", "voices.json"))).voices;
const byId = new Map(stages.map((stage) => [stage.id, stage]));

test("first, middle, and final three stages of every level are structurally playable", () => {
  assert.equal(stages.length, 250);
  for (let level = 1; level <= 5; level += 1) {
    for (const number of [1, 2, 3, 24, 25, 26, 48, 49, 50]) {
      const id = `L${level}-${String(number).padStart(3, "0")}`;
      const stage = byId.get(id);
      assert.ok(stage, `${id} exists`);
      assert.ok(stage.lines.length > 0, `${id} has lines`);
      assert.ok(stage.questions.length > 0, `${id} has questions`);
      assert.ok(stage.lines.every((line) => line.audioId && line.tokens.every((token) => token.audioId)), `${id} has sentence and chunk audio IDs`);
      assert.ok(stage.questions.every((question) => question.options.every((option) => option.audioId)), `${id} has option audio IDs`);
    }
  }
});

test("the acceptance sampling matrix covers listening, multi-question, and multiple-choice cases", () => {
  const listeningSamples = Array.from({ length: 5 }, (_, index) => index + 1)
    .flatMap((level) => [1, 2].map((number) => byId.get(`L${level}-${String(number).padStart(3, "0")}`)));
  assert.equal(listeningSamples.length, 10);
  assert.ok(listeningSamples.every((stage) => stage.lines.length > 0));
  assert.ok(stages.filter((stage) => stage.questions.length > 1).length >= 10);
  assert.ok(stages.filter((stage) => stage.questions.some((question) => question.type === "multiple")).length >= 10);
});

test("voice assignments cover female, male, mixed, and narrator or special scenes", () => {
  const genders = (stage) => new Set(stage.cast.map((person) => voices[person.voiceKey]?.gender));
  assert.ok(stages.some((stage) => [...genders(stage)].every((gender) => gender === "female")));
  assert.ok(stages.some((stage) => [...genders(stage)].every((gender) => gender === "male")));
  assert.ok(stages.some((stage) => genders(stage).has("female") && genders(stage).has("male")));
  assert.ok(stages.some((stage) => genders(stage).has("neutral")));
});

test("illustrations are present and use only the approved color styles", () => {
  const illustrated = stages.filter((stage) => stage.illustration.enabled);
  assert.equal(illustrated.length, 31);
  for (const stage of illustrated) {
    assert.ok(["crayon", "chibi-four-panel"].includes(stage.illustration.style), `${stage.id} style`);
    assert.ok(existsSync(path.join(toolRoot, stage.illustration.src)), `${stage.id} image exists`);
  }
});

test("each level starts shorter and grows toward its later stages", () => {
  for (let level = 1; level <= 5; level += 1) {
    const selected = stages.filter((stage) => stage.level === level).sort((a, b) => a.stage - b.stage);
    const earlyAverage = average(selected.slice(0, 10).map((stage) => stage.lines.length));
    const lateAverage = average(selected.slice(-10).map((stage) => stage.lines.length));
    assert.ok(lateAverage >= earlyAverage, `level ${level}: ${earlyAverage} -> ${lateAverage}`);
  }
});

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}
