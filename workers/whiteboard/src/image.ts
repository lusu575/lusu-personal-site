import {
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS
} from "./constants";
import type { ParsedImage } from "./types";

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

function parsePng(bytes: Uint8Array): ParsedImage | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length < 45 ||
    !signature.every((value, index) => bytes[index] === value) ||
    String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR"
  ) {
    return null;
  }
  const width = readUint32BigEndian(bytes, 16);
  const height = readUint32BigEndian(bytes, 20);
  if (!dimensionsAreSafe(width, height)) return null;
  let offset = 8;
  let foundIend = false;
  while (offset + 12 <= bytes.length) {
    const dataLength = readUint32BigEndian(bytes, offset);
    const chunkEnd = offset + 12 + dataLength;
    if (chunkEnd > bytes.length) return null;
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (type === "IEND") {
      if (dataLength !== 0 || chunkEnd !== bytes.length) return null;
      foundIend = true;
      break;
    }
    offset = chunkEnd;
  }
  return foundIend ? { contentType: "image/png", width, height } : null;
}

function parseJpeg(bytes: Uint8Array): ParsedImage | null {
  if (
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[bytes.length - 2] !== 0xff ||
    bytes[bytes.length - 1] !== 0xd9
  ) {
    return null;
  }
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) return null;
    const segmentLength = readUint16BigEndian(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame) {
      if (segmentLength < 7) return null;
      const height = readUint16BigEndian(bytes, offset + 3);
      const width = readUint16BigEndian(bytes, offset + 5);
      return dimensionsAreSafe(width, height)
        ? { contentType: "image/jpeg", width, height }
        : null;
    }
    offset += segmentLength;
  }
  return null;
}

function parseWebp(bytes: Uint8Array): ParsedImage | null {
  if (
    bytes.length < 30 ||
    String.fromCharCode(...bytes.slice(0, 4)) !== "RIFF" ||
    String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP" ||
    readUint32LittleEndian(bytes, 4) + 8 !== bytes.length
  ) {
    return null;
  }
  const kind = String.fromCharCode(...bytes.slice(12, 16));
  let width = 0;
  let height = 0;
  if (kind === "VP8X") {
    width = 1 + readUint24LittleEndian(bytes, 24);
    height = 1 + readUint24LittleEndian(bytes, 27);
  } else if (kind === "VP8 ") {
    if (
      bytes.length < 30 ||
      bytes[23] !== 0x9d ||
      bytes[24] !== 0x01 ||
      bytes[25] !== 0x2a
    ) {
      return null;
    }
    width = readUint16LittleEndian(bytes, 26) & 0x3fff;
    height = readUint16LittleEndian(bytes, 28) & 0x3fff;
  } else if (kind === "VP8L") {
    if (bytes.length < 25 || bytes[20] !== 0x2f) return null;
    const bits = readUint32LittleEndian(bytes, 21);
    width = (bits & 0x3fff) + 1;
    height = ((bits >>> 14) & 0x3fff) + 1;
  } else {
    return null;
  }
  return dimensionsAreSafe(width, height)
    ? { contentType: "image/webp", width, height }
    : null;
}

export function parseSafeRasterImage(bytes: Uint8Array): ParsedImage | null {
  return parsePng(bytes) || parseJpeg(bytes) || parseWebp(bytes);
}
