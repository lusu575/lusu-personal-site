import { describe, expect, it } from "vitest";
import { parseSafeRasterImage } from "../src/image";

function minimalPng(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(45);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
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

describe("raster image validation", () => {
  it("detects a bounded PNG from bytes rather than the declared MIME type", () => {
    expect(parseSafeRasterImage(minimalPng(640, 480))).toEqual({
      contentType: "image/png",
      width: 640,
      height: 480
    });
  });

  it("rejects SVG/script payloads and oversized dimensions", () => {
    expect(
      parseSafeRasterImage(
        new TextEncoder().encode("<svg><script>alert(1)</script></svg>")
      )
    ).toBeNull();
    expect(parseSafeRasterImage(minimalPng(8_193, 10))).toBeNull();
  });

  it("rejects a truncated file with only a valid-looking header", () => {
    expect(parseSafeRasterImage(minimalPng(1, 1).slice(0, 30))).toBeNull();
  });
});
