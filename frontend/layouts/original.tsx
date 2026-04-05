import React from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice, escapeHtml } from "./shared";

export const LAYOUT_KEY = "original";
export const LAYOUT_LABEL = "Original";
export const LAYOUT_DESC = "The classic storefront with hero banner, category links, and product grid";

export function LayoutStyles() {
  return <></>;
}

export function Header({ categories, settings, isLoggedIn, userName, cartCount, isDark, toggleDark, logout, isStaff }: { categories: { id: string; label: string }[]; settings: any; isLoggedIn?: boolean; userName?: string; cartCount?: number; isDark?: boolean; toggleDark?: () => void; logout?: () => void; isStaff?: boolean }) {
  return null;
}

export function Footer({ settings }: { settings: any }) {
  return null;
}

export function HomePage({ products, categories }: {
  products: Product[]; categories: { id: string; label: string }[]; banners: any[];
}) {
  return (
    <>
      {categories.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "1.5rem 0" }}>
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
    </>
  );
}
