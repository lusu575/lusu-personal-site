import { existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const TOOL_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const PYTHON_AUDIT = path.join(TOOL_ROOT, "scripts", "tts", "audit_manifest_phonemes.py");
const RELEASE_AUDIO_ROOT = path.join(TOOL_ROOT, "audio");
const RELEASE_AUDIO_MANIFEST = path.join(RELEASE_AUDIO_ROOT, "manifest.json");

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!["--config", "--manifest", "--audio-root", "--content-root", "--python"].includes(token)) {
      throw new Error(`Unknown live-audit option: ${token}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${token} requires a value`);
    values.set(token, value);
    index += 1;
  }
  return values;
}

function requiredPath(value, envName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${envName} (or its matching CLI option) is required for the live release audit`);
  }
  return path.resolve(value.trim());
}

function pythonCommand(value, invocationCwd) {
  const command = String(value || "python").trim();
  if (!command) throw new Error("JP_SUBTEXT_PYTHON must not be empty");
  if (path.isAbsolute(command)) return path.normalize(command);
  if (command.includes("/") || command.includes("\\") || command.startsWith(".")) {
    return path.resolve(invocationCwd, command);
  }
  return command;
}

function samePath(left, right) {
  const normalize = (value) => {
    const normalized = path.normalize(value);
    return process.platform === "win32" ? normalized.toLowerCase() : normalized;
  };
  return normalize(left) === normalize(right);
}

function requireFile(filePath, label) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) throw new Error(`${label} is missing: ${filePath}`);
}

function requireDirectory(directoryPath, label) {
  if (!existsSync(directoryPath) || !statSync(directoryPath).isDirectory()) {
    throw new Error(`${label} is missing: ${directoryPath}`);
  }
}

export function resolveLiveAuditOptions({
  env = process.env,
  argv = process.argv.slice(2),
  checkFiles = true,
  cwd = process.cwd(),
} = {}) {
  const values = parseArguments(argv);
  const config = requiredPath(values.get("--config") || env.JP_SUBTEXT_TTS_CONFIG, "JP_SUBTEXT_TTS_CONFIG");
  const manifest = path.resolve(
    values.get("--manifest") || env.JP_SUBTEXT_AUDIO_MANIFEST || RELEASE_AUDIO_MANIFEST,
  );
  const audioRoot = path.resolve(
    values.get("--audio-root") || env.JP_SUBTEXT_AUDIO_ROOT || RELEASE_AUDIO_ROOT,
  );
  const contentRoot = path.resolve(values.get("--content-root") || env.JP_SUBTEXT_CONTENT_ROOT || path.join(TOOL_ROOT, "content"));
  const python = pythonCommand(values.get("--python") || env.JP_SUBTEXT_PYTHON || "python", cwd);
  if (!samePath(manifest, RELEASE_AUDIO_MANIFEST) || !samePath(audioRoot, RELEASE_AUDIO_ROOT)) {
    throw new Error("The final live audit must target the published repository audio root and manifest");
  }
  if (!samePath(path.dirname(manifest), audioRoot)) {
    throw new Error("The live-audit manifest must be located directly inside the explicitly configured audio root");
  }
  if (checkFiles) {
    requireFile(config, "TTS config");
    requireFile(manifest, "audio manifest");
    requireDirectory(audioRoot, "audio root");
    requireDirectory(contentRoot, "content root");
    requireFile(PYTHON_AUDIT, "live phoneme/media audit script");
  }
  return { config, manifest, audioRoot, contentRoot, python, pythonAudit: PYTHON_AUDIT };
}

export function runLiveAudioAudit(options = resolveLiveAuditOptions()) {
  const result = spawnSync(options.python, [
    options.pythonAudit,
    "--config",
    options.config,
    "--content-root",
    options.contentRoot,
    "--manifest",
    options.manifest,
  ], {
    cwd: TOOL_ROOT,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Fresh full-media Aivis audit failed with exit code ${result.status ?? "unknown"}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    runLiveAudioAudit();
  } catch (error) {
    console.error(`jp-subtext live audio audit: ${error.message}`);
    process.exitCode = 1;
  }
}
