import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSafeHref, normalizeHref } from "../frontend/lib/links";

describe("link safety", () => {
  it("allows relative store links", () => {
    assert.equal(isSafeHref("/pc"), true);
    assert.equal(isSafeHref("/product?id=42"), true);
    assert.equal(isSafeHref("#featured"), true);
    assert.equal(isSafeHref("?ref=banner"), true);
  });

  it("allows safe absolute and protocol links", () => {
    assert.equal(isSafeHref("https://example.com/sale"), true);
    assert.equal(isSafeHref("http://example.com"), true);
    assert.equal(isSafeHref("mailto:sales@example.com"), true);
    assert.equal(isSafeHref("tel:+254700000000"), true);
  });

  it("blocks script / data / vbscript / file schemes", () => {
    assert.equal(isSafeHref("javascript:alert(1)"), false);
    assert.equal(isSafeHref("JaVaScRiPt:alert(1)"), false);
    assert.equal(isSafeHref("data:text/html,<b>hi</b>"), false);
    assert.equal(isSafeHref("vbscript:msgbox(1)"), false);
    assert.equal(isSafeHref("file:///etc/passwd"), false);
  });

  it("blocks scheme-relative and unknown schemes", () => {
    assert.equal(isSafeHref("//evil.example.com"), false);
    assert.equal(isSafeHref("ftp://example.com"), false);
    assert.equal(isSafeHref("blob:https://example.com"), false);
    assert.equal(isSafeHref("filesystem:data"), false);
  });

  it("blocks empty and oversized links", () => {
    assert.equal(isSafeHref(""), false);
    assert.equal(isSafeHref("   "), false);
    assert.equal(isSafeHref("x".repeat(2049)), false);
  });

  it("normalizeHref defaults unsafe or empty links", () => {
    assert.equal(normalizeHref("javascript:alert(1)"), "#");
    assert.equal(normalizeHref(null), "#");
    assert.equal(normalizeHref(undefined), "#");
    assert.equal(normalizeHref("  "), "#");
    assert.equal(normalizeHref("//evil.example.com"), "#");
    assert.equal(normalizeHref(""), "#");
  });

  it("normalizeHref keeps safe links and trims", () => {
    assert.equal(normalizeHref("  /pc  "), "/pc");
    assert.equal(normalizeHref("https://example.com"), "https://example.com");
    assert.equal(normalizeHref("#top"), "#top");
  });

  it("normalizeHref upgrades wa.me links to https", () => {
    assert.equal(normalizeHref("wa.me/254700000000"), "https://wa.me/254700000000");
    assert.equal(normalizeHref("https://wa.me/254700000000"), "https://wa.me/254700000000");
  });
});