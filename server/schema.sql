-- PostgreSQL Schema for Gear&Glitch Store
-- Converted from SQLite

-- Core Tables
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  password_hash TEXT NOT NULL,
  password_changed_at TEXT,
  totp_secret TEXT,
  totp_enabled BOOLEAN DEFAULT false,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  group_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  specs TEXT NOT NULL DEFAULT '[]',
  in_stock INTEGER NOT NULL DEFAULT 1,
  is_non_stock INTEGER NOT NULL DEFAULT 0,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  image_alt TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  subcategory TEXT NOT NULL DEFAULT '',
  min_tier INTEGER NOT NULL DEFAULT 0,
  has_warranty INTEGER NOT NULL DEFAULT 0,
  warranty_duration INTEGER NOT NULL DEFAULT 0,
  serial_tracking INTEGER NOT NULL DEFAULT 0,
  barcode TEXT NOT NULL DEFAULT '',
  taxable INTEGER NOT NULL DEFAULT 1,
  cost_price NUMERIC(12,2),
  sale_price NUMERIC(12,2),
  stock_on_hand INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  updated_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

CREATE TABLE IF NOT EXISTS product_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  group_name TEXT NOT NULL DEFAULT '',
  show_on_pos INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE IF NOT EXISTS subcategories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  last_login TEXT,
  password_changed_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  comm_prefs TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  updated_at TEXT NOT NULL DEFAULT (NOW()::text),
  UNIQUE (customer_id, product_id),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cart_customer ON cart_items(customer_id);

-- subscription_plans must be declared before any table that references it
-- (branches.plan_id); on a brand-new database an inline REFERENCES to a
-- not-yet-created table aborts the whole schema load and the server cannot boot.
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price DOUBLE PRECISION NOT NULL DEFAULT 0,
  price_annual DOUBLE PRECISION,
  tier_level INTEGER NOT NULL DEFAULT 0,
  max_products INTEGER,
  max_branches INTEGER NOT NULL DEFAULT 1,
  features TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  sync_to_others INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  plan_id TEXT REFERENCES subscription_plans(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);

-- Which staff accounts may operate at which branches. branches.manager_id is a
-- single "manager of record", not an access grant, so it cannot scope POS work.
-- Resolution rules (admin/owner see all active branches, single-branch shops
-- resolve to their only branch) live in server/branch-access.ts.
CREATE TABLE IF NOT EXISTS user_branches (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  PRIMARY KEY (user_id, branch_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  shipping_name TEXT NOT NULL DEFAULT '',
  shipping_address TEXT NOT NULL DEFAULT '',
  shipping_city TEXT NOT NULL DEFAULT '',
  shipping_county TEXT NOT NULL DEFAULT '',
  shipping_postcode TEXT NOT NULL DEFAULT '',
  shipping_phone TEXT NOT NULL DEFAULT '',
  shipping_fee DOUBLE PRECISION NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
  staff_id INTEGER REFERENCES users(id),
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  coupon_id INTEGER,
  discount_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  vat_rate DOUBLE PRECISION,
  vat_amount NUMERIC(12,2),
  vat_estimated INTEGER NOT NULL DEFAULT 0,
  campaign_id INTEGER,
  processed_by TEXT,
  invoice_number TEXT,
  payment_method TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT,
  source TEXT NOT NULL DEFAULT 'storefront',
  gift_card_id INTEGER,
  gift_card_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  amount_refunded DOUBLE PRECISION NOT NULL DEFAULT 0,
  checkout_request_id TEXT,
  mpesa_receipt TEXT,
  mpesa_phone TEXT,
  tendered_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  updated_at TEXT NOT NULL DEFAULT (NOW()::text),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
-- Invoice numbering for order invoices (INV-XXXXX): a dedicated sequence seeded
-- one past the largest order id so numbering is monotonic and race-free. Tests
-- run runSchema() only (not migrations), so this mirrors migration 0016.
CREATE SEQUENCE IF NOT EXISTS order_invoice_number_seq START 1;
SELECT setval('order_invoice_number_seq', COALESCE((SELECT MAX(id) FROM orders), 0) + 1, false);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  line_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  has_warranty INTEGER NOT NULL DEFAULT 0,
  warranty_duration INTEGER NOT NULL DEFAULT 0,
  warranty_expires TEXT,
  serial_number TEXT NOT NULL DEFAULT '',
  stock_deducted INTEGER NOT NULL DEFAULT 0,
  taxable INTEGER NOT NULL DEFAULT 1,
  cancelled INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS stock_levels (
  id SERIAL PRIMARY KEY,
  product_id TEXT NOT NULL,
  branch_id INTEGER REFERENCES branches(id),
  quantity_in_stock INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  updated_at TEXT NOT NULL DEFAULT (NOW()::text),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);
-- One global row per product (branch_id NULL) or one row per product+branch —
-- matches migration 0006 so a fresh runSchema() DB is identical to a migrated one.
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_levels_global ON stock_levels(product_id) WHERE branch_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_levels_branch ON stock_levels(product_id, branch_id) WHERE branch_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  product_id TEXT NOT NULL,
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  notes TEXT,
  branch_id INTEGER REFERENCES branches(id),
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);

CREATE TABLE IF NOT EXISTS stock_transfers (
  id SERIAL PRIMARY KEY,
  from_branch_id INTEGER NOT NULL,
  to_branch_id INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by INTEGER,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  FOREIGN KEY (from_branch_id) REFERENCES branches(id),
  FOREIGN KEY (to_branch_id) REFERENCES branches(id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS providers (
  id SERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  pin_hash TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'trial',
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE IF NOT EXISTS provider_plan_assignments (
  id SERIAL PRIMARY KEY,
  provider_id INTEGER NOT NULL,
  plan_id TEXT NOT NULL,
  custom_price DOUBLE PRECISION,
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT NOT NULL DEFAULT '',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_provider_plan_provider ON provider_plan_assignments(provider_id);

CREATE TABLE IF NOT EXISTS product_views (
  id SERIAL PRIMARY KEY,
  product_id TEXT NOT NULL,
  viewer_type TEXT NOT NULL DEFAULT 'anonymous',
  viewed_at TEXT NOT NULL DEFAULT (NOW()::text),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_product_views_product ON product_views(product_id);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  provider_id INTEGER NOT NULL,
  plan_id TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'KES',
  status TEXT NOT NULL DEFAULT 'pending',
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  paid_at TEXT,
  invoice_number TEXT DEFAULT '',
  due_date TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);
CREATE INDEX IF NOT EXISTS idx_invoices_provider ON invoices(provider_id);

CREATE TABLE IF NOT EXISTS order_invoices (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'KES',
  status TEXT NOT NULL DEFAULT 'pending',
  etims_invoice_number TEXT,
  control_code TEXT,
  kra_pin TEXT,
  serial_number INTEGER,
  internal_data TEXT,
  signature_data TEXT,
  receipt_date TEXT,
  receipt_counter INTEGER,
  total_receipts INTEGER,
  tax_type TEXT NOT NULL DEFAULT 'A',
  payment_type TEXT NOT NULL DEFAULT '04',
  vscu_receipt_no INTEGER,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_order_invoices_order ON order_invoices(order_id);

CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  provider_id INTEGER NOT NULL,
  product_id TEXT,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'customer',
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  read_at TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (provider_id) REFERENCES providers(id)
);
CREATE INDEX IF NOT EXISTS idx_messages_customer ON messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_messages_provider ON messages(provider_id);

CREATE TABLE IF NOT EXISTS repair_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  base_price DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS repair_tickets (
  id TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  device_type TEXT NOT NULL,
  device_model TEXT NOT NULL DEFAULT '',
  issue_description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  assigned_to INTEGER,
  branch_id INTEGER REFERENCES branches(id),
  eta_at TEXT NOT NULL,
  scheduled_at TEXT,
  diagnosis TEXT NOT NULL DEFAULT '',
  work_notes TEXT NOT NULL DEFAULT '',
  customer_notes TEXT NOT NULL DEFAULT '',
  repair_type TEXT,
  hardware_value DOUBLE PRECISION NOT NULL DEFAULT 0,
  labor_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  parts_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  software_install INTEGER NOT NULL DEFAULT 0,
  software_license INTEGER NOT NULL DEFAULT 0,
  total_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  quote_sent_at TEXT,
  quote_responded_at TEXT,
  quote_response TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  updated_at TEXT NOT NULL DEFAULT (NOW()::text),
  completed_at TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_repairs_customer ON repair_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_repairs_status ON repair_tickets(status);
CREATE INDEX IF NOT EXISTS idx_repairs_scheduled ON repair_tickets(scheduled_at);

CREATE TABLE IF NOT EXISTS repair_updates (
  id SERIAL PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  staff_id INTEGER,
  update_type TEXT NOT NULL DEFAULT 'note',
  message TEXT NOT NULL,
  customer_visible INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  FOREIGN KEY (ticket_id) REFERENCES repair_tickets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS repair_parts_used (
  id SERIAL PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  description TEXT NOT NULL,
  product_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  FOREIGN KEY (ticket_id) REFERENCES repair_tickets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS repair_images (
  id SERIAL PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  image_type TEXT NOT NULL DEFAULT 'before',
  uploaded_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  FOREIGN KEY (ticket_id) REFERENCES repair_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_repair_images_ticket ON repair_images(ticket_id);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  supplier_contact TEXT NOT NULL DEFAULT '',
  branch_id INTEGER REFERENCES branches(id),
  order_date TEXT NOT NULL DEFAULT (NOW()::text),
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT NOT NULL DEFAULT '',
  deleted_at TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  updated_at TEXT NOT NULL DEFAULT (NOW()::text),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  quantity_ordered INTEGER NOT NULL DEFAULT 1,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  unit_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  serial_numbers TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_purchase_items_order ON purchase_order_items(purchase_order_id);

-- Serial number tracking (warranty lookups, PO intake, sale linking)
-- Ownership is intentionally INDIRECT: a sold serial links to order_item_id/order_id
-- and the owner is resolved via orders.customer_id (SN-5). This keeps the source of
-- truth normalized; there is no customer_id column here by design.
CREATE TABLE IF NOT EXISTS serial_numbers (
  id SERIAL PRIMARY KEY,
  serial_number TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL,
  branch_id INTEGER,
  status TEXT NOT NULL DEFAULT 'in_stock',
  purchase_order_item_id INTEGER,
  order_id INTEGER,
  order_item_id INTEGER,
  sold_at TEXT,
  warranty_expires TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_status ON serial_numbers(status);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_product ON serial_numbers(product_id);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_number ON serial_numbers(serial_number);

-- Running counters for auto-generating unique serial numbers per prefix
CREATE TABLE IF NOT EXISTS serial_sequences (
  prefix TEXT PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wishlist (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  UNIQUE (customer_id, product_id),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_wishlist_customer ON wishlist(customer_id);

CREATE TABLE IF NOT EXISTS quotes (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  quote_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT NOT NULL DEFAULT '',
  branch_id INTEGER REFERENCES branches(id),
  total DOUBLE PRECISION NOT NULL DEFAULT 0,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  discount_type TEXT NOT NULL DEFAULT '',
  discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  updated_at TEXT NOT NULL DEFAULT (NOW()::text),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quote_items (
  id SERIAL PRIMARY KEY,
  quote_id INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  line_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  discount_type TEXT NOT NULL DEFAULT '',
  discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stock_take_sessions (
  id SERIAL PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'in_progress',
  notes TEXT NOT NULL DEFAULT '',
  branch_id INTEGER REFERENCES branches(id),
  created_by INTEGER REFERENCES users(id),
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE IF NOT EXISTS stock_take_items (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES stock_take_sessions(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL DEFAULT '',
  system_quantity INTEGER NOT NULL DEFAULT 0,
  counted_quantity INTEGER,
  variance INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  UNIQUE (session_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_take_items_session ON stock_take_items(session_id);
CREATE INDEX IF NOT EXISTS idx_stock_take_items_product ON stock_take_items(product_id);

CREATE TABLE IF NOT EXISTS stock_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  UNIQUE(snapshot_date, product_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_date ON stock_snapshots(snapshot_date);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  user_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  actor_role TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS subscription_requests (
  id SERIAL PRIMARY KEY,
  requested_plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id),
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE IF NOT EXISTS spec_template_fields (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  options TEXT NOT NULL DEFAULT '[]',
  required INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_spec_template_fields_category ON spec_template_fields(category);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  db_path TEXT NOT NULL DEFAULT '',
  schema_name TEXT NOT NULL DEFAULT '',
  settings TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  updated_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'percentage',
  value DOUBLE PRECISION NOT NULL DEFAULT 0,
  min_order_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 0,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE IF NOT EXISTS coupon_usage (
  id SERIAL PRIMARY KEY,
  coupon_id INTEGER NOT NULL REFERENCES coupons(id),
  order_id INTEGER NOT NULL REFERENCES orders(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  discount_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  used_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  new_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  changed_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  updated_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE IF NOT EXISTS product_reviews (
  id SERIAL PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  rating INTEGER NOT NULL CONSTRAINT chk_review_rating CHECK (rating >= 1 AND rating <= 5),
  title TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_reviews_unique ON product_reviews (product_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_customer_id ON product_reviews (customer_id);

CREATE TABLE IF NOT EXISTS loyalty_points (
  customer_id INTEGER PRIMARY KEY REFERENCES customers(id),
  points INTEGER NOT NULL DEFAULT 0,
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  order_id INTEGER,
  points INTEGER NOT NULL,
  type TEXT NOT NULL,
  reference_type TEXT NOT NULL DEFAULT '',
  reference_id TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON loyalty_transactions(customer_id);

CREATE TABLE IF NOT EXISTS credit_notes (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  total_amount DOUBLE PRECISION NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  reason_code TEXT NOT NULL DEFAULT '13',
  status TEXT NOT NULL DEFAULT 'issued',
  created_by INTEGER,
  etims_cn_number TEXT,
  etims_control_code TEXT,
  etims_serial_number INTEGER,
  etims_internal_data TEXT,
  etims_signature_data TEXT,
  etims_submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS credit_note_items (
  id SERIAL PRIMARY KEY,
  credit_note_id INTEGER NOT NULL,
  order_item_id INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  line_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_credit_notes_order ON credit_notes(order_id);

CREATE TABLE IF NOT EXISTS etims_sales_transactions (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL UNIQUE,
  tx_date TEXT NOT NULL,
  customer_name TEXT,
  total_amount DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);

-- RBAC Tables
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_custom INTEGER NOT NULL DEFAULT 0,
  features TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  UNIQUE (role_id, permission),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  role_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT (NOW()::text),
  UNIQUE (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  permission TEXT NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT (NOW()::text),
  UNIQUE (user_id, permission),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS deleted_roles (
  id TEXT PRIMARY KEY,
  deleted_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE IF NOT EXISTS stored_images (
  id SERIAL PRIMARY KEY,
  ref_id TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  image_data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_stored_images_ref ON stored_images(ref_id);

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id SERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'customer',
  entity_id INTEGER NOT NULL,
  entity_name TEXT NOT NULL DEFAULT '',
  last_incoming_at TEXT,
  last_outgoing_at TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  updated_at TEXT NOT NULL DEFAULT (NOW()::text),
  UNIQUE (phone_number)
);
CREATE INDEX IF NOT EXISTS idx_wa_conv_phone ON whatsapp_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_conv_entity ON whatsapp_conversations(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id SERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL,
  direction TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent',
  wa_message_id TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_wa_logs_phone ON whatsapp_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_logs_status ON whatsapp_logs(status);

CREATE TABLE IF NOT EXISTS whatsapp_media (
  id SERIAL PRIMARY KEY,
  wa_message_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  media_data TEXT NOT NULL,
  filename TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_wa_media_msg ON whatsapp_media(wa_message_id);

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  category TEXT NOT NULL DEFAULT 'UTILITY',
  body_text TEXT NOT NULL,
  header_type TEXT DEFAULT 'none',
  header_text TEXT DEFAULT '',
  footer_text TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  updated_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE TABLE IF NOT EXISTS page_views (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  path TEXT NOT NULL,
  session_id TEXT NOT NULL,
  referrer TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  device_type TEXT DEFAULT 'desktop',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_branch ON page_views(branch_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'storefront';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_card_id INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_card_amount DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_refunded DOUBLE PRECISION NOT NULL DEFAULT 0;
-- Remembers the branch an account last worked at so the login picker can
-- pre-select it. Kept as a SET NULL FK so deleting a branch just forgets it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS gift_cards (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  initial_value DOUBLE PRECISION NOT NULL DEFAULT 0,
  balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  expires_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  updated_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);

CREATE TABLE IF NOT EXISTS gift_card_redemptions (
  id SERIAL PRIMARY KEY,
  gift_card_id INTEGER NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id INTEGER,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_gift_redemptions_card ON gift_card_redemptions(gift_card_id);
CREATE INDEX IF NOT EXISTS idx_gift_redemptions_order ON gift_card_redemptions(order_id);

CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  hero_image TEXT NOT NULL DEFAULT '',
  banner_color TEXT NOT NULL DEFAULT '#111827',
  product_ids TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  updated_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_campaigns_slug ON campaigns(slug);

CREATE TABLE IF NOT EXISTS cart_recovery_reminders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  cart_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  channel TEXT NOT NULL DEFAULT 'email',
  order_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_cart_recovery_customer ON cart_recovery_reminders(customer_id);

CREATE TABLE IF NOT EXISTS refunds (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id INTEGER REFERENCES order_items(id) ON DELETE SET NULL,
  product_id TEXT,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);

CREATE TABLE IF NOT EXISTS token_nonces (
  jti TEXT PRIMARY KEY,
  user_role TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  used_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_token_nonces_user ON token_nonces(user_role, user_id);

-- Mirrors migration 0017 so a fresh runSchema() DB is identical to a migrated one.
CREATE TABLE IF NOT EXISTS pages (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_published INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);
CREATE INDEX IF NOT EXISTS idx_pages_published ON pages(is_published);

-- Mirrors migrations 0018 + 0019 so a fresh runSchema() DB is identical to a
-- migrated one (integrations architecture: Gmail/Google OAuth, Daraja/M-Pesa,
-- WhatsApp Cloud API, durable notification queue, inbound webhook ledger).
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
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_customer ON oauth_accounts(customer_id);

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
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_entity ON notification_deliveries(entity_type, entity_id);

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

-- ---------------------------------------------------------------------------
-- Cumulative schema objects (historically applied at boot by the legacy
-- runMigrations() which has been removed). These are now declared here so a
-- FRESH database matches the fully-migrated state, and mirrored idempotently in
-- migration 0020_legacy_schema_reconciler.sql for EXISTING databases.
-- ---------------------------------------------------------------------------

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
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(type);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at);

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
CREATE INDEX IF NOT EXISTS idx_notif_log_event ON notification_log(event_type);
CREATE INDEX IF NOT EXISTS idx_notif_log_channel ON notification_log(channel);
CREATE INDEX IF NOT EXISTS idx_notif_log_status ON notification_log(status);
CREATE INDEX IF NOT EXISTS idx_notif_log_created ON notification_log(created_at);
CREATE INDEX IF NOT EXISTS idx_notif_log_customer ON notification_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_notif_log_idem ON notification_log(idempotency_key);

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

-- Draft/publish separation for the Website Studio.
--   config       = the published config the storefront renders
--   draft_config = the working copy an admin is editing
-- Saving a layout writes draft_config; publishing copies it over config. NULL
-- means "no unpublished edits", so existing rows keep rendering from config
-- and nothing changes until an admin actually saves a draft.
ALTER TABLE storefront_layouts ADD COLUMN IF NOT EXISTS draft_config JSONB;

CREATE TABLE IF NOT EXISTS branch_subscriptions (
  branch_id INTEGER PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
  activated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  status TEXT DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_branch_subscriptions_expires_at ON branch_subscriptions (expires_at);

-- Lipa Mdogo Mdogo (hire-purchase) financing. Mirrors migration 0023 so a fresh
-- runSchema() database is identical to a migrated one. All monetary columns are
-- INTEGER CENTS; payments/adjustments are append-only.
CREATE TABLE IF NOT EXISTS financing_applications (
  id SERIAL PRIMARY KEY,
  application_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  customer_national_id TEXT NOT NULL DEFAULT '',
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL DEFAULT '',
  serial_number TEXT NOT NULL DEFAULT '',
  cash_price_cents INTEGER NOT NULL DEFAULT 0,
  deposit_cents INTEGER NOT NULL DEFAULT 0,
  charge_model TEXT NOT NULL DEFAULT 'fixed',
  charge_fixed_cents INTEGER,
  charge_percent NUMERIC(7,3),
  frequency TEXT NOT NULL DEFAULT 'weekly',
  interval_days INTEGER,
  term_count INTEGER NOT NULL DEFAULT 0,
  start_date TEXT,
  first_due_date TEXT,
  possession_model TEXT NOT NULL DEFAULT 'immediate',
  possession_threshold_cents INTEGER,
  guarantor_name TEXT NOT NULL DEFAULT '',
  guarantor_phone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  consent_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  rejection_reason TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  updated_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_fin_apps_customer ON financing_applications(customer_id);
CREATE INDEX IF NOT EXISTS idx_fin_apps_branch ON financing_applications(branch_id);
CREATE INDEX IF NOT EXISTS idx_fin_apps_status ON financing_applications(status);

CREATE TABLE IF NOT EXISTS financing_agreements (
  id SERIAL PRIMARY KEY,
  agreement_number TEXT NOT NULL UNIQUE,
  application_id INTEGER REFERENCES financing_applications(id) ON DELETE SET NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL DEFAULT '',
  serial_number TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'KES',
  cash_price_cents INTEGER NOT NULL,
  deposit_cents INTEGER NOT NULL DEFAULT 0,
  charge_cents INTEGER NOT NULL DEFAULT 0,
  hp_price_cents INTEGER NOT NULL,
  financed_balance_cents INTEGER NOT NULL,
  instalment_cents INTEGER NOT NULL,
  final_instalment_cents INTEGER NOT NULL,
  term_count INTEGER NOT NULL,
  frequency TEXT NOT NULL,
  interval_days INTEGER,
  start_date TEXT NOT NULL,
  first_due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  ownership_status TEXT NOT NULL DEFAULT 'seller',
  possession_status TEXT NOT NULL DEFAULT 'not_released',
  possession_model TEXT NOT NULL DEFAULT 'immediate',
  possession_threshold_cents INTEGER,
  total_paid_cents INTEGER NOT NULL DEFAULT 0,
  outstanding_cents INTEGER NOT NULL DEFAULT 0,
  credit_cents INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  completed_at TEXT,
  cancelled_at TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  updated_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_fin_agr_customer ON financing_agreements(customer_id);
CREATE INDEX IF NOT EXISTS idx_fin_agr_branch ON financing_agreements(branch_id);
CREATE INDEX IF NOT EXISTS idx_fin_agr_status ON financing_agreements(status);
CREATE INDEX IF NOT EXISTS idx_fin_agr_application ON financing_agreements(application_id);
CREATE INDEX IF NOT EXISTS idx_fin_agr_order ON financing_agreements(order_id);

CREATE TABLE IF NOT EXISTS financing_agreement_items (
  id SERIAL PRIMARY KEY,
  agreement_id INTEGER NOT NULL REFERENCES financing_agreements(id) ON DELETE CASCADE,
  product_id TEXT,
  name TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  line_total_cents INTEGER NOT NULL DEFAULT 0,
  serial_number TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_fin_items_agreement ON financing_agreement_items(agreement_id);

CREATE TABLE IF NOT EXISTS financing_schedules (
  id SERIAL PRIMARY KEY,
  agreement_id INTEGER NOT NULL REFERENCES financing_agreements(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  waived_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  UNIQUE (agreement_id, sequence)
);
CREATE INDEX IF NOT EXISTS idx_fin_sched_agreement ON financing_schedules(agreement_id);
CREATE INDEX IF NOT EXISTS idx_fin_sched_due ON financing_schedules(due_date);
CREATE INDEX IF NOT EXISTS idx_fin_sched_status ON financing_schedules(status);

CREATE TABLE IF NOT EXISTS financing_payments (
  id SERIAL PRIMARY KEY,
  payment_ref TEXT NOT NULL UNIQUE,
  agreement_id INTEGER NOT NULL REFERENCES financing_agreements(id) ON DELETE RESTRICT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'succeeded',
  source TEXT NOT NULL DEFAULT 'admin',
  checkout_request_id TEXT,
  merchant_request_id TEXT,
  mpesa_receipt TEXT,
  mpesa_phone TEXT,
  transaction_ref TEXT,
  notes TEXT NOT NULL DEFAULT '',
  initiated_at TEXT,
  completed_at TEXT,
  received_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_fin_pay_agreement ON financing_payments(agreement_id);
CREATE INDEX IF NOT EXISTS idx_fin_pay_customer ON financing_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_fin_pay_status ON financing_payments(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_pay_receipt ON financing_payments(mpesa_receipt) WHERE mpesa_receipt IS NOT NULL AND mpesa_receipt <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_pay_checkout ON financing_payments(checkout_request_id) WHERE checkout_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS financing_payment_allocations (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER NOT NULL REFERENCES financing_payments(id) ON DELETE RESTRICT,
  schedule_id INTEGER NOT NULL REFERENCES financing_schedules(id) ON DELETE RESTRICT,
  amount_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_fin_alloc_payment ON financing_payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_fin_alloc_schedule ON financing_payment_allocations(schedule_id);

CREATE TABLE IF NOT EXISTS financing_adjustments (
  id SERIAL PRIMARY KEY,
  agreement_id INTEGER NOT NULL REFERENCES financing_agreements(id) ON DELETE RESTRICT,
  payment_id INTEGER REFERENCES financing_payments(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_fin_adj_agreement ON financing_adjustments(agreement_id);

CREATE TABLE IF NOT EXISTS financing_events (
  id SERIAL PRIMARY KEY,
  agreement_id INTEGER REFERENCES financing_agreements(id) ON DELETE CASCADE,
  application_id INTEGER REFERENCES financing_applications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL DEFAULT 'system',
  detail JSONB NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);
CREATE INDEX IF NOT EXISTS idx_fin_events_agreement ON financing_events(agreement_id);
CREATE INDEX IF NOT EXISTS idx_fin_events_application ON financing_events(application_id);
CREATE INDEX IF NOT EXISTS idx_fin_events_type ON financing_events(event_type);

CREATE SEQUENCE IF NOT EXISTS financing_application_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS financing_agreement_seq START 1001;

CREATE INDEX IF NOT EXISTS idx_orders_campaign ON orders(campaign_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_order ON loyalty_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_products_group ON products(group_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
  CREATE INDEX IF NOT EXISTS idx_orders_checkout_request ON orders(checkout_request_id);
  CREATE INDEX IF NOT EXISTS idx_user_branches_branch ON user_branches (branch_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_levels_product_branch ON stock_levels(product_id, COALESCE(branch_id, 0));
