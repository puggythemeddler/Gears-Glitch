import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { getPool, query, queryOne, runSchema } from "../server/db-helpers";
import {
  createOrder, updateOrderMpesaStatus, releaseOrderHeldStock, holdStockForOrder,
} from "../server/db";

// Covers the M-Pesa / order hold lifecycle end-to-end at the DB layer, focusing on the
// steps the existing storefront-stock suite does not reach: duplicate callbacks, late
// failure callbacks, amount reconciliation, oversell across two customers, and
// concurrent reservation of the same units.
//
// Reservation semantics being preserved (from the P1 fix):
//   hold      -> products.stock_on_hand -= qty, stock_levels.quantity_reserved += qty
//   paid      -> quantity_in_stock -= qty, quantity_reserved -= qty, status paid
//   released  -> products.stock_on_hand += qty, quantity_reserved -= qty, status cancelled
describe("M-Pesa order hold lifecycle (DB)", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  before(() => {
    getPool();
    return Promise.resolve();
  });

  before(async () => {
    const schema = fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8");
    await query(`DROP TABLE IF EXISTS schema_migrations CASCADE`);
    await runSchema(schema);
  });

  beforeEach(async () => {
    await query(
      `TRUNCATE customers, products, orders, order_items, stock_levels, stock_movements,
       loyalty_transactions CASCADE`
    );
  });

  const seedCustomer = async (email: string) => {
    await query(`INSERT INTO customers (name, email, password_hash) VALUES ($1, $2, 'x') ON CONFLICT (email) DO NOTHING`, ["C", email]);
    return Number((await queryOne("SELECT id FROM customers WHERE email = $1", [email]) as any).id);
  };

  const seedProduct = async (id: string, stock = 5) => {
    await query(
      `INSERT INTO products (id, category, name, price, stock_on_hand, in_stock, cost_price)
       VALUES ($1, 'test', 'P', 100, $2, 1, 60) ON CONFLICT (id) DO NOTHING`, [id, stock]);
    await query(
      `INSERT INTO stock_levels (product_id, quantity_in_stock, quantity_reserved, low_stock_threshold)
       VALUES ($1, $2, 0, 5) ON CONFLICT (product_id) WHERE branch_id IS NULL DO NOTHING`, [id, stock]);
  };

  const onHand = async (id: string) => Number((await queryOne("SELECT stock_on_hand FROM products WHERE id = $1", [id]) as any).stock_on_hand);
  const level = async (id: string) => await queryOne(
    `SELECT quantity_in_stock, quantity_reserved FROM stock_levels WHERE product_id = $1 AND branch_id IS NULL`, [id]) as any;
  const status = async (orderId: number) => String((await queryOne("SELECT status FROM orders WHERE id = $1", [orderId]) as any).status);
  const countMovements = async (orderId: number, type: string) => Number((await queryOne(
    `SELECT COUNT(*)::int AS c FROM stock_movements WHERE movement_type = $1 AND reference_type = 'order' AND reference_id = $2`,
    [type, String(orderId)]) as any).c);

  const placeHeldOrder = async (email: string, productId: string, qty: number, checkoutId: string) => {
    const customerId = await seedCustomer(email);
    const order = await createOrder({
      customerId,
      customerName: "C", customerEmail: email,
      shippingName: "C", shippingAddress: "A", shippingCity: "", shippingCounty: "Nairobi",
      shippingPostcode: "", shippingPhone: "", shippingFee: 0,
      items: [{ productId, name: "P", price: 100, quantity: qty }],
      source: "storefront", stock: "hold",
    });
    await query(`UPDATE orders SET checkout_request_id = $1, mpesa_phone = '0700000000' WHERE id = $2`, [checkoutId, order.id]);
    return order;
  };

  it("step 1-5,8: a successful callback converts the hold exactly once", async () => {
    await seedProduct("mp-ok", 5);
    const order = await placeHeldOrder("ok@example.com", "mp-ok", 2, "ws_1");
    assert.equal(await onHand("mp-ok"), 3, "hold decrements stock_on_hand");
    assert.equal(Number((await level("mp-ok")).quantity_reserved), 2, "hold reserves");

    const res = await updateOrderMpesaStatus("ws_1", 0, "RCP1", 200);
    assert.equal(res.applied, true, `expected applied, got ${res.reason ?? ""}`);
    assert.equal(await status(order.id), "paid");
    assert.equal(Number((await level("mp-ok")).quantity_reserved), 0, "reserve consumed");
    assert.equal(await countMovements(order.id, "sale"), 1, "exactly one sale movement");
  });

  it("step 6-7: a duplicate success callback refreshes the receipt and never re-deducts", async () => {
    await seedProduct("mp-dup", 5);
    const order = await placeHeldOrder("dup@example.com", "mp-dup", 2, "ws_2");
    await updateOrderMpesaStatus("ws_2", 0, "RCP1", 200);

    const after = await level("mp-dup");
    const dup = await updateOrderMpesaStatus("ws_2", 0, "RCP2", 200);
    assert.equal(dup.applied, true, "duplicate success is accepted idempotently");
    const post = await level("mp-dup");

    assert.equal(Number(post.quantity_reserved), Number(after.quantity_reserved), "reserve unchanged by the duplicate");
    assert.equal(Number(post.quantity_in_stock), Number(after.quantity_in_stock), "stock not deducted twice");
    assert.equal(await countMovements(order.id, "sale"), 1, "still exactly one sale movement");
    const receipt = String((await queryOne("SELECT mpesa_receipt FROM orders WHERE id = $1", [order.id]) as any).mpesa_receipt);
    assert.equal(receipt, "RCP2", "the duplicate refreshes the stored receipt");
  });

  it("step 10: a late failure callback cannot undo an already-paid order", async () => {
    await seedProduct("mp-late", 5);
    const order = await placeHeldOrder("late@example.com", "mp-late", 2, "ws_3");
    await updateOrderMpesaStatus("ws_3", 0, "RCP1", 200);
    const settled = await level("mp-late");

    const late = await updateOrderMpesaStatus("ws_3", 1032, "RCP_FAIL", 0);
    assert.equal(late.applied, false, "a late failure is not applied to a paid order");
    assert.equal(await status(order.id), "paid", "order stays paid");
    const post = await level("mp-late");
    assert.equal(Number(post.quantity_reserved), Number(settled.quantity_reserved), "reservation untouched");
    assert.equal(await onHand("mp-late"), 3, "stock_on_hand not restored by a late failure");
  });

  it("a failed callback releases the hold and cancels the order", async () => {
    await seedProduct("mp-fail", 5);
    const order = await placeHeldOrder("fail@example.com", "mp-fail", 2, "ws_4");
    const res = await updateOrderMpesaStatus("ws_4", 1032, null, null);
    assert.equal(res.applied, true, `expected applied, got ${res.reason ?? ""}`);
    assert.equal(await status(order.id), "cancelled");
    assert.equal(await onHand("mp-fail"), 5, "failed payment restores stock_on_hand");
    assert.equal(Number((await level("mp-fail")).quantity_reserved), 0, "reservation released");
    assert.equal(await countMovements(order.id, "release"), 1, "exactly one release movement");
  });

  it("an amount-mismatched callback leaves the order pending and the hold open", async () => {
    await seedProduct("mp-amt", 5);
    const order = await placeHeldOrder("amt@example.com", "mp-amt", 2, "ws_5");
    const res = await updateOrderMpesaStatus("ws_5", 0, "RCP1", 999);
    assert.equal(res.applied, false, "a mismatched amount must not mark the order paid");
    assert.match(res.reason ?? "", /amount mismatch/, `unexpected reason: ${res.reason}`);
    assert.equal(await status(order.id), "pending", "order stays pending for reconciliation");
    assert.equal(Number((await level("mp-amt")).quantity_reserved), 2, "hold stays open for reconciliation");
    assert.equal(await onHand("mp-amt"), 3, "stock stays held, not released and not sold");
  });

  it("a success callback without a receipt leaves the order pending", async () => {
    await seedProduct("mp-norecp", 5);
    const order = await placeHeldOrder("norecp@example.com", "mp-norecp", 2, "ws_6");
    const res = await updateOrderMpesaStatus("ws_6", 0, undefined, 200);
    assert.equal(res.applied, false, "no receipt means no proof of payment");
    assert.equal(await status(order.id), "pending");
    assert.equal(Number((await level("mp-norecp")).quantity_reserved), 2, "hold remains open");
  });

  it("step 11: a second customer cannot reserve stock the first already holds", async () => {
    await seedProduct("mp-two", 3);
    await placeHeldOrder("first@example.com", "mp-two", 3, "ws_7");
    assert.equal(await onHand("mp-two"), 0, "all units held by the first customer");

    await assert.rejects(
      () => placeHeldOrder("second@example.com", "mp-two", 1, "ws_8"),
      /Insufficient stock/,
      "a second customer must not reserve already-held units"
    );
    assert.equal(await onHand("mp-two"), 0, "stock_on_hand unchanged by the rejected order");
    assert.equal(Number((await level("mp-two")).quantity_reserved), 3, "reservation still belongs to the first order only");
  });

  it("step 11: concurrent holds for the same units cannot both succeed (no oversell)", async () => {
    await seedProduct("mp-conc", 2);
    await seedCustomer("ca@example.com");
    await seedCustomer("cb@example.com");

    const attempt = (email: string, checkoutId: string) => placeHeldOrder(email, "mp-conc", 2, checkoutId);
    const results = await Promise.allSettled([attempt("ca@example.com", "ws_9"), attempt("cb@example.com", "ws_10")]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1, `exactly one concurrent hold may win (won ${fulfilled.length})`);
    assert.equal(rejected.length, 1, "the loser is rejected with insufficient stock");
    assert.equal(await onHand("mp-conc"), 0, "stock_on_hand decremented exactly once");
    assert.equal(Number((await level("mp-conc")).quantity_reserved), 2, "reserved exactly once, never 4");
  });

  it("step 7: repeated holdStockForOrder calls never double-reserve", async () => {
    await seedProduct("mp-idem", 5);
    const customerId = await seedCustomer("idem@example.com");
    const order = await createOrder({
      customerId,
      customerName: "C", customerEmail: "idem@example.com",
      shippingName: "C", shippingAddress: "A", shippingCity: "", shippingCounty: "Nairobi",
      shippingPostcode: "", shippingPhone: "", shippingFee: 0,
      items: [{ productId: "mp-idem", name: "P", price: 100, quantity: 2 }],
      source: "storefront", stock: "none",
    });
    for (let i = 0; i < 3; i++) await holdStockForOrder(order.id);
    assert.equal(Number((await level("mp-idem")).quantity_reserved), 2, "held once despite three calls");
    assert.equal(await countMovements(order.id, "reserve"), 1, "one reserve movement");

    // And a release after repeated holds still restores exactly the original quantity.
    await releaseOrderHeldStock(order.id);
    assert.equal(await onHand("mp-idem"), 5, "stock restored exactly");
    assert.equal(Number((await level("mp-idem")).quantity_reserved), 0, "reservation cleared");
  });
});
