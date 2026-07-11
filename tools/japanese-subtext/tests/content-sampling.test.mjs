import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
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

test("every sentence reading has the same phonetic sequence as its chunks", () => {
  for (const stage of stages) {
    for (const line of stage.lines) {
      assert.equal(
        readingSequence(line.tokens.map((token) => token.reading).join("")),
        readingSequence(line.readingJa),
        `${stage.id}.${line.id} reading mismatch`
      );
    }
  }
});

test("every spoken answer option has a reviewed kana reading", () => {
  for (const stage of stages) {
    for (const question of stage.questions) {
      for (const option of question.options) {
        assert.ok(option.readingJa?.trim(), `${option.audioId} reviewed reading`);
        assert.doesNotMatch(option.readingJa, /\p{Script=Han}/u, `${option.audioId} reading still contains kanji`);
      }
    }
  }
});

function readingSequence(value) {
  return String(value).normalize("NFKC").replace(/[\s\p{P}\p{S}]/gu, "");
}

test("known Japanese copy and synthesis punctuation regressions stay corrected", () => {
  const optionByAudioId = new Map(
    stages.flatMap((stage) => stage.questions.flatMap((question) => question.options.map((option) => [option.audioId, option])))
  );
  const expected = new Map([
    ["L4-045-q2-c", ["永久許可を昨日失った", "えいきゅうきょかをきのううしなった"]],
    ["L5-019-q2-b", ["展示室はまもなく閉館する。", "てんじしつはまもなくへいかんする。"]],
    ["L5-019-q2-c", ["警備員は怪談を信じていない。", "けいびいんはかいだんをしんじていない。"]],
    ["L5-019-q2-d", ["肖像画にはどれも目がある。", "しょうぞうがにはどれもめがある。"]]
  ]);
  for (const [audioId, [textJa, readingJa]] of expected) {
    const option = optionByAudioId.get(audioId);
    assert.equal(option?.text?.ja, textJa, `${audioId} Japanese copy`);
    assert.equal(option?.ttsTextJa, textJa, `${audioId} visible/synthesis text`);
    assert.equal(option?.readingJa, readingJa, `${audioId} reviewed reading`);
  }

  for (const stage of stages) {
    for (const line of stage.lines) {
      assert.doesNotMatch(line.readingJa, /[―−，／]/u, `${stage.id}.${line.id} unsafe synthesis punctuation`);
      assertReviewedKyou(line.ttsTextJa, line.readingJa, `${stage.id}.${line.id}`);
      for (const token of line.tokens) assert.doesNotMatch(token.reading, /[―−，／]/u, `${stage.id}.${line.id}.${token.id} unsafe synthesis punctuation`);
      for (const token of line.tokens) assertReviewedKyou(token.text, token.reading, `${stage.id}.${line.id}.${token.id}`);
    }
    for (const question of stage.questions) {
      for (const option of question.options) {
        if (option.readingJa) {
          assert.doesNotMatch(option.readingJa, /[―−，／]/u, `${option.audioId} unsafe synthesis punctuation`);
          assertReviewedKyou(option.ttsTextJa, option.readingJa, option.audioId);
        }
      }
    }
  }
});

function assertReviewedKyou(surface, reading, label) {
  const visibleCount = (String(surface || "").match(/今日/g) || []).length;
  const readingCount = (String(reading || "").match(/きょ(?:う|ー)/g) || []).length;
  assert.ok(readingCount >= visibleCount, `${label} must pronounce every 今日 as きょう / きょー`);
}

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

test("every stage has its own hashed 960x720 monochrome four-panel manga", async () => {
  const illustrated = stages.filter((stage) => stage.illustration.enabled);
  assert.equal(illustrated.length, 250);
  const sources = new Set();
  for (const stage of illustrated) {
    assert.equal(stage.illustration.style, "monochrome-four-panel", `${stage.id} style`);
    assert.match(stage.illustration.src, new RegExp(`assets/stages/${stage.id.toLowerCase()}\\.webp$`));
    const file = path.join(toolRoot, stage.illustration.src);
    assert.ok(existsSync(file), `${stage.id} image exists`);
    assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), stage.illustration.sha256, `${stage.id} hash`);
    const metadata = await sharp(file).metadata();
    assert.deepEqual([metadata.width, metadata.height, metadata.format], [960, 720, "webp"], `${stage.id} dimensions`);
    sources.add(stage.illustration.src);
  }
  assert.equal(sources.size, 250);
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
