import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isWithinBranchLimit } from "../server/branch-limits";

describe("isWithinBranchLimit", () => {
  it("allows branch creation when no shop limit is configured", () => {
    assert.equal(isWithinBranchLimit(0, null), true);
  });

  it("treats the negative unlimited sentinel as unlimited", () => {
    assert.equal(isWithinBranchLimit(0, -1), true);
    assert.equal(isWithinBranchLimit(500, -1), true);
  });

  it("allows creation below a positive limit and blocks at the limit", () => {
    assert.equal(isWithinBranchLimit(1, 2), true);
    assert.equal(isWithinBranchLimit(2, 2), false);
  });

  it("preserves a literal zero limit", () => {
    assert.equal(isWithinBranchLimit(0, 0), false);
  });
});
