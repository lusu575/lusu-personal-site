import { readFile } from "node:fs/promises";

const configUrl = new URL("../wrangler.jsonc", import.meta.url);
const config = JSON.parse(await readFile(configUrl, "utf8"));
const failures = [];

const oauthKv = Array.isArray(config.kv_namespaces)
  ? config.kv_namespaces.find((binding) => binding?.binding === "OAUTH_KV")
  : null;
if (!oauthKv || typeof oauthKv.id !== "string"
  || !/^[a-f0-9]{32}$/i.test(oauthKv.id)
  || /^0{32}$/.test(oauthKv.id)) {
  failures.push("OAUTH_KV must reference a real 32-character Cloudflare KV namespace ID.");
}
if (config.workers_dev !== false) {
  failures.push("workers_dev must remain false for this owner-only Worker.");
}
if (config.observability?.enabled !== false) {
  failures.push("Persistent Worker observability must remain disabled for OAuth query privacy.");
}
const requiredSecrets = config.secrets?.required;
if (!Array.isArray(requiredSecrets) || !requiredSecrets.includes("ANALYTICS_IP_HASH_SALT")) {
  failures.push("ANALYTICS_IP_HASH_SALT must remain a required Wrangler secret.");
}
const routePatterns = new Set((config.routes || []).map((route) => route?.pattern));
for (const path of [
  "/mcp",
  "/oauth/authorize",
  "/oauth/token",
  "/oauth/register",
  "/.well-known/oauth-authorization-server",
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-protected-resource/mcp"
]) {
  if (!routePatterns.has(`lusu575.com${path}*`)) {
    failures.push(`Missing query-safe production route: lusu575.com${path}*`);
  }
}

if (failures.length) {
  console.error("Deployment preflight failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Deployment preflight passed.");
}
