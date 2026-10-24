import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isRenewalDateInWindow, processRenewalInvoiceCandidate, renewalGenerationKey } from "../server/recurring-invoices";

const now = new Date("2026-10-24T18:30:00.000Z");

describe("recurring renewal invoices", () => {
  it("accepts only valid due dates from today through seven days ahead", () => {
    assert.equal(isRenewalDateInWindow("2026-10-24", now), true);
    assert.equal(isRenewalDateInWindow("2026-10-31", now), true);
    assert.equal(isRenewalDateInWindow("2026-11-01", now), false);
    assert.equal(isRenewalDateInWindow("2026-10-23", now), false);
    assert.equal(isRenewalDateInWindow("2026-02-30", now), false);
  });

  it("does not generate another invoice while a pending or overdue invoice exists", async () => {
    let generationCalls = 0;
    const result = await processRenewalInvoiceCandidate({
      id: 41, plan: "growth", nextPaymentDate: "2026-10-31", periodType: "monthly", monthlyPrice: 4999, annualPrice: 47990,
    }, {
      listInvoices: async () => [{ id: 22, invoiceNumber: "SUB-INV-00022", status: "overdue" }],
      generateInvoice: async () => { generationCalls++; return { id: 23, created: true }; },
    }, now);

    assert.equal(result.status, "open_invoice");
    assert.equal(generationCalls, 0);
  });

  it("sends a stable period key and only one generated invoice under concurrent retries", async () => {
    const candidate = { id: 41, plan: "growth", nextPaymentDate: "2026-10-31", periodType: "annual" as const, monthlyPrice: 4999, annualPrice: 47990 };
    const stored = new Map<string, { id: number; invoiceNumber: string; created: boolean }>();
    const payloads: any[] = [];
    let emailCount = 0;
    const dependencies = {
      listInvoices: async () => [], // Both workers observed the same pre-create state.
      generateInvoice: async (payload: any) => {
        payloads.push(payload);
        const prior = stored.get(payload.generationKey);
        if (prior) return { ...prior, created: false };
        const created = { id: 88, invoiceNumber: "SUB-INV-00088", created: true };
        stored.set(payload.generationKey, created);
        emailCount++;
        return created;
      },
    };

    const results = await Promise.all([
      processRenewalInvoiceCandidate(candidate, dependencies, now),
      processRenewalInvoiceCandidate(candidate, dependencies, now),
    ]);

    assert.equal(renewalGenerationKey(41, "2026-10-31"), "cp-renewal-client-41-due-2026-10-31");
    assert.deepEqual(new Set(results.map(result => result.status)), new Set(["generated", "existing"]));
    assert.equal(emailCount, 1);
    assert.equal(payloads[0].periodType, "annual");
    assert.equal(payloads[0].periodStart, "2026-10-31");
    assert.equal(payloads[0].dueDate, "2026-10-31");
    assert.equal(payloads[0].generationKey, payloads[1].generationKey);
  });

  it("does not create a zero-value invoice for a free plan", async () => {
    let generationCalls = 0;
    const result = await processRenewalInvoiceCandidate({
      id: 52, plan: "starter", nextPaymentDate: "2026-10-31", periodType: "monthly", monthlyPrice: 0, annualPrice: 0,
    }, {
      listInvoices: async () => [],
      generateInvoice: async () => { generationCalls++; return { id: 1, created: true }; },
    }, now);

    assert.equal(result.status, "not_billable");
    assert.equal(generationCalls, 0);
  });
});
