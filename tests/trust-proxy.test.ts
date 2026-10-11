// Regression guard: both Express apps run behind Render's edge proxy, which
// forwards the client IP via X-Forwarded-For. Without `trust proxy`, express
// rate-limit keys every request by the proxy address — collapsing all users into
// one bucket — and logs ERR_ERL_UNEXPECTED_X_FORWARDED_FOR. See:
// https://express-rate-limit.github.io/ERR_ERL_UNEXPECTED_X_FORWARDED_FOR/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = path.join(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(repo, rel), "utf8");

describe("trust proxy", () => {
  for (const file of ["server/index.ts", "control-plane/server/index.ts"]) {
    it(`${file} trusts the edge proxy`, () => {
      assert.match(
        read(file),
        /app\.set\(\s*["']trust proxy["']\s*,\s*1\s*\)/,
        `${file} must call app.set("trust proxy", 1) or rate limiting misbehaves behind Render`
      );
    });
  }
});
