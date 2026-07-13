const CUSTOMER_TOKEN_KEY = "customerStoreToken";
const STAFF_TOKEN_KEY = "computerStoreToken";
const PROVIDER_TOKEN_KEY = "providerToken";

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

export function requireCustomerLogin(redirect?: string): boolean {
  if (isCustomerLoggedIn()) return true;
  const target = redirect || (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");
  if (typeof window !== "undefined") {
    window.location.href = `/login?redirect=${encodeURIComponent(target)}`;
  }
  return false;
}
