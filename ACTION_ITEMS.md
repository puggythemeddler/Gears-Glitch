# Action Items

Current action points for the project, by priority. Copy into GitHub Issues or a project board with `major` / `medium` / `low` labels.

> **STATUS (updated 2026-09-24):** items below predate the Phase 1–3 production-readiness remediation — see `PRODUCTION_READINESS_AUDIT_FULL.md` for the live register and `PRODUCTION_READINESS_CURRENT.md` for today's state. Duplicate-risk: anything here about migrating to "formal SQL migrations" is done (final reconciliation: `schema.sql` + versioned runner `0001`–`0020`, legacy boot-time `runMigrations()` **removed**, `0020_legacy_schema_reconciler` converges existing DBs), CSRF/CSP is [x]-checked, and the Cloudinary/Neon/env tasks remain the operator-action items. Control-plane secrets-at-rest encryption is now **implemented** (P1 resolved — see below, replaced by an operator env-set action).

## Major — operator action required

These require access to external dashboards (Neon, Cloudinary, Render, Vercel). See `DEPLOY_CHECKLIST.md` for the step-by-step env vars and rotation values.

- [ ] **Rotate the Neon database password** — the plaintext connection string is in your local `.env`. Reset the password in the Neon console and update `DATABASE_URL` on Render + local `.env`.
- [ ] **Regenerate the Cloudinary API secret** — it was exposed publicly via `GET /api/cloudinary-config` until the recent lockdown deploy. Regenerate in Cloudinary → Settings → API Keys, then update `CLOUDINARY_API_SECRET` on Render and re-pull via the control plane (or use **Sync Cloudinary**).
- [ ] **Set `NEXT_PUBLIC_MARKETING_ENABLED=true`** on your main Vercel project so `/marketing` renders the full landing page. Client deployments created via the control plane don't set this and get a "not available" page.
- [ ] **Push control-plane secrets to existing clients** — deploy the control plane (latest `main`), then for each existing client row click **Push Secret**. This injects `CONTROL_PLANE_SECRET` into the client's Render service and stores it on the client row, enabling remote management.
- [ ] **Set `CONTROL_PLANE_SECRET` on your own store's Render service** and register the same value in the control plane if you want the CP to manage your store too.
- [ ] **Change the control-plane default password** — set `CP_ADMIN_PASSWORD` in the control-plane Render env, redeploy, log in, then click the **2FA Off** badge → Set Up 2FA → scan QR → enable.
- [ ] **Set store names on existing clients** — clients provisioned before the `STORE_NAME` fix are seeded with the "Gear&Glitch" default, so their browser tab title and og tags show the wrong brand. Each such client should set its name once in **Admin → Settings → Store Info** (or set `STORE_NAME` on its Render service + redeploy). New clients are handled automatically by provisioning.

- [ ] **Set `CP_SECRETS_KEY` on the control-plane Render service (operator action; resolves the secrets-at-rest P1)** — encryption-at-rest is now **implemented** (`control-plane/server/cp-secrets.ts`): `clients.cp_secret`, `clients.neon_db_url`, `cp_users.api_key`, `cp_users.totp_secret`, `smtp_config.pass`, and `cloudinary_config.api_secret` are stored as deterministic `enc:v1:` AES-256-GCM whenever a key is configured. On deployment the CP auto-falls back to `JWT_SECRET` (≥16 chars) so existing installs get encryption with no config change; because a later switch to `CP_SECRETS_KEY` would make `JWT_SECRET`-encrypted values fail loudly (they must be re-entered through the UI), set `CP_SECRETS_KEY` **before** writing any secrets, or accept the fallback. (Language note: the old remediation plan's `cp_secret_lookup` column + rotation was superseded by a **dual-branch `col = $1 OR col = enc($1)`** lookup with no schema change.) See `SECURITY_MODEL.md` §5.

## Medium

- ~~Regenerate Cloudinary API secret (was shared publicly) and update the env var in Render.~~ — the endpoint that leaked it (`GET /api/cloudinary-config`) is now locked behind `CONTROL_PLANE_SECRET`, but the secret itself still needs rotating (see Major above).
- [x] Verify owner branch visibility and admin branch/subscription management:
  - owner can see all assigned branches (`OwnerShopSubscription` loads `/api/admin/branches` and shows the Branch Plans table)
  - admin can manage branches and subscription limits (`AdminBranches` create/edit/delete/toggle + per-branch plan change)
- [x] Ensure storefront layout controls remain admin-only in the staff portal (the Storefront view shows "Only admin users can manage the public storefront layout." for non-admin staff; the API requires admin auth).
- [ ] Re-upload previously lost product images (wiped by Render ephemeral filesystem before Cloudinary was configured).
- [x] Validate the custom storefront layout is fully registered and selectable in the admin storefront selector (all 5 static layouts incl. `custom` seeded in `storefront_layouts` and registered in the frontend layout registry).
- [x] Add friendly messaging on the storefront page for non-admin users (friendly notice in the staff portal Storefront panel; no edit controls rendered).
- [x] Add a short note about the current layout system and admin-only control to the documentation (README "Storefront layout system" section).

## Low / Future

- Plan runtime layout import support as a later enhancement.
- Add tests or QA checks for layout switching, branch visibility, subscription requests, delivery fees, and control-plane authentication.
- Add GitHub issues or a project board for follow-up work.
- Break up `server/index.ts` (~5,000 lines, 281 routes) and `frontend/pages/admin.tsx` (~6,000 lines) into route/domain modules — the single biggest maintenance risk.
- Enable TypeScript `strict: true` incrementally and add an ESLint/Prettier config + CI quality gate.
- Move to formal SQL migrations instead of imperative startup migrations in `db.ts`.
- [x] Enforce CSRF (hard-fail) instead of soft-logging (client server now returns 403 on missing/mismatched tokens; frontend sends the token on all mutating requests, lazily fetching it when needed; external webhooks/POS/control-plane requests are exempt) and enable a strict CSP in Helmet (client server CSP + control-plane CSP with `frame-ancestors 'none'`).

---

## Operator runbooks (added 2026-09-24, final verification pass)

These convert the two remaining **operator-gated** items — CI independently confirmed, and a real DR restore drill — into exact, copy-pasteable procedures. They are written for the **operator's own machine**, because neither can be completed from the machine used for the code audit: that box has **no `gh` visibility into the private flyshop repo** (the `Gears-Glitch` repo 404s to the audited `gh` account) and **no Postgres toolchain** (`pg_dump`/`pg_restore`/`psql`/`gunzip` all absent). Nothing here was executed end-to-end; both items remain `NOT VERIFIED` until you run these steps.

### Runbook A — Independently confirm CI on `main` (currently `4181de9`)

Audit truth (corrected 2026-09-24 after pulling CI from the owning account — my earlier "cannot see private repo" framing was a wrong-owner guess + `gh` quoting bug on this box, now disproven): **`CI` on `main` is a confirmed RED on the DB-gated isolation job** — completed/`failure` at `4181de9` and across the whole sampled window that predates this session's commits, while `Deploy Test Site` is `success` throughout. Root (exact fail-log): `[db] schema.sql not found at .../server/schema.sql` → `[migrations] directory not found, skipping` → `[FATAL] Server failed to start: relation "roles" does not exist` → `server never became healthy` → `hookFailed` → isolation suite cancelled (`cancelledByParent`). The files **exist on disk** in the checkout (`server/schema.sql` 43 KB; 20 migration files incl. `0020`), so the runner is resolving schema/migrations **CWD-relatively against the wrong directory when it spawns the server** — an infra boot-path signature, NOT an assertion regression and NOT caused by the crypto/reconciler/backup changes (all local DB-free gates are green: server 137/31 suites, control-plane 72/16 incl. 13 cp-secrets, frontend 29 static pages). From the owning account:

```powershell
# 1. Authenticate as the repo owner
gh auth login

# 2. list recent runs on main
gh run list --repo <owner>/Gears-Glitch --branch main -L 6 --json workflowName,headSha,status,conclusion

# 3. confirm the run for HEAD 4181de9 completed
gh run view <run-id> --repo <owner>/Gears-Glitch

# 4. fail log only (if it did NOT complete green)
gh run view <run-id> --repo <owner>/Gears-Glitch --log-failed
```

Acceptance: the run whose `headSha` starts with `4181de9` shows `completed/success`; the workflow must run **all four gates** — server `typecheck`+`build`+`test`, control-plane `typecheck`+`build`+`test`, frontend `build` (the CF worker deployment job can be `success` independently; an amber `in_progress` on the code-quality workflow is not green). Expected local units that CI should mirror: server **137**, control-plane **72** (incl. 13 `cp-secrets`), frontend **29 static pages**. Optionally `gh run watch <run-id>` if still queued.

### Runbook B — DR restore drill (documented-only today; `NOT VERIFIED`)

Prerequisite: one RO**scratch** Neon project (independent from prod), and run on a machine with the Postgres client (e.g. `winget install PostgreSQL.PostgreSQL.16` gives `psql`).

```powershell
# 1. Get the latest backup from the control-plane backups page (admin-gated
#    endpoint, .sql.gz). This box had no pg toolchain, so step 2-4 run on an
#    operator machine with psql. Replace paths/conn strings.
"# 2. decompress (PowerShell native, no 7z needed)"
$src = "latest_backup.sql.gz"; $out = "latest_backup.sql"
$in = [System.IO.Compression.GZipStream]::new(
    [System.IO.File]::OpenRead($src),
    [System.IO.Compression.CompressionMode]::Decompress)
$of = [System.IO.File]::Create($out)
$in.CopyTo($of); $in.Dispose(); $of.Dispose()

# 3. restore into the scratch project (never against prod)
psql "$SCRATCH_NEON_CONNECTION_STRING" -v ON_ERROR_STOP=1 -f latest_backup.sql

# 4. smoke verify against scratch
psql "$SCRATCH_NEON_CONNECTION_STRING" -c "SELECT count(*) FROM clients;"
psql "$SCRATCH_NEON_CONNECTION_STRING" -c "SELECT count(*) FROM customers;"
psql "$SCRATCH_NEON_CONNECTION_STRING" -c "SELECT count(*) FROM invoices;"
```

Acceptance: counters match the pre-backup prod counters (log them before the drill), rows for a known customer/invoice resolve, and no `ERROR` lines appear (ON_ERROR_STOP forces failure loudly). Then point a **scratch** Render service at the scratch DB and smoke the storefront/POS logins before discarding the scratch project. Update `PRODUCTION_READINESS_CURRENT.md` from "restore … NOT DR-verified" to "DR-verified on <date> against scratch Neon project <id>". Until this is run, **DR is a documented runbook, not a verified capability** — the audit claims no more than that.