# Action Items

Current action points for the project, by priority. Copy into GitHub Issues or a project board with `major` / `medium` / `low` labels.

## Major — operator action required

These require access to external dashboards (Neon, Cloudinary, Render, Vercel). See `DEPLOY_CHECKLIST.md` for the step-by-step env vars and rotation values.

- [ ] **Rotate the Neon database password** — the plaintext connection string is in your local `.env`. Reset the password in the Neon console and update `DATABASE_URL` on Render + local `.env`.
- [ ] **Regenerate the Cloudinary API secret** — it was exposed publicly via `GET /api/cloudinary-config` until the recent lockdown deploy. Regenerate in Cloudinary → Settings → API Keys, then update `CLOUDINARY_API_SECRET` on Render and re-pull via the control plane (or use **Sync Cloudinary**).
- [ ] **Set `NEXT_PUBLIC_MARKETING_ENABLED=true`** on your main Vercel project so `/marketing` renders the full landing page. Client deployments created via the control plane don't set this and get a "not available" page.
- [ ] **Push control-plane secrets to existing clients** — deploy the control plane (latest `main`), then for each existing client row click **Push Secret**. This injects `CONTROL_PLANE_SECRET` into the client's Render service and stores it on the client row, enabling remote management.
- [ ] **Set `CONTROL_PLANE_SECRET` on your own store's Render service** and register the same value in the control plane if you want the CP to manage your store too.
- [ ] **Change the control-plane default password** — set `CP_ADMIN_PASSWORD` in the control-plane Render env, redeploy, log in, then click the **2FA Off** badge → Set Up 2FA → scan QR → enable.
- [ ] **Set store names on existing clients** — clients provisioned before the `STORE_NAME` fix are seeded with the "Gear&Glitch" default, so their browser tab title and og tags show the wrong brand. Each such client should set its name once in **Admin → Settings → Store Info** (or set `STORE_NAME` on its Render service + redeploy). New clients are handled automatically by provisioning.

## Medium

- ~~Regenerate Cloudinary API secret (was shared publicly) and update the env var in Render.~~ — the endpoint that leaked it (`GET /api/cloudinary-config`) is now locked behind `CONTROL_PLANE_SECRET`, but the secret itself still needs rotating (see Major above).
- [ ] Verify owner branch visibility and admin branch/subscription management:
  - owner can see all assigned branches
  - admin can manage branches and subscription limits
- [ ] Ensure storefront layout controls remain admin-only in the owner panel.
- [ ] Re-upload previously lost product images (wiped by Render ephemeral filesystem before Cloudinary was configured).
- [ ] Validate the custom storefront layout is fully registered and selectable in the admin storefront selector.
- [ ] Add owner-friendly messaging on the storefront page for non-admin users.
- [ ] Add a short note about the current layout system and admin-only control to the documentation.

## Low / Future

- Plan runtime layout import support as a later enhancement.
- Add tests or QA checks for layout switching, branch visibility, subscription requests, delivery fees, and control-plane authentication.
- Add GitHub issues or a project board for follow-up work.
- Break up `server/index.ts` (~5,000 lines, 281 routes) and `frontend/pages/admin.tsx` (~5,000 lines) into route/domain modules — the single biggest maintenance risk.
- Enable TypeScript `strict: true` incrementally and add an ESLint/Prettier config + CI quality gate.
- Move to formal SQL migrations instead of imperative startup migrations in `db.ts`.
- Enforce CSRF (hard-fail) instead of soft-logging; enable a strict CSP in Helmet.