import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HERO_MAX_TILT_DEG,
  HERO_PARALLAX_X_PX,
  HERO_PARALLAX_Y_PX,
  HERO_POINTER_LIMIT,
  HERO_POINTER_VARS_IDLE,
  clampHeroPointer,
  cycleHeroIndex,
  heroEffectVars,
  heroEntranceEnabled,
  selectHeroFeatured,
  shouldAllowPointerEffects,
} from "../frontend/lib/hero-effects";
import type { Product } from "../frontend/lib/types";

function product(id: string, imageUrl?: string): Product {
  return { id, name: `Product ${id}`, price: 1000, imageUrl } as unknown as Product;
}

describe("interactive hero pointer effects", () => {
  it("is enabled by default (undefined config / no reduced motion)", () => {
    assert.equal(shouldAllowPointerEffects(undefined, false), true);
    assert.equal(shouldAllowPointerEffects({}, false), true);
    assert.equal(shouldAllowPointerEffects(null, false), true);
  });

  it("can be switched off from the hero config", () => {
    assert.equal(shouldAllowPointerEffects({ enablePointerEffects: false }, false), false);
    assert.equal(shouldAllowPointerEffects({ enablePointerEffects: true }, false), true);
  });

  it("always yields to reduced motion, even when configured on", () => {
    assert.equal(shouldAllowPointerEffects({ enablePointerEffects: true }, true), false);
    assert.equal(shouldAllowPointerEffects(undefined, true), false);
  });

  it("clamps raw readings into the safe band and neutralises junk", () => {
    assert.deepEqual(clampHeroPointer(5, -5), { x: HERO_POINTER_LIMIT, y: -HERO_POINTER_LIMIT });
    assert.deepEqual(clampHeroPointer(Number.NaN, undefined), { x: 0, y: 0 });
    assert.deepEqual(clampHeroPointer("0.25", {}), { x: 0, y: 0 });
  });

  it("produces neutral, fully static variables when inactive", () => {
    const vars = heroEffectVars({ x: 0, y: 0 }, false);
    assert.deepEqual(vars, HERO_POINTER_VARS_IDLE);
    assert.equal(vars["--hero-spot-opacity"], "0");
  });

  it("scales offsets into bounded tilt / spotlight / parallax vars", () => {
    const vars = heroEffectVars({ x: HERO_POINTER_LIMIT, y: -HERO_POINTER_LIMIT }, true);
    assert.equal(vars["--hero-tilt-x"], `${-HERO_POINTER_LIMIT * HERO_MAX_TILT_DEG}deg`);
    assert.equal(vars["--hero-tilt-y"], `${-HERO_POINTER_LIMIT * HERO_MAX_TILT_DEG}deg`);
    assert.equal(vars["--hero-parallax-x"], `${-HERO_POINTER_LIMIT * HERO_PARALLAX_X_PX}px`);
    assert.equal(vars["--hero-parallax-y"], `${HERO_POINTER_LIMIT * HERO_PARALLAX_Y_PX}px`);
    assert.equal(vars["--hero-spot-x"], "100%");
    assert.equal(vars["--hero-spot-y"], "0%");
    assert.equal(vars["--hero-spot-opacity"], "1");
  });

  it("never emits NaN or unbounded values", () => {
    const vars = heroEffectVars(clampHeroPointer(Number.POSITIVE_INFINITY, -Infinity), true);
    for (const value of Object.values(vars)) {
      assert.ok(!value.includes("NaN"));
      const n = parseFloat(value);
      assert.ok(Number.isFinite(n));
    }
  });
});

describe("interactive hero featured showcase", () => {
  it("returns an empty list for missing or empty products", () => {
    assert.deepEqual(selectHeroFeatured(undefined), []);
    assert.deepEqual(selectHeroFeatured(null), []);
    assert.deepEqual(selectHeroFeatured([]), []);
  });

  it("keeps only image-backed products and caps the count", () => {
    const list = [product("a", "img-a"), product("b"), product("c", "img-c"), product("d", "img-d")];
    const picked = selectHeroFeatured(list, 2);
    assert.deepEqual(picked.map((p) => p.id), ["a", "c"]);
  });

  it("falls back to the default cap for invalid limits", () => {
    const list = Array.from({ length: 10 }, (_, i) => product(`p${i}`, `img-${i}`));
    assert.equal(selectHeroFeatured(list, 0).length, 6);
    assert.equal(selectHeroFeatured(list, Number.NaN).length, 6);
  });

  it("steps the carousel with wrap-around and is safe for tiny sets", () => {
    assert.equal(cycleHeroIndex(0, 1, 3), 1);
    assert.equal(cycleHeroIndex(2, 1, 3), 0);
    assert.equal(cycleHeroIndex(0, -1, 3), 2);
    assert.equal(cycleHeroIndex(0, 1, 0), 0);
    assert.equal(cycleHeroIndex(0, 1, 1), 0);
  });
});

describe("interactive hero entrance configuration", () => {
  it("is on unless explicitly disabled", () => {
    assert.equal(heroEntranceEnabled(undefined), true);
    assert.equal(heroEntranceEnabled({}), true);
    assert.equal(heroEntranceEnabled({ heroEntrance: true }), true);
    assert.equal(heroEntranceEnabled({ heroEntrance: false }), false);
  });
});
