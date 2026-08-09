const MAX_REQUEST_URL_CHARS = 8_192;
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export class WorkerHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "WorkerHttpError";
    this.status = status;
    this.code = code;
  }
}

export function assertTrustedRequestBoundary(request: Request): void {
  if (request.url.length > MAX_REQUEST_URL_CHARS) {
    throw new WorkerHttpError("Request URL is too large.", 414, "REQUEST_URL_TOO_LARGE");
  }

  const url = new URL(request.url);
  const isProduction = url.protocol === "https:"
    && url.hostname === "lusu575.com"
    && url.port === "";
  const isLocal = (url.protocol === "http:" || url.protocol === "https:")
    && LOCAL_HOSTNAMES.has(url.hostname);
  if (!isProduction && !isLocal) {
    throw new WorkerHttpError("Request host is not trusted.", 403, "REQUEST_HOST_REJECTED");
  }

  const host = request.headers.get("Host");
  if (host) {
    const expectedHost = url.host.toLowerCase();
    if (host.trim().toLowerCase() !== expectedHost) {
      throw new WorkerHttpError("Request host is not trusted.", 403, "REQUEST_HOST_REJECTED");
    }
  }

  const origin = request.headers.get("Origin");
  if (!origin) return;
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new WorkerHttpError("Request origin is not trusted.", 403, "REQUEST_ORIGIN_REJECTED");
  }
  const trustedProductionOrigin = parsedOrigin.origin === "https://lusu575.com";
  const trustedLocalOrigin = (parsedOrigin.protocol === "http:" || parsedOrigin.protocol === "https:")
    && LOCAL_HOSTNAMES.has(parsedOrigin.hostname);
  if (!trustedProductionOrigin && !trustedLocalOrigin) {
    throw new WorkerHttpError("Request origin is not trusted.", 403, "REQUEST_ORIGIN_REJECTED");
  }
}

export function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders?: HeadersInit
): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(JSON.stringify(body), { status, headers });
}

export function htmlResponse(
  html: string,
  status = 200,
  setCookie?: string,
  options: { formActionOrigin?: string } = {}
): Response {
  const formActionSources = ["'self'"];
  if (options.formActionOrigin) {
    formActionSources.push(validateCspOrigin(options.formActionOrigin));
  }
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Security-Policy": [
      "default-src 'none'",
      "style-src 'unsafe-inline'",
      `form-action ${formActionSources.join(" ")}`,
      "frame-ancestors 'none'",
      "base-uri 'none'"
    ].join("; "),
    "Content-Type": "text/html; charset=utf-8",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    "Referrer-Policy": "strict-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  });
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return new Response(html, { status, headers });
}

function validateCspOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new WorkerHttpError("CSP form-action origin is invalid.", 500, "CSP_ORIGIN_INVALID");
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:")
    || url.origin !== value
    || url.pathname !== "/"
    || url.search
    || url.hash
    || url.username
    || url.password) {
    throw new WorkerHttpError("CSP form-action origin is invalid.", 500, "CSP_ORIGIN_INVALID");
  }
  return value;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function readBoundedForm(request: Request, limit: number): Promise<URLSearchParams> {
  const contentType = String(request.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded") {
    throw new WorkerHttpError("Authorization form is invalid.", 415, "FORM_CONTENT_TYPE_INVALID");
  }
  return new URLSearchParams(await readBoundedText(request, limit));
}

export async function readBoundedText(request: Request, limit: number): Promise<string> {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw new WorkerHttpError("Request body is too large.", 413, "REQUEST_BODY_TOO_LARGE");
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new WorkerHttpError("Request body is too large.", 413, "REQUEST_BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    throw new WorkerHttpError("Request body must be valid UTF-8.", 400, "REQUEST_UTF8_INVALID");
  }
}

export function readCookie(request: Request, name: string): string {
  const cookieHeader = request.headers.get("Cookie") || "";
  for (const item of cookieHeader.split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (key !== name) continue;
    try {
      return decodeURIComponent(rest.join("="));
    } catch {
      return "";
    }
  }
  return "";
}

export function randomUrlSafeToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new WorkerHttpError("Security secret is unavailable.", 500, "SECURITY_SECRET_UNAVAILABLE");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function timingSafeEqualText(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(left)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(right))
  ]);
  return crypto.subtle.timingSafeEqual(leftHash, rightHash);
}

export function safeErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error
    && typeof error.code === "string" && /^[A-Z0-9_:-]{1,160}$/.test(error.code)) {
    return error.code;
  }
  return "INTERNAL_ERROR";
}

export function safeErrorStatus(error: unknown, fallback = 500): number {
  if (error && typeof error === "object" && "status" in error
    && typeof error.status === "number" && Number.isInteger(error.status)
    && error.status >= 400 && error.status <= 599) {
    return error.status;
  }
  return fallback;
}
