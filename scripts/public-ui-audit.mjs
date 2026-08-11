#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutput = resolve(root, "output", "public-ui-audit");
const fixedTheme = "day";
const timeoutMs = 20_000;
const timeThemes = Object.freeze(["morning", "day", "dusk", "night"]);
const themeBootstrapScenarios = Object.freeze([
  { name: "local-morning", theme: "morning", now: "2026-07-18T00:00:00.000Z" },
  { name: "local-day", theme: "day", now: "2026-07-18T05:00:00.000Z" },
  { name: "local-dusk", theme: "dusk", now: "2026-07-18T10:00:00.000Z" },
  { name: "local-night", theme: "night", now: "2026-07-18T18:00:00.000Z" },
  { name: "preview-override", theme: "night", now: "2026-07-18T05:00:00.000Z", preview: "night" }
]);
const auditRoutes = Object.freeze(["home", "knowledge", "videos", "resources", "games", "chatroom", "about"]);
const semanticLanguages = Object.freeze({
  zh: { htmlLang: "zh-CN", locale: "zh_CN", skip: "跳到主内容", headings: { home: "鲁肃的个人站", knowledge: "知识库", videos: "视频区", resources: "工具区", games: "游戏区", blog: "杂谈区", chatroom: "匿名聊天室", about: "关于我" } },
  en: { htmlLang: "en", locale: "en_US", skip: "Skip to main content", headings: { home: "LuSu Site", knowledge: "Knowledge", videos: "Videos", resources: "Tools", games: "Games", blog: "Talk", chatroom: "Chat Room", about: "About" } },
  ja: { htmlLang: "ja", locale: "ja_JP", skip: "本文へスキップ", headings: { home: "魯粛サイト", knowledge: "知識庫", videos: "動画", resources: "ツール", games: "ゲーム", blog: "雑談", chatroom: "匿名チャット", about: "プロフィール" } }
});
const resourceDisplayLabels = Object.freeze({
  zh: Object.freeze({ title: "工具区", dock: "工具", transferBack: "返回工具区", transferLoginBack: "返回工具列表", cards: Object.freeze(["在线画板", "临时互传", "日语的言外之意"]) }),
  en: Object.freeze({ title: "Tools", dock: "Tools", transferBack: "Back to Tools", transferLoginBack: "Back to tool list", cards: Object.freeze(["Online Whiteboard", "Quick Transfer", "Behind the Japanese"]) }),
  ja: Object.freeze({ title: "ツール", dock: "ツール", transferBack: "ツールへ戻る", transferLoginBack: "ツール一覧へ戻る", cards: Object.freeze(["オンラインホワイトボード", "一時転送", "日本語の裏側"]) })
});
const resourceVisualLanguages = Object.freeze(["zh", "en", "ja"]);
const resourceVisualViewportKeys = Object.freeze(["359x500", "375x667", "390x844", "760x900", "844x390", "1280x720"]);
const resourceVisualExpectedResultCount = resourceVisualLanguages.length * resourceVisualViewportKeys.length * 3 + 4;
const viewports = Object.freeze([
  { name: "phone-short", width: 359, height: 500, mobile: true },
  { name: "phone-compact", width: 375, height: 667, mobile: true },
  { name: "phone-standard", width: 390, height: 844, mobile: true },
  { name: "phone-large", width: 430, height: 932, mobile: true },
  { name: "phone-landscape", width: 844, height: 390, mobile: true },
  { name: "desktop-compact", width: 1280, height: 720, mobile: false },
  { name: "desktop-standard", width: 1440, height: 900, mobile: false }
]);
const fixedShellScenarios = Object.freeze([
  "chat-growth-359x500",
  "chat-height-proxy-390x844-to-390x500",
  "article-scroll-owner-390x500",
  "about-scroll-owner-390x500",
  "native-pagescale-internal-focus"
]);
const mobileViewportScenarios = Object.freeze([
  "keyboard-chat-compose-390x844-to-390x500",
  "keyboard-chat-private-390x844-to-390x500",
  "keyboard-home-account-390x844-to-390x500",
  "keyboard-resources-transfer-account-390x844-to-390x500",
  "keyboard-knowledge-search-390x844-to-390x500",
  "keyboard-transfer-room-entry-390x844-to-390x500",
  "keyboard-transfer-composer-390x844-to-390x500",
  "browser-ui-height-proxy-390x844-to-390x760",
  "orientation-round-trip-390x844-to-844x390",
  "native-pagescale-layout-stability",
  "dock-state-keyboard-round-trip-expanded",
  "dock-state-keyboard-round-trip-collapsed",
  "safe-area-insets-proxy"
]);
const mobileViewportLimitations = Object.freeze({
  realSoftKeyboardTested: false,
  realSafeAreaTested: false,
  realBrowserChromeTested: false,
  viewportProxyTested: true
});
const article = Object.freeze({
  slug: "audit-layout",
  title: "公开界面审计布局文章",
  summary: "用于验证短横屏文章目录、正文、Dock 与滚动所有者的受控测试文章；这段较长摘要还会验证移动端折叠、展开、换行与可读性，并确保元信息和正文不会被固定控件遮挡。",
  cover_image: "assets/images/articles/ai-agent-codex-project-brief.png",
  category: "site-updates",
  tags: ["UI", "QA"],
  lang: "zh",
  published_at: "2026-07-18T00:00:00.000Z",
  created_at: "2026-07-18T00:00:00.000Z",
  content_markdown: [
    "# 公开界面审计布局文章",
    "",
    "## 第一节",
    "",
    "这是一段用于建立稳定文章几何的受控正文。它不会连接生产数据库，也不会修改线上内容。",
    "",
    "# 独立辅助标题",
    "",
    "该一级 Markdown 标记必须在文章正文中降为二级标题，不能创建第二个页面 H1。",
    "",
    "## 第二节",
    "",
    "短横屏应继续保留目录与正文结构，移动 Dock 不得覆盖文章窗口或主要操作。",
    "",
    "## 第二节",
    "",
    "重复标题用于验证语义锚点能够稳定去重，并在复制链接后直接返回正确章节。",
    "",
    "## 第三节",
    "",
    "审计只记录当前视口内的几何、截图和断言结果。",
    "",
    "![文章阅读器受控图片](assets/images/articles/ai-agent-codex-project-brief.png)",
    "",
    "## 这是一个用于验证目录多行标题能够自然撑高且高亮边框不会覆盖文字的超长章节标题",
    "",
    "目录中的末尾章节用于验证当前项能够在目录自己的滚动区域内保持可见。",
    "",
    "## 第五节",
    "",
    "最终章节用于建立稳定的滚动、焦点和分享锚点检查。"
  ].join("\n")
});
const articleTranslations = Object.freeze({
  zh: Object.freeze({ title: article.title, summary: article.summary, content_markdown: article.content_markdown }),
  en: Object.freeze({
    title: "Public UI Audit Layout Article",
    summary: "A controlled article for verifying responsive reading geometry, metadata, navigation, and scroll ownership.",
    content_markdown: "# Public UI Audit Layout Article\n\n## First section\n\nThis controlled article verifies deterministic responsive reading and metadata without using production data.\n\n## Second section\n\nThe article detail remains safe, scrollable, and synchronized with browser navigation."
  }),
  ja: Object.freeze({
    title: "公開 UI 監査レイアウト記事",
    summary: "レスポンシブな閲覧形状、メタデータ、ナビゲーション、スクロール所有者を確認するための制御された記事です。",
    content_markdown: "# 公開 UI 監査レイアウト記事\n\n## 第 1 節\n\n本番データを使わず、再現可能な閲覧表示とメタデータを確認する制御された記事です。\n\n## 第 2 節\n\n記事詳細は安全な描画、スクロール、ブラウザ履歴との同期を維持します。"
  })
});
const fallbackAuditArticleSlug = "audit-layout-fallback";
const auditArticles = Object.freeze([
  article,
  ...Array.from({ length: 15 }, (_, index) => ({
    ...article,
    category: "note",
    slug: `audit-layout-${index + 1}`,
    title: `状态恢复审计 ${String(index + 1).padStart(2, "0")}`,
    summary: `用于制造可滚动筛选列表并验证 Unicode 搜索、History 状态与滚动恢复的受控条目 ${index + 1}。`,
    is_pinned: index === 13 ? 1 : 0,
    published_at: `2026-07-${String(17 - Math.min(index, 14)).padStart(2, "0")}T00:00:00.000Z`,
    created_at: `2026-07-${String(17 - Math.min(index, 14)).padStart(2, "0")}T00:00:00.000Z`
  })),
  ...Array.from({ length: 14 }, (_, index) => ({
    ...article,
    slug: `audit-update-${index + 1}`,
    title: `更新记录筛选审计 ${String(index + 1).padStart(2, "0")}`,
    summary: `用于验证网站更新只出现在更新记录专属 Tab，并维持可滚动列表的受控条目 ${index + 1}。`,
    published_at: `2026-06-${String(30 - index).padStart(2, "0")}T00:00:00.000Z`,
    created_at: `2026-06-${String(30 - index).padStart(2, "0")}T00:00:00.000Z`
  }))
]);
const auditVideo = Object.freeze({
  video_id: "audit-video",
  title: "受控视频焦点审计",
  description: "不加载外网 iframe，只验证站内视频窗口的模态语义与焦点。",
  platform: "youtube",
  original_url: "https://www.youtube.com/watch?v=audit-modal-focus",
  embed_url: "",
  thumbnail_url: "",
  author_name: "Audit Fixture",
  published_at: "2026-07-18T00:00:00.000Z",
  categories: []
});
const auditPlayableVideo = Object.freeze({
  video_id: "audit-controlled-player",
  title: "Controlled iframe player",
  description: "A deterministic fixture for native iframe controls, retry, fallback, and maximized-window geometry.",
  platform: "youtube",
  original_url: "https://www.youtube.com/watch?v=audit-controlled-player",
  embed_url: "https://www.youtube.com/embed/audit-controlled-player",
  thumbnail_url: "",
  author_name: "Audit Fixture",
  published_at: "2026-07-18T00:00:00.000Z",
  categories: [{ category_id: "audit", name: "Audit" }]
});

function localizedAuditArticle(item, lang) {
  if (item.slug !== article.slug) return { ...item, lang };
  return { ...item, ...articleTranslations[lang], lang };
}
const mime = Object.freeze({
  ".avif": "image/avif", ".css": "text/css; charset=utf-8", ".gif": "image/gif",
  ".html": "text/html; charset=utf-8", ".ico": "image/x-icon", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".mp3": "audio/mpeg", ".mp4": "video/mp4",
  ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp", ".woff": "font/woff", ".woff2": "font/woff2"
});

function args(argv) {
  const result = { output: defaultOutput, chrome: "", list: false, videoOnly: false, articleOnly: false, releaseOnly: false, dockIconOnly: false, resourcesOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--list") result.list = true;
    else if (argv[i] === "--video-only") result.videoOnly = true;
    else if (argv[i] === "--article-only") result.articleOnly = true;
    else if (argv[i] === "--release-only") result.releaseOnly = true;
    else if (argv[i] === "--dock-icon-only") result.dockIconOnly = true;
    else if (argv[i] === "--resources-only") result.resourcesOnly = true;
    else if (argv[i] === "--output") result.output = resolve(root, argv[++i] || "");
    else if (argv[i] === "--chrome") result.chrome = resolve(argv[++i] || "");
    else if (["--help", "-h"].includes(argv[i])) {
      console.log("Usage: npm.cmd run audit:public-ui -- [--output <dir>] [--chrome <path>] [--video-only] [--article-only] [--release-only] [--dock-icon-only] [--resources-only] [--list]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return result;
}

function validateViewports() {
  const expected = ["359x500", "375x667", "390x844", "430x932", "844x390", "1280x720", "1440x900"];
  const actual = viewports.map((item) => `${item.width}x${item.height}`);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Viewport contract changed: ${actual.join(", ")}`);
  for (const viewport of viewports) {
    if (viewport.mobile && viewport.height > viewport.width && viewport.width >= 500) {
      throw new Error(`${viewport.name} is a 500px pseudo-phone viewport; exact CDP metrics are required`);
    }
  }
}

function chromePath(explicit = "") {
  const candidates = [
    explicit, process.env.PUBLIC_UI_CHROME, process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("No Chrome/Edge executable found; use --chrome or PUBLIC_UI_CHROME");
  return found;
}

function sendJson(response, statusCode, value) {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
  response.end(body);
}

function apiFixture(url, response) {
  const { pathname, searchParams } = url;
  const lang = ["zh", "en", "ja"].includes(searchParams.get("lang")) ? searchParams.get("lang") : "zh";
  if (pathname === "/api/health") sendJson(response, 200, { ok: true, db: true, audit: true });
  else if (pathname === "/api/auth/me") sendJson(response, 200, { user: null });
  else if (pathname === "/api/articles") {
    const localizedArticles = auditArticles.map((item) => localizedAuditArticle(item, lang));
    if (lang === "en" && localizedArticles.length > 1) {
      localizedArticles[1] = {
        ...article,
        ...articleTranslations.zh,
        category: localizedArticles[1].category,
        slug: fallbackAuditArticleSlug,
        lang: "zh"
      };
    }
    sendJson(response, 200, { articles: localizedArticles });
  }
  else if (pathname.startsWith("/api/articles/")) {
    const slug = decodeURIComponent(pathname.slice("/api/articles/".length));
    if (slug === fallbackAuditArticleSlug) {
      sendJson(response, 200, {
        article: {
          ...article,
          ...articleTranslations.zh,
          slug: fallbackAuditArticleSlug,
          lang: "zh"
        }
      });
      return true;
    }
    const matched = auditArticles.find((item) => item.slug === slug);
    if (!matched) return false;
    sendJson(response, 200, { article: localizedAuditArticle(matched, lang) });
  }
  else if (pathname === "/api/videos") sendJson(response, 200, {
    categories: [{ category_id: "audit", name: "Audit" }],
    videos: [auditVideo, auditPlayableVideo]
  });
  else if (pathname === "/api/social-links") sendJson(response, 200, { links: {} });
  else if (pathname === "/api/transfer/config") sendJson(response, 401, { error: "Audit guest authentication required." });
  else if (pathname === "/api/chat/nickname") sendJson(response, 200, { nickname: "AuditGuest" });
  else if (pathname === "/api/chat/messages") sendJson(response, 200, { messages: [] });
  else if (pathname.startsWith("/api/analytics/")) { response.writeHead(204, { "Cache-Control": "no-store" }); response.end(); }
  else return false;
  return true;
}

function localPath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname).replaceAll("\\", "/"); } catch { return ""; }
  if (["/.git", "/.dev.vars", "/.env", "/node_modules", "/output"].some((part) => decoded === part || decoded.startsWith(`${part}/`))) return "";
  const full = resolve(root, `.${decoded}`);
  const rel = relative(root, full);
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? full : "";
}

function isWallpaperBaseAssetPath(pathname) {
  return /\/assets\/images\/wallpapers\/optimized\/[^/]+$/.test(pathname)
    || /\/assets\/images\/wallpaper-dynamic\/[^/]+\/optimized\/base-[^/]+$/.test(pathname)
    || /\/assets\/images\/mobile-wallpapers\/[^/]+$/.test(pathname);
}

async function auditServer() {
  const index = resolve(root, "index.html");
  const requests = [];
  let cacheWallpaperBaseAssets = false;
  const server = createServer(async (request, response) => {
    let requestEntry = null;
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      requestEntry = {
        method: String(request.method || "GET").toUpperCase(),
        path: url.pathname,
        search: url.search,
        status: 0
      };
      requests.push(requestEntry);
      response.once("finish", () => { requestEntry.status = response.statusCode; });
      if (apiFixture(url, response)) return;
      const file = url.pathname === "/" || url.pathname.startsWith("/articles/") ? index : localPath(url.pathname);
      const info = file ? await stat(file).catch(() => null) : null;
      if (!info?.isFile()) { response.writeHead(404); response.end("Not found"); return; }
      const cacheControl = cacheWallpaperBaseAssets && isWallpaperBaseAssetPath(url.pathname)
        ? "public, max-age=86400, must-revalidate"
        : "no-store";
      response.writeHead(200, { "Cache-Control": cacheControl, "Content-Type": mime[extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": info.size });
      if (request.method === "HEAD") response.end();
      else createReadStream(file).pipe(response);
    } catch (error) { response.writeHead(500); response.end(`Audit server error: ${error.message}`); }
  });
  await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Audit server has no TCP port");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((ok) => server.close(ok)),
    resetRequests: () => { requests.length = 0; },
    setWallpaperBaseAssetCaching: (enabled) => { cacheWallpaperBaseAssets = Boolean(enabled); },
    requestPaths: () => requests.map((entry) => `${entry.path}${entry.search}`),
    requestLog: () => requests.map((entry) => ({ ...entry }))
  };
}

async function freePort() {
  const server = createServer();
  await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve CDP port");
  await new Promise((ok) => server.close(ok));
  return address.port;
}

async function getJson(url, limit = 10_000) {
  const started = Date.now(); let last;
  while (Date.now() - started < limit) {
    try { const response = await fetch(url, { cache: "no-store" }); if (response.ok) return response.json(); last = new Error(`HTTP ${response.status}`); }
    catch (error) { last = error; }
    await new Promise((ok) => setTimeout(ok, 100));
  }
  throw new Error(`Timed out waiting for ${url}: ${last?.message || "unknown error"}`);
}

class CDP {
  constructor(url) { this.url = url; this.id = 1; this.pending = new Map(); this.listeners = new Map(); }
  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((ok, fail) => { this.socket.addEventListener("open", ok, { once: true }); this.socket.addEventListener("error", () => fail(new Error("CDP connection failed")), { once: true }); });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) {
        for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
        return;
      }
      const job = this.pending.get(message.id);
      if (!job) return; this.pending.delete(message.id); clearTimeout(job.timer);
      if (message.error) job.fail(new Error(`${job.method}: ${message.error.message}`)); else job.ok(message.result || {});
    });
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((ok, fail) => {
      const timer = setTimeout(() => { this.pending.delete(id); fail(new Error(`${method} timed out`)); }, timeoutMs);
      this.pending.set(id, { method, ok, fail, timer }); this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, listener) {
    const listeners = this.listeners.get(method) || new Set();
    listeners.add(listener); this.listeners.set(method, listeners);
    return () => { listeners.delete(listener); if (!listeners.size) this.listeners.delete(method); };
  }
  close() { for (const job of this.pending.values()) { clearTimeout(job.timer); job.fail(new Error("CDP closed")); } this.pending.clear(); this.socket?.close(); }
}

async function startChrome(executable) {
  const port = await freePort();
  const profile = await mkdtemp(join(tmpdir(), "lusu-public-ui-audit-"));
  const child = spawn(executable, ["--headless=new", `--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1", `--user-data-dir=${profile}`, "--disable-background-networking", "--disable-default-apps", "--disable-extensions", "--disable-sync", "--metrics-recording-only", "--mute-audio", "--no-default-browser-check", "--no-first-run", "--force-device-scale-factor=1", "about:blank"], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
  let stderr = ""; child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-8000); });
  try {
    await getJson(`http://127.0.0.1:${port}/json/version`);
    const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
    const page = targets.find((target) => target.type === "page");
    if (!page?.webSocketDebuggerUrl) throw new Error("Chrome did not expose a page target");
    return { child, profile, socket: page.webSocketDebuggerUrl };
  } catch (error) { child.kill(); await rm(profile, { recursive: true, force: true }); throw new Error(`${error.message}\n${stderr}`); }
}

async function stopChrome(chrome) {
  if (!chrome) return;
  if (chrome.child.exitCode === null) { chrome.child.kill(); await Promise.race([new Promise((ok) => chrome.child.once("exit", ok)), new Promise((ok) => setTimeout(ok, 5000))]); }
  const tempPrefix = `${resolve(tmpdir())}${sep}`.toLowerCase();
  if (!resolve(chrome.profile).toLowerCase().startsWith(tempPrefix)) return;
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try { await rm(chrome.profile, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 }); return; }
    catch (error) { lastError = error; await new Promise((ok) => setTimeout(ok, 200 * (attempt + 1))); }
  }
  throw new Error(`Could not remove temporary Chrome profile: ${lastError?.message || chrome.profile}`);
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}

async function waitFor(client, expression, label) {
  const started = Date.now(); let last;
  while (Date.now() - started < timeoutMs) {
    try { if (await evaluate(client, `Boolean(${expression})`)) return; } catch (error) { last = error; }
    await new Promise((ok) => setTimeout(ok, 100));
  }
  const runtimeErrors = await evaluate(client, `Array.isArray(window.__auditRuntimeErrors)?window.__auditRuntimeErrors.slice(-5):[]`).catch(() => []);
  const runtimeDetail = runtimeErrors.length ? `; runtime errors: ${runtimeErrors.join(" | ")}` : "";
  throw new Error(`Timed out waiting for ${label}${last ? `: ${last.message}` : ""}${runtimeDetail}`);
}

let freshNavigationSequence = 0;

async function navigateFresh(client, url, stage) {
  const target = new URL(url);
  if (target.protocol === "about:") throw new Error(`navigateFresh cannot navigate ${target.href}`);
  const sanitizedStage = String(stage || "scenario")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "scenario";
  freshNavigationSequence += 1;
  target.searchParams.set("audit-stage", `${sanitizedStage}-${freshNavigationSequence}`);
  const result = await client.send("Page.navigate", { url: target.href });
  if (!result?.loaderId) {
    throw new Error(`Fresh navigation did not create a document for ${sanitizedStage}: ${target.href}${result?.errorText ? ` (${result.errorText})` : ""}`);
  }
  return result;
}

async function emulate(client, viewport) {
  const landscape = viewport.width > viewport.height;
  await client.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile, screenWidth: viewport.width, screenHeight: viewport.height, screenOrientation: { angle: landscape ? 90 : 0, type: landscape ? "landscapePrimary" : "portraitPrimary" } });
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: viewport.mobile, maxTouchPoints: viewport.mobile ? 5 : 1 });
  await client.send("Emulation.setEmulatedMedia", { media: "screen", features: [{ name: "prefers-reduced-motion", value: "reduce" }, { name: "prefers-color-scheme", value: "light" }] });
  await client.send("Emulation.setTimezoneOverride", { timezoneId: "Asia/Shanghai" });
}

const metricsCode = `(() => {
  const r = (n) => Math.round(Number(n || 0) * 100) / 100;
  const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top:r(b.top), right:r(b.right), bottom:r(b.bottom), left:r(b.left), width:r(b.width), height:r(b.height) }; };
  const overlap = (a,b) => !a || !b ? 0 : r(Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)));
  const page = document.querySelector('.page.active'); const win = page?.querySelector('.xp-window') || page; const dock = document.querySelector('.xp-taskbar');
  const activeH1s = page ? [...page.querySelectorAll('h1')] : []; const inactivePages = [...document.querySelectorAll('.page:not(.active)')];
  const wb=box(win), db=box(dock), sidebar=box(document.querySelector('.folder-layout.is-reading .article-reader-sidebar')), card=box(document.querySelector('.folder-layout.is-reading .article-detail-card'));
  return { route:document.body.dataset.route||'', shell:document.documentElement.dataset.uiShell||'', motion:document.documentElement.dataset.motion||document.body.dataset.motion||'', theme:document.body.dataset.timeTheme||document.querySelector('#wallpaper-root')?.dataset.time||'',
    viewport:{innerWidth,innerHeight,visualWidth:r(visualViewport?.width||innerWidth),visualHeight:r(visualViewport?.height||innerHeight),devicePixelRatio},
    document:{clientWidth:document.documentElement.clientWidth,scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),clientHeight:document.documentElement.clientHeight,scrollHeight:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)},
    semantics:{mainTag:document.querySelector('#main-content')?.tagName||'',activeH1Count:activeH1s.length,activeH1Text:activeH1s[0]?.textContent.trim()||'',inactivePagesHidden:inactivePages.every((item)=>getComputedStyle(item).display==='none'),articleBodyH1Count:document.querySelectorAll('#article-detail-body h1').length},
    activeWindow:wb,dock:{...db,position:dock?getComputedStyle(dock).position:''},windowDockGap:wb&&db?r(db.top-wb.bottom):null,windowDockOverlapArea:overlap(wb,db),
    chat:{
      header:box(document.querySelector('#chatroom .chatroom-header')),
      nickname:box(document.querySelector('#chatroom .chatroom-nickname-row')),
      status:box(document.querySelector('#chatroom .chatroom-status')),
      log:box(document.querySelector('#chat-message-list')),
      compose:box(document.querySelector('#chat-form')),
      feedback:box(document.querySelector('#chat-feedback')),
      footer:box(document.querySelector('#chatroom .chatroom-footer'))
    },
    article:{detail:box(document.querySelector('#article-detail:not([hidden])')),sidebar,card,toc:box(document.querySelector('#article-detail-toc:not([hidden])')),sideBySide:Boolean(sidebar&&card&&sidebar.right<=card.left+1),overlapArea:overlap(sidebar,card)} };
})()`;

function check(viewport, route, data) {
  const errors = []; const need = (condition, text) => { if (!condition) errors.push(text); }; const expectedRoute = route === "article" ? "knowledge" : route;
  need(data.viewport.innerWidth === viewport.width, `innerWidth ${data.viewport.innerWidth} !== ${viewport.width}`);
  need(data.viewport.innerHeight === viewport.height, `innerHeight ${data.viewport.innerHeight} !== ${viewport.height}`);
  need(Math.abs(data.viewport.visualWidth - viewport.width) <= .5, `visualViewport width ${data.viewport.visualWidth} !== ${viewport.width}`);
  need(data.document.clientWidth === viewport.width, `clientWidth ${data.document.clientWidth} !== ${viewport.width}`);
  need(data.document.scrollWidth === viewport.width, `document scrollWidth ${data.document.scrollWidth} !== ${viewport.width}`);
  need(data.route === expectedRoute, `route ${data.route} !== ${expectedRoute}`); need(data.shell === (viewport.mobile ? "mobile" : "desktop"), `shell ${data.shell} is wrong`);
  need(data.motion === "off", `motion ${data.motion} !== off`); need(data.theme === fixedTheme, `theme ${data.theme} !== ${fixedTheme}`);
  need(data.semantics.mainTag === "MAIN", `main landmark tag ${data.semantics.mainTag} !== MAIN`); need(data.semantics.activeH1Count === 1, `active route H1 count ${data.semantics.activeH1Count} !== 1`); need(Boolean(data.semantics.activeH1Text), "active route H1 has no text"); need(data.semantics.inactivePagesHidden, "an inactive route remains rendered"); need(data.semantics.articleBodyH1Count === 0, `article body exposes ${data.semantics.articleBodyH1Count} H1 headings`);
  need(data.activeWindow?.width > 0 && data.activeWindow?.height > 0, "active window has no geometry"); need(data.dock?.width > 0 && data.dock?.height > 0, "Dock has no geometry");
  const dockBottomInset = viewport.height - Number(data.dock?.bottom || 0);
  const maximumDockInset = viewport.mobile ? (viewport.width > viewport.height ? 4 : 8) : 1;
  need(data.dock?.position === "fixed", `Dock position ${data.dock?.position} !== fixed`); need(dockBottomInset >= 0 && dockBottomInset <= maximumDockInset, `Dock bottom inset ${dockBottomInset}px exceeds ${maximumDockInset}px`);
  if (!viewport.mobile) need(data.windowDockOverlapArea <= 1, `active window overlaps Dock by ${data.windowDockOverlapArea}px²`);
  need(data.activeWindow?.left >= -1 && data.activeWindow?.right <= viewport.width + 1, "active window exceeds viewport width");
  if (route === "chatroom" && viewport.width === 359) need(data.chat.log?.height >= 160, `359x500 Chat log ${data.chat.log?.height}px < 160px`);
  if (route === "chatroom" && viewport.width === 844) {
    need(data.chat.log?.height >= 150, `844x390 Chat log ${data.chat.log?.height}px < 150px`);
    need(data.chat.header?.right <= data.chat.log?.left + 1, `844x390 Chat identity rail overlaps the log: ${JSON.stringify({ header:data.chat.header, log:data.chat.log })}`);
    need(data.chat.footer?.right <= data.chat.compose?.left + 1, `844x390 Chat feedback rail overlaps the composer: ${JSON.stringify({ footer:data.chat.footer, compose:data.chat.compose })}`);
    need(data.chat.nickname?.left >= data.chat.header?.left - 1 && data.chat.nickname?.right <= data.chat.header?.right + 1, "844x390 nickname controls escaped the identity rail");
    need(data.chat.status?.left >= data.chat.header?.left - 1 && data.chat.status?.right <= data.chat.header?.right + 1, "844x390 room controls escaped the identity rail");
  }
  if (route === "chatroom" && viewport.width === 1280) {
    need(data.chat.log?.height >= 180, `1280x720 Chat log ${data.chat.log?.height}px < 180px`);
    need(data.chat.compose?.height <= 132, `1280x720 Chat composer ${data.chat.compose?.height}px > 132px`);
    need(data.chat.compose?.bottom <= data.activeWindow?.bottom + 1, "1280x720 Chat composer escaped the window");
    need(data.chat.footer?.bottom <= data.activeWindow?.bottom + 1, "1280x720 Chat footer escaped the window");
  }
  if (route === "article") { need(data.article.detail?.height > 0, "article detail is hidden"); need(data.article.sidebar?.width > 0 && data.article.card?.width > 0, "article columns are missing"); need(data.article.sideBySide, "844x390 article columns are not side by side"); need(data.article.overlapArea <= 1, `article columns overlap by ${data.article.overlapArea}px²`); }
  return errors;
}

async function stable(client, route) {
  await waitFor(client, `document.readyState==='complete'&&Boolean(document.documentElement.dataset.uiShell)`, "shell initialization");
  await evaluate(client, `(async()=>{window.LusuUiMotion?.setMode?.('off');document.documentElement.dataset.motion='off';document.body.dataset.motion='off';const w=document.querySelector('#wallpaper-root');if(w)w.dataset.motion='off';scrollTo(0,0);await document.fonts?.ready;await new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)));return true})()`);
  const expected = route === "article" ? "knowledge" : route; await waitFor(client, `document.body.dataset.route===${JSON.stringify(expected)}`, `${expected} route`);
  if (["knowledge", "videos", "resources", "games", "chatroom"].includes(expected)) {
    await waitFor(client, `window.__lusuRouteModulesAudit?.()[${JSON.stringify(expected)}]==='ready'`, `${expected} route module`);
    await evaluate(client, `new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))`);
  }
  if (route === "article") await waitFor(client, `!document.querySelector('#article-detail')?.hidden&&Boolean(document.querySelector('#article-detail-title')?.textContent.trim())&&document.querySelector('#article-detail-body')?.childElementCount>0`, "controlled article");
}

function requestCount(entries, pathname) {
  return entries.filter((entry) => entry.method === "GET" && entry.path === pathname).length;
}

function transferAssetPath(pathname) {
  return pathname === "/js/features/quick-transfer-loader.mjs"
    || pathname === "/css/transfer.css"
    || pathname === "/js/transfer.js"
    || pathname === "/fragments/quick-transfer.html"
    || pathname.startsWith("/api/transfer/");
}

async function openQuickTransferFromCta(client) {
  await waitFor(client, `Boolean(document.querySelector('[data-quick-transfer-open]'))`, "Quick Transfer resource CTA");
  const immediate = await evaluate(client, `(() => {
    window.__auditTransferLoadingReached = Boolean(document.getElementById('transfer-loader-status'));
    window.__auditTransferLoadingObserver?.disconnect?.();
    const observer = new MutationObserver(() => {
      if (document.getElementById('transfer-loader-status')) window.__auditTransferLoadingReached = true;
      if (document.getElementById('transfer-app')) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
    window.__auditTransferLoadingObserver = observer;
    const button = document.querySelector('[data-quick-transfer-open]');
    button.click();
    if (document.getElementById('transfer-loader-status')) window.__auditTransferLoadingReached = true;
    return {
      clicked: true,
      loadingVisible: Boolean(document.getElementById('transfer-loader-status')),
      activeId: document.activeElement?.id || ''
    };
  })()`);
  await waitFor(client, `Boolean(document.getElementById('transfer-app')&&window.QuickTransfer?.lifecycleSnapshot?.().initialized)`, "Quick Transfer loader completion");
  await waitFor(client, `document.getElementById('transfer-app')?.hidden===false`, "Quick Transfer open state");
  await evaluate(client, `new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))`);
  return {
    ...immediate,
    loadingReached: await evaluate(client, `Boolean(window.__auditTransferLoadingReached)`),
    state: await evaluate(client, `({ lifecycle:window.QuickTransfer?.lifecycleSnapshot?.()||null, appVisible:document.getElementById('transfer-app')?.hidden===false })`)
  };
}

async function auditLazyRouteAndTransferLoading(client, server, viewport) {
  await emulate(client, viewport);
  server.resetRequests();
  await client.send("Page.navigate", { url: `${server.origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0&audit-lazy=${viewport.width}x${viewport.height}` });
  await stable(client, "home");
  await waitFor(client, `Boolean(document.getElementById('top-updated')?.textContent.trim()&&document.querySelector('#recent-updates li'))`, "Home update summaries");
  await new Promise((ok) => setTimeout(ok, 150));

  const failures = [];
  const homeRequests = server.requestLog();
  const homeState = await evaluate(client, `({
    route:document.body.dataset.route||'',
    updated:document.getElementById('top-updated')?.textContent.trim()||'',
    updateCount:document.querySelectorAll('#recent-updates li').length,
    updateText:document.querySelector('#recent-updates')?.textContent.trim()||'',
    transferGlobal:typeof window.QuickTransfer,
    transferDom:Boolean(document.getElementById('transfer-app')),
    routeModules:window.__lusuRouteModulesAudit?.()||null
  })`);
  const forbiddenHomeApis = homeRequests.filter((entry) => entry.path.startsWith("/api/")
    && entry.path !== "/api/auth/me"
    && entry.path !== "/api/health"
    && !entry.path.startsWith("/api/analytics/"));
  const forbiddenHomeChunks = homeRequests.filter((entry) => /^\/js\/routes\//.test(entry.path)
    || /^\/css\/routes\//.test(entry.path)
    || [
      "/js/data/content.mjs",
      "/js/data/videos-content.mjs",
      "/js/data/resources-content.mjs",
      "/js/data/blog-content.mjs"
    ].includes(entry.path));
  const forbiddenHomeTransfer = homeRequests.filter((entry) => transferAssetPath(entry.path));
  if (forbiddenHomeApis.length) failures.push(`Home requested business APIs: ${JSON.stringify(forbiddenHomeApis)}`);
  if (forbiddenHomeChunks.length) failures.push(`Home requested unopened route chunks: ${JSON.stringify(forbiddenHomeChunks)}`);
  if (forbiddenHomeTransfer.length) failures.push(`Home requested Quick Transfer assets: ${JSON.stringify(forbiddenHomeTransfer)}`);
  if (homeState.transferGlobal !== "undefined" || homeState.transferDom) failures.push(`Home eagerly initialized Quick Transfer: ${JSON.stringify(homeState)}`);
  if (!/^\d{4}[./-]\d{2}[./-]\d{2}$/.test(homeState.updated) || homeState.updateCount < 1 || !homeState.updateText) {
    failures.push(`Home update summary/date is incomplete: ${JSON.stringify(homeState)}`);
  }
  if (Object.values(homeState.routeModules || {}).some((status) => status !== "idle")) {
    failures.push(`Home route registry is not idle: ${JSON.stringify(homeState.routeModules)}`);
  }

  const routeContracts = Object.freeze({
    knowledge: { js: "/js/routes/knowledge.mjs", css: "/css/routes/knowledge.css" },
    videos: { js: "/js/routes/videos.mjs", css: "/css/routes/videos.css" },
    resources: { js: "/js/routes/resources.mjs", css: "" },
    games: { js: "/js/routes/games.mjs", css: "/css/routes/games.css" },
    chatroom: { js: "/js/routes/chatroom.mjs", css: "/css/routes/chatroom.css" }
  });
  const routes = [];
  for (const [route, contract] of Object.entries(routeContracts)) {
    server.resetRequests();
    await setAuditRoute(client, route);
    await stable(client, route);
    await new Promise((ok) => setTimeout(ok, 100));
    const first = server.requestLog();
    const firstJsCount = requestCount(first, contract.js);
    const firstCssCount = contract.css ? requestCount(first, contract.css) : 0;
    if (firstJsCount !== 1) failures.push(`${route} first entry requested ${contract.js} ${firstJsCount} times`);
    if (contract.css && firstCssCount !== 1) failures.push(`${route} first entry requested ${contract.css} ${firstCssCount} times`);
    if (!contract.css && first.some((entry) => entry.path === `/css/routes/${route}.css`)) failures.push(`${route} unexpectedly requested route CSS`);

    const beforeTransfer = route === "resources" ? await evaluate(client, `({ global:typeof window.QuickTransfer, dom:Boolean(document.getElementById('transfer-app')) })`) : null;
    if (route === "resources") {
      const transferRequests = first.filter((entry) => transferAssetPath(entry.path));
      if (beforeTransfer.global !== "undefined" || beforeTransfer.dom || transferRequests.length) {
        failures.push(`Resources initialized Quick Transfer before its CTA: ${JSON.stringify({ beforeTransfer, transferRequests })}`);
      }
    }

    await setAuditRoute(client, "home");
    await stable(client, "home");
    server.resetRequests();
    await setAuditRoute(client, route);
    await stable(client, route);
    await new Promise((ok) => setTimeout(ok, 100));
    const reused = server.requestLog();
    const reusedJsCount = requestCount(reused, contract.js);
    const reusedCssCount = contract.css ? requestCount(reused, contract.css) : 0;
    if (reusedJsCount || reusedCssCount) failures.push(`${route} return did not reuse its loaded chunk/style: ${JSON.stringify(reused)}`);
    routes.push({ route, contract, first, reused, firstJsCount, firstCssCount, reusedJsCount, reusedCssCount, beforeTransfer });
    await setAuditRoute(client, "home");
    await stable(client, "home");
  }

  await setAuditRoute(client, "resources");
  await stable(client, "resources");
  server.resetRequests();
  const transferFirstOpen = await openQuickTransferFromCta(client);
  await new Promise((ok) => setTimeout(ok, 150));
  const transferFirstRequests = server.requestLog();
  for (const path of ["/js/features/quick-transfer-loader.mjs", "/css/transfer.css", "/js/transfer.js", "/fragments/quick-transfer.html", "/api/transfer/config"]) {
    const count = requestCount(transferFirstRequests, path);
    if (count !== 1) failures.push(`Quick Transfer first CTA requested ${path} ${count} times`);
  }
  if (!transferFirstOpen.loadingReached) failures.push(`Quick Transfer loading state was never reachable: ${JSON.stringify(transferFirstOpen)}`);
  if (!transferFirstOpen.state?.lifecycle?.initialized || !transferFirstOpen.state?.lifecycle?.routeActive || !transferFirstOpen.state?.appVisible) {
    failures.push(`Quick Transfer first open state is incomplete: ${JSON.stringify(transferFirstOpen)}`);
  }
  await evaluate(client, `(() => {
    window.__auditTransferFacade = window.QuickTransfer;
    window.__auditTransferApp = document.getElementById('transfer-app');
    window.QuickTransfer?.close?.({restoreFocus:false});
    return true;
  })()`);
  await setAuditRoute(client, "home");
  await stable(client, "home");
  await setAuditRoute(client, "resources");
  await stable(client, "resources");
  server.resetRequests();
  const transferReuseOpen = await openQuickTransferFromCta(client);
  await new Promise((ok) => setTimeout(ok, 100));
  const transferReuseRequests = server.requestLog();
  const transferReuse = await evaluate(client, `({
    sameFacade:window.__auditTransferFacade===window.QuickTransfer,
    sameApp:window.__auditTransferApp===document.getElementById('transfer-app'),
    appCount:document.querySelectorAll('#transfer-app').length,
    lifecycle:window.QuickTransfer?.lifecycleSnapshot?.()||null
  })`);
  const duplicateTransferAssets = transferReuseRequests.filter((entry) => ["/js/features/quick-transfer-loader.mjs", "/css/transfer.css", "/js/transfer.js", "/fragments/quick-transfer.html"].includes(entry.path));
  if (duplicateTransferAssets.length) failures.push(`Quick Transfer return reloaded static assets: ${JSON.stringify(duplicateTransferAssets)}`);
  if (!transferReuse.sameFacade || !transferReuse.sameApp || transferReuse.appCount !== 1 || !transferReuse.lifecycle?.initialized) {
    failures.push(`Quick Transfer return did not reuse one initialized instance: ${JSON.stringify(transferReuse)}`);
  }
  await evaluate(client, `window.QuickTransfer?.close?.({restoreFocus:false}); true`);

  return {
    kind: "lazy-loading",
    name: "home-routes-and-quick-transfer",
    shell: viewport.mobile ? "mobile" : "desktop",
    viewport,
    home: { state: homeState, requests: homeRequests },
    routes,
    transfer: { firstOpen: transferFirstOpen, firstRequests: transferFirstRequests, reuseOpen: transferReuseOpen, reuseRequests: transferReuseRequests, reuse: transferReuse },
    failures,
    status: failures.length ? "FAIL" : "PASS"
  };
}

function themeFromAsset(path) {
  const match = String(path).match(/\/assets\/images\/(?:wallpapers\/(morning|day|dusk|night)\.png|wallpaper-dynamic\/(morning|day|dusk|night)\/|window-backdrops\/(morning|day|dusk|night)\.png|mobile-wallpapers\/(morning|day|dusk|night)\.webp)/);
  return match ? match.slice(1).find(Boolean) || "" : "";
}

async function installFixedClock(client, now) {
  const source = `(() => {
    const NativeDate = Date;
    const fixedNow = NativeDate.parse(${JSON.stringify(now)});
    function AuditDate(...args) {
      if (!new.target) return new NativeDate(fixedNow).toString();
      return new NativeDate(...(args.length ? args : [fixedNow]));
    }
    Object.setPrototypeOf(AuditDate, NativeDate);
    AuditDate.prototype = NativeDate.prototype;
    AuditDate.now = () => fixedNow;
    globalThis.Date = AuditDate;
  })();`;
  const result = await client.send("Page.addScriptToEvaluateOnNewDocument", { source });
  return result.identifier;
}

async function auditThemeBootstrap(client, server, viewport, scenario) {
  await emulate(client, viewport);
  await client.send("Page.navigate", { url: "about:blank" });
  await waitFor(client, `document.readyState==='complete'`, "blank theme audit boundary");
  await new Promise((ok) => setTimeout(ok, 50));
  const clockScript = await installFixedClock(client, scenario.now);
  server.resetRequests();
  const shell = viewport.mobile ? "mobile" : "desktop";
  const preview = scenario.preview ? `&wallpaper=${scenario.preview}` : "";
  const url = `${server.origin}/?lang=zh&welcome=0&audit-theme=${scenario.name}-${shell}${preview}`;
  try {
    await client.send("Page.navigate", { url });
    await stable(client, "home");
    await new Promise((ok) => setTimeout(ok, 150));
  } finally {
    await client.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: clockScript }).catch(() => {});
  }
  const state = await evaluate(client, `(() => ({ html: document.documentElement.dataset.timeTheme || '', body: document.body.dataset.timeTheme || '', root: document.querySelector('#wallpaper-root')?.dataset.time || '', shell: document.documentElement.dataset.uiShell || '' }))()`);
  const themeRequests = server.requestPaths().map((path) => ({ path, theme: themeFromAsset(path) })).filter((item) => item.theme);
  const failures = [];
  for (const [label, value] of Object.entries(state)) {
    const expected = label === "shell" ? shell : scenario.theme;
    if (value !== expected) failures.push(`${label} ${value || "<empty>"} !== ${expected}`);
  }
  if (!themeRequests.length) failures.push("no themed image request was observed");
  if (themeRequests[0] && themeRequests[0].theme !== scenario.theme) failures.push(`first themed request was ${themeRequests[0].theme}: ${themeRequests[0].path}`);
  const wrongRequests = themeRequests.filter((item) => item.theme !== scenario.theme);
  if (wrongRequests.length) failures.push(`wrong-theme requests: ${wrongRequests.map((item) => item.path).join(", ")}`);
  return { kind: "theme-bootstrap", name: scenario.name, shell, viewport, url, expectedTheme: scenario.theme, state, themeRequests, failures, status: failures.length ? "FAIL" : "PASS" };
}

async function installFocusRecorder(client) {
  await evaluate(client, `(() => {
    window.__auditFocusEvents = [];
    if (!window.__auditFocusRecorder) {
      const nativeFocus = HTMLElement.prototype.focus;
      HTMLElement.prototype.focus = function auditManagedFocus(...args) {
        if (this.id && (this.matches('.page > h1') || this.id === 'article-detail-title')) {
          window.__auditFocusEvents.push(this.id);
        }
        return nativeFocus.apply(this, args);
      };
      window.__auditFocusRecorder = true;
    }
    return true;
  })()`);
}

async function setAuditRoute(client, route) {
  const selector = route === "home" ? ".start-button[data-route='home']" : `.taskbar-tabs button[data-route='${route}']`;
  await installFocusRecorder(client);
  await evaluate(client, `document.querySelector(${JSON.stringify(selector)})?.click(); true`);
  await waitFor(client, `document.body.dataset.route===${JSON.stringify(route)}`, `${route} semantic route`);
  await evaluate(client, `new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))`);
}

async function readDocumentMeta(client) {
  return evaluate(client, `(() => {
    const content=(selector)=>document.querySelector(selector)?.getAttribute('content')||'';
    return {
      documentTitle:document.title,
      description:content('meta[name="description"]'),
      canonical:document.querySelector('link[rel="canonical"]')?.href||'',
      ogType:content('meta[property="og:type"]'),
      ogSiteName:content('meta[property="og:site_name"]'),
      ogTitle:content('meta[property="og:title"]'),
      ogDescription:content('meta[property="og:description"]'),
      ogUrl:content('meta[property="og:url"]'),
      ogImage:content('meta[property="og:image"]'),
      ogImageWidth:content('meta[property="og:image:width"]'),
      ogImageHeight:content('meta[property="og:image:height"]'),
      ogImageAlt:content('meta[property="og:image:alt"]'),
      ogLocale:content('meta[property="og:locale"]'),
      twitterCard:content('meta[name="twitter:card"]'),
      twitterTitle:content('meta[name="twitter:title"]'),
      twitterDescription:content('meta[name="twitter:description"]'),
      twitterImage:content('meta[name="twitter:image"]'),
      twitterImageAlt:content('meta[name="twitter:image:alt"]')
    };
  })()`);
}

function metadataFailures(meta, expected) {
  const failures = [];
  for (const [field, value] of Object.entries(expected)) {
    if (meta[field] !== value) failures.push(`${field} ${JSON.stringify(meta[field])} !== ${JSON.stringify(value)}`);
  }
  if (!meta.description) failures.push("description is empty");
  if (!meta.ogImage.startsWith("https://lusu575.com/")) failures.push(`OG image is not an absolute first-party URL: ${meta.ogImage}`);
  if (!meta.ogImageAlt) failures.push("OG image alt is empty");
  if (meta.ogDescription !== meta.description || meta.twitterDescription !== meta.description) failures.push("description fields diverged");
  if (meta.twitterTitle !== meta.ogTitle || meta.twitterImage !== meta.ogImage || meta.twitterImageAlt !== meta.ogImageAlt) failures.push("Twitter fields diverged from Open Graph");
  return failures;
}

async function levelOneAxHeadings(client) {
  const tree = await client.send("Accessibility.getFullAXTree");
  return (tree.nodes || []).filter((node) => !node.ignored && node.role?.value === "heading" && node.properties?.some((property) => property.name === "level" && Number(property.value?.value) === 1)).map((node) => String(node.name?.value || "").trim());
}

async function auditSemanticMatrix(client, origin, viewport, languages) {
  await emulate(client, viewport);
  const results = [];
  for (const lang of languages) {
    const expected = semanticLanguages[lang];
    const url = `${origin}/?lang=${lang}&wallpaper=${fixedTheme}&welcome=0&audit-semantics=${viewport.width}x${viewport.height}`;
    await client.send("Page.navigate", { url });
    await stable(client, "home");
    await evaluate(client, `document.body.tabIndex=-1; document.body.focus({preventScroll:true}); true`);
    await client.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await new Promise((ok) => setTimeout(ok, 180));
    const skipState = await evaluate(client, `(() => { const link=document.querySelector('.skip-link'); const rect=link?.getBoundingClientRect(); return { active:document.activeElement===link,text:link?.textContent.trim()||'',top:rect?.top??-1,left:rect?.left??-1,right:rect?.right??-1,bottom:rect?.bottom??-1 }; })()`);
    await evaluate(client, `document.body.removeAttribute('tabindex'); true`);
    const skipFailures = [];
    if (!skipState.active) skipFailures.push("first Tab did not focus skip link");
    if (skipState.text !== expected.skip) skipFailures.push(`skip text ${skipState.text} !== ${expected.skip}`);
    if (skipState.top < 0 || skipState.left < 0 || skipState.right > viewport.width || skipState.bottom > viewport.height) skipFailures.push(`focused skip link is outside viewport: ${JSON.stringify(skipState)}`);
    results.push({ kind: "semantics", name: `skip-${lang}`, shell: viewport.mobile ? "mobile" : "desktop", viewport, lang, failures: skipFailures, status: skipFailures.length ? "FAIL" : "PASS" });

    const routeMetaResults = [];
    for (const route of auditRoutes) {
      await setAuditRoute(client, route);
      const dom = await evaluate(client, `(() => { const active=document.querySelector('.page.active'); const h1s=active?[...active.querySelectorAll('h1')]:[]; return { htmlLang:document.documentElement.lang, activePages:document.querySelectorAll('.page.active').length, h1Count:h1s.length, h1Text:h1s[0]?.textContent.trim()||'', inactiveHidden:[...document.querySelectorAll('.page:not(.active)')].every((page)=>getComputedStyle(page).display==='none'), route:document.body.dataset.route||'', focusId:document.activeElement?.id||'', focusTag:document.activeElement?.tagName||'', focusEvents:[...(window.__auditFocusEvents||[])] }; })()`);
      const meta = await readDocumentMeta(client);
      const axHeadings = await levelOneAxHeadings(client);
      const failures = [];
      if (dom.htmlLang !== expected.htmlLang) failures.push(`html lang ${dom.htmlLang} !== ${expected.htmlLang}`);
      if (dom.activePages !== 1) failures.push(`active page count ${dom.activePages} !== 1`);
      if (dom.h1Count !== 1) failures.push(`active H1 count ${dom.h1Count} !== 1`);
      if (dom.h1Text !== expected.headings[route]) failures.push(`H1 ${dom.h1Text} !== ${expected.headings[route]}`);
      if (!dom.inactiveHidden) failures.push("an inactive route is still rendered");
      if (dom.route !== route) failures.push(`route ${dom.route} !== ${route}`);
      if (axHeadings.length !== 1 || axHeadings[0] !== expected.headings[route]) failures.push(`AX level-1 headings ${JSON.stringify(axHeadings)} !== [${expected.headings[route]}]`);
      const siteTitle = expected.headings.home;
      const routeTitle = expected.headings[route];
      const canonical = `https://lusu575.com/?lang=${lang}${route === "home" ? "" : `#${route}`}`;
      failures.push(...metadataFailures(meta, {
        documentTitle: route === "home" ? siteTitle : `${routeTitle} | ${siteTitle}`,
        canonical,
        ogType: "website",
        ogSiteName: siteTitle,
        ogTitle: routeTitle,
        ogUrl: canonical,
        ogImage: "https://lusu575.com/assets/images/homepage-pixel-coast.png?v=20260612-hd-wallpapers",
        ogImageWidth: "1672",
        ogImageHeight: "941",
        ogLocale: expected.locale,
        twitterCard: "summary_large_image"
      }));
      if (route !== "home") {
        const expectedFocus = `${route}-title`;
        if (dom.focusId !== expectedFocus) failures.push(`route focus ${dom.focusId || "<empty>"} !== ${expectedFocus}`);
        if (JSON.stringify(dom.focusEvents) !== JSON.stringify([expectedFocus])) failures.push(`route focus events ${JSON.stringify(dom.focusEvents)} !== [${expectedFocus}]`);
        if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(dom.focusTag)) failures.push(`route focused interactive ${dom.focusTag}`);
      }
      const routeResult = { kind: "semantics", name: `${route}-${lang}`, shell: viewport.mobile ? "mobile" : "desktop", viewport, lang, route, dom, meta, axHeadings, failures, status: failures.length ? "FAIL" : "PASS" };
      results.push(routeResult);
      routeMetaResults.push(routeResult);
    }

    const duplicateDescriptions = routeMetaResults.filter((item, index, items) => items.some((candidate, candidateIndex) => candidateIndex !== index && candidate.meta.description === item.meta.description));
    for (const item of duplicateDescriptions) {
      item.failures.push(`route description is not unique: ${item.meta.description}`);
      item.status = "FAIL";
    }

    await setAuditRoute(client, "home");
    const homeFocus = await evaluate(client, `({ focusId:document.activeElement?.id||'', focusEvents:[...(window.__auditFocusEvents||[])] })`);
    const homeFocusFailures = [];
    if (homeFocus.focusId !== "home-title") homeFocusFailures.push(`Home focus ${homeFocus.focusId || "<empty>"} !== home-title`);
    if (JSON.stringify(homeFocus.focusEvents) !== JSON.stringify(["home-title"])) homeFocusFailures.push(`Home focus events ${JSON.stringify(homeFocus.focusEvents)} !== [home-title]`);
    results.push({ kind: "focus", name: `home-return-${lang}`, shell: viewport.mobile ? "mobile" : "desktop", viewport, lang, state: homeFocus, failures: homeFocusFailures, status: homeFocusFailures.length ? "FAIL" : "PASS" });

    await waitFor(client, `Boolean(document.querySelector('[data-account-toggle]')&&document.getElementById('account-popover'))`, "account popover initialization");
    const accountOpen = await evaluate(client, `(() => { const toggle=document.querySelector('[data-account-toggle]'); toggle.click(); const panel=document.getElementById('account-popover'); const label=document.getElementById(panel?.getAttribute('aria-labelledby')||''); return { expanded:toggle.getAttribute('aria-expanded'), controls:toggle.getAttribute('aria-controls'), hidden:panel?.hidden, role:panel?.getAttribute('role')||'', labelledBy:panel?.getAttribute('aria-labelledby')||'', labelText:label?.textContent.trim()||'' }; })()`);
    await evaluate(client, `document.querySelector('#account-popover input')?.focus({preventScroll:true}); true`);
    await client.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await waitFor(client, `document.getElementById('account-popover')?.hidden===true`, "account popover Escape close");
    const accountEscape = await evaluate(client, `({ expanded:document.querySelector('[data-account-toggle]')?.getAttribute('aria-expanded')||'', focusIsToggle:document.activeElement===document.querySelector('[data-account-toggle]') })`);
    await evaluate(client, `(() => { const toggle=document.querySelector('[data-account-toggle]'); toggle.click(); document.querySelector('#account-popover input')?.focus({preventScroll:true}); document.getElementById('main-content')?.click(); return true; })()`);
    await waitFor(client, `document.getElementById('account-popover')?.hidden===true`, "account popover outside close");
    const accountOutside = await evaluate(client, `({ expanded:document.querySelector('[data-account-toggle]')?.getAttribute('aria-expanded')||'', focusIsToggle:document.activeElement===document.querySelector('[data-account-toggle]') })`);
    const accountFailures = [];
    if (accountOpen.expanded !== "true" || accountOpen.hidden !== false) accountFailures.push(`open state is wrong: ${JSON.stringify(accountOpen)}`);
    if (accountOpen.controls !== "account-popover" || accountOpen.role !== "group" || accountOpen.labelledBy !== "account-popover-title" || !accountOpen.labelText) accountFailures.push(`popover semantics are wrong: ${JSON.stringify(accountOpen)}`);
    if (accountEscape.expanded !== "false" || !accountEscape.focusIsToggle) accountFailures.push(`Escape close is wrong: ${JSON.stringify(accountEscape)}`);
    if (accountOutside.expanded !== "false" || !accountOutside.focusIsToggle) accountFailures.push(`outside close is wrong: ${JSON.stringify(accountOutside)}`);
    results.push({ kind: "popover", name: `account-${lang}`, shell: viewport.mobile ? "mobile" : "desktop", viewport, lang, open: accountOpen, escape: accountEscape, outside: accountOutside, failures: accountFailures, status: accountFailures.length ? "FAIL" : "PASS" });

    await setAuditRoute(client, "chatroom");
    const skipRouteState = await evaluate(client, `(() => { const before={route:document.body.dataset.route,hash:location.hash}; const link=document.querySelector('.skip-link'); link.focus({preventScroll:true}); link.click(); return {...before,afterRoute:document.body.dataset.route,afterHash:location.hash,focusId:document.activeElement?.id||''}; })()`);
    const routeFailures = [];
    if (skipRouteState.route !== "chatroom" || skipRouteState.afterRoute !== "chatroom") routeFailures.push(`skip changed route: ${JSON.stringify(skipRouteState)}`);
    if (skipRouteState.hash !== "#chatroom" || skipRouteState.afterHash !== "#chatroom") routeFailures.push(`skip changed hash: ${JSON.stringify(skipRouteState)}`);
    if (skipRouteState.focusId !== "main-content") routeFailures.push(`skip focus ${skipRouteState.focusId} !== main-content`);
    results.push({ kind: "semantics", name: `skip-route-stability-${lang}`, shell: viewport.mobile ? "mobile" : "desktop", viewport, lang, state: skipRouteState, failures: routeFailures, status: routeFailures.length ? "FAIL" : "PASS" });
  }
  return results;
}

async function auditOptionalBlogRoute(client, origin, viewport) {
  await emulate(client, viewport);
  await client.send("Page.navigate", { url: `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#audit-blog-entry` });
  await stable(client, "home");
  const home = await evaluate(client, `(() => {
    const entries=[...document.querySelectorAll('[data-blog-entry]')];
    return {
      entryCount:entries.length,
      hidden:entries.every((entry)=>entry.hidden&&getComputedStyle(entry).display==='none'),
      visibleFocusable:entries.filter((entry)=>!entry.hidden&&getComputedStyle(entry).display!=='none'&&entry.tabIndex>=0).length,
      menuExists:Boolean(document.querySelector('#blog .notepad-menu')),
      blogAriaHidden:document.getElementById('blog')?.getAttribute('aria-hidden')||''
    };
  })()`);
  await client.send("Page.navigate", { url: `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#blog` });
  await stable(client, "knowledge");
  const legacy = await evaluate(client, `({ route:document.body.dataset.route||'', hash:location.hash, active:document.querySelector('.page.active')?.id||'', focusId:document.activeElement?.id||'' })`);
  const failures = [];
  if (home.entryCount !== 2 || !home.hidden || home.visibleFocusable !== 0) failures.push(`unpublished Blog entry remains reachable: ${JSON.stringify(home)}`);
  if (home.menuExists) failures.push("Blog still exposes a pretend Notepad menu");
  if (home.blogAriaHidden !== "true") failures.push(`unpublished Blog page is not hidden from assistive navigation: ${JSON.stringify(home)}`);
  if (legacy.route !== "knowledge" || legacy.active !== "knowledge" || legacy.hash !== "#knowledge") failures.push(`legacy #blog did not merge into Knowledge: ${JSON.stringify(legacy)}`);
  return { kind:"optional-route", name:"blog-unpublished-entry", route:"knowledge", shell:viewport.mobile ? "mobile" : "desktop", viewport, home, legacy, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function auditResourcesAndGamesHierarchy(client, origin, viewport) {
  await emulate(client, viewport);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#resources`, `resources-games-hierarchy-${viewport.width}x${viewport.height}`);
  await stable(client, "resources");
  await waitFor(client, `document.querySelectorAll('#resource-list > .resource-card').length===2`, "ready resource cards");
  const resources = await evaluate(client, `(() => {
    const box=(element)=>{const rect=element?.getBoundingClientRect();return rect?{top:rect.top,right:rect.right,bottom:rect.bottom,left:rect.left,width:rect.width,height:rect.height}:null;};
    const cards=[...document.querySelectorAll('#resource-list > .resource-card')];
    return {
      categories:{ hidden:document.getElementById('resource-categories')?.hidden, display:getComputedStyle(document.getElementById('resource-categories')).display },
      cardHeights:cards.map((card)=>box(card)?.height||0),
      ctaLefts:cards.map((card)=>box(card.querySelector('.card-action'))?.left||0),
      contained:cards.every((card)=>{const outer=box(card);return [...card.children].every((child)=>{const inner=box(child);return inner&&inner.left>=outer.left-1&&inner.right<=outer.right+1&&inner.top>=outer.top-1&&inner.bottom<=outer.bottom+1;});}),
      text:document.getElementById('resource-list')?.textContent||''
    };
  })()`);

  await setAuditRoute(client, "games");
  await stable(client, "games");
  await waitFor(client, `document.querySelectorAll('#game-list > .game-card').length===5`, "five game cards");
  const games = await evaluate(client, `(() => {
    const round=(value)=>Math.round(value*10)/10;
    const box=(element)=>{const rect=element?.getBoundingClientRect();return rect?{top:round(rect.top),right:round(rect.right),bottom:round(rect.bottom),left:round(rect.left),width:round(rect.width),height:round(rect.height)}:null;};
    const list=document.getElementById('game-list');
    const windowElement=document.querySelector('#games .xp-window');
    const taskbar=document.querySelector('.xp-taskbar');
    const cards=[...list.querySelectorAll(':scope > .game-card')];
    const details=cards[0]?.querySelector('.game-secondary-details');
    details.open=true;
    details.querySelector('summary')?.focus({preventScroll:true});
    list.scrollTop=list.scrollHeight;
    const lastAction=cards.at(-1)?.querySelector('.card-action');
    return {
      window:box(windowElement), list:box(list), taskbar:box(taskbar),
      windowOverflow:getComputedStyle(windowElement).overflowY,
      listOverflow:getComputedStyle(list).overflowY,
      document:{scrollTop:(document.scrollingElement||document.documentElement).scrollTop,scrollHeight:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight),clientHeight:document.documentElement.clientHeight},
      actionCount:cards.filter((card)=>card.querySelector('.card-action')).length,
      primaryLanguageCounts:cards.map((card)=>card.querySelectorAll('.game-primary-meta .language-tag').length),
      primarySaveCounts:cards.map((card)=>card.querySelectorAll('.game-primary-meta .game-save-tag').length),
      secondaryCount:cards.filter((card)=>card.querySelector('.game-secondary-details')).length,
      expanded:{open:details.open,summaryFocus:document.activeElement===details.querySelector('summary'),meta:box(details.querySelector('.game-secondary-meta'))},
      lastAction:box(lastAction),
      scrollTop:list.scrollTop,
      scrollHeight:list.scrollHeight,
      clientHeight:list.clientHeight
    };
  })()`);
  const failures = [];
  if (!resources.categories.hidden || resources.categories.display !== "none") failures.push(`single Resources category filter is still visible: ${JSON.stringify(resources.categories)}`);
  const resourceHeightSpread = Math.max(...resources.cardHeights)-Math.min(...resources.cardHeights);
  if (resources.cardHeights.some((height)=>height >= 260 || height < 190) || resourceHeightSpread > 32) failures.push(`Resource card readable-height rhythm is wrong: ${JSON.stringify(resources.cardHeights)}`);
  if (Math.max(...resources.ctaLefts)-Math.min(...resources.ctaLefts) > 1) failures.push(`Resource CTAs are not aligned: ${JSON.stringify(resources.ctaLefts)}`);
  if (!resources.contained) failures.push("Resource card content escapes its card bounds");
  if (!resources.text.includes("保留期: 24 小时") || resources.text.includes("大小: 24 HOURS")) failures.push(`Resource retention semantics are wrong: ${resources.text}`);
  const bottomGap = Number(games.taskbar?.top||0)-Number(games.window?.bottom||0);
  if (bottomGap < 8) failures.push(`Games window bottom gap ${bottomGap}px < 8px`);
  if (games.actionCount !== 5 || games.secondaryCount !== 5 || games.primaryLanguageCounts.some((count)=>count !== 3) || games.primarySaveCounts.some((count)=>count !== 1)) failures.push(`Games primary/secondary hierarchy is incomplete: ${JSON.stringify(games)}`);
  if (games.windowOverflow !== "hidden" || !["auto","scroll"].includes(games.listOverflow) || games.document.scrollTop !== 0 || games.document.scrollHeight > games.document.clientHeight + 1) failures.push(`Games has more than one scroll owner: ${JSON.stringify(games)}`);
  if (!games.expanded.open || !games.expanded.summaryFocus || !games.expanded.meta || games.expanded.meta.height <= 0) failures.push(`Game secondary details are not keyboard-discoverable: ${JSON.stringify(games.expanded)}`);
  if (!games.lastAction || games.lastAction.top < games.list.top - 1 || games.lastAction.bottom > games.list.bottom + 1 || games.scrollTop <= 0) failures.push(`fifth game action is not reachable through the list scroll: ${JSON.stringify({list:games.list,lastAction:games.lastAction,scrollTop:games.scrollTop})}`);
  return { kind:"content-routes", name:"resources-games-hierarchy", route:"games", shell:"desktop", viewport, resources, games, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function auditArticleMetadataLanguages(client, origin, viewport) {
  await emulate(client, viewport);
  const results = [];
  for (const lang of ["zh", "en", "ja"]) {
    await client.send("Page.navigate", { url: `${origin}/articles/${article.slug}?lang=${lang}&wallpaper=${fixedTheme}&welcome=0&audit-meta=1` });
    await stable(client, "article");
    const expected = semanticLanguages[lang];
    const translatedArticle = articleTranslations[lang];
    const siteTitle = expected.headings.home;
    const canonical = `https://lusu575.com/articles/${article.slug}?lang=${lang}`;
    const articleMeta = await readDocumentMeta(client);
    const articleLanguage = await evaluate(client, `(() => ({
      document:document.documentElement.lang||'',
      title:document.getElementById('article-detail-title')?.lang||'',
      body:document.getElementById('article-detail-body')?.lang||'',
      tocList:document.getElementById('article-detail-toc-list')?.lang||'',
      tocLinks:[...document.querySelectorAll('[data-article-heading-target]')].map((item)=>item.lang||''),
      tocNavLabel:document.getElementById('article-detail-toc')?.getAttribute('aria-label')||''
    }))()`);
    const failures = metadataFailures(articleMeta, {
      documentTitle: `${translatedArticle.title} | ${siteTitle}`,
      description: translatedArticle.summary,
      canonical,
      ogType: "article",
      ogSiteName: siteTitle,
      ogTitle: translatedArticle.title,
      ogDescription: translatedArticle.summary,
      ogUrl: canonical,
      ogImage: `https://lusu575.com/${article.cover_image}`,
      ogImageWidth: "",
      ogImageHeight: "",
      ogImageAlt: translatedArticle.title,
      ogLocale: expected.locale,
      twitterCard: "summary_large_image",
      twitterTitle: translatedArticle.title,
      twitterDescription: translatedArticle.summary,
      twitterImage: `https://lusu575.com/${article.cover_image}`,
      twitterImageAlt: translatedArticle.title
    });
    const expectedLanguage = lang === "zh" ? "zh-CN" : lang;
    if (articleLanguage.document !== expectedLanguage
      || articleLanguage.title !== expectedLanguage
      || articleLanguage.body !== expectedLanguage
      || articleLanguage.tocList !== expectedLanguage
      || !articleLanguage.tocLinks.length
      || articleLanguage.tocLinks.some((value) => value !== expectedLanguage)
      || !articleLanguage.tocNavLabel) {
      failures.push(`article or TOC language semantics are incomplete: ${JSON.stringify(articleLanguage)}`);
    }

    await setAuditRoute(client, "videos");
    const videosMeta = await readDocumentMeta(client);
    const videosCanonical = `https://lusu575.com/?lang=${lang}#videos`;
    failures.push(...metadataFailures(videosMeta, {
      documentTitle: `${expected.headings.videos} | ${siteTitle}`,
      canonical: videosCanonical,
      ogType: "website",
      ogSiteName: siteTitle,
      ogTitle: expected.headings.videos,
      ogUrl: videosCanonical,
      ogImage: "https://lusu575.com/assets/images/homepage-pixel-coast.png?v=20260612-hd-wallpapers",
      ogImageWidth: "1672",
      ogImageHeight: "941",
      ogLocale: expected.locale,
      twitterCard: "summary_large_image"
    }));
    if (videosMeta.description === translatedArticle.summary || videosMeta.ogImage === `https://lusu575.com/${article.cover_image}` || videosMeta.ogType === "article") {
      failures.push("leaving the article retained stale article metadata");
    }
    results.push({ kind: "metadata", name: `article-lifecycle-${lang}`, shell: viewport.mobile ? "mobile" : "desktop", viewport, lang, articleMeta, articleLanguage, videosMeta, failures, status: failures.length ? "FAIL" : "PASS" });
  }
  await client.send("Page.navigate", { url: `${origin}/?lang=en&wallpaper=${fixedTheme}&welcome=0&audit-fallback-card=1#knowledge` });
  await stable(client, "knowledge");
  await waitFor(client, `Boolean(document.querySelector('[data-article-slug="${fallbackAuditArticleSlug}"]'))`, "fallback article list card");
  const fallbackListLanguage = await evaluate(client, `(() => {
    const card=document.querySelector('[data-article-slug="${fallbackAuditArticleSlug}"]');
    const title=card?.querySelector('h2');
    const summary=card?.querySelector('p');
    const meta=card?.querySelector('.meta-row');
    return {
      cardLanguage:card?.lang||'',
      titleLanguage:title?.lang||'',
      summaryLanguage:summary?.lang||'',
      metaLanguage:meta?.lang||'',
      labelledBy:card?.getAttribute('aria-labelledby')||'',
      titleId:title?.id||'',
      titleText:title?.textContent?.trim()||'',
      tagCount:meta?.querySelectorAll('.tag').length||0,
      fallbackLabel:meta?.lastElementChild?.classList.contains('tag') ? meta.lastElementChild.textContent.trim() : ''
    };
  })()`);
  await client.send("Page.navigate", { url: `${origin}/articles/${fallbackAuditArticleSlug}?lang=en&wallpaper=${fixedTheme}&welcome=0&audit-fallback-language=1` });
  await stable(client, "article");
  const fallbackLanguage = await evaluate(client, `(() => ({
    document:document.documentElement.lang||'',
    title:document.getElementById('article-detail-title')?.lang||'',
    body:document.getElementById('article-detail-body')?.lang||'',
    tocList:document.getElementById('article-detail-toc-list')?.lang||'',
    tocLinks:[...document.querySelectorAll('[data-article-heading-target]')].map((item)=>item.lang||''),
    tocNavLanguage:document.getElementById('article-detail-toc')?.closest('[lang]')?.lang||'',
    tocNavLabel:document.getElementById('article-detail-toc')?.getAttribute('aria-label')||''
  }))()`);
  const fallbackFailures = [];
  if (fallbackListLanguage.cardLanguage !== "zh-CN"
    || fallbackListLanguage.titleLanguage !== "zh-CN"
    || fallbackListLanguage.summaryLanguage !== "zh-CN"
    || fallbackListLanguage.metaLanguage !== "en"
    || fallbackListLanguage.labelledBy !== fallbackListLanguage.titleId
    || !fallbackListLanguage.titleText
    || fallbackListLanguage.tagCount < 3
    || !fallbackListLanguage.fallbackLabel) {
    fallbackFailures.push(`fallback article list-card semantics are incomplete: ${JSON.stringify(fallbackListLanguage)}`);
  }
  if (fallbackLanguage.document !== "en"
    || fallbackLanguage.title !== "zh-CN"
    || fallbackLanguage.body !== "zh-CN"
    || fallbackLanguage.tocList !== "zh-CN"
    || !fallbackLanguage.tocLinks.length
    || fallbackLanguage.tocLinks.some((value) => value !== "zh-CN")
    || fallbackLanguage.tocNavLanguage !== "en"
    || !fallbackLanguage.tocNavLabel) {
    fallbackFailures.push(`fallback article language semantics are incomplete: ${JSON.stringify(fallbackLanguage)}`);
  }
  results.push({
    kind: "metadata",
    name: "article-fallback-language-en-to-zh",
    shell: viewport.mobile ? "mobile" : "desktop",
    viewport,
    lang: "en",
    fallbackListLanguage,
    fallbackLanguage,
    failures: fallbackFailures,
    status: fallbackFailures.length ? "FAIL" : "PASS"
  });
  return results;
}

async function auditModalIsolation(client, origin, viewport, { lang, kind, motion, output }) {
  await emulate(client, viewport);
  if (motion === "full") {
    await client.send("Emulation.setEmulatedMedia", { media: "screen", features: [{ name: "prefers-reduced-motion", value: "no-preference" }, { name: "prefers-color-scheme", value: "light" }] });
  }
  const modalId = kind === "welcome" ? "welcome-modal" : "video-modal";
  const route = kind === "welcome" ? "home" : "videos";
  const welcome = kind === "welcome" ? "1" : "0";
  await client.send("Page.navigate", { url: `${origin}/?lang=${lang}&wallpaper=${fixedTheme}&welcome=${welcome}#${route}` });
  await stable(client, route);
  await evaluate(client, `window.LusuUiMotion?.setMode?.(${JSON.stringify(motion)}); true`);
  if (kind === "welcome") {
    await waitFor(client, `document.getElementById('welcome-modal')?.hidden===false`, "welcome modal open");
  } else {
    await waitFor(client, `Boolean(document.querySelector('.card-action[data-video-id="${auditVideo.video_id}"]'))`, "controlled video trigger");
    await evaluate(client, `(() => { const trigger=document.querySelector('.card-action[data-video-id="${auditVideo.video_id}"]'); window.__auditVideoModalTrigger=trigger; trigger.focus({preventScroll:true}); trigger.click(); return true; })()`);
    await waitFor(client, `document.getElementById('video-modal')?.hidden===false`, "video modal open");
  }

  const open = await evaluate(client, `(() => {
    const surface=document.getElementById(${JSON.stringify(modalId)});
    const dialog=surface?.querySelector('[role="dialog"]');
    const close=surface?.querySelector(${JSON.stringify(kind === "welcome" ? "button[data-close-welcome]" : "button[data-close-modal]")});
    const rect=close?.getBoundingClientRect();
    const roots=[...document.querySelectorAll('[data-modal-background]')];
    return {
      hidden:surface?.hidden,
      closing:surface?.getAttribute('data-ui-closing')||'',
      backgroundCount:roots.length,
      backgroundsInert:roots.every((item)=>item.inert),
      dialogTabIndex:dialog?.getAttribute('tabindex')||'',
      activeInside:Boolean(dialog?.contains(document.activeElement)),
      closeRect:rect?{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height}:null
    };
  })()`);
  const connectionStatusAccessibleName = await evaluate(client, `document.getElementById("site-connection-status")?.getAttribute("aria-label") || ""`);
  const axTree = await client.send("Accessibility.getFullAXTree");
  const backgroundExposed = Boolean(connectionStatusAccessibleName)
    && (axTree.nodes || []).some((node) => !node.ignored && String(node.name?.value || "").trim() === connectionStatusAccessibleName);
  const screenshotFile = `modal-${kind}-${lang}-${viewport.width}x${viewport.height}.png`;
  const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(resolve(output, screenshotFile), Buffer.from(screenshot.data, "base64"));

  await evaluate(client, `(() => { const dialog=document.getElementById(${JSON.stringify(modalId)})?.querySelector('[role="dialog"]'); const items=focusableDialogElements(dialog); window.__auditModalFirst=items[0]; window.__auditModalLast=items.at(-1); items[0]?.focus({preventScroll:true}); return items.length; })()`);
  await client.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers: 8 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers: 8 });
  const shiftWrapped = await evaluate(client, `document.activeElement===window.__auditModalLast`);
  await client.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  const tabWrapped = await evaluate(client, `document.activeElement===window.__auditModalFirst`);
  const backgroundFocusBlocked = await evaluate(client, `(() => { const before=document.activeElement; document.querySelector('.brand-button')?.focus({preventScroll:true}); return document.activeElement===before; })()`);

  await client.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  const immediateClose = await evaluate(client, `(() => { const surface=document.getElementById(${JSON.stringify(modalId)}); const roots=[...document.querySelectorAll('[data-modal-background]')]; return { hidden:surface?.hidden, closing:surface?.getAttribute('data-ui-closing')||'', backgroundsInert:roots.every((item)=>item.inert) }; })()`);
  await waitFor(client, `document.getElementById(${JSON.stringify(modalId)})?.hidden===true`, `${kind} modal Escape close`);
  const closed = await evaluate(client, `(() => { const surface=document.getElementById(${JSON.stringify(modalId)}); const roots=[...document.querySelectorAll('[data-modal-background]')]; return { hidden:surface?.hidden, closing:surface?.getAttribute('data-ui-closing')||'', backgroundsReleased:roots.every((item)=>!item.inert), focusId:document.activeElement?.id||'', focusIsTrigger:${kind === "video" ? "document.activeElement===window.__auditVideoModalTrigger" : "false"} }; })()`);

  const failures = [];
  if (open.hidden !== false || open.backgroundCount !== 2 || !open.backgroundsInert || open.dialogTabIndex !== "-1" || !open.activeInside) failures.push(`open isolation is wrong: ${JSON.stringify(open)}`);
  if (backgroundExposed) failures.push("inert background remained exposed in the accessibility tree");
  if (!shiftWrapped || !tabWrapped) failures.push(`dialog focus did not wrap in both directions: ${JSON.stringify({ shiftWrapped, tabWrapped })}`);
  if (!backgroundFocusBlocked) failures.push("programmatic focus escaped into the inert background");
  if (viewport.mobile && (!open.closeRect || open.closeRect.width < 44 || open.closeRect.height < 44 || open.closeRect.left < 0 || open.closeRect.top < 0 || open.closeRect.right > viewport.width || open.closeRect.bottom > viewport.height)) failures.push(`mobile close target is invalid: ${JSON.stringify(open.closeRect)}`);
  if (motion === "full") {
    if (immediateClose.hidden !== false || immediateClose.closing !== "true" || !immediateClose.backgroundsInert) failures.push(`full-motion close released isolation before commit: ${JSON.stringify(immediateClose)}`);
  } else if (immediateClose.hidden !== true || immediateClose.closing || immediateClose.backgroundsInert) {
    failures.push(`reduced/off close was not immediate: ${JSON.stringify(immediateClose)}`);
  }
  if (!closed.hidden || closed.closing || !closed.backgroundsReleased) failures.push(`closed isolation is wrong: ${JSON.stringify(closed)}`);
  if (kind === "video" ? !closed.focusIsTrigger : closed.focusId !== "home-title") failures.push(`${kind} modal focus restoration is wrong: ${JSON.stringify(closed)}`);
  return { kind: "modal", name: `${kind}-${motion}-${lang}`, shell: viewport.mobile ? "mobile" : "desktop", viewport, lang, screenshotFile, open, immediateClose, closed, shiftWrapped, tabWrapped, backgroundFocusBlocked, backgroundExposed, failures, status: failures.length ? "FAIL" : "PASS" };
}

async function auditRouteLifecycle(client, origin, viewport) {
  await emulate(client, viewport);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0`, `route-lifecycle-${viewport.width}x${viewport.height}`);
  await stable(client, "home");
  await evaluate(client, `(() => {
    const nativeFetch = window.fetch.bind(window);
    window.__auditNativeFetch = nativeFetch;
    const held = [
      (path) => path === '/api/articles',
      (path) => path === '/api/videos',
      (path) => path === '/games/catalog.json',
      (path) => path === '/api/social-links',
      (path) => path === '/api/transfer/config'
    ];
    window.__auditLifecycleFetch = { started: [], aborted: [] };
    window.fetch = (input, init = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if (!held.some((matches) => matches(url.pathname))) return nativeFetch(input, init);
      window.__auditLifecycleFetch.started.push(url.pathname);
      return new Promise((resolve, reject) => {
        const signal = init?.signal;
        const abort = () => {
          window.__auditLifecycleFetch.aborted.push(url.pathname);
          reject(new DOMException('Audit route leave', 'AbortError'));
        };
        if (signal?.aborted) abort();
        else signal?.addEventListener('abort', abort, { once: true });
      });
    };
    try {
      localStorage.removeItem('lusu-chat-nickname');
    } catch {}
    return true;
  })()`);

  const settle = () => evaluate(client, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => queueMicrotask(resolve))))`);
  const routeSnapshots = [];
  const failures = [];
  for (const route of auditRoutes) {
    await evaluate(client, `navigate(${JSON.stringify(route)}, { motion:false, focusWindow:false }); true`);
    await waitFor(client, `document.body.dataset.route===${JSON.stringify(route)}&&window.__lusuRouteLifecycleAudit?.().activeRoute===${JSON.stringify(route)}`, `${route} lifecycle enter`);
    if (route === "resources") {
      await waitFor(client, `window.__lusuRouteModulesAudit?.().resources==='ready'`, "Resources route module");
      await openQuickTransferFromCta(client);
      await waitFor(client, `window.QuickTransfer?.lifecycleSnapshot?.().requests===1`, "Transfer held request");
    } else if (["knowledge", "videos", "games", "about"].includes(route)) {
      await waitFor(client, `window.__lusuRouteLifecycleAudit?.().routes?.[${JSON.stringify(route)}]?.requests===1`, `${route} held request`);
    } else if (route === "chatroom") {
      await waitFor(client, `window.__lusuRouteLifecycleAudit?.().routes?.chatroom?.timers===1`, "Chat lifecycle timer");
    }
    await settle();
    const before = await evaluate(client, `({ main:window.__lusuRouteLifecycleAudit?.(), transfer:window.QuickTransfer?.lifecycleSnapshot?.()||null })`);
    await evaluate(client, `navigate(${JSON.stringify(route)}, { motion:false, focusWindow:false }); true`);
    await settle();
    const after = await evaluate(client, `({ main:window.__lusuRouteLifecycleAudit?.(), transfer:window.QuickTransfer?.lifecycleSnapshot?.()||null })`);
    const active = after.main?.routes?.[route];
    if (after.main?.activeRoute !== route || !active?.active || active?.abortControllers !== 1) {
      failures.push(`${route} active lifecycle is wrong: ${JSON.stringify(after.main)}`);
    }
    if (before.main?.routes?.[route]?.enterCount !== active?.enterCount
      || before.main?.routes?.[route]?.listeners !== active?.listeners) {
      failures.push(`${route} same-route navigation duplicated lifecycle resources`);
    }
    for (const inactiveRoute of auditRoutes.filter((item) => item !== route)) {
      const inactive = after.main?.routes?.[inactiveRoute];
      if (inactive?.active || inactive?.listeners || inactive?.observers || inactive?.timers
        || inactive?.frames || inactive?.requests || inactive?.abortControllers) {
        failures.push(`${route} retained inactive ${inactiveRoute} resources: ${JSON.stringify(inactive)}`);
      }
    }
    if (route !== "resources" && after.transfer && (after.transfer.routeActive || after.transfer.listeners || after.transfer.timers || after.transfer.requests || after.transfer.xhr)) {
      failures.push(`${route} retained inactive Transfer resources: ${JSON.stringify(after.transfer)}`);
    }
    if (route === "resources" && (!after.transfer?.routeActive || after.transfer.listeners < 1 || after.transfer.requests !== 1)) {
      failures.push(`Resources Transfer lifecycle is wrong: ${JSON.stringify(after.transfer)}`);
    }
    routeSnapshots.push({ route, before, after });
  }

  await evaluate(client, `navigate('home', { motion:false, focusWindow:false }); true`);
  await waitFor(client, `window.__lusuRouteLifecycleAudit?.().activeRoute==='home'`, "final Home lifecycle");
  await settle();
  const finalState = await evaluate(client, `({ main:window.__lusuRouteLifecycleAudit?.(), transfer:window.QuickTransfer?.lifecycleSnapshot?.()||null, fetch:window.__auditLifecycleFetch })`);
  await evaluate(client, `(() => { if (window.__auditNativeFetch) window.fetch = window.__auditNativeFetch; return true; })()`);
  for (const route of auditRoutes.filter((item) => item !== "home")) {
    const inactive = finalState.main?.routes?.[route];
    if (inactive?.active || inactive?.listeners || inactive?.observers || inactive?.timers
      || inactive?.frames || inactive?.requests || inactive?.abortControllers) {
      failures.push(`final Home retained ${route} resources: ${JSON.stringify(inactive)}`);
    }
  }
  const expectedAborts = ["/api/articles", "/api/videos", "/api/transfer/config", "/games/catalog.json", "/api/social-links"];
  for (const path of expectedAborts) {
    if (!finalState.fetch?.started?.includes(path) || !finalState.fetch?.aborted?.includes(path)) {
      failures.push(`route-scoped request was not started and aborted: ${path}`);
    }
  }
  if (finalState.transfer && (finalState.transfer.routeActive || finalState.transfer.listeners || finalState.transfer.timers || finalState.transfer.requests || finalState.transfer.xhr)) {
    failures.push(`final Home retained Transfer resources: ${JSON.stringify(finalState.transfer)}`);
  }
  return {
    kind: "lifecycle",
    name: "all-routes-enter-leave",
    shell: viewport.mobile ? "mobile" : "desktop",
    viewport,
    routeSnapshots,
    finalState,
    failures,
    status: failures.length ? "FAIL" : "PASS"
  };
}

async function auditRouteExitFocus(client, origin, viewport) {
  await emulate(client, viewport);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#audit-focus-exit`, `route-exit-focus-${viewport.width}x${viewport.height}`);
  await stable(client, "home");
  const stages = [];
  const run = async (name, selector) => {
    await setAuditRoute(client, "knowledge");
    await evaluate(client, `window.__auditFocusEvents=[]; document.querySelector(${JSON.stringify(selector)})?.click(); true`);
    await waitFor(client, `document.body.dataset.route==='home'&&document.activeElement?.id==='home-title'`, `${name} Home title focus`);
    const state = await evaluate(client, `({ route:document.body.dataset.route, focusId:document.activeElement?.id||'', focusEvents:[...(window.__auditFocusEvents||[])] })`);
    const failures = [];
    if (state.focusId !== "home-title") failures.push(`${name} focus ${state.focusId || "<empty>"} !== home-title`);
    if (JSON.stringify(state.focusEvents) !== JSON.stringify(["home-title"])) failures.push(`${name} focus events ${JSON.stringify(state.focusEvents)} !== [home-title]`);
    stages.push({ name, state, failures });
  };
  if (viewport.mobile) {
    await run("mobile-home", ".mobile-home-button");
  } else {
    await run("close", "#knowledge .close-button");
  }
  const failures = stages.flatMap((stage) => stage.failures);
  return { kind: "focus", name: "route-exit", shell: viewport.mobile ? "mobile" : "desktop", viewport, stages, failures, status: failures.length ? "FAIL" : "PASS" };
}

async function auditArticleFocusHistory(client, origin, viewport) {
  await emulate(client, viewport);
  const navigationNonce = `${viewport.width}x${viewport.height}-${Date.now()}`;
  await client.send("Page.navigate", { url: `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0&audit-article-history=${navigationNonce}#knowledge` });
  await stable(client, "knowledge");
  await installFocusRecorder(client);
  try {
    await waitFor(client, `document.querySelectorAll('#knowledge-list [data-article-slug]').length===12&&Boolean(document.querySelector('#knowledge-list [data-article-load-more]'))`, "segmented controlled article list");
  } catch (error) {
    const debug = await evaluate(client, `(() => {
      const list=document.getElementById('knowledge-list');
      const moduleState=window.__lusuRouteModulesAudit?.()||null;
      const lifecycle=window.__lusuRouteLifecycleAudit?.()||null;
      return {
        url:location.href,
        readyState:document.readyState,
        route:document.body.dataset.route||'',
        moduleState:moduleState?.knowledge||'',
        activeLifecycleRoute:lifecycle?.activeRoute||'',
        knowledgeLifecycle:lifecycle?.routes?.knowledge||null,
        listHidden:list?.hidden ?? null,
        listCardCount:list?.querySelectorAll('[data-article-slug]').length||0,
        globalCardCount:document.querySelectorAll('[data-article-slug]').length,
        loadMore:Boolean(list?.querySelector('[data-article-load-more]')),
        listText:list?.textContent?.trim().slice(0,240)||'',
        runtimeErrors:[...(window.__auditRuntimeErrors||[]).slice(-5)]
      };
    })()`);
    throw new Error(`${error.message}; state: ${JSON.stringify(debug)}`);
  }
  await evaluate(client, `document.querySelector('#knowledge-list [data-article-load-more]')?.click(); true`);
  await waitFor(client, `document.querySelectorAll('#knowledge-list [data-article-slug]').length>=15&&!document.querySelector('#knowledge-list [data-article-load-more]')`, "continued controlled article list");
  await waitFrames(client, 3);
  const progressive = await evaluate(client, `(() => { const list=document.getElementById('knowledge-list'); const cards=[...list.querySelectorAll('[data-article-slug]')]; const first=cards[0]; const published=first?.querySelector('time'); const allButton=document.querySelector('.category-button[data-filter="all"]'); return { count:cards.length, focusPosition:document.activeElement?.dataset?.articleListPosition||'', filter:document.querySelector('.category-button.active')?.dataset.filter||'', search:document.getElementById('knowledge-search-input')?.value||'', firstSlug:first?.dataset.articleSlug||'', pinned:first?.querySelector('.article-pinned-badge')?.textContent?.trim()||'', publishedText:published?.textContent?.trim()||'', publishedTitle:published?.title||'', updateLeak:cards.some((card)=>card.dataset.articleSlug==='${article.slug}'||card.dataset.articleSlug.startsWith('audit-update-')), allCount:Number(allButton?.querySelector('.filter-count')?.textContent||-1) }; })()`);
  const source = await evaluate(client, `(async () => {
    document.querySelector('.category-button[data-filter="site-updates"]')?.click();
    const input=document.getElementById('knowledge-search-input');
    const beforeSearchCard=document.querySelector('#knowledge-list [data-article-slug]');
    input.value='审计';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    const immediateCard=document.querySelector('#knowledge-list [data-article-slug]');
    await new Promise(ok=>setTimeout(ok,60));
    const earlyCard=document.querySelector('#knowledge-list [data-article-slug]');
    await new Promise(ok=>setTimeout(ok,160));
    await new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)));
    const appliedCard=document.querySelector('#knowledge-list [data-article-slug]');
    const list=document.getElementById('knowledge-list');
    const maxScroll=Math.max(0,list.scrollHeight-list.clientHeight);
    list.scrollTop=Math.min(180,maxScroll);
    list.dispatchEvent(new Event('scroll'));
    await new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)));
    const nav=history.state?.lusuPublicState;
    const cards=[...list.querySelectorAll('[data-article-slug]')];
    return { filter:document.querySelector('.category-button.active')?.dataset.filter||'', search:input.value, scrollTop:list.scrollTop, maxScroll, focusId:document.activeElement?.id||'', state:nav, debounceHeld:beforeSearchCard===immediateCard&&beforeSearchCard===earlyCard, debounceApplied:beforeSearchCard!==appliedCard, cardCount:cards.length, updatesOnly:cards.every((card)=>card.dataset.articleSlug==='${article.slug}'||card.dataset.articleSlug.startsWith('audit-update-')) };
  })()`);
  await evaluate(client, `(() => { window.__auditFocusEvents=[]; document.querySelector('#knowledge-list [data-article-slug=${article.slug}]')?.click(); return true; })()`);
  try {
    await waitFor(client, `!document.getElementById('article-detail')?.hidden&&document.getElementById('article-detail-title')?.textContent===${JSON.stringify(article.title)}&&document.activeElement?.id==='article-detail-title'`, "article detail focus");
  } catch (error) {
    const debug = await evaluate(client, `({
      route:document.body.dataset.route||'',
      path:location.pathname,
      hash:location.hash,
      targetCount:document.querySelectorAll('#knowledge-list [data-article-slug=${article.slug}]').length,
      listHidden:document.getElementById('knowledge-list')?.hidden,
      detailHidden:document.getElementById('article-detail')?.hidden,
      detailTitle:document.getElementById('article-detail-title')?.textContent||'',
      detailChildren:document.getElementById('article-detail-body')?.childElementCount||0,
      activeId:document.activeElement?.id||'',
      focusEvents:[...(window.__auditFocusEvents||[])],
      state:history.state?.lusuPublicState||null
    })`);
    throw new Error(`${error.message}; state: ${JSON.stringify(debug)}`);
  }
  const opened = await evaluate(client, `(async()=>{ const detail=document.getElementById('article-detail'); const maxScroll=Math.max(0,detail.scrollHeight-detail.clientHeight); detail.scrollTop=Math.min(120,maxScroll); detail.dispatchEvent(new Event('scroll')); await new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))); return { path:location.pathname, focusId:document.activeElement?.id||'', focusEvents:[...(window.__auditFocusEvents||[])], scrollTop:detail.scrollTop, maxScroll, state:history.state?.lusuPublicState }; })()`);

  await evaluate(client, `window.__auditFocusEvents=[]; document.querySelector('[data-article-back]')?.click(); true`);
  await waitFor(client, `document.getElementById('knowledge-list')?.hidden===false&&document.getElementById('article-detail')?.hidden===true&&document.activeElement?.id==='knowledge-title'&&document.getElementById('knowledge-search-input')?.value==='审计'`, "article in-app Back restoration");
  const list = await evaluate(client, `({ path:location.pathname, hash:location.hash, filter:document.querySelector('.category-button.active')?.dataset.filter||'', search:document.getElementById('knowledge-search-input')?.value||'', scrollTop:document.getElementById('knowledge-list')?.scrollTop||0, focusId:document.activeElement?.id||'', focusEvents:[...(window.__auditFocusEvents||[])], state:history.state?.lusuPublicState })`);

  await evaluate(client, `window.__auditFocusEvents=[]; history.forward(); true`);
  await waitFor(client, `!document.getElementById('article-detail')?.hidden&&document.activeElement?.id==='article-detail-title'`, "cached article history Forward focus");
  const forward = await evaluate(client, `({ path:location.pathname, focusId:document.activeElement?.id||'', focusEvents:[...(window.__auditFocusEvents||[])], scrollTop:document.getElementById('article-detail')?.scrollTop||0, state:history.state?.lusuPublicState })`);

  await evaluate(client, `window.__auditFocusEvents=[]; history.back(); true`);
  await waitFor(client, `document.getElementById('knowledge-list')?.hidden===false&&document.activeElement?.id==='knowledge-title'&&document.getElementById('knowledge-search-input')?.value==='审计'`, "article browser Back restoration");
  const back = await evaluate(client, `({ path:location.pathname, hash:location.hash, filter:document.querySelector('.category-button.active')?.dataset.filter||'', search:document.getElementById('knowledge-search-input')?.value||'', scrollTop:document.getElementById('knowledge-list')?.scrollTop||0, focusId:document.activeElement?.id||'', focusEvents:[...(window.__auditFocusEvents||[])], state:history.state?.lusuPublicState })`);

  const failures = [];
  if (progressive.count !== 15 || progressive.focusPosition !== "12" || progressive.filter !== "all" || progressive.search) failures.push(`segmented load lost list context or focus: ${JSON.stringify(progressive)}`);
  if (progressive.updateLeak || progressive.allCount !== 15) failures.push(`All exposed Site Updates or counted them: ${JSON.stringify(progressive)}`);
  if (progressive.firstSlug !== "audit-layout-14" || !progressive.pinned || /:\d{2}:\d{2}$/.test(progressive.publishedText) || !/:\d{2}:\d{2}$/.test(progressive.publishedTitle)) failures.push(`article ordering/date presentation is wrong: ${JSON.stringify(progressive)}`);
  if (source.filter !== "site-updates" || !source.updatesOnly || source.cardCount < 1) failures.push(`Site Updates dedicated tab filtering is wrong: ${JSON.stringify(source)}`);
  if (!source.debounceHeld || !source.debounceApplied) failures.push(`Knowledge search did not apply one delayed render: ${JSON.stringify(source)}`);
  for (const [name, state, focusId] of [["open", opened, "article-detail-title"], ["in-app-back", list, "knowledge-title"], ["history-forward-cache", forward, "article-detail-title"], ["history-back", back, "knowledge-title"]]) {
    if (state.focusId !== focusId) failures.push(`${name} focus ${state.focusId || "<empty>"} !== ${focusId}`);
    if (JSON.stringify(state.focusEvents) !== JSON.stringify([focusId])) failures.push(`${name} focus events ${JSON.stringify(state.focusEvents)} !== [${focusId}]`);
  }
  if (source.maxScroll <= 0 || source.scrollTop <= 0) failures.push(`fixture did not create nonzero list scroll: ${JSON.stringify(source)}`);
  if (opened.maxScroll <= 0 || opened.scrollTop <= 0) failures.push(`fixture did not create nonzero article scroll: ${JSON.stringify(opened)}`);
  for (const [name, state] of [["in-app-back", list], ["history-back", back]]) {
    if (state.filter !== source.filter || state.search !== source.search || Math.abs(state.scrollTop - source.scrollTop) > 1) failures.push(`${name} did not restore list context: ${JSON.stringify({ source, state })}`);
    if (state.focusId === "knowledge-search-input") failures.push(`${name} automatically focused search`);
    if (state.state?.version !== 1 || state.state?.route !== "knowledge" || state.state?.articleSlug || state.state?.knowledge?.searchTerm !== source.search) failures.push(`${name} history state is wrong: ${JSON.stringify(state.state)}`);
  }
  if (opened.state?.articleReturnMode !== "history" || opened.state?.articleSlug !== article.slug) failures.push(`article source state is wrong: ${JSON.stringify(opened.state)}`);
  if (forward.state?.articleSlug !== article.slug || Math.abs(forward.scrollTop - opened.scrollTop) > 16) failures.push(`Forward did not restore article context: ${JSON.stringify({ opened, forward })}`);
  if (opened.path !== `/articles/${article.slug}` || forward.path !== `/articles/${article.slug}`) failures.push(`article URL projection is wrong: ${opened.path}, ${forward.path}`);
  if (back.path !== "/" || back.hash !== "#knowledge" || list.path !== "/" || list.hash !== "#knowledge") failures.push(`article list URL projection is wrong: ${JSON.stringify({ back, list })}`);
  return { kind: "focus", name: "article-history", shell: viewport.mobile ? "mobile" : "desktop", viewport, progressive, source, opened, list, forward, back, failures, status: failures.length ? "FAIL" : "PASS" };
}

async function auditDirectArticleReturn(client, origin, viewport) {
  await emulate(client, viewport);
  await navigateFresh(client, `${origin}/articles/${article.slug}?lang=zh&wallpaper=${fixedTheme}&welcome=0`, `direct-article-return-${viewport.width}x${viewport.height}`);
  await stable(client, "article");
  await installFocusRecorder(client);
  const direct = await evaluate(client, `({ path:location.pathname, historyLength:history.length, state:history.state?.lusuPublicState })`);
  await evaluate(client, `window.__auditFocusEvents=[]; document.querySelector('[data-article-back]')?.click(); true`);
  await waitFor(client, `location.pathname==='/'&&location.hash==='#knowledge'&&document.getElementById('knowledge-list')?.hidden===false&&document.activeElement?.id==='knowledge-title'`, "direct article default Knowledge return");
  const list = await evaluate(client, `({ path:location.pathname, hash:location.hash, historyLength:history.length, filter:document.querySelector('.category-button.active')?.dataset.filter||'', search:document.getElementById('knowledge-search-input')?.value||'', scrollTop:document.getElementById('knowledge-list')?.scrollTop||0, focusId:document.activeElement?.id||'', focusEvents:[...(window.__auditFocusEvents||[])], state:history.state?.lusuPublicState })`);
  const listMeta = await readDocumentMeta(client);
  const replacedEntryId = list.state?.entryId || "";
  await evaluate(client, `history.back(); true`);
  await waitFor(
    client,
    `Boolean(history.state?.lusuPublicState?.entryId)&&history.state.lusuPublicState.entryId!==${JSON.stringify(replacedEntryId)}`,
    "direct article replacement history Back"
  );
  const afterBrowserBack = await evaluate(client, `({ path:location.pathname, hash:location.hash, entryId:history.state?.lusuPublicState?.entryId||'' })`);
  const failures = [];
  if (direct.state?.articleReturnMode !== "default" || direct.state?.articleSlug !== article.slug) failures.push(`direct article state is wrong: ${JSON.stringify(direct.state)}`);
  if (list.path !== "/" || list.hash !== "#knowledge" || list.filter !== "all" || list.search || list.scrollTop !== 0) failures.push(`direct return is not default Knowledge: ${JSON.stringify(list)}`);
  if (list.historyLength !== direct.historyLength) failures.push(`direct return pushed a history entry: ${direct.historyLength} -> ${list.historyLength}`);
  if (list.focusId !== "knowledge-title" || JSON.stringify(list.focusEvents) !== JSON.stringify(["knowledge-title"])) failures.push(`direct return focus is wrong: ${JSON.stringify(list)}`);
  failures.push(...metadataFailures(listMeta, {
    documentTitle: "知识库 | 鲁肃的个人站",
    canonical: "https://lusu575.com/?lang=zh#knowledge",
    ogType: "website",
    ogSiteName: "鲁肃的个人站",
    ogTitle: "知识库",
    ogUrl: "https://lusu575.com/?lang=zh#knowledge",
    ogImage: "https://lusu575.com/assets/images/homepage-pixel-coast.png?v=20260612-hd-wallpapers",
    ogImageWidth: "1672",
    ogImageHeight: "941",
    ogLocale: "zh_CN",
    twitterCard: "summary_large_image"
  }));
  if (listMeta.description === article.summary || listMeta.ogImage === `https://lusu575.com/${article.cover_image}`) failures.push("direct return retained article metadata");
  if (afterBrowserBack.path === `/articles/${article.slug}`) failures.push("browser Back re-entered the replaced direct article");
  return { kind: "history", name: "direct-article-return", shell: viewport.mobile ? "mobile" : "desktop", viewport, direct, list, listMeta, afterBrowserBack, failures, status: failures.length ? "FAIL" : "PASS" };
}

async function auditMalformedHistoryState(client, origin, viewport) {
  await emulate(client, viewport);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#knowledge`, `malformed-history-state-${viewport.width}x${viewport.height}`);
  await stable(client, "knowledge");
  await installFocusRecorder(client);
  const state = await evaluate(client, `(() => {
    history.replaceState({ externalSentinel:'keep', lusuPublicState:{ version:999, entryId:'bad', route:'videos', articleSlug:'../bad', knowledge:{ category:'!!', searchTerm:'x'.repeat(500), scrollTop:Infinity }, articleScrollTop:-20, articleReturnMode:'history' } },'',location.href);
    syncRouteFromLocation({focusWindow:true});
    return { root:history.state, focusId:document.activeElement?.id||'', inputValue:document.getElementById('knowledge-search-input')?.value||'' };
  })()`);
  await evaluate(client, `new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)))`);
  const settled = await evaluate(client, `({ root:history.state, focusId:document.activeElement?.id||'', inputValue:document.getElementById('knowledge-search-input')?.value||'', filter:document.querySelector('.category-button.active')?.dataset.filter||'', scrollTop:document.getElementById('knowledge-list')?.scrollTop||0 })`);
  const nav = settled.root?.lusuPublicState;
  const failures = [];
  if (settled.root?.externalSentinel !== "keep") failures.push("history normalization dropped an external root field");
  if (nav?.version !== 1 || nav?.route !== "knowledge" || nav?.articleSlug || nav?.knowledge?.category !== "all" || nav?.knowledge?.searchTerm || nav?.knowledge?.scrollTop !== 0 || nav?.articleScrollTop !== 0) failures.push(`malformed history did not reset safely: ${JSON.stringify(nav)}`);
  if (settled.inputValue || settled.filter !== "all" || settled.scrollTop !== 0) failures.push(`malformed history affected visible Knowledge state: ${JSON.stringify(settled)}`);
  if (settled.focusId !== "knowledge-title") failures.push(`malformed history focus ${settled.focusId || "<empty>"} !== knowledge-title`);
  return { kind: "history", name: "malformed-history-state", shell: viewport.mobile ? "mobile" : "desktop", viewport, state, settled, failures, status: failures.length ? "FAIL" : "PASS" };
}

function caretIsTransparent(value) {
  return value === "transparent" || /^rgba\([^\)]*,\s*0(?:\.0+)?\)$/.test(String(value).replaceAll(" ", ""));
}

async function auditTransferCaret(client, origin, viewport) {
  await emulate(client, viewport);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#resources`, `transfer-caret-${viewport.width}x${viewport.height}`);
  await stable(client, "resources");
  await openQuickTransferFromCta(client);
  const prepare = async (id, value, start, end) => evaluate(client, `(() => {
    document.getElementById('transfer-app').hidden=false;
    document.getElementById('transfer-room-entry').hidden=false;
    document.getElementById('transfer-room').hidden=false;
    const editor=document.getElementById(${JSON.stringify(id)});
    editor.value=${JSON.stringify(value)};
    editor.focus({preventScroll:true});
    editor.setSelectionRange(${start},${end});
    return { id:editor.id, active:document.activeElement===editor, caretColor:getComputedStyle(editor).caretColor, value:editor.value };
  })()`);
  const passwordBefore = await prepare("transfer-room-password", "abcdef", 2, 4);
  await client.send("Input.insertText", { text: "XY" });
  await client.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
  const passwordAfter = await evaluate(client, `(() => { const editor=document.getElementById('transfer-room-password'); return { active:document.activeElement===editor, caretColor:getComputedStyle(editor).caretColor, value:editor.value }; })()`);

  const composerBefore = await prepare("transfer-text-input", "hello", 1, 4);
  await client.send("Input.insertText", { text: "Z" });
  await client.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
  const composerAfter = await evaluate(client, `(() => { const editor=document.getElementById('transfer-text-input'); return { active:document.activeElement===editor, caretColor:getComputedStyle(editor).caretColor, value:editor.value }; })()`);
  const failures = [];
  if (!passwordBefore.active || !passwordAfter.active) failures.push("Transfer password input did not retain focus");
  if (caretIsTransparent(passwordBefore.caretColor) || caretIsTransparent(passwordAfter.caretColor)) failures.push(`Transfer password caret is transparent: ${passwordAfter.caretColor}`);
  if (passwordAfter.value !== "abXef") failures.push(`Transfer password edit result ${passwordAfter.value} !== abXef`);
  if (!composerBefore.active || !composerAfter.active) failures.push("Transfer composer did not retain focus");
  if (caretIsTransparent(composerBefore.caretColor) || caretIsTransparent(composerAfter.caretColor)) failures.push(`Transfer composer caret is transparent: ${composerAfter.caretColor}`);
  if (composerAfter.value !== "ho") failures.push(`Transfer composer edit result ${composerAfter.value} !== ho`);
  return { kind: "caret", name: "quick-transfer-editing", shell: viewport.mobile ? "mobile" : "desktop", viewport, passwordBefore, passwordAfter, composerBefore, composerAfter, failures, status: failures.length ? "FAIL" : "PASS" };
}

function pipelineCounter(snapshot, name) {
  return Number(snapshot?.[name] ?? snapshot?.counters?.[name] ?? snapshot?.totals?.[name] ?? 0);
}

async function installScrollOwnerHarness(client) {
  await client.send("Page.bringToFront");
  await evaluate(client, `(() => {
    window.__auditScrollOwnerHarness?.cleanup?.();
    const events = [];
    const scrollingElement = document.scrollingElement || document.documentElement;
    const round = (value) => Math.round(Number(value || 0) * 100) / 100;
    const describe = (element) => {
      if (!element) return '<none>';
      if (element === scrollingElement || element === document.documentElement || element === document.body) return 'document';
      if (element.id) return '#' + CSS.escape(element.id);
      const page = element.closest?.('.page[id]');
      const classes = [...(element.classList || [])].slice(0, 3).map((name) => '.' + CSS.escape(name)).join('');
      return (page ? '#' + CSS.escape(page.id) + ' ' : '') + (classes || element.tagName.toLowerCase());
    };
    const isVerticalOwner = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const overflow = getComputedStyle(element).overflowY;
      return /(auto|scroll|overlay)/.test(overflow) && element.scrollHeight > element.clientHeight + 1;
    };
    const nearestOwner = (target) => {
      for (let element = target?.parentElement; element && element !== document.body && element !== document.documentElement; element = element.parentElement) {
        if (isVerticalOwner(element)) return element;
      }
      return scrollingElement;
    };
    const onScroll = (event) => {
      const rawTarget = event.target === document ? scrollingElement : event.target;
      if (!(rawTarget instanceof Element)) return;
      events.push({ owner:describe(rawTarget), scrollTop:round(rawTarget.scrollTop), scrollLeft:round(rawTarget.scrollLeft), at:round(performance.now()) });
    };
    document.addEventListener('scroll', onScroll, true);
    const nextFrames = (count = 3) => new Promise((resolve) => {
      const step = () => count-- > 0 ? requestAnimationFrame(step) : setTimeout(resolve, 30);
      requestAnimationFrame(step);
    });
    const documentPosition = () => ({
      windowY:round(window.scrollY),
      scrollingTop:round(scrollingElement.scrollTop),
      bodyTop:round(document.body.scrollTop)
    });
    const measure = (target, owner) => {
      const targetRect = target.getBoundingClientRect();
      const ownerRect = owner === scrollingElement
        ? { top:0, bottom:innerHeight, left:0, right:innerWidth, width:innerWidth, height:innerHeight }
        : owner.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop || 0;
      const viewportBottom = viewportTop + (viewport?.height || innerHeight);
      const visibleTop = Math.max(viewportTop, ownerRect.top);
      const visibleBottom = Math.min(viewportBottom, ownerRect.bottom);
      const positiveEvents = events.filter((item) => item.scrollTop > .5);
      const ancestors = [];
      for (let element = target.parentElement; element && element !== document.body && element !== document.documentElement; element = element.parentElement) {
        const style = getComputedStyle(element);
        ancestors.push({ owner:describe(element), overflowY:style.overflowY, clientHeight:round(element.clientHeight), scrollHeight:round(element.scrollHeight), scrollTop:round(element.scrollTop) });
      }
      return {
        target:describe(target),
        owner:describe(owner),
        ownerInternal:owner !== scrollingElement && owner !== document.documentElement && owner !== document.body,
        ownerOverflowY:owner === scrollingElement ? getComputedStyle(scrollingElement).overflowY : getComputedStyle(owner).overflowY,
        ownerScrollTop:round(owner.scrollTop),
        ownerMaxScroll:round(Math.max(0, owner.scrollHeight - owner.clientHeight)),
        targetRect:{ top:round(targetRect.top), bottom:round(targetRect.bottom), left:round(targetRect.left), right:round(targetRect.right), width:round(targetRect.width), height:round(targetRect.height) },
        ownerRect:{ top:round(ownerRect.top), bottom:round(ownerRect.bottom), left:round(ownerRect.left), right:round(ownerRect.right), width:round(ownerRect.width), height:round(ownerRect.height) },
        visibleBounds:{ top:round(visibleTop), bottom:round(visibleBottom) },
        targetFullyVisible:targetRect.top >= visibleTop - 1 && targetRect.bottom <= visibleBottom + 1,
        active:document.activeElement === target,
        documentHasFocus:document.hasFocus(),
        document:documentPosition(),
        events:[...events],
        positiveOwners:[...new Set(positiveEvents.map((item) => item.owner))],
        recentRealOwner:positiveEvents.at(-1)?.owner || '',
        ancestors,
        visualViewport:{ width:round(viewport?.width || innerWidth), height:round(viewport?.height || innerHeight), offsetTop:round(viewport?.offsetTop || 0), scale:round(viewport?.scale || 1) },
        keyboardOffset:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mobile-keyboard-offset')) || 0,
        pipelineViewport:window.LusuFramePipeline?.snapshot?.().viewport || null,
        pipeline:window.LusuFramePipeline?.snapshot?.() || null,
        mobileShell:window.LusuMobileShell?.lifecycleSnapshot?.() || null,
        uiShell:document.documentElement.dataset.uiShell || ''
      };
    };
    window.__auditScrollOwnerHarness = {
      describe,
      nearestOwner,
      documentPosition,
      clearEvents() {
        events.length = 0;
      },
      measure(target) {
        if (!(target instanceof HTMLElement)) throw new Error('audit measure target is missing');
        return measure(target, nearestOwner(target));
      },
      async focus(target) {
        if (!(target instanceof HTMLElement)) throw new Error('audit focus target is missing');
        const owner = nearestOwner(target);
        owner.scrollTop = 0;
        window.scrollTo(0, 0);
        scrollingElement.scrollTop = 0;
        document.body.scrollTop = 0;
        await nextFrames(2);
        events.length = 0;
        target.focus({ preventScroll:true });
        await nextFrames(4);
        return measure(target, owner);
      },
      cleanup() {
        document.removeEventListener('scroll', onScroll, true);
        events.length = 0;
        delete window.__auditScrollOwnerHarness;
      }
    };
    return true;
  })()`);
}

function scrollOwnerFailures(state, label, { requireScroll = true } = {}) {
  const failures = [];
  if (requireScroll && !state?.ownerInternal) failures.push(`${label} owner is not internal: ${JSON.stringify(state)}`);
  if (!state?.active) failures.push(`${label} focus did not remain on ${state?.target || "target"}`);
  if (!state?.targetFullyVisible) failures.push(`${label} focused target is not fully visible: ${JSON.stringify(state?.targetRect)}`);
  if (state?.document?.windowY !== 0 || state?.document?.scrollingTop !== 0 || state?.document?.bodyTop !== 0) failures.push(`${label} scrolled the document: ${JSON.stringify(state?.document)}`);
  if (requireScroll && (!(state?.ownerMaxScroll > 0) || !(state?.ownerScrollTop > 0))) failures.push(`${label} did not recover through a scrollable owner: ${JSON.stringify({ owner:state?.owner, top:state?.ownerScrollTop, max:state?.ownerMaxScroll })}`);
  if (requireScroll && !state?.recentRealOwner) failures.push(`${label} did not record a real scroll owner`);
  if (state?.recentRealOwner && state.recentRealOwner !== state.owner) failures.push(`${label} recent real owner ${state.recentRealOwner} !== ${state.owner}`);
  if (state?.positiveOwners?.some((owner) => owner !== state.owner)) failures.push(`${label} scrolled more than its internal owner: ${JSON.stringify(state.positiveOwners)}`);
  return failures;
}

async function waitFrames(client, count = 4) {
  await evaluate(client, `(async () => {
    let remaining=${Math.max(1, Math.round(count))};
    await new Promise((resolve) => {
      const step=() => remaining-- > 0 ? requestAnimationFrame(step) : setTimeout(resolve, 35);
      requestAnimationFrame(step);
    });
    return true;
  })()`);
}

async function settleMobileViewport(client, label, expectedExpression = "true") {
  await evaluate(client, `(() => {
    window.LusuFramePipeline?.requestViewport?.(${JSON.stringify(`audit:${label}`)});
    return true;
  })()`);
  await waitFor(client, expectedExpression, label);
  await waitFrames(client, 5);
}

async function readMobileViewportState(client) {
  return evaluate(client, `(() => {
    const root=document.documentElement;
    const rootStyle=getComputedStyle(root);
    const round=(value)=>Math.round(Number(value||0)*100)/100;
    const number=(name)=>round(parseFloat(rootStyle.getPropertyValue(name))||0);
    const box=(element)=>{
      const rect=element?.getBoundingClientRect();
      return rect ? { top:round(rect.top), right:round(rect.right), bottom:round(rect.bottom), left:round(rect.left), width:round(rect.width), height:round(rect.height) } : null;
    };
    const dock=document.querySelector('.xp-taskbar');
    const dockStyle=dock ? getComputedStyle(dock) : null;
    const dockScroller=document.querySelector('.mobile-dock-scroll');
    const scrolling=document.scrollingElement || document.documentElement;
    const snapshot=window.LusuFramePipeline?.snapshot?.() || window.LusuFramePipeline?.debugSnapshot?.() || null;
    return {
      data:{
        keyboard:root.dataset.mobileKeyboard||'',
        orientation:root.dataset.mobileOrientation||'',
        viewportMode:root.dataset.mobileViewportMode||'',
        shell:root.dataset.uiShell||''
      },
      css:{
        width:number('--mobile-viewport-width'),
        height:number('--mobile-viewport-height'),
        offsetTop:number('--mobile-viewport-offset-top'),
        offsetLeft:number('--mobile-viewport-offset-left'),
        keyboardOffset:number('--mobile-keyboard-offset'),
        viewportKeyboardOffset:number('--mobile-viewport-keyboard-offset')
      },
      visual:{
        width:round(window.visualViewport?.width||innerWidth),
        height:round(window.visualViewport?.height||innerHeight),
        offsetTop:round(window.visualViewport?.offsetTop||0),
        offsetLeft:round(window.visualViewport?.offsetLeft||0),
        scale:round(window.visualViewport?.scale||1)
      },
      layout:{ width:document.documentElement.clientWidth, height:document.documentElement.clientHeight, innerWidth, innerHeight },
      pipeline:snapshot,
      viewport:snapshot?.viewport || null,
      bodyDock:document.body.dataset.mobileDock||'',
      dock:{
        rect:box(dock),
        display:dockStyle?.display||'',
        visibility:dockStyle?.visibility||'',
        opacity:dockStyle?.opacity||'',
        pointerEvents:dockStyle?.pointerEvents||'',
        scrollerInert:Boolean(dockScroller?.inert),
        scrollerAriaHidden:dockScroller?.getAttribute('aria-hidden')||'',
        reachableItems:dockScroller && !dockScroller.inert
          ? [...dockScroller.querySelectorAll('button:not([hidden]),a[href]:not([hidden])')].filter((item)=>item.tabIndex>=0).length
          : 0
      },
      activeWindow:box(document.querySelector('.page.active > .xp-window')),
      document:{
        windowY:round(scrollY),
        scrollingTop:round(scrolling.scrollTop),
        bodyTop:round(document.body.scrollTop),
        clientWidth:document.documentElement.clientWidth,
        scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)
      },
      active:{ id:document.activeElement?.id||'', tag:document.activeElement?.tagName||'' }
    };
  })()`);
}

function mobileViewportContractFailures(state, label, expected = {}) {
  const failures = [];
  const expectedWidth = expected.width;
  const expectedHeight = expected.height;
  if (state?.data?.shell !== "mobile") failures.push(`${label} shell ${state?.data?.shell || "<empty>"} !== mobile`);
  if (expected.keyboard && state?.data?.keyboard !== expected.keyboard) failures.push(`${label} keyboard ${state?.data?.keyboard || "<empty>"} !== ${expected.keyboard}`);
  if (expected.orientation && state?.data?.orientation !== expected.orientation) failures.push(`${label} orientation ${state?.data?.orientation || "<empty>"} !== ${expected.orientation}`);
  if (expected.viewportMode && state?.data?.viewportMode !== expected.viewportMode) failures.push(`${label} viewport mode ${state?.data?.viewportMode || "<empty>"} !== ${expected.viewportMode}`);
  if (Number.isFinite(expectedWidth) && Math.abs(Number(state?.css?.width) - expectedWidth) > 1) failures.push(`${label} CSS viewport width ${state?.css?.width} !== ${expectedWidth}`);
  if (Number.isFinite(expectedHeight) && Math.abs(Number(state?.css?.height) - expectedHeight) > 1) failures.push(`${label} CSS viewport height ${state?.css?.height} !== ${expectedHeight}`);
  if (Number.isFinite(expected.offsetTop) && Math.abs(Number(state?.css?.offsetTop) - expected.offsetTop) > 1) failures.push(`${label} CSS viewport offset-top ${state?.css?.offsetTop} !== ${expected.offsetTop}`);
  if (Number.isFinite(expected.offsetLeft) && Math.abs(Number(state?.css?.offsetLeft) - expected.offsetLeft) > 1) failures.push(`${label} CSS viewport offset-left ${state?.css?.offsetLeft} !== ${expected.offsetLeft}`);
  if (expected.keyboardOffset === "positive" && !(Number(state?.css?.keyboardOffset) >= 96)) failures.push(`${label} keyboard offset ${state?.css?.keyboardOffset} is not a keyboard-sized reduction`);
  if (Number.isFinite(expected.keyboardOffset) && Math.abs(Number(state?.css?.keyboardOffset) - expected.keyboardOffset) > 1) failures.push(`${label} keyboard offset ${state?.css?.keyboardOffset} !== ${expected.keyboardOffset}`);
  if (Math.abs(Number(state?.css?.keyboardOffset) - Number(state?.css?.viewportKeyboardOffset)) > 1) failures.push(`${label} keyboard offset alias diverged: ${JSON.stringify(state?.css)}`);
  if (!state?.viewport) failures.push(`${label} FramePipeline viewport snapshot is missing`);
  if (state?.document?.windowY !== 0 || state?.document?.scrollingTop !== 0 || state?.document?.bodyTop !== 0) failures.push(`${label} scrolled the document: ${JSON.stringify(state?.document)}`);
  if (state?.document?.scrollWidth > state?.document?.clientWidth + 1) failures.push(`${label} has ${state.document.scrollWidth - state.document.clientWidth}px document horizontal overflow`);
  return failures;
}

function dockIsHidden(state) {
  return !state?.dock?.rect
    || state.dock.rect.width <= 1
    || state.dock.rect.height <= 1
    || state.dock.display === "none"
    || state.dock.visibility === "hidden"
    || Number(state.dock.opacity) <= 0.01
    || state.dock.pointerEvents === "none";
}

function rectViewportFailures(rect, state, label, { fully = true } = {}) {
  const failures = [];
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return [`${label} has no rendered geometry`];
  const top = Number(state?.visual?.offsetTop || 0);
  const bottom = top + Number(state?.visual?.height || state?.layout?.innerHeight || 0);
  const visible = fully
    ? rect.top >= top - 1 && rect.bottom <= bottom + 1
    : rect.bottom > top + 1 && rect.top < bottom - 1;
  if (!visible) failures.push(`${label} is outside the controlled visual viewport: ${JSON.stringify({ rect, top, bottom })}`);
  return failures;
}

async function ensureDockState(client, collapsed) {
  const expected = collapsed ? "collapsed" : "expanded";
  await evaluate(client, `(() => {
    const expected=${JSON.stringify(expected)};
    if (document.body.dataset.mobileDock!==expected) document.querySelector('[data-mobile-dock-toggle]')?.click();
    return document.body.dataset.mobileDock;
  })()`);
  await waitFor(client, `document.body.dataset.mobileDock===${JSON.stringify(expected)}`, `${expected} Dock preference`);
  await waitFrames(client, 3);
}

async function readSelectorRects(client, selectors) {
  return evaluate(client, `(() => {
    const selectors=${JSON.stringify(selectors)};
    const round=(value)=>Math.round(Number(value||0)*100)/100;
    return Object.fromEntries(Object.entries(selectors).map(([name,selector]) => {
      const element=document.querySelector(selector);
      const rect=element?.getBoundingClientRect();
      return [name, rect ? { top:round(rect.top), right:round(rect.right), bottom:round(rect.bottom), left:round(rect.left), width:round(rect.width), height:round(rect.height), hidden:Boolean(element.hidden), active:document.activeElement===element } : null];
    }));
  })()`);
}

async function auditChatGrowthRecovery(client, origin, viewport) {
  await emulate(client, viewport);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#chatroom`, `chat-growth-recovery-${viewport.width}x${viewport.height}`);
  await stable(client, "chatroom");
  await installScrollOwnerHarness(client);
  let state;
  try {
    state = await evaluate(client, `(async () => {
      const host=document.querySelector('#chatroom .xp-window');
      const growth=document.createElement('div');
      growth.id='audit-chat-footer-growth';
      growth.style.cssText='box-sizing:border-box;display:flex;flex-direction:column;justify-content:flex-end;width:100%;height:460px;min-height:460px;padding-top:400px;';
      const button=document.createElement('button');
      button.id='audit-chat-tail-focus';
      button.type='button';
      button.className='xp-button';
      button.textContent='Audit tail focus';
      button.style.cssText='flex:0 0 auto;min-width:44px;min-height:44px;';
      growth.append(button);
      host.append(growth);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return window.__auditScrollOwnerHarness.focus(button);
    })()`);
  } finally {
    await evaluate(client, `(() => { document.getElementById('audit-chat-footer-growth')?.remove(); window.__auditScrollOwnerHarness?.cleanup?.(); scrollTo(0,0); return true; })()`).catch(() => {});
  }
  const failures = scrollOwnerFailures(state, "359x500 Chat growth");
  await evaluate(client, `navigate('home', { motion:false, focusWindow:false }); true`);
  await waitFor(client, `document.body.dataset.route==='home'`, "Home after Chat growth");
  await evaluate(client, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
  const home = await evaluate(client, `(() => {
    const page=document.querySelector('#home.page.active');
    const pageRect=page?.getBoundingClientRect();
    const stage=document.querySelector('#wallpaper-stage')?.getBoundingClientRect();
    const dock=document.querySelector('.xp-taskbar');
    const dockRect=dock?.getBoundingClientRect();
    const scrolling=document.scrollingElement || document.documentElement;
    return {
      active:Boolean(page),
      document:{ windowY:scrollY, scrollingTop:scrolling.scrollTop, bodyTop:document.body.scrollTop, scrollHeight:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight), innerHeight },
      page:pageRect ? { top:pageRect.top, bottom:pageRect.bottom, width:pageRect.width, height:pageRect.height } : null,
      stage:stage ? { width:stage.width, height:stage.height } : null,
      desktopIconsVisible:Boolean(document.querySelector('#home .desktop-icons')?.getClientRects().length),
      dock:dockRect ? { top:dockRect.top, bottom:dockRect.bottom, position:getComputedStyle(dock).position } : null
    };
  })()`);
  if (!home.active || !home.desktopIconsVisible || !(home.stage?.width > 0) || !(home.stage?.height > 0)) failures.push(`Home composition did not recover after Chat growth: ${JSON.stringify(home)}`);
  if (home.document.windowY !== 0 || home.document.scrollingTop !== 0 || home.document.bodyTop !== 0 || home.document.scrollHeight > home.document.innerHeight + 1) failures.push(`Home retained document scrolling after Chat growth: ${JSON.stringify(home.document)}`);
  if (home.dock?.position !== "fixed" || Math.abs(Number(home.dock?.bottom) - viewport.height) > 8
    || Math.abs(Number(home.page?.top)) > 1 || Math.abs(Number(home.page?.bottom) - viewport.height) > 1
    || Math.abs(Number(home.stage?.width) - viewport.width) > 1 || Math.abs(Number(home.stage?.height) - viewport.height) > 1) failures.push(`Home fixed shell geometry changed after Chat growth: ${JSON.stringify(home)}`);
  return { kind:"fixed-shell", name:"chat-growth-scroll-recovery", shell:"mobile", viewport, realSoftKeyboardTested:false, state, home, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function auditConstrainedChatRecovery(client, origin, portrait, constrained) {
  await emulate(client, portrait);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#chatroom`, `constrained-chat-recovery-${portrait.width}x${portrait.height}-to-${constrained.width}x${constrained.height}`);
  await stable(client, "chatroom");
  const readGeometry = () => evaluate(client, `(() => {
    const box=(element) => { const rect=element?.getBoundingClientRect(); return rect ? { top:rect.top, bottom:rect.bottom, left:rect.left, right:rect.right, width:rect.width, height:rect.height } : null; };
    const style=getComputedStyle(document.documentElement);
    return { inner:{ width:innerWidth, height:innerHeight }, cssViewportHeight:parseFloat(style.getPropertyValue('--mobile-viewport-height')), textarea:box(document.getElementById('chat-message-input')), submit:box(document.querySelector('#chat-form button[type="submit"]')), window:box(document.querySelector('#chatroom .xp-window')), documentTop:(document.scrollingElement || document.documentElement).scrollTop };
  })()`);
  const baseline = await readGeometry();
  await emulate(client, constrained);
  await waitFor(client, `innerWidth===${constrained.width}&&innerHeight===${constrained.height}`, "constrained Chat viewport");
  await evaluate(client, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))))`);
  await installScrollOwnerHarness(client);
  let textarea;
  let submit;
  try {
    textarea = await evaluate(client, `window.__auditScrollOwnerHarness.focus(document.getElementById('chat-message-input'))`);
    submit = await evaluate(client, `window.__auditScrollOwnerHarness.focus(document.querySelector('#chat-form button[type="submit"]'))`);
  } finally {
    await evaluate(client, `window.__auditScrollOwnerHarness?.cleanup?.(); true`).catch(() => {});
  }
  const constrainedGeometry = await readGeometry();
  const failures = [
    ...scrollOwnerFailures(textarea, "390x500 Chat textarea", { requireScroll:false }),
    ...scrollOwnerFailures(submit, "390x500 Chat submit", { requireScroll:false })
  ];
  if (Math.abs(constrainedGeometry.cssViewportHeight - constrained.height) > 1) failures.push(`constrained Chat CSS viewport height ${constrainedGeometry.cssViewportHeight} !== ${constrained.height}`);
  await emulate(client, portrait);
  await waitFor(client, `innerWidth===${portrait.width}&&innerHeight===${portrait.height}`, "restored Chat viewport");
  await evaluate(client, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))))`);
  const restored = await readGeometry();
  if (Math.abs(restored.cssViewportHeight - portrait.height) > 1) failures.push(`restored Chat CSS viewport height ${restored.cssViewportHeight} !== ${portrait.height}`);
  if (Math.abs(Number(restored.window?.height) - Number(baseline.window?.height)) > 2) failures.push(`Chat window height did not restore: ${baseline.window?.height} -> ${restored.window?.height}`);
  if (restored.documentTop !== 0) failures.push(`restored Chat retained document scrollTop ${restored.documentTop}`);
  return { kind:"fixed-shell", name:"chat-constrained-height-proxy", shell:"mobile", viewport:portrait, constrainedViewport:constrained, realSoftKeyboardTested:false, proxy:"CDP viewport-height constraint only", baseline, constrained:{ geometry:constrainedGeometry, textarea, submit }, restored, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function auditChatShortScreenCapacity(client, origin, viewport) {
  await emulate(client, viewport);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#chatroom`, `chat-short-screen-capacity-${viewport.width}x${viewport.height}`);
  await stable(client, "chatroom");
  await ensureDockState(client, false);
  const measure = () => evaluate(client, `(() => {
    const round=(value)=>Math.round(Number(value||0)*100)/100;
    const rect=(element) => {
      if (!element || element.hidden || !element.getClientRects().length) return null;
      const value=element.getBoundingClientRect();
      return { top:round(value.top), right:round(value.right), bottom:round(value.bottom), left:round(value.left), width:round(value.width), height:round(value.height) };
    };
    const overlap=(a,b) => !a||!b ? 0 : round(Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)));
    const log=rect(document.getElementById('chat-message-list'));
    const panel=rect(document.getElementById('chat-private-room-form'));
    const header=rect(document.querySelector('#chatroom .chatroom-header'));
    const nickname=rect(document.querySelector('#chatroom .chatroom-nickname-row'));
    const roomStatus=rect(document.querySelector('#chatroom .chatroom-status'));
    const compose=rect(document.getElementById('chat-form'));
    const feedback=rect(document.getElementById('chat-feedback'));
    const footer=rect(document.querySelector('#chatroom .chatroom-footer'));
    const dockElement=document.querySelector('.xp-taskbar');
    const dock=rect(dockElement);
    const dockStyle=dockElement ? getComputedStyle(dockElement) : null;
    const windowRect=rect(document.querySelector('#chatroom .chatroom-window'));
    const disclosure=document.querySelector('#chat-private-room-form .chat-private-safety');
    const summary=disclosure?.querySelector('summary');
    const hint=disclosure?.querySelector('small');
    const summaryRect=rect(summary);
    const hintRect=rect(hint);
    const pairs={
      panelLog:overlap(panel,log),
      logCompose:overlap(log,compose),
      composeFeedback:overlap(compose,feedback),
      composeFooter:overlap(compose,footer),
      footerDock:overlap(footer,dock),
      windowDock:overlap(windowRect,dock),
      hintHeader:overlap(hintRect,header),
      hintNickname:overlap(hintRect,nickname),
      hintRoomStatus:overlap(hintRect,roomStatus),
      hintSummary:overlap(hintRect,summaryRect),
      hintLog:overlap(hintRect,log),
      hintCompose:overlap(hintRect,compose)
    };
    return {
      viewport:{ width:innerWidth, height:innerHeight },
      document:{ scrollTop:(document.scrollingElement||document.documentElement).scrollTop, scrollHeight:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight), clientHeight:document.documentElement.clientHeight },
      log,panel,header,nickname,roomStatus,compose,feedback,footer,dock,window:windowRect,pairs,
      dockPresentation:dockStyle ? { position:dockStyle.position, display:dockStyle.display, visibility:dockStyle.visibility, opacity:Number(dockStyle.opacity), pointerEvents:dockStyle.pointerEvents } : null,
      safety:disclosure ? {
        open:Boolean(disclosure.open),
        summary:summaryRect,
        label:summary?.getAttribute('aria-label')||'',
        title:summary?.getAttribute('title')||'',
        hint:hintRect,
        hintText:hint?.textContent?.trim()||'',
        hintOwned:Boolean(hint && disclosure.contains(hint))
      } : null,
      runtimeErrors:[...(window.__auditRuntimeErrors||[])]
    };
  })()`);
  let ordinary;
  let privateCollapsed;
  let privateExpanded;
  try {
    ordinary = await measure();
    await evaluate(client, `document.getElementById('chat-room-toggle')?.click(); true`);
    await waitFor(client, `document.getElementById('chat-private-room-form')?.hidden===false&&Boolean(document.querySelector('.chat-private-safety summary'))`, "Chat short-screen private form");
    await evaluate(client, `(() => { document.activeElement?.blur?.(); document.getElementById('chat-room-toggle')?.focus({preventScroll:true}); window.LusuFramePipeline?.noteEditingFocus?.(false,false); const disclosure=document.querySelector('.chat-private-safety'); if(disclosure) disclosure.open=false; return true; })()`);
    await settleMobileViewport(client, "chat-short-private-closed-keyboard", "document.documentElement.dataset.mobileKeyboard==='closed'");
    privateCollapsed = await measure();
    await evaluate(client, `(() => { const disclosure=document.querySelector('.chat-private-safety'); if(disclosure) disclosure.open=true; return true; })()`);
    await waitFrames(client, 4);
    privateExpanded = await measure();
  } finally {
    await evaluate(client, `(() => { const disclosure=document.querySelector('.chat-private-safety'); if(disclosure) disclosure.open=false; document.getElementById('chat-private-room-cancel')?.click(); scrollTo(0,0); return true; })()`).catch(() => {});
  }
  const failures = [];
  const checkNoOverlap = (state, label, names) => {
    for (const name of names) {
      if (Number(state?.pairs?.[name] || 0) > 1) failures.push(`${label} ${name} overlap ${state.pairs[name]}px²`);
    }
  };
  if (Number(ordinary?.log?.height || 0) < 160) failures.push(`359x500 ordinary Chat log ${ordinary?.log?.height || 0}px < 160px`);
  if (Number(privateCollapsed?.log?.height || 0) < 115) failures.push(`359x500 private Chat log ${privateCollapsed?.log?.height || 0}px < 115px`);
  checkNoOverlap(ordinary, "ordinary Chat", ["logCompose", "composeFeedback", "composeFooter", "footerDock"]);
  checkNoOverlap(privateCollapsed, "private Chat", ["panelLog", "logCompose", "composeFeedback", "composeFooter", "footerDock"]);
  checkNoOverlap(privateExpanded, "expanded private safety", ["panelLog", "logCompose", "composeFeedback", "composeFooter", "footerDock", "hintHeader", "hintNickname", "hintRoomStatus", "hintSummary", "hintLog", "hintCompose"]);
  const safety = privateCollapsed?.safety;
  if (!safety?.summary || safety.summary.width < 44 || safety.summary.height < 44) failures.push(`private safety disclosure target is below 44px: ${JSON.stringify(safety?.summary)}`);
  if (!safety?.hintOwned || !safety.hintText || !/[6６]/.test(`${safety.label} ${safety.title}`)) failures.push(`private safety disclosure does not expose purpose/minimum/risk copy: ${JSON.stringify(safety)}`);
  if (safety?.hint) failures.push(`collapsed private safety explanation should not cover the Chat log: ${JSON.stringify(safety.hint)}`);
  if (!privateExpanded?.safety?.open || !privateExpanded.safety.hint || privateExpanded.safety.hint.height <= 0) failures.push(`private safety explanation is not visibly reachable when expanded: ${JSON.stringify(privateExpanded?.safety)}`);
  if (Number(privateExpanded?.safety?.hint?.width || 0) < 220) failures.push(`private safety explanation is too narrow to read: ${JSON.stringify(privateExpanded?.safety?.hint)}`);
  for (const [label, state] of [["ordinary", ordinary], ["private", privateCollapsed], ["expanded safety", privateExpanded]]) {
    if (state?.document?.scrollTop !== 0 || state?.document?.scrollHeight > state?.document?.clientHeight + 1) failures.push(`${label} Chat leaked document scrolling: ${JSON.stringify(state?.document)}`);
    if (!state?.dock || state.dock.top < -1 || state.dock.bottom > viewport.height + 8 || state?.dockPresentation?.position !== "fixed" || state.dockPresentation.display === "none" || state.dockPresentation.visibility === "hidden" || state.dockPresentation.opacity <= .01 || state.dockPresentation.pointerEvents === "none") failures.push(`${label} Chat Dock is not visibly reachable: ${JSON.stringify({ dock:state?.dock, presentation:state?.dockPresentation })}`);
    if (state?.runtimeErrors?.length) failures.push(`${label} Chat runtime errors: ${state.runtimeErrors.join(" | ")}`);
  }
  return { kind:"chat-capacity", name:"chat-short-screen-capacity-and-safety", route:"chatroom", shell:"mobile", viewport, ordinary, privateCollapsed, privateExpanded, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function auditRouteScrollOwner(client, origin, viewport, route) {
  await emulate(client, viewport);
  const isArticle = route === "article";
  const url = isArticle
    ? `${origin}/articles/${article.slug}?lang=zh&wallpaper=${fixedTheme}&welcome=0`
    : `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#${route}`;
  await client.send("Page.navigate", { url });
  await stable(client, route);
  await installScrollOwnerHarness(client);
  let state;
  try {
    state = await evaluate(client, `(async () => {
      const route=${JSON.stringify(route)};
      const host=route==='article' ? document.getElementById('article-detail-body') : document.querySelector('#about .xp-window');
      const growth=document.createElement('div');
      growth.id='audit-' + route + '-owner-growth';
      growth.style.cssText='box-sizing:border-box;display:flex;flex-direction:column;justify-content:flex-end;width:100%;height:680px;min-height:680px;padding-top:610px;';
      const button=document.createElement('button');
      button.id='audit-' + route + '-tail-focus';
      button.type='button';
      button.className='xp-button';
      button.textContent='Audit ' + route + ' tail';
      button.style.cssText='flex:0 0 auto;min-height:44px;';
      growth.append(button);
      host.append(growth);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return window.__auditScrollOwnerHarness.focus(button);
    })()`);
  } finally {
    await evaluate(client, `(() => { document.querySelector('[id^="audit-"][id$="-owner-growth"]')?.remove(); window.__auditScrollOwnerHarness?.cleanup?.(); scrollTo(0,0); return true; })()`).catch(() => {});
  }
  const failures = scrollOwnerFailures(state, `${route} scroll owner`);
  return { kind:"fixed-shell-scroll-owner", name:`${route}-internal-scroll-owner`, route:isArticle ? "knowledge" : route, shell:"mobile", viewport, realSoftKeyboardTested:false, state, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function auditPageScaleInternalFocus(client, origin, viewport) {
  await emulate(client, viewport);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#about`, `page-scale-internal-focus-${viewport.width}x${viewport.height}`);
  await stable(client, "about");
  await installScrollOwnerHarness(client);
  let state;
  try {
    await client.send("Emulation.setPageScaleFactor", { pageScaleFactor:2 });
    await waitFor(client, `window.visualViewport?.scale>=1.9`, "pageScale 2 internal focus");
    await evaluate(client, `window.LusuFramePipeline?.requestViewport?.('audit-pagescale-focus'); new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    state = await evaluate(client, `(async () => {
      const host=document.querySelector('#about .xp-window');
      const growth=document.createElement('div');
      growth.id='audit-pagescale-owner-growth';
      growth.style.cssText='display:flex;flex-direction:column;justify-content:flex-end;height:1200px;min-height:1200px;';
      const button=document.createElement('button');
      button.id='audit-pagescale-tail-focus';
      button.type='button';
      button.className='xp-button';
      button.textContent='Audit zoom focus';
      button.style.minHeight='44px';
      const visualBottom=(window.visualViewport?.offsetTop||0)+(window.visualViewport?.height||innerHeight);
      const trailingSpace=Math.ceil(Math.max(0,host.getBoundingClientRect().bottom-visualBottom+16));
      const trailing=document.createElement('span');
      trailing.setAttribute('aria-hidden','true');
      trailing.style.cssText='display:block;flex:0 0 '+trailingSpace+'px;pointer-events:none;';
      growth.append(button,trailing);
      host.append(growth);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return window.__auditScrollOwnerHarness.focus(button);
    })()`);
  } finally {
    await client.send("Emulation.setPageScaleFactor", { pageScaleFactor:1 }).catch(() => {});
    await evaluate(client, `(() => { document.getElementById('audit-pagescale-owner-growth')?.remove(); window.__auditScrollOwnerHarness?.cleanup?.(); scrollTo(0,0); return true; })()`).catch(() => {});
  }
  const failures = scrollOwnerFailures(state, "pageScale 2 internal focus");
  const snapshotOffset = Number(state?.pipelineViewport?.keyboardOffset ?? NaN);
  if (Math.abs(Number(state?.visualViewport?.scale) - 2) > .05) failures.push(`pageScale internal focus scale ${state?.visualViewport?.scale} !== 2`);
  if (state?.keyboardOffset !== 0 || !Number.isFinite(snapshotOffset) || snapshotOffset !== 0) failures.push(`pageScale internal focus was classified as keyboard: ${JSON.stringify({ css:state?.keyboardOffset, pipeline:state?.pipelineViewport })}`);
  return { kind:"fixed-shell", name:"native-pagescale-internal-focus", route:"about", shell:"mobile", viewport, realSoftKeyboardTested:false, state, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function auditKeyboardChatCompose(client, origin, portrait, constrained) {
  await emulate(client, portrait);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#chatroom`, `keyboard-chat-compose-${portrait.width}x${portrait.height}-to-${constrained.width}x${constrained.height}`);
  await stable(client, "chatroom");
  await ensureDockState(client, false);
  await installScrollOwnerHarness(client);
  await client.send("Page.bringToFront");
  let baseline;
  let constrainedState;
  let ownerState;
  let rects;
  let restored;
  try {
    await evaluate(client, `(() => {
      const input=document.getElementById('chat-message-input');
      const feedback=document.getElementById('chat-feedback');
      const log=document.getElementById('chat-message-list');
      const owner=document.querySelector('#chatroom .xp-window');
      feedback.dataset.auditOriginalText=feedback.textContent||'';
      feedback.dataset.auditOriginalStyle=feedback.getAttribute('style')||'';
      log.dataset.auditOriginalStyle=log.getAttribute('style')||'';
      owner.dataset.auditOriginalStyle=owner.getAttribute('style')||'';
      log.style.minHeight='520px';
      owner.style.gridTemplateRows='auto auto 520px auto auto';
      owner.scrollTop=0;
      input.focus({preventScroll:true});
      window.LusuMobileShell?.requestFocusReveal?.('audit:chat-compose-baseline');
      return true;
    })()`);
    await settleMobileViewport(client, "chat-compose-baseline", "document.documentElement.dataset.mobileKeyboard==='closed'&&document.documentElement.dataset.mobileViewportMode==='stable'");
    baseline = await readMobileViewportState(client);
    await evaluate(client, `(() => { const owner=document.querySelector('#chatroom .chatroom-window'); if (owner) owner.scrollTop=0; window.__auditScrollOwnerHarness?.clearEvents?.(); return true; })()`);

    await emulate(client, constrained);
    await waitFor(client, `innerWidth===${constrained.width}&&innerHeight===${constrained.height}`, "Chat keyboard viewport proxy");
    await settleMobileViewport(client, "chat-compose-keyboard", "document.documentElement.dataset.mobileKeyboard==='open'&&document.documentElement.dataset.mobileViewportMode==='keyboard'");
    await evaluate(client, `(() => {
      const feedback=document.getElementById('chat-feedback');
      feedback.textContent='Audit keyboard feedback line one.\\nAudit keyboard feedback line two.';
      feedback.style.whiteSpace='normal';
      window.LusuMobileShell?.requestFocusReveal?.('audit:chat-compose-keyboard-feedback');
      return true;
    })()`);
    await waitFrames(client, 5);
    constrainedState = await readMobileViewportState(client);
    ownerState = await evaluate(client, `window.__auditScrollOwnerHarness.measure(document.getElementById('chat-message-input'))`);
    rects = await readSelectorRects(client, {
      textarea: "#chat-message-input",
      send: "#chat-form button[type='submit']",
      feedback: "#chat-feedback"
    });

    await emulate(client, portrait);
    await waitFor(client, `innerWidth===${portrait.width}&&innerHeight===${portrait.height}`, "restored Chat viewport");
    await settleMobileViewport(client, "chat-compose-restored", "document.documentElement.dataset.mobileKeyboard==='closed'&&document.documentElement.dataset.mobileViewportMode==='stable'");
    restored = await readMobileViewportState(client);
  } finally {
    await evaluate(client, `(() => {
      const feedback=document.getElementById('chat-feedback');
      const log=document.getElementById('chat-message-list');
      const owner=document.querySelector('#chatroom .chatroom-window');
      if (feedback?.dataset.auditOriginalText!==undefined) feedback.textContent=feedback.dataset.auditOriginalText;
      if (feedback) {
        const value=feedback.dataset.auditOriginalStyle||'';
        value ? feedback.setAttribute('style',value) : feedback.removeAttribute('style');
        delete feedback.dataset.auditOriginalText;
        delete feedback.dataset.auditOriginalStyle;
      }
      if (log) {
        const value=log.dataset.auditOriginalStyle||'';
        value ? log.setAttribute('style',value) : log.removeAttribute('style');
        delete log.dataset.auditOriginalStyle;
      }
      if (owner) {
        const value=owner.dataset.auditOriginalStyle||'';
        value ? owner.setAttribute('style',value) : owner.removeAttribute('style');
        delete owner.dataset.auditOriginalStyle;
      }
      window.__auditScrollOwnerHarness?.cleanup?.();
      scrollTo(0,0);
      return true;
    })()`).catch(() => {});
    await emulate(client, portrait).catch(() => {});
  }
  const failures = [
    ...mobileViewportContractFailures(baseline, "Chat expanded baseline", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, offsetTop:0, offsetLeft:0, keyboardOffset:0 }),
    ...mobileViewportContractFailures(constrainedState, "Chat keyboard proxy", { keyboard:"open", orientation:"portrait", viewportMode:"keyboard", width:constrained.width, height:constrained.height, offsetTop:0, offsetLeft:0, keyboardOffset:"positive" }),
    ...scrollOwnerFailures(ownerState, "Chat keyboard proxy"),
    ...rectViewportFailures(rects?.textarea, constrainedState, "Chat textarea"),
    ...rectViewportFailures(rects?.send, constrainedState, "Chat send button"),
    ...rectViewportFailures(rects?.feedback, constrainedState, "Chat feedback"),
    ...mobileViewportContractFailures(restored, "Chat restored viewport", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, offsetTop:0, offsetLeft:0, keyboardOffset:0 })
  ];
  if (!String(ownerState?.owner || "").includes("chatroom-window")) failures.push(`Chat keyboard proxy owner ${ownerState?.owner || "<empty>"} is not the Chat window`);
  if (!dockIsHidden(constrainedState)) failures.push(`Chat keyboard proxy did not hide the Dock: ${JSON.stringify(constrainedState?.dock)}`);
  if (baseline?.bodyDock !== "expanded" || restored?.bodyDock !== "expanded") failures.push(`Chat keyboard proxy changed expanded Dock preference: ${baseline?.bodyDock} -> ${restored?.bodyDock}`);
  if (dockIsHidden(restored)) failures.push("Chat restored viewport left the Dock hidden");
  if (Math.abs(Number(restored?.activeWindow?.height) - Number(baseline?.activeWindow?.height)) > 2) failures.push(`Chat shell height did not restore: ${baseline?.activeWindow?.height} -> ${restored?.activeWindow?.height}`);
  return { kind:"mobile-viewport", name:"keyboard-chat-compose", route:"chatroom", shell:"mobile", viewport:portrait, constrainedViewport:constrained, ...mobileViewportLimitations, baseline, constrained:{ viewport:constrainedState, owner:ownerState, rects }, restored, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function auditKeyboardChatPrivate(client, origin, portrait, constrained) {
  await emulate(client, portrait);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#chatroom`, `keyboard-chat-private-${portrait.width}x${portrait.height}-to-${constrained.width}x${constrained.height}`);
  await stable(client, "chatroom");
  await ensureDockState(client, false);
  await installScrollOwnerHarness(client);
  await client.send("Page.bringToFront");
  let baseline;
  let constrainedState;
  let passwordOwner;
  let enterOwner;
  let rects;
  let restored;
  try {
    await evaluate(client, `(() => {
      document.getElementById('chat-room-toggle')?.click();
      const feedback=document.getElementById('chat-feedback');
      feedback.dataset.auditOriginalText=feedback.textContent||'';
      feedback.dataset.auditOriginalStyle=feedback.getAttribute('style')||'';
      feedback.textContent='Audit private-room feedback line one.\\nAudit private-room feedback line two.';
      feedback.style.whiteSpace='normal';
      const password=document.getElementById('chat-private-password');
      password.value='audit-private-room';
      password.focus({preventScroll:true});
      window.LusuMobileShell?.requestFocusReveal?.('audit:chat-private-baseline');
      return true;
    })()`);
    await waitFor(client, `document.getElementById('chat-private-room-form')?.hidden===false`, "Chat private-room form");
    await settleMobileViewport(client, "chat-private-baseline", "document.documentElement.dataset.mobileKeyboard==='closed'");
    baseline = await readMobileViewportState(client);
    await evaluate(client, `window.__auditScrollOwnerHarness?.clearEvents?.(); true`);

    await emulate(client, constrained);
    await waitFor(client, `innerHeight===${constrained.height}`, "Chat private keyboard proxy");
    await settleMobileViewport(client, "chat-private-keyboard", "document.documentElement.dataset.mobileKeyboard==='open'&&document.documentElement.dataset.mobileViewportMode==='keyboard'");
    await evaluate(client, `window.LusuMobileShell?.requestFocusReveal?.('audit:chat-private-password'); true`);
    await waitFrames(client, 4);
    passwordOwner = await evaluate(client, `window.__auditScrollOwnerHarness.measure(document.getElementById('chat-private-password'))`);
    await client.send("Page.bringToFront");
    enterOwner = await evaluate(client, `(async () => {
      const button=document.querySelector('#chat-private-room-form button[type="submit"]');
      button.focus({preventScroll:true});
      window.LusuMobileShell?.requestFocusReveal?.('audit:chat-private-enter');
      await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      return window.__auditScrollOwnerHarness.measure(button);
    })()`);
    await client.send("Page.bringToFront");
    await evaluate(client, `(() => {
      const password=document.getElementById('chat-private-password');
      password.focus({preventScroll:true});
      window.LusuMobileShell?.requestFocusReveal?.('audit:chat-private-final');
      return true;
    })()`);
    await waitFrames(client, 4);
    constrainedState = await readMobileViewportState(client);
    rects = await readSelectorRects(client, {
      password: "#chat-private-password",
      enter: "#chat-private-room-form button[type='submit']",
      feedback: "#chat-feedback"
    });

    await emulate(client, portrait);
    await settleMobileViewport(client, "chat-private-restored", "document.documentElement.dataset.mobileKeyboard==='closed'&&document.documentElement.dataset.mobileViewportMode==='stable'");
    restored = await readMobileViewportState(client);
  } finally {
    await evaluate(client, `(() => {
      const feedback=document.getElementById('chat-feedback');
      if (feedback?.dataset.auditOriginalText!==undefined) feedback.textContent=feedback.dataset.auditOriginalText;
      if (feedback) {
        const value=feedback.dataset.auditOriginalStyle||'';
        value ? feedback.setAttribute('style',value) : feedback.removeAttribute('style');
        delete feedback.dataset.auditOriginalText;
        delete feedback.dataset.auditOriginalStyle;
      }
      document.getElementById('chat-private-room-cancel')?.click();
      window.__auditScrollOwnerHarness?.cleanup?.();
      scrollTo(0,0);
      return true;
    })()`).catch(() => {});
    await emulate(client, portrait).catch(() => {});
  }
  const failures = [
    ...mobileViewportContractFailures(baseline, "Chat private expanded baseline", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 }),
    ...mobileViewportContractFailures(constrainedState, "Chat private keyboard proxy", { keyboard:"open", orientation:"portrait", viewportMode:"keyboard", width:constrained.width, height:constrained.height, keyboardOffset:"positive" }),
    ...scrollOwnerFailures(passwordOwner, "Chat private password", { requireScroll:false }),
    ...scrollOwnerFailures(enterOwner, "Chat private enter", { requireScroll:false }),
    ...rectViewportFailures(rects?.password, constrainedState, "Chat private password"),
    ...rectViewportFailures(rects?.enter, constrainedState, "Chat private enter"),
    ...rectViewportFailures(rects?.feedback, constrainedState, "Chat private feedback"),
    ...mobileViewportContractFailures(restored, "Chat private restored", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 })
  ];
  if (!dockIsHidden(constrainedState)) failures.push("Chat private keyboard proxy did not hide the Dock");
  return { kind:"mobile-viewport", name:"keyboard-chat-private", route:"chatroom", shell:"mobile", viewport:portrait, constrainedViewport:constrained, ...mobileViewportLimitations, baseline, constrained:{ viewport:constrainedState, passwordOwner, enterOwner, rects }, restored, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function auditKeyboardAccount(client, origin, portrait, constrained, route = "home") {
  await emulate(client, portrait);
  const hash = route === "home" ? "" : `#${route}`;
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0${hash}`, `keyboard-account-${route}-${portrait.width}x${portrait.height}-to-${constrained.width}x${constrained.height}`);
  await stable(client, route);
  await ensureDockState(client, false);
  if (route === "resources") await openQuickTransferFromCta(client);
  await waitFor(client, `Boolean(document.getElementById('account-form')&&document.querySelector('[data-account-toggle]'))`, `${route} account form`);
  await installScrollOwnerHarness(client);
  await client.send("Page.bringToFront");
  let baseline;
  let constrainedState;
  let ownerState;
  let rects;
  let identity;
  let restored;
  try {
    await evaluate(client, `(async () => {
      const route=${JSON.stringify(route)};
      if (route==='resources') {
        document.getElementById('transfer-login-button')?.click();
      } else {
        document.querySelector('[data-account-toggle]')?.click();
      }
      return true;
    })()`);
    await waitFor(client, `document.getElementById('account-popover')?.hidden===false`, `${route} account popover open`);
    await client.send("Page.bringToFront");
    await evaluate(client, `(() => {
      const form=document.getElementById('account-form');
      const email=form?.elements.namedItem('email');
      const password=form?.elements.namedItem('password');
      const note=document.getElementById('account-form-note');
      email.value='audit@example.test';
      password.value='audit-password-draft';
      window.__auditAccountContract={ form, email, password, note, noteText:note?.textContent||'' };
      password.focus({preventScroll:true});
      window.LusuMobileShell?.requestFocusReveal?.('audit:account-baseline');
      return true;
    })()`);
    await settleMobileViewport(client, `${route}-account-baseline`, "document.documentElement.dataset.mobileKeyboard==='closed'");
    baseline = await readMobileViewportState(client);
    await evaluate(client, `window.__auditScrollOwnerHarness?.clearEvents?.(); true`);

    await emulate(client, constrained);
    await waitFor(client, `innerHeight===${constrained.height}`, `${route} account keyboard proxy`);
    await settleMobileViewport(client, `${route}-account-keyboard`, "document.documentElement.dataset.mobileKeyboard==='open'&&document.documentElement.dataset.mobileViewportMode==='keyboard'");
    await evaluate(client, `window.LusuMobileShell?.requestFocusReveal?.('audit:account-keyboard'); true`);
    await waitFrames(client, 4);

    if (route === "home") {
      await client.send("Page.bringToFront");
      await evaluate(client, `(() => {
        const form=window.__auditAccountContract?.form;
        const submit=form?.querySelector('[data-account-submit]');
        submit?.focus({preventScroll:true});
        submit?.click();
        return true;
      })()`);
      await waitFor(client, `document.getElementById('account-form-note')?.classList.contains('is-error')===true&&document.getElementById('account-form')?.getAttribute('aria-busy')==='false'`, "account inline error settlement");
      await waitFrames(client, 4);
    }

    constrainedState = await readMobileViewportState(client);
    ownerState = await evaluate(client, `window.__auditScrollOwnerHarness.measure(document.querySelector('#account-form input[name="password"]'))`);
    rects = await readSelectorRects(client, {
      password: "#account-form input[name='password']",
      actions: "#account-form .account-actions",
      note: "#account-form-note",
      popover: "#account-popover"
    });
    identity = await evaluate(client, `(() => {
      const saved=window.__auditAccountContract;
      const form=document.getElementById('account-form');
      const email=form?.elements.namedItem('email');
      const password=form?.elements.namedItem('password');
      const note=document.getElementById('account-form-note');
      return {
        sameForm:saved?.form===form,
        sameEmail:saved?.email===email,
        samePassword:saved?.password===password,
        sameNote:saved?.note===note,
        emailValue:email?.value||'',
        passwordValue:password?.value||'',
        passwordFocused:document.activeElement===password,
        noteChanged:(note?.textContent||'')!==saved?.noteText,
        noteError:Boolean(note?.classList.contains('is-error')),
        noteRole:note?.getAttribute('role')||'',
        noteLive:note?.getAttribute('aria-live')||''
      };
    })()`);

    await emulate(client, portrait);
    await settleMobileViewport(client, `${route}-account-restored`, "document.documentElement.dataset.mobileKeyboard==='closed'&&document.documentElement.dataset.mobileViewportMode==='stable'");
    restored = await readMobileViewportState(client);
  } finally {
    await evaluate(client, `(() => {
      window.closeAccountPopover?.({ restoreFocus:false, motion:false });
      delete window.__auditAccountContract;
      window.__auditScrollOwnerHarness?.cleanup?.();
      scrollTo(0,0);
      return true;
    })()`).catch(() => {});
    await emulate(client, portrait).catch(() => {});
  }
  const label = route === "home" ? "Home account" : "Resources Transfer account";
  const failures = [
    ...mobileViewportContractFailures(baseline, `${label} baseline`, { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 }),
    ...mobileViewportContractFailures(constrainedState, `${label} keyboard proxy`, { keyboard:"open", orientation:"portrait", viewportMode:"keyboard", width:constrained.width, height:constrained.height, keyboardOffset:"positive" }),
    ...scrollOwnerFailures(ownerState, `${label} password`, { requireScroll:false }),
    ...rectViewportFailures(rects?.password, constrainedState, `${label} password`),
    ...rectViewportFailures(rects?.actions, constrainedState, `${label} actions`),
    ...rectViewportFailures(rects?.note, constrainedState, `${label} note`),
    ...mobileViewportContractFailures(restored, `${label} restored`, { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 })
  ];
  if (!dockIsHidden(constrainedState)) failures.push(`${label} keyboard proxy did not hide the Dock`);
  if (identity?.emailValue !== "audit@example.test" || identity?.passwordValue !== "audit-password-draft") failures.push(`${label} lost account drafts: ${JSON.stringify(identity)}`);
  if (!identity?.passwordFocused) failures.push(`${label} password focus was not preserved`);
  if (route === "home") {
    if (!identity?.sameForm || !identity?.sameEmail || !identity?.samePassword || !identity?.sameNote) failures.push(`account error rebuilt form nodes: ${JSON.stringify(identity)}`);
    if (!identity?.noteChanged || !identity?.noteError || identity?.noteRole !== "status" || identity?.noteLive !== "polite") failures.push(`account inline error contract is incomplete: ${JSON.stringify(identity)}`);
  }
  return { kind:"mobile-viewport", name:route === "home" ? "keyboard-home-account" : "keyboard-resources-transfer-account", route, shell:"mobile", viewport:portrait, constrainedViewport:constrained, ...mobileViewportLimitations, baseline, constrained:{ viewport:constrainedState, owner:ownerState, rects, identity }, restored, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function auditKeyboardKnowledgeSearch(client, origin, portrait, constrained) {
  await emulate(client, portrait);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#knowledge`, `keyboard-knowledge-search-${portrait.width}x${portrait.height}-to-${constrained.width}x${constrained.height}`);
  await stable(client, "knowledge");
  await ensureDockState(client, false);
  await installScrollOwnerHarness(client);
  await client.send("Page.bringToFront");
  let baseline;
  let constrainedState;
  let ownerState;
  let rects;
  let restored;
  try {
    await evaluate(client, `(() => {
      const input=document.getElementById('knowledge-search-input');
      input.value='audit';
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.focus({preventScroll:true});
      window.LusuMobileShell?.requestFocusReveal?.('audit:knowledge-search-baseline');
      return true;
    })()`);
    await waitFor(client, `Boolean(document.getElementById('knowledge-search-status')?.textContent.trim())`, "Knowledge search status");
    await settleMobileViewport(client, "knowledge-search-baseline", "document.documentElement.dataset.mobileKeyboard==='closed'");
    baseline = await readMobileViewportState(client);
    await evaluate(client, `window.__auditScrollOwnerHarness?.clearEvents?.(); true`);

    await emulate(client, constrained);
    await waitFor(client, `innerHeight===${constrained.height}`, "Knowledge keyboard viewport proxy");
    await settleMobileViewport(client, "knowledge-search-keyboard", "document.documentElement.dataset.mobileKeyboard==='open'&&document.documentElement.dataset.mobileViewportMode==='keyboard'");
    await evaluate(client, `window.LusuMobileShell?.requestFocusReveal?.('audit:knowledge-search-keyboard'); true`);
    await waitFrames(client, 4);
    constrainedState = await readMobileViewportState(client);
    ownerState = await evaluate(client, `window.__auditScrollOwnerHarness.measure(document.getElementById('knowledge-search-input'))`);
    rects = await readSelectorRects(client, {
      input: "#knowledge-search-input",
      clear: "#knowledge-searchbar [data-article-search-clear]",
      status: "#knowledge-search-status"
    });

    await emulate(client, portrait);
    await settleMobileViewport(client, "knowledge-search-restored", "document.documentElement.dataset.mobileKeyboard==='closed'&&document.documentElement.dataset.mobileViewportMode==='stable'");
    restored = await readMobileViewportState(client);
  } finally {
    await evaluate(client, `(() => {
      window.__auditScrollOwnerHarness?.cleanup?.();
      document.querySelector('#knowledge-searchbar [data-article-search-clear]')?.click();
      scrollTo(0,0);
      return true;
    })()`).catch(() => {});
    await emulate(client, portrait).catch(() => {});
  }
  const failures = [
    ...mobileViewportContractFailures(baseline, "Knowledge search baseline", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 }),
    ...mobileViewportContractFailures(constrainedState, "Knowledge search keyboard proxy", { keyboard:"open", orientation:"portrait", viewportMode:"keyboard", width:constrained.width, height:constrained.height, keyboardOffset:"positive" }),
    ...scrollOwnerFailures(ownerState, "Knowledge search", { requireScroll:false }),
    ...rectViewportFailures(rects?.input, constrainedState, "Knowledge search input"),
    ...rectViewportFailures(rects?.clear, constrainedState, "Knowledge search clear"),
    ...rectViewportFailures(rects?.status, constrainedState, "Knowledge search status"),
    ...mobileViewportContractFailures(restored, "Knowledge search restored", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 })
  ];
  if (!dockIsHidden(constrainedState)) failures.push("Knowledge search keyboard proxy did not hide the Dock");
  return { kind:"mobile-viewport", name:"keyboard-knowledge-search", route:"knowledge", shell:"mobile", viewport:portrait, constrainedViewport:constrained, ...mobileViewportLimitations, baseline, constrained:{ viewport:constrainedState, owner:ownerState, rects }, restored, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function prepareTransferAudit(client, owner) {
  await openQuickTransferFromCta(client);
  await evaluate(client, `(async () => {
    const app=document.getElementById('transfer-app');
    const login=document.getElementById('transfer-login-gate');
    const entry=document.getElementById('transfer-room-entry');
    const room=document.getElementById('transfer-room');
    const categories=document.getElementById('resource-categories');
    const list=document.getElementById('resource-list');
    if (app) app.hidden=false;
    if (categories) categories.hidden=true;
    if (list) list.hidden=true;
    document.querySelector('#resources .xp-window')?.classList.add('is-transfer-open');
    if (login) login.hidden=true;
    if (entry) entry.hidden=${owner === "entry" ? "false" : "true"};
    if (room) room.hidden=${owner === "room" ? "false" : "true"};
    return true;
  })()`);
  await waitFor(client, `document.getElementById('transfer-app')?.hidden===false&&document.getElementById(${JSON.stringify(owner === "entry" ? "transfer-room-entry" : "transfer-room")})?.hidden===false`, `Transfer ${owner} fixture`);
  await waitFrames(client, 4);
}

async function auditKeyboardTransferEntry(client, origin, portrait, constrained) {
  await emulate(client, portrait);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#resources`, `keyboard-transfer-entry-${portrait.width}x${portrait.height}-to-${constrained.width}x${constrained.height}`);
  await stable(client, "resources");
  await ensureDockState(client, false);
  await prepareTransferAudit(client, "entry");
  await installScrollOwnerHarness(client);
  await client.send("Page.bringToFront");
  let baseline;
  let constrainedState;
  let ownerState;
  let rects;
  let unified;
  let restored;
  try {
    await evaluate(client, `(() => {
      const entry=document.getElementById('transfer-room-entry');
      const growth=document.createElement('div');
      growth.id='audit-transfer-entry-growth';
      growth.style.cssText='height:320px;min-height:320px;pointer-events:none;';
      entry.prepend(growth);
      const password=document.getElementById('transfer-room-password');
      password.value='audit-transfer-passphrase';
      password.focus({preventScroll:true});
      window.__auditTransferUnifiedReturn=window.LusuMobileShell?.requestFocusReveal?.('audit:transfer-entry-baseline');
      return true;
    })()`);
    await settleMobileViewport(client, "transfer-entry-baseline", "document.documentElement.dataset.mobileKeyboard==='closed'");
    baseline = await readMobileViewportState(client);
    await evaluate(client, `(() => { const owner=document.getElementById('transfer-room-entry'); if (owner) owner.scrollTop=0; window.__auditScrollOwnerHarness?.clearEvents?.(); return true; })()`);

    await emulate(client, constrained);
    await waitFor(client, `innerHeight===${constrained.height}`, "Transfer entry keyboard proxy");
    await settleMobileViewport(client, "transfer-entry-keyboard", "document.documentElement.dataset.mobileKeyboard==='open'&&document.documentElement.dataset.mobileViewportMode==='keyboard'");
    await evaluate(client, `window.LusuMobileShell?.requestFocusReveal?.('audit:transfer-entry-keyboard'); true`);
    await waitFrames(client, 5);
    constrainedState = await readMobileViewportState(client);
    ownerState = await evaluate(client, `window.__auditScrollOwnerHarness.measure(document.getElementById('transfer-room-password'))`);
    rects = await readSelectorRects(client, {
      password: "#transfer-room-password",
      enter: "#transfer-room-entry .transfer-enter-button"
    });
    unified = await evaluate(client, `(() => {
      const snapshot=window.LusuFramePipeline?.snapshot?.()||{};
      const keys=[...Object.keys(snapshot.runsByKey||{}),...(snapshot.pendingKeys||[])];
      return {
        requestFocusRevealResult:window.__auditTransferUnifiedReturn,
        privateViewportKeys:keys.filter((key)=>/quick-transfer:viewport-focus|transfer:viewport-focus/i.test(key)),
        lifecycle:window.QuickTransfer?.lifecycleSnapshot?.()||null
      };
    })()`);

    await emulate(client, portrait);
    await settleMobileViewport(client, "transfer-entry-restored", "document.documentElement.dataset.mobileKeyboard==='closed'&&document.documentElement.dataset.mobileViewportMode==='stable'");
    restored = await readMobileViewportState(client);
  } finally {
    await evaluate(client, `(() => {
      document.getElementById('audit-transfer-entry-growth')?.remove();
      window.QuickTransfer?.close?.({restoreFocus:false});
      window.__auditScrollOwnerHarness?.cleanup?.();
      delete window.__auditTransferUnifiedReturn;
      scrollTo(0,0);
      return true;
    })()`).catch(() => {});
    await emulate(client, portrait).catch(() => {});
  }
  const failures = [
    ...mobileViewportContractFailures(baseline, "Transfer entry baseline", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 }),
    ...mobileViewportContractFailures(constrainedState, "Transfer entry keyboard proxy", { keyboard:"open", orientation:"portrait", viewportMode:"keyboard", width:constrained.width, height:constrained.height, keyboardOffset:"positive" }),
    ...scrollOwnerFailures(ownerState, "Transfer room-entry"),
    ...rectViewportFailures(rects?.password, constrainedState, "Transfer room password"),
    ...rectViewportFailures(rects?.enter, constrainedState, "Transfer room enter"),
    ...mobileViewportContractFailures(restored, "Transfer entry restored", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 })
  ];
  if (ownerState?.owner !== "#transfer-room-entry") failures.push(`Transfer entry owner ${ownerState?.owner} !== #transfer-room-entry`);
  if (!dockIsHidden(constrainedState)) failures.push("Transfer entry keyboard proxy did not hide the Dock");
  if (unified?.requestFocusRevealResult !== true || unified?.privateViewportKeys?.length) failures.push(`Transfer did not use only the unified focus path: ${JSON.stringify(unified)}`);
  return { kind:"mobile-viewport", name:"keyboard-transfer-room-entry", route:"resources", shell:"mobile", viewport:portrait, constrainedViewport:constrained, ...mobileViewportLimitations, baseline, constrained:{ viewport:constrainedState, owner:ownerState, rects, unified }, restored, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function auditKeyboardTransferComposer(client, origin, portrait, constrained) {
  await emulate(client, portrait);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#resources`, `keyboard-transfer-composer-${portrait.width}x${portrait.height}-to-${constrained.width}x${constrained.height}`);
  await stable(client, "resources");
  await ensureDockState(client, false);
  await prepareTransferAudit(client, "room");
  await installScrollOwnerHarness(client);
  await client.send("Page.bringToFront");
  let baseline;
  let constrainedState;
  let ownerState;
  let rects;
  let unified;
  let restored;
  try {
    await evaluate(client, `(() => {
      const feed=document.getElementById('transfer-feed');
      feed.dataset.auditOriginalStyle=feed.getAttribute('style')||'';
      feed.style.minHeight='360px';
      const input=document.getElementById('transfer-text-input');
      input.value='audit transfer draft';
      input.focus({preventScroll:true});
      window.__auditTransferUnifiedReturn=window.LusuMobileShell?.requestFocusReveal?.('audit:transfer-composer-baseline');
      return true;
    })()`);
    await settleMobileViewport(client, "transfer-composer-baseline", "document.documentElement.dataset.mobileKeyboard==='closed'");
    baseline = await readMobileViewportState(client);
    await evaluate(client, `(() => { const owner=document.getElementById('transfer-room'); if (owner) owner.scrollTop=0; window.__auditScrollOwnerHarness?.clearEvents?.(); return true; })()`);

    await emulate(client, constrained);
    await waitFor(client, `innerHeight===${constrained.height}`, "Transfer composer keyboard proxy");
    await settleMobileViewport(client, "transfer-composer-keyboard", "document.documentElement.dataset.mobileKeyboard==='open'&&document.documentElement.dataset.mobileViewportMode==='keyboard'");
    await evaluate(client, `window.LusuMobileShell?.requestFocusReveal?.('audit:transfer-composer-keyboard'); true`);
    await waitFrames(client, 5);
    constrainedState = await readMobileViewportState(client);
    ownerState = await evaluate(client, `window.__auditScrollOwnerHarness.measure(document.getElementById('transfer-text-input'))`);
    rects = await readSelectorRects(client, {
      textarea: "#transfer-text-input",
      send: "#transfer-send-button"
    });
    unified = await evaluate(client, `(() => {
      const snapshot=window.LusuFramePipeline?.snapshot?.()||{};
      const keys=[...Object.keys(snapshot.runsByKey||{}),...(snapshot.pendingKeys||[])];
      return {
        requestFocusRevealResult:window.__auditTransferUnifiedReturn,
        privateViewportKeys:keys.filter((key)=>/quick-transfer:viewport-focus|transfer:viewport-focus/i.test(key)),
        lifecycle:window.QuickTransfer?.lifecycleSnapshot?.()||null
      };
    })()`);

    await emulate(client, portrait);
    await settleMobileViewport(client, "transfer-composer-restored", "document.documentElement.dataset.mobileKeyboard==='closed'&&document.documentElement.dataset.mobileViewportMode==='stable'");
    restored = await readMobileViewportState(client);
  } finally {
    await evaluate(client, `(() => {
      const feed=document.getElementById('transfer-feed');
      if (feed) {
        const value=feed.dataset.auditOriginalStyle||'';
        value ? feed.setAttribute('style',value) : feed.removeAttribute('style');
        delete feed.dataset.auditOriginalStyle;
      }
      window.QuickTransfer?.close?.({restoreFocus:false});
      window.__auditScrollOwnerHarness?.cleanup?.();
      delete window.__auditTransferUnifiedReturn;
      scrollTo(0,0);
      return true;
    })()`).catch(() => {});
    await emulate(client, portrait).catch(() => {});
  }
  const failures = [
    ...mobileViewportContractFailures(baseline, "Transfer composer baseline", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 }),
    ...mobileViewportContractFailures(constrainedState, "Transfer composer keyboard proxy", { keyboard:"open", orientation:"portrait", viewportMode:"keyboard", width:constrained.width, height:constrained.height, keyboardOffset:"positive" }),
    ...scrollOwnerFailures(ownerState, "Transfer room composer"),
    ...rectViewportFailures(rects?.textarea, constrainedState, "Transfer composer textarea"),
    ...rectViewportFailures(rects?.send, constrainedState, "Transfer composer send"),
    ...mobileViewportContractFailures(restored, "Transfer composer restored", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 })
  ];
  if (ownerState?.owner !== "#transfer-room") failures.push(`Transfer composer owner ${ownerState?.owner} !== #transfer-room`);
  if (!dockIsHidden(constrainedState)) failures.push("Transfer composer keyboard proxy did not hide the Dock");
  if (unified?.requestFocusRevealResult !== true || unified?.privateViewportKeys?.length) failures.push(`Transfer composer did not use only the unified focus path: ${JSON.stringify(unified)}`);
  return { kind:"mobile-viewport", name:"keyboard-transfer-composer", route:"resources", shell:"mobile", viewport:portrait, constrainedViewport:constrained, ...mobileViewportLimitations, baseline, constrained:{ viewport:constrainedState, owner:ownerState, rects, unified }, restored, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function auditBrowserUiHeightProxy(client, origin, portrait, browserUiViewport) {
  await emulate(client, portrait);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0`, `browser-ui-height-proxy-${portrait.width}x${portrait.height}-to-${browserUiViewport.width}x${browserUiViewport.height}`);
  await stable(client, "home");
  await ensureDockState(client, false);
  await evaluate(client, `document.activeElement?.blur?.(); window.LusuFramePipeline?.requestViewport?.('audit:browser-ui-baseline'); true`);
  await settleMobileViewport(client, "browser-ui-baseline", "document.documentElement.dataset.mobileViewportMode==='stable'&&document.documentElement.dataset.mobileKeyboard==='closed'");
  const baseline = await readMobileViewportState(client);
  await emulate(client, browserUiViewport);
  await waitFor(client, `innerWidth===${browserUiViewport.width}&&innerHeight===${browserUiViewport.height}`, "browser UI height proxy");
  await settleMobileViewport(client, "browser-ui-reduced", "document.documentElement.dataset.mobileViewportMode==='browser-ui'&&document.documentElement.dataset.mobileKeyboard==='closed'");
  const reduced = await readMobileViewportState(client);
  await emulate(client, portrait);
  await settleMobileViewport(client, "browser-ui-restored", "document.documentElement.dataset.mobileViewportMode==='stable'&&document.documentElement.dataset.mobileKeyboard==='closed'");
  const restored = await readMobileViewportState(client);
  const failures = [
    ...mobileViewportContractFailures(baseline, "browser UI baseline", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, offsetTop:0, offsetLeft:0, keyboardOffset:0 }),
    ...mobileViewportContractFailures(reduced, "browser UI height proxy", { keyboard:"closed", orientation:"portrait", viewportMode:"browser-ui", width:browserUiViewport.width, height:browserUiViewport.height, offsetTop:0, offsetLeft:0, keyboardOffset:0 }),
    ...mobileViewportContractFailures(restored, "browser UI restored", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, offsetTop:0, offsetLeft:0, keyboardOffset:0 })
  ];
  if (dockIsHidden(reduced)) failures.push("browser UI height proxy incorrectly hid the Dock");
  if (baseline.bodyDock !== "expanded" || reduced.bodyDock !== "expanded" || restored.bodyDock !== "expanded") failures.push(`browser UI proxy changed Dock preference: ${baseline.bodyDock}/${reduced.bodyDock}/${restored.bodyDock}`);
  if (dockIsHidden(restored)) failures.push("browser UI restore left the Dock hidden");
  return { kind:"mobile-viewport", name:"browser-ui-height-proxy", route:"home", shell:"mobile", viewport:portrait, browserUiViewport, ...mobileViewportLimitations, offsetTopPhysicalProxyTested:false, baseline, reduced, restored, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function auditOrientationRoundTrip(client, origin, portrait, landscape) {
  await emulate(client, portrait);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#about`, `orientation-round-trip-${portrait.width}x${portrait.height}-to-${landscape.width}x${landscape.height}`);
  await stable(client, "about");
  await ensureDockState(client, false);
  await settleMobileViewport(client, "orientation-portrait-baseline", "document.documentElement.dataset.mobileOrientation==='portrait'&&document.documentElement.dataset.mobileViewportMode==='stable'");
  const baseline = await readMobileViewportState(client);
  await emulate(client, landscape);
  await waitFor(client, `innerWidth===${landscape.width}&&innerHeight===${landscape.height}`, "landscape orientation proxy");
  await settleMobileViewport(client, "orientation-landscape", "document.documentElement.dataset.mobileOrientation==='landscape'&&document.documentElement.dataset.mobileViewportMode==='stable'");
  const rotated = await readMobileViewportState(client);
  await emulate(client, portrait);
  await waitFor(client, `innerWidth===${portrait.width}&&innerHeight===${portrait.height}`, "portrait orientation restore");
  await settleMobileViewport(client, "orientation-portrait-restored", "document.documentElement.dataset.mobileOrientation==='portrait'&&document.documentElement.dataset.mobileViewportMode==='stable'");
  const restored = await readMobileViewportState(client);
  const failures = [
    ...mobileViewportContractFailures(baseline, "orientation portrait baseline", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 }),
    ...mobileViewportContractFailures(rotated, "orientation landscape", { keyboard:"closed", orientation:"landscape", viewportMode:"stable", width:landscape.width, height:landscape.height, keyboardOffset:0 }),
    ...mobileViewportContractFailures(restored, "orientation portrait restored", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 })
  ];
  if (dockIsHidden(rotated) || dockIsHidden(restored)) failures.push("orientation round trip hid the Dock without a keyboard");
  if (baseline.bodyDock !== restored.bodyDock) failures.push(`orientation round trip changed Dock preference ${baseline.bodyDock} -> ${restored.bodyDock}`);
  if (Math.abs(Number(baseline.activeWindow?.width) - Number(restored.activeWindow?.width)) > 2 || Math.abs(Number(baseline.activeWindow?.height) - Number(restored.activeWindow?.height)) > 2) failures.push(`orientation round trip did not restore shell geometry: ${JSON.stringify({ baseline:baseline.activeWindow, restored:restored.activeWindow })}`);
  return { kind:"mobile-viewport", name:"orientation-round-trip", route:"about", shell:"mobile", viewport:portrait, landscapeViewport:landscape, ...mobileViewportLimitations, baseline, rotated, restored, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function auditPageScaleLayoutStability(client, origin, portrait) {
  await emulate(client, portrait);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0`, `page-scale-layout-stability-${portrait.width}x${portrait.height}`);
  await stable(client, "home");
  await ensureDockState(client, false);
  await settleMobileViewport(client, "zoom-layout-baseline", "document.documentElement.dataset.mobileViewportMode==='stable'");
  const baseline = await readMobileViewportState(client);
  const baselineComposition = await readSelectorRects(client, { page:"#home.page.active", stage:"#wallpaper-stage", dock:".xp-taskbar" });
  let zoomed;
  let zoomedComposition;
  let restored;
  try {
    await client.send("Emulation.setPageScaleFactor", { pageScaleFactor:2 });
    await waitFor(client, `window.visualViewport?.scale>=1.9`, "pageScale 2 layout stability");
    await settleMobileViewport(client, "zoom-layout-two", "document.documentElement.dataset.mobileViewportMode==='zoom'&&document.documentElement.dataset.mobileKeyboard==='closed'");
    zoomed = await readMobileViewportState(client);
    zoomedComposition = await readSelectorRects(client, { page:"#home.page.active", stage:"#wallpaper-stage", dock:".xp-taskbar" });
  } finally {
    await client.send("Emulation.setPageScaleFactor", { pageScaleFactor:1 }).catch(() => {});
  }
  await waitFor(client, `Math.abs((window.visualViewport?.scale||1)-1)<.05`, "pageScale restore");
  await settleMobileViewport(client, "zoom-layout-restored", "document.documentElement.dataset.mobileViewportMode==='stable'&&document.documentElement.dataset.mobileKeyboard==='closed'");
  restored = await readMobileViewportState(client);
  const failures = [
    ...mobileViewportContractFailures(baseline, "zoom baseline", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 }),
    ...mobileViewportContractFailures(zoomed, "pageScale 2", { keyboard:"closed", orientation:"portrait", viewportMode:"zoom", width:portrait.width, height:portrait.height, offsetTop:0, offsetLeft:0, keyboardOffset:0 }),
    ...mobileViewportContractFailures(restored, "zoom restored", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 })
  ];
  if (Math.abs(Number(zoomed?.visual?.scale) - 2) > .05) failures.push(`pageScale proxy scale ${zoomed?.visual?.scale} !== 2`);
  if (!(Number(zoomed?.visual?.width) < portrait.width * .6) || !(Number(zoomed?.visual?.height) < portrait.height * .6)) failures.push(`pageScale proxy did not reduce visual viewport: ${JSON.stringify(zoomed?.visual)}`);
  for (const key of ["page", "stage", "dock"]) {
    const before=baselineComposition?.[key];
    const during=zoomedComposition?.[key];
    if (!before || !during || Math.abs(Number(before.width)-Number(during.width))>2 || Math.abs(Number(before.height)-Number(during.height))>2) failures.push(`pageScale 2 reflowed ${key}: ${JSON.stringify({ before, during })}`);
  }
  if (dockIsHidden(zoomed)) failures.push("pageScale zoom incorrectly hid the Dock");
  return { kind:"mobile-viewport", name:"native-pagescale-layout-stability", route:"home", shell:"mobile", viewport:portrait, pageScale:2, ...mobileViewportLimitations, baseline:{ viewport:baseline, composition:baselineComposition }, zoomed:{ viewport:zoomed, composition:zoomedComposition }, restored, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function auditDockKeyboardPreference(client, origin, portrait, constrained, collapsed) {
  await emulate(client, portrait);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#chatroom`, `dock-keyboard-${collapsed ? "collapsed" : "expanded"}-${portrait.width}x${portrait.height}-to-${constrained.width}x${constrained.height}`);
  await stable(client, "chatroom");
  await ensureDockState(client, collapsed);
  await client.send("Page.bringToFront");
  await evaluate(client, `(() => {
    const input=document.getElementById('chat-message-input');
    input.focus({preventScroll:true});
    window.LusuMobileShell?.requestFocusReveal?.('audit:dock-preference-baseline');
    return true;
  })()`);
  await settleMobileViewport(client, `dock-${collapsed ? "collapsed" : "expanded"}-baseline`, "document.documentElement.dataset.mobileKeyboard==='closed'");
  const baseline = await readMobileViewportState(client);
  const collapsedFocusProbe = collapsed ? await evaluate(client, `(() => {
    const input=document.getElementById('chat-message-input');
    const item=document.querySelector('.mobile-dock-scroll a[href], .mobile-dock-scroll button');
    item?.focus({preventScroll:true});
    const result={
      targetFound:Boolean(item),
      targetReceivedFocus:document.activeElement===item,
      activeId:document.activeElement?.id||'',
      activeInsideDock:Boolean(document.activeElement?.closest?.('.mobile-dock-scroll'))
    };
    input?.focus({preventScroll:true});
    return result;
  })()`) : null;
  await emulate(client, constrained);
  await waitFor(client, `innerHeight===${constrained.height}`, `${collapsed ? "collapsed" : "expanded"} Dock keyboard proxy`);
  await settleMobileViewport(client, `dock-${collapsed ? "collapsed" : "expanded"}-keyboard`, "document.documentElement.dataset.mobileKeyboard==='open'&&document.documentElement.dataset.mobileViewportMode==='keyboard'");
  const keyboard = await readMobileViewportState(client);
  await emulate(client, portrait);
  await settleMobileViewport(client, `dock-${collapsed ? "collapsed" : "expanded"}-restored`, "document.documentElement.dataset.mobileKeyboard==='closed'&&document.documentElement.dataset.mobileViewportMode==='stable'");
  const restored = await readMobileViewportState(client);
  const expectedPreference = collapsed ? "collapsed" : "expanded";
  const failures = [
    ...mobileViewportContractFailures(baseline, `${expectedPreference} Dock baseline`, { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 }),
    ...mobileViewportContractFailures(keyboard, `${expectedPreference} Dock keyboard`, { keyboard:"open", orientation:"portrait", viewportMode:"keyboard", width:constrained.width, height:constrained.height, keyboardOffset:"positive" }),
    ...mobileViewportContractFailures(restored, `${expectedPreference} Dock restored`, { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 })
  ];
  if (baseline.bodyDock !== expectedPreference || keyboard.bodyDock !== expectedPreference || restored.bodyDock !== expectedPreference) failures.push(`${expectedPreference} Dock preference was mutated: ${baseline.bodyDock}/${keyboard.bodyDock}/${restored.bodyDock}`);
  if (collapsed && (!collapsedFocusProbe?.targetFound || collapsedFocusProbe.targetReceivedFocus || collapsedFocusProbe.activeInsideDock)) failures.push(`collapsed Dock accepted programmatic focus: ${JSON.stringify(collapsedFocusProbe)}`);
  for (const [label, sample] of [["baseline", baseline], ["restored", restored]]) {
    if (collapsed) {
      if (!sample.dock?.scrollerInert || sample.dock.scrollerAriaHidden !== "true" || sample.dock.reachableItems !== 0) failures.push(`collapsed Dock remains exposed to keyboard or accessibility APIs at ${label}: ${JSON.stringify(sample.dock)}`);
    } else if (sample.dock?.scrollerInert || sample.dock?.scrollerAriaHidden === "true" || sample.dock?.reachableItems < 6) {
      failures.push(`expanded Dock navigation is not fully available at ${label}: ${JSON.stringify(sample.dock)}`);
    }
  }
  if (!dockIsHidden(keyboard)) failures.push(`${expectedPreference} Dock remained visible for keyboard`);
  if (dockIsHidden(baseline) || dockIsHidden(restored)) failures.push(`${expectedPreference} Dock was not visible outside keyboard state`);
  if (Math.abs(Number(baseline.dock?.rect?.height)-Number(restored.dock?.rect?.height))>2 || Math.abs(Number(baseline.dock?.rect?.bottom)-Number(restored.dock?.rect?.bottom))>2) failures.push(`${expectedPreference} Dock geometry did not restore: ${JSON.stringify({ baseline:baseline.dock, restored:restored.dock })}`);
  return { kind:"mobile-viewport", name:`dock-state-keyboard-round-trip-${expectedPreference}`, route:"chatroom", shell:"mobile", viewport:portrait, constrainedViewport:constrained, dockPreference:expectedPreference, ...mobileViewportLimitations, baseline, collapsedFocusProbe, keyboard, restored, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function readSafeAreaGeometry(client) {
  const viewport = await readMobileViewportState(client);
  const geometry = await evaluate(client, `(() => {
    const round=(value)=>Math.round(Number(value||0)*100)/100;
    const box=(selector)=>{const rect=document.querySelector(selector)?.getBoundingClientRect();return rect?{top:round(rect.top),right:round(rect.right),bottom:round(rect.bottom),left:round(rect.left),width:round(rect.width),height:round(rect.height)}:null;};
    const dock=document.querySelector('.xp-taskbar');
    const dockStyle=dock ? getComputedStyle(dock) : null;
    return {
      header:box('.xp-topbar'),
      window:box('.page.active > .xp-window'),
      page:box('.page.active'),
      dock:box('.xp-taskbar'),
      dockInsets:{ left:round(parseFloat(dockStyle?.left)||0), right:round(parseFloat(dockStyle?.right)||0), bottom:round(parseFloat(dockStyle?.bottom)||0) }
    };
  })()`);
  return { viewport, geometry };
}

async function auditSafeAreaInsetsProxy(client, origin, portrait, landscape) {
  await emulate(client, portrait);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#about`, `safe-area-insets-proxy-${portrait.width}x${portrait.height}-to-${landscape.width}x${landscape.height}`);
  await stable(client, "about");
  await ensureDockState(client, false);
  let supported = true;
  let unsupportedReason = "";
  const zeroInsets = { top:0, right:0, bottom:0, left:0 };
  try {
    await client.send("Emulation.setSafeAreaInsets", { insets:zeroInsets });
  } catch (error) {
    supported = false;
    unsupportedReason = error.message;
  }
  if (!supported) {
    return { kind:"mobile-viewport", name:"safe-area-insets-proxy", route:"about", shell:"mobile", viewport:portrait, landscapeViewport:landscape, ...mobileViewportLimitations, safeAreaProxySupported:false, unsupportedReason, failures:[], status:"PASS" };
  }
  let baseline;
  let portraitInsets;
  let landscapeBaseline;
  let landscapeInsets;
  let restored;
  try {
    await settleMobileViewport(client, "safe-area-zero", "document.documentElement.dataset.mobileOrientation==='portrait'");
    baseline = await readSafeAreaGeometry(client);
    await client.send("Emulation.setSafeAreaInsets", { insets:{ top:24, right:0, bottom:34, left:0 } });
    await waitFrames(client, 5);
    portraitInsets = await readSafeAreaGeometry(client);
    await client.send("Emulation.setSafeAreaInsets", { insets:zeroInsets });
    await emulate(client, landscape);
    await settleMobileViewport(client, "safe-area-landscape-zero", "document.documentElement.dataset.mobileOrientation==='landscape'");
    landscapeBaseline = await readSafeAreaGeometry(client);
    await client.send("Emulation.setSafeAreaInsets", { insets:{ top:0, right:44, bottom:21, left:44 } });
    await settleMobileViewport(client, "safe-area-landscape", "document.documentElement.dataset.mobileOrientation==='landscape'");
    landscapeInsets = await readSafeAreaGeometry(client);
  } finally {
    await client.send("Emulation.setSafeAreaInsets", { insets:zeroInsets }).catch(() => {});
    await emulate(client, portrait).catch(() => {});
  }
  await settleMobileViewport(client, "safe-area-restored", "document.documentElement.dataset.mobileOrientation==='portrait'");
  restored = await readSafeAreaGeometry(client);
  const failures = [
    ...mobileViewportContractFailures(baseline?.viewport, "safe-area baseline", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 }),
    ...mobileViewportContractFailures(portraitInsets?.viewport, "safe-area portrait proxy", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 }),
    ...mobileViewportContractFailures(landscapeInsets?.viewport, "safe-area landscape proxy", { keyboard:"closed", orientation:"landscape", viewportMode:"stable", width:landscape.width, height:landscape.height, keyboardOffset:0 }),
    ...mobileViewportContractFailures(restored?.viewport, "safe-area restored", { keyboard:"closed", orientation:"portrait", viewportMode:"stable", width:portrait.width, height:portrait.height, keyboardOffset:0 })
  ];
  if (Number(portraitInsets?.geometry?.header?.height) < Number(baseline?.geometry?.header?.height) + 22) failures.push(`portrait safe-area top inset did not expand header: ${JSON.stringify({ baseline:baseline?.geometry?.header, inset:portraitInsets?.geometry?.header })}`);
  const portraitDockInset = portrait.height - Number(portraitInsets?.geometry?.dock?.bottom || portrait.height);
  if (portraitDockInset < 38) failures.push(`portrait safe-area bottom inset did not move Dock: ${portraitDockInset}px`);
  if (Number(landscapeInsets?.geometry?.dockInsets?.left) < 43 || Number(landscapeInsets?.geometry?.dockInsets?.right) < 43) failures.push(`landscape safe-area side insets did not reach Dock styles: ${JSON.stringify(landscapeInsets?.geometry?.dockInsets)}`);
  if (Number(landscapeInsets?.geometry?.window?.left) < 43 || Number(landscapeInsets?.geometry?.window?.right) > landscape.width - 43) failures.push(`landscape safe-area side insets did not contain window: ${JSON.stringify(landscapeInsets?.geometry?.window)}`);
  if (Number(landscapeInsets?.geometry?.window?.left) < Number(landscapeBaseline?.geometry?.window?.left) + 34 || Number(landscapeInsets?.geometry?.window?.right) > Number(landscapeBaseline?.geometry?.window?.right) - 34) failures.push(`landscape safe-area window geometry did not react to side insets: ${JSON.stringify({ baseline:landscapeBaseline?.geometry?.window, inset:landscapeInsets?.geometry?.window })}`);
  if (Math.abs(Number(restored?.geometry?.header?.height)-Number(baseline?.geometry?.header?.height))>2 || Math.abs(Number(restored?.geometry?.dock?.bottom)-Number(baseline?.geometry?.dock?.bottom))>2) failures.push(`safe-area zero restore did not restore shell geometry: ${JSON.stringify({ baseline:baseline?.geometry, restored:restored?.geometry })}`);
  return { kind:"mobile-viewport", name:"safe-area-insets-proxy", route:"about", shell:"mobile", viewport:portrait, landscapeViewport:landscape, ...mobileViewportLimitations, safeAreaProxySupported:true, controlledInsets:{ portrait:{top:24,right:0,bottom:34,left:0}, landscape:{top:0,right:44,bottom:21,left:44} }, baseline, portrait:portraitInsets, landscapeBaseline, landscape:landscapeInsets, restored, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function auditFramePipelineCoalescing(client, origin, viewport) {
  await emulate(client, viewport);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0`, `frame-pipeline-coalescing-${viewport.width}x${viewport.height}`);
  await stable(client, "home");
  const state = await evaluate(client, `(async () => {
    const pipeline = window.LusuFramePipeline;
    const takeSnapshot = () => pipeline?.snapshot?.() || pipeline?.debugSnapshot?.() || null;
    if (!pipeline || typeof pipeline.request !== 'function' || !takeSnapshot()) {
      return { apiMissing:true, hasPipeline:Boolean(pipeline), hasRequest:typeof pipeline?.request === 'function', snapshot:takeSnapshot() };
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const before = takeSnapshot();
    window.__auditFramePipelineRuns = { read:0, write:0 };
    for (let index = 0; index < 40; index += 1) {
      pipeline.request('audit-keyed-job', {
        read() { window.__auditFramePipelineRuns.read += 1; return index; },
        write() { window.__auditFramePipelineRuns.write += 1; }
      });
      window.dispatchEvent(new Event('resize'));
      window.visualViewport?.dispatchEvent(new Event(index % 2 ? 'scroll' : 'resize'));
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { before, after:takeSnapshot(), runs:{ ...window.__auditFramePipelineRuns } };
  })()`);
  const failures = [];
  if (state?.apiMissing) {
    failures.push(`window.LusuFramePipeline request/snapshot contract is missing: ${JSON.stringify(state)}`);
  } else {
    const frameDelta = pipelineCounter(state.after, "frames") - pipelineCounter(state.before, "frames");
    const readDelta = pipelineCounter(state.after, "readPasses") - pipelineCounter(state.before, "readPasses");
    const writeDelta = pipelineCounter(state.after, "writePasses") - pipelineCounter(state.before, "writePasses");
    if (frameDelta !== 1) failures.push(`event storm used ${frameDelta} frames instead of 1`);
    if (readDelta !== 1) failures.push(`event storm used ${readDelta} read passes instead of 1`);
    if (writeDelta !== 1) failures.push(`event storm used ${writeDelta} write passes instead of 1`);
    if (state.runs?.read !== 1 || state.runs?.write !== 1) failures.push(`keyed job ran ${JSON.stringify(state.runs)} instead of once per phase`);
  }
  return { kind: "frame-pipeline", name: "same-frame-event-coalescing", shell: "mobile", viewport, state, failures, status: failures.length ? "FAIL" : "PASS" };
}

async function auditFramePipelineViewport(client, origin, viewport) {
  await emulate(client, viewport);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0`, `frame-pipeline-viewport-${viewport.width}x${viewport.height}`);
  await stable(client, "home");
  await evaluate(client, `(() => {
    for (let index = 0; index < 20; index += 1) {
      window.dispatchEvent(new Event('resize'));
      window.visualViewport?.dispatchEvent(new Event(index % 2 ? 'scroll' : 'resize'));
    }
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  })()`);
  const state = await evaluate(client, `(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const dock = document.querySelector('.xp-taskbar')?.getBoundingClientRect();
    const activeDockItem = document.querySelector('.mobile-dock-scroll [data-route="home"]')?.getBoundingClientRect();
    const indicator = document.querySelector('.mobile-dock-selection')?.getBoundingClientRect();
    const snapshot = window.LusuFramePipeline?.snapshot?.() || window.LusuFramePipeline?.debugSnapshot?.() || null;
    return {
      snapshot,
      css:{
        width:parseFloat(rootStyle.getPropertyValue('--mobile-viewport-width')),
        height:parseFloat(rootStyle.getPropertyValue('--mobile-viewport-height')),
        keyboardOffset:parseFloat(rootStyle.getPropertyValue('--mobile-keyboard-offset'))
      },
      visual:{ width:visualViewport?.width || innerWidth, height:visualViewport?.height || innerHeight, scale:visualViewport?.scale || 1 },
      dock:dock ? { left:dock.left, right:dock.right, top:dock.top, bottom:dock.bottom, width:dock.width, height:dock.height } : null,
      activeDockItem:activeDockItem ? { left:activeDockItem.left, right:activeDockItem.right, width:activeDockItem.width } : null,
      indicator:indicator ? { left:indicator.left, right:indicator.right, width:indicator.width } : null
    };
  })()`);
  const failures = [];
  if (!state.snapshot) failures.push("window.LusuFramePipeline snapshot is missing");
  if (Math.abs(state.css.width - viewport.width) > 1 || Math.abs(state.css.height - viewport.height) > 1) failures.push(`viewport CSS variables are stale: ${JSON.stringify(state.css)}`);
  if (state.css.keyboardOffset !== 0) failures.push(`baseline keyboard offset ${state.css.keyboardOffset}px !== 0`);
  if (!state.dock || state.dock.left < -1 || state.dock.right > viewport.width + 1 || Math.abs(state.dock.bottom - viewport.height) > 8) failures.push(`Dock final geometry is invalid: ${JSON.stringify(state.dock)}`);
  if (!state.activeDockItem || !state.indicator || Math.abs(state.activeDockItem.left - state.indicator.left) > 1 || Math.abs(state.activeDockItem.width - state.indicator.width) > 1) failures.push(`Dock indicator is stale: ${JSON.stringify({ active:state.activeDockItem, indicator:state.indicator })}`);
  return { kind: "frame-pipeline", name: `viewport-dock-${viewport.width}x${viewport.height}`, shell: "mobile", viewport, state, failures, status: failures.length ? "FAIL" : "PASS" };
}

async function auditNativePageScale(client, origin, viewport) {
  await emulate(client, viewport);
  await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0`, `frame-pipeline-native-page-scale-${viewport.width}x${viewport.height}`);
  await stable(client, "home");
  try {
    await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    await waitFor(client, `window.visualViewport?.scale >= 1.9`, "native pageScale 2");
    await evaluate(client, `(() => {
      window.dispatchEvent(new Event('resize'));
      window.visualViewport?.dispatchEvent(new Event('resize'));
      window.visualViewport?.dispatchEvent(new Event('scroll'));
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    })()`);
    const state = await evaluate(client, `(() => {
      const rootStyle=getComputedStyle(document.documentElement);
      return {
        visual:{ width:visualViewport?.width, height:visualViewport?.height, offsetTop:visualViewport?.offsetTop, scale:visualViewport?.scale },
        cssKeyboardOffset:parseFloat(rootStyle.getPropertyValue('--mobile-keyboard-offset')),
        snapshot:window.LusuFramePipeline?.snapshot?.() || window.LusuFramePipeline?.debugSnapshot?.() || null
      };
    })()`);
    const snapshotViewport = state.snapshot?.viewport || state.snapshot?.metrics?.viewport || {};
    const snapshotOffset = Number(snapshotViewport.keyboardOffset ?? snapshotViewport.keyboard ?? NaN);
    const failures = [];
    if (Math.abs(Number(state.visual?.scale) - 2) > .05) failures.push(`native pageScale ${state.visual?.scale} !== 2`);
    if (state.cssKeyboardOffset !== 0) failures.push(`pageScale 2 was misreported as ${state.cssKeyboardOffset}px keyboard offset`);
    if (!Number.isFinite(snapshotOffset) || snapshotOffset !== 0) failures.push(`pipeline snapshot keyboard offset is invalid at pageScale 2: ${JSON.stringify(snapshotViewport)}`);
    return { kind: "frame-pipeline", name: "native-pagescale-not-keyboard", shell: "mobile", viewport, realSoftKeyboardTested: false, state, failures, status: failures.length ? "FAIL" : "PASS" };
  } finally {
    await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 }).catch(() => {});
  }
}

async function installCapabilityProfile(client, profile) {
  const hardwareConcurrency = profile.hardwareConcurrency === undefined ? "undefined" : JSON.stringify(profile.hardwareConcurrency);
  const connection = profile.unknown
    ? "undefined"
    : JSON.stringify({ saveData: Boolean(profile.saveData), effectiveType: "4g", downlink: 10, rtt: 50 });
  const source = `(() => {
    const set = (name, value) => { try { Object.defineProperty(navigator, name, { configurable:true, get:() => value }); } catch {} };
    set('hardwareConcurrency', ${hardwareConcurrency});
    set('connection', ${connection});
    set('mozConnection', ${connection});
    set('webkitConnection', ${connection});
  })();`;
  return client.send("Page.addScriptToEvaluateOnNewDocument", { source });
}

async function auditPerformanceTier(client, origin, viewport, profile, output) {
  await emulate(client, viewport);
  const script = await installCapabilityProfile(client, profile);
  try {
    await client.send("Page.navigate", { url: `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0&audit-performance=${profile.name}` });
    await stable(client, "home");
  } finally {
    await client.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: script.identifier }).catch(() => {});
  }
  const state = await evaluate(client, `(() => {
    const snapshot=window.LusuFramePipeline?.snapshot?.() || window.LusuFramePipeline?.debugSnapshot?.() || null;
    const tier=document.documentElement.dataset.performanceTier || document.body.dataset.performanceTier || snapshot?.tier || snapshot?.performanceTier || '';
    const viewportArea=innerWidth*innerHeight;
    const offenders=[...document.querySelectorAll('body *')].flatMap((element) => {
      const rect=element.getBoundingClientRect();
      const style=getComputedStyle(element);
      if (rect.width*rect.height < viewportArea*.2 || style.display==='none' || style.visibility==='hidden') return [];
      const filter=style.filter || 'none';
      const backdropFilter=style.backdropFilter || style.webkitBackdropFilter || 'none';
      const willChange=style.willChange || 'auto';
      if (filter==='none' && backdropFilter==='none' && willChange==='auto') return [];
      return [{ tag:element.tagName.toLowerCase(), id:element.id, className:String(element.className||'').slice(0,120), filter, backdropFilter, willChange, area:Math.round(rect.width*rect.height) }];
    });
    for (const [selector, pseudo] of [['.site-shell','::before'], ['#wallpaper-root','::before'], ['#wallpaper-root','::after']]) {
      const element=document.querySelector(selector);
      if (!element) continue;
      const style=getComputedStyle(element, pseudo);
      const filter=style.filter || 'none';
      const backdropFilter=style.backdropFilter || style.webkitBackdropFilter || 'none';
      const willChange=style.willChange || 'auto';
      if (filter!=='none' || backdropFilter!=='none' || willChange!=='auto') offenders.push({ tag:selector+pseudo, filter, backdropFilter, willChange, area:viewportArea });
    }
    return { tier, snapshot, capability:{ hardwareConcurrency:navigator.hardwareConcurrency, saveData:navigator.connection?.saveData }, offenders };
  })()`);
  const expectedTier = profile.unknown ? "normal" : "low";
  const failures = [];
  if (state.tier !== expectedTier) failures.push(`${profile.name} tier ${state.tier || "<empty>"} !== ${expectedTier}`);
  if (expectedTier === "low" && state.offenders.length) failures.push(`low tier retained large-area paint effects: ${JSON.stringify(state.offenders)}`);
  let screenshotFile = "";
  if (profile.screenshot) {
    const shot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    screenshotFile = `performance-low-${viewport.width}x${viewport.height}.png`;
    await writeFile(resolve(output, screenshotFile), Buffer.from(shot.data, "base64"));
  }
  return { kind: "performance-tier", name: profile.name, shell: "mobile", viewport, screenshotFile, state, failures, status: failures.length ? "FAIL" : "PASS" };
}

async function capture(client, origin, output, viewport, route) {
  await emulate(client, viewport);
  const url = route === "article" ? `${origin}/articles/${article.slug}?lang=zh&wallpaper=${fixedTheme}&welcome=0` : `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#${route}`;
  await navigateFresh(client, url, `capture-${route}-${viewport.width}x${viewport.height}`);
  await stable(client, route);
  if (viewport.mobile) {
    await evaluate(client, `(() => { window.LusuFramePipeline?.noteEditingFocus?.(false,false); return true; })()`);
    await waitFrames(client, 3);
    await ensureDockState(client, false);
  }
  const metrics = await evaluate(client, metricsCode); const failures = check(viewport, route, metrics);
  const shot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false }); const file = `${route}-${viewport.width}x${viewport.height}.png`;
  await writeFile(resolve(output, file), Buffer.from(shot.data, "base64")); return { route, viewport, url, file, metrics, failures, status: failures.length ? "FAIL" : "PASS" };
}

async function settleScreenshotState(client) {
  await client.send("Page.bringToFront");
  await evaluate(client, `(async () => {
    const bounded = (promise, timeout = 1600) => Promise.race([
      Promise.resolve(promise).catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, timeout))
    ]);
    await bounded(document.fonts?.ready, 2400);
    await Promise.all([...document.images].map(async (image) => {
      try {
        if (typeof image.decode === 'function') await bounded(image.decode());
        else if (!image.complete) await bounded(new Promise((resolve) => {
          image.addEventListener('load', resolve, { once:true });
          image.addEventListener('error', resolve, { once:true });
        }));
      } catch {}
    }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return true;
  })()`);
}

async function captureViewportScreenshot(client, output, file) {
  await settleScreenshotState(client);
  // On Windows, the first surface capture can occasionally miss a fixed
  // compositor layer. Warm the surface, settle one more frame, then save the
  // second capture so the visual evidence contains the same chrome that the
  // geometry and hit-testing checks measured.
  await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  });
  await evaluate(client, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
  const shot = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  });
  await writeFile(resolve(output, file), Buffer.from(shot.data, "base64"));
  return file;
}

async function readResourceVisualState(client) {
  return evaluate(client, `(() => {
    const round = (value) => Math.round(Number(value || 0) * 100) / 100;
    const rect = (node) => {
      if (!node) return null;
      const value = node.getBoundingClientRect();
      return { left:round(value.left), top:round(value.top), right:round(value.right), bottom:round(value.bottom), width:round(value.width), height:round(value.height) };
    };
    const visible = (node) => {
      if (!node || node.hidden) return false;
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > .01 && box.width > 0 && box.height > 0;
    };
    const chromeNode = (selector) => {
      const node = document.querySelector(selector);
      const box = rect(node);
      const style = node ? getComputedStyle(node) : null;
      const isVisible = visible(node);
      let hit = null;
      let center = null;
      if (node && box && isVisible) {
        const x = round(box.left + box.width / 2);
        const y = round(box.top + box.height / 2);
        const target = x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight
          ? document.elementFromPoint(x, y)
          : null;
        const related = Boolean(target && (target === node || node.contains(target) || target.contains(node)));
        hit = target ? { tag:target.tagName, id:target.id || '', className:String(target.className || '') } : null;
        center = { x, y, related, hit };
      }
      return {
        selector,
        exists:Boolean(node),
        visible:isVisible,
        text:node?.textContent?.replace(/\s+/g, ' ').trim() || '',
        ariaLabel:node?.getAttribute?.('aria-label') || '',
        box,
        display:style?.display || '',
        visibility:style?.visibility || '',
        opacity:style ? Number(style.opacity) : 0,
        pointerEvents:style?.pointerEvents || '',
        center
      };
    };
    const overlap = (first, second) => !first || !second ? 0 : round(
      Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left))
      * Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top))
    );
    const contains = (outer, inner) => Boolean(outer && inner
      && inner.left >= outer.left - 1 && inner.right <= outer.right + 1
      && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1);
    const list = document.getElementById('resource-list');
    const categories = document.getElementById('resource-categories');
    const cards = [...document.querySelectorAll('#resource-list > .resource-card')].filter(visible).map((card, index) => {
      const cardRect = rect(card);
      const main = card.querySelector('.resource-main');
      const title = main?.querySelector('h2');
      const icon = title?.querySelector('.resource-icon,.resource-icon-image');
      const description = main?.querySelector(':scope > p');
      const meta = main?.querySelector('.meta-row');
      const action = card.querySelector(':scope > .card-action');
      const boxes = {
        card:cardRect,
        main:rect(main),
        title:rect(title),
        icon:rect(icon),
        description:rect(description),
        meta:rect(meta),
        action:rect(action)
      };
      const children = [boxes.main, boxes.action].filter(Boolean);
      return {
        index,
        title:title?.textContent?.trim() || '',
        boxes,
        contained:children.every((child) => contains(cardRect, child)),
        horizontalOverflow:card.scrollWidth > card.clientWidth + 1 || main?.scrollWidth > main?.clientWidth + 1,
        intersections:{
          titleDescription:overlap(boxes.title, boxes.description),
          descriptionMeta:overlap(boxes.description, boxes.meta),
          mainAction:overlap(boxes.main, boxes.action)
        },
        actionMin44:Boolean(boxes.action && boxes.action.width >= 43.5 && boxes.action.height >= 43.5),
        iconStyle:icon ? {
          backgroundImage:getComputedStyle(icon).backgroundImage,
          backgroundPosition:getComputedStyle(icon).backgroundPosition,
          backgroundSize:getComputedStyle(icon).backgroundSize,
          imageRendering:getComputedStyle(icon).imageRendering,
          currentSrc:icon instanceof HTMLImageElement ? icon.currentSrc : ''
        } : null
      };
    });
    const app = document.getElementById('transfer-app');
    const gate = document.getElementById('transfer-login-gate');
    const transfer = app && !app.hidden ? {
      app:rect(app),
      header:rect(app.querySelector('.transfer-app-header')),
      gate:rect(gate),
      actions:rect(gate?.querySelector('.transfer-login-actions')),
      back:app.querySelector('#transfer-back-to-resources')?.textContent?.replace(/\\s+/g, ' ').trim() || '',
      loginBack:gate?.querySelector('[data-transfer-login-back]')?.textContent?.replace(/\\s+/g, ' ').trim() || '',
      buttons:[...(gate?.querySelectorAll('button') || [])].filter(visible).map((button) => ({ text:button.textContent.trim(), box:rect(button) })),
      horizontalOverflow:app.scrollWidth > app.clientWidth + 1 || (gate && gate.scrollWidth > gate.clientWidth + 1)
    } : null;
    const listRect = rect(list);
    const dockRect = rect(document.querySelector('.xp-taskbar'));
    return {
      route:document.body.dataset.route || '',
      hash:location.hash,
      shell:document.documentElement.dataset.uiShell || '',
      lang:document.documentElement.lang,
      viewport:{ width:innerWidth, height:innerHeight, visualWidth:round(visualViewport?.width || innerWidth), visualHeight:round(visualViewport?.height || innerHeight) },
      document:{ clientWidth:document.documentElement.clientWidth, scrollWidth:Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) },
      list:{ box:listRect, clientWidth:list?.clientWidth || 0, scrollWidth:list?.scrollWidth || 0, clientHeight:list?.clientHeight || 0, scrollHeight:list?.scrollHeight || 0 },
      contentVisibility:{
        categoriesHidden:categories?.hidden ?? true,
        categoriesVisible:visible(categories),
        listHidden:list?.hidden ?? true,
        listVisible:visible(list),
        appHidden:app?.hidden ?? true,
        appVisible:visible(app),
        loaderVisible:visible(document.getElementById('transfer-loader-status'))
      },
      cards,
      transfer,
      sectionLabels:{
        heading:document.getElementById('resources-title')?.textContent?.trim() || '',
        windowTitle:document.querySelector('#resources .window-titlebar [data-i18n="resourcesTitle"]')?.textContent?.trim() || '',
        routeTitle:document.getElementById('mobile-route-title')?.textContent?.trim() || '',
        dockFull:document.querySelector('.xp-taskbar [data-route="resources"] .dock-label-full')?.textContent?.trim() || '',
        dockShort:document.querySelector('.xp-taskbar [data-route="resources"] .dock-label-short')?.textContent?.trim() || ''
      },
      chrome:{
        topbar:chromeNode('.xp-topbar'),
        brand:chromeNode('.xp-topbar > .brand-button'),
        mobileHome:chromeNode('.mobile-home-button'),
        mobileHomeLabel:chromeNode('.mobile-home-label'),
        routeTitle:chromeNode('#mobile-route-title'),
        topbarActions:chromeNode('.xp-topbar > .topbar-actions'),
        accountToggle:chromeNode('.xp-topbar [data-account-toggle]'),
        languageSwitcher:chromeNode('.xp-topbar .language-switcher'),
        topUpdated:chromeNode('.xp-topbar .top-updated'),
        taskbar:chromeNode('.xp-taskbar'),
        start:chromeNode('.xp-taskbar .start-button'),
        startFullLabel:chromeNode('.xp-taskbar .start-button .dock-label-full'),
        startShortLabel:chromeNode('.xp-taskbar .start-button .dock-label-short')
      },
      dock:dockRect,
      runtimeErrors:[...(window.__auditRuntimeErrors || [])]
    };
  })()`);
}

function resourceChromeRequirements(viewport) {
  return viewport.mobile
    ? Object.freeze({ topbar:false, mobileHome:true, mobileHomeLabel:true, routeTitle:true, taskbar:false, start:true, startShortLabel:true })
    : Object.freeze({ topbar:false, brand:true, topbarActions:true, accountToggle:true, languageSwitcher:true, topUpdated:true, taskbar:false, start:true, startFullLabel:true });
}

function checkResourceChromeState(viewport, state, label) {
  const failures = [];
  const requirements = resourceChromeRequirements(viewport);
  for (const [key, compareText] of Object.entries(requirements)) {
    const item = state.chrome?.[key];
    if (!item?.exists || !item.visible) {
      failures.push(`${label} global chrome ${key} is not visible: ${JSON.stringify(item || null)}`);
      continue;
    }
    if (compareText && !item.text) failures.push(`${label} global chrome ${key} lost its visible text`);
    if (item.center?.related !== true) failures.push(`${label} global chrome ${key} center is occluded: ${JSON.stringify(item.center || null)}`);
  }
  return failures;
}

function checkResourceChromeRetention(viewport, initialState, currentState, label) {
  const failures = [];
  const requirements = resourceChromeRequirements(viewport);
  for (const [key, compareText] of Object.entries(requirements)) {
    const initial = initialState.chrome?.[key];
    const current = currentState.chrome?.[key];
    if (!initial?.visible || !current?.visible) continue;
    if (compareText && current.text !== initial.text) failures.push(`${label} global chrome ${key} text changed ${JSON.stringify(initial.text)} -> ${JSON.stringify(current.text)}`);
    for (const dimension of ['left', 'top', 'width', 'height']) {
      const before = initial.box?.[dimension];
      const after = current.box?.[dimension];
      if (Number.isFinite(before) && Number.isFinite(after) && Math.abs(before - after) > 1.5) failures.push(`${label} global chrome ${key} ${dimension} shifted ${before} -> ${after}`);
    }
  }
  return failures;
}

function checkResourceVisualState(viewport, state, { transferOpen = false, lang = 'zh' } = {}) {
  const failures = [];
  const expectedLabels = resourceDisplayLabels[lang];
  if (state.viewport.width !== viewport.width || state.viewport.height !== viewport.height) failures.push(`exact viewport is ${state.viewport.width}x${state.viewport.height}, expected ${viewport.width}x${viewport.height}`);
  if (Math.abs(state.viewport.visualWidth - viewport.width) > .5 || Math.abs(state.viewport.visualHeight - viewport.height) > .5) failures.push(`visual viewport is ${state.viewport.visualWidth}x${state.viewport.visualHeight}`);
  if (state.document.clientWidth !== viewport.width || state.document.scrollWidth !== viewport.width) failures.push(`document width ${state.document.clientWidth}/${state.document.scrollWidth} !== ${viewport.width}`);
  if (state.route !== 'resources') failures.push(`route ${state.route} !== resources`);
  if (state.hash !== '#resources') failures.push(`stable Tools route hash ${state.hash} !== #resources`);
  if (state.shell !== (viewport.mobile ? 'mobile' : 'desktop')) failures.push(`shell ${state.shell} is wrong`);
  if (state.lang !== semanticLanguages[lang]?.htmlLang) failures.push(`document language ${state.lang} !== ${semanticLanguages[lang]?.htmlLang || lang}`);
  for (const [key, value] of Object.entries({
    heading:expectedLabels?.title,
    windowTitle:expectedLabels?.title,
    routeTitle:expectedLabels?.title,
    dockFull:expectedLabels?.title,
    dockShort:expectedLabels?.dock
  })) {
    if (state.sectionLabels?.[key] !== value) failures.push(`Tools ${lang} ${key} label ${JSON.stringify(state.sectionLabels?.[key] || '')} !== ${JSON.stringify(value || '')}`);
  }
  failures.push(...checkResourceChromeState(viewport, state, transferOpen ? 'Quick Transfer' : 'Resources'));
  if (!transferOpen && state.cards.length !== expectedLabels.cards.length) failures.push(`visible Resource card count ${state.cards.length} !== ${expectedLabels.cards.length}`);
  if (!transferOpen) {
    const visibleTitles = state.cards.map((card) => card.title);
    for (const title of expectedLabels.cards) {
      if (!visibleTitles.includes(title)) failures.push(`Resource card ${JSON.stringify(title)} is missing from ${JSON.stringify(visibleTitles)}`);
    }
  }
  if (!transferOpen && state.list.scrollWidth > state.list.clientWidth + 1) failures.push(`Resource list overflows horizontally ${state.list.scrollWidth}/${state.list.clientWidth}`);
  for (const card of state.cards) {
    if (!card.contained) failures.push(`Resource card ${card.index} children escape: ${JSON.stringify(card.boxes)}`);
    if (card.horizontalOverflow) failures.push(`Resource card ${card.index} has horizontal overflow`);
    if (Object.values(card.intersections).some((area) => area > 1)) failures.push(`Resource card ${card.index} children intersect: ${JSON.stringify(card.intersections)}`);
    if (!card.actionMin44) failures.push(`Resource card ${card.index} action is below 44px: ${JSON.stringify(card.boxes.action)}`);
  }
  if (transferOpen) {
    if (!state.transfer) failures.push('Quick Transfer did not expose the sign-in task');
    else {
      if (state.transfer.horizontalOverflow) failures.push('Quick Transfer sign-in task overflows horizontally');
      if (state.transfer.back !== expectedLabels?.transferBack) failures.push(`Quick Transfer ${lang} back label ${JSON.stringify(state.transfer.back)} !== ${JSON.stringify(expectedLabels?.transferBack || '')}`);
      if (state.transfer.loginBack !== expectedLabels?.transferLoginBack) failures.push(`Quick Transfer ${lang} login back label ${JSON.stringify(state.transfer.loginBack)} !== ${JSON.stringify(expectedLabels?.transferLoginBack || '')}`);
      for (const button of state.transfer.buttons) if (button.box.width < 43.5 || button.box.height < 43.5) failures.push(`Quick Transfer button is below 44px: ${JSON.stringify(button)}`);
    }
  }
  if (state.runtimeErrors.length) failures.push(`runtime errors: ${state.runtimeErrors.join(' | ')}`);
  return failures;
}

function checkResourceReturnState(viewport, initialState, returnedState, lang) {
  const failures = checkResourceVisualState(viewport, returnedState, { lang });
  failures.push(...checkResourceChromeRetention(viewport, initialState, returnedState, 'Returned Resources'));
  const initialVisibility = initialState.contentVisibility;
  const returnedVisibility = returnedState.contentVisibility;
  if (returnedVisibility.appVisible || !returnedVisibility.appHidden) failures.push('Quick Transfer remains visible after returning to Resources');
  if (returnedVisibility.loaderVisible) failures.push('Quick Transfer loader remains visible after returning to Resources');
  if (!returnedVisibility.listVisible || returnedVisibility.listHidden) failures.push('Resource list is not restored after closing Quick Transfer');
  for (const key of ['categoriesHidden', 'categoriesVisible', 'listHidden', 'listVisible']) {
    if (returnedVisibility[key] !== initialVisibility[key]) failures.push(`Resource ${key} changed across the Quick Transfer round trip`);
  }
  for (const key of ['left', 'top', 'width']) {
    const initial = initialState.list.box?.[key];
    const returned = returnedState.list.box?.[key];
    if (Number.isFinite(initial) && Number.isFinite(returned) && Math.abs(initial - returned) > 1) failures.push(`Resource list ${key} shifted ${initial} -> ${returned} after closing Quick Transfer`);
  }
  return failures;
}

async function auditResourcesVisualReview(client, origin, output) {
  const boundaryViewport = Object.freeze({ name:'mobile-shell-boundary', width:760, height:900, mobile:true });
  const reviewViewports = resourceVisualViewportKeys.map((key) => key === '760x900'
    ? boundaryViewport
    : viewports.find((viewport) => `${viewport.width}x${viewport.height}` === key));
  if (reviewViewports.some((viewport) => !viewport)) throw new Error(`Resources visual review viewport contract is incomplete: ${resourceVisualViewportKeys.join(', ')}`);
  const results = [];
  for (const viewport of reviewViewports) {
    await emulate(client, viewport);
    for (const lang of resourceVisualLanguages) {
      await navigateFresh(client, `${origin}/?lang=${lang}&wallpaper=${fixedTheme}&welcome=0#resources`, `resource-visual-${lang}-${viewport.width}x${viewport.height}`);
      await stable(client, 'resources');
      if (viewport.mobile) await ensureDockState(client, false);
      await settleScreenshotState(client);
      const state = await readResourceVisualState(client);
      const screenshotFile = await captureViewportScreenshot(client, output, `resources-${lang}-${viewport.width}x${viewport.height}.png`);
      const failures = checkResourceVisualState(viewport, state, { lang });
      results.push({ kind:'resource-visual-review', name:`resources-${lang}-${viewport.width}x${viewport.height}`, route:'resources', shell:viewport.mobile ? 'mobile' : 'desktop', viewport, lang, screenshotFile, state, failures, status:failures.length ? 'FAIL' : 'PASS' });

      const transferOpen = await openQuickTransferFromCta(client);
      await settleScreenshotState(client);
      const transferState = await readResourceVisualState(client);
      const transferScreenshotFile = await captureViewportScreenshot(client, output, `transfer-login-${lang}-${viewport.width}x${viewport.height}.png`);
      const transferFailures = checkResourceVisualState(viewport, transferState, { transferOpen:true, lang });
      transferFailures.push(...checkResourceChromeRetention(viewport, state, transferState, `Quick Transfer ${lang}`));
      if (!transferOpen.loadingReached || !transferOpen.state?.appVisible) transferFailures.push(`Quick Transfer loader state is incomplete: ${JSON.stringify(transferOpen)}`);
      results.push({ kind:'resource-visual-review', name:`transfer-login-${lang}-${viewport.width}x${viewport.height}`, route:'resources', shell:viewport.mobile ? 'mobile' : 'desktop', viewport, lang, screenshotFile:transferScreenshotFile, state:transferState, transferOpen, failures:transferFailures, status:transferFailures.length ? 'FAIL' : 'PASS' });

      const returnSelector = lang === 'en' ? '[data-transfer-login-back]' : '#transfer-back-to-resources';
      const transferClose = await evaluate(client, `(() => {
        const button = document.querySelector(${JSON.stringify(returnSelector)});
        if (!button) return { clicked:false, reason:'missing back button' };
        button.click();
        return { clicked:true, selector:${JSON.stringify(returnSelector)} };
      })()`);
      await waitFor(client, `document.getElementById('transfer-app')?.hidden===true&&document.getElementById('resource-list')?.hidden===false`, `Quick Transfer ${lang} return to Resources`);
      await settleScreenshotState(client);
      const returnedState = await readResourceVisualState(client);
      const returnedScreenshotFile = await captureViewportScreenshot(client, output, `resources-returned-${lang}-${viewport.width}x${viewport.height}.png`);
      const returnedFailures = checkResourceReturnState(viewport, state, returnedState, lang);
      if (!transferClose.clicked) returnedFailures.push(`Quick Transfer close action failed: ${JSON.stringify(transferClose)}`);
      results.push({ kind:'resource-visual-review', name:`resources-returned-${lang}-${viewport.width}x${viewport.height}`, route:'resources', shell:viewport.mobile ? 'mobile' : 'desktop', viewport, lang, screenshotFile:returnedScreenshotFile, state:returnedState, transferClose, failures:returnedFailures, status:returnedFailures.length ? 'FAIL' : 'PASS' });
    }

    if ([390, 1280].includes(viewport.width)) {
      for (const route of ['home', 'games']) {
        await navigateFresh(client, `${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0#${route}`, `resource-reference-${route}-${viewport.width}x${viewport.height}`);
        await stable(client, route);
        if (viewport.mobile) await ensureDockState(client, false);
        await settleScreenshotState(client);
        const referenceMetrics = await evaluate(client, metricsCode);
        const referenceScreenshotFile = await captureViewportScreenshot(client, output, `${route}-reference-zh-${viewport.width}x${viewport.height}.png`);
        const referenceFailures = check(viewport, route, referenceMetrics)
          .filter((failure) => route !== 'home' || !failure.startsWith('active window overlaps Dock'));
        results.push({ kind:'resource-visual-reference', name:`${route}-zh-${viewport.width}x${viewport.height}`, route, shell:viewport.mobile ? 'mobile' : 'desktop', viewport, lang:'zh', screenshotFile:referenceScreenshotFile, metrics:referenceMetrics, failures:referenceFailures, status:referenceFailures.length ? 'FAIL' : 'PASS' });
      }
    }
  }
  await writeFile(resolve(output, 'resources-visual-summary.json'), `${JSON.stringify({ generatedAt:new Date().toISOString(), fixedTheme, exactCdpViewport:true, languages:resourceVisualLanguages, viewportKeys:resourceVisualViewportKeys, expectedResultCount:resourceVisualExpectedResultCount, resultCount:results.length, ...mobileViewportLimitations, results }, null, 2)}\n`, 'utf8');
  if (results.length !== resourceVisualExpectedResultCount) throw new Error(`Resources visual review result count ${results.length} !== ${resourceVisualExpectedResultCount}`);
  return results;
}

async function readDockIconTransitionState(client) {
  return evaluate(client, `(() => {
    const round = (value) => Math.round(Number(value || 0) * 100) / 100;
    const rect = (node) => {
      if (!node) return null;
      const value = node.getBoundingClientRect();
      return { left:round(value.left), top:round(value.top), right:round(value.right), bottom:round(value.bottom), width:round(value.width), height:round(value.height) };
    };
    const style = (node) => node ? getComputedStyle(node) : null;
    const imageState = (selector) => {
      const node = document.querySelector(selector);
      const computed = style(node);
      return {
        selector,
        rect:rect(node),
        display:computed?.display || "",
        visibility:computed?.visibility || "",
        opacity:computed?.opacity || "",
        backgroundImage:computed?.backgroundImage || "",
        complete:node instanceof HTMLImageElement ? node.complete : null,
        naturalWidth:node instanceof HTMLImageElement ? node.naturalWidth : null,
        currentSrc:node instanceof HTMLImageElement ? node.currentSrc : ""
      };
    };
    const dock = document.querySelector('.xp-taskbar');
    const dockStyle = style(dock);
    const scroller = document.querySelector('.mobile-dock-scroll');
    const active = scroller?.querySelector('[aria-current="page"]');
    return {
      route:document.body?.dataset.route || "",
      motion:document.documentElement.dataset.motion || document.body?.dataset.motion || "",
      performanceTier:document.documentElement.dataset.performanceTier || "",
      documentHidden:document.hidden,
      transition:document.documentElement.dataset.uiTransition || "",
      direction:document.documentElement.dataset.uiDirection || "",
      activeAnimations:document.getAnimations().map((animation) => ({
        playState:animation.playState,
        currentTime:round(animation.currentTime),
        targetClass:animation.effect?.target?.className || ""
      })),
      startViewTransitionCalls:Number(window.__auditStartViewTransitionCalls || 0),
      dock:{
        rect:rect(dock),
        display:dockStyle?.display || "",
        visibility:dockStyle?.visibility || "",
        opacity:dockStyle?.opacity || "",
        transform:dockStyle?.transform || "",
        activeRoute:active?.dataset.route || "",
        indicatorHidden:scroller?.classList.contains('has-no-dock-route') || false,
        sameNode:window.__auditDockNode === dock
      },
      icons:{
        home:imageState('.desktop-icon[data-route="chatroom"] .chatroom-icon'),
        dock:imageState('.taskbar-tabs [data-route="chatroom"] .chat-mini-icon'),
        avatar:imageState('#chatroom .chatroom-avatar')
      },
      runtimeErrors:[...(window.__auditRuntimeErrors || [])]
    };
  })()`);
}

async function auditDockIconTransition(client, origin, output) {
  const viewport = viewports.find((item) => item.width === 390 && item.height === 844);
  await emulate(client, viewport);
  await client.send("Page.bringToFront");
  await client.send("Emulation.setEmulatedMedia", {
    media: "screen",
    features: [
      { name:"prefers-reduced-motion", value:"no-preference" },
      { name:"prefers-color-scheme", value:"light" }
    ]
  });
  await client.send("Page.navigate", { url:`${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0&audit-dock-icon=1` });
  await waitFor(client, `document.readyState==='complete'&&document.documentElement.dataset.uiShell==='mobile'&&document.body.dataset.route==='home'`, "full-motion mobile Home");
  await evaluate(client, `(async()=>{document.documentElement.dataset.performanceTier='normal';document.body.dataset.performanceTier='normal';window.LusuUiMotion?.setMode?.('full');await document.fonts?.ready;await new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)));return document.documentElement.dataset.motion})()`);
  await waitFor(client, `document.documentElement.dataset.motion==='full'`, "full motion mode");
  await ensureDockState(client, false);
  await waitFrames(client, 4);
  await evaluate(client, `(() => {
    window.__auditDockNode=document.querySelector('.xp-taskbar');
    window.__auditStartViewTransitionCalls=0;
    const native=document.startViewTransition?.bind(document);
    if (native && !document.__auditStartViewTransitionWrapped) {
      document.__auditStartViewTransitionWrapped=true;
      document.startViewTransition=(callback) => {
        window.__auditStartViewTransitionCalls += 1;
        return native(callback);
      };
    }
    return true;
  })()`);

  const samples = [];
  const take = async (name, frameTime = null) => {
    if (Number.isFinite(frameTime)) {
      await evaluate(client, `(() => {
        (window.__auditFrameAnimations || []).forEach((animation) => {
          animation.currentTime=${JSON.stringify(frameTime)};
        });
        return true;
      })()`);
    } else {
      await waitFrames(client, 1);
    }
    const state = await readDockIconTransitionState(client);
    const screenshotFile = await captureViewportScreenshot(client, output, `${String(samples.length + 1).padStart(2, "0")}-${name}-390x844.png`);
    samples.push({ name, frameTime, screenshotFile, state });
  };

  await take("home-before");
  await evaluate(client, `(async()=>{
    const button=document.querySelector('.taskbar-tabs button[data-route="chatroom"]');
    if (!button) throw new Error('Chat Dock button is missing');
    button.click();
    await Promise.resolve();
    const animations=document.getAnimations().filter((animation)=>animation.playState==='running');
    animations.forEach((animation)=>animation.pause());
    await Promise.allSettled(animations.map((animation)=>animation.ready));
    animations.forEach((animation)=>{ animation.currentTime=0; });
    window.__auditFrameAnimations=animations;
    return animations.length;
  })()`);
  await take("chat-transition-start", 0);
  await take("chat-transition-60ms", 60);
  await take("chat-transition-140ms", 140);
  await take("chat-after", 220);
  await evaluate(client, `(() => {
    (window.__auditFrameAnimations || []).forEach((animation) => {
      try { animation.finish(); } catch {}
    });
    window.__auditFrameAnimations=[];
    return true;
  })()`);
  await waitFor(client, `document.body.dataset.route==='chatroom'`, "Chat route");
  await waitFor(client, `window.__lusuRouteModulesAudit?.().chatroom==='ready'`, "Chat route module");
  await waitFor(client, `!document.documentElement.dataset.uiTransition`, "Chat transition cleanup");
  await waitFrames(client, 4);
  await take("chat-stable");

  await evaluate(client, `(() => {
    window.__auditStartViewTransitionCalls=0;
    document.querySelector('.taskbar-tabs button[data-route="knowledge"]')?.click();
    return true;
  })()`);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 40));
  await evaluate(client, `(() => {
    document.querySelector('.taskbar-tabs button[data-route="games"]')?.click();
    return true;
  })()`);
  await waitFor(client, `document.body.dataset.route==='games'`, "rapid-switch Games route");
  await waitFor(client, `window.__lusuRouteModulesAudit?.().games==='ready'`, "rapid-switch Games route module");
  await waitFor(client, `!document.documentElement.dataset.uiTransition`, "rapid-switch transition cleanup");
  await waitFrames(client, 2);
  await take("rapid-switch-games");

  const responsiveSamples = [];
  for (const responsiveViewport of [
    viewports.find((item) => item.width === 359 && item.height === 500),
    viewports.find((item) => item.width === 844 && item.height === 390)
  ]) {
    await emulate(client, responsiveViewport);
    await client.send("Emulation.setEmulatedMedia", {
      media: "screen",
      features: [
        { name:"prefers-reduced-motion", value:"no-preference" },
        { name:"prefers-color-scheme", value:"light" }
      ]
    });
    await client.send("Page.navigate", { url:`${origin}/?lang=zh&wallpaper=${fixedTheme}&welcome=0&audit-dock-icon=1#chatroom` });
    await waitFor(client, `document.readyState==='complete'&&document.documentElement.dataset.uiShell==='mobile'&&document.body.dataset.route==='chatroom'`, `responsive Chat ${responsiveViewport.width}x${responsiveViewport.height}`);
    await waitFor(client, `window.__lusuRouteModulesAudit?.().chatroom==='ready'`, `responsive Chat module ${responsiveViewport.width}x${responsiveViewport.height}`);
    await evaluate(client, `(async()=>{document.documentElement.dataset.performanceTier='normal';document.body.dataset.performanceTier='normal';window.LusuUiMotion?.setMode?.('full');window.__auditDockNode=document.querySelector('.xp-taskbar');window.__auditStartViewTransitionCalls=0;await document.fonts?.ready;await new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)));return true;})()`);
    await ensureDockState(client, false);
    await waitFrames(client, 4);
    const state = await readDockIconTransitionState(client);
    const screenshotFile = await captureViewportScreenshot(client, output, `${String(samples.length + responsiveSamples.length + 1).padStart(2, "0")}-chat-stable-${responsiveViewport.width}x${responsiveViewport.height}.png`);
    responsiveSamples.push({ viewport:responsiveViewport, screenshotFile, state });
  }

  const failures = [];
  const first = samples[0]?.state;
  const chatStable = samples.find((sample) => sample.name === "chat-stable")?.state;
  const last = samples.at(-1)?.state;
  if (first?.motion !== "full" || first?.performanceTier !== "normal" || first?.documentHidden) failures.push("Dock transition audit did not run in a visible full-motion normal-performance page");
  if (!first?.icons?.home?.backgroundImage || first.icons.home.backgroundImage === "none") failures.push("Home Chat icon has no background image before the Chat route is loaded");
  if (!first?.icons?.dock?.backgroundImage || first.icons.dock.backgroundImage === "none") failures.push("Dock Chat icon has no background image");
  if (!chatStable?.icons?.avatar?.complete || chatStable.icons.avatar.naturalWidth <= 0) failures.push("Chat avatar did not decode");
  if (samples.some((sample) => !sample.state?.dock?.rect || sample.state.dock.display === "none" || sample.state.dock.visibility === "hidden" || Number(sample.state.dock.opacity) <= .01)) failures.push("Dock became unavailable during route switching");
  if (samples.some((sample) => sample.state?.dock?.sameNode === false)) failures.push("Dock DOM node identity changed during route switching");
  if (last?.route !== "games" || last?.dock?.activeRoute !== "games") failures.push("Rapid mobile route switching did not settle on the Games route and Dock item");
  if (last?.startViewTransitionCalls !== 0) failures.push(`Mobile route switching used document.startViewTransition ${last.startViewTransitionCalls} time(s)`);
  if (samples.some((sample) => sample.state.runtimeErrors.length)) failures.push("Runtime errors occurred during the Dock/Chat icon flow");
  for (const sample of responsiveSamples) {
    const label = `${sample.viewport.width}x${sample.viewport.height}`;
    const avatar = sample.state?.icons?.avatar;
    const dock = sample.state?.dock;
    if (!avatar?.complete || avatar.naturalWidth <= 0 || !avatar.rect || avatar.display === "none" || avatar.visibility === "hidden") failures.push(`Chat avatar is unavailable at ${label}`);
    if (!dock?.rect || dock.display === "none" || dock.visibility === "hidden" || Number(dock.opacity) <= .01) failures.push(`Dock is unavailable at ${label}`);
    if (sample.state?.runtimeErrors?.length) failures.push(`Runtime errors occurred at ${label}`);
  }
  const result = { kind:"dock-icon-transition", name:"mobile-dock-chat-icon", shell:"mobile", viewport, samples, responsiveSamples, failures, status:failures.length ? "FAIL" : "PASS" };
  await writeFile(resolve(output, "dock-icon-summary.json"), `${JSON.stringify({ generatedAt:new Date().toISOString(), result }, null, 2)}\n`, "utf8");
  return result;
}

async function auditArticleScrollAndProgress(client, origin, viewport) {
  await emulate(client, viewport);
  await client.send("Page.navigate", { url: `${origin}/articles/${article.slug}?lang=zh&wallpaper=${fixedTheme}&welcome=0` });
  await stable(client, "article");
  let state;
  try {
    await evaluate(client, `(() => {
      const body=document.getElementById('article-detail-body');
      const growth=document.createElement('div');
      growth.id='audit-article-progress-growth';
      growth.setAttribute('aria-hidden','true');
      growth.style.cssText='height:1400px;min-height:1400px;pointer-events:none;';
      body.append(growth);
      return true;
    })()`);
    await waitFrames(client, 3);
    await evaluate(client, `(() => {
      const detail=document.getElementById('article-detail');
      const scrollable=Math.max(0,detail.scrollHeight-detail.clientHeight);
      detail.scrollTop=Math.round(scrollable*.47);
      detail.dispatchEvent(new Event('scroll'));
      return true;
    })()`);
    await waitFrames(client, 5);
    state = await evaluate(client, `(() => {
      const rect=(element) => { const value=element?.getBoundingClientRect(); return value ? { top:value.top, right:value.right, bottom:value.bottom, left:value.left, width:value.width, height:value.height } : null; };
      const overlap=(a,b) => !a||!b ? 0 : Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      const scrolling=document.scrollingElement||document.documentElement;
      const detail=document.getElementById('article-detail');
      const body=document.getElementById('article-detail-body');
      const progress=document.querySelector('#knowledge .article-read-progress');
      const track=document.getElementById('article-read-progress-bar');
      const label=document.querySelector('.article-read-progress-label span');
      const value=document.getElementById('article-read-progress-value');
      const detailRect=rect(detail);
      const bodyRect=rect(body);
      const progressRect=rect(progress);
      const trackRect=rect(track);
      const contentEnd=bodyRect ? detail.scrollTop+(bodyRect.bottom-detailRect.top) : detail.scrollHeight;
      const readableDistance=Math.max(0,contentEnd-detail.clientHeight+24);
      const expected=readableDistance<=1 ? 100 : Math.round(Math.min(100,Math.max(0,detail.scrollTop/readableDistance*100)));
      return {
        document:{ scrollHeight:scrolling.scrollHeight, clientHeight:scrolling.clientHeight, scrollTop:scrolling.scrollTop, innerHeight },
        detail:{ scrollHeight:detail.scrollHeight, clientHeight:detail.clientHeight, scrollTop:detail.scrollTop, overflowY:getComputedStyle(detail).overflowY, rect:detailRect },
        progress:{ rect:progressRect, track:trackRect, label:rect(label), labelText:label?.textContent?.trim()||'', value:rect(value), valueText:value?.textContent?.trim()||'', ariaNow:Number(track?.getAttribute('aria-valuenow')), expected, overlap:overlap(progressRect,detailRect), display:getComputedStyle(progress).display },
        chrome:{ topbar:getComputedStyle(document.querySelector('.xp-topbar')).position, topbarRect:rect(document.querySelector('.xp-topbar')), taskbar:getComputedStyle(document.querySelector('.xp-taskbar')).position },
        runtimeErrors:[...(window.__auditRuntimeErrors||[])]
      };
    })()`);
    await evaluate(client, `(() => {
      const detail=document.getElementById('article-detail');
      const body=document.getElementById('article-detail-body');
      const detailRect=detail.getBoundingClientRect();
      const bodyRect=body.getBoundingClientRect();
      const contentEnd=detail.scrollTop+(bodyRect.bottom-detailRect.top);
      detail.scrollTop=Math.max(0,contentEnd-detail.clientHeight+24);
      detail.dispatchEvent(new Event('scroll'));
      return true;
    })()`);
    await waitFrames(client, 4);
    state.bodyEnd = await evaluate(client, `(() => {
      const detail=document.getElementById('article-detail');
      const body=document.getElementById('article-detail-body');
      const detailRect=detail.getBoundingClientRect();
      const bodyRect=body.getBoundingClientRect();
      return {
        bodyBottom:bodyRect.bottom,
        detailBottom:detailRect.bottom,
        scrollTop:detail.scrollTop,
        ariaNow:Number(document.getElementById('article-read-progress-bar')?.getAttribute('aria-valuenow'))
      };
    })()`);
  } finally {
    await evaluate(client, `(() => { document.getElementById('audit-article-progress-growth')?.remove(); const detail=document.getElementById('article-detail'); if(detail) detail.scrollTop=0; return true; })()`).catch(() => {});
  }
  const failures = [];
  if (state.document.scrollHeight !== state.document.innerHeight || state.document.clientHeight !== state.document.innerHeight || state.document.scrollTop !== 0) failures.push(`document should remain exactly viewport-owned: ${JSON.stringify(state.document)}`);
  if (state.detail.scrollHeight <= state.detail.clientHeight || state.detail.scrollTop <= 0 || !["auto", "scroll"].includes(state.detail.overflowY)) failures.push(`article detail is not the sole active scroll owner: ${JSON.stringify(state.detail)}`);
  if (state.progress.display === "none" || !state.progress.rect || state.progress.rect.height > 30) failures.push(`article progress should be a compact in-flow status: ${JSON.stringify(state.progress.rect)}`);
  if (!state.progress.track || state.progress.track.height < 2 || state.progress.track.height > 6) failures.push(`visible article progress track height should be 2-6px: ${JSON.stringify(state.progress.track)}`);
  if (state.progress.overlap > 0.5) failures.push(`article progress overlaps the article scroll owner by ${state.progress.overlap}px²`);
  if (!state.progress.label?.width || !state.progress.value?.width || !state.progress.labelText || !/^\d+%$/.test(state.progress.valueText)) failures.push(`article progress meaning is not visibly clear: ${JSON.stringify(state.progress)}`);
  if (!Number.isFinite(state.progress.ariaNow) || Math.abs(state.progress.ariaNow - state.progress.expected) > 2) failures.push(`article progress aria value ${state.progress.ariaNow} differs from ${state.progress.expected}`);
  if (!Number.isFinite(state.bodyEnd?.ariaNow) || state.bodyEnd.ariaNow < 99 || state.bodyEnd.bodyBottom > state.bodyEnd.detailBottom - 8 || state.bodyEnd.bodyBottom < state.bodyEnd.detailBottom - 48) failures.push(`article body-end progress or spacing is wrong: ${JSON.stringify(state.bodyEnd)}`);
  if (!['relative','sticky','fixed'].includes(state.chrome.topbar) || Math.abs(Number(state.chrome.topbarRect?.top || 0)) > 1 || state.chrome.taskbar !== "fixed") failures.push(`article chrome positions changed: ${JSON.stringify(state.chrome)}`);
  if (state.runtimeErrors.length) failures.push(`runtime errors: ${state.runtimeErrors.join(" | ")}`);
  return { kind:"article-scroll-progress", name:`article-scroll-progress-${viewport.width}x${viewport.height}`, route:"knowledge", shell:viewport.mobile ? "mobile" : "desktop", viewport, state, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function auditArticleTocAndReadingDetails(client, origin, viewport, outputPath = defaultOutput) {
  await emulate(client, viewport);
  await client.send("Page.navigate", { url: `${origin}/articles/${article.slug}?lang=zh&wallpaper=${fixedTheme}&welcome=0&motion=off&audit-reader=1` });
  await stable(client, "article");
  await waitFrames(client, 5);
  const screenshotFile = viewport.mobile
    ? await captureViewportScreenshot(client, outputPath, `article-first-screen-${viewport.width}x${viewport.height}.png`)
    : "";
  const before = await evaluate(client, `(() => {
    const rect=(element)=>{const value=element?.getBoundingClientRect();return value?{top:value.top,right:value.right,bottom:value.bottom,left:value.left,width:value.width,height:value.height}:null;};
    const visibleHeight=(elementRect,ownerRect)=>!elementRect||!ownerRect?0:Math.max(0,Math.min(elementRect.bottom,ownerRect.bottom)-Math.max(elementRect.top,ownerRect.top));
    const detail=document.getElementById('article-detail');
    const backButton=document.querySelector('[data-article-back]');
    const sidebar=document.querySelector('.article-reader-sidebar');
    const toc=document.getElementById('article-detail-toc');
    const tocList=document.getElementById('article-detail-toc-list');
    const card=document.querySelector('.article-detail-card');
    const summary=document.getElementById('article-detail-summary');
    const toggle=document.getElementById('article-summary-toggle');
    const meta=document.getElementById('article-detail-meta');
    const body=document.getElementById('article-detail-body');
    const firstBodyChild=body?.firstElementChild;
    const image=body?.querySelector('.article-figure img');
    const topButton=document.querySelector('[data-article-scroll-top]');
    const links=[...document.querySelectorAll('[data-article-heading-target]')];
    const tocRows=links.map((link)=>{
      const style=getComputedStyle(link);
      return {
        text:link.textContent.trim(),
        rect:rect(link),
        clientHeight:link.clientHeight,
        scrollHeight:link.scrollHeight,
        lineHeight:parseFloat(style.lineHeight)||0,
        paddingTop:parseFloat(style.paddingTop)||0,
        paddingBottom:parseFloat(style.paddingBottom)||0
      };
    });
    const ids=links.map((link)=>link.dataset.articleHeadingTarget);
    const detailRect=rect(detail);
    const sidebarRect=rect(sidebar);
    const tocListRect=rect(tocList);
    const cardRect=rect(card);
    const bodyRect=rect(body);
    const firstBodyRect=rect(firstBodyChild);
    const metaRect=rect(meta);
    return {
      ids,
      uniqueIds:new Set(ids).size,
      duplicateIds:ids.filter((id)=>id.startsWith('article-第二节')),
      currentCount:links.filter((link)=>link.getAttribute('aria-current')==='location').length,
      backControl:{position:getComputedStyle(backButton).position,rect:rect(backButton)},
      sidebarControl:{position:getComputedStyle(sidebar).position,rect:sidebarRect,containsBack:sidebar?.contains(backButton)===true},
      tocControl:{rect:rect(toc)},
      tocRows,
      tocLayout:getComputedStyle(tocList).display,
      summary:{hidden:toggle?.hidden,expanded:toggle?.getAttribute('aria-expanded'),height:rect(summary)?.height||0,toggleHeight:rect(toggle)?.height||0},
      meta:{flexWrap:getComputedStyle(meta).flexWrap,scrollWidth:meta.scrollWidth,clientWidth:meta.clientWidth,children:[...meta.children].map((child)=>rect(child)),rect:metaRect},
      body:{fontSize:parseFloat(getComputedStyle(body).fontSize),lineHeight:getComputedStyle(body).lineHeight,userSelect:getComputedStyle(body).userSelect,width:bodyRect?.width||0},
      firstScreen:{
        detail:detailRect,
        sidebar:sidebarRect,
        tocList:tocListRect,
        card:cardRect,
        body:bodyRect,
        firstBody:firstBodyRect,
        cardOffset:detailRect&&cardRect?cardRect.top-detailRect.top:null,
        bodyVisibleHeight:visibleHeight(bodyRect,detailRect),
        firstBodyVisibleHeight:visibleHeight(firstBodyRect,detailRect),
        sidebarMinHeight:sidebar?getComputedStyle(sidebar).minHeight:"",
        detailScrollTop:detail?.scrollTop||0
      },
      topControl:{hidden:Boolean(topButton?.hidden),tabIndex:topButton?.tabIndex??null,rect:rect(topButton)},
      articleSemantics:{
        labelledBy:detail?.getAttribute('aria-labelledby')||'',
        titleId:document.getElementById('article-detail-title')?.id||'',
        titleTabIndex:document.getElementById('article-detail-title')?.tabIndex??null
      },
      tocSemantics:{
        listTabIndex:tocList?.getAttribute('tabindex'),
        titlesMatch:links.every((link)=>link.getAttribute('title')===link.textContent)
      },
      image:image?{
        width:image.getAttribute('width'),
        height:image.getAttribute('height'),
        alt:image.getAttribute('alt'),
        caption:image.closest('figure')?.querySelector('figcaption')?.textContent?.trim()||'',
        rect:rect(image)
      }:null,
      runtimeErrors:[...(window.__auditRuntimeErrors||[])]
    };
  })()`);
  const interaction = await evaluate(client, `(async()=>{
    const toggle=document.getElementById('article-summary-toggle');
    if(!toggle.hidden) toggle.click();
    const links=[...document.querySelectorAll('[data-article-heading-target]')];
    const target=links[Math.floor(links.length / 2)];
    target?.click();
    await new Promise((ok)=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(ok))));
    const rect=(element)=>{const value=element?.getBoundingClientRect();return value?{top:value.top,right:value.right,bottom:value.bottom,left:value.left,width:value.width,height:value.height}:null;};
    const summary=document.getElementById('article-detail-summary');
    const detail=document.getElementById('article-detail');
    const heading=document.getElementById(target?.dataset.articleHeadingTarget||'');
    const active=document.querySelector('[data-article-heading-target][aria-current="location"]');
    const list=document.getElementById('article-detail-toc-list');
    const topButton=document.querySelector('[data-article-scroll-top]');
    const backButton=document.querySelector('[data-article-back]');
    const sidebar=document.querySelector('.article-reader-sidebar');
    const toc=document.getElementById('article-detail-toc');
    const card=document.querySelector('.article-detail-card');
    const taskbar=document.querySelector('.xp-taskbar');
    return {
      targetId:target?.dataset.articleHeadingTarget||'',
      focusId:document.activeElement?.id||'',
      hash:decodeURIComponent(location.hash.slice(1)),
      detailScrollTop:detail.scrollTop,
      heading:rect(heading),
      detail:rect(detail),
      targetOffset:heading&&detail?rect(heading).top-rect(detail).top:null,
      currentCount:document.querySelectorAll('[data-article-heading-target][aria-current="location"]').length,
      activeId:active?.dataset.articleHeadingTarget||'',
      active:rect(active),
      list:rect(list),
      backControl:{position:getComputedStyle(backButton).position,rect:rect(backButton)},
      sidebarControl:{position:getComputedStyle(sidebar).position,rect:rect(sidebar),containsBack:sidebar?.contains(backButton)===true},
      tocControl:{rect:rect(toc)},
      card:rect(card),
      taskbar:rect(taskbar),
      topControl:{hidden:Boolean(topButton?.hidden),tabIndex:topButton?.tabIndex??null,position:getComputedStyle(topButton).position,rect:rect(topButton)},
      summary:{expanded:toggle?.getAttribute('aria-expanded'),height:rect(summary)?.height||0,toggleHeight:rect(toggle)?.height||0}
    };
  })()`);
  const tocEnd = await evaluate(client, `(async()=>{
    const list=document.getElementById('article-detail-toc-list');
    const links=[...list.querySelectorAll('[data-article-heading-target]')];
    const last=links.at(-1);
    list.scrollTop=list.scrollHeight;
    list.scrollLeft=list.scrollWidth;
    await new Promise((ok)=>requestAnimationFrame(()=>requestAnimationFrame(ok)));
    const rect=(element)=>{const value=element?.getBoundingClientRect();return value?{top:value.top,right:value.right,bottom:value.bottom,left:value.left,width:value.width,height:value.height}:null;};
    const style=getComputedStyle(list);
    return {
      list:rect(list),
      last:rect(last),
      vertical:list.scrollHeight>list.clientHeight+1,
      horizontal:list.scrollWidth>list.clientWidth+1,
      scrollTop:list.scrollTop,
      scrollLeft:list.scrollLeft,
      maxTop:Math.max(0,list.scrollHeight-list.clientHeight),
      maxLeft:Math.max(0,list.scrollWidth-list.clientWidth),
      paddingBottom:parseFloat(style.paddingBottom)||0,
      paddingRight:parseFloat(style.paddingRight)||0
    };
  })()`);
  const topReturn = await evaluate(client, `(async()=>{
    const detail=document.getElementById('article-detail');
    const button=document.querySelector('[data-article-scroll-top]');
    button?.click();
    await new Promise((ok)=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(ok))));
    return {
      scrollTop:detail?.scrollTop??null,
      windowScrollY:window.scrollY,
      focusId:document.activeElement?.id||'',
      hidden:Boolean(button?.hidden)
    };
  })()`);
  const directTarget = "article-第二节-2";
  await client.send("Page.navigate", { url: `${origin}/articles/${article.slug}?lang=zh&wallpaper=${fixedTheme}&welcome=0&motion=off&audit-reader-hash=1#${encodeURIComponent(directTarget)}` });
  await stable(client, "article");
  await waitFrames(client, 6);
  const direct = await evaluate(client, `(() => {
    const detail=document.getElementById('article-detail');
    const target=document.getElementById(${JSON.stringify(directTarget)});
    const detailRect=detail?.getBoundingClientRect();
    const targetRect=target?.getBoundingClientRect();
    return {
      focusId:document.activeElement?.id||'',
      hash:decodeURIComponent(location.hash.slice(1)),
      scrollTop:detail?.scrollTop||0,
      targetOffset:targetRect&&detailRect?targetRect.top-detailRect.top:null,
      currentIds:[...document.querySelectorAll('[data-article-heading-target][aria-current="location"]')].map((node)=>node.dataset.articleHeadingTarget),
      runtimeErrors:[...(window.__auditRuntimeErrors||[])]
    };
  })()`);
  const failures = [];
  if (before.ids.length < 6 || before.uniqueIds !== before.ids.length || JSON.stringify(before.duplicateIds) !== JSON.stringify(["article-第二节", "article-第二节-2"])) failures.push(`semantic duplicate-safe anchors are wrong: ${JSON.stringify(before.ids)}`);
  if (before.currentCount !== 1) failures.push(`TOC should expose exactly one current chapter before interaction: ${before.currentCount}`);
  const clippedTocRows = before.tocRows.filter((row)=>!row.rect || row.scrollHeight > row.clientHeight + 1);
  const longTocRow = before.tocRows.find((row)=>row.text.includes("超长章节标题"));
  if (clippedTocRows.length || !longTocRow || longTocRow.rect.height <= longTocRow.lineHeight + longTocRow.paddingTop + longTocRow.paddingBottom + 1) failures.push(`multiline TOC rows did not grow naturally: ${JSON.stringify({ clippedTocRows, longTocRow })}`);
  if (before.tocLayout === "grid" && before.tocRows.some((row,index,rows)=>index>0&&row.rect&&rows[index-1].rect&&row.rect.top<rows[index-1].rect.bottom-1)) failures.push(`vertical TOC rows overlap: ${JSON.stringify(before.tocRows)}`);
  if (viewport.mobile) {
    if (before.summary.hidden !== false || before.summary.toggleHeight < 44) failures.push(`mobile summary disclosure is unavailable: ${JSON.stringify(before.summary)}`);
    if (interaction.summary.expanded !== "true" || interaction.summary.height <= before.summary.height + 1) failures.push(`mobile summary did not expand: ${JSON.stringify({ before:before.summary, after:interaction.summary })}`);
    const clippedMeta = before.meta.children.some((child)=>!child || child.left < before.meta.rect.left - 1 || child.right > before.meta.rect.right + 1);
    if (before.meta.flexWrap !== "wrap" || before.meta.scrollWidth > before.meta.clientWidth + 1 || clippedMeta) failures.push(`mobile metadata does not wrap completely: ${JSON.stringify(before.meta)}`);
  } else if (before.summary.hidden !== true) failures.push(`desktop should not show the mobile summary disclosure: ${JSON.stringify(before.summary)}`);
  if (before.body.fontSize < 16 || before.body.userSelect !== "text") failures.push(`article body readability/copy styles are wrong: ${JSON.stringify(before.body)}`);
  if (!before.image || before.image.width !== "1910" || before.image.height !== "1226" || before.image.alt !== "" || !before.image.caption || before.image.rect.height <= 0) failures.push(`article image semantics or intrinsic dimensions are wrong: ${JSON.stringify(before.image)}`);
  if (before.articleSemantics.labelledBy !== before.articleSemantics.titleId || before.articleSemantics.titleId !== "article-detail-title" || before.articleSemantics.titleTabIndex !== -1) failures.push(`article title relationship or focus target is incomplete: ${JSON.stringify(before.articleSemantics)}`);
  if (before.tocSemantics.listTabIndex !== null || !before.tocSemantics.titlesMatch) failures.push(`TOC container or full-title semantics are wrong: ${JSON.stringify(before.tocSemantics)}`);
  if (!interaction.targetId || interaction.focusId !== interaction.targetId || interaction.hash !== interaction.targetId || interaction.activeId !== interaction.targetId || interaction.currentCount !== 1) failures.push(`TOC click focus/hash/current state is wrong: ${JSON.stringify(interaction)}`);
  if (!interaction.heading || !interaction.detail || interaction.heading.top < interaction.detail.top - 1 || interaction.heading.bottom > interaction.detail.bottom + 1) failures.push(`TOC target is obscured outside the article viewport: ${JSON.stringify({ heading:interaction.heading, detail:interaction.detail })}`);
  if (interaction.targetOffset === null || interaction.targetOffset < 10 || interaction.targetOffset > 34) failures.push(`TOC target did not land at the reader activation line: ${JSON.stringify(interaction)}`);
  if (!interaction.active || !interaction.list || interaction.active.top < interaction.list.top - 1 || interaction.active.bottom > interaction.list.bottom + 1 || interaction.active.left < interaction.list.left - 1 || interaction.active.right > interaction.list.right + 1) failures.push(`active TOC item is outside its own scroll viewport: ${JSON.stringify({ active:interaction.active, list:interaction.list })}`);
  if (!tocEnd.last || !tocEnd.list || tocEnd.last.top < tocEnd.list.top - 1 || tocEnd.last.bottom > tocEnd.list.bottom - (tocEnd.vertical ? 8 : -1) || tocEnd.last.left < tocEnd.list.left - 1 || tocEnd.last.right > tocEnd.list.right - (tocEnd.horizontal ? 2 : -1) || (tocEnd.vertical && Math.abs(tocEnd.scrollTop-tocEnd.maxTop)>1) || (tocEnd.horizontal && Math.abs(tocEnd.scrollLeft-tocEnd.maxLeft)>1)) failures.push(`final TOC item is clipped or overlaps the scrollbar edge: ${JSON.stringify(tocEnd)}`);
  const anchoredSidebarExpected = !viewport.mobile || viewport.width > viewport.height;
  const rectanglesOverlap = (first, second) => Boolean(first && second
    && Math.min(first.right, second.right) > Math.max(first.left, second.left) + 1
    && Math.min(first.bottom, second.bottom) > Math.max(first.top, second.top) + 1);
  if (!before.sidebarControl.containsBack || !interaction.sidebarControl.containsBack || before.backControl.position !== "static" || interaction.backControl.position !== "static") failures.push(`Back to Article List is not owned by the shared reader sidebar: ${JSON.stringify({ before:before.sidebarControl, after:interaction.sidebarControl, backBefore:before.backControl, backAfter:interaction.backControl })}`);
  if (rectanglesOverlap(before.backControl.rect, before.tocControl.rect) || rectanglesOverlap(interaction.backControl.rect, interaction.tocControl.rect)) failures.push(`Back to Article List overlaps the article contents: ${JSON.stringify({ before:{back:before.backControl,toc:before.tocControl}, after:{back:interaction.backControl,toc:interaction.tocControl} })}`);
  if (anchoredSidebarExpected && (before.sidebarControl.position !== "sticky" || interaction.sidebarControl.position !== "sticky" || !before.sidebarControl.rect || !interaction.sidebarControl.rect || Math.abs(before.sidebarControl.rect.top-interaction.sidebarControl.rect.top)>1 || Math.abs(before.sidebarControl.rect.left-interaction.sidebarControl.rect.left)>1)) failures.push(`reader sidebar did not remain anchored: ${JSON.stringify({ before:before.sidebarControl, after:interaction.sidebarControl })}`);
  if (!before.topControl.hidden || (before.topControl.rect && (before.topControl.rect.width > 0 || before.topControl.rect.height > 0))) failures.push(`article top control remains exposed at 0%: ${JSON.stringify(before.topControl)}`);
  if (interaction.topControl.hidden || !interaction.topControl.rect || interaction.topControl.rect.width < 44 || interaction.topControl.rect.height < 44) failures.push(`article top control is unavailable after scrolling: ${JSON.stringify(interaction.topControl)}`);
  const topControlBottomLimit = Math.min(interaction.detail?.bottom ?? viewport.height, interaction.taskbar?.top ?? viewport.height);
  if (interaction.topControl.position !== "fixed" || !interaction.card || interaction.topControl.rect.left < interaction.card.left - 1 || interaction.topControl.rect.right > interaction.card.right - 6 || interaction.topControl.rect.bottom > topControlBottomLimit - 6) failures.push(`article top control is outside the reading-area lower-right corner: ${JSON.stringify({ control:interaction.topControl, card:interaction.card, detail:interaction.detail, taskbar:interaction.taskbar })}`);
  if (topReturn.scrollTop !== 0 || topReturn.windowScrollY !== 0 || topReturn.focusId !== "article-detail-title" || !topReturn.hidden) failures.push(`article top activation did not scroll only the reader and restore title focus: ${JSON.stringify(topReturn)}`);
  if (direct.focusId !== directTarget || direct.hash !== directTarget || direct.scrollTop <= 0 || direct.targetOffset === null || direct.targetOffset < -1 || direct.targetOffset > 34 || JSON.stringify(direct.currentIds) !== JSON.stringify([directTarget])) failures.push(`direct shared heading restoration is wrong: ${JSON.stringify(direct)}`);
  if (before.runtimeErrors.length || direct.runtimeErrors.length) failures.push(`runtime errors: ${[...before.runtimeErrors,...direct.runtimeErrors].join(" | ")}`);
  if (viewport.mobile) {
    const firstScreen = before.firstScreen;
    const portraitReference = viewport.width === 390 && viewport.height === 844;
    const shortPortrait = viewport.width === 359 && viewport.height === 500;
    const shortLandscape = viewport.width === 844 && viewport.height === 390;
    const maximumCardOffset = shortPortrait ? 90 : shortLandscape ? 24 : portraitReference ? 180 : 260;
    const minimumBodyVisible = portraitReference ? 200 : 44;
    if (parseFloat(firstScreen.sidebarMinHeight || "0") > 1) failures.push(`mobile article sidebar reserves ${firstScreen.sidebarMinHeight} before the article card`);
    if (!firstScreen.card || firstScreen.cardOffset > maximumCardOffset || firstScreen.card.top >= firstScreen.detail.bottom - 44) failures.push(`mobile article card starts too far below the first screen: ${JSON.stringify(firstScreen)}`);
    if (!firstScreen.firstBody || firstScreen.firstBodyVisibleHeight < Math.min(firstScreen.firstBody.height, 20) || firstScreen.bodyVisibleHeight < minimumBodyVisible) failures.push(`mobile article first screen exposes only ${firstScreen.bodyVisibleHeight}px of body copy`);
    if (firstScreen.detailScrollTop !== 0) failures.push(`mobile article did not start at scrollTop 0: ${firstScreen.detailScrollTop}`);
  }
  return { kind:"article-toc-reading-details", name:`article-toc-reading-details-${viewport.width}x${viewport.height}`, route:"knowledge", shell:viewport.mobile ? "mobile" : "desktop", viewport, screenshotFile, before, interaction, tocEnd, topReturn, direct, failures, status:failures.length ? "FAIL" : "PASS" };
}

async function auditControlledVideoFlow(client, origin, viewport, output) {
  await emulate(client, viewport);
  await client.send("Page.navigate", { url: `${origin}/?lang=en&wallpaper=${fixedTheme}&welcome=0&motion=off` });
  await stable(client, "home");
  await evaluate(client, `(() => {
    window.LusuUiMotion?.setMode?.('off');
    window.__auditNativeVideoFetch=window.fetch.bind(window);
    window.fetch=(input, init) => String(input).includes('/api/videos')
      ? Promise.resolve(new Response(JSON.stringify({error:'controlled video outage'}),{status:503,headers:{'Content-Type':'application/json'}}))
      : window.__auditNativeVideoFetch(input, init);
    return true;
  })()`);
  await setAuditRoute(client, "videos");
  await waitFor(client, `Boolean(document.querySelector('.video-status-state [data-video-retry]'))`, "controlled video failure state");
  const failedState = await evaluate(client, `(() => ({
    status:Boolean(document.querySelector('.video-status-state')),
    retry:Boolean(document.querySelector('[data-video-retry]')),
    filtersHidden:document.getElementById('video-categories')?.hidden,
    zeroCounts:document.querySelectorAll('#video-categories .filter-count').length
  }))()`);

  await evaluate(client, `(() => {
    window.fetch=(input, init) => String(input).includes('/api/videos')
      ? Promise.resolve(new Response(JSON.stringify({categories:Array.from({length:5},(_,index)=>({category_id:'empty-'+index,name:'Empty '+index})),videos:[]}),{status:200,headers:{'Content-Type':'application/json'}}))
      : window.__auditNativeVideoFetch(input, init);
    document.querySelector('[data-video-retry]')?.click();
    return true;
  })()`);
  await waitFor(client, `Boolean(document.querySelector('.video-empty-state:not(.video-status-state)'))`, "controlled video empty state");
  const emptyState = await evaluate(client, `(() => ({
    empty:Boolean(document.querySelector('.video-empty-state:not(.video-status-state)')),
    filtersHidden:document.getElementById('video-categories')?.hidden,
    zeroCounts:document.querySelectorAll('#video-categories .filter-count').length,
    action:Boolean(document.querySelector('.video-empty-state [data-article-category]'))
  }))()`);

  await evaluate(client, `window.fetch=window.__auditNativeVideoFetch; true`);
  await client.send("Page.navigate", { url: `${origin}/?lang=en&wallpaper=${fixedTheme}&welcome=0&motion=off&audit-video-stage=playable#videos` });
  await stable(client, "videos");
  try {
    await waitFor(client, `Boolean(document.querySelector('.card-action[data-video-id="${auditPlayableVideo.video_id}"]'))`, "controlled playable video card");
  } catch (error) {
    const restoredState = await evaluate(client, `(() => ({
      route:document.body.dataset.route||'',
      module:window.__lusuRouteModulesAudit?.().videos||'',
      lifecycle:window.__lusuRouteLifecycleAudit?.(),
      listText:document.getElementById('video-list')?.textContent?.trim()||'',
      cardIds:[...document.querySelectorAll('.card-action[data-video-id]')].map((node)=>node.dataset.videoId),
      status:Boolean(document.querySelector('.video-status-state')),
      empty:Boolean(document.querySelector('.video-empty-state:not(.video-status-state)')),
      runtimeErrors:[...(window.__auditRuntimeErrors||[])]
    }))()`);
    throw new Error(`${error.message}; restored video state: ${JSON.stringify(restoredState)}`);
  }
  const card = await evaluate(client, `(() => {
    const primary=document.querySelector('.card-action[data-video-id="${auditPlayableVideo.video_id}"]');
    const card=primary?.closest('.video-card');
    const thumb=card?.querySelector('.video-thumb');
    return {
      buttonCount:card?.querySelectorAll('button').length||0,
      primaryTabIndex:primary?.tabIndex,
      thumbTag:thumb?.tagName||'',
      thumbType:thumb?.getAttribute('type')||'',
      thumbTabIndex:thumb?.tabIndex,
      thumbLabel:thumb?.getAttribute('aria-label')||'',
      filtersHidden:document.getElementById('video-categories')?.hidden,
      filterCount:document.querySelectorAll('#video-categories button').length
    };
  })()`);
  await evaluate(client, `(() => {
    const primary=document.querySelector('.card-action[data-video-id="${auditPlayableVideo.video_id}"]');
    const thumb=primary.closest('.video-card').querySelector('.video-thumb');
    window.__auditControlledVideoTrigger=thumb;
    thumb.focus({preventScroll:true});
    thumb.click();
    return true;
  })()`);
  await waitFor(client, `document.getElementById('video-modal')?.hidden===false && Boolean(document.querySelector('#video-frame iframe'))`, "controlled video iframe");
  const nativeControls = await evaluate(client, `(() => {
    const iframe=document.querySelector('#video-frame iframe');
    const rect=iframe.getBoundingClientRect();
    const points=[
      [rect.left+rect.width/2,rect.top+rect.height/2],
      [rect.left+rect.width/2,Math.max(rect.top+1,rect.bottom-12)]
    ];
    return {
      iframePointerEvents:getComputedStyle(iframe).pointerEvents,
      topElements:points.map(([x,y])=>document.elementFromPoint(x,y)?.tagName||''),
      shieldCount:document.querySelectorAll('.video-click-shield,[class*="video-click-blocker"]').length,
      shellChildren:iframe.parentElement?.children.length||0,
      allow:iframe.getAttribute('allow')||'',
      allowFullscreen:iframe.allowFullscreen,
      originalVisible:document.getElementById('video-link')?.hidden===false
    };
  })()`);
  await evaluate(client, `document.querySelector('#video-frame iframe')?.dispatchEvent(new Event('error')); true`);
  await waitFor(client, `document.getElementById('video-frame')?.dataset.videoPlayerState==='failed'`, "controlled video failure fallback");
  const playerFailure = await evaluate(client, `(() => {
    const retry=document.querySelector('[data-video-player-retry]');
    const rect=retry?.getBoundingClientRect();
    const external=document.getElementById('video-link');
    const original=document.querySelector('.video-player-fallback-actions a[href]');
    return {
      fallback:Boolean(document.querySelector('.video-player-fallback')),
      iframe:Boolean(document.querySelector('#video-frame iframe')),
      actions:Boolean(document.querySelector('.video-player-fallback-actions')),
      retryRect:rect?{width:rect.width,height:rect.height}:null,
      externalHidden:Boolean(external?.hidden && getComputedStyle(external).display==='none' && !external.getClientRects().length),
      originalVisible:Boolean(original&&!original.hidden&&original.getClientRects().length),
      originalHref:original?.href||'',
      originalTarget:original?.target||'',
      originalRel:original?.rel||''
    };
  })()`);
  const screenshotFile = `video-controlled-en-${viewport.width}x${viewport.height}.png`;
  const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(resolve(output, screenshotFile), Buffer.from(screenshot.data, "base64"));
  await evaluate(client, `document.querySelector('[data-video-player-retry]')?.click(); true`);
  await waitFor(client, `Boolean(document.querySelector('#video-frame iframe'))`, "retried video iframe");
  await evaluate(client, `document.querySelector('#video-frame iframe')?.dispatchEvent(new Event('load')); true`);
  await waitFor(client, `document.getElementById('video-frame')?.dataset.videoPlayerState==='ready'`, "retried video ready state");
  const iframeIdentity = await evaluate(client, `(() => { window.__auditControlledIframe=document.querySelector('#video-frame iframe'); document.getElementById('video-window-maximize')?.click(); return true; })()`);
  await waitFrames(client, 3);
  const maximized = await evaluate(client, `(() => {
    const modal=document.getElementById('video-modal');
    const dialog=modal?.querySelector('.modal-window');
    const close=modal?.querySelector('button[data-close-modal]');
    const dialogRect=dialog?.getBoundingClientRect();
    const closeRect=close?.getBoundingClientRect();
    return {
      maximized:modal?.classList.contains('is-video-maximized'),
      sameIframe:document.querySelector('#video-frame iframe')===window.__auditControlledIframe,
      playerFocused:document.activeElement===window.__auditControlledIframe,
      browserFullscreen:Boolean(document.fullscreenElement),
      dialog:dialogRect?{left:dialogRect.left,top:dialogRect.top,right:dialogRect.right,bottom:dialogRect.bottom}:null,
      close:closeRect?{left:closeRect.left,top:closeRect.top,right:closeRect.right,bottom:closeRect.bottom,width:closeRect.width,height:closeRect.height}:null
    };
  })()`);
  await evaluate(client, `document.querySelector('#video-modal button[data-close-modal]')?.click(); true`);
  await waitFor(client, `document.getElementById('video-modal')?.hidden===true`, "controlled video close");
  const closed = await evaluate(client, `({ focusReturned:document.activeElement===window.__auditControlledVideoTrigger, runtimeErrors:[...(window.__auditRuntimeErrors||[])] })`);

  const failures = [];
  if (!failedState.status || !failedState.retry || !failedState.filtersHidden || failedState.zeroCounts !== 0) failures.push(`load failure was presented as empty/filter counts: ${JSON.stringify(failedState)}`);
  if (!emptyState.empty || !emptyState.filtersHidden || emptyState.zeroCounts !== 0 || !emptyState.action) failures.push(`true empty state/filter suppression is wrong: ${JSON.stringify(emptyState)}`);
  if (card.buttonCount !== 2 || card.primaryTabIndex !== 0 || card.thumbTag !== "BUTTON" || card.thumbType !== "button" || card.thumbTabIndex !== 0 || !card.thumbLabel.includes(auditPlayableVideo.title) || card.filtersHidden || card.filterCount < 2) failures.push(`video card does not expose two exact titled play controls: ${JSON.stringify(card)}`);
  if (nativeControls.iframePointerEvents === "none" || nativeControls.topElements.some((tag)=>tag !== "IFRAME") || nativeControls.shieldCount || nativeControls.shellChildren !== 1 || !nativeControls.allow.includes("fullscreen") || !nativeControls.allowFullscreen || !nativeControls.originalVisible) failures.push(`iframe native control surface is obstructed: ${JSON.stringify(nativeControls)}`);
  if (!playerFailure.fallback || playerFailure.iframe || !playerFailure.actions || !playerFailure.retryRect || playerFailure.retryRect.height < 44 || !playerFailure.externalHidden || !playerFailure.originalVisible || playerFailure.originalHref !== auditPlayableVideo.original_url || playerFailure.originalTarget !== "_blank" || !/noopener/.test(playerFailure.originalRel)) failures.push(`player failure recovery is incomplete: ${JSON.stringify(playerFailure)}`);
  if (!maximized.maximized || !maximized.sameIframe || !maximized.playerFocused || maximized.browserFullscreen || !maximized.dialog || maximized.dialog.left < -1 || maximized.dialog.top < -1 || maximized.dialog.right > viewport.width + 1 || maximized.dialog.bottom > viewport.height + 1) failures.push(`in-site maximize geometry/state is wrong: ${JSON.stringify(maximized)}`);
  if (viewport.mobile && (!maximized.close || maximized.close.width < 44 || maximized.close.height < 44 || maximized.close.left < 0 || maximized.close.top < 0 || maximized.close.right > viewport.width || maximized.close.bottom > viewport.height)) failures.push(`mobile video close control is invalid: ${JSON.stringify(maximized.close)}`);
  if (!closed.focusReturned || closed.runtimeErrors.length) failures.push(`video close/recovery left focus or runtime errors: ${JSON.stringify(closed)}`);
  return { kind:"controlled-video-flow", name:`controlled-video-${viewport.width}x${viewport.height}`, route:"videos", shell:viewport.mobile?"mobile":"desktop", viewport, screenshotFile, failedState, emptyState, card, nativeControls, playerFailure, maximized, closed, failures, status:failures.length?"FAIL":"PASS" };
}

function logAuditStatus(result, label) {
  console.log(`${result.status} ${label}`);
  if (result.failures?.length) {
    console.error(`${label}: ${result.failures.join("; ")}`);
  }
}

const releaseAuditContract = Object.freeze({
  routes: auditRoutes,
  optionalRoutes: Object.freeze({ blog: "unpublished-and-redirected-to-knowledge" }),
  languages: Object.keys(semanticLanguages),
  viewports: viewports.map(({ name, width, height, mobile }) => ({ name, width, height, mobile })),
  themes: timeThemes,
  screenshotPolicy: "representative-only",
  realDeviceCertified: false,
  wcagCertified: false
});

async function auditForcedColorsSmoke(client, origin) {
  const viewport = viewports.find((item) => item.width === 1280 && item.height === 720);
  await emulate(client, viewport);
  await client.send("Emulation.setEmulatedMedia", { media:"screen", features:[{name:"forced-colors",value:"active"},{name:"prefers-reduced-motion",value:"reduce"},{name:"prefers-contrast",value:"more"}] });
  try {
    await client.send("Page.navigate", { url:`${origin}/?lang=en&wallpaper=day&welcome=0&audit-forced-colors=1` });
    await stable(client, "home");
    await evaluate(client, `document.body.tabIndex=-1;document.body.focus({preventScroll:true});true`);
    await client.send("Input.dispatchKeyEvent", { type:"rawKeyDown", key:"Tab", code:"Tab", windowsVirtualKeyCode:9 });
    await client.send("Input.dispatchKeyEvent", { type:"keyUp", key:"Tab", code:"Tab", windowsVirtualKeyCode:9 });
    await new Promise((ok)=>setTimeout(ok,100));
    const state = await evaluate(client, `(() => {const focused=document.activeElement;const style=getComputedStyle(focused);const start=document.querySelector('.xp-taskbar .start-button');const startStyle=getComputedStyle(start);return {media:matchMedia('(forced-colors: active)').matches,focus:{tag:focused?.tagName||'',className:String(focused?.className||''),outlineStyle:style.outlineStyle,outlineWidth:style.outlineWidth,outlineColor:style.outlineColor},start:{forcedColorAdjust:startStyle.forcedColorAdjust,color:startStyle.color,background:startStyle.backgroundColor},h1:document.querySelector('.page.active h1')?.textContent.trim()||'',runtimeErrors:[...(window.__auditRuntimeErrors||[])]};})()`);
    const failures = [];
    if (!state.media) failures.push("Chromium did not activate forced-colors emulation");
    if (!state.h1) failures.push("forced-colors route lost its H1");
    if (state.focus.outlineStyle === "none" || parseFloat(state.focus.outlineWidth) < 1) failures.push(`forced-colors focus indicator is not visible: ${JSON.stringify(state.focus)}`);
    if (state.runtimeErrors.length) failures.push(`runtime errors: ${state.runtimeErrors.join(" | ")}`);
    return { kind:"forced-colors-smoke", name:"forced-colors-focus-shell", shell:"desktop", viewport, state, failures, status:failures.length?"FAIL":"PASS", certification:false };
  } finally {
    await emulate(client, viewport);
  }
}

async function auditReducedMotionWallpaperNetwork(client, server) {
  const viewport = viewports.find((item) => item.width === 1280 && item.height === 720);
  await client.send("Page.navigate", { url: "about:blank" });
  await waitFor(client, `document.readyState==='complete'`, "reduced-motion wallpaper blank boundary");
  await emulate(client, viewport);
  await client.send("Network.clearBrowserCache");
  server.resetRequests();
  server.setWallpaperBaseAssetCaching(true);
  let requests;
  let state;
  try {
    await navigateFresh(client, `${server.origin}/?lang=zh&wallpaper=day&welcome=0&audit-reduced-motion-network=1`, "reduced-motion-wallpaper-network");
    await stable(client, "home");
    await new Promise((ok)=>setTimeout(ok,250));
    requests = server.requestLog().filter((item)=>item.method === "GET" && isWallpaperBaseAssetPath(item.path));
    state = await evaluate(client, `(() => {
      const preload=document.querySelector('link[data-wallpaper-preload]');
      return {
        reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
        motion:document.getElementById('wallpaper-root')?.dataset.motion||'',
        background:getComputedStyle(document.querySelector('.wallpaper-base')).backgroundImage,
        preload:preload?{href:new URL(preload.href).pathname+new URL(preload.href).search,type:preload.type,srcset:preload.imageSrcset||''}:null
      };
    })()`);
  } finally {
    server.setWallpaperBaseAssetCaching(false);
  }
  const failures = [];
  if (!state.reduced) failures.push("prefers-reduced-motion was not active");
  if (requests.length !== 1 || requests[0]?.path !== "/assets/images/wallpapers/optimized/day-1440.avif" || requests[0]?.search) {
    failures.push(`reduced motion did not make exactly one request for the CSS-selected AVIF: ${JSON.stringify(requests)}`);
  }
  if (state.preload?.href !== "/assets/images/wallpapers/optimized/day-1440.avif" || state.preload?.type !== "image/avif" || state.preload?.srcset) {
    failures.push(`reduced motion preload does not exactly match the applied CSS resource: ${JSON.stringify(state.preload)}`);
  }
  return { kind:"reduced-motion-network", name:"optimized-static-wallpaper", shell:"desktop", viewport, state, requests, failures, status:failures.length?"FAIL":"PASS" };
}

async function auditAmbientWallpaperPlayback(client, server) {
  const desktop4k = { name: "desktop-4k", width: 3840, height: 2160, mobile: false };
  const desktop1080 = { name: "desktop-1080", width: 1920, height: 1080, mobile: false };
  const mobile = { name: "phone-standard", width: 390, height: 844, mobile: true };
  const failures = [];
  const samples = [];
  const highTier = await client.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    try { Object.defineProperty(navigator, 'hardwareConcurrency', { configurable:true, get:()=>8 }); } catch {}
    try { Object.defineProperty(navigator, 'deviceMemory', { configurable:true, get:()=>8 }); } catch {}
  })();` });
  const videoRequests = () => server.requestLog().filter((entry) => /\/assets\/videos\/wallpaper-dynamic\/(morning|day|dusk|night)\/motion-(1080|2160)\.mp4/.test(entry.path));
  const emulateAmbient = async (viewport, reduced = false) => {
    await emulate(client, viewport);
    await client.send("Emulation.setEmulatedMedia", {
      media: "screen",
      features: [
        { name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" },
        { name: "prefers-color-scheme", value: "light" }
      ]
    });
  };
  const playableState = async () => evaluate(client, `(() => {
    const video=document.querySelector('video.wallpaper-ambient-video[data-wallpaper-ambient-active="true"]');
    return {route:document.body.dataset.route||'',shell:document.documentElement.dataset.uiShell||'',tier:document.documentElement.dataset.performanceTier||'',motion:document.querySelector('#wallpaper-root')?.dataset.motion||'',theme:video?.dataset.wallpaperAmbientTheme||'',resolution:video?.dataset.wallpaperAmbientResolution||'',videoWidth:video?.videoWidth||0,videoHeight:video?.videoHeight||0,readyState:video?.readyState||0,paused:video?.paused??true,opacity:video?.style.opacity||'',currentPath:video?.currentSrc?new URL(video.currentSrc).pathname:''};
  })()`);
  try {
    for (const sample of [
      { viewport: desktop4k, expectedResolution: "2160", expectedWidth: 3840, expectedHeight: 2160 },
      { viewport: desktop1080, expectedResolution: "1080", expectedWidth: 1920, expectedHeight: 1080 }
    ]) {
      await client.send("Page.navigate", { url: "about:blank" });
      await waitFor(client, `document.readyState==='complete'`, `${sample.viewport.name} ambient blank boundary`);
      await emulateAmbient(sample.viewport);
      await client.send("Network.clearBrowserCache");
      server.resetRequests();
      await navigateFresh(client, `${server.origin}/?lang=zh&wallpaper=day&welcome=0&audit-ambient-playback=${sample.expectedResolution}`, `${sample.viewport.name}-ambient-playback`);
      await waitFor(client, `document.readyState==='complete'&&document.body.dataset.route==='home'&&document.documentElement.dataset.uiShell==='desktop'`, `${sample.viewport.name} ambient shell`);
      await waitFor(client, `(() => {const video=document.querySelector('video.wallpaper-ambient-video[data-wallpaper-ambient-active="true"]');return video&&video.readyState>=3&&!video.paused&&video.style.opacity==='1';})()`, `${sample.viewport.name} ambient playback`);
      const state = await playableState();
      const requests = videoRequests();
      const expectedPath = `/assets/videos/wallpaper-dynamic/day/motion-${sample.expectedResolution}.mp4`;
      if (state.resolution !== sample.expectedResolution) failures.push(`${sample.viewport.name} selected ${state.resolution || "no"} video instead of ${sample.expectedResolution}`);
      if (state.videoWidth !== sample.expectedWidth || state.videoHeight !== sample.expectedHeight) failures.push(`${sample.viewport.name} decoded ${state.videoWidth}x${state.videoHeight} instead of ${sample.expectedWidth}x${sample.expectedHeight}`);
      if (state.currentPath !== expectedPath) failures.push(`${sample.viewport.name} current video path ${state.currentPath || "missing"} !== ${expectedPath}`);
      if (requests.length !== 1 || requests[0]?.path !== expectedPath) failures.push(`${sample.viewport.name} requested ambient assets ${JSON.stringify(requests.map((entry) => entry.path))}`);
      samples.push({ ...sample, state, requests });
      if (sample.expectedResolution === "2160") {
        await setAuditRoute(client, "resources");
        await waitFor(client, `document.body.dataset.route==='resources'&&!document.querySelector('video.wallpaper-ambient-video')`, "non-Home ambient decoder release");
        const released = await evaluate(client, `({route:document.body.dataset.route,videoCount:document.querySelectorAll('video.wallpaper-ambient-video').length})`);
        if (released.videoCount !== 0) failures.push(`non-Home route retained ${released.videoCount} ambient videos`);
        samples.at(-1).released = released;
      }
    }

    for (const sample of [
      { viewport: mobile, reduced: false, name: "mobile-zero-request" },
      { viewport: desktop1080, reduced: true, name: "reduced-zero-request" }
    ]) {
      await client.send("Page.navigate", { url: "about:blank" });
      await waitFor(client, `document.readyState==='complete'`, `${sample.name} blank boundary`);
      await emulateAmbient(sample.viewport, sample.reduced);
      await client.send("Network.clearBrowserCache");
      server.resetRequests();
      await navigateFresh(client, `${server.origin}/?lang=zh&wallpaper=night&welcome=0&audit-ambient-playback=${sample.name}`, sample.name);
      await waitFor(client, `document.readyState==='complete'&&Boolean(document.documentElement.dataset.uiShell)`, `${sample.name} shell`);
      await new Promise((resolve) => setTimeout(resolve, 600));
      const state = await evaluate(client, `({route:document.body.dataset.route,shell:document.documentElement.dataset.uiShell,motion:document.querySelector('#wallpaper-root')?.dataset.motion||'',videoCount:document.querySelectorAll('video.wallpaper-ambient-video').length})`);
      const requests = videoRequests();
      if (state.videoCount !== 0 || requests.length) failures.push(`${sample.name} created ${state.videoCount} videos and requested ${JSON.stringify(requests.map((entry) => entry.path))}`);
      samples.push({ ...sample, state, requests });
    }
  } finally {
    await client.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: highTier.identifier }).catch(() => {});
    await emulate(client, viewports.find((item) => item.width === 1280 && item.height === 720));
  }
  return { kind:"ambient-wallpaper-playback", name:"current-theme-1080-2160-and-zero-request-fallbacks", samples, failures, status:failures.length?"FAIL":"PASS" };
}

async function auditWallpaperPreloadNetwork(client, server) {
  const scenarios = [
    {
      name: "dynamic-desktop",
      viewport: viewports.find((item) => item.width === 1280 && item.height === 720),
      expectedShell: "desktop",
      expectedPath: "/assets/images/wallpaper-dynamic/day/optimized/base-1440.avif",
      expectedSearch: "",
      expectedType: "image/avif"
    },
    {
      name: "mobile",
      viewport: viewports.find((item) => item.width === 390 && item.height === 844),
      expectedShell: "mobile",
      expectedPath: "/assets/images/mobile-wallpapers/day.webp",
      expectedSearch: "?v=20260711-calm-motion-r13",
      expectedType: "image/webp"
    }
  ];
  const results = [];
  for (const scenario of scenarios) {
    await client.send("Page.navigate", { url: "about:blank" });
    await waitFor(client, `document.readyState==='complete'`, `${scenario.name} wallpaper blank boundary`);
    await emulate(client, scenario.viewport);
    await client.send("Emulation.setEmulatedMedia", {
      media: "screen",
      features: [
        { name: "prefers-reduced-motion", value: "no-preference" },
        { name: "prefers-color-scheme", value: "light" }
      ]
    });
    await client.send("Network.clearBrowserCache");
    server.resetRequests();
    server.setWallpaperBaseAssetCaching(true);
    let requests;
    let state;
    try {
      await navigateFresh(
        client,
        `${server.origin}/?lang=zh&wallpaper=day&welcome=0&audit-wallpaper-preload=${scenario.name}`,
        `wallpaper-preload-${scenario.name}`
      );
      await waitFor(
        client,
        `document.readyState==='complete'&&document.documentElement.dataset.uiShell===${JSON.stringify(scenario.expectedShell)}&&document.querySelector('#wallpaper-root')?.dataset.time==='day'`,
        `${scenario.name} wallpaper bootstrap`
      );
      await new Promise((ok)=>setTimeout(ok,250));
      requests = server.requestLog().filter((item)=>item.method === "GET" && isWallpaperBaseAssetPath(item.path));
      state = await evaluate(client, `(() => {
        const preload=document.querySelector('link[data-wallpaper-preload]');
        const url=preload?new URL(preload.href):null;
        return {
          reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
          shell:document.documentElement.dataset.uiShell||'',
          theme:document.querySelector('#wallpaper-root')?.dataset.time||'',
          motion:document.querySelector('#wallpaper-root')?.dataset.motion||'',
          background:getComputedStyle(document.querySelector('.wallpaper-base')).backgroundImage,
          preload:preload?{href:url.pathname+url.search,type:preload.type,srcset:preload.imageSrcset||''}:null
        };
      })()`);
    } finally {
      server.setWallpaperBaseAssetCaching(false);
    }
    const failures = [];
    const expectedHref = `${scenario.expectedPath}${scenario.expectedSearch}`;
    if (state.reduced) failures.push("no-preference motion emulation was not active");
    if (state.shell !== scenario.expectedShell || state.theme !== "day") {
      failures.push(`wallpaper shell/theme bootstrap is wrong: ${JSON.stringify(state)}`);
    }
    if (state.preload?.href !== expectedHref || state.preload?.type !== scenario.expectedType || state.preload?.srcset) {
      failures.push(`preload does not exactly match the applied CSS resource: ${JSON.stringify(state.preload)}`);
    }
    if (requests.length !== 1 || requests[0]?.path !== scenario.expectedPath || requests[0]?.search !== scenario.expectedSearch) {
      failures.push(`expected one exact wallpaper request for ${expectedHref}: ${JSON.stringify(requests)}`);
    }
    results.push({
      kind: "wallpaper-preload-network",
      name: scenario.name,
      shell: scenario.expectedShell,
      viewport: scenario.viewport,
      state,
      requests,
      failures,
      status: failures.length ? "FAIL" : "PASS"
    });
  }
  return results;
}

async function auditResponsiveReleaseMatrix(client, origin) {
  const results = [];
  for (const viewport of viewports) {
    await emulate(client, viewport);
    for (const lang of Object.keys(semanticLanguages)) {
      await client.send("Page.navigate", { url: `${origin}/?lang=${lang}&wallpaper=${fixedTheme}&welcome=0&audit-release-matrix=1` });
      await stable(client, "home");
      for (const route of auditRoutes) {
        await setAuditRoute(client, route);
        await stable(client, route);
        const state = await evaluate(client, `(() => {
          const round=(value)=>Math.round(Number(value||0)*100)/100;
          const rect=(element)=>{if(!element)return null;const box=element.getBoundingClientRect();return {top:round(box.top),right:round(box.right),bottom:round(box.bottom),left:round(box.left),width:round(box.width),height:round(box.height)};};
          const overlap=(a,b)=>!a||!b?0:round(Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)));
          const visible=(element)=>{const style=getComputedStyle(element);const box=element.getBoundingClientRect();return !element.hidden&&style.display!=='none'&&style.visibility!=='hidden'&&box.width>0&&box.height>0;};
          const page=document.querySelector('.page.active');
          const win=page?.querySelector('.xp-window')||page;
          const dock=document.querySelector('.xp-taskbar');
          const topbar=document.querySelector('.xp-topbar');
          const interactive=[...page.querySelectorAll('button,input,textarea,select,summary,a[href],[role="button"]')].filter(visible);
          const touchTargets=interactive.filter((element)=>element.matches('.close-button,.mobile-home-button,.card-action,.xp-button,.chat-send-button,.about-social-link,[data-account-toggle]'));
          const undersized=touchTargets.flatMap((element)=>{const box=rect(element);return box.width<43.5||box.height<43.5?[{selector:element.id||String(element.className||element.tagName).slice(0,100),box}]:[];});
          const cards=[...page.querySelectorAll('.resource-card,.video-card,.game-card,.blog-card')].filter(visible);
          const cardContainment=cards.flatMap((card,index)=>[...card.querySelectorAll('h2,h3,p,.card-action,.resource-meta,.game-meta')].filter(visible).flatMap((child)=>{const outer=rect(card),inner=rect(child);return inner.left<outer.left-1||inner.right>outer.right+1||inner.top<outer.top-1||inner.bottom>outer.bottom+1?[{card:index,child:child.className||child.tagName,outer,inner}]:[];}));
          const cardRects=cards.map(rect);
          const cardOverlaps=[];
          for(let i=0;i<cardRects.length;i+=1)for(let j=i+1;j<cardRects.length;j+=1){const area=overlap(cardRects[i],cardRects[j]);if(area>1)cardOverlaps.push({a:i,b:j,area});}
          const forms=[...page.querySelectorAll('input,textarea,select')].filter(visible).map((control)=>({id:control.id,labelled:Boolean(control.labels?.length||control.getAttribute('aria-label')||control.getAttribute('aria-labelledby'))}));
          const topChildren=[...document.querySelectorAll('.xp-topbar > .brand-button,.xp-topbar > .topbar-actions')].filter(visible).map(rect);
          const taskbarParts=[...document.querySelectorAll('.xp-taskbar > .start-button,.xp-taskbar > .mobile-dock-scroll,.xp-taskbar > .taskbar-tabs,.xp-taskbar > .taskbar-clock')].filter(visible).map(rect);
          const siblingOverlap=(items)=>items.flatMap((first,index)=>items.slice(index+1).flatMap((second,offset)=>{const area=overlap(first,second);return area>1?[{a:index,b:index+offset+1,area}]:[];}));
          const scrolling=document.scrollingElement||document.documentElement;
          const scrollables=[...page.querySelectorAll('*')].filter(visible).filter((element)=>{const style=getComputedStyle(element);return ['auto','scroll'].includes(style.overflowY)&&element.scrollHeight>element.clientHeight+1;}).map((element)=>({id:element.id||'',className:String(element.className||'').slice(0,100),clientHeight:element.clientHeight,scrollHeight:element.scrollHeight}));
          const aboutLinks=[...document.querySelectorAll('#about .about-social-link')].filter(visible).map((link)=>({label:link.getAttribute('aria-label')||'',title:link.title||'',target:link.target,rel:link.rel,box:rect(link)}));
          return {route:document.body.dataset.route,lang:document.documentElement.lang,viewport:{width:innerWidth,height:innerHeight},page:rect(page),window:rect(win),dock:rect(dock),topbar:rect(topbar),document:{scrollTop:scrolling.scrollTop,clientHeight:scrolling.clientHeight,scrollHeight:scrolling.scrollHeight},h1:[...page.querySelectorAll('h1')].map((item)=>item.textContent.trim()),undersized,cardContainment,cardOverlaps,unlabelled:forms.filter((item)=>!item.labelled),topbarOverlaps:siblingOverlap(topChildren),taskbarOverlaps:siblingOverlap(taskbarParts),scrollables,aboutLinks,runtimeErrors:[...(window.__auditRuntimeErrors||[])]};
        })()`);
        const failures = [];
        if (state.route !== route) failures.push(`route ${state.route} !== ${route}`);
        if (state.viewport.width !== viewport.width || state.viewport.height !== viewport.height) failures.push(`viewport ${state.viewport.width}x${state.viewport.height} !== ${viewport.width}x${viewport.height}`);
        if (state.h1.length !== 1 || !state.h1[0]) failures.push(`active H1 contract failed: ${JSON.stringify(state.h1)}`);
        if (!state.window || state.window.width <= 0 || state.window.height <= 0) failures.push("active window has no readable capacity");
        if (state.window && (state.window.left < -1 || state.window.right > viewport.width + 1)) failures.push(`active window leaves viewport: ${JSON.stringify(state.window)}`);
        if (viewport.mobile && route !== "home" && state.window?.height < Number(state.page?.height || viewport.height) * .8) failures.push(`mobile App height ${state.window?.height}px is below 80% of the available page ${state.page?.height}px`);
        if (viewport.mobile && state.undersized.length) failures.push(`primary 44px targets failed: ${JSON.stringify(state.undersized)}`);
        if (state.cardContainment.length) failures.push(`card children escape their cards: ${JSON.stringify(state.cardContainment)}`);
        if (state.cardOverlaps.length) failures.push(`cards intersect: ${JSON.stringify(state.cardOverlaps)}`);
        if (state.unlabelled.length) failures.push(`visible form controls have no label: ${JSON.stringify(state.unlabelled)}`);
        if (state.topbarOverlaps.length || state.taskbarOverlaps.length) failures.push(`shell controls overlap: ${JSON.stringify({top:state.topbarOverlaps,bottom:state.taskbarOverlaps})}`);
        if (state.document.scrollTop !== 0) failures.push(`document scrolled to ${state.document.scrollTop}`);
        if (route === "about") {
          if (!state.aboutLinks.length || state.aboutLinks.some((link) => !link.label || !link.title || link.target !== "_blank" || !/noopener/.test(link.rel))) failures.push(`About external-link labels are incomplete: ${JSON.stringify(state.aboutLinks)}`);
          const aboutWaste = state.window.height - Math.max(...state.aboutLinks.map((link) => link.box.bottom), state.window.top);
          if (!viewport.mobile && aboutWaste > viewport.height * .35) failures.push(`About window has ${Math.round(aboutWaste)}px unexplained trailing height`);
        }
        if (state.runtimeErrors.length) failures.push(`runtime errors: ${state.runtimeErrors.join(" | ")}`);
        results.push({ kind:"responsive-release-matrix", name:`${route}-${lang}-${viewport.width}x${viewport.height}`, route, lang, shell:viewport.mobile?"mobile":"desktop", viewport, state, failures, status:failures.length?"FAIL":"PASS" });
      }
    }
  }
  return results;
}

async function auditHomeThemeAndInteractionContracts(client, origin, output) {
  const viewportSet = viewports.filter((item) => !item.mobile && [1280, 1440].includes(item.width));
  const samples = [];
  const failures = [];
  const contrastWarnings = [];
  for (const viewport of viewportSet) {
    let baseline = null;
    for (const theme of timeThemes) {
      await emulate(client, viewport);
      await client.send("Page.navigate", { url:`${origin}/?lang=zh&wallpaper=${theme}&welcome=0&audit-home-theme=1` });
      await stable(client, "home");
      const sample = await evaluate(client, `(() => {
        const rect=(element)=>{const box=element?.getBoundingClientRect();return box?{left:box.left,top:box.top,right:box.right,bottom:box.bottom,width:box.width,height:box.height}:null;};
        const icons=[...document.querySelectorAll('.desktop-icons .desktop-icon')].filter((item)=>!item.hidden&&item.getClientRects().length).map((item)=>({route:item.dataset.route,tabIndex:item.tabIndex,box:rect(item)}));
        const parse=(value)=>{const match=String(value).match(/[\\d.]+/g);if(!match)return null;const [r,g,b,a=1]=match.map(Number);return {r,g,b,a};};
        const blend=(front,back)=>({r:front.r*front.a+back.r*(1-front.a),g:front.g*front.a+back.g*(1-front.a),b:front.b*front.a+back.b*(1-front.a),a:1});
        const background=(element)=>{let current=element;let result={r:255,g:255,b:255,a:1};const chain=[];while(current){chain.unshift(current);current=current.parentElement;}for(const node of chain){const color=parse(getComputedStyle(node).backgroundColor);if(color&&color.a>0)result=blend(color,result);}return result;};
        const luminance=(color)=>{const channel=(value)=>{value/=255;return value<=.03928?value/12.92:((value+.055)/1.055)**2.4;};return .2126*channel(color.r)+.7152*channel(color.g)+.0722*channel(color.b);};
        const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
        const selectors=['.brand-button','.top-updated','.language-switcher .lang-button','.xp-taskbar .start-button','.desktop-icon-label'];
        const contrasts=selectors.flatMap((selector)=>{const element=document.querySelector(selector);if(!element)return[];const foreground=parse(getComputedStyle(element).color),back=background(element);return foreground?[{selector,foreground,background:back,ratio:Math.round(contrast(foreground,back)*100)/100}]:[];});
        return {theme:document.body.dataset.timeTheme,icons,stage:rect(document.getElementById('wallpaper-stage')),desktop:rect(document.querySelector('.desktop-icons')),contrasts};
      })()`);
      const positions = sample.icons.map((item) => [item.route, Math.round(item.box.left), Math.round(item.box.top)]);
      if (!baseline) baseline = positions;
      else if (JSON.stringify(positions) !== JSON.stringify(baseline)) failures.push(`${viewport.width} theme ${theme} moved Home icons`);
      const rightmost = Math.max(...sample.icons.map((item) => item.box.right));
      if (viewport.width - rightmost < viewport.width * .35) failures.push(`${viewport.width} theme ${theme} lost central/right composition whitespace`);
      for (const evidence of sample.contrasts) if (evidence.ratio < 3) contrastWarnings.push(`${viewport.width} ${theme} ${evidence.selector} computed translucent-token estimate ${evidence.ratio} < 3; verify against rendered pixels manually`);
      samples.push({ viewport, ...sample });
    }
  }

  const desktop = viewports.find((item) => item.width === 1280);
  await emulate(client, desktop);
  await client.send("Page.navigate", { url:`${origin}/?lang=zh&wallpaper=day&welcome=0&audit-welcome-setup=1` });
  await stable(client, "home");
  await evaluate(client, `(() => { localStorage.setItem('lusu-welcome-day','2000-01-01'); sessionStorage.removeItem('lusu-welcome-day'); return true; })()`);
  await client.send("Page.navigate", { url:`${origin}/?lang=zh&wallpaper=day&audit-welcome-daily=1` });
  await stable(client, "home");
  await waitFor(client, `document.getElementById('welcome-modal')?.hidden===false`, "first daily welcome dialog");
  const welcome = await evaluate(client, `(() => {const rows=[...document.querySelectorAll('#recent-updates li')];const now=new Date();const localDay=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');return {count:rows.length,rows:rows.map((row)=>({title:row.querySelector('strong')?.textContent.trim()||'',date:row.querySelector('small')?.textContent.trim()||'',label:row.querySelector('a')?.getAttribute('aria-label')||''})),closeHeight:document.querySelector('[data-close-welcome]')?.getBoundingClientRect().height||0,localDay,storedDay:localStorage.getItem('lusu-welcome-day'),sessionDay:sessionStorage.getItem('lusu-welcome-day')};})()`);
  if (welcome.count !== 3 || welcome.rows.some((row) => !row.title || !/^\d{4}[./-]\d{2}[./-]\d{2}/.test(row.date) || !row.label.includes(row.title))) failures.push(`welcome must expose three complete title/date rows: ${JSON.stringify(welcome)}`);
  if (welcome.storedDay !== welcome.localDay || welcome.sessionDay !== welcome.localDay) failures.push(`welcome did not record the local day when first opened: ${JSON.stringify(welcome)}`);
  await evaluate(client, `document.querySelector('#welcome-modal [data-close-welcome]')?.click(); true`);
  await waitFor(client, `document.getElementById('welcome-modal')?.hidden===true`, "welcome close persistence");
  await client.send("Page.navigate", { url:`${origin}/?lang=zh&wallpaper=day&audit-welcome-return=1` });
  await stable(client, "home");
  const persisted = await evaluate(client, `document.getElementById('welcome-modal')?.hidden===true`);
  if (!persisted) failures.push("daily welcome appeared more than once on the same local day");
  const roving = await evaluate(client, `(() => {const icons=[...document.querySelectorAll('.desktop-icons .desktop-icon')].filter((item)=>!item.hidden&&item.getClientRects().length);const first=icons.find((item)=>item.tabIndex===0);first?.focus();first?.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));const right=document.activeElement?.dataset.route||'';document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));return {zero:icons.filter((item)=>item.tabIndex===0).length,first:first?.dataset.route||'',right,down:document.activeElement?.dataset.route||''};})()`);
  if (roving.zero !== 1 || !roving.first || !roving.right || roving.right === roving.first || !roving.down || roving.down === roving.right) failures.push(`Home two-dimensional roving keyboard failed: ${JSON.stringify(roving)}`);
  const screenshot = await client.send("Page.captureScreenshot", { format:"png", fromSurface:true, captureBeyondViewport:false });
  const screenshotFile = "release-home-day-1280x720.png";
  await writeFile(resolve(output, screenshotFile), Buffer.from(screenshot.data, "base64"));
  return { kind:"home-theme-interaction", name:"home-theme-welcome-roving", viewport:desktop, samples, contrastWarnings, contrastCertified:false, welcome, persisted, roving, screenshotFile, failures, status:failures.length?"FAIL":"PASS" };
}

async function auditLifecycleGrowth(client, origin) {
  const viewport = viewports.find((item) => item.width === 390 && item.height === 844);
  await emulate(client, viewport);
  const instrumentation = await client.send("Page.addScriptToEvaluateOnNewDocument", { source:`(() => {const create=URL.createObjectURL?.bind(URL);const revoke=URL.revokeObjectURL?.bind(URL);const live=new Set();if(create)URL.createObjectURL=(value)=>{const url=create(value);live.add(url);return url;};if(revoke)URL.revokeObjectURL=(url)=>{live.delete(url);return revoke(url);};Object.defineProperty(window,'__auditObjectUrls',{value:live});})();` });
  try {
    await client.send("Page.navigate", { url:`${origin}/?lang=zh&wallpaper=day&welcome=0&audit-lifecycle-growth=1` });
    await stable(client, "home");
    const snapshots = [];
    for (let round = 0; round < 3; round += 1) {
      for (const route of auditRoutes.filter((item) => item !== "home")) { await setAuditRoute(client, route); await stable(client, route); }
      await setAuditRoute(client, "home"); await stable(client, "home");
      await client.send("HeapProfiler.collectGarbage").catch(() => {});
      const counters = await client.send("Memory.getDOMCounters");
      const runtime = await evaluate(client, `({lifecycle:window.__lusuRouteLifecycleAudit?.()||null,transfer:window.QuickTransfer?.lifecycleSnapshot?.()||null,objectUrls:window.__auditObjectUrls?.size||0,runtimeErrors:[...(window.__auditRuntimeErrors||[])]})`);
      snapshots.push({ round:round + 1, counters, runtime });
    }
    const first = snapshots[0].counters, last = snapshots.at(-1).counters;
    const failures = [];
    if (last.documents > first.documents + 1) failures.push(`documents grew ${first.documents} -> ${last.documents}`);
    if (last.nodes > first.nodes + 80) failures.push(`DOM nodes grew ${first.nodes} -> ${last.nodes}`);
    if (last.jsEventListeners > first.jsEventListeners + 12) failures.push(`listeners grew ${first.jsEventListeners} -> ${last.jsEventListeners}`);
    if (snapshots.some((item) => item.runtime.objectUrls)) failures.push(`Object URLs remain live: ${JSON.stringify(snapshots.map((item)=>item.runtime.objectUrls))}`);
    if (snapshots.some((item) => item.runtime.runtimeErrors.length)) failures.push("runtime errors occurred during lifecycle rounds");
    for (const snapshot of snapshots) for (const [route, state] of Object.entries(snapshot.runtime.lifecycle?.routes || {})) if (route !== "home" && (state.active || state.timers || state.observers || state.requests || state.abortControllers)) failures.push(`round ${snapshot.round} retained ${route}: ${JSON.stringify(state)}`);
    return { kind:"lifecycle-growth", name:"three-route-rounds", shell:"mobile", viewport, snapshots, failures, status:failures.length?"FAIL":"PASS" };
  } finally {
    await client.send("Page.removeScriptToEvaluateOnNewDocument", { identifier:instrumentation.identifier }).catch(() => {});
  }
}

async function auditPerformanceTraces(client, server, output) {
  const viewport = viewports.find((item) => item.width === 1280 && item.height === 720);
  const scenarios = [
    { name:"home-first-screen", route:"home", sampleCount:3, action:async()=>{} },
    { name:"route-switch", route:"home", action:async()=>{await setAuditRoute(client,"resources");await stable(client,"resources");} },
    { name:"long-article", route:"article", action:async()=>{} },
    { name:"chat", route:"chatroom", action:async()=>{} },
    { name:"transfer", route:"resources", maxRequests:56, action:async()=>{await openQuickTransferFromCta(client);} }
  ];
  const budgets = { requests:55, encodedBytes:12*1024*1024, decodedBytes:24*1024*1024, loadMs:4000, cls:.2, tbtMs:350, nodes:6500, listeners:800, heapBytes:96*1024*1024 };
  const results = [];
  for (const scenario of scenarios) {
    const samples = [];
    const sampleCount = scenario.sampleCount || 1;
    for (let sample = 1; sample <= sampleCount; sample += 1) {
      await emulate(client, viewport); server.resetRequests();
      const transfers = new Map();
      const offResponse = client.on("Network.responseReceived", ({ requestId, response, type }) => transfers.set(requestId, { url:response.url, type, mimeType:response.mimeType, encodedDataLength:Number(response.encodedDataLength||0) }));
      const offFinished = client.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => { const item=transfers.get(requestId); if(item)item.encodedDataLength=Math.max(item.encodedDataLength,Number(encodedDataLength||0)); });
      const sampleQuery = `&audit-performance-sample=${sample}`;
      const url = scenario.route === "article" ? `${server.origin}/articles/${article.slug}?lang=zh&wallpaper=day&welcome=0&audit-performance-trace=${scenario.name}${sampleQuery}` : `${server.origin}/?lang=zh&wallpaper=day&welcome=0&audit-performance-trace=${scenario.name}${sampleQuery}${scenario.route === "home" ? "" : `#${scenario.route}`}`;
      try {
        await client.send("Page.navigate", { url }); await stable(client, scenario.route); await scenario.action(); await waitFrames(client, 4); await new Promise((ok)=>setTimeout(ok,300));
      } finally {
        offResponse(); offFinished();
      }
      const web = await evaluate(client, `(() => {const nav=performance.getEntriesByType('navigation')[0];const resources=performance.getEntriesByType('resource');const paints=performance.getEntriesByType('paint');const longTasks=window.__auditPerformanceEntries?.longtask||[];const shifts=(window.__auditPerformanceEntries?.['layout-shift']||[]).filter((item)=>!item.hadRecentInput);const lcp=(window.__auditPerformanceEntries?.['largest-contentful-paint']||[]).at(-1);return {navigation:{domContentLoaded:nav?.domContentLoadedEventEnd||0,load:nav?.loadEventEnd||0,transferSize:nav?.transferSize||0,decodedBodySize:nav?.decodedBodySize||0},resources:{count:resources.length,transferSize:resources.reduce((sum,item)=>sum+(item.transferSize||0),0),decodedBodySize:resources.reduce((sum,item)=>sum+(item.decodedBodySize||0),0)},paint:{...Object.fromEntries(paints.map((item)=>[item.name,item.startTime])),lcp:lcp?.startTime||0},longTasks:{count:longTasks.length,total:longTasks.reduce((sum,item)=>sum+item.duration,0),tbt:longTasks.reduce((sum,item)=>sum+Math.max(0,item.duration-50),0)},cls:shifts.reduce((sum,item)=>sum+item.value,0),heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null,runtimeErrors:[...(window.__auditRuntimeErrors||[])]};})()`);
      await client.send("HeapProfiler.collectGarbage").catch(() => {});
      const counters = await client.send("Memory.getDOMCounters");
      const network = [...transfers.values()].filter((item)=>item.url.startsWith(server.origin));
      const totals = { requests:network.length, encodedBytes:network.reduce((sum,item)=>sum+item.encodedDataLength,0), decodedBytes:web.navigation.decodedBodySize+web.resources.decodedBodySize };
      const failures = [];
      const requestBudget = scenario.maxRequests || budgets.requests;
      const wallpaperVideoRequests = network.filter((item) => /\/assets\/videos\/wallpaper-dynamic\/(morning|day|dusk|night)\/motion-(1080|2160)\.mp4(?:\?|$)/.test(item.url));
      if (totals.requests > requestBudget) failures.push(`requests ${totals.requests} > ${requestBudget}`);
      if (scenario.route !== "home" && wallpaperVideoRequests.length) failures.push(`non-Home route requested ambient video: ${wallpaperVideoRequests.map((item) => item.url).join(", ")}`);
      if (wallpaperVideoRequests.some((item) => !item.url.includes("/day/"))) failures.push(`wallpaper=day requested another theme video: ${wallpaperVideoRequests.map((item) => item.url).join(", ")}`);
      if (wallpaperVideoRequests.length > 1) failures.push(`ambient wallpaper requested ${wallpaperVideoRequests.length} videos instead of at most one current-theme asset`);
      if (totals.encodedBytes > budgets.encodedBytes) failures.push(`encoded bytes ${totals.encodedBytes} > ${budgets.encodedBytes}`);
      if (totals.decodedBytes > budgets.decodedBytes) failures.push(`decoded bytes ${totals.decodedBytes} > ${budgets.decodedBytes}`);
      if (web.navigation.load > budgets.loadMs) failures.push(`load ${Math.round(web.navigation.load)}ms > ${budgets.loadMs}ms`);
      if (web.cls > budgets.cls) failures.push(`CLS ${web.cls} > ${budgets.cls}`);
      if (counters.nodes > budgets.nodes || counters.jsEventListeners > budgets.listeners) failures.push(`memory counters exceed budget: ${JSON.stringify(counters)}`);
      if (web.heap?.used > budgets.heapBytes) failures.push(`JS heap ${web.heap.used} > ${budgets.heapBytes}`);
      if (web.runtimeErrors.length) failures.push(`runtime errors: ${web.runtimeErrors.join(" | ")}`);
      samples.push({ sample, totals, web, counters, network, failures, status:failures.length?"FAIL":"PASS" });
    }
    const orderedByTbt = [...samples].sort((left, right) => left.web.longTasks.tbt - right.web.longTasks.tbt);
    const representative = orderedByTbt[Math.floor(orderedByTbt.length / 2)];
    const tbtSamples = samples.map((sample) => sample.web.longTasks.tbt);
    const tbtMedian = representative.web.longTasks.tbt;
    const tbtMax = Math.max(...tbtSamples);
    const failures = samples.flatMap((sample) => sample.failures.map((failure) => sampleCount > 1 ? `sample ${sample.sample}: ${failure}` : failure));
    if (tbtMedian > budgets.tbtMs) failures.push(`TBT median ${Math.round(tbtMedian)}ms > ${budgets.tbtMs}ms (samples: ${tbtSamples.map(Math.round).join(", ")})`);
    const diagnostics = tbtMedian <= budgets.tbtMs && tbtMax > budgets.tbtMs ? [`TBT max ${Math.round(tbtMax)}ms exceeded ${budgets.tbtMs}ms while the median passed`] : [];
    if (diagnostics.length) console.warn(`OPT-093 performance ${scenario.name}: ${diagnostics.join(" | ")}`);
    results.push({
      kind:"performance-trace",
      name:scenario.name,
      shell:"desktop",
      viewport,
      totals:representative.totals,
      web:representative.web,
      counters:representative.counters,
      budgets,
      network:representative.network,
      tbtSamples,
      tbtMedian,
      tbtMax,
      diagnostics,
      samples,
      failures,
      status:failures.length?"FAIL":"PASS"
    });
  }
  await writeFile(resolve(output,"performance-traces.json"), `${JSON.stringify({generatedAt:new Date().toISOString(),results},null,2)}\n`, "utf8");
  return results;
}

async function runReleaseAudit(client, server, options, executable) {
  const results = [];
  const performance = await auditPerformanceTraces(client, server, options.output); results.push(...performance); performance.forEach((item)=>logAuditStatus(item, `OPT-093 performance ${item.name}`));
  const matrix = await auditResponsiveReleaseMatrix(client, server.origin); results.push(...matrix); logAuditStatus({ failures:matrix.flatMap((item)=>item.failures), status:matrix.some((item)=>item.failures.length)?"FAIL":"PASS" }, `OPT-091/092 responsive matrix (${matrix.length} route combinations)`);
  const home = await auditHomeThemeAndInteractionContracts(client, server.origin, options.output); results.push(home); logAuditStatus(home, "OPT-029/030/051-055 Home/theme/shell/About contracts");
  const semantics = await auditSemanticMatrix(client, server.origin, viewports.find((item)=>item.width===1280), ["zh","en","ja"]); results.push(...semantics); logAuditStatus({failures:semantics.flatMap((item)=>item.failures),status:semantics.some((item)=>item.failures.length)?"FAIL":"PASS"}, "OPT-094 semantic smoke");
  const forcedColors = await auditForcedColorsSmoke(client, server.origin); results.push(forcedColors); logAuditStatus(forcedColors,"OPT-094 forced-colors smoke");
  const wallpaperPreloadNetwork = await auditWallpaperPreloadNetwork(client, server); results.push(...wallpaperPreloadNetwork); wallpaperPreloadNetwork.forEach((item)=>logAuditStatus(item, `OPT-093 wallpaper preload ${item.name}`));
  const reducedMotionNetwork = await auditReducedMotionWallpaperNetwork(client, server); results.push(reducedMotionNetwork); logAuditStatus(reducedMotionNetwork,"OPT-093 reduced-motion optimized wallpaper network");
  const ambientPlayback = await auditAmbientWallpaperPlayback(client, server); results.push(ambientPlayback); logAuditStatus(ambientPlayback,"OPT-093 ambient wallpaper 1080/4K playback and zero-request fallbacks");
  const optionalBlog = await auditOptionalBlogRoute(client, server.origin, viewports.find((item)=>item.width===1280)); results.push(optionalBlog); logAuditStatus(optionalBlog,"OPT-091 optional unpublished Blog route");
  const lifecycle = await auditLifecycleGrowth(client, server.origin); results.push(lifecycle); logAuditStatus(lifecycle,"OPT-096 lifecycle growth");
  const summary = { audit:"public-site-release-gates", generatedAt:new Date().toISOString(), browser:basename(executable), contract:releaseAuditContract, limitations:["Automated CDP/AX/forced-state smoke is not a WCAG certification or a real NVDA, JAWS, VoiceOver, iOS, or Android test.","Performance budgets are deterministic localhost regression budgets, not field Core Web Vitals.","OPT-100 is local evidence only; this command never commits, pushes, deploys, or calls production."], results };
  await writeFile(resolve(options.output,"release-summary.json"), `${JSON.stringify(summary,null,2)}\n`, "utf8");
  const failed = results.filter((item)=>item.failures?.length);
  if (failed.length) throw new Error(`${failed.length} release audit scenario(s) failed`);
  console.log(`public-ui-audit release: ok (${results.length} checks, ${options.output})`);
}

async function main() {
  validateViewports(); const options = args(process.argv.slice(2));
  if (options.list) { console.log(JSON.stringify({ fixedTheme, viewports, fixedShellScenarios, mobileViewportScenarios, resourceVisualLanguages, resourceVisualViewportKeys, resourceVisualExpectedResultCount, ...mobileViewportLimitations }, null, 2)); return; }
  const executable = chromePath(options.chrome); await mkdir(options.output, { recursive: true }); const server = await auditServer(); let chrome; let client; const results = [];
  try {
    chrome = await startChrome(executable); client = new CDP(chrome.socket); await client.connect(); await client.send("Page.enable"); await client.send("Runtime.enable"); await client.send("Network.enable");
    await client.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
      const errors = [];
      Object.defineProperty(window, "__auditRuntimeErrors", { configurable: false, enumerable: false, value: errors });
      const performanceEntries = { longtask: [], "layout-shift": [], "largest-contentful-paint": [] };
      Object.defineProperty(window, "__auditPerformanceEntries", { configurable: false, enumerable: false, value: performanceEntries });
      for (const type of Object.keys(performanceEntries)) {
        try { new PerformanceObserver((list) => performanceEntries[type].push(...list.getEntries())).observe({ type, buffered: true }); } catch {}
      }
      window.addEventListener("error", (event) => errors.push(String(event.error?.stack || event.message || "window error")));
      window.addEventListener("unhandledrejection", (event) => errors.push(String(event.reason?.stack || event.reason || "unhandled rejection")));
    })();` });
    await client.send("Network.setCacheDisabled", { cacheDisabled: true });
    if (options.releaseOnly) {
      await runReleaseAudit(client, server, options, executable);
      return;
    }
    if (options.dockIconOnly) {
      const result = await auditDockIconTransition(client, server.origin, options.output);
      logAuditStatus(result, "mobile Dock and Chat icon transition");
      if (result.failures.length) throw new Error(`${result.failures.length} Dock/Chat icon check(s) failed`);
      console.log(`public-ui-audit dock/icon: ok (${options.output})`);
      return;
    }
    if (options.resourcesOnly) {
      const resourceResults = await auditResourcesVisualReview(client, server.origin, options.output);
      for (const result of resourceResults) logAuditStatus(result, `${result.name} -> ${result.screenshotFile}`);
      const failedResourceChecks = resourceResults.filter((result) => result.failures.length);
      if (failedResourceChecks.length) throw new Error(`${failedResourceChecks.length} Resources visual review check(s) failed`);
      console.log(`public-ui-audit Resources visual review: ok (${resourceResults.length} checks, ${options.output})`);
      return;
    }
    if (options.articleOnly) {
      const articleResults = [];
      for (const viewport of [
        viewports.find((item) => item.width === 359 && item.height === 500),
        viewports.find((item) => item.width === 375 && item.height === 667),
        viewports.find((item) => item.width === 390 && item.height === 844),
        viewports.find((item) => item.width === 844 && item.height === 390),
        viewports.find((item) => item.width === 1280 && item.height === 720),
        viewports.find((item) => item.width === 1440 && item.height === 900)
      ]) {
        articleResults.push(
          await auditArticleScrollAndProgress(client, server.origin, viewport),
          await auditArticleTocAndReadingDetails(client, server.origin, viewport, options.output)
        );
      }
      articleResults.push(
        ...await auditArticleMetadataLanguages(
          client,
          server.origin,
          viewports.find((item) => item.width === 390 && item.height === 844)
        )
      );
      for (const result of articleResults) logAuditStatus(result, `${result.name}${result.screenshotFile ? ` -> ${result.screenshotFile}` : ""}`);
      await writeFile(resolve(options.output, "article-summary.json"), `${JSON.stringify({ generatedAt:new Date().toISOString(), results:articleResults }, null, 2)}\n`, "utf8");
      const failedArticleChecks = articleResults.filter((result) => result.failures.length);
      if (failedArticleChecks.length) throw new Error(`${failedArticleChecks.length} article reader check(s) failed`);
      console.log(`public-ui-audit article reader: ok (${articleResults.length} checks, ${options.output})`);
      return;
    }
    if (options.videoOnly) {
      for (const viewport of [
        viewports.find((item) => item.width === 1280 && item.height === 720),
        viewports.find((item) => item.width === 390 && item.height === 844),
        viewports.find((item) => item.width === 844 && item.height === 390)
      ]) {
        const videoFlow = await auditControlledVideoFlow(client, server.origin, viewport, options.output);
        results.push(videoFlow);
        logAuditStatus(videoFlow, `OPT-041/042/043/044/045 controlled video ${viewport.width}x${viewport.height}`);
      }
      const failedVideoChecks = results.filter((item) => item.failures.length);
      await writeFile(resolve(options.output, "video-summary.json"), `${JSON.stringify({ generatedAt:new Date().toISOString(), results }, null, 2)}\n`, "utf8");
      if (failedVideoChecks.length) throw new Error(`${failedVideoChecks.length} controlled video check(s) failed`);
      console.log(`public-ui-audit: ${results.length}/${results.length} controlled video checks passed`);
      return;
    }
    for (const viewport of [
      viewports.find((item) => item.width === 1280 && item.height === 720),
      viewports.find((item) => item.width === 390 && item.height === 844)
    ]) {
      const lazyLoading = await auditLazyRouteAndTransferLoading(client, server, viewport);
      results.push(lazyLoading);
      logAuditStatus(lazyLoading, `OPT-004/005/006 lazy loading ${viewport.width}x${viewport.height}`);
    }
    const themeViewports = [viewports.find((item) => item.width === 390 && item.height === 844), viewports.find((item) => item.width === 1280 && item.height === 720)];
    for (const viewport of themeViewports) {
      for (const scenario of themeBootstrapScenarios) {
        const result = await auditThemeBootstrap(client, server, viewport, scenario); results.push(result); console.log(`${result.status} theme ${scenario.name} ${result.shell} -> ${result.themeRequests[0]?.path || "no request"}`);
      }
    }
    for (const [viewport, languages] of [
      [viewports.find((item) => item.width === 1280 && item.height === 720), ["zh", "en", "ja"]],
      [viewports.find((item) => item.width === 359 && item.height === 500), ["zh"]],
      [viewports.find((item) => item.width === 390 && item.height === 844), ["en"]],
      [viewports.find((item) => item.width === 844 && item.height === 390), ["ja"]]
    ]) {
      const matrix = await auditSemanticMatrix(client, server.origin, viewport, languages); results.push(...matrix); const matrixFailures = matrix.filter((item) => item.failures.length); console.log(`${matrixFailures.length ? "FAIL" : "PASS"} semantics ${viewport.width}x${viewport.height} ${languages.join("/")} (${matrix.length} checks)`);
    }
    const metadataViewport = viewports.find((item) => item.width === 1280 && item.height === 720);
    const optionalBlog = await auditOptionalBlogRoute(client, server.origin, metadataViewport); results.push(optionalBlog); logAuditStatus(optionalBlog, "OPT-050 unpublished Blog entry and legacy redirect");
    const contentRoutes = await auditResourcesAndGamesHierarchy(client, server.origin, viewports.find((item) => item.width === 1440 && item.height === 900)); results.push(contentRoutes); logAuditStatus(contentRoutes, "OPT-046/047/048/049 Resources and Games hierarchy");
    const articleMetadata = await auditArticleMetadataLanguages(client, server.origin, metadataViewport); results.push(...articleMetadata); console.log(`${articleMetadata.some((item) => item.failures.length) ? "FAIL" : "PASS"} article metadata zh/en/ja (${articleMetadata.length} checks)`);
    articleMetadata.filter((item) => item.failures.length).forEach((item) => console.error(`${item.name}: ${item.failures.join("; ")}`));
    for (const viewport of [
      viewports.find((item) => item.width === 1440 && item.height === 900),
      viewports.find((item) => item.width === 359 && item.height === 500),
      viewports.find((item) => item.width === 390 && item.height === 844),
      viewports.find((item) => item.width === 844 && item.height === 390)
    ]) {
      const articleScrollProgress = await auditArticleScrollAndProgress(client, server.origin, viewport);
      results.push(articleScrollProgress);
      logAuditStatus(articleScrollProgress, `OPT-037/038 article scroll/progress ${viewport.width}x${viewport.height}`);
      const articleReader = await auditArticleTocAndReadingDetails(client, server.origin, viewport, options.output);
      results.push(articleReader);
      logAuditStatus(articleReader, `OPT-039/040 article TOC/reading details ${viewport.width}x${viewport.height}`);
    }
    for (const viewport of [
      viewports.find((item) => item.width === 1280 && item.height === 720),
      viewports.find((item) => item.width === 390 && item.height === 844),
      viewports.find((item) => item.width === 844 && item.height === 390)
    ]) {
      const videoFlow = await auditControlledVideoFlow(client, server.origin, viewport, options.output);
      results.push(videoFlow);
      logAuditStatus(videoFlow, `OPT-041/042/043/044/045 controlled video ${viewport.width}x${viewport.height}`);
    }
    for (const [viewport, modalOptions] of [
      [metadataViewport, { lang: "zh", kind: "welcome", motion: "full" }],
      [metadataViewport, { lang: "en", kind: "video", motion: "reduced" }],
      [viewports.find((item) => item.width === 359 && item.height === 500), { lang: "zh", kind: "welcome", motion: "reduced" }],
      [viewports.find((item) => item.width === 390 && item.height === 844), { lang: "en", kind: "welcome", motion: "reduced" }],
      [viewports.find((item) => item.width === 390 && item.height === 844), { lang: "en", kind: "video", motion: "reduced" }],
      [viewports.find((item) => item.width === 844 && item.height === 390), { lang: "ja", kind: "video", motion: "reduced" }]
    ]) {
      const modalResult = await auditModalIsolation(client, server.origin, viewport, { ...modalOptions, output: options.output }); results.push(modalResult); console.log(`${modalResult.status} ${modalOptions.kind} modal ${modalOptions.motion} ${viewport.width}x${viewport.height} ${modalOptions.lang} -> ${modalResult.screenshotFile}`);
    }
    const portraitMobile = viewports.find((item) => item.width === 390 && item.height === 844);
    const landscapeMobile = viewports.find((item) => item.width === 844 && item.height === 390);
    const frameCoalescing = await auditFramePipelineCoalescing(client, server.origin, portraitMobile); results.push(frameCoalescing); console.log(`${frameCoalescing.status} frame pipeline same-frame event coalescing`);
    for (const viewport of [portraitMobile, landscapeMobile]) {
      const frameViewport = await auditFramePipelineViewport(client, server.origin, viewport); results.push(frameViewport); console.log(`${frameViewport.status} frame pipeline viewport/Dock ${viewport.width}x${viewport.height}`);
    }
    const pageScale = await auditNativePageScale(client, server.origin, portraitMobile); results.push(pageScale); console.log(`${pageScale.status} native pageScale 2 keyboard classification (real soft keyboard not tested)`);
    const shortMobile = viewports.find((item) => item.width === 359 && item.height === 500);
    const constrainedMobile = Object.freeze({ name:"phone-height-proxy", width:390, height:500, mobile:true });
    const chatGrowth = await auditChatGrowthRecovery(client, server.origin, shortMobile); results.push(chatGrowth); console.log(`${chatGrowth.status} fixed shell Chat growth 359x500 (real soft keyboard not tested)`);
    const chatCapacity = await auditChatShortScreenCapacity(client, server.origin, shortMobile); results.push(chatCapacity); logAuditStatus(chatCapacity, "OPT-079 Chat 359x500 capacity and private safety disclosure");
    const constrainedChat = await auditConstrainedChatRecovery(client, server.origin, portraitMobile, constrainedMobile); results.push(constrainedChat); console.log(`${constrainedChat.status} constrained Chat 390x844 -> 390x500 -> 390x844 (height proxy only)`);
    for (const route of ["article", "about"]) {
      const scrollOwner = await auditRouteScrollOwner(client, server.origin, constrainedMobile, route); results.push(scrollOwner); console.log(`${scrollOwner.status} internal scroll owner ${route} 390x500`);
    }
    const pageScaleFocus = await auditPageScaleInternalFocus(client, server.origin, portraitMobile); results.push(pageScaleFocus); logAuditStatus(pageScaleFocus, "pageScale 2 internal focus recovery (real soft keyboard not tested)");
    const keyboardChat = await auditKeyboardChatCompose(client, server.origin, portraitMobile, constrainedMobile); results.push(keyboardChat); logAuditStatus(keyboardChat, "OPT-085 Chat composer keyboard viewport proxy");
    const keyboardChatPrivate = await auditKeyboardChatPrivate(client, server.origin, portraitMobile, constrainedMobile); results.push(keyboardChatPrivate); logAuditStatus(keyboardChatPrivate, "OPT-085 Chat private-room keyboard viewport proxy");
    const keyboardAccountHome = await auditKeyboardAccount(client, server.origin, portraitMobile, constrainedMobile, "home"); results.push(keyboardAccountHome); logAuditStatus(keyboardAccountHome, "OPT-085 Home account inline-error keyboard proxy");
    const keyboardAccountTransfer = await auditKeyboardAccount(client, server.origin, portraitMobile, constrainedMobile, "resources"); results.push(keyboardAccountTransfer); logAuditStatus(keyboardAccountTransfer, "OPT-085 Resources Transfer account keyboard proxy");
    const keyboardKnowledge = await auditKeyboardKnowledgeSearch(client, server.origin, portraitMobile, constrainedMobile); results.push(keyboardKnowledge); logAuditStatus(keyboardKnowledge, "OPT-085 Knowledge search keyboard viewport proxy");
    const keyboardTransferEntry = await auditKeyboardTransferEntry(client, server.origin, portraitMobile, constrainedMobile); results.push(keyboardTransferEntry); logAuditStatus(keyboardTransferEntry, "OPT-085 Transfer room-entry keyboard viewport proxy");
    const keyboardTransferComposer = await auditKeyboardTransferComposer(client, server.origin, portraitMobile, constrainedMobile); results.push(keyboardTransferComposer); logAuditStatus(keyboardTransferComposer, "OPT-085 Transfer composer keyboard viewport proxy");
    const browserUiMobile = Object.freeze({ name:"phone-browser-ui-proxy", width:390, height:760, mobile:true });
    const browserUiProxy = await auditBrowserUiHeightProxy(client, server.origin, portraitMobile, browserUiMobile); results.push(browserUiProxy); console.log(`${browserUiProxy.status} OPT-085 browser UI height proxy (real browser chrome not tested)`);
    const orientationRoundTrip = await auditOrientationRoundTrip(client, server.origin, portraitMobile, landscapeMobile); results.push(orientationRoundTrip); console.log(`${orientationRoundTrip.status} OPT-085 orientation round trip`);
    const zoomLayout = await auditPageScaleLayoutStability(client, server.origin, portraitMobile); results.push(zoomLayout); console.log(`${zoomLayout.status} OPT-085 pageScale 2 layout stability`);
    for (const collapsed of [false, true]) {
      const dockPreference = await auditDockKeyboardPreference(client, server.origin, portraitMobile, constrainedMobile, collapsed); results.push(dockPreference); console.log(`${dockPreference.status} OPT-085 ${collapsed ? "collapsed" : "expanded"} Dock keyboard round trip`);
    }
    const safeAreaProxy = await auditSafeAreaInsetsProxy(client, server.origin, portraitMobile, landscapeMobile); results.push(safeAreaProxy); console.log(`${safeAreaProxy.status} OPT-085 safe-area proxy${safeAreaProxy.safeAreaProxySupported ? "" : " (CDP unsupported; recorded)"}`);
    for (const profile of [
      { name: "save-data-low", hardwareConcurrency: 8, saveData: true, screenshot: true },
      { name: "two-core-low", hardwareConcurrency: 2, saveData: false },
      { name: "unknown-capability-normal", unknown: true }
    ]) {
      const performanceTier = await auditPerformanceTier(client, server.origin, portraitMobile, profile, options.output); results.push(performanceTier); console.log(`${performanceTier.status} performance tier ${profile.name}${performanceTier.screenshotFile ? ` -> ${performanceTier.screenshotFile}` : ""}`);
    }
    for (const viewport of [
      viewports.find((item) => item.width === 1280 && item.height === 720),
      viewports.find((item) => item.width === 390 && item.height === 844)
    ]) {
      const lifecycle = await auditRouteLifecycle(client, server.origin, viewport); results.push(lifecycle); console.log(`${lifecycle.status} route lifecycle ${viewport.width}x${viewport.height}`);
      const exitFocus = await auditRouteExitFocus(client, server.origin, viewport); results.push(exitFocus); console.log(`${exitFocus.status} route-exit focus ${viewport.width}x${viewport.height}`);
      const articleFocus = await auditArticleFocusHistory(client, server.origin, viewport); results.push(articleFocus); console.log(`${articleFocus.status} article-history focus ${viewport.width}x${viewport.height}`);
      const directReturn = await auditDirectArticleReturn(client, server.origin, viewport); results.push(directReturn); console.log(`${directReturn.status} direct-article return ${viewport.width}x${viewport.height}`);
      const malformedHistory = await auditMalformedHistoryState(client, server.origin, viewport); results.push(malformedHistory); console.log(`${malformedHistory.status} malformed-history state ${viewport.width}x${viewport.height}`);
      const transferCaret = await auditTransferCaret(client, server.origin, viewport); results.push(transferCaret); console.log(`${transferCaret.status} Transfer caret ${viewport.width}x${viewport.height}`);
    }
    for (const viewport of viewports) { const result = await capture(client, server.origin, options.output, viewport, "chatroom"); results.push(result); console.log(`${result.status} chatroom ${viewport.width}x${viewport.height} -> ${result.file}`); }
    const landscape = viewports.find((item) => item.width === 844 && item.height === 390); const articleResult = await capture(client, server.origin, options.output, landscape, "article"); results.push(articleResult); console.log(`${articleResult.status} article 844x390 -> ${articleResult.file}`);
    const summary = { audit: "public-site-ui-baseline", generatedAt: new Date().toISOString(), browser: basename(executable), fixedTheme, timeThemes, motion: "off", exactCdpViewport: true, ...mobileViewportLimitations, limitations: ["OPT-020 audits native pageScale classification; OPT-028 uses controlled content growth and a CDP viewport-height constraint.", "OPT-085 uses controlled CDP viewport-height, orientation, page-scale, and optional safe-area-inset proxies. It does not claim a real iOS or Android soft keyboard, physical safe area, or collapsing mobile browser chrome; CDP offsetTop physical browser-chrome movement is not emulated."], results };
    await writeFile(resolve(options.output, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8"); const failed = results.filter((item) => item.failures.length);
    for (const item of failed) console.error(`${item.route} ${item.viewport.width}x${item.viewport.height}: ${item.failures.join("; ")}`);
    if (failed.length) throw new Error(`${failed.length} public UI audit scenario(s) failed`);
    console.log(`public-ui-audit: ok (${results.length} checks, ${options.output})`);
  } finally {
    if (client) {
      await Promise.race([client.send("Browser.close").catch(() => {}), new Promise((ok) => setTimeout(ok, 2000))]);
      client.close();
    }
    let cleanupError;
    try { await stopChrome(chrome); } catch (error) { cleanupError = error; }
    await server.close();
    if (cleanupError) throw cleanupError;
  }
}

main().catch((error) => { console.error(`public-ui-audit: ${error.message}`); process.exitCode = 1; });
