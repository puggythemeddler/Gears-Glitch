-- 0029: normalise legacy section `type` aliases in stored storefront layouts.
--
-- Before the Dynamic Engine section union stabilised, drafts could persist
-- `type: "categories"`, which the renderer does not recognise (it renders
-- `category-grid`). New writes keep accepting the alias for backward
-- compatibility (see server/template-validate.ts), so stored rows are remapped
-- here to close the loop and ensure no layout carries a dead section type.
--
-- Idempotent: re-running finds no matching rows and changes nothing. Only
-- `sections[].type === 'categories'` is rewritten; every other field, section
-- and the array order are preserved exactly.

UPDATE storefront_layouts
SET config = jsonb_set(
  config,
  '{sections}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN elem->>'type' = 'categories'
            THEN jsonb_set(elem, '{type}', '"category-grid"'::jsonb)
          ELSE elem
        END
        ORDER BY ord
      )
      FROM jsonb_array_elements(config->'sections') WITH ORDINALITY AS t(elem, ord)
    ),
    config->'sections'
  )
)
WHERE jsonb_typeof(config->'sections') = 'array'
  AND config->'sections' @> '[{"type":"categories"}]';

UPDATE storefront_layouts
SET draft_config = jsonb_set(
  draft_config,
  '{sections}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN elem->>'type' = 'categories'
            THEN jsonb_set(elem, '{type}', '"category-grid"'::jsonb)
          ELSE elem
        END
        ORDER BY ord
      )
      FROM jsonb_array_elements(draft_config->'sections') WITH ORDINALITY AS t(elem, ord)
    ),
    draft_config->'sections'
  )
)
WHERE jsonb_typeof(draft_config->'sections') = 'array'
  AND draft_config->'sections' @> '[{"type":"categories"}]';
