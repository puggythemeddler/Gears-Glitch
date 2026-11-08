# Historical security and release-readiness audit notes

> Historical snapshot from 2026-10-25. This records the repository and deployment evidence reviewed at that time; it is not a current security assessment. Several findings below have since changed in code and later commits. Re-verify each item against the current branch before relying on its status.

**Review date:** 2026-10-25  
**Scope:** Source and documentation review for task-list items S04 (tenant isolation), S05 (backup and disaster recovery), S06 (production data hygiene), S07 (legal readiness), and S08 (content safety), plus current state notes for S01–S03.  
**Branch:** `codex/control-plane-secret-migration`  
**Changes made:** A local Cloudinary delete-folder guard in `server/upload.ts`, a correction to the control-plane bootstrap-password documentation, and this report. No dependencies, customer records, or deployment settings were changed.

## Executive summary

- **S01 — Dependency audit: VERIFIED for the checked lockfiles.** Root, frontend, and control-plane `npm audit` results were clean at the time of review. See the conversation’s audit outputs for package counts and scope; this does not guarantee future advisories will remain absent.
- **S02 — `body-parser` / `qs`: VERIFIED for the checked installed trees.** Express resolves `body-parser@1.20.9`, which resolves patched `qs` (`6.16.0` in the root tree and `6.16.1` in the control-plane tree). The package audits reported zero known vulnerabilities.
- **S03 — Production encryption: PARTIALLY VERIFIED.** The operator supplied Render startup logs showing encryption with the dedicated `CP_SECRETS_KEY`, and the migration output reported seven rows migrated. Key rotation and independent restore/recovery procedures remain undocumented and unverified.
- **S04 — Tenant isolation: PARTIALLY COMPLETE.** Per-client database, Render service, control-plane secret, and Vercel project provisioning are present. A local guard now rejects Cloudinary delete URLs outside the service’s configured folder. Six focused tests and TypeScript typecheck pass. The guard is uncommitted and undeployed; other tenant-isolation areas and Cloudinary-side credential permissions remain unverified.
- **S05 — Backup and disaster recovery: INCOMPLETE / HIGH RISK.** A tenant restore drill is documented as completed on 2026-10-12, but the application’s scheduled/on-demand backup route stores archives under the service’s local `backups/` directory and removes files after seven days. The checked Render service manifest specifies `plan: free` and has no disk configuration; Render documents free web-service filesystems as ephemeral, so backups in this path are lost on restart, spin-down, or redeploy if the live service matches this manifest. The reviewed code does not establish independent backup storage or a backup of the control-plane database. RPO/RTO targets and a recurring drill schedule are not documented.
- **S06 — Production data hygiene: PARTIALLY VERIFIED.** The code gates demo users/catalog seeding on `SEED_DEMO_DATA`, and production admin/technician creation requires configured initial passwords. Current production account state cannot be confirmed from source. A control-plane README row incorrectly described a fixed weak default password; that documentation was corrected to match the code’s random one-time bootstrap behavior.
- **S07 — Legal readiness: BLOCKED on merchant/legal decisions.** The privacy and terms pages visibly remain draft templates with bracketed company, contact, retention, payment, delivery, warranty, and governing-law placeholders. The repository explicitly requires qualified legal review and says the product does not certify compliance. I did not invent legal terms or remove the draft warnings.
- **S08 — Content safety: PARTIALLY REVIEWED.** Website Studio/layout content is rendered through React text nodes in inspected paths; no HTML injection sink was found in the sampled dynamic storefront rendering. The broader content surface still needs a route-by-route validation/escaping review, including control-plane DOM rendering, CMS/About fields, uploaded SVG policy, and externally supplied URLs.

## S04 — Tenant-isolation evidence

### Controls verified in source

- Tenant provisioning creates a Neon project/database per client and injects the database URL, a randomly generated JWT secret, and a per-client control-plane secret into that client’s Render service. See `control-plane/server/provision.ts` around lines 201–223.
- The control-plane secret is sent to the provisioned tenant service alongside its per-client endpoint configuration. Cloudinary configuration is also sent to each tenant, with a folder path derived from the client slug. See `control-plane/server/provision.ts` lines 225–232.
- Tenant uploads are placed under `${cloudinaryFolder}/${this.folder}`. See `server/upload.ts` lines 81–90.
- Tenant test database helpers require the explicit test database URL and do not fall back to the production database URL. This reduces the chance that the isolation test suite writes to production.

### Finding GG-TI-001 — Cloudinary deletion needed tenant folder ownership enforcement

**Severity:** High (conditional on the shared Cloudinary credential having asset-delete permission)  
**Confidence:** High for the missing application-level ownership check; provider-side restrictions are unknown.  
**Affected locations:**

- `control-plane/server/provision.ts:225–232` — sends the same configured Cloudinary account credentials to each tenant service and assigns a tenant-specific folder.
- `server/index.ts:1795–1812` — authenticated About image replacement accepts `req.body.previousUrl` and calls `deleteCloudinaryImage(previousUrl)` at lines 1807–1808.
- `server/upload.ts:339–346` — the original implementation parsed a public ID from the supplied URL and passed it to `cloudinary.uploader.destroy()` without validating URL host or folder ownership.

**Impact before local mitigation:** A tenant admin with the About update permission could potentially cause deletion of another tenant’s asset if they supplied its Cloudinary URL and the shared credential permits deletion. The request required authentication and the relevant permission; it was not an unauthenticated public deletion path.

**Recommended remediation:** Before calling Cloudinary `destroy`, validate the expected Cloudinary host/account and normalize the public ID, then require it to be inside the exact configured tenant folder (with path-boundary-aware comparison). Apply the same validation to every user-controlled deletion URL path, not only About image replacement. Longer term, evaluate separate provider credentials or narrowly scoped credentials per tenant to reduce shared-account blast radius. Add a focused test proving a tenant cannot delete an asset outside its own folder.

**Local mitigation now present:** `server/upload.ts` now accepts deletion only for HTTPS `res.cloudinary.com` image-upload URLs with an explicit version segment and a public ID inside the service’s configured Cloudinary folder. It skips out-of-folder assets and no longer logs public IDs. This change is local and uncommitted. Six focused behavior tests and TypeScript typecheck pass; no Cloudinary API request was made. The live service remains on its prior deployed version until a release is authorized and completed.

**Uncertainty / not tested:** The review did not inspect Cloudinary account/API-key permission settings or make a live Cloudinary API call. No deletion was attempted. Confirm the configured credential’s destroy capability before assigning final exploitability.

### Additional verification item — database TLS flag

`control-plane/server/provision.ts:210` provisions `DB_SSL_REJECT=false`, while `server/db-helpers.ts` uses that flag to control certificate rejection. The generated database URL and the effective `pg` connection configuration were not inspected in a running tenant. Confirm that production tenant connections verify Neon’s certificate and remove this permissive override if it disables verification. This is recorded as an unverified configuration concern, not a confirmed TLS bypass.

## S05 — Backup and disaster-recovery evidence

- The control-plane backup endpoint runs `pg_dump` for active tenant databases and writes gzip files beneath `BACKUP_DIR`, defined as a local `backups` directory (`control-plane/server/index.ts:1594–1643, 1647–1675`). A daily timer starts after service boot and recurs after each run (`control-plane/server/index.ts:3054–3088, 3184–3200`); that proves scheduling code exists, not that a job succeeded or the file survived a restart.
- The backup route deletes files older than seven days (`control-plane/server/index.ts:1677–1685`). This is a local retention rule, not evidence of independent or durable storage.
- The checked `control-plane/render.yaml` declares the service `plan: free` and does not declare a persistent disk. Render’s current documentation says free web services have an ephemeral filesystem and cannot attach persistent disks. If the deployed service still uses this manifest configuration, locally generated backups are lost when the service restarts, spins down, or redeploys. The live Render dashboard plan/disk settings were not inspected, so that deployed-state condition remains to be confirmed.
- The reviewed endpoint selects tenant `neon_db_url` values and does not back up the control-plane database (`control-plane/server/index.ts:1651–1660`). The existing restore runbook explicitly notes that control-plane tables are not included in a tenant backup (`ACTION_ITEMS.md:89–93`).
- The runbook records a successful tenant dump restore into a fresh local PostgreSQL 17 instance on 2026-10-12, including table counts and migration head (`ACTION_ITEMS.md:70–98`). That is useful artifact-level evidence but does not establish a current automated backup schedule, off-host copy, control-plane database recovery, or a recurring production restore drill.
- No RPO/RTO objective or recurring restore-drill cadence was found in the inspected task-list/runbook sections.

**Status:** A tenant restore procedure and one historical restore result exist. The app-level backup path is not a durable backup strategy under the repository’s configured free/no-disk Render service. Independent storage, control-plane database backup/recovery, RPO/RTO, retention policy approval, and a current successful backup/restore drill remain unverified. Do not infer Neon provider-level backup settings from this application code; they require checking the Neon project’s configured plan/settings and backup history.

**Operator direction:** Backup/disaster-recovery work is intentionally on hold until the operator configures a NAS.

## S06 — Production data hygiene evidence

- `server/db.ts` gates demo seeding behind `SEED_DEMO_DATA`; the README states provider/customer demo accounts and demo catalog are not seeded in production unless explicitly enabled.
- `server/admin-provisioning.ts` refuses to create a production admin when `ADMIN_PASSWORD` is missing. `server/db.ts` similarly skips production technician creation if `TECH_PASSWORD` is missing.
- Control-plane `seedDefaultAdmin()` uses `CP_ADMIN_PASSWORD` if configured; otherwise it generates a random 16-byte base64url password and logs it once during initial account creation (`control-plane/server/index.ts:688–703`). This does not reset an existing account.
- `control-plane/README.md` previously claimed the password defaulted to the fixed value `gearglitch2024`. The implementation does not do that. The README now describes the random bootstrap password and the one-time behavior accurately.

**Status:** The safe seeding controls are present in source. The running production environment, existing admin identities, whether any old tenant contains demo catalog rows, and whether bootstrap credentials were rotated cannot be verified from this workspace. Do not delete accounts or catalog records without an operator-reviewed inventory.

## S07 — Legal readiness evidence

- `LEGAL_REVIEW_REQUIRED.md` clearly classifies the privacy page, terms page, and cookie banner as drafts/templates, says they have not been reviewed by a lawyer, and forbids representing the product as legally compliant until qualified review.
- `frontend/pages/privacy.tsx` still contains placeholders for legal entity, address, contact, legal bases, recipients, retention periods, rights/complaint route, and cookie details.
- `frontend/pages/terms.tsx` still contains placeholders for identity, eligibility, currency/taxes, payment/refund rules, delivery, warranties/returns, repairs, IP, liability, governing law, and contact.
- The cookie banner says it is a draft and does not itself control third-party trackers; the legal review file says none are currently wired.

**Status:** Do not fill these terms by inference. Completion needs the operator’s legal/business details and qualified legal approval, so this item is blocked pending those inputs.

## Limitations and next work

- This was a static source/documentation review, not a penetration test or live production test.
- No secrets or production database values were read or included.
- The independent next steps are to inspect current non-sensitive backup configuration/evidence, define RPO/RTO with the operator, and test the Cloudinary folder guard in a disposable test account. Changes that alter shared Cloudinary account architecture or production backup policy require an operator decision.
- Continue S08 with a complete route and control-plane DOM sink audit before treating content safety as verified.

## External platform documentation consulted

- Render states that free web services have ephemeral filesystems and cannot use persistent disks: [Deploy for Free](https://render.com/docs/free).
- Render describes default service filesystem persistence and disk constraints: [Persistent Disks](https://render.com/docs/disks).
