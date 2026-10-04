import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getPool, queryOne, runSchema } from "../server/db-helpers";
import { registerCustomer, loginCustomer, verifyToken } from "../server/auth";

const HAS_DB = !!process.env.DATABASE_URL;

// signToken()/verifyToken() refuse to run without a strong secret.
process.env.JWT_SECRET = process.env.JWT_SECRET || "qa-customer-reg-test-secret-7d4b2f9a6c1e";

// The storefront login form has always advertised "No account? Enter a name and
// we'll create one", but the name was never sent anywhere: the customer branch
// posted only { email, password } to /api/customer/login. A new customer
// therefore got a bare 401 and no account was ever created, while
// POST /api/customer/register sat unused with no UI caller.
describe("customer self-registration", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const emailFor = (tag: string) => `${tag}-${runId}@example.com`;

  before(async () => {
    getPool();
    await runSchema(fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8"));
  });

  it("creates the account and returns a usable customer token", async () => {
    const email = emailFor("reg-ok");
    const res = await registerCustomer({ name: "Asha New", email, password: "Customer12345!" });

    assert.equal(res.ok, true, `registration failed: ${res.error}`);
    assert.ok(res.token, "a session token is required");
    assert.equal(res.name, "Asha New");

    const row = await queryOne("SELECT id, name, email FROM customers WHERE email = $1", [email]);
    assert.ok(row, "the customer row must exist");
    assert.equal(row.name, "Asha New");

    const claims = verifyToken(res.token!) as any;
    assert.equal(claims.role, "customer");
    assert.equal(Number(claims.sub), Number(row.id));
    assert.equal(claims.email, email);
  });

  it("lets the new customer sign in immediately afterwards", async () => {
    const email = emailFor("reg-login");
    await registerCustomer({ name: "Biko New", email, password: "Customer12345!" });

    const login = await loginCustomer(email, "Customer12345!");
    assert.equal(login.ok, true, `login failed: ${login.error}`);
    assert.equal(login.name, "Biko New");

    const row = await queryOne("SELECT id FROM customers WHERE email = $1", [email]);
    assert.equal(Number((login as any).id ?? Number(verifyToken(login.token!).sub)), Number(row.id));
  });

  it("stores the address lower-cased so case cannot fork an account", async () => {
    const email = emailFor("reg-case");
    const created = await registerCustomer({ name: "Case Test", email: email.toUpperCase(), password: "Customer12345!" });
    assert.equal(created.ok, true, `registration failed: ${created.error}`);

    const stored = await queryOne("SELECT email FROM customers WHERE lower(email) = $1", [email]);
    assert.ok(stored, "the customer row must exist");
    assert.equal(stored.email, email, "the address must be stored lower-cased");

    // The same address typed with different case must not create a second account.
    const again = await registerCustomer({ name: "Case Test 2", email, password: "Customer12345!" });
    assert.equal(again.ok, false, "a differently-cased duplicate must be refused");
  });

  it("refuses a duplicate address", async () => {
    const email = emailFor("reg-dup");
    const first = await registerCustomer({ name: "First Owner", email, password: "Customer12345!" });
    assert.equal(first.ok, true);

    const second = await registerCustomer({ name: "Second Owner", email, password: "Customer12345!" });
    assert.equal(second.ok, false);
    assert.match(String(second.error), /already exists/i);
  });

  it("requires a name and an 8+ character password", async () => {
    assert.equal((await registerCustomer({ name: "", email: emailFor("reg-noname"), password: "Customer12345!" })).ok, false);
    assert.equal((await registerCustomer({ name: "No Password", email: emailFor("reg-shortpw"), password: "short" })).ok, false);
    assert.equal((await registerCustomer({ name: "No Email", email: "", password: "Customer12345!" })).ok, false);
  });

  it("does not reveal whether an address is registered when the password is wrong", async () => {
    const email = emailFor("reg-enum");
    await registerCustomer({ name: "Enum Target", email, password: "Customer12345!" });

    const wrongPassword = await loginCustomer(email, "WrongPassword1!");
    const noSuchUser = await loginCustomer(emailFor("reg-ghost"), "WrongPassword1!");

    assert.equal(wrongPassword.ok, false);
    assert.equal(noSuchUser.ok, false);
    assert.equal(
      wrongPassword.error,
      noSuchUser.error,
      "a wrong password and an unknown address must be indistinguishable"
    );
  });
});

// The form wiring itself: the name must actually reach the register endpoint,
// and a failed registration must surface the original login error so a taken
// address is never disclosed.
describe("customer login form wiring", () => {
  const read = (rel: string): string => readFileSync(join(__dirname, "..", rel), "utf8");
  const loginPage = read("frontend/pages/login.tsx");

  it("falls back to /api/customer/register with the entered name", () => {
    assert.match(loginPage, /\/api\/customer\/register/);
    const call = loginPage.slice(loginPage.indexOf("/api/customer/register"));
    assert.match(call.slice(0, 260), /name:\s*name\.trim\(\)/, "the entered name must be sent to the server");
  });

  it("only registers after a failed sign-in and only when a name was given", () => {
    assert.match(loginPage, /catch \(loginErr: any\)/, "registration must hang off the failed sign-in");
    // The gate is the shared predicate: a non-blank name *and* a credential
    // rejection. See customer-signup-fallback.test.ts for the status matrix.
    assert.match(
      loginPage,
      /if \(!shouldAttemptCustomerRegistration\(loginErr, name\)\) throw loginErr;/,
      "a blank name or a non-401 failure must not trigger registration"
    );
  });

  it("reports the original sign-in error instead of leaking that the address exists", () => {
    assert.match(
      loginPage,
      /catch \{[\s\S]{0,400}throw loginErr;/,
      "a failed registration must rethrow the login error, not the register error"
    );
  });

  it("keeps the promise the UI makes to the customer", () => {
    assert.match(loginPage, /we&apos;ll create one/);
    assert.match(loginPage, /Name \(for new accounts\)/);
  });
});