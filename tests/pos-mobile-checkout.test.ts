import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(repo, "frontend/pages/pos.tsx"), "utf8");
const css = fs.readFileSync(path.join(repo, "frontend/styles/globals.css"), "utf8");

describe("mobile POS checkout remains reachable while browsing", () => {
  it("keeps the basket summary fixed to the mobile viewport", () => {
    const mobile = css.slice(css.indexOf("@media (max-width: 900px)"));
    const jump = mobile.match(/\.pos-mobile-cart-jump\s*\{([^}]+)\}/)?.[1] ?? "";
    assert.match(jump, /position:\s*fixed/);
    assert.match(jump, /inset-inline:\s*0/);
    assert.match(jump, /bottom:\s*0/);
    assert.match(mobile, /\.pos-shell--mobile-cart-jump\s*\{[^}]*padding-bottom:\s*calc\(64px \+ env\(safe-area-inset-bottom/);
  });

  it("shows the jump control only while checkout is outside the viewport and the sale has content", () => {
    assert.match(page, /const showMobileCartJump = !cartPanelVisible && \(cartItemCount > 0 \|\| mpesaPending \|\| Boolean\(lastOrderId\)\)/);
    assert.match(page, /\{showMobileCartJump && \(/);
  });

  it("moves keyboard focus to checkout when the jump control is activated", () => {
    assert.match(page, /panel\.scrollIntoView\(/);
    assert.match(page, /panel\.focus\(\{ preventScroll: true \}\)/);
    assert.match(page, /ref=\{cartPanelRef\} tabIndex=\{-1\}/);
  });
});
