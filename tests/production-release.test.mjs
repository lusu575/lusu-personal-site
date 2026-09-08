import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { selectBuildRevision } from "../scripts/build-production.mjs";
import {
  createBudgetedFetch,
  normalizeCommit,
  runProductionSmoke,
  validateReleaseManifest,
  waitForProductionRelease
} from "../scripts/production-smoke.mjs";

const expectedCommit = "a".repeat(40);
const olderCommit = "b".repeat(40);
const origin = "https://lusu575.com";
const assetPath = "/_assets/site.abc123.css";
const scriptPath = "/_assets/main.def456.js";
const assetBytes = "body{color:black}";
const inventory = (path, content) => ({ path, bytes: Buffer.byteLength(content), sha256: createHash("sha256").update(content).digest("hex") });
const manifest = {
  schemaVersion: 1,
  target: "cloudflare-pages-static",
  release: { commit: expectedCommit, dirty: false },
  entries: { site: { css: [assetPath], scripts: [scriptPath] } },
  files: [inventory(assetPath, assetBytes), inventory(scriptPath, "export{};")]
};
const homeHtml = `<link rel="canonical" href="${origin}/?lang=zh"><link rel="stylesheet" href="${assetPath}"><script type="module" src="${scriptPath}"></script>`;
const alternateLinks = ["zh", "en", "ja", "x-default"].map((lang) => `<link hreflang="${lang}">`).join("");
const sitemap = `<urlset xmlns:xhtml="http://www.w3.org/1999/xhtml"><url><loc>${origin}/articles/release-check?lang=zh</loc><lastmod>2026-09-08</lastmod>${alternateLinks}</url></urlset>`;
const article = `<link rel="canonical" href="${origin}/articles/release-check?lang=zh">${alternateLinks}<script type="application/ld+json">{"@type":"Article","author":{"@type":"Person"},"publisher":{"@type":"Organization"}}</script>`;
const jsonResponse = (payload) => new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });

function createFixtureFetch(overrides = {}) {
  const paths = [];
  const fetchImpl = async (url) => {
    const pathname = new URL(url).pathname;
    paths.push(pathname);
    if (overrides[pathname]) return overrides[pathname]();
    if (pathname === "/asset-manifest.json") return jsonResponse(manifest);
    if (pathname === "/api/health") return jsonResponse({ ok: true, db: true });
    if (pathname === "/") return new Response(homeHtml, { headers: { "content-type": "text/html" } });
    if (pathname === "/sitemap.xml") return new Response(sitemap, { headers: { "content-type": "application/xml" } });
    if (pathname === "/articles/release-check") return new Response(article);
    if (pathname === assetPath) return new Response(assetBytes, { headers: { "cache-control": "public, max-age=31536000, immutable" } });
    throw new Error(`Unexpected fixture request: ${pathname}`);
  };
  return { paths, fetchImpl };
}

test("build revision binds environment SHA to the actual checkout without a build timestamp", () => {
  const options = { gitHead: expectedCommit, env: { CF_PAGES_COMMIT_SHA: expectedCommit } };
  assert.deepEqual(selectBuildRevision(options), { commit: expectedCommit, dirty: false });
  assert.deepEqual(selectBuildRevision(options), selectBuildRevision(options));
  assert.equal(selectBuildRevision({ ...options, dirty: true }).dirty, true);
  assert.throws(() => selectBuildRevision({ ...options, gitHead: olderCommit }), /does not match/);
  assert.throws(() => selectBuildRevision({ ...options, gitHead: "abc123" }), /complete/);
  assert.throws(() => normalizeCommit(""), /complete/);
});

test("release verification rejects stale releases and dirty working trees", () => {
  assert.equal(validateReleaseManifest(manifest, expectedCommit), manifest);
  assert.throws(() => validateReleaseManifest(manifest, olderCommit), /release mismatch/);
  assert.throws(() => validateReleaseManifest({ ...manifest, release: { commit: expectedCommit, dirty: true } }, expectedCommit), /uncommitted/);
  assert.throws(() => validateReleaseManifest({ ...manifest, files: [] }, expectedCommit), /digest/);
});

test("deployment waiting only polls the marker until the expected release is available", async () => {
  const requestedPaths = [];
  const waits = [];
  const result = await waitForProductionRelease({
    origin, expectedCommit, attempts: 3, retryMs: 5,
    fetchImpl: async (url) => {
      requestedPaths.push(new URL(url).pathname);
      return jsonResponse(requestedPaths.length < 3 ? { ...manifest, release: { commit: olderCommit, dirty: false } } : manifest);
    },
    sleep: async (ms) => { waits.push(ms); }
  });
  assert.deepEqual(result, manifest);
  assert.deepEqual(requestedPaths, Array(3).fill("/asset-manifest.json"));
  assert.deepEqual(waits, [5, 5]);
  await assert.rejects(waitForProductionRelease({
    origin, expectedCommit, attempts: 2, retryMs: 0,
    fetchImpl: async () => jsonResponse({ ...manifest, release: { commit: olderCommit, dirty: false } })
  }), /release mismatch/);
});

test("production verification checks the exact release, served HTML references and asset bytes", async () => {
  const { paths, fetchImpl } = createFixtureFetch();
  const result = await runProductionSmoke({ origin, expectedCommit, fetchImpl });
  assert.equal(result.commit, expectedCommit);
  assert.equal(result.ok, true);
  assert.ok(result.checks.includes("asset-digest"));
  assert.equal(paths[0], "/asset-manifest.json");
  assert.equal(paths.at(-1), "/asset-manifest.json");
  assert.equal(paths.length, 7);
});

test("a healthy old homepage, corrupt immutable asset or changed rollout cannot pass", async () => {
  const staleHome = createFixtureFetch({ "/": () => new Response(homeHtml.replace(scriptPath, "/_assets/main.old.js"), { headers: { "content-type": "text/html" } }) });
  await assert.rejects(runProductionSmoke({ origin, expectedCommit, fetchImpl: staleHome.fetchImpl }), /expected release assets/);
  const corruptAsset = createFixtureFetch({ [assetPath]: () => new Response("wrong", { headers: { "cache-control": "max-age=31536000, immutable" } }) });
  await assert.rejects(runProductionSmoke({ origin, expectedCommit, fetchImpl: corruptAsset.fetchImpl }), /asset bytes/);
  let markers = 0;
  const changingRelease = createFixtureFetch({ "/asset-manifest.json": () => jsonResponse(++markers === 1 ? manifest : { ...manifest, release: { commit: olderCommit, dirty: false } }) });
  await assert.rejects(runProductionSmoke({ origin, expectedCommit, fetchImpl: changingRelease.fetchImpl }), /release mismatch/);
});

test("production requests have a hard shared budget across deployment waiting and runtime retries", async () => {
  let requests = 0;
  const fetchImpl = createBudgetedFetch(async () => { requests += 1; return jsonResponse(manifest); }, 2);
  await fetchImpl(origin);
  await fetchImpl(origin);
  assert.throws(() => fetchImpl(origin), /request budget/);
  assert.equal(requests, 2);
});
