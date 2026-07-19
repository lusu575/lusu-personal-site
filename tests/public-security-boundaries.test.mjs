import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { isAllowedQuickTransferFragmentUrl } from "../js/features/quick-transfer-loader.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n?/g, "\n");
const sources = Object.freeze({
  api: read("functions/api/[[route]].js"),
  account: read("js/features/account.mjs"),
  chat: read("js/routes/chatroom.mjs"),
  gameShell: read("games/game-shell.js"),
  knowledge: read("js/routes/knowledge.mjs"),
  loader: read("js/features/quick-transfer-loader.mjs"),
  main: read("js/main.js"),
  resources: read("js/routes/resources.mjs"),
  telemetry: read("js/telemetry.js"),
  transfer: read("js/transfer.js"),
  videos: read("js/routes/videos.mjs")
});

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

test("public user and external content renderers reject executable HTML sinks", () => {
  const runtimeFiles = [
    "js/main.js",
    "js/core/router.mjs",
    "js/core/route-lifecycle.mjs",
    "js/core/route-modules.mjs",
    "js/features/account.mjs",
    "js/features/quick-transfer-loader.mjs",
    "js/routes/knowledge.mjs",
    "js/routes/videos.mjs",
    "js/routes/resources.mjs",
    "js/routes/games.mjs",
    "js/routes/chatroom.mjs",
    "js/mobile-shell.js",
    "js/ui-motion.js",
    "js/transfer.js",
    "js/telemetry.js",
    "games/game-shell.js"
  ];
  const forbiddenSink = /\b(?:innerHTML|outerHTML|insertAdjacentHTML|setHTMLUnsafe|createContextualFragment)\b|document\.write\s*\(|\beval\s*\(|\bnew\s+Function\s*\(/;

  for (const file of runtimeFiles) {
    assert.doesNotMatch(read(file), forbiddenSink, `${file} must keep user/external strings on safe DOM APIs`);
  }

  assert.match(sources.chat, /name\.textContent = String\(message\.nickname \|\| ""\)/);
  assert.match(sources.chat, /bubble\.textContent = String\(message\.content \|\| ""\)/);
  assert.match(sources.account, /refs\.signedEmail\.textContent = t\("accountLoggedIn"\)/);
  assert.match(sources.knowledge, /parent\.appendChild\(document\.createTextNode\(part\)\)/);
  assert.match(sources.loader, /root\.querySelector\("script, style, link, meta, base, iframe, object, embed, svg, math"\)/);
});

test("passwords, private-room material, and drafts are not persisted, logged, historied, or tracked", () => {
  const chatPrivateEntry = between(sources.chat, "async function enterChatPrivateRoom", "async function switchChatPublicRoom");
  const chatSubmit = between(sources.chat, "async function submitChatMessage", "async function editChatNickname");
  const chatPrivateClose = between(sources.chat, "function hideChatPrivateRoomForm", "function prepareChatRoomSwitch");
  const transferJoin = between(sources.transfer, "async function joinRoom", "function leaveRoom");
  const transferComposer = between(sources.transfer, "async function sendComposer", "function refreshItems");
  const transferPersistence = between(sources.transfer, "function saveTasks", "function renderQuota");
  const accountSubmit = between(sources.account, "async function submitAccountForm", "async function logoutAccount");
  const forbiddenSideChannel = /\b(?:localStorage|sessionStorage|pushState|replaceState|lusuTrackClick)\b|console\.(?:log|info|warn|error|debug)\s*\(/;

  for (const [label, block] of [
    ["private Chat entry", chatPrivateEntry],
    ["private/public Chat submit", chatSubmit],
    ["Quick Transfer room entry", transferJoin],
    ["Quick Transfer composer", transferComposer],
    ["account submit", accountSubmit]
  ]) {
    assert.doesNotMatch(block, forbiddenSideChannel, `${label} must not copy sensitive values into side channels`);
  }

  assert.match(chatPrivateClose, /input\.value = ""/);
  assert.match(chatPrivateEntry, /deriveChatPrivateRoom\(password\)/);
  assert.match(chatSubmit, /body\.encryptedContent = await encryptChatContent\(contentText\)/);
  assert.doesNotMatch(chatSubmit, /safeStorageSet\([^\n]*(?:contentText|encryptedContent|roomKey|roomCryptoKey)/);
  assert.match(transferJoin, /deriveRoom\(password\)/);
  assert.match(transferJoin, /refs\.roomPassword\.value = ""/);
  assert.match(transferComposer, /const draft = refs\.textInput\.value/);
  assert.doesNotMatch(transferPersistence, /\b(?:password|passphrase|cryptoKey|encryptedContent|draft|textInput|roomPassword)\b/i);
  assert.doesNotMatch(sources.account, /\b(?:localStorage|sessionStorage|pushState|replaceState|lusuTrackClick)\b|console\.(?:log|info|warn|error|debug)\s*\(/);
  assert.doesNotMatch(sources.chat, /\b(?:localStorage|sessionStorage|pushState|replaceState|lusuTrackClick)\b|console\.(?:log|info|warn|error|debug)\s*\(/);
});

test("public Chat responses never fall back to the hidden server visitor id", () => {
  const hiddenFallback = /coalesce\(nullif\(client_id,\s*['"]{2}\),\s*visitor_id\)\s+as\s+visitor_id/gi;
  const safeFallback = /coalesce\(nullif\(client_id,\s*['"]{2}\),\s*['"]{2}\)\s+as\s+visitor_id/gi;
  const safeAliases = [...sources.api.matchAll(safeFallback)];

  assert.doesNotMatch(sources.api, hiddenFallback);
  assert.equal(
    safeAliases.length,
    3,
    "recent, incremental, and idempotent replay Chat queries must hide legacy server visitor ids"
  );
  assert.match(sources.api, /message:\s*\{[\s\S]{0,260}?visitor_id:\s*clientId/);
  assert.match(sources.api, /function normalizeChatEncryptedContent\(encryptedContent, plainContent\)[\s\S]{0,180}?if \(String\(plainContent \|\| ""\)\.trim\(\)\)[\s\S]{0,180}?throw new HttpError\("\u5bc6\u7801\u623f\u53ea\u63a5\u6536\u52a0\u5bc6\u6d88\u606f\u3002"/);
});

test("automatic telemetry excludes input values, drafts, secrets, and hidden identifiers", async () => {
  const requests = [];
  const documentListeners = new Map();
  const windowListeners = new Map();
  const sentinels = [
    "PRIVATE_ROOM_PASSPHRASE_97",
    "UNSENT_CHAT_DRAFT_97",
    "vis_HIDDEN_SERVER_IDENTIFIER_97",
    "203.0.113.97"
  ];

  const context = {
    URL,
    URLSearchParams,
    console,
    navigator: { language: "en-US" },
    fetch(url, options = {}) {
      requests.push({ url: String(url), body: options.body ? JSON.parse(options.body) : null });
      return Promise.resolve({ ok: true });
    },
    window: {
      innerWidth: 390,
      innerHeight: 844,
      location: {
        origin: "https://example.test",
        protocol: "https:",
        host: "example.test",
        pathname: "/",
        search: "?lang=en",
        hash: "#chatroom"
      },
      history: { pushState() {}, replaceState() {} },
      setTimeout(callback) { callback(); },
      addEventListener(name, handler) { windowListeners.set(name, handler); }
    },
    document: {
      documentElement: { lang: "en" },
      referrer: "",
      title: "LuSu",
      hidden: false,
      addEventListener(name, handler) { documentListeners.set(name, handler); }
    }
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.navigator = context.navigator;

  runInNewContext(sources.telemetry, context, { filename: "js/telemetry.js" });
  await Promise.resolve();
  await Promise.resolve();

  const click = documentListeners.get("click");
  assert.equal(typeof click, "function");
  const fakeSensitiveInput = {
    tagName: "INPUT",
    id: "chat-private-password",
    classList: ["chat-private-password"],
    dataset: {},
    value: sentinels.join(" "),
    innerText: sentinels[1],
    textContent: sentinels[2],
    title: sentinels[3],
    closest() { return this; },
    getAttribute(name) {
      return {
        href: "",
        "data-analytics-label": "chat:private-room-field",
        "data-telemetry-label": "",
        "aria-label": sentinels[0]
      }[name] || "";
    }
  };
  click({ target: fakeSensitiveInput, clientX: 20, clientY: 30 });
  await Promise.resolve();

  const clickPayload = requests.find((request) => request.url.endsWith("/click"))?.body;
  assert.ok(clickPayload, "the smoke must observe the existing automatic click payload");
  const serialized = JSON.stringify(clickPayload);
  for (const sentinel of sentinels) {
    assert.doesNotMatch(serialized, new RegExp(sentinel));
  }
  assert.equal(Object.hasOwn(clickPayload, "value"), false);
  assert.equal(Object.hasOwn(clickPayload, "visitorId"), false);
  assert.equal(Object.hasOwn(clickPayload, "ip"), false);

  const descriptor = between(sources.telemetry, "function targetDescriptor", "let lastPath");
  assert.doesNotMatch(descriptor, /element\.(?:value|innerText|textContent|title)\b|getAttribute\(["']aria-label["']\)/);
});

test("external links, media, fragments, and iframes retain narrow allowlists", () => {
  assert.match(sources.main, /const trustedResourceExternalHosts = new Set\(\["github\.com", "www\.github\.com", "raw\.githubusercontent\.com", "gist\.github\.com"\]\)/);
  assert.match(sources.main, /const trustedGameExternalHosts = new Set\(\["github\.com", "www\.github\.com", "github\.io"\]\)/);
  assert.match(sources.main, /return url\.protocol === "https:" && hostMatches\(url\.hostname, allowedHosts\) \? url\.href : ""/);
  assert.match(sources.resources, /safeTrustedExternalUrl\(value, trustedResourceExternalHosts\)/);
  assert.match(sources.gameShell, /url\.protocol !== "https:" \|\| !\["github\.com", "www\.github\.com"\]\.includes/);
  assert.ok(sources.gameShell.includes("!/^source\\/[a-z0-9][a-z0-9._/-]*\\.html$/i.test(entry)"));

  assert.match(sources.videos, /const isYoutube = host === "youtube\.com" && parsed\.pathname\.startsWith\("\/embed\/"\)/);
  assert.match(sources.videos, /const isBilibili = host === "player\.bilibili\.com" && parsed\.pathname === "\/player\.html"/);
  for (const host of ["i.ytimg.com", "img.youtube.com", "i0.hdslb.com", "i1.hdslb.com", "i2.hdslb.com", "archive.biliimg.com"]) {
    assert.match(sources.videos, new RegExp(`"${host.replaceAll(".", "\\.")}"`));
  }
  assert.match(sources.api, /if \(url\.protocol !== "https:"\)[\s\S]{0,120}?\u89c6\u9891\u94fe\u63a5\u5fc5\u987b\u4f7f\u7528 https/);
  assert.match(sources.api, /\u53ea\u652f\u6301 youtube\.com\u3001youtu\.be\u3001bilibili\.com\u3001b23\.tv \u89c6\u9891\u94fe\u63a5/);

  assert.match(sources.loader, /const FRAGMENT_CANONICAL_PATH = "\/fragments\/quick-transfer"/);
  assert.match(sources.loader, /responseUrl\.origin === pageUrl\.origin[\s\S]{0,100}?ALLOWED_FRAGMENT_PATHS\.includes\(responseUrl\.pathname\)/);
  assert.doesNotMatch(sources.loader, /responseUrl\.pathname\.startsWith/);
  const pageHref = "https://lusu575.com/resources";
  for (const value of [
    "https://evil.example/fragments/quick-transfer.html",
    "https://lusu575.com/fragments/quick-transfer.html.evil",
    "https://lusu575.com/fragments/quick-transfer-extra",
    "https://lusu575.com/fragments/%2fquick-transfer",
    "not a valid absolute or local URL"
  ]) {
    assert.equal(isAllowedQuickTransferFragmentUrl(value, pageHref), false, value);
  }
  assert.match(sources.loader, /for \(const attribute of element\.attributes\)[\s\S]{0,220}?\/\^on\/i\.test\(attribute\.name\)/);
});
