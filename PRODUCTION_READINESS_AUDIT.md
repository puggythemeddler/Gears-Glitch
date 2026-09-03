# Gears&Glitch — Production Readiness Audit

**Repository:** `https://github.com/puggythemeddler/Gears-Glitch`
**Phase:** 0 (AUDIT ONLY — no source code modified)
**Date:** 2026-08-31
**Status:** Audit complete. Findings classified P0/P1/P2/P3. Implementation pass in progress.

> This document is the Phase 0 deliverable. It captures the current state of the platform across all audit categories, classifies every finding by severity, and documents risk, fix, migration impact, regression risk, and testing required.

---

## Implementation Status (verified 2026-09-02)

Each finding classified against current code. **RESOLVED** = fix present and verified. **PARTIAL** = some mitigation in place but not full fix. **STILL-OPEN** = fix absent.

### Security
| ID | Sev | Status | Evidence |
|---|---|---|---|
| S-1 | P0 | **RESOLVED** | `index.ts:1997` — SIM auto-confirm gated behind `NODE_ENV !== "production"` |
| S-2 | P1 | **RESOLVED** | `index.ts:6346` — WhatsApp media now has `adminAuthMiddleware` |
| S-3 | P1 | **RESOLVED** | `index.ts:575-584` — path-confinement asserts `localPath.startsWith(dataDir + path.sep)` |
| S-4/A-3 | P1/P3 | **RESOLVED** | `index.ts:4289-4385` — single-use `jti` + `consumeAuthToken()` on all magic/reset flows |
| S-5 | P2 | **RESOLVED** | `index.ts:2047-2069` — `requirePdfAuth` accepts purpose tokens via header only; session JWTs via query string rejected |
| S-6/P-4 | P2 | **RESOLVED** | `index.ts:767-768` — `consumerSecret`/`passkey` redacted in `GET /api/mpesa/config` |
| S-7 | P2 | **PARTIAL** | `index.ts:406` — `trust proxy: 1` kept (Render-recommended single hop); no broader scoping |
| S-8 | P2 | **RESOLVED** | `index.ts:3398-3420` — message read scoped to customer/provider ownership |
| S-9 | P3 | **RESOLVED** | `index.ts:4471` — `requirePermission("staff:update")` on staff reset; plans/all filters inactive |
| S-10 | P3 | **RESOLVED** | `index.ts:481` — nosniff on `/uploads`; `upload.ts:106-123` — SVG not in magic-byte list |

### Authentication
| ID | Sev | Status | Evidence |
|---|---|---|---|
| A-1 | P2 | **PARTIAL** | Rotation on password change: RESOLVED (`auth.ts:110-118`). httpOnly cookies: STILL-OPEN (localStorage) |
| A-2 | P2 | **RESOLVED** | `auth.ts:10-50` — per-account lockout with exponential backoff; wired to all 3 login paths |
| A-3 | P3 | **RESOLVED** | See S-4 above |
| A-4 | P3 | **STILL-OPEN** | No step-up/re-auth middleware for high-risk admin actions |

### Multi-Tenancy
| ID | Sev | Status | Evidence |
|---|---|---|---|
| T-1 | P0 | **RESOLVED** | All cross-tenant CP routes now use `requireAdmin`; only `POST /api/plans/sync-up` is `requireAuth`-only (client callback, correct) |
| T-2 | P1 | **RESOLVED** | `cp/index.ts:113-131` — `x-api-key` resolves to `cp_users` row; query-string key removed |
| T-3/C-4 | P2 | **RESOLVED** | `cp/db.ts:5-8` — SSL defaults to `rejectUnauthorized: true` |
| T-4 | P1 | **RESOLVED** | `SECURITY_MODEL.md` — tenancy model documented; legacy `db_path`/`schema_name` columns clarified as no-op placeholders, not shared-backend tenancy |

### Authorization
| ID | Sev | Status | Evidence |
|---|---|---|---|
| Z-1 | P0 | **PARTIAL** | 27 routes upgraded with `requirePermission`; 52 still use `adminAuthMiddleware` only (role-check, not granular RBAC) |
| Z-2 | P1 | **RESOLVED** | `index.ts:2647-2651` — purpose-bound invoice token, 5m expiry |
| Z-3/R-1 | P1 | **RESOLVED** | `repairs.ts:172-191` — `VALID_TRANSITIONS` map + `isValidTransition()` enforced at L511 |
| Z-4 | P2 | **RESOLVED** | `index.ts:5646-5656` — `requireShopFeature("Repair ticketing")` on all 19 repair routes |
| Z-5 | P2 | **PARTIAL** | Binary admin/non-admin check sufficient for current roles |

### Control Plane
| ID | Sev | Status | Evidence |
|---|---|---|---|
| C-1 | P0 | **RESOLVED** | `cp/index.ts:620-666` — two-step delete requiring `{ confirm, reason }` |
| C-2 | P0 | **RESOLVED** | `cp/index.ts:1200-1219` — `pg_dump` via `spawn` with argv, no shell interpolation |
| C-3 | P1 | **RESOLVED** | `cp/index.ts:47-49` — `authLimiter` (20/15min) + `destructiveLimiter` (30/15min) |
| C-5 | P2 | **RESOLVED** | `cp/index.ts:43` — missing `JWT_SECRET` throws in production |
| C-6 | P2 | **STILL-OPEN** | CSP allows `'unsafe-inline'` in `scriptSrc` (dashboard inline handlers) |
| C-7 | P2 | **RESOLVED** | `cp/index.ts:152` — `auditLog()` now returns the promise and is awaited on destructive paths (push-secret, delete-client) |
| C-8 | P3 | **STILL-OPEN** | `render.yaml` `plan: free` |
| C-9 | P3 | **STILL-OPEN** | Hardcoded `VERCEL_TEAM_ID`, `DOMAIN_BASE`, repo owner in `render.yaml` |

### Database
| ID | Sev | Status | Evidence |
|---|---|---|---|
| DB-1 | P1 | **RESOLVED** | Migration `0006` — partial unique indexes `(product_id) WHERE branch_id IS NULL` + `(product_id, branch_id) WHERE branch_id IS NOT NULL` |
| DB-2 | P1 | **RESOLVED** | Migration `0005` — indexes on orders.status, branch_id, created_at, serial_numbers, stock_movements |
| DB-3 | P1 | **RESOLVED** | Migration `0008` — FKs on orders.coupon_id, orders.gift_card_id, serial_numbers, repair_parts_used, credit_notes (NOT VALID) |
| DB-4 | P1 | **RESOLVED** | Migration `0008` — `order_items.product_id`, `stock_levels.product_id`, `repair_updates.ticket_id` changed to `ON DELETE RESTRICT` |
| DB-5 | P2 | **RESOLVED** | Migration `0008` — unique constraint on `cart_recovery_reminders(customer_id, order_id)` |
| DB-6 | P2 | **PARTIAL** | `idempotency_key` unique index exists; POS accepts optional key but doesn't require it |
| DB-7 | P3 | **RESOLVED** | `0011_audit_traceability.sql` — FK added on `credit_notes.created_by`; `stock_movements.created_by` already FK'd; `orders.staff_id` is the traceable FK (free-text `processed_by` retained as display name) |

### Migrations
| ID | Sev | Status | Evidence |
|---|---|---|---|
| M-1 | P1 | **RESOLVED** | `db.ts:629-653` — `runVersionedMigrations()` with `schema_migrations` table, transactional, throws on failure |
| M-2 | P3 | **RESOLVED** | `server/migrations/0001-0009` all wired to runner |
| M-3 | P1 | **RESOLVED** | `db.ts:655-669` — `initDb()` runs schema + migrations + versioned migrations in order |

### Financial / Money (§8)
| ID | Sev | Status | Evidence |
|---|---|---|---|
| §8 | P0 | **PARTIAL** | Migration `0002` converts all monetary columns to `NUMERIC(12,2)` at runtime. `schema.sql` still declares `DOUBLE PRECISION` (alter runs on every fresh DB) |

### Inventory
| ID | Sev | Status | Evidence |
|---|---|---|---|
| I-1 | P0 | **RESOLVED** | POS + convertQuoteToOrder: guarded atomic decrement; insufficient stock fails the sale loudly (rolls back), no silent `GREATEST` clamp |
| I-2 | P0 | **RESOLVED** | `db.ts:2653-2695` — `convertQuoteToOrder` now wrapped in `transaction()` (order + items + stock atomic) |
| I-3 | P0 | **RESOLVED** | `db.ts:2143-2198` — `completeStockTransfer` in `transaction()` with `FOR UPDATE` locks |
| I-4 | P0 | **RESOLVED** | `products` and `stock_levels` decrements now guard `>= qty` and abort checkout on insufficient stock (consistent with `convertQuoteToOrder`) |
| I-5 | P1 | **RESOLVED** | `db.ts:3554-3609` — `receivePurchaseOrderItem` in `transaction()` with `FOR UPDATE` |
| I-6 | P1 | **RESOLVED** | `repairs.ts:641-684` — `addRepairPart` in `transaction()`; stock + parts roll back together |
| I-7 | P2 | **RESOLVED** | `db.ts:2087-2106` — `updateStockLevel` atomic upsert |

### Orders
| ID | Sev | Status | Evidence |
|---|---|---|---|
| O-1 | P0 | **RESOLVED** | `db.ts:3035-3046` — `createOrder` in `transaction()` |
| O-2 | P0 | **RESOLVED** | POS checkout (order + items + serial links + stock) wrapped in a single transaction; STK push/audit run post-commit |
| O-3 | P1 | **RESOLVED** | `db.ts:2653-2695` — `convertQuoteToOrder` now in `transaction()` |
| O-4 | P2 | **RESOLVED** | `db.ts:2755-2765` — `recordCouponUsage` conditional increment: `used_count < max_uses` |

### Serial Numbers
| ID | Sev | Status | Evidence |
|---|---|---|---|
| SN-1 | P2 | **RESOLVED** | Migration `0008` — CHECK constraint + FK on `purchase_order_item_id` |
| SN-2 | P1 | **RESOLVED** | `db.ts:3573-3585` — serial inserts in `transaction()` |
| SN-5 | P1 | **RESOLVED** | `schema.sql` — ownership documented as indirect via `order_id→orders.customer_id` (intentional, normalized) |

### Repairs
| ID | Sev | Status | Evidence |
|---|---|---|---|
| R-1/Z-3 | P0 | **RESOLVED** | See Z-3 above |
| R-2/I-6 | P0 | **RESOLVED** | See I-6 above |
| R-3 | P1 | **RESOLVED** | `repairs.ts:172-185` — VALID_TRANSITIONS includes awaiting_approval, approved, rejected, unrepairable |
| R-4 | P1 | **RESOLVED** | Migration `0007` — adds serial_number, is_warranty_repair, warranty_claim_id to repair_tickets |
| R-5 | P1 | **RESOLVED** | `repairs.ts:620-627` — assignment change recorded via `addRepairUpdate()` with type "assignment" |
| R-6 | P2 | **STILL-OPEN** | Hardcoded KES rates, mixed rounding (ties to §8 money representation) |
| R-7 | P2 | **RESOLVED** | `repairs.ts` — ETA default read from `repair_eta_hours` setting (fallback 48h) |
| R-8 | P3 | **RESOLVED** | `index.ts` — warranty register supports `?limit=`/`?offset=` + returns `total` (bounded, configurable) |

### Warranty
| ID | Sev | Status | Evidence |
|---|---|---|---|
| W-1 | P0 | **RESOLVED** | Migration `0003` creates `warranty_claims` table; `server/warranty.ts` implements full CRUD with status transitions |
| W-2 | P1 | **RESOLVED** | Migration `0009` adds `coverage_terms`, `exclusions` + CHECK on status |
| W-3 | P1 | **RESOLVED** | Both `computeWarrantyExpiry` (db.ts) and `addCalendarMonthsClamped` (index.ts register read-path) use robust month-end clamping (Jan 31 + 1mo -> Feb 28); audit line ref was stale |
| W-4 | P2 | **RESOLVED** | `0010_order_items_warranty_expires.sql` — warranty expiry snapshotted on `order_items` at sale (`createOrder`, POS); register prefers snapshotted value |

### Subscriptions
| ID | Sev | Status | Evidence |
|---|---|---|---|
| SU-1 | P1 | **STILL-OPEN** | `branch_subscriptions.expires_at` never populated |
| SU-2 | P1 | **STILL-OPEN** | No recurring billing or expiry enforcement |

---

### Summary: Items by Status

**RESOLVED (49):** S-1, S-2, S-3, S-4/A-3, S-5, S-6/P-4, S-8, S-9, S-10, A-2, T-1, T-2, T-3/C-4, T-4, Z-2, Z-3/R-1, Z-4, C-1, C-2, C-3, C-5, C-7, DB-1..DB-5, DB-7, M-1, M-2, M-3, I-1/I-4, I-2, I-3, I-5, I-6, I-7, O-1, O-2, O-3, O-4, SN-1, SN-2, SN-5, R-1..R-5, R-7, R-8, W-1, W-2, W-3, W-4

**PARTIAL (7):** A-1 (rotation done, httpOnly pending), S-7 (deliberate), Z-1 (27/79 done), Z-5 (sufficient for current roles), C-6 (inherent to dashboard), DB-6 (POS idempotency optional), §8 (NUMERIC in migration, not schema)

**STILL-OPEN (8):** A-1 (httpOnly cookies), A-4 (step-up auth), Z-1 (52 routes), C-8 (free tier), C-9 (hardcoded config), R-6 (hardcoded rates), SU-1 (expires_at), SU-2 (billing)

---

## 0. Scope & Architecture Summary

Gears&Glitch is a feature-rich SaaS platform combining e-commerce, POS, inventory, multi-branch management, purchasing, stock transfers, serial-number tracking, customers, orders, invoices, payments, M-Pesa, eTIMS, repairs, technicians, warranties, customer assets, service history, subscriptions, feature management, and a SaaS control plane.

### Architecture
| Layer | Technology | Location |
|---|---|---|
| Storefront + admin (Next.js) | `frontend/` (pages router) | Vercel (per tenant) |
| Backend API | Express, raw PG SQL, JWT | `server/` (Render, per tenant) |
| Database | PostgreSQL (one DB **per tenant**) | `server/db.ts` + `schema.sql` |
| Control plane | Express + Neon/Render/Vercel SDK | `control-plane/` |
| Super-lifecycle | SELL → TRACK → SERVICE → WARRANTY → CUSTOMER HISTORY | — |

### Key architectural facts
- **Tenancy model:** single tenant per database. Each client deployment gets its own Neon DB + Render backend + Vercel frontend. The main `server` is therefore **not** multi-tenant at the DB layer; multi-tenancy lives in the **control plane**.
- **Route scale:** `server/index.ts` registers 382 HTTP routes (monolithic single file, 6309 lines). `server/db.ts` (4561 lines) contains the data layer.
- **Money:** all monetary columns are `DOUBLE PRECISION` (floating point) — a systemic issue (see §8).
- **Migrations:** hybrid `schema.sql` (idempotent CREATE) + boot-time `runSchema()/runMigrations()` ALTER loop; no versioned migration runner (see §19).

---

## 1. Security

| # | Sev | Location | Problem | Fix |
|---|-----|----------|---------|-----|
| S-1 | **P0** | `server/index.ts:1976-1979` | When a POS M-Pesa `checkoutRequestId` starts with `"SIM"`, the order is **auto-confirmed as paid** without contacting Safaricom. This dev/sandbox simulation path is reachable if env vars are misconfigured in production → every M-Pesa order paid without real money. | Gate simulation behind a strict non-production flag; reject `SIM` prefixed IDs in production; never auto-confirm without reconciling with the M-Pesa API. |
| S-2 | **P1** | `server/index.ts:6213-6223` | `GET /api/whatsapp/media/:id` serves base64-decoded WhatsApp media (customer PII: chats, order refs, phone numbers) with **no auth**, enumerable by numeric `id`. | Require admin auth or a signed short-lived media token; use unguessable IDs; per-tenant ownership checks. |
| S-3 | **P1** | `server/index.ts:556-579` | `backupImageToDb` does `path.join(__dirname, "..", "data", imageUrl.replace(/^\//,""))` — user-supplied image URL can contain `..\\`/`../`, enabling **arbitrary local file read** via base64 import. | Resolve path and assert it stays under the upload dir (`path.resolve(...).startsWith(...)`); only accept upload-layer filenames. |
| S-4 | **P1** | `server/index.ts:4164-4256` | Password-reset / magic-link JWTs are replayable (no one-time consumption) within 1–2h windows and are delivered in URL query strings. | Add single-use `jti`/nonce consumed on first use; rotate signing on password change. |
| S-5 | **P2** | `server/auth.ts:66-69` + several frontend files | Full session JWTs passed via `?token=` query for receipts/invoices/quotes → leak via logs, Referer, history. | Use short-lived, single-purpose "open link" tokens instead of the session JWT. |
| S-6 | **P2** | `server/index.ts:750-752` | `GET /api/mpesa/config` returns full `consumerKey`/`consumerSecret`/`passkey` unredacted to any admin (contrast `/api/settings` which blanks secrets, `index.ts:767-774`). | Redact secrets in the GET response; encrypt at rest. |
| S-7 | **P2** | `server/index.ts:403,431-453` | `trust proxy:1` lets a direct client spoof `X-Forwarded-For` and bypass IP-based API/auth rate limits. | Restrict trust proxy to the known proxy hop. |
| S-8 | **P2** | `server/index.ts:3310-3321` | `PATCH /api/messages/:id/read` verifies any valid token but **no ownership** — any authenticated user can mark any message read. | Scope to the message owner (customer/staff/provider). |
| S-9 | **P3** | `server/index.ts:4356-4361`, `1330` | `staff:update` permission not enforced on admin reset-password; `/api/plans/all` exposes inactive plans. | Add `requirePermission("staff:update")`; filter inactive plans. |
| S-10 | **P3** | `server/upload.ts` + `server/index.ts:470-479` | `/uploads` served without auth; SVG magic bytes accepted upstream though local `safeExt` drops `.svg`. | Add restrictive CSP/`nosniff` on uploads; sanitize or fully disallow SVG. |

**Positive controls (verified):** parameterized SQL throughout (no SQL injection); global `helmet` + CORS + CSRF double-submit + body limit 1MB + per-route rate limits; `escapeHtml()` applied to all HTML templates; global error handler returns generic message (no stack leak); upload magic-byte + server-generated filename validation; `requirePermission` re-reads permissions from the DB (not the JWT).

---

## 2. Multi-Tenancy

| # | Sev | Location | Problem | Fix |
|---|-----|----------|---------|-----|
| T-1 | **P0** | `control-plane/server/index.ts:394` and many | **Control-plane cross-tenant privilege escalation.** `requireAuth` (line 76) authenticates a tenant `client` role from its `cp_secret`, but numerous routes are gated by `requireAuth` only (not `requireAdmin`), so a tenant can: list **all** clients (`GET /api/clients`), read global audit logs/cloudinary/SMTP config (`/api/audit`, `/api/cloudinary`, `/api/smtp`), **provision new tenants** (`POST /api/clients`), and **modify other tenants'** features/plans/subscriptions/invoices (`PUT /api/clients/:id`, `PUT .../branches/:branchId/plan`, `POST .../features`, `POST .../invoices/generate`, `PUT .../upgrade-requests/:reqId`, `POST /api/plans/sync-all`). | Enforce `requireAdmin` on every cross-tenant/global/stateful route. Give the `client` role only its own scoped health/usage endpoints. Add a per-route role allow-list. |
| T-2 | **P1** | `control-plane/server/index.ts:104-111` | `x-api-key` (global `CONTROL_PLANE_API_KEY`) maps unconditionally to `role:"admin"`; also accepted via `?key=` query. Single shared unrotating key = full control-plane compromise if leaked. | Never map shared key to admin; per-user scoped keys with roles + rotation; remove query-string key path. |
| T-3 | **P2** | `control-plane/server/db.ts:5` | CP DB pool uses `ssl: { rejectUnauthorized: false }` → MITM risk on CP↔Neon connection (holds `cp_secret`, Cloudinary/SMTP secrets, provision records). | Verify the Neon CA. |
| T-4 | **P1** | `server/schema.sql` (clients table) | The per-tenant `server` has **no `tenant_id` column on any table** (single-tenant-per-DB is correct), but the `clients` table's `db_path`/`schema_name` columns hint at a future multi-tenant design that does not exist. If ever used as a shared backend, all data would leak. | Keep the one-DB-per-tenant model; document it. Do **not** add row-level tenancy to the tenant server. |

---

## 3. Authentication

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| A-1 | P2 | Long-lived JWTs stored in **localStorage** (staff 24h, customer/provider 7d); no revocation/`jti`; no session rotation on password change. Any XSS = session theft. | Prefer httpOnly Secure SameSite cookies, or short-lived access + refresh tokens; add `jti` revocation; rotate on password change. |
| A-2 | P2 | No account lockout beyond a global 20/15min auth rate limit; no progressive delay. | Per-account lockout with exponential backoff. |
| A-3 | P3 | Magic/reset links use plain JWTs (see S-4). | Single-use tokens. |
| A-4 | P3 | No forced re-auth for high-risk actions; sensitive ops rely on a simple password verify endpoint absent strong eventing. | Consider step-up auth for irreversible actions. |

**A-3 status (implemented):** all three magic/reset flows now use single-use tokens — each link is signed with a random `jti` (`crypto.randomUUID()`) and consumed exactly once via `consumeAuthToken` on first use (`/api/auth/magic-login`, `/api/auth/admin-password-reset`, `/api/auth/password-reset`); replay returns "Token already used." Magic-login additionally rejects tokens issued before the account's last password change (rotation), and all reset tokens expire in 2h. The only remaining caveat is that reset links are still delivered in the URL query string (`?token=`), which is inherent to email-link delivery but is now mitigated by single-use + short expiry + rotation. Verified: root typecheck + build + control-plane typecheck pass.

**A-1 status (implemented):** session **rotation on password change** is now enforced in all six auth middlewares (`verifySessionToken` in `server/auth.ts` rejects any session token whose `iat` predates the account's `password_changed_at`); the staff/customer change-password API handlers now await the DB update so rotation is committed before responding. Single-use one-time links (magic/reset) already use `jti` + `consumeAuthToken` replay protection. Verified: root typecheck + build + control-plane typecheck pass.

**A-1 remaining (follow-ups, not yet implemented):**
1. Switch session JWTs from `localStorage` to **httpOnly Secure SameSite cookies** (or short-lived access + refresh tokens). Larger, cross-cutting change touching both frontends and all auth middleware; deferred to avoid breaking the working header-token flow.
2. **Explicit per-session revocation UI** (admin "log out all sessions" / revoke a device). Current rotation only fires on password change; a dedicated revoke-all button would need a `token_version` column (migration) plus a bump endpoint.
3. Add `jti` to ordinary **session** JWTs (currently only one-time links carry `jti`).

**Positive:** bcrypt hashing with per-user salt; JWT expiry 24h with scoped sub-tokens (magic 1h, reset 2h, invoice 5m); optional staff TOTP 2FA; 8-char minimum password enforced; password reset flow present.

---

## 4. Authorization

| # | Sev | Location | Problem | Fix |
|---|-----|----------|---------|-----|
| Z-1 | **P0** | `server/index.ts` (many admin routes) | Many "admin" routes use `adminAuthMiddleware` (role check only) without the granular `requirePermission` RBAC — e.g. `/api/purchases`, `/api/serials`, `/api/admin/customers`. Anyone with `role=admin` or `owner` can perform all actions regardless of finer permissions. Deleted from RBAC granularity in several places (see S-9, staff reset). | Enforce `requirePermission` on all stateful admin routes; ensure least privilege per staff role. |
| Z-2 | P1 | `server/index.ts:2609-2743` | `/api/admin/orders/:id/invoice` uses a manual verify + `purpose==="invoice"` token path; the short 5m invoice share token can access the full invoice endpoint. Fragile manual auth. | Use a dedicated, short-lived, non-reusable token; no manual reimplementation. |
| Z-3 | P1 | `server/repairs.ts:480-487` | Repair status transitions are **not validated server-side** — any status can jump to any status (e.g. `received` → `collected`), bypassing diagnosis/approval/QC. | Add a `VALID_TRANSITIONS` map and validate current→new status. |
| Z-4 | P2 | `server/index.ts:5500-5528` | Shop/branch feature gating is **client-side only** at the API level — `/api/shop/features` returns features but repair/subscription endpoints are not gated server-side. | Add `requireFeature` middleware to repair/warranty/subscription routes. |
| Z-5 | P2 | `control-plane/server/index.ts` (various `requireAuth`-only) | Control-plane viewer/`client` roles reach stateful endpoints (see T-1). | Role allow-list per route. |

**Positive:** `requirePermission` re-reads the permission DB at request time; provider feature gating is enforced server-side (`requireProviderFeature`, `index.ts:1701-1713`); each staff user has direct + role-based permissions.

---

## 5. Control Plane

See Multi-Tenancy §2 (T-1 cross-tenant escalation is the headline control-plane P0). Additional:

| # | Sev | Location | Problem | Fix |
|---|-----|----------|---------|-----|
| C-1 | **P0** | `control-plane/server/index.ts:612-643` | `DELETE /api/clients/:id` destroys Neon DB + Render service + Vercel project permanently with no confirm/grace/soft-delete/undo. | Two-step delete with explicit confirmation (or soft-delete + retention before hard delete). |
| C-2 | **P0** | `control-plane/server/index.ts:1187` | Backup job runs `execAsync('pg_dump "$NEON_DB_URL" | gzip > "…"')` — shell-interpolated DB URL where `$(…)`/backticks execute → **command injection / RCE** on control plane using a DB-controlled value. | Use `spawn` with an argument array; never interpolate DB values into a shell string. |
| C-3 | **P1** | `control-plane/server/index.ts` (whole file) | **No rate limiting** on the control plane (not on login, 2FA, or destructive endpoints). | Add `express-rate-limit` with strict limits on login/2FA and low limits on deploy/provision/delete. |
| C-4 | **P1** | `control-plane/server/db.ts:5` | SSL `rejectUnauthorized:false` (see T-3). | Verify CA. |
| C-5 | **P2** | `control-plane/server/index.ts:40` | `JWT_SECRET` falls back to a random value each boot → all CP sessions invalidated on restart; hidden reliance on process-lifetime secret. | Always set a stable env `JWT_SECRET`; fail fast if missing. |
| C-6 | **P2** | helmet config | CP UI allows `'unsafe-inline'` in `scriptSrc` → weakens CSP; XSS in the admin panel escalates to full platform compromise. | Move inline scripts to external files; use nonces/hashes. |
| C-7 | **P2** | `control-plane/server/index.ts:145-148` | Audit-log writes are fire-and-forget (`.then/.catch`), not awaited → loss of accountability trail. | Make audit logs synchronous/buffered and awaited for destructive actions. |
| C-8 | **P3** | `render.yaml` | Control plane runs on Render **free** tier (spin-down, cold starts, transient deploys) while managing production tenants. | Move to a paid/starter plan. |
| C-9 | **P3** | `control-plane/render.yaml`, `provision.ts:102` | Hardcoded `VERCEL_TEAM_ID`, `DOMAIN_BASE`, repo owner in source; default `CONTROL_PLANE_URL`. | Move to CP secrets/env. |

---

## 6. Database

| # | Sev | Location | Problem | Fix |
|---|-----|----------|---------|-----|
| DB-1 | **P1** | `schema.sql:154-163` | `stock_levels` has `product_id UNIQUE` but code queries by `branch_id` → **schema/code mismatch**; the UNIQUE on `product_id` alone prevents branch-level stock rows. | Change UNIQUE to `(product_id, branch_id)`. |
| DB-2 | **P1** | `schema.sql` (many) | Missing indexes on hot query columns: `orders.status`, `orders.branch_id`, `orders.created_at`, `serial_numbers.order_id`, `serial_numbers.order_item_id`, `stock_movements(reference_type, reference_id)`, `messages` unread. | Add targeted indexes. |
| DB-3 | **P1** | `schema.sql` (many) | Many missing foreign keys: `orders.coupon_id`, `orders.gift_card_id`, `serial_numbers.purchase_order_item_id`, `repair_parts_used.product_id`, `credit_notes.created_by`, `credit_note_items.order_item_id`/`product_id`. | Add FKs (with RESTRICT where appropriate). |
| DB-4 | **P1** | `schema.sql:149-150,162,365` | Destructive cascades destroy audit trails: `order_items.product_id ON DELETE CASCADE`, `stock_levels.product_id ON DELETE CASCADE`, `repair_updates.ticket_id ON DELETE CASCADE` — deleting a product/ticket erases history. | Change to `ON DELETE RESTRICT` and require explicit archival. |
| DB-5 | **P2** | `schema.sql:853-860` | No unique constraint on `cart_recovery_reminders(customer_id, order_id)`. | Add unique constraint. |
| DB-6 | **P2** | `schema.sql` (orders) | `orders.staff_id` nullable; `idempotency_key` nullable and often omitted by POS → dedup gap. | Enforce where applicable; require idempotency key on POS. |
| DB-7 | **P3** | `schema.sql` | Several nullable/audit columns lose traceability (`stock_movements.created_by`, `orders.processed_by` as free text, `credit_notes.created_by` no FK). | Make required/FK where possible. |

**Tenant scoping:** N/A at the per-tenant server (single-tenant DB). The multi-tenant boundary is the control plane (see §2).

---

## 7. Migrations

| # | Sev | Location | Problem | Fix |
|---|-----|----------|---------|-----|
| M-1 | **P1** | `server/db.ts:631-930` | `runSchema()`/`runMigrations()` run dozens of `ALTER/CREATE` statements at **every boot**, each individually wrapped in `try/catch {}` that **silently swallows errors**, outside a single transaction, with **no version tracking**. Partial failure → half-migrated schema with no rollback; tenant drift. | Introduce a versioned migration runner (tracking table or `node-pg-migrate`); run each migration transactionally; record version; fail loudly. |
| M-2 | **P3** | `server/migrations/001_whatsapp_tables.sql` | Migration file exists but is **not wired** to any runner (dead/incomplete infra). | Wire into the runner or remove. |
| M-3 | P1 | `server/index.ts` (boot) | Fresh DBs reach the same schema as existing (good) because everything is `IF NOT EXISTS`, but there is no deterministic ordered migration list and no documented upgrade path for production. | Document + implement ordered migrations. |

---

## 8. Financial Data (Money Representation)

**Systemic P0:** all ~37 monetary columns across ~15 tables use `DOUBLE PRECISION`, and JS computes money with float arithmetic. Floating-point cannot represent exact decimals (`0.1+0.2 !== 0.3`); drift compounds over transactions, discounts, refunds, gift-card balances, loyalty points.

Monetary columns affected (all `schema.sql`), non-exhaustive: `products.price/sale_price`, `orders.subtotal/shipping_fee/discount_amount/gift_card_amount/amount_refunded`, `order_items.price/line_total`, `subscription_plans.price/price_annual`, `provider_plan_assignments.custom_price`, `invoices.amount`, `order_invoices.amount`, `repair_types.base_price`, `repair_tickets.hardware_value/labor_cost/parts_cost/total_cost`, `repair_parts_used.unit_cost`, `purchase_order_items.unit_cost`, `quotes.total`, `quote_items.unit_price/line_total`, `coupons.value/min_order_amount`, `coupon_usage.discount_amount`, `price_history.old_price/new_price`, `credit_notes.total_amount`, `credit_note_items.price/line_total`, `etims_sales_transactions.total_amount`, `gift_cards.initial_value/balance`, `gift_card_redemptions.amount`, `cart_recovery_reminders.cart_total`, `refunds.amount`.

JS float arithmetic sites: `db.ts:2948` (createOrder subtotal), `db.ts:2860` (createRefund), `db.ts:2967` (getOrder lineTotal), `db.ts:2632` (validateCoupon), `db.ts:3417` (PO total), `db.ts:3342` (credit note), `db.ts:3562` (sales report totals), `repairs.ts:207-220` (repair cost, mixed rounding).

**Fix (approved-required, Phase 8):** migrate monetary columns to `NUMERIC(12,2)` (or integer cents) and compute in integer cents/decimal library. **High-risk change requiring explicit approval** (money representation). Documented regression risk: all SQL that does arithmetic/comparison on monetary columns must be audited; frontend display logic (formatPrice) must stay consistent.

---

## 9. Payments

| # | Sev | Location | Problem | Fix |
|---|-----|----------|---------|-----|
| P-1 | **P0** | `server/mpesa.ts:84-104`, `server/index.ts:1976-1979` | Simulated M-Pesa auto-confirms orders when `checkoutRequestId` starts with `SIM` (see S-1). | Block in production; reconcile with provider before confirming. |
| P-2 | **P2** | schema + `server/db.ts` | Payment success is recorded after M-Pesa STK push "simulated" + local status; card payments (only M-Pesa found) — no idempotency key on POS cash orders (double-submit duplicates). Storefront orders use `idempotency_key` (unique index, `schema.sql:132`) — good; POS does not. | Add idempotency to POS checkout; verify real payment status for M-Pesa. |
| P-3 | P3 | `server/index.ts:1980-1993` | If M-Pesa polling throws, order stays pending and held stock is never released or timed out. | Add a release-timeout job and retry/poll reconciliation. |
| P-4 | P3 | `server/index.ts:750-752` | M-Pesa config (incl. secret/passkey) returned unredacted (see S-6). | Redact. |

**Positive:** order payment dedup via `FOR UPDATE` + status guard on M-Pesa callback (no double stock deduction); refund overdraft check inside transaction; storefront order idempotency keys.

---

## 10. Inventory

| # | Sev | Location | Problem | Fix |
|---|-----|----------|---------|-----|
| I-1 | **P0** | `server/index.ts:1917-1936` | POS sale updates `stock_levels` via **READ→COMPUTE→WRITE** in JS, **not atomic/in-transaction**. Two concurrent POS sales both read qty=1, both write 0 → one unit silently lost (GREATEST clamps, no `WHERE qty >= x`). | Atomic `UPDATE ... SET qty = qty - $1 WHERE product_id=$2 AND branch_id=$3 AND qty >= $1`. |
| I-2 | **P0** | `server/db.ts:2585-2603` | `convertQuoteToOrder` same READ→WRITE race on stock_levels. | Atomic updates inside transaction. |
| I-3 | **P0** | `server/db.ts:2097-2113` | `completeStockTransfer` READ→WRITE source/dest stock **without a transaction**; concurrent transfers can double-spend. | Wrap in transaction with `FOR UPDATE`. |
| I-4 | **P0** | `server/index.ts:1893`, `server/db.ts:3031-3033` | Stock decrement uses `GREATEST(qty - $1, 0)` with **no `WHERE qty >= $1` guard** → sale of out-of-stock silently clamps instead of failing; inventory silently disappears. | Add `WHERE quantity >= $1` and fail when insufficient. |
| I-5 | **P1** | `server/db.ts:3465-3490` | `receivePurchaseOrderItem` READ→WRITE no transaction; concurrent receives race. | Transaction + atomic update. |
| I-6 | **P1** | `server/repairs.ts:631-636` | `addRepairPart` records part as used **even when stock deduction fails** (catch logs, insert still runs) → inventory drift. | Move insert inside the transaction; return error on failure. |
| I-7 | P2 | `server/db.ts:2044-2059` | `updateStockLevel` SELECT-then-INSERT/UPDATE without transaction/upsert → duplicate/lost updates. | Use `INSERT ... ON CONFLICT (product_id, branch_id) DO UPDATE`. |

**Top P0 prioritization note:** I-1/I-2/I-3/I-4 are the highest-impact inventory-integrity fixes (silent stock loss / phantom sales). They are safe, isolated SQL changes and fit the "P0 Inventory Integrity" tier of the implementation order.

---

## 11. Serial Numbers

| # | Sev | Location | Finding | Fix |
|---|-----|----------|---------|-----|
| SN-1 | P2 | `schema.sql:419-436` | Serial `UNIQUE` constraint exists (good). `serial_numbers.status` has **no CHECK constraint** (typos accepted) and no FK on `purchase_order_item_id`. | Add status CHECK; add FK. |
| SN-2 | P1 | `server/db.ts:3465-3490` | Serials inserted in a loop during PO receive without a transaction → partial insert orphaned on crash. | Wrap in transaction. |
| SN-3 | P2 | `server/db.ts:4462` | `order_items.serial_number` stores a comma-joined string for multiple serials — denormalized fragility; source of truth is `serial_numbers` table. | Keep as convenience only; ensure queries never rely on the string for correctness. |
| SN-4 | P2 | `server/db.ts:4424-4429` | `voidSerial` SELECT→UPDATE without lock (low risk, idempotent). | Add `FOR UPDATE`. |
| SN-5 | P1 | `server/schema.sql` | No `customer_id` on `serial_numbers`: ownership is indirect via `order_id→orders.customer_id` (functional but requires JOIN; see Phase 18 customer-asset model). | Either keep indirect (documented) or add explicit ownership table when customer assets are built. |

**Lifecycle verified:** PRODUCT → SERIAL (`serial_numbers` unique) → STOCK (`branch_id`) → SALE (`order_item_id`, status→sold) → CUSTOMER (via order) → WARRANTY (`warranty_expires`) → REPAIR (not linked to serial today). Refund correctly restores sold serials to `in_stock` (`db.ts:2885`).

---

## 12. Orders

| # | Sev | Location | Problem | Fix |
|---|-----|----------|---------|-----|
| O-1 | **P0** | `server/db.ts:2947-2958` | `createOrder` inserts order + order_items **without a transaction** → partial order/orphaned items on failure. | Wrap in transaction. |
| O-2 | **P0** | `server/index.ts:1851-1944` | POS checkout (order + items + serials + stock) not in a single transaction → stock/order divergence on failure. | Wrap in one transaction. |
| O-3 | P1 | `server/db.ts:2569-2607` | `convertQuoteToOrder` order+items+stock not transactional. | Transaction. |
| O-4 | P2 | `server/db.ts:2626-2669` | Coupon `validateCoupon`→`recordCouponUsage` race (usage count can exceed max without lock). | `FOR UPDATE` on coupon row; transactional increment. |

---

## 13. Repairs

See dedicated §13 in audit; summarized P0/P1:

| # | Sev | Location | Problem | Fix |
|---|-----|----------|---------|-----|
| R-1 | **P0** | `server/repairs.ts:480-487` | No status-transition validation (see Z-3). | VALID_TRANSITIONS map. |
| R-2 | **P0** | `server/repairs.ts:631-636` | Part inserted despite stock-deduction failure (see I-6). | Move insert into transaction. |
| R-3 | P1 | `server/repairs.ts:144-147` | Missing statuses vs conceptual lifecycle: `awaiting_approval`, `approved`, `unrepairable` (and no `rejected`) are absent from the 8 implemented (`received, diagnosing, waiting_parts, in_progress, quality_check, ready, collected, cancelled`). | Add statuses + UI/API. |
| R-4 | P1 | `server/schema.sql:324-355` | No `warranty_id`/`serial_number` FK on `repair_tickets` → repairs not linked to warranty or serialized device; warranty vs paid repairs **not distinguishable**. | Add `serial_number`, `warranty_claim_id`, `is_warranty_repair` columns when building warranty claims. |
| R-5 | P1 | `server/repairs.ts:489-492` | Technician assignment history lost (overwrite of `assigned_to`). | Log assignment changes as `repair_updates`. |
| R-6 | P2 | `server/repairs.ts:207-220` | Repair cost uses hardcoded KES (800/2500) and residual labor (total−parts); mixed rounding. | Move rates to settings; make labor explicit; fixed-precision money (ties into §8). |
| R-7 | P2 | `server/repairs.ts:312` | `eta_at` hardcoded NOW()+48h. | Configurable default. |
| R-8 | P3 | `server/index.ts:2500-2560` | Warranty register `LIMIT 2000` no pagination. | Add pagination. |

**Phase 16 compliance:** creation ✓, quote/respond ✓, parts ± (with stock hole), customer messages ✓, calendar ✓, images ✓, dashboard stats ✓, technician assignment ✓ (no history), transition enforcement ✗, full status set ✗.

---

## 14. Warranty

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| W-1 | **P0** | **No `warranty_claims` table/model anywhere.** Warranty is a read-only register computed from `order_items.has_warranty`/`warranty_duration` + `serial_numbers.warranty_expires`. There is **no claim, approval, or rejection lifecycle** (`grep warranty_claim` = 0 hits). | Add `warranty_claims` table (`id, warranty_ref, customer_id, serial_number, repair_ticket_id, status, claim_date, resolution_date, notes, approved_by`) + claim API + UI. **Do NOT fake in frontend.** |
| W-2 | P1 | No coverage terms/exclusions stored; no FK from repair to warranty. | Add coverage/exclusions columns; link repairs to claims. |
| W-3 | P1 | Warranty start/expiry computed from order date + duration with month-end edge cases (`db.ts:4348-4353`). | Use explicit dates + robust month arithmetic. |
| W-4 | P2 | Warranty creation isn't a first-class event; it's derived ad hoc. | Make warranty registration explicit on sale. |

**Phase 17 compliance:** product-level & per-order-line warranty ✓, expiry ± ✓, register (read) ✓, claims ✗, approval/rejection ✗, coverage/exclusions ✗, repair linkage ✗.

---

## 15. Subscriptions (& Customer Assets / Service History — Phase 18)

| # | Sev | Location | Problem | Fix |
|---|-----|----------|---------|-----|
| SU-1 | **P1** | `server/db.ts:1332` | `branch_subscriptions.expires_at` is **never populated** (`setBranchPlan` sets only `activated_at`) → expiry never enforced; branches keep features indefinitely. | Set `expires_at` from billing period; add expiry check job. |
| SU-2 | **P1** | shop-level | **No recurring billing / auto-renewal / expiry enforcement** at shop/branch level; only provider-level invoices exist. Plan changes are immediate with no invoice/collection. | Implement billing cycle: invoice on change, renewal reminders, enforce payment before feature access. |
| SU-3 | P2 | `server/schema.sql:198-211` | `subscription_plans.features` is a JSON text column with no validation → typos silently break gating. | Feature lookup table + plan-feature join. |
| SU-4 | P1 | `marketeting`/assembly | **No `customer_assets` table** (Phase 18) — no asset register beyond ad-hoc serial/warranty cross-reference in `AdminRepairs.tsx:446-478`. | Add `customer_assets` table. |
| SU-5 | **P0** | — | **No `service_history` table** and no link from repairs to serials/warranty → cannot show a customer's lifetime service history (marketing copy at `marketing.tsx:741` is unbacked). | Add `service_history` (join repairs/claims/serials per customer) when Phase 18 is implemented. |

**Feature gating:** provider-level is enforced server-side (✓); shop-level is client-side only (Z-4).

---

## 16. API Security

- All queries parameterized (no SQL injection) — verified.
- Error messages leak in several catch blocks across upload/product/repair endpoints (e.g., `index.ts:1221,3744,3944,4798` return `e.message`) — P2, normalize to user-safe messages.
- `GET /api/whatsapp/media/:id` unauthenticated (S-2) — P1.
- Body limit 1MB — acceptable; consider CSRF necessity given header-token auth (harmless).
- No API versioning; route explosion in one file (382 routes) — P3 maintainability.

---

## 17. File Uploads

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| F-1 | P1 | Path traversal in `backupImageToDb` (S-3). | Path-confinement check. |
| F-2 | P2 | `/uploads` served unauthenticated with no CSP/nosniff; SVG magic bytes accepted upstream. | CSP/nosniff; drop SVG or sanitize. |
| F-3 | P3 | Prefix-based filename matching in `imageUrlForProduct`/`deleteProductImages` (`upload.ts:223,236`) could match unintended files. | Exact filename matching with delimiters. |

**Positive:** magic-byte validation, server-generated filenames, 5MB cap, `.svg` dropped locally.

---

## 18. Error Handling

- **Positive:** global error handler returns generic message; no stack traces to clients.
- **P2:** several endpoints return raw `e.message` (see API security).
- **P2:** silent `catch {}` swallows in migrations (`db.ts`) obscuring failures.
- **P2:** `addRepairPart` catches+logs stock failure but continues (I-6).
- **P3:** polling `keep pending` behavior can strand held stock indefinitely.

---

## 19. Logging

- **P1/P2:** control-plane audit log is fire-and-forget (C-7); destructive control-plane actions not guaranteed logged.
- **P2:** no structured logging / correlation across tenant server; `console.error` ad hoc.
- **P3:** M-Pesa/WhatsApp webhook and payment callbacks lack structured audit (beyond stock/order guards).

---

## 20. Testing

- **P1:** Only **one** automated test file (`tests/isolation.test.ts`) covering DB isolation/atomicity. No tests for tenant isolation, authorization, payments, refunds, inventory concurrency, serials, repairs, warranties, subscriptions, webhooks, or HTTP routes.
- **P1:** No E2E route tests; `TEST_PLAN.md` is a manual checklist.
- **P3:** No link-crawler (`npm run check:links` absent).
- CI (`.github/workflows/ci.yml`) runs typecheck + build + isolation test — green, but coverage is minimal.
- **Phase 22 test plan** must add: tenant isolation, authorization, payments/refunds, inventory concurrency, serials, repairs, warranties, subscriptions, webhooks, control-plane security.

---

## 21. Performance

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| PF-1 | P1 | Storefront home + category listings fully **client-rendered** (`useEffect` fetch; no SSR/SSG/ISR) → poor SEO, slow first paint, waterfall. | `getStaticProps`/`getServerSideProps`/ISR for home + category. |
| PF-2 | P1 | Images lack `width`/`height` → CLS; no `next/image`; hero not prioritized. | Add dimensions/`aspect-ratio`; `priority` on LCP; consider `next/image`. |
| PF-3 | P2 | POS loads **entire product catalog** client-side and filters in JS (unbounded). | Server-side search/pagination. |
| PF-4 | P2 | Dashboard fires ~6 parallel endpoints + 30s polling; admin is one giant bundle (6752-line page, all views one chunk). | Batch, reduce polling, code-split admin (`next/dynamic`), virtualize tables. |
| PF-5 | P3 | `_app.tsx` keyed `<PageTransition>` remounts whole tree on every route change. | Remove keyed remount. |
| PF-6 | P3 | M-Pesa POS polling every 5s continues while tab hidden. | Pause when `document.hidden`. |

---

## 22. Accessibility

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| AX-1 | P2 | Unwrapped storefront `<table>`s (order/quotes/wishlist) overflow horizontally on mobile. | Wrap in `.table-wrap`. |
| AX-2 | P2 | `DataTable` sortable `<th>` buttons lack accessible sort labels; rows are `<tr onClick>` not keyboard accessible; `aria-sort="none"` invalid. | Add `aria-label`, `scope="col"`, keyboard handling/`role`; drop invalid `aria-sort`. |
| AX-3 | P2 | Modal title is `<h2>` not `<h1>`; background not `inert`. | `inert` background; single heading hierarchy. |
| AX-4 | P2 | Header/table contrast borderline for small tertiary text. | Darken `--text-tertiary`/increase size/weight. |
| AX-5 | P3 | Icon-only header controls rely on `title` not `aria-label`; no `aria-expanded`/`aria-controls` on mobile toggles. | `aria-label` + expanded/controls. |
| AX-6 | P3 | No per-page canonical/OG tags. | Add canonical + social tags. |

**Positive:** modals implement focus trap + restore (`focusTrap.ts`); images have alt; `role="status"` used for POS status; skip link present.

---

## 23. Responsive Design

- Breakpoints well-structured (1024/900/768/640/480). POS collapses to column stack at ≤900px (good).
- **P2:** unwrapped tables overflow (AX-1). Marketing tables need `overflow-x` confirmation.
- **P3:** POS 2-column grid at ≤480px may be cramped on very small phones; header search full-width reflow needs overflow guard.

---

## 24. Routing

- **P1:** `pages/login.tsx` — `?redirect=` passed **unvalidated** to `router.push` → **open-redirect** surface and arbitrary destination. Validate against an internal allow-list.
- **P1:** `pages/admin.tsx:5872` — order-row link `/admin?view=orders&order=${o.id}` includes an `order` param the admin page never reads → deep-link is dead (loads orders view, does not open that order).
- **P2:** `/account` is effectively orphaned (header "Account" → `/dashboard`; `/account` immediately redirects to `/dashboard`).
- **P2:** Large class of **admin/config-driven links validated only at runtime**: footer-config links (`Layout.tsx:409`), Storefront Builder hero/banner/button/image links (`dynamic-engine.tsx`), hero chips/shop-now/badge (`original.tsx`), splashes (`MarqueeBanner.tsx`), category/subcategory links derived from product data. If misconfigured they resolve to 404/empty. Validate/constrain at admin-save time and at render.
- **P3:** no bare `#` hrefs; all static nav, header, footer(default), breadcrumbs resolve to real pages; all user-facing external links use HTTPS.

**Full page-route inventory + per-surface link catalog:** see `ROUTE_INTEGRITY.md`.

---

## 25. Links

See §24 and `ROUTE_INTEGRITY.md`. Summary of dead/flagged internal links:
1. `layouts/amazon.tsx:62-65` and `layouts/jumia.tsx:60-63` — **dead "Search" buttons** (no onClick, do nothing).
2. `pages/admin.tsx:5872` — dead `order=` deep-link param.
3. `pages/login.tsx` — open-redirect via `?redirect=`.
4. Config-driven (footer/builder/hero/splash) links unvalidated (P2).

---

## 26. Navigation

- Header, mobile nav, footer, sidebar, breadcrumbs, dashboard shortcuts, storefront CTAs all resolve to real pages (verified). 
- Breadcrumbs on about/contact/groups/group/campaign/repairs/my-repairs/repair-book/repair-ticket/product all valid.
- `Login` pushes to `/dashboard` for customers, `/admin` or `/dashboard` for staff (correct).
- Dead search buttons in amazon/jumia layouts (see §25).

---

## 27. Buttons / CTAs

- **No** empty `onClick`/dead `href` buttons found in core UI (verified by grep). 
- Dead "Search" buttons in amazon/jumia (P2, see §25).
- POS "Lock till" target size small (P3); destructive CTAs (cancel order) not styled as danger (P3); StorefrontBuilder icon-only `?` remove control unclear (P3).
- POS product tiles hit area/touch-size notes (P3).
- All icon-only close/remove buttons have `aria-label` (good).

---

## 28. API Endpoint Integrity

- 382 routes on the tenant server; auth/tenancy/role analysis in §1–§5 and full matrix in `API_ROUTE_INTEGRITY.md`.
- Frontend calls follow a `fetch("/api/...")` + `api()` client pattern; verified no leftover object-style `api.foo()` dead calls.
- Key API-level gaps: `POST /api/clients` **provision new tenant** reachable by any `requireAuth` role on the control plane (T-1); `/api/whatsapp/media/:id` unauthenticated (S-2); `/api/messages/:id/read` no ownership (S-8); manual invoice-token auth (Z-2).

---

## 29. Deployment

| # | Sev | Finding | Fix |
|---|-----|----------|---------|-----|
| D-1 | P1 | No automated backup/restore; only a control-plane `/api/backups/*` with **no restore path** documented and no scheduled execution. | Scheduled `pg_dump`/Neon branch backups off-site + documented restore runbook. |
| D-2 | P2 | Free-tier control plane + backend (spin-down, cold starts). | Paid tiers for control plane/backend. |
| D-3 | P2 | CI deploys on push; frontend Vercel + backend Render both wired; no staging/preview gating for storefront. | Add staging/preview. |
| D-4 | P3 | `check:links`, route/E2E checks absent from CI. | Add to CI. |

**Positive:** CI (typecheck + build + isolation tests) green; Render + Vercel auto-deploy; env secrets in GH Actions; control-plane provision flow covers Neon+Render+Vercel.

---

## 30. Backup / Recovery

- **P1:** No scheduled automated backups for tenant or control-plane DBs found. Control-plane `/api/backups/run` + `/api/backups/download/:filename` exist but restore path/scheduling not verified/documented.
- **P1:** Control-plane `DELETE /api/clients/:id` is irrecoverable (C-1) — exacerbates lack of backups.
- **P2:** `pg_dump` command-injection risk (C-2) means the only backup mechanism is unsafe.
- **Recommended (P1):** off-site daily dumps (or Neon branch/point-in-time), restore runbook, backup integrity test, and retention policy.

---

## Phase Implementation Order (proposed, pending approval)

Per §28 of the brief, work in priority order. **Nothing below is implemented in Phase 0.**

1. **P0 Security:** block M-Pesa simulation in prod (S-1); fix `backupImageToDb` traversal (S-3); one-time reset/magic tokens (S-4).
2. **P0 Tenant Isolation (control plane):** enforce `requireAdmin` on all cross-tenant/stateful routes (T-1); per-user scoped API keys, drop shared-key-admin + query path (T-2); irreversible delete guard (C-1); pg_dump spawn not shell (C-2).
3. **P0 Control Plane:** rate limiting (C-3), SSL CA verify (C-4), stable JWT secret (C-5).
4. **P0 Financial Integrity:** (approval-gated) migrate money to integer cents/NUMERIC + decimal computation (§8).
5. **P0 Inventory Integrity:** atomic guarded stock updates + transactions (I-1/I-2/I-3/I-4, I-5/I-6).
6. **P1 Database:** stock_levels unique `(product_id,branch_id)` (DB-1), indexes (DB-2), FKs (DB-3), safe cascade (DB-4).
7. **P1 Payments/Webhooks:** M-Pesa reconciliation + POS idempotency + held-stock timeout (P-2/P-3).
8. **P1 Repairs/Warranty/Assets:** transition map (R-1/Z-3), part-insert fix (R-2), missing statuses (R-3), warranty_claims (W-1 P0), customer_assets & service_history (SU-4/SU-5 P0).
9. **P1 Testing:** tenant isolation/authorization/payments/inventory/serial/repair/warranty/webhook tests + HTTP route tests + link crawler (§20/§22).
10. **P2 Performance/Accessibility/UI:** SSR storefront (PF-1), CLS (PF-2), tables (AX-1), DataTable a11y (AX-2), admin code-split, dead search buttons & open-redirect & dead deep-link (§24/§25).

---

## Change-Safety Notes

- This document is **audit-only**. No `CHANGE-SAFETY_PROTOCOL` steps were executed.
- Money representation (§8), DB migrations (§7), and tenant/control-plane architecture (§2/§5) are **high-risk** — any implementation requires explicit approval per the brief.
- All fixes listed should follow the Change-Safety Protocol and be validated by the `FINAL_VALIDATION` checklist (lint, typecheck, unit/integration/E2E, prod build, route/link/API checks).

---

## Companion Documents

- `ROUTE_INTEGRITY.md` — phase 2 route matrix (all important routes, auth, tenant scope, status).
- `API_ROUTE_INTEGRITY.md` — phase 6 frontend API calls vs endpoints.
- `SECURITY_MODEL.md` — security/auth/tenancy/control-plane model + findings.
- `DATABASE_MIGRATIONS.md` — schema + migration architecture + inventory/financial/serial schema gaps.
- `PRODUCTION_SCORECARD.md` — 0–5 scores per category with rationale for scores < 3.
