# Feedback & Notification Redesign — Final Report (A–Z)

## A. Objective
Make every user-visible status message on Gears&Glitch flow through one canonical
feedback system: a new design language ("Till Orange", flat-at-rest, hairline
borders, keyboard accessible, reduced-motion safe), a StrictMode-safe provider,
and a single source of truth for toasts, progress, and persistent cards. Fix the
confirmed defects around customer delete (double notification / double DELETE)
and the notification bell (false-zero on outage, StrictMode double-poll), finish
the legacy `toast()` migration so no compatibility shim remains, purge the
double-escaped `escapeHtml` render paths repo-wide, verify the delete and
notification paths end-to-end in a real browser, and leave no push made.

## B. Outcome
All phases complete end-to-end. One customer delete produces exactly one
`DELETE` request and exactly one feedback card, proven in a real headless-browser
run against the live app (Postgres + backend + Next dev). Every legacy
`toast()`/`useToast()` call is gone from the frontend (0 remaining sites,
including all of `admin.tsx`), and the compatibility layer that used to bridge
them was deleted along with its provider hook. The `escapeHtml` double-escape was
removed across the whole frontend render surface with regression guards. The
browser QA also surfaced and fixed a real portal bug: signing in through
`/admin`'s own form when the account spans multiple branches minted a dead
session ("undefined" token) instead of showing the branch picker.

## C. Canonical API
`frontend/lib/feedbackCore.ts` defines the pure state model and transitions:
- Item kinds: `toast` (transient), `progress` (sticky until `dismiss`/`update`),
  `persistent` (sticky success/error/info with close).
- `dedupeKey` merging so the same operation cannot stack two cards.
- Tone-split live regions: `role="alert"` for error/warning, `role="status"`
  for success/info/progress → screen readers get one announcement channel.
- `STICKY_HARD_CAP = 8` bounds the sticky stack.
- Replacement / update semantics (`update`, `dismiss`, `progress` handles).

## D. FeedbackProvider
`frontend/components/feedback/FeedbackProvider.tsx`:
- StrictMode-safe timer arming (idempotent effect with ref-guarded timers).
- `feedback.success/error/info/warning/progress` + persistence helpers.
- Toast autodismiss with progress-aware timers; reduced-motion respects
  `prefers-reduced-motion`.
- New styles in `frontend/styles/feedback.css`; mounted once in `_app.tsx`.

## E. Compatibility layer — removed
The interim `legacyToast.ts` adapter (with its `__bindLegacySink` bridge in the
provider) and the `Toast.tsx` re-export shipped in the first milestone are
deleted. The `dashboard.tsx` dead `useToast` import went with them. The
`feedback-system.test.ts` adapter test was replaced by a repo-wide scan asserting
the frontend contains no `useToast()`/`toast(` and no adapter files — proof the
interim shim outlived its usefulness. There is now one feedback path and one
only.

## F. ConfirmDialog — StrictMode safety
`ConfirmDialog.tsx` moved the resolver promise out of the state updater
(`resolverRef`) and settles abandoned promises on unmount, so double-invocation
under `reactStrictMode` cannot strand or double-fire the delete path.

## G. CSRF self-heal retry
`server/index.ts` emits `code: "CSRF_TOKEN_INVALID"` on the CSRF rejection, and
`frontend/lib/api.ts` performs exactly one retry keyed on that code marker (no
string matching, no blind retry after side effects).

## H. Notification bell
`frontend/components/NotificationBell.tsx` rewritten:
- `BellState = "ok" | "unavailable" | "idle"` — backend failure is shown,
  never silently reported as zero.
- Exponential backoff `*2` capped at 60s; visibility-aware polling
  (`document.visibilityState`).
- `endpointRef` re-read each tick so role flips take effect without a reload.
- Last known count retained on failure (no false zero badge).
- `.bell-btn.bell-unavailable` warning tint in `globals.css`.
- In the admin portal the bell is a navigation control: it routes to the
  Messages view (verified in-browser).

## I. Delete-flow fix (root cause)
`AdminCustomers.handleDelete` previously kept the row's Delete button live for
the whole confirm dialog and only started the request after the promise
resolved — a second click could start a second identical `DELETE`. Now `deleting`
is set before the dialog, guarded for the dialog's lifetime, and one
`feedback.progress` handle is pushed through "Deleting customer" →
"Customer deleted".

## J. Migration scope — complete
- Originally 251 legacy `toast(` call sites across 22 frontend files (126 in
  `admin.tsx`). All are migrated to `useFeedback()` or the canonical
  `feedback.*` API, using the applied rules:
  1. success → always transient `feedback.success`, paired inline success
     removed;
  2. error while actively in a form with an inline message → inline kept, toast
     dropped;
  3. background error with no inline partner → transient `feedback.error`.
- Notable units finished this milestone: AdminStockTransfers, AdminPurchases
  (incl. Undo-action trash + download-PDF transient error), AdminReviews,
  AdminDeliveryFees (both toasts dropped, inline form status kept),
  ReportFinancing, AdminStoreInfo TOTP toggles, AdminSuppliers (missing provider
  hook added), AdminRepairs dead `@/components/Toast` import removed.
- Repo-wide greps confirm 0 `toast(`/`useToast(`/>`toast?.(` sites in the
  frontend.

## K. escapeHtml double-escape fix — whole repo
`escapeHtml(...)` was wrapping values React already HTML-escapes in render
positions, so names like `ACME & Sons` displayed as `ACME &amp; Sons`. An
AST-driven tool (`unwrap-escape-all.cjs`) unwrapped 152 render-position sites
across 23 files, plus 3 in `frontend/pages/stock-take/[id].tsx` (hidden from
shell globs by square brackets). Dead local `escapeHtml` duplicates were removed
from `cart.tsx`/`orders.tsx`, the `@/lib/sanitize` import was dropped from 9
storefront pages and 12 admin components, dead imports were trimmed in
`layouts/amazon.tsx`/`layouts/jumia.tsx`, and the `layouts/shared.ts` re-export
was removed (its only importers were dead).
Invariants now enforced by `tests/escape-html.test.ts` (7 tests): `escapeHtml(`
may exist only in the two definition files (`frontend/lib/sanitize.ts` — DOM
based; `frontend/components/admin/shared.tsx` — regex based), server-side
escaping is untouched, and the one raw frontend sink (`admin.tsx`
`w.document.write(html)` fed by the `const e = escapeHtml` alias) is preserved.
Last line of defense: the commit `ef4057b` had already fixed the admin table
paths; this milestone closed the storefront and remaining admin gaps.

## L. Verification run (post-final-pass)
- `frontend npx tsc --noEmit` → exit 0.
- root `npx tsc --noEmit` → exit 0.
- `frontend next build` → exit 0 (full route table; shared JS 147 kB).
- root `npm run build` (`tsc`) → exit 0.
- Full suite: `npx tsx --test --test-concurrency=1 tests/*.test.ts` with
  `DATABASE_URL=postgres://test@127.0.0.1:55432/gg_qa2`, `NODE_ENV=test` on a
  freshly reset DB → **535 tests, 98 suites, 0 failures** (baseline 499; +25
  feedback/bell tests, +7 escapeHtml tests, +4 portal branch-picker tests).

## M. Browser QA environment
Embedded PostgreSQL 18.4 on `127.0.0.1:55432`; DB `gg_qa2` reset to a known
state; backend `:8020`; `next dev -p 3000`. QA seed: admin `admin` /
`QaAdmin!2026`. The branch-access test data assigns the admin several branches,
so sign-in stops at the branch picker — the QA login flow now completes it and
selects branch `B1` (id 1), the classic shop context whose feature set includes
Messaging and Email Notifications. Rate limiter raised only in the QA launcher
env so repeated runs don't self-throttle.

## N. Browser QA methodology
`qa-delete-proof.cjs` (headless Chrome via puppeteer-core), sharing a
branch-aware login helper with `qa-bell-email.cjs`:
1. Seed one customer row directly in Postgres.
2. Instrument every `/api/*` request (method, path, status) and a
   `MutationObserver` over `.feedback-card` adds/removes.
3. Log in as admin through the real portal form at `http://localhost:3000/admin`;
   when the branch picker appears, select `B1` and let `select-branch` issue the
   real session cookie.
4. Deep-link to `?view=customers`, confirm the seeded row renders.
5. Click that row's Delete, wait for the confirm dialog, confirm via the
   dialog's own `.btn-danger` (scoped to the modal).
6. Wait for the row to leave the table (checked against `tr` only, since the
   success card legitimately contains the customer name).
7. Count `DELETE` requests and feedback-card events; exit 0 iff both are 1.

## O. Browser QA result — delete path (headless, real HTTP + Postgres)
```
seeded customer id=120
All DELETE network requests: [{ method: "DELETE", path: "/api/admin/customers/120", ts: ..., status: 200 }]
Row disappeared from list: true
Feedback events: [added] Deleting customer        (one card; updated in place to "Customer deleted")
Feedback cards in DOM: Customer deleted
Page errors: none
```

## P. Acceptance statement — delete
One delete operation produced exactly 1 `DELETE` request and exactly 1 feedback
event, in a real browser against the live stack.

## Q. Notes on observed 403s
A few `GET /api/repairs` 403s appear on admin load because the QA DB has the
"Repair ticketing" feature flag off — `requireShopFeature("Repair ticketing")`
rejects by design. They are feature-flag responses, not failures of the flows
under test.

## R. Portal sign-in branch-picker bug — found in this QA pass
The `/admin` page runs its *own* inline login (`handleLogin`), separate from
`/login`. The branch picker was only wired into `pages/login.tsx`, so a
multi-branch staff account signing in through the portal stored `data.token ===
"undefined"`, set `authed`, and rendered the entire admin shell against 401s
("Session expired"). Fixed in `frontend/pages/admin.tsx`:
- `handleLogin` branches on `data.requiresBranch`, holds the short-lived
  `branchSelectToken`, and renders `<BranchPicker>` inside the unauthenticated
  gate (with cancel returning to the form).
- `completeBranchSelection` POSTs to `/api/auth/select-branch` with the
  purpose-scoped token, then stores the real session and activates the portal.
- `tests/admin-branch-picker.test.ts` (4 guards) pins the contract: the
  `requiresBranch` guard precedes any token store, the picker renders in the
  unauthenticated gate, selection uses the bearer select token, and cancel
  returns to the login form.

## S. Browser QA result — bell & email (headless)
`qa-bell-email.cjs` after the same branch-aware login:
```
bell in admin header: {"text":"","badge":null}
bell routes to messages view: true "Messages"
email settings view: { hasHeading: true, saveButton: true, sendTest: true, ... }
Page errors: none
PASS
```
The bell renders (Messaging feature on) and routes to the Messages view; the
Email settings view loads with its Save and Send Test controls and no page
errors.

## T. Commit state (main, no push)
```
e9a2ef0 fix(admin): handle branch picker at portal sign-in and finish feedback migration
7d4342b fix(escape): stop double-escaped HTML across storefront render paths
742d60b refactor(feedback): finish admin migration, drop legacy toast compat layer
ef4057b fix(admin): stop double-escaping text in table render paths
006bd81 test(feedback): cover feedback core, provider plumbing, and notification bell
97e7fe4 fix(notifications): rewrite bell with backoff, visibility handling, and unavailable state
a721042 refactor(feedback): migrate storefront pages to useFeedback
9d7be0a refactor(feedback): migrate admin and customer dashboard toasts to useFeedback
3c45f56 fix(feedback): strict-mode-safe confirm dialog and CSRF self-heal retry
c699085 feat(feedback): add canonical feedback core, provider, and legacy-compat toast shim
```
Working tree has only this report untracked. Nothing pushed.

## U. Constraints honoured
- CSRF protection intact (rejection emits a stable `code`; retry is single and
  side-effect free).
- `reactStrictMode` left enabled; effects are now idempotent.
- Email (`server/gmail.ts`) untouched. WhatsApp changed wording only.
- Server-side `escapeHtml` escaping untouched; only frontend render-path
  double-escapes were removed.
- No secret committed; QA secrets live only in the temp launcher.

## V. How to reproduce the QA run
Requires `puppeteer-core` (repo dep), Chrome at the standard path, Postgres on
`127.0.0.1:55432`, a freshly reset DB, backend `:8020`, frontend `:3000`.
Scripts: `...\pgsql\qa-launch.cjs` (launcher; sets JWT_SECRET + raised rate cap),
`...\qa-delete-proof.cjs`, `...\qa-bell-email.cjs`, `...\clean-qa-customers.cjs`.
The QA login helper completes the branch picker and selects branch `B1`.

## W. Risks / follow-ups
1. Feature-gated admin views only resolve after the flag fetch completes; a hard
   navigation straight to `?view=<gated>` still lands on dashboard until flags
   load. Client-side navigation through the nav is unaffected. (Pre-existing,
   unchanged by this work.)
2. The full suite requires a clean DB and the QA servers stopped (the HTTP
   suites seed their own rows).
3. The QA branch-picker helper prefers branch id 1 by name; if the seed ever
   lacks `B1` it falls back to the first branch.

## X. Performance
`/admin` first-load JS ~118 kB route, 147 kB shared across all routes. No
regression from the feedback layer — the compat adapter is gone and all paths
flow through the single provider.

## Y. Accessibility
Live regions split by tone; persistent/sticky cards reachable and closable;
focus stays predictable (confirm dialog auto-focuses confirm). Bell state
communicates both visually and via `aria` labelling. The branch picker is a
labelled radiogroup with `aria-expanded` disclosure semantics in the nav.

## Z. Definition of done + sign-off
- [x] Canonical API + provider + UI
- [x] Confirm dialog StrictMode-safe
- [x] CSRF self-heal retry
- [x] Bell rewrite + regression tests
- [x] Every legacy toast site migrated; compat layer deleted (0 `toast(`/`useToast(`)
- [x] `escapeHtml` double-escape removed repo-wide + regression tests
- [x] Portal sign-in branch-picker bug fixed + regression tests
- [x] Exactly-once delete proven in browser; bell + email verified in browser
- [x] Typechecks, builds, 535-test suite green
- [x] Commits logically grouped on main; no push
All acceptance criteria met. Delivery appears as the ten commits in T; nothing
has been pushed.