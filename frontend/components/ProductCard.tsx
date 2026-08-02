import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import type { Product, ProductImage } from "@/lib/types";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { formatPrice } = useApp();
  const initials = product.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const [gallery, setGallery] = useState<ProductImage[]>([]);
  const [hoverIdx, setHoverIdx] = useState(0);
  const [rating, setRating] = useState<{ average: number; count: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api<{ images: ProductImage[]; rating: { average: number; count: number } }>(`/api/products/${encodeURIComponent(product.id)}/extras`).then((d) => {
      if (d.images && d.images.length > 1) setGallery(d.images);
      if (d.rating && d.rating.count > 0) setRating(d.rating);
    }).catch(() => {});
  }, [product.id]);

  function startScroll() {
    if (gallery.length <= 1) return;
    setHoverIdx(0);
    intervalRef.current = setInterval(() => {
      setHoverIdx((prev) => (prev + 1) % gallery.length);
    }, 800);
  }

  function stopScroll() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setHoverIdx(0);
  }

  const images = gallery.length > 1 ? gallery : [];
  const displayImage = images.length > 0 ? images[hoverIdx]?.imageUrl : product.imageUrl;

  return (
    <Link
      href={`/product?id=${encodeURIComponent(product.id)}`}
      className="product-card"
      onMouseEnter={startScroll}
      onMouseLeave={stopScroll}
    >
      {displayImage ? (
        <div className="product-card__img-wrap">
          <img src={displayImage} alt={product.imageAlt || product.name} loading="lazy" />
          {images.length > 1 && (
            <div className="product-card__dots">
              {images.map((_, i) => (
                <span key={i} className={`product-card__dot ${i === hoverIdx ? "active" : ""}`} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", borderRadius: 10, fontSize: "2rem", fontWeight: 700, color: "var(--border)", marginBottom: "0.75rem" }}>
          {initials}
        </div>
      )}
      <h3>{product.name}</h3>
      {rating && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginBottom: "0.25rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--accent)" }}>{Array.from({ length: 5 }).map((_, i) => i < Math.round(rating.average) ? "★" : "☆").join("")}</span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>({rating.count})</span>
        </div>
      )}
      <div className="price" style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        {product.salePrice ? (
          <>
            <span style={{ textDecoration: "line-through", color: "var(--muted, #999)", fontSize: "0.85em" }}>{formatPrice(product.price)}</span>
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

export async function getProducts(category?: string, group?: string): Promise<Product[]> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (group) params.set("group", group);
  const qs = params.toString();
  const url = qs ? `/api/products?${qs}` : "/api/products";
  const data = await api<{ products: Product[] }>(url);
  return data.products || [];
}
