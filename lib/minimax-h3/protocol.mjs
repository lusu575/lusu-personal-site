export const H3_PROTOCOL_VERSION = "1.0";
export const H3_TEMPLATE_VERSION = "h3-t2v-mvp-1";
export const H3_AGENT_SCOPE = "minimax-h3:execute";
export const H3_DEFAULT_POLL_SECONDS = 8;
export const H3_HEARTBEAT_SECONDS = 15;
export const H3_OFFLINE_SECONDS = 60;
export const H3_LEASE_SECONDS = 120;
export const H3_MAX_JSON_BYTES = 96 * 1024;
export const H3_MAX_CAPABILITIES_BYTES = 8 * 1024;
export const H3_MAX_PAGE_SIZE = 50;
export const H3_MAX_PROMPT_LENGTH = 10000;
export const H3_MAX_PROJECT_TITLE_LENGTH = 120;
export const H3_MAX_SOURCE_LANGUAGE_LENGTH = 32;
export const H3_MAX_REFERENCES = 15;
export const H3_MAX_RESULT_NAME_LENGTH = 160;
export const H3_MAX_ERROR_SUMMARY_LENGTH = 240;
export const H3_MAX_DISK_FREE_BYTES = 1024n * 1024n * 1024n * 1024n * 1024n;
export const H3_UINT64_MAX = 18446744073709551615n;

export const H3_MODES = Object.freeze(["t2v", "i2v", "r2v"]);
export const H3_ASPECT_RATIOS = Object.freeze(["16:9", "9:16", "1:1"]);
export const H3_PRESETS = Object.freeze(["safe", "preview_fast"]);
export const H3_WORKFLOW_VARIANTS = Object.freeze(["character-06", "character-07", "quality-28"]);
export const H3_REFERENCE_ROLES = Object.freeze([
  "first_frame",
  "last_frame",
  "ref_image",
  "ref_video",
  "ref_audio",
  "storyboard_grid"
]);

export const H3_READY_STATES = Object.freeze([
  "offline",
  "agent_only",
  "bridge_only",
  "comfy_unready",
  "ready",
  "busy",
  "disk_low",
  "error"
]);

export const H3_STATES = Object.freeze([
  "awaiting_assets",
  "queued",
  "leased",
  "validating",
  "submitted",
  "running",
  "retrieving",
  "ready",
  "failed",
  "stalled",
  "cancelled",
  "expired",
  "deleted"
]);

export const H3_TERMINAL_STATES = new Set(["failed", "cancelled", "expired", "deleted"]);

export const H3_STATE_TRANSITIONS = Object.freeze({
  awaiting_assets: Object.freeze(["queued", "cancelled", "expired"]),
  queued: Object.freeze(["leased", "cancelled"]),
  leased: Object.freeze(["validating", "stalled", "cancelled"]),
  validating: Object.freeze(["submitted", "failed", "stalled"]),
  submitted: Object.freeze(["running", "stalled"]),
  running: Object.freeze(["retrieving", "failed", "stalled"]),
  retrieving: Object.freeze(["ready", "failed"]),
  ready: Object.freeze(["expired", "deleted"]),
  failed: Object.freeze([]),
  stalled: Object.freeze([]),
  cancelled: Object.freeze([]),
  expired: Object.freeze([]),
  deleted: Object.freeze([])
});

export class H3ProtocolError extends Error {
  constructor(message, status = 400, code = "H3_PROTOCOL_INVALID", details = null) {
    super(message);
    this.name = "H3ProtocolError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function assertObject(value, label = "value") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new H3ProtocolError(`${label} must be an object.`, 422, "H3_OBJECT_REQUIRED");
  }
  return value;
}

export function assertExactKeys(value, allowedKeys, label = "object") {
  assertObject(value, label);
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length) {
    throw new H3ProtocolError(
      `${label} contains unsupported fields: ${unexpected.join(", ")}.`,
      422,
      "H3_EXTRA_FIELDS",
      { fields: unexpected }
    );
  }
  return value;
}

export function requireString(value, label, { min = 1, max = 256, pattern = null } = {}) {
  if (typeof value !== "string") {
    throw new H3ProtocolError(`${label} must be a string.`, 422, "H3_STRING_REQUIRED");
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new H3ProtocolError(`${label} length is invalid.`, 422, "H3_STRING_LENGTH_INVALID");
  }
  if (normalized !== value || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new H3ProtocolError(`${label} contains unsupported whitespace or control characters.`, 422, "H3_STRING_INVALID");
  }
  if (pattern && !pattern.test(normalized)) {
    throw new H3ProtocolError(`${label} format is invalid.`, 422, "H3_STRING_FORMAT_INVALID");
  }
  return normalized;
}

export function optionalString(value, label, options = {}) {
  if (value === undefined || value === null) return null;
  return requireString(value, label, options);
}

export function requireEnum(value, label, allowed) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new H3ProtocolError(`${label} is invalid.`, 422, "H3_ENUM_INVALID", { allowed });
  }
  return value;
}

export function requireBoolean(value, label, fallback = undefined) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "boolean") {
    throw new H3ProtocolError(`${label} must be a boolean.`, 422, "H3_BOOLEAN_REQUIRED");
  }
  return value;
}

export function requireInteger(value, label, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new H3ProtocolError(`${label} must be an integer in range.`, 422, "H3_INTEGER_INVALID");
  }
  return value;
}

export function requireFiniteNumber(value, label, { min = -Infinity, max = Infinity } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new H3ProtocolError(`${label} must be a finite number in range.`, 422, "H3_NUMBER_INVALID");
  }
  return value;
}

export function normalizeOpaqueId(value, label, prefix) {
  return requireString(value, label, {
    min: prefix.length + 8,
    max: 140,
    pattern: new RegExp(`^${escapeRegExp(prefix)}[A-Za-z0-9_-]{8,120}$`, "u")
  });
}

export function normalizeOperationId(value) {
  return requireString(value, "operationId", {
    min: 8,
    max: 80,
    pattern: /^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/u
  });
}

export function normalizeSeed(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,19})$/u.test(value)) {
    throw new H3ProtocolError("seed must be null or an unsigned decimal string.", 422, "H3_SEED_INVALID");
  }
  let parsed;
  try {
    parsed = BigInt(value);
  } catch {
    throw new H3ProtocolError("seed is invalid.", 422, "H3_SEED_INVALID");
  }
  if (parsed > H3_UINT64_MAX) {
    throw new H3ProtocolError("seed exceeds uint64.", 422, "H3_SEED_INVALID");
  }
  return value;
}

export function normalizeDurationAndFrames(durationValue, targetFramesValue) {
  const durationSeconds = durationValue === undefined
    ? 5
    : requireFiniteNumber(durationValue, "durationSeconds", { min: 5 / 24, max: 345 / 24 });
  const targetFrames = targetFramesValue === undefined || targetFramesValue === null
    ? null
    : requireInteger(targetFramesValue, "targetFrames", { min: 5, max: 345 });

  if (targetFrames === null) {
    if (durationSeconds !== 5) {
      throw new H3ProtocolError("durationSeconds must be 5 when targetFrames is null.", 422, "H3_DURATION_INVALID");
    }
    return { durationSeconds: 5, targetFrames: null };
  }
  if ((targetFrames - 5) % 17 !== 0 || durationSeconds !== targetFrames / 24) {
    throw new H3ProtocolError(
      "targetFrames must satisfy targetFrames % 17 == 5 and durationSeconds == targetFrames / 24.",
      422,
      "H3_DURATION_FRAMES_MISMATCH"
    );
  }
  return { durationSeconds, targetFrames };
}

export function normalizeReference(value, index) {
  assertExactKeys(value, ["assetId", "role"], `references[${index}]`);
  return {
    assetId: normalizeOpaqueId(value.assetId, `references[${index}].assetId`, "asset_"),
    role: requireEnum(value.role, `references[${index}].role`, H3_REFERENCE_ROLES)
  };
}

export function normalizeJobCreateRequest(value) {
  assertExactKeys(value, ["operationId", "runnerId", "projectTitle", "sourceLanguage", "job"], "job request");
  const jobValue = assertExactKeys(value.job, [
    "mode",
    "workflowVariant",
    "durationSeconds",
    "targetFrames",
    "aspectRatio",
    "preset",
    "prompt",
    "references",
    "includeVideoAudio",
    "seed"
  ], "job");
  const mode = requireEnum(jobValue.mode, "job.mode", H3_MODES);
  const workflowVariant = jobValue.workflowVariant === undefined || jobValue.workflowVariant === null
    ? null
    : requireEnum(jobValue.workflowVariant, "job.workflowVariant", H3_WORKFLOW_VARIANTS);
  if (workflowVariant !== null && mode !== "r2v") {
    throw new H3ProtocolError("workflowVariant is only available for r2v jobs.", 422, "H3_WORKFLOW_VARIANT_INVALID");
  }
  const durationAndFrames = normalizeDurationAndFrames(jobValue.durationSeconds, jobValue.targetFrames);
  const referencesValue = jobValue.references === undefined ? [] : jobValue.references;
  if (!Array.isArray(referencesValue) || referencesValue.length > H3_MAX_REFERENCES) {
    throw new H3ProtocolError("job.references is invalid.", 422, "H3_REFERENCES_INVALID");
  }
  const references = referencesValue.map(normalizeReference);
  validateReferenceRules(mode, jobValue.preset === undefined ? "safe" : jobValue.preset, references);
  return {
    operationId: normalizeOperationId(value.operationId),
    runnerId: normalizeOpaqueId(value.runnerId, "runnerId", "runner_"),
    projectTitle: requireString(value.projectTitle, "projectTitle", { max: H3_MAX_PROJECT_TITLE_LENGTH }),
    sourceLanguage: requireString(value.sourceLanguage, "sourceLanguage", { min: 2, max: H3_MAX_SOURCE_LANGUAGE_LENGTH }),
    job: {
      mode,
      workflowVariant,
      durationSeconds: durationAndFrames.durationSeconds,
      targetFrames: durationAndFrames.targetFrames,
      aspectRatio: requireEnum(jobValue.aspectRatio, "job.aspectRatio", H3_ASPECT_RATIOS),
      preset: requireEnum(jobValue.preset === undefined ? "safe" : jobValue.preset, "job.preset", H3_PRESETS),
      prompt: requireString(jobValue.prompt, "job.prompt", { max: H3_MAX_PROMPT_LENGTH }),
      references,
      includeVideoAudio: requireBoolean(jobValue.includeVideoAudio, "job.includeVideoAudio", true),
      seed: normalizeSeed(jobValue.seed)
    }
  };
}

export function validateReferenceRules(mode, preset, references) {
  const roles = references.map((reference) => reference.role);
  const validI2vReferences = (roles.length === 1 && roles[0] === "first_frame")
    || (roles.length === 2 && roles.includes("first_frame") && roles.includes("last_frame"));
  if (mode === "t2v" && references.length) {
    throw new H3ProtocolError("t2v jobs cannot include references.", 422, "H3_REFERENCES_NOT_ALLOWED");
  }
  if (mode === "i2v" && !validI2vReferences) {
    throw new H3ProtocolError("i2v jobs require one first_frame or a first_frame plus last_frame.", 422, "H3_REFERENCES_INVALID");
  }
  if (mode === "r2v" && references.length === 0) {
    throw new H3ProtocolError("r2v jobs require at least one reference.", 422, "H3_REFERENCES_REQUIRED");
  }
  if (preset === "preview_fast" && !(
    mode === "t2v"
    || (mode === "i2v" && roles.length === 1 && roles[0] === "first_frame")
  )) {
    throw new H3ProtocolError("preview_fast is only available for t2v or single-first-frame i2v.", 422, "H3_PREVIEW_FAST_INVALID");
  }
  const counts = references.reduce((result, reference) => {
    result[reference.role] = (result[reference.role] || 0) + 1;
    return result;
  }, {});
  if ((counts.ref_image || 0) > 9 || (counts.ref_video || 0) > 3 || (counts.ref_audio || 0) > 3) {
    throw new H3ProtocolError("r2v reference limits were exceeded.", 422, "H3_REFERENCES_LIMIT");
  }
}

export function normalizeRunnerRegisterRequest(value) {
  assertExactKeys(value, [
    "runnerId",
    "installationId",
    "label",
    "protocolVersion",
    "agentVersion",
    "controllerVersion",
    "capabilities"
  ], "runner registration");
  const installationId = requireString(value.installationId, "installationId", { min: 16, max: 256 });
  const capabilities = normalizeCapabilities(value.capabilities);
  return {
    runnerId: value.runnerId === undefined || value.runnerId === null
      ? null
      : normalizeOpaqueId(value.runnerId, "runnerId", "runner_"),
    installationId,
    label: requireString(value.label, "label", { max: 80 }),
    protocolVersion: requireString(value.protocolVersion, "protocolVersion", { max: 32 }),
    agentVersion: requireString(value.agentVersion, "agentVersion", { max: 64 }),
    controllerVersion: requireString(value.controllerVersion, "controllerVersion", { max: 64 }),
    capabilities
  };
}

export function normalizeRunnerHeartbeat(value) {
  assertExactKeys(value, [
    "runnerId",
    "readyState",
    "busyJobId",
    "bridgeOnline",
    "comfyReachable",
    "diskFreeBytes",
    "capabilities"
  ], "runner heartbeat");
  const diskFreeBytes = value.diskFreeBytes === null || value.diskFreeBytes === undefined
    ? null
    : requireInteger(value.diskFreeBytes, "diskFreeBytes", { min: 0, max: Number.MAX_SAFE_INTEGER });
  return {
    runnerId: normalizeOpaqueId(value.runnerId, "runnerId", "runner_"),
    readyState: requireEnum(value.readyState, "readyState", H3_READY_STATES),
    busyJobId: value.busyJobId ? normalizeOpaqueId(value.busyJobId, "busyJobId", "job_") : "",
    bridgeOnline: requireBoolean(value.bridgeOnline, "bridgeOnline", false),
    comfyReachable: requireBoolean(value.comfyReachable, "comfyReachable", false),
    diskFreeBytes,
    capabilities: value.capabilities === undefined ? null : normalizeCapabilities(value.capabilities)
  };
}

export function normalizeCapabilities(value) {
  assertObject(value, "capabilities");
  rejectForbiddenCapabilityKeys(value);
  const json = JSON.stringify(value);
  if (new TextEncoder().encode(json).byteLength > H3_MAX_CAPABILITIES_BYTES) {
    throw new H3ProtocolError("capabilities is too large.", 422, "H3_CAPABILITIES_TOO_LARGE");
  }
  return value;
}

function rejectForbiddenCapabilityKeys(value, depth = 0) {
  if (depth > 4 || !value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (/^(?:path|url|command|env|host|port|token|secret|password|credential|cookie)/iu.test(key)) {
      throw new H3ProtocolError(`capabilities contains a forbidden field: ${key}.`, 422, "H3_CAPABILITIES_INVALID");
    }
    if (nested && typeof nested === "object") rejectForbiddenCapabilityKeys(nested, depth + 1);
  }
}

export function normalizePageSize(value) {
  if (value === undefined || value === null || value === "") return 25;
  const parsed = Number(value);
  return requireInteger(parsed, "pageSize", { min: 1, max: H3_MAX_PAGE_SIZE });
}

export function normalizeOffset(value) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  return requireInteger(parsed, "offset", { min: 0, max: 100000 });
}

export function canTransition(fromState, toState) {
  return H3_STATE_TRANSITIONS[fromState]?.includes(toState) || false;
}

export function assertTransition(fromState, toState) {
  if (!H3_STATES.includes(fromState) || !H3_STATES.includes(toState) || !canTransition(fromState, toState)) {
    throw new H3ProtocolError(
      `Illegal H3 state transition: ${fromState} -> ${toState}.`,
      409,
      "H3_STATE_TRANSITION_INVALID"
    );
  }
}

export function isTerminalState(state) {
  return H3_TERMINAL_STATES.has(state);
}

export function canonicalize(value) {
  return JSON.stringify(sortCanonicalValue(value));
}

export async function sha256Hex(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function canonicalJobPayload(value) {
  return canonicalize(normalizeJobCreateRequest(value));
}

function sortCanonicalValue(value) {
  if (Array.isArray(value)) return value.map(sortCanonicalValue);
  if (!value || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new H3ProtocolError("Canonical payload cannot contain non-finite numbers.", 422, "H3_CANONICAL_INVALID");
    }
    return value;
  }
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortCanonicalValue(value[key])]));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
