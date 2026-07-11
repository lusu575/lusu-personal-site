import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [html, app, css, main] = await Promise.all([
  readFile(path.join(root, "index.html"), "utf8"),
  readFile(path.join(root, "app.mjs"), "utf8"),
  readFile(path.join(root, "style.css"), "utf8"),
  readFile(path.resolve(root, "..", "..", "js", "main.js"), "utf8")
]);

test("standalone shell exposes the required playback and learning controls", () => {
  assert.match(html, /<title>日语的言外之意<\/title>/);
  for (const id of ["audio-progress", "quick-speed", "question-form", "settings-dialog", "records-dialog", "sound-gate", "result-dialog"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /data-audio-action="toggle"/);
  for (const action of ["restart", "replay", "previous", "next", "line-replay"]) {
    assert.doesNotMatch(html, new RegExp(`data-audio-action=["']${action}["']`));
  }
  assert.doesNotMatch(html, /id="quick-mute"|id="quick-autoplay"|name="muted"|name="autoplay"|class="[^"']*line-play/);
  assert.match(html, /<dialog class="sound-gate"/);
  for (const mode of ["listening", "japanese", "bilingual"]) assert.match(html, new RegExp(`data-action="choose-mode" data-mode="${mode}"`));
  assert.match(html, /id="settings-form"[\s\S]*data-i18n="confirm"/);
  assert.match(html, /id="result-dialog"[\s\S]*data-action="view-analysis"[\s\S]*data-action="result-next"/);
  assert.match(html, /NOTICE-japanese-voices\.md"[\s\S]*rel="license noopener"/);
  assert.doesNotMatch(app, /from "\.\/lib\/[^"?]+\.mjs";/);
});

test("question-bank strings use safe DOM APIs instead of innerHTML", () => {
  assert.doesNotMatch(app, /\.innerHTML\s*=/);
  assert.match(app, /textContent/);
  assert.match(app, /replaceChildren/);
  assert.match(app, /safeToolAssetPath/);
});

test("responsive contract covers all acceptance viewports and reduced motion", () => {
  for (const width of [390, 680, 900]) assert.match(css, new RegExp(`max-width:\\s*${width}px`));
  assert.match(css, /orientation:\s*landscape/);
  assert.match(css, /max-height:\s*500px/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /select\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /\.dialog-window\s*\{[^}]*max-height:\s*calc\(100dvh - 24px\)/);
  assert.match(css, /\.dialog-body\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0/);
});

test("navigation, modal focus, option feedback, and cache invalidation have explicit guards", () => {
  assert.match(app, /restoreDeepLink\(\{ focus: true \}\)/);
  assert.match(app, /historyMode: "none"/);
  assert.match(app, /history\.replaceState/);
  assert.match(app, /if \(\$\("#sound-gate"\)\?\.open\) return/);
  assert.match(app, /correctAnswer/);
  assert.match(app, /yourWrongChoice/);
  assert.match(app, /shortContentHash\(stage\.contentHash\)/);
  assert.match(app, /hasCompletedModeOnboarding\(\)/);
  assert.match(app, /markModeOnboardingComplete\(\)/);
  assert.match(app, /function highlightLine\(id\)[\s\S]*?classList\.toggle/);
  assert.doesNotMatch(app, /function highlightLine\(id\)[\s\S]{0,400}scrollIntoView/);
  assert.match(app, /state\.settings\.autoplay = false/);
  assert.match(app, /document\.hidden[\s\S]*?player\.stop\(\)/);
  assert.match(app, /if \(detail\.context\?\.kind === "scene"\) \{[\s\S]*?unlockQuestions\(\);[\s\S]*?return;/);
  assert.match(app, /player\.isSceneLoaded\(\) && player\.seek\(start\)[\s\S]*?await player\.resume\(\)/);
  assert.match(app, /state\.audioAvailable = Boolean\(player\.manifest\)/);
  assert.match(app, /async function retryAudio\(\)\s*\{[\s\S]*?player\.stop\(\);[\s\S]*?if \(!manifestIsValid\)[\s\S]*?if \(state\.stage\) await playScene\(0\)/);
});

test("main-site resource path is narrowly allowlisted", () => {
  assert.ok(main.includes("/^tools\\/japanese-subtext\\/?$/i"));
  assert.match(main, /tools\/japanese-subtext\/assets\/icons\/tool-icon-64\.webp/);
  assert.match(main, /actionLabel/);
});
