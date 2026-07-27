import React, { useState, useEffect } from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import CurrencySelector from "@/components/CurrencySelector";
import { formatPrice, escapeHtml } from "./shared";

export const LAYOUT_KEY = "jumia";
export const LAYOUT_LABEL = "Jumia Style";
export const LAYOUT_DESC = "Large promotional sliders, flash sales, daily deals, category icons";

export function LayoutStyles() {
  return <style>{`
    .jum-header { background: var(--surface); border-bottom: 1px solid var(--border); }
    .jum-header-inner { max-width: 1440px; margin: 0 auto; padding: 0.75rem 1rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .jum-brand { font-weight: 700; font-size: 1.3rem; color: var(--text); text-decoration: none; }
    .jum-search { flex: 1; min-width: 180px; display: flex; border: 2px solid var(--primary); border-radius: 8px; overflow: hidden; }
    .jum-search input { flex: 1; border: none; padding: 0.5rem 0.8rem; font-size: 0.95rem; background: var(--bg); color: var(--text); outline: none; }
    .jum-search button { background: var(--primary); color: #fff; border: none; padding: 0.5rem 1rem; cursor: pointer; font-weight: 600; }
    .jum-cat-icons { max-width: 1440px; margin: 1rem auto; padding: 0 1rem; display: flex; gap: 0.75rem; overflow-x: auto; flex-wrap: nowrap; }
    .jum-cat-icon { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; text-decoration: none; color: var(--text); font-size: 0.8rem; min-width: 80px; padding: 0.5rem; border-radius: 10px; transition: background 0.15s; }
    .jum-cat-icon:hover { background: var(--primary); color: #fff; }
    .jum-cat-icon .icon { font-size: 1.6rem; }
    .jum-slider { max-width: 1440px; margin: 1rem auto; padding: 0 1rem; border-radius: 12px; overflow: hidden; position: relative; }
    .jum-slide { background: linear-gradient(135deg, var(--primary), #7c3aed); color: #fff; padding: 3rem 2rem; min-height: 280px; display: flex; flex-direction: column; justify-content: center; border-radius: 12px; }
    .jum-slide h2 { font-size: 2rem; margin: 0 0 0.5rem; }
    .jum-slide p { font-size: 1.1rem; margin: 0 0 1rem; opacity: 0.9; }
    .jum-dots { display: flex; justify-content: center; gap: 0.5rem; margin-top: 0.75rem; }
    .jum-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--border); cursor: pointer; border: none; padding: 0; }
    .jum-dot.active { background: var(--primary); }
    .jum-section { max-width: 1440px; margin: 2rem auto; padding: 0 1rem; }
    .jum-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .jum-section-header h2 { margin: 0; font-size: 1.3rem; }
    .jum-timer { font-size: 0.85rem; color: var(--primary); font-weight: 600; }
    .jum-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.75rem; }
    .jum-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; text-decoration: none; color: inherit; position: relative; transition: transform 0.2s; }
    .jum-card:hover { transform: translateY(-2px); }
    .jum-card-img { height: 160px; background: var(--bg); display: flex; align-items: center; justify-content: center; }
    .jum-card-img img { width: 100%; height: 100%; object-fit: contain; }
    .jum-card-body { padding: 0.6rem 0.75rem 0.75rem; }
    .jum-card-body h3 { margin: 0 0 0.3rem; font-size: 0.85rem; line-height: 1.3; }
    .jum-card-price { font-weight: 700; color: var(--primary); }
    .jum-card-old { font-size: 0.75rem; color: var(--text-secondary); text-decoration: line-through; margin-left: 0.3rem; }
    .jum-discount { position: absolute; top: 8px; left: 8px; background: #dc2626; color: #fff; font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 600; }
    .jum-sponsored { font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.3rem; }
    @media (max-width: 768px) {
      .jum-slide { min-height: 200px; padding: 2rem 1.5rem; }
      .jum-slide h2 { font-size: 1.3rem; }
    }
  `}</style>;
}

export function Header({ categories, settings, isLoggedIn, userName, cartCount, isDark, toggleDark, logout, isStaff }: { categories: { id: string; label: string }[]; settings: any; isLoggedIn?: boolean; userName?: string; cartCount?: number; isDark?: boolean; toggleDark?: () => void; logout?: () => void; isStaff?: boolean }) {
  return (
    <>
      <div className="jum-header">
        <div className="jum-header-inner">
          <Link href="/" className="jum-brand">
            {settings?.storeLogo ? <img src={settings.storeLogo} alt="Store" style={{ height: 64 }} /> : settings?.storeName || "Store"}
          </Link>
          <div className="jum-search">
            <input type="text" placeholder="Search products..." />
            <button type="button">Search</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginLeft: "auto" }}>
            <CurrencySelector />
            <button type="button" onClick={toggleDark} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.3rem 0.5rem", cursor: "pointer", fontSize: "0.85rem", color: "var(--text)", lineHeight: 1 }}>{isDark ? "☀️" : "🌙"}</button>
            {isLoggedIn ? (
              <>
                <a href="/dashboard" style={{ fontSize: "0.9rem", color: "var(--text)", textDecoration: "none" }}>{userName || "Account"}</a>
                {isStaff && <a href="/owner" style={{ fontSize: "0.9rem", color: "var(--text)", textDecoration: "none" }}>Owner</a>}
                <button type="button" onClick={logout} style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer", fontSize: "0.9rem" }}>Sign out</button>
              </>
            ) : (
              <a href="/login" style={{ fontSize: "0.9rem", color: "var(--text)", textDecoration: "none" }}>Sign in</a>
            )}
            <a href="/about" style={{ fontSize: "0.9rem", color: "var(--text)", textDecoration: "none" }}>About</a>
            <a href="/cart" style={{ fontSize: "0.9rem", color: "var(--text)", textDecoration: "none", position: "relative" }}>
              Cart{cartCount ? <span style={{ background: "var(--primary)", color: "#fff", fontSize: "0.7rem", borderRadius: "50%", padding: "0.1rem 0.4rem", marginLeft: "0.25rem" }}>{cartCount}</span> : null}
            </a>
          </div>
        </div>
      </div>
      <div className="jum-cat-icons">
        {categories.map((cat, i) => (
          <a key={cat.id} href={`/${cat.id}`} className="jum-cat-icon">
            <span className="icon">{["💻","🖥️","🖨️","📱","⌚","🎧","📷","🔧"][i % 8]}</span>
            <span>{cat.label}</span>
          </a>
        ))}
      </div>
    </>
  );
}

export function Footer({ settings }: { settings: any }) {
  return (
    <footer className="site-footer" style={{ marginTop: "3rem" }}>
      <div className="footer-inner">
        <p>&copy; {new Date().getFullYear()} {settings?.storeName || "Store"}. All rights reserved.</p>
      </div>
    </footer>
  );
}

export function HomePage({ products, categories, banners, hero }: {
  products: Product[]; categories: { id: string; label: string }[]; banners: any[]; hero?: any;
}) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const heroTitle = hero?.headline ? `${hero.headline} ${hero.headlineAccent || ""}` : "";
  const heroSub = hero?.subtitle || "";
  const heroCtaLabel = hero?.shopNowLabel || "Shop Now";
  const heroCtaLink = hero?.shopNowLink || (categories[0] ? `/${categories[0].id}` : "/");
  const slides = banners.length > 0 ? banners : [
    { title: heroTitle || "Flash Sale Today", subtitle: heroSub || "Up to 50% off on select laptops" },
    { title: "New Arrivals", subtitle: "Latest tech just landed" },
    { title: "Free Delivery", subtitle: "On orders over KES 50,000" },
  ];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => setSlideIdx((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, [slides.length, reducedMotion]);

  const deals = products.filter((p) => p.inStock).slice(0, 8);

  return (
    <div className="jum-layout">
      {hero?.heroActive !== false && (
      <div className="jum-slider">
        <div className="jum-slide">
          <h2>{slides[slideIdx].title}</h2>
          <p>{slides[slideIdx].subtitle}</p>
          <Link href={heroCtaLink} className="btn" style={{ alignSelf: "flex-start" }}>{heroCtaLabel}</Link>
        </div>
        <div className="jum-dots">
          {slides.map((_, i) => (
            <button key={i} className={`jum-dot${i === slideIdx ? " active" : ""}`} onClick={() => setSlideIdx(i)} />
          ))}
        </div>
      </div>
      )}

      <div className="jum-section">
        <div className="jum-section-header">
          <h2>⚡ Flash Sales</h2>
          <span className="jum-timer">Ends in 23:59:59</span>
        </div>
        <div className="jum-grid">
          {deals.slice(0, 6).map((p) => (
            <Link key={p.id} href={`/product?id=${encodeURIComponent(p.id)}`} className="jum-card">
              <div className="jum-discount">-{Math.floor(Math.random() * 30 + 10)}%</div>
              <div className="jum-card-img">
                {p.imageUrl ? <img src={p.imageUrl} alt={p.imageAlt || p.name} loading="lazy" /> : p.name.split(/\s+/).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
              </div>
              <div className="jum-card-body">
                <h3>{p.name}</h3>
                <div className="jum-card-price">{formatPrice(p.price)} <span className="jum-card-old">{formatPrice(Math.round(p.price * 1.3))}</span></div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="jum-section">
        <div className="jum-section-header">
          <h2>Daily Deals</h2>
        </div>
        <div className="jum-grid">
          {deals.slice(0, 8).map((p) => (
            <Link key={p.id} href={`/product?id=${encodeURIComponent(p.id)}`} className="jum-card">
              <div className="jum-card-img">
                {p.imageUrl ? <img src={p.imageUrl} alt={p.imageAlt || p.name} loading="lazy" /> : p.name.split(/\s+/).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
              </div>
              <div className="jum-card-body">
                <h3>{p.name}</h3>
                <div className="jum-card-price">{formatPrice(p.price)}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
