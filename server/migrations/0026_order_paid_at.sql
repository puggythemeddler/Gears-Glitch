-- First-class "was this order ever paid" marker.
--
-- Order status alone cannot answer that question: once an order advances to
-- shipped/delivered its status no longer says 'paid', so the confirmed-order
-- guard ("an unpaid order cannot leave confirmed") would be unable to tell a
-- paid order from an unpaid one. paid_at is written once, when payment is
-- actually recorded (POS cash, POS M-Pesa poll, storefront M-Pesa callback,
-- pay-cash), and survives every later status change.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS paid_at TEXT;