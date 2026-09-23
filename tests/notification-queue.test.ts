import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deliveryBackoffMs } from "../server/notification-service";

describe("deliveryBackoffMs", () => {
  it("returns an immediate short backoff for the first retry", () => {
    assert.equal(deliveryBackoffMs(1), 30_000);
  });

  it("grows exponentially then caps at one hour", () => {
    assert.equal(deliveryBackoffMs(2), 2 * 60_000);
    assert.equal(deliveryBackoffMs(3), 10 * 60_000);
    assert.equal(deliveryBackoffMs(4), 30 * 60_000);
    assert.equal(deliveryBackoffMs(5), 60 * 60_000);
    assert.equal(deliveryBackoffMs(99), 60 * 60_000, "must cap so a long-lived dead row never spins");
  });

  it("degrades gracefully on degenerate input", () => {
    assert.equal(deliveryBackoffMs(0), 30_000);
    assert.equal(deliveryBackoffMs(-5), 30_000);
  });
});