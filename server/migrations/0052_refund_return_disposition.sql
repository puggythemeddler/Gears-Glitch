ALTER TABLE refunds
  ADD COLUMN IF NOT EXISTS stock_disposition TEXT NOT NULL DEFAULT 'not_returned',
  ADD COLUMN IF NOT EXISTS returned_quantity INTEGER NOT NULL DEFAULT 0;

-- Older line refunds always restored the complete line to sellable inventory.
UPDATE refunds
   SET stock_disposition = 'sellable',
       returned_quantity = COALESCE((SELECT oi.quantity FROM order_items oi WHERE oi.id = refunds.order_item_id), 0)
 WHERE order_item_id IS NOT NULL
   AND stock_disposition = 'not_returned';

ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_stock_disposition_check;
ALTER TABLE refunds ADD CONSTRAINT refunds_stock_disposition_check
  CHECK (stock_disposition IN ('not_returned','sellable','quarantine','disposed'));
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_returned_quantity_check;
ALTER TABLE refunds ADD CONSTRAINT refunds_returned_quantity_check CHECK (returned_quantity >= 0);

ALTER TABLE serial_numbers DROP CONSTRAINT IF EXISTS serial_numbers_status_check;
ALTER TABLE serial_numbers ADD CONSTRAINT serial_numbers_status_check
  CHECK (status IN ('in_stock','in_transit','sold','void','reserved','disposed','quarantined'));
