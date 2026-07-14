import { createHash, randomBytes } from "node:crypto";
import {
  access,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const THIS_FILE = fileURLToPath(import.meta.url);
const TOOL_ROOT = path.resolve(path.dirname(THIS_FILE), "..");
const API_URL = "https://api.openai.com/v1/images/generations";
const MODEL = "gpt-image-2";
const QUALITY = "high";
const OUTPUT_FORMAT = "png";
const STATE_SCHEMA_VERSION = 1;
const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_CONCURRENCY = 2;
const MAX_CONCURRENCY = 4;
const REQUEST_SCHEMA_VERSION = "openai-images-gpt-image-2-v1";
const API_EVIDENCE_TYPE = "openai-images-api-v1";
const STAGE_PROMPT_SCHEMA_VERSION = "japanese-subtext-image2-prompt-v4";
const BACKGROUND_PROMPT_SCHEMA_VERSION = "japanese-subtext-image2-background-prompt-v1";
const SOURCE_TEXT_HASH_SCHEMA_VERSION = "japanese-subtext-image-source-text-v1";
const DESIGN_IDENTITY_REGISTRY_SCHEMA_VERSION =
  "japanese-subtext-design-identities-v1";
const DESIGN_IDENTITY_REGISTRY_PROJECT_PATH =
  "tools/japanese-subtext/image2/design-identities.json";
const DESIGN_SEED_NAMESPACE = "japanese-subtext-cast-design-v2";
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function isCanonicalIsoDate(value) {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}

function fail(message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.name = "Image2GenerationError";
  throw error;
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) {
    fail(`${label} must be a non-empty trimmed string`);
  }
  return value;
}

function parsePositiveInteger(value, label, { minimum = 1, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    fail(`${label} must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
}

function parseSize(value, label = "job.size") {
  const match = /^(\d+)x(\d+)$/.exec(requiredString(value, label));
  if (!match) fail(`${label} must use WIDTHxHEIGHT`);
  const width = Number(match[1]);
  const height = Number(match[2]);
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  const pixels = width * height;
  if (
    width % 16 !== 0 ||
    height % 16 !== 0 ||
    longEdge > 3840 ||
    longEdge / shortEdge > 3 ||
    pixels < 655_360 ||
    pixels > 8_294_400
  ) {
    fail(`${label} does not satisfy the gpt-image-2 size contract`);
  }
  return { width, height };
}

function assertSha256(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    fail(`${label} must be a lowercase SHA-256`);
  }
}

function expectedDesignSeed(designIdentity) {
  return createHash("sha256")
    .update(DESIGN_SEED_NAMESPACE, "utf8")
    .update("\0", "utf8")
    .update(designIdentity, "utf8")
    .digest("hex")
    .slice(0, 16);
}

function assertStageCastDesigns(value, label) {
  if (!Array.isArray(value.castDesigns) || value.castDesigns.length === 0) {
    fail(`${label}.castDesigns must be a non-empty array`);
  }
  const castRefs = new Set();
  for (const [index, design] of value.castDesigns.entries()) {
    const designLabel = `${label}.castDesigns[${index}]`;
    if (!design || typeof design !== "object" || Array.isArray(design)) {
      fail(`${designLabel} must be an object`);
    }
    const castId = requiredString(design.castId, `${designLabel}.castId`);
    const castRef = requiredString(design.castRef, `${designLabel}.castRef`);
    if (castRef !== `${value.stageId}/${castId}`) {
      fail(`${designLabel}.castRef must match stageId/castId`);
    }
    if (castRefs.has(castRef)) fail(`${designLabel}.castRef is duplicated`);
    castRefs.add(castRef);
    const designIdentity = requiredString(
      design.designIdentity,
      `${designLabel}.designIdentity`,
    );
    if (!/^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9:-]*$/.test(designIdentity)) {
      fail(`${designLabel}.designIdentity is invalid`);
    }
    if (!new Set(["independent", "same-character", "shared-appearance"]).has(design.kind)) {
      fail(`${designLabel}.kind is invalid`);
    }
    requiredString(design.variant, `${designLabel}.variant`);
    if (!/^[a-f0-9]{16}$/.test(design.designSeed)) {
      fail(`${designLabel}.designSeed must be 16 lowercase hex characters`);
    }
    if (design.designSeed !== expectedDesignSeed(designIdentity)) {
      fail(`${designLabel}.designSeed does not match its design identity`);
    }
    requiredString(design.description, `${designLabel}.description`);
    if (
      !value.prompt.includes(designIdentity) ||
      !value.prompt.includes(design.designSeed)
    ) {
      fail(`${designLabel} is missing from the final prompt`);
    }
  }
}

function jobLabel(job) {
  return job.stageId ?? `background:${job.backgroundId}`;
}

export function validateImage2GenerationJob(value, label = "image2 job") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  const prompt = requiredString(value.prompt, `${label}.prompt`);
  if (value.model !== MODEL) fail(`${label}.model must be ${MODEL}`);
  if (value.quality !== QUALITY) fail(`${label}.quality must be ${QUALITY}`);
  if (value.output_format !== OUTPUT_FORMAT) {
    fail(`${label}.output_format must be ${OUTPUT_FORMAT}`);
  }
  if (value.n !== 1) fail(`${label}.n must be 1`);
  parseSize(value.size, `${label}.size`);
  const out = requiredString(value.out, `${label}.out`);
  if (path.basename(out) !== out || !/^[a-z0-9][a-z0-9-]*\.png$/.test(out)) {
    fail(`${label}.out must be a safe PNG basename`);
  }
  assertSha256(value.promptHash, `${label}.promptHash`);
  if (value.promptHash !== sha256(prompt)) fail(`${label}.promptHash does not match prompt`);
  assertSha256(value.styleBibleHash, `${label}.styleBibleHash`);

  const isStage = typeof value.stageId === "string";
  const isBackground = typeof value.backgroundId === "string";
  if (isStage === isBackground) fail(`${label} must have exactly one stageId or backgroundId`);
  if (isStage) {
    if (!/^L[1-5]-\d{3}$/.test(value.stageId)) fail(`${label}.stageId is invalid`);
    assertSha256(value.sourceTextHash, `${label}.sourceTextHash`);
    if (value.sourceTextHashSchemaVersion !== SOURCE_TEXT_HASH_SCHEMA_VERSION) {
      fail(`${label}.sourceTextHashSchemaVersion must be ${SOURCE_TEXT_HASH_SCHEMA_VERSION}`);
    }
    assertStageCastDesigns(value, label);
  } else if (!/^(desktop|mobile)$/.test(value.backgroundId)) {
    fail(`${label}.backgroundId must be desktop or mobile`);
  }
  const provenance = value.generatorProvenance;
  const expectedPromptSchema = isStage
    ? STAGE_PROMPT_SCHEMA_VERSION
    : BACKGROUND_PROMPT_SCHEMA_VERSION;
  if (
    !provenance ||
    provenance.requestedGenerator !== "image2" ||
    provenance.provider !== "OpenAI Images" ||
    provenance.model !== MODEL ||
    provenance.operation !== "generate" ||
    provenance.promptSchemaVersion !== expectedPromptSchema ||
    (isStage &&
      (provenance.schemaVersion !== 3 ||
        provenance.sourceHashField !== "sourceTextHash" ||
        provenance.sourceHashSchemaVersion !== SOURCE_TEXT_HASH_SCHEMA_VERSION ||
        provenance.designIdentityRegistry !== DESIGN_IDENTITY_REGISTRY_PROJECT_PATH ||
        provenance.designIdentityRegistrySchemaVersion !==
          DESIGN_IDENTITY_REGISTRY_SCHEMA_VERSION ||
        provenance.designSeedNamespace !== DESIGN_SEED_NAMESPACE))
  ) {
    fail(`${label}.generatorProvenance must identify OpenAI Images ${MODEL} generation`);
  }
  if (isStage) {
    assertSha256(
      provenance.designIdentityRegistrySha256,
      `${label}.generatorProvenance.designIdentityRegistrySha256`,
    );
  }
  return value;
}

export function validateImage2GenerationBundle(stageJobs, backgroundJobs, options = {}) {
  if (!Array.isArray(stageJobs) || stageJobs.length !== 250) {
    fail("stage jobs must contain exactly 250 entries");
  }
  if (!Array.isArray(backgroundJobs) || backgroundJobs.length !== 2) {
    fail("background jobs must contain exactly two entries");
  }
  const jobs = [...stageJobs, ...backgroundJobs];
  const outputs = new Set();
  const ids = new Set();
  for (const [index, job] of jobs.entries()) {
    validateImage2GenerationJob(job, `image2 job ${index + 1}`);
    const id = job.stageId ?? `background:${job.backgroundId}`;
    if (outputs.has(job.out)) fail(`duplicate image2 output: ${job.out}`);
    if (ids.has(id)) fail(`duplicate image2 id: ${id}`);
    outputs.add(job.out);
    ids.add(id);
  }
  for (let level = 1; level <= 5; level += 1) {
    for (let stage = 1; stage <= 50; stage += 1) {
      const expected = `L${level}-${String(stage).padStart(3, "0")}`;
      if (!ids.has(expected)) fail(`missing canonical image2 stage: ${expected}`);
    }
  }
  for (const background of ["desktop", "mobile"]) {
    if (!ids.has(`background:${background}`)) fail(`missing ${background} image2 background`);
  }
  if (typeof options.styleBible === "string") {
    const expectedStyleBibleHash = sha256(options.styleBible);
    for (const job of jobs) {
      if (job.styleBibleHash !== expectedStyleBibleHash) {
        fail(`${jobLabel(job)} styleBibleHash does not match the checked-in style bible`);
      }
    }
  }
  if (typeof options.designIdentityRegistry === "string") {
    const expectedRegistryHash = sha256(options.designIdentityRegistry);
    for (const job of stageJobs) {
      if (
        job.generatorProvenance.designIdentityRegistrySha256 !==
        expectedRegistryHash
      ) {
        fail(
          `${job.stageId} design identity registry hash does not match the checked-in registry`,
        );
      }
    }
  }
  return jobs;
}

function redactSensitive(value, apiKey) {
  let result = String(value ?? "");
  if (apiKey) result = result.replaceAll(apiKey, "[REDACTED]");
  return result.replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]");
}

function safeApiMessage(payload, status, apiKey) {
  const candidate = payload?.error?.message ?? payload?.message;
  const message = typeof candidate === "string" ? candidate.replace(/[\r\n]+/g, " ").trim() : "";
  return redactSensitive(
    message || `OpenAI Images request failed with HTTP ${status}`,
    apiKey,
  ).slice(0, 800);
}

function responseRequestId(response, apiKey) {
  const value = response?.headers?.get?.("x-request-id");
  return typeof value === "string" && value ? redactSensitive(value, apiKey).slice(0, 160) : null;
}

function retryAfterMilliseconds(response, attempt) {
  const raw = response?.headers?.get?.("retry-after");
  if (raw !== null && raw !== undefined && raw !== "") {
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 120_000);
    const date = Date.parse(raw);
    if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 0), 120_000);
  }
  return Math.min(2_000 * 2 ** Math.max(attempt - 1, 0), 30_000);
}

function jitteredDelay(milliseconds, random = Math.random) {
  if (milliseconds <= 0) return 0;
  const sample = Number(random());
  const unit = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 1) : 0.5;
  return Math.round(milliseconds * (0.85 + unit * 0.3));
}

function numericUsage(value, depth = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 3) return null;
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(key)) continue;
    const safe = numericUsage(entry, depth + 1);
    if (safe !== null && (typeof safe !== "object" || Object.keys(safe).length)) result[key] = safe;
  }
  return Object.keys(result).length ? result : null;
}

function decodeBase64Image(value) {
  if (typeof value !== "string" || value.length === 0) fail("Images API response has no b64_json");
  const compact = value.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact) || compact.length % 4 !== 0) {
    fail("Images API returned malformed base64 image data");
  }
  const bytes = Buffer.from(compact, "base64");
  if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    fail("Images API did not return a PNG payload");
  }
  return bytes;
}

export async function requestImage2(job, options = {}) {
  validateImage2GenerationJob(job);
  const apiKey = requiredString(options.apiKey, "OPENAI_API_KEY");
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") fail("A Fetch-compatible implementation is required");
  const sleep = options.sleep ?? delay;
  const maxAttempts = parsePositiveInteger(
    options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    "maxAttempts",
    { maximum: 8 },
  );
  const timeoutMs = parsePositiveInteger(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, "timeoutMs", {
    minimum: 1,
    maximum: 900_000,
  });
  const onRetry = options.onRetry ?? (() => {});
  const random = options.random ?? Math.random;
  const requestBody = {
    model: MODEL,
    prompt: job.prompt,
    size: job.size,
    quality: QUALITY,
    output_format: OUTPUT_FORMAT,
    background: "opaque",
    n: 1,
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    let response;
    let bodyText;
    let timer;
    try {
      [response, bodyText] = await Promise.race([
        (async () => {
          const result = await fetchImpl(API_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
          return [result, await result.text()];
        })(),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("OpenAI Images request timed out"));
          }, timeoutMs);
        }),
      ]);
    } catch {
      controller.abort();
      if (attempt >= maxAttempts) {
        fail(`OpenAI Images request failed after ${attempt} attempt(s)`);
      }
      const waitMs = jitteredDelay(
        Math.min(2_000 * 2 ** (attempt - 1), 30_000),
        random,
      );
      onRetry({ attempt, waitMs, status: null, requestId: null });
      await sleep(waitMs);
      continue;
    } finally {
      if (timer) clearTimeout(timer);
    }

    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      const transient = response.status === 429 || response.status >= 500;
      const requestId = responseRequestId(response, apiKey);
      if (transient && attempt < maxAttempts) {
        const baseWaitMs = retryAfterMilliseconds(response, attempt);
        const waitMs = response?.headers?.get?.("retry-after")
          ? baseWaitMs
          : jitteredDelay(baseWaitMs, random);
        onRetry({ attempt, waitMs, status: response.status, requestId });
        await sleep(waitMs);
        continue;
      }
      fail(`OpenAI Images returned non-JSON HTTP ${response.status}`);
    }
    if (!response.ok) {
      const requestId = responseRequestId(response, apiKey);
      const transient = response.status === 429 || response.status >= 500;
      if (transient && attempt < maxAttempts) {
        const baseWaitMs = retryAfterMilliseconds(response, attempt);
        const waitMs = response?.headers?.get?.("retry-after")
          ? baseWaitMs
          : jitteredDelay(baseWaitMs, random);
        onRetry({ attempt, waitMs, status: response.status, requestId });
        await sleep(waitMs);
        continue;
      }
      const requestSuffix = requestId ? ` (request ${requestId})` : "";
      fail(`${safeApiMessage(payload, response.status, apiKey)}${requestSuffix}`);
    }
    const requestId = responseRequestId(response, apiKey);
    if (!requestId || !/^req[_-][A-Za-z0-9_-]{4,}$/.test(requestId)) {
      fail("OpenAI Images success response is missing a valid request ID");
    }
    const bytes = decodeBase64Image(payload?.data?.[0]?.b64_json);
    return {
      bytes,
      requestId,
      revisedPrompt:
        typeof payload?.data?.[0]?.revised_prompt === "string"
          ? payload.data[0].revised_prompt
          : null,
      usage: numericUsage(payload?.usage),
      attempts: attempt,
    };
  }
  fail("OpenAI Images request exhausted without a result");
}

function resolveInside(root, relative, label) {
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(absoluteRoot, relative);
  const relation = path.relative(absoluteRoot, absolute);
  if (!relation || relation.startsWith("..") || path.isAbsolute(relation)) {
    if (!relation) return absolute;
    fail(`${label} escapes output root`);
  }
  return absolute;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function inspectPng(value, job, label) {
  const bytes = Buffer.isBuffer(value) ? value : await readFile(value);
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    fail(`${label} is not a PNG`);
  }
  const image = sharp(bytes, { failOn: "error" });
  const metadata = await image.metadata();
  await image.clone().stats();
  const expected = parseSize(job.size);
  if (metadata.format !== "png") fail(`${label} format must be PNG`);
  if (metadata.width !== expected.width || metadata.height !== expected.height) {
    fail(
      `${label} must be ${expected.width}x${expected.height}; found ${metadata.width}x${metadata.height}`,
    );
  }
  return {
    bytes,
    width: metadata.width,
    height: metadata.height,
    sha256: sha256(bytes),
  };
}

function artifactPaths(outputRoot, job) {
  const destination = resolveInside(outputRoot, job.out, "job.out");
  const stateRoot = path.join(path.resolve(outputRoot), ".image2-state");
  return {
    destination,
    stateRoot,
    state: path.join(stateRoot, `${job.out}.json`),
    pendingState: path.join(stateRoot, `${job.out}.pending.json`),
  };
}

async function readJson(filePath) {
  let source;
  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  try {
    return JSON.parse(source);
  } catch {
    return null;
  }
}

function stateMatchesJob(state, job) {
  const expected = parseSize(job.size);
  return (
    state?.schemaVersion === STATE_SCHEMA_VERSION &&
    state?.status === "complete" &&
    state?.evidenceType === API_EVIDENCE_TYPE &&
    state?.out === job.out &&
    state?.model === MODEL &&
    state?.quality === QUALITY &&
    state?.outputFormat === OUTPUT_FORMAT &&
    state?.requestSchemaVersion === REQUEST_SCHEMA_VERSION &&
    state?.size === job.size &&
    state?.promptHash === job.promptHash &&
    state?.styleBibleHash === job.styleBibleHash &&
    state?.sourceTextHash === (job.sourceTextHash ?? null) &&
    state?.sourceTextHashSchemaVersion === (job.sourceTextHashSchemaVersion ?? null) &&
    state?.promptSchemaVersion === job.generatorProvenance.promptSchemaVersion &&
    state?.stageId === (job.stageId ?? null) &&
    state?.backgroundId === (job.backgroundId ?? null) &&
    state?.generator?.provider === "OpenAI Images" &&
    state?.generator?.model === MODEL &&
    state?.generator?.endpoint === "/v1/images/generations" &&
    !Object.hasOwn(state.generator, "tool") &&
    !Object.hasOwn(state.generator, "toolRunId") &&
    typeof state?.generator?.requestId === "string" &&
    /^req[_-][A-Za-z0-9_-]{4,}$/.test(state.generator.requestId) &&
    Number.isInteger(state?.generator?.attempts) &&
    state.generator.attempts >= 1 &&
    state.generator.attempts <= 8 &&
    isCanonicalIsoDate(state?.generatedAt) &&
    state?.width === expected.width &&
    state?.height === expected.height &&
    Number.isSafeInteger(state?.bytes) &&
    state.bytes > PNG_SIGNATURE.length &&
    /^[a-f0-9]{64}$/.test(state?.sha256 ?? "")
  );
}

async function replaceFile(candidate, destination) {
  await rename(candidate, destination);
}

async function writeCandidate(filePath, bytes) {
  const handle = await open(filePath, "wx");
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeJsonCandidate(filePath, value) {
  await writeCandidate(filePath, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"));
}

async function currentArtifact(job, paths) {
  if (!(await exists(paths.destination))) return { status: "missing" };
  const publishedState = await readJson(paths.state);
  const pendingState = await readJson(paths.pendingState);
  for (const [state, pending] of [
    [publishedState, false],
    [pendingState, true],
  ]) {
    if (!stateMatchesJob(state, job)) continue;
    try {
      const inspected = await inspectPng(paths.destination, job, `${jobLabel(job)} output`);
      if (inspected.sha256 !== state.sha256) continue;
      if (inspected.bytes.length !== state.bytes) continue;
      if (pending) await replaceFile(paths.pendingState, paths.state);
      return { status: "current", state };
    } catch (error) {
      if (["EACCES", "EPERM"].includes(error?.code)) throw error;
      // A broken or mismatched output is stale and must never be silently reused.
    }
  }
  return { status: "stale" };
}

export async function generateImage2Job(job, options = {}) {
  validateImage2GenerationJob(job);
  const outputRoot = path.resolve(requiredString(options.outputRoot, "outputRoot"));
  const paths = artifactPaths(outputRoot, job);
  await mkdir(outputRoot, { recursive: true });
  await mkdir(paths.stateRoot, { recursive: true });
  const current = await currentArtifact(job, paths);
  if (current.status === "current" && options.replace !== true) {
    return { status: "reused", job, state: current.state };
  }
  if (current.status === "stale" && options.replace !== true) {
    fail(`${jobLabel(job)} output is stale or unverifiable; rerun explicitly with --replace`);
  }

  const response = await requestImage2(job, options);
  const inspected = await inspectPng(response.bytes, job, `${jobLabel(job)} API output`);
  const nonce = `${process.pid}-${randomBytes(6).toString("hex")}`;
  const imageCandidate = `${paths.destination}.part-${nonce}`;
  const stateCandidate = `${paths.pendingState}.part-${nonce}`;
  const state = {
    schemaVersion: STATE_SCHEMA_VERSION,
    status: "complete",
    evidenceType: API_EVIDENCE_TYPE,
    generatedAt: new Date().toISOString(),
    stageId: job.stageId ?? null,
    backgroundId: job.backgroundId ?? null,
    out: job.out,
    model: MODEL,
    quality: QUALITY,
    outputFormat: OUTPUT_FORMAT,
    requestSchemaVersion: REQUEST_SCHEMA_VERSION,
    size: job.size,
    width: inspected.width,
    height: inspected.height,
    bytes: inspected.bytes.length,
    sha256: inspected.sha256,
    promptHash: job.promptHash,
    styleBibleHash: job.styleBibleHash,
    sourceTextHash: job.sourceTextHash ?? null,
    sourceTextHashSchemaVersion: job.sourceTextHashSchemaVersion ?? null,
    promptSchemaVersion: job.generatorProvenance.promptSchemaVersion,
    generator: {
      provider: "OpenAI Images",
      model: MODEL,
      endpoint: "/v1/images/generations",
      requestId: response.requestId,
      attempts: response.attempts,
    },
    revisedPromptSha256: response.revisedPrompt ? sha256(response.revisedPrompt) : null,
    usage: response.usage,
  };
  try {
    await writeCandidate(imageCandidate, response.bytes);
    await inspectPng(imageCandidate, job, `${jobLabel(job)} candidate`);
    await writeJsonCandidate(stateCandidate, state);
    await replaceFile(stateCandidate, paths.pendingState);
    await replaceFile(imageCandidate, paths.destination);
    await replaceFile(paths.pendingState, paths.state);
  } finally {
    await rm(imageCandidate, { force: true });
    await rm(stateCandidate, { force: true });
  }
  return { status: "generated", job, state };
}

async function readJsonl(filePath, label) {
  const source = await readFile(filePath, "utf8");
  const values = [];
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      values.push(JSON.parse(line));
    } catch (error) {
      fail(`${label} line ${index + 1} is not valid JSON`, error);
    }
  }
  return values;
}

function processIsAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function image2LeaseEndpoint(realOutputRoot) {
  const canonical = process.platform === "win32" ? realOutputRoot.toLowerCase() : realOutputRoot;
  const digest = sha256(Buffer.from(canonical, "utf8"));
  if (process.platform === "win32") return `\\\\.\\pipe\\jp-subtext-image2-${digest}`;
  if (process.platform === "linux") return `\0jp-subtext-image2-${digest}`;
  fail("image2 OS lease currently supports Windows and Linux only");
}

async function bindImage2OutputLease(realOutputRoot) {
  const server = createServer((socket) => socket.destroy());
  const endpoint = image2LeaseEndpoint(realOutputRoot);
  await new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(endpoint, () => {
      server.off("error", onError);
      resolve();
    });
  });
  return server;
}

async function closeImage2OutputLease(server) {
  if (!server?.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export async function acquireImage2OutputLock(outputRoot, options = {}) {
  await mkdir(outputRoot, { recursive: true });
  const realOutputRoot = await realpath(outputRoot);
  const lockPath = path.join(realOutputRoot, ".image2-generate.lock");
  let lease;
  try {
    lease = await bindImage2OutputLease(realOutputRoot);
  } catch (error) {
    if (error?.code === "EADDRINUSE") {
      const owner = await readJson(lockPath);
      fail(`image2 output root is locked by PID ${owner?.pid ?? "unknown"}`);
    }
    throw error;
  }

  let handle;
  const closeLeaseAndRethrow = async (error) => {
    if (handle) {
      await handle.close().catch(() => {});
      handle = null;
    }
    await closeImage2OutputLease(lease).catch(() => {});
    throw error;
  };

  try {
  if (options.recoverStale === true && (await exists(lockPath))) {
    const owner = await readJson(lockPath);
    if (
      !owner ||
      !Number.isSafeInteger(Number(owner.pid)) ||
      typeof owner.token !== "string" ||
      !/^[a-f0-9]{32}$/.test(owner.token)
    ) {
      fail("image2 output lock has invalid or unknown ownership; refusing automatic removal");
    }
    if (processIsAlive(Number(owner.pid))) {
      fail(`image2 output root is locked by live PID ${owner.pid}`);
    }
    const quarantine = path.join(
      outputRoot,
      `.image2-generate.stale-${process.pid}-${randomBytes(6).toString("hex")}`,
    );
    try {
      await rename(lockPath, quarantine);
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "EEXIST") {
        fail("image2 output lock changed while stale recovery was attempted");
      }
      throw error;
    }
    const quarantinedOwner = await readJson(quarantine);
    if (quarantinedOwner?.token !== owner.token || Number(quarantinedOwner?.pid) !== Number(owner.pid)) {
      fail("image2 output lock ownership changed during stale recovery");
    }
    await rm(quarantine, { force: true });
  }

  const token = randomBytes(16).toString("hex");
  try {
    handle = await open(lockPath, "wx");
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const owner = await readJson(lockPath);
    fail(`image2 output root is locked by PID ${owner?.pid ?? "unknown"}`);
  }
  const owner = { pid: process.pid, token, startedAt: new Date().toISOString() };
  try {
    await handle.writeFile(`${JSON.stringify(owner)}\n`);
    await handle.sync();
  } catch (error) {
    await handle.close();
    handle = null;
    await rm(lockPath, { force: true });
    throw error;
  }
  let released = false;
  return async () => {
    if (released) fail("image2 output lock was already released");
    released = true;
    let failure = null;
    try {
      const current = await readJson(lockPath);
      if (current?.token !== token || Number(current?.pid) !== process.pid) {
        fail("image2 output lock ownership changed; refusing to remove another owner lock");
      }
      await handle.close();
      handle = null;
      const releasePath = path.join(
        realOutputRoot,
        `.image2-generate.release-${token}`,
      );
      await rename(lockPath, releasePath);
      const claimed = await readJson(releasePath);
      if (claimed?.token !== token || Number(claimed?.pid) !== process.pid) {
        fail("image2 output lock ownership changed during release");
      }
      await rm(releasePath, { force: true });
    } catch (error) {
      failure = error;
    } finally {
      if (handle) {
        try {
          await handle.close();
        } catch (error) {
          failure ??= error;
        }
        handle = null;
      }
      try {
        await closeImage2OutputLease(lease);
      } catch (error) {
        failure ??= error;
      }
    }
    if (failure) throw failure;
  };
  } catch (error) {
    return closeLeaseAndRethrow(error);
  }
}

export async function runConcurrentImage2Jobs(jobs, concurrency, worker) {
  let cursor = 0;
  let failure = null;
  const results = new Array(jobs.length);
  async function runWorker() {
    while (failure === null) {
      const index = cursor;
      cursor += 1;
      if (index >= jobs.length) return;
      try {
        results[index] = await worker(jobs[index], index);
      } catch (error) {
        failure ??= error;
        return;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, runWorker));
  if (failure) throw failure;
  return results;
}

function parseArgs(argv) {
  const values = new Map();
  const flags = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (["--all", "--replace", "--recover-stale-lock", "--dry-run", "--help"].includes(token)) {
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
  return { values, flags };
}

export function selectImage2GenerationJobs(jobs, rawOnly) {
  if (!rawOnly) return jobs;
  const requested = new Set(rawOnly.split(",").map((value) => value.trim()).filter(Boolean));
  if (!requested.size) fail("--only must name at least one image2 job");
  const aliasesFor = (job) =>
    job.stageId
      ? [job.out, job.stageId]
      : [job.out, job.backgroundId, `background:${job.backgroundId}`];
  const selected = jobs.filter((job) => {
    return aliasesFor(job).some((alias) => requested.has(alias));
  });
  const matched = new Set(selected.flatMap(aliasesFor));
  const missing = [...requested].filter((value) => !matched.has(value));
  if (missing.length) fail(`unknown --only values: ${missing.join(", ")}`);
  return selected;
}

export async function assertExternalImage2OutputRoot(outputRoot, protectedRoot = TOOL_ROOT) {
  await mkdir(outputRoot, { recursive: true });
  const [realOutput, realProtected] = await Promise.all([
    realpath(outputRoot),
    realpath(protectedRoot),
  ]);
  const outputFromProtected = path.relative(realProtected, realOutput);
  if (!outputFromProtected.startsWith("..") && !path.isAbsolute(outputFromProtected)) {
    fail("raw image2 PNG output must stay outside tools/japanese-subtext");
  }
  const stateRoot = path.join(realOutput, ".image2-state");
  await mkdir(stateRoot, { recursive: true });
  const [confirmedOutput, realState] = await Promise.all([
    realpath(outputRoot),
    realpath(stateRoot),
  ]);
  if (confirmedOutput !== realOutput) {
    fail("raw image2 output root changed while it was being validated");
  }
  const stateFromProtected = path.relative(realProtected, realState);
  if (!stateFromProtected.startsWith("..") && !path.isAbsolute(stateFromProtected)) {
    fail("image2 state output must stay outside tools/japanese-subtext");
  }
  const stateFromOutput = path.relative(realOutput, realState);
  if (stateFromOutput.startsWith("..") || path.isAbsolute(stateFromOutput)) {
    fail("image2 state directory must remain inside the real output root");
  }
  return { outputRoot: realOutput, stateRoot: realState };
}

async function main(argv) {
  const { values, flags } = parseArgs(argv);
  if (flags.has("--help")) {
    console.log(`Usage:
  node tools/japanese-subtext/scripts/generate-image2-assets.mjs \\
    --output-root <external-raw-png-root> [options]

Options:
  --stage-jobs <jsonl>       Default: image2/prompts.jsonl
  --background-jobs <jsonl>  Default: image2/background-prompts.jsonl
  --all                      Explicitly generate/reuse all 252 paid jobs
  --only <id,id,...>         Stage ids, desktop/mobile ids, or output basenames
  --concurrency <1-4>        Default: ${DEFAULT_CONCURRENCY}
  --max-attempts <1-8>       Default: ${DEFAULT_MAX_ATTEMPTS}
  --timeout-ms <integer>     Default: ${DEFAULT_TIMEOUT_MS}
  --replace                  Explicitly replace selected stale/current artifacts
  --recover-stale-lock       Explicitly recover a valid lock whose PID is no longer alive
  --dry-run                  Validate the complete job bundle without API calls

OPENAI_API_KEY is read only from the process environment and is never written to disk.`);
    return;
  }
  const stagePath = path.resolve(
    values.get("--stage-jobs") ?? path.join(TOOL_ROOT, "image2", "prompts.jsonl"),
  );
  const backgroundPath = path.resolve(
    values.get("--background-jobs") ??
      path.join(TOOL_ROOT, "image2", "background-prompts.jsonl"),
  );
  const stageJobs = await readJsonl(stagePath, "stage jobs");
  const backgroundJobs = await readJsonl(backgroundPath, "background jobs");
  const styleBible = await readFile(path.join(TOOL_ROOT, "image2", "style-bible.md"), "utf8");
  const designIdentityRegistry = await readFile(
    path.join(TOOL_ROOT, "image2", "design-identities.json"),
    "utf8",
  );
  const allJobs = validateImage2GenerationBundle(stageJobs, backgroundJobs, {
    styleBible,
    designIdentityRegistry,
  });
  if (flags.has("--all") && values.has("--only")) {
    fail("use exactly one of --all or --only");
  }
  const jobs = selectImage2GenerationJobs(allJobs, values.get("--only"));
  if (flags.has("--dry-run")) {
    console.log(`Validated ${allJobs.length} gpt-image-2 jobs; selected ${jobs.length}.`);
    return;
  }
  if (!flags.has("--all") && !values.has("--only")) {
    fail("paid generation requires an explicit --all or --only selection");
  }
  const requestedOutputRoot = path.resolve(
    requiredString(values.get("--output-root"), "--output-root"),
  );
  const { outputRoot } = await assertExternalImage2OutputRoot(requestedOutputRoot);
  const concurrency = parsePositiveInteger(
    values.get("--concurrency") ?? DEFAULT_CONCURRENCY,
    "--concurrency",
    { maximum: MAX_CONCURRENCY },
  );
  const maxAttempts = parsePositiveInteger(
    values.get("--max-attempts") ?? DEFAULT_MAX_ATTEMPTS,
    "--max-attempts",
    { maximum: 8 },
  );
  const timeoutMs = parsePositiveInteger(
    values.get("--timeout-ms") ?? DEFAULT_TIMEOUT_MS,
    "--timeout-ms",
    { minimum: 1, maximum: 900_000 },
  );
  const release = await acquireImage2OutputLock(outputRoot, {
    recoverStale: flags.has("--recover-stale-lock"),
  });
  try {
    const results = await runConcurrentImage2Jobs(jobs, concurrency, async (job, index) => {
      const label = jobLabel(job);
      const result = await generateImage2Job(job, {
        outputRoot,
        apiKey: process.env.OPENAI_API_KEY,
        replace: flags.has("--replace"),
        maxAttempts,
        timeoutMs,
        onRetry: ({ attempt, waitMs, status, requestId }) => {
          console.warn(
            `[${index + 1}/${jobs.length}] ${label} retry ${attempt}: HTTP ${status ?? "network"}, wait ${waitMs}ms${requestId ? `, ${requestId}` : ""}`,
          );
        },
      });
      console.log(`[${index + 1}/${jobs.length}] ${label}: ${result.status}`);
      return result;
    });
    const generated = results.filter((result) => result.status === "generated").length;
    const reused = results.filter((result) => result.status === "reused").length;
    console.log(`Image2 generation complete: ${generated} generated, ${reused} reused, ${jobs.length} total.`);
  } finally {
    await release();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(THIS_FILE)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
