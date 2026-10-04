import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

// The customer tab of /login doubles as the sign-up form, so a failed login
// falls through to POST /api/customer/register. That fallback is only correct
// for a credential rejection.
//
// The failure it used to catch was `catch (loginErr) { if (!name.trim()) throw
// loginErr; ... }` - i.e. ANY failure. A 500, a dead database or a dropped
// connection all created an account instead of reporting the outage.
//
// These tests pin the decision function and the wiring that uses it.
import { ApiError } from "../frontend/lib/api";
import {
  isCredentialRejection,
  shouldAttemptCustomerRegistration,
} from "../frontend/lib/customer-signup";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

// What fetch() throws when the request never reaches the server, and what a
// non-Error rejection can look like. Neither carries an HTTP status.
const networkFailure = () => new TypeError("fetch failed");
const databaseFailureSurfacing = () => new Error("connection terminated unexpectedly");

describe("customer sign-up fallback is restricted to credential rejections", () => {
  it("1. new customer + name + HTTP 401 -> attempt registration", () => {
    const err = new ApiError("Invalid email or password.", 401);
    assert.equal(shouldAttemptCustomerRegistration(err, "Asha New"), true);
  });

  it("2. existing customer + wrong password (401) -> registration is attempted but cannot succeed", () => {
    // The gate passes, register then fails on the duplicate address, and the
    // form rethrows the *login* error. The decision function cannot know the
    // account exists - that is deliberate: probing it would leak whether an
    // address is registered. The non-enumeration guarantee is asserted below.
    const err = new ApiError("Invalid email or password.", 401);
    assert.equal(shouldAttemptCustomerRegistration(err, "Somebody Else"), true);
  });

  it("3. login endpoint 500 -> no registration attempt", () => {
    for (const status of [500, 502, 503, 504]) {
      assert.equal(
        shouldAttemptCustomerRegistration(new ApiError("Internal server error", status), "Asha New"),
        false,
        `HTTP ${status} must never create an account`
      );
    }
  });

  it("4. database failure -> no registration attempt", () => {
    // A driver-level failure that escaped to the generic 500 handler, and the
    // un-statused error shape a raw rejection would have.
    assert.equal(shouldAttemptCustomerRegistration(databaseFailureSurfacing(), "Asha New"), false);
    assert.equal(isCredentialRejection(databaseFailureSurfacing()), false);
  });

  it("5. network/transport failure -> no registration attempt", () => {
    assert.equal(shouldAttemptCustomerRegistration(networkFailure(), "Asha New"), false);
    assert.equal(isCredentialRejection(networkFailure()), false);
    // Also the shapes a bundler/runtime can produce for an aborted request.
    assert.equal(isCredentialRejection(new DOMException("aborted", "AbortError")), false);
    assert.equal(isCredentialRejection(undefined), false);
    assert.equal(isCredentialRejection(null), false);
    assert.equal(isCredentialRejection("Invalid email or password."), false);
  });

  it("6. successful login never reaches the fallback at all", () => {
    // handleSubmit only consults the gate inside `catch`, so a resolved login
    // cannot reach it. Assert that structurally rather than behaviourally.
    const page = read("frontend/pages/login.tsx");
    const gate = page.indexOf("shouldAttemptCustomerRegistration(loginErr, name)");
    assert.ok(gate > 0, "the gate must be present in handleSubmit");
    const tryIdx = page.lastIndexOf("try {", gate);
    const catchIdx = page.indexOf("} catch (loginErr: any) {", tryIdx);
    assert.ok(tryIdx > 0 && catchIdx > tryIdx, "expected a try/catch around the login call");
    assert.ok(gate > catchIdx, "the gate must live in the catch block, not the success path");
    assert.match(page, /await finishCustomerLogin\(data\.token, data\.name \|\| "Customer"\);/);
  });

  it("does not fall back for the other non-401 statuses /api/customer/login can return", () => {
    // 400 invalid input, 403 CSRF, 429 rate limited/locked out.
    for (const status of [400, 403, 408, 409, 422, 429]) {
      assert.equal(
        shouldAttemptCustomerRegistration(new ApiError("nope", status), "Asha New"),
        false,
        `HTTP ${status} must not be treated as "no such account"`
      );
    }
  });

  it("requires a name even for a real 401", () => {
    assert.equal(shouldAttemptCustomerRegistration(new ApiError("Invalid email or password.", 401), ""), false);
    assert.equal(shouldAttemptCustomerRegistration(new ApiError("Invalid email or password.", 401), "   "), false);
    assert.equal(shouldAttemptCustomerRegistration(new ApiError("Invalid email or password.", 401), "Asha"), true);
  });

  it("matches on status, not on the server's wording", () => {
    // A 500 whose body happens to contain the credential message must not be
    // mistaken for a rejection, and an unusual 401 message must still count.
    assert.equal(shouldAttemptCustomerRegistration(new ApiError("Invalid email or password.", 500), "Asha"), false);
    assert.equal(shouldAttemptCustomerRegistration(new ApiError("Too many failed attempts.", 401), "Asha"), true);
  });

  it("keeps a plain Error from a non-api() caller out of the fallback", () => {
    assert.equal(isCredentialRejection(new Error("Invalid email or password.")), false);
    // Simulates a bare `throw new Error(...)` losing the status in a refactor.
    assert.equal(shouldAttemptCustomerRegistration(new Error("boom"), "Asha New"), false);
  });

  it("login.tsx consults the shared gate rather than an inline status check", () => {
    const page = read("frontend/pages/login.tsx");
    assert.match(page, /import \{ shouldAttemptCustomerRegistration \} from "@\/lib\/customer-signup";/);
    assert.match(page, /if \(!shouldAttemptCustomerRegistration\(loginErr, name\)\) throw loginErr;/);
    // The old permissive form must not come back.
    assert.doesNotMatch(page, /if \(!name\.trim\(\)\) throw loginErr;/);
  });

  it("a failed registration still rethrows the login error (no address enumeration)", () => {
    const page = read("frontend/pages/login.tsx");
    const regIdx = page.indexOf("/api/customer/register");
    assert.ok(regIdx > 0, "the register call must exist");
    const catchIdx = page.indexOf("} catch {", regIdx);
    assert.ok(catchIdx > regIdx, "the register call must be wrapped in its own try");
    const after = page.slice(catchIdx, catchIdx + 400);
    assert.match(after, /throw loginErr;/, "must surface the login error, never the register error");
  });

  it("ApiError carries the status that the decision depends on", () => {
    const err = new ApiError("boom", 503);
    assert.ok(err instanceof Error, "must stay catchable as a normal Error");
    assert.equal(err.message, "boom");
    assert.equal(err.status, 503);
    assert.equal(err.name, "ApiError");
  });

  it("api() throws ApiError with the response status", () => {
    const src = read("frontend/lib/api.ts");
    assert.match(src, /export class ApiError extends Error/);
    assert.match(src, /throw new ApiError\(data\?\.error \|\| `Request failed \(\$\{res\.status\}\)`, res\.status\);/);
  });
});