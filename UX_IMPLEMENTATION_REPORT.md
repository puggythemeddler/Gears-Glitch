# Gear&Glitch UX Implementation Report

Status of the 14-phase `UX_AUDIT.md` remediation. All completed phases are verified against the audit requirements; phases marked deferred are documented with reasons.

## Verification baseline (applies to all phases)

| Check | Command | Result |
| --- | --- | --- |
| Frontend typecheck | `cd frontend && npm run typecheck` | Pass (0 errors) |
| Frontend production build | `cd frontend && npm run build` | Pass, 28/28 pages |
| Server typecheck | `npm run typecheck` (repo root) | Pass (0 errors) |
| Server build | `npm run build` (repo root, `tsc`) | Pass |
| Emoji scan | surrogates `[\uD800-\uDBFF][\uDC00-\uDFFF]` over all frontend ts/tsx | 0 hits |
| Mojibake scan | U+FFFD over repo source | 0 hits (expected hits only inside `node_modules/iconv-lite`) |
| CSS token lint | `--violet` / `--indigo` references | 0 hits |

## Phase status

### Phase 1 &mdash; Design system &amp; token adoption — COMPLETE
- Token cleanup across all 8 theme blocks in `frontend/styles/globals.css`: removed off-spec `--violet*`, `--indigo*` tokens; added reusable `--focus-ring: 0 0 0 3px var(--primary-subtle)` token per block.
- Adopted `--focus-ring` in all existing focus ring rules (`.input:focus`, `.btn:focus`, etc.).
- Storefront hero de-glass is the flagship token-migration item. See Phase 12.

### Phase 2 &mdash; Admin information architecture — COMPLETE
- Admin sidebar and nav (`frontend/pages/admin.tsx`) already grouped; added **Warranty** navigation entry (icon `shieldCheck`, permission `order:view`) routing to the new AdminWarranties view.

### Phase 3 &mdash; De-emoji — COMPLETE
- Zero emoji repo-wide across frontend sources (including surrogate-pair scan covering all 28 pages, components, and layouts).
- Recent additions included campaign/group empty-state glyphs (`📦`, `📢`) replaced with `Icon` component SVGs.
- The prior MarqueeBanner holiday emoji system was retired entirely during the MarqueeBanner rewrite (Phase 12).

### Phase 4 &mdash; Admin dashboard — COMPLETE
- Static numeric stat cards (no auto-advancing text carousels); revenue/orders data via existing `/api/admin/*` endpoints.

### Phase 5 &mdash; Order management UX — COMPLETE
- Order status pills, loading states, `formatPrice` unified to app-context currency-aware formatter on `/orders` and `/order`; customer detail totals in admin.

### Phase 6 &mdash; Wishlist, product cards, POS — COMPLETE
- Wishlist rows with prices/actions, ProductCard avatar + discount badges, POS touch-first layout with change preview and large tap targets.

### Phase 7 &mdash; Inventory stock views — COMPLETE
- Stock-on-hand, stock-take, purchase orders, serial tracking migrated to typed `DataTable` with sortable value/format columns.

### Phase 8 &mdash; Repairs admin — COMPLETE
- `AdminRepairs.tsx`: 7-status visual progression, updates/notes rendered as a timeline (`.timeline`), `quality_check` status added to `STATUS_LABELS`/`STATUS_OPTIONS`, `StatusBadge` used for status colors.
- Customer-assets section on ticket detail: linked serials with warranty summary; asset linkage surfaces the repair&nbsp;↔&nbsp;asset connection (repair_tickets has no serial column; linkage is via customer-owned assets).
- Violet/indigo off-spec status colors replaced with semantic colors (see Phase 14 token removal).

### Phase 9 &mdash; Warranty admin — COMPLETE
- `AdminWarranties.tsx` verified wired in `admin.tsx`: imported (L31), rendered for view `"warranties"` (L684), permission `order:view` (L55), nav label "Warranty" (L125), icon `shieldCheck` (L187).
- Backed by read-only `GET /api/admin/warranties` (owner-auth). Computes `startDate`/`expiryDate`/`daysLeft`/`status` (`active` | `expiring` &le; 30d | `expired`); optional `?customerId=` filter.
- Filters use bare `<select>`/`<input>` consistent with AdminRepairs and global form styles.

### Phase 10 &mdash; Encoding / mojibake — COMPLETE (verified clean)
- No U+FFFD anywhere in repo source (only bundled `node_modules/iconv-lite`, which is expected).
- control-plane `index.html` title/meta and root `package.json` description are clean (console artifacts were codepage rendering of a legitimate U+2014 em dash). No fix required.

### Phase 11 &mdash; Countdown removal — COMPLETE
- P0-3 removal confirmed and applied: hero countdown fully removed (component + markup + tokens + CSS).

### Phase 12 &mdash; Storefront hero de-glass &amp; listing UX — COMPLETE
- `frontend/layouts/original.tsx`:
  - Removed glass/glow/particle system: HeroParticle, HeroCountdown, useCountUp/HeroStatValue, `shade()`, `variantIdx` + auto-advance intervals (carousel + headline variants), hero glow blobs, particles, `hero-btn-glass`, `hero-image-glow`, wave divider.
  - `heroStyle` now sets a flat `--hero-bg` (solid custom color) instead of the gradient; count-up stat values are static.
  - Retained functional content: hero chips, product/headline dots, stats, trust strip, badges, kenburns animation, CTA (class typo `wan--btn` corrected to `hero-wa-btn`).
- `frontend/styles/globals.css`:
  - Deleted `--brand-glow-a/b`, `--brand-particle`, `--hero-glass-*`, `--hero-countdown-*` tokens from all 8 theme blocks.
  - Converted the 6 `--hero-bg-gradient` lines to flat light/dark colors; `.hero` background = `var(--hero-bg, var(--hero-bg-gradient))`.
  - Removed `.hero-glow*`, `.hero-particle`, `.hero-bg`, `.hero-btn-glass`, `.hero-image-glow`, `.hero-countdown`, `.hero-wave` rules; removed glass backdrop-blur on stats/badges, hero floats/pulses; kept reduced-motion block updated.
- `frontend/components/MarqueeBanner.tsx` (rewritten flat): no per-mount `<style>` injection; marquee keyframes moved to globals.css (`splashMarquee`); honors admin `bgColor`/`textColor`/`image_url`/`link_url`; hairline-border splash bar with single SVG tag icon.
- `frontend/pages/[category].tsx` (rewritten): sort dropdown (newest / price asc / price desc / name), 12-per-page `Pagination`, EmptyState/ErrorState/skeleton states. Home "All products" section received the same sort + pagination (12/page). Added `.listing-toolbar`, `.listing-count`, `.listing-sort`, `.filter-select` CSS.
- Zero emoji in the replacement work (surrogate scan clean).

### Phase 13 &mdash; Per-page titles — COMPLETE
- `PageHead` (SSR) added to public/storefront pages: cart, contact, product (dynamic `${product.name} - Gear&Glitch` + `<meta name="description">` from product description), repairs, repair-book, login, group/[slug] (unused `next/head` import removed), campaign/[slug] title already present.
- `usePageTitle` added to dashboard, account, groups, quotes (role-aware: "Quotes management" for staff / "My quotes" for customers), pos, suppliers/new, suppliers/[id].
- admin already had dynamic `PageHead`; remaining pages verified as already titled (`[category]`, `_document`, about, admin, index, marketing, my-repairs, order, orders, repair-ticket, stock-take/[id], wishlist).

### Phase 14 &mdash; Final consistency pass — COMPLETE for scoped items (see Deferred)
- **formatPrice**: page-local duplicates removed. `dashboard.tsx` and `quotes.tsx` now use the currency-aware app-context `formatPrice` (QuoteDetail/QuoteCreator receive it by prop); `stock-take/[id]` imports the shared admin formatter. Remaining shared modules (`lib/app-context`, `components/admin/shared`, storefront `layouts/shared`) are the canonical sources; no page-level copies remain.
- **Terminology**: standardized edit-form saves to "Save changes" (admin subscription edit, groups edit, barcodes save-all, AdminRepairs edit); `Save Changes` casing normalized; suppliers pages already correct ("Save Supplier" / "Save changes"). Shared create/edit forms (e.g. AdminProducts) intentionally keep "Save".
- **Token removal**: `--violet*`/`--indigo*` deleted from light + dark theme blocks; the single `var(--violet)` usage in `quotes.tsx` (Edit Items) converted to `btn btn-secondary`.
- **Dark-mode sweep**: audited every inline `style=` literal across the frontend. The overwhelming majority already use CSS tokens, so they adapt to dark mode. Remaining hardcoded values are deliberate (text `#fff` on colored CTA backgrounds, `input[type=color]` pickers, admin banner preset swatches). Two non-token error/caption colors converted to tokens (`ProductPositioningPage` save-status banner, marketing operator caption). No unknown dark-mode-breaking inline colors remain in TSX.

## Scope notes added during implementation

- **Read-only additive backend endpoints** (no auth/payment/tenant/control-plane changes): `/api/admin/warranties`, `/api/products?withExtras=1`, `/api/repairs` + `/api/serials` `?customerId=` filters, `/api/admin/orders?customerId=` passthrough (`db.listOrders(customerId?)`).
- WhatsApp Verify-Token fix (`server/db.ts:1723`, `frontend/components/admin/WhatsAppSettings.tsx:231`) was deliberately not modified.

## Deferred (documented, intentional)

| Item | Reason |
| --- | --- |
| Warranty claims / registration UI | No `warranty_claims` table exists; requires backend migration + schema work beyond a pure UX pass. |
| Full inline-`style` migration to utility classes | ~1,500 occurrences (largest in `admin.tsx`). Audit P1-6 flagged it; the dark-mode-correctness value was captured via the token sweep above. Remaining conversions are cosmetic consistency work with regression risk out of proportion to benefit. |
| Button-label normalization to a single Save/Create/Delete/Remove convention | Semantic split (destructive *Delete* vs membership *Remove*; *Save* on shared create/edit forms) kept where it is genuinely correct; further blanket changes were avoided to prevent mislabeled admin actions. |
| Test suite execution (`npm test`) | Tests require a live PostgreSQL database and tenant/seed state; not run in this environment. Typecheck + production build on both server and frontend are green. |

## Key files touched

- `frontend/layouts/original.tsx`, `frontend/components/MarqueeBanner.tsx`, `frontend/pages/[category].tsx`
- `frontend/styles/globals.css`, `frontend/styles/animations.css`
- `frontend/pages/{dashboard,account,groups,quotes,pos,cart,contact,product,repairs,repair-book,login}.tsx`, `frontend/pages/group/[slug].tsx`, `frontend/pages/campaign/[slug].tsx`, `frontend/pages/stock-take/[id].tsx`, `frontend/pages/suppliers/*`
- `frontend/components/admin/{AdminRepairs,AdminWarranties,AdminProducts,ProductPositioningPage}.tsx`
- `server/index.ts` (read-only additive endpoints)