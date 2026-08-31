import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { getPool, query, queryOne, queryAll, runSchema } from "../server/db-helpers";
import {
  createRefund,
  redeemGiftCard,
  getGiftCard,
  linkSerialsToOrderItem,
  linkSerialToOrderItem,
  updateOrderStatus,
  updateOrderMpesaStatus,
  confirmOrderPayment,
  releaseOrderHeldStock,
  cancelOrderItemQuantity,
} from "../server/db";

const HAS_DB = !!process.env.DATABASE_URL;

describe("isolation & atomicity (P0)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  let pool: any;

  const seed = async () => {
    await query(
      `INSERT INTO customers (name, email, password_hash) VALUES ('Test', 'test@example.com', 'x')
       ON CONFLICT (email) DO NOTHING`
    );
    const cust = await queryOne("SELECT id FROM customers WHERE email = 'test@example.com'") as any;
    const productId = "prod-isolation-1";
    // Reset the fixture product's stock deterministically on every seed: the
    // transactional tables are truncated in clear(), but products/stock_levels
    // persist across tests, so prior tests' mutations would otherwise leak in.
    await query(
      `INSERT INTO products (id, category, name, price, in_stock, stock_on_hand) VALUES ($1, 'test', 'Test Product', 100, 0, 10)
       ON CONFLICT (id) DO UPDATE SET stock_on_hand = 10, in_stock = 0`,
      [productId]
    );
    await query(
      `INSERT INTO stock_levels (product_id, quantity_in_stock, quantity_reserved, quantity_sold) VALUES ($1, 100, 0, 0)
       ON CONFLICT (product_id) DO UPDATE SET quantity_in_stock = 100, quantity_reserved = 0, quantity_sold = 0`,
      [productId]
    );
    return { customerId: cust.id, productId };
  };

  const clear = async () => {
    await query(
      `TRUNCATE orders, order_items, serial_numbers, stock_movements, refunds, gift_cards, gift_card_redemptions, credit_notes CASCADE`
    );
  };

  const makeOrder = async (customerId: number, status = "confirmed", branchId: number | null = null) => {
    const r = await query(
      `INSERT INTO orders (customer_id, status, subtotal, payment_method, branch_id) VALUES ($1, $2, 100, 'card', $3) RETURNING id`,
      [customerId, status, branchId]
    );
    return Number(r.rows[0].id);
  };

  const makeItem = async (orderId: number, productId: string, qty = 1, price = 100) => {
    const r = await query(
      `INSERT INTO order_items (order_id, product_id, name, price, quantity, line_total) VALUES ($1, $2, 'Item', $3, $4, $5) RETURNING id`,
      [orderId, productId, price, qty, price * qty]
    );
    return Number(r.rows[0].id);
  };

  const makeSerial = async (productId: string, sn: string) => {
    await query(`INSERT INTO serial_numbers (serial_number, product_id, status) VALUES ($1, $2, 'in_stock')`, [sn, productId]);
  };

  const serialStatus = async (sn: string) => {
    const r = await queryOne("SELECT status, order_item_id FROM serial_numbers WHERE serial_number = $1", [sn]) as any;
    return r;
  };

  const stockState = async (productId: string) => {
    const p = await queryOne(`SELECT stock_on_hand FROM products WHERE id = $1`, [productId]) as any;
    const l = await queryOne(`SELECT quantity_in_stock, quantity_reserved, quantity_sold FROM stock_levels WHERE product_id = $1 AND branch_id IS NULL`, [productId]) as any;
    return { stockOnHand: Number(p?.stock_on_hand || 0), inStock: Number(l?.quantity_in_stock ?? 0), reserved: Number(l?.quantity_reserved ?? 0) };
  };

  before(() => {
    pool = getPool();
    return Promise.resolve();
  });

  beforeEach(async () => {
    await clear();
  });

  before(async () => {
    const schema = fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8");
    await runSchema(schema);
    // Migration columns that the P0 code paths depend on (added at runtime by
    // runMigrations on real installs; mirrored here for a fresh test DB).
    await query("ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_on_hand INTEGER NOT NULL DEFAULT 0");
    await query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_request_id TEXT");
    await query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS mpesa_receipt TEXT");
    await query("ALTER TABLE stock_levels ADD COLUMN IF NOT EXISTS branch_id INTEGER");
    await query("ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS branch_id INTEGER");
  });

  it("gift card cannot be double-redeemed concurrently", async () => {
    const { customerId } = await seed();
    const order1 = await makeOrder(customerId);
    const order2 = await makeOrder(customerId);
    await query(`INSERT INTO gift_cards (code, initial_value, balance, is_active) VALUES ('GC100', 100, 100, 1)`);
    const card = await queryOne("SELECT id FROM gift_cards WHERE code = 'GC100'") as any;

    const results = await Promise.all([
      redeemGiftCard(card.id, order1, customerId, 80),
      redeemGiftCard(card.id, order2, customerId, 80),
    ]);

    const succeeded = results.filter(Boolean).length;
    assert.equal(succeeded, 1, "only one concurrent redeem may succeed");
    const after = await getGiftCard(card.id) as any;
    assert.equal(Number(after.balance), 20, "balance debited exactly once");
    const redemptions = await queryAll("SELECT COUNT(*)::int AS n FROM gift_card_redemptions", []) as any;
    assert.equal(redemptions[0].n, 1, "only one redemption row recorded");
  });

  it("same serial cannot be claimed by two order lines concurrently", async () => {
    const { customerId, productId } = await seed();
    const order1 = await makeOrder(customerId, "pending_payment");
    const order2 = await makeOrder(customerId, "pending_payment");
    const item1 = await makeItem(order1, productId);
    const item2 = await makeItem(order2, productId);
    await makeSerial(productId, "SN-DUP-001");
    await makeSerial(productId, "SN-DUP-002");

    const results = await Promise.all([
      linkSerialsToOrderItem(item1, ["SN-DUP-001", "SN-DUP-002"]),
      linkSerialsToOrderItem(item2, ["SN-DUP-001", "SN-DUP-002"]),
    ]);

    const successCount = results.filter((r) => r.ok).length;
    assert.equal(successCount, 1, "only one line may win the serial claim");
    const s1 = await serialStatus("SN-DUP-001");
    const s2 = await serialStatus("SN-DUP-002");
    assert.equal(s1.status, "sold");
    assert.equal(s2.status, "sold");
    assert.equal(s1.order_item_id, s2.order_item_id, "both serials went to the same winning line");
  });

  it("second serial link attempt on a sold serial is rejected", async () => {
    const { customerId, productId } = await seed();
    const order = await makeOrder(customerId);
    const item = await makeItem(order, productId);
    await makeSerial(productId, "SN-ONCE-001");
    const ok = await linkSerialsToOrderItem(item, ["SN-ONCE-001"]);
    assert.equal(ok.ok, true);
    const again = await linkSerialsToOrderItem(item, ["SN-ONCE-001"]);
    assert.equal(again.ok, false, "already-sold serial must be rejected");
    assert.match(String(again.error || ""), /already sold/i);
  });

  it("refund cannot exceed remaining balance even under concurrency", async () => {
    const { customerId, productId } = await seed();
    const order = await makeOrder(customerId, "paid");
    await makeItem(order, productId, 1, 100);

    const outcome = await Promise.allSettled([
      createRefund({ orderId: order, amount: 60, reason: "a" }),
      createRefund({ orderId: order, amount: 60, reason: "b" }),
    ]);
    const fulfilled = outcome.filter((o) => o.status === "fulfilled").length;
    assert.equal(fulfilled, 1, "only one concurrent refund may fit the remaining balance");
    const totals = await queryOne("SELECT COALESCE(SUM(amount), 0)::int AS total, COUNT(*)::int AS n FROM refunds WHERE order_id = $1", [order]) as any;
    assert.equal(totals.total, 60, "refunded amount is exactly 60, not 120");
    assert.equal(totals.n, 1);
  });

  it("line refund returns stock and frees the serial atomically", async () => {
    const { customerId, productId } = await seed();
    const order = await makeOrder(customerId, "paid");
    const item = await makeItem(order, productId, 1, 100);
    await makeSerial(productId, "SN-RET-001");
    await linkSerialsToOrderItem(item, ["SN-RET-001"]);
    // Simulate stock held at checkout: 10 -> 9 on hand.
    await query("UPDATE products SET stock_on_hand = stock_on_hand - 1 WHERE id = $1", [productId]);

    await createRefund({ orderId: order, orderItemId: item, amount: 100, reason: "return" });

    const s = await serialStatus("SN-RET-001");
    assert.equal(s.status, "in_stock", "serial freed after line refund");
    assert.equal(s.order_item_id, null);
    const line = await queryOne("SELECT cancelled FROM order_items WHERE id = $1", [item]) as any;
    assert.equal(line.cancelled, 1, "line cancelled");
    const st = await stockState(productId);
    assert.equal(st.stockOnHand, 10, "stock returned on refund");
  });

  it("M-Pesa duplicate success callback does not double-deduct stock", async () => {
    const { customerId, productId } = await seed();
    const order = await makeOrder(customerId, "pending_payment");
    await makeItem(order, productId, 2, 100);
    await query("UPDATE products SET stock_on_hand = stock_on_hand - 2 WHERE id = $1", [productId]);
    await query("UPDATE stock_levels SET quantity_in_stock = 98, quantity_reserved = 2 WHERE product_id = $1 AND branch_id IS NULL", [productId]);
    await query("UPDATE orders SET checkout_request_id = 'CB-TEST-1' WHERE id = $1", [order]);

    await updateOrderMpesaStatus("CB-TEST-1", 0, "RCPT-1");
    const afterFirst = await stockState(productId);
    assert.equal(afterFirst.reserved, 0, "reserved moved to sold after payment");
    assert.equal(afterFirst.inStock, 96, "in-stock decremented by 2 once");

    await updateOrderMpesaStatus("CB-TEST-1", 0, "RCPT-1");
    const afterSecond = await stockState(productId);
    assert.deepEqual(afterSecond, afterFirst, "duplicate success callback is a no-op for stock");
    const o = await queryOne("SELECT mpesa_receipt FROM orders WHERE id = $1", [order]) as any;
    assert.equal(o.mpesa_receipt, "RCPT-1");
  });

  it("M-Pesa late failure does not undo an already-paid order", async () => {
    const { customerId, productId } = await seed();
    const order = await makeOrder(customerId, "pending_payment");
    await makeItem(order, productId, 1, 100);
    await query("UPDATE orders SET checkout_request_id = 'CB-TEST-2' WHERE id = $1", [order]);
    await query("UPDATE products SET stock_on_hand = stock_on_hand - 1 WHERE id = $1", [productId]);

    await updateOrderMpesaStatus("CB-TEST-2", 0, "RCPT-2");
    await releaseOrderHeldStock(order); // late/duplicate failure path
    const o = await queryOne("SELECT status FROM orders WHERE id = $1", [order]) as any;
    assert.equal(o.status, "paid", "success callback must not be undone by a later release");
    const st = await stockState(productId);
    assert.equal(st.stockOnHand, 9, "stock not restored after order was paid");
  });

  it("full-order cancel restores stock and frees serials exactly once", async () => {
    const { customerId, productId } = await seed();
    const order = await makeOrder(customerId, "shipped");
    const item = await makeItem(order, productId, 1, 100);
    await makeSerial(productId, "SN-CAN-001");
    await linkSerialsToOrderItem(item, ["SN-CAN-001"]);
    await query("UPDATE products SET stock_on_hand = stock_on_hand - 1 WHERE id = $1", [productId]);
    await query("UPDATE stock_levels SET quantity_in_stock = 99 WHERE product_id = $1 AND branch_id IS NULL", [productId]);

    const ok1 = await updateOrderStatus(order, "cancelled");
    assert.equal(ok1, true);
    const after1 = await stockState(productId);
    assert.equal(after1.stockOnHand, 10, "stock restored after cancel");
    assert.equal(after1.inStock, 100, "in-stock restored after cancel");
    const s = await serialStatus("SN-CAN-001");
    assert.equal(s.status, "in_stock", "serial freed after cancel");

    await updateOrderStatus(order, "cancelled"); // duplicate cancel
    const after2 = await stockState(productId);
    assert.deepEqual(after2, after1, "duplicate cancel must not double-restore stock");
  });

  it("cancelled line cancel is idempotent and never double-restores", async () => {
    const { customerId, productId } = await seed();
    const order = await makeOrder(customerId, "paid");
    const item = await makeItem(order, productId, 1, 100);
    await query("UPDATE products SET stock_on_hand = stock_on_hand - 1 WHERE id = $1", [productId]);

    assert.equal(await cancelOrderItemQuantity(item, 0), true);
    const after1 = await stockState(productId);
    assert.equal(after1.stockOnHand, 10);
    assert.equal(await cancelOrderItemQuantity(item, 0), true);
    const after2 = await stockState(productId);
    assert.deepEqual(after2, after1, "second cancel must not restore stock again");
  });
});