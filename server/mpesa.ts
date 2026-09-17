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

// Resolve the public HTTPS base that Safaricom will reach for the STK callback.
// Preference order (D-2): explicit MPESA_CALLBACK_URL > BASE_URL > the request's
// own scheme/host (trust-proxy aware on Render). A request-derived host is only a
// fallback — the app must not depend on it for production STK pushes.
export function callbackBaseUrl(req?: { protocol: string; host: string | undefined }): string {
  const configured = (process.env.MPESA_CALLBACK_URL || process.env.BASE_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  return `${req?.protocol || "https"}://${req?.host || "localhost:8020"}`;
}

export function getMpesaConfig(): MpesaConfig {
  return { ...config };
}

export function isMpesaConfigured(): boolean {
  return !!(config.consumerKey && config.consumerSecret && config.passkey && config.shortcode);
}

// Daraja requires the password timestamp in East Africa Time (UTC+3, no DST) in
// yyyymmddHHmmss format. Using UTC here made the generated password drift by 3
// hours from what Safaricom's servers were deriving — a silent auth failure
// class (D-1). Kept pure and exported for tests.
export function mpesaTimestamp(date: Date = new Date()): string {
  const eat = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${eat.getUTCFullYear()}${p(eat.getUTCMonth() + 1)}${p(eat.getUTCDate())}${p(eat.getUTCHours())}${p(eat.getUTCMinutes())}${p(eat.getUTCSeconds())}`;
}

// Normalize a customer's phone to the 254… international format Daraja wants.
export function normalizeDarajaPhone(phone?: string | null): { ok: boolean; phone?: string; error?: string } {
  const digits = String(phone || "").replace(/[^0-9]/g, "");
  if (digits.startsWith("254")) {
    const normalized = digits;
    if (normalized.length !== 12) return { ok: false, error: "M-Pesa phone number must be 12 digits (254…)" };
    return { ok: true, phone: normalized };
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return { ok: true, phone: `254${digits.slice(1)}` };
  }
  // Bare 9-digit Safaricom-style numbers (7XXXXXXXX). A leading 0 here is a
  // truncated 0XXXXXXXXX and must be rejected, not silently re-prefixed.
  if (digits.length === 9 && !digits.startsWith("0")) {
    return { ok: true, phone: `254${digits}` };
  }
  return { ok: false, error: "Invalid M-Pesa phone number (expected 0XXXXXXXXX or 254XXXXXXXXX)" };
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
  const timestamp = mpesaTimestamp();
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
  const normalized = normalizeDarajaPhone(phone);
  if (!normalized.ok) throw new Error(normalized.error || "Invalid M-Pesa phone number");
  const partyA = normalized.phone!;

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
    TransactionDesc: "Laptop Pay",
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
