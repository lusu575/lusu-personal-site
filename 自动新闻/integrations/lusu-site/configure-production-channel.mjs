import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertDeliveryToken,
  assertDevVarsIgnored,
  parseDevVars,
  removeDevVar,
  upsertDevVar,
  writeDevVarsSafely
} from "./production-secrets.mjs";

const SITE_ROOT = resolve(import.meta.dirname, "..", "..", "..");
const DEV_VARS_PATH = resolve(SITE_ROOT, ".dev.vars");
const GITIGNORE_PATH = resolve(SITE_ROOT, ".gitignore");
const WRANGLER_CLI = resolve(SITE_ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const DATABASE_NAME = "lusu_personal_site";
const ACTIVE_TOKEN_KEY = "DAILY_AI_NEWS_TOKEN";
const PENDING_TOKEN_KEY = "DAILY_AI_NEWS_TOKEN_PENDING";

export function buildProductionChannelSql({
  tokenHash,
  tokenHint,
  timestamp
}) {
  if (!/^[a-f0-9]{64}$/.test(String(tokenHash || ""))
    || !/^[A-Za-z0-9_-]{6}$/.test(String(tokenHint || ""))
    || !Number.isFinite(Date.parse(String(timestamp || "")))) {
    throw new Error("生产通道配置参数不正确。");
  }
  return `
    insert into article_delivery_channels (
      channel_key, category, enabled, auto_publish, token_hash, token_hint,
      token_created_at, last_used_at, created_at, updated_at
    ) values (
      'daily-ai-news', 'daily-ai-news', 1, 1,
      ${sqlText(tokenHash)}, ${sqlText(tokenHint)}, ${sqlText(timestamp)},
      null, ${sqlText(timestamp)}, ${sqlText(timestamp)}
    )
    on conflict(channel_key) do update set
      category = 'daily-ai-news',
      enabled = 1,
      auto_publish = 1,
      token_hash = excluded.token_hash,
      token_hint = excluded.token_hint,
      token_created_at = excluded.token_created_at,
      updated_at = excluded.updated_at;
    select channel_key, category, enabled, auto_publish, token_hint
    from article_delivery_channels
    where channel_key = 'daily-ai-news';
  `.replace(/\s+/g, " ").trim();
}

export function redactedTokenSummary(token) {
  assertDeliveryToken(token);
  const hash = createHash("sha256").update(token).digest("hex");
  return `尾号 ${token.slice(-6)} / SHA-256 ${hash.slice(0, 12)}…`;
}

async function main() {
  if (!process.argv.slice(2).includes("--confirm-production")) {
    throw new Error(
      "此操作会写入远端 D1 并启用自动公开；"
      + "必须显式添加 --confirm-production，且上线准备完成后再单独运行。"
    );
  }
  if (!existsSync(WRANGLER_CLI)) {
    throw new Error("未找到项目内 Wrangler，拒绝配置生产通道。");
  }
  await assertDevVarsIgnored(GITIGNORE_PATH);

  let devVarsSource = "";
  try {
    devVarsSource = await readFile(DEV_VARS_PATH, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
  const currentValues = parseDevVars(devVarsSource);
  const token = currentValues[PENDING_TOKEN_KEY]
    || `lusu_ai_news_${randomBytes(32).toString("base64url")}`;
  assertDeliveryToken(token);

  if (!currentValues[PENDING_TOKEN_KEY]) {
    devVarsSource = upsertDevVar(devVarsSource, PENDING_TOKEN_KEY, token);
    await writeDevVarsSafely(DEV_VARS_PATH, devVarsSource);
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const timestamp = new Date().toISOString();
  await runWrangler([
    "d1",
    "execute",
    DATABASE_NAME,
    "--remote",
    "--command",
    buildProductionChannelSql({
      tokenHash,
      tokenHint: token.slice(-6),
      timestamp
    })
  ]);

  const latestSource = await readFile(DEV_VARS_PATH, "utf8");
  if (parseDevVars(latestSource)[PENDING_TOKEN_KEY] !== token) {
    throw new Error("远端已更新，但本地待生效令牌不一致；请勿投递并立即人工检查。");
  }
  const promotedSource = removeDevVar(
    upsertDevVar(latestSource, ACTIVE_TOKEN_KEY, token),
    PENDING_TOKEN_KEY
  );
  await writeDevVarsSafely(DEV_VARS_PATH, promotedSource);

  console.log(`daily-ai-news-production-channel: enabled + auto_publish (${redactedTokenSummary(token)})`);
  console.log("令牌仅保存在被忽略的根目录 .dev.vars；未输出明文。");
}

function runWrangler(args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [WRANGLER_CLI, ...args], {
      cwd: SITE_ROOT,
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        output = `${output}${chunk}`.slice(-20_000);
      });
    }
    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(new Error(`生产通道远端配置失败（${code}）。\n${output}`));
    });
  });
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
