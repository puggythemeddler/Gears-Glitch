import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (file: string) => readFileSync(join(__dirname, "..", file), "utf8");

it("serial tracking navigation and product controls require the entitlement", () => {
  const admin = read("frontend/pages/admin.tsx");
  const products = read("frontend/components/admin/AdminProducts.tsx");
  assert.match(admin, /key: "serials", label: "Serial Numbers", feature: "Serial number tracking"/);
  assert.match(admin, /"Serial number tracking": useFeature\("Serial number tracking"\)/);
  assert.match(products, /const serialTrackingEnabled = useFeature\("Serial number tracking"\)/);
  assert.match(products, /serialTrackingEnabled && <div[^\n]*serialTracking/);
  assert.match(products, /\.\.\.\(serialTrackingEnabled \? \{ serialTracking:/);
});

it("serial APIs and serial-tracked sales enforce the entitlement server-side", () => {
  const server = read("server/index.ts");
  const routes = [
    /app\.get\("\/api\/pos\/serials\/lookup\/:serialNumber", posAuthMiddleware, requireShopFeature\("Serial number tracking"\)/,
    /app\.get\("\/api\/serials", posAuthMiddleware, requireShopFeature\("Serial number tracking"\)/,
    /app\.get\("\/api\/serials\/reconciliation", adminAuthMiddleware, requireShopFeature\("Serial number tracking"\)/,
    /app\.get\("\/api\/serials\/lookup\/:serialNumber", posAuthMiddleware, requireShopFeature\("Serial number tracking"\)/,
    /app\.post\("\/api\/serials", adminAuthMiddleware, requireShopFeature\("Serial number tracking"\)/,
    /app\.post\("\/api\/serials\/:id\/reconcile", adminAuthMiddleware, requireShopFeature\("Serial number tracking"\)/,
    /app\.post\("\/api\/serials\/generate", adminAuthMiddleware, requireShopFeature\("Serial number tracking"\)/,
    /app\.post\("\/api\/serials\/:id\/void", adminAuthMiddleware, requireShopFeature\("Serial number tracking"\)/,
    /app\.post\("\/api\/serials\/link", adminAuthMiddleware, requireShopFeature\("Serial number tracking"\)/,
    /app\.post\("\/api\/serials\/link-by-number", posAuthMiddleware, requireShopFeature\("Serial number tracking"\)/,
  ];
  for (const route of routes) assert.match(server, route);
  assert.match(server, /if \(product\.serialTracking && !featureListIncludes\(await getEffectiveFeatures\(req\), "Serial number tracking"\)\)/);
  assert.match(server, /if \(!serialTrackingEnabled && Boolean\(body\.serialTracking\)\)/);
  assert.match(server, /if \(!serialTrackingEnabled && body\.serialTracking !== undefined\)/);
  assert.match(server, /if \(\(serialList\.length \|\| assetTagList\.some\(Boolean\)\) && !featureListIncludes\(await getEffectiveFeatures\(req\), "Serial number tracking"\)\)/);
  assert.match(server, /Object\.values\(serialsByItem\)\.some\(\(serials\) => serials\.length > 0\).*Serial number tracking/s);
});
