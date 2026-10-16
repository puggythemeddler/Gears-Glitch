import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { query, queryOne, closePool, runSchema } from "../server/db-helpers";
import { bootstrapTestDatabase } from "../server/test-db";

const HAS_DB = bootstrapTestDatabase();

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Upgrade coverage for migration 0033 on an EXISTING install.
//
// schema.sql already contains `is_approved` for FRESH databases, so the only way
// to prove existing installs are upgraded correctly is to reconstruct a
// pre-0033 database (column absent, migration unrecorded, real template rows)
// and then let the REAL server boot run the versioned migration runner
// (server/db.ts runVersionedMigrations via initDb). This pins:
//   - the column is added NOT NULL DEFAULT FALSE (existing rows become unapproved)
//   - the migration is recorded in schema_migrations (runs exactly once)
//   - re-applying it is idempotent and never clobbers a later approval decision
//   - the new WhatsApp permissions land on the admin role
describe("whatsapp migration 0033 upgrade on existing install (DB)", { skip: !HAS_DB && "TEST_DATABASE_URL not set (disposable test DB only)" }, () => {
  const repoRoot = path.resolve(__dirname, "..");
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const MIGRATION_VERSION = "0033_whatsapp_template_approval";
  const migrationSql = fs.readFileSync(path.join(repoRoot, "server", "migrations", `${MIGRATION_VERSION}.sql`), "utf8");

  const childLog: string[] = [];

  async function bootServer(): Promise<{ child: ChildProcess; stop: () => void }> {
    const port = 20000 + Math.floor(Math.random() * 20000);
    const base = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, [tsxCli, "server/index.ts"], {
      cwd: repoRoot,
      env: {
        ...(process.env as any),
        PORT: String(port),
        NODE_ENV: "test",
        DATABASE_URL: process.env.DATABASE_URL || "",
        JWT_SECRET: "qa-wa-mig-0033-jwt-secret-1a2b3c4d",
        ADMIN_USERNAME: "admin",
        ADMIN_EMAIL: "admin@qa.local",
        ADMIN_PASSWORD: "qa-Admin-Pass-2026!",
      } as any,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (d) => { const s = String(d).trim(); if (s) childLog.push(s.slice(0, 300)); });
    child.stderr?.on("data", (d) => { const s = String(d).trim(); if (s) childLog.push(s.slice(0, 300)); });

    const deadline = Date.now() + 120000;
    let healthy = false;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(15000) });
        if (res.ok) { healthy = true; break; }
      } catch {}
      await sleep(1500);
    }
    assert.ok(healthy, `server never became healthy.\nRecent child output:\n${childLog.slice(-40).join("\n")}`);
    return { child, stop: () => child.kill() };
  }

  const columnInfo = () =>
    queryOne(
      `SELECT data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'whatsapp_templates' AND column_name = 'is_approved'`
    ) as Promise<any>;

  async function simulatePre0033(): Promise<void> {
    const schema = fs.readFileSync(path.join(repoRoot, "server", "schema.sql"), "utf8");
    await runSchema(schema);
    await query(`CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (NOW()::text))`);
    // Roll the install back to its pre-0033 shape.
    await query(`ALTER TABLE whatsapp_templates DROP COLUMN IF EXISTS is_approved`);
    await query(`DELETE FROM schema_migrations WHERE version = $1`, [MIGRATION_VERSION]);
    await query(`TRUNCATE whatsapp_templates`);
    // Two real rows that predate the migration (note: no is_approved column yet).
    await query(`INSERT INTO whatsapp_templates (name, language, category, body_text) VALUES ('legacy_utility', 'en', 'UTILITY', 'legacy body')`);
    await query(`INSERT INTO whatsapp_templates (name, language, category, body_text) VALUES ('legacy_marketing', 'en', 'MARKETING', 'legacy body 2')`);
  }

  before(async () => {
    await simulatePre0033();
    // Precondition: the column really is gone before the upgrade boot.
    assert.equal(await columnInfo(), undefined, "fixture must start without is_approved");
  });

  after(async () => {
    // Leave the shared DB in the post-migration shape for any later suite.
    await query(`ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT FALSE`).catch(() => {});
    await closePool();
  });

  it("the real boot runner adds is_approved NOT NULL DEFAULT FALSE, defaults legacy rows, and records the migration once", async () => {
    const { stop } = await bootServer();
    try {
      const col = await columnInfo();
      assert.ok(col, "is_approved column must exist after the upgrade boot");
      assert.equal(col.data_type, "boolean");
      assert.equal(col.is_nullable, "NO", "existing installs must get a NOT NULL column");
      assert.match(String(col.column_default), /false/i, "the column default must be FALSE");

      const rows: any = await query(`SELECT name, is_approved FROM whatsapp_templates ORDER BY name`);
      assert.equal(rows.rows.length, 2, "legacy rows must survive the migration");
      for (const r of rows.rows) {
        assert.equal(r.is_approved, false, `legacy row ${r.name} must default to unapproved (never silently trusted)`);
      }

      const recorded: any = await query(`SELECT version FROM schema_migrations WHERE version = $1`, [MIGRATION_VERSION]);
      assert.equal(recorded.rows.length, 1, "migration must be recorded in schema_migrations");

      const perms: any = await query(`SELECT permission FROM role_permissions WHERE role_id = 'admin'`);
      const set = new Set(perms.rows.map((r: any) => r.permission));
      assert.ok(set.has("whatsapp:manage"), "admin must gain whatsapp:manage");
      assert.ok(set.has("whatsapp:approve"), "admin must gain whatsapp:approve");
    } finally {
      stop();
    }
  });

  it("re-applying 0033 is idempotent and never clobbers a later approval decision", async () => {
    // A row approved after the upgrade must stay approved if the migration is
    // ever re-run (ADD COLUMN IF NOT EXISTS is a no-op once the column exists).
    await query(`UPDATE whatsapp_templates SET is_approved = TRUE WHERE name = 'legacy_utility'`);
    await query(migrationSql);
    await query(migrationSql); // twice — must not throw
    const util = await queryOne(`SELECT is_approved FROM whatsapp_templates WHERE name = 'legacy_utility'`) as any;
    const mkt = await queryOne(`SELECT is_approved FROM whatsapp_templates WHERE name = 'legacy_marketing'`) as any;
    assert.equal(util.is_approved, true, "an approved template must not be reset by a re-run");
    assert.equal(mkt.is_approved, false, "an unapproved template stays unapproved");
  });
});
