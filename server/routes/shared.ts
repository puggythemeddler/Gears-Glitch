import { Request, Response, NextFunction } from "express";

// ============ ASYNC HANDLER ============
// Wraps async route handlers so rejected promises are caught and forwarded to Express error handler
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// ============ INPUT VALIDATION HELPERS ============
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isEmail(v: unknown): boolean { return typeof v === "string" && v.length <= 320 && EMAIL_RE.test(v); }
export function isStr(v: unknown, max = 500): v is string { return typeof v === "string" && v.length > 0 && v.length <= max; }
export function isNum(v: unknown): v is number { return typeof v === "number" && isFinite(v); }
export function isInt(v: unknown): v is number { return isNum(v) && Number.isInteger(v); }
export function isPosInt(v: unknown): v is number { return isInt(v) && v > 0; }
export function isNonNegNum(v: unknown): v is number { return isNum(v) && v >= 0; }
export function isArr(v: unknown): v is unknown[] { return Array.isArray(v); }
export function inSet<T extends string>(v: unknown, set: readonly T[]): v is T { return typeof v === "string" && (set as readonly string[]).includes(v); }
export function okLen(v: unknown, min: number, max: number): boolean { return typeof v === "string" && v.length >= min && v.length <= max; }

// ============ HTML UTILITIES ============
export function escapeHtml(v: string | null | undefined): string {
  return (v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function renderStoreLogo(logoUrl: string, position: string, storeName: string): string {
  if (!logoUrl) return "";
  const pos = position || "top-left";
  if (pos === "top-left") return `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(storeName)} Logo" style="max-height:64px;max-width:200px;margin-bottom:0.5rem;" />`;
  if (pos === "top-middle") return `<div style="text-align:center;margin-bottom:0.5rem;"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(storeName)} Logo" style="max-height:64px;max-width:200px;" /></div>`;
  if (pos === "top-right") return `<div style="text-align:right;margin-bottom:0.5rem;"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(storeName)} Logo" style="max-height:64px;max-width:200px;" /></div>`;
  return "";
}

// ============ INVOICE CSS ============
export const INVOICE_CSS = `
  body { font-family: system-ui, sans-serif; max-width: 750px; margin: 2rem auto; padding: 0 1rem; color: #1f2937; }
  .invoice { border: 1px solid #e5e7eb; border-radius: 16px; padding: 2rem; }
  .header { display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 1rem; border-bottom: 2px solid #1f2937; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .header h1 { margin: 0; font-size: 1.5rem; }
  .header .meta { font-size: 0.9rem; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
  th, td { padding: 0.6rem 0.5rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th { font-size: 0.7rem; text-transform: uppercase; color: #6b7280; white-space:nowrap; }
  .total-row { font-weight: 700; font-size: 1.1rem; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; font-size: 0.9rem; }
  .info-grid .label { color: #6b7280; font-size: 0.8rem; text-transform: uppercase; }
  .footer { margin-top: 2rem; font-size: 0.85rem; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
  .btn-group { display: flex; justify-content: center; gap: 0.75rem; margin: 1.5rem auto 0; flex-wrap: wrap; }
  .print-btn { display: inline-block; padding: 0.6rem 2rem; background: #1f2937; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .print-btn:hover { background: #374151; }
  .pdf-btn { display: inline-block; padding: 0.6rem 2rem; background: #dc2626; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .pdf-btn:hover { background: #b91c1c; }
  .etims-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 0.75rem; margin: 1rem 0; font-size: 0.82rem; }
  .etims-box strong { color: #166534; }
  .vscu-data { font-size: 0.7rem; word-break: break-all; color: #6b7280; margin-top: 0.5rem; padding: 0.5rem; background: #f9fafb; border-radius: 6px; }
  @media print { body { margin: 0; } .invoice { border: none; } .btn-group { display: none; } }
`;

export const THERMAL_CSS = `
  body { font-family: monospace; max-width: 380px; margin: 0 auto; padding: 0.75rem; font-size: 0.9rem; color: #1f2937; line-height: 1.6; }
  h1 { font-size: 1.15rem; text-align: center; margin: 0.75rem 0; }
  table { width: 100%; border-collapse: collapse; margin: 0.5rem 0; }
  th, td { padding: 0.35rem 0; text-align: left; }
  .total { font-weight: 700; font-size: 1.1rem; border-top: 1px dashed #000; padding-top: 0.6rem; }
  .center { text-align: center; }
  hr { border: none; border-top: 1px dashed #000; margin: 0.75rem 0; }
  .btn-group { display: flex; justify-content: center; gap: 0.5rem; margin: 1rem auto; flex-wrap: wrap; }
  .print-btn { display: inline-block; padding: 0.5rem 1.5rem; background: #1f2937; color: #fff; border: none; border-radius: 6px; font-size: 0.9rem; cursor: pointer; }
  .print-btn:hover { background: #374151; }
  .pdf-btn { display: inline-block; padding: 0.5rem 1.5rem; background: #dc2626; color: #fff; border: none; border-radius: 6px; font-size: 0.9rem; cursor: pointer; }
  .pdf-btn:hover { background: #b91c1c; }
  .footer-note { text-align: center; font-size: 0.7rem; color: #9ca3af; margin-top: 0.75rem; border-top: 1px solid #e5e7eb; padding-top: 0.5rem; }
  @media print { body { margin: 0; } .btn-group { display: none; } }
`;

export const CREDIT_NOTE_CSS = `
  body { font-family: system-ui, sans-serif; max-width: 750px; margin: 2rem auto; padding: 0 1rem; color: #1f2937; }
  .cn { border: 2px solid #dc2626; border-radius: 16px; padding: 2rem; }
  .header { display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 1rem; border-bottom: 2px solid #dc2626; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .header h1 { margin: 0; font-size: 1.5rem; color: #dc2626; }
  .header .meta { font-size: 0.9rem; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
  th, td { padding: 0.6rem 0.5rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th { font-size: 0.7rem; text-transform: uppercase; color: #6b7280; white-space:nowrap; }
  .total-row { font-weight: 700; font-size: 1.1rem; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; font-size: 0.9rem; }
  .info-grid .label { color: #6b7280; font-size: 0.8rem; text-transform: uppercase; }
  .footer { margin-top: 2rem; font-size: 0.85rem; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
  .btn-group { display: flex; justify-content: center; gap: 0.75rem; margin: 1.5rem auto 0; flex-wrap: wrap; }
  .print-btn { display: inline-block; padding: 0.6rem 2rem; background: #dc2626; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .print-btn:hover { background: #b91c1c; }
  .pdf-btn { display: inline-block; padding: 0.6rem 2rem; background: #1f2937; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .pdf-btn:hover { background: #374151; }
  .badge { display: inline-block; background: #fee2e2; color: #dc2626; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.85rem; font-weight: 600; }
  .etims-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 0.75rem; margin: 1rem 0; font-size: 0.82rem; }
  .etims-box .label { color: #166534; font-weight: 600; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 0.25rem; }
  @media print { body { margin: 0; } .cn { border: none; } .btn-group { display: none; } }
`;

// ============ BUTTON HTML HELPERS ============
export function invoiceButtons(orderId: number, format: string): string {
  const pdfUrl = format === "a4" ? `?format=a4` : "";
  return `<div class="btn-group">
    <button class="print-btn" onclick="window.print()">Print</button>
    <button class="pdf-btn" onclick="window.location.href=window.location.pathname + '?format=pdf'">Save PDF</button>
  </div>`;
}

export function posReceiptButtons(orderId: number, format: string): string {
  if (format === "a4") {
    return `<div class="btn-group">
      <button class="print-btn" onclick="window.print()">Print</button>
      <button class="pdf-btn" onclick="window.location.href='/api/pos/receipt/${orderId}?format=pdf'">Save PDF</button>
    </div>`;
  }
  return `<div class="btn-group">
    <button class="print-btn" onclick="window.print()">Print</button>
    <button class="pdf-btn" onclick="window.location.href='/api/pos/receipt/${orderId}?format=pdf'">Save PDF</button>
  </div>`;
}

// ============ INVOICE ITEM ROW HELPER ============
export function buildInvoiceItemRow(
  item: { name: string; quantity: number; price: number; lineTotal: number; hasWarranty?: boolean; warrantyDuration?: number; taxable?: boolean },
  orderCreatedAt: string,
  currency: string,
  taxRate: number,
  taxType: string
): string {
  let warranty = "\u2014";
  if (item.hasWarranty) {
    const expiry = new Date(orderCreatedAt);
    expiry.setMonth(expiry.getMonth() + (item.warrantyDuration || 0));
    warranty = `Yes (exp: ${expiry.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })})`;
  }
  const isTx = item.taxable !== false;
  const vat = isTx ? Math.round(item.lineTotal * taxRate / 116 * 100) / 100 : 0;
  const tt = isTx ? taxType : "E";
  return `<tr><td>${escapeHtml(item.name)}</td><td style="text-align:center">${item.quantity}</td><td style="text-align:right;white-space:nowrap">${currency} ${item.price.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td style="text-align:right;white-space:nowrap">${currency} ${item.lineTotal.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td style="text-align:right;white-space:nowrap">${isTx ? currency + " " + vat.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "Exempt"}</td><td style="font-size:0.75rem;text-align:center">${tt}</td><td style="font-size:0.85rem;">${warranty}</td></tr>`;
}

// ============ FULL INVOICE HTML GENERATOR ============
export interface InvoiceData {
  orderId: number;
  order: {
    id: number;
    createdAt: string;
    status: string;
    subtotal: number;
    shippingFee: number;
    shippingName: string;
    shippingAddress: string;
    shippingCity: string;
    shippingCounty: string;
    shippingPhone: string;
    customerName: string;
    notes: string;
    items: Array<{ name: string; quantity: number; price: number; lineTotal: number; hasWarranty?: boolean; warrantyDuration?: number; taxable?: boolean }>;
  };
  store: {
    name: string;
    email: string;
    logo: string;
    logoPosition: string;
    currency: string;
  };
  etims: {
    enabled: boolean;
    number: string;
    controlCode: string;
    mode: string;
    vscuReceiptNo: string;
    internalData: string;
    signatureData: string;
    receiptDate: string;
    taxType: string;
    kraPin: string;
  };
}

export function generateInvoiceHtml(data: InvoiceData): string {
  const { order, store, etims } = data;
  const currency = store.currency || "KES";
  const taxRate = 16;
  const total = order.subtotal + (order.shippingFee || 0);
  const modeLabel = etims.mode === "off" ? "OFF" : etims.mode === "vscu" ? "VSCU" : "OSCU";
  const invoiceTitle = etims.enabled ? "E-TIMS TAX INVOICE / RECEIPT" : "TAX INVOICE / RECEIPT";
  const invoiceSubtitle = etims.enabled
    ? `Invoice #${order.id} | ${escapeHtml(modeLabel)} Receipt #${escapeHtml(etims.vscuReceiptNo)}`
    : `Invoice #${order.id}`;

  const itemsHtml = order.items.map(i => buildInvoiceItemRow(i, order.createdAt, currency, taxRate, etims.taxType || "A")).join("");
  const totalVat = order.items.reduce((s, i) => s + (i.taxable !== false ? Math.round(i.lineTotal * taxRate / 116 * 100) / 100 : 0), 0);
  const qrData = JSON.stringify({ inv: etims.number, dc: etims.controlCode, pin: etims.kraPin, amt: total, dt: order.createdAt, ri: etims.vscuReceiptNo });
  const qrUrl = etims.enabled ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}` : "";

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice #${order.id} — ${store.name}</title>
<style>${INVOICE_CSS}</style></head><body>
<div class="invoice">
  <div class="header">
    <div>${renderStoreLogo(store.logo, store.logoPosition, store.name)}<h1>${invoiceTitle}</h1><p class="meta">${invoiceSubtitle}</p></div>
    <div style="text-align:right;"><strong>${escapeHtml(store.name)}</strong><br><span class="meta">${escapeHtml(store.email)}</span></div>
  </div>
  ${etims.enabled ? `<div class="etims-box"><strong>eTIMS No:</strong> ${escapeHtml(etims.number)} | <strong>Control Code:</strong> ${escapeHtml(etims.controlCode)} | <strong>KRA PIN:</strong> ${escapeHtml(etims.kraPin)} | <strong>Mode:</strong> ${modeLabel}</div>` : ""}
  <div class="info-grid">
    <div>
      <div class="label">Bill to</div>
      <div><strong>${escapeHtml(order.shippingName || order.customerName)}</strong></div>
      <div>${escapeHtml(order.shippingAddress || "")}</div>
      <div>${escapeHtml(order.shippingCity || "")}${order.shippingCounty ? ", " + escapeHtml(order.shippingCounty) : ""}</div>
      ${order.shippingPhone ? `<div>${escapeHtml(order.shippingPhone)}</div>` : ""}
    </div>
    <div>
      <div class="label">Order details</div>
      <div>Date: ${etims.receiptDate || new Date(order.createdAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</div>
      <div>Status: ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</div>
      <div>Tax Type: ${(etims.taxType || "A") === "A" ? "VAT A (16%)" : "Not Subject (E)"}</div>
      ${etims.enabled ? `<div>Mode: ${modeLabel}</div>` : ""}
    </div>
  </div>
  <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th><th style="text-align:right">VAT</th><th style="text-align:center">TT</th><th>Warranty</th></tr></thead><tbody>
    ${itemsHtml}
  </tbody></table>
  <div style="text-align:right;">
    <div>Subtotal: ${currency} ${order.subtotal.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    <div>Shipping: ${currency} ${(order.shippingFee || 0).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    <div>VAT (${taxRate}%): ${currency} ${totalVat.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    <div class="total-row">Total incl. VAT: ${currency} ${total.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
  </div>
  ${etims.internalData ? `<div class="vscu-data"><strong>Internal Data:</strong> ${escapeHtml(etims.internalData)}<br><strong>Signature Data:</strong> ${escapeHtml(etims.signatureData)}</div>` : ""}
  ${order.notes ? `<p style="margin-top:1rem;font-size:0.9rem;"><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ""}
  ${etims.enabled ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:1.5rem;">
    <div style="font-size:0.85rem;color:#6b7280;">${escapeHtml(store.name)} — Payment via M-Pesa | ${escapeHtml(store.email)}</div>
    ${qrUrl ? `<img src="${qrUrl}" alt="eTIMS QR Code" style="width:100px;height:100px;" />` : ""}
  </div>
  <div class="btn-group">
    <button class="print-btn" onclick="window.print()">Print</button>
    <button class="pdf-btn" onclick="window.location.href=window.location.pathname+'?format=pdf'">Save PDF</button>
  </div>
  <div class="footer">eTIMS-compliant invoice (${modeLabel}) — Verify at https://itax.kra.go.ke</div>` : `
  <div style="text-align:center;margin-top:1.5rem;font-size:0.85rem;color:#6b7280;">${escapeHtml(store.name)} — ${escapeHtml(store.email)}</div>
  <div class="btn-group">
    <button class="print-btn" onclick="window.print()">Print</button>
    <button class="pdf-btn" onclick="window.location.href=window.location.pathname+'?format=pdf'">Save PDF</button>
  </div>`}
  <div style="text-align:center;font-size:0.7rem;color:#9ca3af;margin-top:0.5rem;">Provided by ${escapeHtml(store.name)}</div>
</div>
</body></html>`;
}

// ============ PERMISSION HELPER ============
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { hasPermission } = await import("../permissions");
    const uid = (req as any).user?.sub;
    if (!uid || !(await hasPermission(uid, permission))) {
      res.status(403).json({ error: `Missing permission: ${permission}` });
      return;
    }
    next();
  };
}
