const REPORT_TIME_ZONE = "Africa/Nairobi";

export type ReportRangePreset = "today" | "7d" | "14d" | "30d" | "month" | "ytd" | "all" | "custom";

/** Format the current calendar day for report date inputs in the store timezone. */
export function reportToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Return January 1 for the current calendar year in the store timezone. */
export function reportYearStart(now = new Date()): string {
  return `${reportToday(now).slice(0, 4)}-01-01`;
}

function shiftReportDate(day: string, offset: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + offset));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

/** Build inclusive date bounds for a common report period in the store timezone. */
export function reportDateRange(preset: Exclude<ReportRangePreset, "custom">, now = new Date()): { from: string; to: string } {
  const to = reportToday(now);
  switch (preset) {
    case "today": return { from: to, to };
    case "7d": return { from: shiftReportDate(to, -6), to };
    case "14d": return { from: shiftReportDate(to, -13), to };
    case "30d": return { from: shiftReportDate(to, -29), to };
    case "month": return { from: `${to.slice(0, 7)}-01`, to };
    case "ytd": return { from: reportYearStart(now), to };
    case "all": return { from: "1970-01-01", to };
  }
}
