# PRODUCTION_SCORECARD.md

**Phase 0 audit scoring.** Each category scored 0–5 per the brief scale. Every score < 3 includes a concrete explanation of what remains. Scores reflect **current state as of the Phase 0 audit** (no implementation performed).

**Scale:** 0 missing · 1 prototype · 2 partially implemented · 3 production acceptable · 4 strong · 5 excellent

---

| Category | Score | Why |
|----------|:-----:|-----|
| Security | **2** | Strong per-tenant isolation + parameterized SQL + redaction + generic errors, BUT control-plane role escalation (P0), M-Pesa SIM auto-confirm (P0), unauth WhatsApp media (P1), path traversal (P1), replayable reset tokens (P1). |
| Tenant Isolation | **2** | One-DB-per-tenant is digitally correct, BUT the control-plane `client` role can reach cross-tenant/global routes (P0, T-1) → tenant boundary not yet trustworthy. |
| Authentication | **3** | bcrypt + JWT + optional 2FA + scoped sub-tokens is production-acceptable; dinged for replayable reset/magic tokens (P1), no lockout, JWTs in localStorage. |
| Authorization | **2** | `requirePermission` re-reads DB + provider feature-gating are strong; but many admin routes role-only, shop feature-gating client-side, control-plane role separation broken (P0). |
| Control Plane | **1** | Prototype-grade: `requireAuth`-vs-`requireAdmin` confusion → cross-tenant escalation; no rate limiting; irreversible delete; pg_dump shell RCE; unstable JWT secret; fire-and-forget audit log. |
| Database | **2** | Raw-SQL layer is clean (parameterized) and isolated per tenant, but missing indexes/FKs, unsafe cascades, `stock_levels` unique mismatch, no money-type correctness. |
| Migrations | **1** | Prototype: boot-time ALTER loop with `catch{}` swallowing failures, no versioning, no rollback, dead migration file. |
| Financial Integrity | **1** | Prototype: **all money is floating point** (DOUBLE PRECISION + JS float math) — must move to integer-cents/NUMERIC. Order/PO/credit-note creation non-transactional. |
| Payments | **3** | M-Pesa idempotency (FOR UPDATE, duplicate-callback guard) is strong; docked for SIM auto-confirm (P0), POS no idempotency key, no held-stock timeout. |
| Inventory | **2** | Atomic/guarded SQL in some paths (reserve/refund/transfer-complete in transaction) but READ→WRITE races in POS/quote/transfer/PO-receive silently lose stock; GREATEST clamp masks out-of-stock. |
| Serial Numbers | **3** | UNIQUE serial constraint, serialised lifecycle, refund-restore all correct; minor: no status CHECK, no FK on PO item, loop inserts untransactional, ownership indirect. |
| Repairs | **2** | Full feature set (creation, quotes, messages, calendar, images, stats, parts) but no status-transition enforcement (P0) and part stock-integrity hole (P0); missing approval/unrepairable statuses; assignment history not kept. |
| Warranty | **1** | Register (read-only) + product/order-line config + expiry exist; but **no `warranty_claims`**, no coverage/exclusions, no repair linkage, no claim lifecycle → not first-class. |
| Subscriptions | **2** | Plans/provider/branch & CP sync exist; but no shop-level billing, `expires_at` never set (expiry unenforced), no auto-renewal, feature gating client-side. |
| API Integrity | **2** | Storefront→API surface is consistent (no dead `api.foo()` calls); but control-plane `requireAuth`-gated gaps (P0) + `e.message` leaks + manual invoice auth. |
| Route Integrity | **3** | All important pages/routes exist; breadcrumbs/static nav correct; dead links limited to 2 layout search buttons + dead admin deep-link + open-redirect + unvalidated config links. |
| Testing | **1** | Only `tests/isolation.test.ts`; no auth/tenancy/payment/inventory-concurrency/serial/repair/warranty/webhook/HTTP/E2E tests; no link crawler. |
| Observability | **1** | Ad-hoc `console.error`, no structured logging, CP audit log fire-and-forget, held-stock/worker gaps; no metrics/tracing. |
| Backups | **0** | **No automated/scheduled backups**; only a CP `/api/backups/*` with no restore runbook + a pg_dump shell-injection bug; irreversible client delete. |
| Performance | **2** | Client-rendered storefront (no SSR/SSG) hurts SEO/first paint; full-POS-catalog client load; one giant admin bundle; image CLS. |
| Accessibility | **2** | Good modal focus trap + alt text + status roles; but non-keyboard DataTable rows, missing `scope`/invalid `aria-sort`, unwrapped mobile tables, low-contrast header text. |
| Documentation | **3** | Rich existing docs (AUDIT_REPORT, UX_AUDIT, README, ROADMAP, TEST_PLAN, etc.) but gaps: no SECURITY_MODEL/DATABASE_MIGRATIONS/SCORECARD before this pass; some docs stale (AUDIT_REPORT lists already-fixed P0s). |
| Deployment | **3** | CI + Render/Vercel auto-deploy + GH secrets green; docked for free-tier CP/backend (cold starts), no staging/preview, no link/e2e in CI. |

---

## Scores < 3 — exactly what remains

- **Security (2 → 3):** close control-plane escalation, gate M-Pesa simulation, authenticate WhatsApp media, fix path traversal, single-use reset tokens. Then 3.
- **Tenant Isolation (2 → 3):** enforce `requireAdmin` on all control-plane cross-tenant/global routes + scoped per-user API keys. Then 3.
- **Authorization (2 → 3):** add granular `requirePermission` to stateful admin routes; server-side shop feature-gating; repair transition map.
- **Control Plane (1 → 3):** role separation (P0), rate limiting, CA-verified SSL, stable JWT secret, two-step delete, safe pg_dump, awaited audit log.
- **Database (2 → 3):** add indexes/FKs/RESTRICT, fix `stock_levels` unique, add money type correctness.
- **Migrations (1 → 3):** versioned, transactional, fail-loud migration runner with rollback; wire the dead migration file.
- **Financial Integrity (1 → 3):** integer-cents/NUMERIC money + decimal computation + transactional order/PO/credit-note. (Approval-gated.)
- **Inventory (2 → 3):** atomic guarded stock updates + transactions on all stock-changing paths.
- **Repairs (2 → 3):** transition enforcement, part/stock transaction fix, full status set, link to serial/warranty.
- **Warranty (1 → 3):** build `warranty_claims` + claim lifecycle + coverage + repair linkage.
- **Subscriptions (2 → 3):** set `expires_at`, add billing/auto-renewal/expiry enforcement, server-side feature gating.
- **API Integrity (2 → 3):** fix CP auth-gating, normalize error messages, formalize invoice-token auth.
- **Testing (1 → 3):** add isolation/authorization/payment/inventory-concurrency/serial/repair/warranty/webhook + HTTP/E2E tests + `check:links` in CI.
- **Observability (1 → 3):** structured logging, awaited CP audit log, worker/heartbeat for held stock & subscription expiry, key metrics.
- **Backups (0 → 3):** scheduled off-site backups + documented, tested restore runbook + safe backup command.
- **Performance (2 → 3):** SSR/SSG storefront, image dimensions/next/image, POS server-side search, admin code-splitting.
- **Accessibility (2 → 3):** DataTable keyboard + `scope`/`aria-sort`, `.table-wrap` on mobile tables, modal `inert`, contrast fixes.
- **Documentation (3):** update stale AUDIT_REPORT P0s; keep SECURITY_MODEL/DATABASE_MIGRATIONS/SCORECARD current as remediation proceeds.

---

## Overall readiness

- **P0-clear?** No — 6 open P0 areas (control-plane isolation, M-Pesa SIM, financial money, inventory races, irreversible delete, missing warranty/asset/service-history models).
- **P1-clear?** No — backups, migrations, testing, observability, payments reconciliation, repair status integrity all open.
- **P2-clear?** Largely actionable (routing dead links, a11y, responsive tables, performance, error normalization).

**Projected production-acceptable (>3 across the board) after WS-1…WS-8 are executed and validated per the Change-Safety Protocol and FINAL_VALIDATION gate.**
