import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const moduleExtensions = new Set([".js", ".mjs"]);
const moduleRoots = ["js/core", "js/data", "js/features", "js/routes"];

function walkModules(root, relativeDir) {
  const fullDir = resolve(root, relativeDir);
  if (!existsSync(fullDir)) return [];
  return readdirSync(fullDir, { withFileTypes: true }).flatMap((entry) => {
    const child = `${relativeDir}/${entry.name}`.replace(/\\/g, "/");
    if (entry.isDirectory()) return walkModules(root, child);
    return entry.isFile() && moduleExtensions.has(extname(entry.name)) ? [child] : [];
  });
}

function stripQuery(specifier) {
  return String(specifier || "").split(/[?#]/, 1)[0];
}

function importSpecifiers(source) {
  const values = [];
  const patterns = [
    /\bimport\s+(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bexport\s+[^"']+?\s+from\s+["']([^"']+)["']/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) values.push(match[1]);
  }
  return [...new Set(values)];
}

function moduleLayer(path) {
  if (path === "js/main.js") return "entry";
  if (path.startsWith("js/core/")) return "core";
  if (path.startsWith("js/data/")) return "data";
  if (path.startsWith("js/features/")) return "feature";
  if (path.startsWith("js/routes/")) return "route";
  return "external";
}

function routeName(path) {
  return path.startsWith("js/routes/") ? path.slice("js/routes/".length).split("/", 1)[0].replace(/\.[^.]+$/, "") : "";
}

function resolveImport(root, importer, specifier) {
  if (!specifier.startsWith(".")) return null;
  const candidate = resolve(root, dirname(importer), stripQuery(specifier));
  const fromRoot = relative(root, candidate).replace(/\\/g, "/");
  if (!fromRoot || fromRoot === ".." || fromRoot.startsWith("../")) return { error: `${importer} import escapes repository root: ${specifier}` };
  const resolvedPath = moduleExtensions.has(extname(candidate))
    ? candidate
    : [".mjs", ".js"].map((suffix) => `${candidate}${suffix}`).find(existsSync);
  if (!resolvedPath || !existsSync(resolvedPath)) return { error: `${importer} import is missing: ${specifier}` };
  const relativePath = relative(root, resolvedPath).replace(/\\/g, "/");
  if (!relativePath.startsWith("js/")) return { error: `${importer} import leaves the public js graph: ${specifier}` };
  return { path: relativePath };
}

function maskDeclaredFunctionBodies(source) {
  const masked = [...source];
  const declaration = /\b(?:export\s+)?(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{/g;
  for (const match of source.matchAll(declaration)) {
    const bodyStart = match.index + match[0].lastIndexOf("{");
    let depth = 0;
    let bodyEnd = source.length - 1;
    for (let index = bodyStart; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      if (source[index] === "}") depth -= 1;
      if (depth === 0) {
        bodyEnd = index;
        break;
      }
    }
    for (let index = match.index; index <= bodyEnd; index += 1) masked[index] = " ";
  }
  return masked.join("");
}

function topLevelSideEffectFailures(path, source) {
  if (!path.startsWith("js/routes/")) return [];
  const stripped = maskDeclaredFunctionBodies(source)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^(?:export\s+)?(?:const|let|var)\s+[^=]+?=\s*(?:Object\.freeze\()?\s*\{[\s\S]*?^\};?$/gm, "");
  const failures = [];
  for (const [label, pattern] of [
    ["DOM query", /\bdocument\.(?:querySelector|getElementById|addEventListener)\s*\(/],
    ["network request", /\bfetch\s*\(/],
    ["timer", /\bset(?:Timeout|Interval)\s*\(/]
  ]) {
    if (pattern.test(stripped)) failures.push(`${path} has a top-level ${label}; move it into enter()/init()`);
  }
  return failures;
}

export function validatePublicModuleGraph({ root = scriptRoot } = {}) {
  const files = ["js/main.js", ...moduleRoots.flatMap((dir) => walkModules(root, dir))]
    .filter((value, index, list) => list.indexOf(value) === index)
    .sort();
  const failures = [];
  const graph = new Map(files.map((file) => [file, []]));
  for (const file of files) {
    const fullPath = resolve(root, file);
    if (!existsSync(fullPath)) {
      failures.push(`missing ${file}`);
      continue;
    }
    const source = readFileSync(fullPath, "utf8");
    failures.push(...topLevelSideEffectFailures(file, source));
    for (const specifier of importSpecifiers(source)) {
      const resolved = resolveImport(root, file, specifier);
      if (!resolved) continue;
      if (resolved.error) {
        failures.push(resolved.error);
        continue;
      }
      graph.get(file).push(resolved.path);
      const fromLayer = moduleLayer(file);
      const toLayer = moduleLayer(resolved.path);
      if (fromLayer === "core" && ["feature", "route"].includes(toLayer)) failures.push(`${file} core module cannot import ${resolved.path}`);
      if (fromLayer === "data" && ["feature", "route", "entry"].includes(toLayer)) failures.push(`${file} data module cannot import ${resolved.path}`);
      if (fromLayer === "route" && toLayer === "entry") failures.push(`${file} route module cannot import the composition root ${resolved.path}`);
      if (fromLayer === "route" && toLayer === "route" && routeName(file) !== routeName(resolved.path)) failures.push(`${file} cannot import sibling route ${resolved.path}`);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const visit = (file) => {
    if (visiting.has(file)) {
      const start = stack.indexOf(file);
      failures.push(`public module cycle: ${[...stack.slice(start), file].join(" -> ")}`);
      return;
    }
    if (visited.has(file)) return;
    visiting.add(file);
    stack.push(file);
    for (const dependency of graph.get(file) || []) visit(dependency);
    stack.pop();
    visiting.delete(file);
    visited.add(file);
  };
  for (const file of files) visit(file);

  const entrySource = existsSync(resolve(root, "js/main.js")) ? readFileSync(resolve(root, "js/main.js"), "utf8") : "";
  for (const requiredImport of ["./core/i18n.mjs", "./data/home-content.mjs"]) {
    if (!entrySource.includes(requiredImport)) failures.push(`js/main.js must import ${requiredImport}`);
  }
  return { files, graph: Object.fromEntries([...graph].map(([file, deps]) => [file, [...deps].sort()])), failures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = validatePublicModuleGraph();
  if (result.failures.length) {
    result.failures.forEach((failure) => console.error(`public-module-graph: ${failure}`));
    process.exitCode = 1;
  } else {
    console.log(`public-module-graph: ok (${result.files.length} modules)`);
  }
}
