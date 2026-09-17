-- 0014_order_branch_and_serial_integrity.sql
-- BN2/BN3: push branch attribution to the write + backfill layer, additive only.
--
--   1. Backfill NULL-branch POS orders in a single-branch shop (no ambiguity)
--      so branch reporting is never silently wrong for legacy POS sales.
--   2. Index orders(branch_id) — the daily branch-of-sale report filter.
--   3. Re-attribute stock_movements that referenced an order but carried no
--      branch (e.g. legacy POS sale/reserve movements) to the order's branch.
--
-- All statements are guarded/idempotent; safe on fresh and existing databases.

UPDATE orders o
SET branch_id = (SELECT id FROM branches ORDER BY id LIMIT 1)
WHERE o.branch_id IS NULL
  AND o.source = 'pos'
  AND (SELECT COUNT(*) FROM branches) = 1;

CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id);

UPDATE stock_movements m
SET branch_id = o.branch_id
FROM orders o
WHERE m.reference_type = 'order'
  AND m.reference_id = o.id::text
  AND m.branch_id IS NULL
  AND o.branch_id IS NOT NULL;