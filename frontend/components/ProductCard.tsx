import React from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { formatPrice } = useApp();
  const initials = product.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <Link href={`/product?id=${encodeURIComponent(product.id)}`} className="product-card">
      {product.imageUrl ? (
        <img src={product.imageUrl} alt={product.imageAlt || product.name} loading="lazy" />
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
