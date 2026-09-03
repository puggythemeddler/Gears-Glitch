# DATABASE_MIGRATIONS.md

**Schema and migration architecture for Gears&Glitch.** Phase 0 audit — documents the current model and the required changes. **No schema was modified.**

---

## 1. Current migration architecture

The database layer is raw PostgreSQL accessed through parameterized queries in `server/db.ts` (via `pg` Pool helpers in `server/db-helpers.ts`).

Two mechanisms run at **every server boot**:
1. `runSchema()` — applies `server/schema.sql` (873 lines, `CREATE TABLE IF NOT EXISTS`, idempotent).
2. `runMigrations()` — `server/db.ts:659-930`: ~270 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements, each wrapped in `try/catch {}` that swallows errors.

Plus a single migration file `server/migrations/001_whatsapp_tables.sql` that is **never loaded** by any runner.

### Assessment against Phase 19 requirements
| Requirement | Status |
|---|---|
| Migrations versioned | ❌ No version/tracking table (`schema_migrations` absent) |
| Migrations deterministic | ❌ Boot-time ALTER loop, non-ordered, `IF NOT EXISTS` implies best-effort |
| Production DBs upgrade safely | ⚠️ Idempotent but silent failures leave inconsistent partial schema |
| Fresh DBs reach same schema | ⚠️ Generally yes (all `IF NOT EXISTS`) but drift across tenants possible |
| Rollback/recovery possible | ❌ No down-migrations; no version map |
| Migration mannaged/documented | ❌ Fragmented (`schema.sql` + inline ALTERs + unused file) |

**Findings:**
- **P1 (M-1):** No version tracking; ~270 statements run per boot; each in its own autocommit transaction; `catch {}` silently hides failures; partial failure → half-migrated schema with no rollback.
- **P3 (M-2):** `server/migrations/001_whatsapp_tables.sql` is dead/unwired.
- **Recommended:** a versioned migration runner (tracking table, or `node-pg-migrate`), each migration transactional, record version, fail loudly on error. This is a **high-risk change requiring approval** (DB architecture/migrations).

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
