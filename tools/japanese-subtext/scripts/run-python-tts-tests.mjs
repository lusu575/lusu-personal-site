import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptRoot, "../../..");
const configured = String(process.env.JP_SUBTEXT_TTS_PYTHON || "").trim();
const candidates = configured
  ? [{ command: configured, prefix: [] }]
  : process.platform === "win32"
    ? [
        { command: "py", prefix: ["-3"] },
        { command: "python", prefix: [] },
      ]
    : [
        { command: "python3", prefix: [] },
        { command: "python", prefix: [] },
      ];

let selected = null;
for (const candidate of candidates) {
  const probe = spawnSync(
    candidate.command,
    [...candidate.prefix, "--version"],
    { cwd: projectRoot, encoding: "utf8", windowsHide: true },
  );
  if (!probe.error && probe.status === 0) {
    selected = candidate;
    break;
  }
}

if (!selected) {
  const hint = process.platform === "win32"
    ? "$env:JP_SUBTEXT_TTS_PYTHON='F:\\path\\to\\python.exe'"
    : "export JP_SUBTEXT_TTS_PYTHON=/path/to/python3";
  console.error(
    `No usable Python runtime found for the TTS release tests. Configure one for this command only, for example: ${hint}`,
  );
  process.exit(1);
}

const result = spawnSync(
  selected.command,
  [
    ...selected.prefix,
    "-m",
    "unittest",
    "discover",
    "-s",
    "tools/japanese-subtext/scripts/tts/tests",
    "-p",
    "test_*.py",
  ],
  { cwd: projectRoot, stdio: "inherit", windowsHide: true },
);

if (result.error) {
  console.error(`Unable to start the TTS Python tests: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
