# PRODUCTION_READINESS.md

**Consolidated production-readiness plan for Gears&Glitch.** Phase 0 audit snapshot; defines the path to `SECURE · RELIABLE · CONSISTENT · TESTABLE · AUDITABLE · RECOVERABLE · TRUSTWORTHY`. **Nothing here is implemented yet** — all items are pending approval following the priority order and Change-Safety Protocol.

---

## Executive summary

The platform is feature-rich and largely functional, with **strong foundations** (parameterized SQL, per-tenant DB isolation, idempotent money paths, redacted secrets, generic error responses, CI+build green). The blockers to production readiness concentrate in **four P0 areas**:

1. **Control-plane tenant isolation** — a tenant `client` role can reach cross-tenant/global/stateful endpoints (read all clients, audit, infra secrets; provision & modify other tenants; generate invoices). **(P0)**
2. **Financial/inventory integrity** — all money is floating-point, and several stock operations are READ→WRITE races that silently lose inventory or allow phantom sales. **(P0)**
3. **Feature-model gaps** — `warranty_claims`, `customer_assets`, `service_history` do not exist; repair status transitions are unenforced. **(P0/P1)**
4. **Operations** — no automated backups/restore, no versioned migrations, no rate limiting on the control plane, single-source administrative secret. **(P1)**

Everything else is P1–P3 refinement (routing/dead links, a11y, responsive tables, performance/SSR, testing).

---

## Current state score summary (see PRODUCTION_SCORECARD.md for detail)

Strong: Authentication (moderate), Authorization (partial), Isolation (architecturally good, CP gap), Payments (M-Pesa idempotency good), Serialization (good), Deployment (good). Weak: Money representation, Migrations, Testing/Observability/Backups, Warranty/Claims, Service History, Accessibility, Performance (storefront SSR).

---

## Remediation workstreams (in recommended order)

### WS-1 · Control-plane security & tenant isolation (P0) — approval-gated
1. Enforce `requireAdmin` on all cross-tenant/global/stateful routes; give `client` role only scoped endpoints.
2. Per-user scoped API keys with roles; remove shared-global-key→admin path and the `?key=` query path.
3. Two-step/soft client deletion (no irreversible teardown without explicit confirm).
4. `pg_dump` via `spawn` argument array (remove shell interpolation / RCE).
5. Add `express-rate-limit` to control plane; verify SSL CA; stable `JWT_SECRET` (fail-fast if missing).

### WS-2 · Financial integrity (P0) — approval-gated (money representation)
1. Migrate all monetary columns to integer cents / `NUMERIC(12,2)`.
2. Compute money in integer cents / a decimal library (no JS float math on money).
3. Audit every SQL arithmetic/comparison on monetary columns + frontend `formatPrice` for consistency.

### WS-3 · Inventory integrity (P0)
1. Replace READ→WRITE stock updates with atomic guarded SQL: `UPDATE ... SET qty = qty - $1 WHERE product_id=$2 AND branch_id=$3 AND qty >= $1`.
2. Wrap POS checkout, `createOrder`, `convertQuoteToOrder`, `completeStockTransfer`, PO receive, credit-note, purchase-order creation in transactions.
3. Replace `GREATEST(...,0)` clamps with insufficient-stock guards that fail the operation.

### WS-4 · Repairs / Warranty / Customer assets (P0/P1)
1. Enforce repair `VALID_TRANSITIONS` map; add missing statuses (`awaiting_approval`, `approved`, `unrepairable`).
2. Build `warranty_claims`, `customer_assets`, `service_history` models + APIs + UI (do not fake in frontend).
3. Link repairs to serial/warranty; distinguish warranty vs paid repairs; persist technician-assignment history.
4. Move repair-part insert inside the stock transaction.

### WS-5 · Database & migrations (P1) — approval-gated for migration architecture
1. Versioned migration runner + fail-loud (replace boot-time ALTER loop).
2. Add indexes, FKs, `ON DELETE RESTRICT`; fix `stock_levels` unique `(product_id, branch_id)`.

### WS-6 · Payments & webhooks (P1)
1. Block M-Pesa `SIM` simulation in production; add POS idempotency; reconcile payment before confirming.
2. Add held-stock release/reconciliation job.
3. Authenticate WhatsApp media; validate eTIMS/webhook signatures + idempotency.

### WS-7 · Testing & observability (P1)
1. Tests: tenant isolation, authorization, payments/refunds, inventory concurrency, serials, repairs, warranties, subscriptions, webhooks, control-plane security.
2. HTTP route tests + link crawler (`npm run check:links`) added to CI.
3. Structured logging + awaited audit log on destructive CP actions.

### WS-8 · Backups & recovery (P1)
1. Scheduled off-site `pg_dump`/Neon point-in-time backups + retention.
2. Documented restore runbook + periodic restore test.

### WS-9 · Routing / API integrity (P1/P2)
1. Fix open-redirect in `login.tsx`; validate `/redirect=` against allow-list.
2. Fix dead `order=` deep-link in admin; wire dead amazon/jumia search buttons or remove them.
3. Constrain/validate admin-config-driven links (footer, Storefront Builder, hero, splashes) to the route allow-list.
4. Add automated API-surface check in CI.

### WS-10 · Frontend: performance, accessibility, responsive (P2)
1. SSR/SSG/ISR for storefront home + category listings; add image dimensions / `next/image`.
2. Wrap storefront tables in `.table-wrap`; DataTable keyboard a11y + `aria-sort`/`scope`.
3. Code-split admin; POS server-side search; pause M-Pesa polling when hidden.
4. Modal `inert` + heading hierarchy; darken low-contrast header text.

---

## Go/No-Go gate (FINAL_VALIDATION)

Before declaring production-ready, run:
- **lint** + **typecheck** (server, control plane, frontend)
- **unit** + **integration** + **E2E** tests (add the new suites in WS-7)
- **production build** (frontend + backend + CP)
- **route** + **link** + **API** checks (`npm run check:links`, API-surface check)
- Then: **SECURITY / DATABASE / FINANCIAL / INVENTORY / TENANT / CONTROL-PLANE / ROUTE / MOBILE** reviews

Deployment/backup runbooks: see Deployment + Backup sections of `PRODUCTION_READINESS_AUDIT.md`.

---

## Approval gates (must pause and obtain approval)

- ✅ Money representation change (§/WS-2)
- ✅ Database migrations architecture (§/WS-5)
- ✅ Control-plane permissions/tenant architecture (§/WS-1)
- ✅ Secrets architecture; deployment infrastructure
- ✅ Payment architecture

No high-risk architectural change may be made without approval, per the brief.
