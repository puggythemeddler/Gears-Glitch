import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

import { query, queryOne } from "../server/db-helpers";
import {
  deriveWarranty,
  buildOrderDevices,
  getWarrantyReminderDays,
  setWarrantyReminderDays,
  isoDay,
} from "../server/customer-notifications";
import { getCustomerCommPrefs, updateCustomerCommPrefs } from "../server/notification-service";

const HAS_DB = !!process.env.DATABASE_URL;

// ─── Pure logic (runs everywhere) ─────────────────────────────────────────────
describe("customer notification derivation (pure)", () => {
  it("deriveWarranty derives expiry from sale date with month-end clamping", () => {
    // Jan 31 + 1 month -> Feb 28 (non-leap 2023).
    const d = deriveWarranty({ order_created_at: "2023-01-31T00:00:00Z", warranty_duration: 1 });
    assert.ok(d.expiry);
    assert.equal(isoDay(d.expiry!), "2023-02-28");
  });

  it("deriveWarranty prefers a snapshotted order-item expiry over duration", () => {
    const d = deriveWarranty({
      order_created_at: "2020-01-01T00:00:00Z",
      order_item_expires: "2099-12-31",
      warranty_duration: 12,
    });
    assert.ok(d.expiry);
    assert.equal(isoDay(d.expiry!), "2099-12-31");
    assert.equal(d.status, "active");
  });

  it("deriveWarranty returns 'none' when there is no expiry and no duration", () => {
    const d = deriveWarranty({ order_created_at: "2024-01-01T00:00:00Z", warranty_duration: 0 });
    assert.equal(d.expiry, null);
    assert.equal(d.status, "none");
  });

  it("buildOrderDevices omits warranty fields for items without a warranty", () => {
    const devices = buildOrderDevices({
      createdAt: "2024-01-01T00:00:00Z",
      items: [
        { name: "Laptop", serialNumber: "SN-1", hasWarranty: 0, cancelled: 0 },
        { name: "Mouse", hasWarranty: 1, warrantyExpires: "2099-01-01", cancelled: 0 },
      ],
    });
    assert.equal(devices.length, 2);
    assert.equal(devices[0].name, "Laptop");
    assert.equal(devices[0].serialNumber, "SN-1");
    assert.equal(devices[0].warrantyStatus, undefined);
    assert.equal(devices[1].warrantyStatus, "active");
    assert.equal(devices[1].warrantyExpiry, "2099-01-01");
  });

  it("buildOrderDevices ignores cancelled items", () => {
    const devices = buildOrderDevices({
      createdAt: "2024-01-01T00:00:00Z",
      items: [{ name: "Laptop", hasWarranty: 0, cancelled: 1 }],
    });
    assert.equal(devices.length, 0);
  });

  it("deriveWarranty prefers the order-item snapshot over a conflicting serial expiry", () => {
    const d = deriveWarranty({
      order_created_at: "2020-01-01T00:00:00Z",
      order_item_expires: "2099-12-31",
      warranty_expires: "2020-06-01",
      warranty_duration: 12,
    });
    assert.equal(isoDay(d.expiry!), "2099-12-31");
    assert.equal(d.status, "active");
  });

  it("deriveWarranty falls back to the serial record when the order-item snapshot is absent", () => {
    const d = deriveWarranty({
      order_created_at: "2020-01-01T00:00:00Z",
      order_item_expires: null,
      warranty_expires: "2021-03-15",
      warranty_duration: 12,
    });
    assert.equal(isoDay(d.expiry!), "2021-03-15");
  });

  it("deriveWarranty derives from the serial sale date when no expiry is recorded anywhere", () => {
    const d = deriveWarranty({
      sold_at: "2023-01-15T10:00:00Z",
      order_created_at: "2020-01-01T00:00:00Z",
      warranty_duration: 1,
    });
    assert.equal(isoDay(d.expiry!), "2023-02-15");
  });

  it("deriveWarranty reports expired coverage", () => {
    const d = deriveWarranty({ order_created_at: "2019-01-01T00:00:00Z", order_item_expires: "2020-01-01" });
    assert.equal(d.status, "expired");
    assert.ok((d.daysLeft ?? 0) < 0);
  });

  it("deriveWarranty returns 'none' when only a serial exists without expiry or duration", () => {
    const d = deriveWarranty({ sold_at: "2024-01-01T00:00:00Z", warranty_duration: 0 });
    assert.equal(d.expiry, null);
    assert.equal(d.status, "none");
  });

  it("buildOrderDevices falls back to the registered serial warranty record", () => {
    const devices = buildOrderDevices({
      createdAt: "2020-01-01T00:00:00Z",
      items: [{ name: "Laptop", serialNumber: "SN-9", hasWarranty: 1, warrantyExpires: null, serialWarrantyExpires: "2099-12-31", serialSoldAt: "2020-01-15T00:00:00Z", warrantyDuration: 12, cancelled: 0 }],
    });
    assert.equal(devices[0].warrantyExpiry, "2099-12-31");
    assert.equal(devices[0].warrantyStatus, "active");
  });

  it("buildOrderDevices keeps the order-item snapshot authoritative over a stale serial expiry", () => {
    const devices = buildOrderDevices({
      createdAt: "2020-01-01T00:00:00Z",
      items: [{ name: "Laptop", hasWarranty: 1, warrantyExpires: "2099-06-30", serialWarrantyExpires: "2020-01-01", warrantyDuration: 12, cancelled: 0 }],
    });
    assert.equal(devices[0].warrantyExpiry, "2099-06-30");
  });

  it("buildOrderDevices derives expiry from the serial sale date", () => {
    const devices = buildOrderDevices({
      createdAt: "2020-01-01T00:00:00Z",
      items: [{ name: "Laptop", hasWarranty: 1, warrantyExpires: null, serialSoldAt: "2023-01-15T00:00:00Z", warrantyDuration: 1, cancelled: 0 }],
    });
    assert.equal(devices[0].warrantyExpiry, "2023-02-15");
  });

  it("buildOrderDevices aggregates multiple serialized devices", () => {
    const devices = buildOrderDevices({
      createdAt: "2020-01-01T00:00:00Z",
      items: [
        { id: 1, name: "Laptop", hasWarranty: 1, warrantyExpires: "2099-01-01", serialNumber: "SN-A", cancelled: 0 },
        { id: 2, name: "Phone", hasWarranty: 1, warrantyExpires: "2099-02-02", serialNumber: "SN-B", cancelled: 0 },
        { id: 3, name: "Cable", hasWarranty: 0, cancelled: 0 },
      ],
    });
    assert.equal(devices.length, 3);
    assert.equal(devices[0].serialNumber, "SN-A");
    assert.equal(devices[1].warrantyExpiry, "2099-02-02");
    assert.equal(devices[2].warrantyStatus, undefined);
  });
});

// ─── DB-backed (opt-in) ───────────────────────────────────────────────────────
describe("customer notification service (P1)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  // The runner executes each test file in its own process, so the isolation
  // suite may be running schema.sql concurrently and racing on the catalog.
  const RETRYABLE = ["23505", "42P07", "42701", "40001", "40P01"];
  const createIfNeeded = async (sql: string) => {
    for (let attempt = 0; attempt < 12; attempt++) {
      try { await query(sql); return; }
      catch (err: any) {
        if (RETRYABLE.includes(err?.code)) { await new Promise((r) => setTimeout(r, 300)); continue; }
        throw err;
      }
    }
  };

  before(async () => {
    await createIfNeeded(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    // Mirrors server/schema.sql's customers definition (+ the comm_prefs column
    // that runMigrations adds), so it interoperates with the isolation suite.
    await createIfNeeded(
      `CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        last_login TEXT,
        password_changed_at TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (NOW()::text),
        comm_prefs TEXT DEFAULT '{}'
      )`
    );
    await createIfNeeded(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS comm_prefs TEXT DEFAULT '{}'`);
  });

  it("warranty reminder window defaults to 30 and is configurable", async () => {
    await query("DELETE FROM settings WHERE key = 'warranty_reminder_days'");
    assert.equal(await getWarrantyReminderDays(), 30);

    await setWarrantyReminderDays(14);
    assert.equal(await getWarrantyReminderDays(), 14);

    // Out-of-range values fall back to the default rather than persisting garbage.
    await setWarrantyReminderDays(0);
    assert.equal(await getWarrantyReminderDays(), 30);
  });

  it("customer communication preferences default to opt-in and persist opt-outs", async () => {
    const email = `prefs-${Date.now()}@example.com`;
    const inserted = await query(
      `INSERT INTO customers (name, email, password_hash) VALUES ('Prefs Test', $1, 'x') RETURNING id`,
      [email]
    );
    const id = Number(inserted.rows[0].id);
    try {
      assert.deepEqual(await getCustomerCommPrefs(id), { email: true, whatsapp: true });

      const updated = await updateCustomerCommPrefs(id, { whatsapp: false });
      assert.equal(updated.whatsapp, false);
      assert.equal(updated.email, true);
      assert.deepEqual(await getCustomerCommPrefs(id), { email: true, whatsapp: false });

      // Persisted (not just in-memory).
      const row = await queryOne("SELECT comm_prefs FROM customers WHERE id = $1", [id]) as any;
      assert.equal(JSON.parse(row.comm_prefs).whatsapp, false);
    } finally {
      await query("DELETE FROM customers WHERE id = $1", [id]);
    }
  });
});
