// The /admin inline sign-in form runs its own login flow, separate from the
// /login page. When the branch picker landed on the server it was only wired
// into pages/login.tsx, so a multi-branch staff account signing in through the
// portal was handed no session: it stored `token === undefined`, set authed,
// and rendered the entire admin shell against 401s. These guards pin the
// branch-picker contract on the portal's own form.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = path.join(__dirname, "..");
const admin = fs.readFileSync(path.join(repo, "frontend/pages/admin.tsx"), "utf8");

describe("admin portal inline sign-in branch contract", () => {
  it("guards the requiresBranch response before storing any token", () => {
    const guardAt = admin.indexOf("data.requiresBranch");
    const storeAt = admin.indexOf('localStorage.setItem("computerStoreToken", data.token)');
    assert.notEqual(guardAt, -1, "handleLogin must branch on data.requiresBranch");
    assert.notEqual(storeAt, -1, "the normal path still stores the session token");
    assert.ok(
      guardAt < storeAt,
      "the requiresBranch guard must run before a token is stored, or a branch-select response would mint a dead session"
    );
  });

  it("renders the BranchPicker inside the unauthenticated gate", () => {
    assert.match(admin, /import BranchPicker from "@\/components\/BranchPicker"/);
    const pickerUsage = admin.indexOf("<BranchPicker");
    const gateStart = admin.indexOf("if (!authed) {");
    assert.ok(
      pickerUsage > gateStart,
      "BranchPicker must render on the unauthenticated page when a branch choice is pending"
    );
  });

  it("completes selection with the purpose-scoped token, not a session", () => {
    assert.match(admin, /fetch\("\/api\/auth\/select-branch"/);
    assert.match(admin, /Bearer \$\{pendingBranch\.token\}/);
    assert.match(admin, /body: JSON\.stringify\(\{ branchId \}\)/);
    assert.match(admin, /setPendingBranch\(null\)/);
  });

  it("handles the picker cancel by returning to the login form", () => {
    assert.match(admin, /onCancel=\{\(\) => \{ setPendingBranch\(null\)/);
  });
});