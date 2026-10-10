import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSlug,
  isReservedSlug,
  sanitizeSections,
  sanitizePageConfig,
  pagePublishError,
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

  it("sanitizes the hero key, keeping known fields and enums", () => {
    const out = sanitizePageConfig({
      hero: {
        enabled: true,
        style: "minimal",
        badge: "New",
        headline: "Hi there",
        subtitle: "Sub",
        ctaText: "Shop",
        ctaLink: "/products",
        backgroundImage: "https://cdn/x.jpg",
        featuredCategory: "tops",
        evil: "drop",
      },
    });
    assert.deepEqual(out.hero, {
      enabled: true,
      style: "minimal",
      badge: "New",
      headline: "Hi there",
      subtitle: "Sub",
      ctaText: "Shop",
      ctaLink: "/products",
      backgroundImage: "https://cdn/x.jpg",
      featuredCategory: "tops",
    });
  });

  it("coerces hero enums and rejects unknown variants", () => {
    const out = sanitizePageConfig({
      hero: { enabled: "yes", style: "wild", buttons: [{ label: "Go", link: "/", variant: "bogus" }] },
    });
    assert.equal(out.hero.enabled, undefined);
    assert.equal(out.hero.style, undefined);
    assert.equal(out.hero.buttons[0].variant, undefined);
  });

  it("preserves every supported Dynamic Engine hero style", () => {
    for (const style of ["carousel", "split", "minimal", "none"]) {
      const out = sanitizePageConfig({ hero: { style, headline: "Hi" } });
      assert.equal(out.hero.style, style, `${style} should round-trip`);
    }
  });

  it("caps hero string lengths and button count", () => {
    const out = sanitizePageConfig({
      hero: {
        headline: "x".repeat(1000),
        buttons: Array.from({ length: 10 }, (_, i) => ({ label: `b${i}`.repeat(200), link: "/", variant: i === 3 ? "outline" : "bogus" })),
      },
    });
    assert.equal(out.hero.headline.length, 300);
    assert.equal(out.hero.buttons.length, 6);
    assert.equal(out.hero.buttons[0].label.length, 120);
    assert.equal(out.hero.buttons[3].variant, "outline");
  });

  it("drops hero when it is empty or not an object", () => {
    assert.equal(sanitizePageConfig({ hero: {} }).hero, undefined);
    assert.equal(sanitizePageConfig({ hero: null }).hero, undefined);
    assert.equal(sanitizePageConfig({ hero: "yes" }).hero, undefined);
  });

  it("keeps validated hero effect toggles and intensity", () => {
    const out = sanitizePageConfig({
      hero: { headline: "Hi", effects: { interactive: true, spotlight: false, parallax: true, tilt: true, entrance: false, intensity: "expressive" } },
    });
    assert.deepEqual(out.hero.effects, { interactive: true, spotlight: false, parallax: true, tilt: true, entrance: false, intensity: "expressive" });
  });

  it("drops unknown effect keys, non-booleans and bad intensities", () => {
    const out = sanitizePageConfig({
      hero: { effects: { interactive: "yes", spotlight: true, parallax: 1, evil: true, intensity: "wild" } },
    });
    assert.deepEqual(out.hero.effects, { spotlight: true });
  });

  it("ignores effect payloads that are not objects", () => {
    assert.equal(sanitizePageConfig({ hero: { headline: "Hi", effects: "on" } }).hero.effects, undefined);
    assert.equal(sanitizePageConfig({ hero: { headline: "Hi", effects: [] } }).hero.effects, undefined);
    assert.equal(sanitizePageConfig({ hero: { headline: "Hi", effects: 42 } }).hero.effects, undefined);
  });

  it("drops an effects object that sanitizes to nothing", () => {
    assert.equal(sanitizePageConfig({ hero: { headline: "Hi", effects: { evil: true } } }).hero.effects, undefined);
  });

  it("sanitizes the productCard key", () => {
    const out = sanitizePageConfig({
      productCard: { style: "detailed", showRating: true, showSalePrice: false, evil: 1 },
    });
    assert.deepEqual(out.productCard, { style: "detailed", showRating: true, showSalePrice: false });
  });

  it("drops productCard when empty or invalid", () => {
    assert.equal(sanitizePageConfig({ productCard: {} }).productCard, undefined);
    assert.equal(sanitizePageConfig({ productCard: { style: "bogus" } }).productCard, undefined);
  });

  it("whitelists accent, heroBg and heroText colors", () => {
    const out = sanitizePageConfig({
      colors: { accent: "#a11", heroBg: "#000", heroText: "#fff", evil: "#fff" },
    });
    assert.deepEqual(out.colors, { accent: "#a11", heroBg: "#000", heroText: "#fff" });
  });

  it("keeps an already-sanitized hero and colors untouched", () => {
    const out = sanitizePageConfig({ hero: { headline: "Keep" }, colors: { accent: "#123" } });
    assert.deepEqual(out.hero, { headline: "Keep" });
    assert.deepEqual(out.colors, { accent: "#123" });
  });

  it("returns an empty object for an empty config object", () => {
    assert.deepEqual(sanitizePageConfig({}), {});
    assert.deepEqual(sanitizePageConfig({ extra: true }), {});
  });
});

describe("pagePublishError", () => {
  it("allows a valid titled page with a normalized, non-reserved slug", () => {
    assert.equal(pagePublishError({ slug: "qa-test-page", title: "QA Test Page" }), null);
    assert.equal(pagePublishError({ slug: "our-story", title: "About us" }), null);
  });

  it("rejects a missing or oversized title", () => {
    assert.match(pagePublishError({ slug: "qa-test-page", title: "" }) || "", /Title is required/);
    assert.match(pagePublishError({ slug: "qa-test-page", title: "   " }) || "", /Title is required/);
    assert.match(pagePublishError({ slug: "qa-test-page", title: 42 }) || "", /Title is required/);
    assert.match(pagePublishError({ slug: "qa-test-page", title: "x".repeat(201) }) || "", /200 characters/);
  });

  it("rejects an invalid or non-normalized slug", () => {
    assert.match(pagePublishError({ slug: "ab", title: "Short" }) || "", /invalid slug/);
    assert.match(pagePublishError({ slug: "has_underscore", title: "T" }) || "", /invalid slug/);
    assert.match(pagePublishError({ slug: "Mixed-Case", title: "T" }) || "", /invalid slug/);
    assert.match(pagePublishError({ slug: "a".repeat(81), title: "T" }) || "", /invalid slug/);
    assert.match(pagePublishError({ slug: "", title: "T" }) || "", /invalid slug/);
  });

  it("rejects reserved slugs", () => {
    assert.match(pagePublishError({ slug: "about", title: "About" }) || "", /reserved/);
    assert.match(pagePublishError({ slug: "admin", title: "Admin" }) || "", /reserved/);
    assert.match(pagePublishError({ slug: "pages", title: "Pages" }) || "", /reserved/);
  });
});