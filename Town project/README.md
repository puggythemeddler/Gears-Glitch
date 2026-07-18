# Town project

This workspace contains the Gear&Glitch storefront, backend services, and supporting documentation.

## Recent updates

### Marketing page
Full marketing landing page with problems, solutions, industries, features (22 real modules), testimonials, stats, FAQ, and CTA. All content verified against actual implemented features. Dashboard preview uses KES currency.

### Annual pricing for subscription plans
Subscription plans now support both monthly and annual pricing. `subscription_plans` table has `price_annual` column. Admin plans UI shows both Monthly and Annual price fields. Owner subscription page redesigned with both prices, savings percentage, and plan comparison cards.

### Multi-currency feature gating
`CurrencySelector` checks `useFeature("Multi-currency support")` and returns null when the plan doesn't include it. Currency dropdown disappears from storefront entirely for plans without this feature. Added to Growth, Pro, and Enterprise features. Starter has no multi-currency.

### Provider PIN fix
Removed `PinLock` from dashboard page. Providers now log in and see the dashboard immediately. PIN lock only appears when clicking POS (which has its own PinLock).

### Server-side PDF downloads
Invoices, credit notes, and quotes can be downloaded as real PDF files. Server uses `puppeteer-core` + `@sparticuz/chromium` (lightweight Chromium for serverless). Add `?format=pdf` to any document endpoint to generate a PDF. All frontend buttons trigger file downloads. Falls back to HTML on error.

### Admin messaging panel
Conversation list sidebar with partner names, unread badges, last message preview, timestamps. Chat-style message view with bubble messages, sender labels, timestamps, read receipts. Inline reply with Enter-to-send. Compose new messages. Auto-polls every 30 seconds.

### Feature-gated subscription plans
Plans carry feature flags that control UI visibility and API access. 48+ available features including Messaging, Invoice/quote PDF downloads, Credit notes, Quotations, Branch management, Repair ticketing, Technician accounts, Product positioning, Multi-currency support, Email notifications, etc. Four default plans (Starter, Growth, Pro, Enterprise) with progressive feature sets. Admin panel always shows ALL features; owner panel is gated by plan.

### Expanded role permissions
New permissions: `messaging:view`, `messaging:send`, `invoice:view`, `invoice:download`, `credit_note:view`, `credit_note:create`, `quote:view`, `quote:create`, `quote:update`. Default roles (admin, owner, manager, technician) updated with appropriate permission sets.

### Sale price / strikethrough pricing
Products support an optional sale price. When set, the original price shows with strikethrough and the sale price appears in red across all UI surfaces. POS charges the sale price automatically.

### Promotional banners / Splashes
Admin can create marquee or promotional banners with custom background/text colors, active date ranges, and on/off toggle. Quick presets for Black Friday, Happy Hour, Christmas, New Year Sale, and Back to School.

### Kenyan holiday calendar
Auto-displayed marquee banners for 12 Kenyan public holidays with Kenya flag-themed gradient colors and catchy taglines, plus seasonal auto-banners.

### Store logo on all documents
Logo upload via admin Settings with configurable position. Logo appears on POS receipts, customer invoices, admin order invoices, credit notes, and quote PDFs.

### Auto-email system
Full email notification framework with Nodemailer transport. HTML email templates for messages, quotes, credit notes, order status changes. Owner CC on customer-provider messages. Email logs tracked. Toggle on/off from admin Settings.

### Product positioning editor
Drag-and-drop product reorder for storefront. Feature-gated via "Product positioning" in plan features.

### Cloudinary cleanup on delete
Automatic removal of Cloudinary images when gallery images, primary images, or entire products are deleted.

## Responsive updates
- Shared headers and navigation adapt for smaller screens.
- The POS screen stacks the product grid and cart more cleanly on narrow devices.
- Tables, forms, and auth flows use wider, touch-friendly layouts.

## Run locally
- Install dependencies with `npm install` in the project root and in the frontend folder.
- Start the full stack with `npm run dev:all`.
- Validate the app with `npm run typecheck`.
