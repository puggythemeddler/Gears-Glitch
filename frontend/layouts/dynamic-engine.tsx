import React, { useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { formatPrice } from "./shared";
import { Motion } from "@/components/motion/Motion";
import { motionGroupItemVars } from "@/lib/motion";
import type { MotionConfig, MotionTrigger } from "@/lib/motion";

export interface DynamicLayoutConfig {
  hero?: {
    enabled?: boolean;
    style?: "carousel" | "split" | "minimal" | "none";
    badge?: string;
    headline?: string;
    subtitle?: string;
    ctaText?: string;
    ctaLink?: string;
    buttons?: { label: string; link: string; variant?: "secondary" | "outline" }[];
    backgroundImage?: string;
    featuredCategory?: string;
    animation?: MotionConfig | null;
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

export type DynamicSection =
  | { type: "product-grid"; id?: string; title?: string; productFilter?: "all" | "featured" | "sale" | "newest"; columns?: number; limit?: number; animation?: MotionConfig | null }
  | { type: "category-grid"; id?: string; title?: string; columns?: number; style?: "cards" | "icons"; animation?: MotionConfig | null }
  | { type: "banner"; id?: string; imageUrl?: string; link?: string; text?: string; bgColor?: string; textColor?: string; buttonLabel?: string; buttonLink?: string; animation?: MotionConfig | null }
  | { type: "stats"; id?: string; items?: { icon?: string; value: string; label: string }[]; animation?: MotionConfig | null }
  | { type: "text"; id?: string; title?: string; content?: string; align?: "left" | "center"; animation?: MotionConfig | null }
  | { type: "button"; id?: string; label?: string; link?: string; variant?: "primary" | "secondary" | "outline"; align?: "left" | "center"; size?: "sm" | "md" | "lg"; animation?: MotionConfig | null }
  | { type: "image"; id?: string; imageUrl?: string; alt?: string; caption?: string; link?: string; maxWidth?: number; rounded?: boolean; animation?: MotionConfig | null }
  | { type: "features"; id?: string; title?: string; columns?: number; items?: { icon?: string; title?: string; text?: string }[]; animation?: MotionConfig | null }
  | { type: "spacer"; id?: string; height?: number; animation?: MotionConfig | null };

const DEFAULT_HERO_BG = "linear-gradient(135deg, var(--primary) 0%, #ea580c 55%, var(--brand-gradient-b, #fbbf24) 120%)";

function heroBackground(hero: DynamicLayoutConfig["hero"], colors?: DynamicLayoutConfig["colors"]): string {
  if (hero?.backgroundImage) {
    return `linear-gradient(rgba(0, 0, 0, 0.62), rgba(0, 0, 0, 0.62)), url(${hero.backgroundImage}) center/cover no-repeat`;
  }
  return colors?.heroBg || DEFAULT_HERO_BG;
}

export function HeroSection({ hero, colors, products, categories, forceTrigger }: { hero: DynamicLayoutConfig["hero"]; colors?: DynamicLayoutConfig["colors"]; products: Product[]; categories?: { id: string; label: string }[]; forceTrigger?: MotionTrigger }) {
  if (!hero || hero.enabled === false || hero.style === "none") return null;
  return (
    <Motion config={hero.animation} trigger={forceTrigger}>
      <HeroInner hero={hero} colors={colors} products={products} categories={categories} />
    </Motion>
  );
}

function HeroInner({ hero, colors, products }: { hero: DynamicLayoutConfig["hero"]; colors?: DynamicLayoutConfig["colors"]; products: Product[]; categories?: { id: string; label: string }[] }) {
  if (!hero || hero.enabled === false || hero.style === "none") return null;

  const bg = heroBackground(hero, colors);
  const textColor = colors?.heroText || "#ffffff";
  const accent = colors?.accent || "var(--primary)";

  const renderCTA = (label: string, href: string, variant: "primary" | "secondary" | "outline" = "primary") => {
    const base: React.CSSProperties = {
      display: "inline-block", padding: "0.75rem 1.9rem", borderRadius: 8, fontWeight: 600, textDecoration: "none",
      margin: "0.35rem 0.5rem 0.35rem 0",
    };
    if (variant === "primary") return <a key={href + label} href={href} style={{ ...base, background: accent, color: "#fff" }}>{label}</a>;
    if (variant === "secondary") return <a key={href + label} href={href} style={{ ...base, background: "rgba(255,255,255,0.14)", color: textColor, border: "1px solid rgba(255,255,255,0.3)" }}>{label}</a>;
    return <a key={href + label} href={href} style={{ ...base, background: "transparent", color: textColor, border: `1px solid ${textColor}` }}>{label}</a>;
  };

  const heroTimeline = hero.animation?.preset === "hero-timeline" ? "hero-timeline" : undefined;

  if (hero.style === "minimal") {
    return (
      <div className={heroTimeline} style={{ background: bg, color: textColor, padding: "3.5rem 2rem", textAlign: "center", backgroundSize: "cover", backgroundPosition: "center" }}>
        {hero.badge && <div style={{ display: "inline-block", background: accent, color: "#fff", padding: "0.3rem 1rem", borderRadius: 99, fontSize: "0.8rem", fontWeight: 600, marginBottom: "1rem" }}>{hero.badge}</div>}
        <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 700, margin: "0 0 1rem", lineHeight: 1.15 }}>{hero.headline || "Welcome"}</h1>
        {hero.subtitle && <p style={{ fontSize: "1.1rem", opacity: 0.88, maxWidth: 620, margin: "0 auto 1.5rem", lineHeight: 1.6 }}>{hero.subtitle}</p>}
        {hero.ctaText && renderCTA(hero.ctaText, hero.ctaLink || "/", "primary")}
        {(hero.buttons || []).map((b) => renderCTA(b.label, b.link, b.variant || "secondary"))}
      </div>
    );
  }

  if (hero.style === "split") {
    const featured = hero.featuredCategory ? products.filter((p) => p.category === hero.featuredCategory).slice(0, 1) : products.slice(0, 1);
    return (
      <div className={heroTimeline} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", background: bg, backgroundSize: "cover", backgroundPosition: "center", color: textColor, padding: "3.5rem 2rem", alignItems: "center" }}>
        <div>
          {hero.badge && <div style={{ display: "inline-block", background: accent, color: "#fff", padding: "0.3rem 1rem", borderRadius: 99, fontSize: "0.8rem", fontWeight: 600, marginBottom: "1rem" }}>{hero.badge}</div>}
          <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 700, margin: "0 0 1rem", lineHeight: 1.15 }}>{hero.headline || "Welcome"}</h1>
          {hero.subtitle && <p style={{ fontSize: "1.05rem", opacity: 0.88, marginBottom: "1.25rem", lineHeight: 1.6 }}>{hero.subtitle}</p>}
          {hero.ctaText && renderCTA(hero.ctaText, hero.ctaLink || "/", "primary")}
          {(hero.buttons || []).map((b) => renderCTA(b.label, b.link, b.variant || "secondary"))}
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          {featured[0]?.imageUrl && <img src={featured[0].imageUrl} alt={featured[0].name} style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 12, objectFit: "contain", filter: "drop-shadow(0 12px 32px rgba(0,0,0,0.35))" }} />}
        </div>
      </div>
    );
  }

  // Default: carousel style
  const [current, setCurrent] = useState(0);
  const featured = hero.featuredCategory ? products.filter((p) => p.category === hero.featuredCategory).slice(0, 5) : products.filter((p) => p.salePrice).slice(0, 5).length > 0 ? products.filter((p) => p.salePrice).slice(0, 5) : products.slice(0, 5);

  useEffect(() => {
    if (featured.length <= 1) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setCurrent((c) => (c + 1) % featured.length), 5000);
    return () => clearInterval(t);
  }, [featured.length]);

  const item = featured[current] || featured[0];

  return (
    <div className={heroTimeline} style={{ background: bg, backgroundSize: "cover", backgroundPosition: "center", color: textColor, padding: "3.5rem 2rem", position: "relative", overflow: "hidden", minHeight: 340 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "center" }}>
        <div>
          {hero.badge && <div style={{ display: "inline-block", background: accent, color: "#fff", padding: "0.3rem 1rem", borderRadius: 99, fontSize: "0.8rem", fontWeight: 600, marginBottom: "1rem" }}>{hero.badge}</div>}
          <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 700, margin: "0 0 1rem", lineHeight: 1.15 }}>{hero.headline || "Welcome"}</h1>
          {hero.subtitle && <p style={{ fontSize: "1.05rem", opacity: 0.88, marginBottom: "1.25rem", lineHeight: 1.6 }}>{hero.subtitle}</p>}
          {hero.ctaText && renderCTA(hero.ctaText, hero.ctaLink || "/", "primary")}
          {(hero.buttons || []).map((b) => renderCTA(b.label, b.link, b.variant || "secondary"))}
          {item && (
            <div style={{ marginTop: "1.25rem", padding: "1rem", background: "rgba(255,255,255,0.12)", borderRadius: 10, backdropFilter: "blur(10px)" }}>
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
            <button key={i} type="button" aria-label={`Go to slide ${i + 1}`} onClick={() => setCurrent(i)} style={{ width: 28, height: 12, borderRadius: 99, border: "none", padding: 0, transform: i === current ? "scaleX(1)" : "scaleX(0.43)", transformOrigin: "left", background: i === current ? accent : "rgba(255,255,255,0.3)", cursor: "pointer", transition: "background 0.3s ease, transform 0.3s ease" }} />
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
  const priceColor = showSale && product.salePrice ? "var(--danger)" : "var(--text)";

  if (style === "compact") {
    return (
      <a href={`/product?id=${product.id}`} style={{ display: "block", textDecoration: "none", color: "var(--text)" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", transition: "transform 0.2s, box-shadow 0.2s" }}>
          {product.imageUrl && <img src={product.imageUrl} alt={product.name} loading="lazy" style={{ width: "100%", height: 140, objectFit: "contain", background: "var(--surface)" }} />}
          <div style={{ padding: "0.6rem" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name}</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: priceColor }}>{formatPrice(showSale && product.salePrice ? product.salePrice : product.price)}</div>
            {showSale && product.salePrice && <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", textDecoration: "line-through" }}>{formatPrice(product.price)}</div>}
          </div>
        </div>
      </a>
    );
  }

  if (style === "detailed") {
    return (
      <a href={`/product?id=${product.id}`} style={{ display: "block", textDecoration: "none", color: "var(--text)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "0.75rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", padding: "0.75rem", transition: "transform 0.2s, box-shadow 0.2s", alignItems: "center" }}>
          {product.imageUrl && <img src={product.imageUrl} alt={product.name} loading="lazy" style={{ width: "100%", height: 120, objectFit: "contain", background: "var(--surface)", borderRadius: 8 }} />}
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 4 }}>{product.category}</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>{product.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1rem", fontWeight: 700, color: priceColor }}>{formatPrice(showSale && product.salePrice ? product.salePrice : product.price)}</span>
              {showSale && product.salePrice && <span style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", textDecoration: "line-through" }}>{formatPrice(product.price)}</span>}
            </div>
            {showRating && (
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 4 }}>{"â˜…"} {(product as any).avgRating ? Number((product as any).avgRating).toFixed(1) : "â€”"}</div>
            )}
          </div>
        </div>
      </a>
    );
  }

  return (
    <a href={`/product?id=${product.id}`} style={{ display: "block", textDecoration: "none", color: "var(--text)" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", transition: "transform 0.2s, box-shadow 0.2s" }}>
        {product.imageUrl && <img src={product.imageUrl} alt={product.name} loading="lazy" style={{ width: "100%", height: 200, objectFit: "contain", background: "var(--surface)" }} />}
        <div style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 4 }}>{product.category}</div>
          <div style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 6 }}>{product.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1rem", fontWeight: 700, color: priceColor }}>{formatPrice(showSale && product.salePrice ? product.salePrice : product.price)}</span>
            {showSale && product.salePrice && <span style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", textDecoration: "line-through" }}>{formatPrice(product.price)}</span>}
          </div>
          {showRating && (
            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 4 }}>{"â˜…"} {(product as any).avgRating ? Number((product as any).avgRating).toFixed(1) : "â€”"}</div>
          )}
        </div>
      </div>
    </a>
  );
}

function DynamicSectionInner({ section, products, categories, colors, cardConfig }: { section: DynamicSection; products: Product[]; categories: { id: string; label: string }[]; colors?: DynamicLayoutConfig["colors"]; cardConfig?: DynamicLayoutConfig["productCard"] }) {
  if (section.type === "product-grid") {
    let filtered = [...products];
    if (section.productFilter === "featured") filtered = filtered.filter((p) => p.imageUrl);
    if (section.productFilter === "sale") filtered = filtered.filter((p) => p.salePrice);
    if (section.productFilter === "newest") filtered = [...filtered].reverse();
    if (section.limit) filtered = filtered.slice(0, section.limit);
    const cols = section.columns || 4;
    const stagger = section.animation?.preset === "stagger";
    return (
      <div style={{ padding: "2rem 2rem 0.5rem", maxWidth: 1440, margin: "0 auto" }}>
        {section.title && <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>{section.title}</h2>}
        {filtered.length === 0 ? (
          <p style={{ color: "var(--text-tertiary)", padding: "1rem 0" }}>No products match this filter yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${cols > 3 ? 240 : 280}px, 1fr))`, gap: "1rem" }}>
            {filtered.map((p, j) => stagger ? (
              <div key={p.id} className="motion-child" style={motionGroupItemVars(j) as React.CSSProperties}>
                <ProductCard product={p} cardConfig={cardConfig} />
              </div>
            ) : (
              <ProductCard key={p.id} product={p} cardConfig={cardConfig} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (section.type === "category-grid") {
    const cols = section.columns || 4;
    const stagger = section.animation?.preset === "stagger";
    const cellStyle: React.CSSProperties = {
      display: "block", textDecoration: "none", color: "var(--text)", background: "var(--surface)",
      border: "1px solid var(--border)", borderRadius: 10, padding: section.style === "icons" ? "1.25rem" : "1.5rem",
      textAlign: "center", transition: "transform 0.2s, border-color 0.2s",
    };
    return (
      <div style={{ padding: "2rem 2rem 0.5rem", maxWidth: 1440, margin: "0 auto" }}>
        {section.title && <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>{section.title}</h2>}
        {categories.length === 0 ? (
          <p style={{ color: "var(--text-tertiary)", padding: "1rem 0" }}>No categories yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${section.style === "icons" ? 120 : 220}px, 1fr))`, gap: "1rem" }}>
            {categories.map((cat, j) => (
              <a key={cat.id} href={`/${cat.id}`} className={stagger ? "motion-child" : undefined} style={stagger ? { ...cellStyle, ...motionGroupItemVars(j) } : cellStyle}>
                <div style={{ fontSize: section.style === "icons" ? "1.5rem" : "0.95rem", fontWeight: 600 }}>{cat.label}</div>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (section.type === "banner") {
    return (
      <div style={{ margin: "1.5rem auto", maxWidth: 1440, padding: "0 2rem" }}>
        <a href={section.link || "/"} style={{ display: "block", background: section.bgColor || "var(--primary-subtle)", borderRadius: 12, overflow: "hidden", textDecoration: "none", color: "inherit" }}>
          {section.imageUrl ? (
            <div style={{ position: "relative" }}>
              <img src={section.imageUrl} alt={section.text || ""} loading="lazy" style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} />
              {(section.text || section.buttonLabel) && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem", background: "rgba(0,0,0,0.35)", color: "#fff" }}>
                  {section.text && <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{section.text}</div>}
                  {section.buttonLabel && <span style={{ background: "var(--primary)", color: "#fff", padding: "0.5rem 1.4rem", borderRadius: 8, fontWeight: 600, fontSize: "0.9rem" }}>{section.buttonLabel}</span>}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: "2rem", textAlign: "center", color: section.textColor || "var(--text)", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
              {section.text && <div style={{ fontSize: "1.2rem", fontWeight: 600 }}>{section.text}</div>}
              {section.buttonLabel && <span style={{ background: "var(--primary)", color: "#fff", padding: "0.5rem 1.4rem", borderRadius: 8, fontWeight: 600, fontSize: "0.9rem" }}>{section.buttonLabel}</span>}
            </div>
          )}
        </a>
      </div>
    );
  }

  if (section.type === "stats") {
    const stagger = section.animation?.preset === "stagger";
    return (
      <div style={{ padding: "2rem 2rem 0.5rem", maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "1rem" }}>
          {(section.items || []).map((item, j) => (
            <div key={j} className={stagger ? "motion-child" : undefined} style={{ textAlign: "center", padding: "1.5rem 1rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, ...(stagger ? motionGroupItemVars(j) : {}) }}>
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
      <div style={{ padding: "2rem 2rem 0.5rem", maxWidth: 800, margin: "0 auto", textAlign: section.align || "center" }}>
        {section.title && <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem" }}>{section.title}</h2>}
        {section.content && <p style={{ fontSize: "1rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>{section.content}</p>}
      </div>
    );
  }

  if (section.type === "button") {
    const sizePad = section.size === "lg" ? "0.9rem 2.4rem" : section.size === "sm" ? "0.5rem 1.2rem" : "0.7rem 1.8rem";
    const sizeFont = section.size === "lg" ? "1.05rem" : section.size === "sm" ? "0.82rem" : "0.95rem";
    const base: React.CSSProperties = {
      display: "inline-block", padding: sizePad, borderRadius: 8, fontWeight: 600, textDecoration: "none", fontSize: sizeFont,
      cursor: "pointer",
    };
    const style = section.variant === "outline"
      ? { ...base, border: `1.5px solid var(--primary)`, color: "var(--primary)", background: "transparent" }
      : section.variant === "secondary"
        ? { ...base, border: "1px solid var(--border)", color: "var(--text)", background: "var(--surface)" }
        : { ...base, border: "1px solid var(--primary)", color: "#fff", background: "var(--primary)" };
    return (
      <div style={{ padding: "1rem 2rem", maxWidth: 1440, margin: "0 auto", textAlign: section.align || "center" }}>
        {section.label ? <a href={section.link || "/"} style={style}>{section.label}</a> : <span style={{ color: "var(--text-tertiary)", fontSize: "0.85rem" }}>Button â€” set a label</span>}
      </div>
    );
  }

  if (section.type === "image") {
    return (
      <div style={{ padding: "1.5rem 2rem", maxWidth: 1440, margin: "0 auto", textAlign: "center" }}>
        {section.imageUrl ? (
          <a href={section.link || undefined} style={{ textDecoration: "none", color: "inherit", display: "inline-block" }}>
            <img src={section.imageUrl} alt={section.alt || section.caption || ""} loading="lazy" style={{ maxWidth: "100%", maxHeight: 480, width: section.maxWidth ? section.maxWidth : undefined, borderRadius: section.rounded ? 14 : 0, objectFit: "contain" }} />
          </a>
        ) : (
          <div style={{ border: "2px dashed var(--border)", borderRadius: 12, padding: "3rem", color: "var(--text-tertiary)" }}>Image â€” add an image URL</div>
        )}
        {section.caption && <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>{section.caption}</p>}
      </div>
    );
  }

  if (section.type === "features") {
    const cols = section.columns || 3;
    const stagger = section.animation?.preset === "stagger";
    return (
      <div style={{ padding: "2rem 2rem 0.5rem", maxWidth: 1440, margin: "0 auto" }}>
        {section.title && <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem", textAlign: "center" }}>{section.title}</h2>}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${cols > 3 ? 200 : 260}px, 1fr))`, gap: "1rem" }}>
          {(section.items || []).map((item, j) => (
            <div key={j} className={stagger ? "motion-child" : undefined} style={{ padding: "1.5rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, textAlign: "center", ...(stagger ? motionGroupItemVars(j) : {}) }}>
              {item.icon && <div style={{ fontSize: "1.8rem", marginBottom: "0.6rem" }}>{item.icon}</div>}
              {item.title && <div style={{ fontWeight: 700, marginBottom: "0.4rem" }}>{item.title}</div>}
              {item.text && <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>{item.text}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section.type === "spacer") {
    return <div style={{ height: section.height || 40 }} />;
  }

  return null;
}

export function DynamicSectionView({ section, products, categories, colors, cardConfig, forceTrigger }: { section: DynamicSection; products: Product[]; categories: { id: string; label: string }[]; colors?: DynamicLayoutConfig["colors"]; cardConfig?: DynamicLayoutConfig["productCard"]; forceTrigger?: MotionTrigger }) {
  return (
    <Motion config={section.animation} trigger={forceTrigger}>
      <DynamicSectionInner section={section} products={products} categories={categories} colors={colors} cardConfig={cardConfig} />
    </Motion>
  );
}

export function DynamicHomePage({ products, categories, banners, config }: { products: Product[]; categories: { id: string; label: string }[]; banners: any[]; config: DynamicLayoutConfig }) {
  const colors = config.colors;
  const sections = config.sections || [];
  const cardConfig = config.productCard;

  return (
    <div className="dynamic-layout">
      <HeroSection hero={config.hero} colors={colors} products={products} categories={categories} />
      {sections.map((section, i) => (
        <div key={(section as { id?: string }).id || i}>
          <DynamicSectionView section={section} products={products} categories={categories} colors={colors} cardConfig={cardConfig} />
        </div>
      ))}
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
