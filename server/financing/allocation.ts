// Server-authoritative payment allocation.
//
// Payments are append-only. A payment is applied to a schedule oldest-due-first
// (the industry-standard waterfall); callers persist the returned allocation
// rows and nothing else. Any amount beyond the outstanding balance is returned
// as `unappliedCents` so it can be recorded as customer credit, never silently
// discarded.

import type { FinancingScheduleStatus } from "./types";
import { daysBetween } from "./date-utils";

export interface AllocatableSchedule {
  id: number;
  sequence: number;
  dueDate: string;
  amountCents: number;
  amountPaidCents: number;
  status: FinancingScheduleStatus;
}

export interface AllocationRow {
  scheduleId: number;
  amountCents: number;
}

export interface AllocationResult {
  allocations: AllocationRow[];
  allocatedCents: number;
  unappliedCents: number;
}

const ALLOCATABLE: ReadonlySet<FinancingScheduleStatus> = new Set([
  "pending",
  "due",
  "partially_paid",
  "overdue",
]);

export function scheduleRemaining(s: Pick<AllocatableSchedule, "amountCents" | "amountPaidCents">): number {
  return Math.max(0, s.amountCents - s.amountPaidCents);
}

/**
 * @param schedules  schedules for one agreement (any order; sorted internally)
 * @param amountCents payment amount (>= 0)
 * @param options.target scheduleId to direct the payment to (pay-ahead / specific
 *                       instalment). When omitted the waterfall runs oldest-first.
 */
export function allocatePayment(
  schedules: AllocatableSchedule[],
  amountCents: number,
  options?: { target?: number | null }
): AllocationResult {
  if (!Number.isInteger(amountCents) || amountCents < 0) throw new Error("amountCents must be a non-negative integer");

  const eligible = schedules
    .filter((s) => ALLOCATABLE.has(s.status) && scheduleRemaining(s) > 0)
    .sort((a, b) => {
      if (options?.target) {
        if (a.id === options.target) return -1;
        if (b.id === options.target) return 1;
      }
      if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      return a.sequence - b.sequence;
    });

  const allocations: AllocationRow[] = [];
  let remaining = amountCents;

  for (const s of eligible) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, scheduleRemaining(s));
    if (take > 0) {
      allocations.push({ scheduleId: s.id, amountCents: take });
      remaining -= take;
    }
  }

  return {
    allocations,
    allocatedCents: amountCents - remaining,
    unappliedCents: remaining,
  };
}

export interface ScheduleStateUpdate {
  id: number;
  amountPaidCents: number;
  status: FinancingScheduleStatus;
}

/**
 * Derives the new paid amount + status for each touched schedule after an
 * allocation. `todayIso` lets a paid-but-late instalment still settle to
 * "paid" rather than becoming "overdue".
 */
export function applyAllocations(
  schedules: AllocatableSchedule[],
  allocations: AllocationRow[]
): ScheduleStateUpdate[] {
  const byId = new Map(schedules.map((s) => [s.id, s]));
  const updates: ScheduleStateUpdate[] = [];
  for (const a of allocations) {
    const s = byId.get(a.scheduleId);
    if (!s) throw new Error(`allocation references unknown schedule ${a.scheduleId}`);
    const paid = s.amountPaidCents + a.amountCents;
    if (paid > s.amountCents) throw new Error(`allocation overpays schedule ${s.id}`);
    updates.push({
      id: s.id,
      amountPaidCents: paid,
      status: paid >= s.amountCents ? "paid" : paid > 0 ? "partially_paid" : s.status,
    });
  }
  return updates;
}

export interface OverdueOptions {
  gracePeriodDays?: number;
  overdueThresholdDays?: number;
  seriousOverdueThresholdDays?: number;
}

export type OverdueLevel = "current" | "due" | "overdue" | "serious";

/** Classifies a single unpaid schedule relative to a reference date. */
export function classifyOverdue(
  s: Pick<AllocatableSchedule, "amountCents" | "amountPaidCents" | "dueDate" | "status">,
  todayIso: string,
  options: OverdueOptions = {}
): OverdueLevel {
  if (scheduleRemaining(s) <= 0) return "current";
  if (s.status === "waived" || s.status === "cancelled") return "current";
  const grace = options.gracePeriodDays ?? 0;
  const overdueAt = options.overdueThresholdDays ?? 1;
  const seriousAt = options.seriousOverdueThresholdDays ?? 30;

  const diff = daysBetween(s.dueDate, todayIso);
  if (diff < 0) return "current";
  if (diff === 0 && grace === 0) return "due";
  const overdueDays = diff - grace;
  if (overdueDays <= 0) return "due";
  if (overdueDays >= seriousAt) return "serious";
  if (overdueDays >= overdueAt) return "overdue";
  return "due";
}
