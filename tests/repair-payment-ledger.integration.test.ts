import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { bootstrapTestDatabase } from "../server/test-db";
const HAS_DB = bootstrapTestDatabase();

import { closePool, getPool, query, queryOne, runSchema } from "../server/db-helpers";
import { listRepairPaymentLedger, recordRepairLedgerEntry, voidRepairLedgerEntry, RepairPaymentError } from "../server/repairs";
import { DEFAULT_ROLES } from "../server/permissions";

const TICKET = "REP-LEDGER-TEST-001";
const STAFF_ID = 900001;

describe("repair payment ledger input validation", () => {
  it("rejects invalid amounts before opening a database transaction", async () => {
    await assert.rejects(
      recordRepairLedgerEntry(TICKET, { kind: "payment", amount: "10.001", reference: "x", idempotencyKey: "x", staffId: STAFF_ID }),
      (error: unknown) => error instanceof RepairPaymentError && /no more than two decimal places/.test(error.message)
    );
    await assert.rejects(
      recordRepairLedgerEntry(TICKET, { kind: "payment", amount: 0, reference: "x", idempotencyKey: "x", staffId: STAFF_ID }),
      (error: unknown) => error instanceof RepairPaymentError && /greater than zero/.test(error.message)
    );
  });

  it("grants void authority only to owner/admin default roles", () => {
    assert.ok(DEFAULT_ROLES.admin.includes("repair:payment:void"));
    assert.ok(DEFAULT_ROLES.owner.includes("repair:payment:void"));
    for (const role of ["technician", "staff", "manager", "provider"]) {
      assert.ok(!DEFAULT_ROLES[role].includes("repair:payment:void"), `${role} must not get void authority by default`);
    }
  });

  it("protects the void API with the dedicated permission at the server boundary", () => {
    const routes = fs.readFileSync(path.join(__dirname, "..", "server", "index.ts"), "utf8");
    const route = routes.match(/app\.post\("\/api\/repairs\/:id\/payments\/:paymentId\/void"[^\n]+/);
    assert.ok(route, "the ticket ledger void endpoint exists");
    assert.match(route[0], /staffAuthMiddleware/);
    assert.match(route[0], /requirePermission\("repair:payment:void"\)/);
    assert.match(route[0], /requireShopFeature\("Repair ticketing"\)/);
  });
});

describe("repair payment ledger integration (DB)", { skip: !HAS_DB && "TEST_DATABASE_URL not set (disposable test DB only)" }, () => {
  let customerId = 0;

  before(async () => {
    getPool();
    await runSchema(fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8"));
    // Exercise the versioned deployment migration as well as schema.sql.
    await query(fs.readFileSync(path.join(__dirname, "..", "server", "migrations", "0038_repair_payment_ledger.sql"), "utf8"));
    await query(
      `INSERT INTO customers (name, email, password_hash)
       VALUES ('Repair Ledger Test', 'repair-ledger-test@example.invalid', 'test')
       ON CONFLICT (email) DO NOTHING`
    );
    customerId = Number((await queryOne("SELECT id FROM customers WHERE email = 'repair-ledger-test@example.invalid'"))?.id);
  });

  beforeEach(async () => {
    await query("DELETE FROM repair_payments WHERE ticket_id = $1", [TICKET]);
    await query("DELETE FROM repair_tickets WHERE id = $1", [TICKET]);
    await query(
      `INSERT INTO repair_tickets (id, customer_id, device_type, issue_description, status, eta_at, total_cost)
       VALUES ($1, $2, 'Laptop', 'Ledger integration test', 'received', NOW()::text, 1000)`,
      [TICKET, customerId]
    );
  });

  after(async () => {
    await query("DELETE FROM repair_payments WHERE ticket_id = $1", [TICKET]);
    await query("DELETE FROM repair_tickets WHERE id = $1", [TICKET]);
    await closePool();
  });

  const entry = (overrides: Record<string, unknown> = {}) => ({
    kind: "payment" as const,
    amount: "400.00",
    paymentMethod: "mpesa",
    reference: "LEDGER-RECEIPT-1",
    idempotencyKey: "ledger-request-1",
    staffId: STAFF_ID,
    ...overrides,
  });

  it("records partial receipts and safely replays the same idempotency key", async () => {
    const first = await recordRepairLedgerEntry(TICKET, entry());
    const replay = await recordRepairLedgerEntry(TICKET, entry());
    const ledger = await listRepairPaymentLedger(TICKET);

    assert.equal(Number(first.id), Number(replay.id));
    assert.equal(ledger.entries.length, 1);
    assert.equal(ledger.summary.estimate, 1000);
    assert.equal(ledger.summary.received, 400);
    assert.equal(ledger.summary.netReceived, 400);
    assert.equal(ledger.summary.balance, 600);

    const events = await queryOne("SELECT COUNT(*) AS count FROM repair_updates WHERE ticket_id = $1 AND update_type = 'payment_received'", [TICKET]);
    assert.equal(Number(events.count), 1, "a replay must not add a second history event");
  });

  it("rejects an amount above the remaining estimate", async () => {
    await recordRepairLedgerEntry(TICKET, entry());
    await assert.rejects(
      recordRepairLedgerEntry(TICKET, entry({ amount: "600.01", reference: "LEDGER-RECEIPT-2", idempotencyKey: "ledger-request-2" })),
      (error: unknown) => error instanceof RepairPaymentError && /exceeds the remaining repair estimate/.test(error.message)
    );
  });

  it("links refunds to a receipt and refuses cumulative over-refunds", async () => {
    const payment = await recordRepairLedgerEntry(TICKET, entry());
    await recordRepairLedgerEntry(TICKET, entry({ kind: "refund", amount: "125.50", reference: "LEDGER-REFUND-1", idempotencyKey: "ledger-refund-1", relatedPaymentId: payment.id, reason: "Customer returned device" }));
    await assert.rejects(
      recordRepairLedgerEntry(TICKET, entry({ kind: "refund", amount: "275", reference: "LEDGER-REFUND-2", idempotencyKey: "ledger-refund-2", relatedPaymentId: payment.id, reason: "Additional refund" })),
      (error: unknown) => error instanceof RepairPaymentError && /exceeds the remaining amount on this receipt/.test(error.message)
    );
    const ledger = await listRepairPaymentLedger(TICKET);
    assert.equal(ledger.entries.length, 2);
    assert.equal(ledger.summary.received, 400);
    assert.equal(ledger.summary.refunded, 125.5);
    assert.equal(ledger.summary.netReceived, 274.5);
    const event = await queryOne("SELECT message, customer_visible FROM repair_updates WHERE ticket_id = $1 AND update_type = 'payment_refunded'", [TICKET]);
    assert.match(event.message, /Customer returned device/);
    assert.equal(Number(event.customer_visible), 0, "financial ledger events stay internal");
  });

  it("rejects duplicate references and idempotency-key reuse with changed data", async () => {
    await recordRepairLedgerEntry(TICKET, entry());
    await assert.rejects(
      recordRepairLedgerEntry(TICKET, entry({ idempotencyKey: "ledger-request-duplicate-key" })),
      (error: unknown) => error instanceof RepairPaymentError && /reference has already been recorded/.test(error.message)
    );
    await assert.rejects(
      recordRepairLedgerEntry(TICKET, entry({ amount: "401", reference: "LEDGER-RECEIPT-1" })),
      (error: unknown) => error instanceof RepairPaymentError && /request key was already used/.test(error.message)
    );
  });

  it("rejects payments on cancelled or rejected tickets", async () => {
    await query("UPDATE repair_tickets SET status = 'cancelled' WHERE id = $1", [TICKET]);
    await assert.rejects(
      recordRepairLedgerEntry(TICKET, entry()),
      (error: unknown) => error instanceof RepairPaymentError && /cancelled or rejected repair/.test(error.message)
    );
  });

  it("voids an entry append-only, idempotently, and excludes it from active totals", async () => {
    const payment = await recordRepairLedgerEntry(TICKET, entry());
    const voidInput = { reason: "Wrong ticket selected", idempotencyKey: "ledger-void-1", staffId: STAFF_ID };
    await voidRepairLedgerEntry(TICKET, payment.id, voidInput);
    await voidRepairLedgerEntry(TICKET, payment.id, voidInput);

    const ledger = await listRepairPaymentLedger(TICKET);
    assert.equal(ledger.entries.length, 2, "voiding appends a row and keeps the receipt");
    assert.equal(ledger.entries.find((row: any) => row.id === Number(payment.id)).voided, true);
    assert.equal(ledger.entries.find((row: any) => row.kind === "void").reason, voidInput.reason);
    assert.equal(ledger.summary.received, 0);
    assert.equal(ledger.summary.netReceived, 0);
    assert.equal(ledger.summary.voidedEntries, 1);
    await assert.rejects(
      voidRepairLedgerEntry(TICKET, payment.id, { reason: "Trying second void", idempotencyKey: "ledger-void-duplicate", staffId: STAFF_ID }),
      (error: unknown) => error instanceof RepairPaymentError && /already been voided/.test(error.message)
    );
    await assert.rejects(
      recordRepairLedgerEntry(TICKET, entry({ kind: "refund", amount: "10", reference: "LEDGER-REFUND-VOIDED", idempotencyKey: "ledger-refund-voided", relatedPaymentId: payment.id, reason: "Should be blocked" })),
      (error: unknown) => error instanceof RepairPaymentError && /voided receipt/.test(error.message)
    );
    const events = await queryOne("SELECT COUNT(*) AS count FROM repair_updates WHERE ticket_id = $1 AND update_type = 'payment_voided'", [TICKET]);
    assert.equal(Number(events.count), 1, "void replay must not duplicate history");
  });

  it("requires a refund to be voided before its receipt can be voided", async () => {
    const payment = await recordRepairLedgerEntry(TICKET, entry());
    const refund = await recordRepairLedgerEntry(TICKET, entry({ kind: "refund", amount: "100", reference: "LEDGER-REFUND-3", idempotencyKey: "ledger-refund-3", relatedPaymentId: payment.id, reason: "Test refund" }));
    await assert.rejects(
      voidRepairLedgerEntry(TICKET, payment.id, { reason: "Correction", idempotencyKey: "ledger-void-receipt-first", staffId: STAFF_ID }),
      (error: unknown) => error instanceof RepairPaymentError && /Void the related refund first/.test(error.message)
    );
    await voidRepairLedgerEntry(TICKET, refund.id, { reason: "Refund entry was mistaken", idempotencyKey: "ledger-void-refund-first", staffId: STAFF_ID });
    await voidRepairLedgerEntry(TICKET, payment.id, { reason: "Receipt entry was mistaken", idempotencyKey: "ledger-void-payment-second", staffId: STAFF_ID });

    const ledger = await listRepairPaymentLedger(TICKET);
    assert.equal(ledger.summary.received, 0);
    assert.equal(ledger.summary.refunded, 0);
    assert.equal(ledger.summary.netReceived, 0);
    assert.equal(ledger.summary.voidedEntries, 2);
  });
});
