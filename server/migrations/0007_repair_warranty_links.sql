-- Migration: link repairs to serialized devices and warranty claims (R-4).
-- Description: Adds columns to repair_tickets so repairs can reference the
--   serialized device being repaired and any associated warranty claim, and to
--   distinguish warranty vs paid repairs. Idempotent / additive.

ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS serial_number TEXT NOT NULL DEFAULT '';
ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS is_warranty_repair INTEGER NOT NULL DEFAULT 0;
ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS warranty_claim_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_repairs_serial ON repair_tickets(serial_number);
