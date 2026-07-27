import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { readAndValidateRun } from "./validate-draft.mjs";

const SITE_ROOT = resolve(import.meta.dirname, "..", "..", "..");
const WRANGLER_CLI = resolve(SITE_ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const DATABASE_NAME = "lusu_personal_site";
const DEFAULT_RUN = resolve(import.meta.dirname, "runs", "2026-07-27-2300.json");
const PREVIEW_PORT = 8793;

if (!existsSync(WRANGLER_CLI)) {
  throw new Error("本地 Wrangler 不存在，无法进行草稿试投。");
}

const { run } = await readAndValidateRun(requestedPath(), {
  allowHistoricalOneShot: process.argv.includes("--one-shot-history")
});
const token = `lusu_ai_news_${randomBytes(32).toString("base64url")}`;
const tokenHash = createHash("sha256").update(token).digest("hex");
const now = new Date().toISOString();
let preview = null;

try {
  await configureLocalChannel({
    enabled: true,
    tokenHash,
    tokenHint: token.slice(-6),
    tokenCreatedAt: now
  });
  preview = startPreview();
  await waitForHealth(preview);

  const response = await fetch(`http://127.0.0.1:${PREVIEW_PORT}/api/automation/daily-ai-news`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": run.delivery.idempotencyKey
    },
    body: JSON.stringify(run.delivery)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`本地草稿投递失败（${response.status}）：${payload.error || "未知错误"}`);
  }
  if (payload.status !== "draft"
    || payload.category !== "daily-ai-news"
    || payload.slug !== run.delivery.slug) {
    throw new Error("本地接口未确认 daily-ai-news 草稿，拒绝把异常结果当作成功。");
  }
  console.log(`daily-ai-news-local-delivery: ok (${payload.status}, duplicate=${Boolean(payload.duplicate)})`);
  console.log(payload.slug);
} finally {
  await stopPreview(preview);
  await configureLocalChannel({
    enabled: false,
    tokenHash: "",
    tokenHint: "",
    tokenCreatedAt: null
  });
}

function requestedPath() {
  const index = process.argv.indexOf("--run");
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : DEFAULT_RUN;
}

async function configureLocalChannel({ enabled, tokenHash, tokenHint, tokenCreatedAt }) {
  const updatedAt = new Date().toISOString();
  const sql = `
    update article_delivery_channels
    set enabled = ${enabled ? 1 : 0},
        auto_publish = 0,
        token_hash = ${sqlText(tokenHash)},
        token_hint = ${sqlText(tokenHint)},
        token_created_at = ${tokenCreatedAt ? sqlText(tokenCreatedAt) : "null"},
        updated_at = ${sqlText(updatedAt)}
    where channel_key = 'daily-ai-news';
  `.replace(/\s+/g, " ").trim();
  await runWrangler([
    "d1",
    "execute",
    DATABASE_NAME,
    "--local",
    "--command",
    sql
  ]);
}

function startPreview() {
  const child = spawn(process.execPath, [
    WRANGLER_CLI,
    "pages",
    "dev",
    "--port",
    String(PREVIEW_PORT)
  ], {
    cwd: SITE_ROOT,
    env: process.env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.output = "";
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      child.output = `${child.output}${chunk}`.slice(-20000);
    });
  }
  return child;
}

async function waitForHealth(child) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`本地网站启动失败。\n${child.output}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${PREVIEW_PORT}/api/health`);
      const payload = await response.json();
      if (response.ok && payload.ok === true && payload.db === true) {
        return;
      }
    } catch {
      // Preview is still starting.
    }
    await delay(500);
  }
  throw new Error(`等待本地网站启动超时。\n${child.output}`);
}

async function stopPreview(child) {
  if (!child || child.exitCode !== null) {
    return;
  }
  child.kill();
  await Promise.race([
    new Promise((resolveClose) => child.once("close", resolveClose)),
    delay(3000)
  ]);
  if (child.exitCode !== null) {
    return;
  }
  await runProcess("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
    cwd: SITE_ROOT,
    ignoreFailure: true
  });
}

async function runWrangler(args) {
  await runProcess(process.execPath, [WRANGLER_CLI, ...args], { cwd: SITE_ROOT });
}

function runProcess(command, args, { cwd, ignoreFailure = false } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        output = `${output}${chunk}`.slice(-20000);
      });
    }
    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0 || ignoreFailure) {
        resolveRun(output);
        return;
      }
      rejectRun(new Error(`命令执行失败（${code}）。\n${output}`));
    });
  });
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}
