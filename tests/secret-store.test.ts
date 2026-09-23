import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  encryptSecret,
  decryptSecret,
  isEncrypted,
  deriveEncryptionKey,
  hasExplicitEncryptionKey,
  ENC_PREFIX,
} from "../server/secret-store";

const TEST_JWT = "qa-secret-store-test-jwt-0123456789abcdef";

beforeEach(() => {
  delete process.env.ENCRYPTION_KEY;
  process.env.JWT_SECRET = TEST_JWT;
});

describe("secret-store", () => {
  it("round-trips a secret through encrypt then decrypt", () => {
    const plain = "Safaricom-very-secret-passkey-12345";
    const stored = encryptSecret(plain);
    assert.equal(stored.startsWith("enc:v1:"), true, "ciphertext carries the enc:v1: prefix");
    assert.ok(!stored.includes(plain), "plaintext never appears in the ciphertext");
    assert.equal(decryptSecret(stored), plain);
  });

  it("uses a fresh random IV so the same secret encrypts differently every time", () => {
    const plain = "same secret value";
    const a = encryptSecret(plain);
    const b = encryptSecret(plain);
    assert.notEqual(a, b);
    assert.equal(decryptSecret(a), plain);
    assert.equal(decryptSecret(b), plain);
  });

  it("returns plaintext unchanged when the value is not encrypted (backwards compat)", () => {
    assert.equal(decryptSecret("whatsapp-token-plaintext"), "whatsapp-token-plaintext");
    assert.equal(decryptSecret(""), "");
  });

  it("fails safe (returns raw stored text) on a tampered or wrongly-keyed blob", () => {
    const tampered = encryptSecret("real-secret").replace(/.$/, "X"); // corrupt last b64url char
    assert.equal(decryptSecret(tampered), tampered);
    // wrong key: decrypt under a different key must not crash or leak plaintext
    const stored = encryptSecret("real-secret", deriveEncryptionKey({ jwtSecret: "key-a" }));
    assert.equal(decryptSecret(stored, deriveEncryptionKey({ jwtSecret: "key-b" })), stored);
  });

  it("isEncrypted only matches the enc:v1: prefix", () => {
    assert.equal(isEncrypted("enc:v1:abc"), true);
    assert.equal(isEncrypted("enc:v2:abc"), false);
    assert.equal(isEncrypted("enc:v1xabc"), false);
    assert.equal(isEncrypted("plain"), false);
    assert.equal(isEncrypted(""), false);
  });

  it("round-trips under the explicit ENCRYPTION_KEY path", () => {
    const key = deriveEncryptionKey({ encryptionKey: "a-custom-16-char-key-!!" });
    const stored = encryptSecret("token", key);
    assert.equal(decryptSecret(stored, key), "token");
  });

  it("derives a stable fallback key from JWT_SECRET", () => {
    const k1 = deriveEncryptionKey({ jwtSecret: TEST_JWT });
    const k2 = deriveEncryptionKey({ jwtSecret: TEST_JWT });
    assert.deepEqual(k1, k2);
    assert.equal(k1.length, 32);
  });

  it("exposes whether an explicit ENCRYPTION_KEY is configured", () => {
    assert.equal(hasExplicitEncryptionKey(), false);
    process.env.ENCRYPTION_KEY = "0123456789abcdef";
    assert.equal(hasExplicitEncryptionKey(), true);
    delete process.env.ENCRYPTION_KEY;
  });

  it("defines the documented prefix constant", () => {
    assert.equal(ENC_PREFIX, "enc:v1:");
  });
});