-- Migration: branch attribution + repair-warranty linking + delete integrity
-- Desc:
--   1) Fold runtime boot ALTERs (stock_movements.branch_id, stock_take_sessions.branch_id)
--      into a versioned migration so clean installs no longer depend on boot DDL.
--   2) Add branch attribution to quotes, purchase_orders, repair_tickets, warranty_claims.
--   3) Repair the repair-warranty link: warranty_claims.repair_ticket_id becomes TEXT
--      matching repair_tickets.id (TEXT PRIMARY KEY) with a real FK. Existing rows are
--      cast to TEXT and the FK is added NOT VALID so previously-unmatchable integer
--      values do not block the migration.
--   4) Restore RESTRICT deletion semantics for sales/inventory history (order_items,
--      stock_levels) so DELETE /api/products/:id returns 409 "deactivate instead"
--      instead of silently cascading historical rows away.

-- Fold boot-time per-branch ALTERs into the versioned path (idempotent).
ALTER TABLE stock_movements     ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE stock_take_sessions ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

-- Branch attribution for quotes / purchase orders / repairs / warranty claims.
ALTER TABLE quotes          ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE repair_tickets  ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE warranty_claims ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

-- Repair-warranty link: TEXT column matching repair_tickets.id, carved FK.
ALTER TABLE warranty_claims ALTER COLUMN repair_ticket_id TYPE TEXT USING (repair_ticket_id::text);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warranty_claims_repair_ticket_id_fkey') THEN
    ALTER TABLE warranty_claims DROP CONSTRAINT warranty_claims_repair_ticket_id_fkey;
  END IF;
END $$;
ALTER TABLE warranty_claims ADD CONSTRAINT warranty_claims_repair_ticket_id_fkey
  FOREIGN KEY (repair_ticket_id) REFERENCES repair_tickets(id) ON DELETE SET NULL NOT VALID;

-- Backfill branch on existing warranty claims from the sale that produced them
-- (claim serial -> order_items.serial_number -> orders.branch_id).
UPDATE warranty_claims wc
SET branch_id = o.branch_id
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE oi.serial_number = wc.serial_number
  AND wc.branch_id IS NULL
  AND o.branch_id IS NOT NULL;

-- Restore RESTRICT semantics (undo any historical CASCADE) so product deletion
-- never silently destroys sales/inventory history.
DO $$
DECLARE con_name text;
BEGIN
  SELECT con.conname INTO con_name FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
    WHERE con.conrelid = 'order_items'::regclass
      AND con.confrelid = 'products'::regclass AND a.attname = 'product_id' LIMIT 1;
  IF con_name IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = con_name AND confdeltype = 'r') THEN
    EXECUTE format('ALTER TABLE order_items DROP CONSTRAINT %I', con_name);
    ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
  ELSIF con_name IS NULL THEN
    ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
DECLARE con_name text;
BEGIN
  SELECT con.conname INTO con_name FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
    WHERE con.conrelid = 'stock_levels'::regclass
      AND con.confrelid = 'products'::regclass AND a.attname = 'product_id' LIMIT 1;
  IF con_name IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = con_name AND confdeltype = 'r') THEN
    EXECUTE format('ALTER TABLE stock_levels DROP CONSTRAINT %I', con_name);
    ALTER TABLE stock_levels ADD CONSTRAINT stock_levels_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
  ELSIF con_name IS NULL THEN
    ALTER TABLE stock_levels ADD CONSTRAINT stock_levels_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Indexes for the new branch-filtered report paths.
CREATE INDEX IF NOT EXISTS idx_quotes_branch           ON quotes(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch  ON purchase_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_repair_tickets_branch   ON repair_tickets(branch_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_branch  ON warranty_claims(branch_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_repair  ON warranty_claims(repair_ticket_id);