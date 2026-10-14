CREATE TABLE IF NOT EXISTS whatsapp_consent (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT,
  merchant_id BIGINT,
  whatsapp_integration_id BIGINT,
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  opted_out_at TIMESTAMPTZ,
  opted_out_source TEXT,
  consent_granted_at TIMESTAMPTZ,
  consent_source TEXT,
  marketing_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  transactional_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_consent_phone_norm ON whatsapp_consent(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_whatsapp_consent_tenant_merchant ON whatsapp_consent(tenant_id, merchant_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_consent_tenant_phone ON whatsapp_consent(
  COALESCE(tenant_id, -1),
  COALESCE(merchant_id, -1),
  phone_normalized
);
