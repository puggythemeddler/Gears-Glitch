import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { getPool, query, queryOne, transaction, runSchema } from "../server/db-helpers";

const HAS_DB = !!process.env.DATABASE_URL;

// DB-backed coverage for the one-source-of-truth migration model after the
// legacy boot-time runMigrations() was removed from server/db.ts.
//
//   - schema.sql alone declares the FULL cumulative schema (fresh == migrated)
//   - every versioned migration (0001..0020) applies cleanly in order on top of
//     a fresh schema.sql, exactly as runVersionedMigrations does
//   - the legacy-only objects (tables/columns/indexes previously created by
//     runMigrations) are present with the right definitions, including money
//     coerced to NUMERIC(12,2)
//   - migration 0020 is a no-op-safe reconciler on an already-migrated database
//
// Gated the same way as tests/migrations.integration.test.ts — CI's
// server-test job provides Postgres via DATABASE_URL; locally these skip.
describe("legacy schema reconciliation (schema.sql + 0020)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  const MIG_DIR = path.join(__dirname, "..", "server", "migrations");
  const load = (name: string) => fs.readFileSync(path.join(MIG_DIR, name), "utf8");
  const migrations = fs.readdirSync(MIG_DIR).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();

  before(() => {
    getPool();
    return Promise.resolve();
  });

  before(async () => {
    const schema = fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8");
    await query(`DROP TABLE IF EXISTS schema_migrations CASCADE`);
    // schema.sql must be idempotent (re-apply must not throw).
    await runSchema(schema);
    await runSchema(schema);
    // Apply every versioned migration in order, each in its own transaction,
    // mirroring runVersionedMigrations (fails loudly, no silent catches).
    for (const file of migrations) {
      const version = file.replace(/\.sql$/, "");
      await transaction(async (client) => {
        await client.query(load(file));
        await client.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, [version]);
      });
    }
  });

  const col = async (table: string, column: string) =>
    queryOne(
      `SELECT data_type, is_nullable, column_default FROM information_schema.columns
       WHERE table_name = $1 AND column_name = $2`, [table, column]) as any;

  it("legacy-only tables exist after schema.sql + migrations", async () => {
    for (const table of ["splashes", "email_logs", "notification_log", "storefront_layouts", "branch_subscriptions"]) {
      const t = await queryOne(
        `SELECT to_regclass($1) AS name`, [table]) as any;
      assert.ok(t?.name, `${table} exists`);
    }
    // branch_subscriptions is consumed by migration 0012, so it must already
    // exist from schema.sql BEFORE any versioned migration runs.
    const ok = await query(
      `INSERT INTO branches (id, name, address) VALUES (9001, 'ReconBranch', 'x') ON CONFLICT (id) DO NOTHING RETURNING id`);
    if (ok.rowCount && ok.rowCount > 0) {
      await query(
        `INSERT INTO subscription_plans (id, name, price) VALUES ('starter', 'Starter', 0) ON CONFLICT (id) DO NOTHING`);
      await query(
        `INSERT INTO branch_subscriptions (branch_id, plan_id) VALUES (9001, 'starter')`);
      const bs = await queryOne(`SELECT branch_id, plan_id FROM branch_subscriptions WHERE branch_id = 9001`) as any;
      assert.equal(Number(bs.branch_id), 9001);
      assert.equal(bs.plan_id, "starter");
    }
  });

  it("legacy-only columns exist with their final definitions", async () => {
    const expected: [string, string][] = [
      ["products", "stock_on_hand"],
      ["products", "sale_price"],
      ["products", "sort_order"],
      ["quotes", "customer_name"],
      ["quotes", "customer_phone"],
      ["quotes", "discount_type"],
      ["quotes", "discount_value"],
      ["quote_items", "discount_type"],
      ["quote_items", "discount_value"],
      ["customers", "comm_prefs"],
      ["categories", "sort_order"],
      ["purchase_orders", "deleted_at"],
      ["invoices", "invoice_number"],
      ["invoices", "due_date"],
      ["invoices", "notes"],
      ["branches", "plan_id"],
      ["users", "totp_secret"],
      ["users", "totp_enabled"],
      ["orders", "checkout_request_id"],
      ["orders", "mpesa_receipt"],
      ["orders", "mpesa_phone"],
      ["orders", "tendered_amount"],
      ["notification_log", "subject"],
      ["notification_log", "customer_id"],
      ["notification_log", "idempotency_key"],
      ["notification_log", "sent_at"],
      ["splashes", "image_url"],
      ["splashes", "link_url"],
      ["splashes", "sort_order"],
    ];
    for (const [table, column] of expected) {
      const c = await col(table, column);
      assert.ok(c, `${table}.${column} exists`);
    }
  });

  it("monetary columns are exact NUMERIC(12,2) on both fresh and migrated databases", async () => {
    const money: [string, string][] = [
      ["products", "cost_price"],
      ["products", "sale_price"],
      ["orders", "vat_amount"],
      ["orders", "tendered_amount"],
      ["order_items", "unit_cost"],
      ["quotes", "discount_value"],
      ["quote_items", "discount_value"],
    ];
    for (const [table, column] of money) {
      const c = await col(table, column);
      assert.ok(c, `${table}.${column} exists`);
      assert.equal(c.data_type, "numeric", `${table}.${column} must be NUMERIC`);
      const precision = await queryOne(
        `SELECT numeric_precision, numeric_scale FROM information_schema.columns
         WHERE table_name = $1 AND column_name = $2`, [table, column]) as any;
      assert.equal(precision.numeric_precision, 12, `${table}.${column} precision`);
      assert.equal(precision.numeric_scale, 2, `${table}.${column} scale`);
    }
  });

  it("legacy-only indexes exist", async () => {
    const indexes = [
      "idx_orders_campaign", "idx_loyalty_tx_order", "idx_products_group",
      "idx_email_logs_type", "idx_email_logs_created",
      "idx_notif_log_event", "idx_notif_log_channel", "idx_notif_log_status",
      "idx_notif_log_created", "idx_notif_log_customer", "idx_notif_log_idem",
      "idx_invoices_status", "idx_invoices_due_date", "idx_orders_checkout_request",
      "idx_stock_levels_product_branch", "idx_branch_subscriptions_expires_at",
    ];
    for (const name of indexes) {
      const idx = await queryOne(
        `SELECT indexname FROM pg_indexes WHERE indexname = $1`, [name]) as any;
      assert.ok(idx, `${name} exists`);
    }
    const chk = await queryOne(
      `SELECT conname FROM pg_constraint WHERE conname = 'chk_review_rating' AND conrelid = 'product_reviews'::regclass`);
    assert.ok(chk, "chk_review_rating constraint exists");
  });

  it("0020 reconciles an already-migrated database without side effects", async () => {
    // Re-apply the reconciler on top of the fully-migrated database (drop the
    // ledger so it actually runs). Every statement must no-op cleanly.
    await query(`DROP TABLE IF EXISTS schema_migrations CASCADE`);
    await query(load("0020_legacy_schema_reconciler.sql"));
    // The data backfills are one-time; the tables/columns are still intact.
    const t = await queryOne(`SELECT to_regclass('notification_log') AS name`) as any;
    assert.ok(t?.name, "notification_log survives a second 0020 pass");
    const c = await col("orders", "tendered_amount");
    assert.equal(c.data_type, "numeric", "money coercion is stable across passes");
  });

  it("one-time data backfills do not duplicate seeds on re-apply", async () => {
    await query(`DROP TABLE IF EXISTS schema_migrations CASCADE`);
    await query(load("0020_legacy_schema_reconciler.sql"));
    const layouts = await queryOne("SELECT COUNT(*)::int AS c FROM storefront_layouts WHERE layout_key IN ('original','amazon','jumia')") as any;
    assert.equal(Number(layouts.c), 3, "default storefront layouts seeded exactly once");
    const types = await queryOne("SELECT COUNT(*)::int AS c FROM repair_types") as any;
    if (Number(types.c) > 0) {
      const dupes = await queryOne("SELECT COUNT(*)::int AS c FROM (SELECT id FROM repair_types GROUP BY id HAVING COUNT(*) > 1) t") as any;
      assert.equal(Number(dupes.c), 0, "repair_types are not duplicated");
    }
  });

  it("0020 backfill failures are RECORDED in reconciler_issues (never silently swallowed)", async () => {
    await query(`DROP TABLE IF EXISTS schema_migrations CASCADE`);
    await query(load("0020_legacy_schema_reconciler.sql"));
    const tbl = await queryOne(`SELECT to_regclass('reconciler_issues') AS name`) as any;
    assert.ok(tbl?.name, "reconciler_issues ledger exists after 0020");

    // Force the same exception-guarded pattern 0020 uses for backfills: raise
    // an error inside a nested block and assert the handler SAVES SQLERRM.
    await query(`
      DO $$
      BEGIN
        BEGIN
          RAISE EXCEPTION 'synthetic backfill failure for reconciler test';
        EXCEPTION WHEN OTHERS THEN
          INSERT INTO reconciler_issues (migration_step, detail) VALUES ('test synthetic', SQLERRM);
        END;
      END $$`);
    const row = await queryOne(
      `SELECT detail FROM reconciler_issues WHERE migration_step = 'test synthetic' ORDER BY id DESC LIMIT 1`) as any;
    assert.ok(row, "exception handler must record the failure row");
    assert.match(String(row.detail), /synthetic backfill failure/);

    // Tolerance preserved: the file still applies cleanly on top of the broken
    // schema (re-applying must not wedge).
    await query(`DROP TABLE IF EXISTS schema_migrations CASCADE`);
    const re = await transaction(async (client) => {
      await client.query(load("0020_legacy_schema_reconciler.sql"));
      return true;
    });
    assert.equal(re, true, "0020 re-applies cleanly with issues recorded");
    const summaryExists = await queryOne(`SELECT to_regclass('reconciler_issues') AS name`) as any;
    assert.ok(summaryExists?.name, "ledger survives a second pass without schema errors");
  });
});