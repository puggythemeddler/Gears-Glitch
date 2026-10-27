/** Validation helpers for durable Website Studio values saved from the client. */
const MAX_STUDIO_LINK_LENGTH = 2048;
const SAFE_LINK_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:", "sms:"]);

/**
 * Check a persisted Studio link without rewriting it. This mirrors the
 * storefront link policy: relative destinations and common contact links are
 * allowed, while script/data/unknown schemes, protocol-relative URLs,
 * controls, and backslashes are rejected.
 */
export function isSafeStudioLink(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_STUDIO_LINK_LENGTH) return false;
  const clean = value.trim();
  if (!clean || /[\u0000-\u001f\u007f\\]/.test(clean)) return false;

  // The renderer recognizes the common bare WhatsApp host form and upgrades
  // it to HTTPS. Validate that exact form here as well.
  const candidate = /^wa\.me\//i.test(clean) ? `https://${clean}` : clean;
  if (candidate.startsWith("//")) return false;

  // Catch disguised schemes such as "java script:" using the same compact
  // inspection the client link helper uses, without persisting a normalized
  // or otherwise altered value.
  const compact = candidate.replace(/\s+/g, "");
  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(compact);
  if (!schemeMatch) return true;

  const scheme = `${schemeMatch[1].toLowerCase()}:`;
  if (!SAFE_LINK_SCHEMES.has(scheme)) return false;
  if (scheme === "http:" || scheme === "https:") {
    if (!/^https?:\/\//i.test(candidate)) return false;
    try {
      const url = new URL(candidate);
      return (url.protocol === "http:" || url.protocol === "https:")
        && Boolean(url.hostname)
        && !url.username
        && !url.password;
    } catch {
      return false;
    }
  }

  return compact.slice(schemeMatch[0].length).length > 0;
}

export function isSafePersistedImage(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 2000 || value.trim() !== value) return false;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === "https://res.cloudinary.com" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value);
}
