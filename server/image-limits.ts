// Per-item image caps.
//
// Uploads were previously unbounded: a shop could attach unlimited gallery
// images to a single product, or unlimited before/after photos to a single
// repair ticket, with no server-side ceiling. That is a cheap way to exhaust
// storage (and, on Cloudinary, paid quota) and to bloat any client that loads
// the full gallery. These caps are enforced before the upload file is written.
//
// The limits are configurable per deployment via env vars, clamped to a sane
// floor so a misconfiguration can never disable the cap entirely.

export const DEFAULT_MAX_PRODUCT_IMAGES = 12;
export const DEFAULT_MAX_REPAIR_IMAGES = 20;

export function parseLimit(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i < 1) return fallback;
  return i;
}

export const MAX_PRODUCT_IMAGES = parseLimit(process.env.MAX_PRODUCT_IMAGES, DEFAULT_MAX_PRODUCT_IMAGES);
export const MAX_REPAIR_IMAGES = parseLimit(process.env.MAX_REPAIR_IMAGES, DEFAULT_MAX_REPAIR_IMAGES);

/** True when one more image may be added (existing count is below the cap). */
export function withinImageLimit(existingCount: number, max: number): boolean {
  return existingCount < max;
}

export function productImageLimitMessage(max: number = MAX_PRODUCT_IMAGES): string {
  return `This product already has the maximum of ${max} images. Remove one before adding another.`;
}

export function repairImageLimitMessage(max: number = MAX_REPAIR_IMAGES): string {
  return `This repair already has the maximum of ${max} images. Remove one before adding another.`;
}
