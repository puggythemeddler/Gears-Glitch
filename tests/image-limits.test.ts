// tests/image-limits.test.ts
//
// Regression cover for the per-item image caps. Previously gallery/repair
// uploads were unbounded server-side; these caps (default 12 product / 20
// repair, env-overridable) are enforced before the upload file is written.
// Pure-function coverage for the limit helpers plus source assertions that the
// upload routes are actually wired to them.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  parseLimit,
  withinImageLimit,
  productImageLimitMessage,
  repairImageLimitMessage,
  DEFAULT_MAX_PRODUCT_IMAGES,
  DEFAULT_MAX_REPAIR_IMAGES,
  MAX_PRODUCT_IMAGES,
  MAX_REPAIR_IMAGES,
} from "../server/image-limits";

const repoRoot = path.join(__dirname, "..");
const index = fs.readFileSync(path.join(repoRoot, "server", "index.ts"), "utf8");

describe("image limit helpers", () => {
  it("withinImageLimit allows counts below the cap and rejects the cap and above", () => {
    assert.equal(withinImageLimit(0, 12), true);
    assert.equal(withinImageLimit(11, 12), true);
    assert.equal(withinImageLimit(12, 12), false);
    assert.equal(withinImageLimit(13, 12), false);
  });

  it("parseLimit falls back on empty/non-numeric and clamps below 1", () => {
    assert.equal(parseLimit(undefined, 12), 12);
    assert.equal(parseLimit("", 12), 12);
    assert.equal(parseLimit("   ", 12), 12);
    assert.equal(parseLimit("abc", 12), 12);
    assert.equal(parseLimit("0", 12), 12);
    assert.equal(parseLimit("-5", 12), 12);
    assert.equal(parseLimit("7", 12), 7);
    assert.equal(parseLimit("7.9", 12), 7);
  });

  it("defaults are sane positive integers", () => {
    assert.ok(Number.isInteger(DEFAULT_MAX_PRODUCT_IMAGES) && DEFAULT_MAX_PRODUCT_IMAGES > 0);
    assert.ok(Number.isInteger(DEFAULT_MAX_REPAIR_IMAGES) && DEFAULT_MAX_REPAIR_IMAGES > 0);
    assert.ok(Number.isInteger(MAX_PRODUCT_IMAGES) && MAX_PRODUCT_IMAGES > 0);
    assert.ok(Number.isInteger(MAX_REPAIR_IMAGES) && MAX_REPAIR_IMAGES > 0);
  });

  it("limit messages name the applicable cap", () => {
    assert.ok(productImageLimitMessage(12).includes("12"));
    assert.ok(productImageLimitMessage().includes(String(MAX_PRODUCT_IMAGES)));
    assert.ok(repairImageLimitMessage(20).includes("20"));
    assert.ok(repairImageLimitMessage().includes(String(MAX_REPAIR_IMAGES)));
  });
});

describe("upload routes enforce the image caps", () => {
  it("the product gallery route checks the product limit before writing the file", () => {
    const route = index.slice(index.indexOf('app.post("/api/products/:id/images"'));
    const body = route.slice(0, route.indexOf("app.delete"));
    assert.ok(body.includes("withinImageLimit(existing.length, MAX_PRODUCT_IMAGES)"), "gallery route must apply MAX_PRODUCT_IMAGES");
    assert.ok(body.includes("productImageLimitMessage()"), "gallery route must use the shared limit message");
    // The limit check must run before runMulter writes the upload.
    assert.ok(body.indexOf("withinImageLimit") < body.indexOf("runMulter(uploadGalleryImage"), "limit check must precede runMulter");
    assert.ok(body.includes("res.status(409)"), "gallery route must reject with 409");
  });

  it("the repair image route checks the repair limit before writing the file", () => {
    const route = index.slice(index.indexOf('app.post("/api/repairs/:id/images"'));
    const body = route.slice(0, route.indexOf("app.delete"));
    assert.ok(body.includes("withinImageLimit(existing.length, MAX_REPAIR_IMAGES)"), "repair route must apply MAX_REPAIR_IMAGES");
    assert.ok(body.includes("repairImageLimitMessage()"), "repair route must use the shared limit message");
    assert.ok(body.indexOf("withinImageLimit") < body.indexOf("runMulter(uploadRepairImage"), "limit check must precede runMulter");
    assert.ok(body.includes("res.status(409)"), "repair route must reject with 409");
  });

  it("the primary-image route cannot grow the gallery past the product cap", () => {
    const route = index.slice(index.indexOf('app.post("/api/products/:id/image"'));
    const body = route.slice(0, route.indexOf('app.delete("/api/products/:id/image"'));
    assert.ok(body.includes("withinImageLimit(existing.length, MAX_PRODUCT_IMAGES)"), "primary route must bound its gallery append");
  });

  it("upload status advertises the limits so the UI can match the backend", () => {
    assert.ok(index.includes("maxProductImages: MAX_PRODUCT_IMAGES"), "upload status must expose maxProductImages");
    assert.ok(index.includes("maxRepairImages: MAX_REPAIR_IMAGES"), "upload status must expose maxRepairImages");
  });
});
