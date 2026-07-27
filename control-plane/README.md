# Gear&Glitch Control Plane

Central dashboard for managing all Gear&Glitch client instances. Provision new clients, monitor health, manage subscriptions, deploy updates, and handle invoicing — all from one place.

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
| `CONTROL_PLANE_API_KEY` | Yes | API key for all control plane requests (set in GitHub Actions too) |
| `RENDER_API_KEY` | Yes | Render API key for provisioning/suspending services |
| `RENDER_API_URL` | No | Defaults to `https://api.render.com/v1` |
| `NEON_API_KEY` | Yes | Neon API key for creating databases |
| `VERCEL_TOKEN` | Yes | Vercel token for creating frontend projects |
| `VERCEL_TEAM_ID` | No | Vercel team ID if using a team account |
| `DOMAIN_BASE` | No | Base domain (defaults to `gearglitch.com`) |
| `FRONTEND_GIT_REPO` | No | GitHub repo for frontend (defaults to `puggythemeddler/Gears-Glitch`) |
| `SMTP_HOST` | No | SMTP host for sending emails |
| `SMTP_PORT` | No | SMTP port (defaults to 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `FROM_EMAIL` | No | Sender email address |

## Deploy to Render

1. Push this repo to GitHub
2. Create a new **Web Service** on Render
3. Set **Root Directory** to `control-plane`
4. Build Command: `npm install && npm run build`
5. Start Command: `npm start`
6. Add all environment variables from `.env.example`
7. Set up a **Managed Database** (PostgreSQL) on Neon and paste the URL

## Dashboard Tabs

### Clients
- **Stats**: Total clients, active count, total revenue, total orders
- **Client table**: Name, domain, plan, subscription status (color-coded), health, uptime %, orders, revenue
- **Subscription column**:
  - Green = active, OK
  - Yellow = expiring within 30 days (shows days left)
  - Red = expired (shows days since expiry)
  - Gray = no plan/expiry set
- **Actions per client**:
  - **Details** — opens full client panel with invoices
  - **Backend/Frontend** — links to client's live URLs
  - **Edit** — change plan, expiry, notes, feature flags
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

## Client Provisioning

When you add a new client, the control plane automatically:

1. **Creates a Neon database** — separate PostgreSQL for the client
2. **Creates a Render web service** — deploys the backend from the shared repo
3. **Creates a Vercel project** — deploys the frontend
4. **Sets up DNS** (optional) — creates a subdomain under your base domain
5. **Sends a welcome email** — includes login credentials, links, and plan info

Provisioning is async — returns immediately with a client ID. Check status at `/api/clients/:id`.

### Add Existing Client
Register an already-deployed instance without provisioning new resources. Just provide the name, email, backend URL, and frontend URL.

## API Endpoints

All endpoints require `x-api-key` header (or `?key=` query param).

### Clients
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/clients` | List all clients |
| GET | `/api/clients/:id` | Get single client |
| POST | `/api/clients` | Provision new client |
| POST | `/api/clients/existing` | Register existing deployment |
| PUT | `/api/clients/:id` | Update client (plan, expiry, notes, features) |
| DELETE | `/api/clients/:id` | Delete client and all resources |
| PUT | `/api/clients/:id/suspend` | Suspend client (pauses Render service) |
| PUT | `/api/clients/:id/resume` | Resume client |

### Client Operations
| Method | Endpoint | Description |
|---|---|---|
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
| POST | `/api/backups/run` | Run database backups |
| GET | `/api/backups` | List backup files |
| POST | `/api/changelog` | Publish changelog + notify clients |
| GET | `/api/changelog` | List changelog entries |
| GET | `/api/deploys` | List deploy history |

## GitHub Actions Auto-Deploy

The workflow at `.github/workflows/deploy-all-clients.yml` runs on every push to `main`:

1. Fetches the client list from the control plane API
2. Loops through all active clients
3. Triggers a Render deploy for each one

**Required GitHub Secrets:**
- `CONTROL_PLANE_URL` — your control plane's URL
- `CONTROL_PLANE_API_KEY` — your control plane API key
- `RENDER_API_KEY` — your Render API key

## Auto-Health Check

The control plane checks all active clients every 5 minutes:
- Pings each client's `/api/health` endpoint
- Tracks uptime % (rolling average)
- Fetches usage stats (orders, customers, revenue)
- Stores results in the `health_log` table

## Database Schema

The control plane uses its own PostgreSQL database (not shared with clients):

| Table | Purpose |
|---|---|
| `clients` | All client instances with URLs, plans, health, usage |
| `health_log` | Health check history per client |
| `changelog` | Published updates |
| `deploy_log` | Deployment history |
| `custom_plans` | Plans created from the control plane |
| `upgrade_requests` | Client upgrade requests (pending review) |

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
