import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const mobileShell = readFileSync(new URL("js/mobile-shell.js", root), "utf8");
const mobileCss = readFileSync(new URL("css/mobile-ios-shell.css", root), "utf8");

test("the head applies only supported document languages before the public shell loads", () => {
  const bootstrapEnd = html.indexOf('<script src="/js/mobile-shell.js');
  const bootstrap = html.slice(0, bootstrapEnd);
  assert.match(bootstrap, /const requestedLanguage = searchParams\.get\("lang"\)/);
  assert.match(bootstrap, /zh:\s*"zh-CN"[\s\S]*en:\s*"en"[\s\S]*ja:\s*"ja"/);
  assert.match(bootstrap, /const documentLanguage = \{[\s\S]*\}\[requestedLanguage\]/);
  assert.match(bootstrap, /if \(documentLanguage\) \{\s*document\.documentElement\.lang = documentLanguage/);
  assert.doesNotMatch(bootstrap, /document\.documentElement\.lang\s*=\s*requestedLanguage/);
});

test("the mobile language cycle exposes its current and next language in all three languages", () => {
  const button = html.match(/<button class="mobile-language-cycle"[^>]*>[\s\S]*?<\/button>/)?.[0] || "";
  assert.match(button, /aria-label="当前语言：中文。切换到 English。"/);
  assert.match(button, /title="当前语言：中文。切换到 English。"/);
  assert.match(button, /data-mobile-language-label>中文</);
  assert.doesNotMatch(button, /data-i18n-aria-label=/);
  for (const token of [
    'visible: "中文"',
    'accessible: "当前语言：中文。切换到 English。"',
    'visible: "English"',
    'accessible: "Current language: English. Switch to 日本語."',
    'visible: "日本語"',
    'accessible: "現在の言語：日本語。中文に切り替えます。"'
  ]) {
    assert.ok(mobileShell.includes(token), `mobile language copy should include ${token}`);
  }
  assert.match(mobileShell, /button\.dataset\.currentLanguage = lang/);
  assert.match(mobileShell, /button\.setAttribute\("aria-label", copy\.accessible\)/);
  assert.match(mobileShell, /button\.setAttribute\("title", copy\.accessible\)/);
});

test("shell dates and Chat controls expose machine-readable and described state", () => {
  assert.match(html, /<time id="top-updated" datetime="2026-07-26">2026\.07\.26<\/time>/);
  const privatePassword = html.match(/<input id="chat-private-password"[^>]*>/)?.[0] || "";
  assert.match(privatePassword, /aria-describedby="chat-private-room-hint"/);
  assert.match(privatePassword, /aria-errormessage="chat-private-password-error"/);
  assert.match(html, /id="chat-private-room-submit"[^>]*type="submit"[^>]*data-i18n="chatPrivateRoomEnter"/);
  assert.match(html, /<small id="chat-private-room-hint"[^>]*data-i18n="chatPrivateRoomHint"/);
  assert.match(html, /<small id="chat-private-password-error" role="alert" hidden><\/small>/);
  const composer = html.match(/<textarea id="chat-message-input"[^>]*>/)?.[0] || "";
  assert.match(composer, /maxlength="300"/);
  assert.match(composer, /aria-describedby="chat-char-count-status"/);
  assert.match(html, /class="chatroom-counter" id="chat-char-count-status"><span id="chat-char-count">0<\/span>\/300/);
  assert.match(html, /id="chat-retry-button"[^>]*data-i18n="chatRetry"[^>]*hidden/);
});

test("collapsed Dock and nested horizontal controls do not leave duplicate keyboard stops", () => {
  assert.match(mobileShell, /function syncDockAccessibility\(\)/);
  assert.match(mobileShell, /scroller\.inert = collapsed/);
  assert.match(mobileShell, /scroller\.setAttribute\("aria-hidden", String\(collapsed\)\)/);
  assert.match(mobileShell, /collapsed && scroller\.contains\(document\.activeElement\)/);
  assert.match(mobileShell, /const ownsInteractiveChildren = Boolean\(node\.querySelector/);
  assert.match(mobileShell, /!ownsInteractiveChildren && !node\.hasAttribute\("tabindex"\)/);
  assert.match(mobileCss, /body\[data-mobile-dock="collapsed"\] \.mobile-dock-scroll\s*\{[^}]*visibility:\s*hidden/);
});
