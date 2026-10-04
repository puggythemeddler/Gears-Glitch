import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { getPool, query, queryOne, runSchema } from "../server/db-helpers";
import { settleDelivery, markDeliveryAttempt } from "../server/integrations-store";

const HAS_DB = !!process.env.DATABASE_URL;
const MIG_DIR = path.join(__dirname, "..", "server", "migrations");
const MIG = "0025_notification_deliveries_updated_at.sql";

// settleDelivery() and markDeliveryAttempt() both stamp updated_at, but the
// column was never created on notification_deliveries. Every delivery outcome
// therefore raised
//   column "updated_at" of relation "notification_deliveries" does not exist
// and the outbound drain rolled back on every tick, so results were never
// persisted and deliveries stayed pending forever.
//
// Both installation paths are covered: a brand new database (schema.sql) and a
// legacy database that already has the table without the column (migration).
describe("notification_deliveries updated_at (DB)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  const runId = `nd-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  const hasColumn = async () => !!(await queryOne(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = 'notification_deliveries' AND column_name = 'updated_at'`
  ));

  before(async () => {
    getPool();
    // Rebuild just this table from schema.sql so the starting point is a clean
    // new install rather than whatever shape a reused test database is in.
    await query(`DROP TABLE IF EXISTS notification_deliveries CASCADE`);
    await runSchema(fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8"));
  });

  async function insertDelivery(status = "pending") {
    const row = await query(
      `INSERT INTO notification_deliveries (event_id, event_type, channel, recipient, status)
       VALUES ($1, 'test.event', 'email', $2, $3) RETURNING id`,
      [`${runId}-${Math.random().toString(36).slice(2, 8)}@example.com`, `${runId}@example.com`, status]
    );
    return (row.rows[0] as any).id as number;
  }

  it("creates updated_at for a new installation", async () => {
    assert.ok(await hasColumn(), "schema.sql must create notification_deliveries.updated_at");
    const col = await queryOne(
      `SELECT is_nullable, column_default FROM information_schema.columns
       WHERE table_name = 'notification_deliveries' AND column_name = 'updated_at'`
    );
    assert.equal(col.is_nullable, "NO");
    assert.match(String(col.column_default), /now\(\)/i);
  });

  it("ships a migration that adds the column to legacy databases", async () => {
    const file = path.join(MIG_DIR, MIG);
    assert.ok(fs.existsSync(file), `migration ${MIG} is missing`);
    const sql = fs.readFileSync(file, "utf8");
    assert.match(sql, /ALTER TABLE notification_deliveries/i);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS updated_at/i);
  });

  it("repairs a legacy table that predates the column", async () => {
    // Reproduce the production database: table exists, column does not.
    await query(`ALTER TABLE notification_deliveries DROP COLUMN IF EXISTS updated_at`);
    assert.equal(await hasColumn(), false, "precondition: column should be absent");

    await query(fs.readFileSync(path.join(MIG_DIR, MIG), "utf8"));
    assert.ok(await hasColumn(), "the migration must add updated_at");

    const col = await queryOne(
      `SELECT is_nullable, column_default FROM information_schema.columns
       WHERE table_name = 'notification_deliveries' AND column_name = 'updated_at'`
    );
    assert.equal(col.is_nullable, "NO");
    assert.match(String(col.column_default), /now\(\)/i);
  });

  it("backfills updated_at from history for rows written before the column existed", async () => {
    // Reproduce a legacy database that already holds rows and lacks the column,
    // then assert the migration preserves their real history instead of stamping
    // every pre-existing delivery as touched at migration time.
    await query(`ALTER TABLE notification_deliveries DROP COLUMN IF EXISTS updated_at`);

    const legacy = await query(
      `INSERT INTO notification_deliveries (event_id, event_type, channel, recipient, status, created_at, sent_at)
       VALUES ($1, 'test.legacy', 'email', $2, 'sent', NOW() - INTERVAL '30 days', NOW() - INTERVAL '29 days')
       RETURNING id, created_at, sent_at`,
      [`legacy-${Math.random().toString(36).slice(2, 8)}@example.com`, `${runId}@example.com`]
    );
    const legacyId = (legacy.rows[0] as any).id as number;
    const createdAt = new Date((legacy.rows[0] as any).created_at as string).getTime();
    const sentAt = new Date((legacy.rows[0] as any).sent_at as string).getTime();

    await query(fs.readFileSync(path.join(MIG_DIR, MIG), "utf8"));

    const row = await queryOne("SELECT updated_at FROM notification_deliveries WHERE id = $1", [legacyId]);
    assert.ok(row.updated_at, "legacy rows must receive a non-null updated_at");
    // COALESCE(sent_at, created_at, now()) prefers sent_at for a delivered row.
    const backfilled = new Date(row.updated_at as string).getTime();
    assert.ok(
      Math.abs(backfilled - sentAt) < 1000,
      `expected updated_at to mirror sent_at, got ${row.updated_at} vs sent_at ${new Date(sentAt).toISOString()}`
    );
    // The real point: an ADD COLUMN ... NOT NULL DEFAULT now() would have stamped
    // this 29-day-old row with the migration time, hiding when it was delivered.
    assert.ok(
      Date.now() - backfilled > 25 * 24 * 60 * 60 * 1000,
      `updated_at must not be the migration timestamp, got ${row.updated_at} (row created ${new Date(createdAt).toISOString()})`
    );
  });

  it("persists a successful delivery outcome", async () => {
    const id = await insertDelivery("pending");
    await settleDelivery(id, { status: "sent", providerMessageId: "prov-123", sentAt: new Date().toISOString() });

    const row = await queryOne(
      "SELECT status, provider_message_id, sent_at, updated_at FROM notification_deliveries WHERE id = $1", [id]
    );
    assert.equal(row.status, "sent");
    assert.equal(row.provider_message_id, "prov-123");
    assert.ok(row.sent_at, "sent_at was not written");
    assert.ok(row.updated_at, "updated_at was not written");
  });

  it("persists a failed attempt and schedules the retry", async () => {
    const id = await insertDelivery("pending");
    const next = new Date(Date.now() + 60_000).toISOString();
    await markDeliveryAttempt(id, { status: "failed", error: "smtp timeout", nextAttemptAt: next });

    const row = await queryOne(
      "SELECT status, last_error, next_attempt_at, last_attempt_at, updated_at FROM notification_deliveries WHERE id = $1",
      [id]
    );
    assert.equal(row.status, "failed");
    assert.equal(row.last_error, "smtp timeout");
    assert.ok(row.last_attempt_at, "last_attempt_at was not written");
    assert.ok(row.updated_at, "updated_at was not written");
  });

  it("records a dead-lettered delivery without clearing next_attempt_at", async () => {
    // notification-service.failDelivery() dead-letters with nextAttemptAt: null.
    // next_attempt_at is NOT NULL, so writing the null straight through raised
    // "null value in column next_attempt_at" and the terminal outcome was lost.
    const id = await insertDelivery("pending");
    await markDeliveryAttempt(id, { status: "dead", error: "gave up", nextAttemptAt: null });

    const row = await queryOne(
      "SELECT status, last_error, next_attempt_at, updated_at FROM notification_deliveries WHERE id = $1", [id]
    );
    assert.equal(row.status, "dead");
    assert.equal(row.last_error, "gave up");
    assert.ok(row.next_attempt_at, "next_attempt_at must not be nulled");
    assert.ok(row.updated_at);

    const due = await queryOne(
      "SELECT 1 FROM notification_deliveries WHERE id = $1 AND status IN ('pending','failed')", [id]
    );
    assert.ok(!due, "a dead delivery must not be picked up for another attempt");
  });

  it("settles the same row twice without error (idempotent drain)", async () => {
    const id = await insertDelivery("pending");
    await markDeliveryAttempt(id, { status: "failed", error: "first", nextAttemptAt: new Date(Date.now() + 30_000).toISOString() });
    await settleDelivery(id, { status: "sent", providerMessageId: "prov-456" });
    const row = await queryOne("SELECT status, last_error FROM notification_deliveries WHERE id = $1", [id]);
    assert.equal(row.status, "sent");
  });
});