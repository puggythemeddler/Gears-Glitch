export type PurchaseOrderDocumentMime = "application/pdf" | "image/jpeg" | "image/png";
export type PurchaseOrderDocumentType = "supplier_quote" | "supplier_purchase_order" | "invoice" | "delivery_note";

const MIME_EXTENSIONS: Record<PurchaseOrderDocumentMime, RegExp> = {
  "application/pdf": /\.pdf$/i,
  "image/jpeg": /\.(jpe?g)$/i,
  "image/png": /\.png$/i,
};

export function validatePurchaseOrderDocument(
  mime: string,
  filename: string,
  bytes: Buffer
): { ok: true; mime: PurchaseOrderDocumentMime } | { ok: false; error: string } {
  if (!(mime in MIME_EXTENSIONS) || !MIME_EXTENSIONS[mime as PurchaseOrderDocumentMime].test(filename || "")) {
    return { ok: false, error: "Attach a PDF, JPEG, or PNG supplier document. The filename and file type must match." };
  }
  const signature = bytes.subarray(0, 8).toString("hex").toLowerCase();
  const validSignature = mime === "application/pdf" ? bytes.subarray(0, 5).toString("ascii") === "%PDF-"
    : mime === "image/jpeg" ? signature.startsWith("ffd8ff")
    : signature === "89504e470d0a1a0a";
  if (!bytes.length || !validSignature) {
    return { ok: false, error: "The file contents do not match a supported PDF, JPEG, or PNG document." };
  }
  return { ok: true, mime: mime as PurchaseOrderDocumentMime };
}

export function sanitizePurchaseOrderFilename(filename: string): string {
  const basename = filename.replace(/\\/g, "/").split("/").pop() || "supplier-document";
  return basename.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 180) || "supplier-document";
}

export function purchaseOrderDocumentTypeLabel(value: string): string {
  return ({
    supplier_quote: "Supplier quote",
    supplier_purchase_order: "Supplier purchase order",
    invoice: "Invoice / tax invoice",
    delivery_note: "Delivery note",
  } as Record<string, string>)[value] || "Supplier document";
}
