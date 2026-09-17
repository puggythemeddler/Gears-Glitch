import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { getPool, query, queryOne, runSchema } from "../server/db-helpers";
import { createStockTransfer, completeStockTransfer, linkSerialsToOrderItem } from "../server/db";

const HAS_DB = !!process.env.DATABASE_URL;

// DB-backed coverage for the Phase-3/4 remediation (migration 0014 + BN2/BN3):
//   - POS orders backfill to the single branch (migration 0014)
//   - migration 0014 is idempotent and the order-branch index exists
//   - a serial physically stocked at branch X cannot be consumed by an order
//     at branch Y, and a consumed serial is reattributed to the selling branch
//   - completing a stock transfer reattributes in-stock serials to the target branch
// Gated the same way as tests/migrations.integration.test.ts — CI's server-test
// job provides Postgres via DATABASE_URL; locally these skip.
describe("order branch + serial branch integrity (DB)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
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
    await query(load("0003_warranty_claims.sql"));
    await query(load("0013_branch_attribution_and_repair_link.sql"));
    await query(load("0014_order_branch_and_serial_integrity.sql"));
  });

  const clear = async () => {
    await query(
      `TRUNCATE branches, customers, products, orders, order_items, serial_numbers,
       stock_levels, stock_movements, stock_transfers CASCADE`
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

  const seedBranch = async (id: number) => {
    await query(`INSERT INTO branches (id, name, address) VALUES ($1, 'B$1', 'x') ON CONFLICT (id) DO NOTHING`, [id]);
  };

  const seedPosOrder = async (customerId: number, productId: string, branchId: number | null) => {
    const order = await query(
      `INSERT INTO orders (customer_id, customer_name, customer_email, status, source, branch_id)
       VALUES ($1, 'C', 'c@example.com', 'paid', 'pos', $2) RETURNING id`, [customerId, branchId]);
    const orderId = Number(order.rows[0].id);
    const item = await query(
      `INSERT INTO order_items (order_id, product_id, name, price, quantity, line_total, taxable)
       VALUES ($1, $2, 'P', 100, 1, 100, 1) RETURNING id`, [orderId, productId]);
    return { orderId, itemId: Number(item.rows[0].id) };
  };

  it("migration 0014 backfills single-branch POS orders and is idempotent", async () => {
    await seedBranch(9101);
    const customerId = await seedCustomer("bn2@example.com");
    await seedProduct("bn2-prod");
    await seedPosOrder(customerId, "bn2-prod", null);

    await query(load("0014_order_branch_and_serial_integrity.sql"));
    const backfilled = await queryOne(
      `SELECT branch_id FROM orders WHERE source = 'pos' AND customer_id = $1`, [customerId]) as any;
    assert.equal(Number(backfilled.branch_id), 9101, "POS order attributed to the single branch");
    await query(load("0014_order_branch_and_serial_integrity.sql"));
    const rowCount = await queryOne(`SELECT COUNT(*)::int AS c FROM orders`) as any;
    assert.equal(Number(rowCount.c), 1, "rerunning migration 0014 must not duplicate backfill work");

    const idx = await queryOne(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_branch_id'`);
    assert.ok(idx, "idx_orders_branch_id exists");
  });

  it("migration 0014 reattributes branchless order movements to the order's branch", async () => {
    await seedBranch(9102);
    const customerId = await seedCustomer("bn2m@example.com");
    await seedProduct("bn2m-prod");
    const { orderId, itemId } = await seedPosOrder(customerId, "bn2m-prod", 9102);
    await query(
      `INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, reference_id, notes, branch_id)
       VALUES ('bn2m-prod', 'sale', -1, 'order', $1, 'legacy', NULL)`, [String(orderId)]);
    assert.ok(itemId > 0);
    await query(load("0014_order_branch_and_serial_integrity.sql"));
    const mv = await queryOne(
      `SELECT branch_id FROM stock_movements WHERE reference_type = 'order' AND reference_id = $1`, [String(orderId)]) as any;
    assert.equal(Number(mv.branch_id), 9102, "movement reattributed to the order's branch");
  });

  it("rejects consuming a serial stocked at a different branch (BN3 branch consistency)", async () => {
    await seedBranch(9111);
    await seedBranch(9112);
    const customerId = await seedCustomer("bn3x@example.com");
    await seedProduct("bn3-prod");
    await query(
      `INSERT INTO serial_numbers (serial_number, product_id, branch_id, status)
       VALUES ('BN3-SER-1', 'bn3-prod', 9111, 'in_stock')`);

    const { itemId } = await seedPosOrder(customerId, "bn3-prod", 9112);
    const res = await linkSerialsToOrderItem(itemId, ["BN3-SER-1"]);
    assert.equal(res.ok, false);
    assert.match(String(res.error || ""), /Transfer it first/);

    const serial = await queryOne(`SELECT status, branch_id FROM serial_numbers WHERE serial_number = 'BN3-SER-1'`) as any;
    assert.equal(serial.status, "in_stock", "serial untouched by a rejected cross-branch consume");
    assert.equal(Number(serial.branch_id), 9111, "serial stays attributed to its stock branch");
  });

  it("consumes a same-branch serial and reattributes it to the selling branch (BN3 stamp)", async () => {
    await seedBranch(9121);
    await seedBranch(9122);
    const customerId = await seedCustomer("bn3ok@example.com");
    await seedProduct("bn3ok-prod");
    // Legacy serial with no branch — must be consumable and stamped to the selling branch.
    await query(
      `INSERT INTO serial_numbers (serial_number, product_id, branch_id, status)
       VALUES ('BN3-SER-2', 'bn3ok-prod', 9121, 'in_stock')`);

    const { itemId } = await seedPosOrder(customerId, "bn3ok-prod", 9121);
    const res = await linkSerialsToOrderItem(itemId, ["BN3-SER-2"]);
    assert.equal(res.ok, true, String(res.error));
    const serial = await queryOne(`SELECT status, branch_id FROM serial_numbers WHERE serial_number = 'BN3-SER-2'`) as any;
    assert.equal(serial.status, "sold");
    assert.equal(Number(serial.branch_id), 9121, "consumed serial follows the selling branch");
  });

  it("completing a stock transfer reattributes in-stock serials to the target branch (BN3 transfer)", async () => {
    await seedBranch(9131);
    await seedBranch(9132);
    await seedProduct("tf-prod");
    await query(
      `INSERT INTO stock_levels (product_id, branch_id, quantity_in_stock) VALUES ('tf-prod', 9131, 5)`);
    await query(
      `INSERT INTO serial_numbers (serial_number, product_id, branch_id, status)
       VALUES ('TF-SER-1', 'tf-prod', 9131, 'in_stock')`);
    await query(
      `INSERT INTO serial_numbers (serial_number, product_id, branch_id, status)
       VALUES ('TF-SER-2', 'tf-prod', 9131, 'sold')`);

    const transfer = await createStockTransfer({
      fromBranchId: 9131, toBranchId: 9132, productId: "tf-prod", quantity: 5, notes: "move", createdBy: 1,
    });
    const completed = await completeStockTransfer((transfer as any).id);
    assert.equal(completed, true, "transfer completes");

    const moved = await queryOne(`SELECT branch_id FROM serial_numbers WHERE serial_number = 'TF-SER-1'`) as any;
    assert.equal(Number(moved.branch_id), 9132, "in-stock serial moves with the transfer");
    const sold = await queryOne(`SELECT branch_id FROM serial_numbers WHERE serial_number = 'TF-SER-2'`) as any;
    assert.equal(Number(sold.branch_id), 9131, "sold serial keeps its sale branch");
  });
});