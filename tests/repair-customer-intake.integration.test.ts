import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { bootstrapTestDatabase } from "../server/test-db";
const HAS_DB = bootstrapTestDatabase();

import { closePool, getPool, query, queryOne, runSchema } from "../server/db-helpers";
import { createRepairTicket, listCustomerRepairDevices, updateRepairTicket } from "../server/repairs";

const CUSTOMER_EMAIL = "repair-owned-device-test@example.invalid";
const OTHER_EMAIL = "repair-owned-device-other@example.invalid";
const PRODUCT_ID = "REPAIR-OWNED-DEVICE-TEST";
const TECH_USER = "repair-owned-device-test-tech";
let customerId = 0;
let otherCustomerId = 0;
let techId = 0;
let orderId = 0;
let orderItemId = 0;
let serialNumber = "GG-REPAIR-OWNED-001";
const createdTicketIds: string[] = [];

describe("customer repair intake (non-production database)", { skip: !HAS_DB && "TEST_DATABASE_URL not set (disposable test DB only)" }, () => {
  before(async () => {
    getPool();
    await runSchema(fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8"));
    await query(fs.readFileSync(path.join(__dirname, "..", "server", "migrations", "0039_repair_schedule_duration.sql"), "utf8"));
    await query(fs.readFileSync(path.join(__dirname, "..", "server", "migrations", "0040_customer_device_and_service_kind.sql"), "utf8"));
    await query(
      `INSERT INTO customers (name, email, password_hash) VALUES ('Repair Intake Test', $1, 'test')
       ON CONFLICT (email) DO NOTHING`, [CUSTOMER_EMAIL]
    );
    await query(
      `INSERT INTO customers (name, email, password_hash) VALUES ('Repair Intake Other', $1, 'test')
       ON CONFLICT (email) DO NOTHING`, [OTHER_EMAIL]
    );
    customerId = Number((await queryOne("SELECT id FROM customers WHERE email = $1", [CUSTOMER_EMAIL]))?.id);
    otherCustomerId = Number((await queryOne("SELECT id FROM customers WHERE email = $1", [OTHER_EMAIL]))?.id);
    techId = Number((await queryOne(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, 'repair-owned-device-tech@example.invalid', 'test', 'technician')
       ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email RETURNING id`, [TECH_USER]
    ))?.id);
    await query(
      `INSERT INTO products (id, category, name, price) VALUES ($1, 'Laptops', 'Lenovo ThinkPad E14 (test fixture)', 50000)
       ON CONFLICT (id) DO NOTHING`, [PRODUCT_ID]
    );
    orderId = Number((await queryOne(
      `INSERT INTO orders (customer_id, status, paid_at) VALUES ($1, 'paid', NOW()::text) RETURNING id`, [customerId]
    ))?.id);
    orderItemId = Number((await queryOne(
      `INSERT INTO order_items (order_id, product_id, name, price, quantity, serial_number)
       VALUES ($1, $2, 'Lenovo ThinkPad E14 (test fixture)', 50000, 1, $3) RETURNING id`,
      [orderId, PRODUCT_ID, serialNumber]
    ))?.id);
    await query(
      `INSERT INTO serial_numbers (serial_number, product_id, status, order_id, order_item_id)
       VALUES ($1, $2, 'sold', $3, $4) ON CONFLICT (serial_number) DO NOTHING`,
      [serialNumber, PRODUCT_ID, orderId, orderItemId]
    );
    assert.ok(customerId > 0 && otherCustomerId > 0 && techId > 0 && orderItemId > 0);
  });

  after(async () => {
    for (const id of createdTicketIds) {
      await query("DELETE FROM repair_updates WHERE ticket_id = $1", [id]);
      await query("DELETE FROM repair_tickets WHERE id = $1", [id]);
    }
    if (orderItemId > 0) await query("DELETE FROM serial_numbers WHERE order_item_id = $1", [orderItemId]);
    if (orderId > 0) {
      await query("DELETE FROM order_items WHERE order_id = $1", [orderId]);
      await query("DELETE FROM orders WHERE id = $1", [orderId]);
    }
    await query("DELETE FROM products WHERE id = $1", [PRODUCT_ID]);
    if (techId > 0) await query("DELETE FROM users WHERE id = $1", [techId]);
    if (customerId > 0) await query("DELETE FROM customers WHERE id = $1", [customerId]);
    if (otherCustomerId > 0) await query("DELETE FROM customers WHERE id = $1", [otherCustomerId]);
    await closePool();
  });

  it("lists only completed purchases belonging to the signed-in customer", async () => {
    const devices = await listCustomerRepairDevices(customerId);
    assert.equal(devices.length, 1);
    assert.equal(devices[0].orderItemId, orderItemId);
    assert.deepEqual(devices[0].serialNumbers, [serialNumber]);
    assert.equal((await listCustomerRepairDevices(otherCustomerId)).length, 0);
  });

  it("rejects linking another customer's purchase and rejects an unowned serial", async () => {
    const base = { deviceType: "Laptop", issueSummary: "Test", issueDescription: "Fixture only", serialNumber };
    const wrongOwner = await createRepairTicket(otherCustomerId, { ...base, orderItemId });
    assert.equal(wrongOwner.ok, false);
    assert.match(wrongOwner.error || "", /not part of one of your completed purchases/);
    const wrongSerial = await createRepairTicket(customerId, { ...base, orderItemId, serialNumber: "NOT-THIS-DEVICE" });
    assert.equal(wrongSerial.ok, false);
    assert.match(wrongSerial.error || "", /serial number linked to that purchased item/);
  });

  it("creates planned software/upgrade work without starting a diagnosis SLA", async () => {
    const result = await createRepairTicket(customerId, {
      deviceType: "Laptop", deviceModel: "Lenovo ThinkPad E14", serialNumber,
      issueSummary: "Install requested software", issueDescription: "Install the requested software package.",
      serviceKind: "planned_service", orderItemId,
    });
    assert.equal(result.ok, true);
    const ticket = result.ticket!;
    createdTicketIds.push(ticket.id);
    assert.equal(ticket.serviceKind, "planned_service");
    assert.equal(ticket.orderItemId, orderItemId);
    assert.equal(ticket.diagnosisDueAt, null);

    const assigned = await updateRepairTicket(ticket.id, { assignedTo: techId });
    assert.ok(assigned && !("error" in assigned));
    assert.equal((assigned as any).diagnosisDueAt, null);
  });

  it("keeps diagnosis/repair requests on the configured diagnosis SLA", async () => {
    const result = await createRepairTicket(customerId, {
      deviceType: "Laptop", issueSummary: "Test fault", issueDescription: "A separate test fixture request.",
      serviceKind: "diagnosis_repair", orderItemId,
    });
    assert.equal(result.ok, true);
    const ticket = result.ticket!;
    createdTicketIds.push(ticket.id);
    const assigned = await updateRepairTicket(ticket.id, { assignedTo: techId });
    assert.ok(assigned && !("error" in assigned));
    assert.ok((assigned as any).diagnosisDueAt, "diagnosis repair assignment starts its diagnosis target");
  });
});

describe("customer intake route and UI wiring", () => {
  it("protects the owned-device endpoint with customer authentication", () => {
    const routes = fs.readFileSync(path.join(__dirname, "..", "server", "index.ts"), "utf8");
    const routeStart = routes.indexOf('app.get("/api/repairs/my-devices"');
    const route = routeStart >= 0 ? routes.slice(routeStart, routeStart + 700) : "";
    assert.ok(route);
    assert.match(route, /customerAuthMiddleware/);
    assert.match(route, /listCustomerRepairDevices/);
  });

  it("sends only owned order-item IDs and distinguishes planned service from diagnosis", () => {
    const page = fs.readFileSync(path.join(__dirname, "..", "frontend", "pages", "repair-book.tsx"), "utf8");
    assert.match(page, /\/api\/repairs\/my-devices/);
    assert.match(page, /name="orderItemId"/);
    assert.match(page, /name="serviceKind"/);
    assert.match(page, /planned_service/);
    assert.match(page, /fd\.get\("orderItemId"\)/);
  });
});
