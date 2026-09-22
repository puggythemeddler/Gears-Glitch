import type { DynamicLayoutConfig } from "@/layouts/dynamic-engine";

export type Section = NonNullable<DynamicLayoutConfig["sections"]>[number];

let idCounter = 0;
function uid(): string {
  idCounter += 1;
  return "sec-" + Date.now().toString(36) + "-" + idCounter;
}

export function uidSection(): string {
  return uid();
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Mirrors the server-side pages.ts normalizer so the client preview stays in sync.
export function normalizeSlug(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input.trim().toLowerCase().replace(/\s+/g, " ").replace(/\s+/g, "-");
  if (!/^[a-z0-9 -]+$/.test(cleaned)) return null;
  const slug = cleaned.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (!SLUG_RE.test(slug)) return null;
  if (slug.length < 3 || slug.length > 80) return null;
  return slug;
}

export interface PaletteTemplate {
  type: string;
  label: string;
  group: string;
  keywords: string;
  icon: string;
  defaults: any;
}

export const SECTION_TEMPLATES: PaletteTemplate[] = [
  { type: "text", label: "Text Block", group: "Sections", keywords: "text paragraph heading copy", icon: "T", defaults: { title: "New heading", content: "Add a short paragraph describing your store, a promotion, or anything else your customers should know.", align: "center" } },
  { type: "button", label: "Button", group: "Sections", keywords: "button cta link action", icon: "B", defaults: { label: "Shop Now", link: "/pc", variant: "primary", align: "center", size: "md" } },
  { type: "image", label: "Image", group: "Sections", keywords: "image picture photo media", icon: "I", defaults: { imageUrl: "", alt: "", caption: "", rounded: true } },
  { type: "banner", label: "Banner", group: "Sections", keywords: "banner promo offer sale strip", icon: "N", defaults: { text: "Big Sale — up to 30% off", bgColor: "#f97316", textColor: "#ffffff", link: "/pc", buttonLabel: "Shop Now", buttonLink: "/pc" } },
  { type: "stats", label: "Stats", group: "Sections", keywords: "stats numbers counters metrics", icon: "S", defaults: { items: [{ value: "1000+", label: "Products" }, { value: "500+", label: "Customers" }, { value: "24/7", label: "Support" }] } },
  { type: "features", label: "Features", group: "Sections", keywords: "features benefits reasons cards", icon: "F", defaults: { title: "Why shop with us", columns: 3, items: [{ title: "Genuine products", text: "Authentic, sourced from official distributors." }, { title: "Fast delivery", text: "Nationwide delivery, Nairobi within 24h." }, { title: "Warranty", text: "Covered on every item we sell." }] } },
  { type: "spacer", label: "Spacer", group: "Sections", keywords: "spacer space gap padding", icon: "S", defaults: { height: 48 } },
  { type: "product-grid", label: "Products", group: "Commerce", keywords: "products grid catalog shop items", icon: "P", defaults: { title: "Featured Products", productFilter: "all", columns: 4, limit: 8 } },
  { type: "category-grid", label: "Categories", group: "Commerce", keywords: "categories categories shop links", icon: "C", defaults: { title: "Shop by Category", columns: 4, style: "cards" } },
];

export const SECTION_LABELS: Record<string, string> = {
  "product-grid": "Products", "category-grid": "Categories", banner: "Banner", stats: "Stats",
  text: "Text", button: "Button", image: "Image", features: "Features", spacer: "Spacer",
};

export const SECTION_EDITABLE_FIDS = [
  /^sections\.\d+\.title$/, /^sections\.\d+\.content$/, /^sections\.\d+\.label$/,
  /^sections\.\d+\.text$/, /^sections\.\d+\.buttonLabel$/, /^sections\.\d+\.caption$/,
  /^sections\.\d+\.items\.\d+\.title$/, /^sections\.\d+\.items\.\d+\.text$/,
  /^sections\.\d+\.items\.\d+\.value$/, /^sections\.\d+\.items\.\d+\.label$/,
];