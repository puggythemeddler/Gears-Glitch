import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSlug,
  isReservedSlug,
  sanitizeSections,
  sanitizePageConfig,
  PAGE_SECTION_TYPES,
} from "../server/pages";

describe("normalizeSlug", () => {
  it("accepts a clean kebab-case slug", () => {
    assert.equal(normalizeSlug("our-story"), "our-story");
    assert.equal(normalizeSlug("Repair Process"), "repair-process");
  });

  it("normalizes case and whitespace, rejects stray symbols", () => {
    assert.equal(normalizeSlug("  FAQ Terms  "), "faq-terms");
    assert.equal(normalizeSlug("Repair\t Process"), "repair-process");
    assert.equal(normalizeSlug("faq&terms"), null);
  });

  it("rejects non-strings, empty, too short, or too long slugs", () => {
    assert.equal(normalizeSlug(123), null);
    assert.equal(normalizeSlug(null), null);
    assert.equal(normalizeSlug("ab"), null);
    assert.equal(normalizeSlug(""), null);
    assert.equal(normalizeSlug("a".repeat(81)), null);
    assert.equal(normalizeSlug("has_underscore"), null);
    assert.equal(normalizeSlug("with.period"), null);
    assert.equal(normalizeSlug("with/slash"), null);
  });

  it("strips surrounding dashes and collapses runs", () => {
    assert.equal(normalizeSlug("-start-with-dash"), "start-with-dash");
    assert.equal(normalizeSlug("ends-with-dash-"), "ends-with-dash");
    assert.equal(normalizeSlug("a--b"), "a-b");
  });

  it("accepts exactly 3 and 80 characters", () => {
    assert.equal(normalizeSlug("abc"), "abc");
    assert.equal(normalizeSlug("a".repeat(80)), "a".repeat(80));
  });
});

describe("isReservedSlug", () => {
  it("flags routing-related slugs", () => {
    for (const s of ["admin", "api", "product", "products", "about", "contact", "cart", "page", "pages", "repairs", "login", "groups", "categories", "dashboard"]) {
      assert.equal(isReservedSlug(s), true, `${s} should be reserved`);
    }
  });

  it("allows free slugs", () => {
    for (const s of ["our-story", "returns-policy", "shipping", "faq", "privacy"]) {
      assert.equal(isReservedSlug(s), false, `${s} should be allowed`);
    }
  });
});

describe("sanitizeSections", () => {
  it("filters unknown types and non-objects", () => {
    const out = sanitizeSections([
      { type: "banner", title: "Hi" },
      { type: "evil-widget", title: "X" },
      42,
      "nope",
      { type: "text", title: "ok" },
    ]);
    assert.equal(out.length, 2);
    assert.deepEqual(out.map((s) => s.type), ["banner", "text"]);
  });

  it("caps section count, string lengths, and items", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ type: "text", title: `t${i}` }));
    const out = sanitizeSections(many);
    assert.equal(out.length, 40);

    const one = sanitizeSections([
      { type: "features", title: "x".repeat(1000), items: Array.from({ length: 30 }, (_, i) => ({ title: `item ${i}` })) },
    ]);
    assert.equal(one[0].title.length, 500);
    assert.equal(one[0].items.length, 12);
  });

  it("coerces recognized enums and numeric fields", () => {
    const out = sanitizeSections([
      {
        type: "banner",
        productFilter: "featured",
        align: "center",
        height: 9999,
        hideOnMobile: true,
        style: "cards",
        variant: "outline",
        size: "lg",
        columns: 90,
        title: "Banner",
        productFilterBad: "upgrade",
        alignBad: "right",
      },
    ]);
    assert.equal(out[0].productFilter, "featured");
    assert.equal(out[0].align, "center");
    assert.equal(out[0].height, 48);
    assert.equal(out[0].columns, 48);
    assert.equal(out[0].hideOnMobile, true);
    assert.equal(out[0].style, "cards");
    assert.equal(out[0].variant, "outline");
    assert.equal(out[0].size, "lg");
    assert.equal(out[0].title, "Banner");
  });

  it("drops items that are not arrays and sanitizes item fields", () => {
    const out = sanitizeSections([{ type: "features", items: "none" }, { type: "stats", items: [{ value: 1, label: "Stores" }] }]);
    assert.equal(out[0].items, undefined);
    assert.deepEqual(out[1].items, [{ value: "1", label: "Stores" }]);
  });

  it("only admits whitelisted section types", () => {
    assert.ok(PAGE_SECTION_TYPES.includes("text"));
    assert.ok(PAGE_SECTION_TYPES.includes("product-grid"));
    assert.ok(!(PAGE_SECTION_TYPES as readonly string[]).includes("hero"));
  });
});

describe("sanitizePageConfig", () => {
  it("rejects non-objects", () => {
    assert.deepEqual(sanitizePageConfig(null), { sections: [] });
    assert.deepEqual(sanitizePageConfig("text"), { sections: [] });
    assert.deepEqual(sanitizePageConfig([]), { sections: [] });
  });

  it("keeps only whitelisted color keys", () => {
    const out = sanitizePageConfig({ sections: [], colors: { accent: "#ff0000", heroBg: "#000", evil: "#fff" } });
    assert.deepEqual(out.colors, { accent: "#ff0000", heroBg: "#000" });
  });

  it("sanitizes nested sections", () => {
    const out = sanitizePageConfig({ sections: [{ type: "text", title: "Hi", evil: 1 }], extra: true });
    assert.equal(out.sections.length, 1);
    assert.equal(out.extra, undefined);
    assert.equal(out.sections[0].evil, undefined);
  });
});