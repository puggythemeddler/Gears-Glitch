// tests/image-api-http.integration.test.ts
//
// HTTP-level cover for the image restore route and the CSP the API actually
// emits. unit-level assertions live in image-delivery.test.ts; this file boots
// a real server so we test the response headers a browser really receives and
// the real authorization chain, not a re-implementation of it.
//
// The bug being locked down: /api/images/:refId shipped unauthenticated. It is
// keyed by short, guessable refs ("about", "logo", "product:123",
// "repair:7:before:2") over stored_images, which has no tenant column, so any
// visitor who enumerated IDs could read every store's product and repair media.
// The route is a restore path for an operator, so it now requires a staff
// session with settings:view.
//
// Gated on DATABASE_URL like the other DB-backed integration suites.

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { spawn, ChildProcess } from "child_process";

const HAS_DB = !!process.env.DATABASE_URL;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("image API over real HTTP (DB)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  let child: ChildProcess | null = null;
  let base = "";
  let adminToken = "";
  const childLog: string[] = [];

  const repoRoot = path.resolve(__dirname, "..");
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const runId = Date.now().toString(36).slice(-5);

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
        JWT_SECRET: process.env.JWT_SECRET || "qa-imgapi-jwt-secret-2b7c4d9e1a3f",
        // Boot seeds are keyed by username, and ensureTechnicianUser only ever
        // sets the password when it CREATES the account (server/db.ts). The
        // default "technician" is a shared fixture that layouts-api and
        // pages-http also rely on, and this file sorts ahead of both in the
        // tests/*.test.ts glob - so booting with the defaults here would mint
        // "technician" with a random password and lock those suites out of
        // their own before hook. Claim a suite-private identity instead.
        ADMIN_USERNAME: `qa-imgapi-owner-${runId}`,
        ADMIN_EMAIL: `qa-imgapi-owner-${runId}@qa.local`,
        ADMIN_PASSWORD: "qa-ImgApi-Owner-2026!",
        TECH_USERNAME: `qa-imgapi-tech-${runId}`,
        TECH_EMAIL: `qa-imgapi-tech-${runId}@qa.local`,
        TECH_PASSWORD: "qa-ImgApi-Tech-2026!",
      } as any,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (d) => { const s = String(d).trim(); if (s) childLog.push(s.slice(0, 400)); });
    child.stderr?.on("data", (d) => { const s = String(d).trim(); if (s) childLog.push(s.slice(0, 400)); });

    const ready = await waitForHealth(`${base}/api/health`);
    assert.ok(ready, `server never became healthy.\nRecent child output:\n${childLog.slice(-40).join("\n")}`);

    adminToken = await login(`qa-imgapi-owner-${runId}`, "qa-ImgApi-Owner-2026!");
  });

  after(() => {
    if (child) {
      child.kill();
      child = null;
    }
  });

  it("emits a CSP whose img-src allows the Cloudinary delivery origin", async () => {
    // This is the header the browser enforces. Asserting it on the live
    // response catches a policy that is correct in source but overridden or
    // re-serialized on the way out.
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(30000) });
    assert.equal(res.status, 200);
    const csp = res.headers.get("content-security-policy");
    assert.ok(csp, "every API response must carry a Content-Security-Policy");
    const imgSrc = csp.match(/img-src[^;]*/);
    assert.ok(imgSrc, `CSP must declare img-src: ${csp}`);
    assert.match(imgSrc![0], /https:\/\/res\.cloudinary\.com/);
    assert.match(imgSrc![0], /'self'/);
  });

  it("rejects an anonymous read of the DB-backed image restore route", async () => {
    // The regression: this used to return the image to anyone.
    for (const ref of ["about", "logo", "product:1"]) {
      const res = await fetch(`${base}/api/images/${encodeURIComponent(ref)}`, {
        signal: AbortSignal.timeout(30000),
      });
      assert.equal(res.status, 401, `GET /api/images/${ref} must require authentication, got ${res.status}`);
    }
  });

  it("rejects a bogus bearer token on the restore route", async () => {
    const res = await fetch(`${base}/api/images/about`, {
      headers: { Authorization: "Bearer not-a-real-token" },
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(res.status, 401, `expected 401 for an invalid token, got ${res.status}`);
  });

  it("lets an authenticated operator reach the restore route", async () => {
    // 404 (no such ref) rather than 401 proves the auth chain passed; the suite
    // does not need to seed a stored image to assert authorization.
    const res = await fetch(`${base}/api/images/about`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(res.status, 404, `expected 404 for a missing ref behind auth, got ${res.status}`);
  });
});
