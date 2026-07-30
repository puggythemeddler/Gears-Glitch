# Gear&Glitch Control Plane

Central dashboard for managing all Gear&Glitch client instances. Provision new clients, monitor health, manage subscriptions, deploy updates, handle invoicing, configure SMTP/Cloudinary, receive Slack alerts on down clients, enforce usage limits, track admin actions in an audit log, and download database backups — all from one place.

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
| `CONTROL_PLANE_API_KEY` | No (legacy) | Legacy API key for backward compatibility (still works) |
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
| `SLACK_WEBHOOK_URL` | No | Slack webhook URL for down-client and over-usage alerts |

## Deploy to Render

1. Push this repo to GitHub
2. Create a new **Web Service** on Render
3. Set **Root Directory** to `control-plane`
4. **Build Command**: `npm ci && npx tsc && cp -r public dist/public`
5. **Start Command**: `node dist/server/index.js`
6. Add all environment variables from `.env.example`
7. Set up a **Managed Database** (PostgreSQL) on Neon and paste the URL

> **Note:** Client backend services are also deployed on Render via the same repo. Their build command uses `NODE_ENV=development npm ci && cd server && npx tsc && cd ..` to include devDependencies (type definitions) during compilation, and their start command is `node dist/server/index.js`.

## Dashboard Tabs

### Clients
- **Stats**: Total clients, active count, total revenue, total orders
- **Client table**: Name, domain, plan, subscription status (color-coded), health, uptime %, orders, revenue, contact fields (phone, address)
- **Subscription column**:
  - Green = active, OK
  - Yellow = expiring within 30 days (shows days left)
  - Red = expired (shows days since expiry)
  - Gray = no plan/expiry set
  - **OVER LIMIT** badge — shown when client usage exceeds plan max products
- **Actions per client**:
  - **Details** — opens full client panel with invoices
  - **Backend/Frontend** — links to client's live URLs
  - **Edit** — change plan, expiry, notes, feature flags, phone, address
  - **Redeploy** — trigger a Render deploy for this client individually
  - **Suspend/Resume** — pause or unpause the client's Render service
  - **Delete** — removes DB + all cloud resources

### Client Details Panel
Click **Details** on any client to see:
- Stats: plan, uptime, orders, revenue
- Subscription status with days remaining
- **Invoice table** with all subscription invoices:
  - **Generate** — create a new invoice for this client
  - **Pay** — mark invoice as paid
  - **View** — open branded HTML invoice in new tab
  - **PDF** — download invoice as PDF
  - **Email** — send invoice to client's email

### Plans
- Create, edit, activate/deactivate, delete custom subscription plans
- Set name, description, monthly/annual price, tier level, max products, max branches, features
- **Sync Plans to All Clients** — pushes all plans to every active client's database
- Only active plans appear on client storefronts

### Changelog
- Publish updates with version, title, and details
- All active clients receive email notifications automatically

### Deploy Log
- History of all deployments triggered from the control plane

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

## Two-Factor Authentication (2FA)

Administrators can protect their control-plane accounts with TOTP two-factor authentication (Time-based One-Time Password), in addition to the standard username + password.

- **Two-step login:** Enter username + password → if 2FA is enabled, the screen switches to a 6-digit code input → verify with your authenticator app (Google Authenticator, Authy, 1Password, etc.) → sign in.
- **Setup:** Click the **2FA Off** badge in the dashboard header → **Set Up 2FA** → scan the QR code with your authenticator app → enter the 6-digit code to enable. The badge turns green (**2FA On**).
- **Disable:** Click the badge → enter your password to confirm.
- **API access bypasses 2FA:** Programmatic calls using `x-api-key` (per-user API key or the legacy `CONTROL_PLANE_API_KEY`) skip the 2FA step so cron jobs, GitHub Actions, and other automation keep working.
- **Database:** The `cp_users` table carries `totp_secret` (string) and `totp_enabled` (boolean) columns.

## Client Provisioning

When you add a new client via the **Add Client** modal, the control plane automatically:

1. **Creates a Neon database** — separate PostgreSQL for the client. The connection URI is extracted from the project creation response.
2. **Creates a Render web service** — deploys the backend with all required env vars (`DATABASE_URL`, `JWT_SECRET`, `ADMIN_*`, `TECH_*`, `CONTROL_PLANE_SECRET`, Cloudinary). Env vars are applied via the dedicated `env-vars` endpoint after service creation, then a deploy is triggered.
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

## API Endpoints

All endpoints require authentication via one of:
- **Bearer JWT token** — `Authorization: Bearer <token>` (from login)
- **Per-user API key** — `x-api-key: <key>` (each user gets a unique key)
- **Legacy global API key** — `x-api-key: <CONTROL_PLANE_API_KEY>` (backward compatible)

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
| GET | `/api/clients/:id` | Get single client |
| POST | `/api/clients` | Provision new client |
| POST | `/api/clients/existing` | Register existing deployment |
| PUT | `/api/clients/:id` | Update client (plan, expiry, notes, features) |
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
| POST | `/api/clients/:id/invoices/:invId/pay` | Mark invoice paid |
| GET | `/api/clients/:id/invoices/:invId/view` | View invoice HTML (?format=pdf for PDF) |
| POST | `/api/clients/:id/invoices/:invId/email` | Email invoice to client |
| GET | `/api/clients/:id/subscription` | Get client's subscription info |

### Plans
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/plans` | List custom plans |
| POST | `/api/plans` | Create plan |
| PUT | `/api/plans/:id` | Update plan |
| DELETE | `/api/plans/:id` | Delete plan |
| POST | `/api/plans/sync-all` | Push plans to all active clients |

### Operations
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/deploy-all` | Deploy latest code to all clients |
| POST | `/api/health-check` | Check health of all clients |
| POST | `/api/sync-cloudinary` | Push stored Cloudinary credentials to all clients |
| POST | `/api/pull-cloudinary/:id` | Pull Cloudinary config from a live client |
| GET | `/api/cloudinary` | Get stored Cloudinary config status |
| POST | `/api/cloudinary` | Set/update Cloudinary credentials in DB |
| POST | `/api/backups/run` | Run database backups |
| GET | `/api/backups` | List backup files |
| GET | `/api/backups/download/:filename` | Download a backup `.sql.gz` file |
| POST | `/api/changelog` | Publish changelog + notify clients |
| GET | `/api/changelog` | List changelog entries |
| GET | `/api/deploys` | List deploy history |
| GET | `/api/audit` | List audit log entries (last 200) |

### SMTP Configuration
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/smtp` | Get SMTP config status (masked password) |
| POST | `/api/smtp` | Set/update SMTP configuration |
| POST | `/api/smtp/test` | Send a test email to verify configuration |

## GitHub Actions Auto-Deploy

The workflow at `.github/workflows/deploy-all-clients.yml` runs on every push to `main`:

1. Fetches the client list from the control plane API
2. Loops through all active clients
3. Triggers a Render deploy for each one

**Required GitHub Secrets:**
- `CONTROL_PLANE_URL` — your control plane's URL
- `CONTROL_PLANE_API_KEY` — your control plane API key (legacy global key or any per-user API key)
- `RENDER_API_KEY` — your Render API key

## Auto-Health Check

The control plane checks all active clients every 5 minutes:
- Pings each client's `/api/health` endpoint
- Tracks uptime % (rolling average)
- Fetches usage stats (orders, customers, revenue)
- Stores results in the `health_log` table
- Sends Slack alerts when a client transitions from `healthy` → `down` or `down` → `healthy` (requires `SLACK_WEBHOOK_URL`)
- Enforces usage limits by comparing order counts against plan `max_products` — shows **OVER LIMIT** badge and sends a Slack alert when exceeded

## Database Schema

The control plane uses its own PostgreSQL database (not shared with clients):

| Table | Purpose |
|---|---|
| `clients` | All client instances with URLs, plans, health, usage, per-client `cp_secret`, phone, address |
| `health_log` | Health check history per client |
| `changelog` | Published updates |
| `deploy_log` | Deployment history |
| `custom_plans` | Plans created from the control plane |
| `upgrade_requests` | Client upgrade requests (pending review) |
| `cp_users` | Control plane user accounts (username, role, API key, TOTP 2FA) |
| `cloudinary_config` | Shared Cloudinary credentials (pulled from a client or set manually) |
| `smtp_config` | SMTP email configuration (host, port, user, pass, from email) |
| `audit_log` | Audit trail of all admin actions (action type, user, target, details, timestamp) |

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
