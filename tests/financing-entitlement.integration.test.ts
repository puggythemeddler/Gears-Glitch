import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { getPool, query, runSchema } from "../server/db-helpers";
import {
  getEffectiveFeatures,
  getShopFeatureOverrides,
  saveShopFeatureOverrides,
  getBranchFeatureOverrides,
  saveBranchFeatureOverrides,
  requireShopFeature,
  requireBranchFeature,
  checkBranchFeature,
} from "../server/feature-access";
import { featureListIncludes } from "../server/feature-rules";

const HAS_DB = !!process.env.DATABASE_URL;
const FEATURE = "Lipa Mdogo Mdogo";

function fakeReq(body: any = {}): any {
  return { headers: {}, query: {}, params: {}, body };
}

function fakeRes(): any {
  return {
    statusCode: 0,
    body: null,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; return this; },
  };
}

// DB-backed coverage for the shared feature-access layer that now gates
// financing: entitlement resolution (plan + control-plane overrides), the
// persistence of per-branch activation, and the two server-side gates. Gated
// like the other *.integration tests - CI provides Postgres via DATABASE_URL.
describe("feature access integration (DB)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  before(() => {
    getPool();
    return Promise.resolve();
  });

  before(async () => {
    const schema = fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8");
    await runSchema(schema);
  });

  beforeEach(async () => {
    await query("DELETE FROM settings WHERE key IN ('featureOverrides', 'branchFeatureOverrides', 'financing_config', 'financing_entitlement_migrated_v1')");
  });

  it("round-trips shop-level feature overrides", async () => {
    await saveShopFeatureOverrides({ [FEATURE]: true, "Repair ticketing": false });
    assert.deepEqual(await getShopFeatureOverrides(), { [FEATURE]: true, "Repair ticketing": false });
  });

  it("force-adds an override feature and excludes a blocked one", async () => {
    await saveShopFeatureOverrides({ [FEATURE]: true });
    assert.equal(featureListIncludes(await getEffectiveFeatures(fakeReq()), FEATURE), true);

    await saveShopFeatureOverrides({ [FEATURE]: false });
    assert.equal(featureListIncludes(await getEffectiveFeatures(fakeReq()), FEATURE), false);
  });

  it("round-trips and normalizes branch overrides", async () => {
    await saveBranchFeatureOverrides({ [FEATURE]: { "3": false, bonus: true } });
    assert.deepEqual(await getBranchFeatureOverrides(), { [FEATURE]: { "3": false } });
  });

  it("checkBranchFeature blocks a disabled branch and allows inherit/enabled", async () => {
    await saveBranchFeatureOverrides({ [FEATURE]: { "3": false, "4": true } });
    assert.match((await checkBranchFeature(FEATURE, 3)) || "", /not enabled/i);
    assert.equal(await checkBranchFeature(FEATURE, 4), null);
    assert.equal(await checkBranchFeature(FEATURE, 99), null);
    assert.equal(await checkBranchFeature(FEATURE, null), null);
  });

  it("requireShopFeature admits overridden entitlements and rejects others", async () => {
    await saveShopFeatureOverrides({ [FEATURE]: true });
    const mw = requireShopFeature(FEATURE);
    let allowed = false;
    const res = fakeRes();
    await mw(fakeReq(), res, () => { allowed = true; });
    assert.equal(allowed, true);
    assert.equal(res.statusCode, 0);

    await saveShopFeatureOverrides({});
    const denied = fakeRes();
    await mw(fakeReq(), denied, () => {});
    assert.equal(denied.statusCode, 403);
  });

  it("requireBranchFeature rejects a disabled branch and admits an entitled one", async () => {
    await saveShopFeatureOverrides({ [FEATURE]: true });
    await saveBranchFeatureOverrides({ [FEATURE]: { "3": false } });
    const mw = requireBranchFeature(FEATURE);

    const denied = fakeRes();
    await mw(fakeReq({ branchId: 3 }), denied, () => {});
    assert.equal(denied.statusCode, 403);

    let allowed = false;
    const ok = fakeRes();
    await mw(fakeReq({ branchId: 4 }), ok, () => { allowed = true; });
    assert.equal(allowed, true);
    assert.equal(ok.statusCode, 0);
  });
});
