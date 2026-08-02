import React from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "./shared";

export const LAYOUT_KEY = "custom";
export const LAYOUT_LABEL = "Custom";
export const LAYOUT_DESC = "A configurable custom storefront layout with hero, categories, and featured product grid.";

export function LayoutStyles() {
  return (
    <style>{`
      .custom-hero { background: linear-gradient(135deg, rgba(29, 78, 216, 0.95), rgba(59, 130, 246, 0.95)); color: white; padding: 4rem 1rem; text-align: center; }
      .custom-hero h1 { font-size: clamp(2.25rem, 4vw, 3.75rem); margin: 0 0 1rem; text-align: center; }
      .custom-hero p { font-size: 1.05rem; max-width: 720px; margin: 0 auto 1.5rem; line-height: 1.6; text-align: center; }
      .custom-hero a { display: inline-block; margin-top: 1rem; background: white; color: var(--primary); padding: 0.95rem 1.5rem; border-radius: 999px; font-weight: 700; text-decoration: none; }
      .custom-hero img { max-width: 100%; height: auto; border-radius: 1rem; margin-top: 1.5rem; }
      .custom-content { display: grid; gap: 2rem; max-width: 1440px; margin: 0 auto; padding: 2rem 1rem; }
      .custom-category-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
      .custom-category-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 1.25rem; text-align: left; }
      .custom-category-card a { color: var(--text); text-decoration: none; font-weight: 700; }
      .custom-products-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.25rem; }
      .custom-product-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; text-decoration: none; color: inherit; display: flex; flex-direction: column; }
      .custom-product-card img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
      .custom-product-card .card-body { padding: 1rem; display: grid; gap: 0.5rem; flex: 1; }
      .custom-product-card h3 { font-size: 1rem; margin: 0; }
      .custom-product-card .price { font-size: 1rem; font-weight: 700; }
      .custom-product-card .stock { font-size: 0.9rem; color: var(--text-secondary); }
      @media (max-width: 768px) {
        .custom-hero { padding: 3rem 1rem; }
        .custom-category-list, .custom-products-grid { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}

export function Header({ categories, settings }: { categories: { id: string; label: string }[]; settings: any; isLoggedIn?: boolean; userName?: string; cartCount?: number; isDark?: boolean; toggleDark?: () => void; logout?: () => void; isStaff?: boolean }) {
  return null;
}

export function Footer({ settings }: { settings: any }) {
  return null;
}

export function HomePage({ products, categories, banners, hero }: { products: Product[]; categories: { id: string; label: string }[]; banners: any[]; hero?: any }) {
  const heroTitle = hero?.headline ? `${hero.headline} ${hero.headlineAccent || ""}` : (banners[0]?.title || "Welcome to Your Custom Store");
  const heroSub = hero?.subtitle || banners[0]?.subtitle || "A flexible storefront layout that adapts to your brand and features your top products.";
  const heroCtaLabel = hero?.shopNowLabel || "Shop now";
  const heroCtaLink = hero?.shopNowLink || "/cart";

  return (
    <>
      {hero?.heroActive !== false && (
      <section className="custom-hero">
        <div className="custom-content">
          <h1>{heroTitle}</h1>
          <p>{heroSub}</p>
          <a href={heroCtaLink}>{heroCtaLabel}</a>
          {banners[0]?.imageUrl && <img src={banners[0].imageUrl} alt={banners[0]?.title || "Store hero image"} />}
        </div>
      </section>
      )}

      {categories.length > 0 && (
        <section className="custom-content">
          <h2>Shop by category</h2>
          <div className="custom-category-list">
            {categories.slice(0, 6).map((cat) => (
              <div key={cat.id} className="custom-category-card">
                <Link href={`/${cat.id}`}>{cat.label}</Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="custom-content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <h2>Featured products</h2>
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>A curated selection of your best sellers.</p>
        </div>
        {products.length === 0 ? (
          <p style={{ textAlign: "left", color: "var(--text-secondary)", marginTop: "1rem" }}>No products available yet.</p>
        ) : (
          <div className="custom-products-grid">
            {products.slice(0, 8).map((product) => (
              <Link key={product.id} href={`/product?id=${encodeURIComponent(product.id)}`} className="custom-product-card">
                {product.imageUrl ? <img src={product.imageUrl} alt={product.imageAlt || product.name} /> : <div style={{ height: 180, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", color: "var(--border)" }}>{product.name.slice(0, 1)}</div>}
                <div className="card-body">
                  <h3>{product.name}</h3>
                  <div className="price">{formatPrice(product.price)}</div>
                  <div className="stock">{product.inStock ? "In stock" : "Out of stock"}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
