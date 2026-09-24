import type { NextFunction, Request, Response } from "express";

// Same-origin + explicit allowlist CORS policy for the control plane.
//
// The old `cors({ origin: true, credentials: true })` reflected *any* origin,
// so any website a logged-in admin visited could make credentialed requests to
// the CP admin API. Browsers only send an `Origin` header for cross-site
// requests, so the policy here is:
//   * no Origin header (curl, same-origin GET, server-to-server)        -> allow
//   * Origin host matches the request Host header (same origin, proxy)  -> allow
//   * Origin listed in ALLOWED_ORIGINS (control plane URL)              -> allow
//   * anything else                                                     -> no CORS headers
// Disallowed origins still complete the request/OPTIONS, but without
// Access-Control-* headers the browser enforces the block.

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

// Normalizes an Origin URL to its lowercase `host[:port]`. Returns "" when the
// value is unparseable or empty so it can never match (fail closed).
export function normalizeOrigin(origin: string): string {
  try {
    const u = new URL(origin);
    if (!u.host) return "";
    return u.host.toLowerCase();
  } catch {
    return "";
  }
}

// Normalizes a Host header to the same `host[:port]` shape used by
// normalizeOrigin (Host headers never carry a scheme or path, but tolerate both
// anyway, e.g. when the value arrives through a proxy health check).
export function normalizeHost(host: string): string {
  let h = String(host).trim().toLowerCase();
  const schemeIdx = h.indexOf("://");
  if (schemeIdx >= 0) h = h.slice(schemeIdx + 3);
  const slashIdx = h.indexOf("/");
  if (slashIdx >= 0) h = h.slice(0, slashIdx);
  return h;
}

export function isOriginAllowed(
  origin: string | undefined,
  requestHost: string | undefined,
  allowedOrigins: string[]
): boolean {
  if (!origin) return true;
  const base = normalizeOrigin(origin);
  if (!base) return false;
  if (requestHost && normalizeHost(requestHost) === base) return true;
  return allowedOrigins.map(normalizeOrigin).includes(base);
}

// Mountable middleware enforcing the policy above. Replaces the reflect-any
// `cors` package configuration.
export function corsPolicyMiddleware(allowedOrigins: string[] = []) {
  const allowlist = allowedOrigins.map(normalizeOrigin).filter(Boolean);

  return function corsPolicy(req: Request, res: Response, next: NextFunction) {
    const origin = typeof req.headers.origin === "string" && req.headers.origin ? req.headers.origin : undefined;
    const host = typeof req.headers.host === "string" && req.headers.host ? req.headers.host : undefined;
    const allowed = isOriginAllowed(origin, host, allowlist);

    if (origin) {
      res.vary("Origin");
      if (allowed) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
      }
    }

    if (req.method === "OPTIONS") {
      if (allowed) {
        res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE");
        const reqHeaders = req.headers["access-control-request-headers"];
        res.setHeader(
          "Access-Control-Allow-Headers",
          typeof reqHeaders === "string" ? reqHeaders : "Content-Type, Authorization, x-api-key, x-control-plane-key"
        );
        res.setHeader("Access-Control-Max-Age", "86400");
      }
      res.status(204).end();
      return;
    }

    next();
  };
}