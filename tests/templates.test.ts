import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_LIBRARY_VERSION,
  TEMPLATE_LICENSING,
  TEMPLATE_REGISTRY,
  TEMPLATE_SECTION_TYPES,
  getTemplate,
  instantiateTemplateConfig,
  searchTemplates,
  validateTemplate,
  validateTemplateRegistry,
} from "../frontend/lib/templates";

describe("storefront template registry", () => {
  it("ships at least four templates and passes validation", () => {
    assert.ok(TEMPLATE_REGISTRY.length >= 4);
    assert.deepEqual(validateTemplateRegistry(TEMPLATE_REGISTRY), []);
  });

  it("declares a positive library version", () => {
    assert.ok(Number.isInteger(TEMPLATE_LIBRARY_VERSION) && TEMPLATE_LIBRARY_VERSION >= 1);
  });

  it("only uses documented section types and hero styles", () => {
    for (const t of TEMPLATE_REGISTRY) {
      for (const s of t.config.sections ?? []) {
        assert.ok((TEMPLATE_SECTION_TYPES as readonly string[]).includes(s.type), `${t.id} uses unknown section ${s.type}`);
      }
      if (t.config.hero?.style) {
        assert.ok(["carousel", "split", "minimal", "none"].includes(t.config.hero.style));
      }
    }
  });

  it("only uses documented categories", () => {
    for (const t of TEMPLATE_REGISTRY) {
      assert.ok(TEMPLATE_CATEGORIES.includes(t.category));
    }
  });

  it("targets the dynamic engine and is original, licence-clean work", () => {
    for (const t of TEMPLATE_REGISTRY) {
      assert.equal(t.layoutType, "dynamic");
      assert.equal(t.license.origin, "original");
      assert.equal(t.license.assets.length, 0);
      assert.ok(t.version >= 1);
    }
  });

  it("carries no business data in template configs", () => {
    for (const t of TEMPLATE_REGISTRY) {
      const json = JSON.stringify(t.config);
      for (const forbidden of ["\"price\"", "\"stock\"", "\"orderId\"", "\"customerId\"", "\"cost\""]) {
        assert.ok(!json.includes(forbidden), `${t.id} config unexpectedly contains ${forbidden}`);
      }
    }
  });

  it("exposes a machine-readable licensing inventory", () => {
    assert.equal(TEMPLATE_LICENSING.length, TEMPLATE_REGISTRY.length);
    for (const row of TEMPLATE_LICENSING) {
      assert.equal(row.origin, "original");
      assert.equal(row.bundledAssets, 0);
      assert.ok(getTemplate(row.id), `inventory id ${row.id} must resolve`);
    }
  });

  it("has uniquely named and identifiable templates", () => {
    const ids = TEMPLATE_REGISTRY.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ["tech-grid", "minimal-luxe", "bold-commerce", "everyday-store"]) {
      assert.ok(getTemplate(id), `expected built-in template ${id}`);
    }
  });
});

describe("template validation", () => {
  const base = TEMPLATE_REGISTRY[0];

  it("rejects non-objects and missing required fields", () => {
    assert.ok(validateTemplate(null).length > 0);
    assert.ok(validateTemplate("nope").length > 0);
    assert.ok(validateTemplate({}).length > 0);
    assert.ok(validateTemplate({ ...base, id: "" }).some((p) => p.includes("id")));
    assert.ok(validateTemplate({ ...base, name: undefined }).some((p) => p.includes("name")));
  });

  it("rejects an unknown category, hero style, section type and entitlement", () => {
    assert.ok(validateTemplate({ ...base, category: "spaceship" }).some((p) => p.includes("category")));
    assert.ok(validateTemplate({ ...base, config: { ...base.config, hero: { ...base.config.hero, style: "hologram" } } }).some((p) => p.includes("style")));
    assert.ok(validateTemplate({ ...base, config: { ...base.config, sections: [{ type: "hologram" }] } }).some((p) => p.includes("unknown type")));
    assert.ok(validateTemplate({ ...base, requiresEntitlement: "time-travel" }).some((p) => p.includes("entitlement")));
  });

  it("rejects a non-original licence or a bad palette", () => {
    assert.ok(validateTemplate({ ...base, license: { origin: "third-party", holder: "x", spdx: "MIT", assets: [] } }).some((p) => p.includes("license")));
    assert.ok(validateTemplate({ ...base, palette: { bg: "#fff" } }).some((p) => p.includes("palette")));
  });

  it("detects duplicate ids across a registry", () => {
    const dupes = [TEMPLATE_REGISTRY[0], TEMPLATE_REGISTRY[0]];
    assert.ok(validateTemplateRegistry(dupes).some((p) => p.includes("duplicate")));
  });
});

describe("instantiateTemplateConfig", () => {
  it("returns an isolated deep clone that never mutates the registry", () => {
    const t = TEMPLATE_REGISTRY[0];
    const before = JSON.stringify(t.config);
    const instance = instantiateTemplateConfig(t);
    instance.hero!.headline = "CHANGED";
    instance.sections![0].title = "CHANGED";
    assert.equal(JSON.stringify(t.config), before);
    assert.notEqual(instance.hero!.headline, t.config.hero!.headline);
  });

  it("regenerates unique section ids on every apply", () => {
    const t = TEMPLATE_REGISTRY[0];
    const a = instantiateTemplateConfig(t);
    const b = instantiateTemplateConfig(t);
    const idsA = (a.sections ?? []).map((s) => s.id);
    const idsB = (b.sections ?? []).map((s) => s.id);
    assert.equal(new Set(idsA).size, idsA.length);
    assert.equal(new Set(idsB).size, idsB.length);
    assert.ok(idsA.every((id) => !!id));
    for (const id of idsA) assert.ok(!idsB.includes(id));
  });

  it("preserves section order and count", () => {
    for (const t of TEMPLATE_REGISTRY) {
      const instance = instantiateTemplateConfig(t);
      assert.equal(instance.sections?.length, t.config.sections?.length);
      assert.deepEqual((instance.sections ?? []).map((s) => s.type), (t.config.sections ?? []).map((s) => s.type));
    }
  });
});

describe("template search and lookup", () => {
  it("returns the whole library for an empty query", () => {
    assert.equal(searchTemplates(TEMPLATE_REGISTRY).length, TEMPLATE_REGISTRY.length);
    assert.equal(searchTemplates(TEMPLATE_REGISTRY, { query: "   " }).length, TEMPLATE_REGISTRY.length);
  });

  it("filters by category", () => {
    const lux = searchTemplates(TEMPLATE_REGISTRY, { category: "luxe" });
    assert.ok(lux.length >= 1);
    assert.ok(lux.every((t) => t.category === "luxe"));
  });

  it("matches name, tagline, tag and description terms", () => {
    assert.ok(searchTemplates(TEMPLATE_REGISTRY, { query: "tech" }).some((t) => t.id === "tech-grid"));
    assert.ok(searchTemplates(TEMPLATE_REGISTRY, { query: "minimal" }).some((t) => t.id === "minimal-luxe"));
  });

  it("returns an empty list for a query with no matches", () => {
    assert.deepEqual(searchTemplates(TEMPLATE_REGISTRY, { query: "zzzzz" }), []);
  });

  it("looks templates up by id", () => {
    assert.equal(getTemplate("tech-grid")?.name, "Tech Grid");
    assert.equal(getTemplate("nope"), undefined);
  });

  it("exposes a licence inventory row per template", () => {
    for (const row of TEMPLATE_LICENSING) {
      assert.equal(row.origin, "original");
      assert.equal(row.bundledAssets, 0);
      assert.equal(typeof row.spdx, "string");
    }
  });
});
