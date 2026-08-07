---
target: the POS page
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-08-07T06-36-50Z
slug: frontend-pages-pos-tsx
---
# Impeccable critique — POS (`frontend/pages/pos.tsx`)

**Method: dual-agent (A: ses_02514a604ffeFbyRRXOY1358YY · B: ses_0251e8f03ffer8F80xjiQWvkTE)** — Assessment A (design review) and Assessment B (detector + evidence) ran as two isolated sub-agents. Browser visualization was not available (no browser automation tool in this session), so Assessment B is CLI-only; the detector's HTML/browser engines never ran against the rendered POS.

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Status is one tiny line whose color logic is inverted ("Not found: …" renders green, pos.tsx:407); M-Pesa shows no in-flight/confirmed state |
| 2 | Match System / Real World | 3 | "Charge / Amount tendered / Change" are real till terms, but M-Pesa checkout lies ("Sale completed!" while STK is fire-and-forget, index.ts:1857) |
| 3 | User Control and Freedom | 2 | No undo, no clear-cart, no cancel-sale; "Change PIN" (pos.tsx:327) hard-locks the till on a misclick |
| 4 | Consistency and Standards | 2 | Two button systems (app-wide `RippleButton` vs hand-rolled inline buttons); POS ignores its own design tokens |
| 5 | Error Prevention | 1 | One-click Charge with no confirmation; server charges full price while till shows sale price; retry can double-charge |
| 6 | Recognition Rather Than Recall | 3 | Images + category rail help; out-of-stock cards look fully tappable but silently no-op (pos.tsx:124) |
| 7 | Flexibility and Efficiency of Use | 3 | Scanner autofocus/refocus loop is excellent (pos.tsx:138, 302); no hotkeys, no thermal print, no quantity presets |
| 8 | Aesthetic and Minimalist Design | 2 | Dense three-column grid inside a marketing header + animated marquee; 0.7rem stock text (pos.tsx:314) |
| 9 | Help Users Recognize, Diagnose, Recover from Errors | 2 | Plain-text validation with no field attribution; failed lookups colored green; no retry path for M-Pesa |
| 10 | Help and Documentation | 1 | Zero help/onboarding; placeholders are the only guidance; no training/scan hint |
| **Total** | | **20/40** | **Acceptable** |

---

## Design Specificity Verdict

**Weak — this is a generic three-column admin CRUD wearing storefront chrome, not an authored cashier surface.**

- **LLM assessment:** The till is wrapped in the full marketing storefront: `hideHeader` excludes `"pos"` (Layout.tsx:158), so cashiers operate under the storefront header, the animated Kenyan-holiday `MarqueeBanner` (Layout.tsx:373), and the footer. It doesn't use the product's own button component (`RippleButton` appears in 100+ admin call sites; pos.tsx hand-rolls inline-styled buttons, pos.tsx:307, 443). Every positioning value is hardcoded inline (pos.tsx:283-392) instead of the tokens in globals.css:9-68, so it cannot inherit theme/density/focus changes. A bakery could ship this page unchanged; nothing encodes "till", "money", or "speed".
- **Deterministic scan:** 0 findings (exit 0) — but this is a coverage gap, not a clean bill. `.tsx` routes to the detector's regex-only engine; the HTML cascade, page analyzers, and computed-contrast passes never run on TSX. No false positives were emitted because nothing was emitted. Contrast claims rest on manual markup review, not the detector.
- **Browser overlays:** not available — no browser automation in this session (fallback: CLI-only evidence).

---

## Overall Impression

The scanner-first search loop and end-to-end serial handling are genuinely well-built, and the server-side validation is deep. But the money-taking moment — the highest-stakes act on the floor — is the weakest part of the screen: displayed prices can differ from charged prices, M-Pesa declares success before payment is confirmed, a retry can create a second order, and the whole till sits inside a marketing page with a miscalculated shell height. The single biggest opportunity is to make the POS feel like a till — isolated from storefront chrome, with a hardened, confirmable, idempotent charge flow.

---

## What's Working

1. **Scanner-first search loop** — input autofocuses on mount and refocuses after every add (pos.tsx:138, 302); `handleScan` tries barcode then serial with feedback (pos.tsx:141-167). The correct Operate pattern, preserved in any redesign.
2. **Serial tracking end-to-end** — per-entry success/error in the modal (pos.tsx:467), product-mismatch and sold/void guards (pos.tsx:191-193, index.ts:1757-1761), removable serial chips with a "Scan serial number(s)" reminder (pos.tsx:335-344). Wrong serials are hard to add, easy to remove.
3. **Server-side defensiveness** — checkout validates item count, stock at branch/global, serial ownership/status, and insufficient tender (index.ts:1710-1774), and the client pre-checks the same before hitting the wire (pos.tsx:222-232). The guards exist; they're just presented badly.

---

## Priority Issues

### [P0] Displayed price ≠ charged price when a product is on sale
- **What:** POS prices the cart at `salePrice` (`effectivePrice`, pos.tsx:131, 179) and shows "Charge KES <sale total>" (pos.tsx:443); the server ignores `salePrice` — `lineTotal = product.price * qty` (index.ts:1775), and `order_items.price` stores full price (index.ts:1813). Verified.
- **Why it matters:** Till says "KES 40,000", order and receipt record "KES 45,000". Financial misstatement on every discounted item — compliance and dispute risk on the till.
- **Fix:** Resolve the effective price server-side exactly as the client does (`price = salePrice && salePrice > 0 ? salePrice : price`) in checkout and in the receipt/order-item rows; or stop applying sale price on the client. One source of truth for the charged amount.
- **Suggested command:** `harden`

### [P0] M-Pesa checkout declares success before payment is confirmed
- **What:** STK push is fire-and-forget — index.ts:1857-1870 "don't block checkout", catch only logs. The UI unconditionally shows "Sale completed!", clears the cart, and shows the order panel (pos.tsx:250-257) even if the push failed. Verified.
- **Why it matters:** The #1 "goods handed over, no money received" scenario in Kenyan POS. Cashier has no status, no retry, no pending state, no reconciliation path.
- **Fix:** Return STK state (success/pending/failed) from checkout; show a distinct "M-Pesa prompt sent — awaiting confirmation…" state that does NOT clear the cart or offer Print until confirmed, with Retry / switch-to-cash.
- **Suggested command:** `harden`

### [P1] One-click Charge with no confirmation and double-charge on retry
- **What:** Charge fires immediately (pos.tsx:443); the idempotency key is re-rolled inside every `checkout()` call (pos.tsx:235), so a retry after a server-committed-but-lost response creates a second order — the unique-index dedupe (index.ts:1712-1715, schema.sql:132) only works on a reused key. Verified.
- **Why it matters:** Double-charging a customer is the cashier's worst nightmare and it is a realistic failure mode on the money screen.
- **Fix:** Generate one idempotency key per cart (not per submit) and reuse it on retry; add a lightweight confirm showing total + method + change ("Confirm KES 45,000 / Cash / Change KES 500") before money moves.
- **Suggested command:** `harden`

### [P1] The till is embedded in the marketing storefront and its shell height is miscalculated
- **What:** `hideHeader` excludes `"pos"` (Layout.tsx:158) so header + marquee + footer render around the till; `.pos-shell` is `height: calc(100vh - var(--nav-height, 60px))` (globals.css:2176) but `--nav-height` is never defined (only `--header-height: 120px`, globals.css:67), and `#main` adds its own padding. Verified.
- **Why it matters:** Total chrome exceeds the viewport and the shell clips overflow — the Charge/Total block (pos.tsx:396-446) can sit below the fold exactly when the queue is longest.
- **Fix:** Add `"pos"` to `hideHeader`, give the till a full-height layout, and size the shell from the height it actually owns (`100dvh` minus real chrome).
- **Suggested command:** `layout`

### [P1] No thermal (80mm) receipt path in the UI
- **What:** The server ships a purpose-built thermal receipt as the default format (shared.ts:74-89, index.ts:2060-2090), but the only actions are "Save Invoice" (PDF) and "Print Invoice" with `format=a4` (pos.tsx:427-437).
- **Why it matters:** The thermal receipt is the artifact the customer walks away with; the UI is built for A4 invoices, not tills.
- **Fix:** Add a "Print Receipt" action targeting the thermal endpoint and default it, or auto-open the thermal view after checkout.
- **Suggested command:** `polish`

### [P2] Error/success color logic is inverted for half the messages
- **What:** `status` colors by prefix — only "Error/Insufficient/Enter" get red; everything else (including "Not found: …" and serial reminders) gets `var(--success)` green (pos.tsx:407).
- **Why it matters:** A failed lookup reads as success; color is the only differentiator, so cashiers stop trusting it.
- **Fix:** Return `{text, kind}` from one status helper and color on the kind, not string prefixes.
- **Suggested command:** `audit`

### [P2] Out-of-stock cards are clickable but dead
- **What:** `addToCart` returns early with no feedback when `stockOnHand <= 0` (pos.tsx:124) while the card renders fully interactive (pos.tsx:307) with red "Out of stock" text.
- **Why it matters:** Under queue pressure a cashier taps a dead card repeatedly.
- **Fix:** Render zero-stock cards `disabled` with reduced opacity and drop the click handler.
- **Suggested command:** `polish`

### [P2] Enter on a text search reports "Not found: <query>"
- **What:** The search box's Enter handler routes straight into `handleScan` (pos.tsx:302), which hits barcode/serial lookups and shows "Not found: HP Laptop" (pos.tsx:166).
- **Why it matters:** Text search and scanning are conflated; the most common action (typing a name, Enter) surfaces a false error.
- **Fix:** On Enter, check the filtered text results first; only scan-lookup when the query looks like a code.
- **Suggested command:** `clarify`

### [P2] Sale prices are rendered in danger red
- **What:** Sale price uses `var(--danger)` (pos.tsx:311, also product.tsx:277) — the same color as errors and out-of-stock on this surface.
- **Why it matters:** Semantic inversion: a good deal looks like a no-go at the till.
- **Fix:** Use `--primary` or a dedicated discount token for sale prices.
- **Suggested command:** `colorize`

### [P3] Serial modal is not an accessible dialog
- **What:** No `role="dialog"`/`aria-modal`, no Escape-to-close, no focus trap (pos.tsx:450-474); the customer dropdown (pos.tsx:372-379) is mouse-only; `− / + / ×` controls have no `aria-label` (pos.tsx:340, 350-358).
- **Why it matters:** Screen-reader and keyboard cashiers are stranded on the serial-entry path.
- **Fix:** Real dialog semantics + Escape + focus trap; label the quantity controls; keyboard support on the customer dropdown.
- **Suggested command:** `onboard`

---

## Persona Red Flags

**Alex (power-user cashier, ~200 scans/hour):**
- Storefront header + animated marquee + footer are constant noise inside the operating area (Layout.tsx:158, 373, 417).
- No hotkey for Charge or New Sale; the post-sale panel (pos.tsx:408-441) is mouse-only, breaking the scan-then-sell rhythm.
- No thermal print button (pos.tsx:427-437) — Alex cannot print the till receipt at all.
- Quantity is one-at-a-time `−/+` clicks (pos.tsx:356-358); a 10× sale is ten clicks with no direct entry.
- Enter-on-text-search misfires a lookup and prints a false "Not found" (pos.tsx:302, 166).
- Keeps: search autofocus + refocus (pos.tsx:138) and category persistence via sessionStorage (pos.tsx:79-80, 292).

**Sam (accessibility / assistive tech):**
- Status changes are color-coded plain text with no `role="status"`/live region (pos.tsx:407) — a screen reader never hears "Sale completed!" or "Insufficient amount."
- Serial modal lacks dialog semantics, Escape, and focus trapping (pos.tsx:450-474); `−/+`/`×` are unlabeled symbols (pos.tsx:340, 350-358).
- Customer dropdown (pos.tsx:372-379) is mouse-only (`onMouseDown` selection); category rail (pos.tsx:282-298) has no `aria-pressed` on the active category.
- Micro-contrast: 0.7rem stock text (pos.tsx:314), 0.72rem serial chips (pos.tsx:338), 0.8rem category labels (pos.tsx:285) — too small for a brightly lit shop floor.

**Riley (stress tester, Friday rush, flaky network):**
- Double-charge on retry: idempotency key regenerated per submit (pos.tsx:235), so server dedupe is useless.
- M-Pesa: "Sale completed!" with no STK confirmation and no retry (index.ts:1857-1870, pos.tsx:252) — goods can walk out unpaid.
- Price mismatch: till displays sale price, order records full price (pos.tsx:131 vs index.ts:1775).
- Charge button: one click, no confirm, no undo (pos.tsx:443).
- Offline = complete halt: the global OfflinePage overlay (animations.css:626-738) replaces the till with an animated gears screen; no queue/buffer mode for a till that should take cash even offline.
- On shorter viewports the Total/Charge block can be clipped by the miscalculated `.pos-shell` height (globals.css:2176).

---

## Minor Observations

- `Change PIN` (pos.tsx:327) sits inside the operating cart header; a misclick hard-locks the till (clears `posUnlocked` + PIN). Belongs in settings, not the money panel.
- Theme toggle is inline in the search row (pos.tsx:303) — a display preference taking operating space.
- The PIN is a `sessionStorage` value, skipped for any logged-in staff (pos.tsx:57-60, 77-78) — a ritual, not a control.
- Cart header says "Cart (N)" but there is no clear-cart action anywhere (pos.tsx:326).
- Receipt naming is inconsistent across the app: "Save Invoice"/"Print Invoice" (pos.tsx:427, 436) vs "Print Receipt"/"Save PDF" (shared.ts:128-139).
- eTIMS/control-code status is computed server-side (index.ts:1893-1906) but never surfaced to the cashier.
- No VAT breakdown on the till even though receipts print VAT at 16% — cashiers can't answer "how much is tax?".
- After a sale, the cart panel shows nothing (cart cleared) and the sold items vanish at the exact moment you'd want to verify them.

---

## Questions to Consider

- If the idempotency key were persisted per cart instead of per attempt (pos.tsx:235), would a single retry ever double-charge a customer — and why is that not already a release-blocker?
- The server prices every line at `product.price` while the till displays `salePrice` (index.ts:1775 vs pos.tsx:131): which number do you want the customer to actually pay — and does anyone currently know which one they paid?
- You ship a purpose-built thermal receipt (shared.ts:74) but no UI button that prints it — is the A4 path there because branches asked for it, or because nobody designed the till's end-of-sale moment?
- M-Pesa STK is fire-and-forget and the screen declares "Sale completed!" regardless: has any branch handed over goods on a failed push?
- The POS reuses the marketing site's header, marquee, and footer: if a cashier's browser scrolls the Charge button out of reach mid-sale, is that a layout bug, an architecture bug, or a product decision?
