-- Keep stock snapshots independent for each branch while preserving a global
-- snapshot that aggregates stock across all branches.
ALTER TABLE stock_snapshots
  ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;

ALTER TABLE stock_snapshots
  DROP CONSTRAINT IF EXISTS stock_snapshots_snapshot_date_product_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_snapshots_global_unique
  ON stock_snapshots(snapshot_date, product_id)
  WHERE branch_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_snapshots_branch_unique
  ON stock_snapshots(snapshot_date, product_id, branch_id)
  WHERE branch_id IS NOT NULL;
