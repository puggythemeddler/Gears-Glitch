import crypto from "crypto";
import bcrypt from "bcryptjs";
import { query, queryOne } from "./db-helpers";

// Admin password lifecycle.
//
// ADMIN_PASSWORD is an INITIAL PROVISIONING credential:
//
//   admin does not exist -> create it with ADMIN_PASSWORD (bcrypt-hashed)
//   admin already exists  -> password is left completely untouched (only the
//                            configured email may be synchronized, matching the
//                            technician seed lifecycle)
//
// It must never be used to re-hash/re-set an existing admin's password on a
// restart, so an operator-changed password survives any number of reboots.
//
// The store is injected so the whole lifecycle is unit-testable with an
// in-memory fake (no database required).

export interface AdminUserRow {
  id: number;
  email: string;
  password_hash: string;
  role: string;
}

export interface AdminProvisioningStore {
  findByUsername(username: string): Promise<AdminUserRow | null>;
  createUser(username: string, email: string, passwordHash: string, role: string): Promise<void>;
  updateEmail(id: number, email: string): Promise<void>;
}

export const defaultAdminProvisioningStore: AdminProvisioningStore = {
  async findByUsername(username: string): Promise<AdminUserRow | null> {
    return (await queryOne("SELECT id, email, password_hash, role FROM users WHERE username = $1", [username])) || null;
  },
  async createUser(username: string, email: string, passwordHash: string, role: string): Promise<void> {
    await query("INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)", [username, email, passwordHash, role]);
  },
  async updateEmail(id: number, email: string): Promise<void> {
    await query("UPDATE users SET email = $1 WHERE id = $2", [email, id]);
  },
};

export interface AdminProvisioningOptions {
  username?: string;
  email?: string;
  password?: string;
  nodeEnv?: string;
  store?: AdminProvisioningStore;
  warn?: (message: string) => void;
}

export type AdminProvisioningResult =
  | { action: "created"; username: string; email: string }
  | { action: "created-dev"; username: string; email: string; generatedTemporaryPassword: string }
  | { action: "email-synced"; username: string; email: string; id: number }
  | { action: "unchanged"; username: string; email: string; id: number }
  | { action: "skipped"; username: string; email: string; reason: "production-no-password" };

/**
 * Provision the store administrator (or leave an existing one untouched).
 *
 * env inputs: ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD, NODE_ENV. Explicit
 * options win over environment variables so tests stay hermetic.
 * Returns the plaintext only in the `created-dev` branch (a generated dev
 * password destined for a warning log, exactly as before) — never for an
 * existing admin and never persisted.
 */
export async function provisionAdminUser(opts: AdminProvisioningOptions = {}): Promise<AdminProvisioningResult> {
  const store = opts.store || defaultAdminProvisioningStore;
  const warn = opts.warn || ((m: string) => console.warn(m));
  const username = opts.username !== undefined ? opts.username : process.env.ADMIN_USERNAME || "admin";
  const email = opts.email !== undefined ? opts.email : process.env.ADMIN_EMAIL || "admin@gearandglitch.com";
  const nodeEnv = opts.nodeEnv !== undefined ? opts.nodeEnv : process.env.NODE_ENV;

  // Existing admin -> never touch the password. Only synchronize the configured
  // email (when it actually differs), exactly like ensureTechnicianUser().
  const existing = await store.findByUsername(username);
  if (existing) {
    if (existing.email !== email) {
      await store.updateEmail(existing.id, email);
      return { action: "email-synced", username, email, id: existing.id };
    }
    return { action: "unchanged", username, email, id: existing.id };
  }

  // First boot — the admin does not exist yet, so ADMIN_PASSWORD is the initial
  // provisioning credential (hash it and create the account).
  const password = opts.password !== undefined ? opts.password : process.env.ADMIN_PASSWORD || "";
  if (!password) {
    if (nodeEnv === "production") {
      warn(`[auth] ADMIN_PASSWORD not set — ${username} was not created (production).`);
      return { action: "skipped", username, email, reason: "production-no-password" };
    }
    // Non-production development fallback: generate a temporary dev password, as
    // before. It is only used here (admin absent) so it can never overwrite an
    // existing admin's password on later restarts.
    const generated = crypto.randomBytes(12).toString("hex");
    const passwordHash = await bcrypt.hash(generated, 10);
    await store.createUser(username, email, passwordHash, "admin");
    warn(`[auth] ADMIN_PASSWORD not set — created ${username} with generated temporary dev password: ${generated}`);
    return { action: "created-dev", username, email, generatedTemporaryPassword: generated };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await store.createUser(username, email, passwordHash, "admin");
  return { action: "created", username, email };
}