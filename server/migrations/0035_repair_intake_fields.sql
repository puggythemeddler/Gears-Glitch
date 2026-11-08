-- Persist the device and visit-preference details collected in repair intake.
-- All additions are nullable-safe for existing ticket records and can be
-- safely applied to databases where serial_number was created by migration 0007.
ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS device_brand TEXT NOT NULL DEFAULT '';
ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS serial_number TEXT NOT NULL DEFAULT '';
ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS requested_visit_date TEXT NOT NULL DEFAULT '';
ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS requested_visit_time TEXT NOT NULL DEFAULT '';
ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS issue_summary TEXT NOT NULL DEFAULT '';
