ALTER TABLE serial_numbers
  ADD COLUMN IF NOT EXISTS serial_kind TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS asset_tag TEXT;

ALTER TABLE serial_numbers
  DROP CONSTRAINT IF EXISTS serial_numbers_serial_kind_check;
ALTER TABLE serial_numbers
  ADD CONSTRAINT serial_numbers_serial_kind_check
    CHECK (serial_kind IN ('manufacturer', 'legacy'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_serial_numbers_asset_tag_unique
  ON serial_numbers (LOWER(BTRIM(asset_tag)))
  WHERE asset_tag IS NOT NULL AND BTRIM(asset_tag) <> '';

ALTER TABLE repair_tickets
  ADD COLUMN IF NOT EXISTS serial_id INTEGER;

ALTER TABLE repair_tickets
  DROP CONSTRAINT IF EXISTS repair_tickets_serial_id_fkey;
ALTER TABLE repair_tickets
  ADD CONSTRAINT repair_tickets_serial_id_fkey
    FOREIGN KEY (serial_id) REFERENCES serial_numbers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_repair_tickets_serial_id ON repair_tickets(serial_id);

-- Link only when the ticket's serial resolves to exactly one sold unit on its
-- recorded order line. Ambiguous and non-ledger legacy values remain untouched.
WITH matches AS (
  SELECT t.id AS ticket_id, MIN(sn.id) AS serial_id
    FROM repair_tickets t
    JOIN serial_numbers sn
      ON sn.serial_number = BTRIM(t.serial_number)
     AND sn.order_item_id = t.order_item_id
     AND sn.status = 'sold'
   WHERE t.serial_id IS NULL
     AND BTRIM(COALESCE(t.serial_number, '')) <> ''
   GROUP BY t.id
  HAVING COUNT(*) = 1
)
UPDATE repair_tickets t
   SET serial_id = matches.serial_id
  FROM matches
 WHERE t.id = matches.ticket_id;
