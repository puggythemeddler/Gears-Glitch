const CUSTOMER_TOKEN_KEY = "customerStoreToken";
const STAFF_TOKEN_KEY = "computerStoreToken";
const PROVIDER_TOKEN_KEY = "providerToken";
const GUEST_CART_KEY = "guestCart";

let csrfToken: string | null = null;
// A-4: short-lived step-up token held only in memory (never persisted). Populated by
// obtainStepUpToken() after password re-verification and sent as X-Step-Up-Token on
// the high-risk actions that require re-auth (role change, staff delete, branch delete).
let stepUpToken: string | null = null;

export interface GuestCartItem {
  productId: string;
  quantity: number;
}

export function getGuestCart(): GuestCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((i: any) => i && i.productId && Number.isFinite(Number(i.quantity))) : [];
  } catch {
    return [];
  }
}

function setGuestCart(items: GuestCartItem[]): void {
  try { localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items)); } catch {}
}

export function addGuestCartItem(productId: string, quantity: number = 1): GuestCartItem[] {
  const items = getGuestCart();
  const existing = items.find((i) => i.productId === productId);
  if (existing) existing.quantity += quantity;
  else items.push({ productId, quantity });
  setGuestCart(items);
  return items;
}

export function updateGuestCartQuantity(productId: string, quantity: number): GuestCartItem[] {
  const items = getGuestCart();
  if (quantity <= 0) return removeGuestCartItem(productId);
  const existing = items.find((i) => i.productId === productId);
  if (existing) existing.quantity = quantity;
  setGuestCart(items);
  return items;
}

export function removeGuestCartItem(productId: string): GuestCartItem[] {
  const items = getGuestCart().filter((i) => i.productId !== productId);
  setGuestCart(items);
  return items;
}

export function clearGuestCart(): void {
  setGuestCart([]);
}

export function getGuestCartCount(): number {
  return getGuestCart().reduce((sum, i) => sum + i.quantity, 0);
}

export async function migrateGuestCartToServer(): Promise<void> {
  const items = getGuestCart();
  if (items.length === 0 || !isCustomerLoggedIn()) return;
  for (const it of items) {
    try {
      await api("/api/cart", { method: "POST", body: JSON.stringify({ productId: it.productId, quantity: it.quantity }) });
    } catch {}
  }
  clearGuestCart();
}

let csrfInitPromise: Promise<void> | null = null;

export function initCsrf(): Promise<void> {
  if (!csrfInitPromise) {
    csrfInitPromise = (async () => {
      try {
        const res = await fetch("/api/csrf-token", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        csrfToken = data.csrfToken ?? null;
      } catch {}
    })().finally(() => { csrfInitPromise = null; });
  }
  return csrfInitPromise;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

// A-4: Re-authenticate the current staff member with their password to obtain a
// short-lived step-up token required by high-risk actions (role change, staff delete,
// branch delete). Returns true on success; the token is stored in memory only.
export async function obtainStepUpToken(password: string): Promise<boolean> {
  try {
    if (!csrfToken) await initCsrf();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
    const res = await fetch("/api/auth/staff/step-up", {
      method: "POST",
      headers,
      body: JSON.stringify({ password }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data?.stepUpToken) return false;
    stepUpToken = data.stepUpToken;
    return true;
  } catch {
    return false;
  }
}

// A-1: the session JWT is held in an httpOnly, same-site cookie set by the server,
// so it is never readable by JavaScript. Below, the legacy Authorization-header
// (localStorage JWT) path is retained ONLY as a backwards-compatible fallback for
// sessions created before this change, so nobody is logged out mid-rollout. New
// logins no longer persist the token to localStorage — we store just non-sensitive
// role/permission metadata for UI gating while the server enforces real auth via
// the httpOnly cookie.

const ROLE_KEY = "ggRole";          // "customer" | "staff" | "provider"
const STAFF_ROLE_KEY = "ggStaffRole"; // admin|owner|manager|technician|staff|provider
const PERMS_KEY = "ggPerms";         // JSON array of permission strings (UI gating only)

// In-memory session captured from /api/auth/session (server is the source of truth).
let sessionRole: "customer" | "staff" | "provider" | null = null;
let sessionStaffRole: string | null = null;
let sessionStaffPerms: string[] = [];

function decodeJwtPayload(token: string): any | null {
  try {
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

export function getCustomerToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CUSTOMER_TOKEN_KEY);
}

export function getStaffToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STAFF_TOKEN_KEY);
}

export function getProviderToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PROVIDER_TOKEN_KEY);
}

export function getStaffRole(): string | null {
  if (sessionStaffRole) return sessionStaffRole;
  if (typeof window !== "undefined") {
    const m = localStorage.getItem(STAFF_ROLE_KEY);
    if (m) return m;
    const legacy = getStaffToken();
    if (legacy) { const p = decodeJwtPayload(legacy); if (p?.role) return p.role; }
  }
  return null;
}

export function getStaffPermissions(): string[] {
  if (sessionStaffPerms.length) return sessionStaffPerms;
  if (typeof window !== "undefined") {
    try {
      const m = localStorage.getItem(PERMS_KEY);
      if (m) { const arr = JSON.parse(m); if (Array.isArray(arr)) return arr; }
    } catch {}
    const legacy = getStaffToken();
    if (legacy) { const p = decodeJwtPayload(legacy); if (Array.isArray(p?.permissions)) return p.permissions; }
  }
  return [];
}

export function getTokenForRole(role?: string): string | null {
  const r = role || getRole();
  if (r === "customer") return getCustomerToken();
  if (r === "staff") return getStaffToken();
  if (r === "provider") return getProviderToken();
  return null;
}

export function getRole(): "customer" | "staff" | "provider" | null {
  if (sessionRole) return sessionRole;
  if (typeof window !== "undefined") {
    const m = localStorage.getItem(ROLE_KEY);
    if (m === "customer" || m === "staff" || m === "provider") return m;
    if (getStaffToken()) return "staff";
    if (getCustomerToken()) return "customer";
    if (getProviderToken()) return "provider";
  }
  return null;
}

// A-1: boolean "is this role authenticated" checks. These must stay true for
// cookie sessions (where no JS token exists), unlike getStaffToken()/etc. which
// only return a legacy JS token for the Authorization header.
export function hasStaffSession(): boolean {
  return !!getStaffToken() || getRole() === "staff";
}

export function hasCustomerSession(): boolean {
  return !!getCustomerToken() || getRole() === "customer";
}

export function hasProviderSession(): boolean {
  return !!getProviderToken() || getRole() === "provider";
}

function writeSessionMeta(role: "customer" | "staff" | "provider", staffRole: string | null, perms: string[]): void {
  sessionRole = role;
  sessionStaffRole = staffRole;
  sessionStaffPerms = perms;
  if (typeof window === "undefined") return;
  localStorage.setItem(ROLE_KEY, role);
  if (staffRole) localStorage.setItem(STAFF_ROLE_KEY, staffRole); else localStorage.removeItem(STAFF_ROLE_KEY);
  if (perms.length) localStorage.setItem(PERMS_KEY, JSON.stringify(perms)); else localStorage.removeItem(PERMS_KEY);
}

function clearSessionMeta(): void {
  sessionRole = null;
  sessionStaffRole = null;
  sessionStaffPerms = [];
  if (typeof window === "undefined") return;
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(STAFF_ROLE_KEY);
  localStorage.removeItem(PERMS_KEY);
}

// Move a session token from the API response / legacy storage into the A-1
// httpOnly cookie flow: clear the JS-readable token, record UI-gating metadata
// (the server already set an httpOnly cookie on the auth-success response).
function adoptSession(role: "customer" | "staff" | "provider", staffRole: string | null, perms: string[], name: string): void {
  writeSessionMeta(role, staffRole, perms);
  if (typeof window === "undefined") return;
  localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  localStorage.removeItem(STAFF_TOKEN_KEY);
  localStorage.removeItem(PROVIDER_TOKEN_KEY);
  if (role === "customer") localStorage.setItem("customerStoreName", name);
  if (role === "staff") localStorage.setItem("staffUserName", name);
  if (role === "provider") localStorage.setItem("providerStoreName", name);
}

// A-1: bootstrap the session from the httpOnly cookie (server-side truth). Call on
// app mount. Falls back to legacy localStorage JWT so existing sessions survive
// the rollout; once a cookie session is confirmed we purge the legacy token.
export async function bootstrapSession(): Promise<void> {
  try {
    const data = await api<{ role?: string | null; staffRole?: string; roleName?: string; username?: string; email?: string; name?: string; permissions?: string[] }>("/api/auth/session");
    if (data?.role) {
      const role = data.role === "customer" || data.role === "provider" ? data.role : "staff";
      const staffRole = role === "staff" ? data.role : null;
      const perms = Array.isArray(data.permissions) ? data.permissions : [];
      const name = data.name || data.username || data.email || "";
      writeSessionMeta(role, staffRole, perms);
      if (typeof window !== "undefined") {
        if (role === "customer" && name) localStorage.setItem("customerStoreName", name);
        if (role === "staff" && name) localStorage.setItem("staffUserName", name);
        if (role === "provider" && name) localStorage.setItem("providerStoreName", name);
        // Cookie is authoritative now — drop any legacy JS-readable token.
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        localStorage.removeItem(STAFF_TOKEN_KEY);
        localStorage.removeItem(PROVIDER_TOKEN_KEY);
      }
      return;
    }
  } catch {}
  // No cookie session: keep a legacy localStorage JWT session (header path) until re-login.
  if (typeof window !== "undefined" && getTokenForRole()) {
    const role = getRole();
    if (role) {
      const legacy = role === "staff" ? getStaffToken() : role === "customer" ? getCustomerToken() : getProviderToken();
      const p = legacy ? decodeJwtPayload(legacy) : null;
      writeSessionMeta(role, role === "staff" ? (p?.role || null) : null, role === "staff" ? (Array.isArray(p?.permissions) ? p.permissions : []) : []);
    }
  }
}

export async function logoutServer(): Promise<void> {
  try { await api("/api/auth/logout", { method: "POST" }); } catch {}
}

export function setCustomerSession(token: string, name: string) {
  // A-1: server sets httpOnly cookie; here we just record UI gating metadata.
  adoptSession("customer", null, [], name);
}

export function setStaffSession(token: string, name: string, role: string, permissions: string[] = []) {
  adoptSession("staff", role, permissions, name);
}

export function setProviderSession(token: string, name: string) {
  adoptSession("provider", null, [], name);
}

export function clearCustomerSession() {
  if (typeof window !== "undefined") localStorage.removeItem("customerStoreName");
  if (getRole() === "customer") clearSessionMeta();
  if (typeof window !== "undefined") localStorage.removeItem(CUSTOMER_TOKEN_KEY);
}

export function clearStaffSession() {
  if (typeof window !== "undefined") localStorage.removeItem("staffUserName");
  if (getRole() === "staff") clearSessionMeta();
  if (typeof window !== "undefined") localStorage.removeItem(STAFF_TOKEN_KEY);
}

export function clearProviderSession() {
  if (typeof window !== "undefined") localStorage.removeItem("providerStoreName");
  if (getRole() === "provider") clearSessionMeta();
  if (typeof window !== "undefined") localStorage.removeItem(PROVIDER_TOKEN_KEY);
}

export function clearAllSessions() {
  clearCustomerSession();
  clearStaffSession();
  clearProviderSession();
  clearSessionMeta();
}

export async function api<T = any>(
  path: string,
  options: RequestInit = {},
  role?: "customer" | "staff" | "provider"
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const token = getTokenForRole(role);
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (stepUpToken) headers["X-Step-Up-Token"] = stepUpToken;
  const method = (options.method || "GET").toUpperCase();
  const mutating = ["POST", "PUT", "DELETE", "PATCH"].includes(method);
  if (mutating && !csrfToken) await initCsrf();
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

  let res = await fetch(path, { ...options, headers, credentials: "include" });

  // Self-heal a stale/missing CSRF token (e.g. another tab refreshed it):
  // re-fetch a token matching the current cookie and retry the request once.
  if (mutating && res.status === 403) {
    let csrfError = false;
    try {
      const body = await res.clone().json();
      csrfError = typeof body?.error === "string" && body.error.includes("CSRF");
    } catch {}
    if (csrfError) {
      csrfToken = null;
      await initCsrf();
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      res = await fetch(path, { ...options, headers, credentials: "include" });
    }
  }
  let text = "";
  try {
    text = await res.text();
  } catch {
    text = "";
  }
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function isCustomerLoggedIn(): boolean {
  return getRole() === "customer";
}

export async function downloadPdf(url: string, filename: string): Promise<void> {
  const token = getTokenForRole();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const separator = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${separator}format=pdf`, { headers, credentials: "include" });
  if (!res.ok) {
    let errMsg = `Failed (${res.status})`;
    try { const d = await res.json(); errMsg = d.error || errMsg; } catch {}
    throw new Error(errMsg);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export function requireCustomerLogin(redirect?: string): boolean {
  if (isCustomerLoggedIn()) return true;
  const target = redirect || (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");
  if (typeof window !== "undefined") {
    window.location.href = `/login?redirect=${encodeURIComponent(target)}`;
  }
  return false;
}
