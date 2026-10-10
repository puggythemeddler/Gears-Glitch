import type { HeroEffectsConfig } from "./hero-effects";
import { HERO_EFFECTS_DEFAULT } from "./hero-effects";

/**
 * Gears&Glitch storefront template library.
 *
 * A template is a pure presentation preset for the Dynamic Engine: hero copy,
 * section structure, colour palette and design tokens. Applying one can never
 * touch business data (products, prices, stock, orders, customers) — those live
 * in the database and are never referenced here.
 *
 * Every template is an original Gears&Glitch design. There are no third-party
 * themes, fonts, icon packs or stock assets: image slots ship empty and the
 * merchant drops in their own media, so no external licence is ever implied.
 * The machine-readable inventory lives in `TEMPLATE_LICENSING`.
 */

export const TEMPLATE_LIBRARY_VERSION = 1;

export const TEMPLATE_CATEGORIES = ["general", "electronics", "commerce", "luxe"] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  general: "Everyday",
  electronics: "Tech",
  commerce: "Commerce",
  luxe: "Luxe",
};

/** Section types a template may contain — mirrors the Dynamic Engine union. */
export const TEMPLATE_SECTION_TYPES = [
  "product-grid",
  "category-grid",
  "banner",
  "stats",
  "text",
  "button",
  "image",
  "features",
  "spacer",
  "financing-promo",
] as const;
export type TemplateSectionType = (typeof TEMPLATE_SECTION_TYPES)[number];

export const TEMPLATE_HERO_STYLES = ["carousel", "split", "minimal", "none"] as const;

/**
 * Structural mirror of the Dynamic Engine's `DynamicLayoutConfig`. Kept local and
 * alias-free so the pure template module can be unit-tested and type-checked
 * outside the Next.js project (the root tsconfig has no `@/*` path mapping).
 */
export interface TemplateSection {
  type: string;
  id?: string;
  hideOnMobile?: boolean;
  [key: string]: unknown;
}

export interface TemplateLayoutConfig {
  hero?: {
    enabled?: boolean;
    style?: (typeof TEMPLATE_HERO_STYLES)[number];
    badge?: string;
    headline?: string;
    subtitle?: string;
    ctaText?: string;
    ctaLink?: string;
    buttons?: { label: string; link: string; variant?: string }[];
    backgroundImage?: string;
    featuredCategory?: string;
    animation?: unknown;
    effects?: Partial<HeroEffectsConfig> | null;
  };
  sections?: TemplateSection[];
  productCard?: { style?: string; showRating?: boolean; showSalePrice?: boolean };
  colors?: { heroBg?: string; heroText?: string; accent?: string };
  tokens?: { radius?: number; accent?: string; onAccent?: string; motionIntensity?: string };
  templateId?: string;
  templateVersion?: number;
}

export interface TemplateLicense {
  origin: "original";
  holder: string;
  spdx: string;
  /** Third-party assets. Always empty: templates ship no bundled media. */
  assets: { name: string; source: string; license: string }[];
}

export interface TemplatePalette {
  bg: string;
  surface: string;
  text: string;
  accent: string;
  accentText: string;
}

export interface StorefrontTemplate {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  version: number;
  layoutType: "dynamic";
  requiresEntitlement?: "financing";
  license: TemplateLicense;
  palette: TemplatePalette;
  config: TemplateLayoutConfig;
}

const ORIGINAL_LICENSE: TemplateLicense = {
  origin: "original",
  holder: "Gears & Glitch",
  spdx: "LicenseRef-GearsGlitch-Original",
  assets: [],
};

const DEFAULT_EFFECTS = { ...HERO_EFFECTS_DEFAULT };

/** Deep, JSON-safe clone of a template config. Templates are plain data. */
export function cloneConfig(config: TemplateLayoutConfig): TemplateLayoutConfig {
  return JSON.parse(JSON.stringify(config)) as TemplateLayoutConfig;
}

let idSeq = 0;
function defaultSectionId(): string {
  idSeq += 1;
  return "tpl-" + Date.now().toString(36) + "-" + idSeq;
}

/**
 * Produce a fresh, editable config from a template. Section ids are regenerated
 * so two templates applied in a row never collide in the canvas, and the caller
 * gets a mutable copy it can freely edit.
 */
export function instantiateTemplateConfig(
  template: StorefrontTemplate,
  makeId: () => string = defaultSectionId,
): TemplateLayoutConfig {
  const config = cloneConfig(template.config);
  if (Array.isArray(config.sections)) {
    config.sections = config.sections.map((s) => ({ ...s, id: makeId() }));
  }
  return config;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Validate a single template. Returns a list of human-readable problems; an
 * empty list means the template is safe to register and apply. The Studio
 * gallery runs this before offering a template to a merchant.
 */
export function validateTemplate(t: unknown): string[] {
  const problems: string[] = [];
  if (!isPlainObject(t)) return ["template is not an object"];

  if (!isNonEmptyString(t.id)) problems.push("id must be a non-empty string");
  if (!isNonEmptyString(t.name)) problems.push("name must be a non-empty string");
  if (!isNonEmptyString(t.tagline)) problems.push("tagline must be a non-empty string");
  if (!isNonEmptyString(t.description)) problems.push("description must be a non-empty string");
  if (!TEMPLATE_CATEGORIES.includes(t.category as TemplateCategory)) problems.push(`unknown category: ${String(t.category)}`);
  if (typeof t.version !== "number" || !Number.isInteger(t.version) || (t.version as number) < 1) problems.push("version must be a positive integer");
  if (t.layoutType !== "dynamic") problems.push('layoutType must be "dynamic"');
  if (t.requiresEntitlement !== undefined && t.requiresEntitlement !== "financing") problems.push(`unknown entitlement: ${String(t.requiresEntitlement)}`);
  if (!Array.isArray(t.tags) || !t.tags.every(isNonEmptyString)) problems.push("tags must be an array of strings");

  if (!isPlainObject(t.license) || (t.license as Record<string, unknown>).origin !== "original") {
    problems.push('license.origin must be "original"');
  }

  if (!isPlainObject(t.palette)) {
    problems.push("palette is required");
  } else {
    for (const key of ["bg", "surface", "text", "accent", "accentText"] as const) {
      if (!isNonEmptyString((t.palette as Record<string, unknown>)[key])) problems.push(`palette.${key} must be a string`);
    }
  }

  const config = t.config;
  if (!isPlainObject(config)) {
    problems.push("config is required");
    return problems;
  }

  const hero = config.hero;
  if (hero !== undefined) {
    if (!isPlainObject(hero)) problems.push("config.hero must be an object");
    else if (hero.style !== undefined && !TEMPLATE_HERO_STYLES.includes(hero.style as (typeof TEMPLATE_HERO_STYLES)[number])) {
      problems.push(`config.hero.style is not allowed: ${String(hero.style)}`);
    }
  }

  const sections = config.sections;
  if (sections !== undefined) {
    if (!Array.isArray(sections)) {
      problems.push("config.sections must be an array");
    } else {
      sections.forEach((s, i) => {
        if (!isPlainObject(s) || !isNonEmptyString(s.type)) {
          problems.push(`config.sections[${i}] must have a type`);
        } else if (!TEMPLATE_SECTION_TYPES.includes(s.type as TemplateSectionType)) {
          problems.push(`config.sections[${i}] has unknown type: ${String(s.type)}`);
        }
      });
    }
  }

  return problems;
}

/** Validate a whole registry: every template valid plus no duplicate ids. */
export function validateTemplateRegistry(list: StorefrontTemplate[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const t of list) {
    problems.push(...validateTemplate(t));
    if (isPlainObject(t) && isNonEmptyString(t.id)) {
      if (seen.has(t.id)) problems.push(`duplicate template id: ${t.id}`);
      seen.add(t.id);
    }
  }
  return problems;
}

export const TEMPLATE_REGISTRY: StorefrontTemplate[] = [
  {
    id: "tech-grid",
    name: "Tech Grid",
    tagline: "Bold, dark-storefront for electronics",
    description: "A high-contrast grid built for hardware stores: category tiles, a featured product grid, service highlights and a clean arrival banner.",
    category: "electronics",
    tags: ["tech", "electronics", "dark", "grid", "gadgets"],
    version: 1,
    layoutType: "dynamic",
    license: ORIGINAL_LICENSE,
    palette: { bg: "#0b1220", surface: "#111a2e", text: "#e6ecf7", accent: "#3b82f6", accentText: "#ffffff" },
    config: {
      hero: {
        enabled: true,
        style: "split",
        badge: "New season tech",
        headline: "Gear that keeps up",
        subtitle: "Laptops, desktops and accessories curated for work and play.",
        ctaText: "Shop all",
        ctaLink: "/",
        effects: DEFAULT_EFFECTS,
      },
      colors: { heroBg: "#0b1220", heroText: "#e6ecf7", accent: "#3b82f6" },
      tokens: { radius: 8, accent: "#3b82f6", onAccent: "#ffffff" },
      productCard: { style: "default", showRating: true, showSalePrice: true },
      sections: [
        { type: "category-grid", title: "Shop by category", columns: 4, style: "cards" },
        { type: "product-grid", title: "Featured gear", productFilter: "featured", columns: 4, limit: 8 },
        { type: "features", title: "Why buy from us", columns: 3, items: [
          { title: "Genuine products", text: "Sourced from official distributors." },
          { title: "Fast delivery", text: "Nationwide, Nairobi within 24h." },
          { title: "Warranty", text: "Covered on every item we sell." },
        ] },
        { type: "stats", items: [
          { value: "Free", label: "Nationwide delivery" },
          { value: "1-yr", label: "Repair warranty" },
          { value: "24/7", label: "Support" },
        ] },
        { type: "banner", text: "New arrivals in stock now", buttonLabel: "Browse new", buttonLink: "/" },
      ],
    },
  },
  {
    id: "minimal-luxe",
    name: "Minimal Luxe",
    tagline: "Quiet, editorial and premium",
    description: "Generous whitespace, a restrained palette and few sections. Best for curated ranges where each product should breathe.",
    category: "luxe",
    tags: ["minimal", "premium", "editorial", "fashion", "clean"],
    version: 1,
    layoutType: "dynamic",
    license: ORIGINAL_LICENSE,
    palette: { bg: "#faf9f7", surface: "#ffffff", text: "#1c1917", accent: "#a17e4b", accentText: "#ffffff" },
    config: {
      hero: {
        enabled: true,
        style: "minimal",
        headline: "Considered essentials",
        subtitle: "A small collection, made to last.",
        ctaText: "Explore the collection",
        ctaLink: "/",
        effects: { ...DEFAULT_EFFECTS, intensity: "subtle" },
      },
      colors: { heroBg: "#faf9f7", heroText: "#1c1917", accent: "#a17e4b" },
      tokens: { radius: 2, accent: "#a17e4b", onAccent: "#ffffff" },
      productCard: { style: "compact", showRating: false, showSalePrice: true },
      sections: [
        { type: "text", title: "Our approach", content: "We keep a deliberately small range so every piece earns its place.", align: "center" },
        { type: "product-grid", title: "The collection", productFilter: "featured", columns: 3, limit: 6 },
        { type: "spacer", height: 64 },
        { type: "image", imageUrl: "", alt: "Editorial image", caption: "", rounded: false },
        { type: "spacer", height: 32 },
        { type: "text", content: "Questions about sizing or delivery? We're happy to help.", align: "center" },
      ],
    },
  },
  {
    id: "bold-commerce",
    name: "Bold Commerce",
    tagline: "High-energy promotion-driven storefront",
    description: "Banner-led layout with an expressive carousel, category icons, a sale grid and a financing call-to-action for shops that offer instalments.",
    category: "commerce",
    tags: ["promotions", "sale", "bold", "retail", "financing"],
    version: 1,
    layoutType: "dynamic",
    requiresEntitlement: "financing",
    license: ORIGINAL_LICENSE,
    palette: { bg: "#ffffff", surface: "#fdf2f8", text: "#111827", accent: "#ec4899", accentText: "#ffffff" },
    config: {
      hero: {
        enabled: true,
        style: "carousel",
        badge: "Deals of the week",
        headline: "Bold prices, big selection",
        subtitle: "Shop the categories everyone is talking about.",
        ctaText: "Shop deals",
        ctaLink: "/",
        effects: { ...DEFAULT_EFFECTS, intensity: "expressive" },
      },
      colors: { heroBg: "#ffffff", heroText: "#111827", accent: "#ec4899" },
      tokens: { radius: 14, accent: "#ec4899", onAccent: "#ffffff" },
      productCard: { style: "detailed", showRating: true, showSalePrice: true },
      sections: [
        { type: "banner", text: "Limited-time offers", bgColor: "#ec4899", textColor: "#ffffff", buttonLabel: "Shop now", buttonLink: "/" },
        { type: "category-grid", title: "Shop by category", columns: 4, style: "icons" },
        { type: "product-grid", title: "On sale now", productFilter: "sale", columns: 4, limit: 8 },
        { type: "features", title: "Shop with confidence", columns: 3, items: [
          { title: "Secure checkout", text: "Pay with M-Pesa or card." },
          { title: "Fast dispatch", text: "Orders leave the same day." },
          { title: "Easy returns", text: "Covered by our warranty." },
        ] },
        { type: "financing-promo", title: "Pay in easy instalments", content: "Take it home today and pay weekly or monthly.", ctaText: "Learn about financing", ctaLink: "/financing" },
      ],
    },
  },
  {
    id: "everyday-store",
    name: "Everyday Store",
    tagline: "Balanced, dependable and ready to sell",
    description: "A safe, well-balanced default: friendly hero, benefit strip, featured products, categories and a clear contact call-to-action.",
    category: "general",
    tags: ["general", "balanced", "starter", "everyday", "retail"],
    version: 1,
    layoutType: "dynamic",
    license: ORIGINAL_LICENSE,
    palette: { bg: "#ffffff", surface: "#f0fdfa", text: "#134e4a", accent: "#0d9488", accentText: "#ffffff" },
    config: {
      hero: {
        enabled: true,
        style: "split",
        headline: "Everyday value, every day",
        subtitle: "Quality products at prices that make sense.",
        ctaText: "Start shopping",
        ctaLink: "/",
        effects: { ...DEFAULT_EFFECTS },
      },
      colors: { heroBg: "#f0fdfa", heroText: "#134e4a", accent: "#0d9488" },
      tokens: { radius: 10, accent: "#0d9488", onAccent: "#ffffff" },
      productCard: { style: "default", showRating: true, showSalePrice: true },
      sections: [
        { type: "features", title: "Why shop with us", columns: 3, items: [
          { title: "Genuine products", text: "Authentic items from trusted suppliers." },
          { title: "Fast delivery", text: "Nationwide, Nairobi within 24h." },
          { title: "Friendly support", text: "Here to help before and after you buy." },
        ] },
        { type: "product-grid", title: "Featured products", productFilter: "featured", columns: 4, limit: 8 },
        { type: "category-grid", title: "Browse categories", columns: 4, style: "cards" },
        { type: "text", title: "Need a hand?", content: "Message us and a real person will get back to you.", align: "center" },
        { type: "button", label: "Contact us", link: "/contact", variant: "primary", align: "center", size: "md" },
      ],
    },
  },
];

/** Machine-readable licence + asset inventory for governance. */
export const TEMPLATE_LICENSING = TEMPLATE_REGISTRY.map((t) => ({
  id: t.id,
  name: t.name,
  version: t.version,
  origin: t.license.origin,
  holder: t.license.holder,
  spdx: t.license.spdx,
  bundledAssets: t.license.assets.length,
}));

const TEMPLATE_BY_ID = new Map<string, StorefrontTemplate>(TEMPLATE_REGISTRY.map((t) => [t.id, t]));

export function getTemplate(id: string): StorefrontTemplate | undefined {
  return TEMPLATE_BY_ID.get(id);
}

export interface TemplateFilter {
  category?: TemplateCategory | "all";
  query?: string;
}

function matchesQuery(t: StorefrontTemplate, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [t.name, t.tagline, t.description, t.category, ...t.tags].join(" ").toLowerCase();
  return q.split(/\s+/).every((term) => haystack.includes(term));
}

/** Filter + search the library. Empty query and "all" category are pass-through. */
export function searchTemplates(
  list: StorefrontTemplate[],
  filter: TemplateFilter = {},
): StorefrontTemplate[] {
  const category = filter.category ?? "all";
  const query = filter.query ?? "";
  return list.filter((t) => (category === "all" || t.category === category) && matchesQuery(t, query));
}

/** Section types in order, for the gallery's schematic preview. */
export function templateSectionTypes(template: StorefrontTemplate): string[] {
  const sections = template.config.sections;
  if (!Array.isArray(sections)) return [];
  return sections.map((s) => s.type);
}
