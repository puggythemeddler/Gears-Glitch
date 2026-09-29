/**
 * Image source allowlist - the single source of truth for "can the browser
 * actually render this URL?".
 *
 * This is deliberately a plain .ts module with no React and no JSX: the policy
 * is asserted directly by tests/image-delivery.test.ts, and the repo's root
 * tsconfig has no --jsx flag, so a test could not import the component itself.
 *
 * It MUST stay in sync with the `img-src` directive in BOTH
 * frontend/next.config.js and server/index.ts (helmet). If all three disagree
 * an image either loads in dev and breaks in production, or is rejected here
 * while the browser would have accepted it.
 */

/**
 * Allowed external image origins.
 *
 * Media is not proxied. server/upload.ts stores whatever URL the storage engine
 * returns, so a Cloudinary-configured shop has absolute
 * `https://res.cloudinary.com/...` values in products.image_url,
 * product_images, repair_images and the logo/favicon settings. Local-disk shops
 * emit same-origin `/uploads/...` instead.
 *
 * Add one specific vendor host here - never a wildcard and never `https:`.
 * A merchant who types a host that is not on this list gets a labelled
 * fallback, which is a visible, fixable state; a wildcard would make the CSP
 * meaningless.
 */
export const ALLOWED_IMAGE_ORIGINS = ["https://res.cloudinary.com"] as const;

const DATA_URL_RE = /^data:image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon|svg\+xml)[;,]/i;
const BLOB_URL_RE = /^blob:/i;
const ABSOLUTE_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

/**
 * True when a browser can actually render this URL under the current CSP.
 *
 * Accepts: same-origin paths (/uploads/..., /api/images/...), image data: and
 * blob: URLs, and https origins on the allowlist. Everything else - including
 * http:, protocol-relative //host, non-image data URLs and arbitrary
 * merchant-entered hosts - is rejected so the caller can show a fallback
 * instead of a broken image.
 */
export function isAllowedImageSrc(src?: string | null): boolean {
  if (!src) return false;
  const v = String(src).trim();
  if (!v) return false;
  if (DATA_URL_RE.test(v)) return true;
  if (BLOB_URL_RE.test(v)) return true;
  // No scheme means root-relative, which is same-origin. "//host" is
  // protocol-relative and therefore external - never allow it.
  if (!ABSOLUTE_SCHEME_RE.test(v)) return v.startsWith("/") && !v.startsWith("//");
  try {
    const url = new URL(v);
    if (url.protocol !== "https:") return false;
    return (ALLOWED_IMAGE_ORIGINS as readonly string[]).includes(url.origin);
  } catch {
    return false;
  }
}

/**
 * Host label for a rejected URL, for the fallback message and dev warning.
 * Never returns the full URL - a Cloudinary URL can carry a signed query
 * string, and the fallback text is visible on screen and in logs.
 */
export function imageHostLabel(src: string): string {
  try {
    return new URL(src).host;
  } catch {
    return src.split("/")[0] || "external host";
  }
}
