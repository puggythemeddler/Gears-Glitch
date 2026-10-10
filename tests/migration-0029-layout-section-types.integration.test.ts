import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

// Rehearsal for 0029_normalize_layout_section_types on a real database.
//
// It drives the deployment path - initDb(), which every server boot runs - so
// the versioned runner, its transaction wrapper and ordering are exercised as
// they are in production. Without DATABASE_URL the suite self-skips, matching
// the other migration rehearsals.
//
// The migration rewrites only `sections[].type === 'categories'`. This test
// proves it remaps the alias in BOTH `config` and `draft_config`, preserves
// order and every other field, leaves canonical layouts untouched, and is
// idempotent.
import { getPool, query, queryOne, runSchema } from "../server/db-helpers";
import { initDb } from "../server/db";

const HAS_DB = !!process.env.DATABASE_URL;
const VERSION = "0029_normalize_layout_section_types";

const legacyConfig = {
  hero: { title: "Legacy hero" },
  theme: "default",
  extra: { keep: true },
  sections: [
    { type: "categories", limit: 6, nested: { a: 1 } },
    { type: "text", title: "Keep me" },
  ],
};

const legacyDraft = {
  note: "draft copy",
  sections: [{ type: "categories" }, { type: "spacer", height: 0 }],
};

const cleanConfig = {
  sections: [{ type: "category-grid" }, { type: "text", title: "Already fine" }],
};

describe("migration 0029 on a real database", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const legacyKey = `qa-0029-legacy-${suffix}`;
  const cleanKey = `qa-0029-clean-${suffix}`;

  before(async () => {
    getPool();
    process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "MigrationTestAdmin1!";
    process.env.TECH_PASSWORD = process.env.TECH_PASSWORD || "MigrationTestTech1!";
    process.env.JWT_SECRET = process.env.JWT_SECRET || "migration-rehearsal-secret-0123456789abcdef";

    await runSchema(fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8"));
    await query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (NOW()::text)
    )`);

    // Make 0029 pending again so initDb applies it against our seeded rows.
    await query(`DELETE FROM schema_migrations WHERE version = $1`, [VERSION]);

    await query(
      `INSERT INTO storefront_layouts (layout_key, label, layout_type, config, draft_config)
       VALUES ($1, $2, 'dynamic', $3, $4), ($5, $6, 'dynamic', $7, NULL)`,
      [
        legacyKey, "QA 0029 legacy", JSON.stringify(legacyConfig), JSON.stringify(legacyDraft),
        cleanKey, "QA 0029 clean", JSON.stringify(cleanConfig),
      ]
    );
  });

  after(async () => {
    await query(`DELETE FROM storefront_layouts WHERE layout_key = ANY($1)`, [[legacyKey, cleanKey]]);
  });

  it("normalises legacy section aliases in config and draft_config on boot", async () => {
    await initDb();

    const row = await queryOne(`SELECT config, draft_config FROM storefront_layouts WHERE layout_key = $1`, [legacyKey]);
    assert.deepEqual(
      row.config.sections.map((s: any) => s.type),
      ["category-grid", "text"],
      "config.sections legacy alias must be remapped, order preserved"
    );
    assert.deepEqual(row.config.sections[0].nested, { a: 1 }, "extra section fields must survive");
    assert.equal(row.config.sections[0].limit, 6);
    assert.equal(row.config.theme, "default");
    assert.deepEqual(row.config.extra, { keep: true });

    assert.deepEqual(
      row.draft_config.sections.map((s: any) => s.type),
      ["category-grid", "spacer"],
      "draft_config.sections must be remapped too"
    );
    assert.equal(row.draft_config.note, "draft copy");

    const recorded = await queryOne(`SELECT version FROM schema_migrations WHERE version = $1`, [VERSION]);
    assert.ok(recorded, "the runner must record 0029 so it cannot re-apply accidentally");
  });

  it("leaves canonical layouts byte-for-byte untouched", async () => {
    const row = await queryOne(`SELECT config FROM storefront_layouts WHERE layout_key = $1`, [cleanKey]);
    assert.deepEqual(row.config, cleanConfig, "a layout without legacy aliases must not be rewritten");
  });

  it("is idempotent: a second boot changes nothing", async () => {
    const before = await queryOne(`SELECT config, draft_config FROM storefront_layouts WHERE layout_key = $1`, [legacyKey]);
    await initDb();
    await initDb();
    const afterRow = await queryOne(`SELECT config, draft_config FROM storefront_layouts WHERE layout_key = $1`, [legacyKey]);
    assert.deepEqual(afterRow.config, before.config);
    assert.deepEqual(afterRow.draft_config, before.draft_config);
  });
});
