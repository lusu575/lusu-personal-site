import { readFile } from "node:fs/promises";

import { parseDevVars } from "../production-secrets.mjs";

const TOOL_RADAR_TOKEN_PATTERN = /^lusu_tool_radar_[A-Za-z0-9_-]{32,128}$/;

export async function readToolRadarToken({
  env = process.env,
  devVarsPath
} = {}) {
  const environmentToken = String(env.TOOL_RADAR_TOKEN || "").trim();
  if (environmentToken) {
    assertToolRadarToken(environmentToken);
    return environmentToken;
  }
  if (!devVarsPath) {
    throw new Error("缺少 TOOL_RADAR_TOKEN，且未提供 .dev.vars 路径。");
  }
  let source;
  try {
    source = await readFile(devVarsPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error("未找到被忽略的根目录 .dev.vars，无法读取工具雷达令牌。");
    }
    throw error;
  }
  const token = String(parseDevVars(source).TOOL_RADAR_TOKEN || "").trim();
  if (!token) {
    throw new Error("根目录 .dev.vars 尚未配置 TOOL_RADAR_TOKEN。");
  }
  assertToolRadarToken(token);
  return token;
}

export function assertToolRadarToken(token) {
  if (!TOOL_RADAR_TOKEN_PATTERN.test(String(token || ""))) {
    throw new Error("工具雷达投递令牌格式不正确；令牌值不会被输出。");
  }
}
