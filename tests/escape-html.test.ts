// Regression guards for the escapeHtml double-escape cleanup.
//
// React already escapes text and attribute values, so calling escapeHtml() in a
// render position double-encodes special characters ("AT&T" displays as
// "AT&amp;T"). The cleanup removed those wrappers and kept the util only where
// it feeds an actual raw-HTML sink (the admin sales report builder and the
// server-side email/invoice templates). These tests pin both halves of the rule:
// render positions stay unwrapped AND genuine raw sinks keep escaping.

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml } from "../frontend/lib/sanitize";
import fs from "node:fs";
import path from "node:path";

const repo = path.join(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(repo, rel), "utf8");

// frontend/lib/sanitize.ts implements escaping via a DOM text node
// (textContent in, innerHTML out). Node has no DOM, so give it a minimal stub
// whose innerHTML getter mirrors what the browser's text-node serialiser does.
before(() => {
  const stub = {
    textContent: "",
    get innerHTML() {
      return this.textContent
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },
  };
  (globalThis as any).document = { createElement: () => stub };
});

// Every file that may legitimately contain the literal `escapeHtml(` — i.e. the
// two source-of-truth definitions. Note admin.tsx may REFERENCE escapeHtml (the
// report builder aliases it as `e`) but must not CALL it inside JSX.
const ALLOWED_ESCAPE_CALL_FILES = new Set([
  "frontend/lib/sanitize.ts",
  "frontend/components/admin/shared.tsx",
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next") out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("escapeHtml util (kept for raw-HTML sinks)", () => {
  it("escapes the HTML special characters", () => {
    assert.equal(escapeHtml("<b title=\"x\">AT&T</b>"), "&lt;b title=&quot;x&quot;&gt;AT&amp;T&lt;/b&gt;");
  });

  it("leaves innocent strings alone", () => {
    assert.equal(escapeHtml("plain text"), "plain text");
  });
});

describe("escape-html cleanup (render positions)", () => {
  it("no frontend file calls escapeHtml() except the definitions", () => {
    const offenders: string[] = [];
    for (const full of walk(path.join(repo, "frontend"))) {
      const rel = path.relative(repo, full).replace(/\\/g, "/");
      const src = fs.readFileSync(full, "utf8");
      if (src.includes("escapeHtml(") && !ALLOWED_ESCAPE_CALL_FILES.has(rel)) {
        offenders.push(rel);
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("admin.tsx keeps the report builder, but no render-position calls", () => {
    const admin = read("frontend/pages/admin.tsx");
    // The raw report builder still needs the util: `const e = escapeHtml;`
    assert.match(admin, /\bconst e = escapeHtml;/, "report-builder alias kept");
    // And the JSX render positions are unwrapped - a literal call would double-escape.
    assert.doesNotMatch(admin, /escapeHtml\(/);
  });

  it("the old per-page escapeHtml doublings (cart, orders) are gone", () => {
    for (const f of ["frontend/pages/cart.tsx", "frontend/pages/orders.tsx"]) {
      const src = read(f);
      assert.doesNotMatch(src, /function escapeHtml\(/, `${f} local replacer removed`);
      assert.doesNotMatch(src, /escapeHtml\(/);
    }
  });
});

describe("escape-html cleanup (raw sinks stay protected)", () => {
  it("server-side email/invoice builders still escape user text", () => {
    const server = read("server/index.ts");
    const calls = server.match(/escapeHtml\(/g)?.length ?? 0;
    assert.ok(calls > 20, `server/index.ts keeps raw-HTML escaping (saw ${calls})`);
    assert.match(server, /\$\{escapeHtml\(name\)\}/, "contact form still escapes the sender name");
  });

  it("the admin report builder's raw print sink still exists", () => {
    const admin = read("frontend/pages/admin.tsx");
    assert.match(admin, /w\.document\.write\(html\)/, "report print sink kept");
  });
});