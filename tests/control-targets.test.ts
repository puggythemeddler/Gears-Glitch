import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const repoRoot = path.join(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), "utf8");

describe("control touch targets meet the 44px floor", () => {
  const css = read("frontend/styles/globals.css");

  it("defines the control size token at 44px", () => {
    assert.match(css, /--control-min-height:\s*44px/);
  });

  it("every button variant carries the floor, not just the default size", () => {
    // Match the bare .btn rule, not ".identity-card .btn" or ".btn-primary".
    const baseBlockStart = css.search(/(^|\n)\.btn\s*\{/);
    assert.ok(baseBlockStart >= 0, "bare .btn rule exists");
    const base = css.slice(baseBlockStart, baseBlockStart + 700);
    assert.match(base, /min-height:\s*var\(--control-min-height\)/, "bare .btn reaches the control floor");
    for (const selector of [".btn-sm", ".btn-lg"]) {
      const at = css.indexOf(selector);
      assert.ok(at >= 0, `${selector} exists`);
      assert.match(
        css.slice(at, at + 400),
        /min-height:\s*var\(--control-min-height\)/,
        `expected ${selector} to reach the control floor`,
      );
    }
  });

  it("no CSS rule re-pins a control below 44px", () => {
    const offenders: string[] = [];
    const lines = css.split("\n");
    let currentRule = "";
    lines.forEach((line, i) => {
      const sel = /^([.#][^{]+)\s*\{/.exec(line.trim());
      if (sel) currentRule = sel[1];
      if (!/min-height:\s*(2[0-9]|3[0-9])px/.test(line) && !/min-width:\s*(2[0-9]|3[0-9])px/.test(line)) return;
      // .brand and .breadcrumbs retain a compact desktop default that the
      // coarse-pointer scope raises to 44px; dash-attention-value is a stat
      // readout, not a control.
      if (/\.skip-link|\.brand|\.breadcrumbs|dash-attention/.test(currentRule)) return;
      offenders.push(`${i + 1} [${currentRule}]: ${line.trim()}`);
    });
    assert.deepEqual(offenders, []);
  });

  it("the coarse-pointer scope raises form, nav and search controls", () => {
    const coarseStart = css.indexOf("@media (pointer: coarse)");
    assert.ok(coarseStart >= 0, "coarse-pointer scope exists");
    const coarse = css.slice(coarseStart);
    for (const sel of [".header-search-form", ".input", ".filter-select", ".mobile-menu-toggle", ".auth-tab", ".skip-link", ".brand", ".breadcrumbs li a"]) {
      assert.ok(coarse.includes(sel), `coarse scope must include ${sel}`);
    }
  });

  it("no hidden POS override defeats the floor", () => {
    assert.ok(!/\.pos-cart-panel\s+\.btn-sm/.test(css), ".pos-cart-panel override removed");
  });
});

describe("reduced-motion is a global kill switch", () => {
  const css = read("frontend/styles/globals.css");

  it("has a comprehensive prefers-reduced-motion block", () => {
    const blocks = css.match(/@media \(prefers-reduced-motion: reduce\)/g) || [];
    assert.ok(blocks.length >= 2);
    const lastKingdom = css.lastIndexOf("@media (prefers-reduced-motion: reduce)");
    const block = css.slice(lastKingdom);
    assert.match(block, /\*\s*,\s*\*::before/);
    assert.match(block, /transition-duration:\s*0\.01ms\s*!important/);
    assert.match(block, /animation-iteration-count:\s*1\s*!important/);
  });
});

describe("status text never uses a fill token", () => {
  const files = ["frontend/styles/globals.css", "frontend/styles/marketing.css", "frontend/styles/animations.css"];

  it("color: declarations use the -text role for status colours", () => {
    const offenders: string[] = [];
    for (const rel of files) {
      read(rel)
        .split("\n")
        .forEach((line, i) => {
          if (!/(^|[;{\s])color:\s*var\(--(success|warning|danger|info)\)/.test(line)) return;
          if (/background|border|outline|fill|stroke/.test(line.split("color:")[0])) return;
          offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
        });
    }
    assert.deepEqual(offenders, []);
  });

  it("the fill and text tokens diverge materially (fills are for surfaces)", () => {
    const light = read("frontend/styles/globals.css").slice(0, read("frontend/styles/globals.css").indexOf("/* Dark theme"));
    assert.match(light, /--success:\s*#[0-9a-f]+;/);
    assert.match(light, /--success-text:\s*#[0-9a-f]+;/);
    const fill = /--success:\s*(#[0-9a-f]+)/.exec(light);
    const text = /--success-text:\s*(#[0-9a-f]+)/.exec(light);
    assert.ok(fill && text && fill[1] !== text[1]);
  });
});

describe("radius scale matches the approved DESIGN.md band", () => {
  it("controls sit in 10-14px and prominent surfaces in 14-18px", () => {
    const css = read("frontend/styles/globals.css");
    assert.match(css, /--radius-sm:\s*10px/);
    assert.match(css, /--radius-md:\s*12px/);
    assert.match(css, /--radius-lg:\s*14px/);
    assert.match(css, /--radius-xl:\s*18px/);
  });

  it("DESIGN.md documents the same scale", () => {
    const design = read("DESIGN.md");
    for (const pair of [
      ["10px", "small controls"],
      ["12px", "buttons, inputs"],
      ["14px", "cards, panels"],
      ["18px", "modals, large containers"],
    ]) {
      assert.ok(design.includes(pair[0]), `DESIGN.md should list ${pair[0]}`);
    }
    assert.match(design, /Controls occupy the 10(–|-|-)14px band/);
  });
});