import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateFinancing,
  resolveDeposit,
  validateTerms,
  addPeriod,
} from "../server/financing/calculator";
import { FINANCING_DEFAULT_CONFIG, type FinancingConfig } from "../server/financing/types";
import {
  allocatePayment,
  applyAllocations,
  classifyOverdue,
  scheduleRemaining,
  type AllocatableSchedule,
} from "../server/financing/allocation";
import { addMonthsClamped, addDays, daysBetween } from "../server/financing/date-utils";

function baseConfig(over: Partial<FinancingConfig> = {}): FinancingConfig {
  return { ...FINANCING_DEFAULT_CONFIG, enabled: true, ...over };
}

describe("financing date utils", () => {
  it("clamps month-end additions from a stable anchor", () => {
    assert.equal(addMonthsClamped("2024-01-31", 1), "2024-02-29");
    assert.equal(addMonthsClamped("2023-01-31", 1), "2023-02-28");
    assert.equal(addMonthsClamped("2024-01-31", 2), "2024-03-31");
    assert.equal(addMonthsClamped("2024-01-31", 13), "2025-02-28");
  });

  it("adds days across boundaries", () => {
    assert.equal(addDays("2024-02-28", 1), "2024-02-29");
    assert.equal(addDays("2024-02-28", 2), "2024-03-01");
    assert.equal(daysBetween("2024-01-01", "2024-01-31"), 30);
  });

  it("addPeriod respects frequency", () => {
    assert.equal(addPeriod("2024-01-01", "weekly", 2), "2024-01-15");
    assert.equal(addPeriod("2024-01-01", "biweekly", 1), "2024-01-15");
    assert.equal(addPeriod("2024-01-01", "daily", 3), "2024-01-04");
    assert.equal(addPeriod("2024-01-31", "monthly", 1), "2024-02-29");
    assert.equal(addPeriod("2024-01-01", "custom", 2, 10), "2024-01-21");
  });
});

describe("resolveDeposit", () => {
  it("accepts a fixed deposit and rejects one above cash price", () => {
    assert.equal(resolveDeposit(100000, 20000), 20000);
    assert.throws(() => resolveDeposit(100000, 200000));
  });

  it("resolves a percentage deposit with rounding", () => {
    assert.equal(resolveDeposit(100001, null, 10), 10000);
    assert.equal(resolveDeposit(99999, null, 33), 33000);
  });

  it("rejects supplying both or an out-of-range percentage", () => {
    assert.throws(() => resolveDeposit(100000, 1, 10));
    assert.throws(() => resolveDeposit(100000, null, 101));
  });
});

describe("calculateFinancing", () => {
  it("computes fixed charge and pushes the remainder into the final instalment", () => {
    const q = calculateFinancing({
      cashPriceCents: 10000,
      depositCents: 0,
      chargeModel: "fixed",
      chargeFixedCents: 0,
      frequency: "weekly",
      termCount: 3,
      startDate: "2024-01-01",
    });
    assert.equal(q.financedBalanceCents, 10000);
    assert.equal(q.instalmentCents, 3333);
    assert.equal(q.finalInstalmentCents, 3334);
    assert.deepEqual(
      q.instalments.map((i) => i.amountCents),
      [3333, 3333, 3334]
    );
    assert.equal(
      q.instalments.reduce((s, i) => s + i.amountCents, 0),
      q.financedBalanceCents
    );
  });

  it("computes percentage charge on the financed amount and never loses cents", () => {
    const q = calculateFinancing({
      cashPriceCents: 500000,
      depositCents: 100000,
      chargeModel: "percentage",
      chargePercent: 20,
      frequency: "monthly",
      termCount: 6,
      startDate: "2024-03-15",
    });
    assert.equal(q.financingChargeCents, 80000); // 20% of 400000
    assert.equal(q.hpPriceCents, 580000);
    assert.equal(q.financedBalanceCents, 480000);
    assert.equal(q.totalPayableCents, 580000);
    assert.equal(
      q.instalments.reduce((s, i) => s + i.amountCents, 0),
      q.financedBalanceCents
    );
  });

  it("defaults the first due date to one period after start", () => {
    const q = calculateFinancing({
      cashPriceCents: 100000,
      depositCents: 0,
      chargeModel: "fixed",
      chargeFixedCents: 0,
      frequency: "weekly",
      termCount: 2,
      startDate: "2024-01-01",
    });
    assert.equal(q.instalments[0].dueDate, "2024-01-08");
    assert.equal(q.instalments[1].dueDate, "2024-01-15");
  });

  it("honours an explicit first due date and monthly anchor", () => {
    const q = calculateFinancing({
      cashPriceCents: 100000,
      depositCents: 0,
      chargeModel: "fixed",
      chargeFixedCents: 0,
      frequency: "monthly",
      termCount: 3,
      startDate: "2024-01-31",
      firstDueDate: "2024-01-31",
    });
    assert.deepEqual(
      q.instalments.map((i) => i.dueDate),
      ["2024-01-31", "2024-02-29", "2024-03-31"]
    );
  });

  it("rejects invalid inputs", () => {
    assert.throws(() => calculateFinancing({ cashPriceCents: 100, depositCents: 0, chargeModel: "fixed", frequency: "weekly", termCount: 0, startDate: "2024-01-01" }));
    assert.throws(() => calculateFinancing({ cashPriceCents: 100, depositCents: 200, chargeModel: "fixed", frequency: "weekly", termCount: 1, startDate: "2024-01-01" }));
    assert.throws(() => calculateFinancing({ cashPriceCents: 100.5, depositCents: 0, chargeModel: "fixed", frequency: "weekly", termCount: 1, startDate: "2024-01-01" }));
  });
});

describe("validateTerms", () => {
  const input = {
    cashPriceCents: 100000,
    depositCents: 20000,
    chargeModel: "fixed" as const,
    chargeFixedCents: 0,
    frequency: "weekly" as const,
    termCount: 4,
    startDate: "2024-01-01",
  };

  it("passes a plan inside the configured bounds", () => {
    assert.deepEqual(validateTerms(input, baseConfig()), []);
  });

  it("reports disabled, term, frequency and deposit violations", () => {
    const errs = validateTerms(input, baseConfig({ enabled: false, minTerm: 8, permittedFrequencies: ["monthly"], minDepositCents: 50000 }));
    const fields = errs.map((e) => e.field).sort();
    assert.deepEqual(fields, ["depositCents", "enabled", "frequency", "termCount"]);
  });

  it("enforces product value and deposit percentage caps", () => {
    const errs = validateTerms(input, baseConfig({ minProductValueCents: 200000, depositPercentMin: 50 }));
    assert.ok(errs.some((e) => e.field === "cashPriceCents"));
    assert.ok(errs.some((e) => e.field === "depositCents"));
  });

  it("requires an interval for custom frequency", () => {
    const errs = validateTerms({ ...input, frequency: "custom", intervalDays: 0 }, baseConfig({ permittedFrequencies: ["custom"] }));
    assert.ok(errs.some((e) => e.field === "intervalDays"));
  });
});

describe("allocatePayment", () => {
  function sched(id: number, seq: number, due: string, amount: number, paid: number, status: AllocatableSchedule["status"] = "pending"): AllocatableSchedule {
    return { id, sequence: seq, dueDate: due, amountCents: amount, amountPaidCents: paid, status };
  }

  it("applies oldest-due-first across instalments", () => {
    const schedules = [sched(1, 1, "2024-01-08", 1000, 0), sched(2, 2, "2024-01-15", 1000, 0), sched(3, 3, "2024-01-22", 1000, 0)];
    const r = allocatePayment(schedules, 2500);
    assert.deepEqual(r.allocations, [
      { scheduleId: 1, amountCents: 1000 },
      { scheduleId: 2, amountCents: 1000 },
      { scheduleId: 3, amountCents: 500 },
    ]);
    assert.equal(r.allocatedCents, 2500);
    assert.equal(r.unappliedCents, 0);
  });

  it("reports overpayment as unapplied credit", () => {
    const schedules = [sched(1, 1, "2024-01-08", 1000, 500)];
    const r = allocatePayment(schedules, 2000);
    assert.deepEqual(r.allocations, [{ scheduleId: 1, amountCents: 500 }]);
    assert.equal(r.unappliedCents, 1500);
  });

  it("skips fully paid, waived and cancelled schedules", () => {
    const schedules = [
      sched(1, 1, "2024-01-08", 1000, 1000, "paid"),
      sched(2, 2, "2024-01-15", 1000, 0, "waived"),
      sched(3, 3, "2024-01-22", 1000, 0, "cancelled"),
      sched(4, 4, "2024-01-29", 1000, 0),
    ];
    const r = allocatePayment(schedules, 1000);
    assert.deepEqual(r.allocations, [{ scheduleId: 4, amountCents: 1000 }]);
  });

  it("can direct a payment to a specific instalment (pay-ahead)", () => {
    const schedules = [sched(1, 1, "2024-01-08", 1000, 0), sched(2, 2, "2024-01-15", 1000, 0)];
    const r = allocatePayment(schedules, 1000, { target: 2 });
    assert.deepEqual(r.allocations, [{ scheduleId: 2, amountCents: 1000 }]);
  });
});

describe("applyAllocations", () => {
  const schedules: AllocatableSchedule[] = [
    { id: 1, sequence: 1, dueDate: "2024-01-08", amountCents: 1000, amountPaidCents: 0, status: "pending" },
    { id: 2, sequence: 2, dueDate: "2024-01-15", amountCents: 1000, amountPaidCents: 0, status: "pending" },
  ];

  it("marks partial and full payments", () => {
    const updates = applyAllocations(schedules, [
      { scheduleId: 1, amountCents: 1000 },
      { scheduleId: 2, amountCents: 400 },
    ]);
    assert.deepEqual(updates, [
      { id: 1, amountPaidCents: 1000, status: "paid" },
      { id: 2, amountPaidCents: 400, status: "partially_paid" },
    ]);
  });

  it("throws on overpaying a schedule", () => {
    assert.throws(() => applyAllocations(schedules, [{ scheduleId: 1, amountCents: 2000 }]));
  });
});

describe("classifyOverdue", () => {
  const s = { amountCents: 1000, amountPaidCents: 0, dueDate: "2024-01-10", status: "pending" as const };

  it("classifies current, due, overdue and serious levels", () => {
    assert.equal(classifyOverdue(s, "2024-01-09"), "current");
    assert.equal(classifyOverdue(s, "2024-01-10"), "due");
    assert.equal(classifyOverdue(s, "2024-01-20", { overdueThresholdDays: 7, seriousOverdueThresholdDays: 30 }), "overdue");
    assert.equal(classifyOverdue(s, "2024-03-01", { overdueThresholdDays: 7, seriousOverdueThresholdDays: 30 }), "serious");
  });

  it("honours grace periods and ignores settled schedules", () => {
    assert.equal(classifyOverdue(s, "2024-01-12", { gracePeriodDays: 5 }), "due");
    assert.equal(classifyOverdue(s, "2024-01-16", { gracePeriodDays: 5 }), "overdue");
    assert.equal(classifyOverdue({ ...s, amountPaidCents: 1000 }, "2024-06-01"), "current");
    assert.equal(scheduleRemaining(s), 1000);
  });
});
