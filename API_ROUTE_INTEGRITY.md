# API_ROUTE_INTEGRITY.md

**Phase 6 deliverable.** Cross-reference of the frontend API-call surface against implemented backend endpoints. Phase 0 audit — read-only.

> Method: enumerated the backend routes in `server/index.ts` and `control-plane/server/index.ts` (382 tenant routes + ~70 control-plane routes), enumerated frontend calls via the `api()` client in `frontend/lib/api.ts` and raw `fetch("/api/...")` across pages, and cross-checked method + auth + shape. Findings below are concrete; the exhaustive backend route table lives in the Phase-0 exploration output referenced from `PRODUCTION_READINESS_AUDIT.md`.

---

## Frontend API client

- `frontend/lib/api.ts` (`api<T>(path, opts)`) — thin `fetch("/api"+path)` wrapper used for storefront calls; returns parsed JSON.
- `frontend/lib/app-context.tsx` — auth/session helpers (localStorage tokens: `customerStoreToken`, `computerStoreToken`, `providerToken`).
- `next.config.js` — rewrites `/api/:path*` and `/uploads/:path*` to the backend (`BACKEND_URL`).

---

## Verified integrity (no issue)

The following frontend API calls resolve to real backend endpoints with matching methods (spot-verified; representative of the bulk of the codebase):

| Frontend call | Backend endpoint | Method | Status |
|---------------|------------------|--------|--------|
| `api("/api/products")` | `/api/products` | GET | PASS |
| `api("/api/products/...")` (+ `?id`) | `/api/products/:id` | GET | PASS |
| `api("/api/categories")` | `/api/categories` | GET | PASS |
| `api("/api/groups")` | `/api/groups` | GET | PASS |
| `api("/api/settings")` | `/api/settings` | GET | PASS |
| `api("/api/cart")` (+POST/PATCH/DELETE) | `/api/cart*` | GET/POST/PATCH/DELETE | PASS (customerAuth) |
| `api("/api/orders")` | `/api/orders` | GET/POST | PASS |
| `api("/api/wishlist")` (+POST/DELETE) | `/api/wishlist*` | GET/POST/DELETE | PASS |
| `/api/repairs/mine` | `/api/repairs/mine` | GET | PASS |
| `/api/admin/warranties` | `/api/admin/warranties` | GET | PASS |
| `/api/serials` | `/api/serials` | GET/POST | PASS |
| `/api/stock-take/*` | `/api/stock-take*` | CRUD | PASS |
| `/api/admin/suppliers*` | `/api/admin/suppliers*` | CRUD | PASS |
| `/api/campaigns/:slug` | `/api/campaigns/:slug` | GET | PASS |
| `/api/splashes` | `/api/splashes` | GET | PASS |

No leftover object-style `api.foo()` dead calls were found; the codebase uses the `api("/path")` string pattern consistently. No calls to deleted/renamed endpoints were detected in the storefront paths audited.

---

## Findings

### API-integrity / security gaps (all phases)

| # | Sev | Endpoint / Client | Problem |
|---|-----|-------------------|---------|
| 1 | **P0** | `POST /api/clients` (CP) | Frontend CP admin can provision tenants; gated only by `requireAuth` (any logged-in role incl. a tenant `client` role) → resource-provisioning abuse. (`control-plane/server/index.ts:442`) |
| 2 | **P0** | `DELETE /api/clients/:id` (CP) | Irreversible deletion of tenant infra DB+Render+Vercel with no confirm/soft-delete. (`:612`) |
| 3 | **P0** | `GET /api/whatsapp/media/:id` | Unauthenticated, enumerable media endpoint serving customer PII. (`server/index.ts:6213`) |
| 4 | **P0** | `POST /api/pos/orders/:id/payment-status` & SIM path | Order auto-confirmed paid when `checkoutRequestId` starts with `SIM` — reachable in prod if M-Pesa env misconfigured. (`index.ts:1976`) |
| 5 | **P1** | `GET /api/admin/orders/:id/invoice` | Manual JWT auth path + 5m invoice share token can access full invoice; raw `err.message` returned on error. (`index.ts:2609-2743`) |
| 6 | **P1** | `PATCH /api/messages/:id/read` | No ownership check — any valid token marks any message read. (`index.ts:3310`) |
| 7 | **P1** | `GET /api/mpesa/config` | Returns full M-Pesa secret/passkey to admin. (`index.ts:750`) |
| 8 | **P1** | control-plane `client` role | Reaches all `requireAuth`-only global/stateful routes (audit, cloudinary, smtp, plans/sync-all, clients CRUD, features, invoices, branch plan). Full cross-tenant escalation. |
| 9 | **P2** | `/api/products/by-barcode/:code`, POS search LIKE | Wildcard injection in `%${q}%` LIKE (`index.ts:2247`) not escaped (contrast `customers/search` which is). |
| 10 | **P2** | Various error handlers | Return `e.message` (`index.ts:1221,3744,3944,4798`) → info leak; normalize to user-safe generic messages. |
| 11 | **P2** | Frontend session JWTs in `?token=` | Receipts/invoices/quotes URLs carry full session JWT (`auth.ts:66-69`). Use scoped open-link tokens. |

---

## Endpoint → auth summary (tenant server, privileged)

See `ROUTE_INTEGRITY.md` section C for the auth/route matrix; this file focuses on frontend-to-endpoint integrity. For the complete 382-route backend inventory with per-route auth and tenant handling, see the Phase-0 exploration output (captured in `PRODUCTION_READINESS_AUDIT.md` and the working notes).

---

## Recommendation

Add to CI an automated API-surface check that:
1. Enumerates all `app.<method>` registrations in `server/index.ts` / `control-plane/server/index.ts`.
2. Enumerates all `api("/api/...")` / `fetch("/api/...")` in the frontend.
3. Asserts every frontend path matches a registered route with a compatible method.
4. Asserts every admin/owner/mutation route is behind the correct auth middleware (guards against the `requireAuth`-vs-`requireAdmin` class of bugs found in the control plane).

This is the Phase 6+24 automated check and directly prevents the "frontend calls a nonexistent / under-protected API" failure class.
