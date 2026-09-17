# Gear&Glitch Control Plane

Central dashboard for managing all Gear&Glitch client instances. Provision new clients, monitor health, manage subscriptions, deploy updates, handle invoicing, configure SMTP/Cloudinary, toggle per-client features (including Visitor analytics), receive Slack alerts on down clients, enforce usage limits, track payment reminders with automatic deactivation for missed payments, read in-app notifications, track admin actions in an audit log, and download database backups — all from one place.

The **Ops Center** (Operations tab) extends this with client-pushed heartbeats, derived health states, deduplicated/self-healing alerts, config drift detection, incidents, diagnostic reports, support access sessions, maintenance windows, and daily usage history — see [`OPS_CENTER.md`](OPS_CENTER.md).

## Quick Start

```bash
cd control-plane
npm install
cp .env.example .env   # fill in your API keys
npm run dev             # http://localhost:4000
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CONTROL_PLANE_DATABASE_URL` | Yes | Neon PostgreSQL connection string (separate from client DBs) |
| `CONTROL_PLANE_API_KEY` | No (legacy) | Removed. No longer accepted for authentication — use per-user API keys from the `cp_users` table instead. |
| `JWT_SECRET` | No | JWT signing secret (auto-generated if not set) |
| `CP_ADMIN_PASSWORD` | No | Default admin password (defaults to `gearglitch2024`) |
| `OPERATOR_ADMIN_EMAIL` | No | Default admin email for new clients (defaults to `admin@gearandglitch.com`) |
| `RENDER_API_KEY` | Yes | Render API key for provisioning/suspending services |
| `RENDER_API_URL` | No | Defaults to `https://api.render.com/v1` |
| `RENDER_OWNER_ID` | No | Render owner/team ID for service creation |
| `NEON_API_KEY` | Yes | Neon API key for creating databases |
| `NEON_ORG_ID` | No | Neon organization ID (for org-level projects) |
| `VERCEL_TOKEN` | Yes | Vercel token for creating frontend projects |
| `VERCEL_TEAM_ID` | No | Vercel team ID if using a team account |
| `DOMAIN_BASE` | No | Base domain (defaults to `gearglitch.com`) |
| `FRONTEND_GIT_REPO` | No | GitHub repo for frontend (defaults to `puggythemeddler/Gears-Glitch`) |
| `CLOUDINARY_CLOUD_NAME` | No | Override: shared Cloudinary cloud name (if not pulling from client) |
| `CLOUDINARY_API_KEY` | No | Override: shared Cloudinary API key |
| `CLOUDINARY_API_SECRET` | No | Override: shared Cloudinary API secret |
| `SMTP_HOST` | No | SMTP host for sending emails |
| `SMTP_PORT` | No | SMTP port (defaults to 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `FROM_EMAIL` | No | Sender email address |
| `SLACK_WEBHOOK_URL` | No | Slack webhook URL for down-client, over-usage, and stale-heartbeat alerts |
| `SUSPEND_GRACE_DAYS` | No | Grace period (days) before an active client is auto-suspended for a missed payment (defaults to `3`) |

## Deploy to Render

1. Push this repo to GitHub
2. Create a new **Web Service** on Render
3. Set **Root Directory** to `control-plane`
4. **Build Command**: `npm ci && npx tsc && cp -r public dist/public`
5. **Start Command**: `node dist/server/index.js`
6. Add all environment variables from `.env.example`
7. Set up a **Managed Database** (PostgreSQL) on Neon and paste the URL

> **Note:** Client backend services are also deployed on Render via the same repo. Their build command uses `NODE_ENV=development npm ci && cd server && npx tsc && cd ..` to include devDependencies (type definitions) during compilation, and their start command is `node dist/server/index.js`.

## Content Security Policy

The control plane serves a Content Security Policy via Helmet (`control-plane/server/index.ts`):

- `default-src 'self'`; scripts and styles inline-only (`script-src` / `style-src` include `'unsafe-inline'`); images from `data:` / `blob:` / `https:` (QR codes); `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'` (clickjacking); `upgrade-insecure-requests`.

> **Important — keep `scriptSrcAttr` set.** `scriptSrcAttr: ["'self'", "'unsafe-inline'"]` must stay in the policy. Helmet 7 appends `script-src-attr 'none'` to any policy that doesn't set `scriptSrcAttr` explicitly, and `'none'` blocks **every inline `onclick` handler**. The dashboard is a single static HTML file that wires all its buttons through inline `onclick=` attributes, so dropping this line makes every button on the page dead (they did nothing in production until this was added back).

## Dashboard Tabs

### Clients
- **Stats**: Total clients, active count, total revenue, total orders
- **Payment reminders banner** — clients whose `next_payment_date` is within 1 week, 2 days, due today, or overdue (computed by `GET /api/payment-reminders` from each client's `next_payment_date`)
- **Client table**: Name, domain, plan, subscription status (color-coded), health, uptime %, orders, revenue, contact fields (phone, address)
- **Subscription column**:
  - Green = active, OK
  - Yellow = expiring within 30 days (shows days left)
  - Red = expired (shows days since expiry)
  - Gray = no plan/expiry set
  - **OVER LIMIT** badge — shown when client usage exceeds plan max products
- **Actions per client**:
  - **Details** — opens full client panel with invoices
  - **More ▾** — a scrollable dropdown grouping Backend/Frontend links, Edit, Push Secret, Redeploy, Suspend/Resume, and Delete. It scrolls internally (`max-height` + `overflow-y: auto`) and is no longer clipped by the table, so every action is reachable even for rows at the bottom of the viewport.
  - **Backend/Frontend** — links to client's live URLs
  - **Edit** — change plan, expiry, notes, phone, address, and per-client feature overrides
  - **Redeploy** — trigger a Render deploy for this client individually
  - **Set as Test Site / Unset Test Site** — mark this client as the test site (only one at a time; a **TEST SITE** badge shows on its row). Every push to `main` auto-deploys here first.
  - **Suspend/Resume** — pause or unpause the client's Render service
  - **Delete** — removes DB + all cloud resources

### Client Details Panel
Click **Details** on any client to see:
- Stats: plan, uptime, orders, revenue
- Subscription status with days remaining
- **Invoice table** with all subscription invoices:
  - **Generate** — create a new invoice for this client
  - **Record Payment** — one-step payment recording: generate invoice, mark paid, extend `subscription_expires` (+30/365 days), set the next `next_payment_date`, log the payment in `client_payments`, compute the balance, auto-resume a suspended client, and clear outstanding payment notifications. A modal shows the expected amount (from the plan catalog), the amount paid, period (monthly/annual), next payment date, notes, and the resulting balance.
  - **View** — open branded HTML invoice in new tab
  - **PDF** — download invoice as PDF
  - **Email** — send invoice to client's email (sent via the control plane's own SMTP)

### Notifications (bell)
A bell icon in the header shows an unread-count badge and a dropdown panel of recent notifications. Alerts are generated on every health cycle and deduplicated so they never re-fire:
- **Payment due** — 1 week, 2 days, and due today (info/warning)
- **Payment overdue** — danger (ties into auto-deactivation)
- **Client DOWN** — health check failed; auto-clears when the client recovers
- **Usage over plan limits** — auto-clears when back within limits
- **Deploy failed** — one per failed deploy (last 24h)
- **Backup failed** — one per failed `pg_dump` (last 24h)
- **Provisioning failed** — clients stuck in `status='failed'`; auto-clears on recovery
- **Upgrade request** — new pending plan-upgrade request; auto-clears once reviewed

Recording a payment clears that client's outstanding payment notifications. The bell polls every 60s; mark-all-read and click-through-to-client are supported.

### Feature Overrides
Use the **Feature Overrides** picker in the Edit Client modal to fine-tune what an individual tenant can use, independent of their subscription plan:
- All features are listed in the same 11 collapsible groups as the plan editor (Core Commerce, Inventory & Stock, Invoicing & Finance, Repairs & Service, Customer Engagement, WhatsApp & Communication, Multi-Location, Marketing & Storefront, Analytics & Security, Support & Account, Payments & Currency)
- Click a feature chip to cycle through three states:
  - **Enabled** (orange) — force-adds a feature the plan doesn't include (`true` override)
  - **Blocked** (red, struck through) — hides a feature the plan normally includes (`false` override)
  - **Inherit** (neutral dash) — falls back to the plan's defaults (no override)
- Group-level **Select all** and **Block** buttons, plus a **Clear overrides** button to reset everything to plan defaults
- Saving always pushes the overrides to the client's backend (`POST /api/admin/features/overrides`) — even when empty, which clears stale overrides — and they're merged with the plan's features on the client's `/api/shop/features`

### Plans
- Create, edit, activate/deactivate, delete custom subscription plans
- Set name, description, monthly/annual price, tier level, max products, max branches, features
- **Sync Plans to All Clients** — pushes all plans to every active client's database
- Only active plans appear on client storefronts

### Changelog
- Publish updates with version, title, and details
- All active clients receive email notifications automatically

### Deploy Log
- History of all deployments (last 300 entries), each row showing **Client**, **Version** (short git commit ID — full SHA on hover — plus the first line of the commit message), **Status**, **Source** (`GitHub push` vs `Manual`), and **Triggered** timestamp.
- **Filters** — a status dropdown (Test deploy / Production deploy / Failed / Backup / Backup failed) and a search box that filters by client name, commit SHA, or commit message (`GET /api/deploys?status=...&q=...`).
- **Deploy Test Site** — deploys only the client marked as the test site (production clients untouched).
- **Deploy All Clients** — deliberate manual production rollout to every active client.
- Pushes to `main` land here automatically with their git ID (see *GitHub Actions Auto-Deploy* below).

### Operations (Client Health & Ops Center)
The **Operations** tab (admin only) is the single pane for tenant health and incident response. It uses the existing 5-minute health pull **plus** a client-pushed heartbeat (`POST /api/heartbeat`, every ~2 min per client) to derive per-client health, catch stale reporters, and self-heal without waiting for the next pull cycle. See [`OPS_CENTER.md`](OPS_CENTER.md) for the full reference. Sub-tabs:

- **Overview** — every client with derived status (healthy / degraded / sleeping / offline / unknown / provisioning / disabled), heartbeat age, open alerts, open incidents, drift count, maintenance count, last backup, failed deploys/backups in 7d, and a status-count summary.
- **Health** — per-client health table with derived state and recent heartbeat/check details; drills into one client's heartbeats, drift, alerts, incidents, and usage.
- **Alerts** — deduplicated alert queue (`dedupe_key` unique): ack / assign / note / resolve / reopen / suppress / unsuppress / promote-to-incident. Resolved alerts only reopen after the configured cooldown; cleared conditions auto-resolve.
- **Incidents** — ticket records with status/severity/priority/assignee, internal-or-client comments, and automatic `resolved_at` stamping on resolve/close. Alerts can be promoted into incidents directly.
- **Diagnostics** — on-demand JSON snapshot reports per client (health, platform, checks, usage + 14-day history, reliability, alerts, incidents, drift, maintenance, support, heartbeats) — redacted by construction: no `cp_secret`, Neon URLs, passwords, or API keys ever appear; downloadable.
- **Releases** — latest changelog version vs each client's deployed `app_version`, plus the recent deploy log, to track rollout progress.
- **Support Access** — time-boxed technician sessions (scopes, 1–720h) with a full pending → active → expired/revoked audit trail.
- **Maintenance** — scheduled windows that auto-transition scheduled → active → ended and can be cancelled.
- **Config Drift** — per-client deviations: outdated release version, missing heartbeat reporter, unconfigured M-Pesa/WhatsApp/email, backups disabled — each auto-closes when the condition clears.
- **Usage** — daily usage snapshots (orders/customers/revenue) charted per client.
- **Thresholds** — tune `heartbeat_stale_min`, `offline_stale_min`, retention windows, the alert-reopen cooldown, backup-stale hours, and the heartbeat-reporter deadline (persisted in `cp_settings`, audit-logged).

> **Client reporter** — every deployed client backend now starts a heartbeat reporter (`server/control-plane-heartbeat.ts`) when `CONTROL_PLANE_URL` + `CONTROL_PLANE_SECRET` are configured; `HEARTBEAT_INTERVAL_MIN` (default 2) tunes the cadence. A missing reporter shows up as a stale-heartbeat alert and a drift finding, not a false "down".

### Backups
- Run `pg_dump` backups for all active client databases
- Backups stored locally with 7-day auto-cleanup
- **Download** — download any `.sql.gz` backup file directly from the UI

### Settings
- **SMTP Configuration** — configure SMTP host, port, user, password, and sender email via the UI. Settings stored in the database with env var fallback. Test the configuration by sending a test email.
- **Cloudinary** — view stored Cloudinary credentials, update cloud name, API key, and API secret directly from the UI without needing a live client.

### Audit Log
- Record of all admin actions: create/delete/suspend/resume/redeploy/push-secret/deploy-all/cloudinary/smtp/backup/changelog
- Filterable table showing action type, user, timestamp, target entity, and details
- Accessible from the **Audit Log** tab in the dashboard

## Security & Audit Notes

- **Command injection hardening** — The backup `pg_dump` path runs via `spawn` with an argument array (no shell) piped to gzip (`control-plane/server/index.ts`), so the client DB URL can never be interpreted as a shell command.
- **Secret handling** — `GET /api/clients/:id` never returns `cp_secret`/`neon_db_url` to viewer-role users, `GET /api/smtp` returns a masked password, and `GET /api/users` masks other users' API keys. The main dashboard admin password is never rendered into the DOM.
- **API keys** — Mutual auth between the control plane and each client uses per-client `CONTROL_PLANE_SECRET` compared with `timingSafeEqual`. Programmatic access uses per-user API keys (`x-api-key`, from the `cp_users` table). The legacy global `CONTROL_PLANE_API_KEY` env value is no longer accepted. Deploy routes require a per-user key with the `admin` role.
- **Content Security Policy** — See the dedicated CSP section above (keep `scriptSrcAttr` set).

## Two-Factor Authentication (2FA)

Administrators can protect their control-plane accounts with TOTP two-factor authentication (Time-based One-Time Password), in addition to the standard username + password.

- **Two-step login:** Enter username + password → if 2FA is enabled, the screen switches to a 6-digit code input → verify with your authenticator app (Google Authenticator, Authy, 1Password, etc.) → sign in.
- **Setup:** Click the **2FA Off** badge in the dashboard header → **Set Up 2FA** → scan the QR code with your authenticator app → enter the 6-digit code to enable. The badge turns green (**2FA On**).
- **Disable:** Click the badge → enter your password to confirm.
- **API access bypasses 2FA:** Programmatic calls using `x-api-key` (per-user API key) skip the 2FA step so cron jobs, GitHub Actions, and other automation keep working.
- **Database:** The `cp_users` table carries `totp_secret` (string) and `totp_enabled` (boolean) columns.

## Client Provisioning

When you add a new client via the **Add Client** modal, the control plane automatically:

1. **Creates a Neon database** — separate PostgreSQL for the client. The connection URI is extracted from the project creation response.
2. **Creates a Render web service** — deploys the backend with all required env vars (`DATABASE_URL`, `JWT_SECRET`, `STORE_NAME`, `ADMIN_*`, `TECH_*`, `CONTROL_PLANE_SECRET`, Cloudinary). `STORE_NAME` is set to the client's name so the backend seeds the client's own store name on first boot (the tab title and og tags reflect it) instead of a hardcoded brand. Env vars are applied via the dedicated `env-vars` endpoint after service creation, then a deploy is triggered.
3. **Creates a Vercel project** — creates the project, links the GitHub repo, sets `BACKEND_URL`, and triggers an initial deploy from the `frontend/` directory.
4. **Sets up Cloudinary** — shared account with per-client folder (`gear-glitch/{client-slug}`), configured automatically from stored credentials.
5. **Sets up DNS** (optional) — creates a subdomain under your base domain via Cloudflare.
6. **Sends a welcome email** — includes login credentials, frontend/backend URLs, and plan info. SMTP must be configured.

### Provisioning Details

- **Admin account** — Every new client gets `ADMIN_USERNAME=admin`, `ADMIN_EMAIL` (taken from the modal or defaults to `OPERATOR_ADMIN_EMAIL`), and a generated `ADMIN_PASSWORD`. The backend creates this admin on first boot.
- **Technician account** — A `technician` seed account is also created for testing role-gated views.
- **Schema** — On first boot, the client backend loads `server/schema.sql` to create all database tables, ensuring a fresh database is fully initialized before running migrations.
- **Vercel frontend** — After project creation, the control plane triggers a production deploy from `main` with `rootDirectory: "frontend"`. The `BACKEND_URL` env var is set before triggering the deploy.

Provisioning runs synchronously — the UI shows progress as each step completes. If any step fails, previously created resources are cleaned up.

> **Provisioning readiness guard** — Provisioning fails fast if any of the three required keys is missing. `POST /api/clients` returns `400 {error, missing}` (listing the absent keys) **before** inserting a placeholder client row, so a new client can never silently land in `status='failed'`. `GET /api/provisioning/status` reports the same readiness (used by the Add Client modal to show a `#provision-warning` banner on open). A startup log line on the control plane confirms provisioning is enabled or lists the missing keys. The three required keys are `NEON_API_KEY`, `RENDER_API_KEY`, and `VERCEL_TOKEN`; the optional keys (`VERCEL_TEAM_ID`, `RENDER_OWNER_ID`, `NEON_ORG_ID`, `CLOUDFLARE_*`, `SMTP_*`) degrade gracefully when absent.

> **Testing client provisioning** — a full step-by-step acceptance checklist (pre-checks, adding a client, verifying Neon/Render/Vercel/DNS are actually created, setting up a reseller hardware shop, multi-tenant isolation, and cleanup) lives in `TEST_PLAN.md` section **D2**. Use it to validate that provisioning a new client (e.g. adding yourself to resell computer hardware) works end to end.

### Add Existing Client
Register an already-deployed instance without provisioning new resources. Just provide the name, email, backend URL, and frontend URL. Optionally provide the Render service ID and the client's `CONTROL_PLANE_SECRET`; if no secret is given, one is generated — push it to the client with `POST /api/clients/:id/push-secret`.

## Control-Plane ↔ Client Authentication

Every client backend carries a `CONTROL_PLANE_SECRET` env var (auto-generated during provisioning). The control plane stores this per-client secret (`clients.cp_secret`) and sends it as the `x-control-plane-key` header on every call to a client backend. The header is compared with `crypto.timingSafeEqual` to mitigate timing attacks. This authenticates:

- Plan sync (`PUT /api/plans/sync` on the client)
- Cloudinary config pull (`GET /api/cloudinary-config`)
- Subscription invoices, upgrade requests, branches, subscription status
- Usage stats via `GET /api/health` (business stats are only disclosed to the control plane)
- App-level suspend/resume (`POST /api/control-plane/suspend|resume` on the client)
- Redeploy trigger (`POST /api/control-plane/redeploy`)
- Backup (`GET /api/control-plane/trigger-backup`)

Clients without the secret configured reject all control-plane management calls. Suspend does both: sets the app-level suspended flag (storefront returns 403) and pauses the Render service.

The reverse direction works too: every client gets a `CONTROL_PLANE_URL` env var (the control plane's public URL). A client can call the control plane with its own `x-control-plane-key` (its `CONTROL_PLANE_SECRET`), which the control plane matches against `clients.cp_secret` to identify the caller. This powers client-created plan sync-up (`POST /api/plans/sync-up`).

## Client-Created Plan Sync

Client admins can create/edit plans on their own backend. Each plan has a **"Sync to other clients"** checkbox (default on). When an admin saves a synced plan, the client backend calls `POST /api/plans/sync-up` on the control plane, which:

1. Upserts the plan into `custom_plans` (preserving `sync_to_others`, active state, features).
2. Pushes that plan to every other active client via the existing `PUT /api/plans/sync` path (the originating client is skipped).

Plans that are not marked to sync are still saved locally on the creating client but are never distributed. The control plane's own plan editor has the same checkbox, and plan cards show a **"Syncs to clients"** badge. Control-plane `POST /api/plans/sync-all` still distributes all plans to all active clients regardless of the flag.

## API Endpoints

All endpoints require authentication via one of:
- **Bearer JWT token** — `Authorization: Bearer <token>` (from login)
- **Per-user API key** — `x-api-key: <key>` (each user gets a unique key; the role on the user's `cp_users` row determines what the route allows)
- **Client control-plane secret** — `x-control-plane-key: <secret>` (authenticated client services only, treated as a `client`-role user)

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login (returns JWT + user info; if 2FA enabled, first call returns `{totpRequired:true}` — second call with `totpCode` verifies and issues JWT) |
| POST | `/api/auth/register` | Create user (admin only) |
| GET | `/api/auth/me` | Get current user (includes `totpEnabled`) |
| POST | `/api/auth/2fa/setup` | Generate TOTP secret + `otpauth://` QR URL (current user) |
| POST | `/api/auth/2fa/enable` | Verify `totpCode` against pending secret and enable 2FA |
| POST | `/api/auth/2fa/disable` | Disable 2FA (requires `password` confirmation) |
| GET | `/api/auth/2fa/status` | Check whether 2FA is enabled for the current user |
| GET | `/api/users` | List all users (admin only) |
| PUT | `/api/users/:id` | Update user role/password (admin only) |
| POST | `/api/users/:id/regenerate-key` | Regenerate user API key (admin only) |
| DELETE | `/api/users/:id` | Delete user (admin only) |

### Clients
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/clients` | List all clients |
| GET | `/api/clients/test-site` | Get the client marked as the test site (may be `null`) |
| GET | `/api/clients/:id` | Get single client |
| POST | `/api/clients` | Provision new client (rejects with `400 {error, missing}` if required provisioning keys are unset) |
| GET | `/api/provisioning/status` | Report whether provisioning is ready (`ok`, `missing` keys) |
| POST | `/api/clients/existing` | Register existing deployment |
| PUT | `/api/clients/:id` | Update client (plan, expiry, notes, features, `is_test` — only one client can be the test site) |
| DELETE | `/api/clients/:id` | Delete client and all resources |
| PUT | `/api/clients/:id/suspend` | Suspend client (app-level 403 + pauses Render service) |
| PUT | `/api/clients/:id/resume` | Resume client |
| POST | `/api/clients/:id/push-secret` | Push/rotate control-plane secret onto client's Render service (admin only, `{"rotate": true}` to rotate) |

### Client Operations
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/clients/:id/redeploy` | Redeploy a single client's Render service |
| POST | `/api/clients/:id/sync-plans` | Push plans to one client |
| GET | `/api/clients/:id/upgrade-requests` | Get upgrade requests from client |
| PUT | `/api/clients/:id/upgrade-requests/:reqId` | Approve/reject upgrade request |
| GET | `/api/clients/:id/invoices` | Get subscription invoices |
| POST | `/api/clients/:id/invoices/generate` | Generate new invoice |
| POST | `/api/clients/:id/invoices/record-payment` | One-step payment: generate + mark paid + extend expiry + set next payment date + log payment + compute balance + auto-resume |
| POST | `/api/clients/:id/invoices/:invId/pay` | Mark invoice paid |
| GET | `/api/clients/:id/invoices/:invId/view` | View invoice HTML (?format=pdf for PDF) |
| POST | `/api/clients/:id/invoices/:invId/email` | Email invoice to client (via control-plane SMTP) |
| GET | `/api/clients/:id/subscription` | Get client's subscription info |

### Plans
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/plans` | List custom plans |
| POST | `/api/plans` | Create plan |
| PUT | `/api/plans/:id` | Update plan |
| DELETE | `/api/plans/:id` | Delete plan |
| POST | `/api/plans/sync-all` | Push plans to all active clients |
| POST | `/api/plans/sync-up` | Receive a plan from a client (marked to sync) and distribute it to the other clients |

### Operations
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/deploy-all` | Deploy latest code to all clients (manual production rollout) |
| POST | `/api/deploy-test` | Deploy latest code to the test site only (called by GitHub Actions on every push) |
| POST | `/api/health-check` | Check health of all clients |
| GET | `/api/payment-reminders` | Payment reminder windows (7d / 2d / due / overdue) from `next_payment_date` |
| GET | `/api/notifications` | Unread count + last 60 in-app notifications |
| POST | `/api/notifications/read` | Mark a notification read (`{id}`) or all read (`{all:true}`) |
| POST | `/api/sync-cloudinary` | Push stored Cloudinary credentials to all clients |
| POST | `/api/pull-cloudinary/:id` | Pull Cloudinary config from a live client |
| GET | `/api/cloudinary` | Get stored Cloudinary config status |
| POST | `/api/cloudinary` | Set/update Cloudinary credentials in DB |
| POST | `/api/backups/run` | Run database backups |
| GET | `/api/backups` | List backup files |
| GET | `/api/backups/download/:filename` | Download a backup `.sql.gz` file |
| POST | `/api/changelog` | Publish changelog + notify clients |
| GET | `/api/changelog` | List changelog entries |
| GET | `/api/deploys` | List deploy history (last 300; filter by `?status=` and `?q=` search over client/commit) |
| GET | `/api/audit` | List audit log entries (last 200) |

### Operations (Ops Center)
Admin-only routes for the client health & operations surface (heartbeat ingestion is server-to-server via the client's secret). Full behavioral reference: [`OPS_CENTER.md`](OPS_CENTER.md).

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/heartbeat` | Client heartbeat ingest (client-role, requires `x-control-plane-key`, 300 req/min) |
| GET | `/api/ops/overview` | All clients with derived health state, heartbeat age, checks, and aggregate counts |
| GET | `/api/ops/alerts` | List alerts (`?state=`, `?severity=`, `?client_id=`) |
| GET | `/api/ops/alerts/summary` | Open/acknowledged/investigating/suppressed/resolved counts |
| POST | `/api/ops/alerts/:id/ack` | Acknowledge alert |
| POST | `/api/ops/alerts/:id/assign` | Assign to an operator |
| POST | `/api/ops/alerts/:id/note` | Append an operator note |
| POST | `/api/ops/alerts/:id/resolve` | Resolve with a resolution note |
| POST | `/api/ops/alerts/:id/reopen` | Reopen (bypasses the auto-cooldown) |
| POST | `/api/ops/alerts/:id/suppress` / `unsuppress` | Suppress (requires reason) / un-suppress |
| POST | `/api/ops/alerts/:id/incident` | Promote an alert into an incident |
| GET | `/api/ops/incidents` | List incidents (`?status=`, `?client_id=`) |
| GET | `/api/ops/incidents/:id` | Incident detail + comments |
| POST | `/api/ops/incidents` | Create incident |
| PUT | `/api/ops/incidents/:id` | Update incident (validated; resolve/close stamps `resolved_at`) |
| POST | `/api/ops/incidents/:id/comments` | Add comment (`visibility: client\|internal`) |
| GET | `/api/ops/clients/:id/heartbeats` | Heartbeat history for one client |
| GET | `/api/ops/clients/:id/drift` | Drift findings for one client |
| GET | `/api/ops/drift` | All drift findings (`?state=`, `?severity=`) |
| GET | `/api/ops/clients/:id/alerts` | One client's alerts |
| GET | `/api/ops/clients/:id/incidents` | One client's incidents |
| GET | `/api/ops/clients/:id/usage` | Daily usage history (`?days=`) |
| POST | `/api/ops/clients/:id/report` | Generate a diagnostic report |
| GET | `/api/ops/clients/:id/reports` | A client's reports |
| GET | `/api/ops/reports` | Recent reports (100) |
| GET | `/api/ops/reports/:id/download` | Download report as JSON |
| GET | `/api/ops/support` | Support sessions + technician list (`?client_id=`, `?status=`) |
| POST | `/api/ops/support` | Request a support session (`{clientId, scopes, durationHours}`) |
| POST | `/api/ops/support/:id/approve` | Approve a pending session |
| POST | `/api/ops/support/:id/revoke` | Revoke a session (`{reason}`) |
| GET | `/api/ops/maintenance` | Maintenance windows (`?client_id=`, `?status=`) |
| POST | `/api/ops/maintenance` | Schedule a maintenance window |
| POST | `/api/ops/maintenance/:id/cancel` | Cancel a scheduled/active window |
| GET | `/api/ops/settings` | Get Ops thresholds |
| PUT | `/api/ops/settings` | Update Ops thresholds (`{settings:{key:value}}`, audit-logged) |
| GET | `/api/ops/releases` | Latest changelog version vs deployed `app_version` per client + deploy log |

### SMTP Configuration
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/smtp` | Get SMTP config status (masked password) |
| POST | `/api/smtp` | Set/update SMTP configuration |
| POST | `/api/smtp/test` | Send a test email to verify configuration |

## GitHub Actions Auto-Deploy (Test-Site First)

Deploys are split into two workflows so **clients never receive untested, error-prone updates**:

### `ci.yml` — typecheck gate on every push/PR
A separate continuous-integration workflow runs on every push to `main` and every PR. It runs the **server** (`npm run typecheck` + `npm run build` at the repo root) and the **control plane** (typecheck + build in `control-plane/`), plus two DB-backed test suites against ephemeral PostgreSQL 17 service containers: the **server isolation suite** (`npm run test` at the root) and the **control-plane Ops Center suite** (`npm run test` in `control-plane/`, covering heartbeat ingest, alert dedupe/cooldown, incident CRUD, drift, support/maintenance sweeps, and diagnostic-report redaction). Any failure blocks the workflow, so broken code is caught before it reaches the auto-deploy step. Branch protection can require this workflow to pass before a PR merges.

### `deploy-test.yml` — automatic, on every push
Runs on every push to `main` (and via manual dispatch). Its first job (`check`) runs **`npm run typecheck` for the server and the control plane** and aborts the workflow if either fails; only a green build proceeds to the deploy job. It calls `POST /api/deploy-test`, which deploys **only the client marked as the test site** (`is_test = 1`). Production clients are never touched. The workflow sends the push's git commit SHA and message, which the control plane records in the deploy log. If no test site is configured — or the deploy fails — the workflow fails (red), and production was still untouched.

### `deploy-all-clients.yml` — manual only
Production rollout is **deliberate and manual**. This workflow has **no push trigger** — it can only be started from the Actions tab, and it aborts unless you type `DEPLOY` in the `confirm` input. It runs the same server + control-plane typecheck gate first, then calls `POST /api/deploy-all`, deploys every active client's Render service, and records the git ID in the deploy log.

### Required GitHub Secrets
- `CONTROL_PLANE_URL` — your control plane's URL
- `CONTROL_PLANE_API_KEY` — per-user API key with the `admin` role (from Settings → Users in the control plane; the legacy global key is no longer accepted)

> `RENDER_API_KEY` is no longer needed in GitHub Actions — deploys are triggered through the control plane's own Render API key.

## Auto-Health Check

The control plane checks all active clients every 5 minutes:
- Pings each client's `/api/health` endpoint
- Tracks uptime % (rolling average)
- Fetches usage stats (orders, customers, revenue) and updates `usage_orders` / `usage_customers` / `usage_revenue`
- Stores results in the `health_log` table
- Sends Slack alerts when a client transitions from `healthy` → `down` or `down` → `healthy` (requires `SLACK_WEBHOOK_URL`)
- Enforces usage limits by comparing order counts against plan `max_products` — shows **OVER LIMIT** badge and sends a Slack alert when exceeded
- Enforces subscription payments (`enforceSubscriptionPayments()`) — auto-suspends clients whose `subscription_expires` is past the `SUSPEND_GRACE_DAYS` grace period
- Refreshes in-app notifications (`refreshNotifications()`) — payment reminders, down/usage alerts, deploy/backup/provisioning failures, and upgrade requests

The client `/api/health` endpoint discloses business stats (orders, customers, revenue — including paid subscription revenue from invoices) only to the control plane; the public response is just `{ ok: true }`.

**Ops Center signals** — on top of the pull loop, each client pushes a heartbeat (`POST /api/heartbeat`) every ~2 minutes with version, readiness, and coarse integration checks. Every ingest immediately re-runs `evaluateForClient(id)` so alerts (stale heartbeat, backup overdue, subscription expiring) and config-drift findings fire or self-heal within seconds, and the periodic sweep (`expireSupportAndMaintenance`, `pruneOpsData`) keeps support sessions, maintenance windows, and retention windows tidy. See [`OPS_CENTER.md`](OPS_CENTER.md).

## Payment Reminders & Auto-Deactivation

- **Reminders** (`GET /api/payment-reminders`) compute four windows from each client's `next_payment_date`: `7d` (due in 1 week), `2d` (due in 2 days), `due` (due today), and `overdue`. Each window fires once per client per due date (recorded in the `payment_reminders` table with a `UNIQUE(client_id, "window", due_date)` constraint) and appears in the reminders banner and as a bell notification.
- **Auto-deactivation** — `enforceSubscriptionPayments()` runs on every health cycle (5 min) and on every manual health check. An active client whose `subscription_expires` is past `SUSPEND_GRACE_DAYS` ago (default 3) is automatically **suspended** — never deleted — via the same `suspendClientRecord()` helper used by the manual Suspend button (app-level suspend flag, Render service pause, Slack alert). Clients are never deleted automatically; **Recording a Payment** resumes a suspended client and clears its outstanding payment notifications.
- `next_payment_date` is set when a payment is recorded and drives the reminder windows; subscription expiry is stored in `subscription_expires`.

## Database Schema

The control plane uses its own PostgreSQL database (not shared with clients):

| Table | Purpose |
|---|---|
| `clients` | All client instances with URLs, plans, health, usage, per-client `cp_secret`, phone, address, `next_payment_date`, `is_test` (test-site flag) |
| `health_log` | Health check history per client |
| `changelog` | Published updates |
| `deploy_log` | Deployment history (`deploy`, `deploy_test`, `backup`, `backup_failed`, `failed`) with `commit_sha`, `commit_message`, and `triggered_by` (`push` / `manual`) |
| `custom_plans` | Plans created from the control plane |
| `upgrade_requests` | Client upgrade requests (pending review) |
| `cp_users` | Control plane user accounts (username, role, API key, TOTP 2FA) |
| `cloudinary_config` | Shared Cloudinary credentials (pulled from a client or set manually) |
| `smtp_config` | SMTP email configuration (host, port, user, pass, from email) |
| `audit_log` | Audit trail of all admin actions (action type, user, target, details, timestamp) |
| `client_payments` | Recorded subscription payments (client, invoice, amount, period, due date, notes) |
| `payment_reminders` | One-time reminder events per client per window per due date (`UNIQUE(client_id, "window", due_date)`) |
| `cp_notifications` | In-app notifications (type, title, body, severity, client, read state, `dedupe_key UNIQUE`) |
| `client_heartbeats` | Raw client-pushed heartbeats (app/schema version, readiness, checks, received_at) |
| `client_usage_history` | Daily usage snapshots per client (`UNIQUE(client_id, day)`) |
| `alerts` | Deduplicated alerts (`dedupe_key UNIQUE`) with state machine + resolution audit columns |
| `incidents` / `incident_comments` | Incident tickets and timed internal/client comments |
| `diagnostic_reports` | Generated secret-free diagnostic snapshots + filenames |
| `support_access_sessions` | Technician sessions (scopes, expiry, full approve/revoke audit trail) |
| `maintenance_windows` | Scheduled maintenance with status state machine |
| `client_drift` | Config-drift findings (`UNIQUE(client_id, key)`) |
| `cp_settings` | Ops thresholds (heartbeat staleness, retention, cooldowns, backup-stale hours) |

## Architecture

```
Control Plane (Render)
  ├── Express server (port 4000)
  ├── Neon database (control plane DB)
  └── Static HTML dashboard

Client Instances (each gets)
  ├── Neon database (client DB)
  ├── Render web service (backend)
  └── Vercel project (frontend)
```

The control plane never stores client business data — it only stores metadata (URLs, plans, health). All business data lives in each client's own Neon database.
