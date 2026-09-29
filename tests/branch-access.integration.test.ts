import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { spawn, ChildProcess } from "child_process";

const HAS_DB = !!process.env.DATABASE_URL;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// End-to-end HTTP coverage of account-linked branch selection against a REAL
// server, mirroring tests/pages-http.integration.test.ts: server/index.ts
// auto-listens so there is no exportable app to mount, and the branch rules are
// only meaningful across a real request/response/cookie cycle.
//
// The behaviours pinned here are the ones that decide whether a till can sell
// and where the sale lands:
//   - an account that may work at >1 branch is stopped at a picker and gets no
//     session until it chooses (the branch-select token cannot be replayed as a
//     session, and is scoped to one call);
//   - admin/owner resolve to every active branch but still pick, because the
//     point is sale attribution rather than access control;
//   - an unassigned account is refused in a multi-branch shop and is NOT handed
//     a session with a null branch, which would leave later writes unscoped;
//   - selection is validated against the account's own grants, not merely
//     "is this a real branch id";
//   - the session's activeBranchId is authoritative, so a stale or tampered
//     branchId on checkout is rejected instead of silently re-attributed;
//   - the last branch survives a re-login as a pre-selection.
describe("account-linked branch selection over real HTTP (DB)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  let child: ChildProcess | null = null;
  let base = "";
  const childLog: string[] = [];

  const runId = Date.now().toString(36).slice(-6);
  const USERNAME = `qa-branch-${runId}`;
  const PASSWORD = "qa-Branch-Pass-2026!";

  const repoRoot = path.resolve(__dirname, "..");
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");

  // Branch fixture rows this run created, so teardown removes only those.
  const fixtureBranchIds: number[] = [];

  /** Insert a branch straight into the DB, bypassing the plan's branch cap. */
  async function createFixtureBranch(name: string): Promise<number> {
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const r = await pool.query(
        "INSERT INTO branches (name, address, phone, email, is_active) VALUES ($1, '', '', '', 1) RETURNING id",
        [name]
      );
      const id = Number(r.rows[0].id);
      fixtureBranchIds.push(id);
      return id;
    } finally {
      await pool.end();
    }
  }

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

  // A cookie jar per identity, plus CSRF mirroring: mutating routes sit behind
  // csrfProtection, so the header has to echo the csrf_token cookie exactly the
  // way frontend/lib/api.ts does.
  function jar() {
    const m = new Map<string, string>();
    return {
      header: () => [...m].map(([k, v]) => `${k}=${v}`).join("; "),
      cookies: () => Object.fromEntries(m),
      absorb(res: Response) {
        for (const line of res.headers.getSetCookie?.() || []) {
          const [pair] = line.split(";");
          const i = pair.indexOf("=");
          if (i <= 0) continue;
          const k = pair.slice(0, i).trim();
          const v = pair.slice(i + 1).trim();
          if (v === "" || /expires=Thu, 01 Jan 1970/i.test(line)) m.delete(k);
          else m.set(k, v);
        }
      },
    };
  }

  type J = ReturnType<typeof jar>;

  async function call(j: J, p: string, opts: { method?: string; json?: unknown; bearer?: string } = {}) {
    const headers: Record<string, string> = {};
    const c = j.header();
    if (c) headers.Cookie = c;
    const method = opts.method || "GET";
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const csrf = j.cookies().csrf_token;
      if (csrf) headers["x-csrf-token"] = csrf;
    }
    if (opts.bearer) headers.Authorization = `Bearer ${opts.bearer}`;
    if (opts.json !== undefined) {
      headers["Content-Type"] = "application/json";
      opts = { ...opts, body: JSON.stringify(opts.json) } as any;
    }
    const res = await fetch(base + p, { ...(opts as any), method, headers, redirect: "manual", signal: AbortSignal.timeout(30000) });
    j.absorb(res);
    const text = await res.text();
    let body: any;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body };
  }

  /** Log in, transparently satisfying the branch picker when it appears. */
  async function loginAs(j: J, username: string, password: string, branchId?: number) {
    const r = await call(j, "/api/auth/login", { method: "POST", json: { username, password } });
    if (r.status !== 200) return r;
    if (!r.body.requiresBranch) return r;
    const target = branchId ?? r.body.branches?.[0]?.id;
    return call(j, "/api/auth/select-branch", { method: "POST", json: { branchId: target }, bearer: r.body.branchSelectToken });
  }

  // Two real active branches plus one spare used as "exists but not granted".
  let branchA = 0, branchB = 0, branchC = 0;
  let activeBranchCount = 0;
  let ownerId = 0;
  let staffId = 0;

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
        JWT_SECRET: process.env.JWT_SECRET || "qa-branch-test-jwt-secret-4c1d8a2b9e7f",
        // This suite logs in far more than a human would (one identity per rule
        // under test). The limiter is per-IP, so raise it rather than letting a
        // legitimate assertion return 429 instead of its real status.
        AUTH_RATE_MAX: "1000",
        ADMIN_USERNAME: `qa-branch-owner-${runId}`,
        ADMIN_EMAIL: `qa-branch-owner-${runId}@qa.local`,
        ADMIN_PASSWORD: "qa-Branch-Owner-2026!",
        // Boot seeds are keyed by username, and ensureTechnicianUser only ever
        // sets the password when it CREATES the account. The default "technician"
        // is a shared fixture that tests/layouts-api.integration.test.ts also
        // relies on, so whichever suite boots first on a clean database would mint
        // it with its own password and lock the other suite out of its before
        // hook. Claim a suite-private identity instead of competing for it.
        TECH_USERNAME: `qa-branch-tech-${runId}`,
        TECH_EMAIL: `qa-branch-tech-${runId}@qa.local`,
        TECH_PASSWORD: "qa-Branch-Tech-2026!",
      } as any,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (d) => { const s = String(d).trim(); if (s) childLog.push(s.slice(0, 400)); });
    child.stderr?.on("data", (d) => { const s = String(d).trim(); if (s) childLog.push(s.slice(0, 400)); });
    child.on("exit", (code) => childLog.push(`[child exit: ${code}]`));

    const ready = await waitForHealth(`${base}/api/health`);
    assert.ok(ready, `server never became healthy.\nRecent child output:\n${childLog.slice(-40).join("\n")}`);

    // A multi-branch shop is the precondition for most of these rules: with one
    // branch the resolver falls back to granting it to everyone.
    const owner = jar();
    await call(owner, "/api/csrf-token");
    const ownerLogin = await call(owner, "/api/auth/login", { method: "POST", json: { username: `qa-branch-owner-${runId}`, password: "qa-Branch-Owner-2026!" } });
    if (ownerLogin.body.requiresBranch) {
      await call(owner, "/api/auth/select-branch", { method: "POST", json: { branchId: ownerLogin.body.branches[0].id }, bearer: ownerLogin.body.branchSelectToken });
    } else {
      assert.ok(ownerLogin.body.token, "owner login returned no token");
    }

    // Three distinct active branches: two granted, one deliberately not.
    // A clean CI database usually has fewer than three, and the plan caps how many
    // branches a shop may create through the API, so top up by inserting fixture
    // rows directly. Reuse whatever already exists first and record what we added
    // so teardown can remove exactly our own rows.
    const branchList = await call(owner, "/api/admin/branches");
    assert.equal(branchList.status, 200, "could not list branches");
    const existing = (branchList.body.branches || []).filter((b: any) => b.is_active !== false);

    const ids = existing.map((b: any) => Number(b.id));
    while (ids.length < 3) {
      const created = await createFixtureBranch(`qa-branch-fixture-${runId}-${ids.length}`);
      ids.push(created);
    }

    activeBranchCount = ids.length;
    branchA = ids[0];
    branchB = ids[1];
    branchC = ids[2];

    ownerId = (await call(owner, "/api/auth/session")).body.sub ?? (await call(owner, "/api/auth/session")).body.userId;

    // A fresh staff account. POST /api/staff seeds every active branch, so this
    // account starts fully granted and we narrow it deliberately from there.
    const createdStaff = await call(owner, "/api/staff", {
      method: "POST",
      json: { username: USERNAME, email: `${USERNAME}@qa.local`, password: PASSWORD, role: "manager" },
    });
    assert.equal(createdStaff.status, 201, `could not create staff: ${JSON.stringify(createdStaff.body)}`);
    staffId = createdStaff.body.id;
  });

  after(async () => {
    if (child) {
      child.kill();
      child = null;
    }
    if (fixtureBranchIds.length) {
      try {
        const { Pool } = require("pg");
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        try {
          // user_branches cascades, so deleting the branch is enough.
          await pool.query("DELETE FROM branches WHERE id = ANY($1::int[])", [fixtureBranchIds]);
        } finally {
          await pool.end();
        }
      } catch (e) {
        console.error(`[branch-access] could not remove fixture branches: ${(e as Error).message}`);
      }
    }
  });

  it("admin resolves to every active branch but still picks one", async () => {
    const j = jar();
    await call(j, "/api/csrf-token");
    const r = await call(j, "/api/auth/login", { method: "POST", json: { username: `qa-branch-owner-${runId}`, password: "qa-Branch-Owner-2026!" } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.requiresBranch, true, "a multi-branch admin must still attribute a branch");
    assert.ok(r.body.branchSelectToken, "picker must issue a branch-select token");
    assert.equal(r.body.token, undefined, "no session before a branch is chosen");
    assert.ok(r.body.branches.length > 1, "admin should see all active branches");
  });

  it("the branch-select token cannot be used as a session", async () => {
    const j = jar();
    await call(j, "/api/csrf-token");
    const r = await call(j, "/api/auth/login", { method: "POST", json: { username: `qa-branch-owner-${runId}`, password: "qa-Branch-Owner-2026!" } });
    const s = await call(j, "/api/auth/session", { bearer: r.body.branchSelectToken });
    // Either refused outright, or reported as "no session": the key point is it
    // never yields branch authority on its own.
    if (s.status === 200) {
      assert.ok(
        s.body.activeBranchId == null,
        `a select token must not act as a session, got branch ${s.body.activeBranchId}`
      );
      assert.equal(s.body.role, null, "a select token must not identify a session role either");
    }
  });

  it("staff with more than one granted branch must pick before getting a session", async () => {
    const j = jar();
    await call(j, "/api/csrf-token");
    const r = await call(j, "/api/auth/login", { method: "POST", json: { username: USERNAME, password: PASSWORD } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.requiresBranch, true);
    assert.ok(r.body.branchSelectToken, "expected a branch-select token");
    assert.equal(r.body.token, undefined, "no session token before selection");
    assert.equal(r.body.branches.length, activeBranchCount, `expected every active branch to be offered, got ${r.body.branches.length}`);  });

  it("rejects a branch the account is not granted even though it exists", async () => {
    const owner = jar();
    await call(owner, "/api/csrf-token");
    await loginAs(owner, `qa-branch-owner-${runId}`, "qa-Branch-Owner-2026!");
    await call(owner, `/api/admin/staff/${staffId}/branches`, { method: "PUT", json: { branchIds: [branchA, branchB] } });

    const j = jar();
    await call(j, "/api/csrf-token");
    const login = await call(j, "/api/auth/login", { method: "POST", json: { username: USERNAME, password: PASSWORD } });
    const r = await call(j, "/api/auth/select-branch", { method: "POST", json: { branchId: branchC }, bearer: login.body.branchSelectToken });
    assert.equal(r.status, 403, `ungranted-but-existing branch must be refused: ${JSON.stringify(r.body)}`);
    assert.equal(r.body.activeBranchId, undefined, "a refused selection must not set a branch");
  });

  it("rejects an unknown branch id", async () => {
    const j = jar();
    await call(j, "/api/csrf-token");
    const login = await call(j, "/api/auth/login", { method: "POST", json: { username: USERNAME, password: PASSWORD } });
    const r = await call(j, "/api/auth/select-branch", { method: "POST", json: { branchId: 987654321 }, bearer: login.body.branchSelectToken });
    assert.ok(r.status === 403 || r.status === 400, `unknown branch must be refused: ${JSON.stringify(r.body)}`);
  });

  it("refuses selection when no valid token is presented", async () => {
    const j = jar();
    await call(j, "/api/csrf-token");
    const r = await call(j, "/api/auth/select-branch", { method: "POST", json: { branchId: branchA } });
    assert.ok(r.status === 401 || r.status === 403, `expected 401/403, got ${r.status}`);
  });

  it("pins the session to the chosen branch and reports it", async () => {
    const j = jar();
    await call(j, "/api/csrf-token");
    const picked = await loginAs(j, USERNAME, PASSWORD, branchA);
    assert.equal(picked.status, 200, JSON.stringify(picked.body));
    assert.ok(picked.body.token, "expected a session token after selection");
    assert.equal(picked.body.activeBranchId, branchA);

    const s = await call(j, "/api/auth/session");
    assert.equal(s.body.activeBranchId, branchA, "session must report the active branch");
    assert.equal(s.body.branches.length, 2, "session must only list granted branches");
  });

  it("scopes the POS branch list to the account's grants", async () => {
    const j = jar();
    await call(j, "/api/csrf-token");
    await loginAs(j, USERNAME, PASSWORD, branchA);
    const r = await call(j, "/api/pos/branches");
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const ids = (r.body.branches || []).map((b: any) => b.id).sort((a: number, b: number) => a - b);
    assert.deepEqual(ids, [branchA, branchB].sort((a, b) => a - b), "POS must not offer the ungranted branch");
  });

  it("rejects a checkout scoped to a branch other than the session's", async () => {
    const j = jar();
    await call(j, "/api/csrf-token");
    await loginAs(j, USERNAME, PASSWORD, branchA);
    const r = await call(j, "/api/pos/checkout", { method: "POST", json: { branchId: branchB, items: [{ productId: "x", quantity: 1 }] } });
    assert.equal(r.status, 403, `stale/tampered branch must be refused: ${JSON.stringify(r.body)}`);
    assert.match(r.body.error, /branch/i, "the error should name the branch problem");
  });

  it("rejects a checkout that names no branch when several are in play", async () => {
    const j = jar();
    await call(j, "/api/csrf-token");
    await loginAs(j, USERNAME, PASSWORD, branchA);
    // The session decides; omitting branchId must not escape the session's scope.
    const r = await call(j, "/api/pos/checkout", { method: "POST", json: { items: [{ productId: "x", quantity: 1 }] } });
    assert.ok(r.status === 400 || r.status === 403, `expected a refusal, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  it("switches branch mid-session and the new branch becomes authoritative", async () => {
    const j = jar();
    await call(j, "/api/csrf-token");
    await loginAs(j, USERNAME, PASSWORD, branchA);

    const sw = await call(j, "/api/auth/switch-branch", { method: "POST", json: { branchId: branchB } });
    assert.equal(sw.status, 200, JSON.stringify(sw.body));
    assert.equal(sw.body.activeBranchId, branchB);

    const s = await call(j, "/api/auth/session");
    assert.equal(s.body.activeBranchId, branchB, "the new session must carry the new branch");

    // The previously active branch is no longer sellable from this till.
    const stale = await call(j, "/api/pos/checkout", { method: "POST", json: { branchId: branchA, items: [{ productId: "x", quantity: 1 }] } });
    assert.equal(stale.status, 403, "the old branch must be refused after a switch");
  });

  it("refuses to switch to a branch the account is not granted", async () => {
    const j = jar();
    await call(j, "/api/csrf-token");
    await loginAs(j, USERNAME, PASSWORD, branchA);
    const r = await call(j, "/api/auth/switch-branch", { method: "POST", json: { branchId: branchC } });
    assert.ok(r.status === 403 || r.status === 400, `ungranted switch must fail: ${JSON.stringify(r.body)}`);
    const s = await call(j, "/api/auth/session");
    assert.equal(s.body.activeBranchId, branchA, "a refused switch must leave the branch untouched");
  });

  it("pre-selects the last branch on the next login", async () => {
    const first = jar();
    await call(first, "/api/csrf-token");
    await loginAs(first, USERNAME, PASSWORD, branchB);
    const sw = await call(first, "/api/auth/switch-branch", { method: "POST", json: { branchId: branchB } });
    assert.equal(sw.status, 200, JSON.stringify(sw.body));

    const second = jar();
    await call(second, "/api/csrf-token");
    const r = await call(second, "/api/auth/login", { method: "POST", json: { username: USERNAME, password: PASSWORD } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.requiresBranch, true);
    assert.equal(r.body.lastBranchId, branchB, "the last used branch should come back as the pre-selection");
  });

  it("skips the picker when exactly one branch is granted", async () => {
    const owner = jar();
    await call(owner, "/api/csrf-token");
    await loginAs(owner, `qa-branch-owner-${runId}`, "qa-Branch-Owner-2026!");
    await call(owner, `/api/admin/staff/${staffId}/branches`, { method: "PUT", json: { branchIds: [branchA] } });

    const j = jar();
    await call(j, "/api/csrf-token");
    const r = await call(j, "/api/auth/login", { method: "POST", json: { username: USERNAME, password: PASSWORD } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.notEqual(r.body.requiresBranch, true, "a single granted branch needs no prompt");
    assert.ok(r.body.token, "a session should be issued directly");
    assert.equal(r.body.activeBranchId, branchA, "the sole branch is pinned automatically");
  });

  it("refuses an unassigned account in a multi-branch shop and issues no session", async () => {
    const owner = jar();
    await call(owner, "/api/csrf-token");
    await loginAs(owner, `qa-branch-owner-${runId}`, "qa-Branch-Owner-2026!");
    await call(owner, `/api/admin/staff/${staffId}/branches`, { method: "PUT", json: { branchIds: [] } });

    const j = jar();
    await call(j, "/api/csrf-token");
    const r = await call(j, "/api/auth/login", { method: "POST", json: { username: USERNAME, password: PASSWORD } });
    assert.equal(r.status, 403, `unassigned login must be refused: ${JSON.stringify(r.body)}`);
    assert.equal(r.body.token, undefined, "a refused login must not leak a session token");
    assert.match(r.body.error, /branch/i, "the error should explain the branch assignment problem");
  });

  it("reports granted vs effective branches separately for admins", async () => {
    const owner = jar();
    await call(owner, "/api/csrf-token");
    await loginAs(owner, `qa-branch-owner-${runId}`, "qa-Branch-Owner-2026!");
    const r = await call(owner, `/api/admin/staff/${staffId}/branches`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.branchIds, [], "revoking grants should clear the assignment rows");
    assert.equal(r.body.effectiveBranchIds.length, 0, "and leave the effective set empty too");
  });

  // The last rule is the one a fresh install hits first, so it is worth pinning
  // even though it needs the shop to have no branches at all.
  it("still signs an account in when the shop has no branches yet", async () => {
    // Deactivate every branch, so the shop looks brand new. The suite's own
    // fixtures are restored straight after so later assertions are unaffected.
    const owner = jar();
    await call(owner, "/api/csrf-token");
    await loginAs(owner, `qa-branch-owner-${runId}`, "qa-Branch-Owner-2026!");
    const before = await call(owner, "/api/admin/branches");
    const all = (before.body.branches || []) as { id: number }[];

    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await pool.query("UPDATE branches SET is_active = 0");

      const j = jar();
      await call(j, "/api/csrf-token");
      const r = await call(j, "/api/auth/login", { method: "POST", json: { username: USERNAME, password: PASSWORD } });
      // Refusing here would lock every account out of a new install, and nobody
      // could ever create the first branch.
      assert.equal(r.status, 200, `a branchless shop must still allow sign-in: ${JSON.stringify(r.body)}`);
      assert.ok(r.body.token, "a session is issued so the shop can be set up");
      assert.notEqual(r.body.requiresBranch, true, "there is nothing to pick between");
      assert.equal(r.body.activeBranchId, null, "and so there is no branch to attribute to");

      // The POS still refuses: the point is to allow setup, not to sell unscoped.
      const checkout = await call(j, "/api/pos/checkout", { method: "POST", json: { items: [] } });
      assert.ok(checkout.status >= 400, "branch-scoped work must stay blocked while no branch exists");
    } finally {
      await pool.query("UPDATE branches SET is_active = 1");
      await pool.end();
    }
    assert.equal(all.length > 0, true, "sanity: there were branches to deactivate");
  });
});
