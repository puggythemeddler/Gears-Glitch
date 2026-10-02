// Financing configuration, stored as a non-secret JSON setting. Reads merge
// over the compiled defaults so a new config field never breaks an old row.

import { getStoreSetting, setStoreSetting } from "../db";
import {
  FINANCING_DEFAULT_CONFIG,
  type FinancingConfig,
  type FinancingChargeModel,
  type FinancingFrequency,
  type FinancingPaymentMethod,
  type FinancingPossessionModel,
} from "./types";

const SETTING_KEY = "financing_config";

const FREQUENCIES: FinancingFrequency[] = ["daily", "weekly", "biweekly", "monthly", "custom"];
const CHARGE_MODELS: FinancingChargeModel[] = ["fixed", "percentage"];
const POSSESSION_MODELS: FinancingPossessionModel[] = ["immediate", "threshold", "on_full_payment"];
const PAYMENT_METHODS: FinancingPaymentMethod[] = ["mpesa", "cash", "card", "bank", "adjustment", "other"];

function intOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function normalizeFinancingConfig(raw: unknown): FinancingConfig {
  const d = FINANCING_DEFAULT_CONFIG;
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const frequencies = Array.isArray(o.permittedFrequencies)
    ? (o.permittedFrequencies as unknown[]).filter((f): f is FinancingFrequency => FREQUENCIES.includes(f as FinancingFrequency))
    : d.permittedFrequencies;
  const methods = Array.isArray(o.allowedPaymentMethods)
    ? (o.allowedPaymentMethods as unknown[]).filter((m): m is FinancingPaymentMethod => PAYMENT_METHODS.includes(m as FinancingPaymentMethod))
    : d.allowedPaymentMethods;
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : d.enabled,
    minDepositCents: intOrNull(o.minDepositCents) ?? 0,
    maxDepositCents: intOrNull(o.maxDepositCents),
    depositPercentMin: numOrNull(o.depositPercentMin),
    depositPercentMax: numOrNull(o.depositPercentMax),
    chargeModel: CHARGE_MODELS.includes(o.chargeModel) ? o.chargeModel : d.chargeModel,
    chargeFixedCents: intOrNull(o.chargeFixedCents),
    chargePercent: numOrNull(o.chargePercent),
    permittedFrequencies: frequencies.length ? frequencies : d.permittedFrequencies,
    minTerm: intOrNull(o.minTerm) ?? d.minTerm,
    maxTerm: intOrNull(o.maxTerm) ?? d.maxTerm,
    minProductValueCents: intOrNull(o.minProductValueCents),
    maxProductValueCents: intOrNull(o.maxProductValueCents),
    eligibleCategoryIds: Array.isArray(o.eligibleCategoryIds) ? o.eligibleCategoryIds.map(String) : null,
    gracePeriodDays: intOrNull(o.gracePeriodDays) ?? d.gracePeriodDays,
    overdueThresholdDays: intOrNull(o.overdueThresholdDays) ?? d.overdueThresholdDays,
    seriousOverdueThresholdDays: intOrNull(o.seriousOverdueThresholdDays) ?? d.seriousOverdueThresholdDays,
    allowedPaymentMethods: methods.length ? methods : d.allowedPaymentMethods,
    possessionModel: POSSESSION_MODELS.includes(o.possessionModel) ? o.possessionModel : d.possessionModel,
    possessionThresholdCents: intOrNull(o.possessionThresholdCents),
    serialMandatory: typeof o.serialMandatory === "boolean" ? o.serialMandatory : d.serialMandatory,
    guarantorRequired: typeof o.guarantorRequired === "boolean" ? o.guarantorRequired : d.guarantorRequired,
    manualApproval: typeof o.manualApproval === "boolean" ? o.manualApproval : d.manualApproval,
    onlineApplicationAllowed: typeof o.onlineApplicationAllowed === "boolean" ? o.onlineApplicationAllowed : d.onlineApplicationAllowed,
    currency: typeof o.currency === "string" && o.currency ? o.currency : d.currency,
  };
}

export async function getFinancingConfig(): Promise<FinancingConfig> {
  const raw = await getStoreSetting(SETTING_KEY);
  if (!raw) return { ...FINANCING_DEFAULT_CONFIG };
  try {
    return normalizeFinancingConfig(JSON.parse(raw));
  } catch {
    return { ...FINANCING_DEFAULT_CONFIG };
  }
}

export async function saveFinancingConfig(patch: unknown): Promise<FinancingConfig> {
  const current = await getFinancingConfig();
  const merged = normalizeFinancingConfig({ ...current, ...(patch && typeof patch === "object" ? patch : {}) });
  await setStoreSetting(SETTING_KEY, JSON.stringify(merged));
  return merged;
}

export function isFrequency(v: unknown): v is FinancingFrequency {
  return FREQUENCIES.includes(v as FinancingFrequency);
}

export { PAYMENT_METHODS, POSSESSION_MODELS, CHARGE_MODELS, FREQUENCIES };
