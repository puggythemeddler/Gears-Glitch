-- Append-only, ticket-linked repair receipts, refunds, and void audit entries.
CREATE TABLE IF NOT EXISTS repair_payments (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES repair_tickets(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('payment', 'refund', 'void')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'mpesa', 'card', 'bank_transfer', 'other')),
  reference TEXT NOT NULL,
  related_payment_id BIGINT REFERENCES repair_payments(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL UNIQUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  CHECK ((kind = 'payment' AND related_payment_id IS NULL AND reason = '') OR (kind IN ('refund', 'void') AND related_payment_id IS NOT NULL AND length(trim(reason)) > 0))
);
CREATE INDEX IF NOT EXISTS idx_repair_payments_ticket_created ON repair_payments(ticket_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_repair_payment_reference ON repair_payments(ticket_id, payment_method, reference) WHERE kind = 'payment';
CREATE UNIQUE INDEX IF NOT EXISTS idx_repair_refund_reference ON repair_payments(ticket_id, payment_method, reference) WHERE kind = 'refund';
CREATE UNIQUE INDEX IF NOT EXISTS idx_repair_payment_single_void ON repair_payments(related_payment_id) WHERE kind = 'void';
