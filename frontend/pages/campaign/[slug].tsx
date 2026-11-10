import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { ProductCard } from "@/components/ProductCard";
import { Media } from "@/components/Media";
import type { Product } from "@/lib/types";
import { useApp } from "@/lib/app-context";
import { EmptyState, ErrorState, Pagination } from "@/components/ui";

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

export default function CampaignPage() {
  const { settings } = useApp();
  const router = useRouter();
  const { slug } = router.query;
  const [campaign, setCampaign] = useState<any | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const sortValue = Array.isArray(router.query.sort) ? router.query.sort[0] : router.query.sort;
  const sort: SortKey = isSortKey(sortValue) ? sortValue : "featured";
  const page = listingPage(router.query.page);
  const campaignSlug = Array.isArray(slug) ? slug[0] : slug;

  useEffect(() => {
    if (!router.isReady || !campaignSlug) return;
    // Stamped so /api/orders can attribute the checkout to this campaign
    // (buyer visited the landing page). Keyed by slug; server re-validates the
    // campaign exists and is active before stamping orders.campaign_id.
    try {
      document.cookie = `gg_campaign=${encodeURIComponent(campaignSlug.toLowerCase())}; path=/; max-age=${30 * 86400}; SameSite=Lax`;
    } catch {}
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/campaigns/${encodeURIComponent(campaignSlug.toLowerCase())}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Campaign not found." : "Failed to load campaign.");
        return r.json();
      })
      .then((d) => { if (!cancelled) { setCampaign(d.campaign); setProducts(d.products || []); } })
      .catch((e) => { if (!cancelled) setError(e.message || "Failed to load campaign."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [router.isReady, campaignSlug]);

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
  const visibleProducts = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const heroBg = campaign?.banner_color || "#111827";
  const heroImg = campaign?.hero_image || "";

  return (
    <>
      <Head>
        <title>{campaign?.title || "Campaign"} — {settings?.storeName || "Store"}</title>
        {campaign?.description ? <meta name="description" content={campaign.description} /> : null}
      </Head>
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
        <ErrorState title="Couldn’t load this campaign" message={error} onRetry={() => window.location.reload()} />
      ) : campaign ? (
        <>
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <ol>
              <li><a href="/">Home</a></li>
              <li><span aria-current="page">{campaign.title}</span></li>
            </ol>
          </nav>
          <div className="card" style={{ background: `linear-gradient(135deg, ${heroBg}, ${heroBg}dd)`, color: "#fff", marginBottom: "1.5rem", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap", padding: "1.5rem" }}>
              {heroImg && (
                <Media src={heroImg} alt={campaign.title} width={220} height={140} fit="cover" loading="eager" fallbackLabel="campaign hero" className="campaign-hero__img" style={{ width: 220, maxHeight: 140, objectFit: "cover", borderRadius: "var(--radius-lg)", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 240 }}>
                <h1 style={{ margin: 0, color: "#fff" }}>{campaign.title}</h1>
                {campaign.subtitle && <p style={{ margin: "0.5rem 0 0", fontSize: "1.1rem", opacity: 0.9 }}>{campaign.subtitle}</p>}
                {campaign.description && <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", opacity: 0.85 }}>{campaign.description}</p>}
              </div>
            </div>
          </div>
          {products.length === 0 ? (
            <EmptyState icon="products" title="No products in this campaign yet" actionLabel="Browse all products" onAction={() => { window.location.href = "/"; }} />
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
                    aria-label="Sort campaign products"
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
                {visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
              <Pagination
                page={safePage}
                totalPages={totalPages}
                onChange={(nextPage) => updateListingQuery(nextPage > 1 ? { page: String(nextPage) } : {}, nextPage > 1 ? [] : ["page"])}
                label={`${campaign.title} pagination`}
              />
            </>
          )}
        </>
      ) : null}
    </>
  );
}
