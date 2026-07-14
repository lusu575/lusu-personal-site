import { createHash, randomBytes } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

import {
  acquireImage2OutputLock,
  assertExternalImage2OutputRoot,
  selectImage2GenerationJobs,
  validateImage2GenerationJob,
  validateImage2GenerationBundle,
} from "./generate-image2-assets.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const TOOL_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const BUILTIN_EVIDENCE_TYPE = "codex-builtin-imagegen-v1";
const BUILTIN_TOOL = "image_gen.imagegen";
const NORMALIZATION_SCHEMA_VERSION = "codex-builtin-imagegen-normalization-v1";
const STATE_SCHEMA_VERSION = 1;
const STAGE_MAX_ASPECT_RELATIVE_ERROR = 0.00001;
const BACKGROUND_MAX_ASPECT_RELATIVE_ERROR = 0.002;
const MAX_GENERATED_AT_MTIME_DRIFT_MS = 15 * 60 * 1000;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const TOOL_RUN_ID_PATTERN =
  /^exec-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REVIEW_CHECKS = Object.freeze([
  "promptRelevant",
  "compositionMatchesTask",
  "noAnswerLeak",
  "noReadableText",
  "noWatermark",
  "aspectRatioApproved",
]);

function reviewEvidenceFilename(selector) {
  if (/^L[1-5]-\d{3}$/.test(selector)) return `${selector.toLowerCase()}.json`;
  const background = /^background:(desktop|mobile)$/.exec(selector);
  if (background) return `background-${background[1]}.json`;
  fail("selector must be a stage ID or background:desktop/background:mobile");
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fail(message) {
  const error = new Error(message);
  error.name = "BuiltinImage2ImportError";
  throw error;
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim() === "" || value !== value.trim()) {
    fail(`${label} must be a non-empty trimmed string`);
  }
  return value;
}

function canonicalIsoDate(value, label) {
  const text = requiredString(value, label);
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== text) {
    fail(`${label} must be a canonical ISO timestamp`);
  }
  return parsed;
}

function parseSize(value, label = "job.size") {
  const match = /^(\d+)x(\d+)$/.exec(requiredString(value, label));
  if (!match) fail(`${label} must use WIDTHxHEIGHT`);
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    fail(`${label} contains invalid dimensions`);
  }
  return { width, height };
}

function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function readJsonl(filePath, label) {
  let source;
  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    fail(`Cannot read ${label}: ${error.message}`);
  }
  return source
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        fail(`${label} line ${index + 1} is invalid JSON: ${error.message}`);
      }
    });
}

async function inspectPng(value, label) {
  const bytes = Buffer.isBuffer(value) ? value : await readFile(value);
  if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    fail(`${label} must be a PNG`);
  }
  const image = sharp(bytes, { failOn: "error" });
  const metadata = await image.metadata();
  await image.clone().stats();
  if (metadata.format !== "png" || !metadata.width || !metadata.height) {
    fail(`${label} must decode as a non-empty PNG`);
  }
  return {
    bytes,
    width: metadata.width,
    height: metadata.height,
    sha256: sha256(bytes),
  };
}

function maximumAspectRelativeError(job) {
  return job.stageId
    ? STAGE_MAX_ASPECT_RELATIVE_ERROR
    : BACKGROUND_MAX_ASPECT_RELATIVE_ERROR;
}

function assertAspectRatio(source, target, maximumError, label) {
  const sourceRatio = source.width / source.height;
  const targetRatio = target.width / target.height;
  const relativeError = Math.abs(sourceRatio / targetRatio - 1);
  if (relativeError > maximumError) {
    fail(
      `${label} aspect ratio ${source.width}x${source.height} does not match target ${target.width}x${target.height}`,
    );
  }
  return relativeError;
}

async function normalizePng(source, target) {
  return sharp(source.bytes, { failOn: "error" })
    .flatten({ background: "#ffffff" })
    .resize(target.width, target.height, {
      fit: "fill",
      kernel: "lanczos3",
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function assertBuiltinSource(
  inputPath,
  generatedRoot,
  toolRunId,
  generatedAt,
  expectedOutput,
) {
  if (!TOOL_RUN_ID_PATTERN.test(toolRunId)) {
    fail("toolRunId must be the canonical exec UUID from the built-in image_gen output filename");
  }
  const input = path.resolve(requiredString(inputPath, "inputPath"));
  const generated = path.resolve(requiredString(generatedRoot, "generatedRoot"));
  const inputEntry = await lstat(input).catch((error) => {
    fail(`Cannot inspect built-in image_gen PNG: ${error.message}`);
  });
  if (!inputEntry.isFile() || inputEntry.isSymbolicLink()) {
    fail("built-in image_gen input must be a regular non-link file");
  }
  const [realInput, realGenerated] = await Promise.all([
    realpath(input),
    realpath(generated).catch((error) => {
      fail(`Cannot resolve generatedRoot: ${error.message}`);
    }),
  ]);
  if (!isInside(realGenerated, realInput)) {
    fail("built-in image_gen input must stay under the configured generated_images root");
  }
  const sourceBasename = path.basename(realInput);
  if (sourceBasename !== `${toolRunId}.png` && sourceBasename !== expectedOutput) {
    fail(
      "built-in image_gen PNG basename must match either toolRunId or the selected job output",
    );
  }
  const generatedDate = canonicalIsoDate(generatedAt, "generatedAt");
  const sourceStat = await stat(realInput);
  if (Math.abs(generatedDate.valueOf() - sourceStat.mtimeMs) > MAX_GENERATED_AT_MTIME_DRIFT_MS) {
    fail("generatedAt must be within 15 minutes of the built-in image_gen PNG mtime");
  }
  return { realInput, generatedDate, sourceStat };
}

function validateReviewEvidence(value, job, toolRunId, sourceSha256, generatedAt) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("reviewEvidence must be a JSON object");
  }
  const jobId = job.stageId ?? `background:${job.backgroundId}`;
  if (
    value.schemaVersion !== 1 ||
    value.status !== "codex-approved" ||
    value.jobId !== jobId ||
    value.toolRunId !== toolRunId ||
    value.sourceArtifactSha256 !== sourceSha256
  ) {
    fail("reviewEvidence must bind the selected job, toolRunId, and source PNG SHA-256");
  }
  const reviewedAt = canonicalIsoDate(value.reviewedAt, "reviewEvidence.reviewedAt");
  if (reviewedAt < generatedAt) {
    fail("reviewEvidence.reviewedAt must not predate the generated image");
  }
  const reviewer = requiredString(value.reviewer, "reviewEvidence.reviewer");
  if (reviewer.length > 120) fail("reviewEvidence.reviewer is too long");
  const keys = Object.keys(value.checks ?? {}).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...REVIEW_CHECKS].sort())) {
    fail(`reviewEvidence.checks must contain exactly: ${REVIEW_CHECKS.join(", ")}`);
  }
  for (const check of REVIEW_CHECKS) {
    if (value.checks[check] !== true) {
      fail(`reviewEvidence.checks.${check} must be true`);
    }
  }
  return structuredClone(value);
}

function stateMatchesImport(state, expected, normalized) {
  return (
    state?.schemaVersion === STATE_SCHEMA_VERSION &&
    state?.status === "complete" &&
    state?.evidenceType === BUILTIN_EVIDENCE_TYPE &&
    state?.stageId === (expected.job.stageId ?? null) &&
    state?.backgroundId === (expected.job.backgroundId ?? null) &&
    state?.out === expected.job.out &&
    state?.model === expected.job.model &&
    state?.quality === expected.job.quality &&
    state?.outputFormat === "png" &&
    state?.size === expected.job.size &&
    state?.width === normalized.width &&
    state?.height === normalized.height &&
    state?.bytes === normalized.bytes.length &&
    state?.sha256 === normalized.sha256 &&
    state?.promptHash === expected.job.promptHash &&
    state?.styleBibleHash === expected.job.styleBibleHash &&
    state?.sourceTextHash === (expected.job.sourceTextHash ?? null) &&
    state?.sourceTextHashSchemaVersion ===
      (expected.job.sourceTextHashSchemaVersion ?? null) &&
    state?.promptSchemaVersion === expected.job.generatorProvenance.promptSchemaVersion &&
    state?.generator?.provider === "OpenAI Images" &&
    state?.generator?.model === "gpt-image-2" &&
    state?.generator?.tool === BUILTIN_TOOL &&
    state?.generator?.toolRunId === expected.toolRunId &&
    state?.sourceArtifact?.sha256 === expected.source.sha256 &&
    state?.sourceArtifact?.bytes === expected.source.bytes.length &&
    state?.sourceArtifact?.width === expected.source.width &&
    state?.sourceArtifact?.height === expected.source.height &&
    state?.sourceArtifact?.filename === path.basename(expected.realInput) &&
    state?.reviewEvidenceSha256 === expected.reviewEvidenceSha256 &&
    canonicalJson(state?.reviewEvidence) === canonicalJson(expected.reviewEvidence) &&
    state?.normalization?.schemaVersion === NORMALIZATION_SCHEMA_VERSION &&
    state?.normalization?.targetWidth === normalized.width &&
    state?.normalization?.targetHeight === normalized.height &&
    !Object.hasOwn(state.generator, "endpoint") &&
    !Object.hasOwn(state.generator, "requestId") &&
    !Object.hasOwn(state.generator, "attempts")
  );
}

async function writeExclusive(filePath, value) {
  const handle = await open(filePath, "wx");
  try {
    await handle.writeFile(value);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function replaceFile(candidate, destination) {
  await rename(candidate, destination);
}

export async function loadImage2Jobs(options = {}) {
  const styleBiblePath = path.resolve(
    options.styleBiblePath ?? path.join(TOOL_ROOT, "image2", "style-bible.md"),
  );
  const stageJobsPath = path.resolve(
    options.stageJobsPath ?? path.join(TOOL_ROOT, "image2", "prompts.jsonl"),
  );
  const backgroundJobsPath = path.resolve(
    options.backgroundJobsPath ??
      path.join(TOOL_ROOT, "image2", "background-prompts.jsonl"),
  );
  const designIdentityRegistryPath = path.resolve(
    options.designIdentityRegistryPath ??
      path.join(TOOL_ROOT, "image2", "design-identities.json"),
  );
  const [
    styleBible,
    designIdentityRegistry,
    stageJobs,
    backgroundJobs,
  ] = await Promise.all([
    readFile(styleBiblePath, "utf8"),
    readFile(designIdentityRegistryPath, "utf8"),
    readJsonl(stageJobsPath, "stage image2 jobs"),
    readJsonl(backgroundJobsPath, "background image2 jobs"),
  ]);
  return validateImage2GenerationBundle(stageJobs, backgroundJobs, {
    styleBible,
    designIdentityRegistry,
  });
}

export async function importBuiltinImage2Asset(options) {
  const selector = requiredString(options.selector, "selector");
  const toolRunId = requiredString(options.toolRunId, "toolRunId");
  const generatedAt = requiredString(options.generatedAt, "generatedAt");
  const generatedRoot = path.resolve(
    options.generatedRoot ??
      path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "generated_images"),
  );
  const requestedOutputRoot = path.resolve(requiredString(options.outputRoot, "outputRoot"));
  const { outputRoot } = await assertExternalImage2OutputRoot(
    requestedOutputRoot,
    options.protectedRoot ?? TOOL_ROOT,
  );
  const jobs = options.jobs ?? (await loadImage2Jobs(options));
  const selected = selectImage2GenerationJobs(jobs, selector);
  if (selected.length !== 1) fail("selector must identify exactly one image2 job");
  const job = validateImage2GenerationJob(selected[0], `image2 job ${selector}`);
  const sourceContext = await assertBuiltinSource(
    options.inputPath,
    generatedRoot,
    toolRunId,
    generatedAt,
    job.out,
  );
  const source = await inspectPng(sourceContext.realInput, "built-in image_gen source");
  const reviewEvidencePath = path.resolve(
    options.reviewEvidencePath ??
      path.join(TOOL_ROOT, "image2", "reviews", reviewEvidenceFilename(selector)),
  );
  const reviewEvidenceValue = options.reviewEvidence ?? await readJson(reviewEvidencePath);
  const reviewEvidence = validateReviewEvidence(
    reviewEvidenceValue,
    job,
    toolRunId,
    source.sha256,
    sourceContext.generatedDate,
  );
  const reviewEvidenceSha256 = sha256(canonicalJson(reviewEvidence));
  const target = parseSize(job.size);
  const maximumAspectError = maximumAspectRelativeError(job);
  const aspectRelativeError = assertAspectRatio(
    source,
    target,
    maximumAspectError,
    "built-in image_gen source",
  );
  const normalizedBytes = await normalizePng(source, target);
  const normalized = await inspectPng(normalizedBytes, "normalized image2 PNG");
  if (normalized.width !== target.width || normalized.height !== target.height) {
    fail("normalized image2 PNG dimensions do not match the job target");
  }

  const destination = path.join(outputRoot, job.out);
  const stateRoot = path.join(outputRoot, ".image2-state");
  const statePath = path.join(stateRoot, `${job.out}.json`);
  const pendingStatePath = path.join(stateRoot, `${job.out}.pending.json`);
  const expected = {
    job,
    toolRunId,
    source,
    realInput: sourceContext.realInput,
    reviewEvidence,
    reviewEvidenceSha256,
  };
  const existingEntry = await lstat(destination).catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (existingEntry && (!existingEntry.isFile() || existingEntry.isSymbolicLink())) {
    fail("image2 import target must be a regular non-link file");
  }
  const existingState = await readJson(statePath);
  const pendingState = await readJson(pendingStatePath);
  const existingOutput = existingEntry
    ? await inspectPng(destination, "existing imported PNG").catch(() => null)
    : null;
  if (
    existingState &&
    existingOutput &&
    existingOutput.sha256 === normalized.sha256 &&
    stateMatchesImport(existingState, expected, normalized)
  ) {
    return { status: "reused", job, state: existingState };
  }
  if ((existingEntry || existingState || pendingState) && options.replace !== true) {
    fail("image2 import target is stale or unverifiable; rerun explicitly with --replace");
  }

  const state = {
    schemaVersion: STATE_SCHEMA_VERSION,
    status: "complete",
    evidenceType: BUILTIN_EVIDENCE_TYPE,
    generatedAt: sourceContext.generatedDate.toISOString(),
    stageId: job.stageId ?? null,
    backgroundId: job.backgroundId ?? null,
    out: job.out,
    model: job.model,
    quality: job.quality,
    outputFormat: "png",
    size: job.size,
    width: normalized.width,
    height: normalized.height,
    bytes: normalized.bytes.length,
    sha256: normalized.sha256,
    promptHash: job.promptHash,
    styleBibleHash: job.styleBibleHash,
    sourceTextHash: job.sourceTextHash ?? null,
    sourceTextHashSchemaVersion: job.sourceTextHashSchemaVersion ?? null,
    promptSchemaVersion: job.generatorProvenance.promptSchemaVersion,
    generator: {
      provider: "OpenAI Images",
      model: "gpt-image-2",
      tool: BUILTIN_TOOL,
      toolRunId,
    },
    reviewEvidence,
    reviewEvidenceSha256,
    sourceArtifact: {
      filename: path.basename(sourceContext.realInput),
      generatedAt: sourceContext.generatedDate.toISOString(),
      width: source.width,
      height: source.height,
      bytes: source.bytes.length,
      sha256: source.sha256,
    },
    normalization: {
      schemaVersion: NORMALIZATION_SCHEMA_VERSION,
      operation: "aspect-verified-resize",
      kernel: "lanczos3",
      sourceWidth: source.width,
      sourceHeight: source.height,
      targetWidth: target.width,
      targetHeight: target.height,
      maximumAspectRelativeError: maximumAspectError,
      observedAspectRelativeError: Number(aspectRelativeError.toFixed(9)),
    },
  };

  await mkdir(stateRoot, { recursive: true });
  const nonce = `${process.pid}-${randomBytes(6).toString("hex")}`;
  const imageCandidate = `${destination}.part-${nonce}`;
  const stateCandidate = `${pendingStatePath}.part-${nonce}`;
  try {
    await writeExclusive(imageCandidate, normalized.bytes);
    await inspectPng(imageCandidate, "image2 import candidate");
    await writeExclusive(
      stateCandidate,
      Buffer.from(`${JSON.stringify(state, null, 2)}\n`, "utf8"),
    );
    await replaceFile(stateCandidate, pendingStatePath);
    await replaceFile(imageCandidate, destination);
    await replaceFile(pendingStatePath, statePath);
  } finally {
    await rm(imageCandidate, { force: true });
    await rm(stateCandidate, { force: true });
  }
  return { status: "imported", job, state };
}

function usage() {
  return `Usage:
  node tools/japanese-subtext/scripts/import-builtin-image2-asset.mjs \\
    --selector <L1-001|background:desktop|background:mobile> \\
    --input <\$CODEX_HOME/generated_images/.../exec-uuid.png> \\
    --output-root <external-raw-png-root> \\
    --tool-run-id <exec-uuid> \\
    --generated-at <canonical-ISO-time> \\
    [--review-evidence <human-review.json>] [options]

Options:
  --generated-root <directory>  Default: \$CODEX_HOME/generated_images
  --review-evidence <file>      Default: image2/reviews/<job>.json
  --replace                     Replace a stale or intentionally regenerated job
  --recover-stale-lock          Recover a valid dead-owner raw-root lock
  --help                        Show this help

The importer never fabricates an OpenAI Images API endpoint or request ID. It
records evidenceType=${BUILTIN_EVIDENCE_TYPE} and tool=${BUILTIN_TOOL}. The
review JSON must bind the job, toolRunId, source SHA-256, reviewer, reviewedAt,
and six explicit Codex visual-review checks. The truthful status is codex-approved;
this importer does not represent a Codex review as human approval.`;
}

function parseCli(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true };
  const values = new Map();
  const flags = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (["--replace", "--recover-stale-lock"].includes(token)) {
      flags.add(token);
      continue;
    }
    if (!token.startsWith("--")) fail(`unexpected argument: ${token}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`${token} requires a value`);
    if (values.has(token)) fail(`${token} may be provided only once`);
    values.set(token, value);
    index += 1;
  }
  const required = (name) => requiredString(values.get(name), name);
  return {
    help: false,
    options: {
      selector: required("--selector"),
      inputPath: path.resolve(required("--input")),
      outputRoot: path.resolve(required("--output-root")),
      toolRunId: required("--tool-run-id"),
      generatedAt: required("--generated-at"),
      reviewEvidencePath: values.has("--review-evidence")
        ? path.resolve(values.get("--review-evidence"))
        : undefined,
      generatedRoot: values.has("--generated-root")
        ? path.resolve(values.get("--generated-root"))
        : undefined,
      replace: flags.has("--replace"),
      recoverStaleLock: flags.has("--recover-stale-lock"),
    },
  };
}

async function runCli() {
  const parsed = parseCli(process.argv.slice(2));
  if (parsed.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const outputRoot = path.resolve(parsed.options.outputRoot);
  const release = await acquireImage2OutputLock(outputRoot, {
    recoverStale: parsed.options.recoverStaleLock,
  });
  try {
    const result = await importBuiltinImage2Asset(parsed.options);
    process.stdout.write(
      `${JSON.stringify(
        {
          status: result.status,
          id: result.job.stageId ?? `background:${result.job.backgroundId}`,
          out: result.job.out,
          evidenceType: result.state.evidenceType,
          tool: result.state.generator.tool,
          sha256: result.state.sha256,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await release();
  }
}

const directInvocation = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;
if (directInvocation) {
  runCli().catch((error) => {
    console.error(`built-in image2 import failed: ${error.message}`);
    process.exitCode = 1;
  });
}
