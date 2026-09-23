// Gmail sending via Google OAuth (server-side, offline refresh token).
//
// Flow: an admin triggers GET /api/integrations/gmail/auth-url → Google consent
// → the browser lands on /api/integrations/gmail/callback where we exchange the
// `code` server-side. The exchange uses credentials from env (GOOGLE_CLIENT_ID /
// GOOGLE_CLIENT_SECRET) — a client secret is required, which is fine because the
// token handoff happens entirely on the server and never in the browser.
//
// The refresh token is persisted as an encrypted secret (secret-store) in the
// integrations table (provider='gmail'), never logged, never returned by any
// API. Sending then uses a nodemailer OAuth2 transporter (XOAUTH2) that asks
// Google for fresh access tokens on demand.
//
// For userless/test connections we refresh directly against the token endpoint
// (no email is sent by the test button).

import crypto from "crypto";
import { getStoreSetting } from "./db";
import {
  getIntegration,
  upsertIntegration,
  setIntegrationSecrets,
  getIntegrationSecrets,
  updateIntegrationStatus,
  markIntegrationSuccess,
  markIntegrationFailure,
  markIntegrationTest,
} from "./integrations-store";
import { resetTransporter } from "./email";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

let nodemailer: any = null;
try { nodemailer = require("nodemailer"); } catch {}

export const GMAIL_STATE_TTL_MS = 10 * 60 * 1000;

// The OAuth state is signed with the same JWT_SECRET the auth layer requires.
// Mirrors auth.getJwtSecret so the server refuses to run OAuth with a weak key.
export function getOAuthStateSecret(): string {
  const secret = process.env.JWT_SECRET || "";
  if (!secret || secret === "change-this-to-a-long-random-string" || secret === "your-secret-key-change-this-in-production" || secret === "dev-only-secret-change-for-production" || secret === "gl-jwt-2024-secure-random-key-xK9mPq") {
    throw new Error("Set a strong JWT_SECRET in .env before using OAuth integrations.");
  }
  return secret;
}

// ─── OAuth state (HMAC-signed, mirrors auth.ts google state) ──────────────────

export interface GmailOAuthState {
  purpose: "gmail";
  ts: number;
}

export function signGmailState(secret: string, state: GmailOAuthState): string {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyGmailState(raw: string | undefined, secret: string): GmailOAuthState | null {
  if (!raw || !secret) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GmailOAuthState;
    if (state.purpose !== "gmail") return null;
    if (Date.now() - state.ts > GMAIL_STATE_TTL_MS) return null;
    return state;
  } catch {
    return null;
  }
}

// Pure URL builder (testable without network).
export function buildGmailAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: `openid email ${GMAIL_SEND_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

// ─── Configuration resolution ─────────────────────────────────────────────────

async function getGmailClientId(): Promise<string | null> {
  return (await getStoreSetting("google_client_id")) || process.env.GOOGLE_CLIENT_ID || null;
}

export function getGmailRedirectUri(): string {
  if (process.env.GMAIL_OAUTH_REDIRECT_URI) return process.env.GMAIL_OAUTH_REDIRECT_URI;
  return `${(process.env.BASE_URL || "").replace(/\/$/, "")}/api/integrations/gmail/callback`;
}

export async function getGmailConfig(): Promise<{ clientId: string; clientSecret: string; redirectUri: string } | null> {
  const clientId = await getGmailClientId();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const redirectUri = getGmailRedirectUri();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

// ─── Token persistence ────────────────────────────────────────────────────────

export interface GmailStoredSecrets {
  refresh_token: string;
}

export async function getGmailSendingCreds(): Promise<{
  email: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
} | null> {
  const config = await getGmailConfig();
  if (!config) return null;
  const integration = await getIntegration("gmail");
  if (!integration || integration.status === "not_configured" || integration.status === "disabled") return null;
  const secrets = (await getIntegrationSecrets("gmail")) || null;
  const refreshToken = secrets?.refresh_token;
  const email = integration.config?.email;
  if (!refreshToken || !email) return null;
  return { email, clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.redirectUri, refreshToken };
}

// ─── Code exchange (server-side, no tokens in the browser) ────────────────────

export async function exchangeGmailCode(code: string): Promise<{ email: string; refreshToken: string }> {
  const config = await getGmailConfig();
  if (!config) throw new Error("Gmail OAuth is not configured.");
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gmail code exchange failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  const tokens = (await res.json()) as { refresh_token?: string; access_token?: string; id_token?: string };
  if (!tokens.refresh_token) throw new Error("No refresh token returned by Google — revoke access for this app in Google settings, then retry.");
  // The connected Gmail address is decoded from the ID token, never sent by the browser.
  let email = "";
  if (tokens.id_token) {
    try {
      const payload = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString("utf8"));
      email = String(payload.email || "").toLowerCase();
    } catch { /* fall through */ }
  }
  if (!email) throw new Error("Could not determine the connected Gmail address.");
  return { email, refreshToken: tokens.refresh_token };
}

export async function saveGmailConnection(creds: { email: string; refreshToken: string }): Promise<void> {
  await upsertIntegration("gmail", {
    status: "connected",
    config: { email: creds.email, scopes: [GMAIL_SEND_SCOPE] },
  });
  await setIntegrationSecrets("gmail", { refresh_token: creds.refreshToken });
  await markIntegrationSuccess("gmail");
  resetTransporter();
}

// ─── Sending ──────────────────────────────────────────────────────────────────

// Returns a nodemailer OAuth2 transporter that uses XOAUTH2 for the connected
// Gmail account. Callers must call resetTransporter() after a failed send so a
// stale/expired token is not reused.
export async function getGmailTransporter(): Promise<any> {
  const creds = await getGmailSendingCreds();
  if (!creds || !nodemailer) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: creds.email,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      refreshToken: creds.refreshToken,
      accessUrl: TOKEN_ENDPOINT,
    },
  });
}

// Reliable detection of an OAuth credential failure so we can surface
// TOKEN_EXPIRED without leaking protected message details.
export function isGmailOAuthError(err: any): boolean {
  const msg = String(err?.message || err || "");
  return /invalid_grant|invalid_grant: Bad Request|insufficient_permissions|invalid_scope|unauthorized_client/i.test(msg);
}

// ─── Test connection (refreshes the token, sends NOTHING) ─────────────────────

export async function testGmailConnection(): Promise<{ ok: boolean; error?: string }> {
  const config = await getGmailConfig();
  const creds = await getGmailSendingCreds();
  if (!config) return { ok: false, error: "Gmail OAuth is not configured (GOOGLE_CLIENT_ID/SECRET or Base URL)." };
  if (!creds) return { ok: false, error: "Gmail is not connected. Connect a Google account first." };
  const body = new URLSearchParams({
    refresh_token: creds.refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "refresh_token",
  });
  try {
    const res = await fetch(TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const error = `Gmail connection test failed (${res.status}): ${detail.length > 200 ? detail.slice(0, 200) : detail}`;
      if (isGmailOAuthError(new Error(error))) await updateIntegrationStatus("gmail", "token_expired", "Access token refresh failed (invalid_grant). Reconnect the account.");
      else await markIntegrationFailure("gmail", error);
      return { ok: false, error: isGmailOAuthError(new Error(error)) ? "Access revoked or invalid — reconnect the Gmail account." : "Connection test failed." };
    }
    await markIntegrationSuccess("gmail");
    resetTransporter();
    return { ok: true };
  } catch (err: any) {
    const error = err?.message || String(err);
    await markIntegrationFailure("gmail", error);
    return { ok: false, error: "Connection test failed (network or provider error)." };
  }
}

// ─── Disconnect ───────────────────────────────────────────────────────────────

export async function disconnectGmail(): Promise<void> {
  let refreshToken = "";
  try {
    const secrets = await getIntegrationSecrets("gmail");
    refreshToken = secrets?.refresh_token || "";
  } catch { /* row may not exist */ }
  if (refreshToken) {
    try {
      await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(refreshToken)}`, { method: "POST" });
    } catch { /* best effort revoke */ }
  }
  await upsertIntegration("gmail", { status: "not_configured", config: {}, secrets: { refresh_token: "" } });
  resetTransporter();
}

// ─── Redacted status for admin UI ─────────────────────────────────────────────

export async function getGmailStatus(): Promise<Record<string, any>> {
  const config = await getGmailConfig();
  const integration = await getIntegration("gmail");
  const configured = !!config;
  let connected = false;
  if (integration && ["connected", "token_expired"].includes(integration.status)) {
    const secrets = await getIntegrationSecrets("gmail");
    connected = !!secrets?.refresh_token;
  }
  return {
    provider: "gmail",
    configured,
    connected,
    status: connected ? (integration?.status ?? "not_configured") : "not_configured",
    // Display-only config; never includes secrets.
    email: (connected && integration?.config?.email) || "",
    connectedAt: integration?.last_connected_at || null,
    lastSuccessAt: integration?.last_success_at || null,
    lastFailureAt: integration?.last_failure_at || null,
    lastError: integration?.last_error || null,
    lastTestAt: integration?.last_test_at || null,
    lastTestResult: integration?.last_test_result || null,
    scopes: integration?.config?.scopes || [],
    redirectUri: getGmailRedirectUri(),
    requiresReconnect: connected && integration?.status === "token_expired",
  };
}

// Records the outcome of an actual send through the Gmail transporter.
export async function recordGmailSendResult(ok: boolean, err?: any): Promise<void> {
  if (ok) {
    await markIntegrationSuccess("gmail");
    return;
  }
  if (isGmailOAuthError(err)) {
    await updateIntegrationStatus("gmail", "token_expired", "Access token refresh failed (invalid_grant). Reconnect the account.");
  } else {
    await markIntegrationFailure("gmail", String(err?.message || err || "send failed").slice(0, 500));
  }
}

export async function recordGmailTestResult(ok: boolean, err?: any): Promise<void> {
  await markIntegrationTest("gmail", ok, ok ? undefined : String(err?.message || err || "test failed"));
}