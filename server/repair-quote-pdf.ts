import { htmlToPdf } from "./pdf";
import { escapeHtml, renderStoreLogo } from "./routes/shared";

function money(value: unknown, currency: string): string {
  const amount = Number(value);
  return `${escapeHtml(currency)} ${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

/** Build a customer-safe repair estimate from the ticket state being sent. */
export async function buildRepairQuotePdf(ticket: any, settings: any, quote: { version: number; expiresAt: string }): Promise<Buffer> {
  const storeName = String(settings?.storeName || "My Shop");
  const currency = String(settings?.currency || "KES");
  const device = [ticket.deviceBrand, ticket.deviceType, ticket.deviceModel].filter(Boolean).join(" ") || "Device not specified";
  const issue = String(ticket.issueSummary || "Repair or service estimate");
  const parts = Array.isArray(ticket.parts) ? ticket.parts : [];
  const partsRows = parts.length
    ? parts.map((part: any) => `<tr><td>${escapeHtml(String(part.description || "Part"))}</td><td>${Number(part.quantity) || 1}</td><td>${money(part.unitCost, currency)}</td><td>${money((Number(part.quantity) || 1) * (Number(part.unitCost) || 0), currency)}</td></tr>`).join("")
    : `<tr><td colspan="4" class="muted">No parts are included in this estimate.</td></tr>`;
  const logo = renderStoreLogo(String(settings?.storeLogo || ""), String(settings?.logoPosition || "top-left"), storeName, process.env.FRONTEND_URL || process.env.BASE_URL || "");
  const created = new Date().toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi", year: "numeric", month: "long", day: "numeric" });
  const expires = new Date(quote.expiresAt).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi", year: "numeric", month: "long", day: "numeric" });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#20242a;font-size:12px;line-height:1.5}
    h1{color:#b83f0c;font-size:24px;margin:0}.muted{color:#68717c}.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #c84b17;padding-bottom:14px;margin-bottom:18px}
    .meta{text-align:right}.box{background:#f6f7f8;border-radius:8px;padding:12px 14px;margin:14px 0}table{width:100%;border-collapse:collapse;margin:16px 0}th{text-align:left;background:#fff1e8;color:#87300c}th,td{padding:9px;border-bottom:1px solid #e5e7eb}td:nth-child(n+2),th:nth-child(n+2){text-align:right}.total{font-size:17px;font-weight:700;text-align:right;border-top:2px solid #c84b17;padding-top:12px}.notice{margin-top:24px;padding:12px;border:1px solid #f1c3a8;border-radius:8px;background:#fff8f3}.footer{margin-top:30px;color:#68717c;font-size:10px;text-align:center}
  </style></head><body>
    <div class="head"><div>${logo}<h1>Repair estimate</h1><div>${escapeHtml(storeName)}</div></div><div class="meta"><strong>Reference</strong><br>${escapeHtml(String(ticket.id))}<br><strong>Quote version</strong> ${quote.version}<br><span class="muted">Prepared ${escapeHtml(created)} · Valid until ${escapeHtml(expires)}</span></div></div>
    <div class="box"><strong>Customer</strong><br>${escapeHtml(String(ticket.customerName || "Customer"))}<br><br><strong>Device</strong><br>${escapeHtml(device)}<br><br><strong>Request</strong><br>${escapeHtml(issue)}</div>
    <table><thead><tr><th>Description</th><th>Qty</th><th>Unit cost</th><th>Line total</th></tr></thead><tbody>
      <tr><td>Service and listed add-ons</td><td>1</td><td>${money(ticket.laborCost, currency)}</td><td>${money(ticket.laborCost, currency)}</td></tr>${partsRows}
    </tbody></table>
    <div class="total">Estimated total: ${money(ticket.totalCost, currency)}</div>
    <div class="notice"><strong>Estimate only.</strong> This document is not an invoice or proof of payment. It is valid until ${escapeHtml(expires)}. Please review and accept the estimate in your customer repair portal before work begins. Any additional work or cost requires your approval.</div>
    <div class="footer">${escapeHtml(storeName)} · Repair reference ${escapeHtml(String(ticket.id))}</div>
  </body></html>`;
  return htmlToPdf(html);
}
