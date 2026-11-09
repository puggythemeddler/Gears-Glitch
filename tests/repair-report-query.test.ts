import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const reportRoutes = fs.readFileSync(path.join(__dirname, "..", "server", "report-routes.ts"), "utf8");

test("repair technician report qualifies both date bounds after joining users", () => {
  const start = reportRoutes.indexOf("const byTechnician = await queryAll(");
  const end = reportRoutes.indexOf("const byPriority = await queryAll(", start);
  const query = start >= 0 && end > start ? reportRoutes.slice(start, end) : "";
  const range = reportRoutes.match(/const technicianRangeWhere = `([^`]+)`/);

  assert.ok(query, "technician report query exists");
  assert.match(query, /WHERE\s+\$\{technicianRangeWhere\}/);
  assert.ok(range, "qualified technician date filter exists");
  assert.match(range![1], /^t\.created_at::timestamptz\s*>=/);
  assert.match(range![1], /AND\s+t\.created_at::timestamptz\s*</);
  assert.doesNotMatch(range![1], /AND\s+created_at::timestamptz/, "the joined users.created_at must not make the date bound ambiguous");
});
