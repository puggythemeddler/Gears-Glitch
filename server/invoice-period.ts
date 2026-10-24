export type InvoicePeriodType = "monthly" | "annual";

export function calculateInvoicePeriod(periodStart: string, periodType: InvoicePeriodType): { periodStart: string; periodEnd: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart)) throw new Error("Period start must be a valid ISO date.");
  const end = new Date(`${periodStart}T00:00:00.000Z`);
  if (Number.isNaN(end.getTime()) || end.toISOString().slice(0, 10) !== periodStart) {
    throw new Error("Period start must be a valid ISO date.");
  }
  end.setUTCDate(end.getUTCDate() + (periodType === "annual" ? 365 : 30));
  return { periodStart, periodEnd: end.toISOString().slice(0, 10) };
}
