import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  deriveHealthState,
  heartbeatAgeMinutes,
  isSubExpiring,
  normalizeHeartbeat,
} from "../server/ops";

describe("deriveHealthState", () => {
  it("maps provisioning/failed/disabled statuses directly", () => {
    assert.equal(deriveHealthState({ status: "provisioning" }).status, "provisioning");
    assert.equal(deriveHealthState({ status: "failed" }).status, "failed");
    assert.equal(deriveHealthState({ status: "suspended" }).status, "disabled");
    assert.equal(deriveHealthState({ status: "disabled" }).status, "disabled");
  });

  it("falls back to a default status when none supplied", () => {
    assert.equal(deriveHealthState({}).status, "unknown");
  });

  it("maps health_check 'down' and 'sleeping' to offline/sleeping", () => {
    assert.equal(deriveHealthState({ status: "active", health_status: "down" }).status, "offline");
    assert.equal(deriveHealthState({ status: "active", health_status: "sleeping" }).status, "sleeping");
  });

  it("healthy with a failing required check is degraded", () => {
    const s = deriveHealthState({
      status: "active",
      health_status: "healthy",
      latest_checks: JSON.stringify({ db: { status: "fail" }, storage: { status: "ok" }, payments: { status: "ok" } }),
    });
    assert.equal(s.status, "degraded");
    assert.match(s.reason, /db/);
  });

  it("healthy with all required checks passing is healthy", () => {
    const s = deriveHealthState({
      status: "active",
      health_status: "healthy",
      latest_checks: JSON.stringify({ db: { status: "ok" }, storage: { status: "ok" }, payments: { status: "ok" } }),
    });
    assert.equal(s.status, "healthy");
  });

  it("active without any health signal is unknown", () => {
    assert.equal(deriveHealthState({ status: "active" }).status, "unknown");
  });

  it("tolerates malformed latest_checks JSON", () => {
    const s = deriveHealthState({ status: "active", health_status: "healthy", latest_checks: "not-json" });
    assert.equal(s.status, "healthy");
  });
});

describe("heartbeatAgeMinutes", () => {
  const now = Date.now();

  it("returns null when there is no heartbeat", () => {
    assert.equal(heartbeatAgeMinutes(undefined, now), null);
    assert.equal(heartbeatAgeMinutes(null, now), null);
    assert.equal(heartbeatAgeMinutes("", now), null);
  });

  it("returns null for an unparseable timestamp", () => {
    assert.equal(heartbeatAgeMinutes("definitely-not-a-date", now), null);
  });

  it("computes whole minutes since the heartbeat", () => {
    const threeMinAgo = new Date(now - 3 * 60000).toISOString();
    assert.equal(heartbeatAgeMinutes(threeMinAgo, now), 3);
  });

  it("clamps at zero for future timestamps", () => {
    const fiveMinAhead = new Date(now + 5 * 60000).toISOString();
    assert.equal(heartbeatAgeMinutes(fiveMinAhead, now), 0);
  });
});

describe("isSubExpiring", () => {
  const now = Date.now();

  it("returns false when no subscription expiry is recorded", () => {
    assert.equal(isSubExpiring(undefined), false);
    assert.equal(isSubExpiring(null), false);
    assert.equal(isSubExpiring(""), false);
  });

  it("returns false for an unparseable date", () => {
    assert.equal(isSubExpiring("nonsense"), false);
  });

  it("returns false well before the 7-day window", () => {
    const farFuture = new Date(now + 30 * 86400000).toISOString();
    assert.equal(isSubExpiring(farFuture), false);
  });

  it("returns true inside the 7-day window", () => {
    const soon = new Date(now + 2 * 86400000).toISOString();
    assert.equal(isSubExpiring(soon), true);
  });
});

describe("normalizeHeartbeat", () => {
  it("rejects non-object payloads", () => {
    assert.equal(normalizeHeartbeat(null), null);
    assert.equal(normalizeHeartbeat(undefined), null);
    assert.equal(normalizeHeartbeat("string"), null);
    assert.equal(normalizeHeartbeat([1, 2]), null);
  });

  it("prefers appVersion and falls back to version", () => {
    assert.equal(normalizeHeartbeat({ version: "9.9" })!.appVersion, "9.9");
    assert.equal(normalizeHeartbeat({ appVersion: "8.8", version: "9.9" })!.appVersion, "8.8");
  });

  it("coerces scalar fields and defaults readiness", () => {
    const p = normalizeHeartbeat({ appVersion: "1.2.3", schemaVersion: "s1", envType: "prod" })!;
    assert.equal(p.appVersion, "1.2.3");
    assert.equal(p.schemaVersion, "s1");
    assert.equal(p.envType, "prod");
    assert.equal(p.readiness, "ok");
  });

  it("copies checks objects and casts capabilities to strings", () => {
    const p = normalizeHeartbeat({
      checks: { db: { status: "ok" } },
      capabilities: ["mpesa", 1, true],
    })!;
    assert.deepEqual(p.checks, { db: { status: "ok" } });
    assert.deepEqual(p.capabilities, ["mpesa", "1", "true"]);
  });

  it("rejects non-object checks without failing", () => {
    const p = normalizeHeartbeat({ checks: "nope" })!;
    assert.deepEqual(p.checks, {});
  });

  it("rejects oversized payloads", () => {
    const oversized = normalizeHeartbeat({ checks: { blob: "x".repeat(30000) } });
    assert.equal(oversized, null);
  });
});