import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import {
  acquireImage2OutputLock,
  validateImage2GenerationJob,
} from "./generate-image2-assets.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const TOOL_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const MODEL = "gpt-image-2";
const QUALITY = "high";
const CURRENT_CONTENT_VERSION = "1.0.3";
const CURRENT_MANIFEST_SCHEMA_VERSION = 3;
const GENERATION_STATE_SCHEMA_VERSION = 1;
const GENERATION_REQUEST_SCHEMA_VERSION = "openai-images-gpt-image-2-v1";
const API_EVIDENCE_TYPE = "openai-images-api-v1";
const BUILTIN_EVIDENCE_TYPE = "codex-builtin-imagegen-v1";
const BUILTIN_TOOL = "image_gen.imagegen";
const BUILTIN_NORMALIZATION_SCHEMA_VERSION =
  "codex-builtin-imagegen-normalization-v1";
const BUILTIN_STAGE_MAX_ASPECT_RELATIVE_ERROR = 0.00001;
const BUILTIN_BACKGROUND_MAX_ASPECT_RELATIVE_ERROR = 0.002;
const TOOL_RUN_ID_PATTERN =
  /^exec-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUILTIN_REVIEW_CHECKS = Object.freeze([
  "promptRelevant",
  "compositionMatchesTask",
  "noAnswerLeak",
  "noReadableText",
  "noWatermark",
  "aspectRatioApproved",
]);

function builtinMaximumAspectRelativeError(job) {
  return job.stageId
    ? BUILTIN_STAGE_MAX_ASPECT_RELATIVE_ERROR
    : BUILTIN_BACKGROUND_MAX_ASPECT_RELATIVE_ERROR;
}
const PUBLICATION_JOURNAL_SCHEMA_VERSION = 1;
const SOURCE_TEXT_HASH_SCHEMA_VERSION =
  "japanese-subtext-image-source-text-v1";
const STAGE_PROMPT_SCHEMA_VERSION = "japanese-subtext-image2-prompt-v4";
const STAGE_SOURCE_SIZE = Object.freeze({ width: 1536, height: 1152 });
const STAGE_PUBLISHED_SIZE = Object.freeze({ width: 960, height: 720 });
const BACKGROUND_SPECS = Object.freeze({
  desktop: Object.freeze({
    out: "japanese-subtext-background-desktop.png",
    publishedFile: "trainer-backdrop-desktop.webp",
    width: 2048,
    height: 1152,
  }),
  mobile: Object.freeze({
    out: "japanese-subtext-background-mobile.png",
    publishedFile: "trainer-backdrop-mobile.webp",
    width: 1024,
    height: 1536,
  }),
});
const FORBIDDEN_GENERATOR_METADATA = Object.freeze([
  ["local-fallback", /local[-_\s]?fallback/i],
  ["CSS", /css/i],
  ["SVG", /svg/i],
]);
const FORBIDDEN_CREDENTIAL_METADATA =
  /api.?key|authorization|bearer\s+sk-|\bsk-[A-Za-z0-9._-]+/i;

function fail(message) {
  throw new Error(message);
}

function sha256(bufferOrText) {
  return createHash("sha256").update(bufferOrText).digest("hex");
}

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

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isCanonicalIsoDate(value) {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}

function containsForbiddenCredentialMetadata(value) {
  if (typeof value === "string") {
    return FORBIDDEN_CREDENTIAL_METADATA.test(value);
  }
  if (Array.isArray(value)) {
    return value.some((entry) => containsForbiddenCredentialMetadata(entry));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, entry]) =>
        FORBIDDEN_CREDENTIAL_METADATA.test(key) ||
        containsForbiddenCredentialMetadata(entry),
    );
  }
  return false;
}

function asPositiveInteger(value, label, { minimum = 1, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    fail(`${label} must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim() === "") fail(`${label} is required`);
  return value.trim();
}

function normalizeRelative(value, label) {
  const normalized = requiredString(value, label).replaceAll("\\", "/");
  if (
    path.posix.isAbsolute(normalized) ||
    normalized.split("/").some((part) => part === ".." || part === "")
  ) {
    fail(`${label} must be a safe relative path`);
  }
  return normalized;
}

function resolveInside(root, relativePath, label) {
  const normalized = normalizeRelative(relativePath, label);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...normalized.split("/"));
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    fail(`${label} resolves outside its root`);
  }
  return resolved;
}

function publicPath(publicRoot, absolutePath, label) {
  const relative = path.relative(path.resolve(publicRoot), path.resolve(absolutePath));
  if (!relative || relative === "." || relative.startsWith("..") || path.isAbsolute(relative)) {
    fail(`${label} must be inside publicRoot`);
  }
  return relative.replaceAll("\\", "/");
}

function canonicalStageIds() {
  return Array.from({ length: 5 }, (_, levelIndex) =>
    Array.from(
      { length: 50 },
      (_, stageIndex) =>
        `L${levelIndex + 1}-${String(stageIndex + 1).padStart(3, "0")}`,
    ),
  ).flat();
}

async function readJson(filePath, label) {
  let value;
  try {
    value = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    fail(`Cannot read ${label} at ${filePath}: ${error.message}`);
  }
  return value;
}

async function readJsonl(filePath, label) {
  let source;
  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    fail(`Cannot read ${label} at ${filePath}: ${error.message}`);
  }
  const lines = source.split(/\r?\n/).filter((line) => line.trim() !== "");
  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      fail(`${label} line ${index + 1} is not valid JSON: ${error.message}`);
    }
  });
}

function generatorMetadata(job) {
  const {
    prompt,
    out,
    stageId,
    backgroundId,
    sourceTextHash,
    sourceTextHashSchemaVersion,
    sourceContentHash,
    promptHash,
    styleBibleHash,
    castDesigns,
    ...metadata
  } = job;
  return metadata;
}

function assertGeneratorMetadata(metadata, label) {
  const serialized = JSON.stringify(metadata);
  for (const [name, pattern] of FORBIDDEN_GENERATOR_METADATA) {
    if (pattern.test(serialized)) fail(`${label} contains forbidden ${name} generator metadata`);
  }
}

function assertBaseJob(job, label, styleBibleHash) {
  if (job.model !== MODEL) fail(`${label}.model must be ${MODEL}`);
  if (job.quality !== QUALITY) fail(`${label}.quality must be ${QUALITY}`);
  if (job.output_format !== "png") fail(`${label}.output_format must be png`);
  if (job.n !== 1) fail(`${label}.n must be 1`);
  if (job.generatorProvenance?.provider !== "OpenAI Images") {
    fail(`${label}.generatorProvenance.provider must be OpenAI Images`);
  }
  if (job.generatorProvenance?.model !== MODEL) {
    fail(`${label}.generatorProvenance.model must be ${MODEL}`);
  }
  if (job.generatorProvenance?.operation !== "generate") {
    fail(`${label}.generatorProvenance.operation must be generate`);
  }
  const prompt = requiredString(job.prompt, `${label}.prompt`);
  if (job.promptHash !== sha256(prompt)) fail(`${label}.promptHash does not match prompt`);
  if (job.styleBibleHash !== styleBibleHash) {
    fail(`${label}.styleBibleHash does not match style-bible.md`);
  }
  assertGeneratorMetadata(generatorMetadata(job), label);
}

function stageSourceReference(job, label) {
  const hasSourceTextHash = Object.hasOwn(job, "sourceTextHash");
  const hasLegacyContentHash = Object.hasOwn(job, "sourceContentHash");
  if (hasSourceTextHash && hasLegacyContentHash) {
    fail(`${label} must not mix sourceTextHash with legacy sourceContentHash`);
  }
  if (hasSourceTextHash) {
    if (!isSha256(job.sourceTextHash)) fail(`${label}.sourceTextHash is invalid`);
    if (
      job.generatorProvenance?.promptSchemaVersion !==
      STAGE_PROMPT_SCHEMA_VERSION
    ) {
      fail(`${label}.sourceTextHash requires prompt schema v4`);
    }
    if (job.sourceTextHashSchemaVersion !== SOURCE_TEXT_HASH_SCHEMA_VERSION) {
      fail(
        `${label}.sourceTextHashSchemaVersion must be ${SOURCE_TEXT_HASH_SCHEMA_VERSION}`,
      );
    }
    if (job.generatorProvenance?.sourceHashField !== "sourceTextHash") {
      fail(`${label}.generatorProvenance.sourceHashField must be sourceTextHash`);
    }
    if (
      job.generatorProvenance?.sourceHashSchemaVersion !==
      SOURCE_TEXT_HASH_SCHEMA_VERSION
    ) {
      fail(
        `${label}.generatorProvenance.sourceHashSchemaVersion must be ${SOURCE_TEXT_HASH_SCHEMA_VERSION}`,
      );
    }
    return {
      sourceHashKind: "stage-source-text",
      sourceTextHash: job.sourceTextHash,
      sourceTextHashSchemaVersion: job.sourceTextHashSchemaVersion,
    };
  }
  if (hasLegacyContentHash) {
    if (!isSha256(job.sourceContentHash)) {
      fail(`${label}.sourceContentHash is invalid`);
    }
    if (
      job.generatorProvenance?.promptSchemaVersion ===
      STAGE_PROMPT_SCHEMA_VERSION
    ) {
      fail(`${label} v4 prompt jobs must use sourceTextHash`);
    }
    if (
      job.generatorProvenance?.sourceHashField !== undefined &&
      job.generatorProvenance.sourceHashField !== "sourceContentHash"
    ) {
      fail(
        `${label}.generatorProvenance.sourceHashField must be sourceContentHash for a legacy job`,
      );
    }
    return {
      sourceHashKind: "legacy-stage-content",
      sourceContentHash: job.sourceContentHash,
    };
  }
  fail(`${label} must include sourceTextHash`);
}

function assertManifestStageSource(entry, job, label) {
  const expected = stageSourceReference(job, label);
  for (const [key, value] of Object.entries(expected)) {
    if (entry[key] !== value) fail(`${label}.${key} does not match prompt job`);
  }
  if (expected.sourceHashKind === "stage-source-text") {
    if (Object.hasOwn(entry, "sourceContentHash")) {
      fail(`${label} must not retain obsolete sourceContentHash`);
    }
  } else if (
    Object.hasOwn(entry, "sourceTextHash") ||
    Object.hasOwn(entry, "sourceTextHashSchemaVersion")
  ) {
    fail(`${label} must not label a legacy hash as sourceTextHash`);
  }
}

function assertStageJobs(
  jobs,
  expectedStageIds,
  styleBibleHash,
  designIdentityRegistryHash,
) {
  if (jobs.length !== expectedStageIds.length) {
    fail(`Stage jobs must contain exactly ${expectedStageIds.length} entries; found ${jobs.length}`);
  }
  const seenIds = new Set();
  const seenOutputs = new Set();
  jobs.forEach((job, index) => {
    const label = `stage job ${index + 1}`;
    assertBaseJob(job, label, styleBibleHash);
    if (
      job.generatorProvenance?.promptSchemaVersion ===
      STAGE_PROMPT_SCHEMA_VERSION
    ) {
      validateImage2GenerationJob(job, label);
    }
    if (
      job.generatorProvenance?.promptSchemaVersion ===
        STAGE_PROMPT_SCHEMA_VERSION &&
      job.generatorProvenance?.designIdentityRegistrySha256 !==
        designIdentityRegistryHash
    ) {
      fail(
        `${label} design identity registry hash does not match design-identities.json`,
      );
    }
    const expectedId = expectedStageIds[index];
    if (job.stageId !== expectedId) fail(`${label}.stageId must be ${expectedId}`);
    if (!/^L[1-5]-\d{3}$/.test(job.stageId)) fail(`${label}.stageId is invalid`);
    if (seenIds.has(job.stageId)) fail(`${label}.stageId is duplicated`);
    seenIds.add(job.stageId);
    if (job.size !== "1536x1152") fail(`${label}.size must be 1536x1152`);
    const output = normalizeRelative(job.out, `${label}.out`);
    if (output !== `${job.stageId.toLowerCase()}.png`) {
      fail(`${label}.out must correspond exactly to ${job.stageId.toLowerCase()}.png`);
    }
    if (seenOutputs.has(output)) fail(`${label}.out is duplicated`);
    seenOutputs.add(output);
    stageSourceReference(job, label);
  });
}

function assertBackgroundJobs(jobs, styleBibleHash) {
  const expectedIds = Object.keys(BACKGROUND_SPECS);
  if (jobs.length !== expectedIds.length) {
    fail(`Background jobs must contain exactly ${expectedIds.length} entries; found ${jobs.length}`);
  }
  const seenIds = new Set();
  const seenOutputs = new Set();
  jobs.forEach((job, index) => {
    const label = `background job ${index + 1}`;
    assertBaseJob(job, label, styleBibleHash);
    validateImage2GenerationJob(job, label);
    const expectedId = expectedIds[index];
    if (job.backgroundId !== expectedId) fail(`${label}.backgroundId must be ${expectedId}`);
    if (seenIds.has(job.backgroundId)) fail(`${label}.backgroundId is duplicated`);
    seenIds.add(job.backgroundId);
    const spec = BACKGROUND_SPECS[job.backgroundId];
    const output = normalizeRelative(job.out, `${label}.out`);
    if (output !== spec.out) fail(`${label}.out must be ${spec.out}`);
    if (seenOutputs.has(output)) fail(`${label}.out is duplicated`);
    seenOutputs.add(output);
    if (job.size !== `${spec.width}x${spec.height}`) {
      fail(`${label}.size must be ${spec.width}x${spec.height}`);
    }
  });
}

function assertBackgroundPromptManifest(manifest, jobs, styleBibleHash) {
  if (manifest.jobCount !== 2) fail("Background prompt manifest jobCount must be 2");
  if (manifest.model !== MODEL) fail(`Background prompt manifest model must be ${MODEL}`);
  if (manifest.quality !== QUALITY) fail(`Background prompt manifest quality must be ${QUALITY}`);
  if (manifest.styleBibleHash !== styleBibleHash) {
    fail("Background prompt manifest styleBibleHash does not match style-bible.md");
  }
  if (!Array.isArray(manifest.jobs) || manifest.jobs.length !== jobs.length) {
    fail("Background prompt manifest jobs do not match background jobs JSONL");
  }
  jobs.forEach((job, index) => {
    const entry = manifest.jobs[index];
    for (const key of ["backgroundId", "out", "size", "promptHash", "styleBibleHash"]) {
      if (entry?.[key] !== job[key]) {
        fail(`Background prompt manifest job ${index + 1}.${key} does not match JSONL`);
      }
    }
  });
  assertGeneratorMetadata(
    {
      model: manifest.model,
      quality: manifest.quality,
      generatorProvenance: manifest.generatorProvenance,
    },
    "background prompt manifest",
  );
}

async function listFiles(root) {
  const found = [];
  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      fail(`Cannot read input directory ${directory}: ${error.message}`);
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) found.push(absolute);
    }
  }
  await visit(path.resolve(root));
  return found;
}

async function assertExactPngSet(pngRoot, jobs) {
  const expected = jobs.map((job) => normalizeRelative(job.out, "job.out")).sort();
  const actual = (await listFiles(pngRoot))
    .filter((filePath) => path.extname(filePath).toLowerCase() === ".png")
    .map((filePath) => path.relative(path.resolve(pngRoot), filePath).replaceAll("\\", "/"))
    .sort();
  const missing = expected.filter((file) => !actual.includes(file));
  const orphans = actual.filter((file) => !expected.includes(file));
  if (missing.length || orphans.length) {
    fail(
      `PNG job correspondence failed; missing: ${missing.join(", ") || "none"}; orphan: ${orphans.join(", ") || "none"}`,
    );
  }
}

async function assertExactGenerationStateSet(stateRoot, jobs) {
  const expected = jobs.map((job) => `${normalizeRelative(job.out, "job.out")}.json`).sort();
  const actual = (await listFiles(stateRoot))
    .filter((filePath) => path.extname(filePath).toLowerCase() === ".json")
    .map((filePath) => path.relative(path.resolve(stateRoot), filePath).replaceAll("\\", "/"))
    .sort();
  const missing = expected.filter((file) => !actual.includes(file));
  const orphans = actual.filter((file) => !expected.includes(file));
  if (missing.length || orphans.length) {
    fail(
      `Generation state correspondence failed; missing: ${missing.join(", ") || "none"}; orphan: ${orphans.join(", ") || "none"}`,
    );
  }
}

function assertGenerationEvidenceShape(evidence, job, label) {
  if (
    evidence?.stateSchemaVersion !== GENERATION_STATE_SCHEMA_VERSION ||
    !isSha256(evidence?.stateSha256) ||
    evidence?.provider !== "OpenAI Images" ||
    evidence?.model !== MODEL ||
    !isCanonicalIsoDate(evidence?.generatedAt) ||
    evidence?.promptSchemaVersion !== job.generatorProvenance?.promptSchemaVersion
  ) {
    fail(`${label} generationEvidence is invalid or does not match the prompt job`);
  }
  if (evidence.evidenceType === API_EVIDENCE_TYPE) {
    if (
      evidence.requestSchemaVersion !== GENERATION_REQUEST_SCHEMA_VERSION ||
      evidence.endpoint !== "/v1/images/generations" ||
      typeof evidence.requestId !== "string" ||
      !/^req[_-][A-Za-z0-9_-]{4,}$/.test(evidence.requestId) ||
      !Number.isInteger(evidence.attempts) ||
      evidence.attempts < 1 ||
      evidence.attempts > 8 ||
      Object.hasOwn(evidence, "tool") ||
      Object.hasOwn(evidence, "toolRunId") ||
      Object.hasOwn(evidence, "sourceArtifactSha256") ||
      Object.hasOwn(evidence, "normalizationSchemaVersion")
    ) {
      fail(`${label} API generationEvidence is invalid or mixes built-in tool evidence`);
    }
    return;
  }
  if (evidence.evidenceType === BUILTIN_EVIDENCE_TYPE) {
    if (
      evidence.tool !== BUILTIN_TOOL ||
      !TOOL_RUN_ID_PATTERN.test(evidence.toolRunId ?? "") ||
      !isSha256(evidence.sourceArtifactSha256) ||
      !Number.isSafeInteger(evidence.sourceArtifactBytes) ||
      evidence.sourceArtifactBytes <= 0 ||
      !Number.isSafeInteger(evidence.sourceArtifactWidth) ||
      evidence.sourceArtifactWidth <= 0 ||
      !Number.isSafeInteger(evidence.sourceArtifactHeight) ||
      evidence.sourceArtifactHeight <= 0 ||
      evidence.normalizationSchemaVersion !== BUILTIN_NORMALIZATION_SCHEMA_VERSION ||
      evidence.normalizationOperation !== "aspect-verified-resize" ||
      evidence.normalizationKernel !== "lanczos3" ||
      evidence.reviewStatus !== "codex-approved" ||
      !isCanonicalIsoDate(evidence.reviewedAt) ||
      typeof evidence.reviewer !== "string" ||
      evidence.reviewer.trim() === "" ||
      !isSha256(evidence.reviewEvidenceSha256) ||
      Object.hasOwn(evidence, "requestSchemaVersion") ||
      Object.hasOwn(evidence, "endpoint") ||
      Object.hasOwn(evidence, "requestId") ||
      Object.hasOwn(evidence, "attempts")
    ) {
      fail(`${label} built-in generationEvidence is invalid or mixes API request evidence`);
    }
    return;
  }
  fail(`${label} generationEvidence has an unsupported evidenceType`);
}

async function generationEvidence(config, job, original, label) {
  const statePath = resolveInside(config.generationStateRoot, `${job.out}.json`, `${label}.state`);
  const source = await readFile(statePath, "utf8").catch((error) => {
    fail(`Cannot read ${label} generation state sidecar: ${error.message}`);
  });
  let state;
  try {
    state = JSON.parse(source);
  } catch (error) {
    fail(`${label} generation state sidecar is not valid JSON: ${error.message}`);
  }
  if (
    FORBIDDEN_CREDENTIAL_METADATA.test(source) ||
    containsForbiddenCredentialMetadata(state)
  ) {
    fail(`${label} generation state sidecar contains forbidden credential metadata`);
  }
  const expected = {
    schemaVersion: GENERATION_STATE_SCHEMA_VERSION,
    status: "complete",
    stageId: job.stageId ?? null,
    backgroundId: job.backgroundId ?? null,
    out: job.out,
    model: MODEL,
    quality: QUALITY,
    outputFormat: "png",
    size: job.size,
    width: original.width,
    height: original.height,
    bytes: original.bytes,
    sha256: original.sha256,
    promptHash: job.promptHash,
    styleBibleHash: job.styleBibleHash,
    sourceTextHash: job.sourceTextHash ?? null,
    sourceTextHashSchemaVersion: job.sourceTextHashSchemaVersion ?? null,
    sourceContentHash: job.sourceContentHash ?? null,
    promptSchemaVersion: job.generatorProvenance?.promptSchemaVersion,
  };
  for (const [key, value] of Object.entries(expected)) {
    const actual = key === "sourceContentHash" && !Object.hasOwn(state, key) ? null : state?.[key];
    if (actual !== value) fail(`${label} generation state ${key} does not match the PNG job`);
  }
  if (!isCanonicalIsoDate(state?.generatedAt)) {
    fail(`${label} generation state generatedAt is invalid`);
  }
  let evidence;
  if (state.evidenceType === API_EVIDENCE_TYPE) {
    if (
      state.requestSchemaVersion !== GENERATION_REQUEST_SCHEMA_VERSION ||
      state?.generator?.provider !== "OpenAI Images" ||
      state?.generator?.model !== MODEL ||
      state?.generator?.endpoint !== "/v1/images/generations" ||
      typeof state?.generator?.requestId !== "string" ||
      !/^req[_-][A-Za-z0-9_-]{4,}$/.test(state.generator.requestId) ||
      !Number.isInteger(state?.generator?.attempts) ||
      state.generator.attempts < 1 ||
      state.generator.attempts > 8 ||
      Object.hasOwn(state.generator, "tool") ||
      Object.hasOwn(state.generator, "toolRunId") ||
      Object.hasOwn(state, "sourceArtifact") ||
      Object.hasOwn(state, "normalization")
    ) {
      fail(`${label} API generation state is invalid or mixes built-in evidence`);
    }
    evidence = {
      evidenceType: API_EVIDENCE_TYPE,
      stateSchemaVersion: state.schemaVersion,
      stateSha256: sha256(source),
      requestSchemaVersion: state.requestSchemaVersion,
      provider: state.generator.provider,
      model: state.generator.model,
      endpoint: state.generator.endpoint,
      requestId: state.generator.requestId,
      generatedAt: state.generatedAt,
      attempts: state.generator.attempts,
      promptSchemaVersion: state.promptSchemaVersion,
    };
  } else if (state.evidenceType === BUILTIN_EVIDENCE_TYPE) {
    const sourceArtifact = state.sourceArtifact;
    const normalization = state.normalization;
    const reviewEvidence = state.reviewEvidence;
    const reviewJobId = job.stageId ?? `background:${job.backgroundId}`;
    const reviewKeys = Object.keys(reviewEvidence?.checks ?? {}).sort();
    if (
      state?.generator?.provider !== "OpenAI Images" ||
      state?.generator?.model !== MODEL ||
      state?.generator?.tool !== BUILTIN_TOOL ||
      !TOOL_RUN_ID_PATTERN.test(state?.generator?.toolRunId ?? "") ||
      ![`${state.generator.toolRunId}.png`, job.out].includes(sourceArtifact?.filename) ||
      sourceArtifact?.generatedAt !== state.generatedAt ||
      !Number.isSafeInteger(sourceArtifact?.width) ||
      sourceArtifact.width <= 0 ||
      !Number.isSafeInteger(sourceArtifact?.height) ||
      sourceArtifact.height <= 0 ||
      !Number.isSafeInteger(sourceArtifact?.bytes) ||
      sourceArtifact.bytes <= 0 ||
      !isSha256(sourceArtifact?.sha256) ||
      normalization?.schemaVersion !== BUILTIN_NORMALIZATION_SCHEMA_VERSION ||
      normalization?.operation !== "aspect-verified-resize" ||
      normalization?.kernel !== "lanczos3" ||
      normalization?.sourceWidth !== sourceArtifact.width ||
      normalization?.sourceHeight !== sourceArtifact.height ||
      normalization?.targetWidth !== original.width ||
      normalization?.targetHeight !== original.height ||
      normalization?.maximumAspectRelativeError !==
        builtinMaximumAspectRelativeError(job) ||
      typeof normalization?.observedAspectRelativeError !== "number" ||
      normalization.observedAspectRelativeError < 0 ||
      normalization.observedAspectRelativeError >
        normalization?.maximumAspectRelativeError ||
      reviewEvidence?.schemaVersion !== 1 ||
      reviewEvidence?.status !== "codex-approved" ||
      reviewEvidence?.jobId !== reviewJobId ||
      reviewEvidence?.toolRunId !== state.generator.toolRunId ||
      reviewEvidence?.sourceArtifactSha256 !== sourceArtifact.sha256 ||
      !isCanonicalIsoDate(reviewEvidence?.reviewedAt) ||
      new Date(reviewEvidence.reviewedAt) < new Date(state.generatedAt) ||
      typeof reviewEvidence?.reviewer !== "string" ||
      reviewEvidence.reviewer.trim() === "" ||
      reviewEvidence.reviewer.length > 120 ||
      JSON.stringify(reviewKeys) !==
        JSON.stringify([...BUILTIN_REVIEW_CHECKS].sort()) ||
      BUILTIN_REVIEW_CHECKS.some((check) => reviewEvidence.checks[check] !== true) ||
      state.reviewEvidenceSha256 !== sha256(canonicalJson(reviewEvidence)) ||
      Object.hasOwn(state, "requestSchemaVersion") ||
      Object.hasOwn(state.generator, "endpoint") ||
      Object.hasOwn(state.generator, "requestId") ||
      Object.hasOwn(state.generator, "attempts") ||
      Object.hasOwn(state, "revisedPromptSha256") ||
      Object.hasOwn(state, "usage")
    ) {
      fail(`${label} built-in generation state is invalid or mixes API request evidence`);
    }
    evidence = {
      evidenceType: BUILTIN_EVIDENCE_TYPE,
      stateSchemaVersion: state.schemaVersion,
      stateSha256: sha256(source),
      provider: state.generator.provider,
      model: state.generator.model,
      tool: state.generator.tool,
      toolRunId: state.generator.toolRunId,
      generatedAt: state.generatedAt,
      promptSchemaVersion: state.promptSchemaVersion,
      sourceArtifactSha256: sourceArtifact.sha256,
      sourceArtifactBytes: sourceArtifact.bytes,
      sourceArtifactWidth: sourceArtifact.width,
      sourceArtifactHeight: sourceArtifact.height,
      normalizationSchemaVersion: normalization.schemaVersion,
      normalizationOperation: normalization.operation,
      normalizationKernel: normalization.kernel,
      reviewStatus: reviewEvidence.status,
      reviewedAt: reviewEvidence.reviewedAt,
      reviewer: reviewEvidence.reviewer,
      reviewEvidenceSha256: state.reviewEvidenceSha256,
    };
  } else {
    fail(`${label} generation state evidenceType is unsupported`);
  }
  assertGenerationEvidenceShape(evidence, job, label);
  return evidence;
}

async function assertPublishedOutputSet(stageOutRoot, backgroundOutRoot, stageJobs) {
  const expectedStages = stageJobs.map((job) => `${job.stageId.toLowerCase()}.webp`).sort();
  const actualStages = (await listFiles(stageOutRoot))
    .filter((filePath) => path.extname(filePath).toLowerCase() === ".webp")
    .map((filePath) =>
      path.relative(stageOutRoot, filePath).replaceAll("\\", "/"),
    )
    .sort();
  const missingStages = expectedStages.filter((file) => !actualStages.includes(file));
  const orphanStages = actualStages.filter((file) => !expectedStages.includes(file));
  if (missingStages.length) fail(`Missing published stage WebP: ${missingStages.join(", ")}`);
  if (orphanStages.length) fail(`Orphan published stage WebP: ${orphanStages.join(", ")}`);

  const expectedBackgrounds = Object.values(BACKGROUND_SPECS)
    .map((spec) => spec.publishedFile)
    .sort();
  const actualBackgrounds = (await listFiles(backgroundOutRoot))
    .filter((filePath) => /^trainer-backdrop-.*\.webp$/i.test(path.basename(filePath)))
    .map((filePath) =>
      path.relative(backgroundOutRoot, filePath).replaceAll("\\", "/"),
    )
    .sort();
  const missingBackgrounds = expectedBackgrounds.filter(
    (file) => !actualBackgrounds.includes(file),
  );
  const orphanBackgrounds = actualBackgrounds.filter(
    (file) => !expectedBackgrounds.includes(file),
  );
  if (missingBackgrounds.length) {
    fail(`Missing published background WebP: ${missingBackgrounds.join(", ")}`);
  }
  if (orphanBackgrounds.length) {
    fail(`Orphan published background WebP: ${orphanBackgrounds.join(", ")}`);
  }
}

async function inspectRaster(filePath, expected, label) {
  const buffer = Buffer.isBuffer(filePath) ? filePath : await readFile(filePath);
  const metadata = await sharp(buffer).metadata();
  if (metadata.format !== expected.format) fail(`${label} must be ${expected.format}`);
  if (metadata.width !== expected.width || metadata.height !== expected.height) {
    fail(
      `${label} must be ${expected.width}x${expected.height}; found ${metadata.width}x${metadata.height}`,
    );
  }
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    sha256: sha256(buffer),
    bytes: buffer.byteLength,
  };
}

async function differenceHash(filePath) {
  const input = Buffer.isBuffer(filePath) ? filePath : await readFile(filePath);
  const { data } = await sharp(input)
    .greyscale()
    .resize(9, 8, { fit: "fill", kernel: "nearest" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let value = 0n;
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const offset = row * 9 + column;
      value = (value << 1n) | BigInt(data[offset] > data[offset + 1] ? 1 : 0);
    }
  }
  return value.toString(16).padStart(16, "0");
}

function hammingDistance(left, right) {
  let bits = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let count = 0;
  while (bits) {
    count += Number(bits & 1n);
    bits >>= 1n;
  }
  return count;
}

function nearDuplicateReport(stages, threshold) {
  const pairs = [];
  for (let left = 0; left < stages.length; left += 1) {
    for (let right = left + 1; right < stages.length; right += 1) {
      const distance = hammingDistance(stages[left].dHash, stages[right].dHash);
      if (distance <= threshold) {
        pairs.push({
          leftStageId: stages[left].stageId,
          rightStageId: stages[right].stageId,
          distance,
        });
      }
    }
  }
  return {
    algorithm: "dhash-8x8-horizontal",
    threshold,
    action: "report-only",
    pairCount: pairs.length,
    pairs,
  };
}

function normalizedConfig(options) {
  const contentVersion = requiredString(options.contentVersion, "contentVersion");
  if (!/^\d+\.\d+\.\d+$/.test(contentVersion)) fail("contentVersion must be x.y.z semver");
  const schemaVersion = asPositiveInteger(
    options.schemaVersion ?? (contentVersion === CURRENT_CONTENT_VERSION
      ? CURRENT_MANIFEST_SCHEMA_VERSION
      : 1),
    "schemaVersion",
  );
  if (
    contentVersion === CURRENT_CONTENT_VERSION
    && schemaVersion !== CURRENT_MANIFEST_SCHEMA_VERSION
  ) {
    fail(`Content ${CURRENT_CONTENT_VERSION} requires manifest schemaVersion ${CURRENT_MANIFEST_SCHEMA_VERSION}`);
  }
  const reviewStatus = requiredString(
    options.reviewStatus ?? "pending-codex-review",
    "reviewStatus",
  );
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(reviewStatus)) {
    fail("reviewStatus must be a lowercase hyphenated token");
  }
  const verifyOriginals = options.verifyOriginals !== false;
  return {
    schemaVersion,
    contentVersion,
    reviewStatus,
    webpQuality: asPositiveInteger(options.webpQuality ?? 86, "webpQuality", {
      minimum: 1,
      maximum: 100,
    }),
    nearDuplicateThreshold: asPositiveInteger(
      options.nearDuplicateThreshold ?? 6,
      "nearDuplicateThreshold",
      { minimum: 0, maximum: 64 },
    ),
    verifyOriginals,
    pngRoot: verifyOriginals
      ? path.resolve(requiredString(options.pngRoot, "pngRoot"))
      : path.resolve(options.pngRoot || TOOL_ROOT),
    generationStateRoot: verifyOriginals
      ? path.resolve(
          options.generationStateRoot ||
            path.join(path.resolve(requiredString(options.pngRoot, "pngRoot")), ".image2-state"),
        )
      : path.resolve(options.generationStateRoot || TOOL_ROOT),
    publicRoot: path.resolve(requiredString(options.publicRoot, "publicRoot")),
    stageOutRoot: path.resolve(requiredString(options.stageOutRoot, "stageOutRoot")),
    backgroundOutRoot: path.resolve(
      requiredString(options.backgroundOutRoot, "backgroundOutRoot"),
    ),
    manifestPath: path.resolve(requiredString(options.manifestPath, "manifestPath")),
    styleBiblePath: path.resolve(requiredString(options.styleBiblePath, "styleBiblePath")),
    designIdentityRegistryPath: path.resolve(
      options.designIdentityRegistryPath ||
        path.join(TOOL_ROOT, "image2", "design-identities.json"),
    ),
    stageJobsPath: path.resolve(requiredString(options.stageJobsPath, "stageJobsPath")),
    backgroundJobsPath: path.resolve(
      requiredString(options.backgroundJobsPath, "backgroundJobsPath"),
    ),
    backgroundJobsManifestPath: path.resolve(
      requiredString(options.backgroundJobsManifestPath, "backgroundJobsManifestPath"),
    ),
    expectedStageIds: options.expectedStageIds ?? canonicalStageIds(),
  };
}

async function loadBundle(config) {
  const styleBible = await readFile(config.styleBiblePath, "utf8");
  const styleBibleHash = sha256(styleBible);
  const designIdentityRegistry = await readFile(
    config.designIdentityRegistryPath,
    "utf8",
  );
  const designIdentityRegistryHash = sha256(designIdentityRegistry);
  const stageJobs = await readJsonl(config.stageJobsPath, "stage jobs JSONL");
  const backgroundJobs = await readJsonl(config.backgroundJobsPath, "background jobs JSONL");
  const backgroundPromptManifest = await readJson(
    config.backgroundJobsManifestPath,
    "background prompt manifest",
  );
  assertStageJobs(
    stageJobs,
    config.expectedStageIds,
    styleBibleHash,
    designIdentityRegistryHash,
  );
  assertBackgroundJobs(backgroundJobs, styleBibleHash);
  assertBackgroundPromptManifest(backgroundPromptManifest, backgroundJobs, styleBibleHash);
  if (config.verifyOriginals) {
    await assertExactPngSet(config.pngRoot, [...stageJobs, ...backgroundJobs]);
    await assertExactGenerationStateSet(config.generationStateRoot, [
      ...stageJobs,
      ...backgroundJobs,
    ]);
  }
  return { styleBibleHash, stageJobs, backgroundJobs };
}

async function buildOriginal(job, filePath, expected, label) {
  return {
    file: normalizeRelative(job.out, `${label}.out`),
    ...(await inspectRaster(filePath, { ...expected, format: "png" }, label)),
  };
}

async function convertStage(input, webpQuality) {
  return sharp(input)
    .resize(STAGE_PUBLISHED_SIZE.width, STAGE_PUBLISHED_SIZE.height, {
      fit: "fill",
      kernel: "lanczos3",
    })
    .webp({ quality: webpQuality, effort: 6, smartSubsample: true })
    .toBuffer();
}

async function convertBackground(input, webpQuality) {
  return sharp(input)
    .webp({ quality: webpQuality, effort: 6, smartSubsample: true })
    .toBuffer();
}

function entryProvenance(job, evidence) {
  return {
    provider: job.generatorProvenance?.provider ?? "OpenAI Images",
    model: MODEL,
    operation: job.generatorProvenance?.operation ?? "generate",
    evidenceType: evidence.evidenceType,
    ...(evidence.evidenceType === BUILTIN_EVIDENCE_TYPE
      ? { tool: BUILTIN_TOOL }
      : {}),
  };
}

function assertPublishedProvenance(entry, label) {
  if (entry.generatorProvenance?.provider !== "OpenAI Images") {
    fail(`${label} generatorProvenance.provider must be OpenAI Images`);
  }
  if (entry.generatorProvenance?.model !== MODEL) {
    fail(`${label} generatorProvenance.model must be ${MODEL}`);
  }
  if (entry.generatorProvenance?.operation !== "generate") {
    fail(`${label} generatorProvenance.operation must be generate`);
  }
  if (
    entry.generatorProvenance?.evidenceType !== entry.generationEvidence?.evidenceType
  ) {
    fail(`${label} generatorProvenance.evidenceType must match generationEvidence`);
  }
  if (entry.generationEvidence?.evidenceType === BUILTIN_EVIDENCE_TYPE) {
    if (entry.generatorProvenance?.tool !== BUILTIN_TOOL) {
      fail(`${label} built-in generatorProvenance.tool must be ${BUILTIN_TOOL}`);
    }
  } else if (Object.hasOwn(entry.generatorProvenance ?? {}, "tool")) {
    fail(`${label} API generatorProvenance must not contain a built-in tool`);
  }
}

function descendantRelative(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (
    relative === "" ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    return null;
  }
  return relative;
}

function assertPublicationTopology(config) {
  if (
    descendantRelative(config.stageOutRoot, config.backgroundOutRoot) ||
    descendantRelative(config.backgroundOutRoot, config.stageOutRoot) ||
    config.stageOutRoot === config.backgroundOutRoot
  ) {
    fail("stageOutRoot and backgroundOutRoot must be separate, non-nested directories");
  }
  const manifestInStage = descendantRelative(
    config.stageOutRoot,
    config.manifestPath,
  );
  const manifestInBackground = descendantRelative(
    config.backgroundOutRoot,
    config.manifestPath,
  );
  return { manifestInStage, manifestInBackground };
}

async function pathEntry(absolute) {
  try {
    return await lstat(absolute);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function publicationCandidatePaths(config, transactionRoot) {
  const topology = assertPublicationTopology(config);
  const stageOutRoot = path.join(transactionRoot, "candidate-stage");
  const backgroundOutRoot = path.join(transactionRoot, "candidate-background");
  const manifestPath = topology.manifestInStage
    ? path.join(stageOutRoot, topology.manifestInStage)
    : topology.manifestInBackground
      ? path.join(backgroundOutRoot, topology.manifestInBackground)
      : path.join(transactionRoot, "candidate-manifest.json");
  return {
    transactionRoot,
    stageOutRoot,
    backgroundOutRoot,
    manifestPath,
    topology,
    journalPath: path.join(transactionRoot, "publication-journal.json"),
  };
}

async function createPublicationCandidate(config) {
  const candidate = publicationCandidatePaths(
    config,
    path.join(config.publicRoot, ".image2-publish-staging", randomUUID()),
  );
  const { stageOutRoot, backgroundOutRoot, manifestPath } = candidate;
  await mkdir(stageOutRoot, { recursive: true });
  await mkdir(backgroundOutRoot, { recursive: true });
  await mkdir(path.dirname(manifestPath), { recursive: true });
  return candidate;
}

function publicationOperations(config, candidate) {
  const operations = [];
  const stageOperation = {
    label: "stage output directory",
    kind: "directory",
    candidate: candidate.stageOutRoot,
    final: config.stageOutRoot,
    backup: path.join(candidate.transactionRoot, "backup-stage"),
  };
  const backgroundOperation = {
    label: "background output directory",
    kind: "directory",
    candidate: candidate.backgroundOutRoot,
    final: config.backgroundOutRoot,
    backup: path.join(candidate.transactionRoot, "backup-background"),
  };
  if (candidate.topology.manifestInStage) {
    operations.push(backgroundOperation, stageOperation);
  } else if (candidate.topology.manifestInBackground) {
    operations.push(stageOperation, backgroundOperation);
  } else {
    operations.push(stageOperation, backgroundOperation, {
      label: "published manifest",
      kind: "file",
      candidate: candidate.manifestPath,
      final: config.manifestPath,
      backup: path.join(candidate.transactionRoot, "backup-manifest.json"),
    });
  }
  return operations;
}

async function writePublicationJournal(candidate, journal) {
  const temporary = path.join(
    candidate.transactionRoot,
    `.publication-journal-${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await open(temporary, "wx");
    await handle.writeFile(`${JSON.stringify(journal, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, candidate.journalPath);
  } finally {
    if (handle) await handle.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
  }
}

function assertPublicationJournal(config, candidate, journal) {
  if (
    journal?.schemaVersion !== PUBLICATION_JOURNAL_SCHEMA_VERSION ||
    !["committing", "rollback-failed", "committed", "rolled-back"].includes(
      journal?.status,
    ) ||
    !Array.isArray(journal?.operations)
  ) {
    fail(`Invalid publication journal at ${candidate.journalPath}`);
  }
  const expected = publicationOperations(config, candidate);
  if (journal.operations.length !== expected.length) {
    fail(`Publication journal operation count mismatch at ${candidate.journalPath}`);
  }
  for (const [index, operation] of journal.operations.entries()) {
    const expectedOperation = expected[index];
    for (const key of ["label", "kind"]) {
      if (operation?.[key] !== expectedOperation[key]) {
        fail(`Publication journal operation ${index + 1}.${key} mismatch`);
      }
    }
    for (const key of ["candidate", "final", "backup"]) {
      if (typeof operation?.[key] !== "string") {
        fail(`Publication journal operation ${index + 1}.${key} is invalid`);
      }
      if (path.resolve(operation?.[key] ?? "") !== path.resolve(expectedOperation[key])) {
        fail(`Publication journal operation ${index + 1}.${key} mismatch`);
      }
    }
    if (
      typeof operation.hadOriginal !== "boolean" ||
      !["prepared", "backed-up", "installed", "rolled-back"].includes(
        operation.state,
      )
    ) {
      fail(`Publication journal operation ${index + 1} has invalid state`);
    }
  }
}

async function rollbackPublicationJournal(candidate, journal, renamePath) {
  for (const operation of [...journal.operations].reverse()) {
    const finalEntry = await pathEntry(operation.final);
    const candidateEntry = await pathEntry(operation.candidate);
    const backupEntry = await pathEntry(operation.backup);

    if (operation.hadOriginal) {
      if (backupEntry) {
        if (finalEntry) {
          if (candidateEntry) {
            fail(`${operation.label} rollback is ambiguous; final and candidate both exist`);
          }
          await renamePath(operation.final, operation.candidate);
        }
        await renamePath(operation.backup, operation.final);
      } else {
        if (!finalEntry) {
          fail(`${operation.label} rollback lost both the final path and its backup`);
        }
        if (operation.state !== "prepared" && !candidateEntry) {
          fail(`${operation.label} rollback cannot prove the previous publication`);
        }
      }
    } else {
      if (backupEntry) {
        fail(`${operation.label} unexpectedly has a backup for a new publication path`);
      }
      if (finalEntry) {
        if (candidateEntry) {
          fail(`${operation.label} rollback is ambiguous; final and candidate both exist`);
        }
        await renamePath(operation.final, operation.candidate);
      }
    }
    operation.state = "rolled-back";
    await writePublicationJournal(candidate, journal);
  }
  journal.status = "rolled-back";
  await writePublicationJournal(candidate, journal);
}

async function recoverInterruptedPublications(config) {
  const transactionParent = path.join(config.publicRoot, ".image2-publish-staging");
  if (!(await pathEntry(transactionParent))) return;
  const entries = await readdir(transactionParent, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      fail(`Unexpected file in publication transaction directory: ${entry.name}`);
    }
    const candidate = publicationCandidatePaths(
      config,
      path.join(transactionParent, entry.name),
    );
    if (!(await pathEntry(candidate.journalPath))) {
      await rm(candidate.transactionRoot, { recursive: true, force: true });
      continue;
    }
    const journal = await readJson(
      candidate.journalPath,
      "interrupted publication journal",
    );
    assertPublicationJournal(config, candidate, journal);
    if (journal.status === "committed" || journal.status === "rolled-back") {
      await rm(candidate.transactionRoot, { recursive: true, force: true });
      continue;
    }
    try {
      await rollbackPublicationJournal(candidate, journal, rename);
    } catch (error) {
      journal.status = "rollback-failed";
      await writePublicationJournal(candidate, journal).catch(() => {});
      const recoveryError = new Error(
        `Interrupted publication recovery failed (${error.message}); staging retained at ${candidate.transactionRoot}`,
      );
      recoveryError.retainPublicationStaging = true;
      throw recoveryError;
    }
    await rm(candidate.transactionRoot, { recursive: true, force: true });
  }
}

async function commitPublicationCandidate(config, candidate, runtime = {}) {
  const renamePath = runtime.rename ?? rename;
  const operations = publicationOperations(config, candidate);

  for (const operation of operations) {
    await mkdir(path.dirname(operation.final), { recursive: true });
    const existing = await pathEntry(operation.final);
    if (
      existing &&
      ((operation.kind === "directory" && !existing.isDirectory()) ||
        (operation.kind === "file" && !existing.isFile()))
    ) {
      fail(`${operation.label} exists with the wrong filesystem type`);
    }
    operation.hadOriginal = Boolean(existing);
    operation.state = "prepared";
  }

  const journal = {
    schemaVersion: PUBLICATION_JOURNAL_SCHEMA_VERSION,
    status: "committing",
    operations,
  };
  await writePublicationJournal(candidate, journal);

  try {
    for (const operation of operations) {
      if (operation.hadOriginal) {
        await renamePath(operation.final, operation.backup);
        operation.state = "backed-up";
        await writePublicationJournal(candidate, journal);
      }
      await renamePath(operation.candidate, operation.final);
      operation.state = "installed";
      await writePublicationJournal(candidate, journal);
    }
    journal.status = "committed";
    await writePublicationJournal(candidate, journal);
  } catch (commitError) {
    try {
      await rollbackPublicationJournal(candidate, journal, renamePath);
    } catch (rollbackError) {
      journal.status = "rollback-failed";
      await writePublicationJournal(candidate, journal).catch(() => {});
      const recoveryError = new Error(
        `Publication commit failed (${commitError.message}) and rollback failed (${rollbackError.message}); staging retained at ${candidate.transactionRoot}`,
      );
      recoveryError.retainPublicationStaging = true;
      throw recoveryError;
    }
    throw commitError;
  }
}

export async function publishImage2Assets(options, runtime = {}) {
  const config = normalizedConfig(options);
  if (!config.verifyOriginals) fail("Publishing requires the complete original PNG set");
  const acquireOutputLock = runtime.acquireImage2OutputLock ?? acquireImage2OutputLock;
  const releaseOutputLock = await acquireOutputLock(config.pngRoot, {
    recoverStale: options.recoverStaleOutputLock === true,
  });
  try {
  await recoverInterruptedPublications(config);
  const bundle = await loadBundle(config);
  publicPath(config.publicRoot, config.stageOutRoot, "stageOutRoot");
  publicPath(config.publicRoot, config.backgroundOutRoot, "backgroundOutRoot");
  publicPath(config.publicRoot, config.manifestPath, "manifestPath");

  const stageBuffers = new Map();
  const backgroundBuffers = new Map();
  {
    const stages = [];
    for (const job of bundle.stageJobs) {
      const input = resolveInside(config.pngRoot, job.out, `${job.stageId}.out`);
      const filename = `${job.stageId.toLowerCase()}.webp`;
      const finalOutput = path.join(config.stageOutRoot, filename);
      const original = await buildOriginal(
        job,
        input,
        STAGE_SOURCE_SIZE,
        `stage ${job.stageId} source`,
      );
      const evidence = await generationEvidence(
        config,
        job,
        original,
        `stage ${job.stageId}`,
      );
      const outputBuffer = await convertStage(input, config.webpQuality);
      const published = {
        path: publicPath(config.publicRoot, finalOutput, `stage ${job.stageId}`),
        ...(await inspectRaster(
          outputBuffer,
          { ...STAGE_PUBLISHED_SIZE, format: "webp" },
          `stage ${job.stageId} published`,
        )),
      };
      stages.push({
        stageId: job.stageId,
        model: MODEL,
        quality: QUALITY,
        ...stageSourceReference(job, `stage ${job.stageId}`),
        promptHash: job.promptHash,
        styleBibleHash: bundle.styleBibleHash,
        reviewStatus: config.reviewStatus,
        dHash: await differenceHash(outputBuffer),
        generatorProvenance: entryProvenance(job, evidence),
        generationEvidence: evidence,
        original,
        published,
      });
      stageBuffers.set(filename, outputBuffer);
    }

    const backgrounds = [];
    for (const job of bundle.backgroundJobs) {
      const spec = BACKGROUND_SPECS[job.backgroundId];
      const input = resolveInside(config.pngRoot, job.out, `${job.backgroundId}.out`);
      const finalOutput = path.join(config.backgroundOutRoot, spec.publishedFile);
      const original = await buildOriginal(job, input, spec, `background ${job.backgroundId} source`);
      const evidence = await generationEvidence(
        config,
        job,
        original,
        `background ${job.backgroundId}`,
      );
      const outputBuffer = await convertBackground(input, config.webpQuality);
      const published = {
        path: publicPath(config.publicRoot, finalOutput, `background ${job.backgroundId}`),
        ...(await inspectRaster(
          outputBuffer,
          { width: spec.width, height: spec.height, format: "webp" },
          `background ${job.backgroundId} published`,
        )),
      };
      backgrounds.push({
        backgroundId: job.backgroundId,
        model: MODEL,
        quality: QUALITY,
        promptHash: job.promptHash,
        styleBibleHash: bundle.styleBibleHash,
        reviewStatus: config.reviewStatus,
        dHash: await differenceHash(outputBuffer),
        generatorProvenance: entryProvenance(job, evidence),
        generationEvidence: evidence,
        original,
        published,
      });
      backgroundBuffers.set(spec.publishedFile, outputBuffer);
    }

    const manifest = {
      schemaVersion: config.schemaVersion,
      kind: "japanese-subtext-image2-assets",
      contentVersion: config.contentVersion,
      model: MODEL,
      quality: QUALITY,
      styleBibleHash: bundle.styleBibleHash,
      webp: {
        quality: config.webpQuality,
        stageWidth: STAGE_PUBLISHED_SIZE.width,
        stageHeight: STAGE_PUBLISHED_SIZE.height,
      },
      stageCount: stages.length,
      backgroundCount: backgrounds.length,
      reviewStatus: config.reviewStatus,
      nearDuplicateReport: nearDuplicateReport(stages, config.nearDuplicateThreshold),
      stages,
      backgrounds,
    };
    assertGeneratorMetadata(manifest, "output manifest");

    const candidate = await createPublicationCandidate(config);
    let committed = false;
    let retainCandidate = false;
    try {
      for (const [filename, buffer] of stageBuffers) {
        await writeFile(path.join(candidate.stageOutRoot, filename), buffer);
      }
      for (const [filename, buffer] of backgroundBuffers) {
        await writeFile(path.join(candidate.backgroundOutRoot, filename), buffer);
      }
      await writeFile(
        candidate.manifestPath,
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8",
      );
      const persistedCandidateManifest = await readJson(
        candidate.manifestPath,
        "staged image2 manifest",
      );
      await verifyLoadedPublishedImage2Assets(
        config,
        bundle,
        persistedCandidateManifest,
        {
          stageOutRoot: candidate.stageOutRoot,
          backgroundOutRoot: candidate.backgroundOutRoot,
        },
      );
      await commitPublicationCandidate(config, candidate, runtime);
      committed = true;
    } catch (error) {
      retainCandidate = error?.retainPublicationStaging === true;
      throw error;
    } finally {
      if (!retainCandidate && (committed || (await pathEntry(candidate.transactionRoot)))) {
        await rm(candidate.transactionRoot, { recursive: true, force: true });
      }
    }

    await verifyPublishedImage2Assets({ ...options, reviewStatus: config.reviewStatus });
    return { manifest };
  }
  } finally {
    await releaseOutputLock();
  }
}

async function assertPublishedFile(entry, absolute, expected, label) {
  const actual = await inspectRaster(absolute, { ...expected, format: "webp" }, label);
  for (const key of ["width", "height", "format", "sha256", "bytes"]) {
    if (actual[key] !== entry.published[key]) fail(`${label}.${key} does not match manifest`);
  }
  const hash = await differenceHash(absolute);
  if (hash !== entry.dHash) fail(`${label}.dHash does not match published file`);
}

async function assertOriginalFile(entry, config, expected, label) {
  const absolute = resolveInside(config.pngRoot, entry?.original?.file, `${label}.original.file`);
  const actual = await inspectRaster(absolute, { ...expected, format: "png" }, label);
  for (const key of ["width", "height", "format", "sha256", "bytes"]) {
    if (actual[key] !== entry.original[key]) fail(`${label}.${key} does not match manifest`);
  }
}

async function verifyLoadedPublishedImage2Assets(
  config,
  bundle,
  manifest,
  {
    stageOutRoot = config.stageOutRoot,
    backgroundOutRoot = config.backgroundOutRoot,
  } = {},
) {
  assertGeneratorMetadata(manifest, "published image2 manifest");
  if (manifest.schemaVersion !== config.schemaVersion) fail("Manifest schemaVersion mismatch");
  if (manifest.contentVersion !== config.contentVersion) fail("Manifest contentVersion mismatch");
  if (manifest.reviewStatus !== config.reviewStatus) fail("Manifest reviewStatus mismatch");
  if (manifest.model !== MODEL || manifest.quality !== QUALITY) fail("Manifest model/quality mismatch");
  if (
    manifest.webp?.quality !== config.webpQuality ||
    manifest.webp?.stageWidth !== STAGE_PUBLISHED_SIZE.width ||
    manifest.webp?.stageHeight !== STAGE_PUBLISHED_SIZE.height
  ) {
    fail("Manifest WebP profile mismatch");
  }
  if (manifest.styleBibleHash !== bundle.styleBibleHash) fail("Manifest styleBibleHash mismatch");
  if (manifest.stageCount !== bundle.stageJobs.length || manifest.backgroundCount !== 2) {
    fail("Manifest stage/background counts do not match prompt jobs");
  }
  if (!Array.isArray(manifest.stages) || manifest.stages.length !== bundle.stageJobs.length) {
    fail("Manifest stages are missing or incomplete");
  }
  if (!Array.isArray(manifest.backgrounds) || manifest.backgrounds.length !== 2) {
    fail("Manifest backgrounds are missing or incomplete");
  }
  await assertPublishedOutputSet(stageOutRoot, backgroundOutRoot, bundle.stageJobs);

  for (const [index, entry] of manifest.stages.entries()) {
    const job = bundle.stageJobs[index];
    const publishedFilename = `${job.stageId.toLowerCase()}.webp`;
    const expectedPublishedPath = publicPath(
      config.publicRoot,
      path.join(config.stageOutRoot, publishedFilename),
      `stage ${job.stageId}`,
    );
    if (entry.stageId !== job.stageId) fail(`Manifest stage ${index + 1} id mismatch`);
    if (entry?.published?.path !== expectedPublishedPath) {
      fail(`Manifest stage ${job.stageId} published path mismatch`);
    }
    assertManifestStageSource(entry, job, `Manifest stage ${entry.stageId}`);
    if (
      entry.promptHash !== job.promptHash ||
      entry.styleBibleHash !== bundle.styleBibleHash
    ) {
      fail(`Manifest stage ${entry.stageId} source/prompt/style hash mismatch`);
    }
    if (entry.model !== MODEL || entry.quality !== QUALITY) {
      fail(`Manifest stage ${entry.stageId} model/quality mismatch`);
    }
    if (entry.reviewStatus !== manifest.reviewStatus) {
      fail(`Manifest stage ${entry.stageId} reviewStatus mismatch`);
    }
    assertPublishedProvenance(entry, `stage ${entry.stageId}`);
    assertGenerationEvidenceShape(
      entry.generationEvidence,
      job,
      `stage ${entry.stageId}`,
    );
    if (config.verifyOriginals) {
      await assertOriginalFile(entry, config, STAGE_SOURCE_SIZE, `stage ${entry.stageId} source`);
      const expectedEvidence = await generationEvidence(
        config,
        job,
        entry.original,
        `stage ${entry.stageId}`,
      );
      if (JSON.stringify(entry.generationEvidence) !== JSON.stringify(expectedEvidence)) {
        fail(`stage ${entry.stageId} generationEvidence does not match its sidecar`);
      }
    }
    await assertPublishedFile(
      entry,
      path.join(stageOutRoot, publishedFilename),
      STAGE_PUBLISHED_SIZE,
      `stage ${entry.stageId} published`,
    );
  }

  for (const [index, entry] of manifest.backgrounds.entries()) {
    const job = bundle.backgroundJobs[index];
    const spec = BACKGROUND_SPECS[job.backgroundId];
    const expectedPublishedPath = publicPath(
      config.publicRoot,
      path.join(config.backgroundOutRoot, spec.publishedFile),
      `background ${job.backgroundId}`,
    );
    if (entry.backgroundId !== job.backgroundId) fail(`Manifest background ${index + 1} id mismatch`);
    if (entry?.published?.path !== expectedPublishedPath) {
      fail(`Manifest background ${job.backgroundId} published path mismatch`);
    }
    if (
      Object.hasOwn(entry, "sourceTextHash") ||
      Object.hasOwn(entry, "sourceTextHashSchemaVersion") ||
      Object.hasOwn(entry, "sourceContentHash") ||
      entry.promptHash !== job.promptHash ||
      entry.styleBibleHash !== bundle.styleBibleHash
    ) {
      fail(`Manifest background ${entry.backgroundId} source/prompt/style hash mismatch`);
    }
    if (entry.model !== MODEL || entry.quality !== QUALITY) {
      fail(`Manifest background ${entry.backgroundId} model/quality mismatch`);
    }
    if (entry.reviewStatus !== manifest.reviewStatus) {
      fail(`Manifest background ${entry.backgroundId} reviewStatus mismatch`);
    }
    assertPublishedProvenance(entry, `background ${entry.backgroundId}`);
    assertGenerationEvidenceShape(
      entry.generationEvidence,
      job,
      `background ${entry.backgroundId}`,
    );
    if (config.verifyOriginals) {
      await assertOriginalFile(entry, config, spec, `background ${entry.backgroundId} source`);
      const expectedEvidence = await generationEvidence(
        config,
        job,
        entry.original,
        `background ${entry.backgroundId}`,
      );
      if (JSON.stringify(entry.generationEvidence) !== JSON.stringify(expectedEvidence)) {
        fail(`background ${entry.backgroundId} generationEvidence does not match its sidecar`);
      }
    }
    await assertPublishedFile(
      entry,
      path.join(backgroundOutRoot, spec.publishedFile),
      spec,
      `background ${entry.backgroundId} published`,
    );
  }

  const recomputedReport = nearDuplicateReport(
    manifest.stages,
    config.nearDuplicateThreshold,
  );
  if (JSON.stringify(recomputedReport) !== JSON.stringify(manifest.nearDuplicateReport)) {
    fail("Manifest nearDuplicateReport is stale or was modified");
  }
  return {
    stageCount: manifest.stages.length,
    backgroundCount: manifest.backgrounds.length,
    nearDuplicateCount: recomputedReport.pairCount,
    manifest,
  };
}

export async function verifyPublishedImage2Assets(options) {
  const config = normalizedConfig(options);
  const bundle = await loadBundle(config);
  const manifest = await readJson(config.manifestPath, "published image2 manifest");
  return verifyLoadedPublishedImage2Assets(config, bundle, manifest);
}

function usage() {
  return `Usage:
  node tools/japanese-subtext/scripts/publish-image2-assets.mjs [--check] \\
    --png-root <gpt-image-2 PNG directory> \\
    --stage-out-root <published stage directory> \\
    --background-out-root <published background directory> \\
    --manifest <manifest.json> \\
    --content-version <x.y.z> [options]

Required input correspondence:
  - 250 stage PNGs named exactly as each image2 job.out / lower-case stageId
  - desktop 2048x1152 and mobile 1024x1536 background PNGs
  - no missing or orphan PNG files

Manifest shape:
  - stages[] and backgrounds[] are the only asset collections (no duplicate entries alias)
  - every asset records model, quality, prompt/style hashes, reviewStatus, and dHash
  - v4 stages[] additionally records sourceTextHash and its canonical projection schema
  - a pre-v4 sourceContentHash bundle is accepted only as explicit legacy-stage-content provenance
  - original and published objects record path/file, dimensions, format, SHA-256, and bytes
  - each original binds an external runner sidecar and OpenAI request evidence
  - nearDuplicateReport is report-only and never deletes an asset

Options:
  --check                         Verify without converting or writing
  --published-only                With --check, verify prompt/style plus published WebPs without raw PNGs
  --schema-version <integer>      Manifest schema version (1.0.3 requires/defaults to 3)
  --public-root <directory>       Root used for portable manifest paths
  --stage-jobs <prompts.jsonl>    Stage image2 jobs
  --background-jobs <jsonl>       Background image2 jobs
  --background-job-manifest <json> Background prompt manifest
  --style-bible <style-bible.md>  Style contract used to hash the jobs
  --generation-state-root <dir>   Default: <png-root>/.image2-state
  --recover-stale-lock            Recover a valid dead-owner raw-output lock
  --review-status <token>         Default: pending-codex-review
  --webp-quality <1-100>          Default: 86
  --dhash-threshold <0-64>        Report-only near-duplicate threshold (default: 6)
  --help                          Show this help
`;
}

function parseCli(argv) {
  const values = new Map();
  let check = false;
  let publishedOnly = false;
  let recoverStaleOutputLock = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") return { help: true };
    if (token === "--check") {
      check = true;
      continue;
    }
    if (token === "--published-only") {
      publishedOnly = true;
      continue;
    }
    if (token === "--recover-stale-lock") {
      recoverStaleOutputLock = true;
      continue;
    }
    if (!token.startsWith("--")) fail(`Unknown argument ${token}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) fail(`${token} requires a value`);
    values.set(token, value);
    index += 1;
  }
  const required = (name) => requiredString(values.get(name), name);
  if (publishedOnly && !check) fail("--published-only requires --check");
  const cwd = process.cwd();
  const resolve = (value) => path.resolve(cwd, value);
  return {
    help: false,
    check,
    options: {
      pngRoot: values.has("--png-root") ? resolve(required("--png-root")) : undefined,
      generationStateRoot: values.has("--generation-state-root")
        ? resolve(required("--generation-state-root"))
        : undefined,
      verifyOriginals: !publishedOnly,
      recoverStaleOutputLock,
      publicRoot: resolve(values.get("--public-root") ?? TOOL_ROOT),
      stageOutRoot: resolve(required("--stage-out-root")),
      backgroundOutRoot: resolve(required("--background-out-root")),
      manifestPath: resolve(required("--manifest")),
      contentVersion: required("--content-version"),
      schemaVersion: values.get("--schema-version"),
      reviewStatus: values.get("--review-status") ?? "pending-codex-review",
      webpQuality: values.get("--webp-quality") ?? 86,
      nearDuplicateThreshold: values.get("--dhash-threshold") ?? 6,
      stageJobsPath: resolve(
        values.get("--stage-jobs") ?? path.join(TOOL_ROOT, "image2", "prompts.jsonl"),
      ),
      backgroundJobsPath: resolve(
        values.get("--background-jobs") ??
          path.join(TOOL_ROOT, "image2", "background-prompts.jsonl"),
      ),
      backgroundJobsManifestPath: resolve(
        values.get("--background-job-manifest") ??
          path.join(TOOL_ROOT, "image2", "background-prompts-manifest.json"),
      ),
      styleBiblePath: resolve(
        values.get("--style-bible") ?? path.join(TOOL_ROOT, "image2", "style-bible.md"),
      ),
    },
  };
}

async function runCli() {
  const parsed = parseCli(process.argv.slice(2));
  if (parsed.help) {
    process.stdout.write(usage());
    return;
  }
  const result = parsed.check
    ? await verifyPublishedImage2Assets(parsed.options)
    : await publishImage2Assets(parsed.options);
  const manifest = result.manifest;
  process.stdout.write(
    `${JSON.stringify(
      {
        mode: parsed.check ? "check" : "publish",
        manifest: path.relative(process.cwd(), parsed.options.manifestPath).replaceAll("\\", "/"),
        stages: manifest.stageCount,
        backgrounds: manifest.backgroundCount,
        model: manifest.model,
        quality: manifest.quality,
        nearDuplicates: manifest.nearDuplicateReport.pairCount,
        nearDuplicateAction: manifest.nearDuplicateReport.action,
      },
      null,
      2,
    )}\n`,
  );
}

const directInvocation = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;
if (directInvocation) {
  runCli().catch((error) => {
    console.error(`image2 asset pipeline failed: ${error.message}`);
    process.exitCode = 1;
  });
}
