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
  { icon: "🛠️", title: "Multiple Disconnected Tools", desc: "Juggling Excel spreadsheets, paper logs, and half a dozen apps just to keep the business running day-to-day." },
];

const SOLUTIONS_BENEFITS = [
  "Single source of truth for your entire business",
  "Faster customer service with instant access to data",
  "Reduced inventory losses with real-time tracking",
  "End-to-end repair lifecycle management",
  "Automated quotations in seconds, not hours",
  "Unified customer communication across all channels",
  "Enterprise-grade security and role-based access",
  "Cloud accessible from any device, anywhere",
];

const INDUSTRIES = [
  { icon: "💻", name: "Computer Shops", desc: "Manage PC builds, component inventory, repairs, and sales from one dashboard." },
  { icon: "🖥", name: "Laptop Retailers", desc: "Track serial numbers, warranties, and offer on-the-spot repairs with full history." },
  { icon: "📱", name: "Mobile Phone Stores", desc: "Handle trade-ins, unlock requests, screen repairs, and accessory sales seamlessly." },
  { icon: "📺", name: "TV & Home Entertainment", desc: "Manage large-item inventory, delivery scheduling, and installation service tickets." },
  { icon: "🏪", name: "Electronics Superstores", desc: "Multi-branch stock transfers, centralized purchasing, and unified reporting." },
  { icon: "🔧", name: "Repair Centres", desc: "Complete ticket management, technician scheduling, and customer self-service portal." },
  { icon: "🖥", name: "IT Service Companies", desc: "Track assets, manage service contracts, and automate recurring maintenance tasks." },
  { icon: "🎓", name: "Schools & Universities", desc: "Manage device fleets, lab inventory, and student repair requests with accountability." },
  { icon: "🏢", name: "Corporate IT Departments", desc: "Asset lifecycle management, procurement workflows, and internal helpdesk ticketing." },
  { icon: "🏛", name: "Government Institutions", desc: "Compliance-ready tracking, audit trails, and role-based access for sensitive procurement." },
  { icon: "🌐", name: "Internet Service Providers", desc: "Manage CPE inventory, dispatch technician jobs, and track installation completion." },
  { icon: "📹", name: "CCTV & Security Installers", desc: "Bundle product kits, schedule installations, and manage recurring maintenance contracts." },
  { icon: "🖨", name: "Printer & Copier Dealers", desc: "Track consumables, manage service calls, and automate toner replenishment orders." },
  { icon: "⚙️", name: "Computer Manufacturers", desc: "End-to-end assembly tracking, component sourcing, and quality control workflows." },
  { icon: "📦", name: "Electronics Distributors", desc: "Wholesale pricing tiers, bulk order processing, and real-time warehouse management." },
  { icon: "🏬", name: "Multi-Branch Retail Chains", desc: "Centralized control with decentralized operations, stock transfers, and regional reporting." },
];

const FEATURES = [
  { icon: "📦", name: "Inventory Management", desc: "Real-time stock tracking, low-stock alerts, and multi-warehouse support with barcode scanning." },
  { icon: "💳", name: "Point of Sale", desc: "Fast, intuitive POS with payment integration, receipt printing, and customer display support." },
  { icon: "🔧", name: "Repair Management", desc: "End-to-end repair lifecycle from drop-off to delivery with technician assignment and status updates." },
  { icon: "🛡", name: "Warranty Tracking", desc: "Automated warranty registration, expiry alerts, and streamlined claim processing." },
  { icon: "👥", name: "Customer Management", desc: "360-degree customer profiles with purchase history, repair records, and communication log." },
  { icon: "🤝", name: "Supplier Management", desc: "Supplier catalogs, pricing history, lead times, and performance ratings all in one place." },
  { icon: "📋", name: "Purchase Orders", desc: "Automated PO generation, approval workflows, and receiving with discrepancy detection." },
  { icon: "🔄", name: "Stock Transfers", desc: "Seamless inter-branch transfers with tracking, approval, and automated inventory reconciliation." },
  { icon: "🏢", name: "Multi-Branch Management", desc: "Unified dashboard across all locations with per-branch performance metrics and control." },
  { icon: "📊", name: "Reports & Analytics", desc: "Customizable dashboards with sales trends, inventory turnover, and profitability analysis." },
  { icon: "🛒", name: "Online Store Integration", desc: "Sync inventory and orders between your physical stores and e-commerce platform in real time." },
  { icon: "💰", name: "Payment Integration", desc: "Accept card, mobile money, bank transfer, and credit — all reconciled automatically." },
  { icon: "📒", name: "Accounting Integration", desc: "Push sales, expenses, and inventory adjustments directly to your accounting software." },
  { icon: "🔐", name: "Role-Based Permissions", desc: "Granular access control — define exactly what each staff member can see and do." },
  { icon: "🔔", name: "Notifications", desc: "Real-time alerts for low stock, new repairs, quote acceptances, and pending approvals." },
  { icon: "📱", name: "Barcode Support", desc: "Generate and scan barcodes for products, repairs, and assets using any standard scanner." },
  { icon: "🔢", name: "Serial Number Tracking", desc: "Track individual units through their entire lifecycle — from receiving to sale to warranty claims." },
  { icon: "🎫", name: "Ticket Management", desc: "Central helpdesk for customer inquiries, internal requests, and cross-department coordination." },
  { icon: "📅", name: "Technician Scheduling", desc: "Assign, reschedule, and optimize technician workloads with calendar integration and availability view." },
  { icon: "📍", name: "Asset Tracking", desc: "Monitor company assets, check-in/check-out, depreciation schedules, and maintenance due dates." },
  { icon: "🧠", name: "Business Intelligence", desc: "AI-powered insights, predictive analytics, and automated report generation for data-driven decisions." },
  { icon: "📄", name: "Quotation Engine", desc: "Generate professional quotes from templates, apply margins automatically, and convert to invoices with one click." },
];

const WHY_CHOOSE = [
  { num: "01", title: "One Platform for Everything", desc: "Inventory, POS, repairs, accounting, and customer management in a single integrated system." },
  { num: "02", title: "Real-Time Visibility", desc: "Know exactly what's happening across your business at any moment with live dashboards and alerts." },
  { num: "03", title: "Faster Customer Service", desc: "Access complete customer history, stock availability, and pricing in seconds — not minutes." },
  { num: "04", title: "Reduced Inventory Losses", desc: "Real-time tracking, automated reconciliation, and smart alerts minimize shrinkage and overstocking." },
  { num: "05", title: "Better Decision Making", desc: "Comprehensive reports and analytics give you the data you need to make confident business decisions." },
  { num: "06", title: "Scalable Architecture", desc: "Start with one branch and scale to hundreds without changing your system or losing data." },
  { num: "07", title: "Cloud Accessibility", desc: "Access your business from any device, anywhere — manage operations remotely with full confidence." },
  { num: "08", title: "Enterprise-Grade Security", desc: "Role-based access, encrypted data, audit trails, and compliance-ready infrastructure." },
];

const STATS = [
  { icon: "🏪", value: 500, suffix: "+", label: "Businesses Served" },
  { icon: "📦", value: 50000, suffix: "+", label: "Products Managed" },
  { icon: "🔧", value: 25000, suffix: "+", label: "Repairs Processed" },
  { icon: "🎯", value: 99, suffix: "%", label: "Inventory Accuracy" },
  { icon: "⭐", value: 98, suffix: "%", label: "Customer Satisfaction" },
  { icon: "⏱", value: 40, suffix: "%", label: "Average Time Saved" },
];

const TESTIMONIALS = [
  { name: "James K.", role: "Owner, TechCity Kenya", text: "We went from scattered Excel sheets and sticky notes to a fully integrated system. Repair tracking alone saved us 15 hours a week. The difference is night and day.", rating: 5 },
  { name: "Sarah M.", role: "Operations Manager, GadgetHub", text: "Multi-branch stock transfers used to take days of phone calls and emails. Now it's a few clicks. The real-time visibility across all our locations is a game changer.", rating: 5 },
  { name: "David O.", role: "CEO, RapidRepair Centres", text: "The quotation engine alone paid for the platform in the first month. We generate quotes in under 30 seconds now, and our conversion rate went up 34% because we respond faster.", rating: 5 },
  { name: "Grace W.", role: "IT Director, Eden Schools", text: "Managing device fleets across 12 campuses used to be a nightmare. Now we track every laptop, every repair, every warranty from one dashboard. Unbelievable ROI.", rating: 5 },
  { name: "Michael N.", role: "Managing Director, ElectroDistributors", text: "Wholesale pricing tiers, bulk order processing, and warehouse management all in one system. Our picking accuracy went from 87% to 99.4% in three months.", rating: 5 },
  { name: "Amina S.", role: "CFO, HomeTech Retail", text: "The accounting integration saved my team from 20+ hours of manual data entry every week. Reconciliation that used to take days now happens automatically overnight.", rating: 5 },
];

const FAQS = [
  { q: "Is the platform cloud-based or on-premise?", a: "Both. Our platform runs in the cloud so you can access it from anywhere, but we also offer on-premise deployment for organizations with specific data residency or security requirements." },
  { q: "How long does implementation typically take?", a: "Most small to medium businesses are fully set up within 1-3 days. Larger multi-branch deployments typically take 1-2 weeks, including data migration, staff training, and integration setup." },
  { q: "Can I import my existing data?", a: "Yes. We provide data migration tools and support for importing products, customers, suppliers, inventory levels, and historical sales from spreadsheets or other systems." },
  { q: "Do you offer staff training?", a: "Absolutely. Every plan includes onboarding training for your team. We provide documentation, video tutorials, live training sessions, and ongoing support to ensure your team gets the most out of the platform." },
  { q: "What happens if I need help?", a: "We offer email, chat, and phone support with response times ranging from 1 hour to 24 hours depending on your plan. Enterprise customers get a dedicated account manager." },
  { q: "Can I try before I buy?", a: "Yes. We offer a fully featured 14-day free trial with no credit card required. You can explore every feature, import your data, and see how the platform works for your specific business." },
  { q: "Is my data secure?", a: "Security is built into every layer of our platform. All data is encrypted in transit and at rest. We use role-based access control, comprehensive audit logs, and regular security audits. Your data is backed up daily." },
  { q: "Can I customize the platform for my business?", a: "Yes. The platform supports custom fields, custom workflows, role-based permissions, and configurable reports. Enterprise plans also include API access for custom integrations." },
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
              <span className="mk-dashboard-card-value">$12,480</span>
            </div>
            <div className="mk-dashboard-row">
              <div className="mk-dashboard-stat">
                <div className="mk-dashboard-stat-num">47</div>
                <div className="mk-dashboard-stat-label">Orders</div>
              </div>
              <div className="mk-dashboard-stat">
                <div className="mk-dashboard-stat-num">12</div>
                <div className="mk-dashboard-stat-label">Repairs</div>
              </div>
            </div>
          </div>
          <div className="mk-dashboard-card">
            <div className="mk-dashboard-card-header">
              <span className="mk-dashboard-card-label">Stock Alerts</span>
              <span className="mk-dashboard-card-value">3</span>
            </div>
            <div className="mk-dashboard-row">
              <div className="mk-dashboard-stat">
                <div className="mk-dashboard-stat-num">284</div>
                <div className="mk-dashboard-stat-label">In Stock</div>
              </div>
              <div className="mk-dashboard-stat">
                <div className="mk-dashboard-stat-num">1,240</div>
                <div className="mk-dashboard-stat-label">Total SKUs</div>
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

  const countBusinesses = useCountUp(500, 2000, statsVisible);
  const countProducts = useCountUp(50000, 2500, statsVisible);
  const countRepairs = useCountUp(25000, 2000, statsVisible);
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
          Now available — Unified Platform v3.0
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
          Inventory, point of sale, repair management, customer relationships, and
          business intelligence — all seamlessly integrated. No more disconnected
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
            <div className="mk-downstream-item">📒 Central Accounting</div>
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
        subtitle="Twenty-two powerful modules that work together to run every part of your electronics business."
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
        subtitle="We've built this platform from the ground up for electronics businesses. Here's why thousands choose Gear&Glitch."
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
          Join thousands of electronics businesses that have streamlined their
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
        <p className="mk-cta-note">No credit card required. 14-day free trial. Full access to all features.</p>
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
