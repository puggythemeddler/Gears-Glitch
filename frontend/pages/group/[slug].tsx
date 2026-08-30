import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ProductCard, getProducts } from "@/components/ProductCard";
import Icon from "@/components/icons";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import { PageHead } from "@/components/ui";

export default function GroupPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [products, setProducts] = useState<Product[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const id = Array.isArray(slug) ? slug[0] : slug;
    Promise.all([
      getProducts(undefined, id).then((p) => { if (!cancelled) setProducts(p); }),
      api<{ groups: any[] }>("/api/groups").then((d) => {
        const g = (d.groups || []).find((x: any) => x.id === id);
        if (g && !cancelled) setGroupName(g.name);
      }).catch(() => {}),
    ]).catch(() => { if (!cancelled) setError("Failed to load products."); })
    .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  const title = groupName || "Group";

  return (
    <>
      <PageHead title={`${title} - Gear&Glitch`} />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><a href="/groups">Groups</a></li>
          <li><span aria-current="page">{title}</span></li>
        </ol>
      </nav>
      <h1>{title}</h1>
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
      ) : products.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="box" size={22} /></div>
          <div className="empty-state-title">No products found</div>
          <div className="empty-state-desc">No products in this group.</div>
          <a href="/" className="btn btn-primary">Browse all products</a>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </>
  );
}
