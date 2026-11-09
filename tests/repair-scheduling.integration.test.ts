import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { bootstrapTestDatabase } from "../server/test-db";
const HAS_DB = bootstrapTestDatabase();

import { closePool, getPool, query, queryOne, runSchema } from "../server/db-helpers";
import { updateRepairTicket } from "../server/repairs";

const TICKETS = ["REP-SCHEDULE-TEST-A", "REP-SCHEDULE-TEST-B", "REP-SCHEDULE-TEST-C"];
const TECH_USER = "repair-schedule-test-tech";
const CUSTOMER_EMAIL = "repair-schedule-test@example.invalid";

describe("repair appointment scheduling rules", () => {
  it("validates duration bounds and protects the update endpoint", () => {
    const repairs = fs.readFileSync(path.join(__dirname, "..", "server", "repairs.ts"), "utf8");
    const routeFile = fs.readFileSync(path.join(__dirname, "..", "server", "index.ts"), "utf8");
    const routeStart = routeFile.indexOf('app.patch("/api/repairs/:id"');
    const route = routeStart >= 0 ? routeFile.slice(routeStart, routeStart + 1800) : "";
    assert.match(repairs, /scheduledDurationMinutes/);
    assert.match(repairs, /Appointment length must be between 15 minutes and 8 hours/);
    assert.match(repairs, /pg_advisory_xact_lock/);
    assert.match(repairs, /scheduled_at::timestamp < \$3::timestamp \+ make_interval/);
    assert.ok(route);
    assert.match(route, /conflict \? 409 : 400/);
  });
});

describe("repair appointment overlap protection (disposable DB)", { skip: !HAS_DB && "TEST_DATABASE_URL not set (disposable test DB only)" }, () => {
  let customerId = 0;
  let techId = 0;

  before(async () => {
    getPool();
    await runSchema(fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8"));
    await query(fs.readFileSync(path.join(__dirname, "..", "server", "migrations", "0039_repair_schedule_duration.sql"), "utf8"));
    await query(
      `INSERT INTO customers (name, email, password_hash)
       VALUES ('Repair Schedule Test', $1, 'test') ON CONFLICT (email) DO NOTHING`,
      [CUSTOMER_EMAIL]
    );
    customerId = Number((await queryOne("SELECT id FROM customers WHERE email = $1", [CUSTOMER_EMAIL]))?.id);
    techId = Number((await queryOne(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, 'repair-schedule-tech@example.invalid', 'test', 'technician')
       ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email RETURNING id`,
      [TECH_USER]
    ))?.id);
    assert.ok(customerId > 0 && techId > 0);
  });

  beforeEach(async () => {
    for (const id of TICKETS) {
      await query("DELETE FROM repair_updates WHERE ticket_id = $1", [id]);
      await query("DELETE FROM repair_tickets WHERE id = $1", [id]);
      await query(
        `INSERT INTO repair_tickets (id, customer_id, device_type, issue_description, status, eta_at)
         VALUES ($1, $2, 'Laptop', 'Scheduling integration test', 'received', NOW()::text)`,
        [id, customerId]
      );
    }
  });

  after(async () => {
    for (const id of TICKETS) {
      await query("DELETE FROM repair_updates WHERE ticket_id = $1", [id]);
      await query("DELETE FROM repair_tickets WHERE id = $1", [id]);
    }
    if (techId > 0) await query("DELETE FROM users WHERE id = $1", [techId]);
    if (customerId > 0) await query("DELETE FROM customers WHERE id = $1", [customerId]);
    await closePool();
  });

  it("rejects overlapping appointments and explains the conflict", async () => {
    await updateRepairTicket(TICKETS[0], { assignedTo: techId, scheduledAt: "2032-06-01T10:00", scheduledDurationMinutes: 60 });
    const result = await updateRepairTicket(TICKETS[1], { assignedTo: techId, scheduledAt: "2032-06-01T10:45", scheduledDurationMinutes: 30 });
    assert.equal(result && "conflict" in result ? result.conflict : false, true);
    assert.match(result && "error" in result ? result.error : "", /already booked on repair #REP-SCHEDULE-TEST-A/);
    const row = await queryOne("SELECT scheduled_at FROM repair_tickets WHERE id = $1", [TICKETS[1]]) as any;
    assert.equal(row.scheduled_at, null, "a rejected booking must leave the ticket unscheduled");
  });

  it("allows a back-to-back appointment at the exact end time", async () => {
    await updateRepairTicket(TICKETS[0], { assignedTo: techId, scheduledAt: "2032-06-02T10:00", scheduledDurationMinutes: 60 });
    const result = await updateRepairTicket(TICKETS[1], { assignedTo: techId, scheduledAt: "2032-06-02T11:00", scheduledDurationMinutes: 30 });
    assert.ok(result && !("error" in result));
    const row = await queryOne("SELECT scheduled_at, scheduled_duration_minutes FROM repair_tickets WHERE id = $1", [TICKETS[1]]) as any;
    assert.equal(row.scheduled_at, "2032-06-02T11:00");
    assert.equal(Number(row.scheduled_duration_minutes), 30);
  });

  it("serializes concurrent bookings so only one overlapping save succeeds", async () => {
    const results = await Promise.all([
      updateRepairTicket(TICKETS[0], { assignedTo: techId, scheduledAt: "2032-06-03T10:00", scheduledDurationMinutes: 60 }),
      updateRepairTicket(TICKETS[1], { assignedTo: techId, scheduledAt: "2032-06-03T10:30", scheduledDurationMinutes: 60 }),
    ]);
    assert.equal(results.filter((result) => result && !("error" in result)).length, 1);
    assert.equal(results.filter((result) => result && "conflict" in result && result.conflict).length, 1);
  });
});
