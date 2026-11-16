-- Keep operational branches available internally while allowing the store owner
-- to choose which locations customers can select during online checkout.
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS online_fulfillment_enabled INTEGER NOT NULL DEFAULT 1;

UPDATE branches
SET online_fulfillment_enabled = 1
WHERE online_fulfillment_enabled IS NULL;
