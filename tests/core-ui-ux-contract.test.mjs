import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = (path) => readFileSync(resolve(root, path), "utf8");
const indexHtml = source("index.html");
const mainJs = source("js/main.js");
const mobileShellJs = source("js/mobile-shell.js");
const styleCss = source("css/style.css");
const mobileCss = source("css/mobile-ios-shell.css");
const motionCss = source("css/motion-system.css");
const workflow = source(".github/workflows/verify.yml");
const gamePages = ["2048", "a-dark-room", "hextris", "kittens-game", "life-restart"]
  .map((slug) => source(`games/${slug}/index.html`));
const japaneseToolHtml = source("tools/japanese-subtext/index.html");

test("account flow has explicit modes, one primary submit, field errors, and focus management", () => {
  assert.match(mainJs, /dataset\.accountModeChoice = "login"/);
  assert.match(mainJs, /dataset\.accountModeChoice = "register"/);
  assert.match(mainJs, /dataset\.accountSubmit = ""/);
  assert.match(mainJs, /function showAccountFormError[\s\S]*aria-invalid[\s\S]*\.focus/);
  assert.match(mainJs, /function openAccountPopover[\s\S]*requestAnimationFrame[\s\S]*querySelector\("input:not\(\[disabled\]\)"\)/);
  assert.match(mainJs, /if \(!accountSubmitting\) \{\s*renderAccountWidget\(\)/);
  assert.match(mainJs, /submit\.textContent = accountSubmitting \? t\("accountSubmitting"\) : submit\.dataset\.idleLabel/);
  assert.match(styleCss, /\.account-mode-button\[aria-pressed="true"\]/);
});

test("account, article, and private-room async work cannot overwrite newer intent", () => {
  const accountInit = mainJs.slice(mainJs.indexOf("async function initAccountWidget"), mainJs.indexOf("async function submitAccountForm"));
  const logout = mainJs.slice(mainJs.indexOf("async function logoutAccount"), mainJs.indexOf("function setAccountSubmitting"));
  const articleDetail = mainJs.slice(mainJs.indexOf("async function loadArticleDetail"), mainJs.indexOf("function renderArticleDetailFailure"));
  const privateRoom = mainJs.slice(mainJs.indexOf("function showChatPrivateRoomForm"), mainJs.indexOf("async function handleChatRoomToggle"));

  assert.match(mainJs, /let authRevision = 0/);
  assert.match(accountInit, /const revision = authRevision[\s\S]*if \(revision !== authRevision\) return;[\s\S]*authUser = payload\.user/);
  assert.match(logout, /await accountApi\("\/api\/auth\/logout"[\s\S]*authUser = null/);
  assert.match(logout, /catch \{[\s\S]*renderAccountWidget\(t\("accountLogoutFailed"\)\)[\s\S]*openAccountPopover\(\)/);
  assert.match(articleDetail, /articleState\.detailRequestId = requestId[\s\S]*const requestedLang = currentLang[\s\S]*detailCache\.get/);
  assert.match(articleDetail, /currentLang !== requestedLang/);
  assert.match(mainJs, /roomSwitchEpoch: 0/);
  assert.match(privateRoom, /chatState\.roomSwitchEpoch = attemptId[\s\S]*attemptId !== chatState\.roomSwitchEpoch/);
  assert.match(privateRoom, /hideChatPrivateRoomForm\(\{ preserveAttempt: true \}\)/);
  assert.match(privateRoom, /setChatPrivateRoomBusy\(true\)/);
});

test("mobile App bar exposes account access, full titles, dock edges, keyboard focus, and low-cost mode", () => {
  assert.match(mobileCss, /body:not\(\[data-route="home"\]\) \.topbar-actions \{[\s\S]*display: flex[\s\S]*width: 44px/);
  assert.match(mobileShellJs, /routeTitle\.title = title/);
  assert.match(mobileShellJs, /function syncDockEdges[\s\S]*data-can-scroll-start[\s\S]*data-can-scroll-end/);
  assert.match(mobileShellJs, /function keepFocusedControlVisible[\s\S]*visualViewport[\s\S]*scrollIntoView/);
  assert.match(mobileShellJs, /function syncPerformanceMode[\s\S]*saveData[\s\S]*deviceMemory/);
  assert.match(motionCss, /html\[data-performance="low"\] \.wallpaper-cloud/);
});

test("article and video recovery paths stay keyboard reachable", () => {
  assert.match(indexHtml, /id="article-detail-title" tabindex="-1"/);
  assert.match(indexHtml, /id="article-copy-manual"[^>]*readonly[^>]*hidden/);
  assert.match(mainJs, /function scrollArticleToTop[\s\S]*article-detail-title[\s\S]*focus/);
  assert.match(mainJs, /function copyArticleLink[\s\S]*manualField\.select\(\)/);
  assert.match(styleCss, /\.markdown-body \{[\s\S]*width: min\(100%, 78ch\)/);
  assert.match(indexHtml, /id="video-retry"[^>]*data-video-player-retry/);
  assert.match(mainJs, /function renderVideoPlayerError[\s\S]*retryButton\.hidden = false/);
  assert.match(mainJs, /iframe\.addEventListener\("load"[\s\S]*aria-busy/);
  assert.match(mainJs, /iframe\.addEventListener\("error"[\s\S]*!iframe\.isConnected \|\| videoWindowState\.currentVideo !== video/);
});

test("chat preserves room context, drafts, reading position, and explicit recovery actions", () => {
  assert.match(mainJs, /drafts: new Map\(\)/);
  assert.match(mainJs, /sendContext = \{[\s\S]*revision: chatState\.roomRevision[\s\S]*roomCryptoKey/);
  assert.match(mainJs, /sendContext\.revision !== chatState\.roomRevision/);
  assert.match(mainJs, /input\.readOnly = sending/);
  assert.match(mainJs, /function chatListIsNearBottom[\s\S]*<= 72/);
  assert.match(mainJs, /chatState\.unreadCount \+= appendedCount/);
  assert.match(mainJs, /catch \{\s*if \(roomRevision !== chatState\.roomRevision\) \{\s*return 0/);
  assert.match(mainJs, /function scheduleChatPolling[\s\S]*const roomRevision = chatState\.roomRevision[\s\S]*roomRevision !== chatState\.roomRevision/);
  assert.match(mainJs, /navigator\.onLine === false[\s\S]*chatOfflineStatus/);
  assert.match(indexHtml, /id="chat-jump-latest"[^>]*hidden/);
  assert.match(indexHtml, /id="chat-retry"[^>]*hidden/);
  assert.match(mainJs, /event\.ctrlKey \|\| event\.metaKey/);
});

test("preview cache, branch CI, and responsive guards cover the optimization build", () => {
  const version = "20260717-100-ui-ux-preview-r2";
  for (const asset of [
    "/js/mobile-shell.js",
    "/css/style.css",
    "/css/mobile-ios-shell.css",
    "/css/motion-system.css",
    "/css/transfer.css",
    "/js/transfer.js",
    "/js/main.js"
  ]) {
    assert.ok(indexHtml.includes(`${asset}?v=${version}`), `${asset} should use the preview cache key`);
  }
  assert.match(styleCss, /@media \(pointer: coarse\)/);
  assert.match(mobileCss, /@media \(max-width: 380px\)/);
  assert.match(mobileCss, /orientation: landscape/);
  assert.match(mobileCss, /orientation: landscape[\s\S]*article-read-progress \{[\s\S]*right: 60px/);
  assert.match(mobileCss, /orientation: landscape[\s\S]*chat-send-shortcut \{\s*display: none/);
  assert.match(motionCss, /prefers-reduced-motion: reduce/);
  for (const html of gamePages) {
    assert.match(html, /game-shell\.css\?v=20260717-100-ui-ux-preview-r2/);
    assert.match(html, /game-shell\.js\?v=20260717-100-ui-ux-preview-r2/);
  }
  assert.match(japaneseToolHtml, /style\.css\?v=20260717-100-ui-ux-preview-r2/);
  assert.match(japaneseToolHtml, /app\.mjs\?v=20260717-100-ui-ux-preview-r2/);
});
