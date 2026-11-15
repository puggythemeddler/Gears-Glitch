const SAFE_CONTACT_SCHEMES = new Set(["mailto:", "tel:", "sms:"]);
const MAX_LINK_LENGTH = 2048;

export function isSafeHref(raw: string): boolean {
  if (typeof raw !== "string") return false;
  const value = raw.trim();
  if (!value || value.length > MAX_LINK_LENGTH || /[\u0000-\u001f\u007f\\]/.test(value)) return false;
  const candidate = /^wa\.me\//i.test(value) ? `https://${value}` : value;
  if (candidate.startsWith("//")) return false;
  const compact = candidate.replace(/\s+/g, "");
  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(compact);
  if (!schemeMatch) return true;

  const scheme = `${schemeMatch[1].toLowerCase()}:`;
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
  return SAFE_CONTACT_SCHEMES.has(scheme) && compact.slice(schemeMatch[0].length).length > 0;
}

export function normalizeHref(raw: string | null | undefined, fallback = "#"): string {
  if (!raw) return fallback;
  const clean = raw.trim();
  if (!clean) return fallback;
  const candidate = clean.toLowerCase().startsWith("wa.me/") ? `https://${clean}` : clean;
  if (!isSafeHref(candidate)) return fallback;
  return candidate;
}
