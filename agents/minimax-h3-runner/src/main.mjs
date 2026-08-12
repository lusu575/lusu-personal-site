import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "./config.mjs";
import { verifyFixedController, runController } from "./controller-adapter.mjs";
import { acquireSingleInstanceLock } from "./single-instance-lock.mjs";
import { createLoopbackBridge } from "./bridge.mjs";
import { createSiteClient } from "./site-client.mjs";
import { createRunnerCapabilities, loadInstallationId, runClaimedJob, runPreflight } from "./runner-loop.mjs";

const cliArgs = process.argv.slice(2);
const configFlagIndex = cliArgs.indexOf("--config");
const configPath = configFlagIndex >= 0
  ? cliArgs[configFlagIndex + 1]
  : cliArgs.find((value) => !value.startsWith("--")) || resolve(import.meta.dirname, "../config.json");
if (!configPath || configPath.startsWith("--")) {
  throw new Error("Runner config path is required after --config.");
}
const config = await loadConfig(configPath);
await mkdir(config.stateRoot, { recursive: true });
const release = await acquireSingleInstanceLock(resolve(config.stateRoot, "runner.lock"));
let site;
let bridge;
let heartbeatTimer;
try {
  const verification = await verifyFixedController(config);
  if (!verification.ok) {
    console.error(JSON.stringify({ ok: false, code: "H3_FIXED_ASSET_HASH_MISMATCH", verification }));
    process.exitCode = 2;
  } else if (cliArgs.includes("--doctor") || cliArgs.includes("--preflight")) {
    const result = await runPreflight(config);
    process.stdout.write(`${JSON.stringify({ verification, preflight: result }, null, 2)}\n`);
    process.exitCode = result.ok ? 0 : 3;
  } else if (cliArgs.includes("--run")) {
    const token = (await readFile(resolve(config.agentTokenFile), "utf8")).trim();
    site = createSiteClient(config, token);
    let registeredRunnerId = "";
    bridge = createLoopbackBridge({
      host: config.bridgeBindHost,
      port: config.bridgeBindPort,
      config,
      site,
      siteOrigin: config.baseUrl,
      getRunnerId: () => registeredRunnerId
    });
    await bridge.listen();
    const installationId = await loadInstallationId(config);
    const preflight = await runPreflight(config);
    const diskFreeBytes = await getDiskFreeBytes(config.stateRoot);
    const capabilities = createRunnerCapabilities({ preflight, bridgeOnline: true, diskFreeBytes });
    const registration = await site.request("/api/agent/minimax-h3/runners/register", {
      method: "POST",
      body: {
        runnerId: config.runnerId || null,
        installationId,
        label: config.label || "LuSu H3 Runner",
        protocolVersion: config.protocolVersion,
        agentVersion: config.agentVersion || "0.2.0",
        controllerVersion: config.controllerVersion,
        capabilities
      }
    });
    const runnerId = registration.runnerId;
    registeredRunnerId = runnerId;
    let busyJobId = "";
    let stopped = false;
    const shutdown = () => { stopped = true; };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    const heartbeat = async () => {
      try {
        await site.request("/api/agent/minimax-h3/runners/heartbeat", {
          method: "POST",
          body: {
            runnerId,
            readyState: busyJobId ? "busy" : preflight.ok ? "ready" : "comfy_unready",
            busyJobId,
            bridgeOnline: true,
            comfyReachable: preflight.ok,
            diskFreeBytes,
            capabilities
          }
        });
      } catch (error) {
        process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || "H3_HEARTBEAT_FAILED" })}\n`);
      }
    };
    heartbeatTimer = setInterval(() => { void heartbeat(); }, Math.max(10, Number(registration.heartbeatSeconds || config.heartbeatSeconds || 15)) * 1000);
    await heartbeat();
    while (!stopped) {
      if (registration.featureEnabled && preflight.ok) {
        try {
          const claimed = await site.request("/api/agent/minimax-h3/jobs/claim", { method: "POST", body: { runnerId } });
          if (claimed) {
            busyJobId = claimed.jobId;
            await heartbeat();
            await runClaimedJob({ config, site, claimed, onHeartbeat: heartbeat });
            busyJobId = "";
            await heartbeat();
          }
        } catch (error) {
          busyJobId = "";
          process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || "H3_JOB_LOOP_FAILED" })}\n`);
          await heartbeat();
        }
      }
      await delay(Math.max(5, Number(registration.pollSeconds || config.pollSeconds || 8)) * 1000);
    }
  } else {
    process.stdout.write(`${JSON.stringify({ ok: true, mode: "runner-self-check", verification }, null, 2)}\n`);
  }
} finally {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  await bridge?.close().catch(() => {});
  await site?.close().catch(() => {});
  await release();
}

async function getDiskFreeBytes(path) {
  try {
    const result = await import("node:child_process");
    if (process.platform !== "win32") return null;
    const drive = String(path).match(/^[A-Za-z]:/u)?.[0]?.slice(0, 1);
    if (!drive) return null;
    const output = await new Promise((resolvePromise) => {
      result.execFile("powershell.exe", ["-NoProfile", "-Command", `(Get-PSDrive -Name '${drive}' -ErrorAction SilentlyContinue).Free`], { windowsHide: true }, (_error, stdout) => resolvePromise(String(stdout || "").trim()));
    });
    const value = Number(output);
    return Number.isSafeInteger(value) ? value : null;
  } catch {
    return null;
  }
}

function delay(ms) { return new Promise((resolvePromise) => setTimeout(resolvePromise, ms)); }
