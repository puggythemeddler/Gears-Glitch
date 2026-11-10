import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { ProductCard, getProducts } from "@/components/ProductCard";
import type { Product } from "@/lib/types";
import { Pagination, EmptyState, ErrorState } from "@/components/ui";
import { getStorefrontCategories, getStorefrontGroups } from "@/lib/storefront-data";

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
  const sortValue = Array.isArray(router.query.sort) ? router.query.sort[0] : router.query.sort;
  const sort: SortKey = isSortKey(sortValue) ? sortValue : "featured";
  const page = listingPage(router.query.page);
  const categoryId = Array.isArray(category) ? category[0] : category;

  useEffect(() => {
    if (!router.isReady || !categoryId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setCatName("");
    setSubcategories([]);

    // Some legacy storefront links (for example /laptops) use a product-group
    // slug even though they are not category IDs. Prefer a real category when
    // both exist, then fall back to a matching group before showing an empty page.
    getStorefrontCategories()
      .then(async (data) => {
        const category = data.categories.find((item) => item.id === categoryId);
        if (category) {
          if (!cancelled) {
            setCatName(category.label);
            setSubcategories(data.subcategories.filter((item) => Array.isArray(item.category_ids) && item.category_ids.includes(categoryId)));
          }
          return getProducts(categoryId);
        }

        const groups = await getStorefrontGroups();
        const group = groups.find((item) => item.isActive && item.id === categoryId);
        if (group) {
          if (!cancelled) setCatName(group.name);
          return getProducts(undefined, group.id);
        }

        return getProducts(categoryId);
      })
      .catch(() => getProducts(categoryId))
      .then((items) => { if (!cancelled) setProducts(items); })
      .catch(() => { if (!cancelled) setError("Failed to load products."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [router.isReady, categoryId]);

  function updateListingQuery(updates: Partial<Record<"sort" | "page", string>>, remove: Array<"sort" | "page"> = []) {
    const query = { ...router.query, ...updates };
    for (const key of remove) delete query[key];
    void router.push({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false });
  }

  const filtered = subcategory
    ? products.filter((p) => (p as any).subcategory === subcategory || (p as any).subcategory_id === subcategory)
    : products;

  const sorted = [...filtered];
  if (sort === "newest") sorted.sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0));
  else if (sort === "price-asc") sorted.sort((a, b) => effectivePrice(a) - effectivePrice(b));
  else if (sort === "price-desc") sorted.sort((a, b) => effectivePrice(b) - effectivePrice(a));
  else if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const title = catName || (category
    ? String(category).split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
    : "Products");

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
          <a href={`/${category}${sort !== "featured" ? `?sort=${encodeURIComponent(sort)}` : ""}`} aria-current={!subcategory ? "page" : undefined} className={`btn btn-sm ${!subcategory ? "btn-primary" : "btn-secondary"}`}>All</a>
          {subcategories.map((s: any) => (
            <a key={s.id} href={`/${category}?subcategory=${encodeURIComponent(s.id)}${sort !== "featured" ? `&sort=${encodeURIComponent(sort)}` : ""}`} aria-current={subcategory === s.id ? "page" : undefined} className={`btn btn-sm ${subcategory === s.id ? "btn-primary" : "btn-secondary"}`}>{s.name}</a>
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
            <span className="listing-count" role="status" aria-live="polite">{sorted.length} product{sorted.length === 1 ? "" : "s"}</span>
            <label className="listing-sort">
              Sort by
              <select
                value={sort}
                onChange={(e) => {
                  const nextSort = e.target.value as SortKey;
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
            {visible.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
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
