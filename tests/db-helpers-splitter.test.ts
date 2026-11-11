import test from "node:test";
import assert from "node:assert/strict";
import { splitSqlStatements } from "../server/db-helpers";

test("splitSqlStatements preserves ordered statements and ignores semicolons in SQL literals/comments", () => {
  const sql = `-- separator ; in a line comment
ALTER TABLE stock_levels ADD COLUMN IF NOT EXISTS branch_id INTEGER;
/* separator ; in a block comment */
CREATE INDEX idx_stock_levels_branch ON stock_levels(branch_id);
INSERT INTO settings(key, value) VALUES ('message', 'one; two');
`;

  assert.deepEqual(splitSqlStatements(sql), [
    "-- separator ; in a line comment\nALTER TABLE stock_levels ADD COLUMN IF NOT EXISTS branch_id INTEGER",
    "/* separator ; in a block comment */\nCREATE INDEX idx_stock_levels_branch ON stock_levels(branch_id)",
    "INSERT INTO settings(key, value) VALUES ('message', 'one; two')",
  ]);
});

test("splitSqlStatements keeps PostgreSQL dollar-quoted blocks intact", () => {
  const sql = `DO $$ BEGIN
    PERFORM 'inner; semicolon';
    IF true THEN PERFORM 1; END IF;
  END $$;
DO $migration$ BEGIN PERFORM 2; END $migration$;`;

  assert.deepEqual(splitSqlStatements(sql), [
    "DO $$ BEGIN\n    PERFORM 'inner; semicolon';\n    IF true THEN PERFORM 1; END IF;\n  END $$",
    "DO $migration$ BEGIN PERFORM 2; END $migration$",
  ]);
});

test("splitSqlStatements honours backslash escapes in E-strings", () => {
  const sql = String.raw`SELECT E'escaped quote: \'; still one statement'; SELECT 2;`;
  assert.deepEqual(splitSqlStatements(sql), [
    String.raw`SELECT E'escaped quote: \'; still one statement'`,
    "SELECT 2",
  ]);
});
