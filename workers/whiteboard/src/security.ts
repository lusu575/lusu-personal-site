import {
  CLIENT_ORIGIN_HEADER,
  INTERNAL_SECRET_HEADER,
  PUBLIC_ROOM_ID
} from "./constants";
import type { WhiteboardEnv } from "./types";

const ROOM_ID_PATTERN = /^wb_[A-Za-z0-9_-]{43}$/;
const ANONYMOUS_ID_PATTERN = /^[A-Za-z0-9_-]{20,160}$/;
const IP_HASH_PATTERN = /^[a-f0-9]{32,128}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const FORBIDDEN_NAME_PARTS = [
  "管理员",
  "官方",
  "站长",
  "系统",
  "客服",
  "开发者",
  "admin",
  "administrator",
  "official",
  "system",
  "support",
  "moderator",
  "管理者",
  "運営",
  "公式",
  "システム",
  "サポート"
];

function toBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", toBytes(value)));
}

export async function secretsMatch(
  candidate: string | null,
  expected: string | undefined
): Promise<boolean> {
  if (!candidate || !expected || expected.length < 32) {
    return false;
  }
  const [left, right] = await Promise.all([sha256(candidate), sha256(expected)]);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export async function isTrustedInternalRequest(
  request: Request,
  env: WhiteboardEnv
): Promise<boolean> {
  return secretsMatch(
    request.headers.get(INTERNAL_SECRET_HEADER),
    env.WHITEBOARD_INTERNAL_SECRET
  );
}

export function isValidRoomId(roomId: string | null): roomId is string {
  return roomId === PUBLIC_ROOM_ID || Boolean(roomId && ROOM_ID_PATTERN.test(roomId));
}

export function isValidAnonymousId(value: string | null): value is string {
  return Boolean(value && ANONYMOUS_ID_PATTERN.test(value));
}

export function normalizeIpHash(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return IP_HASH_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeColor(value: string | null): string {
  return value && COLOR_PATTERN.test(value) ? value.toLowerCase() : "#64748b";
}

export function normalizeDisplayName(value: string | null): string {
  const normalized = (value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const characters = Array.from(normalized).slice(0, 24);
  const candidate = characters.join("");
  const lower = candidate.toLocaleLowerCase();
  if (
    characters.length < 2 ||
    FORBIDDEN_NAME_PARTS.some((part) => lower.includes(part.toLocaleLowerCase()))
  ) {
    return "云端旅人";
  }
  return candidate;
}

export function decodeDisplayNameHeader(value: string | null): string | null {
  if (
    !value ||
    value.length > 128 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    return null;
  }
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(`${base64}${padding}`);
    if (binary.length < 1 || binary.length > 96) return null;
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0)
    );
    const decoded = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: false
    }).decode(bytes);
    const characters = Array.from(decoded);
    if (characters.length < 2 || characters.length > 24) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function originIsAllowed(request: Request, env: WhiteboardEnv): boolean {
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (allowed.length === 0) {
    return false;
  }
  const origin = request.headers.get(CLIENT_ORIGIN_HEADER);
  return Boolean(origin && allowed.includes(origin));
}

export function safeJsonResponse(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders?: HeadersInit
): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}

export function randomId(byteLength = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function compactNameSuffix(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(2));
  const value = ((bytes[0] << 8) | bytes[1]) % (36 * 36);
  return value.toString(36).padStart(2, "0").toUpperCase();
}

export function utf8ByteLength(value: string): number {
  return toBytes(value).byteLength;
}

export function parseBoundedJson<T>(
  value: string,
  maximumBytes: number
): T | null {
  if (utf8ByteLength(value) > maximumBytes) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
