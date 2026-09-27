export function escapeHtml(v: string) {
  const d = document.createElement("div");
  d.textContent = v;
  return d.innerHTML;
}

/**
 * Constrain a post-login destination to a path on this origin.
 *
 * `?redirect=` is attacker-controllable, so passing it straight to router.push
 * turns /login into an open redirect: a victim authenticates and is bounced to
 * a look-alike page that harvests their session. Only same-origin, path-relative
 * values are accepted. Protocol-relative ("//evil.com"), backslash ("/\evil.com")
 * and scheme ("https:") forms are all rejected, and the value must survive
 * decoding as a plain path.
 */
export function safeRedirectPath(
  value: unknown,
  fallback = "/dashboard"
): string {
  // router.query hands back string[] when a param is repeated, so unwrap first
  // and only then type-check - the reverse order makes the array branch dead.
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  // Reject anything that decodes into an absolute or scheme-relative URL.
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  if (!decoded.startsWith("/")) return fallback;
  if (decoded.startsWith("//") || decoded.startsWith("/\\")) return fallback;
  if (/^\s*[a-z][a-z0-9+.-]*:/i.test(decoded)) return fallback;
  return decoded;
}
