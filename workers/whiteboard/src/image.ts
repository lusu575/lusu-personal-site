import {
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS
} from "./constants";
import type { ParsedImage } from "./types";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_CRC_TABLE = createCrc32Table();
const SUPPORTED_JPEG_FRAMES = new Set([0xc0, 0xc1, 0xc2]);
const MAX_CONTAINER_PARTS = 8_192;

function readUint16BigEndian(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint16LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32BigEndian(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3])
  );
}

function readUint32LittleEndian(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] +
    bytes[offset + 1] * 0x100 +
    bytes[offset + 2] * 0x10000 +
    bytes[offset + 3] * 0x1000000
  );
}

function asciiAt(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function dimensionsAreSafe(width: number, height: number): boolean {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= MAX_IMAGE_DIMENSION &&
    height <= MAX_IMAGE_DIMENSION &&
    width * height <= MAX_IMAGE_PIXELS
  );
}

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0
        ? 0xedb88320 ^ (value >>> 1)
        : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let value = 0xffffffff;
  for (let index = start; index < end; index += 1) {
    value = PNG_CRC_TABLE[(value ^ bytes[index]) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function validPngHeader(bytes: Uint8Array, dataStart: number): {
  width: number;
  height: number;
  colorType: number;
  bitDepth: number;
} | null {
  const width = readUint32BigEndian(bytes, dataStart);
  const height = readUint32BigEndian(bytes, dataStart + 4);
  const bitDepth = bytes[dataStart + 8];
  const colorType = bytes[dataStart + 9];
  const allowedDepths = new Map<number, Set<number>>([
    [0, new Set([1, 2, 4, 8, 16])],
    [2, new Set([8, 16])],
    [3, new Set([1, 2, 4, 8])],
    [4, new Set([8, 16])],
    [6, new Set([8, 16])]
  ]);
  if (
    !dimensionsAreSafe(width, height) ||
    !allowedDepths.get(colorType)?.has(bitDepth) ||
    bytes[dataStart + 10] !== 0 ||
    bytes[dataStart + 11] !== 0 ||
    (bytes[dataStart + 12] !== 0 && bytes[dataStart + 12] !== 1)
  ) {
    return null;
  }
  return { width, height, colorType, bitDepth };
}

function parsePng(bytes: Uint8Array): ParsedImage | null {
  if (
    bytes.length < 58 ||
    !PNG_SIGNATURE.every((value, index) => bytes[index] === value)
  ) {
    return null;
  }

  let offset = PNG_SIGNATURE.length;
  let header: ReturnType<typeof validPngHeader> = null;
  let sawPalette = false;
  let sawImageData = false;
  let imageDataEnded = false;
  let imageDataLength = 0;
  let chunkCount = 0;
  const zlibHeader: number[] = [];

  while (offset < bytes.length) {
    chunkCount += 1;
    if (chunkCount > MAX_CONTAINER_PARTS) return null;
    if (offset + 12 > bytes.length) return null;
    const dataLength = readUint32BigEndian(bytes, offset);
    if (dataLength > bytes.length - offset - 12) return null;
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + dataLength;
    const chunkEnd = dataEnd + 4;
    const typeBytes = bytes.subarray(typeStart, dataStart);
    if (
      typeBytes.length !== 4 ||
      !Array.from(typeBytes).every(
        (value) => (value >= 0x41 && value <= 0x5a) || (value >= 0x61 && value <= 0x7a)
      ) ||
      typeBytes[2] < 0x41 ||
      typeBytes[2] > 0x5a ||
      crc32(bytes, typeStart, dataEnd) !== readUint32BigEndian(bytes, dataEnd)
    ) {
      return null;
    }

    const type = asciiAt(bytes, typeStart, dataStart);
    if (!header) {
      if (offset !== PNG_SIGNATURE.length || type !== "IHDR" || dataLength !== 13) {
        return null;
      }
      header = validPngHeader(bytes, dataStart);
      if (!header) return null;
    } else if (type === "IHDR") {
      return null;
    } else if (type === "PLTE") {
      if (
        sawPalette ||
        sawImageData ||
        header.colorType === 0 ||
        header.colorType === 4 ||
        dataLength === 0 ||
        dataLength % 3 !== 0 ||
        dataLength > 768 ||
        (header.colorType === 3 && dataLength / 3 > 2 ** header.bitDepth)
      ) {
        return null;
      }
      sawPalette = true;
    } else if (type === "IDAT") {
      if (imageDataEnded || (header.colorType === 3 && !sawPalette)) return null;
      sawImageData = true;
      imageDataLength += dataLength;
      for (let index = dataStart; index < dataEnd && zlibHeader.length < 2; index += 1) {
        zlibHeader.push(bytes[index]);
      }
    } else if (type === "IEND") {
      if (
        dataLength !== 0 ||
        !sawImageData ||
        imageDataLength < 8 ||
        zlibHeader.length !== 2 ||
        (zlibHeader[0] & 0x0f) !== 8 ||
        (zlibHeader[0] >>> 4) > 7 ||
        ((zlibHeader[0] << 8) | zlibHeader[1]) % 31 !== 0 ||
        (zlibHeader[1] & 0x20) !== 0 ||
        chunkEnd !== bytes.length
      ) {
        return null;
      }
      return {
        contentType: "image/png",
        width: header.width,
        height: header.height
      };
    } else {
      if (sawImageData) imageDataEnded = true;
      if (typeBytes[0] >= 0x41 && typeBytes[0] <= 0x5a) return null;
    }
    offset = chunkEnd;
  }
  return null;
}

function validJpegQuantizationTables(
  bytes: Uint8Array,
  start: number,
  end: number
): boolean {
  let offset = start;
  while (offset < end) {
    const tableInfo = bytes[offset];
    const precision = tableInfo >>> 4;
    if (precision > 1 || (tableInfo & 0x0f) > 3) return false;
    offset += 1 + 64 * (precision + 1);
    if (offset > end) return false;
  }
  return offset === end && start < end;
}

function validJpegHuffmanTables(
  bytes: Uint8Array,
  start: number,
  end: number
): boolean {
  let offset = start;
  while (offset < end) {
    if (offset + 17 > end) return false;
    const tableInfo = bytes[offset];
    if ((tableInfo >>> 4) > 1 || (tableInfo & 0x0f) > 3) return false;
    let symbolCount = 0;
    for (let index = 1; index <= 16; index += 1) {
      symbolCount += bytes[offset + index];
    }
    if (symbolCount === 0 || symbolCount > 256) return false;
    offset += 17 + symbolCount;
    if (offset > end) return false;
  }
  return offset === end && start < end;
}

function parseJpeg(bytes: Uint8Array): ParsedImage | null {
  if (bytes.length < 32 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  let width = 0;
  let height = 0;
  let frameMarker = 0;
  let frameComponents = new Set<number>();
  let sawQuantizationTable = false;
  let sawHuffmanTable = false;
  let sawScan = false;
  let sawEntropyData = false;
  let segmentCount = 0;

  while (offset < bytes.length) {
    segmentCount += 1;
    if (segmentCount > MAX_CONTAINER_PARTS) return null;
    if (bytes[offset] !== 0xff) return null;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;
    const marker = bytes[offset];
    offset += 1;

    if (marker === 0x00 || marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      return null;
    }
    if (marker === 0xd9) {
      return sawScan && sawEntropyData && width > 0 && offset === bytes.length
        ? { contentType: "image/jpeg", width, height }
        : null;
    }
    if (offset + 2 > bytes.length) return null;
    const segmentLength = readUint16BigEndian(bytes, offset);
    if (segmentLength < 2 || segmentLength > bytes.length - offset) return null;
    const dataStart = offset + 2;
    const segmentEnd = offset + segmentLength;

    if (SUPPORTED_JPEG_FRAMES.has(marker)) {
      if (width !== 0 || segmentLength < 11) return null;
      const precision = bytes[dataStart];
      const parsedHeight = readUint16BigEndian(bytes, dataStart + 1);
      const parsedWidth = readUint16BigEndian(bytes, dataStart + 3);
      const componentCount = bytes[dataStart + 5];
      if (
        (precision !== 8 && precision !== 12) ||
        componentCount < 1 ||
        componentCount > 4 ||
        segmentLength !== 8 + componentCount * 3 ||
        !dimensionsAreSafe(parsedWidth, parsedHeight)
      ) {
        return null;
      }
      const componentIds = new Set<number>();
      for (let index = 0; index < componentCount; index += 1) {
        const componentOffset = dataStart + 6 + index * 3;
        const id = bytes[componentOffset];
        const sampling = bytes[componentOffset + 1];
        if (
          componentIds.has(id) ||
          (sampling >>> 4) < 1 ||
          (sampling >>> 4) > 4 ||
          (sampling & 0x0f) < 1 ||
          (sampling & 0x0f) > 4 ||
          bytes[componentOffset + 2] > 3
        ) {
          return null;
        }
        componentIds.add(id);
      }
      width = parsedWidth;
      height = parsedHeight;
      frameMarker = marker;
      frameComponents = componentIds;
    } else if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4) {
      return null;
    } else if (marker === 0xdb) {
      if (!validJpegQuantizationTables(bytes, dataStart, segmentEnd)) return null;
      sawQuantizationTable = true;
    } else if (marker === 0xc4) {
      if (!validJpegHuffmanTables(bytes, dataStart, segmentEnd)) return null;
      sawHuffmanTable = true;
    } else if (marker === 0xdd) {
      if (segmentLength !== 4) return null;
    } else if (marker === 0xda) {
      if (!width || !sawQuantizationTable || !sawHuffmanTable) return null;
      const componentCount = bytes[dataStart];
      if (
        componentCount < 1 ||
        componentCount > frameComponents.size ||
        segmentLength !== 6 + componentCount * 2
      ) {
        return null;
      }
      const scanComponents = new Set<number>();
      for (let index = 0; index < componentCount; index += 1) {
        const componentOffset = dataStart + 1 + index * 2;
        const id = bytes[componentOffset];
        const tables = bytes[componentOffset + 1];
        if (
          !frameComponents.has(id) ||
          scanComponents.has(id) ||
          (tables >>> 4) > 3 ||
          (tables & 0x0f) > 3
        ) {
          return null;
        }
        scanComponents.add(id);
      }
      const spectralStart = bytes[dataStart + 1 + componentCount * 2];
      const spectralEnd = bytes[dataStart + 2 + componentCount * 2];
      const approximation = bytes[dataStart + 3 + componentCount * 2];
      if (
        spectralStart > spectralEnd ||
        spectralEnd > 63 ||
        (frameMarker !== 0xc2 && (spectralStart !== 0 || spectralEnd !== 63 || approximation !== 0)) ||
        (frameMarker === 0xc2 && (
          (spectralStart === 0 && spectralEnd !== 0) ||
          (approximation >>> 4) > 13 ||
          (approximation & 0x0f) > 13
        ))
      ) {
        return null;
      }

      sawScan = true;
      offset = segmentEnd;
      let scanHasEntropyData = false;
      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) {
          scanHasEntropyData = true;
          sawEntropyData = true;
          offset += 1;
          continue;
        }
        const markerStart = offset;
        while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
        if (offset >= bytes.length) return null;
        const scanMarker = bytes[offset];
        if (scanMarker === 0x00) {
          scanHasEntropyData = true;
          sawEntropyData = true;
          offset += 1;
          continue;
        }
        if (scanMarker >= 0xd0 && scanMarker <= 0xd7) {
          offset += 1;
          continue;
        }
        offset = markerStart;
        break;
      }
      if (!scanHasEntropyData) return null;
      continue;
    } else if (
      !((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe)
    ) {
      return null;
    }
    offset = segmentEnd;
  }
  return null;
}

type WebpPayload = { width: number; height: number; hasAlpha: boolean };

function parseVp8Payload(
  bytes: Uint8Array,
  start: number,
  size: number
): WebpPayload | null {
  const frameTag = size >= 3
    ? bytes[start] | (bytes[start + 1] << 8) | (bytes[start + 2] << 16)
    : 0;
  const firstPartitionLength = frameTag >>> 5;
  if (
    size < 11 ||
    (bytes[start] & 1) !== 0 ||
    firstPartitionLength === 0 ||
    10 + firstPartitionLength > size ||
    bytes[start + 3] !== 0x9d ||
    bytes[start + 4] !== 0x01 ||
    bytes[start + 5] !== 0x2a
  ) {
    return null;
  }
  const width = readUint16LittleEndian(bytes, start + 6) & 0x3fff;
  const height = readUint16LittleEndian(bytes, start + 8) & 0x3fff;
  return dimensionsAreSafe(width, height)
    ? { width, height, hasAlpha: false }
    : null;
}

function parseVp8lPayload(
  bytes: Uint8Array,
  start: number,
  size: number
): WebpPayload | null {
  if (size < 6 || bytes[start] !== 0x2f) return null;
  const bits = readUint32LittleEndian(bytes, start + 1);
  if ((bits >>> 29) !== 0) return null;
  const width = (bits & 0x3fff) + 1;
  const height = ((bits >>> 14) & 0x3fff) + 1;
  return dimensionsAreSafe(width, height)
    ? { width, height, hasAlpha: (bits & 0x10000000) !== 0 }
    : null;
}

function webpChunkBounds(
  bytes: Uint8Array,
  offset: number,
  limit: number
): { type: string; dataStart: number; dataEnd: number; paddedEnd: number; size: number } | null {
  if (offset + 8 > limit) return null;
  const size = readUint32LittleEndian(bytes, offset + 4);
  const dataStart = offset + 8;
  if (size > limit - dataStart) return null;
  const dataEnd = dataStart + size;
  const paddedEnd = dataEnd + (size & 1);
  if (paddedEnd > limit || ((size & 1) !== 0 && bytes[dataEnd] !== 0)) return null;
  return { type: asciiAt(bytes, offset, offset + 4), dataStart, dataEnd, paddedEnd, size };
}

function parseWebpFrame(
  bytes: Uint8Array,
  start: number,
  end: number
): WebpPayload | null {
  let offset = start;
  let sawAlpha = false;
  let payload: WebpPayload | null = null;
  let chunkCount = 0;
  while (offset < end) {
    chunkCount += 1;
    if (chunkCount > MAX_CONTAINER_PARTS) return null;
    const chunk = webpChunkBounds(bytes, offset, end);
    if (!chunk) return null;
    if (chunk.type === "ALPH") {
      if (sawAlpha || payload || chunk.size < 2 || (bytes[chunk.dataStart] & 0xc3) !== 0) {
        return null;
      }
      sawAlpha = true;
    } else if (chunk.type === "VP8 ") {
      if (payload) return null;
      payload = parseVp8Payload(bytes, chunk.dataStart, chunk.size);
      if (!payload) return null;
    } else if (chunk.type === "VP8L") {
      if (payload || sawAlpha) return null;
      payload = parseVp8lPayload(bytes, chunk.dataStart, chunk.size);
      if (!payload) return null;
    } else {
      return null;
    }
    offset = chunk.paddedEnd;
  }
  return payload ? { ...payload, hasAlpha: payload.hasAlpha || sawAlpha } : null;
}

function parseWebp(bytes: Uint8Array): ParsedImage | null {
  if (
    bytes.length < 26 ||
    asciiAt(bytes, 0, 4) !== "RIFF" ||
    asciiAt(bytes, 8, 12) !== "WEBP" ||
    readUint32LittleEndian(bytes, 4) + 8 !== bytes.length
  ) {
    return null;
  }

  const first = webpChunkBounds(bytes, 12, bytes.length);
  if (!first || !["VP8X", "VP8 ", "VP8L"].includes(first.type)) return null;
  if (first.type === "VP8 " || first.type === "VP8L") {
    const payload = first.type === "VP8 "
      ? parseVp8Payload(bytes, first.dataStart, first.size)
      : parseVp8lPayload(bytes, first.dataStart, first.size);
    return payload && first.paddedEnd === bytes.length
      ? { contentType: "image/webp", width: payload.width, height: payload.height }
      : null;
  }

  if (first.size !== 10) return null;
  const flags = bytes[first.dataStart];
  if (
    (flags & 0xc1) !== 0 ||
    bytes[first.dataStart + 1] !== 0 ||
    bytes[first.dataStart + 2] !== 0 ||
    bytes[first.dataStart + 3] !== 0
  ) {
    return null;
  }
  const width = readUint24LittleEndian(bytes, first.dataStart + 4) + 1;
  const height = readUint24LittleEndian(bytes, first.dataStart + 7) + 1;
  if (!dimensionsAreSafe(width, height)) return null;

  let offset = first.paddedEnd;
  let sawIcc = false;
  let sawAlpha = false;
  let sawAnimationHeader = false;
  let sawAnimationFrame = false;
  let sawImage = false;
  let sawExif = false;
  let sawXmp = false;
  let imageHasAlpha = false;
  let chunkCount = 0;
  while (offset < bytes.length) {
    chunkCount += 1;
    if (chunkCount > MAX_CONTAINER_PARTS) return null;
    const chunk = webpChunkBounds(bytes, offset, bytes.length);
    if (!chunk) return null;
    if (chunk.type === "ICCP") {
      if (sawIcc || sawImage || sawAnimationHeader || chunk.size === 0) return null;
      sawIcc = true;
    } else if (chunk.type === "ALPH") {
      if (sawAlpha || sawImage || sawAnimationHeader || chunk.size < 2 || (bytes[chunk.dataStart] & 0xc3) !== 0) {
        return null;
      }
      sawAlpha = true;
    } else if (chunk.type === "VP8 " || chunk.type === "VP8L") {
      if (sawImage || sawAnimationHeader || (chunk.type === "VP8L" && sawAlpha)) return null;
      const payload = chunk.type === "VP8 "
        ? parseVp8Payload(bytes, chunk.dataStart, chunk.size)
        : parseVp8lPayload(bytes, chunk.dataStart, chunk.size);
      if (!payload || payload.width !== width || payload.height !== height) return null;
      sawImage = true;
      imageHasAlpha = payload.hasAlpha || sawAlpha;
    } else if (chunk.type === "ANIM") {
      if (sawAnimationHeader || sawImage || sawAlpha || chunk.size !== 6) return null;
      sawAnimationHeader = true;
    } else if (chunk.type === "ANMF") {
      if (!sawAnimationHeader || sawImage || chunk.size <= 16) return null;
      const frameX = readUint24LittleEndian(bytes, chunk.dataStart) * 2;
      const frameY = readUint24LittleEndian(bytes, chunk.dataStart + 3) * 2;
      const frameWidth = readUint24LittleEndian(bytes, chunk.dataStart + 6) + 1;
      const frameHeight = readUint24LittleEndian(bytes, chunk.dataStart + 9) + 1;
      if (
        (bytes[chunk.dataStart + 15] & 0xfc) !== 0 ||
        !dimensionsAreSafe(frameWidth, frameHeight) ||
        frameX + frameWidth > width ||
        frameY + frameHeight > height
      ) {
        return null;
      }
      const frame = parseWebpFrame(bytes, chunk.dataStart + 16, chunk.dataEnd);
      if (!frame || frame.width !== frameWidth || frame.height !== frameHeight) return null;
      sawAnimationFrame = true;
      imageHasAlpha ||= frame.hasAlpha;
    } else if (chunk.type === "EXIF") {
      if (sawExif || (!sawImage && !sawAnimationFrame) || chunk.size === 0) return null;
      sawExif = true;
    } else if (chunk.type === "XMP ") {
      if (sawXmp || (!sawImage && !sawAnimationFrame) || chunk.size === 0) return null;
      sawXmp = true;
    } else {
      return null;
    }
    offset = chunk.paddedEnd;
  }

  const animated = (flags & 0x02) !== 0;
  if (
    sawIcc !== ((flags & 0x20) !== 0) ||
    imageHasAlpha !== ((flags & 0x10) !== 0) ||
    sawExif !== ((flags & 0x08) !== 0) ||
    sawXmp !== ((flags & 0x04) !== 0) ||
    animated !== sawAnimationHeader ||
    (animated ? !sawAnimationFrame || sawImage : !sawImage || sawAnimationFrame)
  ) {
    return null;
  }
  return { contentType: "image/webp", width, height };
}

export function parseSafeRasterImage(bytes: Uint8Array): ParsedImage | null {
  return parsePng(bytes) || parseJpeg(bytes) || parseWebp(bytes);
}
