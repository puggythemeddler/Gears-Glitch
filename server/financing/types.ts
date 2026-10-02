// Lipa Mdogo Mdogo (hire-purchase) domain types.
//
// Every monetary value in this module is an INTEGER NUMBER OF CENTS (minor
// units). No floating point is used anywhere in the financing math - the
// calculator/scheduler/allocation services convert once at the edges.

export type FinancingCurrency = string; // ISO 4217, e.g. "KES"

export type FinancingFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "custom";

export type FinancingChargeModel = "fixed" | "percentage";

export type FinancingPossessionModel =
  | "immediate" // A: possession after deposit/approval
  | "threshold" // B: possession only after a larger payment threshold
  | "on_full_payment"; // C: possession after full payment

export type FinancingApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired";

export type FinancingAgreementStatus =
  | "draft"
  | "active"
  | "restructured"
  | "completed"
  | "cancelled"
  | "defaulted";

export type FinancingOwnershipStatus = "seller" | "transferred";

export type FinancingPossessionStatus = "not_released" | "released" | "returned";

export type FinancingScheduleStatus =
  | "pending"
  | "due"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "waived"
  | "cancelled";

export type FinancingPaymentMethod = "mpesa" | "cash" | "card" | "bank" | "adjustment" | "other";

export type FinancingPaymentStatus =
  | "initiated" // STK push sent, no confirmed result yet
  | "pending" // awaiting callback
  | "succeeded"
  | "failed"
  | "reversed"
  | "refunded";

export type FinancingPaymentSource = "pos" | "portal" | "admin" | "system";

export type FinancingAdjustmentKind = "reversal" | "refund" | "adjustment" | "reallocation" | "waiver";

export type FinancingEventType =
  | "application_created"
  | "application_updated"
  | "application_submitted"
  | "application_approved"
  | "application_rejected"
  | "application_cancelled"
  | "agreement_created"
  | "agreement_accepted"
  | "product_released"
  | "payment_initiated"
  | "payment_received"
  | "payment_allocated"
  | "payment_failed"
  | "payment_reversed"
  | "payment_refunded"
  | "instalment_overdue"
  | "notification_sent"
  | "agreement_restructured"
  | "agreement_cancelled"
  | "agreement_completed"
  | "ownership_transferred";

export interface FinancingConfig {
  enabled: boolean;
  minDepositCents: number;
  maxDepositCents: number | null;
  depositPercentMin: number | null; // 0-100
  depositPercentMax: number | null; // 0-100
  chargeModel: FinancingChargeModel;
  chargeFixedCents: number | null; // used when model = fixed
  chargePercent: number | null; // used when model = percentage
  permittedFrequencies: FinancingFrequency[];
  minTerm: number;
  maxTerm: number;
  minProductValueCents: number | null;
  maxProductValueCents: number | null;
  eligibleCategoryIds: string[] | null; // null = all
  gracePeriodDays: number;
  overdueThresholdDays: number;
  seriousOverdueThresholdDays: number;
  allowedPaymentMethods: FinancingPaymentMethod[];
  possessionModel: FinancingPossessionModel;
  possessionThresholdCents: number | null; // model = threshold
  serialMandatory: boolean;
  guarantorRequired: boolean;
  manualApproval: boolean;
  onlineApplicationAllowed: boolean;
  currency: FinancingCurrency;
}

export const FINANCING_DEFAULT_CONFIG: FinancingConfig = {
  enabled: false,
  minDepositCents: 0,
  maxDepositCents: null,
  depositPercentMin: null,
  depositPercentMax: null,
  chargeModel: "fixed",
  chargeFixedCents: 0,
  chargePercent: null,
  permittedFrequencies: ["weekly", "monthly"],
  minTerm: 1,
  maxTerm: 52,
  minProductValueCents: null,
  maxProductValueCents: null,
  eligibleCategoryIds: null,
  gracePeriodDays: 0,
  overdueThresholdDays: 7,
  seriousOverdueThresholdDays: 30,
  allowedPaymentMethods: ["mpesa", "cash"],
  possessionModel: "immediate",
  possessionThresholdCents: null,
  serialMandatory: false,
  guarantorRequired: false,
  manualApproval: true,
  onlineApplicationAllowed: false,
  currency: "KES",
};

/**
 * Canonical money helpers. `toCents` is only ever used at the API boundary when
 * converting an already-validated decimal cash price into the ledger unit.
 */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) throw new Error("toCents: amount must be finite");
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function formatCents(cents: number, currency = "KES"): string {
  return `${currency} ${(cents / 100).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
