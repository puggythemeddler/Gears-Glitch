# Gear&Glitch — Full-Stack Shop & Management System

A complete multi-branch sales & management system with product catalog, customer accounts, shopping cart, repair ticketing, provider subscriptions, invoices, order management, analytics, stock control, stock take, inter-branch stock transfers, audit logging, role-based dashboards (Admin, Owner, Technician), 5 storefront layout themes (Original, Amazon, Jumia, Mobile, Custom), subcategories with multi-category sharing, About Us page with owner-editable content, unified login (Google SSI supported), M-Pesa payments with callback validation, Kenyan county shipping, product image galleries with gallery + primary image management, search across all products, dark/light theme toggle, sale price (strikethrough pricing), promotional banners/splashes with Kenyan holiday calendar, store logo on all invoices/receipts/quotes, configurable logo position, server-side PDF downloads (invoices, credit notes, quotes), admin messaging panel, feature-gated subscription plans, purchase order management, auto-email notifications, WhatsApp Business API integration (bidirectional messaging with 24h window tracking), product rating & review system with interactive star ratings, rating distribution charts, per-customer review limits, customer edit/delete, and admin moderation, two-step checkout with delivery details and payment method selection, provider order management (view, cancel items, update status), and customer invoice download from order history. Runs on Node.js + PostgreSQL (backend) with Next.js (frontend), deployed on Render.com (backend) + Vercel (frontend) with PostgreSQL via Neon.

## Recent highlights

- **WhatsApp Business API integration** — Bidirectional WhatsApp messaging via Meta's Cloud API. Outbound messages from admin/customer/provider messaging panel are sent via WhatsApp to the recipient. Inbound WhatsApp messages from customers appear in the admin messaging panel. Respects the 24-hour messaging window (free-form within 24h, template messages outside). Admin WhatsApp settings panel with connection test, webhook URL display, conversation tracking, and full message log. Phone number auto-mapping to existing customers/providers.
- **Stock take updates stock on hand** — Completing or applying a stock take now correctly adjusts `stock_levels.quantity_in_stock` for each counted product. The frontend also saves all unsaved count inputs before calling the complete endpoint, preventing data loss when clicking "Complete & Apply" without blurring inputs.
- **Purchase receive updates stock** — Receiving a purchase order item now calculates the delta (new received − previous received) and adds it to `stock_levels.quantity_in_stock` with a corresponding `purchase_receive` stock movement record.
- **Invoice view in new tab** — The admin "View" button on order invoices now opens the HTML invoice in a new browser tab instead of attempting a PDF download. The invoice HTML already includes a built-in "Print / Save PDF" button. This fixes the broken view on Render free tier where Chromium is unavailable.
- **Supplier standalone pages** — Adding and editing suppliers now uses dedicated `/suppliers/new` and `/suppliers/[id]` pages instead of inline forms in the admin panel.
- **Stock take auto-populate** — Creating a new stock take session automatically inserts all products with their current system stock levels, eliminating manual product-by-product addition.
- **Input validation helpers** — Reusable validation functions (`isEmail`, `isStr`, `isNum`, `isInt`, `isPosInt`, `isNonNegNum`, `isArr`, `inSet`, `okLen`) added at the top of `server/index.ts` for consistent request validation across all POST/PUT endpoints.
- **Light theme fixes** — Stock take list and session pages hardcoded dark-theme colors replaced with CSS variables (`var(--danger, ...)`, `var(--success, ...)`, etc.) for proper light/dark theme support.

- **Security hardening** — Comprehensive security audit and fix: auth on credit note viewer, provider order isolation (no longer exposes all orders), table name sanitization in backup endpoint, message read endpoint now verifies JWT, product upload rejects non-image files, rate limiting on customer/provider login endpoints, HTML-escaped eTIMS receipt numbers and store names in invoice templates, query-string tokens restricted to explicit `allowQueryToken=1` flag, M-Pesa callback payload validation, default staff role falls back to `technician` instead of `admin`, all user input escaped in email HTML bodies, CORS locked to production domain only, timing side-channel mitigated on all login endpoints (dummy bcrypt for non-existent users), SVG uploads rejected, DB SSL configurable via `DB_SSL_REJECT` env var.
- **Render deployment speed** — Moved `@sparticuz/chromium` and `puppeteer-core` to `optionalDependencies`. Build command changed from `rm -rf node_modules dist && npm install && npx tsc` to `npm ci --omit=optional && npx tsc`. Eliminates 300MB+ Chromium download on every deploy. PDF generation falls back to HTML gracefully when Chromium is unavailable.
- **Two-step checkout with delivery details** — Clicking Checkout now immediately creates a pending order and redirects to the order detail page where customers fill in delivery details (name, address, county, phone), select a payment method, and add delivery instructions. Orders start as `pending` and progress through `confirmed` → `shipped` → `delivered`. Customers can only edit details while the order is still pending.
- **Springboard category menu** — Admin-toggleable header mode that replaces horizontal category links with a collapsible dropdown button. Brand name sits at the far left, springboard button next to it, and actions (search, theme, currency, account) on the right. Enabled from admin Settings panel. Provides a cleaner header layout when categories are numerous.
- **Provider order management** — Providers can view all orders, cancel individual items that are unavailable, and update order status (confirm, ship, deliver, cancel). Item-level cancellation shows strikethrough on the customer's order page. Status changes trigger email notifications to customers.
- **Customer invoice download** — Orders list page now shows an inline "Invoice" button on shipped/delivered orders. Order detail page also has a Download Invoice button for shipped/delivered orders. No need to navigate away from the orders list.
- **Product rating & review system** — Customers can rate products (1–5 stars) with an interactive clickable star widget. Each customer gets one review per product, with editable and deletable reviews. Product detail page shows a rating distribution bar chart, average rating display, and paginated review list. Product cards show real average ratings on category pages. Admin panel has a Reviews management section under Operations for moderation (view all reviews, delete). DB enforced via `UNIQUE(product_id, customer_id)` constraint, `CHECK(rating >= 1 AND rating <= 5)`, and performance indexes on `product_id` and `customer_id`.
- **Component unification** — 6 near-identical admin/owner component pairs extracted to shared files (`ProvidersPage`, `CreditNotesPage`, `AboutUsPage`, `ProductPositioningPage`, `StockTakeListPage`, `StockOnHandPage`). Admin and owner panels now import the same components, eliminating ~1,600 lines of duplicated code. Feature gating in the owner panel is preserved at the routing level.
- **Premium hero section** — Original storefront layout now features a full-width two-column hero with dark gradient background, animated blue/purple glows, floating particles, glassmorphism buttons and stat cards, auto-rotating featured product carousel (5s interval with dot navigation), floating category chips, "Trusted by 5,000+ customers" trust bar with gold stars, and SVG wave transition into the product grid. Fully responsive (stacks vertically on mobile). Respects `prefers-reduced-motion`.
- **POS invoice save & print** — After completing a POS sale, the post-charge UI now offers Save Invoice (downloads PDF) and Print Invoice (opens print dialog) buttons for both thermal receipt and A4 invoice formats.
- **Purchase orders** — Full purchase order management with supplier selection, product line items, status workflow (pending → ordered → received), per-item receiving, and admin sidebar integration under the Stock group.
- **Admin reports expanded** — Reports tab now includes 5 sub-tabs: Sales Report, Employee Sales, Technician Performance, Purchases Report, and Stock Summary.
- **Unified product pages** — Admin and owner product pages now use the same `AdminProducts` component with full sale price, subcategory, warranty, taxable, CSV import/export, and bulk edit support.
- **Unified quotations** — Admin quotations panel now uses the full-featured `QuotesPage` component with status management, approve/cancel workflows, PDF downloads, and discounts.
- **Marketing page** — Full marketing landing page with problems, solutions, industries, features (23 real modules), testimonials, stats, FAQ, and CTA. All content verified against actual implemented features.
- **Annual pricing** — Subscription plans now support both monthly and annual pricing. Plans table has `price_annual` column. Admin plans UI shows both Monthly and Annual price fields. Owner subscription page displays both prices with percentage savings for annual billing.
- **Multi-currency feature gating** — `CurrencySelector` checks `useFeature("Multi-currency support")` and returns null when the plan doesn't include it. Multi-currency support added to Growth, Pro, and Enterprise plan features.
- **Provider PIN fix** — Removed `PinLock` from dashboard page entirely. Providers now log in and see the dashboard immediately. PIN lock only appears when clicking POS (which has its own correct PinLock).
- **Server-side PDF downloads** — Invoices, credit notes, and quotes can be downloaded as real PDF files via Puppeteer (`puppeteer-core` + `@sparticuz/chromium`). Add `?format=pdf` to any document endpoint to get a PDF instead of HTML. All frontend buttons now trigger actual file downloads.
- **Admin messaging panel** — New "Messages" section under Operations in the admin panel. Conversation list with unread badges, chat-style message view with read receipts, inline reply, compose new messages (pick customer + provider). Auto-polls every 30 seconds. Notification bell links to the panel.
- **Feature-gated subscription plans** — Plans now carry actual feature flags (Messaging, Invoice/quote PDF downloads, Credit notes, Quotations, Branch management, Repair ticketing, Technician accounts, etc.). Frontend `useFeature()` hook conditionally shows/hides nav items and UI sections. Server-side `requireProviderFeature()` middleware blocks provider API access per plan tier. Four default plans (Starter, Growth, Pro, Enterprise) seeded with progressive feature sets.
- **Expanded role permissions** — New permissions: `messaging:view`, `messaging:send`, `invoice:view`, `invoice:download`, `credit_note:view`, `credit_note:create`, `quote:view`, `quote:create`, `quote:update`. Default roles (admin, owner, manager, technician) updated with appropriate permission sets.
- **Sale price / strikethrough pricing** — Products support an optional sale price. Strikethrough original + red sale price displayed on product cards, product detail page, owner products table, POS grid, and admin products table.
- **Promotional banners / Splashes** — Admin can create marquee or static promotional banners with custom background/text colors, active date ranges, and on/off toggle. Quick presets for Black Friday, Happy Hour, Christmas, New Year Sale, and Back to School.
- **Kenyan holiday calendar** — Auto-displayed marquee banners for 12 Kenyan public holidays with unique Kenya flag-themed gradient colors and catchy taglines.
- **Store logo on all documents** — Logo automatically appears on POS receipts (thermal + A4), customer invoices, admin order invoices, credit notes, and quote PDFs. Configurable position via admin Settings.
- **Product positioning editor** — Drag-and-drop product reorder for storefront. Feature-gated via "Product positioning" in plan features. Admin and owner panels.
- **Auto-email system** — Full email notification framework. Configurable sender, HTML templates for messages/quotes/credit notes/order status. Owner CC on customer-provider messages. Email logs tracked.
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
| `/pos` | Staff | Point of Sale — product grid, cart, payment method selector (configurable), customer lookup, cash change calculator, thermal receipt & A4 invoice print |
| `/login` | Everyone | Unified sign-in — customer, staff, provider (Google Sign-In supported) |
| `/dashboard` | Customers & Providers | Orders, repairs, wishlist, messages (customer) or subscription, invoices (provider) |
| `/about` | Everyone | About Us page — content editable by admin/owner |
| `/cart` | Customers | Shopping cart — manage quantities, then Checkout creates pending order and redirects to order detail |
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

Full store management with 29 sections:

- **Dashboard** — Stats overview with clickable animated counters (products, staff, pending subscription requests)
- **Products** — CRUD, image gallery, spec templates, quick price edit, checkbox bulk edit (price/category/stock), CSV import with template download (admin/owner only), price history tracking, sale price (strikethrough pricing)
- **Coupons** — Create discount/promo codes (percentage or fixed amount), set min order, max uses, expiry date, usage tracking per order
- **Categories** — Manage product categories + subcategories (shareable across categories)
- **Orders** — View all customer orders with shipping details, status updates, branch assignment, coupon discount display
- **Users & Permissions** — Staff management, fine-grained role-based permissions (editable for all roles)
- **Roles** — Define custom roles with granular permission toggles (messaging, invoicing, credit notes, quotes, etc.)
- **Plans** — Create/edit/delete tiered subscription plans with feature checkboxes (45+ available features)
- **Providers** — View providers, assign plans, custom pricing, status
- **Invoices** — Generate invoices per provider, mark paid, PDF download for order invoices
- **Credit Notes** — Create eTIMS-compliant credit notes from invoices in admin and owner views, with printable audit details and submission tracking, PDF download
- **Reports** — 5 sub-tabs: Sales Report with combined/per-branch filtering and export to Excel/PDF, Employee Sales, Technician Performance, Purchases Report, and Stock Summary
- **Stock on Hand** — Current stock levels, snapshot history, low-stock alerts
- **Stock Transfers** — Create and manage inter-branch stock transfers with pending/complete/reject workflow
- **Stock Take** — Create sessions, count inventory, view variance, auto-apply adjustments
- **Purchases** — Create and manage purchase orders with supplier selection, product line items, status workflow (pending → ordered → received), per-item receiving, and cost tracking
- **Messages** — Admin messaging panel: conversation list with unread badges, chat view with read receipts, inline reply, compose new messages (pick customer + provider). Auto-polls every 30 seconds.
- **Reviews** — View all product reviews with customer name, product, rating, date, and comment. Delete reviews for moderation. Paginated list.
- **Spec Templates** — Define per-category spec fields for products
- **Suppliers** — Manage vendor/supplier directory with contact details, active status
- **Branches** — Manage physical store locations (name, address, contact info)
- **Clients** — Multi-tenant client management with per-client branches
- **About Us** — Edit title, content, mission, vision for the /about page
- **Storefront** — Choose layout theme (Original, Amazon, Jumia, Mobile), manage promotional banners
- **Splashes** — Create/edit/delete promotional banners with quick presets (Black Friday, Happy Hour, Christmas, New Year Sale, Back to School), custom background/text colors, marquee vs static toggle, active date ranges, and on/off toggle. Kenyan holidays auto-displayed with themed colors.
- **Shop Subscription** — View current plan, activate new plan, approve/reject owner requests
- **Settings** — Store info, M-Pesa config, store logo upload with position selector (top-left/top-middle/top-right), currency, configurable POS payment methods (add/edit/remove with KRA codes), eTIMS/KRA compliance (VSCU/OSCU mode selector with branch, device, API settings), image storage (Cloudinary primary + optional database backup toggle), exchange rates

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
- **Shop Subscription** — View current plan, request plan change (admin approves)
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
├── layouts/               # Storefront layout themes
│   ├── index.tsx              # Layout registry, provider, engine
│   ├── shared.ts              # formatPrice, escapeHtml utilities
│   ├── original.tsx           # Original theme (clean, default site nav)
│   ├── amazon.tsx             # Amazon-style theme
│   ├── jumia.tsx              # Jumia-style theme
│   └── mobile.tsx             # Mobile-optimised theme
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
│   ├── admin.tsx             # Admin panel (21 sections)
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
└── notify.ts             # Email notifications

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
| GET | `/api/products` | All products |
| GET | `/api/products/:id` | Single product |
| GET | `/api/products/:id/images` | Gallery images |
| GET | `/api/products/:id/reviews` | Product reviews (paginated, returns distribution + total) |
| GET | `/api/categories` | All categories + subcategories |
| GET | `/api/categories/:id/subcategories` | Subcategories for a category |
| GET | `/api/subcategories` | All subcategories |
| GET | `/api/plans` | Active subscription plans |
| GET | `/api/shipping/counties` | All 47 Kenyan counties with fees |
| GET | `/api/repairs/statuses` | Repair status labels |
| GET | `/api/shop/features` | Active subscription features for feature-gating UI |
| GET | `/api/images/:refId` | DB-backed-up image (base64 served as binary) |
| GET | `/api/splashes` | Active promotional banners (public, filtered by date range) |

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
| POST | `/api/orders` | Place order with M-Pesa payment |
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
| GET | `/api/reports/sales` | Sales report (filterable by date) |
| GET | `/api/reports/stock-summary` | Stock levels summary |
| GET | `/api/stock-on-hand/current` | Current stock levels (requires `stock:on_hand`) |
| GET | `/api/stock-on-hand/history` | Snapshot date history (requires `stock:on_hand`) |
| GET | `/api/stock-on-hand/:date` | Stock on hand for a specific date (requires `stock:on_hand`) |
| POST | `/api/stock-on-hand/snapshot` | Create stock snapshot (requires `stock:on_hand`) |
| GET | `/api/stock-transfers` | List stock transfers (requires `stock:transfer`) |
| POST | `/api/stock-transfers` | Create a stock transfer (requires `stock:transfer`) |
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
| GET | `/api/admin/splashes` | List all promotional banners |
| POST | `/api/admin/splashes` | Create a promotional banner |
| PUT | `/api/admin/splashes/:id` | Update a promotional banner |
| DELETE | `/api/admin/splashes/:id` | Delete a promotional banner |
| POST | `/api/settings/logo` | Upload store logo (Cloudinary) |
| PUT | `/api/settings/logo-position` | Update logo position (top-left/top-middle/top-right) |
| GET | `/api/admin/coupons` | List all coupons |
| POST | `/api/admin/coupons` | Create a coupon |
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
- Each branch has a name, address, phone, email, and active status
- Branches are used for order assignment and stock transfer tracking

### Stock on Hand
- Standalone page in the admin Operations nav
- View current stock levels with low-stock alerts
- Take daily snapshots to record inventory at a point in time
- Browse historical snapshots by date

### Stock Transfers
- Move stock between branches with a pending/complete/reject workflow
- Protected by the `stock:transfer` permission
- Accessible from the **Stock Transfers** page in the admin Operations nav
- Tracks source branch, destination branch, product, quantity, and notes

## Stock Take Workflow

1. Start a session from admin or owner panel
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

Five layout themes controlled by admin via the Storefront panel:

| Layout | Key | Description |
|--------|-----|-------------|
| **Original** | `original` | Clean default layout with premium hero section (animated glows, floating particles, product carousel, glassmorphism buttons, wave transition), standard site header |
| **Amazon Style** | `amazon` | Large search bar, horizontal categories, product recommendations, featured deals |
| **Jumia Style** | `jumia` | Promotional sliders, flash sales, daily deals, category icons |
| **Mobile** | `mobile` | Premium minimalist, hero banners, brand chips, compare specs |
| **Custom** | `custom` | Flexible layout for custom hero sections, featured categories, and responsive card panels |

Each layout provides its own `Header`, `Footer`, `HomePage`, and `LayoutStyles` components. The admin can switch layouts and manage promotional banners from both the Admin and Owner panels.

## Adding a New Storefront Layout

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
   - add it to the `LAYOUTS` record
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

This project does not yet support runtime upload/import of layout files through the admin UI. Layouts are integrated by adding a new source file and registering it in `frontend/layouts/index.tsx`.

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
- Security headers applied via Helmet (CSP disabled for inline styles). CORS origin configurable via `CORS_ORIGIN`. Rate limiting: 200 req/15min global, 10 req/15min on auth routes.
- Error responses return generic messages — internal error details are not exposed to clients.
- **Tax system**: Global tax rate configurable in Settings (default 16%). Each product has a taxable toggle (eTims-compatible).
- **Currency system**: Storefront auto-detects user's currency via timezone/locale. Exchange rates auto-fetched from open.er-api.com (cached 1h). Admin can override with custom rates in Settings. Currency selector appears in all storefront layout headers.
- **Quotations**: Admin panel has a dedicated Quotations section under Sales for creating and managing hardware quotes. Quote PDFs include the store logo. PDF downloads available via `?format=pdf` query param.
- **Server-side PDF Generation**: Uses `puppeteer-core` + `@sparticuz/chromium` for serverless-friendly PDF generation. Any HTML document endpoint (invoices, credit notes, quotes) supports `?format=pdf` to return a real PDF file. Falls back to HTML on error. Chromium browser instance is reused across requests and gracefully shuts down on SIGTERM/SIGINT.
- **Admin Messaging**: Full messaging panel in the admin Operations section. Conversation list with partner names, unread badges, and last message preview. Chat view with bubble messages, sender labels, timestamps, and read receipts. Compose new messages between customers and providers. Auto-polls every 30 seconds.
- **Sale Price / Strikethrough Pricing**: Products support an optional sale price field. When set, all UI surfaces (product cards, product detail, POS grid, admin/owner tables) show the original price with strikethrough and the sale price in red. POS charges the sale price automatically.
- **Product Rating & Review System**: Customers can rate products (1–5 stars) and leave reviews. One review per customer per product enforced at the DB level (`UNIQUE INDEX`). Product detail page shows a clickable star rating widget, rating distribution bar chart, average rating with visual stars, and paginated reviews (10 per page). Customers can edit and delete their own reviews. Product cards on category pages show the real average star rating fetched from the DB. Admin panel has a Reviews management section for moderation (view all, delete). DB constraints: `CHECK(rating >= 1 AND rating <= 5)`, indexes on `product_id` and `customer_id`. Uses `RETURNING *` for immediate response after insert.
- **Promotional Banners (Splashes)**: Admin can create marquee or static banners with custom colors, date ranges, and on/off toggle. Quick presets for common events. The MarqueeBanner component also auto-displays Kenyan public holidays with themed gradients and taglines.
- **Store Logo**: Upload a store logo from admin Settings. Logo appears on POS receipts (thermal + A4), customer invoices, admin order invoices, credit notes, and quote PDFs. Position configurable (top-left/top-middle/top-right).
- **Product Deletion**: All product-referencing tables use `ON DELETE CASCADE`. Deleting a product automatically removes related order items, quote items, stock records, price history, and reviews.
- **Sales Report**: Includes per-branch breakdown table when viewing combined data, plus date range and branch filter, daily revenue trend chart (SVG), and export to Excel (CSV) or printable PDF.
- **Coupons**: Admin can create percentage or fixed discount codes with min order, max uses, and expiry. Customers apply at checkout. Discount recorded per order.
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
9. Build backend: `npm run build`
10. Build frontend: `cd frontend && npm run build`
11. Run with a process manager (PM2, systemd, etc.) or deploy to Render.com / Vercel
12. Back up images — Cloudinary stores uploads in production; local `data/uploads/` is ephemeral on Render
13. Optional: enable **database backup for images** in admin Settings → Image Storage (stores base64 in PostgreSQL `stored_images` table alongside Cloudinary)
