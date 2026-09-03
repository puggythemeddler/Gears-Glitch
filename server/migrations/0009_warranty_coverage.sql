-- Migration: warranty coverage terms & claim status CHECK (W-2, W-1 lifecycle).
-- Description: Adds coverage/exclusions storage to warranty_claims and enforces a
--   valid claim status set so the claim lifecycle (submitted -> approved/rejected ->
--   resolved) cannot drift. Idempotent / additive; runs after 0003.

ALTER TABLE warranty_claims ADD COLUMN IF NOT EXISTS coverage_terms TEXT NOT NULL DEFAULT '';
ALTER TABLE warranty_claims ADD COLUMN IF NOT EXISTS exclusions TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warranty_claims_status_check') THEN
    ALTER TABLE warranty_claims ADD CONSTRAINT warranty_claims_status_check
      CHECK (status IN ('submitted','in_review','approved','rejected','resolved','closed'));
  END IF;
END$$;
