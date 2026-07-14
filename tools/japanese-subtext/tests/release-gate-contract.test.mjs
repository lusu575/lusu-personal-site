import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";

import {
  RELEASE_CONTRACT,
  RELEASE_GATES,
  findLegacyStageAssetResidue,
  releaseContractMarker,
  releaseGateEvidenceSha256,
  releaseGateMarker,
  releaseContractSha256,
  readWebpDimensions,
  validateFinalStatsContract,
  validateImage2BackgroundContract,
  validateReleaseReportContract,
} from "../scripts/release-gate-contract.mjs";
import { resolveLiveAuditOptions } from "../scripts/run-live-audio-audit.mjs";

function approvedBackgroundManifest() {
  const sha = "a".repeat(64);
  const dHash = "b".repeat(16);
  const promptHash = "c".repeat(64);
  const styleBibleHash = "d".repeat(64);
  return {
    schemaVersion: 3,
    kind: "japanese-subtext-image2-assets",
    contentVersion: "1.0.3",
    model: "gpt-image-2",
    quality: "high",
    styleBibleHash,
    reviewStatus: "codex-approved",
    backgroundCount: 2,
    backgrounds: [
      {
        backgroundId: "desktop",
        model: "gpt-image-2",
        quality: "high",
        promptHash,
        styleBibleHash,
        reviewStatus: "codex-approved",
        dHash,
        generatorProvenance: {
          provider: "OpenAI Images",
          model: "gpt-image-2",
          operation: "generate",
          evidenceType: "openai-images-api-v1",
        },
        generationEvidence: {
          evidenceType: "openai-images-api-v1",
          stateSchemaVersion: 1,
          stateSha256: sha,
          requestSchemaVersion: "openai-images-gpt-image-2-v1",
          provider: "OpenAI Images",
          model: "gpt-image-2",
          endpoint: "/v1/images/generations",
          requestId: "req_background_desktop",
          generatedAt: "2026-07-12T00:00:00.000Z",
          attempts: 1,
          promptSchemaVersion: "japanese-subtext-image2-background-prompt-v1",
        },
        published: {
          path: "assets/backgrounds/v1.0.3/trainer-backdrop-desktop.webp",
          width: 2048,
          height: 1152,
          format: "webp",
          sha256: sha,
          bytes: 100,
        },
      },
      {
        backgroundId: "mobile",
        model: "gpt-image-2",
        quality: "high",
        promptHash,
        styleBibleHash,
        reviewStatus: "codex-approved",
        dHash,
        generatorProvenance: {
          provider: "OpenAI Images",
          model: "gpt-image-2",
          operation: "generate",
          evidenceType: "openai-images-api-v1",
        },
        generationEvidence: {
          evidenceType: "openai-images-api-v1",
          stateSchemaVersion: 1,
          stateSha256: sha,
          requestSchemaVersion: "openai-images-gpt-image-2-v1",
          provider: "OpenAI Images",
          model: "gpt-image-2",
          endpoint: "/v1/images/generations",
          requestId: "req_background_mobile",
          generatedAt: "2026-07-12T00:00:00.000Z",
          attempts: 1,
          promptSchemaVersion: "japanese-subtext-image2-background-prompt-v1",
        },
        published: {
          path: "assets/backgrounds/v1.0.3/trainer-backdrop-mobile.webp",
          width: 1024,
          height: 1536,
          format: "webp",
          sha256: sha,
          bytes: 100,
        },
      },
    ],
  };
}

const approvedBackgroundCss = `
body { background-image: url("./assets/backgrounds/v1.0.3/trainer-backdrop-desktop.webp"); }
@media (orientation: portrait) and (max-width: 900px) {
  body { background-image: url("./assets/backgrounds/v1.0.3/trainer-backdrop-mobile.webp"); }
}
`;

function currentAudioManifest() {
  return {
    contentVersion: "1.0.3",
    stats: {
      scene: 250,
      line: 2400,
      option: 2445,
      token: 4993,
      durationSeconds: 12345.678,
      bytes: 456789,
    },
  };
}

function currentFinalStats(audioManifest = currentAudioManifest()) {
  return {
    contentVersion: "1.0.3",
    audioContentVersion: "1.0.3",
    illustratedStages: 250,
    illustrationModels: { "gpt-image-2": 250 },
    generatedAudio: structuredClone(audioManifest.stats),
  };
}

function reportWith(status) {
  return [
    "# 日本語の裏側 1.0.3 发布验收报告",
    "",
    releaseContractMarker(),
    ...RELEASE_GATES.map((gate) => releaseGateMarker(gate, status)),
  ].join("\n");
}

function autoSection(name, text) {
  return [
    `<!-- AUTO:${name}:START -->`,
    text,
    `<!-- AUTO:${name}:END -->`,
  ].join("\n");
}

function completeReport({
  audioManifest = currentAudioManifest(),
  imageManifest = approvedBackgroundManifest(),
  finalStats = currentFinalStats(audioManifest),
  browserEvidence = "QA complete for zh/en/ja and every required viewport.",
} = {}) {
  let report = [
    "# 日本語の裏側 1.0.3 发布验收报告",
    "",
    "> 状态：**已通过**。全部发布证据已按当前契约复核。",
    "",
    releaseContractMarker(),
    "",
    autoSection("IMAGE2_VALIDATION", "250 stage images and two backgrounds verified."),
    autoSection("AUDIO_ITEM_COUNT", "10088"),
    autoSection("AUDIO_STAGE_COUNT", "250"),
    autoSection("AUDIO_DURATION", "12345.678 seconds"),
    autoSection("AUDIO_BYTES", "456789 bytes"),
    autoSection("AUDIO_VALIDATION", "Full fresh Aivis media audit passed."),
    autoSection("BROWSER_QA", browserEvidence),
  ].join("\n");
  const evidence = { report, audioManifest, imageManifest, finalStats };
  report += `\n${RELEASE_GATES.map((gate) => releaseGateMarker(
    gate,
    "PASS",
    releaseGateEvidenceSha256(gate, evidence),
  )).join("\n")}`;
  return { report, audioManifest, imageManifest, finalStats };
}

test("the release contract is locked to 1.0.3, r6, Aivis 44.1 kHz, and gpt-image-2 high", () => {
  assert.deepEqual(RELEASE_CONTRACT, {
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
  assert.match(releaseContractSha256(), /^[a-f0-9]{64}$/);
});

test("launch and 1.0.1 public update copy is frozen by trilingual fingerprints", async () => {
  const buildCheck = await readFile(
    path.resolve(import.meta.dirname, "../../../scripts/build-check.mjs"),
    "utf8",
  );
  const locked = {
    "seed-update-2026-07-11-japanese-subtext-v1-0-1": [
      "e9de5e7d71fe9d534ff82990d95066555505a19f9ed41a96018feeb4cd51ca9d",
      "faca8facd1889753f676401c6bc689421653689cd89592b725eb2a156bb55e87",
      "d5a3f345263d1804bc7a77759bcb83c60d4456c7a6a827e644c8904b5598ec71",
    ],
    "seed-update-2026-07-11-japanese-subtext-launch": [
      "0c85c6ca694ee6e93b123b82102f31b5200a5550f8ddb1a75f73a6b4101bcd83",
      "4605a26ebcc2d64c5148601e997497a36a78f5f5fda743c5f2edff3cdf422e90",
      "95318f789ec62e93ec7a7b7ea784335756cc30b4d1bea70808413c5b5bd1f119",
    ],
  };
  for (const [articleId, fingerprints] of Object.entries(locked)) {
    const start = buildCheck.indexOf(`id: "${articleId}"`);
    assert.ok(start >= 0, `${articleId} must remain in the immutable update contract`);
    const block = buildCheck.slice(start, start + 900);
    assert.match(block, /legacyFingerprints:\s*\{/);
    for (const fingerprint of fingerprints) assert.ok(block.includes(fingerprint));
  }
});

test("the build guard rejects only top-level legacy stage assets after Image2 activation", async () => {
  const topLevelNames = [
    "manifest.json",
    "l1-001.webp",
    "L5-050.WEBP",
    "v1.0.3",
    "notes.txt",
    "v1.0.3/l1-001.webp",
  ];
  assert.deepEqual(findLegacyStageAssetResidue(topLevelNames), []);
  assert.deepEqual(
    findLegacyStageAssetResidue(topLevelNames, { image2Active: true }),
    ["L5-050.WEBP", "l1-001.webp", "manifest.json"],
  );

  const buildCheck = await readFile(
    path.resolve(import.meta.dirname, "../../../scripts/build-check.mjs"),
    "utf8",
  );
  assert.match(buildCheck, /readdirSync\(resolve\(root, `\$\{toolRoot\}\/assets\/stages`\), \{ withFileTypes: true \}\)/);
  assert.match(buildCheck, /findLegacyStageAssetResidue\([\s\S]*?image2Active: image2ManifestActive/);
});

test("a stale unbound 1.0.2 PASS report cannot satisfy the current release gate", () => {
  const staleReport = [
    "# 日本語の裏側 1.0.2 发布验收报告",
    "<!-- RELEASE:AUDIO_VALIDATION:PASS -->",
    "<!-- RELEASE:BROWSER_QA:PASS -->",
  ].join("\n");
  const errors = validateReleaseReportContract(staleReport, { requirePass: true });
  assert.ok(errors.some((error) => error.includes("1.0.3")));
  assert.ok(errors.some((error) => error.includes("contract marker")));
  assert.ok(errors.some((error) => error.includes("unbound PASS")));
});

test("the report may be current but pending, while unbound PASS markers are rejected", () => {
  const pendingErrors = validateReleaseReportContract(reportWith("PENDING"), { requirePass: true });
  assert.equal(pendingErrors.length, RELEASE_GATES.length);
  assert.ok(pendingErrors.every((error) => error.includes("is PENDING")));
  const unboundPassErrors = validateReleaseReportContract(reportWith("PASS"), { requirePass: true });
  assert.ok(unboundPassErrors.some((error) => /evidence/i.test(error)));
});

test("changing only hidden gate words cannot pass while visible evidence remains pending", async () => {
  const report = await readFile(
    path.resolve(import.meta.dirname, "../reports/release-report.md"),
    "utf8",
  );
  const hiddenOnlyPromotion = report.replaceAll(":PENDING contract=", ":PASS contract=");
  const errors = validateReleaseReportContract(hiddenOnlyPromotion, { requirePass: true });
  assert.ok(errors.some((error) => /evidence|visible|pending/i.test(error)));
});

test("PASS markers bind final audio, image, stats, and their exact AUTO evidence", () => {
  const complete = completeReport();
  assert.deepEqual(validateReleaseReportContract(complete.report, {
    requirePass: true,
    audioManifest: complete.audioManifest,
    imageManifest: complete.imageManifest,
    finalStats: complete.finalStats,
  }), []);

  const staleQa = complete.report.replace("QA complete", "QA changed after approval");
  assert.ok(validateReleaseReportContract(staleQa, {
    requirePass: true,
    audioManifest: complete.audioManifest,
    imageManifest: complete.imageManifest,
    finalStats: complete.finalStats,
  }).some((error) => /BROWSER_QA.*evidence/i.test(error)));

  const changedAudio = structuredClone(complete.audioManifest);
  changedAudio.stats.bytes += 1;
  assert.ok(validateReleaseReportContract(complete.report, {
    requirePass: true,
    audioManifest: changedAudio,
    imageManifest: complete.imageManifest,
    finalStats: complete.finalStats,
  }).some((error) => /evidence/i.test(error)));

  const changedImage = structuredClone(complete.imageManifest);
  changedImage.styleBibleHash = "e".repeat(64);
  assert.ok(validateReleaseReportContract(complete.report, {
    requirePass: true,
    audioManifest: complete.audioManifest,
    imageManifest: changedImage,
    finalStats: complete.finalStats,
  }).some((error) => /evidence/i.test(error)));

  const changedStats = structuredClone(complete.finalStats);
  changedStats.generatedAudio.durationSeconds += 1;
  assert.ok(validateReleaseReportContract(complete.report, {
    requirePass: true,
    audioManifest: complete.audioManifest,
    imageManifest: complete.imageManifest,
    finalStats: changedStats,
  }).some((error) => /evidence/i.test(error)));

  const visiblyPending = completeReport({ browserEvidence: "等待人工审核。" });
  assert.ok(validateReleaseReportContract(visiblyPending.report, {
    requirePass: true,
    audioManifest: visiblyPending.audioManifest,
    imageManifest: visiblyPending.imageManifest,
    finalStats: visiblyPending.finalStats,
  }).some((error) => /visible.*pending/i.test(error)));

  const explanatoryUse = `${complete.report}\n\n文档说明：旧的 \`PENDING\` 标记不能复用。`;
  assert.deepEqual(validateReleaseReportContract(explanatoryUse, {
    requirePass: true,
    audioManifest: complete.audioManifest,
    imageManifest: complete.imageManifest,
    finalStats: complete.finalStats,
  }), []);

  const pendingTable = complete.report.replace(
    releaseContractMarker(),
    `${releaseContractMarker()}\n\n## 发布门槛\n\n| 门槛 | 状态 |\n| --- | --- |\n| 浏览器回归 | 待验收 |`,
  );
  assert.ok(validateReleaseReportContract(pendingTable, {
    requirePass: true,
    audioManifest: complete.audioManifest,
    imageManifest: complete.imageManifest,
    finalStats: complete.finalStats,
  }).some((error) => /visible.*pending/i.test(error)));
});

test("final statistics bind both content versions and exactly mirror audio manifest.stats", () => {
  const audioManifest = currentAudioManifest();
  assert.deepEqual(validateFinalStatsContract(currentFinalStats(audioManifest), audioManifest), []);

  const staleVersion = currentFinalStats(audioManifest);
  staleVersion.contentVersion = "1.0.2";
  assert.ok(validateFinalStatsContract(staleVersion, audioManifest).some((error) => error.includes("contentVersion")));

  const mismatchedAudio = currentFinalStats(audioManifest);
  mismatchedAudio.generatedAudio.durationSeconds += 0.001;
  assert.ok(validateFinalStatsContract(mismatchedAudio, audioManifest).some((error) => error.includes("exactly match")));

  const legacyImages = currentFinalStats(audioManifest);
  legacyImages.illustrationModels = { "local-four-panel-v2": 250 };
  assert.ok(validateFinalStatsContract(legacyImages, audioManifest).some((error) => error.includes("gpt-image-2")));
});

test("both versioned backgrounds require approved gpt-image-2 high metadata and exact CSS URLs", () => {
  const manifest = approvedBackgroundManifest();
  assert.deepEqual(validateImage2BackgroundContract(manifest, approvedBackgroundCss), []);

  const stalePath = structuredClone(manifest);
  stalePath.backgrounds[0].published.path = "assets/backgrounds/trainer-backdrop-desktop.webp";
  assert.ok(validateImage2BackgroundContract(stalePath, approvedBackgroundCss).some((error) => error.includes("versioned path")));

  const wrongSize = structuredClone(manifest);
  wrongSize.backgrounds[1].published.height = 1152;
  assert.ok(validateImage2BackgroundContract(wrongSize, approvedBackgroundCss).some((error) => error.includes("1024x1536")));

  const wrongModel = structuredClone(manifest);
  wrongModel.backgrounds[0].model = "gpt-image-1";
  assert.ok(validateImage2BackgroundContract(wrongModel, approvedBackgroundCss).some((error) => error.includes("gpt-image-2 high")));

  const missingGenerationEvidence = structuredClone(manifest);
  delete missingGenerationEvidence.backgrounds[0].generationEvidence;
  assert.ok(
    validateImage2BackgroundContract(missingGenerationEvidence, approvedBackgroundCss).some(
      (error) => error.includes("generation evidence"),
    ),
  );

  const pending = structuredClone(manifest);
  pending.backgrounds[0].reviewStatus = "pending-codex-review";
  assert.ok(validateImage2BackgroundContract(pending, approvedBackgroundCss).some((error) => error.includes("approved")));

  const staleCss = approvedBackgroundCss.replace("./assets/backgrounds/v1.0.3/", "./assets/backgrounds/");
  assert.ok(validateImage2BackgroundContract(manifest, staleCss).some((error) => error.includes("CSS")));

  const landscapeBreakingCss = approvedBackgroundCss.replace(
    "@media (orientation: portrait) and (max-width: 900px)",
    "@media (max-width: 900px)",
  );
  assert.ok(validateImage2BackgroundContract(manifest, landscapeBreakingCss).some((error) => error.includes("portrait <=900px")));
});

test("background release contract accepts audited Codex built-in image_gen evidence", () => {
  const manifest = approvedBackgroundManifest();
  for (const [index, entry] of manifest.backgrounds.entries()) {
    const toolRunId = `exec-00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    entry.generatorProvenance = {
      ...entry.generatorProvenance,
      evidenceType: "codex-builtin-imagegen-v1",
      tool: "image_gen.imagegen",
    };
    entry.generationEvidence = {
      evidenceType: "codex-builtin-imagegen-v1",
      stateSchemaVersion: 1,
      stateSha256: "a".repeat(64),
      provider: "OpenAI Images",
      model: "gpt-image-2",
      tool: "image_gen.imagegen",
      toolRunId,
      generatedAt: "2026-07-12T00:00:00.000Z",
      promptSchemaVersion: "japanese-subtext-image2-background-prompt-v1",
      sourceArtifactSha256: "e".repeat(64),
      sourceArtifactBytes: 4096,
      sourceArtifactWidth: index === 0 ? 2048 : 1024,
      sourceArtifactHeight: index === 0 ? 1152 : 1536,
      normalizationSchemaVersion: "codex-builtin-imagegen-normalization-v1",
      normalizationOperation: "aspect-verified-resize",
      normalizationKernel: "lanczos3",
      reviewStatus: "codex-approved",
      reviewedAt: "2026-07-12T00:00:00.000Z",
      reviewer: "codex-visual-review",
      reviewEvidenceSha256: "f".repeat(64),
    };
  }

  assert.deepEqual(validateImage2BackgroundContract(manifest, approvedBackgroundCss), []);
  manifest.backgrounds[0].generationEvidence.endpoint = "/v1/images/generations";
  assert.ok(
    validateImage2BackgroundContract(manifest, approvedBackgroundCss).some((error) =>
      error.includes("generation evidence"),
    ),
  );
});

test("WebP dimensions are read from the actual VP8X payload", () => {
  const buffer = Buffer.alloc(30);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(22, 4);
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8X", 12, "ascii");
  buffer.writeUInt32LE(10, 16);
  buffer.writeUIntLE(2048 - 1, 24, 3);
  buffer.writeUIntLE(1152 - 1, 27, 3);
  assert.deepEqual(readWebpDimensions(buffer), { width: 2048, height: 1152 });
  assert.throws(() => readWebpDimensions(Buffer.from("not webp")), /WebP/i);
});

test("the formal release check includes a separately configured fresh full-media audit", async () => {
  const packageJson = JSON.parse(await readFile(path.resolve(import.meta.dirname, "../../../package.json"), "utf8"));
  const buildCheck = await readFile(path.resolve(import.meta.dirname, "../../../scripts/build-check.mjs"), "utf8");
  assert.equal(
    packageJson.scripts["jp-subtext:audio:audit:live"],
    "node tools/japanese-subtext/scripts/run-live-audio-audit.mjs",
  );
  assert.match(
    packageJson.scripts["jp-subtext:image2:check"],
    /publish-image2-assets\.mjs\s+--check\b/,
  );
  assert.match(packageJson.scripts["jp-subtext:image2:check"], /--review-status codex-approved\b/);
  assert.match(buildCheck, /reviewStatus\s*!==\s*"codex-approved"/);
  assert.doesNotMatch(buildCheck, /human-approved|pending-human-review/);
  const steps = packageJson.scripts["jp-subtext:release-check"].split("&&").map((step) => step.trim());
  assert.deepEqual(steps, [
    "npm run jp-subtext:validate",
    "npm run jp-subtext:audio:validate -- --check-silence",
    "npm run jp-subtext:audio:audit:live",
    "npm run jp-subtext:image2:check",
    "npm run jp-subtext:test:tts-python",
    "npm run jp-subtext:test",
    "npm run build",
  ]);
  assert.match(buildCheck, /truePeakDbtp\s*<=\s*-2\.0/);
});

test("live audit defaults to the published repository audio and rejects an external release root", () => {
  assert.throws(() => resolveLiveAuditOptions({ env: {}, argv: [] }), /JP_SUBTEXT_TTS_CONFIG/);
  assert.throws(() => resolveLiveAuditOptions({
    env: {
      JP_SUBTEXT_TTS_CONFIG: "C:/audit/tts.json",
      JP_SUBTEXT_AUDIO_MANIFEST: "C:/audit/audio/manifest.json",
      JP_SUBTEXT_AUDIO_ROOT: "C:/audit/audio",
    },
    argv: [],
    checkFiles: false,
  }), /published repository audio|release audio root/i);
  const invocationCwd = path.resolve("C:/audit-runner");
  const options = resolveLiveAuditOptions({
    env: {
      JP_SUBTEXT_TTS_CONFIG: "C:/audit/tts.json",
      JP_SUBTEXT_PYTHON: "./venv/bin/python",
    },
    argv: [],
    checkFiles: false,
    cwd: invocationCwd,
  });
  assert.equal(options.python, path.resolve(invocationCwd, "./venv/bin/python"));
  assert.equal(path.basename(options.manifest), "manifest.json");
  assert.equal(path.dirname(options.manifest), options.audioRoot);
  assert.equal(
    options.audioRoot,
    path.resolve(import.meta.dirname, "../audio"),
  );
});
