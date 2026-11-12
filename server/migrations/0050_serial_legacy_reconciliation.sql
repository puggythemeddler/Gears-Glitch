ALTER TABLE serial_numbers
  ADD COLUMN IF NOT EXISTS legacy_identifier TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_serial_numbers_legacy_identifier_unique
  ON serial_numbers (LOWER(BTRIM(legacy_identifier)))
  WHERE legacy_identifier IS NOT NULL AND BTRIM(legacy_identifier) <> '';
