-- Normalize newsletter_subscribers.created_at to TIMESTAMPTZ (drop TEXT default first)
ALTER TABLE newsletter_subscribers
  ALTER COLUMN created_at DROP DEFAULT;

ALTER TABLE newsletter_subscribers
  ALTER COLUMN created_at TYPE TIMESTAMPTZ
  USING CASE
    WHEN created_at IS NULL THEN now()
    ELSE created_at::timestamptz
  END;

ALTER TABLE newsletter_subscribers
  ALTER COLUMN created_at SET DEFAULT now();