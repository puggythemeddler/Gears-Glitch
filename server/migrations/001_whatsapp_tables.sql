-- Migration: WhatsApp Cloud API tables
-- Created: 2026-07-19
-- Description: Adds whatsapp_conversations and whatsapp_logs tables for
--   bidirectional WhatsApp messaging via Meta's Cloud API.

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
