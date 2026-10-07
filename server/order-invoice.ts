// Shared order invoice PDF generation + automatic customer invoice email.
//
// The invoice HTML was previously built inline (three nearly identical copies in
// server/index.ts). This module owns one copy so the admin/customer "view or
// download invoice" routes and the automatic paid/delivered invoice emails all
// render the same document.

import { getOrder, getSettings } from "./db";
import { queryOne } from "./db-helpers";
import { htmlToPdf } from "./pdf";
import { sendEmail, orderStatusEmail } from "./email";
import { escapeHtml, renderStoreLogo, INVOICE_CSS, addCalendarMonthsClamped } from "./routes/shared";

function storeBaseUrl(): string {
  return (process.env.FRONTEND_URL || process.env.BASE_URL || "").replace(/\/$/, "") || "http://localhost:3000";
}

export function buildOrderInvoiceHtml(order: any, settings: any, baseUrl: string): string {
  const store = settings.storeName || "Gear&Glitch";
  const storeEmail = settings.email || "info@gearandglitch.com";
  const currency = settings.currency || "KES";
  const taxRate = Number(settings.taxRate || 16);
  return invoiceHtml(order, settings, baseUrl, store, storeEmail, currency, taxRate);
}

// All available invoice facts are derivable from the order + settings:
// eTIMS fields come from the order_invoices row, so this reads them the same
// way the routes do.
export async function buildOrderInvoicePdf(order: any, settings: any, baseUrl: string): Promise<Buffer> {
  const html = buildOrderInvoiceHtml(order, settings, baseUrl);
  return await htmlToPdf(html);
}

function orderTotal(order: any): number {
  return Number(order.subtotal || 0) + Number(order.shippingFee || 0) - (Number(order.discountAmount) || 0) - (Number(order.giftCardAmount) || 0);
}

// Emails the order's invoice PDF to the customer. `paid` = payment-recorded
// trigger; `delivered` = order delivered trigger (reuses the delivered status
// email wording with the PDF attached). Never throws: failures are logged so a
// broken email can never take down a payment or status transition.
export async function sendOrderInvoiceEmail(orderId: number, kind: "paid" | "delivered"): Promise<void> {
  try {
    const order = await getOrder(orderId);
    if (!order) return;
    const email = String(order.customerEmail || "").trim();
    if (!email) return;
    const settings = await getSettings();
    const base = storeBaseUrl();
    (order as any)._invoiceRow = await loadOrderInvoiceRow(orderId);
    // Chromium may be unavailable (local dev, some hosts). Never let that
    // swallow the paid/delivered notification: send the invoice content inline
    // (the HTML is a full invoice document) and skip the attachment instead of
    // dropping the whole email.
    let pdf: Buffer | null = null;
    try {
      pdf = await buildOrderInvoicePdf(order, settings, base);
    } catch (pdfErr: any) {
      console.warn(`[invoice] PDF generation failed for order ${orderId} (${kind}) — emailing without attachment:`, pdfErr?.message || pdfErr);
    }
    const store = settings.storeName || "Gear&Glitch";

    let subject: string;
    let bodyHtml: string;
    if (kind === "delivered") {
      const bundle = orderStatusEmail(order.customerName || "Customer", `#${order.id}`, "delivered", `${base}/order?id=${order.id}`);
      subject = bundle.subject;
      bodyHtml = bundle.html;
    } else {
      subject = `Your invoice for order #${order.id} — ${store}`;
      const total = orderTotal(order).toFixed(2);
      const currency = settings.currency || "KES";
      bodyHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice #${order.id}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;">
<div style="max-width:600px;margin:24px auto;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">
<div style="background:#1e293b;padding:20px 24px;"><h1 style="margin:0;color:#f8fafc;font-size:18px;">Invoice #${escapeHtml(String(order.id))}</h1></div>
<div style="padding:24px;color:#334155;font-size:14px;line-height:1.6;">
<p>Hi ${escapeHtml(order.customerName || "there")},</p>
<p>Payment for your order <strong>#${escapeHtml(String(order.id))}</strong> has been received. Your invoice is attached to this email as a PDF.</p>
<div style="background:#f1f5f9;padding:12px 16px;margin:16px 0;border-radius:6px;">
<p style="margin:0;"><strong>Order:</strong> #${escapeHtml(String(order.id))}</p>
<p style="margin:8px 0 0;"><strong>Total:</strong> ${escapeHtml(currency)} ${escapeHtml(total)}</p>
</div>
<p>Thank you for shopping with <strong>${escapeHtml(store)}</strong>.</p>
</div>
<div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;font-size:12px;color:#94a3b8;text-align:center;">Automated Notification</div>
</div></body></html>`;
    }
    await sendEmail(email, subject, bodyHtml, kind === "paid" ? "order_invoice" : "order_status", pdf ? [
      { filename: `invoice-${order.id}.pdf`, content: pdf, contentType: "application/pdf" },
    ] : undefined);
  } catch (err: any) {
    console.error(`[invoice] Failed to email invoice for order ${orderId} (${kind}):`, err?.message || err);
  }
}

// The invoice document shared by /api/admin/invoices/:id/view (a.k.a. the admin
// order invoice route), the customer /api/orders/:id/invoice route, and the
// automatic paid/delivered invoice emails above.
function invoiceHtml(order: any, settings: any, baseUrl: string, store: string, storeEmail: string, currency: string, taxRate: number): string {
  const kraPin = settings.kra_pin || "P051234567Z";
  const etimsMode = settings.etims_mode || "off";
  const invoice = order._invoiceRow;
  const etimsNumber = invoice?.etims_invoice_number || "";
  const controlCode = invoice?.control_code || "";
  const internalData = invoice?.internal_data || "";
  const signatureData = invoice?.signature_data || "";
  const receiptDate = invoice?.receipt_date || "";
  const taxType = invoice?.tax_type || "A";
  const vscuReceiptNo = invoice?.vscu_receipt_no || "";
  const hasEtims = !!(invoice?.etims_invoice_number);
  const activeItems = (order.items || []).filter((i: any) => !i.cancelled);
  const itemsHtml = activeItems.map((i: any) => {
    let warranty = "\u2014";
    if (i.hasWarranty) {
      const expiry = new Date(order.createdAt);
      addCalendarMonthsClamped(expiry, i.warrantyDuration || 0);
      warranty = `Yes (exp: ${expiry.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })})`;
    }
    const isTx = i.taxable !== false;
    const vat = isTx ? Math.round(Number(i.lineTotal) * taxRate / 116 * 100) / 100 : 0;
    const tt = isTx ? taxType : "E";
    return `<tr><td>${escapeHtml(i.name)}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right;white-space:nowrap">${currency} ${Number(i.price).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td style="text-align:right;white-space:nowrap">${currency} ${Number(i.lineTotal).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td style="text-align:right;white-space:nowrap">${isTx ? currency + " " + vat.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "Exempt"}</td><td style="font-size:0.75rem;text-align:center">${tt}</td><td style="font-size:0.85rem;">${warranty}</td></tr>`;
  }).join("");
  const activeSubtotal = activeItems.reduce((s: number, i: any) => s + Number(i.lineTotal), 0);
  const total = activeSubtotal + (order.shippingFee || 0);
  const totalVat = activeItems.reduce((s: number, i: any) => {
    return s + (i.taxable !== false ? Math.round(Number(i.lineTotal) * taxRate / 116 * 100) / 100 : 0);
  }, 0);
  const qrData = JSON.stringify({ inv: etimsNumber, dc: controlCode, pin: kraPin, amt: total, dt: order.createdAt, ri: vscuReceiptNo });
  const qrUrl = hasEtims ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}` : "";
  const modeLabel = etimsMode === "off" ? "OFF" : etimsMode === "vscu" ? "VSCU" : "OSCU";
  const payMethod = order.paymentMethod || "cash";
  const paymentLabel = payMethod === "mpesa" ? "M-Pesa" : payMethod === "multi-currency" ? "Multi-currency" : payMethod.charAt(0).toUpperCase() + payMethod.slice(1);
  const tenderedAmt = Number(order.tenderedAmount) || 0;
  const changeAmt = tenderedAmt > total ? tenderedAmt - total : 0;
  const invoiceTitle = hasEtims ? "E-TIMS TAX INVOICE / RECEIPT" : "TAX INVOICE / RECEIPT";
  const invoiceSubtitle = hasEtims ? `Invoice #${order.id} | ${escapeHtml(modeLabel)} Receipt #${escapeHtml(vscuReceiptNo)}` : `Invoice #${order.id}`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice #${order.id} — ${escapeHtml(String(store))}</title>
<style>${INVOICE_CSS}</style></head><body>
<div class="invoice">
  ${renderStoreLogo(settings.storeLogo || "", settings.logoPosition || "top-left", store, baseUrl)}
  <div class="header">
    <div><h1>${invoiceTitle}</h1><p class="meta">${invoiceSubtitle}</p></div>
    <div style="text-align:right;"><strong>${escapeHtml(store)}</strong><br><span class="meta">${escapeHtml(storeEmail)}</span></div>
  </div>
  ${etimsNumber ? `<div class="etims-box"><strong>eTIMS No:</strong> ${escapeHtml(etimsNumber)} | <strong>Control Code:</strong> ${escapeHtml(controlCode)} | <strong>KRA PIN:</strong> ${escapeHtml(kraPin)} | <strong>Mode:</strong> ${modeLabel}</div>` : ""}
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
      <div>Date: ${receiptDate || new Date(order.createdAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</div>
      <div>Status: ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</div>
      <div>Tax Type: ${taxType === "A" ? "VAT A (16%)" : "Not Subject (E)"}</div>
      ${hasEtims ? `<div>Mode: ${modeLabel}</div>` : ""}
    </div>
  </div>
  <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th><th style="text-align:right">VAT</th><th style="text-align:center">TT</th><th>Warranty</th></tr></thead><tbody>
    ${itemsHtml}
  </tbody></table>
  <div class="totals">
    <div>Subtotal: ${currency} ${activeSubtotal.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    <div>Shipping: ${currency} ${(order.shippingFee || 0).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    <div>VAT (${taxRate}%): ${currency} ${totalVat.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    <div class="total-row">Total incl. VAT: ${currency} ${total.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
  </div>
  ${internalData ? `<div class="vscu-data"><strong>Internal Data:</strong> ${escapeHtml(internalData)}<br><strong>Signature Data:</strong> ${escapeHtml(signatureData)}</div>` : ""}
  ${order.notes ? `<p style="margin-top:1rem;font-size:0.9rem;"><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ""}
  ${hasEtims ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:1.5rem;">
    <div style="font-size:0.85rem;color:#6b7280;">${escapeHtml(store)} — Payment: ${paymentLabel}${tenderedAmt > 0 ? ` | Tendered: ${currency} ${tenderedAmt.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}${changeAmt > 0 ? ` | Change: ${currency} ${changeAmt.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""} | ${escapeHtml(storeEmail)}</div>
    ${qrUrl ? `<img src="${qrUrl}" alt="eTIMS QR Code" style="width:100px;height:100px;" />` : ""}
  </div>
  <div class="btn-group">
    <button class="print-btn" onclick="window.print()">Print</button>
    <button class="pdf-btn" onclick="window.location.href=window.location.pathname+'?format=pdf'">Save PDF</button>
  </div>
  <div class="footer">eTIMS-compliant invoice (${modeLabel}) — Verify at https://itax.kra.go.ke</div>` : `
  <div style="text-align:center;margin-top:1.5rem;font-size:0.85rem;color:#6b7280;">${escapeHtml(store)} — ${escapeHtml(storeEmail)}</div>
  <div class="btn-group">
    <button class="print-btn" onclick="window.print()">Print</button>
    <button class="pdf-btn" onclick="window.location.href=window.location.pathname+'?format=pdf'">Save PDF</button>
  </div>`}
  <div style="text-align:center;font-size:0.7rem;color:#9ca3af;margin-top:0.5rem;">Provided by ${escapeHtml(store)}</div>
</div>
</body></html>`;
}

// Fetches the eTIMS row used by invoiceHtml (the route call sites currently
// query order_invoices themselves; keep a helper so the invoice email path and
// any future route share the same SQL).
export async function loadOrderInvoiceRow(orderId: number): Promise<any | null> {
  return (await queryOne("SELECT * FROM order_invoices WHERE order_id = $1", [orderId])) || null;
}

// Builds the invoice document the way the admin route does: order + settings +
// the order_invoices row merged into a single object for the renderer.
export async function renderOrderInvoice(orderId: number): Promise<{ html: string; pdf: Buffer } | null> {
  const order = await getOrder(orderId);
  if (!order) return null;
  const settings = await getSettings();
  (order as any)._invoiceRow = await loadOrderInvoiceRow(orderId);
  const html = buildOrderInvoiceHtml(order, settings, storeBaseUrl());
  const pdf = await htmlToPdf(html);
  return { html, pdf };
}