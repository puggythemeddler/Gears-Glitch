// tests/upload-policy.test.ts
//
// Regression cover for the SVG handling inconsistency. SVG was accepted at the
// multer mimetype filter and by the Cloudinary storage extension list, but the
// magic-byte table omitted it - so an SVG upload worked through Cloudinary and
// silently failed on local disk. SVG is scriptable and deliberately not an
// upload format here, so the unified behaviour is: reject at the filter,
// everywhere, in both storage modes.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const repoRoot = path.join(__dirname, "..");
const upload = fs.readFileSync(path.join(repoRoot, "server", "upload.ts"), "utf8");
const index = fs.readFileSync(path.join(repoRoot, "server", "index.ts"), "utf8");

describe("SVG uploads are rejected consistently", () => {
  it("the multer image filter rejects image/svg+xml explicitly", () => {
    assert.ok(upload.includes('file.mimetype === "image/svg+xml"'), "imageFileFilter must reject image/svg+xml");
  });

  it("the Cloudinary storage extension list no longer accepts .svg", () => {
    const oldCloudinaryList = '[".jpg", ".jpeg", ".png", ".webp", ".gif", ".ico", ".svg"]';
    assert.ok(
      !upload.includes(oldCloudinaryList),
      `Cloudinary storage list must not accept .svg: ${oldCloudinaryList}`
    );
  });

  it("the .svg extension string appears nowhere in upload.ts (both storage lists)", () => {
    // Covers the Cloudinary `const safeExt = [...]` list and the local-disk
    // `return [...]` list in safeExt(); a bare `".svg"` anywhere lets an SVG
    // filename through one storage mode while the other rejects it.
    assert.ok(!upload.includes('".svg"'), 'upload.ts must not accept a ".svg" extension anywhere');
  });

  it("the backup content-type map no longer maps .svg", () => {
    assert.ok(!index.includes('".svg": "image/svg+xml"'), "backup local content-type map must not map .svg");
  });

  it("the magic-byte table has no SVG signature (would contradict the filter)", () => {
    const table = upload.match(/IMAGE_MAGIC_BYTES[^{]*\{[^}]*\}/)?.[0] || "";
    assert.ok(!(/svg/i.test(table)), "magic-byte table must not admit SVG bytes");
  });
});