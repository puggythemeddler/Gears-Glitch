import React from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";

interface ProductCardProps {
  product: Product;
}

/**
 * Static storefront card. Ratings arrive pre-attached from the products
 * list endpoint (withExtras=1) — no per-card request loop.
 */
export function ProductCard({ product }: ProductCardProps) {
  const { formatPrice } = useApp();
  const initials = product.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const rating = product.rating || null;

  return (
    <Link href={`/product?id=${encodeURIComponent(product.id)}`} className="product-card">
      {product.imageUrl ? (
        <div className="product-card__img-wrap">
          <img src={product.imageUrl} alt={product.imageAlt || product.name} loading="lazy" />
        </div>
      ) : (
        <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", borderRadius: 10, fontSize: "2rem", fontWeight: 700, color: "var(--border)", marginBottom: "0.75rem" }}>
          {initials}
        </div>
      )}
      <h3>{product.name}</h3>
      {rating && rating.count > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginBottom: "0.25rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--accent)" }}>{Array.from({ length: 5 }).map((_, i) => i < Math.round(rating.average) ? "★" : "☆").join("")}</span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>({rating.count})</span>
        </div>
      )}
      <div className="price" style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        {product.salePrice ? (
          <>
            <span style={{ textDecoration: "line-through", color: "var(--muted)", fontSize: "0.85em" }}>{formatPrice(product.price)}</span>
            <span style={{ color: "var(--danger)", fontWeight: 700 }}>{formatPrice(product.salePrice)}</span>
          </>
        ) : (
          formatPrice(product.price)
        )}
      </div>
      {product.salePrice && (
        <span style={{ display: "inline-block", background: "var(--danger)", color: "#fff", fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: 999, marginBottom: "0.5rem", textTransform: "uppercase" }}>
          Sale
        </span>
      )}
      <div className={`stock-badge ${product.inStock ? "in-stock" : "out-of-stock"}`}>
        {product.inStock ? "In stock" : "Enquire for availability"}
      </div>
    </Link>
  );
}

export async function getProducts(category?: string, group?: string, extras = true): Promise<Product[]> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (group) params.set("group", group);
  if (extras) params.set("withExtras", "1");
  const qs = params.toString();
  const url = qs ? `/api/products?${qs}` : "/api/products";
  const data = await api<{ products: Product[] }>(url);
  return data.products || [];
}