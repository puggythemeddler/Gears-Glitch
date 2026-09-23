// Secret storage encryption for Gears&Glitch.
//
// Sensitive credentials (Gmail refresh tokens, OAuth client secrets, M-Pesa /
// WhatsApp secrets, ...) are encrypted at rest with AES-256-GCM before they are
// persisted, and transparently decrypted on read. Values stored this way carry
// a stable `enc:v1:` prefix so plaintext values written by older deployments
// keep working and are migrated to ciphertext the next time they are written.
//
// Key selection:
//   * ENCRYPTION_KEY env (>=16 chars) — RECOMMENDED. A dedicated, stable key
//     that can be rotated independently of JWT_SECRET.
//   * Otherwise a deterministic key is derived from JWT_SECRET so every
//     deployment (which already requires a strong JWT_SECRET) gets encryption
//     without new configuration. Documented trade-off: rotating JWT_SECRET with
//     no ENCRYPTION_KEY present would make previously-encrypted values
//     undecryptable — set ENCRYPTION_KEY for any deployment that needs to
//     rotate secrets independently.

import crypto from "crypto";

export const ENC_PREFIX = "enc:v1:";

function sha256(input: string): Buffer {
  return crypto.createHash("sha256").update(input).digest();
}

let warnedFallback = false;

// Derive the 32-byte AES-256 key. Independent + exported for unit tests.
export function deriveEncryptionKey(opts?: { encryptionKey?: string; jwtSecret?: string }): Buffer {
  const explicit = (opts?.encryptionKey ?? process.env.ENCRYPTION_KEY ?? "").trim();
  if (explicit.length >= 16) return sha256(explicit);
  const jwt = (opts?.jwtSecret ?? process.env.JWT_SECRET ?? "").trim();
  if (!warnedFallback) {
    warnedFallback = true;
    console.warn("[secret-store] ENCRYPTION_KEY is not set — deriving the at-rest encryption key from JWT_SECRET. Set ENCRYPTION_KEY (>=16 chars) to allow independent key rotation.");
  }
  return sha256(`gg-secrets:v1:${jwt}`);
}

// True when an explicit, dedicated ENCRYPTION_KEY is configured (vs the
// JWT_SECRET-derived fallback). Useful for health/onboarding reporting.
export function hasExplicitEncryptionKey(): boolean {
  return (process.env.ENCRYPTION_KEY || "").trim().length >= 16;
}

export function isEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(ENC_PREFIX);
}

// Encrypt a plaintext secret. Always returns a non-empty `enc:v1:` string.
export function encryptSecret(plain: string, key?: Buffer): string {
  const k = key || deriveEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ivB64 = iv.toString("base64url");
  const tagB64 = tag.toString("base64url");
  const dataB64 = data.toString("base64url");
  return `${ENC_PREFIX}${ivB64}.${tagB64}.${dataB64}`;
}

// Decrypt an `enc:v1:` value. Plaintext (or unparseable) values are returned
// unchanged so old rows and env-provided secrets keep working — decryption is
// only ever a transparent read-time step.
export function decryptSecret(stored: string, key?: Buffer): string {
  if (!isEncrypted(stored)) return stored;
  const k = key || deriveEncryptionKey();
  try {
    const body = stored.slice(ENC_PREFIX.length);
    const [ivB64, tagB64, dataB64] = body.split(".");
    if (!ivB64 || !tagB64 || !dataB64) return stored;
    const decipher = crypto.createDecipheriv("aes-256-gcm", k, Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const plain = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    // Never throw on read of a value we cannot decrypt (key rotated, bad blob):
    // fail safe by returning the raw stored text so the caller can surface a
    // configuration error rather than crash a request.
    return stored;
  }
}