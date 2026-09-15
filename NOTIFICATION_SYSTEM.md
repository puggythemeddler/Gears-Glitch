# Notification System

Centralized admin notification dispatcher for Gears&Glitch. Routes business events to
email + WhatsApp with per-event preferences, a persistent log, and idempotency guards.

## Architecture

- `server/notification-service.ts` — the dispatcher (`dispatchNotification`) and helpers
  (`getNotificationPreferences`, `updateNotificationPreferences`, `listNotificationLog`).
- `server/email.ts` — `sendEmail` backend plus the notification email builders.
- `server/whatsapp.ts` — `sendWhatsAppMessage` backend.
- `notification_log` table — persisted attempt log (created at boot in `server/db.ts`,
  same pattern as `email_logs`).

`notify(ctx)` is fire-and-forget: every call site wraps it in `try/catch`, so a failed
notification can never fail the business transaction that raised it.

## Event types

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

## Preferences

Per-event toggles default to enabled for email and mostly enabled for WhatsApp. The
defaults live in `DEFAULT_PREFERENCES`. Stored as JSON under the settings key
`notification_preferences`. Updates merge — they never drop keys.

## Recipients

- Email: `settings.emailSender || settings.email` (blocked when
  `emailNotificationsEnabled === false`).
- WhatsApp: `settings.adminWhatsAppPhone || settings.phone` (blocked unless
  `whatsappEnabled && adminWhatsAppEnabled`).

## Idempotency

- In-memory cache keyed `entityType:entityId:event` (TTL 5 min). A second dispatch of the
  same event for the same entity in that window is skipped.
- WhatsApp inbound webhooks additionally dedup by Meta message id (`processedMessageIds`,
  TTL 5 min) — Meta redelivers until a 200.

## Admin API

- `GET /api/admin/notifications/preferences` (`settings:view`)
- `PUT /api/admin/notifications/preferences` (`settings:update`)
- `GET /api/admin/notifications/log?limit&offset&event` (`settings:view`)
- `GET /api/admin/notifications/events` (`settings:view`) — list of event names

## Admin UI

Admin → Settings → Notifications: per-event Email/WhatsApp toggles, Save, Notification Log
viewer, and a Send Test Notification button.

## Notes

- Recipients are currently resolved from store settings only. Expanding to staff users
  with Owner/Admin roles is the documented follow-up (Part 4 of the notification spec).
- WhatsApp template fallback outside the 24-hour customer window requires the
  `general_notification` template; if missing the send fails with a clear logged error
  instead of silently attempting a bad send.