CREATE TABLE IF NOT EXISTS repair_quote_versions (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES repair_tickets(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  recipient_email TEXT NOT NULL,
  quote_snapshot JSONB NOT NULL,
  pdf_content BYTEA,
  pdf_sha256 TEXT,
  reservation_token TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'sending'
    CHECK (delivery_status IN ('sending', 'sent', 'failed', 'superseded', 'expired')),
  delivery_result TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  response TEXT CHECK (response IN ('accepted', 'declined') OR response IS NULL),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticket_id, version)
);

CREATE INDEX IF NOT EXISTS idx_repair_quote_versions_ticket
  ON repair_quote_versions(ticket_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_repair_quote_versions_expiry
  ON repair_quote_versions(delivery_status, expires_at);
