import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { ProductCard, getProducts } from "@/components/ProductCard";
import type { Product } from "@/lib/types";
import { Pagination, EmptyState, ErrorState } from "@/components/ui";

const PAGE_SIZE = 20;

type SortKey = "newest" | "price-asc" | "price-desc" | "name";

function effectivePrice(p: Product): number {
  return typeof p.salePrice === "number" ? p.salePrice : p.price;
}

export default function CategoryPage() {
  const router = useRouter();
  const { category, subcategory } = router.query;
  const [products, setProducts] = useState<Product[]>([]);
  const [catName, setCatName] = useState("");
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);

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

  useEffect(() => {
    setPage(1);
  }, [category, subcategory, sort]);

  const filtered = subcategory
    ? products.filter((p) => (p as any).subcategory === subcategory || (p as any).subcategory_id === subcategory)
    : products;

  const sorted = [...filtered];
  if (sort === "price-asc") sorted.sort((a, b) => effectivePrice(a) - effectivePrice(b));
  else if (sort === "price-desc") sorted.sort((a, b) => effectivePrice(b) - effectivePrice(a));
  else if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const title = catName || (category ? String(category) : "Products");

  return (
    <>
      <Head><title>{title}</title></Head>
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
        <ErrorState title="Something went wrong" message={error} onRetry={() => window.location.reload()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="products"
          title="No products found"
          description={`No products in this category${subcategory ? " for selected subcategory" : ""}.`}
          actionLabel="Browse all products"
          onAction={() => { window.location.href = "/"; }}
        />
      ) : (
        <>
          <div className="listing-toolbar">
            <span className="listing-count">{sorted.length} product{sorted.length === 1 ? "" : "s"}</span>
            <label className="listing-sort">
              Sort by
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="filter-select"
                aria-label="Sort products"
              >
                <option value="newest">Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name">Name A-Z</option>
              </select>
            </label>
          </div>
          <div className="product-grid">
            {visible.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} label={`${title} pagination`} />
        </>
      )}
    </>
  );
}