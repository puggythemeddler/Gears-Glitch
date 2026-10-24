import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidUsageExtensionDays,
  paidProformaRenewal,
  proformaFollowupSchedule,
  proformaSuspensionDueAt,
  PROFORMA_SUSPENSION_GRACE_DAYS,
  PROFORMA_WARNING_DAYS,
} from "../server/proforma-followups";

test("proforma reminder is scheduled seven days after creation", () => {
  const created = new Date("2026-10-01T12:30:00.000Z");
  const schedule = proformaFollowupSchedule(created);
  assert.ok(schedule);
  assert.equal(PROFORMA_WARNING_DAYS, 7);
  assert.equal(schedule.warningDueAt.toISOString(), "2026-10-08T12:30:00.000Z");
});

test("deactivation grace is three days after the reminder is sent", () => {
  const sent = new Date("2026-10-08T12:30:00.000Z");
  const due = proformaSuspensionDueAt(sent);
  assert.ok(due);
  assert.equal(PROFORMA_SUSPENSION_GRACE_DAYS, 3);
  assert.equal(due.toISOString(), "2026-10-11T12:30:00.000Z");
});

test("invalid timestamps do not create a follow-up schedule", () => {
  assert.equal(proformaFollowupSchedule("not-a-date"), null);
  assert.equal(proformaSuspensionDueAt("not-a-date"), null);
});

test("usage extensions accept only whole days from one through 365", () => {
  assert.equal(isValidUsageExtensionDays(1), true);
  assert.equal(isValidUsageExtensionDays(365), true);
  for (const value of [0, -1, 366, 1.5, "7", NaN, Infinity, null]) {
    assert.equal(isValidUsageExtensionDays(value), false);
  }
});

test("paid proforma reconciliation uses the invoice period when it extends access", () => {
  const renewal = paidProformaRenewal(
    "2026-10-01",
    "2026-10-31",
    "2026-10-10T00:00:00.000Z",
    new Date("2026-10-15T00:00:00.000Z"),
  );
  assert.equal(renewal.periodDays, 30);
  assert.equal(renewal.periodType, "monthly");
  assert.equal(renewal.nextPaymentDate, "2026-10-31");
});

test("paid proforma reconciliation never shortens a future expiry", () => {
  const renewal = paidProformaRenewal(
    "2026-10-01",
    "2026-10-31",
    "2026-12-01T00:00:00.000Z",
    new Date("2026-10-15T00:00:00.000Z"),
  );
  assert.equal(renewal.nextPaymentDate, "2026-12-31");
});

test("invalid or missing invoice periods use a 30-day monthly fallback", () => {
  const renewal = paidProformaRenewal(null, "bad-date", null, new Date("2026-10-15T00:00:00.000Z"));
  assert.equal(renewal.periodDays, 30);
  assert.equal(renewal.periodType, "monthly");
  assert.equal(renewal.nextPaymentDate, "2026-11-14");
});
