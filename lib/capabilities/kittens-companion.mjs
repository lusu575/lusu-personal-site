import { kittensPageOperation } from "./kittens-browser.mjs";

/** One iteration on an explicitly connected page, using the same private MCP. */
export async function runKittensCompanionOnce({ browserId, callTool, evaluate }) {
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(browserId || "")) throw new Error("BROWSER_ID_INVALID");
  const claimed = await callTool("browser_command_claim", { browserId });
  if (!claimed.job) return { idle: true };
  const { jobId, request } = claimed.job;
  let result;
  let failed = false;
  try {
    result = request.action === "whiteboard_snapshot"
      ? await evaluate("globalThis.lusuPrivateWhiteboardSnapshot ? globalThis.lusuPrivateWhiteboardSnapshot() : Promise.reject(new Error('WHITEBOARD_COMPANION_NOT_ENABLED'))")
      : await evaluate(`(${kittensPageOperation.toString()})(${JSON.stringify(request)})`);
  } catch {
    // A disconnected evaluation may already have executed. Do not replay it.
    failed = true;
    result = { code: "BROWSER_EXECUTION_UNCONFIRMED", execution: "unknown", retrySafe: false };
  }
  // Delivery failure also propagates without another page action.
  await callTool("browser_command_complete", { browserId, jobId, result, failed });
  return { jobId, failed, result };
}
