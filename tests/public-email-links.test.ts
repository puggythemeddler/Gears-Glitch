import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { publicBaseUrl } from "../server/public-url";

// Every link a customer clicks in an email has to resolve to the frontend.
// On a split deployment the API origin serves no HTML, so a link built from
// BASE_URL 404s - which is how a split deployment ended up mailing customers
// password resets and "view your order" links that could never work.
//
// These tests pin both halves: the helper's behaviour, and the source scan
// that stops a new BASE_URL link from creeping back in.
describe("publicBaseUrl", () => {
  const saved = { f: process.env.FRONTEND_URL, b: process.env.BASE_URL };

  // Each case sets both variables explicitly: node:test runs these in order in
  // one process, so a value left behind by an earlier case leaks into the next.
  function setEnv(frontend?: string, base?: string) {
    if (frontend === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = frontend;
    if (base === undefined) delete process.env.BASE_URL;
    else process.env.BASE_URL = base;
  }

  before(() => setEnv());
  after(() => {
    if (saved.f === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = saved.f;
    if (saved.b === undefined) delete process.env.BASE_URL;
    else process.env.BASE_URL = saved.b;
  });

  it("prefers FRONTEND_URL, because the storefront is not the API", () => {
    setEnv("https://shop.example", "https://api.example");
    assert.equal(publicBaseUrl(), "https://shop.example");
  });

  it("falls back to BASE_URL when FRONTEND_URL is unset", () => {
    setEnv(undefined, "https://api.example");
    assert.equal(publicBaseUrl(), "https://api.example");
  });

  it("strips a trailing slash so callers can append /path", () => {
    setEnv("https://shop.example/", undefined);
    assert.equal(publicBaseUrl(), "https://shop.example");
    assert.equal(publicBaseUrl() + "/order?id=1", "https://shop.example/order?id=1");
  });

  it("keeps the caller's dev fallback when nothing is configured", () => {
    setEnv();
    assert.equal(publicBaseUrl(), "");
    assert.equal(publicBaseUrl("http://localhost:3000"), "http://localhost:3000");
  });

  it("ignores a blank FRONTEND_URL rather than emitting a /path-only link", () => {
    setEnv("   ", "https://api.example");
    assert.equal(publicBaseUrl(), "https://api.example");
  });
});

describe("email links point at the frontend", () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

  // The single legitimate BASE_URL reference left in these files is the CORS
  // allowlist, which whitelists the frontend's *origin* rather than linking to
  // it. Everything else must go through publicBaseUrl().
  it("index.ts keeps BASE_URL only for the CORS allowlist", () => {
    const offenders = read("server/index.ts")
      .split("\n")
      .map((l, i) => ({ n: i + 1, l }))
      .filter(({ l }) => l.includes("process.env.BASE_URL") && !l.includes("FRONTEND_URL"))
      .filter(({ l }) => !/new URL\(process\.env\.BASE_URL\)/.test(l));
    assert.deepEqual(
      offenders.map((o) => `L${o.n}: ${o.l.trim()}`),
      [],
      "email/UI links must use publicBaseUrl(), not BASE_URL"
    );
  });

  it("notify.ts has no direct BASE_URL reference", () => {
    const offenders = read("server/notify.ts")
      .split("\n")
      .map((l, i) => ({ n: i + 1, l }))
      .filter(({ l }) => l.includes("process.env.BASE_URL"));
    assert.deepEqual(offenders.map((o) => `L${o.n}`), []);
  });

  it("the known user-facing link sites all route through the helper", () => {
    const idx = read("server/index.ts");
    // Password reset, magic link, admin reset.
    for (const route of ["/account?magic=", "/account?adminReset=", "/account?reset="]) {
      assert.ok(
        idx.includes(`\${publicBaseUrl()}${route}`),
        `${route} must be built from publicBaseUrl()`
      );
    }
    // Order status, credit note, quotes, message notifications.
    for (const route of ["/order?id=", "/dashboard"]) {
      assert.ok(
        idx.includes(`\${publicBaseUrl("http://localhost:3000")}${route}`),
        `${route} must be built from publicBaseUrl()`
      );
    }
    // Cart recovery binds the base once, then interpolates the variable.
    assert.match(
      idx,
      /const baseUrl = publicBaseUrl\("http:\/\/localhost:3000"\);/,
      "the cart-recovery base URL must come from publicBaseUrl()"
    );
    // Provider portal links in the notification templates.
    const notifySrc = read("server/notify.ts");
    assert.ok(
      notifySrc.includes('${esc(publicBaseUrl("http://localhost:8020"))}/provider/'),
      "provider portal links must be built from publicBaseUrl()"
    );
  });

  it("server-to-server callbacks still target the API, not the frontend", () => {
    // Guarded deliberately: the OAuth redirect and the M-Pesa callback are
    // endpoints on this server. "Fixing" them to the frontend would break both.
    assert.match(
      read("server/gmail.ts"),
      /process\.env\.BASE_URL[\s\S]{0,120}integrations\/gmail\/callback/,
      "the Gmail OAuth redirect must keep using BASE_URL"
    );
    assert.match(
      read("server/mpesa.ts"),
      /MPESA_CALLBACK_URL \|\| process\.env\.BASE_URL/,
      "the M-Pesa callback must keep using BASE_URL"
    );
  });
});
