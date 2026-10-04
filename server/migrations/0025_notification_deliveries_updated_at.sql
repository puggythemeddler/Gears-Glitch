-- Add the missing updated_at column to notification_deliveries.
--
-- markDeliverySent() and recordDeliveryAttempt() both write
-- "updated_at = NOW()" when recording a delivery outcome, but the column was
-- never created, so every one of those updates raised
--   column "updated_at" of relation "notification_deliveries" does not exist
-- and the notification drain rolled back on every tick. Delivery outcomes were
-- therefore never persisted.
-- Add it nullable first: ADD COLUMN ... NOT NULL DEFAULT now() backfills the
-- migration timestamp into every existing row, which would make the historical
-- backfill below a no-op and stamp every old delivery as touched right now.
ALTER TABLE notification_deliveries
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Backfill rows written before the column existed, then tighten it to match
-- schema.sql so the insert path always gets a value.
UPDATE notification_deliveries
SET updated_at = COALESCE(sent_at, created_at, now())
WHERE updated_at IS NULL;

ALTER TABLE notification_deliveries
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;