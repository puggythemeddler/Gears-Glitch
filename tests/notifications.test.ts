import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

import { query, queryOne } from "../server/db-helpers";
import { updateNotificationPreferences, listNotificationLog } from "../server/notification-service";

const HAS_DB = !!process.env.DATABASE_URL;

describe("notification service (P1)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  before(async () => {
    // Ensure the settings + notification_log tables exist (schema runs at server
    // boot, but tests may target a fresh isolated database). The test runner
    // executes each file in a separate process, so the isolation suite may be
    // bootstrapping the same schema concurrently; retry on the catalog race
    // (duplicate type name) until the other process commits.
    const createIfNeeded = async (sql: string) => {
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          await query(sql);
          return;
        } catch (err: any) {
          if (err?.code === "23505") { await new Promise(r => setTimeout(r, 300)); continue; }
          throw err;
        }
      }
    };
    await createIfNeeded(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    await createIfNeeded(
      `CREATE TABLE IF NOT EXISTS notification_log (
        id SERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        channel TEXT NOT NULL,
        recipient TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        entity_type TEXT NOT NULL DEFAULT '',
        entity_id TEXT NOT NULL DEFAULT '',
        error_message TEXT DEFAULT NULL,
        provider_message_id TEXT DEFAULT NULL,
        created_at TEXT DEFAULT NOW()::text
      )`
    );
    await query(`CREATE INDEX IF NOT EXISTS idx_notif_log_event ON notification_log(event_type)`);
  });

  it("notification_preferences store + update without losing unknown keys", async () => {
    const base = await updateNotificationPreferences({ "order.created": { email: true, whatsapp: false } });
    assert.equal(base["order.created"].email, true);
    assert.equal(base["order.created"].whatsapp, false);

    // Updating one key keeps the rest (merge, not replace).
    const after = await updateNotificationPreferences({ "warranty.created": { email: true, whatsapp: true } });
    assert.equal(after["order.created"].email, true);
    assert.equal(after["warranty.created"].whatsapp, true);

    // Reset so subsequent runs start clean.
    await updateNotificationPreferences({
      "order.created": { email: true, whatsapp: true },
      "warranty.created": { email: true, whatsapp: true },
    });
  });

  it("notification_log records entries and is fetchable via listNotificationLog", async () => {
    // Insert a synthetic row.
    await query(
      `INSERT INTO notification_log (event_type, channel, recipient, status, entity_type, entity_id)
       VALUES ('repair.created', 'email', 'admin@example.com', 'sent', 'repair', 'T-99')`
    );
    const { logs, total } = await listNotificationLog(50, 0);
    assert.ok(total >= 1);
    const row = logs.find((l: any) => l.entity_id === "T-99");
    assert.ok(row, "expected the synthetic notification log row to be listed");
    assert.equal(row.event_type, "repair.created");
    assert.equal(row.channel, "email");
    assert.equal(row.status, "sent");
  });
});