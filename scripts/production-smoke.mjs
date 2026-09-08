import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const DEFAULT_SITE_ORIGIN = "https://lusu575.com";
export const MAX_SMOKE_REQUESTS = 40;

export function normalizeCommit(value) {
  const commit = String(value || "").trim().toLowerCase();
  invariant(/^[a-f0-9]{40}$/.test(commit), "release verification requires the complete expected 40-character Git commit SHA");
  return commit;
}

export function validateReleaseManifest(manifest, expectedCommit) {
  const commit = normalizeCommit(expectedCommit);
  invariant(manifest?.release?.commit === commit, `production release mismatch: expected ${commit}, received ${manifest?.release?.commit || "no release marker"}`);
  invariant(manifest.release.dirty === false, "production release was built from uncommitted source changes");
  invariant(manifest.schemaVersion === 1 && manifest.target === "cloudflare-pages-static", "production release manifest has an unsupported format");
  const site = manifest.entries?.site;
  invariant(Array.isArray(site?.css) && site.css.length > 0 && Array.isArray(site?.scripts) && site.scripts.length > 0, "production release manifest is missing site assets");
  invariant(Array.isArray(manifest.files), "production release manifest is missing its inventory");
  for (const assetPath of [...site.css, ...site.scripts]) {
    invariant(/^\/_assets\/[a-z0-9._/-]+$/i.test(assetPath) && !assetPath.includes(".."), "production release contains an invalid site asset path");
    const file = manifest.files.find((entry) => entry.path === assetPath);
    invariant(file && /^[a-f0-9]{64}$/.test(file.sha256) && Number.isSafeInteger(file.bytes) && file.bytes > 0, "production release contains an invalid site asset digest");
  }
  return manifest;
}

export function createBudgetedFetch(fetchImpl = fetch, maxRequests = MAX_SMOKE_REQUESTS) {
  let requests = 0;
  const budgetedFetch = (...args) => {
    invariant(requests < maxRequests, `production smoke exceeded its ${maxRequests}-request budget`);
    requests += 1;
    return fetchImpl(...args);
  };
  return budgetedFetch;
}

async function readReleaseManifest({ origin, expectedCommit, timeoutMs, fetchImpl, attempt = 0 }) {
  const url = new URL("/asset-manifest.json", origin);
  url.searchParams.set("release", expectedCommit);
  url.searchParams.set("attempt", String(attempt));
  const response = await fetchWithTimeout(url, {
    timeoutMs,
    fetchImpl,
    headers: { Accept: "application/json", "Cache-Control": "no-cache" }
  });
  invariant(String(response.headers.get("content-type") || "").includes("application/json"), "production release manifest returned a non-JSON content type");
  return validateReleaseManifest(await response.json(), expectedCommit);
}

export async function waitForProductionRelease({
  origin = DEFAULT_SITE_ORIGIN,
  expectedCommit,
  timeoutMs = 10000,
  attempts = 16,
  retryMs = 20000,
  fetchImpl = fetch,
  sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
  onPending = () => {}
}) {
  const canonicalOrigin = normalizeSiteOrigin(origin);
  const commit = normalizeCommit(expectedCommit);
  const limit = Math.max(1, Math.min(20, attempts));
  let lastError;
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    try {
      return await readReleaseManifest({ origin: canonicalOrigin, expectedCommit: commit, timeoutMs, fetchImpl, attempt });
    } catch (error) {
      lastError = error;
      onPending(error, attempt, limit);
      if (attempt < limit && retryMs > 0) await sleep(Math.min(60000, retryMs));
    }
  }
  throw lastError;
}

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function normalizeSiteOrigin(value = DEFAULT_SITE_ORIGIN) {
  const url = new URL(String(value || DEFAULT_SITE_ORIGIN));
  invariant(url.protocol === "https:", "production smoke origin must use HTTPS");
  invariant(!url.username && !url.password, "production smoke origin must not contain credentials");
  invariant(!url.search && !url.hash, "production smoke origin must not contain a query or fragment");
  url.pathname = "/";
  return url.origin;
}

export function validateHealth(payload) {
  invariant(payload && payload.ok === true && payload.db === true, "health endpoint did not confirm API and D1 availability");
}

export function validateSitemap(xml, origin = DEFAULT_SITE_ORIGIN) {
  const source = String(xml || "");
  const canonicalOrigin = normalizeSiteOrigin(origin);
  invariant(source.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'), "sitemap is missing the XHTML namespace");
  for (const lang of ["zh", "en", "ja", "x-default"]) {
    invariant(source.includes(`hreflang="${lang}"`), `sitemap is missing hreflang=${lang}`);
  }
  const locations = [...source.matchAll(/<loc>(https:\/\/[^<]+)<\/loc>/g)].map((match) => match[1]);
  invariant(locations.length > 0, "sitemap does not contain any canonical locations");
  invariant(
    locations.every((location) => location.startsWith(`${canonicalOrigin}/`)),
    "sitemap contains a location outside the canonical origin"
  );
  invariant(!source.includes("example.test"), "sitemap leaked a request-host URL");
  invariant(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(source), "sitemap is missing a stable lastmod date");
}

export function extractArticleSlugFromSitemap(xml) {
  const match = String(xml || "").match(/<loc>https:\/\/[^/]+\/articles\/([a-z0-9][a-z0-9-]{0,119})\?lang=zh<\/loc>/i);
  invariant(match, "sitemap does not expose a Chinese article URL for smoke testing");
  return match[1].toLowerCase();
}

export function validateHomeHtml(html, origin = DEFAULT_SITE_ORIGIN) {
  const source = String(html || "");
  const canonicalOrigin = normalizeSiteOrigin(origin);
  invariant(source.includes(`<link rel="canonical" href="${canonicalOrigin}/?lang=zh">`), "home canonical URL is missing or incorrect");
  invariant(source.includes('<script type="module"'), "home module entry is missing");
}

export function validateArticleHtml(html, slug, origin = DEFAULT_SITE_ORIGIN) {
  const source = String(html || "");
  const canonicalOrigin = normalizeSiteOrigin(origin);
  const articleBase = `${canonicalOrigin}/articles/${slug}`;
  invariant(source.includes(`<link rel="canonical" href="${articleBase}?lang=zh">`), "article canonical URL is missing or incorrect");
  for (const lang of ["zh", "en", "ja", "x-default"]) {
    invariant(source.includes(`hreflang="${lang}"`), `article HTML is missing hreflang=${lang}`);
  }
  invariant(source.includes('"@type":"Article"'), "article structured data is missing");
  invariant(source.includes('"author":{"@type":"Person"'), "article structured data is missing its author entity");
  invariant(source.includes('"publisher":{"@type":"Organization"'), "article structured data is missing its publisher entity");
}

export function extractHashedAssetPath(html) {
  const match = String(html || "").match(/(?:href|src)="(\/_assets\/[a-z0-9._/-]+)"/i);
  invariant(match, "home HTML does not reference a hashed production asset");
  return match[1];
}

async function fetchWithTimeout(url, { timeoutMs = 10000, fetchImpl = fetch, ...options } = {}) {
  const response = await fetchImpl(url, {
    redirect: "follow",
    ...options,
    headers: {
      Accept: "*/*",
      "User-Agent": "lusu-production-smoke/1.0",
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  invariant(response.ok, `${new URL(url).pathname} returned HTTP ${response.status}`);
  return response;
}

export async function runProductionSmoke({
  origin = DEFAULT_SITE_ORIGIN,
  timeoutMs = 10000,
  requireWwwRedirect = false,
  expectedCommit,
  releaseManifest,
  fetchImpl = fetch
} = {}) {
  const canonicalOrigin = normalizeSiteOrigin(origin);
  const commit = normalizeCommit(expectedCommit);
  const manifest = releaseManifest
    ? validateReleaseManifest(releaseManifest, commit)
    : await readReleaseManifest({ origin: canonicalOrigin, expectedCommit: commit, timeoutMs, fetchImpl });
  const healthResponse = await fetchWithTimeout(`${canonicalOrigin}/api/health`, {
    timeoutMs,
    fetchImpl,
    headers: { Accept: "application/json" }
  });
  validateHealth(await healthResponse.json());

  const homeResponse = await fetchWithTimeout(`${canonicalOrigin}/?lang=zh`, {
    timeoutMs,
    fetchImpl,
    headers: { Accept: "text/html" }
  });
  invariant(String(homeResponse.headers.get("content-type") || "").includes("text/html"), "home returned a non-HTML content type");
  const homeHtml = await homeResponse.text();
  validateHomeHtml(homeHtml, canonicalOrigin);
  for (const assetPath of [...manifest.entries.site.css, ...manifest.entries.site.scripts]) {
    invariant(homeHtml.includes(`="${assetPath}"`), "home HTML does not reference the expected release assets");
  }

  const sitemapResponse = await fetchWithTimeout(`${canonicalOrigin}/sitemap.xml`, {
    timeoutMs,
    fetchImpl,
    headers: { Accept: "application/xml,text/xml" }
  });
  invariant(String(sitemapResponse.headers.get("content-type") || "").includes("xml"), "sitemap returned a non-XML content type");
  const sitemapXml = await sitemapResponse.text();
  validateSitemap(sitemapXml, canonicalOrigin);

  const articleSlug = extractArticleSlugFromSitemap(sitemapXml);
  const articleResponse = await fetchWithTimeout(`${canonicalOrigin}/articles/${articleSlug}?lang=zh`, {
    timeoutMs,
    fetchImpl,
    headers: { Accept: "text/html" }
  });
  const articleHtml = await articleResponse.text();
  validateArticleHtml(articleHtml, articleSlug, canonicalOrigin);

  const assetPath = extractHashedAssetPath(homeHtml);
  const assetResponse = await fetchWithTimeout(`${canonicalOrigin}${assetPath}`, { timeoutMs, fetchImpl });
  invariant(
    /max-age=31536000/i.test(String(assetResponse.headers.get("cache-control") || ""))
      && /immutable/i.test(String(assetResponse.headers.get("cache-control") || "")),
    "hashed production asset is missing immutable caching"
  );
  const assetBytes = Buffer.from(await assetResponse.arrayBuffer());
  const assetRecord = manifest.files.find((file) => file.path === assetPath);
  invariant(assetRecord && assetBytes.byteLength === assetRecord.bytes
    && createHash("sha256").update(assetBytes).digest("hex") === assetRecord.sha256,
  "production asset bytes do not match the expected release manifest");

  if (requireWwwRedirect) {
    const wwwUrl = new URL(`/monitoring-check?source=production-smoke`, canonicalOrigin);
    wwwUrl.hostname = `www.${wwwUrl.hostname.replace(/^www\./, "")}`;
    const redirectResponse = await fetchImpl(wwwUrl, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
    invariant([301, 308].includes(redirectResponse.status), "www host is not using a permanent redirect");
    invariant(
      redirectResponse.headers.get("location") === `${canonicalOrigin}/monitoring-check?source=production-smoke`,
      "www redirect does not preserve the path and query on the canonical host"
    );
  }

  // Confirm the release did not change while its runtime and cached assets were checked.
  await readReleaseManifest({ origin: canonicalOrigin, expectedCommit: commit, timeoutMs, fetchImpl, attempt: "verified" });

  return {
    ok: true,
    origin: canonicalOrigin,
    articleSlug,
    assetPath,
    commit,
    checks: ["expected-release", "health", "home", "sitemap", "article", "immutable-asset", "asset-digest"],
    wwwRedirect: requireWwwRedirect ? "verified" : "not-required"
  };
}

async function main() {
  const attempts = Math.max(1, Math.min(8, Number.parseInt(process.env.SMOKE_ATTEMPTS || "5", 10) || 5));
  const retryMs = Math.max(0, Math.min(60000, Number.parseInt(process.env.SMOKE_RETRY_MS || "15000", 10) || 15000));
  const origin = process.env.SITE_ORIGIN || DEFAULT_SITE_ORIGIN;
  const expectedCommit = normalizeCommit(process.env.EXPECTED_COMMIT_SHA
    || execFileSync("git", ["rev-parse", "--verify", "HEAD"], { encoding: "utf8" }).trim());
  const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "10000", 10) || 10000;
  const fetchImpl = createBudgetedFetch();
  const releaseManifest = await waitForProductionRelease({
    origin,
    expectedCommit,
    timeoutMs,
    fetchImpl,
    attempts: Number.parseInt(process.env.RELEASE_ATTEMPTS || "16", 10) || 16,
    retryMs: Number.parseInt(process.env.RELEASE_RETRY_MS || "20000", 10) || 20000,
    onPending: (error, attempt, limit) => console.error(`production release ${attempt}/${limit}: ${error.message}`)
  });
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await runProductionSmoke({
        origin,
        timeoutMs,
        expectedCommit,
        releaseManifest,
        fetchImpl,
        requireWwwRedirect: process.env.REQUIRE_WWW_REDIRECT === "1"
      });
      console.log(JSON.stringify({ ...result, attempt }));
      return;
    } catch (error) {
      lastError = error;
      console.error(`production-smoke attempt ${attempt}/${attempts}: ${error instanceof Error ? error.message : String(error)}`);
      if (attempt < attempts && retryMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryMs));
      }
    }
  }
  throw lastError || new Error("production smoke failed");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  });
}
