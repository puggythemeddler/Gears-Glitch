import React, { useEffect, useState } from "react";
import Head from "next/head";
import type { Product } from "@/lib/types";
import { getProducts } from "@/components/ProductCard";
import { useLayout, LayoutEngine } from "@/layouts";
import { useApp } from "@/lib/app-context";
import { useRouter } from "next/router";

const SITE = "Gear&Glitch";
const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://gearsandglitch.co.ke";

export default function HomePage() {
  const router = useRouter();
  const { search } = router.query;
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 24;
  const { banners } = useLayout();
  const { settings } = useApp();
  const siteName = settings?.storeName || SITE;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getProducts().then((p) => { if (!cancelled) setProducts(p); }),
      fetch("/api/categories").then((r) => r.json()).then((d) => { if (!cancelled) setCategories(d.categories || []); }),
    ]).catch(() => { if (!cancelled) setError("Failed to load products."); })
    .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const q = typeof search === "string" ? search.toLowerCase().trim() : "";
  useEffect(() => { setPage(1); }, [q]);

  const filtered = q ? products.filter((p) => {
    const name = p.name.toLowerCase();
    const category = p.category.toLowerCase();
    const subcategory = (p.subcategory || "").toLowerCase();
    const specText = (p.specs || []).map((s: any) => typeof s === "string" ? s : `${s.l || s.f || ""} ${s.v || ""}`).join(" ").toLowerCase();
    const desc = (p.description || "").toLowerCase();
    return q.split(/\s+/).every((term) => name.includes(term) || category.includes(term) || subcategory.includes(term) || specText.includes(term) || desc.includes(term));
  }) : products;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageProducts = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function goToPage(next: number) {
    setPage(Math.min(Math.max(1, next), totalPages));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) {
    return (
      <div style={{ width: "100%", padding: "var(--space-5)" }}>
        <div className="skeleton" style={{ height: 200, borderRadius: "var(--radius-xl)", marginBottom: "var(--space-6)" }} />
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
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "40vh", padding: "2rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem", opacity: 0.3 }}>⚠️</div>
        <p style={{ color: "var(--danger)", marginBottom: "1rem" }}>{error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{siteName} — Premium PCs, Laptops & Expert Repair in Kenya</title>
        <meta name="description" content="Kenya's all-in-one platform for premium PC hardware, laptops, graphics cards, servers, printers, and expert repair services. Shop now with nationwide delivery." />
        <link rel="canonical" href={BASE} />
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content={`${siteName} — Premium Tech Hardware & Repair in Kenya`} />
        <meta property="og:description" content="Buy PCs, laptops, graphics cards, servers, and printers in Kenya. Expert repair services with real-time tracking. Shop now." />
        <meta property="og:url" content={BASE} />
        <meta property="og:type" content="website" />
      </Head>
      {q && (
        <div style={{ marginBottom: "1rem" }}>
          <p style={{ color: "var(--text-secondary)" }}>
            Search results for "<strong>{search}</strong>" ({filtered.length} found)
            &nbsp;<a href="/" style={{ color: "var(--primary)", textDecoration: "underline", fontSize: "0.85rem" }}>Clear</a>
          </p>
        </div>
      )}
      <LayoutEngine
        page="home"
        products={pageProducts}
        categories={categories}
        banners={banners}
        settings={settings}
      />
      {totalPages > 1 && (
        <nav className="pagination" aria-label="Pagination" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem", margin: "2rem 0", flexWrap: "wrap" }}>
          <button className="btn btn-sm btn-ghost" onClick={() => goToPage(safePage - 1)} disabled={safePage <= 1} aria-label="Previous page">&larr; Previous</button>
          {Array.from({ length: totalPages }).map((_, i) => {
            const n = i + 1;
            const show = totalPages <= 7 || n === 1 || n === totalPages || Math.abs(n - safePage) <= 1;
            if (!show) return <span key={n} style={{ color: "var(--text-tertiary)" }}>…</span>;
            return (
              <button
                key={n}
                className={`btn btn-sm ${n === safePage ? "btn-primary" : "btn-ghost"}`}
                onClick={() => goToPage(n)}
                aria-current={n === safePage ? "page" : undefined}
              >
                {n}
              </button>
            );
          })}
          <button className="btn btn-sm btn-ghost" onClick={() => goToPage(safePage + 1)} disabled={safePage >= totalPages} aria-label="Next page">Next &rarr;</button>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", width: "100%", textAlign: "center" }}>
            Page {safePage} of {totalPages} &middot; {filtered.length} product{filtered.length !== 1 ? "s" : ""}
          </span>
        </nav>
      )}
    </>
  );
}
