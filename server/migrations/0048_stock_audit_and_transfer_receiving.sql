ALTER TABLE stock_take_items ADD COLUMN IF NOT EXISTS variance_reason TEXT;

ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS dispatched_by INTEGER REFERENCES users(id);
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS received_by INTEGER REFERENCES users(id);
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS dispatched_at TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS received_at TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS dispatch_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS receive_notes TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS stock_disposals (
  id SERIAL PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL CHECK (reason IN ('damaged', 'expired', 'missing', 'theft', 'recalled', 'other')),
  notes TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE IF NOT EXISTS stock_transfer_serials (
  transfer_id INTEGER NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  serial_id INTEGER NOT NULL REFERENCES serial_numbers(id) ON DELETE RESTRICT,
  PRIMARY KEY (transfer_id, serial_id)
);

CREATE TABLE IF NOT EXISTS stock_disposal_serials (
  disposal_id INTEGER NOT NULL REFERENCES stock_disposals(id) ON DELETE CASCADE,
  serial_id INTEGER NOT NULL REFERENCES serial_numbers(id) ON DELETE RESTRICT,
  PRIMARY KEY (disposal_id, serial_id),
  UNIQUE (serial_id)
);
