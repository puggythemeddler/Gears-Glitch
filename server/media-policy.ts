// server/media-policy.ts
//
// Server-side twin of frontend/lib/image-allowlist.ts. The browser CSP `img-src`
// directive and the server's DB-backup fetch must agree on the same host set:
// the browser may only render these origins, and the server may only fetch them.
// tests/media-policy.test.ts pins this module to the frontend allowlist, and
// tests/image-delivery.test.ts pins both to the two CSP `img-src` directives.
//
// This file must stay a plain side-effect-free TS module (no Express, no DB) so
// the root unit suite can import it without booting a server.

import { lookup } from "dns/promises";

/**
 * Allowed external image origins for server-side fetching.
 *
 * MUST stay in sync with `ALLOWED_IMAGE_ORIGINS` in
 * frontend/lib/image-allowlist.ts AND with the `img-src` directives in
 * server/index.ts (helmet) and frontend/next.config.js. A value the browser can
 * render but the server won't fetch just skips the DB backup; a value the server
 * fetches but the browser blocks is the production outage in a new shape.
 */
export const ALLOWED_IMAGE_ORIGINS = ["https://res.cloudinary.com"] as const;

/** Upper bound for a single backup-image fetch, streamed (not buffered up-front). */
export const MAX_BACKUP_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Synchronous URL policy for the remote-fetch branch of backupImageToDb.
 *
 * Accepts only https URLs whose origin is on the allowlist. Rejects everything
 * else - http (including cloud-metadata targets), credentials embedded in the
 * URL, lookalike origins, non-image schemes. Redirects are additionally refused
 * at fetch time (redirect: "manual") so a Cloudinary URL cannot be coerced into
 * pointing at an internal host.
 */
export function isAllowedRemoteImageUrl(value?: string | null): boolean {
  if (!value) return false;
  let url: URL;
  try {
    url = new URL(String(value).trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  return (ALLOWED_IMAGE_ORIGINS as readonly string[]).includes(url.origin);
}

// Private / reserved IP blocks we refuse to fetch. This is a DNS-rebinding
// defense: an allowlisted hostname normally resolves to a public CDN edge, but
// if DNS ever answers with a private address (rebinding, poisoned cache, an
// on-host override) the fetch must not reach the internal network.
function isBlockedIpv4(a: number, b: number, c: number, d: number): boolean {
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24 (incl. IETF protocol assignments)
  if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 TEST-NET-1
  if (a === 198 && b === 18) return true; // 198.18.0.0/15 benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 TEST-NET-3
  if (a === 224 || a >= 240) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  return false;
}

function isBlockedIpv6(addr: string): boolean {
  const v = addr.toLowerCase();
  if (v === "::" || v === "::1") return true; // unspecified + loopback
  if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true; // fe80::/10 link-local
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // fc00::/7 unique local
  const mapped = v.match(/^::ffff:(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (mapped) return isBlockedIpv4(Number(mapped[1]), Number(mapped[2]), Number(mapped[3]), Number(mapped[4]));
  return false;
}

/**
 * Pure classifier for one resolved address. Exported so tests can exercise the
 * private-range table without touching DNS.
 */
export function isBlockedImageIp(ip: string): boolean {
  const trimmed = String(ip).trim().toLowerCase().split("%")[0];
  if (trimmed.includes(":")) return isBlockedIpv6(trimmed);
  const parts = trimmed.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return isBlockedIpv4(parts[0], parts[1], parts[2], parts[3]);
}

/**
 * Resolves the host of a remote image URL and returns true only when every
 * address it answers is public. `lookup` uses the OS resolver; a host that
 * fails to resolve or answers with a blocked range is treated as not fetchable.
 * Intended for the DB-backup fetch only, which is low-frequency (per upload).
 */
export async function assertPublicImageHost(urlValue: string): Promise<boolean> {
  let hostname: string;
  try {
    hostname = new URL(urlValue).hostname;
  } catch {
    return false;
  }
  try {
    const addresses = await lookup(hostname, { all: true });
    return addresses.length > 0 && addresses.every((a) => !isBlockedImageIp(a.address));
  } catch {
    return false;
  }
}