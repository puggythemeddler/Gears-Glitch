# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary user: the solo operator** — the founder/owner of Gear&Glitch who runs the whole SaaS by themselves. They provision new clients, monitor health, chase payments, redeploy tenants, run backups, and manage plans from this one dashboard, typically a few times a week.
- **Viewer users (capability, not an active audience)** — the product supports admin/viewer roles and per-user API keys, but in practice the operator is the only active user. Treat the viewer role as an available control, not a designed-for persona.

## Product Purpose

The control plane is the operator's single command center for every Gear&Glitch client instance. It provisions new tenants end-to-end (database, backend service, frontend, Cloudinary, DNS, welcome email), monitors their health and usage, enforces subscription payments with reminders and automatic suspension, triggers deploys and backups, manages plans and feature overrides, sends invoices, and keeps an audit trail — so one person can run a fleet of storefronts without touching each deployment's infrastructure directly.

Success means the operator can catch problems (a down client, an overdue payment, an over-limit tenant) before the client notices, and can act on them in a few clicks with full confidence that each action is recorded.

## Positioning

The control plane treats each client as a full stack (database + backend + frontend + credentials + billing), not a row. A neighboring product could copy individual buttons, but the mechanism — provisioning a complete, isolated, pre-configured storefront from one modal and then managing its money, health, and code from the same board — is what distinguishes it. It exists because one person operates many independent instances without a per-instance ops team.

## Operating Context

- **One operator, occasional sessions.** The dashboard is used a few times a week for provisioning, billing, health checks, and deploys. Every session needs to re-orient quickly; there is no daily muscle memory to rely on.
- **Fleet scale today:** fewer than 10 live clients. The UI should stay comfortable at that size while not falling apart as the fleet grows.
- **Automation runs in the background** — health checks every 5 minutes, subscription-payment enforcement with a grace period (default 3 days), automatic suspension (never deletion), payment-reminder windows (7d / 2d / due / overdue), deduplicated notifications, and 7-day backup cleanup. The operator's job is exception handling; the board must surface exceptions and stay quiet otherwise.
- **Every admin action is audited** (create, delete, suspend, resume, redeploy, push-secret, deploy-all, cloudinary, smtp, backup, changelog) and filterable from the Audit Log tab.
- **Deployment shape:** the control plane runs on Render; each client gets a Neon database, a Render backend, and a Vercel frontend. Client business data never lives in the control plane — only metadata (URLs, plans, health, payments).
- **Login is secured:** username + password with optional TOTP 2FA; programmatic calls authenticate via per-user API keys and skip 2FA.

## Capabilities and Constraints

- **Clients tab:** aggregate stats (total, active, revenue, orders), a payment-reminders banner, a client table with color-coded subscription status (active / expiring / expired / no plan), OVER LIMIT badges, uptime bars, and per-client actions (details, edit, redeploy, suspend/resume, delete).
- **Client Details panel:** plan, uptime, usage, subscription status, and an invoice table with generate / record-payment / view / PDF / email. Recording a payment is one step: invoice + paid + expiry extension + next-payment date + payment log + balance + auto-resume + notification clear.
- **Feature overrides:** per-client three-state overrides (enabled / blocked / inherit) over the 11 plan-feature groups, always pushed to the client's backend.
- **Plans tab:** create/edit/activate/deactivate/delete plans (monthly + annual pricing, max products/branches, feature groups) and sync all plans to every active client.
- **Changelog, Deploy Log, Backups** (pg_dump + download), **Settings** (SMTP with test email, Cloudinary credentials), **Audit Log**.
- **Provisioning** (Add Client) and **Add Existing Client** (register without provisioning).
- **Notifications bell:** payment due/overdue, client down, over-limit usage, deploy/backup/provisioning failures, upgrade requests — deduplicated, polled every 60s.
- **Technical constraints:** single-file static HTML/JS dashboard served by the Express server with a strict CSP (`frame-ancestors 'none'`, inline scripts/styles allowed because the UI wires buttons through inline `onclick=` handlers — do not remove `scriptSrcAttr`). Dark slate/blue palette defined in CSS custom properties. The UI must keep working without a build step.
- **Undecided:** no roadmap for the dashboard beyond what exists in ROADMAP.md; treat feature plans there as open decisions, not commitments.

## Brand Commitments

- The product name is **Gear&Glitch**; the control plane is its operations face, branded in the header and login.
- The incumbent visual world is the code as it stands: dark slate surfaces on a near-black background with blue primary actions and green/amber/red semantic states. The operator confirmed there are no external brand specs or constraints beyond what the code reflects.
- Voice is plain operator language (clear labels, status colors, confirmation dialogs); the README and UI copy are the current tone of record.

## Evidence on Hand

- `control-plane/README.md` — the authoritative operational manual (tabs, endpoints, provisioning, auth, schema).
- `control-plane/public/index.html` — the full dashboard implementation.
- `control-plane/server/index.ts`, `db.ts`, `provision.ts` — API, schema, and provisioning logic.
- `README.md` (root), `ROADMAP.md`, `ACTION_ITEMS.md` — product and roadmap context.
- No customer testimonials, press, or case-study assets exist for the control plane; future work must not fabricate them.

## Product Principles

1. **One pane, complete.** Every tenant lifecycle action — provision, monitor, bill, deploy, back up, audit — is reachable from the board without leaving the flow.
2. **Health and money surface first.** Down clients, overdue payments, and over-limit usage must be visible at a glance and stay quiet when all is well.
3. **High-impact actions demand intent.** Provision, suspend, and delete are destructive or one-way; they need confirmation and always land in the audit log.
4. **Automation, not noise.** The system already reminds, suspends, and backs up; the UI's job is to let the operator handle exceptions decisively, never to make the operator re-check what automation already did.
5. **Orientation on arrival.** Because sessions are infrequent, state (subscription, health, payment windows) must be legible without hovering, scrolling, or recall.
