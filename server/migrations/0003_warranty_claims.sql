-- Migration: warranty_claims table
-- Description: Adds a table to track customer warranty claims against serialized
--   products sold through the store, along with a basic claim lifecycle.

CREATE TABLE IF NOT EXISTS warranty_claims (
  id SERIAL PRIMARY KEY,
  warranty_ref TEXT NOT NULL,
  customer_id INTEGER,
  serial_number TEXT,
  repair_ticket_id INTEGER,
  status TEXT NOT NULL DEFAULT 'submitted',
  claim_date TEXT NOT NULL DEFAULT (NOW()::text),
  resolution_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  approved_by INTEGER
);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_customer ON warranty_claims(customer_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_serial ON warranty_claims(serial_number);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_status ON warranty_claims(status);
