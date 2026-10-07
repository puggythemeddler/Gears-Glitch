import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { spawn, ChildProcess } from "child_process";

const HAS_DB = !!process.env.DATABASE_URL;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// HTTP coverage of the order-lifecycle rules against a REAL server:
//   - completing a POS sale walks the order confirmed -> paid (cash at the till),
//     records orders.paid_at, copies the selected customer's email across, and
//     automatically emails the invoice (email_logs gains an order_invoice row);
//   - a confirmed order with NO recorded payment cannot advance to
//     shipped/delivered — the owner (who holds order:without_payment by default)
//     may, but a manager (who does not) gets 403;
//   - a paid order CAN be advanced by a manager, so real money never
//     bottlenecks fulfilment;
//   - delivering an order emails the invoice PDF (order_status row) on top of
//     the plain status email.
describe("order lifecycle (confirmed -> paid guard, automatic invoices) over real HTTP (DB)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  let child: ChildProcess | null = null;
  let base = "";
  const childLog: string[] = [];

  const runId = Date.now().toString(36).slice(-6);
  const ADMIN_USERNAME = `qa-order-admin-${runId}`;
  const ADMIN_PASSWORD = "qa-Order-Admin-2026!";
  const MANAGER_USERNAME = `qa-order-mgr-${runId}`;
  const MANAGER_PASSWORD = "qa-Order-Mgr-2026!";
  const CUSTOMER_EMAIL = `${runId}@order-lifecycle.qa`;

  const repoRoot = path.resolve(__dirname, "..");
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");

  const fixtureBranchIds: number[] = [];
  const fixtureProductIds: string[] = [];
  const fixtureCustomerIds: number[] = [];
  const fixtureOrderIds: number[] = [];

  async function db(config?: { multiple?: boolean }) {
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: config?.multiple ? 4 : 1 });
    return {
      q: (sql: string, params?: any[]) => pool.query(sql, params),
      async q1(sql: string, params?: any[]) {
        const r = await pool.query(sql, params);
        return r.rows[0];
      },
      end: () => pool.end(),
    };
  }

  async function ensureBranch(): Promise<number> {
    const d = await db();
    try {
      const existing = await d.q1("SELECT COUNT(*) AS c FROM branches WHERE is_active = 1");
      if (Number(existing.c) > 0) {
        const r = await d.q1("SELECT id FROM branches WHERE is_active = 1 ORDER BY id LIMIT 1");
        return Number(r.id);
      }
      const r = await d.q1("INSERT INTO branches (name, address, phone, email, is_active) VALUES ($1, '', '', '', 1) RETURNING id", [`qa-order-fixture-${runId}`]);
      const id = Number(r.id);
      fixtureBranchIds.push(id);
      return id;
    } finally {
      await d.end();
    }
  }

  async function waitForHealth(url: string, timeoutMs = 120000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (res.ok) return true;
      } catch {}
      await sleep(1500);
    }
    return false;
  }

  function jar() {
    const m = new Map<string, string>();
    return {
      header: () => [...m].map(([k, v]) => `${k}=${v}`).join("; "),
      cookies: () => Object.fromEntries(m),
      absorb(res: Response) {
        for (const line of res.headers.getSetCookie?.() || []) {
          const [pair] = line.split(";");
          const i = pair.indexOf("=");
          if (i <= 0) continue;
          const k = pair.slice(0, i).trim();
          const v = pair.slice(i + 1).trim();
          if (v === "" || /expires=Thu, 01 Jan 1970/i.test(line)) m.delete(k);
          else m.set(k, v);
        }
      },
    };
  }

  type J = ReturnType<typeof jar>;

  async function call(j: J, p: string, opts: { method?: string; json?: unknown; bearer?: string } = {}) {
    const headers: Record<string, string> = {};
    const c = j.header();
    if (c) headers.Cookie = c;
    const method = opts.method || "GET";
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const csrf = j.cookies().csrf_token;
      if (csrf) headers["x-csrf-token"] = csrf;
    }
    if (opts.bearer) headers.Authorization = `Bearer ${opts.bearer}`;
    if (opts.json !== undefined) {
      headers["Content-Type"] = "application/json";
      opts = { ...opts, body: JSON.stringify(opts.json) } as any;
    }
    const res = await fetch(base + p, { ...(opts as any), method, headers, redirect: "manual", signal: AbortSignal.timeout(30000) });
    j.absorb(res);
    const text = await res.text();
    let body: any;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body };
  }

  async function loginAs(j: J, username: string, password: string, branchId?: number) {
    const r = await call(j, "/api/auth/login", { method: "POST", json: { username, password } });
    if (r.status !== 200) return r;
    if (!r.body.requiresBranch) return r;
    const target = branchId ?? r.body.branches?.[0]?.id;
    return call(j, "/api/auth/select-branch", { method: "POST", json: { branchId: target }, bearer: r.body.branchSelectToken });
  }

  async function openOrder(e: string, seconds = 4): Promise<boolean> {
    const d = await db();
    try {
      const deadline = Date.now() + seconds * 1000;
      while (Date.now() < deadline) {
        const r = await d.q1("SELECT COUNT(*) AS c FROM email_logs WHERE to_email = $1", [e]);
        if (Number(r.c) > 0) return true;
        await sleep(150);
      }
      return false;
    } finally {
      await d.end();
    }
  }

  let branchId = 0;

  before(async () => {
    const port = 20000 + Math.floor(Math.random() * 20000);
    base = `http://127.0.0.1:${port}`;

    child = spawn(process.execPath, [tsxCli, "server/index.ts"], {
      cwd: repoRoot,
      env: {
        ...(process.env as any),
        PORT: String(port),
        NODE_ENV: "test",
        DATABASE_URL: process.env.DATABASE_URL || "",
        JWT_SECRET: process.env.JWT_SECRET || "qa-order-test-jwt-secret-8f2c9d1a4b6e",
        AUTH_RATE_MAX: "1000",
        ADMIN_USERNAME,
        ADMIN_EMAIL: `${ADMIN_USERNAME}@qa.local`,
        ADMIN_PASSWORD,
        TECH_USERNAME: `qa-order-tech-${runId}`,
        TECH_EMAIL: `qa-order-tech-${runId}@qa.local`,
        TECH_PASSWORD: "qa-Order-Tech-2026!",
      } as any,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (d) => { const s = String(d).trim(); if (s) childLog.push(s.slice(0, 400)); });
    child.stderr?.on("data", (d) => { const s = String(d).trim(); if (s) childLog.push(s.slice(0, 400)); });
    child.on("exit", (code) => childLog.push(`[child exit: ${code}]`));

    const ready = await waitForHealth(`${base}/api/health`);
    assert.ok(ready, `server never became healthy.\nRecent child output:\n${childLog.slice(-40).join("\n")}`);

    branchId = await ensureBranch();
  });

  after(async () => {
    if (child) { child.kill(); child = null; }
    try {
      const d = await db({ multiple: true });
      try {
        if (fixtureOrderIds.length) {
          await d.q("DELETE FROM orders WHERE id = ANY($1::int[])", [fixtureOrderIds]);
        }
        if (fixtureCustomerIds.length) {
          await d.q("DELETE FROM customers WHERE id = ANY($1::int[])", [fixtureCustomerIds]);
        }
        if (fixtureProductIds.length) {
          for (const pid of fixtureProductIds) {
            await d.q("DELETE FROM stock_levels WHERE product_id = $1", [pid]);
            await d.q("DELETE FROM products WHERE id = $1", [pid]);
          }
        }
        if (fixtureBranchIds.length) {
          await d.q("DELETE FROM branches WHERE id = ANY($1::int[])", [fixtureBranchIds]);
        }
        await d.q("DELETE FROM users WHERE username = $1", [MANAGER_USERNAME]);
      } finally {
        await d.end();
      }
    } catch (e) {
      console.error(`[order-lifecycle] could not clean up fixtures: ${(e as Error).message}`);
    }
  });

  it("completes a POS cash sale as confirmed->paid, stamps paid_at, emails the invoice", async () => {
    const owner = jar();
    await call(owner, "/api/csrf-token");
    const login = await loginAs(owner, ADMIN_USERNAME, ADMIN_PASSWORD, branchId);
    assert.equal(login.status, 200, JSON.stringify(login.body));
    const session = await call(owner, "/api/auth/session");
    const activeBranch = session.body.activeBranchId;
    assert.ok(activeBranch != null, "session must have a branch");

    // A stockable product that also reviews as active for the branch lookup.
    const prod = await call(owner, "/api/products", { method: "POST", json: { name: `qa-order-product-${runId}`, price: 1000, inStock: true, isNonStock: false } });
    assert.equal(prod.status, 201, `product create failed: ${JSON.stringify(prod.body)}`);
    const productId = String(prod.body.id);
    fixtureProductIds.push(productId);
    // The availability pre-check reads the BRANCH stock_levels row when the
    // till is branch-scoped; give each branch its own pool so the sale's checks
    // and upserts find stock.
    const d = await db();
    try {
      await d.q(`INSERT INTO stock_levels (product_id, branch_id, quantity_in_stock, quantity_reserved, quantity_sold, low_stock_threshold)
        VALUES ($1, $2, 10, 0, 0, 5)
        ON CONFLICT (product_id, branch_id) WHERE branch_id IS NOT NULL DO UPDATE SET quantity_in_stock = 10, updated_at = NOW()::text`, [productId, activeBranch]);
      await d.q("UPDATE products SET stock_on_hand = 10 WHERE id = $1", [productId]);
      const c = await d.q1("INSERT INTO customers (name, email, password_hash, phone) VALUES ($1, $2, '', '0') RETURNING id", [`qa-order-cust-${runId}`, CUSTOMER_EMAIL]);
      fixtureCustomerIds.push(Number(c.id));
    } finally {
      await d.end();
    }
    assert.equal(fixtureCustomerIds.length, 1, "customer fixture was created");

    const checkout = await call(owner, "/api/pos/checkout", {
      method: "POST",
      json: { branchId: activeBranch, customerId: fixtureCustomerIds[0], customerName: "QA Customer", paymentMethod: "cash", tenderedAmount: 5000, items: [{ productId, quantity: 1 }] },
    });
    assert.equal(checkout.status, 201, `checkout failed: ${JSON.stringify(checkout.body)}`);
    const orderId = Number(checkout.body.order.id);
    fixtureOrderIds.push(orderId);
    assert.equal(checkout.body.order.status, "paid", "a till-paid POS sale must land in 'paid' (after confirmed)");

    const dd = await db();
    let paidAt: string | null = null;
    let customerEmail = "";
    try {
      const row = await dd.q1("SELECT paid_at, customer_email FROM orders WHERE id = $1", [orderId]);
      paidAt = row.paid_at;
      customerEmail = row.customer_email;
    } finally {
      await dd.end();
    }
    assert.ok(paidAt, "orders.paid_at must be stamped on a paid sale");
    assert.equal(customerEmail, CUSTOMER_EMAIL, "the till customer's email must be copied onto the order");

    assert.ok(await openOrder(CUSTOMER_EMAIL), "the paid invoice email must have been logged");
    const ed = await db();
    let invoiceType = "";
    try {
      const row = await ed.q1("SELECT type FROM email_logs WHERE to_email = $1 ORDER BY created_at DESC, id DESC LIMIT 1", [CUSTOMER_EMAIL]);
      invoiceType = row?.type || "";
    } finally {
      await ed.end();
    }
    assert.equal(invoiceType, "order_invoice", "the paid-trigger email type must be order_invoice");
  });

  it("blocks advancing an UNPAID confirmed order to delivered for a manager, allows the owner", async () => {
    const owner = jar();
    await call(owner, "/api/csrf-token");
    assert.equal((await loginAs(owner, ADMIN_USERNAME, ADMIN_PASSWORD, branchId)).status, 200);

    // A storefront-style pending order with a customer email but no payment.
    const pendingProd = await call(owner, "/api/products", { method: "POST", json: { name: `qa-order-pending-prod-${runId}`, price: 2500, inStock: true, isNonStock: false } });
    assert.equal(pendingProd.status, 201, JSON.stringify(pendingProd.body));
    const pendingProductId = String(pendingProd.body.id);
    fixtureProductIds.push(pendingProductId);
    const d = await db();
    let orderId = 0;
    try {
      const c = await d.q1("INSERT INTO customers (name, email, password_hash, phone) VALUES ($1, $2, '', '0') RETURNING id", [`qa-order-pending-${runId}`, `${runId}-pending@order-lifecycle.qa`]);
      fixtureCustomerIds.push(Number(c.id));
      const o = await d.q1(
        "INSERT INTO orders (customer_id, customer_name, customer_email, status, subtotal, source, shipping_name) VALUES ($1, $2, $3, 'pending', 2500, 'storefront', $2) RETURNING id",
        [Number(c.id), `QA Pending ${runId}`, `${runId}-pending@order-lifecycle.qa`]
      );
      orderId = Number(o.id);
      fixtureOrderIds.push(orderId);
      await d.q("INSERT INTO order_items (order_id, product_id, name, price, quantity, line_total) VALUES ($1, $2, 'Pending item', 2500, 1, 2500)", [orderId, pendingProductId]);
    } finally {
      await d.end();
    }

    // Confirm it (pending -> confirmed is always allowed: confirmation is the event).
    const confirmed = await call(owner, "/api/admin/orders/" + orderId + "/status", { method: "PATCH", json: { status: "confirmed" } });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));

    const dd = await db();
    let unpaid = true;
    try {
      const row = await dd.q1("SELECT paid_at, status FROM orders WHERE id = $1", [orderId]);
      unpaid = !row.paid_at;
    } finally {
      await dd.end();
    }
    assert.equal(unpaid, true, "fixture order must not have been paid");

    // Manager tries to deliver: 403 — no recorded payment and managers do not
    // hold order:without_payment.
    const manager = jar();
    await call(manager, "/api/csrf-token");
    const created = await call(owner, "/api/staff", { method: "POST", json: { username: MANAGER_USERNAME, email: `${MANAGER_USERNAME}@qa.local`, password: MANAGER_PASSWORD, role: "manager" } });
    assert.equal(created.status, 201, `manager create failed: ${JSON.stringify(created.body)}`);
    const mgrLogin = await loginAs(manager, MANAGER_USERNAME, MANAGER_PASSWORD, branchId);
    assert.equal(mgrLogin.status, 200, JSON.stringify(mgrLogin.body));

    const blocked = await call(manager, "/api/admin/orders/" + orderId + "/status", { method: "PATCH", json: { status: "delivered" } });
    assert.equal(blocked.status, 403, `unpaid confirmed order must not be deliverable without the right: ${JSON.stringify(blocked.body)}`);
    assert.match(String(blocked.body.error || ""), /paid|recorded payment|Advance without payment/i);

    const ed = await db();
    let still = "";
    try {
      const row = await ed.q1("SELECT status FROM orders WHERE id = $1", [orderId]);
      still = row.status;
    } finally {
      await ed.end();
    }
    assert.equal(still, "confirmed", "a blocked transition must not change the order");

    // The owner (order:without_payment by default) may overrule.
    const delivered = await call(owner, "/api/admin/orders/" + orderId + "/status", { method: "PATCH", json: { status: "delivered" } });
    assert.equal(delivered.status, 200, `owner override must succeed: ${JSON.stringify(delivered.body)}`);

    const expectedEmail = `${runId}-pending@order-lifecycle.qa`;
    assert.ok(await openOrder(expectedEmail), "the delivered invoice email must have been logged");
    const ed2 = await db();
    let dType = "";
    try {
      const row = await ed2.q1("SELECT type FROM email_logs WHERE to_email = $1 ORDER BY created_at DESC, id DESC LIMIT 1", [expectedEmail]);
      dType = row?.type || "";
    } finally {
      await ed2.end();
    }
    assert.equal(dType, "order_status", "the delivered trigger reuses the status email type with the PDF attached");
  });

  it("lets a manager advance a PAID order to delivered", async () => {
    const owner = jar();
    await call(owner, "/api/csrf-token");
    assert.equal((await loginAs(owner, ADMIN_USERNAME, ADMIN_PASSWORD, branchId)).status, 200);

    // Another cash POS sale so the order is genuinely paid.
    const prod = await call(owner, "/api/products", { method: "POST", json: { name: `qa-order-paid-product-${runId}`, price: 400, inStock: true, isNonStock: false } });
    assert.equal(prod.status, 201, JSON.stringify(prod.body));
    const productId = String(prod.body.id);
    fixtureProductIds.push(productId);
    const d = await db();
    try {
      const sess = await call(owner, "/api/auth/session");
      const activeBranch = sess.body.activeBranchId;
      await d.q(`INSERT INTO stock_levels (product_id, branch_id, quantity_in_stock, quantity_reserved, quantity_sold, low_stock_threshold)
        VALUES ($1, $2, 10, 0, 0, 5)
        ON CONFLICT (product_id, branch_id) WHERE branch_id IS NOT NULL DO UPDATE SET quantity_in_stock = 10, updated_at = NOW()::text`, [productId, activeBranch]);
      await d.q("UPDATE products SET stock_on_hand = 10 WHERE id = $1", [productId]);
      const c = await d.q1("INSERT INTO customers (name, email, password_hash, phone) VALUES ($1, $2, '', '0') RETURNING id", [`qa-order-paid-cust-${runId}`, `${runId}-paid@order-lifecycle.qa`]);
      fixtureCustomerIds.push(Number(c.id));
      const checkout = await call(owner, "/api/pos/checkout", {
        method: "POST",
        json: { branchId: activeBranch, customerId: Number(c.id), customerName: "QA Paid", paymentMethod: "cash", tenderedAmount: 1000, items: [{ productId, quantity: 1 }] },
      });
      assert.equal(checkout.status, 201, JSON.stringify(checkout.body));
      const orderId = Number(checkout.body.order.id);
      fixtureOrderIds.push(orderId);
      assert.equal(checkout.body.order.status, "paid", "cash sales must be paid before advancement is allowed");

      const manager = jar();
      await call(manager, "/api/csrf-token");
      const mgrLogin = await loginAs(manager, MANAGER_USERNAME, MANAGER_PASSWORD, branchId);
      assert.equal(mgrLogin.status, 200, JSON.stringify(mgrLogin.body));

      const delivered = await call(manager, "/api/admin/orders/" + orderId + "/status", { method: "PATCH", json: { status: "delivered" } });
      assert.equal(delivered.status, 200, `a paid order must be deliverable by a manager: ${JSON.stringify(delivered.body)}`);
    } finally {
      await d.end();
    }
  });
});