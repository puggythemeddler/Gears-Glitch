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
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const NAV_LINKS = [
  { href: "#products", label: "Products" },
  { href: "#solutions", label: "Solutions" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "Resources" },
];

const LIFE_CYCLE = [
  { num: "01", icon: "store", title: "SELL", desc: "Counter, web, or WhatsApp. Sales ring up in seconds and settle by M-Pesa or card, on a standard tax receipt." },
  { num: "02", icon: "box", title: "TRACK", desc: "Stock is branch-accurate. Every sale, transfer, delivery, and repair part updates your on-hand numbers in real time." },
  { num: "03", icon: "wrench", title: "SERVICE", desc: "What you sell becomes an asset. Repairs, quotes, and technician work attach to the item — not to anyone&apos;s memory." },
  { num: "04", icon: "shield", title: "WARRANTY", desc: "Coverage starts at the sale and follows the serial number. Claims share a screen with the purchase and the repairs." },
];

const HERO_STATS = [
  { label: "Sales", value: "KES 4,825,000", primary: true, delta: "+12% vs last month", tone: "up" },
  { label: "Orders", value: "148", delta: "27 open right now", tone: "muted" },
  { label: "Low stock", value: "12", delta: "Need reordering", tone: "warn" },
  { label: "Open repairs", value: "23", delta: "9 waiting on parts", tone: "muted" },
  { label: "Warranty claims", value: "4", delta: "1 almost due", tone: "muted" },
];

const REPAIR_TICKETS = [
  { id: "#REP-10482", item: "Dell Latitude 5420", status: "Awaiting parts", statusTone: "warning", warranty: "Active", warrantyTone: "success" },
  { id: "#REP-10481", item: "HP LaserJet Pro", status: "Repair approved", statusTone: "info", warranty: "Active", warrantyTone: "success" },
  { id: "#REP-10480", item: `Samsung 55" TV`, status: "Completed", statusTone: "muted", warranty: "Expired", warrantyTone: "subtle" },
];

const WHO_IT_IS_FOR = [
  { icon: "laptop", name: "Computer Shops", desc: "PC builds, component stock, repairs, and sales in one place." },
  { icon: "monitor", name: "Laptop Retailers", desc: "Track warranties and stock, and offer on-the-spot repairs with full history." },
  { icon: "smartphone", name: "Mobile Phone Stores", desc: "Handle repairs, accessory sales, and warranty tracking without gaps." },
  { icon: "tv", name: "TV & Home Entertainment", desc: "Manage large-item stock, delivery scheduling, and installation tickets." },
  { icon: "store", name: "Electronics Superstores", desc: "Multi-branch transfers and unified reporting across every location." },
  { icon: "wrench", name: "Repair Centres", desc: "Ticket management, technician assignment, and customer self-service." },
  { icon: "briefcase", name: "IT Service Companies", desc: "Track assets, manage service contracts, and automate maintenance." },
  { icon: "building", name: "Multi-Branch Chains", desc: "Centralized control with per-branch stock and independent plans." },
];

const CONTROL_METRICS = [
  { value: "92", label: "Businesses on the platform" },
  { value: "4", label: "Plan tiers, feature-gated" },
  { value: "1.2 days", label: "Median setup time" },
  { value: "KES 1.9M", label: "Monthly platform revenue" },
];

const CONTROL_ROWS = [
  { name: "TechCity Nairobi", plan: "Growth", status: "Healthy", tone: "success" },
  { name: "GadgetHub", plan: "Pro", status: "Healthy", tone: "success" },
  { name: "RapidRepair", plan: "Growth · Trial (14 days left)", status: "Trial", tone: "info" },
  { name: "ElectroDistributors", plan: "Enterprise", status: "Needs attention", tone: "warning" },
];

const PLANS = [
  {
    name: "Starter",
    desc: "For your first shop",
    price: "KES 0",
    period: "free forever",
    annual: null,
    popular: false,
    cta: "Start free",
    href: "/login",
    features: ["Up to 50 products", "1 branch", "Orders & PDF invoices", "Messaging & email alerts", "Customer reviews"],
  },
  {
    name: "Growth",
    desc: "For growing businesses",
    price: "KES 4,999",
    period: "per month",
    annual: "KES 47,990/yr — save 20%",
    popular: false,
    cta: "Start free trial",
    href: "/login",
    features: ["Up to 500 products", "3 branches", "Quotations & credit notes", "Analytics dashboard", "Multi-currency pricing", "Storefront hero tools"],
  },
  {
    name: "Pro",
    desc: "For established shops",
    price: "KES 12,999",
    period: "per month",
    annual: "KES 124,790/yr — save 20%",
    popular: true,
    cta: "Start free trial",
    href: "/login",
    features: ["Unlimited products", "10 branches", "Repair ticketing & technicians", "POS integration", "Loyalty & inventory forecasting", "Custom branding"],
  },
  {
    name: "Enterprise",
    desc: "For large operations",
    price: "KES 29,999",
    period: "per month",
    annual: "KES 287,990/yr — save 20%",
    popular: false,
    cta: "Talk to sales",
    href: "/contact",
    features: ["Everything in Pro", "Up to 999 branches", "Stock transfers & suppliers", "Dedicated support", "Custom integrations"],
  },
];

const FAQS = [
  { q: "Is the platform cloud-based?", a: "Yes. Gear&Glitch runs in the cloud and works from any device with a browser — desktop, tablet, or mobile. There is nothing to install." },
  { q: "How long does setup take?", a: "Most businesses are live within a day or two. Import your existing products and customers, configure your branches, and start selling." },
  { q: "Can I import my existing data?", a: "Yes. Import products, customers, and suppliers through the admin panel, including bulk CSV uploads for large catalogs." },
  { q: "How do repairs work?", a: "Create a ticket, assign a technician, generate a quote, and track every stage until collection. Customers get updates by email and WhatsApp, and can track progress themselves." },
  { q: "How does warranty tracking work?", a: "Coverage is registered at the point of sale against the item's serial number. A dedicated Warranty panel shows every active, expiring, and expired warranty in your store — searchable by customer, product, or serial — so claims are decided in seconds, not an argument." },
  { q: "Is KRA eTIMS compliance built in?", a: "Not yet. eTIMS submission is disabled until a production KRA adapter ships — invoices print as standard tax documents with a full VAT breakdown, but nothing is submitted to KRA or marked as eTIMS-compliant today." },
  { q: "Can I try before I buy?", a: "Yes. The Starter plan is free and includes core features. Upgrade to Growth, Pro, or Enterprise whenever you need more." },
];

/* ------------------------------------------------------------------ */
/*  Building blocks                                                    */
/* ------------------------------------------------------------------ */

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`mk-badge mk-badge--${tone}`}>{children}</span>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mk-panel">
      <div className="mk-panel-bar">
        <span className="mk-panel-dot" />
        <span className="mk-panel-dot" />
        <span className="mk-panel-dot" />
        <span className="mk-panel-title">{title}</span>
      </div>
      <div className="mk-panel-body">{children}</div>
    </div>
  );
}

function Section({
  id,
  label,
  title,
  subtitle,
  children,
  className = "",
  center = false,
}: {
  id?: string;
  label?: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  center?: boolean;
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
      <div className="mk-container">
        {(label || title) && (
          <div className={`mk-section-header${center ? " mk-section-header--center" : ""} mk-reveal ${visible ? "mk-visible" : ""}`}>
            {label && <span className="mk-eyebrow">{label}</span>}
            {title && <h2 className="mk-section-title">{title}</h2>}
            {subtitle && <p className="mk-section-subtitle">{subtitle}</p>}
          </div>
        )}
        <div className={`mk-reveal ${visible ? "mk-visible" : ""}`}>
          {children}
        </div>
      </div>
    </section>
  );
}

function SplitSection({
  id,
  eyebrow,
  title,
  sub,
  bullets,
  media,
  flip = false,
  tinted = false,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  sub: string;
  bullets: { icon: string; title: string; desc: string }[];
  media: React.ReactNode;
  flip?: boolean;
  tinted?: boolean;
}) {
  return (
    <Section id={id} className={tinted ? "mk-section--tinted" : ""}>
      <div className={`mk-split${flip ? " mk-split--flip" : ""}`}>
        <div className="mk-split-copy">
          <span className="mk-eyebrow">{eyebrow}</span>
          <h2 className="mk-split-title">{title}</h2>
          <p className="mk-split-sub">{sub}</p>
          <div className="mk-bullets">
            {bullets.map((b) => (
              <div key={b.title} className="mk-bullet">
                <span className="mk-bullet-icon"><Icon name={b.icon} size={18} /></span>
                <div>
                  <h3>{b.title}</h3>
                  <p>{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mk-split-media">{media}</div>
      </div>
    </Section>
  );
}

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
          <a href="/login" className="mk-btn mk-btn-secondary mk-btn-sm secondary-hide-sm">Login</a>
          <a href="/login" className="mk-btn mk-btn-primary mk-btn-sm">Get started</a>
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
          <div className="mk-nav-mobile-ctas">
            <a href="/login" className="mk-btn mk-btn-secondary mk-btn-sm" onClick={() => setOpen(false)}>Login</a>
            <a href="/login" className="mk-btn mk-btn-primary mk-btn-sm" onClick={() => setOpen(false)}>Get started</a>
          </div>
        </nav>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

function HeroDashboardPanel() {
  return (
    <div className="mk-hero-preview">
      <Panel title="Gear&Glitch · Dashboard · Nairobi HQ">
        <div className="mk-kpis">
          {HERO_STATS.map((s) => (
            <div key={s.label} className={`mk-kpi${s.primary ? " mk-kpi--primary" : ""}`}>
              <div className="mk-kpi-label">{s.label}</div>
              <div className="mk-kpi-value">{s.value}</div>
              {s.delta && <div className={`mk-kpi-delta${s.tone === "warn" ? " mk-kpi-delta--warn" : ""}${s.tone === "muted" ? " mk-kpi-delta--muted" : ""}`}>{s.delta}</div>}
            </div>
          ))}
        </div>
        <p className="mk-eyebrow">Open repairs</p>
        <div className="mk-table-scroll">
          <table className="mk-table">
            <thead>
              <tr>
                <th>Repair</th>
                <th>Item</th>
                <th>Status</th>
                <th>Warranty</th>
              </tr>
            </thead>
            <tbody>
              {REPAIR_TICKETS.map((r) => (
                <tr key={r.id}>
                  <td className="mk-cell-strong">{r.id}</td>
                  <td>{r.item}</td>
                  <td><Badge tone={r.statusTone}>{r.status}</Badge></td>
                  <td><Badge tone={r.warrantyTone}>{r.warranty}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <a className="mk-inline-link" href="#products">All repairs <Icon name="arrowRight" size={14} /></a>
      </Panel>
      <p className="mk-panel-caption">The Gear&Glitch dashboard behind every shop — sample data.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Product panels (drawn with the app's own UI tokens)                */
/* ------------------------------------------------------------------ */

function CommercePanel() {
  return (
    <Panel title="Point of Sale · Nairobi HQ">
      <div className="mk-row-chip mk-badge--subtle" style={{ marginBottom: "var(--space-3)" }}>Order #GG-7285 · Open</div>
      <div className="mk-table-scroll">
        <table className="mk-table">
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Price</th></tr>
          </thead>
          <tbody>
            <tr><td>Dell Wireless Mouse</td><td>1</td><td className="mk-cell-strong">KES 1,850</td></tr>
            <tr><td>HP Ink Cartridge</td><td>2</td><td className="mk-cell-strong">KES 4,800</td></tr>
            <tr><td>USB-C Cable 1m</td><td>1</td><td className="mk-cell-strong">KES 950</td></tr>
          </tbody>
        </table>
      </div>
      <div className="mk-detail-grid">
        <div className="mk-detail">
          <div className="mk-detail-label">Total</div>
          <div className="mk-detail-value">KES 7,600</div>
        </div>
        <div className="mk-detail">
          <div className="mk-detail-label">Invoice</div>
          <div className="mk-detail-value">VAT breakdown included</div>
        </div>
      </div>
      <div className="mk-row-actions">
        <span className="mk-row-chip mk-row-chip--action"><Icon name="card" size={14} /> M-Pesa</span>
        <span className="mk-row-chip"><Icon name="check" size={14} /> Cash</span>
        <span className="mk-row-chip"><Icon name="fileText" size={14} /> Receipt (80mm)</span>
      </div>
    </Panel>
  );
}

function InventoryPanel() {
  return (
    <Panel title="Stock · All branches">
      <div className="mk-row-actions" style={{ marginTop: 0, marginBottom: "var(--space-3)" }}>
        <span className="mk-row-chip mk-badge--warning"><Icon name="bell" size={14} /> 12 low-stock alerts</span>
        <span className="mk-row-chip"><span className="mk-kpi-delta--muted" style={{ display: "inline" }}>Live · synced now</span></span>
      </div>
      <div className="mk-table-scroll">
        <table className="mk-table">
          <thead>
            <tr><th>Item</th><th>Branch</th><th>On hand</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr><td className="mk-cell-strong">Dell Latitude 5420</td><td>Nairobi HQ</td><td className="mk-cell-strong">4</td><td><Badge tone="warning">Low</Badge></td></tr>
            <tr><td className="mk-cell-strong">HP LaserJet Pro</td><td>Nairobi HQ</td><td className="mk-cell-strong">12</td><td><Badge tone="success">OK</Badge></td></tr>
            <tr><td className="mk-cell-strong">Samsung 55&quot; TV</td><td>Mombasa</td><td className="mk-cell-strong">3</td><td><Badge tone="success">OK</Badge></td></tr>
            <tr><td className="mk-cell-strong">Office Chair</td><td>Nairobi HQ</td><td className="mk-cell-strong">0</td><td><Badge tone="danger">Out</Badge></td></tr>
          </tbody>
        </table>
      </div>
      <div className="mk-row-actions">
        <span className="mk-row-chip mk-row-chip--action"><Icon name="truck" size={14} /> Transfer 10 → Mombasa</span>
        <span className="mk-row-chip"><Icon name="refresh" size={14} /> Stock take in progress</span>
      </div>
    </Panel>
  );
}

function ServicePanel() {
  const steps = [
    { t: "Received", d: "14 Jun 2026 · 09:41", done: true },
    { t: "Diagnosis", d: "14 Jun 2026 · Branch tech", done: true },
    { t: "Quote approved", d: "KES 6,400 · WhatsApp", done: true },
    { t: "Awaiting parts", d: "Now · on order", done: false },
  ];
  return (
    <Panel title="#REP-10482 · Dell Latitude 5420">
      <div className="mk-device-row">
        <span className="mk-device-media"><Icon name="laptop" size={20} /></span>
        <div>
          <div className="mk-device-name">Dell Latitude 5420</div>
          <div className="mk-device-meta">SN DL123456 · Customer: John Doe</div>
        </div>
      </div>
      <div className="mk-timeline">
        {steps.map((s, i) => (
          <div key={s.t} className={`mk-timeline-item${s.done ? " mk-timeline-item--done" : " mk-timeline-item--current"}${i === steps.length - 1 ? " last" : ""}`}>
            <span className="mk-timeline-dot" />
            <div className="mk-timeline-title">{s.t}</div>
            <div className="mk-timeline-meta">{s.d}</div>
          </div>
        ))}
      </div>
      <div className="mk-detail-grid">
        <div className="mk-detail">
          <div className="mk-detail-label">Technician</div>
          <div className="mk-detail-value">Brian M.</div>
        </div>
        <div className="mk-detail">
          <div className="mk-detail-label">ETA</div>
          <div className="mk-detail-value">3 days</div>
        </div>
      </div>
      <div className="mk-row-actions">
        <span className="mk-row-chip mk-row-chip--action"><Icon name="messageCircle" size={14} /> WhatsApp customer</span>
        <span className="mk-row-chip"><Icon name="clipboard" size={14} /> Quote on file</span>
      </div>
    </Panel>
  );
}

function WarrantyPanel() {
  return (
    <Panel title="Warranty · Serial lookup">
      <div className="mk-device-row">
        <span className="mk-device-media"><Icon name="laptop" size={20} /></span>
        <div style={{ flex: 1 }}>
          <div className="mk-device-name">Dell Latitude 5420</div>
          <div className="mk-device-meta">Serial DL123456</div>
        </div>
        <Badge tone="success">Active warranty</Badge>
      </div>
      <div className="mk-detail-grid">
        <div className="mk-detail">
          <div className="mk-detail-label">Purchased</div>
          <div className="mk-detail-value">12 Jan 2026</div>
        </div>
        <div className="mk-detail">
          <div className="mk-detail-label">Expires</div>
          <div className="mk-detail-value">12 Jan 2027</div>
        </div>
        <div className="mk-detail">
          <div className="mk-detail-label">Days remaining</div>
          <div className="mk-detail-value">350</div>
        </div>
        <div className="mk-detail">
          <div className="mk-detail-label">Repairs on file</div>
          <div className="mk-detail-value">2</div>
        </div>
      </div>
      <div className="mk-activity">
        <div className="mk-activity-row">
          <span className="mk-activity-date">14 Jun 2026</span>
          <span className="mk-activity-text">Repair completed · <strong>Fan cleaned</strong> · REP-10102</span>
        </div>
        <div className="mk-activity-row">
          <span className="mk-activity-date">23 Mar 2026</span>
          <span className="mk-activity-text">Repair completed · <strong>Screen replacement</strong> · REP-10008</span>
        </div>
      </div>
      <div className="mk-row-actions">
        <span className="mk-row-chip mk-row-chip--action"><Icon name="shield" size={14} /> View coverage</span>
        <span className="mk-row-chip"><Icon name="file" size={14} /> Certificate (PDF)</span>
      </div>
    </Panel>
  );
}

function CustomerPanel() {
  return (
    <Panel title="Customer · John Doe">
      <div className="mk-profile-head">
        <span className="mk-avatar">JD</span>
        <div style={{ flex: 1 }}>
          <div className="mk-device-name">John Doe</div>
          <div className="mk-device-meta">kenyacomputers@gmail.com · since 2022</div>
        </div>
        <Badge tone="success">Top customer</Badge>
      </div>
      <div className="mk-detail-grid">
        <div className="mk-detail">
          <div className="mk-detail-label">Total spend</div>
          <div className="mk-detail-value">KES 1,284,000</div>
        </div>
        <div className="mk-detail">
          <div className="mk-detail-label">Orders</div>
          <div className="mk-detail-value">48</div>
        </div>
        <div className="mk-detail">
          <div className="mk-detail-label">Repairs</div>
          <div className="mk-detail-value">5</div>
        </div>
        <div className="mk-detail">
          <div className="mk-detail-label">Active warranties</div>
          <div className="mk-detail-value">2</div>
        </div>
      </div>
      <p className="mk-eyebrow">Recent activity</p>
      <div className="mk-activity">
        <div className="mk-activity-row">
          <span className="mk-activity-date">18 Aug 2026</span>
          <span className="mk-activity-text">Ordered <strong>Dell Latitude 5420</strong> · GG-7291</span>
        </div>
        <div className="mk-activity-row">
          <span className="mk-activity-date">09 Jul 2026</span>
          <span className="mk-activity-text">Repair completed · <strong>HP LaserJet Pro</strong> · REP-10244</span>
        </div>
        <div className="mk-activity-row">
          <span className="mk-activity-date">22 Jun 2026</span>
          <span className="mk-activity-text">Warranty claim opened · <strong>Office Chair</strong> · WC-1132</span>
        </div>
      </div>
      <div className="mk-row-actions">
        <span className="mk-row-chip mk-row-chip--action"><Icon name="messageCircle" size={14} /> Send message</span>
        <span className="mk-row-chip"><Icon name="chart" size={14} /> Full history</span>
      </div>
    </Panel>
  );
}

function OperatorPanel() {
  return (
    <div className="mk-control-panel">
      <div className="mk-table-scroll">
        <table className="mk-control-panel-table">
          <thead>
            <tr><th>Business</th><th>Plan</th><th>Status</th></tr>
          </thead>
          <tbody>
            {CONTROL_ROWS.map((r) => (
              <tr key={r.name}>
                <td className="mk-cell-strong">{r.name}</td>
                <td>{r.plan}</td>
                <td><Badge tone={r.tone}>{r.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

  return (
    <div className="mk-page" id="top">
      <Head>
        <title>Gear&Glitch — Run your entire shop from one place.</title>
        <meta name="description" content="POS, inventory, repairs, warranty, and KRA eTIMS invoicing for electronics businesses in one system. Free Starter plan, no credit card required." />
        <meta name="og:title" content="Gear&Glitch — Run your entire shop from one place." />
        <meta name="og:description" content="Sell, track, service, and warrant from one system. The platform built for businesses that sell products that need service." />
        <meta name="og:type" content="website" />
      </Head>

      <a className="mk-skip-link" href="#content">Skip to content</a>
      <Header />

      <main id="content">
        {/* ================================================================
            HERO
        ================================================================ */}
        <section className="mk-hero">
          <div className="mk-hero-inner">
            <div className="mk-hero-copy">
              <p className="mk-hero-announce">
                <span className="mk-hero-announce-dot" />
                POS · Inventory · Repairs · Warranty — one system
              </p>
              <h1 className="mk-hero-title">Run your entire shop from one place.</h1>
              <p className="mk-hero-sub">
                Sell from the counter, the web, or WhatsApp. Track every serial number and every repair.
                Honor warranties without a paper trail. Gear&Glitch keeps it all in one place.
              </p>
              <div className="mk-hero-actions">
                <a className="mk-btn mk-btn-primary mk-btn-lg" href="/login">Start free</a>
                <a className="mk-btn mk-btn-secondary mk-btn-lg" href="#products">See how it works</a>
              </div>
              <p className="mk-hero-note">Free Starter plan · No credit card required · Setup in a day</p>
            </div>
            <HeroDashboardPanel />
          </div>
        </section>

        {/* ================================================================
            SOLUTIONS — the whole cycle
        ================================================================ */}
        <Section
          id="solutions"
          label="One system, end to end"
          title="The whole cycle. One system."
          subtitle="Sell it, track it, service it, warrant it — with every step linked to the same product, the same customer, and the same numbers. No re-keying. No spreadsheets. No guesswork."
          className="mk-section--tinted"
        >
          <div className="mk-life-grid">
            {LIFE_CYCLE.map((s, i) => (
              <div key={s.title} className={`mk-life-item${i === 0 ? " mk-life-item--active" : ""}`}>
                {i < LIFE_CYCLE.length - 1 && (
                  <span className="mk-life-arrow" aria-hidden="true"><Icon name="arrowRight" size={18} /></span>
                )}
                <div className="mk-life-index">{s.num}</div>
                <span className="mk-life-icon"><Icon name={s.icon} size={20} /></span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ================================================================
            PRODUCTS — the four modules, shown with real UI
        ================================================================ */}
        <SplitSection
          id="products"
          eyebrow="Commerce"
          title="Sell everywhere. Keep everything connected."
          sub="One POS for the counter, one storefront for the web, and the same inventory behind both. M-Pesa or card, cash or quote — the sale settles exactly how your customer wants to pay, every time."
          bullets={[
            { icon: "store", title: "Counter and online sales", desc: "A barcode-friendly POS, an online storefront, and campaign pages — all reading from the same stock and the same customers." },
            { icon: "card", title: "Payments that reconcile themselves", desc: "M-Pesa pushes straight to the till with a real confirmation before a sale completes. Cash and bank transfers are tracked the same way." },
            { icon: "fileText", title: "Tax-clear documents", desc: "Quotes convert to invoices in one click. Every receipt carries an itemised VAT breakdown and clear tax totals." },
            { icon: "sliders", title: "Listings that sort and filter", desc: "Storefront categories, groups, and campaigns sort by newest, price, or name, filter what you see, and page through results 12 at a time — no endless scroll." },
            { icon: "monitor", title: "A calm storefront that matches your brand", desc: "A clean, flat hero in your brand colors that follows each visitor's device theme. No flashy countdowns, glow, or effects — just the products, front and centre." },
            { icon: "briefcase", title: "An admin workspace built for work", desc: "A focused staff portal: operational dashboard with revenue and needs-attention lists, sortable tables, semantic status colors, and keyboard-friendly controls. No gimmicks." },
          ]}
          media={<CommercePanel />}
        />

        <SplitSection
          eyebrow="Inventory"
          title="Know what you have, where it is, and where it needs to go."
          sub="Stock lives at the branch, not in someone&apos;s head. A sale at one counter updates on-hand everywhere the moment it happens — and when a supplier delivers, receiving is a single click."
          flip
          tinted
          bullets={[
            { icon: "layers", title: "Branch-accurate stock", desc: "Track on-hand per branch, back-ordered counts, and low-stock thresholds with alerts before you run dry." },
            { icon: "truck", title: "Transfers that move what they say", desc: "Deduct here, add there, with a movement record on both sides. No more paperwork that never matches the shelf." },
            { icon: "hash", title: "Serial-number visibility", desc: "Scan or type serials at intake, at the till, and on the repair bench. Know exactly which unit is where, and whose it is." },
          ]}
          media={<InventoryPanel />}
        />

        <SplitSection
          eyebrow="Repairs & service"
          title="From the sale to the service bench."
          sub="When a product comes back, the system already knows it. Open a ticket against the sold item, quote the fix, assign a technician, and keep the customer informed — without a single phone call."
          bullets={[
            { icon: "wrench", title: "Tickets attached to the product", desc: "Every repair links to the original sale and the serial number, so context never lives in a person&apos;s memory." },
            { icon: "clipboard", title: "Quotes that close faster", desc: "Generate a costed quote from the ticket, get approval by WhatsApp or email, and convert to a completed job." },
            { icon: "clock", title: "A status timeline, not a checklist", desc: "Every ticket walks a visual timeline — Received, Diagnosed, Awaiting parts, In progress, Quality check, Ready, Collected — with timestamps on each move and the device&apos;s serial and warranty right on the ticket." },
            { icon: "messageCircle", title: "Updates that reach everyone", desc: "Status changes notify the customer automatically and land in one conversation thread, not five tabs." },
          ]}
          media={<ServicePanel />}
        />

        <SplitSection
          eyebrow="Warranty"
          title="Know exactly what is covered."
          sub="Warranty begins when you ring up the sale. From then on, the serial number carries the purchase date, the coverage terms, and every service it has been through — so a claim is decided in seconds, not an argument."
          flip
          tinted
          bullets={[
            { icon: "shield", title: "Warranty starts at the counter", desc: "Register coverage at the point of sale so the expiry date is never a guess and never a sticky note." },
            { icon: "target", title: "Coverage on demand", desc: "One search by serial number shows whether a unit is covered, when it expires, and what work has been done." },
            { icon: "fileText", title: "A register you can filter in seconds", desc: "The dedicated Warranty panel buckets every serialized sale into active, expiring within 30 days, and expired — searchable by product, customer, or serial, and embedded on the customer&apos;s profile." },
            { icon: "calendar", title: "Claims with a paper trail", desc: "Log every claim against the device with the outcome recorded — honored, part-only, or declined, and why." },
          ]}
          media={<WarrantyPanel />}
        />

        {/* ================================================================
            CUSTOMER — the tracked asset
        ================================================================ */}
        <SplitSection
          id="customer"
          eyebrow="Customers & assets"
          title="Every customer, one timeline."
          sub="Purchase history, repairs, warranties, and conversations live on the same profile. Your staff stop asking who bought what, when — they open the record and see it all."
          bullets={[
            { icon: "users", title: "One profile for everything", desc: "Orders, returns, repairs, and active warranties sit next to contact details and WhatsApp conversation history." },
            { icon: "chart", title: "Value you can see", desc: "Lifetime spend, service history, and warranty load per customer — the context for a five-minute decision." },
          ]}
          media={<CustomerPanel />}
        />

        {/* ================================================================
            WHO IT'S FOR
        ================================================================ */}
        <Section
          id="who"
          label="Who it&apos;s for"
          title="Built for businesses that sell products that need service."
          subtitle="If your customers come back — for parts, repairs, replacements, or advice — your records need to follow the product, not the person at the counter."
          className="mk-section--tinted"
        >
          <div className="mk-who-grid">
            {WHO_IT_IS_FOR.map((w) => (
              <div key={w.name} className="mk-who-item">
                <span className="mk-who-icon"><Icon name={w.icon} /></span>
                <div>
                  <h3>{w.name}</h3>
                  <p>{w.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ================================================================
            CONTROL PLANE
        ================================================================ */}
        <section className="mk-control">
          <div className="mk-control-inner">
            <span className="mk-control-eyebrow">For operators</span>
            <h2>One control plane. Every business under control.</h2>
            <p className="mk-control-sub">
              Run more than one shop? See subscriptions, plan health, and activity across every client from a single
              dashboard — and drill into any business without logging out of your own.
            </p>
            <div className="mk-control-metrics">
              {CONTROL_METRICS.map((m) => (
                <div key={m.label} className="mk-control-metric">
                  <div className="mk-control-metric-value">{m.value}</div>
                  <div className="mk-control-metric-label">{m.label}</div>
                </div>
              ))}
            </div>
            <OperatorPanel />
            <p className="mk-panel-caption" style={{ color: "var(--muted)" }}>Operator view — sample data.</p>
          </div>
        </section>

        {/* ================================================================
            PRICING
        ================================================================ */}
        <Section
          id="pricing"
          label="Pricing"
          title="Simple plans that grow with you."
          subtitle="Start free, upgrade when the shop outgrows the plan. Prices in KES — the real figures you&apos;ll see at checkout."
          center
        >
          <p className="mk-pricing-note">Annual billing saves ~20% on every paid plan.</p>
          <div className="mk-pricing-grid">
            {PLANS.map((p) => (
              <div key={p.name} className={`mk-plan${p.popular ? " mk-plan--popular" : ""}`}>
                {p.popular && <span className="mk-plan-popular-badge">Most popular</span>}
                <h3 className="mk-plan-name">{p.name}</h3>
                <p className="mk-plan-desc">{p.desc}</p>
                <div className="mk-plan-price-row">
                  <span className="mk-plan-price">{p.price}</span>
                  <span className="mk-plan-period">{p.period}</span>
                </div>
                {p.annual ? (
                  <span className="mk-plan-save">{p.annual}</span>
                ) : (
                  <span className="mk-plan-save">&nbsp;</span>
                )}
                <ul className="mk-plan-features">
                  {p.features.map((f) => (
                    <li key={f}>
                      <Icon name="check" size={15} className="mk-plan-feature-check" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a className={`mk-btn mk-btn-lg mk-plan-cta${p.popular ? " mk-btn-primary" : " mk-btn-secondary"}`} href={p.href}>{p.cta}</a>
              </div>
            ))}
          </div>
        </Section>

        {/* ================================================================
            FAQ
        ================================================================ */}
        <Section
          id="faq"
          label="Resources"
          title="Common questions, straight answers."
          subtitle="Everything you need to know about getting started."
          className="mk-section--tinted"
        >
          <div className="mk-faq-wrap">
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
          </div>
        </Section>

        {/* ================================================================
            FINAL CTA
        ================================================================ */}
        <section className="mk-cta">
          <h2>Ready to run your business from one place?</h2>
          <p>
            Join electronics businesses that sell, track, service, and warrant —
            without juggling five systems to do it.
          </p>
          <div className="mk-cta-actions">
            <a className="mk-btn mk-btn-primary mk-btn-lg" href="/login">Start free</a>
            <a className="mk-btn mk-btn-secondary mk-btn-lg" href="/contact">Book a demo</a>
          </div>
          <p className="mk-cta-note">Free Starter plan available. No credit card required. Upgrade anytime.</p>
        </section>
      </main>

      {/* ================================================================
          FOOTER
      ================================================================ */}
      <footer className="mk-footer">
        <div className="mk-footer-inner">
          <div className="mk-footer-brand-col">
            <a href="#top" className="mk-footer-brand">
              <span className="mk-brand-mark"><Icon name="gear" size={18} /></span>
              Gear&amp;Glitch
            </a>
            <p className="mk-footer-tagline">The platform for businesses that sell products that need service.</p>
          </div>
          <nav className="mk-footer-col" aria-label="Product">
            <h3>Product</h3>
            <a href="#products">Products</a>
            <a href="#solutions">Solutions</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">Resources</a>
          </nav>
          <nav className="mk-footer-col" aria-label="Company">
            <h3>Company</h3>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
          </nav>
          <nav className="mk-footer-col" aria-label="Get started">
            <h3>Get started</h3>
            <a href="/login">Sign in</a>
            <a href="/login">Start free</a>
          </nav>
          <div className="mk-footer-copy">
            &copy; {new Date().getFullYear()} Gear&amp;Glitch. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}