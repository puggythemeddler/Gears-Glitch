import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  encryptSecret,
  decryptSecret,
  lookupVariant,
  encryptionKeyConfigured,
  describeEncryptionSource,
} from "../server/cp-secrets";

// Pure unit tests for the control-plane secrets-at-rest module. env vars are
// read lazily (at call time), so each test controls the effective key source.
const KEY_A = "cp_unit_test_key_a_0123456789";
const KEY_B = "cp_unit_test_key_b_9876543210";

const saved = {
  cpKey: process.env.CP_SECRETS_KEY,
  jwt: process.env.JWT_SECRET,
};

afterEach(() => {
  process.env.CP_SECRETS_KEY = saved.cpKey || "";
  process.env.JWT_SECRET = saved.jwt || "";
});

describe("cp-secrets", () => {
  beforeEach(() => {
    process.env.CP_SECRETS_KEY = "cp_unit_test_key_a_0123456789";
    process.env.JWT_SECRET = "cp-unit-jwt-secret-0123456789";
  });

  it("round-trips a secret and is deterministic (same plaintext → same ciphertext)", () => {
    const a1 = encryptSecret("super-secret-value");
    const a2 = encryptSecret("super-secret-value");
    assert.ok(a1.startsWith("enc:v1:"));
    assert.equal(a1, a2);
    assert.equal(decryptSecret(a1), "super-secret-value");
  });

  it("different plaintexts produce different ciphertexts", () => {
    assert.notEqual(encryptSecret("aaa"), encryptSecret("bbb"));
  });

  it("lookupVariant matches exactly what the equality branch stores", () => {
    const stored = encryptSecret("s3cret");
    assert.equal(lookupVariant("s3cret"), stored);
    assert.equal(lookupVariant("s3cret"), lookupVariant("s3cret"));
  });

  it("is idempotent against already-encrypted values (no double-encryption)", () => {
    const stored = encryptSecret("already");
    assert.equal(encryptSecret(stored), stored);
  });

  it("legacy plaintext passes through untouched (read path)", () => {
    assert.equal(decryptSecret("plain-old-value"), "plain-old-value");
  });

  it("empty values stay empty", () => {
    assert.equal(encryptSecret(""), "");
    assert.equal(decryptSecret(""), "");
  });

  it("CP_SECRETS_KEY takes priority over the JWT_SECRET fallback", () => {
    assert.equal(describeEncryptionSource(), "CP_SECRETS_KEY");
    assert.equal(encryptionKeyConfigured(), true);
  });

  it("falls back to JWT_SECRET when CP_SECRETS_KEY is unset", () => {
    process.env.CP_SECRETS_KEY = "";
    assert.equal(describeEncryptionSource(), "JWT_SECRET (fallback)");
    assert.equal(encryptionKeyConfigured(), true);
    const stored = encryptSecret("fallback-secret");
    assert.ok(stored.startsWith("enc:v1:"));
    assert.equal(decryptSecret(stored), "fallback-secret");
  });

  it("writes plaintext when NO key source is configured (compat mode)", () => {
    process.env.CP_SECRETS_KEY = "";
    process.env.JWT_SECRET = "";
    assert.equal(encryptionKeyConfigured(), false);
    assert.equal(describeEncryptionSource(), "none — at-rest secrets stay plaintext");
    assert.equal(encryptSecret("unprotected"), "unprotected");
  });

  it("rejects a short CP_SECRETS_KEY (falls through to JWT_SECRET fallback)", () => {
    process.env.CP_SECRETS_KEY = "short"; // < 16 chars → not used
    assert.equal(describeEncryptionSource(), "JWT_SECRET (fallback)");
    const stored = encryptSecret("x");
    assert.ok(stored.startsWith("enc:v1:"));
    assert.equal(decryptSecret(stored), "x");
  });

  it("throws on decrypt when the key source changes (recovery is documented)", () => {
    const stored = encryptSecret("keep-me");
    process.env.CP_SECRETS_KEY = KEY_B;
    assert.throws(() => decryptSecret(stored), /does not match|fails to decrypt|corrupt/i);
  });

  it("throws a clear error when an enc:v1: value exists but no key is configured", () => {
    const stored = encryptSecret("needs-key");
    process.env.CP_SECRETS_KEY = "";
    process.env.JWT_SECRET = "";
    assert.throws(() => decryptSecret(stored), /no encryption key configured/i);
  });

  it("throws on corrupted/tampered ciphertext", () => {
    const stored = encryptSecret("tamper-me");
    const box = Buffer.from(stored.slice("enc:v1:".length), "base64");
    box[box.length - 1] ^= 0xff;
    const corrupted = "enc:v1:" + box.toString("base64");
    assert.throws(() => decryptSecret(corrupted), /corrupt|fails to decrypt/i);
  });
});