# Gears&Glitch — Phase 0 Architectural & Security Audit

**Repository:** https://github.com/puggythemeddler/Gears-Glitch
**Audit mode:** Read-only. No code was changed. This is the deliverable of **PHASE 0** required before any implementation work begins.
**Audit date:** 2026-08-29
**Method:** Manual verification of high-risk claims (credentials, secrets exposure, money types, migration mechanics, stock/money arithmetic, callback handling) plus deep file-level review of all major subsystems.

---

## 1. Executive Summary

Gears&Glitch is substantially more mature than a typical "1.0 SaaS": 67 tables, ~380 backend routes, a real per-tenant provisioning pipeline (Neon → Render → Vercel), a control plane, eTIMS-aware invoicing, serial-number tracking, repairs, and a large feature surface. The single most valuable design decision — **one PostgreSQL database per tenant — is real and correctly isolates tenants at the deploy boundary**: the tenant server binds one `DATABASE_URL` at boot and no client API accepts a user-supplied tenant/database identifier. That core isolation promise currently holds.

The same credential goes the other direction: **most of the risk is concentrated in (a) the control plane, (b) financial/inventory arithmetic that is not atomic, and (c) authorization breadth inside each tenant.**

The eleven most serious issues, all fitting the user's production-readiness bar, are:

1. **P0 — Every tenant is provisioned with the same hardcoded admin password** (`"Livid@50"`, `control-plane/server/provision.ts:501`), it is emailed to clients, stored in plaintext in the CP DB, returned by `GET /api/clients` to **all** CP roles, and rendered with a copy button in the CP UI for all users (`control-plane/server/index.ts:384`, `control-plane/public/index.html:959-960,2179`).
2. **P0 — The CP "viewer" role is UI-only.** Nearly every destructive control-plane endpoint (delete tenant, deploy-all, suspend/resume, run backup, download full DB dumps, record payments) is guarded by `requireAuth` only; `requireAdmin` covers ~5 of ~60 routes (`control-plane/server/index.ts:130,597,645,677,1007,1022,1159,1222,1569`).
3. **P0 — Control-plane backups run `pg_dump "<neon_db_url>"` via shell with unrescaped interpolation** (`control-plane/server/index.ts:1172,2047`), reachable by any authenticated user — a command-injection / RCE surface. Backups live on the CP's **ephemeral local disk** (7-day retention) and **no restore or restore-verification exists** (`index.ts:1157,2033-2067`).
4. **P0 — All money is `DOUBLE PRECISION`** and computed with JavaScript IEEE-754 floats (`server/schema.sql` — full column list in §3), including VAT via `Math.round(x/116*100)/100` (`server/index.ts:2041,2053`). No `financial_transactions` ledger, no `payments` table, no integer-cents invariant.
5. **P0 — Payment callbacks are not idempotent.** The M-Pesa callback is unauthenticated/unverified (structure-only check, `server/index.ts:679-748`) and the paid-state guard in `confirmOrderPayment` is an unlocked read+write (`server/db.ts:2905-2921`), so duplicate/concurrent callbacks (or POS poll racing the callback) can double-deduct stock and double-write movements.
6. **P0 — Stock updates are not atomic.** The codebase standard is read → absolute-write with `GREATEST(quantity - n, 0)` clamping silent oversell instead of rejecting it (`server/db.ts:2583,2912,2914,2931,2933`); no transaction wraps stock changes, refunds (`server/db.ts:2834-2841`), gift-card redemption, or loyalty redemption. Check-then-`UPDATE` serial sale (`server/db.ts:4290-4322`) has a TOCTOU window permitting the same serial to be sold twice.
7. **P0 — `ON DELETE CASCADE` destroys financial history.** Deleting a product cascades into `order_items`, `quote_items`, `purchase_order_items`, `serial_numbers`, `price_history` (`server/schema.sql:150,481,414,432,595`, re-forced at `server/db.ts:1120-1143`) — orders keep their totals but lose their lines. Money trail and audit lost permanently.
8. **P0 — The shared Cloudinary API secret is returned to in-tenant staff.** `GET /api/settings` (any staff with `settings:view`) returns the full settings row including `cloudinaryApiSecret` plus the WhatsApp access/app tokens (`server/db.ts:1713,1721-1723`). The Cloudinary account is **shared across all tenants** with per-client folders, so any tenant's staff can enumerate/delete every tenant's images and message send access.
9. **P0 — Provider IDOR + open registration.** Registering as a "provider" is open and un-vetted (`server/index.ts:1238-1253`), immediately mints a provider JWT, and provider order routes read and mutate **any order by id** — full customer PII read, cancel/ship/deliver any customer's order (`server/index.ts:2417-2453`).
10. **P0 — No versioned migrations.** Every tenant boot re-runs the whole idempotent `schema.sql` plus a ~700-line flat `runMigrations()` of `IF NOT EXISTS`/`catch {}` ALTERs with **no `schema_version`** (`server/db.ts:625-657,659-1385`). The control plane cannot tell Tenant A's schema from Tenant B's; the previously-hit `group_id` index-over-ALTER crash class (`README.md:138`) can recur.
11. **P0 — eTIMS is a stub.** `createEtimsSalesTransaction` never inserts or submits anything (`server/db.ts:3160-3164`); credit notes are stamped `submitted` with fabricated serials/codes (`server/index.ts:2960-2967`). The platform claims KRA compliance that is not actually happening.

**Notable strengths that must be preserved:**
- Sound tenant isolation by construction (one DB per tenant; no tenant-switch vector in client code).
- No exploitable SQL injection found; parameterized queries are the norm.
- CSRF double-submit cookie protection on non-POS state-changing routes; Helmet; magic-byte file validation; timing-safe dummy-bcrypt; bcrypt cost 10; staff TOTP 2FA; hard rejection of placeholder `JWT_SECRET`.
- Robust product engineering: POS idempotency key per cart, test-site-first deploy philosophy, per-client folders in Cloudinary, deploy logging with commit IDs, M-Pesa callback validation (structural), WhatsApp HMAC verification (when present), timing-safe `x-control-plane-key` verification on the client side.
- Rich, genuine feature surface (repairs, serials, POS, purchasing, subscriptions per branch, eTIMS-ready invoices, WhatsApp) that maps well onto the target "SELL + TRACK + SERVICE + WARRANTY + MANAGE CUSTOMER ASSETS" positioning.

---

## 2. Current Architecture

```
                        ┌───────────────────────────┐
                        │       CONTROL PLANE       │  Express + pg (Render)
                        │  express + jwt + speakeasy│
                        │  provision.ts (Neon/Render/Vercel)
                        │  backups (pg_dump→disk)   │
                        │  health cycle (uptime)    │
                        │  billing/suspend/resume   │
                        └───────┬─────────┬─────────┘
              x-control-plane-key (per tenant) │  │ Render/Neon/Vercel APIs
                                             │  │
  ┌──────────────────────────┬───────────────┴──┴──────────────────────────┐
  │                          │                                            │
  │  TENANT A                │                    TENANT B                │
  │  Vercel (Next.js 14)     │                    Vercel (Next.js 14)     │
  │  frontend (storefront +  │                    (identical)             │
  │  staff portal SPA)       │                                            │
  │  ─────────────      HTTPS│                                            │
  │  Render (Express)        │                    Render (Express)        │
  │  server/index.ts (~380   │                    (identical)             │
  │   routes), auth.ts,      │                                            │
  │   permissions.ts, mpesa  │                                            │
  │   repairs, whatsapp,     │                                            │
  │   upload, email, pdf     │                                            │
  │  ─────────────           │                                            │
  │  Neon PostgreSQL         │                    Neon PostgreSQL         │
  │  (67 tables, per-tenant) │                    (schema.sql identical)  │
  │  ─────────────           │                                            │
  │  Cloudinary (encoded     │   ⚠ SHARED ACCOUNT, per-client folders     │
  │   folder per client)     │   ⚠ credentials returned to tenant staff   │
  └──────────────────────────┴────────────────────────────────────────────┘
```

**Data flow (sale):** Storefront/POS → Express (staff/customer JWT) → per-tenant Neon pool (one `DATABASE_URL` per service) → `orders`/`order_items`/`stock_levels`/`stock_movements`/`serial_numbers` → `order_invoices` (eTIMS fields) → optional M-Pesa STK push with callback.

**Key characteristics**
- Monolithic backend per tenant (381 routes over ~13 files; `server/index.ts` 341KB).
- One DB per tenant; schema re-applied idempotently at every boot (no versioning).
- Frontend is a mix of Next.js pages (storefront, `account.tsx`, POS, admin portal) with heavy SPA behavior and a `localStorage`-held JWT.
- Control plane is a separate small Express app with its own DB, holding credentials for every tenant.

---

## 3. Database Architecture Assessment

**Migrations (P0/P1):** No `schema_version`, no migrations ledger, no per-tenant versioning. `initDb()` (`server/db.ts:625-657`) runs the whole `schema.sql` (idempotent `CREATE ... IF NOT EXISTS`, additive-only) then a ~700-line flat `runMigrations()` of `ADD COLUMN IF NOT EXISTS`/`CREATE ... IF NOT EXISTS`/ad-hoc backfills wrapped in `try{}catch{}`. `catch{}` silence means a failed ALTER is permanent and invisible. Some columns are declared in `schema.sql` **and** re-added by migration (e.g. `orders.gift_card_amount` at `schema.sql:810` vs `db.ts:858`) — the migration `IF NOT EXISTS` is then a no-op, so intended FKs never get created. The `group_id` crash class (README.md:138) is still possible. **The control plane only ever sees `APP_VERSION`, never schema version.**

**Money types (P0):** Every financial column is `DOUBLE PRECISION`: products.price, products.sale_price, order_items.price/line_total, orders.subtotal/shipping_fee/discount_amount/gift_card_amount/amount_refunded/tendered_amount, subscription_plans.price/price_annual, provider_plan_assignments.custom_price, invoices.amount, order_invoices.amount, repair_types.base_price, repair_tickets.hardware_value/labor_cost/parts_cost/total_cost, repair_parts_used.unit_cost, purchase_order_items.unit_cost, quotes.total/discount_value, quote_items.unit_price/line_total/discount_value, coupons.value/min_order_amount, coupon_usage.discount_amount, price_history.old_price/new_price, credit_notes.total_amount, credit_note_items.price/line_total, etims_sales_transactions.total_amount, gift_cards.initial_value/balance, gift_card_redemptions.amount, cart_recovery_reminders.cart_total, refunds.amount. JS arithmetic is raw float (`server/db.ts:2863`, `server/index.ts:5643,2032,4902`). No `NUMERIC`, no cents, no signs of a decimal invariant.

**Integrity gaps (P1/P2):** `orders.coupon_id` and `orders.gift_card_id` have **no FK** (the intended ADD-with-FK is a no-op on fresh DBs — `server/db.ts:689,857`); `products.group_id` no FK (`schema.sql:17`); missing FKs on `refunds.product_id` (867), `repair_parts_used.product_id` (372), `etims_sales_transactions.order_id` (681), `serial_numbers.purchase_order_item_id` (426), `credit_notes.created_by` (655), `gift_card_redemptions.customer_id` (831). `products.category` is free text with no FK to `categories`. `audit_log.user_id` no FK (deliberate, but covers provider).

**Cascades (P0):** Product-referencing FKs are `ON DELETE CASCADE` and the migration layer actively re-forces CASCADE (`server/db.ts:1120-1143`). Deleting a product deletes historical `order_items`, `quote_items`, `purchase_order_items`, `serial_numbers`, `price_history`, `stock_take_items`, `stock_snapshots`, `product_reviews` — destroying the financial/audit trail while order totals remain.

**Indexes (P2):** Missing on `orders(status)`, `orders(branch_id)`, `order_items(product_id)`, `stock_movements(branch_id)`, `stock_levels(branch_id)`, `serial_numbers(order_id)`, `repair_parts_used(ticket_id)`.

**Duplication (P1/P2):** Two stock truths (`products.stock_on_hand` — randomly seeded at `server/db.ts:1111-1118` — vs `stock_levels`); payment state spread across `orders`, `order_invoices`, `refunds`, `gift_card_redemptions`, `coupon_usage` (never written), `credit_notes` with **no `payments` table**; three "invoice" concepts (`invoices`, `order_invoices`, CP `invoices`); warranty duplicated on `order_items` and `serial_numbers.warranty_expires` with no claims table; a `clients` table inside every tenant; `subscription_plans.is_active` type mismatch (`INTEGER` vs re-added `BOOLEAN`, silently masked). `stock_movements.movement_type` is free `TEXT` with no CHECK constraint.

**Audit logging (P2):** `audit_log` exists (user_id, user_name, action, entity_type/id, details, actor_role, created_at) with indexes, populated only by manual `recordAuditLog()` call sites (`server/db.ts:2612-2617`; another encoder at :3591,3699). No triggers. Coverage is spotty: product edits, settings changes, stock movements, quote CRUD and most PF writes are unaudited.

---

## 4. Security Assessment

- **SQL injection:** None found. All queries parameterized (`$1..$n`); template-literal `${...}` interpolations verified to only inject hardcoded fragments (verified enumeration in `01_tenancy_auth_authz.md` §5).
- **XSS:** Frontend is React with mostly-interpolated text; the CP dashboard renders escaped inline-handler args (bulk truth not fully audited; `json`-referenced vars are escaped per README pass). Residual risk areas: any `dangerouslySetInnerHTML` and server-rendered HTML invoice/receipt templates that interpolate user/order data — **unverified**, recommend an automated scan.
- **CSRF:** Double-submit cookie middleware on non-POS state-changing routes (`server/index.ts:376-398`). POS routes intentionally skip CSRF (token-auth in tabs) — acceptable only if the query-token issue (F-14) is fixed.
- **AuthN:** bcrypt cost 10; timing-safe dummy-bcrypt on unknown user (`server/auth.ts:137,193,233`); staff TOTP 2FA; Google sign-in verified with `audience`; rate limits (global 200/15m, auth 10/15m). **No reCAPTCHA/lockout; no refresh tokens; no revocation; no logout endpoint; JWT HS256 with no `algorithms` allow-list; customers/providers have no 2FA.**
- **AuthZ:** Role model + `requirePermission` exist and are DB-backed, but enforcement is inconsistent: 37 `staffAuth` + 10 `posAuth` mutating routes skip `requirePermission` (repairs, POS order create/cancel/pay, receipt, invoice-token); coarse middlewares trust the JWT's embedded role (stale on role change); a "provider" passes `staffAuth`/`ownerAuth` merely by having a `permissions` array (`server/auth.ts:80,294`).
- **IDOR:** Provider order read/mutate (P0, open registration), customer quote status (P1), POS cancel/pay any order (P2), unguarded WhatsApp media by sequential id (P2), messages:`:id/read` accepts any valid token (P2). Ownership checks correctly enforced on orders (`/api/orders/:id`), repairs-mine, invoice tokens, refunds, credit notes, and role assignment.
- **Query-string tokens:** Invoices use 5-minute purpose-scoped tokens correctly scoped to one `orderId` (good — a signed-URL-style pattern). **POS print tabs embed the full 24h staff JWT in the URL** (`?allowQueryToken=1&token=<jwt>`, `server/auth.ts:62-70`; `frontend/pages/pos.tsx:645,671`) — replays the whole staff session if leaked via logs/links. Magic-link mints a **7-day** session token. Both are token-hygiene issues (P2/P3).
- **Brute force:** shared + auth rate limits only; no per-account lockout.
- **Secrets in code/repos:** `.env.example` placeholders only (good). `control-plane/render.yaml:25` commits a `VERCEL_TEAM_ID` (identifier, not credential). `SandboxCertificate.cer` in root (M-Pesa sandbox cert — public, low risk, but should be removed from the repo). Hardcoded `ADMIN_PASSWORD="Livid@50"` (P0) and default CP admin password fallback `"gearglitch2024"` (P0-if-env-unset).
- **Webhook/callback spoofing:** WhatsApp HMAC-SHA256 verification **only runs when the header is present** (`server/index.ts:6055`) — a spoofable no-signature request is processed; no replay protection. M-Pesa callback structural-only (P0). CP `/api/plans/sync-up` trusts a single tenant's cp_secret to rewrite plans fleet-wide (P1).
- **File uploads:** Magic-byte validation, size limits, cleanup attempted; but `stored_images` base64 in DB is served without auth (`/api/images/:refId`, `server/index.ts:605-612`) — low sensitivity if refIds are unguessable, verify.
- **Privilege escalation:** Staff cannot self-escalate via the role-assignment endpoints (admin-only, validated allow-list). Residual: stale-role JWT until expiry (24h).

---

## 5. Multi-Tenancy Assessment

**Design:** One PostgreSQL database per tenant on Neon, one Express service per tenant on Render, one Next.js storefront per tenant on Vercel, shared Cloudinary with per-client folders, CP-controlled env injection (`DATABASE_URL`, `JWT_SECRET`, `CONTROL_PLANE_SECRET`, `ADMIN_*`). Client pool is bound at boot to one `DATABASE_URL` (`server/db-helpers.ts:5-23`); **no client route accepts a tenant identifier; no client route can switch pools.** Cross-tenant isolation by construction at the network/DB boundary **holds** — this is the strongest security property in the system and must be preserved.

**Where cross-tenant risk actually lives:**
1. **Shared Cloudinary credentials exposed to tenant staff** (P0, §4) — any tenant can delete all tenants' images.
2. **CP store of all tenants' `neon_db_url` (with embedded passwords) and `cp_secret` in plaintext** (P1) — CP DB compromise = total compromise.
3. **`GET /api/clients` returning `admin_password` to every CP role** (P0) — uniform tenant login by reading the list.
4. **Provider/walk-in flows with shared visibility** — these are within-tenant but cross-customer (P0 IDOR in §4).
5. `POST /api/plans/sync-up` — fleet-wide plan injection from one tenant's secret (P1).

**Automated isolation regression tests required (Phase 1/4):** Given one DB per tenant, the highest-value automated proofs are (a) each tenant can only connect to its own Neon endpoint (no shared pool, no tenant-scoped table), (b) no client endpoint reflects any cross-tenant handle (`neon_db_url`, other tenants' store names/ids, Cloudinary assets outside `gear-glitch/{slug}`), (c) CP list/get endpoints redact secrets for non-admin roles (server-side, not UI), (d) in-tenant cross-user IDOR suite (A cannot read B's customers/orders/products/inventory/repairs/warranties/invoices/payments/reports). These map 1:1 onto the P0 fixes below.

---

## 6. Control-Plane Assessment

- **Roles (P0):** Only `admin` vs everything-else; `requireAdmin` guards ~5 routes; viewer is UI-only. Delete-client, deploy-all/test, suspend/resume, backup run/download, record-payment, publish-changelog are `requireAuth`-only (`control-plane/server/index.ts:597,645,677,720,743,1007,1022,1159,1222,1569`).
- **Secrets (P0/P1):** `admin_password` (plaintext, returned to all roles, copy button for all users), user API keys (plaintext, returned to admins), TOTP secrets, Neon URIs, cp_secret, SMTP pass, Cloudinary api_secret — all plaintext at rest. `GET /api/clients/:id` deletes `cp_secret`/`neon_db_url` for **all** callers (redaction is real but role-agnostic — the README's "hidden from viewer" is inaccurate; worse, the list endpoint leaks `admin_password`).
- **Provisioning (P1):** Pipeline works end-to-end (Neon→Render→Vercel, env injection, deploy triggers, first-boot admin seeding). Failure handling sets `status='failed'` with **no rollback** (README claims cleanup exists; it does not) — orphaned billed resources.
- **Deploy (P1/P2):** test-site-first philosophy is real and valuable; deploy log captures commit SHA/message/source; **no rollback-to-commit**; `redeploy` logs without SHA.
- **Backups (P0):** `pg_dump` shell-exec per tenant to CP local disk, 7-day retention, daily in-process timer (lost on restart), **no restore automation, no restore/verification, no off-box copy**. RCE surface in the shell interpolation (`index.ts:1172,2047`).
- **Health (P2):** uptime-only probes; no DB-health/backup-age/error-rate metrics; no numeric tenant health score; notifications + Slack on transitions (good foundation).
- **Billing (P2):** record-payment auto-extends `subscription_expires`, computes balance, clears notifications; auto-suspend after grace with app-level 403 + Render pause — good; single role can do all of it (see roles P0).

---

## 7. Inventory Assessment

- **Model:** `stock_levels` (per-branch via migration-added `branch_id`; `NULL` branch = global) + `products.stock_on_hand`/`in_stock`; `stock_movements` (free-text `movement_type`); `stock_transfers`; `stock_take_sessions/items`; PO receiving with serial intake.
- **P0 atomicity:** no transaction wraps any stock change; the standard is read → `UPDATE stock_levels SET quantity_in_stock = GREATEST(quantity_in_stock - n, 0)` — silent clamp masks oversell (and the business loses the item instead of being told). `quote`-path and POS-path manipulate `products.stock_on_hand` without movement rows (`server/db.ts:2583`, `server/index.ts:1878,2929`). Two sources of truth can drift.
- **P1 completeness:** `products.stock_on_hand` mutated without movements; reserve-release writes no movement and is `GREATEST`-clamped; PO receive/reverse, transfers, stock-take apply are untransactioned; serial take/release TOCTOU.
- **P2:** movement_type unconstrained; `branch_id` unindexed on `stock_movements`/`stock_levels`/`orders`.
- **Desired model (target):** `stock_movements` as the authoritative ledger (purchase_received +, sale −, transfer_out −, transfer_in +, repair_part_used −, return +, adjustment ±), with `stock_levels` as a cached projection maintained atomically (transaction + guarded decrement + serialized queue per product/branch).

---

## 8. Financial Assessment

- **Money (P0):** all `DOUBLE PRECISION` + JS float math; no decimal invariant; VAT hardcoded `/116` while `taxRate` is configurable (`server/index.ts:2041`); FX conversion is client-side float multiply with no rate snapshot (`frontend/lib/app-context.tsx:219,228`).
- **Ledger (P1):** No `financial_transactions`/`payments` table. Financial history is reconstructed from `orders`, `order_invoices`, `refunds`, `credit_notes`, `gift_card_redemptions`, `etims_sales_transactions` (never written). `coupon_usage` never written. `orders.invoice_number` generation = `COUNT(*)+1` (collision under concurrency, `server/db.ts:2606-2610`).
- **Refunds (P0 race):** cap recomputed from pre-order read; `amount_refunded = amount_refunded + n` untransactioned; line caps are per-call not cumulative → concurrent refunds can exceed paid. No stock restore on refund (serialized units stay `sold`).
- **Idempotency:** POS cart has a per-cart idempotency key (good). M-Pesa callback status early-return is *not* atomic (P0 §6 summary). Gift-card redemption read-then-write with no `WHERE balance >= amount` (P0 double-spend); loyalty points same pattern.
- **eTIMS (P0):** stub — no submission, fabricated credit-note codes.

---

## 9. Repair Assessment

- Working lifecycle: ticket creation, diagnosis, assignment, quotes, parts+labour costing, status flow, customer portal, calendar, Page Content. Genuine and differentiated.
- **P0/P1:** **Repair parts never touch inventory** — `addRepairPart` (`server/repairs.ts:594-612`) inserts into `repair_parts_used` only; no `stock_levels` decrement, no `stock_movements` (route `server/index.ts:4642-4646`).
- Repair write routes bypass `requirePermission` (`server/index.ts:4635,4642,4654,4669,4687,4693`); any staff can reassign/cancel.
- Repair completion does not create an invoice/payment record; `sendRepairUpdateEmail` (`server/notify.ts:63-65`) is never called — customer-update emails don't fire.
- Costs stored as `double precision`. Repair images via Cloudinary folder per client (tenant-ok).

---

## 10. Warranty Assessment

- **Not a domain model.** Warranty = `products.has_warranty/warranty_duration`, `order_items.has_warranty/warranty_duration`, `serial_numbers.warranty_expires`. No `warranties`, no `warranty_claims`, no `warranty_claim_events`, no claims workflow, no registration step, no public lookup (lookup is POS-auth only, `server/index.ts:4770`).
- Serial→order→customer chain exists; warranty expiry computed at sale. Repair tickets are not linked to warranties.
- **This is the flagship differentiator per the project vision and is the correct target for Phase 4.** Build `warranties` (serial_number_id, customer_id, order_id, product_id, type, start/expiry, status, provider, terms, coverage, exclusions, registered_at/by) + `warranty_claims` + events, integrated with repairs — without duplicating `serial_numbers`/`order_items` data.

---

## 11. Testing Assessment

- **Zero automated tests.** No `*.test.*`/`*.spec.*`, no jest/vitest/playwright/cypress anywhere; CI runs none; `TEST_PLAN.md` is an unchecked manual checklist. This is the single largest production-readiness gap (user P5 priority).
- Target: unit (rounding, pricers, serial logic), API (each tenant boundary), DB (transactions, constraints), security (isolation + IDOR matrix), and E2E smoke (browse→cart→checkout→M-Pesa→order; purchase→receive→stock→sale; serial→warranty→claim→repair; refund; transfer; control-plane provision test-site→health→deploy→backup).

---

## 12. CI/CD Assessment

- `.github/workflows/deploy-test.yml` — push → CP `deploy-test` (one test site). `.github/workflows/deploy-all-clients.yml` — manual only, requires typing `DEPLOY`; `exit 0` when secrets unset → **false green** (workflow can silently no-op).
- **No typecheck, lint, build, or tests in either workflow.** CI can ship broken code to the test site and, with a manual click, to all production tenants. "Rollback" is redeploy-of-current-main only.
- Desired: push → typecheck → lint → unit → API → security → build → E2E smoke → test-tenant health → gated production rollout (canary/rollback).

---

## 13. Observability Assessment

- `console.log`-based logging; no structured logs, no request IDs / correlation IDs, no error tracker, no latency/DB-query timing. Health probes are uptime-only. Webhook/payment events logged to files (`data/mpesa.log` — earlier rev, now logs project-adjacent only).
- No single trace spanning order→MPESA request→callback→DB→invoice (user's `gl_01JXYZ…` goal unmet).
- `GET /api/health` discloses usage stats only to authenticated CP; public gets `{ok:true}` (good).

---

## 14. Backup / DR Assessment

- Backups: `pg_dump` → gzip → CP **local disk**, 7-day retention, in-process daily timer (lost on CP restart). **No restore automation, no restore verification, no off-box storage** (P0). A successful dump ≠ a valid restore.
- DR documentation: none (`DISASTER_RECOVERY.md` absent). No RTO/RPO definition, no runbook for tenant-DB corruption, backend/frontend/CP outage, M-Pesa/Cloudinary/eTIMS outage, compromised credentials, failed deployment.

---

## 15. UX Assessment

- Strengths: strong design-token system, WCAG-AA theming, keyboard-operable cards, touch targets, empty-state animation, generous facilities. The product does feel like a coherent platform.
- Gaps (P2/P3): **orders/customers/repairs admin lists are unpaginated and N+1** (`server/db.ts:2890-2899,3673-3679`, `server/repairs.ts:400-424`); serials capped at 500 with no paging; invoice/receipt flows rely on query-token tabs; frontend keeps JWTs in `localStorage` (XSS-exposure, functional acceptable today); magic-link email is **broken** (links to `account.html?magic=` which isn't a route — `server/index.ts:4057`; page is `/account` and never reads `?magic=`); incomplete loading/error/empty states on several admin panels; logout only clears one storage key.

---

## 16. Complete Issue List (P0/P1/P2/P3)

Legend: **P0** must-fix before production · **P1** should-fix soon · **P2** improvement · **P3** optional/future.

### P0 — Critical

| # | File | Module | Current behavior | Why it's a problem | Recommended fix | Difficulty | Side effects |
|---|---|---|---|---|---|---|---|
| P0-1 | `control-plane/server/provision.ts:501` | provisionClient | Every tenant's `ADMIN_PASSWORD = "Livid@50"`; emailed, stored plaintext, never rotated | Universal shared store-admin credential; known in source; any compromise = all stores | Crypto-random per-client password, hash-verify, no plaintext display, rotate-past-tenants | Low | Welcome-email flow + existing tenant re-credentialing |
| P0-2 | `control-plane/server/index.ts:384`, `public/index.html:959,2179` | clients list / UI | `admin_password` returned to all CP roles and rendered with copy button | Lowest-privilege CP user can exfiltrate every tenant login | Stop returning; admin-gated on-demand masked reveal | Low | Ops convenience rework |
| P0-3 | `control-plane/server/index.ts:130` (requireAdmin ~5 routes); `:597,645,677,720,743,1007,1022,1159,1222,1569` | CP authz | Viewers reach delete-client, deploy-all/test, suspend/resume, backups run/download, record-payment | Any authenticated CP user has near-total control incl. full DB dump downloads | Real role map (Super Admin/Platform Admin/Operator/Support/Viewer) enforced server-side on every destructive route | Medium | Re-review legit viewer workflows |
| P0-4 | `control-plane/server/index.ts:1172,2047,1157,2033-2067` | backups | `pg_dump "<neon_db_url>"` shell-interpolated, auth-only, local disk, 7d, no restore | Command-injection RCE + tenant data loss unrecoverable + dumps downloadable by viewer | Pass conn via env, admin-only, off-box object storage, automated restore + periodic restore-verify | High | Object storage + runbook |
| P0-5 | `server/schema.sql` (all money cols), `server/index.ts:2041,2053`, `server/db.ts:2863,5643` | money layer | `DOUBLE PRECISION` + JS float arithmetic; `/116` VAT vs configurable `taxRate` | Cents drift, invoice/refund mismatch, nondeterministic totals | `numeric(12,2)` or integer-cents migration; central rounding; deterministic VAT | Hard | Broad migration + app arithmetic changes |
| P0-6 | `server/index.ts:679-748`, `server/db.ts:2905-2921` | M-Pesa callback | Unauthenticated structural-only callback; unlocked read+write paid-state | Forged ResultCode:0 marks unpaid orders paid; duplicate/concurrent callbacks double-deduct stock | Signature/IP + STK-Query cross-check + amount check; atomic status claim (e.g. `UPDATE ... WHERE status='pending'`) | Medium | Callback flow + retry semantics |
| P0-7 | `server/db.ts:2583,2912,2914,2931,2933`, `server/db-helpers.ts:44-57` | stock layer | Read→absolute-write with `GREATEST(…,0)`; no transactions | Simultaneous sales oversell silently; movements desync | Transactions + guarded `UPDATE … WHERE quantity_in_stock >= $n`, reject oversell; movement-append in same tx | Medium | Retryable-failure on oversell |
| P0-8 | `server/db.ts:2834-2841, 2717-2735, 3654-3659` | refunds / gift cards / loyalty | Untransactioned increase; caps per-call not cumulative; balance read-then-write | Concurrent refund overpay; gift-card/loyalty double-spend | Atomic `WHERE balance >= amount`, cumulative caps in one update, transactions | Medium | — |
| P0-9 | `server/schema.sql:150,481,414,432,595`; `server/db.ts:1120-1143` | FKs | Product FKs `ON DELETE CASCADE` (re-forced) | Deleting a product wipes historical financial/audit lines | `RESTRICT`/`SET NULL` + product soft-delete; drop cascade re-forcer | Hard | Product delete UX changes; data back-fill |
| P0-10 | `server/index.ts:755-769`, `server/db.ts:1713,1721-1723` | settings API | `/api/settings` returns shared Cloudinary apiSecret + WhatsApp tokens to staff | Any tenant admin controls the shared Cloudinary account (all tenants' images) + WhatsApp | Rotate to per-tenant keys OR server-side signing proxy; never return secrets; least-privilege uploads | High | Upload architecture change |
| P0-11 | `server/index.ts:1238-1253, 2417-2425, 2427-2435, 2437-2453` | provider routes | Open un-vetted provider registration; provider reads/mutates ANY order by id | Anonymous actor reads customer PII and cancels/ships/delivers orders | Provider-bound queries (order↔provider membership), owner-approved registration, `requirePermission` | Medium | Provider onboarding flow |
| P0-12 | `server/db.ts:625-657,659-1385` | migrations | Whole idempotent bootstrap + flat migration list, no `schema_version`, silent `catch{}` | Per-tenant schema drift invisible; crash class recurs; no upgrade/rollback | Versioned `migrations/` + `schema_meta.version` per tenant; CP reports version | Medium | Baseline stamp for existing DBs |
| P0-13 | `server/db.ts:3160-3164`, `server/index.ts:2960-2967` | eTIMS | No submission; credit notes marked `submitted` with fabricated codes | Regulatory compliance claim is false | Real eTIMS/OSCU integration with signed payloads + status ledger, or disable the claim | High | Compliance scope |

### P1 — Important

| # | File | Module | Finding | Fix | Difficulty |
|---|---|---|---|---|---|
| P1-1 | `server/repairs.ts:594-612`, `server/index.ts:4642` | repair parts | Parts never decrement stock / write movements | Deduct + movement in same tx as part add | Med |
| P1-2 | `server/index.ts:4290-4322` | serials | Check-then-UPDATE serial sale TOCTOU (double-sell) | Atomic `UPDATE … WHERE status='in_stock'`, verify rowCount | Med |
| P1-3 | `server/index.ts:5104-5109`, `db.ts:2553` | quote status | Customer can flip any quote status (no ownership check) | Verify `quote.customerId === req.customer.sub` | Low |
| P1-4 | `server/auth.ts:62-312` | auth | No refresh/revocation/logout; coarse middlewares trust JWT role; POS print emits full 24h JWT in URL | `jti`+denylist, server logout, DB role re-check, ≤5m purpose-scoped tokens for tabs | Med-High |
| P1-5 | `server/index.ts:6055` | WhatsApp webhook | HMAC check skips when header missing; no replay protection | Require + verify signature; timestamp replay window | Low |
| P1-6 | `control-plane/server/db.ts:124,202-204,248-249` | CP secrets at rest | All plaintext (Neon URIs, cp_secret, admin pass, SMTP/Cloudinary, TOTP, api keys) | Encrypt at rest; least-privilege DB roles | Med |
| P1-7 | `control-plane/server/provision.ts:493-547` (`.catch` index.ts:501) | provisioning | No rollback of partially-created resources on failure | Reverse-order cleanup | Med |
| P1-8 | `control-plane/server/index.ts:1443` | plan sync-up | One tenant's cp_secret can push plans fleet-wide | Whitelist/approval + rate limit + origin validation | Med |
| P1-9 | `server/db.ts:3151-3158,2606-2610` + 2890 | numbering | `COUNT+1` invoice numbers collide; order list N+1 unpaginated | Dedicated sequences; pagination | Med |
| P1-10 | `server/db.ts:719,1111-1118` | stock truth | `products.stock_on_hand` split-truth, randomly seeded | Consolidate on `stock_levels`; derive/remove | Hard |
| P1-11 | `server/index.ts:2471-2484`, `db.ts:2900` | cancel/refund | Cancelled/refunded serials stay `sold` (permanently unsellable); no stock restore on refund | Reverse on cancel/refund atomically | Med |
| P1-12 | `.github/workflows/deploy-test.yml`, `deploy-all-clients.yml` | CI | No typecheck/lint/test/build anywhere; `exit 0` false-green on missing secrets | CI gate matrix; fail clearly when unconfigured | Low |
| P1-13 | schema (`orders.coupon_id`, `gift_card_id`, `group_id`, etc.) | FKs | Missing FKs (see §3 list) | Add declarative FKs | Easy |
| P1-14 | `server/db.ts:3160` etc. | financial ledger | No `financial_transactions`/`payments` table; `coupon_usage` dead | Introduce ledger integrated with checkout/callback/refund paths | Hard |

### P2 — Improvement

| # | Finding | Fix | Difficulty |
|---|---|---|---|
| P2-1 | Unpaginated+N+1 orders/customers/repairs lists; serials 500-cap | Keyset/offset paging + eager loads | Med |
| P2-2 | POS ops reachable by any staff incl. cancel/pay arbitrary order; POS receipt exposes KRA/eTIMS/PII for any order | Per-route `requirePermission` + branch/ownership scope | Med |
| P2-3 | Repair writes bypass permission layer | `requirePermission("repair:*")` | Low |
| P2-4 | WhatsApp media `GET /api/whatsapp/media/:id` unauthenticated, sequential ids | Auth + ownership | Low |
| P2-5 | Missing indexes: `orders(status)`, `orders(branch_id)`, `order_items(product_id)`, `stock_*(branch_id)`, `serial_numbers(order_id)`, `repair_parts_used(ticket_id)` | Add indexes | Easy |
| P2-6 | `stock_movements.movement_type` free text | CHECK constraint/lookup | Easy |
| P2-7 | `audit_log` sparse (no price-change/stock/settings/quote coverage); no central hook | Trigger/central write hook on all mutating ops | Med |
| P2-8 | Two invoice concepts + eTIMS duplicate + plaintext `order_items.serial_number TEXT` | Consolidate/reconcile | Med |
| P2-9 | No structured logs / request-IDs / latency metrics / webhook-payment logs | Structured logging + `gl_` correlation IDs | Med |
| P2-10 | GetOrder `listOrders` full-table fetch in provider path | SQL-scope | Low |
| P2-11 | Deploy log missing commit for `redeploy`; no rollback-to-commit | Capture SHA; expose redeploy-at-SHA | Med |

### P3 — Optional / Future

- `P3-1` Refresh-token rotation & session store (P1-4 + long-term arc).
- `P3-2` Tenant health score (availability, API errors, DB health, storage, backup age, deploy status, failed jobs, webhook failures) per §21.
- `P3-3` Backup restore verification pipeline (temp DB → restore → integrity → report → drop).
- `P3-4` `financial_transactions` ledger semantics (types SALE/PAYMENT/REFUND/CREDIT_NOTE/GIFT_CARD_ISSUE/REDEMPTION/SUBSCRIPTION_PAYMENT/ADJUSTMENT, direction, external_reference, idempotency_key).
- `P3-5` Feature-flag table (plan-level flags + tenant overrides + audit) replacing scattered `plan ===` checks.
- `P3-6` `warranties`/`warranty_claims`/`warranty_claim_events` domain (P3 if P1-3 done differently; actually targets Phase 4).
- `P3-7` `assets/devices` first-class model (customer→asset→serial→purchase→warranty→service history).
- `P3-8` Canary/gradual rollout; DISASTER_RECOVERY.md with RTO/RPO.

---

## 17. Recommended Phase Roadmap (do not start yet — confirm with owner)

- **Phase 1 — P0 security/correctness:** CP roles+secret handling (P0-1..4), Cloudinary/WhatsApp secret rotation (P0-10), provider IDOR (P0-11), callback auth+idempotency (P0-6), stock/refund/gift-card atomicity (P0-7,8), quote IDOR (P1-3), repair parts → stock (P1-1), serial atomicity (P1-2), CI gate (P1-12). Plus the automated isolation test suite (§5).
- **Phase 2 — Database hardening:** versioned migrations + `schema_meta` (P0-12), money `numeric(12,2)` (P0-5), FK/cascade fixes (P0-9, P1-13), indexes (P2-5,6).
- **Phase 3 — Financial & inventory integrity:** `financial_transactions` ledger (P1-14,P3-4), movement-ledger consolidation (P1-10,P0-7), pagination (P2-1).
- **Phase 4 — Service/asset architecture:** warranties/warranty_claims/events + repair-warranty integration (P3-6,P1-1), assets/devices (P3-7), eTIMS real submission (P0-13).
- **Phase 5 — Automated testing:** unit/API/DB/security/E2E per §11 + §4 isolation matrix.
- **Phase 6 — Observability/DR:** structured logs + correlation IDs (P2-9), health score (P3-2), backup restore pipeline (P3-3), DISASTER_RECOVERY.md (P3-8).
- **Phase 7 — UX/performance polish:** pagination UX, empty/loading/error states, magic-link repair (P2-…).
- **Phase 8 — Production readiness review:** gate against §35 checklist.

---

## 18. Source Audit Files

Detailed per-domain findings (written by the audit, kept for reference):
- `01_tenancy_auth_authz.md` — tenancy/auth/JWT/roles/IDOR/query-token analysis (report §4/5)
- `02_database_schema.md` — schema/money/migrations/integrity (report §3)
- `03_finance_inventory_payments.md` — money math, callbacks, stock races, refunds, ledger (report §7/8)
- `04_repairs_warranty_assets_upload_webhooks.md` — repairs, warranty, serials, uploads, webhooks (report §9/10)
- `05_control_plane.md` — CP authn/authz, secrets, provisioning, backups, health, billing (report §6)
- `06_frontend_cicd_testing_observability.md` — frontend tokens, UI/UX, CI/CD, tests, logging (report §11-15)