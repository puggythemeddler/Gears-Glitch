import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldRejectUnlocatedStockWrite } from "../server/stock-location-guard";

describe("unlocated stock write guard", () => {
  it("rejects positive stock without a branch when branches exist", () => {
    assert.equal(shouldRejectUnlocatedStockWrite(null, 1, 2), true);
  });

  it("allows zeroing legacy unlocated stock", () => {
    assert.equal(shouldRejectUnlocatedStockWrite(null, 0, 2), false);
  });

  it("allows positive stock when a branch is selected", () => {
    assert.equal(shouldRejectUnlocatedStockWrite(7, 1, 2), false);
  });

  it("allows unlocated stock in a single-location account with no branches", () => {
    assert.equal(shouldRejectUnlocatedStockWrite(null, 1, 0), false);
  });
});
