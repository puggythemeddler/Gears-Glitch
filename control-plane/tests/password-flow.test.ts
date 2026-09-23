import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  validateInitialPassword,
  buildRenderEnvVars,
  buildWelcomeEmailBody,
} from "../server/provision";

describe("validateInitialPassword", () => {
  it("accepts a valid password", () => {
    assert.equal(validateInitialPassword("s3cur3-pass!"), null);
  });

  it("accepts a valid password with a matching confirm", () => {
    assert.equal(validateInitialPassword("s3cur3-pass!", "s3cur3-pass!"), null);
  });

  it("rejects missing, empty, and whitespace-only passwords", () => {
    assert.ok(validateInitialPassword(undefined as any));
    assert.ok(validateInitialPassword(""));
    assert.ok(validateInitialPassword("   "));
    assert.ok(validateInitialPassword(" \t "));
  });

  it("rejects passwords with leading or trailing spaces", () => {
    assert.ok(validateInitialPassword(" pass1234"));
    assert.ok(validateInitialPassword("pass1234 "));
  });

  it("rejects passwords shorter than 8 characters", () => {
    assert.ok(validateInitialPassword("short7"));
    assert.ok(validateInitialPassword("1234567"));
    assert.equal(validateInitialPassword("12345678"), null);
  });

  it("rejects a mismatching confirm field", () => {
    assert.ok(validateInitialPassword("correct-pass-1", "wrong-pass-2"));
  });

  it("ignores a missing confirm field", () => {
    assert.equal(validateInitialPassword("correct-pass-1"), null);
  });

  it("returns clear messages (no password echoed)", () => {
    for (const bad of [undefined, "", "   ", "abc", "pass1234 "]) {
      const msg = validateInitialPassword(bad as any, "anything");
      assert.ok(msg, "expected an error message for an invalid password");
      if (bad && String(bad).trim() !== "") {
        assert.ok(!String(msg).includes(String(bad)), "error must not echo the password");
      }
    }
  });
});

describe("buildRenderEnvVars", () => {
  const base = {
    clientName: "John's Electronics",
    dbUrl: "postgres://user:pass@host/db",
    clientSlug: "johns-electronics",
    cloudinary: null,
    cpSecret: "cps_secret",
    adminEmail: "owner@example.com",
    adminPassword: "ctrl-selected-pass",
  };

  const byKey = (vars: { key: string; value: string }[]) => Object.fromEntries(vars.map((v) => [v.key, v.value]));

  it("carries the controller-selected password as ADMIN_PASSWORD", () => {
    const vars = buildRenderEnvVars(base);
    assert.equal(byKey(vars).ADMIN_PASSWORD, "ctrl-selected-pass");
  });

  it("never repeats the password anywhere else in the env vars", () => {
    const vars = buildRenderEnvVars(base);
    for (const v of vars) {
      if (v.key !== "ADMIN_PASSWORD") {
        assert.notEqual(v.value, "ctrl-selected-pass", `${v.key} must not contain the admin password`);
      }
    }
  });

  it("includes the required service env vars", () => {
    const vars = byKey(buildRenderEnvVars(base));
    assert.equal(vars.ADMIN_USERNAME, "admin");
    assert.equal(vars.ADMIN_EMAIL, "owner@example.com");
    assert.equal(vars.DATABASE_URL, base.dbUrl);
    assert.equal(vars.CONTROL_PLANE_SECRET, "cps_secret");
    assert.equal(vars.STORE_NAME, "John's Electronics");
    assert.equal(vars.TECH_EMAIL, "tech@johns-electronics.com");
  });

  it("adds Cloudinary env vars only when full credentials are present", () => {
    const withCloudinary = buildRenderEnvVars({
      ...base,
      cloudinary: { cloudName: "gnc", apiKey: "k", apiSecret: "s", folder: "gear-glitch" },
    });
    const vars = byKey(withCloudinary);
    assert.equal(vars.CLOUDINARY_CLOUD_NAME, "gnc");
    assert.equal(vars.CLOUDINARY_API_KEY, "k");
    assert.equal(vars.CLOUDINARY_API_SECRET, "s");
    assert.equal(vars.CLOUDINARY_FOLDER, "gear-glitch/johns-electronics");

    const without = buildRenderEnvVars(base);
    assert.equal((without as any).CLOUDINARY_CLOUD_NAME, undefined);
  });

  it("still works with a partial Cloudinary config (no crash, no vars)", () => {
    const partial = buildRenderEnvVars({ ...base, cloudinary: { cloudName: "gnc", apiKey: "", apiSecret: "", folder: "" } });
    assert.equal(byKey(partial).CLOUDINARY_CLOUD_NAME, undefined);
    assert.equal(byKey(partial).ADMIN_PASSWORD, "ctrl-selected-pass");
  });
});

describe("buildWelcomeEmailBody", () => {
  const password = "ctrl-selected-pass";
  const html = buildWelcomeEmailBody(
    "owner@example.com",
    "John's Electronics",
    "https://johns-electronics.vercel.app",
    "https://johns-electronics-backend.onrender.com",
    "growth"
  );

  it("includes the storefront URL and the admin login URL", () => {
    assert.ok(html.includes("https://johns-electronics.vercel.app"));
    assert.ok(html.includes("https://johns-electronics.vercel.app/login"));
  });

  it("identifies the admin username", () => {
    assert.ok(html.includes("admin"));
  });

  it("never contains the provisioning password", () => {
    assert.ok(!html.includes(password));
  });

  it("points the reader at the provisioning-derived password instead of a password in the email", () => {
    assert.ok(/configured during provisioning/i.test(html));
  });

  it("does not include the string 'Password:' row that used to carry the secret", () => {
    assert.ok(!html.includes("<td style=\"padding: 0.5rem; color: #666;\">Password:</td>"));
  });
});