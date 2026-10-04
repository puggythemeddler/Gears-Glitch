import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Server } from "http";

import financingRouter from "../server/routes/financing";

// Every :id in the financing router is interpolated into a numeric SQL
// comparison. Before the router.param guard, a non-numeric id reached Postgres
// as NaN and surfaced as HTTP 500 ("invalid input syntax for type bigint"),
// which is a server fault rather than a client mistake.
//
// router.param runs after the route matches but before its handler stack, so
// these cases need no database and no session: the guard answers 400 first,
// and a well-formed id falls through to the auth middleware's 401. That
// ordering is asserted explicitly below so the guard can never be "fixed" into
// one that shadows authentication.
describe("financing :id validation (no DB required)", () => {
  let server: Server;
  let base = "";

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/financing", financingRouter);
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    base = `http://127.0.0.1:${port}/api/financing`;
  });

  after(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function status(path: string, method = "GET"): Promise<number> {
    const res = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : "{}",
    });
    await res.text();
    return res.status;
  }

  const BAD_IDS = ["not-a-number", "abc", "1.5", "null", "NaN", "1e", "%20", "0", "-1", "1 OR 1=1"];

  const ID_ROUTES: [string, string][] = [
    ["GET", "/agreements/:id"],
    ["GET", "/agreements/:id/agreement"],
    ["GET", "/agreements/:id/schedule"],
    ["GET", "/agreements/:id/statement"],
    ["POST", "/agreements/:id/release"],
    ["POST", "/agreements/:id/cancel"],
    ["POST", "/agreements/:id/payments"],
    ["POST", "/agreements/:id/adjustments"],
    ["POST", "/agreements/:id/mpesa"],
    ["GET", "/applications/:id"],
    ["PATCH", "/applications/:id"],
    ["POST", "/applications/:id/submit"],
    ["POST", "/applications/:id/approve"],
    ["POST", "/payments/:id/reverse"],
    ["GET", "/payments/:id/receipt"],
    ["GET", "/my/agreements/:id"],
    ["POST", "/my/agreements/:id/mpesa"],
    ["GET", "/my/agreements/:id/agreement"],
    ["GET", "/my/agreements/:id/statement"],
    ["GET", "/my/payments/:id/receipt"],
  ];

  it("declares the :id guard before any route", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "..", "server", "routes", "financing.ts"),
      "utf8"
    ) as string;
    const guard = src.indexOf('router.param("id"');
    const firstRoute = src.indexOf("router.get(");
    assert.ok(guard !== -1, "router.param(\"id\") guard is missing");
    assert.ok(guard < firstRoute, "the :id guard must be registered before the routes");
  });

  for (const [method, template] of ID_ROUTES) {
    it(`rejects a non-numeric id on ${method} ${template} with 400`, async () => {
      const path = template.replace(":id", "not-a-number");
      assert.equal(await status(path, method), 400, `${method} ${path} should be a client error`);
    });
  }

  it("rejects zero, negative and fractional ids", async () => {
    for (const bad of ["0", "-1", "1.5"]) {
      assert.equal(await status(`/agreements/${bad}`), 400, `/agreements/${bad} should be a client error`);
    }
  });

  it("never lets a malformed id reach the database as NaN", async () => {
    // "null" was the literal that produced HTTP 500 in production.
    assert.equal(await status("/agreements/null"), 400);
    assert.equal(await status("/my/agreements/null"), 400);
  });

  it("leaves a well-formed id alone so authentication still decides", async () => {
    // 401 (not 400): the guard must not shadow auth on a valid id.
    assert.equal(await status("/agreements/1"), 401);
    assert.equal(await status("/my/agreements/1"), 401);
  });
});