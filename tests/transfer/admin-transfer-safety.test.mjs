import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const html = readFileSync(new URL("admin/transfer.html", root), "utf8");
const client = readFileSync(new URL("admin/transfer.js", root), "utf8");
const styles = readFileSync(new URL("admin/transfer.css", root), "utf8");
const service = readFileSync(new URL("functions/api/transfer-service.mjs", root), "utf8");

test("Transfer admin replaces native confirms with a contextual safe-default dialog", () => {
  assert.doesNotMatch(client, /\bconfirm\s*\(/);
  assert.match(html, /<dialog[^>]+id="context-dialog"/);
  assert.match(html, /id="context-dialog-cancel">取消，保留当前状态</);
  assert.match(client, /window\.setTimeout\(\(\) => byId\("context-dialog-cancel"\)\.focus\(\), 0\)/);
  assert.match(client, /event\.target === dialog[\s\S]*dialog\.close\("cancel"\)/);
  assert.match(client, /dialog\.returnValue === "confirm"/);
  assert.match(client, /title: "永久删除互传项目"[\s\S]*发送者：/);
  assert.match(client, /"清空互传房间"[\s\S]*不可撤销/);
});

test("Transfer settings keep a baseline, guard navigation, and recover from CAS conflicts", () => {
  assert.match(client, /settingsBaseline: ""/);
  assert.match(client, /function settingsSnapshot\(\)/);
  assert.match(client, /settingsSnapshot\(\) !== state\.settingsBaseline/);
  assert.match(client, /window\.addEventListener\("beforeunload"/);
  assert.match(client, /protectAdminNavigation/);
  assert.match(client, /expectedUpdatedAt: state\.settingsVersion/);
  assert.match(client, /TRANSFER_SETTINGS_CONFLICT/);
  assert.match(html, /id="settings-conflict"[^>]+role="alert"/);
  assert.match(html, /id="settings-reload">载入服务器版本</);
  assert.match(html, /id="settings-keep"[^>]*>保留本页输入，准备覆盖</);
  assert.match(service, /SETTINGS_REVISION_KEY/);
  assert.match(service, /where setting_key = \? and setting_value = \?/);
  assert.match(service, /TRANSFER_SETTINGS_CONFLICT/);
});

test("Transfer admin serializes mutations and protects list searches from stale responses", () => {
  assert.match(client, /mutationLocked: false/);
  assert.match(client, /if \(state\.mutationLocked\)[\s\S]*return null/);
  assert.match(client, /document\.querySelectorAll\("\[data-mutation\]"\)/);
  assert.match(client, /controller\?\.abort\(\)/);
  assert.match(client, /const sequence = channel\.sequence \+ 1/);
  assert.match(client, /if \(channel\.sequence !== sequence\)/);
  assert.match(client, /room: \{ sequence: 0, controller: null, timer: 0 \}/);
  assert.match(client, /item: \{ sequence: 0, controller: null, timer: 0 \}/);
});

test("Transfer admin retains partial failures and keeps successful sections usable", () => {
  assert.match(service, /return transferJson\(result, result\.ok \? 200 : 502\)/);
  assert.match(service, /return transferJson\(result, result\.status === "partial" \? 502 : 200\)/);
  assert.match(service, /failures: failures\.slice\(0, 100\)/);
  assert.match(client, /Promise\.all\(definitions\.map/);
  assert.match(client, /部分数据读取失败/);
  assert.match(client, /renderOperationFailure\(error\.payload, options\.partialRetry\)/);
  assert.match(html, /id="operation-result"[^>]+role="alert"/);
  assert.match(html, /id="operation-retry"[^>]+data-mutation/);
});

test("Transfer admin tables expose keyboard-scrollable labelled regions", () => {
  const wrappers = html.match(/class="table-wrap"[^>]*>/g) || [];
  assert.equal(wrappers.length, 4);
  for (const wrapper of wrappers) {
    assert.match(wrapper, /tabindex="0"/);
    assert.match(wrapper, /role="region"/);
    assert.match(wrapper, /aria-label="[^"]+"/);
    assert.match(wrapper, /aria-describedby="table-scroll-hint"/);
  }
  assert.match(styles, /\.table-wrap:focus-visible/);
});

test("ready transitions verify D1 changes before recording completed uploads", () => {
  assert.match(service, /const readyResult = await env\.DB\.prepare/);
  assert.match(service, /statementChanges\(readyResult\) !== 1/);
  assert.match(service, /const completionResults = await env\.DB\.batch/);
  assert.match(service, /statementChanges\(completionResults\[0\]\) !== 1/);
  assert.match(service, /TRANSFER_UPLOAD_CANCELLED/);
  assert.match(service, /env\.TRANSFER_BUCKET\.delete\(row\.object_key\)/);
});
