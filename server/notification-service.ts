// Centralized notification dispatcher for Gears&Glitch
// Routes business events to email + WhatsApp channels with preferences, logging, and idempotency.

import { getSettings } from "./db";
import { sendEmail } from "./email";
import { sendWhatsAppMessage, sendWhatsAppDocument } from "./whatsapp";
import { sendOrderInvoiceDeliveryEmail, sendOrderInvoiceDeliveryWhatsApp } from "./order-invoice";
import { getOrder } from "./db";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length >= 10) return "254" + digits.slice(1);
  if (digits.startsWith("254")) return digits;
  return digits;
}

// ─── Notification Event Types ────────────────────────────────────────────────
export type NotificationEvent =
  | "order.created"
  | "order.paid"
  | "order.status_changed"
  | "order.processed"
  | "payment.completed"
  | "payment.failed"
  | "customer.created"
  | "customer.login"
  | "repair.created"
  | "repair.status_changed"
  | "repair.quote_sent"
  | "repair.quote_approved"
  | "repair.quote_declined"
  | "repair.completed"
  | "repair.ready"
  | "repair.cancelled"
  | "repair.customer_update"
  | "warranty.created"
  | "warranty.status_changed"
  | "warranty.approved"
  | "warranty.rejected"
  | "warranty.resolved"
  | "warranty.customer_update"
  | "warranty.expiry_reminder"
  | "warranty.expired"
  | "invoice.created"
  | "invoice.paid"
  | "invoice.overdue"
  | "subscription.changed"
  | "subscription.expiring"
  | "subscription.expired"
  | "financing.agreement.created"
  | "financing.agreement.completed"
  | "financing.payment.received"
  | "financing.payment.overdue";

// ─── Notification Channel ─────────────────────────────────────────────────────
export type NotificationChannel = "email" | "whatsapp";

// ─── Notification Status ──────────────────────────────────────────────────────
export type NotificationStatus = "pending" | "sent" | "failed" | "skipped" | "disabled";

// ─── Default Preferences (all enabled for admin) ──────────────────────────────
const DEFAULT_PREFERENCES: Record<NotificationEvent, { email: boolean; whatsapp: boolean }> = {
  "order.created":          { email: true, whatsapp: true },
  "order.paid":             { email: true, whatsapp: true },
  "order.status_changed":   { email: true, whatsapp: false },
  "order.processed":        { email: true, whatsapp: true },
  "payment.completed":      { email: true, whatsapp: true },
  "payment.failed":         { email: true, whatsapp: true },
  "customer.created":       { email: true, whatsapp: true },
  "customer.login":         { email: true, whatsapp: false },
  "repair.created":         { email: true, whatsapp: true },
  "repair.status_changed":  { email: true, whatsapp: false },
  "repair.quote_sent":      { email: true, whatsapp: true },
  "repair.quote_approved":  { email: true, whatsapp: false },
  "repair.quote_declined":  { email: true, whatsapp: false },
  "repair.completed":       { email: true, whatsapp: true },
  "repair.ready":           { email: true, whatsapp: true },
  "repair.cancelled":       { email: true, whatsapp: false },
  "repair.customer_update": { email: true, whatsapp: false },
  "warranty.created":       { email: true, whatsapp: true },
  "warranty.status_changed":{ email: true, whatsapp: false },
  "warranty.approved":      { email: true, whatsapp: true },
  "warranty.rejected":      { email: true, whatsapp: true },
  "warranty.resolved":      { email: true, whatsapp: true },
  "warranty.customer_update": { email: true, whatsapp: false },
  "warranty.expiry_reminder": { email: true, whatsapp: true },
  "warranty.expired":       { email: true, whatsapp: false },
  "invoice.created":        { email: true, whatsapp: false },
  "invoice.paid":           { email: true, whatsapp: false },
  "invoice.overdue":        { email: true, whatsapp: false },
  "subscription.changed":   { email: true, whatsapp: false },
  "subscription.expiring":  { email: true, whatsapp: false },
  "subscription.expired":   { email: true, whatsapp: true },
  "financing.agreement.created":   { email: true, whatsapp: true },
  "financing.agreement.completed": { email: true, whatsapp: true },
  "financing.payment.received":    { email: true, whatsapp: true },
  "financing.payment.overdue":     { email: true, whatsapp: true },
};

// ─── Audience ─────────────────────────────────────────────────────────────────
// Admin notifications go to the store's configured admin targets (unchanged).
// Customer notifications go to a specific customer, honour their opt-outs, and
// link the WhatsApp conversation to the customer record.
export type NotificationAudience = "admin" | "customer";

// ─── In-memory idempotency cache (last 1000 keys, TTL 5 min) ─────────────────
// Collapses rapid duplicate dispatches within a single process. Durable
// idempotency (across restarts) is enforced per-channel against notification_log.
const idempotencyCache = new Map<string, number>();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

function isDuplicate(key: string): boolean {
  const now = Date.now();
  // Evict expired entries periodically
  if (idempotencyCache.size > 100) {
    for (const [k, ts] of idempotencyCache) {
      if (now - ts > IDEMPOTENCY_TTL_MS) idempotencyCache.delete(k);
    }
  }
  if (idempotencyCache.has(key)) return true;
  idempotencyCache.set(key, now);
  return false;
}

// ─── Durable per-channel idempotency ──────────────────────────────────────────
// Returns the channels that already have a successfully-sent log row for this
// deterministic key, so a retry only re-attempts the channel that failed.
async function getSentChannels(idempotencyKey: string): Promise<Set<NotificationChannel>> {
  const sent = new Set<NotificationChannel>();
  if (!idempotencyKey) return sent;
  try {
    const { queryAll } = await import("./db-helpers");
    const rows = await queryAll(
      `SELECT DISTINCT channel FROM notification_log WHERE idempotency_key = $1 AND status = 'sent'`,
      [idempotencyKey]
    ) as { channel: string }[];
    for (const r of rows) if (r.channel === "email" || r.channel === "whatsapp") sent.add(r.channel);
  } catch { /* table may not exist yet — treat as no prior sends */ }
  return sent;
}

// ─── Customer communication preferences (opt-outs) ────────────────────────────
// Stored as a JSON object on customers.comm_prefs, e.g. {"email":false}.
export async function getCustomerCommPrefs(customerId: number): Promise<{ email: boolean; whatsapp: boolean }> {
  const prefs = { email: true, whatsapp: true };
  if (!customerId) return prefs;
  try {
    const { queryOne } = await import("./db-helpers");
    const row = await queryOne("SELECT comm_prefs FROM customers WHERE id = $1", [customerId]) as any;
    if (row?.comm_prefs) {
      const parsed = JSON.parse(row.comm_prefs);
      if (parsed?.email === false) prefs.email = false;
      if (parsed?.whatsapp === false) prefs.whatsapp = false;
    }
  } catch { /* keep defaults (opt-in) */ }
  return prefs;
}

export async function updateCustomerCommPrefs(customerId: number, update: { email?: boolean; whatsapp?: boolean }): Promise<{ email: boolean; whatsapp: boolean }> {
  const current = await getCustomerCommPrefs(customerId);
  if (update.email !== undefined) current.email = !!update.email;
  if (update.whatsapp !== undefined) current.whatsapp = !!update.whatsapp;
  const { query } = await import("./db-helpers");
  await query("UPDATE customers SET comm_prefs = $1 WHERE id = $2", [JSON.stringify(current), customerId]);
  return current;
}

// ─── Event Context (what the dispatcher needs to know) ────────────────────────
export interface NotificationContext {
  event: NotificationEvent;
  entityType: string;   // "order", "repair", "warranty", "customer", "invoice", "subscription"
  entityId: string | number;
  subject: string;
  bodyText: string;     // plain text for WhatsApp
  bodyHtml?: string;    // HTML for email (optional, will use bodyText fallback)
  recipientEmail?: string;
  recipientPhone?: string;
  audience?: NotificationAudience;  // defaults to "admin"
  customerId?: number;             // required to honour customer opt-outs
  recipientName?: string;          // used to link the WhatsApp conversation
  idempotencyKey?: string;         // deterministic; defaults to entityType:entityId:event:audience
  metadata?: Record<string, any>;
}

// ─── Notification Result ──────────────────────────────────────────────────────
export interface NotificationResult {
  event: NotificationEvent;
  email?: { status: NotificationStatus; recipient?: string; error?: string };
  whatsapp?: { status: NotificationStatus; recipient?: string; error?: string };
}

// ─── Get notification preferences ─────────────────────────────────────────────
async function getPreferences(): Promise<Record<NotificationEvent, { email: boolean; whatsapp: boolean }>> {
  try {
    const { queryOne } = await import("./db-helpers");
    const row = await queryOne("SELECT value FROM settings WHERE key = 'notification_preferences'") as any;
    if (row?.value) {
      const stored = JSON.parse(row.value);
      return { ...DEFAULT_PREFERENCES, ...stored };
    }
  } catch { /* fall through to defaults */ }
  return { ...DEFAULT_PREFERENCES };
}

// ─── Get admin notification targets ───────────────────────────────────────────
async function getAdminTargets(): Promise<{ emails: string[]; phones: string[]; storeName: string }> {
  const s = await getSettings();
  const emails: string[] = [];
  const phones: string[] = [];

  // Email: emailSender or store email
  const email = (s.emailSender || s.email || "").trim();
  if (email && s.emailNotificationsEnabled !== false) emails.push(email);

  // WhatsApp: admin phone if enabled
  if (s.whatsappEnabled && s.adminWhatsAppEnabled) {
    const phone = (s.adminWhatsAppPhone || s.phone || "").replace(/\D/g, "");
    if (phone) phones.push(phone);
  }

  return { emails, phones, storeName: s.storeName || "My Shop" };
}

// ─── Send email notification ──────────────────────────────────────────────────
async function sendNotifEmail(to: string, subject: string, html: string, type: string): Promise<{ status: NotificationStatus; error?: string }> {
  try {
    const ok = await sendEmail(to, subject, html, type);
    return { status: ok ? "sent" : "failed", error: ok ? undefined : "sendEmail returned false" };
  } catch (err: any) {
    return { status: "failed", error: err?.message || "Email send error" };
  }
}

// ─── Send WhatsApp notification ───────────────────────────────────────────────
// Admin messages are logged against the "staff" entity; customer messages link
// the conversation to the customer so it shows up in their WhatsApp thread.
async function sendNotifWhatsApp(
  to: string,
  text: string,
  storeName: string,
  entityType: string = "staff",
  entityId: number = 0,
  entityName: string = "My Shop"
): Promise<{ status: NotificationStatus; error?: string; messageId?: string }> {
  try {
    const r = await sendWhatsAppMessage(to, text, entityType, entityId, entityName || "My Shop");
    if (r.ok) return { status: "sent", messageId: r.messageId };
    return { status: "failed", error: r.error || "WhatsApp send failed" };
  } catch (err: any) {
    return { status: "failed", error: err?.message || "WhatsApp send error" };
  }
}

// ─── Log notification attempt ─────────────────────────────────────────────────
interface LogFields {
  subject?: string;
  customerId?: number;
  idempotencyKey?: string;
}

async function logNotification(
  event: NotificationEvent,
  channel: NotificationChannel,
  recipient: string,
  status: NotificationStatus,
  entityType: string,
  entityId: string | number,
  error?: string,
  providerMessageId?: string,
  fields: LogFields = {}
): Promise<void> {
  try {
    const { query } = await import("./db-helpers");
    await query(
      `INSERT INTO notification_log (event_type, channel, recipient, status, entity_type, entity_id, error_message, provider_message_id, subject, customer_id, idempotency_key, sent_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()::text)`,
      [
        event, channel, recipient, status, entityType, String(entityId),
        error || null, providerMessageId || null,
        fields.subject || null, fields.customerId || null, fields.idempotencyKey || null,
        status === "sent" ? new Date().toISOString() : null,
      ]
    );
  } catch (err: any) {
    console.warn("[notification-service] Failed to log notification:", err?.message || err);
  }
}

// ─── Durable outbound queue ───────────────────────────────────────────────────
// dispatchNotification now PERSISTS each recipient/channel as a row in
// notification_deliveries first (fast DB writes, no external I/O in the request
// path) and returns immediately. A background worker drains pending rows, sends
// through the real channels, and settles with attempts + exponential backoff,
// dead-lettering after max_attempts. A notification failure can therefore never
// fail or roll back the business transaction that created the event.
import {
  enqueueDelivery,
  listPendingDeliveries,
  settleDelivery,
  markDeliveryAttempt,
} from "./integrations-store";

// Exponential backoff per attempt index (1 = first retry after the initial try).
export function deliveryBackoffMs(attempt: number): number {
  const steps = [30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000, 60 * 60_000];
  if (!(attempt > 0)) return steps[0];
  return steps[Math.min(attempt - 1, steps.length - 1)];
}

function parsePayload(raw: string | null): any {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

interface DeliveryRow {
  id: number;
  event_id: string;
  event_type: string;
  channel: string;
  recipient: string;
  subject: string;
  payload: string;
  attempts: number;
  max_attempts: number;
  entity_type: string;
  entity_id: string;
  customer_id: number | null;
}

// Insert one delivery row (UNIQUE(event_id, channel, recipient) makes
// re-dispatch idempotent across restarts).
async function pushDelivery(row: {
  eventId: string; eventType: string; channel: NotificationChannel; audience: NotificationAudience;
  entityType: string; entityId: string; recipient: string; subject: string; payload: string;
  customerId?: number;
}): Promise<void> {
  await enqueueDelivery({
    eventId: row.eventId,
    eventType: row.eventType,
    channel: row.channel,
    audience: row.audience,
    entityType: row.entityType,
    entityId: row.entityId,
    recipient: row.recipient,
    subject: row.subject,
    payload: row.payload,
    maxAttempts: 5,
    customerId: row.customerId ?? null,
    idempotencyKey: row.eventId,
  });
}

// Main dispatch: resolve targets + preferences + opt-outs, persist deliveries.
export async function enrollNotification(ctx: NotificationContext): Promise<NotificationResult> {
  const result: NotificationResult = { event: ctx.event };
  const audience: NotificationAudience = ctx.audience || "admin";

  const idempotencyKey = ctx.idempotencyKey || `${ctx.entityType}:${ctx.entityId}:${ctx.event}:${audience}`;
  const alreadySent = await getSentChannels(idempotencyKey);
  if (alreadySent.size >= 2 && isDuplicate(idempotencyKey)) {
    console.log(`[notification-service] Skipping duplicate event (all channels delivered): ${idempotencyKey}`);
    return result;
  }
  isDuplicate(idempotencyKey);

  const prefs = await getPreferences();
  const eventPrefs = prefs[ctx.event] || { email: false, whatsapp: false };

  const settings = await getSettings();
  const storeName = settings.storeName || "My Shop";
  let emailTargets: string[] = [];
  let phoneTargets: string[] = [];
  const optOut = { email: false, whatsapp: false };
  if (audience === "customer") {
    if (ctx.customerId) {
      const p = await getCustomerCommPrefs(ctx.customerId);
      optOut.email = !p.email;
      optOut.whatsapp = !p.whatsapp;
    }
    if (ctx.recipientEmail) emailTargets = [ctx.recipientEmail];
    if (ctx.recipientPhone) phoneTargets = [ctx.recipientPhone];
  } else {
    const targets = await getAdminTargets();
    emailTargets = targets.emails;
    phoneTargets = targets.phones;
  }

  const logFields: LogFields = { subject: ctx.subject, customerId: audience === "customer" ? ctx.customerId : undefined, idempotencyKey };
  const entityId = String(ctx.entityId);
  const emailPayload = JSON.stringify({ html: ctx.bodyHtml || `<p>${(ctx.bodyText || "").replace(/\n/g, "<br>")}</p>`, type: `notification_${ctx.event}` });
  const whatsappPayload = JSON.stringify({
    text: ctx.bodyText || ctx.subject || "",
    entityType: audience === "customer" ? "customer" : "staff",
    entityId: audience === "customer" ? (ctx.customerId || 0) : 0,
    entityName: audience === "customer" ? (ctx.recipientName || "Customer") : storeName,
  });

  // ── Email channel ──
  if (!eventPrefs.email) {
    result.email = { status: "disabled" };
  } else if (alreadySent.has("email")) {
    result.email = { status: "sent", recipient: emailTargets[0] };
  } else if (audience === "customer" && optOut.email) {
    result.email = { status: "skipped", error: "Customer opted out of email" };
    await logNotification(ctx.event, "email", "", "skipped", ctx.entityType, entityId, "Customer opted out of email", undefined, logFields);
  } else if (emailTargets.length === 0) {
    result.email = { status: "skipped", error: audience === "customer" ? "No customer email on file" : "No admin email configured" };
  } else {
    for (const email of emailTargets) {
      await pushDelivery({ eventId: idempotencyKey, eventType: ctx.event, channel: "email", audience, entityType: ctx.entityType, entityId, recipient: email, subject: ctx.subject, payload: emailPayload, customerId: ctx.customerId });
      result.email = { status: "pending", recipient: email };
    }
  }

  // ── WhatsApp channel ──
  if (!eventPrefs.whatsapp) {
    result.whatsapp = { status: "disabled" };
  } else if (alreadySent.has("whatsapp")) {
    result.whatsapp = { status: "sent", recipient: phoneTargets[0] };
  } else if (audience === "customer" && optOut.whatsapp) {
    result.whatsapp = { status: "skipped", error: "Customer opted out of WhatsApp" };
    await logNotification(ctx.event, "whatsapp", "", "skipped", ctx.entityType, entityId, "Customer opted out of WhatsApp", undefined, logFields);
  } else if (phoneTargets.length === 0) {
    result.whatsapp = { status: "skipped", error: audience === "customer" ? "No customer WhatsApp number on file" : "No admin WhatsApp phone configured" };
  } else {
    for (const phone of phoneTargets) {
      await pushDelivery({ eventId: idempotencyKey, eventType: ctx.event, channel: "whatsapp", audience, entityType: ctx.entityType, entityId, recipient: phone, subject: ctx.subject, payload: whatsappPayload, customerId: ctx.customerId });
      result.whatsapp = { status: "pending", recipient: phone };
    }
  }

  return result;
}

export async function dispatchNotification(ctx: NotificationContext): Promise<NotificationResult> {
  return enrollNotification(ctx);
}

// ─── Outbound worker ──────────────────────────────────────────────────────────

// Process a single delivery row: send through the real channel, then settle.
export async function processPendingDelivery(row: DeliveryRow): Promise<"sent" | "failed" | "dead" | "skipped"> {
  const attemptsAfter = Number(row.attempts || 0) + 1;
  const maxAttempts = Number(row.max_attempts || 5);
  const entityType = row.entity_type || "staff";
  const entityId = row.entity_id || "0";
  const logFields: LogFields = { subject: row.subject || undefined, customerId: row.customer_id ?? undefined, idempotencyKey: row.event_id };
  const payload = parsePayload(row.payload);

  try {
    if (row.channel === "email") {
    if (payload?.__invoice) {
      const kind = (payload?.kind === "delivered" ? "delivered" : "paid") as "paid" | "delivered";
      const orderId = Number(payload?.orderId || entityId);
      const res = await sendOrderInvoiceDeliveryEmail(orderId, kind);
      if (!res.ok) return await failDelivery(row, attemptsAfter, maxAttempts, res.error || "Invoice email failed", entityType, entityId, logFields);
      await settleDelivery(row.id, { status: "sent", sentAt: new Date().toISOString() });
      await logNotification(row.event_type as NotificationEvent, "email", row.recipient, "sent", entityType, entityId, undefined, undefined, logFields);
      return "sent";
    }
    const html = payload?.html || `<p>${(payload?.text || row.subject || "").replace(/\n/g, "<br>")}</p>`;
    const type = payload?.type || `notification_${row.event_type}`;
    const ok = await sendEmail(row.recipient, row.subject || "", html, type);
    if (!ok) return await failDelivery(row, attemptsAfter, maxAttempts, "Email send failed", entityType, entityId, logFields);
    await settleDelivery(row.id, { status: "sent", sentAt: new Date().toISOString() });
    await logNotification(row.event_type as NotificationEvent, "email", row.recipient, "sent", entityType, entityId, undefined, undefined, logFields);
    return "sent";
  }

  if (row.channel === "whatsapp") {
    if (payload?.__invoice) {
      const kind = (payload?.kind === "delivered" ? "delivered" : "paid") as "paid" | "delivered";
      const orderId = Number(payload?.orderId || entityId);
      const res = await sendOrderInvoiceDeliveryWhatsApp(orderId, kind);
      if (!res.ok) return await failDelivery(row, attemptsAfter, maxAttempts, res.error || "Invoice WhatsApp failed", entityType, entityId, logFields);
      await settleDelivery(row.id, { status: "sent", sentAt: new Date().toISOString() });
      await logNotification(row.event_type as NotificationEvent, "whatsapp", row.recipient, "sent", entityType, entityId, undefined, res.messageId, logFields);
      return "sent";
    }
    const text = payload?.text || row.subject || "";
    const r = await sendNotifWhatsApp(row.recipient, text, payload?.entityName || "My Shop", payload?.entityType || "staff", Number(payload?.entityId || 0), payload?.entityName || "My Shop");
    if (r.status !== "sent") return await failDelivery(row, attemptsAfter, maxAttempts, r.error || "WhatsApp send failed", entityType, entityId, logFields);
    await settleDelivery(row.id, { status: "sent", sentAt: new Date().toISOString() });
    await logNotification(row.event_type as NotificationEvent, "whatsapp", row.recipient, "sent", entityType, entityId, undefined, r.messageId, logFields);
    return "sent";
  }


    return await failDelivery(row, attemptsAfter, maxAttempts, `Unknown channel ${row.channel}`, entityType, entityId, logFields, true);
  } catch (err: any) {
    return await failDelivery(row, attemptsAfter, maxAttempts, err?.message || String(err), entityType, entityId, logFields);
  }
}

async function failDelivery(
  row: DeliveryRow,
  attemptsAfter: number,
  maxAttempts: number,
  error: string,
  entityType: string,
  entityId: string,
  logFields: LogFields,
  giveUp: boolean = false
): Promise<"failed" | "dead" | "skipped"> {
  const terminal = giveUp || attemptsAfter >= maxAttempts;
  if (terminal) {
    await markDeliveryAttempt(row.id, { status: "dead", error: error.slice(0, 500), nextAttemptAt: null });
    await logNotification(row.event_type as NotificationEvent, row.channel as NotificationChannel, row.recipient, "failed", entityType, entityId, error, undefined, logFields);
    return "dead";
  }
  const backoff = deliveryBackoffMs(attemptsAfter);
  await markDeliveryAttempt(row.id, { status: "failed", error: error.slice(0, 500), nextAttemptAt: new Date(Date.now() + backoff).toISOString() });
  await logNotification(row.event_type as NotificationEvent, row.channel as NotificationChannel, row.recipient, "failed", entityType, entityId, error, undefined, logFields);
  return "failed";
}

let drainLock = false;

// Process up to `limit` due deliveries. Safe to call from a timer or after an
// enroll; guarded so concurrent drains never double-send.
export async function drainNotificationQueueOnce(limit: number = 25): Promise<{ processed: number; sent: number; failed: number; dead: number; skipped?: number }> {
  const counters = { processed: 0, sent: 0, failed: 0, dead: 0 };
  if (drainLock) return { ...counters, skipped: 0 };
  drainLock = true;
  try {
    const rows = await listPendingDeliveries(limit);
    for (const row of rows) {
      counters.processed++;
      const outcome = await processPendingDelivery(row);
      if (outcome === "sent") counters.sent++;
      else if (outcome === "dead") counters.dead++;
      else counters.failed++;
    }
    return { ...counters };
  } catch (err: any) {
    console.warn("[notification-queue] Drain failed:", err?.message || err);
    return { ...counters };
  } finally {
    drainLock = false;
  }
}

export function startNotificationQueueWorker(intervalMs: number = 15_000): NodeJS.Timeout {
  const timer = setInterval(() => {
    drainNotificationQueueOnce(50).catch((err: any) =>
      console.warn("[notification-queue] Tick failed:", err?.message || err)
    );
  }, intervalMs);
  timer.unref();
  drainNotificationQueueOnce(50).catch(() => {});
  return timer;
}

// ─── Convenience: fire-and-forget wrapper ─────────────────────────────────────
export async function notify(ctx: NotificationContext): Promise<void> {
  dispatchNotification(ctx).catch((err: any) =>
    console.warn(`[notification-service] Dispatch failed for ${ctx.event}:`, err?.message || err)
  );
}

// ─── Preference management ────────────────────────────────────────────────────
export async function getNotificationPreferences(): Promise<Record<NotificationEvent, { email: boolean; whatsapp: boolean }>> {
  return getPreferences();
}

export async function updateNotificationPreferences(update: Partial<Record<NotificationEvent, { email?: boolean; whatsapp?: boolean }>>): Promise<Record<NotificationEvent, { email: boolean; whatsapp: boolean }>> {
  const current = await getPreferences();
  const merged = { ...current };
  for (const [event, change] of Object.entries(update)) {
    if (merged[event as NotificationEvent]) {
      if (change.email !== undefined) merged[event as NotificationEvent].email = change.email;
      if (change.whatsapp !== undefined) merged[event as NotificationEvent].whatsapp = change.whatsapp;
    }
  }
  const { query } = await import("./db-helpers");
  await query(
    "INSERT INTO settings (key, value) VALUES ('notification_preferences', $1) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value",
    [JSON.stringify(merged)]
  );
  return merged;
}

// ─── Notification log queries ─────────────────────────────────────────────────
export async function listNotificationLog(
  limit: number = 50,
  offset: number = 0,
  eventFilter?: string,
  customerId?: number
): Promise<{ logs: any[]; total: number }> {
  const { queryAll, queryOne } = await import("./db-helpers");
  const conds: string[] = [];
  const params: any[] = [];
  if (eventFilter) { params.push(eventFilter); conds.push(`event_type = $${params.length}`); }
  if (customerId) { params.push(customerId); conds.push(`customer_id = $${params.length}`); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const countRow = await queryOne(`SELECT COUNT(*) as total FROM notification_log ${where}`, params) as any;
  const total = countRow?.total || 0;
  const logs = await queryAll(
    `SELECT id, event_type, channel, recipient, status, entity_type, entity_id, error_message, provider_message_id, subject, customer_id, idempotency_key, sent_at, created_at
     FROM notification_log ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { logs, total };
}

export async function enqueueOrderInvoiceDelivery(orderId: number, kind: "paid" | "delivered"): Promise<void> {
  try {
    const order = await getOrder(orderId);
    if (!order) return;
    const settings = await getSettings();
    const prefs = await getCustomerCommPrefs(order.customerId);
    const payload = { __invoice: true, orderId, kind, entityType: "order", entityId: orderId };

    const baseKey = `order:${orderId}:invoice:${kind}`;
    if (prefs.email) {
      const keyEmail = `${baseKey}:email`;
      const email = String(order.customerEmail || "").trim();
      if (email) {
        await enqueueDelivery({
          eventId: keyEmail,
          eventType: kind === "paid" ? ("order.paid" as any) : ("order.status_changed" as any),
          channel: "email",
          audience: "customer",
          entityType: "order",
          entityId: String(orderId),
          recipient: email,
          subject: kind === "paid" ? `Invoice for Order #${orderId}` : `Invoice — Order #${orderId}`,
          payload: JSON.stringify({ ...payload, type: kind === "paid" ? "order_invoice" : "order_status" }),
          maxAttempts: 5,
          customerId: order.customerId ?? null,
          idempotencyKey: keyEmail,
        });
      }
    }

    if (prefs.whatsapp) {
      const s = await getSettings();
      if (s.whatsappEnabled && s.whatsappPhoneNumberId && s.whatsappAccessToken) {
        const keyWa = `${baseKey}:whatsapp`;
        const phone = normalizePhone(String((order as any).shippingPhone || (order as any).customerPhone || order.customerName ? (order as any).shippingPhone || (order as any).customerPhone || "" : "").trim());
        if (phone) {
          await enqueueDelivery({
            eventId: keyWa,
            eventType: kind === "paid" ? ("order.paid" as any) : ("order.status_changed" as any),
            channel: "whatsapp",
            audience: "customer",
            entityType: "order",
            entityId: String(orderId),
            recipient: phone,
            subject: `Invoice for Order #${orderId}`,
            payload: JSON.stringify({ ...payload }),
            maxAttempts: 5,
            customerId: order.customerId ?? null,
            idempotencyKey: keyWa,
          });
        }
      } else {
        try {
          await logNotification(kind === "paid" ? ("order.paid" as any) : ("order.status_changed" as any), "whatsapp", "", "skipped", "order", String(orderId), "WhatsApp not configured", undefined, { customerId: order.customerId ?? undefined, idempotencyKey: `${baseKey}:whatsapp` });
        } catch { }
      }
    }
  } catch (err: any) {
    console.warn(`[notification-service] enqueueOrderInvoiceDelivery failed for order ${orderId}:`, err?.message || err);
  }
}
