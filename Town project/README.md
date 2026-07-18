# Town project

This workspace contains the Gear&Glitch storefront, backend services, and supporting documentation.

## Recent updates

### Sale price / strikethrough pricing
Products support an optional sale price. When set, the original price shows with strikethrough and the sale price appears in red across product cards, product detail pages, POS grid, owner products table, and admin products table. POS automatically charges the sale price when adding to cart.

### Promotional banners / Splashes
Admin can create marquee or promotional banners with custom background/text colors, active date ranges, and on/off toggle. Quick presets for Black Friday, Happy Hour, Christmas, New Year Sale, and Back to School. Banners display above the site header.

### Kenyan holiday calendar
Auto-displayed marquee banners for 12 Kenyan public holidays with Kenya flag-themed gradient colors and catchy taglines:
- New Year's Day (Jan 1) — Green/Black/Red gradient
- Eid el-Fitr (variable) — Green
- Good Friday (variable) — Black/Gold
- Easter Monday (variable) — Green/Red
- Labour Day (May 1) — Red/Black
- Madaraka Day (Jun 1) — Black/Red/Green/White
- Eid el-Adha (variable) — Green
- Mazingira Day (Oct 10) — Green
- Black Friday (Nov 20-30) — Black/Gold
- Jamhuri Day (Dec 12) — Black/Red/Green/White
- Christmas Day (Dec 25) — Red
- Boxing Day (Dec 26) — Red/Green

Plus seasonal auto-banners: Christmas Season (Dec 15-24), Year End Sale (Dec 26-31), New Year Sale (Jan 1-7).

### Store logo on all documents
Logo upload via admin Settings with configurable position (top-left/top-middle/top-right). Logo appears on:
- POS thermal receipt
- POS A4 invoice
- Customer invoice
- Admin order invoice
- Credit note
- Quote PDF

### FK cascade fix for product deletion
All product-referencing tables now use `ON DELETE CASCADE`, fixing the 502 crash when deleting products with order/quote/stock history. 37 old placeholder products cleaned up.

## Responsive updates
- Shared headers and navigation adapt for smaller screens.
- The POS screen stacks the product grid and cart more cleanly on narrow devices.
- Tables, forms, and auth flows use wider, touch-friendly layouts.

## Run locally
- Install dependencies with `npm install` in the project root and in the frontend folder.
- Start the full stack with `npm run dev:all`.
- Validate the app with `npm run typecheck`.
