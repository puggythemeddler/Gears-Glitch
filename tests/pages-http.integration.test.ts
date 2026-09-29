import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { spawn, ChildProcess } from "child_process";

const HAS_DB = !!process.env.DATABASE_URL;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// End-to-end HTTP coverage of the Page Builder pages API against a REAL server.
// server/index.ts auto-listens (no exportable app), so we spawn the actual
// server as a child process bound to a random port with a seeded admin +
// technician, then drive it over fetch() with real logins. Gated the same way
// as the other DB-backed integration suites (CI provides Postgres via
// DATABASE_URL; locally these skip).
//
// Covers the HTTP-facing contract the unit suites cannot: 401 without a
// session, 403 for a non-admin staff role, admin CRUD, draft-not-public
// secrecy, publish lifecycle, and the 400 validation errors around publishing.
describe("pages API over real HTTP (DB)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  let child: ChildProcess | null = null;
  let base = "";
  let adminToken = "";
  let techToken = "";
  let csrfCookie = "";
  let csrfToken = "";
  const childLog: string[] = [];

  const runId = Date.now().toString(36).slice(-5);
  const qaSlug = `qa-http-${runId}`;
  const qaSlug2 = `qa-http-2-${runId}`;
  const qaSlug3 = `qa-http-3-${runId}`;

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
    // An account that may work at more than one branch is stopped at the picker
    // and gets a short-lived branch-select token instead of a session. These
    // suites are not branch-scoped, so take the first offered branch.
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

  // Mutating routes run behind csrfProtection (x-csrf-token header must match the
  // csrf_token cookie), so fetch the pair the same way the browser does. Without
  // this every write here is rejected 403 before it ever reaches authorization.
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
        JWT_SECRET: process.env.JWT_SECRET || "qa-http-test-jwt-secret-6f5b9a1c2d3e",
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

  after(() => {
    if (child) {
      child.kill();
      child = null;
    }
  });

  it("rejects admin-only pages routes without a session (401)", async () => {
    const list = await api("/api/admin/pages");
    assert.equal(list.res.status, 401);
    const create = await api("/api/admin/pages", { method: "POST", body: JSON.stringify({ slug: qaSlug, title: "Nope" }) });
    assert.equal(create.res.status, 401);
  });

  it("rejects a technician (non-admin staff) session from admin-only pages routes (403)", async () => {
    for (const call of [
      () => api("/api/admin/pages", {}, techToken),
      () => api("/api/admin/pages", { method: "POST", body: JSON.stringify({ slug: qaSlug2, title: "Nope" }) }, techToken),
    ]) {
      const { res } = await call();
      assert.equal(res.status, 403, `expected 403, got ${res.status}`);
    }
  });

  it("serves the public pages endpoints without authentication", async () => {
    const list = await api("/api/pages");
    assert.equal(list.res.status, 200);
    assert.ok(Array.isArray(list.data), "public page list is an array");
    const missing = await api("/api/pages/qa-missing-page");
    assert.equal(missing.res.status, 404);
  });

  it("creates a draft over HTTP and lists it in the admin view", async () => {
    const created = await api("/api/admin/pages", {
      method: "POST",
      body: JSON.stringify({ slug: qaSlug, title: `QA HTTP Page ${runId}`, description: "http test", config: { sections: [{ type: "text", title: "Hi", content: "Body" }] }, is_published: 0 }),
    }, adminToken);
    assert.equal(created.res.status, 201);
    assert.ok(created.data.id, "created page has an id");
    assert.equal(created.data.is_published, 0);

    const list = await api("/api/admin/pages", {}, adminToken);
    assert.equal(list.res.status, 200);
    const found = (list.data || []).find((p: any) => p.slug === qaSlug);
    assert.ok(found, "admin list includes the new draft");
    assert.equal(found.is_published, 0);
  });

  it("keeps a draft hidden publicly until it is published (draft-not-public)", async () => {
    const hidden = await api(`/api/pages/${qaSlug}`);
    assert.equal(hidden.res.status, 404, "draft must not be served publicly");

    // Pages are created via POST /api/admin/pages with the slug in the body;
    // there is no POST /api/admin/pages/:slug route (PUT/DELETE take :id).
    const published = await api("/api/admin/pages", {
      method: "POST",
      body: JSON.stringify({ slug: qaSlug2, title: "To Publish", config: { sections: [], colors: { accent: "#0a0" } }, is_published: 0 }),
    }, adminToken);
    assert.equal(published.res.status, 201, `publish-target create failed: ${JSON.stringify(published.data)}`);
    const id = published.data.id;

    const flip = await api(`/api/admin/pages/${id}`, { method: "PUT", body: JSON.stringify({ is_published: 1 }) }, adminToken);
    assert.equal(flip.res.status, 200);
    assert.equal(flip.data.is_published, 1);
    assert.equal(flip.data.slug, qaSlug2);

    const live = await api(`/api/pages/${qaSlug2}`);
    assert.equal(live.res.status, 200);
    assert.equal(live.data.slug, qaSlug2);
    assert.equal(live.data.config.colors.accent, "#0a0", "published config is served publicly");

    const list = await api("/api/pages");
    const slugs = (list.data || []).map((p: any) => p.slug);
    assert.ok(slugs.includes(qaSlug2), "published page appears on the public list");
    assert.ok(!slugs.includes(qaSlug), "draft slug never leaks onto the public list");
  });

  it("returns 400 for invalid identity/publication attempts", async () => {
    // Slug too short.
    const shortSlug = await api("/api/admin/pages", { method: "POST", body: JSON.stringify({ slug: "ab", title: "T" }) }, adminToken);
    assert.equal(shortSlug.res.status, 400);
    // Reserved slug collision with a real route.
    const reserved = await api("/api/admin/pages", { method: "POST", body: JSON.stringify({ slug: "account", title: "T" }) }, adminToken);
    assert.equal(reserved.res.status, 400);
    // Blank title.
    const blankTitle = await api("/api/admin/pages", { method: "POST", body: JSON.stringify({ slug: qaSlug3, title: "   " }) }, adminToken);
    assert.equal(blankTitle.res.status, 400);
    // Publish while mutating the slug into an invalid value.
    const created = await api("/api/admin/pages", { method: "POST", body: JSON.stringify({ slug: `qa-pub-${runId}`, title: "Publish guard", is_published: 0 }) }, adminToken);
    assert.equal(created.res.status, 201);
    const badSlug = await api(`/api/admin/pages/${created.data.id}`, { method: "PUT", body: JSON.stringify({ slug: "!", is_published: 1 }) }, adminToken);
    assert.equal(badSlug.res.status, 400);
    // Publish while emptying the title.
    const badTitle = await api(`/api/admin/pages/${created.data.id}`, { method: "PUT", body: JSON.stringify({ title: "   ", is_published: 1 }) }, adminToken);
    assert.equal(badTitle.res.status, 400);
  });

  it("rejects duplicate slugs (409)", async () => {
    const first = await api("/api/admin/pages", { method: "POST", body: JSON.stringify({ slug: `qa-dup-${runId}`, title: "First" }) }, adminToken);
    assert.equal(first.res.status, 201);
    const second = await api("/api/admin/pages", { method: "POST", body: JSON.stringify({ slug: `qa-dup-${runId}`, title: "Second" }) }, adminToken);
    assert.equal(second.res.status, 409);
  });

  it("deletes a page and removes it from the public list", async () => {
    const created = await api("/api/admin/pages", { method: "POST", body: JSON.stringify({ slug: `qa-del-${runId}`, title: "Delete me", is_published: 1 }) }, adminToken);
    assert.equal(created.res.status, 201);
    const id = created.data.id;

    const live = await api(`/api/pages/qa-del-${runId}`);
    assert.equal(live.res.status, 200);

    const del = await api(`/api/admin/pages/${id}`, { method: "DELETE" }, adminToken);
    assert.equal(del.res.status, 200);

    const gone = await api(`/api/pages/qa-del-${runId}`);
    assert.equal(gone.res.status, 404);

    const list = await api(`/api/admin/pages`, {}, adminToken);
    assert.ok(!(list.data || []).some((p: any) => p.id === id), "deleted page leaves the admin list");
  });
});