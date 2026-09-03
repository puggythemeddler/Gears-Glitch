-- Migration: customer_assets and service_history tables
-- Description: Adds tables to track customer-owned serialized assets and a
--   historical record of services performed against them (e.g. inspections,
--   maintenance, or repairs).

CREATE TABLE IF NOT EXISTS customer_assets (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL DEFAULT '',
  serial_number TEXT NOT NULL DEFAULT '',
  purchase_date TEXT,
  warranty_expires TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_customer_assets_customer ON customer_assets(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_assets_serial ON customer_assets(serial_number);

CREATE TABLE IF NOT EXISTS service_history (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  asset_serial_number TEXT,
  service_type TEXT NOT NULL DEFAULT '',
  reference_id TEXT,
  description TEXT NOT NULL DEFAULT '',
  serviced_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_service_history_customer ON service_history(customer_id);
