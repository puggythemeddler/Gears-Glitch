import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

// Express registers routes in order and a `:param` route matches the single
// segment of a literal sibling route registered later — the literal becomes
// unreachable (always falls through to `:id`, 404/error). This guard asserts the
// production endpoints that were previously shadowed stay registered before their
// `:id` counterparts. Static and DB-free so it runs everywhere.
describe("express route-ordering regression", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "server", "index.ts"), "utf8");
  const lines = src.split("\n");
  const lineOf = (route: string) =>
    lines.findIndex((l) => l.includes(`app.get("${route}"`));

  it("registers literal credit-notes order-status before the :id route", () => {
    const literal = lineOf("/api/admin/credit-notes/order-status");
    const param = lineOf("/api/admin/credit-notes/:id");
    assert.ok(literal >= 0, "order-status route must exist in server source");
    assert.ok(param >= 0, ":id route must exist in server source");
    assert.ok(literal < param, `order-status (line ${literal + 1}) must precede :id (line ${param + 1})`);
  });

  it("registers literal purchases/deleted and /completed before the :id route", () => {
    const del = lineOf("/api/purchases/deleted");
    const done = lineOf("/api/purchases/completed");
    const param = lineOf("/api/purchases/:id");
    assert.ok(del >= 0 && done >= 0 && param >= 0, "purchases routes must exist in server source");
    assert.ok(del < param, `purchases/deleted (line ${del + 1}) must precede :id (line ${param + 1})`);
    assert.ok(done < param, `purchases/completed (line ${done + 1}) must precede :id (line ${param + 1})`);
  });

  it("registers literal products/batch-images before the :id route", () => {
    const batch = lineOf("/api/products/batch-images");
    const param = lineOf("/api/products/:id");
    assert.ok(batch >= 0 && param >= 0, "products routes must exist in server source");
    assert.ok(batch < param, `batch-images (line ${batch + 1}) must precede :id (line ${param + 1})`);
  });
});