# Release Readiness Sign-off

Prepared as the Phase J deliverable of the pre-launch security audit.
This document separates **what was verified from code/in-repo evidence** from
**what can only be verified against live infrastructure** (production Neon, Meta,
hosting provider). It does not claim legal compliance.

- Baseline audited: `main` @ `6f4deb1`
- Fixes landed on `main`: `6f6419e`, `5b2985b`, `552e9cd`, `58fb76f`
- Test suite at time of writing: see §6 (full run).

---

## 1. Decision

**CONDITIONALLY READY FOR CONTROLLED PILOT.**

No **P0** (unauthenticated data exposure, trivial RCE, cross-tenant leak in the
shared surface) was found. The one **P1/P2** cluster found — owner-level routes
reachable by a mid-privilege `manager` account with no permission check — has
been fixed and regression-tested. Remaining items are P2/known-gaps that require
an **operator or legal decision**, not further code discovery, and are listed in
§4/§5.

Do **not** treat this as a green light for unrestricted public launch until the
gates in §5 are closed.

---

## 2. Scope & method

Audited repo: `server/` (Express-style backend), `frontend/` (Next.js 14 Pages
Router storefront), `control-plane/` (multi-tenant admin), migrations, CI,
docs. Method: static source review of routes/middleware/auth/permissions,
migration runner, uploads, media policy and WhatsApp paths; targeted
exploration agents for uploads, tenant isolation and app/API security; direct
re-reads to confirm each finding; fixes implemented with regression tests and
run against a **disposable** PostgreSQL instance.

Tenancy model (verified): **one database per tenant**; isolation is enforced at
the infrastructure boundary (separate DBs/instances). Media tables
(`product_images`, `repair_images`, `stored_images`, `whatsapp_media`) carry no
tenant column; the only shared surface is public Cloudinary URLs / `/uploads`
paths.

---

## 3. Findings register

| # | Severity | Finding | Evidence | Status |
|---|---|---|---|---|
| F1 | **High (P1)** | `GET /api/admin/backup` guarded only by `ownerAuthMiddleware` → a `manager`/provider-with-perms account could dump every table incl. `users.password_hash`, PII and encrypted secrets | `server/index.ts` backup route | **Fixed** `6f6419e` (new `data:backup`, admin/owner only) |
| F2 | Medium (P2) | `GET /api/audit-log` guarded only by `ownerAuthMiddleware` → manager could read the tenant audit trail | `server/index.ts` audit route | **Fixed** `6f6419e` (`audit:view`) |
| F3 | Medium (P2) | `DELETE /api/admin/branches/:id` had step-up auth but no permission (its create/update siblings require `branch:view`) → manager could delete a branch | `server/index.ts` branch routes | **Fixed** `6f6419e` (`branch:view`) |
| F4 | Medium (P2) | Gallery/repair image uploads unbounded server-side (storage/quota abuse, bloated payloads) | `server/index.ts` upload routes | **Fixed** `5b2985b` (env-overridable caps) |
| F5 | Low | `POST /api/admin/about-us/image` uses read permission `about:view` for a write | `server/index.ts` | Open — admin-only, semantic; recommend a write permission |
| F6 | Low/Med | When Cloudinary is configured, `validateUploadedFile` returns true without a magic-byte check (relies on Cloudinary `resource_type:"image"`) | `server/upload.ts` | Open/accepted — document; consider always validating bytes |
| F7 | Low | No malware scanning; no image re-encode/metadata strip | `server/upload.ts` | Open — accepted residual risk |
| F8 | Low | Uploaded asset can be orphaned if the DB insert fails after upload (local unlink only) | upload routes | Open — accepted residual |
| F9 | Info | Cross-tenant isolation relies on one-DB-per-tenant infra, not a tenant column | tenancy model | Documented assumption; keep per-tenant isolation strict |
| F10 | Low | Control-plane returns raw `err.message` to the client in places | `control-plane/**` | Open — admin-only, low |
| F11 | Process | No privacy/terms/cookie surfaces | frontend | **Fixed (drafts)** `552e9cd`; **legal review required** |
| F12 | Process | DR/backup/incident-response undocumented as a single runbook | repo docs | **Fixed (doc)** `58fb76f`; gaps flagged therein |

### Verified controls (no issue found)

- Helmet CSP (`server/index.ts`), `nosniff`, `trust proxy 1`; frontend CSP in `frontend/next.config.js`.
- CSRF token flow, httpOnly same-site cookies, rate limiting, 1 MB JSON body cap.
- Upload path: multer 5 MB limit, `image/*` filter, **SVG rejected**, magic-byte validation on the disk path; SSRF allowlist for backup image fetch (`server/media-policy.ts`).
- WhatsApp: HMAC signature verification, single outbound `/messages` choke point, consent/opt-out enforcement, 24h-window/template-approval rules, template-approval requires `whatsapp:approve`, webhook ledger idempotency.
- Permissions: `requirePermission` is strict (no blanket admin bypass); audit-log/backup now permission-gated.
- Secrets encrypted at rest; migration runner tracks `schema_migrations` and is idempotent.
- No path traversal via upload filename (product IDs are server-generated; targets must exist).

---

## 4. Changes shipped this audit

| Commit | Change |
|---|---|
| `6f6419e` | `fix(security)`: require explicit permissions on `data:backup`, `audit:view`, `branch:view`; new `data:backup` permission seeded to admin/owner; regression test |
| `5b2985b` | `fix(uploads)`: per-item image caps (env-overridable), backend enforcement + UI guidance; tests |
| `552e9cd` | `feat(legal)`: draft privacy/terms pages + cookie-consent banner + `LEGAL_REVIEW_REQUIRED.md`; tests |
| `58fb76f` | `docs`: backup/restore/incident-response runbook |

All changes: server `tsc` clean, frontend `tsc` clean, full test suite green
(§6).

---

## 5. Release gates (must close before public launch)

External / non-code (owner or legal action):

- [ ] **DR**: move tenant backups off the control-plane host (object storage) or
      enable + document Neon PITR; set retention to meet RPO/RTO; schedule the
      quarterly restore drill (`docs/RUNBOOK.md`).
- [ ] **Legal**: fill placeholders in `privacy.tsx`/`terms.tsx`, confirm the
      consent model for the target jurisdiction, and obtain written legal
      sign-off (`LEGAL_REVIEW_REQUIRED.md`).
- [ ] **Secrets**: set `ENCRYPTION_KEY` (≥16 chars, independent of `JWT_SECRET`)
      in production and document the rotation procedure.
- [ ] **Meta/WhatsApp**: verify the live WABA, template approvals and webhook
      with production credentials (cannot be verified from the repo).
- [ ] **Production data**: confirm production Neon has no leftover test/admin
      fixtures and that the admin password is not a default.

Code-adjacent (small follow-ups, not blockers):

- [ ] F5: change about-us image upload to a write permission.
- [ ] F6: always magic-byte-validate uploads even on the Cloudinary path.
- [ ] F10: stop returning raw `err.message` from control-plane routes.

---

## 6. Evidence

- Server typecheck (`npx tsc --noEmit`): clean.
- Frontend typecheck (`frontend` `tsc --noEmit`): clean.
- WhatsApp regression pass (disposable PG, mocked Meta fetch): **53/53** tests
  across consent/opt-out, choke point, window/template rules, signature,
  webhook ledger, template-approval authz.
- Full suite (`npx tsx --test --test-concurrency=1 tests/*.test.ts`) against
  disposable PostgreSQL: see the run recorded for this sign-off (green; counts
  in §6.1).

### 6.1 Final full-suite result

- tests: **733** | suites: **142** | pass: **733** | fail: **0**

---

## 7. Residual risk & rollback

- HTML sanitisation for admin-authored storefront content (about-us, custom
  pages) was not exhaustively reviewed — admins are trusted, but treat any
  admin-authored HTML as a stored-XSS surface.
- Rollback for the shipped fixes: revert the four commits above; the only
  schema-adjacent change is a new **permission row** (`data:backup`) seeded by
  `initRoles` on boot (`ON CONFLICT DO NOTHING`) — no migration, so no down
  migration is required.
