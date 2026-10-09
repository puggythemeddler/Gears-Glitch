import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { formatPrice } from "./shared";
import { Media } from "@/components/Media";
import { Pagination } from "@/components/ui";
import { ProductCard } from "@/components/ProductCard";
import { normalizeHref } from "@/lib/links";

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

const ChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
);
const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);

function HeroSection({ products, hero }: { products: Product[]; hero?: any }) {
  const { isLoggedIn, userName, settings, isDark } = useApp();
  const [activeIdx, setActiveIdx] = useState(0);

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
  } as React.CSSProperties) : undefined;

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

  const showWhatsApp = hero?.showWhatsApp !== false;
  const waPhone = settings?.storePhone ? settings.storePhone.replace(/[^0-9]/g, "") : "";

  const panel = featured.length > 0 ? featured[activeIdx % featured.length] : null;
  const cycle = (dir: number) => {
    if (featured.length < 2) return;
    setActiveIdx((activeIdx + dir + featured.length) % featured.length);
  };

  return (
    <section className="dy-hero" style={heroStyle} aria-label="Featured products">
      <div className="dy-hero-inner">
        <div>
          {isLoggedIn && userName && (
            <p className="dy-hero-greeting">
              Welcome back, {userName.split(/\s+/)[0]}
              <span>&mdash; we saved you some great deals</span>
            </p>
          )}

          {badgeActive && (
            badgeLink ? (
              <a href={badgeLink} className="dy-hero-badge" style={{ textDecoration: "none" }}>
                <span className="hero-badge-dot" />
                <span>{badgeText}</span>
              </a>
            ) : (
              <span className="dy-hero-badge">
                <span className="hero-badge-dot" />
                <span>{badgeText}</span>
              </span>
            )
          )}

          <h1 className="dy-hero-headline">
            {headline} <span style={{ color: "var(--primary)" }}>{headlineAccent}</span>
          </h1>

          <p className="dy-hero-sub">{subtitle}</p>

          <div className="dy-hero-cta-row">
            <Link href={shopNowLink} className="dy-hero-btn dy-hero-btn--primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              {shopNowLabel}
            </Link>
            <Link href={browseLink} className="dy-hero-btn dy-hero-btn--secondary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              {browseLabel}
            </Link>
            {showWhatsApp && waPhone && (
              <a
                href={normalizeHref(`https://wa.me/${waPhone}?text=${encodeURIComponent("Hello! I'm interested in your products.")}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="dy-hero-btn dy-hero-btn--secondary"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                Chat on WhatsApp
              </a>
            )}
          </div>
        </div>

        <div className="dy-hero-showcase">
          {panel ? (
            <Link href={`/product?id=${encodeURIComponent(panel.id)}`} className="dy-hero-panel" style={{ textDecoration: "none", color: "var(--text)" }} aria-label={`View ${panel.name} (featured product ${activeIdx + 1} of ${featured.length})`}>
              <span className="dy-hero-panel-tag">Featured pick</span>
              <div className="dy-hero-panel-media">
                {panel.imageUrl ? (
                  <Media src={panel.imageUrl} alt={panel.name} width={640} height={360} fit="cover" fallbackLabel={panel.name} />
                ) : (
                  <span style={{ color: "var(--text-tertiary)", fontSize: "0.9rem", textAlign: "center" }}>
                    {panel.name.split(/\s+/).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                  </span>
                )}
              </div>
              <div className="dy-hero-panel-foot">
                <div style={{ minWidth: 0 }}>
                  <span className="dy-hero-panel-name">{panel.name}</span>
                  {panel.rating && panel.rating.count > 0 && (
                    <div className="dy-hero-panel-meta">
                      <HeroStarRating average={panel.rating.average} />
                      <span>({panel.rating.count})</span>
                      {panel.inStock && typeof panel.stockOnHand === "number" && panel.stockOnHand <= 5 && (
                        <span>Only {panel.stockOnHand} left</span>
                      )}
                    </div>
                  )}
                </div>
                <span className="dy-hero-panel-price">
                  {panel.salePrice ? (
                    <>
                      <span style={{ textDecoration: "line-through", opacity: 0.6, fontSize: "0.8em", marginRight: "0.35rem" }}>{formatPrice(panel.price)}</span>
                      <span style={{ color: "var(--primary)" }}>{formatPrice(panel.salePrice)}</span>
                    </>
                  ) : formatPrice(panel.price)}
                </span>
              </div>
            </Link>
          ) : (
            <div className="dy-hero-panel">
              <div className="dy-hero-panel-media">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="22"/></svg>
              </div>
            </div>
          )}
          {featured.length > 1 && (
            <div className="dy-hero-carousel">
              <span className="dy-hero-counter" aria-live="polite">{activeIdx + 1} / {featured.length}</span>
              <div className="dy-hero-carousel-btns">
                <button
                  type="button"
                  className="dy-hero-carousel-btn"
                  onClick={() => cycle(-1)}
                  aria-label="Previous featured product"
                >
                  <ChevronLeft />
                </button>
                <button
                  type="button"
                  className="dy-hero-carousel-btn"
                  onClick={() => cycle(1)}
                  aria-label="Next featured product"
                >
                  <ChevronRight />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// Real social proof + service guarantees. The public /api/storefront-stats
// endpoint only returns customer/order totals when the owner opted in, so any
// number shown here is real — there is no fabricated "1000+ customers" fallback.
function GuaranteeStrip({ hero }: { hero?: any }) {
  const [liveStats, setLiveStats] = useState<any>(null);

  useEffect(() => {
    fetch("/api/storefront-stats").then(r => r.json()).then(setLiveStats).catch(() => {});
  }, []);

  const showTrustStrip = hero?.showTrustStrip !== false;

  // Deliberate guarantee set. Every store can truthfully display these four, so
  // they are the defaults; the owner's own hero config is used when set and any
  // empty slots are back-filled from this list (never more than four, never an
  // invented claim).
  const DEFAULT_GUARANTEES = ["Genuine Products", "Fast Delivery", "Secure Payments", "Warranty Included"];
  const configured = (hero?.highlights?.length > 0 ? hero.highlights : [])
    .map((h: any) => String(h).trim())
    .filter(Boolean);
  const merged = [...configured];
  for (const g of DEFAULT_GUARANTEES) {
    if (merged.length >= 4) break;
    if (!merged.includes(g)) merged.push(g);
  }
  const items = merged.slice(0, 4);

  const hasTotals = liveStats && (liveStats.totalCustomers != null || liveStats.totalOrders != null);
  const totalsLine = hasTotals
    ? [
        ...(liveStats.totalCustomers != null ? [`${liveStats.totalCustomers}+ customers`] : []),
        ...(liveStats.totalOrders != null ? [`${liveStats.totalOrders}+ orders shipped`] : []),
      ].join(" \u00b7 ")
    : "";

  if (items.length === 0 && !totalsLine) return null;

  return (
    <section className="storefront-guarantees" aria-label="Why shop with us">
      <div className="storefront-guarantees-inner">
        {items.map((h) => (
          <span key={h} className="storefront-guarantee">
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2.5 7.2l3.2 3.2 5.8-6.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {h}
          </span>
        ))}
        {totalsLine && <span className="storefront-guarantee-grow"><span>Trusted by {totalsLine}</span></span>}
      </div>
    </section>
  );
}

function ShopCategories({ categories, products, chips }: {
  categories: { id: string; label: string }[];
  products: Product[];
  chips: { label: string; href: string }[];
}) {
  if (categories.length === 0) return null;

  return (
    <section className="storefront-cats" id="categories" aria-label="Shop by category">
      <div className="storefront-section-head">
        <div>
          <h2>Shop by category</h2>
          <p>Everything we carry — from everyday laptops to full workstation builds.</p>
        </div>
        <a href="#catalogue" className="storefront-section-link">All products <ChevronRight /></a>
      </div>
      <div className="storefront-cats-grid">
        {categories.map((cat) => {
          const count = products.filter((p) => p.category === cat.id).length;
          return (
            <Link key={cat.id} href={`/${cat.id}`} className="storefront-cat-card">
              <span className="storefront-cat-main">
                <span className="storefront-cat-label">{cat.label}</span>
                <span className="storefront-cat-count">
                  {count === 0 ? "Browse products" : `${count} product${count === 1 ? "" : "s"}`}
                </span>
              </span>
              <span className="storefront-cat-arrow"><ChevronRight /></span>
            </Link>
          );
        })}
      </div>
      {chips.length > 0 && (
        <div className="storefront-quicklinks" aria-label="Quick links">
          <span className="storefront-quicklinks-label">Quick links</span>
          {chips.map((c) => (
            <Link key={c.href} href={normalizeHref(c.href) || "/"} className="storefront-quicklink">{c.label}</Link>
          ))}
        </div>
      )}
    </section>
  );
}

function FeaturedProducts({ featured }: { featured: Product[] }) {
  if (featured.length === 0) return null;

  return (
    <section className="storefront-featured" aria-label="Featured products">
      <div className="storefront-section-head">
        <div>
          <h2>Featured products</h2>
          <p>Hand-picked stock, ready to ship to your door.</p>
        </div>
        <a href="#catalogue" className="storefront-section-link">View all <ChevronRight /></a>
      </div>
      <div className="product-grid">
        {featured.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

function NewsletterSection() {
  const { settings } = useApp();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value || status === "busy") return;
    setStatus("busy");
    setMessage("");
    try {
      await api("/api/newsletter/subscribe", { method: "POST", body: JSON.stringify({ email: value }) });
      setStatus("done");
      setMessage(`You're on the list — watch your inbox for the next drop from ${settings?.storeName || "the store"}.`);
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message || "Could not subscribe right now. Please try again.");
    }
  }

  return (
    <section className="storefront-newsletter" aria-label="Newsletter">
      <div className="storefront-newsletter-inner">
        <div className="storefront-newsletter-copy">
          <h2>Drop us your email</h2>
          <p>New hardware drops, exclusive deals and restock alerts — straight to your inbox.</p>
        </div>
        {status === "done" ? (
          <p className="storefront-newsletter-done" role="status">{message}</p>
        ) : (
          <form className="storefront-newsletter-form" onSubmit={subscribe}>
            <label htmlFor="gg-newsletter-email" className="visually-hidden">Email address</label>
            <input
              id="gg-newsletter-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (status !== "idle") { setStatus("idle"); setMessage(""); } }}
              aria-describedby={status === "error" ? "gg-newsletter-status" : undefined}
            />
            <button type="submit" className="btn btn-primary" disabled={status === "busy"}>
              {status === "busy" ? "Subscribing..." : "Subscribe"}
            </button>
          </form>
        )}
        <p id="gg-newsletter-status" className={`storefront-newsletter-status ${status === "error" ? "is-error" : ""}`} aria-live="polite" role={status === "error" ? "alert" : "status"}>
          {status === "error" ? message : ""}
        </p>
      </div>
    </section>
  );
}

export function Header() { return null; }
export function Footer() { return null; }

export function HomePage({ products, categories, banners, hero, allProducts }: {
  products: Product[]; categories: { id: string; label: string }[]; banners: any[]; hero?: any; allProducts?: Product[];
}) {
  const [homeSort, setHomeSort] = useState<SortKey>("newest");
  const [homePage, setHomePage] = useState(1);

  useEffect(() => {
    setHomePage(1);
  }, [homeSort]);

  const HOME_PAGE_SIZE = 20;
  // Category counts always reflect the full catalogue (allProducts), not the
  // search-filtered product set the grid below shows — a search for "laptop"
  // must never shrink "Graphics Cards: 14" to a count of matching items.
  const catalogueProducts = allProducts && allProducts.length > 0 ? allProducts : products;
  const sortedProducts = [...products];
  if (homeSort === "price-asc") sortedProducts.sort((a, b) => effectivePrice(a) - effectivePrice(b));
  else if (homeSort === "price-desc") sortedProducts.sort((a, b) => effectivePrice(b) - effectivePrice(a));
  else if (homeSort === "name") sortedProducts.sort((a, b) => a.name.localeCompare(b.name));

  const homeTotalPages = Math.max(1, Math.ceil(sortedProducts.length / HOME_PAGE_SIZE));
  const safeHomePage = Math.min(homePage, homeTotalPages);
  const homeVisible = sortedProducts.slice((safeHomePage - 1) * HOME_PAGE_SIZE, safeHomePage * HOME_PAGE_SIZE);

  const featuredPicks = [...products]
    .sort((a, b) => {
      const sa = a.salePrice ? 1 : 0, sb = b.salePrice ? 1 : 0;
      if (sb !== sa) return sb - sa;
      const ia = a.imageUrl ? 1 : 0, ib = b.imageUrl ? 1 : 0;
      if (ib !== ia) return ib - ia;
      return 0;
    })
    .slice(0, 8);

  // Category quick links reconcile the admin's saved chips against the live
  // category list so stale entries never leave dead links on the page.
  const chips = (() => {
    const savedChips: { label: string; href: string }[] = Array.isArray(hero?.catChips) && hero.catChips.length > 0 ? hero.catChips : [];
    if (categories.length === 0) {
      return savedChips.length > 0 ? savedChips : [
        { label: "Gaming PCs", href: "/pc" },
        { label: "Graphics Cards", href: "/graphics-cards" },
        { label: "Laptops", href: "/laptops" },
        { label: "Servers", href: "/servers" },
        { label: "Repairs", href: "/repairs" },
      ];
    }
    if (savedChips.length === 0) {
      return categories.slice(0, 6).map((c) => ({ label: c.label, href: "/" + c.id }));
    }
    const liveByHref = new Map(categories.map((c) => ["/" + c.id, c.label]));
    const kept = savedChips.filter((c) => c.href && liveByHref.has(c.href));
    const existing = new Set(kept.map((c) => c.href));
    const added = categories
      .filter((c) => !existing.has("/" + c.id))
      .map((c) => ({ label: c.label, href: "/" + c.id }));
    return [...kept, ...added];
  })();

  const identityBandActive = hero?.identityBandActive !== false;

  return (
    <div className="storefront-original">
      {hero?.heroActive !== false && <HeroSection products={products} hero={hero} />}

      <GuaranteeStrip hero={hero} />

      <ShopCategories categories={categories} products={catalogueProducts} chips={chips} />

      {identityBandActive && (
        <section className="identity-band" aria-label="Shop and repairs">
          <div className="identity-card identity-card--shop">
            <div className="identity-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>
            </div>
            <div>
              <h2>Shop premium tech</h2>
              <p>Gaming PCs, laptops, graphics cards, servers and printers with nationwide delivery.</p>
            </div>
            <Link href="/pc" className="btn btn-primary btn-sm">Shop now</Link>
          </div>
          <div className="identity-card identity-card--repair">
            <div className="identity-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </div>
            <div>
              <h2>Need a repair?</h2>
              <p>Expert laptop, PC and device repairs with real-time tracking. Most repairs in 24-48h.</p>
            </div>
            <Link href="/repairs" className="btn btn-secondary btn-sm">Book a repair</Link>
          </div>
        </section>
      )}

      <FeaturedProducts featured={featuredPicks} />

      <section className="storefront-catalogue" id="catalogue" aria-label="All products">
        <div className="storefront-section-head">
          <div>
            <h2>All products</h2>
            <p>Browse the full catalogue.</p>
          </div>
        </div>
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
              {homeVisible.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            <Pagination page={safeHomePage} totalPages={homeTotalPages} onChange={setHomePage} label="All products pagination" />
          </>
        )}
      </section>

      <NewsletterSection />
    </div>
  );
}