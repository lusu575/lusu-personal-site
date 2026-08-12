import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { spawn } from "node:child_process";

export async function verifyFixedController(config) {
  const checks = [];
  for (const [label, path, expected] of [
    ["controller", config.controllerScript, config.controllerSha256],
    ["job schema", config.jobSchema, config.jobSchemaSha256],
    ["workflow lock", config.workflowLock, config.workflowLockSha256]
  ]) {
    const actual = await sha256File(path);
    checks.push({ label, path, ok: actual === expected, sha256: actual });
  }
  return {
    ok: checks.every((check) => check.ok),
    checks,
    fixedTarget: `${config.comfyHost}:${config.comfyPort}`
  };
}

export async function runController(config, args, { timeoutMs = 120000 } = {}) {
  validateControllerArgs(config, args);
  const child = spawn(config.controllerPython, [config.controllerScript, ...args], {
    cwd: config.stateRoot,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: controllerEnvironment()
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const exit = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Fixed controller command timed out."));
    }, timeoutMs);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
  return {
    ok: exit.code === 0,
    code: exit.code,
    signal: exit.signal,
    stdout: stdout.slice(-64 * 1024),
    stderr: stderr.slice(-16 * 1024)
  };
}

function controllerEnvironment() {
  const environment = { ...process.env };
  delete environment.H3_COMFY_CLI;
  return environment;
}

function validateControllerArgs(config, args) {
  if (!Array.isArray(args) || !args.length || args.some((arg) => typeof arg !== "string" || /[\r\n]/u.test(arg))) {
    throw new Error("Controller arguments must be a non-empty single-line string array.");
  }
  const [command, ...rest] = args;
  if (command === "doctor" && (
    rest.length === 0
    || (rest.length === 1 && rest[0] === "--offline")
    || (rest.length === 2 && rest[0] === "--job")
    || (rest.length === 3 && rest[0] === "--job" && rest[2] === "--offline")
  )) {
    if (rest[0] === "--job") assertStatePath(config, rest[1]);
    return;
  }
  if (command === "jobs" && rest.length === 0) return;
  if (command === "status" && rest.length === 1 && /^[A-Za-z0-9_-]{8,160}$/u.test(rest[0])) return;
  if (command === "download" && (rest.length === 1 || (rest.length === 3 && rest[1] === "--folder"))) {
    if (!/^[A-Za-z0-9_-]{8,160}$/u.test(rest[0])) throw new Error("The Runner may download only one validated prompt ID.");
    if (rest.length === 3) assertSafeFolder(rest[2]);
    return;
  }
  if (command === "wait" && rest.length >= 1 && rest.length <= 4) {
    const separator = rest.findIndex((value) => value.startsWith("--"));
    const promptIds = separator === -1 ? rest : rest.slice(0, separator);
    const flags = separator === -1 ? [] : rest.slice(separator);
    if (!promptIds.length || promptIds.length > 1 || promptIds.some((value) => !/^[A-Za-z0-9_-]{8,160}$/u.test(value))) {
      throw new Error("The Runner may wait for only one validated prompt ID.");
    }
    if (flags.length % 2 !== 0 || flags.some((flag, index) => index % 2 === 0
      ? !["--timeout", "--poll-interval"].includes(flag)
      : !/^\d+$/u.test(flag))) {
      throw new Error("Unsupported fixed-controller wait flag.");
    }
    return;
  }
  if (["validate", "run"].includes(command)) {
    const expected = command === "validate" ? 2 : null;
    const validValidate = expected !== null && (
      (rest.length === expected && rest[0] === "--job")
      || (rest.length === expected + 1 && rest[0] === "--job" && rest[2] === "--offline")
    );
    const validRun = command === "run"
      && (rest.length === 2 || rest.length === 3 || rest.length === 4 || rest.length === 5)
      && rest[0] === "--job";
    if (validValidate || validRun) {
      assertStatePath(config, rest[1]);
      if (command === "run") {
        const flags = rest.slice(2);
        if (flags.includes("--index")) {
          const indexPosition = flags.indexOf("--index");
          if (indexPosition !== 0 || flags.length < 2 || !/^1$/u.test(flags[1])) {
            throw new Error("The Runner may submit only the first fixed job.");
          }
          flags.splice(0, 2);
        }
        if (flags.some((flag) => !["--dry-run", "--wait-each"].includes(flag))) {
          throw new Error("Unsupported fixed-controller run flag.");
        }
      }
      return;
    }
  }
  if (command === "upload" && rest.length === 4 && rest[0] === "--file" && rest[2] === "--kind" && ["image", "video", "audio"].includes(rest[3])) {
    assertStatePath(config, rest[1]);
    return;
  }
  throw new Error("Unsupported or untrusted fixed-controller command.");
}

function assertStatePath(config, value) {
  if (!value || !isAbsolute(value)) throw new Error("Controller file arguments must be absolute local paths.");
  const root = resolve(config.stateRoot);
  const resolved = resolve(value);
  const relativePath = relative(root, resolved);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("Controller file argument must stay inside the Runner state root.");
  }
}

function assertSafeFolder(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(value)) {
    throw new Error("Controller output folder must be a simple local folder name.");
  }
}

async function sha256File(path) {
  const hash = createHash("sha256");
  hash.update(await readFile(path));
  return hash.digest("hex");
}
