import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseAllowedOrigins,
  normalizeOrigin,
  normalizeHost,
  isOriginAllowed,
  corsPolicyMiddleware,
} from "../server/cors-policy";

describe("parseAllowedOrigins", () => {
  it("returns [] for undefined / empty input", () => {
    assert.deepEqual(parseAllowedOrigins(undefined), []);
    assert.deepEqual(parseAllowedOrigins(""), []);
    assert.deepEqual(parseAllowedOrigins("   ,, , "), []);
  });

  it("splits, trims, and drops empties", () => {
    assert.deepEqual(parseAllowedOrigins(" https://cp.example.com ,http://localhost:4001, ,"),
      ["https://cp.example.com", "http://localhost:4001"]);
  });
});

describe("normalizeOrigin", () => {
  it("lowercases the host", () => {
    assert.equal(normalizeOrigin("https://Cp.Example.COM"), "cp.example.com");
  });

  it("keeps explicit non-default ports", () => {
    assert.equal(normalizeOrigin("http://localhost:4000/"), "localhost:4000");
  });

  it("drops the default port", () => {
    assert.equal(normalizeOrigin("https://cp.example.com:443"), "cp.example.com");
  });

  it("fails closed on unparseable or empty input", () => {
    assert.equal(normalizeOrigin("not a url"), "");
    assert.equal(normalizeOrigin(""), "");
  });
});

describe("normalizeHost", () => {
  it("passes a bare host through", () => {
    assert.equal(normalizeHost("cp.example.com"), "cp.example.com");
  });

  it("strips scheme, path, and case", () => {
    assert.equal(normalizeHost("HTTPS://Cp.Example.COM/some/path"), "cp.example.com");
  });

  it("keeps a port", () => {
    assert.equal(normalizeHost("localhost:4000"), "localhost:4000");
  });
});

describe("isOriginAllowed", () => {
  it("allows requests with no Origin header (same-origin / curl / server-to-server)", () => {
    assert.equal(isOriginAllowed(undefined, undefined, []), true);
  });

  it("allows an origin matching the request Host (same origin)", () => {
    assert.equal(isOriginAllowed("https://cp.example.com", "cp.example.com", []), true);
    assert.equal(isOriginAllowed("http://localhost:4000", "localhost:4000", []), true);
  });

  it("allows an allowlisted origin", () => {
    assert.equal(isOriginAllowed("https://cp.example.com", "unrelated.example.com", ["https://cp.example.com"]), true);
  });

  it("matches the allowlist case-insensitively and tolerates trailing slashes", () => {
    assert.equal(isOriginAllowed("https://CP.Example.COM", "ios-api.example.org", ["https://cp.example.com/"]), true);
  });

  it("rejects a foreign origin not in the allowlist", () => {
    assert.equal(isOriginAllowed("https://evil.example.org", "cp.example.com", []), false);
    assert.equal(isOriginAllowed("https://evil.example.org", "cp.example.com", ["https://cp.example.com"]), false);
  });

  it("rejects an unparseable origin even when allowlisted garbage is present", () => {
    assert.equal(isOriginAllowed("not a url", "cp.example.com", ["https://cp.example.com"]), false);
  });
});

function mockRes() {
  return {
    _headers: {} as Record<string, string>,
    _status: 200,
    _ended: false,
    vary() {},
    setHeader(k: string, v: string) { this._headers[k.toLowerCase()] = v; },
    status(c: number) { this._status = c; return this; },
    end() { this._ended = true; },
  };
}

describe("corsPolicyMiddleware", () => {
  it("reflects only allowed / same-origin requests on the plain path", () => {
    const mw = corsPolicyMiddleware(["https://cp.example.com"]);
    let hit = false;
    const res = mockRes() as any;

    mw({ headers: { origin: "http://localhost:4000", host: "localhost:4000" }, method: "GET" } as any, res, () => { hit = true; });
    assert.equal(hit, true);
    assert.equal(res._headers["access-control-allow-origin"], "http://localhost:4000");
    assert.equal(res._headers["access-control-allow-credentials"], "true");

    hit = false;
    mw({ headers: { origin: "https://cp.example.com", host: "cp.example.com" }, method: "GET" } as any, res, () => { hit = true; });
    assert.equal(hit, true);
    assert.equal(res._headers["access-control-allow-origin"], "https://cp.example.com");
  });

  it("sets no CORS headers for a foreign origin on the plain path", () => {
    const mw = corsPolicyMiddleware(["https://cp.example.com"]);
    const res = mockRes() as any;
    const fresh = () => mockRes() as any;

    const foreign = fresh();
    let hit = false;
    mw({ headers: { origin: "https://evil.example.org", host: "cp.example.com" }, method: "GET" } as any, foreign, () => { hit = true; });
    assert.equal(hit, true);
    assert.equal(foreign._headers["access-control-allow-origin"], undefined);
    assert.equal(foreign._headers["access-control-allow-credentials"], undefined);

    const noOrigin = fresh();
    hit = false;
    mw({ headers: { host: "cp.example.com" }, method: "GET" } as any, noOrigin, () => { hit = true; });
    assert.equal(hit, true);
    assert.equal(noOrigin._headers["access-control-allow-origin"], undefined);
  });

  it("answers allowed preflights with the permission headers", () => {
    const mw = corsPolicyMiddleware(["https://cp.example.com"]);
    const res = mockRes() as any;
    const req = {
      headers: { origin: "https://cp.example.com", host: "cp.example.com", "access-control-request-headers": "authorization, content-type" },
      method: "OPTIONS",
    } as any;
    mw(req, res, () => { throw new Error("next must not run for preflight"); });
    assert.equal(res._status, 204);
    assert.equal(res._ended, true);
    assert.equal(res._headers["access-control-allow-origin"], "https://cp.example.com");
    assert.equal(res._headers["access-control-allow-credentials"], "true");
    assert.equal(res._headers["access-control-allow-methods"], "GET,HEAD,PUT,PATCH,POST,DELETE");
    assert.equal(res._headers["access-control-allow-headers"], "authorization, content-type");
    assert.equal(res._headers["access-control-max-age"], "86400");
  });

  it("answers disallowed preflights without any permission headers", () => {
    const mw = corsPolicyMiddleware(["https://cp.example.com"]);
    const res = mockRes() as any;
    const req = { headers: { origin: "https://evil.example.org", host: "cp.example.com" }, method: "OPTIONS" } as any;
    mw(req, res, () => { throw new Error("next must not run for preflight"); });
    assert.equal(res._status, 204);
    assert.equal(res._ended, true);
    assert.equal(res._headers["access-control-allow-origin"], undefined);
    assert.equal(res._headers["access-control-allow-headers"], undefined);
  });

  it("answers same-origin preflights from any allowed host", () => {
    const mw = corsPolicyMiddleware([]);
    const res = mockRes() as any;
    const req = { headers: { origin: "http://localhost:4000", host: "localhost:4000" }, method: "OPTIONS" } as any;
    mw(req, res, () => { throw new Error("next must not run for preflight"); });
    assert.equal(res._status, 204);
    assert.equal(res._headers["access-control-allow-origin"], "http://localhost:4000");
  });
});