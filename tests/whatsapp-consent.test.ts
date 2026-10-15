import { describe, test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { bootstrapTestDatabase } from "../server/test-db";
import { detectOptOutKeyword, isWhatsAppSendingAllowed, recordOptOut, recordConsentGrant } from "../server/whatsapp-consent";
import { sendWhatsAppMessage, sendWhatsAppDocument } from "../server/whatsapp";
import { processPendingDelivery } from "../server/notification-service";
import { enqueueDelivery, listPendingDeliveries } from "../server/integrations-store";
import { getPool, query, queryOne, runSchema } from "../server/db-helpers";

const HAS_DB = bootstrapTestDatabase();

describe("whatsapp opt-out keyword detection", () => {
  test("recognises the supported stop keywords case/whitespace-insensitively", () => {
    for (const kw of ["STOP", "stop", " Stop ", "UNSUBSCRIBE", "unsubscribe", "CANCEL", "END", "QUIT"]) {
      assert.equal(detectOptOutKeyword(kw), true, `${kw} must opt out`);
    }
  });

  test("strips surrounding punctuation so keypad/formatting variants still match", () => {
    assert.equal(detectOptOutKeyword("STOP."), true);
    assert.equal(detectOptOutKeyword("  stop!  "), true);
  });

  test("does not treat ordinary messages as opt-outs", () => {
    assert.equal(detectOptOutKeyword("please stop by the shop"), false);
    assert.equal(detectOptOutKeyword("I want to cancel my order"), false);
    assert.equal(detectOptOutKeyword("hello"), false);
    assert.equal(detectOptOutKeyword(""), false);
    assert.equal(detectOptOutKeyword(null as any), false);
    assert.equal(detectOptOutKeyword(undefined as any), false);
  });
});

describe("whatsapp consent policy (DB)", { skip: !HAS_DB && "TEST_DATABASE_URL not set (disposable test DB only)" }, () => {
  before(async () => {
    getPool();
    const schema = fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8");
    await runSchema(schema);
  });

  beforeEach(async () => {
    await query("TRUNCATE whatsapp_consent");
  });

  test("no consent row: transactional allowed, marketing denied (fail closed)", async () => {
    const t = await isWhatsAppSendingAllowed("0712345678", "transactional");
    assert.equal(t.allowed, true);
    const m = await isWhatsAppSendingAllowed("0712345678", "marketing");
    assert.equal(m.allowed, false);
    assert.equal(m.policyDenied, true);
  });

  test("recordOptOut blocks every category and is idempotent (single row)", async () => {
    assert.equal(await recordOptOut("0712345678", "inbound_keyword"), true);
    assert.equal(await recordOptOut("0712345678", "inbound_keyword"), true);
    const rows = await query("SELECT id FROM whatsapp_consent WHERE phone_normalized = $1", ["254712345678"]);
    assert.equal(rows.rows.length, 1, "opt-out must be idempotent");

    for (const cat of ["marketing", "transactional", "utility", "service", "authentication"] as const) {
      const d = await isWhatsAppSendingAllowed("0712345678", cat);
      assert.equal(d.allowed, false, `${cat} must be blocked after opt-out`);
      assert.equal(d.optedOut, true);
      assert.equal(d.policyDenied, true);
    }
  });

  test("recordConsentGrant is the only path that restores sending", async () => {
    await recordOptOut("0712345678", "inbound_keyword");
    assert.equal((await isWhatsAppSendingAllowed("0712345678", "transactional")).allowed, false);

    await recordConsentGrant("0712345678", "admin_ui", { marketing: true, transactional: true });
    const t = await isWhatsAppSendingAllowed("0712345678", "transactional");
    const m = await isWhatsAppSendingAllowed("0712345678", "marketing");
    assert.equal(t.allowed, true);
    assert.equal(t.optedOut, false);
    assert.equal(m.allowed, true);
  });

  test("transactional opt-out is honoured even when marketing was granted", async () => {
    await recordConsentGrant("0712345678", "admin_ui", { marketing: true, transactional: false });
    const t = await isWhatsAppSendingAllowed("0712345678", "transactional");
    assert.equal(t.allowed, false);
    assert.equal(t.policyDenied, true);
    // marketing is still explicitly granted
    assert.equal((await isWhatsAppSendingAllowed("0712345678", "marketing")).allowed, true);
  });

  test("numbers are normalised consistently across opt-out and lookup", async () => {
    await recordOptOut("+254 712 345 678", "inbound_keyword");
    const row = await queryOne("SELECT phone_normalized FROM whatsapp_consent", []) as any;
    assert.equal(row.phone_normalized, "254712345678");
    assert.equal((await isWhatsAppSendingAllowed("0712345678", "transactional")).allowed, false);
  });
});

describe("whatsapp send-path enforcement (DB)", { skip: !HAS_DB && "TEST_DATABASE_URL not set (disposable test DB only)" }, () => {
  before(async () => {
    getPool();
    const schema = fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8");
    await runSchema(schema);
  });

  beforeEach(async () => {
    await query("TRUNCATE whatsapp_consent, whatsapp_logs, notification_deliveries, notification_log");
  });

  test("sendWhatsAppMessage refuses an opted-out recipient and sends nothing", async () => {
    await recordOptOut("0712345678", "inbound_keyword");
    const r = await sendWhatsAppMessage("0712345678", "promo", "customer", 1, "Cust");
    assert.equal(r.ok, false);
    assert.equal(r.blocked, true);
    const sent = await query("SELECT id FROM whatsapp_logs WHERE status = 'sent'");
    assert.equal(sent.rows.length, 0, "no message may reach Meta after opt-out");
    const blockedLog = await queryOne("SELECT status FROM whatsapp_logs WHERE status = 'blocked'") as any;
    assert.ok(blockedLog, "the blocked attempt is auditable");
  });

  test("sendWhatsAppDocument refuses an opted-out recipient", async () => {
    await recordOptOut("0712345678", "inbound_keyword");
    const r = await sendWhatsAppDocument("0712345678", null as any, "invoice-1.pdf", "your invoice");
    assert.equal(r.ok, false);
    assert.equal(r.blocked, true);
    assert.equal((await query("SELECT id FROM whatsapp_logs WHERE status = 'sent'")).rows.length, 0);
  });

  test("a queued WhatsApp delivery to an opted-out recipient dead-letters immediately (no retry)", async () => {
    await recordOptOut("0712345678", "inbound_keyword");
    await enqueueDelivery({
      eventId: "evt-blocked-1",
      eventType: "order_paid",
      channel: "whatsapp",
      audience: "customer",
      entityType: "customer",
      entityId: "1",
      recipient: "254712345678",
      subject: "hi",
      payload: JSON.stringify({ text: "hi", entityType: "customer", entityId: 1, entityName: "Cust" }),
      maxAttempts: 5,
    });
    const rows = await listPendingDeliveries(10);
    const row = rows.find((r: any) => r.event_id === "evt-blocked-1");
    assert.ok(row, "delivery row is pending");
    const outcome = await processPendingDelivery(row as any);
    assert.equal(outcome, "dead", "a consent/policy denial must not be retried");
    const status = await queryOne("SELECT status FROM notification_deliveries WHERE event_id = $1", ["evt-blocked-1"]) as any;
    assert.equal(status.status, "dead");
  });

  test("a permitted transactional message is not blocked by the guard", async () => {
    const d = await isWhatsAppSendingAllowed("0712345678", "transactional");
    assert.equal(d.allowed, true);
    assert.equal(d.policyDenied, false);
  });
});

