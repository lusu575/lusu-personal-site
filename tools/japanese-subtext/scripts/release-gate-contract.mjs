import { createHash } from "node:crypto";

export const RELEASE_CONTRACT = Object.freeze({
  contentVersion: "1.0.3",
  assetVersion: "20260712-japanese-subtext-v103-r6",
  audioPipeline: "aivisspeech-1.2.0-aivmx-v3",
  audioClaritySchemaVersion: 3,
  audioSampleRate: 44100,
  imageModel: "gpt-image-2",
  imageQuality: "high",
  stageImageCount: 250,
  backgroundImageCount: 2,
});

export const RELEASE_GATES = Object.freeze([
  "AUDIO_VALIDATION",
  "IMAGE2_VALIDATION",
  "BROWSER_QA",
]);

const APPROVED_REVIEW_STATUSES = new Set(["codex-approved"]);
const API_IMAGE_EVIDENCE_TYPE = "openai-images-api-v1";
const BUILTIN_IMAGE_EVIDENCE_TYPE = "codex-builtin-imagegen-v1";
const BUILTIN_IMAGE_TOOL = "image_gen.imagegen";
const TOOL_RUN_ID_PATTERN =
  /^exec-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_STAGE_ASSET_PATTERN = /^(?:manifest\.json|l[1-5]-[0-9]{3}\.webp)$/i;
const RELEASE_GATE_AUTO_SECTIONS = Object.freeze({
  AUDIO_VALIDATION: Object.freeze([
    "AUDIO_ITEM_COUNT",
    "AUDIO_STAGE_COUNT",
    "AUDIO_DURATION",
    "AUDIO_BYTES",
    "AUDIO_VALIDATION",
  ]),
  IMAGE2_VALIDATION: Object.freeze(["IMAGE2_VALIDATION"]),
  BROWSER_QA: Object.freeze(["BROWSER_QA"]),
});
const BACKGROUND_CONTRACTS = Object.freeze({
  desktop: Object.freeze({
    path: "assets/backgrounds/v1.0.3/trainer-backdrop-desktop.webp",
    cssPath: "./assets/backgrounds/v1.0.3/trainer-backdrop-desktop.webp",
    width: 2048,
    height: 1152,
  }),
  mobile: Object.freeze({
    path: "assets/backgrounds/v1.0.3/trainer-backdrop-mobile.webp",
    cssPath: "./assets/backgrounds/v1.0.3/trainer-backdrop-mobile.webp",
    width: 1024,
    height: 1536,
  }),
});

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function countLiteral(source, literal) {
  return String(source || "").split(literal).length - 1;
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isCanonicalIsoDate(value) {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}

function validImage2GenerationEvidence(entry, promptSchemaVersion) {
  const generation = entry?.generationEvidence || {};
  const provenance = entry?.generatorProvenance || {};
  const common =
    generation.stateSchemaVersion === 1
    && isSha256(generation.stateSha256)
    && generation.provider === "OpenAI Images"
    && generation.model === RELEASE_CONTRACT.imageModel
    && isCanonicalIsoDate(generation.generatedAt)
    && generation.promptSchemaVersion === promptSchemaVersion
    && provenance.evidenceType === generation.evidenceType;
  if (!common) return false;
  if (generation.evidenceType === API_IMAGE_EVIDENCE_TYPE) {
    return (
      generation.requestSchemaVersion === "openai-images-gpt-image-2-v1"
      && generation.endpoint === "/v1/images/generations"
      && /^req[_-][A-Za-z0-9_-]{4,}$/.test(generation.requestId || "")
      && Number.isInteger(generation.attempts)
      && generation.attempts >= 1
      && generation.attempts <= 8
      && !Object.hasOwn(generation, "tool")
      && !Object.hasOwn(provenance, "tool")
    );
  }
  if (generation.evidenceType === BUILTIN_IMAGE_EVIDENCE_TYPE) {
    return (
      generation.tool === BUILTIN_IMAGE_TOOL
      && provenance.tool === BUILTIN_IMAGE_TOOL
      && TOOL_RUN_ID_PATTERN.test(generation.toolRunId || "")
      && isSha256(generation.sourceArtifactSha256)
      && Number.isSafeInteger(generation.sourceArtifactBytes)
      && generation.sourceArtifactBytes > 0
      && Number.isSafeInteger(generation.sourceArtifactWidth)
      && generation.sourceArtifactWidth > 0
      && Number.isSafeInteger(generation.sourceArtifactHeight)
      && generation.sourceArtifactHeight > 0
      && generation.normalizationSchemaVersion === "codex-builtin-imagegen-normalization-v1"
      && generation.normalizationOperation === "aspect-verified-resize"
      && generation.normalizationKernel === "lanczos3"
      && generation.reviewStatus === "codex-approved"
      && isCanonicalIsoDate(generation.reviewedAt)
      && new Date(generation.reviewedAt) >= new Date(generation.generatedAt)
      && typeof generation.reviewer === "string"
      && generation.reviewer.trim() !== ""
      && isSha256(generation.reviewEvidenceSha256)
      && !Object.hasOwn(generation, "requestSchemaVersion")
      && !Object.hasOwn(generation, "endpoint")
      && !Object.hasOwn(generation, "requestId")
      && !Object.hasOwn(generation, "attempts")
    );
  }
  return false;
}

export function releaseContractSha256() {
  return createHash("sha256").update(canonicalJson(RELEASE_CONTRACT), "utf8").digest("hex");
}

export function releaseContractMarker() {
  return `<!-- RELEASE:CONTRACT:${canonicalJson(RELEASE_CONTRACT)} -->`;
}

function requiredEvidenceObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is required to bind release evidence`);
  }
  return value;
}

function autoSectionContent(report, name) {
  const source = String(report || "").replaceAll("\r\n", "\n");
  const start = `<!-- AUTO:${name}:START -->`;
  const end = `<!-- AUTO:${name}:END -->`;
  if (countLiteral(source, start) !== 1 || countLiteral(source, end) !== 1) {
    throw new Error(`AUTO ${name} evidence section must appear exactly once`);
  }
  const startIndex = source.indexOf(start) + start.length;
  const endIndex = source.indexOf(end, startIndex);
  if (endIndex < startIndex) throw new Error(`AUTO ${name} evidence section is malformed`);
  const content = source.slice(startIndex, endIndex).trim();
  if (!content) throw new Error(`AUTO ${name} evidence section must not be empty`);
  return content;
}

const VISIBLE_PENDING_PATTERN = /\bPENDING\b|当前待验收|待资产落地|待验收|等待|待审核|待复核|待确认|未完成|未通过|未验收/;

function visibleGateTableStatuses(report) {
  const source = String(report || "").replaceAll("\r\n", "\n");
  const headingIndex = source.indexOf("## 发布门槛");
  if (headingIndex < 0) return [];
  const rest = source.slice(headingIndex + "## 发布门槛".length);
  const nextHeading = rest.search(/\n##\s+/);
  const section = nextHeading >= 0 ? rest.slice(0, nextHeading) : rest;
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|") && !/^\|[\s|:-]+\|$/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 2 && cells[0] !== "门槛")
    .map((cells) => cells.at(-1));
}

export function releaseGateEvidenceSha256(gate, {
  report,
  audioManifest,
  imageManifest,
  finalStats,
} = {}) {
  if (!RELEASE_GATES.includes(gate)) throw new Error(`Unknown release gate: ${gate}`);
  const artifacts = {
    audioManifest: requiredEvidenceObject(audioManifest, "audioManifest"),
    imageManifest: requiredEvidenceObject(imageManifest, "imageManifest"),
    finalStats: requiredEvidenceObject(finalStats, "finalStats"),
  };
  const autoSections = Object.fromEntries(
    RELEASE_GATE_AUTO_SECTIONS[gate].map((name) => [name, autoSectionContent(report, name)]),
  );
  const evidence = {
    schemaVersion: 1,
    gate,
    contractSha256: releaseContractSha256(),
    artifactSha256: Object.fromEntries(
      Object.entries(artifacts).map(([name, value]) => [
        name,
        createHash("sha256").update(canonicalJson(value), "utf8").digest("hex"),
      ]),
    ),
    autoSections,
  };
  return createHash("sha256").update(canonicalJson(evidence), "utf8").digest("hex");
}

export function releaseGateMarker(gate, status, evidenceSha256 = "") {
  if (!RELEASE_GATES.includes(gate)) throw new Error(`Unknown release gate: ${gate}`);
  if (!new Set(["PASS", "PENDING"]).has(status)) throw new Error(`Invalid release gate status: ${status}`);
  const evidence = status === "PASS" && isSha256(evidenceSha256)
    ? ` evidence=${evidenceSha256}`
    : "";
  return `<!-- RELEASE:${gate}:${status} contract=${releaseContractSha256()}${evidence} -->`;
}

export function validateReleaseReportContract(report, {
  requirePass = true,
  audioManifest,
  imageManifest,
  finalStats,
} = {}) {
  const source = String(report || "");
  const errors = [];
  const expectedHeading = `# 日本語の裏側 ${RELEASE_CONTRACT.contentVersion} 发布验收报告`;
  if (!source.startsWith(expectedHeading)) {
    errors.push(`release report heading must target ${RELEASE_CONTRACT.contentVersion}`);
  }

  const expectedContractMarker = releaseContractMarker();
  const allContractMarkers = source.match(/<!-- RELEASE:CONTRACT:[\s\S]*? -->/g) || [];
  if (countLiteral(source, expectedContractMarker) !== 1 || allContractMarkers.length !== 1) {
    errors.push("release report contract marker must appear exactly once and match the current version/cache/pipeline/image2 contract");
  }
  if (/<!-- RELEASE:[A-Z0-9_]+:PASS -->/.test(source)) {
    errors.push("release report contains an unbound PASS marker from an older contract");
  }

  let passGateCount = 0;
  for (const gate of RELEASE_GATES) {
    const markerPattern = new RegExp(
      `<!-- RELEASE:${gate}:(PASS|PENDING) contract=([a-f0-9]{64})(?: evidence=([a-f0-9]{64}))? -->`,
      "g",
    );
    const markers = [...source.matchAll(markerPattern)];
    if (markers.length !== 1) {
      errors.push(`release report gate ${gate} must have exactly one bound PASS or PENDING marker`);
      continue;
    }
    const [, status, contractHash, evidenceHash] = markers[0];
    if (contractHash !== releaseContractSha256()) {
      errors.push(`release report gate ${gate} is bound to a stale release contract`);
    }
    if (status === "PASS") {
      passGateCount += 1;
      if (!isSha256(evidenceHash)) {
        errors.push(`release report gate ${gate} PASS must include a bound evidence SHA-256`);
      } else {
        try {
          const expectedEvidence = releaseGateEvidenceSha256(gate, {
            report: source,
            audioManifest,
            imageManifest,
            finalStats,
          });
          if (evidenceHash !== expectedEvidence) {
            errors.push(`release report gate ${gate} PASS evidence SHA-256 does not match final artifacts and AUTO evidence`);
          }
        } catch (error) {
          errors.push(`release report gate ${gate} PASS evidence is incomplete: ${error.message}`);
        }
      }
    } else if (requirePass) {
      errors.push(`release report gate ${gate} is PENDING for the current contract`);
    }
  }
  if (passGateCount === RELEASE_GATES.length) {
    if (!/^> 状态：\*\*(?:已通过|PASS)\*\*/m.test(source)) {
      errors.push("release report visible status must say 已通过 when every gate is PASS");
    }
    const autoEvidence = [...new Set(Object.values(RELEASE_GATE_AUTO_SECTIONS).flat())]
      .map((name) => {
        try {
          return autoSectionContent(source, name);
        } catch {
          return "";
        }
      });
    if (
      autoEvidence.some((content) => VISIBLE_PENDING_PATTERN.test(content))
      || visibleGateTableStatuses(source).some((status) => VISIBLE_PENDING_PATTERN.test(status))
    ) {
      errors.push("release report visible evidence must not remain pending when every gate is PASS");
    }
  }
  return errors;
}

export function validateFinalStatsContract(finalStats, audioManifest) {
  const stats = finalStats && typeof finalStats === "object" ? finalStats : {};
  const audio = audioManifest && typeof audioManifest === "object" ? audioManifest : {};
  const errors = [];
  if (stats.contentVersion !== RELEASE_CONTRACT.contentVersion) {
    errors.push(`final-stats contentVersion must be ${RELEASE_CONTRACT.contentVersion}`);
  }
  if (
    stats.audioContentVersion !== RELEASE_CONTRACT.contentVersion
    || audio.contentVersion !== RELEASE_CONTRACT.contentVersion
    || stats.audioContentVersion !== audio.contentVersion
  ) {
    errors.push(`final-stats audioContentVersion and audio manifest contentVersion must both be ${RELEASE_CONTRACT.contentVersion}`);
  }
  if (
    stats.illustratedStages !== RELEASE_CONTRACT.stageImageCount
    || canonicalJson(stats.illustrationModels) !== canonicalJson({ [RELEASE_CONTRACT.imageModel]: RELEASE_CONTRACT.stageImageCount })
  ) {
    errors.push(`final-stats illustrationModels must contain exactly ${RELEASE_CONTRACT.imageModel}=250`);
  }
  if (canonicalJson(stats.generatedAudio) !== canonicalJson(audio.stats)) {
    errors.push("final-stats generatedAudio must exactly match audio/manifest.json stats");
  }
  return errors;
}

export function findLegacyStageAssetResidue(topLevelNames, {
  image2Active = false,
} = {}) {
  if (!image2Active) return [];
  const names = Array.isArray(topLevelNames) ? topLevelNames : [];
  return [...new Set(
    names.filter((name) => typeof name === "string" && LEGACY_STAGE_ASSET_PATTERN.test(name)),
  )].sort();
}

export function validateImage2BackgroundContract(manifest, cssSource) {
  const data = manifest && typeof manifest === "object" ? manifest : {};
  const css = String(cssSource || "");
  const errors = [];
  if (
    data.schemaVersion !== 3
    || data.kind !== "japanese-subtext-image2-assets"
    || data.contentVersion !== RELEASE_CONTRACT.contentVersion
    || data.model !== RELEASE_CONTRACT.imageModel
    || data.quality !== RELEASE_CONTRACT.imageQuality
    || data.backgroundCount !== RELEASE_CONTRACT.backgroundImageCount
    || !APPROVED_REVIEW_STATUSES.has(data.reviewStatus)
  ) {
    errors.push("image2 manifest must be the approved 1.0.3 gpt-image-2 high v3 publication with two backgrounds");
  }

  const entries = Array.isArray(data.backgrounds) ? data.backgrounds : [];
  const byId = new Map(entries.map((entry) => [entry?.backgroundId, entry]));
  if (entries.length !== 2 || byId.size !== 2 || Object.keys(BACKGROUND_CONTRACTS).some((id) => !byId.has(id))) {
    errors.push("image2 manifest must contain exactly the desktop and mobile backgrounds");
  }

  for (const [id, expected] of Object.entries(BACKGROUND_CONTRACTS)) {
    const entry = byId.get(id) || {};
    const published = entry.published || {};
    if (published.path !== expected.path) {
      errors.push(`image2 ${id} background must use versioned path ${expected.path}`);
    }
    if (published.width !== expected.width || published.height !== expected.height || published.format !== "webp") {
      errors.push(`image2 ${id} background must be an actual ${expected.width}x${expected.height} WebP`);
    }
    if (
      entry.model !== RELEASE_CONTRACT.imageModel
      || entry.quality !== RELEASE_CONTRACT.imageQuality
      || entry.reviewStatus !== data.reviewStatus
      || !APPROVED_REVIEW_STATUSES.has(entry.reviewStatus)
      || entry.generatorProvenance?.provider !== "OpenAI Images"
      || entry.generatorProvenance?.model !== RELEASE_CONTRACT.imageModel
      || entry.generatorProvenance?.operation !== "generate"
    ) {
      errors.push(`image2 ${id} background must be approved gpt-image-2 high output from OpenAI Images`);
    }
    if (
      !isSha256(entry.promptHash)
      || entry.styleBibleHash !== data.styleBibleHash
      || !isSha256(entry.styleBibleHash)
      || !/^[a-f0-9]{16}$/.test(entry.dHash || "")
      || !isSha256(published.sha256)
      || !(published.bytes > 0)
    ) {
      errors.push(`image2 ${id} background must include prompt/style/dHash/file hash evidence`);
    }
    if (!validImage2GenerationEvidence(
      entry,
      "japanese-subtext-image2-background-prompt-v1",
    )) {
      errors.push(`image2 ${id} background must include bound OpenAI generation evidence`);
    }

    const cssToken = `url("${expected.cssPath}")`;
    if (countLiteral(css, cssToken) !== 1) {
      errors.push(`trainer CSS must reference ${expected.cssPath} exactly once`);
    }
  }

  if (!/@media\s*\(orientation:\s*portrait\)\s*and\s*\(max-width:\s*900px\)\s*\{[\s\S]*?url\("\.\/assets\/backgrounds\/v1\.0\.3\/trainer-backdrop-mobile\.webp"\)/.test(css)) {
    errors.push("trainer CSS must use the mobile background only inside the portrait <=900px media contract");
  }

  for (const filename of ["trainer-backdrop-desktop.webp", "trainer-backdrop-mobile.webp"]) {
    if (css.includes(`assets/backgrounds/${filename}`)) {
      errors.push(`trainer CSS must not retain the unversioned background URL assets/backgrounds/${filename}`);
    }
  }
  return errors;
}

export function readWebpDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 20 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("File is not a valid WebP RIFF container");
  }
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunk = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + chunkSize > buffer.length) throw new Error("WebP chunk exceeds file bounds");
    if (chunk === "VP8X" && chunkSize >= 10) {
      return {
        width: buffer.readUIntLE(dataOffset + 4, 3) + 1,
        height: buffer.readUIntLE(dataOffset + 7, 3) + 1,
      };
    }
    if (chunk === "VP8L" && chunkSize >= 5 && buffer[dataOffset] === 0x2f) {
      const b1 = buffer[dataOffset + 1];
      const b2 = buffer[dataOffset + 2];
      const b3 = buffer[dataOffset + 3];
      const b4 = buffer[dataOffset + 4];
      return {
        width: 1 + b1 + ((b2 & 0x3f) << 8),
        height: 1 + ((b2 & 0xc0) >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10),
      };
    }
    if (
      chunk === "VP8 "
      && chunkSize >= 10
      && buffer[dataOffset + 3] === 0x9d
      && buffer[dataOffset + 4] === 0x01
      && buffer[dataOffset + 5] === 0x2a
    ) {
      return {
        width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }
    offset = dataOffset + chunkSize + (chunkSize % 2);
  }
  throw new Error("WebP container has no supported VP8 dimension chunk");
}
