import { describe, expect, it } from "vitest";
import { decodeDisplayNameHeader } from "../src/security";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

describe("display-name transport", () => {
  it("decodes UTF-8 from an ASCII-only base64url header", () => {
    expect(
      decodeDisplayNameHeader(base64Url(new TextEncoder().encode("像素海豹")))
    ).toBe("像素海豹");
  });

  it("rejects malformed base64url and invalid UTF-8", () => {
    expect(decodeDisplayNameHeader("not+base64")).toBeNull();
    expect(decodeDisplayNameHeader(base64Url(new Uint8Array([0xc3, 0x28])))).toBeNull();
  });

  it("rejects decoded names outside the character and byte limits", () => {
    expect(
      decodeDisplayNameHeader(base64Url(new TextEncoder().encode("a")))
    ).toBeNull();
    expect(
      decodeDisplayNameHeader(
        base64Url(new TextEncoder().encode("海".repeat(25)))
      )
    ).toBeNull();
  });
});
