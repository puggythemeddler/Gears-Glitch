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
import { Readable } from "stream";
import { magicByteGuard } from "../server/upload";

const repoRoot = path.join(__dirname, "..");
const upload = fs.readFileSync(path.join(repoRoot, "server", "upload.ts"), "utf8");
const index = fs.readFileSync(path.join(repoRoot, "server", "index.ts"), "utf8");

function runGuard(chunks: Buffer[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const guard = magicByteGuard();
    const out: Buffer[] = [];
    guard.on("data", (c: Buffer) => out.push(c));
    guard.on("end", () => resolve(Buffer.concat(out)));
    guard.on("error", reject);
    Readable.from(chunks).pipe(guard);
  });
}

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

// F6: validateUploadedFile short-circuits to `true` for a remote Cloudinary
// URL, so the byte-level check only ever ran for local-disk uploads. The guard
// restores parity by inspecting the leading bytes while the file is still being
// streamed to Cloudinary, and rejecting before any further data is forwarded.
describe("the Cloudinary upload path enforces magic-byte validation", () => {
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const PDF = Buffer.from("%PDF-1.7\n");

  it("forwards a genuine PNG byte-for-byte", async () => {
    assert.deepEqual(await runGuard([PNG]), PNG);
  });

  it("forwards a genuine PNG split into single-byte chunks", async () => {
    const chunks = [...PNG].map((b) => Buffer.from([b]));
    assert.deepEqual(await runGuard(chunks), PNG);
  });

  it("rejects non-image bytes with the standard invalid-type error", async () => {
    await assert.rejects(() => runGuard([PDF]), /Invalid file type/);
  });

  it("rejects an HTML/script payload sent with an image mimetype", async () => {
    await assert.rejects(() => runGuard([Buffer.from("<!DOCTYPE html><script>alert(1)</script>")]), /Invalid file type/);
  });

  it("the Cloudinary storage engine pipes through the guard, not straight to Cloudinary", () => {
    assert.ok(upload.includes("const guard = magicByteGuard()"), "CloudinaryStorageEngine must build the guard");
    assert.ok(upload.includes("file.stream.pipe(guard).pipe(upload)"), "upload must be fed by the guard");
    assert.ok(!upload.includes("file.stream.pipe(upload)"), "direct file.stream.pipe(upload) must be gone");
  });
});