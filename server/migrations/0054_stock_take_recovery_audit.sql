ALTER TABLE stock_take_sessions
  ADD COLUMN IF NOT EXISTS reversed_at TEXT;

CREATE TABLE IF NOT EXISTS stock_take_events (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES stock_take_sessions(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('reopened', 'reversed')),
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
);

CREATE INDEX IF NOT EXISTS idx_stock_take_events_session
  ON stock_take_events(session_id, id);
