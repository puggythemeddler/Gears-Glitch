// Regression guard for the Studio section-editing accessibility pass.
//
// The canvas is a visual drag-and-drop editor, so the failure mode is that
// keyboard and screen-reader users can reorder/remove a section but can never
// select one to edit it, or that a decorative glyph is announced as content.
// These assertions keep the section rows keyboard-reachable, keep the action
// buttons labelled and boundary-aware, and keep the focus affordance visible.
// If someone strips the handlers back to mouse-only, this file fails.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = path.join(__dirname, "..");
const builder = fs.readFileSync(
  path.join(repo, "frontend/components/admin/StorefrontBuilder.tsx"),
  "utf8",
);

describe("Studio section editing is keyboard reachable", () => {
  it("makes both the hero and each section a labelled, focusable group", () => {
    assert.equal(
      (builder.match(/role="group"/g) || []).length,
      2,
      "hero and section rows must each be a group",
    );
    assert.equal(
      (builder.match(/role="group"[\s\S]{0,240}?tabIndex=\{0\}/g) || []).length,
      2,
      "each selectable row must be in the tab order",
    );
    assert.match(builder, /aria-label=\{`Hero section/, "hero group needs a label");
    assert.match(
      builder,
      /aria-label=\{`\$\{SECTION_LABELS\[s\.type\] \|\| s\.type\} section/,
      "section group must announce its type",
    );
  });

  it("selects on Enter and Space without stealing inner widget keys", () => {
    assert.equal(
      (builder.match(/e\.key === "Enter" \|\| e\.key === " "/g) || []).length,
      4,
      "hero, sections, palette items and layout cards must all accept Space",
    );
    assert.equal(
      (builder.match(/e\.target !== e\.currentTarget/g) || []).length,
      2,
      "key handling must only run when the row itself is focused",
    );
  });
});

describe("Studio section actions stay operable and labelled", () => {
  it("labels every per-section control", () => {
    for (const label of ["Move up", "Move down", "Duplicate section", "Remove section"]) {
      assert.ok(
        builder.includes(`aria-label="${label}"`),
        `section bar is missing the "${label}" control`,
      );
    }
  });

  it("disables the move controls at the list boundaries", () => {
    assert.match(builder, /aria-label="Move up" disabled=\{i === 0\}/);
    assert.match(
      builder,
      /aria-label="Move down" disabled=\{i === sections\.length - 1\}/,
    );
  });

  it("hides decorative drag grips from assistive tech", () => {
    assert.match(
      builder,
      /className="sb-grip" aria-hidden="true"/,
      "the hero grip must be aria-hidden",
    );
    assert.match(
      builder,
      /className="sb-grip" draggable[\s\S]*?aria-hidden="true"/,
      "the draggable section grip must be aria-hidden",
    );
    assert.match(builder, /title="Drag to reorder"/, "the drag affordance stays discoverable");
  });

  it("gives the inline text editor an accessible name", () => {
    assert.match(builder, /data-sb-overlay\s*\n\s*aria-label="Edit text on canvas"/);
  });
});

describe("Studio focus affordances are visible", () => {
  it("keeps a focus-visible outline for canvas rows and palette items", () => {
    assert.match(builder, /\.sb-section:focus-visible\s*\{/);
    assert.match(builder, /\.sb-palette-item:focus-visible\s*\{/);
    assert.match(builder, /\.sb-section-bar button:focus-visible\s*\{/);
    assert.match(builder, /\.sb-section-bar button:disabled\s*\{[^}]*opacity:/);
  });
});
