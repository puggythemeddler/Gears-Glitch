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
