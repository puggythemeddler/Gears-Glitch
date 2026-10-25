import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { formatPrice } from "./shared";
import { Media } from "@/components/Media";
import { Pagination } from "@/components/ui";
import { ProductCard } from "@/components/ProductCard";
import { normalizeHref } from "@/lib/links";
import {
  heroEffectProfile,
  selectHeroFeatured,
} from "@/lib/hero-effects";
import { useHeroPointerEffects, usePrefersReducedMotion } from "@/components/motion/useHeroEffects";

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
  const heroRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const effects = heroEffectProfile(hero, reducedMotion);
  const allowPointer = effects.allowPointer;
  const entranceEnabled = effects.entrance;

  useHeroPointerEffects(heroRef, allowPointer, {
    tilt: effects.tilt,
    parallax: effects.parallax,
    spotlight: effects.spotlight,
    amplitude: effects.amplitude,
  });

  const featured = selectHeroFeatured(products, 6);
  const activeProductIndex = featured.length > 0 ? activeIdx % featured.length : 0;

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
  const headline = variant?.headline || hero?.headline || "Find your next";
  const headlineAccent = variant?.accent || hero?.headlineAccent || "device";
  const subtitle = variant?.subtitle || hero?.subtitle || "Shop PCs, laptops, graphics cards and servers, or book a device repair.";

  const badgeText = typeof hero?.badgeText === "string" ? hero.badgeText.trim() : "";
  const badgeActive = hero?.badgeActive !== false && badgeText.length > 0;
  const badgeLink = hero?.badgeLink || "";

  const shopNowLabel = hero?.shopNowLabel || "Shop products";
  const shopNowLink = hero?.shopNowLink || "/#catalogue";
  const configuredBrowseLink = typeof hero?.browseLink === "string" ? hero.browseLink.trim() : "";
  const usesLegacyCategoryLink = configuredBrowseLink === "/#categories" || configuredBrowseLink === "/categories";
  const browseLabel = usesLegacyCategoryLink ? "Book a repair" : hero?.browseLabel || "Book a repair";
  const browseLink = usesLegacyCategoryLink ? "/repairs" : configuredBrowseLink || "/repairs";

  const showWhatsApp = hero?.showWhatsApp !== false;
  const waPhone = settings?.storePhone ? settings.storePhone.replace(/[^0-9]/g, "") : "";

  const panel = featured.length > 0 ? featured[activeProductIndex] : null;

  return (
    <section
      ref={heroRef}
      className={`dy-hero${effects.interactive ? " dy-hero--interactive" : ""}${entranceEnabled ? " dy-hero--enter" : ""}`}
      style={heroStyle}
      aria-label="Featured products"
    >
      {effects.interactive && effects.spotlight && <div className="dy-hero-spotlight" aria-hidden="true" />}
      {effects.interactive && effects.parallax && <div className="dy-hero-bg-layer" aria-hidden="true" />}
      <div className="dy-hero-inner">
        <div className="dy-hero-content">
          {isLoggedIn && userName && (
            <p className="dy-hero-greeting">
              Welcome back, {userName.split(/\s+/)[0]}
              <span>&mdash; we saved you some great deals</span>
            </p>
          )}

          <h1 className="dy-hero-headline">
            {headline} <span style={{ color: "var(--primary)" }}>{headlineAccent}</span>
          </h1>

          {badgeActive && (
            badgeLink ? (
              <a href={badgeLink} className="hero-promotion">
                {badgeText}
              </a>
            ) : (
              <p className="hero-promotion">{badgeText}</p>
            )
          )}

          <p className="dy-hero-sub">{subtitle}</p>

          <div className="dy-hero-cta-row">
            <Link href={shopNowLink} className="dy-hero-btn dy-hero-btn--primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              {shopNowLabel}
            </Link>
            <Link href={browseLink} className="dy-hero-btn dy-hero-btn--secondary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              {browseLabel}
            </Link>
            {showWhatsApp && waPhone && (
              <a
                href={normalizeHref(`https://wa.me/${waPhone}?text=${encodeURIComponent("Hello! I'm interested in your products.")}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="dy-hero-contact-link"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                Chat with us on WhatsApp
              </a>
            )}
          </div>
        </div>

        <div className="dy-hero-showcase">
          {panel ? (
            <Link
              key={panel.id}
              href={`/product?id=${encodeURIComponent(panel.id)}`}
              className={`dy-hero-panel${allowPointer ? " dy-hero-panel--interactive" : ""}`}
              style={{ textDecoration: "none", color: "var(--text)" }}
              aria-label={`View ${panel.name}`}
            >
              <span className="dy-hero-panel-tag">{panel.inStock ? "Available now" : "Out of stock"}</span>
              <div className="dy-hero-panel-media dy-hero-panel-media--stage">
                <div className="dy-hero-panel-media-backdrop" aria-hidden="true" />
                <div className="dy-hero-panel-media-inner">
                  {panel.imageUrl ? (
                    <Media src={panel.imageUrl} alt={panel.name} width={640} height={360} fit="contain" fallbackLabel={panel.name} />
                  ) : (
                    <span style={{ color: "var(--text-tertiary)", fontSize: "0.9rem", textAlign: "center" }}>
                      {panel.name.split(/\s+/).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                    </span>
                  )}
                </div>
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
              <div className="dy-hero-panel-media dy-hero-panel-media--stage">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="22"/></svg>
              </div>
            </div>
          )}
          {featured.length > 1 && (
            <nav className="dy-hero-product-picker" aria-label="Choose a featured product">
              {featured.map((product, index) => (
                <button
                  key={product.id}
                  type="button"
                  className={`dy-hero-product-option${index === activeProductIndex ? " is-active" : ""}`}
                  onClick={() => setActiveIdx(index)}
                  aria-pressed={index === activeProductIndex}
                  aria-label={`Show ${product.name}`}
                >
                  {product.name}
                </button>
              ))}
            </nav>
          )}
        </div>
      </div>
    </section>
  );
}

// Only show store-authored highlights and opted-in live totals. Never invent
// delivery, warranty, authenticity, or payment guarantees as default copy.
function GuaranteeStrip({ hero }: { hero?: any }) {
  const [liveStats, setLiveStats] = useState<any>(null);

  useEffect(() => {
    fetch("/api/storefront-stats").then(r => r.json()).then(setLiveStats).catch(() => {});
  }, []);

  const showTrustStrip = hero?.showTrustStrip !== false;

  const configured: string[] = (hero?.highlights?.length > 0 ? hero.highlights : [])
    .map((h: any) => String(h).trim())
    .filter(Boolean);
  const items = configured.slice(0, 4);

  const hasTotals = liveStats && (liveStats.totalCustomers != null || liveStats.totalOrders != null);
  const totalsLine = hasTotals
    ? [
        ...(Number(liveStats.totalCustomers) >= 10 ? [`${liveStats.totalCustomers}+ customers`] : []),
        ...(Number(liveStats.totalOrders) >= 10 ? [`${liveStats.totalOrders}+ orders`] : []),
      ].join(" \u00b7 ")
    : "";

  if (!showTrustStrip || (items.length === 0 && !totalsLine)) return null;

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

export function HomePage({ products, hero }: {
  products: Product[]; categories: { id: string; label: string }[]; banners: any[]; hero?: any; allProducts?: Product[];
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
    <div className="storefront-original">
      {hero?.heroActive !== false && <HeroSection products={products} hero={hero} />}

      <GuaranteeStrip hero={hero} />

      <section className="storefront-catalogue" id="catalogue" aria-label="Product catalogue">
        <div className="storefront-section-head">
          <div>
            <h2>Shop the catalogue</h2>
            <p>Explore current stock, with prices from the live catalogue.</p>
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
