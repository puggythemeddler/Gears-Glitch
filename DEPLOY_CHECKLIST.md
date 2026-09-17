# Deploy & Smoke-Test Checklist

Deploy safeguard: the push updates are auto-deployed to the **test site** only; production
promotion is a deliberate manual step. All three services have `autoDeploy: true` on `main`.

> **STATUS (updated 2026-09-17):** this checklist is current for operator tasks. Schema/migration notes were refreshed in `DATABASE_MIGRATIONS.md` (versioned runner `0001`–`0014`; no manual SQL needed at deploy). New optional env since this doc was written: `MPESA_CALLBACK_SECRET` (see README). One open CRITICAL: the eTIMS KRA adapter — do not enable `etims_mode` expecting real e-invoicing (stub returns `submitted:false`).

## 0. Before deploying

- [ ] **Rotate `JWT_SECRET`** on the backend service. The old one was short (`Livid@50` — do not
      reuse/echo it). Set a strong value (`openssl rand -hex 32`). The server throws at boot if
      unset or default.
- [ ] Confirm you have **Render free-instance capacity** for the backend (each new reseller
      client = its own additional free Render service).

## 1. Backend — Render service `gear-glitch-backend`

- Build: `npm ci --omit=optional && npx tsc` · Start: `node dist/server/index.js` · Health: `/api/health`
- Auto-deploys on push to `main`. If not, trigger **Manual Deploy → Deploy latest commit**.
- Verify: `/api/health` returns `{ ok: true }`; watch the Render deploy log it finishes without error.

### 1a. Verify this raft (audit middleware + audit-log API)
- [ ] Server typecheck + `npx tsc` build both pass (already verified in-repo).
- [ ] No DB migration needed (`audit_log.actor_role` column already exists).

## 2. Frontend — Vercel (git integration from `main`, rootDirectory `frontend`)

- Auto-deploys on push. If not, trigger a **Production** deploy.
- Verify the production deployment is **green** and the storefront loads.
- This carries: admin nav-remount fix, Stock take/control split, audit-log filters UI.

## 3. Control plane — Render service `gear-glitch-control-plane`

- Build: `cd control-plane && npm ci && npx tsc && cp -r public dist/public`
- Start: `cd control-plane && node dist/server/index.js` · Health: `/api/health`
- Auto-deploys on push. Verify health + watch for the new startup line:
  - OK: `[startup] Provisioning env OK: NEON_API_KEY, RENDER_API_KEY, VERCEL_TOKEN present.`
  - Warn: `[startup] WARNING: provisioning is DISABLED until these env vars are set: ...`
- Make sure `NEON_API_KEY`, `RENDER_API_KEY`, `VERCEL_TOKEN` are set (else, as the owner, you'll
  the warning + Add Client modal banner, and new-client provisioning will be blocked until set).

## 4. Smoke tests

### 4a. Admin navigation (was broken)
- [ ] Open Admin panel as **admin**.
- [ ] Click through **every** nav item — none should jump back to the dashboard.
- [ ] On each screen, click buttons. If any shows **"Internal server error."**, grab the matching
      `[Error] ...` line from the Render backend log for that exact click and send it for diagnosis.

### 4b. Audit log (new)
- [ ] Admin → Audit Log.
- [ ] Verify filters (user / action / entity type / from / to date) + **Reset**.
- [ ] Verify pagination (Prev/Next) + the total-entry count.
- [ ] Perform some actions (edit a product, add a coupon, place an order, log in/out) and confirm
      new entries appear with correct user + role.

### 4c. Auth (A-1 cookie + new auth audit entries)
- [ ] Staff: log in → appears as `login` entry; log out → `logout` entry.
- [ ] Customer: register/login → `customer_registered` / `customer_login` entries.

### 4d. Stock take / control split (backward compatible)
- [ ] Admin → Plans & Roles feature pickers show **Stock take** and **Stock control** as separate
      toggles (old combined "Stock take / inventory count" still works as a hidden alias).
- [ ] Old grants still show both pages; new per-page toggles control them independently.

## 5. After smoke tests pass

- [ ] D2 — provision yourself as a reseller client (see TEST_PLAN.md Section D2).
- [ ] C-8 — Render paid tier (open, owner decision; no cash budget currently).
