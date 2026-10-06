// Base URL for links a human clicks.
//
// These links live in emails - password resets, "view your order", cart
// recovery, quote and dashboard links - so they must resolve to the FRONTEND.
// BASE_URL is the API origin, which on a split deployment (API on Render,
// storefront on Vercel) serves no HTML at all, so a link built from it 404s.
//
// The OAuth redirect (gmail.ts) and the M-Pesa callback deliberately keep
// using BASE_URL: those are server-to-server endpoints and must hit the API.
// CORS in index.ts is the same - it whitelists the frontend's origin.
export function publicBaseUrl(fallback = ""): string {
  // Trimmed, so a stray space in the dashboard does not turn every link into a
  // relative one ("   /account?reset=...") that cannot resolve inside an email.
  const frontend = String(process.env.FRONTEND_URL || "").trim();
  const base = String(process.env.BASE_URL || "").trim();
  return (frontend || base || fallback).replace(/\/$/, "");
}