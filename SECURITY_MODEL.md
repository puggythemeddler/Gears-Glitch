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
- No account lockout; only a global 20/15min auth rate limit. (P2)

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
- **Why it stays a dual-read, not a migration:** `requireAuth` resolves the `client` role with `WHERE cp_secret = $1 OR cp_secret = $2` (second branch = deterministic cipher of the presented plaintext), so legacy plaintext rows and fresh ciphertext rows coexist with zero schema change and zero data migration. On the tenant side the key authenticates as **tenant admin** (`server/auth.ts` `controlPlaneAuthMiddleware`/`allowControlPlane` sets role `admin`) for plan sync, suspend/resume, invoice view/email/generate/pay, feature overrides, and subscription approve/reject — and outbound headers are always re-derived to plaintext inside the single `cpHeaders()` choke point (`control-plane/server/provision.ts`), so ciphertext is never forwarded.
- **Failure mode is loud, by design:** a `decryptSecret` that cannot decrypt (missing/unstable key, corrupted value) **throws** — never returns ciphertext as "plaintext" — so an outbound header can't be silently garbled. The tenant-side secret-store pattern's silent-fallback is deliberately not repeated here.
- **Recovery consequence (operator guidance):** the effective key must stay stable. Changing key source after writes makes old ciphertext fail loudly; re-enter affected secrets through the UI (SMTP, Cloudinary, users, push-secret) to re-encrypt under the current key. Set `CP_SECRETS_KEY` before deploying this change if you want a dedicated key (otherwise the `JWT_SECRET` fallback applies automatically).
- Smoke-rest: A read of the CP database (dump, replica, SQL-injection read, compromised DB creds) now leaks ciphertext for these six fields. Remaining plaintext at rest is limited to non-secret metadata; `cp_users.password_hash` stays bcrypt(cost 12) — deliberately not encrypted (hash). Tenant `CONTROL_PLANE_SECRET` exists only as a platform env var (never stored in the tenant database).
- Verification: unit suite `control-plane/tests/cp-secrets.test.ts` (13 tests: determinism, dual-lookup equivalence, plaintext passthrough, key-change/corruption throw paths, no-key compat mode) plus DB-gated end-to-end cases in `control-plane/tests/cp-auth-gated.test.ts` (encrypted `cp_secret` row still authenticates, outbound header is original plaintext, encrypted api_key login + requireAuth). Run locally (not DB-gated) and in CI.
- Remaining operator action: set `CP_SECRETS_KEY` (≥16 chars) on the CP Render service — see `ACTION_ITEMS.md`.

---

## 6. Payments & webhooks

### M-Pesa
- STK push via `server/mpesa.ts`; order confirmation on payment status query; `FOR UPDATE` + status guard prevents double stock deduction on duplicate callbacks (positive).
- **P0:** `SIM`-prefixed `checkoutRequestId` auto-confirms orders without provider verification — must be gated to non-production.
- **P2:** POS cash orders lack idempotency key → double-submit duplicate orders.
- **P3:** held stock never released if polling is abandoned.

### Webhooks
- WhatsApp webhook: verification (GET) + receiver (POST). `/api/whatsapp/media/:id` is now **authenticated** (guarded by `adminAuthMiddleware` + `requirePermission("whatsapp:view")`, `server/index.ts`) with filename header-injection sanitized — earlier "unauthenticated (P1, PII)" finding is stale since 2026-09-03.
- eTIMS: config present; verification/tenancy/idempotency should be audited before activation.
- No payment webhook for subscriptions (shop-level billing missing, see Subscriptions).

---

## 7. File uploads

- `server/upload.ts`: magic-byte validation (not just extension), server-generated filenames, 5MB cap, `.svg` dropped locally — positive.
- **P1:** `backupImageToDb` path traversal (`server/index.ts:556-579`) — arbitrary local file read via user-controlled image URL.
- **P2:** `/uploads` served unauthenticated, no CSP/nosniff; SVG magic bytes accepted upstream.

---

## 8. Transport / headers / rate limiting

- Tenant server: `helmet`, CORS, CSRF double-submit, 1MB body limit, `apiLimiter` 200/15m + `authLimiter` 20/15m. Positive.
- `trust proxy:1` allows `X-Forwarded-For` spoofing → rate-limit bypass (P2).
- Control plane: **no rate limiting** (P1).

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

---

## 11. Security review checklist (for completion gate)

- [ ] P0: control-plane role separation (`requireAdmin` on all global/stateful routes) — **approval gate**
- [ ] P0: shared API key no longer maps to admin; per-user scoped keys
- [ ] P0: M-Pesa simulation gated to non-production
- [ ] P0: `pg_dump` shell-interpolation command injection removed
- [ ] P0: irreversible client delete guarded
- [ ] P1: WhatsApp media endpoint authenticated
- [ ] P1: `backupImageToDb` path traversal fixed
- [ ] P1: CP rate limiting + SSL CA verify + stable JWT_SECRET
- [ ] P1: reset/magic tokens made single-use
- [ ] P1: redact M-Pesa config
- [ ] P2: `trust proxy` scoped; open-redirect fixed; JWT(s) out of URLs
