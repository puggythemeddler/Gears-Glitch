-- Serialized inventory must be able to leave a source branch while awaiting
-- receipt at the destination. Keep the migration idempotent for older installs.
ALTER TABLE serial_numbers DROP CONSTRAINT IF EXISTS serial_numbers_status_check;
ALTER TABLE serial_numbers
  ADD CONSTRAINT serial_numbers_status_check
  CHECK (status IN ('in_stock', 'in_transit', 'sold', 'void', 'reserved'));
