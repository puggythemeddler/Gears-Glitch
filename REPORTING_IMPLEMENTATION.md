# Reporting & Business Intelligence — Implementation

> Status: **Complete for Phases 1–6** (backend foundation + cost basis + sales-family rework + new client report endpoints + Reports hub rebuild + Control Plane platform report). Companion to `REPORTING_AUDIT.md`, which remains the source of the findings and the adopted rules. This document records what was actually changed.

## 1. What was built (by phase)

| Phase | Deliverable | Where | Commit |
|---|---|---|---|
| 0 | Gap audit | `REPORTING_AUDIT.md` | `5e4361e` |
| 1a | Shared foundation | `server/reporting.ts` + `tests/reporting.test.ts` (30 unit tests) | `b8f6470` |
| 1b | Product cost basis (schema, migration/backfill, native capture, privacy strip) | `server/schema.sql`, `server/db.ts`, `server/index.ts` | `b8f6470` |
| 2 | Sales-family endpoints reworked onto the foundation | `server/index.ts` | `e580ca5` |
| 3 | New client report endpoints (router) | `server/report-routes.ts` | `e73b14b` |
| 4 | Ecosystem report endpoints | `server/report-routes.ts` | `2b1cb48` |
| 5 | Admin Reports hub rebuild | `frontend/pages/admin.tsx` | `4578ae4` |
| 6 | Control Plane platform report | `control-plane/server/ops-routes.ts`, `control-plane/public/index.html` | `bf2f467` |

All backend routes sit behind the existing RBAC (`ownerAuthMiddleware` + `requirePermission("reports:view")`); CSV exports additionally require `requirePermission("reports:export")` — the permission that was previously defined but **never enforced** (audit finding §4).

## 2. Foundation (`server/reporting.ts`)

- **Dates**: `parseDateRange` (lexically-safe ISO validation, all-time fallback), `allTimeRange`, `lastNDays`, `previousPeriod` (current vs previous equivalent comparison window).
- **Single order-scope where builder**: `buildOrderWhere` (on the `orders` alias `o`; ignores absent filters; supports group, branch, staff, payment method, product, from/to).
- **Canonical revenue formula (used everywhere it matters)**:
  - Gross sales = Σ(non-cancelled `order_items.quantity × price`) + shipping, orders with status ≠ `cancelled`.
  - Net sales = Gross − discounts − gift-card redemptions − refunds.
- `salesTotals`, `salesSeries` (day/week/month), `salesBreakdown` (11 dimensions: product, category, group, branch, staff, payment method, customer, channel, hour, day-of-week, day), `salesComparison`.
- **CSV helpers** (`toCsv`/`sendCsv`): UTF-8 BOM, quote/escape, formula-injection guard (prefixes `'` on `= + - @`, tab, CR), Content-Disposition filename, UTF-8 charset.
- `REPORT_FORMULAS` (served at `/api/reports/definitions`) — every formula shipped with the API so the UI can show "how this is calculated".
- Branch- vs line-level attribution: line-level dimensions exclude shipping (shipping is branch-agnostic); order-level dimensions allocate shipping through a line item aggregate join so sums reconcile.

## 3. Cost basis (Phase 1b)

- Added nullable `products.cost_price` and `order_items.unit_cost` (additive; no existing data destroyed).
- `runMigrations` adds the columns idempotently and performs a **one-time backfill**: for each order item, average of `purchase_order_items.unit_cost` for the same product on POs received before the order was created, falling back to `products.cost_price`. Receipt timing uses `status='received'` + the `updated_at` bump (`COALESCE(NULLIF(po.updated_at,''), po.created_at)`) — there is no `received_at` column.
- **Native capture at all three order-item insert sites**: db.ts quote conversion, db.ts `createOrder` (with a `costMap` lookup), index.ts POS checkout.
- `createProduct`/`updateProduct` and the import/bulk-edit flows accept `costPrice`.
- **Privacy**: `publicProduct(p)` strips `costPrice` from public/provider-facing responses (`GET /api/products`, by-barcode, product detail, campaign payload, provider products). Cost data stays on the admin surface (`/api/stock`).

## 4. Sales-family rework (Phase 2)

Preserved existing `/api/reports/sales`, `/sales/trends`, `/employee-sales` shapes while upgrading underneath:

- Sales: now returns `totalOrders`, `grossRevenue`, `netSales`, discounts, giftCards, refunds, shipping, itemsSold, aov, per-method/per-channel/group/branch splits, comparison (`previous_period`), top products, orders in period.
- Trends: `granularity` (day/week/month) + branch filter; `revenue` = gross sales in period.
- Employee Sales: staff breakdown via `salesBreakdown("staff")`.
- New: `/api/reports/definitions`, `/api/reports/sales/breakdown?by=…` (validated), `/api/reports/sales/export.csv`, `/api/reports/employee-sales/export.csv` — exports enforced with `reports:export`.

## 5. New client report endpoints (Phases 3–4, `server/report-routes.ts`)

All mounted at `/api/reports`. Nothing is fabricated; every endpoint documents what it counts.

| Endpoint | Measures | Notes |
|---|---|---|
| `/gross-profit` (+export) | Revenue vs COGS from `order_items.unit_cost`; margin on costed revenue; **cost coverage %** and lines with/without cost | By product / category / group / overall. Missing cost never treated as 0 — surfaced as coverage gaps. |
| `/payments` (+export) | Per payment method: orders, collected vs outstanding revenue, refunds | Collected = status in `paid, shipped, delivered`; outstanding handled per method (not "unrecorded" invented). |
| `/receivables` (+export) | Outstanding (non-paid, non-cancelled) order pipeline value + aging buckets (0–7, 7–14, 14–30, 30+) | Buckets computed from `created_at` age; items capped at 500. |
| `/repairs` (+export) | Tickets by status; completed = status `collected` (where `completed_at` is stamped); revenue on collected; avg turnaround (completed − created) | Fixes the phantom `completed` status (audit §3.4). |
| `/warranty` (+export) | Claims in period, units sold with warranty, claim rate (claims ÷ warranty units sold; blank if no sales), 30-day expiries, claims by status | Single-source note documented; claim rate guarded against zero population. |
| `/customers` (+export) | Acquisition (total/new/active), buyers, repeat buyers + rate, avg spend | Top 25 customers from `salesBreakdown("customer")`. |
| `/valuation` (+export) | Stock on hand × price (retail) vs × cost_price; cost coverage; margin-on-hand | By category / product / group; export itemizes uncosted rows as "cost data incomplete". |
| `/stock-take-summary` | Session status, items counted, net/gross variance, variance at retail (and cost when available) | Cost variance null when cost missing. |
| `/suppliers` (+export) | PO count, ordered vs received value per supplier (`order_date` in period) | Uses the business `order_date`, not `created_at`. |
| `/quotes` (+export) | Quotes created (count/value) vs converted orders (`source='quote'`, status in paid/shipped/delivered), conversion rate | Honest period-to-period conversion. |
| `/tax` | eTIMS invoices: count, amount, control-code (filed) coverage %, pending, credit notes | `/tax/summary` → monthly trend via `substr(created_at,1,7)` (text timestamps). |
| `/serial` (+export) | Serial ledger: in stock, sold in period, void, active warranties; branch-aware | |
| `/loyalty` | Members, points outstanding vs lifetime earned, activity by transaction type, top members | Runtime reads no longer touch the missing `loyalty_transactions.order_id` column (audit §3.8). |
| `/gift-cards` | Issued/redeemed in period, outstanding balance, 30-day expiries | |
| `/campaigns` | Featured-product sales (orders/units/revenue) | **Attribution is not order-stamped** — labeled "featured product sales", never "campaign-driven". |
| `/cart-recovery` | Active carts, reminders sent, recovered (reminder with an order), recovery rate and recovered value | |

Rounding: every money figure is surfaced with `money()` (2dp); percentages via `r2`. Time/text columns are compared lexically (ISO `NOW()::text` timestamps are order-safe); month grouping uses `substr`, avoiding `::timestamp` casts that defeat indexes (audit §5).

## 6. Frontend Reports hub (Phase 5, `frontend/pages/admin.tsx`)

- `AdminReports` rebuilt from a flat 6-tab bar into category navigation: **Sales / Money / Operations / Inventory / Customers & Marketing**, with per-category report chips.
- Shared building blocks added: `ReportScreen` (from/to + branch/group/product `by` filters, Generate, server-side CSV export button via `reports:export`), `ReportStat`, `ReportTable` (on `DataTable` + `EmptyState`), and a 22-tab catalogue wired to every new endpoint.
- All legacy views (Sales, Employee Sales, Technician Performance, Purchases, Stock Summary, Visitors) preserved unchanged.
- Every report exposes its "how this is calculated" note; every money figure formatted with the existing `formatPrice`; stock-take/valuation show "cost data incomplete" where cost is missing.

## 7. Control Plane platform report (Phase 6)

- New admin-only endpoint `GET /api/ops/platform-report` plus a **Platform** tab in the OpsCenter.
- Built only from control-plane tables; nothing fabricated:
  - Tenant totals / status split (production excludes `is_test`).
  - Monthly growth series (clients created per month).
  - Plan split against the `custom_plans` catalog with **MRR/ARR contributions labeled as catalog value** (not recorded revenue).
  - Recorded payments by month from `client_payments` (money actually recorded).
  - Usage roll-up from `client_usage_history` (daily snapshots the CP pulls from each client's health endpoint), orders/revenue/customers by month.
- UI reuses existing OpsCenter conventions (ops-tab, stat-card/KPI, mini-tbl, ops-note). No new chart library.

## 8. Known limitations (honest)

- **Backfilled cost** is an estimate (average PO unit cost before order creation); only cost captured natively from Phases 1b onwards is authoritative. Reports surface coverage explicitly.
- `payment_method` is free text (audit §3.9); per-method grouping follows the stored string.
- VAT is still derived at render time from `settings.taxRate` (audit §3.6) — not stored; the tax report counts eTIMS invoice records and control-code coverage, not derived VAT.
- Campaign conversion is not attributable (no campaign id on orders).
- `loyalty_transactions.order_id` is still absent from the schema — nothing in the new reports reads it (the buggy runtime writes remain a separate pre-existing issue, unchanged).
- `/api/storefront-stats` (public totals) and `/api/track/pageview` + product-view spam vectors remain as audit §4 flags — no change, out of scope for report delivery.
- Repairs/warranty endpoints are not branch-filtered (repair tickets carry no branch column).

## 9. Tests, build, CI

- `tests/reporting.test.ts`: 30 unit tests (ranges, previous-period, comparison, series granularity, breakdown dimension behavior, CSV escaping + injection guard).
- Ship criteria run green on every phase: root `npm run typecheck`, `npm run build`, `npm run test`; control-plane `npm run typecheck`, `npm run build`, `npm run test` (21 tests).
- `server-test` and `control-plane-test` CI jobs provision Postgres services and run the DB-gated suites; `tests/*.test.ts` is auto-discovered. The CI wiring already existed and now exercises the expanded suite.

## 10. Reconciliation

- The four divergent revenue formulas (audit §3.2) are unified behind `salesTotals`/`salesBreakdown`; the phantom `completed` order status is nowhere used by the new reports (collected payments = `paid/shipped/delivered`); the phantom `completed` repair status is replaced by `collected` (audit §3.4).
- `reports:export` is enforced server-side on every CSV route (audit §4).
- Every new endpoint documents what it counts and surfaces "data incomplete"/unavailable states instead of fabricating numbers (audit rule 3).