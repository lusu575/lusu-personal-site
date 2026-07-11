import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);

export async function mergeAudioManifests({ targetRoot, sourceRoots }) {
  const target = path.resolve(targetRoot);
  const sources = sourceRoots.map((value) => path.resolve(value));
  if (!sources.length) throw new Error("At least one source audio root is required.");
  const targetManifestPath = path.join(target, "manifest.json");
  const manifest = await readJson(targetManifestPath);
  validateManifestShell(manifest, targetManifestPath);

  let copiedItems = 0;
  let copiedStages = 0;
  for (const source of sources) {
    const sourceManifestPath = path.join(source, "manifest.json");
    const incoming = await readJson(sourceManifestPath);
    validateManifestShell(incoming, sourceManifestPath);
    requireCompatible(manifest, incoming, sourceManifestPath);

    for (const [id, item] of Object.entries(incoming.items)) {
      const relative = safeRelative(item.path, `item ${id}`);
      const existing = manifest.items[id];
      if (existing && (existing.path !== item.path || existing.contentHash !== item.contentHash || existing.sha256 !== item.sha256)) {
        throw new Error(`Conflicting audio item ${id} from ${sourceManifestPath}.`);
      }
      await copyArtifact(source, target, relative);
      manifest.items[id] = item;
      copiedItems += 1;
    }

    for (const [stageId, stage] of Object.entries(incoming.stages)) {
      const timeline = safeRelative(stage.timelinePath, `stage ${stageId} timeline`);
      const existing = manifest.stages[stageId];
      if (existing && (existing.contentHash !== stage.contentHash || existing.timelinePath !== stage.timelinePath)) {
        throw new Error(`Conflicting audio stage ${stageId} from ${sourceManifestPath}.`);
      }
      await copyArtifact(source, target, timeline);
      manifest.stages[stageId] = stage;
      copiedStages += 1;
    }
  }

  manifest.generatedAt = new Date().toISOString();
  manifest.stats = calculateStats(manifest.items);
  await writeJsonAtomic(targetManifestPath, manifest);
  return { copiedItems, copiedStages, stats: manifest.stats, stageCount: Object.keys(manifest.stages).length };
}

function validateManifestShell(manifest, label) {
  if (manifest?.schemaVersion !== 1 || typeof manifest.contentVersion !== "string" || !manifest.items || !manifest.stages) {
    throw new Error(`Invalid audio manifest: ${label}`);
  }
}

function requireCompatible(target, incoming, label) {
  for (const field of ["contentVersion", "audioBaseUrl"]) {
    if (target[field] !== incoming[field]) throw new Error(`${label}: incompatible ${field}.`);
  }
  for (const field of ["generator", "voices"]) {
    if (canonicalJson(target[field]) !== canonicalJson(incoming[field])) throw new Error(`${label}: incompatible ${field}.`);
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function safeRelative(value, label) {
  const relative = String(value || "");
  if (!/^[a-z0-9][a-z0-9._/-]*\.(?:mp3|json)$/i.test(relative) || relative.includes("\\") || /(^|\/)\.\.(\/|$)/.test(relative)) {
    throw new Error(`${label}: unsafe artifact path ${JSON.stringify(value)}.`);
  }
  return relative;
}

async function copyArtifact(sourceRoot, targetRoot, relative) {
  const source = inside(sourceRoot, relative);
  const target = inside(targetRoot, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
}

function inside(root, relative) {
  const base = path.resolve(root);
  const candidate = path.resolve(base, ...relative.split("/"));
  if (!candidate.startsWith(`${base}${path.sep}`)) throw new Error(`Artifact escaped root: ${relative}`);
  return candidate;
}

function calculateStats(items) {
  const stats = { scene: 0, line: 0, option: 0, token: 0, durationSeconds: 0, bytes: 0 };
  for (const item of Object.values(items)) {
    if (!(item.type in stats) || ["durationSeconds", "bytes"].includes(item.type)) throw new Error(`Invalid audio type ${item.type}.`);
    stats[item.type] += 1;
    stats.durationSeconds += Number(item.durationSeconds || 0);
    stats.bytes += Number(item.bytes || 0);
  }
  stats.durationSeconds = Math.round(stats.durationSeconds * 1000) / 1000;
  return stats;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function writeJsonAtomic(file, value) {
  const temporary = `${file}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

function parseArgs(argv) {
  let targetRoot = "";
  const sourceRoots = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--target") targetRoot = argv[++index] || "";
    else if (argv[index] === "--source") sourceRoots.push(argv[++index] || "");
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (!targetRoot || sourceRoots.some((value) => !value)) throw new Error("Usage: --target <audio-root> --source <audio-root> [--source ...]");
  return { targetRoot, sourceRoots };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(scriptFile).href) {
  mergeAudioManifests(parseArgs(process.argv.slice(2)))
    .then((result) => console.log(`PASS: merged ${result.copiedItems} items / ${result.copiedStages} stages; target now has ${result.stageCount} stages.`))
    .catch((error) => { console.error(`FAIL: ${error.message}`); process.exitCode = 1; });
}
