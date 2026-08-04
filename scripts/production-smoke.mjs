import { pathToFileURL } from "node:url";

export const DEFAULT_SITE_ORIGIN = "https://lusu575.com";

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

async function fetchWithTimeout(url, { timeoutMs = 10000, ...options } = {}) {
  const response = await fetch(url, {
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
  requireWwwRedirect = false
} = {}) {
  const canonicalOrigin = normalizeSiteOrigin(origin);
  const healthResponse = await fetchWithTimeout(`${canonicalOrigin}/api/health`, {
    timeoutMs,
    headers: { Accept: "application/json" }
  });
  validateHealth(await healthResponse.json());

  const homeResponse = await fetchWithTimeout(`${canonicalOrigin}/?lang=zh`, {
    timeoutMs,
    headers: { Accept: "text/html" }
  });
  invariant(String(homeResponse.headers.get("content-type") || "").includes("text/html"), "home returned a non-HTML content type");
  const homeHtml = await homeResponse.text();
  validateHomeHtml(homeHtml, canonicalOrigin);

  const sitemapResponse = await fetchWithTimeout(`${canonicalOrigin}/sitemap.xml`, {
    timeoutMs,
    headers: { Accept: "application/xml,text/xml" }
  });
  invariant(String(sitemapResponse.headers.get("content-type") || "").includes("xml"), "sitemap returned a non-XML content type");
  const sitemapXml = await sitemapResponse.text();
  validateSitemap(sitemapXml, canonicalOrigin);

  const articleSlug = extractArticleSlugFromSitemap(sitemapXml);
  const articleResponse = await fetchWithTimeout(`${canonicalOrigin}/articles/${articleSlug}?lang=zh`, {
    timeoutMs,
    headers: { Accept: "text/html" }
  });
  const articleHtml = await articleResponse.text();
  validateArticleHtml(articleHtml, articleSlug, canonicalOrigin);

  const assetPath = extractHashedAssetPath(homeHtml);
  const assetResponse = await fetchWithTimeout(`${canonicalOrigin}${assetPath}`, { timeoutMs });
  invariant(
    /max-age=31536000/i.test(String(assetResponse.headers.get("cache-control") || ""))
      && /immutable/i.test(String(assetResponse.headers.get("cache-control") || "")),
    "hashed production asset is missing immutable caching"
  );
  await assetResponse.arrayBuffer();

  if (requireWwwRedirect) {
    const wwwUrl = new URL(`/monitoring-check?source=production-smoke`, canonicalOrigin);
    wwwUrl.hostname = `www.${wwwUrl.hostname.replace(/^www\./, "")}`;
    const redirectResponse = await fetch(wwwUrl, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
    invariant([301, 308].includes(redirectResponse.status), "www host is not using a permanent redirect");
    invariant(
      redirectResponse.headers.get("location") === `${canonicalOrigin}/monitoring-check?source=production-smoke`,
      "www redirect does not preserve the path and query on the canonical host"
    );
  }

  return {
    ok: true,
    origin: canonicalOrigin,
    articleSlug,
    assetPath,
    checks: ["health", "home", "sitemap", "article", "immutable-asset"],
    wwwRedirect: requireWwwRedirect ? "verified" : "not-required"
  };
}

async function main() {
  const attempts = Math.max(1, Math.min(8, Number.parseInt(process.env.SMOKE_ATTEMPTS || "5", 10) || 5));
  const retryMs = Math.max(0, Math.min(60000, Number.parseInt(process.env.SMOKE_RETRY_MS || "15000", 10) || 15000));
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await runProductionSmoke({
        origin: process.env.SITE_ORIGIN || DEFAULT_SITE_ORIGIN,
        timeoutMs: Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "10000", 10) || 10000,
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
