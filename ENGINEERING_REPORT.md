# Gears & Glitch — Engineering Report

**Scope:** Storefront Studio, interactive hero, customer experience, security/reliability,
migration 0029, testing/accessibility/performance.
**Branch:** `main` · **Last commit:** `cdabd57` · **State:** verified, uncommitted working tree.

---

## A. Executive summary

Four increments landed this session, all verified locally against an isolated Postgres
(`:5544`) with production untouched:

| # | Increment | Files | Status |
|---|-----------|-------|--------|
| 1 | Prompt invoice-email delivery (fixes the one real test failure) | `server/notification-service.ts` | Verified |
| 2 | Per-template typography design systems | `frontend/layouts/dynamic-engine.tsx`, `frontend/lib/templates.ts` | Verified |
| 3 | Studio section-editing keyboard + a11y polish | `frontend/components/admin/StorefrontBuilder.tsx` | Verified |
| 4 | Studio load-failure surfacing + unsaved-draft guard | `StorefrontBuilder.tsx` | Verified |

**Verification:** root `tsc` exit 0 · frontend `tsc` exit 0 · full suite **641/641 pass**
(0 fail) · `next build` succeeds (30 routes). Nothing is committed or pushed.

Increment 4 fixes a genuine P1: a failed layout load was stored in an `error` state that is
only rendered when the layout list is empty, so it was silently swallowed while the toolbar
kept pointing at a layout whose config never loaded.

---

## B. Storefront Studio

**Templates.** The library ships real starter designs validated by
`frontend/lib/templates.ts` (`validateTemplate`) and `server/template-validate.ts`
(round-trips opaque config byte-for-byte; only checks `tokens` is an object and section
types are on the strict allowlist).

**Distinct design systems (new).** Templates previously differed only by palette/radius/
product-card/hero. Added validated typography tokens — `headingFont | bodyFont`
(`sans|serif|mono`), `headingWeight`, `headingCase` (`none|uppercase`), `headingTracking` —
emitted as scoped CSS custom properties from `DynamicLayoutStyles`. Backwards-safe: with no
typography tokens, zero new CSS is emitted and heading weights resolve to the prior `700`
via `var(--dy-heading-weight, 700)`. Font stacks are **self-hosted only** (no network/licence
dependency).

| Template | Heading | Body | Weight | Case | Tracking |
|----------|---------|------|--------|------|----------|
| tech-grid | sans | sans | 800 | none | -0.02 |
| minimal-luxe | serif | sans | 400 | none | 0.01 |
| bold-commerce | sans | sans | 900 | uppercase | 0.02 |
| everyday-store | sans | sans | 600 | none | — |

**Section editing.** The canvas is a visual drag-and-drop editor. Sections and the hero block
are now `role="group"`, `tabIndex={0}`, labelled, and select on Enter/Space — guarded with
`e.target !== e.currentTarget` so an embedded hero CTA keeps its own Enter key. Move controls
are disabled at list boundaries; decorative drag grips are `aria-hidden`; the inline editor has
an accessible name; focus outlines are visible (`.sb-section`, `.sb-palette-item`, bar buttons).

**Apply / revert / save safety.** Template apply pushes history so "Revert last apply" restores
the pre-apply draft. A failed layout load now surfaces on the always-rendered message channel
and clears the stale selection; a `beforeunload` guard warns only while the draft is dirty.

**Deliberately not done.** Rendering the real header/footer inside the preview — those come
from the active static layout module (`original`/`amazon`/`jumia`), not the dynamic engine, so
embedding them would misrepresent the engine's output.

---

## C. Interactive storefront hero

Source of truth `frontend/lib/hero-effects.ts`: `interactive` is a master switch over
spotlight/parallax/tilt, applied only via `allowPointer` (skipped on touch); `entrance` is
independent; intensities `subtle|balanced|expressive` map to `0.65|1|1.5`. The Dynamic Engine
has full parity, the Studio and admin expose the controls, and the effects sanitizer keeps
persisted config safe. (Committed in `758b55f`, `04e18fd`, `024bb95`.)

---

## D. Customer experience

Order lifecycle emails (paid/delivered invoices) are durable via the notification queue and now
send **immediately** instead of waiting up to a full 15s worker tick (see E). Notification
preferences default to email-on; `email_logs` rows are written regardless of SMTP state
(`sent`/`disabled`/`no_smtp`).

---

## E. Security & reliability

**Invoice-email latency fix.** Root cause proven by stash/re-run: `enqueueOrderInvoiceDelivery`
only persisted a queue row; the worker drains every 15s while the integration test polls 4s, so
invoices could sit queued. Fix: an immediate, lock-guarded, fire-and-forget
`drainNotificationQueueOnce()` after enqueue. Idempotency is preserved by the drain lock and
`unique(idempotencyKey)`, so no double-sends.

**Open security item.** `ACTION_ITEMS.md` flags a plaintext Neon connection string that was in
local `.env` — **rotate the password.**

---

## F. Migration 0029, testing, accessibility, performance

**Migration 0029** (`0029_normalize_layout_section_types.sql`) is applied at boot by
`server/db.ts` `runVersionedMigrations()` (ordered, per-transaction, tracked in
`schema_migrations`). Verified locally on a fresh DB. **Production verification is blocked** —
no `DATABASE_URL`/Render access. Safe procedure to run in the Render/Neon console:

```sql
-- read-only: confirm the runner recorded it, then confirm no layout still
-- carries the dead `categories` section type (this second query should return
-- 0 rows once 0029 has run; the migration is idempotent so a stray row means it
-- did not run, or a runtime write reintroduced the alias).
SELECT version, applied_at FROM schema_migrations WHERE version LIKE '0029%';

SELECT id, layout_key,
       jsonb_typeof(config->'sections')       AS config_sections,
       jsonb_typeof(draft_config->'sections') AS draft_sections
FROM storefront_layouts
WHERE config->'sections' @> '[{"type":"categories"}]'
   OR draft_config->'sections' @> '[{"type":"categories"}]';
```

**Testing.** Full suite 641/641 with the isolated embedded-Postgres recipe; non-DB subset
460/460. New guards this session: `tests/templates.test.ts` ("template design systems"),
`tests/studio-a11y.test.ts` (7), `tests/studio-safety.test.ts` (2). Integration suites truncate
core tables, so destructive DB tests must **only** run against an isolated disposable DB —
never the shared production Neon branch.

**Accessibility.** Studio canvas now keyboard-operable (section selection, palette/layout cards
accept Space, boundary-aware controls, labelled actions, focus-visible, decorative glyphs
hidden).

**Performance.** Backwards-safe token emission avoids new CSS for token-less layouts; no
`transition: all` regressions; the interactive hero writes pointer offsets as CSS custom
properties imperatively so hover motion never enters the React render path.

---

## Open items / next steps

1. **Commit + push** the four increments (2 new test files) — awaiting explicit go-ahead.
2. **Rotate the Neon password** flagged in `ACTION_ITEMS.md`.
3. **Verify migration 0029 on production** with the read-only query above.
