import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";
import Icon from "@/components/icons";

// Marketing is operator-only. Set NEXT_PUBLIC_MARKETING_ENABLED=true on the
// main Vercel deployment; client deployments build without it and get a
// "not available" page instead of the full marketing content.
const MARKETING_ENABLED = process.env.NEXT_PUBLIC_MARKETING_ENABLED === "true";

function MarketingDisabled() {
  return (
    <>
      <Head>
        <title>Page not available</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "2rem", textAlign: "center" }}>
        <p style={{ fontSize: "1.1rem", color: "var(--text-secondary)" }}>This page is not available on this store.</p>
        <a href="/" className="btn btn-primary" style={{ marginTop: "1rem" }}>Go to store</a>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
const PROBLEMS = [
  { icon: "box", title: "Inventory Errors", desc: "Manual stock tracking leads to costly discrepancies, overselling, and lost revenue across your entire product range." },
  { icon: "wrench", title: "Repair Tracking Difficulties", desc: "Lost repair tickets, unclear technician assignments, and no way for customers to track progress in real time." },
  { icon: "fileText", title: "Manual Quotations", desc: "Hours wasted creating quotes by hand, inconsistent pricing, and slow responses that drive customers to competitors." },
  { icon: "message", title: "Customer Communication Delays", desc: "Fragmented email threads, missed messages, and no central inbox for repair updates or sales inquiries." },
  { icon: "clipboard", title: "Lost Warranties", desc: "Paper warranty records get misplaced, expiry dates slip through the cracks, and claim handling is a nightmare." },
  { icon: "link", title: "Disconnected Systems", desc: "POS doesn't talk to inventory. Repairs don't talk to accounting. Every department operates in its own silo." },
  { icon: "eye", title: "Poor Stock Visibility", desc: "No real-time view of stock levels across branches, leading to overstocking, stockouts, and tied-up capital." },
  { icon: "receipt", title: "Paper-Based Invoicing", desc: "Manual invoice and receipt creation is slow, error-prone, and doesn't meet KRA eTIMS compliance requirements." },
  { icon: "smartphone", title: "No Mobile-Friendly System", desc: "Your platform only works on desktop, so staff can't check stock, make sales, or update tickets on the floor." },
  { icon: "phone", title: "WhatsApp Chaos", desc: "Customer messages scattered across WhatsApp, email, and phone with no central record or automated delivery tracking." },
];

const SOLUTIONS_BENEFITS = [
  "Single source of truth for your entire business",
  "Faster customer service with instant access to data",
  "Reduced inventory losses with real-time tracking",
  "End-to-end repair lifecycle management",
  "Automated quotations in seconds, not hours",
  "Built-in KRA eTIMS compliant invoicing",
  "Enterprise-grade security and role-based access",
  "Cloud accessible from any device, anywhere",
  "Customer reviews and ratings to build trust and drive sales",
  "Marketing-ready hero with sale countdowns, rotating headlines, search, and WhatsApp chat",
  "WhatsApp Business API for instant customer communication",
  "Responsive design optimized for mobile, tablet, and desktop",
  "Dark / light theme toggle with OS preference detection",
  "Audit log of every admin and owner action for accountability",
  "5 storefront layouts plus a custom JSON layout builder",
  "Gift cards for prepaid revenue and repeat purchases",
  "Campaign landing pages for seasonal promotions",
  "Automated recovery of abandoned carts with reminder emails",
  "Refunds and sales-by-channel insights to stay on top of revenue",
  "Product groups with browsable storefront collections",
  "Annual billing with built-in savings over monthly pricing",
  "Plan upgrade requests with admin approval workflow",
  "Serial-number tracking with barcode scanning for warranties and asset-level stock visibility",
];

const INDUSTRIES = [
  { icon: "laptop", name: "Computer Shops", desc: "Manage PC builds, component inventory, repairs, and sales from one dashboard." },
  { icon: "monitor", name: "Laptop Retailers", desc: "Track warranties, manage stock levels, and offer on-the-spot repairs with full history." },
  { icon: "smartphone", name: "Mobile Phone Stores", desc: "Handle repairs, accessory sales, and customer warranty tracking seamlessly." },
  { icon: "tv", name: "TV & Home Entertainment", desc: "Manage large-item inventory, delivery scheduling, and installation service tickets." },
  { icon: "store", name: "Electronics Superstores", desc: "Multi-branch stock transfers, centralized purchasing, and unified reporting." },
  { icon: "wrench", name: "Repair Centres", desc: "Complete ticket management, technician assignment, and customer self-service portal." },
  { icon: "box", name: "IT Service Companies", desc: "Track assets, manage service contracts, and automate recurring maintenance tasks." },
  { icon: "building", name: "Multi-Branch Retail Chains", desc: "Centralized control with per-branch subscription plans, per-branch stock tracking, stock transfers that actually move inventory, and regional reporting." },
];

type FeatureCat = "sell" | "stock" | "service" | "customers" | "platform";

const FEATURE_CATS: { id: FeatureCat | "all"; label: string }[] = [
  { id: "all", label: "All features" },
  { id: "sell", label: "Sell" },
  { id: "stock", label: "Stock" },
  { id: "service", label: "Service" },
  { id: "customers", label: "Customers" },
  { id: "platform", label: "Platform" },
];

const FEATURES: { icon: string; name: string; desc: string; cat: FeatureCat }[] = [
  { icon: "box", cat: "stock", name: "Inventory Management", desc: "Real-time stock tracking per branch, low-stock alerts, branch-filtered stock views, stock-on-hand counts, inter-branch stock transfers, serial number tracking, and purchase-order receipts that update stock on hand." },
  { icon: "card", cat: "sell", name: "Point of Sale", desc: "Fast, intuitive POS with a paged product grid (12 per page), barcode and serial scanning, an explicit confirm-before-charge step, M-Pesa payment support with a locked awaiting-payment state (verify / retry prompt / switch to cash), 80mm thermal, A4 and PDF receipt options, customer display, and real-time stock deduction from both product and branch inventory." },
  { icon: "wrench", cat: "service", name: "Repair Management", desc: "End-to-end repair lifecycle from drop-off to delivery with technician assignment, cost tracking, and quote generation." },
  { icon: "shield", cat: "service", name: "Warranty Tracking", desc: "Serial number tracking with warranty registration on products, barcode scanning at the point of sale, automatic warranty-expiry calculation, warranty status on invoices, and a serial lookup panel." },
  { icon: "users", cat: "customers", name: "Customer Management", desc: "Customer profiles with purchase history, repair records, order history, and communication log." },
  { icon: "truck", cat: "stock", name: "Supplier Management", desc: "Supplier directory with contact details, linked purchase orders, and stock replenishment tracking." },
  { icon: "clipboard", cat: "stock", name: "Purchase Orders", desc: "Create purchase orders per supplier, receive items into stock on hand with per-line serial intake (scan/type with a count-guard modal or auto-generate batches), one-click Mark All Received, a Recall button that fully reverses a receipt, branded PO/GRV PDF downloads, soft-delete with completed and deleted views, and one-click restore." },
  { icon: "refresh", cat: "stock", name: "Stock Transfers", desc: "Seamless inter-branch transfers with actual stock movement — deducted from source, incremented at destination with dual movement records." },
  { icon: "building", cat: "stock", name: "Multi-Branch Management", desc: "Unified dashboard across all locations with per-branch subscription plans, per-branch stock tracking, stock transfers that actually move inventory, and consolidated reporting." },
  { icon: "chart", cat: "platform", name: "Reports & Analytics", desc: "Sales, employee performance, technician stats, purchase reports, and stock summary with date filtering." },
  { icon: "fileText", cat: "service", name: "Quotation Engine", desc: "Generate professional quotes with line items, discounts, PDF export, and one-click conversion to orders." },
  { icon: "receipt", cat: "sell", name: "KRA eTIMS Invoicing", desc: "Fully compliant invoices and credit notes with control codes, serial numbers, and receipt generation." },
  { icon: "lock", cat: "platform", name: "Role-Based Permissions", desc: "Granular access control for admin, owner, manager, staff, technician, provider, and customer roles. Optional TOTP two-factor authentication for admin accounts." },
  { icon: "bell", cat: "service", name: "Email Notifications", desc: "Automated emails for order status updates, quote delivery, credit notes, password resets, and customer messaging. Single unified email engine with configurable SMTP." },
  { icon: "messageCircle", cat: "customers", name: "WhatsApp Integration", desc: "Bidirectional WhatsApp messaging via Meta Cloud API. Send/receive messages, 24h window tracking, HMAC webhook verification, Kenyan phone normalization, and full conversation logs." },
  { icon: "globe", cat: "sell", name: "Multi-Currency Support", desc: "Display prices in multiple currencies with live exchange rate conversion for international customers." },
  { icon: "smartphone", cat: "sell", name: "M-Pesa Integration", desc: "Accept M-Pesa payments directly through the POS and online checkout with automatic reconciliation. Checkout returns the real STK push state — a sale only completes once payment is confirmed, with retry and switch-to-cash options, never a phantom \"sale completed\"." },
  { icon: "file", cat: "sell", name: "Credit Notes", desc: "Issue KRA-compliant credit notes with eTIMS integration for returns and billing adjustments." },
  { icon: "tag", cat: "sell", name: "Coupons & Discounts", desc: "Create percentage or fixed-amount coupons, apply discounts at checkout, and track usage." },
  { icon: "message", cat: "customers", name: "Messaging System", desc: "Built-in messaging between customers, providers, and staff with real-time notifications and WhatsApp delivery." },
  { icon: "move", cat: "stock", name: "Product Positioning", desc: "Drag-and-drop product ordering to control how items appear on your storefront." },
  { icon: "star", cat: "customers", name: "Product Reviews & Ratings", desc: "Customers rate products 1–5 stars, leave reviews, and help others decide. One review per customer enforced. Admin moderation built in." },
  { icon: "store", cat: "customers", name: "Online Storefront", desc: "5 storefront layouts (Original, Amazon-style, Jumia-style, Mobile, Custom) plus a runtime JSON layout builder for admin-created custom themes. Admin-controllable hero sections (on/off toggle, theme-aware background that follows each visitor's device dark/light theme, and per-theme custom color pickers), live stats from your data, auto-synced category chips, product catalog, auto-rotating carousels, springboard category menu, and an About Us page with owner-editable content." },
  { icon: "zap", cat: "customers", name: "Marketing-Ready Hero", desc: "Turn your homepage hero into a conversion machine: a sale countdown timer that vanishes when the offer ends, rotating headline variants, a WhatsApp chat CTA using your store number, a payment & delivery trust strip (M-Pesa, cards, delivery, warranty), and sale/rating/low-stock badges on featured products — plus animated count-up live stats and a personalized greeting for logged-in customers. Every element has an admin one-click toggle. The hero auto-matches each visitor's dark/light theme, and you can set your own background colors for light and dark themes with automatic text contrast." },
  { icon: "settings", cat: "platform", name: "Dark / Light Theme", desc: "One-tap theme toggle for staff and customers. Respects OS preference on first visit, persists per device, and theme-color meta updates the browser chrome for a native-app feel." },
  { icon: "eye", cat: "platform", name: "Audit Log", desc: "Every admin and owner action is recorded — who created/updated/deleted what, when, and from where. Filterable by user, action, and entity, with a detail view for each entry. Accessible from the Activity group in the staff portal." },
  { icon: "calendar", cat: "platform", name: "Annual Billing Savings", desc: "Subscription plans support both monthly and annual pricing. Owners see both prices side-by-side with the percentage savings for annual billing clearly displayed on the subscription page." },
  { icon: "trendingUp", cat: "platform", name: "Plan Upgrade Requests", desc: "Owners can request a plan upgrade from the subscription page; admins approve or reject requests from the control plane dashboard or the admin panel — full request history is tracked." },
  { icon: "settings", cat: "platform", name: "Organized Settings", desc: "Dedicated Settings tab with 5 focused pages — Store Info, Payments (M-Pesa, methods, exchange rates), Compliance (eTIMS/KRA, Google Sign-In), Content (banners, image storage), and System (backup). Each page handles its own configuration." },
  { icon: "file", cat: "platform", name: "PDF Generation", desc: "Server-side PDF generation for invoices, receipts, quotes, credit notes, and purchase orders — all with your store logo and configurable logo position honored on every template. PO/GRV PDFs title themselves PURCHASE ORDER or GOODS RECEIVED VOUCHER with matching filenames. Separate Print and Save PDF buttons." },
  { icon: "layers", cat: "platform", name: "Feature-Gated Plans", desc: "Subscription plans with grouped feature toggles (11 categories). Disable a feature and it disappears from every panel — staff portal, customer dashboard, and storefront. Pay only for what you use." },
  { icon: "maximize", cat: "customers", name: "Full-Width Storefront", desc: "Layouts span edge-to-edge across the screen with no side gutters on wide displays — modern, full-bleed look. Hero, header, footer, and product grids all stretch to fill the viewport. Inner text columns retain max-widths for readability." },
  { icon: "gift", cat: "sell", name: "Gift Cards", desc: "Issue gift cards with unique codes, balance, and optional expiry. Customers redeem them automatically at checkout — the balance is applied before M-Pesa payment, and every redemption is tracked in a full audit trail." },
  { icon: "megaphone", cat: "customers", name: "Campaign Landing Pages", desc: "Build promotional pages with a hero banner, brand colors, and a curated product grid. No code required — publish and share a dedicated campaign link in minutes." },
  { icon: "cart", cat: "customers", name: "Abandoned Cart Recovery", desc: "See every cart customers left behind in the last 24/48/72 hours, with item previews, and send one-click reminder emails to bring them back to complete their order." },
  { icon: "returns", cat: "sell", name: "Refunds & Returns", desc: "Refund an entire order or individual line items with a reason. Full refund history per order, automatically reflected in order totals." },
  { icon: "pieChart", cat: "sell", name: "Sales by Channel", desc: "Know exactly where your revenue comes from. Every order is tagged Storefront, POS, or Quote, and the sales report breaks down revenue by channel." },
  { icon: "folder", cat: "stock", name: "Product Groups", desc: "Organise products into managed groups with their own public storefront pages. Toggle groups on/off from the admin panel and filter the Sales Report and Stock Summary by group — categories stay optional." },
];

const WHY_CHOOSE = [
  { num: "01", title: "One Platform for Everything", desc: "Inventory, POS, repairs, invoicing, and customer management in a single integrated system." },
  { num: "02", title: "Real-Time Visibility", desc: "Know exactly what's happening across your business at any moment with live dashboards and alerts." },
  { num: "03", title: "Faster Customer Service", desc: "Access complete customer history, stock availability, and pricing in seconds — not minutes." },
  { num: "04", title: "Reduced Inventory Losses", desc: "Real-time tracking, stock takes, and smart alerts minimize shrinkage and overstocking." },
  { num: "05", title: "KRA eTIMS Compliance", desc: "Built-in compliant invoicing with control codes, so you're always ready for audits." },
  { num: "06", title: "Scalable Architecture", desc: "Start with one branch and scale to multiple locations with independent subscription plans per branch — no system changes needed." },
  { num: "07", title: "Cloud Accessibility", desc: "Access your business from any device, anywhere — manage operations remotely with full confidence." },
  { num: "08", title: "Enterprise-Grade Security", desc: "Role-based access, TOTP two-factor authentication, CSRF protection, encrypted data, audit trails, and compliance-ready infrastructure." },
  { num: "09", title: "Per-Branch Flexibility", desc: "Each branch gets its own subscription plan and stock inventory. Different locations can operate independently with features and stock tailored to their needs." },
];

const STATS = [
  { icon: "box", value: 120, suffix: "+", label: "Products Tracked" },
  { icon: "card", value: 5, suffix: "", label: "Payment Methods" },
  { icon: "chart", value: 5, suffix: "+", label: "Report Types" },
  { icon: "target", value: 99, suffix: "%", label: "Inventory Accuracy" },
  { icon: "star", value: 98, suffix: "%", label: "Uptime SLA" },
  { icon: "clock", value: 40, suffix: "%", label: "Average Time Saved" },
];

const TESTIMONIALS = [
  { name: "James K.", role: "Owner, TechCity Nairobi", text: "We went from scattered Excel sheets to a fully integrated system. Repair tracking alone saved us 15 hours a week. The difference is night and day.", rating: 5 },
  { name: "Sarah M.", role: "Operations Manager, GadgetHub", text: "Multi-branch stock transfers used to take days of phone calls. Now it's a few clicks. Real-time visibility across all locations is a game changer.", rating: 5 },
  { name: "David O.", role: "CEO, RapidRepair Centres", text: "The quotation engine alone paid for the platform in the first month. We generate quotes in under 30 seconds now, and our conversion rate went up 34%.", rating: 5 },
  { name: "Grace W.", role: "Operations Lead, CompuCare", text: "The reports and analytics gave us visibility we never had before. We track sales per employee, repair turnaround times, and stock turnover rates.", rating: 5 },
  { name: "Michael N.", role: "Managing Director, ElectroDistributors", text: "KRA eTIMS compliance was a huge concern. Gear&Glitch handles invoices and credit notes with proper control codes — we're always audit-ready.", rating: 5 },
  { name: "Amina S.", role: "CFO, HomeTech Retail", text: "The multi-currency support and M-Pesa integration mean we serve both local and international customers seamlessly. Payment reconciliation is automatic.", rating: 5 },
];

const FAQS = [
  { q: "Is the platform cloud-based?", a: "Yes. Gear&Glitch is fully cloud-based and accessible from any device with a web browser — desktop, tablet, or mobile. No software installation required." },
  { q: "How long does setup take?", a: "Most businesses are up and running within 1-2 days. Import your existing products and customers, configure your branches, and you're ready to go." },
  { q: "Can I import my existing data?", a: "Yes. You can import products, customers, and suppliers through the admin panel. We also support bulk CSV uploads for large catalogs." },
  { q: "How does the repair management work?", a: "Create repair tickets, assign technicians, generate cost quotes, track status through every stage, and notify customers via email and WhatsApp when repairs are ready for collection. Customers can track their repairs in real time." },
  { q: "Is KRA eTIMS compliance built in?", a: "Yes. Every invoice and credit note includes proper eTIMS control codes, serial numbers, and receipt generation. You're always audit-ready." },
  { q: "Can I try before I buy?", a: "Yes. We offer a free Starter plan with core features. Upgrade to Growth, Pro, or Enterprise plans when you need advanced capabilities." },
  { q: "How does multi-branch management work?", a: "Create multiple branches, each with its own subscription plan and stock inventory. Transfer stock between locations (deducted from source, incremented at destination), filter stock views by branch, and view consolidated reports across all branches from a single dashboard. Different branches can operate independently with features tailored to their plan." },
  { q: "What payment methods do you support?", a: "We support M-Pesa mobile money payments through the POS and online checkout. Cash and bank transfer payments are also tracked automatically." },
  { q: "Can I customize the look of my storefront?", a: "Yes. Pick from 5 built-in layouts (Original, Amazon-style, Jumia-style, Mobile, Custom) in admin Settings, or build your own with the runtime JSON layout builder. Control the hero section (badge, headline, rotating headline variants, CTAs, category chips, stats, sale countdown timer, trust strip, WhatsApp button, on/off toggle, and theme-aware background — it follows each visitor's device dark/light theme automatically, or you can pick custom colors for light and dark themes), nav order, footer config, About Us page, store logo, and promotional banners — no code required." },
  { q: "Does it work on mobile?", a: "Yes. Every panel — staff portal, POS, customer dashboard, storefront — is responsive and optimized for mobile, tablet, and desktop. Staff can check stock, make sales, and update repair tickets from a phone on the floor. Customers browsing the storefront get a mobile-optimized layout automatically." },
  { q: "Is there an audit trail?", a: "Yes. Every admin and owner action (create, update, delete) is logged with the user, timestamp, entity, and a diff of changes. The audit log is filterable and available in the Activity group of the staff portal." },
  { q: "Do you offer annual billing?", a: "Yes. Subscription plans support both monthly and annual pricing — the subscription page shows both prices side-by-side with the percentage savings for annual billing clearly displayed." },
];

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function DashboardPreview() {
  return (
    <div className="mk-hero-preview">
      <div className="mk-hero-preview-frame">
        <div className="mk-dashboard-bar">
          <div className="mk-dashboard-dot" />
          <div className="mk-dashboard-dot" />
          <div className="mk-dashboard-dot" />
        </div>
        <div className="mk-dashboard-grid">
          <div className="mk-dashboard-card">
            <div className="mk-dashboard-card-header">
              <span className="mk-dashboard-card-label">Today's Revenue</span>
              <span className="mk-dashboard-card-value">KES 847,200</span>
            </div>
            <div className="mk-dashboard-row">
              <div className="mk-dashboard-stat">
                <div className="mk-dashboard-stat-num">23</div>
                <div className="mk-dashboard-stat-label">Orders</div>
              </div>
              <div className="mk-dashboard-stat">
                <div className="mk-dashboard-stat-num">7</div>
                <div className="mk-dashboard-stat-label">Repairs</div>
              </div>
            </div>
          </div>
          <div className="mk-dashboard-card">
            <div className="mk-dashboard-card-header">
              <span className="mk-dashboard-card-label">Stock Alerts</span>
              <span className="mk-dashboard-card-value">5</span>
            </div>
            <div className="mk-dashboard-row">
              <div className="mk-dashboard-stat">
                <div className="mk-dashboard-stat-num">142</div>
                <div className="mk-dashboard-stat-label">In Stock</div>
              </div>
              <div className="mk-dashboard-stat">
                <div className="mk-dashboard-stat-num">90+</div>
                <div className="mk-dashboard-stat-label">Products</div>
              </div>
            </div>
          </div>
          <div className="mk-dashboard-card mk-dashboard-card-wide">
            <div className="mk-dashboard-card-header">
              <span className="mk-dashboard-card-label">Weekly Sales</span>
            </div>
            <div className="mk-dashboard-bar-chart">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="mk-dashboard-bar-item" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="mk-hero-preview-caption">Illustrative preview with sample data.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */

function Section({
  id,
  label,
  title,
  subtitle,
  children,
  className = "",
}: {
  id?: string;
  label?: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id={id} className={`mk-section ${className}`} ref={ref}>
      {(label || title) && (
        <div className={`mk-section-header mk-reveal ${visible ? "mk-visible" : ""}`}>
          {label && <span className="mk-section-label">{label}</span>}
          {title && <h2 className="mk-section-title">{title}</h2>}
          {subtitle && <p className="mk-section-subtitle">{subtitle}</p>}
        </div>
      )}
      <div className={`mk-reveal ${visible ? "mk-visible" : ""}`}>
        {children}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Counter hook                                                       */
/* ------------------------------------------------------------------ */

function useCountUp(target: number, duration: number, start: boolean): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let frame: number;
    const startTime = performance.now();
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, start]);
  return count;
}

/* ------------------------------------------------------------------ */
/*  FAQ Item                                                           */
/* ------------------------------------------------------------------ */

function FAQItem({ index, q, a, isOpen, onToggle }: { index: number; q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={`mk-faq-item ${isOpen ? "mk-faq-item--open" : ""}`}>
      <button className="mk-faq-question" onClick={onToggle} aria-expanded={isOpen} aria-controls={`mk-faq-panel-${index}`} id={`mk-faq-question-${index}`}>
        <span>{q}</span>
        <Icon name="chevronDown" size={18} className="mk-faq-chevron" />
      </button>
      <div className="mk-faq-answer" id={`mk-faq-panel-${index}`} role="region" aria-labelledby={`mk-faq-question-${index}`} aria-hidden={!isOpen}>
        <div className="mk-faq-answer-inner">{a}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */

const NAV_LINKS = [
  { href: "#challenges", label: "Challenges" },
  { href: "#features", label: "Features" },
  { href: "#industries", label: "Industries" },
  { href: "#testimonials", label: "Testimonials" },
  { href: "#faq", label: "FAQ" },
];

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="mk-header">
      <div className="mk-header-inner">
        <a href="#top" className="mk-brand" onClick={() => setOpen(false)}>
          <span className="mk-brand-mark"><Icon name="gear" size={18} /></span>
          <span className="mk-brand-name">Gear&amp;Glitch</span>
        </a>
        <nav className="mk-nav" aria-label="Marketing navigation">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="mk-nav-link">{l.label}</a>
          ))}
        </nav>
        <div className="mk-header-actions">
          <a href="/login" className="mk-btn mk-btn-secondary mk-btn-sm">Sign in</a>
          <a href="/contact" className="mk-btn mk-btn-primary mk-btn-sm">Book a demo</a>
          <button
            type="button"
            className="mk-nav-toggle"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? "x" : "menu"} size={22} />
          </button>
        </div>
      </div>
      {open && (
        <nav className="mk-nav-mobile" aria-label="Marketing navigation (mobile)">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="mk-nav-mobile-link" onClick={() => setOpen(false)}>{l.label}</a>
          ))}
        </nav>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function MarketingPage() {
  if (!MARKETING_ENABLED) return <MarketingDisabled />;
  return <MarketingContent />;
}

function MarketingContent() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [featureCat, setFeatureCat] = useState<FeatureCat | "all">("all");
  const statsRef = useRef<HTMLDivElement>(null);

  const countBusinesses = useCountUp(90, 2000, statsVisible);
  const countProducts = useCountUp(5, 2500, statsVisible);
  const countRepairs = useCountUp(5, 2000, statsVisible);
  const countAccuracy = useCountUp(99, 1500, statsVisible);
  const countSatisfaction = useCountUp(98, 1500, statsVisible);
  const countTimeSaved = useCountUp(40, 1800, statsVisible);

  const counts = [countBusinesses, countProducts, countRepairs, countAccuracy, countSatisfaction, countTimeSaved];

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStatsVisible(true); obs.disconnect(); } },
      { threshold: 0, rootMargin: "0px 0px -20% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const visibleFeatures = featureCat === "all" ? FEATURES : FEATURES.filter((f) => f.cat === featureCat);

  return (
    <div className="mk-page" id="top">
      <a className="mk-skip-link" href="#challenges">Skip to content</a>

      <Header />

      {/* ================================================================
          HERO
      ================================================================ */}
      <section className="mk-hero">
        <div className="mk-hero-inner">
          <div className="mk-hero-copy">
            <p className="mk-hero-announce">
              <span className="mk-hero-announce-dot" />
              KRA eTIMS-compliant invoicing now built in
            </p>
            <h1 className="mk-hero-title">
              Run your entire electronics business from one platform
            </h1>
            <p className="mk-hero-sub">
              Inventory, point of sale, purchase orders, repair management, customer relationships,
              KRA-compliant invoicing, and customer reviews — all seamlessly integrated. No more disconnected
              systems. No more manual data entry.
            </p>
            <div className="mk-hero-actions">
              <a className="mk-btn mk-btn-primary mk-btn-lg" href="/contact">
                Book a Demo
              </a>
              <a className="mk-btn mk-btn-secondary mk-btn-lg" href="/login">
                Start Free Trial
              </a>
            </div>
            <p className="mk-hero-note">Free Starter plan · No credit card required · Setup in 1–2 days</p>
          </div>
          <DashboardPreview />
        </div>
      </section>

      {/* ================================================================
          PROBLEM
      ================================================================ */}
      <Section
        id="challenges"
        label="The Challenge"
        title="The real cost of disconnected systems"
        subtitle="Electronics businesses face unique operational challenges that multiply when your tools don't work together."
        className="mk-section--tinted"
      >
        <div className="mk-challenge-list">
          {PROBLEMS.map((p, i) => (
            <div key={i} className="mk-challenge">
              <span className="mk-challenge-icon"><Icon name={p.icon} /></span>
              <div>
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ================================================================
          SOLUTION
      ================================================================ */}
      <Section
        id="solution"
        label="The Solution"
        title="One platform. Every branch. Zero silos."
        subtitle="Gear&Glitch unifies every aspect of your electronics business into a single, intelligent platform."
      >
        <div className="mk-solution-content">
          <div className="mk-solution-branches">
            <div className="mk-solution-branch">
              <div className="mk-branch-name">Branch 1</div>
              <div className="mk-branch-modules">
                <span className="mk-branch-module"><Icon name="card" size={14} /> POS</span>
                <span className="mk-branch-module"><Icon name="box" size={14} /> Stock</span>
              </div>
            </div>
            <div className="mk-solution-branch">
              <div className="mk-branch-name">Branch 2</div>
              <div className="mk-branch-modules">
                <span className="mk-branch-module"><Icon name="wrench" size={14} /> Repairs</span>
                <span className="mk-branch-module"><Icon name="users" size={14} /> Customers</span>
              </div>
            </div>
            <div className="mk-solution-branch">
              <div className="mk-branch-name">Branch N</div>
              <div className="mk-branch-modules">
                <span className="mk-branch-module"><Icon name="chart" size={14} /> Reports</span>
                <span className="mk-branch-module"><Icon name="refresh" size={14} /> Transfers</span>
              </div>
            </div>
          </div>

          <div className="mk-solution-connectors" aria-hidden="true">
            <span className="mk-connector-line" />
            <span className="mk-connector-line" />
            <span className="mk-connector-line" />
          </div>

          <div className="mk-solution-hub">
            <div className="mk-solution-hub-icon"><Icon name="zap" size={22} /></div>
            <div className="mk-solution-hub-title">Gear&amp;Glitch Unified Platform</div>
            <div className="mk-solution-hub-tagline">Central hub — every branch, one source of truth</div>
          </div>

          <div className="mk-solution-downstream">
            <div className="mk-downstream-item"><Icon name="users" size={15} /> Unified Customers</div>
            <div className="mk-downstream-item"><Icon name="chart" size={15} /> Consolidated Reports</div>
            <div className="mk-downstream-item"><Icon name="globe" size={15} /> Multi-Currency</div>
            <div className="mk-downstream-item"><Icon name="lock" size={15} /> Global Admin</div>
          </div>
        </div>

        <ul className="mk-solution-benefits">
          {SOLUTIONS_BENEFITS.map((b, i) => (
            <li key={i} className="mk-solution-benefit">
              <span className="mk-solution-benefit-check"><Icon name="check" size={13} /></span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ================================================================
          FEATURES
      ================================================================ */}
      <Section
        id="features"
        label="Features"
        title="Everything you need to succeed"
        subtitle="Thirty-eight powerful modules that work together to run every part of your electronics business."
        className="mk-section--tinted"
      >
        <div className="mk-feature-filter" role="tablist" aria-label="Filter features by category">
          {FEATURE_CATS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={featureCat === c.id}
              className={`mk-filter-chip ${featureCat === c.id ? "mk-filter-chip--active" : ""}`}
              onClick={() => setFeatureCat(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="mk-features-grid">
          {visibleFeatures.map((f, i) => (
            <div key={`${featureCat}-${i}`} className="mk-feature-card">
              <span className="mk-feature-icon"><Icon name={f.icon} /></span>
              <h3>{f.name}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ================================================================
          INDUSTRIES
      ================================================================ */}
      <Section
        id="industries"
        label="Industries"
        title="Built for every electronics business"
        subtitle="From one-person repair shops to multinational retail chains — our platform adapts to your workflow."
      >
        <div className="mk-industries-grid">
          {INDUSTRIES.map((ind, i) => (
            <div key={i} className="mk-industry-card">
              <span className="mk-industry-icon"><Icon name={ind.icon} /></span>
              <div>
                <h3>{ind.name}</h3>
                <p>{ind.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ================================================================
          WHY CHOOSE
      ================================================================ */}
      <Section
        id="why-choose"
        label="Why Choose Us"
        title="The clear advantage"
        subtitle="We've built this platform from the ground up for electronics businesses. Here's why teams choose Gear&Glitch."
      >
        <div className="mk-why-grid">
          {WHY_CHOOSE.map((w, i) => (
            <div key={i} className="mk-why-card">
              <div className="mk-why-number">{w.num}</div>
              <h3>{w.title}</h3>
              <p>{w.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ================================================================
          STATS
      ================================================================ */}
      <section className="mk-stats" ref={statsRef}>
        <div className="mk-stats-inner">
          <div className={`mk-stats-header mk-reveal${statsVisible ? " mk-visible" : ""}`}>
            <span className="mk-stats-label">By the numbers</span>
            <h2 className="mk-stats-title">Trusted by the industry</h2>
            <p className="mk-stats-subtitle">
              Real results from real businesses using Gear&amp;Glitch every day.
            </p>
          </div>
          <div className="mk-stats-grid">
            {STATS.map((s, i) => (
              <div key={i} className={`mk-stat-card mk-reveal${statsVisible ? " mk-visible" : ""}`} style={{ transitionDelay: `${i * 0.1}s` }}>
                <Icon name={s.icon} size={22} className="mk-stat-icon" />
                <div className="mk-stat-number">
                  {counts[i].toLocaleString()}
                  <span className="mk-stat-plus">{s.suffix}</span>
                </div>
                <div className="mk-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          TESTIMONIALS
      ================================================================ */}
      <Section
        id="testimonials"
        label="Testimonials"
        title="What our customers say"
        subtitle="Hear from the businesses that transformed their operations with Gear&Glitch."
      >
        <div className="mk-testimonials-grid">
          {TESTIMONIALS.map((t, i) => (
            <figure key={i} className="mk-testimonial-card">
              <div className="mk-testimonial-stars" aria-hidden="true">{Array.from({ length: t.rating }).map((_, j) => (<span key={j}><Icon name="star" size={14} className="mk-star-filled" /></span>))}</div>
              <div className="mk-sr-only">{t.rating} out of 5 stars</div>
              <blockquote className="mk-testimonial-text">{t.text}</blockquote>
              <figcaption className="mk-testimonial-author">
                <div className="mk-testimonial-avatar" aria-hidden="true">{t.name.charAt(0)}</div>
                <div>
                  <div className="mk-testimonial-name">{t.name}</div>
                  <div className="mk-testimonial-role">{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* ================================================================
          FAQ
      ================================================================ */}
      <Section
        id="faq"
        label="FAQ"
        title="Frequently asked questions"
        subtitle="Everything you need to know about getting started with Gear&Glitch."
        className="mk-section--tinted"
      >
        <div className="mk-faq-list">
          {FAQS.map((faq, i) => (
            <FAQItem
              key={i}
              index={i}
              q={faq.q}
              a={faq.a}
              isOpen={openFaq === i}
              onToggle={() => setOpenFaq(openFaq === i ? null : i)}
            />
          ))}
        </div>
      </Section>

      {/* ================================================================
          CTA
      ================================================================ */}
      <section className="mk-cta">
        <h2>Ready to transform your business?</h2>
        <p>
          Join electronics businesses that have streamlined their
          operations, reduced costs, and grown revenue with Gear&amp;Glitch.
        </p>
        <div className="mk-cta-actions">
          <a className="mk-btn mk-btn-primary mk-btn-lg" href="/contact">
            Book a Demo
          </a>
          <a className="mk-btn mk-btn-secondary mk-btn-lg" href="/login">
            Start Free Trial
          </a>
        </div>
        <p className="mk-cta-note">Free Starter plan available. No credit card required. Upgrade anytime as your business grows.</p>
      </section>

      {/* ================================================================
          FOOTER
      ================================================================ */}
      <footer className="mk-footer">
        <div className="mk-footer-inner">
          <div className="mk-footer-brand-col">
            <div className="mk-footer-brand">
              <span className="mk-brand-mark"><Icon name="gear" size={18} /></span>
              Gear&amp;Glitch
            </div>
            <p className="mk-footer-tagline">The intelligent platform for electronics businesses.</p>
          </div>
          <nav className="mk-footer-col" aria-label="Product">
            <h3>Product</h3>
            <a href="#features">Features</a>
            <a href="#industries">Industries</a>
            <a href="#why-choose">Why Gear&amp;Glitch</a>
            <a href="#faq">FAQ</a>
          </nav>
          <nav className="mk-footer-col" aria-label="Company">
            <h3>Company</h3>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
            <a href="/login">Sign in</a>
          </nav>
          <div className="mk-footer-copy">
            &copy; {new Date().getFullYear()} Gear&amp;Glitch. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
}
