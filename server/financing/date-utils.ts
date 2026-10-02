// Date helpers for financing schedules. All dates are calendar dates in
// "YYYY-MM-DD" form (no timezone math) so a due date never shifts by a few
// hours when the server runs in a different TZ.

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDateString(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function parseDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) throw new Error(`parseDate: invalid ISO date "${s}"`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateString(d);
}

/**
 * Adds `months` calendar months, clamping the day to the target month's last
 * day (Jan 31 + 1 month -> Feb 28/29). Because it always measures from the same
 * anchor, a monthly schedule keeps the anchor's day of month instead of
 * drifting (Jan 31 -> Feb 28 -> Mar 28).
 */
export function addMonthsClamped(iso: string, months: number): string {
  const d = parseDate(iso);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return toDateString(target);
}

export function compareDate(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = parseDate(toIso).getTime() - parseDate(fromIso).getTime();
  return Math.round(ms / 86400000);
}
