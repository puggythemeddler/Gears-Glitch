/** Validation helpers for durable Website Studio values saved from the client. */
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
