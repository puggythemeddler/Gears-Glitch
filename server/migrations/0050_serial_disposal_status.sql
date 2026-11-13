-- Disposed serials remain in the audit trail and must not return to available stock.
ALTER TABLE serial_numbers DROP CONSTRAINT IF EXISTS serial_numbers_status_check;
ALTER TABLE serial_numbers
  ADD CONSTRAINT serial_numbers_status_check
  CHECK (status IN ('in_stock', 'in_transit', 'sold', 'void', 'reserved', 'disposed'));
