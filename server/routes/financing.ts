// Financing (Lipa Mdogo Mdogo) HTTP routes.
//
// Mounted at /api/financing. Staff routes require a financing permission;
// customer routes are scoped to the signed-in customer. All money math is done
// server-side by the financing services - request bodies only carry intent.

import { Router, Request, Response } from "express";
import { staffAuthMiddleware, customerAuthMiddleware } from "../auth";
import { asyncHandler, requirePermission, isPosInt, isStr } from "./shared";
import { callbackBaseUrl } from "../mpesa";
import { getProduct } from "../db";
import { getFinancingConfig, saveFinancingConfig, isFrequency } from "../financing/config";
import { calculateFinancing, resolveDeposit } from "../financing/calculator";
import { toCents } from "../financing/types";
import type { FinancingPaymentMethod } from "../financing/types";
import {
  createApplication,
  getApplication,
  listApplications,
  updateApplication,
  submitApplication,
  reviewApplication,
  getAgreement,
  listAgreements,
  listAgreementsForCustomer,
  releaseProduct,
  cancelAgreement,
  recordPayment,
  initiateMpesaPayment,
  recordAdjustment,
  reversePayment,
  getFinancingStats,
  refreshOverdueStatuses,
  type Actor,
} from "../financing/service";

const router = Router();

const PAYMENT_METHODS: FinancingPaymentMethod[] = ["mpesa", "cash", "card", "bank", "adjustment", "other"];

function staffActor(req: Request): Actor {
  const u = (req as any).user || {};
  return { id: u.sub ?? null, name: u.username || u.email || "staff", type: "staff" };
}

function customerActor(req: Request): Actor {
  const c = (req as any).customer || {};
  return { id: c.sub ?? null, name: c.name || c.email || "customer", type: "customer" };
}

function parsePositiveIntCents(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new Error("Invalid amount");
  return Math.round(n);
}

// ---------------------------------------------------------------- public options

router.get("/options", asyncHandler(async (_req: Request, res: Response) => {
  const config = await getFinancingConfig();
  res.json({
    enabled: config.enabled,
    currency: config.currency,
    permittedFrequencies: config.permittedFrequencies,
    minTerm: config.minTerm,
    maxTerm: config.maxTerm,
    minDepositCents: config.minDepositCents,
    depositPercentMin: config.depositPercentMin,
    depositPercentMax: config.depositPercentMax,
    chargeModel: config.chargeModel,
    chargeFixedCents: config.chargeFixedCents,
    chargePercent: config.chargePercent,
    allowedPaymentMethods: config.allowedPaymentMethods,
    onlineApplicationAllowed: config.onlineApplicationAllowed,
  });
}));

// Read-only storefront preview. No customer data, no persistence - used to show
// "from KES x/week" on a product page and to seed an application form.
router.get("/public/quote", asyncHandler(async (req: Request, res: Response) => {
  const config = await getFinancingConfig();
  if (!config.enabled) { res.status(403).json({ error: "Financing is not available" }); return; }
  const productId = typeof req.query.productId === "string" ? req.query.productId : "";
  if (!productId) { res.status(400).json({ error: "productId is required" }); return; }
  const product = await getProduct(productId);
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  const cashPriceCents = toCents(product.salePrice && product.salePrice > 0 ? product.salePrice : product.price);
  const frequency = isFrequency(req.query.frequency) ? req.query.frequency : config.permittedFrequencies[0];
  const termCount = Math.min(Math.max(Number(req.query.termCount) || config.minTerm, config.minTerm), config.maxTerm);
  const depositPercent = config.depositPercentMin ?? 0;
  const depositCents = resolveDeposit(cashPriceCents, null, depositPercent);
  const quote = calculateFinancing({
    cashPriceCents,
    depositCents,
    chargeModel: config.chargeModel,
    chargeFixedCents: config.chargeFixedCents,
    chargePercent: config.chargePercent,
    frequency,
    intervalDays: null,
    termCount,
    startDate: new Date().toISOString().slice(0, 10),
    firstDueDate: null,
  });
  res.json({ ...quote, depositPercent, currency: config.currency, possessionModel: config.possessionModel });
}));

// ------------------------------------------------------------------- config

router.get("/config", staffAuthMiddleware, requirePermission("financing:view"), asyncHandler(async (_req: Request, res: Response) => {
  res.json(await getFinancingConfig());
}));

router.put("/config", staffAuthMiddleware, requirePermission("financing:manage"), asyncHandler(async (req: Request, res: Response) => {
  res.json(await saveFinancingConfig(req.body || {}));
}));

router.get("/stats", staffAuthMiddleware, requirePermission("financing:view"), asyncHandler(async (req: Request, res: Response) => {
  const branchId = req.query.branchId ? Number(req.query.branchId) : null;
  res.json(await getFinancingStats(branchId && Number.isFinite(branchId) ? branchId : null));
}));

router.post("/refresh-overdue", staffAuthMiddleware, requirePermission("financing:manage"), asyncHandler(async (_req: Request, res: Response) => {
  const updated = await refreshOverdueStatuses();
  res.json({ updated });
}));

// --------------------------------------------------------------- quote preview

router.post("/quote", staffAuthMiddleware, requirePermission("financing:view"), asyncHandler(async (req: Request, res: Response) => {
  const config = await getFinancingConfig();
  const body = req.body || {};
  let cashPriceCents: number;
  if (body.productId && isStr(body.productId, 100)) {
    const product = await getProduct(body.productId);
    if (!product) { res.status(404).json({ error: "Product not found" }); return; }
    cashPriceCents = toCents(product.salePrice && product.salePrice > 0 ? product.salePrice : product.price);
  } else {
    cashPriceCents = parsePositiveIntCents(body.cashPriceCents);
  }
  const depositCents = body.depositPercent != null
    ? resolveDeposit(cashPriceCents, null, Number(body.depositPercent))
    : body.depositCents != null ? resolveDeposit(cashPriceCents, parsePositiveIntCents(body.depositCents)) : 0;
  const frequency = isFrequency(body.frequency) ? body.frequency : config.permittedFrequencies[0];
  const quote = calculateFinancing({
    cashPriceCents,
    depositCents,
    chargeModel: body.chargeModel || config.chargeModel,
    chargeFixedCents: body.chargeFixedCents ?? config.chargeFixedCents,
    chargePercent: body.chargePercent ?? config.chargePercent,
    frequency,
    intervalDays: body.intervalDays ?? null,
    termCount: Number(body.termCount) || config.minTerm,
    startDate: body.startDate || new Date().toISOString().slice(0, 10),
    firstDueDate: body.firstDueDate ?? null,
  });
  res.json(quote);
}));

// --------------------------------------------------------------- applications

router.get("/applications", staffAuthMiddleware, requirePermission("financing:view"), asyncHandler(async (req: Request, res: Response) => {
  const filters: any = {};
  if (req.query.status) filters.status = String(req.query.status);
  if (req.query.customerId) filters.customerId = Number(req.query.customerId);
  if (req.query.branchId) filters.branchId = Number(req.query.branchId);
  res.json(await listApplications(filters));
}));

router.post("/applications", staffAuthMiddleware, requirePermission("financing:manage"), asyncHandler(async (req: Request, res: Response) => {
  const b = req.body || {};
  if (!isPosInt(b.customerId)) { res.status(400).json({ error: "customerId is required" }); return; }
  const app = await createApplication({
    customerId: b.customerId,
    productId: b.productId || null,
    productName: b.productName || "",
    serialNumber: b.serialNumber || "",
    cashPriceCents: b.cashPriceCents != null ? parsePositiveIntCents(b.cashPriceCents) : undefined,
    depositCents: b.depositCents != null ? parsePositiveIntCents(b.depositCents) : undefined,
    depositPercent: b.depositPercent != null ? Number(b.depositPercent) : undefined,
    chargeModel: b.chargeModel,
    chargeFixedCents: b.chargeFixedCents,
    chargePercent: b.chargePercent,
    frequency: b.frequency,
    intervalDays: b.intervalDays ?? null,
    termCount: Number(b.termCount),
    startDate: b.startDate,
    firstDueDate: b.firstDueDate ?? null,
    possessionModel: b.possessionModel,
    possessionThresholdCents: b.possessionThresholdCents,
    guarantorName: b.guarantorName,
    guarantorPhone: b.guarantorPhone,
    customerNationalId: b.customerNationalId,
    notes: b.notes,
    consent: b.consent === true,
    branchId: b.branchId ?? null,
    status: "draft",
  }, staffActor(req));
  if (b.submit === true && app.status === "draft") {
    const submitted = await submitApplication(app.id, staffActor(req));
    res.status(201).json(submitted);
    return;
  }
  res.status(201).json(app);
}));

router.get("/applications/:id", staffAuthMiddleware, requirePermission("financing:view"), asyncHandler(async (req: Request, res: Response) => {
  const app = await getApplication(Number(req.params.id));
  if (!app) { res.status(404).json({ error: "Application not found" }); return; }
  res.json(app);
}));

router.patch("/applications/:id", staffAuthMiddleware, requirePermission("financing:manage"), asyncHandler(async (req: Request, res: Response) => {
  res.json(await updateApplication(Number(req.params.id), req.body || {}, staffActor(req)));
}));

router.post("/applications/:id/submit", staffAuthMiddleware, requirePermission("financing:manage"), asyncHandler(async (req: Request, res: Response) => {
  res.json(await submitApplication(Number(req.params.id), staffActor(req)));
}));

router.post("/applications/:id/approve", staffAuthMiddleware, requirePermission("financing:approve"), asyncHandler(async (req: Request, res: Response) => {
  const approve = req.body?.approve !== false;
  res.json(await reviewApplication(Number(req.params.id), approve, staffActor(req), String(req.body?.reason || "")));
}));

// ---------------------------------------------------------------- agreements

router.get("/agreements", staffAuthMiddleware, requirePermission("financing:view"), asyncHandler(async (req: Request, res: Response) => {
  const filters: any = {};
  if (req.query.status) filters.status = String(req.query.status);
  if (req.query.customerId) filters.customerId = Number(req.query.customerId);
  if (req.query.branchId) filters.branchId = Number(req.query.branchId);
  if (req.query.overdue === "true") filters.overdue = true;
  res.json(await listAgreements(filters));
}));

router.get("/agreements/:id", staffAuthMiddleware, requirePermission("financing:view"), asyncHandler(async (req: Request, res: Response) => {
  const agr = await getAgreement(Number(req.params.id));
  if (!agr) { res.status(404).json({ error: "Agreement not found" }); return; }
  res.json(agr);
}));

router.post("/agreements/:id/release", staffAuthMiddleware, requirePermission("financing:manage"), asyncHandler(async (req: Request, res: Response) => {
  res.json(await releaseProduct(Number(req.params.id), staffActor(req)));
}));

router.post("/agreements/:id/cancel", staffAuthMiddleware, requirePermission("financing:manage"), asyncHandler(async (req: Request, res: Response) => {
  res.json(await cancelAgreement(Number(req.params.id), staffActor(req), String(req.body?.reason || "")));
}));

router.post("/agreements/:id/payments", staffAuthMiddleware, requirePermission("financing:payment"), asyncHandler(async (req: Request, res: Response) => {
  const b = req.body || {};
  const method: FinancingPaymentMethod = PAYMENT_METHODS.includes(b.method) ? b.method : "cash";
  const result = await recordPayment(Number(req.params.id), {
    amountCents: parsePositiveIntCents(b.amountCents),
    method,
    source: ["pos", "portal", "admin", "system"].includes(b.source) ? b.source : "admin",
    notes: isStr(b.notes, 1000) ? b.notes : "",
    branchId: b.branchId != null ? Number(b.branchId) : null,
    transactionRef: b.transactionRef || null,
    mpesaReceipt: b.mpesaReceipt || null,
    mpesaPhone: b.mpesaPhone || null,
  }, staffActor(req));
  res.status(201).json(result);
}));

router.post("/agreements/:id/adjustments", staffAuthMiddleware, requirePermission("financing:payment"), asyncHandler(async (req: Request, res: Response) => {
  const b = req.body || {};
  if (!isStr(b.kind, 40) || !isStr(b.reason, 1000)) { res.status(400).json({ error: "kind and reason are required" }); return; }
  res.status(201).json(await recordAdjustment(Number(req.params.id), b.kind, parsePositiveIntCents(b.amountCents), b.reason, staffActor(req)));
}));

router.post("/agreements/:id/mpesa", staffAuthMiddleware, requirePermission("financing:payment"), asyncHandler(async (req: Request, res: Response) => {
  const b = req.body || {};
  const result = await initiateMpesaPayment(Number(req.params.id), {
    phone: String(b.phone || ""),
    amountCents: parsePositiveIntCents(b.amountCents),
    source: ["pos", "portal", "admin"].includes(b.source) ? b.source : "admin",
  }, staffActor(req), callbackBaseUrl(req));
  res.status(201).json(result);
}));

router.post("/payments/:id/reverse", staffAuthMiddleware, requirePermission("financing:payment"), asyncHandler(async (req: Request, res: Response) => {
  res.json(await reversePayment(Number(req.params.id), String(req.body?.reason || ""), staffActor(req)));
}));

// ------------------------------------------------------------------ customer

router.get("/my/agreements", customerAuthMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const customerId = (req as any).customer?.sub;
  res.json(await listAgreementsForCustomer(Number(customerId)));
}));

router.get("/my/agreements/:id", customerAuthMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const customerId = Number((req as any).customer?.sub);
  const agr = await getAgreement(Number(req.params.id));
  if (!agr || agr.customerId !== customerId) { res.status(404).json({ error: "Agreement not found" }); return; }
  res.json(agr);
}));

router.get("/my/applications", customerAuthMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const customerId = Number((req as any).customer?.sub);
  res.json(await listApplications({ customerId }));
}));

router.post("/my/applications", customerAuthMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const config = await getFinancingConfig();
  if (!config.enabled || !config.onlineApplicationAllowed) { res.status(403).json({ error: "Online financing applications are not available" }); return; }
  const customerId = Number((req as any).customer?.sub);
  const b = req.body || {};
  const app = await createApplication({
    customerId,
    productId: b.productId || null,
    productName: b.productName || "",
    cashPriceCents: b.cashPriceCents != null ? parsePositiveIntCents(b.cashPriceCents) : undefined,
    depositCents: b.depositCents != null ? parsePositiveIntCents(b.depositCents) : undefined,
    depositPercent: b.depositPercent != null ? Number(b.depositPercent) : undefined,
    frequency: b.frequency,
    intervalDays: b.intervalDays ?? null,
    termCount: Number(b.termCount),
    startDate: b.startDate,
    guarantorName: b.guarantorName,
    guarantorPhone: b.guarantorPhone,
    customerNationalId: b.customerNationalId,
    notes: b.notes,
    consent: b.consent === true,
    status: "submitted",
  }, customerActor(req));
  res.status(201).json(app);
}));

router.post("/my/agreements/:id/mpesa", customerAuthMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const customerId = Number((req as any).customer?.sub);
  const agr = await getAgreement(Number(req.params.id));
  if (!agr || agr.customerId !== customerId) { res.status(404).json({ error: "Agreement not found" }); return; }
  const b = req.body || {};
  const result = await initiateMpesaPayment(agr.id, {
    phone: String(b.phone || ""),
    amountCents: parsePositiveIntCents(b.amountCents),
    source: "portal",
  }, customerActor(req), callbackBaseUrl(req));
  res.status(201).json(result);
}));

export default router;
