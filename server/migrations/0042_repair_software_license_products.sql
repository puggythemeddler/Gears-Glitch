-- Repair license charges use a selected catalog product and snapshot its price.
ALTER TABLE repair_tickets
  ADD COLUMN IF NOT EXISTS software_license_product_id TEXT REFERENCES products(id) ON DELETE SET NULL;

ALTER TABLE repair_tickets
  ADD COLUMN IF NOT EXISTS software_license_price NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Preserve existing fixed-fee estimates as legacy snapshots. New selections
-- always resolve their price from the chosen catalog product.
UPDATE repair_tickets t
SET software_license_price = COALESCE(
  (
    SELECT CASE
      WHEN s.value ~ '^[0-9]+([.][0-9]{1,2})?$' THEN s.value::NUMERIC(12,2)
      ELSE 2500
    END
    FROM settings s
    WHERE s.key = 'repair_software_license_fee'
  ),
  2500
)
WHERE t.software_license = 1
  AND t.software_license_product_id IS NULL
  AND t.software_license_price = 0;

-- The former flat license charge lived inside labor_cost. Move that historic
-- amount to its own line without changing the saved ticket total.
UPDATE repair_tickets
SET labor_cost = GREATEST(labor_cost - software_license_price, 0)
WHERE software_license = 1
  AND software_license_product_id IS NULL
  AND software_license_price > 0;
