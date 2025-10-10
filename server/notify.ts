import fs from "fs";
import path from "path";

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

interface MailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
}

let transporter: any = null;
try {
  const nodemailer = require("nodemailer");
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "1" || false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
} catch (_err) {
  // nodemailer not installed — fallback to logging
}

function writeLog(entry: string): void {
  try {
    const dir = path.join(__dirname, "..", "data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "emails.log");
    fs.appendFileSync(file, `${new Date().toISOString()} ${entry}\n\n`);
  } catch (e) {
    console.error("Failed to write email log", e);
  }
}

async function sendMail(message: MailMessage): Promise<boolean> {
  if (transporter) {
    try {
      await transporter.sendMail(message);
      return true;
    } catch (err) {
      console.error("Email send failed", err);
      writeLog(JSON.stringify(message, null, 2));
      return false;
    }
  }
  writeLog(JSON.stringify(message, null, 2));
  return false;
}

function formatRepairEmail(ticket: Ticket): MailMessage {
  return {
    from: process.env.FROM_EMAIL || "no-reply@example.com",
    to: ticket.customerEmail,
    subject: `Repair ticket ${ticket.id} received`,
    text: `Hello ${ticket.customerName},\n\nYour repair ticket ${ticket.id} has been created.\n\nDevice: ${ticket.deviceType} ${ticket.deviceModel || ""}\nProblem: ${ticket.issueDescription}\nStatus: ${ticket.statusLabel}\n\nWe will update you with any progress.\n\nThanks,\nSupport Team`,
  };
}

function formatUpdateEmail(ticket: Ticket, update: { message: string }): MailMessage {
  return {
    from: process.env.FROM_EMAIL || "no-reply@example.com",
    to: ticket.customerEmail,
    subject: `Update for repair ${ticket.id}: ${ticket.statusLabel}`,
    text: `Hello ${ticket.customerName},\n\nThere's an update on your repair ${ticket.id}:\n\n${update.message}\n\nStatus: ${ticket.statusLabel}\n\nRegards,\nSupport Team`,
  };
}

function formatPasswordResetEmail(customer: Customer, link: string): MailMessage {
  return {
    from: process.env.FROM_EMAIL || "no-reply@example.com",
    to: customer.email,
    subject: `Reset your password for ${process.env.SITE_NAME || "Gear&Glitch"}`,
    text: `Hello ${customer.name},\n\nYou requested a password reset. Click the link below to set a new password:\n\n${link}\n\nIf you did not request this, you can ignore this email.\n\nThanks,\nSupport Team`,
  };
}

function formatMagicLinkEmail(customer: Customer, link: string): MailMessage {
  return {
    from: process.env.FROM_EMAIL || "no-reply@example.com",
    to: customer.email,
    subject: `Sign in to ${process.env.SITE_NAME || "Gear&Glitch"}`,
    text: `Hello ${customer.name},\n\nClick the link below to sign in:\n\n${link}\n\nThis link will expire shortly.\n\nThanks,\nSupport Team`,
  };
}

const sendNewRepairEmail = async (ticket: Ticket): Promise<boolean> => {
  return sendMail(formatRepairEmail(ticket));
};

const sendRepairUpdateEmail = async (ticket: Ticket, update: { message: string }): Promise<boolean> => {
  return sendMail(formatUpdateEmail(ticket, update));
};

const sendPasswordResetEmail = async (customer: Customer, link: string): Promise<boolean> => {
  return sendMail(formatPasswordResetEmail(customer, link));
};

const sendMagicLinkEmail = async (customer: Customer, link: string): Promise<boolean> => {
  return sendMail(formatMagicLinkEmail(customer, link));
};

interface ProviderInfo {
  email: string;
  companyName: string;
  contactName: string;
}

function formatProviderWelcomeEmail(provider: ProviderInfo): MailMessage {
  return {
    from: process.env.FROM_EMAIL || "no-reply@example.com",
    to: provider.email,
    subject: `Welcome to ${process.env.SITE_NAME || "Gear&Glitch"}`,
    text: `Hello ${provider.contactName},\n\nWelcome to ${process.env.SITE_NAME || "Gear&Glitch"}! Your provider account for ${provider.companyName} has been created.\n\nYou can log in at: ${process.env.BASE_URL || "http://localhost:8020"}/provider/\n\nRegards,\nSupport Team`,
  };
}

function formatProviderPlanChangedEmail(provider: ProviderInfo, planName: string): MailMessage {
  return {
    from: process.env.FROM_EMAIL || "no-reply@example.com",
    to: provider.email,
    subject: `Subscription updated for ${process.env.SITE_NAME || "Gear&Glitch"}`,
    text: `Hello ${provider.contactName},\n\nYour subscription for ${provider.companyName} has been updated to the ${planName} plan.\n\nView your subscription: ${process.env.BASE_URL || "http://localhost:8020"}/provider/\n\nRegards,\nSupport Team`,
  };
}

function formatInvoiceEmail(provider: ProviderInfo, amount: number, periodEnd: string): MailMessage {
  return {
    from: process.env.FROM_EMAIL || "no-reply@example.com",
    to: provider.email,
    subject: `Invoice from ${process.env.SITE_NAME || "Gear&Glitch"}`,
    text: `Hello ${provider.contactName},\n\nAn invoice for ${provider.companyName} has been generated for £${amount.toFixed(2)}.\n\nDue: ${periodEnd}\n\nView your invoices: ${process.env.BASE_URL || "http://localhost:8020"}/provider/\n\nRegards,\nSupport Team`,
  };
}

const sendProviderWelcomeEmail = async (provider: ProviderInfo): Promise<boolean> => {
  return sendMail(formatProviderWelcomeEmail(provider));
};

const sendProviderPlanChangedEmail = async (provider: ProviderInfo, planName: string): Promise<boolean> => {
  return sendMail(formatProviderPlanChangedEmail(provider, planName));
};

const sendInvoiceEmail = async (provider: ProviderInfo, amount: number, periodEnd: string): Promise<boolean> => {
  return sendMail(formatInvoiceEmail(provider, amount, periodEnd));
};

export { sendNewRepairEmail, sendRepairUpdateEmail, sendPasswordResetEmail, sendMagicLinkEmail, sendProviderWelcomeEmail, sendProviderPlanChangedEmail, sendInvoiceEmail };
