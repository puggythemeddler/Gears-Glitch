import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

// eTIMS is disabled by design (no production KRA adapter). These static,
// DB-free assertions lock in the "disable the enabled surface" behaviour so a
// future change cannot silently reintroduce fabricated KRA submissions or a
// user-toggleable eTIMS mode.
describe("eTIMS disabled surface regression", () => {
  const indexSrc = fs.readFileSync(path.join(__dirname, "..", "server", "index.ts"), "utf8");
  const dbSrc = fs.readFileSync(path.join(__dirname, "..", "server", "db.ts"), "utf8");
  const adminSrc = fs.readFileSync(path.join(__dirname, "..", "frontend", "pages", "admin.tsx"), "utf8");
  const marketingSrc = fs.readFileSync(path.join(__dirname, "..", "frontend", "pages", "marketing.tsx"), "utf8");

  it("credit-note route no longer invokes submitCreditNoteToEtims", () => {
    assert.ok(!/submitCreditNoteToEtims/.test(indexSrc), "server must not call the eTIMS credit-note submitter");
  });

  it("credit-note route keeps credit notes honest (no fabricated 'submitted' stamp)", () => {
    const creditNoteRoute = indexSrc.slice(indexSrc.indexOf('app.post("/api/admin/credit-notes"'), indexSrc.length);
    assert.ok(/etims_mode/.test(creditNoteRoute), "credit-note route should warn when a legacy eTIMS mode is set");
  });

  it("settings PUT forces any non-off etims_mode to off", () => {
    assert.ok(/etimsMode !== undefined/.test(indexSrc), "settings write must guard etims_mode");
    assert.ok(/forcing etims_mode to 'off'/.test(indexSrc), "force-off guard must be present");
  });

  it("sales/credit-note stubs refuse to fabricate submissions", () => {
    assert.ok(/refusing to mark credit note as KRA-submitted/.test(dbSrc), "submitCreditNoteToEtims must refuse");
    assert.ok(/eTIMS is DISABLED in this build/.test(dbSrc), "createEtimsSalesTransaction must warn that eTIMS is disabled");
    assert.ok(/submitted: false/.test(dbSrc), "sales stub must never claim submission");
  });

  it("admin settings surface no longer offers VSCU/OSCU toggle or OSCU credential fields", () => {
    assert.ok(!/name="etimsMode"/.test(adminSrc), "VSCU/OSCU mode selector must be removed");
    assert.ok(!/name="etimsOscuConsumerKey"/.test(adminSrc), "OSCU consumer key field must be removed");
    assert.ok(!/name="etimsOscuConsumerSecret"/.test(adminSrc), "OSCU consumer secret field must be removed");
    assert.ok(/eTIMS e-invoicing is <strong>disabled<\/strong>/.test(adminSrc), "admin must show the disabled notice");
  });

  it("marketing FAQ no longer claims built-in KRA compliance", () => {
    assert.ok(!/Every invoice and credit note carries a proper eTIMS control code/.test(marketingSrc));
    assert.ok(/Not yet\. eTIMS submission is disabled/.test(marketingSrc));
  });
});