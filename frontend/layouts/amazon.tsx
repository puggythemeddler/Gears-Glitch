import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { Product } from "@/lib/types";
import CurrencySelector from "@/components/CurrencySelector";
import { formatPrice, escapeHtml } from "./shared";

export const LAYOUT_KEY = "amazon";
export const LAYOUT_LABEL = "Amazon Style";
export const LAYOUT_DESC = "Large search bar, horizontal categories, product recommendations, featured deals";

export function LayoutStyles() {
  return <style>{`
    .amz-top { background: var(--surface); border-bottom: 1px solid var(--border); }
    .amz-top-inner { max-width: 1440px; margin: 0 auto; padding: 0.75rem 1rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .amz-search { flex: 1; min-width: 200px; display: flex; border: 2px solid var(--primary); border-radius: 8px; overflow: hidden; }
    .amz-search input { flex: 1; border: none; padding: 0.6rem 1rem; font-size: 1rem; background: var(--bg); color: var(--text); outline: none; }
    .amz-search button { background: var(--primary); color: #fff; border: none; padding: 0.6rem 1.2rem; cursor: pointer; font-weight: 600; }
    .amz-nav { max-width: 1440px; margin: 0 auto; padding: 0.5rem 1rem; display: flex; gap: 0.25rem; flex-wrap: wrap; }
    .amz-nav a { padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.9rem; color: var(--text); text-decoration: none; }
    .amz-nav a:hover { background: var(--primary); color: #fff; }
    .amz-hero { max-width: 1440px; margin: 1rem auto; padding: 0 1rem; display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; }
    .amz-hero-main { border-radius: 12px; overflow: hidden; position: relative; background: linear-gradient(135deg, var(--primary), #7c3aed); color: #fff; padding: 3rem; min-height: 300px; display: flex; flex-direction: column; justify-content: center; }
    .amz-hero-main h2 { font-size: 2rem; margin: 0 0 0.5rem; }
    .amz-hero-main p { font-size: 1.1rem; margin: 0 0 1.5rem; opacity: 0.9; }
    .amz-hero-side { display: flex; flex-direction: column; gap: 1rem; }
    .amz-hero-side-item { border-radius: 12px; padding: 1.5rem; flex: 1; background: var(--surface); border: 1px solid var(--border); display: flex; flex-direction: column; justify-content: center; }
    .amz-hero-side-item h3 { margin: 0 0 0.25rem; font-size: 1.1rem; }
    .amz-hero-side-item p { margin: 0; font-size: 0.85rem; color: var(--text-secondary); }
    .amz-section { max-width: 1440px; margin: 2rem auto; padding: 0 1rem; }
    .amz-section h2 { font-size: 1.4rem; margin: 0 0 1rem; display: flex; align-items: center; gap: 0.5rem; }
    .amz-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
    .amz-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; transition: transform 0.2s, box-shadow 0.2s; text-decoration: none; color: inherit; display: flex; flex-direction: column; }
    .amz-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
    .amz-card-img { height: 180px; background: var(--bg); display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 700; color: var(--border); }
    .amz-card-img img { width: 100%; height: 100%; object-fit: contain; }
    .amz-card-body { padding: 0.75rem 1rem 1rem; flex: 1; display: flex; flex-direction: column; }
    .amz-card-body h3 { margin: 0 0 0.3rem; font-size: 0.95rem; line-height: 1.3; }
    .amz-card-price { font-weight: 700; color: var(--primary); font-size: 1.1rem; margin-top: auto; }
    .amz-card-rating { font-size: 0.8rem; color: #f59e0b; margin-bottom: 0.3rem; }
    .amz-card-badge { display: inline-block; background: #dc2626; color: #fff; font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 4px; margin-bottom: 0.4rem; align-self: flex-start; }
    .amz-banner-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; max-width: 1440px; margin: 1.5rem auto; padding: 0 1rem; }
    .amz-banner-item { border-radius: 10px; padding: 1.5rem; background: var(--surface); border: 1px solid var(--border); text-align: center; }
    .amz-banner-item h3 { margin: 0 0 0.25rem; font-size: 1rem; }
    .amz-banner-item p { margin: 0; font-size: 0.85rem; color: var(--text-secondary); }
    @media (max-width: 768px) {
      .amz-hero { grid-template-columns: 1fr; }
      .amz-hero-main { min-height: 200px; padding: 2rem; }
      .amz-hero-main h2 { font-size: 1.4rem; }
      .amz-banner-row { grid-template-columns: 1fr; }
    }
  `}</style>;
}

export function Header({ categories, settings, isLoggedIn, userName, cartCount, isDark, toggleDark, logout, isStaff }: { categories: { id: string; label: string }[]; settings: any; isLoggedIn?: boolean; userName?: string; cartCount?: number; isDark?: boolean; toggleDark?: () => void; logout?: () => void; isStaff?: boolean }) {
  return (
    <div className="amz-top">
      <div className="amz-top-inner">
        <Link href="/" style={{ fontWeight: 700, fontSize: "1.3rem", color: "var(--text)", textDecoration: "none", whiteSpace: "nowrap" }}>
          {settings?.storeLogo ? <img src={settings.storeLogo} alt="Store" style={{ height: 64 }} /> : settings?.storeName || "Store"}
        </Link>
        <div className="amz-search">
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
      <nav className="amz-nav">
        {categories.map((cat) => (
          <a key={cat.id} href={`/${cat.id}`}>{cat.label}</a>
        ))}
      </nav>
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
  const bestsellers = [...products].sort((a, b) => (b as any).viewCount || 0 - (a as any).viewCount || 0).slice(0, 4);
  const deals = products.filter((p) => p.inStock && (p as any).oldPrice).slice(0, 4);

  const heroTitle = hero?.headline ? `${hero.headline} ${hero.headlineAccent || ""}` : "Premium Tech Deals";
  const heroSub = hero?.subtitle || "Shop the latest computers, laptops, and accessories at unbeatable prices.";
  const heroCtaLabel = hero?.shopNowLabel || "Shop Now";
  const heroCtaLink = hero?.shopNowLink || (categories[0] ? `/${categories[0].id}` : "/products");

  return (
    <div className="amz-layout">
      {hero?.heroActive !== false && (
      <div className="amz-hero">
        <div className="amz-hero-main">
          <h2>{heroTitle}</h2>
          <p>{heroSub}</p>
          <Link href={heroCtaLink} className="btn" style={{ alignSelf: "flex-start" }}>{heroCtaLabel}</Link>
        </div>
        <div className="amz-hero-side">
          {banners.slice(0, 2).map((b, i) => (
            <div key={i} className="amz-hero-side-item"><h3>{b.title || "Special Offer"}</h3><p>{b.subtitle || ""}</p></div>
          ))}
          {banners.length === 0 && (
            <>
              <div className="amz-hero-side-item"><h3>Free Delivery</h3><p>On orders over KES 50,000</p></div>
              <div className="amz-hero-side-item"><h3>24/7 Support</h3><p>Call or chat with our team</p></div>
            </>
          )}
        </div>
      </div>
      )}

      {deals.length > 0 && (
        <div className="amz-section">
          <h2>🔥 Featured Deals</h2>
          <div className="amz-grid">
            {deals.map((p) => <AmazonCard key={p.id} product={p} />)}
          </div>
        </div>
      )}

      {banners.length > 2 && (
        <div className="amz-banner-row">
          {banners.slice(2).map((b, i) => (
            <div key={i} className="amz-banner-item"><h3>{b.title}</h3><p>{b.subtitle}</p></div>
          ))}
        </div>
      )}

      <div className="amz-section">
        <h2>📦 Best Sellers</h2>
        <div className="amz-grid">
          {bestsellers.map((p) => <AmazonCard key={p.id} product={p} />)}
        </div>
      </div>

    </div>
  );
}

function AmazonCard({ product }: { product: Product }) {
  const initials = product.name.split(/\s+/).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
  const [rating, setRating] = useState<{ average: number; count: number } | null>(null);

  useEffect(() => {
    fetch(`/api/products/${encodeURIComponent(product.id)}/reviews`).then((r) => r.json()).then((d) => {
      if (d.rating && d.rating.count > 0) setRating(d.rating);
    }).catch(() => {});
  }, [product.id]);

  return (
    <Link href={`/product?id=${encodeURIComponent(product.id)}`} className="amz-card">
      <div className="amz-card-img">
        {product.imageUrl ? <img src={product.imageUrl} alt={product.imageAlt || product.name} loading="lazy" /> : initials}
      </div>
      <div className="amz-card-body">
        {rating ? (
          <div className="amz-card-rating">
            <span style={{ color: "#f59e0b", fontSize: "0.85rem" }}>{Array.from({ length: 5 }).map((_, i) => i < Math.round(rating.average) ? "★" : "☆").join("")}</span>
            <span style={{ fontSize: "0.7rem", color: "#666", marginLeft: 4 }}>({rating.count})</span>
          </div>
        ) : null}
        <h3>{product.name}</h3>
        <div className="amz-card-price">{formatPrice(product.price)}</div>
      </div>
    </Link>
  );
}
