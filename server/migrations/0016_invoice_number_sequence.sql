-- 0016_invoice_number_sequence.sql
-- Invoice numbering was `SELECT COUNT(*) FROM orders + 1` computed in app code:
-- racy (two concurrent checkouts can mint the SAME number) and non-monotonic
-- (deleting an order shrinks the count and re-uses numbers). Replace it with a
-- dedicated sequence seeded one past the largest existing order id, so existing
-- invoices keep ascending and concurrent writers get unique numbers.
--
-- Idempotent: IF NOT EXISTS skips on re-run; setval is harmless to repeat
-- (it only observes the current max id).

CREATE SEQUENCE IF NOT EXISTS order_invoice_number_seq START 1;
SELECT setval('order_invoice_number_seq', COALESCE((SELECT MAX(id) FROM orders), 0) + 1, false);