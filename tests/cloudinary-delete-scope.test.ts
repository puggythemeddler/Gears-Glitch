import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cloudinaryPublicIdForDeletion } from "../server/upload";

describe("Cloudinary delete folder scope", () => {
  const folder = "gear-glitch/client-one";

  it("returns an asset public ID inside the configured tenant folder", () => {
    assert.equal(
      cloudinaryPublicIdForDeletion(
        "https://res.cloudinary.com/demo/image/upload/v1780000000/gear-glitch/client-one/products/item-1.jpg",
        folder,
      ),
      "gear-glitch/client-one/products/item-1",
    );
  });

  it("accepts a Cloudinary transformation before the version marker", () => {
    assert.equal(
      cloudinaryPublicIdForDeletion(
        "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1780000000/gear-glitch/client-one/logo/store.webp?x=1",
        folder,
      ),
      "gear-glitch/client-one/logo/store",
    );
  });

  it("rejects another tenant folder", () => {
    assert.equal(
      cloudinaryPublicIdForDeletion(
        "https://res.cloudinary.com/demo/image/upload/v1780000000/gear-glitch/client-two/products/item-1.jpg",
        folder,
      ),
      null,
    );
  });

  it("rejects a prefix lookalike folder", () => {
    assert.equal(
      cloudinaryPublicIdForDeletion(
        "https://res.cloudinary.com/demo/image/upload/v1780000000/gear-glitch/client-one-evil/item.jpg",
        folder,
      ),
      null,
    );
  });

  it("rejects non-Cloudinary, insecure, credentialed, and non-image URLs", () => {
    for (const url of [
      "https://attacker.example/image/upload/v1/gear-glitch/client-one/a.jpg",
      "http://res.cloudinary.com/demo/image/upload/v1/gear-glitch/client-one/a.jpg",
      "https://user:pass@res.cloudinary.com/demo/image/upload/v1/gear-glitch/client-one/a.jpg",
      "https://res.cloudinary.com/demo/video/upload/v1/gear-glitch/client-one/a.jpg",
    ]) {
      assert.equal(cloudinaryPublicIdForDeletion(url, folder), null, url);
    }
  });

  it("rejects unversioned, traversal, malformed, and empty-folder inputs", () => {
    assert.equal(
      cloudinaryPublicIdForDeletion(
        "https://res.cloudinary.com/demo/image/upload/gear-glitch/client-one/a.jpg",
        folder,
      ),
      null,
    );
    assert.equal(
      cloudinaryPublicIdForDeletion(
        "https://res.cloudinary.com/demo/image/upload/v1/gear-glitch/client-one/%2e%2e/client-two/a.jpg",
        folder,
      ),
      null,
    );
    assert.equal(cloudinaryPublicIdForDeletion("not a URL", folder), null);
    assert.equal(
      cloudinaryPublicIdForDeletion(
        "https://res.cloudinary.com/demo/image/upload/v1/gear-glitch/client-one/a.jpg",
        "",
      ),
      null,
    );
  });
});
