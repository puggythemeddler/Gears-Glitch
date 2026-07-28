const CUSTOMER_TOKEN_KEY = "customerStoreToken";
const STAFF_TOKEN_KEY = "computerStoreToken";
const PROVIDER_TOKEN_KEY = "providerToken";

let csrfToken: string | null = null;

export async function initCsrf() {
  try {
    const res = await fetch("/api/csrf-token", { credentials: "include" });
    const data = await res.json();
    csrfToken = data.csrfToken;
  } catch {}
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
  if (csrfToken && ["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    headers["X-CSRF-Token"] = csrfToken;
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
