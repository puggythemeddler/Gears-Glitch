# Gear&Glitch Project User Manual

## 1. Project Overview

Gear&Glitch is a complete multi-branch sales & management system (SaaS) combining:
- A shopper storefront with product catalog, shopping cart, wishlist, quotes, and two-step checkout.
- A customer repair portal for booking and tracking repair tickets.
- A staff back office for repair ticket management, stock control, and purchasing.
- An admin panel for catalog, stock, team, finance, plans, providers, and settings.
- An owner panel for business oversight, reports, and subscription management.
- A provider portal for order management and messaging.
- A **control plane** operator dashboard that provisions and manages every client instance.

It uses a **Next.js 14 (Pages Router) + TypeScript** frontend, a **Node.js + Express + TypeScript** backend, and **PostgreSQL** for persistence (one database per client, provisioned on Neon). Multi-tenancy is handled by the control plane, which spins up an isolated Neon DB + Render backend + Vercel frontend for each client.

---

## 2. Architecture

Three layers, cleanly separated:

| Layer | Tech | Port | Purpose |
|-------|------|------|---------|
| **Frontend** | Next.js 14 (Pages Router) + TypeScript | 3000 | UI rendering, client-side routing |
| **Backend** | Express + TypeScript | 8020 | REST API, JWT auth, Cloudinary uploads, M-Pesa, PDF generation |
| **Database** | PostgreSQL via `pg` Pool | — | Cloud database (Neon), one schema set per client |
| **Control plane** | Express + TypeScript | 4000 | Central operator dashboard (separate app at `control-plane/`) |

**Runtime architecture:**

```text
[Browser Client]
  ├─ public storefront (/)
  ├─ customer portal (/dashboard, /my-repairs, /orders)
  ├─ staff back office (/backoffice)
  ├─ admin panel (/admin)
  └─ owner panel (/owner)
        |
        | HTTP / Fetch API (proxied by Next.js)
        v
[Express Backend] server/index.ts  (port 8020)
  ├─ public routes
  ├─ customer routes
  ├─ staff/admin/owner routes
  ├─ provider routes
  └─ control-plane management routes (x-control-plane-key auth)
        |
        v
[PostgreSQL] (per-client Neon database)
```

**Multi-tenant provisioning:**

```text
[Control Plane] control-plane/  (port 4000, own Neon DB)
  ├─ Add Client → creates:
  │    ├─ Neon database (client DB)
  │    ├─ Render web service (client backend, port 8020)
  │    └─ Vercel project (client frontend, rootDirectory: "frontend")
  ├─ per-client CONTROL_PLANE_SECRET for remote management
  ├─ health monitoring (every 5 min), Slack alerts
  └─ per-client feature overrides pushed to each backend
```

---

## 3. Folder Structure

```
Laptop sale/
├── frontend/                 # Next.js 14 (Pages Router + TypeScript)
│   ├── components/
│   │   ├── ui/                   # Reusable component library (Button, Card, Input, Modal, Badge...)
│   │   ├── admin/                # Admin/Owner shared components (AdminProducts, ProvidersPage, ...)
│   │   ├── Layout.tsx            # Responsive header (default + springboard modes)
│   │   ├── ProductCard.tsx       # Product card with strikethrough sale price
│   │   └── ...                   # MarqueeBanner, Toast, Skeleton, LoadingScreen, ScrollReveal...
│   ├── lib/
│   │   ├── api.ts                # API client with token management
│   │   ├── app-context.tsx       # React context — auth, theme, cart, settings, favicon/tab title
│   │   ├── types.ts              # TypeScript interfaces
│   │   └── features.ts           # useFeature() hook for subscription feature gating
│   ├── layouts/                  # Storefront themes + runtime layout engine
│   │   ├── original.tsx          # Original theme (premium marketing hero)
│   │   ├── amazon.tsx, jumia.tsx, mobile.tsx, custom.tsx
│   │   ├── dynamic-engine.tsx    # Generic JSON layout renderer
│   │   └── index.tsx             # Layout registry + provider
│   ├── pages/
│   │   ├── index.tsx             # Homepage
│   │   ├── admin.tsx             # Admin panel
│   │   ├── owner.tsx             # Owner panel
│   │   ├── backoffice.tsx        # Staff back office
│   │   ├── login.tsx, dashboard.tsx, cart.tsx, orders.tsx, ...
│   │   └── _document.tsx         # Static <title> placeholder (replaced by store name at runtime)
│   └── styles/                   # globals.css (design tokens), animations.css
├── server/                   # Express backend (TypeScript)
│   ├── index.ts              # All API routes (asyncHandler-wrapped)
│   ├── db.ts                 # PostgreSQL layer (migrations, seed, settings)
│   ├── schema.sql            # PostgreSQL schema
│   ├── auth.ts               # JWT auth + login/register
│   ├── repairs.ts            # Repair ticket lifecycle
│   ├── permissions.ts        # Role-based permissions
│   ├── upload.ts             # Multer image upload (Cloudinary production / disk dev)
│   ├── mpesa.ts              # Daraja API STK Push
│   ├── email.ts              # Unified email transporter
│   ├── notify.ts             # Email notification helpers
│   └── routes/shared.ts      # asyncHandler, escapeHtml, validation helpers, invoice templates
├── control-plane/            # Operator dashboard (Express + own Neon DB)
│   ├── server/               # index.ts, provision.ts (Neon/Render/Vercel/Cloudflare), db.ts
│   └── public/               # Static dashboard (HTML/JS) incl. feature-override picker
├── render.yaml               # Render.com deployment config
├── vercel.json               # Vercel deployment config
└── README.md                 # Main project documentation
```

---

## 4. How the Application Starts

### Local setup

1. Install PostgreSQL and create a database (`laptop_sale`).
2. `npm install` at the root, then `cd frontend && npm install`.
3. `copy .env.example .env` and set `DATABASE_URL`, `JWT_SECRET`, `ADMIN_PASSWORD`, `TECH_PASSWORD`.
4. Start everything: `npm run dev:all`
   - Backend: `http://localhost:8020`
   - Frontend: `http://localhost:3000`

See `LOCAL_SETUP.md` for the detailed step-by-step guide.

### Default URLs (dev)

- `http://localhost:3000` — storefront homepage.
- `http://localhost:3000/login` — unified login (customer / staff / provider; Google Sign-In supported).
- `http://localhost:3000/admin` — admin panel.
- `http://localhost:3000/owner` — owner panel.
- `http://localhost:3000/backoffice` — staff back office.
- `http://localhost:4000` — control plane dashboard (separate app).

---

## 5. Main User Roles

### Customer
- Browse products, search, filter by category/subcategory.
- Add to cart, wishlist, request quotes.
- Two-step checkout with delivery details (47 Kenyan counties) and M-Pesa payment.
- Track orders, download invoices (shipped/delivered), book and track repairs, message providers, review products (1–5 stars).

### Staff (technician / manager / role-based)
- Log in to `/backoffice`.
- Manage repair tickets (assign, status, notes, parts, cost estimates sent to customers).
- Stock control, stock take, inter-branch transfers, purchase orders, parts, reports.

### Provider
- Log in to `/dashboard` (provider portal).
- View orders, cancel individual items, update order status, view subscription and invoices, message customers.

### Admin
- Full management in `/admin`: products, categories, orders, staff, roles, plans, providers, invoices, credit notes, coupons, reports, stock, branches, clients, splashes, reviews, messages, settings, storefront layouts.

### Owner
- Business oversight in `/owner`: dashboard, products, customers, messages, quotes, reports, stock control, tech repairs, about us, storefront, shop subscription, audit log. Feature-gated by subscription plan.

### Control Plane Operator (Gear&Glitch team)
- Log in to the control plane dashboard: provision clients, monitor health, manage plans/subscriptions/invoices, deploy updates, run backups, configure SMTP/Cloudinary, and fine-tune per-client features.

---

## 6. Key Panels

### Admin Panel (`/admin`)
Products, **Groups** (create/edit/delete and toggle active; drives public storefront `/groups` pages), Categories (with shareable subcategories), **Category Order** (drag-and-drop grid ordering), Coupons, Orders, Users & Permissions, Roles, Plans (feature checkboxes in 11 groups), Providers, Invoices, Credit Notes, Reports (5 sub-tabs), Stock on Hand, Stock Transfers, Stock Take, Purchases, Suppliers, Branches, Clients, Messages, Reviews, Spec Templates, Splashes, About Us, Storefront, Shop Subscription, Settings.

### Owner Panel (`/owner`)
Dashboard, Products, Providers, Customers, Messages, Quotes, Reports, Stock Control, Stock Take, Tech Repairs, About Us, Storefront, Shop Subscription, Audit Log.

### Back Office (`/backoffice`)
Dashboard, Repair tickets, Calendar, Parts, Stock control, Purchasing, Reports.

### Control Plane Dashboard
Clients, Plans, Changelog, Deploy Log, Backups, Settings (SMTP/Cloudinary), Audit Log, Users (with 2FA).

---

## 7. Storefront

### Layouts
Five built-in layout themes — Original, Amazon, Jumia, Mobile, Custom — plus a runtime JSON layout builder for admin-created dynamic themes. The active layout is stored in the `storefront_layouts` table and selected from Admin → Settings → Storefront.

### Product Groups
Managed collections built from the old free-text category groups (`product_groups` table). Admins create/edit/delete groups and toggle each one **active** from Admin → Groups. Active groups get public `/groups` (index) and `/group/[slug]` (product grid) pages, and appear as filters in the Sales Report and Stock Summary. Products assign to a group via the product form's Group dropdown; category remains optional. Existing category group names were migrated into group rows automatically, and `products.group_id` was backfilled from each product's category.

### Header navigation & hero chips stay in sync with categories
The storefront header nav buttons (next to the Sign in button) and the hero's category chips are reconciled against the live category list on every load — no manual "sync" step needed:
- **Deleted categories** are automatically removed from the header nav and hero chips.
- **Newly added categories** are automatically appended to both.
- Static page links (Repairs, Cart, Wishlist, About Us, Contact) are preserved, as is the admin-configured nav order for existing items.
- Cart, Wishlist, About Us and Contact display on the right side of the header, left of the search box. The "Groups" button is not shown in the storefront header (groups are still reachable at `/groups` and `/group/[slug]`).
- The admin "Category Order" panel (drag-and-drop) still controls display order of the category grid.

### Marketing hero (Original layout)
The hero section is fully admin-configurable from the Storefront panel and doubles as a conversion tool:
- Sale countdown timer (auto-hides when the offer ends).
- Rotating headline/accent/subtitle variants (6s cycle).
- "Chat on WhatsApp" CTA (uses the store's phone number).
- Payment & delivery trust strip (M-Pesa & cards, nationwide delivery, warranty).
- Featured products with "Sale" badges, star ratings, "Only N left" scarcity notes, and Ken Burns zoom.
- Category chips that auto-sync with the category list (deleted ones disappear, new ones appear).
- Live stats that count up on load; logged-in customers see a personalized greeting.
- Each booster has its own admin toggle (`showSearch`, `showTrustStrip`, `showWhatsApp`, etc.).

### Theme
Dark mode by default with a light/dark toggle, persisted in `localStorage` and applied via `[data-theme]` CSS custom properties. All animations respect `prefers-reduced-motion`.

---

## 8. Backend API Summary

### Public (no auth)
- `GET /api/health` — health check (usage stats only disclosed to the control plane).
- `GET /api/public-settings` — store name, phone, email, currency, logo, Google Client ID, M-Pesa till.
- `GET /api/products`, `GET /api/products/:id`, `GET /api/products/:id/images`, `GET /api/products/:id/reviews`.
- `GET /api/categories`, `GET /api/subcategories`.
- `GET /api/plans`, `GET /api/layouts`, `GET /api/shipping/counties`, `GET /api/splashes`.
- `GET /api/shop/features` — merged subscription + override features for UI gating.

### Customer
- `POST /api/customer/login`, `POST /api/customer/google-login`.
- `GET/POST /api/orders`, `GET /api/orders/:id`, `GET /api/orders/:id/invoice`, `POST /api/orders/create-pending`, `PATCH /api/orders/:id`.
- `POST /api/cart`, `PATCH/DELETE /api/cart/:productId`.
- `POST /api/wishlist`, `POST /api/quotes/from-wishlist`.
- `POST /api/repairs`, `GET /api/repairs/mine`, `POST /api/repairs/mine/:id/message`, `POST /api/repairs/:id/quote-response`.
- `POST /api/products/:id/reviews`, `PUT/DELETE` review endpoints, `GET .../reviews/check`.
- `GET/POST /api/messages`.

### Staff
- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/change-password`.
- Repair, stock, stock-transfer, stock-take, report, audit-log, and subscription endpoints (permission-gated).

### Admin
- Full CRUD for products, categories, staff, roles, plans, providers, orders, invoices, coupons, suppliers, branches, settings, splashes, storefront layouts, about-us content.

### Provider
- `GET /api/provider/orders`, `GET /api/provider/orders/:id`, `PATCH .../items/:itemId/cancel`, `PATCH .../status`.

### Control plane (authenticated with `x-control-plane-key`)
- `POST /api/admin/features/overrides` — push per-client feature overrides.
- `PUT /api/plans/sync`, `GET /api/cloudinary-config`, `POST /api/control-plane/suspend|resume|redeploy`, `GET /api/control-plane/trigger-backup`.

---

## 9. How Data is Stored

- One **PostgreSQL database per client** (created on Neon by the control plane).
- Backend creates all tables on first boot from `server/schema.sql` and applies migrations.
- Settings are stored in a `settings` key/value table; the store name defaults to `STORE_NAME` env (or "Gear&Glitch").
- Images are stored on **Cloudinary** in production (per-client folder `gear-glitch/{client-slug}`), with optional base64 database backup via the `stored_images` table, and local disk in dev (`data/uploads/`).

---

## 10. Repair Workflow

### Customer side
1. Book a repair via `/repair-book`.
2. Backend creates a ticket.
3. Track ticket list in `/my-repairs`; view cost estimates with Accept/Decline and message the shop.

### Staff side
1. Manage tickets in `/backoffice` (assign technician, status, notes, parts, images).
2. Send cost estimates to customers; the customer's response updates the ticket.

---

## 11. Feature Flags & Per-Client Overrides

### Subscription plan features
Plans carry 51+ feature flags organized into 11 groups (Core Commerce, Inventory & Stock, Invoicing & Finance, Repairs & Service, Customer Engagement, WhatsApp & Communication, Multi-Location, Marketing & Storefront, Analytics & Security, Support & Account, Payments & Currency). Recent additions include Gift cards, Campaign pages, and Cart recovery. The frontend `useFeature()` hook shows/hides nav items and UI sections; server middleware enforces plan features on APIs.

### Control-plane overrides
From the control plane **Edit Client** modal, the operator can override a tenant's feature set without touching the plan:
- **Enabled** (blue) — force-adds a feature the plan doesn't include.
- **Blocked** (red, struck through) — hides a feature the plan normally includes.
- **Inherit** (neutral dash) — falls back to the plan's defaults.
- Group **Select all** / **Block** buttons and a **Clear overrides** button.
- Saving pushes the overrides to the client backend, which merges them with plan features on `GET /api/shop/features`.

---

## 12. Store Identity (Tab Title, Branding)

- The browser tab title, `og:site_name`, and `og:title` use the store's `settings.storeName`, falling back to a neutral "Welcome to our store" placeholder so no client ever displays another tenant's brand.
- `frontend/lib/app-context.tsx` sets `document.title` to the real store name once settings load.
- New clients provisioned by the control plane get `STORE_NAME=<client name>` injected as a Render env var, and the backend seeds that name on first boot.
- Existing clients that were seeded before this fix should set their store name in **Admin → Settings → Store Info** once.

---

## 13. Control Plane

The control plane (`control-plane/`, port 4000, own Neon DB) is the operator hub:

- **Clients** — provision (Neon + Render + Vercel), suspend/resume, redeploy, delete; health + uptime monitoring every 5 minutes; per-client feature overrides.
- **Plans** — create/edit/activate/deactivate custom plans; sync to all clients.
- **Changelog** — publish updates with email notifications to active clients.
- **Backups** — `pg_dump` backups with UI download.
- **Settings** — SMTP and Cloudinary configuration stored in DB.
- **Invoices** — subscription invoicing (generate, pay, view HTML/PDF, email).
- **Audit log** — all admin actions recorded.
- **2FA** — TOTP protection for operator accounts; API keys bypass 2FA.

### Provisioning (Add Client)
1. Create a Neon database.
2. Create a Render web service for the backend with env vars: `DATABASE_URL`, `JWT_SECRET`, `STORE_NAME`, `ADMIN_*`, `TECH_*`, `CONTROL_PLANE_SECRET`, Cloudinary.
3. Create a Vercel project for the frontend (rootDirectory `frontend`, `BACKEND_URL` set).
4. Set up Cloudflare DNS subdomain (optional).
5. Send a welcome email with credentials.

---

## 14. Useful Files

- `README.md` — full feature overview and architecture.
- `LOCAL_SETUP.md` — local Windows setup guide.
- `DEPLOY_CHECKLIST.md` — production deployment checklist.
- `eTIMS_INTEGRATION.md` — KRA eTIMS compliance document.
- `control-plane/README.md` — control plane documentation (endpoints, env vars, provisioning).
- `server/index.ts` — Express entry point (all routes).
- `server/db.ts` — PostgreSQL layer and migrations.
- `frontend/lib/app-context.tsx` — global context (auth, theme, settings, tab title).
- `frontend/layouts/original.tsx` — premium marketing hero implementation.
- `control-plane/server/provision.ts` — provisioning pipeline (Neon/Render/Vercel/Cloudflare).

---

## 15. Notes

- The app can be run locally with Node, a `.env` file, and a local PostgreSQL database.
- Backend must have `DATABASE_URL` and a strong `JWT_SECRET` to start.
- Staff tokens expire after 24h, customer tokens after 7 days.
- Production deployments: backend on Render, frontend on Vercel, databases on Neon.
- `npm run typecheck` runs TypeScript checks (root, `frontend/`, and `control-plane/` each have the script).

---

## 16. Recommended Next Steps

- Enable TypeScript `strict: true` and add ESLint/Prettier + a CI quality gate.
- Break up `server/index.ts` (~5,000 lines) and `frontend/pages/admin.tsx` into route/domain modules.
- Move to formal SQL migrations instead of imperative startup migrations.
- Enforce CSRF hard-fail and a strict CSP.
- Add end-to-end tests for provisioning, feature overrides, and layout switching.
