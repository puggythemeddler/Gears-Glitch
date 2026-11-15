ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS batch_id TEXT;

CREATE INDEX IF NOT EXISTS idx_stock_transfers_batch
  ON stock_transfers(batch_id, id)
  WHERE batch_id IS NOT NULL;
