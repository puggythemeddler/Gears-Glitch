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
  raw request body using the App Secret. A missing or invalid signature is rejected
  with `403`. The raw body is captured by the express `express.json({ verify })` hook
  into `req.rawBody`.

### Idempotency

Meta redelivers webhook payloads until it gets a `200`. A single inbound message can
therefore arrive multiple times. `handleWhatsAppWebhook` dedups by Meta message id via
an in-memory set with a 5-minute TTL (bounded at 2000 entries), so a message is
processed once per delivery window.

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