import { describe, test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { bootstrapTestDatabase } from "../server/test-db";
import { detectOptOutKeyword, isWhatsAppSendingAllowed, recordOptOut, recordConsentGrant } from "../server/whatsapp-consent";
import { sendWhatsAppMessage, sendWhatsAppDocument, sendWhatsAppDocumentMessage, sendWhatsAppInteractiveButtons, sendWhatsAppListMessage } from "../server/whatsapp";
import { processPendingDelivery } from "../server/notification-service";
import { enqueueDelivery, listPendingDeliveries } from "../server/integrations-store";
import { getPool, query, queryOne, runSchema } from "../server/db-helpers";
import { updateSettings } from "../server/db";

const HAS_DB = bootstrapTestDatabase();

// ── fetch interception ────────────────────────────────────────────────────────
// Records every outbound call so a test can assert the Meta /messages endpoint
// was (or was not) reached. Never performs a network request.
const realFetch = global.fetch;
let fetchCalls: { url: string; init: any }[] = [];

function mockFetchOk() {
  fetchCalls = [];
  (global as any).fetch = async (url: any, init?: any) => {
    fetchCalls.push({ url: String(url), init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: "wamid.TEST" }] }),
      text: async () => "",
    } as any;
  };
}

function messageFetches() {
  return fetchCalls.filter((c) => c.url.includes("/messages"));
}

afterEach(() => {
  (global as any).fetch = realFetch;
});

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
    await query("TRUNCATE whatsapp_consent, whatsapp_conversations");
    await updateSettings({ adminWhatsAppPhone: "", adminWhatsAppEnabled: false });
  });

  async function seedInboundConversation(phone: string, at: Date) {
    await query(
      `INSERT INTO whatsapp_conversations (phone_number, entity_type, entity_id, entity_name, last_incoming_at)
       VALUES ($1, 'customer', 0, 'C', $2)`,
      [phone, at.toISOString()]
    );
  }

  // ── absent consent ──
  test("no consent row authorises nothing: transactional and marketing are both denied", async () => {
    const t = await isWhatsAppSendingAllowed("0712345678", "transactional");
    assert.equal(t.allowed, false);
    assert.equal(t.policyDenied, true);
    assert.equal(t.authorization, "none");
    const m = await isWhatsAppSendingAllowed("0712345678", "marketing");
    assert.equal(m.allowed, false);
  });

  // ── explicit transactional authorisation ──
  test("explicit transactional consent authorises transactional, not marketing", async () => {
    await recordConsentGrant("0712345678", "checkout", { transactional: true });
    const t = await isWhatsAppSendingAllowed("0712345678", "transactional");
    assert.equal(t.allowed, true);
    assert.equal(t.authorization, "explicit_consent");
    assert.equal((await isWhatsAppSendingAllowed("0712345678", "marketing")).allowed, false);
  });

  // ── explicit denial ──
  test("explicit transactional denial blocks transactional while other categories are unaffected", async () => {
    await recordConsentGrant("0712345678", "preferences", { marketing: true, transactional: false });
    const t = await isWhatsAppSendingAllowed("0712345678", "transactional");
    assert.equal(t.allowed, false);
    assert.equal(t.policyDenied, true);
    assert.equal((await isWhatsAppSendingAllowed("0712345678", "marketing")).allowed, true);
  });

  // ── marketing authorisation ──
  test("explicit marketing consent authorises marketing only", async () => {
    await recordConsentGrant("0712345678", "campaign_optin", { marketing: true });
    const m = await isWhatsAppSendingAllowed("0712345678", "marketing");
    assert.equal(m.allowed, true);
    assert.equal(m.authorization, "explicit_consent");
    // transactional is not granted by a marketing grant and there is no session
    assert.equal((await isWhatsAppSendingAllowed("0712345678", "transactional")).allowed, false);
  });

  // ── opt-out ──
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

  // ── customer-service window ──
  test("an open customer-service session authorises transactional messaging", async () => {
    await seedInboundConversation("254712345678", new Date());
    const t = await isWhatsAppSendingAllowed("0712345678", "transactional");
    assert.equal(t.allowed, true);
    assert.equal(t.authorization, "customer_service_window");
    // a stale session (older than 24h) does not authorise
    await query("UPDATE whatsapp_conversations SET last_incoming_at = $1 WHERE phone_number = $2", [
      new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), "254712345678",
    ]);
    assert.equal((await isWhatsAppSendingAllowed("0712345678", "transactional")).allowed, false);
  });

  // ── merchant-owned number ──
  test("the merchant's own admin number is self-authorised for transactional but not marketing", async () => {
    await updateSettings({ adminWhatsAppPhone: "0712345678" });
    const t = await isWhatsAppSendingAllowed("0712345678", "transactional");
    assert.equal(t.allowed, true);
    assert.equal(t.authorization, "merchant_owned");
    assert.equal((await isWhatsAppSendingAllowed("0712345678", "marketing")).allowed, false);
  });

  // ── recipient scoping (no cross-recipient bleed) ──
  test("authorization for one recipient never authorises another recipient", async () => {
    await recordConsentGrant("0712345678", "checkout", { transactional: true });
    assert.equal((await isWhatsAppSendingAllowed("0712345678", "transactional")).allowed, true);
    // A different number has no consent and no session.
    assert.equal((await isWhatsAppSendingAllowed("0700000000", "transactional")).allowed, false);
    // Opting one number out does not affect the other.
    await recordOptOut("0712345678", "inbound_keyword");
    assert.equal((await isWhatsAppSendingAllowed("0712345678", "transactional")).allowed, false);
    await recordConsentGrant("0700000000", "checkout", { transactional: true });
    assert.equal((await isWhatsAppSendingAllowed("0700000000", "transactional")).allowed, true);
  });

  test("tenant/merchant columns stay NULL in the per-tenant database (single-tenant boundary)", async () => {
    await recordOptOut("0712345678", "inbound_keyword");
    const row = await queryOne("SELECT tenant_id, merchant_id FROM whatsapp_consent") as any;
    assert.equal(row.tenant_id, null);
    assert.equal(row.merchant_id, null);
  });
});

describe("whatsapp send paths + Meta window/template rules (DB, mocked fetch)", { skip: !HAS_DB && "TEST_DATABASE_URL not set (disposable test DB only)" }, () => {
  before(async () => {
    getPool();
    const schema = fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8");
    await runSchema(schema);
  });

  beforeEach(async () => {
    await query("TRUNCATE whatsapp_consent, whatsapp_conversations, whatsapp_logs, notification_deliveries, notification_log, whatsapp_templates");
    await updateSettings({
      whatsappEnabled: true,
      whatsappAccessToken: "test-token",
      whatsappPhoneNumberId: "1234567890",
      whatsappApiVersion: "v21.0",
      adminWhatsAppPhone: "",
      adminWhatsAppEnabled: false,
    });
    mockFetchOk();
  });

  async function grantTransactional(phone: string) {
    await recordConsentGrant(phone, "checkout", { transactional: true });
  }
  async function openWindow(phone: string) {
    await query(
      `INSERT INTO whatsapp_conversations (phone_number, entity_type, entity_id, entity_name, last_incoming_at)
       VALUES ($1, 'customer', 1, 'Cust', $2)`,
      [phone, new Date().toISOString()]
    );
  }
  async function insertTemplate(name: string, category: string, approved: boolean) {
    await query(
      `INSERT INTO whatsapp_templates (name, language, category, body_text, is_approved) VALUES ($1, 'en', $2, 'x', $3)`,
      [name, category, approved]
    );
  }

  // ── opt-out beats everything ──
  test("opted-out recipient: text, document, buttons and list make NO Meta request", async () => {
    await recordOptOut("0712345678", "inbound_keyword");

    const text = await sendWhatsAppMessage("0712345678", "hello", "customer", 1, "Cust");
    const doc = await sendWhatsAppDocument("0712345678", null as any, "invoice-1.pdf", "your invoice");
    const buttons = await sendWhatsAppInteractiveButtons("0712345678", "Pick one", [{ id: "a", title: "A" }]);
    const list = await sendWhatsAppListMessage("0712345678", "Pick one", "Options", [{ title: "T", rows: [{ id: "r", title: "R" }] }]);

    assert.equal(text.ok, false); assert.equal(text.blocked, true);
    assert.equal(doc.ok, false); assert.equal(doc.blocked, true);
    assert.equal(buttons.ok, false); assert.equal((buttons as any).blocked, true);
    assert.equal(list.ok, false); assert.equal((list as any).blocked, true);
    assert.equal(fetchCalls.length, 0, "no outbound request may occur for an opted-out recipient");
  });

  // ── free-form messages OUTSIDE the 24h window are prohibited ──
  test("permitted recipient OUTSIDE the window: buttons, list and document messages are blocked, never sent", async () => {
    await grantTransactional("0712345678"); // consent passes; window is the blocker

    const buttons = await sendWhatsAppInteractiveButtons("0712345678", "Pick one", [{ id: "a", title: "A" }]);
    const list = await sendWhatsAppListMessage("0712345678", "Pick one", "Options", [{ title: "T", rows: [{ id: "r", title: "R" }] }]);
    const doc = await sendWhatsAppDocumentMessage("0712345678", "media-1", "your invoice");

    assert.equal(buttons.ok, false); assert.equal((buttons as any).blocked, true);
    assert.equal(list.ok, false); assert.equal((list as any).blocked, true);
    assert.equal(doc.ok, false); assert.equal((doc as any).blocked, true);
    assert.equal(fetchCalls.length, 0, "free-form messages outside the window must never reach Meta");
  });

  // ── free-form messages INSIDE the 24h window are allowed ──
  test("permitted recipient INSIDE the window: buttons, list and document messages reach Meta", async () => {
    await grantTransactional("0712345678");
    await openWindow("254712345678");

    const buttons = await sendWhatsAppInteractiveButtons("0712345678", "Pick one", [{ id: "a", title: "A" }]);
    const list = await sendWhatsAppListMessage("0712345678", "Pick one", "Options", [{ title: "T", rows: [{ id: "r", title: "R" }] }]);
    const doc = await sendWhatsAppDocumentMessage("0712345678", "media-1", "your invoice");

    assert.equal(buttons.ok, true); assert.equal(buttons.waMessageId, "wamid.TEST");
    assert.equal(list.ok, true);
    assert.equal(doc.ok, true);

    const calls = messageFetches();
    assert.equal(calls.length, 3);
    const bodies = calls.map((c) => JSON.parse(c.init.body));
    assert.equal(bodies[0].type, "interactive");
    assert.equal(bodies[0].to, "254712345678", "the normalised recipient is used, never the raw input");
    assert.equal(bodies[2].type, "document");
  });

  // ── text outside the window falls back to an approved template ──
  test("permitted recipient OUTSIDE the window: plain text uses an approved template and reaches Meta", async () => {
    await grantTransactional("0712345678");
    await insertTemplate("general_notification", "UTILITY", true);

    const text = await sendWhatsAppMessage("0712345678", "hello", "customer", 1, "Cust");
    assert.equal(text.ok, true);
    const calls = messageFetches();
    assert.equal(calls.length, 1);
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.type, "template");
    assert.equal(body.template.name, "general_notification");
  });

  test("permitted recipient OUTSIDE the window: an UNAPPROVED template is blocked, never sent", async () => {
    await grantTransactional("0712345678");
    await insertTemplate("general_notification", "UTILITY", false); // stored but not approved

    const text = await sendWhatsAppMessage("0712345678", "hello", "customer", 1, "Cust");
    assert.equal(text.ok, false);
    assert.equal(text.blocked, true);
    assert.equal(fetchCalls.length, 0, "a stored template that is not approved must not be used");
  });

  test("permitted recipient OUTSIDE the window: a category-mismatched template is blocked, never sent", async () => {
    await grantTransactional("0712345678");
    // A transactional message may not ride a MARKETING template.
    await insertTemplate("general_notification", "MARKETING", true);

    const text = await sendWhatsAppMessage("0712345678", "hello", "customer", 1, "Cust");
    assert.equal(text.ok, false);
    assert.equal(text.blocked, true);
    assert.equal(fetchCalls.length, 0);
  });

  // ── document paths ──
  test("document template fallback OUTSIDE the window uses an approved template (choke point)", async () => {
    await grantTransactional("0712345678");
    await insertTemplate("invoice_notification", "UTILITY", true);

    const doc = await sendWhatsAppDocument("0712345678", null as any, "invoice-1.pdf", "your invoice");
    assert.equal(doc.ok, true);
    const calls = messageFetches();
    assert.equal(calls.length, 1);
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.type, "template");
    assert.equal(body.template.name, "invoice_notification");
  });

  test("opted-out recipient: document template fallback makes NO Meta request even when an approved template exists", async () => {
    await insertTemplate("invoice_notification", "UTILITY", true);
    await recordOptOut("0712345678", "inbound_keyword");
    const doc = await sendWhatsAppDocument("0712345678", null as any, "invoice-1.pdf", "your invoice");
    assert.equal(doc.ok, false);
    assert.equal(doc.blocked, true);
    assert.equal(fetchCalls.length, 0);
  });

  test("document with a PDF OUTSIDE the window skips the free-form media upload and uses the template", async () => {
    await grantTransactional("0712345678");
    await insertTemplate("invoice_notification", "UTILITY", true);

    const doc = await sendWhatsAppDocument("0712345678", Buffer.from("pdf-bytes"), "invoice-1.pdf", "your invoice");
    assert.equal(doc.ok, true);
    // No media upload (that is a free-form path) may have been attempted.
    assert.equal(fetchCalls.filter((c) => c.url.includes("/media")).length, 0, "must not upload media outside the window");
    const calls = messageFetches();
    assert.equal(calls.length, 1);
    assert.equal(JSON.parse(calls[0].init.body).type, "template");
  });

  // ── retry / permanent denial ──
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
    assert.equal(fetchCalls.length, 0, "the denied delivery never reached Meta");
  });
});
