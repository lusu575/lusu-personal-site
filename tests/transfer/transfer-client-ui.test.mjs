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
  assert.match(client, /refs\.photoInput\?\.addEventListener\("change", \(event\) => stageFiles\(event\.target\.files\)\)/);
  assert.match(client, /refs\.fileInput\?\.addEventListener\("change", \(event\) => stageFiles\(event\.target\.files\)\)/);
  assert.match(client, /function handleWindowDrop[\s\S]*stageFiles\(files\)/);
  assert.match(client, /clipboardData\?\.files\?\.length\) stageFiles\(event\.clipboardData\.files\)/);
  assert.match(client, /function stageFiles[\s\S]*state\.pendingFiles\.set/);
  assert.match(client, /function sendComposer[\s\S]*await api\("\/api\/transfer\/text"[\s\S]*takePendingFiles\(pending\.map[\s\S]*queueFiles\(files, context\)/);
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
  assert.match(client, /className = "xp-button transfer-copy-text-button"/);
  assert.equal(client.match(/copyText:/g)?.length, 3);
  assert.match(styles, /\.transfer-media-preview\s*\{[\s\S]*width:\s*min\(100%, 320px\)[\s\S]*max-height:\s*220px/);
  assert.match(styles, /html\[data-ui-shell="mobile"\] \.transfer-media-preview\s*\{[\s\S]*width:\s*min\(100%, 260px\)[\s\S]*max-height:\s*180px/);
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
