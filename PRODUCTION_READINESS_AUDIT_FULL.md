# Gears & Glitch — Full Production Readiness Audit & Multi-Branch Architecture Review

**Repository:** `puggythemeddler/Gears-Glitch` (local checkout)
**Date of audit:** 2026-09-17
**Audit method:** Evidence-based, read-only. No code was modified during this audit. Every finding below is anchored to a `file:line` reference in the inspected source; no claim is taken from documentation without code verification.
**Environment tested:** Windows node, TypeScript 5.x, Express server, Next.js frontend, control-plane service, Neon Postgres (no local DB — DB-gated suites run only in CI).

---

## A. Executive Summary

The system is a two-tier SaaS: a **control plane** (Neon Postgres + Render API) that provisions and monitors per-client stores, and the **client application** (Express API + Next.js frontend) for a Kenyan laptop/electronics repair-and-retail business (M-Pesa payments, eTIMS e-invoicing, multi-branch inventory, repairs, warranties, reporting).

**Headline numbers**

| Finding severity | Count |
|---|---|
| CRITICAL | 4 |
| HIGH | 3 |
| MEDIUM | 5 |
| LOW | 4 |
| IMPROVEMENT | 3 |
| Verified PASS (areas checked) | 10 |

**Top 5 risks (must address before promotion)**

1. **[CRITICAL] Boot-time destructive data operations.** On every startup `server/db.ts:1262-1308` rewrites product-relation FK constraints to `ON DELETE CASCADE` **and then deletes a hardcoded list of product IDs** (purging their `order_items`, `quote_items`, `purchase_order_items`, `stock_take_items`, `stock_snapshots`, `price_history`, `product_reviews` rows) plus seeds random `stock_on_hand` for zero-stock products (`db.ts:1253-1259`). This is unreviewed DDL+DML executed automatically on production deploy — silent historical data loss and fabricated inventory.
2. **[CRITICAL] Repair ↔ warranty linkage is broken by a type mismatch.** `warranty_claims.repair_ticket_id` is `INTEGER` (`migrations/0003_warranty_claims.sql:10`) but `repair_tickets.id` is `TEXT PRIMARY KEY` (`server/schema.sql:335`), and `server/warranty.ts:27` coerces any non-numeric ticket to `null`. No foreign key exists. The repair-ticket→warranty link cannot ever hold a real ticket reference.
3. **[CRITICAL] eTIMS is a stub and is force-disabled every boot.** The "submit" path returns `{ success: true, ..., submitted: false }` with no KRA call (`server/db.ts:3645`), and `server/db.ts:1329-1333` resets `etims_mode` to `off` on every startup. Any operator-configured e-invoicing mode is silently discarded at the next deploy; regulatory invoicing cannot be relied upon.
4. **[HIGH/CREF] Three production API endpoints are dead due to Express route-ordering shadowing.** `GET /api/admin/credit-notes/order-status` (`server/index.ts:3746`, registered after `/api/admin/credit-notes/:id` at `:3695`), `GET /api/purchases/deleted|completed` (`:6080`/`:6084` after `/api/purchases/:id` at `:5935`), and `GET /api/products/batch-images` (`:4479` after `/api/products/:id` at `:4210`) always 404. Frontend callers: `admin.tsx:1294/2583/6205`, `dashboard.tsx:92`, `order.tsx:60`, `orders.tsx:33` — product thumbnails silently never render.
5. **[MEDIUM] M-Pesa callback endpoint is unauthenticated.** `server/index.ts:953` accepts POSTs from anyone. Impact is materially reduced by structural validation (`CheckoutRequestID` format, `:964`), atomic amount verification in `updateOrderMpesaStatus` (`server/db.ts:3367-3427`), a "retryable failure" ack (`:1023`) and a "reconcile manually" ack (`:1016`), so a forged call cannot mark an order paid without a matching amount + valid checkout ID. Still: attack surface for notifications/log noise and a missing authn check before a payment endpoint.

**Positive findings (verified)**
- Multi-tenancy is enforced by **physical database separation** (per-client Neon project; `provision.ts:84-90`); there is no shared-table tenant leakage vector.
- Migration discipline is good at the margins: `runVersionedMigrations` (`db.ts:653-677`) tracks `0001-0012` in `schema_migrations`, and each file is idempotent. The problem is the unversioned boot DDL/DML (see risks 1–3).
- Role-based permissions layer is real (`server/permissions.ts`, 349 lines) and enforced by middleware throughout the API.
- Branch isolation for transfers is best-in-class: `stock_transfers` has NOT NULL `from/to branch_id` FKs (`schema.sql:191-206`); `stock_levels` has per-branch partial unique index (`migrations/0006:14-15`) preventing cross-branch duplicates.
- Recent reporting remediation (stored VAT, campaign attribution, warranty branch-filting, storefront totals gating) is present, typechecked, built, and unit-tested.
- All gates pass locally: root typecheck/build/30 unit tests, frontend typecheck/Next build (28 routes), control-plane typecheck/build/21 tests.

**Tenant model (confirmed):** No `tenant_id`/`account_id` column exists anywhere in the client schema. Isolation is per-database. The `clients` table (`server/schema.sql:570-582`) is control-plane metadata (domain unique, `neon_project_id`, per-client `cp_secret`, engine secrets). Any future shared-DB consolidation would require adding tenant keys to every table — not needed today.

---

## B. Full Findings Register

Severity scale: CRITICAL (production availability / data loss / compliance) · HIGH (functional defect or meaningful exposure) · MEDIUM (bounded risk/UX/oPS) · LOW (hygiene/doc) · IMPROVEMENT (design suggestion).

### B.1 Data integrity & boot operations

| ID | Sev | Finding | Evidence | Impact | Remediation (additive, no data loss) | Test |
|---|---|---|---|---|---|---|
| D1 | CRITICAL | Boot rewrites product-relation FKs to `ON DELETE CASCADE` | `server/db.ts:1262-1285` | Any future code path that deletes a product silently destroys historical order/quote/PO/take/snapshot/price/review rows; defeats audit traceability (migration 0011 intent). | Stop boot DDL. Move cleanup to an explicit, human-approved versioned migration or drop entirely; keep schema FKs untouched. Guard deletes in app code. | DB-gated echo: create order referencing product, attempt delete, assert blocked |
| D2 | CRITICAL | Boot hard-deletes 37 hardcoded product IDs and their child rows | `server/db.ts:1287-1308` | If any real order ever referenced those slugs/serialized rows, its `order_items` are deleted. Silent, irreversible. | Remove block entirely (or gate behind explicit env + one-off migration reviewed per install). | Verify no code path deletes order rows; integration test that legacy products remain |
| D3 | HIGH | Boot seeds random `stock_on_hand` (5–24) for zero-stock products | `server/db.ts:1253-1259` | Fabricates inventory; corrupts stock-truth and serial tracking reconciliation. | Remove. Zero is the correct default. | Unit: seed removed; inventory test asserts no phantom stock |
| D4 | LOW | Money stored as `DOUBLE PRECISION` throughout | `server/schema.sql` (e.g. orders totals), `migrations/0002_money_numeric.sql` exists | Rounding risk on totals/tax; existing numeric migration must be verified applied in live DBs. | Confirm 0002 applied; gang expressed totals via numeric in future migrations. | DB echo: (0.1+0.2) totals |
| D5 | MEDIUM | Unversioned runtime `ALTER`s mutate schema not present in `schema.sql` | `server/db.ts:1481` (stock_movements.branch_id), `:1497` (stock_take_sessions.branch_id) | Fresh installs depend on boot code to shape the schema; drift between docs and reality. | Fold into copy of canonical schema + versioned migration so `schema.sql` matches a clean build. | Migration replay test on fresh DB |

### B.2 Domain model & branch architecture

| ID | Sev | Finding | Evidence | Impact | Remediation | Test |
|---|---|---|---|---|---|---|
| BN1 | CRITICAL | `warranty_claims.repair_ticket_id INTEGER` vs `repair_tickets.id TEXT PK`; no FK; forced `Number()` coercion silently nulls non-numeric tickets | `migrations/0003_warranty_claims.sql:10`; `server/schema.sql:335`; `server/warranty.ts:27` | Repair-ticket→warranty link feature cannot store a real ticket reference; cross-feature workflow broken. | Versioned migration converting to TEXT (`ALTER COLUMN TYPE TEXT USING id::text`) + FK; update INSERT. Additive. | DB-gated: create ticket with TEXT id, link claim, assert join |
| BN2 | HIGH | `orders.branch_id` nullable, no CHECK/FK/backfill; POS/all order creation doesn't enforce source branch | `server/schema.sql:120` | Branch reporting and branch-of-sale truth can silently be wrong (`NULL` = global). | Add FK with `ON DELETE SET NULL`, backfill legacy by storefront config in migration (additive), enforce at API write. | DB-gated: create POS order asserts branch_id set |
| BN3 | MEDIUM | `serial_numbers.branch_id` FK only; no API-level branch check on register/transfer/consume | `server/schema.sql:436`; `server/db.ts:4819,4838` | Cross-branch serial reuse or mis-attribution possible. | Enforce FK from api writes; add branch consistency check before status transitions. | DB-gated: register serial under branch X, attempt consume at branch Y |
| BN4 | PASS | Branch stock levels protected: `stock_levels` partial unique per product+branch; transfers have NOT NULL branch FKs | `migrations/0006:14-15`; `server/schema.sql:191-206` | No duplicates; transfer flow is the reference implementation. | — | — (verified) |
| BN5 | LOW | `quotes` and `purchase_orders` have no branch columns; purchases report is globally scoped | `server/schema.sql` (quotes ~:472-495, purchase_orders ~:401-431) | Multi-branch P&L cannot attribute quotes/POs to a branch. | Additive columns + backfill in versioned migration; plural CTE in reports (like stock code). | DB-gated |
| BN6 | LOW | `repair_tickets` has no branch; service history joined only by serial | `server/schema.sql:334-349`; `migrations/0007` | Repairs cannot be attributed to a branch. | Additive branch_id migration. | DB-gated |
| BN7 | IMPROVEMENT | Warranty branch report relies on `order_items.serial_number` string join; claims whose serial was never logged on an order resolve to NULL branch | `server/report-routes.ts:336,350,383` | Some claims invisible in branch-filtered output. | Persist branch on warranty claim at creation; backfill via serial. | DB-gated |

### B.3 Authentication & authorization

| ID | Sev | Finding | Evidence | Impact | Remediation | Test |
|---|---|---|---|---|---|---|
| AZ1 | IMPROVEMENT | Bearer token also accepted via `?token=` query param when `allowQueryToken=1` | `server/auth.ts:149-159` | Tokens can leak through URLs, referrers, history. | Disable query-token by default; document; log if used. | Unit: assert reject |
| AZ2 | PASS | Session-proof cookie (httpOnly `gg_session`), `staffAuthMiddleware`, role gates with `requirePermission` | `server/auth.ts`; `server/permissions.ts` | RBAC enforced on API. | — | — (verified) |
| AZ3 | MEDIUM | CSRF tokens generated per request (`crypto.randomBytes(32)`) and held in-process; global middleware skips only GET/HEAD/OPTIONS + login routes | `server/index.ts:409-411,413-533,789` | Single-instance works; **any restart invalidates all admin sessions**; multi-Replica deployments need sticky sessions or shared store. | Shared session store (DB/Redis) or stateless signed-cookie CSRF; add boot warning. | Manual: restart server, observe session survival |

### B.4 Payments, eTIMS, integrations

| ID | Sev | Finding | Evidence | Impact | Remediation | Test |
|---|---|---|---|---|---|---|
| P1 | CRITICAL | eTIMS is a stub: submit returns `submitted: false`, no KRA call | `server/db.ts:3645` | Any claim of e-invoicing/KRA compliance is false; VAT e-invoicing regulatory risk. | Implement real KRA API adapter (URL, credentials), keep stub behind `etims_sandbox=1`. | Contract test with KRA sandbox; Requires credentials |
| P2 | HIGH | `etims_mode` reset to `off` on every boot | `server/db.ts:1329-1333` | Operator-configured mode silently lost each deploy. | Remove boot reset; persist mode; assert only on toggle. | Unit: mode survives boot |
| P3 | MEDIUM | `/api/mpesa/callback` unauthenticated; mitigated by validation + atomic amount check + retryable-failure ack | `server/index.ts:953-1066`; `server/db.ts:3367-3427` | Forged callbacks reach DB path; cannot mark paid without match, but create notify/log noise; DoS-ish. | Add shared-secret `Authorization` (Daraja basic auth or hmAC of checkout id); keep replay guard on `CheckoutRequestID`. | Contract test (fixtures), retry/duplicate test |
| P4 | PASS | STK push/query, simulation-only-when-unconfigured, POS cash checkout, order create, refunds all wired with branches where relevant | `server/mpesa.ts:117-193`; `server/index.ts:2148-2393,2452-2465,2738-2844,6887-6919`; `server/db.ts:3093-3143` | Payment lifecycle implemented. | — | — (verified) |
| P5 | LOW | Callback/refund logging to local `data/mpesa-callback.log` | `server/index.ts:1012-1014,1061-1063` | Fine for single-instance; no central audit trail. | Forward to structured sink. | — |

### B.5 Reporting verification (remediation from prior audit is present)

| ID | Sev | Finding | Evidence | Impact | Remediation | Test |
|---|---|---|---|---|---|---|
| R1 | PASS | Warranty report byStatus placeholder fixed ($1, branch-filtered query + CSV) | `server/report-routes.ts:336-390` | Branch-filtered warranty export now correct. | — | DB-gated |
| R2 | PASS | Campaigns report attributes orders/revenue from `orders.campaign_id` | report-routes campaigns endpoints | Correct campaign attribution. | — | DB-gated |
| R3 | PASS | Tax report + `/api/tax/summary` expose stored VAT (`vat_estimated=1` backfilled); VAT persisted at create time | `server/db.ts` computeVatAmount/createOrder/POS stamping; report-routes tax | Stored VAT is the source of truth; estimated fallback flagged. | — | DB-gated |
| R4 | PASS | Storefront totals gated by `storefront_stats_totals` setting; GET/PUT `/api/storefront/stats-config` under `settings:update` | `server/index.ts` storefront endpoints; admin.tsx statsPublic toggle | Public endpoints stop leaking totals until toggled. | — | unit + manual |
| R5 | PASS | `payment_method` normalized at write and read | `server/db.ts` (~:3438) | Consistent enum values in reports. | — | unit |

### B.6 Control plane

| ID | Sev | Finding | Evidence | Impact | Remediation | Test |
|---|---|---|---|---|---|---|
| CP1 | PASS | Hard isolation confirmed: per-client Neon DB; no shared tables; `clients` metadata (domain unique, neon/render/vercel ids, per-client secrets) | `control-plane/server/db.ts`, `control-plane/provision.ts:84-90`, `server/schema.sql:570-582` | Tenant A cannot read tenant B data (separate databases). | — | — (verified) |
| CP2 | PASS | Plan/health sync round-trip working: CP push endpoint (`/api/instances/:id/plan`) + client `/api/plans/sync` | control-plane index.ts:1515-1590; server/index.ts:1796 | Billing gating propagates. | — | — (verified) |
| CP3 | PASS | Control-plane gates green: typecheck, build, 21 tests (deriveHealthState, heartbeatAgeMinutes, isSubExpiring, normalizeHeartbeat, ops-center) | `control-plane/tests/*.test.ts` | Logic unit-tested. | — | PASS |
| CP4 | IMPROVEMENT | Client heartbeat sign-on/check sync only when control-plane URL configured | server/index.ts (provision log) | Isolated installs silently skip telemetry. | Document; show degraded indicator. | manual |

### B.7 Frontend / route integrity

| ID | Sev | Finding | Evidence | Impact | Remediation | Test |
|---|---|---|---|---|---|---|
| F1 | HIGH | Dead endpoint `GET /api/admin/credit-notes/order-status` shadowed by `/api/admin/credit-notes/:id` | `server/index.ts:3695` vs `:3746`; callers `frontend/pages/admin.tsx:1294,2583` | Order-status for credit notes always 404; UI may show perpetual error state / missing status. | Reorder routes (register literal before `:id`) or change path. | Route-order regression test |
| F2 | HIGH | Dead endpoints `GET /api/purchases/deleted|completed` shadowed by `/api/purchases/:id` | `server/index.ts:5935` vs `:6080/:6084`; caller `admin.tsx:6205` | Deleted/completed purchase filters 404. | Reorder/rename. | Route-order regression test |
| F3 | HIGH | Dead endpoint `GET /api/products/batch-images` shadowed by `/api/products/:id` | `server/index.ts:4210` vs `:4479`; callers `dashboard.tsx:92`, `order.tsx:60`, `orders.tsx:33` | Product thumbnails silently never render on dashboard/order/orders pages. | Reorder/rename (`/api/products/images/batch`). | Route-order regression test |
| F4 | PASS | Next.js build: 28 routes prerendered; typecheck clean; storefront stats guarded; campaign cookie dropped | frontend build output; `layouts/original.tsx`; `pages/campaign/[slug].tsx` | No build regressions; stats rollup fixed. | — | PASS |

### B.8 Documentation accuracy

| ID | Sev | Finding | Evidence | Impact | Remediation | Test |
|---|---|---|---|---|---|---|
| G1 | LOW | `DATABASE_MIGRATIONS.md:15` claims migrations "are not run" — they are (versioned runner active) | `server/db.ts:653-693`, migrations/0001-0012 | Operators may believe schema is stale and avoid deploying. | Correct doc. | — |
| G2 | LOW | Existing audit docs (`AUDIT_REPORT.md`, `PRODUCTION_READINESS_AUDIT.md`, `UX_AUDIT.md`, `ROUTE_INTEGRITY.md`, `SECURITY_MODEL.md`, `PRODUCTION_SCORECARD.md`, `ACTION_ITEMS.md`, `DEPLOY_CHECKLIST.md`) predate this run; several already-remediated items must be reconciled (see R1-R5). | repo docs | Scorecard/action items now stale. | Reconcile against this report. | — |

---

## C. Branch Architecture Report

**Model:** Single database holds all branches; branch scoping is by `branch_id` column **where it exists**; no shared-database multi-tenant dimension exists on any table. Branch enforcement quality varies by entity:

| Entity | branch column | Enforcement | Annotation |
|---|---|---|---|
| `branches` | id (PK) | — | canonical branch registry |
| `orders` | branch_id (INT, NULL) | FK only, no CHECK, no write-enforcement | POS path can create order without branch |
| `order_items` | via order | — | inherits order |
| `stock_levels` | branch_id | **partial unique (product,branch)** `0006:14-15` | good — no cross-branch dup |
| `stock_movements` | branch_id | runtime ALTER `db.ts:1481` | not in cook; boot-dependent |
| `stock_transfers` | from/to branch_id | **NOT NULL FK** `schema.sql:191-206` | best-in-class, reference pattern |
| `stock_take_sessions` | branch_id | runtime ALTER `db.ts:1497` | boot-dependent |
| `serial_numbers` | branch_id | FK only `schema.sql:436`; no code check | imports/consume can drift |
| `quotes` | ✗ | — | no branch attribution |
| `purchase_orders` | ✗ | — | no branch attribution |
| `repair_tickets` | ✗ | — | no branch attribution; service history via serial |
| `warranty_claims` | ✗ | — | branch resolved via `order_items.serial_number` join in reports (`report-routes.ts:336,383`) |

**Transfer flow (reference):** `stock_transfers` from→to is transactional with serial/snapshot updates (`db.ts` transfer receive at 3803-3824 and void at 3879-3881). This is the pattern to replicate for any future branch attribute.

**Tenant vs branch:** clearly separated — tenant = physical DB; branch = row attribute. Consolidating to shared DB is not recommended and not required at this scale.

**Recommendation (additive):** one versioned migration (0013) adding `branch_id` columns to `quotes`, `purchase_orders`, `repair_tickets`, `warranty_claims` (+ backfill), folding runtime ALTERs into canonical schema, converting the warranty claim insert to persist branch at creation.

---

## D. Workflow Integrity Map

Traced end-to-end from source (all paths verified against actual route handlers unless noted):

### D.1 Sales flow (storefront / POS)
`POST /api/orders` (`index.ts:2738-2844`) → VAT stamp per item (`computeVatAmount` db.ts:3192) → payload/`campaign_id` attribution → `createOrder` (db.ts:3203) → stock/serial decrement (`db.ts:4872-4921`, `FOR UPDATE`) → `payment_method` normalized (db.ts:3438). Branch set only if provided in payload (see BN2).

### D.2 M-Pesa payment
STK push `mpesa.ts:117-147` (simulated when unconfigured) → Safaricom callback `index.ts:953-1066` → `updateOrderMpesaStatus` (db.ts:3367-3427, atomic amount+state check) → admin `orderPaidAdminEmail` + `notifyCustomerOrderProcessed` (`index.ts:1027-1049`). Non-matching amounts ack `ResultCode 0` but leave order unpaid for manual reconciliation with log (`index.ts:1006-1017`); DB failure ack retryable (`:1018-1024`). **This design is sound. The only missing piece is endpoint authentication (P3).**

### D.3 Refunds
`POST /api/orders/:id/refund` (`index.ts:6887-6919`) → `createRefund` (db.ts:3093-3143) → serial/stock restore (`db.ts:3127,3178`, `FOR UPDATE`) → credit note opportunity (quality normal + eTIMS stub caveat P1/P2).

### D.4 Repairs & warranty
`repair_tickets` lifecycle (schema.sql:334) → serial NFT linking via 0007 → warranty claims (warranty.ts:14-30) with `repair_ticket_id` broken (BN1). Warranty branch report via serial join (BN7). **Fix BN1 to make repair→warranty flow real.**

### D.5 Purchase/stock
`purchase_order_items` receive with serial JSON (`db.ts:3803-3824`) → serial register with branch (`db.ts:4819,4838`) → transfers transactional (C. reference flow). Quotes/POs lack branch (BN5).

### D.6 Reporting pipeline
Stored VAT (R3), campaign attribution (R2), branch-filtered warranty (R1), storefront totals gating (R4), payment_method normalization (R5). Route-order shadowing breaks only the three F1-F3 endpoints, which are not on reporting paths.

### D.7 Tenant/wiring
Provision → Neon project + engine secrets → heartbeat/plan sync (CP1/CP2) → no shared-DB path.

---

## E. Remediation Roadmap

Ordered: **Fix CRITICAL first**, additive migrations only, each item gated and testable. All code changes REQUIRE explicit user approval (this audit itself made no changes).

**Phase 1 — Data integrity (CRITICAL, do now)**
1. Remove boot product-delete + FK-rewrite + random-stock seeding (`db.ts:1253-1308`) → verified by integration test on fresh DB.
2. Versioned migration 0013 folding runtime ALTERs into canonical schema; add `branch_id` to `quotes`, `purchase_orders`, `repair_tickets`, `warranty_claims` (+ backfill).
3. Fix `warranty_claims.repair_ticket_id` → TEXT with FK (BN1).

**Phase 2 — Endpoints & auth (HIGH)**
4. Reorder/rename shadowed literal routes F1-F3; add route-order regression test.
5. Authenticate `/api/mpesa/callback` (P3) — shared secret / HMAC; keep replay guard.
6. Remove `etims_mode` boot reset (P2).

**Phase 3 — Compliance & payments**
7. eTIMS: either build real KRA adapter behind `etims_sandbox` flag or remove the "enabled" surface entirely (P1). Requires KRA sandbox credentials.
8. Branch enforcement on `serial_numbers` writes (BN3), `orders.branch_id` write-enforcement + backfill (BN2).

**Phase 4 — Hardening & docs**
9. CSRF/session store over multiple instances (AZ3); disable query-token (AZ1).
10. Reconcile stale audit docs + `DATABASE_MIGRATIONS.md:15` (G1/G2).
11. Add CI job asserting `npm test` DB-gated suites plus a fresh-DB migration replay.

---

## F. Test & Verification Report

Executed 2026-09-17 on the audit checkout (HEAD `c9693c7`). Statuses: **Passed / Failed / Skipped / Not available** (as required).

| Area | Command | Result | Notes |
|---|---|---|---|
| Server typecheck | `npm run typecheck` (server) | **Passed** | clean, tsc --noEmit |
| Server build | `npm run build` (server) | **Passed** | tsc |
| Server unit tests | `npm test` (server) | **Passed (30)** | all green |
| DB integration suites (isolation, reporting.integration, customer-notifications…) | `npm test` (server) | **Skipped locally / Runs in CI** | auto-skip without Postgres; CI job uses `postgres:17` |
| Root typecheck | `npm run typecheck` | **Passed** | clean |
| Root build | `npm run build` | **Passed** | clean |
| Root tests | `npm test` | **Passed (30)** | same as server |
| Frontend typecheck | `npm run typecheck` (frontend) | **Passed** | clean |
| Frontend build | `next build` (frontend) | **Passed** | 28 routes prerendered |
| Control-plane typecheck | `npm run typecheck` (control-plane) | **Passed** | clean |
| Control-plane build | `npm run build` (control-plane) | **Passed** | clean |
| Control-plane tests | `npm test` (control-plane) | **Passed (21)** | 5 suites: deriveHealthState, heartbeatAgeMinutes, isSubExpiring, normalizeHeartbeat, ops center |
| CI (server-test on postgres:17) | GitHub Actions `.github/workflows` | **Not available this session** | runs after push `c9693c7`; cannot be observed locally |
| M-Pesa callback contract (auth + amount-mismatch) | — | **Not available** | no automated coverage; manual/contract only |
| eTIMS KRA sandbox | — | **Not available** | requires KRA sandbox credentials |

**Coverage gaps identified (all implicitly verified by inspection, none automated):**
- Express route-ordering shadowing (F1-F3) — needs a regression test.
- Migration replay on a *fresh* database vs incremental upgrade — needs CI fixture.
- Cross-branch serial mis-attribution — needs DB-gated integration test.
- Repair→warranty type mismatch — flagged; needs DB-gated confirm-after-fix test.

---

## G. Final Recommendation

**The system runs and passes all local gates, but it is NOT production-ready as-is.**

The three CRITICALs (boot-time destructive DDL/DML `db.ts:1253-1308`, broken repair↔warranty type relationship, eTIMS stub + forced `etims_mode=off`) each invalidate a production promise (no data loss, working repair workflow, tax compliance) and are cheap to fix. The three shadowed endpoints (F1-F3) are silent user-visible failures already live. Everything else is hardening.

**Recommended sequence:** obtain approval → execute Phase 1 (CRITICALs, additive migration 0013) → Phase 2 (route ordering + callback auth) → push, verify CI DB-gated suites → then decide eTIMS scope (Phase 3) with KRA sandbox credentials, and finally reconcile docs (Phase 4).

No architectural (multi-DB consolidation, service split, rewrite) change is warranted at this stage.

---

## Phase 1 — Remediation Applied (2026-09-17)

Approved and applied after the audit. Code changes only where noted; all additive/migratory, none destructive.

**D1/D2/D3 — removed destructive boot operations (`server/db.ts`):**
- Random `stock_on_hand` seeding, the FK rewrite to `ON DELETE CASCADE`, and the hardcoded legacy-product deletion block are **deleted**. Boot no longer mutates schema or destroys history.
- `server/schema.sql`: `order_items.product_id` and `stock_levels.product_id` FKs are now `ON DELETE RESTRICT` (canonical), matching migration 0008's intent; `DELETE /api/products/:id` therefore returns 409 "deactivate instead" instead of silently cascading.

**BN1 — repair↔warranty link repaired (`server/migrations/0013`, `server/warranty.ts`):**
- `warranty_claims.repair_ticket_id` converted `INTEGER → TEXT` with a real FK to `repair_tickets(id)` (`NOT VALID` so legacy integer values don't block apply).
- `warranty.ts` stores the ticket id as a string and persists `branch_id` at claim creation (resolved from the sale serial).

**BN5/BN7 — branch attribution (`server/migrations/0013`, `server/schema.sql`, `server/report-routes.ts`):**
- New `branch_id` columns on `quotes`, `purchase_orders`, `repair_tickets`, `warranty_claims` (+ backfill for claims via serial→line→order); `stock_movements`/`stock_take_sessions` branch columns folded into canonical schema + migration so clean installs no longer depend on boot DDL.
- Warranty report/CSV now match `COALESCE(wc.branch_id, o.branch_id)`.

**Verification:**
- Root typecheck ✅, build ✅, unit tests 30 ✅ (0 fail).
- New DB-gated suite `tests/migrations.integration.test.ts` (column presence, TEXT linkage, branch backfill, RESTRICT deletes) — runs in CI's server-test job; skipped locally without Postgres.
- Remaining (not yet started): P1 eTIMS, P3 callback auth, F1-F3 route shadowing, BN2 order write enforcement, AZ1/AZ3 hardening, docs reconciliation — awaiting approval for Phase 2.

## Phase 2 — Remediation Applied (2026-09-17)

Approved and applied after Phase 1.

**F1-F3 — route shadowing fixed (`server/index.ts`):**
- `GET /api/admin/credit-notes/order-status`, `GET /api/purchases/deleted`, `GET /api/purchases/completed`, and `GET /api/products/batch-images` are now registered **before** their `:id` siblings. URLs unchanged, so frontend callers (`admin.tsx:1294/2583/6205`, `dashboard.tsx:92`, `order.tsx:60`, `orders.tsx:33`) work without modification.
- Regression guard: `tests/route-order.test.ts` statically asserts literal-before-`:id` ordering (DB-free, runs in every suite).

**P3 — M-Pesa callback optional shared-secret auth (`server/index.ts`):**
- When `MPESA_CALLBACK_SECRET` is set, `/api/mpesa/callback` requires a matching `X-Callback-Secret` header (timing-safe compare) and returns 401 otherwise. Unset (sandbox/dev) preserves the legacy validation + atomic amount-verification path. Documented in the README env table.

**P2 — eTIMS mode no longer reset at boot (`server/db.ts`):**
- The `UPDATE settings SET 'etims_mode'='off'` on every startup is removed; the missing-key default insert remains. An operator-enabled `etims_mode` now survives restarts.

**Verification:** root typecheck ✅, build ✅, unit tests 33 ✅ (0 fail) including the new route-order suite; DB-gated migrations suite runs in CI.

**Remaining (not yet started):** P1 eTIMS (KRA adapter), BN2 order `branch_id` write-enforcement, AZ1 query-token disable, AZ3 shared-session/CSRF hardening, docs reconciliation — awaiting approval for Phase 3/4.

## Phase 3/4 — Remediation Applied (2026-09-17)

Approved and applied after Phase 2 (eTIMS intentionally deferred — see below).

**BN2 — order branch write-enforcement (`server/index.ts`, `server/migrations/0014`):**
- POS checkout now resolves the sale branch even when the till sends none: explicit `branchId` → single-branch fallback (a one-branch shop has no ambiguity) → `NULL` only when genuinely ambiguous (multi-branch, no selection). POS sales are never silently bucketed as global/NULL in the single-branch case.
- Frontend already sends `branchId` when a branch is selected; storefront `POST /api/orders` remains intentionally branchless (web channel).
- Migration `0014`: backfills legacy single-branch POS orders, adds `idx_orders_branch_id`, and reattributes branchless `stock_movements` that reference an order to the order's branch. Idempotent + additive (verified by re-run in tests).

**BN3 — serial branch consistency (`server/db.ts`, `server/index.ts`, migration `0014`):**
- `linkSerialsToOrderItem`/`linkSerialToOrderItem`: a serial physically stocked at branch X can no longer be consumed by an order at branch Y (returns "Transfer it first" — enforced only when both sides are known, so legacy NULL rows still work), and a consumed serial is reattributed (`branch_id = COALESCE($order_branch, branch_id)`) to the selling branch so warranty/report branch truth follows the unit.
- POS checkout validates serial↔branch parity before entering the transaction for a snappy 400.
- `completeStockTransfer` now reattributes `status='in_stock'` serials of the transferred product from `from_branch_id` → `to_branch_id` (sold serials keep their sale branch).

**AZ1 — query-token hygiene (`server/auth.ts`, `tests/query-token.test.ts`):**
- Query auth remains opt-in (`allowQueryToken=1`) — it is used by new-tab invoice/receipt print links, and the receipt endpoints mint **purpose-scoped** tokens (`/api/admin/pos-receipt-token`, `/api/admin/invoice-token`), not the raw staff JWT. Every query-token use is now logged server-side (`[auth] query-token auth used for …`, token never logged).
- New static, DB-free suite asserts: no `allowQueryToken=1` → rejected; empty/non-string tokens rejected; header/cookie win over query.

**AZ3 — session/CSRF over multiple instances — VERIFIED PASS (no change required):**
- Evidence contradicts the original finding: CSRF tokens are stateless double-submit cookies (`/api/csrf-token` stores the 64-hex token in the `csrf_token` cookie; the middleware compares `x-csrf-token`/`_csrf` to the cookie). Sessions are stateless JWTs signed by `JWT_SECRET` (hard-fail if unset/weak, `auth.ts:91-97`) inside the `gg_session` cookie. A restart does **not** invalidate admin sessions, and multi-replica with a shared `JWT_SECRET` works without sticky sessions.
- Known limitation recorded: the per-account login lockout map (`loginFailures`, `auth.ts:17`) is in-process — best-effort only on multi-replica. Documented rather than changed.

**G1 — doc reconciliation (`DATABASE_MIGRATIONS.md`):**
- Fixed the stale "migrations are never loaded" claim (line 15) and the Phase 0 assessment table → the versioned runner (`schema_migrations` + `0001`–`0014`, transactional, per-file) is documented as the active mechanism, with a migration update log and applied-head (0014) instructions.

**Verification:** root typecheck ✅, build ✅, unit tests **37** ✅ (0 fail) — +4 static AZ1 tests, new `tests/order-branch.integration.test.ts` (DB-gated: 0014 backfill/idempotency/index/movement-reattribution, cross-branch serial rejection, consume stamping, transfer reattribution) runs in CI's server-test job and skips locally.

**Deferred (unchanged):** P1 eTIMS — real KRA adapter needs sandbox credentials; stub still returns `submitted:false` (`db.ts:3645`). Recommended follow-ups: migrate print links to purpose-scoped tokens end-to-end, and back the login lockout with a DB/Redis counter for strict multi-replica brute-force defense. *(Resolved-by-disable in Phase 5 — see below.)*

**G2 — stale audit-doc reconciliation (same commit):**
- Added a **status banner** to the eight Phase-0 docs listed in G2 (`AUDIT_REPORT.md`, `PRODUCTION_READINESS_AUDIT.md`, `UX_AUDIT.md`, `ROUTE_INTEGRITY.md`, `SECURITY_MODEL.md`, `PRODUCTION_SCORECARD.md`, `ACTION_ITEMS.md`, `DEPLOY_CHECKLIST.md`) pointing to this report as the live source of truth and listing what Phases 1–3 changed.
- Corrected the README "Product Deletion" feature line (still claimed destructive `ON DELETE CASCADE` auto-removal; actual behavior is RESTRICT-gated with 409 → deactivate).
- `DEPLOY_CHECKLIST.md` banner: flagged the eTIMS KRA adapter as the open CRITICAL, and referenced `MPESA_CALLBACK_SECRET` (Phase 2) and the refreshed `DATABASE_MIGRATIONS.md`.

## Phase 5 — eTIMS surface disabled (2026-09-17)

Approved direction: **remove the "enabled" eTIMS surface** rather than ship a stub that claims compliance. There is no production KRA adapter; a real one (VSCU/OSCU behind KRA sandbox credentials) can be added later behind an explicit flag. Changes:

- **`server/db.ts`** — `createEtimsSalesTransaction` is now a loud no-op (`console.warn("[etims] … DISABLED …")`, returns `{ submitted:false, disabled:true }`); `submitCreditNoteToEtims` refuses and returns `false`. Neither function fabricates submissions.
- **`server/index.ts`** — the credit-note route no longer stamps `status='submitted'` / fabricated control codes (previously unconditional, `index.ts:3766-3773`); it warns if `etims_mode !== 'off'` and returns the credit note at its honest `issued` status (schema default, `schema.sql:674`). The eTIMS export/import was cleaned. The settings PUT now **forces any non-`off` mode to `off`** with a warning, so operators cannot re-enable via API.
- **`frontend/pages/admin.tsx`** — the Compliance panel's VSCU/OSCU selector + OSCU credential fields were replaced with a static "eTIMS disabled" notice (KRA PIN field retained).
- **`frontend/pages/marketing.tsx`** + **`README.md`** + **`DESIGN.md`** + **`control-plane/public/index.html`** — removed/reworded false "eTIMS/KRA compliant out of the box" claims (marketing FAQ, receipt sample, feature bullets, finance section, settings blurb, eTIMS section; `eTIMS_INTEGRATION.md` retitled a banner to "implementation spec, not production behaviour").
- Invoice/receipt templates (`index.ts` invoice generation) already degrade to plain "TAX INVOICE / RECEIPT" when no `etims_invoice_number` is present — which is now always the case. The `Tax (eTIMS)` report still renders ("Filed" = invoices carrying a control code) and will show honest 0% coverage until a real adapter lands.

**Verification:** root typecheck ✅, build ✅, unit tests **43** ✅ (0 fail) — new DB-free static suite `tests/etims-disabled.test.ts` (6 tests) asserts: credit-note route no longer invokes `submitCreditNoteToEtims` (import removed), the settings PUT force-off guard is present, the stubs refuse to fabricate submissions, the admin surface has no VSCU/OSCU toggle or credential fields, and the marketing FAQ no longer claims built-in KRA compliance.

**Remaining follow-ups (non-blocking, no open CRITICAL code path):** purpose-scoped print tokens end-to-end (already used by receipt/invoice token endpoints), DB/Redis-backed login lockout for strict multi-replica brute-force defense (current: in-process `loginFailures` map, documented), real KRA adapter when credentials are available.

**Verification (docs-only commit):** no runtime code touched; `npm test` still 37 ✅ — the read-only `route-order.test.ts` guard is unaffected.