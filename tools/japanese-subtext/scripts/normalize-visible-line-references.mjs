import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { contentRoot, jsonText } from "./content-utils.mjs";

const languages = ["zh", "en", "ja"];
let changedStages = 0;
let changedStrings = 0;

for (let level = 1; level <= 5; level += 1) {
  const directory = path.join(contentRoot, `level-${level}`);
  for (let start = 1; start <= 50; start += 10) {
    const end = start + 9;
    const file = path.join(directory, `batch-${pad(start)}-${pad(end)}.json`);
    const payload = JSON.parse(await readFile(file, "utf8"));
    payload.stages.forEach((stage) => {
      const lineMap = new Map(stage.lines.map((line, index) => [line.id, { line, number: index + 1 }]));
      let stageChanged = false;
      stage.questions.forEach((question) => {
        stageChanged = replaceLocalized(question.prompt, lineMap) || stageChanged;
        question.options.forEach((option) => {
          stageChanged = replaceLocalized(option.text, lineMap) || stageChanged;
        });
        Object.values(question.explanation).forEach((entry) => {
          stageChanged = replaceLocalized(entry, lineMap) || stageChanged;
        });
      });
      if (stageChanged) {
        stage.revision = Number(stage.revision || 0) + 1;
        changedStages += 1;
      }
    });
    await writeFile(file, jsonText(payload), "utf8");
  }
}

console.log(`Normalized ${changedStrings} visible line references across ${changedStages} stages.`);

function replaceLocalized(value, lineMap) {
  if (!value || typeof value !== "object") return false;
  let changed = false;
  languages.forEach((language) => {
    if (typeof value[language] !== "string" || !/\blines?(?:-|\s)\d{2,3}/i.test(value[language])) return;
    const before = value[language];
    value[language] = replaceLineIds(before, language, lineMap);
    if (value[language] !== before) {
      changed = true;
      changedStrings += 1;
    }
  });
  return changed;
}

function replaceLineIds(text, language, lineMap) {
  let result = language === "en" ? normalizeEnglishNumberedLines(text) : text;
  for (const [lineId, { number }] of lineMap) {
    if (!new RegExp(lineId, "i").test(result)) continue;
    if (language === "zh") {
      result = result.replace(new RegExp(lineId, "gi"), `第${number}句台词`);
    } else if (language === "ja") {
      result = result.replace(new RegExp(lineId, "gi"), `${number}番目の台詞`);
    } else {
      const ordinal = englishOrdinal(number);
      result = result
        .replace(new RegExp(`([A-Z][A-Za-z'-]*(?:\\s+[A-Z][A-Za-z'-]*)*(?:'s|’s))\\s+${lineId}`, "g"), `$1 ${ordinal} line`)
        .replace(new RegExp(lineId, "g"), `the ${ordinal} line`)
        .replace(new RegExp(lineId, "gi"), `The ${ordinal} line`);
    }
  }
  if (language === "zh" || language === "ja") {
    result = result.replace(/([\p{Script=Han}\u3040-\u30ff])\s+(?=[\p{Script=Han}\u3040-\u30ff])/gu, "$1");
  }
  if (language === "ja") {
    result = result
      .replace(/\s+(?=\d+番目の台詞)/g, "")
      .replace(/(番目の台詞)\s+(?=[\p{Script=Han}\u3040-\u30ff])/gu, "$1");
  }
  return result;
}

function normalizeEnglishNumberedLines(text) {
  return text.replace(/\b(Lines?|lines?)\s+(\d{3}(?:\s*(?:[–-]|to|and|,)\s*(?:and\s+)?\d{3})*)/g, (_match, label, numbers) => {
    const ordinals = numbers.replace(/\d{3}/g, (digits) => englishOrdinal(Number(digits)));
    const normalized = ordinals.replace(/\s*[–-]\s*|\s+to\s+/g, " through ").replace(/\s+/g, " ");
    const count = (numbers.match(/\d{3}/g) || []).length;
    const article = label[0] === label[0].toUpperCase() ? "The" : "the";
    return `${article} ${normalized} ${count > 1 ? "lines" : "line"}`;
  });
}

function englishOrdinal(value) {
  const words = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth", "twentieth"];
  return words[value] || `${value}th`;
}

function pad(value) {
  return String(value).padStart(3, "0");
}
