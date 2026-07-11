import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const contentRoot = path.join(toolRoot, "content");

export async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

export async function loadStageBatches() {
  const result = [];
  for (let level = 1; level <= 5; level += 1) {
    const directory = path.join(contentRoot, `level-${level}`);
    let names = [];
    try {
      names = (await readdir(directory)).filter((name) => /^batch-[0-9]{3}-[0-9]{3}\.json$/.test(name)).sort();
    } catch {
      // The caller reports missing levels with a useful aggregate error.
    }
    for (const name of names) {
      const file = path.join(directory, name);
      const payload = await readJson(file);
      result.push({ level, name, file, payload, stages: Array.isArray(payload?.stages) ? payload.stages : [] });
    }
  }
  return result;
}

export async function loadAllStages() {
  return (await loadStageBatches()).flatMap((batch) => batch.stages);
}

export function contentHash(stage) {
  const clean = structuredClone(stage);
  delete clean.contentHash;
  return createHash("sha256").update(stableStringify(clean)).digest("hex");
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function expectedShape(level, stage) {
  if (level === 1 && stage <= 10) return { lines: [2, 4], questions: [1, 1] };
  if (level === 1 && stage <= 30) return { lines: [3, 6], questions: [1, 1] };
  if (level === 1) return { lines: [4, 8], questions: [1, 2] };
  if (level === 2) return { lines: [3, 9], questions: [1, 2] };
  if (level === 3) return { lines: [5, 12], questions: [2, 3] };
  if (level === 4) return { lines: [7, 16], questions: [2, 4] };
  return { lines: [10, 20], questions: [3, 5] };
}

export function stageSort(a, b) {
  return (a.level - b.level) || (a.stage - b.stage);
}

export function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
