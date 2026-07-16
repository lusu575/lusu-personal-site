import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const client = readFileSync(new URL("js/transfer.js", root), "utf8");
const styles = readFileSync(new URL("css/transfer.css", root), "utf8");

test("Quick Transfer stages selected, dropped, and pasted files until Send", () => {
  assert.match(html, /id="transfer-pending-attachments"/);
  assert.match(html, /id="transfer-send-button"/);
  assert.match(client, /refs\.photoInput\?\.addEventListener\("change", handlePickerChange\)/);
  assert.match(client, /refs\.fileInput\?\.addEventListener\("change", handlePickerChange\)/);
  assert.match(client, /function handlePickerChange[\s\S]*stageFiles\(input\.files, input\)/);
  assert.match(client, /function handleWindowDrop[\s\S]*stageFiles\(files, refs\.uploadZone\)/);
  assert.match(client, /clipboardData\?\.files\?\.length\) stageFiles\(event\.clipboardData\.files, document\.activeElement\)/);
  assert.match(client, /function stageFiles[\s\S]*state\.pendingFiles\.set/);
  assert.match(client, /function sendComposer[\s\S]*await api\("\/api\/transfer\/text"[\s\S]*takePendingFiles\(pending\.map[\s\S]*queueFiles\(files, context\)/);
});

test("Quick Transfer validates a complete pending batch before creating previews", () => {
  const staging = client.slice(client.indexOf("function stageFiles"), client.indexOf("function renderPendingFiles"));
  assert.match(client, /const MAX_PENDING_FILES = 20;/);
  assert.match(client, /const MAX_PENDING_BYTES = 500 \* MIB;/);
  assert.match(staging, /state\.pendingFiles\.size \+ candidates\.length > MAX_PENDING_FILES/);
  assert.match(staging, /pendingBytes \+ candidateBytes > MAX_PENDING_BYTES/);
  assert.match(staging, /attachmentCountLimit/);
  assert.match(staging, /attachmentBatchTooLarge/);
  assert.ok(staging.indexOf("MAX_PENDING_FILES") < staging.indexOf("URL.createObjectURL"));
  assert.ok(staging.indexOf("MAX_PENDING_BYTES") < staging.indexOf("URL.createObjectURL"));
  assert.equal(client.match(/attachmentCountLimit:/g)?.length, 3);
  assert.equal(client.match(/attachmentBatchTooLarge:/g)?.length, 3);
});

test("Quick Transfer restores visible picker focus and defends removal during send", () => {
  assert.match(client, /function stageFiles\(fileList, focusTarget = refs\.textInput\)[\s\S]*restoreComposerFocus\(focusTarget\)/);
  assert.match(client, /function restoreComposerFocus[\s\S]*focus\(\{ preventScroll: true \}\)/);
  assert.match(client, /function removePendingFile\(localId\) \{\s*if \(state\.composerSending\) return;/);
  assert.match(styles, /\.transfer-file-picker:focus-within\s*\{[\s\S]*outline:/);
});

test("Quick Transfer exposes a gallery picker without forcing camera capture", () => {
  const photoInput = html.match(/<input id="transfer-photo-input"[^>]*>/)?.[0] || "";
  assert.match(photoInput, /type="file"/);
  assert.match(photoInput, /accept="image\/\*"/);
  assert.match(photoInput, /\bmultiple\b/);
  assert.doesNotMatch(photoInput, /\bcapture(?:=|\s|>)/i);
  assert.match(html, /id="transfer-file-input" type="file" multiple/);
});

test("Quick Transfer renders compact media, file cards, downloads, and text copy controls", () => {
  assert.match(client, /className = "transfer-media-preview transfer-image-preview"/);
  assert.match(client, /className = "transfer-file-card"/);
  assert.match(client, /download\.download = item\.filename/);
  assert.match(client, /download\.href = withDownloadParam\(item\.fileUrl\)/);
  assert.match(client, /function withDownloadParam[\s\S]*new URL\(value, window\.location\.href\)[\s\S]*searchParams\.set\("download", "1"\)/);
  assert.match(client, /className = "xp-button transfer-copy-text-button"/);
  assert.equal(client.match(/copyText:/g)?.length, 3);
  assert.match(client, /image\.width = 320;\s*image\.height = 200;/);
  assert.match(styles, /\.transfer-media-preview\s*\{[\s\S]*width:\s*min\(100%, 320px\)[\s\S]*max-height:\s*220px[\s\S]*aspect-ratio:\s*16 \/ 10/);
  assert.match(styles, /html\[data-ui-shell="mobile"\] \.transfer-media-preview\s*\{[\s\S]*width:\s*min\(100%, 260px\)[\s\S]*max-height:\s*180px/);
});

test("Quick Transfer exposes localized progress, speed, and ETA text to assistive technology", () => {
  const tasks = client.slice(client.indexOf("function renderTasks"), client.indexOf("function taskButton"));
  assert.match(tasks, /progress\.setAttribute\("aria-label", text\("progressLabel"/);
  assert.match(tasks, /progress\.setAttribute\("aria-valuetext", text\("progressValue"/);
  assert.match(tasks, /const eta = remainingBytes === 0 \? text\("durationComplete"\) : formatDuration/);
  assert.match(client, /function formatDuration[\s\S]*text\("durationSeconds"[\s\S]*text\("durationMinutes"[\s\S]*text\("durationHoursMinutes"/);
  assert.equal(client.match(/progressLabel:/g)?.length, 3);
  assert.equal(client.match(/progressValue:/g)?.length, 3);
  assert.equal(client.match(/durationUnknown:/g)?.length, 3);
});

test("Quick Transfer binds text submission to an immutable room context", () => {
  const composer = client.slice(client.indexOf("async function sendComposer"), client.indexOf("async function refreshItems"));
  assert.match(composer, /const context = captureRoomContext\(\)/);
  assert.match(composer, /encryptText\(value, context\.cryptoKey\)/);
  assert.match(composer, /json: \{ roomKey: context\.roomKey, encryptedContent \}/);
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
  assert.match(client, /function invalidateRoomContext[\s\S]*cancelAndClearUploadTasks\(\)/);
  assert.match(client, /function close\(\)[\s\S]*invalidateRoomContext\(\)/);
  assert.match(client, /function leaveRoom\(\)[\s\S]*invalidateRoomContext\(\)/);
  assert.match(client, /localId: task\.localId, roomKey: task\.roomKey/);
});
