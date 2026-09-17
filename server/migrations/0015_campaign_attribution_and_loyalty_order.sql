-- 0015_campaign_attribution_and_loyalty_order.sql
-- Campaign attribution + loyalty order-link columns were previously delivered only
-- via schema.sql's CREATE TABLE ... IF NOT EXISTS plus a boot-time ADD COLUMN that
-- runs AFTER runSchema. On ANY existing database (e.g. production) runSchema's
--   CREATE INDEX ... ON orders(campaign_id)
-- threw `column "campaign_id" does not exist` BEFORE the boot DDL could add the
-- column — a permanent boot stalemate (every deploy crash-loops on the same line).
-- The equivalent schema.sql indexes have been removed; this migration owns the
-- columns AND their indexes for both fresh and existing databases.
--
-- All statements are guarded/idempotent. Note the legacy boot ADD COLUMN lines for
-- these two columns remain as harmless no-ops (IF NOT EXISTS) after this applies.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS campaign_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_orders_campaign ON orders(campaign_id);

ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS order_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_order ON loyalty_transactions(order_id);