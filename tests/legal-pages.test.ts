// tests/legal-pages.test.ts
//
// Phase E regression cover: the storefront must expose draft privacy/terms
// pages and a cookie/consent banner with a persisted, granular choice, and the
// banner must be mounted app-wide so it appears on every layout template. These
// are drafts pending legal review (see LEGAL_REVIEW_REQUIRED.md) - the tests pin
// the presence and wiring, not the legal content.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const repoRoot = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(repoRoot, p), "utf8");

const privacy = read("frontend/pages/privacy.tsx");
const terms = read("frontend/pages/terms.tsx");
const banner = read("frontend/components/CookieConsent.tsx");
const app = read("frontend/pages/_app.tsx");
const layout = read("frontend/components/Layout.tsx");
const notice = read("LEGAL_REVIEW_REQUIRED.md");

describe("legal surfaces exist and are marked as drafts", () => {
  it("privacy and terms pages exist and are visibly marked draft", () => {
    assert.ok(/Privacy Policy/.test(privacy), "privacy page must have a heading");
    assert.ok(/Terms of Service/.test(terms), "terms page must have a heading");
    assert.ok(/DRAFT/i.test(privacy), "privacy page must show a DRAFT notice");
    assert.ok(/DRAFT/i.test(terms), "terms page must show a DRAFT notice");
    assert.ok(/\[[A-Z][^\]]+\]/.test(privacy), "privacy page must retain placeholders");
    assert.ok(/\[[A-Z][^\]]+\]/.test(terms), "terms page must retain placeholders");
  });

  it("a legal-review notice exists and refuses to claim compliance", () => {
    assert.ok(/legal review required/i.test(notice), "notice must state legal review is required");
    assert.ok(/not legal advice/i.test(notice), "notice must disclaim legal advice");
    assert.ok(!/we are compliant/i.test(notice), "notice must not claim compliance");
  });
});

describe("cookie consent banner", () => {
  it("persists a granular choice under a versioned key", () => {
    assert.ok(banner.includes("gg_cookie_consent_v1"), "banner must use a versioned consent key");
    assert.ok(/essential:\s*true/.test(banner), "essential cookies must be always-on");
    assert.ok(/analytics/.test(banner) && /marketing/.test(banner), "banner must offer analytics and marketing categories");
    assert.ok(banner.includes("localStorage"), "banner must persist the choice client-side");
  });

  it("offers accept, reject and manage paths and links to the policies", () => {
    assert.ok(/Accept all/.test(banner), "banner must offer Accept all");
    assert.ok(/Reject non-essential/.test(banner), "banner must offer Reject non-essential");
    assert.ok(/Manage preferences/.test(banner), "banner must offer Manage preferences");
    assert.ok(banner.includes('href="/privacy"') && banner.includes('href="/terms"'), "banner must link both policies");
  });

  it("is mounted app-wide, independent of the layout template", () => {
    assert.ok(app.includes("CookieConsentBanner"), "banner must be imported in _app.tsx");
    assert.ok(app.includes("<CookieConsentBanner"), "banner must be rendered in _app.tsx");
  });
});

describe("footer exposes the legal links for the default layout", () => {
  it("the default footer column links privacy and terms", () => {
    assert.ok(layout.includes('href: "/privacy"'), "footer must link /privacy");
    assert.ok(layout.includes('href: "/terms"'), "footer must link /terms");
  });
});
