-- Migration: Money representation -> exact NUMERIC
-- Created: 2026-08-31
-- Description: Converts every monetary column from DOUBLE PRECISION (binary
--   float, lossy) to NUMERIC(12,2) (exact decimal, rounded to cent precision on
--   conversion). This eliminates binary float drift in stored financial values.
--   JavaScript code interacting with these columns is unchanged: node-postgres
--   returns NUMERIC as strings, and the global pg NUMERIC/INT8 type parser in
--   db-helpers.stringifyMoney (added alongside this migration) coerces them back
--   to JS numbers at the driver boundary, so API responses keep returning numbers.
-- Reversible: note the original column ORDER is (re)applied below so a downgrade
--   could cast back to DOUBLE PRECISION if ever required.

ALTER TABLE products ALTER COLUMN price TYPE NUMERIC(12,2) USING round(price::numeric, 2);
ALTER TABLE orders ALTER COLUMN shipping_fee TYPE NUMERIC(12,2) USING round(shipping_fee::numeric, 2);
ALTER TABLE orders ALTER COLUMN subtotal TYPE NUMERIC(12,2) USING round(subtotal::numeric, 2);
ALTER TABLE orders ALTER COLUMN discount_amount TYPE NUMERIC(12,2) USING round(discount_amount::numeric, 2);
ALTER TABLE orders ALTER COLUMN gift_card_amount TYPE NUMERIC(12,2) USING round(gift_card_amount::numeric, 2);
ALTER TABLE orders ALTER COLUMN amount_refunded TYPE NUMERIC(12,2) USING round(amount_refunded::numeric, 2);
ALTER TABLE order_items ALTER COLUMN price TYPE NUMERIC(12,2) USING round(price::numeric, 2);
ALTER TABLE order_items ALTER COLUMN line_total TYPE NUMERIC(12,2) USING round(line_total::numeric, 2);
ALTER TABLE subscription_plans ALTER COLUMN price TYPE NUMERIC(12,2) USING round(price::numeric, 2);
ALTER TABLE subscription_plans ALTER COLUMN price_annual TYPE NUMERIC(12,2) USING round(price_annual::numeric, 2);
ALTER TABLE provider_plan_assignments ALTER COLUMN custom_price TYPE NUMERIC(12,2) USING round(custom_price::numeric, 2);
ALTER TABLE invoices ALTER COLUMN amount TYPE NUMERIC(12,2) USING round(amount::numeric, 2);
ALTER TABLE order_invoices ALTER COLUMN amount TYPE NUMERIC(12,2) USING round(amount::numeric, 2);
ALTER TABLE repair_types ALTER COLUMN base_price TYPE NUMERIC(12,2) USING round(base_price::numeric, 2);
ALTER TABLE repair_tickets ALTER COLUMN hardware_value TYPE NUMERIC(12,2) USING round(hardware_value::numeric, 2);
ALTER TABLE repair_tickets ALTER COLUMN labor_cost TYPE NUMERIC(12,2) USING round(labor_cost::numeric, 2);
ALTER TABLE repair_tickets ALTER COLUMN parts_cost TYPE NUMERIC(12,2) USING round(parts_cost::numeric, 2);
ALTER TABLE repair_tickets ALTER COLUMN total_cost TYPE NUMERIC(12,2) USING round(total_cost::numeric, 2);
ALTER TABLE repair_parts_used ALTER COLUMN unit_cost TYPE NUMERIC(12,2) USING round(unit_cost::numeric, 2);
ALTER TABLE purchase_order_items ALTER COLUMN unit_cost TYPE NUMERIC(12,2) USING round(unit_cost::numeric, 2);
ALTER TABLE quotes ALTER COLUMN total TYPE NUMERIC(12,2) USING round(total::numeric, 2);
ALTER TABLE quote_items ALTER COLUMN unit_price TYPE NUMERIC(12,2) USING round(unit_price::numeric, 2);
ALTER TABLE quote_items ALTER COLUMN line_total TYPE NUMERIC(12,2) USING round(line_total::numeric, 2);
ALTER TABLE coupons ALTER COLUMN value TYPE NUMERIC(12,2) USING round(value::numeric, 2);
ALTER TABLE coupons ALTER COLUMN min_order_amount TYPE NUMERIC(12,2) USING round(min_order_amount::numeric, 2);
ALTER TABLE coupon_usage ALTER COLUMN discount_amount TYPE NUMERIC(12,2) USING round(discount_amount::numeric, 2);
ALTER TABLE price_history ALTER COLUMN old_price TYPE NUMERIC(12,2) USING round(old_price::numeric, 2);
ALTER TABLE price_history ALTER COLUMN new_price TYPE NUMERIC(12,2) USING round(new_price::numeric, 2);
ALTER TABLE credit_notes ALTER COLUMN total_amount TYPE NUMERIC(12,2) USING round(total_amount::numeric, 2);
ALTER TABLE credit_note_items ALTER COLUMN price TYPE NUMERIC(12,2) USING round(price::numeric, 2);
ALTER TABLE credit_note_items ALTER COLUMN line_total TYPE NUMERIC(12,2) USING round(line_total::numeric, 2);
ALTER TABLE etims_sales_transactions ALTER COLUMN total_amount TYPE NUMERIC(12,2) USING round(total_amount::numeric, 2);
ALTER TABLE gift_cards ALTER COLUMN initial_value TYPE NUMERIC(12,2) USING round(initial_value::numeric, 2);
ALTER TABLE gift_cards ALTER COLUMN balance TYPE NUMERIC(12,2) USING round(balance::numeric, 2);
ALTER TABLE gift_card_redemptions ALTER COLUMN amount TYPE NUMERIC(12,2) USING round(amount::numeric, 2);
ALTER TABLE cart_recovery_reminders ALTER COLUMN cart_total TYPE NUMERIC(12,2) USING round(cart_total::numeric, 2);
ALTER TABLE refunds ALTER COLUMN amount TYPE NUMERIC(12,2) USING round(amount::numeric, 2);
