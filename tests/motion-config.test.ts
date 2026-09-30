import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMotionConfig,
  normalizeMotionConfigSafe,
  clampNumber,
  motionCssVars,
  isMotionPreset,
  isMotionIntensity,
  PRESET_CATEGORY,
  MOTION_LIMITS,
  MOTION_INTENSITIES,
  MOTION_INTENSITY_FACTORS,
} from "../frontend/lib/motion";

describe("motion config normalization", () => {
  it("applies defaults for partial valid configs", () => {
    const conf = normalizeMotionConfig({ preset: "fade-up" });
    assert.ok(conf);
    assert.equal(conf.preset, "fade-up");
    assert.equal(conf.trigger, "viewport");
    assert.equal(conf.duration, 600);
    assert.equal(conf.delay, 0);
    assert.equal(conf.easing, "ease-out");
    assert.equal(conf.direction, "normal");
    assert.equal(conf.repeat, 0);
    assert.equal(conf.stagger, 0);
    assert.equal(conf.mobile, true);
    assert.equal(conf.reducedMotion, "respect");
    assert.equal(conf.intensity, "standard");
  });

  it("keeps valid explicit values", () => {
    const conf = normalizeMotionConfig({
      preset: "blur-in",
      trigger: "load",
      duration: 1200,
      delay: 250,
      easing: "spring",
      direction: "reverse",
      repeat: 2,
      stagger: 150,
      mobile: false,
      reducedMotion: "disable",
      intensity: "subtle",
    });
    assert.ok(conf);
    assert.deepEqual(conf, {
      preset: "blur-in",
      trigger: "load",
      duration: 1200,
      delay: 250,
      easing: "spring",
      direction: "reverse",
      repeat: 2,
      stagger: 150,
      mobile: false,
      reducedMotion: "disable",
      intensity: "subtle",
    });
  });

  it("returns null for anything that is not an object", () => {
    for (const bad of [null, undefined, "fade-up", 42, true, [], () => 1]) {
      assert.equal(normalizeMotionConfig(bad), null);
    }
  });

  it("returns null for unknown or non-string presets", () => {
    assert.equal(normalizeMotionConfig({ preset: "spin-forever" }), null);
    assert.equal(normalizeMotionConfig({ preset: 7 }), null);
    assert.equal(normalizeMotionConfig({ preset: { x: 1 } }), null);
  });

  it("clamps numeric fields to their allowlisted ranges", () => {
    const conf = normalizeMotionConfig({
      preset: "fade",
      duration: 99999,
      delay: -50,
      repeat: 50,
      stagger: -1,
    });
    assert.ok(conf);
    assert.equal(conf.duration, MOTION_LIMITS.duration.max);
    assert.equal(conf.delay, MOTION_LIMITS.delay.min);
    assert.equal(conf.repeat, MOTION_LIMITS.repeat.max);
    assert.equal(conf.stagger, MOTION_LIMITS.stagger.min);
  });

  it("treats non-numeric durations as defaults (no NaN leaks)", () => {
    const conf = normalizeMotionConfig({
      preset: "fade",
      duration: "NaN",
      delay: null,
      repeat: {},
      stagger: "abc",
    });
    assert.ok(conf);
    assert.equal(conf.duration, 600);
    assert.equal(conf.delay, 0);
    assert.equal(conf.repeat, 0);
    assert.equal(conf.stagger, 0);
  });

  it("falls back to allowlisted values for unknown triggers/easings/directions", () => {
    const conf = normalizeMotionConfig({
      preset: "fade",
      trigger: "always-inside-viewport",
      easing: "bouncey-bounce",
      direction: "diagonal",
      reducedMotion: "always",
    });
    assert.ok(conf);
    assert.equal(conf.trigger, "viewport");
    assert.equal(conf.easing, "ease-out");
    assert.equal(conf.direction, "normal");
    assert.equal(conf.reducedMotion, "respect");
  });

  it("strips attacker-shaped keys and does not propagate them", () => {
    const conf = normalizeMotionConfig({
      preset: "fade-up",
      onMouseOver: "alert(1)",
      dangerouslySetInnerHTML: { __html: "<img src=x onerror=alert(1)>" },
      style: { color: "red" },
      onClick: () => {},
    });
    assert.ok(conf);
    const out = conf as unknown as Record<string, unknown>;
    assert.equal(out.onMouseOver, undefined);
    assert.equal(out.dangerouslySetInnerHTML, undefined);
    assert.equal(out.style, undefined);
    assert.equal(typeof out.onClick, "undefined");
  });

  it("never emits raw user strings as easing or names", () => {
    const conf = normalizeMotionConfig({ preset: "fade-up", easing: `ease-out; background: url(evil)` });
    assert.ok(conf);
    assert.ok(!conf.easing.includes(";"));
    const vars = motionCssVars(conf);
    assert.ok(!Object.values(vars).some((v) => v.includes(";") || v.includes("{") || v.includes("}")));
  });

  it("has every preset categorized and labeled", () => {
    const conf = normalizeMotionConfig({ preset: "stagger" });
    assert.ok(conf);
    assert.equal(PRESET_CATEGORY["stagger"], "editorial");
    assert.equal(PRESET_CATEGORY["lift-hover"], "interaction");
    assert.equal(PRESET_CATEGORY["pulse"], "infinite");
    for (const key of Object.keys(PRESET_CATEGORY)) assert.ok(isMotionPreset(key));
  });
});

describe("motion intensity scale", () => {
  it("accepts only the three allowlisted intensities", () => {
    for (const value of MOTION_INTENSITIES) assert.ok(isMotionIntensity(value));
    for (const bad of ["", "loud", "STANDARD", 3, null, undefined, {}]) {
      assert.equal(isMotionIntensity(bad), false);
    }
  });

  it("falls back to standard for unknown or missing intensities", () => {
    assert.equal(normalizeMotionConfig({ preset: "fade", intensity: "loud" })?.intensity, "standard");
    assert.equal(normalizeMotionConfig({ preset: "fade" })?.intensity, "standard");
    assert.equal(normalizeMotionConfig({ preset: "fade", intensity: "expressive" })?.intensity, "expressive");
  });

  it("keeps standard a no-op so existing configs render unchanged", () => {
    assert.equal(MOTION_INTENSITY_FACTORS.standard.duration, 1);
    assert.equal(MOTION_INTENSITY_FACTORS.standard.distance, 16);
    const conf = normalizeMotionConfig({ preset: "fade-up", duration: 600 });
    assert.ok(conf);
    const vars = motionCssVars(conf);
    assert.equal(vars["--motion-duration"], "0.6s");
    assert.equal(vars["--motion-distance"], "16px");
  });

  it("scales duration and travel distance with the chosen intensity", () => {
    const base = { preset: "fade-up" as const, duration: 600 };
    const subtle = motionCssVars(normalizeMotionConfig({ ...base, intensity: "subtle" })!);
    const standard = motionCssVars(normalizeMotionConfig({ ...base, intensity: "standard" })!);
    const expressive = motionCssVars(normalizeMotionConfig({ ...base, intensity: "expressive" })!);

    const secs = (v: string) => parseFloat(v) * 1000;
    const px = (v: string) => parseFloat(v);

    assert.ok(secs(subtle["--motion-duration"]) < secs(standard["--motion-duration"]));
    assert.ok(secs(standard["--motion-duration"]) < secs(expressive["--motion-duration"]));
    assert.ok(px(subtle["--motion-distance"]) < px(standard["--motion-distance"]));
    assert.ok(px(standard["--motion-distance"]) < px(expressive["--motion-distance"]));
  });

  it("does not change delay or stagger when intensity changes", () => {
    const base = { preset: "stagger" as const, duration: 600, delay: 250, stagger: 150 };
    const subtle = motionCssVars(normalizeMotionConfig({ ...base, intensity: "subtle" })!);
    const expressive = motionCssVars(normalizeMotionConfig({ ...base, intensity: "expressive" })!);
    assert.equal(subtle["--motion-delay"], expressive["--motion-delay"]);
    assert.equal(subtle["--motion-stagger"], expressive["--motion-stagger"]);
  });
});

describe("motion helpers", () => {
  it("clampNumber coerces strings, rounds, and respects bounds", () => {
    assert.equal(clampNumber("120", 0, 200, 10), 120);
    assert.equal(clampNumber(42.6, 0, 100, 10), 43);
    assert.equal(clampNumber(400, 0, 10, 10), 10);
    assert.equal(clampNumber("junk", 0, 10, 10), 10);
    assert.equal(clampNumber(undefined, 0, 10, 10), 10);
  });

  it("motionCssVars emits seconds and allowlisted easing only", () => {
    const conf = normalizeMotionConfig({ preset: "slide-up", duration: 1000, easing: "spring" });
    assert.ok(conf);
    const vars = motionCssVars(conf);
    assert.equal(vars["--motion-duration"], "1s");
    assert.equal(vars["--motion-delay"], "0s");
    assert.equal(vars["--motion-name"], "slideInUp");
    assert.ok(vars["--motion-ease"].startsWith("cubic-bezier"));
  });

  it("normalizeMotionConfigSafe always returns a usable config", () => {
    assert.equal(normalizeMotionConfigSafe({ preset: "nope" }).preset, "fade-up");
    assert.equal(normalizeMotionConfigSafe(undefined).preset, "fade-up");
    assert.equal(normalizeMotionConfigSafe({ preset: "zoom-in" }).preset, "zoom-in");
  });
});