-- Migration: first-class warranty expiry on order items (W-4).
-- Description: Snapshots the warranty expiration date onto each warrantied order
--   line at sale time, making warranty a first-class sale event instead of being
--   derived ad hoc at register-read time. Idempotent / additive.

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS warranty_expires TEXT;
