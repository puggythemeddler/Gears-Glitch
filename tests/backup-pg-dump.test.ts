// The control-plane backup engine (runPgDump) previously launched a second
// child process (`gzip`) and passed an fs.WriteStream straight into spawn's
// stdio array. On Node 22/24 that throws synchronously:
//   The argument 'stdio' is invalid. Received WriteStream { fd: null, ... }
// so every backup recorded backup_failed and DR had no artifacts at all.
// runPgDump now gzips in-process with zlib and never puts a stream in stdio.
// These guards pin that contract plus the UI surfacing the real error text.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = path.join(__dirname, "..");
const cpServer = fs.readFileSync(path.join(repo, "control-plane/server/index.ts"), "utf8");
const cpIndex = fs.readFileSync(path.join(repo, "control-plane/public/index.html"), "utf8");

describe("control-plane backup engine", () => {
  it("gzips in-process with zlib instead of spawning a gzip child", () => {
    assert.match(cpServer, /import zlib from "zlib"/);
    assert.match(cpServer, /zlib\.createGzip\(\)/);
    assert.ok(!/spawn\(\s*"gzip"/.test(cpServer), "must not spawn a gzip binary");
  });

  it("never passes a WriteStream into spawn's stdio array", () => {
    assert.ok(
      !/stdio:\s*\[\s*"pipe"\s*,\s*outStream/.test(cpServer),
      "passing an unopened WriteStream to stdio throws on Node 22/24"
    );
    // The pg_dump stdio must stay all-string.
    assert.match(cpServer, /stdio:\s*\[\s*"ignore"\s*,\s*"pipe"\s*,\s*"pipe"\s*\]/);
  });

  it("pipes pg_dump stdout through the gzip transform into the file", () => {
    assert.match(cpServer, /pg\.stdout\.pipe\(gz\)\.pipe\(out\)/);
    assert.match(cpServer, /pg_dump exited with code/);
  });

  it("surfaces the real per-client failure in the dashboard toast", () => {
    assert.match(cpIndex, /const firstErr = r\.find\(x => !x\.success && x\.error\)/);
    assert.match(cpIndex, /firstErr\.error/);
  });
});
