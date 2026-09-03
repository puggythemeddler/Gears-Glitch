-- Migration: DB integrity hardening (DB-3, DB-4, DB-5, SN-1).
--
-- DB-4: convert destructive ON DELETE CASCADE foreign keys to RESTRICT so that
--   deleting a product / ticket that has dependent history or stock fails loudly
--   instead of silently erasing audit/sales/inventory records. Products can be
--   hidden via products.is_active (deactivation is the intended soft-delete path).
-- DB-3: add missing foreign keys. New FKs are added NOT VALID so existing rows are
--   not required to satisfy them (avoids a migration failure on legacy orphan data);
--   they are still enforced for all new writes.
-- DB-5: unique (customer_id, order_id) on cart_recovery_reminders.
-- SN-1: status CHECK on serial_numbers + FK on purchase_order_item_id.
--
-- Each statement is idempotent / guarded. Applied by the versioned runner in order
-- (after 0007) and recorded in schema_migrations.

-- ---- DB-4: CASCADE -> RESTRICT ----
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

ALTER TABLE stock_levels DROP CONSTRAINT IF EXISTS stock_levels_product_id_fkey;
ALTER TABLE stock_levels ADD CONSTRAINT stock_levels_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

ALTER TABLE repair_updates DROP CONSTRAINT IF EXISTS repair_updates_ticket_id_fkey;
ALTER TABLE repair_updates ADD CONSTRAINT repair_updates_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES repair_tickets(id) ON DELETE RESTRICT;

-- ---- DB-3: missing foreign keys (NOT VALID) ----
ALTER TABLE orders ADD CONSTRAINT IF NOT EXISTS orders_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES coupons(id) NOT VALID;
ALTER TABLE orders ADD CONSTRAINT IF NOT EXISTS orders_gift_card_id_fkey FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id) NOT VALID;
ALTER TABLE serial_numbers ADD CONSTRAINT IF NOT EXISTS serial_numbers_purchase_order_item_id_fkey FOREIGN KEY (purchase_order_item_id) REFERENCES purchase_order_items(id) NOT VALID;
ALTER TABLE repair_parts_used ADD CONSTRAINT IF NOT EXISTS repair_parts_used_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) NOT VALID;
ALTER TABLE credit_notes ADD CONSTRAINT IF NOT EXISTS credit_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) NOT VALID;
ALTER TABLE credit_note_items ADD CONSTRAINT IF NOT EXISTS credit_note_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES order_items(id) NOT VALID;
ALTER TABLE credit_note_items ADD CONSTRAINT IF NOT EXISTS credit_note_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) NOT VALID;

-- ---- DB-5: unique reminder per (customer, order) ----
CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_recovery_customer_order ON cart_recovery_reminders(customer_id, order_id) WHERE order_id IS NOT NULL;

-- ---- SN-1: serial status CHECK ----
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'serial_numbers_status_check') THEN
    ALTER TABLE serial_numbers ADD CONSTRAINT serial_numbers_status_check CHECK (status IN ('in_stock','sold','void','reserved'));
  END IF;
END$$;
