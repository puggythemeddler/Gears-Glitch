import React, { createContext, useContext, useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { api, bootstrapSession, hasStaffSession } from "@/lib/api";
import * as original from "./original";
import * as amazon from "./amazon";
import * as jumia from "./jumia";
import { DynamicHomePage, DynamicLayoutStyles } from "./dynamic-engine";
import { isMascotId, type MascotId } from "@/lib/mascots";

export interface LayoutModule {
  LAYOUT_KEY: string;
  LAYOUT_LABEL: string;
  LAYOUT_DESC: string;
  LayoutStyles: () => React.JSX.Element;
  Header: (props: { categories: { id: string; label: string }[]; settings: any; isLoggedIn?: boolean; userName?: string; cartCount?: number; isDark?: boolean; toggleDark?: () => void; logout?: () => void; isStaff?: boolean }) => React.JSX.Element | null;
  Footer: (props: { settings: any }) => React.JSX.Element | null;
  HomePage: (props: { products: Product[]; categories: { id: string; label: string }[]; banners: any[]; hero?: any; allProducts?: Product[] }) => React.JSX.Element;
}

const STATIC_LAYOUTS: Record<string, LayoutModule> = { original, amazon, jumia };

export const STORE_THEMES: string[] = ["default", "kenyan", "modern", "custom"];

export const DEFAULT_THEME_CUSTOM = {
  primary: "#c2410c",
  primaryHover: "#9a3412",
  accent: "#f59e0b",
  bgLight: "#fafaf9",
  bgDark: "#0c0a09",
};

function safeThemeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value) ? value : fallback;
}

export function getLayout(layoutKey: string): LayoutModule {
  return STATIC_LAYOUTS[layoutKey] || STATIC_LAYOUTS.original;
}

export function getLayoutList(): { key: string; label: string; desc: string }[] {
  return Object.values(STATIC_LAYOUTS).map((m) => ({ key: m.LAYOUT_KEY, label: m.LAYOUT_LABEL, desc: m.LAYOUT_DESC }));
}

interface LayoutMeta {
  id: number;
  layout_key: string;
  label: string;
  description: string;
  layout_type: "static" | "dynamic";
  config: any;
  is_active: number;
  sort_order: number;
}

interface StorefrontConfig {
  layout: string;
  theme: string;
  mascot: MascotId;
  themeCustom?: any;
  banners: any[];
  features: any[];
  hero: any;
  layoutConfig?: { type: string; label: string; description: string; config: any } | null;
}

interface LayoutContextType extends StorefrontConfig {
  configLoading: boolean;
  refreshConfig: () => void;
  setLayout: (layout: string) => Promise<void>;
  setBanners: (banners: any[]) => Promise<void>;
  setTheme: (theme: string) => Promise<void>;
  setMascot: (mascot: MascotId) => Promise<void>;
  allLayouts: LayoutMeta[];
  refreshLayouts: () => void;
}

const LayoutContext = createContext<LayoutContextType | null>(null);

export function useLayout(): LayoutContextType {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout must be used within LayoutProvider");
  return ctx;
}

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<StorefrontConfig>({ layout: "original", theme: "default", mascot: "gearhead", banners: [], features: [], hero: { enabled: true } });
  const [configLoading, setConfigLoading] = useState(true);
  const [allLayouts, setAllLayouts] = useState<LayoutMeta[]>([]);

  function applyBrandTheme(theme: string, themeCustom?: any) {
    const active = STORE_THEMES.includes(theme) ? theme : "default";
    if (typeof document !== "undefined") {
      const el = document.documentElement;
      if (active === "default") {
        el.removeAttribute("data-brand-theme");
      } else {
        el.setAttribute("data-brand-theme", active);
      }
      if (active === "custom" && themeCustom) {
        el.style.setProperty("--brand-primary", safeThemeColor(themeCustom.primary, DEFAULT_THEME_CUSTOM.primary));
        el.style.setProperty("--brand-primary-hover", safeThemeColor(themeCustom.primaryHover, DEFAULT_THEME_CUSTOM.primaryHover));
        el.style.setProperty("--brand-accent", safeThemeColor(themeCustom.accent, DEFAULT_THEME_CUSTOM.accent));
        el.style.setProperty("--brand-bg-light", safeThemeColor(themeCustom.bgLight, DEFAULT_THEME_CUSTOM.bgLight));
        el.style.setProperty("--brand-bg-dark", safeThemeColor(themeCustom.bgDark, DEFAULT_THEME_CUSTOM.bgDark));
        el.style.setProperty("--brand-hero-bg-light", safeThemeColor(themeCustom.heroBgLight, ""));
        el.style.setProperty("--brand-hero-bg-dark", safeThemeColor(themeCustom.heroBgDark, ""));
      } else {
        el.style.removeProperty("--brand-primary");
        el.style.removeProperty("--brand-primary-hover");
        el.style.removeProperty("--brand-accent");
        el.style.removeProperty("--brand-bg-light");
        el.style.removeProperty("--brand-bg-dark");
        el.style.removeProperty("--brand-hero-bg-light");
        el.style.removeProperty("--brand-hero-bg-dark");
      }
    }
    return active;
  }

  function refreshConfig() {
    setConfigLoading(true);
    api<StorefrontConfig>("/api/storefront-config")
      .then((d) => {
        if (d) {
          setConfig((prev) => ({ ...prev, ...d, theme: applyBrandTheme(d.theme, d.themeCustom) }));
        }
      })
      .catch(() => {})
      .finally(() => setConfigLoading(false));
  }

  function refreshLayouts() {
    // /api/layouts is an admin-only feed (full config for every layout, drafts
    // included). Wait for the session bootstrap so the staff check is accurate,
    // then skip the request entirely for visitors — otherwise every public page
    // view would fire a guaranteed 401 and burn API rate-limit budget.
    bootstrapSession()
      .then(() => {
        if (!hasStaffSession()) {
          setAllLayouts([]);
          return null;
        }
        return api<LayoutMeta[]>("/api/layouts").then((d) => {
          if (d) setAllLayouts(d);
        });
      })
      .catch(() => {});
  }

  useEffect(() => { applyBrandTheme("default"); refreshConfig(); refreshLayouts(); }, []);

  async function setLayout(layout: string) {
    await api("/api/admin/storefront-layout", { method: "PUT", body: JSON.stringify({ layout }) });
    refreshConfig();
    refreshLayouts();
  }

  async function setBanners(banners: any[]) {
    await api("/api/admin/storefront-layout", { method: "PUT", body: JSON.stringify({ banners }) });
    refreshConfig();
  }

  async function setTheme(theme: string, themeCustom?: any) {
    await api("/api/admin/storefront-layout", { method: "PUT", body: JSON.stringify({ theme, ...(themeCustom ? { themeCustom } : {}) }) });
    refreshConfig();
  }

  async function setMascot(mascot: MascotId) {
    if (!isMascotId(mascot)) throw new Error("Choose a mascot from the available options.");
    const saved = await api<StorefrontConfig>("/api/admin/storefront-layout", { method: "PUT", body: JSON.stringify({ mascot }) });
    if (saved) setConfig((prev) => ({ ...prev, ...saved }));
    else refreshConfig();
  }

  return (
    <LayoutContext.Provider value={{ ...config, configLoading, refreshConfig, setLayout, setBanners, setTheme, setMascot, allLayouts, refreshLayouts }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function LayoutEngine({
  page, products, categories, banners, settings, allProducts,
}: {
  page: "home" | "category" | "product";
  products: Product[];
  categories: { id: string; label: string }[];
  banners: any[];
  settings: any;
  allProducts?: Product[];
}) {
  const { layout, hero, layoutConfig } = useLayout();

  if (page === "home") {
    const catalogueProducts = allProducts || products;
    if (catalogueProducts.length === 0 && categories.length === 0) {
      const storeName = String(settings?.storeName || "our shop");
      return (
        <section className="catalogue-empty" aria-labelledby="catalogue-empty-title" style={{ maxWidth: 900, margin: "clamp(2rem, 8vh, 5rem) auto", padding: "3rem 1.5rem", textAlign: "center" }}>
          <span aria-hidden="true" style={{ display: "inline-grid", placeItems: "center", width: 56, height: 56, borderRadius: "50%", background: "var(--surface)", color: "var(--primary)", fontSize: "1.8rem", fontWeight: 700 }}>?</span>
          <h1 id="catalogue-empty-title" style={{ margin: "1rem 0 0.5rem" }}>This catalogue is being prepared</h1>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>Products and categories from {storeName} will appear here once they are added.</p>
        </section>
      );
    }
    if (layoutConfig?.type === "dynamic" && layoutConfig.config) {
      return <DynamicHomePage products={catalogueProducts} categories={categories} banners={banners} config={layoutConfig.config} />;
    }
    const mod = getLayout(layout);
    return <mod.HomePage products={products} categories={categories} banners={banners} hero={hero} allProducts={allProducts || products} />;
  }
  return null;
}

export function LayoutStyles() {
  const { layout, layoutConfig } = useLayout();
  if (layoutConfig?.type === "dynamic") {
    return <DynamicLayoutStyles tokens={layoutConfig.config?.tokens} />;
  }
  const mod = getLayout(layout);
  return <mod.LayoutStyles />;
}

export function LayoutHeader({ categories, settings, isLoggedIn, userName, cartCount, isDark, toggleDark, logout, isStaff }: { categories: { id: string; label: string }[]; settings: any; isLoggedIn?: boolean; userName?: string; cartCount?: number; isDark?: boolean; toggleDark?: () => void; logout?: () => void; isStaff?: boolean }) {
  const { layout } = useLayout();
  const mod = getLayout(layout);
  return <mod.Header categories={categories} settings={settings} isLoggedIn={isLoggedIn} userName={userName} cartCount={cartCount} isDark={isDark} toggleDark={toggleDark} logout={logout} isStaff={isStaff} />;
}

export function LayoutFooter({ settings }: { settings: any }) {
  const { layout } = useLayout();
  const mod = getLayout(layout);
  return <mod.Footer settings={settings} />;
}
