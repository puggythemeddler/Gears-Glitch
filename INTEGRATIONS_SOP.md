# Gears&Glitch — Integrations: Standard Operating Procedures (SOPs)

Covers the four external integrations: Gmail (outbound email), WhatsApp Business
Cloud API, M-Pesa Daraja (Lipa na M-Pesa Online), and Google Sign-In. Each SOP lists
prerequisites, step-by-step setup, how to verify, and how to disconnect/rotate
without losing data. Secrets are never returned by any API — they are stored
encrypted (AES-256-GCM, `enc:v1:` prefix) and only replaced/rotated.

---

## 1. Gmail (outbound transactional email)

### Prerequisites
- A Google Cloud project with the **Gmail API** enabled, OAuth client type **Web
  application**.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the server environment
  (or the Client ID via Store Info settings; the secret must be env only).
- A reachable HTTPS base URL: `BASE_URL` (used to build the OAuth redirect) or an
  explicit `GMAIL_OAUTH_REDIRECT_URI`.
- Strong `JWT_SECRET` (OAuth state is HMAC-signed with it; weak/placeholder values
  are rejected) and `ENCRYPTION_KEY` (refresh token is encrypted at rest).
- The Google account you want to send as must consent to scopes
  `openid email gmail.send` with offline access.

### Authorized redirect URI (must be added to the Google Cloud client)
```
{BASE_URL}/api/integrations/gmail/callback
```
When using `GMAIL_OAUTH_REDIRECT_URI`, that exact URI must be registered in Google
Console instead.

### Connect
1. Sign in to the admin. Go to **Settings → Integrations**.
2. Click **Connect Gmail** → the browser is taken to Google consent.
3. Consent. Google returns to the app; the code is exchanged server-side for a
   refresh token, which is stored in the `integrations` row as an encrypted blob.
4. The page redirects to `/admin?integration=gmail&connected=1`.

### Test
Click **Test connection** on the Integrations page. The server refreshes the token
and returns 200 (no email is sent). A failure updates the card's "last test".

### Routing behavior
Transactional admin email prefers Gmail; on failure it falls back to SMTP
(Email settings), then to logged-only (`no_smtp`). A single transient Gmail retry
is made. `invalid_grant` marks the integration `token_expired` and clears the
cached transporter so a stale token is never reused.

### Disconnect / rotate
1. Click **Disconnect** on the Integrations page (revokes offline access).
2. In Google Account permissions, also remove this app to fully revoke the refresh
   token. Reconnect to rotate.

### Troubleshooting
| Symptom | Fix |
|---|---|
| "Gmail OAuth is not configured" | Set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`BASE_URL` and reload. No env change takes effect until restart. |
| Callback lands on `error=oauth_failed` | Redirect URI mismatch in Google Console; refresh token already used twice/revoked; regenerate and reconnect. |
| Status becomes `token_expired` | Access-token refresh failed (`invalid_grant`). Ask the user to re-consent via Connect. |
| Weak-JWT error on auth-url | Set a real `JWT_SECRET` (>=32 chars), restart. |

---

## 2. WhatsApp Business Cloud API

### Prerequisites
- A Meta developer app with WhatsApp product, a business phone number with display
  name, and a system-user permanent access token.
- Admin access to the WhatsApp settings page (**Settings → WhatsApp**).

### Configure
1. In Cloud API, copy the **Phone number ID**, **Access token**, and the app
   **App secret** (used to verify inbound webhook signatures).
2. In WhatsApp settings: enable WhatsApp, paste Phone number ID, access token,
   app secret, verify token, and choose the API version.
3. **Webhook**: set the callback URL to `{BASE_URL}/api/whatsapp/webhook` and the
   verify token you chose. Meta shows `EVENT_RECEIVED` when verification passes.
4. Optional: enable the admin (staff) WhatsApp channel and set the receiver phone.

### Verify
- Send a test message from **Settings → WhatsApp**.
- Send an interactive button/list message test to confirm template-free sends work
  for the phone channel.

### Disconnect / rotate
- Clear the access token (set the field blank and save — blank keeps the previous
  value hidden; to remove entirely set an empty string and save, or generate a new
  token). In Meta, generate a new system-user token to rotate.

### Troubleshooting
| Symptom | Fix |
|---|---|
| "WhatsApp not configured" on send | Token, phone number ID, or enabled flag missing; verify via Integrations card. |
| Template errors on send | Message not in an approved template or the 24h window has closed for that number. |
| Webhook not verifying | Verify token mismatch, or callback URL not publicly reachable over HTTPS. |

---

## 3. M-Pesa Daraja (Lipa na M-Pesa Online)

### Prerequisites
- Safaricom developer account: consumer key + consumer secret (sandbox and/or
  production), passkey, paybill shortcode (default `174379` in sandbox) and till/
  paybill number used for STK.
- Credentials are entered on **Settings → Payments** (M-Pesa section) or via env
  (`MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`,
  `MPESA_SHORTCODE`, `MPESA_TILL_NUMBER`, `MPESA_ENV`).
- A public HTTPS callback base: `MPESA_CALLBACK_URL` or `BASE_URL` (falls back to
  the request host; trust-proxy aware). The callback endpoint is
  `/api/mpesa/callback`.
- Optional `MPESA_CALLBACK_SECRET`: when set, callbacks must include
  `X-Callback-Secret`; otherwise they are rejected (timing-safe compare).

### Configure
1. Paste consumer key/secret/passkey/shortcode/till into Payments, choose
   `sandbox` or `production`, save. Settings are encrypted at rest
   (`mpesa_config` blob, `enc:v1:`).
2. Register `{MPESA_CALLBACK_URL}/api/mpesa/callback` as the STK callback URL in
   Daraja (this app does NOT dynamically register URLs — register in the Daraja
   portal).
3. Test with a sandbox number; confirm the receipt in the app.

### Payment safety (what the app guarantees)
- Amount is verified against the order before any state change; mismatches leave
  the order pending for manual reconciliation and are logged.
- Callbacks are acknowledged `ResultCode:0` for applied payments; a retryable
  `500` is returned if the DB transition failed so Safaricom re-delivers — a lost
  payment is never silently swallowed.
- Every valid callback is recorded in `webhook_events` (idempotent per
  CheckoutRequestID) and visible via the Integrations card's "last callback".
- Held stock from pending-payment orders auto-releases after 15 minutes.

### Reconcile / rotate
- Rotate by replacing consumer key/secret (leave the existing secret blank to keep
  the current value).
- Disable M-Pesa by clearing credentials; the app then reports "Not configured".

### Troubleshooting
| Symptom | Fix |
|---|---|
| STK not received | Daraja callback URL not registered; wrong environment (sandbox vs prod); wrong shortcode. |
| Callback `401` | `MPESA_CALLBACK_SECRET` set but header missing/mismatch. |
| "Accepted without paid (reconcile manually)" | Amount mismatch; order was not payable. Reconcile manually — payment was NOT swallowed. |
| Config lost after restart | Env config must be set in the host; settings config persists encrypted in DB. |

---

## 4. Google Sign-In

### Prerequisites
- Google Cloud OAuth client (Web application) supporting the store's public sign-in.
- A `google_client_id` (Store Info settings) or `GOOGLE_CLIENT_ID` env.

### Configure
1. In Google Console, add the store origin (`{BASE_URL}`) to **Authorized
   JavaScript origins** and the redirect URIs (`/api/auth/google/callback` for the
   server flow plus any client-side Google One-Tap origins) to **Authorized
   redirect URIs**.
2. Set the Client ID. Restart so env changes take effect.

### Link behavior
- Each Google sign-in (server flow or one-tap) is recorded in `oauth_accounts`
  (`provider='google'`, subject = email) and attached to the matching customer or
  staff record. It never creates privileged accounts — staff still must already
  exist as staff to reach the admin.

### Verify
- **Settings → Integrations** shows Google Sign-In "Configured".
- Sign in on the customer login page and, separately, the staff "Continue with
  Google" flow.

### Troubleshooting
| Symptom | Fix |
|---|---|
| Sign-in shows "not configured" | Client ID missing in settings/env; restart. |
| `error=google_no_staff_account` | The Google email has no staff account — create the user first, then sign in with Google. |

---

## Security notes (all integrations)
- Secrets (refresh tokens, consumer secrets, passkeys, WhatsApp tokens) are
  encrypted with AES-256-GCM before storage and never included in any API response
  or log line.
- `oauth_accounts` rows are read-only views for the UI; linking is server-side only.
- Between-setup compatibility: rotating `ENCRYPTION_KEY` re-keys secrets; encrypt
  failures keep the stored value readable so nothing is lost, and secrets are
  re-encrypted on the next successful write.