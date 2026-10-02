// Server-authoritative hire-purchase calculator.
//
// Pure, deterministic, integer-cents only. The browser may call a read-only
// preview endpoint, but every number persisted to financing_* tables is
// produced here (never trusted from the client).

import type { FinancingChargeModel, FinancingFrequency, FinancingConfig } from "./types";
import { addDays, addMonthsClamped } from "./date-utils";

export interface CalculatorInput {
  cashPriceCents: number;
  depositCents: number;
  chargeModel: FinancingChargeModel;
  chargeFixedCents?: number | null;
  chargePercent?: number | null;
  frequency: FinancingFrequency;
  termCount: number;
  startDate: string; // ISO date, e.g. delivery/agreement date
  firstDueDate?: string | null; // defaults to start + one period
  intervalDays?: number | null; // required when frequency = custom
  currency?: string;
}

export interface PlannedInstalment {
  sequence: number; // 1-based
  dueDate: string;
  amountCents: number;
}

export interface FinancingQuote {
  cashPriceCents: number;
  depositCents: number;
  chargeCents: number;
  financingChargeCents: number;
  hpPriceCents: number;
  financedBalanceCents: number;
  termCount: number;
  frequency: FinancingFrequency;
  intervalDays: number | null;
  instalmentCents: number;
  finalInstalmentCents: number;
  totalPayableCents: number;
  totalRemainingCents: number;
  instalments: PlannedInstalment[];
}

function assertIntCents(name: string, v: number): void {
  if (!Number.isInteger(v)) throw new Error(`${name} must be an integer number of cents`);
  if (v < 0) throw new Error(`${name} must not be negative`);
}

/** Converts a weekly/monthly/annual style frequency + optional custom days into a period step. */
export function frequencyStepDays(frequency: FinancingFrequency, intervalDays?: number | null): number | null {
  switch (frequency) {
    case "daily":
      return 1;
    case "weekly":
      return 7;
    case "biweekly":
      return 14;
    case "monthly":
      return null; // handled as calendar months
    case "custom":
      if (!intervalDays || intervalDays <= 0) throw new Error("custom frequency requires intervalDays > 0");
      return intervalDays;
    default:
      throw new Error(`unknown frequency "${frequency}"`);
  }
}

export function addPeriod(iso: string, frequency: FinancingFrequency, periods: number, intervalDays?: number | null): string {
  if (frequency === "monthly") return addMonthsClamped(iso, periods);
  const step = frequencyStepDays(frequency, intervalDays)!;
  return addDays(iso, step * periods);
}

/**
 * Resolves a deposit expressed either as a fixed amount (cents) or a percentage
 * of the cash price. Exactly one of the two must be supplied.
 */
export function resolveDeposit(cashPriceCents: number, depositCents?: number | null, depositPercent?: number | null): number {
  assertIntCents("cashPriceCents", cashPriceCents);
  if (depositCents != null && depositPercent != null) {
    throw new Error("supply either depositCents or depositPercent, not both");
  }
  if (depositPercent != null) {
    if (depositPercent < 0 || depositPercent > 100) throw new Error("depositPercent must be between 0 and 100");
    return Math.round((cashPriceCents * depositPercent) / 100);
  }
  const d = depositCents ?? 0;
  assertIntCents("depositCents", d);
  if (d > cashPriceCents) throw new Error("depositCents must not exceed cashPriceCents");
  return d;
}

export function calculateFinancing(input: CalculatorInput): FinancingQuote {
  const {
    cashPriceCents,
    depositCents,
    chargeModel,
    chargeFixedCents,
    chargePercent,
    frequency,
    termCount,
    startDate,
    firstDueDate,
    intervalDays,
  } = input;

  assertIntCents("cashPriceCents", cashPriceCents);
  assertIntCents("depositCents", depositCents);
  if (depositCents > cashPriceCents) throw new Error("depositCents must not exceed cashPriceCents");
  if (!Number.isInteger(termCount) || termCount < 1) throw new Error("termCount must be a positive integer");

  const base = cashPriceCents - depositCents;
  let chargeCents: number;
  if (chargeModel === "fixed") {
    chargeCents = Math.round(chargeFixedCents ?? 0);
    assertIntCents("chargeFixedCents", chargeCents);
  } else if (chargeModel === "percentage") {
    const pct = chargePercent ?? 0;
    if (!Number.isFinite(pct) || pct < 0) throw new Error("chargePercent must be >= 0");
    chargeCents = Math.round((base * pct) / 100);
  } else {
    throw new Error(`unknown chargeModel "${chargeModel}"`);
  }

  const hpPriceCents = cashPriceCents + chargeCents;
  const financedBalanceCents = hpPriceCents - depositCents;

  const instalmentCents = Math.floor(financedBalanceCents / termCount);
  const remainder = financedBalanceCents - instalmentCents * termCount;
  const finalInstalmentCents = instalmentCents + remainder;

  if (finalInstalmentCents < 0) throw new Error("negative instalment");

  const anchor = firstDueDate || addPeriod(startDate, frequency, 1, intervalDays);
  const instalments: PlannedInstalment[] = [];
  for (let i = 1; i <= termCount; i++) {
    instalments.push({
      sequence: i,
      dueDate: addPeriod(anchor, frequency, i - 1, intervalDays),
      amountCents: i === termCount ? finalInstalmentCents : instalmentCents,
    });
  }

  return {
    cashPriceCents,
    depositCents,
    chargeCents,
    financingChargeCents: chargeCents,
    hpPriceCents,
    financedBalanceCents,
    termCount,
    frequency,
    intervalDays: frequency === "custom" ? intervalDays ?? null : null,
    instalmentCents,
    finalInstalmentCents,
    totalPayableCents: depositCents + financedBalanceCents,
    totalRemainingCents: financedBalanceCents,
    instalments,
  };
}

export interface TermValidationError {
  field: string;
  message: string;
}

/**
 * Validates a proposed plan against the tenant/branch configuration. Kept
 * separate from the calculator so tests can exercise both independently.
 */
export function validateTerms(input: CalculatorInput, config: FinancingConfig): TermValidationError[] {
  const errors: TermValidationError[] = [];
  const cash = input.cashPriceCents;

  if (!config.enabled) errors.push({ field: "enabled", message: "Financing is not enabled for this store" });
  if (!Number.isInteger(input.termCount) || input.termCount < config.minTerm) {
    errors.push({ field: "termCount", message: `Term must be at least ${config.minTerm}` });
  }
  if (input.termCount > config.maxTerm) {
    errors.push({ field: "termCount", message: `Term must be at most ${config.maxTerm}` });
  }
  if (config.permittedFrequencies.length > 0 && !config.permittedFrequencies.includes(input.frequency)) {
    errors.push({ field: "frequency", message: `Payment frequency "${input.frequency}" is not permitted` });
  }
  if (config.minProductValueCents != null && cash < config.minProductValueCents) {
    errors.push({ field: "cashPriceCents", message: "Product price is below the financing minimum" });
  }
  if (config.maxProductValueCents != null && cash > config.maxProductValueCents) {
    errors.push({ field: "cashPriceCents", message: "Product price is above the financing maximum" });
  }
  if (input.depositCents > cash) {
    errors.push({ field: "depositCents", message: "Deposit cannot exceed the cash price" });
  }
  if (input.depositCents < config.minDepositCents) {
    errors.push({ field: "depositCents", message: "Deposit is below the configured minimum" });
  }
  if (config.maxDepositCents != null && input.depositCents > config.maxDepositCents) {
    errors.push({ field: "depositCents", message: "Deposit is above the configured maximum" });
  }
  if (cash > 0 && config.depositPercentMin != null) {
    const minCents = Math.round((cash * config.depositPercentMin) / 100);
    if (input.depositCents < minCents) errors.push({ field: "depositCents", message: `Deposit must be at least ${config.depositPercentMin}% of the cash price` });
  }
  if (cash > 0 && config.depositPercentMax != null) {
    const maxCents = Math.round((cash * config.depositPercentMax) / 100);
    if (input.depositCents > maxCents) errors.push({ field: "depositCents", message: `Deposit must be at most ${config.depositPercentMax}% of the cash price` });
  }
  if (input.frequency === "custom" && (!input.intervalDays || input.intervalDays <= 0)) {
    errors.push({ field: "intervalDays", message: "Custom frequency requires a positive interval in days" });
  }
  if (!/^\d{4}-\d{2}-\d{2}/.test(input.startDate)) {
    errors.push({ field: "startDate", message: "Invalid start date" });
  }
  return errors;
}
