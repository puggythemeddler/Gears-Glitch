ALTER TABLE repair_tickets
  ADD COLUMN IF NOT EXISTS order_item_id INTEGER REFERENCES order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_kind TEXT NOT NULL DEFAULT 'diagnosis_repair';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'repair_tickets_service_kind_check'
  ) THEN
    ALTER TABLE repair_tickets
      ADD CONSTRAINT repair_tickets_service_kind_check
      CHECK (service_kind IN ('diagnosis_repair', 'planned_service'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_repairs_order_item ON repair_tickets(order_item_id);
