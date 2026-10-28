import { test } from "node:test";
import assert from "node:assert/strict";
import { reportDateRange, reportToday, reportYearStart } from "../frontend/lib/reporting-date";

test("report dates use the Nairobi calendar day", () => {
  const now = new Date("2026-10-27T21:30:00.000Z");
  assert.equal(reportToday(now), "2026-10-28");
  assert.equal(reportYearStart(now), "2026-01-01");
});

test("common report presets use inclusive date bounds", () => {
  const now = new Date("2026-10-27T21:30:00.000Z");
  assert.deepEqual(reportDateRange("today", now), { from: "2026-10-28", to: "2026-10-28" });
  assert.deepEqual(reportDateRange("7d", now), { from: "2026-10-22", to: "2026-10-28" });
  assert.deepEqual(reportDateRange("14d", now), { from: "2026-10-15", to: "2026-10-28" });
  assert.deepEqual(reportDateRange("30d", now), { from: "2026-09-29", to: "2026-10-28" });
  assert.deepEqual(reportDateRange("month", now), { from: "2026-10-01", to: "2026-10-28" });
  assert.deepEqual(reportDateRange("ytd", now), { from: "2026-01-01", to: "2026-10-28" });
  assert.deepEqual(reportDateRange("all", now), { from: "1970-01-01", to: "2026-10-28" });
});
