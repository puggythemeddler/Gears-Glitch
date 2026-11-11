ALTER TABLE stock_take_sessions
  ADD COLUMN IF NOT EXISTS applied_at TEXT;
