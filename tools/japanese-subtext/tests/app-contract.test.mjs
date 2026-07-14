import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [html, app, css, main, manifest, audioPlayer, cloud, constants, contentLoader, i18n, questionFlow, storage] = await Promise.all([
  readFile(path.join(root, "index.html"), "utf8"),
  readFile(path.join(root, "app.mjs"), "utf8"),
  readFile(path.join(root, "style.css"), "utf8"),
  readFile(path.resolve(root, "..", "..", "js", "main.js"), "utf8"),
  readFile(path.join(root, "manifest.json"), "utf8"),
  ...["audio-player.mjs", "cloud.mjs", "constants.mjs", "content-loader.mjs", "i18n.mjs", "question-flow.mjs", "storage.mjs"]
    .map((file) => readFile(path.join(root, "lib", file), "utf8"))
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
  assert.match(html, /id="result-dialog"[^>]*closedby="none"[\s\S]*data-action="view-analysis"[\s\S]*data-action="result-next"/);
  assert.doesNotMatch(html, /data-action="close-result"/);
  assert.match(html, /id="analysis-panel"[\s\S]*id="analysis-retry"[^>]*data-action="try-again"[\s\S]*id="analysis-next"[\s\S]*data-action="next-stage"[\s\S]*id="analysis-content"/);
  assert.match(html, /id="dashboard-primary-action"[\s\S]*data-i18n="startChallenge"/);
  assert.match(html, /class="eyebrow" data-i18n="dashboardEyebrow"/);
  assert.equal((html.match(/data-action="open-settings"/g) || []).length, 1);
  assert.ok(html.indexOf('class="player-panel') < html.indexOf('class="scene-column'));
  assert.ok(html.indexOf('class="player-panel') < html.indexOf('id="stage-illustration"'));
  assert.ok(html.indexOf('id="stage-illustration"') < html.indexOf('class="scene-column'));
  assert.ok(html.indexOf('class="scene-column') < html.indexOf('class="question-column'));
  assert.match(html, /class="stage-media-column"[\s\S]*class="stage-learning-column"/);
  assert.match(html, /id="illustration-fallback"[\s\S]*data-action="retry-illustration"/);
  assert.match(html, /name="optionText" aria-describedby="option-availability-note"[\s\S]*name="optionAudio" aria-describedby="option-availability-note"/);
  for (const id of ["back-site", "status-text", "cloud-status", "ui-language"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /NOTICE-japanese-voices\.md"[\s\S]*rel="license noopener"/);
  assert.match(html, /style\.css\?v=20260714-japanese-subtext-v104-r1/);
  assert.match(html, /app\.mjs\?v=20260714-japanese-subtext-v104-r1/);
  assert.match(html, /data-i18n="toolVersion">版本 1\.0\.4</);
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
  assert.match(css, /body\s*\{[^}]*user-select:\s*none/);
  assert.match(css, /input:is\([^}]*user-select:\s*text/);
  assert.match(css, /\.trainer-frame-card\s*\{[^}]*align-self:\s*start;[^}]*width:\s*min\(1280px/);
  assert.match(css, /@media \(min-width:\s*681px\) and \(min-height:\s*650px\)[\s\S]*?\.trainer-frame-card\s*\{[^}]*min-height:\s*calc\(100dvh - 78px\)/);
  assert.match(css, /\.trainer-tools\s*\{[^}]*grid-template-columns:/);
  assert.match(css, /\.stage-workspace\s*\{[^}]*grid-template-columns:/);
  assert.match(css, /\.stage-media-column, \.stage-learning-column\s*\{[^}]*align-content:\s*start/);
  assert.match(css, /\.player-panel\s*\{[^}]*align-self:\s*start/);
  assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*?\.stage-workspace\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(orientation:\s*portrait\) and \(max-width:\s*900px\)[\s\S]*?body\s*\{[^}]*trainer-backdrop-mobile\.webp[^}]*background-attachment:\s*scroll[^}]*\}[\s\S]*?\.stage-illustration\s*\{[^}]*max-height:\s*30dvh/);
  assert.doesNotMatch(css, /@media \(max-width:\s*900px\)\s*\{\s*body\s*\{[^}]*trainer-backdrop-mobile\.webp/);
  assert.match(css, /@media \(orientation:\s*landscape\) and \(max-height:\s*500px\)[\s\S]*?\.stage-illustration\s*\{[^}]*max-height:\s*42dvh/);
  assert.match(css, /@media \(max-height:\s*500px\)[\s\S]*?\.player-panel\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-height:\s*500px\)[\s\S]*?\.trainer-context span,\s*\.trainer-cloud-panel span\s*\{[^}]*white-space:\s*nowrap;[^}]*text-overflow:\s*ellipsis/);
  assert.match(css, /@media \(max-width:\s*390px\) and \(max-height:\s*500px\)[\s\S]*?\.stage-toolbar\s*\{[^}]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(css, /\.stage-illustration\s*\{[^}]*max-height:\s*none/);
  assert.match(css, /\.stage-illustration\s*\{[^}]*max-height:\s*42vh/);
  assert.match(css, /trainer-backdrop-desktop\.webp/);
  assert.match(css, /trainer-backdrop-mobile\.webp/);
  assert.doesNotMatch(css, /\.xp-control:active\s*\{[^}]*transform:/);
  assert.match(css, /\.question-card\.is-missing\s*\{/);
  assert.match(css, /\.checkin-table\s*\{[^}]*table-layout:\s*fixed/);
  assert.match(css, /\.sound-gate\s*\{[^}]*var\(--safe-top\)[^}]*var\(--safe-right\)[^}]*var\(--safe-bottom\)[^}]*var\(--safe-left\)/);
  assert.match(css, /\.dialog-window\s*\{[^}]*max-height:\s*calc\(100dvh - 24px - var\(--safe-top\) - var\(--safe-bottom\)\)/);
  assert.match(css, /\.dialog-body\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0/);
});

test("navigation, modal focus, option feedback, and cache invalidation have explicit guards", () => {
  assert.match(app, /restoreDeepLink\(\{ focus: true \}\)/);
  assert.match(app, /historyMode: "none"/);
  assert.match(app, /history\.replaceState/);
  assert.match(app, /if \(\$\("#sound-gate"\)\?\.open\) return/);
  assert.match(app, /correctAnswer/);
  assert.match(app, /yourWrongChoice/);
  assert.match(app, /shortContentHash\(stage\.illustration\?\.sha256 \|\| stage\.contentHash\)/);
  assert.doesNotMatch(app, /classList\.toggle\("has-illustration"/);
  assert.match(app, /hasCompletedModeOnboarding\(\)/);
  assert.match(app, /markModeOnboardingComplete\(\)/);
  assert.match(app, /syncNextStageButton\(\$\("#analysis-next"\), actions\.showNext\)/);
  assert.match(app, /syncNextStageButton\(\$\("#result-next"\), actions\.showNext\)/);
  assert.doesNotMatch(app, /syncNextStageButton\([^\n]+state\.cleared\)/);
  assert.match(app, /unansweredIndex[\s\S]*?card\?\.querySelector\("input:not\(:disabled\)"\)\?\.focus\(\)/);
  assert.match(app, /enforceOptionAvailability\(form, event\?\.target\?\.name\)/);
  assert.match(app, /function showAudioError\([^)]*\)[\s\S]*?needsOptionTextFallback[\s\S]*?state\.temporaryOptionText = true[\s\S]*?renderQuestions\(state\.stage\)/);
  assert.match(app, /state\.failedAudioContext = \{ \.\.\.context \}/);
  assert.match(app, /async function retryAudio\(\)[\s\S]*?failedContext\?\.kind === "line"[\s\S]*?player\.playLine[\s\S]*?failedContext\?\.kind === "token"[\s\S]*?player\.playToken[\s\S]*?failedContext\?\.kind === "option"[\s\S]*?player\.playOption/);
  assert.match(app, /className: `option-status \$\{correct \? "is-correct" : "is-wrong"\}`/);
  assert.match(app, /previousDisplayMode !== "listening" && state\.settings\.displayMode === "listening"\) \{[\s\S]*?state\.questionUnlocked = false/);
  assert.match(app, /\$\("#sound-gate"\)\.addEventListener\("cancel", \(event\) => \{[\s\S]*?event\.preventDefault\(\)/);
  assert.match(app, /resultDialog\.addEventListener\("cancel", \(event\) => \{[\s\S]*?event\.preventDefault\(\)[\s\S]*?requireResultAction\(\)/);
  assert.match(app, /resultDialog\.addEventListener\("click", \(event\) => \{[\s\S]*?event\.target === resultDialog[\s\S]*?requireResultAction\(\)/);
  assert.match(app, /function requireResultAction\(\)[\s\S]*?resultActionRequired[\s\S]*?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(app, /!\$\("#result-dialog"\)\.open/);
  assert.match(app, /function goToNextStage\(\)[\s\S]*?showMap\(state\.level\)/);
  assert.match(app, /function retryIllustration\(\)[\s\S]*?searchParams\.set\("retry"/);
  assert.match(app, /genreLabel\(genre, state\.settings\.uiLanguage\)/);
  assert.match(app, /localized\(person\?\.name, state\.settings\.uiLanguage, t\("unknownSpeaker"\)\)/);
  assert.doesNotMatch(app, /localized\(person\?\.name, state\.settings\.uiLanguage, line\.speaker\)/);
  assert.equal((i18n.match(/unknownSpeaker:/g) || []).length, 3);
  assert.match(app, /function buildCheckInCalendar\(month\)/);
  assert.match(app, /\[data-action='choose-mode'\]:not\(:disabled\)/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.player-state,\s*\.question-hint,\s*\.settings-note\s*\{[^}]*font-size:\s*16px[^}]*line-height:\s*1\.5/);
  assert.match(app, /function highlightLine\(id\)[\s\S]*?classList\.toggle/);
  assert.match(app, /function highlightLine\(id\)[\s\S]*?setAttribute\("aria-current", "true"\)[\s\S]*?removeAttribute\("aria-current"\)/);
  const highlightLineBlock = app.slice(app.indexOf("function highlightLine"), app.indexOf("function beginOptionQueue"));
  assert.doesNotMatch(highlightLineBlock, /scrollIntoView/);
  const showAnalysisBlock = app.slice(app.indexOf("function showAnalysis"), app.indexOf("function goToNextStage"));
  assert.match(showAnalysisBlock, /scrollIntoView\([\s\S]*block:\s*"start"/);
  assert.match(app, /state\.settings\.autoplay = false/);
  assert.match(app, /document\.hidden[\s\S]*?player\.stop\(\)/);
  assert.match(app, /if \(detail\.context\?\.kind === "scene"\) \{[\s\S]*?unlockQuestions\(\);[\s\S]*?return;/);
  assert.match(app, /player\.isSceneLoaded\(\) && player\.seek\(start\)[\s\S]*?await player\.resume\(\)/);
  assert.match(app, /state\.audioAvailable = Boolean\(player\.manifest\)/);
  assert.match(app, /mode === "listening" && !state\.audioAvailable[\s\S]*listeningUnavailable/);
  assert.match(app, /listening\.disabled = audioUnavailable/);
  assert.match(app, /uiLanguage === "ja"[\s\S]*optionLanguage === "ja" \? "en"/);
  assert.match(app, /optionLanguage === "zh" \? "zh-CN" : state\.settings\.optionLanguage/);
  assert.match(app, /async function retryAudio\(\)\s*\{[\s\S]*?player\.stop\(\);[\s\S]*?if \(!manifestIsValid\)[\s\S]*?await playScene\(0\)/);
  assert.doesNotMatch(app, /\.\/lib\/[^"?]+\.mjs\?v=20260711-japanese-subtext-r14/);
  assert.doesNotMatch(`${audioPlayer}\n${cloud}\n${contentLoader}\n${i18n}\n${questionFlow}\n${storage}`, /v102-r1|v103-r6|v103-retry-r1/);
  assert.equal((app.match(/\.\/lib\/[^"?]+\.mjs\?v=20260714-japanese-subtext-v104-r1/g) || []).length, 7);
});

test("application and content versions remain independently pinned", () => {
  const parsedManifest = JSON.parse(manifest);
  assert.equal(parsedManifest.appVersion, "1.0.4");
  assert.equal(parsedManifest.contentVersion, "1.0.3");
  assert.match(constants, /APP_VERSION = "1\.0\.4"/);
  assert.match(constants, /CONTENT_VERSION = "1\.0\.3"/);
  assert.match(i18n, /toolVersion: `版本 \$\{APP_VERSION\}`/);
  assert.match(i18n, /toolVersion: `Version \$\{APP_VERSION\}`/);
  assert.match(i18n, /toolVersion: `バージョン \$\{APP_VERSION\}`/);
});

test("wrong-answer recovery remains reachable outside the result dialog", () => {
  assert.match(html, /class="question-actions"[\s\S]*id="try-again"[^>]*data-action="try-again"/);
  assert.match(html, /id="analysis-retry"[^>]*data-action="try-again"[\s\S]*id="analysis-content"/);
  assert.doesNotMatch(html, /data-action="close-result"/);
  assert.match(app, /\[\$\("#settings-dialog"\), \$\("#records-dialog"\)\]/);
  assert.match(app, /resultDialog\.addEventListener\("cancel", \(event\) => \{[\s\S]*?event\.preventDefault\(\)[\s\S]*?requireResultAction\(\)/);
  assert.match(app, /!\$\("#result-dialog"\)\.open/);
  assert.doesNotMatch(app, /case "close-result"/);
  assert.match(app, /\$\("#try-again"\)\.hidden = !questionActionState\(state\)\.showRetry/);
  assert.match(app, /\$\("#analysis-retry"\)\.hidden = !actions\.showRetry/);
  assert.match(app, /\$\("#result-retry"\)\.hidden = !actions\.showRetry/);
});

test("main-site resource path is narrowly allowlisted", () => {
  assert.ok(main.includes("/^tools\\/japanese-subtext\\/?$/i"));
  assert.match(main, /return `\$\{sitePath\("tools\/japanese-subtext\/"\)\}\?lang=\$\{encodeURIComponent\(currentLang\)\}`/);
  assert.match(main, /tools\/japanese-subtext\/assets\/icons\/tool-icon-64\.webp/);
  assert.match(main, /actionLabel/);
});
