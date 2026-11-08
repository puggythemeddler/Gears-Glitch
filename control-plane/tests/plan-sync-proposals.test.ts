import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeClientPlanProposal } from "../server/plan-sync-proposals";

describe("normalizeClientPlanProposal", () => {
  it("normalizes a valid share request into bounded plan fields", () => {
    assert.deepEqual(normalizeClientPlanProposal({
      id: "client-premium",
      name: " Premium ",
      description: "Shared plan",
      price: 1500,
      priceAnnual: 15000,
      tierLevel: 2,
      maxProducts: 250,
      maxBranches: 3,
      features: ["Inventory", "POS"],
      isActive: true,
      syncToOthers: true,
    }), {
      id: "client-premium",
      name: "Premium",
      description: "Shared plan",
      price: 1500,
      priceAnnual: 15000,
      tierLevel: 2,
      maxProducts: 250,
      maxBranches: 3,
      features: ["Inventory", "POS"],
      isActive: true,
      syncToOthers: true,
    });
  });

  it("does not create a proposal when the tenant opted out", () => {
    assert.equal(normalizeClientPlanProposal({ id: "local-only", name: "Local", syncToOthers: false }), null);
  });

  it("rejects malformed identifiers, invalid numbers, and non-string features", () => {
    assert.equal(normalizeClientPlanProposal({ id: "../shared", name: "Bad", syncToOthers: true }), null);
    assert.equal(normalizeClientPlanProposal({ id: "valid", name: "Bad", price: Infinity, syncToOthers: true }), null);
    assert.equal(normalizeClientPlanProposal({ id: "valid", name: "Bad", features: [{ html: "x" }], syncToOthers: true }), null);
  });

  it("rejects proposals with unbounded fields", () => {
    assert.equal(normalizeClientPlanProposal({ id: "valid", name: "x".repeat(101), syncToOthers: true }), null);
    assert.equal(normalizeClientPlanProposal({ id: "valid", name: "ok", features: Array(101).fill("x"), syncToOthers: true }), null);
  });
});
