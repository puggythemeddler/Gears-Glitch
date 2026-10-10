import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateLayoutConfig,
  normalizeLayoutConfig,
  isKnownSectionType,
  LAYOUT_SECTION_TYPES,
  LEGACY_SECTION_ALIASES,
} from "../server/template-validate";

describe("validateLayoutConfig", () => {
  it("accepts the persisted editor config shape unchanged", () => {
    const config = {
      hero: { title: "QA Hero", subtitle: "Subtitle", image: "/assets/hero.jpg" },
      sections: [
        { type: "banner", title: "Banner", link: "/shop", image: "/assets/banner.jpg" },
        { type: "spacer", height: 0 },
        { type: "features", items: [{ title: "Fast", text: "Nationwide" }] },
      ],
      theme: "default",
    };
    assert.equal(validateLayoutConfig(config), null);
  });

  it("accepts every canonical section type", () => {
    for (const type of LAYOUT_SECTION_TYPES) {
      assert.equal(validateLayoutConfig({ sections: [{ type }] }), null, `${type} must be accepted`);
    }
  });

  it("accepts known legacy aliases but rejects unknown section types", () => {
    assert.equal(validateLayoutConfig({ sections: [{ type: "categories" }] }), null);
    const err = validateLayoutConfig({ sections: [{ type: "text" }, { type: "legacy-thing" }] });
    assert.ok(err, "an unrecognised section type must be rejected");
    assert.match(err as string, /legacy-thing/);
  });

  it("exposes the allowlist and alias map consistently", () => {
    for (const type of LAYOUT_SECTION_TYPES) assert.ok(isKnownSectionType(type));
    for (const alias of Object.keys(LEGACY_SECTION_ALIASES)) assert.ok(isKnownSectionType(alias));
    assert.equal(isKnownSectionType("legacy-thing"), false);
    assert.equal(isKnownSectionType(""), false);
  });

  it("preserves arbitrary extra keys by validating only, never rewriting", () => {
    const config: any = { foo: "bar", nested: { a: 1 }, sections: [{ type: "text" }] };
    const before = JSON.stringify(config);
    assert.equal(validateLayoutConfig(config), null);
    assert.equal(JSON.stringify(config), before);
  });

  it("rejects non-object configs", () => {
    assert.ok(validateLayoutConfig(null));
    assert.ok(validateLayoutConfig([]));
    assert.ok(validateLayoutConfig("nope"));
    assert.ok(validateLayoutConfig(42));
  });

  it("rejects malformed hero / colors / tokens / productCard", () => {
    assert.ok(validateLayoutConfig({ hero: [] }));
    assert.ok(validateLayoutConfig({ colors: "red" }));
    assert.ok(validateLayoutConfig({ tokens: 3 }));
    assert.ok(validateLayoutConfig({ productCard: null }));
  });

  it("rejects a non-array sections value and malformed sections", () => {
    assert.ok(validateLayoutConfig({ sections: {} }));
    assert.ok(validateLayoutConfig({ sections: [{ title: "no type" }] }));
    assert.ok(validateLayoutConfig({ sections: [{ type: "" }] }));
    assert.ok(validateLayoutConfig({ sections: [{ type: 5 }] }));
    assert.ok(validateLayoutConfig({ sections: ["text"] }));
    assert.ok(validateLayoutConfig({ sections: [{ type: "not-a-section" }] }));
  });

  it("accepts a valid template provenance marker", () => {
    assert.equal(validateLayoutConfig({ sections: [{ type: "text" }], templateId: "tech-grid", templateVersion: 1 }), null);
  });

  it("rejects malformed template provenance markers", () => {
    assert.ok(validateLayoutConfig({ templateId: "" }));
    assert.ok(validateLayoutConfig({ templateId: 5 }));
    assert.ok(validateLayoutConfig({ templateId: "x".repeat(80) }));
    assert.ok(validateLayoutConfig({ templateVersion: 0 }));
    assert.ok(validateLayoutConfig({ templateVersion: 1.5 }));
    assert.ok(validateLayoutConfig({ templateVersion: "1" }));
  });

  it("rejects oversized configs and absurd section counts", () => {
    const big = { blob: "x".repeat(300 * 1024) };
    assert.ok(validateLayoutConfig(big));
    const many = { sections: Array.from({ length: 300 }, () => ({ type: "text" })) };
    assert.ok(validateLayoutConfig(many));
  });
});

describe("normalizeLayoutConfig", () => {
  it("remaps legacy aliases to canonical types and reports the change", () => {
    const input = { sections: [{ type: "categories", limit: 6 }, { type: "text", title: "Keep" }] };
    const { config, changes } = normalizeLayoutConfig(input);
    assert.deepEqual((config.sections as any[]).map((s) => s.type), ["category-grid", "text"]);
    assert.equal(changes.length, 1);
    assert.match(changes[0], /categories.*category-grid/);
  });

  it("preserves order, extra fields and the input object (never mutates)", () => {
    const input: any = { sections: [{ type: "categories", limit: 6, nested: { a: 1 } }, { type: "spacer", height: 0 }] };
    const snapshot = JSON.stringify(input);
    const { config } = normalizeLayoutConfig(input);
    assert.equal(JSON.stringify(input), snapshot, "input must be untouched");
    assert.deepEqual(config.sections, [
      { type: "category-grid", limit: 6, nested: { a: 1 } },
      { type: "spacer", height: 0 },
    ]);
  });

  it("is a no-op when there are no legacy aliases", () => {
    const input = { sections: [{ type: "text" }], theme: "default" };
    const { config, changes } = normalizeLayoutConfig(input);
    assert.equal(changes.length, 0);
    assert.deepEqual(config, input);
  });

  it("tolerates non-object configs and missing sections", () => {
    assert.deepEqual(normalizeLayoutConfig(null).changes, []);
    assert.deepEqual(normalizeLayoutConfig({ theme: "dark" }).config, { theme: "dark" });
  });

  it("produces a result the strict validator accepts", () => {
    const legacy = { sections: [{ type: "categories" }, { type: "text" }] };
    assert.equal(validateLayoutConfig(legacy), null, "raw legacy alias still validates via the alias map");
    const { config } = normalizeLayoutConfig(legacy);
    assert.equal(validateLayoutConfig(config), null, "normalised config validates too");
    assert.deepEqual((config.sections as any[]).map((s) => s.type), ["category-grid", "text"]);
  });
});
