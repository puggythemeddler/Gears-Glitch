import { describe, it } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import {
  provisionAdminUser,
  type AdminProvisioningStore,
  type AdminUserRow,
} from "../server/admin-provisioning";

// In-memory stand-in for the users table so the whole lifecycle is testable
// without a database (the real store is a thin wrapper over `users` queries).
class MemoryStore implements AdminProvisioningStore {
  rows = new Map<string, AdminUserRow>();
  nextId = 1;

  async findByUsername(username: string): Promise<AdminUserRow | null> {
    const row = this.rows.get(username);
    return row ? { ...row } : null;
  }

  async createUser(username: string, email: string, passwordHash: string, role: string): Promise<void> {
    this.rows.set(username, { id: this.nextId++, email, password_hash: passwordHash, role });
  }

  async updateEmail(id: number, email: string): Promise<void> {
    for (const row of this.rows.values()) if (row.id === id) row.email = email;
  }

  get(username: string): AdminUserRow | undefined {
    return this.rows.get(username);
  }

  async setPassword(username: string, plain: string): Promise<void> {
    const row = this.rows.get(username);
    if (row) row.password_hash = await bcrypt.hash(plain, 10);
  }
}

function warnCollector(): { warnings: string[]; warn: (m: string) => void } {
  const warnings: string[] = [];
  return { warnings, warn: (m) => warnings.push(m) };
}

const NOOP = () => {};

describe("admin provisioning lifecycle", () => {
  it("TEST 1 — creates the admin on first boot with a bcrypt hash (no plaintext)", async () => {
    const store = new MemoryStore();
    const { warn } = warnCollector();
    const result = await provisionAdminUser({
      store,
      username: "admin",
      email: "test@example.com",
      password: "InitialPassword123!",
      warn,
    });

    assert.equal(result.action, "created");
    const admin = store.get("admin");
    assert.ok(admin, "admin must be created");
    assert.equal(admin.role, "admin");
    assert.equal(admin.email, "test@example.com");

    // plaintext is never stored
    assert.notEqual(admin.password_hash, "InitialPassword123!");
    assert.ok(!admin.password_hash.includes("InitialPassword123!"));
    assert.ok(admin.password_hash.startsWith("$2"), "must be a bcrypt hash");

    // authentication works with the initial password
    assert.equal(await bcrypt.compare("InitialPassword123!", admin.password_hash), true);
    assert.equal(await bcrypt.compare("wrong-password", admin.password_hash), false);
  });

  it("TEST 2 — existing admin is never reset when ADMIN_PASSWORD is still set", async () => {
    const store = new MemoryStore();
    await provisionAdminUser({ store, username: "admin", email: "test@example.com", password: "InitialPassword123!", warn: NOOP });

    // Administrator changes the password through the app
    await store.setPassword("admin", "ChangedPassword456!");

    // Restart/init with the ORIGINAL ADMIN_PASSWORD still present
    const result = await provisionAdminUser({ store, username: "admin", email: "test@example.com", password: "InitialPassword123!", warn: NOOP });
    assert.equal(result.action, "unchanged");

    const hash = store.get("admin")!.password_hash;
    assert.equal(await bcrypt.compare("ChangedPassword456!", hash), true, "changed password must remain valid");
    assert.equal(await bcrypt.compare("InitialPassword123!", hash), false, "initial password must no longer be valid");
  });

  it("TEST 3 — existing admin email is synchronized but password_hash never changes", async () => {
    const store = new MemoryStore();
    await provisionAdminUser({ store, username: "admin", email: "old@example.com", password: "InitialPassword123!", warn: NOOP });
    const hashBefore = store.get("admin")!.password_hash;

    const result = await provisionAdminUser({ store, username: "admin", email: "new@example.com", password: "InitialPassword123!", warn: NOOP });
    assert.equal(result.action, "email-synced");
    assert.equal(store.get("admin")!.email, "new@example.com");
    assert.equal(store.get("admin")!.password_hash, hashBefore, "password_hash must be unchanged");
    assert.equal(await bcrypt.compare("InitialPassword123!", store.get("admin")!.password_hash), true);

    // identical email -> no spurious write either
    const noop = await provisionAdminUser({ store, username: "admin", email: "new@example.com", password: "InitialPassword123!", warn: NOOP });
    assert.equal(noop.action, "unchanged");
  });

  it("TEST 4 — existing admin role is never changed by initialization", async () => {
    const store = new MemoryStore();
    await provisionAdminUser({ store, username: "admin", email: "test@example.com", password: "InitialPassword123!", warn: NOOP });
    const admin = store.get("admin")!;
    admin.role = "owner"; // whatever the administrator ended up with later
    const hashBefore = admin.password_hash;

    const result = await provisionAdminUser({ store, username: "admin", email: "test@example.com", password: "InitialPassword123!", warn: NOOP });
    assert.ok(result.action === "unchanged" || result.action === "email-synced");
    assert.equal(store.get("admin")!.role, "owner", "role must be preserved");
    assert.equal(store.get("admin")!.password_hash, hashBefore);
  });

  it("TEST 5 — fresh database provisioning still works (Control Plane flow)", async () => {
    const store = new MemoryStore();
    const result = await provisionAdminUser({
      store,
      username: "admin",
      email: "owner@example.com",
      password: "ctrl-selected-pass-9!",
      nodeEnv: "production",
      warn: NOOP,
    });
    assert.equal(result.action, "created");
    assert.equal(store.get("admin")!.role, "admin");
    assert.equal(await bcrypt.compare("ctrl-selected-pass-9!", store.get("admin")!.password_hash), true);
  });

it("TEST 6 — production without ADMIN_PASSWORD never creates or resets an admin", async () => {
    const store = new MemoryStore();
    const { warn } = warnCollector();

    // Fresh DB, production, no password -> nothing is created
    const skipped = await provisionAdminUser({ store, username: "admin", email: "test@example.com", password: "", nodeEnv: "production", warn });
    assert.equal(skipped.action, "skipped");
    assert.equal(skipped.reason, "production-no-password");
    assert.equal(store.get("admin"), undefined, "no admin may be created in production without ADMIN_PASSWORD");

    // Existing admin + production without ADMIN_PASSWORD -> password untouched
    await provisionAdminUser({ store, username: "admin", email: "test@example.com", password: "InitialPassword123!", warn: NOOP });
    await store.setPassword("admin", "ChangedPassword456!");
    const after = await provisionAdminUser({ store, username: "admin", email: "test@example.com", password: "", nodeEnv: "production", warn });
    assert.equal(after.action, "unchanged");
    assert.equal(await bcrypt.compare("ChangedPassword456!", store.get("admin")!.password_hash), true);
  });

  it("dev fallback — generated temporary dev password cannot overwrite an existing admin", async () => {
    const store = new MemoryStore();
    const { warnings, warn } = warnCollector();

    // First run (fresh dev DB, no ADMIN_PASSWORD): generate a dev password
    const first = await provisionAdminUser({ store, username: "admin", email: "test@example.com", password: "", warn });
    assert.equal(first.action, "created-dev");
    const generated = (first as { generatedTemporaryPassword: string }).generatedTemporaryPassword;
    assert.ok(generated.length > 0);
    assert.equal(await bcrypt.compare(generated, store.get("admin")!.password_hash), true);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes("generated temporary dev password"));

    // Administrator changes the password
    await store.setPassword("admin", "OperatorChanged123!");

    // Restart, still no ADMIN_PASSWORD -> existing admin untouched (no new hash)
    const second = await provisionAdminUser({ store, username: "admin", email: "test@example.com", password: "", warn });
    assert.equal(second.action, "unchanged");
    assert.equal(await bcrypt.compare("OperatorChanged123!", store.get("admin")!.password_hash), true);
    assert.equal(await bcrypt.compare(generated, store.get("admin")!.password_hash), false);
  });
});