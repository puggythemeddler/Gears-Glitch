import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Structural guard for the access model: activation (financing_config.enabled,
// surfaced through financingBlocked) must gate only NEW financing. Servicing an
// existing agreement must keep working after deactivation so customers mid-plan
// can still pay and staff can still service history.
function read(rel: string): string {
  return readFileSync(join(__dirname, "..", rel), "utf8");
}

interface Block {
  method: string;
  path: string;
  body: string;
}

function routeBlocks(source: string): Block[] {
  const re = /router\.(get|post|patch|put|delete)\(\s*"([^"]+)"([\s\S]*?)(?=router\.(?:get|post|patch|put|delete)\(\s*"|$)/g;
  const blocks: Block[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) blocks.push({ method: m[1], path: m[2], body: m[3] });
  return blocks;
}

const financing = read("server/routes/financing.ts");
const blocks = routeBlocks(financing);

function find(method: string, path: string): Block {
  const b = blocks.find((x) => x.method === method && x.path === path);
  assert.ok(b, `route ${method.toUpperCase()} ${path} not found`);
  return b!;
}

const NEW_FINANCING: [string, string][] = [
  ["post", "/applications"],
  ["patch", "/applications/:id"],
  ["post", "/applications/:id/submit"],
  ["post", "/applications/:id/approve"],
  ["post", "/my/applications"],
];

const SERVICING: [string, string][] = [
  ["post", "/agreements/:id/release"],
  ["post", "/agreements/:id/cancel"],
  ["post", "/agreements/:id/payments"],
  ["post", "/agreements/:id/adjustments"],
  ["post", "/agreements/:id/mpesa"],
  ["post", "/payments/:id/reverse"],
  ["post", "/my/agreements/:id/mpesa"],
];

describe("financing access gating", () => {
  it("checks activation only on new-financing routes", () => {
    for (const [method, path] of NEW_FINANCING) {
      assert.match(find(method, path).body, /financingBlocked\(/, `${method} ${path} should check activation`);
    }
  });

  it("never blocks servicing routes on activation", () => {
    for (const [method, path] of SERVICING) {
      assert.doesNotMatch(
        find(method, path).body,
        /financingBlocked\(/,
        `${method} ${path} must keep working after deactivation`
      );
    }
  });

  it("still gates every financing route on entitlement", () => {
    for (const b of blocks) {
      if (b.path.startsWith("/options") || b.path.startsWith("/public/")) continue;
      assert.match(b.body, /requireShopFeature\(FINANCING_FEATURE\)/, `${b.method} ${b.path} should require the entitlement`);
    }
  });
});

describe("website studio financing block is feature-gated", () => {
  const engine = read("frontend/layouts/dynamic-engine.tsx");
  const builder = read("frontend/components/admin/StorefrontBuilder.tsx");

  it("renders the block only when financing/options reports enabled", () => {
    assert.match(engine, /financing-promo/);
    assert.match(engine, /\/api\/financing\/options/);
    assert.match(engine, /if \(!enabled\) return null;/);
  });

  it("offers the palette group only when financing is enabled", () => {
    assert.match(builder, /financing-promo/);
    assert.match(builder, /financingEnabled \? \["Financing"\] : \[\]/);
  });
});
