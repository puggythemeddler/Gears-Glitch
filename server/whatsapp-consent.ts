import { query, queryOne } from "./db-helpers";
import { normalizePhone } from "./phone";
import { getSettings } from "./db";

// Consent + opt-out policy for outbound WhatsApp messaging.
//
// Every outbound send is funnelled through `isWhatsAppSendingAllowed` immediately
// before the Meta request. The policy is evaluated server-side from the durable
// `whatsapp_consent` table (migration 0031) so a stale in-memory decision can
// never authorise a prohibited message.
//
// Policy (default-DENY). A recipient is only messaged when an authorisation can
// actually be established:
//   * opt-out (`opted_out_at` set)              -> deny every category
//   * marketing                                 -> require an explicit
//                                                  `marketing_allowed = TRUE`
//                                                  grant (absence of a row is
//                                                  NOT consent)
//   * transactional / utility / service /
//     authentication                            -> require explicit
//                                                  `transactional_allowed = TRUE`
//                                                  OR an open customer-service
//                                                  session (the recipient
//                                                  messaged us within the Meta
//                                                  24h window) OR the merchant's
//                                                  own configured admin number
//   * anything indeterminate                    -> deny (fail closed)
//
// Absence of a consent record is NOT treated as consent: this is the explicit,
// defensible default required by the WhatsApp Business Platform (opt-in before
// business-initiated messaging) and data-protection law. The distinction is that
// operational/service messages ride on an established session or explicit grant,
// while marketing always needs an explicit opt-in.
//
// Tenant scope: SECURITY_MODEL documents one database per tenant. `tenant_id` /
// `merchant_id` are reserved for a future shared-database/control-plane model
// and are left NULL in the per-tenant database (the unique index COALESCEs them
// to -1). Within a tenant database every consent row therefore belongs to that
// tenant; isolation is enforced by the database boundary, not these columns.

export type MessageCategory = "marketing" | "transactional" | "utility" | "authentication" | "service";

// Where a sending authorisation came from. Useful for auditing/tests.
export type AuthorizationSource =
  | "explicit_consent"        // a consent row explicitly authorises this category
  | "customer_service_window" // recipient messaged us within the Meta 24h window
  | "merchant_owned"          // the merchant's own configured admin number
  | "none";

// Meta/industry standard opt-out keywords. Matched case-insensitively against
// the whole (whitespace-trimmed, non-alphabetic-stripped) message body so that
// "STOP", "stop", " Stop " and "unsubscribe" all opt out, while "please stop by"
// does not.
export const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "cancel", "end", "quit"];

export function detectOptOutKeyword(text: string | null | undefined): boolean {
  if (typeof text !== "string") return false;
  const normalized = text.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (!normalized) return false;
  return OPT_OUT_KEYWORDS.includes(normalized);
}

export interface ConsentRow {
  opted_out_at: string | null;
  marketing_allowed: boolean;
  transactional_allowed: boolean;
}

export interface ConsentDecision {
  allowed: boolean;
  reason: string;
  // true when the denial is a permanent consent/policy decision. Callers must
  // not treat this as a transient error (no retry/backoff).
  policyDenied: boolean;
  category: MessageCategory;
  optedOut: boolean;
  authorization: AuthorizationSource;
}

async function getConsent(phone: string): Promise<ConsentRow | undefined> {
  const normalized = normalizePhone(phone);
  if (!normalized) return undefined;
  return await queryOne(
    `SELECT opted_out_at, marketing_allowed, transactional_allowed
       FROM whatsapp_consent
      WHERE phone_normalized = $1
      ORDER BY updated_at DESC
      LIMIT 1`,
    [normalized]
  );
}

// True when the recipient has initiated a conversation within the Meta 24-hour
// customer-service window (they messaged us, so replying is authorised).
function withinCustomerServiceWindow(lastIncomingAt: string | null | undefined): boolean {
  if (!lastIncomingAt) return false;
  const t = new Date(lastIncomingAt).getTime();
  if (isNaN(t)) return false;
  return Date.now() - t < 24 * 60 * 60 * 1000;
}

async function lastIncomingAt(phone: string): Promise<string | null> {
  const row = await queryOne("SELECT last_incoming_at FROM whatsapp_conversations WHERE phone_number = $1", [phone]);
  return (row && row.last_incoming_at) || null;
}

// The merchant's own operational number (admin alerts) is self-authorised: the
// operator owns the number and configures it as the destination for their own
// alerts. This never authorises marketing.
async function isMerchantOwnedNumber(phone: string): Promise<boolean> {
  try {
    const settings = await getSettings();
    const admin = normalizePhone(settings.adminWhatsAppPhone || settings.phone || "");
    return !!admin && admin === phone;
  } catch {
    return false;
  }
}

function deny(reason: string, category: MessageCategory, optedOut: boolean): ConsentDecision {
  return { allowed: false, reason, policyDenied: true, category, optedOut, authorization: "none" };
}

// Central policy gate. Fails closed on any lookup error.
export async function isWhatsAppSendingAllowed(phone: string, category: MessageCategory = "transactional"): Promise<ConsentDecision> {
  const normalized = normalizePhone(phone);
  if (!normalized) return deny("Cannot determine recipient phone number", category, false);

  let row: ConsentRow | undefined;
  try {
    row = await getConsent(normalized);
  } catch (err: any) {
    // Fail closed: an indeterminate consent state must not authorise a send.
    return deny(`Consent lookup failed: ${err?.message || err}`, category, false);
  }

  const optedOut = !!(row && row.opted_out_at);
  if (optedOut) {
    return deny("Recipient has opted out of WhatsApp messages", category, true);
  }

  if (category === "marketing") {
    if (!row || row.marketing_allowed !== true) {
      return deny("Recipient has not granted marketing consent", category, optedOut);
    }
    return { allowed: true, reason: "allowed (explicit marketing consent)", policyDenied: false, category, optedOut, authorization: "explicit_consent" };
  }

  // Transactional / utility / service / authentication.
  if (row && row.transactional_allowed === false) {
    return deny("Recipient has disabled transactional WhatsApp messages", category, optedOut);
  }
  if (row && row.transactional_allowed === true) {
    return { allowed: true, reason: "allowed (explicit transactional consent)", policyDenied: false, category, optedOut, authorization: "explicit_consent" };
  }

  // No explicit grant: authorisation must be established another way. Absence of
  // a consent record is NOT consent.
  try {
    if (await isMerchantOwnedNumber(normalized)) {
      return { allowed: true, reason: "allowed (merchant-owned number)", policyDenied: false, category, optedOut, authorization: "merchant_owned" };
    }
    if (withinCustomerServiceWindow(await lastIncomingAt(normalized))) {
      return { allowed: true, reason: "allowed (open customer-service session)", policyDenied: false, category, optedOut, authorization: "customer_service_window" };
    }
  } catch (err: any) {
    return deny(`Authorization lookup failed: ${err?.message || err}`, category, optedOut);
  }

  return deny("No established authorization for transactional WhatsApp messaging (no explicit consent and no open customer-service session)", category, optedOut);
}

// Persist an opt-out idempotently. Safe to call on every redelivery: the unique
// index (COALESCE(tenant_id,-1), COALESCE(merchant_id,-1), phone_normalized) plus
// ON CONFLICT guarantees a single row per recipient and never creates duplicates.
// Disables both marketing and transactional messaging for the recipient.
export async function recordOptOut(phone: string, source: string): Promise<boolean> {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  await query(
    `INSERT INTO whatsapp_consent (phone, phone_normalized, opted_out_at, opted_out_source, marketing_allowed, transactional_allowed, updated_at)
     VALUES ($1, $1, NOW(), $2, FALSE, FALSE, NOW())
     ON CONFLICT (COALESCE(tenant_id, -1), COALESCE(merchant_id, -1), phone_normalized)
     DO UPDATE SET
       opted_out_at = NOW(),
       opted_out_source = EXCLUDED.opted_out_source,
       marketing_allowed = FALSE,
       transactional_allowed = FALSE,
       updated_at = NOW()`,
    [normalized, source]
  );
  return true;
}

// Explicit, auditable consent grant. Only ever invoked from a trusted caller
// (e.g. an admin action or an explicit opt-in captured at checkout); ordinary
// inbound messages must not restore consent.
export async function recordConsentGrant(phone: string, source: string, opts: { marketing?: boolean; transactional?: boolean } = {}): Promise<boolean> {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  const marketing = opts.marketing === true;
  const transactional = opts.transactional === true;
  await query(
    `INSERT INTO whatsapp_consent (phone, phone_normalized, consent_granted_at, consent_source, marketing_allowed, transactional_allowed, updated_at)
     VALUES ($1, $1, NOW(), $2, $3, $4, NOW())
     ON CONFLICT (COALESCE(tenant_id, -1), COALESCE(merchant_id, -1), phone_normalized)
     DO UPDATE SET
       opted_out_at = NULL,
       opted_out_source = NULL,
       consent_granted_at = NOW(),
       consent_source = EXCLUDED.consent_source,
       marketing_allowed = EXCLUDED.marketing_allowed,
       transactional_allowed = EXCLUDED.transactional_allowed,
       updated_at = NOW()`,
    [normalized, source, marketing, transactional]
  );
  return true;
}
