import test from "node:test";
import assert from "node:assert/strict";
import {
  decryptTransferText,
  deriveTransferRoomSecret,
  encryptTransferText,
  normalizeTransferPassphrase,
  transferCryptoParameters
} from "../lib/capabilities/transfer-crypto.mjs";

test("Quick Transfer derivation matches the browser protocol vector", async () => {
  const secret = await deriveTransferRoomSecret("  ＬｕＳｕ１２３  ");
  assert.equal(normalizeTransferPassphrase("  ＬｕＳｕ１２３  "), "LuSu123");
  assert.equal(secret.roomKey, "transfer_s6IDLz4yTCtMq5Vb95D33dcvqs-Ho9iPPo-5BKWavWs");
  assert.deepEqual(transferCryptoParameters, {
    roomNamespace: "lusu575-quick-transfer-room-v1",
    textSalt: "lusu575-quick-transfer-text-v1",
    pbkdf2Hash: "SHA-256",
    pbkdf2Iterations: 180000,
    aes: "AES-GCM",
    aesKeyBits: 256,
    ivBytes: 12,
    normalization: "NFKC+trim"
  });
});

test("room secrets are redacted and do not expose persistable AES key bytes", async () => {
  const secret = await deriveTransferRoomSecret("secret-room");
  assert.deepEqual(JSON.parse(JSON.stringify(secret)), { type: "TransferRoomSecret", redacted: true });
  assert.equal(secret.textKey, undefined);
  assert.deepEqual(Object.keys(secret), []);
  assert.equal(JSON.stringify(secret).includes("secret-room"), false);
});

test("AES-GCM uses a 12-byte base64url IV and decrypts locally", async () => {
  const secret = await deriveTransferRoomSecret("secret-room");
  const deterministicCrypto = {
    subtle: globalThis.crypto.subtle,
    getRandomValues(value) {
      value.fill(7);
      return value;
    }
  };
  const ciphertext = await encryptTransferText("hello 世界", secret, { crypto: deterministicCrypto });
  assert.match(ciphertext, /^[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/);
  assert.equal(await decryptTransferText(ciphertext, secret), "hello 世界");
});

test("short passphrases and wrong room secrets fail with stable codes", async () => {
  assert.throws(
    () => normalizeTransferPassphrase("１２３４５"),
    (error) => error.code === "TRANSFER_PASSPHRASE_TOO_SHORT"
  );
  const first = await deriveTransferRoomSecret("first-secret");
  const second = await deriveTransferRoomSecret("second-secret");
  const ciphertext = await encryptTransferText("private", first);
  await assert.rejects(
    decryptTransferText(ciphertext, second),
    (error) => error.code === "TRANSFER_DECRYPT_FAILED"
  );
});
