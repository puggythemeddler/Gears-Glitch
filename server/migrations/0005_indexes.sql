-- Migration: add targeted indexes for hot query columns (DB-2).
-- Description: Additive, idempotent indexes only — safe on existing production
--   databases. Improves order list/report filtering, serial lookups and
--   stock-movement referencing without changing any table structure.

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_order ON serial_numbers(order_id);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_order_item ON serial_numbers(order_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON stock_movements(reference_type, reference_id);
