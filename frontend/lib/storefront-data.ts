import type { Product } from "./types";
import { api } from "./api";

const PRODUCT_CACHE_TTL_MS = 15_000;
const CATEGORY_CACHE_TTL_MS = 60_000;

type CacheEntry<T> = { value: T; expiresAt: number };
type StorefrontCategories = {
  categories: { id: string; label: string }[];
  subcategories: any[];
};

const cache = new Map<string, CacheEntry<unknown>>();
const pending = new Map<string, Promise<unknown>>();

function getFresh<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) return undefined;
  return entry.value as T;
}

function cachedRequest<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const value = getFresh<T>(key);
  if (value !== undefined) return Promise.resolve(value);

  const active = pending.get(key);
  if (active) return active as Promise<T>;

  const request = load()
    .then((result) => {
      cache.set(key, { value: result, expiresAt: Date.now() + ttlMs });
      return result;
    })
    .finally(() => pending.delete(key));

  pending.set(key, request);
  return request;
}

function productsUrl(category?: string, group?: string, extras = true): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (group) params.set("group", group);
  if (extras) params.set("withExtras", "1");
  const query = params.toString();
  return query ? `/api/products?${query}` : "/api/products";
}

function loadProducts(url: string): Promise<Product[]> {
  return cachedRequest(`products:${url}`, PRODUCT_CACHE_TTL_MS, async () => {
    const data = await api<{ products: Product[] }>(url);
    return data.products || [];
  });
}

export function getProducts(category?: string, group?: string, extras = true): Promise<Product[]> {
  const url = productsUrl(category, group, extras);

  // The homepage already loads the public catalogue. Reuse it for category
  // navigation while it is fresh instead of making another request.
  if (category && !group) {
    const allProductsUrl = productsUrl(undefined, undefined, extras);
    const allProductsKey = `products:${allProductsUrl}`;
    const allProducts = getFresh<Product[]>(allProductsKey);
    if (allProducts) return Promise.resolve(allProducts.filter((product) => product.category === category));

    const allProductsRequest = pending.get(allProductsKey) as Promise<Product[]> | undefined;
    if (allProductsRequest) {
      return allProductsRequest.then((products) => products.filter((product) => product.category === category));
    }
  }

  return loadProducts(url);
}

export function getStorefrontCategories(): Promise<StorefrontCategories> {
  return cachedRequest("storefront:categories", CATEGORY_CACHE_TTL_MS, async () => {
    const response = await fetch("/api/categories");
    if (!response.ok) throw new Error(`Could not load categories (${response.status}).`);
    const data = await response.json();
    return {
      categories: data.categories || [],
      subcategories: data.subcategories || [],
    };
  });
}
