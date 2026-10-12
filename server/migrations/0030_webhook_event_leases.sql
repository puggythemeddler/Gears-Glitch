-- 0030_webhook_event_leases.sql
-- Atomic claim/lease + fencing for the inbound webhook ledger `webhook_events`.
--
-- Why: the first WhatsApp idempotency implementation used a SELECT followed by
-- an unconditional UPDATE to "reclaim" stale/failed events. Under concurrent
-- redelivery (which Meta does), two workers could both observe a stale row and
-- both process the event; a crashed worker could also strand an event forever.
--
-- This migration adds the columns needed for a single-statement atomic claim:
--   * claim_token       opaque per-worker ownership token (fencing)
--   * lease_expires_at  when the current owner's lease lapses (reclaimable after)
--   * attempts          how many times the event has been claimed (observability)
--
-- Backward compatible and idempotent:
--   * ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS -> safe to re-run.
--   * Existing rows get NULL lease/claim_token and attempts = 0. A NULL lease is
--     treated as immediately reclaimable, so pre-existing 'received'/'failed'
--     rows (e.g. recent M-Pesa ledger entries) behave exactly as before.
--   * The unique (provider, event_key) constraint created in 0018 is untouched.
--
-- No data backfill is required. Apply forward only (this file is application code,
-- NOT run against production by this task).

ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS claim_token TEXT;
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

-- Supports the steal predicate (status <> 'processed' AND lease_expires_at < NOW()).
CREATE INDEX IF NOT EXISTS idx_webhook_events_lease ON webhook_events(status, lease_expires_at);
