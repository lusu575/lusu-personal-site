import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  isHistoricalOneShotWindow,
  readAndValidateRun
} from "./validate-draft.mjs";
import { createProxyAwareFetch } from "./network-fetch.mjs";
import { readDeliveryToken } from "./production-secrets.mjs";

const SITE_ROOT = resolve(import.meta.dirname, "..", "..", "..");
const DEV_VARS_PATH = resolve(SITE_ROOT, ".dev.vars");
const DEFAULT_ENDPOINT = "https://lusu575.com/api/automation/daily-ai-news";
const REQUEST_TIMEOUT_MS = 30_000;
const MINIMUM_REMAINING_WINDOW_MS = 45_000;
const DEADLINE_SAFETY_MARGIN_MS = 5_000;
const MAX_RESPONSE_BYTES = 64 * 1024;
const LANGUAGES = ["zh", "en", "ja"];
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const PUBLIC_READBACK_RETRY_DELAYS_MS = Object.freeze([250, 750]);
const PUBLIC_READBACK_ATTEMPT_TIMEOUT_MS = 10_000;
const TRANSIENT_READBACK_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const CONTINUOUS_WINDOW_POLICY = "previous-collection-start-to-current-execution-start-v2";
const CONTINUOUS_WINDOW_EFFECTIVE_DATE = "2026-09-04";

export function parseProductionArgs(argv = process.argv.slice(2)) {
  let runPath = "";
  let oneShotHistory = false;
  let manualRecovery = false;
  let confirmReportDate = "";
  let confirmRunSha256 = "";
  let printRunSha256 = false;
  const seen = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (seen.has(argument)) {
      throw new Error(`参数不能重复：${argument}`);
    }
    seen.add(argument);
    if (argument === "--one-shot-history") {
      oneShotHistory = true;
      continue;
    }
    if (argument === "--manual-recovery") {
      manualRecovery = true;
      continue;
    }
    if (argument === "--print-run-sha256") {
      printRunSha256 = true;
      continue;
    }
    if (argument === "--run"
      || argument === "--confirm-report-date"
      || argument === "--confirm-run-sha256") {
      const value = String(argv[index + 1] || "").trim();
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} 缺少参数值。`);
      }
      index += 1;
      if (argument === "--run") {
        runPath = value;
      } else if (argument === "--confirm-report-date") {
        confirmReportDate = value;
      } else {
        confirmRunSha256 = value;
      }
      continue;
    }
    throw new Error(`未知参数：${argument}`);
  }

  if (!runPath || runPath.startsWith("--")) {
    throw new Error("生产投递必须显式提供 --run <运行记录路径>，拒绝使用可能过期的默认样稿。");
  }
  if (oneShotHistory && manualRecovery) {
    throw new Error("--one-shot-history 与 --manual-recovery 不能同时使用。");
  }
  if (manualRecovery && (!confirmReportDate || !confirmRunSha256)) {
    throw new Error(
      "--manual-recovery 必须同时提供 --confirm-report-date 与 --confirm-run-sha256。"
    );
  }
  if (!manualRecovery && (confirmReportDate || confirmRunSha256)) {
    throw new Error("人工补发确认参数只能与 --manual-recovery 同时使用。");
  }
  if (confirmReportDate && !isValidIsoDate(confirmReportDate)) {
    throw new Error("--confirm-report-date 必须是有效的 YYYY-MM-DD 日期。");
  }
  if (confirmRunSha256 && !SHA256_PATTERN.test(confirmRunSha256)) {
    throw new Error("--confirm-run-sha256 必须是 64 位小写 SHA-256。");
  }
  if (printRunSha256 && manualRecovery) {
    throw new Error("--print-run-sha256 与 --manual-recovery 不能同时使用。");
  }
  return {
    runPath,
    oneShotHistory,
    manualRecovery,
    confirmReportDate,
    confirmRunSha256,
    printRunSha256
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
  manualRecovery = false,
  confirmReportDate = "",
  confirmRunSha256 = ""
} = {}) {
  if (oneShotHistory && manualRecovery) {
    throw new Error("历史样稿与故障恢复模式不能同时启用。");
  }
  if (oneShotHistory) {
    if (confirmReportDate || confirmRunSha256) {
      throw new Error("历史样稿不能使用人工补发确认参数。");
    }
    if (!isHistoricalOneShotWindow(run)) {
      throw new Error("--one-shot-history 只允许 2026-07-27 23:00 历史样稿。");
    }
    return { deadlineAt: null, remainingMs: null };
  }
  if (manualRecovery) {
    if (!isAuthorizedManualRecovery(run, {
      now,
      confirmReportDate,
      confirmRunSha256
    })) {
      throw new Error(
        "--manual-recovery 只允许站长明确授权后，在当日采集开始至次日 00:00"
        + " 投递日期、连续采集窗口与完整稿件指纹均已双确认的 schemaVersion 4 稿件。"
      );
    }
    const deadlineAt = Date.parse(
      `${shiftIsoDate(confirmReportDate, 1)}T00:00:00+08:00`
    );
    const remainingMs = deadlineAt - now.getTime();
    if (remainingMs < MINIMUM_REMAINING_WINDOW_MS) {
      throw new Error(
        "距离北京时间当天人工补发截止不足 45 秒，拒绝发起可能跨日的请求。"
      );
    }
    return { deadlineAt, remainingMs };
  }
  if (confirmReportDate || confirmRunSha256) {
    throw new Error("人工补发确认参数只能与 --manual-recovery 同时使用。");
  }

  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) {
    throw new Error("无法读取当前时间，拒绝生产投递。");
  }
  const reportDate = shanghaiDate(now);
  if (run.reportDate !== reportDate) {
    throw new Error(`生产投递只允许当天运行记录；当前北京时间日期为 ${reportDate}。`);
  }
  const startAt = Date.parse(run.collectionStartedAt || `${reportDate}T07:00:00+08:00`);
  const deadlineAt = Date.parse(`${shiftIsoDate(reportDate, 1)}T00:00:00+08:00`);
  if (nowMs < startAt) {
    throw new Error("尚未到本期采集启动时刻，拒绝提前生产投递。");
  }
  const remainingMs = deadlineAt - nowMs;
  if (remainingMs < MINIMUM_REMAINING_WINDOW_MS) {
    throw new Error("距离北京时间当天投递截止不足 45 秒，拒绝发起可能跨日的请求。");
  }
  return { deadlineAt, remainingMs };
}

export function canonicalRunSha256(run) {
  return createHash("sha256")
    .update(JSON.stringify(run), "utf8")
    .digest("hex");
}

export function isAuthorizedManualRecovery(run, {
  now = new Date(),
  confirmReportDate = "",
  confirmRunSha256 = ""
} = {}) {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)
    || !isValidIsoDate(confirmReportDate)
    || !SHA256_PATTERN.test(confirmRunSha256)) {
    return false;
  }
  const nextDate = shiftIsoDate(confirmReportDate, 1);
  const usesContinuousWindow = confirmReportDate >= CONTINUOUS_WINDOW_EFFECTIVE_DATE;
  const allowedFrom = Date.parse(
    usesContinuousWindow
      ? run?.collectionStartedAt
      : `${confirmReportDate}T07:00:00+08:00`
  );
  const expiresAt = Date.parse(`${nextDate}T00:00:00+08:00`);
  return Number.isFinite(nowMs)
    && nowMs >= allowedFrom
    && nowMs < expiresAt
    && shanghaiDate(now) === confirmReportDate
    && run?.schemaVersion === 4
    && run?.reportDate === confirmReportDate
    && run?.timezone === "Asia/Shanghai"
    && (usesContinuousWindow
      ? run?.windowPolicy === CONTINUOUS_WINDOW_POLICY
        && run?.previousCollectionStartedAt === run?.windowStart
        && run?.collectionStartedAt === run?.windowEnd
      : run?.windowStart === `${shiftIsoDate(confirmReportDate, -1)}T07:00:00+08:00`
        && run?.windowEnd === `${confirmReportDate}T07:00:00+08:00`)
    && run?.delivery?.slug === `daily-ai-news-${confirmReportDate}`
    && canonicalRunSha256(run) === confirmRunSha256;
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
  timeoutMs = REQUEST_TIMEOUT_MS,
  retryDelaysMs = PUBLIC_READBACK_RETRY_DELAYS_MS,
  perAttemptTimeoutMs = PUBLIC_READBACK_ATTEMPT_TIMEOUT_MS,
  sleep = (delayMs) => new Promise((resolveSleep) => setTimeout(resolveSleep, delayMs))
}) {
  const urls = publicArticleUrls(endpoint, run.delivery.slug);
  const deadlineAt = Date.now() + timeoutMs;
  await Promise.all(LANGUAGES.map((lang) => fetchPublicArticleWithRetry({
    url: urls[lang],
    lang,
    run,
    fetchImpl,
    deadlineAt,
    retryDelaysMs,
    perAttemptTimeoutMs,
    sleep
  })));
}

export async function fetchPublicArticleWithRetry({
  url,
  lang,
  run,
  fetchImpl,
  deadlineAt,
  retryDelaysMs = PUBLIC_READBACK_RETRY_DELAYS_MS,
  perAttemptTimeoutMs = PUBLIC_READBACK_ATTEMPT_TIMEOUT_MS,
  sleep = (delayMs) => new Promise((resolveSleep) => setTimeout(resolveSleep, delayMs))
}) {
  const attempts = retryDelaysMs.length + 1;
  let lastNetworkError = "";

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) {
      break;
    }

    let response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Cache-Control": "no-cache"
        },
        signal: AbortSignal.timeout(Math.max(1, Math.min(perAttemptTimeoutMs, remainingMs)))
      });
    } catch (error) {
      lastNetworkError = String(error?.message || error);
      if (attempt >= retryDelaysMs.length) {
        break;
      }
      await sleepWithinDeadline(retryDelaysMs[attempt], deadlineAt, sleep);
      continue;
    }

    if (!response.ok
      && TRANSIENT_READBACK_STATUSES.has(response.status)
      && attempt < retryDelaysMs.length) {
      await response.body?.cancel?.().catch(() => {});
      await sleepWithinDeadline(retryDelaysMs[attempt], deadlineAt, sleep);
      continue;
    }

    const payload = await readJsonResponse(response, `${lang} 公开文章`);
    if (!response.ok) {
      throw new Error(
        `${lang} 公开文章接口返回 ${response.status}；生产 POST 不得自动重发。`
      );
    }
    return validatePublicArticlePayload({ payload, lang, run });
  }

  const detail = lastNetworkError || "公开读取重试预算耗尽";
  throw new Error(
    `${lang} 公开文章读取失败：${detail}；`
    + `已完成最多 ${attempts} 次只读 GET 尝试，生产 POST 不得自动重发。`
  );
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
  if (args.printRunSha256) {
    console.log(canonicalRunSha256(run));
    return;
  }
  const schedule = assertProductionSchedule(run, args);
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

  const network = createProxyAwareFetch();
  try {
    let response;
    try {
      response = await network.fetch(endpoint, {
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
      fetchImpl: network.fetch,
      timeoutMs: verificationTimeoutMs
    });
    if (schedule.deadlineAt !== null && Date.now() >= schedule.deadlineAt) {
      throw new Error("公开核验在本次投递截止时间后才完成；不得自动重试，请人工核对文章状态。");
    }
    console.log(
      `daily-ai-news-production-delivery: published`
      + ` (${run.reportDate}, duplicate=${Boolean(payload.duplicate)})`
    );
    console.log(payload.slug);
  } finally {
    await network.close();
  }
}

async function sleepWithinDeadline(delayMs, deadlineAt, sleep) {
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 1) {
    return;
  }
  await sleep(Math.min(delayMs, remainingMs - 1));
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

function isValidIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))
    && shiftIsoDate(value, 0) === value;
}

function shiftIsoDate(value, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) {
    return "";
  }
  const shifted = new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]) + days
  ));
  return shifted.toISOString().slice(0, 10);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
