---
timestamp: 2026-08-04T18-45-32Z
slug: frontend-pages-admin-tsx
---
---
target: unified staff portal (frontend/pages/admin.tsx)
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
timestamp: 2026-08-04T18-45-00Z
slug: frontend-pages-admin-tsx
---
# Critique: Unified Staff Portal (rontend/pages/admin.tsx) — re-run after harden + audit + polish

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Toast + confirmDialog system now universal: success toasts on every save/delete, error toasts, in-app destructive confirms. AboutUsPage (previously silent) now toasts. |
| 2 | Match System / Real World | 2 | Unchanged — OSCU/eTIMS/Non-stock jargon and KES-default pricing still assume compliance-speak. |
| 3 | User Control and Freedom | 2 | Unchanged — back/cancel everywhere but still no undo window or delete recovery. |
| 4 | Consistency and Standards | 4 | Raw hexes removed from CreditNotesPage/StockOnHandPage/logo stripes/invoice footer; local Spinner deduped to shared; lone plain button replaced with RippleButton; group names escaped. |
| 5 | Error Prevention | 4 | "Mark All Received" now previews scope (lines + KES cost) in a danger confirm; pending-state Cancel confirms too; CSV row-level validation retained. |
| 6 | Recognition Rather Than Recall | 4 | Search added to Products, Stock on Hand, Credit Notes, Purchase Orders; invoices already had search + status + date filters; Repairs had filters. |
| 7 | Flexibility and Efficiency | 2 | Unchanged — bulk-edit/CSV/drag-reorder remain, no keyboard shortcuts or pinning. |
| 8 | Aesthetic and Minimalist Design | 2 | Unchanged — dense tables/stat grids remain. |
| 9 | Error Recovery | 3 | alert()/confirm()/prompt() fully eliminated; toasts are the single feedback channel; destructive flows confirm in-app. No undo/retry affordances yet. |
| 10 | Help and Documentation | 1 | Unchanged — no help panel or status glossary. |
| **Total** | | **28/40** | **Acceptable** |

## Design Specificity Verdict

The token-backed system now carries through to the weak layers the previous critique called out. Prior P0s (irreversible one-click PO commit; unprotected credential surfaces) are resolved: PO receive/cancel confirm with scope preview; WhatsApp secrets and eTIMS OSCU keys are masked with show/hide + copy affordances and new-password autocomplete. Prior P1s (silent saves + alert-only feedback; no search/filters; keyboard/focus gaps) are resolved: toasts are the single feedback channel; search exists on the four busiest tables; clickable rows are keyboard-activatable; icon-only buttons carry aria-labels; the invoice footer #999 contrast failure is fixed; the details/summary hijack is removed. Deterministic scan returns [] and 	sc --noEmit is clean.

## What's Working

- One feedback channel, fully adopted: 	oast + confirmDialog/promptDialog across admin.tsx and every admin component — verified by a zero-match grep for alert/confirm/prompt across all frontend .tsx/.ts.
- Scope-previewed destructive actions on money-adjacent state (PO receive, PO cancel).
- Search now present on the four busiest tables (products, stock on hand, credit notes, purchase orders) plus existing invoice filters and repairs filters.
- Keyboard access baseline: global :focus-visible, activatable <tr> rows, named icon-only buttons.

## Priority Issues

None open at P0/P1. Remaining gaps are P3 quality: no undo window, no keyboard shortcuts, no help/glossary, compliance jargon untranslated, dense-table layout.

## Minor Observations

- Re-auth-to-reveal for credential secrets (full fix in the prior P0 #2) not implemented — show/hide + copy was shipped instead.
- Inline msg panels still exist in a few flows (bulk edit, CSV import result) alongside toasts — harmless but a second feedback channel.
- "Hardware value" free-text Number typo risk (KES magnitude) still silent.

## Questions to Consider

1. If every admin mutation were treated like moving money, would one-click "Mark All Received" survive review? (Now answered: it previews + confirms, but there is still no undo window.)
2. Should the remaining inline msg panels (bulk edit / import) migrate to toasts for a single feedback channel?
3. Is the compliance-accountant or floor-technician persona the primary? IA still treats both as equal tabs.
