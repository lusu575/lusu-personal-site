import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readToolRadarToken } from "./delivery-secrets.mjs";
import {
  fetchPublishedToolCatalog,
  validateCatalogEndpoint
} from "./fetch-catalog.mjs";
import {
  readAndValidateRun,
  sha256Bytes
} from "./validate-run.mjs";

const SITE_ROOT = resolve(import.meta.dirname, "..", "..", "..", "..");
const DEV_VARS_PATH = resolve(SITE_ROOT, ".dev.vars");
const DEFAULT_ENDPOINT = "https://lusu575.com/api/automation/tool-radar";
const DEFAULT_CATALOG_ENDPOINT = "https://lusu575.com/api/automation/tool-radar/catalog";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 128 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_FETCH_RETRY_DELAYS_MS = Object.freeze([250, 750]);
const TRANSIENT_IMAGE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const LANGUAGES = ["zh", "en", "ja"];

export function parseProductionArgs(argv = process.argv.slice(2)) {
  const runIndex = argv.indexOf("--run");
  const runPath = runIndex >= 0 ? String(argv[runIndex + 1] || "").trim() : "";
  if (!runPath || runPath.startsWith("--")) {
    throw new Error("工具雷达生产投递必须显式提供 --run <运行记录路径>。");
  }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--run") {
      index += 1;
      continue;
    }
    throw new Error(`未知参数：${argv[index]}`);
  }
  return { runPath };
}

export function validateProductionEndpoint(value) {
  let endpoint;
  try {
    endpoint = new URL(String(value || ""));
  } catch {
    throw new Error("工具雷达生产投递地址不是有效 URL。");
  }
  if (endpoint.protocol !== "https:"
    || endpoint.hostname !== "lusu575.com"
    || endpoint.port
    || endpoint.username
    || endpoint.password
    || endpoint.search
    || endpoint.hash
    || endpoint.pathname !== "/api/automation/tool-radar") {
    throw new Error(
      "工具雷达生产投递地址必须是 lusu575.com 上无凭证、无查询参数的 HTTPS 专用接口。"
    );
  }
  return endpoint.toString();
}

export function assertProductionSchedule(run, { now = new Date() } = {}) {
  const scheduledAt = new Date(run?.edition?.scheduledAt);
  const nowMs = now.getTime();
  if (!Number.isFinite(scheduledAt.getTime()) || !Number.isFinite(nowMs)) {
    throw new Error("无法读取工具雷达本期或当前时间。");
  }
  const nextScheduledAt = new Date(scheduledAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (nowMs < scheduledAt.getTime()) {
    throw new Error("尚未到本期北京时间周二 22:00，拒绝提前生产投递。");
  }
  if (nowMs >= nextScheduledAt.getTime()) {
    throw new Error("下一期工具雷达时段已经开始，拒绝投递过期运行记录。");
  }
  return { scheduledAt, nextScheduledAt };
}

export function assertProductionRunMode(run) {
  if (run?.delivery?.mode !== "production"
    || run?.delivery?.status !== "pending"
    || run?.catalogAudit?.mode !== "authenticated-production") {
    throw new Error(
      "生产投递只接受 production + pending 且使用 authenticated-production 目录快照的运行记录；"
      + "trial 试稿永远不可投递。"
    );
  }
}

export function productionDeliveryPayload(delivery) {
  const {
    mode: _mode,
    status: _status,
    ...payload
  } = delivery || {};
  return payload;
}

export function assertNoPublishedToolDuplicates(run, catalogSnapshot) {
  const knownToolKeys = new Set(catalogSnapshot?.toolKeys || []);
  const knownCanonicalUrls = new Set(
    (catalogSnapshot?.tools || [])
      .map((tool) => tool?.canonicalUrl)
      .filter((canonicalUrl) => typeof canonicalUrl === "string" && canonicalUrl.trim())
      .map((canonicalUrl) => normalizeToolRadarCanonicalUrl(canonicalUrl))
  );
  const duplicates = (run?.tools || []).flatMap((tool) => {
    const reasons = [];
    if (knownToolKeys.has(tool.toolKey)) {
      reasons.push(`${tool.toolKey}（toolKey）`);
    }
    const canonicalUrl = normalizeToolRadarCanonicalUrl(tool.canonicalUrl);
    if (knownCanonicalUrls.has(canonicalUrl)) {
      reasons.push(`${canonicalUrl}（canonicalUrl）`);
    }
    return reasons;
  });
  if (duplicates.length) {
    throw new Error(
      `最新工具目录已包含 ${duplicates.join(", ")}；永久去重触发，停止且不得投递。`
    );
  }
}

export function normalizeToolRadarCanonicalUrl(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new Error("最新工具目录包含无效 canonicalUrl，停止且不得投递。");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("最新工具目录包含非规范 canonicalUrl，停止且不得投递。");
  }
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}

export function validateDeliveryResponse({
  httpStatus,
  responseOk,
  payload,
  run
}) {
  if (!responseOk) {
    const message = String(payload?.error || payload?.message || "未知错误").slice(0, 300);
    throw new Error(`工具雷达生产投递失败（${httpStatus}）：${message}`);
  }
  if (payload?.ok !== true
    || payload?.category !== "tool-radar"
    || !["draft", "published"].includes(payload?.status)
    || payload?.slug !== run.delivery.slug
    || !String(payload?.articleId || "").trim()) {
    throw new Error("生产接口未确认文章已在 tool-radar 分区生成草稿或公开，停止且不得自动重试。");
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
    || article.category !== "tool-radar"
    || article.status !== "published"
    || article.lang !== lang
    || article.requested_lang !== lang
    || article.title !== expected.title
    || String(article.content_markdown || "").trim()
      !== String(expected.content_markdown || "").trim()) {
    throw new Error(
      `${lang} 工具雷达公开文章核验失败：slug、分区、语言、标题或正文不一致；`
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
      throw new Error(`${lang} 工具雷达公开文章读取失败：${String(error?.message || error)}；不得自动重试。`);
    }
    const payload = await readJsonResponse(response, `${lang} 公开文章`);
    if (!response.ok) {
      throw new Error(`${lang} 工具雷达公开文章接口返回 ${response.status}；不得自动重试。`);
    }
    validatePublicArticlePayload({ payload, lang, run });
  }));
}

export function registeredToolRadarImages(run) {
  return (run?.tools || []).flatMap((tool) => {
    if (tool?.image === null || tool?.image === undefined) {
      return [];
    }
    return Array.isArray(tool.image) ? tool.image : [tool.image];
  });
}

export function publicAssetUrl(endpoint, assetPath) {
  const origin = new URL(validateProductionEndpoint(endpoint)).origin;
  const normalizedPath = String(assetPath || "").replaceAll("\\", "/");
  if (!/^assets\/images\/articles\/tool-radar\/[a-z0-9._/-]+\.(png|jpe?g|webp)$/i
    .test(normalizedPath)
    || /(^|\/)\.\.(\/|$)/.test(normalizedPath)) {
    throw new Error("工具雷达线上图片路径不合法。");
  }
  return `${origin}/${normalizedPath}`;
}

export async function verifyPublishedToolAssets({
  endpoint,
  run,
  fetchImpl = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
  retryDelaysMs = IMAGE_FETCH_RETRY_DELAYS_MS,
  sleepImpl = sleep
}) {
  const images = registeredToolRadarImages(run);
  const retryDelays = validateImageRetryDelays(retryDelaysMs);
  for (const image of images) {
    const assetUrl = publicAssetUrl(endpoint, image.assetPath);
    const response = await fetchPublishedToolAssetWithRetry({
      assetUrl,
      fetchImpl,
      timeoutMs,
      retryDelays,
      sleepImpl
    });
    if (!response.ok) {
      throw new Error(`工具雷达图片尚未上线：${assetUrl} 返回 ${response.status}。`);
    }
    const expectedMime = expectedImageMime(image.assetPath);
    const actualMime = String(response.headers?.get?.("content-type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (actualMime !== expectedMime) {
      throw new Error(
        `工具雷达线上图片 MIME 不合法：${assetUrl} 应为 ${expectedMime}，实际为 `
        + `${actualMime || "缺失"}。`
      );
    }
    const contentLength = Number(response.headers?.get?.("content-length") || 0);
    if (contentLength > MAX_IMAGE_BYTES) {
      throw new Error(`工具雷达线上图片超过 5 MiB：${assetUrl}。`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
      throw new Error(`工具雷达线上图片大小不合法：${assetUrl}。`);
    }
    if (sha256Bytes(bytes) !== image.sha256) {
      throw new Error(`工具雷达线上图片字节与运行记录不一致：${assetUrl}。`);
    }
  }
  return images.length;
}

async function fetchPublishedToolAssetWithRetry({
  assetUrl,
  fetchImpl,
  timeoutMs,
  retryDelays,
  sleepImpl
}) {
  const attempts = retryDelays.length + 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(assetUrl, {
        method: "GET",
        headers: {
          "Accept": "image/avif,image/webp,image/png,image/jpeg",
          "Cache-Control": "no-cache"
        },
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      if (attempt === attempts) {
        throw new Error(
          `工具雷达图片连续 ${attempts} 次读取失败：${assetUrl}`
          + `（${String(error?.message || error)}）`
        );
      }
      await sleepImpl(retryDelays[attempt - 1]);
      continue;
    }
    if (response.ok || !TRANSIENT_IMAGE_HTTP_STATUSES.has(response.status)) {
      return response;
    }
    if (attempt === attempts) {
      return response;
    }
    try {
      await response.body?.cancel?.();
    } catch {
      // The next bounded attempt is still authoritative if a transient response cannot be cancelled.
    }
    await sleepImpl(retryDelays[attempt - 1]);
  }
  throw new Error(`工具雷达图片预检出现不可达状态：${assetUrl}。`);
}

function validateImageRetryDelays(value) {
  if (!Array.isArray(value)
    || value.length > 2
    || value.some((delay) => !Number.isInteger(delay) || delay < 0 || delay > 5_000)) {
    throw new Error("工具雷达图片重试配置不合法。");
  }
  return [...value];
}

function expectedImageMime(assetPath) {
  const extension = String(assetPath || "").toLowerCase().match(/\.(png|jpe?g|webp)$/)?.[1];
  if (extension === "png") {
    return "image/png";
  }
  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }
  if (extension === "webp") {
    return "image/webp";
  }
  throw new Error("工具雷达线上图片扩展名不受支持。");
}

function sleep(milliseconds) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
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

function redact(value, secret) {
  return secret ? String(value).replaceAll(secret, "[redacted]") : String(value);
}

async function main() {
  const args = parseProductionArgs();
  const { run } = await readAndValidateRun(args.runPath);
  assertProductionRunMode(run);
  assertProductionSchedule(run);
  const endpoint = validateProductionEndpoint(
    process.env.TOOL_RADAR_ENDPOINT || DEFAULT_ENDPOINT
  );
  const catalogEndpoint = validateCatalogEndpoint(
    process.env.TOOL_RADAR_CATALOG_ENDPOINT || DEFAULT_CATALOG_ENDPOINT
  );
  const token = await readToolRadarToken({
    env: process.env,
    devVarsPath: DEV_VARS_PATH
  });

  const latestCatalog = await fetchPublishedToolCatalog({
    endpoint: catalogEndpoint,
    token
  });
  assertNoPublishedToolDuplicates(run, latestCatalog);
  await verifyPublishedToolAssets({ endpoint, run });

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": run.delivery.idempotencyKey
      },
      body: JSON.stringify(productionDeliveryPayload(run.delivery)),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    throw new Error(
      `工具雷达生产投递请求未完成：${redact(String(error?.message || error), token)}`
    );
  }

  const payload = await readJsonResponse(response, "工具雷达生产接口");
  validateDeliveryResponse({
    httpStatus: response.status,
    responseOk: response.ok,
    payload,
    run
  });
  if (payload.status === "published") {
    await verifyPublicArticleTranslations({ endpoint, run });
  }
  console.log(
    `tool-radar-production-delivery: ${payload.status}`
      + ` (${run.edition.id}, tools=${run.tools.length}, duplicate=${Boolean(payload.duplicate)})`
  );
  console.log(payload.slug);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
