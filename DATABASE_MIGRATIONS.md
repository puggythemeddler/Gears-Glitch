# DATABASE_MIGRATIONS.md

**Schema and migration architecture for Gears&Glitch.** Originated as the Phase 0 audit document. Since then the schema has been remediated in phases (`order_items`/`stock_levels` are now `ON DELETE RESTRICT`, per-branch stock/attribution columns exist) and the versioned migration runner is live — see §1 and the update log at the end. **`server/schema.sql` and the `server/migrations/` set have been modified; this doc is maintained, not frozen.**

---

## 1. Current migration architecture

The database layer is raw PostgreSQL accessed through parameterized queries in `server/db.ts` (via `pg` Pool helpers in `server/db-helpers.ts`).

Two mechanisms run at/after **server boot**:
1. `runSchema()` — applies `server/schema.sql`. This is the **cumulative definition of the final schema**: `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` (idempotent), plus the money columns declared as `NUMERIC(12,2)`. A FRESH database reaches the exact fully-migrated state from this file alone.
2. `runVersionedMigrations()` — the **canonical, versioned runner** (`server/db.ts`): every file matching `/^\d{4}_.+\.sql$/` in `server/migrations/` is applied in lexicographic order, each in its own transaction, and recorded in `schema_migrations` so a later boot never re-runs an applied migration. Existing databases are converged to the schema.sql state by `0020_legacy_schema_reconciler.sql`; all new schema changes must go through the versioned runner.

> **Update (Final reconciliation):** the legacy boot-time `runMigrations()` (a ~750-line `try/catch`-wrapped drift guard that silently mutated every database on every start) has been **removed**. Its DDL is now declared in `schema.sql` (fresh) and mirrored idempotently in `0020_legacy_schema_reconciler.sql` (existing databases); its one-time data backfills/seeds moved into 0020 (as exception-guarded, once-only operations) or into named, guard-based boot seed functions (`seedGroupsFromCategories`, `seedClientsRow`, `curatePlanFeatures`, `initRolesAsync`). No boot path mutates the schema anymore. Current set: `0001`–`0020`.

### Assessment against Phase 19 requirements
| Requirement | Status |
|---|---|
| Migrations versioned | ✅ `schema_migrations` tracking table + ordered `0001`–`0020` files |
| Migrations deterministic | ✅ Versioned migrations apply once, in order, transactionally; legacy boot ALTER loop removed |
| Production DBs upgrade safely | ✅ Versioned runner fails loudly + records version; 0020 combined every pre-existing idempotent statement into one tracked, once-only migration |
| Fresh DBs reach same schema | ✅ schema.sql declares the full cumulative schema; verified by the DB-gated `legacy-reconciler` integration suite |
| Rollback/recovery possible | ❌ No down-migrations; forward-only (as before) |
| Migration managed/documented | ✅ Runner + version table live; this doc kept current |

**Findings (Phase 0, context):**
- **P1 (M-1):** versioned runner now exists (`server/db.ts:653-693`) — see §1 update.
- **P3 (M-2):** dead `001_whatsapp_tables.sql` claim resolved — the file is now `0001_whatsapp_tables.sql` and **is** loaded by the runner.

---

## 2. Schema audit — key findings (references to `server/schema.sql`)

### 2.1 Stock dual-tracking mismatch (P1, DB-1)
- `stock_levels.product_id TEXT NOT NULL UNIQUE` — **UNIQUE on `product_id` alone** conflicts with branch-level stock queries that use `branch_id`. Must be `UNIQUE(product_id, branch_id)`.

### 2.2 Money representation — SYSTEMIC P0 (§8 of audit)
- **Phase 0 finding:** All ~37 monetary columns were `DOUBLE PRECISION` — no `NUMERIC`/integer-cents anywhere.
- **Resolution:** `0002_money_numeric.sql` (applied) converted the original ~37 columns to `NUMERIC(12,2)`; `0020` converts the 7 remaining columns that were only ever created by the removed `runMigrations()` (`products.cost_price`/`sale_price`, `orders.vat_amount`/`tendered_amount`, `order_items.unit_cost`, `quotes.discount_value`, `quote_items.discount_value`). schema.sql now declares all of them as `NUMERIC(12,2)`, and the `pg` NUMERIC parser in `server/db-helpers.ts` keeps them flowing to JS as numbers.

### 2.3 Missing indexes (P1, DB-2)
- `orders(status)`, `orders(branch_id)`, `orders(created_at)` — heavy list/report filters.
- `serial_numbers(order_id)`, `serial_numbers(order_item_id)`.
- `stock_movements(reference_type, reference_id)` (composite).
- `messages` unread-count composite.

### 2.4 Missing foreign keys (P1, DB-3)
- `orders.coupon_id`, `orders.gift_card_id`
- `serial_numbers.purchase_order_item_id`
- `repair_parts_used.product_id`
- `credit_notes.created_by`, `credit_note_items.order_item_id`/`product_id`

### 2.5 Destructive cascades (P1, DB-4)
- `order_items.product_id ON DELETE CASCADE` — deleting a product wipes financial history.
- `stock_levels.product_id ON DELETE CASCADE` — wipes stock history.
- `repair_updates.ticket_id ON DELETE CASCADE` — wipes repair history.
→ Use `ON DELETE RESTRICT` + explicit archival.

### 2.6 Unique constraints (P2, DB-5)
- `cart_recovery_reminders(customer_id, order_id)` — no unique constraint.

### 2.7 Serial-number schema (Phase 10)
- `serial_numbers.serial_number TEXT UNIQUE` ✓ (no duplicates).
- `status` has no CHECK; no `customer_id` (ownership indirect via order); no FK on `purchase_order_item_id`; PO receive inserts serials in a loop without transaction (P1).

---

## 3. Missing functional models (Phase 17/18) — no schema exists

| Model | Table | Status |
|---|---|---|
| Warranty claims | `warranty_claims` | **MISSING** (P0, Phase 17) |
| Customer assets | `customer_assets` | **MISSING** (P0, Phase 18) |
| Service history | `service_history` | **MISSING** (P0, Phase 18) |

Proposed (for approval when implementing Phase 17/18):
- `warranty_claims(id, warranty_ref, customer_id, serial_number, repair_ticket_id, status, claim_date, resolution_date, notes, approved_by)`
- `customer_assets(id, customer_id, product_id, serial_number, purchase_date, warranty_expires, notes)`
- `service_history` — aggregate/materialized join of repairs, warranty claims, and serials per customer.

Repairs also need `serial_number`/`warranty_claim_id`/`is_warranty_repair` columns to link the lifecycle and distinguish warranty vs paid repairs (P1).

---

## 4. Subscriptions schema (Phase 18)

- `subscription_plans` (features as JSON text — P2, no validation of feature names).
- `provider_plan_assignments`, `branch_subscriptions`, `subscription_requests`, `invoices` exist.
- **P1 (SU-1):** `branch_subscriptions.expires_at` is **never populated** → expiry never enforced.

---

## 5. Migration execution plan (proposed, approval-gated)

Ranked safe sequence:
1. Add indexes + FKs + change cascades (P1, non-destructive additive).
2. `stock_levels` UNIQUE → `(product_id, branch_id)` (P1; needs data dedup check for existing duplicate product rows).
3. Add `warranty_claims` / `customer_assets` / `service_history` tables (P0 feature tables).
4. **Money: `DOUBLE PRECISION` → integer-cents/NUMERIC (P0, HIGH RISK, approval)** — requires audit of every SQL arithmetic/comparison on monetary columns and frontend `formatPrice` consistency; run under the Change-Safety Protocol with a data backup + rollback plan.

Every step must go through the versioned migration runner (step 1 of §2) so production upgrades are deterministic and reversible.

---

## 6. Backups & restore runbook (operator, DR-verify pending)

> **State:** the backup row of `PRODUCTION_SCORECARD.md` stays **0/3** — this
> covers the operator **procedures only**. The control plane creates real
> artifacts (`pg_dump --dburl | gzip` per active client, `control-plane/backups/`,
> 7-day retention enforced by mtime prune, admin-only list/download) but there is
> **no in-app restore endpoint and no DR verification run yet**. Restore today is
> an **operator action** that replays the same logical dump the operator already
> trusts for onboarding. This is deliberately the documented-but-not-DR-verified
> gap flagged by PRODUCTION_READINESS_AUDIT_FULL.md (L56) and
> PRODUCTION_READINESS_CURRENT.md (L101) -- restore remains the P0 DR follow-up.

### 6.1 What the operator actually has

| Artifact | Location | Format |
|---|---|---|
| Per-client dump | `control-plane/backups/<slug>.sql.gz` | `pg_dump \| gzip` (text SQL, gzip) |
| Retention | 7 days | mtime prune on each `/api/backups/run` and boot |
| Listing | `GET /api/backups` (admin) | `{ files: [{name,size,date}] }` JSON |
| Download | `GET /api/backups/download/:filename` (admin) | `application/gzip` attachment |
| Trigger | `POST /api/backups/run` (admin, guarded, rate-limited) | spawn `pg_dump <url> \| gzip` (argv, no shell) |

### 6.2 Restore procedure (single client)

1. **List** snapshots `GET /api/backups`; pick the newest `<slug>.sql.gz` for the
   client being recovered.
2. **Download** `GET /api/backups/download/<slug>.sql.gz` (admin) -- the filename
   is `path.basename`-guarded so a `../` payload can never escape `backups/`.
3. **Verify the archive before touching the DB** (integrity + no shell artifact):
   - `gzip -t <slug>.sql.gz` (exit 0 = valid gzip stream)
   - `gunzip -c <slug>.sql.gz | grep -c "INSERT INTO"` (sanity: non-empty logical dump)
4. **Restore** into the client's Neon DB (operator shell, same `psql` the
   control plane spawns for `pg_dump`):
   ```
   gunzip -c <slug>.sql.gz | psql "<client_neon_db_url>"
   ```
   `gzip`/`psql` are spawned as **argument arrays, never shell-interpolated**, so
   the Neon URL can never inject a shell command (this is the same hardened path
   as the backup creation: `C-2`/`T-0` remediation applied in 2026-09-24).
5. **Verify the restore** -- the logical dump replays DDL (idempotent
   `IF NOT EXISTS` everywhere) plus rows; confirm:
   - `psql` exits 0 with **no** `ERROR:` lines in the tail of stderr
   - a spot-check query returns rows: `SELECT count(*) FROM orders;`
   - `SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 8;`
     shows the applied head (0020) post-restore

### 6.3 Honest boundary

- **Not DR-verified.** This runbook documents the restore mechanics that already
  exist (real artifacts, hardened spawn, guarded download), but no automated
  restore test or off-box restore-verify has been run -- exactly as
  PRODUCTION_READINESS_CURRENT.md:101 states. Schedule a quarterly **DR restore
  drill** that restores `/tmp` artifacts into a scratch Neon branch and confirms
  the `schema_migrations` head before trusting this as verified.
- **Single-client only.** There is no cross-tenant aggregate dump; each client is
  backed up and restored independently, matching the per-tenant Neon-provisioning
  model. `cp_users`/`clients` (the control plane's own metadata) are **not** part
  of the tenant dumps -- restoring those means restoring the CP DB itself from a
  Neon point-in-time or the CP's own Neon backup (operator procedure, same steps).

---
## Update log (post-Phase 0)

| Version | Migration | Purpose |
|---|---|---|
| 0001 | whatsapp tables | whatsapp_media + webhook storage |
| 0002 | money numeric | monetary columns → NUMERIC |
| 0003 | warranty_claims | warranty claim table |
| 0004 | assets & service history | customer_assets / service_history |
| 0005 | indexes | missing report/list indexes |
| 0006 | stock_levels unique | per-branch uniqueness |
| 0007 | repair warranty links | repair ↔ warranty wiring |
| 0008 | fk integrity | order_items/stock_levels product FK RESTRICT |
| 0009 | warranty coverage | warranty metadata on order items |
| 0010 | order items warranty expiry | snapshot at sale |
| 0011 | audit traceability | audit_log actor columns |
| 0012 | subscription expiry | branch_subscriptions expiry |
| 0013 | branch attribution + repair link | per-branch columns (stock_movements, stock_take_sessions, quotes, purchase_orders, repair_tickets, warranty_claims); `warranty_claims.repair_ticket_id` → TEXT + FK |
| 0014 | order branch + serial integrity | backfill single-branch POS orders, `idx_orders_branch_id`, reattribute order movements; BN2/BN3 |
| 0015 | campaign attribution + loyalty order | `orders.campaign_id`, `loyalty_transactions.order_id` (+ indexes) |
| 0016 | invoice number sequence | `order_invoice_number_seq` for monotonic INV-XXXXX numbers |
| 0017 | pages | storefront pages tables |
| 0018 | integrations | integrations + configuration tables |
| 0019 | integrations indexes | lookup indexes on integration tables |
| 0020 | legacy schema reconciler | the removed `runMigrations()` cumulative schema: `splashes`/`email_logs`/`notification_log`/`storefront_layouts`/`branch_subscriptions`, 29 legacy columns, 15 indexes, remaining 7 money columns → `NUMERIC(12,2)`, and the one-time backfills/seeds (VAT snapshot, unit cost, sort orders, source reclassification, plan pricing/features, settings defaults, repair types, layout seeds, sequence alignment) — all idempotent and exception-guarded |

Current applied head: **0020**. Check `SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;`.
