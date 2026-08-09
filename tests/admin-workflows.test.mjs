import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("admin analytics shows the renamed Tools label without changing the resources route", () => {
  const source = read("admin/admin.js");
  const routeLabels = source.match(/const pageRouteLabels = \{([\s\S]*?)\n\};/)?.[1] || "";
  const pageDisplayInfo = source.match(/function pageDisplayInfo\(value, route = ""\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(routeLabels, /resources:\s*"工具区"/);
  assert.doesNotMatch(routeLabels, /resources:\s*"资源区"/);
  assert.match(pageDisplayInfo, /pageRouteLabels\[sectionKey\]\s*\|\|\s*pageRouteLabels\[routeKey\]/);
});

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

test("admin safely switches independent Daily AI News and Tool Radar delivery controls", () => {
  const html = read("admin/index.html");
  const source = read("admin/admin.js");
  const styles = read("admin/admin.css");

  assert.match(html, /data-panel="automation"[^>]*aria-controls="automation-panel"[^>]*>自动投递</);
  assert.match(html, /id="automation-panel" hidden aria-hidden="true"/);
  assert.match(html, /id="automation-channel-select"/);
  assert.match(html, /value="daily-ai-news">每日 AI 新闻 · 每日 07:00/);
  assert.match(html, /value="tool-radar">工具雷达 · 计划每周二 22:00/);
  assert.match(html, /每日 AI 新闻投递箱/);
  assert.match(html, /自动公开默认关闭/);
  assert.match(html, /本机定时任务 ai-7-8 已启用，每日 07:00 开始/);
  assert.match(html, /时区：Asia\/Shanghai；每个栏目的开关、自动公开和凭证彼此独立/);
  assert.match(html, /admin\.css\?v=20260809-admin-motion-polish-r2/);
  assert.match(html, /admin\.js\?v=20260809-admin-motion-polish-r2/);
  assert.doesNotMatch(html, /本轮只准备入口，不创建定时任务/);
  for (const id of [
    "automation-channel-select",
    "automation-channel-heading",
    "automation-channel-description",
    "automation-target-label",
    "automation-guide-summary",
    "automation-guide-list",
    "automation-toggle",
    "automation-auto-publish",
    "automation-rotate-token",
    "automation-revoke-token",
    "automation-secret-value",
    "automation-deliveries"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }

  assert.match(source, /automationChannelKey:\s*"daily-ai-news"/);
  assert.match(source, /"daily-ai-news":\s*\{[\s\S]*schedule:\s*"每日 07:00（Asia\/Shanghai）"/);
  assert.match(source, /"tool-radar":\s*\{[\s\S]*schedule:\s*"每周二 22:00（Asia\/Shanghai）"/);
  assert.match(source, /api\(`\/api\/admin\/automation\/\$\{channelKey\}`\)/);
  assert.match(source, /automationAdminEndpoint\("\/token"\)/);
  assert.match(source, /async function changeAutomationChannel\(event\)/);
  assert.match(source, /state\.automationChannelKey\s*=\s*nextKey/);
  assert.match(source, /state\.automationOneTimeToken\s*=\s*payload\.token/);
  assert.match(source, /state\.automationOneTimeToken\s*=\s*""/);
  assert.match(source, /state\.articleFilter\s*=\s*definition\.key/);
  assert.match(source, /async function updateAutomationAutoPublish\(\)/);
  assert.match(source, /autoPublish:\s*nextAutoPublish/);
  assert.match(source, /object:\s*definition\.heading/);
  assert.match(source, /createEventItemElement\(/);
  assert.doesNotMatch(source, /automation[\s\S]{0,200}innerHTML/);
  assert.match(styles, /\.automation-channel-picker\s*\{/);
  assert.match(styles, /\.automation-secret\[hidden\]\s*\{[^}]*display:\s*none !important/);
  assert.match(styles, /@media \(max-width:\s*560px\)[\s\S]*\.automation-channel-picker > select[\s\S]*min-height:\s*44px/);
  assert.match(styles, /@media \(max-width:\s*560px\)[\s\S]*\.automation-actions \.xp-button[\s\S]*min-height:\s*44px/);
});

test("admin traffic panel monitors D1 pressure and saves telemetry controls with conflict protection", () => {
  const html = read("admin/index.html");
  const source = read("admin/admin.js");
  const styles = read("admin/admin.css");

  assert.match(html, /data-panel="traffic"[^>]*aria-controls="traffic-panel"[^>]*>流量与写入</);
  assert.match(html, /id="traffic-panel" hidden aria-hidden="true"/);
  for (const id of [
    "traffic-estimated-rows",
    "traffic-official-rows",
    "traffic-breakdown-body",
    "traffic-control-form",
    "traffic-low-write-preset",
    "traffic-default-preset"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
  for (const name of [
    "analyticsEnabled",
    "identifyEnabled",
    "pageViewsEnabled",
    "clicksEnabled",
    "articleViewsEnabled",
    "adaptiveProtectionEnabled",
    "warningRows",
    "hardRows",
    "sampling_hard_clicks"
  ]) {
    assert.ok(html.includes(`name="${name}"`), `missing traffic field ${name}`);
  }

  assert.match(source, /const autoRefreshPanels = new Set\(\[\.\.\.overviewPanels, "traffic"\]\)/);
  assert.match(source, /api\("\/api\/admin\/traffic-control"\)/);
  assert.match(source, /expectedUpdatedAt:\s*state\.trafficControlUpdatedAt/);
  assert.match(source, /TRAFFIC_CONTROL_CONFLICT/);
  assert.match(source, /if \(!isEditorDirty\("traffic"\)\)/);
  assert.match(source, /站内估算，不是 Cloudflare 账单/);
  assert.doesNotMatch(source, /traffic[\s\S]{0,200}innerHTML/);
  assert.match(styles, /\.traffic-control-grid\s*\{/);
  assert.match(styles, /\.traffic-mode-badge\[data-mode="hard"\]/);
  assert.match(styles, /@media \(max-width:\s*680px\)[\s\S]*\.traffic-control-form \.xp-button[\s\S]*min-height:\s*44px/);
});

test("admin motion keeps keyboard actions immediate and rapid dialogs race-safe", () => {
  const source = read("admin/admin.js");
  const styles = read("admin/admin.css");

  assert.match(source, /function adminScrollBehavior\(\)[\s\S]*adminMotionShouldBeImmediate\(\) \|\| prefersReducedMotion\(\) \? "auto" : "smooth"/);
  assert.equal((source.match(/behavior: adminScrollBehavior\(\)/g) || []).length, 2);
  assert.match(source, /const behavior = adminScrollBehavior\(\)/);
  assert.match(source, /field\.focus\(\{ preventScroll: true \}\)[\s\S]*field\.scrollIntoView/);
  assert.match(source, /document\.addEventListener\("pointerover", restorePointerInputMethod/);
  assert.match(source, /document\.addEventListener\("pointermove", restorePointerInputMethod/);
  assert.match(source, /document\.addEventListener\("pointerdown", restorePointerInputMethod/);
  assert.doesNotMatch(source, /event\.pointerType !== "touch"/);
  assert.match(source, /cancelAdminDialogMotion\(dialog, \{ keepOpen: true \}\)/);
  assert.match(source, /if \(!dialog\.open\) \{\s*dialog\.showModal\(\)/);
  assert.match(source, /onClosed\?\.\(\{ interrupted: Boolean\(finishOptions\.interrupted\) \}\)/);
  assert.match(styles, /\.xp-button,\s*\.nav-button\s*\{\s*transition: transform 90ms var\(--admin-ease-out\)/);
  assert.match(styles, /\.xp-button:active:not\(:disabled\),[\s\S]*transition-duration: 140ms/);
  assert.match(styles, /\.admin-dialog\.is-dialog-closing::backdrop\s*\{\s*opacity: 0/);
  assert.match(styles, /\.mobile-nav-backdrop\.is-nav-closing:not\(\[hidden\]\)[\s\S]*pointer-events: auto/);
  assert.match(styles, /body\[data-input-method="keyboard"\] \.map-city-marker circle,[\s\S]*body\[data-input-method="keyboard"\] \.traffic-pressure-track span[\s\S]*transition: none !important/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.traffic-pressure-track span,[\s\S]*\.map-city-marker circle,[\s\S]*transition: none !important/);
  assert.doesNotMatch(source, /}, 1200\)/);
});
