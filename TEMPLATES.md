# Storefront Template Library

Gears&Glitch ships a small library of **original** storefront templates that a
merchant can apply from **Website Studio → (page settings) → Templates**. This
document is the asset + licence inventory and the behaviour contract.

## What a template is

A template is a pure presentation preset for the **Dynamic Engine**:

- hero copy and style (headline, subtitle, badge, buttons, effects)
- an ordered list of sections (`product-grid`, `category-grid`, `banner`,
  `stats`, `text`, `button`, `image`, `features`, `spacer`, `financing-promo`)
- a colour palette and design tokens (radius, accent, motion intensity)
- a product-card presentation preference

A template **never** contains products, prices, stock, orders, customers,
suppliers or any other business data. Applying a template cannot modify business
records because none are referenced.

## Templates (v1)

| Id | Name | Category | Sections | Entitlement |
| --- | --- | --- | --- | --- |
| `tech-grid` | Tech Grid | Tech | categories, products, features, stats, banner | — |
| `minimal-luxe` | Minimal Luxe | Luxe | text, products, spacer, image, text | — |
| `bold-commerce` | Bold Commerce | Commerce | banner, categories, sale products, features, financing | financing add-on |
| `everyday-store` | Everyday Store | Everyday | features, products, categories, text, button | — |

The machine-readable inventory is exported as `TEMPLATE_LICENSING` from
`frontend/lib/templates.ts`; the registry itself is `TEMPLATE_REGISTRY` and is
validated by `validateTemplateRegistry` (run as part of the test suite).

## Licensing and asset governance

- **Origin:** every template is original work by Gears&Glitch. No third-party
  themes, template marketplaces, fonts, icon packs or stock imagery are bundled.
- **SPDX:** `LicenseRef-GearsGlitch-Original` (proprietary, first-party).
- **Bundled assets:** none. Image slots ship empty (`imageUrl: ""`); the merchant
  uploads their own media, so no external media licence is ever implied.
- Icons used by rendered sections come from the app's own existing icon set, not
  from the template data.
- Template copy (headlines, feature blurbs, stat labels) is generic placeholder
  text. Merchants must review and replace it before publishing; nothing in a
  template makes a factual claim about the store's own metrics.

To keep the inventory honest, the test suite asserts every template has
`license.origin === "original"`, an empty `assets` array, and no business-data
keys in its config.

## Apply / revert behaviour

- Applying a template replaces the **draft's** hero and sections with a fresh
  clone of the template config (new section ids). Draft vs published semantics
  are unchanged: the storefront only changes after **Publish**.
- Applying is recorded in the Studio undo history, so `Ctrl/Cmd+Z` — or the
  **Revert last apply** button in the gallery — restores the previous draft.
- Manually editing the draft clears the "Applied" marker, because the design is
  then customised beyond the template.
- Templates are filtered by search and category, and previewed on the existing
  Desktop / Tablet / Mobile canvas switcher before saving.
- Applying a template that requires the financing add-on is disabled unless the
  shop has the entitlement enabled.

## Original vs Dynamic Engine

- **Dynamic Engine** layouts are the only ones driven by a stored, editable
  config, so they are the only ones templates can target.
- The **Original** layout is code-defined (its hero reads a separate hero
  config edited under Storefront → Homepage). Templates do not apply to it and
  the Studio does not offer them there. A merchant who wants a template applies
  it to a Dynamic layout and publishes that.

## Adding a template

1. Add an entry to `TEMPLATE_REGISTRY` in `frontend/lib/templates.ts` using only
   the documented section types and hero styles.
2. Keep `license` as the original-work preset and bundle no media.
3. Run `npx tsx --test tests/templates.test.ts`. The registry validates on the
   test run; an invalid template fails the suite.
