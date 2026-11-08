-- Repair workflow priority, diagnosis SLA, and on-hold follow-up state.
ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS diagnosis_due_at TEXT;
ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS diagnosis_last_reminded_at TEXT;
ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS hold_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS hold_started_at TEXT;
ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS hold_remind_at TEXT;
ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS hold_last_reminded_at TEXT;
CREATE INDEX IF NOT EXISTS idx_repairs_diagnosis_due ON repair_tickets(diagnosis_due_at)
  WHERE diagnosis_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_repairs_hold_reminder ON repair_tickets(hold_remind_at)
  WHERE hold_remind_at IS NOT NULL;
-- Give existing assigned, undiagnosed tickets a fresh default target at rollout.
UPDATE repair_tickets
SET diagnosis_due_at = (NOW() + INTERVAL '24 hours')::text
WHERE assigned_to IS NOT NULL AND diagnosis = '' AND status IN ('received', 'diagnosing')
  AND diagnosis_due_at IS NULL;
