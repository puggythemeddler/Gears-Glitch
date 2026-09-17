# Reporting & Business Intelligence — Audit

> Status: **Baseline audit — completed before any reporting work.** This document records what existed, what is broken, what is missing, and the agreed phased plan. It is a living reference; the final implementation report (`REPORTING_IMPLEMENTATION.md`) records what was actually changed.

## 1. Methodology

- Inspected the actual repository (no assumptions from feature lists).
- Traced each report from UI (`frontend/pages/admin.tsx` + `frontend/components/admin/*`) → endpoint (`server/index.ts`) → DB function (`server/db.ts`) → schema (`server/schema.sql`, `server/db.ts` inline DDL, `server/migrations/`).
- Audited the Control Plane surface (`control-plane/server/index.ts`, `ops.ts`, `ops-routes.ts`, `ops-db.ts`, `control-plane/public/index.html`).
- Verified every critical claim against source with file:line references.

## 2. What already existed

### 2.1 Client reports (all inside the `AdminReports` hub, `frontend/pages/admin.tsx`)

| Report | Endpoint | Data source | Filters | Exports | Charts |
|---|---|---|---|---|---|
| Sales | `/api/reports/sales` | `getSalesReportWithRange` (db.ts:3853) | from/to/group | CSV + print-PDF (admin.tsx:4478–4567) | hand-rolled SVG daily trend |
| Sales trends | `/api/reports/sales/trends` (index.ts:6949) | inline SQL | from/to/branch | none | `SalesTrendsChart` (admin.tsx:5039) |
| Employee Sales | `/api/reports/employee-sales` (index.ts:6992) | inline SQL | from/to | none | none |
| Technician Performance | `/api/reports/tech-performance` (index.ts:6072) | inline SQL | from/to | none | none |
| Purchases | `/api/reports/purchases` (index.ts:6091) | `getPurchaseReport` (db.ts:3876) | none | none | none |
| Stock Summary | `/api/reports/stock-summary` (index.ts:6987) | `getStockSummary` (db.ts:3888) | group | none | none |
| Visitors | `/api/reports/visitors` (index.ts:6979) | `getVisitorStats` (db.ts:4642) | from/to/branch | none | hand-rolled SVG trend |

Plus operational panels: Customer-facing `Administrator` dashboard KPIs, Stock on Hand (branch snapshots), Stock Take completion report (stock-take/[id].tsx), Stock Take variance endpoint (`/api/stock-take/:id/report`), Warranty register, Serial register, Credit notes, abandoned-cart analytics, invoice list (platform→provider billing).

### 2.2 Charts

Only **two charts exist in the entire platform**, both hand-rolled inline SVG in admin.tsx: `SalesTrendsChart` and `VisitorTrendChart`. No chart library anywhere (client or control plane). Control Plane has **zero charts**.

### 2.3 Exports

- Client: `exportExcel` (CSV w/ UTF-8 BOM + formula-injection guard) and `exportPdf` (print window) exist **only for the Sales report**. Invoice CSV via `/api/admin/invoices/export` (permission `invoice:download`). Invoice/order/quote/PO/credit-note PDFs exist and are auth-scoped (`requirePdfAuth`, index.ts:2383).
- `reports:export` permission is defined and granted but **never enforced** (dead).

### 2.4 Control Plane

- `clients` carries usage counters (`usage_orders`, `usage_customers`, `usage_revenue`), `client_usage_history` (daily snapshot), Ops Center (heartbeats, alerts, incidents, drift, diagnostics, support, maintenance, health overview, releases), `deploy_log`, `changelog`, `cp_notifications`, `audit_log`, `client_payments`, `payment_reminders`.
- **No platform reporting area.** No MRR/ARR, no subscription analytics, no feature adoption, no backup/deployment/incident analytics, no charts.

## 3. Data-integrity findings (critical)

1. **No product cost basis.** `products` has `price`/`sale_price` but no `cost_price`. Cost exists only in `purchase_order_items.unit_cost` and `repair_parts_used.unit_cost`. → **COGS / gross profit / margin / inventory valuation are impossible** today. `autoReorderLowStock` invents `price * 0.6` (db.ts:3824).
2. **Four divergent revenue formulas** across reports — same "sales" number differs per endpoint:
   - `/reports/sales`: line-item sum + shipping (not cancelled), **no discount/gift-card/refund subtraction** (db.ts:3861).
   - `/reports/sales/trends`: `subtotal + shipping − discount`, **no gift-card/refunds** (index.ts:6954).
   - `/reports/employee-sales`: `subtotal + shipping`, **no subtractions** (index.ts:7002).
   - `/api/health` (CP usage): `status IN ('shipped','delivered','completed')` — and `'completed'` is a **phantom order status** (no code path sets it).
3. **Refunds are never netted** from any revenue report (`refunds` table exists; `orders.amount_refunded` exists).
4. **`completed` is also a phantom repair status**: counted in tech-performance (index.ts:6081, db.ts:3830/3930) and used for revenue, but repair STATUSES are `received, diagnosing, waiting_parts, awaiting_approval, approved, in_progress, quality_check, ready, unrepairable, collected, cancelled, rejected` (repairs.ts:145). `completed_at` is only stamped on **`collected`** → technician "completed"/revenue counts are effectively **always zero**.
5. **Two unrelated "invoice" tables**: `invoices` (platform→provider recurring billing) vs `order_invoices` (eTIMS customer receipts). `/api/health` folds subscription revenue into store revenue (index.ts:682).
6. **VAT is not stored.** Tax is computed at render time from a single `settings.taxRate` (lineTotal×16/116). Changing `taxRate` retroactively changes historical VAT. No tax-on-report other than derived.
7. **No M-Pesa transaction table.** Only `orders.mpesa_receipt`/`mpesa_phone` + free-text `payment_method`. Reconciliation per method cannot be attributed reliably.
8. **Loyalty runtime bug**: code writes/queries `loyalty_transactions.order_id` (db.ts:4078, 4085, 3299) but the schema has **no `order_id` column** (schema.sql:642) and no migration adds it → those inserts fail.
9. **`payment_method` is free TEXT** (no CHECK); the configured methods (`cash`,`mpesa`,`card`) live in settings only. Per-method revenue grouping is unreliable.
10. **Timestamps are TEXT** (`NOW()::text`) everywhere except `page_views`; report queries cast `created_at::timestamp`/`::date`, defeating indexes. No functional indexes.
11. **No order `total` column** — every total is recomputed with different formulas.
12. **Quote status drift**: schema default `draft` vs runtime `pending/waiting_for_approval/approved/cancelled`, and repair-quote `accepted/declined` — a third vocabulary.
13. **Warranty dates live in 4 places** (`order_items.warranty_expires`, `serial_numbers.warranty_expires`, `customer_assets.warranty_expires`, `products.warranty_duration`) with no single source.
14. **eTIMS submission is inferred** (presence of `control_code`/`etims_invoice_number`), not explicit.
15. **Stock**: `stock_levels` is `UNIQUE(product_id)` global + branch partial-UNIQUE rows (migration 0006); main report is not branch-aware; `stock_snapshots` has no `branch_id` (`UNIQUE(snapshot_date, product_id)`) so branch snapshots would collide.
16. **Dead code**: `getSalesReport`, `getEmployeeSalesPerformance`, `getTechPerformanceReport` are imported but never used; they carry the old divergent formulas — a trap for future edits.

## 4. Security findings

- Good: all `/api/reports/*` guarded by `ownerAuthMiddleware` + `requirePermission("reports:view")` (admin/owner/manager/provider-with-perms). Manager has `reports:view` + `reports:export`. Technicians/staff do not.
- Gaps:
  - `/api/storefront-stats` is **public** and leaks `totalCustomers`/`totalOrders`/`totalReviews` (index.ts:1080).
  - `/api/track/pageview` and `/api/products/:id/view` are **public anonymous writes**; analytics inputs can be spammed/poisoned (index.ts:6970, 3384).
  - `reports:export` defined but unenforced.
  - Report-adjacent analytics gate on unrelated perms (warranties `order:view`, abandoned carts `cart:view`, notifications `settings:view`).
  - `branch_id`/`group_id` filters are caller-supplied without privilege checks (acceptable for today's 100%-trusted admin/manager roles; note for branch-scoped roles later).
- Tenant isolation is **architectural** (one Neon DB per tenant, no row-level tenancy); the only cross-tenant surface is the control-plane `x-control-plane-key` path (`allowControlPlane`, `SECURITY_MODEL.md §4`) which the model flags as P0. Reports are tenant-local; nothing to do per-report.

## 5. Performance findings

- `getSalesReportWithRange` uses a **correlated subquery per order** (`SUM((SELECT ...)`), repeated for the channels aggregate (db.ts:3861, 3870). O(orders×items).
- `::timestamp` casts + `DATE(created_at)` grouping defeat all created-at indexes (orders only has `idx_orders_created_at` from migration 0005).
- `getVisitorStats` runs **6 separate range scans** that could be one grouped query (db.ts:4646–4651).
- N+1 in `listInvoices`/`searchInvoices` (getInvoice per row, db.ts:3405, 3472).
- `/api/admin/stats/popular` unbounded `limit` param (index.ts:3392).
- No pagination anywhere in `/api/reports/*`.

## 6. Gap analysis vs the requested surface (what to build)

**Phase 1 — Foundation (shared, reusable):**
- `server/reporting.ts`: validated date ranges (EAT-aware semantics), canonical **net-revenue aggregate** (single formula: gross − discounts − gift cards − refunds, per-order line join), comparison periods (current vs previous equivalent), CSV export helper with injection guard + UTF-8 BOM, response envelope, permission-aware export.
- Frontend shared components: report date range, filter bar, KPI block, table, SVG bar/line chart primitives (Workshop Bench tokens), empty/loading/error states, export menu, "how this is calculated" note. New folder `frontend/components/admin/reports/`.

**Phase 2 — Upgrade the six existing reports** (preserve routes):
- Sales: comparison, payment/staff/customer/category/branch/day/hour/day-of-week splits, honest net formula, exports.
- Employee Sales / Technician Performance: canonical formula; fix phantom `completed` (count `collected`); add open/overdue/AOV/customers-served/turnaround.
- Purchases/Stock Summary: date + supplier/branch filters, movement breakdown, cost-aware stock value, over/out-of-stock.
- Visitors: funnel (visitor→product view→cart→checkout→order — using authoritative tracked events), comparison.

**Phase 3 — Missing core business reports** (authoritative data exists):
- Gross Profit & Inventory Valuation (**cost basis first**: add `products.cost_price`, capture `order_items.unit_cost` going forward, backfill from PO unit cost; report flags products/records with missing cost — never treats missing cost as 0/「data unavailable」where unsupported).
- Payments & Reconciliation (orders + payment_method + mpesa fields + refunds; distinguishes initiated/pending/completed/failed per actual state fields).
- Receivables (invoices/branch_subscriptions — platform billing within a tenant), aging buckets.
- Repairs business report (statuses as actually implemented), pipeline.
- Warranty (coverage windows from the 4 sources with explicit single-source definition, claims, claim rate only where population reliable).
- Customers + Retention (authoritative orders/customers), Customer 360 export.
- Stock Take Variance, Serial & Assets, Suppliers, Quotes, Tax/eTIMS, Loyalty, Gift Cards, Campaigns, Cart Recovery — only where authoritative data exists; honest empty/unknown states elsewhere.

**Phase 4 — Control Plane Reports** (separate Reports area):
- Client Portfolio, Subscriptions/MRR/ARR (subscription billing + usage counters; explicit formula), Client Usage (usage_history), Feature Adoption (heartbeats' capabilities, **enabled ≠ used**), Client Health (reuse Ops Center health — no second system), Deployments + Version Adoption (deploy_log, changelog), Backups (backup log; never imply restore-readiness), Support/Incidents (ops incidents), Integration Health (heartbeat checks), Notifications (cp_notifications / logs), Security (audit_log, login failures, 2FA) — restricted.

**Phase 5 — Exceptions, drill-down, saved/scheduled reports** (later; reuses notification architecture for scheduling).

## 7. Rules adopted for implementation (from the brief, made concrete)

1. Reuse existing routes/APIs/DB structures; improve underneath. Preserve `/api/reports/*` paths.
2. One canonical revenue definition everywhere; document formula (Net Sales = Gross − Discounts − Gift-card redemptions − Refunds; Gross from non-cancelled line items + shipping).
3. Never fabricate: use authoritative tables only; where data is incomplete, surface `Data unavailable`/`Cost data incomplete` and identify affected records.
4. Tenant isolation is architectural; keep branch filters tenant-local; enforce `reports:export` server-side for exports.
5. Standardize date handling server-side (validated, lexically-safe ranges, ISO; state EAT semantics); charts get labeled axes, tooltips, empty states.
6. Reports must drill to source records where practical; every card links to its report (no dead links).
7. Testing: unit (formulas, ranges, aging), integration (endpoints), security (unauthorized access / export permission), regression (existing endpoints keep working), plus typecheck/build/CI.

## 8. Planned work order (commits)

1. Audit (this doc) — commit.
2. `server/reporting.ts` foundation + add `products.cost_price`/`order_items.unit_cost` (nullable, additive) + backfill + capture at the 3 order-item insert sites.
3. Rework sales-family endpoints onto the foundation (canonical formula, comparison, breakdowns, exports with permission).
4. New client report endpoints (Phases 2–3) + tests.
5. Frontend shared report components + rebuilt Reports hub (Workshop Bench styling).
6. Control-plane Reports routes + dashboard tab + tests.
7. Full validation: typecheck, build, unit + integration + security tests, CI job; reconcile key numbers vs source records.
8. `REPORTING_IMPLEMENTATION.md` final report.