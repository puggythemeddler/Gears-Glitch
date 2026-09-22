import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import { adminAuthMiddleware } from "../server/auth";
import { requirePermission } from "../server/routes/shared";

// The Pages admin API is protected by `adminAuthMiddleware` plus
// `requirePermission("settings:view" | "settings:update")`. These tests exercise
// those real middleware functions (not fakes) on their DB-free paths so the
// unauthenticated (401) and unauthorized/missing-role (403) contract is pinned
// everywhere, including in CI without DATABASE_URL.

function mockRes() {
  const res: any = {
    statusCode: 200,
    sent: null,
    status(code: number) { res.statusCode = code; return res; },
    json(payload: any) { res.sent = payload; return res; },
  };
  return res;
}

const authReq = (over: any = {}): Request =>
  ({ headers: {}, cookies: {}, query: {}, ...over }) as unknown as Request;

describe("pages admin API security", () => {
  it("admin list/create/update/delete reject a request with no session token (401)", async () => {
    for (const middleware of [
      adminAuthMiddleware,
    ]) {
      const res = mockRes();
      let nextCalled = false;
      await middleware(authReq({ headers: { authorization: "" } }), res, (() => { nextCalled = true; }) as NextFunction);
      assert.equal(res.statusCode, 401, `expected 401, got ${res.statusCode}`);
      assert.ok(res.sent?.error?.length > 0, "401 response includes an error message");
      assert.equal(nextCalled, false, "middleware must not advance past an unauthenticated request");
    }
  });

  it("Bearer/cookie tokens are not accepted without a request going to auth (no token → guard before token decoding)", async () => {
    // Sanity: getBearerToken returns null when nothing is supplied, so the
    // middleware rejects before any session verification/DB access.
    const res = mockRes();
    const { getBearerToken } = await import("../server/auth");
    assert.equal(getBearerToken(authReq()), null);
    let nextCalled = false;
    await adminAuthMiddleware(authReq(), res, (() => { nextCalled = true; }) as NextFunction);
    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
  });

  it("requirePermission rejects a request without a staff identity (403, missing permission)", async () => {
    const { isStr } = await import("../server/routes/shared");
    assert.equal(typeof isStr, "function", "shared module loads without side effects");
    for (const permission of ["settings:view", "settings:update"]) {
      const res = mockRes();
      let nextCalled = false;
      await requirePermission(permission)(
        authReq({ user: {} }) as Request,
        res,
        (() => { nextCalled = true; }) as NextFunction
      );
      assert.equal(res.statusCode, 403, `expected 403 for ${permission}, got ${res.statusCode}`);
      assert.ok(/Missing permission|settings/.test(res.sent?.error || ""), "403 response names the missing permission");
      assert.equal(nextCalled, false, "missing permission must not advance the request");
    }
  });
});