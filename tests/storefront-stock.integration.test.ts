import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { getPool, query, queryOne, runSchema } from "../server/db-helpers";
import { createOrder, confirmOrderPayment, releaseOrderHeldStock, updateOrderStatus, holdStockForOrder } from "../server/db";

const HAS_DB = !!process.env.DATABASE_URL;

// DB-backed coverage for the storefront stock-integrity fix (P-3):
//   - createOrder(stock:"hold") reserves: products.stock_on_hand down, stock_levels
//     quantity_reserved up, reserve movement; insufficient stock aborts atomically
//   - holdStockForOrder is idempotent (a repeated PATCH cannot double-reserve)
//   - paying a held order deducts it (confirmOrderPayment) and clears the reserve
//   - an abandoned/push-failed hold releases (releaseOrderHeldStock) and restores stock
//   - admin-cancelling a HELD order restores products.stock_on_hand but never
//     inflates stock_levels.quantity_in_stock (the old double-restock path)
//   - createOrder(stock:"deduct") deducts immediately (COD) and cancel restores
// Gated the same way as the other integration suites — CI provides Postgres via
// DATABASE_URL; locally these skip.
describe("storefront order stock integrity (DB)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
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
    // Mirrors the existing integration suites: apply the migrations the test
    // relies on over an already-migrated database.
    await query(load("0003_warranty_claims.sql"));
    await query(load("0013_branch_attribution_and_repair_link.sql"));
    await query(load("0014_order_branch_and_serial_integrity.sql"));
  });

  const clear = async () => {
    await query(
      `TRUNCATE customers, products, orders, order_items, stock_levels, stock_movements,
       stock_transfers, coupons, gift_cards, loyalty_transactions, campaigns CASCADE`
    );
  };

  beforeEach(async () => {
    await clear();
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

  const stockRows = async (productId: string) => {
    return (await queryOne(
      `SELECT stock_on_hand FROM products WHERE id = $1`, [productId]) as any).stock_on_hand;
  };

  const levelRows = async (productId: string) => {
    return (await queryOne(
      `SELECT quantity_in_stock, quantity_reserved FROM stock_levels WHERE product_id = $1 AND branch_id IS NULL`, [productId]) as any);
  };

  const movementCount = async (orderId: number, type: string) => {
    const r = await queryOne(
      `SELECT COUNT(*)::int AS c FROM stock_movements WHERE movement_type = $1 AND reference_type = 'order' AND reference_id = $2`, [type, String(orderId)]) as any;
    return Number(r.c);
  };

  it("createOrder(stock:'hold') reserves stock and aborts atomically on shortage", async () => {
    const customerId = await seedCustomer("hi@example.com");
    await seedProduct("hi-prod", 5);
    await assert.rejects(
      () => createOrder({
        customerId,
        customerName: "C", customerEmail: "hi@example.com",
        shippingName: "C", shippingAddress: "A", shippingCity: "", shippingCounty: "Nairobi",
        shippingPostcode: "", shippingPhone: "", shippingFee: 0,
        items: [{ productId: "hi-prod", name: "P", price: 100, quantity: 99 }],
        source: "storefront", stock: "hold",
      }),
      /Insufficient stock/,
      "a hold beyond available stock must fail loudly, never oversell"
    );
    assert.equal(await stockRows("hi-prod"), 5, "failed hold rolls back the decrement");
    const level = await levelRows("hi-prod");
    assert.equal(Number(level.quantity_reserved), 0, "failed hold leaves no reservation");

    const order = await createOrder({
      customerId,
      customerName: "C", customerEmail: "hi@example.com",
      shippingName: "C", shippingAddress: "A", shippingCity: "", shippingCounty: "Nairobi",
      shippingPostcode: "", shippingPhone: "", shippingFee: 0,
      items: [{ productId: "hi-prod", name: "P", price: 100, quantity: 2 }],
      source: "storefront", stock: "hold",
    });
    assert.equal(await stockRows("hi-prod"), 3, "hold decrements products.stock_on_hand");
    const held = await levelRows("hi-prod");
    assert.equal(Number(held.quantity_reserved), 2, "hold increments quantity_reserved");
    assert.equal(await movementCount(order.id, "reserve"), 1, "hold writes a reserve movement");
  });

  it("holdStockForOrder is idempotent and release restores exactly", async () => {
    const customerId = await seedCustomer("ri@example.com");
    await seedProduct("ri-prod", 5);
    const order = await createOrder({
      customerId,
      customerName: "C", customerEmail: "ri@example.com",
      shippingName: "C", shippingAddress: "A", shippingCity: "", shippingCounty: "Nairobi",
      shippingPostcode: "", shippingPhone: "", shippingFee: 0,
      items: [{ productId: "ri-prod", name: "P", price: 100, quantity: 2 }],
      source: "storefront", stock: "none",
    });
    await holdStockForOrder(order.id);
    await holdStockForOrder(order.id); // duplicate PATCH — must not double-reserve
    assert.equal(await stockRows("ri-prod"), 3, "a second hold is a no-op");
    assert.equal(Number((await levelRows("ri-prod")).quantity_reserved), 2, "reservation held once");

    await releaseOrderHeldStock(order.id);
    assert.equal(await stockRows("ri-prod"), 5, "release restores products.stock_on_hand");
    assert.equal(Number((await levelRows("ri-prod")).quantity_reserved), 0, "release clears the reserve");
    assert.equal(await movementCount(order.id, "release"), 1, "release writes a release movement");
  });

  it("paying a held order deducts stock and clears the reserve", async () => {
    const customerId = await seedCustomer("pi@example.com");
    await seedProduct("pi-prod", 5);
    const order = await createOrder({
      customerId,
      customerName: "C", customerEmail: "pi@example.com",
      shippingName: "C", shippingAddress: "A", shippingCity: "", shippingCounty: "Nairobi",
      shippingPostcode: "", shippingPhone: "", shippingFee: 0,
      items: [{ productId: "pi-prod", name: "P", price: 100, quantity: 2 }],
      source: "storefront", stock: "hold",
    });
    await confirmOrderPayment(order.id);
    assert.equal(await stockRows("pi-prod"), 3, "paid order keeps the products.stock_on_hand deduction");
    const paid = await levelRows("pi-prod");
    assert.equal(Number(paid.quantity_reserved), 0, "payment consumes the reserve");
    assert.equal(await movementCount(order.id, "sale"), 1, "payment writes a sale movement");
  });

  it("admin-cancelling a HELD order restores stock without inflating quantity_in_stock", async () => {
    const customerId = await seedCustomer("ci@example.com");
    await seedProduct("ci-prod", 5);
    const order = await createOrder({
      customerId,
      customerName: "C", customerEmail: "ci@example.com",
      shippingName: "C", shippingAddress: "A", shippingCity: "", shippingCounty: "Nairobi",
      shippingPostcode: "", shippingPhone: "", shippingFee: 0,
      items: [{ productId: "ci-prod", name: "P", price: 100, quantity: 2 }],
      source: "storefront", stock: "hold",
    });
    await updateOrderStatus(order.id, "cancelled");
    assert.equal(await stockRows("ci-prod"), 5, "cancel restores products.stock_on_hand");
    const held = await levelRows("ci-prod");
    assert.equal(Number(held.quantity_reserved), 0, "cancel clears the reservation");
    assert.equal(Number(held.quantity_in_stock), 5, "a held order cancel never inflated quantity_in_stock");
  });

  it("createOrder(stock:'deduct') deducts immediately and admin-cancel restores it", async () => {
    const customerId = await seedCustomer("di@example.com");
    await seedProduct("di-prod", 5);
    const order = await createOrder({
      customerId,
      customerName: "C", customerEmail: "di@example.com",
      shippingName: "C", shippingAddress: "A", shippingCity: "", shippingCounty: "Nairobi",
      shippingPostcode: "", shippingPhone: "", shippingFee: 0,
      items: [{ productId: "di-prod", name: "P", price: 100, quantity: 2 }],
      source: "storefront", stock: "deduct",
    });
    assert.equal(await stockRows("di-prod"), 3, "deduct decrements products.stock_on_hand");
    assert.equal(Number((await levelRows("di-prod")).quantity_in_stock), 3, "deduct decrements quantity_in_stock");
    assert.equal(await movementCount(order.id, "sale"), 1, "deduct writes a sale movement");

    await updateOrderStatus(order.id, "cancelled");
    assert.equal(await stockRows("di-prod"), 5, "cancel restores stock_on_hand");
    assert.equal(Number((await levelRows("di-prod")).quantity_in_stock), 5, "cancel restores quantity_in_stock");
  });
});