import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isAllowedQuickTransferFragmentUrl } from "../../js/features/quick-transfer-loader.mjs";

const root = new URL("../../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const fragment = readFileSync(new URL("fragments/quick-transfer.html", root), "utf8");
const client = readFileSync(new URL("js/transfer.js", root), "utf8");
const loader = readFileSync(new URL("js/features/quick-transfer-loader.mjs", root), "utf8");
const resourcesRoute = readFileSync(new URL("js/routes/resources.mjs", root), "utf8");
const styles = readFileSync(new URL("css/transfer.css", root), "utf8");
const publicStyles = readFileSync(new URL("css/style.css", root), "utf8");

test("Quick Transfer stages selected, dropped, and pasted files until Send", () => {
  assert.match(fragment, /id="transfer-pending-attachments"/);
  assert.match(fragment, /id="transfer-send-button"/);
  assert.match(client, /listen\(refs\.photoInput, "change", \(event\) => stageFiles\(event\.target\.files\)\)/);
  assert.match(client, /listen\(refs\.fileInput, "change", \(event\) => stageFiles\(event\.target\.files\)\)/);
  assert.match(client, /function handleWindowDrop[\s\S]*stageFiles\(files\)/);
  assert.match(client, /clipboardData\?\.files\?\.length\) stageFiles\(event\.clipboardData\.files\)/);
  assert.match(client, /function stageFiles[\s\S]*state\.pendingFiles\.set/);
  assert.match(client, /function sendComposer[\s\S]*await api\("\/api\/transfer\/text"[\s\S]*takePendingFiles\(pending\.map[\s\S]*queueFiles\(files, context\)/);
});

test("Quick Transfer exposes a gallery picker without forcing camera capture", () => {
  const photoInput = fragment.match(/<input id="transfer-photo-input"[^>]*>/)?.[0] || "";
  assert.match(photoInput, /type="file"/);
  assert.match(photoInput, /accept="image\/\*"/);
  assert.match(photoInput, /\bmultiple\b/);
  assert.doesNotMatch(photoInput, /\bcapture(?:=|\s|>)/i);
  assert.match(fragment, /id="transfer-file-input" type="file" multiple/);
});

test("Quick Transfer has no eager CSS, client, fragment DOM, or API request", () => {
  assert.doesNotMatch(html, /(?:href|src)="\/(?:css\/transfer\.css|js\/transfer\.js|fragments\/quick-transfer\.html)/);
  assert.doesNotMatch(html, /id="transfer-app"/);
  assert.doesNotMatch(loader, /\/api\/transfer\//);
  assert.match(resourcesRoute, /import\("\.\.\/features\/quick-transfer-loader\.mjs\?v=[a-z0-9-]+"\)/);
  assert.doesNotMatch(resourcesRoute, /window\.QuickTransfer\s*=/);
});

test("Quick Transfer first click shows an XP status and single-flights fixed local assets", () => {
  assert.match(loader, /async function open\(\)[\s\S]*const alreadyReady = phase === "ready" && implementation && fragmentRoot;[\s\S]*if \(!alreadyReady\) renderStatus\("loading"\)[\s\S]*await ensureLoaded\(\)/);
  assert.match(loader, /className = `loading-text route-module-status transfer-loader-status is-\$\{kind\}`/);
  assert.match(loader, /if \(loadPromise\) return loadPromise/);
  assert.match(loader, /Promise\.all\(\[ensureStylesheet\(\), ensureFragment\(\), ensureScript\(\)\]\)/);
  assert.match(loader, /const FRAGMENT_PATH = "\/fragments\/quick-transfer\.html"/);
  assert.match(loader, /const STYLESHEET_URL = `\/css\/transfer\.css\?v=\$\{TRANSFER_VERSION\}`/);
  assert.match(loader, /const SCRIPT_URL = `\/js\/transfer\.js\?v=\$\{TRANSFER_VERSION\}`/);
  assert.match(loader, /if \(!initialized\)[\s\S]*implementation\.init\(language\)[\s\S]*initialized = true/);
});

test("Quick Transfer strictly validates its static fragment before mounting", () => {
  assert.match(loader, /new DOMParser\(\)\.parseFromString\(source, "text\/html"\)/);
  assert.match(loader, /if \(!isAllowedQuickTransferFragmentUrl\(response\.url \|\| FRAGMENT_URL, window\.location\.href\)\)/);
  assert.match(loader, /root\.querySelector\("script, style, link, meta, base, iframe, object, embed, svg, math"\)/);
  assert.match(loader, /\^\(\?:src\|srcdoc\|href\|action\|formaction\|xlink:href\)\$/);
  assert.match(loader, /JSON\.stringify\(\[\.\.\.ids\]\.sort\(\)\) !== JSON\.stringify\(EXPECTED_IDS\)/);
  assert.match(loader, /document\.importNode\(fragmentRoot, true\)/);
});

test("Quick Transfer accepts both same-origin fragment spellings and rejects lookalike URLs", () => {
  const pageHref = "https://lusu575.com/?lang=zh";
  for (const value of [
    "/fragments/quick-transfer.html?v=asset",
    "/fragments/quick-transfer?v=asset",
    "https://lusu575.com/fragments/quick-transfer.html?v=asset",
    "https://lusu575.com/fragments/quick-transfer?v=asset"
  ]) {
    assert.equal(isAllowedQuickTransferFragmentUrl(value, pageHref), true, value);
  }
  for (const value of [
    "https://cdn.lusu575.com/fragments/quick-transfer.html",
    "https://lusu575.com/fragments/quick-transfer/",
    "https://lusu575.com/fragments/quick-transfer.html/extra",
    "https://lusu575.com/fragments/quick-transfer-backup",
    "https://lusu575.com/other/quick-transfer"
  ]) {
    assert.equal(isAllowedQuickTransferFragmentUrl(value, pageHref), false, value);
  }
});

test("Quick Transfer load failure is retryable and route-leave races never initialize", () => {
  assert.match(loader, /retry\.addEventListener\("click", \(\) => \{ void open\(\); \}, \{ once: true \}\)/);
  assert.match(loader, /await ensureLoaded\(\);[\s\S]*if \(!routeActive\)[\s\S]*return false;[\s\S]*mountFragment\(\)/);
  assert.match(loader, /function routeLeave\(\)[\s\S]*routeActive = false;[\s\S]*clearStatus\(\{ restoreContent: true \}\)[\s\S]*implementation\?\.routeLeave/);
  assert.match(loader, /stylesheetPromise = null/);
  assert.match(loader, /fragmentPromise = null/);
  assert.match(loader, /scriptPromise = null/);
});

test("Quick Transfer keeps mobile media stable, aligned, and clear of the composer", () => {
  const landscapeStart = styles.indexOf('@media (min-width: 700px) and (max-height: 560px) and (orientation: landscape)');
  const landscapeEnd = styles.indexOf('@media (prefers-reduced-motion: reduce)', landscapeStart);
  const landscapeStyles = landscapeStart >= 0 && landscapeEnd > landscapeStart
    ? styles.slice(landscapeStart, landscapeEnd)
    : "";
  const mobileRoomRule = styles.match(/html\[data-ui-shell="mobile"\] \.transfer-room\s*\{([^}]*)\}/)?.[1] || "";
  const mobileRoomChildrenRule = styles.match(/html\[data-ui-shell="mobile"\] \.transfer-room > \.transfer-room-toolbar,\s*html\[data-ui-shell="mobile"\] \.transfer-room > \.transfer-feed,\s*html\[data-ui-shell="mobile"\] \.transfer-room > \.transfer-compose,\s*html\[data-ui-shell="mobile"\] \.transfer-room > \.transfer-tasks\s*\{([^}]*)\}/)?.[1] || "";
  const landscapeRoomRule = landscapeStyles.match(/html\[data-ui-shell="mobile"\] \.transfer-room\s*\{([^}]*)\}/)?.[1] || "";
  assert.match(client, /className = "transfer-media-preview transfer-image-preview"/);
  assert.match(client, /className = "transfer-file-card"/);
  assert.match(client, /download\.download = item\.filename/);
  assert.match(client, /className = "xp-button transfer-copy-text-button"/);
  assert.equal(client.match(/copyText:/g)?.length, 3);
  assert.match(mobileRoomRule, /display:\s*flex/);
  assert.match(mobileRoomRule, /flex-direction:\s*column/);
  assert.match(mobileRoomRule, /align-items:\s*stretch/);
  assert.doesNotMatch(mobileRoomRule, /grid-template-rows/);
  assert.match(mobileRoomChildrenRule, /flex:\s*0 0 auto/);
  assert.match(landscapeRoomRule, /display:\s*grid/);
  assert.match(landscapeRoomRule, /grid-template-columns:\s*minmax\(0, 1\.35fr\) minmax\(270px, \.9fr\)/);
  assert.match(landscapeRoomRule, /grid-template-rows:\s*auto auto auto/);
  assert.match(styles, /\.transfer-media-preview\s*\{[\s\S]*width:\s*min\(100%, 320px\)[\s\S]*max-height:\s*220px/);
  assert.match(styles, /html\[data-ui-shell="mobile"\] \.transfer-compose\s*\{[\s\S]*position:\s*static[\s\S]*z-index:\s*auto[\s\S]*bottom:\s*auto/);
  assert.match(styles, /html\[data-ui-shell="mobile"\] \.transfer-media-preview\s*\{[\s\S]*width:\s*100%[\s\S]*height:\s*clamp\(190px, 58vw, 240px\)[\s\S]*box-sizing:\s*border-box[\s\S]*justify-self:\s*stretch/);
  assert.match(styles, /html\[data-ui-shell="mobile"\] \.transfer-media-preview img\s*\{[\s\S]*height:\s*100%[\s\S]*object-fit:\s*contain/);
  assert.match(styles, /html\[data-ui-shell="mobile"\] \.transfer-file-card\s*\{[\s\S]*width:\s*100%[\s\S]*max-width:\s*none/);
  assert.equal(styles.match(/var\(--mobile-safe-bottom, env\(safe-area-inset-bottom\)\)/g)?.length, 6);
  assert.doesNotMatch(styles, /data-keyboard|keyboard-visible|xp-taskbar/);
});

test("Quick Transfer uses explicit compact and full desktop window modes", () => {
  const windowMode = client.slice(client.indexOf("function syncTransferWindowMode"), client.indexOf("async function open"));
  assert.match(windowMode, /is-transfer-login-mode/);
  assert.match(windowMode, /is-transfer-room-entry-mode/);
  assert.match(windowMode, /is-transfer-room-mode/);
  assert.match(client, /refs\.app\.hidden = false;\s*syncTransferWindowMode\(\)/);
  assert.match(client, /refs\.app\.hidden = true;\s*syncTransferWindowMode\(\)/);
  assert.match(client, /refs\.roomEntry\.hidden = true;\s*refs\.room\.hidden = false;\s*syncTransferWindowMode\(\)/);
  assert.match(client, /refs\.room\.hidden = true;\s*refs\.roomEntry\.hidden = false;\s*syncTransferWindowMode\(\)/);
  assert.match(styles, /\.xp-window:is\(\.is-transfer-login-mode, \.is-transfer-room-entry-mode\)\s*\{[\s\S]*?height:\s*auto/);
  assert.match(styles, /\.xp-window\.is-transfer-room-mode\s*\{[\s\S]*?height:\s*calc\(100dvh - var\(--chrome-window-compact-reserve\)\)/);
  assert.match(styles, /html\[data-ui-shell="mobile"\] \.transfer-app-heading \.transfer-icon \{ display: none; \}/);
  assert.doesNotMatch(styles, /@media \(max-width: \d+px\)\s*\{\s*html\[data-ui-shell="mobile"\] \.transfer-app-heading \.transfer-icon \{ display: none; \}/);
});

test("Resources launcher icon frames share one 42px geometry token", () => {
  assert.match(publicStyles, /#resource-list\s*\{\s*--resource-icon-frame-size:\s*42px/);
  assert.match(publicStyles, /\.resource-icon-image\s*\{[\s\S]*?width:\s*var\(--resource-icon-frame-size, 42px\)[\s\S]*?height:\s*var\(--resource-icon-frame-size, 42px\)/);
  assert.match(publicStyles, /\.resource-icon\.transfer-icon\s*\{\s*--transfer-icon-size:\s*var\(--resource-icon-frame-size, 42px\)/);
});

test("Quick Transfer binds text submission to an immutable room context", () => {
  const composer = client.slice(client.indexOf("async function sendComposer"), client.indexOf("async function refreshItems"));
  assert.match(composer, /const context = captureRoomContext\(\)/);
  assert.match(composer, /encryptText\(value, context\.cryptoKey\)/);
  assert.match(composer, /json: \{ roomKey: context\.roomKey, encryptedContent, idempotencyKey \}/);
  assert.match(composer, /if \(!isRoomContextCurrent\(context\)\) return/);
  assert.match(composer, /const draft = refs\.textInput\.value[\s\S]*if \(refs\.textInput\.value === draft\) refs\.textInput\.value = ""/);
  assert.match(client, /async function encryptText\(value, cryptoKey\)[\s\S]*subtle\.encrypt\([^\n]*cryptoKey/);
  assert.match(client, /roomGeneration: 0[\s\S]*composerToken: null/);
});

test("Quick Transfer upload tasks keep their captured room and are cleared on context exit", () => {
  const uploads = client.slice(client.indexOf("function queueFiles"), client.indexOf("function renderTasks"));
  assert.match(uploads, /roomKey: context\.roomKey, roomGeneration: context\.generation/);
  assert.match(uploads, /upload\/simple\?room=\$\{encodeURIComponent\(task\.roomKey\)\}/);
  assert.match(uploads, /json: \{ roomKey: task\.roomKey, filename:/);
  assert.match(uploads, /upload\/status\?session=.*encodeURIComponent\(task\.roomKey\)/);
  assert.match(uploads, /upload\/part\?session=.*encodeURIComponent\(task\.roomKey\)/);
  assert.match(uploads, /upload\/complete".*, \{ method: "POST", json: \{ roomKey: task\.roomKey/);
  assert.doesNotMatch(uploads, /state\.roomKey/);
  assert.match(client, /function cancelAndClearUploadTasks[\s\S]*abortTaskTransport\(task\)[\s\S]*abortMultipartSession\(task\.roomKey, task\.sessionId\)[\s\S]*state\.tasks\.clear\(\)/);
  assert.match(client, /function invalidateRoomContext[\s\S]*cancelAndClearUploadTasks\(\{ preserveResumable: true \}\)/);
  assert.match(client, /function close\(options = \{\}\)[\s\S]*invalidateRoomContext\(\)/);
  assert.match(client, /function leaveRoom\(\)[\s\S]*invalidateRoomContext\(\)/);
  assert.match(client, /localId: task\.localId, roomKey: task\.roomKey/);
});

test("Quick Transfer uses cursor deltas and keyed feed nodes without full redraws", () => {
  const refresh = client.slice(client.indexOf("function refreshItems"), client.indexOf("function itemNode"));
  assert.match(refresh, /state\.refreshPromise/);
  assert.match(refresh, /&cursor=\$\{encodeURIComponent\(cursor\)\}/);
  assert.match(refresh, /payload\.resetRequired[\s\S]*resetItemSync\(\)/);
  assert.match(refresh, /state\.itemData\.set\(item\.id, item\)/);
  assert.match(refresh, /state\.itemNodes\.get\(item\.id\)/);
  assert.doesNotMatch(refresh, /feed\.replaceChildren/);
  assert.match(refresh, /nearBottom[\s\S]*scrollTop = refs\.feed\.scrollHeight/);
});

test("Quick Transfer relocalizes every keyed feed affordance without rebuilding media", () => {
  const language = client.slice(client.indexOf("function setLanguage"), client.indexOf("async function open"));
  const render = client.slice(client.indexOf("function renderItems"), client.indexOf("function itemNode"));
  const update = client.slice(client.indexOf("function updateItemNode"), client.indexOf("async function deleteItem"));
  assert.match(language, /state\.lang = [\s\S]*renderItems\(\)/);
  assert.match(render, /state\.itemNodes\.get\(item\.id\)[\s\S]*updateItemNode\(node, item\)[\s\S]*refs\.feed\.append\(node\)/);
  assert.doesNotMatch(render, /feed\.replaceChildren|itemNode\(item\).*options\.force/);
  assert.match(update, /transfer-uploader[\s\S]*unknownUploader/);
  assert.match(update, /transfer-created-at[\s\S]*Intl\.DateTimeFormat\(state\.lang/);
  assert.match(update, /transfer-expiry[\s\S]*text\("expires"/);
  assert.match(update, /transfer-text-content[\s\S]*decrypting[\s\S]*decryptFailed/);
  assert.match(update, /transfer-copy-text-button[\s\S]*text\("copyText"\)[\s\S]*aria-label/);
  assert.match(update, /transfer-unsafe-notice[\s\S]*text\("unsafeNotice"\)/);
  assert.match(update, /transfer-download-button[\s\S]*text\("download"\)[\s\S]*aria-label/);
  assert.match(update, /transfer-delete-button[\s\S]*aria-label[\s\S]*text\("delete"\)/);
  assert.match(update, /querySelector\("img, video, audio"\)/);
  assert.doesNotMatch(update, /media\.replaceChildren|media\.remove\(|createElement\("(?:img|video|audio)"\)/);
});

test("Quick Transfer refresh single-flight is scoped to room and generation", () => {
  const refresh = client.slice(client.indexOf("function refreshItems"), client.indexOf("async function performItemRefresh"));
  const abort = client.slice(client.indexOf("function abortRefresh"), client.indexOf("function resetItemSync"));
  assert.match(client, /refreshPromise: null, refreshController: null, refreshContextKey: ""/);
  assert.match(refresh, /const refreshContextKey = `\$\{requestedRoom\.generation\}:\$\{requestedRoom\.roomKey\}`/);
  assert.match(refresh, /state\.refreshPromise && state\.refreshContextKey === refreshContextKey[\s\S]*return state\.refreshPromise/);
  assert.match(refresh, /if \(state\.refreshPromise\) abortRefresh\(\)[\s\S]*state\.refreshContextKey = refreshContextKey/);
  assert.match(refresh, /const refreshPromise = performItemRefresh[\s\S]*state\.refreshPromise !== refreshPromise[\s\S]*state\.refreshPromise = null[\s\S]*state\.refreshContextKey = ""/);
  assert.match(refresh, /state\.refreshPromise = refreshPromise[\s\S]*return refreshPromise/);
  assert.match(abort, /const controller = state\.refreshController[\s\S]*state\.refreshPromise = null[\s\S]*state\.refreshContextKey = ""[\s\S]*controller\?\.abort\(\)/);
  assert.match(client, /function invalidateRoomContext[\s\S]*state\.roomGeneration \+= 1;[\s\S]*abortRefresh\(\)/);
});

test("Quick Transfer throttles progress and updates only keyed task rows", () => {
  const tasks = client.slice(client.indexOf("function queueFiles"), client.indexOf("function saveTasks"));
  assert.match(tasks, /idempotencyKey: crypto\.randomUUID\(\)/);
  assert.match(tasks, /maximumActiveTasks = state\.config\?\.user\?\.isAdmin \? \(isMobile \? 1 : 2\) : 1/);
  assert.match(tasks, /scheduleTaskProgressRender\(task\)/);
  assert.match(tasks, /state\.taskRenderFrame = window\.requestAnimationFrame/);
  assert.match(tasks, /updateTaskProgress\(current\)/);
  assert.match(tasks, /data-transfer-task-id/);
  assert.doesNotMatch(tasks, /taskList\.replaceChildren/);
});

test("Quick Transfer sends idempotency keys and preserves retryable task identity", () => {
  assert.match(client, /composerRetry\?\.generation[\s\S]*idempotencyKey/);
  assert.match(client, /xhr\.setRequestHeader\("Idempotency-Key", task\.idempotencyKey\)/);
  assert.match(client, /sizeBytes: task\.size, idempotencyKey: task\.idempotencyKey/);
  assert.match(client, /\["paused", "failed"\][\s\S]*resumeTask\(task\)/);
  assert.match(client, /idempotencyKey: task\.idempotencyKey/);
});

test("Quick Transfer batches live summaries and fully clears transient resources", () => {
  assert.match(fragment, /id="transfer-live-summary" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(fragment, /id="transfer-feed" role="log" aria-live="off"/);
  assert.doesNotMatch(fragment, /id="transfer-quota-card"[^>]*aria-live/);
  assert.match(client, /function notifyLive[\s\S]*state\.liveQueue\.push[\s\S]*setTimeout/);
  assert.match(client, /function invalidateRoomContext[\s\S]*abortRefresh\(\)[\s\S]*clearTaskRenderFrame\(\)[\s\S]*clearLiveAnnouncements\(\)/);
  assert.match(client, /function clearPendingFiles[\s\S]*URL\.revokeObjectURL/);
  assert.match(client, /function handleVisibilityChange[\s\S]*abortRequests\(\)[\s\S]*clearDelays\(\)[\s\S]*suspendUploadsForVisibility/);
});

test("Quick Transfer binds and tears down route-scoped resources", () => {
  assert.match(client, /eventController: null[\s\S]*requestControllers: new Set\(\)[\s\S]*delayJobs: new Map\(\)/);
  assert.match(client, /function bindEvents\(\)[\s\S]*state\.eventController = new AbortController\(\)/);
  assert.match(client, /function unbindEvents\(\)[\s\S]*state\.eventController\?\.abort\(\)/);
  assert.match(client, /function routeLeave\(\)[\s\S]*stopPoll\(\)[\s\S]*clearDelays\(\)[\s\S]*abortRequests\(\)[\s\S]*unbindEvents\(\)/);
  assert.match(client, /if \(!state\.routeActive \|\| !state\.open \|\| !state\.roomKey \|\| document\.hidden\) return/);
  assert.match(client, /lifecycleSnapshot/);
});

test("Quick Transfer delegates mobile focus recovery to the shared shell", () => {
  assert.match(client, /function requestFocusReveal\(reason\)[\s\S]*window\.LusuMobileShell\?\.requestFocusReveal\?\.\(reason\)/);
  assert.doesNotMatch(client, /subscribeViewport|quick-transfer:viewport-focus|viewportUnsubscribe/);
  assert.doesNotMatch(client, /scrollIntoView|focusedTransferControl|revealFocusedTransferControl|keepFocusedControlVisible|revealComposer/);
  assert.match(client, /function loadConfig[\s\S]*requestFocusReveal\("transfer:entry-state"\)[\s\S]*requestFocusReveal\("transfer:login-state"\)/);
  assert.match(client, /function joinRoom[\s\S]*requestFocusReveal\("transfer:room-entered"\)[\s\S]*requestFocusReveal\("transfer:room-ready"\)/);
  assert.match(client, /function renderPendingFiles[\s\S]*requestFocusReveal\("transfer:attachments"\)/);
  assert.match(client, /function renderTasks[\s\S]*requestFocusReveal\("transfer:tasks"\)/);
  assert.match(client, /function setFeedback[\s\S]*requestFocusReveal\(error \? "transfer:feedback-error" : "transfer:feedback"\)/);
  assert.doesNotMatch(client, /requestFocusReveal\((?:draft|value|password|encryptedContent|refs\.textInput\.value)/);
});
