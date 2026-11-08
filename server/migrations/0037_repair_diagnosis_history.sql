-- Capture the diagnosis timestamp so SLA reporting can be measured accurately.
ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS diagnosis_recorded_at TEXT;
