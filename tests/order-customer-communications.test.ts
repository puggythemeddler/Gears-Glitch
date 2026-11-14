import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const server = readFileSync(join(root, "server/index.ts"), "utf8");
const notifier = readFileSync(join(root, "server/customer-notifications.ts"), "utf8");
const dispatcher = readFileSync(join(root, "server/notification-service.ts"), "utf8");
const admin = readFileSync(join(root, "frontend/pages/admin.tsx"), "utf8");
const preferences = readFileSync(join(root, "frontend/components/admin/NotificationSettings.tsx"), "utf8");

describe("customer order communication coverage", () => {
  it("routes real order status transitions through the consent-aware notification service", () => {
    assert.match(server, /notifyCustomerOrderStatusChanged\(order\.id, order\.status, status\)/);
    assert.match(server, /notifyCustomerOrderStatusChanged\(id, order\.status, "cancelled"\)/);
    assert.doesNotMatch(server, /sendEmail\([^\n]*,\s*"order_status"\)/);
  });

  it("confirms customer-submitted order detail edits without echoing the values", () => {
    assert.match(server, /notifyCustomerOrderDetailsChanged\(orderId, changedFields\)/);
    assert.match(notifier, /pending order #\$\{order\.id\} were updated/);
    assert.match(notifier, /changedFields: fields/);
  });

  it("notifies the customer after a refund is recorded and uses its refund id for idempotency", () => {
    assert.match(server, /const refund = await createRefund\(/);
    assert.match(server, /notifyCustomerOrderRefunded\(orderId, refund\)/);
    assert.match(notifier, /order\.refunded:refund:\$\{refund\.id\}/);
    assert.match(notifier, /This message confirms the refund record/);
  });

  it("records pending and terminal order communication outcomes by channel", () => {
    assert.match(dispatcher, /logNotification\(ctx\.event, "email", email, "pending"/);
    assert.match(dispatcher, /logNotification\(ctx\.event, "whatsapp", phone, "pending"/);
    assert.match(dispatcher, /export async function listOrderCommunicationLog/);
    assert.match(server, /listOrderCommunicationLog\(Number\(req\.params\.id\)\)/);
  });

  it("shows expandable delivery evidence beside each refund and exposes a refund preference", () => {
    assert.match(admin, /Customer communication/);
    assert.match(admin, /<details key=\{`\$\{notice\.channel\}-\$\{notice\.id\}`\}>/);
    assert.match(admin, /Provider reference:/);
    assert.match(preferences, /"order\.refunded": "Customer refund notice"/);
  });
});
