import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getBearerToken } from "../server/auth";
import type { Request } from "express";

// A-1/AZ1: the session token is accepted from the httpOnly cookie or Bearer
// header, and from the query string ONLY when the requester explicitly opts in
// with allowQueryToken=1 (used by new-tab receipt/invoice print links). The
// query path must never be the default — a URL/referrer/log leak alone must not
// authenticate a request. Static and DB-free so it runs everywhere.
const req = (over: Partial<Request> = {}): Request =>
  ({
    headers: { authorization: "" },
    query: {},
    cookies: {},
    method: "GET",
    path: "/api/orders/123/invoice",
    ...over,
  }) as unknown as Request;

describe("session token sources (AZ1)", () => {
  it("rejects a query token without the explicit allowQueryToken=1 opt-in", () => {
    assert.equal(getBearerToken(req({ query: { token: "leaked-jwt" } })), null);
  });

  it("rejects empty / non-string query tokens even with the opt-in", () => {
    assert.equal(getBearerToken(req({ query: { allowQueryToken: "1", token: "" } })), null);
    assert.equal(getBearerToken(req({ query: { allowQueryToken: "1" } })), null);
  });

  it("accepts a query token only with allowQueryToken=1", () => {
    assert.equal(
      getBearerToken(req({ query: { allowQueryToken: "1", token: "scoped-print-token" } })),
      "scoped-print-token"
    );
  });

  it("prefers the Bearer header and the httpOnly cookie over the query token", () => {
    const withHeader = req({
      headers: { authorization: "Bearer header-token" },
      query: { allowQueryToken: "1", token: "query-token" },
    });
    assert.equal(getBearerToken(withHeader), "header-token");

    const withCookie = req({ cookies: { gg_session: "cookie-token" } });
    assert.equal(getBearerToken(withCookie), "cookie-token");
  });
});