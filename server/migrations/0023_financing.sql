-- 0023_financing.sql
-- Lipa Mdogo Mdogo (hire-purchase) financing module.
--
-- All monetary columns are INTEGER CENTS (minor units). No floating point is
-- used in the financing ledger; the calculator converts at the boundary only.
-- Payments and adjustments are append-only: rows are never deleted, corrections
-- are written as new adjustment rows referencing the original.

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
-- Idempotency for M-Pesa: a Safaricom receipt and a checkout request may each
-- only ever be applied once, so duplicate callbacks cannot double-credit.
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
