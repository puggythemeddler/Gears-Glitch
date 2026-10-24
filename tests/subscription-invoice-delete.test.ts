import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controlPlaneHtml = readFileSync("control-plane/public/index.html", "utf8");
const controlPlaneServer = readFileSync("control-plane/server/index.ts", "utf8");
const storefrontServer = readFileSync("server/index.ts", "utf8");
const database = readFileSync("server/db.ts", "utf8");

test("invoice deletion is limited to unpaid proformas and guarded across both services", () => {
  assert.match(controlPlaneHtml, /\['pending','overdue'\]\.includes\(String\(inv\.status\)\.toLowerCase\(\)\)[\s\S]*?deleteClientInvoice\(/);
  assert.match(controlPlaneHtml, /function deleteClientInvoice\(clientId, invId\)[\s\S]*?confirmDialog\([\s\S]*?danger: true[\s\S]*?method: "DELETE"/);

  assert.match(controlPlaneServer, /app\.delete\("\/api\/clients\/:id\/invoices\/:invId", destructiveLimiter, requireAuth, requireAdmin/);
  assert.match(controlPlaneServer, /SELECT id FROM client_payments WHERE client_id = \$1 AND invoice_id = \$2/);
  assert.match(controlPlaneServer, /SELECT id FROM mpesa_payment_attempts WHERE client_id = \$1 AND invoice_id = \$2/);
  assert.match(controlPlaneServer, /\/api\/admin\/invoices\/\$\{invoiceId\}[\s\S]*?method: "DELETE"/);

  assert.match(storefrontServer, /app\.delete\("\/api\/admin\/invoices\/:id", allowControlPlane\(ownerAuthMiddleware\), cpOrPermission\("invoice:view"\)/);
  assert.match(storefrontServer, /Only unpaid proforma invoices can be deleted\. Paid invoices are retained for accounting\./);
  assert.match(database, /DELETE FROM invoices WHERE id = \$1 AND status IN \('pending', 'overdue'\)/);
});
