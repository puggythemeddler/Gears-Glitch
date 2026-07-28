import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/app-context";
import { useLayout, LayoutHeader, LayoutFooter } from "@/layouts";
import { getStaffToken, getCustomerToken, getProviderToken } from "@/lib/api";
import NotificationBell from "./NotificationBell";
import CurrencySelector from "./CurrencySelector";
import MarqueeBanner from "./MarqueeBanner";
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

export default function Layout({ children, activeNav }: LayoutProps) {
  const { isLoggedIn, userName, cartCount, settings, isDark, toggleDark, logout } = useApp();
  const [isStaff, setIsStaff] = useState(false);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [springboardOpen, setSpringboardOpen] = useState(false);
  const { configLoading, layout } = useLayout();
  const messagingEnabled = useFeature("Messaging");
  const repairsEnabled = useFeature("Repair ticketing");
  const multiCurrencyEnabled = useFeature("Multi-currency support");
  const springboardMenu = settings?.springboardMenu ?? false;
  const [navLinks, setNavLinks] = useState(NAV_LINKS);
  const [footerConfig, setFooterConfig] = useState<any>(null);

  useEffect(() => { setIsStaff(!!getStaffToken()); }, []);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => {
      if (d?.categories) setCategories(d.categories);
    }).catch(() => {});
  }, []);

  const filteredNavLinks = navLinks.filter((l) => l.id !== "repairs" || repairsEnabled);

  useEffect(() => {
    const handler = () => { setMobileOpen(false); setSpringboardOpen(false); };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  useEffect(() => {
    if (!springboardOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".springboard-wrap")) setSpringboardOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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

  const hideHeader = ["backoffice", "owner", "admin", "marketing", "stock-take", "suppliers"].includes(activeNav ?? "");
  const isPublicStorefront = ["home", "pc", "laptops", "graphics-cards", "servers", "printers"].includes(activeNav ?? "");
  const isThemedLayout = isPublicStorefront && !configLoading && layout !== "original";

  function closeMobile() { setMobileOpen(false); setSpringboardOpen(false); }

  if (hideHeader) return <>{children}</>;

  const defaultHeader = (
    <header className="site-header">
      <div className="header-inner">
        <div className="header-left">
          <Link className="brand" href="/" onClick={closeMobile}>
            {settings?.storeLogo && (
              <img src={settings.storeLogo} alt={settings.storeName || "Store"} className="site-logo" />
            )}
            <span>{settings?.storeName || "Gear&Glitch"}</span>
          </Link>
          {springboardMenu ? (
            <div className="springboard-wrap">
              <button
                type="button"
                className="springboard-btn"
                onClick={() => setSpringboardOpen((o) => !o)}
                aria-expanded={springboardOpen}
                aria-label="Browse categories"
              >
                <span className="springboard-icon">☰</span>
                <span className="springboard-label">Categories</span>
                <span className={`springboard-arrow${springboardOpen ? " open" : ""}`}>▾</span>
              </button>
              {springboardOpen && (
                <div className="springboard-dropdown">
                  {filteredNavLinks.map((link: any) => (
                    <Link
                      key={link.id}
                      href={link.href}
                      className={`springboard-item${activeNav === link.id ? " active" : ""}`}
                      onClick={closeMobile}
                    >
                      {link.label}
                      {link.id === "cart" && cartCount > 0 && (
                        <span className="cart-badge" aria-label="Items in cart">{cartCount}</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <nav className="main-nav-desktop" aria-label="Main">
              {filteredNavLinks.map((link: any) => (
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
          )}
        </div>
        <div className="header-right">
          {(getCustomerToken() || getProviderToken() || isStaff) && messagingEnabled && (
            <NotificationBell onClick={() => {
              window.location.href = isStaff ? "/owner" : "/dashboard";
            }} />
          )}
          <form className="header-search-form" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const q = fd.get("q")?.toString().trim(); if (q) window.location.href = `/?search=${encodeURIComponent(q)}`; }}>
            <input name="q" type="search" placeholder="Search..." aria-label="Search products" />
            <button type="submit" aria-label="Search">🔍</button>
          </form>
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
          <CurrencySelector />
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
            {mobileOpen ? "\u2715" : "\u2630"}
          </button>
        </div>
      </div>
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
                <Link href="/owner" onClick={closeMobile}>Owner</Link>
                <Link href="/admin" onClick={closeMobile}>Admin</Link>
                <Link href="/backoffice" onClick={closeMobile}>Backoffice</Link>
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
                <div style={{ fontWeight: 700, marginBottom: "0.5rem", fontSize: "var(--text-base)" }}>{settings?.storeName || "Gear&Glitch"}</div>
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
              &copy; {new Date().getFullYear()} {settings?.storeName || "Gear&Glitch"}. All rights reserved.
            </div>
          </div>
        </footer>
      )}
      <div style={{ textAlign: "center", padding: "0.5rem", fontSize: "0.75rem", background: "#000", color: "#fff" }}>
        <span style={{ color: "#000", background: "#fff", padding: "0 4px" }}>Made</span>{" "}
        <span style={{ color: "#fff", background: "#d32f2f", padding: "0 4px" }}>in</span>{" "}
        <span style={{ color: "#fff", background: "#388e3c", padding: "0 4px" }}>Kenya</span>
      </div>
    </>
  );
}
