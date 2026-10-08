import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { query, queryOne, closePool } from "../server/db-helpers";

const HAS_DB = !!process.env.DATABASE_URL;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// End-to-end HTTP coverage of the newsletter subscription API against a REAL
// server and a REAL PostgreSQL database, following the harness used by
// layouts-api.integration.test.ts.
//
// >>> server/index.ts auto-listens (no exportable app), so we spawn the actual
// server as a child process bound to a random port with a seeded admin +
// technician and drive it over fetch() with real logins, exactly like the
// sibling HTTP suite.
//
// >>> The homepage newsletter form is only truthful if a successful response
// means a real row exists and every saved email is visible to the owner in
// Settings, so every assertion below is checked against PostgreSQL through
// server/db-helpers as well as through the API.
//
// >>> Fixtures are namespaced with a runId prefix; like the existing HTTP
// suite, this leaves its own rows behind and performs no global cleanup.
describe("Newsletter subscription API over real HTTP + PostgreSQL (DB)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  let child: ChildProcess | null = null;
  let base = "";
  let adminToken = "";
  let techToken = "";
  let csrfCookie = "";
  let csrfToken = "";
  const childLog: string[] = [];

  const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const emailA = `qa-news-${runId}-a@example.com`;
  const emailB = `qa-news-${runId}-b@example.com`;

  const repoRoot = path.resolve(__dirname, "..");
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");

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
      assert.ok(data.branchSelectToken, "picker must return a branchSelectToken");
      assert.ok(data.branches?.length, "picker must offer at least one branch");
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

  const subscriberRow = async (email: string) =>
    queryOne("SELECT id, email FROM newsletter_subscribers WHERE email = $1", [email]);
  const subscriberCount = async () => {
    const row = await queryOne("SELECT COUNT(*) AS count FROM newsletter_subscribers") as any;
    return Number(row?.count) || 0;
  };

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
        JWT_SECRET: process.env.JWT_SECRET || "qa-newsletter-test-jwt-secret-71c9a3bf8d1e",
        ADMIN_USERNAME: "admin",
        ADMIN_EMAIL: "admin@qa.local",
        ADMIN_PASSWORD: "qa-Admin-Pass-2026!",
        TECH_USERNAME: "technician",
        TECH_EMAIL: "tech@qa.local",
        TECH_PASSWORD: "qa-Tech-Pass-2026!",
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
    techToken = await login("technician", "qa-Tech-Pass-2026!");
  });

  after(async () => {
    if (child) {
      child.kill();
      child = null;
    }
    await closePool();
  });

  it("accepts a public subscription and persists a real row", async () => {
    const countBefore = await subscriberCount();
    const { res, data } = await api("/api/newsletter/subscribe", {
      method: "POST",
      body: JSON.stringify({ email: emailA }),
    });
    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(data)}`);
    assert.equal(data?.ok, true);

    const row = await subscriberRow(emailA);
    assert.ok(row, "the email must be a real row in PostgreSQL");
    assert.equal(await subscriberCount(), countBefore + 1, "exactly one new subscriber");
  });

  it("is idempotent — re-subscribing does not duplicate the row", async () => {
    const { res, data } = await api("/api/newsletter/subscribe", {
      method: "POST",
      body: JSON.stringify({ email: emailA }),
    });
    assert.equal(res.status, 200);
    assert.equal(data?.ok, true);

    const rows = await query("SELECT id FROM newsletter_subscribers WHERE email = $1", [emailA]);
    assert.equal(rows.rows.length, 1, "a duplicate email must not create a second row");
  });

  it("rejects an invalid email address with 400 and no row", async () => {
    const countBefore = await subscriberCount();
    for (const bad of ["not-an-email", "a@b"]) {
      const { res, data } = await api("/api/newsletter/subscribe", {
        method: "POST",
        body: JSON.stringify({ email: bad }),
      });
      assert.equal(res.status, 400, `expected 400 for "${bad}", got ${res.status}`);
      assert.ok(typeof data?.error === "string", "a controlled error message is returned");
    }
    assert.equal(await subscriberCount(), countBefore, "invalid emails must not create rows");
  });

  it("keeps the subscriber list admin-only (401 anonymous, 403 technician)", async () => {
    const anon = await api("/api/newsletter/subscribers");
    assert.equal(anon.res.status, 401, `anonymous list must be 401, got ${anon.res.status}`);

    const tech = await api("/api/newsletter/subscribers", {}, techToken);
    assert.equal(tech.res.status, 403, `technician list must be 403, got ${tech.res.status}`);
  });

  it("lists subscribers for the owner with an accurate total", async () => {
    const subscribedB = await api("/api/newsletter/subscribe", { method: "POST", body: JSON.stringify({ email: emailB }) });
    assert.equal(subscribedB.res.status, 200, `subscribing email B must succeed, got ${subscribedB.res.status}`);

    const { res, data } = await api("/api/newsletter/subscribers?limit=100", {}, adminToken);
    assert.equal(res.status, 200, `owner list must be 200, got ${res.status}`);
    assert.ok(Array.isArray(data?.subscribers), "subscribers must be an array");
    const emails = data.subscribers.map((s: any) => s.email);
    assert.ok(emails.includes(emailA), "the list contains the first subscriber");
    assert.ok(emails.includes(emailB), "the list contains the second subscriber");
    assert.ok(data.total >= 2, "total counts every subscriber");
    const newest = data.subscribers[0];
    assert.ok(typeof newest.id === "number" && typeof newest.created_at === "string", "rows expose id and created_at");
  });

  it("owner can delete a subscriber and the row disappears", async () => {
    const row = await subscriberRow(emailB);
    assert.ok(row, "subscriber exists before delete");

    const removed = await api(`/api/newsletter/subscribers/${row.id}`, { method: "DELETE" }, adminToken);
    assert.equal(removed.res.status, 200, `delete must be 200, got ${removed.res.status}`);
    assert.equal(removed.data?.ok, true);

    assert.equal(await subscriberRow(emailB), undefined, "the row is gone from PostgreSQL");

    const survivor = await subscriberRow(emailA);
    assert.ok(survivor, "other subscribers are untouched");
  });

  it("produces a controlled error for a bogus delete id", async () => {
    const bad = await api("/api/newsletter/subscribers/not-a-number", { method: "DELETE" }, adminToken);
    assert.equal(bad.res.status, 400, `non-numeric id must be 400, got ${bad.res.status}`);

    const missing = await api("/api/newsletter/subscribers/999999999", { method: "DELETE" }, adminToken);
    assert.equal(missing.res.status, 200, "deleting a missing id is harmless and still ok");
  });
});