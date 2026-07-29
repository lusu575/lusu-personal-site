import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  isHistoricalOneShotWindow,
  readAndValidateRun
} from "./validate-draft.mjs";
import { readDeliveryToken } from "./production-secrets.mjs";

const SITE_ROOT = resolve(import.meta.dirname, "..", "..", "..");
const DEV_VARS_PATH = resolve(SITE_ROOT, ".dev.vars");
const DEFAULT_ENDPOINT = "https://lusu575.com/api/automation/daily-ai-news";
const REQUEST_TIMEOUT_MS = 30_000;
const MINIMUM_REMAINING_WINDOW_MS = 45_000;
const DEADLINE_SAFETY_MARGIN_MS = 5_000;
const MAX_RESPONSE_BYTES = 64 * 1024;
const LANGUAGES = ["zh", "en", "ja"];
const ONE_SHOT_RECOVERY = Object.freeze({
  reportDate: "2026-07-29",
  timezone: "Asia/Shanghai",
  windowStart: "2026-07-28T07:00:00+08:00",
  windowEnd: "2026-07-29T07:00:00+08:00",
  allowedFrom: "2026-07-29T08:00:00+08:00",
  expiresAt: "2026-07-30T00:00:00+08:00",
  horizonRunId: "run-20260729T003352Z-8fda0f4c",
  candidateIndexSha256: "dfd9665165f7de0beb550eb14bfff13c95e38f77f3b0128f403c238e68a48ec9",
  slug: "daily-ai-news-2026-07-29",
  idempotencyKey: "daily-ai-news-2026-07-29-query-overflow-recovery-v1",
  source: "Codex manual recovery 2026-07-29 query-overflow",
  canonicalRunSha256: "f8d387ade09d2cada0837d73b5499d8702fb6efeafe59f012624c5ea158dc763"
});

export function parseProductionArgs(argv = process.argv.slice(2)) {
  const runIndex = argv.indexOf("--run");
  const runPath = runIndex >= 0 ? String(argv[runIndex + 1] || "").trim() : "";
  if (!runPath || runPath.startsWith("--")) {
    throw new Error("生产投递必须显式提供 --run <运行记录路径>，拒绝使用可能过期的默认样稿。");
  }
  const allowed = new Set(["--run", "--one-shot-history", "--one-shot-recovery"]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--run") {
      index += 1;
      continue;
    }
    if (!allowed.has(argument)) {
      throw new Error(`未知参数：${argument}`);
    }
  }
  const oneShotHistory = argv.includes("--one-shot-history");
  const oneShotRecovery = argv.includes("--one-shot-recovery");
  if (oneShotHistory && oneShotRecovery) {
    throw new Error("--one-shot-history 与 --one-shot-recovery 不能同时使用。");
  }
  return {
    runPath,
    oneShotHistory,
    oneShotRecovery
  };
}

export function validateProductionEndpoint(value) {
  let endpoint;
  try {
    endpoint = new URL(String(value || ""));
  } catch {
    throw new Error("生产投递地址不是有效 URL。");
  }
  if (endpoint.protocol !== "https:"
    || endpoint.hostname !== "lusu575.com"
    || endpoint.port
    || endpoint.username
    || endpoint.password
    || endpoint.search
    || endpoint.hash
    || endpoint.pathname !== "/api/automation/daily-ai-news") {
    throw new Error(
      "生产投递地址必须是 lusu575.com 上无凭证、无查询参数的 HTTPS 每日 AI 新闻接口。"
    );
  }
  return endpoint.toString();
}

export function assertProductionSchedule(run, {
  now = new Date(),
  oneShotHistory = false,
  oneShotRecovery = false,
  runFingerprint = ""
} = {}) {
  if (oneShotHistory && oneShotRecovery) {
    throw new Error("历史样稿与故障恢复模式不能同时启用。");
  }
  if (oneShotHistory) {
    if (!isHistoricalOneShotWindow(run)) {
      throw new Error("--one-shot-history 只允许 2026-07-27 23:00 历史样稿。");
    }
    return { deadlineAt: null, remainingMs: null };
  }
  if (oneShotRecovery) {
    if (!isAuthorizedOneShotRecovery(run, { now, runFingerprint })) {
      throw new Error(
        "--one-shot-recovery 只允许在登记时段投递已锁定指纹的 2026-07-29 故障恢复稿。"
      );
    }
    return { deadlineAt: null, remainingMs: null };
  }

  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) {
    throw new Error("无法读取当前时间，拒绝生产投递。");
  }
  const reportDate = shanghaiDate(now);
  if (run.reportDate !== reportDate) {
    throw new Error(`生产投递只允许当天运行记录；当前北京时间日期为 ${reportDate}。`);
  }
  const startAt = Date.parse(`${reportDate}T07:00:00+08:00`);
  const deadlineAt = Date.parse(`${reportDate}T08:00:00+08:00`);
  if (nowMs < startAt) {
    throw new Error("尚未到北京时间 07:00，拒绝提前生产投递。");
  }
  if (nowMs >= deadlineAt) {
    throw new Error("已到北京时间 08:00 硬截止，拒绝迟到补发。");
  }
  const remainingMs = deadlineAt - nowMs;
  if (remainingMs < MINIMUM_REMAINING_WINDOW_MS) {
    throw new Error("距离北京时间 08:00 不足 45 秒，拒绝发起可能越过截止线的请求。");
  }
  return { deadlineAt, remainingMs };
}

export function canonicalRunSha256(run) {
  return createHash("sha256")
    .update(JSON.stringify(run), "utf8")
    .digest("hex");
}

export function isAuthorizedOneShotRecovery(run, {
  now = new Date(),
  runFingerprint = ""
} = {}) {
  const nowMs = now.getTime();
  return Number.isFinite(nowMs)
    && nowMs >= Date.parse(ONE_SHOT_RECOVERY.allowedFrom)
    && nowMs < Date.parse(ONE_SHOT_RECOVERY.expiresAt)
    && run?.schemaVersion === 4
    && run?.reportDate === ONE_SHOT_RECOVERY.reportDate
    && run?.timezone === ONE_SHOT_RECOVERY.timezone
    && run?.windowStart === ONE_SHOT_RECOVERY.windowStart
    && run?.windowEnd === ONE_SHOT_RECOVERY.windowEnd
    && run?.horizonRun?.runId === ONE_SHOT_RECOVERY.horizonRunId
    && run?.coverageAudit?.candidateIndexSha256
      === ONE_SHOT_RECOVERY.candidateIndexSha256
    && run?.delivery?.slug === ONE_SHOT_RECOVERY.slug
    && run?.delivery?.idempotencyKey === ONE_SHOT_RECOVERY.idempotencyKey
    && run?.delivery?.source === ONE_SHOT_RECOVERY.source
    && runFingerprint === ONE_SHOT_RECOVERY.canonicalRunSha256;
}

export function validateDeliveryResponse({
  httpStatus,
  responseOk,
  payload,
  run
}) {
  if (!responseOk) {
    const message = String(payload?.error || payload?.message || "未知错误").slice(0, 300);
    throw new Error(`生产投递失败（${httpStatus}）：${message}`);
  }
  if (payload?.ok !== true
    || payload?.category !== "daily-ai-news"
    || payload?.status !== "published"
    || payload?.slug !== run.delivery.slug
    || !String(payload?.articleId || "").trim()) {
    throw new Error("生产接口未确认文章已在 daily-ai-news 分区公开，流程停止且不得自动重试。");
  }
  return payload;
}

export function publicArticleUrls(endpoint, slug) {
  const origin = new URL(validateProductionEndpoint(endpoint)).origin;
  return Object.fromEntries(LANGUAGES.map((lang) => [
    lang,
    `${origin}/api/articles/${encodeURIComponent(slug)}?lang=${lang}`
  ]));
}

export function validatePublicArticlePayload({ payload, lang, run }) {
  const article = payload?.article;
  const expected = run.delivery.translations?.[lang];
  if (!article
    || !expected
    || article.slug !== run.delivery.slug
    || article.category !== "daily-ai-news"
    || article.status !== "published"
    || article.lang !== lang
    || article.requested_lang !== lang
    || article.title !== expected.title
    || String(article.content_markdown || "").trim()
      !== String(expected.content_markdown || "").trim()) {
    throw new Error(
      `${lang} 公开文章核验失败：slug、分区、语言、标题或正文与本期稿件不一致；`
      + "不得自动重试。"
    );
  }
  return article;
}

export async function verifyPublicArticleTranslations({
  endpoint,
  run,
  fetchImpl = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS
}) {
  const urls = publicArticleUrls(endpoint, run.delivery.slug);
  await Promise.all(LANGUAGES.map(async (lang) => {
    let response;
    try {
      response = await fetchImpl(urls[lang], {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Cache-Control": "no-cache"
        },
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      throw new Error(`${lang} 公开文章读取失败：${String(error?.message || error)}；不得自动重试。`);
    }
    const payload = await readJsonResponse(response, `${lang} 公开文章`);
    if (!response.ok) {
      throw new Error(`${lang} 公开文章接口返回 ${response.status}；不得自动重试。`);
    }
    validatePublicArticlePayload({ payload, lang, run });
  }));
}

export function shanghaiDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function main() {
  const args = parseProductionArgs();
  const { run } = await readAndValidateRun(args.runPath, {
    allowHistoricalOneShot: args.oneShotHistory
  });
  const schedule = assertProductionSchedule(run, {
    ...args,
    runFingerprint: canonicalRunSha256(run)
  });
  const endpoint = validateProductionEndpoint(
    process.env.DAILY_AI_NEWS_ENDPOINT || DEFAULT_ENDPOINT
  );
  const token = await readDeliveryToken({
    env: process.env,
    devVarsPath: DEV_VARS_PATH
  });
  const timeoutMs = schedule.remainingMs === null
    ? REQUEST_TIMEOUT_MS
    : Math.min(
      REQUEST_TIMEOUT_MS,
      schedule.remainingMs - DEADLINE_SAFETY_MARGIN_MS
    );

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": run.delivery.idempotencyKey
      },
      body: JSON.stringify(run.delivery),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    throw new Error(`生产投递请求未完成：${redact(String(error?.message || error), token)}`);
  }

  const payload = await readJsonResponse(response, "生产接口");
  validateDeliveryResponse({
    httpStatus: response.status,
    responseOk: response.ok,
    payload,
    run
  });

  const verificationTimeoutMs = remainingTimeoutBeforeDeadline(schedule);
  await verifyPublicArticleTranslations({
    endpoint,
    run,
    timeoutMs: verificationTimeoutMs
  });
  if (schedule.deadlineAt !== null && Date.now() >= schedule.deadlineAt) {
    throw new Error("公开核验在北京时间 08:00 后才完成；不得自动重试，请人工核对文章状态。");
  }
  console.log(
    `daily-ai-news-production-delivery: published`
    + ` (${run.reportDate}, duplicate=${Boolean(payload.duplicate)})`
  );
  console.log(payload.slug);
}

function redact(value, secret) {
  return secret ? String(value).replaceAll(secret, "[redacted]") : String(value);
}

async function readJsonResponse(response, label) {
  const responseText = await response.text();
  if (Buffer.byteLength(responseText, "utf8") > MAX_RESPONSE_BYTES) {
    throw new Error(`${label}响应过大，拒绝继续处理。`);
  }
  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(`${label}未返回有效 JSON，流程停止且不得自动重试。`);
  }
}

function remainingTimeoutBeforeDeadline(schedule) {
  if (schedule.deadlineAt === null) {
    return REQUEST_TIMEOUT_MS;
  }
  const remainingMs = schedule.deadlineAt - Date.now();
  if (remainingMs <= DEADLINE_SAFETY_MARGIN_MS + 1_000) {
    throw new Error("留给公开文章核验的时间不足，停止且不得自动重试。");
  }
  return Math.min(REQUEST_TIMEOUT_MS, remainingMs - DEADLINE_SAFETY_MARGIN_MS);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
