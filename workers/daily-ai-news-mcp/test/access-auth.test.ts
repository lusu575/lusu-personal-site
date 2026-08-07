import { describe, expect, it } from "vitest";

import { AccessAuthError, verifyAccessRequest } from "../src/access-auth";

const env = {
  TEAM_DOMAIN: "https://unit-test.cloudflareaccess.com",
  POLICY_AUD: "unit-test-audience",
  OWNER_EMAIL: "owner@example.com"
};
const validClaims = {
  email: "OWNER@example.com",
  sub: "owner-subject",
  iat: 1_786_000_000,
  exp: 1_786_003_600
};

describe("Cloudflare Access owner verification", () => {
  it("fails closed when configuration or the Access JWT is missing", async () => {
    await expect(verifyAccessRequest(new Request("https://example.test/mcp"), {}))
      .rejects.toMatchObject({ code: "ACCESS_CONFIG_MISSING", status: 503 });
    await expect(verifyAccessRequest(new Request("https://example.test/mcp"), env))
      .rejects.toMatchObject({ code: "ACCESS_JWT_MISSING", status: 401 });
  });

  it("rejects invalid tokens and authenticated non-owner identities", async () => {
    const request = new Request("https://example.test/mcp", {
      headers: { "Cf-Access-Jwt-Assertion": "redacted-test-token" }
    });
    await expect(verifyAccessRequest(request, env, async () => {
      throw new Error("invalid signature");
    })).rejects.toMatchObject({ code: "ACCESS_JWT_INVALID", status: 403 });

    await expect(verifyAccessRequest(request, env, async () => ({
      email: "someone-else@example.com",
      sub: "user-2",
      iat: validClaims.iat,
      exp: validClaims.exp
    }))).rejects.toMatchObject({ code: "OWNER_REQUIRED", status: 403 });
  });

  it("rejects a signed payload that omits required Access claims", async () => {
    const request = new Request("https://example.test/mcp", {
      headers: { "Cf-Access-Jwt-Assertion": "redacted-test-token" }
    });
    await expect(verifyAccessRequest(request, env, async () => ({
      email: "owner@example.com",
      sub: "owner-subject"
    }))).rejects.toMatchObject({ code: "ACCESS_JWT_INVALID", status: 403 });
  });

  it("returns the verified owner without exposing the JWT", async () => {
    const request = new Request("https://example.test/mcp", {
      headers: { "Cf-Access-Jwt-Assertion": "redacted-test-token" }
    });
    await expect(verifyAccessRequest(request, env, async (token, domain, audience) => {
      expect(token).toBe("redacted-test-token");
      expect(domain).toBe(env.TEAM_DOMAIN);
      expect(audience).toBe(env.POLICY_AUD);
      return validClaims;
    })).resolves.toEqual({ email: "owner@example.com", subject: "owner-subject" });
  });

  it("uses a typed, non-secret-bearing authentication error", () => {
    const error = new AccessAuthError("ACCESS_DENIED", "Access denied.", 403);
    expect(error).toMatchObject({ code: "ACCESS_DENIED", status: 403 });
    expect(JSON.stringify(error)).not.toContain("token");
  });
});
