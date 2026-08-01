import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const textExtensions = new Set([
  ".cjs", ".css", ".env", ".example", ".html", ".js", ".json", ".jsonc",
  ".jsx", ".lock", ".md", ".mjs", ".scss", ".sql", ".toml", ".ts", ".tsx",
  ".txt", ".xml", ".yaml", ".yml"
]);
const secretPatterns = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ["openai-key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g],
  ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ["jwt", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g]
];

const ignoredDirectories = new Set([
  ".git", ".wrangler", ".wrangler-config", ".codex-remote-attachments", ".codex-screenshots",
  ".codex-worktrees", ".playwright-cli", "node_modules", "output"
]);
const ignoredLocalFiles = /^(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|tts\.local\.json)$/i;

function sourceFiles(directory = root) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...sourceFiles(resolve(directory, entry.name)));
      continue;
    }
    if (!entry.isFile() || ignoredLocalFiles.test(entry.name)) continue;
    if (textExtensions.has(extname(entry.name).toLowerCase())) files.push(relative(root, resolve(directory, entry.name)));
  }
  return files;
}

test("repository source does not contain recognizable credential values", () => {
  const files = sourceFiles();
  const findings = [];
  const ownerConfigurationFindings = [];
  for (const file of files) {
    let source;
    try {
      source = readFileSync(resolve(root, file), "utf8");
    } catch {
      continue;
    }
    if (source.includes("\0")) continue;
    for (const [risk, pattern] of secretPatterns) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) {
        findings.push({
          file,
          line: source.slice(0, match.index).split("\n").length,
          risk
        });
      }
    }
    if (/const\s+OWNER_ADMIN_EMAILS\s*=\s*new\s+Set\s*\(/.test(source)) {
      ownerConfigurationFindings.push(file);
    }
  }
  assert.deepEqual(findings, [], `recognizable credential patterns found: ${JSON.stringify(findings)}`);
  assert.deepEqual(ownerConfigurationFindings, [], "owner admin emails must come from runtime environment configuration");

  const envExample = readFileSync(resolve(root, ".env.example"), "utf8");
  for (const name of [
    "CHAT_IP_HASH_SALT",
    "ANALYTICS_IP_HASH_SALT",
    "OWNER_ADMIN_EMAILS",
    "WHITEBOARD_ROOM_HMAC_SECRET",
    "WHITEBOARD_TICKET_SECRET",
    "WHITEBOARD_INTERNAL_SECRET",
    "WHITEBOARD_IP_HASH_SALT"
  ]) {
    assert.match(envExample, new RegExp(`^${name}=\\s*$`, "m"));
  }
});
