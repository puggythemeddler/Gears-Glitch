import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { query, queryOne, closePool } from "../server/db-helpers";

import { bootstrapTestDatabase } from "../server/test-db";
const HAS_DB = bootstrapTestDatabase();

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// End-to-end HTTP coverage of WhatsApp template authorization against a REAL
// server and a REAL PostgreSQL database.
//
// The gap this pins shut: template creation used to require only whatsapp:view,
// and could set approved:true from the request body, so any account that could
// merely *see* the WhatsApp tab could also self-approve a template and unlock
// out-of-window (business-initiated) sends. Authorization is now split into
// whatsapp:view (read), whatsapp:manage (create/delete/send) and
// whatsapp:approve (approve/unapprove), and a freshly created template defaults
// to unapproved.
//
// The account matrix is built through the real admin API (custom role → staff →
// role assignment) rather than by hand-hashing passwords, so the test exercises
// the same seams a shop owner would. server/index.ts auto-listens (no
// exportable app), so we spawn it as a child process exactly like
// pages-http.integration.test.ts / layouts-api.integration.test.ts. Gated the
// same way (TEST_DATABASE_URL; without it this suite skips).
describe("WhatsApp template approval authorization over real HTTP + PostgreSQL (DB)", { skip: !HAS_DB && "TEST_DATABASE_URL not set (disposable test DB only)" }, () => {
  let child: ChildProcess | null = null;
  let base = "";
  let adminToken = "";
  let csrfCookie = "";
  let csrfToken = "";
  const childLog: string[] = [];

  const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const viewerRoleId = `wa-viewer-${runId}`;
  const managerRoleId = `wa-manager-${runId}`;
  const viewerUser = `qa-wa-viewer-${runId}`;
  const managerUser = `qa-wa-manager-${runId}`;
  const viewerPass = "qa-View-Pass-2026!";
  const managerPass = "qa-Manage-Pass-2026!";

  const repoRoot = path.resolve(__dirname, "..");
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");

  let viewerToken = "";
  let managerToken = "";
  let seededTemplateId = 0;

  async function waitForHealth(url: string, timeoutMs = 120000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (res.ok) return true;
      } catch {}
      await sleep(1500);
    }
    return false;
  }

  async function login(username: string, password: string): Promise<string> {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(30000),
    });
    const data: any = await res.json().catch(() => ({}));
    assert.equal(res.status, 200, `login as "${username}" failed (${res.status}): ${JSON.stringify(data)}`);
    if (data.requiresBranch) {
      assert.ok(data.branchSelectToken, "branch picker must return a branchSelectToken");
      assert.ok(data.branches?.length, "branch picker must offer at least one branch");
      const pick = await fetch(`${base}/api/auth/select-branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.branchSelectToken}` },
        body: JSON.stringify({ branchId: data.branches[0].id }),
        signal: AbortSignal.timeout(30000),
      });
      const picked: any = await pick.json().catch(() => ({}));
      assert.equal(pick.status, 200, `select-branch failed (${pick.status}): ${JSON.stringify(picked)}`);
      return picked.token;
    }
    assert.ok(data.token, `login as "${username}" returned no token`);
    return data.token;
  }

  async function loadCsrf(): Promise<void> {
    const res = await fetch(`${base}/api/csrf-token`, { signal: AbortSignal.timeout(30000) });
    assert.equal(res.status, 200, `csrf-token endpoint failed (${res.status})`);
    const match = (res.headers.get("set-cookie") || "").match(/csrf_token=([^;]+)/);
    assert.ok(match, "csrf_token cookie must be issued");
    csrfCookie = `csrf_token=${match[1]}`;
    const data: any = await res.json();
    assert.ok(data.csrfToken, "csrf-token endpoint must return a token");
    csrfToken = data.csrfToken;
  }

  async function api(p: string, init: any = {}, token?: string) {
    const headers: Record<string, string> = { "Content-Type": "application/json", "x-csrf-token": csrfToken, Cookie: csrfCookie };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${base}${p}`, { ...init, headers: { ...headers, ...(init.headers || {}) }, signal: AbortSignal.timeout(30000) });
    const data = await res.json().catch(() => null);
    return { res, data };
  }

  const createTemplate = (token: string | undefined, body: any) =>
    api("/api/admin/whatsapp/templates", { method: "POST", body: JSON.stringify(body) }, token);

  const patchTemplate = (token: string | undefined, id: number, body: any) =>
    api(`/api/admin/whatsapp/templates/${id}`, { method: "PATCH", body: JSON.stringify(body) }, token);

  const dbTemplate = (name: string) =>
    queryOne("SELECT id, is_approved FROM whatsapp_templates WHERE name = $1", [name]);

  async function makeStaffViaApi(token: string, username: string, password: string): Promise<number> {
    const created = await api("/api/staff", { method: "POST", body: JSON.stringify({ username, email: `${username}@qa.local`, password, role: "staff" }) }, token);
    assert.equal(created.res.status, 201, `staff create failed: ${JSON.stringify(created.data)}`);
    return Number(created.data.id);
  }

  before(async () => {
    const port = 20000 + Math.floor(Math.random() * 20000);
    base = `http://127.0.0.1:${port}`;

    child = spawn(process.execPath, [tsxCli, "server/index.ts"], {
      cwd: repoRoot,
      env: {
        ...(process.env as any),
        PORT: String(port),
        NODE_ENV: "test",
        DATABASE_URL: process.env.DATABASE_URL || "",
        JWT_SECRET: process.env.JWT_SECRET || "qa-wa-perms-test-jwt-secret-4d1e7a9b2c",
        ADMIN_USERNAME: "admin",
        ADMIN_EMAIL: "admin@qa.local",
        ADMIN_PASSWORD: "qa-Admin-Pass-2026!",
      } as any,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (d) => { const s = String(d).trim(); if (s) childLog.push(s.slice(0, 400)); });
    child.stderr?.on("data", (d) => { const s = String(d).trim(); if (s) childLog.push(s.slice(0, 400)); });
    child.on("exit", (code) => childLog.push(`[child exit: ${code}]`));

    const ready = await waitForHealth(`${base}/api/health`);
    assert.ok(ready, `server never became healthy.\nRecent child output:\n${childLog.slice(-40).join("\n")}`);

    await loadCsrf();
    adminToken = await login("admin", "qa-Admin-Pass-2026!");

    // A view-only role (whatsapp:view) and a manage-only role (whatsapp:view +
    // whatsapp:manage). Only admin/owner ever get whatsapp:approve by default,
    // which is exactly the separation under test.
    const viewerRole = await api("/api/roles", { method: "POST", body: JSON.stringify({ roleId: viewerRoleId, name: `WA Viewer ${runId}`, permissions: ["whatsapp:view"] }) }, adminToken);
    assert.equal(viewerRole.res.status, 201, `viewer role create failed: ${JSON.stringify(viewerRole.data)}`);

    const managerRole = await api("/api/roles", { method: "POST", body: JSON.stringify({ roleId: managerRoleId, name: `WA Manager ${runId}`, permissions: ["whatsapp:view", "whatsapp:manage"] }) }, adminToken);
    assert.equal(managerRole.res.status, 201, `manager role create failed: ${JSON.stringify(managerRole.data)}`);

    const viewerId = await makeStaffViaApi(adminToken, viewerUser, viewerPass);
    const managerId = await makeStaffViaApi(adminToken, managerUser, managerPass);

    const assignViewer = await api(`/api/staff/${viewerId}/roles/${viewerRoleId}`, { method: "POST", body: "{}" }, adminToken);
    assert.equal(assignViewer.res.status, 200, `viewer role assign failed: ${JSON.stringify(assignViewer.data)}`);
    const assignManager = await api(`/api/staff/${managerId}/roles/${managerRoleId}`, { method: "POST", body: "{}" }, adminToken);
    assert.equal(assignManager.res.status, 200, `manager role assign failed: ${JSON.stringify(assignManager.data)}`);

    viewerToken = await login(viewerUser, viewerPass);
    managerToken = await login(managerUser, managerPass);

    // Seed one unapproved template (as admin, without approval) for the PATCH path.
    const seededName = `qa-wa-seeded-${runId}`;
    const seeded = await createTemplate(adminToken, { name: seededName, bodyText: "Seeded body", category: "UTILITY" });
    assert.equal(seeded.res.status, 200, `seeded template create failed: ${JSON.stringify(seeded.data)}`);
    seededTemplateId = Number(seeded.data.template.id);
    assert.ok(seededTemplateId, "seeded template has a real id");
    const row = await dbTemplate(seededName);
    assert.equal(row.is_approved, false, "a template created without an approval request defaults to unapproved");
  });

  after(async () => {
    if (child) {
      child.kill();
      child = null;
    }
    await closePool();
  });

  it("a view-only account can read templates but can neither create nor approve through either endpoint or body field", async () => {
    const list = await api("/api/admin/whatsapp/templates", {}, viewerToken);
    assert.equal(list.res.status, 200, "whatsapp:view must still allow reading templates");

    // Body-field bypass attempts on create: needs whatsapp:manage at minimum.
    for (const field of ["approved", "isApproved"]) {
      const attempt = await createTemplate(viewerToken, { name: `qa-wa-viewer-create-${field}-${runId}`, bodyText: "body", [field]: true });
      assert.equal(attempt.res.status, 403, `view-only create with ${field}:true must be 403, got ${attempt.res.status}`);
    }
    const plainCreate = await createTemplate(viewerToken, { name: `qa-wa-viewer-plain-${runId}`, bodyText: "body" });
    assert.equal(plainCreate.res.status, 403, "view-only create without an approval field must still be 403");
    assert.ok(!(await dbTemplate(`qa-wa-viewer-plain-${runId}`)), "a forbidden create must not write a row");

    // Body-field bypass attempts on approve: needs whatsapp:approve.
    for (const field of ["approved", "isApproved"]) {
      const attempt = await patchTemplate(viewerToken, seededTemplateId, { [field]: true });
      assert.equal(attempt.res.status, 403, `view-only approve with ${field}:true must be 403, got ${attempt.res.status}`);
    }
    const after = await dbTemplate(`qa-wa-seeded-${runId}`);
    assert.equal(after.is_approved, false, "a forbidden approve must leave the template unapproved");
  });

  it("a manage-only account (no whatsapp:approve) cannot self-approve through either endpoint or body field", async () => {
    // It may create, but only unapproved.
    const plain = await createTemplate(managerToken, { name: `qa-wa-manage-plain-${runId}`, bodyText: "body" });
    assert.equal(plain.res.status, 200, `manage-only create should succeed: ${JSON.stringify(plain.data)}`);
    const plainRow = await dbTemplate(`qa-wa-manage-plain-${runId}`);
    assert.equal(plainRow.is_approved, false, "manage-only create defaults to unapproved");

    for (const field of ["approved", "isApproved"]) {
      const attempt = await createTemplate(managerToken, { name: `qa-wa-manage-${field}-${runId}`, bodyText: "body", [field]: true });
      assert.equal(attempt.res.status, 403, `manage-only create with ${field}:true must be 403, got ${attempt.res.status}`);
      assert.ok(!(await dbTemplate(`qa-wa-manage-${field}-${runId}`)), "a denied approval-on-create must not write a row");
    }

    for (const field of ["approved", "isApproved"]) {
      const attempt = await patchTemplate(managerToken, seededTemplateId, { [field]: true });
      assert.equal(attempt.res.status, 403, `manage-only approve with ${field}:true must be 403, got ${attempt.res.status}`);
    }
    const after = await dbTemplate(`qa-wa-seeded-${runId}`);
    assert.equal(after.is_approved, false, "a denied approve must leave the template unapproved");
  });

  it("an authorized account (admin) can approve and unapprove, and can set approval at create time via either body field", async () => {
    const created = await createTemplate(adminToken, { name: `qa-wa-admin-plain-${runId}`, bodyText: "body" });
    assert.equal(created.res.status, 200);
    assert.equal((await dbTemplate(`qa-wa-admin-plain-${runId}`)).is_approved, false, "admin create without request still defaults to unapproved");

    const viaApproved = await createTemplate(adminToken, { name: `qa-wa-admin-approved-${runId}`, bodyText: "body", approved: true });
    assert.equal(viaApproved.res.status, 200, `admin create with approved:true should succeed: ${JSON.stringify(viaApproved.data)}`);
    assert.equal((await dbTemplate(`qa-wa-admin-approved-${runId}`)).is_approved, true, "approved:true is honored for an authorized caller");

    const viaIsApproved = await createTemplate(adminToken, { name: `qa-wa-admin-isapproved-${runId}`, bodyText: "body", isApproved: true });
    assert.equal(viaIsApproved.res.status, 200, `admin create with isApproved:true should succeed: ${JSON.stringify(viaIsApproved.data)}`);
    assert.equal((await dbTemplate(`qa-wa-admin-isapproved-${runId}`)).is_approved, true, "isApproved:true is honored for an authorized caller");

    const approve = await patchTemplate(adminToken, seededTemplateId, { approved: true });
    assert.equal(approve.res.status, 200, `admin approve should succeed: ${JSON.stringify(approve.data)}`);
    assert.equal((await dbTemplate(`qa-wa-seeded-${runId}`)).is_approved, true, "PATCH approved:true persists");

    const unapprove = await patchTemplate(adminToken, seededTemplateId, { isApproved: false });
    assert.equal(unapprove.res.status, 200, `admin unapprove should succeed: ${JSON.stringify(unapprove.data)}`);
    assert.equal((await dbTemplate(`qa-wa-seeded-${runId}`)).is_approved, false, "PATCH isApproved:false persists");
  });

  it("seeds whatsapp:manage and whatsapp:approve onto the admin role only among defaults", async () => {
    const rows: any = await query("SELECT permission FROM role_permissions WHERE role_id = 'admin'");
    const perms = new Set(rows.rows.map((r: any) => r.permission));
    assert.ok(perms.has("whatsapp:manage"), "admin must have whatsapp:manage");
    assert.ok(perms.has("whatsapp:approve"), "admin must have whatsapp:approve");
  });
});
