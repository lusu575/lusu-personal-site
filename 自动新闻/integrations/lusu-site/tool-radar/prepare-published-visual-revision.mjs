#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { publishedToolRadarImagePath } from "./validate-run.mjs";

const LANGUAGES = ["zh", "en", "ja"];

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--run") options.run = resolve(value);
    else if (argument === "--manifest") options.manifest = resolve(value);
    else if (argument === "--output") options.output = resolve(value);
    else if (argument === "--expected-updated-at") options.expectedUpdatedAt = value;
    else throw new Error(`Unknown argument: ${argument}`);
    index += 1;
  }
  if (!options.run || !options.manifest || !options.output) {
    throw new Error("Usage: prepare-published-visual-revision.mjs --run <run.json> --manifest <visual-revision.json> --output <payload.json>");
  }
  return options;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripImageBlocks(markdown) {
  return markdown.replace(/!\[[^\n]*\]\([^)]+\)\r?\n\r?\n\*[^\n]*\*/g, "<IMAGE_BLOCK>");
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function replaceImageBlock(markdown, image, language) {
  const oldPath = escapeRegExp(image.oldAssetPath);
  const pattern = new RegExp(`!\\[[^\\n]*\\]\\(${oldPath}\\)\\r?\\n\\r?\\n\\*[^\\n]*\\*`, "g");
  const matches = [...markdown.matchAll(pattern)];
  if (matches.length !== 1) {
    throw new Error(`${language}/${image.toolKey}: expected exactly one old image block, found ${matches.length}.`);
  }
  const alt = image.alt?.[language];
  const caption = image.caption?.[language];
  if (!alt || !caption) throw new Error(`${language}/${image.toolKey}: missing alt or caption.`);
  const replacement = `![${alt}](${publishedToolRadarImagePath(image)})\n\n*${caption}*`;
  return markdown.replace(pattern, replacement);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [run, manifest] = await Promise.all([
    readFile(options.run, "utf8").then(JSON.parse),
    readFile(options.manifest, "utf8").then(JSON.parse)
  ]);
  if (run.edition?.id !== manifest.editionId) {
    throw new Error(`Edition mismatch: ${run.edition?.id || "missing"} != ${manifest.editionId}.`);
  }
  if (!Array.isArray(manifest.images) || manifest.images.length !== 7) {
    throw new Error("The first-edition revision must contain exactly seven image records.");
  }

  const translations = {};
  const audit = {};
  for (const language of LANGUAGES) {
    const original = run.delivery?.translations?.[language];
    if (!original?.title || !original?.summary || !original?.content_markdown) {
      throw new Error(`Missing complete ${language} translation in the source run.`);
    }
    let contentMarkdown = original.content_markdown;
    for (const image of manifest.images) {
      contentMarkdown = replaceImageBlock(contentMarkdown, image, language);
    }
    if (stripImageBlocks(contentMarkdown) !== stripImageBlocks(original.content_markdown)) {
      throw new Error(`${language}: content outside the seven image blocks changed.`);
    }
    for (const image of manifest.images) {
      if (contentMarkdown.includes(image.oldAssetPath)) {
        throw new Error(`${language}/${image.toolKey}: old asset path remains.`);
      }
      const newCount = contentMarkdown.split(publishedToolRadarImagePath(image)).length - 1;
      if (newCount !== 1) {
        throw new Error(`${language}/${image.toolKey}: expected one new asset reference, found ${newCount}.`);
      }
    }
    translations[language] = {
      title: original.title,
      summary: original.summary,
      content_markdown: contentMarkdown
    };
    audit[language] = {
      originalContentSha256: sha256(original.content_markdown),
      revisedContentSha256: sha256(contentMarkdown),
      titleUnchanged: true,
      summaryUnchanged: true,
      nonImageContentUnchanged: true,
      replacedImageBlocks: manifest.images.length
    };
  }

  const payload = {
    ...(options.expectedUpdatedAt ? { expectedUpdatedAt: options.expectedUpdatedAt } : {}),
    translations
  };
  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(`${options.output}.audit.json`, `${JSON.stringify({
    schemaVersion: 1,
    editionId: manifest.editionId,
    revisionReason: manifest.revisionReason,
    manifestPath: options.manifest,
    sourceRunPath: options.run,
    outputPath: options.output,
    payloadSha256: sha256(JSON.stringify(payload)),
    audit
  }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    output: options.output,
    audit: `${options.output}.audit.json`,
    editionId: manifest.editionId,
    translationCount: LANGUAGES.length,
    imageBlocksReplacedPerLanguage: manifest.images.length
  }, null, 2));
}

main().catch((error) => {
  console.error(`prepare-published-visual-revision: ${error.message}`);
  process.exitCode = 1;
});
