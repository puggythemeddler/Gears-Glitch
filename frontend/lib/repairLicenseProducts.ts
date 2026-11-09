import type { Product } from "./types";

const SOFTWARE_LICENSE_TERMS = /\b(?:software|licen[cs]e|antivirus|operating\s+system|activation\s+key)\b|\bmicrosoft\s*(?:365|office)\b|\boffice\s*(?:365|20\d{2})\b/i;

export function isSoftwareLicenseProduct(
  product: Pick<Product, "name" | "category" | "subcategory">,
): boolean {
  return SOFTWARE_LICENSE_TERMS.test(
    [product.name, product.category, product.subcategory].filter(Boolean).join(" "),
  );
}

export function softwareLicenseProductPrice(
  product: Pick<Product, "price" | "salePrice">,
): number {
  const salePrice = Number(product.salePrice);
  return salePrice > 0 ? salePrice : Number(product.price) || 0;
}
