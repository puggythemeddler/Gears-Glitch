import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { getPool, query, queryOne, runSchema } from "../server/db-helpers";

// Regression coverage for the M-Pesa "hold" reservation statements.
//
// Root cause: inside `ON CONFLICT ... DO UPDATE SET`, PostgreSQL resolves an
// unqualified column reference against BOTH the target table and the `excluded`
// pseudo-relation. `excluded` exposes every column of the INSERT target list, so
// a bare `quantity_reserved` matches two range-table entries and the statement is
// rejected with `column reference "quantity_reserved" is ambiguous`.
//
// This is a PLAN-time error (it reproduces under PREPARE on an empty table), not a
// data-dependent one: every M-Pesa hold path was unexecutable. All four sites --
// server/db.ts createOrder(stock:"hold"), server/db.ts holdStockForOrder, and both
// server/index.ts POS hold branches -- used the unqualified form, while the
// sibling immediate-deduct statements already qualified with `stock_levels.`.
//
// These tests pin the exact statements so a future hold path cannot reintroduce
// the ambiguity, and assert the reservation semantics are preserved:
// accumulation across orders, no negative stock, and a release floor at zero.
describe("stock reservation ON CONFLICT statements (DB)", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  before(() => {
    getPool();
    return Promise.resolve();
  });

  before(async () => {
    const schema = fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8");
    await query(`DROP TABLE IF EXISTS schema_migrations CASCADE`);
    await runSchema(schema);
  });

  beforeEach(async () => {
    await query(`TRUNCATE stock_levels, stock_movements CASCADE`);
  });

  const seedProduct = async (id: string) => {
    await query(
      `INSERT INTO products (id, category, name, price, stock_on_hand, in_stock, cost_price)
       VALUES ($1, 'test', 'P', 100, 0, 1, 60) ON CONFLICT (id) DO NOTHING`, [id]);
  };

  // stock_levels.branch_id references branches(id), so the branch-scoped hold needs
  // real branch rows.
  const seedBranch = async (id: number) => {
    await query(`INSERT INTO branches (id, name, address) VALUES ($1, $2, 'x') ON CONFLICT (id) DO NOTHING`, [id, `B${id}`]);
  };

  // The global (branch_id IS NULL) hold statement, verbatim from server/db.ts.
  const HOLD_GLOBAL = `
    INSERT INTO stock_levels (product_id, quantity_in_stock, quantity_reserved, quantity_sold, low_stock_threshold)
    VALUES ($1, 0, $2, 0, 5)
    ON CONFLICT (product_id) WHERE branch_id IS NULL DO UPDATE SET quantity_reserved = stock_levels.quantity_reserved + $2, updated_at = NOW()::text
    RETURNING quantity_reserved`;

  // The branch-scoped hold statement, verbatim from server/index.ts POS checkout.
  const HOLD_BRANCH = `
    INSERT INTO stock_levels (product_id, branch_id, quantity_in_stock, quantity_reserved, quantity_sold, low_stock_threshold)
    VALUES ($1, $2, 0, $3, 0, 5)
    ON CONFLICT (product_id, branch_id) WHERE branch_id IS NOT NULL DO UPDATE SET quantity_reserved = stock_levels.quantity_reserved + $3, updated_at = NOW()::text
    RETURNING quantity_reserved`;

  it("global hold statement is not ambiguous and seeds the reservation", async () => {
    await seedProduct("res-global");
    const r = await queryOne(HOLD_GLOBAL, ["res-global", 4]);
    assert.equal((r as any).quantity_reserved, 4, "first hold seeds quantity_reserved");
  });

  it("repeated global holds accumulate rather than overwrite", async () => {
    await seedProduct("res-acc");
    await queryOne(HOLD_GLOBAL, ["res-acc", 5]);
    const second = await queryOne(HOLD_GLOBAL, ["res-acc", 3]);
    assert.equal((second as any).quantity_reserved, 8, "5 then 3 must total 8, not overwrite to 3");
    const row = await queryOne(`SELECT quantity_reserved FROM stock_levels WHERE product_id = 'res-acc' AND branch_id IS NULL`);
    assert.equal((row as any).quantity_reserved, 8);
  });

  it("branch-scoped hold statement is not ambiguous and accumulates per branch", async () => {
    await seedProduct("res-branch");
    await seedBranch(1);
    await seedBranch(2);
    await queryOne(HOLD_BRANCH, ["res-branch", 1, 2]);
    const same = await queryOne(HOLD_BRANCH, ["res-branch", 1, 3]);
    assert.equal((same as any).quantity_reserved, 5, "same branch accumulates 2 then 3");
    const other = await queryOne(HOLD_BRANCH, ["res-branch", 2, 7]);
    assert.equal((other as any).quantity_reserved, 7, "a different branch is a separate reservation");
    const b1 = await queryOne(`SELECT quantity_reserved FROM stock_levels WHERE product_id = 'res-branch' AND branch_id = 1`);
    const b2 = await queryOne(`SELECT quantity_reserved FROM stock_levels WHERE product_id = 'res-branch' AND branch_id = 2`);
    assert.equal((b1 as any).quantity_reserved, 5, "branch 1 unaffected by branch 2");
    assert.equal((b2 as any).quantity_reserved, 7);
  });

  it("release floors quantity_reserved at zero and never goes negative", async () => {
    await seedProduct("res-rel");
    await queryOne(HOLD_GLOBAL, ["res-rel", 6]);
    // Same GREATEST-floor release used by the production release paths.
    for (let i = 0; i < 4; i++) {
      await query(`UPDATE stock_levels SET quantity_reserved = GREATEST(quantity_reserved - $1, 0) WHERE product_id = $2 AND branch_id IS NULL`, [5, "res-rel"]);
    }
    const row = await queryOne(`SELECT quantity_reserved FROM stock_levels WHERE product_id = 'res-rel' AND branch_id IS NULL`);
    assert.equal((row as any).quantity_reserved, 0, "over-releasing must clamp to 0, not go negative");
  });

  it("an unqualified quantity_reserved reference is rejected at plan time (guards the original defect)", async () => {
    // Proves the ambiguity is inherent to the unqualified form rather than to this
    // schema's data, so a reintroduced unqualified hold path fails this suite.
    const UNQUALIFIED = `
      INSERT INTO stock_levels (product_id, quantity_in_stock, quantity_reserved, quantity_sold, low_stock_threshold)
      VALUES ($1, 0, $2, 0, 5)
      ON CONFLICT (product_id) WHERE branch_id IS NULL DO UPDATE SET quantity_reserved = quantity_reserved + $2, updated_at = NOW()::text`;
    await assert.rejects(
      () => queryOne(UNQUALIFIED, ["res-guard", 1]),
      /ambiguous/i,
      "unqualified ON CONFLICT DO UPDATE reference must remain an error"
    );
  });

  it("no production source reintroduces an unqualified ON CONFLICT quantity_reserved", () => {
    // The behavioural tests above exercise copies of these statements, so they would
    // not notice a revert. This reads the real sources and fails if any hold path goes
    // back to an unqualified reference (the exact defect that broke M-Pesa holds).
    const offenders: string[] = [];
    for (const rel of ["server/db.ts", "server/index.ts"]) {
      const file = path.join(__dirname, "..", rel);
      fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
        if (!/ON CONFLICT/i.test(line)) return;
        // Right-hand side of `quantity_reserved = ...` must name a relation.
        if (/quantity_reserved\s*=\s*(?!stock_levels\.|excluded\.)quantity_reserved/.test(line)) {
          offenders.push(`${rel}:${i + 1}`);
        }
      });
    }
    assert.deepEqual(offenders, [], `unqualified ON CONFLICT quantity_reserved at ${offenders.join(", ")}`);
  });
});
