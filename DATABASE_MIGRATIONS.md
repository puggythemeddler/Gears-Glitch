# DATABASE_MIGRATIONS.md

**Schema and migration architecture for Gears&Glitch.** Originated as the Phase 0 audit document. Since then the schema has been remediated in phases (`order_items`/`stock_levels` are now `ON DELETE RESTRICT`, per-branch stock/attribution columns exist) and the versioned migration runner is live — see §1 and the update log at the end. **`server/schema.sql` and the `server/migrations/` set have been modified; this doc is maintained, not frozen.**

---

## 1. Current migration architecture

The database layer is raw PostgreSQL accessed through parameterized queries in `server/db.ts` (via `pg` Pool helpers in `server/db-helpers.ts`).

Three mechanisms run at/after **server boot**:
1. `runSchema()` — applies `server/schema.sql` (`CREATE TABLE IF NOT EXISTS`, idempotent).
2. `runVersionedMigrations()` — the **canonical, versioned runner** (`server/db.ts:653-693`): every file matching `/^\d{4}_.+\.sql$/` in `server/migrations/` is applied in lexicographic order, each in its own transaction, and recorded in `schema_migrations` so a later boot never re-runs an applied migration. Current set: `0001`–`0014`.
3. `runMigrations()` — legacy net-new-column drift guard (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `try/catch`-wrapped). Kept only as belt-and-braces for tenants that predate the versioned runner; new schema changes must go through the versioned runner.

> **Update (Phase 2/3):** the earlier claim that migrations are "not run" is obsolete — the versioned runner is active and every applied file is tracked in `schema_migrations`. `0001_whatsapp_tables.sql` → `0014_order_branch_and_serial_integrity.sql` are all wired into the runner.

### Assessment against Phase 19 requirements
| Requirement | Status |
|---|---|
| Migrations versioned | ✅ `schema_migrations` tracking table + ordered `0001`–`0014` files (post-remediation) |
| Migrations deterministic | ⚠️ Versioned migrations apply once, in order, transactionally; legacy boot ALTER loop remains as best-effort drift guard |
| Production DBs upgrade safely | ⚠️ Versioned runner fails loudly + records version; legacy guards idempotent but silent |
| Fresh DBs reach same schema | ✅ One path (`schema.sql` → versioned migrations) per environment |
| Rollback/recovery possible | ❌ No down-migrations; forward-only (as before) |
| Migration managed/documented | ⚠️ Runner + version table live; this doc kept current |

**Findings (Phase 0, context):**
- **P1 (M-1):** versioned runner now exists (`server/db.ts:653-693`) — see §1 update.
- **P3 (M-2):** dead `001_whatsapp_tables.sql` claim resolved — the file is now `0001_whatsapp_tables.sql` and **is** loaded by the runner.

---

## 2. Schema audit — key findings (references to `server/schema.sql`)

### 2.1 Stock dual-tracking mismatch (P1, DB-1)
- `stock_levels.product_id TEXT NOT NULL UNIQUE` — **UNIQUE on `product_id` alone** conflicts with branch-level stock queries that use `branch_id`. Must be `UNIQUE(product_id, branch_id)`.

### 2.2 Money representation — SYSTEMIC P0 (§8 of audit)
- **All ~37 monetary columns are `DOUBLE PRECISION`.** No `NUMERIC`/integer-cents anywhere. Required (approval-gated) migration to `NUMERIC(12,2)` or integer cents, plus JS decimal computation.
- Tables: `products`, `orders`, `order_items`, `subscription_plans`, `provider_plan_assignments`, `invoices`, `order_invoices`, `repair_types`, `repair_tickets`, `repair_parts_used`, `purchase_order_items`, `quotes`, `quote_items`, `coupons`, `coupon_usage`, `price_history`, `credit_notes`, `credit_note_items`, `etims_sales_transactions`, `gift_cards`, `gift_card_redemptions`, `cart_recovery_reminders`, `refunds`.

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

Current applied head: **0014**. Check `SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;`.
