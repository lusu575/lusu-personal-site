import { describe, expect, it } from "vitest";

async function derivePasswordBits(iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("runtime-compatible-password"),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt: new TextEncoder().encode("runtime-compatible-salt"),
    iterations
  }, key, 256);
}

describe("Cloudflare runtime password hashing boundary", () => {
  it("accepts the site's 100,000-round PBKDF2 policy", async () => {
    const bits = await derivePasswordBits(100000);
    expect(bits.byteLength).toBe(32);
  });
});
