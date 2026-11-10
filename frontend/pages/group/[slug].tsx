import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ProductCard, getProducts } from "@/components/ProductCard";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import { EmptyState, ErrorState, PageHead, Pagination } from "@/components/ui";

const PAGE_SIZE = 20;
type SortKey = "featured" | "newest" | "price-asc" | "price-desc" | "name";

function isSortKey(value: unknown): value is SortKey {
  return value === "featured" || value === "newest" || value === "price-asc" || value === "price-desc" || value === "name";
}

function listingPage(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return 1;
  return Math.max(1, Number(raw));
}

function effectivePrice(product: Product): number {
  return typeof product.salePrice === "number" ? product.salePrice : product.price;
}

export default function GroupPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [products, setProducts] = useState<Product[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const sortValue = Array.isArray(router.query.sort) ? router.query.sort[0] : router.query.sort;
  const sort: SortKey = isSortKey(sortValue) ? sortValue : "featured";
  const page = listingPage(router.query.page);
  const groupId = Array.isArray(slug) ? slug[0] : slug;

  useEffect(() => {
    if (!router.isReady || !groupId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setGroupName("");
    Promise.all([
      getProducts(undefined, groupId).then((p) => { if (!cancelled) setProducts(p); }),
      api<{ groups: any[] }>("/api/groups").then((d) => {
        const g = (d.groups || []).find((x: any) => x.id === groupId);
        if (g && !cancelled) setGroupName(g.name);
      }).catch(() => {}),
    ]).catch(() => { if (!cancelled) setError("Failed to load products."); })
    .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [router.isReady, groupId]);

  function updateListingQuery(updates: Partial<Record<"sort" | "page", string>>, remove: Array<"sort" | "page"> = []) {
    const query = { ...router.query, ...updates };
    for (const key of remove) delete query[key];
    void router.push({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false });
  }

  const sorted = [...products];
  if (sort === "newest") sorted.sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0));
  else if (sort === "price-asc") sorted.sort((a, b) => effectivePrice(a) - effectivePrice(b));
  else if (sort === "price-desc") sorted.sort((a, b) => effectivePrice(b) - effectivePrice(a));
  else if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const fallbackTitle = groupId
    ? groupId.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
    : "Products";
  const title = groupName || fallbackTitle;

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
        <ErrorState title="Couldn’t load this group" message={error} onRetry={() => window.location.reload()} />
      ) : products.length === 0 ? (
        <EmptyState icon="products" title="No products found" description="No products in this group." actionLabel="Browse all products" onAction={() => { window.location.href = "/"; }} />
      ) : (
        <>
          <div className="listing-toolbar">
            <span className="listing-count" role="status" aria-live="polite">{sorted.length} product{sorted.length === 1 ? "" : "s"}</span>
            <label className="listing-sort">
              Sort by
              <select
                value={sort}
                onChange={(event) => {
                  const nextSort = event.target.value as SortKey;
                  updateListingQuery(nextSort === "featured" ? {} : { sort: nextSort }, ["page", ...(nextSort === "featured" ? ["sort" as const] : [])]);
                }}
                className="filter-select"
                aria-label="Sort products"
              >
                <option value="featured">Featured</option>
                <option value="newest">Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name">Name A-Z</option>
              </select>
            </label>
          </div>
          <div className="product-grid">
            {visible.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
          <Pagination
            page={safePage}
            totalPages={totalPages}
            onChange={(nextPage) => updateListingQuery(nextPage > 1 ? { page: String(nextPage) } : {}, nextPage > 1 ? [] : ["page"])}
            label={`${title} pagination`}
          />
        </>
      )}
    </>
  );
}
