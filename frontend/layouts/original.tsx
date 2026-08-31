import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { formatPrice } from "./shared";
import { Pagination } from "@/components/ui";

type SortKey = "newest" | "price-asc" | "price-desc" | "name";

function effectivePrice(p: Product): number {
  return typeof p.salePrice === "number" ? p.salePrice : p.price;
}

export const LAYOUT_KEY = "original";
export const LAYOUT_LABEL = "Original";
export const LAYOUT_DESC = "The classic storefront with hero banner, category links, and product grid";

function hexToRgb(hex: string): [number, number, number] {
  let h = (hex || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (isNaN(n) || h.length !== 6) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function isDarkColor(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

export function LayoutStyles() {
  return <style>{`
    @keyframes heroFadeUp {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `}</style>;
}

function HeroStarRating({ average }: { average: number }) {
  return (
    <span style={{ color: "var(--accent)", fontSize: "0.8rem", letterSpacing: "1px" }} aria-label={`${average} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => i < Math.round(average) ? "★" : "☆").join("")}
    </span>
  );
}

function HeroSection({ products, hero }: { products: Product[]; hero?: any }) {
  const { isLoggedIn, userName, settings, isDark } = useApp();
  const [activeIdx, setActiveIdx] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [liveStats, setLiveStats] = useState<any>(null);
  const [ratings, setRatings] = useState<Record<string, { average: number; count: number }>>({});

  const featured = products.filter((p) => p.imageUrl).slice(0, 6);

  const heroBgLight = typeof hero?.heroBgLight === "string" ? hero.heroBgLight.trim() : "";
  const heroBgDark = typeof hero?.heroBgDark === "string" ? hero.heroBgDark.trim() : "";
  const customBg = (isDark ? heroBgDark || heroBgLight : heroBgLight || heroBgDark) || "";
  const bgIsDark = customBg ? isDarkColor(customBg) : isDark;
  const heroText = bgIsDark ? "#f4f1ec" : "#1c1917";
  const heroTextSec = bgIsDark ? "#a8a29b" : "#57534e";

  const heroStyle = customBg ? ({
    "--hero-bg": customBg,
    "--hero-text": heroText,
    "--hero-text-secondary": heroTextSec,
    "--hero-headline": heroText,
    "--hero-stat-value": heroText,
    "--hero-stat-label": heroTextSec,
    "--hero-product-name": heroText,
    "--hero-badge-color": bgIsDark ? "#fb923c" : "#c2410c",
    "--hero-badge-bg": bgIsDark ? "rgba(249, 115, 22, 0.1)" : "rgba(234, 88, 12, 0.08)",
    "--hero-badge-border": bgIsDark ? "rgba(249, 115, 22, 0.3)" : "rgba(234, 88, 12, 0.3)",
    "--hero-chip-bg": bgIsDark ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.65)",
    "--hero-chip-border": bgIsDark ? "rgba(255, 255, 255, 0.08)" : "rgba(28, 25, 23, 0.12)",
    "--hero-chip-hover-bg": bgIsDark ? "rgba(249, 115, 22, 0.15)" : "rgba(234, 88, 12, 0.1)",
    "--hero-chip-hover-border": bgIsDark ? "rgba(249, 115, 22, 0.35)" : "rgba(234, 88, 12, 0.4)",
    "--hero-chip-hover-text": bgIsDark ? "#fb923c" : "#c2410c",
    "--hero-img-bg": bgIsDark ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.5)",
    "--hero-img-border": bgIsDark ? "rgba(255, 255, 255, 0.06)" : "rgba(28, 25, 23, 0.08)",
    "--hero-dot-bg": bgIsDark ? "rgba(255, 255, 255, 0.25)" : "rgba(28, 25, 23, 0.25)",
    "--hero-dot-active": bgIsDark ? "#fb923c" : "#ea580c",
    "--hero-dot-hover": bgIsDark ? "rgba(255, 255, 255, 0.5)" : "rgba(28, 25, 23, 0.5)",
    "--hero-stat-bg": bgIsDark ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.65)",
    "--hero-stat-border": bgIsDark ? "rgba(255, 255, 255, 0.08)" : "rgba(28, 25, 23, 0.1)",
  } as React.CSSProperties) : undefined;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    fetch("/api/storefront-stats").then(r => r.json()).then(setLiveStats).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    products.filter((p) => p.imageUrl).slice(0, 6).forEach((p) => {
      api<{ rating: { average: number; count: number } }>(`/api/products/${encodeURIComponent(p.id)}/reviews`)
        .then((d) => { if (!cancelled && d.rating && d.rating.count > 0) setRatings((prev) => ({ ...prev, [p.id]: d.rating })); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [products]);

  const variants = hero?.headlineVariants?.length > 0 ? hero.headlineVariants : [];
  const variant = variants.length > 0 ? variants[0] : null;
  const headline = variant?.headline || hero?.headline || "Power Your";
  const headlineAccent = variant?.accent || hero?.headlineAccent || "Next Build";
  const subtitle = variant?.subtitle || hero?.subtitle || "Discover premium gaming PCs, laptops, graphics cards, servers, and accessories at unbeatable prices. Kenya\u2019s trusted all-in-one tech platform.";

  const badgeText = hero?.badgeText || "Summer Tech Sale \u2014 Up to 30% Off";
  const badgeActive = hero?.badgeActive !== false;
  const badgeLink = hero?.badgeLink || "";

  const shopNowLabel = hero?.shopNowLabel || "Shop Now";
  const shopNowLink = hero?.shopNowLink || "/pc";
  const browseLabel = hero?.browseLabel || "Browse Categories";
  const browseLink = hero?.browseLink || "/#categories";

  const showTrustStrip = hero?.showTrustStrip !== false;
  const showWhatsApp = hero?.showWhatsApp !== false;
  const waPhone = settings?.storePhone ? settings.storePhone.replace(/[^0-9]/g, "") : "";

  const liveCats: { id: string; label: string }[] = Array.isArray(liveStats?.categories) ? liveStats.categories : [];
  const savedChips: { label: string; href: string }[] = Array.isArray(hero?.catChips) && hero.catChips.length > 0 ? hero.catChips : [];

  const catChips = (() => {
    if (liveCats.length === 0) {
      return savedChips.length > 0 ? savedChips : [
        { label: "Gaming PCs", href: "/pc" },
        { label: "Graphics Cards", href: "/graphics-cards" },
        { label: "Laptops", href: "/laptops" },
        { label: "Servers", href: "/servers" },
        { label: "Repairs", href: "/repairs" },
      ];
    }
    if (savedChips.length === 0) {
      return liveCats.slice(0, 6).map((c) => ({ label: c.label, href: "/" + c.id }));
    }
    const liveByHref = new Map(liveCats.map((c) => ["/" + c.id, c.label]));
    const kept = savedChips.filter((c) => c.href && liveByHref.has(c.href));
    const existing = new Set(kept.map((c) => c.href));
    const added = liveCats
      .filter((c) => !existing.has("/" + c.id))
      .map((c) => ({ label: c.label, href: "/" + c.id }));
    return [...kept, ...added];
  })();

  const stats = hero?.stats?.length > 0
    ? hero.stats
    : liveStats
      ? [
          { value: String(liveStats.totalProducts) + "+", label: "Products" },
          { value: String(liveStats.totalCustomers) + "+", label: "Customers" },
          { value: String(liveStats.totalOrders) + "+", label: "Orders" },
        ]
      : [
          { value: "1000+", label: "Products" },
          { value: "500+", label: "Happy Customers" },
          { value: "24/7", label: "Support" },
        ];

  const highlights = hero?.highlights?.length > 0
    ? hero.highlights
    : [
        "Genuine Products",
        "Fast Delivery Across Kenya",
        "Secure Payments",
      ];

  const trustText = hero?.trustText || "Trusted by 5,000+ customers across Kenya";

  return (
    <section className="hero" style={heroStyle}>
      <div className="hero-inner">
        <div className="hero-content">
          {isLoggedIn && userName && (
            <div className="hero-greeting">
              Welcome back, {userName.split(/\s+/)[0]}
              <span>&mdash; we saved you some great deals</span>
            </div>
          )}

          {badgeActive && (
            badgeLink ? (
              <a href={badgeLink} className="hero-badge" style={{ textDecoration: "none" }}>
                <span className="hero-badge-dot" />
                <span>{badgeText}</span>
              </a>
            ) : (
              <span className="hero-badge">
                <span className="hero-badge-dot" />
                <span>{badgeText}</span>
              </span>
            )
          )}

          <h1 className="hero-headline">
            {headline} <span className="hero-headline-accent">{headlineAccent}</span>
          </h1>

          <p className="hero-sub">
            {subtitle}
          </p>

          <div className="hero-actions">
            <Link href={shopNowLink} className="btn btn-primary btn-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              {shopNowLabel}
            </Link>
            <Link href={browseLink} className="btn btn-secondary btn-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              {browseLabel}
            </Link>
            {showWhatsApp && waPhone && (
              <a
                href={`https://wa.me/${waPhone}?text=${encodeURIComponent("Hello! I'm interested in your products.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-lg hero-wa-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                Chat on WhatsApp
              </a>
            )}
          </div>

          <div className="hero-highlights">
            {highlights.map((h: string) => (
              <span key={h} className="hero-highlight">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {h}
              </span>
            ))}
          </div>

          {showTrustStrip && (
            <div className="hero-truststrip">
              <span className="hero-truststrip-item">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                M-Pesa &amp; Cards accepted
              </span>
              <span className="hero-truststrip-item">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                Nationwide delivery
              </span>
              <span className="hero-truststrip-item">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l7 4v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
                Warranty on all items
              </span>
              <span className="hero-truststrip-item">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Nairobi delivery in 24h
              </span>
            </div>
          )}

          <div className="hero-chips">
            {catChips.map((c: { label: string; href: string }) => (
              <Link key={c.href} href={c.href} className="hero-chip">{c.label}</Link>
            ))}
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-image-wrap">
            {featured.length > 0 ? (
              featured.map((p, i) => (
                <div
                  key={p.id}
                  className={`hero-product-slide${i === activeIdx ? " active" : ""}`}
                >
                  {p.salePrice && <span className="hero-sale-badge">Sale</span>}
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className={`hero-product-img${!prefersReducedMotion ? " hero-kenburns" : ""}`} />
                  ) : (
                    <div className="hero-product-placeholder">
                      {p.name.split(/\s+/).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                    </div>
                  )}
                  <div className="hero-product-info">
                    <span className="hero-product-name">{p.name}</span>
                    <span className="hero-product-price">
                      {p.salePrice ? (
                        <>
                          <span style={{ textDecoration: "line-through", opacity: 0.6, fontSize: "0.8em", marginRight: "0.35rem" }}>{formatPrice(p.price)}</span>
                          {formatPrice(p.salePrice)}
                        </>
                      ) : formatPrice(p.price)}
                    </span>
                    {ratings[p.id] && (
                      <span className="hero-rating">
                        <HeroStarRating average={ratings[p.id].average} />
                        <span>({ratings[p.id].count})</span>
                      </span>
                    )}
                    {p.inStock && typeof p.stockOnHand === "number" && p.stockOnHand <= 5 && (
                      <span className="hero-stocknote">Only {p.stockOnHand} left</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="hero-product-placeholder hero-product-placeholder--large">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.3}}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </div>
            )}
            {featured.length > 1 && (
              <div className="hero-dots">
                {featured.map((_, i) => (
                  <button
                    key={i}
                    className={`hero-dot${i === activeIdx ? " active" : ""}`}
                    onClick={() => setActiveIdx(i)}
                    aria-label={`Show product ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="hero-stats">
            {stats.map((s: { value: string; label: string }, i: number) => (
              <div
                key={s.label}
                className="hero-stat hero-stat-glass"
                style={{ animationDelay: `${i * 0.3}s` }}
              >
                <span className="hero-stat-value">{s.value}</span>
                <span className="hero-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hero-trust">
        <div className="hero-stars">
          {[0,1,2,3,4].map((i) => (
            <svg key={i} width="18" height="18" viewBox="0 0 24 24" style={{ fill: "var(--accent)", stroke: "var(--accent)" }} strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          ))}
        </div>
        <span className="hero-trust-text">{trustText}</span>
      </div>
    </section>
  );
}

export function Header() { return null; }
export function Footer() { return null; }

export function HomePage({ products, categories, hero }: {
  products: Product[]; categories: { id: string; label: string }[]; banners: any[]; hero?: any;
}) {
  const [homeSort, setHomeSort] = useState<SortKey>("newest");
  const [homePage, setHomePage] = useState(1);

  useEffect(() => {
    setHomePage(1);
  }, [homeSort]);

  const HOME_PAGE_SIZE = 20;
  const sortedProducts = [...products];
  if (homeSort === "price-asc") sortedProducts.sort((a, b) => effectivePrice(a) - effectivePrice(b));
  else if (homeSort === "price-desc") sortedProducts.sort((a, b) => effectivePrice(b) - effectivePrice(a));
  else if (homeSort === "name") sortedProducts.sort((a, b) => a.name.localeCompare(b.name));

  const homeTotalPages = Math.max(1, Math.ceil(sortedProducts.length / HOME_PAGE_SIZE));
  const safeHomePage = Math.min(homePage, homeTotalPages);
  const homeVisible = sortedProducts.slice((safeHomePage - 1) * HOME_PAGE_SIZE, safeHomePage * HOME_PAGE_SIZE);

  return (
    <>
      {hero?.heroActive !== false && <HeroSection products={products} hero={hero} />}

      {hero?.identityBandActive !== false && (
      <section className="identity-band" aria-label="Shop and repairs">
        <div className="identity-card identity-card--shop">
          <div className="identity-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>
          </div>
          <div>
            <h3>Shop premium tech</h3>
            <p>Gaming PCs, laptops, graphics cards, servers and printers with nationwide delivery.</p>
          </div>
          <Link href="/pc" className="btn btn-primary btn-sm">Shop now</Link>
        </div>
        <div className="identity-card identity-card--repair">
          <div className="identity-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          </div>
          <div>
            <h3>Need a repair?</h3>
            <p>Expert laptop, PC and device repairs with real-time tracking. Most repairs in 24-48h.</p>
          </div>
          <Link href="/repairs" className="btn btn-secondary btn-sm">Book a repair</Link>
        </div>
      </section>
      )}

      <div style={{ width: "100%", padding: "0 var(--space-5)" }}>
        {categories.length > 0 && (
          <div id="categories" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", margin: "1.5rem 0" }}>
            {categories.map((cat) => (
              <a key={cat.id} href={`/${cat.id}`} className="btn btn-secondary btn-sm" style={{ textAlign: "left", whiteSpace: "nowrap" }}>{cat.label}</a>
            ))}
          </div>
        )}

        <h2>All products</h2>
        {products.length === 0 ? (
          <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>No products found.</p>
        ) : (
          <>
            <div className="listing-toolbar">
              <span className="listing-count">{sortedProducts.length} product{sortedProducts.length === 1 ? "" : "s"}</span>
              <label className="listing-sort">
                Sort by
                <select
                  value={homeSort}
                  onChange={(e) => setHomeSort(e.target.value as SortKey)}
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
              {homeVisible.map((p) => {
                const initials = p.name.split(/\s+/).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
                return (
                  <Link key={p.id} href={`/product?id=${encodeURIComponent(p.id)}`} className="product-card">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.imageAlt || p.name} loading="lazy" />
                    ) : (
                      <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", borderRadius: 10, fontSize: "2rem", fontWeight: 700, color: "var(--border)", marginBottom: "0.75rem" }}>
                        {initials}
                      </div>
                    )}
                    <h3>{p.name}</h3>
                    <div className="price" style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      {p.salePrice ? (
                        <>
                          <span style={{ textDecoration: "line-through", color: "var(--muted)", fontSize: "0.8em" }}>{formatPrice(p.price)}</span>
                          <span style={{ color: "var(--danger)", fontWeight: 700 }}>{formatPrice(p.salePrice)}</span>
                          <span style={{ display: "inline-block", background: "var(--danger)", color: "#fff", fontSize: "0.6rem", fontWeight: 700, padding: "0.1rem 0.4rem", borderRadius: 999, textTransform: "uppercase" }}>Sale</span>
                        </>
                      ) : (
                        formatPrice(p.price)
                      )}
                    </div>
                    <div className={`stock-badge ${p.inStock ? "in-stock" : "out-of-stock"}`}>
                      {p.inStock ? "In stock" : "Enquire for availability"}
                    </div>
                  </Link>
                );
              })}
            </div>
            <Pagination page={safeHomePage} totalPages={homeTotalPages} onChange={setHomePage} label="All products pagination" />
          </>
        )}
      </div>
    </>
  );
}
