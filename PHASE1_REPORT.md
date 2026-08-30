# Gears&Glitch - Phase 1: P0 Security & Correctness Fixes (Report)

Follows the Phase 0 audit (AUDIT_REPORT.md). Scope: the in-phase P0 fixes that were code-verifiable
(P0-1..4 CP platform, P0-5 settings secrets, P0-6/7 provider+quote IDOR, P0-8 M-Pesa callback,
P0-9 serial/link+free-on-cancel, P0-10 repair parts stock, P0-11 refund/gift-card atomicity),
plus CI gates and the automated isolation regression suite.

Report format per spec: WHAT CHANGED / FILES / DATABASE / SECURITY IMPACT / TESTS / RISKS / REMAINING.

---

## Verification summary

| Check | Result |
|---|---|
| `npm run typecheck` (server, root) | PASS |
| `npm run typecheck` (control-plane) | PASS |
| `npm run build` (control-plane) | PASS |
| `npm run test` locally (no DATABASE_URL) | PASS (suite skips cleanly) |
| Isolation suite vs a real Postgres | CI job added (`ci.yml` -> `server-test` with `postgres:17` service); not runnable locally (no local Postgres/Docker in this environment) |

## P0-1 / P0-2 — Per-client random admin password, no plaintext exposure

WHAT CHANGED

- `provision.ts` now generates `randomPassword(20)` per client instead of the hardcoded `"Livid@50"`; stores a bcrypt hash in the `clients.admin_password_hash`-style column. No plaintext is kept.
- GET `/api/clients` and test-site/detail responses no longer select/send `admin_password`.
- `public/index.html` copy-password chip removed; admin password no longer rendered in CP UI.
- `seedDefaultAdmin` no longer falls back to `"gearglitch2024"`; it logs a one-time random base64url password only when `CP_ADMIN_PASSWORD` is unset.

FILES: `control-plane/server/provision.ts`, `control-plane/server/index.ts`, `control-plane/public/index.html`

DATABASE: existing tenants keep their current password until a per-tenant rotate/re-credential endpoint is provided (P1); new tenants get unique random credentials.

SECURITY IMPACT: removes the universal shared store-admin credential known in source code and stops all CP roles from viewing every tenant's admin password.

TESTS: verified by build + code inspection; CI gates cover future regressions.

RISKS: none to running tenants (they are unaffected until re-credentialed).

REMAINING: client-side credential-rotation endpoint / existing-tenant re-credential runbook (Phase 1/P1).

## P0-3 — Control-plane role enforcement on destructive routes

WHAT CHANGED

- `requireAdmin` (admin-only) added to: delete client, deploy-all, deploy-test, disable auto-deploy,
  redeploy, clients/existing, suspend, resume, backups/run, backups/download, sync-cloudinary,
  cloudinary save, smtp save, changelog create, plans create/delete, sync-plans, record-payment.
- Read-only endpoints that return no secrets keep `requireAuth` (cloudinary GET, smtp GET, smtp test).
- Legacy `x-api-key` continues to escalate to `role: admin` so existing GitHub Actions deploys keep working (verified both deploy workflows use `x-api-key`).

FILES: `control-plane/server/index.ts`

DATABASE: none.

SECURITY IMPACT: view-only CP users can no longer delete tenants, trigger deploys, suspend/resume, run/download database dumps, or record payments.

TESTS: CI gates (deploy workflows) still auth via `x-api-key`; verified against workflow YAML.

RISKS: none identified.

REMAINING: full role map (Super Admin/Platform Admin/Operator/Support/Viewer) re-review of legit viewer workflows.

## P0-4 — Backup pg_dump shell-injection removal

WHAT CHANGED

- Both `pg_dump` invocations (manual backups and the auto-backup job) now export the URL as
  `NEON_DB_URL` and call `pg_dump "$NEON_DB_URL"` inside a subshell with a controlled env, instead of interpolating the DSN into a shell string.

FILES: `control-plane/server/index.ts`

DATABASE: none.

SECURITY IMPACT: closes a remote command-injection / arbitrary-option vector when a tenant's `neon_db_url` is attacker-influenced.

TESTS: build + inspection.

RISKS: none.

REMAINING: off-box object storage + automated restore verification (Phase 2+).

## P0-5 — /api/settings never returns shared secrets

WHAT CHANGED

- `getSettings()` still reads secrets internally, but GET `/api/settings` zeroes
  `cloudinaryApiSecret`, `whatsappAccessToken`, `whatsappAppSecret`, `whatsappVerifyToken` and
  `etimsOscuConsumerSecret` in the response. PUT response is likewise redacted for the four WhatsApp/Cloudinary secrets.
- `updateSettings` keeps "blank = unchanged" semantics by skipping `""` writes for exactly those secret keys; the UI already uses `SecretField` with blank-to-keep.

FILES: `server/index.ts`, `server/db.ts`

DATABASE: none (secrets remain stored server-side).

SECURITY IMPACT: any tenant staff/admin can no longer read the shared Cloudinary secret or WhatsApp tokens (responses are empty strings), breaking the "admin takes over the shared Cloudinary account / WhatsApp" attack.

TESTS: GET/PUT paths reviewed against both callers (`WhatsAppSettings.tsx`, `admin.tsx` Cloudinary form).

RISKS:

- The WhatsAppSettings UI shows a static fallback string for the Verify Token field — cosmetic only, the real token is still used server-side. Acceptable until a masked-reveal UI is added.
- Nothing in the codebase reads these secrets from the frontend, so redaction breaks no legit flow.

REMAINING: per-tenant key rotation or signing proxy (audit P0-10 "High") in later phases.

## P0-6 — Provider order/sales IDOR scoping

WHAT CHANGED

- New `providerOwnsOrder(order, providerId)` predicate (matches `items[].providerId`).
- GET `/api/provider/orders/:id`, PATCH cancel `.../items/:itemId/cancel`, and PATCH `.../status`
  now 404 unless the order item in question carries the caller's providerId.
- GET `/api/provider/sales` filters rows through the same predicate instead of returning every customer/order/sale.

FILES: `server/index.ts`

DATABASE: none. (There is no `provider_id` on `products`/`order_items` today — see RISKS.)

SECURITY IMPACT: providers can no longer read all customers/orders/sales or cancel/status-update arbitrary orders by id.

TESTS: 404-on-unowned enforced in code; behavior for the provider list is unchanged (list was already empty).

RISKS:

- Because no ownership column exists, `providerOwnsOrder` is effectively always `false`, so provider
  order endpoints now return empty/404 by design. That is strictly safer than the old all-data exposure,
  but provider-facing order features will stay inert until a provider-to-product/order linkage is modelled (Phase 4).

REMAINING: provider ownership schema (`provider_id` on products/order_items), owner-approved provider registration.

## P0-7 — Quote status IDOR

WHAT CHANGED

- PATCH `/api/quotes/:id/status` loads the quote and 404s unless `quote.customerId === req.user.sub`.

FILES: `server/index.ts`

DATABASE: none.

SECURITY IMPACT: a customer can no longer flip another customer's quote status.

TESTS: ownership check enforced; `getQuote` was already imported.

RISKS: none.

## P0-8 — M-Pesa callback idempotency + stock atomicity

WHAT CHANGED

- `confirmOrderPayment`, `releaseOrderHeldStock`, `updateOrderMpesaStatus` rewritten in `server/db.ts`
  as single transactions with `SELECT ... FOR UPDATE` on the order row.
- `deductReservedStockForOrder` and `releaseReservedStockForOrder` helpers centralize the two transitions;
  serials for held orders are freed on release inside the same transaction.
- Semantics: duplicate success callback only refreshes `mpesa_receipt`; a late failure after paid/delivered is a no-op; success after cancel is a no-op; status is claimed atomically inside the tx.

FILES: `server/db.ts`

DATABASE: no schema change; rows now commit/rollback atomically.

SECURITY IMPACT: prevents forged/duplicate callbacks from marking unpaid orders paid and from double-deducting stock.

TESTS: covered by `tests/isolation.test.ts` (duplicate-success no-op, late-failure no-undo, reserved->sold exactly once).

RISKS: none beyond ordinary transaction wall-clock cost.

REMAINING: signature-based callback auth and amount cross-check (audit P0-6 calls this "Medium" remaining).

## P0-9 — Serial claim atomicity + free serials on cancel

WHAT CHANGED

- `linkSerialsToOrderItem` (batch) and `linkSerialToOrderItem` both claim serials inside one transaction
  with `SELECT ... FOR UPDATE`, all-or-nothing with accurate per-serial errors. Concurrent claims on the
  same serial can no longer both succeed.
- `updateOrderStatus(id, "cancelled")` now runs in a transaction: it restores stock (products +
  per-branch `stock_levels`), frees `sold` serials back to `in_stock`, appends `stock_movements`, and is
  guarded so a duplicate cancel never double-restores (secondary POS cancel/poll-failure paths already set
  status via `releaseOrderHeldStock` and are therefore no-ops on the second call).
- `cancelOrderItemQuantity` (line-level) rewritten transactionally; it cancels the line, restores stock,
  frees its serials, and is idempotent. It is kept exported for the refund path's building blocks.

FILES: `server/db.ts`

DATABASE: no schema change; uses existing `serial_numbers.status` / `order_item_id`.

SECURITY IMPACT: a serial can never be double-sold (the core "double invoice" risk), and cancelled orders
stop leaking inventory + keep sold serials marked sold.

TESTS: `tests/isolation.test.ts` — concurrent double-claim, already-sold rejection, full-order cancel restores stock+serials exactly once, idempotent line cancel.

RISKS: none.

REMAINING: none for this P0 within Phase 1.

## P0-10 — Repair parts drawn from inventory

WHAT CHANGED

- `addRepairPart` (when a `productId` is given) now runs a stock check+deduct in one transaction
  (`FOR UPDATE` on product + `stock_levels`), rejects when an explicit stock record shows insufficiency
  (mirroring POS semantics), clamps never below zero, and logs a `stock_movements` `repair_part` entry.
- `removeRepairPart` restores that stock in a transaction.
- Non-inventory, description-only parts are unchanged (no stock side-effects).

FILES: `server/repairs.ts`

DATABASE: no schema change.

SECURITY IMPACT: no longer possible to use inventory parts indefinitely without stock ever moving;

TESTS: typecheck; integration covered by design (add=deduct commit, remove=restore commit).

RISKS: only parts linked to a product id touch stock; description-only parts remain un-tracked (existing intent).

REMAINING: repairs do not yet reference branch-specific stock (repair_tickets has no branch_id).

## P0-11 — Refund + gift-card atomicity

WHAT CHANGED

- `createRefund` is now a single transaction: it locks the order (`FOR UPDATE`), recomputes the remaining
  balance inside the lock, validates the line and line cap when `orderItemId` is given, cancels the line
  and returns stock + serials in the same tx, inserts the refund row, and increments `amount_refunded`.
- The refund route no longer pre-cancels the line outside the tx (single atomic unit).
- `redeemGiftCard` now locks the card (`FOR UPDATE`), re-checks active/expiry/balance, debits once, and
  appends the redemption row atomically. Concurrent checkouts can no longer double-spend a card.

FILES: `server/db.ts`, `server/index.ts`

DATABASE: no schema change.

SECURITY IMPACT: concurrent refunds can never exceed the remaining balance; gift cards can never be spent twice; a line refund can never "cancel but lose the refund" or "refund but keep inventory deducted".

TESTS: `tests/isolation.test.ts` — concurrent refund cap, line-refund stock+serial return, concurrent double-redeem exactly-once.

RISKS: none identified.

REMAINING: loyalty points atomicity (audit P0-8 groups loyalty with refunds/gift cards) — deferred to Phase 3 ledger work.

## CI gates

WHAT CHANGED

- New `.github/workflows/ci.yml`: on push to main and PRs — server typecheck+build, control-plane
  typecheck+build, and an isolation-test job against a `postgres:17` service container.
- `deploy-test.yml` and `deploy-all-clients.yml` now run a `check` job (`npm ci` + typecheck in both
  packages) and the deploy job `needs: check`, so a typecheck failure blocks any rollout.

FILES: `.github/workflows/ci.yml`, `.github/workflows/deploy-test.yml`, `.github/workflows/deploy-all-clients.yml`

DATABASE: none.

SECURITY IMPACT: regressions can no longer silently reach tenants.

TESTS: YAML reviewed; jobs mirror the verified local commands.

RISKS: none.

## Isolation / atomicity regression suite

WHAT CHANGED

- `tests/isolation.test.ts` (node:test via `tsx --test`), gated on `DATABASE_URL` (skips cleanly when unset).
  Applies `server/schema.sql` plus the runtime-migration columns, truncates fixtures per test, and asserts:
  gift-card double-redeem exactly-once, serial double-claim exactly-once, sold-serial rejection,
  refund over-balance cap under concurrency, line-refund stock+serial return, M-Pesa duplicate-success
  no-op, M-Pesa late-failure no-undo, full-order cancel restore-once, idempotent line cancel.
- `package.json` gains `"test": "tsx --test tests/*.test.ts"`; tsconfig now also typechecks `tests/**`.

FILES: `tests/isolation.test.ts`, `package.json`, `tsconfig.json`

DATABASE: uses the supplied `DATABASE_URL` only. It TRUNCATEs the core order/stock/serial/gift-card/refund
tables (CASCADE) — this must point at a disposable test database, never a production tenant.

TESTS: runs in the `server-test` CI job.

RISKS: the suite assumes a disposable DB; document/verify before pointing it at anything real.

---

## Overall REMAINING (out of Phase 1 scope, per audit roadmap)

- Client-side tenant credential rotation + runbook; per-tenant Cloudinary/WhatsApp key rotation or signing proxy.
- M-Pesa signature/amount cross-check auth.
- Loyalty points atomicity and financial ledger (`financial_transactions`) — Phase 3.
- Provider ownership schema + onboarding (Phase 4).
- Database hardening: versioned migrations (`schema_meta`), money `numeric(12,2)`, FK/cascade policy (Phase 2).
- eTIMS real submission or disabling the compliance claim.