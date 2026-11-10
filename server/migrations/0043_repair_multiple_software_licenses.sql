-- Repair estimates may include several catalog license products. Keep each
-- selected product and its price snapshot together; legacy columns remain for
-- compatibility with older reports and records.
ALTER TABLE repair_tickets
  ADD COLUMN IF NOT EXISTS software_license_items JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE repair_tickets t
SET software_license_items = jsonb_build_array(jsonb_build_object(
  'productId', t.software_license_product_id,
  'name', COALESCE(p.name, 'Software license'),
  'price', t.software_license_price
))
FROM products p
WHERE t.software_license = 1
  AND t.software_license_product_id = p.id
  AND t.software_license_items = '[]'::jsonb;

UPDATE repair_tickets t
SET software_license_items = jsonb_build_array(jsonb_build_object(
  'productId', NULL,
  'name', 'Software license',
  'price', t.software_license_price
))
WHERE t.software_license = 1
  AND t.software_license_product_id IS NULL
  AND t.software_license_price > 0
  AND t.software_license_items = '[]'::jsonb;
