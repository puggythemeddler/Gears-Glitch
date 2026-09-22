-- 0017_pages.sql
-- Add a `pages` table for the Page Builder CMS. One row per storefront page
-- (About, FAQ, landing pages...). Every page owns a kebab-case slug used as its
-- public URL (served under /pages/:slug), a sanitized JSONB layout config, and a
-- publish flag so drafts are never served publicly.
--
-- Idempotent: IF NOT EXISTS skips on re-run.

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