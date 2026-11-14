import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { bootstrapTestDatabase } from "../server/test-db";
import { initDb, createStockTakeSession, recordStockCount, completeStockTakeSession, applyStockTakeAdjustments, receivePurchaseOrderItem } from "../server/db";
import { query, queryOne, closePool } from "../server/db-helpers";

const HAS_DB = bootstrapTestDatabase();
const runId = Date.now().toString(36);
const productId = `qa-stock-integrity-${runId}`;
let branchId = 0;

describe("POS and stock integrity (disposable DB)", { skip: !HAS_DB && "TEST_DATABASE_URL not set (disposable test DB only)" }, () => {
  before(async () => {
    await initDb();
    await query("TRUNCATE branches CASCADE");
    const branch = await queryOne(
      `INSERT INTO branches (name, address, phone, email, is_active)
       VALUES ($1, '', '', '', 1) RETURNING id`, [`QA stock integrity ${runId}`]
    ) as any;
    branchId = Number(branch.id);
    await query(
      `INSERT INTO products (id, category, name, price, stock_on_hand, in_stock)
       VALUES ($1, 'qa', 'QA stock integrity fixture', 100, 10, 1)`, [productId]
    );
    await query(
      `INSERT INTO stock_levels (product_id, branch_id, quantity_in_stock, quantity_reserved, quantity_sold, low_stock_threshold)
       VALUES ($1, $2, 5, 0, 0, 2)`, [productId, branchId]
    );
  });

  after(async () => {
    await query("DELETE FROM stock_take_sessions WHERE notes = $1", [`qa-stock-integrity-${runId}`]);
    await query("DELETE FROM purchase_orders WHERE notes = $1", [`qa-stock-integrity-${runId}`]);
    await query("DELETE FROM stock_levels WHERE product_id = $1", [productId]);
    await query("DELETE FROM products WHERE id = $1", [productId]);
    if (branchId) await query("DELETE FROM branches WHERE id = $1", [branchId]);
    await closePool();
  });

  it("applies a stock take once in its completion transaction", async () => {
    const session = await createStockTakeSession(`qa-stock-integrity-${runId}`, undefined, branchId);
    await recordStockCount(session.id, productId, 4, "fixture count", "count_error");
    const completion = await completeStockTakeSession(session.id);
    assert.deepEqual(completion, { ok: true, adjusted: 1 });

    const afterCompletion = await queryOne(
      "SELECT quantity_in_stock FROM stock_levels WHERE product_id = $1 AND branch_id = $2", [productId, branchId]
    ) as any;
    assert.equal(Number(afterCompletion.quantity_in_stock), 4);

    // Simulate a later sale/receipt changing stock. The legacy recovery endpoint
    // must not replay the stale count over the newer value.
    await query("UPDATE stock_levels SET quantity_in_stock = 7 WHERE product_id = $1 AND branch_id = $2", [productId, branchId]);
    assert.equal(await applyStockTakeAdjustments(session.id), null);
    const afterReplay = await queryOne(
      "SELECT quantity_in_stock FROM stock_levels WHERE product_id = $1 AND branch_id = $2", [productId, branchId]
    ) as any;
    assert.equal(Number(afterReplay.quantity_in_stock), 7);
  });

  it("rejects purchase receiving above the ordered quantity without changing stock", async () => {
    const stockBefore = await queryOne(
      "SELECT quantity_in_stock FROM stock_levels WHERE product_id = $1 AND branch_id = $2", [productId, branchId]
    ) as any;
    const po = await queryOne(
      "INSERT INTO purchase_orders (supplier_name, notes, branch_id) VALUES ('QA supplier', $1, $2) RETURNING id",
      [`qa-stock-integrity-${runId}`, branchId]
    ) as any;
    const item = await queryOne(
      "INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity_ordered, quantity_received, unit_cost) VALUES ($1, $2, 1, 0, 50) RETURNING id",
      [po.id, productId]
    ) as any;

    const result = await receivePurchaseOrderItem(Number(item.id), 2);
    assert.equal(result.ok, false);
    assert.match(result.error || "", /cannot exceed/i);
    const quantities = await queryOne(
      `SELECT poi.quantity_received, sl.quantity_in_stock
         FROM purchase_order_items poi JOIN stock_levels sl ON sl.product_id = poi.product_id AND sl.branch_id = $2
        WHERE poi.id = $1`, [item.id, branchId]
    ) as any;
    assert.equal(Number(quantities.quantity_received), 0);
    assert.equal(Number(quantities.quantity_in_stock), Number(stockBefore.quantity_in_stock));
  });
});
