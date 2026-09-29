import React, { useEffect, useState } from "react";
import { ALLOWED_IMAGE_ORIGINS, isAllowedImageSrc, imageHostLabel } from "@/lib/image-allowlist";

/**
 * Single entry point for every image in the app.
 *
 * Why this exists: media is NOT proxied. server/upload.ts stores whatever URL
 * the storage engine returns, so a Cloudinary-configured shop has absolute
 * `https://res.cloudinary.com/...` values sitting in products.image_url,
 * product_images, repair_images, the logo/favicon settings and Website Studio
 * sections. Local-disk shops have `/uploads/...`. A browser will only load the
 * first kind if the CSP `img-src` directive allows that host, so a raw
 * `<img src={row.imageUrl}>` is a silent breakage the moment CSP and storage
 * disagree. That is not hypothetical: it is why the production storefront
 * rendered broken images for every Cloudinary-backed product.
 *
 * This component makes that failure impossible to miss:
 *   - off-list hosts never issue a request, they render a labelled fallback
 *   - a load error swaps in the same fallback instead of a broken-image icon
 *   - every image gets loading/decoding hints and, when the caller knows the
 *     intrinsic size, width+height so the browser reserves the box
 *
 * The allowlist itself lives in lib/image-allowlist.ts so it can be asserted
 * without JSX, and must be kept in sync with the `img-src` directive in
 * frontend/next.config.js and server/index.ts (helmet). All three agree, or
 * images break in the browser and nowhere else.
 */
export { ALLOWED_IMAGE_ORIGINS, isAllowedImageSrc } from "@/lib/image-allowlist";

function FallbackGlyph() {
  return (
    <svg
      className="media-fallback__icon"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="4.5" width="18" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="10" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3.75 17.25l4.5-4.5 3.5 3.5 3.25-2.75 5.25 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type MediaState = "ready" | "error" | "blocked" | "empty";

export interface MediaProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "width" | "height" | "loading"> {
  /** Raw stored URL. May be "", null, a relative /uploads path or a Cloudinary URL. */
  src?: string | null;
  /** Required. Pass "" only when the image is purely decorative. */
  alt: string;
  /** Intrinsic width in px. Supplies the aspect-ratio hint that prevents layout shift. */
  width?: number;
  /** Intrinsic height in px. */
  height?: number;
  loading?: "lazy" | "eager";
  /** object-fit. An explicit `style` from the caller still wins. */
  fit?: "cover" | "contain";
  /** Rendered under the glyph when an image is blocked or fails to load. */
  fallbackLabel?: string;
  /** Custom fallback content; replaces the default glyph + label. */
  fallback?: React.ReactNode;
}

/**
 * Drop-in replacement for <img src>. Same className and style contract, so
 * existing CSS keeps working: on error the element swaps to a div carrying the
 * same classes, which occupies exactly the same box.
 */
export function Media({
  src,
  alt,
  width,
  height,
  loading = "lazy",
  fit,
  fallbackLabel,
  fallback,
  className = "",
  style,
  onLoad,
  onError,
  ...rest
}: MediaProps) {
  const raw = typeof src === "string" ? src.trim() : "";
  const allowed = isAllowedImageSrc(raw);
  const [state, setState] = useState<MediaState>(raw ? (allowed ? "ready" : "blocked") : "empty");

  // A new src invalidates whatever the previous one decided.
  useEffect(() => {
    setState(raw ? (allowed ? "ready" : "blocked") : "empty");
  }, [raw, allowed]);

  useEffect(() => {
    if (state !== "blocked" || !raw) return;
    if (process.env.NODE_ENV === "production") return;
    // Host only - never the full URL, which can carry a signed query string.
    console.warn(
        `[Media] Blocked image host "${imageHostLabel(raw)}" is not in ALLOWED_IMAGE_ORIGINS. ` +
        `Add it to frontend/lib/image-allowlist.ts, next.config.js and server/index.ts.`
    );
  }, [state, raw]);

  const boxStyle = fit ? { objectFit: fit, ...style } : style;

  if (state === "empty" || state === "blocked" || state === "error") {
    // The label is opt-in via `fallbackLabel`. A 40px admin table thumb must stay
    // a bare glyph, while a 350px product placeholder has room to explain that
    // the host was rejected. Guessing from box size is not possible in CSS here
    // because the caller styles the element directly.
    const showLabel = state !== "empty" && !!fallbackLabel;
    return (
      <div
        className={`media-fallback ${showLabel ? "media-fallback--labelled" : ""} ${className}`.trim()}
        style={boxStyle}
        role={state === "blocked" ? "img" : undefined}
        aria-label={state === "blocked" ? alt || "Image unavailable" : undefined}
        data-media-state={state}
      >
        {fallback ?? (
          <>
            <FallbackGlyph />
            {showLabel && (
              <span className="media-fallback__label">
                {state === "blocked" ? `Host not allowed - ${imageHostLabel(raw)}` : "Image unavailable"}
                {fallbackLabel ? ` - ${fallbackLabel}` : ""}
              </span>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      className={className}
      style={boxStyle}
      src={raw}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      onLoad={(e) => {
        setState("ready");
        onLoad?.(e);
      }}
      onError={(e) => {
        setState("error");
        onError?.(e);
      }}
    />
  );
}

export default Media;
