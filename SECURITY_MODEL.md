# SECURITY_MODEL.md

**Documented security model for Gears&Glitch** — authentication, authorization, multi-tenancy, control plane, secrets, payments/webhooks, and file uploads. Phase 0 audit snapshot; no implementation.

> **STATUS (updated 2026-09-17, Phases 1–3):** this is a Phase-0 snapshot. Live source of truth: `PRODUCTION_READINESS_AUDIT_FULL.md` (B.3/AZ register). Removed/changed since: query-token auth is opt-in and logged (`server/auth.ts`), sessions/CSRF verified stateless (double-submit cookie + env-required `JWT_SECRET`; AZ3 now PASS), M-Pesa callback optional shared-secret auth. Items below (e.g. `backupImageToDb` path traversal, `trust proxy` scoping) were verified fixed in code; the control-plane items remain subject to the CP's own audit. eTIMS is now DISABLED by design (no open CRITICAL code path) — see Phase 5 in the live report. eTIMS mode is forced to `off`; no invoice/credit note is submitted to KRA.

---

## 1. Deployment topology

- **Per-tenant isolation is architectural:** each client = own Neon PostgreSQL DB + Render backend + Vercel frontend. The tenant `server` is single-tenant-per-DB, so there is no `tenant_id` column on its tables (correct for this model).
- **The multi-tenant security boundary lives in the control plane.** The control plane orchestrates provisioning, deploys, deletion, plans, features, invoices, and stores each client's `cp_secret`, DB URL, and Cloudinary/SMTP secrets. **This is the highest-value security boundary in the platform.**

> **Tenancy model (T-4):** one database per tenant is the deliberate, hard constraint. Do **not** add row-level tenancy to the tenant server, and do **not** reuse it as a shared backend. The `clients` table's legacy `db_path`/`schema_name` columns on the control plane are unused placeholders and must never be interpreted as support for a shared-schema/shared-database multi-tenant deployment — doing so would collapse all tenant data into one scope.

### Trust model
```
Tenant backend ──cp_secret──▶ Control plane (holds ALL tenants' secrets + can deploy/delete)
     │(x-control-plane-key) 
Customer/staff ◀──JWT── Tenants's own server (isolated DB per tenant)
```

---

## 2. Authentication

| Component | Mechanism | Notes |
|-----------|-----------|-------|
| Staff/admin | JWT (HS256) + bcrypt password hash; optional TOTP 2FA | JWT expiry 24h |
| Customer | JWT | 7d expiry |
| Provider | JWT | 7d expiry |
| Magic link | JWT (purpose tag) | 1h, **replayable** (P1) |
| Password reset | JWT (purpose tag) | 2h, **replayable** (P1) |
| Invoice share | JWT (purpose="invoice") | 5m |
| Tenant→CP | `x-control-plane-key` (cp_secret) | yields CP role `client` |
| CP admin | CP JWT / `x-api-key` | global API_KEY → `admin` (P0) |

**Findings:**
- JWTs in localStorage (`customerStoreToken`, `computerStoreToken`, `providerToken`) — XSS ⇒ session theft; no revocation/`jti`; no rotation on password change. (P2)
- Reset/magic tokens reusable within validity window. (P1)
- No account-based lockout; tenant auth endpoints use a default 10/15min per-IP limiter (configurable), and control-plane login uses 20/15min per IP. Limits are process-local. (P2)

---

## 3. Authorization

- Roles: `owner`, `admin`, `technician`, `manager`, `staff`, `customer`, `provider`, plus CP roles (`admin`, `client`, `viewer`, `deploy` etc.).
- `requirePermission` re-reads the permission DB at request time (correct — does not trust the signed JWT). Positive.
- Provider feature gating is server-side via `requireProviderFeature`. Positive.
- **Gaps:**
  - Many admin routes gate on role only, not granular `requirePermission` (P1).
  - Shop/branch feature gating is client-side only (P1).
  - Control-plane `client` role reaches `requireAuth`-only global/stateful routes → **cross-tenant escalation (P0)**.
  - Repair status transitions not validated server-side (P0).

---

## 4. Multi-tenancy hardening (control plane — P0)

`requireAuth` authenticates the `client` role (from a tenant `cp_secret`), but several destructive/global routes are `requireAuth`-only (not `requireAdmin`):

- `GET /api/clients` / `GET /api/clients/:id` — list/read **all** tenants
- `POST /api/clients` — **provision new tenants** (billed infra)
- `PUT /api/clients/:id` — mutate any tenant
- `POST /api/clients/:id/features`, `PUT /api/clients/:id/branches/:branchId/plan`, `POST /api/clients/:id/invoices/generate`, `PUT .../upgrade-requests/:reqId` — modify other tenants
- `GET /api/audit`, `/api/cloudinary`, `/api/smtp` — global/infra secrets
- `POST /api/plans/sync-all`

**Fix (P0):** enforce `requireAdmin` on all cross-tenant/global/stateful routes; give `client` role only its own scoped health/usage endpoints; add per-route role allow-list. Also: never map the shared global `x-api-key`/`CONTROL_PLANE_API_KEY` to `admin` (P0); remove the `?key=` query-string path (P2).

---

## 5. Secrets

- `.gitignore` excludes `.env*` / `.vercel` — **no secrets committed** (verified; `SandboxCertificate.cer` is a public KRA cert).
- Secret handling rules:
  - `/api/settings` redacts Cloudinary/WhatsApp/eTIMS secrets (positive).
  - `/api/mpesa/config` leaks M-Pesa secret/passkey (P1).
  - Control-plane `/api/clients/:id` redacts `cp_secret`, `neon_db_url`, `admin_password` (positive); admin password now `randomPassword(20)` + bcrypt (positive).
  - Control-plane `JWT_SECRET` random-fallback on missing env → session invalidation (P2).
- Secrets-at-rest: M-Pesa creds plaintext in settings/mpesa_config (P2 — encrypt at rest).

### Control-plane secrets at rest (IMPLEMENTED 2026-09-24)
- **Status:** the P1 plaintext-at-rest gap is **fixed** in `control-plane/server/cp-secrets.ts`. The CP now encrypts `clients.cp_secret`, `clients.neon_db_url`, `cp_users.api_key`, `cp_users.totp_secret`, `smtp_config.pass`, and `cloudinary_config.api_secret` as deterministic `enc:v1:` AES-256-GCM ciphertext (keyed via HMAC-SHA256 IV — SIV-style) whenever a key source is configured.
- **Key source (priority):** `CP_SECRETS_KEY` (≥16 chars) → else `JWT_SECRET` (≥16 chars) → else plaintext writes with a loud startup warning (dev only). `describeEncryptionSource()` and the boot log state which source is active (never the key itself).
- **Compatibility and migration:** `requireAuth` resolves the `client` role with `WHERE cp_secret = $1 OR cp_secret = $2` (second branch = deterministic cipher of the presented plaintext), preserving compatibility with any legacy plaintext rows without a schema change. The dedicated `control-plane/scripts/migrate-secrets-at-rest.ts` dry-run/apply script migrates legacy values transactionally; the operator reported its apply completed on 2026-10-25 with 7 secret rows encrypted (counts only). On the tenant side the key authenticates as **tenant admin** (`server/auth.ts` `controlPlaneAuthMiddleware`/`allowControlPlane` sets role `admin`) for plan sync, suspend/resume, invoice view/email/generate/pay, feature overrides, and subscription approve/reject — and outbound headers are always re-derived to plaintext inside the single `cpHeaders()` choke point (`control-plane/server/provision.ts`), so ciphertext is never forwarded.
- **Failure mode is loud, by design:** a `decryptSecret` that cannot decrypt (missing/unstable key, corrupted value) **throws** — never returns ciphertext as "plaintext" — so an outbound header can't be silently garbled. The tenant-side secret-store pattern's silent-fallback is deliberately not repeated here.
- **Recovery and rotation limitation:** the effective key must stay stable. Changing the key source after writes makes old ciphertext fail loudly. The current `enc:v1:` format does not identify a key version, and the migration script migrates plaintext rows but does not re-encrypt ciphertext under a replacement key. Do **not** rotate `CP_SECRETS_KEY` directly. A supported rotation requires a separately tested key-versioned format/keyring and transactional re-encryption that can decrypt with the old key, write with the new key, verify every row, and retain rollback capability before retiring the old key. If a key is lost before that exists, restore the original key; if that is impossible, recover affected credentials individually (including re-enrolling 2FA) rather than treating the ciphertext as recoverable. The Render startup log and operator migration output confirm the dedicated source was active during the reported migration; no key values belong in this document.
- Smoke-rest: A read of the CP database (dump, replica, SQL-injection read, compromised DB creds) now leaks ciphertext for these six fields. Remaining plaintext at rest is limited to non-secret metadata; `cp_users.password_hash` stays bcrypt(cost 12) — deliberately not encrypted (hash). Tenant `CONTROL_PLANE_SECRET` exists only as a platform env var (never stored in the tenant database).
- Verification: unit suite `control-plane/tests/cp-secrets.test.ts` (13 tests: determinism, dual-lookup equivalence, plaintext passthrough, key-change/corruption throw paths, no-key compat mode) plus DB-gated end-to-end cases in `control-plane/tests/cp-auth-gated.test.ts` (encrypted `cp_secret` row still authenticates, outbound header is original plaintext, encrypted api_key login + requireAuth). Run locally (not DB-gated) and in CI.
- Operator status (2026-10-25): Render startup reported `CP_SECRETS_KEY` as the active encryption source, and the operator reported a successful migration of seven secret rows. Keep the active key stable; a versioned key-rotation migration is not yet implemented.

---

## 6. Payments & webhooks

### M-Pesa
- STK push via `server/mpesa.ts`; order confirmation on payment status query; `FOR UPDATE` + status guard prevents double stock deduction on duplicate callbacks (positive).
- **P0:** `SIM`-prefixed `checkoutRequestId` auto-confirms orders without provider verification — must be gated to non-production.
- **P2:** POS cash orders lack idempotency key → double-submit duplicate orders.
- **P3:** held stock never released if polling is abandoned.

### Webhooks
- WhatsApp webhook: verification (GET) + receiver (POST). `POST` requires a valid `x-hub-signature-256` HMAC-SHA256 over the raw body (403 otherwise), and each message/status is deduplicated by an atomic claim + lease in `webhook_events` (migration 0030) with token fencing — replacing an earlier in-memory, then read-then-write, guard. In-progress duplicates return `503` (retryable) rather than a false `200`.
- WhatsApp outbound consent (IMPLEMENTED): a single server-side gate, `isWhatsAppSendingAllowed` (migrations `0031`/`0032` `whatsapp_consent`), is evaluated immediately before every Meta send. Structurally there is exactly one outbound `/messages` request (`postMetaMessage` in `server/whatsapp.ts`); every sender (`text`, `template`, `interactive buttons`, `list`, document/template-fallback) routes through it and the document fallback is re-checked after the media upload. `postMetaMessage` also enforces Meta's messaging-window/template rules: free-form text/media/interactive messages are only permitted inside the 24-hour customer-service window, and outside it only an approved, category-valid template may be used (`whatsapp_templates.is_approved`, migration `0033` — a stored template row does not prove Meta approval). The consent policy is default-DENY: absence of a consent row is not consent; `marketing` needs an explicit `marketing_allowed = TRUE` grant, and `transactional`/`utility`/`service`/`authentication` need an explicit grant, an open 24h customer-service session, or the merchant's own admin number — otherwise denied. It blocks opted-out recipients, fails closed when authorisation is indeterminate, and is re-checked for queued/retried sends. Inbound `STOP`/`UNSUBSCRIBE`/`CANCEL`/`END`/`QUIT` are persisted idempotently from verified webhooks; ordinary inbound messages never restore consent. Consent is scoped to the tenant database (one DB per tenant; `tenant_id`/`merchant_id` reserved and left NULL) and per recipient. Consent/policy/window/template denials are terminal (dead-lettered) and never retried as transient errors. Template approval is gated by role permissions (`whatsapp:manage` to create/delete and send messages, `whatsapp:approve` to approve/unapprove) and the WhatsApp admin endpoints use `staffAuth` + the appropriate permission. `whatsapp_templates.is_approved` is a **local operator decision, not proof of Meta approval**: it defaults to `FALSE` (migration `0033`, `ADD COLUMN IF NOT EXISTS ... NOT NULL DEFAULT FALSE`, so pre-existing rows are never silently trusted after an upgrade), and there is deliberately no template content-edit path — `tests/whatsapp-template-approval-guard.test.ts` is a source-level guard that fails any future `UPDATE whatsapp_templates` that changes a content column without also setting `is_approved = FALSE`, so an edited body can never carry a stale approval into an out-of-window send. `tests/whatsapp-migration-0033-upgrade.integration.test.ts` proves the upgrade path on a reconstructed pre-0033 database.
- `/api/whatsapp/media/:id` is **authenticated** (guarded by `staffAuthMiddleware` + `requirePermission("whatsapp:view")`, `server/index.ts`) with filename header-injection sanitized — earlier "unauthenticated (P1, PII)" finding is stale since 2026-09-03.
- eTIMS: config present; verification/tenancy/idempotency should be audited before activation.
- No payment webhook for subscriptions (shop-level billing missing, see Subscriptions).

---

## 7. File uploads

- `server/upload.ts`: JPEG/PNG/WebP/static-GIF uploads are validated by content and decoded with bounded Sharp limits (default 25MB input, 60MP, 60MB output); SVG and non-image bytes are rejected. Images are encoded as lossless WebP so the stored pixels do not receive another lossy compression pass. ClamAV INSTREAM scanning is supported for original images and product-import CSV files when `CLAMAV_HOST` (and optional `CLAMAV_PORT`, default 3310) is configured. Until an engine is provisioned, scanning is deferred and a warning is logged; non-image files remain rejected and image bytes are decoded and sanitized before storage. Set `UPLOAD_SCAN_REQUIRED=true` to reject uploads/imports when no scanner is available. If a configured scanner is unavailable or flags a file, processing fails. Malware scanning reduces known-malware risk but cannot identify every novel threat or malicious content represented as ordinary pixels. Scanner hosting, signatures, timeout behavior, and production smoke verification remain required before claiming antivirus coverage.
- ~**P1:** `backupImageToDb` path traversal~ **RESOLVED** — local branch path-confinement plus remote-branch SSRF hardening (`server/media-policy.ts`): https-only origin allowlist, DNS private/loopback block, `redirect:"manual"`, 15s timeout, 8MB cap, magic-byte payload check; `tests/media-policy.test.ts`.
- ~**P2:** `/uploads` unauthenticated, no CSP/nosniff; SVG accepted upstream~ **RESOLVED** — nosniff on `/uploads`; SVG disallowed consistently in both storage modes (`tests/upload-policy.test.ts`); control-plane `img-src` narrowed from `https:` to the one origin the dashboard uses (`control-plane/tests/csp.test.ts`).

---

## 8. Transport / headers / rate limiting

- Render provides automatic edge DDoS filtering for hosted web services; Vercel provides automatic DDoS mitigation for deployments. These are platform protections, not a guarantee against targeted application-layer abuse.
- Tenant server: `helmet`, CORS, CSRF double-submit, 1MB JSON body limit, `apiLimiter` 200/15m + `authLimiter` 10/15m (configurable via `AUTH_RATE_MAX`) for password, registration, alternate sign-in, and reset routes. Newsletter and contact submissions have a 6/15m cap; analytics routes have tighter caps. Limits use the default in-memory store, so counts are process-local and reset on restart; use a shared store before scaling to multiple instances.
- Tenant and control-plane apps use `trust proxy:1`. Render documents the forwarded client IP, but the exact proxy/header chain must be verified for the deployed services before treating IP-based limits as spoof-resistant. Do not trust arbitrary forwarded headers without confirming the edge overwrites them.
- Control plane: auth limit 20/15m, destructive-action limit 30/15m, new general API limit 900/15m, heartbeat limit 300/min, and JSON body cap 1MB. These limits also use in-memory stores and are process-local. A shared store and runtime verification remain follow-up work before multi-instance scaling.

---

## 9. Error handling & logging

- Global error handler returns generic message; no stack traces to clients (positive).
- Ad-hoc `e.message` leaks in several handlers (P2); silent `catch{}` in migrations (P2); control-plane audit log is fire-and-forget (P2/P1).

---

## 10. Where security is enforced correctly (keep these)

1. Parameterized SQL everywhere (no injection).
2. `requirePermission` re-reads DB permissions at request time.
3. `requireProviderFeature` server-side provider gating.
4. Generic global error responses.
5. Redaction in `/api/settings` and CP client responses.
6. M-Pesa callback + refund + order-status idempotency via `FOR UPDATE`.
7. Upload magic-byte + server-generated filenames.
8. Per-tenant DB isolation.
9. Destructive integration tests are gated on an explicit, validated `TEST_DATABASE_URL` (`server/test-db.ts`); the runtime `DATABASE_URL` is never used as a fallback and managed/production hosts are rejected, so a misconfigured run skips rather than wiping prod.

---

## 11. Security review checklist (for completion gate)

- [ ] P0: control-plane role separation (`requireAdmin` on all global/stateful routes) — **approval gate**
- [ ] P0: shared API key no longer maps to admin; per-user scoped keys
- [ ] P0: M-Pesa simulation gated to non-production
- [ ] P0: `pg_dump` shell-interpolation command injection removed
- [ ] P0: irreversible client delete guarded
- [x] P1: WhatsApp media endpoint authenticated
- [x] P1: `backupImageToDb` path traversal fixed (local path-confinement + remote SSRF allowlist/DNS block, 2026-09-29)
- [~] P1: CP rate limiting added (process-local; shared-store and proxy-chain verification pending) + SSL CA verify + stable JWT_SECRET
- [ ] P1: reset/magic tokens made single-use
- [ ] P1: redact M-Pesa config
- [ ] P2: `trust proxy` scoped; open-redirect fixed; JWT(s) out of URLs
