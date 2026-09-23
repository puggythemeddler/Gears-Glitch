-- 0019_integrations_indexes.sql
-- Supporting indexes for the integrations architecture (migration 0018).
-- Speeds up the oauth account-linking lookups, the outbound queue entity
-- scoping, and the notification_log idempotency checks. All idempotent.

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_customer ON oauth_accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_entity ON notification_deliveries(entity_type, entity_id);