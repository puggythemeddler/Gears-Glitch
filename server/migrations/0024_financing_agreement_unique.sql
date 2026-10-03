-- Enforce at most one agreement per financing application. This is the
-- database-level guard against duplicate agreements created by concurrent or
-- repeated approvals; application_id is nullable (standalone agreements are
-- exempt from the constraint).
--
-- Existing duplicate rows are de-linked before the index is built: the earliest
-- agreement per application keeps the link, later duplicates have
-- application_id cleared (no agreement or payment data is deleted).
UPDATE financing_agreements a
SET application_id = NULL
WHERE a.application_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM financing_agreements b
    WHERE b.application_id = a.application_id
      AND b.id < a.id
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_agr_application
  ON financing_agreements(application_id)
  WHERE application_id IS NOT NULL;
