# Browser QA — Lipa Mdogo Mdogo (Gears&Glitch)

**Date:** 2026-10-04
**Scope:** Real-browser end-to-end verification of the Lipa Mdogo Mdogo financing integration, entitlement/activation layers, and deactivation semantics.
**Result:** 29 PASS · 3 FAIL · 0 BLOCKED · 0 NOT TESTED. All 3 failures trace to **one** genuine defect (D1). A second defect (D2) was confirmed earlier via the same environment.
**No application code was modified.** QA was executed with `puppeteer-core` + system Chrome (Playwright is not installed in this repo).

---

## 1. Environment & Method

| Item | Value |
|---|---|
| Backend | Local `server/index.ts` (tsx) on `127.0.0.1:8020`, `NODE_ENV=development` |
| Database | Local embedded Postgres 18.4, DB `gg_qa2` (fresh) |
| Frontend | `next dev -p 3000` with `BACKEND_URL=http://localhost:8020` (dev server reads env at runtime) |
| Browser driver | `puppeteer-core` + system Chrome (Playwright is NOT installed in this repo) |
| Rate limits | Raised for QA via `API_RATE_MAX=100000`, `AUTH_RATE_MAX=1000` |

State is reset between runs by deleting the `financing_config` and `featureOverrides` rows in the `settings` table (defaults: financing disabled + no overrides).

---

## 2. Test Matrix

| # | Test | Result | Evidence / Notes |
|---|---|---|---|
| 1 | Storefront home loads | PASS | `200`, title renders |
| 2 | Financing disabled by default | PASS | `options.enabled=false`, `entitled=false` |
| 3 | Product catalog reachable | PASS | 36 products |
| 4 | Product page hides financing CTA when OFF | PASS | no CTA text |
| 5 | Admin login | PASS | `200`, JWT issued |
| 6 | Admin financing nav hidden when OFF | PASS | not in DOM |
| 7 | Grant entitlement override (`Lipa Mdogo Mdogo`) | PASS | `200 {ok:true}` |
| 8 | Activate financing (tenant switch) | PASS | `200 {enabled:true}` |
| 9 | `financing.enabled` after activation+entitlement | PASS | enabled + configured + entitled |
| 10 | Admin Lipa Mdogo Mdogo page renders when ON | PASS | heading found via real nav |
| 11 | Website Studio palette exposes Financing section | PASS | layout created via prompt dialog, palette group rendered |
| 12 | Customer registration | PASS | `200`, customer id resolved |
| 13 | Create + submit financing application | PASS | `201` |
| 14 | Approve application creates agreement | PASS | agreement object returned |
| 15 | Agreement visible in admin financing UI | PASS | found |
| 16 | Record cash payment on agreement | PASS | `201` |
| 17 | Deactivate financing | PASS | `200` |
| 18 | Deactivation BLOCKS new financing | PASS | `403 Financing is not enabled for this store.` (intended) |
| 19 | Existing agreement preserved after deactivation (staff) | PASS | still listed |
| 20 | Servicing (payment) still allowed after deactivation | PASS | `201` |
| 21 | Customer portal still shows agreement after deactivation | **FAIL** | `GET /api/financing/my/agreements` → `500` (D1) |
| 22 | Customer `/financing` page renders after deactivation | PASS | page renders (API fails, D1) |
| 23 | Re-activate financing | PASS | `200` |
| 24 | Responsive storefront (desktop/tablet/mobile) | PASS | 3 viewports captured |
| 25 | POS page renders with financing ON | PASS | |
| 26 | Staff console errors | PASS | only expected 403s |
| 27 | Staff failed/5xx requests | PASS | none |
| 28 | Staff 4xx API responses (expected 403s excluded) | PASS | only expected 403s |
| 29 | Customer console errors | **FAIL** | `500 Internal Server Error` (D1) |
| 30 | Customer failed/5xx requests | **FAIL** | `HTTP 500 /api/financing/my/agreements` (D1) |
| 31 | Customer 4xx API responses | PASS | none |

Expected/intentional responses excluded from the 4xx checks: `403 GET /api/repairs` (plan lacks the "Repair ticketing" entitlement — correct) and `403 POST /api/financing/applications` (the deliberate post-deactivation block test).

---

## 3. Defects

### D1 — Customer financing agreements list always returns 500 (HIGH)
**Symptom:** The customer portal cannot load the customer's agreements. `GET /api/financing/my/agreements` → `500`. Also breaks the admin agreements list whenever a filter is used (`?status=`, `?customerId=`, `?branchId=`).

**Repro:**
1. Enable financing (entitlement + activation) and create/approve an application → agreement exists.
2. As the owning customer: `GET /api/financing/my/agreements` (or open `/financing`).

**Expected:** `200` with the customer's agreements.
**Actual:** `500 Internal Server Error`.
**Server log:** `[Error] there is no parameter $1`

**Root cause:** `server/financing/service.ts:449` `listAgreements()` builds a `params` array and interpolates placeholders (`customer_id = $1`), but calls the query without passing `params`:

```ts
// server/financing/service.ts:457  (BUG: params omitted)
const rows = await queryAll(`SELECT * FROM financing_agreements ${where} ORDER BY created_at DESC LIMIT ${limit}`) as any[];
```

`queryAll(text, params?)` (`server/db-helpers.ts:45`) supports params; they are simply not supplied. Any non-empty filter therefore produces an unbound `$1`.
- Customer path: `server/routes/financing.ts:361-363` → `listAgreementsForCustomer()` → `listAgreements({ customerId })` → always fails.
- Admin path: `server/routes/financing.ts:286-292` → fails for any of `status`/`customerId`/`branchId`; only the unfiltered list works.

**Fix (not applied):** pass `params` as the second argument to `queryAll`.

---

### D2 — Fresh installs seed roles without `financing:*` permissions (HIGH)
**Symptom:** On a clean database, `admin`/`owner`/`manager` receive **no** `financing:view|manage|approve|payment` permissions, so financing admin actions fail with `403 {"error":"Missing permission: financing:manage"}` (e.g. `PUT /api/admin/financing/activation`).
**Root cause:** `server/db.ts:994` `initRolesAsync()` has its own `DEFAULT_ROLES` copy that omits the four `financing:*` permissions. `server/permissions.ts:85-101` defines the correct set (including `financing:*`) but its `initRoles()` (`permissions.ts:155`) is dead code — never called.
**Evidence:** admin role had 50 `role_permissions`, none `financing:*`; live 403 above.
**Workaround used for QA only (not a fix):** inserted the four permissions into `user_permissions` for user id 1.
**Fix (not applied):** make `initRolesAsync()` seed the same financing permissions (or delegate to the single shared source).

---

## 4. Environment Limitations (not PASS — not verified)
- **Live M-Pesa/Daraja callback:** sandbox credentials unavailable → live STK/callback flow NOT VERIFIED.
- **PDF/document downloads locally:** `@sparticuz/chromium` cannot warm up (`spawn ...chromium ENOENT`) → PDF-format downloads not verifiable locally (HTML document endpoints still work).
- **Deployed environment authenticated flows:** `https://gears-glitch.vercel.app` and the Render control plane are reachable (`/api/health` 200) but no test/admin credentials are available → authenticated flows there NOT VERIFIED.
- **Playwright:** not installed/configured; QA executed with `puppeteer-core` + system Chrome instead.

---

## 5. Verdict
- Entitlement, activation, and branch layers behave as separate layers; activation gating works; **deactivation blocks NEW financing while preserving existing agreements, payments, and history** — verified end-to-end.
- The only functional break is **D1** (customer agreements list 500), which is a one-line parameter-passing bug. **D2** blocks financing administration on fresh installs.
- Neither defect was fixed, per scope.
