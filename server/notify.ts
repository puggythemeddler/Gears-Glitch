import { getSettings } from "./db";
import { sendEmail, resetTransporter } from "./email";

interface Ticket {
  id: string;
  customerEmail: string;
  customerName: string;
  deviceType: string;
  deviceModel?: string;
  issueDescription: string;
  statusLabel: string;
}

interface Customer {
  email: string;
  name: string;
}

interface ProviderInfo {
  email: string;
  companyName: string;
  contactName: string;
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatRepairHtml(ticket: Ticket): string {
  return `<h2>Repair Ticket ${esc(ticket.id)}</h2><p>Hello ${esc(ticket.customerName)},</p><p>Your repair ticket <strong>${esc(ticket.id)}</strong> has been created.</p><table style="border-collapse:collapse"><tr><td style="padding:4px 8px;border:1px solid #ddd"><b>Device</b></td><td style="padding:4px 8px;border:1px solid #ddd">${esc(ticket.deviceType)} ${esc(ticket.deviceModel || "")}</td></tr><tr><td style="padding:4px 8px;border:1px solid #ddd"><b>Problem</b></td><td style="padding:4px 8px;border:1px solid #ddd">${esc(ticket.issueDescription)}</td></tr><tr><td style="padding:4px 8px;border:1px solid #ddd"><b>Status</b></td><td style="padding:4px 8px;border:1px solid #ddd">${esc(ticket.statusLabel)}</td></tr></table><p>We will update you with any progress.</p><p>Thanks,<br/>Support Team</p>`;
}

function formatUpdateHtml(ticket: Ticket, update: { message: string }): string {
  return `<h2>Update for Repair ${esc(ticket.id)}</h2><p>Hello ${esc(ticket.customerName)},</p><p>There's an update on your repair <strong>${esc(ticket.id)}</strong>:</p><blockquote style="border-left:3px solid #4caf50;padding:8px 16px;margin:16px 0;background:#f9f9f9">${esc(update.message)}</blockquote><p>Status: <strong>${esc(ticket.statusLabel)}</strong></p><p>Regards,<br/>Support Team</p>`;
}

function formatPasswordResetHtml(customer: Customer, link: string): string {
  return `<h2>Password Reset</h2><p>Hello ${esc(customer.name)},</p><p>You requested a password reset. Click the button below to set a new password:</p><p style="text-align:center;margin:24px 0"><a href="${esc(link)}" style="background:#4caf50;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Reset Password</a></p><p style="color:#999;font-size:12px">If you did not request this, you can ignore this email.</p><p>Thanks,<br/>Support Team</p>`;
}

function formatMagicLinkHtml(customer: Customer, link: string): string {
  return `<h2>Sign In</h2><p>Hello ${esc(customer.name)},</p><p>Click the button below to sign in:</p><p style="text-align:center;margin:24px 0"><a href="${esc(link)}" style="background:#4caf50;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Sign In</a></p><p style="color:#999;font-size:12px">This link will expire shortly.</p><p>Thanks,<br/>Support Team</p>`;
}

function formatProviderWelcomeHtml(provider: ProviderInfo): string {
  return `<h2>Welcome!</h2><p>Hello ${esc(provider.contactName)},</p><p>Welcome to <strong>${esc(process.env.SITE_NAME || "Gear&Glitch")}</strong>! Your provider account for <strong>${esc(provider.companyName)}</strong> has been created.</p><p>You can log in at: <a href="${esc(process.env.BASE_URL || "http://localhost:8020")}/provider/">${esc(process.env.BASE_URL || "http://localhost:8020")}/provider/</a></p><p>Regards,<br/>Support Team</p>`;
}

function formatProviderPlanChangedHtml(provider: ProviderInfo, planName: string): string {
  return `<h2>Subscription Updated</h2><p>Hello ${esc(provider.contactName)},</p><p>Your subscription for <strong>${esc(provider.companyName)}</strong> has been updated to the <strong>${esc(planName)}</strong> plan.</p><p>View your subscription: <a href="${esc(process.env.BASE_URL || "http://localhost:8020")}/provider/">${esc(process.env.BASE_URL || "http://localhost:8020")}/provider/</a></p><p>Regards,<br/>Support Team</p>`;
}

function formatInvoiceHtml(provider: ProviderInfo, amount: number, periodEnd: string): string {
  return `<h2>Invoice</h2><p>Hello ${esc(provider.contactName)},</p><p>An invoice for <strong>${esc(provider.companyName)}</strong> has been generated for <strong>KES ${amount.toFixed(2)}</strong>.</p><p>Due: ${esc(periodEnd)}</p><p>View your invoices: <a href="${esc(process.env.BASE_URL || "http://localhost:8020")}/provider/">${esc(process.env.BASE_URL || "http://localhost:8020")}/provider/</a></p><p>Regards,<br/>Support Team</p>`;
}

const sendNewRepairEmail = async (ticket: Ticket): Promise<boolean> => {
  const s = await getSettings();
  const storeName = s.storeName || "Gear&Glitch";
  return sendEmail(ticket.customerEmail, `Repair ticket ${ticket.id} received`, formatRepairHtml(ticket), "repair");
};

const sendRepairUpdateEmail = async (ticket: Ticket, update: { message: string }): Promise<boolean> => {
  return sendEmail(ticket.customerEmail, `Update for repair ${ticket.id}: ${ticket.statusLabel}`, formatUpdateHtml(ticket, update), "repair_update");
};

const sendPasswordResetEmail = async (customer: Customer, link: string): Promise<boolean> => {
  const s = await getSettings();
  const storeName = s.storeName || "Gear&Glitch";
  return sendEmail(customer.email, `Reset your password for ${storeName}`, formatPasswordResetHtml(customer, link), "password_reset");
};

const sendMagicLinkEmail = async (customer: Customer, link: string): Promise<boolean> => {
  const s = await getSettings();
  const storeName = s.storeName || "Gear&Glitch";
  return sendEmail(customer.email, `Sign in to ${storeName}`, formatMagicLinkHtml(customer, link), "magic_link");
};

const sendProviderWelcomeEmail = async (provider: ProviderInfo): Promise<boolean> => {
  return sendEmail(provider.email, `Welcome to ${process.env.SITE_NAME || "Gear&Glitch"}`, formatProviderWelcomeHtml(provider), "provider_welcome");
};

const sendProviderPlanChangedEmail = async (provider: ProviderInfo, planName: string): Promise<boolean> => {
  return sendEmail(provider.email, `Subscription updated for ${process.env.SITE_NAME || "Gear&Glitch"}`, formatProviderPlanChangedHtml(provider, planName), "provider_plan_changed");
};

const sendInvoiceEmail = async (provider: ProviderInfo, amount: number, periodEnd: string): Promise<boolean> => {
  return sendEmail(provider.email, `Invoice from ${process.env.SITE_NAME || "Gear&Glitch"}`, formatInvoiceHtml(provider, amount, periodEnd), "invoice");
};

export { sendNewRepairEmail, sendRepairUpdateEmail, sendPasswordResetEmail, sendMagicLinkEmail, sendProviderWelcomeEmail, sendProviderPlanChangedEmail, sendInvoiceEmail, resetTransporter };
