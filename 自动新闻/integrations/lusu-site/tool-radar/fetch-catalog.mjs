import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { readToolRadarToken } from "./delivery-secrets.mjs";
import {
  sha256Bytes,
  validateCatalogSnapshotPayload
} from "./validate-run.mjs";

const SITE_ROOT = resolve(import.meta.dirname, "..", "..", "..", "..");
const DEV_VARS_PATH = resolve(SITE_ROOT, ".dev.vars");
const DEFAULT_CATALOG_ENDPOINT = "https://lusu575.com/api/automation/tool-radar/catalog";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export function parseCatalogArgs(argv = process.argv.slice(2)) {
  const outIndex = argv.indexOf("--out");
  const outPath = outIndex >= 0 ? String(argv[outIndex + 1] || "").trim() : "";
  if (!outPath || outPath.startsWith("--")) {
    throw new Error("工具目录抓取必须显式提供 --out <快照路径>。");
  }
  const allowed = new Set(["--out", "--trial-empty"]);
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--out") {
      index += 1;
      continue;
    }
    if (!allowed.has(argv[index])) {
      throw new Error(`未知参数：${argv[index]}`);
    }
  }
  return { outPath, trialEmpty: argv.includes("--trial-empty") };
}

export function validateCatalogEndpoint(value) {
  let endpoint;
  try {
    endpoint = new URL(String(value || ""));
  } catch {
    throw new Error("工具雷达目录地址不是有效 URL。");
  }
  if (endpoint.protocol !== "https:"
    || endpoint.hostname !== "lusu575.com"
    || endpoint.port
    || endpoint.username
    || endpoint.password
    || endpoint.search
    || endpoint.hash
    || endpoint.pathname !== "/api/automation/tool-radar/catalog") {
    throw new Error(
      "工具雷达目录地址必须是 lusu575.com 上无凭证、无查询参数的 HTTPS 专用接口。"
    );
  }
  return endpoint.toString();
}

export function normalizeCatalogResponse(payload, {
  endpoint = DEFAULT_CATALOG_ENDPOINT,
  fetchedAt = new Date().toISOString()
} = {}) {
  if (!payload || payload.ok !== true || payload.category !== "tool-radar"
    || !Array.isArray(payload.tools)) {
    throw new Error("工具雷达目录接口未返回有效的 tool-radar tools 数组。");
  }
  if (payload.truncated === true) {
    throw new Error("工具雷达目录响应被截断，无法证明永久去重完整性；流程停止。");
  }
  const tools = payload.tools.map((tool, index) => {
    const toolKey = String(tool?.toolKey || "").trim();
    if (!/^[a-z0-9.-]+\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(toolKey)) {
      throw new Error(`工具目录第 ${index + 1} 项缺少合法 toolKey。`);
    }
    const normalized = { toolKey };
    for (const key of ["name", "canonicalUrl", "articleSlug", "firstPublishedAt"]) {
      const value = String(tool?.[key] || "").trim();
      if (value) {
        normalized[key] = value;
      }
    }
    return normalized;
  }).sort((left, right) => left.toolKey.localeCompare(right.toolKey));
  const snapshot = {
    schemaVersion: 1,
    mode: "authenticated-production",
    fetchedAt,
    endpoint: validateCatalogEndpoint(endpoint),
    category: "tool-radar",
    tools,
    toolKeys: tools.map((tool) => tool.toolKey)
  };
  validateCatalogSnapshotPayload(snapshot);
  return snapshot;
}

export async function fetchPublishedToolCatalog({
  endpoint = DEFAULT_CATALOG_ENDPOINT,
  token,
  fetchImpl = fetch,
  fetchedAt = new Date().toISOString(),
  timeoutMs = REQUEST_TIMEOUT_MS
}) {
  const safeEndpoint = validateCatalogEndpoint(endpoint);
  let response;
  try {
    response = await fetchImpl(safeEndpoint, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "Cache-Control": "no-cache"
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    throw new Error(`工具目录请求未完成：${redact(String(error?.message || error), token)}`);
  }
  const payload = await readJsonResponse(response, "工具目录");
  if (!response.ok) {
    const message = String(payload?.error || payload?.message || "未知错误").slice(0, 300);
    throw new Error(`工具目录请求失败（${response.status}）：${message}`);
  }
  return normalizeCatalogResponse(payload, {
    endpoint: safeEndpoint,
    fetchedAt
  });
}

export function serializeCatalogSnapshot(snapshot) {
  validateCatalogSnapshotPayload(snapshot);
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function resolveCatalogOutputPath(outPath, {
  cwd = process.cwd(),
  siteRoot = SITE_ROOT
} = {}) {
  const absolutePath = resolve(cwd, outPath);
  const artifactRoot = resolve(siteRoot, "自动新闻", "data", "mcp-runs");
  if (!absolutePath.startsWith(`${artifactRoot}${sep}`)) {
    throw new Error("工具目录快照必须写入 自动新闻/data/mcp-runs/<run>/ 目录。");
  }
  return absolutePath;
}

async function readJsonResponse(response, label) {
  const responseText = await response.text();
  if (Buffer.byteLength(responseText, "utf8") > MAX_RESPONSE_BYTES) {
    throw new Error(`${label}响应过大，拒绝继续处理。`);
  }
  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(`${label}未返回有效 JSON。`);
  }
}

function redact(value, secret) {
  return secret ? String(value).replaceAll(secret, "[redacted]") : String(value);
}

async function main() {
  const args = parseCatalogArgs();
  const outputPath = resolveCatalogOutputPath(args.outPath);
  const snapshot = args.trialEmpty
    ? {
      schemaVersion: 1,
      mode: "trial-local",
      fetchedAt: new Date().toISOString(),
      endpoint: "local:tool-radar-trial-catalog",
      category: "tool-radar",
      tools: [],
      toolKeys: []
    }
    : await fetchProductionCatalog();
  validateCatalogSnapshotPayload(snapshot);
  const serialized = serializeCatalogSnapshot(snapshot);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600
  });
  console.log(
    `tool-radar-catalog: saved (tools=${snapshot.tools.length}, sha256=${sha256Bytes(serialized)})`
  );
  console.log(outputPath);
}

async function fetchProductionCatalog() {
  const token = await readToolRadarToken({
    env: process.env,
    devVarsPath: DEV_VARS_PATH
  });
  return fetchPublishedToolCatalog({
    endpoint: process.env.TOOL_RADAR_CATALOG_ENDPOINT || DEFAULT_CATALOG_ENDPOINT,
    token
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
