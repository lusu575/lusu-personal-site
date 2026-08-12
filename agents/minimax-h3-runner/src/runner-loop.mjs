import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { runController } from "./controller-adapter.mjs";
import { copyVerifiedResult, jobPaths, persistClaim, writeJsonAtomic } from "./job-store.mjs";

const POLL_FALLBACK_SECONDS = 8;

export async function loadInstallationId(config) {
  const path = resolve(config.installationIdFile);
  try {
    const value = (await readFile(path, "utf8")).trim();
    if (/^[A-Za-z0-9_-]{16,256}$/u.test(value)) return value;
  } catch {
    // Create below.
  }
  const value = randomBytes(32).toString("hex");
  await mkdir(resolve(config.stateRoot), { recursive: true });
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, value, { encoding: "utf8", flag: "wx" });
    return value;
  } catch (error) {
    if (error?.code === "EEXIST") return (await readFile(path, "utf8")).trim();
    throw error;
  }
}

export async function runPreflight(config) {
  const doctor = await runController(config, ["doctor"], { timeoutMs: 120000 });
  const envelope = parseControllerEnvelope(doctor.stdout, "doctor", { allowFailure: true });
  return { ok: envelope.ok === true && envelope.data?.ready === true, envelope };
}

export function createRunnerCapabilities({ preflight, bridgeOnline, diskFreeBytes }) {
  return {
    agentReady: true,
    bridgeOnline,
    comfyReachable: Boolean(preflight?.ok),
    controllerDoctorOk: Boolean(preflight?.ok),
    diskState: diskState(diskFreeBytes),
    protocolVersion: "1.0",
    controllerVersion: "2026-08-04_v4"
  };
}

export async function runClaimedJob({ config, site, claimed, onHeartbeat, onLog }) {
  const paths = jobPaths(config, claimed.jobId);
  const plan = buildLocalT2VPlan(claimed.spec);
  await persistClaim(config, claimed, plan, paths);
  let currentRevision = claimed.revision;
  let localState = "claimed";
  let promptId = "";
  try {
    await reportEvent(site, claimed, currentRevision, "job.validating", "validating", "preflight", 500, "Fixed H3 plan validation started.");
    currentRevision += 1;
    localState = "validating";
    await writeJsonAtomic(paths.job, { ...claimed, localState, revision: currentRevision, planPath: paths.plan });

    const doctor = parseControllerEnvelope(
      (await runController(config, ["doctor", "--job", paths.plan], { timeoutMs: 120000 })).stdout,
      "doctor"
    );
    if (!doctor.ok || doctor.data?.ready !== true) throw new RunnerJobError("H3_DOCTOR_FAILED", "Fixed H3 doctor did not pass.");
    const validation = parseControllerEnvelope(
      (await runController(config, ["validate", "--job", paths.plan], { timeoutMs: 180000 })).stdout,
      "validate"
    );
    if (!validation.ok) throw new RunnerJobError("H3_VALIDATE_FAILED", "Fixed H3 validation did not pass.");

    let runResult;
    try {
      runResult = await runController(config, ["run", "--job", paths.plan, "--index", "1"], { timeoutMs: 300000 });
    } catch (error) {
      throw new RunnerJobError("H3_SUBMIT_UNCERTAIN", "Fixed controller submission outcome could not be confirmed.", { uncertain: true, cause: error });
    }
    const runEnvelope = parseControllerEnvelope(runResult.stdout, "run");
    promptId = findPromptId(runEnvelope);
    if (!promptId) throw new RunnerJobError("H3_PROMPT_ID_MISSING", "Fixed controller did not return a prompt ID.", { uncertain: true });
    await writeJsonAtomic(paths.job, { ...claimed, localState: "submitted", revision: currentRevision, promptId, planPath: paths.plan });
    localState = "submitted";
    await reportEvent(site, claimed, currentRevision, "job.submitted", "submitted", "submit", 1000, "Fixed H3 controller accepted the job.");
    currentRevision += 1;

    while (true) {
      await onHeartbeat?.(claimed.jobId);
      const statusResult = await runController(config, ["status", promptId], { timeoutMs: 120000 });
      const statusEnvelope = parseControllerEnvelope(statusResult.stdout, "status");
      const status = controllerStatus(statusEnvelope);
      if (["queued", "pending", "running", "executing"].includes(status)) {
        if (localState === "submitted") {
          await reportEvent(site, claimed, currentRevision, "job.running", "running", "execute", 2500, "ComfyUI is executing the fixed H3 job.");
          currentRevision += 1;
          localState = "running";
          await writeJsonAtomic(paths.job, { ...claimed, localState, revision: currentRevision, promptId, planPath: paths.plan });
        }
        await delay((config.pollSeconds || POLL_FALLBACK_SECONDS) * 1000);
        continue;
      }
      if (["completed", "success", "succeeded"].includes(status)) break;
      if (["error", "failed", "cancelled"].includes(status)) {
        throw new RunnerJobError("H3_CONTROLLER_JOB_FAILED", "ComfyUI reported a terminal failure.");
      }
      throw new RunnerJobError("H3_CONTROLLER_STATUS_UNKNOWN", "ComfyUI returned an unknown job state.", { uncertain: true });
    }

    if (localState === "submitted") {
      await reportEvent(site, claimed, currentRevision, "job.running", "running", "execute", 7500, "ComfyUI completed the submitted job.");
      currentRevision += 1;
      localState = "running";
    }
    await reportEvent(site, claimed, currentRevision, "job.retrieving", "retrieving", "download", 9000, "Retrieving the generated result from the fixed controller.");
    currentRevision += 1;
    localState = "retrieving";
    const downloadEnvelope = parseControllerEnvelope(
      (await runController(config, ["download", promptId], { timeoutMs: 600000 })).stdout,
      "download"
    );
    const result = await materializeResult(config, paths, downloadEnvelope);
    await writeJsonAtomic(paths.job, { ...claimed, localState: "ready", revision: currentRevision, promptId, planPath: paths.plan, result });
    const completed = await site.request(`/api/agent/minimax-h3/jobs/${claimed.jobId}/complete`, {
      method: "POST",
      body: { ...leaseBody(claimed, currentRevision), resultName: result.name, resultMime: result.mime, resultBytes: result.bytes, resultSha256: result.sha256 }
    });
    onLog?.({ jobId: claimed.jobId, state: completed?.state || "ready" });
    return completed;
  } catch (error) {
    const uncertain = error?.uncertain === true;
    if (uncertain || localState === "submitted") {
      await tryReportEvent(site, claimed, currentRevision, "job.stalled", "stalled", "reconcile", 0, "Runner stopped because submit state could not be confirmed.");
    } else {
      await tryReportFailure(site, claimed, currentRevision, error?.code || "H3_RUNNER_FAILURE", error?.message || "Runner failed the job.");
    }
    await writeJsonAtomic(paths.job, { ...claimed, localState: uncertain ? "stalled" : "failed", revision: currentRevision, promptId, planPath: paths.plan });
    throw error;
  }
}

export class RunnerJobError extends Error {
  constructor(code, message, { uncertain = false, cause = undefined } = {}) {
    super(message);
    this.name = "RunnerJobError";
    this.code = code;
    this.uncertain = uncertain;
    if (cause) this.cause = cause;
  }
}

export function buildLocalT2VPlan(spec) {
  const job = spec?.job;
  if (!spec || !job || job.mode !== "t2v" || (job.references || []).length) {
    throw new RunnerJobError("H3_PHASE_NOT_OPEN", "Runner accepts only reference-free T2V jobs in this phase.");
  }
  if (job.seed !== null && Number.isSafeInteger(Number(job.seed)) === false) {
    throw new RunnerJobError("H3_SEED_UNSUPPORTED", "This Runner cannot safely represent the requested uint64 seed.");
  }
  return {
    schema_version: "1.0",
    project_title: spec.projectTitle,
    source_language: spec.sourceLanguage,
    queue_policy: "sequential_fifo",
    jobs: [{
      mode: "t2v",
      duration_seconds: job.durationSeconds,
      target_frames: job.targetFrames,
      aspect_ratio: job.aspectRatio,
      preset: job.preset,
      prompt: job.prompt,
      references: [],
      include_video_audio: job.includeVideoAudio,
      seed: job.seed === null ? null : Number(job.seed),
      title: spec.projectTitle
    }]
  };
}

async function materializeResult(config, paths, envelope) {
  const files = Array.isArray(envelope?.data?.files) ? envelope.data.files : [];
  const file = files.find((candidate) => typeof candidate?.path === "string" && /\.(?:mp4|webm|mov|mkv)$/iu.test(candidate.path));
  if (!file || !/^[0-9a-f]{64}$/u.test(String(file.sha256 || "")) || !Number.isSafeInteger(file.bytes) || file.bytes <= 0) {
    throw new RunnerJobError("H3_RESULT_INVALID", "Controller returned no verified video result.");
  }
  const source = resolve(file.path);
  const root = resolve(config.outputRoot);
  if (!isWithin(root, source)) throw new RunnerJobError("H3_RESULT_PATH_INVALID", "Controller result was outside the fixed output root.");
  const sourceInfo = await stat(source);
  if (sourceInfo.size !== file.bytes) throw new RunnerJobError("H3_RESULT_SIZE_MISMATCH", "Controller result size changed before copy.");
  const resultPath = join(paths.resultDir, `result${extensionFor(file.path)}`);
  const copied = await copyVerifiedResult(source, resultPath, file.sha256);
  return { name: `result${extensionFor(file.path)}`, mime: mimeFor(file.path), ...copied };
}

function leaseBody(claimed, expectedRevision) {
  return { runnerId: claimed.runnerId, leaseId: claimed.leaseId, leaseGeneration: claimed.leaseGeneration, expectedRevision };
}

async function reportEvent(site, claimed, expectedRevision, eventType, toState, stageCode, progressBasisPoints, summary) {
  return site.request(`/api/agent/minimax-h3/jobs/${claimed.jobId}/events`, { method: "POST", body: {
    ...leaseBody(claimed, expectedRevision), eventType, toState, stageCode, progressBasisPoints, summary
  }});
}

async function tryReportEvent(...args) {
  try { return await reportEvent(...args); } catch { return null; }
}

async function tryReportFailure(site, claimed, expectedRevision, errorCode, errorSummary) {
  try {
    return await site.request(`/api/agent/minimax-h3/jobs/${claimed.jobId}/fail`, { method: "POST", body: {
      ...leaseBody(claimed, expectedRevision), errorCode: /^[A-Z0-9_]{3,80}$/u.test(errorCode) ? errorCode : "H3_RUNNER_FAILURE", errorSummary: String(errorSummary).slice(0, 200)
    }});
  } catch { return null; }
}

function parseControllerEnvelope(stdout, command, { allowFailure = false } = {}) {
  let parsed;
  try { parsed = JSON.parse(String(stdout || "").trim()); } catch { throw new RunnerJobError("H3_CONTROLLER_INVALID_JSON", `Fixed controller returned invalid ${command} JSON.`); }
  if (!parsed || parsed.schema !== "minimax-h3-local/1" || parsed.command !== command || (!allowFailure && parsed.ok !== true)) {
    throw new RunnerJobError("H3_CONTROLLER_REJECTED", `Fixed controller rejected ${command}.`);
  }
  return parsed;
}

function findPromptId(envelope) {
  const jobs = Array.isArray(envelope.data?.jobs) ? envelope.data.jobs : [];
  return typeof jobs[0]?.prompt_id === "string" ? jobs[0].prompt_id : "";
}

function controllerStatus(envelope) {
  const value = firstStatusValue([
    envelope.data?.response?.data,
    envelope.data?.response,
    envelope.data
  ]);
  return String(value || "").trim().toLowerCase();
}

function firstStatusValue(values) {
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    for (const key of ["status", "state", "job_status", "jobState"]) {
      if (typeof value[key] === "string" && value[key].trim()) return value[key];
    }
    for (const key of ["job", "result", "data"]) {
      const nested = value[key];
      if (nested && typeof nested === "object") {
        const found = firstStatusValue([nested]);
        if (found) return found;
      }
    }
  }
  return "";
}

function diskState(bytes) {
  if (!Number.isFinite(bytes)) return "unknown";
  if (bytes < 50 * 1024 ** 3) return "low";
  return "ok";
}

function extensionFor(path) {
  const match = String(path).match(/\.(mp4|webm|mov|mkv)$/iu);
  return match ? `.${match[1].toLowerCase()}` : ".mp4";
}

function mimeFor(path) {
  const extension = extensionFor(path);
  return extension === ".webm" ? "video/webm" : extension === ".mov" ? "video/quicktime" : "video/mp4";
}

function isWithin(root, target) {
  const child = relative(root, target);
  return child === "" || (child !== ".." && !child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !/^[A-Za-z]:/u.test(child));
}

function delay(ms) { return new Promise((resolvePromise) => setTimeout(resolvePromise, ms)); }
