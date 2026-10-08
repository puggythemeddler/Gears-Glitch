-- Newsletter subscriber list.
-- The storefront newsletter form posts here so the "you're subscribed" state on
-- the homepage is backed by a real row, never a local-only fake.
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_created_at
  ON newsletter_subscribers (created_at DESC);