ALTER TABLE repair_tickets
  ADD COLUMN IF NOT EXISTS scheduled_duration_minutes INTEGER NOT NULL DEFAULT 60;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'repair_tickets_schedule_duration_range'
  ) THEN
    ALTER TABLE repair_tickets
      ADD CONSTRAINT repair_tickets_schedule_duration_range
      CHECK (scheduled_duration_minutes BETWEEN 15 AND 480);
  END IF;
END $$;
