import { getSettings, logEmail } from "./db";

let transporter: any = null;
let nodemailer: any = null;

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

try {
  nodemailer = require("nodemailer");
} catch (_err) {}

async function getTransporter(): Promise<any> {
  if (transporter) return transporter;
  if (!nodemailer) return null;
  const s = await getSettings();
  const host = process.env.SMTP_HOST || "";
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const smtpUser = s.emailSender || user;
  if (!host || !smtpUser) return null;
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "1" || false,
    auth: { user: smtpUser, pass },
  });
  return transporter;
}

export function resetTransporter(): void {
  transporter = null;
}

export async function sendEmail(to: string, subject: string, html: string, type: string = "general"): Promise<boolean> {
  const s = await getSettings();
  if (s.emailNotificationsEnabled === false) {
    await logEmail(to, s.emailSender || "", subject, html, type, "disabled");
    return false;
  }
  const from = s.emailSender || process.env.FROM_EMAIL || "no-reply@example.com";
  const fromName = s.emailSenderName || s.storeName || "Gear&Glitch";
  const fromField = `"${fromName}" <${from}>`;
  const transport = await getTransporter();
  if (!transport) {
    console.log(`[Email] No SMTP configured. Would send to=${to} subject="${subject}" type=${type}`);
    await logEmail(to, from, subject, html, type, "no_smtp");
    return false;
  }
  try {
    await transport.sendMail({ from: fromField, to, subject, html });
    console.log(`[Email] Sent to=${to} subject="${subject}" type=${type}`);
    await logEmail(to, from, subject, html, type, "sent");
    return true;
  } catch (err: any) {
    console.error(`[Email] Failed to send to=${to}:`, err.message || err);
    await logEmail(to, from, subject, html, type, "failed", err.message || String(err));
    return false;
  }
}

function wrapTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;">
<div style="max-width:600px;margin:24px auto;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">
<div style="background:#1e293b;padding:20px 24px;"><h1 style="margin:0;color:#f8fafc;font-size:18px;">${title}</h1></div>
<div style="padding:24px;color:#334155;font-size:14px;line-height:1.6;">${bodyHtml}</div>
<div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;font-size:12px;color:#94a3b8;text-align:center;">Automated Notification</div>
</div></body></html>`;
}

export function messageNotificationEmail(senderName: string, senderRole: string, subject: string, preview: string, dashboardUrl: string): { subject: string; html: string } {
  const title = `New message from ${esc(senderName)}`;
  const html = wrapTemplate(title, `
<p>You have a new message from <strong>${esc(senderName)}</strong> (${esc(senderRole)}):</p>
${subject ? `<p><strong>Subject:</strong> ${esc(subject)}</p>` : ""}
<div style="background:#f1f5f9;padding:12px 16px;margin:16px 0;border-radius:6px;white-space:pre-wrap;">${esc(preview)}</div>
<p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">View & Reply</a></p>
`);
  return { subject: title, html };
}

export function quoteEmail(customerName: string, quoteNumber: string, total: string, currency: string, notes: string, dashboardUrl: string, storeName: string = "My Shop"): { subject: string; html: string } {
  const title = `Quote ${esc(quoteNumber)} from ${esc(storeName)}`;
  const html = wrapTemplate(title, `
<p>Hi ${esc(customerName)},</p>
<p>A new quote has been prepared for you.</p>
<div style="background:#f1f5f9;padding:16px;margin:16px 0;border-radius:6px;">
<p style="margin:0;"><strong>Quote:</strong> ${esc(quoteNumber)}</p>
<p style="margin:8px 0 0;"><strong>Total:</strong> ${esc(currency)} ${esc(total)}</p>
${notes ? `<p style="margin:8px 0 0;"><strong>Notes:</strong> ${esc(notes)}</p>` : ""}
</div></div>
<p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">View Quote</a></p>
`);
  return { subject: title, html };
}

export function creditNoteEmail(customerName: string, creditNoteId: number, reason: string, amount: string, currency: string, dashboardUrl: string, storeName: string = "My Shop"): { subject: string; html: string } {
  const title = `Credit Note #${creditNoteId} — ${esc(storeName)}`;
  const html = wrapTemplate(title, `
<p>Hi ${esc(customerName)},</p>
<p>A credit note has been issued for your order.</p>
<div style="background:#f1f5f9;padding:16px;margin:16px 0;border-radius:6px;">
<p style="margin:0;"><strong>Credit Note:</strong> #${creditNoteId}</p>
<p style="margin:8px 0 0;"><strong>Amount:</strong> ${esc(currency)} ${esc(amount)}</p>
${reason ? `<p style="margin:8px 0 0;"><strong>Reason:</strong> ${esc(reason)}</p>` : ""}
</div>
<p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">View Details</a></p>
`);
  return { subject: title, html };
}

export function orderStatusEmail(customerName: string, orderNumber: string, status: string, dashboardUrl: string): { subject: string; html: string } {
  const statusLabels: Record<string, string> = { pending: "Pending", confirmed: "Confirmed", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };
  const title = `Order ${esc(orderNumber)} — ${statusLabels[status] || status}`;
  const html = wrapTemplate(title, `
<p>Hi ${esc(customerName)},</p>
<p>Your order <strong>${esc(orderNumber)}</strong> has been updated.</p>
<div style="background:#f1f5f9;padding:16px;margin:16px 0;border-radius:6px;text-align:center;">
<p style="margin:0;font-size:16px;font-weight:700;color:${status === "cancelled" ? "#dc2626" : "#16a34a"};">${esc(statusLabels[status] || status)}</p>
</div>
<p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">View Order</a></p>
`);
  return { subject: title, html };
}

export function subscriptionInvoiceEmail(customerName: string, invoiceNumber: string, planName: string, amount: string, currency: string, dueDate: string, dashboardUrl: string): { subject: string; html: string } {
  const title = `Invoice ${esc(invoiceNumber)} — ${esc(planName)} Plan`;
  const html = wrapTemplate(title, `
<p>Hi ${esc(customerName)},</p>
<p>Your subscription invoice for <strong>${esc(planName)}</strong> is ready.</p>
<div style="background:#f1f5f9;padding:16px;margin:16px 0;border-radius:6px;">
<p style="margin:0;"><strong>Invoice:</strong> ${esc(invoiceNumber)}</p>
<p style="margin:8px 0 0;"><strong>Plan:</strong> ${esc(planName)}</p>
<p style="margin:8px 0 0;"><strong>Amount:</strong> ${esc(currency)} ${esc(amount)}</p>
${dueDate ? `<p style="margin:8px 0 0;"><strong>Due Date:</strong> ${esc(dueDate)}</p>` : ""}
</div>
<p>Please ensure payment is made by the due date to avoid service interruption.</p>
<p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">View Invoice</a></p>
`);
  return { subject: title, html };
}

export function subscriptionOverdueEmail(customerName: string, invoiceNumber: string, planName: string, amount: string, currency: string, overdueDays: number, dashboardUrl: string): { subject: string; html: string } {
  const title = `OVERDUE: Invoice ${esc(invoiceNumber)} — Payment Required`;
  const html = wrapTemplate(title, `
<p>Hi ${esc(customerName)},</p>
<p style="color:#dc2626;font-weight:600;">Your subscription invoice is ${overdueDays} day${overdueDays > 1 ? "s" : ""} overdue.</p>
<div style="background:#fef2f2;border:1px solid #fecaca;padding:16px;margin:16px 0;border-radius:6px;">
<p style="margin:0;"><strong>Invoice:</strong> ${esc(invoiceNumber)}</p>
<p style="margin:8px 0 0;"><strong>Plan:</strong> ${esc(planName)}</p>
<p style="margin:8px 0 0;"><strong>Amount:</strong> ${esc(currency)} ${esc(amount)}</p>
<p style="margin:8px 0 0;"><strong>Overdue by:</strong> ${overdueDays} day${overdueDays > 1 ? "s" : ""}</p>
</div>
<p style="color:#dc2626;">If payment is not received within 7 days of the due date, your service may be suspended.</p>
<p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Pay Now</a></p>
`);
  return { subject: title, html };
}
