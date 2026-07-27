import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const audit = read("scripts/public-ui-audit.mjs");
const packageData = JSON.parse(read("package.json"));
const qa = read("docs/PUBLIC_SITE_RELEASE_QA.md");

test("release audit freezes the complete route/language/viewport contract without screenshot explosion", () => {
  for (const token of ["359x500", "375x667", "390x844", "430x932", "844x390", "1280x720", "1440x900"]) {
    assert.match(audit, new RegExp(token.replace("x", "x")));
  }
  assert.match(audit, /routes:\s*auditRoutes/);
  assert.match(audit, /languages:\s*Object\.keys\(semanticLanguages\)/);
  assert.match(audit, /screenshotPolicy:\s*"representative-only"/);
  assert.match(audit, /auditResponsiveReleaseMatrix/);
  assert.match(audit, /cardContainment/);
  assert.match(audit, /primary 44px targets failed/);
  assert.match(audit, /scrollables/);
});

test("release audit records performance, lifecycle, semantic, Home, shell, and About evidence", () => {
  for (const token of [
    "home-first-screen",
    "route-switch",
    "long-article",
    "chat",
    "transfer",
    "Memory.getDOMCounters",
    "HeapProfiler.collectGarbage",
    "three-route-rounds",
    "auditSemanticMatrix",
    "auditForcedColorsSmoke",
    "auditReducedMotionWallpaperNetwork",
    "home-theme-welcome-roving",
    "About external-link labels",
    "performance-traces.json",
    "release-summary.json"
  ]) assert.ok(audit.includes(token), `missing ${token}`);
});

test("release audit uses a three-sample Home TBT median without relaxing structural budgets", () => {
  assert.match(audit, /name:"home-first-screen",\s*route:"home",\s*sampleCount:3/);
  assert.match(audit, /const sampleCount = scenario\.sampleCount \|\| 1/);
  assert.match(audit, /tbtMs:350/);
  assert.match(audit, /if \(tbtMedian > budgets\.tbtMs\)/);
  assert.match(audit, /HeapProfiler\.collectGarbage[\s\S]*Memory\.getDOMCounters/);
  for (const evidenceField of ["tbtSamples", "tbtMedian", "tbtMax", "samples"]) {
    assert.ok(audit.includes(evidenceField), `missing TBT sample evidence ${evidenceField}`);
  }
  for (const structuralBudget of ["requests", "encoded bytes", "decoded bytes", "CLS", "memory counters", "JS heap", "runtime errors"]) {
    assert.ok(audit.includes(structuralBudget), `missing per-sample performance guard ${structuralBudget}`);
  }
});

test("full-motion Dock evidence freezes exact transition frames and covers rapid responsive switching", () => {
  for (const token of [
    "--dock-icon-only",
    "Page.bringToFront",
    "chat-transition-start",
    "chat-transition-60ms",
    "chat-transition-140ms",
    "chat-after",
    "rapid-switch-games",
    "__auditStartViewTransitionCalls",
    "__auditFrameAnimations",
    "responsiveSamples"
  ]) assert.ok(audit.includes(token), `missing ${token}`);
  assert.match(audit, /take\("chat-transition-start",\s*0\)/);
  assert.match(audit, /take\("chat-transition-60ms",\s*60\)/);
  assert.match(audit, /take\("chat-transition-140ms",\s*140\)/);
  assert.match(audit, /take\("chat-after",\s*220\)/);
  assert.match(audit, /width\s*===\s*359\s*&&\s*item\.height\s*===\s*500/);
  assert.match(audit, /width\s*===\s*844\s*&&\s*item\.height\s*===\s*390/);
});

test("Resources visual audit freezes the transparent icon, compact card, and Transfer round-trip flow", () => {
  assert.equal(packageData.scripts["build:transfer-icons"], "node scripts/build-transfer-icon-atlas.mjs");
  assert.equal(packageData.scripts["audit:resources-layout"], "node scripts/public-ui-audit.mjs --resources-only");
  for (const token of [
    "--resources-only",
    "readResourceVisualState",
    "checkResourceReturnState",
    "resources-returned-${lang}-",
    "Resource list is not restored after closing Quick Transfer",
    "resourceVisualExpectedResultCount",
    "resourceDisplayLabels",
    "stable Tools route hash",
    "transferLoginBack",
    "exactCdpViewport:true"
  ]) assert.ok(audit.includes(token), `missing Resources audit contract ${token}`);
  assert.match(audit, /const resourceVisualLanguages\s*=\s*Object\.freeze\(\["zh",\s*"en",\s*"ja"\]\)/);
  for (const viewport of ["359x500", "375x667", "390x844", "760x900", "844x390", "1280x720"]) {
    assert.ok(audit.includes(`"${viewport}"`), `missing Resources audit viewport ${viewport}`);
  }
});

test("controlled video stages reload after a cached empty fixture before playable assertions", () => {
  const controlledFlow = audit.slice(audit.indexOf("async function auditControlledVideoFlow"), audit.indexOf("function logAuditStatus"));
  assert.match(controlledFlow, /window\.fetch=window\.__auditNativeVideoFetch/);
  assert.match(controlledFlow, /Page\.navigate[\s\S]*motion=off&audit-video-stage=playable#videos[\s\S]*stable\(client,\s*"videos"\)[\s\S]*controlled playable video card/);
  assert.doesNotMatch(controlledFlow, /setAuditRoute\(client,\s*"home"\)[\s\S]*setAuditRoute\(client,\s*"videos"\)/);
});

test("controlled article history reloads a unique document and reports segmented-list diagnostics", () => {
  const articleFlow = audit.slice(audit.indexOf("async function auditArticleFocusHistory"), audit.indexOf("async function auditResponsiveReleaseMatrix"));
  assert.match(articleFlow, /navigationNonce[\s\S]*audit-article-history=\$\{navigationNonce\}#knowledge/);
  assert.match(articleFlow, /Page\.navigate[\s\S]*stable\(client,\s*"knowledge"\)[\s\S]*segmented controlled article list/);
  for (const token of ["listCardCount", "globalCardCount", "loadMore", "moduleState", "knowledgeLifecycle", "runtimeErrors"]) {
    assert.ok(articleFlow.includes(token), `missing controlled article diagnostic ${token}`);
  }
  assert.match(articleFlow, /#knowledge-list \[data-article-slug\]/);
});

test("short-screen Chat overlap checks protect real content while allowing the window backdrop behind the translucent Dock", () => {
  const chatFlow = audit.slice(audit.indexOf("async function auditChatShortScreenCapacity"), audit.indexOf("async function auditRouteScrollOwner"));
  assert.match(chatFlow, /windowDock:overlap\(windowRect,dock\)/);
  for (const token of ["logCompose", "composeFeedback", "composeFooter", "footerDock", "hintHeader", "hintNickname", "hintRoomStatus", "hintSummary", "hintLog", "hintCompose"]) {
    assert.ok(chatFlow.includes(token), `missing Chat content overlap check ${token}`);
  }
  const assertedPairs = [...chatFlow.matchAll(/checkNoOverlap\([^\n]+/g)].map((match) => match[0]).join("\n");
  assert.doesNotMatch(assertedPairs, /windowDock/);
  assert.match(chatFlow, /privateExpanded\?\.safety\?\.hint\?\.width[\s\S]*< 220/);
  assert.match(audit, /if \(!viewport\.mobile\) need\(data\.windowDockOverlapArea <= 1/);
});

test("independent audit scenarios force new documents instead of inheriting warm SPA state", () => {
  assert.match(audit, /async function navigateFresh[\s\S]*searchParams\.set\("audit-stage"[\s\S]*Page\.navigate[\s\S]*loaderId/);
  for (const token of [
    "route-lifecycle-",
    "resources-games-hierarchy-",
    "frame-pipeline-coalescing-",
    "chat-short-screen-capacity-",
    "dock-keyboard-",
    "capture-"
  ]) assert.ok(audit.includes(token), `missing fresh-navigation stage ${token}`);
});

test("unified release command is local-only and release documentation defaults to blocked", () => {
  assert.equal(packageData.scripts["audit:public-ui:release"], "node scripts/public-ui-audit.mjs --release-only");
  assert.equal(packageData.scripts["audit:a-dark-room"], "node tests/a-dark-room-responsive-browser.audit.mjs");
  assert.equal(packageData.scripts["qa:local"], "npm run verify:public-site-release");
  assert.equal(packageData.scripts["qa:public-release"], "npm run verify:public-site-release");
  assert.equal(packageData.scripts["verify:public-site-release"], "npm run test && npm run check:public-modules && npm run build && npm run build:production:verify && npm run audit:public-ui:release && npm run audit:a-dark-room && git diff --check && git status --short");
  assert.doesNotMatch(packageData.scripts["verify:public-site-release"], /push|deploy|wrangler|commit/i);
  assert.match(qa, /default decision is `BLOCKED`/);
  assert.match(qa, /do not commit, push, merge/);
  assert.match(qa, /origin\/main/);
  assert.match(qa, /Cloudflare Pages production deployment commit/);
  assert.match(qa, /online `index\.html` CSS\/JS query strings/);
});
