import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeFeatureName,
  featureListIncludes,
  parseFeatureOverrides,
  applyFeatureOverrides,
  parseBranchFeatureOverrides,
  branchFeatureOverride,
  isBranchFeatureEnabled,
  setBranchFeatureOverride,
  normalizeBranchFeatureOverrides,
} from "../server/feature-rules";

describe("feature-rules", () => {
  it("matches feature names case-insensitively", () => {
    assert.equal(normalizeFeatureName("  Lipa Mdogo Mdogo  "), "lipa mdogo mdogo");
    assert.equal(featureListIncludes(["Repair ticketing"], "repair ticketing"), true);
    assert.equal(featureListIncludes(["Repair ticketing"], "Lipa Mdogo Mdogo"), false);
    assert.equal(featureListIncludes(null, "anything"), false);
  });

  it("parses only boolean overrides", () => {
    assert.deepEqual(parseFeatureOverrides('{"a":true,"b":false,"c":"yes","d":1}'), { a: true, b: false });
    assert.deepEqual(parseFeatureOverrides("{not json"), {});
    assert.deepEqual(parseFeatureOverrides("[true]"), {});
    assert.deepEqual(parseFeatureOverrides(null), {});
  });

  it("applies false to remove and true to force-add", () => {
    const out = applyFeatureOverrides(["A", "B", "C"], { B: false, D: true });
    assert.deepEqual(out, ["A", "C", "D"]);
  });

  it("parses branch overrides keyed by feature then branch", () => {
    const parsed = parseBranchFeatureOverrides('{"Lipa Mdogo Mdogo":{"3":false,"4":true},"X":{"bad":true}}');
    assert.deepEqual(parsed, { "Lipa Mdogo Mdogo": { "3": false, "4": true } });
  });

  it("reads a single branch override", () => {
    const map = { "Lipa Mdogo Mdogo": { "3": false } };
    assert.equal(branchFeatureOverride(map, "Lipa Mdogo Mdogo", 3), false);
    assert.equal(branchFeatureOverride(map, "Lipa Mdogo Mdogo", "3"), false);
    assert.equal(branchFeatureOverride(map, "Lipa Mdogo Mdogo", 9), undefined);
    assert.equal(branchFeatureOverride(map, "Other", 3), undefined);
    assert.equal(branchFeatureOverride(map, "Lipa Mdogo Mdogo", null), undefined);
  });

  it("blocks only when unentitled or explicitly disabled for the branch", () => {
    const disabled = { "Lipa Mdogo Mdogo": { "3": false } };
    assert.equal(isBranchFeatureEnabled(false, {}, "Lipa Mdogo Mdogo", 3), false);
    assert.equal(isBranchFeatureEnabled(true, {}, "Lipa Mdogo Mdogo", 3), true);
    assert.equal(isBranchFeatureEnabled(true, disabled, "Lipa Mdogo Mdogo", 3), false);
    assert.equal(isBranchFeatureEnabled(true, disabled, "Lipa Mdogo Mdogo", 4), true);
    assert.equal(isBranchFeatureEnabled(true, disabled, "Lipa Mdogo Mdogo", null), true);
  });

  it("sets and clears branch overrides without mutating the input", () => {
    const base = {};
    const on = setBranchFeatureOverride(base, "Lipa Mdogo Mdogo", 3, true);
    assert.deepEqual(on, { "Lipa Mdogo Mdogo": { "3": true } });
    assert.deepEqual(base, {});
    const off = setBranchFeatureOverride(on, "Lipa Mdogo Mdogo", 3, false);
    assert.deepEqual(off, { "Lipa Mdogo Mdogo": { "3": false } });
    const cleared = setBranchFeatureOverride(off, "Lipa Mdogo Mdogo", 3, null);
    assert.deepEqual(cleared, {});
  });

  it("normalizes untrusted branch override payloads", () => {
    const out = normalizeBranchFeatureOverrides({
      "Lipa Mdogo Mdogo": { "3": true, "abc": true, "4": "yes" },
      "Bad": "nope",
      "Empty": {},
    });
    assert.deepEqual(out, { "Lipa Mdogo Mdogo": { "3": true } });
    assert.deepEqual(normalizeBranchFeatureOverrides(null), {});
    assert.deepEqual(normalizeBranchFeatureOverrides([1, 2]), {});
  });
});
