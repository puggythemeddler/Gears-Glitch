import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDateRange,
  allTimeRange,
  lastNDays,
  previousPeriod,
  shiftDays,
  toCsv,
  pctChange,
} from "../server/reporting";

test("parseDateRange accepts valid ISO days and rejects bad input", () => {
  assert.deepEqual(parseDateRange("2026-01-01", "2026-01-31"), { from: "2026-01-01", to: "2026-01-31" });
  assert.equal(parseDateRange("2026-01-31", "2026-01-01"), null, "from after to must be rejected");
  assert.equal(parseDateRange("1/1/2026", "2026-01-31"), null);
  assert.equal(parseDateRange("2026-01-01", "not-a-date"), null);
  assert.equal(parseDateRange(undefined, undefined), null);
  assert.equal(parseDateRange("2026-02-30", "2026-03-01"), null, "nonexistent day must be rejected");
});

test("allTimeRange and lastNDays produce inclusive whole-day spans", () => {
  assert.deepEqual(allTimeRange(), { from: "1970-01-01", to: "2099-12-31" });
  const now = new Date("2026-03-15T10:30:00.000Z");
  assert.deepEqual(lastNDays(7, now), { from: "2026-03-09", to: "2026-03-15" });
  assert.deepEqual(lastNDays(1, now), { from: "2026-03-15", to: "2026-03-15" });
});

test("previousPeriod returns the same-length period immediately before", () => {
  assert.deepEqual(previousPeriod({ from: "2026-02-01", to: "2026-02-14" }), {
    from: "2026-01-18",
    to: "2026-01-31",
  });
  // single-day period
  assert.deepEqual(previousPeriod({ from: "2026-03-10", to: "2026-03-10" }), {
    from: "2026-03-09",
    to: "2026-03-09",
  });
  // month-length always keeps the same number of days (29 for Feb 2020 leap)
  assert.deepEqual(previousPeriod({ from: "2020-02-01", to: "2020-02-29" }), {
    from: "2020-01-03",
    to: "2020-01-31",
  });
  // cross-year boundary
  assert.deepEqual(previousPeriod({ from: "2026-01-01", to: "2026-01-10" }), {
    from: "2025-12-22",
    to: "2025-12-31",
  });
});

test("shiftDays moves a range forward/backward by whole days", () => {
  assert.deepEqual(shiftDays({ from: "2026-02-01", to: "2026-02-14" }, -14), {
    from: "2026-01-18",
    to: "2026-01-31",
  });
  assert.deepEqual(shiftDays({ from: "2026-02-01", to: "2026-02-14" }, 14), {
    from: "2026-02-15",
    to: "2026-02-28",
  });
});

test("pctChange guards against a zero base", () => {
  assert.equal(pctChange(120, 100), 20);
  assert.equal(pctChange(90, 100), -10);
  assert.equal(pctChange(50, 0), null);
});

test("toCsv quotes cells, escapes quotes, and stops formula injection", () => {
  const rows = [
    { name: 'A, "quoted"', amount: "=SUM(A1:A9)" },
    { name: "-2+3", amount: 1234.5 },
    { name: "safe", amount: null },
  ];
  const csv = toCsv(rows, [
    { key: "name", label: "Product name" },
    { key: "amount", label: "Amount" },
  ]);
  const lines = csv.split("\n");
  assert.equal(lines[0], '"Product name","Amount"');
  assert.equal(lines[1], '"A, ""quoted""","\u0027=SUM(A1:A9)"'); // leading apostrophe neutralizes the formula
  assert.equal(lines[2], '"\u0027-2+3","1234.5"');
  assert.equal(lines[3], '"safe",""');
});

test("toCsv derives columns from the first row when omitted", () => {
  const csv = toCsv([{ a: 1, b: "x" }]);
  assert.equal(csv, '"a","b"\n"1","x"');
});

test("toCsv special-cases values starting with tab and @", () => {
  const csv = toCsv([{ v: "\tDDE26C99BC3C", x: "@import" }]);
  assert.ok(csv.includes("'\tDDE26C99BC3C\""));
  assert.ok(csv.includes('"\'@import"'));
});