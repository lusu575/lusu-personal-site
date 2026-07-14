import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadAllStages } from "../scripts/content-utils.mjs";

const stages = await loadAllStages();
const readingsByAudioId = new Map();
const spokenTasks = [];

for (const stage of stages) {
  for (const line of stage.lines) {
    readingsByAudioId.set(line.audioId, line.readingJa);
    spokenTasks.push({ audioId: line.audioId, surface: line.ttsTextJa, reading: line.readingJa });
    for (const token of line.tokens) {
      readingsByAudioId.set(token.audioId, token.reading);
      spokenTasks.push({ audioId: token.audioId, surface: token.text, reading: token.reading });
    }
  }
  for (const question of stage.questions) {
    for (const option of question.options) {
      readingsByAudioId.set(option.audioId, option.readingJa);
      spokenTasks.push({ audioId: option.audioId, surface: option.ttsTextJa, reading: option.readingJa });
    }
  }
}

const pronunciationEntries = JSON.parse(
  await readFile(new URL("../config/pronunciations.json", import.meta.url), "utf8"),
).entries;

function normalizeKana(text) {
  return text
    .replace(/[\u30a1-\u30f6]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60))
    .replace(/[^\p{Script=Hiragana}ー]/gu, "");
}

function pronunciationPattern(surface) {
  const escaped = surface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefix = /^\p{Script=Han}/u.test(surface) ? "(?<!\\p{Script=Han})" : "";
  return new RegExp(`${prefix}${escaped}`, "gu");
}

function appliedPronunciations(surface) {
  let remaining = surface;
  const applied = [];
  const longestFirst = [...pronunciationEntries].sort(
    (left, right) => right.surface.length - left.surface.length,
  );
  for (const entry of longestFirst) {
    if (!pronunciationPattern(entry.surface).test(remaining)) continue;
    applied.push(entry);
    remaining = remaining.replace(pronunciationPattern(entry.surface), entry.tts || entry.reading);
  }
  return applied;
}

const corrections = [
  {
    audioIds: ["L3-007-q1-a"],
    incorrect: "ついしょーさいせー",
    expected: "ついじゅーさいせー",
  },
  {
    audioIds: ["L3-019-line-006", "L3-019-line-006-token-001"],
    incorrect: "しまったふみきり",
    expected: "とじたふみきり",
  },
  {
    audioIds: ["L3-019-q1-b", "L4-044-line-010", "L4-044-line-010-token-002", "L4-044-q1-d"],
    incorrect: "いちぶずつ",
    expected: "いっぷんずつ",
  },
  {
    audioIds: ["L3-023-line-007", "L3-023-line-007-token-002"],
    incorrect: "ととのえばとのべました",
    expected: "ととのえばとだけのべました",
  },
  {
    audioIds: [
      "L4-002-line-001", "L4-002-line-001-token-002",
      "L4-004-line-005", "L4-004-line-005-token-002",
    ],
    incorrect: "ごぶだけ",
    expected: "ごふんだけ",
  },
  {
    audioIds: ["L4-011-line-003", "L4-011-line-003-token-001"],
    incorrect: "じゅーにぶん",
    expected: "じゅーにふん",
  },
  {
    audioIds: ["L4-011-q1-a"],
    incorrect: "いちぶだけ",
    expected: "いっぷんだけ",
  },
  {
    audioIds: ["L4-021-line-004", "L4-021-line-004-token-002"],
    incorrect: "ろくじいちぶ",
    expected: "ろくじいっぷん",
  },
  {
    audioIds: ["L4-028-line-008", "L4-028-line-008-token-002"],
    incorrect: "ごぶも",
    expected: "ごふんも",
  },
  {
    audioIds: [
      "L4-031-line-003", "L4-031-line-003-token-001",
      "L4-031-line-007", "L4-031-line-007-token-002",
      "L4-031-q3-b",
    ],
    incorrect: "いそじ",
    expected: "ごじゅーに",
  },
  {
    audioIds: [
      "L4-037-line-011", "L4-037-line-011-token-001",
      "L4-042-line-006", "L4-042-line-006-token-001",
      "L5-007-line-007", "L5-007-line-007-token-001", "L5-007-q2-a",
      "L5-024-line-006", "L5-024-line-006-token-002", "L5-025-q2-b",
    ],
    incorrect: "じゅーにぶん",
    expected: "じゅーにふん",
  },
  {
    audioIds: ["L5-005-q2-b"],
    incorrect: "いちぶのばした",
    expected: "いっぷんのばした",
  },
  {
    audioIds: ["L5-011-line-008", "L5-011-line-008-token-002"],
    incorrect: "よんわりごふん",
    expected: "よんわりごぶ",
  },
  {
    audioIds: ["L5-024-line-006", "L5-024-line-006-token-001", "L5-024-q2-a"],
    incorrect: "ごぶ",
    expected: "ごふん",
  },
  {
    audioIds: ["L5-032-line-017", "L5-032-line-017-token-002", "L5-032-q1-d"],
    incorrect: "さんぶご",
    expected: "さんぷんご",
  },
  {
    audioIds: ["L5-041-line-017", "L5-041-line-017-token-002"],
    incorrect: "ろくがつとよひ",
    expected: "ろくがつじゅーよっか",
  },
  {
    audioIds: [
      "L5-042-line-001", "L5-042-line-001-token-002",
      "L5-042-line-003", "L5-042-line-003-token-001",
      "L5-042-line-015", "L5-042-line-015-token-001",
    ],
    incorrect: "じゅーよじさんぶ",
    expected: "じゅーよじさんぷん",
  },
  {
    audioIds: ["L5-046-line-013", "L5-046-line-013-token-002"],
    incorrect: "じゅーはちぶさ",
    expected: "じゅーはっぷんさ",
  },
  {
    audioIds: [
      "L4-031-line-001", "L4-031-line-001-token-002",
      "L4-031-line-005", "L4-031-line-005-token-002",
      "L5-003-line-001", "L5-003-line-001-token-001",
    ],
    incorrect: "Ａ",
    expected: "えー",
  },
  {
    audioIds: ["L5-019-line-009", "L5-019-line-009-token-002"],
    incorrect: "ＡＲ",
    expected: "えーあーる",
  },
  {
    audioIds: ["L5-021-line-009", "L5-021-line-009-token-002"],
    incorrect: "Ｑいち",
    expected: "きゅーわん",
  },
  {
    audioIds: ["L5-047-line-006", "L5-047-line-006-token-002"],
    incorrect: "Ｖじゅーなな",
    expected: "ぶいじゅーなな",
  },
  {
    audioIds: ["L5-047-line-006", "L5-047-line-006-token-002"],
    incorrect: "Ｆじゅーなな",
    expected: "えふじゅーなな",
  },
  { audioIds: ["L1-011-q1-b"], incorrect: "せんなつ", expected: "ちなつ" },
  {
    audioIds: ["L1-018-q1-a", "L5-030-q3-d"],
    incorrect: "げんていぴん",
    expected: "げんていひん",
  },
  { audioIds: ["L1-029-q1-b"], incorrect: "いらいじん", expected: "いらいにん" },
  { audioIds: ["L1-030-q1-d"], incorrect: "あめぐつ", expected: "あまぐつ" },
  { audioIds: ["L1-032-q2-a"], incorrect: "はつずき", expected: "しょげつ" },
  { audioIds: ["L1-037-q1-d"], incorrect: "よしころも", expected: "ゆい" },
  { audioIds: ["L1-040-q1-d"], incorrect: "こもりかよー", expected: "こもりうたよー" },
  {
    audioIds: ["L2-014-q2-c", "L4-004-q1-a"],
    incorrect: "とうじょうこう",
    expected: "とうじょうぐち",
  },
  { audioIds: ["L2-032-q2-b"], incorrect: "りじん", expected: "りひと" },
  { audioIds: ["L2-039-q1-d"], incorrect: "のろいぶんしょ", expected: "じゅもんしょ" },
  { audioIds: ["L2-045-q1-d"], incorrect: "せきさつ", expected: "せきふだ" },
  { audioIds: ["L3-002-q1-b"], incorrect: "べつかい", expected: "べっかい" },
  {
    audioIds: ["L3-008-q1-b", "L4-019-line-006", "L4-019-line-006-token-002"],
    incorrect: "めんこ",
    expected: "めんつ",
  },
  { audioIds: ["L3-011-q2-a"], incorrect: "かんふとし", expected: "こうた" },
  { audioIds: ["L3-022-q1-b"], incorrect: "みばらい", expected: "みはらい" },
  {
    audioIds: ["L3-029-q1-b", "L3-029-q2-b"],
    incorrect: "もりじん",
    expected: "もりびと",
  },
  { audioIds: ["L3-029-q2-b"], incorrect: "もりと", expected: "もりびと" },
  { audioIds: ["L3-038-q2-c"], incorrect: "にみょー", expected: "にめー" },
  {
    audioIds: ["L3-047-line-007", "L3-047-line-007-token-002"],
    incorrect: "たんじょうひ",
    expected: "たんじょうび",
  },
  {
    audioIds: [
      "L3-047-q2-c", "L5-011-q3-c",
      "L5-032-line-008", "L5-032-line-008-token-001",
      "L5-036-line-017", "L5-036-line-017-token-001",
    ],
    incorrect: "じめん",
    expected: "じづら",
  },
  { audioIds: ["L4-004-q2-a"], incorrect: "かんのー", expected: "たんのー" },
  {
    audioIds: ["L4-006-line-007", "L4-006-line-007-token-002", "L4-006-q3-c"],
    incorrect: "しゃな",
    expected: "さな",
  },
  {
    audioIds: ["L4-008-line-005", "L4-008-line-005-token-001", "L4-008-q3-b"],
    incorrect: "はらえーぞー",
    expected: "げんえーぞー",
  },
  {
    audioIds: ["L4-009-line-005", "L4-009-line-005-token-002"],
    incorrect: "ははすー",
    expected: "ぼすー",
  },
  { audioIds: ["L4-010-q2-c"], incorrect: "むつな", expected: "ろくめー" },
  {
    audioIds: ["L4-014-line-008", "L4-014-line-008-token-001"],
    incorrect: "おてかず",
    expected: "おてすう",
  },
  {
    audioIds: ["L4-014-line-009", "L4-014-line-009-token-003"],
    incorrect: "だいたいひ",
    expected: "だいたいび",
  },
  {
    audioIds: ["L4-017-line-001", "L4-017-line-001-token-001"],
    incorrect: "ひらくかひか",
    expected: "ひらくかいなか",
  },
  {
    audioIds: ["L4-019-line-006", "L4-019-line-006-token-003", "L4-019-q1-b"],
    incorrect: "さいこく",
    expected: "さいごく",
  },
  { audioIds: ["L4-021-q1-b"], incorrect: "みんちょー", expected: "みょうちょう" },
  {
    audioIds: ["L4-025-line-011", "L4-025-line-011-token-004"],
    incorrect: "だいしせー",
    expected: "だいよんせー",
  },
  { audioIds: ["L4-028-q3-b"], incorrect: "さんみょー", expected: "さんめー" },
  {
    audioIds: ["L4-032-line-007", "L4-032-line-007-token-001"],
    incorrect: "そとから",
    expected: "がいかく",
  },
  { audioIds: ["L4-035-q1-c"], incorrect: "むじるし", expected: "むいんじ" },
  {
    audioIds: ["L4-041-line-012", "L4-041-line-012-token-001"],
    incorrect: "とーべ",
    expected: "とうぶ",
  },
  {
    audioIds: ["L4-025-q3-d", "L4-046-q3-d"],
    incorrect: "きゃらくたー",
    expected: "とうじょうじんぶつ",
  },
  { audioIds: ["L5-005-q3-d"], incorrect: "かんりもの", expected: "かんりしゃ" },
  { audioIds: ["L5-009-q1-a"], incorrect: "すくいなんぶん", expected: "きゅうなんぶん" },
  {
    audioIds: [
      "L5-013-line-011", "L5-013-line-011-token-002", "L5-013-q1-d", "L5-041-q4-c",
    ],
    incorrect: "さんげん",
    expected: "さんけん",
  },
  {
    audioIds: ["L5-015-line-007", "L5-015-line-007-token-002", "L5-015-q1-b"],
    incorrect: "かがみぞー",
    expected: "きょうぞう",
  },
  {
    audioIds: ["L5-022-line-003", "L5-022-line-003-token-002"],
    incorrect: "かくにんふそく",
    expected: "かくにんぶそく",
  },
  {
    audioIds: ["L5-022-line-006", "L5-022-line-006-token-001"],
    incorrect: "しめきりのときのしてい",
    expected: "しめきりじのしてい",
  },
  {
    audioIds: [
      "L5-023-line-004", "L5-023-line-004-token-002",
      "L5-023-line-011", "L5-023-line-011-token-002",
      "L5-023-q2-a", "L5-023-q3-b", "L5-023-q4-c",
    ],
    incorrect: "いぶしがおいる",
    expected: "くんこうおいる",
  },
  {
    audioIds: ["L5-023-line-013", "L5-023-line-013-token-001"],
    incorrect: "いまやぶん",
    expected: "こんやぶん",
  },
  {
    audioIds: ["L5-033-line-011", "L5-033-line-011-token-001"],
    incorrect: "かくこー",
    expected: "かくぎょう",
  },
  {
    audioIds: ["L5-038-line-001", "L5-038-line-001-token-001"],
    incorrect: "はくしんぎょ",
    expected: "しろみざかな",
  },
  {
    audioIds: ["L5-039-line-015", "L5-039-line-015-token-002", "L5-039-q4-a"],
    incorrect: "はらつずり",
    expected: "げんつづり",
  },
  {
    audioIds: [
      "L5-041-line-004", "L5-041-line-004-token-002",
      "L5-041-line-007", "L5-041-line-007-token-001",
      "L5-041-line-019", "L5-041-line-019-token-001",
    ],
    incorrect: "だいごたまき",
    expected: "だいごかん",
  },
  {
    audioIds: ["L5-044-line-014", "L5-044-line-014-token-002"],
    incorrect: "いっこー",
    expected: "いちぎょう",
  },
  {
    audioIds: ["L5-050-line-017", "L5-050-line-017-token-002"],
    incorrect: "どーひとわく",
    expected: "どういつわく",
  },
  {
    audioIds: ["L5-045-line-010", "L5-045-line-010-token-002"],
    incorrect: "しーえーえるいーえぬでぃーえーあーる",
    expected: "かれんだー、くぉーたー",
  },
  {
    audioIds: ["L5-039-line-003", "L5-039-line-003-token-002"],
    incorrect: "えむあいえぬじーだぶりゅーえーえぬじー",
    expected: "みん、わん",
  },
  {
    audioIds: ["L5-015-line-006", "L5-015-line-006-token-002"],
    incorrect: "だぶりゅーえーあいてぃーあいえぬじー",
    expected: "うぇいてぃんぐ",
  },
  { audioIds: ["L3-049-q2-c"], incorrect: "ととき", expected: "じゅーじ" },
  {
    audioIds: ["L3-009-line-003", "L3-009-line-003-token-002"],
    incorrect: "いちけん",
    expected: "いっけん",
  },
  { audioIds: ["L1-045-q1-d"], incorrect: "どーじじつ", expected: "おなじひ" },
  {
    audioIds: ["L5-005-line-008", "L5-005-line-008-token-002", "L5-009-q2-c"],
    incorrect: "どーじぶん",
    expected: "おなじぶん",
  },
  { audioIds: ["L5-016-q3-b"], incorrect: "どーじれい", expected: "おなじれい" },
  {
    audioIds: ["L4-010-line-006", "L4-010-line-006-token-001", "L4-010-q1-c"],
    incorrect: "どーいっかいせん",
    expected: "どーいつかいせん",
  },
  {
    audioIds: ["L5-034-q3-a", "L5-039-q1-c"],
    incorrect: "どーいちじんぶつ",
    expected: "どーいつじんぶつ",
  },
  {
    audioIds: ["L5-006-line-003", "L5-006-line-003-token-002"],
    incorrect: "げんって",
    expected: "いって",
  },
  {
    audioIds: [
      "L5-003-q2-a",
      "L4-027-line-001", "L4-027-line-001-token-003",
      "L4-020-line-001", "L4-020-line-001-token-002",
    ],
    incorrect: "なんを",
    expected: "なにを",
  },
  {
    audioIds: ["L4-037-line-012", "L4-037-line-012-token-002"],
    incorrect: "なんがいる",
    expected: "なにがいる",
  },
  { audioIds: ["L4-003-q2-d"], incorrect: "よんにんせき", expected: "よにんせき" },
  { audioIds: ["L4-003-q1-d"], incorrect: "さや", expected: "よにんめえの" },
  {
    audioIds: ["L4-045-line-004", "L4-045-line-004-token-002"],
    incorrect: "みそかいじょー",
    expected: "さんじゅーにちいじょー",
  },
  {
    audioIds: ["L3-049-line-011", "L3-049-line-011-token-004"],
    incorrect: "じゅういちかい",
    expected: "じゅーいっかい",
  },
  {
    audioIds: ["L4-028-line-009", "L4-028-line-009-token-002"],
    incorrect: "よつめ",
    expected: "よっつめ",
  },
  { audioIds: ["L5-042-q2-d"], incorrect: "はらとい", expected: "げんもん" },
  {
    audioIds: ["L4-002-line-004"],
    incorrect: "にじゅーさん：よんじゅーなな",
    expected: "にじゅーさんじよんじゅーななふん",
  },
  {
    audioIds: ["L4-002-line-004-token-001"],
    incorrect: "にじゅーさん：",
    expected: "にじゅーさんじ",
  },
  {
    audioIds: ["L4-002-line-004-token-002"],
    incorrect: "よんじゅーなな】",
    expected: "よんじゅーななふん】",
  },
  {
    audioIds: ["L4-002-line-005"],
    incorrect: "にじゅーさん：よんじゅーからぜろ：じゅー",
    expected: "にじゅーさんじよんじゅっぷんかられいじじゅっぷん",
  },
  {
    audioIds: ["L4-002-line-005-token-001"],
    incorrect: "にじゅーさん：",
    expected: "にじゅーさんじ",
  },
  {
    audioIds: ["L4-002-line-005-token-002"],
    incorrect: "よんじゅーからぜろ：",
    expected: "よんじゅっぷんかられいじ",
  },
  {
    audioIds: ["L4-002-line-005-token-003"],
    incorrect: "じゅーまで",
    expected: "じゅっぷんまで",
  },
  {
    audioIds: ["L2-008-q1-b", "L3-006-q2-a"],
    incorrect: "れーな",
    expected: "れな",
  },
  {
    audioIds: [
      "L2-020-q1-c", "L2-020-q2-b",
      "L4-002-line-003", "L4-002-line-003-token-001", "L4-002-q1-d",
    ],
    incorrect: "あんず",
    expected: "あん",
  },
  { audioIds: ["L2-034-q2-a"], incorrect: "もちしゅ", expected: "もちて" },
  {
    audioIds: ["L3-050-q1-c", "L3-050-q2-b"],
    incorrect: "ともり",
    expected: "あかり",
  },
  { audioIds: ["L4-044-q2-a"], incorrect: "じかんまと", expected: "じかんてき" },
  {
    audioIds: ["L4-037-line-002", "L4-037-line-002-token-002"],
    incorrect: "つづりへき",
    expected: "つづりぐせ",
  },
  { audioIds: ["L1-037-q1-b"], incorrect: "いろどり", expected: "あや" },
  { audioIds: ["L1-044-q1-b"], incorrect: "たけ。", expected: "たけし。" },
  { audioIds: ["L1-044-q2-d"], incorrect: "たけを", expected: "たけしを" },
  {
    audioIds: ["L2-015-q1-a", "L2-015-q1-b", "L2-015-q1-d"],
    incorrect: "みわ",
    expected: "みう",
  },
  { audioIds: ["L3-016-q2-c"], incorrect: "あかり", expected: "あきら" },
  { audioIds: ["L3-020-q1-b"], incorrect: "なれーしょん", expected: "あんないにん" },
  { audioIds: ["L3-035-q2-c"], incorrect: "てっだけ", expected: "とおるだけ" },
  { audioIds: ["L3-037-q2-a"], incorrect: "はやし", expected: "りん" },
  {
    audioIds: ["L3-042-q2-a", "L3-042-q2-d", "L3-042-q3-b", "L3-042-q3-d"],
    incorrect: "ひがし",
    expected: "あずま",
  },
  { audioIds: ["L4-007-q2-b"], incorrect: "さとし", expected: "とも" },
  {
    audioIds: ["L5-020-q1-a", "L5-020-q1-c", "L5-020-q1-d"],
    incorrect: "ついたち",
    expected: "さく",
  },
  {
    audioIds: ["L5-044-line-010", "L5-044-line-010-token-002"],
    incorrect: "はっしんもとらんわそらです",
    expected: "はっしんもとらんわからです",
  },
  {
    audioIds: ["L1-046-line-005", "L1-046-line-005-token-001"],
    incorrect: "みこまめ",
    expected: "さんこまめ",
  },
  { audioIds: ["L3-007-q1-a"], incorrect: "あるふあ", expected: "あるふぁ" },
  { audioIds: ["L5-048-q3-d"], incorrect: "しぶるい", expected: "よんぶんるい" },
  {
    audioIds: ["L1-005-q1-a"],
    incorrect: "おかわりをてーねーにたっている",
    expected: "おかわりをてーねーにことわっている",
  },
  {
    audioIds: ["L1-010-q1-a"],
    incorrect: "かうのをたっている",
    expected: "かうのをことわっている",
  },
  { audioIds: ["L2-034-q2-c"], incorrect: "しょーかいばんごーのさつ", expected: "しょーかいばんごーのふだ" },
  { audioIds: ["L2-040-q1-b"], incorrect: "すさぼー", expected: "ちぇっくあうと" },
  { audioIds: ["L3-004-q1-c"], incorrect: "たのきゃく", expected: "ほかのきゃく" },
  { audioIds: ["L3-025-q1-c"], incorrect: "さつとゆか", expected: "ふだとゆか" },
  {
    audioIds: ["L4-025-line-010", "L4-025-line-010-token-001"],
    incorrect: "いちこまずつ",
    expected: "ひとこまずつ",
  },
  {
    audioIds: ["L4-032-line-005", "L4-032-line-005-token-002"],
    incorrect: "じゅーさんちゃくもく",
    expected: "じゅーさんちゃくめ",
  },
  { audioIds: ["L4-042-q4-a"], incorrect: "おやゆびしるし", expected: "おやゆびじるし" },
  {
    audioIds: [
      "L4-048-line-002", "L4-048-line-002-token-002",
      "L4-048-line-003", "L4-048-line-003-token-001",
      "L4-048-line-004", "L4-048-line-004-token-001",
    ],
    incorrect: "さつ",
    expected: "ふだ",
  },
  {
    audioIds: [
      "L5-001-line-005", "L5-001-line-005-token-002",
      "L5-001-line-006", "L5-001-line-006-token-002",
    ],
    incorrect: "やしろ",
    expected: "しゃ",
  },
  { audioIds: ["L5-014-q3-d"], incorrect: "たのこんせき", expected: "ほかのこんせき" },
  {
    audioIds: [
      "L5-019-line-001", "L5-019-line-001-token-002",
      "L5-019-line-003", "L5-019-line-003-token-002",
      "L5-019-line-010", "L5-019-line-010-token-002",
    ],
    incorrect: "しばたき",
    expected: "まばたき",
  },
  { audioIds: ["L5-021-q4-c"], incorrect: "さむこー", expected: "いきさき" },
  { audioIds: ["L5-037-q1-c"], incorrect: "ひとりでいった", expected: "ひとりでおこなった" },
  { audioIds: ["L5-037-q2-c"], incorrect: "なりひん", expected: "かんせいひん" },
  { audioIds: ["L5-041-q1-d"], incorrect: "こくごとに", expected: "くにごとに" },
  { audioIds: ["L5-048-q2-d"], incorrect: "あやまくとーてん", expected: "ごくとーてん" },
  {
    audioIds: ["L5-050-line-007", "L5-050-line-007-token-001"],
    incorrect: "いちらんすーのしゅ",
    expected: "いちらんすーのたね",
  },
  {
    audioIds: ["L5-050-line-010", "L5-050-line-010-token-001"],
    incorrect: "そのね",
    expected: "そのあたい",
  },
];

const orthographicKanaCorrections = [
  { surfacePattern: /気(?:づ|付)/u, incorrect: "きず", expected: "きづ" },
  { surfacePattern: /近づ/u, incorrect: "ちかず", expected: "ちかづ" },
  { surfacePattern: /続/u, incorrect: "つず", expected: "つづ" },
  { surfacePattern: /綴り/u, incorrect: "つずり", expected: "つづり" },
  { surfacePattern: /手続/u, incorrect: "てつずき", expected: "てつづき" },
  { surfacePattern: /日付/u, incorrect: "ひずけ", expected: "ひづけ" },
  { surfacePattern: /裏付/u, incorrect: "うらずけ", expected: "うらづけ" },
  { surfacePattern: /香り付/u, incorrect: "かおりずけ", expected: "かおりづけ" },
  { surfacePattern: /後付/u, incorrect: "あとずけ", expected: "あとづけ" },
  { surfacePattern: /片付/u, incorrect: "かたずけ", expected: "かたづけ" },
  { surfacePattern: /気遣/u, incorrect: "きずかい", expected: "きづかい" },
  { surfacePattern: /一日付/u, incorrect: "ついたちずけ", expected: "ついたちづけ" },
  { surfacePattern: /縮んだ/u, incorrect: "ちじんだ", expected: "ちぢんだ" },
];

test("reviewed readings preserve contextual kanji readings and Japanese counters", () => {
  for (const correction of corrections) {
    for (const audioId of correction.audioIds) {
      const reading = readingsByAudioId.get(audioId);
      assert.ok(reading, `${audioId} exists`);
      assert.ok(reading.includes(correction.expected), `${audioId} includes ${correction.expected}`);
      assert.ok(!reading.includes(correction.incorrect), `${audioId} no longer includes ${correction.incorrect}`);
    }
  }
});

test("corrected Japanese option copy matches the reviewed spoken surface", () => {
  const expectedSurfaces = new Map([
    ["L2-040-q1-b", "すでにチェックアウトした別の客本人からの電話。"],
    ["L4-003-q1-d", "遅れて来る四人目への誕生日祝いを共同で隠している。"],
    ["L4-034-q1-a", "接続不能の二人は反対を表明できず、少なくともナディアは修正案を聞けていなかった"],
    ["L5-021-q4-c", "資料の一致を業務上の配慮として説明し、行き先の明言を避ける。"],
    ["L5-037-q2-c", "新しい段落や完成品を追加することだけを『作る』と狭く捉えたから。"],
  ]);

  for (const stage of stages) {
    for (const question of stage.questions) {
      for (const option of question.options) {
        const expected = expectedSurfaces.get(option.audioId);
        if (!expected) continue;
        assert.equal(option.text.ja, expected, `${option.audioId} shows natural Japanese copy`);
        assert.equal(option.ttsTextJa, expected, `${option.audioId} speaks the visible Japanese copy`);
        expectedSurfaces.delete(option.audioId);
      }
    }
  }

  assert.equal(expectedSurfaces.size, 0, "all corrected visible options exist");
});

test("L4-003 keeps the source-defined late fourth guest unnamed", () => {
  const stage = stages.find((candidate) => candidate.id === "L4-003");
  const option = stage?.questions
    .find((question) => question.id === "q1")
    ?.options.find((candidate) => candidate.id === "d");

  assert.equal(stage?.revision, 5);
  assert.deepEqual(option?.text, {
    ja: "遅れて来る四人目への誕生日祝いを共同で隠している。",
    zh: "他们共同隐瞒给迟到的第四个人准备的生日惊喜。",
    en: "They jointly conceal a birthday surprise for the late-arriving fourth guest.",
  });
  assert.doesNotMatch(JSON.stringify(stage), /沙耶|Saya|さや/u);
});

test("L4-011 through L4-018 keep the reviewed multilingual copy source-faithful", () => {
  const stage11 = stages.find((candidate) => candidate.id === "L4-011");
  const stage12 = stages.find((candidate) => candidate.id === "L4-012");
  const stage14 = stages.find((candidate) => candidate.id === "L4-014");
  const stage18 = stages.find((candidate) => candidate.id === "L4-018");

  const collectLocalizedCopy = (value, language, output = []) => {
    if (Array.isArray(value)) {
      for (const item of value) collectLocalizedCopy(item, language, output);
      return output;
    }
    if (!value || typeof value !== "object") return output;
    if (typeof value[language] === "string") output.push(value[language]);
    for (const nested of Object.values(value)) collectLocalizedCopy(nested, language, output);
    return output;
  };

  assert.equal(stage11?.revision, 5);
  assert.equal(stage11?.cast.find((person) => person.id === "sota")?.name?.zh, "宣传飒太");
  assert.doesNotMatch(collectLocalizedCopy(stage11, "zh").join("\n"), /颯太/u);

  assert.equal(stage12?.revision, 4);
  assert.match(stage12?.questions[0]?.explanation?.intent?.ja ?? "", /公開された留守番電話メッセージ/u);
  assert.doesNotMatch(stage12?.questions[0]?.explanation?.intent?.ja ?? "", /留言/u);

  assert.equal(stage14?.revision, 5);
  assert.equal(stage14?.lines.find((line) => line.id === "line-003")?.text?.en,
    "I apologize for the interruption, but would appreciate a confirmed date today. I am adding the sales manager.");
  assert.equal(stage14?.questions.find((question) => question.id === "q2")?.prompt?.en,
    "Why does Inoue's fourth line avoid commitment?");
  assert.doesNotMatch(JSON.stringify(stage14), /礼貌です|\.\.”/u);

  assert.equal(stage18?.revision, 4);
  assert.equal(stage18?.title?.zh, "过大的那只鞋");
  assert.doesNotMatch(JSON.stringify(stage18?.title), /故意/u);
});

test("L4-021 through L4-030 keep the reviewed multilingual copy and spoken surfaces precise", () => {
  const byId = (stageId) => stages.find((candidate) => candidate.id === stageId);
  const line = (stage, lineId) => stage?.lines.find((candidate) => candidate.id === lineId);
  const question = (stage, questionId) => stage?.questions.find((candidate) => candidate.id === questionId);

  const stage21 = byId("L4-021");
  assert.equal(stage21?.revision, 6);
  assert.deepEqual(stage21?.title, {
    ja: "明朝六時二分発",
    zh: "明早六点零二分发车",
    en: "Departure at 6:02 Tomorrow",
  });
  assert.deepEqual(stage21?.setting, {
    ja: "終電後の無人駅。翌朝の列車案内が流れ、ホーム側だけが明朝の景色と時刻を映し始める。",
    zh: "末班车后的无人车站播放次日早班列车信息，只有站台一侧开始呈现明早的景象与时间。",
    en: "An empty station after the last train: a next-morning service is announced, and only the platform side begins to show tomorrow morning's scene and time.",
  });
  assert.deepEqual(stage21?.illustration?.alt, {
    ja: "明朝六時二分発の場面を描いた、モノクロ四コマ漫画。",
    zh: "描绘“明早六点零二分发车”场景的黑白四格漫画。",
    en: "A black-and-white four-panel manga depicting the scene \"Departure at 6:02 Tomorrow\".",
  });

  const stage23 = byId("L4-023");
  const line23 = line(stage23, "line-003");
  const question23 = question(stage23, "q1");
  assert.equal(stage23?.revision, 6);
  assert.deepEqual(line23?.text, {
    ja: "里奈、「おはよぅ」って、最後の「う」が小書きの「ぅ」になってるよ。昨日も同じ打ち間違いだった。",
    zh: "里奈，你写的“おはよぅ”里，末尾的“う”变成了小写假名“ぅ”，和昨天是同一个输入错误。",
    en: "Rina, the final う in “おはよぅ” is written as the small kana ぅ, the same typo you made yesterday.",
  });
  assert.equal(line23?.ttsTextJa, "りな、「おはよぅ」って、最後の「う」が小書きの「ぅ」になってるよ。昨日も同じ打ち間違いだった。");
  assert.equal(line23?.readingJa, "りな、「おはよぅ」って、さいごの「う」がこがきの「ぅ」になってるよ。きのーもおなじうちまちがいだった。");
  assert.deepEqual(line23?.tokens.map(({ text, reading }) => ({ text, reading })), [
    { text: "里奈、", reading: "りな、" },
    { text: "「おはよぅ」って、最後の「う」が小書きの「ぅ」になってるよ。", reading: "「おはよぅ」って、さいごの「う」がこがきの「ぅ」になってるよ。" },
    { text: "昨日も同じ打ち間違いだった。", reading: "きのーもおなじうちまちがいだった。" },
  ]);
  assert.deepEqual(question23?.prompt, {
    ja: "ループへの自覚を、意図的な発言変更と次周回の検査提案の両方で最も直接に示す人物は誰ですか。",
    zh: "谁通过有意改变说法并提出下一轮测试，最直接地表现出对循环的自觉？",
    en: "Who most directly demonstrates loop awareness through both deliberate wording changes and a proposed test for the next loop?",
  });
  assert.deepEqual(question23?.explanation?.nuance, {
    ja: "紬と圭も周回差を把握しているようですが、意図的な言い換えと次周回の検査提案を両方示すのは智也です。",
    zh: "紬和圭似乎也掌握了各轮之间的差异，但同时有意改变说法并提出下一轮测试的只有智也。",
    en: "Tsumugi and Kei also appear to track differences across loops, but Tomoya alone combines deliberate rewording with a proposed next-loop test.",
  });

  const stage25 = byId("L4-025");
  assert.equal(stage25?.revision, 6);
  assert.deepEqual(stage25?.setting, {
    ja: "印刷所の校正室。作品に登場する葵、淳、美紀、太郎の四人が、吹き出しの配置がすべてずれたモノクロ四コマの校正刷りを見ながら、視線、持ち物、反応の向きから本来の話者を確認している。",
    zh: "印刷厂校样室里，漫画中的葵、淳、美纪和太郎正在核对一份所有对话框位置都错开的黑白四格校样，并根据视线、物品与反应方向还原原本的说话者。",
    en: "In a printer's proofing room, Aoi, Jun, Miki, and Taro—the people depicted in the comic—review a monochrome four-panel proof whose bubble positions are all displaced, using gazes, props, and reaction direction to recover the intended speakers.",
  });
  assert.deepEqual(stage25?.illustration?.alt, {
    ja: "四人が吹き出しのずれた校正刷りを確認する場面を描いた、モノクロ四コマ漫画。",
    zh: "描绘四人核对错位对话框校样的黑白四格漫画。",
    en: "A monochrome four-panel manga showing four reviewers examining a proof with displaced speech bubbles.",
  });

  const stage26 = byId("L4-026");
  const question26 = question(stage26, "q1");
  assert.equal(stage26?.revision, 6);
  assert.deepEqual(question26?.prompt, {
    ja: "次の選択肢から、現提案を実行不能にする独立した制約を二つ選んでください。",
    zh: "请从以下选项中选出两项使当前方案无法执行的独立限制。",
    en: "Choose the two listed independent constraints that make the current proposal infeasible.",
  });
  assert.deepEqual(question26?.explanation?.alternative, {
    ja: "価格未決も追加制約ですが、選択肢に挙がっているうち、実行不能へ直結するのは技術と法務の二点です。",
    zh: "价格未定也是额外限制，但在所列选项中，直接导致无法执行的是技术与法务两项。",
    en: "Unapproved pricing is another constraint, but among the listed options, engineering and legal are the two that directly block execution.",
  });

  const stage27 = byId("L4-027");
  assert.equal(stage27?.revision, 6);
  assert.deepEqual(question(stage27, "q2")?.explanation?.nuance, {
    ja: "他者称賛は礼儀正しく見えても、質問への非回答と組み合わさると票誘導の手段になります。",
    zh: "赞美他人很礼貌，但与回避自身问题结合后就成为导票手段。",
    en: "Praise is courteous, but paired with nonresponse it becomes a vote-steering device.",
  });

  const stage28 = byId("L4-028");
  assert.equal(stage28?.revision, 6);
  assert.deepEqual(stage28?.setting, {
    ja: "三人家族が喫茶店で四人分を整える。店員が空席側の皿を下げようとすると、家族は列車時刻や届いた連絡を確かめながら、もう少し待つよう頼む。",
    zh: "一家三口在咖啡馆摆了四人份。店员提出收走空座一侧的餐具时，家人一边确认列车时间和收到的消息，一边请他再等一会儿。",
    en: "A family of three sets a cafe table for four; when the server offers to clear the empty place setting, the family checks train timing and incoming messages and asks to wait a little longer.",
  });

  const stage29 = byId("L4-029");
  const line29 = line(stage29, "line-005");
  const question29 = question(stage29, "q1");
  const option29 = question29?.options.find((candidate) => candidate.id === "b");
  assert.equal(stage29?.revision, 4);
  assert.deepEqual(line29?.text, {
    ja: "三体とも、同じ珍しい誤字を使っています。",
    zh: "三个机器人都使用了同一个罕见错字。",
    en: "All three bots use the same unusual typo.",
  });
  assert.equal(line29?.ttsTextJa, "三体とも、同じ珍しい誤字を使っています。");
  assert.equal(line29?.readingJa, "さんたいとも、おなじめずらしいごじをつかっています。");
  assert.deepEqual(line29?.tokens.map(({ text, reading }) => ({ text, reading })), [
    { text: "三体とも、", reading: "さんたいとも、" },
    { text: "同じ珍しい誤字を使っています。", reading: "おなじめずらしいごじをつかっています。" },
  ]);
  assert.deepEqual(option29?.text, {
    ja: "同じ珍しい誤字を共有すること。",
    zh: "共享同一个罕见错字。",
    en: "They share the same rare typo.",
  });
  assert.equal(option29?.ttsTextJa, option29?.text?.ja);
  assert.equal(option29?.readingJa, "おなじめずらしいごじをきょーゆーすること。");
  assert.deepEqual(question29?.explanation?.literal, {
    ja: "本文に即した答えは「同じ珍しい誤字を共有すること。」です。",
    zh: "依照原文，答案是“共享同一个罕见错字。”。",
    en: "The text-supported answer is “They share the same rare typo.”",
  });
  assert.deepEqual(question29?.explanation?.intent, {
    ja: "一般的な語彙や敬語より、複数の発話源が同じ低頻度の誤りを共有する方が、共通テンプレートを疑う情報量が高いです。",
    zh: "相比共同使用常见词汇或敬语，多个发言源共享同一个低频错误，更像共同模板留下的指纹。",
    en: "A shared low-frequency error across multiple speaking sources is a stronger fingerprint of a common template than shared vocabulary or politeness.",
  });

  const stage30 = byId("L4-030");
  assert.equal(stage30?.revision, 5);
  assert.deepEqual(question(stage30, "q2")?.prompt, {
    ja: "楓の2番目の台詞が不自然に聞こえる直接の理由は何ですか。",
    zh: "枫在第2句台词的回答为何直接显得不自然？",
    en: "Why does Kaede's second line sound immediately unnatural?",
  });
});

test("L4-032, L4-034, and L4-040 keep the reviewed multilingual claims precise", () => {
  const stage32 = stages.find((candidate) => candidate.id === "L4-032");
  const stage34 = stages.find((candidate) => candidate.id === "L4-034");
  const stage40 = stages.find((candidate) => candidate.id === "L4-040");
  const line32 = stage32?.lines.find((line) => line.id === "line-014");
  const question34 = stage34?.questions.find((question) => question.id === "q1");
  const option34 = question34?.options.find((option) => option.id === "a");

  assert.equal(stage32?.revision, 6);
  assert.equal(line32?.text?.zh, "更正报告：12名人类与1台作业机器人，全部返回。");
  assert.doesNotMatch(line32?.text?.zh ?? "", /归还/u);

  assert.equal(stage34?.revision, 4);
  assert.deepEqual(option34?.text, {
    ja: "接続不能の二人は反対を表明できず、少なくともナディアは修正案を聞けていなかった",
    zh: "两名掉线者无法表达反对，且至少娜迪娅还没有听到修正案",
    en: "The two disconnected members could not object, and at least Nadia had not heard the amendment",
  });
  assert.equal(option34?.readingJa,
    "せつぞくふのーのふたりははんたいをひょーめーできず、すくなくともなでぃあはしゅうせーあんをきけていなかった");
  for (const section of ["intent", "evidence", "nuance"]) {
    assert.match(question34?.explanation?.[section]?.en ?? "", /at least Nadia had not heard the amendment/i);
  }
  assert.doesNotMatch(JSON.stringify(question34), /Two members were disconnected and lacked a chance to hear or respond/u);

  assert.equal(stage40?.revision, 5);
  assert.equal(stage40?.questions.find((question) => question.id === "q1")?.prompt?.zh,
    "本场景中持续具有欺骗性的是什么？");
});

test("L4-041 through L4-050 keep the final reviewed translations, readings, and inference claims precise", () => {
  const byId = (stageId) => stages.find((candidate) => candidate.id === stageId);
  const line = (stage, lineId) => stage?.lines.find((candidate) => candidate.id === lineId);
  const question = (stage, questionId) => stage?.questions.find((candidate) => candidate.id === questionId);
  const option = (stage, questionId, optionId) => question(stage, questionId)
    ?.options.find((candidate) => candidate.id === optionId);

  const stage42 = byId("L4-042");
  assert.equal(stage42?.revision, 6);
  assert.equal(option(stage42, "q3", "c")?.text?.en,
    "The proposal appeared only after the reactions");
  assert.equal(question(stage42, "q3")?.explanation?.intent?.en,
    "The reading that best unifies the scene is: The reactions attach to the deadline check / The proposal appeared only after the reactions.");

  const stage43 = byId("L4-043");
  assert.equal(stage43?.revision, 4);
  assert.equal(line(stage43, "line-001")?.text?.zh, "有当地特色的菜，就交给您安排。");
  assert.equal(line(stage43, "line-001")?.text?.en, "Something local—omakase, please.");
  assert.equal(line(stage43, "line-004")?.text?.ja, "通常のお任せコースは、実験的な料理を含む七品です。");
  assert.equal(line(stage43, "line-004")?.readingJa,
    "つーじょーのおまかせこーすわ、じっけんてきなりょーりをふくむななひんです。");
  assert.deepEqual(line(stage43, "line-004")?.tokens.at(-1), {
    id: "token-002",
    text: "実験的な料理を含む七品です。",
    reading: "じっけんてきなりょーりをふくむななひんです。",
    audioId: "L4-043-line-004-token-002",
  });
  assert.equal(option(stage43, "q3", "a")?.ttsTextJa, "客に実験的な料理を七品追加するから");
  assert.equal(option(stage43, "q3", "a")?.readingJa,
    "きゃくにじっけんてきなりょーりをななひんついかするから");

  const stage44 = byId("L4-044");
  assert.equal(stage44?.revision, 6);
  assert.equal(line(stage44, "line-012")?.readingJa,
    "かねわど、み、そで、ひとつのさんおんちゃいむになります。");
  assert.equal(line(stage44, "line-012")?.tokens.at(-1)?.reading,
    "ひとつのさんおんちゃいむになります。");

  const stage45 = byId("L4-045");
  assert.equal(stage45?.revision, 5);
  assert.equal(line(stage45, "line-004")?.text?.en,
    "Until yesterday, travelers staying for thirty days or more were included.");

  const stage46 = byId("L4-046");
  assert.equal(stage46?.revision, 5);
  assert.equal(option(stage46, "q3", "a")?.ttsTextJa,
    "筆記時刻と扉の外の記録という決定的な証拠がなく、二つの仮説が同じ証拠に適合する");
  assert.equal(option(stage46, "q3", "a")?.readingJa,
    "ひっきじこくととびらのそとのきろくというけってーてきなしょーこがなく、ふたつのかせつがおなじしょーこにてきごーする");
  assert.equal(question(stage46, "q3")?.explanation?.intent?.ja,
    "最も整合する読みは「筆記時刻と扉の外の記録という決定的な証拠がなく、二つの仮説が同じ証拠に適合する」です。");

  const stage47 = byId("L4-047");
  assert.equal(stage47?.revision, 5);
  assert.equal(line(stage47, "line-014")?.text?.en,
    "It is not prophecy. It is a rule of thumb for keeping rooms occupied.");
  assert.deepEqual(option(stage47, "q3", "d")?.text, {
    ja: "受付は予測方法を説明し、見込み欄と正式記録を分け、到着後にだけ確定しているから",
    zh: "前台说明了预测方法，区分预计栏与正式记录，并只在到达后确认",
    en: "The receptionist explains the forecasting method, separates provisional from formal entries, and finalizes only after arrival",
  });
  assert.equal(option(stage47, "q3", "d")?.readingJa,
    "うけつけわよそくほーほーをせつめーし、みこみらんとせーしききろくをわけ、とーちゃくごにだけかくてーしているから");
  assert.deepEqual(question(stage47, "q3")?.explanation?.intent, {
    ja: "最も整合する読みは「受付は予測方法を説明し、見込み欄と正式記録を分け、到着後にだけ確定しているから」です。",
    zh: "最能统合全部信息的解读是“前台说明了预测方法，区分预计栏与正式记录，并只在到达后确认”。",
    en: "The reading that best unifies the scene is: The receptionist explains the forecasting method, separates provisional from formal entries, and finalizes only after arrival.",
  });

  const stage48 = byId("L4-048");
  assert.equal(stage48?.revision, 5);
  assert.equal(line(stage48, "line-015")?.text?.en,
    "Quest updated: Return Stolen Item becomes Reconcile with the Defeated Opponent.");

  const stage49 = byId("L4-049");
  assert.equal(stage49?.revision, 5);
  assert.equal(stage49?.setting?.en,
    "A founder’s retirement meeting where identical keys test the return of authority rather than its use.");

  const stage50 = byId("L4-050");
  assert.equal(stage50?.revision, 5);
  assert.deepEqual(stage50?.setting, {
    ja: "無人化した宇宙船の最終通信。統合直後の二つのAIと、貨物区の未確認反応が複数形の境界を曖昧にする。",
    zh: "船员撤离后的宇宙船最终通信中，刚合并的两个AI与货舱里的未确认信号让复数“我们”的边界模糊。",
    en: "A final transmission from an evacuated ship where two newly merged AIs and an unverified cargo-bay signal blur the boundaries of the plural “we.”",
  });
  assert.equal(line(stage50, "line-015")?.text?.en,
    "No further answer will be provided about who “we” includes.");
  assert.equal(option(stage50, "q1", "a")?.ttsTextJa,
    "統合前の二つのAIを指す読みと、未確認反応を含む共同体の読みがともに残る");
  assert.equal(option(stage50, "q1", "a")?.readingJa,
    "とーごーまえのふたつのえーあいをさすよみと、みかくにんはんのーをふくむきょーどーたいのよみがともにのこる");
  assert.equal(question(stage50, "q1")?.explanation?.intent?.ja,
    "最も整合する読みは「統合前の二つのAIを指す読みと、未確認反応を含む共同体の読みがともに残る」です。");
});

test("L5-001 through L5-010 keep the reviewed multilingual claims and spoken surfaces precise", () => {
  const byId = (stageId) => stages.find((candidate) => candidate.id === stageId);
  const line = (stage, lineId) => stage?.lines.find((candidate) => candidate.id === lineId);
  const question = (stage, questionId) => stage?.questions.find((candidate) => candidate.id === questionId);
  const option = (stage, questionId, optionId) => question(stage, questionId)
    ?.options.find((candidate) => candidate.id === optionId);

  assert.deepEqual(
    Array.from({ length: 10 }, (_, index) => byId(`L5-${String(index + 1).padStart(3, "0")}`)?.revision),
    [6, 5, 5, 4, 5, 6, 5, 4, 5, 4],
  );

  const stage1 = byId("L5-001");
  assert.equal(line(stage1, "line-007")?.text?.en,
    "My “we” refers only to the six joint-team members.");
  assert.deepEqual(option(stage1, "q1", "a")?.text, {
    ja: "『私たち』の範囲が発言ごとに違い、商標条件についての共通合意はない。",
    zh: "每次“我们”所指不同，商标条件上并没有共同共识。",
    en: "Each “we” names a different group, so there is no shared agreement on the brand terms.",
  });

  const stage2 = byId("L5-002");
  assert.equal(line(stage2, "line-001")?.text?.ja,
    "最初は昔から場を明るくしていた真衣ちゃんです。");
  assert.equal(option(stage2, "q1", "d")?.text?.en,
    "He is keeping his former familiarity with Yui separate from the present public event.");

  const stage3 = byId("L5-003");
  assert.equal(line(stage3, "line-008")?.readingJa,
    "わたしのさんわからさのだんかいで、このみでわない。");
  assert.equal(question(stage3, "q1")?.prompt?.en,
    "Why can't the two-point average be interpreted as an “ordinary” rating?");
  assert.equal(option(stage3, "q1", "c")?.text?.en,
    "The numbers belong to different scales: rating, rank, and heat.");

  const stage4 = byId("L5-004");
  assert.deepEqual(line(stage4, "line-006")?.text, {
    ja: "線路は十年前に撤去され、跡地は排水路に転用されました。",
    zh: "铁轨十年前就被拆除，原址改作了排水沟。",
    en: "The tracks were removed ten years ago, and the site was converted into a drainage channel.",
  });

  const stage5 = byId("L5-005");
  assert.equal(line(stage5, "line-004")?.text?.ja,
    "元の文に付いた怒り反応だけ残っています。");
  assert.equal(option(stage5, "q3", "c")?.text?.en,
    "Angry reactions are legally valid votes.");

  const stage6 = byId("L5-006");
  assert.equal(line(stage6, "line-005")?.text?.ja,
    "まだ触ってないのに……その通りになった。");
  assert.equal(line(stage6, "line-010")?.text?.en,
    "The old commentary lined up because we made similar moves this round.");

  const stage7 = byId("L5-007");
  assert.equal(line(stage7, "line-004")?.text?.en,
    "During the first half, the user connected from Tokyo and held the pen in their right hand.");
  assert.equal(option(stage7, "q2", "a")?.readingJa,
    "じゅーにふんのあいだにせつぞくもとがとーきょーからさっぽろえかわる。");
  assert.equal(option(stage7, "q3", "d")?.text?.ja,
    "声が女性らしく聞こえるので絵美だけを処分する。");

  const stage8 = byId("L5-008");
  assert.equal(line(stage8, "line-001")?.text?.en,
    "Submit it by the end of this week. I'll hear the circumstances later.");
  assert.equal(option(stage8, "q3", "c")?.text?.ja, "人事がAIに質問した。");

  const stage9 = byId("L5-009");
  assert.equal(stage9?.setting?.en,
    "A distress call from a drifting ship in which two present-time appeals are inserted into an old drill recording.");
  assert.equal(line(stage9, "line-005")?.text?.ja,
    "最初の三文は過去形で、最後だけ現在形です。");

  const stage10 = byId("L5-010");
  assert.match(stage10?.setting?.en ?? "", /three respondents tell the truth/);
  assert.equal(line(stage10, "line-005")?.text?.en,
    "Then the three statements cannot be compared on the same basis.");
  assert.equal(option(stage10, "q1", "d")?.text?.en,
    "They interpreted “there” and “present” within different scopes: room, building, and meeting.");
  assert.match(question(stage10, "q4")?.explanation?.evidence?.en ?? "",
    /ambiguous question, three different response scopes, later clarifications, and final reflection/);
});

test("L5-011 through L5-020 keep the reviewed clues, chronology, and spoken surfaces precise", () => {
  const byId = (stageId) => stages.find((candidate) => candidate.id === stageId);
  const line = (stage, lineId) => stage?.lines.find((candidate) => candidate.id === lineId);
  const question = (stage, questionId) => stage?.questions.find((candidate) => candidate.id === questionId);

  assert.deepEqual(
    Array.from({ length: 10 }, (_, index) => byId(`L5-${String(index + 11).padStart(3, "0")}`)?.revision),
    [5, 6, 6, 5, 5, 5, 5, 4, 6, 6],
  );

  const stage11 = byId("L5-011");
  assert.equal(line(stage11, "line-010")?.text?.en,
    "A record voter count is not the same as higher turnout.");

  const stage12 = byId("L5-012");
  assert.equal(line(stage12, "line-006")?.text?.en,
    "Today she unusually stresses only the first written character of each listener name.");
  assert.equal(line(stage12, "line-008")?.text?.ja,
    "頭の一字を順につなぐと『北野地下口』です。");
  assert.equal(line(stage12, "line-008")?.readingJa,
    "あたまのいちじをじゅんにつなぐと『きたのちかぐち』です。");

  const stage13 = byId("L5-013");
  assert.equal(line(stage13, "line-009")?.text?.en,
    "Then the displayed-date order runs opposite to the recordings' chronology.");

  assert.equal(byId("L5-014")?.title?.en, "The Writing Order of Three Messages");

  const stage15 = byId("L5-015");
  assert.equal(line(stage15, "line-005")?.tokens?.[0]?.text, "She told her sister: ");
  assert.equal(line(stage15, "line-005")?.tokens?.map((token) => token.text).join(""),
    line(stage15, "line-005")?.text?.ja);

  const stage16 = byId("L5-016");
  assert.equal(line(stage16, "line-009")?.text?.ja,
    "王は平服に着替え、名も黎とだけ記しました。");

  const stage17 = byId("L5-017");
  assert.equal(line(stage17, "line-003")?.text?.ja,
    "エルは眠る前から、姫と呼ばれるのを嫌がった。");
  assert.doesNotMatch(JSON.stringify(line(stage17, "line-003")), /生前から|いや……/u);

  const stage18 = byId("L5-018");
  assert.equal(line(stage18, "line-001")?.text?.en,
    "In light of this, the new agreement shall be—");
  assert.equal(stage18?.lines.find((candidate) => candidate.text.en.includes("approved unanimously"))?.text?.en,
    "—approved unanimously.");

  const stage19 = byId("L5-019");
  assert.equal(line(stage19, "line-004")?.text?.ja,
    "端末では旧AR案内が自動起動しています。");
  assert.equal(stage19?.lines.find((candidate) => candidate.text.en.includes("confirm nor"))?.text?.en,
    "I am checking. At present, I can neither confirm nor rule that out.");

  const stage20 = byId("L5-020");
  assert.match(question(stage20, "q3")?.explanation?.evidence?.en ?? "", /two zero decisions/);
  assert.match(question(stage20, "q4")?.explanation?.evidence?.en ?? "", /two failed gaming attempts/);
});

test("L5-021 through L5-030 keep the reviewed meanings, readings, and uncertainty limits precise", () => {
  const byId = (stageId) => stages.find((candidate) => candidate.id === stageId);
  const line = (stage, lineId) => stage?.lines.find((candidate) => candidate.id === lineId);
  const question = (stage, questionId) => stage?.questions.find((candidate) => candidate.id === questionId);

  assert.deepEqual(
    Array.from({ length: 10 }, (_, index) => byId(`L5-${String(index + 21).padStart(3, "0")}`)?.revision),
    [6, 5, 6, 5, 6, 4, 5, 4, 4, 5],
  );

  const stage21 = byId("L5-021");
  assert.equal(stage21?.title?.en, "A Handover Sheet Aligned to Next Year's Calendar");
  assert.match(stage21?.setting?.en ?? "", /rival company's next-year holidays and quarter system/);

  const stage22 = byId("L5-022");
  assert.deepEqual(line(stage22, "line-003")?.text, {
    ja: "いえ、私の確認不足でした。",
    zh: "不，是我确认得不够。",
    en: "No, I failed to check carefully enough.",
  });

  const stage23 = byId("L5-023");
  assert.equal(line(stage23, "line-004")?.readingJa,
    "ちゅーぼーでわけむりをつかわず、くんこうおいるをいってきだけです。");

  const stage24 = byId("L5-024");
  assert.equal(line(stage24, "line-006")?.readingJa,
    "うちまでごふんとかいてあるけど、ふつーならじゅーにふんかな。");

  const stage25 = byId("L5-025");
  assert.equal(line(stage25, "line-004")?.readingJa,
    "ぺーじのさくせーじこくわきょうのくじじゅーにふんです。");

  const stage26 = byId("L5-026");
  assert.match(question(stage26, "q4")?.explanation?.evidence?.en ?? "",
    /closely tied to the tower lord and seeks a return to the tower/);
  assert.match(question(stage26, "q4")?.explanation?.evidence?.en ?? "",
    /Whether it is the lord himself or a copy of his voice or memory remains unsettled/);
  assert.doesNotMatch(JSON.stringify(stage26), /The quest narrator is the tower lord himself/u);

  const stage27 = byId("L5-027");
  assert.match(question(stage27, "q5")?.explanation?.nuance?.en ?? "",
    /do not automatically establish legal marriage or a complete private agreement/);

  const stage28 = byId("L5-028");
  assert.equal(line(stage28, "line-010")?.text?.en,
    "The audit shows zero factual memory but an updated lexical model.");

  const stage29 = byId("L5-029");
  assert.equal(line(stage29, "line-011")?.text?.en,
    "The blank was converted into my past self.");

  const stage30 = byId("L5-030");
  assert.equal(line(stage30, "line-009")?.readingJa,
    "りょーしゅーしょのしなわろくがつげんてーのあおうめてーしょくです。");
  assert.equal(line(stage30, "line-009")?.tokens.at(-1)?.reading,
    "ろくがつげんてーのあおうめてーしょくです。");
  for (const item of stage30?.questions ?? []) {
    assert.match(item.explanation.nuance.en, /who bundled these pieces of evidence into one itinerary/);
    assert.doesNotMatch(item.explanation.nuance.en, /who combined the photograph/i);
  }
});

test("L5-031 through L5-040 keep the reviewed multilingual claims and uncertainty boundaries precise", () => {
  const byId = (stageId) => stages.find((candidate) => candidate.id === stageId);
  const line = (stage, lineId) => stage?.lines.find((candidate) => candidate.id === lineId);
  const question = (stage, questionId) => stage?.questions.find((candidate) => candidate.id === questionId);
  const option = (stage, questionId, optionId) => question(stage, questionId)
    ?.options.find((candidate) => candidate.id === optionId);

  assert.deepEqual(
    Object.fromEntries(Array.from({ length: 10 }, (_, index) => {
      const stageId = `L5-${String(index + 31).padStart(3, "0")}`;
      return [stageId, byId(stageId)?.revision];
    })),
    {
      "L5-031": 5,
      "L5-032": 5,
      "L5-033": 5,
      "L5-034": 5,
      "L5-035": 4,
      "L5-036": 6,
      "L5-037": 5,
      "L5-038": 5,
      "L5-039": 6,
      "L5-040": 4,
    },
  );

  const stage31 = byId("L5-031");
  assert.deepEqual(stage31?.title, {
    ja: "カットをまたいで続く息継ぎ",
    zh: "跨越剪辑仍持续的换气",
    en: "Breathing That Continues Across Cuts",
  });
  assert.equal(line(stage31, "line-003")?.text?.zh, "……听得到，大河，请继续。");
  assert.equal(line(stage31, "line-003")?.readingJa, "……はい、たいがさん。つづけてください。");
  for (const item of stage31?.questions ?? []) {
    assert.match(item.explanation.evidence.en, /model-generated voice and responses/);
    assert.doesNotMatch(item.explanation.evidence.en, /human-mediated live responses/);
  }

  const stage32 = byId("L5-032");
  assert.equal(stage32?.title?.en, "Passengers Wait, Crew Move the Other Way");
  assert.equal(line(stage32, "line-008")?.readingJa,
    "じづらのせつびかくにんとわちがうんですね。");
  assert.equal(line(stage32, "line-017")?.readingJa,
    "あんぜんかくにんがかんりょーしました。さんぷんごにうんてんをさいかいします。");

  const stage33 = byId("L5-033");
  assert.equal(line(stage33, "line-011")?.text?.zh, "每行首字还按“い・お・り”循环。");
  assert.equal(line(stage33, "line-012")?.text?.ja, "姓は文字数、名は行頭の折句ですね。");
  for (const questionId of ["q1", "q2", "q3"]) {
    assert.match(question(stage33, questionId)?.explanation?.evidence?.en ?? "", /recover Iori Kagami's name/);
  }
  for (const questionId of ["q4", "q5"]) {
    assert.match(question(stage33, questionId)?.explanation?.evidence?.en ?? "", /does not identify its designer or motive/);
  }

  const stage34 = byId("L5-034");
  assert.deepEqual(stage34?.cast.find((person) => person.id === "owner")?.name, {
    ja: "日記の記述",
    zh: "日记条目",
    en: "Diary entry",
  });
  assert.equal(line(stage34, "line-009")?.text?.ja,
    "朝、塔へお届けします。遅れるわけにはまいりません。");
  assert.equal(line(stage34, "line-015")?.text?.en,
    "Multiple writers are likely, but Chikage's role remains open.");

  const stage35 = byId("L5-035");
  assert.equal(line(stage35, "line-009")?.text?.en,
    "The subtitler is behind the door. This line vanishes on resume.");
  assert.match(question(stage35, "q1")?.explanation?.evidence?.en ?? "", /supporting a separate speaking agent rather than a simple mistranslation/);

  const stage36 = byId("L5-036");
  assert.equal(line(stage36, "line-017")?.text?.en,
    "We must translate the speech act of the whole exchange, not merely preserve its lexical possibility.");

  const stage37 = byId("L5-037");
  assert.equal(option(stage37, "q2", "c")?.text?.en,
    "She narrowly defines making as adding new paragraphs or artifacts.");
  assert.equal(option(stage37, "q3", "d")?.text?.en,
    "The record should be corrected, while Riku's intent remains unsettled.");

  const stage38 = byId("L5-038");
  assert.equal(line(stage38, "line-001")?.text?.en,
    "This is the mid-course white fish. The three sauces are served separately.");
  assert.equal(line(stage38, "line-011")?.text?.en,
    "The mild dish was a comparison baseline, not a failure.");

  const stage39 = byId("L5-039");
  assert.equal(stage39?.cast.find((person) => person.id === "owner")?.name?.en, "Wang Ming, traveler");
  assert.equal(line(stage39, "line-009")?.text?.en,
    "'Wangmin.' It appears the spoken name was stored without a word break.");

  const stage40 = byId("L5-040");
  assert.match(stage40?.setting?.en ?? "", /four people test silence/);
  assert.equal(option(stage40, "q1", "b")?.text?.ja,
    "遥が声を出さずに、手話で同じ虚偽を示す。");
  assert.equal(option(stage40, "q4", "d")?.text?.en,
    "Intentional live spoken falsehood is supported, while mistakes, jokes, quotations, and synthetic speech remain untested.");
});

test("L5-041 through L5-050 keep the reviewed readings, speaker identities, and inference limits precise", () => {
  const byId = (stageId) => stages.find((candidate) => candidate.id === stageId);
  const line = (stage, lineId) => stage?.lines.find((candidate) => candidate.id === lineId);
  const question = (stage, questionId) => stage?.questions.find((candidate) => candidate.id === questionId);
  const option = (stage, questionId, optionId) => question(stage, questionId)
    ?.options.find((candidate) => candidate.id === optionId);

  assert.deepEqual(
    Array.from({ length: 10 }, (_, index) => byId(`L5-${String(index + 41).padStart(3, "0")}`)?.revision),
    [7, 5, 4, 7, 6, 5, 5, 6, 4, 6],
  );

  const stage41 = byId("L5-041");
  assert.equal(line(stage41, "line-010")?.text?.zh,
    "人类版本附表写着一万二千八百八十四号。");
  assert.equal(line(stage41, "line-010")?.text?.en,
    "The human appendix gives index 12,884.");
  assert.equal(line(stage41, "line-019")?.readingJa,
    "ちょーせきれきのだいごかん、だいさんのかねもかんさんひょうでわどうじこくです。");
  assert.equal(line(stage41, "line-019")?.tokens.at(-1)?.reading,
    "かんさんひょうでわどうじこくです。");
  assert.equal(option(stage41, "q1", "a")?.text?.en,
    "They use different labels and day boundaries but denote the same full moon and receipt instant.");

  const stage42 = byId("L5-042");
  assert.equal(line(stage42, "line-001")?.readingJa,
    "じこじこくをふくむじゅーよじさんぷんからにじゅーびょーかんをひょーじしてください。");
  assert.doesNotMatch(JSON.stringify(stage42), /じゅーよじさんぶ/u);

  const stage43 = byId("L5-043");
  assert.deepEqual(stage43?.cast.find((person) => person.id === "cough")?.name, {
    ja: "咳をした声",
    zh: "咳嗽声",
    en: "unidentified coughing voice",
  });
  assert.equal(line(stage43, "line-007")?.speaker, "cough");

  const stage44 = byId("L5-044");
  assert.match(question(stage44, "q4")?.explanation?.evidence?.en ?? "",
    /blank origin, two known pathways, absent body, purged log/);

  const stage45 = byId("L5-045");
  assert.deepEqual(question(stage45, "q3")?.correctOptionIds, ["a"]);
  assert.equal(option(stage45, "q3", "a")?.text?.en,
    "The single absolute date the founder actually intended.");

  const stage46 = byId("L5-046");
  for (const audioId of ["L5-046-line-004", "L5-046-line-004-token-002", "L5-046-line-010", "L5-046-line-010-token-001", "L5-046-q2-c"]) {
    assert.match(readingsByAudioId.get(audioId) ?? "", /あさぬの/);
  }

  const stage47 = byId("L5-047");
  assert.deepEqual(line(stage47, "line-003")?.text, {
    ja: "川は村より上流で、三日前から干上がっていた。",
    zh: "河流在村庄上游，从三天前起就已干涸。",
    en: "The river had already been dry upstream of the village for three days.",
  });
  assert.equal(line(stage47, "line-004")?.text?.en,
    "The forest lies east of the river and does not block its source.");

  const stage50 = byId("L5-050");
  assert.equal(line(stage50, "line-004")?.readingJa,
    "せーとーいちがひょーじされるまえにそのばしょをさけたのわ、これでさんかいめです。");
  assert.match(question(stage50, "q4")?.explanation?.evidence?.en ?? "",
    /two audit hypotheses, and coarse timestamps keep both accounts viable/);
  assert.doesNotMatch(question(stage50, "q4")?.explanation?.evidence?.en ?? "", /foreknowledge is proved/i);
});

test("reviewed readings use standard づ spelling for lexical voicing", () => {
  for (const task of spokenTasks) {
    for (const correction of orthographicKanaCorrections) {
      if (!correction.surfacePattern.test(task.surface)) continue;
      assert.ok(
        !task.reading.includes(correction.incorrect),
        `${task.audioId} uses ${correction.expected}, not ${correction.incorrect}`,
      );
    }
  }
});

test("all reviewed readings are kana and Japanese punctuation only", () => {
  for (const [audioId, reading] of readingsByAudioId) {
    assert.match(reading, /^[\p{Script=Hiragana}\p{Script=Katakana}ー\p{P}\p{S}\p{Z}]+$/u, `${audioId} pure kana`);
  }
});

test("お願い line keeps visible copy unchanged but gives TTS a hard sentence ending", () => {
  const stage = stages.find((candidate) => candidate.id === "L2-044");
  const line = stage?.lines.find((candidate) => candidate.audioId === "L2-044-line-006");
  assert.equal(line?.text.ja, "私も六時でお願い");
  assert.equal(line?.ttsTextJa, "私も六時でお願い。");
  assert.equal(line?.readingJa, "わたしもろくじでおねがい。");
});

test("今日 always uses the explicit きょう teaching reading", () => {
  for (const stage of stages) {
    const tasks = [
      ...stage.lines.flatMap((line) => [
        { id: line.audioId, surface: line.ttsTextJa, reading: line.readingJa },
        ...line.tokens.map((token) => ({ id: token.audioId, surface: token.text, reading: token.reading })),
      ]),
      ...stage.questions.flatMap((question) => question.options.map((option) => ({
        id: option.audioId,
        surface: option.ttsTextJa,
        reading: option.readingJa,
      }))),
    ];
    for (const task of tasks.filter((candidate) => candidate.surface.includes("今日"))) {
      const surfaceCount = task.surface.split("今日").length - 1;
      const readingCount = task.reading.split("きょう").length - 1;
      assert.equal(readingCount, surfaceCount, `${task.id} maps every 今日 to きょう`);
      assert.ok(!task.reading.includes("きょー"), `${task.id} does not use ambiguous きょー`);
    }
  }
});

test("speakable scene directions keep their complete reviewed readings", () => {
  const expectedLines = [
    {
      stageId: "L1-016",
      audioId: "L1-016-line-003",
      ttsTextJa: "笑顔のスタンプを送りました。",
      readingJa: "えがおのすたんぷをおくりました。",
      tokenReadings: ["えがおの", "すたんぷをおくりました。"],
    },
    ...["line-002", "line-003", "line-004"].map((lineId) => ({
      stageId: "L1-035",
      audioId: `L1-035-${lineId}`,
      ttsTextJa: "怒った猫のスタンプを送りました。",
      readingJa: "おこったねこのすたんぷをおくりました。",
      tokenReadings: ["おこったねこの", "すたんぷをおくりました。"],
    })),
    {
      stageId: "L1-033",
      audioId: "L1-033-line-005",
      ttsTextJa: "春香さん、奥のケーキと飾りつけは、あと五分でご用意できます。",
      readingJa: "はるかさん、おくのけーきとかざりつけは、あとごふんでごよういできます。",
      tokenReadings: ["はるかさん", "おくのけーきとかざりつけは", "あとごふんで", "ごよういできます"],
    },
  ];

  for (const expected of expectedLines) {
    const stage = stages.find((candidate) => candidate.id === expected.stageId);
    const line = stage?.lines.find((candidate) => candidate.audioId === expected.audioId);
    assert.ok(line, `${expected.audioId} exists`);
    assert.equal(line.ttsTextJa, expected.ttsTextJa, `${expected.audioId} keeps its speakable surface`);
    assert.equal(line.readingJa, expected.readingJa, `${expected.audioId} reads the complete surface`);
    assert.deepEqual(
      line.tokens.map((token) => token.reading),
      expected.tokenReadings,
      `${expected.audioId} exposes matching clickable chunks`,
    );
  }
});

test("used pronunciation overrides are present in the locked reviewed readings", () => {
  for (const task of spokenTasks) {
    for (const entry of appliedPronunciations(task.surface)) {
      const expected = normalizeKana(entry.tts || entry.reading);
      assert.ok(
        normalizeKana(task.reading).includes(expected),
        `${task.audioId} reflects pronunciation override ${entry.surface} -> ${entry.tts || entry.reading}`,
      );
    }
  }
});
