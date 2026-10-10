import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HERO_MAX_TILT_DEG,
  HERO_PARALLAX_X_PX,
  HERO_PARALLAX_Y_PX,
  HERO_POINTER_LIMIT,
  HERO_POINTER_VARS_IDLE,
  HERO_EFFECTS_DEFAULT,
  HERO_INTENSITY_AMPLITUDE,
  HERO_MOTION_INTENSITIES,
  clampHeroPointer,
  cycleHeroIndex,
  heroEffectProfile,
  heroEffectVars,
  heroEntranceEnabled,
  isHeroMotionIntensity,
  normalizeHeroEffects,
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

describe("hero effects normalization", () => {
  it("returns the shipped defaults for empty, null or junk configs", () => {
    assert.deepEqual(normalizeHeroEffects(undefined), HERO_EFFECTS_DEFAULT);
    assert.deepEqual(normalizeHeroEffects(null), HERO_EFFECTS_DEFAULT);
    assert.deepEqual(normalizeHeroEffects({}), HERO_EFFECTS_DEFAULT);
    assert.deepEqual(normalizeHeroEffects({ effects: null }), HERO_EFFECTS_DEFAULT);
    assert.deepEqual(normalizeHeroEffects({ effects: "on" as unknown as object }), HERO_EFFECTS_DEFAULT);
    assert.deepEqual(normalizeHeroEffects({ effects: [] as unknown as object }), HERO_EFFECTS_DEFAULT);
  });

  it("keeps explicit booleans and ignores non-boolean values", () => {
    const out = normalizeHeroEffects({ effects: { interactive: false, spotlight: true, parallax: "yes", tilt: 1, entrance: false } as any });
    assert.equal(out.interactive, false);
    assert.equal(out.spotlight, true);
    assert.equal(out.parallax, true);
    assert.equal(out.tilt, true);
    assert.equal(out.entrance, false);
  });

  it("accepts only the allowlisted intensities", () => {
    assert.equal(normalizeHeroEffects({ effects: { intensity: "expressive" } }).intensity, "expressive");
    assert.equal(normalizeHeroEffects({ effects: { intensity: "wild" } as any }).intensity, "balanced");
    assert.equal(normalizeHeroEffects({ effects: { intensity: 3 } as any }).intensity, "balanced");
  });

  it("honours legacy flat keys when the nested object is absent", () => {
    assert.equal(normalizeHeroEffects({ enablePointerEffects: false }).interactive, false);
    assert.equal(normalizeHeroEffects({ heroEntrance: false }).entrance, false);
    const nestedWins = normalizeHeroEffects({ enablePointerEffects: false, effects: { interactive: true } });
    assert.equal(nestedWins.interactive, true);
  });

  it("exposes a positive amplitude for every documented intensity", () => {
    for (const i of HERO_MOTION_INTENSITIES) {
      assert.ok(HERO_INTENSITY_AMPLITUDE[i] > 0);
    }
    assert.equal(HERO_INTENSITY_AMPLITUDE.balanced, 1);
    assert.ok(HERO_INTENSITY_AMPLITUDE.subtle < HERO_INTENSITY_AMPLITUDE.expressive);
  });

  it("only recognises documented intensity strings", () => {
    assert.equal(isHeroMotionIntensity("balanced"), true);
    assert.equal(isHeroMotionIntensity("Subtle"), false);
    assert.equal(isHeroMotionIntensity(undefined), false);
    assert.equal(isHeroMotionIntensity({}), false);
  });

  it("survives a persistence round-trip and is idempotent", () => {
    const stored = { headline: "Hi", effects: { interactive: true, spotlight: false, parallax: true, tilt: false, entrance: false, intensity: "expressive" as const } };
    const restored = JSON.parse(JSON.stringify(stored));
    const flat = normalizeHeroEffects(stored);
    assert.deepEqual(normalizeHeroEffects(restored), flat);
    assert.deepEqual(normalizeHeroEffects({ effects: flat }), flat);
  });

  it("upgrades legacy configs without inventing unsafe values", () => {
    const legacy = JSON.parse(JSON.stringify({ enablePointerEffects: false, heroEntrance: false }));
    const out = normalizeHeroEffects(legacy);
    assert.equal(out.interactive, false);
    assert.equal(heroEntranceEnabled(legacy), false);
    assert.equal(out.intensity, "balanced");
    assert.equal(out.spotlight, true);
  });
});

describe("hero effect profile", () => {
  it("blocks pointer effects for reduced motion or an explicit opt-out", () => {
    assert.equal(heroEffectProfile(undefined, false).allowPointer, true);
    assert.equal(heroEffectProfile(undefined, true).allowPointer, false);
    assert.equal(heroEffectProfile({ effects: { interactive: false } }, false).allowPointer, false);
  });

  it("maps intensity to the shared amplitude scale", () => {
    assert.equal(heroEffectProfile({ effects: { intensity: "subtle" } }, false).amplitude, HERO_INTENSITY_AMPLITUDE.subtle);
    assert.equal(heroEffectProfile({ effects: { intensity: "expressive" } }, false).amplitude, HERO_INTENSITY_AMPLITUDE.expressive);
    assert.equal(heroEffectProfile({}, false).amplitude, 1);
  });

  it("merges profile fields onto the normalised config", () => {
    const p = heroEffectProfile({ effects: { tilt: false, intensity: "expressive" } }, false);
    assert.equal(p.tilt, false);
    assert.equal(p.spotlight, true);
    assert.equal(p.entrance, true);
    assert.equal(p.intensity, "expressive");
  });
});

describe("interactive hero effect independence", () => {
  it("keeps entrance independent of the interactive master switch", () => {
    const offPointer = heroEffectProfile({ effects: { interactive: false } }, false);
    assert.equal(offPointer.allowPointer, false);
    assert.equal(offPointer.entrance, true);

    const offEntrance = heroEffectProfile({ effects: { entrance: false } }, false);
    assert.equal(offEntrance.entrance, false);
    assert.equal(offEntrance.allowPointer, true);
  });

  it("treats interactive as a master switch over every pointer sub-effect", () => {
    const p = heroEffectProfile({ effects: { interactive: false, spotlight: true, parallax: true, tilt: true } }, false);
    assert.equal(p.allowPointer, false);
    assert.equal(p.spotlight, true);
    assert.equal(p.parallax, true);
    assert.equal(p.tilt, true);
  });

  it("still lets reduced motion override an explicit interactive opt-in", () => {
    assert.equal(heroEffectProfile({ effects: { interactive: true } }, true).allowPointer, false);
    assert.equal(heroEffectProfile({ effects: { interactive: true } }, true).entrance, true);
  });

  it("does not couple legacy flat keys to the entrance flag", () => {
    const p = heroEffectProfile({ enablePointerEffects: false, heroEntrance: true }, false);
    assert.equal(p.allowPointer, false);
    assert.equal(p.entrance, true);
  });
});

describe("hero effect vars options", () => {
  const corner = { x: HERO_POINTER_LIMIT, y: -HERO_POINTER_LIMIT };

  it("zeroes disabled effects so toggling them off is fully static", () => {
    const vars = heroEffectVars(corner, true, { tilt: false, parallax: false, spotlight: false });
    assert.equal(vars["--hero-tilt-x"], "0deg");
    assert.equal(vars["--hero-tilt-y"], "0deg");
    assert.equal(vars["--hero-parallax-x"], "0px");
    assert.equal(vars["--hero-parallax-y"], "0px");
    assert.equal(vars["--hero-spot-opacity"], "0");
  });

  it("scales travel by the supplied amplitude", () => {
    const full = heroEffectVars(corner, true, { amplitude: 1 });
    const half = heroEffectVars(corner, true, { amplitude: 0.5 });
    assert.equal(half["--hero-tilt-x"], `${(-HERO_POINTER_LIMIT * HERO_MAX_TILT_DEG) / 2}deg`);
    assert.equal(half["--hero-parallax-x"], `${-(HERO_POINTER_LIMIT * HERO_PARALLAX_X_PX) / 2}px`);
    assert.notEqual(full["--hero-tilt-x"], half["--hero-tilt-x"]);
  });

  it("falls back to unit amplitude for zero/NaN values", () => {
    assert.equal(heroEffectVars(corner, true, { amplitude: 0 })["--hero-tilt-x"], `${-HERO_POINTER_LIMIT * HERO_MAX_TILT_DEG}deg`);
    assert.equal(heroEffectVars(corner, true, { amplitude: Number.NaN })["--hero-tilt-y"], `${-HERO_POINTER_LIMIT * HERO_MAX_TILT_DEG}deg`);
  });

  it("still reports neutral values when inactive regardless of options", () => {
    assert.deepEqual(heroEffectVars({ x: 0, y: 0 }, false, { tilt: true, parallax: true, spotlight: true }), HERO_POINTER_VARS_IDLE);
  });
});
