import React, { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/types";
import { formatPrice } from "./shared";
import { Motion } from "@/components/motion/Motion";
import { Media } from "@/components/Media";
import { motionGroupItemVars } from "@/lib/motion";
import type { MotionConfig, MotionIntensity, MotionTrigger } from "@/lib/motion";
import { heroEffectProfile, type HeroEffectsConfig } from "@/lib/hero-effects";
import { useHeroPointerEffects, usePrefersReducedMotion } from "@/components/motion/useHeroEffects";
import { normalizeHref } from "@/lib/links";
import { api } from "@/lib/api";

// Render a builder-supplied link as an anchor only when it actually points
// somewhere. Empty, "#", or unsafe links render as inert styled content so the
// store never shows a dead `href="#"` button that does nothing on click.
function DyLink({ href, className, style, fid, onClick, children }: {
  href?: string;
  className?: string;
  style?: React.CSSProperties;
  fid?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const target = normalizeHref(href || "");
  if (!target || target === "#") {
    return (
      <span className={className} style={{ ...style, cursor: "default" } as React.CSSProperties} data-fid={fid} onClick={onClick}>
        {children}
      </span>
    );
  }
  return (
    <a className={className} href={target} style={style} data-fid={fid} onClick={onClick}>
      {children}
    </a>
  );
}

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
    effects?: Partial<HeroEffectsConfig> | null;
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
  // Storefront-wide design tokens exposed by the Studio Design panel. Radius is
  // in px; accent/onAccent are hex colours; motionIntensity is the default dial
  // applied to sections that enable motion without specifying their own. The
  // typography tokens (headingFont/bodyFont/headingWeight/headingCase/
  // headingTracking) are what make each template a distinct design system; all
  // are optional and re-validated in DynamicLayoutStyles before injection.
  tokens?: {
    radius?: number;
    accent?: string;
    onAccent?: string;
    motionIntensity?: MotionIntensity;
    headingFont?: "sans" | "serif" | "mono";
    bodyFont?: "sans" | "serif" | "mono";
    headingWeight?: number;
    headingCase?: "none" | "uppercase";
    headingTracking?: number;
  };
}

// Heading weights are written through a CSS custom property so a template's
// `headingWeight` token can restyle every section title without touching each
// element. The fallback preserves the original weight exactly when a layout
// has no typography tokens (i.e. every layout saved before this feature).
const HEADING_WEIGHT = "var(--dy-heading-weight, 700)" as React.CSSProperties["fontWeight"];
const SUBHEAD_WEIGHT = "var(--dy-heading-weight, 600)" as React.CSSProperties["fontWeight"];
const SECTION_TEXT_ALIGN_CENTER = "var(--dy-section-text-align, center)" as React.CSSProperties["textAlign"];
const SECTION_TEXT_ALIGN_LEFT = "var(--dy-section-text-align, left)" as React.CSSProperties["textAlign"];

type SectionStudioStyle = {
  background?: "default" | "surface" | "accent";
  bgColor?: string;
  textColor?: string;
  contentWidth?: "default" | "narrow" | "standard" | "wide" | "full";
  spacing?: "default" | "compact" | "standard" | "spacious";
  headingSize?: "small" | "standard" | "large";
  bodyTextSize?: "small" | "standard" | "large";
  lineHeight?: "compact" | "standard" | "relaxed";
  textAlign?: "default" | "left" | "center" | "right";
};

export type DynamicSection = (
  | { type: "product-grid"; id?: string; title?: string; productFilter?: "all" | "featured" | "sale" | "newest"; columns?: number; columnsTablet?: number; columnsMobile?: number; hideOnMobile?: boolean; limit?: number; animation?: MotionConfig | null }
  | { type: "category-grid"; id?: string; title?: string; columns?: number; columnsTablet?: number; columnsMobile?: number; hideOnMobile?: boolean; style?: "cards" | "icons"; animation?: MotionConfig | null }
  | { type: "banner"; id?: string; imageUrl?: string; link?: string; text?: string; bgColor?: string; textColor?: string; buttonLabel?: string; buttonLink?: string; hideOnMobile?: boolean; animation?: MotionConfig | null }
  | { type: "stats"; id?: string; items?: { icon?: string; value: string; label: string }[]; hideOnMobile?: boolean; animation?: MotionConfig | null }
  | { type: "text"; id?: string; title?: string; content?: string; align?: "left" | "center"; hideOnMobile?: boolean; animation?: MotionConfig | null }
  | { type: "button"; id?: string; label?: string; link?: string; variant?: "primary" | "secondary" | "outline"; align?: "left" | "center"; size?: "sm" | "md" | "lg"; hideOnMobile?: boolean; animation?: MotionConfig | null }
  | { type: "image"; id?: string; imageUrl?: string; alt?: string; caption?: string; link?: string; maxWidth?: number; rounded?: boolean; hideOnMobile?: boolean; animation?: MotionConfig | null }
  | { type: "image-text"; id?: string; imageUrl?: string; alt?: string; title?: string; content?: string; ctaText?: string; ctaLink?: string; imageSide?: "left" | "right"; background?: "default" | "surface" | "accent"; hideOnMobile?: boolean; animation?: MotionConfig | null }
  | { type: "features"; id?: string; title?: string; columns?: number; columnsTablet?: number; columnsMobile?: number; hideOnMobile?: boolean; items?: { icon?: string; title?: string; text?: string }[]; animation?: MotionConfig | null }
  | { type: "spacer"; id?: string; height?: number; hideOnMobile?: boolean; animation?: MotionConfig | null }
  | { type: "financing-promo"; id?: string; title?: string; content?: string; ctaText?: string; ctaLink?: string; hideOnMobile?: boolean; animation?: MotionConfig | null }
) & SectionStudioStyle;

function studioSectionStyle(section: DynamicSection): React.CSSProperties {
  const validColor = (value?: string) => typeof value === "string" && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value) ? value : undefined;
  const width = section.contentWidth && section.contentWidth !== "default"
    ? { narrow: "800px", standard: "1200px", wide: "1440px", full: "none" }[section.contentWidth]
    : undefined;
  const blockPadding = section.spacing && section.spacing !== "default"
    ? { compact: "1rem 0.25rem", standard: "2rem 0.5rem", spacious: "3.5rem 1rem" }[section.spacing]
    : undefined;
  const background = validColor(section.bgColor) || (section.background === "surface"
    ? "var(--surface)"
    : section.background === "accent"
      ? "color-mix(in srgb, var(--primary) 8%, var(--bg))"
      : "transparent");
  const textColor = validColor(section.textColor);
  const headingSize = section.headingSize
    ? { small: "clamp(1.2rem, 1.8vw, 1.4rem)", standard: "clamp(1.5rem, 2.6vw, 1.875rem)", large: "clamp(1.75rem, 3.4vw, 2.5rem)" }[section.headingSize]
    : undefined;
  const bodyTextSize = section.bodyTextSize
    ? { small: "0.9rem", standard: "1rem", large: "1.125rem" }[section.bodyTextSize]
    : undefined;
  const lineHeight = section.lineHeight
    ? { compact: "1.45", standard: "1.7", relaxed: "1.9" }[section.lineHeight]
    : undefined;
  const textAlign = section.textAlign === "default"
    ? undefined
    : section.textAlign || ("align" in section ? section.align : undefined);

  return {
    background,
    ...(textColor ? { "--dy-section-custom-text-color": textColor } : {}),
    ...(width ? { "--dy-section-width": width } : {}),
    ...(blockPadding ? { "--dy-section-block-padding": blockPadding } : {}),
    ...(headingSize ? { "--dy-section-heading-size": headingSize } : {}),
    ...(bodyTextSize ? { "--dy-section-body-size": bodyTextSize } : {}),
    ...(lineHeight ? { "--dy-section-line-height": lineHeight } : {}),
    ...(textAlign ? { "--dy-section-text-align": textAlign } : {}),
  } as React.CSSProperties;
}

const DEFAULT_HERO_BG = "var(--bg)";

function heroBackground(hero: DynamicLayoutConfig["hero"]): string {
  return hero?.backgroundImage
    ? `linear-gradient(rgba(12, 10, 9, 0.62), rgba(12, 10, 9, 0.62)), url(${hero.backgroundImage}) center/cover no-repeat`
    : DEFAULT_HERO_BG;
}

export function HeroSection({ hero, colors, products, categories, forceTrigger }: { hero: DynamicLayoutConfig["hero"]; colors?: DynamicLayoutConfig["colors"]; products: Product[]; categories?: { id: string; label: string }[]; forceTrigger?: MotionTrigger }) {
  if (!hero || hero.enabled === false || hero.style === "none") return null;
  return (
    <Motion config={hero.animation} trigger={forceTrigger}>
      <HeroInner hero={hero} colors={colors} products={products} categories={categories} />
    </Motion>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 7.2l3.2 3.2 5.8-6.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TRUST_ITEMS = ["Delivery nationwide", "1-year repair warranty", "Authorized dealers"];

function TrustRow() {
  return (
    <div className="dy-hero-trust">
      {TRUST_ITEMS.map((t) => (
        <span key={t} className="dy-hero-trust-item">
          <CheckIcon />
          {t}
        </span>
      ))}
    </div>
  );
}

function ProductPanel({ item, interactive }: { item?: Product; interactive?: boolean }) {
  if (!item) return null;
  return (
    <a
      href={`/product?id=${item.id}`}
      className={`dy-hero-panel${interactive ? " dy-hero-panel--interactive" : ""}`}
      style={{ textDecoration: "none", color: "var(--text)" }}
      aria-label={`View ${item.name}`}
    >
      <span className="dy-hero-panel-tag">Featured</span>
      <div className={`dy-hero-panel-media${interactive ? " dy-hero-panel-media--stage" : ""}`}>
        {interactive ? (
          <>
            <div className="dy-hero-panel-media-backdrop" aria-hidden="true" />
            <div className="dy-hero-panel-media-inner">
              {item.imageUrl ? (
                <Media src={item.imageUrl} alt={item.name} width={640} height={360} fit="cover" fallbackLabel={item.name} />
              ) : (
                <span style={{ color: "var(--text-tertiary)", fontSize: "0.9rem" }}>{item.name}</span>
              )}
            </div>
          </>
        ) : item.imageUrl ? (
          <Media src={item.imageUrl} alt={item.name} width={640} height={360} fit="cover" fallbackLabel={item.name} />
        ) : (
          <span style={{ color: "var(--text-tertiary)", fontSize: "0.9rem" }}>{item.name}</span>
        )}
      </div>
      <div className="dy-hero-panel-foot">
        <span className="dy-hero-panel-name">{item.name}</span>
        <span className="dy-hero-panel-price">{formatPrice(item.salePrice || item.price)}</span>
      </div>
    </a>
  );
}

function HeroInner({ hero, colors, products }: { hero: DynamicLayoutConfig["hero"]; colors?: DynamicLayoutConfig["colors"]; products: Product[]; categories?: { id: string; label: string }[] }) {
  const heroActive = !!hero && hero.enabled !== false && hero.style !== "none";

  // Hooks run unconditionally so the Studio can toggle style/enabled without
  // tripping React's "hooks changed order" guard.
  const isCarousel = heroActive && hero.style !== "minimal" && hero.style !== "split";
  const [current, setCurrent] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const effects = heroEffectProfile(hero, reducedMotion);

  const selectedProducts = hero?.featuredCategory
    ? products.filter((p) => p.category === hero.featuredCategory)
    : products.some((p) => p.salePrice)
      ? products.filter((p) => p.salePrice)
      : products;
  const featuredRaw = hero?.featuredCategory
    ? selectedProducts.slice(0, 5)
    : [...selectedProducts]
        .map((product, index) => ({ product, index }))
        .sort((a, b) => {
          const coreDevice = /laptop|notebook|desktop|computer|\bpc\b|workstation|server|graphics card|gpu/i;
          return Number(coreDevice.test(b.product.category || "")) - Number(coreDevice.test(a.product.category || "")) || a.index - b.index;
        })
        .slice(0, 5)
        .map(({ product }) => product);
  const featured = isCarousel ? featuredRaw : featuredRaw.slice(0, 1);

  useEffect(() => {
    if (!isCarousel || featured.length <= 1 || reducedMotion) return;
    const t = setInterval(() => setCurrent((c) => (c + 1) % featured.length), 5000);
    return () => clearInterval(t);
  }, [isCarousel, featured.length, reducedMotion]);

  // Pointer effects share the Original-layout implementation: CSS custom
  // properties written off the render path, with the active hero variant as a
  // reset key so switching style re-binds to the current DOM node.
  useHeroPointerEffects(heroRef, effects.allowPointer, {
    tilt: effects.tilt,
    parallax: effects.parallax,
    spotlight: effects.spotlight,
    amplitude: effects.amplitude,
  }, hero?.style);

  if (!heroActive) return null;

  const isPhoto = !!hero.backgroundImage;
  const textColor = colors?.heroText || (isPhoto ? "#ffffff" : "inherit");
  const accent = colors?.accent || "var(--primary)";
  const heroTimeline = hero.animation?.preset === "hero-timeline" ? "hero-timeline" : undefined;
  // Skip the built-in entrance stagger when a Motion hero-timeline preset is
  // configured, so the two entrance systems never play on top of each other.
  const entranceOn = effects.entrance && !heroTimeline;
  const heroClass = [
    "dy-hero",
    isPhoto ? "dy-hero--photo" : "",
    heroTimeline || "",
    effects.interactive ? "dy-hero--interactive" : "",
    entranceOn ? "dy-hero--enter" : "",
  ].filter(Boolean).join(" ");
  const heroStyle: React.CSSProperties = isPhoto
    ? { backgroundImage: heroBackground(hero) }
    : colors?.heroBg
      ? { background: colors.heroBg }
      : {};

  const content = (
    <>
      {hero.badge && <div className="dy-hero-badge" data-fid="hero.badge">{hero.badge}</div>}
      <h1 className="dy-hero-headline" data-fid="hero.headline">{hero.headline || "Welcome to our store"}</h1>
      {hero.subtitle && <p className="dy-hero-sub" data-fid="hero.subtitle">{hero.subtitle}</p>}
      {(hero.ctaText || (hero.buttons || []).length > 0) && (
        <div className="dy-hero-cta-row">
          {hero.ctaText && (
            <DyLink className="dy-hero-btn dy-hero-btn--primary" href={hero.ctaLink} fid="hero.ctaText">{hero.ctaText}</DyLink>
          )}
          {(hero.buttons || []).map((b, i) => (
            <DyLink key={`${b.label}-${i}`} className="dy-hero-btn dy-hero-btn--secondary" href={b.link} fid={`hero.buttons.${i}.label`}>{b.label}</DyLink>
          ))}
        </div>
      )}
      <TrustRow />
    </>
  );

  const isMinimal = hero.style === "minimal";
  const item = isMinimal ? undefined : isCarousel ? featured[current % Math.max(featured.length, 1)] : featured[0];

  return (
    <div
      ref={heroRef}
      className={heroClass}
      style={{ ...heroStyle, color: textColor, ...(isMinimal ? { textAlign: "center" } : {}) }}
      data-fid="hero"
    >
      {effects.interactive && effects.parallax && <div className="dy-hero-bg-layer" aria-hidden="true" />}
      {effects.interactive && effects.spotlight && <div className="dy-hero-spotlight" aria-hidden="true" />}
      {isMinimal ? (
        <div className="dy-hero-content" style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {content}
        </div>
      ) : (
        <div className="dy-hero-inner">
          <div className="dy-hero-content">{content}</div>
          <div className="dy-hero-showcase">
            <ProductPanel item={item} interactive={effects.allowPointer} />
            {isCarousel && featured.length > 1 && (
              <div className="dy-hero-dots">
                {featured.map((_: unknown, i: number) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Go to slide ${i + 1}`}
                    className={i === current ? "dy-hero-dot is-active" : "dy-hero-dot"}
                    style={i === current ? { background: accent } : undefined}
                    onClick={() => setCurrent(i)}
                  />
                ))}
              </div>
            )}
          </div>
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
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden", transition: "transform 0.2s, box-shadow 0.2s" }}>
          {product.imageUrl && <Media src={product.imageUrl} alt={product.name} width={200} height={140} fit="contain" fallbackLabel={product.name} style={{ width: "100%", height: 140, objectFit: "contain", background: "var(--surface)" }} />}
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
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "0.75rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden", padding: "0.75rem", transition: "transform 0.2s, box-shadow 0.2s", alignItems: "center" }}>
          {product.imageUrl && <Media src={product.imageUrl} alt={product.name} width={200} height={120} fit="contain" fallbackLabel={product.name} style={{ width: "100%", height: 120, objectFit: "contain", background: "var(--surface)", borderRadius: "var(--radius-sm)" }} />}
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 4 }}>{product.category}</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>{product.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1rem", fontWeight: 700, color: priceColor }}>{formatPrice(showSale && product.salePrice ? product.salePrice : product.price)}</span>
              {showSale && product.salePrice && <span style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", textDecoration: "line-through" }}>{formatPrice(product.price)}</span>}
            </div>
            {showRating && product.rating && product.rating.count > 0 && (
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 4 }}>{"…"} {Number(product.rating.average).toFixed(1)}</div>
            )}
          </div>
        </div>
      </a>
    );
  }

  return (
    <a href={`/product?id=${product.id}`} style={{ display: "block", textDecoration: "none", color: "var(--text)" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden", transition: "transform 0.2s, box-shadow 0.2s" }}>
        {product.imageUrl && <Media src={product.imageUrl} alt={product.name} width={300} height={200} fit="contain" fallbackLabel={product.name} style={{ width: "100%", height: 200, objectFit: "contain", background: "var(--surface)" }} />}
        <div style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 4 }}>{product.category}</div>
          <div style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 6 }}>{product.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1rem", fontWeight: 700, color: priceColor }}>{formatPrice(showSale && product.salePrice ? product.salePrice : product.price)}</span>
            {showSale && product.salePrice && <span style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", textDecoration: "line-through" }}>{formatPrice(product.price)}</span>}
          </div>
          {showRating && product.rating && product.rating.count > 0 && (
            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 4 }}>{"…"} {Number(product.rating.average).toFixed(1)}</div>
          )}
        </div>
      </div>
    </a>
  );
}

function responsiveGridProps(
  section: { columns?: number; columnsTablet?: number; columnsMobile?: number }
): { className: string; style: React.CSSProperties } | null {
  if (!section.columns && !section.columnsTablet && !section.columnsMobile) return null;
  return {
    className: "sb-responsive-grid",
    style: {
      ...(section.columns ? { "--cols-d": section.columns } : {}),
      ...(section.columnsTablet ? { "--cols-t": section.columnsTablet } : {}),
      ...(section.columnsMobile ? { "--cols-m": section.columnsMobile } : {}),
    } as React.CSSProperties,
  };
}

// Feature-gated storefront block. It only renders when the shop both owns the
// "Lipa Mdogo Mdogo" entitlement and has financing activated (the server
// resolves effective access at /api/financing/options). No amounts are shown,
// so nothing is fabricated if the block is viewed without financing.
function FinancingPromo({ section, fid }: { section: Extract<DynamicSection, { type: "financing-promo" }>; fid?: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ enabled?: boolean }>("/api/financing/options")
      .then((o) => { if (alive) setEnabled(!!o?.enabled); })
      .catch(() => { if (alive) setEnabled(false); });
    return () => { alive = false; };
  }, []);
  if (!enabled) return null;
  return (
    <div style={{ paddingBlock: "var(--dy-section-block-padding, 2rem)", paddingInline: "1rem", maxWidth: "var(--dy-section-width, 1000px)", margin: "0 auto" }}>
      <div style={{ background: "var(--primary-subtle)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "1.75rem", textAlign: SECTION_TEXT_ALIGN_CENTER }}>
        {section.title && <h2 style={{ fontSize: "var(--dy-section-heading-size, 1.35rem)", fontWeight: HEADING_WEIGHT, margin: "0 0 0.5rem" }} data-fid={fid ? `${fid}.title` : undefined}>{section.title}</h2>}
        {section.content && <p style={{ color: "var(--dy-section-custom-text-color, var(--text-secondary))", margin: "0 0 1rem", fontSize: "var(--dy-section-body-size, 1rem)", lineHeight: "var(--dy-section-line-height, 1.6)" }} data-fid={fid ? `${fid}.content` : undefined}>{section.content}</p>}
        {section.ctaText && <DyLink className="btn btn-primary" href={section.ctaLink || "/financing"} fid={fid ? `${fid}.ctaText` : undefined}>{section.ctaText}</DyLink>}
      </div>
    </div>
  );
}

function DynamicSectionInner({ section, products, categories, colors, cardConfig, fid }: { section: DynamicSection; products: Product[]; categories: { id: string; label: string }[]; colors?: DynamicLayoutConfig["colors"]; cardConfig?: DynamicLayoutConfig["productCard"]; fid?: string }) {
  if (section.type === "product-grid") {
    let filtered = [...products];
    if (section.productFilter === "featured") filtered = filtered.filter((p) => p.imageUrl);
    if (section.productFilter === "sale") filtered = filtered.filter((p) => p.salePrice);
    if (section.productFilter === "newest") filtered = [...filtered].reverse();
    if (section.limit) filtered = filtered.slice(0, section.limit);
    const stagger = section.animation?.preset === "stagger";
    const grid = responsiveGridProps(section);
    return (
      <div style={{ paddingBlock: "var(--dy-section-block-padding, 2rem 0.5rem)", paddingInline: "2rem", maxWidth: "var(--dy-section-width, 1440px)", margin: "0 auto" }}>
        {section.title && <h2 style={{ fontSize: "var(--dy-section-heading-size, 1.5rem)", fontWeight: HEADING_WEIGHT, marginBottom: "1rem", textAlign: SECTION_TEXT_ALIGN_LEFT }} data-fid={fid ? `${fid}.title` : undefined}>{section.title}</h2>}
        {filtered.length === 0 ? (
          <p style={{ color: "var(--text-tertiary)", padding: "1rem 0" }}>No products match this filter yet.</p>
        ) : (
          <div
            className={grid ? grid.className : undefined}
            style={grid ? grid.style : { display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(min(${section.columns && section.columns > 3 ? 240 : 280}px, 100%), 1fr))`, gap: "1rem" }}
          >
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
    const stagger = section.animation?.preset === "stagger";
    const grid = responsiveGridProps(section);
    const cellStyle: React.CSSProperties = {
      display: "block", textDecoration: "none", color: "var(--dy-section-custom-text-color, var(--text))", background: "var(--surface)",
      border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: section.style === "icons" ? "1.25rem" : "1.5rem",
      textAlign: "center", transition: "transform 0.2s, border-color 0.2s",
    };
    return (
      <div style={{ paddingBlock: "var(--dy-section-block-padding, 2rem 0.5rem)", paddingInline: "2rem", maxWidth: "var(--dy-section-width, 1440px)", margin: "0 auto" }}>
        {section.title && <h2 style={{ fontSize: "var(--dy-section-heading-size, 1.5rem)", fontWeight: HEADING_WEIGHT, marginBottom: "1rem", textAlign: SECTION_TEXT_ALIGN_LEFT }} data-fid={fid ? `${fid}.title` : undefined}>{section.title}</h2>}
        {categories.length === 0 ? (
          <p style={{ color: "var(--text-tertiary)", padding: "1rem 0" }}>No categories yet.</p>
        ) : (
          <div
            className={grid ? grid.className : undefined}
            style={grid ? grid.style : { display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(min(${section.style === "icons" ? 120 : 220}px, 100%), 1fr))`, gap: "1rem" }}
          >
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
      <div style={{ margin: "1.5rem auto", maxWidth: "var(--dy-section-width, 1440px)", paddingBlock: "var(--dy-section-block-padding, 0)", paddingInline: "2rem" }} data-fid={fid}>
        <DyLink href={section.link} style={{ display: "block", background: section.bgColor || "var(--primary-subtle)", borderRadius: "var(--radius-md)", overflow: "hidden", textDecoration: "none", color: "inherit" }}>
          {section.imageUrl ? (
            <div style={{ position: "relative" }}>
              <Media src={section.imageUrl} alt={section.text || ""} width={1200} height={200} fit="cover" fallbackLabel="Section image" style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} />
              {(section.text || section.buttonLabel) && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem", background: "rgba(0,0,0,0.35)", color: section.textColor || "#fff" }}>
                  {section.text && <div style={{ fontSize: "var(--dy-section-heading-size, 1.2rem)", fontWeight: HEADING_WEIGHT, textAlign: SECTION_TEXT_ALIGN_CENTER }} data-fid={fid ? `${fid}.text` : undefined}>{section.text}</div>}
                  {section.buttonLabel && <span style={{ background: "var(--primary)", color: "var(--on-primary)", padding: "0.5rem 1.4rem", borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: "0.9rem" }} data-fid={fid ? `${fid}.buttonLabel` : undefined}>{section.buttonLabel}</span>}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: "2rem", textAlign: "center", color: section.textColor || "var(--text)", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
              {section.text && <div style={{ fontSize: "var(--dy-section-heading-size, 1.2rem)", fontWeight: SUBHEAD_WEIGHT, textAlign: SECTION_TEXT_ALIGN_CENTER }} data-fid={fid ? `${fid}.text` : undefined}>{section.text}</div>}
              {section.buttonLabel && <span style={{ background: "var(--primary)", color: "var(--on-primary)", padding: "0.5rem 1.4rem", borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: "0.9rem" }} data-fid={fid ? `${fid}.buttonLabel` : undefined}>{section.buttonLabel}</span>}
            </div>
          )}
        </DyLink>
      </div>
    );
  }

  if (section.type === "stats") {
    const stagger = section.animation?.preset === "stagger";
    return (
      <div style={{ paddingBlock: "var(--dy-section-block-padding, 2rem 0.5rem)", paddingInline: "2rem", maxWidth: "var(--dy-section-width, 1440px)", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 100%), 1fr))", gap: "1rem" }}>
          {(section.items || []).map((item, j) => (
            <div key={j} className={stagger ? "motion-child" : undefined} style={{ textAlign: "center", padding: "1.5rem 1rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", ...(stagger ? motionGroupItemVars(j) : {}) }}>
              {item.icon && <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>{item.icon}</div>}
              <div style={{ fontSize: "1.8rem", fontWeight: HEADING_WEIGHT, color: colors?.accent || "var(--primary)" }} data-fid={fid ? `${fid}.items.${j}.value` : undefined}>{item.value}</div>
              <div style={{ fontSize: "var(--dy-section-body-size, 0.85rem)", lineHeight: "var(--dy-section-line-height, 1.4)", color: "var(--dy-section-custom-text-color, var(--text-secondary))", marginTop: 4 }} data-fid={fid ? `${fid}.items.${j}.label` : undefined}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section.type === "text") {
    return (
      <div style={{ paddingBlock: "var(--dy-section-block-padding, 2rem 0.5rem)", paddingInline: "2rem", maxWidth: "var(--dy-section-width, 800px)", margin: "0 auto", textAlign: SECTION_TEXT_ALIGN_CENTER }} data-fid={fid}>
        {section.title && <h2 style={{ fontSize: "var(--dy-section-heading-size, 1.5rem)", fontWeight: HEADING_WEIGHT, marginBottom: "0.75rem" }} data-fid={fid ? `${fid}.title` : undefined}>{section.title}</h2>}
        {section.content && <p style={{ fontSize: "var(--dy-section-body-size, 1rem)", color: "var(--dy-section-custom-text-color, var(--text-secondary))", lineHeight: "var(--dy-section-line-height, 1.7)" }} data-fid={fid ? `${fid}.content` : undefined}>{section.content}</p>}
      </div>
    );
  }

  if (section.type === "button") {
    const sizePad = section.size === "lg" ? "0.9rem 2.4rem" : section.size === "sm" ? "0.5rem 1.2rem" : "0.7rem 1.8rem";
    const sizeFont = section.size === "lg" ? "1.05rem" : section.size === "sm" ? "0.82rem" : "0.95rem";
    const base: React.CSSProperties = {
      display: "inline-block", padding: sizePad, borderRadius: "var(--radius-sm)", fontWeight: 600, textDecoration: "none", fontSize: sizeFont,
      cursor: "pointer",
    };
    const style = section.variant === "outline"
      ? { ...base, border: `1.5px solid var(--primary)`, color: "var(--primary)", background: "transparent" }
      : section.variant === "secondary"
        ? { ...base, border: "1px solid var(--border)", color: "var(--text)", background: "var(--surface)" }
        : { ...base, border: "1px solid var(--primary)", color: "var(--on-primary)", background: "var(--primary)" };
    return (
      <div style={{ paddingBlock: "var(--dy-section-block-padding, 1rem)", paddingInline: "2rem", maxWidth: "var(--dy-section-width, 1440px)", margin: "0 auto", textAlign: SECTION_TEXT_ALIGN_CENTER }} data-fid={fid}>
        {section.label ? <DyLink href={section.link} style={style} fid={fid ? `${fid}.label` : undefined}>{section.label}</DyLink> : <span style={{ color: "var(--text-tertiary)", fontSize: "0.85rem" }}>Button â€” set a label</span>}
      </div>
    );
  }

  if (section.type === "image") {
    return (
      <div style={{ paddingBlock: "var(--dy-section-block-padding, 1.5rem)", paddingInline: "2rem", maxWidth: "var(--dy-section-width, 1440px)", margin: "0 auto", textAlign: "center" }} data-fid={fid}>
        {section.imageUrl ? (
          <DyLink href={section.link} style={{ textDecoration: "none", color: "inherit", display: "inline-block" }}>
          <Media src={section.imageUrl} alt={section.alt || section.caption || ""} width={1200} height={480} fit="contain" fallbackLabel="Image" style={{ maxWidth: "100%", maxHeight: 480, width: section.maxWidth ? section.maxWidth : undefined, borderRadius: section.rounded ? "var(--radius-lg)" : 0, objectFit: "contain" }} />
          </DyLink>
        ) : (
          <div style={{ border: "2px dashed var(--border)", borderRadius: "var(--radius-md)", padding: "3rem", color: "var(--text-tertiary)" }}>Image â€” add an image URL</div>
        )}
        {section.caption && <p style={{ fontSize: "0.85rem", color: "var(--dy-section-custom-text-color, var(--text-secondary))", marginTop: "0.5rem" }} data-fid={fid ? `${fid}.caption` : undefined}>{section.caption}</p>}
      </div>
    );
  }

  if (section.type === "image-text") {
    return (
      <section className="dy-image-text" style={{ paddingBlock: "var(--dy-section-block-padding, clamp(2rem, 5vw, 4rem))" }} data-fid={fid}>
        <div className={`dy-image-text__inner${section.imageSide === "right" ? " dy-image-text__inner--image-right" : ""}`}>
          <div className="dy-image-text__media">
            {section.imageUrl ? (
              <Media src={section.imageUrl} alt={section.alt || ""} width={900} height={700} fit="cover" fallbackLabel={section.title || "Section image"} />
            ) : (
              <div className="dy-image-text__placeholder">Choose an image for this section</div>
            )}
          </div>
          <div className="dy-image-text__copy">
            {section.title && <h2 data-fid={fid ? `${fid}.title` : undefined}>{section.title}</h2>}
            {section.content && <p data-fid={fid ? `${fid}.content` : undefined}>{section.content}</p>}
            {section.ctaText && <DyLink className="btn btn-primary" href={section.ctaLink || "/"} fid={fid ? `${fid}.ctaText` : undefined}>{section.ctaText}</DyLink>}
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "features") {
    const stagger = section.animation?.preset === "stagger";
    const grid = responsiveGridProps(section);
    return (
      <div style={{ paddingBlock: "var(--dy-section-block-padding, 2rem 0.5rem)", paddingInline: "2rem", maxWidth: "var(--dy-section-width, 1440px)", margin: "0 auto" }}>
        {section.title && <h2 style={{ fontSize: "var(--dy-section-heading-size, 1.5rem)", fontWeight: HEADING_WEIGHT, marginBottom: "1rem", textAlign: SECTION_TEXT_ALIGN_CENTER }} data-fid={fid ? `${fid}.title` : undefined}>{section.title}</h2>}
        <div
          className={grid ? grid.className : undefined}
          style={grid ? grid.style : { display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(min(${section.columns && section.columns > 3 ? 200 : 260}px, 100%), 1fr))`, gap: "1rem" }}
        >
          {(section.items || []).map((item, j) => (
            <div key={j} className={stagger ? "motion-child" : undefined} style={{ padding: "1.5rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", textAlign: "center", ...(stagger ? motionGroupItemVars(j) : {}) }}>
              {item.icon && <div style={{ fontSize: "1.8rem", marginBottom: "0.6rem" }}>{item.icon}</div>}
              {item.title && <div style={{ fontWeight: HEADING_WEIGHT, marginBottom: "0.4rem" }} data-fid={fid ? `${fid}.items.${j}.title` : undefined}>{item.title}</div>}
              {item.text && <div style={{ fontSize: "var(--dy-section-body-size, 0.88rem)", color: "var(--dy-section-custom-text-color, var(--text-secondary))", lineHeight: "var(--dy-section-line-height, 1.6)" }} data-fid={fid ? `${fid}.items.${j}.text` : undefined}>{item.text}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section.type === "spacer") {
    return <div style={{ height: section.height ?? 40 }} />;
  }

  if (section.type === "financing-promo") {
    return <FinancingPromo section={section} fid={fid} />;
  }

  return null;
}

export interface DynamicSectionViewProps {
  section: DynamicSection;
  products: Product[];
  categories: { id: string; label: string }[];
  colors?: DynamicLayoutConfig["colors"];
  cardConfig?: DynamicLayoutConfig["productCard"];
  forceTrigger?: MotionTrigger;
  index?: number;
}

export function DynamicSectionView({ section, products, categories, colors, cardConfig, forceTrigger, index }: DynamicSectionViewProps) {
  const sectionFid = index !== undefined ? `sections.${index}` : undefined;
  const hideOnMobile = (section as { hideOnMobile?: boolean }).hideOnMobile;
  const innerFid = sectionFid || undefined;
  return (
    <div data-fid={sectionFid} className={hideOnMobile ? "sb-hide-mobile" : undefined} style={studioSectionStyle(section)}>
      <Motion config={section.animation} trigger={forceTrigger}>
        <DynamicSectionInner section={section} products={products} categories={categories} colors={colors} cardConfig={cardConfig} fid={innerFid} />
      </Motion>
    </div>
  );
}

export function DynamicHomePage({ products, categories, banners, config }: { products: Product[]; categories: { id: string; label: string }[]; banners: any[]; config: DynamicLayoutConfig }) {
  const colors = config.colors;
  const cardConfig = config.productCard;
  const defaultIntensity = config.tokens?.motionIntensity;
  const sections = (config.sections || []).map((section) =>
    section.animation && defaultIntensity
      ? { ...section, animation: { ...section.animation, intensity: section.animation.intensity || defaultIntensity } }
      : section
  );

  return (
    <div className="dynamic-layout">
      <HeroSection hero={config.hero} colors={colors} products={products} categories={categories} />
      {sections.map((section, i) => (
        <div key={(section as { id?: string }).id || i}>
          <DynamicSectionView section={section} products={products} categories={categories} colors={colors} cardConfig={cardConfig} index={i} />
        </div>
      ))}
    </div>
  );
}

// Self-hosted font stacks only — no external font loading, so a template can
// carry a distinct typographic identity without a network dependency or a
// licence obligation. Every family listed ships with Windows/macOS/Linux.
const FONT_STACKS = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

// Scoped storefront design tokens. Emitted as CSS custom properties on
// `.dynamic-layout` so the engine's `var(--radius-*)` / `var(--primary)` values
// pick them up without leaking to the rest of the app. Values are re-validated
// here because this string is injected into a <style> tag.
export function DynamicLayoutStyles({ tokens }: { tokens?: DynamicLayoutConfig["tokens"] }) {
  const radius = typeof tokens?.radius === "number" ? Math.max(0, Math.min(24, Math.round(tokens.radius))) : undefined;
  const hex = /^#[0-9a-fA-F]{3,8}$/;
  const accent = tokens?.accent && hex.test(tokens.accent) ? tokens.accent : undefined;
  const onAccent = tokens?.onAccent && hex.test(tokens.onAccent) ? tokens.onAccent : undefined;

  // Typography tokens. Each is clamped/re-validated here; unknown font keys are
  // dropped so only the fixed stacks above can ever reach the <style> tag.
  const headingFont = tokens?.headingFont && tokens.headingFont in FONT_STACKS ? FONT_STACKS[tokens.headingFont] : undefined;
  const bodyFont = tokens?.bodyFont && tokens.bodyFont in FONT_STACKS ? FONT_STACKS[tokens.bodyFont] : undefined;
  const headingWeight = typeof tokens?.headingWeight === "number" && Number.isFinite(tokens.headingWeight)
    ? Math.max(100, Math.min(900, Math.round(tokens.headingWeight / 100) * 100)) : undefined;
  const headingCase = tokens?.headingCase === "uppercase" ? "uppercase" : tokens?.headingCase === "none" ? "none" : undefined;
  const headingTracking = typeof tokens?.headingTracking === "number" && Number.isFinite(tokens.headingTracking)
    ? Math.round(Math.max(-0.05, Math.min(0.25, tokens.headingTracking)) * 1000) / 1000 : undefined;

  const decls: string[] = [];
  if (radius !== undefined) {
    decls.push(`--radius-sm: ${radius}px;`, `--radius-md: ${radius + 2}px;`, `--radius-lg: ${radius + 4}px;`);
  }
  if (accent) decls.push(`--primary: ${accent};`);
  if (onAccent) decls.push(`--on-primary: ${onAccent};`);
  if (headingFont) decls.push(`--dy-font-heading: ${headingFont};`);
  if (bodyFont) decls.push(`--dy-font-body: ${bodyFont};`);
  if (headingWeight !== undefined) decls.push(`--dy-heading-weight: ${headingWeight};`);
  if (headingCase !== undefined) decls.push(`--dy-heading-case: ${headingCase};`);
  if (headingTracking !== undefined) decls.push(`--dy-heading-tracking: ${headingTracking}em;`);
  const scope = decls.length ? `.dynamic-layout { ${decls.join(" ")} }` : "";

  // Typography rules are only added for the tokens a template actually sets, so
  // a layout with no typography tokens renders byte-identically to before.
  const rules: string[] = [];
  if (bodyFont) rules.push(`.dynamic-layout { font-family: var(--dy-font-body); }`);
  if (headingFont) rules.push(`.dynamic-layout h1, .dynamic-layout h2 { font-family: var(--dy-font-heading); }`);
  const headingParts: string[] = [];
  if (headingWeight !== undefined) headingParts.push(`font-weight: var(--dy-heading-weight, 700);`);
  if (headingCase !== undefined) headingParts.push(`text-transform: var(--dy-heading-case, none);`);
  if (headingTracking !== undefined) headingParts.push(`letter-spacing: var(--dy-heading-tracking, normal);`);
  if (headingParts.length) rules.push(`.dynamic-layout h1, .dynamic-layout h2 { ${headingParts.join(" ")} }`);

  return (
    <style>{`
      ${scope}
      ${rules.join("\n      ")}
      .dynamic-layout a:hover { opacity: 0.9; }
      @media (max-width: 768px) {
        .dynamic-layout [style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
      }
    `}</style>
  );
}
