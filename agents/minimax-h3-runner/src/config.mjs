import { readFile } from "node:fs/promises";

const H3_ROOT = "F:/AI\u89c6\u9891H3/MiniMax-H3-Local";

export const FIXED = Object.freeze({
  protocolVersion: "1.0",
  controllerVersion: "2026-08-04_v4",
  controllerPython: "F:/comfyUI/ComfyUI-aki-v3/python/python.exe",
  controllerScript: `${H3_ROOT}/versions/2026-08-04_v4/skills/minimax-h3-local/scripts/h3_local.py`,
  controllerSha256: "140c5a3e67a91babd4fb10d0e72524b2f5e58f278de4c068759aa50ea27fcc1b",
  jobSchema: `${H3_ROOT}/versions/2026-08-04_v4/skills/minimax-h3-local/references/job-schema.json`,
  jobSchemaSha256: "6e9da0a36308241c4532d1d9cf29dfe9611d1acbe8760d25d251953d9c6c89d7",
  workflowLock: `${H3_ROOT}/versions/2026-08-04_v4/skills/minimax-h3-local/references/workflow-lock.json`,
  workflowLockSha256: "78a3f090097bbc0782af834ba74f9edacc6376e9b86e1de2ad1cb08df058c7ed",
  outputRoot: `${H3_ROOT}/outputs`,
  comfyHost: "127.0.0.1",
  comfyPort: 8188,
  bridgeHost: "127.0.0.1",
  bridgePort: 8791
});

export async function loadConfig(path) {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Runner config must be a JSON object.");
  }
  const config = {
    ...parsed,
    ...FIXED,
    comfyHost: FIXED.comfyHost,
    comfyPort: FIXED.comfyPort,
    bridgeBindHost: FIXED.bridgeHost,
    bridgeBindPort: FIXED.bridgePort
  };
  if (typeof config.baseUrl !== "string" || !/^https:\/\/[^/]+$/u.test(config.baseUrl)) {
    throw new Error("Runner config requires an HTTPS site origin in baseUrl.");
  }
  if (typeof config.stateRoot !== "string" || !config.stateRoot.trim()) throw new Error("Runner config requires stateRoot.");
  if (typeof config.installationIdFile !== "string" || !config.installationIdFile.trim()) throw new Error("Runner config requires installationIdFile.");
  if (typeof config.agentTokenFile !== "string" || !config.agentTokenFile.trim()) throw new Error("Runner config requires agentTokenFile.");
  return config;
}
