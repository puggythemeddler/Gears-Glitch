import React, { createContext, useContext, useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { api } from "@/lib/api";
import * as original from "./original";
import * as amazon from "./amazon";
import * as jumia from "./jumia";
import * as mobile from "./mobile";
import * as custom from "./custom";
import { DynamicHomePage, DynamicLayoutStyles } from "./dynamic-engine";

export interface LayoutModule {
  LAYOUT_KEY: string;
  LAYOUT_LABEL: string;
  LAYOUT_DESC: string;
  LayoutStyles: () => React.JSX.Element;
  Header: (props: { categories: { id: string; label: string }[]; settings: any; isLoggedIn?: boolean; userName?: string; cartCount?: number; isDark?: boolean; toggleDark?: () => void; logout?: () => void; isStaff?: boolean }) => React.JSX.Element | null;
  Footer: (props: { settings: any }) => React.JSX.Element | null;
  HomePage: (props: { products: Product[]; categories: { id: string; label: string }[]; banners: any[]; hero?: any }) => React.JSX.Element;
}

const STATIC_LAYOUTS: Record<string, LayoutModule> = { original, amazon, jumia, mobile, custom };

export const STORE_THEMES: string[] = ["default", "kenyan", "modern"];

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
  const [config, setConfig] = useState<StorefrontConfig>({ layout: "original", theme: "default", banners: [], features: [], hero: { enabled: true } });
  const [configLoading, setConfigLoading] = useState(true);
  const [allLayouts, setAllLayouts] = useState<LayoutMeta[]>([]);

  function applyBrandTheme(theme: string) {
    const active = STORE_THEMES.includes(theme) ? theme : "default";
    if (typeof document !== "undefined") {
      if (active === "default") document.documentElement.removeAttribute("data-brand-theme");
      else document.documentElement.setAttribute("data-brand-theme", active);
    }
    return active;
  }

  function refreshConfig() {
    setConfigLoading(true);
    api<StorefrontConfig>("/api/storefront-config")
      .then((d) => {
        if (d) {
          setConfig((prev) => ({ ...prev, ...d, theme: applyBrandTheme(d.theme) }));
        }
      })
      .catch(() => {})
      .finally(() => setConfigLoading(false));
  }

  function refreshLayouts() {
    api<LayoutMeta[]>("/api/layouts")
      .then((d) => { if (d) setAllLayouts(d); })
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

  async function setTheme(theme: string) {
    await api("/api/admin/storefront-layout", { method: "PUT", body: JSON.stringify({ theme }) });
    refreshConfig();
  }

  return (
    <LayoutContext.Provider value={{ ...config, configLoading, refreshConfig, setLayout, setBanners, setTheme, allLayouts, refreshLayouts }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function LayoutEngine({
  page, products, categories, banners, settings,
}: {
  page: "home" | "category" | "product";
  products: Product[];
  categories: { id: string; label: string }[];
  banners: any[];
  settings: any;
}) {
  const { layout, hero, layoutConfig } = useLayout();

  if (page === "home") {
    if (layoutConfig?.type === "dynamic" && layoutConfig.config) {
      return <DynamicHomePage products={products} categories={categories} banners={banners} config={layoutConfig.config} />;
    }
    const mod = getLayout(layout);
    return <mod.HomePage products={products} categories={categories} banners={banners} hero={hero} />;
  }
  return null;
}

export function LayoutStyles() {
  const { layout, layoutConfig } = useLayout();
  if (layoutConfig?.type === "dynamic") {
    return <DynamicLayoutStyles colors={layoutConfig.config?.colors} />;
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
