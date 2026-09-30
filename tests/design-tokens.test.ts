// Regression guard for the Phase 2 interaction / colour / design-system pass.
//
// The point of this file is to make the design system *falsifiable*: if someone
// adds a semantic role to one theme only, drops the -text role for status copy,
// hardcodes a radius in the layout engine, or reintroduces `transition: all`,
// these tests fail instead of the drift shipping quietly.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = path.join(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(repo, rel), "utf8");

const globals = read("frontend/styles/globals.css");
const DARK_START = globals.indexOf('[data-theme="dark"] {');
assert.ok(DARK_START > 0, 'globals.css must declare a [data-theme="dark"] block');
const LIGHT_CSS = globals.slice(0, DARK_START);
const DARK_CSS = globals.slice(DARK_START);

const THEMES = [
  { name: "light", css: LIGHT_CSS },
  { name: "dark", css: DARK_CSS },
] as const;

function token(css: string, name: string, label: string): string {
  const bare = name.replace(/^--/, "");
  const m = new RegExp(`^\\s*--${bare}:\\s*([^;]+);`, "m").exec(css);
  assert.ok(m, `${label} theme is missing --${bare}`);
  return m![1].trim();
}

function hex(value: string): number[] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  assert.ok(m, `expected a hex colour, got "${value}"`);
  const raw = m![1].length === 3 ? m![1].split("").map((c) => c + c).join("") : m![1];
  return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)];
}

function luminance(value: string): number {
  const [r, g, b] = hex(value).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;

// Every role the app paints with. Light/dark parity is a hard requirement:
// a role that only exists in one theme silently falls back to a raw colour.
const PARITY = [
  "--bg", "--surface", "--surface-hover", "--text", "--border", "--border-hover",
  "--primary", "--primary-hover", "--primary-light", "--on-primary", "--focus-ring",
  "--success", "--success-hover", "--success-light", "--success-text", "--on-success",
  "--warning", "--warning-hover", "--warning-light", "--warning-text", "--on-warning",
  "--danger", "--danger-hover", "--danger-light", "--danger-text", "--on-danger",
  "--info", "--info-hover", "--info-light", "--info-text", "--on-info",
  "--accent", "--accent-hover", "--accent-subtle", "--on-accent",
  "--technical", "--technical-hover", "--technical-subtle", "--technical-text", "--on-technical",
  "--analytics", "--analytics-hover", "--analytics-subtle", "--analytics-text", "--on-analytics",
  "--neutral-light", "--neutral-text",
];

// Geometry and timing are theme-independent, so they only have to exist once.
const SHARED = [
  "--radius-sm", "--radius-md", "--radius-lg", "--radius-xl",
  "--control-min-height",
  "--duration-micro", "--duration-fast", "--duration-normal", "--ease-press", "--ease-spring",
];

// Solid fills are only ever paired with their --on-* companion.
const SOLID = [
  ["--primary", "--on-primary"],
  ["--success", "--on-success"],
  ["--warning", "--on-warning"],
  ["--danger", "--on-danger"],
  ["--info", "--on-info"],
  ["--accent", "--on-accent"],
  ["--technical", "--on-technical"],
  ["--analytics", "--on-analytics"],
];

// Hover keeps the same fill colour, so the --on-* pairing must survive it.
const SOLID_HOVER = [
  ["--primary-hover", "--on-primary"],
  ["--success-hover", "--on-success"],
  ["--warning-hover", "--on-warning"],
  ["--danger-hover", "--on-danger"],
  ["--info-hover", "--on-info"],
  ["--accent-hover", "--on-accent"],
  ["--technical-hover", "--on-technical"],
  ["--analytics-hover", "--on-analytics"],
];

const TEXT_ON_TINT = [
  ["--success-text", "--success-light"],
  ["--warning-text", "--warning-light"],
  ["--danger-text", "--danger-light"],
  ["--info-text", "--info-light"],
  ["--neutral-text", "--neutral-light"],
];

// Status copy is read on page and panel backgrounds too (badges, inline hints).
const TEXT_ON_SURFACE = ["--success-text", "--warning-text", "--danger-text", "--info-text"];

describe("semantic colour tokens", () => {
  it("defines every role in both themes", () => {
    for (const theme of THEMES) {
      for (const name of PARITY) token(theme.css, name, theme.name);
    }
  });

  it("defines the shared geometry and timing scale once", () => {
    for (const name of SHARED) token(globals, name, "shared");
  });

  it("pairs every solid fill with a readable --on-* colour", () => {
    for (const theme of THEMES) {
      for (const [fill, on] of SOLID) {
        const ratio = contrast(token(theme.css, fill, theme.name), token(theme.css, on, theme.name));
        assert.ok(ratio >= AA, `${theme.name} ${fill} with ${on} is ${ratio.toFixed(2)}:1`);
      }
    }
  });

  it("keeps hover fills readable and visibly different from rest", () => {
    for (const theme of THEMES) {
      for (const [hover, on] of SOLID_HOVER) {
        const ratio = contrast(token(theme.css, hover, theme.name), token(theme.css, on, theme.name));
        assert.ok(ratio >= AA, `${theme.name} ${hover} with ${on} is ${ratio.toFixed(2)}:1`);
      }
      for (const [rest, hover] of [
        ["--primary", "--primary-hover"],
        ["--success", "--success-hover"],
        ["--warning", "--warning-hover"],
        ["--danger", "--danger-hover"],
        ["--info", "--info-hover"],
        ["--accent", "--accent-hover"],
        ["--technical", "--technical-hover"],
        ["--analytics", "--analytics-hover"],
      ]) {
        assert.notEqual(
          token(theme.css, rest, theme.name),
          token(theme.css, hover, theme.name),
          `${theme.name} ${hover} is identical to ${rest}, so hover has no signal`,
        );
      }
    }
  });

  it("keeps status text readable on its own tint", () => {
    for (const theme of THEMES) {
      for (const [text, tint] of TEXT_ON_TINT) {
        const ratio = contrast(token(theme.css, text, theme.name), token(theme.css, tint, theme.name));
        assert.ok(ratio >= AA, `${theme.name} ${text} on ${tint} is ${ratio.toFixed(2)}:1`);
      }
    }
  });

  it("keeps status text readable on page and panel surfaces", () => {
    for (const theme of THEMES) {
      const bg = token(theme.css, "--bg", theme.name);
      const surface = token(theme.css, "--surface", theme.name);
      for (const text of TEXT_ON_SURFACE) {
        for (const surfaceName of ["--bg", "--surface"]) {
          const ratio = contrast(token(theme.css, text, theme.name), token(theme.css, surfaceName, theme.name));
          assert.ok(ratio >= AA, `${theme.name} ${text} on ${surfaceName} is ${ratio.toFixed(2)}:1`);
        }
      }
      assert.ok(contrast(token(theme.css, "--text", theme.name), surface) >= AA);
      assert.ok(contrast(token(theme.css, "--text", theme.name), bg) >= AA);
    }
  });

  it("exposes the motion scale the interaction language is built on", () => {
    const micro = token(LIGHT_CSS, "--duration-micro", "light");
    const fast = token(LIGHT_CSS, "--duration-fast", "light");
    assert.ok(parseInt(micro, 10) < parseInt(fast, 10), "micro feedback must be quicker than fast");
    assert.ok(token(LIGHT_CSS, "--ease-press", "light").startsWith("cubic-bezier"));
    assert.ok(token(LIGHT_CSS, "--ease-spring", "light").startsWith("cubic-bezier"));
    assert.equal(token(LIGHT_CSS, "--control-min-height", "light"), "44px");
    assert.match(token(LIGHT_CSS, "--focus-ring", "light"), /3px/);
  });
});

describe("interaction language", () => {
  const sheets = ["frontend/styles/globals.css", "frontend/styles/animations.css", "frontend/styles/marketing.css"];

  it("never animates every property with transition: all", () => {
    for (const rel of sheets) {
      assert.ok(!/transition:\s*all\b/.test(read(rel)), `${rel} reintroduced \`transition: all\``);
    }
  });

  it("buttons animate only composite and colour properties", () => {
    // Anchor on a line-start `.btn {` so descendant rules like
    // `.identity-card .btn` cannot be picked up instead.
    const block = /(?:^|\n)\.btn\s*\{([\s\S]*?)\r?\n\}/.exec(globals);
    assert.ok(block, "the top-level .btn block must exist");
    const declaration = /transition:([^;]+);/.exec(block![1]);
    assert.ok(declaration, ".btn must declare a transition");
    const properties = declaration![1];
    assert.ok(/transform/.test(properties), ".btn should animate transform for the press");
    for (const banned of ["all", "width", "height", "padding", "margin", "top", "left", "right", "bottom"]) {
      assert.ok(
        !new RegExp(`(^|[\\s,])${banned}([\\s,]|$)`).test(properties),
        `.btn transitions \`${banned}\`, which re-runs layout on every frame`,
      );
    }
  });

  it("gives every button state an explicit rule", () => {
    for (const selector of [
      ".btn:hover",
      ".btn:focus-visible",
      ".btn:active:not(:disabled)",
      ".btn:disabled",
      ".btn.loading::after",
    ]) {
      assert.ok(globals.includes(`${selector} {`) || globals.includes(`${selector},\n`), `missing ${selector}`);
    }
    const pressed = /\.btn:active:not\(:disabled\)\s*\{([^}]*)\}/.exec(globals);
    assert.ok(pressed, "the pressed state must exist");
    assert.match(pressed![1], /scale\(/, "pressed should settle the button in");
    assert.match(pressed![1], /box-shadow:\s*none/, "pressed should reduce elevation");
    assert.match(globals, /\.btn:disabled\s*\{[^}]*opacity:/, "disabled must read as disabled");
  });

  it("ships hover, focus, pressed and loading for each button variant", () => {
    for (const variant of ["primary", "secondary", "ghost", "danger", "success", "subtle"]) {
      assert.ok(globals.includes(`.btn-${variant} {`), `missing .btn-${variant}`);
      assert.ok(globals.includes(`.btn-${variant}:hover {`), `missing .btn-${variant}:hover`);
    }
    assert.match(globals, /\.btn-danger\.loading::after/, "the loading spinner must follow the variant ink");
    assert.match(globals, /\.btn-success\.loading::after/);
  });

  it("keeps a global prefers-reduced-motion kill switch", () => {
    const blocks = globals.match(/@media \(prefers-reduced-motion: reduce\)/g) || [];
    assert.ok(blocks.length >= 2, "reduced motion must be covered in more than one place");
    const last = globals.slice(globals.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    assert.match(last, /transition-duration:\s*0\.01ms\s*!important/);
    assert.match(last, /animation-iteration-count:\s*1\s*!important/);
  });
});

describe("admin and Studio primitives", () => {
  const studioUi = read("frontend/components/admin/studio-ui.tsx");
  const builder = read("frontend/components/admin/StorefrontBuilder.tsx");
  const motionPanel = read("frontend/components/admin/MotionPanel.tsx");

  it("keeps one copy of the Studio form primitives", () => {
    assert.match(builder, /from "\.\/studio-ui"/, "StorefrontBuilder should import the shared primitives");
    for (const name of ["function Text", "function Num", "function Color", "function Select", "function Check", "function Field"]) {
      assert.ok(!builder.includes(name), `StorefrontBuilder redefines ${name} instead of importing it`);
    }
    assert.match(studioUi, /borderRadius: "var\(--radius-sm\)"/, "inputs must use the token radius");
    assert.match(motionPanel, /borderRadius: "var\(--radius-sm\)"/);
  });

  it("signals that admin list rows can be dragged", () => {
    assert.match(globals, /\.drag-handle\s*\{[^}]*cursor:\s*grab/);
    assert.match(globals, /\.drag-handle:active\s*\{[^}]*cursor:\s*grabbing/);
  });

  it("offers the motion intensity scale in the panel", () => {
    assert.match(motionPanel, /MOTION_INTENSITIES\.map/);
    assert.match(motionPanel, /MOTION_INTENSITY_LABELS/);
  });
});

describe("storefront design tokens", () => {
  const engine = read("frontend/layouts/dynamic-engine.tsx");
  const index = read("frontend/layouts/index.tsx");
  const builder = read("frontend/components/admin/StorefrontBuilder.tsx");

  it("emits validated tokens scoped to the storefront", () => {
    assert.ok(engine.includes("`.dynamic-layout { ${decls.join"), "tokens must be emitted on .dynamic-layout");
    assert.match(engine, /\/\^#\[0-9a-fA-F\]\{3,8\}\$\//, "colours must be hex-validated before injection");
    assert.match(engine, /Math\.min\(24/, "radius must be clamped");
    assert.ok(!/DynamicLayoutStyles\(\{ colors/.test(engine), "the dead colours prop must be gone");
    assert.match(index, /<DynamicLayoutStyles tokens=/);
  });

  it("normalises tokens before they are persisted", () => {
    assert.match(builder, /function normalizeTokens/);
    assert.match(builder, /JSON\.stringify\(\{ label, description, config: configForSave\(\) \}\)/);
  });

  it("reads radii from the token scale instead of literals", () => {
    assert.ok(!/borderRadius: (6|8|10|12|14)[,}]/.test(engine), "the engine still hardcodes radii");
    assert.match(engine, /var\(--radius-sm\)/);
    assert.match(engine, /var\(--radius-md\)/);
    assert.match(engine, /var\(--radius-lg\)/);
  });

  it("exposes radius, accent, on-accent and motion intensity in the Studio", () => {
    for (const label of ["Corner radius (px)", "Store accent", "Text on accent", "Motion intensity"]) {
      assert.ok(builder.includes(`label="${label}"`), `the Design panel is missing "${label}"`);
    }
    assert.match(builder, /motionIntensity: v as MotionIntensity/);
  });
});

describe("control plane alignment", () => {
  const html = read("control-plane/public/index.html");

  it("uses the warm-black token set", () => {
    for (const value of ["--bg: #0b0a09", "--surface: #161311", "--primary: #f97316", "--warning: #facc15"]) {
      assert.ok(html.includes(value), `control plane is missing ${value}`);
    }
  });

  it("keeps controls in the 10-14px band", () => {
    assert.ok(html.includes("--radius: 10px"));
    assert.ok(html.includes("--radius-lg: 14px"));
  });

  it("shares the press and focus interaction language", () => {
    assert.match(html, /\.btn:active:not\(:disabled\)\s*\{\s*transform: translateY\(1px\) scale\(0\.98\); box-shadow: none; \}/);
    assert.match(html, /\.btn:focus-visible[^{]*\{/);
    assert.ok(!/transition:\s*all\b/.test(html), "the control plane must not use `transition: all`");
  });

  it("honours reduced motion and the brand favicon", () => {
    assert.match(html, /@media \(prefers-reduced-motion: reduce\)/);
    assert.ok(html.includes("%23f97316"), "the favicon should stay brand orange");
  });
});
