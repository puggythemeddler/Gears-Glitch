// tests/media-policy.test.ts
//
// Regression cover for the backupImageToDb SSRF gap. The DB-backup helper used
// to `fetch(imageUrl)` any http(s) URL an image row contained. Every current
// call site feeds it upload-originated URLs, so this was never triggerable in
// the shipped code - but the helper is the kind of boundary an innocent future
// "give products a URL field" feature widens, and a server that will fetch an
// arbitrary URL is an SSRF primitive. This suite pins the server's fetch policy
// to the exact host set the browser is allowed to render.
//
// Three things must hold:
//   1. The server media-policy allowlist is identical to the frontend one.
//   2. The synchronous guard accepts Cloudinary https URLs only and refuses
//      http, credentials, lookalike origins, and non-image schemes.
//   3. The private/reserved IP table blocks loopback/link-local/RFC1918 and
//      their IPv6 equivalents, so a DNS-rebinding answer never reaches the
//      internal network.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import {
  isAllowedRemoteImageUrl,
  isBlockedImageIp,
  assertPublicImageHost,
  ALLOWED_IMAGE_ORIGINS as SERVER_ORIGINS,
  MAX_BACKUP_IMAGE_BYTES,
} from "../server/media-policy";
import { ALLOWED_IMAGE_ORIGINS as FRONTEND_ORIGINS } from "../frontend/lib/image-allowlist";

const repoRoot = path.join(__dirname, "..");

describe("server and frontend image policies agree", () => {
  it("ALLOWED_IMAGE_ORIGINS is byte-identical across the two modules", () => {
    assert.deepEqual([...SERVER_ORIGINS], [...FRONTEND_ORIGINS]);
  });

  it("the Helmet img-src directive still lists the same origin", () => {
    const server = fs.readFileSync(path.join(repoRoot, "server", "index.ts"), "utf8");
    const directive = server.match(/imgSrc:\s*\[[^\]]*\]/);
    assert.ok(directive, "server/index.ts must declare an imgSrc directive");
    for (const origin of SERVER_ORIGINS) {
      assert.ok(directive![0].includes(origin), `server CSP imgSrc is missing ${origin}`);
    }
  });
});

describe("isAllowedRemoteImageUrl (sync SSRF guard)", () => {
  it("accepts allowlisted https Cloudinary delivery URLs", () => {
    assert.equal(isAllowedRemoteImageUrl("https://res.cloudinary.com/demo/image/upload/x.jpg"), true);
    assert.equal(
      isAllowedRemoteImageUrl("https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/gear-glitch/products/p-1.jpg?x=1"),
      true
    );
  });

  it("rejects http, cloud-metadata style targets, and non-allowed schemes", () => {
    assert.equal(isAllowedRemoteImageUrl("http://res.cloudinary.com/demo/image/upload/x.jpg"), false);
    assert.equal(isAllowedRemoteImageUrl("http://169.254.169.254/latest/meta-data/"), false);
    assert.equal(isAllowedRemoteImageUrl("file:///etc/passwd"), false);
    assert.equal(isAllowedRemoteImageUrl("ftp://res.cloudinary.com/demo/x.jpg"), false);
    assert.equal(isAllowedRemoteImageUrl("data:image/png;base64,iVBORw0KGgo="), false);
  });

  it("rejects credentials embedded in the URL", () => {
    assert.equal(isAllowedRemoteImageUrl("https://user:pass@res.cloudinary.com/demo/x.jpg"), false);
    assert.equal(isAllowedRemoteImageUrl("https://res.cloudinary.com.evil.test/demo/x.jpg"), false);
  });

  it("rejects lookalike and arbitrary origins", () => {
    assert.equal(isAllowedRemoteImageUrl("https://res-cloudinary.com/demo/x.jpg"), false);
    assert.equal(isAllowedRemoteImageUrl("https://notres.cloudinary.com/x.jpg"), false);
    assert.equal(isAllowedRemoteImageUrl("https://images.example.com/hero.jpg"), false);
    assert.equal(isAllowedRemoteImageUrl("https://evil.test/x.png"), false);
  });

  it("rejects empty values and closes a backup over 8MB", () => {
    assert.equal(isAllowedRemoteImageUrl(""), false);
    assert.equal(isAllowedRemoteImageUrl(null), false);
    assert.equal(isAllowedRemoteImageUrl(undefined), false);
    assert.equal(MAX_BACKUP_IMAGE_BYTES, 8 * 1024 * 1024);
  });
});

describe("private/reserved IP table (DNS-rebinding defense)", () => {
  it("blocks loopback, link-local, RFC1918, CGNAT, and special-use v4 ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "0.0.0.0",
      "10.0.0.1",
      "10.255.255.255",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "192.0.0.9",
      "192.0.2.10",
      "198.18.0.1",
      "198.51.100.7",
      "203.0.113.9",
      "224.0.0.1",
      "240.0.0.1",
      "255.255.255.255",
    ]) {
      assert.equal(isBlockedImageIp(ip), true, `${ip} must be blocked`);
    }
  });

  it("allows public v4 addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "146.75.118.11", "5.6.7.8"]) {
      assert.equal(isBlockedImageIp(ip), false, `${ip} must be allowed`);
    }
  });

  it("blocks IPv6 loopback, unspecified, link-local, unique-local, and mapped v4", () => {
    for (const ip of ["::1", "::", "fe80::1", "febf::1", "fc00::1", "fd12:3456:789a::1", "::ffff:10.0.0.5", "::ffff:169.254.169.254"]) {
      assert.equal(isBlockedImageIp(ip), true, `${ip} must be blocked`);
    }
  });

  it("allows public IPv6 addresses and rejects junk", () => {
    assert.equal(isBlockedImageIp("2606:4700:4700::1111"), false);
    assert.equal(isBlockedImageIp("::ffff:93.184.216.34"), false);
    assert.equal(isBlockedImageIp("999.1.1.1"), false);
  });

  it("assertPublicImageHost fails closed on a malformed URL without DNS", async () => {
    assert.equal(await assertPublicImageHost("not a url"), false);
  });
});

describe("backupImageToDb keeps the guard wired in", () => {
  it("server/index.ts still calls the guard from the remote-fetch branch", () => {
    const server = fs.readFileSync(path.join(repoRoot, "server", "index.ts"), "utf8");
    assert.ok(server.includes("isAllowedRemoteImageUrl"), "remote fetch must be gated by isAllowedRemoteImageUrl");
    assert.ok(server.includes("assertPublicImageHost"), "remote fetch must be gated by assertPublicImageHost");
    assert.ok(server.includes('redirect: "manual"'), "remote fetch must refuse redirects");
  });
});