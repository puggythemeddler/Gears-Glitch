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

export function newOrderAdminEmail(orderNumber: string, customerName: string, total: string, currency: string, itemCount: number, dashboardUrl: string, source: string = "storefront", storeName: string = "My Shop"): { subject: string; html: string } {
  const title = `New order ${esc(orderNumber)} — ${esc(storeName)}`;
  const html = wrapTemplate(title, `
<p>You have a new <strong>${esc(source)}</strong> order from <strong>${esc(customerName)}</strong>.</p>
<div style="background:#f1f5f9;padding:16px;margin:16px 0;border-radius:6px;">
<p style="margin:0;"><strong>Order:</strong> ${esc(orderNumber)}</p>
<p style="margin:8px 0 0;"><strong>Customer:</strong> ${esc(customerName)}</p>
<p style="margin:8px 0 0;"><strong>Items:</strong> ${itemCount}</p>
<p style="margin:8px 0 0;font-size:16px;font-weight:700;"><strong>Total:</strong> ${esc(currency)} ${esc(total)}</p>
</div>
<p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Open Admin → Orders</a></p>
`);
  return { subject: title, html };
}

export function orderPaidAdminEmail(orderNumber: string, customerName: string, total: string, currency: string, receipt: string, dashboardUrl: string, storeName: string = "My Shop"): { subject: string; html: string } {
  const title = `Payment received for order ${esc(orderNumber)} — ${esc(storeName)}`;
  const html = wrapTemplate(title, `
<p>Payment has been received for order <strong>${esc(orderNumber)}</strong>.</p>
<div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:16px;margin:16px 0;border-radius:6px;">
<p style="margin:0;"><strong>Order:</strong> ${esc(orderNumber)}</p>
<p style="margin:8px 0 0;"><strong>Customer:</strong> ${esc(customerName)}</p>
<p style="margin:8px 0 0;"><strong>Amount:</strong> ${esc(currency)} ${esc(total)}</p>
${receipt ? `<p style="margin:8px 0 0;"><strong>Receipt:</strong> ${esc(receipt)}</p>` : ""}
</div>
<p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Open Admin → Orders</a></p>
`);
  return { subject: title, html };
}

export function customerActivityAdminEmail(name: string, email: string, action: "registered" | "login", method: "password" | "google", dashboardUrl: string, storeName: string = "My Shop"): { subject: string; html: string } {
  const isNew = action === "registered";
  const title = isNew ? `New customer signed up — ${esc(storeName)}` : `Customer sign-in — ${esc(storeName)}`;
  const badge = isNew ? "New account created" : "Signed in";
  const html = wrapTemplate(title, `
<p><strong>${esc(badge)}</strong>${isNew ? "" : " to the store"}:</p>
<div style="background:#f1f5f9;padding:16px;margin:16px 0;border-radius:6px;">
<p style="margin:0;"><strong>Name:</strong> ${esc(name)}</p>
<p style="margin:8px 0 0;"><strong>Email:</strong> ${esc(email)}</p>
<p style="margin:8px 0 0;"><strong>Via:</strong> ${method === "google" ? "Google" : "Password"}</p>
</div>
<p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Open Admin → Customers</a></p>
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

// ─── Repair Notification Emails ───────────────────────────────────────────────

export function repairCreatedAdminEmail(ticketId: string, customerName: string, deviceType: string, deviceModel: string, issueDescription: string, dashboardUrl: string, storeName: string = "My Shop"): { subject: string; html: string } {
  const title = `New repair ticket ${esc(ticketId)} — ${esc(storeName)}`;
  const html = wrapTemplate(title, `
<p>A new repair ticket has been created.</p>
<div style="background:#f1f5f9;padding:16px;margin:16px 0;border-radius:6px;">
<p style="margin:0;"><strong>Ticket:</strong> ${esc(ticketId)}</p>
<p style="margin:8px 0 0;"><strong>Customer:</strong> ${esc(customerName)}</p>
<p style="margin:8px 0 0;"><strong>Device:</strong> ${esc(deviceType)} ${esc(deviceModel)}</p>
<p style="margin:8px 0 0;"><strong>Issue:</strong> ${esc(issueDescription).substring(0, 200)}</p>
</div>
<p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Open Admin → Repairs</a></p>
`);
  return { subject: title, html };
}

export function repairStatusAdminEmail(ticketId: string, customerName: string, deviceType: string, deviceModel: string, oldStatus: string, newStatus: string, dashboardUrl: string, storeName: string = "My Shop"): { subject: string; html: string } {
  const title = `Repair ${esc(ticketId)}: ${esc(oldStatus)} → ${esc(newStatus)} — ${esc(storeName)}`;
  const html = wrapTemplate(title, `
<p>A repair ticket status has changed.</p>
<div style="background:#f1f5f9;padding:16px;margin:16px 0;border-radius:6px;">
<p style="margin:0;"><strong>Ticket:</strong> ${esc(ticketId)}</p>
<p style="margin:8px 0 0;"><strong>Customer:</strong> ${esc(customerName)}</p>
<p style="margin:8px 0 0;"><strong>Device:</strong> ${esc(deviceType)} ${esc(deviceModel)}</p>
<p style="margin:8px 0 0;"><strong>Status:</strong> ${esc(oldStatus)} → <strong>${esc(newStatus)}</strong></p>
</div>
<p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Open Admin → Repairs</a></p>
`);
  return { subject: title, html };
}

export function repairQuoteAdminEmail(ticketId: string, customerName: string, deviceType: string, deviceModel: string, totalCost: number, currency: string, dashboardUrl: string, storeName: string = "My Shop"): { subject: string; html: string } {
  const title = `Repair quote sent: ${esc(ticketId)} — ${esc(storeName)}`;
  const html = wrapTemplate(title, `
<p>A repair quote has been sent to the customer.</p>
<div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:16px;margin:16px 0;border-radius:6px;">
<p style="margin:0;"><strong>Ticket:</strong> ${esc(ticketId)}</p>
<p style="margin:8px 0 0;"><strong>Customer:</strong> ${esc(customerName)}</p>
<p style="margin:8px 0 0;"><strong>Device:</strong> ${esc(deviceType)} ${esc(deviceModel)}</p>
<p style="margin:8px 0 0;font-size:16px;font-weight:700;"><strong>Total:</strong> ${esc(currency)} ${totalCost.toFixed(2)}</p>
</div>
<p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Open Admin → Repairs</a></p>
`);
  return { subject: title, html };
}

// ─── Warranty Notification Emails ─────────────────────────────────────────────

export function warrantyClaimAdminEmail(claimId: number, warrantyRef: string, customerName: string, serialNumber: string, notes: string, dashboardUrl: string, storeName: string = "My Shop"): { subject: string; html: string } {
  const title = `New warranty claim #${claimId} — ${esc(storeName)}`;
  const html = wrapTemplate(title, `
<p>A new warranty claim has been submitted.</p>
<div style="background:#f1f5f9;padding:16px;margin:16px 0;border-radius:6px;">
<p style="margin:0;"><strong>Claim:</strong> #${claimId}</p>
<p style="margin:8px 0 0;"><strong>Reference:</strong> ${esc(warrantyRef)}</p>
<p style="margin:8px 0 0;"><strong>Customer:</strong> ${esc(customerName)}</p>
<p style="margin:8px 0 0;"><strong>Serial:</strong> ${esc(serialNumber)}</p>
${notes ? `<p style="margin:8px 0 0;"><strong>Notes:</strong> ${esc(notes).substring(0, 200)}</p>` : ""}
</div>
<p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Open Admin → Warranties</a></p>
`);
  return { subject: title, html };
}

export function warrantyStatusAdminEmail(claimId: number, warrantyRef: string, customerName: string, oldStatus: string, newStatus: string, dashboardUrl: string, storeName: string = "My Shop"): { subject: string; html: string } {
  const title = `Warranty claim #${claimId}: ${esc(oldStatus)} → ${esc(newStatus)} — ${esc(storeName)}`;
  const html = wrapTemplate(title, `
<p>A warranty claim status has changed.</p>
<div style="background:#f1f5f9;padding:16px;margin:16px 0;border-radius:6px;">
<p style="margin:0;"><strong>Claim:</strong> #${claimId}</p>
<p style="margin:8px 0 0;"><strong>Reference:</strong> ${esc(warrantyRef)}</p>
<p style="margin:8px 0 0;"><strong>Customer:</strong> ${esc(customerName)}</p>
<p style="margin:8px 0 0;"><strong>Status:</strong> ${esc(oldStatus)} → <strong>${esc(newStatus)}</strong></p>
</div>
<p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Open Admin → Warranties</a></p>
`);
  return { subject: title, html };
}

// ─── Customer-facing Notification Emails ─────────────────────────────────────
// Personalized (greeting uses the customer's name — never "Dear Customer"),
// escaped, and free of internal admin links. Device details are only shown
// when they actually exist on the order.

export interface CustomerDeviceInfo {
  name: string;
  serialNumber?: string;
  warrantyStatus?: "active" | "expiring" | "expired" | "none";
  warrantyStart?: string;
  warrantyExpiry?: string;
}

function warrantyBadge(device: CustomerDeviceInfo): string {
  if (!device.warrantyStatus || device.warrantyStatus === "none") return "";
  const map: Record<string, { label: string; bg: string; color: string }> = {
    active:   { label: "Under warranty", bg: "#f0fdf4", color: "#16a34a" },
    expiring: { label: "Warranty expiring soon", bg: "#fffbeb", color: "#d97706" },
    expired:  { label: "Warranty expired", bg: "#fef2f2", color: "#dc2626" },
  };
  const m = map[device.warrantyStatus];
  if (!m) return "";
  const dates = [device.warrantyStart ? `from ${esc(device.warrantyStart)}` : "", device.warrantyExpiry ? `until ${esc(device.warrantyExpiry)}` : ""].filter(Boolean).join(" ");
  return `<div style="margin-top:4px;"><span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;background:${m.bg};color:${m.color};">${m.label}</span>${dates ? `<span style="font-size:12px;color:#64748b;margin-left:6px;">${dates}</span>` : ""}</div>`;
}

function deviceRows(devices: CustomerDeviceInfo[]): string {
  if (!devices.length) return "";
  return devices.map((d) => `
<div style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px 14px;margin:8px 0;border-radius:6px;">
<p style="margin:0;font-weight:600;">${esc(d.name)}</p>
${d.serialNumber ? `<p style="margin:4px 0 0;font-size:13px;color:#475569;"><strong>Serial:</strong> ${esc(d.serialNumber)}</p>` : ""}
${warrantyBadge(d)}
</div>`).join("");
}

export function welcomeCustomerEmail(customerName: string, storeName: string, dashboardUrl: string): { subject: string; html: string } {
  const title = `Welcome to ${esc(storeName)}`;
  const html = wrapTemplate(title, `
<p>Hi ${esc(customerName)},</p>
<p>Thanks for creating an account with <strong>${esc(storeName)}</strong>. You can now track orders, warranties and repair tickets in one place.</p>
<p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Go to your dashboard</a></p>
`);
  return { subject: title, html };
}

export function orderProcessedCustomerEmail(customerName: string, orderNumber: string, devices: CustomerDeviceInfo[], total: string, currency: string, storeName: string, orderUrl: string): { subject: string; html: string } {
  const title = `Your order ${esc(orderNumber)} has been processed — ${esc(storeName)}`;
  const html = wrapTemplate(title, `
<p>Hi ${esc(customerName)},</p>
<p>Your order <strong>${esc(orderNumber)}</strong> has been processed. Here is what you purchased:</p>
${deviceRows(devices)}
<div style="background:#f1f5f9;padding:14px 16px;margin:16px 0;border-radius:6px;">
<p style="margin:0;font-size:16px;font-weight:700;"><strong>Total:</strong> ${esc(currency)} ${esc(total)}</p>
</div>
<p><a href="${orderUrl}" style="display:inline-block;padding:10px 20px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">View order</a></p>
`);
  return { subject: title, html };
}

export function warrantyReminderCustomerEmail(customerName: string, productName: string, serialNumber: string, expiryDate: string, daysLeft: number, storeName: string, orderUrl: string): { subject: string; html: string } {
  const title = `Warranty for ${esc(productName)} expires soon — ${esc(storeName)}`;
  const html = wrapTemplate(title, `
<p>Hi ${esc(customerName)},</p>
<p>The warranty on your <strong>${esc(productName)}</strong> will expire in <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong>.</p>
<div style="background:#fffbeb;border:1px solid #fde68a;padding:14px 16px;margin:16px 0;border-radius:6px;">
<p style="margin:0;"><strong>Product:</strong> ${esc(productName)}</p>
${serialNumber ? `<p style="margin:6px 0 0;"><strong>Serial:</strong> ${esc(serialNumber)}</p>` : ""}
<p style="margin:6px 0 0;"><strong>Expires:</strong> ${esc(expiryDate)}</p>
</div>
<p>If you need to report an issue, please contact us before the warranty expires.</p>
<p><a href="${orderUrl}" style="display:inline-block;padding:10px 20px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">View order</a></p>
`);
  return { subject: title, html };
}

export function warrantyExpiredCustomerEmail(customerName: string, productName: string, serialNumber: string, expiryDate: string, storeName: string): { subject: string; html: string } {
  const title = `Warranty for ${esc(productName)} has expired — ${esc(storeName)}`;
  const html = wrapTemplate(title, `
<p>Hi ${esc(customerName)},</p>
<p>The warranty on your <strong>${esc(productName)}</strong> expired on <strong>${esc(expiryDate)}</strong>.</p>
${serialNumber ? `<p style="font-size:13px;color:#475569;"><strong>Serial:</strong> ${esc(serialNumber)}</p>` : ""}
<p>We can still help with repairs — just book a repair ticket and we will take it from there.</p>
`);
  return { subject: title, html };
}

export function repairCustomerEmail(customerName: string, ticketId: string, deviceLabel: string, serialNumber: string, statusLabel: string, storeName: string, dashboardUrl: string): { subject: string; html: string } {
  const title = `Repair ${esc(ticketId)} — ${esc(statusLabel)} — ${esc(storeName)}`;
  const html = wrapTemplate(title, `
<p>Hi ${esc(customerName)},</p>
<p>Your repair ticket <strong>${esc(ticketId)}</strong> has been updated.</p>
<div style="background:#f1f5f9;padding:14px 16px;margin:16px 0;border-radius:6px;">
${deviceLabel ? `<p style="margin:0;"><strong>Device:</strong> ${esc(deviceLabel)}</p>` : ""}
${serialNumber ? `<p style="margin:6px 0 0;"><strong>Serial:</strong> ${esc(serialNumber)}</p>` : ""}
<p style="margin:6px 0 0;"><strong>Status:</strong> ${esc(statusLabel)}</p>
</div>
<p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">View your repairs</a></p>
`);
  return { subject: title, html };
}

export function warrantyClaimCustomerEmail(customerName: string, claimId: number, warrantyRef: string, serialNumber: string, statusLabel: string, storeName: string, dashboardUrl: string): { subject: string; html: string } {
  const title = `Warranty claim #${claimId} — ${esc(statusLabel)} — ${esc(storeName)}`;
  const html = wrapTemplate(title, `
<p>Hi ${esc(customerName)},</p>
<p>Your warranty claim has been updated.</p>
<div style="background:#f1f5f9;padding:14px 16px;margin:16px 0;border-radius:6px;">
<p style="margin:0;"><strong>Claim:</strong> #${claimId}</p>
<p style="margin:6px 0 0;"><strong>Reference:</strong> ${esc(warrantyRef)}</p>
${serialNumber ? `<p style="margin:6px 0 0;"><strong>Serial:</strong> ${esc(serialNumber)}</p>` : ""}
<p style="margin:6px 0 0;"><strong>Status:</strong> ${esc(statusLabel)}</p>
</div>
<p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">View your account</a></p>
`);
  return { subject: title, html };
}
