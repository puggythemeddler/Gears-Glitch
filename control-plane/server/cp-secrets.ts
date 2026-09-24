import crypto from "crypto";

// Encryption-at-rest for the control plane's own secrets table.
//
// Mirrors the tenant backend's secret-store.ts pattern (server/secret-store.ts):
// stored values are prefixed with "enc:v1:" + base64(iv || authTag || ciphertext)
// using AES-256-GCM. Unlike the tenant's silent-decrypt-failure fallback, the
// control plane THROWS on a failed decrypt: a garbled value forwarded outbound
// (e.g. as the x-control-plane-key header) would otherwise break tenant auth
// silently, so a bad/missing key must fail loudly and be fixed, not papered over.
//
// The IV is derived deterministically (HMAC-SHA256 of the plaintext under the
// same key) — a SIV-style construction that lets requireAuth keep an O(1)
// equality lookup via a dual-branch "col = $1 OR col = $2" query. The trade-off
// (equal plaintexts yield equal ciphertexts) is accepted and documented here so
// the same code path encrypts everything uniformly.
//
// Key source, in priority order:
//   1. CP_SECRETS_KEY  (>= 16 chars) — recommended, independent of session keys
//   2. JWT_SECRET      (>= 16 chars) — fallback so existing installs get
//      encryption-at-rest with no new configuration (JWT_SECRET is already
//      hard-required in production). If you later set CP_SECRETS_KEY, values
//      previously encrypted under the JWT-fallback key will fail to decrypt
//      LOUDLY — re-enter those secrets through the UI to re-encrypt them.
//
// Recovery consequence (documented in SECURITY_MODEL.md §5): losing/changing
// every key source makes previously encrypted values unreadable. Keep the
// effective key stable; use the UI/API to rotate a secret to re-encrypt it under
// a new key.

export const ENC_PREFIX = "enc:v1:";

function sha256(input: string | Buffer): Buffer {
  return crypto.createHash("sha256").update(input).digest();
}

export function getEncryptionKey(): Buffer | null {
  const primary = process.env.CP_SECRETS_KEY;
  if (primary && primary.length >= 16) return sha256(primary);
  const fallback = process.env.JWT_SECRET;
  if (fallback && fallback.length >= 16) return sha256(fallback);
  return null;
}

/** True when a usable key is configured (either CP_SECRETS_KEY or JWT_SECRET). */
export function encryptionKeyConfigured(): boolean {
  return getEncryptionKey() !== null;
}

/** Human-readable description of the active source (never the key itself). */
export function describeEncryptionSource(): string {
  const primary = process.env.CP_SECRETS_KEY;
  if (primary && primary.length >= 16) return "CP_SECRETS_KEY";
  const fallback = process.env.JWT_SECRET;
  if (fallback && fallback.length >= 16) return "JWT_SECRET (fallback)";
  return "none — at-rest secrets stay plaintext";
}

function deterministicIv(plain: string, key: Buffer): Buffer {
  return crypto
    .createHmac("sha256", key)
    .update("cp:v1:iv:")
    .update(plain, "utf8")
    .digest()
    .subarray(0, 12);
}

/**
 * Encrypt a plaintext secret. Returns a deterministic enc:v1: ciphertext when a
 * key is configured, otherwise the plaintext unchanged (existing installs keep
 * working; see startUpWarning below). Already-encrypted values pass through.
 */
export function encryptSecret(plain: string): string {
  const key = getEncryptionKey();
  if (!key) return plain;
  if (!plain || plain.startsWith(ENC_PREFIX)) return plain;
  const iv = deterministicIv(plain, key);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

/**
 * Decrypt an enc:v1: value. Legacy plaintext passes through unchanged. Throws a
 * descriptive Error when the value cannot be decrypted (missing key, corrupted
 * value, or key mismatch) so callers fail loudly instead of forwarding garbage.
 */
export function decryptSecret(stored: string): string {
  if (!stored || !stored.startsWith(ENC_PREFIX)) return stored;
  const key = getEncryptionKey();
  if (!key) {
    throw new Error(
      `Cannot decrypt enc:v1: secret: no encryption key configured. Set CP_SECRETS_KEY (>=16 chars) or a >=16-char JWT_SECRET on the control plane.`
    );
  }
  const box = Buffer.from(stored.slice(ENC_PREFIX.length), "base64");
  if (box.length < 28) {
    throw new Error(`enc:v1: secret value is corrupt (too short).`);
  }
  const iv = box.subarray(0, 12);
  const tag = box.subarray(12, 28);
  const data = box.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    throw new Error(
      `enc:v1: secret failed to decrypt: the active encryption key (${describeEncryptionSource()}) does not match the key it was encrypted with, or the value is corrupt. Re-enter this secret through the UI (it will be re-encrypted under the current key).`
    );
  }
}

/**
 * Deterministic storage variant used for the equality side of lookups
 * ("col = $1 OR col = lookupVariant($1)"). Opaque when no key is configured
 * (degrades to the plaintext branch).
 */
export function lookupVariant(plain: string): string {
  return encryptSecret(plain);
}