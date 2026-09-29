// tests/springboard-pin.test.ts
//
// Regression test for the storefront springboard pin/overlay sidebar.
//
// The pin is a visitor-facing, purely client-side feature: no DB, no new API.
// It must never regress into (a) a panel that cannot be pinned, (b) a pinned
// panel that closes on outside-click / route change (the whole point of
// pinning), (c) a mobile overlay without a scrim or a way to dismiss it, or
// (d) a pin preference that cannot restore across visits. Those contracts live
// across Layout.tsx (state + handlers), globals.css (presentation) and
// icons.tsx (the pin glyph), so this file asserts them structurally. It runs
// in the plain DB-free unit suite and is CWD-independent.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const frontend = path.join(__dirname, "..", "frontend");
const layout = fs.readFileSync(path.join(frontend, "components", "Layout.tsx"), "utf8");
const css = fs.readFileSync(path.join(frontend, "styles", "globals.css"), "utf8");
const icons = fs.readFileSync(path.join(frontend, "components", "icons.tsx"), "utf8");

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe("springboard pin state (Layout.tsx)", () => {
  it("defines a single persisted pin key", () => {
    assert.ok(layout.includes('const SPRINGBOARD_PIN_KEY = "gg-springboard-pinned";'));
  });

  it("restores the pin preference from localStorage on mount", () => {
    assert.ok(layout.includes("pinned = window.localStorage.getItem(SPRINGBOARD_PIN_KEY) === \"1\";"));
    // The read must be guarded so storage failures (private mode, sandboxed iframes) are harmless.
    assert.ok(layout.includes("catch { /* ignore storage errors */ }"));
  });

  it("persists the pin preference back to localStorage", () => {
    assert.ok(layout.includes("window.localStorage.setItem(SPRINGBOARD_PIN_KEY, next ? \"1\" : \"0\")"));
  });

  it("renders a pin toggle with aria-pressed wired to the pin state", () => {
    assert.ok(layout.includes("className=\"springboard-pin\""));
    assert.ok(layout.includes("onClick={toggleSpringboardPin}"));
    assert.ok(layout.includes("aria-pressed={springboardPinned}"));
    assert.ok(layout.includes("aria-label={springboardPinned ? \"Unpin categories panel\" : \"Pin categories panel\"}"));
  });

  it("keeps a pinned panel open on outside clicks", () => {
    assert.ok(layout.includes("if (!springboardPinned && !target.closest(\".springboard-wrap\")) setSpringboardOpen(false);"));
  });

  it("keeps a pinned panel open across route changes and hash changes", () => {
    // closeMobile (nav clicks) and closeTransientMenus (route/hash change)
    // both skip closing the springboard while it is pinned.
    assert.ok(count(layout, "if (!springboardPinned) setSpringboardOpen(false);") >= 2);
    assert.ok(layout.includes("router.events.on(\"routeChangeStart\", () => closeTransientMenus)") ||
              layout.includes("router.events.on(\"routeChangeStart\", handler)"));
  });

  it("returns focus to the toggle when Escape closes a pinned panel", () => {
    assert.ok(layout.includes("if (springboardPinned) springboardBtnRef.current?.focus();"));
  });

  it("renders a scrim behind the pinned panel", () => {
    assert.ok(layout.includes("springboardOpen && springboardPinned && ("));
    assert.ok(layout.includes("className=\"springboard-scrim\""));
    assert.ok(layout.includes("aria-hidden=\"true\""));
  });

  it("focuses the first category link when the pinned panel opens as a mobile overlay", () => {
    assert.ok(layout.includes("if (!springboardOpen || !springboardPinned) return;"));
    assert.ok(layout.includes("window.innerWidth <= 768"));
    assert.ok(layout.includes("querySelector<HTMLElement>(\".springboard-item\")"));
  });

  it("marks the wrapper as pinned for the CSS to style against", () => {
    assert.ok(layout.includes("springboard-wrap${springboardPinned ? \" pinned\" : \"\"}"));
  });
});

describe("springboard pin presentation (globals.css)", () => {
  it("styles the pin control with a visible pressed state", () => {
    assert.ok(css.includes(".springboard-pin {"));
    assert.ok(css.includes(".springboard-pin[aria-pressed=\"true\"] {"));
    assert.ok(css.includes("width: 44px;"));
    assert.ok(css.includes("height: 44px;"));
  });

  it("turns the pinned panel into a fixed left sidebar under the header", () => {
    assert.ok(css.includes(".springboard-wrap.pinned .springboard-dropdown {"));
    assert.ok(css.includes("position: fixed;"));
    assert.ok(css.includes("top: var(--header-height);"));
    assert.ok(css.includes("bottom: 0;"));
    assert.ok(css.includes("width: 300px;"));
    assert.ok(css.includes("animation-name: sidebarIn;"));
  });

  it("removes the scrim on desktop; on mobile the pinned panel is a partial drawer with the scrim covering the rest", () => {
    assert.ok(css.includes(".springboard-scrim {"));
    assert.ok(css.includes("display: none;"));
    assert.ok(css.includes(".springboard-scrim {") && css.includes("background: rgba(0, 0, 0, 0.5);"));
    assert.ok(css.includes(".springboard-wrap.pinned .springboard-dropdown {") && css.includes("animation-name: menuDrop;"));
    // The drawer must never fill the viewport: the scrim needs an uncovered
    // strip to be a click-to-dismiss target (it sits below the panel in z-order).
    assert.ok(css.includes("width: min(300px, 85vw);"));
    assert.ok(css.includes("right: auto;") || css.includes(".springboard-wrap.pinned .springboard-dropdown {") && css.includes("max-width: 85vw;"));
  });

  it("respects prefers-reduced-motion for the pinned panel and scrim", () => {
    assert.ok(css.includes(".springboard-scrim { animation: none; }"));
  });
});

describe("springboard pin glyph (icons.tsx)", () => {
  it("exposes the mapPin icon used by the pin toggle", () => {
    assert.ok(icons.includes("mapPin:"));
  });
});