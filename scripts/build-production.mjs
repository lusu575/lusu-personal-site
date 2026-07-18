import { createHash, randomUUID } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build as esbuildBuild, transform as esbuildTransform, version as esbuildVersion } from "esbuild";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const POLICY_PATH = path.join(PROJECT_ROOT, "config", "public-production-build.json");
const HASHED_ASSET_DIR = "_assets";
const MANIFEST_FILE = "asset-manifest.json";
const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".map", ".mjs", ".svg", ".txt", ".webmanifest"]);
const CRITICAL_SOURCE_TREES = ["css", "fragments", "js", "tools/japanese-subtext/lib"];
const CRITICAL_SOURCE_FILES = [
  "_headers",
  "_redirects",
  "admin/admin.css",
  "admin/admin.js",
  "admin/index.html",
  "admin/transfer.css",
  "admin/transfer.html",
  "admin/transfer.js",
  "config/public-production-build.json",
  "games/catalog.json",
  "games/game-shell.css",
  "games/game-shell.js",
  "index.html",
  "manifest.webmanifest",
  "tools/japanese-subtext/app.mjs",
  "tools/japanese-subtext/index.html",
  "tools/japanese-subtext/manifest.json",
  "tools/japanese-subtext/style.css"
];

function toPosix(value) {
  return String(value || "").replaceAll("\\", "/");
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeRelative(value) {
  const normalized = path.posix.normalize(toPosix(value).replace(/^\/+/, ""));
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`Unsafe relative path: ${value}`);
  }
  return normalized;
}

function isPathInside(parentPath, childPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function assertPathInside(parentPath, childPath, label) {
  if (!isPathInside(parentPath, childPath) || path.resolve(parentPath) === path.resolve(childPath)) {
    throw new Error(`${label} must stay inside ${parentPath}: ${childPath}`);
  }
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function walkFiles(directory) {
  const files = [];
  async function visit(current, prefix = "") {
    const entries = (await readdir(current, { withFileTypes: true }))
      .sort((left, right) => compareText(left.name, right.name));
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symlinks are not allowed in the public artifact: ${relative}`);
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isFile()) files.push(toPosix(relative));
    }
  }
  await visit(directory);
  return files;
}

async function criticalSourceDigest(projectRoot) {
  const relatives = [...CRITICAL_SOURCE_FILES];
  for (const tree of CRITICAL_SOURCE_TREES) {
    const absoluteTree = path.join(projectRoot, ...tree.split("/"));
    for (const relative of await walkFiles(absoluteTree)) relatives.push(`${tree}/${relative}`);
  }
  relatives.sort(compareText);
  const digest = createHash("sha256");
  for (const relative of relatives) {
    digest.update(relative);
    digest.update("\0");
    digest.update(await readFile(path.join(projectRoot, ...relative.split("/"))));
    digest.update("\0");
  }
  return digest.digest("hex");
}

function excludedByRule(relative, rule, policy) {
  const normalized = toPosix(relative);
  const hasHiddenSegment = normalized.split("/").some((segment) => segment.startsWith("."));
  const extension = path.posix.extname(normalized).toLowerCase();
  return (policy.excludeHiddenTreeEntries && hasHiddenSegment)
    || (rule.excludeFiles || []).includes(normalized)
    || (rule.excludePrefixes || []).some((prefix) => normalized.startsWith(toPosix(prefix)))
    || (rule.excludeExtensions || []).some((value) => extension === String(value).toLowerCase());
}

export function validateOutputPath(relativePath, policy) {
  const normalized = normalizeRelative(relativePath);
  const segments = normalized.toLowerCase().split("/");
  const name = segments.at(-1);
  const extension = path.posix.extname(name);
  const forbiddenSegments = new Set((policy.forbiddenOutputSegments || []).map((value) => String(value).toLowerCase()));
  const forbiddenNames = new Set((policy.forbiddenOutputNames || []).map((value) => String(value).toLowerCase()));
  const forbiddenExtensions = new Set((policy.forbiddenOutputExtensions || []).map((value) => String(value).toLowerCase()));
  if (segments.some((segment) => segment.startsWith("."))) throw new Error(`Forbidden hidden deploy path: ${normalized}`);
  if (segments.some((segment) => forbiddenSegments.has(segment))) throw new Error(`Forbidden deploy segment: ${normalized}`);
  if (forbiddenNames.has(name) || name.startsWith(".env") || name.startsWith(".dev.vars")) {
    throw new Error(`Forbidden deploy file: ${normalized}`);
  }
  if (forbiddenExtensions.has(extension)) throw new Error(`Forbidden deploy extension: ${normalized}`);
  return normalized;
}

export function classifyCache(relativePath) {
  const normalized = normalizeRelative(relativePath);
  const lower = normalized.toLowerCase();
  if (lower.startsWith(`${HASHED_ASSET_DIR}/`)) return "immutable";
  if (lower.startsWith("admin/")) return "no-store";
  if (lower.endsWith(".html") || lower === "_headers" || lower === "_redirects") return "no-cache";
  if (lower.endsWith(".json") || lower.endsWith(".webmanifest") || lower === "robots.txt") return "short";
  if (/\.(?:css|js|mjs)$/.test(lower)) return "short";
  if (lower.startsWith("assets/") || lower.startsWith("tools/japanese-subtext/assets/") || lower.startsWith("tools/japanese-subtext/audio/")) return "day";
  return "platform-default";
}

function publicUrl(relativePath) {
  return `/${toPosix(relativePath).replace(/^\/+/, "")}`;
}

function stripUrlVersion(value) {
  try {
    const parsed = new URL(value, "https://production.invalid/");
    return parsed.pathname;
  } catch {
    return "";
  }
}

export function rewriteHtmlAssetUrls(html, documentPath, replacements) {
  const base = new URL(toPosix(documentPath), "https://production.invalid/");
  return String(html).replace(/(\b(?:href|src)\s*=\s*["'])([^"']+)(["'])/gi, (match, before, value, after) => {
    if (/^(?:data:|mailto:|tel:|javascript:|#)/i.test(value)) return match;
    let parsed;
    try {
      parsed = new URL(value, base);
    } catch {
      return match;
    }
    if (parsed.origin !== base.origin) return match;
    const replacement = replacements.get(parsed.pathname);
    return replacement ? `${before}${replacement}${after}` : match;
  });
}

export function assertCssUrlsStayStable(css, sourcePath, outputPath) {
  const sourceBase = new URL(publicUrl(sourcePath), "https://production.invalid/");
  const outputBase = new URL(publicUrl(outputPath), "https://production.invalid/");
  const pattern = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;
  for (const match of String(css).matchAll(pattern)) {
    const value = match[2].trim();
    if (!value || /^(?:data:|https?:|#|\/\/)/i.test(value)) continue;
    const sourceUrl = new URL(value, sourceBase);
    const outputUrl = new URL(value, outputBase);
    if (`${sourceUrl.pathname}${sourceUrl.search}` !== `${outputUrl.pathname}${outputUrl.search}`) {
      throw new Error(`Moving ${sourcePath} to ${outputPath} changes CSS URL ${value}`);
    }
  }
}

async function copyWithParents(source, destination) {
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

async function copyPolicyFiles(projectRoot, outputRoot, policy, provenance) {
  const jobs = [];
  for (const relative of [...policy.rootFiles, ...policy.standaloneFiles]) {
    const normalized = validateOutputPath(relative, policy);
    jobs.push({ source: path.join(projectRoot, ...normalized.split("/")), relative: normalized, sourceRelative: normalized });
  }
  for (const rule of policy.copyTrees) {
    const treeSource = normalizeRelative(rule.source);
    const treeTarget = normalizeRelative(rule.target || rule.source);
    const absoluteTree = path.join(projectRoot, ...treeSource.split("/"));
    for (const treeRelative of await walkFiles(absoluteTree)) {
      if (excludedByRule(treeRelative, rule, policy)) continue;
      const relative = validateOutputPath(`${treeTarget}/${treeRelative}`, policy);
      jobs.push({ source: path.join(absoluteTree, ...treeRelative.split("/")), relative, sourceRelative: `${treeSource}/${treeRelative}` });
    }
  }
  jobs.sort((left, right) => compareText(left.relative, right.relative));
  const chunkSize = 48;
  for (let start = 0; start < jobs.length; start += chunkSize) {
    await Promise.all(jobs.slice(start, start + chunkSize).map(async ({ source, relative, sourceRelative }) => {
      await copyWithParents(source, path.join(outputRoot, ...relative.split("/")));
      provenance.set(relative, sourceRelative);
    }));
  }
}

function sourceMapText(rawMap, outputName) {
  const parsed = JSON.parse(rawMap);
  parsed.file = outputName;
  parsed.sourceRoot = "/__source__/";
  return `${JSON.stringify(parsed)}\n`;
}

async function writeHashedTransform({
  projectRoot,
  outputRoot,
  sourceRelative,
  logicalName,
  loader,
  format,
  provenance,
  metrics
}) {
  const source = await readFile(path.join(projectRoot, ...sourceRelative.split("/")), "utf8");
  const extension = loader === "css" ? "css" : "js";
  const virtualOutput = `${HASHED_ASSET_DIR}/${logicalName}.000000000000.${extension}`;
  if (loader === "css") assertCssUrlsStayStable(source, sourceRelative, virtualOutput);
  const result = await esbuildTransform(source, {
    charset: "utf8",
    format,
    legalComments: "none",
    loader,
    minify: true,
    sourcefile: toPosix(sourceRelative),
    sourcemap: "external",
    sourcesContent: true,
    target: "es2022"
  });
  const digest = sha256(`${result.code}\0${result.map}`).slice(0, 12);
  const outputName = `${logicalName}.${digest}.${extension}`;
  const outputRelative = `${HASHED_ASSET_DIR}/${outputName}`;
  const mapRelative = `${outputRelative}.map`;
  const mapText = sourceMapText(result.map, outputName);
  const sourceMapComment = loader === "css"
    ? `\n/*# sourceMappingURL=${outputName}.map */\n`
    : `\n//# sourceMappingURL=${outputName}.map\n`;
  const code = `${result.code.trimEnd()}${sourceMapComment}`;
  await mkdir(path.join(outputRoot, HASHED_ASSET_DIR), { recursive: true });
  await writeFile(path.join(outputRoot, ...outputRelative.split("/")), code, "utf8");
  await writeFile(path.join(outputRoot, ...mapRelative.split("/")), mapText, "utf8");
  provenance.set(outputRelative, sourceRelative);
  provenance.set(mapRelative, sourceRelative);
  metrics.push({
    source: sourceRelative,
    sourceBytes: byteLength(source),
    output: outputRelative,
    outputBytes: byteLength(code),
    kind: loader
  });
  return publicUrl(outputRelative);
}

function replaceExactlyOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0 || source.indexOf(search, first + search.length) >= 0) {
    throw new Error(`Expected exactly one ${label} replacement`);
  }
  return `${source.slice(0, first)}${replacement}${source.slice(first + search.length)}`;
}

function publicRewritePlugin({ routeStyles, transferAssets }) {
  const mainPath = path.join(PROJECT_ROOT, "js", "main.js");
  const transferLoaderPath = path.join(PROJECT_ROOT, "js", "features", "quick-transfer-loader.mjs");
  return {
    name: "production-public-paths",
    setup(build) {
      build.onLoad({ filter: /(?:main\.js|quick-transfer-loader\.mjs)$/ }, async (args) => {
        let source = await readFile(args.path, "utf8");
        if (path.resolve(args.path) === path.resolve(mainPath)) {
          for (const [route, outputUrl] of Object.entries(routeStyles)) {
            source = replaceExactlyOnce(
              source,
              `\`/css/routes/${route}.css?v=\${routeStyleVersion}\``,
              JSON.stringify(outputUrl),
              `${route} route stylesheet`
            );
          }
        }
        if (path.resolve(args.path) === path.resolve(transferLoaderPath)) {
          source = replaceExactlyOnce(source, 'const FRAGMENT_PATH = "/fragments/quick-transfer.html";', `const FRAGMENT_PATH = ${JSON.stringify(transferAssets.fragment)};`, "transfer fragment");
          source = replaceExactlyOnce(source, 'const FRAGMENT_URL = `${FRAGMENT_PATH}?v=${TRANSFER_VERSION}`;', "const FRAGMENT_URL = FRAGMENT_PATH;", "transfer fragment URL");
          source = replaceExactlyOnce(source, 'const STYLESHEET_URL = `/css/transfer.css?v=${TRANSFER_VERSION}`;', `const STYLESHEET_URL = ${JSON.stringify(transferAssets.css)};`, "transfer stylesheet");
          source = replaceExactlyOnce(source, 'const SCRIPT_URL = `/js/transfer.js?v=${TRANSFER_VERSION}`;', `const SCRIPT_URL = ${JSON.stringify(transferAssets.js)};`, "transfer script");
        }
        return { contents: source, loader: "js", resolveDir: path.dirname(args.path) };
      });
    }
  };
}

function japaneseToolRewritePlugin() {
  return {
    name: "production-japanese-tool-paths",
    setup(build) {
      build.onLoad({ filter: /(?:audio-player|content-loader)\.mjs$/ }, async (args) => {
        let source = await readFile(args.path, "utf8");
        if (args.path.endsWith("audio-player.mjs")) {
          source = replaceExactlyOnce(source, 'new URL("../audio/manifest.json", import.meta.url)', 'new URL("/tools/japanese-subtext/audio/manifest.json", location.origin)', "tool audio manifest");
          source = replaceExactlyOnce(source, 'new URL("../audio/", import.meta.url)', 'new URL("/tools/japanese-subtext/audio/", location.origin)', "tool audio root");
        } else {
          source = replaceExactlyOnce(source, 'new URL("../content/", import.meta.url)', 'new URL("/tools/japanese-subtext/content/", location.origin)', "tool content root");
        }
        return { contents: source, loader: "js", resolveDir: path.dirname(args.path) };
      });
    }
  };
}

function resolveMetafileOutput(projectRoot, outputKey) {
  return path.isAbsolute(outputKey) ? outputKey : path.resolve(projectRoot, outputKey);
}

async function registerEsbuildOutputs({ projectRoot, outputRoot, metafile, provenance, sourceLabel, expectedEntryPoint }) {
  let entryUrl = "";
  let inputBytes = 0;
  let outputBytes = 0;
  for (const input of Object.values(metafile.inputs)) inputBytes += Number(input.bytes || 0);
  for (const [outputKey, details] of Object.entries(metafile.outputs)) {
    const absolute = resolveMetafileOutput(projectRoot, outputKey);
    if (!isPathInside(outputRoot, absolute)) throw new Error(`esbuild output escaped the production directory: ${outputKey}`);
    const relative = toPosix(path.relative(outputRoot, absolute));
    provenance.set(relative, details.entryPoint ? toPosix(details.entryPoint) : sourceLabel);
    if (!relative.endsWith(".map")) outputBytes += Number(details.bytes || 0);
    const entryPoint = toPosix(details.entryPoint || "").split("?")[0];
    if (entryPoint === expectedEntryPoint) entryUrl = publicUrl(relative);
  }
  for (const relative of await walkFiles(path.join(outputRoot, HASHED_ASSET_DIR))) {
    const outputRelative = `${HASHED_ASSET_DIR}/${relative}`;
    if (!provenance.has(outputRelative)) provenance.set(outputRelative, sourceLabel);
  }
  if (!entryUrl) throw new Error(`esbuild did not emit an entry for ${sourceLabel}`);
  return { entryUrl, inputBytes, outputBytes };
}

async function buildPublicModules({ outputRoot, routeStyles, transferAssets, provenance, metrics }) {
  const result = await esbuildBuild({
    absWorkingDir: PROJECT_ROOT,
    bundle: true,
    charset: "utf8",
    chunkNames: "chunks/[name].[hash]",
    entryNames: "[name].[hash]",
    entryPoints: [{ in: "js/main.js", out: "main" }],
    format: "esm",
    legalComments: "none",
    metafile: true,
    minify: true,
    outdir: path.join(outputRoot, HASHED_ASSET_DIR),
    platform: "browser",
    plugins: [publicRewritePlugin({ routeStyles, transferAssets })],
    sourceRoot: "/__source__/",
    sourcemap: "linked",
    sourcesContent: true,
    splitting: true,
    target: "es2022",
    write: true
  });
  const summary = await registerEsbuildOutputs({
    projectRoot: PROJECT_ROOT,
    outputRoot,
    metafile: result.metafile,
    provenance,
    sourceLabel: "esbuild:public-module-graph",
    expectedEntryPoint: "js/main.js"
  });
  metrics.push({ source: "public-module-graph", sourceBytes: summary.inputBytes, output: stripUrlVersion(summary.entryUrl), outputBytes: summary.outputBytes, kind: "js-bundle" });
  return summary.entryUrl;
}

async function buildJapaneseTool({ outputRoot, provenance, metrics }) {
  const result = await esbuildBuild({
    absWorkingDir: PROJECT_ROOT,
    bundle: true,
    charset: "utf8",
    entryNames: "japanese-subtext.[hash]",
    entryPoints: ["tools/japanese-subtext/app.mjs"],
    format: "esm",
    legalComments: "none",
    metafile: true,
    minify: true,
    outdir: path.join(outputRoot, HASHED_ASSET_DIR),
    platform: "browser",
    plugins: [japaneseToolRewritePlugin()],
    sourceRoot: "/__source__/",
    sourcemap: "linked",
    sourcesContent: true,
    splitting: false,
    target: "es2022",
    write: true
  });
  const summary = await registerEsbuildOutputs({
    projectRoot: PROJECT_ROOT,
    outputRoot,
    metafile: result.metafile,
    provenance,
    sourceLabel: "esbuild:japanese-subtext",
    expectedEntryPoint: "tools/japanese-subtext/app.mjs"
  });
  metrics.push({ source: "tools/japanese-subtext/app.mjs", sourceBytes: summary.inputBytes, output: stripUrlVersion(summary.entryUrl), outputBytes: summary.outputBytes, kind: "js-bundle" });
  return summary.entryUrl;
}

async function writeHashedFragment(outputRoot, provenance) {
  const sourceRelative = "fragments/quick-transfer.html";
  const source = await readFile(path.join(PROJECT_ROOT, ...sourceRelative.split("/")));
  const digest = sha256(source).slice(0, 12);
  const outputRelative = `${HASHED_ASSET_DIR}/quick-transfer.${digest}.fragment`;
  await mkdir(path.join(outputRoot, HASHED_ASSET_DIR), { recursive: true });
  await writeFile(path.join(outputRoot, ...outputRelative.split("/")), source);
  provenance.set(outputRelative, sourceRelative);
  return publicUrl(outputRelative);
}

async function rewriteEntrypointHtml({ outputRoot, policy, replacements, provenance }) {
  for (const relative of policy.htmlEntrypoints) {
    const normalized = normalizeRelative(relative);
    const outputPath = path.join(outputRoot, ...normalized.split("/"));
    const html = await readFile(outputPath, "utf8");
    const rewritten = rewriteHtmlAssetUrls(html, normalized, replacements);
    if (rewritten === html) throw new Error(`Production HTML did not rewrite any asset URL: ${normalized}`);
    await writeFile(outputPath, rewritten, "utf8");
    provenance.set(normalized, normalized);
  }
}

async function rewriteJapaneseAudioManifest(outputRoot, provenance) {
  const relative = "tools/japanese-subtext/audio/manifest.json";
  const outputPath = path.join(outputRoot, ...relative.split("/"));
  const source = await readFile(outputPath, "utf8");
  const rewritten = source.replaceAll("../scripts/tts/licenses/", "../licenses/");
  if (rewritten === source) throw new Error("Japanese audio manifest did not expose its production license path");
  await writeFile(outputPath, rewritten, "utf8");
  provenance.set(relative, relative);
}

async function verifyEntrypointReferences(outputRoot, policy) {
  for (const relative of policy.htmlEntrypoints) {
    const html = await readFile(path.join(outputRoot, ...relative.split("/")), "utf8");
    const base = new URL(toPosix(relative), "https://production.invalid/");
    for (const match of html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
      const value = match[1];
      if (/^(?:#|data:|mailto:|tel:|javascript:)/i.test(value)) continue;
      const resolved = new URL(value, base);
      if (resolved.origin !== base.origin) continue;
      const decodedPath = decodeURIComponent(resolved.pathname).replace(/^\/+/, "");
      const targetRelative = decodedPath ? normalizeRelative(decodedPath) : "index.html";
      const target = path.join(outputRoot, ...targetRelative.split("/"));
      if (!await exists(target) && !await exists(path.join(target, "index.html"))) {
        throw new Error(`Missing production reference from ${relative}: ${value}`);
      }
    }
  }
}

async function assertNoBuildPathLeaks(outputRoot, projectRoot) {
  const forbidden = [
    toPosix(path.resolve(projectRoot)).toLowerCase(),
    path.resolve(projectRoot).toLowerCase()
  ];
  for (const relative of await walkFiles(outputRoot)) {
    if (!TEXT_EXTENSIONS.has(path.posix.extname(relative).toLowerCase())) continue;
    const text = (await readFile(path.join(outputRoot, ...relative.split("/")), "utf8")).toLowerCase();
    if (forbidden.some((value) => text.includes(value))) throw new Error(`Absolute workspace path leaked into ${relative}`);
    if (text.includes(".production-build-")) throw new Error(`Temporary build path leaked into ${relative}`);
  }
}

async function createManifest({ outputRoot, policy, policyText, provenance, metrics, entries }) {
  const files = [];
  for (const relative of (await walkFiles(outputRoot)).filter((value) => value !== MANIFEST_FILE)) {
    validateOutputPath(relative, policy);
    const content = await readFile(path.join(outputRoot, ...relative.split("/")));
    files.push({
      path: publicUrl(relative),
      bytes: content.byteLength,
      sha256: sha256(content),
      cache: classifyCache(relative),
      source: provenance.get(relative) || relative
    });
  }
  files.sort((left, right) => compareText(left.path, right.path));
  const sourceBytes = metrics.reduce((sum, item) => sum + item.sourceBytes, 0);
  const minifiedBytes = metrics.reduce((sum, item) => sum + item.outputBytes, 0);
  const manifest = {
    schemaVersion: 1,
    target: "cloudflare-pages-static",
    rootDeploymentCompatible: true,
    outputDirectory: policy.outputDirectory,
    inventoryExcludes: [`/${MANIFEST_FILE}`],
    toolchain: { esbuild: esbuildVersion },
    policy: {
      path: "/config/public-production-build.json",
      sha256: sha256(policyText)
    },
    entries,
    compression: {
      sourceBytes,
      minifiedBytes,
      savedBytes: sourceBytes - minifiedBytes,
      ratio: sourceBytes ? Number((minifiedBytes / sourceBytes).toFixed(6)) : 0,
      assets: metrics
        .map((item) => ({ ...item, output: publicUrl(item.output.replace(/^\//, "")) }))
        .sort((left, right) => compareText(left.output, right.output))
    },
    files
  };
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(path.join(outputRoot, MANIFEST_FILE), text, "utf8");
  return { manifest, text };
}

export async function verifyManifestInventory(outputRoot, manifest) {
  const actual = (await walkFiles(outputRoot)).sort(compareText);
  const expected = [...manifest.files.map((file) => file.path.replace(/^\//, "")), MANIFEST_FILE]
    .sort(compareText);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Production output contains files outside asset-manifest.json");
  for (const file of manifest.files) {
    const relative = file.path.replace(/^\//, "");
    const content = await readFile(path.join(outputRoot, ...relative.split("/")));
    if (content.byteLength !== file.bytes || sha256(content) !== file.sha256) {
      throw new Error(`Manifest digest mismatch: ${file.path}`);
    }
    if (file.cache === "immutable" && !relative.startsWith(`${HASHED_ASSET_DIR}/`)) {
      throw new Error(`Only content-hashed assets may be immutable: ${file.path}`);
    }
  }
  const entryUrls = [];
  const collectEntryUrls = (value) => {
    if (typeof value === "string" && value.startsWith("/")) entryUrls.push(value);
    else if (Array.isArray(value)) value.forEach(collectEntryUrls);
    else if (value && typeof value === "object") Object.values(value).forEach(collectEntryUrls);
  };
  collectEntryUrls(manifest.entries);
  const inventory = new Set(manifest.files.map((file) => file.path));
  for (const url of entryUrls) {
    if (!inventory.has(url)) throw new Error(`Manifest entry is missing from its file inventory: ${url}`);
  }
}

async function buildCandidate(outputRoot) {
  const sourceDigest = await criticalSourceDigest(PROJECT_ROOT);
  const policyText = await readFile(POLICY_PATH, "utf8");
  const policy = JSON.parse(policyText);
  const provenance = new Map();
  const metrics = [];
  await mkdir(outputRoot, { recursive: true });
  await copyPolicyFiles(PROJECT_ROOT, outputRoot, policy, provenance);

  const styleAssets = {};
  const cssEntries = [
    ["style", "css/style.css", "site"],
    ["mobile", "css/mobile-ios-shell.css", "mobile-shell"],
    ["motion", "css/motion-system.css", "motion"],
    ["knowledge", "css/routes/knowledge.css", "route-knowledge"],
    ["videos", "css/routes/videos.css", "route-videos"],
    ["games", "css/routes/games.css", "route-games"],
    ["chatroom", "css/routes/chatroom.css", "route-chatroom"],
    ["transfer", "css/transfer.css", "quick-transfer"],
    ["admin", "admin/admin.css", "admin"],
    ["adminTransfer", "admin/transfer.css", "admin-transfer"],
    ["gameShell", "games/game-shell.css", "game-shell"],
    ["japaneseTool", "tools/japanese-subtext/style.css", "japanese-subtext"]
  ];
  for (const [key, sourceRelative, logicalName] of cssEntries) {
    styleAssets[key] = await writeHashedTransform({
      projectRoot: PROJECT_ROOT,
      outputRoot,
      sourceRelative,
      logicalName,
      loader: "css",
      format: undefined,
      provenance,
      metrics
    });
  }

  const scriptAssets = {};
  const scriptEntries = [
    ["mobile", "js/mobile-shell.js", "mobile-shell"],
    ["telemetry", "js/telemetry.js", "telemetry"],
    ["motion", "js/ui-motion.js", "ui-motion"],
    ["transfer", "js/transfer.js", "quick-transfer"],
    ["admin", "admin/admin.js", "admin"],
    ["adminTransfer", "admin/transfer.js", "admin-transfer"],
    ["gameShell", "games/game-shell.js", "game-shell"]
  ];
  for (const [key, sourceRelative, logicalName] of scriptEntries) {
    scriptAssets[key] = await writeHashedTransform({
      projectRoot: PROJECT_ROOT,
      outputRoot,
      sourceRelative,
      logicalName,
      loader: "js",
      format: "iife",
      provenance,
      metrics
    });
  }

  const fragment = await writeHashedFragment(outputRoot, provenance);
  const main = await buildPublicModules({
    outputRoot,
    routeStyles: {
      knowledge: styleAssets.knowledge,
      videos: styleAssets.videos,
      games: styleAssets.games,
      chatroom: styleAssets.chatroom
    },
    transferAssets: { fragment, css: styleAssets.transfer, js: scriptAssets.transfer },
    provenance,
    metrics
  });
  if (!/^\/_assets\/main\.[A-Z0-9]+\.js$/i.test(main)) throw new Error(`Unexpected public entry output: ${main}`);
  const japaneseTool = await buildJapaneseTool({ outputRoot, provenance, metrics });
  if (!/^\/_assets\/japanese-subtext\.[A-Z0-9]+\.js$/i.test(japaneseTool)) throw new Error(`Unexpected Japanese tool entry output: ${japaneseTool}`);

  const replacements = new Map([
    ["/css/style.css", styleAssets.style],
    ["/css/mobile-ios-shell.css", styleAssets.mobile],
    ["/css/motion-system.css", styleAssets.motion],
    ["/js/mobile-shell.js", scriptAssets.mobile],
    ["/js/telemetry.js", scriptAssets.telemetry],
    ["/js/ui-motion.js", scriptAssets.motion],
    ["/js/main.js", main],
    ["/admin/admin.css", styleAssets.admin],
    ["/admin/admin.js", scriptAssets.admin],
    ["/admin/transfer.css", styleAssets.adminTransfer],
    ["/admin/transfer.js", scriptAssets.adminTransfer],
    ["/games/game-shell.css", styleAssets.gameShell],
    ["/games/game-shell.js", scriptAssets.gameShell],
    ["/tools/japanese-subtext/style.css", styleAssets.japaneseTool],
    ["/tools/japanese-subtext/app.mjs", japaneseTool],
    ["/tools/japanese-subtext/scripts/tts/licenses/NOTICE-japanese-voices.md", "/tools/japanese-subtext/licenses/NOTICE-japanese-voices.md"]
  ]);
  await rewriteEntrypointHtml({ outputRoot, policy, replacements, provenance });
  await rewriteJapaneseAudioManifest(outputRoot, provenance);
  await verifyEntrypointReferences(outputRoot, policy);
  await assertNoBuildPathLeaks(outputRoot, PROJECT_ROOT);
  if (await criticalSourceDigest(PROJECT_ROOT) !== sourceDigest) {
    throw new Error("Production source changed during the build; the previous artifact was left untouched");
  }

  if (metrics.some((item) => item.outputBytes >= item.sourceBytes && item.kind !== "js-bundle")) {
    const failed = metrics.filter((item) => item.outputBytes >= item.sourceBytes && item.kind !== "js-bundle").map((item) => item.source);
    throw new Error(`Minification did not reduce: ${failed.join(", ")}`);
  }
  const entries = {
    site: {
      html: "/index.html",
      css: [styleAssets.style, styleAssets.mobile, styleAssets.motion],
      routeCss: [styleAssets.knowledge, styleAssets.videos, styleAssets.games, styleAssets.chatroom],
      scripts: [scriptAssets.mobile, scriptAssets.telemetry, scriptAssets.motion, main]
    },
    admin: { html: "/admin/index.html", css: styleAssets.admin, script: scriptAssets.admin },
    transferAdmin: { html: "/admin/transfer.html", css: styleAssets.adminTransfer, script: scriptAssets.adminTransfer },
    gameShell: { css: styleAssets.gameShell, script: scriptAssets.gameShell },
    japaneseSubtext: { html: "/tools/japanese-subtext/index.html", css: styleAssets.japaneseTool, script: japaneseTool },
    quickTransfer: { fragment, css: styleAssets.transfer, script: scriptAssets.transfer }
  };
  const { manifest, text } = await createManifest({ outputRoot, policy, policyText, provenance, metrics, entries });
  await verifyManifestInventory(outputRoot, manifest);
  return { manifest, manifestText: text };
}

export async function replaceDirectoryAtomically(candidateDir, outputDir, options = {}) {
  const boundary = path.resolve(options.boundary || path.dirname(outputDir));
  assertPathInside(boundary, candidateDir, "Candidate directory");
  assertPathInside(boundary, outputDir, "Output directory");
  if (path.resolve(candidateDir) === path.resolve(outputDir)) throw new Error("Candidate and output directories must differ");
  const backupDir = `${path.resolve(outputDir)}.previous-${process.pid}-${randomUUID()}`;
  assertPathInside(boundary, backupDir, "Backup directory");
  const hadOutput = await exists(outputDir);
  if (hadOutput) await rename(outputDir, backupDir);
  try {
    if (options.beforePromote) await options.beforePromote();
    await rename(candidateDir, outputDir);
    if (hadOutput) await rm(backupDir, { recursive: true, force: true });
  } catch (error) {
    if (await exists(outputDir)) await rm(outputDir, { recursive: true, force: true });
    if (hadOutput && await exists(backupDir)) await rename(backupDir, outputDir);
    throw error;
  }
}

async function createCandidateDirectory() {
  return mkdtemp(path.join(PROJECT_ROOT, ".production-build-"));
}

export async function buildProduction({ verifyReproducible = false } = {}) {
  const policy = await readJson(POLICY_PATH);
  const outputDir = path.join(PROJECT_ROOT, policy.outputDirectory);
  assertPathInside(PROJECT_ROOT, outputDir, "Production output");
  const candidates = [];
  try {
    const first = await createCandidateDirectory();
    candidates.push(first);
    const firstResult = await buildCandidate(first);
    let promoted = first;
    let result = firstResult;
    if (verifyReproducible) {
      const second = await createCandidateDirectory();
      candidates.push(second);
      const secondResult = await buildCandidate(second);
      if (firstResult.manifestText !== secondResult.manifestText) {
        throw new Error("Reproducibility check failed: consecutive manifests differ");
      }
      await rm(first, { recursive: true, force: true });
      candidates.splice(candidates.indexOf(first), 1);
      promoted = second;
      result = secondResult;
    }
    await replaceDirectoryAtomically(promoted, outputDir, { boundary: PROJECT_ROOT });
    candidates.splice(candidates.indexOf(promoted), 1);
    return {
      outputDir,
      files: result.manifest.files.length + 1,
      payloadBytes: result.manifest.files.reduce((sum, file) => sum + file.bytes, 0),
      sourceBytes: result.manifest.compression.sourceBytes,
      minifiedBytes: result.manifest.compression.minifiedBytes,
      manifestSha256: sha256(result.manifestText),
      reproducible: verifyReproducible
    };
  } finally {
    for (const candidate of candidates) {
      if (isPathInside(PROJECT_ROOT, candidate) && await exists(candidate)) {
        await rm(candidate, { recursive: true, force: true });
      }
    }
  }
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KiB`;
  return `${bytes} B`;
}

async function main() {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify-reproducible");
  if (unknown.length) throw new Error(`Unknown build option: ${unknown.join(" ")}`);
  const summary = await buildProduction({ verifyReproducible: process.argv.includes("--verify-reproducible") });
  console.log(`Production artifact: ${summary.outputDir}`);
  console.log(`Inventory: ${summary.files} files, ${formatBytes(summary.payloadBytes)}`);
  console.log(`Minified first-party JS/CSS: ${formatBytes(summary.sourceBytes)} -> ${formatBytes(summary.minifiedBytes)}`);
  console.log(`Manifest SHA-256: ${summary.manifestSha256}`);
  if (summary.reproducible) console.log("Reproducibility: two consecutive builds matched exactly");
}

const isDirect = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirect) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  });
}
