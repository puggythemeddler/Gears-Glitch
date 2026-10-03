import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { getPool, query, runSchema } from "../server/db-helpers";
import { initRolesAsync } from "../server/db";
import { DEFAULT_ROLES, hasPermission } from "../server/permissions";

const HAS_DB = !!process.env.DATABASE_URL;

// D2 regression: the authoritative async boot seeding path (initRolesAsync)
// used its own role table that omitted the financing:* permissions, so a fresh
// install left admin/owner/manager unable to manage financing (403). It must
// seed from the single shared source in server/permissions.ts, with least
// privilege: admin/owner get all four, manager gets view/manage/payment but not
// approve, and non-financing roles get none. Gated like the other DB tests.
describe("fresh-install role seeding financing permissions (DB)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  before(() => {
    getPool();
    return Promise.resolve();
  });

  before(async () => {
    const schema = fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8");
    await runSchema(schema);
  });

  beforeEach(async () => {
    for (const roleId of Object.keys(DEFAULT_ROLES)) {
      await query("DELETE FROM deleted_roles WHERE id = $1", [roleId]);
      await query("DELETE FROM roles WHERE id = $1", [roleId]);
    }
    await query("DELETE FROM users WHERE username LIKE 'perms-test-%'");
  });

  async function permsFor(roleId: string): Promise<Set<string>> {
    const rows: any = await query("SELECT permission FROM role_permissions WHERE role_id = $1", [roleId]);
    return new Set(rows.rows.map((r: any) => r.permission));
  }

  async function seedUser(username: string, role: string): Promise<number> {
    const r: any = await query(
      "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, 'x', $3) RETURNING id",
      [username, `${username}@example.com`, role]
    );
    return Number(r.rows[0].id);
  }

  it("seeds financing:* onto admin/owner, and manager without approve", async () => {
    await initRolesAsync();

    const admin = await permsFor("admin");
    const owner = await permsFor("owner");
    const manager = await permsFor("manager");

    for (const perm of ["financing:view", "financing:manage", "financing:approve", "financing:payment"]) {
      assert.ok(admin.has(perm), `admin should have ${perm}`);
      assert.ok(owner.has(perm), `owner should have ${perm}`);
    }

    assert.ok(manager.has("financing:view"), "manager should have financing:view");
    assert.ok(manager.has("financing:manage"), "manager should have financing:manage");
    assert.ok(manager.has("financing:payment"), "manager should have financing:payment");
    assert.ok(!manager.has("financing:approve"), "manager must not have financing:approve");
  });

  it("grants no financing:* to technician/staff/provider", async () => {
    await initRolesAsync();
    for (const role of ["technician", "staff", "provider"]) {
      const perms = await permsFor(role);
      for (const perm of ["financing:view", "financing:manage", "financing:approve", "financing:payment"]) {
        assert.ok(!perms.has(perm), `${role} must not have ${perm}`);
      }
    }
  });

  it("seeds each default role exactly the shared DEFAULT_ROLES permission set", async () => {
    await initRolesAsync();
    for (const [roleId, expected] of Object.entries(DEFAULT_ROLES)) {
      const rows: any = await query("SELECT permission FROM role_permissions WHERE role_id = $1", [roleId]);
      const actual = rows.rows.map((r: any) => r.permission).sort();
      assert.deepEqual(actual, [...expected].sort(), `role ${roleId} must be seeded from the shared source`);
    }
  });

  it("authorizes an admin financing action and still denies an unauthorized role", async () => {
    await initRolesAsync();
    const adminId = await seedUser("perms-test-admin", "admin");
    const techId = await seedUser("perms-test-tech", "technician");

    assert.equal(await hasPermission(adminId, "financing:manage"), true, "admin financing action allowed");
    assert.equal(await hasPermission(adminId, "financing:approve"), true, "admin approval allowed");
    assert.equal(await hasPermission(techId, "financing:manage"), false, "technician financing action denied");
    assert.equal(await hasPermission(techId, "financing:view"), false, "technician financing view denied");
    assert.equal(await hasPermission(techId, "repair:view"), true, "technician keeps its own permissions");
  });
});
