import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterOnlineFulfillmentBranches } from "../server/online-fulfillment";

describe("online fulfillment branches", () => {
  it("only exposes active branches explicitly enabled for online orders", () => {
    const branches = [
      { id: 1, name: "Customer store", isActive: true, onlineFulfillmentEnabled: true },
      { id: 2, name: "Internal test", isActive: true, onlineFulfillmentEnabled: false },
      { id: 3, name: "Closed store", isActive: false, onlineFulfillmentEnabled: true },
    ];

    assert.deepEqual(filterOnlineFulfillmentBranches(branches), [branches[0]]);
  });
});
