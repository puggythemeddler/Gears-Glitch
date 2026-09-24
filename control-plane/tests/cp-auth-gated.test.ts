import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import bcrypt from "bcrypt";
import type { Server } from "node:http";

// DB-gated control-plane auth regression suite.
// Boots the REAL express app against a scratch CONTROL_PLANE_DATABASE_URL and
// exercises the auth hardening end-to-end: live role re-read, session death on
// account deletion, 2FA setup re-authentication, the plan-sync client-key gate,
// and persisted (awaited) audit rows. Skips locally (no CONTROL_PLANE_DATABASE_URL).

const HAS_DB = !!process.env.CONTROL_PLANE_DATABASE_URL;
const suite = HAS_DB ? describe : describe.skip;

const ADMIN_PASSWORD = "TestAdminPass123!";
const CLIENT_SECRET = "cp_test_client_secret";

let baseUrl = "";
let cpServer: Server | null = null;
let fakeBackend: Server | null = null;
let fakeBackendUrl = "";
let db: typeof import("../server/db") | null = null;

function fakeClientBackend(): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const json = (code: number, obj: unknown) => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      const url = req.url || "";
      if (url.startsWith("/api/shop/subscription/requests/")) return json(200, { plan: "growth" });
      if (url === "/api/admin/invoices/generate") return json(200, { id: 55, invoiceNumber: "INV-99", amount: 100 });
      if (url.startsWith("/api/admin/invoices/") && url.endsWith("/pay")) return json(200, { ok: true });
      if (url === "/api/admin/invoices") {
        return json(200, { invoices: [{ id: 55, invoiceNumber: "INV-99", amount: 100, dueDate: null, planName: "growth", currency: "KES" }], stats: null });
      }
      return json(404, { error: "fake backend: not found" });
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

suite("CP auth hardening (control-plane DB)", { timeout: 120000 }, () => {
  before(async () => {
    // Must be set BEFORE the app module is imported: index.ts captures env at
    // module load and server/db.ts builds its pool from CONTROL_PLANE_DATABASE_URL.
    process.env.PORT = "0";
    process.env.JWT_SECRET = "cp-test-secret";
    process.env.CP_ADMIN_PASSWORD = ADMIN_PASSWORD;
    process.env.NODE_ENV = "test";

    const appMod = await import("../server/index");
    const dbMod = await import("../server/db");
    db = dbMod;

    const backend = await fakeClientBackend();
    fakeBackend = backend.server;
    fakeBackendUrl = backend.url;

    const single = await appMod.start({ background: false });
    cpServer = single;
    const { port } = single.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    // Deterministic admin row with OUR password (a prior CI run may have seeded one).
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 4);
    await dbMod.query("DELETE FROM cp_users WHERE username = 'admin'");
    await dbMod.query(
      "INSERT INTO cp_users (username, password_hash, role, api_key) VALUES ('admin', $1, 'admin', 'cp_test_admin_key')",
      [hash]
    );
    // Fake tenant client so the proxy routes resolve.
    await dbMod.query(
      "INSERT INTO clients (name, domain, admin_email, render_service_url, cp_secret, status, plan) VALUES ('Fake Co', 'fake.example.com', 'owner@fake.example.com', $1, $2, 'active', 'starter') ON CONFLICT (domain) DO UPDATE SET render_service_url = $1, cp_secret = $2",
      [fakeBackendUrl, CLIENT_SECRET]
    );
  });

  after(async () => {
    if (cpServer) await new Promise<void>((res) => cpServer!.close(() => res()));
    if (fakeBackend) await new Promise<void>((res) => fakeBackend!.close(() => res()));
  });

  let token = "";
  let clientId = 0;

  it("health endpoint responds", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    assert.equal((await res.json() as any).status, "ok");
  });

  it("logs in as admin and fetches /api/auth/me", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: ADMIN_PASSWORD }),
    });
    assert.equal(res.status, 200);
    const body: any = await res.json();
    token = body.token;
    assert.ok(token, "expected a JWT");

    const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(me.status, 200);
    const meBody: any = await me.json();
    assert.equal(meBody.user.role, "admin");
  });

  it("re-reads the role from the DB so a demotion kills admin rights immediately", async () => {
    await db!.query("UPDATE cp_users SET role = 'viewer' WHERE username = 'admin'");
    const res = await fetch(`${baseUrl}/api/clients`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(res.status, 403, "demoted session must lose admin access on the next request");
    await db!.query("UPDATE cp_users SET role = 'admin' WHERE username = 'admin'");
    const restored = await fetch(`${baseUrl}/api/clients`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(restored.status, 200, "restored role regains access without re-login");
  });

  it("ends a session as soon as the account is deleted", async () => {
    await db!.query("DELETE FROM cp_users WHERE username = 'admin'");
    const res = await fetch(`${baseUrl}/api/clients`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(res.status, 401, "deleted account must be rejected");
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 4);
    await db!.query(
      "INSERT INTO cp_users (username, password_hash, role, api_key) VALUES ('admin', $1, 'admin', 'cp_test_admin_key')",
      [hash]
    );
    const back = await fetch(`${baseUrl}/api/clients`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(back.status, 200);
  });

  it("2FA setup requires the current password", async () => {
    const beforeRow: any = await db!.queryOne("SELECT totp_secret FROM cp_users WHERE username = 'admin'");
    const before = beforeRow?.totp_secret || "";

    const noPass = await fetch(`${baseUrl}/api/auth/2fa/setup`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(noPass.status, 400);

    const badPass = await fetch(`${baseUrl}/api/auth/2fa/setup`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password: "WrongPassword1!" }),
    });
    assert.equal(badPass.status, 401, "wrong password must be rejected");

    const afterNoop: any = await db!.queryOne("SELECT totp_secret FROM cp_users WHERE username = 'admin'");
    assert.equal(afterNoop?.totp_secret || "", before, "failed attempts must not rotate the secret");

    const ok = await fetch(`${baseUrl}/api/auth/2fa/setup`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password: ADMIN_PASSWORD }),
    });
    assert.equal(ok.status, 200);
    const okBody: any = await ok.json();
    assert.ok(okBody.secret, "expected a fresh TOTP secret");
    const after: any = await db!.queryOne("SELECT totp_secret FROM cp_users WHERE username = 'admin'");
    assert.notEqual(after?.totp_secret || "", before, "valid setup must rotate the pending secret");
  });

  it("plan sync-up rejects a signed-in admin JWT (client key required)", async () => {
    const res = await fetch(`${baseUrl}/api/plans/sync-up`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ plan: { id: "boom", name: "Boom Plan" } }),
    });
    assert.equal(res.status, 403);
  });

  it("plan sync-up still works for an authenticated client via its key", async () => {
    const res = await fetch(`${baseUrl}/api/plans/sync-up`, {
      method: "POST",
      headers: { "x-control-plane-key": CLIENT_SECRET, "Content-Type": "application/json" },
      body: JSON.stringify({ plan: { id: "ok-plan", name: "OK Plan", syncToOthers: false } }),
    });
    assert.equal(res.status, 200);
  });

  it("proxy routes write awaited audit rows (upgrade-request, invoice pay, invoice generate)", async () => {
    const clients: any[] = await db!.queryAll("SELECT id, admin_email FROM clients WHERE domain = 'fake.example.com'");
    clientId = clients[0].id;

    const approve = await fetch(`${baseUrl}/api/clients/${clientId}/upgrade-requests/7`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    assert.equal(approve.status, 200);

    const pay = await fetch(`${baseUrl}/api/clients/${clientId}/invoices/55/pay`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(pay.status, 200);

    const gen = await fetch(`${baseUrl}/api/clients/${clientId}/invoices/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(gen.status, 200);

    const audits: any[] = await db!.queryAll(
      "SELECT action FROM audit_log WHERE client_id = $1 AND action IN ('approve_upgrade_request','reject_upgrade_request','mark_invoice_paid','generate_invoice')",
      [clientId]
    );
    const actions = audits.map((a) => a.action).sort();
    assert.deepEqual(actions, ["approve_upgrade_request", "generate_invoice", "mark_invoice_paid"]);
  });

  it("record-payment persists its audits (awaited) before responding", async () => {
    const rec = await fetch(`${baseUrl}/api/clients/${clientId}/invoices/record-payment`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 100 }),
    });
    assert.equal(rec.status, 200);

    const audits: any[] = await db!.queryAll(
      "SELECT action FROM audit_log WHERE action = 'record_payment' AND client_id = $1 ORDER BY id DESC LIMIT 1",
      [clientId]
    );
    assert.equal(audits.length, 1, "the awaited record_payment audit must already be visible after the response");
  });

  it("email-invoice short-circuits cleanly when SMTP is not configured", async () => {
    const res = await fetch(`${baseUrl}/api/clients/${clientId}/invoices/55/email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    assert.match((await res.json() as any).error, /SMTP/i);
  });
});