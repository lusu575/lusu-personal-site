const encoder = new TextEncoder();
const pngSignature = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
]);
const crcTable = createCrc32Table();

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

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function concatenate(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = encoder.encode(type);
  const result = new Uint8Array(12 + data.length);
  const view = new DataView(result.buffer);
  view.setUint32(0, data.length);
  result.set(typeBytes, 4);
  result.set(data, 8);
  view.setUint32(8 + data.length, crc32(concatenate([typeBytes, data])));
  return result;
}

function adler32(bytes: Uint8Array): number {
  let first = 1;
  let second = 0;
  for (const byte of bytes) {
    first = (first + byte) % 65_521;
    second = (second + first) % 65_521;
  }
  return ((second << 16) | first) >>> 0;
}

function uncompressedZlib(bytes: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  for (let offset = 0; offset < bytes.length;) {
    const length = Math.min(65_535, bytes.length - offset);
    const block = new Uint8Array(5 + length);
    const view = new DataView(block.buffer);
    block[0] = offset + length === bytes.length ? 1 : 0;
    view.setUint16(1, length, true);
    view.setUint16(3, 0xffff ^ length, true);
    block.set(bytes.subarray(offset, offset + length), 5);
    blocks.push(block);
    offset += length;
  }
  const checksum = new Uint8Array(4);
  new DataView(checksum.buffer).setUint32(0, adler32(bytes));
  blocks.push(checksum);
  return concatenate(blocks);
}

export function validPng(width = 2, height = 2): Uint8Array {
  const scanlineLength = 1 + width * 4;
  const pixels = new Uint8Array(scanlineLength * height);
  return pngWithIdatBytes(uncompressedZlib(pixels), width, height);
}

export function pngWithIdatBytes(
  imageData: Uint8Array,
  width = 2,
  height = 2
): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 6, 0, 0, 0], 8);
  return concatenate([
    pngSignature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", imageData),
    pngChunk("IEND", new Uint8Array())
  ]);
}

export function legacyHeaderOnlyPng(width = 2, height = 2): Uint8Array {
  const bytes = new Uint8Array(45);
  bytes.set(pngSignature, 0);
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes[24] = 8;
  bytes[25] = 6;
  bytes.set([0, 0, 0, 0, 0], 28);
  bytes.set([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0, 0, 0, 0], 33);
  return bytes;
}
