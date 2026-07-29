# Deploy Checklist

Step-by-step deployment checklist. Items marked **operator action** require logging into external dashboards — they cannot be done from code.

## Generate fresh secrets

Run this once and copy the output into the env vars below:

```bash
node -e "const c=require('crypto');console.log('JWT_SECRET='+c.randomBytes(32).toString('hex'));console.log('CONTROL_PLANE_SECRET=cps_'+c.randomBytes(24).toString('hex'));console.log('ADMIN_PASSWORD='+c.randomBytes(16).toString('base64url'));console.log('CP_ADMIN_PASSWORD='+c.randomBytes(16).toString('base64url'));"
```

## 1. Backend (Render — your store's backend service)

| Env var | Value | Notes |
|---|---|---|
| `DATABASE_URL` | (Neon connection string) | Rotate the Neon password first (Neon console → Roles → reset), then paste the new string here |
| `JWT_SECRET` | (generated, 64 hex chars) | Replace the old one — min 32 chars; server refuses to start if it's a known placeholder |
| `ADMIN_USERNAME` | `admin` | Seeded admin account |
| `ADMIN_EMAIL` | `admin@gearandglitch.com` | Seeded admin email |
| `ADMIN_PASSWORD` | (generated) | Required in production — without it, no admin user is created |
| `TECH_USERNAME` | `technician` | Seeded technician account |
| `TECH_EMAIL` | `tech@gearandglitch.com` | Seeded technician email |
| `TECH_PASSWORD` | (generated) | Used to test role-gated views |
| `CONTROL_PLANE_SECRET` | `cps_...` (min 16 chars) | Enables remote management from the control plane. Leave unset to disable all CP access |
| `CLOUDINARY_CLOUD_NAME` | (from Cloudinary) | |
| `CLOUDINARY_API_KEY` | (from Cloudinary) | |
| `CLOUDINARY_API_SECRET` | (regenerated — see below) | The old one was exposed publicly until `/api/cloudinary-config` was locked down |
| `CLOUDINARY_FOLDER` | `gear-glitch` | Per-client folders go under this (e.g. `gear-glitch/{client-slug}`) |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | (your SMTP) | Email notifications; leave blank to log to `data/emails.log` instead |
| `NODE_ENV` | `production` | Disables demo accounts + weak-password fallbacks |
| `DB_SSL_REJECT` | `false` | Required for Neon |
| `PORT` | `8020` | |

### Rotate the Cloudinary API secret (operator action)

1. Cloudinary dashboard → Settings → API Keys → **Regenerate** the secret.
2. Copy the new secret into `CLOUDINARY_API_SECRET` on Render for the store's backend.
3. In the control plane → **Sync Cloudinary** to push the new credentials to all clients (or pull from this client first if the stored CP cloudinary config is stale).

## 2. Frontend (Vercel — your main deployment)

| Env var | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_MARKETING_ENABLED` | `true` | Enables `/marketing` landing page on the main deployment. Client deployments don't set this. |
| `BACKEND_URL` | `https://gears-glitch.onrender.com` | (or your backend's Render URL) Server-side env — used in `next.config.js` rewrites |

Redeploy after adding env vars (Vercel → Deployments → Redeploy).

## 3. Control Plane (Render — separate Express app)

| Env var | Value | Notes |
|---|---|---|
| `CONTROL_PLANE_DATABASE_URL` | (Neon — different DB from clients) | The control plane's own PostgreSQL database |
| `CP_ADMIN_PASSWORD` | (generated) | Replace the default `gearglitch2024`. **Change immediately after first login.** |
| `JWT_SECRET` | (generated) | JWT signing secret for CP sessions (was auto-generated per-boot if unset — set it so sessions persist across restarts) |
| `CONTROL_PLANE_API_KEY` | (optional) | Legacy global API key — only needed for backwards compatibility |
| `RENDER_API_KEY` | (from Render) | Render → Account Settings → API Keys |
| `NEON_API_KEY` | (from Neon) | Neon console → API keys |
| `VERCEL_TOKEN` | (from Vercel) | Vercel → Settings → Tokens |
| `VERCEL_TEAM_ID` | (optional) | Vercel team account ID |
| `CLOUDFLARE_API_TOKEN` | (optional) | For automatic subdomain DNS on provisioning |
| `CLOUDFLARE_ZONE_ID` | (optional) | The zone for your base domain |
| `DOMAIN_BASE` | `gearglitch.com` | Base domain for provisioned client subdomains |
| `OPERATOR_ADMIN_EMAIL` | (your email, e.g. `jolly@gearandglitch.com`) | Default admin email for new clients — when you leave "Admin Email" blank on Add Client, the seeded admin account uses this email. Set this to your account so you control every client. |
| `FRONTEND_GIT_REPO` | `puggythemeddler/Gears-Glitch` | Repo that gets deployed for each client |
| `SMTP_*` + `FROM_EMAIL` | (your SMTP) | Welcome emails on provisioning |

### After control plane is deployed

1. Log in with `admin` + `CP_ADMIN_PASSWORD`.
2. Click the **2FA Off** badge in the header → **Set Up 2FA** → scan QR → enter code → enable.
3. For each existing client row → click **Push Secret** to inject `CONTROL_PLANE_SECRET` into the client's Render service.
4. To register your store as a managed client: **+ Add Existing** with its backend URL, Render service ID, and the same `CONTROL_PLANE_SECRET` you set on the store's Render env — or use **Push Secret** after adding it without a secret (one is auto-generated and pushed).

## 4. Provisioning a new client (Add Client)

When you click **Add Client** in the control plane, the following happens automatically:

1. **Neon database** created (separate PostgreSQL per client)
2. **Render web service** created from the shared repo with env vars pre-set:
   - `DATABASE_URL`, a random `JWT_SECRET`, the new `CONTROL_PLANE_SECRET`
   - `ADMIN_USERNAME=admin`, `ADMIN_EMAIL=<client admin email>`, `ADMIN_PASSWORD=<generated>`
   - `TECH_USERNAME=technician`, `TECH_EMAIL`, `TECH_PASSWORD=<generated>`
   - Cloudinary credentials with per-client folder `gear-glitch/{client-slug}`
3. **Vercel project** created and wired to the new backend URL
4. **DNS** subdomain set up under `DOMAIN_BASE` (if Cloudflare configured)
5. **Welcome email** sent with login credentials + URLs

The new client's admin can log in at `{frontend-url}/login` immediately. `NEXT_PUBLIC_MARKETING_ENABLED` is **not** set for clients, so their `/marketing` page renders "not available".

## Post-deploy verification

- [ ] `https://gears-glitch.onrender.com/api/health` returns `{ok:true}` (no business stats without CP auth)
- [ ] `/api/cloudinary-config` returns `403` without the `x-control-plane-key` header
- [ ] `/api/plans/sync` returns `403` without the `x-control-plane-key` header
- [ ] Control plane **Health Check** shows all clients as `healthy`
- [ ] Control plane **Suspend** flips a client's `/api/health` to `{ok:true, suspended:true}` and storefront returns 403 to visitors
- [ ] Admin → Settings → **Delivery Fees** shows the county table and Save persists
- [ ] `/marketing` on the main Vercel deployment renders the full landing page
- [ ] `/marketing` on a client deployment renders "not available"
- [ ] Admin login → Settings → **2FA** can be enabled (QR shown, code verified)