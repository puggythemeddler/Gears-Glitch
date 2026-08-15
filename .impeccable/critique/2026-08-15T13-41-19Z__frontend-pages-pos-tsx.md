---
target: the POS page
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
timestamp: 2026-08-15T13-41-19Z
slug: frontend-pages-pos-tsx
---
# Impeccable critique — POS (`frontend/pages/pos.tsx`)

⚠️ DEGRADED: single-context (Assessment A sub-agent returned empty; design review run inline from source. Assessment B sub-agent completed.)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No elapsed timer during M-Pesa pending; 5s poll is invisible |
| 2 | Match System / Real World | 3 | Till language natural; receipt options clear |
| 3 | User Control and Freedom | 3 | Cancel/lock/New Sale exist; no clear-cart shortcut, no post-sale void |
| 4 | Consistency and Standards | 3 | Design-system classes used; ~60 inline style blocks coexist |
| 5 | Error Prevention | 4 | Confirm dialog, idempotency, stock hold, validation — excellent |
| 6 | Recognition Rather Than Recall | 3 | Products/cart visible; no recent-sales list without leaving |
| 7 | Flexibility and Efficiency | 3 | Scanner autofocus loop excellent; no charge-on-Enter, no quick-tender |
| 8 | Aesthetic and Minimalist Design | 3 | Clean till shell; 4 receipt CTAs + 0.75rem labels slightly dense |
| 9 | Error Recovery | 3 | Specific messages + recovery actions; no stock-implication guidance |
| 10 | Help and Documentation | 2 | No help, no shortcut legend, no visible input labels |
| **Total** | | **30/40** | **Good** |

## Priority Issues

[P2] No charge-on-Enter — tendered input does nothing on Enter; cashier must tab/click to Charge. Fix: wire Enter to trigger requestCheckout(). Suggested: harden

[P2] Four stacked receipt CTAs clutter post-sale moment. Fix: make New Sale primary, group receipt options behind one button. Suggested: distill

[P2] 0.75rem stock labels too small for shop floor. Fix: raise to var(--text-sm). Suggested: typeset

[P3] No visible input labels — aria-labels exist but invisible to sighted cashiers. Suggested: clarify

[P3] No help or shortcut legend on the till. Suggested: onboard
