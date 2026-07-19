import React, { useEffect, useRef, useState, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */
const PROBLEMS = [
  { icon: "📦", title: "Inventory Errors", desc: "Manual stock tracking leads to costly discrepancies, overselling, and lost revenue across your entire product range." },
  { icon: "🔧", title: "Repair Tracking Difficulties", desc: "Lost repair tickets, unclear technician assignments, and no way for customers to track progress in real time." },
  { icon: "📄", title: "Manual Quotations", desc: "Hours wasted creating quotes by hand, inconsistent pricing, and slow responses that drive customers to competitors." },
  { icon: "💬", title: "Customer Communication Delays", desc: "Fragmented email threads, missed messages, and no central inbox for repair updates or sales inquiries." },
  { icon: "📋", title: "Lost Warranties", desc: "Paper warranty records get misplaced, expiry dates slip through the cracks, and claim handling is a nightmare." },
  { icon: "🔗", title: "Disconnected Systems", desc: "POS doesn't talk to inventory. Repairs don't talk to accounting. Every department operates in its own silo." },
  { icon: "👁️", title: "Poor Stock Visibility", desc: "No real-time view of stock levels across branches, leading to overstocking, stockouts, and tied-up capital." },
  { icon: "📋", title: "Paper-Based Invoicing", desc: "Manual invoice and receipt creation is slow, error-prone, and doesn't meet KRA eTIMS compliance requirements." },
  { icon: "📱", title: "No Mobile-Friendly System", desc: "Your platform only works on desktop, so staff can't check stock, make sales, or update tickets on the floor." },
  { icon: "📞", title: "WhatsApp Chaos", desc: "Customer messages scattered across WhatsApp, email, and phone with no central record or automated delivery tracking." },
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
  "Admin-controllable hero section with badge, headline, and CTAs",
  "WhatsApp Business API for instant customer communication",
  "Responsive design optimized for mobile, tablet, and desktop",
];

const INDUSTRIES = [
  { icon: "💻", name: "Computer Shops", desc: "Manage PC builds, component inventory, repairs, and sales from one dashboard." },
  { icon: "🖥", name: "Laptop Retailers", desc: "Track warranties, manage stock levels, and offer on-the-spot repairs with full history." },
  { icon: "📱", name: "Mobile Phone Stores", desc: "Handle repairs, accessory sales, and customer warranty tracking seamlessly." },
  { icon: "📺", name: "TV & Home Entertainment", desc: "Manage large-item inventory, delivery scheduling, and installation service tickets." },
  { icon: "🏪", name: "Electronics Superstores", desc: "Multi-branch stock transfers, centralized purchasing, and unified reporting." },
  { icon: "🔧", name: "Repair Centres", desc: "Complete ticket management, technician assignment, and customer self-service portal." },
  { icon: "🖥", name: "IT Service Companies", desc: "Track assets, manage service contracts, and automate recurring maintenance tasks." },
  { icon: "🏬", name: "Multi-Branch Retail Chains", desc: "Centralized control with decentralized operations, stock transfers, and regional reporting." },
];

const FEATURES = [
  { icon: "📦", name: "Inventory Management", desc: "Real-time stock tracking, low-stock alerts, stock-on-hand counts, and inter-branch stock transfers." },
  { icon: "💳", name: "Point of Sale", desc: "Fast, intuitive POS with M-Pesa payment support, receipt generation, and customer display." },
  { icon: "🔧", name: "Repair Management", desc: "End-to-end repair lifecycle from drop-off to delivery with technician assignment, cost tracking, and quote generation." },
  { icon: "🛡", name: "Warranty Tracking", desc: "Automated warranty registration on products, duration tracking, and warranty status on invoices." },
  { icon: "👥", name: "Customer Management", desc: "Customer profiles with purchase history, repair records, order history, and communication log." },
  { icon: "🤝", name: "Supplier Management", desc: "Supplier directory with contact details, linked purchase orders, and stock replenishment tracking." },
  { icon: "📋", name: "Purchase Orders", desc: "Create purchase orders per supplier, track items ordered vs received, per-item receiving, and delete/cancel pending POs." },
  { icon: "🔄", name: "Stock Transfers", desc: "Seamless inter-branch transfers with tracking and automated inventory reconciliation." },
  { icon: "🏢", name: "Multi-Branch Management", desc: "Unified dashboard across all locations with per-branch settings and consolidated reporting." },
  { icon: "📊", name: "Reports & Analytics", desc: "Sales, employee performance, technician stats, purchase reports, and stock summary with date filtering." },
  { icon: "📄", name: "Quotation Engine", desc: "Generate professional quotes with line items, discounts, PDF export, and one-click conversion to orders." },
  { icon: "🧾", name: "KRA eTIMS Invoicing", desc: "Fully compliant invoices and credit notes with control codes, serial numbers, and receipt generation." },
  { icon: "🔐", name: "Role-Based Permissions", desc: "Granular access control for admin, owner, manager, staff, technician, provider, and customer roles." },
  { icon: "🔔", name: "Email Notifications", desc: "Automated emails for order status updates, quote delivery, credit notes, and customer messaging." },
  { icon: "📱", name: "WhatsApp Integration", desc: "Bidirectional WhatsApp messaging via Meta Cloud API. Send/receive messages, 24h window tracking, conversation logs." },
  { icon: "💱", name: "Multi-Currency Support", desc: "Display prices in multiple currencies with live exchange rate conversion for international customers." },
  { icon: "💰", name: "M-Pesa Integration", desc: "Accept M-Pesa payments directly through the POS and online checkout with automatic reconciliation." },
  { icon: "📝", name: "Credit Notes", desc: "Issue KRA-compliant credit notes with eTIMS integration for returns and billing adjustments." },
  { icon: "🏷", name: "Coupons & Discounts", desc: "Create percentage or fixed-amount coupons, apply discounts at checkout, and track usage." },
  { icon: "💬", name: "Messaging System", desc: "Built-in messaging between customers, providers, and staff with real-time notifications and WhatsApp delivery." },
  { icon: "📍", name: "Product Positioning", desc: "Drag-and-drop product ordering to control how items appear on your storefront." },
  { icon: "⭐", name: "Product Reviews & Ratings", desc: "Customers rate products 1–5 stars, leave reviews, and help others decide. One review per customer enforced. Admin moderation built in." },
  { icon: "🌐", name: "Online Storefront", desc: "Multiple storefront layouts (Amazon-style, Jumia-style, mobile-optimized) with admin-controllable hero sections, live stats from your data, auto-synced category chips, product catalog, auto-rotating carousels, and springboard category menu." },
  { icon: "⚙", name: "Organized Settings", desc: "Dedicated Settings tab with grouped modules — General, Storefront, Email, WhatsApp, About Us, Spec Templates, and Subscription. Each module is its own page for focused configuration." },
  { icon: "📄", name: "PDF Generation", desc: "Server-side PDF generation for invoices, receipts, quotes, and credit notes — downloadable instantly." },
];

const WHY_CHOOSE = [
  { num: "01", title: "One Platform for Everything", desc: "Inventory, POS, repairs, invoicing, and customer management in a single integrated system." },
  { num: "02", title: "Real-Time Visibility", desc: "Know exactly what's happening across your business at any moment with live dashboards and alerts." },
  { num: "03", title: "Faster Customer Service", desc: "Access complete customer history, stock availability, and pricing in seconds — not minutes." },
  { num: "04", title: "Reduced Inventory Losses", desc: "Real-time tracking, stock takes, and smart alerts minimize shrinkage and overstocking." },
  { num: "05", title: "KRA eTIMS Compliance", desc: "Built-in compliant invoicing with control codes, so you're always ready for audits." },
  { num: "06", title: "Scalable Architecture", desc: "Start with one branch and scale to multiple locations without changing your system or losing data." },
  { num: "07", title: "Cloud Accessibility", desc: "Access your business from any device, anywhere — manage operations remotely with full confidence." },
  { num: "08", title: "Enterprise-Grade Security", desc: "Role-based access, encrypted data, audit trails, and compliance-ready infrastructure." },
];

const STATS = [
  { icon: "📦", value: 120, suffix: "+", label: "Products Tracked" },
  { icon: "💳", value: 5, suffix: "", label: "Payment Methods" },
  { icon: "📊", value: 5, suffix: "+", label: "Report Types" },
  { icon: "🎯", value: 99, suffix: "%", label: "Inventory Accuracy" },
  { icon: "⭐", value: 98, suffix: "%", label: "Uptime SLA" },
  { icon: "⏱", value: 40, suffix: "%", label: "Average Time Saved" },
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
  { q: "How does the repair management work?", a: "Create repair tickets, assign technicians, generate cost quotes, track status through every stage, and notify customers via email when repairs are ready for collection." },
  { q: "Is KRA eTIMS compliance built in?", a: "Yes. Every invoice and credit note includes proper eTIMS control codes, serial numbers, and receipt generation. You're always audit-ready." },
  { q: "Can I try before I buy?", a: "Yes. We offer a free Starter plan with core features. Upgrade to Growth, Pro, or Enterprise plans when you need advanced capabilities." },
  { q: "How does multi-branch management work?", a: "Create multiple branches, assign staff per branch, transfer stock between locations, and view consolidated reports across all branches from a single dashboard." },
  { q: "What payment methods do you support?", a: "We support M-Pesa mobile money payments through the POS and online checkout. Cash and bank transfer payments are also tracked automatically." },
];

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function AnimatedBackground() {
  return (
    <div className="mk-bg-canvas" aria-hidden="true">
      <div className="mk-bg-grid" />
      <div className="mk-bg-particles">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="mk-particle" />
        ))}
      </div>
      <div className="mk-bg-glow mk-bg-glow--1" />
      <div className="mk-bg-glow mk-bg-glow--2" />
      <div className="mk-bg-gear mk-bg-gear--1" />
      <div className="mk-bg-gear mk-bg-gear--2" />
      <div className="mk-bg-gear mk-bg-gear--3" />
      <div className="mk-bg-gear mk-bg-gear--4" />
      <div className="mk-bg-circuit mk-bg-circuit--1" />
      <div className="mk-bg-circuit mk-bg-circuit--2" />
    </div>
  );
}

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
    </div>
  );
}

function LettersReveal({ text }: { text: string }) {
  return (
    <span style={{ display: "inline-block" }}>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            opacity: 0,
            animation: `mkLetterReveal 0.6s var(--ease-out) ${i * 0.035}s forwards`,
          }}
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
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
  style,
}: {
  id?: string;
  label?: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id={id} className={`mk-section ${className}`} ref={ref} style={style}>
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
/*  Stagger container                                                  */
/* ------------------------------------------------------------------ */

function StaggerContainer({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} className={`mk-stagger ${visible ? "mk-visible" : ""} ${className}`}>{children}</div>;
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

function FAQItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={`mk-faq-item ${isOpen ? "mk-faq-item--open" : ""}`}>
      <button className="mk-faq-question" onClick={onToggle} aria-expanded={isOpen}>
        <span>{q}</span>
        <span className="mk-faq-arrow">▼</span>
      </button>
      <div className="mk-faq-answer" role="region">
        <div className="mk-faq-answer-inner">{a}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function MarketingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroVisible, setHeroVisible] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [statsVisible, setStatsVisible] = useState(false);
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
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    setHeroVisible(true);
  }, []);

  const handleRipple = useCallback((e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "mk-btn-ripple";
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = e.clientX - rect.left - size / 2 + "px";
    ripple.style.top = e.clientY - rect.top - size / 2 + "px";
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }, []);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="mk-page">

      <AnimatedBackground />

      {/* ================================================================
          HERO
      ================================================================ */}
      <section className="mk-hero" ref={heroRef}>
        <div className="mk-hero-badge">
          <span className="mk-hero-badge-dot" />
          Now available — Premium Storefront Experience
        </div>

        <h1>
          <LettersReveal text="Run Your Entire" />
          <br />
          <span className="mk-hero-headline">
            <LettersReveal text="Electronics Business" />
          </span>
          <br />
          <LettersReveal text="From One Platform" />
        </h1>

        <p className="mk-hero-sub">
          Inventory, point of sale, purchase orders, repair management, customer relationships,
          KRA-compliant invoicing, and customer reviews — all seamlessly integrated. No more disconnected
          systems. No more manual data entry. Just one powerful platform.
        </p>

        <div className="mk-hero-actions">
          <button className="mk-btn mk-btn-primary" onClick={(e) => { handleRipple(e); setTimeout(() => window.location.href = "/contact", 300); }}>
            <span className="mk-btn-text">Book a Demo</span>
          </button>
          <button className="mk-btn mk-btn-secondary" onClick={(e) => { handleRipple(e); setTimeout(() => window.location.href = "/login", 300); }}>
            <span className="mk-btn-text">Start Free Trial</span>
          </button>
          <button className="mk-btn mk-btn-secondary" onClick={(e) => { handleRipple(e); setTimeout(() => window.location.href = "/contact", 300); }}>
            <span className="mk-btn-text">Contact Sales</span>
          </button>
        </div>

        <DashboardPreview />

        <div className="mk-hero-scroll" onClick={() => scrollToSection("problem")} role="button" tabIndex={0} aria-label="Scroll to next section" onKeyDown={(e) => e.key === "Enter" && scrollToSection("problem")}>
          <span>Scroll to explore</span>
          <div className="mk-hero-scroll-line" />
        </div>
      </section>

      {/* ================================================================
          PROBLEM
      ================================================================ */}
      <Section
        id="problem"
        label="The Challenge"
        title="The Real Cost of Disconnected Systems"
        subtitle="Electronics businesses face unique operational challenges that multiply when your tools don't work together."
      >
        <StaggerContainer className="mk-problem-grid">
          {PROBLEMS.map((p, i) => (
            <div key={i} className="mk-problem-card">
              <div className="mk-problem-icon">{p.icon}</div>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
            </div>
          ))}
        </StaggerContainer>
      </Section>

      {/* ================================================================
          SOLUTION
      ================================================================ */}
      <Section
        id="solution"
        label="The Solution"
        title="One Platform. Infinite Possibilities."
        subtitle="Gear&Glitch unifies every aspect of your electronics business into a single, intelligent platform."
        className="mk-solution"
      >
        <div className="mk-solution-bg" />

        <div className="mk-solution-content">
          {/* Multi-branch row */}
          <div className="mk-solution-branches">
            <div className="mk-solution-branch">
              <div className="mk-branch-name">Branch 1</div>
              <div className="mk-branch-modules">
                <span className="mk-branch-module">💰 POS</span>
                <span className="mk-branch-module">📦 Stock</span>
              </div>
            </div>
            <div className="mk-solution-branch">
              <div className="mk-branch-name">Branch 2</div>
              <div className="mk-branch-modules">
                <span className="mk-branch-module">🔧 Repairs</span>
                <span className="mk-branch-module">👥 Customers</span>
              </div>
            </div>
            <div className="mk-solution-branch">
              <div className="mk-branch-name">Branch N</div>
              <div className="mk-branch-modules">
                <span className="mk-branch-module">📊 Reports</span>
                <span className="mk-branch-module">🚚 Transfers</span>
              </div>
            </div>
          </div>

          {/* Connector lines */}
          <div className="mk-solution-connectors">
            <div className="mk-connector-line" />
            <div className="mk-connector-line" />
            <div className="mk-connector-line" />
            <div className="mk-connector-dot">⬇️</div>
          </div>

          {/* Central hub */}
          <div className="mk-solution-hub">
            <div className="mk-solution-hub-icon">⚡</div>
            <div className="mk-solution-hub-title">Gear&Glitch Unified Platform</div>
            <div className="mk-solution-hub-tagline">Central Hub — Connect all your branches</div>
          </div>

          {/* Consolidated downstream */}
          <div className="mk-solution-downstream">
            <div className="mk-downstream-item">👥 Unified Customers</div>
            <div className="mk-downstream-item">📊 Consolidated Reports</div>
            <div className="mk-downstream-item">💱 Multi-Currency</div>
            <div className="mk-downstream-item">🔐 Global Admin</div>
          </div>

          <StaggerContainer className="mk-solution-benefits">
            {SOLUTIONS_BENEFITS.map((b, i) => (
              <div key={i} className="mk-solution-benefit">
                <span className="mk-solution-benefit-check">✓</span>
                <span>{b}</span>
              </div>
            ))}
          </StaggerContainer>
        </div>
      </Section>

      {/* ================================================================
          INDUSTRIES
      ================================================================ */}
      <Section
        id="industries"
        label="Industries"
        title="Built for Every Electronics Business"
        subtitle="From one-person repair shops to multinational retail chains — our platform adapts to your workflow."
      >
        <StaggerContainer className="mk-industries-grid">
          {INDUSTRIES.map((ind, i) => (
            <div key={i} className="mk-industry-card">
              <div className="mk-industry-icon">{ind.icon}</div>
              <h3>{ind.name}</h3>
              <p>{ind.desc}</p>
            </div>
          ))}
        </StaggerContainer>
      </Section>

      {/* ================================================================
          FEATURES
      ================================================================ */}
      <Section
        id="features"
        label="Features"
        title="Everything You Need to Succeed"
        subtitle="Twenty-three powerful modules that work together to run every part of your electronics business."
      >
        <StaggerContainer className="mk-features-grid">
          {FEATURES.map((f, i) => (
            <div key={i} className="mk-feature-card">
              <div className="mk-feature-icon">{f.icon}</div>
              <h3>{f.name}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </StaggerContainer>
      </Section>

      {/* ================================================================
          WHY CHOOSE
      ================================================================ */}
      <Section
        id="why-choose"
        label="Why Choose Us"
        title="The Clear Advantage"
        subtitle="We've built this platform from the ground up for electronics businesses. Here's why teams choose Gear&Glitch."
      >
        <StaggerContainer className="mk-why-grid">
          {WHY_CHOOSE.map((w, i) => (
            <div key={i} className="mk-why-card">
              <div className="mk-why-number">{w.num}</div>
              <h3>{w.title}</h3>
              <p>{w.desc}</p>
            </div>
          ))}
        </StaggerContainer>
      </Section>

      {/* ================================================================
          STATS
      ================================================================ */}
      <section className={`mk-section mk-stats${statsVisible ? " mk-visible" : ""}`} ref={statsRef}>
        <div className={`mk-section-header mk-reveal${statsVisible ? " mk-visible" : ""}`}>
          <span className="mk-section-label">By The Numbers</span>
          <h2 className="mk-section-title">Trusted by the Industry</h2>
          <p className="mk-section-subtitle">
            Real results from real businesses using Gear&Glitch every day.
          </p>
        </div>
        <div className="mk-stats-grid">
          {STATS.map((s, i) => (
            <div key={i} className={`mk-stat-card mk-reveal${statsVisible ? " mk-visible" : ""}`} style={{ transitionDelay: `${i * 0.1}s` }}>
              <div className="mk-stat-icon">{s.icon}</div>
              <div className="mk-stat-number">
                {counts[i].toLocaleString()}
                <span className="mk-stat-plus">{s.suffix}</span>
              </div>
              <div className="mk-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================
          TESTIMONIALS
      ================================================================ */}
      <Section
        id="testimonials"
        label="Testimonials"
        title="What Our Customers Say"
        subtitle="Hear from the businesses that transformed their operations with Gear&Glitch."
      >
        <StaggerContainer className="mk-testimonials-grid">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="mk-testimonial-card">
              <div className="mk-testimonial-stars">{Array.from({ length: t.rating }).map((_, j) => (<span key={j}>★</span>))}</div>
              <div className="mk-testimonial-text">"{t.text}"</div>
              <div className="mk-testimonial-author">
                <div className="mk-testimonial-avatar">{t.name.charAt(0)}</div>
                <div>
                  <div className="mk-testimonial-name">{t.name}</div>
                  <div className="mk-testimonial-role">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </StaggerContainer>
      </Section>

      {/* ================================================================
          FAQ
      ================================================================ */}
      <Section
        id="faq"
        label="FAQ"
        title="Frequently Asked Questions"
        subtitle="Everything you need to know about getting started with Gear&Glitch."
      >
        <div className="mk-faq-list">
          {FAQS.map((faq, i) => (
            <FAQItem
              key={i}
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
        <div className="mk-cta-glow" />
        <h2 className="mk-section-title">Ready to Transform Your Business?</h2>
        <p>
          Join electronics businesses that have streamlined their
          operations, reduced costs, and grown revenue with Gear&Glitch.
        </p>
        <div className="mk-cta-actions">
          <button className="mk-btn mk-btn-primary" onClick={(e) => { handleRipple(e); setTimeout(() => window.location.href = "/contact", 300); }}>
            <span className="mk-btn-text">Book a Demo</span>
          </button>
          <button className="mk-btn mk-btn-secondary" onClick={(e) => { handleRipple(e); setTimeout(() => window.location.href = "/login", 300); }}>
            <span className="mk-btn-text">Start Free Trial</span>
          </button>
          <button className="mk-btn mk-btn-secondary" onClick={(e) => { handleRipple(e); setTimeout(() => window.location.href = "/contact", 300); }}>
            <span className="mk-btn-text">Request a Quote</span>
          </button>
        </div>
        <p className="mk-cta-note">Free Starter plan available. No credit card required. Upgrade anytime as your business grows.</p>
      </section>

      {/* ================================================================
          FOOTER
      ================================================================ */}
      <footer className="mk-footer">
        <div className="mk-footer-inner">
          <div className="mk-footer-brand">Gear&Glitch</div>
          <div className="mk-footer-tagline">The intelligent platform for electronics businesses.</div>
          <div className="mk-footer-links">
            <a href="#features">Features</a>
            <a href="#industries">Industries</a>
            <a href="#testimonials">Testimonials</a>
            <a href="#faq">FAQ</a>
            <a href="/contact">Contact</a>
            <a href="/about">About</a>
          </div>
          <div className="mk-footer-copy">
            &copy; {new Date().getFullYear()} Gear&Glitch. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
}
