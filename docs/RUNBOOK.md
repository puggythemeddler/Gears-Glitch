# Operations Runbook — Backup, Restore, Retention & Incident Response

Audience: whoever operates the control plane and tenant backends.
This runbook describes what the code actually does today and the steps an
operator should run. Where a capability does **not** exist, it is flagged as a
gap rather than assumed.

Companion docs: `control-plane/OPS_CENTER.md` (health/alerts/incidents),
`docs/../DATABASE_MIGRATIONS.md`, `SECURITY_MODEL.md`, `PRODUCTION_READINESS_CURRENT.md`.

---

## 1. What a deployment looks like

- **One PostgreSQL database per tenant** (Neon). The tenant backend (`server/`)
  talks to its own database; the control plane manages many clients.
- **Backups are produced by the control plane** (`control-plane/server/index.ts`),
  not by the tenant backend. There is also a partial, in-app JSON export
  (`GET /api/admin/backup`, admin/owner only) — see §3.
- **Media**: uploaded images live in Cloudinary (or local disk if Cloudinary is
  unconfigured). A database backup does **not** include Cloudinary assets.

---

## 2. Backups

### 2.1 Automatic (control plane)

- `scheduleAutoBackup()` runs **daily at 03:00 server-local** for every client
  with `status = 'active'` and a non-empty `neon_db_url`.
- Each client is dumped with `pg_dump <decrypted neon_db_url>` piped through an
  in-process `zlib` gzip to `backups/<slug>_<YYYY-MM-DD>.sql.gz`.
- Outcome is recorded in `deploy_log` (`backup` / `backup_failed`).
- **Retention: files older than 7 days are deleted.** (control-plane/server/index.ts, cleanup block)

### 2.2 Manual (control plane)

```
POST /api/backups/run            # admin; runs all active clients now
GET  /api/backups                # list backups (name, size, mtime)
GET  /api/backups/download/:filename   # download one backup
```

### 2.3 Prerequisites / failure modes

- `pg_dump` **must be on the control-plane host PATH** (PostgreSQL client 17+).
  Missing binary surfaces as "pg_dump not found on PATH".
- Neon runs PostgreSQL 17; dumps include `SET transaction_timeout`, so restores
  need a **PG17+** target.
- Secrets (`neon_db_url`) are stored encrypted and decrypted at backup time; a
  missing/rotated `ENCRYPTION_KEY`/`JWT_SECRET` breaks backups.

### 2.4 Known gaps (action required before relying on DR)

- **Backups are stored on the control-plane host's local disk** (`backups/`).
  That is a single point of failure and not an off-site copy. → **P1: mirror to
  object storage (S3/Blob) or enable Neon point-in-time restore and document it.**
- **7-day retention** may be shorter than your RPO/RTO needs. → Decide and set.
- **No documented periodic restore test.** → Run the drill in §3.2 at least
  quarterly and after any schema change.
- **Media (Cloudinary) is not backed up.** → Confirm the Cloudinary account's
  own retention/backup posture.

---

## 3. Restore

### 3.1 In-app JSON export (partial, not a DR path)

`GET /api/admin/backup` returns a JSON dump of all `public` tables for the
**current tenant** (guarded by `ownerAuthMiddleware` + `data:backup`, i.e.
admin/owner only). It is read-only and useful for inspection/audit, but it is
**not** a supported restore artifact (no schema, no sequences, ignores objects
outside `public`). Prefer the `pg_dump` backups above.

### 3.2 DR restore drill (never touches prod)

Use `scripts/dr-restore.ps1` against a **throwaway/scratch** database only:

```powershell
.\scripts\dr-restore.ps1 `
  -BackupGz  "$env:USERPROFILE\Downloads\myshop_2026-01-15.sql.gz" `
  -ScratchUrl "postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require"
```

The script: checks the target is PG17+, decompresses without external tools,
restores with `ON_ERROR_STOP=1`, then prints verification counts for
`products`, `customers`, `orders`, `invoices` and the `schema_migrations` head.
Compare those counts to the same queries on production, then drop the scratch
project.

### 3.3 Production restore (requires approval — destructive)

> This overwrites live tenant data. Do not run without explicit owner approval
> and a fresh backup of the current state.

1. Put the tenant read-only / take it offline to stop writes.
2. Capture a pre-restore backup of the current DB.
3. Create a fresh database (or schema) rather than restoring over a live one.
4. Restore with `psql -v ON_ERROR_STOP=1 -f <file>.sql` (PG17+ target; provision
   Neon roles `neondb_owner`, `neon_superuser`, `cloud_admin` if the target is
   non-Neon — `-ProvisionNeonRoles`).
5. Verify with the §3.2 queries and application smoke checks (login, product
   list, one order, one repair).
6. Bring the tenant back online and confirm health in the Ops Center.

---

## 4. Retention

| Data | Retention | Where |
|---|---|---|
| Tenant DB dumps | 7 days (auto-pruned) | control-plane host `backups/` |
| In-app JSON export | none (download only) | operator |
| Cloudinary media | per Cloudinary account | Cloudinary |
| Audit log | see `SECURITY_MODEL.md` | tenant DB |
| Health/heartbeat history | per Ops Center | control-plane DB |

Decide the **RPO/RTO** for each tenant and confirm this table meets it; adjust
the 7-day window and add off-site copies as needed.

---

## 5. Incident response

### 5.1 Detect

- Ops Center derives per-client health (`healthy` / `degraded` / `sleeping` /
  `offline` / `unknown`) from the 5-minute pull loop plus client heartbeats, and
  raises **alerts** and **config-drift** findings (`control-plane/OPS_CENTER.md`).
- A stale heartbeat is a `warning` (reporter stopped), not an outage.
- Critical alert classes: DB down, storage down, payments failing, repeated
  `backup_failed`.

### 5.2 Classify severity

| Sev | Example | Target response |
|---|---|---|
| SEV1 | Data loss, tenant DB down, suspected breach | Immediate; page owner |
| SEV2 | Payments/WhatsApp sends failing, backups failing repeatedly | Same business day |
| SEV3 | Degraded performance, drift, single failed backup | Next business day |

### 5.3 Contain & recover (by incident type)

- **Tenant DB corruption/loss** → §3.3 restore to a fresh DB.
- **Suspected secret/credential exposure** → rotate `JWT_SECRET`,
  `ENCRYPTION_KEY`, Meta/WhatsApp tokens, `M-Pesa` credentials, control-plane
  keys; invalidate sessions; review audit log. Note: rotating the at-rest key
  requires re-encrypting stored secrets (see `SECURITY_MODEL.md`).
- **Compromised staff account** → disable the user, rotate their password,
  review role/permission grants and the audit log.
- **WhatsApp abuse / unexpected sends** → the outbound consent/opt-out choke
  point blocks unsolicited sends; if a send incident occurs, unapprove affected
  templates (admin), disable the integration, and review `whatsapp_logs`.
- **Suspected personal-data breach** → follow the legal notification obligations
  for the jurisdiction (this runbook does not provide legal advice; see
  `LEGAL_REVIEW_REQUIRED.md`). Preserve evidence, then notify.

### 5.4 Communicate

- Maintain a single incident channel; post status updates at a fixed cadence.
- Record facts/decisions/timestamps in the incident record (Ops Center incident
  tracking where available; otherwise a shared doc).

### 5.5 Post-mortem

- Within 5 business days: timeline, root cause, impact, what worked, and
  concrete follow-up actions with owners and due dates.

---

## 6. Access & secrets

- Control-plane routes are admin-only; support access uses the Ops Center's
  time-boxed support sessions — prefer those over sharing credentials.
- Never commit secrets. Production secrets live in the hosting provider's env
  config (Render/Vercel/Neon), not in the repo.
- Set `ENCRYPTION_KEY` (≥16 chars) so at-rest encryption is independent of
  `JWT_SECRET` and can be rotated.

---

## 7. Periodic checklist

- [ ] Daily: confirm auto-backup ran (no new `backup_failed` in `deploy_log`).
- [ ] Weekly: verify one backup downloads and is non-empty.
- [ ] Quarterly: run the §3.2 restore drill into scratch and compare counts.
- [ ] On every schema change: re-run the restore drill.
- [ ] Review Ops Center alerts and drift; close or triage.
