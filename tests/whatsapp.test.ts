import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import crypto from "crypto";

import {
  normalizePhone,
  isValidKenyanPhone,
  isWithin24Hours,
  buildWhatsAppSignature,
  signaturesMatch,
  verifyWhatsAppSignature,
} from "../server/whatsapp";
import { getPool, query, runSchema } from "../server/db-helpers";
import { claimWebhookEvent, markWebhookProcessed, markWebhookFailed } from "../server/integrations-store";

// DB-backed webhook-ledger checks. Dev + prod share one Neon project, so this
// suite only runs when DATABASE_URL points at a disposable/local database (CI
// provides one). It never runs against production by default.
const HAS_DB = !!process.env.DATABASE_URL;

describe("whatsapp phone normalization", () => {
  test("normalizes 07XXXXXXXX to 2547XXXXXXXX", () => {
    assert.equal(normalizePhone("0712345678"), "254712345678");
  });

  test("normalizes 01XXXXXXXX to 2541XXXXXXXX", () => {
    assert.equal(normalizePhone("0112345678"), "254112345678");
  });

  test("keeps an already-E.164 number and strips formatting", () => {
    assert.equal(normalizePhone("+254 712 345 678"), "254712345678");
    assert.equal(normalizePhone("254-712-345-678"), "254712345678");
    assert.equal(normalizePhone("254 712 345 678"), "254712345678");
  });

  test("returns digit-only for non-Kenyan input and handles empty input", () => {
    assert.equal(normalizePhone("14155550123"), "14155550123");
    assert.equal(normalizePhone("+1 415 555 0100"), "14155550100");
    assert.equal(normalizePhone(""), "");
    assert.equal(normalizePhone("not a number"), "");
  });

  test("isValidKenyanPhone accepts 254 + 9 digits and rejects the rest", () => {
    assert.equal(isValidKenyanPhone("0712345678"), true);
    assert.equal(isValidKenyanPhone("+254 712 345 678"), true);
    assert.equal(isValidKenyanPhone("254712345678"), true);
    assert.equal(isValidKenyanPhone("25471234567"), false);
    assert.equal(isValidKenyanPhone("12345"), false);
    assert.equal(isValidKenyanPhone(""), false);
    assert.equal(isValidKenyanPhone("+1 415 555 0100"), false);
  });
});

describe("whatsapp 24-hour window", () => {
  test("returns false for null / invalid timestamps", () => {
    assert.equal(isWithin24Hours(null), false);
    assert.equal(isWithin24Hours(""), false);
    assert.equal(isWithin24Hours("not-a-date"), false);
  });

  test("is true just inside 24h and false just outside", () => {
    const now = Date.now();
    assert.equal(isWithin24Hours(new Date(now - 60_000).toISOString()), true);
    assert.equal(isWithin24Hours(new Date(now - 23 * 60 * 60 * 1000).toISOString()), true);
    assert.equal(isWithin24Hours(new Date(now - 25 * 60 * 60 * 1000).toISOString()), false);
  });
});

describe("whatsapp signature", () => {
  test("buildWhatsAppSignature matches Meta's documented HMAC format", () => {
    const raw = Buffer.from(JSON.stringify({ object: "whatsapp_business_account" }));
    const sig = buildWhatsAppSignature(raw, "app-secret");
    const independent = "sha256=" + crypto.createHmac("sha256", "app-secret").update(raw).digest("hex");
    assert.equal(sig, independent);
    assert.match(sig, /^sha256=[0-9a-f]{64}$/);
  });

  test("signaturesMatch is length-safe and constant-time", () => {
    assert.equal(signaturesMatch("abc", "abc"), true);
    assert.equal(signaturesMatch("abc", "abcd"), false);
    assert.equal(signaturesMatch("abc", ""), false);
    assert.equal(signaturesMatch("abc", "abd"), false);
  });

  test("verifyWhatsAppSignature rejects malformed/absent headers without a DB hit", async () => {
    const raw = Buffer.from("{}");
    assert.equal(await verifyWhatsAppSignature(raw, undefined), false);
    assert.equal(await verifyWhatsAppSignature(raw, "deadbeef"), false);
    assert.equal(await verifyWhatsAppSignature(raw, "sha256=zz"), false);
    assert.equal(await verifyWhatsAppSignature(Buffer.alloc(0), "sha256=" + "a".repeat(64)), false);
  });
});

if (HAS_DB) {
  describe("whatsapp webhook ledger (integration)", () => {
    before(async () => {
      process.env.JWT_SECRET = process.env.JWT_SECRET || "qa-whatsapp-test-jwt-0123456789abcdef";
      getPool();
      const schema = fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8");
      await runSchema(schema);
      await query("TRUNCATE webhook_events");
    });

    test("claims a new event, then skips in-progress and duplicate redeliveries", async () => {
      const first = await claimWebhookEvent("whatsapp", "message:abc", { id: "abc" });
      assert.equal(first.decision, "process");

      const concurrent = await claimWebhookEvent("whatsapp", "message:abc", { id: "abc" });
      assert.equal(concurrent.decision, "in_progress");

      await markWebhookProcessed("whatsapp", "message:abc", 200);
      const afterDone = await claimWebhookEvent("whatsapp", "message:abc", { id: "abc" });
      assert.equal(afterDone.decision, "duplicate");
    });

    test("re-claims a failed event so a redelivery retries it", async () => {
      await claimWebhookEvent("whatsapp", "status:sent-1:failed", { id: "sent-1", status: "failed" });
      await markWebhookFailed("whatsapp", "status:sent-1:failed", "boom");
      const reclaim = await claimWebhookEvent("whatsapp", "status:sent-1:failed", { id: "sent-1", status: "failed" });
      assert.equal(reclaim.decision, "process");
    });

    test("verifyWhatsAppSignature accepts a raw body signed with the stored app secret", async () => {
      const { updateSettings } = await import("../server/db");
      await updateSettings({ whatsappAppSecret: "app-secret-under-test" });
      const raw = Buffer.from(JSON.stringify({ object: "whatsapp_business_account" }));
      const good = buildWhatsAppSignature(raw, "app-secret-under-test");
      assert.equal(await verifyWhatsAppSignature(raw, good), true);
      assert.equal(await verifyWhatsAppSignature(raw, buildWhatsAppSignature(raw, "wrong-secret")), false);
    });
  });
}
