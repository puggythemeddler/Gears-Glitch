import { describe, test, before, beforeEach } from "node:test";
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
  handleWhatsAppWebhook,
  whatsAppWebhookHttpStatus,
  type WhatsAppWebhookResult,
} from "../server/whatsapp";
import { getPool, query, queryOne, runSchema } from "../server/db-helpers";
import {
  claimWebhookEvent,
  completeWebhookClaim,
  failWebhookClaim,
  WEBHOOK_LEASE_SECONDS,
} from "../server/integrations-store";

// DB-backed webhook-ledger checks. Dev + prod share one Neon project, so this
// suite only runs when DATABASE_URL points at a disposable/local database (CI
// provides one). It never runs against production by default.
const HAS_DB = !!process.env.DATABASE_URL;

function emptyResult(): WhatsAppWebhookResult {
  return { ok: true, processed: 0, skipped: 0, deferred: 0, failed: 0, errors: [] };
}

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
    assert.equal(await verifyWhatsAppSignature(raw, "sha256=" + "a".repeat(63)), false);
    assert.equal(await verifyWhatsAppSignature(Buffer.alloc(0), "sha256=" + "a".repeat(64)), false);
  });
});

describe("whatsapp webhook acknowledgement mapping", () => {
  test("unsupported-but-valid payloads are acked with nothing to do", async () => {
    assert.deepEqual(await handleWhatsAppWebhook({ object: "page" }), emptyResult());
    assert.deepEqual(await handleWhatsAppWebhook(null), emptyResult());
    assert.deepEqual(await handleWhatsAppWebhook({ object: "whatsapp_business_account", entry: [] }), emptyResult());
  });

  test("whatsAppWebhookHttpStatus maps outcomes to Meta-facing codes", () => {
    const base = emptyResult();
    assert.equal(whatsAppWebhookHttpStatus({ ...base, processed: 1 }), 200);
    assert.equal(whatsAppWebhookHttpStatus({ ...base, skipped: 2 }), 200);
    assert.equal(whatsAppWebhookHttpStatus({ ...base, ok: false, failed: 1 }), 500);
    assert.equal(whatsAppWebhookHttpStatus({ ...base, ok: false, deferred: 1 }), 503);
    assert.equal(whatsAppWebhookHttpStatus({ ...base, ok: false, failed: 1, deferred: 2 }), 500);
  });
});

if (HAS_DB) {
  describe("whatsapp webhook ledger (integration)", () => {
    before(async () => {
      process.env.JWT_SECRET = process.env.JWT_SECRET || "qa-whatsapp-test-jwt-0123456789abcdef";
      getPool();
      const schema = fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8");
      await runSchema(schema);
    });

    beforeEach(async () => {
      await query("TRUNCATE webhook_events");
    });

    test("concurrent deliveries of a brand-new event: exactly one wins, the other defers", async () => {
      const [a, b] = await Promise.all([
        claimWebhookEvent("whatsapp", "message:race-1", { id: "race-1" }),
        claimWebhookEvent("whatsapp", "message:race-1", { id: "race-1" }),
      ]);
      const decisions = [a.decision, b.decision].sort();
      assert.deepEqual(decisions, ["in_progress", "process"]);
      const winner = a.decision === "process" ? a : b;
      assert.ok(winner.token, "the winning claim must carry an ownership token");
    });

    test("a processed event is a duplicate on redelivery", async () => {
      const claim = await claimWebhookEvent("whatsapp", "message:done-1", { id: "done-1" });
      assert.equal(claim.decision, "process");
      assert.equal(await completeWebhookClaim("whatsapp", "message:done-1", claim.token!, 200), true);
      const again = await claimWebhookEvent("whatsapp", "message:done-1", { id: "done-1" });
      assert.equal(again.decision, "duplicate");
      assert.equal(again.token, null);
    });

    test("a failed event is re-claimable and completes on the retry", async () => {
      const first = await claimWebhookEvent("whatsapp", "message:fail-1", { id: "fail-1" });
      assert.equal(first.decision, "process");
      assert.equal(await failWebhookClaim("whatsapp", "message:fail-1", first.token!, "boom"), true);
      const retry = await claimWebhookEvent("whatsapp", "message:fail-1", { id: "fail-1" });
      assert.equal(retry.decision, "process");
      assert.ok(retry.token && retry.token !== first.token, "retry must get a fresh token");
      assert.equal(await completeWebhookClaim("whatsapp", "message:fail-1", retry.token!, 200), true);
      assert.equal((await claimWebhookEvent("whatsapp", "message:fail-1", { id: "fail-1" })).decision, "duplicate");
    });

    test("a stale lease is reclaimable and the old owner is fenced out", async () => {
      const a = await claimWebhookEvent("whatsapp", "message:stale-1", { id: "stale-1" });
      assert.equal(a.decision, "process");
      // Simulate a crashed worker: force the lease into the past.
      await query("UPDATE webhook_events SET lease_expires_at = NOW() - INTERVAL '1 second' WHERE provider = $1 AND event_key = $2", ["whatsapp", "message:stale-1"]);
      const b = await claimWebhookEvent("whatsapp", "message:stale-1", { id: "stale-1" });
      assert.equal(b.decision, "process");
      assert.ok(b.token && b.token !== a.token);
      // The original (crashed) worker must not be able to complete over the new owner.
      assert.equal(await completeWebhookClaim("whatsapp", "message:stale-1", a.token!, 200), false);
      assert.equal(await completeWebhookClaim("whatsapp", "message:stale-1", b.token!, 200), true);
    });

    test("original fails while a duplicate arrives: the duplicate defers, the retry recovers", async () => {
      const original = await claimWebhookEvent("whatsapp", "message:racefail-1", { id: "race-fail-1" });
      assert.equal(original.decision, "process");
      // A concurrent redelivery arrives while the original is still working.
      const duplicate = await claimWebhookEvent("whatsapp", "message:racefail-1", { id: "racefail-1" });
      assert.equal(original.decision, "process");
      assert.equal(duplicate.decision, "in_progress");
      // Original then fails and releases the claim.
      assert.equal(await failWebhookClaim("whatsapp", "message:racefail-1", original.token!, "original failed"), true);
      // The event is recoverable, not lost: the next redelivery processes it.
      const recovered = await claimWebhookEvent("whatsapp", "message:racefail-1", { id: "racefail-1" });
      assert.equal(recovered.decision, "process");
      assert.equal(await completeWebhookClaim("whatsapp", "message:racefail-1", recovered.token!, 200), true);
    });

    test("a fenced-out completion cannot clobber the current owner", async () => {
      const a = await claimWebhookEvent("whatsapp", "message:fence-1", { id: "fence-1" });
      await query("UPDATE webhook_events SET lease_expires_at = NOW() - INTERVAL '1 second' WHERE provider = $1 AND event_key = $2", ["whatsapp", "message:fence-1"]);
      const b = await claimWebhookEvent("whatsapp", "message:fence-1", { id: "fence-1" });
      assert.equal(b.decision, "process");
      // Stale worker A tries to complete — must be a no-op.
      assert.equal(await completeWebhookClaim("whatsapp", "message:fence-1", a.token!), false);
      const row = await queryOne("SELECT status, claim_token FROM webhook_events WHERE provider = $1 AND event_key = $2", ["whatsapp", "message:fence-1"]) as { status: string; claim_token: string };
      assert.equal(row.status, "processing");
      assert.equal(row.claim_token, b.token);
      assert.equal(await completeWebhookClaim("whatsapp", "message:fence-1", b.token!), true);
    });

    test("attempts increments on each claim for observability", async () => {
      await claimWebhookEvent("whatsapp", "message:attempts-1", { id: "attempts-1" });
      await query("UPDATE webhook_events SET lease_expires_at = NOW() - INTERVAL '1 second' WHERE provider = $1 AND event_key = $2", ["whatsapp", "message:attempts-1"]);
      await claimWebhookEvent("whatsapp", "message:attempts-1", { id: "attempts-1" });
      const row = await queryOne("SELECT attempts FROM webhook_events WHERE provider = $1 AND event_key = $2", ["whatsapp", "message:attempts-1"]) as { attempts: number };
      assert.equal(Number(row.attempts), 2);
      assert.ok(WEBHOOK_LEASE_SECONDS > 0);
    });

    test("a failing event in a multi-message payload does not lose its siblings", async () => {
      const deps = {
        claim: claimWebhookEvent,
        complete: completeWebhookClaim,
        fail: failWebhookClaim,
        processInbound: async (msg: any) => {
          if (msg.id === "bad-1") throw new Error("simulated processing failure");
        },
      };
      const body = {
        object: "whatsapp_business_account",
        entry: [{
          changes: [{
            field: "messages",
            value: {
              messages: [
                { id: "good-1", from: "254712345678", type: "text", text: { body: "hello" } },
                { id: "bad-1", from: "254712345679", type: "text", text: { body: "boom" } },
              ],
            },
          }],
        }],
      };
      const result = await handleWhatsAppWebhook(body, deps);
      assert.equal(result.processed, 1);
      assert.equal(result.failed, 1);
      assert.equal(result.deferred, 0);
      assert.equal(result.ok, false);
      assert.equal(whatsAppWebhookHttpStatus(result), 500);
      const good = await queryOne("SELECT status FROM webhook_events WHERE provider = $1 AND event_key = $2", ["whatsapp", "message:good-1"]) as { status: string };
      const bad = await queryOne("SELECT status FROM webhook_events WHERE provider = $1 AND event_key = $2", ["whatsapp", "message:bad-1"]) as { status: string };
      assert.equal(good.status, "processed");
      assert.equal(bad.status, "failed");
    });

    test("repeated delivery-status callbacks are deduplicated via the ledger", async () => {
      const status = { id: "wamid.STATUS-1", status: "delivered", recipient_id: "254712345678" };
      const body = {
        object: "whatsapp_business_account",
        entry: [{ changes: [{ field: "messages", value: { statuses: [status, { ...status }] } }] }],
      };
      const result = await handleWhatsAppWebhook(body);
      assert.equal(result.processed, 1);
      assert.equal(result.skipped, 1);
      assert.equal(result.deferred, 0);
      assert.equal(result.failed, 0);
      assert.equal(whatsAppWebhookHttpStatus(result), 200);
    });

    test("verifyWhatsAppSignature validates the exact raw request bytes", async () => {
      const { updateSettings } = await import("../server/db");
      await updateSettings({ whatsappAppSecret: "app-secret-under-test" });
      // Raw body contains whitespace, so its compact re-serialization differs.
      const raw = Buffer.from('{\n  "object": "whatsapp_business_account",\n  "entry": []\n}');
      const compact = Buffer.from(JSON.stringify(JSON.parse(raw.toString())));
      assert.notEqual(raw.toString(), compact.toString());
      assert.equal(await verifyWhatsAppSignature(raw, buildWhatsAppSignature(raw, "app-secret-under-test")), true);
      assert.equal(await verifyWhatsAppSignature(raw, buildWhatsAppSignature(raw, "wrong-secret")), false);
      // A signature computed over the *re-serialized* bytes must not verify.
      assert.equal(await verifyWhatsAppSignature(raw, buildWhatsAppSignature(compact, "app-secret-under-test")), false);
    });
  });
}
