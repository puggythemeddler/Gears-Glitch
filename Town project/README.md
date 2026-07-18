# Town project

This workspace contains the Gear&Glitch storefront, backend services, and supporting documentation.

## Recent updates

### Server-side PDF downloads
Invoices, credit notes, and quotes can be downloaded as real PDF files. Server uses `puppeteer-core` + `@sparticuz/chromium` (lightweight Chromium for serverless). Add `?format=pdf` to any document endpoint to generate a PDF. All frontend buttons (admin invoice View, credit note View, quote Generate PDF, customer Invoice) now trigger file downloads. Falls back to HTML on error.

### Admin messaging panel
New "Messages" section under Operations in the admin panel. Features:
- Conversation list sidebar with partner names, unread badges, last message preview, timestamps
- Chat-style message view with bubble messages, sender labels, timestamps, read receipts (✓/✓✓)
- Inline reply with Enter-to-send
- Compose new messages (pick customer + provider, add subject/body)
- Auto-polls every 30 seconds for new messages
- Notification bell links to the messaging panel

### Feature-gated subscription plans
Plans now carry actual feature flags that control UI visibility and API access. 45+ available features including Messaging, Invoice/quote PDF downloads, Credit notes, Quotations, Branch management, Repair ticketing, Technician accounts, POS integration, Inventory forecasting, Loyalty program, etc. Four default plans (Starter, Growth, Pro, Enterprise) with progressive feature sets. Frontend `useFeature()` hook conditionally shows/hides UI sections. Server-side `requireProviderFeature()` blocks provider API access per plan tier.

### Expanded role permissions
New permissions: `messaging:view`, `messaging:send`, `invoice:view`, `invoice:download`, `credit_note:view`, `credit_note:create`, `quote:view`, `quote:create`, `quote:update`. Default roles (admin, owner, manager, technician) updated with appropriate permission sets.

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

### Cloudinary cleanup on delete
When gallery images, primary images, or entire products are deleted, the corresponding files are automatically removed from Cloudinary. Extracts the `public_id` from the image URL and calls `cloudinary.uploader.destroy()`. Applies to primary image delete, gallery image delete, and full product delete (cleans all associated images). Failures are logged as warnings, never block the request.

### Drag-and-drop gallery reorder
Admin and owner product edit pages support drag-and-drop reordering of gallery images. Visual feedback: dragged image fades to 40%, drop target gets an accent outline. Reorder persists immediately via `PUT /api/products/:id/images/reorder`. Owner gallery also gained a "Set primary" button per image (was missing).

## Responsive updates
- Shared headers and navigation adapt for smaller screens.
- The POS screen stacks the product grid and cart more cleanly on narrow devices.
- Tables, forms, and auth flows use wider, touch-friendly layouts.

## Run locally
- Install dependencies with `npm install` in the project root and in the frontend folder.
- Start the full stack with `npm run dev:all`.
- Validate the app with `npm run typecheck`.
