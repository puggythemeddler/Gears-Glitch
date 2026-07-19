import crypto from "crypto";
import fs from "fs";
import path from "path";

interface MpesaConfig {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  tillNumber: string;
  env: "sandbox" | "production";
}

let config: MpesaConfig = {
  consumerKey: process.env.MPESA_CONSUMER_KEY || "",
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || "",
  passkey: process.env.MPESA_PASSKEY || "",
  shortcode: process.env.MPESA_SHORTCODE || "174379",
  tillNumber: process.env.MPESA_TILL_NUMBER || "",
  env: (process.env.MPESA_ENV as "sandbox" | "production") || "sandbox",
};

let cachedToken: { token: string; expiresAt: number } | null = null;

function getBaseUrl(): string {
  return config.env === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

export function updateMpesaConfig(updates: Partial<MpesaConfig>): void {
  config = { ...config, ...updates };
  cachedToken = null;
}

export function getMpesaConfig(): MpesaConfig {
  return { ...config };
}

export function isMpesaConfigured(): boolean {
  return !!(config.consumerKey && config.consumerSecret && config.shortcode);
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const res = await fetch(`${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`M-Pesa auth failed (${res.status})`);
  const data = await res.json() as any;
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

function generatePassword(): { password: string; timestamp: string } {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const raw = `${config.shortcode}${config.passkey}${timestamp}`;
  return { password: Buffer.from(raw).toString("base64"), timestamp };
}

function maskSensitive(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  const masked = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(masked)) {
    if (["phone", "PhoneNumber", "PartyA", "partyA"].includes(key) && typeof masked[key] === "string") {
      const v = masked[key];
      masked[key] = v.length > 4 ? v.slice(0, -4).replace(/\d/g, "X") + v.slice(-4) : v;
    } else if (typeof masked[key] === "object") {
      masked[key] = maskSensitive(masked[key]);
    }
  }
  return masked;
}

async function logTransaction(data: any): Promise<void> {
  const logPath = path.join(__dirname, "..", "data", "mpesa.log");
  const line = `[${new Date().toISOString()}] ${JSON.stringify(maskSensitive(data))}\n`;
  fs.appendFileSync(logPath, line, "utf-8");
}

export async function stkPush(phone: string, amount: number, accountRef: string, callbackUrl: string): Promise<any> {
  const { password, timestamp } = generatePassword();
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const partyA = cleanPhone.startsWith("254") ? cleanPhone : `254${cleanPhone.replace(/^0?/, "")}`;

  if (!isMpesaConfigured()) {
    const simulated = {
      success: true,
      simulated: true,
      merchantRequestId: `SIM${Date.now()}`,
      checkoutRequestId: `SIM${Date.now()}`,
      responseDescription: "Success (simulated — M-Pesa not configured)",
      customerMessage: "We've received your payment request. You'll receive an STK push on your phone.",
      amount,
      phone: partyA,
      accountRef,
      timestamp,
    };
    await logTransaction(simulated);
    return simulated;
  }

  const token = await getAccessToken();
  const body = {
    BusinessShortCode: config.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.round(amount),
    PartyA: partyA,
    PartyB: config.shortcode,
    PhoneNumber: partyA,
    CallBackURL: callbackUrl,
    AccountReference: accountRef.slice(0, 12),
    TransactionDesc: "Laptop Store Purchase",
  };

  const res = await fetch(`${getBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  await logTransaction({ request: body, response: data });
  if (!res.ok) throw new Error(data.errorMessage || "M-Pesa STK Push failed");
  return { ...data, amount, phone: partyA };
}

export async function queryStatus(checkoutRequestId: string): Promise<any> {
  const { password, timestamp } = generatePassword();

  if (!isMpesaConfigured()) {
    return { success: true, simulated: true, resultCode: "0", resultDesc: "Success (simulated)" };
  }

  const token = await getAccessToken();
  const body = {
    BusinessShortCode: config.shortcode,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  };

  const res = await fetch(`${getBaseUrl()}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}
