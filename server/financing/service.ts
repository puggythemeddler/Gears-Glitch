// Lipa Mdogo Mdogo service layer.
//
// Server-authoritative: applications, agreements, schedules and every payment
// allocation are created and mutated here (never from the browser). All amounts
// are integer cents. Payments/adjustments are append-only.
//
// M-Pesa STK initiation reuses `server/mpesa.ts`; this module never marks an
// instalment paid on initiation - only a verified callback does.

import { query, queryOne, queryAll, transaction } from "../db-helpers";
import { getProduct, findCustomerById, recordAuditLog } from "../db";
import { stkPush, getMpesaConfig, normalizeDarajaPhone } from "../mpesa";
import { getFinancingConfig } from "./config";
import {
  calculateFinancing,
  resolveDeposit,
  validateTerms,
  type CalculatorInput,
} from "./calculator";
import { allocatePayment, applyAllocations, type AllocatableSchedule } from "./allocation";
import { toDateString } from "./date-utils";
import {
  fromCents,
  toCents,
  type FinancingFrequency,
  type FinancingApplicationStatus,
  type FinancingPaymentMethod,
  type FinancingPaymentSource,
} from "./types";
import { notify } from "../notification-service";

export interface Actor {
  id: number | null;
  name?: string;
  type?: "staff" | "customer" | "system";
}

function todayIso(): string {
  return toDateString(new Date());
}

async function nextSeq(seq: string): Promise<number> {
  const allowed = new Set(["financing_application_seq", "financing_agreement_seq"]);
  if (!allowed.has(seq)) throw new Error(`unknown sequence ${seq}`);
  const row = await queryOne(`SELECT nextval('${seq}') AS n`) as any;
  return Number(row.n);
}

export async function generateApplicationNumber(): Promise<string> {
  return `LIPA-APP-${String(await nextSeq("financing_application_seq")).padStart(6, "0")}`;
}

export async function generateAgreementNumber(): Promise<string> {
  return `LIPA-AG-${String(await nextSeq("financing_agreement_seq")).padStart(6, "0")}`;
}

function generatePaymentRef(): string {
  return `LIPA-PAY-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1e6).toString(36).toUpperCase()}`;
}

async function recordEvent(
  eventType: string,
  opts: { agreementId?: number | null; applicationId?: number | null; actor?: Actor | null; detail?: Record<string, any> }
): Promise<void> {
  try {
    await query(
      "INSERT INTO financing_events (agreement_id, application_id, event_type, actor_id, actor_type, detail) VALUES ($1, $2, $3, $4, $5, $6)",
      [
        opts.agreementId ?? null,
        opts.applicationId ?? null,
        eventType,
        opts.actor?.id ?? null,
        opts.actor?.type || "system",
        JSON.stringify(opts.detail || {}),
      ]
    );
  } catch (err: any) {
    console.warn("[financing] event log failed:", err?.message || err);
  }
}

async function audit(actor: Actor | null, action: string, entityType: string, entityId: string | number | null, details: string): Promise<void> {
  try {
    await recordAuditLog(actor?.id ?? null, actor?.name || "system", action, entityType, entityId == null ? null : String(entityId), details, actor?.type || "system");
  } catch (err: any) {
    console.warn("[financing] audit failed:", err?.message || err);
  }
}

// ---------------------------------------------------------------- applications

export interface ApplicationInput {
  customerId: number;
  productId?: string | null;
  productName?: string;
  serialNumber?: string;
  cashPriceCents?: number;
  depositCents?: number;
  depositPercent?: number | null;
  chargeModel?: "fixed" | "percentage";
  chargeFixedCents?: number | null;
  chargePercent?: number | null;
  frequency: FinancingFrequency;
  intervalDays?: number | null;
  termCount: number;
  startDate?: string;
  firstDueDate?: string | null;
  possessionModel?: string;
  possessionThresholdCents?: number | null;
  guarantorName?: string;
  guarantorPhone?: string;
  customerNationalId?: string;
  notes?: string;
  consent?: boolean;
  branchId?: number | null;
  status?: FinancingApplicationStatus;
}

function mapApplication(r: any): any {
  if (!r) return r;
  return {
    id: r.id,
    applicationNumber: r.application_number,
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    customerEmail: r.customer_email,
    customerNationalId: r.customer_national_id,
    branchId: r.branch_id,
    productId: r.product_id,
    productName: r.product_name,
    serialNumber: r.serial_number,
    cashPriceCents: Number(r.cash_price_cents),
    depositCents: Number(r.deposit_cents),
    chargeModel: r.charge_model,
    chargeFixedCents: r.charge_fixed_cents == null ? null : Number(r.charge_fixed_cents),
    chargePercent: r.charge_percent == null ? null : Number(r.charge_percent),
    frequency: r.frequency,
    intervalDays: r.interval_days == null ? null : Number(r.interval_days),
    termCount: Number(r.term_count),
    startDate: r.start_date,
    firstDueDate: r.first_due_date,
    possessionModel: r.possession_model,
    possessionThresholdCents: r.possession_threshold_cents == null ? null : Number(r.possession_threshold_cents),
    guarantorName: r.guarantor_name,
    guarantorPhone: r.guarantor_phone,
    notes: r.notes,
    consentAt: r.consent_at,
    status: r.status,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    rejectionReason: r.rejection_reason,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Creates a draft/ submitted application. The cash price is taken from the
 * product record when a productId is supplied, so a client cannot invent a
 * lower price. Terms are snapshotted onto the application and frozen at
 * approval time.
 */
export async function createApplication(input: ApplicationInput, actor: Actor): Promise<any> {
  const config = await getFinancingConfig();
  if (!config.enabled) throw new Error("Financing is not enabled");
  if (!Number.isInteger(input.customerId) || input.customerId <= 0) throw new Error("customerId is required");
  const customer = await findCustomerById(input.customerId);
  if (!customer) throw new Error("Customer not found");

  let productName = input.productName || "";
  let cashPriceCents: number;
  if (input.productId) {
    const product = await getProduct(input.productId);
    if (!product) throw new Error("Product not found");
    const effective = product.salePrice != null && product.salePrice > 0 ? product.salePrice : product.price;
    cashPriceCents = toCents(effective);
    productName = product.name;
  } else {
    cashPriceCents = Math.round(input.cashPriceCents || 0);
    if (cashPriceCents <= 0) throw new Error("A product or a positive cash price is required");
  }

  if (config.eligibleCategoryIds && input.productId && !config.eligibleCategoryIds.includes((await getProduct(input.productId))!.category)) {
    throw new Error("This product category is not eligible for financing");
  }

  const depositCents = resolveDeposit(cashPriceCents, input.depositCents ?? null, input.depositPercent ?? null);
  const startDate = input.startDate || todayIso();
  const termCount = input.termCount;

  const calcInput: CalculatorInput = {
    cashPriceCents,
    depositCents,
    chargeModel: input.chargeModel || config.chargeModel,
    chargeFixedCents: input.chargeFixedCents ?? config.chargeFixedCents,
    chargePercent: input.chargePercent ?? config.chargePercent,
    frequency: input.frequency,
    intervalDays: input.intervalDays ?? null,
    termCount,
    startDate,
    firstDueDate: input.firstDueDate ?? null,
  };

  const errors = validateTerms(calcInput, config);
  if (errors.length) throw new Error(errors.map((e) => e.message).join("; "));

  const status: FinancingApplicationStatus = input.status || "draft";
  const applicationNumber = await generateApplicationNumber();
  const consentAt = input.consent ? new Date().toISOString() : null;

  const res = await query(
    `INSERT INTO financing_applications (
       application_number, customer_id, customer_name, customer_phone, customer_email, customer_national_id,
       branch_id, product_id, product_name, serial_number, cash_price_cents, deposit_cents,
       charge_model, charge_fixed_cents, charge_percent, frequency, interval_days, term_count,
       start_date, first_due_date, possession_model, possession_threshold_cents, guarantor_name, guarantor_phone,
       notes, consent_at, status, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
     RETURNING *`,
    [
      applicationNumber, input.customerId, customer.name, customer.phone || "", customer.email || "", input.customerNationalId || "",
      input.branchId ?? null, input.productId ?? null, productName, input.serialNumber || "", cashPriceCents, depositCents,
      calcInput.chargeModel, calcInput.chargeFixedCents ?? null, calcInput.chargePercent ?? null, input.frequency, input.intervalDays ?? null, termCount,
      startDate, input.firstDueDate ?? null, input.possessionModel || config.possessionModel, input.possessionThresholdCents ?? config.possessionThresholdCents, input.guarantorName || "", input.guarantorPhone || "",
      input.notes || "", consentAt, status, actor.id,
    ]
  );
  const app = mapApplication(res.rows[0]);
  await recordEvent("application_created", { applicationId: app.id, actor });
  await audit(actor, "financing.application.create", "financing_application", app.id, `Created application ${applicationNumber}`);
  return app;
}

export async function getApplication(id: number): Promise<any | undefined> {
  const r = await queryOne("SELECT * FROM financing_applications WHERE id = $1", [id]);
  return r ? mapApplication(r) : undefined;
}

export async function listApplications(filters: { status?: string; customerId?: number; branchId?: number; limit?: number } = {}): Promise<any[]> {
  const conds: string[] = [];
  const params: any[] = [];
  if (filters.status) { params.push(filters.status); conds.push(`status = $${params.length}`); }
  if (filters.customerId) { params.push(filters.customerId); conds.push(`customer_id = $${params.length}`); }
  if (filters.branchId) { params.push(filters.branchId); conds.push(`branch_id = $${params.length}`); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const limit = Math.min(Math.max(filters.limit || 200, 1), 1000);
  const rows = await queryAll(`SELECT * FROM financing_applications ${where} ORDER BY created_at DESC LIMIT ${limit}`, params);
  return rows.map(mapApplication);
}

export async function updateApplication(id: number, patch: Partial<ApplicationInput>, actor: Actor): Promise<any> {
  const existing = await getApplication(id);
  if (!existing) throw new Error("Application not found");
  if (existing.status !== "draft") throw new Error("Only draft applications can be edited");

  const cash = patch.cashPriceCents ? Math.round(patch.cashPriceCents) : existing.cashPriceCents;
  const deposit = patch.depositCents != null ? resolveDeposit(cash, patch.depositCents, null) : existing.depositCents;
  const fields: string[] = [];
  const params: any[] = [];
  const set = (col: string, val: any) => { params.push(val); fields.push(`${col} = $${params.length}`); };
  if (patch.productName !== undefined) set("product_name", patch.productName);
  if (patch.serialNumber !== undefined) set("serial_number", patch.serialNumber);
  if (patch.cashPriceCents !== undefined) set("cash_price_cents", cash);
  if (patch.depositCents !== undefined) set("deposit_cents", deposit);
  if (patch.frequency !== undefined) set("frequency", patch.frequency);
  if (patch.intervalDays !== undefined) set("interval_days", patch.intervalDays);
  if (patch.termCount !== undefined) set("term_count", patch.termCount);
  if (patch.startDate !== undefined) set("start_date", patch.startDate);
  if (patch.firstDueDate !== undefined) set("first_due_date", patch.firstDueDate);
  if (patch.guarantorName !== undefined) set("guarantor_name", patch.guarantorName);
  if (patch.guarantorPhone !== undefined) set("guarantor_phone", patch.guarantorPhone);
  if (patch.notes !== undefined) set("notes", patch.notes);
  if (fields.length) {
    fields.push("updated_at = NOW()::text");
    params.push(id);
    await query(`UPDATE financing_applications SET ${fields.join(", ")} WHERE id = $${params.length}`, params);
  }
  await recordEvent("application_updated", { applicationId: id, actor });
  return (await getApplication(id))!;
}

export async function submitApplication(id: number, actor: Actor): Promise<any> {
  const app = await getApplication(id);
  if (!app) throw new Error("Application not found");
  if (app.status !== "draft") throw new Error("Only a draft application can be submitted");
  if (!app.consentAt) throw new Error("Customer consent is required before submission");
  const config = await getFinancingConfig();
  const next: FinancingApplicationStatus = config.manualApproval ? "submitted" : "approved";
  await query("UPDATE financing_applications SET status = $1, updated_at = NOW()::text WHERE id = $2", [next, id]);
  await recordEvent("application_submitted", { applicationId: id, actor });
  if (!config.manualApproval) return approveApplication(id, actor);
  return (await getApplication(id))!;
}

export async function reviewApplication(id: number, approve: boolean, actor: Actor, reason = ""): Promise<any> {
  const app = await getApplication(id);
  if (!app) throw new Error("Application not found");
  if (!["submitted", "under_review", "draft"].includes(app.status)) throw new Error(`Cannot review an application in status "${app.status}"`);
  if (approve) return approveApplication(id, actor);
  await query("UPDATE financing_applications SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW()::text, rejection_reason = $2, updated_at = NOW()::text WHERE id = $3", [actor.id, reason, id]);
  await recordEvent("application_rejected", { applicationId: id, actor, detail: { reason } });
  await audit(actor, "financing.application.reject", "financing_application", id, reason);
  return (await getApplication(id))!;
}

/**
 * Approves an application and creates the immutable agreement + schedule in a
 * single transaction. This is the only path that creates schedules.
 */
export async function approveApplication(id: number, actor: Actor, opts: { orderId?: number | null } = {}): Promise<any> {
  const app = await getApplication(id);
  if (!app) throw new Error("Application not found");
  if (app.status === "cancelled" || app.status === "expired") throw new Error(`Cannot approve a ${app.status} application`);
  if (!app.startDate || !app.termCount) throw new Error("Application terms are incomplete");

  const config = await getFinancingConfig();
  const quote = calculateFinancing({
    cashPriceCents: app.cashPriceCents,
    depositCents: app.depositCents,
    chargeModel: app.chargeModel,
    chargeFixedCents: app.chargeFixedCents,
    chargePercent: app.chargePercent,
    frequency: app.frequency,
    intervalDays: app.intervalDays,
    termCount: app.termCount,
    startDate: app.startDate,
    firstDueDate: app.firstDueDate,
  });
  const agreementNumber = await generateAgreementNumber();

  const result = await transaction(async (client) => {
    // Lock the application row so concurrent approvals cannot both create an
    // agreement, and short-circuit if one already exists (idempotent retry).
    const locked = (await client.query("SELECT status FROM financing_applications WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!locked) throw new Error("Application not found");
    if (locked.status === "cancelled" || locked.status === "expired") throw new Error(`Cannot approve a ${locked.status} application`);
    const existing = (await client.query("SELECT id FROM financing_agreements WHERE application_id = $1 ORDER BY id LIMIT 1", [id])).rows[0];
    if (existing) return { id: Number(existing.id), created: false };

    const ins = await client.query(
      `INSERT INTO financing_agreements (
         agreement_number, application_id, customer_id, branch_id, order_id, product_id, product_name, serial_number, currency,
         cash_price_cents, deposit_cents, charge_cents, hp_price_cents, financed_balance_cents, instalment_cents, final_instalment_cents,
         term_count, frequency, interval_days, start_date, first_due_date, status, possession_model, possession_threshold_cents,
         total_paid_cents, outstanding_cents, credit_cents, created_by, approved_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'active',$22,$23,0,$24,0,$25,$25)
       RETURNING id`,
      [
        agreementNumber, id, app.customerId, app.branchId, opts.orderId ?? null, app.productId, app.productName, app.serialNumber, config.currency,
        quote.cashPriceCents, quote.depositCents, quote.chargeCents, quote.hpPriceCents, quote.financedBalanceCents, quote.instalmentCents, quote.finalInstalmentCents,
        quote.termCount, quote.frequency, quote.intervalDays, app.startDate, quote.instalments[0].dueDate, app.possessionModel, app.possessionThresholdCents,
        quote.financedBalanceCents, actor.id,
      ]
    );
    const agrId = ins.rows[0].id;
    for (const inst of quote.instalments) {
      await client.query(
        "INSERT INTO financing_schedules (agreement_id, sequence, due_date, amount_cents, amount_paid_cents, status) VALUES ($1,$2,$3,$4,0,'pending')",
        [agrId, inst.sequence, inst.dueDate, inst.amountCents]
      );
    }
    await client.query(
      "INSERT INTO financing_agreement_items (agreement_id, product_id, name, quantity, unit_price_cents, line_total_cents, serial_number) VALUES ($1,$2,$3,1,$4,$4,$5)",
      [agrId, app.productId, app.productName || "Item", quote.cashPriceCents, app.serialNumber]
    );
    await client.query("UPDATE financing_applications SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()::text, updated_at = NOW()::text WHERE id = $2", [actor.id, id]);
    return { id: Number(agrId), created: true };
  });

  if (result.created) {
    await recordEvent("agreement_created", { agreementId: result.id, applicationId: id, actor, detail: { agreementNumber } });
    await audit(actor, "financing.agreement.create", "financing_agreement", result.id, `Created agreement ${agreementNumber}`);
    await notifyCustomer(app, "financing.agreement.created", `Your ${config.currency} hire-purchase agreement ${agreementNumber} has been created.`);
  }
  return (await getAgreement(result.id))!;
}

// ------------------------------------------------------------------ agreements

function mapAgreement(r: any): any {
  if (!r) return r;
  return {
    id: r.id,
    agreementNumber: r.agreement_number,
    applicationId: r.application_id,
    customerId: r.customer_id,
    branchId: r.branch_id,
    orderId: r.order_id,
    productId: r.product_id,
    productName: r.product_name,
    serialNumber: r.serial_number,
    currency: r.currency,
    cashPriceCents: Number(r.cash_price_cents),
    depositCents: Number(r.deposit_cents),
    chargeCents: Number(r.charge_cents),
    hpPriceCents: Number(r.hp_price_cents),
    financedBalanceCents: Number(r.financed_balance_cents),
    instalmentCents: Number(r.instalment_cents),
    finalInstalmentCents: Number(r.final_instalment_cents),
    termCount: Number(r.term_count),
    frequency: r.frequency,
    intervalDays: r.interval_days == null ? null : Number(r.interval_days),
    startDate: r.start_date,
    firstDueDate: r.first_due_date,
    status: r.status,
    ownershipStatus: r.ownership_status,
    possessionStatus: r.possession_status,
    possessionModel: r.possession_model,
    possessionThresholdCents: r.possession_threshold_cents == null ? null : Number(r.possession_threshold_cents),
    totalPaidCents: Number(r.total_paid_cents),
    outstandingCents: Number(r.outstanding_cents),
    creditCents: Number(r.credit_cents),
    version: Number(r.version),
    completedAt: r.completed_at,
    cancelledAt: r.cancelled_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapSchedule(r: any): any {
  return {
    id: r.id,
    agreementId: r.agreement_id,
    sequence: Number(r.sequence),
    dueDate: r.due_date,
    amountCents: Number(r.amount_cents),
    amountPaidCents: Number(r.amount_paid_cents),
    waivedCents: Number(r.waived_cents),
    status: r.status,
    paidAt: r.paid_at,
  };
}

export async function getAgreement(id: number): Promise<any | undefined> {
  const r = await queryOne("SELECT * FROM financing_agreements WHERE id = $1", [id]);
  if (!r) return undefined;
  const agreement = mapAgreement(r);
  const schedules = (await queryAll("SELECT * FROM financing_schedules WHERE agreement_id = $1 ORDER BY sequence", [id])).map(mapSchedule);
  const payments = await listPayments(id);
  const items = (await queryAll("SELECT * FROM financing_agreement_items WHERE agreement_id = $1 ORDER BY id", [id])).map((i: any) => ({
    id: i.id, productId: i.product_id, name: i.name, quantity: Number(i.quantity), unitPriceCents: Number(i.unit_price_cents), lineTotalCents: Number(i.line_total_cents), serialNumber: i.serial_number,
  }));
  return { ...agreement, schedules, payments, items };
}

export async function listAgreements(filters: { status?: string; customerId?: number; branchId?: number; overdue?: boolean; limit?: number } = {}): Promise<any[]> {
  const conds: string[] = [];
  const params: any[] = [];
  if (filters.status) { params.push(filters.status); conds.push(`status = $${params.length}`); }
  if (filters.customerId) { params.push(filters.customerId); conds.push(`customer_id = $${params.length}`); }
  if (filters.branchId) { params.push(filters.branchId); conds.push(`branch_id = $${params.length}`); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const limit = Math.min(Math.max(filters.limit || 200, 1), 1000);
  const rows = await queryAll(`SELECT * FROM financing_agreements ${where} ORDER BY created_at DESC LIMIT ${limit}`, params) as any[];
  const agreements = rows.map(mapAgreement);
  if (filters.overdue) {
    const today = todayIso();
    const result = [];
    for (const a of agreements) {
      if (a.status !== "active") continue;
      const overdueRow = await queryOne(
        "SELECT COUNT(*) AS c FROM financing_schedules WHERE agreement_id = $1 AND due_date < $2 AND status NOT IN ('paid','waived','cancelled')",
        [a.id, today]
      ) as any;
      if (Number(overdueRow.c) > 0) result.push(a);
    }
    return result;
  }
  return agreements;
}

export async function listAgreementsForCustomer(customerId: number): Promise<any[]> {
  return listAgreements({ customerId });
}

export async function releaseProduct(id: number, actor: Actor): Promise<any> {
  const agr = await getAgreement(id);
  if (!agr) throw new Error("Agreement not found");
  if (agr.possessionStatus === "released") return agr;
  const model = agr.possessionModel;
  if (model === "threshold") {
    const threshold = agr.possessionThresholdCents ?? 0;
    if (agr.totalPaidCents < threshold) throw new Error(`Possession requires ${fromCents(threshold)} paid so far`);
  } else if (model === "on_full_payment") {
    if (agr.outstandingCents > 0) throw new Error("Possession is only released once the agreement is fully paid");
  }
  await query("UPDATE financing_agreements SET possession_status = 'released', updated_at = NOW()::text WHERE id = $1", [id]);
  await recordEvent("product_released", { agreementId: id, actor });
  await audit(actor, "financing.agreement.release", "financing_agreement", id, "Product released to customer");
  return (await getAgreement(id))!;
}

export async function cancelAgreement(id: number, actor: Actor, reason = ""): Promise<any> {
  const agr = await getAgreement(id);
  if (!agr) throw new Error("Agreement not found");
  if (agr.status === "completed") throw new Error("A completed agreement cannot be cancelled");
  await query("UPDATE financing_agreements SET status = 'cancelled', cancelled_at = NOW()::text, updated_at = NOW()::text WHERE id = $1", [id]);
  await recordEvent("agreement_cancelled", { agreementId: id, actor, detail: { reason } });
  await audit(actor, "financing.agreement.cancel", "financing_agreement", id, reason);
  return (await getAgreement(id))!;
}

// --------------------------------------------------------------------- payments

export async function listPayments(agreementId: number): Promise<any[]> {
  const rows = await queryAll("SELECT * FROM financing_payments WHERE agreement_id = $1 ORDER BY created_at DESC", [agreementId]) as any[];
  return rows.map((r) => ({
    id: r.id,
    paymentRef: r.payment_ref,
    agreementId: r.agreement_id,
    customerId: r.customer_id,
    branchId: r.branch_id,
    amountCents: Number(r.amount_cents),
    method: r.method,
    status: r.status,
    source: r.source,
    checkoutRequestId: r.checkout_request_id,
    mpesaReceipt: r.mpesa_receipt,
    mpesaPhone: r.mpesa_phone,
    transactionRef: r.transaction_ref,
    notes: r.notes,
    initiatedAt: r.initiated_at,
    completedAt: r.completed_at,
    createdAt: r.created_at,
  }));
}

export async function getPaymentById(id: number): Promise<any | undefined> {
  const r = await queryOne("SELECT * FROM financing_payments WHERE id = $1", [id]) as any;
  if (!r) return undefined;
  return {
    id: r.id,
    paymentRef: r.payment_ref,
    agreementId: r.agreement_id,
    customerId: r.customer_id,
    branchId: r.branch_id,
    amountCents: Number(r.amount_cents),
    method: r.method,
    status: r.status,
    source: r.source,
    checkoutRequestId: r.checkout_request_id,
    mpesaReceipt: r.mpesa_receipt,
    mpesaPhone: r.mpesa_phone,
    transactionRef: r.transaction_ref,
    notes: r.notes,
    initiatedAt: r.initiated_at,
    completedAt: r.completed_at,
    createdAt: r.created_at,
  };
}

interface RecalcResult { totalPaidCents: number; outstandingCents: number; waivedCents: number; creditCents: number; }

async function recalcAgreement(client: any, agreementId: number): Promise<RecalcResult> {
  const r = (await client.query(
    "SELECT COALESCE(SUM(amount_paid_cents),0) AS paid, COALESCE(SUM(waived_cents),0) AS waived FROM financing_schedules WHERE agreement_id = $1",
    [agreementId]
  )).rows[0];
  const totalPaidCents = Number(r.paid);
  const waivedCents = Number(r.waived);
  const a = (await client.query("SELECT financed_balance_cents FROM financing_agreements WHERE id = $1", [agreementId])).rows[0];
  const outstanding = Math.max(0, Number(a.financed_balance_cents) - totalPaidCents - waivedCents);
  // Credit is derived from the ledger (received cash minus applied allocations),
  // never read back from the row: reversing a payment must drop its overpayment.
  const received = (await client.query(
    "SELECT COALESCE(SUM(amount_cents),0) AS received FROM financing_payments WHERE agreement_id = $1 AND status = 'succeeded'",
    [agreementId]
  )).rows[0];
  const creditCents = Math.max(0, Number(received.received) - totalPaidCents);
  return { totalPaidCents, outstandingCents: outstanding, waivedCents, creditCents };
}

async function applySucceededPayment(client: any, paymentId: number): Promise<{ status: string; outstandingCents: number }> {
  const pay = (await client.query("SELECT * FROM financing_payments WHERE id = $1 FOR UPDATE", [paymentId])).rows[0];
  if (!pay) throw new Error("Payment not found");
  if (pay.status === "succeeded") {
    const cur = (await client.query("SELECT outstanding_cents FROM financing_agreements WHERE id = $1", [pay.agreement_id])).rows[0];
    return { status: "already", outstandingCents: Number(cur.outstanding_cents) };
  }
  const agreement = (await client.query("SELECT * FROM financing_agreements WHERE id = $1 FOR UPDATE", [pay.agreement_id])).rows[0];
  const scheduleRows = (await client.query("SELECT * FROM financing_schedules WHERE agreement_id = $1 ORDER BY sequence FOR UPDATE", [pay.agreement_id])).rows;
  const schedules: AllocatableSchedule[] = scheduleRows.map((s: any) => ({
    id: s.id,
    sequence: Number(s.sequence),
    dueDate: s.due_date,
    amountCents: Number(s.amount_cents),
    amountPaidCents: Number(s.amount_paid_cents),
    status: s.status,
  }));
  // Waived amounts reduce the collectible portion of a schedule.
  for (let i = 0; i < schedules.length; i++) {
    const w = Number(scheduleRows[i].waived_cents || 0);
    if (w > 0) schedules[i].amountCents = Math.max(0, schedules[i].amountCents - w);
  }

  const available = Number(pay.amount_cents) + Number(agreement.credit_cents || 0);
  const alloc = allocatePayment(schedules, available);
  const updates = applyAllocations(schedules, alloc.allocations);
  for (const u of updates) {
    await client.query(
      "UPDATE financing_schedules SET amount_paid_cents = $1, status = $2, paid_at = CASE WHEN $2 = 'paid' THEN COALESCE(paid_at, NOW()::text) ELSE paid_at END WHERE id = $3",
      [u.amountPaidCents, u.status, u.id]
    );
  }
  for (const a of alloc.allocations) {
    await client.query("INSERT INTO financing_payment_allocations (payment_id, schedule_id, amount_cents) VALUES ($1,$2,$3)", [paymentId, a.scheduleId, a.amountCents]);
  }
  await client.query("UPDATE financing_payments SET status = 'succeeded', completed_at = COALESCE(completed_at, NOW()::text) WHERE id = $1", [paymentId]);

  const rec = await recalcAgreement(client, pay.agreement_id);
  const completed = rec.outstandingCents <= 0;
  await client.query(
    "UPDATE financing_agreements SET total_paid_cents = $1, outstanding_cents = $2, credit_cents = $3, status = CASE WHEN $2 <= 0 AND status = 'active' THEN 'completed' ELSE status END, ownership_status = CASE WHEN $2 <= 0 THEN 'transferred' ELSE ownership_status END, completed_at = CASE WHEN $2 <= 0 THEN COALESCE(completed_at, NOW()::text) ELSE completed_at END, updated_at = NOW()::text WHERE id = $4",
    [rec.totalPaidCents, rec.outstandingCents, rec.creditCents, pay.agreement_id]
  );
  return { status: completed ? "completed" : "succeeded", outstandingCents: rec.outstandingCents };
}

export interface RecordPaymentInput {
  amountCents: number;
  method: FinancingPaymentMethod;
  source?: FinancingPaymentSource;
  notes?: string;
  branchId?: number | null;
  transactionRef?: string | null;
  targetScheduleId?: number | null;
  mpesaReceipt?: string | null;
  mpesaPhone?: string | null;
  checkoutRequestId?: string | null;
}

export async function recordPayment(agreementId: number, input: RecordPaymentInput, actor: Actor): Promise<any> {
  const config = await getFinancingConfig();
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error("amountCents must be a positive integer");
  if (!config.allowedPaymentMethods.includes(input.method)) throw new Error(`Payment method "${input.method}" is not allowed`);
  const agr = await getAgreement(agreementId);
  if (!agr) throw new Error("Agreement not found");
  if (agr.status === "cancelled") throw new Error("Cannot pay a cancelled agreement");

  const paymentId = await transaction(async (client) => {
    const payRes = await client.query(
      `INSERT INTO financing_payments (payment_ref, agreement_id, customer_id, branch_id, amount_cents, method, status, source, transaction_ref, mpesa_receipt, mpesa_phone, notes, received_by, initiated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9,$10,$11,$12,NOW()::text) RETURNING id`,
      [
        generatePaymentRef(), agreementId, agr.customerId, input.branchId ?? agr.branchId ?? null, input.amountCents,
        input.method, input.source || "admin", input.transactionRef ?? null, input.mpesaReceipt ?? null, input.mpesaPhone ?? null,
        input.notes ?? "", actor.id,
      ]
    );
    const pid = payRes.rows[0].id;
    await applySucceededPayment(client, pid);
    return pid;
  }).catch(async (err) => {
    // Unique M-Pesa receipt -> an idempotent replay. Return the existing payment.
    const existing = input.mpesaReceipt
      ? await queryOne("SELECT id FROM financing_payments WHERE mpesa_receipt = $1", [input.mpesaReceipt])
      : null;
    if (existing) return (existing as any).id as number;
    throw err;
  });

  await recordEvent("payment_received", { agreementId, actor, detail: { amountCents: input.amountCents, method: input.method } });
  await recordEvent("payment_allocated", { agreementId, actor, detail: { paymentId } });
  await audit(actor, "financing.payment.create", "financing_payment", paymentId, `${input.method} ${fromCents(input.amountCents)}`);
  const updated = await getAgreement(agreementId);
  if (updated && updated.status === "completed") {
    await recordEvent("agreement_completed", { agreementId, actor });
    await notifyCustomer(agr, "financing.agreement.completed", `Your agreement ${agr.agreementNumber} is fully paid. Ownership has been transferred to you.`);
  }
  return updated;
}

export interface InitiateMpesaInput { phone: string; amountCents: number; source?: FinancingPaymentSource; }

/** Starts an STK push. Never marks anything paid - only the callback does. */
export async function initiateMpesaPayment(agreementId: number, input: InitiateMpesaInput, actor: Actor, callbackBase: string): Promise<any> {
  const config = await getFinancingConfig();
  if (!config.allowedPaymentMethods.includes("mpesa")) throw new Error("M-Pesa is not an allowed financing payment method");
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error("amountCents must be a positive integer");
  const agr = await getAgreement(agreementId);
  if (!agr) throw new Error("Agreement not found");
  if (agr.status === "cancelled") throw new Error("Cannot pay a cancelled agreement");
  const norm = normalizeDarajaPhone(input.phone);
  if (!norm.ok) throw new Error(norm.error || "Invalid phone number");

  const accountRef = `HP${agreementId}`.slice(0, 12);
  const resp = await stkPush(norm.phone!, fromCents(input.amountCents), accountRef, `${callbackBase.replace(/\/$/, "")}/api/mpesa/callback`);
  const checkoutRequestId = resp?.CheckoutRequestID || resp?.checkoutRequestId || null;
  const merchantRequestId = resp?.MerchantRequestID || resp?.merchantRequestId || null;

  const paymentId = await transaction(async (client) => {
    const payRes = await client.query(
      `INSERT INTO financing_payments (payment_ref, agreement_id, customer_id, branch_id, amount_cents, method, status, source, checkout_request_id, merchant_request_id, mpesa_phone, received_by, initiated_at)
       VALUES ($1,$2,$3,$4,$5,'mpesa','initiated',$6,$7,$8,$9,$10,NOW()::text) RETURNING id`,
      [generatePaymentRef(), agreementId, agr.customerId, agr.branchId ?? null, input.amountCents, input.source || "portal", checkoutRequestId, merchantRequestId, norm.phone!, actor.id]
    );
    return payRes.rows[0].id;
  });
  await recordEvent("payment_initiated", { agreementId, actor, detail: { paymentId, amountCents: input.amountCents } });
  return { paymentId, checkoutRequestId, merchantRequestId, simulated: !!resp?.simulated, customerMessage: resp?.CustomerMessage || resp?.customerMessage };
}

/**
 * Applies a verified M-Pesa callback to a financing payment. Idempotent on the
 * checkout request id and the Safaricom receipt. Returns handled=false when the
 * checkout does not belong to financing (so the caller falls through to orders).
 */
export async function applyMpesaCallback(
  checkoutRequestId: string,
  resultCode: number,
  receipt?: string | null,
  paidAmountKes?: number | null
): Promise<{ handled: boolean; ok: boolean; reason?: string; status?: string }> {
  const pay = await queryOne("SELECT * FROM financing_payments WHERE checkout_request_id = $1", [checkoutRequestId]) as any;
  if (!pay) return { handled: false, ok: true };
  if (pay.status === "succeeded") return { handled: true, ok: true, status: "already" };

  if (resultCode !== 0) {
    await query("UPDATE financing_payments SET status = 'failed' WHERE id = $1 AND status <> 'succeeded'", [pay.id]);
    await recordEvent("payment_failed", { agreementId: pay.agreement_id, detail: { checkoutRequestId, resultCode } });
    return { handled: true, ok: true, status: "failed" };
  }
  if (!receipt) {
    return { handled: true, ok: true, reason: "missing_receipt" };
  }
  if (paidAmountKes != null && toCents(paidAmountKes) !== Number(pay.amount_cents)) {
    // Never credit a mismatched amount; keep pending for manual reconciliation.
    await query("UPDATE financing_payments SET status = 'pending', mpesa_receipt = $1, notes = COALESCE(notes,'') || ' [amount mismatch]' WHERE id = $2", [receipt, pay.id]);
    return { handled: true, ok: true, reason: "amount_mismatch" };
  }
  try {
    await query("UPDATE financing_payments SET mpesa_receipt = $1 WHERE id = $2 AND status <> 'succeeded'", [receipt, pay.id]);
    await transaction(async (client) => {
      await applySucceededPayment(client, pay.id);
    });
    await recordEvent("payment_received", { agreementId: pay.agreement_id, detail: { method: "mpesa", receipt } });
    const updated = await getAgreement(pay.agreement_id);
    if (updated && updated.status === "completed") {
      await recordEvent("agreement_completed", { agreementId: pay.agreement_id });
    }
    return { handled: true, ok: true, status: "succeeded" };
  } catch (err: any) {
    if (String(err?.message || "").includes("uq_fin_pay_receipt")) {
      return { handled: true, ok: true, status: "already" };
    }
    throw err;
  }
}

/** Appends a waiver/adjustment. Append-only - schedules are updated, never deleted. */
export async function recordAdjustment(agreementId: number, kind: string, amountCents: number, reason: string, actor: Actor): Promise<any> {
  if (!Number.isInteger(amountCents) || amountCents === 0) throw new Error("amountCents must be a non-zero integer");
  const agr = await getAgreement(agreementId);
  if (!agr) throw new Error("Agreement not found");
  await transaction(async (client) => {
    await client.query(
      "INSERT INTO financing_adjustments (agreement_id, kind, amount_cents, reason, actor_id) VALUES ($1,$2,$3,$4,$5)",
      [agreementId, kind, amountCents, reason, actor.id]
    );
    if (kind === "waiver" && amountCents > 0) {
      // Waive from the oldest outstanding schedule forward.
      const rows = (await client.query("SELECT * FROM financing_schedules WHERE agreement_id = $1 ORDER BY sequence", [agreementId])).rows;
      let remaining = amountCents;
      for (const s of rows) {
        if (remaining <= 0) break;
        const collectible = Math.max(0, Number(s.amount_cents) - Number(s.amount_paid_cents) - Number(s.waived_cents || 0));
        const take = Math.min(remaining, collectible);
        if (take > 0) {
          const newWaived = Number(s.waived_cents || 0) + take;
          const settled = Number(s.amount_paid_cents) + newWaived >= Number(s.amount_cents);
          await client.query("UPDATE financing_schedules SET waived_cents = $1, status = $2 WHERE id = $3", [newWaived, settled ? "paid" : s.status, s.id]);
          remaining -= take;
        }
      }
    }
    const rec = await recalcAgreement(client, agreementId);
    await client.query("UPDATE financing_agreements SET total_paid_cents = $1, outstanding_cents = $2, updated_at = NOW()::text WHERE id = $3", [rec.totalPaidCents, rec.outstandingCents, agreementId]);
  });
  await recordEvent("payment_allocated", { agreementId, actor, detail: { kind, amountCents } });
  await audit(actor, "financing.adjustment.create", "financing_agreement", agreementId, `${kind} ${fromCents(amountCents)}: ${reason}`);
  return (await getAgreement(agreementId))!;
}

/** Reverses a succeeded payment by appending reversal allocations; rows are never deleted. */
export async function reversePayment(paymentId: number, reason: string, actor: Actor): Promise<any> {
  const pay = await queryOne("SELECT * FROM financing_payments WHERE id = $1", [paymentId]) as any;
  if (!pay) throw new Error("Payment not found");
  if (pay.status !== "succeeded") throw new Error("Only a succeeded payment can be reversed");
  await transaction(async (client) => {
    const allocs = (await client.query("SELECT * FROM financing_payment_allocations WHERE payment_id = $1", [paymentId])).rows;
    for (const a of allocs) {
      const s = (await client.query("SELECT * FROM financing_schedules WHERE id = $1 FOR UPDATE", [a.schedule_id])).rows[0];
      const newPaid = Math.max(0, Number(s.amount_paid_cents) - Number(a.amount_cents));
      const status = newPaid >= Number(s.amount_cents) ? "paid" : newPaid > 0 ? "partially_paid" : "pending";
      await client.query("UPDATE financing_schedules SET amount_paid_cents = $1, status = $2, paid_at = CASE WHEN $1 = 0 THEN NULL ELSE paid_at END WHERE id = $3", [newPaid, status, a.schedule_id]);
      await client.query("INSERT INTO financing_adjustments (agreement_id, payment_id, kind, amount_cents, reason, actor_id) VALUES ($1,$2,'reversal',$3,$4,$5)", [pay.agreement_id, paymentId, -Number(a.amount_cents), reason, actor.id]);
    }
    await client.query("UPDATE financing_payments SET status = 'reversed' WHERE id = $1", [paymentId]);
    const rec = await recalcAgreement(client, pay.agreement_id);
    await client.query(
      "UPDATE financing_agreements SET total_paid_cents = $1, outstanding_cents = $2, credit_cents = $3, status = CASE WHEN status = 'completed' THEN 'active' ELSE status END, ownership_status = CASE WHEN $2 > 0 THEN 'seller' ELSE ownership_status END, updated_at = NOW()::text WHERE id = $4",
      [rec.totalPaidCents, rec.outstandingCents, rec.creditCents, pay.agreement_id]
    );
  });
  await recordEvent("payment_reversed", { agreementId: pay.agreement_id, actor, detail: { paymentId, reason } });
  await audit(actor, "financing.payment.reverse", "financing_payment", paymentId, reason);
  return (await getAgreement(pay.agreement_id))!;
}

// ------------------------------------------------------------------- reporting

export interface FinancingStats {
  enabled: boolean;
  currency: string;
  applications: { total: number; pending: number; approved: number; rejected: number };
  agreements: { active: number; completed: number; cancelled: number; overdue: number };
  totals: { financedCents: number; collectedCents: number; outstandingCents: number; overdueCents: number };
}

export async function getFinancingStats(branchId?: number | null): Promise<FinancingStats> {
  const config = await getFinancingConfig();
  const b = branchId ? " AND branch_id = $1" : "";
  const params = branchId ? [branchId] : [];
  const apps = (await queryOne(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status IN ('submitted','under_review')) AS pending, COUNT(*) FILTER (WHERE status = 'approved') AS approved, COUNT(*) FILTER (WHERE status = 'rejected') AS rejected FROM financing_applications WHERE 1=1${b}`, params)) as any;
  const agr = (await queryOne(`SELECT COUNT(*) FILTER (WHERE status = 'active') AS active, COUNT(*) FILTER (WHERE status = 'completed') AS completed, COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled, COALESCE(SUM(financed_balance_cents) FILTER (WHERE status = 'active'),0) AS financed, COALESCE(SUM(total_paid_cents),0) AS collected, COALESCE(SUM(outstanding_cents) FILTER (WHERE status = 'active'),0) AS outstanding FROM financing_agreements WHERE 1=1${b}`, params)) as any;
  const overdue = (await queryOne(
    `SELECT COUNT(DISTINCT a.id) AS c, COALESCE(SUM(s.amount_cents - s.amount_paid_cents - s.waived_cents),0) AS amt
     FROM financing_agreements a JOIN financing_schedules s ON s.agreement_id = a.id
     WHERE a.status = 'active' AND s.due_date < $${params.length + 1} AND s.status NOT IN ('paid','waived','cancelled')${branchId ? " AND a.branch_id = $1" : ""}`,
    [...params, todayIso()]
  )) as any;
  return {
    enabled: config.enabled,
    currency: config.currency,
    applications: { total: Number(apps.total), pending: Number(apps.pending), approved: Number(apps.approved), rejected: Number(apps.rejected) },
    agreements: { active: Number(agr.active), completed: Number(agr.completed), cancelled: Number(agr.cancelled), overdue: Number(overdue.c) },
    totals: { financedCents: Number(agr.financed), collectedCents: Number(agr.collected), outstandingCents: Number(agr.outstanding), overdueCents: Number(overdue.amt) },
  };
}

export interface FinancingReport {
  currency: string;
  period: { from: string; to: string };
  summary: {
    agreements: number; active: number; completed: number; cancelled: number;
    hpCents: number; depositCents: number; collectedCents: number; outstandingCents: number;
    overdueAgreements: number; overdueCents: number;
  };
  statuses: { status: string; count: number; financedCents: number; outstandingCents: number }[];
  frequencies: { frequency: string; count: number; instalmentCents: number }[];
  aging: { currentCents: number; overdue1to7Cents: number; overdue8to30Cents: number; overdue31PlusCents: number };
  arrears: { id: number; agreementNumber: string; customer: string; outstandingCents: number; overdueCents: number; overdueCount: number; oldestDue: string | null }[];
}

export async function getFinancingReport(filters: { from?: string; to?: string; branchId?: number | null } = {}): Promise<FinancingReport> {
  const config = await getFinancingConfig();
  const isDate = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v));
  const from = isDate(filters.from) ? String(filters.from) : "1900-01-01";
  const to = isDate(filters.to) ? String(filters.to) : todayIso();
  const branchId = filters.branchId && Number.isFinite(Number(filters.branchId)) ? Number(filters.branchId) : null;
  const today = todayIso();

  const summary = (await queryOne(
    `SELECT COUNT(*) AS agreements,
       COUNT(*) FILTER (WHERE status = 'active') AS active,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed,
       COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
       COALESCE(SUM(hp_price_cents),0) AS hp,
       COALESCE(SUM(deposit_cents),0) AS deposits,
       COALESCE(SUM(total_paid_cents),0) AS collected,
       COALESCE(SUM(outstanding_cents),0) AS outstanding
     FROM financing_agreements
     WHERE created_at::date BETWEEN $1 AND $2${branchId ? " AND branch_id = $3" : ""}`,
    branchId ? [from, to, branchId] : [from, to]
  )) as any;

  const statuses = (await queryAll(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(financed_balance_cents),0) AS financed, COALESCE(SUM(outstanding_cents),0) AS outstanding
     FROM financing_agreements
     WHERE created_at::date BETWEEN $1 AND $2${branchId ? " AND branch_id = $3" : ""}
     GROUP BY status ORDER BY count DESC`,
    branchId ? [from, to, branchId] : [from, to]
  )) as any[];

  const frequencies = (await queryAll(
    `SELECT frequency, COUNT(*) AS count, COALESCE(SUM(instalment_cents),0) AS instalment
     FROM financing_agreements
     WHERE created_at::date BETWEEN $1 AND $2${branchId ? " AND branch_id = $3" : ""}
     GROUP BY frequency ORDER BY count DESC`,
    branchId ? [from, to, branchId] : [from, to]
  )) as any[];

  const bal = "(s.amount_cents - s.amount_paid_cents - s.waived_cents)";
  const aging = (await queryOne(
    `SELECT
       COALESCE(SUM(CASE WHEN s.due_date::date >= $1::date THEN ${bal} END),0) AS current,
       COALESCE(SUM(CASE WHEN s.due_date::date < $1::date AND s.due_date::date >= $1::date - 7 THEN ${bal} END),0) AS o1,
       COALESCE(SUM(CASE WHEN s.due_date::date < $1::date - 7 AND s.due_date::date >= $1::date - 30 THEN ${bal} END),0) AS o2,
       COALESCE(SUM(CASE WHEN s.due_date::date < $1::date - 30 THEN ${bal} END),0) AS o3
     FROM financing_schedules s JOIN financing_agreements a ON a.id = s.agreement_id
     WHERE a.status = 'active' AND s.status NOT IN ('paid','waived','cancelled')${branchId ? " AND a.branch_id = $2" : ""}`,
    branchId ? [today, branchId] : [today]
  )) as any;

  const overdueAgreements = (await queryOne(
    `SELECT COUNT(DISTINCT a.id) AS c
     FROM financing_agreements a JOIN financing_schedules s ON s.agreement_id = a.id
     WHERE a.status = 'active' AND s.due_date < $1 AND s.status NOT IN ('paid','waived','cancelled')${branchId ? " AND a.branch_id = $2" : ""}`,
    branchId ? [today, branchId] : [today]
  )) as any;

  const arrears = (await queryAll(
    `SELECT a.id, a.agreement_number, COALESCE(c.name,'') AS customer, a.outstanding_cents,
       COALESCE(SUM(${bal}),0) AS overdue_cents, COUNT(*) AS overdue_count, MIN(s.due_date) AS oldest_due
     FROM financing_agreements a
     JOIN financing_schedules s ON s.agreement_id = a.id
     LEFT JOIN customers c ON c.id = a.customer_id
     WHERE a.status = 'active' AND s.due_date < $1 AND s.status NOT IN ('paid','waived','cancelled')${branchId ? " AND a.branch_id = $2" : ""}
     GROUP BY a.id, a.agreement_number, c.name, a.outstanding_cents
     ORDER BY overdue_cents DESC LIMIT 100`,
    branchId ? [today, branchId] : [today]
  )) as any[];

  return {
    currency: config.currency,
    period: { from, to },
    summary: {
      agreements: Number(summary.agreements),
      active: Number(summary.active),
      completed: Number(summary.completed),
      cancelled: Number(summary.cancelled),
      hpCents: Number(summary.hp),
      depositCents: Number(summary.deposits),
      collectedCents: Number(summary.collected),
      outstandingCents: Number(summary.outstanding),
      overdueAgreements: Number(overdueAgreements.c),
      overdueCents: Number(aging.o1) + Number(aging.o2) + Number(aging.o3),
    },
    statuses: statuses.map((r) => ({ status: r.status, count: Number(r.count), financedCents: Number(r.financed), outstandingCents: Number(r.outstanding) })),
    frequencies: frequencies.map((r) => ({ frequency: r.frequency, count: Number(r.count), instalmentCents: Number(r.instalment) })),
    aging: { currentCents: Number(aging.current), overdue1to7Cents: Number(aging.o1), overdue8to30Cents: Number(aging.o2), overdue31PlusCents: Number(aging.o3) },
    arrears: arrears.map((r) => ({
      id: r.id, agreementNumber: r.agreement_number, customer: r.customer,
      outstandingCents: Number(r.outstanding_cents), overdueCents: Number(r.overdue_cents),
      overdueCount: Number(r.overdue_count), oldestDue: r.oldest_due || null,
    })),
  };
}

/** Recomputes pending -> due -> overdue labels for active agreements. */
export async function refreshOverdueStatuses(): Promise<number> {
  const today = todayIso();
  const res = await query(
    `UPDATE financing_schedules SET status = 'overdue'
     WHERE due_date < $1 AND status IN ('pending','due','partially_paid')
       AND EXISTS (SELECT 1 FROM financing_agreements a WHERE a.id = financing_schedules.agreement_id AND a.status = 'active')`,
    [today]
  );
  return res.rowCount ?? 0;
}

// ----------------------------------------------------------------- notifications

async function notifyCustomer(app: { customerId: number; customerName: string; customerEmail?: string; customerPhone?: string }, event: string, body: string): Promise<void> {
  try {
    await notify({
      event: event as any,
      entityType: "financing",
      entityId: app.customerId,
      subject: "Lipa Mdogo Mdogo",
      bodyText: body,
      recipientEmail: app.customerEmail,
      recipientPhone: app.customerPhone,
      audience: "customer",
      customerId: app.customerId,
      recipientName: app.customerName,
    });
  } catch (err: any) {
    console.warn("[financing] notify failed:", err?.message || err);
  }
}
