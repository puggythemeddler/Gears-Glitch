import crypto from "crypto";

const SANDBOX_BASE = "https://sandbox.safaricom.co.ke";

export interface DarajaConfig {
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  partyB: string;
  passkey: string;
  callbackBaseUrl: string;
  transactionType: "CustomerPayBillOnline" | "CustomerBuyGoodsOnline";
}

export interface StkPushInput {
  amount: number;
  phone: string;
  accountReference: string;
  transactionDesc: string;
  callbackToken: string;
}

export interface StkPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  customerMessage: string;
}

let cachedAccessToken = "";
let tokenExpiresAt = 0;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("Daraja sandbox configuration is incomplete.");
  return value;
}

export function getDarajaConfig(): DarajaConfig | null {
  const names = ["DARAJA_CONSUMER_KEY", "DARAJA_CONSUMER_SECRET", "DARAJA_SHORTCODE", "DARAJA_PASSKEY"];
  if (names.some((name) => !process.env[name]?.trim())) return null;

  const callbackBaseUrl = (process.env.DARAJA_CALLBACK_URL || process.env.CONTROL_PLANE_URL || "").trim().replace(/\/$/, "");
  if (!callbackBaseUrl) return null;
  let callbackUrl: URL;
  try { callbackUrl = new URL(callbackBaseUrl); } catch { return null; }
  if (callbackUrl.protocol !== "https:" || callbackUrl.username || callbackUrl.password || callbackUrl.pathname !== "/" || callbackUrl.search || callbackUrl.hash) return null;
  if (!/^\d{5,6}$/.test(process.env.DARAJA_SHORTCODE!.trim())) return null;

  const rawType = process.env.DARAJA_TRANSACTION_TYPE || "CustomerPayBillOnline";
  if (rawType !== "CustomerPayBillOnline" && rawType !== "CustomerBuyGoodsOnline") return null;
  const shortcode = requiredEnv("DARAJA_SHORTCODE");
  const partyB = rawType === "CustomerBuyGoodsOnline" ? process.env.DARAJA_PARTY_B?.trim() || "" : shortcode;
  if (!/^\d{5,6}$/.test(partyB)) return null;

  return {
    consumerKey: requiredEnv("DARAJA_CONSUMER_KEY"),
    consumerSecret: requiredEnv("DARAJA_CONSUMER_SECRET"),
    shortcode,
    partyB,
    passkey: requiredEnv("DARAJA_PASSKEY"),
    callbackBaseUrl,
    transactionType: rawType,
  };
}

export function normalizeKenyanPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[\s()+.-]/g, "");
  let normalized = digits;
  if (/^0[17]\d{8}$/.test(digits)) normalized = `254${digits.slice(1)}`;
  else if (/^[17]\d{8}$/.test(digits)) normalized = `254${digits}`;
  return /^254[17]\d{8}$/.test(normalized) ? normalized : null;
}

export function createCallbackToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashCallbackToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function buildCallbackUrl(config: DarajaConfig, token: string): string {
  const base = config.callbackBaseUrl.replace(/\/$/, "");
  return `${base}/api/mpesa/stk-callback/${encodeURIComponent(token)}`;
}

async function getAccessToken(config: DarajaConfig): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt) return cachedAccessToken;
  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const response = await fetch(`${SANDBOX_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}`, Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.access_token !== "string") {
    throw new Error("Daraja sandbox authentication failed.");
  }
  const expiresIn = Number(data.expires_in) || 3600;
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + Math.max(0, expiresIn - 60) * 1000;
  return cachedAccessToken;
}

export async function initiateSandboxStkPush(input: StkPushInput): Promise<StkPushResult> {
  const config = getDarajaConfig();
  if (!config) throw new Error("Daraja sandbox is not configured with a valid public HTTPS callback URL.");
  const phone = normalizeKenyanPhone(input.phone);
  if (!phone) throw new Error("Enter a valid Kenyan M-Pesa phone number.");
  if (!Number.isSafeInteger(input.amount) || input.amount < 1) throw new Error("M-Pesa STK amount must be a whole KES amount of at least 1.");

  const dateParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const parts = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
  const timestamp = `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
  const password = Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString("base64");
  const accessToken = await getAccessToken(config);
  const response = await fetch(`${SANDBOX_BASE}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: config.transactionType,
      Amount: input.amount,
      PartyA: phone,
      PartyB: config.partyB,
      PhoneNumber: phone,
      CallBackURL: buildCallbackUrl(config, input.callbackToken),
      AccountReference: input.accountReference.replace(/[^A-Za-z0-9]/g, "").slice(0, 12) || "INVOICE",
      TransactionDesc: input.transactionDesc.slice(0, 13),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || String(data.ResponseCode) !== "0" || typeof data.CheckoutRequestID !== "string" || typeof data.MerchantRequestID !== "string") {
    throw new Error("Daraja sandbox did not accept the STK Push request.");
  }
  return {
    merchantRequestId: data.MerchantRequestID,
    checkoutRequestId: data.CheckoutRequestID,
    customerMessage: typeof data.CustomerMessage === "string" ? data.CustomerMessage.slice(0, 200) : "Payment prompt sent.",
  };
}
