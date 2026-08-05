# GitHub Action Points

Use this document to create issues or project cards directly on GitHub. Mirrors `ACTION_ITEMS.md`.

## Major

- [ ] Rotate the Neon database password (plaintext in local `.env`) — reset in Neon console, update `DATABASE_URL` on Render + local.
- [ ] Regenerate the Cloudinary API secret (was exposed via `GET /api/cloudinary-config` until lockdown) — regenerate in Cloudinary, update `CLOUDINARY_API_SECRET` on Render, re-pull via control plane.
- [ ] Set `NEXT_PUBLIC_MARKETING_ENABLED=true` on the main Vercel project (client deployments don't get marketing).
- [ ] Push control-plane secrets to existing clients via the control plane **Push Secret** button.
- [ ] Set `CONTROL_PLANE_SECRET` on the store's Render service and register in the control plane.
- [ ] Change the control-plane default password (`gearglitch2024`) → set `CP_ADMIN_PASSWORD`, then enable TOTP 2FA from the dashboard header.
- [ ] Set store names on existing clients — clients provisioned before the `STORE_NAME` fix show "Gear&Glitch" in the tab title; set their name in Admin → Settings → Store Info (new clients are automatic).

## Medium

- [x] Verify owner branch visibility and admin branch/subscription management.
- [x] Ensure storefront layout controls remain admin-only in the staff portal.
- [ ] Re-upload previously lost product images (wiped by Render ephemeral filesystem before Cloudinary).
- [x] Validate the custom storefront layout is fully registered and selectable.
- [x] Add owner-friendly messaging on storefront for non-admin users.
- [x] Document the layout system and admin-only control.

## Low / Future

- [ ] Runtime layout import support.
- [ ] Tests / QA checks: layout switching, branch visibility, subscription requests, delivery fees, CP auth.
- [ ] Break up `server/index.ts` and `admin.tsx` monoliths into route/domain modules.
- [ ] Enable `strict: true` TypeScript + ESLint/Prettier + CI quality gate.
- [ ] Formal SQL migrations instead of imperative startup migrations.
- [x] Enforce CSRF (hard-fail) + strict CSP.