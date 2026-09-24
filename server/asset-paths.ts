// server/asset-paths.ts
//
// Boot-time path resolver for the versioned DB-asset layout. This is the
// single place that decides where `schema.sql`, `server/migrations/` and
// `products.json` live, so the two layouts this project runs under both
// resolve to the SAME canonical disk paths:
//
//   SOURCE  layout (what CI boots with tsx):  __dirname = <repo>\server
//   COMPILED layout (tsc, outDir=dist, rootDir=.): __dirname = <repo>\dist\server
//
// The old code computed these as `path.join(__dirname, "..", "..", "server", …)`
// which is only correct for ONE of those depths: from `<repo>\dist\server` the
// double-`..` lands exactly on `<repo>` and works, but from source
// (`__dirname = <repo>\server`) the double-`..` overshoots to
// `<parent-of-repo>\server` and the boot log shows `schema.sql not found`,
// `[migrations] directory not found, skipping`, and finally
// `relation "roles" does not exist` -> server never healthy -> the DB/isolation
// suite is cancelled. That is the exact CI failure. This module removes the
// hard-coded depth by walking UP from `__dirname` until a directory is found
// that contains BOTH `server/schema.sql` AND `server/migrations/` — the two
// canonical markers of the repo's checkout. It works identically from source,
// from compiled output, from any nested/relocated checkout, and it never
// depends on `process.cwd()`.

import fs from "fs";
import path from "path";

export interface ServerAssetPaths {
  schemaPath: string;
  migrationsDir: string;
  productsPath: string;
  repoRoot: string;
}

const MAX_UP = 16;

/** Walk up from `startDir` (defaults to `__dirname`) to the first ancestor
 *  that is a repo checkout root (holds `server/schema.sql` + `server/migrations/`).
 *  Pure/static helper — no I/O beyond existence checks, so it can be unit-tested
 *  without Postgres and without booting the server. */
export function resolveServerAssetPaths(startDir: string = __dirname): ServerAssetPaths {
  let dir = path.resolve(startDir);
  const probes: string[] = [];
  for (let depth = 0; depth < MAX_UP; depth += 1) {
    probes.push(dir);
    const schemaPath = path.join(dir, "server", "schema.sql");
    const migrationsDir = path.join(dir, "server", "migrations");
    const hasSchema = fs.existsSync(schemaPath);
    const hasMigrations = fs.existsSync(migrationsDir) && fs.statSync(migrationsDir, { throwIfNoEntry: false })?.isDirectory?.() === true;
    if (hasSchema && hasMigrations) {
      return {
        schemaPath,
        migrationsDir,
        productsPath: path.join(dir, "products.json"),
        repoRoot: dir,
      };
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Loud, diagnostic failure — never a silent skip that boots an empty DB.
  const cwd = process.cwd();
  throw new Error(
    "[db] FATAL: cannot locate canonical database assets (server/schema.sql + server/migrations/).\n" +
      "  __dirname (module location)   : " + __dirname + "\n" +
      "  process.cwd() (process working dir) : " + cwd + "\n" +
      "  (calculated path, expected repo-relative path, runtime module location,\n" +
      "   and existence probe for EVERY candidate walked):\n" +
      probes.map((p) => {
        const s = path.join(p, "server", "schema.sql");
        const m = path.join(p, "server", "migrations");
        return `      ${p}\n` +
          `        schema.sql    exists=${fs.existsSync(s)}  at ${s}\n` +
          `        migrations/   exists=${fs.existsSync(m)}  at ${m}`;
      }).join("\n") +
      "\n  Expected canonical layout: <repo>/server/schema.sql and <repo>/server/migrations/.\n" +
      "  Ensure the server is executed from within a Gears-Glitch checkout (run via\n" +
      "  tsx from the repo root, or compile with outDir=dist/rootDir=. so the walk\n" +
      "  reaches the repo root). Do NOT boot with an empty database."
  );
}
