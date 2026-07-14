import React from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "./shared";

export const LAYOUT_KEY = "custom";
export const LAYOUT_LABEL = "Custom Import";
export const LAYOUT_DESC = "Import a JSON layout preset to create a branded storefront experience";

export function LayoutStyles() {
  return <></>;
}

export function Header({ settings }: { categories: { id: string; label: string }[]; settings: any; isLoggedIn?: boolean; userName?: string; cartCount?: number; isDark?: boolean; toggleDark?: () => void; logout?: () => void; isStaff?: boolean }) {
  return null;
}

export function Footer({ settings }: { settings: any }) {
  return null;
}

export function HomePage({ products, categories, banners, customLayout }: {
  products: Product[];
  categories: { id: string; label: string }[];
  banners: any[];
  customLayout?: any;
}) {
  const cfg = customLayout || {};
  const accent = cfg.accentColor || "#2563eb";
  const heroTitle = cfg.heroTitle || "Welcome to our store";
  const heroSubtitle = cfg.heroSubtitle || "Imported storefront layout preset";
  const ctaLabel = cfg.ctaLabel || "Shop now";
  const ctaUrl = cfg.ctaUrl || "/";
  const heroImageUrl = cfg.heroImageUrl || "";
  const showCategories = cfg.showCategories !== false;
  const showProducts = cfg.showProducts !== false;
  const limit = Number(cfg.productsLimit || 8);
  const displayProducts = products.slice(0, Math.max(1, limit));

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <section style={{ borderRadius: "1rem", overflow: "hidden", background: `linear-gradient(135deg, ${accent}, #0f172a)`, color: "#fff", boxShadow: "var(--shadow-lg)" }}>
        <div style={{ display: "grid", gridTemplateColumns: heroImageUrl ? "1.2fr 0.8fr" : "1fr", gap: "1rem", padding: "1.5rem" }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "0.75rem" }}>
            <span style={{ display: "inline-flex", alignSelf: "flex-start", padding: "0.35rem 0.6rem", borderRadius: "999px", background: "rgba(255,255,255,0.16)", fontSize: "0.8rem", fontWeight: 700 }}>
              {cfg.label || "Imported Layout"}
            </span>
            <h2 style={{ margin: 0, fontSize: "clamp(1.4rem, 2.2vw, 2rem)" }}>{heroTitle}</h2>
            <p style={{ margin: 0, fontSize: "0.98rem", lineHeight: 1.6, opacity: 0.92 }}>{heroSubtitle}</p>
            <Link href={ctaUrl} className="btn" style={{ alignSelf: "flex-start", background: "#fff", color: accent, fontWeight: 700 }}>
              {ctaLabel}
            </Link>
          </div>
          {heroImageUrl ? <img src={heroImageUrl} alt={heroTitle} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "0.8rem", minHeight: 220 }} /> : null}
        </div>
      </section>

      {banners.length > 0 && (
        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {banners.slice(0, 3).map((banner, index) => (
            <div key={index} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.9rem", padding: "1rem" }}>
              <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>{banner.title || "Featured"}</h3>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>{banner.subtitle || ""}</p>
            </div>
          ))}
        </div>
      )}

      {showCategories && categories.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {categories.map((cat) => (
            <Link key={cat.id} href={`/${cat.id}`} className="btn btn-secondary btn-sm">{cat.label}</Link>
          ))}
        </div>
      )}

      {showProducts && displayProducts.length > 0 && (
        <>
          <h2 style={{ marginBottom: 0 }}>{cfg.productsHeading || "Featured products"}</h2>
          <div className="product-grid">
            {displayProducts.map((product) => (
              <Link key={product.id} href={`/product?id=${encodeURIComponent(product.id)}`} className="product-card">
                {product.imageUrl ? <img src={product.imageUrl} alt={product.imageAlt || product.name} loading="lazy" /> : <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", borderRadius: 10, fontSize: "2rem", fontWeight: 700, color: "var(--border)", marginBottom: "0.75rem" }}>{product.name.slice(0, 2).toUpperCase()}</div>}
                <h3>{product.name}</h3>
                <div className="price">{formatPrice(product.price)}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
