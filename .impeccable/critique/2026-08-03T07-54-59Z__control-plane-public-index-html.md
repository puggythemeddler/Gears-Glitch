---
target: control-plane dashboard (solo-operator provisioning + billing panel)
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-08-03T07-54-59Z
slug: control-plane-public-index-html
---
# Impeccable Critique — Gear&Glitch Control Plane Dashboard

Method: dual-agent (A: ses_03965f288ffeTd2wOuj1bQhlcM · B: ses_03965dbc1ffeeSo3TAmFSPDFOs)

Visual inspection limited: no browser tool in this harness; the target is additionally auth-gated (login screen is the only surface viewable without credentials). Assessment A is source-based design review; Assessment B is the deterministic detector plus a documented fallback signal.

Target: `control-plane/public/index.html` (slug `control-plane-public-index-html`), single-file SPA (inline CSS + JS), login screen + dashboard tabs (Clients, Plans, Changelog, Settings, Deploy Log, Backups, Audit Log).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Provisioning modal hides at 2s (`:975`) while the op runs ~2 min with no visible progress; tables flash zeros on load |
| 2 | Match System / Real World | 3 | Good operator language + KES billing; `badge-deploying` has no CSS, "OVER LIMIT" borrows the red overdue badge |
| 3 | User Control and Freedom | 1 | No Esc/overlay-click to close modals, no cancel for in-flight ops, Push Secret forces a `prompt()` word-typing ritual |
| 4 | Consistency and Standards | 2 | Subscription color math contradicts the README; info reminders render as error toasts; plan dropdown hardcodes legacy IDs |
| 5 | Error Prevention | 2 | Confirms exist for Delete/Suspend/Deploy All, but partial payments allowed silently; double-click re-submits unguarded |
| 6 | Recognition Rather Than Recall | 2 | 8 unlabeled per-row buttons; tri-state override and push-secret words must be recalled |
| 7 | Flexibility and Efficiency | 2 | No sortable columns, no search/filter, every tab switch refetches, no batch actions |
| 8 | Aesthetic and Minimalist Design | 2 | Coherent palette, but a 12-control header, 10-column table, and up to 8 row buttons for <10 clients |
| 9 | Error Recovery | 1 | Generic "Failed" toasts, swallowed server errors, no retry affordance; failed deploys don't say which client |
| 10 | Help and Documentation | 1 | No inline help beyond subtitle paragraphs; the two invented rituals depend on tooltips/footnotes |
| **Total** | | **18/40** | **Poor** |

## Design Specificity Verdict

**Mixed, leaning category-generic.** The content is aggressively product-specific (tri-state feature-override picker, payment-reminder banner, `Xd left` badge math, Record Payment modal, provisioning flow, Push Secret ritual, KES currency, Gear&Glitch branding, OVER LIMIT badge). The *form* is a stock admin dashboard — login card, header action bar, tab strip, four stat cards, a 10-column table with traffic-light badges, modal forms, toasts — that an unrelated product (CRM, fleet manager, property manager) could wear unchanged. The specificity lives in *what* the rows say, not in *how* it looks or behaves.

Deterministic scan: `detect.mjs --json control-plane/public/index.html` returned `[]` (exit 0), also clean on `--no-inline-ignores --no-design-system` and `--scope type` passes. No findings, no false positives. Engine coverage confirmed; positive controls behaved correctly (no silent skip). Note scope limit: the static engine only sees source, and the dashboard is auth-gated.

Visual overlays: not available — no browser tool in this harness; no live server started, no injection attempted (fallback signal). Only the login screen would be viewable without credentials.

## Overall Impression

A competent, internally disciplined admin shell wrapped around genuinely authored billing/provisioning content — and the design problems are behavioral, not cosmetic. The single biggest opportunity: **treat the high-stakes operations (provisioning, suspension, deploys) with the same ceremony and honesty as the Record Payment modal, which is the one surface that gets feedback right.**

## What's Working

1. **The Record Payment modal** (`:436-453`, `:1777-1804`) — expected amount pre-filled, next-payment date auto-computed, live balance with %-paid feedback, success toast naming new expiry and balance. The model for the rest of the app.
2. **Actionable empty states** — "No clients yet → + Add Your First Client", backups/changelog/deploy empties each state the next step. Rare and well done.
3. **A real tokenized visual system** — CSS variables, consistent button variants, coherent badges; the notifications bell (unread count, dedup, click-through, outside-click dismiss) is a clean working pattern.

## Priority Issues

### [P0] Provisioning gives false progress then abandons the operator
- **What**: Static "Setting up..." text (`:974`), modal auto-hides at 2s (`:975`) while the real work continues ~2 min; result later lands as a lone toast.
- **Why it matters**: Provisioning is the flagship end-to-end flow; the UI actively misleads during it and gives no path on failure.
- **Fix**: Keep the modal open on a real step list (or persistent banner); close only on terminal success/failure; on failure show which step errored with a retry.
- **Suggested command**: /impeccable clarify

### [P0] Billing-enforcement actions lack consequential confirmation and undo guidance
- **What**: Suspend confirm says only "Their service will be paused" (`:1028`); Resume has no confirm; Delete uses a bare native confirm (`:1012`).
- **Why it matters**: Suspending turns off a paying tenant's storefront — highest-stakes act, least ceremony; undo path never surfaced.
- **Fix**: Styled confirmation modal for Suspend/Delete listing consequences ("storefront returns 403, invoice still billable; Resume restores instantly") plus explicit Resume affordance in the toast.
- **Suggested command**: /impeccable clarify

### [P1] The status/color system contradicts itself and its own README
- **What**: 8–30 days-to-expiry renders green `badge-active` (`:860-862`) where README specifies yellow; `badge-deploying` has no CSS (`:876`); OVER LIMIT borrows the red overdue badge; payment reminders fire as error toasts (`:1894`).
- **Why it matters**: The operator reads risk from color, and a client 29 days out looks identical to a fully active one.
- **Fix**: One documented state→badge mapping; add `.badge-deploying`; distinct usage-limit badge; route informational reminders through info-toast style.
- **Suggested command**: /impeccable adapt

### [P1] Two sources of truth for plans silently break derived data
- **What**: Add/Edit modals hardcode `starter/growth/pro/enterprise` (`:379`) while the Plans tab manages `custom_plans`; `recordClientPayment` looks up by id in `paymentPlans` (`:1765`), so every legacy-plan client sees **"Expected Amount: KES 0"** (`:1789`).
- **Why it matters**: A real financial flow displays wrong numbers for the most common case.
- **Fix**: Populate dropdowns from `/api/plans`, with a fallback price table for legacy IDs.
- **Suggested command**: /impeccable harden

### [P1] Accessibility of the modal + confirmation layer
- **What**: Modals are non-focusable `div`s with no Esc/focus-trap/`role="dialog"` (`:371`); feature chips hide inputs (`display:none`, `:746`); 2FA badge is a `<span onclick>` (`:184`); destructive flows use `confirm()`/`prompt()`; status is color-only.
- **Why it matters**: Sam cannot operate any modal, the tri-state override, or 2FA management by keyboard/AT.
- **Fix**: Real focus-managed overlays, visible-focus tri-state chips, keyboard-close + focus restore, in-app confirmation dialogs.
- **Suggested command**: /impeccable harden

### [P2] Header global overload and row-action sprawl
- **What**: ~12 header controls (`:176-193`) repeat on every tab; 8 buttons per client row (`:880-889`) for <10 rows.
- **Why it matters**: The single operator's attention is the scarcest resource; everything is equidistant, nothing prioritized.
- **Fix**: Move Cloudinary cluster + Deploy All into their tabs; keep header at bell + 2FA + Health Check + Add Client + logout; compress row actions with the rest behind an overflow menu.
- **Suggested command**: /impeccable layout

### [P3] Secret hygiene in the DOM
- **What**: Full `admin_password` rendered in clear with copy affordance (`:1640`); masked API key reveals full value on hover via `title` (`:1528`).
- **Fix**: Mask with reveal toggle; drop the full-key `title`.
- **Suggested command**: /impeccable harden

## Persona Red Flags

**Alex (Power User)**: Header wall of ~12 controls forces the eye to hunt for Add Client every visit. No keyboard shortcuts, no sortable columns, no search — each short session is a full visual scan. Per-tab refetch (`:1615-1622`) + full-table re-render every 60s (`:1287`) add friction and can eat an in-flight interaction. Push Secret `prompt()` ritual (`:1017`) requires remembering vocabulary mid-flow. Provisioning disappears at 2s (`:975`) — must babysit polling. Failed-deploy toasts don't say which client (`:1091`), forcing a trip to Deploy Log.

**Sam (Accessibility-Dependent)**: Modals have no `role="dialog"`, no `aria-modal`, no focus trap, no Esc — focus stays behind the overlay. Tri-state feature chips (`:742-749`) hide their inputs (`display:none`) so the override is mouse-only. The 2FA badge (`:184`) and the password-copy control (`:1640`) are non-focusable `span`s with onclick. All destructive actions depend on native `confirm()`/`prompt()`. Status is color-only: green "Active" vs green "25d left" vs green uptime — no text reinforcement. Notifications bell has no `aria-live`/`aria-expanded`; unread badge numeric-only.

## Minor Observations

- Stray closing `</div>` at `:342`.
- `.badge-deploying` referenced (`:876`) but never styled; renders uncolored.
- `--text-secondary` used at `:1234`, `:1666`, `:1919` but never defined in `:root` — those fall back to bright inherited white.
- `loadUpgradeRequests` (`:1416-1459`) does an N+1 sequential fetch per client on every Clients-tab visit.
- Info "Payment due in 1 week" notifications fire as error toasts (`:1892-1895`).
- "Pay" (mark invoice paid, `:1829`) vs "Record Payment" (extend subscription, `:1806`) — two adjacent flows whose difference is unexplained.
- `api()` always calls `r.json()` (`:804`); a non-JSON error response throws an uncaught error → generic "Failed".
- No visible loading state on first paint; stats show literal `0`/`KES 0` before data arrives (`:210-213`).
- Plan card uses "Del" (`:1316`) while everywhere else says "Delete".
- Login password field has no show/hide; `placeholder="admin"` hints at the default credential.
- 4-second toast lifetime (`:809`) is too short to read "Deployed: X OK, Y failed" and follow up.
- Payment-reminder banner prints the raw `dueDate` string (`:1887`) — locale-inconsistent next to `toLocaleDateString()` elsewhere.

## Questions to Consider

1. The fleet is <10 clients. If the table has 10 columns and each row 8 buttons, what is the UI optimized for — and when will 6 of those buttons have been pressed even once?
2. "Deploy All" is one click away in the header on every screen. For a solo operator shipping a fix to one store, is that ever the right default, or a disaster waiting to be double-clicked?
3. Suspending a client — which costs a tenant their storefront — carries less confirmation ceremony than publishing a changelog. What does that ordering say about what the product believes is dangerous?
4. The app polls and re-renders every 60 seconds and keeps 7 tabs alive, yet the operator logs in a few times a week. Why is it behaving like an always-on monitoring tool?
5. Two invented rituals — the `prompt()` "push/rotate" word-typing and the tri-state chip cycle — depend on memorized convention. Would plain dialogs that state their consequence in a sentence be better?
6. "Expected Amount: KES 0" renders for every client on a hardcoded plan (`:1789`). How many other silent leaks does the legacy-vs-custom plan split hide behind a green "Active" badge?
7. What message does a green "25d left" badge beside a red "OVER LIMIT" badge send to an operator deciding who to call this week?
