---
target: unified staff portal (frontend/pages/admin.tsx)
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-08-04T18-02-27Z
slug: frontend-pages-admin-tsx
---
# Critique: Unified Staff Portal (`frontend/pages/admin.tsx`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Loading bars/spinners solid, but feedback inconsistent — AboutUsPage saves silently; some flows `alert()`, some banner. No "saved at HH:MM", no pending-state awareness. |
| 2 | Match System / Real World | 2 | Repairs statuses ("Received", "Ready for collection") natural; "OSCU", "eTims", "Non-stock item", KES-default pricing assume compliance-speak. |
| 3 | User Control and Freedom | 2 | Back/Cancel everywhere, but zero undo, no delete recovery, `window.location.href` jumps (StockTakeListPage:30) yank users out of the SPA. |
| 4 | Consistency and Standards | 3 | Best-scoring heuristic — tokens, `.data-table`, `.panel`, `.field`, badges repeat faithfully. Lapses: raw hexes in 3 files, lone plain `<button>` in CategoryPositioningPage:64, local Spinner re-declared in WhatsAppSettings:7. |
| 5 | Error Prevention | 2 | CSV row-level validation is genuinely good; `confirm()` exists on deletes. But one-click "Mark All Received" + status transitions commit money-adjacent state with no preview. |
| 6 | Recognition Rather Than Recall | 2 | Tabs/filters help in Repairs; elsewhere users must recall SKUs/order numbers — no search, no recent lists. |
| 7 | Flexibility and Efficiency | 2 | Bulk-edit, CSV template, drag-reorder are real accelerators. No keyboard shortcuts, no pinning, no duplicate-from-existing. |
| 8 | Aesthetic and Minimalist Design | 2 | Tokens keep it tidy, but screens are uniformly dense — 9-column ticket table, 6-card stat grid show everything at once. |
| 9 | Error Recovery | 1 | `alert()` raw server messages as the primary channel; `ErrorMsg` only covers initial-load; no recovery steps, no retry affordances. The `.toast` system in animations.css:243 exists and is never used. |
| 10 | Help and Documentation | 1 | Two good inline tips (calendar "Tip: open a ticket…") and helpful label sentences, but no help panel, no status glossary, no onboarding. |
| **Total** | | **19/40** | **Poor (top edge — one point from Acceptable)** |

## Design Specificity Verdict

**An approximate, half-realized design system.** A real one exists — `globals.css` tokens (`--space` 4px base, `--text` 15px, `--radius`, `--shadow`, Sora + JetBrains Mono, dark-aware `--primary`/`--danger`/`--success` + `-light`/`-text` variants), consistently applied via `.panel`, `.field`, `.form-grid`, `.data-table`, `.stat-grid`. That discipline is rare and worth protecting.

But specificity breaks in the components: dozens of `style={{}}` blobs inline the decisions tokens exist to own (AdminRepairs badge maps, StockTakeListPage hardcodes `#d1fae5`/`#991b1b`, CreditNotesPage too). The brand is "Gear&Glitch" (animated gears, glitch hero) but the admin is plain tables + stat cards — coherent back-office, but the layers that would make it feel intentional (statuses, empty states, save feedback) are the weakest.

**Deterministic scan:** The bundled `detect.mjs` returned `[]` (exit 0) on `admin.tsx` and on `frontend/styles` + `frontend/components/admin` — because its rule engine extracts CSS rule blocks, and this file is ~99% React inline-style objects + `var(--token)` values. That "clean" is a scope artifact, not proof of quality. Manual evidence pass (Assessment B) found: 19 hardcoded hex colors (5 real defects: logo stripes `#000/#BF1A2F/#006600` bypass theme tokens and vanish in dark mode; generated-invoice footer `#999` = **2.85:1 contrast, fails AA**); zero `:focus`/`focus-visible` styles in 6,001 lines; 2 keyboard-inert clickable `<tr>` rows (users L1347, orders L5712); 13 non-button `onClick` handlers lacking `role`+`tabIndex`; icon-only buttons (dark toggle ☀️/🌙, ✕/&times; remove buttons) with no accessible name; custom `details/summary` hijack at L1668 breaking the native disclosure pattern.

**Visual overlays:** Not available — no browser automation tool is exposed this session and no dev server is running, so no rendered-DOM or injected-overlay pass was possible. Evidence is static source analysis.

## Overall Impression

A respectable, token-backed admin skeleton whose weakest moments are exactly where trust matters — destructive actions, credential screens, and silent feedback. One great system (Repairs), one spark (CSV import with row-level errors), one dent (AboutUsPage saves with zero confirmation). The single biggest opportunity: unify all feedback on the already-authored toast system and treat every money-adjacent mutation as high-intent.

## What's Working

- **A real, applied design system.** Consistent `.data-table`/`.panel`/`.field` vocabulary, Sora + JetBrains Mono pairing, dark-theme-aware badges, domain-correct KES `formatPrice` everywhere.
- **Repairs module is the crown jewel.** Status lifecycle, technician assignment, ETA/scheduling, quote send + response tracking, parts with live totals, internal vs customer-visible notes, a weekly calendar that opens into its ticket.
- **Bulk operations done right.** Select-all, bulk price/category/stock edit, CSV import with template download and per-row validation; drag-to-reorder with an explicit "Save Order" action.
- **Accessibility groundwork.** `prefers-reduced-motion` respected, `:focus-visible` styling on marketing components, skip link, sr-only utilities, honest `EmptyState`s with actionable CTAs.

## Priority Issues

1. **[P0] Irreversible one-click actions with no preview or undo.** "Mark All Received" on a PO and status transitions that move money-adjacent state commit on a single click.
   - Why: for a POS this is a showstopper risk — one misclick silently changes a whole purchase order or stock state.
   - Fix: confirmation modal summarizing scope before commit ("12 lines · KES 384,000 → Received"), and where feasible a short undo window with audit trail.
   - Suggested command: `/impeccable harden`

2. **[P0] Credential surfaces are masked but not protected.** WhatsApp access/app secrets, verify token, and eTIMS OSCU keys are shown with `type="password"` only (WhatsAppSettings.tsx:160–171) — no re-auth to reveal, no copy affordance, webhook URL has no copy button.
   - Why: leak risk in a compliance-touching product; users also copy-paste credentials by hand.
   - Fix: require auth to reveal secrets, add copy buttons, never echo full secrets after save.
   - Suggested command: `/impeccable harden`

3. **[P1] Silent saves + `alert()`/`confirm()` as the only feedback channel.** AboutUsPage returns no success state; several forms only fail loudly. Meanwhile a full `.toast` system exists (animations.css:243) and is never used.
   - Why: users don't know if a write succeeded — the exact moment trust breaks in admin software.
   - Fix: unify success/error/destructive-confirm on toasts + in-app modals; keep the same copy pattern everywhere.
   - Suggested command: `/impeccable polish`

4. **[P1] No search or filters in the busiest tables.** Orders, products, stock, and credit notes require manual scanning; only Repairs has filters. No sticky headers on `data-table`.
   - Why: recognition/recall + working-memory rule fail once lists grow; managers can't answer "is this order here?"
   - Fix: search box + saved filters on the busiest tables, sticky headers.
   - Suggested command: `/impeccable polish`

5. **[P1] Keyboard access and focus gaps.** Zero `:focus`/`focus-visible` styles in 6,001 lines; clickable `<tr>` rows (users L1347, orders L5712) not keyboard-activatable; 13 non-button `onClick` handlers lack `role`+`tabIndex`; icon-only buttons (dark toggle, ✕/&times;) have no accessible name; invoice footer `#999` fails AA contrast; `summary` hijacked with `preventDefault`.
   - Why: keyboard/screen-reader users (and the accessibility baseline) can't operate core tables; unnamed icon buttons are invisible to assistive tech.
   - Fix: focus-visible treatment, `role`/`tabIndex`/`onKeyDown` on interactive rows, `aria-label`s on icon-only controls, token-based colors.
   - Suggested command: `/impeccable audit`

## Persona Red Flags

- **Alex (Power User):** No keyboard shortcuts anywhere; primary actions aren't keyboard-accelerable. "Start Session" hard-redirects via `window.location.href` to `/stock-take/{id}` (StockTakeListPage:30), leaving the SPA context behind. The bulk flows (CSV, batch edit) are right, but nothing is faster than clicking.
- **Sam (Accessibility):** Tabs through a surface with no `:focus-visible` anywhere; the users/orders `<tr>` rows are mouse-only; icon-only dark toggle ☀️/🌙 and ✕ remove buttons have no accessible name; invoice-footer `#999` text fails WCAG AA; the `summary` disclosure is broken by `preventDefault`, so the native keyboard toggle stops working.
- **Riley (Stress Tester):** "Mark All Received" commits with no scope preview — a whole PO can change silently. No undo exists anywhere. Repairs parts-entry has 90px/130px inputs with no unit labels, inviting fat-finger money errors, and a typo of KES 1,200,000 vs 120,000 in "Hardware value" is silent.

## Minor Observations

- `formatPrice` is used for catalog prices and repair costs, but "Hardware value" is a free-text `Number` — a KES-magnitude typo is silent.
- CreditNotesPage hardcodes green/amber hexes where `--success-light`/`--warning-light` tokens exist (CreditNotesPage.tsx:32); StockTakeListPage hardcodes `#d1fae5`/`#991b1b`.
- Repair "Send quote" button is disabled once a quote exists but the label flips to "Quote sent" — mixed tense/label (AdminRepairs.tsx:321–323).
- `escapeHtml` not applied consistently (group names rendered raw in AdminProducts.tsx:380).
- The gear loading screen in animations.css is built, but the admin uses the simpler Spinner — a component library ahead of its consumers.
- Empty table states vary: `EmptyState` components vs bare `<tr><td>No repair tickets match…</td></tr>` (AdminRepairs.tsx:282).
- Logo stripes `#000/#BF1A2F/#006600` (admin.tsx:392–394) bypass theme tokens and are invisible in dark mode.
- Local Spinner in WhatsAppSettings.tsx:7 shadows the shared one.

## Questions to Consider

1. If every admin mutation were treated like moving money — preview, confirm, audit, undo-window — would one-click "Mark All Received" survive review?
2. The `.toast` system is fully authored and unused — what does it say that the team built feedback infrastructure and then chose `alert()` anyway?
3. Who is this panel for — the compliance accountant (eTIMS, OSCU, credit notes) or the floor technician (calendar, tickets, stock)? The IA treats both as equal tabs; neither persona wins.
4. Why does an ops tool inherit the storefront's `fadeInUp` panel animation (animations.css:521–526)? Frictionless tools animate *responses*, not arrivals.
5. If the design system is the source of truth, why do three files override it with raw hexes — and what would break if someone trusted the tokens instead?
