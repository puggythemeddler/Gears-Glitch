import React, { useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { formatPrice } from "./shared";

interface DynamicLayoutConfig {
  hero?: {
    enabled?: boolean;
    style?: "carousel" | "split" | "minimal" | "none";
    badge?: string;
    headline?: string;
    subtitle?: string;
    ctaText?: string;
    ctaLink?: string;
    backgroundImage?: string;
    featuredCategory?: string;
  };
  sections?: DynamicSection[];
  productCard?: {
    style?: "default" | "compact" | "detailed";
    showRating?: boolean;
    showSalePrice?: boolean;
  };
  colors?: {
    heroBg?: string;
    heroText?: string;
    accent?: string;
  };
}

type DynamicSection =
  | { type: "product-grid"; title?: string; productFilter?: "all" | "featured" | "sale" | "newest"; columns?: number; limit?: number }
  | { type: "category-grid"; title?: string; columns?: number; style?: "cards" | "icons" }
  | { type: "banner"; imageUrl?: string; link?: string; text?: string; bgColor?: string; textColor?: string }
  | { type: "stats"; items?: { icon?: string; value: string; label: string }[] }
  | { type: "text"; title?: string; content?: string; align?: "left" | "center" }
  | { type: "spacer"; height?: number };

function HeroSection({ hero, colors, products, categories }: { hero: DynamicLayoutConfig["hero"]; colors?: DynamicLayoutConfig["colors"]; products: Product[]; categories: { id: string; label: string }[] }) {
  if (!hero || hero.enabled === false || hero.style === "none") return null;

  const bg = colors?.heroBg || "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)";
  const textColor = colors?.heroText || "#ffffff";

  if (hero.style === "minimal") {
    return (
      <div style={{ background: bg, color: textColor, padding: "3rem 2rem", textAlign: "center" }}>
        {hero.badge && <div style={{ display: "inline-block", background: colors?.accent || "var(--primary)", color: "#fff", padding: "0.3rem 1rem", borderRadius: 99, fontSize: "0.8rem", fontWeight: 600, marginBottom: "1rem" }}>{hero.badge}</div>}
        <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.5rem)", fontWeight: 700, margin: "0 0 1rem" }}>{hero.headline || "Welcome"}</h1>
        {hero.subtitle && <p style={{ fontSize: "1.1rem", opacity: 0.85, maxWidth: 600, margin: "0 auto 2rem" }}>{hero.subtitle}</p>}
        {hero.ctaText && <a href={hero.ctaLink || "/"} style={{ display: "inline-block", background: colors?.accent || "#fff", color: hero.style === "minimal" && !colors?.heroBg ? "#0f172a" : "#fff", padding: "0.75rem 2rem", borderRadius: 8, fontWeight: 600, textDecoration: "none" }}>{hero.ctaText}</a>}
      </div>
    );
  }

  if (hero.style === "split") {
    const featured = hero.featuredCategory ? products.filter((p) => p.category === hero.featuredCategory).slice(0, 1) : products.slice(0, 1);
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", background: bg, color: textColor, padding: "3rem 2rem", alignItems: "center" }}>
        <div>
          {hero.badge && <div style={{ display: "inline-block", background: colors?.accent || "var(--primary)", color: "#fff", padding: "0.3rem 1rem", borderRadius: 99, fontSize: "0.8rem", fontWeight: 600, marginBottom: "1rem" }}>{hero.badge}</div>}
          <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 700, margin: "0 0 1rem", lineHeight: 1.15 }}>{hero.headline || "Welcome"}</h1>
          {hero.subtitle && <p style={{ fontSize: "1.05rem", opacity: 0.85, marginBottom: "1.5rem" }}>{hero.subtitle}</p>}
          {hero.ctaText && <a href={hero.ctaLink || "/"} style={{ display: "inline-block", background: colors?.accent || "#fff", color: "#0f172a", padding: "0.75rem 2rem", borderRadius: 8, fontWeight: 600, textDecoration: "none" }}>{hero.ctaText}</a>}
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          {featured[0]?.imageUrl && <img src={featured[0].imageUrl} alt={featured[0].name} style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 12, objectFit: "contain" }} />}
        </div>
      </div>
    );
  }

  // Default: carousel style
  const [current, setCurrent] = useState(0);
  const featured = hero.featuredCategory ? products.filter((p) => p.category === hero.featuredCategory).slice(0, 5) : products.filter((p) => p.salePrice).slice(0, 5).length > 0 ? products.filter((p) => p.salePrice).slice(0, 5) : products.slice(0, 5);

  useEffect(() => {
    if (featured.length <= 1) return;
    const t = setInterval(() => setCurrent((c) => (c + 1) % featured.length), 5000);
    return () => clearInterval(t);
  }, [featured.length]);

  const item = featured[current] || featured[0];

  return (
    <div style={{ background: bg, color: textColor, padding: "3rem 2rem", position: "relative", overflow: "hidden", minHeight: 320 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "center" }}>
        <div>
          {hero.badge && <div style={{ display: "inline-block", background: colors?.accent || "var(--primary)", color: "#fff", padding: "0.3rem 1rem", borderRadius: 99, fontSize: "0.8rem", fontWeight: 600, marginBottom: "1rem" }}>{hero.badge}</div>}
          <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 700, margin: "0 0 1rem", lineHeight: 1.15 }}>{hero.headline || "Welcome"}</h1>
          {hero.subtitle && <p style={{ fontSize: "1.05rem", opacity: 0.85, marginBottom: "1.5rem" }}>{hero.subtitle}</p>}
          {hero.ctaText && <a href={hero.ctaLink || "/"} style={{ display: "inline-block", background: colors?.accent || "#fff", color: "#0f172a", padding: "0.75rem 2rem", borderRadius: 8, fontWeight: 600, textDecoration: "none" }}>{hero.ctaText}</a>}
          {item && (
            <div style={{ marginTop: "1.5rem", padding: "1rem", background: "rgba(255,255,255,0.1)", borderRadius: 10, backdropFilter: "blur(8px)" }}>
              <div style={{ fontWeight: 600 }}>{item.name}</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{formatPrice(item.salePrice || item.price)}</div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          {item?.imageUrl && <img src={item.imageUrl} alt={item.name} style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 12, objectFit: "contain", transition: "opacity 0.3s" }} />}
        </div>
      </div>
      {featured.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: "1.5rem", position: "relative", zIndex: 2 }}>
          {featured.map((_: any, i: number) => (
            <button key={i} onClick={() => setCurrent(i)} style={{ width: i === current ? 24 : 8, height: 8, borderRadius: 99, border: "none", background: i === current ? (colors?.accent || "#fff") : "rgba(255,255,255,0.3)", cursor: "pointer", transition: "all 0.3s" }} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, cardConfig }: { product: Product; cardConfig?: DynamicLayoutConfig["productCard"] }) {
  const style = cardConfig?.style || "default";
  const showRating = cardConfig?.showRating !== false;
  const showSale = cardConfig?.showSalePrice !== false;

  if (style === "compact") {
    return (
      <a href={`/product?id=${product.id}`} style={{ display: "block", textDecoration: "none", color: "var(--text)" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", transition: "transform 0.2s, box-shadow 0.2s" }}>
          {product.imageUrl && <img src={product.imageUrl} alt={product.name} style={{ width: "100%", height: 140, objectFit: "contain", background: "#f8fafc" }} />}
          <div style={{ padding: "0.6rem" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name}</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: showSale && product.salePrice ? "var(--danger)" : "var(--text)" }}>{formatPrice(showSale && product.salePrice ? product.salePrice : product.price)}</div>
            {showSale && product.salePrice && <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", textDecoration: "line-through" }}>{formatPrice(product.price)}</div>}
          </div>
        </div>
      </a>
    );
  }

  return (
    <a href={`/product?id=${product.id}`} style={{ display: "block", textDecoration: "none", color: "var(--text)" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", transition: "transform 0.2s, box-shadow 0.2s" }}>
        {product.imageUrl && <img src={product.imageUrl} alt={product.name} style={{ width: "100%", height: 200, objectFit: "contain", background: "#f8fafc" }} />}
        <div style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 4 }}>{product.category}</div>
          <div style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 6 }}>{product.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1rem", fontWeight: 700, color: showSale && product.salePrice ? "var(--danger)" : "var(--text)" }}>{formatPrice(showSale && product.salePrice ? product.salePrice : product.price)}</span>
            {showSale && product.salePrice && <span style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", textDecoration: "line-through" }}>{formatPrice(product.price)}</span>}
          </div>
          {showRating && product.viewCount !== undefined && (
            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 4 }}>
              {"★"} {(product as any).avgRating ? Number((product as any).avgRating).toFixed(1) : "—"}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

export function DynamicHomePage({ products, categories, banners, config }: { products: Product[]; categories: { id: string; label: string }[]; banners: any[]; config: DynamicLayoutConfig }) {
  const colors = config.colors;
  const sections = config.sections || [];
  const cardConfig = config.productCard;

  return (
    <div>
      <HeroSection hero={config.hero} colors={colors} products={products} categories={categories} />

      {sections.map((section, i) => {
        if (section.type === "product-grid") {
          let filtered = [...products];
          if (section.productFilter === "sale") filtered = filtered.filter((p) => p.salePrice);
          if (section.productFilter === "newest") filtered.reverse();
          if (section.limit) filtered = filtered.slice(0, section.limit);
          const cols = section.columns || 4;
          return (
            <div key={i} style={{ padding: "2rem", width: "100%" }}>
              {section.title && <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>{section.title}</h2>}
              <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${cols > 3 ? 240 : 280}px, 1fr))`, gap: "1rem" }}>
                {filtered.map((p) => <ProductCard key={p.id} product={p} cardConfig={cardConfig} />)}
              </div>
            </div>
          );
        }

        if (section.type === "category-grid") {
          const cols = section.columns || 4;
          return (
            <div key={i} style={{ padding: "2rem", width: "100%" }}>
              {section.title && <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>{section.title}</h2>}
              <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${section.style === "icons" ? 120 : 220}px, 1fr))`, gap: "1rem" }}>
                {categories.map((cat) => (
                  <a key={cat.id} href={`/${cat.id}`} style={{ display: "block", textDecoration: "none", color: "var(--text)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: section.style === "icons" ? "1rem" : "1.5rem", textAlign: "center", transition: "transform 0.2s, border-color 0.2s" }}>
                    <div style={{ fontSize: section.style === "icons" ? "1.5rem" : "0.95rem", fontWeight: 600 }}>{cat.label}</div>
                  </a>
                ))}
              </div>
            </div>
          );
        }

        if (section.type === "banner") {
          return (
            <div key={i} style={{ margin: "1.5rem 0", width: "100%", padding: "0 2rem" }}>
              <a href={section.link || "/"} style={{ display: "block", background: section.bgColor || "var(--primary-subtle)", borderRadius: 12, overflow: "hidden", textDecoration: "none" }}>
                {section.imageUrl ? (
                  <img src={section.imageUrl} alt={section.text || ""} style={{ width: "100%", height: 200, objectFit: "cover" }} />
                ) : (
                  <div style={{ padding: "2rem", textAlign: "center", color: section.textColor || "var(--text)", fontSize: "1.2rem", fontWeight: 600 }}>
                    {section.text}
                  </div>
                )}
              </a>
            </div>
          );
        }

        if (section.type === "stats") {
          return (
            <div key={i} style={{ padding: "2rem", width: "100%" }}>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(160px, 1fr))`, gap: "1rem" }}>
                {(section.items || []).map((item, j) => (
                  <div key={j} style={{ textAlign: "center", padding: "1.5rem 1rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}>
                    {item.icon && <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>{item.icon}</div>}
                    <div style={{ fontSize: "1.8rem", fontWeight: 700, color: colors?.accent || "var(--primary)" }}>{item.value}</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 4 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (section.type === "text") {
          return (
            <div key={i} style={{ padding: "2rem", maxWidth: 800, margin: "0 auto", textAlign: section.align || "center" }}>
              {section.title && <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem" }}>{section.title}</h2>}
              {section.content && <p style={{ fontSize: "1rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>{section.content}</p>}
            </div>
          );
        }

        if (section.type === "spacer") {
          return <div key={i} style={{ height: section.height || 40 }} />;
        }

        return null;
      })}
    </div>
  );
}

export function DynamicLayoutStyles({ colors }: { colors?: DynamicLayoutConfig["colors"] }) {
  return (
    <style>{`
      .dynamic-layout a:hover { opacity: 0.9; }
      @media (max-width: 768px) {
        .dynamic-layout [style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
      }
    `}</style>
  );
}
