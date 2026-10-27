import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveCloudinaryConfig } from "../server/cloudinary-config";

describe("Cloudinary configuration precedence", () => {
  it("uses Control Plane-synced environment values over stale tenant settings", () => {
    const resolved = resolveCloudinaryConfig(
      {
        cloudinaryCloudName: "stale-cloud",
        cloudinaryApiKey: "stale-key",
        cloudinaryApiSecret: "stale-secret",
        cloudinaryFolder: "stale-folder",
      },
      {
        CLOUDINARY_CLOUD_NAME: "synced-cloud",
        CLOUDINARY_API_KEY: "synced-key",
        CLOUDINARY_API_SECRET: "synced-secret",
        CLOUDINARY_FOLDER: "tenant-folder",
      },
    );

    assert.deepEqual(resolved, {
      cloudinaryCloudName: "synced-cloud",
      cloudinaryApiKey: "synced-key",
      cloudinaryApiSecret: "synced-secret",
      cloudinaryFolder: "tenant-folder",
    });
  });

  it("falls back to saved tenant values when Render variables are absent", () => {
    const resolved = resolveCloudinaryConfig(
      {
        cloudinaryCloudName: "saved-cloud",
        cloudinaryApiKey: "saved-key",
        cloudinaryApiSecret: "saved-secret",
        cloudinaryFolder: "saved-folder",
      },
      {},
    );

    assert.deepEqual(resolved, {
      cloudinaryCloudName: "saved-cloud",
      cloudinaryApiKey: "saved-key",
      cloudinaryApiSecret: "saved-secret",
      cloudinaryFolder: "saved-folder",
    });
  });

  it("uses safe defaults when neither source has a value", () => {
    assert.deepEqual(resolveCloudinaryConfig({}, {}), {
      cloudinaryCloudName: "",
      cloudinaryApiKey: "",
      cloudinaryApiSecret: "",
      cloudinaryFolder: "gear-glitch",
    });
  });
});
