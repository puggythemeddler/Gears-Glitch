# Notification System

Centralized notification dispatcher for Gears&Glitch. Routes business events to email +
WhatsApp with per-event preferences, per-customer opt-outs, a persistent log, deterministic
idempotency, and personalized customer lifecycle messaging.

## Architecture

- `server/notification-service.ts` — the dispatcher (`dispatchNotification`) and helpers
  (`getNotificationPreferences`, `updateNotificationPreferences`, `listNotificationLog`,
  `getCustomerCommPrefs`, `updateCustomerCommPrefs`).
- `server/customer-notifications.ts` — business-event → customer-message orchestration: welcome,
  order-processed, repair/warranty updates, the warranty reminder sweep, and the customer
  timeline (`listCustomerNotifications`). Builds personalized content and pulls device/warranty
  details from authoritative records.
- `server/email.ts` — `sendEmail` backend plus the notification email builders.
- `server/whatsapp.ts` — `sendWhatsAppMessage` backend.
- `notification_log` table — persisted attempt log (created at boot in `server/db.ts`, same
  pattern as `email_logs`). Stores `subject`, `customer_id`, `idempotency_key`, and `sent_at`
  in addition to the original columns.

`notify(ctx)` is fire-and-forget: every call site wraps it in `try/catch`, so a failed
notification can never fail the business transaction that raised it.

## Audiences

- **`admin`** (default) — store staff recipients resolved from store settings.
- **`customer`** — the customer who owns the order/repair/claim. Recipients come from the
  record's email/phone (`recipientEmail`/`recipientPhone`) and are filtered by the customer's
  communication preferences (`customers.comm_prefs`, default opt-in). A channel the customer
  has opted out of is recorded as `skipped`, not sent.

## Event types

### Admin events

| Event | Dispatched from |
|---|---|
| `order.created` / `order.paid` / `order.status_changed` | order pipeline |
| `payment.completed` / `payment.failed` | M-Pesa / payment pipeline |
| `customer.created` / `customer.login` | customer events |
| `repair.created` | `POST /api/repairs` |
| `repair.ready` / `repair.completed` / `repair.cancelled` / `repair.status_changed` | `PATCH /api/repairs/:id` (only on an actual status transition) |
| `repair.quote_sent` | `POST /api/repairs/:id/send-quote` |
| `repair.quote_approved` / `repair.quote_declined` | `POST /api/repairs/:id/quote-response` |
| `warranty.created` | `POST /api/warranty/` |
| `warranty.approved` / `rejected` / `resolved` / `status_changed` | `PUT /api/warranty/:id/status` (only on actual transition) |
| `invoice.created` | `POST /api/admin/invoices/generate` |
| `invoice.paid` | `POST /api/admin/invoices/:id/pay` |
| `invoice.overdue` | `POST /api/admin/invoices/mark-overdue` (per overdue invoice) |
| `subscription.changed` | `PUT /api/shop/subscription` |
| `subscription.expiring` / `subscription.expired` | reserved (cron hook-up) |

### Customer lifecycle events

| Event | Dispatched from | Notes |
|---|---|---|
| `customer.created` (welcome) | register, Google signup, admin-create customer | personalized greeting; email + WhatsApp independently resolved, WhatsApp-only possible; both channels missing → a `skipped` row is logged with the reason |
| `order.processed` | M-Pesa callback, POS (SIM/poll/pay-cash) | fires only after **verified payment** (status `paid`/`delivered` or an M-Pesa receipt on file); all devices consolidated into one message. Provider/admin status routes do NOT fire it — those customers get the status email directly, so a `confirmed`/`shipped` order that was never paid never triggers a "processed" appreciation |
| `repair.customer_update` | `POST /api/repairs`, repair status change | device/serial + status, personalized |
| `warranty.customer_update` | `POST /api/warranty/`, `PUT /api/warranty/:id/status` | claim status + device/serial |
| `warranty.expiry_reminder` | warranty sweep (boot + every 6h) | opt-in reminder before expiry |
| `warranty.expired` | warranty sweep | optional; default WhatsApp off |

## Preferences

Per-event toggles default to enabled for email and mostly enabled for WhatsApp. The defaults
live in `DEFAULT_PREFERENCES`. Stored as JSON under the settings key `notification_preferences`.
Updates merge — they never drop keys.

Customer lifecycle defaults:

| Event | Email | WhatsApp |
|---|---|---|
| `order.processed` | on | on |
| `warranty.expiry_reminder` | on | on |
| `warranty.expired` | on | off |
| `repair.customer_update` | on | off |
| `warranty.customer_update` | on | off |

Per-customer opt-outs (`email` / `whatsapp`) live on `customers.comm_prefs` and are managed from
the customer dashboard. Both default to **opt-in**; only an explicit `false` suppresses a channel.

## Recipients

- Admin email: `settings.emailSender || settings.email` (blocked when
  `emailNotificationsEnabled === false`).
- Admin WhatsApp: `settings.adminWhatsAppPhone || settings.phone` (blocked unless
  `whatsappEnabled && adminWhatsAppEnabled`).
- Customer: the record's email/phone, subject to `customers.comm_prefs`.

## Personalization

- Greeting uses the customer's name — never a generic "Dear Customer".
- Device block: product name + serial number, plus warranty status / start / expiry when known.
  Unknown details are omitted, never invented.
- Orders consolidate every device into a single notification.
- Warranty expiry is taken from the authoritative record (order-item expiry → serial expiry →
  duration), not recomputed from a guess.

## Idempotency

- Deterministic keys (no timestamps), e.g. `order.processed:order:<id>`,
  `repair.customer_update:repair:<ticketId>:<status>`,
  `warranty.customer_update:warranty:<claimId>:<status>`,
  `warranty.expiry_reminder:order_item:<itemId>:<expiry>`,
  `customer.created:customer:<id>`.
- Durable per-channel guard: the per-channel send history (`notification_log` rows for the same
  `idempotency_key`) is checked FIRST; a channel already `sent` is skipped. A full skip happens
  only when **both** channels were already sent. Channels that previously failed are retried, so
  a transient failure never permanently suppresses a notification.
- In-memory cache (keyed `entityType:entityId:event`, TTL 5 min) remains as a fast path.
- WhatsApp inbound webhooks additionally dedup by Meta message id (`processedMessageIds`,
  TTL 5 min) — Meta redelivers until a 200.

## Warranty reminder sweep

`runWarrantyNotificationSweep()` runs on boot and every 6 hours. The reminder window
(default **30** days; 7/14/30/60 or a custom value) is stored under the settings key
`warranty_reminder_days` and clamped to 1–365. The sweep skips cancelled orders, already-expired
warranties, invalid dates, and warranties already reminded.

To stay safe across multiple app instances, the sweep first takes a Postgres session advisory
lock (`pg_try_advisory_lock(72748721)` on a dedicated client). If another instance already holds
it, this instance skips the run entirely; the lock is released in `finally`. This complements
the per-order `already_reminded` guard so at most one instance sends any given reminder.

## Admin API

- `GET /api/admin/notifications/preferences` (`settings:view`)
- `PUT /api/admin/notifications/preferences` (`settings:update`)
- `GET /api/admin/notifications/log?limit&offset&event` (`settings:view`)
- `GET /api/admin/notifications/events` (`settings:view`) — list of event names
- `GET /api/admin/notifications/warranty-reminder` (`settings:view`)
- `PUT /api/admin/notifications/warranty-reminder` (`settings:update`)
- `POST /api/admin/notifications/test-customer` — sends a test email + WhatsApp through the
  customer channel, prefixed `[TEST]`

## Customer API

- `GET /api/customer/preferences` — the signed-in customer's email/WhatsApp opt-ins
- `PUT /api/customer/preferences` — update them
- `GET /api/customer/notifications` — the customer's notification timeline (scoped by
  `customer_id`)

## Admin UI

- Admin → Settings → Notifications: per-event Email/WhatsApp toggles, Save, the reminder-days
  control, Send Test Notification, Send Customer Test, and the Notification Log viewer.
- Customer dashboard → Notifications: email/WhatsApp opt-out toggles and a recent-notifications
  timeline.

## Notes

- Notification isolation is DB scoping + `customer_id` ownership filters (this codebase is
  single-tenant per database; there is no `tenant_id` column).
- Recipients for admin events are resolved from store settings only (a single admin address).
  Expanding to staff users with Owner/Admin roles remains the documented follow-up — this was
  deliberately kept to avoid silently adding recipients an owner never configured.
- WhatsApp template fallback outside the 24-hour customer window requires the
  `general_notification` template; if missing the send fails with a clear logged error instead
  of silently attempting a bad send.
- WhatsApp sends persist the provider's message id (`waMessageId`) to `notification_log.provider_message_id`
  so failures can be traced in Meta. The email backend returns a boolean only, so email rows keep
  `provider_message_id` null.
- The customer dashboard timeline and the admin log both render failure reasons (`error_message`)
  so a failed/skipped delivery is visible, not silent; the admin log also shows the provider message id.
