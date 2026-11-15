import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizePurchaseOrderFilename, validatePurchaseOrderDocument } from "../server/purchase-order-documents";

describe("purchase-order supplier document validation", () => {
  it("accepts matching PDF, JPEG, and PNG signatures", () => {
    assert.deepEqual(validatePurchaseOrderDocument("application/pdf", "quote.pdf", Buffer.from("%PDF-1.7")), { ok: true, mime: "application/pdf" });
    assert.deepEqual(validatePurchaseOrderDocument("image/jpeg", "scan.jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0])), { ok: true, mime: "image/jpeg" });
    assert.deepEqual(validatePurchaseOrderDocument("image/png", "invoice.png", Buffer.from("89504e470d0a1a0a", "hex")), { ok: true, mime: "image/png" });
  });

  it("rejects mismatched names, unsupported types, and forged file contents", () => {
    assert.equal(validatePurchaseOrderDocument("application/pdf", "invoice.jpg", Buffer.from("%PDF-1.7")).ok, false);
    assert.equal(validatePurchaseOrderDocument("application/x-msdownload", "invoice.pdf", Buffer.from("%PDF-1.7")).ok, false);
    assert.equal(validatePurchaseOrderDocument("image/png", "image.png", Buffer.from("not really a PNG")).ok, false);
    assert.equal(validatePurchaseOrderDocument("application/pdf", "empty.pdf", Buffer.alloc(0)).ok, false);
  });

  it("strips path prefixes and control characters from stored names", () => {
    assert.equal(sanitizePurchaseOrderFilename("..\\invoices\\invoice\r\n.pdf"), "invoice.pdf");
    assert.equal(sanitizePurchaseOrderFilename("/"), "supplier-document");
  });
});
