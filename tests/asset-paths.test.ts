// tests/asset-paths.test.ts
//
// Regression test for the CI boot failure Gears & Glitch — boot-time DB assets
// not found: `[db] schema.sql not found`, `[migrations] directory not found,
// skipping`, then `relation "roles" does not exist` -> server never healthy ->
// the PostgreSQL isolation suite is cancelled.
//
// The resolver must be:
//   . DB-free (no Postgres, no DATABASE_URL, no server boot) — this file runs
//     in the plain unit suite on any machine, including this one.
//   . CWD-independent and deterministic.
//   . Correct for BOTH runtime layouts: SOURCE (tsx: __dirname=<repo>\server)
//     and COMPILED (dist: __dirname=<repo>\dist\server).
//   . Fail-LOUD when the assets are genuinely absent (never a silent skip that
//     boots an empty database).
//
// We assert those contracts directly against the pure resolver module.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { resolveServerAssetPaths } from "../server/asset-paths";

// The canonical repo root as located by the *source* module itself (matching
// what CI boots). __dirname here is <repo>\tests; the resolver walks up from
// its own start dir, so we pass an explicit start to model each layout.
const sourceStart = path.join(__dirname, "..", "server"); // <repo>\server
const source = resolveServerAssetPaths(sourceStart);
const repoRoot = source.repoRoot;
const expectedSchema = path.join(repoRoot, "server", "schema.sql");
const expectedMigrations = path.join(repoRoot, "server", "migrations");
const expectedProducts = path.join(repoRoot, "products.json");

describe("resolveServerAssetPaths (source layout, <repo>/server)", () => {
  it("resolves schema.sql and migrations/ to the canonical repo assets", () => {
    assert.equal(path.normalize(source.schemaPath), path.normalize(expectedSchema));
    assert.equal(path.normalize(source.migrationsDir), path.normalize(expectedMigrations));
    assert.equal(fs.existsSync(source.schemaPath), true);
    assert.equal(fs.existsSync(source.migrationsDir), true);
    assert.equal(fs.statSync(source.migrationsDir).isDirectory(), true);
    assert.equal(source.repoRoot, repoRoot);
  });

  it("resolves the products seed to the canonical <repo>/products.json", () => {
    assert.equal(path.normalize(source.productsPath), path.normalize(expectedProducts));
    assert.equal(fs.existsSync(source.productsPath), true);
  });
});

describe("resolveServerAssetPaths (compiled layout, <repo>/dist/server)", () => {
  it("locates the SAME canonical assets despite the extra dist/ depth", () => {
    const compiledStart = path.join(repoRoot, "dist", "server");
    const compiled = resolveServerAssetPaths(compiledStart);
    assert.equal(path.normalize(compiled.schemaPath), path.normalize(expectedSchema));
    assert.equal(path.normalize(compiled.migrationsDir), path.normalize(expectedMigrations));
    assert.equal(path.normalize(compiled.productsPath), path.normalize(expectedProducts));
    assert.equal(compiled.repoRoot, repoRoot);
    assert.equal(fs.existsSync(compiled.schemaPath), true);
    assert.equal(fs.existsSync(compiled.migrationsDir), true);
  });
});

describe("resolveServerAssetPaths (determinism + CWD independence)", () => {
  it("is deterministic across repeated calls", () => {
    const a = resolveServerAssetPaths(sourceStart);
    const b = resolveServerAssetPaths(sourceStart);
    assert.deepEqual(a, b);
  });

  it("does not depend on process.cwd()", () => {
    const prevCwd = process.cwd();
    try {
      process.chdir(os.tmpdir());
      const moved = resolveServerAssetPaths(sourceStart);
      assert.equal(path.normalize(moved.schemaPath), path.normalize(expectedSchema));
      assert.equal(moved.repoRoot, repoRoot);
    } finally {
      process.chdir(prevCwd);
    }
  });
});

describe("resolveServerAssetPaths (fail-LOUD, no silent skip)", () => {
  it("throws with a diagnostic when the assets genuinely cannot be found", () => {
    const nowhere = path.join(os.tmpdir(), "gears-glitch-no-repo-here");
    fs.mkdirSync(nowhere, { recursive: true });
    try {
      assert.throws(
        () => resolveServerAssetPaths(nowhere),
        (err: unknown) =>
          err instanceof Error &&
          /cannot locate canonical database assets/.test(err.message) &&
          /server\/schema\.sql/.test(err.message) &&
          /server\/migrations/.test(err.message)
      );
    } finally {
      fs.rmSync(nowhere, { recursive: true, force: true });
    }
  });
});
