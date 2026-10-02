// Printable financing documents (agreement, schedule, statement, receipt).
//
// Pure HTML builders - the route layer decides whether to return HTML or render
// it to PDF via server/pdf.ts. No database access happens here; callers pass in
// the already-loaded agreement/payment/customer records.

import { getStoreSetting } from "../db";

export interface DocumentBranding {
  storeName: string;
  email: string;
  phone: string;
  currency: string;
  logo: string;
}

export async function getDocumentBranding(): Promise<DocumentBranding> {
  const [storeName, email, phone, currency, logo] = await Promise.all([
    getStoreSetting("storeName"),
    getStoreSetting("email"),
    getStoreSetting("phone"),
    getStoreSetting("currency"),
    getStoreSetting("storeLogo"),
  ]);
  return {
    storeName: storeName || "Gear&Glitch",
    email: email || "",
    phone: phone || "",
    currency: currency || "KES",
    logo: logo || "",
  };
}

function esc(v: unknown): string {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function money(cents: number | null | undefined, currency = "KES"): string {
  const n = (Number(cents) || 0) / 100;
  return `${currency} ${n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const DATE_FMT: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" };

export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const first = String(s).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(first)) {
    const [y, m, d] = first.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", DATE_FMT);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? String(s) : d.toLocaleDateString("en-GB", DATE_FMT);
}

const FREQ_LABEL: Record<string, string> = {
  daily: "daily",
  weekly: "weekly",
  biweekly: "every two weeks",
  monthly: "monthly",
  custom: "per period",
};

const CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; font-size: 12px; margin: 0; }
  .doc { max-width: 800px; margin: 0 auto; padding: 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #c2410c; padding-bottom: 12px; margin-bottom: 18px; }
  .header h1 { font-size: 20px; margin: 0; color: #c2410c; }
  .header .meta { color: #475569; margin: 4px 0 0; }
  .brand { text-align: right; font-size: 12px; color: #475569; }
  .brand img { max-height: 48px; max-width: 160px; display: block; margin-left: auto; margin-bottom: 6px; }
  h2 { font-size: 14px; margin: 20px 0 8px; }
  .grid { display: flex; gap: 16px; flex-wrap: wrap; }
  .grid > div { flex: 1 1 220px; }
  .label { text-transform: uppercase; letter-spacing: 0.04em; font-size: 10px; color: #64748b; margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  th { background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #475569; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-top: 12px; margin-left: auto; width: 320px; }
  .totals div { display: flex; justify-content: space-between; padding: 3px 0; }
  .totals .grand { border-top: 1px solid #cbd5e1; margin-top: 4px; padding-top: 6px; font-weight: 700; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; background: #f1f5f9; color: #334155; }
  .note { margin-top: 16px; font-size: 11px; color: #475569; line-height: 1.5; }
  .signatures { margin-top: 40px; display: flex; gap: 40px; }
  .signatures > div { flex: 1; border-top: 1px solid #0f172a; padding-top: 6px; font-size: 11px; color: #475569; }
  .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
`;

function shell(title: string, body: string, branding: DocumentBranding): string {
  const footer = `<div class="footer">${esc(branding.storeName)}${branding.email ? ` · ${esc(branding.email)}` : ""}${branding.phone ? ` · ${esc(branding.phone)}` : ""}<br>This document was generated electronically and is valid without a signature.</div>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}${footer}</body></html>`;
}

function header(title: string, subtitle: string, branding: DocumentBranding): string {
  const logo = /^(https?:|data:)/.test(branding.logo) ? `<img src="${esc(branding.logo)}" alt="" />` : "";
  return `<div class="header"><div><h1>${esc(title)}</h1><p class="meta">${esc(subtitle)}</p></div><div class="brand">${logo}<strong>${esc(branding.storeName)}</strong>${branding.email ? `<br>${esc(branding.email)}` : ""}${branding.phone ? `<br>${esc(branding.phone)}` : ""}</div></div>`;
}

interface CustomerLike { name?: string; email?: string; phone?: string; id?: number }

function customerBlock(customer: CustomerLike | undefined): string {
  return `<div><div class="label">Customer</div><strong>${esc(customer?.name || `Customer #${customer?.id ?? ""}`)}</strong>${customer?.phone ? `<div>${esc(customer.phone)}</div>` : ""}${customer?.email ? `<div>${esc(customer.email)}</div>` : ""}</div>`;
}

/** Full hire-purchase agreement with terms and the instalment schedule. */
export function agreementHtml(agr: any, customer: CustomerLike | undefined, branding: DocumentBranding): string {
  const cur = agr.currency || branding.currency;
  const terms: [string, string][] = [
    ["Cash price", money(agr.cashPriceCents, cur)],
    ["Deposit paid", money(agr.depositCents, cur)],
    ["Financing charge", money(agr.chargeCents, cur)],
    ["Total hire-purchase price", money(agr.hpPriceCents, cur)],
    ["Amount financed", money(agr.financedBalanceCents, cur)],
    ["Instalment", `${money(agr.instalmentCents, cur)} ${FREQ_LABEL[agr.frequency] || agr.frequency}`],
    ["Number of instalments", String(agr.termCount)],
    ["First due date", fmtDate(agr.firstDueDate)],
    ["Possession", String(agr.possessionModel || "").replace(/_/g, " ")],
  ];
  const schedule = (agr.schedules || []).map((s: any) => `<tr><td>${s.sequence}</td><td>${esc(fmtDate(s.dueDate))}</td><td class="num">${money(s.amountCents, cur)}</td><td>${esc(s.status)}</td></tr>`).join("");
  const body = `<div class="doc">
    ${header("Hire-Purchase Agreement", `Agreement ${agr.agreementNumber}`, branding)}
    <div class="grid">
      ${customerBlock(customer)}
      <div><div class="label">Item</div><strong>${esc(agr.productName || "—")}</strong>${agr.serialNumber ? `<div>Serial ${esc(agr.serialNumber)}</div>` : ""}<div>Status: <span class="badge">${esc(agr.status)}</span></div></div>
      <div><div class="label">Dates</div><div>Start: ${esc(fmtDate(agr.startDate))}</div><div>First instalment: ${esc(fmtDate(agr.firstDueDate))}</div></div>
    </div>
    <h2>Terms</h2>
    <table><tbody>${terms.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${esc(v)}</td></tr>`).join("")}</tbody></table>
    <h2>Instalment schedule</h2>
    <table><thead><tr><th>#</th><th>Due date</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody>${schedule}</tbody></table>
    <div class="note">
      <strong>Hire-purchase terms.</strong> Ownership of the item remains with ${esc(branding.storeName)} until the total hire-purchase price has been paid in full.
      The customer is responsible for the safekeeping of the item. Late instalments may be followed up by the store. No hidden charges apply beyond the terms shown above.
      This agreement does not authorise any remote disabling of the item or any automatic repossession.
    </div>
    <div class="signatures"><div>Customer signature &amp; date</div><div>For ${esc(branding.storeName)} (signature &amp; date)</div></div>
  </div>`;
  return shell("Hire-Purchase Agreement", body, branding);
}

/** Standalone instalment schedule. */
export function scheduleHtml(agr: any, customer: CustomerLike | undefined, branding: DocumentBranding): string {
  const cur = agr.currency || branding.currency;
  const rows = (agr.schedules || []).map((s: any) => {
    const balance = Math.max(0, Number(s.amountCents) - Number(s.amountPaidCents) - Number(s.waivedCents || 0));
    return `<tr><td>${s.sequence}</td><td>${esc(fmtDate(s.dueDate))}</td><td class="num">${money(s.amountCents, cur)}</td><td class="num">${money(s.amountPaidCents, cur)}</td><td class="num">${money(balance, cur)}</td><td>${esc(s.status)}</td></tr>`;
  }).join("");
  const body = `<div class="doc">
    ${header("Instalment Schedule", `Agreement ${agr.agreementNumber}`, branding)}
    <div class="grid">
      ${customerBlock(customer)}
      <div><div class="label">Item</div><strong>${esc(agr.productName || "—")}</strong></div>
      <div><div class="label">Outstanding</div><strong>${money(agr.outstandingCents, cur)}</strong></div>
    </div>
    <table><thead><tr><th>#</th><th>Due date</th><th class="num">Amount</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
  </div>`;
  return shell("Instalment Schedule", body, branding);
}

/** Outstanding statement including payment history and running totals. */
export function statementHtml(agr: any, customer: CustomerLike | undefined, branding: DocumentBranding): string {
  const cur = agr.currency || branding.currency;
  const payments = (agr.payments || []).map((p: any) => `<tr><td>${esc(p.paymentRef)}</td><td>${esc(fmtDate(p.createdAt))}</td><td>${esc(p.method)}</td><td class="num">${money(p.amountCents, cur)}</td><td>${esc(p.status)}</td></tr>`).join("");
  const body = `<div class="doc">
    ${header("Customer Statement", `Agreement ${agr.agreementNumber}`, branding)}
    <div class="grid">
      ${customerBlock(customer)}
      <div><div class="label">Item</div><strong>${esc(agr.productName || "—")}</strong></div>
      <div><div class="label">Status</div><span class="badge">${esc(agr.status)}</span></div>
    </div>
    <div class="totals">
      <div><span>Total hire-purchase price</span><span>${money(agr.hpPriceCents, cur)}</span></div>
      <div><span>Deposit</span><span>${money(agr.depositCents, cur)}</span></div>
      <div><span>Paid to date</span><span>${money(agr.totalPaidCents, cur)}</span></div>
      ${Number(agr.creditCents) > 0 ? `<div><span>Account credit</span><span>${money(agr.creditCents, cur)}</span></div>` : ""}
      <div class="grand"><span>Outstanding</span><span>${money(agr.outstandingCents, cur)}</span></div>
    </div>
    <h2>Payments</h2>
    <table><thead><tr><th>Reference</th><th>Date</th><th>Method</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody>${payments || `<tr><td colspan="5">No payments recorded.</td></tr>`}</tbody></table>
    <h2>Instalments</h2>
    <table><thead><tr><th>#</th><th>Due date</th><th class="num">Amount</th><th class="num">Paid</th><th>Status</th></tr></thead><tbody>${(agr.schedules || []).map((s: any) => `<tr><td>${s.sequence}</td><td>${esc(fmtDate(s.dueDate))}</td><td class="num">${money(s.amountCents, cur)}</td><td class="num">${money(s.amountPaidCents, cur)}</td><td>${esc(s.status)}</td></tr>`).join("")}</tbody></table>
  </div>`;
  return shell("Customer Statement", body, branding);
}

/** Payment receipt. */
export function receiptHtml(payment: any, agr: any, customer: CustomerLike | undefined, branding: DocumentBranding): string {
  const cur = agr.currency || branding.currency;
  const body = `<div class="doc">
    ${header("Payment Receipt", `Receipt ${payment.paymentRef}`, branding)}
    <div class="grid">
      ${customerBlock(customer)}
      <div><div class="label">Agreement</div><strong>${esc(agr.agreementNumber)}</strong><div>${esc(agr.productName || "")}</div></div>
      <div><div class="label">Payment</div><div>Date: ${esc(fmtDate(payment.completedAt || payment.createdAt))}</div><div>Method: ${esc(payment.method)}</div>${payment.mpesaReceipt ? `<div>M-Pesa: ${esc(payment.mpesaReceipt)}</div>` : ""}</div>
    </div>
    <table><tbody>
      <tr><td>Amount received</td><td class="num"><strong>${money(payment.amountCents, cur)}</strong></td></tr>
      <tr><td>Allocated to instalments</td><td class="num">${money(Math.max(0, Number(payment.amountCents) - Number(agr.creditCents || 0)), cur)}</td></tr>
      <tr><td>Outstanding balance after payment</td><td class="num">${money(agr.outstandingCents, cur)}</td></tr>
    </tbody></table>
    <div class="note">Thank you. This receipt confirms the payment above against agreement ${esc(agr.agreementNumber)}.</div>
  </div>`;
  return shell("Payment Receipt", body, branding);
}
