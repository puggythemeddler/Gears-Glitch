import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { getPool, query, queryOne, queryAll, runSchema } from "../server/db-helpers";
import { salesTotals, salesBreakdown, parseDateRange } from "../server/reporting";
import { computeVatAmount, normalizePaymentMethod, createOrder, getOrder } from "../server/db";

const HAS_DB = !!process.env.DATABASE_URL;

// DB-backed integration coverage for the reporting deliverable: canonical
// sales math, normalized breakdown dimensions, and the new VAT/campaign/loyalty
// columns. Gated the same way as tests/isolation.test.ts — CI's server-test job
// provides Postgres via DATABASE_URL; locally these skip.
describe("reporting integration (DB)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  const BR1 = 1001, BR2 = 1002;
  const JAN = "2026-01-15", JAN2 = "2026-01-16";
  const range = (from = JAN, to = JAN2) => parseDateRange(from, to)!;

  const seed = async () => {
    await query(`INSERT INTO branches (id, name, address) VALUES ($1, 'Test Branch A', 'a'), ($2, 'Test Branch B', 'b') ON CONFLICT (id) DO NOTHING`, [BR1, BR2]);
    await query(`INSERT INTO customers (name, email, password_hash) VALUES ('Report Test', 'report@example.com', 'x') ON CONFLICT (email) DO NOTHING`);
    const cust = await queryOne("SELECT id FROM customers WHERE email = 'report@example.com'") as any;
    await query(`INSERT INTO products (id, category, name, price, stock_on_hand, in_stock, cost_price) VALUES
      ('rep-p1', 'test', 'Widget P1', 100, 50, 1, 60),
      ('rep-p2', 'test', 'Widget P2', 40, 20, 1, 20),
      ('rep-p3', 'test', 'Taxable P3', 2000, 10, 1, 1500)
      ON CONFLICT (id) DO UPDATE SET stock_on_hand = EXCLUDED.stock_on_hand, in_stock = 1`);
    return { customerId: cust.id };
  };

  const makeOrder = async (o: {
    customerId: number; status?: string; branchId?: number | null; created?: string;
    paymentMethod?: string; shipping?: number; discount?: number; giftCard?: number; refunded?: number;
  } = { customerId: 0 }) => {
    const r = await query(
      `INSERT INTO orders (customer_id, customer_name, customer_email, status, shipping_name, shipping_address, shipping_city, shipping_county, shipping_postcode, shipping_phone, shipping_fee, notes, subtotal, discount_amount, gift_card_amount, amount_refunded, payment_method, branch_id, created_at)
       VALUES ($1, 'Report Test', 'report@example.com', $2, '', '', '', '', '', '', $3, '', 0, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [o.customerId, o.status || "paid", o.shipping ?? 0, o.discount ?? 0, o.giftCard ?? 0, o.refunded ?? 0, o.paymentMethod ?? "", o.branchId ?? null, o.created || `${JAN} 09:00:00`]
    );
    return Number(r.rows[0].id);
  };

  const makeItem = async (orderId: number, productId: string, qty = 1, price?: number) => {
    const p = await queryOne("SELECT price FROM products WHERE id = $1", [productId]) as any;
    const unit = price ?? Number(p?.price || 0);
    const r = await query(`INSERT INTO order_items (order_id, product_id, name, price, quantity, line_total, taxable) VALUES ($1, $2, 'Item', $3, $4, $5, 1) RETURNING id`,
      [orderId, productId, unit, qty, Math.round(unit * qty * 100) / 100]);
    return Number(r.rows[0].id);
  };

  const clear = async () => {
    await query(
      `TRUNCATE orders, order_items, refunds, loyalty_transactions, credit_notes, order_invoices, gift_cards, gift_card_redemptions CASCADE`
    );
  };

  before(() => {
    getPool();
    return Promise.resolve();
  });

  before(async () => {
    const schema = fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8");
    await runSchema(schema);
    // Mirror runMigrations so a fresh test DB matches a real install (no-ops
    // where schema.sql already ships the columns).
    await query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS vat_rate DOUBLE PRECISION");
    await query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS vat_amount DOUBLE PRECISION");
    await query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS vat_estimated INTEGER NOT NULL DEFAULT 0");
    await query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS campaign_id INTEGER");
    await query("CREATE INDEX IF NOT EXISTS idx_orders_campaign ON orders(campaign_id)");
    await query("ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS order_id INTEGER");
    await query("CREATE INDEX IF NOT EXISTS idx_loyalty_tx_order ON loyalty_transactions(order_id)");
  });

  beforeEach(async () => {
    await clear();
  });

  it("computeVatAmount matches the tax-inclusive invoice formula and skips non-taxable lines", () => {
    assert.equal(computeVatAmount([{ price: 2000, quantity: 1 }], 16), 275.86);
    assert.equal(computeVatAmount([{ price: 100, quantity: 2 }], 16), 27.59);
    assert.equal(computeVatAmount([{ price: 100, quantity: 1, taxable: false }], 16), 0);
    assert.equal(computeVatAmount([{ price: 100, quantity: 1 }, { price: 50, quantity: 1, taxable: false }], 16), 13.79);
    assert.equal(computeVatAmount([{ price: 100, quantity: 1 }], 0), 0);
  });

  it("normalizePaymentMethod buckets write-side variants used in reports", () => {
    assert.equal(normalizePaymentMethod("M-Pesa"), "mpesa");
    assert.equal(normalizePaymentMethod(" Mpesa "), "mpesa");
    assert.equal(normalizePaymentMethod("MPESA"), "mpesa");
    assert.equal(normalizePaymentMethod("cash"), "cash");
    assert.equal(normalizePaymentMethod("Card"), "card");
    assert.equal(normalizePaymentMethod(""), "");
  });

  it("createOrder stamps the VAT snapshot and campaign attribution at placement", async () => {
    const { customerId } = await seed();
    const order = await createOrder({
      customerId,
      customerName: "Report Test",
      customerEmail: "report@example.com",
      shippingName: "", shippingAddress: "", shippingCity: "", shippingCounty: "", shippingPostcode: "", shippingPhone: "",
      shippingFee: 0,
      items: [{ productId: "rep-p3", name: "Taxable P3", price: 2000, quantity: 1, hasWarranty: true, warrantyDuration: 6 }],
      campaignId: 77,
    });
    assert.equal(order.vatRate, 16, "snapshot rate defaults to settings.taxRate (16 when unset)");
    assert.equal(order.vatAmount, 275.86, "VAT computed at placement, not derived at render");
    assert.equal(order.vatEstimated, 0, "fresh orders are recorded, not estimated");
    assert.equal(order.campaignId, 77, "campaign attribution stamped on the order");
    assert.equal(order.subtotal, 2000);
    const reloaded = await getOrder(Number(order.id));
    assert.equal(reloaded?.vatAmount, 275.86);
    assert.equal(reloaded?.campaignId, 77);
  });

  it("salesTotals computes the canonical net formula and honours branch/date filters", async () => {
    const { customerId } = await seed();
    const a = await makeOrder({ customerId, paymentMethod: "M-Pesa", shipping: 50, discount: 10, giftCard: 20, branchId: BR1 });
    await makeItem(a, "rep-p1", 2); // line 200
    const b = await makeOrder({ customerId, status: "cancelled", branchId: BR1, shipping: 500 }); // excluded
    await makeItem(b, "rep-p1", 9);
    const c = await makeOrder({ customerId, paymentMethod: "card", branchId: BR2 });
    await makeItem(c, "rep-p2", 3); // line 120
    const d = await makeOrder({ customerId, paymentMethod: "", shipping: 5, discount: 5, refunded: 10, created: `${JAN2} 11:00:00` });
    await makeItem(d, "rep-p1", 1, 60); // line 60

    const all = await salesTotals({ from: JAN, to: JAN2 });
    assert.equal(all.orders, 3, "cancelled order excluded");
    assert.equal(all.gross_sales, 435); // 250 + 120 + 65
    assert.equal(all.shipping, 55);
    assert.equal(all.discounts, 15);
    assert.equal(all.gift_cards, 20);
    assert.equal(all.refunds, 10);
    assert.equal(all.net_sales, 390);
    assert.equal(all.items_sold, 6);
    assert.equal(all.aov, 145);

    const branchOnly = await salesTotals({ from: JAN, to: JAN2, branchId: BR2 });
    assert.equal(branchOnly.orders, 1);
    assert.equal(branchOnly.gross_sales, 120);
    assert.equal(branchOnly.net_sales, 120);
    assert.equal(branchOnly.discounts, 0);

    const dayOnly = await salesTotals({ from: JAN, to: JAN });
    assert.equal(dayOnly.orders, 2, "Jan 16 order excluded by inclusive-to bound");
  });

  it("salesBreakdown merges write-side payment_method variants into one bucket", async () => {
    const { customerId } = await seed();
    const a = await makeOrder({ customerId, paymentMethod: "M-Pesa", shipping: 50, discount: 10, giftCard: 20 });
    await makeItem(a, "rep-p1", 2); // 200
    const e = await makeOrder({ customerId, paymentMethod: " mpesa " });
    await makeItem(e, "rep-p1", 1); // 100
    const c = await makeOrder({ customerId, paymentMethod: "card" });
    await makeItem(c, "rep-p2", 3); // 120
    const d = await makeOrder({ customerId, paymentMethod: "" });
    await makeItem(d, "rep-p2", 1); // 40

    const byPayment = await salesBreakdown({ from: JAN, to: JAN2 }, "payment_method");
    const mpesa = byPayment.find((r) => r.id === "mpesa");
    const card = byPayment.find((r) => r.id === "card");
    const unrecorded = byPayment.find((r) => r.id === "unrecorded");
    assert.ok(mpesa, "M-Pesa / mpesa merged into one bucket");
    assert.equal(mpesa?.orders, 2);
    assert.equal(mpesa?.revenue, 350); // (200 + 50) + (100 + 0)
    assert.equal(mpesa?.net, 320); // 350 - discount 10 - gift 20
    assert.equal(card?.revenue, 120);
    assert.equal(unrecorded?.revenue, 40);
  });

  it("salesBreakdown by product reports line revenue only and excludes cancelled lines", async () => {
    const { customerId } = await seed();
    const a = await makeOrder({ customerId, shipping: 50 });
    await makeItem(a, "rep-p1", 2); // 200
    const cancelledLine = await makeOrder({ customerId });
    const ci = await makeItem(cancelledLine, "rep-p2", 10); // 400, but cancelled line
    await query("UPDATE order_items SET cancelled = 1 WHERE id = $1", [ci]);
    const d = await makeOrder({ customerId });
    await makeItem(d, "rep-p1", 1, 60); // 60

    const rows = await salesBreakdown({ from: JAN, to: JAN2 }, "product");
    const p1 = rows.find((r) => r.id === "rep-p1");
    const p2 = rows.find((r) => r.id === "rep-p2");
    assert.equal(p1?.revenue, 260, "shipping not attributed to a line-level dimension");
    assert.equal(p1?.net, 260);
    assert.equal(p1?.items_sold, 3);
    assert.equal(p2, undefined, "cancelled line contributes nothing");
  });

  it("loyalty transactions accept an order_id and round-trip it", async () => {
    const { customerId } = await seed();
    const orderId = await makeOrder({ customerId, paymentMethod: "mpesa" });
    // Known runtime bug before the migration: db.ts wrote order_id to a column
    // that schema.sql never created. The migration must make this insert work.
    const r = await query(
      `INSERT INTO loyalty_transactions (customer_id, points, type, description, order_id) VALUES ($1, 50, 'earn', 'Sale', $2) RETURNING id`,
      [customerId, orderId]
    );
    const id = Number(r.rows[0].id);
    const row = await queryOne("SELECT order_id FROM loyalty_transactions WHERE id = $1", [id]) as any;
    assert.equal(Number(row.order_id), orderId, "order_id stored and readable");
  });
});