// Customer-facing notification orchestration.
//
// Owns the "business event -> personalized customer message" translation:
// device aggregation, warranty expiry derivation, deterministic idempotency
// keys and message bodies. Dispatch (preferences, opt-outs, channels, logging)
// is delegated to notification-service so admin and customer messaging share
// one path.

import { getSettings, getOrder, getStoreSetting, setStoreSetting, findCustomerById, findCustomerByEmail } from "./db";
import { queryAll, queryOne, getPool } from "./db-helpers";
import { notify } from "./notification-service";
import {
  welcomeCustomerEmail,
  orderProcessedCustomerEmail,
  warrantyReminderCustomerEmail,
  warrantyExpiredCustomerEmail,
  repairCustomerEmail,
  warrantyClaimCustomerEmail,
  CustomerDeviceInfo,
} from "./email";

const DEFAULT_REMINDER_DAYS = 30;

function baseUrl(): string {
  return (process.env.FRONTEND_URL || process.env.BASE_URL || "").replace(/\/$/, "");
}

export function normalizePhone(phone?: string | null): string {
  return String(phone || "").replace(/\D/g, "");
}

function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(String(v).replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Mirrors the authoritative warranty register computation: prefer the expiry
// snapshotted at sale (order item, then serial), else derive from the sale date
// with whole-calendar-month addition and month-end clamping.
export function deriveWarranty(row: any): { start: Date | null; expiry: Date | null; daysLeft: number | null; status: "active" | "expiring" | "expired" | "none" } {
  const start = parseDate(row.sold_at) || parseDate(row.order_created_at);
  let expiry = parseDate(row.order_item_expires) || parseDate(row.warranty_expires);
  const duration = Number(row.warranty_duration) || 0;
  if (!expiry && start && duration > 0) {
    const m = start.getMonth() + duration;
    const y = start.getFullYear() + Math.floor(m / 12);
    const mo = ((m % 12) + 12) % 12;
    const lastDay = new Date(y, mo + 1, 0).getDate();
    expiry = new Date(y, mo, Math.min(start.getDate(), lastDay));
  }
  if (!expiry) return { start, expiry: null, daysLeft: null, status: "none" };
  const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
  const status = daysLeft < 0 ? "expired" : daysLeft <= 30 ? "expiring" : "active";
  return { start, expiry, daysLeft, status };
}

// ─── Warranty reminder lead time (admin configurable, default 30 days) ────────
export async function getWarrantyReminderDays(): Promise<number> {
  try {
    const raw = await getStoreSetting("warranty_reminder_days");
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1 && n <= 365) return Math.floor(n);
  } catch { /* fall through */ }
  return DEFAULT_REMINDER_DAYS;
}

export async function setWarrantyReminderDays(days: number): Promise<number> {
  const n = Math.floor(Number(days));
  const safe = Number.isFinite(n) && n >= 1 && n <= 365 ? n : DEFAULT_REMINDER_DAYS;
  await setStoreSetting("warranty_reminder_days", String(safe));
  return safe;
}

// ─── Device aggregation (consolidated into ONE message per order) ─────────────
export function buildOrderDevices(order: any): CustomerDeviceInfo[] {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.filter((i: any) => !i.cancelled).map((i: any) => {
    const device: CustomerDeviceInfo = { name: String(i.name || "Item") };
    if (i.serialNumber) device.serialNumber = String(i.serialNumber);
    // Coverage = a sale-time order-item snapshot, a registered serial record, or
    // a warranty-bearing product. Precedence inside deriveWarranty: order-item
    // snapshot → serial record → derivation from the sale date + duration.
    const hasCoverage = i.hasWarranty || !!i.serialWarrantyExpires;
    if (hasCoverage) {
      const d = deriveWarranty({
        order_item_expires: i.warrantyExpires,
        warranty_expires: i.serialWarrantyExpires,
        sold_at: i.serialSoldAt,
        order_created_at: order.createdAt,
        warranty_duration: i.warrantyDuration,
      });
      if (d.expiry) {
        device.warrantyStatus = d.status === "none" ? "active" : d.status;
        device.warrantyStart = d.start ? isoDay(d.start) : undefined;
        device.warrantyExpiry = isoDay(d.expiry);
      }
    }
    return device;
  });
}

// Enrich order items with the registered serial's warranty record so messages
// can fall back to serial-level coverage when the order-item snapshot is absent.
async function enrichOrderItemsWithSerialWarranty(order: any): Promise<void> {
  const itemIds = (order?.items || []).map((i: any) => Number(i.id)).filter((n: number) => Number.isInteger(n) && n > 0);
  if (!itemIds.length) return;
  try {
    const rows = await queryAll("SELECT order_item_id, sold_at, warranty_expires FROM serial_numbers WHERE order_item_id = ANY($1)", [itemIds]) as any[];
    for (const r of rows) {
      const item = (order.items || []).find((i: any) => Number(i.id) === Number(r.order_item_id));
      if (item) {
        if (r.sold_at) item.serialSoldAt = r.sold_at;
        if (r.warranty_expires) item.serialWarrantyExpires = r.warranty_expires;
      }
    }
  } catch { /* optional enrichment — never blocks the message */ }
}

function orderTotal(order: any): string {
  const total = Number(order.subtotal) + Number(order.shippingFee) - (Number(order.discountAmount) || 0) - (Number(order.giftCardAmount) || 0);
  return total.toFixed(2);
}

async function customerContact(order: any): Promise<{ id?: number; name: string; email: string; phone: string }> {
  let customer: any = undefined;
  if (order.customerId) {
    try { customer = await findCustomerById(Number(order.customerId)); } catch { /* optional */ }
  }
  const email = String(order.customerEmail || customer?.email || "").trim();
  const phone = normalizePhone(order.shippingPhone || customer?.phone || "");
  return {
    id: customer?.id || (order.customerId ? Number(order.customerId) : undefined),
    name: String(order.customerName || customer?.name || "there"),
    email,
    phone,
  };
}

// ─── Welcome (fires on account creation) ──────────────────────────────────────
export async function notifyCustomerWelcome(customer: { id: number; name: string; email: string; phone?: string }): Promise<void> {
  const email = String(customer?.email || "").trim();
  const phone = normalizePhone(customer?.phone);
  // Channels are resolved independently: an email-only or WhatsApp-only account
  // still gets a welcome on the channel it does have. If a customer has neither
  // (anomaly), record a skipped row so the gap is visible in the message log.
  if (!email && !phone) {
    try {
      const { query } = await import("./db-helpers");
      await query(
        `INSERT INTO notification_log (event_type, channel, recipient, status, entity_type, entity_id, error_message, customer_id, idempotency_key, created_at)
         VALUES ('customer.created', 'email', '', 'skipped', 'customer', $1, 'No customer contact channel (email/phone) on file', $2, $3, NOW()::text)`,
        [String(customer?.id ?? ""), customer?.id || null, `customer.created:customer:${customer?.id}`]
      );
    } catch { /* non-fatal */ }
    return;
  }
  const settings = await getSettings();
  const storeName = settings.storeName || "My Shop";
  const { subject, html } = welcomeCustomerEmail(customer.name || "there", storeName, `${baseUrl()}/dashboard`);
  const bodyText = `Hi ${customer.name || "there"}, welcome to ${storeName}! Your account is ready — track orders, warranties and repairs at ${baseUrl()}/dashboard.`;
  await notify({
    event: "customer.created",
    entityType: "customer",
    entityId: customer.id,
    subject,
    bodyText,
    bodyHtml: html,
    audience: "customer",
    customerId: customer.id,
    recipientEmail: email,
    recipientPhone: phone,
    recipientName: customer.name || "Customer",
    idempotencyKey: `customer.created:customer:${customer.id}`,
  });
}

// ─── Order processed (personalized, consolidated devices) ─────────────────────
export async function notifyCustomerOrderProcessed(orderId: number): Promise<void> {
  const order = await getOrder(orderId);
  if (!order) return;
  const processedStatuses = ["paid", "confirmed", "shipped", "delivered"];
  if (!processedStatuses.includes(String(order.status))) return;

  // order.processed is an "order confirmed AFTER payment" appreciation. It must
  // never fire on an order whose payment is unverified — provider/admin routes can
  // mark an order confirmed/shipped without money moving (those customers get the
  // orderStatusEmail from the route itself). Verified = status paid/delivered
  // (set only after genuine payment verification) or an M-Pesa receipt on file.
  try {
    const core = await queryOne("SELECT status, mpesa_receipt FROM orders WHERE id = $1", [orderId]) as any;
    const verified = core && (
      ["paid", "delivered"].includes(String(core.status)) ||
      (core.mpesa_receipt && String(core.mpesa_receipt).trim() !== "")
    );
    if (!verified) return;
  } catch { return; }

  const contact = await customerContact(order);
  if (!contact.email && !contact.phone) return;

  await enrichOrderItemsWithSerialWarranty(order);

  const settings = await getSettings();
  const storeName = settings.storeName || "My Shop";
  const devices = buildOrderDevices(order);
  const total = orderTotal(order);
  const currency = settings.currency || "KES";
  const orderUrl = `${baseUrl()}/order?id=${order.id}`;
  const { subject, html } = orderProcessedCustomerEmail(contact.name, `#${order.id}`, devices, total, currency, storeName, orderUrl);
  const deviceSummary = devices.length
    ? devices.map((d) => `${d.name}${d.serialNumber ? ` (SN ${d.serialNumber})` : ""}`).join(", ")
    : "your order";
  const bodyText = `Hi ${contact.name}, your order #${order.id} has been processed. Items: ${deviceSummary}. Total: ${currency} ${total}. View: ${orderUrl}`;

  await notify({
    event: "order.processed",
    entityType: "order",
    entityId: order.id,
    subject,
    bodyText,
    bodyHtml: html,
    audience: "customer",
    customerId: contact.id,
    recipientEmail: contact.email,
    recipientPhone: contact.phone,
    recipientName: contact.name,
    idempotencyKey: `order.processed:order:${order.id}`,
    metadata: { source: order.source || "storefront", deviceCount: devices.length },
  });
}

// ─── Repair customer update (personalized device details) ─────────────────────
export async function notifyCustomerRepairUpdate(input: {
  ticketId: string;
  customerId?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  deviceType?: string;
  deviceModel?: string;
  serialNumber?: string;
  statusLabel: string;
}): Promise<void> {
  let email = String(input.customerEmail || "").trim();
  let phone = normalizePhone(input.customerPhone);
  let customerName = input.customerName || "";
  if (input.customerId && (!email || !phone || !customerName)) {
    try {
      const c: any = await findCustomerById(Number(input.customerId));
      if (c) { email = email || String(c.email || "").trim(); phone = phone || normalizePhone(c.phone); customerName = customerName || c.name; }
    } catch { /* optional */ }
  }
  if (!email && !phone) return;
  const settings = await getSettings();
  const storeName = settings.storeName || "My Shop";
  const deviceLabel = [input.deviceType, input.deviceModel].filter(Boolean).join(" ").trim();
  const displayName = customerName || "there";
  const { subject, html } = repairCustomerEmail(
    displayName,
    input.ticketId,
    deviceLabel,
    input.serialNumber || "",
    input.statusLabel,
    storeName,
    `${baseUrl()}/my-repairs`
  );
  const bodyText = `Hi ${displayName}, repair ${input.ticketId} is now "${input.statusLabel}".${deviceLabel ? ` Device: ${deviceLabel}.` : ""}${input.serialNumber ? ` Serial: ${input.serialNumber}.` : ""}`;
  await notify({
    event: "repair.customer_update",
    entityType: "repair",
    entityId: input.ticketId,
    subject,
    bodyText,
    bodyHtml: html,
    audience: "customer",
    customerId: input.customerId,
    recipientEmail: email,
    recipientPhone: phone,
    recipientName: customerName || "Customer",
    idempotencyKey: `repair.customer_update:repair:${input.ticketId}:${input.statusLabel}`,
  });
}

// ─── Warranty claim customer update (personalized serial details) ─────────────
export async function notifyCustomerWarrantyUpdate(input: {
  claimId: number;
  warrantyRef?: string;
  customerId?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  serialNumber?: string;
  productName?: string;
  statusLabel: string;
}): Promise<void> {
  let email = String(input.customerEmail || "").trim();
  let phone = normalizePhone(input.customerPhone);
  let customerName = input.customerName || "";
  if (input.customerId && (!email || !phone || !customerName)) {
    try {
      const c: any = await findCustomerById(Number(input.customerId));
      if (c) { email = email || String(c.email || "").trim(); phone = phone || normalizePhone(c.phone); customerName = customerName || c.name; }
    } catch { /* optional */ }
  }
  if (!email && !phone) return;
  const settings = await getSettings();
  const storeName = settings.storeName || "My Shop";
  const displayName = customerName || "there";
  const { subject, html } = warrantyClaimCustomerEmail(
    displayName,
    input.claimId,
    input.warrantyRef || `#${input.claimId}`,
    input.serialNumber || "",
    input.statusLabel,
    storeName,
    `${baseUrl()}/dashboard`
  );
  const bodyText = `Hi ${displayName}, warranty claim #${input.claimId} is now "${input.statusLabel}".${input.productName ? ` Product: ${input.productName}.` : ""}${input.serialNumber ? ` Serial: ${input.serialNumber}.` : ""}`;
  await notify({
    event: "warranty.customer_update",
    entityType: "warranty",
    entityId: input.claimId,
    subject,
    bodyText,
    bodyHtml: html,
    audience: "customer",
    customerId: input.customerId,
    recipientEmail: email,
    recipientPhone: phone,
    recipientName: customerName || "Customer",
    idempotencyKey: `warranty.customer_update:warranty:${input.claimId}:${input.statusLabel}`,
  });
}

// ─── Warranty reminder / expired sweep ────────────────────────────────────────
// Advisory-lock gate: if the app ever runs more than one instance (Render can
// spin up a second replica), only one process performs the sweep at a time.
// Messages stay idempotent regardless, so worst case is wasted work without the
// lock — but this avoids double-sending races across processes during a sweep.
const WARRANTY_SWEEP_LOCK_KEY = 72748721;

export async function runWarrantyNotificationSweep(): Promise<{ reminders: number; expired: number; checked: number }> {
  let lock: any = null;
  let locked = false;
  try {
    lock = await getPool().connect();
    const got = await lock.query("SELECT pg_try_advisory_lock($1) AS locked", [WARRANTY_SWEEP_LOCK_KEY]);
    locked = !!got?.rows?.[0]?.locked;
    if (!locked) {
      console.log("[customer-notifications] Warranty sweep skipped — another instance holds the lock");
      return { reminders: 0, expired: 0, checked: 0 };
    }
  } catch {
    // Lock unavailable (hosted DB without advisory locks, etc.) — sweep anyway;
    // deterministic per-item idempotency keys keep it safe.
  }
  try {
    return await sweepWarrantiesInner();
  } finally {
    if (lock) {
      try { await lock.query("SELECT pg_advisory_unlock($1)", [WARRANTY_SWEEP_LOCK_KEY]); } catch { /* best-effort */ }
      lock.release();
    }
  }
}

async function sweepWarrantiesInner(): Promise<{ reminders: number; expired: number; checked: number }> {
  const reminderDays = await getWarrantyReminderDays();
  let rows: any[] = [];
  try {
    rows = await queryAll(`
      SELECT oi.id AS order_item_id,
             oi.order_id,
             oi.product_id,
             oi.name AS product_name,
             oi.warranty_duration,
             oi.warranty_expires AS order_item_expires,
             oi.serial_number,
             o.customer_id,
             o.customer_name,
             o.customer_email,
             o.shipping_phone,
             o.created_at AS order_created_at,
             o.status AS order_status,
             s.sold_at,
             s.warranty_expires
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN serial_numbers s ON s.order_item_id = oi.id
      WHERE oi.has_warranty = 1 AND oi.cancelled = 0
        AND o.status NOT IN ('cancelled', 'pending', 'pending_payment')
    `) as any[];
  } catch (err: any) {
    console.warn("[customer-notifications] Warranty sweep query failed:", err?.message || err);
    return { reminders: 0, expired: 0, checked: 0 };
  }

  const settings = await getSettings();
  const storeName = settings.storeName || "My Shop";
  const orderUrlBase = baseUrl();
  let reminders = 0;
  let expired = 0;
  const seen = new Set<string>();

  for (const row of rows) {
    const d = deriveWarranty(row);
    if (!d.expiry || d.daysLeft == null) continue;
    const expiryIso = isoDay(d.expiry);
    const itemId = Number(row.order_item_id);
    const email = String(row.customer_email || "").trim();
    let phone = normalizePhone(row.shipping_phone);
    let customerName = String(row.customer_name || "there");

    // Resolve customer phone/name when the order predates a customer link.
    if (row.customer_id) {
      try {
        const c: any = await findCustomerById(Number(row.customer_id));
        if (c) { phone = phone || normalizePhone(c.phone); customerName = customerName || c.name; }
      } catch { /* optional */ }
    }
    if (!email && !phone) continue;

    const common = {
      entityType: "order_item",
      entityId: itemId,
      audience: "customer" as const,
      customerId: row.customer_id ? Number(row.customer_id) : undefined,
      recipientEmail: email,
      recipientPhone: phone,
      recipientName: customerName,
    };

    if (d.daysLeft < 0) {
      const key = `warranty.expired:order_item:${itemId}:${expiryIso}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const { subject, html } = warrantyExpiredCustomerEmail(customerName, row.product_name, row.serial_number || "", expiryIso, storeName);
      const bodyText = `Hi ${customerName}, the warranty on your ${row.product_name} expired on ${expiryIso}. We can still help with a repair.`;
      await notify({ event: "warranty.expired", subject, bodyText, bodyHtml: html, idempotencyKey: key, ...common });
      expired++;
    } else if (d.daysLeft <= reminderDays) {
      const key = `warranty.expiry_reminder:order_item:${itemId}:${expiryIso}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const { subject, html } = warrantyReminderCustomerEmail(customerName, row.product_name, row.serial_number || "", expiryIso, d.daysLeft, storeName, `${orderUrlBase}/order?id=${row.order_id}`);
      const bodyText = `Hi ${customerName}, the warranty on your ${row.product_name} expires in ${d.daysLeft} day(s) on ${expiryIso}.`;
      await notify({ event: "warranty.expiry_reminder", subject, bodyText, bodyHtml: html, idempotencyKey: key, ...common });
      reminders++;
    }
  }

  return { reminders, expired, checked: rows.length };
}

// ─── Customer messaging history ───────────────────────────────────────────────
export async function listCustomerNotifications(customerId: number, limit: number = 50, offset: number = 0): Promise<{ logs: any[]; total: number }> {
  const countRow: any = await queryOne("SELECT COUNT(*) AS total FROM notification_log WHERE customer_id = $1", [customerId]);
  const logs = await queryAll(
    `SELECT id, event_type, channel, recipient, status, subject, entity_type, entity_id, error_message, sent_at, created_at
     FROM notification_log
     WHERE customer_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [customerId, limit, offset]
  );
  return { logs, total: Number(countRow?.total || 0) };
}

// Exposed for tests + callers that already hold a customer email (e.g. Google
// signup) so a welcome can fire without another lookup.
export async function notifyCustomerWelcomeByEmail(email: string): Promise<void> {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean) return;
  const customer: any = await findCustomerByEmail(clean);
  if (!customer) return;
  await notifyCustomerWelcome({ id: customer.id, name: customer.name, email: customer.email, phone: customer.phone });
}
