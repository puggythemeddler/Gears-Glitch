const FORBIDDEN_SCHEMES = ["javascript:", "data:", "vbscript:", "file:", "filesystem:", "blob:"];
const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:", "sms:"]);
const MAX_LINK_LENGTH = 2048;

export function isSafeHref(raw: string): boolean {
  if (typeof raw !== "string") return false;
  const clean = raw.trim().replace(/\s+/g, "");
  if (!clean || clean.length > MAX_LINK_LENGTH) return false;
  const lower = clean.toLowerCase();
  if (SAFE_SCHEMES.has(lower)) return false;
  for (const scheme of FORBIDDEN_SCHEMES) {
    if (lower.startsWith(scheme)) return false;
  }
  if (lower.startsWith("//")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean)) {
    const actualScheme = lower.slice(0, lower.indexOf(":") + 1);
    if (!SAFE_SCHEMES.has(actualScheme)) return false;
  }
  return true;
}

export function normalizeHref(raw: string | null | undefined, fallback = "#"): string {
  if (!raw) return fallback;
  const clean = raw.trim();
  if (!clean) return fallback;
  if (clean.toLowerCase().startsWith("wa.me/")) {
    return `https://${clean}`;
  }
  if (!isSafeHref(clean)) return fallback;
  return clean;
}