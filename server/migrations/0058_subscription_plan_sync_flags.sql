-- Keep legacy subscription-plan flag columns compatible with the current
-- INTEGER 0/1 schema. The removed boot-time migrator used BOOLEAN for
-- is_active, and the 0020 reconciler did not add is_active/sync_to_others when
-- they were missing. Plan sync writes these flags as integer values.

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS sync_to_others INTEGER NOT NULL DEFAULT 1;

DO $$
DECLARE
  is_active_type TEXT;
  sync_to_others_type TEXT;
BEGIN
  SELECT data_type INTO is_active_type
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name = 'subscription_plans'
    AND column_name = 'is_active';

  IF is_active_type IS DISTINCT FROM 'integer' THEN
    ALTER TABLE subscription_plans
      ALTER COLUMN is_active TYPE INTEGER
      USING CASE WHEN lower(is_active::text) IN ('true', 't', '1') THEN 1 ELSE 0 END;
  END IF;

  SELECT data_type INTO sync_to_others_type
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name = 'subscription_plans'
    AND column_name = 'sync_to_others';

  IF sync_to_others_type IS DISTINCT FROM 'integer' THEN
    ALTER TABLE subscription_plans
      ALTER COLUMN sync_to_others TYPE INTEGER
      USING CASE WHEN lower(sync_to_others::text) IN ('true', 't', '1') THEN 1 ELSE 0 END;
  END IF;
END $$;

UPDATE subscription_plans SET is_active = 1 WHERE is_active IS NULL;
UPDATE subscription_plans SET sync_to_others = 1 WHERE sync_to_others IS NULL;

ALTER TABLE subscription_plans
  ALTER COLUMN is_active SET DEFAULT 1,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN sync_to_others SET DEFAULT 1,
  ALTER COLUMN sync_to_others SET NOT NULL;
