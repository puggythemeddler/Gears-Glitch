import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { isCustomerLoggedIn, getCustomerToken, setCustomerSession, clearAllSessions, api, initCsrf } from "./api";
import type { Settings } from "./types";
import { setFormatConfig } from "@/layouts/shared";

const DEFAULT_FAVICON = "/default-favicon.png";

const TIMEZONE_CURRENCY: Record<string, string> = {
  "Africa/Nairobi": "KES", "Africa/Lagos": "NGN", "Africa/Johannesburg": "ZAR",
  "Africa/Cairo": "EGP", "Africa/Casablanca": "MAD", "Africa/Accra": "GHS",
  "America/New_York": "USD", "America/Chicago": "USD", "America/Denver": "USD",
  "America/Los_Angeles": "USD", "America/Toronto": "CAD", "America/Vancouver": "CAD",
  "America/Sao_Paulo": "BRL", "America/Mexico_City": "MXN",
  "Europe/London": "GBP", "Europe/Paris": "EUR", "Europe/Berlin": "EUR",
  "Europe/Madrid": "EUR", "Europe/Rome": "EUR", "Europe/Amsterdam": "EUR",
  "Asia/Tokyo": "JPY", "Asia/Shanghai": "CNY", "Asia/Hong_Kong": "HKD",
  "Asia/Singapore": "SGD", "Asia/Dubai": "AED", "Asia/Kolkata": "INR",
  "Asia/Bangkok": "THB", "Asia/Seoul": "KRW", "Australia/Sydney": "AUD",
  "Pacific/Auckland": "NZD", "Asia/Jakarta": "IDR", "Asia/Kuala_Lumpur": "MYR",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  KES: "KSh", USD: "$", EUR: "€", GBP: "£", NGN: "₦", ZAR: "R",
  EGP: "E£", MAD: "MAD", GHS: "GH¢", CAD: "CA$", BRL: "R$", MXN: "MX$",
  JPY: "¥", CNY: "¥", HKD: "HK$", SGD: "S$", AED: "د.إ", INR: "₹",
  THB: "฿", KRW: "₩", AUD: "A$", NZD: "NZ$", IDR: "Rp", MYR: "RM",
};

const CURRENCY_NAMES: Record<string, string> = {
  KES: "Kenyan Shilling", USD: "US Dollar", EUR: "Euro", GBP: "British Pound",
  NGN: "Nigerian Naira", ZAR: "South African Rand", EGP: "Egyptian Pound",
  MAD: "Moroccan Dirham", GHS: "Ghanaian Cedi", CAD: "Canadian Dollar",
  BRL: "Brazilian Real", MXN: "Mexican Peso", JPY: "Japanese Yen",
  CNY: "Chinese Yuan", HKD: "Hong Kong Dollar", SGD: "Singapore Dollar",
  AED: "UAE Dirham", INR: "Indian Rupee", THB: "Thai Baht", KRW: "South Korean Won",
  AUD: "Australian Dollar", NZD: "New Zealand Dollar", IDR: "Indonesian Rupiah",
  MYR: "Malaysian Ringgit",
};

function detectCurrency(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_CURRENCY[tz]) return TIMEZONE_CURRENCY[tz];
  } catch {}
  const lang = navigator.language;
  const region = lang.split("-")[1]?.toUpperCase();
  const regionMap: Record<string, string> = {
    US: "USD", GB: "GBP", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR",
    KE: "KES", NG: "NGN", ZA: "ZAR", EG: "EGP", MA: "MAD", GH: "GHS",
    JP: "JPY", CN: "CNY", HK: "HKD", SG: "SGD", AE: "AED", IN: "INR",
    CA: "CAD", BR: "BRL", MX: "MXN", AU: "AUD", NZ: "NZD", TH: "THB",
    KR: "KRW", ID: "IDR", MY: "MYR",
  };
  if (region && regionMap[region]) return regionMap[region];
  return "";
}

interface AppState {
  isLoggedIn: boolean;
  userName: string;
  isDark: boolean;
  settings: Settings | null;
  cartCount: number;
  selectedCurrency: string;
  exchangeRates: Record<string, number>;
}

interface AppContextType extends AppState {
  login: (token: string, name: string) => void;
  logout: () => void;
  toggleDark: () => void;
  refreshCartCount: () => void;
  refreshSettings: () => void;
  setCurrency: (code: string) => void;
  convertPrice: (amountInKES: number) => number;
  formatPrice: (amountInKES: number) => string;
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export { CURRENCY_SYMBOLS, CURRENCY_NAMES };

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    isLoggedIn: false,
    userName: "",
    isDark: true,
    settings: null,
    cartCount: 0,
    selectedCurrency: "",
    exchangeRates: {},
  });

  const applyTheme = useCallback((dark: boolean) => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    const meta = document.getElementById("themeColorMeta") as HTMLMetaElement | null;
    if (meta) meta.content = dark ? "#0b1120" : "#f8fafc";
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("siteTheme");
    const prefersDark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setState((s) => ({ ...s, isDark: prefersDark }));
    applyTheme(prefersDark);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (localStorage.getItem("siteTheme") === null) {
        setState((s) => ({ ...s, isDark: e.matches }));
        applyTheme(e.matches);
      }
    };
    mq.addEventListener("change", handler);

    const savedCurrency = localStorage.getItem("preferredCurrency") || "";
    const detected = savedCurrency || detectCurrency();
    setState((s) => ({
      ...s,
      isLoggedIn: isCustomerLoggedIn(),
      userName: localStorage.getItem("customerStoreName") || "",
      selectedCurrency: detected,
    }));
    initCsrf();
    refreshSettings();
    refreshCartCount();
    refreshRates();

    return () => mq.removeEventListener("change", handler);
  }, []);

  function refreshRates() {
    api<{ rates: Record<string, number> }>("/api/rates").then((d) => {
      if (d?.rates) setState((s) => ({ ...s, exchangeRates: d.rates }));
    }).catch(() => {});
  }

  function applyFavicon(url: string) {
    if (typeof document === "undefined") return;
    const href = url || DEFAULT_FAVICON;
    const updateLink = (rel: string, type?: string) => {
      let link = document.querySelector<HTMLLinkElement>(`link[rel='${rel}']`);
      if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        if (type) link.type = type;
        document.head.appendChild(link);
      }
      if (type) link.type = type;
      link.href = href;
    };
    updateLink("shortcut icon");
    updateLink("icon", "image/png");
  }

  function refreshSettings() {
    api<any>("/api/public-settings").then((d) => {
      if (d) {
        setState((s) => ({ ...s, settings: d }));
        applyFavicon(d.storeFavicon || DEFAULT_FAVICON);
        if (d.storeName && document.title === "Welcome to our store") {
          document.title = d.storeName;
        }
      }
    }).catch(() => {
      applyFavicon(DEFAULT_FAVICON);
    });
  }

  function refreshCartCount() {
    if (!isCustomerLoggedIn()) {
      setState((s) => ({ ...s, cartCount: 0 }));
      return;
    }
    api<{ count: number }>("/api/cart/count").then((d) => {
      setState((s) => ({ ...s, cartCount: d?.count || 0 }));
    }).catch(() => {});
  }

  function login(token: string, name: string) {
    setCustomerSession(token, name);
    setState((s) => ({ ...s, isLoggedIn: true, userName: name }));
    refreshCartCount();
  }

  function logout() {
    clearAllSessions();
    setState((s) => ({ ...s, isLoggedIn: false, userName: "", cartCount: 0 }));
    if (typeof window !== "undefined") window.location.href = "/";
  }

  function toggleDark() {
    const newDark = !state.isDark;
    localStorage.setItem("siteTheme", newDark ? "dark" : "light");
    setState((s) => ({ ...s, isDark: newDark }));
    applyTheme(newDark);
  }

  useEffect(() => {
    setFormatConfig(state.selectedCurrency, state.exchangeRates);
  }, [state.selectedCurrency, state.exchangeRates]);

  function setCurrency(code: string) {
    localStorage.setItem("preferredCurrency", code);
    setState((s) => ({ ...s, selectedCurrency: code }));
  }

  function convertPrice(amountInKES: number): number {
    const code = state.selectedCurrency;
    if (!code || code === "KES" || !state.exchangeRates[code]) return amountInKES;
    return amountInKES * state.exchangeRates[code];
  }

  function formatPrice(amountInKES: number): string {
    const code = state.selectedCurrency;
    const rate = state.exchangeRates[code];
    if (!code || code === "KES" || !rate) {
      return new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amountInKES);
    }
    const converted = amountInKES * rate;
    const symbol = CURRENCY_SYMBOLS[code] || code;
    const fmt = new Intl.NumberFormat("en", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(converted);
    return fmt;
  }

  return (
    <AppContext.Provider value={{ ...state, login, logout, toggleDark, refreshCartCount, refreshSettings, setCurrency, convertPrice, formatPrice }}>
      {children}
    </AppContext.Provider>
  );
}
