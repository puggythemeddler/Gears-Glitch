import React from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import CurrencySelector from "@/components/CurrencySelector";
import { formatPrice, escapeHtml } from "./shared";

export const LAYOUT_KEY = "mobile";
export const LAYOUT_LABEL = "Mobile Phone Store";
export const LAYOUT_DESC = "Premium minimalist, hero banners, featured phones, compare specs, brand collections";

export function LayoutStyles() {
  return <style>{`
    .mob-header { background: var(--surface); border-bottom: 1px solid var(--border); }
    .mob-header-inner { width: 100%; padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .mob-brand { font-weight: 700; font-size: 1.2rem; color: var(--text); text-decoration: none; letter-spacing: -0.5px; }
    .mob-nav { display: flex; gap: 1.5rem; }
    .mob-nav a { color: var(--text-secondary); text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: color 0.15s; }
    .mob-nav a:hover { color: var(--primary); }
    .mob-hero { width: 100%; margin: 1.5rem 0; padding: 0 1rem; border-radius: 16px; overflow: hidden; position: relative; }
    .mob-hero-inner { background: linear-gradient(135deg, #1e1b4b, #312e81); color: #fff; padding: 4rem 3rem; min-height: 380px; display: flex; flex-direction: column; justify-content: center; }
    .mob-hero-inner h2 { font-size: 2.5rem; margin: 0 0 0.5rem; font-weight: 700; letter-spacing: -1px; }
    .mob-hero-inner p { font-size: 1.1rem; margin: 0 0 1.5rem; opacity: 0.85; }
    .mob-hero-badge { display: inline-block; background: rgba(255,255,255,0.15); padding: 0.3rem 1rem; border-radius: 999px; font-size: 0.8rem; margin-bottom: 1rem; align-self: flex-start; backdrop-filter: blur(4px); }
    .mob-brands { width: 100%; margin: 2rem 0; padding: 0 1rem; }
    .mob-brands h2 { font-size: 1.1rem; margin: 0 0 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; }
    .mob-brand-chips { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .mob-brand-chip { padding: 0.5rem 1.2rem; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); color: var(--text); text-decoration: none; font-size: 0.85rem; font-weight: 500; transition: all 0.15s; }
    .mob-brand-chip:hover { background: var(--primary); color: #fff; border-color: var(--primary); }
    .mob-section { width: 100%; margin: 2.5rem 0; padding: 0 1rem; }
    .mob-section h2 { font-size: 1.5rem; margin: 0 0 0.25rem; }
    .mob-section .sub { color: var(--text-secondary); font-size: 0.9rem; margin: 0 0 1rem; }
    .mob-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; }
    .mob-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; text-decoration: none; color: inherit; transition: transform 0.2s, box-shadow 0.2s; }
    .mob-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.1); }
    .mob-card-img { height: 220px; background: var(--bg); display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .mob-card-img img { width: 100%; height: 100%; object-fit: contain; }
    .mob-card-body { padding: 1rem 1.25rem 1.25rem; }
    .mob-card-body h3 { margin: 0 0 0.25rem; font-size: 1rem; }
    .mob-card-specs { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem; line-height: 1.4; }
    .mob-card-price { font-weight: 700; font-size: 1.15rem; color: var(--primary); }
    .mob-card-warranty { font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.3rem; }
    .mob-card-compare { font-size: 0.8rem; color: var(--primary); margin-top: 0.5rem; display: inline-flex; align-items: center; gap: 0.3rem; }
    .mob-features { width: 100%; margin: 2rem 0; padding: 0 1rem; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .mob-feature { text-align: center; padding: 1.5rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }
    .mob-feature .icon { font-size: 2rem; margin-bottom: 0.5rem; }
    .mob-feature h4 { margin: 0 0 0.25rem; font-size: 0.95rem; }
    .mob-feature p { margin: 0; font-size: 0.8rem; color: var(--text-secondary); }
    .mob-accessories { width: 100%; margin: 2.5rem 0; padding: 0 1rem; }
    .mob-accessories h2 { font-size: 1.3rem; margin: 0 0 1rem; }
    .mob-accessories-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.75rem; }
    .mob-acc-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1rem; text-align: center; text-decoration: none; color: inherit; }
    .mob-acc-card .icon { font-size: 2rem; margin-bottom: 0.5rem; }
    .mob-acc-card h4 { margin: 0 0 0.25rem; font-size: 0.85rem; }
    .mob-acc-card .price { font-size: 0.85rem; color: var(--primary); font-weight: 600; }
    @media (max-width: 768px) {
      .mob-hero-inner { min-height: 260px; padding: 2rem 1.5rem; }
      .mob-hero-inner h2 { font-size: 1.6rem; }
      .mob-nav { gap: 0.75rem; }
      .mob-features { grid-template-columns: repeat(2, 1fr); }
    }
  `}</style>;
}

export function Header({ categories, settings, isLoggedIn, userName, cartCount, isDark, toggleDark, logout, isStaff }: { categories: { id: string; label: string }[]; settings: any; isLoggedIn?: boolean; userName?: string; cartCount?: number; isDark?: boolean; toggleDark?: () => void; logout?: () => void; isStaff?: boolean }) {
  return (
    <div className="mob-header">
      <div className="mob-header-inner">
        <Link href="/" className="mob-brand">
          {settings?.storeLogo ? <img src={settings.storeLogo} alt="Store" style={{ height: 64 }} /> : settings?.storeName || "Store"}
        </Link>
        <nav className="mob-nav">
          <a href="/">Home</a>
          {categories.slice(0, 2).map((cat) => (
            <a key={cat.id} href={`/${cat.id}`}>{cat.label}</a>
          ))}
          <a href="/repairs">Repairs</a>
          {isLoggedIn ? (
            <a href="/dashboard" style={{ fontSize: "0.8rem" }}>{userName || "Account"}</a>
          ) : (
            <a href="/login" style={{ fontSize: "0.8rem" }}>Sign in</a>
          )}
          <CurrencySelector />
          <a href="/cart" style={{ fontSize: "0.8rem" }}>Cart{cartCount ? ` (${cartCount})` : ""}</a>
          <button type="button" onClick={toggleDark} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.2rem 0.4rem", cursor: "pointer", fontSize: "0.8rem", color: "var(--text)", lineHeight: 1 }}>{isDark ? "☀️" : "🌙"}</button>
        </nav>
      </div>
    </div>
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
  const accessories = products.filter((p) => p.inStock && p.category?.toLowerCase().includes("access")).slice(0, 6);
  const brands = [...new Set(products.map((p) => p.name.split(/\s+/)[0]).filter(Boolean))].slice(0, 8);

  const heroBadge = hero?.badgeActive !== false ? (hero?.badgeText || "New Arrivals") : null;
  const heroTitle = hero?.headline ? `${hero.headline} ${hero.headlineAccent || ""}` : "Premium Devices";
  const heroSub = hero?.subtitle || "Discover the latest smartphones, laptops, and tablets with cutting-edge technology.";
  const heroCtaLabel = hero?.shopNowLabel || "Explore";
  const heroCtaLink = hero?.shopNowLink || (categories[0] ? `/${categories[0].id}` : "/");

  return (
    <div className="mob-layout">
      {hero?.heroActive !== false && (
      <div className="mob-hero">
        <div className="mob-hero-inner">
          {heroBadge && <span className="mob-hero-badge">{heroBadge}</span>}
          <h2>{heroTitle}</h2>
          <p>{heroSub}</p>
          <Link href={heroCtaLink} className="btn" style={{ alignSelf: "flex-start", background: "#fff", color: "#1e1b4b", fontWeight: 600 }}>{heroCtaLabel}</Link>
        </div>
      </div>
      )}

      <div className="mob-brands">
        <h2>Shop by Brand</h2>
        <div className="mob-brand-chips">
          {brands.map((brand) => (
            <a key={brand} href={`/products?brand=${encodeURIComponent(brand)}`} className="mob-brand-chip">{brand}</a>
          ))}
        </div>
      </div>

      <div className="mob-features">
        <div className="mob-feature"><div className="icon">🔒</div><h4>Secure Payment</h4><p>M-Pesa & card payments</p></div>
        <div className="mob-feature"><div className="icon">📦</div><h4>Free Delivery</h4><p>On orders over KES 50k</p></div>
        <div className="mob-feature"><div className="icon">🛡️</div><h4>1 Year Warranty</h4><p>On all devices</p></div>
        <div className="mob-feature"><div className="icon">💬</div><h4>24/7 Support</h4><p>Call or chat with us</p></div>
      </div>


      {accessories.length > 0 && (
        <div className="mob-accessories">
          <h2>Accessories</h2>
          <div className="mob-accessories-grid">
            {accessories.map((p) => (
              <Link key={p.id} href={`/product?id=${encodeURIComponent(p.id)}`} className="mob-acc-card">
                <div className="icon">🎧</div>
                <h4>{p.name}</h4>
                <div className="price">{formatPrice(p.price)}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {banners.length > 0 && (
        <div className="mob-section">
          <h2>Offers</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "1rem" }}>
            {banners.map((b, i) => (
              <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "1.5rem" }}>
                <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>{b.title}</h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>{b.subtitle}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
