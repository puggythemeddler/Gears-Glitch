import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateLayoutConfig } from "../server/template-validate";

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

  it("never rejects on unknown section types (schema is broader than the engine)", () => {
    assert.equal(validateLayoutConfig({ sections: [{ type: "categories" }, { type: "legacy-thing" }] }), null);
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
