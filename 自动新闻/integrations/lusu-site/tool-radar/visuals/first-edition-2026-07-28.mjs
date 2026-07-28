import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// First-edition-only renderer for the 2026-07-28 Tool Radar review.
// It intentionally hardcodes this edition's seven selected tools and must not be
// treated as the reusable weekly visual workflow. Future editions need a new
// evidence-backed visual brief and their own edition-scoped renderer or assets.
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../../../../..");
const defaultOutputDirectory = path.join(
  projectRoot,
  "assets",
  "images",
  "articles",
  "tool-radar",
  "2026-07-28"
);
const outputDirectory = path.resolve(
  process.argv[2] || defaultOutputDirectory
);
const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.LOCALAPPDATA
    ? path.join(
        process.env.LOCALAPPDATA,
        "Google",
        "Chrome",
        "Application",
        "chrome.exe"
      )
    : null
].filter(Boolean);
const chromePath = chromeCandidates.find((candidate) => (
  fs.existsSync(candidate)
));

if (!chromePath) {
  throw new Error(
    "Google Chrome was not found. Set CHROME_PATH to a Chrome executable."
  );
}

const figures = [
  {
    slug: "60fps",
    file: "60fps-explainer.png",
    index: "01",
    claim: "MOTION → BRIEF",
    steps: [
      { label: "SEE", symbol: "◉" },
      { label: "MAP", symbol: "⌁", visual: "motion" },
      { label: "EXPLAIN", symbol: "✓" }
    ],
    result: "SEE → NAME → BUILD",
    palette: ["#155EEF", "#6D5CE7", "#FF6F91", "#EAF2FF"]
  },
  {
    slug: "mobbin",
    file: "mobbin-explainer.png",
    index: "02",
    claim: "FLOW → PRODUCT PLAN",
    steps: [
      { label: "GOAL", symbol: "◎" },
      { label: "COMPARE", symbol: "⇄", visual: "flows" },
      { label: "PLAN", symbol: "✓" }
    ],
    result: "GOAL → PATTERNS → PLAN",
    palette: ["#111827", "#4F46E5", "#FF7A59", "#F2F0FF"]
  },
  {
    slug: "chatcut",
    file: "chatcut-explainer.png",
    index: "03",
    claim: "PROMPT → TIMELINE",
    steps: [
      { label: "FOOTAGE", symbol: "▶" },
      { label: "EDIT", symbol: "✂", visual: "timeline" },
      { label: "TIMELINE", symbol: "≋" }
    ],
    result: "ASK → EDIT → REFINE",
    palette: ["#F05A28", "#8B5CF6", "#14B8A6", "#FFF0E9"]
  },
  {
    slug: "remotion",
    file: "remotion-explainer.png",
    index: "04",
    claim: "RULES → VIDEO",
    steps: [
      { label: "ASSETS", symbol: "◇" },
      { label: "CODE", symbol: "</>", visual: "code-video" },
      { label: "RENDER", symbol: "▶" }
    ],
    result: "BUILD ONCE → RENDER MANY",
    palette: ["#2563EB", "#0EA5E9", "#FACC15", "#ECF7FF"]
  },
  {
    slug: "repomix",
    file: "repomix-explainer.png",
    index: "05",
    claim: "REPO → AI CONTEXT",
    steps: [
      { label: "FILES", symbol: "{ }" },
      { label: "PACK", symbol: "⇥", visual: "repo-pack" },
      { label: "CONTEXT", symbol: "▤" }
    ],
    result: "FILES → ONE CONTEXT",
    palette: ["#F97316", "#334155", "#22C55E", "#FFF4E8"]
  },
  {
    slug: "context7",
    file: "context7-explainer.png",
    index: "06",
    claim: "VERSION → CURRENT DOCS",
    steps: [
      { label: "LIB + VER", symbol: "@" },
      { label: "FIND", symbol: "⌕", visual: "docs" },
      { label: "CURRENT API", symbol: "✓" }
    ],
    result: "VERSION → DOCS → CODE",
    palette: ["#047857", "#10B981", "#38BDF8", "#E9FFF7"]
  },
  {
    slug: "pinokio",
    file: "pinokio-explainer.png",
    index: "07",
    claim: "SOURCE → LOCAL APP",
    steps: [
      { label: "CHOOSE", symbol: "◎" },
      { label: "INSTALL", symbol: "↓", visual: "install" },
      { label: "RUN + LOGS", symbol: "▶" }
    ],
    result: "CHECK → INSTALL → RUN",
    palette: ["#1D4ED8", "#0891B2", "#A3E635", "#EAF8FF"]
  }
];
const displayNames = {
  "60fps": "60fps",
  mobbin: "Mobbin",
  chatcut: "ChatCut",
  remotion: "Remotion",
  repomix: "Repomix",
  context7: "Context7",
  pinokio: "Pinokio"
};

const sleep = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderSteps(steps) {
  return steps
    .map((step, stepIndex) => {
      const number = String(stepIndex + 1).padStart(2, "0");
      const card = `
        <section
          class="step-card${stepIndex === 1 ? " step-card-focus" : ""}"
          data-qa="step-${number}"
        >
          <span class="step-number">${number}</span>
          <strong class="step-symbol" aria-hidden="true">${escapeHtml(step.symbol)}</strong>
          <h2 data-mobile-core>${escapeHtml(step.label)}</h2>
        </section>`;
      if (stepIndex === steps.length - 1) {
        return card;
      }
      return `${card}
        <div class="connector" aria-hidden="true">
          <i></i><b>→</b>
        </div>`;
    })
    .join("");
}

function renderFigure(figure) {
  const [ink, accent, highlight, soft] = figure.palette;
  return `
    <article
      class="figure"
      data-figure="${escapeHtml(figure.slug)}"
      style="--ink:${ink};--accent:${accent};--highlight:${highlight};--soft:${soft}"
    >
      <div class="figure-grid" aria-hidden="true"></div>
      <div class="big-index" aria-hidden="true">${figure.index}</div>
      <div class="figure-inner">
        <div class="topline">
          <div class="origin-label">
            <i></i>
            <span>ORIGINAL / 2026-07-28</span>
          </div>
          <div class="not-ui">CONCEPT / NOT PRODUCT UI</div>
          <div class="counter">${figure.index} / 07</div>
        </div>

        <header class="figure-hero">
          <div class="hero-copy" data-qa="hero-copy">
            <div class="tool-line">
              <strong data-mobile-core>${escapeHtml(displayNames[figure.slug])}</strong>
            </div>
            <h1 data-mobile-core>${escapeHtml(figure.claim)}</h1>
          </div>
        </header>

        <div class="flow-stage" data-qa="flow-stage">
          ${renderSteps(figure.steps)}
        </div>

        <div class="result-bar" data-qa="result-bar">
          <span aria-hidden="true">✓</span>
          <strong data-mobile-core>${escapeHtml(figure.result)}</strong>
        </div>

        <footer class="figure-footer">
          <span>TOOL RADAR / FIRST EDITION</span>
          <span>ONE CLAIM / THREE STEPS</span>
          <span>CONCEPT ONLY</span>
        </footer>
      </div>
    </article>`;
}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=1200, initial-scale=1">
  <title>Tool Radar First Edition Explainers</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 1200px;
      background: #dcecff;
    }
    body {
      font-family:
        "Segoe UI",
        "Cascadia Sans",
        Arial,
        sans-serif;
    }
    .figure {
      position: relative;
      width: 1200px;
      height: 675px;
      padding: 28px 40px 22px;
      overflow: hidden;
      color: #17223b;
      background:
        radial-gradient(circle at 8% 7%, color-mix(in srgb, var(--highlight) 23%, transparent), transparent 25%),
        radial-gradient(circle at 91% 5%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 23%),
        linear-gradient(145deg, #ffffff 0%, var(--soft) 58%, #f8fbff 100%);
      isolation: isolate;
    }
    .figure + .figure { margin-top: 24px; }
    .figure::before,
    .figure::after {
      content: "";
      position: absolute;
      z-index: -1;
      pointer-events: none;
    }
    .figure::before {
      width: 330px;
      height: 330px;
      right: -160px;
      bottom: -170px;
      border: 54px solid color-mix(in srgb, var(--accent) 12%, transparent);
      border-radius: 50%;
    }
    .figure::after {
      width: 120px;
      height: 120px;
      left: -48px;
      top: 220px;
      border: 20px solid color-mix(in srgb, var(--highlight) 13%, transparent);
      transform: rotate(18deg);
    }
    .figure-grid {
      position: absolute;
      inset: 0;
      z-index: -2;
      opacity: .22;
      background-image:
        linear-gradient(color-mix(in srgb, var(--ink) 13%, transparent) 1px, transparent 1px),
        linear-gradient(90deg, color-mix(in srgb, var(--ink) 13%, transparent) 1px, transparent 1px);
      background-size: 24px 24px;
      mask-image: linear-gradient(115deg, #000 0%, transparent 52%);
    }
    .big-index {
      position: absolute;
      right: 27px;
      top: 53px;
      z-index: -1;
      color: color-mix(in srgb, var(--ink) 8%, transparent);
      font: 900 180px/1 "Arial Black", Arial, sans-serif;
      letter-spacing: -.1em;
    }
    .figure-inner {
      position: relative;
      z-index: 1;
      height: 100%;
      display: grid;
      grid-template-rows: 28px 122px 318px 60px 24px;
      align-content: space-between;
    }
    .topline {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .08em;
    }
    .origin-label,
    .not-ui,
    .counter {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      border-radius: 999px;
      white-space: nowrap;
    }
    .origin-label {
      gap: 8px;
      padding: 5px 12px 5px 7px;
      color: #fff;
      background: var(--ink);
      box-shadow: 0 5px 14px color-mix(in srgb, var(--ink) 20%, transparent);
    }
    .origin-label i {
      width: 15px;
      height: 15px;
      border: 4px solid #fff;
      border-radius: 4px;
      box-shadow: inset 0 0 0 2px var(--highlight);
      transform: rotate(8deg);
    }
    .not-ui {
      padding: 5px 11px;
      color: var(--ink);
      border: 1px solid color-mix(in srgb, var(--ink) 22%, #fff);
      background: rgba(255,255,255,.72);
    }
    .counter {
      margin-left: auto;
      padding: 5px 11px;
      color: var(--ink);
      background: color-mix(in srgb, var(--highlight) 19%, #fff);
      font-family: "Cascadia Mono", Consolas, monospace;
    }
    .figure-hero {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 28px;
      min-width: 0;
    }
    .hero-copy { min-width: 0; }
    .tool-line {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 9px;
    }
    .tool-line strong {
      color: var(--ink);
      font-size: 23px;
      line-height: 1;
      letter-spacing: -.03em;
    }
    .tool-line span {
      padding: 4px 9px;
      color: color-mix(in srgb, var(--ink) 85%, #314766);
      border-radius: 5px;
      background: color-mix(in srgb, var(--accent) 13%, #fff);
      font-size: 12px;
      font-weight: 800;
    }
    h1 {
      margin: 0;
      color: #16213b;
      font-size: 40px;
      line-height: 1.14;
      letter-spacing: -.045em;
      white-space: nowrap;
    }
    .takeaway {
      flex: 0 0 300px;
      min-height: 82px;
      padding: 13px 16px;
      border: 1px solid color-mix(in srgb, var(--ink) 18%, #fff);
      border-radius: 17px;
      background: rgba(255,255,255,.78);
      box-shadow:
        5px 6px 0 color-mix(in srgb, var(--accent) 11%, transparent),
        inset 1px 1px 0 #fff;
    }
    .takeaway span {
      display: block;
      margin-bottom: 7px;
      color: var(--accent);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .12em;
    }
    .takeaway strong {
      display: block;
      color: #263452;
      font-size: 18px;
      line-height: 1.42;
    }
    .flow-stage {
      display: grid;
      grid-template-columns: 300px 56px 368px 56px 300px;
      align-items: stretch;
      min-width: 0;
      height: 318px;
    }
    .flow-card {
      position: relative;
      min-width: 0;
      height: 318px;
      padding: 20px 20px 17px;
      overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--ink) 17%, #fff);
      border-radius: 22px;
      background: rgba(255,255,255,.82);
      box-shadow:
        0 13px 30px color-mix(in srgb, var(--ink) 10%, transparent),
        inset 1px 1px 0 #fff;
    }
    .flow-card::after {
      content: "";
      position: absolute;
      width: 105px;
      height: 105px;
      right: -52px;
      top: -48px;
      border: 18px solid color-mix(in srgb, var(--accent) 9%, transparent);
      border-radius: 50%;
    }
    .process-card {
      padding-inline: 23px;
      color: #fff;
      border: 0;
      background:
        linear-gradient(145deg, var(--ink), color-mix(in srgb, var(--accent) 74%, #101b3a));
      box-shadow:
        0 18px 36px color-mix(in srgb, var(--ink) 22%, transparent),
        inset 1px 1px 0 rgba(255,255,255,.24);
    }
    .process-card::after {
      border-color: rgba(255,255,255,.09);
    }
    .card-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 24px;
      margin-bottom: 14px;
    }
    .card-meta span {
      padding: 4px 7px;
      border-radius: 4px;
      color: #fff;
      background: var(--accent);
      font: 800 10px/1.2 "Cascadia Mono", Consolas, monospace;
      letter-spacing: .08em;
    }
    .card-meta b {
      color: #65728b;
      font-size: 12px;
    }
    .process-card .card-meta span {
      color: var(--ink);
      background: var(--highlight);
    }
    .process-card .card-meta b { color: rgba(255,255,255,.72); }
    .flow-card h2 {
      position: relative;
      z-index: 1;
      margin: 0 0 8px;
      color: #1c2945;
      font-size: 25px;
      line-height: 1.3;
      letter-spacing: -.035em;
    }
    .process-card h2 { color: #fff; }
    .flow-card p {
      position: relative;
      z-index: 1;
      margin: 0;
      color: #586781;
      font-size: 15px;
      line-height: 1.62;
    }
    .process-card p { color: rgba(255,255,255,.78); }
    .chip-cloud {
      position: absolute;
      left: 20px;
      right: 20px;
      bottom: 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      align-content: flex-end;
      min-height: 74px;
      padding: 12px;
      border: 1px dashed color-mix(in srgb, var(--ink) 23%, #fff);
      border-radius: 14px;
      background: color-mix(in srgb, var(--soft) 72%, #fff);
    }
    .chip-cloud span {
      display: inline-flex;
      align-items: center;
      min-height: 27px;
      padding: 5px 9px;
      color: #33435f;
      border: 1px solid color-mix(in srgb, var(--accent) 18%, #fff);
      border-radius: 6px;
      background: #fff;
      font-size: 12px;
      font-weight: 800;
      box-shadow: 2px 2px 0 color-mix(in srgb, var(--accent) 9%, transparent);
    }
    .process-visual {
      position: absolute;
      left: 23px;
      right: 23px;
      bottom: 19px;
      height: 105px;
      padding: 12px;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 15px;
      background: rgba(255,255,255,.09);
      box-shadow: inset 1px 1px 0 rgba(255,255,255,.08);
    }
    .connector {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--accent);
    }
    .connector span {
      margin-bottom: 7px;
      font: 800 10px/1 "Cascadia Mono", Consolas, monospace;
      letter-spacing: .08em;
    }
    .connector i {
      width: 32px;
      height: 2px;
      background: color-mix(in srgb, var(--accent) 45%, #b8c6dc);
    }
    .connector b {
      margin-top: -14px;
      margin-left: 29px;
      font-size: 25px;
      line-height: 1;
    }
    .saved-bar {
      display: flex;
      align-items: center;
      gap: 13px;
      min-width: 0;
      height: 60px;
      padding: 10px 16px;
      border: 1px solid color-mix(in srgb, var(--ink) 17%, #fff);
      border-radius: 15px;
      background: rgba(255,255,255,.8);
      box-shadow: inset 1px 1px 0 #fff;
    }
    .saved-icon {
      display: grid;
      flex: 0 0 34px;
      width: 34px;
      height: 34px;
      place-items: center;
      color: #fff;
      border-radius: 9px;
      background: var(--highlight);
      box-shadow: 3px 3px 0 color-mix(in srgb, var(--highlight) 25%, transparent);
      font: 900 24px/1 Arial, sans-serif;
    }
    .saved-bar span {
      flex: none;
      color: var(--accent);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: .08em;
    }
    .saved-bar strong {
      min-width: 0;
      color: #273652;
      font-size: 18px;
      letter-spacing: -.01em;
      white-space: nowrap;
    }
    .figure-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-width: 0;
      color: #6a768c;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .04em;
    }
    .figure-footer span:first-child {
      color: var(--ink);
      font-weight: 900;
    }

    /* Original, generic process drawings. They intentionally do not mimic product UI. */
    .motion-strip {
      height: 100%;
      display: grid;
      grid-template-columns: 20px 34px 1fr 20px 34px 1fr 25px 34px 1fr 20px 34px;
      align-items: center;
      gap: 4px;
    }
    .motion-strip span {
      height: 2px;
      background: rgba(255,255,255,.42);
    }
    .motion-strip b {
      color: rgba(255,255,255,.82);
      font-size: 9px;
      font-weight: 700;
    }
    .motion-dot {
      display: block;
      justify-self: center;
      border: 3px solid var(--highlight);
      border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(255,255,255,.08);
    }
    .dot-a { width: 12px; height: 12px; }
    .dot-b { width: 19px; height: 19px; transform: translateY(-7px); }
    .dot-c { width: 25px; height: 25px; transform: translateY(4px); }
    .dot-d { width: 18px; height: 18px; }
    .flow-compare {
      position: relative;
      height: 100%;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 7px;
      padding-bottom: 24px;
    }
    .mini-screen {
      display: grid;
      align-content: start;
      gap: 5px;
      padding: 8px;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 8px;
      background: rgba(255,255,255,.08);
    }
    .mini-screen i {
      height: 4px;
      border-radius: 4px;
      background: rgba(255,255,255,.25);
    }
    .mini-screen i:nth-child(2) { width: 68%; }
    .mini-screen strong {
      margin-top: auto;
      color: #fff;
      font-size: 10px;
    }
    .compare-tags {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      justify-content: space-around;
      color: var(--highlight);
      font-size: 9px;
      font-weight: 800;
    }
    .edit-timeline {
      position: relative;
      height: 100%;
      display: grid;
      grid-template-columns: 86px 1fr;
      gap: 9px;
    }
    .transcript-lines,
    .track-stack {
      display: grid;
      align-content: center;
      gap: 7px;
    }
    .transcript-lines i {
      height: 5px;
      border-radius: 4px;
      background: rgba(255,255,255,.28);
    }
    .transcript-lines i:nth-child(2) { width: 72%; }
    .track-stack span {
      display: flex;
      gap: 4px;
      height: 16px;
    }
    .track-stack b {
      display: block;
      border-radius: 4px;
      background: color-mix(in srgb, var(--highlight) 83%, #fff);
    }
    .track-stack span:nth-child(2) b { background: #5eead4; }
    .track-stack span:nth-child(3) b { background: #93c5fd; }
    .edit-timeline em {
      position: absolute;
      left: 49%;
      top: 4px;
      bottom: 4px;
      width: 2px;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(255,255,255,.08);
    }
    .code-video {
      height: 100%;
      display: grid;
      grid-template-columns: 1fr 28px 1.05fr;
      align-items: center;
      gap: 8px;
    }
    .code-pane {
      display: grid;
      gap: 6px;
      padding: 10px;
      border-radius: 8px;
      background: rgba(7,18,43,.52);
    }
    .code-pane i {
      height: 4px;
      border-radius: 4px;
      background: #93c5fd;
    }
    .code-pane i:nth-child(2) { width: 74%; background: var(--highlight); }
    .code-pane i:nth-child(3) { width: 88%; }
    .code-pane i:nth-child(4) { width: 58%; background: #5eead4; }
    .render-arrow {
      color: #fff;
      font-size: 21px;
      text-align: center;
    }
    .film-pane {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      padding: 7px;
      border: 2px solid rgba(255,255,255,.72);
      border-radius: 8px;
    }
    .film-pane span {
      aspect-ratio: 4/3;
      border-radius: 3px;
      background:
        linear-gradient(145deg, var(--highlight), color-mix(in srgb, var(--accent) 65%, #fff));
    }
    .repo-pack {
      height: 100%;
      display: grid;
      grid-template-columns: 1.1fr 26px 1fr;
      align-items: center;
      gap: 7px;
    }
    .file-cloud {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 5px;
    }
    .file-cloud span {
      display: grid;
      height: 26px;
      place-items: center;
      color: #fff;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 5px;
      background: rgba(255,255,255,.1);
      font: 800 9px/1 "Cascadia Mono", monospace;
    }
    .pack-arrow {
      color: #fff;
      font-size: 20px;
      text-align: center;
    }
    .context-file {
      display: grid;
      height: 72px;
      place-items: center;
      align-content: center;
      border: 2px solid var(--highlight);
      border-radius: 9px;
      background: rgba(255,255,255,.1);
    }
    .context-file i {
      width: 24px;
      height: 4px;
      margin-bottom: 5px;
      border-radius: 4px;
      background: var(--highlight);
    }
    .context-file b { color: #fff; font-size: 11px; }
    .context-file small { margin-top: 4px; color: rgba(255,255,255,.62); font-size: 8px; }
    .docs-steps {
      height: 100%;
      display: grid;
      grid-template-columns: 1fr 22px 1fr;
      align-items: center;
      gap: 6px;
    }
    .docs-steps > div {
      display: grid;
      grid-template-columns: 24px 1fr;
      gap: 2px 7px;
      align-items: center;
      padding: 8px;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 8px;
      background: rgba(255,255,255,.08);
    }
    .docs-steps div span {
      grid-row: 1 / 3;
      display: grid;
      width: 23px;
      height: 23px;
      place-items: center;
      color: var(--ink);
      border-radius: 6px;
      background: var(--highlight);
      font-size: 10px;
      font-weight: 900;
    }
    .docs-steps div b { color: #fff; font-size: 9px; }
    .docs-steps div em { color: #86efac; font-size: 8px; font-style: normal; font-weight: 800; }
    .docs-steps > i { color: #fff; font-size: 18px; font-style: normal; text-align: center; transform: rotate(-90deg); }
    .install-flow {
      height: 100%;
      display: grid;
      grid-template-columns: 78px 1fr 104px;
      align-items: center;
      gap: 9px;
    }
    .source-box,
    .local-app {
      display: grid;
      height: 70px;
      place-items: center;
      align-content: center;
      border: 1px solid rgba(255,255,255,.2);
      border-radius: 9px;
      background: rgba(255,255,255,.09);
      color: #fff;
      font: 900 15px/1 "Cascadia Mono", monospace;
    }
    .source-box small,
    .local-app small {
      margin-top: 7px;
      color: rgba(255,255,255,.65);
      font: 700 8px/1 sans-serif;
    }
    .dependency-nodes {
      position: relative;
      height: 50px;
    }
    .dependency-nodes::before {
      content: "";
      position: absolute;
      left: 8px;
      right: 8px;
      top: 24px;
      height: 2px;
      background: rgba(255,255,255,.3);
    }
    .dependency-nodes i {
      position: absolute;
      top: 17px;
      width: 15px;
      height: 15px;
      border: 3px solid var(--highlight);
      border-radius: 50%;
      background: var(--ink);
    }
    .dependency-nodes i:nth-child(1) { left: 2px; }
    .dependency-nodes i:nth-child(2) { left: 31%; top: 5px; }
    .dependency-nodes i:nth-child(3) { left: 60%; top: 29px; }
    .dependency-nodes i:nth-child(4) { right: 2px; }
    .local-app span {
      width: 58px;
      height: 14px;
      margin-bottom: 6px;
      border: 2px solid var(--highlight);
      border-radius: 4px;
    }
    .local-app b { font-size: 10px; }

    /*
     * First-edition mobile-safe composition.
     * At a 320px article width, the 1200px raster scales by 0.2667. Every
     * data-mobile-core label therefore starts at 38px or larger here so its
     * displayed size remains at least 10px after article-body scaling.
     */
    .figure-inner {
      grid-template-rows: 32px 116px 320px 76px 22px;
      align-content: space-between;
    }
    .topline {
      font-size: 13px;
      letter-spacing: .06em;
    }
    .origin-label,
    .not-ui,
    .counter {
      min-height: 32px;
    }
    .figure-hero {
      display: block;
      padding: 8px 2px 4px;
    }
    .hero-copy {
      display: grid;
      grid-template-columns: max-content 1fr;
      align-items: end;
      gap: 26px;
      height: 100%;
    }
    .tool-line {
      margin: 0 0 7px;
    }
    .tool-line strong {
      color: var(--ink);
      font-size: 42px;
      line-height: 1;
      letter-spacing: -.045em;
    }
    h1 {
      margin: 0 0 3px;
      color: #16213b;
      font-size: 54px;
      line-height: 1;
      letter-spacing: -.055em;
      white-space: nowrap;
    }
    .flow-stage {
      display: grid;
      grid-template-columns: 310px 95px 310px 95px 310px;
      align-items: stretch;
      width: 1120px;
      height: 320px;
    }
    .step-card {
      position: relative;
      display: grid;
      grid-template-rows: 34px 1fr 58px;
      align-items: center;
      min-width: 0;
      height: 320px;
      padding: 22px 24px 19px;
      overflow: hidden;
      color: #1c2945;
      border: 2px solid color-mix(in srgb, var(--ink) 17%, #fff);
      border-radius: 25px;
      background: rgba(255,255,255,.88);
      box-shadow:
        0 14px 30px color-mix(in srgb, var(--ink) 11%, transparent),
        inset 1px 1px 0 #fff;
    }
    .step-card::before {
      content: "";
      position: absolute;
      width: 140px;
      height: 140px;
      right: -76px;
      top: -70px;
      border: 24px solid color-mix(in srgb, var(--accent) 10%, transparent);
      border-radius: 50%;
    }
    .step-card-focus {
      color: #fff;
      border-color: transparent;
      background:
        linear-gradient(145deg, var(--ink), color-mix(in srgb, var(--accent) 74%, #101b3a));
      box-shadow:
        0 18px 38px color-mix(in srgb, var(--ink) 23%, transparent),
        inset 1px 1px 0 rgba(255,255,255,.22);
    }
    .step-card-focus::before {
      border-color: rgba(255,255,255,.08);
    }
    .step-number {
      position: relative;
      z-index: 1;
      justify-self: start;
      padding: 7px 10px;
      color: var(--ink);
      border-radius: 7px;
      background: color-mix(in srgb, var(--highlight) 42%, #fff);
      font: 900 18px/1 "Cascadia Mono", Consolas, monospace;
      letter-spacing: .08em;
    }
    .step-card-focus .step-number {
      color: var(--ink);
      background: var(--highlight);
    }
    .step-symbol {
      position: relative;
      z-index: 1;
      display: grid;
      width: 138px;
      height: 138px;
      place-items: center;
      justify-self: center;
      color: var(--accent);
      border: 4px solid color-mix(in srgb, var(--accent) 34%, #fff);
      border-radius: 38px;
      background: color-mix(in srgb, var(--soft) 72%, #fff);
      box-shadow:
        8px 9px 0 color-mix(in srgb, var(--accent) 11%, transparent),
        inset 1px 1px 0 #fff;
      font: 900 82px/1 "Segoe UI Symbol", "Segoe UI", sans-serif;
    }
    .step-card-focus .step-symbol {
      color: var(--highlight);
      border-color: rgba(255,255,255,.23);
      background: rgba(255,255,255,.08);
      box-shadow:
        8px 9px 0 rgba(0,0,0,.12),
        inset 1px 1px 0 rgba(255,255,255,.13);
    }
    .step-card h2 {
      position: relative;
      z-index: 1;
      align-self: end;
      margin: 0;
      color: inherit;
      font-size: 38px;
      line-height: 1;
      letter-spacing: -.045em;
      text-align: center;
      white-space: nowrap;
    }
    .connector {
      display: grid;
      grid-template-columns: 1fr 48px;
      align-items: center;
      padding: 0 4px;
      color: var(--accent);
    }
    .connector i {
      width: 47px;
      height: 4px;
      border-radius: 4px;
      background: color-mix(in srgb, var(--accent) 54%, #b8c6dc);
    }
    .connector b {
      margin: 0 0 2px -4px;
      font-size: 58px;
      line-height: 1;
    }
    .result-bar {
      display: grid;
      grid-template-columns: 48px 1fr;
      align-items: center;
      gap: 17px;
      height: 76px;
      padding: 10px 22px;
      color: #263452;
      border: 2px solid color-mix(in srgb, var(--ink) 17%, #fff);
      border-radius: 18px;
      background: rgba(255,255,255,.86);
      box-shadow:
        0 10px 24px color-mix(in srgb, var(--ink) 9%, transparent),
        inset 1px 1px 0 #fff;
    }
    .result-bar span {
      display: grid;
      width: 48px;
      height: 48px;
      place-items: center;
      color: var(--ink);
      border-radius: 13px;
      background: var(--highlight);
      font-size: 34px;
      font-weight: 900;
    }
    .result-bar strong {
      min-width: 0;
      font-size: 40px;
      line-height: 1;
      letter-spacing: -.035em;
      white-space: nowrap;
    }
    .figure-footer {
      color: #66738b;
      font-size: 12px;
      letter-spacing: .07em;
    }
  </style>
</head>
<body>
  ${figures.map(renderFigure).join("\n")}
</body>
</html>`;

function connectCdp(webSocketUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    const pending = new Map();
    let nextId = 1;

    socket.addEventListener("open", () => {
      resolve({
        send(method, params = {}) {
          const id = nextId;
          nextId += 1;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((resolveCommand, rejectCommand) => {
            pending.set(id, {
              resolve: resolveCommand,
              reject: rejectCommand
            });
          });
        },
        close() {
          socket.close();
        }
      });
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id || !pending.has(message.id)) {
        return;
      }
      const handler = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        handler.reject(
          new Error(`${message.error.message} (${message.error.code})`)
        );
      } else {
        handler.resolve(message.result);
      }
    });

    socket.addEventListener("error", () => {
      reject(new Error("Chrome DevTools WebSocket failed."));
    });
  });
}

async function waitForDebugger(port) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        return;
      }
    } catch {
      // Chrome may still be starting.
    }
    await sleep(100);
  }
  throw new Error("Chrome DevTools endpoint did not become ready.");
}

async function waitForDocument(cdp) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = await cdp.send("Runtime.evaluate", {
      expression: "document.readyState",
      returnByValue: true
    });
    if (ready.result?.value === "complete") {
      return;
    }
    await sleep(100);
  }
  throw new Error("Figure document did not finish loading.");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

fs.mkdirSync(outputDirectory, { recursive: true });
const temporaryDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "tool-radar-original-figures-")
);
const sourcePath = path.join(temporaryDirectory, "figures.html");
fs.writeFileSync(sourcePath, html, "utf8");

const port = 10040 + Math.floor(Math.random() * 300);
const chrome = spawn(chromePath, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${path.join(temporaryDirectory, "chrome-profile")}`,
  "--hide-scrollbars",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--allow-file-access-from-files",
  "about:blank"
], {
  stdio: "ignore",
  windowsHide: true
});

let cdp;

try {
  await waitForDebugger(port);
  const newTargetResponse = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`,
    { method: "PUT" }
  );
  if (!newTargetResponse.ok) {
    throw new Error("Unable to create the local figure page.");
  }
  const page = await newTargetResponse.json();
  cdp = await connectCdp(page.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1200,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false
  });
  await cdp.send("Page.navigate", {
    url: pathToFileURL(sourcePath).href
  });
  await waitForDocument(cdp);
  await cdp.send("Runtime.evaluate", {
    expression: "document.fonts.ready",
    awaitPromise: true,
    returnByValue: true
  });

  for (const figure of figures) {
    const selector = `[data-figure="${figure.slug}"]`;
    const qaResult = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) {
          return { missing: true };
        }
        const figureRect = element.getBoundingClientRect();
        const issues = [];
        const mobileArticleWidth = 320;
        const rasterScale = mobileArticleWidth / figureRect.width;
        const scaledCoreFontSizes = [];
        if (/[\u3400-\u9fff\u3040-\u30ff]/u.test(element.textContent || "")) {
          issues.push("non-language-neutral-copy");
        }
        for (const node of element.querySelectorAll("[data-qa]")) {
          const rect = node.getBoundingClientRect();
          const name = node.getAttribute("data-qa");
          if (
            rect.left < figureRect.left - 1
            || rect.top < figureRect.top - 1
            || rect.right > figureRect.right + 1
            || rect.bottom > figureRect.bottom + 1
          ) {
            issues.push(name + ":outside");
          }
        }
        for (const node of element.querySelectorAll("[data-mobile-core]")) {
          const owner = node.closest("[data-qa]");
          const ownerRect = owner.getBoundingClientRect();
          const rect = node.getBoundingClientRect();
          const ownerName = owner.getAttribute("data-qa");
          const scaledFontSize = (
            Number.parseFloat(getComputedStyle(node).fontSize) * rasterScale
          );
          scaledCoreFontSizes.push(scaledFontSize);
          if (
            rect.left < ownerRect.left - 1
            || rect.top < ownerRect.top - 1
            || rect.right > ownerRect.right + 1
            || rect.bottom > ownerRect.bottom + 1
          ) {
            issues.push(
              ownerName
              + ":content-outside:"
              + node.tagName.toLowerCase()
              + "."
              + String(node.className || "").replaceAll(" ", ".")
            );
          }
          if (
            node.scrollWidth > node.clientWidth + 3
          ) {
            issues.push(
              ownerName
              + ":text-overflow:"
              + node.tagName.toLowerCase()
              + ":"
              + node.clientWidth
              + "x"
              + node.clientHeight
              + "->"
              + node.scrollWidth
              + "x"
              + node.scrollHeight
            );
          }
          if (scaledFontSize < 10) {
            issues.push(
              ownerName
              + ":mobile-font:"
              + scaledFontSize.toFixed(2)
            );
          }
        }
        return {
          missing: false,
          x: figureRect.left + window.scrollX,
          y: figureRect.top + window.scrollY,
          width: figureRect.width,
          height: figureRect.height,
          mobileArticleWidth,
          mobileScale: rasterScale,
          coreLabelCount: scaledCoreFontSizes.length,
          minScaledCoreFontPx: Math.min(...scaledCoreFontSizes),
          issues
        };
      })()`,
      returnByValue: true
    });
    const qa = qaResult.result?.value;
    if (
      !qa
      || qa.missing
      || qa.width !== 1200
      || qa.height !== 675
      || qa.coreLabelCount !== 6
      || qa.minScaledCoreFontPx < 10
      || qa.issues.length > 0
    ) {
      throw new Error(
        `Visual QA failed for ${figure.slug}: ${JSON.stringify(qa)}`
      );
    }

    const screenshot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
      clip: {
        x: qa.x,
        y: qa.y,
        width: 1200,
        height: 675,
        scale: 1
      }
    });
    const bytes = Buffer.from(screenshot.data, "base64");
    const outputPath = path.join(outputDirectory, figure.file);
    fs.writeFileSync(outputPath, bytes);
    process.stdout.write(
      `${figure.file} 1200x675 mobile320-min-core=`
      + `${qa.minScaledCoreFontPx.toFixed(2)}px sha256=${sha256(bytes)}\n`
    );
  }
} finally {
  if (cdp) {
    await cdp.send("Browser.close").catch(() => {});
    cdp.close();
  }
  await sleep(500);
  if (chrome.exitCode === null) {
    chrome.kill();
  }
  await sleep(300);
  fs.rmSync(temporaryDirectory, {
    recursive: true,
    force: true
  });
}
