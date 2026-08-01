import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertExcalidrawOptionalConverterDisabled,
  assertWhiteboardRuntimeNotices,
  assertCssUrlsStayStable,
  classifyCache,
  replaceDirectoryAtomically,
  rewriteHtmlAssetUrls,
  rewriteJapaneseToolModulePaths,
  validateOutputPath,
  verifyManifestInventory
} from "../scripts/build-production.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policy = JSON.parse(await readFile(path.join(root, "config", "public-production-build.json"), "utf8"));

test("whiteboard build requires the local disabled converter and rejects optional diagram packages", () => {
  const disabledInput = "lusu-disabled-excalidraw-converter:disabled";
  assert.doesNotThrow(() => assertExcalidrawOptionalConverterDisabled({
    inputs: {
      "tools/whiteboard/src/main.jsx": { bytes: 1 },
      [disabledInput]: { bytes: 1 }
    }
  }));
  assert.throws(
    () => assertExcalidrawOptionalConverterDisabled({ inputs: { "tools/whiteboard/src/main.jsx": { bytes: 1 } } }),
    /did not resolve the local disabled/
  );
  for (const forbidden of [
    "node_modules/@excalidraw/mermaid-to-excalidraw/dist/index.js",
    "node_modules/mermaid/dist/mermaid.js",
    "node_modules/dompurify/dist/purify.js",
    "node_modules/@mermaid-js/parser/dist/mermaid-parser.core.mjs",
    "node_modules/langium/lib/index.js",
    "node_modules/chevrotain/lib/src/api.js"
  ]) {
    assert.throws(
      () => assertExcalidrawOptionalConverterDisabled({
        inputs: {
          [disabledInput]: { bytes: 1 },
          [forbidden]: { bytes: 1 }
        }
      }),
      /included disabled diagram-converter code/
    );
  }
});

test("whiteboard build requires versioned notices for every runtime package", async () => {
  const metafile = {
    inputs: {
      "node_modules/react/index.js": { bytes: 1 },
      "node_modules/yjs/dist/yjs.mjs": { bytes: 1 },
      "tools/whiteboard/src/main.jsx": { bytes: 1 }
    }
  };
  await assert.doesNotReject(assertWhiteboardRuntimeNotices(metafile));
  await assert.rejects(
    assertWhiteboardRuntimeNotices(metafile, {
      noticesText: "| `react` | 18.3.1 | MIT | fixture |"
    }),
    /notices are incomplete/
  );
});

test("production policy is an explicit static allowlist with source and secret exclusions", () => {
  assert.equal(policy.outputDirectory, "dist");
  assert.equal(policy.excludeHiddenTreeEntries, true);
  assert.ok(policy.rootFiles.includes("index.html"));
  assert.ok(!policy.rootFiles.includes("wrangler.jsonc"));
  const assets = policy.copyTrees.find((rule) => rule.source === "assets");
  const games = policy.copyTrees.find((rule) => rule.source === "games");
  const toolContent = policy.copyTrees.find((rule) => rule.source === "tools/japanese-subtext/content");
  assert.ok(assets.excludeFiles.includes("transfer/quick-transfer-icons-source.png"));
  assert.ok(assets.excludeFiles.includes("images/homepage-day.png"));
  assert.ok(games.excludeFiles.includes("a-dark-room/source/yarn.lock"));
  assert.ok(games.excludeFiles.includes("kittens-game/source/yarn.lock"));
  assert.ok(games.excludePrefixes.includes("a-dark-room/source/tools/"));
  assert.ok(games.excludePrefixes.includes("kittens-game/source/tools/"));
  assert.deepEqual(games.excludeExtensions, [".po", ".pot"]);
  assert.ok(toolContent.excludeFiles.includes("blueprint.json"));
  assert.ok(policy.standaloneFiles.includes("tools/whiteboard/index.html"));
  assert.ok(policy.standaloneFiles.includes("tools/whiteboard/THIRD_PARTY_NOTICES.md"));
  assert.ok(policy.htmlEntrypoints.includes("tools/whiteboard/index.html"));
  assert.throws(() => validateOutputPath(".dev.vars", policy), /Forbidden .*deploy/);
  assert.throws(() => validateOutputPath("docs/private.html", policy), /Forbidden deploy segment/);
  assert.throws(() => validateOutputPath("assets/key.pem", policy), /Forbidden deploy extension/);
  assert.equal(validateOutputPath("tools/japanese-subtext/audio/manifest.json", policy), "tools/japanese-subtext/audio/manifest.json");
});

test("cache classes separate immutable hashes, HTML, JSON and protected admin", () => {
  assert.equal(classifyCache("_assets/main.ABC123.js"), "immutable");
  assert.equal(classifyCache("index.html"), "no-cache");
  assert.equal(classifyCache("games/catalog.json"), "short");
  assert.equal(classifyCache("games/2048/source/game.js"), "short");
  assert.equal(classifyCache("assets/images/icon.png"), "day");
  assert.equal(classifyCache("admin/index.html"), "no-store");
});

test("HTML rewriting resolves relative entry URLs without touching canonical or external links", () => {
  const replacements = new Map([
    ["/games/game-shell.css", "/_assets/game-shell.123456789abc.css"],
    ["/games/game-shell.js", "/_assets/game-shell.123456789abc.js"]
  ]);
  const html = '<link rel="canonical" href="https://lusu575.com/games/2048/"><link rel="stylesheet" href="../game-shell.css"><script src="../game-shell.js?v=old"></script>';
  const rewritten = rewriteHtmlAssetUrls(html, "games/2048/index.html", replacements);
  assert.match(rewritten, /href="\/_assets\/game-shell\.123456789abc\.css"/);
  assert.match(rewritten, /src="\/_assets\/game-shell\.123456789abc\.js"/);
  assert.match(rewritten, /href="https:\/\/lusu575\.com\/games\/2048\/"/);
});

test("moving first-party CSS to the hashed root keeps current asset URLs stable", () => {
  assert.doesNotThrow(() => assertCssUrlsStayStable('a{background:url("../assets/images/a.png?v=1")}', "css/style.css", "_assets/site.hash.css"));
  assert.doesNotThrow(() => assertCssUrlsStayStable('a{background:url("../../assets/images/a.png")}', "css/routes/chatroom.css", "_assets/route-chatroom.hash.css"));
  assert.throws(() => assertCssUrlsStayStable('a{background:url("./local.png")}', "tools/demo/style.css", "_assets/demo.hash.css"), /changes CSS URL/);
});

test("Japanese production paths preserve a versioned audio manifest query", () => {
  const source = [
    'const manifestUrl = new URL("../audio/manifest.json?v=cache-r1", import.meta.url);',
    'const defaultAudioBaseUrl = new URL("../audio/", import.meta.url);'
  ].join("\n");
  const rewritten = rewriteJapaneseToolModulePaths(
    source,
    "tools/japanese-subtext/lib/audio-player.mjs"
  );
  assert.match(
    rewritten,
    /new URL\("\/tools\/japanese-subtext\/audio\/manifest\.json\?v=cache-r1", location\.origin\)/
  );
  assert.match(
    rewritten,
    /new URL\("\/tools\/japanese-subtext\/audio\/", location\.origin\)/
  );
  assert.doesNotMatch(rewritten, /import\.meta\.url/);
});

test("Japanese production path rewriting remains exactly-once and supports an unversioned manifest", () => {
  const unversioned = rewriteJapaneseToolModulePaths(
    [
      "const manifestUrl = new URL('../audio/manifest.json', import.meta.url);",
      "const defaultAudioBaseUrl = new URL('../audio/', import.meta.url);"
    ].join("\n"),
    "audio-player.mjs"
  );
  assert.match(unversioned, /audio\/manifest\.json", location\.origin/);
  assert.doesNotMatch(unversioned, /manifest\.json\?/);

  assert.throws(
    () => rewriteJapaneseToolModulePaths(
      [
        'const first = new URL("../audio/manifest.json?v=one", import.meta.url);',
        'const second = new URL("../audio/manifest.json?v=two", import.meta.url);',
        'const root = new URL("../audio/", import.meta.url);'
      ].join("\n"),
      "audio-player.mjs"
    ),
    /Expected exactly one tool audio manifest replacement/
  );

  const content = rewriteJapaneseToolModulePaths(
    'const contentRoot = new URL("../content/", import.meta.url);',
    "tools/japanese-subtext/lib/content-loader.mjs"
  );
  assert.match(content, /new URL\("\/tools\/japanese-subtext\/content\/", location\.origin\)/);
});

test("atomic promotion restores the previous artifact if promotion fails", async () => {
  const boundary = await mkdtemp(path.join(os.tmpdir(), "lusu-production-atomic-"));
  const output = path.join(boundary, "dist");
  const failedCandidate = path.join(boundary, "candidate-failed");
  const goodCandidate = path.join(boundary, "candidate-good");
  try {
    await mkdir(output);
    await writeFile(path.join(output, "marker.txt"), "old", "utf8");
    await mkdir(failedCandidate);
    await writeFile(path.join(failedCandidate, "marker.txt"), "failed", "utf8");
    await assert.rejects(
      replaceDirectoryAtomically(failedCandidate, output, {
        boundary,
        beforePromote: () => { throw new Error("injected failure"); }
      }),
      /injected failure/
    );
    assert.equal(await readFile(path.join(output, "marker.txt"), "utf8"), "old");

    await mkdir(goodCandidate);
    await writeFile(path.join(goodCandidate, "marker.txt"), "new", "utf8");
    await replaceDirectoryAtomically(goodCandidate, output, { boundary });
    assert.equal(await readFile(path.join(output, "marker.txt"), "utf8"), "new");
  } finally {
    await rm(boundary, { recursive: true, force: true });
  }
});

test("manifest verification rejects every unlisted payload", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lusu-production-inventory-"));
  const content = Buffer.from("a");
  const manifest = {
    entries: { fixture: "/a.txt" },
    files: [{
      path: "/a.txt",
      bytes: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
      cache: "day",
      source: "fixture/a.txt"
    }]
  };
  try {
    await writeFile(path.join(directory, "a.txt"), content);
    await writeFile(path.join(directory, "asset-manifest.json"), "{}", "utf8");
    await verifyManifestInventory(directory, manifest);
    await writeFile(path.join(directory, "unlisted.txt"), "unexpected", "utf8");
    await assert.rejects(verifyManifestInventory(directory, manifest), /outside asset-manifest/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("package and headers expose the production and cache contracts", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const packageLock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
  const wrangler = JSON.parse(await readFile(path.join(root, "wrangler.jsonc"), "utf8"));
  const whiteboardWrangler = JSON.parse(await readFile(path.join(root, "workers", "whiteboard", "wrangler.jsonc"), "utf8"));
  const headers = await readFile(path.join(root, "_headers"), "utf8");
  const buildCheck = await readFile(path.join(root, "scripts", "build-check.mjs"), "utf8");
  const gitignore = await readFile(path.join(root, ".gitignore"), "utf8");
  assert.equal(packageJson.devDependencies.esbuild, "0.28.1");
  assert.equal(packageJson.scripts.build, "node scripts/build-check.mjs && node scripts/build-production.mjs");
  assert.equal(packageJson.scripts["build:production"], "node scripts/build-production.mjs");
  assert.equal(packageJson.scripts["build:production:verify"], "node scripts/build-production.mjs --verify-reproducible");
  assert.match(buildCheck, /"\.codex-worktrees"/);
  assert.match(gitignore, /^\.codex-worktrees\/$/m);
  assert.equal(wrangler.pages_build_output_dir, policy.outputDirectory);
  assert.deepEqual(wrangler.env.preview.d1_databases, []);
  assert.deepEqual(wrangler.env.preview.r2_buckets, []);
  assert.equal(wrangler.env.preview.vars.PREVIEW_API_DISABLED, "true");
  assert.equal(
    wrangler.env.preview.durable_objects.bindings.find(({ name }) => name === "WHITEBOARD_ROOMS")?.script_name,
    "lusu-whiteboard-do-preview"
  );
  assert.equal(
    whiteboardWrangler.vars.ALLOWED_ORIGINS,
    "https://lusu575.com,https://www.lusu575.com"
  );
  assert.doesNotMatch(whiteboardWrangler.vars.ALLOWED_ORIGINS, /localhost|127\.0\.0\.1/i);
  assert.equal(packageJson.scripts.typecheck, "tsc -p workers/whiteboard/tsconfig.json --noEmit");
  assert.match(packageJson.scripts["whiteboard:test"], /workers\/whiteboard\/vitest\.config\.mts/);
  assert.equal(packageJson.dependencies["@excalidraw/excalidraw"], "0.18.1");
  assert.equal(packageJson.overrides["@excalidraw/excalidraw"].nanoid, "3.3.16");
  assert.equal(packageJson.overrides["@excalidraw/mermaid-to-excalidraw"].nanoid, "5.0.9");
  assert.equal(packageJson.overrides["lodash-es"], "4.18.1");
  assert.equal(packageLock.packages[""].dependencies["@excalidraw/excalidraw"], "0.18.1");
  assert.equal(packageLock.packages["node_modules/@excalidraw/excalidraw"].version, "0.18.1");
  assert.equal(packageLock.packages["node_modules/nanoid"].version, "3.3.16");
  assert.equal(packageLock.packages["node_modules/@excalidraw/mermaid-to-excalidraw/node_modules/nanoid"].version, "5.0.9");
  assert.equal(packageLock.packages["node_modules/lodash-es"].version, "4.18.1");
  assert.equal(packageJson.dependencies.yjs, "13.6.27");
  assert.match(headers, /\/_assets\/\*[\s\S]*max-age=31536000, immutable/);
  assert.doesNotMatch(headers, /^\/\*\r?\n\s+Cache-Control:/m);
  assert.match(headers, /\/index\.html[\s\S]*no-cache, max-age=0, must-revalidate/);
  assert.match(headers, /\/\*\.json[\s\S]*max-age=300, must-revalidate/);
  assert.match(headers, /\/admin\/\*[\s\S]*Cache-Control: no-store/);
});
