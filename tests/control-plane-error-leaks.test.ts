// tests/control-plane-error-leaks.test.ts
//
// F10: several control-plane handlers interpolated err.message (and one
// Render API response body) straight into the JSON they returned. Those
// strings routinely carry internal detail - database connection strings,
// render/vercel API responses, environment key names - and had no business
// leaving the process. Handlers now log the real message server-side and
// return a fixed, generic string to the client. This guards both halves: no
// echo of raw exception text, and the diagnostic detail is still recorded.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const dir = path.join(__dirname, "..", "control-plane", "server");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts"));
const read = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");

describe("control-plane responses never echo raw error detail", () => {
  it("scans every control-plane server module", () => {
    assert.ok(files.length > 0, "expected control-plane server sources to scan");
  });

  it("no response body interpolates an exception message", () => {
    const offenders: string[] = [];
    for (const f of files) {
      read(f)
        .split("\n")
        .forEach((line, i) => {
          if (/error: *(\w+\.)?message\b/.test(line)) offenders.push(`${f}:${i + 1} ${line.trim()}`);
        });
    }
    assert.deepEqual(offenders, []);
  });

  it("no response body echoes an upstream API response body", () => {
    const offenders: string[] = [];
    for (const f of files) {
      read(f)
        .split("\n")
        .forEach((line, i) => {
          if (/error: *`[^`]*\$\{[^}]*\.text/.test(line)) offenders.push(`${f}:${i + 1} ${line.trim()}`);
        });
    }
    assert.deepEqual(offenders, []);
  });

  it("the sanitized batch failures still log their detail server-side", () => {
    const idx = read("index.ts");
    const provision = read("provision.ts");
    const pairs: Array<[string, string]> = [
      ['error: "Deploy request failed"', "Test deploy failed for"],
      ['error: "Auto-deploy update failed"', "Auto-deploy update failed for"],
      ['error: "Cloudinary sync failed"', "Cloudinary sync failed for"],
      ['error: "Backup failed"', "Backup failed for"],
      ['error: "Plan sync failed"', "Plan sync failed for"],
    ];
    for (const [generic, marker] of pairs) {
      assert.ok(idx.includes(generic), `index.ts should return the generic ${generic}`);
      assert.ok(idx.includes(marker), `index.ts should log the real failure (${marker})`);
    }
    assert.ok(provision.includes('error: "Deploy request failed"'), "provision.ts returns a generic message");
    assert.ok(provision.includes("Deploy failed for"), "provision.ts still logs the real failure");
  });
});
