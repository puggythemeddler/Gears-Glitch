import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controlPlaneHtml = readFileSync("public/index.html", "utf8");

test("client invoice actions interpolate numeric identifiers into their handlers", () => {
  assert.match(controlPlaneHtml, /onclick="viewClientInvoice\(\$\{Number\(clientId\)\},\$\{Number\(inv\.id\)\}\)"/);
  assert.match(controlPlaneHtml, /onclick="downloadClientInvoicePdf\(\$\{Number\(clientId\)\},\$\{Number\(inv\.id\)\}\)"/);
  assert.match(controlPlaneHtml, /onclick="emailClientInvoice\(\$\{Number\(clientId\)\},\$\{Number\(inv\.id\)\}\)"/);
});
