import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type AccessEnv = {
  TEAM_DOMAIN?: string;
  POLICY_AUD?: string;
  OWNER_EMAIL?: string;
};

export type AccessIdentity = {
  email: string;
  subject: string;
};

type VerifyJwt = (
  token: string,
  teamDomain: string,
  audience: string
) => Promise<JWTPayload>;

export class AccessAuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AccessAuthError";
  }
}

const jwksByDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function normalizeTeamDomain(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AccessAuthError("ACCESS_CONFIG_INVALID", "Access configuration is invalid.", 503);
  }
  if (url.protocol !== "https:"
      || !url.hostname.endsWith(".cloudflareaccess.com")
      || (url.pathname !== "/" && url.pathname !== "")
      || url.search
      || url.hash) {
    throw new AccessAuthError("ACCESS_CONFIG_INVALID", "Access configuration is invalid.", 503);
  }
  return url.origin;
}

async function verifyJwtWithCloudflare(
  token: string,
  teamDomain: string,
  audience: string
): Promise<JWTPayload> {
  let jwks = jwksByDomain.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksByDomain.set(teamDomain, jwks);
  }
  const { payload } = await jwtVerify(token, jwks, {
    issuer: teamDomain,
    audience,
    algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "sub", "email"]
  });
  return payload;
}

export async function verifyAccessRequest(
  request: Request,
  env: AccessEnv,
  verifyJwt: VerifyJwt = verifyJwtWithCloudflare
): Promise<AccessIdentity> {
  if (!env.TEAM_DOMAIN || !env.POLICY_AUD || !env.OWNER_EMAIL) {
    throw new AccessAuthError("ACCESS_CONFIG_MISSING", "Access configuration is incomplete.", 503);
  }
  const teamDomain = normalizeTeamDomain(env.TEAM_DOMAIN);
  const audience = env.POLICY_AUD.trim();
  const ownerEmail = env.OWNER_EMAIL.trim().toLowerCase();
  if (!audience || !ownerEmail || !ownerEmail.includes("@")) {
    throw new AccessAuthError("ACCESS_CONFIG_INVALID", "Access configuration is invalid.", 503);
  }

  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) {
    throw new AccessAuthError("ACCESS_JWT_MISSING", "Cloudflare Access authentication is required.", 401);
  }

  let payload: JWTPayload;
  try {
    payload = await verifyJwt(token, teamDomain, audience);
  } catch {
    throw new AccessAuthError("ACCESS_JWT_INVALID", "Cloudflare Access authentication failed.", 403);
  }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!Number.isFinite(payload.exp)
      || !Number.isFinite(payload.iat)
      || typeof payload.sub !== "string"
      || !payload.sub
      || !email) {
    throw new AccessAuthError("ACCESS_JWT_INVALID", "Cloudflare Access authentication failed.", 403);
  }
  if (email !== ownerEmail) {
    throw new AccessAuthError("OWNER_REQUIRED", "This publishing bridge is restricted to the site owner.", 403);
  }
  return {
    email,
    subject: payload.sub
  };
}
