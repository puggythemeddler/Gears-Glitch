// tests/upload-orphan-cleanup.test.ts
//
// F8: an upload is written by multer before the route persists it. If the
// persist step then failed, the route responded with an error but left the
// object behind - and the invalid-file branch only unlinked the local disk
// path, so a Cloudinary upload was never removed. removeUploadedAsset() now
// cleans up in whichever storage mode is active, and each route only cleans up
// when it has not ({ persisted }) already committed the asset to the database.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { removeUploadedAsset, isCloudinaryConfigured } from "../server/upload";

const repoRoot = path.join(__dirname, "..");
const index = fs.readFileSync(path.join(repoRoot, "server", "index.ts"), "utf8");

const cloudinaryOn = isCloudinaryConfigured();

describe("removeUploadedAsset cleans up unpersisted uploads (F8)", () => {
  it("unlinks a local-disk file that was never persisted", { skip: cloudinaryOn ? "Cloudinary is configured" : false }, async () => {
    const f = path.join(os.tmpdir(), `gg-orphan-${process.pid}-${Date.now()}.jpg`);
    fs.writeFileSync(f, Buffer.from([0xff, 0xd8, 0xff, 0x00]));
    assert.ok(fs.existsSync(f));
    await removeUploadedAsset({ path: f } as any, "/uploads/whatever.jpg");
    assert.equal(fs.existsSync(f), false, "the uploaded local file must be deleted");
  });

  it("is a no-op when there is no file (e.g. multer rejected it)", async () => {
    await removeUploadedAsset(undefined, "https://res.cloudinary.com/demo/image/upload/v1/a.jpg");
  });

  it("does not throw when the local file is already gone", async () => {
    await removeUploadedAsset({ path: path.join(os.tmpdir(), "gg-definitely-missing.jpg") } as any);
  });
});

describe("upload routes route failure cleanup through removeUploadedAsset", () => {
  const routes: Array<[string, string]> = [
    ["product primary image", 'app.post("/api/products/:id/image"'],
    ["product gallery image", 'app.post("/api/products/:id/images"'],
    ["repair image", 'app.post("/api/repairs/:id/images"'],
    ["store logo", 'app.post("/api/settings/logo"'],
    ["store favicon", 'app.post("/api/settings/favicon"'],
    ["about banner", 'app.post("/api/admin/about-us/image"'],
  ];

  function routeBlock(marker: string): string {
    const start = index.indexOf(marker);
    assert.ok(start >= 0, `${marker} exists`);
    const end = index.indexOf("\n}));", start);
    return index.slice(start, end < 0 ? start + 3000 : end);
  }

  it("every upload route calls removeUploadedAsset", () => {
    for (const [name, marker] of routes) {
      assert.ok(routeBlock(marker).includes("removeUploadedAsset"), `${name} route must clean up orphaned assets`);
    }
  });

  it("no upload route falls back to a disk-only unlink", () => {
    assert.ok(!index.includes("fs.unlinkSync(req.file.path)"), "disk-only cleanup must be gone");
  });

  it("routes that persist an upload guard cleanup behind a persisted flag", () => {
    for (const [, marker] of routes) {
      assert.match(routeBlock(marker), /let persisted = false;/, `${marker} must track persistence before cleaning up`);
    }
  });

  it("cleanup is skipped once the asset is referenced by the database", () => {
    // The catch clause must be conditional, never an unconditional delete.
    for (const [, marker] of routes) {
      const block = routeBlock(marker);
      assert.match(block, /if \(!persisted\) await removeUploadedAsset\(/, `${marker} must clean up only when unpersisted`);
    }
  });
});
