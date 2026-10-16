// tests/about-permissions.test.ts
//
// F5: GET /api/admin/about-us (read), PUT /api/admin/about-us (write) and
// POST /api/admin/about-us/image (write) all used requirePermission("about:view"),
// so any role that was granted read access to the About Us editor could also
// rewrite the page content and replace the banner image. Writes are now gated
// by the dedicated about:update permission, seeded for admin/owner only.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { PERMISSIONS, DEFAULT_ROLES } from "../server/permissions";

const repoRoot = path.join(__dirname, "..");
const index = fs.readFileSync(path.join(repoRoot, "server", "index.ts"), "utf8");

describe("about-us writes require about:update, not about:view", () => {
  it("about:update is advertised alongside about:view", () => {
    assert.ok(PERMISSIONS["about:view"], "about:view must still exist");
    assert.equal(typeof PERMISSIONS["about:update"], "string");
    assert.ok(PERMISSIONS["about:update"].trim().length > 0, "about:update needs a description");
  });

  it("admin and owner hold both about:view and about:update", () => {
    for (const role of ["admin", "owner"] as const) {
      assert.ok(DEFAULT_ROLES[role].includes("about:view"), `${role} must keep about:view`);
      assert.ok(DEFAULT_ROLES[role].includes("about:update"), `${role} must hold about:update`);
    }
  });

  it("no staff-level default role gains write access", () => {
    for (const role of ["manager", "technician", "staff", "provider"]) {
      assert.ok(!DEFAULT_ROLES[role].includes("about:update"), `${role} must not gain about:update`);
      assert.ok(!DEFAULT_ROLES[role].includes("about:view"), `${role} must not gain about:view either`);
    }
  });

  it("the GET route stays on about:view (reading is still a read permission)", () => {
    assert.match(
      index,
      /app\.get\("\/api\/admin\/about-us", adminAuthMiddleware, requirePermission\("about:view"\)/,
      "GET /api/admin/about-us must keep about:view"
    );
  });

  it("PUT content and POST image both require about:update", () => {
    assert.match(
      index,
      /app\.put\("\/api\/admin\/about-us", adminAuthMiddleware, requirePermission\("about:update"\)/,
      "PUT /api/admin/about-us must require about:update"
    );
    assert.match(
      index,
      /app\.post\("\/api\/admin\/about-us\/image", adminAuthMiddleware, requirePermission\("about:update"\)/,
      "POST /api/admin/about-us/image must require about:update"
    );
  });

  it("no about-us write route falls back to about:view", () => {
    const writes = [...index.matchAll(/app\.(put|post)\("\/api\/admin\/about-us[^"]*",[^)]*\)/g)].map((m) => m[0]);
    assert.ok(writes.length >= 2, `expected PUT + POST about-us routes, found ${writes.length}`);
    for (const w of writes) {
      assert.ok(!w.includes('requirePermission("about:view")'), `write route must not use about:view: ${w}`);
      assert.ok(w.includes('requirePermission("about:update")'), `write route must use about:update: ${w}`);
    }
  });
});
