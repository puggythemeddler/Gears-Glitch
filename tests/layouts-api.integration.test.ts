import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { query, queryOne, closePool } from "../server/db-helpers";

const HAS_DB = !!process.env.DATABASE_URL;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// End-to-end HTTP coverage of the Website Studio (storefront layout) API against
// a REAL server and a REAL PostgreSQL database.
//
// server/index.ts auto-listens (no exportable app), so we spawn the actual server
// as a child process bound to a random port with a seeded admin + technician and
// drive it over fetch() with real logins, exactly like pages-http.integration.test.ts.
// Gated the same way as the other DB-backed suites (CI provides Postgres via
// DATABASE_URL; locally these skip).
//
// The layout API is the one Studio surface where an HTTP 200 is NOT evidence on
// its own: publish/activate and the draft-vs-live split are three independent
// statements plus a settings write, so every lifecycle assertion below is checked
// against PostgreSQL through server/db-helpers as well as through the API.
//
// Tenancy note: this suite cannot fabricate a second tenant. storefront_layouts
// has no client/tenant column (asserted below) because Gears&Glitch isolates
// tenants per service-database (control-plane/server/provision.ts). The
// request-level boundary that DOES exist is role-based, so authentication and
// authorization are tested for real (401/403) and the per-DB tenancy is asserted
// against information_schema rather than mocked with a second fake tenant.
//
// Fixtures are namespaced with a runId prefix; like the existing HTTP suite, this
// leaves its own rows behind and performs no global cleanup.
describe("Website Studio layouts API over real HTTP + PostgreSQL (DB)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  let child: ChildProcess | null = null;
  let base = "";
  let adminToken = "";
  let techToken = "";
  let csrfCookie = "";
  let csrfToken = "";
  const childLog: string[] = [];

  // Fixtures stay namespaced per run. The sibling pages suite uses the last 5
  // base-36 digits of the clock, which only changes every ~18.6h and collides on
  // any database that outlives a run, so keep the whole timestamp plus randomness.
  const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const keyA = `qa-layout-a-${runId}`;
  const keyB = `qa-layout-b-${runId}`;
  const keyStatic = `qa-layout-static-${runId}`;
  const keyDraft = `qa-layout-draft-${runId}`;

  const repoRoot = path.resolve(__dirname, "..");
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");

  // Every section type the editor can emit, including a spacer explicitly
  // configured to 0 (the "?? 40" regression) and the stats/features item shapes
  // the editor's inline-editing path binds to via data-fid.
  const sectionsFor = (tag: string, height: number) => [
    { type: "banner", title: `Banner ${tag}`, link: "/shop", image: "/assets/banner.jpg" },
    { type: "text", title: `Text ${tag}`, content: `Original body copy ${tag}` },
    { type: "button", label: `Shop ${tag}`, link: "/products" },
    { type: "image", src: "/assets/promo.jpg", alt: `Promo ${tag}`, caption: "Promo" },
    { type: "product-grid", title: `Products ${tag}`, category: "electronics", limit: 8 },
    { type: "categories", title: `Categories ${tag}`, limit: 6 },
    { type: "features", title: `Features ${tag}`, items: [ { title: `Fast delivery ${tag}`, text: "Nationwide" }, { title: `Secure pay ${tag}`, text: "M-Pesa" } ] },
    { type: "stats", title: `Stats ${tag}`, items: [ { value: "10k+", label: `Customers ${tag}` }, { value: "99.9%", label: "Uptime" } ] },
    { type: "spacer", height },
  ];

  const configFor = (tag: string, height = 0) => ({
    hero: { title: `QA Hero ${tag}`, subtitle: `Subtitle ${tag}`, image: "/assets/hero.jpg" },
    sections: sectionsFor(tag, height),
    theme: "default",
  });

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
    assert.ok(data.token, `login as "${username}" returned no token`);
    return data.token;
  }

  // Every mutating route in this app sits behind csrfProtection, which demands an
  // x-csrf-token header matching the csrf_token cookie. The browser gets both from
  // GET /api/csrf-token, so the test does exactly the same instead of bypassing it.
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

  const createLayout = async (key: string, label: string, config: any, layoutType: string = "dynamic") => {
    const { res, data } = await api("/api/admin/layouts", {
      method: "POST",
      body: JSON.stringify({ layoutKey: key, label, description: `QA ${label}`, layoutType, config }),
    }, adminToken);
    return { res, data };
  };

  const rowFor = async (id: number) => queryOne("SELECT * FROM storefront_layouts WHERE id = $1", [id]);
  const rowByKey = async (key: string) => queryOne("SELECT * FROM storefront_layouts WHERE layout_key = $1", [key]);
  const setting = async (key: string) => {
    const row = await queryOne("SELECT value FROM settings WHERE key = $1", [key]);
    return row ? row.value : null;
  };
  const activeRows = async () => (await query("SELECT id, layout_key FROM storefront_layouts WHERE is_active = 1")).rows;

  let layoutA: any;
  let layoutB: any;

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
        JWT_SECRET: process.env.JWT_SECRET || "qa-layout-test-jwt-secret-91c4d7ab2e6f",
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

    const created = await createLayout(keyA, `QA Layout A ${runId}`, configFor("A"));
    assert.equal(created.res.status, 201, `Layout A seed failed: ${JSON.stringify(created.data)}`);
    layoutA = created.data;
  });

  after(async () => {
    if (child) {
      child.kill();
      child = null;
    }
    await closePool();
  });

  it("rejects unauthenticated layout mutations (401)", async () => {
    const calls = [
      () => api("/api/admin/layouts", { method: "POST", body: JSON.stringify({ layoutKey: `qa-noauth-${runId}`, label: "No auth" }) }),
      () => api(`/api/admin/layouts/${layoutA.id}`, { method: "PUT", body: JSON.stringify({ label: "Hacked" }) }),
      () => api(`/api/admin/layouts/${layoutA.id}/activate`, { method: "PUT" }),
      () => api(`/api/admin/layouts/${layoutA.id}`, { method: "DELETE" }),
    ];
    for (const call of calls) {
      const { res } = await call();
      assert.equal(res.status, 401, `expected 401 without a session, got ${res.status}`);
    }
    const untouched = await rowByKey(keyA);
    assert.equal(untouched.label, `QA Layout A ${runId}`, "unauthenticated calls must not mutate the row");
  });

  it("rejects a technician (non-admin staff) session from layout admin routes (403)", async () => {
    const calls = [
      () => api("/api/admin/layouts", { method: "POST", body: JSON.stringify({ layoutKey: `qa-tech-${runId}`, label: "Tech" }) }, techToken),
      () => api(`/api/admin/layouts/${layoutA.id}`, { method: "PUT", body: JSON.stringify({ label: "Tech edit" }) }, techToken),
      () => api(`/api/admin/layouts/${layoutA.id}/activate`, { method: "PUT" }, techToken),
      () => api(`/api/admin/layouts/${layoutA.id}`, { method: "DELETE" }, techToken),
    ];
    for (const call of calls) {
      const { res } = await call();
      assert.equal(res.status, 403, `expected 403 for technician, got ${res.status}`);
    }
    const untouched = await rowByKey(keyA);
    assert.equal(untouched.label, `QA Layout A ${runId}`, "forbidden calls must not mutate the row");
  });

  it("boots a migrated schema with built-in static layouts and no request-level tenant column", async () => {
    const statics = await query("SELECT layout_key, layout_type, is_active FROM storefront_layouts WHERE layout_type = 'static' ORDER BY sort_order ASC, id ASC");
    assert.ok(statics.rows.length > 0, "migrations must seed the built-in static layouts");

    const cols = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'storefront_layouts'");
    const names: string[] = cols.rows.map((r: any) => r.column_name);
    assert.ok(!names.includes("client_id") && !names.includes("tenant_id"),
      "storefront_layouts is intentionally per-tenant-database scoped; a request-level tenant column would change the model");
  });

  it("creates a dynamic layout carrying every editor section type and persists it", async () => {
    assert.equal(typeof layoutA.id, "number", "created layout has a real database id");
    assert.ok(layoutA.id > 0);
    assert.equal(layoutA.layout_type, "dynamic");
    assert.equal(layoutA.is_active, 0, "a new layout starts as a draft, never live");

    const row = await rowFor(layoutA.id);
    assert.ok(row, "row is really in PostgreSQL, not just echoed back");
    assert.equal(row.layout_key, keyA);
    assert.deepEqual(row.config, configFor("A"), "config round-trips through JSONB unchanged");
    assert.equal(row.config.sections[8].height, 0, "spacer height 0 must survive the write");
    assert.deepEqual(row.config.sections.map((s: any) => s.type), [
      "banner", "text", "button", "image", "product-grid", "categories", "features", "stats", "spacer",
    ], "section order is preserved");
  });

  it("retrieves the layout through the admin and staff endpoints without losing fields, and refuses anonymous reads", async () => {
    const byId = await api(`/api/admin/layouts/${layoutA.id}`, {}, adminToken);
    assert.equal(byId.res.status, 200);
    assert.deepEqual(byId.data.config, configFor("A"));

    const adminList = await api("/api/admin/layouts", {}, adminToken);
    assert.equal(adminList.res.status, 200);
    const found = (adminList.data || []).find((l: any) => l.layout_key === keyA);
    assert.ok(found, "admin list includes the created layout");
    assert.equal(found.id, layoutA.id);

    // /api/layouts feeds the Website Studio builder and returns every layout's
    // full config (drafts included), so it is staff-only. An anonymous visitor
    // must never be able to read unpublished draft content.
    const anonList = await api("/api/layouts");
    assert.equal(anonList.res.status, 401, `expected 401 for an anonymous layout list, got ${anonList.res.status}`);
    assert.ok(
      !JSON.stringify(anonList.data || {}).includes(configFor("A").hero.headline),
      "an anonymous response must not leak draft layout config",
    );

    const publicList = await api("/api/layouts", {}, adminToken);
    assert.equal(publicList.res.status, 200);
    const pub = (publicList.data || []).find((l: any) => l.layout_key === keyA);
    assert.ok(pub, "staff layout list includes the created layout");
    assert.deepEqual(pub.config, configFor("A"), "returned config matches what was saved");
    assert.equal(pub.is_active, 0);

    const ordered = (adminList.data || []).map((l: any) => l.sort_order);
    assert.deepEqual(ordered, [...ordered].sort((a: number, b: number) => a - b), "sort_order is returned in order");
  });

  it("saves a draft edit and persists it (Save -> database -> reload)", async () => {
    const edited = configFor("A-edited", 0);
    edited.sections = [...edited.sections].reverse();
    const editedText = edited.sections.find((s: any) => s.type === "text");
    assert.ok(editedText, "text section survives the reorder");
    editedText.content = "Rewritten body copy";
    edited.theme = "kenyan";

    const saved = await api(`/api/admin/layouts/${layoutA.id}`, {
      method: "PUT",
      body: JSON.stringify({ label: `QA Layout A edited ${runId}`, description: "Edited description", config: edited }),
    }, adminToken);
    assert.equal(saved.res.status, 200, `save failed: ${JSON.stringify(saved.data)}`);
    assert.equal(saved.data.label, `QA Layout A edited ${runId}`);

    const row = await rowFor(layoutA.id);
    assert.equal(row.label, `QA Layout A edited ${runId}`, "label persisted in the database");
    assert.equal(row.description, "Edited description");
    assert.deepEqual(row.config, edited, "design + reordered sections persisted");
    assert.equal(row.config.theme, "kenyan");
    assert.equal(row.config.sections.find((s: any) => s.type === "text").content, "Rewritten body copy");
    assert.equal(row.config.sections.find((s: any) => s.type === "spacer").height, 0, "spacer height 0 is not silently defaulted");

    const refetched = await api(`/api/admin/layouts/${layoutA.id}`, {}, adminToken);
    assert.deepEqual(refetched.data.config, edited, "reload returns the updated values");
    assert.equal(refetched.data.label, `QA Layout A edited ${runId}`);
    assert.equal(refetched.data.config.sections.find((s: any) => s.type === "text").content, "Rewritten body copy");
    assert.ok(!JSON.stringify(refetched.data.config).includes("Original body copy A-edited"), "the pre-edit copy is not restored");
    assert.equal(refetched.data.config.sections[0].type, "spacer", "the new section order is what reload returns");
  });

  it("publishes Layout A and the database marks it as the live layout", async () => {
    const activated = await api(`/api/admin/layouts/${layoutA.id}/activate`, { method: "PUT" }, adminToken);
    assert.equal(activated.res.status, 200, `activate failed: ${JSON.stringify(activated.data)}`);

    const active = await activeRows();
    assert.equal(active.length, 1, "exactly one layout is live");
    assert.equal(active[0].id, layoutA.id, "the database identifies Layout A as active");
    assert.equal((await rowFor(layoutA.id)).is_active, 1);
    assert.equal(await setting("store_layout"), keyA, "store_layout setting points at the published layout");
  });

  it("keeps a newly created Layout B as a draft without displacing the live Layout A", async () => {
    const createdB = await createLayout(keyB, `QA Layout B ${runId}`, configFor("B"));
    assert.equal(createdB.res.status, 201, `Layout B create failed: ${JSON.stringify(createdB.data)}`);
    layoutB = createdB.data;

    assert.equal((await rowFor(layoutB.id)).is_active, 0, "Layout B is a draft");
    const active = await activeRows();
    assert.equal(active.length, 1);
    assert.equal(active[0].id, layoutA.id, "Layout A is still the only live layout");
    assert.equal(await setting("store_layout"), keyA, "creating a draft does not change the live layout");
  });

  it("swaps the live layout when Layout B is published", async () => {
    const activated = await api(`/api/admin/layouts/${layoutB.id}/activate`, { method: "PUT" }, adminToken);
    assert.equal(activated.res.status, 200, `activate B failed: ${JSON.stringify(activated.data)}`);

    const active = await activeRows();
    assert.equal(active.length, 1, "still exactly one live layout");
    assert.equal(active[0].id, layoutB.id, "Layout B is now live");
    assert.equal((await rowFor(layoutA.id)).is_active, 0, "Layout A is no longer live");
    assert.equal((await rowFor(layoutB.id)).is_active, 1);
    assert.equal(await setting("store_layout"), keyB);
  });

  it("serves the active layout through the storefront configuration API", async () => {
    const pub = await api("/api/storefront-config");
    assert.equal(pub.res.status, 200);
    assert.equal(pub.data.layout, keyB, "storefront-config points at the published layout");
    assert.ok(pub.data.layoutConfig, "storefront-config exposes the layout config");
    assert.equal(pub.data.layoutConfig.label, `QA Layout B ${runId}`);
    assert.deepEqual(pub.data.layoutConfig.config, configFor("B"), "storefront serves Layout B's configuration");

    const adminCfg = await api("/api/admin/storefront-layout", {}, adminToken);
    assert.equal(adminCfg.res.status, 200);
    assert.equal(adminCfg.data.layout, keyB, "the editor's settings endpoint agrees on the live layout");
  });

  it("applies a valid storefront-layout update without disturbing the live layout", async () => {
    const banners = [ { id: "qa-banner", title: "QA banner", link: "/sale", image: "/assets/sale.jpg" } ];
    const updated = await api("/api/admin/storefront-layout", {
      method: "PUT",
      body: JSON.stringify({ theme: "kenyan", banners, features: [ { title: "Fast", text: "Delivery" } ] }),
    }, adminToken);
    assert.equal(updated.res.status, 200, `valid storefront update rejected: ${JSON.stringify(updated.data)}`);

    assert.equal(await setting("store_theme"), "kenyan");
    assert.deepEqual(JSON.parse((await setting("store_banners")) || "[]"), banners);
    assert.equal(await setting("store_layout"), keyB, "an unrelated settings write must not change the live layout");
    assert.equal((await rowFor(layoutB.id)).is_active, 1, "Layout B stays live");

    await api("/api/admin/storefront-layout", { method: "PUT", body: JSON.stringify({ theme: "default" }) }, adminToken);
  });

  it("rejects invalid storefront-layout payloads with 400 and no partial mutation", async () => {
    const themeBefore = await setting("store_theme");
    const bannersBefore = await setting("store_banners");
    const layoutBefore = await setting("store_layout");

    const invalid = [
      { name: "theme", body: { theme: "neon-disco" } },
      { name: "banners", body: { banners: "not-an-array" } },
      { name: "features", body: { features: { nope: true } } },
      { name: "hero", body: { hero: "not-an-object" } },
      { name: "themeCustom", body: { themeCustom: "not-an-object" } },
      { name: "layout", body: { layout: "no-such-layout-key" } },
    ];
    for (const { name, body } of invalid) {
      const attempt = await api("/api/admin/storefront-layout", { method: "PUT", body: JSON.stringify(body) }, adminToken);
      assert.equal(attempt.res.status, 400, `expected 400 for invalid ${name}, got ${attempt.res.status}`);
      assert.ok(attempt.data && typeof attempt.data.error === "string", `invalid ${name} must return a controlled error`);
    }

    assert.equal(await setting("store_theme"), themeBefore, "rejected payloads must not change the theme");
    assert.equal(await setting("store_banners"), bannersBefore, "rejected payloads must not change banners");
    assert.equal(await setting("store_layout"), layoutBefore, "rejected payloads must not change the live layout");
  });

  it("does not repoint the live layout when a publish request carries invalid configuration", async () => {
    const attempt = await api("/api/admin/storefront-layout", {
      method: "PUT",
      body: JSON.stringify({ layout: keyA, theme: "not-a-real-theme" }),
    }, adminToken);
    assert.equal(attempt.res.status, 400, `expected 400, got ${attempt.res.status}`);

    assert.equal(await setting("store_layout"), keyB, "the previous live layout must remain live");
    const active = await activeRows();
    assert.equal(active.length, 1);
    assert.equal(active[0].id, layoutB.id, "the invalid layout must not become active");
    assert.equal((await rowFor(layoutA.id)).is_active, 0);
  });

  it("deletes a disposable draft layout and it stays gone", async () => {
    const created = await createLayout(keyDraft, `QA Draft ${runId}`, configFor("draft"));
    assert.equal(created.res.status, 201);
    const id = created.data.id;

    const removed = await api(`/api/admin/layouts/${id}`, { method: "DELETE" }, adminToken);
    assert.equal(removed.res.status, 200, `delete failed: ${JSON.stringify(removed.data)}`);
    assert.equal(removed.data.ok, true);

    const after_ = await api(`/api/admin/layouts/${id}`, {}, adminToken);
    assert.equal(after_.res.status, 404, "a deleted layout cannot be fetched");

    assert.equal(await rowFor(id), undefined, "the row is gone from PostgreSQL");

    const publicList = await api("/api/layouts", {}, adminToken);
    assert.equal(publicList.res.status, 200);
    assert.ok(!(publicList.data || []).some((l: any) => l.layout_key === keyDraft), "deleted draft does not reappear");
  });

  it("refuses to delete the live layout and keeps it intact", async () => {
    const attempt = await api(`/api/admin/layouts/${layoutB.id}`, { method: "DELETE" }, adminToken);
    assert.equal(attempt.res.status, 409, `expected 409 deleting the live layout, got ${attempt.res.status}`);
    assert.ok(typeof attempt.data.error === "string");

    const row = await rowFor(layoutB.id);
    assert.ok(row, "the live layout still exists");
    assert.equal(row.is_active, 1, "the live layout is still live");
    assert.equal(await setting("store_layout"), keyB);
  });

  it("refuses to mutate or delete built-in and static layouts", async () => {
    const builtIn = await queryOne("SELECT * FROM storefront_layouts WHERE layout_key = 'original'");
    assert.ok(builtIn, "the built-in 'original' layout is seeded by migration 0020");
    assert.equal(builtIn.layout_type, "static");

    const edit = await api(`/api/admin/layouts/${builtIn.id}`, { method: "PUT", body: JSON.stringify({ label: "Hijacked", config: { hacked: true } }) }, adminToken);
    assert.ok(edit.res.status >= 400 && edit.res.status < 500, `built-in edit must be a controlled client error, got ${edit.res.status}`);

    const remove = await api(`/api/admin/layouts/${builtIn.id}`, { method: "DELETE" }, adminToken);
    assert.ok(remove.res.status >= 400 && remove.res.status < 500, `built-in delete must be a controlled client error, got ${remove.res.status}`);

    const stillThere = await rowFor(builtIn.id);
    assert.ok(stillThere, "built-in layout was not deleted");
    assert.notEqual(stillThere.label, "Hijacked", "built-in layout was not modified");

    const madeStatic = await createLayout(keyStatic, `QA Static ${runId}`, configFor("static"), "static");
    assert.equal(madeStatic.res.status, 201);
    assert.equal(madeStatic.data.layout_type, "static");

    const staticEdit = await api(`/api/admin/layouts/${madeStatic.data.id}`, { method: "PUT", body: JSON.stringify({ label: "Static edit" }) }, adminToken);
    assert.equal(staticEdit.res.status, 409, "editing a static layout is refused");
    const staticDelete = await api(`/api/admin/layouts/${madeStatic.data.id}`, { method: "DELETE" }, adminToken);
    assert.ok(staticDelete.res.status >= 400 && staticDelete.res.status < 500, "deleting a static layout is refused");
    assert.notEqual((await rowFor(madeStatic.data.id)).label, "Static edit", "the static layout was not modified");
  });

  it("validates layout input without corrupting data", async () => {
    const noKey = await api("/api/admin/layouts", { method: "POST", body: JSON.stringify({ label: "No key" }) }, adminToken);
    assert.equal(noKey.res.status, 400, "layoutKey is required");

    const noLabel = await api("/api/admin/layouts", { method: "POST", body: JSON.stringify({ layoutKey: `qa-nolabel-${runId}` }) }, adminToken);
    assert.equal(noLabel.res.status, 400, "label is required");

    const duplicate = await createLayout(keyA, "Duplicate", configFor("dup"));
    assert.equal(duplicate.res.status, 400, "duplicate layout keys are rejected");

    for (const badId of [999999999, "not-a-number"]) {
      const put = await api(`/api/admin/layouts/${badId}`, { method: "PUT", body: JSON.stringify({ label: "x" }) }, adminToken);
      assert.ok(put.res.status >= 400, `PUT with id "${badId}" must fail, got ${put.res.status}`);
      const act = await api(`/api/admin/layouts/${badId}/activate`, { method: "PUT" }, adminToken);
      assert.ok(act.res.status >= 400, `activate with id "${badId}" must fail, got ${act.res.status}`);
      const del = await api(`/api/admin/layouts/${badId}`, { method: "DELETE" }, adminToken);
      assert.ok(del.res.status >= 400, `DELETE with id "${badId}" must fail, got ${del.res.status}`);
    }

    const row = await rowByKey(keyA);
    assert.ok(row, "the real layout survived the invalid requests");
    assert.equal(row.label, `QA Layout A edited ${runId}`, "invalid requests caused no partial mutation");
    assert.deepEqual(row.config.sections.map((s: any) => s.type).sort(), [
      "banner", "button", "categories", "features", "image", "product-grid", "spacer", "stats", "text",
    ], "configuration is intact after the invalid requests");
  });

  it("finishes with exactly one consistent live layout", async () => {
    const active = await activeRows();
    assert.equal(active.length, 1, "exactly one live layout at the end of the suite");
    assert.equal(active[0].id, layoutB.id);
    assert.equal(await setting("store_layout"), keyB);

    const pub = await api("/api/storefront-config");
    assert.equal(pub.data.layout, keyB);
    assert.equal(pub.data.layoutConfig.label, `QA Layout B ${runId}`);
    assert.deepEqual(pub.data.layoutConfig.config.sections.map((s: any) => s.type), configFor("B").sections.map((s: any) => s.type));
  });
});
