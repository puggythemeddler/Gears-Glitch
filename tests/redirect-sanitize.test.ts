import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { safeRedirectPath } from "../frontend/lib/sanitize";

// The post-login destination comes from `?redirect=`, which is fully
// attacker-controlled. Passing it straight to router.push turns /login into an
// open redirect: a victim authenticates and is bounced to a look-alike page.
//
// The server applies the same rules in server/index.ts before consuming the
// value on the Google OAuth callback, so this covers the password-login path
// that previously had no check at all.
describe("safeRedirectPath", () => {
  const FALLBACK = "/dashboard";

  it("keeps genuine same-origin paths", () => {
    assert.equal(safeRedirectPath("/shop", FALLBACK), "/shop");
    assert.equal(safeRedirectPath("/product?id=7", FALLBACK), "/product?id=7");
    assert.equal(safeRedirectPath("/admin?view=staff&x=1", FALLBACK), "/admin?view=staff&x=1");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    assert.equal(safeRedirectPath("https://evil.com", FALLBACK), FALLBACK);
    assert.equal(safeRedirectPath("http://evil.com", FALLBACK), FALLBACK);
    assert.equal(safeRedirectPath("//evil.com", FALLBACK), FALLBACK);
    assert.equal(safeRedirectPath("/\\evil.com", FALLBACK), FALLBACK);
    assert.equal(safeRedirectPath("evil.com", FALLBACK), FALLBACK);
    assert.equal(safeRedirectPath(" https://evil.com", FALLBACK), FALLBACK);
    assert.equal(safeRedirectPath("mailto:a@b.com", FALLBACK), FALLBACK);
    assert.equal(safeRedirectPath("javascript:alert(1)", FALLBACK), FALLBACK);
  });

  it("rejects values that only decode into an external target", () => {
    assert.equal(safeRedirectPath("/%2f%2fevil.com", FALLBACK), FALLBACK);
    assert.equal(safeRedirectPath("/%5cevil.com", FALLBACK), FALLBACK);
    // Decodes to "/http://evil.com", which is still a path on this origin, so
    // it is normalised and kept rather than discarded.
    assert.equal(safeRedirectPath("/%68%74%74%70://evil.com", FALLBACK), "/http://evil.com");
  });

  it("allows a path that merely looks like a URL - it stays same-origin", () => {
    // "/http://evil.com" is a relative path on this origin, not a redirect.
    assert.equal(safeRedirectPath("/http://evil.com", FALLBACK), "/http://evil.com");
  });

  it("falls back for non-string and empty input", () => {
    assert.equal(safeRedirectPath("", FALLBACK), FALLBACK);
    assert.equal(safeRedirectPath(undefined, FALLBACK), FALLBACK);
    assert.equal(safeRedirectPath(null, FALLBACK), FALLBACK);
    assert.equal(safeRedirectPath(42, FALLBACK), FALLBACK);
    assert.equal(safeRedirectPath({ a: 1 }, FALLBACK), FALLBACK);
    assert.equal(safeRedirectPath([], FALLBACK), FALLBACK);
    assert.equal(safeRedirectPath("#top", FALLBACK), FALLBACK);
  });

  it("handles a repeated ?redirect param by taking the first value", () => {
    // Next hands back string[] when a query param appears more than once.
    assert.equal(safeRedirectPath(["/cart", "/wishlist"], FALLBACK), "/cart");
    assert.equal(safeRedirectPath(["https://evil.com", "/cart"], FALLBACK), FALLBACK);
  });

  it("honours a caller-supplied fallback", () => {
    assert.equal(safeRedirectPath("https://evil.com", "/login"), "/login");
  });
});
