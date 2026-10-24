import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateInvoicePeriod } from "../server/invoice-period";

describe("subscription invoice periods", () => {
  it("starts the next monthly billing period on the payment date and spans 30 days", () => {
    assert.deepEqual(calculateInvoicePeriod("2026-10-31", "monthly"), {
      periodStart: "2026-10-31",
      periodEnd: "2026-11-30",
    });
  });

  it("spans 365 days for an annual subscription", () => {
    assert.deepEqual(calculateInvoicePeriod("2026-10-31", "annual"), {
      periodStart: "2026-10-31",
      periodEnd: "2027-10-31",
    });
  });

  it("rejects malformed calendar dates", () => {
    assert.throws(() => calculateInvoicePeriod("2026-02-30", "monthly"), /valid ISO date/);
  });
});
