# Gears&Glitch â€” Complete UX/UI Audit & Redesign Plan

**Date:** 2026-08-29
**Scope:** Entire frontend (`frontend/`), control plane (`control-plane/public/`), measured against `DESIGN.md` (the product's own design spec) and the business-software brief (Shopify + Square + ServiceNow + ERP â€” not AI-startup).
**Status:** READ-ONLY AUDIT. No code was modified. Implementation awaits approval.

> **STATUS (updated 2026-09-17, Phases 1–3):** this is a Phase-0 snapshot. Live source of truth: `PRODUCTION_READINESS_AUDIT_FULL.md` (A–G with per-phase addenda). Removed/changed since: destructive boot DDL/DML (`order_items`/`stock_levels` now `ON DELETE RESTRICT`), warranty↔repair link, branch attribution (migrations 0013/0014), route shadowing, M-Pesa callback auth, eTIMS boot reset, migration runner. eTIMS is now DISABLED by design (no open CRITICAL code path) — see Phase 5 in the live report. eTIMS mode is forced to `off`; no invoice/credit note is submitted to KRA.

---

## 0. Executive Summary

Gears&Glitch has a **genuinely good design foundation** â€” a spec-compliant token system, a solid `ui/` component kit, a permission-aware admin sidebar, and an excellent POS. The platform's problem is **not the absence of a design system; it is inconsistent adoption of it**, plus AI-SaaS visual habits on the storefront, and one major product-level gap: **the SELL â†’ TRACK â†’ SERVICE â†’ WARRANTY â†’ CUSTOMER HISTORY lifecycle is only half-built in the UI**. Warranty is a checkbox on an order line; the customer profile is a flat CRUD table; the repair ticket is a wall-of-forms with no timeline.

**The redesign should be a consolidation and lifecycle-surfacing effort â€” not a re-skin.**

Top findings at a glance:

| # | Finding | Severity |
|---|---------|----------|
| 1 | No per-page `document.title`; every tab reads "Welcome to our store" | P0 |
| 2 | Storefront home hero uses the exact AI-SaaS language the brief bans (glow blobs, particles, glass, gradients) | P0 |
| 3 | Control-plane `<title>`/meta contain mojibake corruption ("Gear&Glitch ?") | P0 |
| 4 | Header search triggers full page reload (loses SPA navigation) | P1 |
| 5 | Warranty management has no first-class UI (checkbox + months input only) | P1 |
| 6 | Emoji used as icons in 12 files while a proper SVG icon set (`icons.tsx`) exists | P1 |
| 7 | Four different status-pill implementations | P1 |
| 8 | ~1,500 inline `style={{}}` attributes fight the token system and dark mode | P1 |
| 9 | Repair ticket detail is a flat form; no timeline, no serial/asset linkage | P1 |
| 10 | Customer profile is flat CRUD; no 360Â° workspace (orders/assets/warranties/repairs) | P1 |
| 11 | ProductCard fires one API call per card (N+1); no sorting/filters on category pages | P1 |

---

## 1. Current Design-System Assessment

### 1.1 What exists and is GOOD (keep)

- **Token layer** (`frontend/styles/globals.css:9-158`) â€” spacing scale (4px base), typography scale, radius scale (6/8/12/16/full), 6-step shadow scale, motion tokens, warm-stone palette matching `DESIGN.md` exactly: `--primary #c2410c`, `--bg #fafaf9`, `--text #1c1917`, hairlines `#e7e5e4`, semantic success/warning/danger/info with light+text variants. Dark theme (globals.css:160) is a composed warm-black world (`#0b0a09`/`#161311`, `#f97316` primary) â€” not a mechanical inversion. **Strongest asset in the codebase.**
- **Button system** (globals.css `.btn` block + `components/ui/Button.tsx`) â€” compact (8px radius, 13px font, 8/20px padding), 5 variants (primary/secondary/ghost/danger/subtle), 3 sizes, loading spinner, dark-theme black-on-orange contrast fix (~8:1).
- **`ui/` kit** (`components/ui/`) â€” `Button`, `Card` (+Header/Body/Footer), `Input/Select/Textarea` (label + `aria-invalid` + `role="alert"` errors + hints), `Modal` (Escape, overlay click, `aria-modal`), `Badge` (semantic variants), `StatCard`, `Skeleton` family, `EmptyState`. Small, correct, accessible.
- **Table pattern** â€” `.table-wrap` + `.data-table` (globals.css:1591-1629): hairline rows, uppercase label headers, row hover, compact 0.85rem at â‰¤768px.
- **Admin sidebar** (`pages/admin.tsx:497-571`) â€” grouped (Sales/Services/Stock/Team/Finance/Activity/Settings/Help), collapsible, filterable ("Filter menuâ€¦"), `aria-current` on active, per-view SVG icons, permission- and feature-aware, keyboard shortcuts (d/p/o/c/u/r/s/i/h). Matches DESIGN.md's sidebar spec.
- **Admin dashboard** (`pages/admin.tsx:685-830`) â€” clickable KPI cards, an **Attention panel** (low stock / repairs ready / unread messages / pending requests), low-stock top 5, repair pipeline. Answers "what needs my attention".
- **POS** (`pages/pos.tsx`) â€” barcodeâ†’serial workflow, debounced customer search, M-Pesa pending/retry/switch-to-cash, **idempotency keys**, PIN lock, keyboard-shortcut help, `tabular-nums` totals, `aria-pressed` category bar. Most professional screen in the product.
- **Feedback systems** â€” `Toast` (aria-live, severity roles, actions), `ConfirmDialog`/`promptDialog` (promise-based, danger variant, Escape). Widely adopted.
- **Skeletons** â€” storefront home (index.tsx:57-73), category page, my-repairs; `SkeletonStats`/`SkeletonTable` in admin.
- **Marketing page** (`pages/marketing.tsx` + `styles/marketing.css`) â€” recently redesigned; editorial, real-product-UI hero, page-local `mk-` classes. Already aligned with the brief.

### 1.2 What is BROKEN or DRIFTING

1. **Token adoption is shallow.** 217 hardcoded hex values in globals.css (beyond token definitions) and ~70 in TSX (admin.tsx 22, MarqueeBanner 12, original.tsx 7â€¦). ~1,500 inline `style={{}}` attributes (admin.tsx **736**, quotes.tsx 155, product.tsx 67, cart.tsx 43, dashboard.tsx ~50). Inline styles bypass dark-theme tokens â€” components lose contrast/misrender in dark mode.
2. **Off-spec tokens**: `--violet*`, `--indigo*` (globals.css:100-104) used for repair statuses `waiting_parts`/`ready` (AdminRepairs.tsx:31-37). DESIGN.md's semantic system has four states; violet/indigo dilute it.
3. **Hero glass/glow token block** (globals.css:113-157: `--brand-glow-*`, `--hero-glass-*`, `--brand-particle`) exists solely to power the AI-SaaS hero. Against spec.
4. **Brand-theme matrix**: `[data-brand-theme="kenyan"|"modern"|"custom"]` Ã— light/dark (globals.css:273-406) + 3 static storefront layout engines (original/amazon/jumia) + dynamic drag-drop engine. Multiplies visual states beyond testability; the storefront can look like 4 different products.
5. **Duplicates**: `RippleButton` vs `ui/Button` (two button components, both ripple â€” ripple is a Material-ism worth retiring in business UI); root `Skeleton.tsx` vs `ui/Skeleton.tsx` (two import paths); `LoadingScreen.tsx` (forced 1.8s animated-gear loader) is **dead code** â€” imported nowhere; `SantaGearAnimation.tsx` seasonal dead code; legacy `.badge-green/red/blue` (globals.css:1376-1378) coexist with semantic `ui/Badge`.
6. **`ButtonLink`** (ui/Button.tsx:85-100) renders a raw `<a>` â€” loses Next client-side nav.

## 2. Current UX Assessment

### 2.1 Storefront (Persuade mode)

- **Home hero** (`layouts/original.tsx:297-306` + hero CSS): gradient background, **two glow blobs**, **floating particles**, glass cards (`rgba(255,255,255,0.6)` + blur), countdown timer, count-up stats, auto-advancing carousel. Precisely the "AI SaaS" language the brief bans. The redesigned marketing page already shows the correct direction.
- **MarqueeBanner** (components/MarqueeBanner.tsx) renders above every non-hidden page: Kenyan-holiday gradient banners with emoji flags and pun-heavy copy ("Prices so low they bow!"), infinite marquee. Fun for a consumer shop; wrong register for the platform. Injects a `<style>` tag per mount.
- **Header** (components/Layout.tsx): category springboard with submenu flyouts (good pattern, real aria), search, cart/wishlist with counts. Issues: search does `window.location.href = "/?search=â€¦"` â†’ **full page reload** (Layout.tsx:240); glyph icons "â˜° â–¾ â€º âš™" instead of SVGs; icon-only settings button labeled only by `title`.
- **Category page** (`pages/[category].tsx`): breadcrumbs + H1 + subcategory chips â€” decent. But **no sorting, no price/brand/spec filters, no pagination** (all products render).
- **ProductCard** (components/ProductCard.tsx): per-card `/api/products/:id/extras` fetch â†’ **N+1 requests** per grid; 800ms auto-advancing hover carousel (jarring); "Sale" badge uses `--danger` red (color-semantics misuse â€” a discount is not an error); â˜… text-char ratings; heavy inline styles.
- **Cart / product detail**: functional; inline-style heavy (43 / 67).
- **Orders list** (orders.tsx): **no loading state** (blank flash); status is a bare `plan-status` pill with raw text ("shipped") â€” no color mapping, no humanization.
- **Order detail** (order.tsx): **5 H1s**; âš ï¸ emoji error state.
- **Wishlist** (wishlist.tsx): **no loading state**; 2 H1s.
- **Repair booking/ticket** (repair-book.tsx, repair-ticket.tsx): functional; ticket page has 4 H1s; raw status text; no timeline.

### 2.2 Customer dashboard (`pages/dashboard.tsx`)

Left-nav sections (Overview/Orders/Repairs/Wishlist/Messages/Profile), feature-gated â€” good bones. But Overview is 3 count cards and nothing else: no recent activity, no "where is my repair", **no assets or warranty status** â€” the customer side of the lifecycle story is absent. Messaging is a full 2-pane chat built entirely from inline styles.

### 2.3 Admin (Operate mode)

- **Shell**: sidebar excellent (see Â§1.1). Top bar (admin.tsx:572-585) is 100% inline styles; theme toggle uses â˜€ï¸/ðŸŒ™ emoji; "POS" is a one-off inline-styled button.
- **admin.tsx is a 6,544-line monolith** (~40 views). Views are structurally consistent (H1 â†’ filters â†’ `.data-table` â†’ detail panel) but every view hand-rolls layout via inline styles; **no column sorting; no pagination (full lists render); no bulk actions** on any of 44 tables.
- **AdminCustomers** (admin.tsx:5588) â€” flat CRUD list + modal. **No customer 360Â°**: no orders, assets, warranties, repairs, or payments from a customer row. Brief Â§19 unmet.
- **Repairs** (`components/admin/AdminRepairs.tsx`): tickets table good (filters, quote-state pills, ETA/schedule). **Detail is a wall-of-forms** â€” no visual status progression across the 7 statuses, updates render as a plain list rather than a timeline, **no serial/asset/warranty linkage**, no QC step. Status colors use violet/indigo (off-spec).
- **Warranty**: only a **checkbox + months input** per order line (admin.tsx:1314-1339). No warranty list, expiry view, claims, coverage display, or serialâ†’warranty lookup. The differentiator the marketing page sells has no UI surface. (Data model exists â€” `/api/admin/order-items/:id/warranty` works; a warranty list/search endpoint likely needs adding â€” flagged in Â§15.)
- **Quotes** (`pages/quotes.tsx`): 733 lines, 155 inline styles, its own `STATUS_CONFIG` color map (a third status system), 4 H1s. Staff route renders under the **storefront header** (`/quotes` not in `hideHeader`, Layout.tsx:158).
- **Serials** (`components/admin/AdminSerials.tsx`): present â€” the serialized-inventory concept exists but is not visually connected product â†’ serial â†’ customer â†’ warranty â†’ repairs (brief Â§18).
- **Admin login gate** (admin.tsx:~380-493): own inline-styled login + forgot-password modal duplicating `pages/login.tsx` patterns.

### 2.4 Control plane (`control-plane/public/index.html`)

Self-contained 2,584-line dark console â€” **intentionally distinct** (slate-blue infra palette, own token block, sticky header, tabs). Correct per brief Â§22. Issues: **mojibake in `<title>` and meta description** ("Gear&Glitch ?"); system font stack (no brand typography); single monolithic file (maintenance, not UX).

### 2.5 Cross-cutting

- **Page titles**: no page sets `document.title` (grep: zero usages). `_document.tsx` fallback "Welcome to our store" + generic description applies to all admin/staff/customer pages. Browser history and tabs are unusable for navigation.
- **Errors**: global `ErrorBoundary` says "Something went wrong" (exactly the phrasing the brief bans; _app.tsx:43); fetch errors are terse strings ("Failed to load products."); `api.ts` has no timeout/abort; StorefrontBuilder still uses `window.confirm` (StorefrontBuilder.tsx:163,283) â€” inconsistent with `ConfirmDialog`.
- **Dead/confusing chrome**: `account.tsx` is a redirect stub; `LoadingScreen` dead; two nav systems (header nav + springboard) on storefront.
- **Wording**: consistent KES formatting via `formatPrice` but **duplicated in 4+ places** (lib/app-context, admin/shared.tsx, orders.tsx, dashboard.tsx, quotes.tsx); "Save" vs "Save changes" both used (13 vs 7); Delete vs Remove mixed (128 vs 60).

## 3. Current Accessibility Assessment

**Good:** skip-link (_app.tsx via Layout.tsx:375); `aria-current` on active nav (Layout.tsx:330, admin.tsx:519,546); `aria-pressed` POS categories (pos.tsx:442,451); `aria-expanded/haspopup` springboard; aria-live toasts with severity roles (Toast.tsx:69-74); `role=alertdialog` + labelled confirm (ConfirmDialog.tsx:107-109); labelled inputs in `ui/Input` and login; `prefers-reduced-motion` handled in 6 places (globals.css:2351,2557,3226,3643; MarqueeBanner.tsx:292); tabular-nums on money.

**Problems:**
1. **Multiple H1s** per render: order.tsx (5), repair-ticket.tsx (4), quotes.tsx (4), wishlist/orders/my-repairs/repair-book/suppliers-new (2 each).
2. **Emoji as icon content** (EmptyState.tsx:3-17, NotificationBell.tsx:56, admin.tsx:583, category page âš ï¸/ðŸ“¦): screen readers announce noise ("box", "bell").
3. **No focus trap** in `ui/Modal` or ConfirmDialog â€” keyboard users can tab into the background behind open dialogs; no focus restoration on close.
4. **Icon-only buttons** relying on `title` only (Layout.tsx:276 settings gear) â€” no visible label, weak for touch/AT.
5. **Toast close buttons** not keyboard-reachable focus order concerns; toasts never stack-limit.
6. **Contrast risks**: `--text-tertiary #716d68` on `--bg #fafaf9` â‰ˆ 4.6:1 (passes AA for body, borderline for 12px `--text-xs` usage); inline-styled gray text in dark mode unverified.
7. **Auto-advancing carousel** in ProductCard has no pause control (WCAG 2.2.2 concern).
8. Status conveyed by color alone in several tables (low-stock badge is fine â€” has text; quote pills have text; OK overall, but violet/indigo add non-semantic noise).

## 4. Current Responsive Assessment

- Breakpoints follow DESIGN.md: 1024 / 768 / 480; admin sidebar becomes a 45vh scrollable card (globals.css:3342 block); stat grids collapse to 2 columns; product detail stacks at 768px.
- **Data tables** rely on `.table-wrap` horizontal scroll â€” acceptable for complex tables per brief, but no table on the platform offers a mobile card fallback; 9-column repairs table is unusable on phones.
- **POS grid** (pos-shell) is 2-column desktop; verify stacked mobile (media 3277/3295 exist) â€” targeted QA needed; touch targets in the cart row buttons are ~24px (`btn-sm`) â€” below the 44px customer-facing minimum.
- **Header search** wraps to full-width row on mobile (order:4) â€” fine; springboard dropdown on mobile needs QA (hover-driven submenus at Layout.tsx:198-199 are `onMouseEnter` â€” **touch devices can't open submenus** except via the toggle button, which does exist).
- **Dashboard messaging** 2-pane chat is fixed 260px conversation rail â€” will break below ~640px (no media query found for it).
- No dedicated mobile workflow for admin (sidebar-card pattern is the mitigation; acceptable).

## 5. Current Component Consistency Assessment

| Concern | Implementations | Verdict |
|---|---|---|
| Status pill | (1) `plan-status` raw text (orders/my-repairs/dashboard), (2) `statusBadge()` inline colors (AdminRepairs.tsx:29-39), (3) `STATUS_CONFIG` (quotes.tsx:47-52), (4) `.badge-green/red/blue` legacy + (5) semantic `ui/Badge` | **Consolidate into one `StatusBadge` with a semantic map** |
| Button | `ui/Button` + `.btn` classes + `RippleButton` + raw `<button>` with inline styles (admin top bar, POS, etc.) | Standardize on `ui/Button` |
| Empty state | `EmptyState` (emoji icons) + hand-rolled `empty-state` divs ([category].tsx:77-82) + `p.muted` texts (orders, dashboard) | Standardize on `EmptyState` with SVG icons |
| Loading | `Skeleton*`, `Spinner`, inline skeleton divs, blank-until-loaded (orders, wishlist) | Standardize: skeletons for grids/cards, Spinner only for inline actions |
| Form field | `ui/Input/Select/Textarea` vs `.field > label > input` pattern (admin forms everywhere) | Migrate admin forms to `ui/Input` |
| Price formatting | `formatPrice` duplicated in app-context, admin/shared, orders, dashboard, quotes | Single source in app-context (already exists) |
| Table | `.data-table` (good) but no shared Table component â€” sorting/pagination re-implemented (or absent) each time | Add `DataTable` wrapper |
| Modal | `ui/Modal`, ConfirmDialog (own markup), hand-rolled overlays (admin.tsx:467, pos serial dialog) | Standardize on `ui/Modal` |

## 6. Current Navigation Assessment

- **Admin**: sidebar is strong. Gaps: no POS link inside sidebar (top-bar button only); "Services" group holds only Repairs; **no Warranty entry anywhere**; Settings group has 14 items â€” heavy; view state is client-side only (URL never changes â€” deep links/back button don't restore admin views; browser Back exits admin entirely).
- **Storefront**: header nav + springboard is workable. Issues: two nav mechanisms overlap (top bar links AND desktop nav row both render); nav link set is DB-driven with static fallback (Layout.tsx:86-105 merge logic is convoluted); footer link validity depends on admin config; `account.tsx` stub.
- **Customer dashboard**: section nav is fine but not URL-addressable (same deep-link problem as admin).
- **Breadcrumbs**: present on category/orders/my-repairs/repairs; absent on product detail, cart, admin views (admin has the sidebar instead â€” acceptable).
- **Page titles**: absent everywhere (see Â§2.5).

## 7. Current Page-by-Page Assessment

Legend: âœ… works well Â· âš ï¸ needs work Â· âŒ broken/missing

| Route / View | Assessment | Key issues |
|---|---|---|
| `/marketing` (public site) | âœ… | Recently redesigned; keep (see Â§16) |
| `/` storefront home | âš ï¸ | AI-SaaS hero (glow/particles/glass); LayoutEngine theme matrix; N+1 ProductCards |
| `/[category]` | âš ï¸ | No sort/filters/pagination; emoji empty+error states |
| `/product` | âš ï¸ | 67 inline styles; no sticky purchase panel; gallery UX ok |
| `/cart` | âš ï¸ | Functional; inline styles; fine flow |
| `/order` | âš ï¸ | **5 H1s**; emoji error; no loading state |
| `/orders` | âš ï¸ | **No loading state**; raw status text; local formatPrice |
| `/wishlist` | âš ï¸ | **No loading state**; 2 H1s |
| `/groups`, `/group/[slug]`, `/campaign/[slug]` | âœ…/âš ï¸ | Minor |
| `/login` | âœ… | Labels, hints, 2FA, Google â€” good pattern; keep |
| `/dashboard` (customer) | âš ï¸ | Shallow overview; no assets/warranty; inline-styled chat |
| `/account` | âŒ | Redirect stub only |
| `/repairs` (public) | âš ï¸ | Reuses `product-grid` for service panels; "Book this service" is a fake `<span class=btn>` |
| `/repair-book` | âš ï¸ | 2 H1s; no loading state; functional form |
| `/repair-ticket` | âš ï¸ | 4 H1s; raw status; no timeline |
| `/my-repairs` | âœ…/âš ï¸ | Good skeletons + empty state; raw status text |
| `/pos` | âœ… | Excellent; touch targets + serial-modal focus QA only |
| `/admin` (40 views) | âš ï¸ | See Â§2.3 â€” monolith, inline styles, no sort/pagination, wall-of-forms repairs, flat customers, **no warranty view** |
| `/quotes` | âš ï¸ | 4 H1s; own status system; renders under storefront header for staff |
| `/suppliers/*`, `/stock-take/*` | âš ï¸ | Standalone chrome (hideHeader) â€” inconsistent with `/quotes`; small pages, minor issues |
| Control plane | âš ï¸ | Mojibake title; own (appropriate) look; monolithic file |

## 8. P0 / P1 / P2 / P3 Issue List

### P0 â€” Critical usability/accessibility (fix first)
- **P0-1** No per-page `document.title` / `<Head>` on any app page (all pages: 0 usages; `_document.tsx:8` generic title). Add a `PageHead` helper + titles for every route/view.
- **P0-2** Control-plane mojibake in `<title>` + meta description (`control-plane/public/index.html:5-7`).
- **P0-3** Storefront home hero: remove glow blobs, particles, glass cards, gradient background, countdown; replace with the editorial/real-UI style already proven on `/marketing` (scope: `layouts/original.tsx`, hero token block globals.css:113-157).
- **P0-4** Header search full-page reload (`Layout.tsx:240`) â†’ `router.push`.
- **P0-5** Multiple-H1 violations (order, repair-ticket, quotes, wishlist, orders, my-repairs, repair-book, suppliers/new) â†’ single H1 + section H2s.
- **P0-6** `ErrorBoundary` copy "Something went wrong" (_app.tsx:43) â†’ specific message + retry + support path, per brief Â§25.

### P1 â€” Major consistency & UX
- **P1-1** **Warranty module missing**: add Warranty views (list w/ expiry states, claim handling, coverage display, serial lookup) under Services group. *(May need small read-only/admin API additions â€” flagged Â§15.)*
- **P1-2** **Customer 360Â° workspace**: tabbed profile (Contact / Orders / Assets & Serials / Warranties / Repairs / Payments / Messages) replacing flat AdminCustomers.
- **P1-3** **Repair ticket timeline**: visual status progression (Receivedâ†’â€¦â†’Collected), updates as a timeline, device/serial/warranty linkage card on the ticket; move violet/indigo to semantic colors.
- **P1-4** **One StatusBadge component**: semantic map for order/quote/repair/subscription statuses; replace `plan-status` raw text, `statusBadge()`, `STATUS_CONFIG`, `.badge-green/red/blue`.
- **P1-5** **De-emoji the UI**: EmptyState icons â†’ `icons.tsx` SVGs; NotificationBell ðŸ””; admin â˜€ï¸/ðŸŒ™ toggle; âš™/â˜°/â–¾/â€º glyphs; FeaturePicker; category-page âš ï¸/ðŸ“¦. 12 files affected.
- **P1-6** **Inline-style migration**: replace ~1,500 inline styles with utility classes/tokens (admin.tsx 736, quotes 155, product 67, cart 43, dashboard ~50, admin top bar, messaging chat). Highest-value target: dark-mode correctness.
- **P1-7** **Loading/empty/error completeness**: orders + wishlist loading states; every list gets `EmptyState` with action; standardized error blocks with Retry.
- **P1-8** **ProductCard N+1**: batch the extras call (or fold images/rating into the products list payload â€” backend note Â§15); remove 800ms auto-carousel; "Sale" badge â†’ `--accent` amber, not danger red.
- **P1-9** **Storefront listing UX**: sorting (price/name/newest), price filter, pagination on category pages.
- **P1-10** **MarqueeBanner**: keep the splash-banner feature (it's admin-configurable commerce tooling) but restyle to flat warm-surface banner with hairline border + SVG icon; retire the hardcoded holiday-gradient system with pun copy (or gate it behind a "festive mode" setting, off by default).
- **P1-11** **Admin view URLs**: encode admin views in the query string (`/admin?view=repairs`) so deep-link/back work; add POS to sidebar Sales group.
- **P1-12** **`ui/Modal` + ConfirmDialog focus trap** and focus restoration.
- **P1-13** **Duplicate components**: delete `LoadingScreen` (dead), `SantaGearAnimation` (dead); converge `RippleButton` â†’ `ui/Button`; fix `ButtonLink` to use `next/link`.
- **P1-14** **Terminology pass**: standardize Save/Create/Delete/Cancel labels; single `formatPrice`; direct business language per brief Â§32.

### P2 â€” Visual refinement
- **P2-1** Retire ripple effects (both Button implementations) â€” motion budget goes to state changes, not decoration.
- **P2-2** `AnimatedCounter` count-ups on every stat load â†’ static values (animate only on dashboard data refresh, and respect reduced-motion).
- **P2-3** Header glyph icons â†’ SVG set; consistent icon sizing.
- **P2-4** Admin top bar â†’ real component with tokens (currently 100% inline).
- **P2-5** Storefront footer "Made in Kenya" strip: replace `var(--text)` background + hardcoded flag hex with token-based styling (or a designed SVG).
- **P2-6** Repairs public page: stop reusing `product-grid` for service panels; real "Book" buttons.
- **P2-7** Toast stack limit (max ~4) + `NotificationBell` hardcoded `#e53e3e` â†’ `--danger`; stop injecting `<style>` keyframes per instance.
- **P2-8** Star ratings: SVG stars instead of â˜… chars.
- **P2-9** `quotes` staff route chrome: move under `hideHeader` or give it the admin shell.
- **P2-10** Settings group (14 items) â†’ sub-grouping or a settings index page.

### P3 â€” Optional enhancements
- **P3-1** Table column sorting + pagination + bulk actions (`DataTable`).
- **P3-2** Command palette (the admin already has single-key shortcuts; a `Ctrl-K` palette is a natural extension).
- **P3-3** Reduced-motion audit of `animations.css` (page-enter, fades) â€” mostly covered; verify.
- **P3-4** Control-plane: brand typography + shared components extracted (keep the distinct dark identity).
- **P3-5** Mobile card-fallback for the widest tables (repairs 9-col).

## 9. Proposed Design System

**Keep the existing tokens and component classes â€” they already match the brief.** The proposal is adoption and closure, not replacement:

1. **Tokens**: unchanged (globals.css:9-108). Delete `--violet*`/`--indigo*` after P1-4; delete hero glass/glow tokens after P0-3. Add `--focus-ring: 0 0 0 3px var(--primary-subtle)` as a reusable value.
2. **Components** (all in `ui/`): `Button` (+Link via next/link), `Card`, `Input/Select/Textarea`, `Modal` (+focus trap), `Badge`, **new `StatusBadge`**, **new `PageHead`** (title+meta helper), **new `DataTable`** (wraps `.data-table` + optional sorting/pagination), **new `Timeline`** (repair updates), `Skeleton*`, `EmptyState` (SVG icons), `StatCard` (static values default).
3. **Class conventions**: no inline styles in pages; layout via existing utility classes + a small set of new layout utilities (`.row`, `.stack`, `.grid-auto`) added to globals.css rather than per-instance styles.
4. **Motion**: hover/focus state changes, dropdown/modal transitions, toast slide â€” nothing auto-playing, everything `prefers-reduced-motion`-safe (pattern already present).
5. **Icons**: single system = existing `icons.tsx` (one stroke, one weight). Extend the set where EmptyState/bell/settings need glyphs.

## 10. Proposed Typography System

Unchanged from DESIGN.md â€” it is already correct for business software:
- Display (Archivo 700, clamp 2â€“3.25rem): marketing only.
- Headline (Archivo 700, clamp 1.6â€“2.2rem): page H1 on Persuade surfaces.
- Title (Sora 600, 1.0625rem): panel headers, card titles, admin view H1s (admin H1 uses this scale today â€” keep).
- Body (Sora 400, 0.9375rem, max 65â€“75ch on read surfaces).
- Label (Sora 500, 0.8125rem; uppercase + 0.05em for table headers).
- Caption/Metadata (Sora 400, 0.75rem): timestamps, IDs â€” add `--text-xs` convention for table metadata cells (already used informally).
- Money/code: `tabular-nums` (extend from 10 usages to **all** numeric table columns via `.data-table td.num`).
- Load fonts via `next/font` (self-hosted, no render-blocking Google Fonts link in `_document.tsx:22`).

## 11. Proposed Color System

Unchanged brand + semantic structure (brief Â§5 is already implemented):

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--primary` | `#c2410c` | `#f97316` | interactive/brand â€” â‰¤10% of any screen |
| `--primary-hover` | `#9a3412` | `#fb923c` | hover/active |
| `--bg` / `--surface` / `--surface-hover` | `#fafaf9`/`#fff`/`#f5f5f4` | `#0b0a09`/`#161311`/`#201c19` | canvas/surface/hover |
| `--text`/`--secondary`/`--tertiary` | `#1c1917`/`#57534e`/`#716d68` | `#f4f1ec`/`#a8a29b`/`#87817a` | text hierarchy |
| `--border`/`--border-hover` | `#e7e5e4`/`#d6d3d1` | `#262019`/`#3d3327` | hairlines |
| `--success`/`--warning`/`--danger`/`--info` (+light/+text pairs) | per DESIGN.md | per DESIGN.md | semantics only |

Changes: (a) remove violet/indigo; (b) "Sale" accent uses `--accent` amber (workbench accent, already defined); (c) all inline hex â†’ tokens during P1-6; (d) control plane keeps its distinct slate identity (deliberate separation) but fixes mojibake and adopts the brand wordmark styling.

## 12. Proposed Spacing System (unchanged)

4px scale (`--space-1â€¦16`), tight-within-groups (4â€“8px), generous-between-groups (24â€“48px). Enforcement strategy: new utility classes + lint rule against `style={{` in new code; migrate existing inline styles view-by-view during phase work rather than a big-bang rewrite.

## 13. Proposed Component System

The `ui/` kit becomes the only source. Full inventory to standardize (brief Â§3):

Buttons (done â€” adopt), Inputs/Selects/Textareas (done â€” adopt), Tables (`DataTable` new), Cards (done), Badges (`Badge` + new `StatusBadge`), Tabs (extract from AuthTabs/AdminRepairs pattern into `ui/Tabs`), Modals/Drawers (`ui/Modal` + focus trap; add Drawer for admin detail panels later if needed), Alerts (inline `banner` pattern: `--info-light` bg + icon + action â€” new small component), Tooltips (native `title` for now; `ui/Tooltip` only where needed), Dropdowns (extract springboard/settings popover pattern), Pagination (extract index.tsx pattern into `ui/Pagination`), Breadcrumbs (extract existing markup into `ui/Breadcrumbs`), Navigation/Sidebars (keep as-is â€” already good), Empty/Loading/Error states (`EmptyState` + `Skeleton*` + new `ErrorState` with Retry).

## 14. Proposed Navigation Structure

Admin sidebar (extends current, minimal disruption):

```
Home (dashboard)
Sales
  Orders Â· POS Â· Quotes Â· Invoices Â· Credit Notes
  Coupons Â· Gift Cards Â· Campaigns Â· Abandoned Carts
Catalog
  Products Â· Groups Â· Categories Â· Category Order Â· Product Positioning
Inventory
  Stock on Hand Â· Stock Transfers Â· Stock Take Â· Stock Control
  Serial Numbers Â· Purchase Orders Â· Suppliers
Customers
  Customers Â· (future: Segments)
Services
  Repairs Â· Warranty          â† NEW: Warranty view + Claims
Team
  Users Â· Roles Â· Branches Â· Clients
Finance
  Providers Â· Subscription Â· Subscription Plans
Activity
  Reports Â· Messages Â· Reviews Â· Audit Log
Settings
  Store Info Â· Payments Â· Compliance Â· Delivery Fees Â· Content Â· System
  Storefront Â· Layout Builder Â· Email Â· WhatsApp Â· About Us Â· Spec Templates
Help
```

Changes: POS joins Sales; Warranty added under Services; groups renamed to match the brief's mental model (Sales/Inventory/Customers/Services); views encoded in URL (`/admin?view=â€¦`). Storefront header keeps its current structure (fix search + icons). Customer dashboard unchanged.

## 15. Proposed Implementation Phases

Mapped to the brief's 14 phases; each phase ships independently and is verified with `npm run typecheck` + `npm run build` (+ a11y spot-check):

| Phase | Scope | Items |
|---|---|---|
| 1. Design system | `PageHead`, `StatusBadge`, `ErrorState`, `ui/Tabs`, `ui/Pagination`, `ui/Breadcrumbs`, `DataTable`; delete dead code (LoadingScreen, SantaGearAnimation); ButtonLink fix; font via next/font | P0-1 base, P1-4, P1-13 |
| 2. Navigation & layout | Admin URLs (`?view=`), POS in sidebar, nav regrouping, admin top-bar component, quotes chrome | P1-11, P2-4, P2-9, P2-10 |
| 3. Core components | De-emoji pass, focus traps, toast stack limit, inline-style utilities | P1-5, P1-12, P2-7 |
| 4. Dashboard | Keep structure; static stats; wire attention panel to new Warranty counts when Phase 9 lands | P2-2 |
| 5. Commerce/POS | Search fix (P0-4), POS touch-target QA, orders/wishlist loading states, ProductCard N+1 + Sale badge, order page H1s | P0-4, P0-5, P1-7, P1-8 |
| 6. Inventory | Stock views onto `DataTable`; serials â†” product linkage prep | P3-1 (partial) |
| 7. Customers/assets | **Customer 360Â° workspace** (tabs: Orders/Assets/Warranties/Repairs/Payments/Messages) | P1-2 |
| 8. Repairs | **Ticket timeline**, semantic status colors, serial/warranty linkage card, QC step in progression | P1-3 |
| 9. Warranty | **Warranty module**: list with expiry states, detail (coverage/dates/serial/purchase/claims), claim flow, dashboard attention counts | P1-1 |
| 10. Control plane | Fix mojibake; keep distinct identity; wordmark polish | P0-2, P3-4 |
| 11. Marketing website | Already done (`/marketing`) â€” only cross-link integration | â€” |
| 12. Storefront hero + listing | Remove glass/glow/particles hero â†’ editorial style; MarqueeBanner restyle; sorting/filters/pagination | P0-3, P1-9, P1-10 |
| 13. Accessibility | H1 fixes, focus traps, icon labels, reduced-motion audit, contrast spot-checks | P0-5, P1-12 |
| 14. Final consistency pass | Inline-style migration completion, terminology pass, `formatPrice` unification, full dark-mode sweep | P1-6, P1-14, P2-* |

**Estimated sequencing note:** Phases 1â€“3 unlock everything else and are low-risk. Phase 7â€“9 (lifecycle surfacing) is where the product's differentiator becomes visible and is the highest-value work.

**Backend changes required (STOP-and-document per brief Â§38):**
1. *Products list extras* â€” fold image-gallery + rating into `/api/products` response (or add batch endpoint) to kill the ProductCard N+1. Read-only enrichment; low risk.
2. *Warranty list/search* â€” likely needs an admin endpoint returning warranties (order-item joined with customer/serial/expiry) if none exists; also warranty-claims mutations. Medium risk (new endpoints only, no changes to existing behavior).
3. *Customer 360* â€” needs an aggregate endpoint (customer + orders + serials + warranties + repairs + payments) or frontend composition of existing endpoints (preferred; verify coverage first).
No auth/payment/M-Pesa/eTIMS/tenant changes are proposed. Approval requested before any backend work.

## 16. Screens/Pages That Should NOT Be Changed (already work well)

1. **`/marketing`** â€” the new public homepage (editorial, real-product-UI; the template for the storefront hero fix).
2. **POS (`/pos`)** â€” workflow, keyboard shortcuts, M-Pesa states, idempotency; only touch touch-target sizes and modal focus.
3. **Admin sidebar + admin dashboard** â€” grouping, permissions, search filter, attention panel, pipeline list; keep structure.
4. **`.btn` / `.data-table` / token layer / dark theme** â€” spec-compliant; keep.
5. **Toast + ConfirmDialog** â€” adopt as-is (add focus trap + stack limit only).
6. **Login (`/login`)** â€” labels, hints, 2FA, Google flow; keep.
7. **my-repairs** â€” the best loading/empty-state example in the codebase.
8. **Control-plane's distinct operator identity** â€” keep the separation; only fix the corrupted title/meta.
9. **`ui/` kit** â€” extend, don't replace.
10. **Cart flow + guest-cart migration** â€” functional; style-only polish.

---

*End of audit. Implementation of Phase 1+ awaits approval.*

