// Regression guard for Studio draft-safety.
//
// Two silent-failure modes are easy to reintroduce: a layout whose config fails
// to load leaves the toolbar pointing at it while the canvas still shows the
// previous layout (no error visible, because `error` only renders when the
// gallery is empty), and closing the tab with unsaved edits loses them without
// warning. These assertions keep both guarded.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = path.join(__dirname, "..");
const builder = fs.readFileSync(
  path.join(repo, "frontend/components/admin/StorefrontBuilder.tsx"),
  "utf8",
);

describe("Studio load failures are visible", () => {
  it("reports a failed layout load and clears the stale selection", () => {
    assert.match(
      builder,
      /setMsg\("Failed to load layout: " \+ m\)/,
      "a failed load must be announced on the always-rendered message channel",
    );
    assert.match(
      builder,
      /Failed to load layout\.[\s\S]{0,220}?setSelectedId\(null\)/,
      "a failed load must not leave the toolbar pointing at an unloaded layout",
    );
  });
});

describe("Studio warns before discarding unsaved drafts", () => {
  it("guards unload only while the draft is dirty", () => {
    assert.match(builder, /window\.addEventListener\("beforeunload"/);
    assert.match(
      builder,
      /if \(!dirty\) return;[\s\S]{0,220}?beforeunload/,
      "the unload guard must be conditional on being dirty",
    );
  });
});
