#!/usr/bin/env node

import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const modulePath = fileURLToPath(import.meta.url);
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourcePath = resolve(root, "assets", "transfer", "quick-transfer-icons-source.png");
const outputPath = resolve(root, "assets", "transfer", "quick-transfer-icons.png");
const defaultOutputSize = 168;
const defaultCellsPerAxis = 4;

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] || 0;
}

function smoothstep(start, end, value) {
  const normalized = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return normalized * normalized * (3 - 2 * normalized);
}

function sampleBorderKey(data, width, height, channels) {
  const samples = [[], [], []];
  const take = (x, y) => {
    const offset = (y * width + x) * channels;
    for (let channel = 0; channel < 3; channel += 1) samples[channel].push(data[offset + channel]);
  };
  for (let x = 0; x < width; x += 1) {
    take(x, 0);
    take(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    take(0, y);
    take(width - 1, y);
  }
  return samples.map(median);
}

function removeMagentaKey(data, info, key) {
  const output = Buffer.alloc(info.width * info.height * 4);
  for (let sourceOffset = 0, outputOffset = 0; sourceOffset < data.length; sourceOffset += info.channels, outputOffset += 4) {
    const red = data[sourceOffset];
    const green = data[sourceOffset + 1];
    const blue = data[sourceOffset + 2];
    const sourceAlpha = info.channels > 3 ? data[sourceOffset + 3] / 255 : 1;
    const distance = Math.hypot(red - key[0], green - key[1], blue - key[2]);
    const isMagentaCandidate = red > 150 && blue > 150 && green < 125 && Math.abs(red - blue) < 100;
    const matteAlpha = isMagentaCandidate ? smoothstep(18, 78, distance) : 1;
    const alpha = sourceAlpha * matteAlpha;

    if (alpha <= 0.015) {
      output[outputOffset] = 0;
      output[outputOffset + 1] = 0;
      output[outputOffset + 2] = 0;
      output[outputOffset + 3] = 0;
      continue;
    }

    if (matteAlpha < 0.999) {
      const recover = (value, keyValue) => Math.max(0, Math.min(255, Math.round((value - keyValue * (1 - matteAlpha)) / matteAlpha)));
      output[outputOffset] = recover(red, key[0]);
      output[outputOffset + 1] = recover(green, key[1]);
      output[outputOffset + 2] = recover(blue, key[2]);
    } else {
      output[outputOffset] = red;
      output[outputOffset + 1] = green;
      output[outputOffset + 2] = blue;
    }
    output[outputOffset + 3] = Math.round(alpha * 255);
  }
  return output;
}

export async function buildTransferIconAtlas({
  source: sourceInput = sourcePath,
  outputSize = defaultOutputSize,
  cellsPerAxis = defaultCellsPerAxis
} = {}) {
  if (!Number.isInteger(outputSize) || outputSize <= 0
    || !Number.isInteger(cellsPerAxis) || cellsPerAxis <= 0
    || outputSize % cellsPerAxis !== 0) {
    throw new TypeError("Quick Transfer atlas dimensions must divide evenly into sprite cells.");
  }
  const source = await sharp(sourceInput).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const key = sampleBorderKey(source.data, source.info.width, source.info.height, source.info.channels);
  const keyed = removeMagentaKey(source.data, source.info, key);

  const buffer = await sharp(keyed, {
    raw: { width: source.info.width, height: source.info.height, channels: 4 }
  })
    .resize(outputSize, outputSize, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, palette: true, colours: 256, dither: 0 })
    .toBuffer();

  const output = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  let opaque = 0;
  for (let offset = 3; offset < output.data.length; offset += 4) {
    if (output.data[offset] === 0) transparent += 1;
    if (output.data[offset] === 255) opaque += 1;
  }
  const cellSize = outputSize / cellsPerAxis;
  const cellCorners = [];
  for (let row = 0; row < cellsPerAxis; row += 1) {
    for (let column = 0; column < cellsPerAxis; column += 1) {
      const left = column * cellSize;
      const top = row * cellSize;
      const points = [[left, top], [left + cellSize - 1, top], [left, top + cellSize - 1], [left + cellSize - 1, top + cellSize - 1]];
      cellCorners.push(points.map(([x, y]) => output.data[(y * outputSize + x) * 4 + 3]));
    }
  }
  const pixels = outputSize * outputSize;
  return {
    buffer,
    sampledKey: key,
    dimensions: [output.info.width, output.info.height],
    transparentRatio: transparent / pixels,
    opaqueRatio: opaque / pixels,
    cellCorners
  };
}

async function main() {
  const result = await buildTransferIconAtlas();
  await writeFile(outputPath, result.buffer);
  console.log(JSON.stringify({
    source: sourcePath,
    output: outputPath,
    sampledKey: result.sampledKey,
    dimensions: result.dimensions,
    transparentRatio: result.transparentRatio,
    opaqueRatio: result.opaqueRatio,
    cellCorners: result.cellCorners
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(modulePath)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
