# Gear&Glitch — Platform Roadmap

Vision: turn the multi-tenant Gear&Glitch platform into a complete, self-serve SaaS — where you can **collect money automatically**, your clients can **manage themselves**, and you get **alerts on your phone** without touching a laptop.

Status legend: `[x]` done · `[ ]` planned · `[~]` in progress. This document is a plan only — work is tracked in `ACTION_ITEMS.md` and GitHub Issues.

---

## Phase 1 — Collect money (highest value)

The single biggest gap: invoices exist, but nothing actually collects payments. Everything below removes manual record-keeping.

- [ ] **Payment gateway integration (M-Pesa/Daraja)** — real-money collection for the KES market.
  - [ ] Daraja STK Push request + callback/webhook in the control plane
  - [ ] Paybill/C2B webhook updates invoice + client payment status automatically
- [ ] **Card payments (Stripe)** — global fallback gateway, hosted checkout on invoices.
- [ ] **Recurring billing engine** — auto-generate the monthly/annual invoice on the billing cycle (replaces manual "generate invoice").
- [ ] **Payment reconciliation** — link gateway transactions to invoices, auto-record payments, auto-resume suspended clients on success.
- [ ] **Automated dunning** — when a client is overdue: email/SMS the client (CP SMTP), escalate, then auto-suspend (already shipped) and auto-resume.
- [ ] **Receipts & eTIMS integration** — issued receipts and KRA/eTIMS compliance flow tied to paid invoices.

## Phase 2 — Client self-service portal

Today the control plane acts on the client's behalf. A portal lets clients help themselves and reduces your workload.

- [ ] **Per-client portal login** (separate from CP users) — one account per client store.
- [ ] **Portal features** — view invoices, pay online via gateway, download PDF receipts, request plan upgrades, view usage/orders.
- [ ] **Onboarding wizard** — new client signs up, picks a plan, pays, and provisioning runs automatically.
- [ ] **Provisioning checklist** — per-client onboarding state: DNS, payment keys, branding/logo, theme, SMTP, feature flags.
- [ ] **Public marketing site + signup** — `NEXT_PUBLIC_MARKETING_ENABLED` landing page wired to the signup/payment flow.

## Phase 3 — Alerts on your phone

- [ ] **Installable PWA** for the control plane (manifest, service worker, icons, mobile CSS).
- [ ] **Web Push (VAPID)** — danger alerts (client down, payment overdue, deploy/backup failed, provisioning failed) push to your phone even when the app is closed.
- [ ] **Operator email/SMS alerts** — configurable per alert type, in addition to the in-app bell.

## Phase 4 — Reliability & operations

- [ ] **Deploy observability** — per-client build status, duration, and recent logs surfaced in the CP Deploy Log.
- [ ] **Backup restore** — one-click `pg_restore` per client, not just `pg_dump`.
- [ ] **Client cloning** — duplicate an existing client as a demo/sandbox.
- [ ] **Capacity monitoring** — per-client DB size, Render usage, and overage alerts tied to plan limits.
- [ ] **Migration safety** — formal SQL migrations instead of imperative startup migrations in `db.ts` (see `ACTION_ITEMS.md`).

## Phase 5 — Business layer

- [ ] **Revenue dashboard** — MRR, ARR, churn, active/suspended counts, revenue by plan.
- [ ] **Accounting export** — Xero/QuickBooks-compatible invoice/payment export; VAT handling.
- [ ] **System status page** — public page showing platform health for your customers.
- [ ] **Contracts & cancellation flow** — terms, cancellation requests, data export/deletion.

## Phase 6 — Support & security

- [ ] **Support tickets** — client-submitted tickets linked to their store.
- [ ] **SSO / invite flow** for CP team members (on top of existing 2FA + roles).
- [x] **Rate limiting on client public endpoints; strict CSP + CSRF hard-fail on the control plane** — client API has global + auth rate limiting, client server enforces CSRF hard-fail (403) on mutating requests with webhook/POS/CP exemptions, both the client server and the control plane serve CSP headers (`frame-ancestors 'none'`, `object-src 'none'`).
- [ ] **Secrets rotation** — automated rotation workflow for CP/client `CONTROL_PLANE_SECRET`, Cloudinary, and SMTP.

---

## Already shipped (for reference)

- Multi-tenant provisioning (Render) and per-client `cp_secret`
- Subscription plans, invoices, PDF generation, email via CP SMTP
- Payment reminders (1 week / 2 days / due / overdue) and auto-deactivation on missed payment
- Auto-suspend/resume with Slack alerts
- In-app notification bell: payment, down, usage-limit, deploy/backup/provisioning/upgrade alerts
- Daily 3 AM backups (`pg_dump`), changelog, Cloudinary sync, upgrade requests
- CP users, roles, API keys, 2FA (TOTP)
- CSRF hard-fail on client APIs (403 on missing/mismatched tokens) and CSP on both client server and control plane
- Storefront layout system: 5 static themes + runtime JSON layout builder, admin-only control
- Serial number tracking on clients — category-prefix generation (`serial_sequences`), POS barcode scanning/typing and linking at sale, automatic warranty-expiry calculation, and a Serial Numbers admin panel (list, lookup, batch generate, void)
- Purchase order stock lifecycle — Mark All Received adds stock on hand with `purchase_receive` movement records and auto-generates serials for serial-tracked lines; a Recall button fully reverses a receipt (deducts stock, voids the PO's in-stock serials, resets quantities, returns to `ordered`); deleting a received PO reverses its stock before moving to the Deleted tab
- Test-site-first deploy workflow (GitHub Actions → control plane `POST /api/deploy-test` → single test site), Deploy Log with commit ID/message, manual "deploy all clients" workflow

---

Suggested build order if you pick this up: **Phase 1 → Phase 3 (PWA + push) → Phase 2**, since collecting money and getting phone alerts deliver the most value per effort.
