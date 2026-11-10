import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifySoftwareLicenseExpiry, dispatchSoftwareLicenseReminders } from "../server/customer-notifications";
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

  it("dispatches only due renewable licenses to the store, never to customers", async () => {
    const rows = [
      { order_item_id: 11, order_id: 31, product_name: "Suite <Pro>", license_expires_at: "2026-12-10", license_renewal_type: "renewable", cancelled: 0, order_status: "paid", customer_name: "Demo & Co" },
      { order_item_id: 12, order_id: 32, product_name: "Expired App", license_expires_at: "2026-11-09", license_renewal_type: "renewable", cancelled: 0, order_status: "paid", customer_name: "Demo" },
      { order_item_id: 13, order_id: 33, product_name: "Perpetual App", license_expires_at: "2026-11-01", license_renewal_type: "perpetual", cancelled: 0, order_status: "paid", customer_name: "Demo" },
      { order_item_id: 14, order_id: 34, product_name: "Cancelled App", license_expires_at: "2026-11-09", license_renewal_type: "renewable", cancelled: 1, order_status: "paid", customer_name: "Demo" },
      { order_item_id: 15, order_id: 35, product_name: "Pending App", license_expires_at: "2026-11-09", license_renewal_type: "renewable", cancelled: 0, order_status: "pending_payment", customer_name: "Demo" },
      { order_item_id: 16, order_id: 36, product_name: "Future App", license_expires_at: "2026-12-11", license_renewal_type: "renewable", cancelled: 0, order_status: "paid", customer_name: "Demo" },
      { order_item_id: 17, order_id: 37, product_name: "Invalid Date", license_expires_at: "2026-02-30", license_renewal_type: "renewable", cancelled: 0, order_status: "paid", customer_name: "Demo" },
    ];
    const dispatched: any[] = [];
    const deliver = async (notification: any) => { dispatched.push(notification); };

    const first = await dispatchSoftwareLicenseReminders(rows, "2026-11-10", deliver);
    assert.deepEqual(first, { reminders: 1, expired: 1, checked: 7 });
    assert.equal(dispatched.length, 2);
    assert.deepEqual(dispatched.map((n) => n.event), ["software_license.expiry_reminder", "software_license.expired"]);
    assert.ok(dispatched.every((n) => n.audience === "admin"));
    assert.ok(dispatched.every((n) => !n.recipientEmail && !n.recipientPhone));
    assert.match(dispatched[0].bodyHtml, /Suite &lt;Pro&gt;/);
    assert.match(dispatched[0].bodyHtml, /Demo &amp; Co/);

    const firstKeys = dispatched.map((n) => n.idempotencyKey);
    const secondRun: any[] = [];
    await dispatchSoftwareLicenseReminders(rows, "2026-11-10", async (n) => { secondRun.push(n); });
    assert.deepEqual(secondRun.map((n) => n.idempotencyKey), firstKeys, "retries retain stable keys for durable notification de-duplication");
  });
});
