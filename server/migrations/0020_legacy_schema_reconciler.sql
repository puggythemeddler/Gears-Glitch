-- 0020_legacy_schema_reconciler.sql
-- Reconciler: cumulative schema + one-time data backfills for EXISTING
-- databases after the boot-time legacy `runMigrations()` was removed from
-- server/db.ts (one-source-of-truth: server/schema.sql + versioned migrations).
--
-- What this file does:
--   1. Adds the tables only the old runMigrations used to create
--      (splashes, email_logs, notification_log, storefront_layouts,
--      branch_subscriptions) so existing databases match schema.sql.
--   2. Adds the columns only the old runMigrations used to add (all
--      ADD COLUMN IF NOT EXISTS -> idempotent, no-ops where already present).
--   3. Converts the remaining monetary columns from DOUBLE PRECISION to the
--      exact NUMERIC(12,2) representation used elsewhere (migration 0002),
--      guarded so already-numeric columns are left untouched.
--   4. Adds the indexes the old runMigrations used to ensure.
--   5. Applies the one-time data backfills/seeds that runMigrations repeated
--      on every boot, wrapped in exception-guarded DO blocks to preserve the
--      legacy tolerance of unusual pre-existing schemas. They run exactly once
--      (tracked in schema_migrations) instead of on every startup.
--
--   Backfill failures are RECORDED, not silently dropped: each handler writes
--   SQLERRM into `reconciler_issues` (created below) and the migration runner's
--   notice forwarding surfaces a WARNING in boot logs. Failing the whole file
--   would roll back the schema work and wedge any legacy DB that trips a
--   backfill, so tolerance is kept — but the failure is visible and queryable.
--
-- Idempotent by construction: safe to apply on fresh (schema.sql-provided)
-- databases too - everything here no-ops there. Applied inside its own
-- transaction by runVersionedMigrations and fails loudly on schema errors.

-- ===========================================================================
-- 1. TABLES (mirrors the schema.sql tail; IF NOT EXISTS = no-op everywhere)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS splashes (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  bg_color TEXT NOT NULL DEFAULT '#f59e0b',
  text_color TEXT NOT NULL DEFAULT '#ffffff',
  image_url TEXT DEFAULT '',
  link_url TEXT DEFAULT '',
  is_marquee INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  start_date TEXT,
  end_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_logs (
  id SERIAL PRIMARY KEY,
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_log (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  error_message TEXT DEFAULT NULL,
  provider_message_id TEXT DEFAULT NULL,
  subject TEXT DEFAULT NULL,
  customer_id INTEGER DEFAULT NULL,
  idempotency_key TEXT DEFAULT NULL,
  sent_at TEXT DEFAULT NULL,
  created_at TEXT DEFAULT NOW()::text
);

CREATE TABLE IF NOT EXISTS storefront_layouts (
  id SERIAL PRIMARY KEY,
  layout_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  layout_type TEXT NOT NULL DEFAULT 'static',
  config JSONB NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  updated_at TEXT NOT NULL DEFAULT (NOW()::text)
);

-- Referenced by migration 0012 (branch subscription expiry): must exist before
-- 0012 on fresh databases - schema.sql now declares it as well.
CREATE TABLE IF NOT EXISTS branch_subscriptions (
  branch_id INTEGER PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
  activated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  status TEXT DEFAULT 'active'
);

-- ===========================================================================
-- 2. COLUMNS (idempotent ADD COLUMN IF NOT EXISTS; no-ops where runMigrations
--    already applied them over the years)
-- ===========================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_on_hand INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price DOUBLE PRECISION;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_name TEXT NOT NULL DEFAULT '';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT '';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_value DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT '';
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS discount_value DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS comm_prefs TEXT DEFAULT '{}';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS deleted_at TEXT;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date TEXT DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

ALTER TABLE branches ADD COLUMN IF NOT EXISTS plan_id TEXT REFERENCES subscription_plans(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_request_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mpesa_receipt TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mpesa_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tendered_amount DOUBLE PRECISION NOT NULL DEFAULT 0;

-- ===========================================================================
-- 3. MONEY COERCION -> exact NUMERIC(12,2)
--    (only when the column still holds binary floats; already-numeric columns
--    are left untouched). Mirrors migration 0002 for the columns that were
--    created later by runMigrations.
-- ===========================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'products' AND column_name = 'cost_price'
               AND data_type = 'double precision') THEN
    ALTER TABLE products ALTER COLUMN cost_price TYPE NUMERIC(12,2) USING round(cost_price::numeric, 2);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'products' AND column_name = 'sale_price'
               AND data_type = 'double precision') THEN
    ALTER TABLE products ALTER COLUMN sale_price TYPE NUMERIC(12,2) USING round(sale_price::numeric, 2);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'orders' AND column_name = 'vat_amount'
               AND data_type = 'double precision') THEN
    ALTER TABLE orders ALTER COLUMN vat_amount TYPE NUMERIC(12,2) USING round(vat_amount::numeric, 2);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'orders' AND column_name = 'tendered_amount'
               AND data_type = 'double precision') THEN
    ALTER TABLE orders ALTER COLUMN tendered_amount TYPE NUMERIC(12,2) USING round(tendered_amount::numeric, 2);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'order_items' AND column_name = 'unit_cost'
               AND data_type = 'double precision') THEN
    ALTER TABLE order_items ALTER COLUMN unit_cost TYPE NUMERIC(12,2) USING round(unit_cost::numeric, 2);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'quotes' AND column_name = 'discount_value'
               AND data_type = 'double precision') THEN
    ALTER TABLE quotes ALTER COLUMN discount_value TYPE NUMERIC(12,2) USING round(discount_value::numeric, 2);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'quote_items' AND column_name = 'discount_value'
               AND data_type = 'double precision') THEN
    ALTER TABLE quote_items ALTER COLUMN discount_value TYPE NUMERIC(12,2) USING round(discount_value::numeric, 2);
  END IF;
END $$;

-- ===========================================================================
-- 4. INDEXES (IF NOT EXISTS; no-ops where already present)
-- ===========================================================================

CREATE INDEX IF NOT EXISTS idx_orders_campaign ON orders(campaign_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_order ON loyalty_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_products_group ON products(group_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(type);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notif_log_event ON notification_log(event_type);
CREATE INDEX IF NOT EXISTS idx_notif_log_channel ON notification_log(channel);
CREATE INDEX IF NOT EXISTS idx_notif_log_status ON notification_log(status);
CREATE INDEX IF NOT EXISTS idx_notif_log_created ON notification_log(created_at);
CREATE INDEX IF NOT EXISTS idx_notif_log_customer ON notification_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_notif_log_idem ON notification_log(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_orders_checkout_request ON orders(checkout_request_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_levels_product_branch ON stock_levels(product_id, COALESCE(branch_id, 0));

-- Rating guard on product_reviews (schema.sql names it for fresh installs).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'chk_review_rating' AND conrelid = 'product_reviews'::regclass) THEN
    ALTER TABLE product_reviews ADD CONSTRAINT chk_review_rating CHECK (rating >= 1 AND rating <= 5);
  END IF;
END $$;

-- ===========================================================================
-- 5. ONE-TIME DATA BACKFILLS / SEEDS
--    Each is wrapped in an exception-guarded DO block. The exception handler
--    RECORDS the failure in reconciler_issues (visible + surfaced in boot logs)
--    instead of swallowing it, while still tolerating legacy schema variance.
--    Predicate/marker-guarded, so it never clobbers admin data after the
--    migration has been recorded.
-- ===========================================================================

-- Issues ledger for backfill failures (visible, queryable; see header note).
CREATE TABLE IF NOT EXISTS reconciler_issues (
  id SERIAL PRIMARY KEY,
  migration_step TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 5.1 users: role + email backfill for pre-dating rows
DO $$
BEGIN
  BEGIN
    UPDATE users SET role = 'admin' WHERE role IS NULL OR role = '';
    UPDATE users SET email = username || '@gearandglitch.com' WHERE email IS NULL;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO reconciler_issues (migration_step, detail) VALUES ('5.1 users role/email backfill', SQLERRM);
  END;
END $$;

-- 5.2 Reporting cost basis: historical order lines from best-known cost at the
--     time of sale. Predicate-guarded (NULL + not cancelled) so it only ever
--     touches unrecorded lines, exactly once.
DO $$
BEGIN
  BEGIN
    UPDATE order_items oi
       SET unit_cost = COALESCE(
         (SELECT p.cost_price FROM products p WHERE p.id = oi.product_id),
         (SELECT AVG(poi.unit_cost)
           FROM purchase_order_items poi
           JOIN purchase_orders po ON po.id = poi.purchase_order_id
          WHERE poi.product_id = oi.product_id
            AND poi.unit_cost IS NOT NULL
            AND COALESCE(NULLIF(po.updated_at, ''), po.created_at)::timestamp
                  <= (SELECT o.created_at::timestamp FROM orders o WHERE o.id = oi.order_id))
       )
     WHERE oi.unit_cost IS NULL AND oi.cancelled = 0;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO reconciler_issues (migration_step, detail) VALUES ('5.2 reporting unit_cost backfill', SQLERRM);
  END;
END $$;

-- 5.3 One-time snapshot of historical VAT at the CURRENT configured rate
--     (flagged vat_estimated so the tax report never presents it as recorded).
DO $$
DECLARE
  v_rate NUMERIC;
BEGIN
  BEGIN
    SELECT COALESCE(NULLIF((SELECT value FROM settings WHERE key = 'taxRate'), ''), '16')::numeric INTO v_rate;
    UPDATE orders SET
      vat_rate = v_rate,
      vat_amount = ROUND(COALESCE((SELECT SUM(ROUND(oi.line_total * v_rate / (100 + v_rate), 2))
          FROM order_items oi WHERE oi.order_id = orders.id AND oi.cancelled = 0 AND oi.taxable = 1), 0), 2),
      vat_estimated = 1
    WHERE vat_amount IS NULL;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO reconciler_issues (migration_step, detail) VALUES ('5.3 VAT snapshot backfill', SQLERRM);
  END;
END $$;

-- 5.4 logo_position default
DO $$
BEGIN
  BEGIN
    INSERT INTO settings (key, value) SELECT 'logo_position', 'top-left'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'logo_position');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO reconciler_issues (migration_step, detail) VALUES ('5.4 logo_position default', SQLERRM);
  END;
END $$;

-- 5.5 Category sort order: assign sequential order by group then label to any
--     categories still sharing the default (tied) sort_order.
DO $$
BEGIN
  BEGIN
    IF EXISTS (SELECT 1 FROM (SELECT sort_order FROM categories GROUP BY sort_order HAVING COUNT(*) > 1) t) THEN
      UPDATE categories c SET sort_order = t.new_order
        FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY group_name, label) - 1 AS new_order FROM categories) t
       WHERE c.id = t.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO reconciler_issues (migration_step, detail) VALUES ('5.5 category sort_order backfill', SQLERRM);
  END;
END $$;

-- 5.6 Product group sort order: same tie-break backfill.
DO $$
BEGIN
  BEGIN
    IF EXISTS (SELECT 1 FROM (SELECT sort_order FROM product_groups GROUP BY sort_order HAVING COUNT(*) > 1) t) THEN
      UPDATE product_groups g SET sort_order = t.new_order
        FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY name) - 1 AS new_order FROM product_groups) t
       WHERE g.id = t.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO reconciler_issues (migration_step, detail) VALUES ('5.6 product_groups sort_order backfill', SQLERRM);
  END;
END $$;

-- 5.7 Sales-by-channel reclassification for pre-existing orders.
DO $$
BEGIN
  BEGIN
    UPDATE orders SET source = 'pos'
      WHERE source = 'storefront' AND (branch_id IS NOT NULL OR processed_by LIKE 'POS%' OR notes LIKE 'POS sale%');
    UPDATE orders SET source = 'quote'
      WHERE source = 'storefront' AND notes LIKE 'Converted from quote%';
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO reconciler_issues (migration_step, detail) VALUES ('5.7 source reclassification', SQLERRM);
  END;
END $$;

-- 5.8 Storefront layouts: remove retired layouts (mobile, custom) and fall back
--     to Original where a retired layout is still selected.
DO $$
BEGIN
  BEGIN
    DELETE FROM storefront_layouts WHERE layout_key IN ('mobile', 'custom');
    UPDATE settings SET value = 'original'
      WHERE key = 'store_layout' AND value IN ('mobile', 'custom');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO reconciler_issues (migration_step, detail) VALUES ('5.8 retired layout cleanup', SQLERRM);
  END;
END $$;

-- 5.9 Storefront layouts: default static layouts when none exist.
DO $$
BEGIN
  BEGIN
    IF (SELECT COUNT(*) FROM storefront_layouts) = 0 THEN
      INSERT INTO storefront_layouts (layout_key, label, description, layout_type, config, is_active, sort_order) VALUES
        ('original', 'Original', 'Clean default layout with premium hero section, animated glows, floating particles, product carousel, glassmorphism buttons, and wave transition.', 'static', '{}', 0, 1),
        ('amazon', 'Amazon Style', 'Large search bar, horizontal categories, product recommendations, featured deals.', 'static', '{}', 0, 2),
        ('jumia', 'Jumia Style', 'Promotional sliders, flash sales, daily deals, category icons.', 'static', '{}', 0, 3);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO reconciler_issues (migration_step, detail) VALUES ('5.9 default layouts seed', SQLERRM);
  END;
END $$;

-- 5.10 Default plan pricing (one-time; previously rewritten on EVERY boot).
DO $$
BEGIN
  BEGIN
    UPDATE subscription_plans SET price = 4999, price_annual = 47990 WHERE id = 'growth';
    UPDATE subscription_plans SET price = 12999, price_annual = 124790 WHERE id = 'pro';
    UPDATE subscription_plans SET price = 29999, price_annual = 287990 WHERE id = 'enterprise';
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO reconciler_issues (migration_step, detail) VALUES ('5.10 default plan pricing backfill', SQLERRM);
  END;
END $$;

-- 5.11 Plan feature extras appended one-time (jsonb union keeps existing sets).
DO $$
BEGIN
  BEGIN
    UPDATE subscription_plans SET features = (features::jsonb || '["Multi-currency support"]'::jsonb)::text
      WHERE id = 'pro' AND NOT (features::jsonb @> '["Multi-currency support"]'::jsonb);
    UPDATE subscription_plans SET features = (features::jsonb || '["Multi-currency support"]'::jsonb)::text
      WHERE id = 'enterprise' AND NOT (features::jsonb @> '["Multi-currency support"]'::jsonb);
    UPDATE subscription_plans SET features = (features::jsonb || '["Visitor analytics"]'::jsonb)::text
      WHERE id IN ('growth', 'pro', 'enterprise') AND NOT (features::jsonb @> '["Visitor analytics"]'::jsonb);
    UPDATE subscription_plans SET features = (features::jsonb || '["Gift cards"]'::jsonb)::text
      WHERE id IN ('pro', 'enterprise') AND NOT (features::jsonb @> '["Gift cards"]'::jsonb);
    UPDATE subscription_plans SET features = (features::jsonb || '["Campaign pages"]'::jsonb)::text
      WHERE id IN ('growth', 'pro', 'enterprise') AND NOT (features::jsonb @> '["Campaign pages"]'::jsonb);
    UPDATE subscription_plans SET features = (features::jsonb || '["Cart recovery"]'::jsonb)::text
      WHERE id IN ('growth', 'pro', 'enterprise') AND NOT (features::jsonb @> '["Cart recovery"]'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO reconciler_issues (migration_step, detail) VALUES ('5.11 plan feature extras', SQLERRM);
  END;
END $$;

-- 5.12 Settings defaults (eTIMS, loyalty, storefront) + about_us seed.
DO $$
BEGIN
  BEGIN
    INSERT INTO settings (key, value) SELECT 'etims_mode', 'off'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'etims_mode');
    INSERT INTO settings (key, value) SELECT 'etims_branch_id', '00'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'etims_branch_id');
    INSERT INTO settings (key, value) SELECT 'etims_device_serial', 'dvc001'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'etims_device_serial');
    INSERT INTO settings (key, value) SELECT 'etims_vscu_url', 'http://localhost:8088'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'etims_vscu_url');
    INSERT INTO settings (key, value) SELECT 'etims_oscu_api_url', 'https://etims.kra.go.ke/api'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'etims_oscu_api_url');
    INSERT INTO settings (key, value) SELECT 'etims_oscu_consumer_key', ''
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'etims_oscu_consumer_key');
    INSERT INTO settings (key, value) SELECT 'etims_oscu_consumer_secret', ''
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'etims_oscu_consumer_secret');
    INSERT INTO settings (key, value) SELECT 'kra_pin', 'P051234567Z'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'kra_pin');
    INSERT INTO settings (key, value) SELECT 'etims_serial_prefix', '01'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'etims_serial_prefix');
    INSERT INTO settings (key, value) SELECT 'etims_last_serial', '1'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'etims_last_serial');
    INSERT INTO settings (key, value) SELECT 'etims_vscu_receipt_counter', '0'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'etims_vscu_receipt_counter');
    INSERT INTO settings (key, value) SELECT 'loyalty_rate', '10'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'loyalty_rate');
    INSERT INTO settings (key, value) SELECT 'loyalty_redemption_rate', '1'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'loyalty_redemption_rate');
    INSERT INTO settings (key, value) SELECT 'store_layout', 'original'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'store_layout');
    INSERT INTO settings (key, value) SELECT 'store_banners', '[]'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'store_banners');
    INSERT INTO settings (key, value) SELECT 'store_features', '[]'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'store_features');
    INSERT INTO settings (key, value) SELECT 'store_theme_custom', '{}'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'store_theme_custom');
    INSERT INTO settings (key, value) SELECT 'shop_plan_id', 'starter'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'shop_plan_id');
    INSERT INTO settings (key, value) SELECT 'about_us', '{"title":"About Us","content":"We are a leading retailer of computers, laptops, and accessories.","mission":"To provide quality tech products at affordable prices.","vision":"To be the most trusted tech retailer in the region.","missionTitle":"Our Mission","visionTitle":"Our Vision","image":"","address":"","hours":"","stats":[]}'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'about_us');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO reconciler_issues (migration_step, detail) VALUES ('5.12 settings defaults seed', SQLERRM);
  END;
END $$;

-- 5.13 Repair types: seed the catalog only when the table is empty.
DO $$
BEGIN
  BEGIN
    IF (SELECT COUNT(*) FROM repair_types) = 0 THEN
      INSERT INTO repair_types (id, name, description, base_price) VALUES
        ('keyboard', 'Keyboard Repair', 'Keyboard replacement or individual key fix', 1500),
        ('motherboard', 'Motherboard Replacement', 'Full motherboard replacement including labor', 3500),
        ('servicing', 'Computer Servicing', 'Full cleaning, thermal paste, fan check', 2000),
        ('screen', 'Screen Replacement', 'LCD/LED screen replacement', 2500),
        ('battery', 'Battery Replacement', 'Laptop battery replacement', 1000),
        ('software_install', 'Software Installation', 'OS or application installation', 800),
        ('software_license', 'Software Installation + License', 'Software installation with genuine license', 2500),
        ('data_recovery', 'Data Recovery', 'Hard drive data recovery service', 3000),
        ('upgrade_ram', 'RAM Upgrade', 'Memory module installation', 800),
        ('upgrade_storage', 'Storage Upgrade', 'HDD/SSD replacement or addition', 1200);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO reconciler_issues (migration_step, detail) VALUES ('5.13 repair_types seed', SQLERRM);
  END;
END $$;

-- 5.14 Sequence alignment after potential manual deletes (mirrors the legacy
--      boot behaviour; now one-time instead of every boot).
SELECT setval('orders_id_seq', COALESCE((SELECT MAX(id) FROM orders), 1));
SELECT setval('order_items_id_seq', COALESCE((SELECT MAX(id) FROM order_items), 1));

-- Surfaced in boot logs by the migration runner's notice forwarding
-- (runVersionedMigrations attaches a 'notice' listener). Keeps any 0020
-- backfill failures visible even though tolerance keeps the file non-wedging.
DO $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM reconciler_issues;
  IF n > 0 THEN
    RAISE WARNING '0020 reconciler: % backfill issue(s) recorded in reconciler_issues (SELECT * FROM reconciler_issues)', n;
  END IF;
END $$;