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
// API. Sending goes through the Gmail REST API over HTTPS, minting a short-lived
// access token from that refresh token on demand — see "Sending" below for why
// it is not nodemailer's SMTP path.
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
//
// Sending goes over the Gmail REST API rather than nodemailer's SMTP transport.
// Render's free instances block outbound SMTP, so smtp.gmail.com:465 times out
// ("Connection timeout") while an HTTPS call to Google succeeds — which is
// exactly why the test-connection button reported healthy while every real send
// failed: the refresh is HTTPS, the send was not. The REST API reuses the same
// OAuth token and the same gmail.send scope, so it needs no new credentials.
//
// The returned object exposes nodemailer's sendMail() shape, so the call sites
// in email.ts are unchanged.

const GMAIL_SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export interface GmailAddress {
  name: string;
  email: string;
}

// Splits `"Shop Name" <a@b.com>` into its parts; a bare address has no name.
// CR/LF is stripped because these values reach us from store settings and would
// otherwise let a setting inject extra headers into the outgoing message.
export function parseGmailAddress(raw: unknown): GmailAddress {
  const value = String(raw ?? "").replace(/[\r\n]+/g, " ").trim();
  const angled = value.match(/^(.*)<([^>]+)>$/);
  if (angled) {
    return { name: angled[1].trim().replace(/^"(.*)"$/, "$1").trim(), email: angled[2].trim() };
  }
  return { name: "", email: value };
}

// RFC 2047 encoded-word. Needed because store names and subjects are routinely
// non-ASCII, and an unencoded 8-bit header is rejected by Gmail.
function encodeHeaderText(value: unknown): string {
  const text = String(value ?? "").replace(/[\r\n]+/g, " ");
  if (/^[\x20-\x7E]*$/.test(text)) return text;
  return `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function formatAddress(addr: GmailAddress): string {
  return addr.name ? `${encodeHeaderText(addr.name)} <${addr.email}>` : addr.email;
}

export interface GmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

// Builds the RFC 5322 message that messages.send expects in its `raw` field.
// The body is base64 so HTML containing 8-bit characters or bare CR/LF cannot
// corrupt the headers. With no attachments this is a single-part HTML message
// (the exact shape the transporter has always produced); with attachments it
// becomes multipart/mixed with the HTML as the first part.
export function buildGmailRawMessage(input: {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  attachments?: GmailAttachment[];
}): string {
  const recipients = (Array.isArray(input.to) ? input.to : [input.to])
    .map((entry) => parseGmailAddress(entry).email)
    .filter(Boolean);
  if (!recipients.length) throw new Error("Gmail send requires at least one recipient.");
  const attachments = (input.attachments || [])
    .map((a) => ({ filename: String(a.filename || ""), content: a.content, contentType: a.contentType || "application/octet-stream" }))
    .filter((a) => a.filename && a.content !== undefined && a.content !== null);
  const headers = [
    `From: ${formatAddress(parseGmailAddress(input.from))}`,
    `To: ${recipients.join(", ")}`,
    `Subject: ${encodeHeaderText(input.subject)}`,
    "MIME-Version: 1.0",
  ];
  if (!attachments.length) {
    return `${[...headers, `Content-Type: text/html; charset="UTF-8"`, "Content-Transfer-Encoding: base64"].join("\r\n")}\r\n\r\n${
      Buffer.from(String(input.html ?? ""), "utf8").toString("base64")
    }`;
  }
  const boundary = `----=_gandg_${crypto.randomBytes(16).toString("hex")}`;
  const parts = [
    [
      "Content-Type: text/html; charset=\"UTF-8\"",
      "Content-Transfer-Encoding: base64",
    ].join("\r\n"),
    Buffer.from(String(input.html ?? ""), "utf8").toString("base64"),
  ];
  for (const a of attachments) {
    const filename = String(a.filename).replace(/["\r\n]/g, "").trim();
    const body = Buffer.isBuffer(a.content) ? a.content.toString("base64") : Buffer.from(String(a.content), "utf8").toString("base64");
    parts.push(
      [
        `Content-Type: ${a.contentType}; name="${filename}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${filename}"`,
      ].join("\r\n"),
      body
    );
  }
  const body = parts.map((p) => `--${boundary}\r\n${p}`).join("\r\n") + `\r\n--${boundary}--`;
  return `${[...headers, `Content-Type: multipart/mixed; boundary="${boundary}"`].join("\r\n")}\r\n\r\n${body}`;
}

// Google's error bodies use camelCase reasons ("insufficientPermissions") while
// isGmailOAuthError() matches the snake_case spellings it has always reported,
// so normalise before the message reaches the status/error handling.
function normalizeGoogleError(body: string): string {
  return String(body || "").replace(/([a-z0-9])([A-Z])/g, "$1_$2");
}

export async function refreshGmailAccessToken(creds: { clientId: string; clientSecret: string; refreshToken: string }): Promise<string> {
  const body = new URLSearchParams({
    refresh_token: creds.refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gmail token refresh failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Gmail token refresh returned no access_token.");
  return json.access_token;
}

export async function sendGmailMessageViaApi(
  input: { from: string; to: string | string[]; subject: string; html: string; attachments?: GmailAttachment[] },
  accessToken: string,
): Promise<{ id?: string; threadId?: string }> {
  const raw = Buffer.from(buildGmailRawMessage(input), "utf8").toString("base64url");
  const res = await fetch(GMAIL_SEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const detail = normalizeGoogleError(await res.text().catch(() => ""));
    throw new Error(`Gmail API send failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return (await res.json().catch(() => ({}))) as { id?: string; threadId?: string };
}

// Returns a transport that speaks the Gmail REST API. Callers must still call
// resetTransporter() after a failed send so a stale credential is not reused.
export async function getGmailTransporter(): Promise<any> {
  const creds = await getGmailSendingCreds();
  if (!creds) return null;
  return {
    async sendMail(opts: { from?: string; to?: string | string[]; subject?: string; html?: string; attachments?: GmailAttachment[] }) {
      const message = {
        from: String(opts?.from || creds.email),
        to: opts?.to ?? "",
        subject: String(opts?.subject ?? ""),
        html: String(opts?.html ?? ""),
        attachments: opts?.attachments,
      };
      const accessToken = await refreshGmailAccessToken(creds);
      try {
        return await sendGmailMessageViaApi(message, accessToken);
      } catch (err: any) {
        // A 401 here means the access token was revoked or went stale between
        // the refresh and the send. Retry once with a freshly minted token,
        // then let the error propagate so email.ts can fail over to SMTP.
        if (!/\(401\)/.test(String(err?.message || ""))) throw err;
        return await sendGmailMessageViaApi(message, await refreshGmailAccessToken(creds));
      }
    },
  };
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