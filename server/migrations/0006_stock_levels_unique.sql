-- Migration: fix stock_levels uniqueness (DB-1) to match the branch-aware code.
-- Description: The old schema declared `product_id TEXT NOT NULL UNIQUE` which
--   allows only ONE row per product — yet the application stores per-branch stock
--   rows and upserts with `ON CONFLICT (product_id, branch_id)`. This migration
--   drops the single-product UNIQUE and replaces it with two partial unique
--   indexes matching the real data model:
--     * one global row per product (branch_id IS NULL)
--     * one row per (product_id, branch_id) (branch_id IS NOT NULL)
--   Existing data needs no dedup: the prior UNIQUE already guaranteed at most one
--   row per product. Pairs cleanly with the I-7 updateStockLevel atomic upserts.

ALTER TABLE stock_levels DROP CONSTRAINT IF EXISTS stock_levels_product_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_levels_global ON stock_levels(product_id) WHERE branch_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_levels_branch ON stock_levels(product_id, branch_id) WHERE branch_id IS NOT NULL;
