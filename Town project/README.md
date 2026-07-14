# Town project

This workspace contains the Gear&Glitch storefront, backend services, and supporting documentation.

## Responsive updates
Recent updates focus on making the experience work better on phones and tablets:

- Shared headers and navigation adapt for smaller screens.
- The POS screen stacks the product grid and cart more cleanly on narrow devices.
- Tables, forms, and auth flows use wider, touch-friendly layouts.
- Documentation now reflects the current responsive and deployment setup.

## Custom storefront layouts
The storefront can now be extended with a JSON-based custom layout preset.

- Use the admin or owner storefront settings to paste a JSON preset and activate the `custom` layout.
- A starter template is available in [frontend/layouts/CUSTOM_LAYOUT_TEMPLATE.json](frontend/layouts/CUSTOM_LAYOUT_TEMPLATE.json).
- Full implementation notes are in [frontend/layouts/README.md](frontend/layouts/README.md).

## Run locally
- Install dependencies with `npm install` in the project root and in the frontend folder.
- Start the full stack with `npm run dev:all`.
- Validate the app with `npm run typecheck`.

