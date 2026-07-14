import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ProductCard, getProducts } from "@/components/ProductCard";
import type { Product } from "@/lib/types";

export default function CategoryPage() {
  const router = useRouter();
  const { category, subcategory } = router.query;
  const [products, setProducts] = useState<Product[]>([]);
  const [catName, setCatName] = useState("");
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!category) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      getProducts(category as string).then((p) => { if (!cancelled) setProducts(p); }),
      fetch("/api/categories").then((r) => r.json()).then((d) => {
        if (!cancelled) {
          const c = (d.categories || []).find((x: any) => x.id === category);
          if (c) setCatName(c.label);
          const subs = (d.subcategories || []).filter((s: any) => Array.isArray(s.category_ids) && s.category_ids.includes(category));
          setSubcategories(subs);
        }
      }),
    ]).catch(() => { if (!cancelled) setError("Failed to load products."); })
    .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [category]);

  const filtered = subcategory
    ? products.filter((p) => (p as any).subcategory === subcategory || (p as any).subcategory_id === subcategory)
    : products;

  const title = catName || (category ? String(category) : "Products");

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><span aria-current="page">{title}</span></li>
        </ol>
      </nav>
      <h1>{title}</h1>
      {subcategories.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <a href={`/${category}`} className={`btn btn-sm ${!subcategory ? "btn-primary" : "btn-secondary"}`}>All</a>
          {subcategories.map((s: any) => (
            <a key={s.id} href={`/${category}?subcategory=${encodeURIComponent(s.id)}`} className={`btn btn-sm ${subcategory === s.id ? "btn-primary" : "btn-secondary"}`}>{s.name}</a>
          ))}
        </div>
      )}
      {loading ? (
        <div className="product-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="product-card">
              <div className="skeleton" style={{ height: 180, borderRadius: "var(--radius-lg)", marginBottom: "var(--space-3)" }} />
              <div className="skeleton" style={{ height: "1rem", width: "70%", marginBottom: "var(--space-2)" }} />
              <div className="skeleton" style={{ height: "1.25rem", width: "40%", marginBottom: "var(--space-2)" }} />
              <div className="skeleton" style={{ height: "0.75rem", width: "50%" }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "30vh", gap: "1rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", opacity: 0.3 }}>⚠️</div>
          <p style={{ color: "var(--danger)" }}>{error}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <div className="empty-state-title">No products found</div>
          <div className="empty-state-desc">No products in this category{subcategory ? " for selected subcategory" : ""}.</div>
          <a href="/" className="btn btn-primary">Browse all products</a>
        </div>
      ) : (
        <div className="product-grid">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </>
  );
}
