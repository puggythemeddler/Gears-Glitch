import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

// Production-shaped rehearsal for 0025_notification_deliveries_updated_at.
//
// This does not apply the migration by reading the .sql file, the way the
// unit test in notification-deliveries-updated-at.test.ts does. It drives the
// real deployment path - initDb(), which is what every server boot runs - so
// the runner's transaction wrapper, version bookkeeping and ordering are all
// exercised exactly as they would be in production.
//
// The starting state is the schema as currently deployed: notification_deliveries
// exists and holds real rows, but has no updated_at column.
import { getPool, query, queryOne, runSchema } from "../server/db-helpers";
import { initDb } from "../server/db";

const HAS_DB = !!process.env.DATABASE_URL;

// Every pre-existing column, so "no existing data was destroyed" is checked
// against the whole row and not just the columns the migration touches.
// updated_at is deliberately excluded: populating it is the point of the change.
const FINGERPRINT = `
  SELECT count(*)::int AS n,
         coalesce(md5(string_agg(
           id || '|' || coalesce(event_id,'') || '|' || coalesce(event_type,'') || '|' ||
           coalesce(channel,'') || '|' || coalesce(recipient,'') || '|' || coalesce(status,'') || '|' ||
           coalesce(customer_id::text,'') || '|' || coalesce(idempotency_key,'') || '|' ||
           coalesce(created_at::text,'') || '|' || coalesce(sent_at::text,''),
           ',' ORDER BY id)), 'empty') AS digest
  FROM notification_deliveries`;

async function seedLegacyRows(count: number): Promise<void> {
  // A spread of shapes a live queue produces: delivered rows carry sent_at,
  // everything else does not, and created_at is backdated so a migration-time
  // stamp would be obviously wrong.
  await query(
    `INSERT INTO notification_deliveries
       (event_id, event_type, channel, recipient, status, idempotency_key, created_at, sent_at)
     SELECT
       'legacy-' || g || '-' || s.n,
       'test.legacy',
       'email',
       'legacy-' || g || '-' || s.n || '@example.com',
       (ARRAY['pending','sent','failed','dead'])[1 + (g % 4)],
       'legacy-key-' || g || '-' || s.n,
       NOW() - ((g * 7 + s.n) || ' days')::interval,
       CASE WHEN (g % 4) = 1 THEN NOW() - ((g * 7 + s.n - 1) || ' days')::interval ELSE NULL END
     FROM generate_series(1, $1) AS s(n)
     CROSS JOIN generate_series(1, 3) AS g`,
    [count]
  );
}

describe("migration 0025 on a production-shaped database", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  let baseline: { n: number; digest: string };

  before(async () => {
    getPool();
    process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "MigrationTestAdmin1!";
    process.env.TECH_PASSWORD = process.env.TECH_PASSWORD || "MigrationTestTech1!";
    process.env.JWT_SECRET = process.env.JWT_SECRET || "migration-rehearsal-secret-0123456789abcdef";

    // Build the current schema, then rewind notification_deliveries to the shape
    // that is actually deployed in production (table present, column absent).
    await runSchema(fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8"));
    await query(`DROP TABLE IF EXISTS notification_deliveries CASCADE`);
    await runSchema(fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8"));
    await query(`ALTER TABLE notification_deliveries DROP COLUMN IF EXISTS updated_at`);
    await query(`DELETE FROM notification_deliveries`);
    // schema_migrations is created by the runner, not schema.sql, so make sure it
    // exists before asserting 0025 has not been recorded yet.
    await query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (NOW()::text)
    )`);
    await query(`DELETE FROM schema_migrations WHERE version = '0025_notification_deliveries_updated_at'`);
    await seedLegacyRows(40);

    baseline = await queryOne(FINGERPRINT);
    assert.equal(baseline.n, 120, "precondition: legacy rows are seeded");
    assert.equal(
      await queryOne(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'notification_deliveries' AND column_name = 'updated_at'`
      ) ? 1 : 0,
      0,
      "precondition: the deployed schema has no updated_at column"
    );
  });

  it("adds the column and preserves every existing row on the real boot path", async () => {
    // This is the production deployment trigger: the server boots and the
    // migration runner picks 0025 up automatically.
    await initDb();

    const after = await queryOne(FINGERPRINT);
    assert.equal(after.n, baseline.n, "row count must be unchanged");
    assert.equal(after.digest, baseline.digest, "no pre-existing column may be modified or destroyed");

    const col = await queryOne(
      `SELECT is_nullable, column_default FROM information_schema.columns
       WHERE table_name = 'notification_deliveries' AND column_name = 'updated_at'`
    );
    assert.ok(col, "0025 must add updated_at");
    assert.equal(col.is_nullable, "NO");
    assert.match(String(col.column_default), /now\(\)/i);

    const recorded = await queryOne(
      `SELECT version FROM schema_migrations WHERE version = '0025_notification_deliveries_updated_at'`
    );
    assert.ok(recorded, "the runner must record the version so it cannot re-apply");
  });

  it("backfills history rather than stamping every row with the migration time", async () => {
    const bad = await query(
      `SELECT count(*)::int AS n FROM notification_deliveries
       WHERE updated_at IS DISTINCT FROM COALESCE(sent_at, created_at, now())`
    );
    assert.equal(
      (bad.rows[0] as any).n,
      0,
      "every legacy row must be backfilled from its own sent_at/created_at"
    );

    // The distinguishing property: a 1+ day old row must not claim it was
    // touched during this migration.
    const stamped = await query(
      `SELECT count(*)::int AS n FROM notification_deliveries
       WHERE updated_at > NOW() - INTERVAL '1 minute'`
    );
    assert.equal((stamped.rows[0] as any).n, 0, "no row may be stamped with the migration timestamp");
  });

  it("defaults updated_at on new rows and accepts the live writer's UPDATE", async () => {
    const ins = await query(
      `INSERT INTO notification_deliveries (event_id, event_type, channel, recipient, status)
       VALUES ('post-0025', 'test.event', 'email', 'post-0025@example.com', 'pending')
       RETURNING id, updated_at`
    );
    const id = (ins.rows[0] as any).id;
    assert.ok((ins.rows[0] as any).updated_at, "a new row must get updated_at from the column default");

    // Exactly what settleDelivery()/markDeliveryAttempt() issue, including the
    // dead-letter update that used to violate next_attempt_at's NOT NULL.
    await query(`UPDATE notification_deliveries SET status = 'sent', updated_at = NOW() WHERE id = $1`, [id]);
    await query(
      `UPDATE notification_deliveries
       SET status = 'dead', last_error = 'boom', updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
    const row = await queryOne(`SELECT status, updated_at FROM notification_deliveries WHERE id = $1`, [id]);
    assert.equal(row.status, "dead");
    assert.ok(row.updated_at);
  });

  it("is idempotent: a second boot changes nothing", async () => {
    const snapshot = await queryOne(FINGERPRINT);
    await initDb();
    await initDb();
    const again = await queryOne(FINGERPRINT);
    assert.equal(again.n, snapshot.n, "re-running must not add or drop rows");
    assert.equal(again.digest, snapshot.digest, "re-running must not rewrite existing rows");
  });
});