import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { bootstrapTestDatabase } from "../server/test-db";
const HAS_DB = bootstrapTestDatabase();

import { closePool, getPool, query, queryOne, runSchema } from "../server/db-helpers";
import {
  createRepairQuoteVersion,
  finishRepairQuoteVersion,
  loadCustomerRepairQuotePdf,
  respondToRepairQuote,
} from "../server/repairs";
import { buildRepairQuotePdf } from "../server/repair-quote-pdf";

const TICKET_ID = "REP-QUOTE-VERSION-TEST-001";
const CUSTOMER_EMAIL = "repair-quote-version-test@example.invalid";

describe("repair quote PDF rendering", () => {
  it("produces a non-empty PDF with the quote version and expiry terms", { skip: process.platform === "win32" && "Bundled @sparticuz/chromium is Linux-only; PDF rendering runs in Linux CI/hosting" }, async () => {
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const pdf = await buildRepairQuotePdf({
      id: TICKET_ID, customerName: "Test Customer", deviceType: "Laptop", deviceBrand: "Gear",
      deviceModel: "Model A", issueSummary: "Screen repair", laborCost: 1250, partsCost: 0,
      totalCost: 1250, parts: [],
    }, { storeName: "Test Store", currency: "KES", storeLogo: "", logoPosition: "top-left" }, { version: 3, expiresAt });
    assert.ok(pdf.length > 1000);
    assert.match(pdf.subarray(0, 5).toString("ascii"), /^%PDF-/);
  });
});

describe("repair quote versions (disposable test DB)", { skip: !HAS_DB && "TEST_DATABASE_URL not set or not a safe local test target" }, () => {
  let customerId = 0;

  before(async () => {
    getPool();
    await runSchema(fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8"));
    await query(fs.readFileSync(path.join(__dirname, "..", "server", "migrations", "0041_repair_quote_versions.sql"), "utf8"));
    await query(
      `INSERT INTO customers (name, email, password_hash)
       VALUES ('Repair Quote Version Test', $1, 'test') ON CONFLICT (email) DO NOTHING`,
      [CUSTOMER_EMAIL]
    );
    customerId = Number((await queryOne("SELECT id FROM customers WHERE email = $1", [CUSTOMER_EMAIL]))?.id);
    assert.ok(customerId > 0);
  });

  after(async () => {
    await query("DELETE FROM repair_tickets WHERE id = $1", [TICKET_ID]);
    if (customerId > 0) await query("DELETE FROM customers WHERE id = $1", [customerId]);
    await closePool();
  });

  it("retains each PDF and snapshot, restricts download to its customer, and expires responses", async () => {
    await query("DELETE FROM repair_tickets WHERE id = $1", [TICKET_ID]);
    await query(
      `INSERT INTO repair_tickets (id, customer_id, device_type, issue_description, status, eta_at, labor_cost, parts_cost, total_cost)
       VALUES ($1, $2, 'Laptop', 'Quote version test', 'received', NOW()::text, 1250, 0, 1250)`,
      [TICKET_ID, customerId]
    );

    const firstPdf = Buffer.from("%PDF-version-one-test");
    const first = await createRepairQuoteVersion({
      ticketId: TICKET_ID,
      expectedTotal: 1250,
      expectedVersion: 1,
      recipientEmail: CUSTOMER_EMAIL,
      snapshot: { reference: TICKET_ID, totalCost: 1250, parts: [] },
      pdf: firstPdf,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    assert.ok(first);
    assert.equal(first.version, 1);
    assert.equal(await finishRepairQuoteVersion(first.id, true), true);

    const saved = await loadCustomerRepairQuotePdf(TICKET_ID, customerId);
    assert.ok(saved);
    assert.equal(saved.version, 1);
    assert.deepEqual(saved.pdf, firstPdf);
    assert.equal(await loadCustomerRepairQuotePdf(TICKET_ID, customerId + 99999), null);
    assert.equal(await respondToRepairQuote(TICKET_ID, "accepted"), true);
    assert.equal(await respondToRepairQuote(TICKET_ID, "declined"), false, "a version cannot receive a second response");

    await query("UPDATE repair_quote_versions SET expires_at = NOW() - INTERVAL '1 second' WHERE id = $1", [first.id]);
    assert.equal(await loadCustomerRepairQuotePdf(TICKET_ID, customerId), null);

    const second = await createRepairQuoteVersion({
      ticketId: TICKET_ID,
      expectedTotal: 1250,
      expectedVersion: 2,
      recipientEmail: CUSTOMER_EMAIL,
      snapshot: { reference: TICKET_ID, totalCost: 1250, parts: [] },
      pdf: Buffer.from("%PDF-version-two-test"),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    assert.ok(second);
    assert.equal(second.version, 2);
    assert.equal(await finishRepairQuoteVersion(second.id, true), true);
    assert.equal(await respondToRepairQuote(TICKET_ID, "declined"), true);

    const records = await query("SELECT version, recipient_email, delivery_status, response, pdf_sha256 FROM repair_quote_versions WHERE ticket_id = $1 ORDER BY version", [TICKET_ID]);
    assert.deepEqual(records.rows.map((row: any) => [Number(row.version), row.recipient_email, row.delivery_status, row.response]), [
      [1, CUSTOMER_EMAIL, "expired", "accepted"],
      [2, CUSTOMER_EMAIL, "sent", "declined"],
    ]);
    assert.match(String(records.rows[0].pdf_sha256), /^[a-f0-9]{64}$/);
    assert.match(String(records.rows[1].pdf_sha256), /^[a-f0-9]{64}$/);
  });

  it("refuses a quote when the estimate changed after the staff view was loaded", async () => {
    await query("DELETE FROM repair_tickets WHERE id = $1", [TICKET_ID]);
    await query(
      `INSERT INTO repair_tickets (id, customer_id, device_type, issue_description, status, eta_at, total_cost)
       VALUES ($1, $2, 'Laptop', 'Stale quote test', 'received', NOW()::text, 1400)`,
      [TICKET_ID, customerId]
    );
    await query("UPDATE repair_tickets SET total_cost = 1450 WHERE id = $1", [TICKET_ID]);
    const stale = await createRepairQuoteVersion({
      ticketId: TICKET_ID,
      expectedTotal: 1400,
      expectedVersion: 1,
      recipientEmail: CUSTOMER_EMAIL,
      snapshot: { reference: TICKET_ID, totalCost: 1400, parts: [] },
      pdf: Buffer.from("%PDF-stale-test"),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    assert.equal(stale, null);
  });
});
