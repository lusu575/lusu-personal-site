import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("admin leave protection is event-driven and refreshes clean async video baselines", () => {
  const source = read("admin/admin.js");
  const dirtyCheck = source.match(/function isEditorDirty\(panel\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.doesNotMatch(dirtyCheck, /refreshEditorDirtyState/);
  assert.match(dirtyCheck, /return Boolean\(tracking\.dirty\)/);
  assert.match(source, /form\.addEventListener\("input", handleDirtyInput\)/);
  assert.match(source, /form\.addEventListener\("change", handleDirtyInput\)/);
  assert.match(source, /async function loadVideos\([\s\S]*captureEditorBaselineIfClean\("videos"\)/);
  assert.match(source, /async function loadVideoCategories\([\s\S]*captureEditorBaselineIfClean\("videoCategories"\)[\s\S]*captureEditorBaselineIfClean\("videos"\)/);
});

test("main admin navigation exposes transfer file governance without publishing it as a public panel", () => {
  const adminHtml = read("admin/index.html");
  const transferHtml = read("admin/transfer.html");
  const transferJs = read("admin/transfer.js");
  assert.match(adminHtml, /data-admin-href="\/admin\/transfer\.html"[^>]*>互传文件管理</);
  assert.match(transferHtml, /<th>发送者<\/th>[\s\S]*<th>保存时间<\/th>[\s\S]*<th>过期时间<\/th>/);
  assert.match(transferHtml, /id="items-previous"[\s\S]*id="items-page-status"[\s\S]*id="items-next"/);
  assert.match(transferJs, /永久删除[\s\S]*R2 文件和数据库记录/);
  assert.match(transferJs, /row\.uploader_email \|\| row\.uploader_user_id/);
});
