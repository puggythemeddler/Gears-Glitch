# ROUTE INTEGRITY.md

**Phase 2 deliverable.** A matrix of important application routes against their actual destinations, auth requirements, tenant scoping, and verification status. Phase 0 audit — read-only; no code changed.

> Coverage note: this matrix covers every **page route** and every **privileged/critical API route**, plus the frontend navigation surfaces. It does not claim 100% route coverage of all 382 backend route registrations — that exhaustive API list lives in `API_ROUTE_INTEGRITY.md`. Everything below was verified by reading the source (Phase 0).

> **STATUS (updated 2026-09-17, Phases 1–3):** this is a Phase-0 snapshot. Live source of truth: `PRODUCTION_READINESS_AUDIT_FULL.md`. Route shadowing F1–F3 (credit-notes/order-status, purchases/deleted, purchases/completed, products/batch-images) was fixed in Phase 2; `tests/route-order.test.ts` guards against regression. eTIMS is now DISABLED by design (no open CRITICAL code path) — see Phase 5 in the live report. eTIMS mode is forced to `off`; no invoice/credit note is submitted to KRA.

---

## Legend
- **Exists?** — YES (route/page is implemented) / DYNAMIC (depends on runtime data) / FLAG (issue, see notes)
- **Auth?** — None / staff / customer / admin / owner / provider / pos / CP (control-plane key) / JWT
- **Tenant-scoped?** — per-tenant server is single-tenant-per-DB, so "N/A (per-tenant)" = isolated by deployment; control-plane routes are marked per-client.
- **Status** — PASS / FLAG.

---

## A. Frontend Page Routes (storefront + admin)

| Source | Page file | Route | Exists? | Auth? | Tenant? | Status | Notes |
|--------|-----------|-------|---------|-------|---------|--------|-------|
| (root) | `pages/index.tsx` | `/` | YES | None | N/A | PASS | client-rendered grid |
| Nav/layout | `pages/[category].tsx` | `/:category` | YES | None | N/A | PASS | dynamic; categories `/pc`,`/laptops`,… |
| Campaign | `pages/campaign/[slug].tsx` | `/campaign/:slug` | YES | None | N/A | PASS | |
| Group | `pages/group/[slug].tsx` | `/group/:slug` | YES | None | N/A | PASS | |
| Stock take | `pages/stock-take/[id].tsx` | `/stock-take/:id` | YES | admin | N/A | PASS | |
| Suppliers | `pages/suppliers/[id].tsx` / `new.tsx` | `/suppliers/:id`,`/suppliers/new` | YES | admin | N/A | PASS | |
| Admin | `pages/admin.tsx` | `/admin?view=` | YES | staff/admin | N/A | FLAG | deep-link `order=` param ignored (line 5872) |
| Dashboard | `pages/dashboard.tsx` | `/dashboard` | YES | customer | N/A | PASS | staff also routed via admin |
| POS | `pages/pos.tsx` | `/pos` | YES | staff | N/A | PASS | |
| Cart | `pages/cart.tsx` | `/cart` | YES | None (add) | N/A | PASS | |
| Orders | `pages/orders.tsx` | `/orders` | YES | customer | N/A | PASS | |
| Order | `pages/order.tsx` | `/order?id=` | YES | — | N/A | PASS | |
| Quotes | `pages/quotes.tsx` | `/quotes` | YES | customer | N/A | PASS | |
| Wishlist | `pages/wishlist.tsx` | `/wishlist` | YES | customer | N/A | PASS | |
| Login | `pages/login.tsx` | `/login?redirect=` | YES | None | N/A | **FLAG** | open-redirect via `?redirect=` |
| Account | `pages/account.tsx` | `/account` | YES | None | N/A | FLAG | orphaned (redirects /dashboard; unreachable from UI) |
| About | `pages/about.tsx` | `/about` | YES | None | N/A | PASS | |
| Contact | `pages/contact.tsx` | `/contact` | YES | None | N/A | PASS | |
| Groups | `pages/groups.tsx` | `/groups` | YES | None | N/A | PASS | |
| My repairs | `pages/my-repairs.tsx` | `/my-repairs` | YES | customer | N/A | PASS | |
| Repairs | `pages/repairs.tsx` | `/repairs` | YES | None | N/A | PASS | |
| Repair book | `pages/repair-book.tsx` | `/repair-book?service=` | YES | None | N/A | PASS | |
| Repair ticket | `pages/repair-ticket.tsx` | `/repair-ticket?id=` | YES | customer | N/A | PASS | |
| Marketing | `pages/marketing.tsx` | `/marketing` | YES | None | N/A | PASS | gated by `NEXT_PUBLIC_MARKETING_ENABLED` |

---

## B. Global / Per-Surface Navigation Links

| Surface | Link/Action | Destination | Exists? | Auth? | Tenant? | Status | Notes |
|---------|-------------|-------------|---------|-------|---------|--------|-------|
| Header (Layout) | Brand | `/` | YES | None | N/A | PASS | |
| Header | Search submit | `/?search=` | YES | None | N/A | PASS | |
| Header | Category nav (dynamic cats) | `/${cat.id}` (+`?subcategory=`) | YES | None | N/A | DYNAMIC | filtered against `/api/categories` |
| Header | Static nav | `/repairs`,`/cart`,`/wishlist`,`/about`,`/contact` | YES | None | N/A | PASS | |
| Header | Account (auth) | `/dashboard` | YES | customer | N/A | PASS | |
| Header | Account (anon) | `/login` | YES | None | N/A | PASS | |
| Header | Mobile nav | `/dashboard`,`/admin`,`/login` | YES | varies | N/A | PASS | |
| Header | Sign out | `/` (logout) | YES | — | N/A | PASS | `app-context.tsx:197` |
| Header | Skip link | `#main` | YES | — | N/A | PASS | |
| Footer | Brand | `/` | YES | None | N/A | PASS | |
| Footer | Column links | dynamic | DYNAMIC | None | N/A | FLAG | from `/api/settings/footer-config` (unvalidated) |
| amazon layout | Search input + button | (none) | — | — | N/A | **FLAG** | `amazon.tsx:62-65` dead button (no onClick) |
| jumia layout | Search input + button | (none) | — | — | N/A | **FLAG** | `jumia.tsx:60-63` dead button |
| original layout | Shop Now | `/pc` (default) | YES | None | N/A | PASS | config-overridable (DYNAMIC) |
| original layout | Browse Categories | `/#categories` | YES | None | N/A | PASS | |
| original layout | WhatsApp | `https://wa.me/…` | ext | — | N/A | PASS | https |
| original layout | Hero chips | `/pc,`/graphics-cards`,`/laptops`,`/servers`,`/repairs` | YES | None | N/A | DYNAMIC | filtered vs live cats |
| dashboard | Order link | `/order?id=` | YES | customer | N/A | PASS | |
| dashboard | Repair link | `/repair-ticket?id=` | YES | customer | N/A | PASS | |
| dashboard | Book a repair | `/repair-book` | YES | None | N/A | PASS | |
| dashboard | Wishlist item | `/product?id=` | YES | — | N/A | PASS | |
| dashboard | Browse products | `/` | YES | None | N/A | PASS | |
| cart | Continue shopping | `/` | YES | None | N/A | PASS | |
| cart | Login redirect | `/login?redirect=/cart` | YES | None | N/A | PASS | |
| orders | Order link | `/order?id=` | YES | customer | N/A | PASS | |
| product | Category | `/${category}` | YES | None | N/A | DYNAMIC | only valid if category exists |
| product | Subcategory | `/${category}?subcategory=` | YES | None | N/A | DYNAMIC | only if subcat exists |
| product | Contact | `/contact?product=&name=` | YES | None | N/A | PASS | |
| product | Login redirect | `/login?redirect=/product?id=` | YES | None | N/A | PASS | |
| groups | Group card | `/group/{id}` | YES | None | N/A | PASS | |
| repairs | Booking panels | `/repair-book?service=` | YES | None | N/A | PASS | |
| repairs | Track | `/my-repairs` | YES | customer | N/A | PASS | |
| admin sidebar | All nav views | `setView(...)` | YES | admin | N/A | PASS | internal SPA views |
| admin | POS | `/pos` | YES | staff | N/A | PASS | `window.location.assign` |
| admin | Suppliers add | `/suppliers/new` | YES | admin | N/A | PASS | |
| admin | Supplier edit | `/suppliers/${id}` | YES | admin | N/A | PASS | |
| admin | Order row | `/admin?view=orders&order=${o.id}` | FLAG | admin | N/A | **FLAG** | `order` param ignored (dead deep-link) |
| admin | Google Cloud Console | `https://console.cloud.google.com/apis/credentials` | ext | — | — | PASS | https |

---

## C. Backend API Routes (privileged & critical subset)

> Full exhaustive list in `API_ROUTE_INTEGRITY.md`. Tenant column: "N/A" = per-tenant deployment (isolated by DB); CP = control plane (per-client). Auth legend as above.

| Source | Endpoint | Exists? | Method | Auth | Tenant | Status | Notes |
|--------|----------|---------|--------|------|--------|--------|-------|
| Public | `/api/products` | YES | GET | None | N/A | PASS | |
| Public | `/api/settings` | YES | GET | None | N/A | PASS | secrets redacted |
| Public | `/api/categories` | YES | GET | None | N/A | PASS | |
| Public | `/api/groups` | YES | GET | None | N/A | PASS | |
| Public | `/api/plans` | YES | GET | None | N/A | PASS | |
| Public | `/api/plans/all` | YES | GET | None | N/A | PASS | exposes inactive plans (P3) |
| Public | `/api/whatsapp/media/:id` | YES | GET | **None** | N/A | **FLAG** | customer PII, IDOR (P1) |
| Auth | `/api/auth/login` | YES | POST | None | N/A | PASS | rate-limited (20/15m) |
| Auth | `/api/auth/magic-login` | YES | POST | token | N/A | FLAG | replayable (P1) |
| Auth | `/api/auth/password-reset` | YES | POST | token | N/A | FLAG | replayable (P1) |
| Staff | `/api/auth/me` | YES | GET | staff | N/A | PASS | |
| Admin | `/api/admin/orders` | YES | GET | owner | N/A | PASS | ownerAuth+requirePermission? check |
| Admin | `/api/admin/orders/:id/invoice` | YES | GET | manual JWT | N/A | **FLAG** | fragile manual auth (P1) |
| Admin | `/api/admin/warranties` | YES | GET | owner | N/A | PASS | read-only register |
| Admin | `/api/admin/backup` | YES | GET | admin | N/A | FLAG | no restore path (P1) |
| Admin | `/api/admin/customers` | YES | GET | admin | N/A | PASS | |
| Admin | `/api/purchases` | YES | CRUD | admin | N/A | PASS | |
| Admin | `/api/serials` | YES | POST | admin | N/A | PASS | |
| Admin | `/api/stock-transfers` | YES | POST | admin | N/A | FLAG | no transaction (P0, I-3) |
| Admin | `/api/stock/:productId` | YES | PUT | owner | N/A | PASS | |
| Admin | `/api/messages/:id/read` | YES | PATCH | any | N/A | **FLAG** | no ownership check (P1) |
| Customer | `/api/orders` | YES | POST | customer | N/A | **FLAG** | createOrder not transactional (P0, O-1) |
| Customer | `/api/me` | YES | GET | customer | N/A | PASS | |
| POS | `/api/pos/checkout` | YES | POST | pos | N/A | **FLAG** | not transactional + stock race (P0) |
| POS | `/api/pos/orders/:id/payment-status` | YES | GET | pos | N/A | **FLAG** | SIM auto-confirm (P0, S-1) |
| Provider | `/api/provider/products` | YES | GET | provider | N/A | PASS | feature-gated |
| Subscription | `/api/shop/subscription` | YES | GET | staff/CP | N/A | PASS | |
| Plans sync | `/api/plans/sync` | YES | PUT | CP key | N/A | PASS | |

### Control-Plane routes (privileged)

| Endpoint | Exists? | Method | Auth | Status | Notes |
|----------|---------|--------|------|--------|-------|
| `/api/login` | YES | POST | None | PASS | rate-limit missing (P1, C-3) |
| `/api/me` | YES | GET | requireAdmin | PASS | |
| `/api/clients` | YES | GET | **requireAuth** | **FLAG** | `client` role can list all tenants (P0, T-1) |
| `/api/clients/:id` | YES | GET | requireAuth | **FLAG** | any authed role can read any client |
| `POST /api/clients` | YES | POST | **requireAuth** | **FLAG** | any authed role can provision tenants (P0) |
| `PUT /api/clients/:id` | YES | PUT | requireAuth | **FLAG** | cross-tenant mutation (P0) |
| `DELETE /api/clients/:id` | YES | DELETE | requireAdmin | **FLAG** | irreversible, no confirm (P0, C-1) |
| `POST /api/deploy-all` | YES | POST | requireAdmin | PASS | |
| `POST /api/deploy-test` | YES | POST | requireAdmin | PASS | |
| `/api/audit` | YES | GET | requireAuth | **FLAG** | any authed role reads global audit (P0) |
| `/api/cloudinary` | YES | GET | requireAuth | **FLAG** | infra config readable by client role |
| `/api/smtp` | YES | GET | requireAuth | **FLAG** | infra config readable by client role |
| `POST /api/clients/:id/features` | YES | POST | requireAuth | **FLAG** | cross-tenant feature mutation |
| `PUT /api/clients/:id/branches/:branchId/plan` | YES | PUT | requireAuth | **FLAG** | cross-tenant plan mutation |
| `POST /api/clients/:id/invoices/generate` | YES | POST | requireAuth | **FLAG** | cross-tenant invoice generation |
| `/api/backups/run` | YES | POST | requireAdmin | PASS | but pg_dump shell inject (P0, C-2) |
| `POST /api/plans/sync-all` | YES | POST | requireAuth | **FLAG** | |

---

## D. Dead / Flagged Links Summary

| # | Severity | Location | Problem |
|---|----------|----------|---------|
| 1 | P1 | `pages/login.tsx` | `?redirect=` unvalidated → open-redirect / arbitrary destination |
| 2 | P1 | `pages/admin.tsx:5872` | `order=` deep-link param ignored (dead) |
| 3 | P2 | `layouts/amazon.tsx:62-65`, `layouts/jumia.tsx:60-63` | dead "Search" buttons |
| 4 | P2 | footer-config / Storefront Builder / hero / splash links | admin/config-driven links not validated (may 404) |
| 5 | P2 | `pages/account.tsx` | `/account` orphaned |

---

## E. External Links

| Location | URL | HTTPS | Notes |
|----------|-----|-------|-------|
| `about.tsx:183`, `original.tsx:224` | `https://wa.me/…` | yes | WhatsApp |
| `about.tsx:163` | `mailto:` | n/a | |
| `about.tsx:172` | `tel:` | n/a | |
| `admin.tsx:3917` | `https://console.cloud.google.com/apis/credentials` | yes | |
| `WhatsAppSettings.tsx:210` | `https://developers.facebook.com/apps/` | yes | |
| `index.tsx:78` | `https://gearsandglitch.co.ke` | yes | canonical |

**No non-HTTPS user-facing external links found.**
