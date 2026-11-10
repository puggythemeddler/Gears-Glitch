-- Track renewal terms against the fulfilled license sale, independently from
-- repair estimates. Existing sale lines remain unknown until an admin reviews them.
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS license_renewal_type TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS license_expires_at TEXT;
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS license_notes TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_order_items_license_expiry
  ON order_items(license_renewal_type, license_expires_at)
  WHERE cancelled = 0;
