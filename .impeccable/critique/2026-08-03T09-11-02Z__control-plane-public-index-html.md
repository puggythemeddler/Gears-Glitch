---
target: control-plane/public/index.html
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
timestamp: 2026-08-03T09-11-02Z
slug: control-plane-public-index-html
---
# Critique: Control Plane dashboard (`control-plane/public/index.html`)

Method: dual-agent (A: ses_0391e7f4bffeZfEKx09kFWz45v · B: ses_0391e6f42ffewYHGGWQQE5HnkZ)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Provisioning live-log is genuinely excellent; but suspend/resume/health/redeploy collapse to one transient toast with no per-row in-progress state |
| 2 | Match System / Real World | 4 | KES, M-Pesa, eTIMS/KRA, +254, tenant-shop billing — fluent in the operator's language |
| 3 | User Control and Freedom | 3 | Esc, overlay-click, Cancel and 2FA "Back" everywhere; but no undo for delete/rotate-key and no clear control on search/filters |
| 4 | Consistency and Standards | 3 | Delete renders twice per row (inline + in "More"); bell uses an emoji while nav uses text glyphs; tabs lack role=tab/aria-selected |
| 5 | Error Prevention | 4 | Underpayment guard, danger-styled confirms on every destructive/money path, feature chips constrain state |
| 6 | Recognition Rather Than Recall | 3 | Sort arrows, filters, and the tristate legend reduce recall; "More" menus bury recoverable actions |
| 7 | Flexibility and Efficiency | 2 | No shortcuts, no bulk edit, full-table re-render every 60s, record-payment two clicks deep |
| 8 | Aesthetic and Minimalist Design | 3 | Coherent dark slate/blue system; 11-column table and dense header raise the noise floor |
| 9 | Error Recovery | 2 | ~10 handlers swallow the server message into generic toast("Failed"); errors appear at viewport edge, not source |
| 10 | Help and Documentation | 2 | Good inline subtitles/tooltips; no help affordance; jargon never linked to explanation |
| **Total** | | **29/40** | **Good** |

## Design Specificity Verdict

**LLM assessment**: Functionally and textually unmistakably authored for Gear&Glitch — KES currency, M-Pesa chip, eTIMS/KRA compliance, +254/Nairobi placeholders, Neon/Render/Vercel provisioning, push-secret, pull-plans, the gear favicon and wordmark. The interaction model is product-shaped too: record-payment with an underpayment guard, per-client feature overrides, plan-sync to all tenants are bespoke. The caveat: the visual register is a generic dark-slate admin template — swap the copy and it is visually indistinguishable from a thousand internal-ops dashboards. Specific in substance, default in skin.

**Deterministic scan**: All three detector configurations return `[]` (exit 0) — zero findings. Inline script passes `node --check`. 140 ids, 0 duplicates. All 137 `getElementById` references resolve (the 4 non-static ones are created at runtime before first read).

**Visual overlays**: Browser visualization unavailable — no browser automation tool is exposed in this environment, so no live overlays were injected. Report the fallback signal: source+detector evidence only.

## Overall Impression

The money engine of a POS billing operation, rendered calmly and competently — and now, after the latest pass, both P0s are gone (Record Payment has a shortfall-guarded confirm; the clients table has search/sort/filter and a collapsed action cell). Score is up from 25/40 (Acceptable) to 29/40 (Good). What remains is not correctness but polish: the header is still an 8-button decision wall, error messages still discard the server's specific text, and the delete affordance appears twice per row.

## What's Working

1. **Provisioning-as-experience.** Live polling log with elapsed time, inline error surface, and an explicit "track in Deploy Log" escape hatch — the right design for a multi-minute opaque operation.
2. **Money-safety in Record Payment.** Pre-filled expected amount, live balance computation, shortfall detection, and a danger-styled confirm label ("Record & leave balance") — the highest-stakes daily action is the best-guarded one.
3. **Accessibility hygiene is real, not token.** Focus trap + focus return + aria-labelledby on modals, tristate chips with aria-pressed="mixed", a single aria-live="polite" toast container, color-scheme dark, masked admin password.

## Priority Issues

- **[P1] Header is a 6–8-button decision wall.** For admins the header stacks bell, 2FA badge, Health Check, +Add Existing, +Add Client, Sign Out — all equal-weight ghost, so the primary "+ Add Client" is diluted. Fix: keep one primary + bell/badge; fold Health Check and +Add Existing into an overflow menu. (Suggested: /impeccable distill)
- **[P1] Generic "Failed" errors destroy trust at the worst moments.** `suspendClient`, `resumeClient`, `redeployClient`, `saveClientEdit`, `publishChangelog`, `deleteUser`, `createUser`, `loadPlans` all collapse to `toast("Failed","error")`, discarding the server's specific message. Fix: route `e.message` through every catch and pin errors near their source. (Suggested: /impeccable harden)
- **[P2] Delete is duplicated per row.** Each row renders an inline Delete button and a Delete inside the "More" menu — redundant and a fat-finger risk. Fix: keep Delete only in the menu, or only inline. (Suggested: /impeccable polish)
- **[P2] No undo path for destructive ops.** Delete client/user, regenerate API key, rotate-push secret are confirm-only. Fix: toast-level undo or restate the irreversible consequence in the confirm message. (Suggested: /impeccable harden)
- **[P3] Mobile is an afterthought for the core table.** On ≤768px the 11-column table is a horizontal-scroll wall; coarse-pointer bump covers buttons/tabs but not inputs/selects/chips (~30px targets). (Suggested: /impeccable adapt)

## Persona Red Flags

**Alex (Power User)**: Zero keyboard shortcuts; record-payment is two levels deep (row Details → Record Payment → confirm). The 60s auto-refresh re-renders the whole table, killing scroll position mid-scan. Tab switches refetch without cache. No bulk path for feature overrides.

**Sam (Accessibility)**: The "More" menu is a native `<details>` with an absolutely-positioned menu — focus isn't moved into/trapped in it, Escape won't close it, `summary` lacks aria-expanded/aria-haspopup. Tabs are plain buttons with no tablist/aria-selected/arrow-key nav. The masked password is still plaintext in the DOM behind a silently-firing clipboard link. Contrast risk: `.feature-chip[aria-pressed="false"]` is #ef4444 on a ~12% red tint with line-through at 0.78rem.

**Casey (Mobile)**: 11-column table forces panning to reach actions; no sticky first column. Header buttons wrap to multiple rows at the top (outside thumb zone). Touch targets for inputs/selects/chips stay ~30px.

## Minor Observations

- Mixed iconography: emoji bell/empty-state icons coexist with the SVG gear and text-glyph buttons — three icon languages.
- Settings show literal "(saved)" as an input value for the API key — placeholder-as-value.
- Clients table hard-codes `KES ` while the invoice table formats `${currency}` — will drift.
- `sortArrow()` prints `↕` in every unsorted header, adding scan noise.
- Confirm dialogs stay plain-text on muted backgrounds — no severity icon/strip (small polish gap).

## Questions to Consider

1. If Record Payment is the most consequential action this operator takes daily, why is it two clicks deep behind a row — and should the lead metric be "next payment date per tenant" rather than total revenue?
2. With 8 tabs and a row that shows Delete twice, is this really one dashboard, or several admin tools sharing a shell?
3. The payment-shortfall guard is the best-designed moment in the app — could the same "show the consequence before the click" pattern replace the five generic "Failed" toasts?
