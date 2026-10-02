import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { getPool, query, queryOne, runSchema } from "../server/db-helpers";
import { saveFinancingConfig } from "../server/financing/config";
import {
  createApplication,
  submitApplication,
  approveApplication,
  getAgreement,
  recordPayment,
  reversePayment,
  recordAdjustment,
  getFinancingReport,
  getPaymentById,
} from "../server/financing/service";

const HAS_DB = !!process.env.DATABASE_URL;

// DB-backed integration coverage for the Lipa Mdogo Mdogo service: intake ->
// approval -> schedule generation, oldest-due-first allocation, waivers,
// reversals and the reporting aggregate. Gated like the other *.integration
// tests — CI provides Postgres via DATABASE_URL; locally these skip.
describe("financing service integration (DB)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  const actor = { id: null, name: "Test Admin", type: "staff" } as any;
  let customerId = 0;

  const seedCustomer = async () => {
    await query(`INSERT INTO branches (id, name, address) VALUES (9001, 'Financing Test Branch', 'x') ON CONFLICT (id) DO NOTHING`);
    await query(`INSERT INTO customers (name, email, password_hash) VALUES ('Financing Test', 'financing-test@example.com', 'x') ON CONFLICT (email) DO NOTHING`);
    const c = await queryOne("SELECT id FROM customers WHERE email = 'financing-test@example.com'") as any;
    customerId = c.id;
  };

  before(() => {
    getPool();
    return Promise.resolve();
  });

  before(async () => {
    const schema = fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8");
    await runSchema(schema);
    // A deterministic, zero-charge configuration so schedule arithmetic is
    // exact and independent of whatever was stored in a shared test database.
    await saveFinancingConfig({
      enabled: true,
      chargeModel: "fixed",
      chargeFixedCents: 0,
      permittedFrequencies: ["weekly", "monthly"],
      minTerm: 1,
      maxTerm: 52,
      allowedPaymentMethods: ["mpesa", "cash"],
      manualApproval: true,
      possessionModel: "immediate",
    });
  });

  beforeEach(async () => {
    await query(
      `TRUNCATE financing_agreements, financing_applications, financing_schedules, financing_payments, financing_payment_allocations, financing_adjustments, financing_agreement_items RESTART IDENTITY CASCADE`
    );
    await seedCustomer();
  });

  async function makeAgreement(opts: {
    cashPriceCents?: number;
    depositCents?: number;
    termCount?: number;
    startDate?: string;
    frequency?: string;
  } = {}) {
    const app = await createApplication(
      {
        customerId,
        productName: "Test Item",
        cashPriceCents: opts.cashPriceCents ?? 10000,
        depositCents: opts.depositCents ?? 0,
        frequency: opts.frequency ?? "weekly",
        termCount: opts.termCount ?? 3,
        startDate: opts.startDate ?? "2020-01-01",
        consent: true,
        branchId: 9001,
        status: "draft",
      } as any,
      actor
    );
    await submitApplication(app.id, actor);
    return await approveApplication(app.id, actor);
  }

  it("creates an active agreement whose schedule sums to the financed balance", async () => {
    const agr = await makeAgreement({ cashPriceCents: 10000, termCount: 3 });
    assert.equal(agr.status, "active");
    assert.equal(agr.financedBalanceCents, 10000);
    assert.equal(agr.outstandingCents, 10000);
    assert.equal(agr.schedules.length, 3);

    const sum = agr.schedules.reduce((a: number, s: any) => a + s.amountCents, 0);
    assert.equal(sum, agr.financedBalanceCents);
    // 10000 / 3 with the remainder absorbed by the final instalment.
    assert.equal(agr.schedules[0].amountCents, 3333);
    assert.equal(agr.schedules[1].amountCents, 3333);
    assert.equal(agr.schedules[2].amountCents, 3334);
    assert.equal(agr.finalInstalmentCents, 3334);
  });

  it("allocates a payment oldest-due-first and leaves a partial instalment", async () => {
    const agr = await makeAgreement({ cashPriceCents: 10000, termCount: 3 });
    const updated = await recordPayment(agr.id, { amountCents: 4000, method: "cash" }, actor);

    assert.equal(updated.totalPaidCents, 4000);
    assert.equal(updated.outstandingCents, 6000);

    const s = updated.schedules;
    assert.equal(s[0].amountPaidCents, 3333);
    assert.equal(s[0].status, "paid");
    assert.equal(s[1].amountPaidCents, 667);
    assert.equal(s[1].status, "partially_paid");
    assert.equal(s[2].amountPaidCents, 0);
    assert.equal(s[2].status, "pending");
  });

  it("completes an agreement on full payment and reopens it when the payment is reversed", async () => {
    const agr = await makeAgreement({ cashPriceCents: 10000, termCount: 2 });
    const done = await recordPayment(agr.id, { amountCents: 10000, method: "cash" }, actor);
    assert.equal(done.status, "completed");
    assert.equal(done.outstandingCents, 0);
    assert.equal(done.ownershipStatus, "transferred");

    const payment = done.payments.find((p: any) => p.status === "succeeded");
    assert.ok(payment, "expected a succeeded payment");
    assert.equal((await getPaymentById(payment.id)).agreementId, agr.id);

    const reversed = await reversePayment(payment.id, "test reversal", actor);
    assert.equal(reversed.status, "active");
    assert.equal(reversed.outstandingCents, 10000);
    assert.equal(reversed.ownershipStatus, "seller");
  });

  it("applies a waiver to the oldest instalment and reduces the outstanding balance", async () => {
    const agr = await makeAgreement({ cashPriceCents: 9000, termCount: 3 });
    const waived = await recordAdjustment(agr.id, "waiver", 3000, "goodwill", actor);

    assert.equal(waived.schedules[0].waivedCents, 3000);
    assert.equal(waived.schedules[0].status, "paid");
    assert.equal(waived.outstandingCents, 6000);
  });

  it("reports active agreements, aging and arrears", async () => {
    const agr = await makeAgreement({ cashPriceCents: 10000, termCount: 3, startDate: "2020-01-01" });
    await recordPayment(agr.id, { amountCents: 3333, method: "cash" }, actor);

    const report = await getFinancingReport({ from: "2000-01-01", to: "2099-12-31" });
    assert.equal(report.summary.agreements, 1);
    assert.equal(report.summary.active, 1);
    assert.equal(report.summary.overdueAgreements, 1);
    assert.ok(report.summary.overdueCents > 0);
    assert.equal(report.arrears.length, 1);
    assert.equal(report.arrears[0].agreementNumber, agr.agreementNumber);
    assert.equal(report.arrears[0].overdueCount, 2);
  });
});
