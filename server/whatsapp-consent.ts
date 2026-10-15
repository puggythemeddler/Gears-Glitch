import { query, queryOne } from "./db-helpers";
import { normalizePhone } from "./phone";

// Consent + opt-out policy for outbound WhatsApp messaging.
//
// Every outbound send is funnelled through `isWhatsAppSendingAllowed` immediately
// before the Meta request. The policy is evaluated server-side from the durable
// `whatsapp_consent` table (migration 0031) so a stale in-memory decision can
// never authorise a prohibited message. The check fails closed: if consent
// cannot be determined the send is denied.

export type MessageCategory = "marketing" | "transactional" | "utility" | "authentication" | "service";

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

// Central policy gate. Evaluates merchant/recipient ownership is enforced by the
// caller's tenant context; here we enforce consent + opt-out for the recipient
// number and the message category. Fails closed on any lookup error.
export async function isWhatsAppSendingAllowed(phone: string, category: MessageCategory = "transactional"): Promise<ConsentDecision> {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return { allowed: false, reason: "Cannot determine recipient phone number", policyDenied: true, category, optedOut: false };
  }

  let row: ConsentRow | undefined;
  try {
    row = await getConsent(normalized);
  } catch (err: any) {
    // Fail closed: an indeterminate consent state must not authorise a send.
    return {
      allowed: false,
      reason: `Consent lookup failed: ${err?.message || err}`,
      policyDenied: true,
      category,
      optedOut: false,
    };
  }

  const optedOut = !!(row && row.opted_out_at);
  if (optedOut) {
    return { allowed: false, reason: "Recipient has opted out of WhatsApp messages", policyDenied: true, category, optedOut: true };
  }

  if (category === "marketing") {
    // Marketing requires an explicit grant; absence of a row is NOT consent.
    if (!row || row.marketing_allowed !== true) {
      return { allowed: false, reason: "Recipient has not granted marketing consent", policyDenied: true, category, optedOut };
    }
  } else if (row && row.transactional_allowed === false) {
    return { allowed: false, reason: "Recipient has disabled transactional WhatsApp messages", policyDenied: true, category, optedOut };
  }

  return { allowed: true, reason: "allowed", policyDenied: false, category, optedOut };
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
// (e.g. an admin action); ordinary inbound messages must not restore consent.
export async function recordConsentGrant(phone: string, source: string, opts: { marketing?: boolean; transactional?: boolean } = {}): Promise<boolean> {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  const marketing = opts.marketing === true;
  const transactional = opts.transactional !== false;
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
