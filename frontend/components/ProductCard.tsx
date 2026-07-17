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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api<{ images: ProductImage[] }>(`/api/products/${encodeURIComponent(product.id)}/images`).then((d) => {
      if (d.images && d.images.length > 1) setGallery(d.images);
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
      <div className="price">{formatPrice(product.price)}</div>
      <div className={`stock-badge ${product.inStock ? "in-stock" : "out-of-stock"}`}>
        {product.inStock ? "In stock" : "Enquire for availability"}
      </div>
    </Link>
  );
}

export async function getProducts(category?: string): Promise<Product[]> {
  const url = category ? `/api/products?category=${encodeURIComponent(category)}` : "/api/products";
  const data = await api<{ products: Product[] }>(url);
  return data.products || [];
}
