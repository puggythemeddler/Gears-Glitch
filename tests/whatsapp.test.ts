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
  buildWhatsAppWebhookUrl,
  signaturesMatch,
  verifyWhatsAppSignature,
  verifyWhatsAppChallenge,
  testWhatsAppConnection,
  handleWhatsAppWebhook,
  isCustomWhatsAppVerifyTokenConfigured,
  whatsAppWebhookHttpStatus,
  type WhatsAppWebhookResult,
} from "../server/whatsapp";
import { getPool, query, queryOne, runSchema } from "../server/db-helpers";
import { hasSafeTestDatabase, applyTestDatabaseUrl } from "../server/test-db";
import {
  claimWebhookEvent,
  completeWebhookClaim,
  failWebhookClaim,
  WEBHOOK_LEASE_SECONDS,
} from "../server/integrations-store";

// DB-backed webhook-ledger checks. These only run against an explicitly
// configured, validated disposable test database (TEST_DATABASE_URL); the
// runtime DATABASE_URL is never used as a fallback. See server/test-db.ts.
const HAS_DB = hasSafeTestDatabase();

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

describe("WhatsApp webhook URL builder", () => {
  test("prefers the explicit tenant API base and normalizes trailing slashes", () => {
    assert.equal(buildWhatsAppWebhookUrl("https://custom-api.example.com/", "https://tenant-api.onrender.com"), "https://custom-api.example.com/api/webhooks/whatsapp");
  });

  test("uses Render's service URL when no explicit API base is configured", () => {
    assert.equal(buildWhatsAppWebhookUrl("", "https://tenant-api.onrender.com/"), "https://tenant-api.onrender.com/api/webhooks/whatsapp");
  });

  test("returns no URL instead of a misleading relative storefront URL when no API base exists", () => {
    assert.equal(buildWhatsAppWebhookUrl("", ""), "");
    assert.equal(buildWhatsAppWebhookUrl(undefined), "");
  });
});

describe("whatsapp webhook verification token", () => {
  test("requires a non-empty custom token instead of the built-in fallback", () => {
    assert.equal(isCustomWhatsAppVerifyTokenConfigured(""), false);
    assert.equal(isCustomWhatsAppVerifyTokenConfigured("   "), false);
    assert.equal(isCustomWhatsAppVerifyTokenConfigured("gear-glitch-wa-verify"), false);
    assert.equal(isCustomWhatsAppVerifyTokenConfigured("merchant-specific-random-token"), true);
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

describe("WhatsApp connection lifecycle probe (mocked Meta API)", () => {
  const configuredSettings = (overrides: Record<string, unknown> = {}) => ({
    whatsappPhoneNumberId: "1234567890",
    whatsappAccessToken: "test-token",
    whatsappApiVersion: "v21.0",
    ...overrides,
  }) as any;

  test("does not make a network request when credentials are missing", async () => {
    let calls = 0;
    const result = await testWhatsAppConnection({
      getSettings: async () => configuredSettings({ whatsappAccessToken: "" }),
      fetch: async () => { calls++; throw new Error("must not fetch"); },
    });
    assert.equal(result.ok, false);
    assert.match(result.error || "", /Phone Number ID and Access Token are required/);
    assert.equal(calls, 0);
  });

  test("connects and reconnects using the current credentials without sending a message", async () => {
    const tokens: string[] = [];
    let activeToken = "expired-token";
    const fetchMock: typeof fetch = async (_input, init) => {
      const auth = new Headers(init?.headers).get("authorization") || "";
      tokens.push(auth);
      if (auth.includes("expired-token")) {
        return new Response(JSON.stringify({ error: { code: 190, message: "Access token has expired" } }), { status: 400 });
      }
      return new Response(JSON.stringify({ id: "1234567890", display_phone_number: "+254 799 391 257" }), { status: 200 });
    };
    const getSettings = async () => configuredSettings({ whatsappAccessToken: activeToken });
    const first = await testWhatsAppConnection({ getSettings, fetch: fetchMock });
    assert.equal(first.ok, false);
    assert.match(first.error || "", /invalid, expired, or revoked/i);

    activeToken = "replacement-token";
    const second = await testWhatsAppConnection({ getSettings, fetch: fetchMock });
    assert.deepEqual(second, { ok: true, phoneNumber: "+254 799 391 257" });
    assert.deepEqual(tokens, ["Bearer expired-token", "Bearer replacement-token"]);
  });

  test("explains a revoked permission and avoids exposing credentials in the result", async () => {
    const result = await testWhatsAppConnection({
      getSettings: async () => configuredSettings(),
      fetch: async () => new Response(JSON.stringify({ error: { code: 10, message: "Permission denied" } }), { status: 403 }),
    });
    assert.equal(result.ok, false);
    assert.match(result.error || "", /lacks permission/i);
    assert.doesNotMatch(result.error || "", /test-token/);
  });

  test("rejects a malformed API version before contacting Meta", async () => {
    let calls = 0;
    const result = await testWhatsAppConnection({
      getSettings: async () => configuredSettings({ whatsappApiVersion: "https://attacker.example" }),
      fetch: async () => { calls++; throw new Error("must not fetch"); },
    });
    assert.equal(result.ok, false);
    assert.match(result.error || "", /API version is invalid/);
    assert.equal(calls, 0);
  });

  test("turns network and timeout failures into a failed probe result", async () => {
    const network = await testWhatsAppConnection({
      getSettings: async () => configuredSettings(),
      fetch: async () => { throw new Error("network unavailable"); },
    });
    assert.deepEqual(network, { ok: false, error: "network unavailable" });

    const timeout = await testWhatsAppConnection({
      getSettings: async () => configuredSettings(),
      fetch: async () => { const error = new Error("aborted"); error.name = "TimeoutError"; throw error; },
    });
    assert.match(timeout.error || "", /timed out/i);
  });
});

describe("WhatsApp webhook retry lifecycle (mock ledger)", () => {
  test("retries a failed event, completes it once, then skips the duplicate", async () => {
    const states = new Map<string, "failed" | "processed" | "processing">();
    let processAttempts = 0;
    const deps = {
      claim: async (_provider: string, key: string) => {
        if (states.get(key) === "processed") return { event: null, decision: "duplicate" as const, token: null, leaseExpiresAt: null };
        if (states.get(key) === "processing") return { event: null, decision: "in_progress" as const, token: null, leaseExpiresAt: null };
        states.set(key, "processing");
        return { event: null, decision: "process" as const, token: `lease-${processAttempts + 1}`, leaseExpiresAt: null };
      },
      complete: async (_provider: string, key: string) => { states.set(key, "processed"); return true; },
      fail: async (_provider: string, key: string) => { states.set(key, "failed"); return true; },
      processInbound: async () => {
        processAttempts++;
        if (processAttempts === 1) throw new Error("temporary processing failure");
      },
    };
    const body = { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { messages: [{ id: "wamid.TEST-1", from: "254712345678", type: "text", text: { body: "hello" } }] } }] }] };

    const failed = await handleWhatsAppWebhook(body, deps);
    assert.equal(failed.failed, 1);
    assert.equal(whatsAppWebhookHttpStatus(failed), 500);

    const recovered = await handleWhatsAppWebhook(body, deps);
    assert.equal(recovered.processed, 1);
    assert.equal(recovered.ok, true);

    const duplicate = await handleWhatsAppWebhook(body, deps);
    assert.equal(duplicate.skipped, 1);
    assert.equal(duplicate.processed, 0);
    assert.equal(processAttempts, 2);
  });
});

if (HAS_DB) {
  describe("whatsapp webhook ledger (integration)", () => {
    before(async () => {
      process.env.JWT_SECRET = process.env.JWT_SECRET || "qa-whatsapp-test-jwt-0123456789abcdef";
      applyTestDatabaseUrl();
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
      // Stale worker A tries to complete ΓÇö must be a no-op.
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

    test("disconnect removes stored and environment credentials; fresh credentials reconnect and old webhook token stops verifying", async () => {
      const { getSettings, updateSettings, disconnectWhatsApp } = await import("../server/db");
      const envKeys = ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_BUSINESS_ACCOUNT_ID"] as const;
      const previousEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
      const settingKeys = ["whatsappEnabled", "adminWhatsAppEnabled", "whatsappPhoneNumberId", "whatsappAccessToken", "whatsappAppSecret", "whatsappVerifyToken", "whatsappBusinessAccountId", "whatsappDisconnected"];
      const historyId = "wamid-lifecycle-disconnect-preserved";
      for (const key of envKeys) process.env[key] = `environment-${key.toLowerCase()}`;
      try {
        await query("DELETE FROM settings WHERE key = ANY($1::text[])", [settingKeys]);
        await query("DELETE FROM whatsapp_logs WHERE wa_message_id = $1", [historyId]);
        await updateSettings({
          whatsappEnabled: true,
          adminWhatsAppEnabled: true,
          whatsappPhoneNumberId: "stored-phone-id",
          whatsappAccessToken: "stored-access-token",
          whatsappAppSecret: "stored-app-secret",
          whatsappVerifyToken: "old-verify-token",
          whatsappBusinessAccountId: "stored-business-id",
        });
        await query("INSERT INTO whatsapp_logs (phone_number, direction, message_type, content, status, wa_message_id) VALUES ($1, 'inbound', 'text', 'history remains', 'received', $2)", ["254712345678", historyId]);

        assert.equal((await verifyWhatsAppChallenge("subscribe", "old-verify-token", "challenge")).ok, true);
        await disconnectWhatsApp();

        const disconnected = await getSettings();
        assert.equal(disconnected.whatsappEnabled, false);
        assert.equal(disconnected.adminWhatsAppEnabled, false);
        assert.equal(disconnected.whatsappPhoneNumberId, "");
        assert.equal(disconnected.whatsappAccessToken, "");
        assert.equal(disconnected.whatsappAppSecret, "");
        assert.equal(disconnected.whatsappVerifyToken, "");
        assert.equal(disconnected.whatsappBusinessAccountId, "");
        assert.equal((await verifyWhatsAppChallenge("subscribe", "old-verify-token", "challenge")).ok, false);
        assert.equal(Number((await queryOne("SELECT COUNT(*) AS c FROM whatsapp_logs WHERE wa_message_id = $1", [historyId]) as any).c), 1, "disconnect preserves message history");

        await updateSettings({
          whatsappEnabled: true,
          whatsappPhoneNumberId: "new-phone-id",
          whatsappAccessToken: "new-access-token",
          whatsappAppSecret: "new-app-secret",
          whatsappVerifyToken: "new-verify-token",
          whatsappBusinessAccountId: "new-business-id",
        });
        const reconnected = await getSettings();
        assert.equal(reconnected.whatsappEnabled, true);
        assert.equal(reconnected.whatsappPhoneNumberId, "new-phone-id");
        assert.equal(reconnected.whatsappAccessToken, "new-access-token");
        assert.equal(reconnected.whatsappVerifyToken, "new-verify-token");
        assert.equal((await verifyWhatsAppChallenge("subscribe", "new-verify-token", "challenge")).ok, true);
      } finally {
        await query("DELETE FROM settings WHERE key = ANY($1::text[])", [settingKeys]);
        await query("DELETE FROM whatsapp_logs WHERE wa_message_id = $1", [historyId]);
        for (const key of envKeys) {
          if (previousEnv[key] === undefined) delete process.env[key];
          else process.env[key] = previousEnv[key]!;
        }
      }
    });
  });
}
