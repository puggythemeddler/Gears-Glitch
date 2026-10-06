// Regression guards for the notification bell's honest-state semantics.
//
// The bell previously polled on a hard 10s interval and swallowed every failure
// into `return 0`, so a backend cold start or outage read exactly the same as
// "no notifications". These guards enforce the new distinction: a dropped
// request surfaces as "unavailable" (no false zero), applies exponential backoff
// capped at 60s, and respects document visibility.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = path.join(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(repo, rel), "utf8");
const bell = read("frontend/components/NotificationBell.tsx");

describe("NotificationBell failure semantics", () => {
  it("distinguishes unavailable from zero notifications", () => {
    assert.match(bell, /"unavailable"/);
    assert.match(bell, /setState\("unavailable"\)/);
    assert.match(bell, /label\s*=\s*state === "unavailable"/);
    assert.doesNotMatch(bell, /catch \{ return 0; \}/, "a failed request must not produce a silent zero");
  });

  it("cloaks the badge when availability is unknown", () => {
    assert.match(bell, /state === "ok" && count > 0/);
    assert.match(bell, /aria-label=\{label\}/);
  });

  it("backs off exponentially, capped at 60s", () => {
    assert.match(bell, /backoffRef\.current \* 2/);
    assert.match(bell, /Math\.min\([^)]*60000/);
    assert.match(bell, /setTimeout/);
  });

  it("skips polling while the tab is hidden", () => {
    assert.match(bell, /document\.visibilityState !== "visible"/);
  });

  it("re-reads the session on each poll so role flips are honoured", () => {
    assert.match(bell, /getMsgEndpoint\(\)/);
    assert.match(bell, /endpointRef\.current = ep/);
  });

  it("keeps the last known count instead of blanking it on failure", () => {
    assert.match(bell, /Keep the last/);
    assert.doesNotMatch(bell, /setCount\(0\);\s*setState\("unavailable"\)/, "zeroing the count on failure would lie");
  });

  it("restores normal cadence once the service recovers", () => {
    assert.match(bell, /backoffRef\.current = 10000/);
  });

  it("styles the unavailable state with a warm warning tint", () => {
    const css = read("frontend/styles/globals.css");
    assert.match(css, /\.bell-btn\.bell-unavailable/);
    assert.match(css, /var\(--warning\)/);
  });
});