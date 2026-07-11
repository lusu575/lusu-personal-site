import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { loadAllStages, toolRoot } from "./content-utils.mjs";

const WIDTH = 960;
const HEIGHT = 720;
const MARGIN = 22;
const GAP = 16;
const PANEL_WIDTH = (WIDTH - MARGIN * 2 - GAP) / 2;
const PANEL_HEIGHT = (HEIGHT - MARGIN * 2 - GAP) / 2;
const outputRoot = path.join(toolRoot, "assets", "stages");
const manifestPath = path.join(outputRoot, "manifest.json");
const options = parseArgs(process.argv.slice(2));

const stages = await loadAllStages();
await mkdir(outputRoot, { recursive: true });
const selectedStages = options.stageIds.size ? stages.filter((stage) => options.stageIds.has(stage.id)) : stages;
if (selectedStages.length !== (options.stageIds.size || stages.length)) throw new Error("One or more requested stage IDs do not exist.");
const priorManifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, "utf8")) : { entries: [] };
const entryMap = new Map((priorManifest.entries || []).map((entry) => [entry.stageId, entry]));

for (let index = 0; index < selectedStages.length; index += 1) {
  const stage = selectedStages[index];
  const destination = path.join(outputRoot, `${stage.id.toLowerCase()}.webp`);
  const output = await sharp(Buffer.from(renderManga(stage)))
    .webp({ quality: 86, effort: 5, smartSubsample: true })
    .toBuffer();
  const sha256 = createHash("sha256").update(output).digest("hex");
  if (options.check) {
    if (!existsSync(destination) || createHash("sha256").update(await readFile(destination)).digest("hex") !== sha256) {
      throw new Error(`${stage.id}: published WebP differs from deterministic renderer.`);
    }
  } else {
    const temporary = `${destination}.part-${process.pid}`;
    await writeFile(temporary, output);
    try {
      await rename(temporary, destination);
    } catch {
      await rm(destination, { force: true });
      await rename(temporary, destination);
    }
  }
  entryMap.set(stage.id, {
    stageId: stage.id,
    path: `assets/stages/${stage.id.toLowerCase()}.webp`,
    sha256,
    width: WIDTH,
    height: HEIGHT,
    style: "monochrome-four-panel",
    reviewStatus: "automated-scene-mapped",
  });
  if ((index + 1) % 25 === 0 || index === selectedStages.length - 1) {
    console.log(`${options.check ? "Checked" : "Rendered"} ${index + 1}/${selectedStages.length} monochrome manga assets.`);
  }
}

const manifest = {
  schemaVersion: 1,
  contentVersion: "1.0.2",
  generatorVersion: "local-four-panel-v2",
  entries: [...entryMap.values()].sort((a, b) => a.stageId.localeCompare(b.stageId)),
};
if (manifest.entries.length !== 250) throw new Error(`Illustration manifest has ${manifest.entries.length} entries; expected 250.`);
if (options.check) {
  if (JSON.stringify(priorManifest) !== JSON.stringify(manifest)) throw new Error("Published illustration manifest is stale.");
} else {
  const temporary = `${manifestPath}.part-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  try {
    await rename(temporary, manifestPath);
  } catch {
    await rm(manifestPath, { force: true });
    await rename(temporary, manifestPath);
  }
}

function renderManga(stage) {
  const seed = hash(stage.id);
  const scene = sceneKind(stage);
  const props = storyProps(stage);
  const cast = stage.cast?.length ? stage.cast : [{ id: "narrator", voiceKey: "narrator" }];
  const first = cast[0];
  const second = cast[1] || first;
  const mood = stageMood(stage);
  const panels = [
    panel(0, scene, props[0], actorLineup(cast, "open", seed), "◇", seed),
    panel(1, scene, props[1] || props[0], [actor(second, 242, 230, 1.32, mood, seed + 11)], moodMark(mood), seed + 23, true),
    panel(2, scene, props[2] || props[0], [], "", seed + 41, false, true),
    panel(3, scene, props[3] || props[1] || props[0], actorLineup(cast, mood === "alarm" ? "alarm" : "relief", seed + 67), "…", seed + 67),
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <pattern id="dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.45" fill="#777"/></pattern>
    <pattern id="fine-dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="0.75" fill="#999"/></pattern>
    <pattern id="hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(24)"><line x1="0" y1="0" x2="0" y2="12" stroke="#777" stroke-width="2"/></pattern>
    ${panels.map((_, i) => `<clipPath id="clip-${i}"><rect x="5" y="5" width="${PANEL_WIDTH - 10}" height="${PANEL_HEIGHT - 10}" rx="4"/></clipPath>`).join("")}
  </defs>
  <rect width="960" height="720" fill="#f7f5ed"/>
  <path d="M12 18h54M18 12v54M948 654v54M894 702h54" stroke="#111" stroke-width="5"/>
  ${panels.map((content, i) => {
    const x = MARGIN + (i % 2) * (PANEL_WIDTH + GAP);
    const y = MARGIN + Math.floor(i / 2) * (PANEL_HEIGHT + GAP);
    return `<g transform="translate(${x} ${y})"><rect width="${PANEL_WIDTH}" height="${PANEL_HEIGHT}" rx="5" fill="#fff" stroke="#111" stroke-width="6"/>${content}</g>`;
  }).join("")}
  </svg>`;
}

function panel(index, scene, prop, actors, mark, seed, close = false, objectFocus = false) {
  const bg = background(scene, seed, close || objectFocus);
  const focus = objectFocus ? featuredProp(prop, seed) : propSvg(prop, close ? 87 : 64, close ? 226 : 274, close ? 1.15 : 0.85);
  const rays = objectFocus ? actionRays(seed) : "";
  const bubble = mark ? speechBubble(mark, index % 2 ? 350 : 98, 76, seed) : "";
  return `<g clip-path="url(#clip-${index})">${bg}${sceneMotif(seed)}${rays}${focus}${actors.join("")}${bubble}${cornerMotif(index, seed)}</g>`;
}

function actorLineup(cast, emotion, seed) {
  const count = Math.max(1, Math.min(4, cast.length));
  const scale = count === 1 ? 1.12 : count === 2 ? .95 : count === 3 ? .76 : .66;
  const left = count === 1 ? 226 : 62;
  const span = count === 1 ? 0 : 328 / (count - 1);
  return cast.slice(0, 4).map((member, index) => {
    const jitter = ((seed >>> (index * 3)) & 7) - 3;
    return actor(member, left + span * index + jitter, 240 + (index % 2) * 4, scale, index === 0 ? emotion : "listen", seed + index * 11);
  });
}

function sceneMotif(seed) {
  return Array.from({ length: 16 }, (_, bit) => {
    const x = 160 + bit * 8;
    const y = 316 + ((seed >>> bit) & 1) * 5;
    return `<circle cx="${x}" cy="${y}" r="${(seed >>> (bit + 16)) & 1 ? 2.1 : 1.2}" fill="#777" opacity=".45"/>`;
  }).join("");
}

function background(kind, seed, close) {
  const tone = seed % 2 ? "url(#fine-dots)" : "url(#hatch)";
  const base = `<rect x="5" y="5" width="${PANEL_WIDTH - 10}" height="${PANEL_HEIGHT - 10}" fill="#fff"/><path d="M5 250H${PANEL_WIDTH - 5}" stroke="#111" stroke-width="4"/><path d="M8 252H${PANEL_WIDTH - 8}V${PANEL_HEIGHT - 6}H8z" fill="${tone}" opacity=".28"/>`;
  if (close) return `${base}<circle cx="355" cy="66" r="82" fill="url(#fine-dots)" opacity=".35"/>`;
  const scenes = {
    school: `<path d="M25 35H188V210H25zM46 54v137M94 54v137M142 54v137M25 94h163M25 144h163" fill="none" stroke="#111" stroke-width="5"/><path d="M302 36h128v190H302zM320 70h92M320 105h92M320 140h92" fill="none" stroke="#111" stroke-width="5"/>`,
    shop: `<path d="M18 42h415M48 42v152M142 42v152M236 42v152M330 42v152" stroke="#111" stroke-width="5"/><path d="M25 80h400M25 132h400M25 184h400" stroke="#111" stroke-width="4"/><circle cx="78" cy="106" r="18" fill="url(#dots)"/><rect x="270" y="95" width="46" height="28" fill="#fff" stroke="#111" stroke-width="4"/>`,
    cafe: `<path d="M22 38h166v128H22zM46 58v86M88 58v86M130 58v86M22 102h166" fill="none" stroke="#111" stroke-width="5"/><path d="M268 184h156M286 184l-16 66M408 184l16 66M304 172v-38h86v38" fill="none" stroke="#111" stroke-width="6"/>`,
    station: `<path d="M24 45h404v153H24zM58 45v153M225 45v153M390 45v153M24 118h404" fill="none" stroke="#111" stroke-width="6"/><path d="M76 88h105M274 88h84" stroke="#111" stroke-width="6"/><path d="M10 236h432M50 215l-32 34M405 215l31 34" stroke="#111" stroke-width="5"/>`,
    office: `<path d="M26 38h160v104H26zM48 60h116v60H48zM252 58h170v112H252zM274 82h126v64H274z" fill="#fff" stroke="#111" stroke-width="5"/><path d="M222 211h220M258 170v42M410 170v42" stroke="#111" stroke-width="6"/>`,
    home: `<path d="M22 40h158v132H22zM48 64h106M48 94h106M48 124h106" fill="none" stroke="#111" stroke-width="5"/><path d="M263 187q18-55 72-55t72 55v55H263zM287 188v50M382 188v50" fill="#fff" stroke="#111" stroke-width="6"/>`,
    scifi: `<path d="M12 24h428v210H12z" fill="#111"/><circle cx="68" cy="64" r="3" fill="#fff"/><circle cx="149" cy="46" r="5" fill="#fff"/><circle cx="382" cy="82" r="4" fill="#fff"/><path d="M62 188Q220 84 398 186L366 234H90z" fill="#fff" stroke="#111" stroke-width="6"/><circle cx="220" cy="178" r="42" fill="url(#dots)" stroke="#111" stroke-width="5"/>`,
    interface: `<rect x="18" y="28" width="416" height="205" rx="8" fill="url(#fine-dots)" stroke="#111" stroke-width="6"/><path d="M18 66h416M48 47h8M70 47h8M92 47h8" stroke="#111" stroke-width="7"/><rect x="92" y="91" width="268" height="116" fill="#fff" stroke="#111" stroke-width="7"/><path d="M122 121l34 34M156 121l-34 34M186 126h137M186 151h109M186 176h126" stroke="#111" stroke-width="6"/>`,
    fantasy: `<path d="M22 239V84l64-45 54 45 72-60 70 60 70-43 78 43v155" fill="url(#fine-dots)" stroke="#111" stroke-width="6"/><path d="M74 239v-98h64v98M306 239v-112h68v112M196 239v-136h66v136" fill="#fff" stroke="#111" stroke-width="5"/>`,
    outdoor: `<path d="M6 196Q80 138 146 182Q226 101 316 177Q376 148 447 188V252H6z" fill="url(#dots)" opacity=".55" stroke="#111" stroke-width="5"/><circle cx="370" cy="63" r="34" fill="#fff" stroke="#111" stroke-width="5"/><path d="M20 78h66M38 102h92M300 112h110" stroke="#777" stroke-width="4"/>`,
  };
  return base + (scenes[kind] || scenes.office);
}

function actor(member, x, y, scale, emotion, seed) {
  const female = String(member?.voiceKey || "").includes("female");
  const variant = hash(String(member?.id || seed)) % 4;
  const eye = emotion === "alarm" ? `<circle cx="-14" cy="-9" r="5"/><circle cx="14" cy="-9" r="5"/>` : emotion === "relief" || emotion === "understand" ? `<path d="M-24-8q10 12 20 0M4-8q10 12 20 0" fill="none" stroke="#111" stroke-width="5"/>` : `<path d="M-24-9h18M7-9h18" stroke="#111" stroke-width="5"/>`;
  const mouth = emotion === "alarm" ? `<ellipse cy="14" rx="10" ry="13" fill="#111"/>` : emotion === "hesitate" ? `<path d="M-11 16q12-7 23 0" fill="none" stroke="#111" stroke-width="4"/>` : `<path d="M-13 13q13 14 27 0" fill="none" stroke="#111" stroke-width="4"/>`;
  const hair = female ? `<path d="M-49-16Q-42-70 0-73Q45-70 51-16L43 46L30 21Q0 36-31 19L-43 46z" fill="#111"/>` : `<path d="M-45-20Q-35-72 7-70Q48-65 49-18L33-44L21-28L8-48L-8-30L-25-47z" fill="#111"/>`;
  const shirt = variant % 2 ? "url(#fine-dots)" : "#fff";
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M-45 122q6-74 45-76q40 2 46 76z" fill="${shirt}" stroke="#111" stroke-width="6"/>
    <path d="M-29 60l-48 45M29 60l49 45" stroke="#111" stroke-width="8" stroke-linecap="round"/>
    <ellipse cy="-8" rx="45" ry="52" fill="#fff" stroke="#111" stroke-width="6"/>${hair}<ellipse cy="-5" rx="35" ry="40" fill="#fff"/>
    ${eye}${mouth}<path d="M-15 47v17M15 47v17" stroke="#111" stroke-width="5"/>
  </g>`;
}

function speechBubble(mark, x, y, seed) {
  const tail = seed % 2 ? `M${x - 8} ${y + 43}l-18 34 40-27` : `M${x + 8} ${y + 43}l22 31-43-23`;
  const glyph = mark === "?"
    ? `<path d="M${x - 13} ${y - 10}q2-17 17-17q17 0 17 14q0 10-10 16q-8 5-8 14" fill="none" stroke="#111" stroke-width="7" stroke-linecap="round"/><circle cx="${x + 3}" cy="${y + 28}" r="4"/>`
    : mark === "!"
      ? `<path d="M${x} ${y - 27}v37" stroke="#111" stroke-width="8" stroke-linecap="round"/><circle cx="${x}" cy="${y + 27}" r="5"/>`
      : mark === "…"
        ? `<circle cx="${x - 22}" cy="${y + 4}" r="5"/><circle cx="${x}" cy="${y + 4}" r="5"/><circle cx="${x + 22}" cy="${y + 4}" r="5"/>`
        : `<path d="M${x} ${y - 22}l22 22-22 22-22-22z" fill="#fff" stroke="#111" stroke-width="6"/>`;
  return `<g><path d="${tail}" fill="#fff" stroke="#111" stroke-width="5" stroke-linejoin="round"/><ellipse cx="${x}" cy="${y}" rx="58" ry="43" fill="#fff" stroke="#111" stroke-width="5"/>${glyph}</g>`;
}

function featuredProp(prop, seed) {
  return `<g transform="translate(226 170) scale(1.75)">${propSvg(prop, 0, 0, 1)}</g><ellipse cx="226" cy="278" rx="132" ry="22" fill="url(#dots)" opacity=".5"/>${seed % 2 ? `<path d="M56 64l58 58M396 62l-59 59M40 208l75-20M412 208l-74-20" stroke="#111" stroke-width="7"/>` : ""}`;
}

function propSvg(kind, x, y, scale = 1) {
  const shapes = {
    clock: `<circle r="45" fill="#fff" stroke="#111" stroke-width="6"/><path d="M0-30V2L24 18" fill="none" stroke="#111" stroke-width="6" stroke-linecap="round"/>`,
    bag: `<path d="M-52-18h104v82H-52zM-27-18q0-38 27-38t27 38" fill="#fff" stroke="#111" stroke-width="7"/><path d="M-42 15h84" stroke="#111" stroke-width="5"/>`,
    phone: `<rect x="-36" y="-62" width="72" height="126" rx="12" fill="#fff" stroke="#111" stroke-width="7"/><rect x="-23" y="-43" width="46" height="75" fill="url(#dots)"/><circle cy="48" r="5"/>`,
    food: `<path d="M-56 9q56 58 112 0" fill="#fff" stroke="#111" stroke-width="7"/><path d="M-64 0h128M-35-8q-12-28 8-45M0-8q-12-28 8-45M35-8q-12-28 8-45" fill="none" stroke="#111" stroke-width="6"/>`,
    bread: `<path d="M-58 36V-9q4-41 38-30q20-31 42 0q34-10 36 30v45z" fill="url(#fine-dots)" stroke="#111" stroke-width="7"/><path d="M-25-19l12 35M7-22l12 38" stroke="#111" stroke-width="5"/>`,
    drink: `<path d="M-42-44h73l-7 105h-59zM31-24q35 0 30 29q-3 24-33 25" fill="#fff" stroke="#111" stroke-width="7"/><path d="M-25-63q-12-22 4-38M5-63q-12-22 4-38" fill="none" stroke="#111" stroke-width="5"/>`,
    book: `<path d="M0-45q-27-18-60-6v95q35-10 60 10q25-20 60-10v-95q-33-12-60 6z" fill="#fff" stroke="#111" stroke-width="7"/><path d="M0-45v99M-43-23h27M16-23h27M-43-3h27M16-3h27" stroke="#111" stroke-width="4"/>`,
    umbrella: `<path d="M-66 0q10-68 66-68T66 0q-18-17-33 0q-17-17-33 0q-17-17-33 0q-15-17-33 0z" fill="url(#dots)" stroke="#111" stroke-width="7"/><path d="M0-66v103q0 28 25 22" fill="none" stroke="#111" stroke-width="7"/>`,
    train: `<rect x="-68" y="-50" width="136" height="98" rx="14" fill="#fff" stroke="#111" stroke-width="7"/><rect x="-48" y="-31" width="38" height="42" fill="url(#dots)"/><rect x="10" y="-31" width="38" height="42" fill="url(#dots)"/><circle cx="-40" cy="52" r="11"/><circle cx="40" cy="52" r="11"/>`,
    key: `<circle cx="-35" cy="-16" r="27" fill="#fff" stroke="#111" stroke-width="8"/><path d="M-12 2l73 55M27 32l16-21M43 46l17-20" stroke="#111" stroke-width="10"/>`,
    door: `<rect x="-49" y="-70" width="98" height="140" fill="#fff" stroke="#111" stroke-width="8"/><circle cx="27" cy="7" r="7"/>`,
    photo: `<path d="M-64-51h128v102H-64z" fill="#fff" stroke="#111" stroke-width="7"/><circle cx="25" cy="-17" r="16" fill="url(#dots)"/><path d="M-50 35l35-39 24 27 18-17 26 29z" fill="url(#fine-dots)" stroke="#111" stroke-width="4"/>`,
    note: `<path d="M-50-66h100V66H-50z" fill="#fff" stroke="#111" stroke-width="7"/><path d="M-31-35h63M-31-10h63M-31 15h48M-31 40h59" stroke="#111" stroke-width="5"/>`,
    computer: `<rect x="-67" y="-57" width="134" height="92" rx="6" fill="#fff" stroke="#111" stroke-width="7"/><path d="M0 36v27M-35 64h70" stroke="#111" stroke-width="8"/><circle cx="-25" cy="-12" r="12" fill="url(#dots)"/><path d="M-4-12h45M-4 9h34" stroke="#111" stroke-width="5"/>`,
    star: `<path d="M0-69l17 45 48 3-38 30 13 47L0 29l-40 27 13-47-38-30 48-3z" fill="url(#dots)" stroke="#111" stroke-width="7"/>`,
    cat: `<path d="M-47-26l-17-38 39 16q25-11 50 0l39-16-17 38q13 72-47 78q-60-6-47-78z" fill="#fff" stroke="#111" stroke-width="7"/><circle cx="-22" cy="-4" r="5"/><circle cx="22" cy="-4" r="5"/><path d="M-8 15l8 7 8-7M-17 31q17 12 34 0" fill="none" stroke="#111" stroke-width="4"/>`,
    dog: `<path d="M-48-29q-28-29-37 8q4 43 35 41q12 42 50 42t50-42q31 2 35-41q-9-37-37-8q-19-24-48-24t-48 24z" fill="#fff" stroke="#111" stroke-width="7"/><circle cx="-20" cy="-5" r="5"/><circle cx="20" cy="-5" r="5"/><ellipse cy="16" rx="9" ry="6" fill="#111"/><path d="M0 22q-13 18-27 5M0 22q13 18 27 5" fill="none" stroke="#111" stroke-width="4"/>`,
    sun: `<circle r="43" fill="url(#fine-dots)" stroke="#111" stroke-width="7"/><path d="M0-78v20M0 58v20M-78 0h20M58 0h20M-56-56l15 15M41 41l15 15M56-56L41-41M-41 41l-15 15" stroke="#111" stroke-width="8" stroke-linecap="round"/>`,
    dragon: `<path d="M-58 23q-12-58 37-69l21-35 21 35q49 11 37 69q-12 51-58 51t-58-51z" fill="url(#fine-dots)" stroke="#111" stroke-width="7"/><path d="M-40-24l-35-23 13 43M40-24l35-23-13 43" fill="#fff" stroke="#111" stroke-width="6"/><circle cx="-20" cy="4" r="6"/><circle cx="20" cy="4" r="6"/><path d="M-18 34q18 11 36 0M-10 51l10 18 10-18" fill="none" stroke="#111" stroke-width="5"/>`,
    knight: `<path d="M-52-12q0-59 52-59t52 59v65H-52z" fill="url(#fine-dots)" stroke="#111" stroke-width="7"/><path d="M-48-13h96M-33-13v31M-11-13v31M11-13v31M33-13v31" stroke="#111" stroke-width="6"/><path d="M-4-71V-95l25 17" fill="none" stroke="#111" stroke-width="7"/><path d="M-68 44l28-12 28 12v38q-28 25-56 0z" fill="#fff" stroke="#111" stroke-width="6"/>`,
    error: `<rect x="-70" y="-55" width="140" height="110" rx="7" fill="#fff" stroke="#111" stroke-width="7"/><path d="M-70-25H70M-47-43h7M-28-43h7M-9-43h7M-42-2l28 28M-14-2l-28 28M5 1h43M5 24h31" stroke="#111" stroke-width="6"/>`,
    medicine: `<path d="M-32-67h64v27l18 21v81h-100v-81l18-21z" fill="#fff" stroke="#111" stroke-width="7"/><path d="M-32-42h64M-29 17h58M0-6v46M-22 17h44" stroke="#111" stroke-width="7"/>`,
    microphone: `<rect x="-24" y="-67" width="48" height="82" rx="24" fill="url(#dots)" stroke="#111" stroke-width="7"/><path d="M-48-5q0 51 48 51T48-5M0 46v31M-32 78h64" fill="none" stroke="#111" stroke-width="7"/>`,
    chart: `<rect x="-68" y="-58" width="136" height="116" fill="#fff" stroke="#111" stroke-width="7"/><path d="M-47 34l27-28 24 13 39-48M-47 39h94M-47 39v-74" fill="none" stroke="#111" stroke-width="6"/><circle cx="-20" cy="6" r="5"/><circle cx="4" cy="19" r="5"/><circle cx="43" cy="-29" r="5"/>`,
    map: `<path d="M-68-45l43-14 49 16 44-14v102L25 59l-49-16-44 14z" fill="#fff" stroke="#111" stroke-width="7"/><path d="M-25-59v102M24-43V59M-49-18l27 20 21-30 33 38 20-21" fill="none" stroke="#111" stroke-width="5"/>`,
    flower: `<circle r="15" fill="#fff" stroke="#111" stroke-width="5"/><circle cx="0" cy="-35" r="24" fill="url(#fine-dots)" stroke="#111" stroke-width="5"/><circle cx="34" cy="-10" r="24" fill="url(#fine-dots)" stroke="#111" stroke-width="5"/><circle cx="21" cy="29" r="24" fill="url(#fine-dots)" stroke="#111" stroke-width="5"/><circle cx="-21" cy="29" r="24" fill="url(#fine-dots)" stroke="#111" stroke-width="5"/><circle cx="-34" cy="-10" r="24" fill="url(#fine-dots)" stroke="#111" stroke-width="5"/><path d="M0 39v53M0 68q-37-25-44 8q27 14 44-8M0 75q37-25 44 8q-27 14-44-8" fill="#fff" stroke="#111" stroke-width="5"/>`,
    gift: `<rect x="-58" y="-24" width="116" height="84" fill="#fff" stroke="#111" stroke-width="7"/><path d="M0-24v84M-67-25H67V0H-67z" fill="url(#dots)" stroke="#111" stroke-width="6"/><path d="M0-26q-58-34-43-57q15-22 43 57q28-79 43-57q15 23-43 57z" fill="#fff" stroke="#111" stroke-width="6"/>`,
  };
  return `<g transform="translate(${x} ${y}) scale(${scale})">${shapes[kind] || shapes.note}</g>`;
}

function actionRays(seed) {
  const cx = seed % 2 ? 220 : 235;
  return `<g stroke="#111" stroke-width="5" opacity=".8"><path d="M${cx} 18v70M${cx} 260v66M18 170h82M352 170h83M52 45l62 59M402 47l-61 58M54 299l60-59M399 300l-58-59"/></g>`;
}

function cornerMotif(index, seed) {
  const fill = (index + seed) % 2 ? "url(#dots)" : "#111";
  return `<path d="M14 14h37v12H26v25H14z" fill="${fill}"/><path d="M${PANEL_WIDTH - 14} ${PANEL_HEIGHT - 14}h-37v-12h25v-25h12z" fill="${fill}"/>`;
}

function sceneKind(stage) {
  const text = searchable(stage);
  if (/(エラー|警告画面|障害|checksum|system error|error dialog|interface bug)/i.test(text)) return "interface";
  if (/(学校|教室|図書|school|classroom|library)/i.test(text)) return "school";
  if (/(店|コンビニ|売り場|shop|store|market)/i.test(text)) return "shop";
  if (/(カフェ|レストラン|食堂|喫茶|パン屋|cafe|restaurant|bakery|diner)/i.test(text)) return "cafe";
  if (/(駅|電車|列車|改札|空港|station|\btrain\b|platform|airport)/i.test(text)) return "station";
  if (/(家|部屋|居間|台所|home|family|living room|kitchen)/i.test(text)) return "home";
  if (/(城|魔法|勇者|竜|夢|fantasy|castle|witch|dream|dragon)/i.test(text)) return "fantasy";
  if (/(宇宙|\bAI\b|ロボット|端末|未来|space|robot|android|laboratory|simulation)/i.test(text)) return "scifi";
  if (/(雨|公園|屋外|海|山|庭|\brain\b|park|outdoor|beach|garden)/i.test(text)) return "outdoor";
  return "office";
}

function propPatterns() {
  return [
  ["dragon", /(竜|ドラゴン|dragon)/i], ["knight", /(騎士|勇者|鎧|knight|armor)/i], ["error", /(エラー|障害|checksum|system error|error dialog)/i],
  ["cat", /(猫|\bcat\b)/i], ["dog", /(犬|\bdog\b)/i], ["sun", /(日差し|日なた|太陽|sunlight|sunny|sunbeam)/i],
  ["umbrella", /(傘|雨|umbrella|\brain\b)/i], ["train", /(駅|電車|列車|切符|\btrain\b|station|ticket)/i],
  ["medicine", /(薬|病院|診察|medicine|hospital|clinic)/i], ["microphone", /(録音|マイク|音声|recording|microphone)/i],
  ["chart", /(会議|契約|合併|売上|meeting|merger|contract|chart)/i], ["map", /(地図|座標|経路|map|route|coordinate)/i],
  ["flower", /(花|桜|flower|blossom)/i], ["clock", /(時計|時間|時刻|締切|clock|time|deadline|schedule)/i],
  ["bag", /(鞄|バッグ|荷物|bag|luggage)/i], ["phone", /(電話|スマホ|通話|phone|call|message)/i],
  ["bread", /(パン|bread|bakery)/i], ["food", /(弁当|昼食|夕食|料理|food|lunch|dinner|meal)/i],
  ["drink", /(珈琲|コーヒー|紅茶|飲み物|お茶|coffee|tea|drink|cup)/i], ["book", /(本|図書|辞書|book|library|novel)/i],
  ["key", /(鍵|\bkey\b)/i], ["door", /(扉|ドア|門|door|gate)/i], ["photo", /(写真|肖像|映像|photo|picture|portrait|camera)/i],
  ["gift", /(贈り物|プレゼント|gift|present)/i], ["star", /(星|宇宙|space|star|planet)/i],
  ["computer", /(\bAI\b|端末|画面|機械|robot|computer|screen|terminal)/i], ["note", /(手紙|メモ|紙|記録|資料|letter|note|document|record|log)/i],
  ];
}

function storyProps(stage) {
  const lines = stage.lines || [];
  const evidenceIds = new Set((stage.questions || []).flatMap((question) => question.evidenceLineIds || []));
  const evidence = lines.filter((line) => evidenceIds.has(line.id));
  const middle = lines.slice(Math.max(0, Math.floor(lines.length / 2) - 1), Math.floor(lines.length / 2) + 2);
  const prompts = (stage.questions || []).flatMap((question) => [question.prompt?.ja, question.prompt?.en]).filter(Boolean).join(" ");
  const beatTexts = [
    [stage.setting?.ja, stage.setting?.en, ...lines.slice(0, 2).flatMap(lineText)].filter(Boolean).join(" "),
    middle.flatMap(lineText).join(" "),
    [...evidence.flatMap(lineText), prompts].join(" "),
    [stage.title?.ja, stage.title?.en, ...lines.slice(-2).flatMap(lineText), prompts].filter(Boolean).join(" "),
  ];
  const global = detectProps(searchable(stage));
  const fallbacks = { school: "book", shop: "bag", cafe: "drink", station: "train", home: "note", scifi: "computer", fantasy: "key", outdoor: "umbrella", interface: "error", office: "chart" };
  const selected = [];
  for (const beat of beatTexts) {
    const candidates = [...detectProps(beat), ...global, fallbacks[sceneKind(stage)], "note", "phone"];
    selected.push(candidates.find((value) => value && !selected.includes(value)) || candidates[0] || "note");
  }
  return selected;
}

function detectProps(text) {
  return propPatterns().filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function lineText(line) {
  return [line?.text?.ja, line?.text?.en].filter(Boolean);
}

function stageMood(stage) {
  const text = `${stage.skills?.join(" ") || ""} ${searchable(stage)}`;
  if (/(拒否|断|ちょっと|refusal|hesitat|ellipsis)/i.test(text)) return "hesitate";
  if (/(危険|急|警告|alarm|danger|urgent|warning)/i.test(text)) return "alarm";
  if (/(皮肉|嘘|疑|irony|lie|deception|doubt)/i.test(text)) return "listen";
  return "open";
}

function moodMark(mood) {
  if (mood === "alarm") return "!";
  if (mood === "hesitate") return "…";
  return "?";
}

function searchable(stage) {
  return [
    stage.title?.ja, stage.title?.en, stage.setting?.ja, stage.setting?.en, stage.layout,
    ...(stage.genres || []), ...(stage.skills || []), ...(stage.lines || []).flatMap(lineText),
    ...(stage.questions || []).flatMap((question) => [question.prompt?.ja, question.prompt?.en]),
  ].filter(Boolean).join(" ");
}

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}

function parseArgs(argv) {
  const result = { check: false, stageIds: new Set() };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--check") result.check = true;
    else if (argv[index] === "--stage") {
      const id = argv[++index] || "";
      if (!/^L[1-5]-[0-9]{3}$/.test(id)) throw new Error(`Invalid --stage value: ${id}`);
      result.stageIds.add(id);
    } else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return result;
}
