import { test } from "node:test";
import assert from "node:assert/strict";
import { mpesaTimestamp, normalizeDarajaPhone, callbackBaseUrl, isMpesaConfigured, updateMpesaConfig } from "../server/mpesa";

test("mpesaTimestamp produces a 14-digit yyyymmddHHmmss string", () => {
  const ts = mpesaTimestamp(new Date("2024-01-15T09:00:00.000Z"));
  assert.match(ts, /^\d{14}$/);
  assert.equal(ts, "20240115120000");
});

test("mpesaTimestamp is East Africa Time (UTC+3)", () => {
  // 23:30 UTC → 02:30 next day EAT (rollover across midnight).
  const ts = mpesaTimestamp(new Date("2024-06-01T23:30:00.000Z"));
  assert.equal(ts, "20240602023000");
});

test("mpesaTimestamp defaults to the current time", () => {
  const ts = mpesaTimestamp();
  const p = (n: number) => n;
  const y = p(Number(ts.slice(0, 4)));
  const mo = p(Number(ts.slice(4, 6))) - 1;
  const d = p(Number(ts.slice(6, 8)));
  const h = p(Number(ts.slice(8, 10)));
  const mi = p(Number(ts.slice(10, 12)));
  const s = p(Number(ts.slice(12, 14)));
  // The timestamp is EAT (UTC+3); rebuild the real UTC instant.
  const backToUtc = Date.UTC(y, mo, d, h, mi, s) - 3 * 60 * 60 * 1000;
  assert.ok(Math.abs(backToUtc - Date.now()) < 5000, `timestamp seconds-out-of-range: ${Math.abs(backToUtc - Date.now())}ms`);
});

test("normalizeDarajaPhone accepts 07XXXXXXXXX", () => {
  const r = normalizeDarajaPhone("0712345678");
  assert.equal(r.ok, true);
  assert.equal(r.phone, "254712345678");
});

test("normalizeDarajaPhone accepts 254XXXXXXXXX and strips formatting", () => {
  assert.equal(normalizeDarajaPhone("254712-345-678").phone, "254712345678");
  assert.equal(normalizeDarajaPhone("+254712345678").phone, "254712345678");
});

test("normalizeDarajaPhone rejects malformed numbers", () => {
  assert.equal(normalizeDarajaPhone("12345").ok, false);
  assert.equal(normalizeDarajaPhone("071234567").ok, false);
  assert.equal(normalizeDarajaPhone("25471234567").ok, false);
  assert.equal(normalizeDarajaPhone(null).ok, false);
  assert.equal(normalizeDarajaPhone("").ok, false);
});

test("callbackBaseUrl prefers MPESA_CALLBACK_URL over BASE_URL and request-derived host", () => {
  const prev = { cb: process.env.MPESA_CALLBACK_URL, base: process.env.BASE_URL };
  try {
    delete process.env.MPESA_CALLBACK_URL;
    delete process.env.BASE_URL;
    assert.equal(
      callbackBaseUrl({ protocol: "http", host: "localhost:8020" }),
      "http://localhost:8020"
    );
    process.env.BASE_URL = "https://store.example.com/";
    assert.equal(callbackBaseUrl({ protocol: "http", host: "localhost:8020" }), "https://store.example.com");
    process.env.MPESA_CALLBACK_URL = "https://cb.example.com/api/mpesa/callback";
    assert.equal(callbackBaseUrl({ protocol: "http", host: "localhost:8020" }), "https://cb.example.com/api/mpesa/callback");
  } finally {
    if (prev.cb === undefined) delete process.env.MPESA_CALLBACK_URL; else process.env.MPESA_CALLBACK_URL = prev.cb;
    if (prev.base === undefined) delete process.env.BASE_URL; else process.env.BASE_URL = prev.base;
  }
});

test("isMpesaConfigured requires consumerKey, consumerSecret, passkey and shortcode", () => {
  const prev = { key: process.env.MPESA_CONSUMER_KEY, secret: process.env.MPESA_CONSUMER_SECRET, passkey: process.env.MPESA_PASSKEY, shortcode: process.env.MPESA_SHORTCODE };
  try {
    delete process.env.MPESA_CONSUMER_KEY;
    delete process.env.MPESA_CONSUMER_SECRET;
    delete process.env.MPESA_PASSKEY;
    delete process.env.MPESA_SHORTCODE;
    updateMpesaConfig({ consumerKey: "", consumerSecret: "", passkey: "", shortcode: "174379" });
    // Missing passkey must NOT count as configured (D-3).
    updateMpesaConfig({ consumerKey: "ck", consumerSecret: "cs", passkey: "", shortcode: "174379" });
    assert.equal(isMpesaConfigured(), false);
    updateMpesaConfig({ consumerKey: "ck", consumerSecret: "cs", passkey: "pk", shortcode: "174379" });
    assert.equal(isMpesaConfigured(), true);
    updateMpesaConfig({ consumerKey: "ck", consumerSecret: "cs", passkey: "pk", shortcode: "" });
    assert.equal(isMpesaConfigured(), false);
    updateMpesaConfig({ consumerKey: "", consumerSecret: "", passkey: "", shortcode: "174379" });
  } finally {
    if (prev.key === undefined) delete process.env.MPESA_CONSUMER_KEY; else process.env.MPESA_CONSUMER_KEY = prev.key;
    if (prev.secret === undefined) delete process.env.MPESA_CONSUMER_SECRET; else process.env.MPESA_CONSUMER_SECRET = prev.secret;
    if (prev.passkey === undefined) delete process.env.MPESA_PASSKEY; else process.env.MPESA_PASSKEY = prev.passkey;
    if (prev.shortcode === undefined) delete process.env.MPESA_SHORTCODE; else process.env.MPESA_SHORTCODE = prev.shortcode;
    updateMpesaConfig({
      consumerKey: process.env.MPESA_CONSUMER_KEY || "",
      consumerSecret: process.env.MPESA_CONSUMER_SECRET || "",
      passkey: process.env.MPESA_PASSKEY || "",
      shortcode: process.env.MPESA_SHORTCODE || "174379",
    });
  }
});