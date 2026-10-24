-- Prevent scheduled renewal retries from creating duplicate invoices.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS generation_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_generation_key_uq
  ON invoices(generation_key)
  WHERE generation_key IS NOT NULL;
