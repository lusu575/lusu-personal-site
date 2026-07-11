import { ContentLoader } from "./lib/content-loader.mjs?v=20260711-japanese-subtext-r14";
import { AudioPlayer } from "./lib/audio-player.mjs?v=20260711-japanese-subtext-r14";
import { CloudProgress } from "./lib/cloud.mjs?v=20260711-japanese-subtext-r14";
import { formatTime, localized, parseStageId, safeToolAssetPath, shortContentHash, stageId } from "./lib/constants.mjs?v=20260711-japanese-subtext-r14";
import { createTranslator, normalizeUiLanguage } from "./lib/i18n.mjs?v=20260711-japanese-subtext-r14";
import {
  hasCompletedModeOnboarding, loadLocalState, markModeOnboardingComplete, mergeProgress, mergeSettings,
  nextStageId, progressStats, recordAttempt, resetLocalState, saveProgress, saveSettings
} from "./lib/storage.mjs?v=20260711-japanese-subtext-r14";

const loader = new ContentLoader();
const player = new AudioPlayer();
const cloud = new CloudProgress();
const languageHint = normalizeUiLanguage(new URLSearchParams(location.search).get("lang") || document.documentElement.lang?.slice(0, 2));
const local = loadLocalState(undefined, languageHint);

const state = {
  settings: local.settings,
  progress: local.progress,
  catalog: null,
  levelIndex: null,
  level: local.progress.currentLevel,
  stage: null,
  screen: "dashboard",
  questionUnlocked: false,
  submitted: false,
  cleared: false,
  attemptCleared: false,
  attemptMedal: "none",
  replayCount: 0,
  hintCount: 0,
  activeLineId: "",
  audioState: "stopped",
  audioAvailable: false,
  cloudStatusKey: "authLocal",
  analysisVisible: false,
  optionQueue: [],
  optionQueueRunning: false,
  draftAnswers: {},
  lastScore: null,
  localResetInProgress: false
};
let navigationEpoch = 0;
let audioManifestPromise = null;

const t = createTranslator(() => state.settings.uiLanguage);
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

init().catch((error) => {
  console.error(error);
  setStatus(t("loadFailed"));
  announce(t("loadFailed"));
});

async function init() {
  bindActions();
  applyLanguage();
  syncSettingsControls();
  player.configure(state.settings);
  if (local.damaged) announce(t("localDamaged"));

  state.catalog = await loader.loadCatalog();
  renderDashboard();
  setStatus("READY");
  await restoreDeepLink({ focus: false });
  mergeCloudProgress();
}

function bindActions() {
  document.addEventListener("click", (event) => {
    const actionTarget = event.target.closest("[data-action]");
    if (actionTarget) {
      event.preventDefault();
      dispatchAction(actionTarget.dataset.action, actionTarget).catch(handleUiError);
      return;
    }
    const audioTarget = event.target.closest("[data-audio-action]");
    if (audioTarget) {
      event.preventDefault();
      dispatchAudioAction(audioTarget.dataset.audioAction, audioTarget).catch(handleAudioError);
    }
  });

  $("#ui-language").addEventListener("change", (event) => {
    state.settings.uiLanguage = normalizeUiLanguage(event.target.value);
    persistSettings();
    applyLanguage();
    renderCurrentScreen();
    writeHistory(currentHistoryQuery(), "replace");
  });

  $("#settings-form").addEventListener("change", readSettingsForm);
  $("#settings-dialog").addEventListener("close", () => {
    if (state.localResetInProgress) {
      state.localResetInProgress = false;
      return;
    }
    readSettingsForm();
    announce(t("settingsSaved"));
  });
  [$("#settings-dialog"), $("#records-dialog"), $("#result-dialog")].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
  });
  $("#question-form").addEventListener("submit", submitAnswers);
  $("#audio-progress").addEventListener("input", previewSeekFromControl);
  $("#audio-progress").addEventListener("change", (event) => commitSeekFromControl(event).catch(handleAudioError));
  $("#quick-speed").addEventListener("change", (event) => updateQuickSetting("playbackRate", Number(event.target.value)));

  player.addEventListener("time", ({ detail }) => updatePlayerTime(detail));
  player.addEventListener("state", ({ detail }) => updatePlayerState(detail.state));
  player.addEventListener("ended", ({ detail }) => handlePlaybackComplete(detail));
  player.addEventListener("segmentend", ({ detail }) => handlePlaybackComplete(detail));
  player.addEventListener("error", ({ detail }) => handleAudioError(detail.error));

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelOptionQueue();
      player.stop();
    }
  });
  window.addEventListener("pagehide", () => {
    cancelOptionQueue();
    player.stop();
  });
  window.addEventListener("popstate", () => restoreDeepLink({ focus: true }).catch(handleUiError));
  $("#sound-gate").addEventListener("cancel", () => focusScreenHeading("stage"));
  document.addEventListener("keydown", (event) => {
    const interactiveTarget = event.target instanceof Element && event.target.closest("button, a, input, select, textarea");
    if (event.key === "Escape" && !interactiveTarget && state.screen === "stage" && !$("#settings-dialog").open && !$("#records-dialog").open && !$("#sound-gate").open) {
      showMap(state.level).catch(handleUiError);
    }
  });
}

async function dispatchAction(action, target) {
  switch (action) {
    case "dashboard": return showScreen("dashboard");
    case "choose-level": return showLevels();
    case "continue": return openStage(stageId(state.progress.currentLevel, state.progress.currentStage));
    case "select-level": return showMap(Number(target.dataset.level));
    case "open-stage": return openStage(target.dataset.stageId);
    case "back-map": return showMap(state.level);
    case "open-settings": return openDialog($("#settings-dialog"));
    case "open-records": renderRecords(); return openDialog($("#records-dialog"));
    case "close-records": return closeDialog($("#records-dialog"));
    case "choose-mode": return chooseInitialMode(target.dataset.mode);
    case "text-mode": return enableTextMode();
    case "try-again": return resetQuestions();
    case "close-result": return closeDialog($("#result-dialog"));
    case "view-analysis": return showAnalysis();
    case "result-retry": closeDialog($("#result-dialog")); return resetQuestions();
    case "result-next": closeDialog($("#result-dialog")); return goToNextStage();
    case "next-stage": {
      return goToNextStage();
    }
    case "reset-progress": return resetProgress();
    default: return undefined;
  }
}

async function dispatchAudioAction(action, target) {
  if (!state.stage) return;
  if (action !== "retry" && !state.audioAvailable) throw new Error("Audio unavailable");
  if (action !== "retry") {
    cancelOptionQueue();
  }
  switch (action) {
    case "toggle":
      if (state.audioState === "playing") player.pause();
      else if (state.audioState === "paused") await player.resume();
      else await playScene(0);
      break;
    case "line": state.replayCount += 1; await playLine(target.dataset.lineId); break;
    case "token": state.replayCount += 1; await player.playToken(target.dataset.lineId, target.dataset.tokenId, target.dataset.audioId); break;
    case "option": await player.playOption(target.dataset.questionId, target.dataset.optionId, target.dataset.audioId); break;
    case "retry": await retryAudio(); break;
    default: break;
  }
  clearAudioError();
}

function handlePlaybackComplete(detail) {
  if (detail.context?.kind === "scene") {
    unlockQuestions();
    return;
  }
  if (detail.context?.kind === "option") continueOptionQueue();
}

function applyLanguage() {
  const lang = state.settings.uiLanguage;
  document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
  document.title = t("toolTitle");
  $("#ui-language").value = lang;
  $("#back-site").href = `../../index.html?lang=${encodeURIComponent(lang)}#resources`;
  $$('[data-i18n]').forEach((node) => { node.textContent = t(node.dataset.i18n); });
  $$('[data-i18n-aria-label]').forEach((node) => node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel)));
  syncSettingsControls();
  updatePlayerState(state.audioState);
  updateCloudStatus(state.cloudStatusKey || (cloud.signedIn ? "authCloud" : "authLocal"));
}

function renderCurrentScreen() {
  if (state.screen === "dashboard") renderDashboard();
  else if (state.screen === "levels") renderLevels();
  else if (state.screen === "map") renderMap();
  else if (state.screen === "stage" && state.stage) renderStage();
}

function beginNavigation() {
  navigationEpoch += 1;
  cancelOptionQueue();
  closeSoundGate();
  closeDialog($("#settings-dialog"));
  closeDialog($("#records-dialog"));
  closeDialog($("#result-dialog"));
  player.stop();
  return navigationEpoch;
}

function showScreen(name, options = {}) {
  beginNavigation();
  activateScreen(name, options);
}

function activateScreen(name, { historyMode = "push", historyQuery = "", focus = true } = {}) {
  state.screen = name;
  const names = ["dashboard", "level", "map", "stage"];
  names.forEach((screenName) => {
    const node = $(`#${screenName}-screen`);
    const active = screenName === (name === "levels" ? "level" : name);
    node.hidden = !active;
    node.classList.toggle("is-active", active);
  });
  if (name === "dashboard") {
    renderDashboard();
  }
  if (historyMode !== "none") writeHistory(historyQuery, historyMode);
  window.scrollTo({ top: 0, behavior: "auto" });
  if (focus) focusScreenHeading(name);
}

function renderDashboard() {
  const stats = progressStats(state.progress);
  const container = $("#dashboard-stats");
  replaceChildren(container, [
    statCard(`${state.progress.currentLevel}`, t("currentLevel")),
    statCard(`${state.progress.currentStage}/50`, t("currentStage")),
    statCard(`${stats.cleared}/250`, t("clearedStages")),
    statCard(`${stats.gold} / ${stats.silver} / ${stats.bronze}`, `${t("gold")} / ${t("silver")} / ${t("bronze")}`)
  ]);
}

function statCard(value, label) {
  return el("div", { className: "stat-card" }, el("strong", { text: value }), el("span", { text: label }));
}

async function showLevels({ historyMode = "push", focus = true } = {}) {
  const request = beginNavigation();
  const catalog = state.catalog || await loader.loadCatalog();
  if (request !== navigationEpoch) return;
  state.catalog = catalog;
  activateScreen("levels", { historyMode, historyQuery: "levels=1", focus });
  renderLevels();
}

function renderLevels() {
  const cards = state.catalog.levels.map((level) => {
    const unlocked = state.progress.unlockedStageIds.some((id) => parseStageId(id)?.level === level.level);
    const cleared = Object.entries(state.progress.stageProgress).filter(([id, value]) => parseStageId(id)?.level === level.level && value.cleared).length;
    const cover = safeToolAssetPath(level.cover || `assets/covers/level-${level.level}.webp`);
    const button = el("button", {
      className: `level-card${unlocked ? "" : " is-locked"}`,
      type: "button",
      disabled: !unlocked,
      dataset: { action: "select-level", level: String(level.level) }
    });
    button.append(
      el("img", { src: cover, width: 800, height: 600, alt: "", ariaHidden: "true", loading: "lazy" }),
      el("div", { className: "level-card-copy" },
        el("h3", { text: `${t("level")} ${level.level} · ${level.jlptTarget}` }),
        el("p", { text: localized(level.description, state.settings.uiLanguage, t("levelDescriptions")[level.level - 1]) })
      ),
      el("footer", {}, el("span", { text: `${cleared}/50` }), el("span", { text: unlocked ? t("unlocked") : t("locked") }))
    );
    return button;
  });
  replaceChildren($("#level-grid"), cards);
}

async function showMap(level, { historyMode = "push", focus = true } = {}) {
  const request = beginNavigation();
  const nextLevel = Math.min(5, Math.max(1, Number(level) || 1));
  setStatus(t("loading"));
  const levelIndex = await loader.loadLevel(nextLevel);
  if (request !== navigationEpoch) return;
  state.level = nextLevel;
  state.levelIndex = levelIndex;
  activateScreen("map", { historyMode, historyQuery: `level=${state.level}`, focus });
  renderMap();
  setStatus("READY");
}

function renderMap() {
  if (!state.levelIndex) return;
  $("#map-level-meta").textContent = `${t("level")} ${state.level} · ${state.levelIndex.jlptTarget}`;
  const currentId = stageId(state.progress.currentLevel, state.progress.currentStage);
  const nodes = state.levelIndex.stages.map((summary) => {
    const unlocked = state.progress.unlockedStageIds.includes(summary.id);
    const result = state.progress.stageProgress[summary.id];
    const classes = ["stage-tile"];
    if (!unlocked) classes.push("is-locked");
    if (result?.cleared) classes.push("is-cleared");
    if (summary.id === currentId) classes.push("is-current");
    const statuses = [];
    if (!unlocked) statuses.push(t("locked"));
    if (summary.id === currentId) statuses.push(t("current"));
    if (result?.cleared) statuses.push(t("cleared"));
    if (result?.medal && result.medal !== "none") statuses.push(t(result.medal));
    const tileLabel = localized(summary.shortLabel || summary.title, state.settings.uiLanguage);
    const button = el("button", {
      type: "button",
      className: classes.join(" "),
      disabled: !unlocked,
      dataset: { action: "open-stage", stageId: summary.id },
      ariaLabel: `${t("stage")} ${summary.stage}: ${localized(summary.title, state.settings.uiLanguage)}${statuses.length ? ` · ${statuses.join(" · ")}` : ""}`
    });
    button.append(
      el("strong", { text: String(summary.stage) }),
      el("small", { text: !unlocked ? t("locked") : (statuses.length ? `${statuses.join(" · ")} · ${tileLabel}` : tileLabel) })
    );
    return button;
  });
  replaceChildren($("#stage-map"), nodes);
}

async function openStage(id, { historyMode = "push", focus = true } = {}) {
  const parsed = parseStageId(id);
  if (!parsed || !state.progress.unlockedStageIds.includes(id)) return;
  const request = beginNavigation();
  setStatus(t("loading"));
  const [stage, audioError] = await Promise.all([
    loader.loadStage(id),
    ensureAudioManifest().then(() => null).catch((error) => error)
  ]);
  if (request !== navigationEpoch) return;
  state.level = parsed.level;
  state.stage = stage;
  state.questionUnlocked = state.settings.displayMode !== "listening";
  state.submitted = false;
  state.cleared = state.progress.stageProgress[id]?.cleared === true;
  state.attemptCleared = false;
  state.attemptMedal = "none";
  state.replayCount = 0;
  state.hintCount = 0;
  state.activeLineId = state.stage.lines[0]?.id || "";
  state.optionQueue = [];
  state.optionQueueRunning = false;
  state.draftAnswers = {};
  state.lastScore = null;
  state.analysisVisible = false;
  player.setStage(id);
  player.configure(state.settings);
  state.progress.currentLevel = parsed.level;
  state.progress.currentStage = parsed.stage;
  state.progress = saveProgress(state.progress);
  scheduleCloudSave();
  activateScreen("stage", { historyMode, historyQuery: `stage=${encodeURIComponent(id)}`, focus });
  renderStage();
  resetPlayerTimeline();
  if (audioError) showAudioError(audioError);
  else clearAudioError();
  setStatus(`${id} · ${state.stage.jlptTarget}`);
  loader.preloadNext(id);
  if (!hasCompletedModeOnboarding()) {
    openSoundGate();
  }
}

function renderStage() {
  const stage = state.stage;
  if (!stage) return;
  $("#stage-meta").textContent = `${stage.id} · ${stage.jlptTarget} · ${stage.genres.join(" / ")}`;
  $("#stage-heading").textContent = localized(stage.title, state.settings.uiLanguage);
  $("#scene-setting").textContent = localized(stage.setting, state.settings.uiLanguage);
  renderIllustration(stage);
  renderTranscript(stage);
  renderQuestions(stage);
  renderAnalysis(stage);
  updateQuestionGate();
  syncQuickControls();
}

function renderIllustration(stage) {
  const figure = $("#stage-illustration");
  const image = $("#stage-illustration-image");
  const safeSrc = stage.illustration?.enabled ? safeToolAssetPath(stage.illustration.src) : "";
  const cacheKey = shortContentHash(stage.contentHash);
  const src = safeSrc && cacheKey ? `${safeSrc}?v=${cacheKey}` : safeSrc;
  figure.hidden = !src;
  if (!src) {
    image.removeAttribute("src");
    image.alt = "";
    return;
  }
  image.src = src;
  image.alt = localized(stage.illustration.alt, state.settings.uiLanguage, t("illustrationAltFallback"));
}

function renderTranscript(stage) {
  const root = $("#transcript");
  if (state.settings.displayMode === "listening") {
    replaceChildren(root, [el("div", { className: "listening-placeholder", text: t("sentenceHidden") })]);
    return;
  }
  const cast = new Map(stage.cast.map((person) => [person.id, person]));
  const lines = stage.lines.map((line) => {
    const person = cast.get(line.speaker);
    const card = el("article", { className: `line-card${state.activeLineId === line.id ? " is-active" : ""}`, dataset: { lineId: line.id } });
    const copy = el("div", { className: "line-copy" });
    copy.append(el("button", {
      type: "button",
      className: "line-ja line-ja-trigger",
      text: line.text.ja,
      lang: "ja",
      dataset: { audioAction: "line", lineId: line.id },
      ariaLabel: `${t("playSentence")}: ${line.text.ja}`
    }));
    if (state.settings.kana) copy.append(el("p", { className: "line-reading", text: line.readingJa, lang: "ja" }));
    if (state.settings.displayMode === "bilingual" && state.settings.uiLanguage !== "ja") {
      copy.append(el("p", { className: "line-translation", text: localized(line.text, state.settings.uiLanguage) }));
    }
    const tokens = el("div", { className: "token-row" });
    line.tokens.forEach((token) => {
      tokens.append(el("button", {
        type: "button", className: "token-button", lang: "ja", dataset: { audioAction: "token", lineId: line.id, tokenId: token.id, audioId: token.audioId },
        ariaLabel: `${t("playChunk")}: ${token.text}`
      }, el("span", { text: token.text }), state.settings.kana ? el("small", { text: token.reading }) : null));
    });
    copy.append(tokens);
    card.append(
      el("div", { className: "speaker-name", text: localized(person?.name, state.settings.uiLanguage, line.speaker) }),
      copy
    );
    return card;
  });
  replaceChildren(root, lines);
}

function renderQuestions(stage) {
  const form = $("#question-form");
  captureDraftAnswers(form);
  const cards = stage.questions.map((question, questionIndex) => {
    const type = question.type === "multiple" ? "checkbox" : "radio";
    const card = el("fieldset", { className: "question-card", dataset: { questionId: question.id } });
    card.append(
      el("legend", { text: `${questionIndex + 1}. ${localized(question.prompt, state.settings.uiLanguage)}` }),
      el("p", { className: "question-hint", text: t(question.type === "multiple" ? "selectMany" : "selectOne") })
    );
    const list = el("div", { className: "option-list" });
    question.options.forEach((option, optionIndex) => {
      const inputId = `${stage.id}-${question.id}-${option.id}`;
      const optionMarker = String.fromCharCode(65 + optionIndex);
      const label = el("label", { className: "option-label", htmlFor: inputId });
      const selected = state.draftAnswers[question.id]?.includes(option.id) === true;
      const input = el("input", { id: inputId, type, name: question.id, value: option.id, checked: selected, disabled: !state.questionUnlocked || state.submitted });
      const optionText = state.settings.optionText ? localized(option.text, state.settings.optionLanguage) : t("optionHidden");
      label.append(input, el("span", { className: "option-copy" },
        el("strong", { className: "option-marker", text: `${optionMarker}.` }),
        el("span", { text: optionText, lang: state.settings.optionLanguage === "ja" ? "ja" : undefined })
      ));
      if (state.submitted) {
        const correct = question.correctOptionIds.includes(option.id);
        label.classList.toggle("is-correct", correct);
        label.classList.toggle("is-wrong", selected && !correct);
        if (correct || selected) label.setAttribute("aria-label", `${optionMarker}. ${optionText} · ${t(correct ? "correctAnswer" : "yourWrongChoice")}`);
      }
      const row = el("div", { className: "option-row" }, label);
      if (state.settings.optionAudio) {
        row.append(el("button", {
          type: "button", className: "xp-control compact option-audio", text: "▶", disabled: !state.questionUnlocked,
          dataset: { audioAction: "option", questionId: question.id, optionId: option.id, audioId: option.audioId },
          ariaLabel: `${t("playOption")} ${optionMarker}`
        }));
      }
      list.append(row);
    });
    card.append(list);
    return card;
  });
  replaceChildren(form, cards);
  form.hidden = !state.questionUnlocked;
  $("#submit-answers").hidden = !state.questionUnlocked || state.submitted;
}

function renderAnalysis(stage) {
  const entries = stage.questions.map((question, index) => {
    const grid = el("div", { className: "analysis-grid" });
    ["literal", "intent", "evidence", "nuance", "alternative"].forEach((key) => {
      grid.append(el("div", { className: "analysis-row" },
        el("strong", { text: t(key) }),
        el("p", { text: localized(question.explanation[key], state.settings.uiLanguage) })
      ));
    });
    return el("article", { className: "analysis-entry" }, el("h4", { text: `${index + 1}. ${localized(question.prompt, state.settings.uiLanguage)}` }), grid);
  });
  replaceChildren($("#analysis-content"), entries);
  $("#analysis-panel").hidden = !state.submitted || !state.analysisVisible;
}

function updateQuestionGate() {
  const gate = $("#question-gate");
  if (state.questionUnlocked) {
    gate.hidden = true;
    $("#question-gate-copy").textContent = t("enableQuestions");
    return;
  }
  gate.hidden = false;
  replaceChildren(gate, [
    el("p", { text: t("answerAfterListening") }),
    el("button", { type: "button", className: "xp-control", dataset: { action: "text-mode" }, text: t("textModeContinue") })
  ]);
  $("#question-gate-copy").textContent = t("answerAfterListening");
}

function unlockQuestions() {
  if (state.questionUnlocked || !state.stage) return;
  state.questionUnlocked = true;
  renderQuestions(state.stage);
  updateQuestionGate();
  announce(t("enableQuestions"));
  if (state.settings.autoReadOptions && state.settings.optionAudio) beginOptionQueue();
}

function enableTextMode() {
  return chooseInitialMode("japanese", { countHint: true });
}

function submitAnswers(event) {
  event.preventDefault();
  if (!state.stage || !state.questionUnlocked || state.submitted) return;
  const formData = new FormData(event.currentTarget);
  state.draftAnswers = Object.fromEntries(state.stage.questions.map((question) => [question.id, formData.getAll(question.id).map(String)]));
  let correctCount = 0;
  state.stage.questions.forEach((question) => {
    const selected = new Set(formData.getAll(question.id).map(String));
    const correct = new Set(question.correctOptionIds);
    const questionCorrect = setsEqual(selected, correct);
    if (questionCorrect) correctCount += 1;
  });

  const score = Math.round((correctCount / state.stage.questions.length) * 100);
  state.lastScore = score;
  state.attemptCleared = correctCount === state.stage.questions.length;
  const previousAttempts = state.progress.stageProgress[state.stage.id]?.attempts || 0;
  state.attemptMedal = state.attemptCleared
    ? (state.settings.displayMode === "listening" && previousAttempts === 0 && score === 100
      ? "gold"
      : state.settings.displayMode === "bilingual" ? "bronze" : "silver")
    : "none";
  state.submitted = true;
  state.progress = recordAttempt(state.progress, state.stage.id, {
    score,
    cleared: state.attemptCleared,
    displayMode: state.settings.displayMode,
    kana: state.settings.kana,
    replayCount: state.replayCount,
    hintCount: state.hintCount
  });
  state.cleared = state.progress.stageProgress[state.stage.id]?.cleared === true;
  state.progress = saveProgress(state.progress);
  scheduleCloudSave();
  state.analysisVisible = false;
  renderQuestions(state.stage);
  renderAnalysis(state.stage);
  renderResultDialog();
  openDialog($("#result-dialog"));
  announce($("#answer-result").textContent);
}

function resetQuestions() {
  state.submitted = false;
  state.attemptCleared = false;
  state.attemptMedal = "none";
  state.draftAnswers = {};
  state.lastScore = null;
  state.analysisVisible = false;
  $("#question-form").reset();
  renderQuestions(state.stage);
  $("#analysis-panel").hidden = true;
  $("#question-form input:not(:disabled)")?.focus();
}

function renderResultDialog() {
  const result = $("#answer-result");
  const medal = $("#result-medal");
  result.className = `answer-result ${state.attemptCleared ? "is-success" : "is-error"}`;
  result.textContent = `${state.lastScore}% · ${t(state.attemptCleared ? "allCorrect" : "notAllCorrect")}`;
  medal.className = `result-medal medal-${state.attemptMedal}`;
  medal.textContent = state.attemptMedal === "none"
    ? t("noMedal")
    : `${t("resultMedal")}: ${t(state.attemptMedal)}`;
  $("#result-next").hidden = !state.attemptCleared;
  $("#result-retry").hidden = state.attemptCleared;
}

function showAnalysis() {
  closeDialog($("#result-dialog"));
  state.analysisVisible = true;
  renderAnalysis(state.stage);
  requestAnimationFrame(() => {
    const heading = $("#analysis-heading");
    heading?.focus({ preventScroll: true });
    $("#analysis-panel")?.scrollIntoView({ block: "start", behavior: "auto" });
  });
}

function goToNextStage() {
  const next = nextStageId(state.stage?.id);
  return next ? openStage(next) : showScreen("dashboard");
}

function chooseInitialMode(mode, { countHint = false } = {}) {
  if (!["listening", "japanese", "bilingual"].includes(mode)) return;
  player.unlock();
  closeSoundGate();
  markModeOnboardingComplete();
  if (countHint) state.hintCount += 1;
  state.settings.displayMode = mode;
  state.settings.autoplay = false;
  state.settings.muted = false;
  persistSettings();
  player.configure(state.settings);
  state.questionUnlocked = mode !== "listening";
  if (state.stage) renderStage();
  focusScreenHeading("stage");
}

async function playScene(start = 0) {
  state.activeLineId = state.stage?.lines[0]?.id || "";
  if (player.isSceneLoaded() && player.seek(start)) {
    await player.resume();
    return;
  }
  await player.playScene({ start });
}

async function playLine(id) {
  if (!id) return;
  state.activeLineId = id;
  highlightLine(id);
  await player.playLine(id);
}

function seekTarget(event) {
  const duration = player.sceneDuration() || (player.isSceneLoaded() ? player.audio?.duration : 0);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  return (Number(event.target.value) / 1000) * duration;
}

function previewSeekFromControl(event) {
  const target = seekTarget(event);
  if (target === null) return;
  $("#current-time").textContent = formatTime(target);
  player.seek(target);
}

async function commitSeekFromControl(event) {
  const target = seekTarget(event);
  if (target === null) return;
  if (player.seek(target)) await player.resume();
  else await player.playScene({ start: target });
}

function updatePlayerTime(detail) {
  $("#current-time").textContent = formatTime(detail.currentTime);
  $("#total-time").textContent = formatTime(detail.duration);
  $("#audio-progress").value = detail.duration > 0 ? String(Math.round((detail.currentTime / detail.duration) * 1000)) : "0";
  if (detail.lineId && detail.lineId !== state.activeLineId) {
    state.activeLineId = detail.lineId;
    highlightLine(detail.lineId);
  }
}

function resetPlayerTimeline() {
  $("#current-time").textContent = "0:00";
  $("#total-time").textContent = formatTime(player.sceneDuration());
  $("#audio-progress").value = "0";
}

function updatePlayerState(value) {
  state.audioState = value;
  const toggle = $('[data-audio-action="toggle"]');
  if (toggle) toggle.textContent = t(value === "playing" ? "pause" : value === "paused" ? "resume" : "play");
  const message = $("#audio-message");
  if (message.classList.contains("is-error")) message.textContent = t("audioUnavailable");
  else message.textContent = value === "playing" ? t("play") : value === "paused" ? t("pause") : t("audioReady");
}

function highlightLine(id) {
  const lines = $$(".line-card");
  lines.forEach((node) => node.classList.toggle("is-active", node.dataset.lineId === id));
}

function beginOptionQueue() {
  state.optionQueue = state.stage.questions.flatMap((question) => question.options.map((option) => ({ question, option })));
  state.optionQueueRunning = true;
  continueOptionQueue();
}

function cancelOptionQueue() {
  state.optionQueueRunning = false;
  state.optionQueue = [];
}

function continueOptionQueue() {
  if (!state.optionQueueRunning) return;
  const next = state.optionQueue.shift();
  if (!next) {
    cancelOptionQueue();
    return;
  }
  player.playOption(next.question.id, next.option.id, next.option.audioId).catch((error) => {
    cancelOptionQueue();
    handleAudioError(error);
  });
}

async function retryAudio() {
  const manifestIsValid = Boolean(player.manifest);
  state.audioAvailable = false;
  player.stop();
  if (!manifestIsValid) {
    audioManifestPromise = null;
    await ensureAudioManifest();
  } else {
    state.audioAvailable = true;
  }
  clearAudioError();
  if (state.stage) await playScene(0);
}

async function ensureAudioManifest() {
  if (player.manifest) {
    state.audioAvailable = true;
    return player.manifest;
  }
  if (!audioManifestPromise) {
    audioManifestPromise = player.loadManifest().catch((error) => {
      audioManifestPromise = null;
      throw error;
    });
  }
  const manifest = await audioManifestPromise;
  state.audioAvailable = true;
  return manifest;
}

function handleAudioError(error) {
  if (error?.name === "AbortError") return;
  console.warn(error);
  showAudioError(error);
}

function showAudioError() {
  cancelOptionQueue();
  // A failed sentence/token/option must not disable a valid scene manifest.
  // Only manifest-level failure switches the entire tool to text fallback.
  state.audioAvailable = Boolean(player.manifest);
  const message = $("#audio-message");
  message.textContent = t("audioUnavailable");
  message.classList.add("is-error");
  $("#audio-error-actions").hidden = false;
  announce(t("audioUnavailable"));
}

function clearAudioError() {
  $("#audio-error-actions").hidden = true;
  $("#audio-message").classList.remove("is-error");
  updatePlayerState(state.audioState);
}

function syncSettingsControls() {
  const form = $("#settings-form");
  if (!form) return;
  ["displayMode", "optionLanguage", "playbackRate"].forEach((name) => {
    const input = form.elements[name];
    if (input) input.value = String(state.settings[name]);
  });
  ["kana", "optionText", "optionAudio", "autoReadOptions"].forEach((name) => {
    const input = form.elements[name];
    if (input) input.checked = state.settings[name] === true;
  });
  syncQuickControls();
}

function syncQuickControls() {
  $("#quick-speed").value = String(state.settings.playbackRate);
}

function readSettingsForm() {
  const form = $("#settings-form");
  const data = new FormData(form);
  state.settings = {
    ...state.settings,
    displayMode: String(data.get("displayMode") || state.settings.displayMode),
    optionLanguage: String(data.get("optionLanguage") || state.settings.optionLanguage),
    playbackRate: Number(data.get("playbackRate") || state.settings.playbackRate),
    kana: form.elements.kana.checked,
    optionText: form.elements.optionText.checked,
    optionAudio: form.elements.optionAudio.checked,
    autoReadOptions: form.elements.autoReadOptions.checked,
    autoplay: false,
    muted: false
  };
  persistSettings();
  player.configure(state.settings);
  if ((!state.settings.optionAudio || !state.settings.autoReadOptions) && state.optionQueueRunning) {
    cancelOptionQueue();
    if (player.context?.kind === "option") player.stop();
  }
  if (state.stage && state.settings.displayMode !== "listening") {
    state.questionUnlocked = true;
  }
  syncQuickControls();
  if (state.stage) renderStage();
}

function updateQuickSetting(key, value) {
  state.settings[key] = value;
  persistSettings();
  player.configure(state.settings);
  syncSettingsControls();
}

function persistSettings() {
  state.settings = saveSettings(state.settings);
  scheduleCloudSave();
}

async function mergeCloudProgress() {
  try {
    const merged = await cloud.loadAndMerge(state.progress, state.settings);
    if (!merged.signedIn) return;
    // The request runs in the background. Merge once more with the live state
    // so answers or preference changes made while it was in flight are never
    // overwritten by the older snapshot passed to loadAndMerge().
    state.progress = saveProgress(mergeProgress(state.progress, merged.progress));
    state.settings = saveSettings(mergeSettings(state.settings, merged.settings, state.settings.uiLanguage));
    if (state.stage) state.cleared = state.progress.stageProgress[state.stage.id]?.cleared === true;
    state.settings.autoplay = false;
    state.settings.muted = false;
    player.configure(state.settings);
    applyLanguage();
    renderCurrentScreen();
    updateCloudStatus("authCloud");
    scheduleCloudSave();
  } catch (error) {
    console.warn(error);
    updateCloudStatus("cloudUnavailable");
  }
}

function scheduleCloudSave() {
  if (!cloud.signedIn) return;
  updateCloudStatus("syncing");
  cloud.schedule(state.progress, state.settings, (error) => updateCloudStatus(error ? "cloudUnavailable" : "synced"));
}

function updateCloudStatus(key) {
  state.cloudStatusKey = key;
  $("#cloud-status").textContent = t(key);
}

function renderRecords() {
  const root = $("#records-content");
  const entries = Object.entries(state.progress.stageProgress)
    .filter(([, value]) => value.cleared)
    .sort(([a], [b]) => b.localeCompare(a));
  const children = [el("p", { text: t("recordsSummary") })];
  if (!entries.length) children.push(el("p", { text: t("emptyRecord") }));
  entries.forEach(([id, value]) => {
    children.push(el("article", { className: "analysis-entry" },
      el("h4", { text: `${id} · ${t(value.medal)}` }),
      el("p", { text: `${t("bestScore")}: ${value.bestScore}% · ${t("firstAccuracy")}: ${value.firstAccuracy}% · ${t("attempts")}: ${value.attempts} · ${t("replayCount")}: ${value.replayCount}` }),
      value.firstClearMode ? el("p", { text: `${t("displayMode")}: ${t(value.firstClearMode)}` }) : null
    ));
  });
  replaceChildren(root, children);
}

function resetProgress() {
  if (!confirm(t("resetConfirm"))) return;
  const retainedSettings = state.settings;
  const reset = resetLocalState(undefined, state.settings.uiLanguage);
  state.settings = saveSettings(retainedSettings);
  state.progress = reset.progress;
  player.configure(state.settings);
  applyLanguage();
  syncSettingsControls();
  state.localResetInProgress = true;
  closeDialog($("#settings-dialog"));
  showScreen("dashboard");
}

async function restoreDeepLink({ focus = true } = {}) {
  if (!state.catalog) return;
  const query = new URLSearchParams(location.search);
  const routeLanguage = query.get("lang");
  if (["zh", "en", "ja"].includes(routeLanguage) && routeLanguage !== state.settings.uiLanguage) {
    state.settings = saveSettings({ ...state.settings, uiLanguage: routeLanguage });
    player.configure(state.settings);
    applyLanguage();
  }
  const stage = query.get("stage") || "";
  const level = Number(query.get("level"));
  if (parseStageId(stage) && state.progress.unlockedStageIds.includes(stage)) await openStage(stage, { historyMode: "none", focus });
  else if (level >= 1 && level <= 5) await showMap(level, { historyMode: "none", focus });
  else if (query.has("levels")) await showLevels({ historyMode: "none", focus });
  else showScreen("dashboard", { historyMode: "none", focus });
}

function currentHistoryQuery() {
  if (state.screen === "levels") return "levels=1";
  if (state.screen === "map") return `level=${state.level}`;
  if (state.screen === "stage" && state.stage) return `stage=${encodeURIComponent(state.stage.id)}`;
  return "";
}

function writeHistory(query, mode = "push") {
  const params = new URLSearchParams();
  params.set("lang", state.settings.uiLanguage);
  if (query) {
    const extra = new URLSearchParams(query);
    extra.forEach((value, key) => params.set(key, value));
  }
  const next = `${location.pathname}?${params.toString()}`;
  if (`${location.pathname}${location.search}` === next) return;
  if (mode === "replace") history.replaceState({}, "", next);
  else history.pushState({}, "", next);
}

function openDialog(dialog) {
  if (!dialog || dialog.open) return;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (!dialog?.open && !dialog?.hasAttribute("open")) return;
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function openSoundGate() {
  const gate = $("#sound-gate");
  openDialog(gate);
  requestAnimationFrame(() => gate.querySelector("[data-action='unlock-sound']")?.focus());
}

function closeSoundGate() {
  closeDialog($("#sound-gate"));
}

function focusScreenHeading(name) {
  const ids = { dashboard: "dashboard-heading", levels: "level-heading", map: "map-heading", stage: "stage-heading" };
  requestAnimationFrame(() => {
    if ($("#sound-gate")?.open) return;
    const heading = document.getElementById(ids[name]);
    if (heading && !heading.closest("[hidden]")) heading.focus({ preventScroll: true });
  });
}

function setStatus(value) {
  $("#status-text").textContent = value;
}

function announce(value) {
  $("#live-region").textContent = "";
  requestAnimationFrame(() => { $("#live-region").textContent = value; });
}

function handleUiError(error) {
  console.error(error);
  setStatus(t("loadFailed"));
  announce(t("loadFailed"));
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) return;
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "dataset") Object.entries(value).forEach(([name, data]) => { node.dataset[name] = data; });
    else if (key === "ariaLabel") node.setAttribute("aria-label", value);
    else if (key === "ariaHidden") node.setAttribute("aria-hidden", value);
    else if (key === "htmlFor") node.htmlFor = value;
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  });
  children.flat().filter(Boolean).forEach((child) => node.append(child));
  return node;
}

function replaceChildren(root, children) {
  root.replaceChildren(...children.filter(Boolean));
}

function setsEqual(a, b) {
  return a.size === b.size && [...a].every((value) => b.has(value));
}

function captureDraftAnswers(form) {
  if (!form || !state.stage || state.submitted) return;
  const data = new FormData(form);
  const selected = {};
  for (const question of state.stage.questions) {
    selected[question.id] = data.getAll(question.id).map(String);
  }
  if (Object.values(selected).some((values) => values.length)) state.draftAnswers = selected;
}
