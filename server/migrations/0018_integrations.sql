-- 0018_integrations.sql
-- Central integrations + notification infrastructure for the multi-provider
-- architecture (Gmail/Google OAuth, Daraja/M-Pesa, WhatsApp Cloud API).
--
-- Notes:
--   * `integrations` holds ONE row per provider for this tenant instance (this
--     server == one tenant == one database). Non-secret display data lives in
--     `config`; secret material (OAuth refresh tokens, consumer secrets,
--     passkeys, access tokens) lives in `secrets` as an AES-256-GCM blob written
--     by server/secret-store.ts (enc:v1: prefix). Secrets are never exposed by
--     any API response.
--   * `oauth_accounts` links a Google (or future provider) identity to an
--     existing Gears&Glitch user/customer WITHOUT creating privileged accounts.
--   * `notification_deliveries` is the persisted outbound queue: each logical
--     delivery tracks attempts, backoff, next retry and a deterministic
--     idempotency key so retries never duplicate messages.
--   * `notification_templates` stores per-event channel templates (email/WA).
--   * `webhook_events` is the inbound callback/webhook ledger used for durable
--     idempotency + auditability (M-Pesa callbacks, WhatsApp webhooks, OAuth).
--
-- All statements are idempotent (IF NOT EXISTS) so re-runs are safe.

CREATE TABLE IF NOT EXISTS integrations (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'not_configured',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  secrets TEXT NOT NULL DEFAULT '',
  last_connected_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_error TEXT,
  last_test_at TIMESTAMPTZ,
  last_test_result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'google',
  subject TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  UNIQUE (provider, subject)
);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_email ON oauth_accounts(email);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'admin',
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  recipient TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  provider_message_id TEXT,
  customer_id INTEGER,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  UNIQUE (event_id, channel, recipient)
);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_pending ON notification_deliveries(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_event ON notification_deliveries(event_id);

CREATE TABLE IF NOT EXISTS notification_templates (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_type, channel)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  event_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  payload_hash TEXT,
  payload JSONB,
  http_status INTEGER,
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE (provider, event_key)
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events(provider, status);