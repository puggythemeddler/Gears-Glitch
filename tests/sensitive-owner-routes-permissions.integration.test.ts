import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { query, closePool } from "../server/db-helpers";

import { bootstrapTestDatabase } from "../server/test-db";
const HAS_DB = bootstrapTestDatabase();

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// End-to-end HTTP coverage for a class of pre-launch authorization gaps:
// routes guarded only by ownerAuthMiddleware (admin/owner/manager/provider+) with
// NO requirePermission, so a mid-privilege account (manager) could reach
// owner-level surfaces:
//   * GET  /api/admin/backup    -> dumped every table (users.password_hash, PII)
//   * GET  /api/audit-log       -> exposed the tenant audit trail
//   * DELETE /api/admin/branches/:id -> deleted a branch with only step-up auth
//
// The fix adds an explicit permission to each route (data:backup is a new
// owner/admin-only permission; audit:view and branch:view are existing owner
// permissions the default manager role deliberately lacks). This suite pins the
// manager-denied / admin-allowed split against a real server + PostgreSQL.
//
// Gated the same way as the other HTTP integration suites (TEST_DATABASE_URL;
// without it this suite skips).
describe("Sensitive owner routes require explicit permissions (DB)", { skip: !HAS_DB && "TEST_DATABASE_URL not set (disposable test DB only)" }, () => {
  let child: ChildProcess | null = null;
  let base = "";
  let adminToken = "";
  let csrfCookie = "";
  let csrfToken = "";
  const childLog: string[] = [];

  const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const managerUser = `qa-mgr-${runId}`;
  const managerPass = "qa-Mgr-Pass-2026!";

  const repoRoot = path.resolve(__dirname, "..");
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");

  let managerToken = "";

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
        JWT_SECRET: process.env.JWT_SECRET || "qa-sensitive-routes-test-jwt-secret-91c2",
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

    // A built-in manager account, created through the real staff API (which also
    // seeds branch grants so it can sign in on a multi-branch shop).
    const created = await api("/api/staff", { method: "POST", body: JSON.stringify({ username: managerUser, email: `${managerUser}@qa.local`, password: managerPass, role: "manager" }) }, adminToken);
    assert.equal(created.res.status, 201, `manager create failed: ${JSON.stringify(created.data)}`);
    managerToken = await login(managerUser, managerPass);
  });

  after(async () => {
    if (child) {
      child.kill();
      child = null;
    }
    await closePool();
  });

  it("a manager can neither dump the database nor read the audit log", async () => {
    const backup = await api("/api/admin/backup", {}, managerToken);
    assert.equal(backup.res.status, 403, `manager backup must be 403, got ${backup.res.status}`);
    assert.ok(!backup.data || !(backup.data as any).users, "a forbidden backup must not leak table data");

    const audit = await api("/api/audit-log", {}, managerToken);
    assert.equal(audit.res.status, 403, `manager audit-log must be 403, got ${audit.res.status}`);
  });

  it("a manager cannot delete a branch (permission gate runs before step-up)", async () => {
    // Use a non-existent id so that, even if the permission gate regressed, the
    // handler cannot destroy a real branch during this test.
    const del = await api("/api/admin/branches/99999999", { method: "DELETE", body: "{}" }, managerToken);
    assert.equal(del.res.status, 403, `manager branch delete must be 403 (permission first), got ${del.res.status}`);
  });

  it("an authorized account (admin) can still reach the backup and audit log", async () => {
    const backup = await api("/api/admin/backup", {}, adminToken);
    assert.equal(backup.res.status, 200, `admin backup must be 200, got ${backup.res.status}`);

    const audit = await api("/api/audit-log", {}, adminToken);
    assert.equal(audit.res.status, 200, `admin audit-log must be 200, got ${audit.res.status}`);
  });

  it("data:backup is seeded onto admin/owner only, and audit:view/branch:view stay off the default manager", async () => {
    const rows: any = await query("SELECT role_id, permission FROM role_permissions WHERE permission IN ('data:backup','audit:view','branch:view')");
    const byRole = new Map<string, Set<string>>();
    for (const r of rows.rows) {
      if (!byRole.has(r.role_id)) byRole.set(r.role_id, new Set());
      byRole.get(r.role_id)!.add(r.permission);
    }
    assert.ok(byRole.get("admin")?.has("data:backup"), "admin must have data:backup");
    assert.ok(byRole.get("owner")?.has("data:backup"), "owner must have data:backup");
    for (const role of ["manager", "technician", "staff", "provider"]) {
      assert.ok(!byRole.get(role)?.has("data:backup"), `${role} must NOT have data:backup`);
    }
    assert.ok(!byRole.get("manager")?.has("audit:view"), "manager must NOT have audit:view");
    assert.ok(!byRole.get("manager")?.has("branch:view"), "manager must NOT have branch:view");
  });

  it("data:backup is a registered, grantable permission", async () => {
    const perms = await api("/api/permissions", {}, adminToken);
    assert.equal(perms.res.status, 200, "admin must be able to list permissions");
    assert.ok((perms.data as any)?.permissions?.["data:backup"], "/api/permissions must advertise data:backup");
  });
});
