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
- [ ] **Clear demo data from clients provisioned before the `SEED_DEMO_DATA` fix** — such clients booted with the default category taxonomy + demo product catalog (`server/products.json`). New clients now boot empty; for the older ones, select the rows in **Admin → Categories** / **Admin → Products** and use **Delete Selected** (products with sales/stock/serial history must be deactivated instead). Demo provider/customer logins were never seeded in production, so only categories/products need clearing.

- [x] **Set `CP_SECRETS_KEY` on the control-plane Render service** — verified 2026-10-25 from the Render startup log (active source reported as `CP_SECRETS_KEY`) and the migration output (7 secret rows committed, counts only). The key value is intentionally not recorded here. Keep this key stable: the current format has no key ID/keyring, so changing it makes existing ciphertext unreadable. See `SECURITY_MODEL.md` §5 for the rotation limitation and safe future path.

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

### Runbook B — DR restore drill (`VERIFIED 2026-10-12`)

Prerequisite: one scratch Neon project (independent from prod) **or** a local PostgreSQL 17 instance, and the Postgres client (`winget install --id PostgreSQL.PostgreSQL.17 -e` gives `psql`/`pg_dump`). The target **must be PostgreSQL 17+**: the dump is produced by `pg_dump 17` and its preamble sets `transaction_timeout`, which 16 and older reject. A non-Neon target must also pre-create Neon's roles (`neondb_owner`, `neon_superuser`, `cloud_admin`); a Neon scratch project has them natively. `scripts/dr-restore.ps1` automates steps 2–4 (`-ProvisionNeonRoles` for non-Neon targets).

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

# 4. smoke verify against scratch (TENANT tables only — `clients` is the
#    control-plane DB and is NOT present in a tenant backup)
psql "$SCRATCH_NEON_CONNECTION_STRING" -c "SELECT count(*) FROM products;"
psql "$SCRATCH_NEON_CONNECTION_STRING" -c "SELECT count(*) FROM customers;"
psql "$SCRATCH_NEON_CONNECTION_STRING" -c "SELECT max(version) FROM schema_migrations;"
```

Acceptance: counters match the pre-backup prod counters (log them before the drill), rows for a known customer/invoice resolve, and no `ERROR` lines appear (ON_ERROR_STOP forces failure loudly). Then point a **scratch** Render service at the scratch DB and smoke the storefront/POS logins before discarding the scratch project.

**Result (2026-10-12):** `mumbo-instruments-and-electron_2026-10-12.sql.gz` (31,954 B) decompressed to 285,832 B and restored into a fresh local PostgreSQL 17 instance with **no `ERROR`/`FATAL` lines** — 93 `public` tables, `products` 32, `customers` 0, `orders` 0, `invoices` 1, `schema_migrations` head `0029_normalize_layout_section_types`. Findings: (1) target must be PG 17+; (2) a non-Neon target needs Neon's roles pre-created. A Neon scratch project satisfies both, so the earlier documented procedure is sound; the local run is an equivalent artifact-level validation. `PRODUCTION_READINESS_CURRENT.md` updated accordingly.

---

## Master Project Recovery and Release-Readiness Task List

This inventory is based on the updated recovery plan supplied on 2026-10-25. The boxes below track **audits/reviews to perform**; they are not claims that the underlying feature is absent or broken. Reconcile findings against the current branch, pull requests, deployments, and test evidence before changing a status or implementing a fix. Preserve the safety rules in the recovery plan: read-only audit first, no production data changes, and no commit/push/merge/deploy without approval.

### P0 — Security and launch blockers

- [x] **S01 Dependency audit** — 2026-10-26: full and `--omit=dev` npm audits passed for root, frontend, and control-plane; all six reported 0 vulnerabilities.
- [x] **S02 `body-parser` / `qs`** — 2026-10-26: control-plane installed path is `express@4.22.3 → body-parser@1.20.9 → qs@6.16.1`, with direct `qs@6.16.1`; current full and production audits report 0 vulnerabilities.
- [x] **S03 Production encryption** — dedicated `CP_SECRETS_KEY` source and seven-row migration confirmed from Render/startup and migration output. Encryption uses a separate key source from JWT signing. Safe rotation limitation/runbook documented in `SECURITY_MODEL.md` §5; no key rotation was performed.
- [~] **S04 Tenant isolation — implementation complete; DB-backed verification pending (2026-10-26):** plan-sharing requests from a tenant now create bounded pending proposals; only a control-plane admin can approve/reject, and approval is the only path that updates the shared catalog and distributes to other active tenants. This closes the prior plan-ID overwrite path from tenant credentials. New provisioned clients receive immutable `gear-glitch/client-{clientId}` Cloudinary folders. Existing clients retain their recorded/legacy folder so their current image URLs remain valid. Evidence: root typecheck, control-plane typecheck, focused folder/proposal tests, and full database-free suites pass; no production data or tenant services were changed. The real HTTP + PostgreSQL proposal/approval test is gated and was skipped because no disposable `CONTROL_PLANE_DATABASE_URL` is configured. Before marking S04 fully verified, run that suite against a disposable control-plane DB and verify an existing client's Cloudinary folder remains unchanged in a safe test environment.
  - **Media boundary follow-up:** uploads/deletions are restricted to the service's configured Cloudinary folder (`server/upload.ts` around lines 339–377), but provisioning derives that folder from a normalized client name (`control-plane/server/provision.ts` around lines 91, 231, 570–597), while the client registry makes `domain` unique but not `name` (`control-plane/server/db.ts` around lines 123–126). This can produce the same folder for distinct tenants with colliding names; confirm whether the provider permits both services to provision before treating this as exploitable. Prefer an immutable unique client identifier for folders.
- [ ] **S05 Backup and disaster recovery:** verify independent backup storage, retention, recovery objectives, restore evidence, and drill schedule.
- [ ] **S06 Production data hygiene:** define a safe review for default credentials, test accounts, fixtures, and privileged accounts; do not auto-delete records.
- [ ] **S07 Legal readiness:** review privacy, terms, cookies, retention, export, and deletion documents; identify placeholders and required legal decisions.
- [ ] **S08 Content safety:** verify validation, escaping, and safe rendering for Website Studio, CMS, About Us, marketing, and dynamic-layout content.

### P1 — WhatsApp and business operations

- [ ] **B01 Merchant-owned WhatsApp:** verify onboarding, credential storage, webhook checks, consent, opt-outs, templates, messaging windows, delivery, retries, and revocation.
- [ ] **B02 WhatsApp tenant isolation:** verify credentials, inbound/outbound routing, webhooks, and message history cannot cross tenants.
- [ ] **B03 WhatsApp lifecycle:** test connect, reconnect, expired/invalid credentials, disconnect, revoked permissions, and webhook failures with mocks/test accounts.
- [ ] **B04 Subscription lifecycle:** review billing periods, plan changes, renewals, expiry, suspension/reactivation, payment failures, entitlements, and grace periods.
- [ ] **B05 Proforma reconciliation:** verify invoice conversion, payment matching, follow-ups, duplicate prevention, customer notices, and failure recovery.
- [ ] **B06 Control-plane email:** recheck the Render SMTP limitation and document compatible alternatives; do not change providers without approval.
- [ ] **B07 POS mobile checkout:** review PR #17 status/diff/checks and test mobile and desktop checkout behavior; do not merge without approval.
- [ ] **B08 Client provisioning:** test the full onboarding and recovery lifecycle with non-production resources only.

### P2 — Website Studio, storefront, and frontend

- [ ] **W01 Studio regression:** verify section create/edit/delete/reorder, typography, colors, backgrounds, hero/media, save/reload/publish, and theme compatibility.
- [ ] **W02 Responsive behavior:** check Studio and published stores on desktop, tablet, and mobile, including overflow, touch, menus, controls, and images.
- [ ] **W03 Dynamic block registry:** review allowed blocks, schemas, data binding, safe rendering, legacy layouts, unsupported blocks, and error recovery.
- [ ] **W04 Layout compatibility:** test existing themes and saved custom layouts against newer styling controls.
- [ ] **W05 Hero media:** verify product-image selection, upload, preview, persistence, publishing, replacement, invalid media handling, and mobile rendering.
- [ ] **W06 Accessibility:** check keyboard use, focus, contrast, labels, reduced motion, responsive text, and error messaging.
- [ ] **W07 Framework compatibility:** verify the current Next.js/React versions and run relevant type checks, builds, tests, and browser checks.
- [ ] **W08 Marketing site:** review positioning, claims, plans, calls to action, mobile usability, metadata, contact, and onboarding.
- [ ] **W09 Pricing and tiers:** document existing plan/pricing configuration and business decisions still needed; do not invent final prices.

### P2 — Codex, tooling, and release pipeline

- [ ] **C01 Skills:** verify installed skills and relevant tool availability; reconcile duplicates/deferred skills against migration records.
- [ ] **C02 Semgrep:** verify the Windows certificate/execution issue is resolved and run a repository scan.
- [ ] **C03 Snyk:** verify CLI authentication state, permissions, and a successful dependency analysis without printing credentials.
- [ ] **C04 Playwright:** verify package/browser versions, test configuration, and end-to-end coverage.
- [ ] **C05 Workspace preservation:** inspect local staged, unstaged, and untracked work before any implementation; preserve it.
- [ ] **C06 Progress register:** maintain task ID, category, priority, status, evidence, dependencies, blockers, next action, verification, and completion date in this checklist.
- [ ] **C07 CI/deployment readiness:** review GitHub Actions, Vercel/Render config, environment validation, migration safety, test gates, and rollback.
- [ ] **PR review:** check the current state, diff, checks, conflicts, and risk of PR #14 (control-plane follow-up timestamp comparison); do not merge without approval.
- [ ] **Test baseline:** record fresh, safe test results with commands, working directories, exit codes, failures, and environment blockers; treat historical counts as historical.

### P3 — Commercial and operational readiness

- [ ] **L01 Malware scanning:** ClamAV INSTREAM integration is available but scanning is deferred until a scanner is provisioned; without `CLAMAV_HOST`, a warning is logged and the validated/sanitized upload flow continues. Configure a reachable ClamAV service later, then set `UPLOAD_SCAN_REQUIRED=true` and verify signatures, timeouts, and production behavior.
- [~] **L02 Image processing:** server-side content validation and lossless WebP re-encoding for JPEG/PNG/WebP/static GIF; defaults now allow 25MB uploads, 60MP decode, and 60MB output. Still verify corrupt/polyglot rejection, failure cleanup, Cloudinary/local parity, and deployed behavior.
- [ ] **L03 Cloudinary:** verify hardened upload flow in an approved test environment.
- [ ] **L04 Recovery drill:** plan a safe restore exercise using the existing runbook; never overwrite production without approval.
- [ ] **L05 Data export/deletion:** review customer/merchant export, account deletion, retention, backup retention, and legal requirements.
- [ ] **L06 Business outreach:** prepare WhatsApp/email/demo/trial/follow-up materials; send nothing without approval.
- [ ] **L07 Production smoke plan:** document safe checks for onboarding, auth, storefront, inventory, POS, checkout, payments, invoices, subscriptions, WhatsApp, Studio, backups, permissions, and tenant isolation.
- [ ] **L08 Release sign-off:** define evidence required for internal development, staging, controlled pilot, and public commercial launch; keep legal/security gates explicit.

### Final planned implementation milestone — Website Studio full storefront customization

- [ ] **Expand Website Studio beyond the homepage** after the audit and higher-priority launch work are complete. Stage the work as follows:
  - [ ] Add storewide controls for brand colors, typography/type scale, buttons, corner radius, and spacing, applied consistently across storefront pages.
  - [ ] Add header/footer controls for logo, announcement bar, navigation, search/account controls, footer columns, and mobile navigation.
  - [ ] Extend validated section templates to category, product, repairs, and About pages; keep cart/checkout layout constrained to safe branding options.
  - [ ] Support tenant-scoped drafts, responsive previews, explicit publish, version history, and rollback.
  - [ ] Restrict saved layouts to schema-validated components/settings (no arbitrary HTML or JavaScript); verify tenant isolation, permissions, accessibility, responsiveness, and publish/rollback behavior with automated tests.
