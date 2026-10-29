#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { CDP } from "../lib/capabilities/browser-cdp.mjs";
import { runKittensCompanionOnce } from "../lib/capabilities/kittens-companion.mjs";
import { createProxyAwareFetch } from "../自动新闻/integrations/lusu-site/network-fetch.mjs";

export function companionOptions(args, env) {
  const options = {};
  for (let i=0;i<args.length;i++) {
    const key = args[i];
    if (key === "--once") { options.once = true; continue; }
    if (!["--cdp-url", "--target-id", "--browser-id"].includes(key) || !args[i+1]) throw new Error("Use --cdp-url, --target-id, --browser-id and optionally --once.");
    options[key.slice(2)] = args[++i];
  }
  const url = new URL(options["cdp-url"]);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    || url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) throw new Error("CDP must be an explicit loopback HTTP endpoint.");
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(options["browser-id"] || "")) throw new Error("Supply a browser-id of 16–100 letters, digits, underscores or hyphens.");
  if (!options["target-id"]) throw new Error("Select an explicit browser target ID.");
  if (!env.LUSU_MCP_ACCESS_TOKEN) throw new Error("Supply an existing owner OAuth token through LUSU_MCP_ACCESS_TOKEN. This CLI does not issue credentials.");
  return { ...options, cdp: url.origin, token: env.LUSU_MCP_ACCESS_TOKEN };
}

export async function main(args = process.argv.slice(2), runtime = {}) {
  if (args.includes("--help")) {
    console.log("node cli/private-browser-companion.mjs --cdp-url http://127.0.0.1:PORT --target-id ID --browser-id NAME [--once]\nUses existing LUSU_MCP_ACCESS_TOKEN; never launches or changes your browser profile."); return;
  }
  const options = companionOptions(args, runtime.env || process.env);
  const targets = await (await (runtime.fetch || fetch)(options.cdp + "/json/list", { signal: AbortSignal.timeout(5000) })).json();
  const target = targets.find(item => item.id === options["target-id"] && item.type === "page");
  if (!target) throw new Error("Selected browser page not found.");
  const validatePage = raw => {
    const url = new URL(raw);
    const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (!(url.protocol === "https:" && url.hostname === "lusu575.com") && !(local && url.protocol === "http:")) throw new Error("Target must be the site or an explicit local preview.");
    if (!url.pathname.startsWith("/games/kittens-game/") && !url.pathname.startsWith("/tools/whiteboard/") && !url.pathname.startsWith("/whiteboard")) throw new Error("Target must be a Kittens or whiteboard page.");
  };
  validatePage(target.url);
  const socketUrl = new URL(target.webSocketDebuggerUrl);
  if (socketUrl.protocol !== "ws:" || !["127.0.0.1", "localhost", "[::1]"].includes(socketUrl.hostname)) throw new Error("Non-loopback debugger rejected.");
  const cdp = new (runtime.CDP || CDP)(socketUrl.href);
  const network = (runtime.createNetwork || createProxyAwareFetch)();
  let session, id = 0, stopped = false;
  const stop = () => { stopped = true; };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  const rpc = async (method, params, notification = false) => {
    const response = await network.fetch("https://lusu575.com/mcp", { method: "POST", signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${options.token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-11-25", ...(session ? { "Mcp-Session-Id": session } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", ...(notification ? {} : { id: ++id }), method, params }) });
    if (!response.ok) throw new Error(`MCP HTTP ${response.status}`);
    session = response.headers.get("mcp-session-id") || session;
    const text = await response.text(); if (!text.trim()) return {};
    const payload = response.headers.get("content-type")?.includes("text/event-stream")
      ? JSON.parse(text.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).find(line => line.startsWith("{")) || "{}") : JSON.parse(text);
    if (payload.error || payload.result?.isError) throw new Error("MCP rejected the operation; inspect authorization and command state. No browser action will be replayed.");
    return payload.result;
  };
  try {
    await cdp.connect();
    await rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "lusu-private-browser", version: "0.1.0" } });
    await rpc("notifications/initialized", {}, true);
    const evaluate = async expression => {
      const location = await cdp.send("Runtime.evaluate", { expression: "location.href", returnByValue: true }); validatePage(location.result.value);
      const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error("Browser execution failed.");
      return result.result.value;
    };
    do {
      const result = await runKittensCompanionOnce({ browserId: options["browser-id"], evaluate,
        callTool: async (name, args) => (await rpc("tools/call", { name, arguments: args })).structuredContent });
      console.log(JSON.stringify({ idle: Boolean(result.idle), jobId: result.jobId, failed: result.failed }));
      if (options.once || stopped) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    } while (!stopped);
  } finally { cdp.close(); await network.close(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error("Private browser companion stopped. Check endpoint, selected page, OAuth permission and pending job state; commands are not automatically replayed."); process.exitCode = 1; });
