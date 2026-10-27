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

  it("accepts persisted hero images and strict hex colors", () => {
    assert.equal(validateLayoutConfig({
      hero: { backgroundImage: "https://res.cloudinary.com/demo/image/upload/hero.jpg" },
      colors: { heroBg: "#abc", heroText: "#AABBCC", accent: "#123456" },
    }), null);
    assert.equal(validateLayoutConfig({ hero: { backgroundImage: "/uploads/hero.jpg" } }), null);
    assert.equal(validateLayoutConfig({ hero: { backgroundImage: "" } }), null);
  });

  it("rejects external, protocol-relative, and malformed hero image values", () => {
    for (const image of ["https://images.example.com/hero.jpg", "//evil.test/a.jpg", "javascript:alert(1)", "data:image/png;base64,AA==", "/bad\\path"]) {
      assert.ok(validateLayoutConfig({ hero: { backgroundImage: image } }), `${image} should be rejected`);
    }
  });

  it("rejects colors outside the 3- or 6-digit hex format", () => {
    for (const color of ["red", "url(javascript:alert(1))", "#abcd", "#12345678"]) {
      assert.ok(validateLayoutConfig({ colors: { heroBg: color } }), `${color} should be rejected`);
    }
  });

  it("accepts safe Studio links, section images, and section colors unchanged", () => {
    const config = {
      hero: {
        ctaLink: "/products?category=pc",
        buttons: [{ label: "Email us", link: "mailto:sales@example.com" }],
      },
      sections: [
        {
          type: "banner",
          link: "https://example.com/sale",
          buttonLink: "wa.me/254700000000",
          imageUrl: "https://res.cloudinary.com/demo/image/upload/banner.jpg",
          bgColor: "#123",
          textColor: "#AABBCC",
        },
      ],
    };
    const before = JSON.stringify(config);
    assert.equal(validateLayoutConfig(config), null);
    assert.equal(JSON.stringify(config), before, "validation must not normalize or mutate the config");
  });

  it("rejects unsafe links in hero and section destinations", () => {
    const unsafeLinks = [
      "javascript:alert(1)",
      "java script:alert(1)",
      "data:text/html,<script>",
      "//evil.example/path",
      "https://user:pass@example.com/path",
      "\\\\evil.example\\path",
      "ftp://example.com/file",
      "x".repeat(2049),
    ];
    for (const link of unsafeLinks) {
      assert.ok(validateLayoutConfig({ hero: { ctaLink: link } }), `hero link ${link} should be rejected`);
      assert.ok(validateLayoutConfig({ sections: [{ type: "button", link }] }), `section link ${link} should be rejected`);
      assert.ok(validateLayoutConfig({ sections: [{ type: "banner", buttonLink: link }] }), `button link ${link} should be rejected`);
      assert.ok(validateLayoutConfig({ sections: [{ type: "image-text", ctaLink: link }] }), `CTA link ${link} should be rejected`);
    }
    assert.ok(validateLayoutConfig({ hero: { buttons: [{ label: "Unsafe", link: "javascript:alert(1)" }] } }));
  });

  it("rejects unsafe section image URLs and non-hex section colors", () => {
    for (const imageUrl of ["https://images.example.com/banner.jpg", "//evil.example/banner.jpg", "data:image/svg+xml,<svg>"]) {
      assert.ok(validateLayoutConfig({ sections: [{ type: "image", imageUrl }] }), `${imageUrl} should be rejected`);
    }
    for (const bgColor of ["red", "url(javascript:alert(1))", "#12345678"]) {
      assert.ok(validateLayoutConfig({ sections: [{ type: "banner", bgColor }] }), `${bgColor} should be rejected`);
    }
    for (const textColor of ["var(--text)", "rgb(1, 2, 3)", "#abcd"]) {
      assert.ok(validateLayoutConfig({ sections: [{ type: "text", textColor }] }), `${textColor} should be rejected`);
    }
  });

  it("rejects malformed hero button collections before persistence", () => {
    assert.ok(validateLayoutConfig({ hero: { buttons: {} } }));
    assert.ok(validateLayoutConfig({ hero: { buttons: ["not a button"] } }));
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
