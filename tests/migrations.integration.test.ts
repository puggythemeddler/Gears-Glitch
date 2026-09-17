import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { getPool, query, queryOne, runSchema } from "../server/db-helpers";

const HAS_DB = !!process.env.DATABASE_URL;

// DB-backed coverage for the Phase-1 remediation (migration 0013 + boot
// hardening), which is not exercisable without a database:
//   - canonical per-branch columns are present after a clean schema + migration
//   - warranty_claims.repair_ticket_id is TEXT and FK-linked to repair_tickets.id
//   - warranty claims accept a TEXT repair ticket id and branch backfills from the sale
//   - order_items/stock_levels RESTRICT semantics stop destructive product deletes
// Gated the same way as tests/isolation.test.ts — CI's server-test job provides
// Postgres via DATABASE_URL; locally these skip.
describe("migration 0013 + boot hardening (DB)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  const MIG_DIR = path.join(__dirname, "..", "server", "migrations");
  const load = (name: string) => fs.readFileSync(path.join(MIG_DIR, name), "utf8");

  before(() => {
    getPool();
    return Promise.resolve();
  });

  before(async () => {
    const schema = fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8");
    await query(`DROP TABLE IF EXISTS schema_migrations CASCADE`);
    await runSchema(schema);
    // warranty_claims exists only via a versioned migration — apply 0003 then
    // 0013, mirroring runVersionedMigrations producing the canonical state.
    await query(load("0003_warranty_claims.sql"));
    await query(load("0013_branch_attribution_and_repair_link.sql"));
  });

  const clear = async () => {
    await query(
      `TRUNCATE warranty_claims, repair_tickets, order_items, orders, quotes, quote_items,
       purchase_orders, purchase_order_items, stock_take_sessions, stock_take_items,
       stock_movements, stock_transfers, stock_levels CASCADE`
    );
  };

  beforeEach(async () => {
    await clear();
  });

  const seedCustomer = async (email: string) => {
    await query(`INSERT INTO customers (name, email, password_hash) VALUES ($1, $2, 'x') ON CONFLICT (email) DO NOTHING`, ["C", email]);
    return Number((await queryOne("SELECT id FROM customers WHERE email = $1", [email]) as any).id);
  };

  const seedProduct = async (id: string) => {
    await query(
      `INSERT INTO products (id, category, name, price, stock_on_hand, in_stock, cost_price)
       VALUES ($1, 'test', 'P', 100, 10, 1, 60) ON CONFLICT (id) DO NOTHING`, [id]);
  };

  it("adds branch_id to stock_movements, stock_take_sessions, quotes, purchase_orders, repair_tickets, warranty_claims", async () => {
    for (const table of ["stock_movements", "stock_take_sessions", "quotes", "purchase_orders", "repair_tickets", "warranty_claims"]) {
      const col = await queryOne(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = 'branch_id'`, [table]) as any;
      assert.ok(col, `${table}.branch_id exists`);
    }
  });

  it("warranty_claims.repair_ticket_id is TEXT with a real FK to repair_tickets(id)", async () => {
    const col = await queryOne(
      `SELECT data_type FROM information_schema.columns WHERE table_name = 'warranty_claims' AND column_name = 'repair_ticket_id'`) as any;
    assert.equal(col.data_type, "text", "repair_ticket_id must accept TEXT repair ticket ids");
    const fk = await queryOne(
      `SELECT conname FROM pg_constraint WHERE conname = 'warranty_claims_repair_ticket_id_fkey'`);
    assert.ok(fk, "FK warranty_claims_repair_ticket_id_fkey exists");
  });

  it("warranty claim links a TEXT repair ticket id and branch backfills from the sale", async () => {
    await query(`INSERT INTO branches (id, name, address) VALUES (9001, 'WBranch', 'x') ON CONFLICT (id) DO NOTHING`);
    const customerId = await seedCustomer("wc@example.com");
    await seedProduct("wc-prod");
    const order = await query(
      `INSERT INTO orders (customer_id, customer_name, customer_email, status, branch_id)
       VALUES ($1, 'C', 'wc@example.com', 'paid', 9001) RETURNING id`, [customerId]);
    const orderId = Number(order.rows[0].id);
    await query(
      `INSERT INTO order_items (order_id, product_id, name, price, quantity, line_total, serial_number, taxable)
       VALUES ($1, 'wc-prod', 'P', 100, 1, 100, 'WC-SER-1', 1)`, [orderId]);
    await query(
      `INSERT INTO repair_tickets (id, customer_id, device_type, issue_description, status, eta_at)
       VALUES ('REP-WC-001', $1, 'laptop', 'screen', 'received', NOW()::text)`, [customerId]);
    const claim = await query(
      `INSERT INTO warranty_claims (warranty_ref, customer_id, serial_number, repair_ticket_id, notes, branch_id)
       VALUES ('WR-001', $1, 'WC-SER-1', 'REP-WC-001', '', 9001) RETURNING id`, [customerId]);
    const claimId = Number(claim.rows[0].id);
    const row = await queryOne(
      `SELECT wc.repair_ticket_id, rt.id AS rt_id FROM warranty_claims wc
       LEFT JOIN repair_tickets rt ON rt.id = wc.repair_ticket_id WHERE wc.id = $1`, [claimId]) as any;
    assert.equal(row.repair_ticket_id, "REP-WC-001");
    assert.equal(row.rt_id, "REP-WC-001", "claim joins to the repair ticket");

    const claim2 = await query(
      `INSERT INTO warranty_claims (warranty_ref, customer_id, serial_number, notes)
       VALUES ('WR-002', $1, 'WC-SER-1', '') RETURNING id`, [customerId]);
    const claim2Id = Number(claim2.rows[0].id);
    await query(
      `UPDATE warranty_claims wc SET branch_id = o.branch_id
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE oi.serial_number = wc.serial_number AND wc.branch_id IS NULL AND o.branch_id IS NOT NULL`);
    const backfilled = await queryOne("SELECT branch_id FROM warranty_claims WHERE id = $1", [claim2Id]) as any;
    assert.equal(Number(backfilled.branch_id), 9001, "branch derived from the sale that produced the serial");
  });

  it("order_items and stock_levels RESTRICT product deletes with history", async () => {
    const customerId = await seedCustomer("rc@example.com");
    await seedProduct("rc-prod");
    const order = await query(
      `INSERT INTO orders (customer_id, customer_name, customer_email, status)
       VALUES ($1, 'C', 'rc@example.com', 'paid') RETURNING id`, [customerId]);
    await query(
      `INSERT INTO order_items (order_id, product_id, name, price, quantity, line_total, taxable)
       VALUES ($1, 'rc-prod', 'P', 100, 1, 100, 1)`, [Number(order.rows[0].id)]);
    await query(`INSERT INTO stock_levels (product_id, quantity_in_stock) VALUES ('rc-prod', 5) ON CONFLICT (product_id) DO NOTHING`);

    await assert.rejects(
      () => query(`DELETE FROM products WHERE id = 'rc-prod'`),
      "product referenced by order_items (RESTRICT) must not delete"
    );
    const remaining = await queryOne("SELECT id FROM products WHERE id = 'rc-prod'") as any;
    assert.ok(remaining, "product row survives RESTRICT rejection");
    const items = await queryOne("SELECT COUNT(*)::int AS c FROM order_items WHERE product_id = 'rc-prod'") as any;
    assert.equal(Number(items.c), 1, "order history survives untouched");
  });
});