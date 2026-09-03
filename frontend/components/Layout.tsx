import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useApp } from "@/lib/app-context";
import { useLayout, LayoutHeader, LayoutFooter } from "@/layouts";
import { hasStaffSession, api } from "@/lib/api";

import CurrencySelector from "./CurrencySelector";
import MarqueeBanner from "./MarqueeBanner";
import Icon from "./icons";
import { useFeature } from "@/lib/features";

interface LayoutProps {
  children: React.ReactNode;
  activeNav?: string;
}

const NAV_LINKS = [
  { id: "pc", label: "PCs", href: "/pc" },
  { id: "laptops", label: "Laptops", href: "/laptops" },
  { id: "graphics-cards", label: "Graphics Cards", href: "/graphics-cards" },
  { id: "servers", label: "Servers", href: "/servers" },
  { id: "printers", label: "Printers", href: "/printers" },
  { id: "repairs", label: "Repairs", href: "/repairs" },
  { id: "cart", label: "Cart", href: "/cart" },
  { id: "wishlist", label: "Wishlist", href: "/wishlist" },
  { id: "about", label: "About Us", href: "/about" },
  { id: "contact", label: "Contact", href: "/contact" },
];

const STATIC_NAV_IDS = new Set(["repairs", "cart", "wishlist", "about", "contact"]);
const RIGHT_NAV_IDS = new Set(["repairs", "about", "contact"]);

const STATIC_NAV_LINKS = [
  { id: "repairs", label: "Repairs", href: "/repairs" },
  { id: "cart", label: "Cart", href: "/cart" },
  { id: "wishlist", label: "Wishlist", href: "/wishlist" },
  { id: "about", label: "About Us", href: "/about" },
  { id: "contact", label: "Contact", href: "/contact" },
];

export default function Layout({ children, activeNav }: LayoutProps) {
  const { isLoggedIn, userName, cartCount, settings, isDark, toggleDark, logout } = useApp();
  const [isStaff, setIsStaff] = useState(false);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [springboardOpen, setSpringboardOpen] = useState(false);
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { configLoading, layout } = useLayout();
  const multiCurrencyEnabled = useFeature("Multi-currency support");
  const [navLinks, setNavLinks] = useState(NAV_LINKS);
  const [footerConfig, setFooterConfig] = useState<any>(null);
  const router = useRouter();
  const sessionIdRef = useRef<string>("");

  useEffect(() => {
    let sid = sessionStorage.getItem("wa_sid");
    if (!sid) { sid = crypto.randomUUID?.() || Math.random().toString(36).substring(2, 15); sessionStorage.setItem("wa_sid", sid); }
    sessionIdRef.current = sid;
  }, []);

  useEffect(() => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    const timer = setTimeout(() => {
      api("/api/track/pageview", {
        method: "POST",
        body: JSON.stringify({ path: router.asPath, referrer: document.referrer, sessionId: sid, deviceType: "" }),
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [router.asPath]);

  useEffect(() => { setIsStaff(hasStaffSession()); }, []);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => {
      if (d?.categories) setCategories(d.categories);
      if (d?.subcategories) setSubcategories(d.subcategories);
      setCategoriesLoaded(true);
    }).catch(() => { setCategoriesLoaded(true); });
  }, []);

  const resolvedNavLinks = (() => {
    const normalized = navLinks.map((l: any) => ({ id: l.id, label: l.label, href: l.href || "/" + l.id }));
    if (!categoriesLoaded) return normalized;
    const catHrefs = new Set(categories.map((c) => "/" + c.id));
    const kept = normalized.filter((l) => STATIC_NAV_IDS.has(l.id) || catHrefs.has(l.href) || categories.some((c) => c.id === l.id));
    const keptHrefs = new Set(kept.map((l) => l.href));
    const added = categories
      .filter((c) => !keptHrefs.has("/" + c.id))
      .map((c) => ({ id: c.id, label: c.label, href: "/" + c.id }));
    return [...kept, ...added];
  })();

  const filteredNavLinks = (() => {
    const byId = new Set(resolvedNavLinks.map((l: any) => l.id));
    const merged = [...resolvedNavLinks];
    for (const s of STATIC_NAV_LINKS) {
      if (!byId.has(s.id)) merged.push(s);
    }
    return merged;
  })();

  const leftNavLinks = filteredNavLinks.filter((l: any) => !RIGHT_NAV_IDS.has(l.id));
  const rightNavLinks = filteredNavLinks.filter((l: any) => RIGHT_NAV_IDS.has(l.id));

  function closeAllMenus() { setMobileOpen(false); setSpringboardOpen(false); setOpenSubMenu(null); }

  useEffect(() => {
    const handler = () => { closeAllMenus(); };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  useEffect(() => {
    const handler = () => closeAllMenus();
    router.events.on("routeChangeStart", handler);
    return () => router.events.off("routeChangeStart", handler);
  }, [router.events]);

  useEffect(() => {
    if (!springboardOpen && !settingsOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".springboard-wrap")) setSpringboardOpen(false);
      if (!target.closest(".header-settings-wrap")) setSettingsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [springboardOpen, settingsOpen]);

  useEffect(() => {
    if (!springboardOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSpringboardOpen(false); setOpenSubMenu(null); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [springboardOpen]);

  useEffect(() => {
    fetch("/api/settings/nav-order").then(r => r.json()).then(d => {
      if (d.navOrder && Array.isArray(d.navOrder) && d.navOrder.length > 0) {
        setNavLinks(d.navOrder);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/settings/footer-config").then(r => r.json()).then(d => {
      if (d.footerConfig) setFooterConfig(d.footerConfig);
    }).catch(() => {});
  }, []);

  const hideHeader = ["admin", "marketing", "stock-take", "suppliers", "pos"].includes(activeNav ?? "");
  const isPublicStorefront = ["home", "pc", "laptops", "graphics-cards", "servers", "printers"].includes(activeNav ?? "");
  const isThemedLayout = isPublicStorefront && !configLoading && (layout === "amazon" || layout === "jumia");

  function closeMobile() { setMobileOpen(false); setSpringboardOpen(false); setOpenSubMenu(null); }

  if (hideHeader) return <>{children}</>;

  const defaultHeader = (
    <header className="site-header">
      <div className="header-inner">
        <div className="header-left">
          <Link className="brand" href="/" onClick={closeMobile}>
            {settings?.storeLogo && (
              <img src={settings.storeLogo} alt={settings.storeName || "Store"} className="site-logo" />
            )}
            <span>{settings?.storeName || "My Shop"}</span>
          </Link>
          <div className="springboard-wrap">
            <button
              type="button"
              className={`springboard-btn${springboardOpen ? " open" : ""}`}
              onClick={() => { setSpringboardOpen((o) => !o); setOpenSubMenu(null); }}
              aria-expanded={springboardOpen}
              aria-haspopup="true"
              aria-label="Browse categories"
            >
              <span className="springboard-icon"><Icon name="menu" size={14} /></span>
              <span className="springboard-label">Categories</span>
              <span className={`springboard-arrow${springboardOpen ? " open" : ""}`}><Icon name="chevronDown" size={12} /></span>
            </button>
            {springboardOpen && (
              <div className="springboard-dropdown">
                {categories.map((cat) => {
                  const subs = subcategories.filter((s) => Array.isArray(s.category_ids) && s.category_ids.includes(cat.id));
                  const isOpen = openSubMenu === cat.id;
                  return (
                    <div
                      key={cat.id}
                      className={`springboard-row${isOpen ? " open" : ""}`}
                      onMouseEnter={() => subs.length > 0 && setOpenSubMenu(cat.id)}
                      onMouseLeave={() => setOpenSubMenu((cur) => (cur === cat.id ? null : cur))}
                    >
                      <Link
                        href={`/${cat.id}`}
                        className={`springboard-item${activeNav === cat.id ? " active" : ""}`}
                        onClick={closeMobile}
                      >
                        {cat.label}
                      </Link>
                      {subs.length > 0 && (
                        <button
                          type="button"
                          className={`springboard-item-toggle${isOpen ? " open" : ""}`}
                          onClick={(e) => { e.preventDefault(); setOpenSubMenu(isOpen ? null : cat.id); }}
                          aria-label={`${cat.label} subcategories`}
                          aria-expanded={isOpen}
                        >
                          <Icon name="chevronRight" size={12} />
                        </button>
                      )}
                      {subs.length > 0 && isOpen && (
                        <div className="springboard-submenu">
                          {subs.map((s) => (
                            <Link
                              key={s.id}
                              href={`/${cat.id}?subcategory=${encodeURIComponent(s.id)}`}
                              className="springboard-subitem"
                              onClick={closeMobile}
                            >
                              {s.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <form className="header-search-form" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const q = fd.get("q")?.toString().trim(); if (q) router.push(`/?search=${encodeURIComponent(q)}`); }}>
          <input name="q" type="search" placeholder="Search..." aria-label="Search products" />
          <button type="submit" aria-label="Search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
        </form>
        <div className="header-right">
          <div className="header-right-nav">
            {rightNavLinks.map((link: any) => (
              <Link
                key={link.id}
                href={link.href}
                className={`header-right-link${activeNav === link.id ? " active" : ""}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="header-icon-links">
            <Link href="/cart" className="header-icon-link" aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`} title="Cart">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              {cartCount > 0 && <span className="cart-badge" aria-label={`${cartCount} items in cart`}>{cartCount}</span>}
            </Link>
            <Link href="/wishlist" className="header-icon-link" aria-label="Wishlist" title="Wishlist">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </Link>
          </div>
          <div className="header-settings-wrap" style={{ position: "relative" }}>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setSettingsOpen((o) => !o)}
              aria-expanded={settingsOpen}
              aria-label="Display settings"
              title="Theme & currency"
            >
              <Icon name="settings" size={16} />
            </button>
            {settingsOpen && (
              <div className="header-settings-popover" role="menu">
                <div className="header-settings-row">
                  <span className="header-settings-label">Theme</span>
                  <button
                    type="button"
                    className="theme-toggle"
                    onClick={toggleDark}
                    aria-pressed={isDark}
                    aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                  >
                    <span className="theme-toggle-track">
                      <span className="theme-toggle-thumb" />
                    </span>
                  </button>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{isDark ? "Dark" : "Light"}</span>
                </div>
                {multiCurrencyEnabled && (
                  <div className="header-settings-row">
                    <span className="header-settings-label">Currency</span>
                    <CurrencySelector />
                  </div>
                )}
              </div>
            )}
          </div>
          {isLoggedIn ? (
            <Link href="/dashboard" className="btn btn-sm btn-ghost">
              {userName || "Account"}
            </Link>
          ) : (
            <Link href="/login" className="btn btn-sm btn-primary" id="accountNavLink">
              Sign in
            </Link>
          )}
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            <Icon name={mobileOpen ? "x" : "menu"} size={18} />
          </button>
        </div>
      </div>
      <nav className="main-nav-desktop" aria-label="Main">
        {leftNavLinks.map((link: any) => (
          <Link
            key={link.id}
            href={link.href}
            className={activeNav === link.id ? "active" : ""}
            aria-current={activeNav === link.id ? "page" : undefined}
          >
            {link.label}
            {link.id === "cart" && cartCount > 0 && (
              <span className="cart-badge" aria-label="Items in cart">{cartCount}</span>
            )}
          </Link>
        ))}
      </nav>
      <nav className={`main-nav-mobile${mobileOpen ? " open" : ""}`} aria-label="Mobile navigation">
        {filteredNavLinks.map((link: any) => (
          <Link
            key={link.id}
            href={link.href}
            className={activeNav === link.id ? "active" : ""}
            onClick={closeMobile}
          >
            {link.label}
            {link.id === "cart" && cartCount > 0 && (
              <span className="cart-badge" aria-label="Items in cart">{cartCount}</span>
            )}
          </Link>
        ))}
        <div className="mobile-nav-divider" />
        {isLoggedIn ? (
          <>
            <Link href="/dashboard" onClick={closeMobile}>{userName || "Account"}</Link>
            {isStaff && (
              <>
                <Link href="/admin" onClick={closeMobile}>Staff Portal</Link>
              </>
            )}
            <button type="button" className="nav-btn" onClick={() => { closeMobile(); logout(); }}>
              Sign out
            </button>
          </>
        ) : (
          <Link href="/login" onClick={closeMobile}>Sign in</Link>
        )}
      </nav>
    </header>
  );

  return (
    <>
      <a href="#main" className="skip-link">Skip to main content</a>
      {!hideHeader && <MarqueeBanner />}
      {isThemedLayout ? (
        <LayoutHeader
          categories={categories}
          settings={settings}
          isLoggedIn={isLoggedIn}
          userName={userName}
          cartCount={cartCount}
          isDark={isDark}
          toggleDark={toggleDark}
          logout={logout}
          isStaff={isStaff}
        />
      ) : (
        defaultHeader
      )}
      <main id="main">{children}</main>
      {isThemedLayout ? (
        <LayoutFooter settings={settings} />
      ) : (
        <footer className="site-footer">
          <div className="footer-inner">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1.5rem", width: "100%", padding: "0 var(--space-5)" }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: "0.5rem", fontSize: "var(--text-base)" }}>{settings?.storeName || "My Shop"}</div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>Kenya&apos;s trusted tech platform for gaming PCs, laptops, and accessories.</p>
              </div>
              {(footerConfig?.columns || []).map((col: any, idx: number) => (
                <div key={idx}>
                  <div style={{ fontWeight: 600, marginBottom: "0.5rem", fontSize: "0.85rem" }}>{col.title}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {(col.links || []).map((link: any, li: number) => (
                      <a key={li} href={link.href} style={{ fontSize: "0.85rem" }}>{link.label}</a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: "1px solid var(--border)", marginTop: "1.5rem", paddingTop: "1rem", textAlign: "center", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              &copy; {new Date().getFullYear()} {settings?.storeName || "My Shop"}. All rights reserved.
            </div>
          </div>
        </footer>
      )}
      <div style={{ textAlign: "center", padding: "0.5rem", fontSize: "0.75rem", background: "var(--text)", color: "var(--bg)" }}>
        <span style={{ color: "var(--text)", background: "var(--bg)", padding: "0 4px" }}>Made</span>{" "}
        <span style={{ color: "#fff", background: "#d32f2f", padding: "0 4px" }}>in</span>{" "}
        <span style={{ color: "#fff", background: "#388e3c", padding: "0 4px" }}>Kenya</span>
      </div>
    </>
  );
}
