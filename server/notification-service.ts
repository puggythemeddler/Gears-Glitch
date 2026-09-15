// Centralized notification dispatcher for Gears&Glitch
// Routes business events to email + WhatsApp channels with preferences, logging, and idempotency.

import { getSettings } from "./db";
import { sendEmail } from "./email";
import { sendWhatsAppMessage } from "./whatsapp";

// ─── Notification Event Types ────────────────────────────────────────────────
export type NotificationEvent =
  | "order.created"
  | "order.paid"
  | "order.status_changed"
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
  | "warranty.created"
  | "warranty.status_changed"
  | "warranty.approved"
  | "warranty.rejected"
  | "warranty.resolved"
  | "invoice.created"
  | "invoice.paid"
  | "invoice.overdue"
  | "subscription.changed"
  | "subscription.expiring"
  | "subscription.expired";

// ─── Notification Channel ─────────────────────────────────────────────────────
export type NotificationChannel = "email" | "whatsapp";

// ─── Notification Status ──────────────────────────────────────────────────────
export type NotificationStatus = "pending" | "sent" | "failed" | "skipped" | "disabled";

// ─── Default Preferences (all enabled for admin) ──────────────────────────────
const DEFAULT_PREFERENCES: Record<NotificationEvent, { email: boolean; whatsapp: boolean }> = {
  "order.created":          { email: true, whatsapp: true },
  "order.paid":             { email: true, whatsapp: true },
  "order.status_changed":   { email: true, whatsapp: false },
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
  "warranty.created":       { email: true, whatsapp: true },
  "warranty.status_changed":{ email: true, whatsapp: false },
  "warranty.approved":      { email: true, whatsapp: true },
  "warranty.rejected":      { email: true, whatsapp: true },
  "warranty.resolved":      { email: true, whatsapp: true },
  "invoice.created":        { email: true, whatsapp: false },
  "invoice.paid":           { email: true, whatsapp: false },
  "invoice.overdue":        { email: true, whatsapp: false },
  "subscription.changed":   { email: true, whatsapp: false },
  "subscription.expiring":  { email: true, whatsapp: false },
  "subscription.expired":   { email: true, whatsapp: true },
};

// ─── In-memory idempotency cache (last 1000 keys, TTL 5 min) ─────────────────
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

// ─── Send WhatsApp notification (simple text, no conversation tracking) ────────
async function sendNotifWhatsApp(to: string, text: string, storeName: string): Promise<{ status: NotificationStatus; error?: string }> {
  try {
    await sendWhatsAppMessage(to, text, "staff", 0, storeName || "My Shop");
    return { status: "sent" };
  } catch (err: any) {
    return { status: "failed", error: err?.message || "WhatsApp send error" };
  }
}

// ─── Log notification attempt ─────────────────────────────────────────────────
async function logNotification(
  event: NotificationEvent,
  channel: NotificationChannel,
  recipient: string,
  status: NotificationStatus,
  entityType: string,
  entityId: string | number,
  error?: string,
  providerMessageId?: string
): Promise<void> {
  try {
    const { query } = await import("./db-helpers");
    await query(
      `INSERT INTO notification_log (event_type, channel, recipient, status, entity_type, entity_id, error_message, provider_message_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()::text)`,
      [event, channel, recipient, status, entityType, String(entityId), error || null, providerMessageId || null]
    );
  } catch (err: any) {
    console.warn("[notification-service] Failed to log notification:", err?.message || err);
  }
}

// ─── Main dispatch function ───────────────────────────────────────────────────
export async function dispatchNotification(ctx: NotificationContext): Promise<NotificationResult> {
  const result: NotificationResult = { event: ctx.event };

  // Idempotency check
  const idempotencyKey = `${ctx.entityType}:${ctx.entityId}:${ctx.event}`;
  if (isDuplicate(idempotencyKey)) {
    console.log(`[notification-service] Skipping duplicate event: ${idempotencyKey}`);
    return result;
  }

  const prefs = await getPreferences();
  const eventPrefs = prefs[ctx.event] || { email: false, whatsapp: false };
  const targets = await getAdminTargets();
  if (eventPrefs.email && targets.emails.length > 0) {
    const html = ctx.bodyHtml || `<p>${ctx.bodyText.replace(/\n/g, "<br>")}</p>`;
    for (const email of targets.emails) {
      const emailResult = await sendNotifEmail(email, ctx.subject, html, `notification_${ctx.event}`);
      result.email = { ...emailResult, recipient: email };
      await logNotification(ctx.event, "email", email, emailResult.status, ctx.entityType, ctx.entityId, emailResult.error);
    }
  } else if (!eventPrefs.email) {
    result.email = { status: "disabled" };
  } else {
    result.email = { status: "skipped", error: "No admin email configured" };
  }

  // WhatsApp channel
  if (eventPrefs.whatsapp && targets.phones.length > 0) {
    for (const phone of targets.phones) {
      const waResult = await sendNotifWhatsApp(phone, ctx.bodyText, targets.storeName);
      result.whatsapp = { ...waResult, recipient: phone };
      await logNotification(ctx.event, "whatsapp", phone, waResult.status, ctx.entityType, ctx.entityId, waResult.error);
    }
  } else if (!eventPrefs.whatsapp) {
    result.whatsapp = { status: "disabled" };
  } else {
    result.whatsapp = { status: "skipped", error: "No admin WhatsApp phone configured" };
  }

  return result;
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
export async function listNotificationLog(limit: number = 50, offset: number = 0, eventFilter?: string): Promise<{ logs: any[]; total: number }> {
  const { queryAll, queryOne } = await import("./db-helpers");
  let where = "";
  const params: any[] = [];
  if (eventFilter) {
    where = "WHERE event_type = $1";
    params.push(eventFilter);
  }
  const countRow = await queryOne(`SELECT COUNT(*) as total FROM notification_log ${where}`, params) as any;
  const total = countRow?.total || 0;
  const logs = await queryAll(
    `SELECT id, event_type, channel, recipient, status, entity_type, entity_id, error_message, provider_message_id, created_at
     FROM notification_log ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { logs, total };
}
