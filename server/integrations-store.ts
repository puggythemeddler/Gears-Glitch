// Persistence for the centralized integrations architecture (migration 0018).
//
// One server instance == one tenant == one database, so provider configs are
// scoped to this instance by construction. Secret material is wrapped through
// server/secret-store.ts (AES-256-GCM at rest) — callers pass plain objects and
// never handle ciphertext directly, and no API layer ever returns these rows to
// the browser without explicit redaction.

import crypto from "crypto";
import { query, queryOne, queryAll } from "./db-helpers";
import { encryptSecret, decryptSecret, isEncrypted } from "./secret-store";

export type IntegrationProvider = "google" | "gmail" | "daraja" | "whatsapp";
export type IntegrationStatus =
  | "not_configured"
  | "connected"
  | "token_expired"
  | "connection_error"
  | "degraded"
  | "error"
  | "disabled";

export interface IntegrationRow {
  id: number;
  provider: string;
  status: IntegrationStatus;
  config: any;       // non-secret display config (JSONB, already parsed)
  secrets: string;   // encrypted JSON blob — never returned raw
  last_connected_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error: string | null;
  last_test_at: string | null;
  last_test_result: string | null;
  created_at: string;
  updated_at: string;
}

export interface OAuthAccountRow {
  id: number;
  provider: string;
  subject: string;
  email: string;
  name: string;
  user_id: number | null;
  customer_id: number | null;
  created_at: string;
  last_login_at: string | null;
}

export interface WebhookEventRow {
  id: number;
  provider: string;
  event_key: string;
  status: string;
  payload_hash: string | null;
  payload: any;
  http_status: number | null;
  error: string | null;
  received_at: string;
  processed_at: string | null;
}

export interface NotificationDeliveryRow {
  id: number;
  event_id: string;
  event_type: string;
  channel: string;
  audience: string;
  entity_type: string;
  entity_id: string;
  recipient: string;
  subject: string;
  payload: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_attempt_at: string | null;
  next_attempt_at: string;
  last_error: string | null;
  provider_message_id: string | null;
  customer_id: number | null;
  idempotency_key: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface TemplateRow {
  id: number;
  event_type: string;
  channel: string;
  name: string;
  subject: string;
  body_text: string;
  body_html: string;
  enabled: number;
}

function rowTo(row: any): IntegrationRow {
  return { ...row, config: typeof row.config === "string" ? safeJson(row.config) : row.config };
}
function safeJson(raw: string): any {
  try { return JSON.parse(raw); } catch { return {}; }
}

// ─── integrations ─────────────────────────────────────────────────────────────

export async function getIntegration(provider: string): Promise<IntegrationRow | null> {
  const row = await queryOne("SELECT * FROM integrations WHERE provider = $1", [provider]);
  return row ? rowTo(row) : null;
}

export async function listIntegrations(): Promise<IntegrationRow[]> {
  const rows = await queryAll("SELECT * FROM integrations ORDER BY provider ASC");
  return rows.map(rowTo);
}

export async function upsertIntegration(
  provider: string,
  fields: { status?: IntegrationStatus; config?: any; secrets?: Record<string, string> } = {}
): Promise<IntegrationRow> {
  const existing = await getIntegration(provider);
  const config = { ...(existing?.config || {}), ...(fields.config || {}) };
  let secretsBlob = existing?.secrets || "";
  if (fields.secrets) secretsBlob = encryptSecret(JSON.stringify(fields.secrets));
  const status = fields.status || existing?.status || "not_configured";
  const row = await queryOne(
    `INSERT INTO integrations (provider, status, config, secrets)
     VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (provider) DO UPDATE SET
       status = EXCLUDED.status,
       config = EXCLUDED.config,
       secrets = EXCLUDED.secrets,
       updated_at = NOW()
     RETURNING *`,
    [provider, status, JSON.stringify(config), secretsBlob]
  );
  return rowTo(row);
}

export async function updateIntegrationStatus(provider: string, status: IntegrationStatus, error?: string): Promise<void> {
  await query(
    `UPDATE integrations SET status = $2, last_error = $3, updated_at = NOW()
     WHERE provider = $1`,
    [provider, status, error || null]
  );
}

export async function markIntegrationSuccess(provider: string): Promise<void> {
  await query(
    `UPDATE integrations SET last_success_at = NOW(), last_error = NULL, updated_at = NOW()
     WHERE provider = $1`,
    [provider]
  );
}

export async function markIntegrationFailure(provider: string, error: string): Promise<void> {
  await query(
    `UPDATE integrations SET last_failure_at = NOW(), last_error = $2, updated_at = NOW()
     WHERE provider = $1`,
    [provider, error]
  );
}

export async function markIntegrationTest(provider: string, ok: boolean, error?: string): Promise<void> {
  await query(
    `UPDATE integrations SET last_test_at = NOW(), last_test_result = $2, last_error = $3, updated_at = NOW()
     WHERE provider = $1`,
    [provider, ok ? "ok" : "failed", error || null]
  );
}

export async function setIntegrationSecrets(provider: string, secrets: Record<string, string>): Promise<void> {
  await query(`UPDATE integrations SET secrets = $2, updated_at = NOW() WHERE provider = $1`, [provider, encryptSecret(JSON.stringify(secrets))]);
}

export async function getIntegrationSecrets(provider: string): Promise<Record<string, string> | null> {
  const row = await queryOne("SELECT secrets FROM integrations WHERE provider = $1", [provider]);
  if (!row || !row.secrets) return null;
  if (!isEncrypted(row.secrets)) {
    try { return JSON.parse(row.secrets); } catch { return null; }
  }
  try { return JSON.parse(decryptSecret(row.secrets)); } catch { return null; }
}

// ─── oauth_accounts ───────────────────────────────────────────────────────────

export async function findOauthAccountBySubject(provider: string, subject: string): Promise<OAuthAccountRow | null> {
  return (await queryOne("SELECT * FROM oauth_accounts WHERE provider = $1 AND subject = $2", [provider, subject])) || null;
}

export async function findOauthAccountByEmail(provider: string, email: string): Promise<OAuthAccountRow | null> {
  return (await queryOne("SELECT * FROM oauth_accounts WHERE provider = $1 AND email = $2", [provider, email])) || null;
}

export async function upsertOauthAccount(acct: {
  provider: string;
  subject: string;
  email: string;
  name?: string;
  user_id?: number | null;
  customer_id?: number | null;
}): Promise<OAuthAccountRow> {
  return await queryOne(
    `INSERT INTO oauth_accounts (provider, subject, email, name, user_id, customer_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (provider, subject) DO UPDATE SET
       email = EXCLUDED.email, name = EXCLUDED.name,
       user_id = COALESCE(EXCLUDED.user_id, oauth_accounts.user_id),
       customer_id = COALESCE(EXCLUDED.customer_id, oauth_accounts.customer_id),
       last_login_at = NOW()
     RETURNING *`,
    [acct.provider, acct.subject, acct.email, acct.name || "", acct.user_id ?? null, acct.customer_id ?? null]
  );
}

export async function touchOauthLogin(id: number): Promise<void> {
  await query("UPDATE oauth_accounts SET last_login_at = NOW() WHERE id = $1", [id]);
}

export async function linkOauthAccount(id: number, kid: "user_id" | "customer_id", value: number): Promise<void> {
  await query(`UPDATE oauth_accounts SET ${kid} = $2 WHERE id = $1`, [id, value]);
}

// ─── webhook_events (durable inbound idempotency ledger) ──────────────────────

export interface AcquireWebhookResult {
  event: WebhookEventRow;
  inserted: boolean;
}

export async function acquireWebhookEvent(
  provider: string,
  eventKey: string,
  payload: any,
  httpStatus?: number
): Promise<AcquireWebhookResult> {
  const payloadHash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const insertedRow = await queryOne(
    `INSERT INTO webhook_events (provider, event_key, status, payload_hash, payload, http_status)
     VALUES ($1, $2, 'received', $3, $4::jsonb, $5)
     ON CONFLICT (provider, event_key) DO NOTHING
     RETURNING *`,
    [provider, eventKey, payloadHash, JSON.stringify(payload), httpStatus ?? null]
  );
  if (insertedRow) return { event: insertedRow, inserted: true };
  const existing = await queryOne(
    "SELECT * FROM webhook_events WHERE provider = $1 AND event_key = $2",
    [provider, eventKey]
  );
  return { event: existing, inserted: false };
}

export async function markWebhookProcessed(provider: string, eventKey: string, httpStatus?: number): Promise<void> {
  await query(
    `UPDATE webhook_events SET status = 'processed', http_status = $3, processed_at = NOW() WHERE provider = $1 AND event_key = $2`,
    [provider, eventKey, httpStatus ?? null]
  );
}
export async function markWebhookFailed(provider: string, eventKey: string, error: string): Promise<void> {
  await query(
    `UPDATE webhook_events SET status = 'failed', error = $3 WHERE provider = $1 AND event_key = $2`,
    [provider, eventKey, error]
  );
}

// ─── notification_deliveries (persisted outbound queue) ───────────────────────

export interface DeliverySpec {
  eventId: string;
  eventType: string;
  channel: string;
  audience?: string;
  entityType?: string;
  entityId?: string;
  recipient?: string;
  subject?: string;
  payload?: string;
  maxAttempts?: number;
  nextAttemptAt?: string;
  customerId?: number | null;
  idempotencyKey?: string | null;
}

export async function enqueueDelivery(spec: DeliverySpec): Promise<void> {
  await query(
    `INSERT INTO notification_deliveries
       (event_id, event_type, channel, audience, entity_type, entity_id, recipient, subject, payload, max_attempts, next_attempt_at, customer_id, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (event_id, channel, recipient) DO NOTHING`,
    [
      spec.eventId, spec.eventType, spec.channel, spec.audience || "admin",
      spec.entityType || "", spec.entityId || "", spec.recipient || "", spec.subject || "",
      spec.payload || "", spec.maxAttempts || 5, spec.nextAttemptAt || new Date().toISOString(),
      spec.customerId ?? null, spec.idempotencyKey || null,
    ]
  );
}

export async function hasDeliverySucceeded(eventId: string, channel: string): Promise<boolean> {
  const row = await queryOne(
    "SELECT 1 FROM notification_deliveries WHERE event_id = $1 AND channel = $2 AND status = 'sent' LIMIT 1",
    [eventId, channel]
  );
  return !!row;
}

export async function listPendingDeliveries(limit: number = 50): Promise<NotificationDeliveryRow[]> {
  return await queryAll(
    `SELECT * FROM notification_deliveries
     WHERE status IN ('pending', 'failed') AND next_attempt_at <= NOW()
     ORDER BY next_attempt_at ASC LIMIT $1`,
    [limit]
  );
}

export async function settleDelivery(
  id: number,
  outcome: { status: string; error?: string | null; providerMessageId?: string | null; sentAt?: string | null }
): Promise<void> {
  await query(
    `UPDATE notification_deliveries
     SET status = $2, last_error = $3, provider_message_id = $4,
         sent_at = $5, updated_at = NOW()
     WHERE id = $1`,
    [id, outcome.status, outcome.error ?? null, outcome.providerMessageId ?? null, outcome.sentAt ?? null]
  );
}

// Records a non-terminal attempt (retry scheduled) or a terminal one; used by
// the outbound worker after each send attempt.
export async function markDeliveryAttempt(
  id: number,
  attempt: { status: string; error?: string | null; nextAttemptAt?: string | null; providerMessageId?: string | null }
): Promise<void> {
  await query(
    `UPDATE notification_deliveries
     SET status = $2, last_error = $3, next_attempt_at = $4,
         provider_message_id = $5, last_attempt_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [id, attempt.status, attempt.error ?? null, attempt.nextAttemptAt ?? null, attempt.providerMessageId ?? null]
  );
}

export async function getDelivery(id: number): Promise<NotificationDeliveryRow | null> {
  return (await queryOne("SELECT * FROM notification_deliveries WHERE id = $1", [id])) || null;
}

// ─── notification_templates ───────────────────────────────────────────────────

export async function getNotificationTemplate(eventType: string, channel: string): Promise<TemplateRow | null> {
  return (await queryOne(
    "SELECT * FROM notification_templates WHERE event_type = $1 AND channel = $2 AND enabled = 1",
    [eventType, channel]
  )) || null;
}

export async function upsertNotificationTemplate(t: {
  eventType: string;
  channel: string;
  name?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  enabled?: number;
}): Promise<TemplateRow> {
  return await queryOne(
    `INSERT INTO notification_templates (event_type, channel, name, subject, body_text, body_html, enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (event_type, channel) DO UPDATE SET
       name = EXCLUDED.name, subject = EXCLUDED.subject,
       body_text = EXCLUDED.body_text, body_html = EXCLUDED.body_html,
       enabled = EXCLUDED.enabled, updated_at = NOW()
     RETURNING *`,
    [t.eventType, t.channel, t.name || "", t.subject || "", t.bodyText || "", t.bodyHtml || "", t.enabled ?? 1]
  );
}

export async function listNotificationTemplates(): Promise<TemplateRow[]> {
  return await queryAll("SELECT * FROM notification_templates ORDER BY event_type ASC, channel ASC");
}

export async function deleteNotificationTemplate(eventType: string, channel: string): Promise<void> {
  await query("DELETE FROM notification_templates WHERE event_type = $1 AND channel = $2", [eventType, channel]);
}