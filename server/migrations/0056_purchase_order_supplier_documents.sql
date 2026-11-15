CREATE TABLE IF NOT EXISTS purchase_order_documents (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('supplier_quote', 'supplier_purchase_order', 'invoice', 'delivery_note')),
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  sha256 TEXT NOT NULL,
  file_data BYTEA,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TEXT NOT NULL DEFAULT (NOW()::text),
  removed_at TEXT,
  removed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_po_documents_order
  ON purchase_order_documents(purchase_order_id, uploaded_at DESC)
  WHERE removed_at IS NULL;
