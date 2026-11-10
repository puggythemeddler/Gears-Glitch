import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifySoftwareLicenseExpiry } from "../server/customer-notifications";
import { totalSoftwareLicensePrice } from "../server/repairs";

describe("software license renewal tracking", () => {
  it("classifies the exact 30-day boundary, expiry day, and expired dates", () => {
    assert.deepEqual(classifySoftwareLicenseExpiry("2026-12-10", "2026-11-10"), { status: "due", daysLeft: 30 });
    assert.deepEqual(classifySoftwareLicenseExpiry("2026-11-10", "2026-11-10"), { status: "due", daysLeft: 0 });
    assert.deepEqual(classifySoftwareLicenseExpiry("2026-11-09", "2026-11-10"), { status: "expired", daysLeft: -1 });
    assert.deepEqual(classifySoftwareLicenseExpiry("2026-12-11", "2026-11-10"), { status: "not_due", daysLeft: 31 });
  });

  it("fails closed for missing or impossible dates", () => {
    assert.deepEqual(classifySoftwareLicenseExpiry(null, "2026-11-10"), { status: "unknown", daysLeft: null });
    assert.deepEqual(classifySoftwareLicenseExpiry("2026-02-30", "2026-11-10"), { status: "unknown", daysLeft: null });
    assert.deepEqual(classifySoftwareLicenseExpiry("2026-12-01", "bad-date"), { status: "unknown", daysLeft: null });
  });

  it("adds multiple catalog license prices to cents and ignores invalid values", () => {
    assert.equal(totalSoftwareLicensePrice([{ price: 12.34 }, { price: 0.1 }, { price: -3 }, { price: "invalid" }]), 12.44);
    assert.equal(totalSoftwareLicensePrice([]), 0);
  });
});
