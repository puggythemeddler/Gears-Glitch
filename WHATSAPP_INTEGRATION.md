# WhatsApp Integration

Configuration and security model for the WhatsApp Business (Graph API) integration,
including the inbound webhook and outbound admin notifications.

## Configuration (Admin → Settings → WhatsApp)

| Setting | Env fallback | Purpose |
|---|---|---|
| Enabled | — | Master switch for outbound messaging + webhook |
| Phone Number ID | `WHATSAPP_PHONE_NUMBER_ID` | Meta phone number entity |
| Access Token | `WHATSAPP_ACCESS_TOKEN` | Graph API bearer token (never returned to the browser) |
| App Secret | `WHATSAPP_APP_SECRET` | Used to verify `x-hub-signature-256` on webhooks |
| Verify Token | `WHATSAPP_VERIFY_TOKEN` | Webhook challenge (GET) handshake |
| Business Account ID | `WHATSAPP_BUSINESS_ACCOUNT_ID` | WABA identifier |
| **Graph API Version** | `WHATSAPP_API_VERSION` (default `v21.0`) | Version segment in all Graph URLs |
| Admin WhatsApp Notifications | `ADMIN_WHATSAPP_PHONE` | Enables admin alert messages to the admin phone |

The API version is configurable so the app can pin a supported version instead of
hard-coding one.

## Webhook

- Endpoint: `GET/POST /api/webhooks/whatsapp`
- Inbound verification handshake is the standard Meta challenge (`hub.challenge`).
- **POSTs require a valid `x-hub-signature-256`.** The signature is HMAC-SHA256 of the
  raw request body using the App Secret. A missing, malformed or invalid signature is
  rejected with `403`. The raw body is captured by the express `express.json({ verify })`
  hook into `req.rawBody`; if it is unavailable the request is rejected (re-serializing
  `req.body` can never match the signature).
- **Response codes:**
  - `200` — every event was processed, or was already processed (idempotent duplicate).
  - `500` — one or more events failed to process. Meta redelivers; already-processed
    events are skipped, so only the failures re-run.
  - `503` — one or more events are **already in progress** in another delivery. This is
    deliberately *not* acked: if the original worker then dies, the retry is the only
    thing that recovers the event.
  - `403` — missing/invalid signature.
  - Unsupported but valid payload objects (e.g. a different `object`) are acked `200`
    with nothing to do.

### Idempotency (atomic claim + lease)

Meta redelivers webhook payloads until it gets a `200`, so one inbound message can
arrive many times (including concurrently). Each inbound **message** (`message:<id>`)
and each **delivery status** (`status:<id>:<state>`) is claimed in the durable
`webhook_events` ledger via `claimWebhookEvent` (migration 0018 columns + lease
columns from migration **0030**):

- Ownership is granted by a single atomic statement — `INSERT ... ON CONFLICT ... DO
  NOTHING ... RETURNING` for a new event, otherwise `UPDATE ... WHERE status <>
  'processed' AND (lease_expires_at IS NULL OR lease_expires_at < NOW()) ... RETURNING`.
  Postgres serializes the row, so exactly one concurrent caller wins `process`; the
  rest get `in_progress`. There is no read-then-write window.
- `processed` → skipped on redelivery (`duplicate`).
- `in_progress` → the caller defers (HTTP `503`) so the event is never lost.
- The lease is `WEBHOOK_LEASE_SECONDS` (120s). A crashed worker's event becomes
  reclaimable once the lease lapses — nothing is stuck forever.
- `completeWebhookClaim` / `failWebhookClaim` are fenced by the worker's ownership
  token: if the lease was reclaimed, a stale worker's completion is a no-op (returns
  `false`) and cannot clobber the new owner's state.
- An event is marked `processed` only after the work succeeds.

### Exactly-once limits

Database writes are idempotent (the ledger dedups them), but a handler's *external*
side effects (a Graph API send triggered by an inbound reply) cannot share the DB
transaction. If a worker's lease lapses mid-effect, a reclaiming worker may repeat
that external effect. This window is bounded by the 120s lease and is the reason the
lease is kept well above the observed processing time; true exactly-once delivery to
an external system is not guaranteed by this design.

## Outbound messages

- `sendWhatsAppMessage(to, text, entityType, entityId, entityName)`:
  - If the recipient is within the 24-hour customer window → a plain text message
    (`sendWhatsAppText`).
  - Otherwise → the `general_notification` template. The template must exist in the
    WhatsApp template store (`getWhatsAppTemplateByName`); if missing, the send fails
    with a logged error (no blind send).
  - **Entity preservation:** if the phone already has a `customer` or `provider`
    conversation and the outgoing message would be tagged `staff`, the existing
    customer/provider entity is preserved instead of being clobbered.
- `sendWhatsAppText` does **not** blindly retry on HTTP errors. A lost response after
  Meta accepted the message must never trigger a duplicate delivery.
- Outbound admin alerts created by the notification service use
  `sendWhatsAppMessage(phone, text, "staff", 0, storeName)`.

### Consent / opt-out enforcement (IMPLEMENTED)

Every outbound send is gated by a single server-side policy check,
`isWhatsAppSendingAllowed(phone, category)` (`server/whatsapp-consent.ts`), evaluated
**immediately before** the Meta request. No sender bypasses it:

- `sendWhatsAppMessage`, `sendWhatsAppDocumentMessage` and `sendWhatsAppDocument` all
  call the guard first (before contacting Meta, and before `getSettings()` for the
  document paths).
- The guard reads the durable `whatsapp_consent` table (migration `0031`), so a queued
  or retried message is re-checked at send time and cannot bypass a `STOP` that arrived
  in the meantime.
- **Message categories:** `marketing` requires an explicit `marketing_allowed = TRUE`
  grant (absence of a row is *not* consent); `transactional`/`utility`/`service`/
  `authentication` require `transactional_allowed <> FALSE`.
- **Fail closed:** if consent cannot be determined (lookup error, unknown number) the
  send is denied.

### Inbound opt-out

- Opt-out keywords `STOP`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT` are detected on
  verified inbound text webhooks (`detectOptOutKeyword`) and persisted idempotently by
  `recordOptOut` (upsert on the unique `COALESCE(tenant_id,-1), COALESCE(merchant_id,-1),
  phone_normalized` index — never creates duplicates). An opt-out disables both
  marketing and transactional messaging for the number.
- Ordinary inbound messages never restore consent; only an explicit
  `recordConsentGrant` (trusted caller, e.g. an admin action) clears an opt-out.
- Opt-out persistence happens in the webhook processing path, so a failure is recorded
  against the durable `webhook_events` ledger and Meta redelivers; the opt-out is never
  silently lost.

### Retry safety

- A consent/policy denial is a **permanent** failure. It is surfaced as
  `{ ok: false, blocked: true }` and the outbound queue (`processPendingDelivery`)
  dead-letters it immediately via `failDelivery(..., giveUp = true)` instead of applying
  exponential backoff. Transient transport errors still retry as before.

## Media

- `downloadWhatsAppMedia(mediaId)` fetches media metadata then the blob:
  - 16 MB size cap (protects the database).
  - Filename sanitization: strips CR/LF, control chars, quotes and backslashes,
    collapses dot runs, trims, caps at 128 chars.
- `GET /api/whatsapp/media/:id` requires `adminAuth` + `whatsapp:view` and sanitizes the
  `Content-Disposition` filename too.

## Permissions

- `GET /api/admin/whatsapp/conversations`, `/api/admin/whatsapp/log`,
  `/api/admin/notify/test`, `/api/whatsapp/media/:id` → `whatsapp:view`.