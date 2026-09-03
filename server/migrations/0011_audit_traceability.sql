-- Migration: audit-column traceability for financial stock records (DB-7).
-- Description:
--   1) stock_movements.created_by already has an FK to users(id) — documented, no change.
--   2) orders.processed_by is a free-text display name; traceability lives on the
--      already-existing orders.staff_id FK to users(id) — documented, no change.
--   3) credit_notes.created_by had NO foreign key: neutralize any orphaned ids,
--      relax NOT NULL, and enforce an FK to users(id). Safe/idempotent; preserves
--      existing financial rows by nulling only ids that reference no user.

UPDATE credit_notes SET created_by = NULL
WHERE created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = credit_notes.created_by);

ALTER TABLE credit_notes ALTER COLUMN created_by DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_attribute a ON a.attnum = ANY(con.conkey) AND a.attrelid = con.conrelid
    WHERE con.conrelid = 'credit_notes'::regclass
      AND con.contype = 'f'
      AND a.attname = 'created_by'
      AND con.confrelid = 'users'::regclass
  ) THEN
    ALTER TABLE credit_notes ADD CONSTRAINT credit_notes_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;
END $$;
