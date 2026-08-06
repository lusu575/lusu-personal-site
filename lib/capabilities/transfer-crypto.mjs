const ROOM_NAMESPACE = "lusu575-quick-transfer-room-v1";
const TEXT_SALT_TEXT = "lusu575-quick-transfer-text-v1";
const PBKDF2_ITERATIONS = 180_000;
const MIN_PASSPHRASE_CODE_POINTS = 6;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class TransferCryptoError extends Error {
  constructor(message, code = "TRANSFER_CRYPTO_ERROR", options = {}) {
    super(message, options);
    this.name = "TransferCryptoError";
    this.code = code;
  }
}

export class TransferRoomSecret {
  constructor({ roomKey, cryptoKey }) {
    Object.defineProperties(this, {
      roomKey: { value: roomKey, enumerable: false },
      cryptoKey: { value: cryptoKey, enumerable: false }
    });
    Object.freeze(this);
  }

  toJSON() {
    return { type: "TransferRoomSecret", redacted: true };
  }
}

export function normalizeTransferPassphrase(value) {
  const normalized = String(value ?? "").normalize("NFKC").trim();
  if (Array.from(normalized).length < MIN_PASSPHRASE_CODE_POINTS) {
    throw new TransferCryptoError(
      "The Quick Transfer room passphrase must contain at least 6 characters.",
      "TRANSFER_PASSPHRASE_TOO_SHORT"
    );
  }
  return normalized;
}

export async function deriveTransferRoomSecret(passphrase, options = {}) {
  const cryptoImpl = requireWebCrypto(options.crypto);
  const normalized = normalizeTransferPassphrase(passphrase);
  const digestInput = encoder.encode(`${ROOM_NAMESPACE}\0${normalized}`);
  const digest = new Uint8Array(await cryptoImpl.subtle.digest("SHA-256", digestInput));
  const material = await cryptoImpl.subtle.importKey(
    "raw",
    encoder.encode(normalized),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const keyBytes = new Uint8Array(await cryptoImpl.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encoder.encode(TEXT_SALT_TEXT),
      iterations: PBKDF2_ITERATIONS
    },
    material,
    256
  ));
  const cryptoKey = await importTextKey(keyBytes, cryptoImpl);
  return new TransferRoomSecret({
    roomKey: `transfer_${base64urlEncode(digest)}`,
    cryptoKey
  });
}

export async function encryptTransferText(value, secret, options = {}) {
  assertTransferRoomSecret(secret);
  const cryptoImpl = requireWebCrypto(options.crypto);
  const iv = cryptoImpl.getRandomValues(new Uint8Array(12));
  const cipher = await cryptoImpl.subtle.encrypt(
    { name: "AES-GCM", iv },
    secret.cryptoKey,
    encoder.encode(String(value ?? ""))
  );
  return `${base64urlEncode(iv)}.${base64urlEncode(new Uint8Array(cipher))}`;
}

export async function decryptTransferText(value, secret, options = {}) {
  assertTransferRoomSecret(secret);
  const cryptoImpl = requireWebCrypto(options.crypto);
  const parts = String(value || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new TransferCryptoError(
      "The encrypted Quick Transfer text is invalid.",
      "TRANSFER_CIPHERTEXT_INVALID"
    );
  }
  try {
    const clear = await cryptoImpl.subtle.decrypt(
      { name: "AES-GCM", iv: base64urlDecode(parts[0]) },
      secret.cryptoKey,
      base64urlDecode(parts[1])
    );
    return decoder.decode(clear);
  } catch (error) {
    throw new TransferCryptoError(
      "The Quick Transfer text could not be decrypted with this room secret.",
      "TRANSFER_DECRYPT_FAILED",
      { cause: error }
    );
  }
}

export function base64urlEncode(bytes) {
  const value = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value).toString("base64url");
  }
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64urlDecode(value) {
  const encoded = String(value || "").trim();
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
    throw new TransferCryptoError("Invalid base64url value.", "TRANSFER_BASE64URL_INVALID");
  }
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(encoded, "base64url"));
  }
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/")
    + "=".repeat((4 - encoded.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function requireWebCrypto(value) {
  const cryptoImpl = value || globalThis.crypto;
  if (!cryptoImpl?.subtle || typeof cryptoImpl.getRandomValues !== "function") {
    throw new TransferCryptoError(
      "Web Crypto is required for Quick Transfer.",
      "TRANSFER_WEB_CRYPTO_UNAVAILABLE"
    );
  }
  return cryptoImpl;
}

async function importTextKey(keyBytes, cryptoImpl) {
  return cryptoImpl.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

function assertTransferRoomSecret(secret) {
  if (!(secret instanceof TransferRoomSecret) || !secret.roomKey || !secret.cryptoKey) {
    throw new TransferCryptoError(
      "A Quick Transfer room secret is required.",
      "TRANSFER_ROOM_SECRET_REQUIRED"
    );
  }
}

export const transferCryptoParameters = Object.freeze({
  roomNamespace: ROOM_NAMESPACE,
  textSalt: TEXT_SALT_TEXT,
  pbkdf2Hash: "SHA-256",
  pbkdf2Iterations: PBKDF2_ITERATIONS,
  aes: "AES-GCM",
  aesKeyBits: 256,
  ivBytes: 12,
  normalization: "NFKC+trim"
});
