// Two customer-reported issues:
//   1. A brand-new client inherited the demo storefront (default category
//      taxonomy + demo catalog) because ensureDefaultCategories() and
//      seedProductsIfEmpty() ran unconditionally at boot. Demo/sample seeding
//      is now opt-in via SEED_DEMO_DATA (default off), so a fresh tenant DB
//      boots empty.
//   2. Admin needed a multi-select "Delete selected" for products and
//      categories. Products already had the selection; this pins that a bulk
//      delete action exists on both lists.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = path.join(__dirname, "..");
const db = fs.readFileSync(path.join(repo, "server/db.ts"), "utf8");
const products = fs.readFileSync(path.join(repo, "frontend/components/admin/AdminProducts.tsx"), "utf8");
const admin = fs.readFileSync(path.join(repo, "frontend/pages/admin.tsx"), "utf8");

describe("demo/sample seeding is opt-in", () => {
  it("defines a SEED_DEMO_DATA gate that defaults off", () => {
    assert.match(db, /function demoSeedEnabled\(\): boolean/);
    assert.match(db, /process\.env\.SEED_DEMO_DATA/);
    // Absent env var must not enable seeding (empty string fails every truthy check).
    const helper = db.slice(db.indexOf("function demoSeedEnabled"));
    assert.ok(!/return true;/.test(helper.slice(0, 400)), "demoSeedEnabled must not default to true");
  });

  it("gates the default category taxonomy and demo catalog behind the flag", () => {
    for (const fn of ["ensureDefaultCategories", "seedProductsIfEmpty", "seedDemoProvider", "seedDemoCustomer"]) {
      const start = db.indexOf(`async function ${fn}(`);
      assert.notEqual(start, -1, `${fn} must exist`);
      const body = db.slice(start, start + 200);
      assert.ok(
        body.includes("if (!demoSeedEnabled()) return;"),
        `${fn} must return early unless SEED_DEMO_DATA is enabled`
      );
    }
  });

  it("no longer keys the demo user seeds off NODE_ENV=production alone", () => {
    const provider = db.slice(db.indexOf("async function seedDemoProvider("));
    const customer = db.slice(db.indexOf("async function seedDemoCustomer("));
    assert.ok(!/NODE_ENV === "production"/.test(provider.slice(0, 160)), "provider demo seed should be flag-gated");
    assert.ok(!/NODE_ENV === "production"/.test(customer.slice(0, 160)), "customer demo seed should be flag-gated");
  });
});

describe("admin bulk delete", () => {
  it("products expose a Delete Selected action wired to a per-item delete loop", () => {
    assert.match(products, /async function deleteSelected\(\)/);
    assert.match(products, /Delete Selected/);
    assert.match(products, /\/api\/products\/\$\{encodeURIComponent\(id\)\}`/);
  });

  it("categories gain selection state and a bulk delete action", () => {
    assert.match(
      admin,
      /const \[selectedIds, setSelectedIds\] = useState<Set<string>>\(new Set\(\)\);/
    );
    assert.match(admin, /function toggleSelectAll\(\)/);
    assert.match(admin, /async function deleteSelected\(\)/);
    assert.match(admin, /Delete Selected/);
    assert.match(admin, /aria-label="Select all categories"/);
    assert.match(admin, /aria-label=\{`Select \$\{c\.label\}`\}/);
  });
});
