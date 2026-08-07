---
target: the POS page
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-07T08-23-15Z
slug: frontend-pages-pos-tsx
---
# Impeccable critique — POS (`frontend/pages/pos.tsx`)

**Method: dual-agent (A: ses_024b28c6effe9nhHedhlOzP2JV · B: ses_024b27fc9ffe6WtyMnMZh5tS0F)** — Assessment A (design review) and Assessment B (detector + evidence) ran as two isolated sub-agents. Browser visualization was not available (no browser automation tool in this session), so Assessment B is CLI-only; the detector's HTML cascade, page analyzers, and computed-contrast passes never run on TSX (regex-only engine).

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Pending box + status line exist, but M-Pesa shows no elapsed time / auto-poll; "Sale completed!" appears only after manual verify (pos.tsx:523) |
| 2 | Match System / Real World | 3 | Correct till terms, but "Payment confirmed" makes the cashier assert what the system must verify; "Change PIN" doesn't change a PIN (pos.tsx:438, 523) |
| 3 | User Control and Freedom | 2 | No cancel/void of a pending sale; pending freezes the whole till; no clear-cart (pos.tsx:403, 519-527) |
| 4 | Consistency and Standards | 2 | ~60 hand-rolled inline styles sit next to the app-wide `.btn`/`RippleButton` system; header removal leaves no till-local exit to the dashboard |
| 5 | Error Prevention | 3 | Confirm dialog + idempotency + validation are strong; serial validation is dead code (pos.tsx:244-247); idempotent replay silently returns change: 0 |
| 6 | Recognition Rather Than Recall | 3 | Prices/change computed and shown; cashier must recall order#/phone during pending; no recent-sales list |
| 7 | Flexibility and Efficiency of Use | 2 | Scanner autofocus/refocus loop is excellent; no charge-on-Enter, no quantity syntax, no quick-tender buttons |
| 8 | Aesthetic and Minimalist Design | 2 | Dense small type (0.7rem), four stacked receipt CTAs, theme toggle + till-lock clutter an Operate surface |
| 9 | Help Users Recognize, Diagnose, Recover from Errors | 3 | Messages are specific; recovery is manual (retry/switch) with no guidance on stock implications |
| 10 | Help and Documentation | 1 | No help, no input labels, no first-run hints, no shortcut legend |
| **Total** | | **24/40** | **Acceptable** |

---

## Design Specificity Verdict

**Structurally till-specific; visually category-interchangeable.** The IA is authored for a cashier: a three-region shell (category rail / product grid / cart+charge), barcode-first search, serial-scan modal, sale-price charging, an M-Pesa pending state, and a full-viewport header-free Operate surface (Layout.tsx:158-164). That composition would not work as a generic admin page — the "embedded in marketing chrome" P1 from the last critique is genuinely fixed.

But the finish is still the storefront admin skin, not a money machine: Sora at 0.7rem stock labels (pos.tsx:417), 0.82rem category buttons (pos.tsx:386), generic `.panel`/`.btn`/`.input` reuse, and the brand theme recoloring `--primary`. Nothing signals "till" — no large tabular numerals, no touch-scale targets, no rapid-transaction chrome.

- **Deterministic scan:** 0 findings (exit 0) on both `pos.tsx` and `marketing.tsx` — but this is a coverage gap, not a clean bill. `.tsx` routes to the detector's regex-only engine; the HTML cascade, page analyzers (`checkPageLayout`/`checkPageTypography`), computed-contrast pass, and even the PAGE_ANALYZER rule set never run on TSX. Contrast claims rest on manual markup review, not the detector.
- **Browser overlays:** not available — no browser automation in this session (fallback: CLI-only evidence).

---

## Overall Impression

The money-taking moment is now defensible: sale price is charged consistently client↔server, M-Pesa waits on a server-verified `paid && mpesa_receipt` gate, idempotency is wired end-to-end, and the till owns the viewport. The remaining P0s are the *failure* side of that same coin — an M-Pesa failure commits stock and marks the order delivered with no cancel/void escape, and an idempotent replay drops the tendered amount so change reads KSh 0. The single biggest opportunity is the pending-sale escape hatch: give a stuck cashier a way out that reconciles stock, and let the receipt record how the sale was actually paid.

---

## What's Working

1. **Idempotency wired end-to-end** — the client generates and reuses a key across retries (pos.tsx:311-314) and the server returns the existing order instead of re-creating (server/index.ts:1730-1744). The double-charge P1 is fixed.
2. **M-Pesa is real, not theatrical** — pending requires a server-verified `paid && mpesa_receipt` gate (pos.tsx:322-334; server/index.ts:1908-1913); the cart is locked against edits/additions during pending (pos.tsx:403, 410, 467, 469). The fake-complete P0 is fixed.
3. **Sale-price charging is consistent client↔server** — `salePrice > 0 ? salePrice : price` on both sides (pos.tsx:146; server/index.ts:1803). The price-mismatch P0 holds.
4. **True Operate-mode shell** — header/footer stripped (Layout.tsx:158-164), `height:100dvh` three-region till (globals.css:2174-2225), print-tab auth via scoped query token (server/auth.ts:66).

---

## Priority Issues

### [P0] M-Pesa failure commits stock and marks the order "delivered" before payment — and there is no cancel/void escape
- **What:** checkout deducts stock (server/index.ts:1850-1881) and calls `updateOrderStatus(orderId, "delivered")` (server/index.ts:1882) for *all* methods, then pushes STK. If the push fails or the customer never pays, the order reads delivered, stock is gone, and the frontend sits in `mpesaPending` with only retry/confirm/switch-to-cash (pos.tsx:519-527) while the whole till is frozen (search/grid disabled, pos.tsx:403, 410).
- **Why it matters:** unpaid orders consume inventory and read as complete; a stuck cashier cannot serve other customers; there is no void that reclaims stock.
- **Fix:** for M-Pesa, hold the order in a pending/unpaid state and only deduct stock on payment-confirm — or at minimum add a "Cancel pending sale / Void" action that releases the lock and reverses stock.
- **Suggested command:** `harden`

### [P0] Idempotent replay returns `change: 0` and drops the tendered amount
- **What:** on a lost-response retry, the server's idempotent branch returns `{ order: dup, change: 0 }` (server/index.ts:1735-1741); the tendered amount is never persisted to the order.
- **Why it matters:** under flaky network on a real till, a cash sale where the customer overpaid shows "Change: KSh 0" (pos.tsx:531) — the cashier mis-handles cash.
- **Fix:** persist `tendered_amount` on the order and recompute `change` on idempotent replay.
- **Suggested command:** `harden`

### [P1] "Payment confirmed" asks the cashier to assert what the system must verify; no auto-poll; the simulated M-Pesa branch can never complete
- **What:** the button label (pos.tsx:523) precedes the check; payment-status only reads the DB (server/index.ts:1908-1913), never calling the existing `queryStatus` (server/mpesa.ts:132) to reconcile with Safaricom; when M-Pesa is unconfigured, `stkPush` returns a simulated `SIM…` id (server/mpesa.ts:89-104) and no callback ever arrives, so `paid` is forever false.
- **Why it matters:** premature clicks and permanently-unresolvable pending states in demo mode erode trust at the exact high-stakes moment.
- **Fix:** relabel to "Check payment status", auto-poll every ~5s for ~90s, wire `queryStatus` as a fallback, and treat simulated receipts (callbacks matching `SIM*`) as paid.
- **Suggested command:** `harden`

### [P1] Receipts omit payment method, tendered, and change; the A4 receipt hardcodes "Payment via M-Pesa"
- **What:** the thermal receipt (server/index.ts:2105-2134) has no paid/change/tender/method lines; A4 prints "Payment via M-Pesa" unconditionally for eTIMS orders (server/index.ts:2085).
- **Why it matters:** a till receipt is the cashier's audit artifact — cashiers and later audits cannot verify a cash/M-Pesa settlement from the printed record; the wrong payment method on a tax invoice is a compliance error.
- **Fix:** pass `payment_method`, `tendered`, `change`, and `mpesa_receipt` into the receipt templates.
- **Suggested command:** `polish`

### [P2] The till never sends `branchId`, so branch-scoped stock and plan enforcement silently no-op
- **What:** the checkout body omits `branchId` (pos.tsx:271-279) though the server supports branch stock and branch-plan checks (server/index.ts:1749-1802, 1855-1875).
- **Why it matters:** a multi-branch claim without per-branch stock enforcement at the till means over-selling across branches.
- **Fix:** derive the cashier's branch from session/token and send it.
- **Suggested command:** `harden`

### [P2] Accessibility debt on the till's most-repeated controls
- **What:** unlabelled search, customer, tendered, and M-Pesa phone inputs (pos.tsx:403, 481, 497, 501); no focus trap in the serial dialog (pos.tsx:579-612); 0.7rem low-contrast stock text (pos.tsx:417).
- **Why it matters:** Sam operates a money surface blind — a wrong product or amount is a hard failure.
- **Fix:** visible labels or aria-labels, trap/restore focus in the modal, raise stock-label size/contrast.
- **Suggested command:** `audit`

### [P3] "Change PIN" is actually "Lock till", placed in the cart header with no confirmation
- **What:** clicking it drops `pinUnlocked` (pos.tsx:438) mid-sale; the copy promises PIN management that doesn't exist.
- **Why it matters:** an accidental tap at high frequency kills the session and freezes the till.
- **Fix:** relabel "Lock till", move it out of the cart header, and confirm before locking.
- **Suggested command:** `clarify`

---

## Persona Red Flags

**Alex (power-user cashier, ~200 scans/hour):**
- No charge-on-Enter (tendered input at pos.tsx:497 does nothing on Enter); no "3x barcode" quantity syntax; no quick-tender (exact / 500 / 1000).
- Scan adds and refocuses well (pos.tsx:152-153), but every sale is still ≥5 pointer/keyboard actions plus a dialog.
- Four stacked receipt CTAs plus a stale status line after each sale (pos.tsx:543-572) break the scan-then-sell rhythm.

**Sam (accessibility / assistive tech):**
- Search has no label (pos.tsx:403); grid buttons announce the product name twice (img `alt` + text, pos.tsx:411-412).
- Serial dialog has `role=dialog` + labelledby (pos.tsx:581-583) but no focus trap and no `aria-describedby`.
- `--muted` struck price at 0.85em fails contrast; 0.7rem stock labels are too small for a shop floor.
- Out-of-stock buttons are `disabled`, so they vanish from the screen-reader tree entirely — no reason given.

**Riley (stress tester, Friday rush, flaky network):**
- The entire till is one fetch failure from freezing (OfflinePage overlay, _app.tsx:104); no queue/buffer mode for cash.
- Idempotent replay drops change (P0 above).
- M-Pesa pending has no auto-reconcile and, in simulation, can never resolve; no void to escape a stuck pending order.

**Jordan (first-timer):**
- No labels on the five payment-panel inputs; the "Change PIN" affordance is a red herring; pending-state exit routes (confirm/retry/switch-to-cash) come with no explanation of consequences.

---

## Minor Observations

- pos.tsx:10 hardcodes KES + `maximumFractionDigits: 0`, ignoring `setFormatConfig` (frontend/layouts/shared.ts:16-29) — a non-KES store shows the wrong currency on the till.
- pos.tsx:244-247 `validateCheckout` serial check is dead code (serial quantity always equals serials length).
- pos.tsx:359-361 idempotency key resets only when the cart empties — a crash mid-pending could resurrect the key; harmless but fragile.
- `window.open(..., "_blank")` with a JWT in the query string (pos.tsx:553, 562) — same-origin so low risk, but tokens persist in browser history; consider short-lived print tokens.
- Out-of-stock items stay in the grid (dimmed, pos.tsx:410) — they burn grid slots that live items need.
- Theme toggle (pos.tsx:404) is wasted prime real estate on a till; it belongs in settings.
- "Cart (N)" counts line items, not units (pos.tsx:437) — misleading with qty steppers.
- Live filtering re-runs and resets to page 1 on every keystroke (pos.tsx:108-116) — a barcode scanner types ~12 chars, so the grid flashes 12× per scan.
- Steppers don't cap at stock client-side (pos.tsx:467-469) — the cashier discovers over-sell only as a post-charge error.
- The change line renders only when > 0 (pos.tsx:531) — an exact-tender cash sale shows no "Paid KSh X" confirmation at all.

---

## Questions to Consider

- When a customer walks away from an unpaid M-Pesa pending sale, is there *any* void/refund/stock-reversal path in the product, or is that stock and an order permanently committed as "delivered"?
- The till never sends `branchId` — is per-branch stock enforcement meant to exist on the till, or is "multi-branch" currently only a reporting feature?
- "Payment confirmed" — is the intended mental model that the cashier asserts payment (dangerous) or that the system verifies it (rename + auto-poll needed)?
- If the print tab authenticates via a long-lived staff JWT in the URL (pos.tsx:553, 562), what is the blast radius of a till left open on the receipt screen?
- In demo/unconfigured mode the M-Pesa flow can never complete — should the UI detect the simulated branch and auto-confirm, or hide M-Pesa until it's configured?
