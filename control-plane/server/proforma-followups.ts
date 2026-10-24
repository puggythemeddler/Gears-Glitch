export const PROFORMA_WARNING_DAYS = 7;
export const PROFORMA_SUSPENSION_GRACE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export function proformaFollowupSchedule(createdAt: string | Date): { warningDueAt: Date } | null {
  const created = createdAt instanceof Date ? new Date(createdAt) : new Date(createdAt);
  if (!Number.isFinite(created.getTime())) return null;
  return { warningDueAt: new Date(created.getTime() + PROFORMA_WARNING_DAYS * DAY_MS) };
}

export function proformaSuspensionDueAt(warningSentAt: string | Date): Date | null {
  const warned = warningSentAt instanceof Date ? new Date(warningSentAt) : new Date(warningSentAt);
  if (!Number.isFinite(warned.getTime())) return null;
  return new Date(warned.getTime() + PROFORMA_SUSPENSION_GRACE_DAYS * DAY_MS);
}

export function isValidUsageExtensionDays(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 365;
}

export function paidProformaRenewal(
  periodStartValue: unknown,
  periodEndValue: unknown,
  currentExpiryValue: unknown,
  now = new Date(),
): { expiresAt: Date; nextPaymentDate: string; periodDays: number; periodType: "monthly" | "annual" } {
  const parseDate = (value: unknown): Date | null => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  };
  const periodStart = parseDate(periodStartValue);
  const periodEnd = parseDate(periodEndValue);
  const rawDays = periodStart && periodEnd && periodEnd > periodStart
    ? Math.ceil((periodEnd.getTime() - periodStart.getTime()) / DAY_MS)
    : 30;
  const periodDays = Math.max(1, rawDays);
  const nowDate = new Date(now.getTime());
  const currentExpiry = currentExpiryValue instanceof Date
    ? new Date(currentExpiryValue.getTime())
    : currentExpiryValue ? new Date(currentExpiryValue as string | number) : null;
  const base = currentExpiry && Number.isFinite(currentExpiry.getTime()) && currentExpiry > nowDate ? currentExpiry : nowDate;
  const expiresAt = periodEnd && periodEnd > base ? periodEnd : new Date(base.getTime() + periodDays * DAY_MS);
  return {
    expiresAt,
    nextPaymentDate: expiresAt.toISOString().slice(0, 10),
    periodDays,
    periodType: periodDays > 180 ? "annual" : "monthly",
  };
}
