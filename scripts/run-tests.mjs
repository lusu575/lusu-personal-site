import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const requested = process.argv.slice(2);

if (!requested.length) {
  throw new Error("Pass at least one test file or a supported *.mjs pattern.");
}

const files = new Set();
for (const request of requested) {
  const normalized = request.replaceAll("\\", "/");
  if (!normalized.includes("*")) {
    addTestFile(normalized);
    continue;
  }

  const match = /^(.*)\/\*([^/]*)$/.exec(normalized);
  if (!match || match[2].includes("*")) {
    throw new Error(`Unsupported test pattern: ${request}`);
  }
  const [, directory, suffix] = match;
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(suffix)) {
      addTestFile(`${directory}/${entry.name}`);
    }
  }
}

const orderedFiles = [...files].sort((left, right) => left.localeCompare(right, "en"));
if (!orderedFiles.length) {
  throw new Error("No test files matched the requested paths.");
}

for (const file of orderedFiles) {
  await import(pathToFileURL(file));
}

function addTestFile(path) {
  const file = resolve(root, path);
  const projectRelative = relative(root, file);
  if (projectRelative.startsWith("..") || resolve(root, projectRelative) !== file || !file.endsWith(".mjs")) {
    throw new Error(`Test file must stay inside the repository and end in .mjs: ${path}`);
  }
  files.add(file);
}
