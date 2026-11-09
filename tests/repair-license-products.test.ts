import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isSoftwareLicenseProduct, softwareLicenseProductPrice } from "../frontend/lib/repairLicenseProducts";

describe("repair software-license catalog selection", () => {
  it("includes explicitly categorized software and licensed products", () => {
    assert.equal(isSoftwareLicenseProduct({ name: "Windows 11 Pro", category: "Software", subcategory: "" }), true);
    assert.equal(isSoftwareLicenseProduct({ name: "Microsoft 365 Business", category: "Subscriptions", subcategory: "" }), true);
    assert.equal(isSoftwareLicenseProduct({ name: "Windows 11 Pro License", category: "Digital", subcategory: "" }), true);
    assert.equal(isSoftwareLicenseProduct({ name: "Antivirus activation key", category: "Digital", subcategory: "" }), true);
  });

  it("does not mistake Windows laptops or general hardware for software licenses", () => {
    assert.equal(isSoftwareLicenseProduct({ name: "Dell Inspiron 14 3520", category: "Computers", subcategory: "Windows Laptops" }), false);
    assert.equal(isSoftwareLicenseProduct({ name: "Windows Gaming Laptop", category: "Computers", subcategory: "Gaming Laptops" }), false);
    assert.equal(isSoftwareLicenseProduct({ name: "Microsoft Surface Laptop", category: "Computers", subcategory: "Laptops" }), false);
  });

  it("uses the sale price when set and otherwise uses the catalog price", () => {
    assert.equal(softwareLicenseProductPrice({ price: 100, salePrice: 80 }), 80);
    assert.equal(softwareLicenseProductPrice({ price: 100, salePrice: null }), 100);
    assert.equal(softwareLicenseProductPrice({ price: 100, salePrice: 0 }), 100);
  });
});
