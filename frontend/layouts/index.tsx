import React, { createContext, useContext, useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { api } from "@/lib/api";
import * as original from "./original";
import * as amazon from "./amazon";
import * as jumia from "./jumia";
import * as mobile from "./mobile";
import * as custom from "./custom";

export interface LayoutModule {
  LAYOUT_KEY: string;
  LAYOUT_LABEL: string;
  LAYOUT_DESC: string;
  LayoutStyles: () => React.JSX.Element;
  Header: (props: { categories: { id: string; label: string }[]; settings: any; isLoggedIn?: boolean; userName?: string; cartCount?: number; isDark?: boolean; toggleDark?: () => void; logout?: () => void; isStaff?: boolean }) => React.JSX.Element | null;
  Footer: (props: { settings: any }) => React.JSX.Element | null;
  HomePage: (props: any) => React.JSX.Element;
}

const LAYOUTS: Record<string, LayoutModule> = { original, amazon, jumia, mobile, custom };

export function getLayout(layoutKey: string): LayoutModule {
  return LAYOUTS[layoutKey] || LAYOUTS.original;
}

export function getLayoutList(): { key: string; label: string; desc: string }[] {
  return Object.values(LAYOUTS).map((m) => ({ key: m.LAYOUT_KEY, label: m.LAYOUT_LABEL, desc: m.LAYOUT_DESC }));
}

interface StorefrontConfig {
  layout: string;
  banners: any[];
  features: any[];
  customLayout: any;
}

interface LayoutContextType extends StorefrontConfig {
  configLoading: boolean;
  refreshConfig: () => void;
  setLayout: (layout: string) => Promise<void>;
  setBanners: (banners: any[]) => Promise<void>;
}

const LayoutContext = createContext<LayoutContextType | null>(null);

export function useLayout(): LayoutContextType {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout must be used within LayoutProvider");
  return ctx;
}

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<StorefrontConfig>({ layout: "original", banners: [], features: [], customLayout: null });
  const [configLoading, setConfigLoading] = useState(true);

  function refreshConfig() {
    setConfigLoading(true);
    api<StorefrontConfig>("/api/storefront-config")
      .then((d) => { if (d) setConfig(d); })
      .catch(() => {})
      .finally(() => setConfigLoading(false));
  }

  useEffect(() => { refreshConfig(); }, []);

  async function setLayout(layout: string) {
    await api("/api/admin/storefront-layout", { method: "PUT", body: JSON.stringify({ layout }) });
    refreshConfig();
  }

  async function setBanners(banners: any[]) {
    await api("/api/admin/storefront-layout", { method: "PUT", body: JSON.stringify({ banners }) });
    refreshConfig();
  }

  return (
    <LayoutContext.Provider value={{ ...config, configLoading, refreshConfig, setLayout, setBanners }}>
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
  const { layout, customLayout } = useLayout();
  const mod = getLayout(layout);

  if (page === "home") {
    return <mod.HomePage products={products} categories={categories} banners={banners} customLayout={customLayout} />;
  }
  return null;
}

export function LayoutStyles() {
  const { layout } = useLayout();
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
