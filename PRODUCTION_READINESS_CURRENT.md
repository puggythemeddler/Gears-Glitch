# PRODUCTION_READINESS_CURRENT.md

**Hardened current state of Gears&Glitch — verified 2026-09-24 (final cleanup & security QA pass).**

This is the point-in-time "current" deliverable. Phase-0 audit findings live in `AUDIT_REPORT.md` /
`PRODUCTION_READINESS_AUDIT.md`; the living register is `PRODUCTION_READINESS_AUDIT_FULL.md`; the
migration source of truth is `DATABASE_MIGRATIONS.md`; the secrets model is `SECURITY_MODEL.md` §5.
Every claim below was re-verified against the working tree on this date (commands in the Verification
section). **No commit or push was made in either pass — the working tree is summarized at the end.**

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
- **Secrets at rest — IMPLEMENTED (P1 resolved):** `clients.cp_secret`, `clients.neon_db_url`,
  `cp_users.api_key`, `cp_users.totp_secret`, `smtp_config.pass`, and `cloudinary_config.api_secret` are
  encrypted as deterministic `enc:v1:` AES-256-GCM (`control-plane/server/cp-secrets.ts`) whenever a key
  is configured — `CP_SECRETS_KEY`, else the already-required `JWT_SECRET` (≥16 chars) as fallback, so
  existing installs get encryption with zero config change. Legacy plaintext rows keep working via
  dual-branch `col = $1 OR col = enc($1)` lookups (no schema change); outbound headers are always
  plaintext (single `cpHeaders()` choke point); failures are loud, never forwarded as ciphertext.
  Verified positives: `cp_users.password_hash` stays bcrypt(cost 12); `/api/clients*` strip secrets;
  app backups dump tenant DBs only (never the CP DB). Tests: `cp-secrets.test.ts` (13) + DB-gated
  encrypted-row/outbound cases in `cp-auth-gated.test.ts`. See `SECURITY_MODEL.md` §5.
- **Rate limiting (present since `c1a8a9f`, docs claim was stale):** CP `authLimiter` (20 req/15 min on
  login + 2FA) and `destructiveLimiter` (30 req/15 min on provisioning/destructive routes) at
  `control-plane/server/index.ts`.

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
| Control plane unit tests (`control-plane/`) | **72 passed / 0 failed** (15 suites, incl. 13 new `cp-secrets`) |
| Root typecheck (`npx tsc --noEmit` in `server/`) | pass |
| Control plane typecheck + build | pass |
| Tenant `npm run build` | pass |
| Frontend (`frontend/`) | no test script; `npm run typecheck` has **2 pre-existing committed-baseline errors** (`IntegrationsSettings.tsx:70` `confirmText`, `pages/admin.tsx:679` view-setter type) |

- **DB-gated suites skip locally and run only in CI** (no local Postgres): `tests/legacy-reconciler.integration.test.ts`
  (needs `DATABASE_URL`), `tests/storefront-stock.integration.test.ts` (needs `DATABASE_URL`),
  `control-plane/tests/cp-auth-gated.test.ts` (needs `CONTROL_PLANE_DATABASE_URL`). The CP DB-gated suite now
  also covers the encryption-at-rest lookups/outbound from this pass.
- **Live external services** (M-Pesa, Gmail, WhatsApp, CP provisioning, pg_dump/psql client binaries) cannot be
  exercised locally — validated via CI (`ci.yml` runs Postgres 17 service containers) and code review.

## 5. Open knowns (accurate as of this pass)

- **Operator action:** set `CP_SECRETS_KEY` (≥16 chars) on the CP Render service (or accept the
  `JWT_SECRET` fallback); re-enter previously-written secrets via the UI if you switch sources later.
- **P0/pass-gate** M-Pesa `SIM`-prefixed `checkoutRequestId` auto-confirm must stay production-gated.
- **Frontend baseline:** the 2 committed typecheck errors are genuine defects (wrong `ConfirmOptions`
  prop + view-setter type) — filed for the §5 fix in this pass.
- **Restore procedure** is documented but not DR-verified (no `pg_dump`/`psql` locally; a restore dry-run
  in CI/manual is the operator action).
- **0020 exception handlers** under review this pass (§3) — report pending.
- Full disposition matrix: `PRODUCTION_READINESS_AUDIT_FULL.md` (A–G addenda).

## 6. Working tree (uncommitted by instruction)

- Modified this pass: `control-plane/server/{index,db,provision}.ts`, `control-plane/server/cp-secrets.ts`,
  `control-plane/tests/{cp-secrets,cp-auth-gated}.test.ts`, `control-plane/README.md`,
  `control-plane/.env.example`, `ACTION_ITEMS.md`, `SECURITY_MODEL.md`, `PRODUCTION_READINESS_CURRENT.md`.
- Prior pass (committed + pushed at `69a448c`): query-token GET-only gate, migration/docs reconciliation.