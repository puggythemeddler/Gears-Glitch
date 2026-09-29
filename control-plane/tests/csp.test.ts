// control-plane/tests/csp.test.ts
//
// Regression cover for the permissive control-plane img-src. The directive used
// to be ["'self'", "data:", "blob:", "https:"] - "https:" means "any https
// host", which is the same as no image origin restriction at all. The dashboard
// renders exactly one remote image (the 2FA QR code from api.qrserver.com), so
// the directive must now name that one origin and the set of https origins the
// dashboard actually uses must match the directive exactly - no drift in either
// direction.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const cpRoot = path.join(__dirname, "..");
const serverSrc = fs.readFileSync(path.join(cpRoot, "server", "index.ts"), "utf8");
const indexHtml = fs.readFileSync(path.join(cpRoot, "public", "index.html"), "utf8");

function imgSrcDirective(): string {
  const m = serverSrc.match(/imgSrc:\s*\[[^\]]*\]/);
  assert.ok(m, "control-plane/server/index.ts must declare an imgSrc directive");
  return m![0];
}

function entryTokens(directive: string): string[] {
  const tokens = directive.slice(directive.indexOf("[") + 1, directive.indexOf("]")).split(",").map((t) => t.trim().replace(/^"|"$/g, "")).filter(Boolean);
  return tokens;
}

describe("control-plane img-src", () => {
  it("keeps same-origin, data and blob sources", () => {
    const tokens = entryTokens(imgSrcDirective());
    assert.ok(tokens.includes("'self'"), "img-src must keep 'self'");
    assert.ok(tokens.includes("data:"), "img-src must keep data: for TOTP/inline images");
    assert.ok(tokens.includes("blob:"), "img-src must keep blob:");
  });

  it("does not allow arbitrary https origins", () => {
    const directive = imgSrcDirective();
    assert.ok(!directive.includes('"https:"'), "bare \"https:\" re-opens the any-host hole");
    assert.ok(!directive.includes('"*"'), "wildcard in img-src is never acceptable");
  });

  it("allows exactly the api.qrserver.com origin the 2FA QR needs", () => {
    const tokens = entryTokens(imgSrcDirective());
    const httpsOrigins = tokens.filter((t) => /^https:\/\//.test(t));
    assert.deepEqual(httpsOrigins, ["https://api.qrserver.com"]);
  });

  it("the dashboard renders exactly one remote image, the 2FA QR, on the allowed origin", () => {
    // The QR <img> is assembled with string concatenation, so anchor on the
    // literal endpoint + the fact that there is a single <img> element: the
    // img-src allowlist and the page's actual imagery cannot drift.
    const imgCount = [...indexHtml.matchAll(/<img/gi)].length;
    assert.equal(imgCount, 1, `expected exactly one <img> (the 2FA QR), saw ${imgCount}`);
    assert.ok(
      indexHtml.includes("https://api.qrserver.com/v1/create-qr-code/"),
      "the QR endpoint must come from the img-src allowlisted origin"
    );
  });
});