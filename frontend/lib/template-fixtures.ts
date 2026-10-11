import type { Product } from "./types";

/**
 * Sample data for the Studio's template previews. It is never persisted, never
 * merged into a merchant's catalogue and never sent to the server: it exists
 * only so a template can be evaluated with realistic-looking content before it
 * is applied. When the merchant already has real products/categories those are
 * used instead (see `previewProducts` / `previewCategories`).
 *
 * Images are inline SVG data URIs: no network requests, nothing outside the
 * image allowlist, and nothing licensed.
 */

export const DEMO_CATEGORIES: { id: string; label: string }[] = [
  { id: "audio", label: "Audio" },
  { id: "computing", label: "Computing" },
  { id: "accessories", label: "Accessories" },
  { id: "home", label: "Home & Living" },
];

function placeholderImage(label: string, bg: string, fg: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img" aria-label="${label}">` +
    `<rect width="400" height="300" fill="${bg}"/>` +
    `<g fill="none" stroke="${fg}" stroke-width="12" stroke-linejoin="round" stroke-linecap="round">` +
    `<rect x="72" y="74" width="256" height="150" rx="14"/>` +
    `<circle cx="150" cy="146" r="30"/>` +
    `<path d="M96 208l68-56 52 42 44-32 52 46"/>` +
    `</g>` +
    `<text x="200" y="266" font-family="system-ui, sans-serif" font-size="20" fill="${fg}" text-anchor="middle">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

interface DemoProductInput {
  id: string;
  name: string;
  price: number;
  salePrice?: number;
  category: string;
  subcategory: string;
  rating: number;
  count: number;
  image: [label: string, bg: string, fg: string];
}

const DEMO_INPUTS: DemoProductInput[] = [
  { id: "demo-audio-1", name: "Over-Ear Headphones", price: 8999, salePrice: 7499, category: "Audio", subcategory: "Headphones", rating: 4.6, count: 18, image: ["Headphones", "#e2e8f0", "#475569"] },
  { id: "demo-audio-2", name: "Wireless Earbuds", price: 4599, category: "Audio", subcategory: "Earbuds", rating: 4.4, count: 27, image: ["Earbuds", "#dcfce7", "#166534"] },
  { id: "demo-computing-1", name: "14-inch Ultrabook", price: 74999, salePrice: 69999, category: "Computing", subcategory: "Laptops", rating: 4.8, count: 11, image: ["Laptop", "#dbeafe", "#1e40af"] },
  { id: "demo-computing-2", name: "Mechanical Keyboard", price: 6799, category: "Computing", subcategory: "Peripherals", rating: 4.3, count: 14, image: ["Keyboard", "#ede9fe", "#5b21b6"] },
  { id: "demo-accessories-1", name: "Everyday Backpack", price: 3499, salePrice: 2999, category: "Accessories", subcategory: "Bags", rating: 4.5, count: 31, image: ["Backpack", "#fef3c7", "#92400e"] },
  { id: "demo-home-1", name: "Ceramic Table Lamp", price: 5299, category: "Home & Living", subcategory: "Lighting", rating: 4.2, count: 9, image: ["Table lamp", "#fae8ff", "#86198f"] },
];

export const DEMO_PRODUCTS: Product[] = DEMO_INPUTS.map((d) => ({
  id: d.id,
  name: d.name,
  price: d.price,
  salePrice: d.salePrice ?? null,
  currency: "KES",
  imageUrl: placeholderImage(...d.image),
  category: d.category,
  subcategory: d.subcategory,
  inStock: true,
  isNonStock: false,
  specs: [],
  minTier: 1,
  rating: { average: d.rating, count: d.count },
}));

/** Sample products, unless the merchant already has real ones. */
export function previewProducts(products?: Product[] | null): { items: Product[]; demo: boolean } {
  if (Array.isArray(products) && products.length > 0) return { items: products, demo: false };
  return { items: DEMO_PRODUCTS, demo: true };
}

/** Sample categories, unless the merchant already has real ones. */
export function previewCategories(
  categories?: { id: string; label: string }[] | null,
): { items: { id: string; label: string }[]; demo: boolean } {
  if (Array.isArray(categories) && categories.length > 0) return { items: categories, demo: false };
  return { items: DEMO_CATEGORIES, demo: true };
}
