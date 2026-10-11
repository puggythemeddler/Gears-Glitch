import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_CATEGORIES,
  DEMO_PRODUCTS,
  previewCategories,
  previewProducts,
} from "../frontend/lib/template-fixtures";
import { isAllowedImageSrc } from "../frontend/lib/image-allowlist";
import type { Product } from "../frontend/lib/types";

describe("template preview fixtures", () => {
  it("provides a non-empty, sentinel-safe demo catalogue", () => {
    assert.ok(DEMO_PRODUCTS.length >= 4);
    assert.ok(DEMO_CATEGORIES.length >= 2);
  });

  it("only uses images the frontend allowlist accepts", () => {
    for (const p of DEMO_PRODUCTS) {
      assert.ok(isAllowedImageSrc(p.imageUrl), `${p.id} image must be allowlisted`);
      assert.ok(!/^https?:\/\//i.test(p.imageUrl), `${p.id} must not point at a remote origin`);
    }
  });

  it("shapes every demo product like a real Product", () => {
    for (const p of DEMO_PRODUCTS) {
      assert.equal(typeof p.id, "string");
      assert.equal(typeof p.name, "string");
      assert.equal(typeof p.price, "number");
      assert.ok(p.price > 0);
      assert.equal(p.salePrice === null || typeof p.salePrice === "number", true);
      assert.equal(typeof p.currency, "string");
      assert.equal(typeof p.category, "string");
      assert.equal(typeof p.subcategory, "string");
      assert.equal(p.inStock, true);
      assert.equal(p.isNonStock, false);
      assert.ok(Array.isArray(p.specs));
      assert.ok(p.minTier >= 1);
      assert.ok(p.rating && p.rating.count > 0);
    }
  });

  it("includes at least one discounted product so the sale filter has data", () => {
    assert.ok(DEMO_PRODUCTS.some((p) => p.salePrice));
  });

  it("falls back to sample data only when the merchant has none", () => {
    const empty = previewProducts([]);
    assert.equal(empty.demo, true);
    assert.equal(empty.items.length, DEMO_PRODUCTS.length);
    assert.equal(previewProducts(undefined).demo, true);
    assert.equal(previewProducts(null).demo, true);

    const real: Product[] = [{ ...DEMO_PRODUCTS[0], id: "real-1", name: "Real product" }];
    const live = previewProducts(real);
    assert.equal(live.demo, false);
    assert.equal(live.items.length, 1);
    assert.equal(live.items[0].name, "Real product");
  });

  it("falls back for categories the same way", () => {
    assert.equal(previewCategories([]).demo, true);
    assert.equal(previewCategories(undefined).demo, true);
    const real = [{ id: "x", label: "X" }];
    const live = previewCategories(real);
    assert.equal(live.demo, false);
    assert.deepEqual(live.items, real);
  });
});
