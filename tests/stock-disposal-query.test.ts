import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("stock disposal history groups by the users table's username column", () => {
  const source = readFileSync(path.join(__dirname, "..", "server", "db.ts"), "utf8");
  const match = source.match(/async function listStockDisposals\([\s\S]*?(?=\nasync function createStockDisposal)/);
  assert.ok(match, "listStockDisposals query exists");
  assert.match(match[0], /u\.username AS "createdByName"/);
  assert.match(match[0], /GROUP BY d\.id, p\.name, b\.name, u\.username/);
  assert.doesNotMatch(match[0], /\bu\.name\b/);
});

test("serial status constraints allow disposed serials", () => {
  const root = path.join(__dirname, "..");
  const schema = readFileSync(path.join(root, "server", "schema.sql"), "utf8");
  const migration = readFileSync(path.join(root, "server", "migrations", "0050_serial_disposal_status.sql"), "utf8");
  const db = readFileSync(path.join(root, "server", "db.ts"), "utf8");

  assert.match(schema, /status TEXT NOT NULL DEFAULT 'in_stock' CHECK \(status IN \([^)]*'disposed'[^)]*\)\)/);
  assert.match(migration, /CHECK \(status IN \([^)]*'disposed'[^)]*\)\)/);
  assert.match(db, /UPDATE serial_numbers SET status = 'disposed'/);
});
