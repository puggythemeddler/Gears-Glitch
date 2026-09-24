# PRODUCTION_READINESS_CURRENT.md

**Hardened current state of Gears&Glitch — verified 2026-09-24 (final hardening pass).**

This is the point-in-time "current" deliverable. Phase-0 audit findings live in `AUDIT_REPORT.md` /
`PRODUCTION_READINESS_AUDIT.md`; the living register is `PRODUCTION_READINESS_AUDIT_FULL.md`; the
migration source of truth is `DATABASE_MIGRATIONS.md`; the secrets model is `SECURITY_MODEL.md` §5.
Every claim below was re-verified against the working tree on this date (commands in the Verification
section). **No commit or push was made — the working tree is summarized at the end.**

---

## 1. Migration & schema runtime (final reconciliation — DONE)

- **Two boot mechanisms, one-source-of-truth, no schema mutation at boot:**
  - `server/schema.sql` — full cumulative canonical schema (fresh installs reach final state in one pass).
  - `server/db.ts` `runVersionedMigrations()` — transactional, fail-loud, per-file runner applying
    `0001` – `0020` over existing databases, recorded in `schema_migrations`.
  - The legacy boot-time `runMigrations()` (a ~750-line `try/catch` ALTER-DDL drift guard that silently
    mutated every database on every start) has been **removed**.
- **`0020_legacy_schema_reconciler.sql`** converges pre-0020 databases idempotently: 29 legacy columns,
  5 legacy tables (`splashes`, `email_logs`, `notification_log`, `storefront_layouts`,
  `branch_subscriptions`), 15 indexes, one-time guarded backfills/seeds (VAT snapshot, unit cost, sort
  orders, source reclassification, plan pricing/features, settings defaults, repair types, layout seeds,
  sequence alignment), and the remaining 7 money columns → `NUMERIC(12,2)`.
- **Money:** all money columns are `NUMERIC(12,2)` end-to-end; the `pg` parser in `server/db-helpers.ts`
  keeps them flowing to JS as numbers.
- **Boot seeds** are named, guard-based functions (`seedGroupsFromCategories`, `seedClientsRow`,
  `curatePlanFeatures`, `initRolesAsync`) — no schema-writing DDL at boot.
- **Current applied head: `0020`.**

## 2. Control plane (CP) — security hardening shipped

- **CORS:** permissive `cors({ origin: true, credentials: true })` replaced with `corsPolicyMiddleware`
  (`control-plane/server/cors-policy.ts`): same-origin allowed; extra origins must appear in the
  new `ALLOWED_ORIGINS` CP env allowlist (comma-separated, matched as normalized `host[:port]`);
  fail-closed on unparseable config; preflight permission headers only when allowed.
- **Auth:** `requireAuth` re-reads the admin row from the DB on every request
  (`SELECT id, username, role FROM cp_users WHERE id = $1`); sessions die the moment a user is deleted;
  privilege changes (role demotion) take effect on the next request; JWT-embedded role is never trusted.
- **Plan sync-up** (`POST /api/plans/sync-up`) is gated to `authVia === "cp-key"` (tenant-originated
  updates) — a browser session cannot push plan changes.
- **2FA setup** now requires the current `CP_ADMIN_PASSWORD` (400 missing / 401 wrong / 200 success);
  the `totp_secret` is rotated only on success.
- **Audit trail:** all 19 `auditLog(...)` call sites are awaited (no fire-and-forget tail risk); 3 missing
  audits added (`approve_upgrade_request` / `reject_upgrade_request`, `mark_invoice_paid`,
  `generate_invoice`).
- **Runtime:** `start()` is exported (`start(opts?: { background?: boolean })`), background jobs
  (auto-import plans/cloudinary, startup health check, auto-backup) are opt-out and auto-run only when
  `require.main === module`; `app` exported for tests.
- **Secrets at rest (evaluated + documented, remediation QUEUED):** `clients.cp_secret`,
  `smtp_config.pass`, `cloudinary_config.api_secret` are **plaintext** in the CP DB (P1). Verified
  positives: `cp_users.password_hash` is bcrypt(cost 12); `/api/clients*` strip `cp_secret`; app backups
  dump tenant DBs only (never the CP DB). Queued fix (non-breaking, coordinated): deterministic
  AES-256-GCM via a dedicated `CP_SECRETS_KEY` env + `cp_secret_lookup` column + dual-read transition +
  per-secret rotation through Push Secret. See `SECURITY_MODEL.md` §5 and `ACTION_ITEMS.md`.

## 3. Tenant server — security hardening shipped

- **Query-token auth is GET-only** (`server/auth.ts` `getBearerToken`): the opt-in
  `?allowQueryToken=1&token=…` path used by new-tab receipt/invoice print links is rejected on POST/PUT/
  PATCH/DELETE; header and httpOnly cookie remain the preferred channels. Regression test added.
- Prior phases (unchanged this pass, verified green): session JWT in httpOnly cookie, CSRF double-submit,
  RBAC `requirePermission` on 143 routes, M-Pesa production gate + duplicate-callback guards,
  storefront stock integrity under concurrency, `01` sequential order numbers with unique index,
  invoice-number sequence, control-plane-key path acting as tenant admin (documented trust boundary,
  see `SECURITY_MODEL.md` §4/§5).

## 4. Verification (re-run on 2026-09-24)

| Suite | Result |
| --- | --- |
| Tenant unit tests (`server/`, root `npm test`) | **137 passed / 0 failed** (31 suites) |
| Control plane unit tests (`control-plane/`) | **59 passed / 0 failed** (14 suites, incl. cors-policy + auth) |
| Root typecheck (`npx tsc --noEmit` in `server/`) | pass |
| Control plane typecheck + build | pass |
| Tenant `npm run build` | pass |
| Frontend (`frontend/`) | no test script; `npm run typecheck` has **2 pre-existing committed-baseline errors** (`IntegrationsSettings.tsx:70` `confirmText`, `pages/admin.tsx:679` view-setter type) — files untouched in this pass, flagged as a baseline known |

- **DB-gated suites skip locally and run only in CI** (no local Postgres): `tests/legacy-reconciler.integration.test.ts`
  (needs `DATABASE_URL`), `tests/storefront-stock.integration.test.ts` (needs `DATABASE_URL`),
  `control-plane/tests/cp-auth-gated.test.ts` (needs `CONTROL_PLANE_DATABASE_URL`).
- Live external services (M-Pesa, Gmail, WhatsApp, CP provisioning) cannot be exercised locally.

## 5. Open knowns (unchanged, tracked)

- **P1** Control-plane secrets at rest — queued remediation (see §2 / `ACTION_ITEMS.md`).
- **P0/pass-gate** M-Pesa `SIM`-prefixed `checkoutRequestId` auto-confirm must stay production-gated.
- **P1** CP lacks rate limiting; control-plane `trust proxy` / SSL-CA verify items in the register.
- **P1** `/api/whatsapp/media/:id` unauthenticated (PII) — register.
- Full disposition matrix: `PRODUCTION_READINESS_AUDIT_FULL.md` (A–G addenda).

## 6. Working tree (uncommitted by instruction)

- Modified: `server/{db,index,mpesa,auth,schema}.sql|ts`, `tests/{mpesa,query-token}.test.ts`,
  `DATABASE_MIGRATIONS.md`, `SECURITY_MODEL.md`, `README.md`, `ACTION_ITEMS.md`,
  `PRODUCTION_SCORECARD.md`, `PRODUCTION_READINESS_AUDIT.md`, `PRODUCTION_READINESS_AUDIT_FULL.md`,
  `REPORTING_IMPLEMENTATION.md`, `control-plane/server/index.ts`.
- Untracked (new): `server/migrations/0020_legacy_schema_reconciler.sql`,
  `tests/legacy-reconciler.integration.test.ts`, `tests/storefront-stock.integration.test.ts`,
  `control-plane/server/cors-policy.ts`, `control-plane/tests/cors-policy.test.ts`,
  `control-plane/tests/cp-auth-gated.test.ts`.
- Updates to five Phase-0 docs (G1/G2) and `PRODUCTION_READINESS_CURRENT.md` are reconciliation-doc-only.