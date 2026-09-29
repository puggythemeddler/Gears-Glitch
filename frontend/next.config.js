/** @type {import('next').NextConfig} */

// The Express API already sets a CSP via helmet, but that only covers API
// responses. The storefront and admin HTML is served by Next, so it needs its
// own headers here.
//
// CSP note: the Pages Router injects inline bootstrap/hydration scripts and
// there is no middleware in this app to mint a per-request nonce, so
// script-src has to allow 'unsafe-inline'. That still blocks remote script
// hosts and the other directives below do the real work (no framing, no
// base-uri hijack, no form-action hijack, no plugin content, and image/connect
// traffic restricted to same-origin). Converting this to a nonce-based policy
// needs middleware.ts and is tracked as follow-up work.
const isProd = process.env.NODE_ENV === "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-inline' is required for Next's inline hydration payload - see note above.
  isProd ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // Fonts are self-hosted by next/font, so no external font origins are needed.
  "font-src 'self' data:",
  // Product media is NOT proxied. server/upload.ts stores the absolute URL
  // that multer-storage-cloudinary returns, so products.image_url,
  // product_images, repair_images and the logo/favicon settings point straight
  // at res.cloudinary.com. That one vendor host has to be allowed or every
  // Cloudinary-backed image is silently blocked in the browser. No wildcard and
  // no arbitrary origins: merchant-entered hosts outside this list are rejected
  // by <Media> and render a labelled fallback instead. Local-disk mode uses
  // /uploads and the DB backup uses /api/images, both covered by 'self'.
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "connect-src 'self' ws: wss:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          // same-origin-allow-popups keeps the Google OAuth popup working while
          // still severing the opener reference for everything else.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
  async rewrites() {
    // Rewrites run on the Next.js server, so this must not use a NEXT_PUBLIC_
    // variable. A stale public Vercel variable previously overrode the working
    // backend and sent every product and login request to a retired URL.
    const backendUrl = (process.env.BACKEND_URL || (process.env.NODE_ENV === "production" ? "https://gears-glitch.onrender.com" : "http://localhost:8020"))
      .trim()
      .replace(/\/$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
