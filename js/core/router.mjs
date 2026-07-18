function decodeHashValue(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

export function createRouter({ routes, location = window.location } = {}) {
  const routeIds = Object.freeze([...(routes || [])]);

  function parseRouteHash(hash = location.hash) {
    const raw = decodeHashValue(String(hash || "").replace(/^#/, "")).replace(/^\/+/, "");
    if (!raw) return { route: "home", articleSlug: "" };
    const articleMatch = raw.match(/^knowledge\/(?:article\/)?([a-z0-9][a-z0-9-]{0,119})$/);
    if (articleMatch) return { route: "knowledge", articleSlug: articleMatch[1] };
    return { route: routeIds.includes(raw) ? raw : "home", articleSlug: "" };
  }

  function parseRouteLocation(value = location) {
    const articleMatch = value.pathname.match(/^\/articles\/([a-z0-9][a-z0-9-]{0,119})\/?$/);
    if (articleMatch) return { route: "knowledge", articleSlug: articleMatch[1] };
    return parseRouteHash(value.hash);
  }

  function articleRoutePath(slug) {
    return `/articles/${encodeURIComponent(slug)}`;
  }

  function routeUrl(route, articleSlug = "") {
    if (route === "knowledge" && articleSlug) return articleRoutePath(articleSlug);
    return route === "home" ? "/" : `/#${route}`;
  }

  function withLanguageQuery(path, lang) {
    const nextUrl = new URL(path, location.origin);
    const params = new URLSearchParams(location.search);
    params.set("lang", lang);
    nextUrl.search = params.toString();
    return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  }

  return Object.freeze({ parseRouteHash, parseRouteLocation, articleRoutePath, routeUrl, withLanguageQuery });
}
