import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.join(__dirname, "..");
const server = fs.readFileSync(path.join(repoRoot, "server/index.ts"), "utf8");
const adminProducts = fs.readFileSync(path.join(repoRoot, "frontend/components/admin/AdminProducts.tsx"), "utf8");

describe("internal product cost privacy", () => {
  it("keeps the public catalog response stripped of product cost", () => {
    assert.match(server, /function publicProduct\(p: any\)[\s\S]*?delete copy\.costPrice/);
    assert.match(server, /app\.get\("\/api\/products",[\s\S]*?products\.map\(publicProduct\)/);
  });

  it("loads editable costs only through the permission-checked admin catalog endpoint", () => {
    assert.match(server, /app\.get\("\/api\/admin\/products", ownerAuthMiddleware, requirePermission\("product:list"\)/);
    assert.match(adminProducts, /api<\{ products: Product\[\] \}>\("\/api\/admin\/products"\)/);
    assert.doesNotMatch(adminProducts, /\/api\/products\?includeHidden=1/);
  });
});
