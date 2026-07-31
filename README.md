# Gear&Glitch — Full-Stack Shop & Management System

A complete multi-branch sales & management system with product catalog, customer accounts, shopping cart, repair ticketing, provider subscriptions, invoices, order management, analytics, stock control with per-branch stock tracking, stock take, inter-branch stock transfers that actually move inventory, per-branch subscription plans, audit logging, role-based dashboards (Admin, Owner, Technician), 5 built-in storefront layout themes (Original, Amazon, Jumia, Mobile, Custom) with a runtime layout registry for admin-created dynamic JSON layouts, admin-controllable hero sections, subcategories with multi-category sharing, product groups with admin-managed storefront collections, About Us page with owner-editable content, unified login (Google SSI supported), M-Pesa payments with callback validation, Kenyan county shipping, product image galleries with gallery + primary image management, search across all products, dark/light theme toggle, sale price (strikethrough pricing), promotional banners/splashes with Kenyan holiday calendar, gift cards with balance tracking and automatic checkout redemption, campaign landing pages for promotions, abandoned cart recovery with reminder emails, order refunds (full or per-line) with history, sales-by-channel reporting (storefront/POS/quotes), store logo on all invoices/receipts/quotes, configurable logo position, server-side PDF downloads (invoices, credit notes, quotes), admin messaging panel, feature-gated subscription plans, purchase order management (with delete), auto-email notifications, WhatsApp Business API integration (bidirectional messaging with 24h window tracking), product rating & review system with interactive star ratings, rating distribution charts, per-customer review limits, customer edit/delete, and admin moderation, two-step checkout with delivery details and payment method selection, provider order management (view, cancel items, update status), customer invoice download from order history, TOTP two-factor authentication, CSRF token protection, file upload content validation, shared Cloudinary with per-client folders, and responsive design optimized for mobile, tablet, and desktop. Runs on Node.js + PostgreSQL (backend) with Next.js (frontend), deployed on Render.com (backend) + Vercel (frontend) with PostgreSQL via Neon.

## Features at a glance

### Sales & storefront
- 5 built-in storefront layouts (Original, Amazon-style, Jumia-style, Mobile, Custom) plus a runtime JSON layout builder for admin-created custom themes
- Admin-controllable hero section with badge, headline, rotating headline variants, CTA buttons, category chips, live stats from your data, auto-rotating featured-product carousel, sale countdown timer, WhatsApp chat CTA, payment & delivery trust strip, and on/off toggle
- Product catalog with image galleries, primary image management, subcategories with multi-category sharing, sale price (strikethrough pricing), and drag-and-drop product positioning
- Two-step checkout with delivery details (Kenyan counties), payment method selection, and order tracking (`pending` → `confirmed` → `shipped` → `delivered`)
- Customer accounts with purchase history, repair records, order history, and communication log; unified login with Google Sign-In
- Product rating & review system (1–5 stars, one review per customer, admin moderation, rating distribution charts)
- Dark/light theme toggle, responsive design (mobile, tablet, desktop), full-width storefront (no side gutters)
- Promotional banners / splashes with quick presets (Black Friday, Christmas, etc.) and auto-displayed Kenyan public holiday banners
- Springboard category menu (admin-toggleable collapsible dropdown)
- Marketing landing page (problems, solutions, industries, features, testimonials, FAQ, CTA)
- Gift cards — issue gift cards with unique codes, balance, and optional expiry; customers redeem them automatically at checkout before payment, with a full redemption audit trail
- Campaign landing pages — create promotional campaigns from the admin (title, slug, hero image, banner color, curated products) served on public `/campaign/[slug]` pages
- Abandoned cart recovery — admin dashboard lists carts sitting in the last 24/48/72 hours with item previews and one-click reminder emails through the shared email engine
- Product groups — managed collections (`product_groups`) built from the old free-text category groups; products link to a group instead, and every active group gets its own public `/group/[slug]` page reachable from a `/groups` index page. Groups are toggled on/off from the admin Groups panel and double as filters in the Sales Report and Stock Summary
- Storefront categories always current — header nav buttons and hero category chips auto-sync with the live category list: deleted categories disappear, newly added categories appear, no manual sync step

### Inventory & stock
- Real-time per-branch stock tracking with low-stock alerts, stock-on-hand counts, and stock take sessions (scoped to a selected branch)
- Inter-branch stock transfers that actually move inventory — deducted from source, incremented at destination, with dual movement records
- Purchase order management per supplier with inline per-item receiving, branded PDF generation, soft-delete with completed/deleted views, and one-click restore
- Supplier directory with linked purchase orders and stock replenishment tracking
- Stock receipt updates `stock_levels` with `purchase_receive` movement records

### Repair & service
- End-to-end repair lifecycle from drop-off to delivery with technician assignment, cost tracking, and quote generation
- Customer self-service portal for real-time repair tracking
- Warranty registration on products, duration tracking, and warranty status on invoices

### Finance & invoicing
- KRA eTIMS compliant invoices and credit notes with control codes, serial numbers, and receipt generation
- Quotation engine with line items, discounts, PDF export, and one-click conversion to orders
- M-Pesa payments with callback validation (POS + online checkout), cash and bank transfer tracking, automatic reconciliation
- Multi-currency support with live exchange rate conversion (feature-gated)
- Coupons & discounts (percentage or fixed-amount, usage tracking)
- Refunds — full-order or per-line-item refunds with reason, staff attribution, and a refund history panel on each order; refunded amounts are tracked and reflected in order totals
- Server-side PDF generation for invoices, receipts, quotes, credit notes, and purchase orders — all with your store logo and configurable logo position; separate Print and Save PDF buttons
- Subscription invoices for clients with generate, pay, email, and PDF download

### Multi-branch
- Unified dashboard across all locations with per-branch subscription plans (independent of shop-wide plan), per-branch stock tracking, and consolidated reporting
- Feature gating per branch plan (POS multi-currency, invoice PDFs, credit notes, quotations)
- Branch upgrade-request workflow (request → admin approve/reject)

### Team & security
- Role-based access: admin, owner, manager, staff, technician, provider, customer. Granular permissions (`messaging:view`, `invoice:download`, `credit_note:create`, `quote:update`, etc.)
- TOTP two-factor authentication (authenticator app) with QR setup; login flow shows a 2FA input field when enabled
- Audit log of all admin/owner actions (filterable, detail view, accessible from admin Activity group)
- CSRF double-submit cookie protection on all state-changing requests
- File upload content validation using magic bytes (rejects mismatched extensions)
- Rate limiting (global + auth endpoints), Helmet (CSP enabled), timing-safe login (dummy bcrypt for non-existent users)
- JWT auth, query-string tokens rejected, default staff role falls back to `technician` (not `admin`)
- Feature-gated subscription plans (Starter, Growth, Pro, Enterprise) with 51+ feature flags; sidebar items, nav links, and currency selector respect feature flags

### Analytics
- Visitor analytics with page view tracking, session tracking, top pages/referrers, device breakdown, and daily visitor trend charts — gated behind Growth+ subscription plans
- Sales reports, employee sales, technician performance, purchases, and stock summary reports with date range filtering, per-branch breakdown, SVG trend charts, and Excel/PDF export
- Sales by channel — every order is tagged `storefront`, `pos`, or `quote` (auto-detected with legacy backfill); the Sales Report includes a channel breakdown table showing revenue per sales channel

### Communication
- WhatsApp Business API integration (bidirectional messaging via Meta Cloud API, 24h window tracking, HMAC-SHA256 webhook verification, Kenyan phone normalization, full conversation logs)
- Built-in messaging between customers, providers, and staff with real-time notifications and admin messaging panel
- Email notifications (order status updates, quote delivery, credit notes, password resets, customer messages, repair tickets, provider welcome/plan/invoice emails); single unified email engine with configurable SMTP
- Cloudinary image uploads with magic-byte validation, shared account with per-client folders, automatic Cloudinary cleanup on delete

### Settings & organization
- Dedicated Settings groups in admin (Store Info, Payments, Compliance, Content) and owner (Storefront, Product Positioning, About Us, Subscription, Audit Log)
- Admin sidebar grouped: Sales, Stock, Team, Finance, Activity, Settings
- About Us page with owner-editable content; custom nav order (auto-synced with the live category list); footer config; company Google Sign-In setup

## Recent highlights

- **Storefront categories always current** — The header nav buttons (next to Sign in) and the hero's category chips reconcile against the live category list on every page load: categories deleted from the admin panel automatically disappear from the header and hero, and newly added categories automatically appear — no manual "Sync" step or stale snapshots. Static page links (Repairs, Cart, Wishlist, About Us, Contact) and the admin-configured nav order are preserved, with Cart, Wishlist, About Us and Contact displayed on the right side of the header, left of the search box.
- **Production startup crash fix** — A `CREATE INDEX` on `products(group_id)` in `schema.sql` ran against pre-existing production tables before the migration added the column, crashing `initDb` with `column "group_id" does not exist`. The index moved into the migration (after the `ALTER TABLE ADD COLUMN`), so existing databases boot cleanly.
- **Product groups** — The category `group` free-text field is now a first-class, managed entity (`product_groups` table). Admins create/edit/delete groups and toggle each one **active** from a new **Groups** panel under Sales; inactive groups stay hidden from the storefront. Existing categories were migrated automatically — their `group_name` values became group rows and `products.group_id` was backfilled from each product's category. The product form now has a Group dropdown and category is **optional** (products can have category, group, both, or neither). Each active group is browsable on the storefront at `/groups` (index with product counts) and `/group/[slug]` (product grid). Groups also filter the **Sales Report** and **Stock Summary** (`?group_id=` on `/api/reports/sales` and `/api/reports/stock-summary`), and `/api/products` accepts a `?group=` filter.
- **Growth & retention suite** — Five new modules shipped together. **Gift cards**: admins issue cards with a unique code, value, optional expiry, and notes; customers enter the code at checkout and the balance is applied automatically (after coupons, before loyalty points) so M-Pesa only covers the remaining total — every redemption is recorded in a `gift_card_redemptions` audit table. **Campaign landing pages**: admins build promotional pages (title, slug, hero image, banner color, curated products, active toggle) rendered on public `/campaign/[slug]` URLs via `/api/campaigns/:slug`. **Abandoned cart recovery**: the admin lists carts abandoned in the last 24/48/72 hours (with item previews) and sends one-click reminder emails through the shared email engine, logged in `cart_recovery_reminders`. **Order refunds**: full-order or per-line-item refunds with reason and staff attribution, a refund history panel per order, and `amount_refunded` tracked on the order. **Sales-by-channel reporting**: online checkout, POS, and quote-to-order conversions each tag orders `storefront`/`pos`/`quote` (legacy orders backfilled), and the Sales Report gained a channel breakdown table. All three new admin sections (Gift Cards, Campaigns, Abandoned Carts) are feature-gated in the subscription plans.
- **Per-client store identity** — Newly provisioned clients no longer inherit the "Gear&Glitch" brand. The control plane injects `STORE_NAME=<client name>` into each client's Render env, and the backend seeds that name on first boot. The browser tab title, `og:site_name`, and `og:title` now use the store's own `settings.storeName` (with a neutral "Welcome to our store" placeholder before settings load) instead of a hardcoded brand — so each tenant's tab and social tags show their own name.
- **Auto-provisioned admin account for new clients** — When provisioning a new client via **Add Client**, the new client's Render service now receives `ADMIN_USERNAME=admin`, `ADMIN_EMAIL=<client admin email>`, and a generated `ADMIN_PASSWORD` as env vars. On first boot, `ensureAdminUser()` creates the seeded admin so the operator (or client) can log in immediately at `{frontend-url}/login` and start populating products, settings, and branches. Previously this step was missing — new clients had no admin account and the welcome-email password was useless. A `technician` seed account is also created for testing role-gated views.
- **End-to-end provisioning pipeline fixes** — The Add Client flow now correctly completes all three infrastructure steps (Neon, Render, Vercel). Fixed: Neon connection URI extraction (was reading `data.project.connection_uris` instead of `data.connection_uris`), Render env vars now applied via dedicated `env-vars` endpoint with explicit `type: "env_var"` and a triggered deploy, Vercel project auto-links the GitHub repo and triggers a production deploy with `rootDirectory: "frontend"`. Client backend now loads `server/schema.sql` at startup so fresh databases are fully initialized. `typescript` moved to dependencies (not devDependencies) so client builds succeed under `NODE_ENV=production`.
- **Control-plane remote management (per-client secrets)** — A shared `CONTROL_PLANE_SECRET` is now generated per client (injected into the client's Render env). The control plane authenticates every call to a client backend with a timing-safe `x-control-plane-key` header. **Closes two public endpoints** that previously leaked the Cloudinary API secret (`GET /api/cloudinary-config`) and allowed unauthenticated plan rewrites (`PUT /api/plans/sync`). Unlocks the CP dashboard features that were silently 401-ing against admin-protected routes (invoices, branches, subscription, upgrade requests). `/api/health` now only discloses usage stats (orders/revenue/customers) to the authenticated CP — the public just gets `{ok:true}`. New `POST /api/control-plane/suspend|resume` endpoints let the operator flip an **app-level suspend flag** (store returns 403 to visitors even if Render stays up) without touching infra. `POST /api/clients/:id/push-secret` (admin) onboards existing clients or rotates secrets via Render API + redeploy. Suspend now does both app-level 403 + Render pause; resume clears both. `GET /api/clients/:id` no longer returns `cp_secret`/`neon_db_url` to viewer-role users. `render.yaml` and `.env.example` document the new `CONTROL_PLANE_SECRET` env var.
- **Control-plane TOTP 2FA** — Control-plane logins now support a two-step flow: credentials, then 6-digit code from an authenticator app (Google Authenticator / Authy / 1Password). Setup, enable, disable, and status endpoints under `/api/auth/2fa/*`. API-key programmatic access bypasses 2FA so cron/GitHub Actions aren't blocked. Dashboard badge shows 2FA On/Off and a settings modal with QR code via qrserver API.
- **Full-width storefront** — `#main`, `.header-inner`, `.footer-inner`, and the homepage/original-layout content wrappers all dropped `max-width: 1440px + margin: 0 auto`. Content now spans edge-to-edge — no more centered column with empty side gutters on wide screens. A few inner hero text columns retain inner max-widths for readability.
- **Frontend layout fixes (.panel, form alignment)** — The `.panel` class was used 40+ times as a form/card container but never defined — panels rendered with no padding/border, causing fields and buttons to overlap. Now properly defined (surface, border, radius, padding, `overflow:hidden`, left-aligned). Also defined the previously-undefined `.plan-status` pill, `.badge-green/red/blue`, `.space-y-*` utilities, `.error`, and `.field-error`. `.field > label` is now `display:block` (was inline, causing label/input overlap), `.field` gets `min-width:0`. New `.form-grid` (`repeat(2, minmax(0,1fr))` with a mobile breakpoint) replaces fragile inline `1fr 1fr` grids across admin, owner, contact, about, repair-book. Admin plans page: the `position:absolute` button row that overlapped the plan name/heading is now a normal flex row. `.stat-card` changed from `text-align:center` → `left`.
- **Repo cleanup** — Untracked `data/mpesa.log` (contained a phone number despite being in `.gitignore`). Removed `Town project/` (changelog duplicate of README), `scripts/check-name.js` (broken; required `better-sqlite3`, not installed), and local SQLite `store.db` artifacts (superseded by PostgreSQL). Root `.gitignore` now covers `.next/` and `.venv/`. `tsconfig.json` dropped the stale `Town project` exclude.
- **Security hardening** — TOTP two-factor authentication (authenticator app), CSRF double-submit cookie protection on all state-changing requests, file upload content validation using magic bytes (rejects files with mismatched extensions), credential logging removed from control plane, dev fallback passwords replaced with random generation, empty catch blocks across backend and control plane now log warnings instead of silently swallowing errors.
- **Shared Cloudinary with per-client folders** — Single Cloudinary account shared across all clients. Each client gets an isolated folder (`gear-glitch/{client-slug}`). Cloudinary config auto-imported from existing site on control plane startup. Sync/Pull buttons on dashboard push config to all clients. No manual env vars needed.
- **Per-branch subscriptions** — Each branch gets its own subscription plan independent of the shop-wide plan. New branches default to the shop's current plan. Admin Branches page shows a Plan column with Change Plan dropdown per branch. Owner Subscription page shows a Branch Plans table. Feature gating checks the branch plan, not the shop plan. Branch plan enforced on POS (multi-currency), invoice PDFs, credit notes, and quotations.
- **Full per-branch stock tracking** — Stock levels and movements tracked per branch. Stock on Hand page has a branch filter dropdown to view stock at a specific branch. Stock Take sessions scoped to a selected branch (only shows products with stock at that branch). POS checkout deducts from both `stock_on_hand` and `stock_levels` simultaneously with stock movement records. Completing a stock transfer deducts from the source branch and increments at the destination with dual movement records.
- **Dedicated Settings tab** — Admin and owner panels restructured with a dedicated Settings group in the sidebar. Admin settings: General, Storefront, Product Positioning, Email, WhatsApp, About Us, Spec Templates, Subscription. Owner settings: Storefront, Product Positioning, About Us, Subscription, Audit Log. Settings group expanded by default.
- **Purchase order improvements** — Inline received quantity inputs (replaced window.prompt popups), server-side PDF generation with branded A4 download, soft-delete with "View Completed" and "View Deleted" tabs, and one-click restore for deleted purchase orders. Any status can now be deleted. Completed tab shows all received orders; deleted tab shows trashed orders with restore button.
- **Audit log in admin panel** — Audit log (previously owner-only) now accessible under Activity group in admin sidebar. Same filtering and detail view.
- **Render crash fixes** — Added `trust proxy` setting for Render reverse proxy (fixes `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` rate-limiter crash). Fixed SQL crash where `text` columns compared against `timestamp` parameters in 4 date-filtered queries (sales/trends, employee-sales, tech-performance, purchase reports). All `created_at` comparisons now cast to `::timestamp`.
- **Admin sidebar Activity group** — Admin sidebar now includes Audit Log under the Activity group alongside Reports, Messages, and Reviews.
- **Comprehensive input validation** — Added typed validation (`isEmail`, `isStr`, `isNum`, `isPosInt`, `isNonNegNum`, `isArr`, `inSet`, `okLen`) to 40+ POST/PUT endpoints across the backend. Covers auth, account creation, orders, financial operations, settings, messages, providers, coupons, purchase orders, stock transfers, categories, roles, quotes, and more. Prevents injection, type confusion, and oversized payloads.
- **Improved sidebar groupings** — Admin sidebar reorganized into 6 focused groups: Sales, Stock, Team (Users, Roles, Clients, Branches), Finance (Invoices, Credit Notes, Plans, Providers), Activity (Messages, Reviews, Reports), and Settings. Owner sidebar converted from flat list to grouped nav with Sales, Service, Finance, Stock, and Settings groups.
- **Deployment hardening** — Render: added `NODE_OPTIONS --max-old-space-size=384` for free tier memory safety, SMTP env vars as placeholders, `DB_SSL_REJECT` for Neon. Vercel: pinned region, explicit output directory. Backend tsconfig: removed unnecessary `declaration`/`declarationMap` for faster builds. Frontend package.json: added `engines >=18`.
- **Critical bug fixes** — Fixed `createCustomer()` called with wrong args (customer registration/Google login were creating blank accounts). Fixed `updateOrderItemWarranty()` passing `orderId=0` (warranty toggle silently did nothing). Fixed M-Pesa `BASE_URL` stale constant (sandbox/production switching had no effect). Fixed WhatsApp webhook error swallowing (inbound messages could be silently lost). Fixed broken HTML in quote email template. Fixed WhatsApp inbound messages attributed to hardcoded entity ID 1. Fixed storefront stats counting wrong table (`clients` → `customers`). Fixed layout PUT response defaulting to `"amazon"` instead of `"original"`. Fixed purchase order delete missing `isNaN` guard and `try-catch`. Fixed PO delete from list view silently swallowing errors. PO delete now also blocks `"ordered"` status to prevent orphaned stock.
- **WhatsApp settings persistence** — Admin WhatsApp settings (enabled toggle, Phone Number ID, Access Token, App Secret, Verify Token, Business Account ID) are now correctly saved to the database. Previously, the `PUT /api/settings` handler silently dropped all WhatsApp fields from the request body, so settings configured in the admin UI were never persisted.
- **Unified email system** — All email notifications (repair tickets, password resets, magic links, provider welcome/plan/invoice emails) now go through a single shared transporter in `server/email.ts` backed by database settings and env var fallbacks. Previously, `server/notify.ts` maintained a separate stale transporter that only read env vars at startup and never refreshed, causing some notification types to silently fail.
- **WhatsApp webhook signature verification** — Incoming WhatsApp webhook payloads are now verified using HMAC-SHA256 (`X-Hub-Signature-256` header) with the configured App Secret before processing. Prevents spoofed webhook payloads from being processed.
- **Kenyan phone number normalization** — WhatsApp phone number normalization now correctly converts Kenyan `07XX` / `01XX` numbers to international `254XX` format before sending. Previously, bare stripping of non-digits left local-format numbers unusable with the WhatsApp API.
- **Async WhatsApp message delivery** — All `sendWhatsAppMessage()` calls in message routes are now `await`ed with `.catch()` error handling instead of fire-and-forget. Prevents unhandled promise rejections from crashing the server process.
- **Live storefront stats** — New `/api/storefront-stats` endpoint returns real product, customer, order counts and category list. Admin/Owner hero editor has "Populate from Live Data" button for stats and "Sync from Categories" button for chips. Original layout hero falls back to live data when hero config is empty.
- **Hero section admin control** — Homepage hero section (badge text, headline, subtitle, CTA buttons, category chips, stats, highlights, trust text) is now fully configurable from the admin Storefront panel. Toggle the announcement badge on/off, edit all text, add/remove category chips and stats. Config stored in `hero_config` and served to all storefront layouts via the layout context.
- **Owner hero editor** — Owner panel has identical hero config UI as admin. Admin-only editing preserved at routing level.
- **Hero link dropdowns** — Shop Now Link, Browse Categories Link, Badge Link, and Category Chips href fields now use category dropdowns populated from the database instead of free-text inputs. Custom paths can still be typed manually.
- **Hero on/off toggle** — Master "Show hero section on storefront" toggle in both admin and owner hero editors. Disabling hides the entire hero section (headline, badge, CTAs, chips, stats) across all 5 storefront layouts. Badge toggle is disabled when hero is off.
- **Responsive layout overhaul** — Wider content container (1080px → 1280px) for better screen utilization. Hero section breaks out to full viewport width. Header nav gracefully hides secondary elements (currency selector) on tablet screens, collapses to hamburger on mobile. Category buttons and hero chips use `flex-wrap` and `auto-fit` grids for even distribution without scroll overflow.
- **Employee Sales & Technician Performance reports fixed** — Both report endpoints now accept `from`/`to` date query parameters and return properly structured JSON. Frontend components match backend response fields (`employees`/`technicians` arrays with `staffName`, `totalOrders`/`totalRevenue`/`ticketsCompleted`/`ticketsAssigned`/`totalEarned`). Both reports now show a totals row.
- **Mark-as-paid buttons themed** — All "Mark paid" buttons across admin and owner invoice panels now use `var(--success)` background color for clear visual indication of the payment confirmation action.
- **Purchase order delete** — Admin can now delete any purchase order via soft-delete (moved to trash). Deleted POs can be restored from the Deleted tab. Any status can be soft-deleted.
- **WhatsApp Business API integration** — Bidirectional WhatsApp messaging via Meta's Cloud API. Outbound messages from admin/customer/provider messaging panel are sent via WhatsApp to the recipient. Inbound WhatsApp messages from customers appear in the admin messaging panel. Respects the 24-hour messaging window (free-form within 24h, template messages outside). Admin WhatsApp settings panel with connection test, webhook URL display, conversation tracking, and full message log. Phone number auto-mapping to existing customers/providers. Webhook payloads verified with HMAC-SHA256 signature. Kenyan local-format numbers auto-normalized to international format.
- **prefers-reduced-motion** — Carousels and sliders respect OS-level reduced motion preference. Auto-rotation paused when `prefers-reduced-motion: reduce` is detected.
- **Stock take updates stock on hand** — Completing or applying a stock take now correctly adjusts `stock_levels.quantity_in_stock` for each counted product. The frontend also saves all unsaved count inputs before calling the complete endpoint, preventing data loss when clicking "Complete & Apply" without blurring inputs.
- **Purchase receive updates stock** — Receiving a purchase order item now calculates the delta (new received − previous received) and adds it to `stock_levels.quantity_in_stock` with a corresponding `purchase_receive` stock movement record.
- **Invoice view in new tab** — The admin "View" button on order invoices now opens the HTML invoice in a new browser tab using fetch + Blob URL approach (avoids Vercel rewrite proxy stripping Content-Type headers). The invoice HTML already includes separate Print and Save PDF buttons.
- **Supplier standalone pages** — Adding and editing suppliers now uses dedicated `/suppliers/new` and `/suppliers/[id]` pages instead of inline forms in the admin panel.
- **Stock take auto-populate** — Creating a new stock take session automatically inserts all products with their current system stock levels, eliminating manual product-by-product addition.
- **Input validation helpers** — Reusable validation functions (`isEmail`, `isStr`, `isNum`, `isInt`, `isPosInt`, `isNonNegNum`, `isArr`, `inSet`, `okLen`) added at the top of `server/index.ts` for consistent request validation across all POST/PUT endpoints.
- **Light theme fixes** — Stock take list and session pages hardcoded dark-theme colors replaced with CSS variables (`var(--danger, ...)`, `var(--success, ...)`, etc.) for proper light/dark theme support.
- **WhatsApp DB migration** — Formal SQL migration file at `server/migrations/001_whatsapp_tables.sql` for `whatsapp_conversations` and `whatsapp_logs` tables with performance indexes.
- **Critical bug fixes** — Fixed `createCustomer()` called with wrong args in auth.ts (customer registration and Google login were creating blank accounts). Fixed `updateOrderItemWarranty()` passing `orderId=0` (warranty toggle on order items silently did nothing). Fixed M-Pesa `BASE_URL` as stale constant (sandbox/production switching at runtime had no effect). Fixed WhatsApp webhook double-swallowing errors (inbound messages could be silently lost). Fixed broken HTML in quote email template. Fixed WhatsApp inbound messages attributed to hardcoded entity ID 1 for new contacts.

- **Image upload fixes** — Fixed logo upload failure caused by frontend sending field name `"logo"` while multer expected `"image"`. Created dedicated `uploadLogo` multer middleware with its own Cloudinary folder. All upload routes (logo, favicon, repair images) now wrapped with `asyncHandler` + try-catch with descriptive error messages, preventing silent crashes on Cloudinary or disk errors.
- **Multer crash fix** — All 5 multer upload routes (logo, favicon, product primary, product gallery, repair images) refactored from dangerous callback pattern (`uploadX(req, res, async (err) => { ... })`) to promisified `runMulter()` helper. The old pattern dropped multer's callback Promise, causing unhandled rejections that crashed the Node process on Render (502 errors). Added global `unhandledRejection` and `uncaughtException` handlers as a safety net.
- **Admin settings split into 5 pages** — Single "General" settings page replaced with 5 focused pages: Store Info (name, phone, email, currency, tax, favicon, logo), Payments (M-Pesa, payment methods, exchange rates), Compliance (eTIMS/KRA, Google Sign-In), Content (banners, image storage/Cloudinary), and System (database backup). Each page fetches and saves only its own fields.
- **Crash-proof async routes** — All 281 async route handlers in `server/index.ts` wrapped with `asyncHandler` middleware. Express 4 does not auto-catch rejected promises from async handlers — any unhandled `await` throw would crash the Node process on Render. `asyncHandler` ensures rejected promises are properly forwarded to Express error handling. `escapeHtml()` made null-safe to prevent `TypeError` crashes on null/undefined data. Shared route utilities extracted to `server/routes/shared.ts`: `asyncHandler`, `escapeHtml`, `requirePermission`, `renderStoreLogo`, validation helpers (`isEmail`, `isStr`, `isNum`, etc.), and reusable invoice/receipt/credit-note CSS templates.
- **Separate Print and Save PDF buttons** — All invoice, receipt, credit note, and quote pages now have separate Print and Save PDF buttons instead of a single combined "Print / Save PDF" button. Print triggers `window.print()`, Save PDF navigates to `?format=pdf` to generate a server-side PDF download. Affected pages: POS receipt (thermal + A4), admin invoice, customer invoice, credit note view, and quote PDF.
- **Security hardening** — Comprehensive security audit and fix: auth on credit note viewer, provider order isolation (no longer exposes all orders), table name sanitization in backup endpoint, message read endpoint now verifies JWT, product upload rejects non-image files, rate limiting on customer/provider login endpoints, HTML-escaped eTIMS receipt numbers and store names in invoice templates, query-string tokens removed from `getBearerToken()` (no longer accepts insecure query-string auth), default staff role falls back to `technician` instead of `admin`, all user input escaped in email HTML bodies, CORS locked to production domain only, timing side-channel mitigated on all login endpoints (dummy bcrypt for non-existent users), SVG uploads rejected, DB SSL configurable via `DB_SSL_REJECT` env var, hardcoded JWT secret removed from `render.yaml` (set to `sync: false`).
- **TOTP 2FA** — Admin/owner accounts can enable Time-based One-Time Password (TOTP) two-factor authentication. Setup via Settings → Store Info in admin panel. Uses `authenticator` algorithm (TOTP, SHA1, 6 digits, 30s period). Login flow shows a 2FA input field when TOTP is enabled. Endpoints: `/api/auth/2fa/setup`, `/api/auth/2fa/verify`, `/api/auth/2fa/disable`, `/api/auth/2fa/status`. QR code provided for authenticator apps.
- **CSRF token protection** — Double-submit cookie pattern on all state-changing endpoints (POST/PUT/DELETE/PATCH). Frontend fetches a CSRF token on app mount via `GET /api/csrf-token` and sends it as `X-CSRF-Token` header on every mutating request. Server validates the token and logs warnings on missing/invalid tokens (soft enforcement to avoid breaking existing clients).
- **File upload magic bytes validation** — All file uploads (logo, favicon, product images, gallery images, repair images) are validated against magic byte signatures after multer saves the file. Supports JPEG, PNG, GIF, WebP, BMP, ICO, and SVG. Invalid files are rejected and deleted immediately with a clear error message.
- **Control plane per-user authentication** — Control plane now has proper user accounts with login screen. Default admin user auto-created on first boot (`admin` / `gearglitch2024` or `CP_ADMIN_PASSWORD` env var). JWT-based session auth (7-day expiry) plus per-user API keys for programmatic access. Users tab for admin to manage accounts (create/delete, assign roles, regenerate API keys). Roles: `admin` (full access) and `viewer` (read-only). Legacy `CONTROL_PLANE_API_KEY` still works for backward compatibility.
- **Shared Cloudinary with per-client folders** — Provisioning now automatically configures Cloudinary on each new client's Render service using a shared Cloudinary account. Each client gets an isolated folder (`gear-glitch/{client-slug}`) for product images, logos, and uploads. Control plane auto-imports Cloudinary credentials from the first active client on startup. "Pull Cloudinary" dropdown lets you pull from any client. "Sync Cloudinary" button pushes credentials to all existing clients. `GET /api/cloudinary-config` endpoint on the main app exposes Cloudinary settings for control plane provisioning.
- **Render deployment speed** — Moved `@sparticuz/chromium` and `puppeteer-core` to `optionalDependencies`. Build command changed from `rm -rf node_modules dist && npm install && npx tsc` to `npm ci --omit=optional && npx tsc`. Eliminates 300MB+ Chromium download on every deploy. PDF generation falls back to HTML gracefully when Chromium is unavailable.
- **Two-step checkout with delivery details** — Clicking Checkout now immediately creates a pending order and redirects to the order detail page where customers fill in delivery details (name, address, county, phone), select a payment method, and add delivery instructions. Orders start as `pending` and progress through `confirmed` → `shipped` → `delivered`. Customers can only edit details while the order is still pending.
- **Springboard category menu** — Admin-toggleable header mode that replaces horizontal category links with a collapsible dropdown button. Brand name sits at the far left, springboard button next to it, and actions (search, theme, currency, account) on the right. Enabled from admin Settings panel. Provides a cleaner header layout when categories are numerous.
- **Provider order management** — Providers can view all orders, cancel individual items that are unavailable, and update order status (confirm, ship, deliver, cancel). Item-level cancellation shows strikethrough on the customer's order page. Status changes trigger email notifications to customers.
- **Customer invoice download** — Orders list page now shows an inline "Invoice" button on shipped/delivered orders. Order detail page also has a Download Invoice button for shipped/delivered orders. No need to navigate away from the orders list.
- **Product rating & review system** — Customers can rate products (1–5 stars) with an interactive clickable star widget. Each customer gets one review per product, with editable and deletable reviews. Product detail page shows a rating distribution bar chart, average rating display, and paginated review list. Product cards show real average ratings on category pages. Admin panel has a Reviews management section under Activity for moderation (view all reviews, delete). DB enforced via `UNIQUE(product_id, customer_id)` constraint, `CHECK(rating >= 1 AND rating <= 5)`, and performance indexes on `product_id` and `customer_id`.
- **Component unification** — 6 near-identical admin/owner component pairs extracted to shared files (`ProvidersPage`, `CreditNotesPage`, `AboutUsPage`, `ProductPositioningPage`, `StockTakeListPage`, `StockOnHandPage`). Admin and owner panels now import the same components, eliminating ~1,600 lines of duplicated code. Feature gating in the owner panel is preserved at the routing level.
- **Premium hero section** — Original storefront layout now features a full-width two-column hero with dark gradient background, animated blue/purple glows, floating particles, glassmorphism buttons and stat cards, auto-rotating featured product carousel (5s interval with dot navigation), floating category chips (auto-synced with the category list), "Trusted by 5,000+ customers" trust bar with gold stars, and SVG wave transition into the product grid. Fully responsive (stacks vertically on mobile). Respects `prefers-reduced-motion`.
- **Marketing-ready hero boosters** — The hero now doubles as a conversion tool, all admin-configurable from the Storefront panel: a live sale countdown timer (auto-hides when the offer ends), rotating headline/accent/subtitle variants (6s cycle), a "Chat on WhatsApp" CTA using the store's phone number, and a payment & delivery trust strip (M-Pesa & cards, nationwide delivery, warranty, 24h Nairobi delivery). Featured products gain "Sale" badges, star rating + review count, "Only N left" scarcity notes, and a subtle Ken Burns zoom. Live stats count up on load, and logged-in customers see a personalized greeting. Each booster has its own admin toggle (`showTrustStrip`, `showWhatsApp`).
- **POS invoice save & print** — After completing a POS sale, the post-charge UI now offers separate Save Invoice (downloads PDF) and Print Invoice (opens print dialog) buttons for both thermal receipt and A4 invoice formats.
- **Purchase orders** — Full purchase order management with supplier selection, product line items, status workflow (pending → ordered → received), inline per-item receiving, branded PDF generation, soft-delete with completed/deleted views, restore, and admin sidebar integration under the Stock group.
- **Admin reports expanded** — Reports tab now includes 5 sub-tabs: Sales Report, Employee Sales, Technician Performance, Purchases Report, and Stock Summary.
- **Unified product pages** — Admin and owner product pages now use the same `AdminProducts` component with full sale price, subcategory, warranty, taxable, CSV import/export, and bulk edit support.
- **Unified quotations** — Admin quotations panel now uses the full-featured `QuotesPage` component with status management, approve/cancel workflows, PDF downloads, and discounts.
- **Marketing page** — Full marketing landing page with problems, solutions, industries, features (38 real modules), testimonials, stats, FAQ, and CTA. All content verified against actual implemented features.
- **Annual pricing** — Subscription plans now support both monthly and annual pricing. Plans table has `price_annual` column. Admin plans UI shows both Monthly and Annual price fields. Owner subscription page displays both prices with percentage savings for annual billing.
- **Multi-currency feature gating** — `CurrencySelector` checks `useFeature("Multi-currency support")` and returns null when the plan doesn't include it. Multi-currency support added to Growth, Pro, and Enterprise plan features.
- **Provider PIN fix** — Removed `PinLock` from dashboard page entirely. Providers now log in and see the dashboard immediately. PIN lock only appears when clicking POS (which has its own correct PinLock).
- **Server-side PDF downloads** — Invoices, credit notes, and quotes can be downloaded as real PDF files via Puppeteer (`puppeteer-core` + `@sparticuz/chromium`). Add `?format=pdf` to any document endpoint to get a PDF instead of HTML. All frontend buttons now trigger actual file downloads.
- **Admin messaging panel** — New "Messages" section under Activity in the admin panel. Conversation list with unread badges, chat-style message view with read receipts, inline reply, compose new messages (pick customer + provider). Auto-polls every 30 seconds. Notification bell links to the panel.
- **Feature-gated subscription plans** — Plans now carry actual feature flags (Messaging, Invoice/quote PDF downloads, Credit notes, Quotations, Branch management, Repair ticketing, Technician accounts, etc.). Frontend `useFeature()` hook conditionally shows/hides nav items and UI sections. Server-side `requireProviderFeature()` middleware blocks provider API access per plan tier. Four default plans (Starter, Growth, Pro, Enterprise) seeded with progressive feature sets. **All sidebar nav items across admin, owner, backoffice, and customer dashboards are now hidden when their corresponding feature is not included in the active plan.** Storefront nav links (Cart, Wishlist) and currency selector also respect feature flags; the Repairs link always shows in the storefront header.
- **Expanded role permissions** — New permissions: `messaging:view`, `messaging:send`, `invoice:view`, `invoice:download`, `credit_note:view`, `credit_note:create`, `quote:view`, `quote:create`, `quote:update`. Default roles (admin, owner, manager, technician) updated with appropriate permission sets.
- **Sale price / strikethrough pricing** — Products support an optional sale price. Strikethrough original + red sale price displayed on product cards, product detail page, owner products table, POS grid, and admin products table.
- **Promotional banners / Splashes** — Admin can create marquee or static promotional banners with custom background/text colors, active date ranges, and on/off toggle. Quick presets for Black Friday, Happy Hour, Christmas, New Year Sale, and Back to School.
- **Kenyan holiday calendar** — Auto-displayed marquee banners for 12 Kenyan public holidays with unique Kenya flag-themed gradient colors and catchy taglines.
- **Store logo on all documents** — Logo automatically appears on POS receipts (thermal + A4), customer invoices, admin order invoices, credit notes, quote PDFs, and purchase order PDFs. Configurable position via admin Settings. Logo displayed at 64px height across all storefront layouts with an 80px header for prominent branding.
- **Product positioning editor** — Drag-and-drop product reorder for storefront. Feature-gated via "Product positioning" in plan features. Admin and owner panels.
- **Runtime layout registry** — Storefront layouts are stored in a `storefront_layouts` database table and managed directly from the **Storefront** settings page. The 5 built-in static layouts (Original, Amazon, Jumia, Mobile, Custom) are registered as code modules. Admins can create new dynamic layouts using JSON config definitions with section types: product-grid, category-grid, banner, stats, text, and spacer. Dynamic layouts are rendered by a generic JSON layout engine (`dynamic-engine.tsx`). Layouts can be activated, reordered, edited, and deleted from the admin UI. The active layout key is synced with the existing `store_layout` setting. Store logo now displays next to the brand name text in the site header.
- **Auto-email system** — Full email notification framework. Configurable sender, HTML templates for messages/quotes/credit notes/order status. Owner CC on customer-provider messages. Email logs tracked. All notification types (repairs, password resets, magic links, provider emails) share a single unified transporter backed by database settings.
- **Cloudinary cleanup on delete** — Automatic removal of Cloudinary images when gallery images, primary images, or entire products are deleted.
- **Drag-and-drop gallery reorder** — Admin and owner product edit pages support drag-and-drop reordering of gallery images with visual feedback.
- **FK cascade fix for product deletion** — All product-referencing tables use `ON DELETE CASCADE`, fixing 502 crashes. 37 old placeholder products cleaned up.
- Responsive UI across all breakpoints (1024px / 900px / 768px / 480px).
- Credit notes producible only once per invoice (backend + UI enforced).
- Admin and owner product forms use a dropdown populated from the live categories API.
- Storefront category pages surface subcategories as clickable navigation links.

---

## Mobile & tablet experience
The storefront, POS, auth, and dashboard flows now adapt better for phones and tablets.

- Header navigation and search wrap cleanly on narrow screens.
- POS switches to a stacked layout on tablet and mobile screens so the product grid and cart stay usable.
- Tables, forms, and auth panels become scrollable or full-width where needed for touch-friendly use.
- Core actions keep larger tap targets and calmer spacing on small screens.

## Architecture

Three layers, cleanly separated:

| Layer | Tech | Port | Purpose |
|-------|------|------|---------|
| **Frontend** | Next.js 14 (Pages Router) + TypeScript | 3000 | UI rendering, client-side routing |
| **Backend** | Express + TypeScript | 8020 | REST API, JWT auth (24h staff / 7d customer), Cloudinary image uploads, M-Pesa |
| **Database** | PostgreSQL via `pg` Pool | — | Cloud database (Neon) with schema-per-client multi-tenancy |

**Security middleware** applied globally: Helmet (CSP disabled), CORS (configurable via `CORS_ORIGIN`), rate limiting (200 req/15min global, 10 req/15min on auth endpoints). The Next.js dev server proxies `/api/*` and `/uploads/*` to the Express backend automatically.

## Control Plane

A separate operator dashboard at `control-plane/` serves as the central admin hub for managing all Gear&Glitch client instances. It runs as an independent Express server (port 4000) with its own PostgreSQL database.

**Features:**
- **Client lifecycle management** — Provision, suspend, resume, and delete client deployments (Neon DB + Render backend + Vercel frontend)
- **Health monitoring** — 5-minute auto-health-check loop pings each client's `/api/health`, tracks uptime %, alerts on down transitions via Slack
- **Plan management** — Create/edit custom subscription plans, sync to all clients, approve/reject upgrade requests
- **Subscription invoicing** — Generate, pay, view (HTML/PDF), and email invoices per client
- **Changelog publishing** — Push version updates with email notifications to all active clients
- **Database backups** — Run `pg_dump` for all clients, download `.sql.gz` files from the UI
- **Cloudinary management** — Pull config from any live client, push to all clients, store in DB
- **SMTP configuration** — Store and test SMTP settings via the UI (DB-backed with env var fallback)
- **Slack alerting** — Down-client and over-usage alerts sent to a Slack webhook
- **Usage enforcement** — Periodic check comparing order counts against plan limits, Slack alert when exceeded
- **Audit log** — All admin actions recorded (create/delete/suspend/resume/redeploy/push-secret/backup/cloudinary/smtp/changelog)
- **TOTP 2FA** — Time-based one-time password protection for admin accounts, API keys bypass 2FA
- **Per-user accounts** — Role-based (admin/viewer) with unique API keys
- **Single-client redeploy** — Trigger a Render deploy for an individual client from the UI
- **Client contact fields** — Phone and address fields on client records
- **Per-client feature overrides** — Fine-tune a tenant's feature set without changing their plan: the Edit modal lists all features as grouped checkboxes with tri-state toggles (Enabled / Blocked / Inherit), pushed to the client's backend and merged with the plan's features on `/api/shop/features`

See `control-plane/README.md` for full documentation.

---

## Quick Start

```bash
git clone https://github.com/puggythemeddler/Gears-Glitch.git
cd Gears-Glitch
npm install
copy .env.example .env
# Edit .env and set DATABASE_URL, JWT_SECRET, and other required vars
cd frontend
npm install
cd ..
npm install -g tsx
npm run dev:all
```

Opens **http://localhost:3000** in a browser.

> **Note:** You need a PostgreSQL database (e.g. [Neon](https://neon.tech), Railway, or local). Set `DATABASE_URL` in `.env` before starting the server.

---

## Default Accounts (dev only — no accounts auto-seeded in production)

| Role | URL | Credentials (dev) | Env vars to set in production |
|------|-----|-------------------|-------------------------------|
| **Admin** | `/admin` | `admin@gearandglitch.com` / `admin123` | `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` |
| **Owner** | `/owner` | same admin credential (role-based access) | — |
| **Technician** | `/backoffice` | `technician` or `tech@gearandglitch.com` / `tech123` | `TECH_USERNAME`, `TECH_EMAIL`, `TECH_PASSWORD` |
| **Customer** | `/dashboard` | `customer@gearandglitch.com` / `customer123` | not seeded in production |
| **Provider** | `/dashboard` | `provider@gearandglitch.com` / `provider123` | not seeded in production |

- **Demo accounts** (`customer123`, `provider123`) are only seeded when `NODE_ENV !== "production"`.
- **Admin/Technician** use a fallback dev password if the env var is unset, but **in production the server skips user creation** if the password env var is missing.
- **Password minimum length** is 8 characters across all endpoints.
- On first run the database table `actor_role` is auto-migrated for the audit log. The Owner role uses the same admin login but with elevated access — see the Owner panel section below.

---

## URLs & Who They're For

| URL | Who | What You Can Do |
|-----|-----|-----------------|
| `/` | Everyone | Browse products by category |
| `/product?id=xxx` | Everyone | Product details, specs, image gallery with lightbox |
| `/pos` | Staff | Point of Sale — product grid, cart, payment method selector (configurable), customer lookup, cash change calculator, thermal receipt & A4 invoice print. Stock deducted from both `stock_on_hand` and `stock_levels` per branch. |
| `/login` | Everyone | Unified sign-in — customer, staff, provider (Google Sign-In supported) |
| `/dashboard` | Customers & Providers | Orders, repairs, wishlist, messages (customer) or subscription, invoices (provider) |
| `/about` | Everyone | About Us page — content editable by admin/owner |
| `/cart` | Customers | Shopping cart — manage quantities, then Checkout creates pending order and redirects to order detail |
| `/campaign/[slug]` | Everyone | Public promotional landing pages created in admin → Campaigns (hero banner + curated product grid) |
| `/groups` | Everyone | Storefront index of all active product groups with product counts |
| `/group/[slug]` | Everyone | Product grid for a single active group (e.g. `/group/gaming-pcs`) |
| `/order?id=xxx` | Customers | Order detail — fill in delivery details + payment method (pending), view items, download invoice (shipped/delivered) |
| `/orders` | Customers | Order history with inline invoice download for shipped/delivered orders |
| `/repair-book` | Customers | Book a repair with detailed device/issue form |
| `/my-repairs` | Customers | Track your repair tickets, view cost estimates, accept/decline quotes, send messages |
| `/repair-ticket?id=xxx` | Customers | Single repair ticket detail — device info, cost estimate with Accept/Decline, update timeline, send messages |
| `/wishlist` | Customers | Saved products with quote generation |
| `/account` | Customers | Account details |
| `/admin` | Admin staff | Full management — products, orders, staff, plans, providers, invoices, settings, stock take, spec templates, shop subscription (approve/reject requests) |
| `/owner` | Admin/Owner role | Business oversight — dashboard, products, providers, customers, messages, quotes, reports, stock control, stock take, tech repairs, audit log (non-admin actions only), shop subscription (request plan changes) |
| `/backoffice` | Staff (admin/technician) | Repair tickets with cost editing and quote sending, calendar, dashboard, stock control, parts, purchasing, reports |
| `/stock-take/[id]` | Admin/Owner | Dedicated stock take session page with table input, stat cards, variance report, auto-apply adjustments |

---

## Key Panels

### Admin Panel (`/admin`)

Full store management with 32 sections:

- **Dashboard** — Stats overview with clickable animated counters (products, staff, pending subscription requests)
- **Products** — CRUD, image gallery, spec templates, quick price edit, checkbox bulk edit (price/category/stock), CSV import with template download (admin/owner only), price history tracking, sale price (strikethrough pricing). Category is optional; products can be assigned to a Group instead (or both/neither)
- **Groups** — Create, edit, reorder, and delete product groups; toggle each group **active/inactive**. Active groups get public `/groups` + `/group/[slug]` storefront pages and appear in Sales Report / Stock Summary filters. Categories and products link to these managed groups.
- **Coupons** — Create discount/promo codes (percentage or fixed amount), set min order, max uses, expiry date, usage tracking per order
- **Gift Cards** — Issue gift cards with code, value, optional expiry, and notes; view balance and full redemption history per card; toggle active/inactive or delete. Feature-gated ("Gift cards").
- **Campaigns** — Build promotional landing pages (title, slug, hero image, banner color, curated products, active toggle) published at `/campaign/[slug]`. Feature-gated ("Campaign pages").
- **Abandoned Carts** — Carts abandoned in the last 24/48/72 hours with item previews and one-click reminder emails. Feature-gated ("Cart recovery").
- **Categories** — Manage product categories + subcategories (shareable across categories); each category can link to a Group via a dropdown. Storefront header nav and hero chips auto-sync with the category list — deleted categories disappear, new ones appear
- **Category Order** — Drag-and-drop ordering of the category grid displayed on the storefront
- **Orders** — View all customer orders with shipping details, status updates, branch assignment, coupon/gift-card discount display, and full or per-line-item refunds with a refund history panel
- **Users & Permissions** — Staff management, fine-grained role-based permissions (editable for all roles)
- **Roles** — Define custom roles with granular permission toggles (messaging, invoicing, credit notes, quotes, etc.)
- **Plans** — Create/edit/delete tiered subscription plans with feature checkboxes (58+ available features). Plans can be activated/deactivated to control visibility on the public pricing page. Inactive plans are hidden from customers. Plan editor features organized into 11 collapsible groups (Core Commerce, Inventory & Stock, Invoicing & Finance, Repairs & Service, Customer Engagement, WhatsApp & Communication, Multi-Location, Marketing & Storefront, Analytics & Security, Support & Account, Payments & Currency) with select-all toggles per group and feature count badges.
- **Providers** — View providers, assign plans, custom pricing, status
- **Invoices** — Generate invoices per provider, mark paid, PDF download for order invoices
- **Credit Notes** — Create eTIMS-compliant credit notes from invoices in admin and owner views, with printable audit details and submission tracking, PDF download
- **Reports** — 5 sub-tabs: Sales Report with combined/per-branch filtering, channel breakdown (Storefront / POS / Quote), and export to Excel/PDF, Employee Sales, Technician Performance, Purchases Report, and Stock Summary
- **Stock on Hand** — Current stock levels per branch (filter by branch), snapshot history, low-stock alerts
- **Stock Transfers** — Create and manage inter-branch stock transfers with pending/complete/reject workflow; completing a transfer actually moves stock between branches with dual movement records
- **Stock Take** — Create sessions, count inventory, view variance, auto-apply adjustments
- **Purchases** — Create and manage purchase orders with supplier selection, product line items, status workflow (pending → ordered → received), inline per-item receiving with quantity inputs, branded PDF generation/download, soft-delete with completed/deleted views, and one-click restore
- **Messages** — Admin messaging panel: conversation list with unread badges, chat view with read receipts, inline reply, compose new messages (pick customer + provider). Auto-polls every 30 seconds.
- **Reviews** — View all product reviews with customer name, product, rating, date, and comment. Delete reviews for moderation. Paginated list.
- **Spec Templates** — Define per-category spec fields for products
- **Suppliers** — Manage vendor/supplier directory with contact details, active status
- **Branches** — Manage physical store locations with per-branch subscription plans (each branch can have its own plan independent of the shop-wide plan)
- **Clients** — Multi-tenant client management with per-client branches
- **About Us** — Edit title, content, mission, vision for the /about page
- **Storefront** — Choose layout theme (Original, Amazon, Jumia, Mobile), manage promotional banners
- **Splashes** — Create/edit/delete promotional banners with quick presets (Black Friday, Happy Hour, Christmas, New Year Sale, Back to School), custom background/text colors, marquee vs static toggle, active date ranges, and on/off toggle. Kenyan holidays auto-displayed with themed colors.
- **Shop Subscription** — View current plan, activate new plan, approve/reject owner requests
- **Settings** — Store info, M-Pesa config, store logo upload with position selector (top-left/top-middle/top-right), currency, configurable POS payment methods (add/edit/remove with KRA codes), eTIMS/KRA compliance (VSCU/OSCU mode selector with branch, device, API settings), image storage (Cloudinary primary + optional database backup toggle), exchange rates, and **Storefront** page for layout management (activate, create dynamic JSON layouts, reorder)

### Owner Panel (`/owner`)

Business oversight with 13 sections. Shares many components with the admin panel (Products, Providers, Credit Notes, About Us, Product Positioning, Stock Take, Stock on Hand). Feature gating at the routing level controls which sections are visible based on the subscription plan.

- **Dashboard** — Stats with animated counters (open repairs, due today, total orders, revenue, products in stock, low stock items), all cards clickable to navigate
- **Products** — View products catalog
- **Providers** — View provider list
- **Customers** — View customer list
- **Messages** — Two-panel chat UI with real-time polling, unread badges, notification bell
- **Quotes** — Create hardware quotes for customers (product search, line items editor, price/quantity)
- **Reports** — Sales Report with per-branch and combined filtering
- **Stock Control** — Snapshot management (view/take snapshots, date picker, history), current stock levels with low-stock alerts
- **Stock Take** — Create/delete sessions, navigate to session page
- **Tech Repairs** — Technician performance reports (filterable by date range)
- **About Us** — Edit the /about page content
- **Storefront** — Change layout theme, manage promotional banners (only if role is Admin) and select the active storefront theme for the public site
- **Shop Subscription** — View current plan, request plan change (admin approves). Branch Plans table shows each branch's individual plan with Change Plan dropdown.
- **Audit Log** — View all actions except admin actions (owner sees non-admin activity with user names, timestamps, entity details)

### Back Office (`/backoffice`)

Staff operations:
- Dashboard (open repairs, due today, scheduled, unassigned counts)
- Repair tickets (assign technicians, update status, notes, parts, pricing, images, **send cost estimates to customers**)
- Calendar view
- Parts management
- Stock control (levels, low-stock alerts, movement history)
- Purchasing (purchase orders, itemised receiving)
- Reports (tech performance, sales)
- Quick link to public site

---

## Design System & UI/UX (2026 Refactor)

### CSS Design Tokens (`globals.css`)

A comprehensive token-based design system with CSS custom properties:

| Token Category | Examples |
|----------------|---------|
| **Spacing** | `--space-1` through `--space-12` (4px–48px scale) |
| **Typography** | `--text-xs` through `--text-3xl`, `--font-*` weights, `--leading-*` line heights |
| **Colors** | `--text`, `--text-secondary`, `--text-tertiary`, `--bg`, `--surface`, `--border`, `--primary`, `--primary-subtle`, semantic colors (`--success`, `--danger`, `--warning`, `--info`) with light variants |
| **Shadows** | `--shadow-sm` through `--shadow-2xl` |
| **Radii** | `--radius-sm` through `--radius-full` |
| **Animation** | `--duration-fast`, `--duration-normal`, `--duration-slow`, `--ease-out`, `--ease-bounce` |

Dark/light themes use `[data-theme="dark"]` / `[data-theme="light"]` selectors, persisted in `localStorage`.

### Animation System (`animations.css`)

350+ lines of GPU-accelerated animations with `prefers-reduced-motion` support:

| Category | Effects |
|----------|---------|
| **Page transitions** | Fade, slide up/down/left/right, scale, blur, `page-enter` class |
| **Button effects** | Ripple on click, press bounce (`.micro-bounce`), loading spinner, variants |
| **Tables** | Row fade-in stagger, shimmer skeleton placeholders |
| **Forms** | Focus scale + glow |
| **Dashboard** | Stat grid stagger entrance, card hover lift, animated counters |
| **Loading** | Shimmer skeleton, loading bar, full-screen gear loading screen |
| **Toast** | Slide-in/out notifications, auto-dismiss |
| **Skeleton** | Shimmer animation for all placeholder sizes |
| **Scroll reveal** | IntersectionObserver-based entrance animations (up/left/right/scale) |

### Reusable Component Library (`components/ui/`)

| Component | Purpose |
|-----------|---------|
| `Button` | Variants (primary/secondary/ghost/danger/subtle), sizes (sm/md/lg), loading state, block mode, ripple effect |
| `ButtonLink` | Anchor tag styled as a button |
| `Card` | With optional `hover`, `clickable`, `padding` props; sub-components `CardHeader`, `CardBody`, `CardFooter` |
| `Input` | With label, error message, hint, accessible `aria-*` attributes |
| `Select` | Dropdown with label + error state |
| `Textarea` | Textarea with label + error state |
| `Modal` | Overlay dialog with title, body, footer, size variants (sm/md/lg/xl), ESC to close, backdrop click to close |
| `Badge` | Variants (default/primary/success/warning/danger/info) |
| `StatCard` | Animated counter, icon, trend indicator (up/down), color accent |
| `Skeleton` | Text, heading, avatar, thumbnail, card, table, stats — all shimmer-based |
| `EmptyState` | Icon + title + description + optional CTA |

### Legacy Components (pre-refactor, still in use)

| Component | Purpose |
|-----------|---------|
| `LoadingScreen` | Full-screen loading overlay with animated SVG gears, progress bar, percentage, cycling messages, smooth fade-out+zoom exit |
| `Toast` | Context-based notification system — success/error/warning/info types, auto-dismiss (4s), slide-in/out, backdrop blur, accessible `aria-live` |
| `AnimatedCounter` | Number counting animation with cubic-bezier easing, requestAnimationFrame, tabular-nums |
| `RippleButton` | Pre-refactor button with ripple effect, press bounce, loading spinner, variant prop |
| `ScrollReveal` | IntersectionObserver-based entrance animations on scroll (up/left/right/scale) |
| `NotificationBell` | Unread message count badge with 30s polling |

### Layout Refactor

The main `Layout.tsx` now uses a responsive header with two modes:

**Default mode:**
- `.main-nav-desktop` — horizontal category nav spanning full width on the left (visible on screens >768px)
- `.header-right` — brand name, search, theme toggle, currency selector, and account actions

**Springboard mode** (admin-toggleable via Settings):
- Brand name at far left
- `.springboard-wrap` — dropdown button with hamburger icon + "Categories" label + arrow
- `.springboard-dropdown` — animated dropdown panel with all category links
- Click-outside to close, arrow rotates on open
- On mobile: label hides, only hamburger icon shows

Both modes share:
- `.mobile-menu-toggle` — hamburger button (visible on mobile)
- `.main-nav-mobile` — full-screen overlay menu (shown on toggle, hidden by default)
- Close-on-navigate behavior for mobile menu and springboard

### Error Handling

- **ErrorBoundary** in `_app.tsx` catches runtime render errors with a recovery UI (warning icon, message, refresh button)
- **Page transition wrapper** applies `page-enter` animation class on route change via `key={router.asPath}`

### Skeleton Loading States

All data-fetching pages now render shimmer skeleton placeholders instead of bare `<p>Loading...</p>` text:
- `index.tsx` — skeleton hero + grid of 8 product card skeletons
- `[category].tsx` — grid of 8 product card skeletons
- `cart.tsx` — skeleton cart items with image + text placeholders
- `product.tsx` — skeleton gallery + info side-by-side
- `my-repairs.tsx` — skeleton ticket cards
- `order.tsx` — skeleton card with shipping + items placeholder
- `repair-ticket.tsx` — skeleton card

### File Splitting (admin.tsx)

`admin.tsx` and `owner.tsx` share extracted components under `components/admin/`:
- **`components/admin/shared.tsx`** — extracted `useFetch`, `Spinner`, `ErrorMsg`, `formatPrice`, `escapeHtml` utilities
- **`components/admin/AdminProducts.tsx`** — Products CRUD (used by both admin and owner)
- **`components/admin/ProvidersPage.tsx`** — Provider management (used by both admin and owner)
- **`components/admin/CreditNotesPage.tsx`** — Credit notes list with PDF download (used by both admin and owner)
- **`components/admin/AboutUsPage.tsx`** — About Us content editor (used by both admin and owner)
- **`components/admin/ProductPositioningPage.tsx`** — Drag-and-drop product reorder (used by both admin and owner)
- **`components/admin/StockTakeListPage.tsx`** — Stock take session list (used by both admin and owner)
- **`components/admin/StockOnHandPage.tsx`** — Stock on hand with snapshots and low-stock alerts (used by both admin and owner, with optional auto-reorder for admin)
- **`components/admin/AdminLayouts.tsx`** — Storefront layout management: list, create dynamic JSON layouts, edit, activate, delete, reorder (used by both admin and owner)
- **`components/admin/CategoryPositioningPage.tsx`** — Drag-and-drop category reorder
- Feature gating in the owner panel is preserved at the routing level (nav items conditionally rendered based on `useFeature()` checks)

---

## Project Structure

```
frontend/                 # Next.js 14 (Pages Router + TypeScript)
├── components/
│   ├── ui/                   # Reusable component library
│   │   ├── index.ts             # Re-exports
│   │   ├── Button.tsx           # Variants, sizes, loading, ripple
│   │   ├── Card.tsx             # Card + Header/Body/Footer
│   │   ├── Input.tsx            # Input, Select, Textarea with labels/errors
│   │   ├── Modal.tsx            # Overlay dialog with sizes
│   │   ├── Badge.tsx            # Semantic badge variants
│   │   ├── StatCard.tsx         # Animated counter card
│   │   ├── Skeleton.tsx         # Re-export from legacy
│   │   └── EmptyState.tsx       # Re-export from legacy
│   ├── admin/                 # Admin/Owner shared extracted components
│   │   ├── shared.tsx            # useFetch, Spinner, ErrorMsg, formatPrice, escapeHtml
│   │   ├── AdminProducts.tsx     # Products CRUD section
│   │   ├── ProvidersPage.tsx     # Provider management
│   │   ├── CreditNotesPage.tsx   # Credit notes list
│   │   ├── AboutUsPage.tsx       # About Us editor
│   │   ├── ProductPositioningPage.tsx  # Drag-and-drop reorder
│   │   ├── StockTakeListPage.tsx # Stock take sessions
│   │   └── StockOnHandPage.tsx   # Stock on hand with snapshots
│   ├── owner/                 # Owner panel extracted components
│   ├── Layout.tsx            # Responsive header with mobile menu
│   ├── ProductCard.tsx       # Product card — strikethrough sale price display
│   ├── MarqueeBanner.tsx     # Kenyan holiday calendar + promotional banner marquee
│   ├── LoadingScreen.tsx     # Full-screen gear loading animation
│   ├── Toast.tsx             # Toast notification system (context + provider)
│   ├── AnimatedCounter.tsx   # Number counting animation
│   ├── Skeleton.tsx          # Skeleton loading components
│   ├── EmptyState.tsx        # Empty state illustrations
│   ├── RippleButton.tsx      # Button with ripple + press effects
│   ├── ScrollReveal.tsx      # IntersectionObserver entrance animations
│   └── NotificationBell.tsx  # Unread message count badge with 30s polling
├── lib/
│   ├── api.ts                # API client with token management
│   ├── app-context.tsx       # React context — auth, theme, cart, settings
│   ├── types.ts              # TypeScript interfaces
│   └── features.ts           # useFeature() hook for subscription feature gating
├── layouts/               # Storefront layout themes + runtime engine
│   ├── index.tsx              # Layout registry, provider, engine (fetches from backend, falls back to static)
│   ├── shared.ts              # formatPrice, escapeHtml utilities
│   ├── dynamic-engine.tsx     # Generic JSON layout renderer for runtime-created layouts
│   ├── original.tsx           # Original theme (clean, default site nav)
│   ├── amazon.tsx             # Amazon-style theme
│   ├── jumia.tsx              # Jumia-style theme
│   ├── mobile.tsx             # Mobile-optimised theme
│   └── custom.tsx             # Custom theme
├── pages/
│   ├── _app.tsx              # App wrapper with ErrorBoundary, page transitions
│   ├── _document.tsx         # Custom Document (data-theme attribute)
│   ├── index.tsx             # Home — skeleton loading + error state
│   ├── about.tsx             # About Us — editable by admin/owner
│   ├── [category].tsx        # Dynamic category pages — skeleton loading
│   ├── product.tsx           # Product detail — skeleton loading
│   ├── cart.tsx              # Checkout with shipping + M-Pesa — skeleton loading
│   ├── login.tsx             # Unified login (customer + staff)
│   ├── dashboard.tsx         # Role-based dashboard
│   ├── wishlist.tsx          # Wishlist + quotes
│   ├── contact.tsx           # Contact form
│   ├── repairs.tsx           # Repair services overview
│   ├── repair-book.tsx       # Repair booking form
│   ├── my-repairs.tsx        # Ticket tracking — skeleton loading
│   ├── orders.tsx            # Order history
│   ├── account.tsx           # Account details
│   ├── admin.tsx             # Admin panel (24 sections)
│   ├── owner.tsx             # Owner panel (13 sections, shares components with admin)
│   ├── backoffice.tsx        # Back office (repairs, stock, reports)
│   └── stock-take/
│       └── [id].tsx          # Dedicated stock take session page
├── styles/
│   ├── globals.css           # Design token system (dark/light via [data-theme])
│   └── animations.css        # 350+ lines — keyframes, utility classes,
│                               skeleton, toast, loading screen, scroll reveal
├── .babelrc                  # Babel config (SWC disabled on this platform)
├── next.config.js            # Proxies /api/* and /uploads/* to Express
├── tsconfig.json
└── package.json

server/                   # Express backend (TypeScript)
├── index.ts              # Express server — all API routes + static serving
├── db.ts                 # PostgreSQL database layer (async CRUD, migrations, seed)
├── db-helpers.ts         # Query utility functions (query, queryOne, queryAll, transaction)
├── schema.sql            # PostgreSQL schema (54 tables)
├── auth.ts               # JWT auth middleware + login/register
├── repairs.ts            # Repair ticket lifecycle
├── permissions.ts        # Role-based permissions + assignRoleToUser
├── categories.ts         # Category definitions (seeded into DB, editable via admin)
├── upload.ts             # Multer image upload (Cloudinary in production, local disk in dev)
├── shipping.ts           # Kenyan counties with tiered fees
├── mpesa.ts              # Daraja API STK Push
├── notify.ts             # Email notifications (shared transporter via email.ts)
└── routes/
    └── shared.ts         # Shared route utilities: asyncHandler, escapeHtml, requirePermission, renderStoreLogo, validation helpers (isEmail, isStr, isNum...), invoice/receipt/credit-note CSS templates

render.yaml              # Render.com deployment config
vercel.json              # Vercel deployment config
products.json            # Seed data (34 products)
data/
└── uploads/              # Local image storage (dev only; production uses Cloudinary)
```

---

## API Overview

### Public (no auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/public-settings` | Store name, phone, email, currency, logo, Google Client ID, M-Pesa till |
| GET | `/api/products` | All products (filter by `?category=` or `?group=`) |
| GET | `/api/products/:id` | Single product |
| GET | `/api/products/:id/images` | Gallery images |
| GET | `/api/products/:id/reviews` | Product reviews (paginated, returns distribution + total) |
| GET | `/api/categories` | All categories + subcategories |
| GET | `/api/categories/:id/subcategories` | Subcategories for a category |
| GET | `/api/subcategories` | All subcategories |
| GET | `/api/groups` | All active product groups (with product counts) for the storefront |
| GET | `/api/plans` | Active subscription plans |
| GET | `/api/layouts` | All storefront layouts (public, sorted by sort_order) |
| GET | `/api/shipping/counties` | All 47 Kenyan counties with fees |
| GET | `/api/repairs/statuses` | Repair status labels |
| GET | `/api/shop/features` | Active subscription features for feature-gating UI |
| GET | `/api/images/:refId` | DB-backed-up image (base64 served as binary) |
| GET | `/api/splashes` | Active promotional banners (public, filtered by date range) |
| GET | `/api/campaigns/:slug` | Public campaign landing page data (campaign + curated products) |

### Customer

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/customer/login` | Login with email + password |
| POST | `/api/customer/google-login` | Login/signup with Google credential token |
| GET | `/api/orders` | Customer order list |
| GET | `/api/orders/:id` | Order detail |
| GET | `/api/orders/:id/invoice` | HTML invoice/receipt (shipped/delivered orders only) |
| GET | `/api/repairs/mine` | Customer's repair tickets |
| GET | `/api/repairs/mine/:id` | Single ticket detail with visible updates |
| POST | `/api/repairs` | Create a repair ticket |
| POST | `/api/repairs/mine/:id/message` | Send message on a ticket |
| POST | `/api/repairs/:id/quote-response` | Accept/decline a cost estimate |
| GET | `/api/cart` | Cart items |
| POST | `/api/cart` | Add to cart |
| PATCH | `/api/cart/:productId` | Update quantity |
| DELETE | `/api/cart/:productId` | Remove from cart |
| GET | `/api/wishlist` | Saved products |
| POST | `/api/wishlist` | Add to wishlist |
| DELETE | `/api/wishlist/:productId` | Remove from wishlist |
| GET | `/api/quotes` | Hardware quotes |
| POST | `/api/quotes/from-wishlist` | Request quote from wishlist items |
| PATCH | `/api/quotes/:id/status` | Update quote status |
| POST | `/api/orders` | Place order with M-Pesa payment (accepts `couponCode`, `giftCardCode`, and `redeemPoints` — applied in order before the M-Pesa amount is calculated) |
| POST | `/api/gift-cards/validate` | Validate a gift card code and return remaining balance / applicable discount (customer auth) |
| POST | `/api/orders/create-pending` | Create pending order from cart (no details required, redirects to order detail) |
| PATCH | `/api/orders/:id` | Update pending order delivery details + payment method |
| GET | `/api/messages` | Messages with providers |
| POST | `/api/messages` | Send message to provider |
| GET | `/api/products/:id/reviews/check` | Check if current customer has reviewed this product |
| POST | `/api/products/:id/reviews` | Submit a review (1–5 star rating, optional title + comment) |
| PUT | `/api/products/:id/reviews/:reviewId` | Edit own review |
| DELETE | `/api/products/:id/reviews/:reviewId` | Delete own review |

### Staff (any staff role)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Staff login (email or username) |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/change-password` | Change own password |
| GET | `/api/backoffice/stats` | Dashboard stats |
| GET | `/api/staff/technicians` | Staff list |
| GET | `/api/reports/sales` | Sales report (filterable by date, `?branch_id=`, and `?group_id=`) |
| GET | `/api/reports/stock-summary` | Stock levels summary (filterable by `?group_id=`) |
| GET | `/api/stock-on-hand/current` | Current stock levels (requires `stock:on_hand`) |
| GET | `/api/stock-on-hand/history` | Snapshot date history (requires `stock:on_hand`) |
| GET | `/api/stock-on-hand/:date` | Stock on hand for a specific date (requires `stock:on_hand`) |
| POST | `/api/stock-on-hand/snapshot` | Create stock snapshot (requires `stock:on_hand`) |
| GET | `/api/stock-transfers` | List stock transfers (requires `stock:transfer`) |
| POST | `/api/stock-transfers` | Create a stock transfer (requires `stock:transfer`) |
| PUT | `/api/admin/stock/transfer/:id/complete` | Complete a pending transfer — actually moves stock between branches (requires `stock:transfer`) |
| POST | `/api/stock-transfers/:id/complete` | Complete a pending transfer (requires `stock:transfer`) |
| POST | `/api/stock-transfers/:id/reject` | Reject a pending transfer (requires `stock:transfer`) |
| GET | `/api/rates` | Public exchange rates (auto-fetched from open.er-api.com, cached 1h) |
| PUT | `/api/rates` | Set manual exchange rates (requires `settings:update`) |
| DELETE | `/api/rates` | Clear manual rates, resume auto-fetch (requires `settings:update`) |
| GET | `/api/admin/quotes` | List all quotes (requires `reports:view`) |
| POST | `/api/admin/quotes` | Create a quote for a customer (requires `reports:view`) |
| GET | `/api/stock-take` | List stock take sessions |
| POST | `/api/stock-take/start` | Start new session |
| DELETE | `/api/stock-take/:id` | Delete empty session |
| GET | `/api/stock-take/:id` | Session details |
| POST | `/api/stock-take/:id/items` | Save counted items |
| POST | `/api/stock-take/:id/complete` | Complete session, apply adjustments |
| GET | `/api/audit-log` | Audit trail (owner: excludes admin actions) |
| GET | `/api/shop/subscription` | Current shop subscription |
| POST | `/api/shop/subscription/request` | Request plan change (owner) |
| GET | `/api/shop/subscription/requests` | All requests (admin) |
| PUT | `/api/shop/subscription/request/:id` | Approve/reject request (admin) |
| PUT | `/api/shop/subscription` | Activate plan directly (admin) |

### Admin

Full CRUD for products, categories (including subcategories), staff, roles, plans, providers, orders, invoices, settings, stock, spec templates, M-Pesa configuration, storefront layout/themes, about-us content.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/products/import` | Bulk import products from JSON array (admin/owner only) — validates name, price, category on every row; aborts entire import on any invalid row |
| POST | `/api/admin/products/bulk-edit` | Bulk update product price, category, inStock for selected product IDs |
| GET | `/api/admin/products/:id/price-history` | Price change history for a product (last 50 changes) |
| GET | `/api/admin/groups` | List all product groups (including inactive) |
| POST | `/api/admin/groups` | Create a product group (name, isActive, sortOrder) |
| PUT | `/api/admin/groups/:id` | Update a product group (name, isActive, sortOrder) |
| DELETE | `/api/admin/groups/:id` | Delete a product group (unlinks products/categories) |
| GET | `/api/admin/splashes` | List all promotional banners |
| GET | `/api/admin/layouts` | List all storefront layouts (admin) |
| GET | `/api/admin/layouts/:id` | Get single layout details |
| POST | `/api/admin/layouts` | Create a new dynamic layout |
| PUT | `/api/admin/layouts/:id` | Update a layout (label, description, config) |
| DELETE | `/api/admin/layouts/:id` | Delete a dynamic layout (static layouts protected) |
| PUT | `/api/admin/layouts/:id/activate` | Activate a layout (sets it as storefront layout) |
| PUT | `/api/admin/layouts-reorder` | Reorder layouts |
| POST | `/api/admin/splashes` | Create a promotional banner |
| PUT | `/api/admin/splashes/:id` | Update a promotional banner |
| DELETE | `/api/admin/splashes/:id` | Delete a promotional banner |
| POST | `/api/settings/logo` | Upload store logo (Cloudinary) |
| PUT | `/api/settings/logo-position` | Update logo position (top-left/top-middle/top-right) |
| GET | `/api/admin/coupons` | List all coupons |
| POST | `/api/admin/coupons` | Create a coupon |
| GET | `/api/admin/gift-cards` | List all gift cards |
| POST | `/api/admin/gift-cards` | Create a gift card |
| PUT | `/api/admin/gift-cards/:id` | Update a gift card (code, balance, expiry, active, notes) |
| DELETE | `/api/admin/gift-cards/:id` | Delete a gift card |
| GET | `/api/admin/gift-cards/:id/redemptions` | Redemption history for a gift card |
| GET | `/api/admin/campaigns` | List all campaign landing pages |
| POST | `/api/admin/campaigns` | Create a campaign |
| PUT | `/api/admin/campaigns/:id` | Update a campaign |
| DELETE | `/api/admin/campaigns/:id` | Delete a campaign |
| GET | `/api/admin/abandoned-carts` | Abandoned carts in the last N hours (`?hours=`) plus reminder history |
| POST | `/api/admin/abandoned-carts/send-reminder` | Send a cart recovery reminder email to a customer |
| GET | `/api/admin/orders/:id/refunds` | Refund history for an order |
| POST | `/api/admin/orders/:id/refunds` | Create a full or per-line-item refund |
| PUT | `/api/admin/branches/:id/plan` | Set a branch's subscription plan |
| GET | `/api/admin/branches/:id/subscription` | Get branch subscription details |
| GET | `/api/admin/branches/:id/features` | Get branch feature list |
| GET | `/api/admin/stock/by-branch/:branchId` | Get stock summary for a specific branch |
| GET | `/api/admin/stock/product/:productId/branches` | Get stock level for a product across all branches |
| PUT | `/api/admin/coupons/:id` | Update a coupon |
| DELETE | `/api/admin/coupons/:id` | Delete a coupon |
| POST | `/api/coupons/validate` | Validate a coupon code at checkout (customer auth) |
| GET | `/api/admin/suppliers` | List all suppliers |
| POST | `/api/admin/suppliers` | Create a supplier |
| PUT | `/api/admin/suppliers/:id` | Update a supplier |
| DELETE | `/api/admin/suppliers/:id` | Delete a supplier |
| GET | `/api/reports/sales/trends` | Daily revenue trend data for charting (filterable by date and branch) |
| GET | `/api/admin/reviews` | All reviews with pagination (admin moderation) |
| DELETE | `/api/admin/products/:id/reviews/:reviewId` | Delete a review (admin moderation) |
| GET | `/api/admin/backup` | Download full database backup file |
| GET | `/api/purchases/deleted` | List soft-deleted purchase orders |
| GET | `/api/purchases/completed` | List completed (received) purchase orders |
| POST | `/api/purchases/:id/restore` | Restore a soft-deleted purchase order |
| GET | `/api/purchases/:id/pdf` | Download branded PDF of a purchase order (accepts query token) |

### Provider

Provider registration, login, subscription details, invoices, products at tier, messaging with customers, order management.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/provider/orders` | View all orders |
| GET | `/api/provider/orders/:id` | View single order detail |
| PATCH | `/api/provider/orders/:id/items/:itemId/cancel` | Cancel an individual order item |
| PATCH | `/api/provider/orders/:id/status` | Update order status (confirmed/shipped/delivered/cancelled) — sends email to customer |

---

## Authentication & Permissions

1. **Unified login** at `/login` with customer + staff/provider tabs
2. **Google Sign-In** via Google Identity Services — button appears on Customer tab when `GOOGLE_CLIENT_ID` is configured in `.env`
3. **Three token types** stored in localStorage: `customerStoreToken`, `computerStoreToken`, `providerToken`
4. **JWT tokens**: Signed with `JWT_SECRET` (required — server fails without it). Staff tokens expire in **24 hours**, customer tokens in **7 days**. No query-string token support.
5. **Rate limiting**: 10 login/register/password-reset attempts per IP per 15 minutes.
6. **Role-based access**:
   - Admin: full access to `/admin` and `/backoffice`
   - Owner: access to `/owner` (elevated business oversight)
   - Technician: restricted to `/backoffice` (repairs, stock)
7. **Permission system**: `hasPermission()` checks both `role_permissions` and `user_permissions` tables; `assignRoleToUser()` syncs `users.role` to `user_roles`. Built-in roles (admin, manager, technician, owner) can have their permissions customized. Permissions include `staff:*`, `repair:*`, `product:*`, `stock:*` (list, update, view_low, on_hand, transfer), `settings:*`, `calendar:*`, `reports:*`, `messaging:*` (view, send), `invoice:*` (view, download), `credit_note:*` (view, create), `quote:*` (view, create, update).
8. **Audit log permission model**: Admin sees all actions; Owner sees all non-admin actions (filtered by `actor_role != 'admin'`)

---

## Branch Management

### Branches
- Create and manage physical store locations from the **Branches** page
- Each branch has a name, address, phone, email, active status, and **subscription plan**
- Branches can have their own subscription plan independent of the shop-wide plan
- When a new branch is created, it defaults to the shop's current plan
- Branch plan controls which features are available at that branch (POS, invoicing, stock management, etc.)

### Per-Branch Stock
- Stock levels tracked independently per branch via the `stock_levels` table
- Stock on Hand page has a branch filter dropdown to view stock at a specific branch
- Stock Take sessions can be scoped to a specific branch
- Completing a stock transfer deducts from the source branch and increments at the destination branch
- Two movement records created per transfer (transfer_out at source, transfer_in at destination)

### Stock on Hand
- Standalone page in the admin Stock nav
- View current stock levels with branch filter (All Branches or specific branch)
- Low-stock alerts
- Take daily snapshots to record inventory at a point in time
- Browse historical snapshots by date

### Stock Transfers
- Move stock between branches with a pending/complete/reject workflow
- Protected by the `stock:transfer` permission
- Accessible from the **Stock Transfers** page in the admin Stock nav
- Shows source and destination stock levels when creating a transfer
- Warns if source branch has insufficient stock
- Completing a transfer actually moves stock (deducts source, increments destination)

## Stock Take Workflow

1. Start a session from admin or owner panel (select a branch to scope the session)
2. Navigate to `/stock-take/[id]` for the dedicated session page
3. Count items using the table input (product name, expected qty, counted qty)
4. View variance report (green = match, yellow = over, red = under)
5. Complete the session to auto-apply inventory adjustments
6. Sessions with counted items cannot be deleted (only empty sessions)

---

## Known Issues

- **Production build**: Corrupt `@next/swc-win32-x64-msvc` binary — must use Babel (`.babelrc` enables it). Run with `node node_modules\next\dist\bin\next dev -p 3000` (frontend) and `npm run dev` (backend) in separate terminals
- **Babel runtime**: `@babel/runtime` must be v7.x (v8.0.0 breaks subpath exports). Locked to `^7.26.0`
- **Dev startup**: `npm run dev` in the root fails due to path spaces on Windows; use `npm run dev:all` or start servers separately. The backend `npm run dev` now uses `tsx watch` for auto-restart on file changes.
- **JWT_SECRET change invalidates all sessions**: After deployment or restart with a new secret, all users must re-login. There is no token refresh/revocation mechanism — tokens expire on their own (24h staff, 7d customer).
- **M-Pesa callback**: Validates that the body contains `Body.stkCallback.CheckoutRequestID` but does not verify an HMAC signature — add IP allowlisting at the reverse proxy level for production.

---

## Theme System

- Dark mode by default, light/dark toggle in header and all admin panels
- Persists in `localStorage`
- CSS custom properties via `[data-theme="dark"]` / `[data-theme="light"]` selectors in `globals.css` (`--bg`, `--surface`, `--text`, `--primary`, `--border`, etc.)
- `prefers-reduced-motion` respected — all animations disabled when user prefers reduced motion
- GPU acceleration via `will-change` and `transform`/`opacity`-only animations

## Storefront Layouts

Five built-in layout themes controlled by admin via the Storefront panel, which also includes a dynamic layout manager for creating custom layouts from JSON config:

| Layout | Key | Description |
|--------|-----|-------------|
| **Original** | `original` | Clean default layout with premium hero section (animated glows, floating particles, product carousel, glassmorphism buttons, wave transition), standard site header |
| **Amazon Style** | `amazon` | Large search bar, horizontal categories, product recommendations, featured deals |
| **Jumia Style** | `jumia` | Promotional sliders, flash sales, daily deals, category icons |
| **Mobile** | `mobile` | Premium minimalist, hero banners, brand chips, compare specs |
| **Custom** | `custom` | Flexible layout for custom hero sections, featured categories, and responsive card panels |

Each layout provides its own `Header`, `Footer`, `HomePage`, and `LayoutStyles` components. The admin can switch layouts and manage promotional banners from both the Admin and Owner panels.

## Adding a New Storefront Layout

There are two ways to add new layouts:

### Option 1: Runtime Dynamic Layout (Admin UI — no code required)

1. Go to **Admin → Settings → Storefront** (or **Owner → Settings → Storefront**)
2. Click **"+ New Dynamic Layout"**
3. Fill in the layout key, label, description, and JSON config
4. The JSON config supports these section types:
   - `product-grid` — configurable columns, filter (all/featured/sale/newest), limit
   - `category-grid` — cards or icons style, configurable columns
   - `banner` — image URL + link, or text banner with colors
   - `stats` — icon + value + label stat cards
   - `text` — title + content text block
   - `spacer` — configurable height spacer
5. Hero styles: `carousel` (auto-rotating featured products), `split` (two-column with image), `minimal` (centered text), `none`
6. Product card styles: `default`, `compact`, `detailed`
7. Click **Create Layout**, then **Activate** it
8. The layout is rendered by the generic JSON layout engine (`frontend/layouts/dynamic-engine.tsx`)

### Option 2: Static Code Module (Developer — requires rebuild)

To add a new storefront layout theme, create a new module under `frontend/layouts/` and register it in `frontend/layouts/index.tsx`.

1. Create a new file, for example `frontend/layouts/custom.tsx`.
2. Export these members from the module:
   - `LAYOUT_KEY` – a unique string key for the layout
   - `LAYOUT_LABEL` – a friendly name shown in the admin selector
   - `LAYOUT_DESC` – a short description
   - `LayoutStyles()` – layout-specific CSS/JSX style declarations
   - `Header(props)` – the marketplace header component
   - `Footer(props)` – the storefront footer component
   - `HomePage(props)` – the homepage content renderer
3. Register the layout in `frontend/layouts/index.tsx`:
   - import the layout module
   - add it to the `STATIC_LAYOUTS` record
4. The layout becomes available in the admin storefront selector once the app reloads and the `layout` setting matches the new `LAYOUT_KEY`.

### Example module shape

```tsx
export const LAYOUT_KEY = "custom";
export const LAYOUT_LABEL = "Custom";
export const LAYOUT_DESC = "Flexible layout with hero banners and featured cards.";

export function LayoutStyles() {
  return <style>{`/* custom layout styles */`}</style>;
}

export function Header({ categories, settings, isLoggedIn, userName, cartCount, isDark, toggleDark, logout, isStaff }) {
  return <header>...custom header markup...</header>;
}

export function Footer({ settings }) {
  return <footer>...custom footer markup...</footer>;
}

export function HomePage({ products, categories, banners }) {
  return <main>...homepage content...</main>;
}
```

### Current limitation

Runtime dynamic layouts created via the admin UI use a JSON config schema. For layouts requiring custom React components (animations, complex interactions, server-side data fetching), create a static code module under `frontend/layouts/` and register it in `frontend/layouts/index.tsx`.

---

## Google Sign-In Setup

To enable Google sign-in for customers and staff:

1. **Go to** [console.cloud.google.com](https://console.cloud.google.com/apis/credentials)
2. **Create a project** (or select an existing one) from the top dropdown
3. **Configure OAuth consent screen** — navigate to **APIs & Services → OAuth consent screen**
   - Choose **External** user type (Internal only works for Google Workspace)
   - Fill in **App name**, **User support email**, and **Developer contact information**
   - Skip the Scopes and Test users sections for now (you can come back later)
4. **Create credentials** — go to **APIs & Services → Credentials**
   - Click **+ Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: e.g. "Gear&Glitch Web Client"
   - Under **Authorized JavaScript origins**, add:
     - `http://localhost:8020` (for development)
     - `https://your-domain.com` (for production)
   - Click **Create**
5. **Copy the Client ID** shown in the popup and add it to `.env`:

   ```env
   GOOGLE_CLIENT_ID=123456789-xxxxx.apps.googleusercontent.com
   ```

6. **Restart the server** — the Google sign-in button will now appear on the Customer login page and the Admin login page (when `GOOGLE_CLIENT_ID` is set).

> **Note:** Publishing the OAuth consent screen is only required for production. In testing, you must add each test user's email under **OAuth consent screen → Test users**. Up to 100 test users are allowed without verification.

---

## Security

### CSV Injection Prevention (Excel Export)
The sales report Excel export feature (`admin.tsx: exportExcel`) generates CSV files with a dedicated `csvCell()` sanitizer that:
- Wraps all cell values in double quotes with proper escaping of embedded quotes
- Prefixes cell values starting with `=`, `+`, `-`, or `@` with a single quote (`'`) to prevent Excel from interpreting them as executable formulas
- Includes a UTF-8 BOM (`\uFEFF`) for correct encoding detection by Excel

### XSS Escaping in PDF Export
The PDF export feature (`admin.tsx: exportPdf`) renders report data into a printable HTML document. All user-controlled values (customer names, product names, branch names, order statuses) are passed through the existing `escapeHtml()` utility before being interpolated into the HTML template, preventing stored cross-site scripting.

### Admin-Only Import Endpoint
The `POST /api/products/import` bulk product import endpoint is guarded by `ownerAuthMiddleware` (admin/owner role only), not the broader staff permission system. This ensures only store administrators can perform bulk imports, not technicians or staff with `product:create` permissions.

### POS Security
The POS checkout endpoint (`POST /api/pos/checkout`) enforces:
- **Quantity validation** — non-integer or `<= 0` quantities rejected with a clear error
- **Stock validation** — `getStockLevel()` checked per item; insufficient stock rejected before order creation
- **Payment method validation** — method must match one of the configured methods (admin-managed via Settings)
- **Idempotency** — client sends an `idempotencyKey`; duplicate requests return the cached order instead of re-charging
- **Request size limit** — maximum 100 items per checkout request
- **Staff audit trail** — `processed_by` column records which staff member processed each POS order

### eTIMS / KRA Compliance
The system supports both VSCU (local JAR bridge) and OSCU (cloud API) eTIMS modes selectable in admin settings. See `eTIMS_INTEGRATION.md` for the full compliance document, including invoice number format, SHA-256 control codes, two-step sales pipeline, tax type codes (A/E), QR code generation, and all invoice templates (customer, admin, POS thermal/A4).

---

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8020 | Server port |
| `STORE_NAME` | Gear&Glitch | Default store name seeded on first boot (control plane sets this to the client's name on provisioning) |
| `DATABASE_URL` | — | **Required.** PostgreSQL connection string (e.g. `postgresql://user:pass@host:5432/dbname`) |
| `JWT_SECRET` | — | **Required.** Server fails to start if unset or placeholder. Use a long random string. |
| `ADMIN_USERNAME` | admin | Admin username |
| `ADMIN_EMAIL` | admin@gearandglitch.com | Admin email |
| `ADMIN_PASSWORD` | `admin123` (dev) | **Required in production** — skips admin creation if unset |
| `TECH_USERNAME` | technician | Technician username |
| `TECH_EMAIL` | tech@gearandglitch.com | Technician email |
| `TECH_PASSWORD` | `tech123` (dev) | **Required in production** — skips tech creation if unset |
| `NODE_ENV` | — | Set to `production` to disable demo accounts and weak-password fallbacks |
| `CORS_ORIGIN` | `true` (allow all) | Allowed origin(s) for CORS. Set to your frontend URL in production. |
| `SMTP_HOST` | (blank) | SMTP server |
| `SMTP_PORT` | 587 | SMTP port |
| `SMTP_USER` | | SMTP username |
| `SMTP_PASS` | | SMTP password |
| `SITE_NAME` | Gear&Glitch | Brand name in emails |
| `GOOGLE_CLIENT_ID` | | Google OAuth client ID |
| `MPESA_CONSUMER_KEY` | | Set via admin UI or env |
| `MPESA_CONSUMER_SECRET` | | |
| `MPESA_PASSKEY` | | |
| `MPESA_SHORTCODE` | | |
| `MPESA_TILL_NUMBER` | | Displayed at checkout |
| `MPESA_ENV` | sandbox | `sandbox` or `production` |
| `CLOUDINARY_CLOUD_NAME` | | Cloudinary cloud name (required for image uploads in production) |
| `CLOUDINARY_API_KEY` | | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | | Cloudinary API secret |
| `CLOUDINARY_FOLDER` | gear-glitch | Cloudinary folder for uploaded images |

---

## Development

### Commands

```bash
npm run dev:all          # Both servers in one terminal
npm start                # Express production (port 8020)
npm run dev              # Express dev with auto-restart
npm run typecheck        # TypeScript check

cd frontend
npm run dev              # Next.js dev server (port 3000)
npm run build            # Production build
npm start                # Serve production build
```

### Notes

- Backend only exposes `/uploads` to clients
- Images stored on Cloudinary in production (free tier, 25GB) with automatic fallback to local `data/uploads/` in development. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` env vars. Admin can enable **database backup** in Settings → Image Storage to also store every uploaded image as base64 in PostgreSQL via the `stored_images` table. Backed-up images are served at `/api/images/:refId`.
- M-Pesa STK Push — simulated when credentials not configured. Callback validates `Body.stkCallback.CheckoutRequestID`. Phone numbers masked in `data/mpesa.log`.
- All 47 Kenyan counties with tiered delivery fees
- To reset the database, drop and recreate the PostgreSQL schema (tables are auto-created on server start)
- Security headers applied via Helmet (CSP disabled for inline styles). CORS origin configurable via `CORS_ORIGIN`. Rate limiting: 200 req/15min global, 10 req/15min on auth routes. All async route handlers wrapped with `asyncHandler` middleware to prevent server crashes from unhandled promise rejections.
- Error responses return generic messages — internal error details are not exposed to clients.
- **Tax system**: Global tax rate configurable in Settings (default 16%). Each product has a taxable toggle (eTims-compatible).
- **Currency system**: Storefront auto-detects user's currency via timezone/locale. Exchange rates auto-fetched from open.er-api.com (cached 1h). Admin can override with custom rates in Settings. Currency selector appears in all storefront layout headers.
- **Quotations**: Admin panel has a dedicated Quotations section under Sales for creating and managing hardware quotes. Quote PDFs include the store logo. PDF downloads available via `?format=pdf` query param.
- **Server-side PDF Generation**: Uses `puppeteer-core` + `@sparticuz/chromium` for serverless-friendly PDF generation. Any HTML document endpoint (invoices, credit notes, quotes) supports `?format=pdf` to return a real PDF file. Falls back to HTML on error. Chromium browser instance is reused across requests and gracefully shuts down on SIGTERM/SIGINT.
- **Admin Messaging**: Full messaging panel in the admin Activity section. Conversation list with partner names, unread badges, and last message preview. Chat view with bubble messages, sender labels, timestamps, and read receipts. Compose new messages between customers and providers. Auto-polls every 30 seconds.
- **Sale Price / Strikethrough Pricing**: Products support an optional sale price field. When set, all UI surfaces (product cards, product detail, POS grid, admin/owner tables) show the original price with strikethrough and the sale price in red. POS charges the sale price automatically.
- **Product Rating & Review System**: Customers can rate products (1–5 stars) and leave reviews. One review per customer per product enforced at the DB level (`UNIQUE INDEX`). Product detail page shows a clickable star rating widget, rating distribution bar chart, average rating with visual stars, and paginated reviews (10 per page). Customers can edit and delete their own reviews. Product cards on category pages show the real average star rating fetched from the DB. Admin panel has a Reviews management section for moderation (view all, delete). DB constraints: `CHECK(rating >= 1 AND rating <= 5)`, indexes on `product_id` and `customer_id`. Uses `RETURNING *` for immediate response after insert.
- **Promotional Banners (Splashes)**: Admin can create marquee or static banners with custom colors, date ranges, and on/off toggle. Quick presets for common events. The MarqueeBanner component also auto-displays Kenyan public holidays with themed gradients and taglines.
- **Store Logo**: Upload a store logo from admin Settings. Logo appears on POS receipts (thermal + A4), customer invoices, admin order invoices, credit notes, quote PDFs, and purchase order PDFs. Position configurable (top-left/top-middle/top-right). Displayed at 64px height in all storefront headers for prominent branding.
- **Product Deletion**: All product-referencing tables use `ON DELETE CASCADE`. Deleting a product automatically removes related order items, quote items, stock records, price history, and reviews.
- **Sales Report**: Includes per-branch breakdown table when viewing combined data, plus date range and branch filter, daily revenue trend chart (SVG), and export to Excel (CSV) or printable PDF.
- **Coupons**: Admin can create percentage or fixed discount codes with min order, max uses, and expiry. Customers apply at checkout. Discount recorded per order.
- **Gift cards**: Admins issue cards with a unique code, value, optional expiry, and notes (`gift_cards` table). At storefront checkout customers enter the code and the balance is applied in order: coupon → gift card → loyalty points, so M-Pesa only charges the remainder. Redemptions are recorded per order in `gift_card_redemptions` with an audit trail; the admin panel shows per-card redemption history. Validated server-side via `validateGiftCard`/`redeemGiftCard` in `server/db.ts`.
- **Campaign landing pages**: Admin-created campaigns (`campaigns` table) render on public `/campaign/[slug]` pages via `GET /api/campaigns/:slug` — hero banner with custom color and a grid of curated products. Feature-gated behind "Campaign pages".
- **Abandoned cart recovery**: `listAbandonedCarts(hours)` returns carts whose items haven't been touched in the last N hours (with product/item previews); admin sends one-click reminder emails via the shared email engine (`sendEmail(..., "cart_recovery")`), each recorded in `cart_recovery_reminders`. Feature-gated behind "Cart recovery".
- **Refunds**: Admins can refund an entire order or individual lines with a reason. Refunds live in the `refunds` table, are summed into `orders.amount_refunded`, and per-line refunds mark the order item cancelled. Refund history is shown in the order detail panel.
- **Sales by channel**: Orders carry a `source` tag — `storefront` (online checkout), `pos` (POS), or `quote` (quote-to-order conversion). A migration backfills legacy orders by inspecting `branch_id`, `processed_by`, and `notes`. The Sales Report's channel breakdown aggregates revenue by source.
- **Bulk Edit**: Products table supports multi-select with checkboxes and bulk price/category/stock updates.
- **Price History**: Every price change is automatically recorded and viewable per product.
- **Database Backup**: PostgreSQL backups are handled by your provider (Neon, Railway, etc.) — enable automatic backups. Product images are stored on Cloudinary (production) or `data/uploads/` (dev).

---

## Deployment Checklist

1. **Provision PostgreSQL** — create a database on [Neon](https://neon.tech), Railway, or Render Postgres
2. **Set `DATABASE_URL`** — PostgreSQL connection string (e.g. `postgresql://user:pass@host:5432/dbname`)
3. **Set `JWT_SECRET`** to a long random string — server will not start without it
4. **Set `ADMIN_PASSWORD` and `TECH_PASSWORD`** — users won't be created if unset in production
5. **Set `NODE_ENV=production`** — disables demo accounts, disables weak-password fallbacks
6. **Set `CORS_ORIGIN`** to your frontend URL (e.g. `https://mystore.com`)
7. **Configure `SMTP_*`** for real email
8. **Create a free [Cloudinary](https://cloudinary.com) account** — set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in Render env vars. Images uploaded without Cloudinary fall back to local disk (lost on Render redeploy).
9. **Use HTTPS** behind a reverse proxy (nginx, Caddy, Cloudflare) — all traffic (passwords, tokens, M-Pesa data) is unprotected without TLS
10. **Marketing page** (operator only) — set `NEXT_PUBLIC_MARKETING_ENABLED=true` on your main Vercel deployment to enable the `/marketing` landing page. Client deployments created via the control plane don't set this, so their `/marketing` renders a "not available" page.
11. Build backend: `npm run build`
12. Build frontend: `cd frontend && npm run build`
11. Run with a process manager (PM2, systemd, etc.) or deploy to Render.com / Vercel
12. Back up images — Cloudinary stores uploads in production; local `data/uploads/` is ephemeral on Render
13. Optional: enable **database backup for images** in admin Settings → Image Storage (stores base64 in PostgreSQL `stored_images` table alongside Cloudinary)
