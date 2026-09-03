# System Test Plan

Full regression checklist for confirming the system is 100% functional. Tick each item as it passes.

## A. Storefront (customer-facing)

- [ ] Home page — hero, highlights, trust strip, category chips, countdown, WhatsApp button, featured/carousels
- [ ] Catalog — category pages, group pages, product listing, pagination, search, filters
- [ ] Product detail — specs, gallery, warranty, reviews, related products, add to cart
- [ ] Cart — guest & logged-in carts, quantity updates, coupons, delivery fees, tax
- [ ] Checkout & orders — place order, payment method selection, confirmation, order detail/history, cancel/refund
- [ ] Customer account — dashboard (overview, orders, repairs, wishlist, messages, profile)
- [ ] Auth — register, login, logout, password reset, session/role handling
- [ ] Wishlist — add/remove/move to cart
- [ ] Repairs — book a repair, repair ticket status, my repairs
- [ ] Quotes — request a quote, view quotes
- [ ] Contact page — form + contact details
- [ ] About page — new design (banner, stats, mission/vision, trust band, contact cards, CTAs)
- [ ] Marketing landing page
- [ ] Campaign landing pages
- [ ] Currency / exchange-rate display across pages

## B. POS

- [ ] POS — product search, cart, customer select, payments (cash/card/MPesa), thermal receipt

## C. Admin portal

- [ ] Dashboard — stats, quick links
- [ ] Products — CRUD, image/gallery uploads, import, bulk edit, price history, hide/stock/warranty flags
- [ ] Product groups
- [ ] Categories + category positioning
- [ ] Spec templates
- [ ] Orders — manage, status updates, invoices, warranty, refunds
- [ ] Customers — CRUD, status
- [ ] Coupons
- [ ] Gift cards — create, manage, redemptions
- [ ] Campaigns — create/manage + landing
- [ ] Abandoned carts — list, send reminders
- [ ] Quotations — create, approve, PDF, email
- [ ] Staff/users — create, manage, roles
- [ ] Roles & permissions — permissions matrix
- [ ] Plans & features — subscription plans, feature gating
- [ ] Providers
- [ ] Invoices — generate, pay, email, overdue, export
- [ ] Credit notes
- [ ] Reports — sales, trends, visitors, stock summary, employee sales, technician repairs, purchases
- [ ] Audit log
- [ ] Stock control — low items, transfers, stock take sessions, on-hand, purchase orders (receive adds stock, recall reverses a receipt, delete reverses stock, serial intake scan/generate)
- [ ] Serial numbers — admin panel list/search, scan lookup, batch generate, void; POS serial linking at checkout
- [ ] Clients (multi-tenant)
- [ ] Branches — multi-branch stock, subscription
- [ ] Shop subscription — requests, status
- [ ] Suppliers — admin management + supplier portal pages
- [ ] Storefront editor — hero, banners, layout config, nav order, footer config
- [ ] About Us editor — full-width auto-grow fields, stats, Cloudinary image upload/replace/remove
- [ ] Reviews — moderation
- [ ] Product positioning
- [ ] Repairs admin — tickets, status, images
- [ ] Messages — internal messaging/notifications
- [ ] Settings — store info (name, logo, favicon, contact, currency, tax)
- [ ] Settings — payments (payment methods, M-Pesa config)
- [ ] Settings — compliance (KRA pin, eTIMS serial prefix)
- [ ] Settings — content
- [ ] Settings — system (Cloudinary, backups, feature flags)
- [ ] Settings — delivery fees
- [ ] Settings — email (SMTP, sender, test)
- [ ] Settings — WhatsApp
- [ ] Help panel / keyboard shortcuts

## D. Platform

- [ ] Control plane — client provisioning, deployments, platform subscriptions
- [ ] Cross-cutting — dark/light theme, responsive/mobile, layout switching (Original/Amazon/Jumia/Mobile/Custom), CSRF/auth, audit events

## D2. Control-plane: provision a new client to resell hardware (end-to-end)

Goal: **add yourself as a new client via the control plane and confirm a working, isolated shop for reselling computer hardware.** Run only after sections A–C are green. Each step provisions only that resource, so a failure is easy to isolate (cleanup is automatic on failure).

### 0. Pre-checks (env, before touching the UI)
- [ ] Control plane is deployed and reachable; log in successfully (with 2FA if enabled)
- [ ] Env vars configured: `NEON_API_KEY`, `RENDER_API_KEY`, `VERCEL_TOKEN` (required), plus `NEON_ORG_ID` / `RENDER_OWNER_ID` / `VERCEL_TEAM_ID` / `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ZONE_ID` / `SMTP_*` (as needed)
- [ ] A client is marked **Set as Test Site** so any push goes to the test site first (not production)
- [ ] Confirm you have enough Render free-instance capacity for one more service (each new client = its own free Render service)

### 1. Add the client
- [ ] Control plane → **Add Client**; name = your reseller shop (e.g. `MyHardwareShop`), admin email = yours, plan selected
- [ ] UI shows each provisioning step completing in order: **Neon DB** → **Render service** → **Vercel project** → **Cloudflare DNS** (optional) → **welcome email**
- [ ] No step fails / no `provisioning failed` notification; row appears with a healthy status

### 2. Verify resources were actually created
- [ ] **Neon** — a new database exists for the client
- [ ] **Render** — a `<slug>-backend` web service is listed (plan `free`), build succeeded, and the service URL responds
- [ ] **Vercel** — a `<slug>-frontend` project is listed and a production deploy is green; the storefront URL loads
- [ ] **DNS** — `<subdomain>.gearglitch.com` resolves to the Vercel URL (if Cloudflare configured)
- [ ] Client row shows Backend/Frontend links that open the live site / API health
- [ ] Welcome email received with admin + technician credentials and URLs

### 3. For reselling computer hardware — set up the new shop
- [ ] Log in as the client admin (from the welcome email)
- [ ] Admin → Settings → Store Info: confirm `STORE_NAME` seeded to your shop name (tab title / og tags), set currency + tax
- [ ] Products — add hardware (e.g. laptops, CPUs, RAM, GPUs, storage); use **serial tracking** for serialized items so warranty lookup / POS barcode works
- [ ] Categories / groups / spec templates for the hardware catalog
- [ ] Add a branch, then stock — receive a purchase order (or add stock) from a supplier to get inventory on hand
- [ ] Payments — configure M-Pesa / payment methods (reuse existing M-Pesa till config or add a new one)
- [ ] Place a test order and a test POS sale; verify stock decrements, receipt/invoice PDF, warranty entry
- [ ] (Optional) enable Google Sign-In, WhatsApp, eTIMS compliance as needed for your shop

### 4. Multi-tenant / isolation checks
- [ ] The new client's storefront does NOT leak another tenant's products/orders/settings
- [ ] Logging in as this client admin shows only this client's data
- [ ] Control plane → health check on this client returns healthy; usage stats (orders/customers/revenue) populate
- [ ] Plan sync to this client works (plans appear in its admin)

### 5. Cleanup / notes
- [ ] If testing is temporary, **Delete** the client (removes Neon DB + Render + Vercel) — or keep it as your live reseller shop
- [ ] Record here which client name / URLs you created and the test date

> **Free-tier caveat:** each new client gets its own **free** Render instance (sleeps after ~15 min idle, cold-start latency, no persistent disk). Fine for testing/reselling at small volume, but plan for a paid tier before scaling.

## E. Integrations (test LAST)

- [ ] M-Pesa — till config, STK push, callback, payment status, refunds, POS payment
- [ ] Emails — SMTP, order/invoice notifications, contact form, test email, password reset
- [ ] WhatsApp — webhook verify, notification delivery
- [ ] eTIMS — KRA pin, serial generation, invoice compliance submission (VSCU/OSCU)

## Deployment safety flow

- [ ] Push updates are automatically deployed to the **test site** only
- [ ] Test site verified (no errors, no downtime) before promotion
- [ ] Production deploy to all clients is a deliberate, manual action
- [ ] A failed typecheck/build blocks the deploy
