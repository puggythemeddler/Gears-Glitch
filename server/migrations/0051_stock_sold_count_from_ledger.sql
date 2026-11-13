-- Reconcile the stock UI's sold counter from the stock movement ledger.
-- Sale movements add units sold; cancellation/refund restocks subtract them.
-- Reservations, releases, receipts, and other movements do not affect sold.
UPDATE stock_levels sl
SET quantity_sold = GREATEST(COALESCE((
  SELECT SUM(CASE
    WHEN m.movement_type = 'sale' THEN ABS(m.quantity)
    WHEN m.movement_type = 'restock'
      AND m.reference_type IN ('cancel', 'refund') THEN -ABS(m.quantity)
    ELSE 0
  END)
  FROM stock_movements m
  WHERE m.product_id = sl.product_id
    AND m.branch_id IS NOT DISTINCT FROM sl.branch_id
    AND (
      m.movement_type = 'sale'
      OR (m.movement_type = 'restock' AND m.reference_type IN ('cancel', 'refund'))
    )
), 0), 0)::integer,
updated_at = NOW()::text;
