import { randomBytes } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";

const DELIVERY_TOKEN_PATTERN = /^lusu_ai_news_[A-Za-z0-9_-]{32,160}$/;

export function parseDevVars(source) {
  const values = {};
  for (const line of String(source || "").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!match) {
      continue;
    }
    values[match[1]] = decodeDevVarValue(match[2]);
  }
  return values;
}

export function upsertDevVar(source, key, value) {
  assertSafeKeyAndValue(key, value);
  const text = String(source || "");
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const hadFinalNewline = /\r?\n$/.test(text);
  const lines = text ? text.split(/\r?\n/) : [];
  const matcher = new RegExp(`^\\s*(?:export\\s+)?${escapeRegExp(key)}\\s*=`);
  const next = [];
  let replaced = false;

  for (const line of lines) {
    if (!matcher.test(line)) {
      next.push(line);
      continue;
    }
    if (!replaced) {
      next.push(`${key}=${value}`);
      replaced = true;
    }
  }
  if (!replaced) {
    if (next.length && next.at(-1) === "") {
      next.splice(next.length - 1, 0, `${key}=${value}`);
    } else {
      next.push(`${key}=${value}`);
    }
  }
  const joined = next.join(eol);
  return hadFinalNewline && !joined.endsWith(eol) ? `${joined}${eol}` : joined;
}

export function removeDevVar(source, key) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(key || ""))) {
    throw new Error("环境变量名称不安全。");
  }
  const text = String(source || "");
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const hadFinalNewline = /\r?\n$/.test(text);
  const matcher = new RegExp(`^\\s*(?:export\\s+)?${escapeRegExp(key)}\\s*=`);
  const joined = text.split(/\r?\n/).filter((line) => !matcher.test(line)).join(eol);
  return hadFinalNewline && !joined.endsWith(eol) ? `${joined}${eol}` : joined;
}

export async function readDeliveryToken({
  env = process.env,
  devVarsPath
} = {}) {
  const environmentToken = String(env.DAILY_AI_NEWS_TOKEN || "").trim();
  if (environmentToken) {
    assertDeliveryToken(environmentToken);
    return environmentToken;
  }
  if (!devVarsPath) {
    throw new Error("缺少 DAILY_AI_NEWS_TOKEN，且未提供 .dev.vars 路径。");
  }
  let source;
  try {
    source = await readFile(devVarsPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error("未找到被忽略的根目录 .dev.vars，无法读取投递令牌。");
    }
    throw error;
  }
  const token = String(parseDevVars(source).DAILY_AI_NEWS_TOKEN || "").trim();
  if (!token) {
    throw new Error("根目录 .dev.vars 尚未配置 DAILY_AI_NEWS_TOKEN。");
  }
  assertDeliveryToken(token);
  return token;
}

export function assertDeliveryToken(token) {
  if (!DELIVERY_TOKEN_PATTERN.test(String(token || ""))) {
    throw new Error("每日 AI 新闻投递令牌格式不正确；令牌值不会被输出。");
  }
}

export async function assertDevVarsIgnored(gitignorePath) {
  const gitignore = await readFile(gitignorePath, "utf8");
  const patterns = gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"));
  if (!patterns.some((pattern) => [
    ".dev.vars",
    "/.dev.vars",
    ".dev.vars*",
    ".dev.vars.*",
    "/.dev.vars*",
    "/.dev.vars.*"
  ].includes(pattern))) {
    throw new Error("根目录 .dev.vars 未被 .gitignore 明确忽略，拒绝写入令牌。");
  }
}

export async function writeDevVarsSafely(devVarsPath, source) {
  const temporaryPath = `${devVarsPath}.pending-write-${process.pid}-${randomBytes(6).toString("hex")}`;
  try {
    await writeFile(temporaryPath, source, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600
    });
    await rename(temporaryPath, devVarsPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

function decodeDevVarValue(value) {
  const trimmed = String(value || "").trim();
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.length >= 2 && trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1)
      .replaceAll("\\n", "\n")
      .replaceAll("\\r", "\r")
      .replaceAll("\\t", "\t")
      .replaceAll("\\\"", "\"")
      .replaceAll("\\\\", "\\");
  }
  return trimmed.replace(/\s+#.*$/, "").trim();
}

function assertSafeKeyAndValue(key, value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(key || ""))) {
    throw new Error("环境变量名称不安全。");
  }
  if (/[\r\n\0]/.test(String(value || ""))) {
    throw new Error("环境变量值包含不安全字符。");
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
