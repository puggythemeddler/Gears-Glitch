const CUSTOMER_TOKEN_KEY = "customerStoreToken";
const STAFF_TOKEN_KEY = "computerStoreToken";
const PROVIDER_TOKEN_KEY = "providerToken";
const GUEST_CART_KEY = "guestCart";

let csrfToken: string | null = null;

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

export async function initCsrf() {
  try {
    const res = await fetch("/api/csrf-token", { credentials: "include" });
    const data = await res.json();
    csrfToken = data.csrfToken;
  } catch {}
}

export function getCsrfToken(): string | null {
  return csrfToken;
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

export function getTokenForRole(role?: string): string | null {
  const r = role || getRole();
  if (r === "customer") return getCustomerToken();
  if (r === "staff") return getStaffToken();
  if (r === "provider") return getProviderToken();
  return null;
}

export function getRole(): "customer" | "staff" | "provider" | null {
  if (getStaffToken()) return "staff";
  if (getCustomerToken()) return "customer";
  if (getProviderToken()) return "provider";
  return null;
}

export function setCustomerSession(token: string, name: string) {
  localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  localStorage.setItem("customerStoreName", name);
}

export function clearCustomerSession() {
  localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  localStorage.removeItem("customerStoreName");
}

export function clearStaffSession() {
  localStorage.removeItem(STAFF_TOKEN_KEY);
  localStorage.removeItem("staffUserName");
}

export function clearProviderSession() {
  localStorage.removeItem(PROVIDER_TOKEN_KEY);
  localStorage.removeItem("providerStoreName");
}

export function clearAllSessions() {
  clearCustomerSession();
  clearStaffSession();
  clearProviderSession();
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
  const method = (options.method || "GET").toUpperCase();
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    if (!csrfToken) await initCsrf();
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  }

  const res = await fetch(path, { ...options, headers });
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
  return !!getCustomerToken();
}

export async function downloadPdf(url: string, filename: string): Promise<void> {
  const token = getTokenForRole();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const separator = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${separator}format=pdf`, { headers });
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
