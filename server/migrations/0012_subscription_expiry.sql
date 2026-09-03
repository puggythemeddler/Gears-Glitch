-- SU-1/SU-2: subscription expiry enforcement support.
--  * Index expires_at so the periodic sweep (`markExpiredSubscriptions`) stays fast.
--  * NORMALIZE existing NULL/never-populated expiries? No: NULL intentionally means
--    "never expires" for backwards compatibility, so existing installs are not locked out.
--  * Add a CHECK so `status` only holds known values.

CREATE INDEX IF NOT EXISTS idx_branch_subscriptions_expires_at
  ON branch_subscriptions (expires_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'branch_subscriptions'::regclass AND conname = 'branch_subscriptions_status_check'
  ) THEN
    ALTER TABLE branch_subscriptions
      ADD CONSTRAINT branch_subscriptions_status_check
      CHECK (status IN ('active', 'expired', 'suspended', 'cancelled'));
  END IF;
END $$;
