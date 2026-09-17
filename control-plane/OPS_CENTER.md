# Ops Center — Client Health & Operations

The Ops Center is the control plane's operational surface for keeping every Gear&Glitch client healthy: it combines the classic 5-minute pull health loop with a **client-pushed heartbeat**, derives a health state per client, detects **alerts** (self-healing, deduplicated), measures **config drift**, generates **diagnostic reports** (secret-free), tracks **incidents**, manages **support access sessions** and **maintenance windows**, records **daily usage history**, and tracks **release/version rollout** across tenants.

Everything is operator-facing. All routes live under `/api/ops/*` (admin only) plus the server-to-server `POST /api/heartbeat`.

---

## How it works

```
┌──────────────┐  POST /api/heartbeat (x-control-plane-key)   ┌────────────────────────┐
│ Client store │ ───────────────────────────────────────────▶ │  Control plane         │
│  (2 min default, HEARTBEAT_INTERVAL_MIN)                    │  ops.ts / ops-db.ts    │
└──────────────┘                                               │                        │
                                                               │  every 5-min health    │
  ┌──────────────────────────────┐  GET /api/health            │  loop (existing pull)  │
  │ Client /api/health           │ ◀────────────────────────  │                        │
  └──────────────────────────────┘                             └────────────────────────┘
```

- **Pull (existing, unchanged)** — the 5-minute loop hits each client's `/api/health`, records `health_log`, updates usage/uptime, and enforces usage/subscription limits.
- **Push (new)** — each client backend runs a small heartbeat reporter (`server/control-plane-heartbeat.ts`) that POSTs a compact, secret-free snapshot to `/api/heartbeat` every `HEARTBEAT_INTERVAL_MIN` (default **2**). The control plane matches the caller against `clients.cp_secret` — the payload never travels with credentials.
- **Re-evaluation** — every heartbeat ingest immediately re-runs `evaluateForClient(id)`, so alerts/drift resolve or fire within seconds of a state change instead of waiting for the next pull cycle.

The two signals combine into a per-client **derived health state**:

| Derived status | Meaning |
|---|---|
| `healthy` | Health check passing, no failing required checks |
| `degraded` | A required check (db / storage / payments) is failing |
| `sleeping` | Cold-start sleep on the free tier (Render) |
| `offline` | Health check reported `down` (client unreachable) |
| `unknown` | No recent signal |
| `provisioning` / `failed` / `disabled` | Provisioning state |
| `maintenance` | Reserved for maintenance windows |

A stale heartbeat is **not** treated as an outage — it raises a `warning` alert and a drift finding so the operator can tell "store is down" from "reporter stopped talking".

---

## Heartbeat payload

Client → `/api/heartbeat` JSON body (all fields optional except the body being a JSON object; oversized bodies > 20 KB are rejected):

| Field | Type | Notes |
|---|---|---|
| `appVersion` (alt: `version`) | string | `package.json` version of the deployed build |
| `schemaVersion` | string | Latest applied `schema_migrations` version |
| `envType` | string | `production` / `development` / ... |
| `readiness` | string | Default `ok` |
| `checks` | object | Coarse integration statuses, see below |
| `capabilities` | string[] | e.g. `["heartbeat","usage","suspension","plans","backup-images"]` |
| `timestamp` | string (ISO) | Optional; the control plane stamps receipt, not this |

`checks` uses intentionally coarse vocabulary — **no secrets ever**:

```json
{
  "db":          { "status": "ok" },
  "mpesa":       { "status": "configured" | "unconfigured", "detail": "..." },
  "whatsapp":    { "status": "configured" | "unconfigured", "detail": "..." },
  "email":       { "status": "configured" | "unconfigured", "detail": "..." },
  "backups":     { "status": "enabled" | "disabled", "detail": "..." },
  "notifications": { "status": "ok" | "fail", "fails24h": 0 }
}
```

**Rate limiting:** `POST /api/heartbeat` is throttled per-IP at 300 req/min. It requires a client-role caller (per-client `x-control-plane-key`). The reporter caches nothing and retries on the next tick; it never blocks boot and unrefs its timer.

---

## Alerts

Alerts are created per client and deduplicated by `dedupe_key` (`UNIQUE` on the column). A fresh condition inserts a row (`created: true`); recurrence bumps `occurrence_count`. **Resolved** alerts only reopen after `alert_reopen_cooldown_min` (default **720 min**), and **suppressed** alerts stay silent until manually unsuppressed. Conditions that clear auto-`resolve` (self-healing).

### Alert conditions and keys

| Key | Trigger | Severity | Auto-resolves when |
|---|---|---|---|
| `heartbeat:stale:<id>` | No heartbeat for `heartbeat_stale_min` (default 10 min) | warning | Next heartbeat arrives (`resolveAlertsByDedupeKey`) |
| `client_down:<id>` | `health_status = 'down'` (health check failed) | danger | Health check passes again |
| `usage_over_limit:<id>` | `usage_over_limit = true` | danger | Usage back within limits |
| `backup_overdue:<id>` | `neon_db_url` set and no `deploy_log` status `backup` within `backup_stale_hours` (default 48h) | warning | Backup completes |
| `sub_expiring:<id>` | `subscription_expires` within 7 days | warning | Renewal recorded / expiry updated |

A newly-created stale-heartbeat alert also sends a Slack warning (no-op when `SLACK_WEBHOOK_URL` is unset).

### Workflow

Alerts carry a state machine: `open → acknowledged → investigating → resolved` (plus `suppressed`). Operators can **ack**, **assign**, **note**, **resolve**, **reopen**, **suppress/unsuppress**, or promote an alert into an **incident** (`POST /api/ops/alerts/:id/incident`). Every mutation is audit-logged.

---

## Config drift

Models "this tenant drifted from the expected configuration". One open row per `(client_id, key)` (`UNIQUE` constraint); re-detection refreshes the row (severity/labels/expected/actual) instead of duplicating, and `resolveDrift` closes it the moment the condition clears.

| Key | Checks | Severity |
|---|---|---|
| `version_outdated` | `app_version` ≠ latest `changelog` version | info |
| `heartbeat_missing` | No heartbeat after `heartbeat_missing_after_hours` (default 24h) from creation | warning |
| `mpesa_missing` | `checks.mpesa.status` is `unconfigured`/`disabled` | warning |
| `whatsapp_missing` | `checks.whatsapp.status` is `unconfigured`/`disabled` | info |
| `email_missing` | `checks.email.status` is `unconfigured`/`disabled` | info |
| `backups_disabled` | `checks.backups.status` is `disabled`/`unconfigured` | info |

---

## Incidents

Incidents are the operator's ticket/record layer on top of alerts:

- Created manually per client or promoted from an alert (`createIncidentFromAlert` maps severity `danger→high`, `warning→medium`, `info→low`, links `alerts.related_incident_id`, moves the alert to `investigating`, and records a comment).
- Fields: title, description, severity (`low|medium|high|critical`), priority (`low|normal|high|urgent`), assignee, status (`open|assigned|investigating|waiting_client|waiting_vendor|monitoring|resolved|closed`).
- **Resolved/closed auto-stamps `resolved_at`** (kept when editing back to an open status).
- Comments are either `internal` or `client` visibility; each comment is audit-logged.
- All updates pass through `updateIncident`, which is parameter-safe (no positional SQL drift).

---

## Diagnostic reports

`POST /api/ops/clients/:id/report` builds an on-demand JSON snapshot and stores it in `diagnostic_reports` (status `ready` / `failed`, downloadable via `GET /api/ops/reports/:id/download`). Report contents: health state, platform info (uptime %, last health check/heartbeat, app/schema versions, env type), integration checks, usage + 14-day usage history, subscription expiry, 7-day failed deploys/backups, recent deploy activity, alerts, incidents, drift, maintenance, support access, and recent heartbeats.

**Redaction is a hard guarantee:** the report deliberately includes only booleans, counts, and versions — never `cp_secret`, Neon URLs, passwords, or API keys. All check objects are flattened through `sanitizeChecksForReport` (primitives only) so nothing secret-shaped can leak. A regression test asserts the secret strings never appear in the serialized document.

---

## Support access

Time-boxed technician access sessions, fully audited:

- Created with at least one scope (`diagnostics`, `configuration`, `data`, `billing`, `full_access`), a default 24h duration (1–720h), optional `startsAt`.
- Lifecycle: `pending → active → expired/revoked`. **Approve** (only from `pending`) activates it; **revoke** works from `pending` or `active` and records who/when/why; the periodic sweep auto-`expires` active sessions whose `expires_at` passes.
- Every step (request / approve / revoke) is written to the audit log with the operator, client, and session.
- `GET /api/ops/support` also returns the technicians list (from `cp_users`) and supports `?client_id=` / `?status=` filtering.

> **Documented limitation:** sessions are tracked and audited, but do not yet inject client credentials into the technician's tools — that integration is future work.

---

## Maintenance windows

- Scheduled with `startsAt`/`endsAt` (ends must be after start), optional `services` list and client-facing message.
- State machine driven by the periodic sweep: `scheduled → active` when `starts_at` passes, → `ended` when `ends_at` passes. `scheduled`/`active` windows can be **cancelled**.
- `GET /api/ops/maintenance` supports `?client_id=` / `?status=` filtering.

---

## Daily usage history

`aggregateUsageForClients()` snapshots each client's `usage_orders` / `usage_customers` / `usage_revenue` once per day into `client_usage_history` (`UNIQUE(client_id, day)`), so the Ops Center can chart 14/30-day trends. Retention is capped by `usage_retention_days` (default 365); raw heartbeats by `hb_retention_days` (default 30).

---

## Thresholds & settings

Configurable on the **Thresholds** sub-tab (`GET/PUT /api/ops/settings`, stored in `cp_settings`, audit-logged on change). Values must be positive finite numbers:

| Key | Default | Unit | Meaning |
|---|---|---|---|
| `heartbeat_stale_min` | 10 | min | No heartbeat → stale alert |
| `offline_stale_min` | 15 | min | No signal → offline |
| `hb_retention_days` | 30 | days | Raw heartbeat retention |
| `usage_retention_days` | 365 | days | Usage history retention |
| `alert_reopen_cooldown_min` | 720 | min | Resolved alerts stay quiet before reopening |
| `backup_stale_hours` | 48 | h | No successful backup → overdue alert |
| `heartbeat_missing_after_hours` | 24 | h | Missing heartbeat becomes drift |

---

## API surface

All `/api/ops/*` endpoints require an authenticated **admin** user (JWT bearer or per-user `x-api-key`). The heartbeat endpoint is server-to-server (client-role).

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/heartbeat` | Client heartbeat ingestion (client-role, rate-limited) |
| GET | `/api/ops/overview` | All clients + derived health state + aggregate counts |
| GET | `/api/ops/alerts` | List alerts (`?state=`, `?severity=`, `?client_id=`) |
| GET | `/api/ops/alerts/summary` | Alert state counts |
| POST | `/api/ops/alerts/:id/ack` | Acknowledge |
| POST | `/api/ops/alerts/:id/assign` | Assign (`{assignee}`) |
| POST | `/api/ops/alerts/:id/note` | Append note |
| POST | `/api/ops/alerts/:id/resolve` | Resolve (`{resolution}`) |
| POST | `/api/ops/alerts/:id/reopen` | Reopen |
| POST | `/api/ops/alerts/:id/suppress` `/unsuppress` | Suppress (reason required) / un-suppress |
| POST | `/api/ops/alerts/:id/incident` | Promote alert to incident |
| GET | `/api/ops/incidents` | List (`?status=`, `?client_id=`) |
| GET | `/api/ops/incidents/:id` | Incident + comments |
| POST | `/api/ops/incidents` | Create manual incident |
| PUT | `/api/ops/incidents/:id` | Update (validated status/severity/priority, assignments, resolution fields) |
| POST | `/api/ops/incidents/:id/comments` | Add comment (`visibility: client|internal`) |
| GET | `/api/ops/clients/:id/heartbeats` | Raw heartbeat history |
| GET | `/api/ops/clients/:id/drift` | Drift for one client |
| GET | `/api/ops/drift` | All drift (`?state=`, `?severity=`) |
| GET | `/api/ops/clients/:id/alerts` | One client's alerts |
| GET | `/api/ops/clients/:id/incidents` | One client's incidents |
| GET | `/api/ops/clients/:id/usage` | Usage history (`?days=`) |
| POST | `/api/ops/clients/:id/report` | Generate diagnostic report |
| GET | `/api/ops/clients/:id/reports` | This client's reports |
| GET | `/api/ops/reports` | Recent reports (100) |
| GET | `/api/ops/reports/:id/download` | Download report JSON |
| GET | `/api/ops/support` | Sessions (+ technicians; `?client_id=`, `?status=`) |
| POST | `/api/ops/support` | Request session (`{clientId, scopes, durationHours}`) |
| POST | `/api/ops/support/:id/approve` | Approve pending session |
| POST | `/api/ops/support/:id/revoke` | Revoke (`{reason}`) |
| GET | `/api/ops/maintenance` | Windows (`?client_id=`, `?status=`) |
| POST | `/api/ops/maintenance` | Schedule window (`{clientId, startsAt, endsAt, services}`) |
| POST | `/api/ops/maintenance/:id/cancel` | Cancel window |
| GET/PUT | `/api/ops/settings` | Get / update thresholds (`{settings:{key:value}}`) |
| GET | `/api/ops/releases` | Latest changelog version vs each client's `app_version`, deploy log |

---

## Database tables

Created inline by `initOpsCenterDb()` (run from `server/index.ts` at boot), all `FK → clients(id) ON DELETE CASCADE` unless noted:

| Table | Purpose |
|---|---|
| `client_heartbeats` | Raw heartbeats (version, readiness, checks, capabilities, received_at) |
| `client_usage_history` | Daily usage snapshots, `UNIQUE(client_id, day)` |
| `alerts` | Deduped alerts, `dedupe_key UNIQUE`, state machine + resolution audit columns |
| `incidents` | Incident tickets (+ `resolved_at`, root cause, prevention) |
| `incident_comments` | Timed comments with visibility |
| `diagnostic_reports` | Generated report payloads + filenames |
| `support_access_sessions` | Technician sessions with approve/expire/revoke audit trail |
| `maintenance_windows` | Scheduled windows with state machine |
| `client_drift` | Drift findings, `UNIQUE(client_id, key)` |
| `cp_settings` | Ops thresholds (key/value) |

`clients` gains lifted heartbeat fields for cheap filtering: `last_heartbeat`, `app_version`, `schema_version`, `env_type`, `heartbeat_caps`, `latest_checks`.

---

## Client-side reporter

The store's backend (`server/control-plane-heartbeat.ts`) sends the heartbeat. It is enabled automatically when provisioning sets `CONTROL_PLANE_URL` + `CONTROL_PLANE_SECRET`.

```env
CONTROL_PLANE_URL=https://control-plane.onrender.com
CONTROL_PLANE_SECRET=...            # per-client secret (also used for plan sync-up)
HEARTBEAT_INTERVAL_MIN=2            # optional; default 2, floor 0.25
```

If the reporter is misconfigured, the store logs and keeps retrying — and the Ops Center surfaces the missing heartbeat as a drift/alert finding rather than a down status.

---

## Testing

- `npm test` (inside `control-plane/`) runs the Ops Center suites:
  - `tests/ops-units.test.ts` — pure functions: `deriveHealthState`, `heartbeatAgeMinutes`, `isSubExpiring`, `normalizeHeartbeat` (no DB needed).
  - `tests/ops-db-gated.test.ts` — DB-backed: heartbeat ingest, alert dedupe / cooldown / suppress, stale-heartbeat lifecycle, incident CRUD (including the `resolved_at` regression), alert→incident promotion, drift upsert/resolve, support expiry, maintenance state machine, usage upsert, settings validation, and diagnostic-report redaction.
- The DB suite auto-skips unless `CONTROL_PLANE_DATABASE_URL` (+ `CONTROL_PLANE_SSL_VERIFY=false` for plain Postgres) is set. GitHub Actions runs it in the `control-plane-test` job against an ephemeral PostgreSQL 17 service container.