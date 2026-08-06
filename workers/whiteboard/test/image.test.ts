import { describe, expect, it } from "vitest";
import { parseSafeRasterImage } from "../src/image";
import {
  legacyHeaderOnlyPng,
  pngWithIdatBytes,
  validPng
} from "./image-fixtures";

const JPEG_3_BY_2 = decodeBase64(
  "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAACAAMDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJAAnHX/2Q=="
);
const WEBP_3_BY_2 = decodeBase64(
  "UklGRjgAAABXRUJQVlA4ICwAAADwAQCdASoDAAIAAUAmJaACdLoB+AAETAAA/u+9V/43bjDfgu/33oDeBgAAAA=="
);
const PROGRESSIVE_JPEG_3_BY_2 = decodeBase64(
  "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wgARCAACAAMDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUAQEAAAAAAAAAAAAAAAAAAAAF/9oADAMBAAIQAxAAAAGOEzv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAn//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AX//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AX//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/An//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IX//2gAMAwEAAgADAAAAEPv/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q=="
);
const LOSSLESS_ALPHA_WEBP_3_BY_2 = decodeBase64(
  "UklGRh4AAABXRUJQVlA4TBEAAAAvAkAAEAdQs840s4CBiOh/AAA="
);
const LOSSY_ALPHA_WEBP_3_BY_2 = decodeBase64(
  "UklGRloAAABXRUJQVlA4WAoAAAAQAAAAAgAAAQAAQUxQSAcAAAAAgICAgICAAFZQOCAsAAAA8AEAnQEqAwACAAFAJiWgAnS6AfgABEwAAP7vvVf+N24w34Lv996A3gYAAAA="
);
const ANIMATED_WEBP_3_BY_2 = decodeBase64(
  "UklGRqQAAABXRUJQVlA4WAoAAAASAAAAAgAAAQAAQU5JTQYAAAD/////AABBTk1GMAAAAAAAAAAAAAIAAAEAAGQAAAJWUDggGAAAADABAJ0BKgMAAgABQCYlpAADcAD+/PQAAEFOTUZAAAAAAAAAAAAAAgAAAQAAZAAAAkFMUEgHAAAAAICAgICAgABWUDggGAAAAFABAJ0BKgMAAgABQCYlpAAEdAAA5EAAAA=="
);

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

describe("raster image container validation", () => {
  it("accepts bounded, structurally valid PNG, JPEG, and WebP containers", () => {
    expect(parseSafeRasterImage(validPng(64, 48))).toEqual({
      contentType: "image/png",
      width: 64,
      height: 48
    });
    expect(parseSafeRasterImage(JPEG_3_BY_2)).toEqual({
      contentType: "image/jpeg",
      width: 3,
      height: 2
    });
    expect(parseSafeRasterImage(WEBP_3_BY_2)).toEqual({
      contentType: "image/webp",
      width: 3,
      height: 2
    });
  });

  it("accepts supported progressive JPEG and WebP lossless, alpha, and animation structures", () => {
    expect(parseSafeRasterImage(PROGRESSIVE_JPEG_3_BY_2)).toEqual({
      contentType: "image/jpeg",
      width: 3,
      height: 2
    });
    for (const bytes of [
      LOSSLESS_ALPHA_WEBP_3_BY_2,
      LOSSY_ALPHA_WEBP_3_BY_2,
      ANIMATED_WEBP_3_BY_2
    ]) {
      expect(parseSafeRasterImage(bytes)).toEqual({
        contentType: "image/webp",
        width: 3,
        height: 2
      });
    }
  });

  it("rejects SVG/script payloads and oversized dimensions", () => {
    expect(
      parseSafeRasterImage(
        new TextEncoder().encode("<svg><script>alert(1)</script></svg>")
      )
    ).toBeNull();
    expect(parseSafeRasterImage(validPng(8_193, 10))).toBeNull();
  });

  it("rejects the former 45-byte PNG false positive with no IDAT or valid CRC", () => {
    expect(parseSafeRasterImage(legacyHeaderOnlyPng())).toBeNull();
  });

  it("rejects a CRC-correct PNG whose IDAT has no deflate block", () => {
    expect(parseSafeRasterImage(pngWithIdatBytes(
      new Uint8Array([0x78, 0x01, 0x00, 0x00, 0x00, 0x01])
    ))).toBeNull();
  });

  it("rejects PNG CRC errors, truncation, and trailing polyglot bytes", () => {
    const corruptCrc = validPng(2, 2);
    corruptCrc[29] ^= 0xff;
    expect(parseSafeRasterImage(corruptCrc)).toBeNull();

    const valid = validPng(2, 2);
    expect(parseSafeRasterImage(valid.slice(0, -4))).toBeNull();
    const trailing = new Uint8Array(valid.length + 8);
    trailing.set(valid);
    trailing.set(new TextEncoder().encode("<script>"), valid.length);
    expect(parseSafeRasterImage(trailing)).toBeNull();
  });

  it("requires JPEG tables, scan data, EOI, and consistent segment lengths", () => {
    expect(parseSafeRasterImage(JPEG_3_BY_2.slice(0, -2))).toBeNull();
    expect(parseSafeRasterImage(new Uint8Array([
      0xff, 0xd8,
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x02, 0x00, 0x03, 0x01, 0x01, 0x11, 0x00,
      0xff, 0xd9
    ]))).toBeNull();
    const corruptLength = JPEG_3_BY_2.slice();
    corruptLength[4] = 0xff;
    corruptLength[5] = 0xff;
    expect(parseSafeRasterImage(corruptLength)).toBeNull();
  });

  it("requires WebP RIFF and image chunk lengths to terminate exactly", () => {
    const truncated = WEBP_3_BY_2.slice(0, -1);
    expect(parseSafeRasterImage(truncated)).toBeNull();
    const corruptChunkLength = WEBP_3_BY_2.slice();
    corruptChunkLength[16] = 0xff;
    corruptChunkLength[17] = 0xff;
    corruptChunkLength[18] = 0xff;
    corruptChunkLength[19] = 0x7f;
    expect(parseSafeRasterImage(corruptChunkLength)).toBeNull();
  });
});
