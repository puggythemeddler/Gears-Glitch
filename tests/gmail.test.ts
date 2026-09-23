import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  signGmailState,
  verifyGmailState,
  buildGmailAuthUrl,
  getOAuthStateSecret,
  getGmailRedirectUri,
  isGmailOAuthError,
  GMAIL_STATE_TTL_MS,
} from "../server/gmail";

const SECRET = "unit-test-gmail-strong-secret-0123456789";

beforeEach(() => {
  process.env.JWT_SECRET = "unit-test-gmail-strong-secret-0123456789";
  process.env.BASE_URL = "https://store.example.com";
  delete process.env.GMAIL_OAUTH_REDIRECT_URI;
  delete process.env.FRONTEND_URL;
});

describe("gmail oauth state", () => {
  it("signs and verifies a valid state round-trip", () => {
    const state = signGmailState(SECRET, { purpose: "gmail", ts: Date.now() });
    const verified = verifyGmailState(state, SECRET);
    assert.ok(verified, "state must verify");
    assert.equal(verified!.purpose, "gmail");
  });

  it("rejects a tampered signature", () => {
    const state = signGmailState(SECRET, { purpose: "gmail", ts: Date.now() });
    const tampered = state.slice(0, -2) + (state.endsWith("AA") ? "BB" : "AA");
    assert.equal(verifyGmailState(tampered, SECRET), null);
  });

  it("rejects a state signed with a different secret", () => {
    const state = signGmailState("secret-a", { purpose: "gmail", ts: Date.now() });
    assert.equal(verifyGmailState(state, "secret-b"), null);
  });

  it("rejects an expired state", () => {
    const state = signGmailState(SECRET, { purpose: "gmail", ts: Date.now() - GMAIL_STATE_TTL_MS - 1000 });
    assert.equal(verifyGmailState(state, SECRET), null);
  });

  it("rejects a wrong-purpose state", () => {
    const bad = Buffer.from(JSON.stringify({ purpose: "login", ts: Date.now() })).toString("base64url") + "." + "x".repeat(10);
    assert.equal(verifyGmailState(bad, SECRET), null);
  });

  it("rejects garbage input without throwing", () => {
    assert.equal(verifyGmailState(undefined, SECRET), null);
    assert.equal(verifyGmailState("", SECRET), null);
    assert.equal(verifyGmailState("no-dot-no-sig", SECRET), null);
    assert.equal(verifyGmailState("a.b", SECRET), null);
  });

  it("throws only when JWT_SECRET is missing or a known placeholder", () => {
    delete process.env.JWT_SECRET;
    assert.throws(() => getOAuthStateSecret());
    process.env.JWT_SECRET = "change-this-to-a-long-random-string";
    assert.throws(() => getOAuthStateSecret());
    process.env.JWT_SECRET = SECRET;
    assert.equal(getOAuthStateSecret(), SECRET);
  });
});

describe("gmail auth url", () => {
  it("builds a consent URL with offline access and gmail.send scope", () => {
    const url = buildGmailAuthUrl("client-123.apps.googleusercontent.com", "https://store.example.com/api/integrations/gmail/callback", "state-token");
    const parsed = new URL(url);
    assert.equal(parsed.origin, "https://accounts.google.com");
    assert.equal(parsed.searchParams.get("client_id"), "client-123.apps.googleusercontent.com");
    assert.equal(parsed.searchParams.get("redirect_uri"), "https://store.example.com/api/integrations/gmail/callback");
    assert.equal(parsed.searchParams.get("state"), "state-token");
    assert.equal(parsed.searchParams.get("response_type"), "code");
    assert.equal(parsed.searchParams.get("access_type"), "offline");
    assert.equal(parsed.searchParams.get("prompt"), "consent");
    const scope = parsed.searchParams.get("scope") || "";
    assert.ok(scope.includes("gmail.send"), scope);
    assert.ok(scope.includes("email"), scope);
  });

  it("does not leak a client secret into the URL", () => {
    const url = buildGmailAuthUrl("client-id", "redirect", "state");
    assert.ok(!url.includes("clientSecret"), url);
    assert.ok(!url.includes("secret"), url);
  });
});

describe("gmail redirect uri", () => {
  it("derives the callback from BASE_URL when not overridden", () => {
    assert.equal(getGmailRedirectUri(), "https://store.example.com/api/integrations/gmail/callback");
  });

  it("honors an explicit override", () => {
    process.env.GMAIL_OAUTH_REDIRECT_URI = "https://redirect.example.com/cb";
    assert.equal(getGmailRedirectUri(), "https://redirect.example.com/cb");
  });
});

describe("gmail oauth error detection", () => {
  it("classifies credential errors", () => {
    assert.equal(isGmailOAuthError(new Error("invalid_grant: Bad Request")), true);
    assert.equal(isGmailOAuthError(new Error("Error: invalid_grant")), true);
    assert.equal(isGmailOAuthError(new Error("unauthorized_client")), true);
    assert.equal(isGmailOAuthError(new Error("550 5.7.0 rejected")), false);
    assert.equal(isGmailOAuthError(new Error("ECONNREFUSED")), false);
    assert.equal(isGmailOAuthError(undefined), false);
  });
});