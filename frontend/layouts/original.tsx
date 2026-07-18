import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "./shared";

export const LAYOUT_KEY = "original";
export const LAYOUT_LABEL = "Original";
export const LAYOUT_DESC = "The classic storefront with hero banner, category links, and product grid";

export function LayoutStyles() {
  return <style>{`
    @keyframes heroFadeUp {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes heroFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-12px); }
    }
    @keyframes heroGlow {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.8; }
    }
    @keyframes heroParticle {
      0% { transform: translateY(0) translateX(0); opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { transform: translateY(-600px) translateX(40px); opacity: 0; }
    }
    @keyframes heroStatFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    @keyframes heroBadgePulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.3); }
      50% { box-shadow: 0 0 0 8px rgba(96, 165, 250, 0); }
    }
  `}</style>;
}

function HeroParticle({ delay, left, size }: { delay: number; left: number; size: number }) {
  return (
    <div
      className="hero-particle"
      style={{
        left: `${left}%`,
        width: size,
        height: size,
        animationDelay: `${delay}s`,
        animationDuration: `${6 + delay * 2}s`,
      }}
    />
  );
}

function HeroSection({ products }: { products: Product[] }) {
  const [activeIdx, setActiveIdx] = useState(0);

  const featured = products.filter((p) => p.imageUrl).slice(0, 6);

  useEffect(() => {
    if (featured.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIdx((i) => (i + 1) % featured.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [featured.length]);

  const catChips = [
    { label: "Gaming PCs", href: "/pc" },
    { label: "Graphics Cards", href: "/graphics-cards" },
    { label: "Laptops", href: "/laptops" },
    { label: "Servers", href: "/servers" },
    { label: "Repairs", href: "/repairs" },
  ];

  const stats = [
    { value: "1000+", label: "Products" },
    { value: "500+", label: "Happy Customers" },
    { value: "24/7", label: "Support" },
  ];

  const highlights = [
    "Genuine Products",
    "Fast Delivery Across Kenya",
    "Secure Payments",
  ];

  return (
    <section className="hero">
      <div className="hero-bg">
        <div className="hero-glow hero-glow--1" />
        <div className="hero-glow hero-glow--2" />
        {Array.from({ length: 12 }).map((_, i) => (
          <HeroParticle key={i} delay={i * 0.7} left={8 + i * 7.5} size={3 + (i % 3)} />
        ))}
      </div>

      <div className="hero-inner">
        <div className="hero-content">
          <span className="hero-badge">
            <span className="hero-badge-dot" />
            Summer Tech Sale &mdash; Up to 30% Off
          </span>

          <h1 className="hero-headline">
            Power Your <span className="hero-headline-accent">Next Build</span>
          </h1>

          <p className="hero-sub">
            Discover premium gaming PCs, laptops, graphics cards, servers, and
            accessories at unbeatable prices. Kenya&apos;s trusted all-in-one
            tech platform.
          </p>

          <div className="hero-actions">
            <Link href="/pc" className="btn btn-primary btn-lg hero-btn-glass">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              Shop Now
            </Link>
            <Link href="/#categories" className="btn btn-secondary btn-lg hero-btn-glass">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              Browse Categories
            </Link>
          </div>

          <div className="hero-highlights">
            {highlights.map((h) => (
              <span key={h} className="hero-highlight">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {h}
              </span>
            ))}
          </div>

          <div className="hero-chips">
            {catChips.map((c) => (
              <Link key={c.href} href={c.href} className="hero-chip">{c.label}</Link>
            ))}
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-image-wrap">
            <div className="hero-image-glow" />
            {featured.length > 0 ? (
              featured.map((p, i) => (
                <div
                  key={p.id}
                  className={`hero-product-slide${i === activeIdx ? " active" : ""}`}
                >
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="hero-product-img" />
                  ) : (
                    <div className="hero-product-placeholder">
                      {p.name.split(/\s+/).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                    </div>
                  )}
                  <div className="hero-product-info">
                    <span className="hero-product-name">{p.name}</span>
                    <span className="hero-product-price">{formatPrice(p.price)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="hero-product-placeholder hero-product-placeholder--large">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.3}}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </div>
            )}
            {featured.length > 1 && (
              <div className="hero-dots">
                {featured.map((_, i) => (
                  <button
                    key={i}
                    className={`hero-dot${i === activeIdx ? " active" : ""}`}
                    onClick={() => setActiveIdx(i)}
                    aria-label={`Show product ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="hero-stats">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className="hero-stat hero-stat-glass"
                style={{ animationDelay: `${i * 0.3}s` }}
              >
                <span className="hero-stat-value">{s.value}</span>
                <span className="hero-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hero-trust">
        <div className="hero-stars">
          {[0,1,2,3,4].map((i) => (
            <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          ))}
        </div>
        <span className="hero-trust-text">Trusted by 5,000+ customers across Kenya</span>
      </div>

      <div className="hero-wave">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <path d="M0 60C240 120 480 0 720 60C960 120 1200 0 1440 60V120H0V60Z" fill="var(--bg)"/>
        </svg>
      </div>
    </section>
  );
}

export function Header() { return null; }
export function Footer() { return null; }

export function HomePage({ products, categories }: {
  products: Product[]; categories: { id: string; label: string }[]; banners: any[];
}) {
  return (
    <>
      <HeroSection products={products} />

      <div style={{ maxWidth: "var(--max-width)", margin: "0 auto", padding: "0 var(--space-5)" }}>
        {categories.length > 0 && (
          <div id="categories" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "1.5rem 0" }}>
            {categories.map((cat) => (
              <a key={cat.id} href={`/${cat.id}`} className="btn btn-secondary btn-sm">{cat.label}</a>
            ))}
          </div>
        )}

        <h2>All products</h2>
        {products.length === 0 ? (
          <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>No products found.</p>
        ) : (
          <div className="product-grid">
            {products.map((p) => {
              const initials = p.name.split(/\s+/).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
              return (
                <Link key={p.id} href={`/product?id=${encodeURIComponent(p.id)}`} className="product-card">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.imageAlt || p.name} loading="lazy" />
                  ) : (
                    <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", borderRadius: 10, fontSize: "2rem", fontWeight: 700, color: "var(--border)", marginBottom: "0.75rem" }}>
                      {initials}
                    </div>
                  )}
                  <h3>{p.name}</h3>
                  <div className="price">{formatPrice(p.price)}</div>
                  <div className={`stock-badge ${p.inStock ? "in-stock" : "out-of-stock"}`}>
                    {p.inStock ? "In stock" : "Enquire for availability"}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
