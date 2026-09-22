// Pure helpers for the Visual Website Studio pages model.
// No DB or network imports here so these can be unit-tested in isolation.

export const RESERVED_SLUGS = new Set<string>([
  "admin", "api", "account", "cart", "login", "logout", "register",
  "product", "products", "checkout", "order", "orders", "wishlist",
  "about", "contact", "repair", "repairs", "repair-book", "repair-ticket",
  "marketing", "dashboard", "groups", "campaign", "page", "pages",
  "category", "categories", "pos", "quotes", "stock-take", "suppliers",
  "my-repairs", "auth", "search",
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSlug(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input.trim().toLowerCase().replace(/\s+/g, " ").replace(/\s+/g, "-");
  if (!/^[a-z0-9 -]+$/.test(cleaned)) return null;
  const slug = cleaned.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (!SLUG_RE.test(slug)) return null;
  if (slug.length < 3 || slug.length > 80) return null;
  return slug;
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

export const PAGE_SECTION_TYPES = [
  "product-grid", "category-grid", "banner", "stats", "text",
  "button", "image", "features", "spacer",
] as const;

const STRING_LIMITS: Record<string, number> = {
  title: 500,
  content: 20000,
  label: 120,
  link: 500,
  text: 2000,
  buttonLabel: 120,
  buttonLink: 500,
  caption: 300,
  alt: 200,
  imageUrl: 2000,
  value: 200,
};

const NUMERIC_FIELDS = ["columns", "columnsTablet", "columnsMobile", "limit", "height", "maxWidth"] as const;
const BOOLEAN_FIELDS = ["hideOnMobile", "rounded"] as const;
const ITEM_FIELDS = ["icon", "title", "text", "value", "label"] as const;

function clampInt(value: unknown, max: number): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(max, Math.round(n)));
}

function sanitizeItem(item: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!item || typeof item !== "object" || Array.isArray(item)) return out;
  for (const k of ITEM_FIELDS) {
    const v = (item as Record<string, unknown>)[k];
    if (v !== undefined && typeof v !== "object") out[k] = String(v).slice(0, 500);
  }
  return out;
}

export function sanitizeSections(raw: unknown): any[] {
  if (!Array.isArray(raw)) return [];
  const out: any[] = [];
  for (const s of raw.slice(0, 40)) {
    if (!s || typeof s !== "object" || Array.isArray(s)) continue;
    const type = (s as any).type;
    if (typeof type !== "string" || !(PAGE_SECTION_TYPES as readonly string[]).includes(type)) continue;
    const sec: any = { type };
    if (typeof (s as any).id === "string") sec.id = (s as any).id.slice(0, 64);
    for (const [k, limit] of Object.entries(STRING_LIMITS)) {
      const v = (s as any)[k];
      if (v !== undefined && typeof v !== "object") sec[k] = String(v).slice(0, limit);
    }
    for (const k of NUMERIC_FIELDS) {
      const v = clampInt((s as any)[k], 48);
      if (v !== undefined) sec[k] = v;
    }
    for (const k of BOOLEAN_FIELDS) {
      if (typeof (s as any)[k] === "boolean") sec[k] = (s as any)[k];
    }
    if (Array.isArray((s as any).items)) {
      sec.items = (s as any).items.slice(0, 12).map(sanitizeItem);
    }
    if (s && typeof s === "object" && "productFilter" in (s as any)) {
      const pf = (s as any).productFilter;
      if (["all", "featured", "sale", "newest"].includes(pf)) sec.productFilter = pf;
    }
    if (s && typeof s === "object" && "style" in (s as any)) {
      const st = (s as any).style;
      if (["cards", "icons"].includes(st)) sec.style = st;
    }
    if (s && typeof s === "object" && "align" in (s as any)) {
      const a = (s as any).align;
      if (["left", "center"].includes(a)) sec.align = a;
    }
    if (s && typeof s === "object" && "variant" in (s as any)) {
      const v = (s as any).variant;
      if (["primary", "secondary", "outline"].includes(v)) sec.variant = v;
    }
    if (s && typeof s === "object" && "size" in (s as any)) {
      const sz = (s as any).size;
      if (["sm", "md", "lg"].includes(sz)) sec.size = sz;
    }
    out.push(sec);
  }
  return out;
}

const HERO_STYLES = ["carousel", "split", "minimal", "none"] as const;
const HERO_BUTTON_VARIANTS = ["secondary", "outline"] as const;

function sanitizeHeroButtons(raw: unknown): { label: string; link: string; variant?: "secondary" | "outline" }[] {
  if (!Array.isArray(raw)) return [];
  const out: { label: string; link: string; variant?: "secondary" | "outline" }[] = [];
  for (const b of raw.slice(0, 6)) {
    if (!b || typeof b !== "object" || Array.isArray(b)) continue;
    const label = typeof (b as any).label === "string" ? (b as any).label.slice(0, 120) : "";
    const link = typeof (b as any).link === "string" ? (b as any).link.slice(0, 500) : "";
    const variant = (b as any).variant;
    out.push({
      label,
      link,
      ...(HERO_BUTTON_VARIANTS.includes(variant) ? { variant } : {}),
    });
  }
  return out;
}

// Mirrors the top-level `hero` key of DynamicLayoutConfig (dynamic-engine.tsx).
function sanitizeHero(raw: unknown): any {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const h: any = {};
  if (typeof (raw as any).enabled === "boolean") h.enabled = (raw as any).enabled;
  if (HERO_STYLES.includes((raw as any).style)) h.style = (raw as any).style;
  const heroStringLimits: Record<string, number> = {
    badge: 120, headline: 300, subtitle: 600,
    ctaText: 120, ctaLink: 500, backgroundImage: 2000, featuredCategory: 120,
  };
  for (const [k, limit] of Object.entries(heroStringLimits)) {
    const v = (raw as any)[k];
    if (v !== undefined && typeof v !== "object") h[k] = String(v).slice(0, limit);
  }
  const buttons = sanitizeHeroButtons((raw as any).buttons);
  if (buttons.length) h.buttons = buttons;
  return Object.keys(h).length ? h : undefined;
}

// Mirrors the `productCard` key of DynamicLayoutConfig.
function sanitizeProductCard(raw: unknown): any {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const pc: any = {};
  if (["default", "compact", "detailed"].includes((raw as any).style)) pc.style = (raw as any).style;
  if (typeof (raw as any).showRating === "boolean") pc.showRating = (raw as any).showRating;
  if (typeof (raw as any).showSalePrice === "boolean") pc.showSalePrice = (raw as any).showSalePrice;
  return Object.keys(pc).length ? pc : undefined;
}

export function sanitizePageConfig(raw: unknown): any {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { sections: [] };
  const cfg: any = {};
  if (Array.isArray((raw as any).sections)) cfg.sections = sanitizeSections((raw as any).sections);
  const hero = sanitizeHero((raw as any).hero);
  if (hero) cfg.hero = hero;
  const productCard = sanitizeProductCard((raw as any).productCard);
  if (productCard) cfg.productCard = productCard;
  const colors = (raw as any).colors;
  if (colors && typeof colors === "object" && !Array.isArray(colors)) {
    const c: any = {};
    for (const k of ["accent", "heroBg", "heroText"]) {
      if (typeof colors[k] === "string") c[k] = colors[k].slice(0, 30);
    }
    cfg.colors = c;
  }
  return cfg;
}