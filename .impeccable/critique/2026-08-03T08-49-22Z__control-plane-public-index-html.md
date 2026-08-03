---
target: control-plane/public/index.html
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 1
timestamp: 2026-08-03T08-49-22Z
slug: control-plane-public-index-html
---
# Critique: Gear&Glitch Control Plane (`control-plane/public/index.html`)

Method: dual-agent (A: ses_039337339ffey7rR0XEF6iINi · B: ses_0393363ccfferKMo20Aj1Dn9ml)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Provisioning log exemplary, but bulk ops reply only via 4s toasts and the 60s auto-refresh silently re-sorts the table. |
| 2 | Match System / Real World | 3 | Fluent domain copy (KES, M-Pesa, eTIMS), but "Pull from client…" / "Push Secret" are unglossed jargon and "Inherit" renders as a dead dash. |
| 3 | User Control and Freedom | 2 | Escape/backdrop close and 2FA back are good; no undo anywhere, Resume fires bare, plan deletion doesn't warn about clients on it. |
| 4 | Consistency and Standards | 3 | Uniform modal/button/badge system, but "Create Client" vs "Add Client", Suspend=yellow vs Delete=red, Deploy-All confirm is primary-blue not danger. |
| 5 | Error Prevention | 3 | Required-field guards and double-submit locks exist; payment shortfalls, past-dated `edit-expires`, and free-form plan IDs slip through. |
| 6 | Recognition Rather Than Recall | 2 | Statuses become legible badges, but 3-state feature chips are color-and-strikethrough encoded with legend buried in prose. |
| 7 | Flexibility and Efficiency of Use | 1 | No search, sort, filter, multi-select, pagination, or keyboard shortcuts; the core table doesn't scale. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean slate/blue system, but 10-column tables, 8-button action cells, and 88-chip grids are dense. |
| 9 | Error Recovery | 2 | Inline login/provisioning errors are clear; toasts are color-border-only, un-live, un-archiveable, often just "Failed". |
| 10 | Help and Documentation | 3 | Tab subtitles and instructive empty states are genuinely good; no docs/help entry. |
| **Total** | | **25/40** | **Acceptable** |

## Design Specificity Verdict

**Content-specific and product-authored; visually generic.** A domain-native tool wearing a rented suit.

- **LLM assessment**: The IA, copy, and flows are unmistakably this product (KES, M-Pesa, eTIMS/KRA, provisioning vocabulary, control-plane secret, pg_dump). But the visual layer is the stock Tailwind dark admin recipe (`--bg #0f172a` / `--primary #3b82f6`); the brand exists in prose and emoji, not in form (no logo lockup, no favicon, no gear/glitch motif).
- **Deterministic scan**: Detector clean — `[]` on all three configs (`--json`, `--scope type`, `--no-inline-ignores --no-design-system`), exit 0. Zero findings, zero false positives to flag.
- **Visual overlays**: None. Browser visualization skipped — local auth-gated static file, no server, no browser automation for this target.

## Overall Impression

The money engine of a POS billing operation, rendered calmly and competently — but the two most valuable surfaces (Record Payment, the clients table) carry the weakest guardrails, and the skin still reads as a rented template rather than the product.

## What's Working

1. **The provisioning feedback loop** — staged status, live elapsed-time log, expectation-setting, an out-of-band escape hatch into the Deploy Log, and a payoff toast. Genuinely authored reassurance for a long opaque operation.
2. **Instructive empty states + tab subtitles** — every empty state names the next action; every tab states its consequence. Better help behavior than most production dashboards.
3. **The confirm-dialog system with detail and secondary actions** — pushSecret's "Push stored secret / Rotate & push new" split and consistent danger styling on true destroys.

## Priority Issues

- **[P0] Record Payment commits without confirmation; underpayments silently pass** — only `amount > 0` is required; a shortfall shows in warning yellow but the subscription is extended regardless. This is the money event in a billing POS. Fix: confirm step (or block submit) when `paid < expected`, showing amount and new expiry. Suggested: `/impeccable harden`
- **[P0] The clients table has no search, sort, filter, or pagination** — 10 columns, unsorted; at 40+ tenants the operator is reduced to Ctrl+F. Fix: search bar, sortable headers, status filter chips, collapse the 8-button action cell. Suggested: `/impeccable shape`
- **[P1] Feature-override chips are inoperable by keyboard/screen reader; 3-state cycle has no back-step** — hidden checkboxes wrapped in labels, state conveyed only via color/glyph/strikethrough; a mis-click can't be undone in one step. Fix: real buttons with `aria-pressed`, "reset to inherit", live legend. Suggested: `/impeccable harden`
- **[P2] Modal and toast accessibility gaps** — no focus trap, no focus return, no `aria-labelledby`, toasts without `role="status"`/`aria-live`, login error without `role="alert"`, notification items are clickable divs. Fix: focus trap + inert, focus return, aria-live, reduced-motion guard on `pulseBadge`/`slideIn`. Suggested: `/impeccable harden`
- **[P3] High-stakes confirm asymmetry + dead visual system** — Resume, plan deactivate, and invoice "Pay" run with zero confirmation while suspend/delete demand danger confirms; `.uptime-bar` CSS is authored but never used; 2FA-Off badge is alarm-red; brand is a colored text span. Suggested: `/impeccable polish`

## Persona Red Flags

**Alex (power user) — provisioning a new client**
- Create replaces the form with a progress log — no edit-mid-flight if the domain/plan was mistyped.
- After the 3-minute wall, "track progress in the Deploy Log" offers no link to that tab.
- The new row lands in an unsortable, unfilterable table; the 60s auto-refresh can reorder rows mid-scan.
- Action cell stacks Suspend (yellow) directly next to Delete (red) — fat-finger risk.
- Record Payment prefills the plan price, but a typo (2500 vs 25000) passes.

**Sam (accessibility-dependent) — recording a payment / editing a plan**
- Toasts are invisible to assistive tech — no `role="status"`/`aria-live`; "Payment recorded!" is never announced.
- Feature chips are inoperable: hidden checkboxes, click-only labels, no focus, no keyboard activation; Sam cannot edit a plan.
- Modals move focus in but don't trap or return it; titles unlabeled.
- Red-on-red badges (`badge-failed`/`badge-overdue`) fail contrast; `pulseBadge` ignores `prefers-reduced-motion`.
- Notification rows are divs with onclick — not focusable.

## Minor Observations

- Dead code: `.uptime-bar`/`.uptime-label` styled but never rendered; `.btn-warning:hover` has no hover state.
- Verb drift: "Create Client" vs "Add Client".
- `switchTab` handles a `client-detail` case with no tab button; no active tab shown on client detail.
- `viewClientDetails` dumps plaintext admin password into the DOM with a copy button (visible to viewers).
- `generateClientInvoice` has no confirm and can double-generate.
- Two parallel payment paths ("Record Payment" vs invoice "Pay") mutate subscription state with no cross-signal.
- `pay-expected` is readonly but styled identically to editable inputs.
- 2FA Off badge is danger-red — "off" isn't an incident.
- No `prefers-color-scheme` — always dark.
- Notification auto-toasts can fire a stack of overlapping 4s toasts.
- Plans "Pull from client..." select is empty until clients load.
- No favicon, no `<meta name="description">`.

## Questions to Consider

- A control plane that shows a client's plaintext admin password on every detail view — is that the trust message?
- Why does "Record Payment" — the one action that moves money — get no confirmation while "Delete" gets a red dialog?
- At 100 clients, is this table usable at all? Where is search?
- Two payment flows both mutate subscription state — divergence bug waiting to be discovered?
- "Deploy All Clients" — dry-run, per-client preview, or rollback, ever?
- Suspend asks twice, Resume asks zero times — which asymmetry is the product decision?
- The 2FA badge goes alarm-red when 2FA is off — warning, invitation, or apology?
- The whole chrome is default slate-on-blue — where is any gear or glitch in the design language?
- Deploy-All's summary ("38 OK, 2 failed") evaporates in four seconds — should that moment have a landing place?
