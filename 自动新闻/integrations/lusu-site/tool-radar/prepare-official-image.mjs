#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

function parseArgs(argv) {
  const options = {
    maxWidth: 1440,
    quality: 88
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--input") options.input = resolve(value);
    else if (argument === "--output") options.output = resolve(value);
    else if (argument === "--left") options.left = Number(value);
    else if (argument === "--top") options.top = Number(value);
    else if (argument === "--width") options.width = Number(value);
    else if (argument === "--height") options.height = Number(value);
    else if (argument === "--max-width") options.maxWidth = Number(value);
    else if (argument === "--quality") options.quality = Number(value);
    else throw new Error(`Unknown argument: ${argument}`);
    index += 1;
  }
  if (!options.input || !options.output) {
    throw new Error("Usage: prepare-official-image.mjs --input <image> --output <png|webp> [crop options]");
  }
  if (!Number.isInteger(options.maxWidth) || options.maxWidth < 480 || options.maxWidth > 2560) {
    throw new Error("--max-width must be an integer between 480 and 2560.");
  }
  if (!Number.isInteger(options.quality) || options.quality < 60 || options.quality > 100) {
    throw new Error("--quality must be an integer between 60 and 100.");
  }
  const cropValues = ["left", "top", "width", "height"].map((key) => options[key]);
  const hasCrop = cropValues.some((value) => value !== undefined);
  if (hasCrop && cropValues.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error("--left, --top, --width and --height must all be non-negative integers when cropping.");
  }
  if (hasCrop && (options.width === 0 || options.height === 0)) {
    throw new Error("Crop width and height must be greater than zero.");
  }
  const outputExtension = extname(options.output).toLowerCase();
  if (![".png", ".webp"].includes(outputExtension)) {
    throw new Error("Output must use .png or .webp.");
  }
  return { ...options, hasCrop, outputExtension };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let pipeline = sharp(options.input, { failOn: "warning" }).rotate();
  if (options.hasCrop) {
    pipeline = pipeline.extract({
      left: options.left,
      top: options.top,
      width: options.width,
      height: options.height
    });
  }
  pipeline = pipeline.resize({
    width: options.maxWidth,
    withoutEnlargement: true,
    fit: "inside",
    kernel: sharp.kernel.lanczos3
  });
  if (options.outputExtension === ".webp") {
    pipeline = pipeline.webp({ quality: options.quality, effort: 6, smartSubsample: true });
  } else {
    pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  }
  await mkdir(dirname(options.output), { recursive: true });
  await pipeline.toFile(options.output);
  const bytes = await readFile(options.output);
  const metadata = await sharp(bytes).metadata();
  console.log(JSON.stringify({
    input: options.input,
    output: options.output,
    width: metadata.width,
    height: metadata.height,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex")
  }, null, 2));
}

main().catch((error) => {
  console.error(`prepare-official-image: ${error.message}`);
  process.exitCode = 1;
});
