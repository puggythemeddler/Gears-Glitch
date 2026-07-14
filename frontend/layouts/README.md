# Storefront layout development guide

This project already supports multiple built-in storefront layouts. You can add another one by creating a new module in this folder and registering it in the layout registry.

## 1. Create a layout module
Create a new file such as `frontend/layouts/yourlayout.tsx`.

Your module must export:
- `LAYOUT_KEY`: a unique string such as `yourlayout`
- `LAYOUT_LABEL`: the name shown in the admin UI
- `LAYOUT_DESC`: a short description shown in the admin UI
- `LayoutStyles()`: returns a `<style>` block or `null`
- `Header(props)`: renders the page header
- `Footer(props)`: renders the page footer
- `HomePage(props)`: renders the homepage content

## 2. Register the layout
Import your new module in [frontend/layouts/index.tsx](frontend/layouts/index.tsx) and add it to the `LAYOUTS` registry.

## 3. Use the layout contract
The homepage renderer passes these props to `HomePage`:
- `products`
- `categories`
- `banners`
- `customLayout` (optional, only used when a custom JSON preset is imported)

The shared props for `Header` and `Footer` are:
- `categories`
- `settings`
- `isLoggedIn`
- `userName`
- `cartCount`
- `isDark`
- `toggleDark`
- `logout`
- `isStaff`

## 4. Import a custom layout preset
The admin and owner storefront pages support a JSON import flow.

Paste a JSON object like this into the import box:

```json
{
  "label": "My Layout",
  "heroTitle": "Fresh tech deals",
  "heroSubtitle": "A branded storefront built from a preset",
  "ctaLabel": "Shop now",
  "ctaUrl": "/",
  "accentColor": "#2563eb",
  "heroImageUrl": "",
  "showCategories": true,
  "showProducts": true,
  "productsLimit": 8,
  "productsHeading": "Featured products"
}
```

The imported preset is stored as JSON and activated as the `custom` layout.

## 5. Requirements checklist
- The layout key must be unique.
- The module should be React-compatible and use existing shared helpers where possible.
- The homepage should be resilient to empty products, empty categories, or missing banners.
- Keep the layout responsive for phones and tablets.
- Use semantic markup and accessible labels where possible.
- Keep imports local to the module unless the design truly needs shared utilities.

## 6. Recommended development workflow
1. Build the layout module.
2. Register it in the layout registry.
3. Test it from the admin storefront picker.
4. Import a preset JSON object to verify the dynamic import flow.
5. Refine the responsive breakpoints and content blocks.
