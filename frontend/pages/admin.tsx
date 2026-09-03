import React, { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/router";
import { api, getStaffToken, getStaffRole, getStaffPermissions, hasStaffSession, downloadPdf, obtainStepUpToken } from "@/lib/api";
import type { Product, Order, SubscriptionPlan, Provider, Branch, Client } from "@/lib/types";
import RippleButton from "@/components/RippleButton";
import Icon from "@/components/icons";
import { SkeletonStats, SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { getLayoutList, useLayout } from "@/layouts";
import { useApp } from "@/lib/app-context";
import NotificationBell from "@/components/NotificationBell";
import { useFeature } from "@/lib/features";
import { useToast, toast } from "@/components/Toast";
import { confirmDialog, promptDialog } from "@/components/ConfirmDialog";
import { formatPrice, escapeHtml, useFetch, Spinner, ErrorMsg } from "@/components/admin/shared";
import AdminProducts from "@/components/admin/AdminProducts";
import QuotesPage from "./quotes";
import ProvidersPage from "@/components/admin/ProvidersPage";
import CreditNotesPage from "@/components/admin/CreditNotesPage";
import AboutUsPage from "@/components/admin/AboutUsPage";
import WhatsAppSettings from "@/components/admin/WhatsAppSettings";
import ProductPositioningPage from "@/components/admin/ProductPositioningPage";
import StockTakeListPage from "@/components/admin/StockTakeListPage";
import StockOnHandPage from "@/components/admin/StockOnHandPage";
import CategoryPositioningPage from "@/components/admin/CategoryPositioningPage";
import AdminRepairs from "@/components/admin/AdminRepairs";
import AdminSerials from "@/components/admin/AdminSerials";
import HelpPanel from "@/components/admin/HelpPanel";
import StorefrontBuilder from "@/components/admin/StorefrontBuilder";
import FeaturePicker from "@/components/admin/FeaturePicker";
import AdminWarranties from "@/components/admin/AdminWarranties";
import { PageHead, DataTable, Tabs, StatusBadge } from "@/components/ui";

declare global {
  interface Window {
    google?: { accounts: { id: { initialize: any; prompt: any; renderButton: any } } };
  }
}

export type AdminView = "dashboard" | "products" | "groups" | "categories" | "orders" | "pos" | "customers" | "coupons" | "gift-cards" | "campaigns" | "abandoned-carts" | "quotations" | "users" | "roles" | "plans" | "providers" | "invoices" | "reports" | "stock-take" | "stock-on-hand" | "stock-transfers" | "stock-control" | "purchases" | "serials" | "spec-templates" | "suppliers" | "clients" | "branches" | "shop-subscription" | "about-us" | "storefront" | "layout-builder" | "settings" | "settings-store-info" | "settings-payments" | "settings-compliance" | "settings-content" | "settings-system" | "delivery-fees" | "credit-notes" | "messages" | "product-positioning" | "email-settings" | "reviews" | "whatsapp-settings" | "audit" | "category-positioning" | "repairs" | "warranties" | "help";

type StaffRole = "admin" | "owner" | "technician" | "manager" | "staff" | "provider";

// A-4: Re-authenticate before a high-risk action. Prompts for the current password,
// obtains a short-lived step-up token, and returns true on success. Returns false if
// the user cancels or the password is wrong.
async function stepUpForHighRiskAction(action: string): Promise<boolean> {
  const password = await promptDialog({
    title: `Confirm your password to ${action}`,
    message: "This is a sensitive action. Re-enter your password to continue.",
    label: "Password",
    placeholder: "Enter your password",
    confirmLabel: "Continue",
    danger: true,
  });
  if (password === null) return false;
  const ok = await obtainStepUpToken(password);
  if (!ok) {
    toast("error", "Incorrect password. Please try again.");
    return false;
  }
  return true;
}
// Which permission unlocks a view in the sidebar. Views absent from this map
// (groups, categories, users, roles, plans, stock-on-hand, stock-transfers,
// purchases, clients, storefront, settings, delivery-fees, email-settings,
// category-positioning) are admin-only.
const VIEW_PERMISSIONS: Partial<Record<AdminView, string>> = {
  dashboard: "",
  pos: "",
  products: "product:update",
  orders: "order:view",
  customers: "customer:view",
  quotations: "quote:view",
  repairs: "repair:list",
  warranties: "order:view",
  coupons: "coupon:view",
  "gift-cards": "giftcard:view",
  campaigns: "campaign:view",
  "abandoned-carts": "cart:view",
  providers: "provider:view",
  invoices: "invoice:view",
  "credit-notes": "credit_note:view",
  reports: "reports:view",
  messages: "messaging:view",
  reviews: "review:view",
  audit: "audit:view",
  "stock-take": "stock:list",
  "stock-control": "stock:list",
  suppliers: "supplier:view",
  branches: "branch:view",
  "spec-templates": "spec:view",
  "shop-subscription": "subscription:view",
  "about-us": "about:view",
  "product-positioning": "positioning:view",
  "whatsapp-settings": "whatsapp:view",
};

const NAV_GROUPS: { label: string; items: { key: AdminView; label: string; feature?: string }[] }[] = [
  {
    label: "Sales",
    items: [
      { key: "orders", label: "Orders" },
      { key: "pos", label: "POS", feature: "POS integration" },
      { key: "quotations", label: "Quotations", feature: "Quotations" },
      { key: "invoices", label: "Invoices", feature: "Invoice/quote PDF downloads" },
      { key: "credit-notes", label: "Credit Notes", feature: "Credit notes" },
      { key: "coupons", label: "Coupons", feature: "Discount/coupon management" },
      { key: "gift-cards", label: "Gift Cards", feature: "Gift cards" },
      { key: "campaigns", label: "Campaigns", feature: "Campaign pages" },
      { key: "abandoned-carts", label: "Abandoned Carts", feature: "Cart recovery" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { key: "products", label: "Products" },
      { key: "groups", label: "Groups" },
      { key: "categories", label: "Categories" },
      { key: "category-positioning", label: "Category Order" },
      { key: "product-positioning", label: "Product Positioning", feature: "Product positioning" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { key: "stock-on-hand", label: "Stock on Hand", feature: "Low stock alerts" },
      { key: "stock-transfers", label: "Stock Transfers", feature: "Stock transfers" },
      { key: "stock-take", label: "Stock Take", feature: "Stock take / inventory count" },
      { key: "stock-control", label: "Stock Control", feature: "Stock take / inventory count" },
      { key: "serials", label: "Serial Numbers" },
      { key: "purchases", label: "Purchase Orders", feature: "Purchase order management" },
      { key: "suppliers", label: "Suppliers", feature: "Supplier management" },
    ],
  },
  {
    label: "Customers",
    items: [
      { key: "customers", label: "Customers" },
    ],
  },
  {
    label: "Services",
    items: [
      { key: "repairs", label: "Repairs", feature: "Repair ticketing" },
      { key: "warranties", label: "Warranty", feature: "Invoice/quote PDF downloads" },
    ],
  },
  {
    label: "Team",
    items: [
      { key: "users", label: "Users", feature: "Multiple staff accounts" },
      { key: "roles", label: "Roles" },
      { key: "clients", label: "Clients", feature: "Client/tenant management" },
      { key: "branches", label: "Branches", feature: "Branch management" },
    ],
  },
  {
    label: "Finance",
    items: [
      { key: "providers", label: "Providers" },
      { key: "shop-subscription", label: "Subscription" },
      { key: "plans", label: "Subscription Plans" },
    ],
  },
  {
    label: "Activity",
    items: [
      { key: "reports", label: "Reports", feature: "Analytics dashboard" },
      { key: "messages", label: "Messages", feature: "Messaging" },
      { key: "reviews", label: "Reviews", feature: "Product reviews & ratings" },
      { key: "audit", label: "Audit Log", feature: "Audit log" },
    ],
  },
  {
    label: "Settings",
    items: [
      { key: "settings-store-info", label: "Store Info" },
      { key: "settings-payments", label: "Payments" },
      { key: "settings-compliance", label: "Compliance" },
      { key: "delivery-fees", label: "Delivery Fees" },
      { key: "settings-content", label: "Content" },
      { key: "settings-system", label: "System" },
      { key: "storefront", label: "Storefront" },
      { key: "layout-builder", label: "Layout Builder", feature: "Drag-and-drop storefront builder" },
      { key: "email-settings", label: "Email", feature: "Email notifications" },
      { key: "whatsapp-settings", label: "WhatsApp", feature: "WhatsApp integration" },
      { key: "about-us", label: "About Us" },
      { key: "spec-templates", label: "Spec Templates" },
    ],
  },
  {
    label: "Help",
    items: [
      { key: "help", label: "Help & Reference" },
    ],
  },
];

// Icon per sidebar view. Falls back to "box" when unmapped.
const NAV_ICONS: Partial<Record<AdminView, string>> = {
  products: "box",
  groups: "folder",
  categories: "layers",
  orders: "cart",
  pos: "monitor",
  customers: "users",
  warranties: "shieldCheck",
  coupons: "tag",
  "gift-cards": "gift",
  campaigns: "megaphone",
  "abandoned-carts": "returns",
  quotations: "file",
  "category-positioning": "move",
  repairs: "wrench",
  "stock-on-hand": "boxes",
  "stock-transfers": "refresh",
  "stock-take": "clipboard",
  "stock-control": "sliders",
  serials: "hash",
  purchases: "fileText",
  suppliers: "truck",
  users: "users",
  roles: "shield",
  clients: "building",
  branches: "store",
  invoices: "receipt",
  "credit-notes": "file",
  providers: "briefcase",
  reports: "chart",
  messages: "messageCircle",
  reviews: "star",
  audit: "eye",
  "settings-store-info": "store",
  "settings-payments": "card",
  "settings-compliance": "shield",
  "delivery-fees": "truck",
  "settings-content": "image",
  "settings-system": "settings",
  storefront: "monitor",
  "layout-builder": "layout",
  "product-positioning": "move",
  "email-settings": "mail",
  "whatsapp-settings": "message",
  "about-us": "info",
  plans: "layers",
  "spec-templates": "clipboard",
  "shop-subscription": "calendar",
  help: "info",
};

export default function AdminPage() {
  const { isDark, toggleDark, settings, refreshSettings } = useApp();
  const [authed, setAuthed] = useState(false);
  const [staffRole, setStaffRole] = useState<StaffRole>("admin");
  const [staffPermissions, setStaffPermissions] = useState<string[]>([]);
  const [view, setView] = useState<AdminView>("dashboard");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showForgotPw, setShowForgotPw] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotSending, setForgotSending] = useState(false);
  const [googleClientId, setGoogleClientId] = useState("");
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [faviconMsg, setFaviconMsg] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const gisLoadedRef = useRef(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["Sales", "Inventory", "Customers", "Services", "Team"]);
  const [navQuery, setNavQuery] = useState("");
  const router = useRouter();
  const featureFlags: Record<string, boolean> = {
    "Messaging": useFeature("Messaging"),
    "Credit notes": useFeature("Credit notes"),
    "Quotations": useFeature("Quotations"),
    "Repair ticketing": useFeature("Repair ticketing"),
    "Product positioning": useFeature("Product positioning"),
    "Email notifications": useFeature("Email notifications"),
    "Stock transfers": useFeature("Stock transfers"),
    "Supplier management": useFeature("Supplier management"),
    "Branch management": useFeature("Branch management"),
    "Multi-currency support": useFeature("Multi-currency support"),
    "WhatsApp integration": useFeature("WhatsApp integration"),
    "Product reviews & ratings": useFeature("Product reviews & ratings"),
    "Customer reviews": useFeature("Customer reviews"),
    "Discount/coupon management": useFeature("Discount/coupon management"),
    "Low stock alerts": useFeature("Low stock alerts"),
    "Stock take / inventory count": useFeature("Stock take / inventory count"),
    "Purchase order management": useFeature("Purchase order management"),
    "Invoice/quote PDF downloads": useFeature("Invoice/quote PDF downloads"),
    "Analytics dashboard": useFeature("Analytics dashboard"),
    "Audit log": useFeature("Audit log"),
    "Multiple staff accounts": useFeature("Multiple staff accounts"),
    "Client/tenant management": useFeature("Client/tenant management"),
    "eTIMS/KRA compliance": useFeature("eTIMS/KRA compliance"),
    "POS integration": useFeature("POS integration"),
    "Visitor analytics": useFeature("Visitor analytics"),
    "Gift cards": useFeature("Gift cards"),
    "Campaign pages": useFeature("Campaign pages"),
    "Cart recovery": useFeature("Cart recovery"),
  };
  const hasFeature = (f?: string) => !f || featureFlags[f] === true;
  const canAccess = (key: AdminView) => {
    if (staffRole === "admin") return true;
    const perm = VIEW_PERMISSIONS[key];
    if (perm === undefined) return false;
    if (perm === "") return true;
    return staffPermissions.includes(perm);
  };
  const visibleNavGroups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => hasFeature(i.feature) && canAccess(i.key)) })).filter((g) => g.items.length > 0);
  const allVisibleKeys = visibleNavGroups.flatMap((g) => g.items.map((i) => i.key));
  const navQueryLower = navQuery.trim().toLowerCase();
  const navSearching = navQueryLower.length > 0;
  const filteredNavGroups = navSearching
    ? visibleNavGroups
        .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(navQueryLower)) }))
        .filter((g) => g.items.length > 0)
    : visibleNavGroups;

  // Keep the group containing the active view expanded so the selection is always visible.
  useEffect(() => {
    const g = visibleNavGroups.find((grp) => grp.items.some((i) => i.key === view));
    if (g) setExpandedGroups((prev) => (prev.includes(g.label) ? prev : [...prev, g.label]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    if (view !== "dashboard" && !allVisibleKeys.includes(view)) setView("dashboard");
  }, [view, allVisibleKeys]);

  // ---- URL sync: deep-linkable views (?view=repairs) with working Back ----
  const ALL_VIEW_KEYS = useMemo(() => new Set<string>(["dashboard", ...NAV_GROUPS.flatMap((g) => g.items.map((i) => i.key))]), []);

  useEffect(() => {
    const q = router.query.view;
    if (typeof q !== "string") return;
    if (q === "pos") { window.location.assign("/pos"); return; }
    if (ALL_VIEW_KEYS.has(q) && q !== view) setView(q as AdminView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.view]);

  useEffect(() => {
    const current = typeof router.query.view === "string" ? router.query.view : "";
    if (current !== view) {
      router.replace({ pathname: "/admin", query: view === "dashboard" ? {} : { view } }, undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const viewLabel = useMemo(() => {
    if (view === "dashboard") return "Dashboard";
    for (const g of NAV_GROUPS) {
      const item = g.items.find((i) => i.key === view);
      if (item) return item.label;
    }
    return "Admin";
  }, [view]);

  const SHORTCUTS_TO_VIEW: Record<string, AdminView> = {
    d: "dashboard", p: "products", o: "orders", c: "customers", u: "users",
    r: "repairs", s: "stock-on-hand", i: "invoices", h: "help",
  };
  const visibleKeysRef = useRef<AdminView[]>(allVisibleKeys);
  useEffect(() => { visibleKeysRef.current = allVisibleKeys; });

  useEffect(() => {
    let buffer: string[] = [];
    let clearTimer: ReturnType<typeof setTimeout> | null = null;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") { setView("help"); return; }
      if (e.key === "Escape") { buffer = []; return; }
      if (e.key.length !== 1) return;
      const key = e.key.toLowerCase();
      if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
      buffer.push(key);
      if (buffer.length >= 2) {
        const targetView = SHORTCUTS_TO_VIEW[buffer[1]];
        if (buffer[0] === "g" && targetView && visibleKeysRef.current.includes(targetView)) setView(targetView);
        buffer = [];
      } else if (buffer[0] !== "g") {
        buffer = [];
      }
      clearTimer = setTimeout(() => { buffer = []; }, 1600);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    api<{ googleClientId: string }>("/api/public-settings").then((d) => setGoogleClientId(d.googleClientId || "")).catch((e) => console.warn("[admin] Failed to load public settings:", e?.message));
  }, []);

  useEffect(() => {
    if (!googleClientId || !googleBtnRef.current || gisLoadedRef.current) return;
    if (typeof window.google === "undefined") {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => renderGoogleBtn();
      document.head.appendChild(script);
    } else {
      renderGoogleBtn();
    }
  }, [googleClientId]);

  function handleFaviconChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFaviconMsg("");
    setFaviconFile(e.target.files?.[0] || null);
  }

  async function handleFaviconUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!faviconFile) {
      setFaviconMsg("Select a favicon file first.");
      return;
    }
    setFaviconUploading(true);
    setFaviconMsg("");
    const formData = new FormData();
    formData.append("favicon", faviconFile);
    try {
      await api("/api/settings/favicon", { method: "POST", body: formData }, "staff");
      setFaviconMsg("Favicon updated successfully.");
      setFaviconFile(null);
      refreshSettings();
    } catch (err: any) {
      setFaviconMsg("Error: " + err.message);
    } finally {
      setFaviconUploading(false);
    }
  }

  function renderGoogleBtn() {
    if (!window.google || !googleBtnRef.current) return;
    gisLoadedRef.current = true;
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleCredential,
    });
    window.google.accounts.id.renderButton(googleBtnRef.current, { theme: "outline", size: "large", width: 320 });
  }

  async function handleGoogleCredential(response: { credential: string }) {
    if (!response.credential) return;
    setLoginLoading(true);
    setLoginError("");
    try {
      const data = await api("/api/auth/google-admin-login", {
        method: "POST",
        body: JSON.stringify({ credential: response.credential }),
      });
      localStorage.setItem("computerStoreToken", data.token);
      localStorage.setItem("staffUserName", data.username || "Staff");
      setStaffRole((data.role as StaffRole) || "admin");
      setStaffPermissions(Array.isArray(data.permissions) ? data.permissions : []);
      setAuthed(true);
    } catch (err: any) {
      setLoginError(err.message || "Google sign-in failed");
    } finally {
      setLoginLoading(false);
    }
  }

  function toggleGroup(label: string) {
    setExpandedGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  }

  useEffect(() => {
    if (hasStaffSession()) {
      setAuthed(true);
      setStaffRole((getStaffRole() as StaffRole) || "admin");
      setStaffPermissions(getStaffPermissions());
    }
  }, []);

  useEffect(() => {
    if (authed && staffRole === "admin") {
      api<{ requests: any[] }>("/api/shop/subscription/requests").then((d) => {
        setPendingCount((d.requests || []).filter((r) => r.status === "pending").length);
      }).catch((e) => console.warn("[admin] Failed to load subscription requests:", e?.message));
    }
  }, [authed, view]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username: loginUsername, password: loginPassword }) });
      const isStaffLogin = ["admin", "owner", "technician", "manager", "staff", "provider"].includes(data.role);
      if (!isStaffLogin) { setLoginError("Staff access required."); return; }
      localStorage.setItem("computerStoreToken", data.token);
      localStorage.setItem("staffUserName", data.username || "Staff");
      setStaffRole(data.role || "admin");
      setStaffPermissions(Array.isArray(data.permissions) ? data.permissions : []);
      setAuthed(true);
    } catch (err: any) { setLoginError(err.message); }
    finally { setLoginLoading(false); }
  }

  if (!authed) {
    return (
      <div className="auth-page" style={{ marginTop: "3rem" }}>
        <PageHead title={`Staff sign in — ${settings?.storeName || "Store"}`} />
        <h1>Staff Portal</h1>
        <form onSubmit={handleLogin} className="auth-form">
          <div className="field"><label>Username or email<input value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} required /></label></div>
          <div className="field"><label>Password<input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required /></label></div>
          {loginError && <p className="error">{loginError}</p>}
          <RippleButton type="submit" className="btn-block" loading={loginLoading}>Sign in</RippleButton>
          <p style={{ textAlign: "center", marginTop: "0.75rem" }}>
            <button type="button" onClick={() => { setShowForgotPw(true); setForgotMsg(""); setForgotEmail(""); }} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline" }}>
              Forgot password?
            </button>
          </p>
          {googleClientId && (
            <>
              <div style={{ textAlign: "center", margin: "0.75rem 0", color: "var(--text-secondary)", fontSize: "0.85rem" }}>or</div>
              <div ref={googleBtnRef} style={{ display: "flex", justifyContent: "center" }}></div>
            </>
          )}
        </form>

        {showForgotPw && (
          <div style={{ position: "fixed", inset: 0, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowForgotPw(false)}>
            <div className="panel" role="dialog" aria-modal="true" aria-labelledby="reset-pw-title" style={{ maxWidth: 400, width: "90%", position: "relative" }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape") setShowForgotPw(false); }}>
              <h3 id="reset-pw-title" style={{ marginTop: 0 }}>Reset Password</h3>
              <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
                Enter your email address. If an admin account exists, we'll send a reset link.
              </p>
              <input autoFocus value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@example.com" style={{ width: "100%", marginBottom: "0.75rem" }} />
              {forgotMsg && <p style={{ padding: "0.5rem", borderRadius: 6, background: "var(--success-light)", color: "var(--success-text)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{forgotMsg}</p>}
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <RippleButton size="small" loading={forgotSending} onClick={async () => {
                  if (!forgotEmail.trim()) return;
                  setForgotSending(true);
                  try {
                    await api("/api/auth/request-admin-password-reset", { method: "POST", body: JSON.stringify({ email: forgotEmail.trim() }) });
                    setForgotMsg("If an account exists, a reset link has been sent.");
                    setForgotEmail("");
                  } catch { setForgotMsg("Failed to send. Try again."); }
                  finally { setForgotSending(false); }
                }}>Send Reset Link</RippleButton>
                <RippleButton size="small" variant="secondary" onClick={() => setShowForgotPw(false)}>Close</RippleButton>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="dash-layout dash-layout--bare">
      <PageHead title={`${viewLabel} — ${settings?.storeName || "Store"} admin`} />
      <nav className="dash-nav" aria-label="Admin navigation">
        <div className="dash-nav-search">
          <Icon name="search" size={14} />
          <input
            className="input"
            type="search"
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
            placeholder="Filter menu…"
            aria-label="Filter admin menu"
          />
          {navSearching && (
            <button type="button" className="dash-nav-search-clear" onClick={() => setNavQuery("")} aria-label="Clear filter">
              <Icon name="x" size={12} />
            </button>
          )}
        </div>

        <RippleButton
          variant="ghost"
          className={`dash-nav-item dash-nav-home${view === "dashboard" ? " active" : ""}`}
          onClick={() => setView("dashboard")}
          aria-current={view === "dashboard" ? "page" : undefined}
        >
          <Icon name="home" size={15} />
          Home
        </RippleButton>

        <div className="dash-nav-groups">
          {filteredNavGroups.map((group) => {
            const isOpen = navSearching || expandedGroups.includes(group.label);
            const isChildActive = group.items.some((item) => view === item.key);
            return (
              <div key={group.label} className="dash-nav-group">
                <button
                  type="button"
                  className={`dash-nav-group-label${isChildActive ? " has-active" : ""}`}
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={isOpen}
                >
                  {group.label}
                  <Icon name="chevronDown" size={12} className="dash-nav-chevron" />
                </button>
                {isOpen && group.items.map((item) => (
                  <RippleButton
                    key={item.key}
                    variant="ghost"
                    className={`dash-nav-item${view === item.key ? " active" : ""}`}
                    onClick={() => { if (item.key === "pos") { window.location.assign("/pos"); return; } setView(item.key); }}
                    aria-current={view === item.key ? "page" : undefined}
                  >
                    <Icon name={NAV_ICONS[item.key] || "box"} size={15} />
                    <span className="dash-nav-item-label">{item.label}</span>
                    {item.key === "shop-subscription" && pendingCount > 0 && (
                      <span className="dash-nav-badge">{pendingCount}</span>
                    )}
                  </RippleButton>
                ))}
              </div>
            );
          })}
          {navSearching && filteredNavGroups.length === 0 && (
            <p className="dash-nav-empty">No matches for &ldquo;{navQuery.trim()}&rdquo;.</p>
          )}
        </div>

        <RippleButton
          variant="ghost"
          className="dash-nav-item dash-nav-signout"
          onClick={() => { localStorage.removeItem("computerStoreToken"); window.location.href = "/"; }}
        >
          <Icon name="logOut" size={15} />
          Sign out
        </RippleButton>
      </nav>
        <div className="dash-content">
          <div className="admin-topbar">
            <div className="admin-topbar-left">
              {settings?.storeLogo && <img src={settings.storeLogo} alt="" className="admin-topbar-logo" />}
              <span className="admin-topbar-store">{settings?.storeName || "Store"}</span>
              <span className="admin-topbar-role">{staffRole}</span>
            </div>
            <div className="admin-topbar-actions">
              <button type="button" className="admin-topbar-btn primary" onClick={() => { window.location.href = "/pos"; }} aria-label="Open POS" title="Open point of sale">POS</button>
              {featureFlags["Messaging"] && canAccess("messages") && <NotificationBell onClick={() => setView("messages")} />}
              <button type="button" className="admin-topbar-btn" onClick={() => setView("help")} aria-label="Help" title="Help &amp; keyboard shortcuts (?)">?</button>
              <button type="button" className="admin-topbar-btn" onClick={toggleDark} aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"} title={isDark ? "Switch to light theme" : "Switch to dark theme"}>
                <Icon name={isDark ? "sun" : "moon"} size={16} />
              </button>
            </div>
          </div>
          <div className="dash-section active" key={view}>
            {view === "dashboard" && <AdminDashboard staffRole={staffRole} staffPermissions={staffPermissions} onNavigate={setView} />}
            {view === "products" && <AdminProducts />}
            {view === "groups" && <AdminGroups />}
            {view === "categories" && <AdminCategories />}
            {view === "orders" && <AdminOrders />}
            {view === "customers" && <AdminCustomers />}
            {view === "coupons" && <AdminCoupons />}
            {view === "gift-cards" && <AdminGiftCards />}
            {view === "campaigns" && <AdminCampaigns />}
            {view === "abandoned-carts" && <AdminAbandonedCarts />}
            {view === "quotations" && <AdminQuotations />}
            {view === "users" && <AdminUsers />}
            {view === "roles" && <AdminRoles />}
            {view === "plans" && <AdminPlans />}
            {view === "providers" && <AdminProviders />}
            {view === "invoices" && <AdminInvoices />}
            {view === "credit-notes" && <AdminCreditNotes />}
            {view === "reports" && <AdminReports />}
            {view === "audit" && <AdminAuditLog />}
            {view === "stock-on-hand" && <AdminStockOnHand />}
            {view === "stock-transfers" && <AdminStockTransfers />}
            {view === "stock-take" && <AdminStockTake />}
            {view === "stock-control" && <AdminStockControl />}
            {view === "purchases" && <AdminPurchases />}
            {view === "serials" && <AdminSerials />}
            {view === "clients" && <AdminClients />}
            {view === "branches" && <AdminBranches />}
            {view === "spec-templates" && <AdminSpecTemplates />}
            {view === "suppliers" && <AdminSuppliers />}
            {view === "shop-subscription" && <AdminShopSubscription />}
            {view === "about-us" && <AdminAboutUs />}
            {view === "storefront" && <AdminStorefront onOpenBuilder={() => setView("layout-builder")} />}
            {view === "layout-builder" && <StorefrontBuilder />}
            {view === "settings-store-info" && <AdminStoreInfo />}
            {view === "settings-payments" && <AdminPayments />}
            {view === "settings-compliance" && <AdminCompliance />}
            {view === "settings-content" && <AdminContent />}
            {view === "settings-system" && <AdminSystem />}
            {view === "delivery-fees" && <AdminDeliveryFees />}
            {view === "messages" && <AdminMessages />}
            {view === "reviews" && <AdminReviews />}
            {view === "product-positioning" && <AdminProductPositioning />}
            {view === "email-settings" && <AdminEmailSettings />}
            {view === "whatsapp-settings" && <WhatsAppSettings />}
            {view === "category-positioning" && <CategoryPositioningPage />}
            {view === "repairs" && <AdminRepairs adminOnly={staffRole === "admin"} />}
            {view === "warranties" && <AdminWarranties />}
            {view === "help" && <HelpPanel />}
          </div>
      </div>
    </div>
  );
}

function AdminAuditLog() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  useEffect(() => { fetchLog(); }, []);

  async function fetchLog() {
    setLoading(true); setError("");
    try { const d = await api<any>(`/api/audit-log${filter ? "?entityType=" + encodeURIComponent(filter) : ""}`); setEntries(d.entries || []); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  return (
    <>
      <h1>Audit Log</h1>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1rem" }}>
        <div className="field" style={{ margin: 0 }}><label>Filter by entity type<input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="e.g. plan, shop_subscription" style={{ fontSize: "0.85rem" }} /></label></div>
        <RippleButton size="small" onClick={fetchLog} loading={loading}>Filter</RippleButton>
        <span style={{ fontSize: "0.85rem", opacity: 0.5 }}>{entries.length} entries</span>
      </div>
      {error && <ErrorMsg msg={error} />}
      {loading ? <Spinner /> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>
              {entries.map((e: any) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}>{new Date(e.createdAt).toLocaleString()}</td>
                  <td>{escapeHtml(e.userName || "?")}</td>
                  <td><span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{e.action}</span></td>
                  <td style={{ fontSize: "0.85rem" }}>{e.entityType}:{e.entityId}</td>
                  <td style={{ fontSize: "0.8rem", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>{e.details ? JSON.stringify(e.details) : "-"}</td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={5}><EmptyState icon="audit" title="No log entries" description="Audit trail entries will appear here as actions are performed." /></td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function AdminDashboard({ staffRole, staffPermissions, onNavigate }: { staffRole: StaffRole; staffPermissions: string[]; onNavigate: (v: AdminView) => void }) {
  const isAdmin = staffRole === "admin";
  const hasPerm = (p: string) => isAdmin || staffPermissions.includes(p);
  const { data: stats, loading: statsLoading } = useFetch(() => api<any>("/api/backoffice/stats"), []);
  const { data: products, loading: prodLoading } = useFetch(() => api<{ products: Product[] }>("/api/products?includeHidden=1"), []);
  const { data: subReq, loading: subLoading } = useFetch(() => isAdmin ? api<any>("/api/shop/subscription/requests") : Promise.resolve(null), []);

  // Today's numbers
  const today = new Date().toISOString().slice(0, 10);
  const canOrders = hasPerm("order:view");
  const { data: todayReport } = useFetch(
    () => canOrders ? api<any>(`/api/reports/sales?from=${today}&to=${today}`) : Promise.resolve(null),
    [today]
  );

  // Attention panel data
  const canStock = hasPerm("stock:list");
  const canRepairs = hasPerm("repair:list");
  const canMessages = hasPerm("messaging:view");
  const { data: lowStock } = useFetch(() => canStock ? api<any>("/api/stock/low-items") : Promise.resolve(null), []);
  const { data: repairs } = useFetch(() => canRepairs ? api<any>("/api/repairs") : Promise.resolve(null), []);
  const { data: messages } = useFetch(() => canMessages ? api<any>("/api/admin/messages") : Promise.resolve(null), []);

  const pendingReqs = (subReq?.requests || []).filter((r: any) => r.status === "pending").length;
  const loading = statsLoading || prodLoading || subLoading;

  const lowItems: { productId: string; name: string; quantityInStock: number; lowStockThreshold: number }[] = lowStock?.items || [];
  const outOfStock = lowItems.filter((i) => i.quantityInStock <= 0).length;

  const tickets: any[] = repairs?.tickets || [];
  const openTickets = tickets.filter((t) => !["collected", "cancelled"].includes(t.status));
  const readyTickets = openTickets.filter((t) => t.status === "ready").length;

  const unreadMessages = (messages?.messages || []).filter((m: any) => m.sender_role !== "admin" && !m.read_at).length;

  const todayRevenue = todayReport?.totalRevenue ?? 0;
  const todayOrders = todayReport?.totalOrders ?? 0;

  const attentionItems = [
    canStock && lowItems.length > 0 ? { label: "Low stock", value: lowItems.length, note: outOfStock > 0 ? `${outOfStock} out of stock` : undefined, view: "stock-on-hand" as AdminView, tone: outOfStock > 0 ? "danger" : "warning" } : null,
    canRepairs && readyTickets > 0 ? { label: "Repairs ready", value: readyTickets, note: "awaiting collection", view: "repairs" as AdminView, tone: "success" } : null,
    canMessages && unreadMessages > 0 ? { label: "Unread messages", value: unreadMessages, view: "messages" as AdminView, tone: "warning" } : null,
    isAdmin && pendingReqs > 0 ? { label: "Subscription requests", value: pendingReqs, view: "shop-subscription" as AdminView, tone: "warning" } : null,
  ].filter(Boolean) as { label: string; value: number; note?: string; view: AdminView; tone: string }[];

  function nav(v: AdminView) { onNavigate(v); }

  function StatCard({ value, label, onClick, tone }: { value: number; label: string; onClick?: () => void; tone?: string }) {
    return (
      <div
        className={`stat-card card-hover${onClick ? " dash-stat-clickable" : ""}`}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
        style={tone ? { borderColor: `var(--${tone})` } : undefined}
      >
        <div className="stat-card__value" style={tone ? { color: `var(--${tone})` } : undefined}>{value.toLocaleString()}</div>
        <div className="stat-card__label">{label}</div>
      </div>
    );
  }

  if (loading) return <><h1>Dashboard</h1><SkeletonStats /></>;

  const PIPELINE = [
    { key: "received", label: "Received" },
    { key: "diagnosing", label: "Diagnosing" },
    { key: "waiting_parts", label: "Waiting parts" },
    { key: "in_progress", label: "In progress" },
    { key: "ready", label: "Ready" },
  ];

  return (
    <>
      <h1 className="anim-fade-in-down">Dashboard</h1>

      <div className="stat-grid">
        <StatCard value={products?.products?.length ?? 0} label="Total Products" onClick={() => nav("products")} />
        {canOrders && <StatCard value={todayOrders} label="Orders Today" onClick={() => nav("orders")} />}
        {canOrders && <StatCard value={todayRevenue} label="Revenue Today (KES)" onClick={() => nav("reports")} />}
        {canRepairs && <StatCard value={openTickets.length} label="Open Repairs" onClick={() => nav("repairs")} />}
        {canStock && <StatCard value={lowItems.length} label="Low-Stock Items" tone={lowItems.length > 0 ? "warning" : undefined} onClick={() => nav("stock-on-hand")} />}
        {isAdmin && <StatCard value={stats?.totalStaff ?? 0} label="Users" onClick={() => nav("users")} />}
        {isAdmin && <StatCard value={pendingReqs} label="Pending Sub. Requests" tone={pendingReqs > 0 ? "danger" : undefined} onClick={() => nav("shop-subscription")} />}
      </div>

      {attentionItems.length > 0 && (
        <div className="dash-attention" role="status">
          {attentionItems.map((a) => (
            <button type="button" key={a.label} className={`dash-attention-item tone-${a.tone}`} onClick={() => nav(a.view)}>
              <span className="dash-attention-value">{a.value}</span>
              <span className="dash-attention-label">{a.label}{a.note ? <em> — {a.note}</em> : null}</span>
              <Icon name="arrowRight" size={15} />
            </button>
          ))}
        </div>
      )}

      {(canStock && lowItems.length > 0) || canRepairs ? (
        <div className="dash-cols">
          {canStock && lowItems.length > 0 && (
            <div className="panel dash-lowstock">
              <h3>Low stock — top 5</h3>
              <ul>
                {lowItems.slice(0, 5).map((i) => (
                  <li key={i.productId}>
                    <span className="dash-lowstock-name">{i.name}</span>
                    <span className={`badge ${i.quantityInStock <= 0 ? "badge-danger" : "badge-warning"}`}>
                      {i.quantityInStock <= 0 ? "Out of stock" : `${i.quantityInStock} left`}
                    </span>
                  </li>
                ))}
              </ul>
              {lowItems.length > 5 && (
                <button type="button" className="btn btn-subtle btn-sm" onClick={() => nav("stock-on-hand")}>
                  View all {lowItems.length} low-stock items
                </button>
              )}
            </div>
          )}

          {canRepairs && (
            <div className="panel dash-repairpipeline">
              <h3>Repair pipeline</h3>
              <ul>
                {PIPELINE.map((s) => {
                  const count = openTickets.filter((t) => t.status === s.key).length;
                  return (
                    <li key={s.key}>
                      <span className="dash-lowstock-name">{s.label}</span>
                      <span className="dash-pipeline-count">{count}</span>
                    </li>
                  );
                })}
              </ul>
              <button type="button" className="btn btn-subtle btn-sm" onClick={() => nav("repairs")}>
                Open repairs
              </button>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

// ===================== PRODUCTS =====================
// ===================== CATEGORIES =====================
function AdminCategories() {
  const { data: cData, loading, error, refetch } = useFetch(() => api<any>("/api/categories"), []);
  const [groups, setGroups] = useState<any[]>([]);
  const [detail, setDetail] = useState<{ mode: "add" | "edit"; cat: any } | null>(null);
  const [formLabel, setFormLabel] = useState("");
  const [formGroup, setFormGroup] = useState("");
  const [formShowOnPos, setFormShowOnPos] = useState(true);
  const [catSubs, setCatSubs] = useState<any[]>([]);
  const [newSubId, setNewSubId] = useState("");
  const [newSubName, setNewSubName] = useState("");
  const [editSubId, setEditSubId] = useState("");
  const [editSubName, setEditSubName] = useState("");

  useEffect(() => {
    api<any>("/api/admin/groups").then((d) => setGroups(d.groups || [])).catch(() => setGroups([]));
  }, []);

  async function deleteCat(id: string) {
    if (!(await confirmDialog({ message: `Delete category "${id}"?`, confirmLabel: "Delete", danger: true }))) return;
    try { await api(`/api/categories/${encodeURIComponent(id)}`, { method: "DELETE" }); refetch(); toast("success", "Category deleted."); } catch { toast("error", "Delete failed"); }
  }

  async function saveCat() {
    if (!formLabel.trim()) return;
    try {
      if (detail?.mode === "add") {
        const id = formLabel.trim().toLowerCase().replace(/\s+/g, "-");
        await api("/api/categories", { method: "POST", body: JSON.stringify({ id, label: formLabel.trim(), group: formGroup.trim(), showOnPos: formShowOnPos }) });
      } else if (detail?.mode === "edit") {
        await api(`/api/categories/${encodeURIComponent(detail.cat.id)}`, { method: "PUT", body: JSON.stringify({ label: formLabel.trim(), group: formGroup.trim(), showOnPos: formShowOnPos }) });
      }
      setDetail(null); refetch();
      toast("success", detail?.mode === "add" ? "Category created." : "Category saved.");
    } catch { toast("error", "Failed to save category"); }
  }

  async function addSub() {
    if (!newSubId.trim() || !newSubName.trim()) return;
    const catId = detail?.cat?.id || formLabel.trim().toLowerCase().replace(/\s+/g, "-");
    try {
      await api("/api/subcategories", { method: "POST", body: JSON.stringify({ id: newSubId.trim(), name: newSubName.trim(), category_ids: [catId] }) });
      setNewSubId(""); setNewSubName(""); loadSubs();
      toast("success", "Subcategory added.");
    } catch { toast("error", "Failed to add subcategory"); }
  }

  async function saveEditSub() {
    if (!editSubId) return;
    const catId = detail?.cat?.id || formLabel.trim().toLowerCase().replace(/\s+/g, "-");
    try {
      const existing = catSubs.find((s: any) => s.id === editSubId);
      const currentCats = existing?.category_ids || [];
      const updatedCats = currentCats.includes(catId) ? currentCats : [...currentCats, catId];
      await api(`/api/subcategories/${encodeURIComponent(editSubId)}`, { method: "PUT", body: JSON.stringify({ name: editSubName, category_ids: updatedCats }) });
      setEditSubId(""); loadSubs();
      toast("success", "Subcategory updated.");
    } catch { toast("error", "Failed to update subcategory"); }
  }

  async function deleteSub(id: string) {
    if (!(await confirmDialog({ message: `Delete subcategory "${id}"?`, confirmLabel: "Delete", danger: true }))) return;
    try { await api(`/api/subcategories/${encodeURIComponent(id)}`, { method: "DELETE" }); loadSubs(); toast("success", "Subcategory deleted."); } catch { toast("error", "Delete failed"); }
  }

  function loadSubs() {
    const catId = detail?.cat?.id;
    if (!catId) return;
    fetch(`/api/categories/${encodeURIComponent(catId)}/subcategories`).then(r => r.json()).then(d => setCatSubs(d.subcategories || [])).catch(() => setCatSubs([]));
  }

  function openAdd() {
    setDetail({ mode: "add", cat: null });
    setFormLabel(""); setFormGroup(""); setFormShowOnPos(true); setCatSubs([]);
  }

  function openEdit(cat: any) {
    setDetail({ mode: "edit", cat });
    setFormLabel(cat.label); setFormGroup(cat.group || ""); setFormShowOnPos(cat.showOnPos !== false);
    fetch(`/api/categories/${encodeURIComponent(cat.id)}/subcategories`).then(r => r.json()).then(d => setCatSubs(d.subcategories || [])).catch(() => setCatSubs([]));
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const categories = cData?.categories || [];
  const allSubs = cData?.subcategories || [];

  if (detail) {
    const catId = detail.mode === "add" ? formLabel.trim().toLowerCase().replace(/\s+/g, "-") : detail.cat.id;
    const isNew = detail.mode === "add";

    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setDetail(null)}>&larr; Back</button>
          <h1 style={{ margin: 0 }}>{isNew ? "New Category" : `Edit: ${escapeHtml(detail.cat.label)}`}</h1>
        </div>
        <div className="panel" style={{ maxWidth: 600, marginBottom: "1.5rem" }}>
          <div className="field"><label>Label<input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="Laptops" /></label></div>
          <div className="field"><label>Group<select value={formGroup} onChange={(e) => setFormGroup(e.target.value)}><option value="">None</option>{groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label></div>
          <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}><label style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>Show on POS<input type="checkbox" checked={formShowOnPos} onChange={(e) => setFormShowOnPos(e.target.checked)} style={{ width: "auto" }} /></label></div>
          {isNew && <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>ID will be auto-generated as: <code>{catId}</code></p>}
          <RippleButton onClick={saveCat}>Save Category</RippleButton>
        </div>

        <h2>Subcategories</h2>
        <p className="muted">Subcategories under this category. A subcategory can also belong to other categories.</p>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", alignItems: "end", flexWrap: "wrap" }}>
          <div className="field" style={{ margin: 0 }}><label>ID<input value={newSubId} onChange={(e) => setNewSubId(e.target.value)} placeholder="e.g. gaming" /></label></div>
          <div className="field" style={{ margin: 0 }}><label>Name<input value={newSubName} onChange={(e) => setNewSubName(e.target.value)} placeholder="Gaming" /></label></div>
          <RippleButton onClick={addSub}>Add Subcategory</RippleButton>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>ID</th><th>Name</th><th>Also belongs to</th><th></th></tr></thead>
            <tbody>
              {catSubs.map((s: any) => {
                const otherCats = s.category_ids.filter((cid: string) => cid !== catId).map((cid: string) => { const c = categories.find((x: any) => x.id === cid); return c ? c.label : cid; });
                if (editSubId === s.id) {
                  return (
                    <tr key={s.id}>
                      <td><code>{s.id}</code></td>
                      <td><input value={editSubName} onChange={(e) => setEditSubName(e.target.value)} style={{ width: 140 }} /></td>
                      <td style={{ fontSize: "0.85rem" }}>{otherCats.join(", ") || "—"}</td>
                      <td>
                        <RippleButton size="small" onClick={saveEditSub}>Save changes</RippleButton>
                        <RippleButton size="small" variant="ghost" onClick={() => setEditSubId("")}>Cancel</RippleButton>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={s.id}>
                    <td><code>{s.id}</code></td>
                    <td>{escapeHtml(s.name)}</td>
                    <td style={{ fontSize: "0.85rem" }}>{otherCats.join(", ") || "—"}</td>
                    <td>
                      <RippleButton size="small" variant="ghost" onClick={() => { setEditSubId(s.id); setEditSubName(s.name); }}>Edit</RippleButton>
                      <RippleButton size="small" variant="danger" onClick={() => deleteSub(s.id)}>Delete</RippleButton>
                    </td>
                  </tr>
                );
              })}
              {catSubs.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "1rem" }}>No subcategories yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>Categories</h1>
        <RippleButton onClick={openAdd}>+ Add Category</RippleButton>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>ID</th><th>Label</th><th>Group</th><th>POS</th><th>Subcategories</th><th></th></tr></thead>
          <tbody>
            {categories.map((c: any) => {
              const subs = allSubs.filter((s: any) => s.category_ids.includes(c.id));
              return (
                <tr key={c.id}>
                  <td><code>{c.id}</code></td>
                  <td>{escapeHtml(c.label)}</td>
                  <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{groups.find((g: any) => g.id === c.group)?.name || "—"}</td>
                  <td style={{ fontSize: "0.85rem", textAlign: "center" }}>{c.showOnPos !== false ? "✓" : "✗"}</td>
                  <td style={{ fontSize: "0.85rem" }}>{subs.map((s: any) => s.name).join(", ") || "—"}</td>
                  <td>
                    <RippleButton size="small" variant="ghost" onClick={() => openEdit(c)}>Edit</RippleButton>
                    <RippleButton size="small" variant="danger" onClick={() => deleteCat(c.id)}>Delete</RippleButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ===================== GROUPS =====================
function AdminGroups() {
  const { data: gData, loading, error, refetch } = useFetch(() => api<any>("/api/admin/groups"), []);
  const [newName, setNewName] = useState("");
  const [newSort, setNewSort] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editSort, setEditSort] = useState(0);
  const [msg, setMsg] = useState("");

  const groups = gData?.groups || [];
  const nextSort = groups.length ? Math.max(...groups.map((g: any) => Number(g.sortOrder) || 0)) + 1 : 0;

  async function createGroup() {
    if (!newName.trim()) return;
    setSaving(true); setMsg("");
    try {
      await api("/api/admin/groups", { method: "POST", body: JSON.stringify({ name: newName.trim(), sortOrder: Number(newSort) || 0 }) });
      setNewName(""); setNewSort(nextSort + 1); refetch();
      toast("success", "Group created.");
    } catch (e: any) { setMsg(e.message || "Failed to create group"); }
    finally { setSaving(false); }
  }

  async function toggleActive(g: any) {
    try { await api(`/api/admin/groups/${encodeURIComponent(g.id)}`, { method: "PUT", body: JSON.stringify({ isActive: !g.isActive }) }); refetch(); }
    catch (e: any) { toast("error", e.message || "Update failed"); }
  }

  async function saveEdit() {
    if (!editName.trim()) return;
    setSaving(true);
    try { await api(`/api/admin/groups/${encodeURIComponent(editingId)}`, { method: "PUT", body: JSON.stringify({ name: editName.trim(), sortOrder: Number(editSort) || 0 }) }); setEditingId(""); refetch(); toast("success", "Group saved."); }
    catch (e: any) { setMsg(e.message || "Update failed"); }
    finally { setSaving(false); }
  }

  async function deleteGroup(g: any) {
    if (!(await confirmDialog({ message: `Delete group "${g.name}"? Products assigned to it will keep the value but no longer appear on the storefront.`, confirmLabel: "Delete", danger: true }))) return;
    try { await api(`/api/admin/groups/${encodeURIComponent(g.id)}`, { method: "DELETE" }); refetch(); toast("success", "Group deleted."); }
    catch (e: any) { toast("error", e.message || "Delete failed"); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>Groups</h1>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Groups organise products on the storefront. Activate a group to make it browsable as its own page; groups are also available as report filters.
      </p>

      <div className="panel" style={{ maxWidth: 480, marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Add Group</h3>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "end", flexWrap: "wrap" }}>
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 180 }}><label>Name<input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Gaming PCs" /></label></div>
          <div className="field" style={{ margin: 0, width: 90 }}><label>Sort<input type="number" value={newSort} onChange={(e) => setNewSort(Number(e.target.value))} /></label></div>
          <RippleButton onClick={createGroup} loading={saving}>Add</RippleButton>
        </div>
      </div>

      {msg && <p style={{ fontSize: "0.85rem", color: "var(--danger)", marginBottom: "0.75rem" }}>{msg}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Sort</th><th>Products</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {groups.map((g: any) => (
              <tr key={g.id}>
                <td>{editingId === g.id ? <input value={editName} onChange={(e) => setEditName(e.target.value)} /> : escapeHtml(g.name)}</td>
                <td>{editingId === g.id ? <input type="number" value={editSort} onChange={(e) => setEditSort(Number(e.target.value))} style={{ width: 70 }} /> : g.sortOrder}</td>
                <td>{g.productCount}</td>
                <td>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
                    <input type="checkbox" checked={g.isActive} onChange={() => toggleActive(g)} />
                    {g.isActive ? "Active" : "Inactive"}
                  </label>
                </td>
                <td>
                  {editingId === g.id ? (
                    <>
                      <RippleButton size="small" onClick={saveEdit} loading={saving}>Save changes</RippleButton>
                      <RippleButton size="small" variant="ghost" onClick={() => setEditingId("")}>Cancel</RippleButton>
                    </>
                  ) : (
                    <>
                      <RippleButton size="small" variant="ghost" onClick={() => { setEditingId(g.id); setEditName(g.name); setEditSort(g.sortOrder); }}>Edit</RippleButton>
                      <RippleButton size="small" variant="danger" onClick={() => deleteGroup(g)}>Delete</RippleButton>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {groups.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "1rem" }}>No groups yet. Add one above.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ===================== ORDERS =====================
function AdminOrders() {
  const { data: oData, loading, error, refetch } = useFetch(() => api<{ orders: Order[] }>("/api/admin/orders"), []);
  const [selected, setSelected] = useState<any | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [creditedOrders, setCreditedOrders] = useState<Record<number, boolean>>({});
  const [refunds, setRefunds] = useState<any[]>([]);
  const [refundMsg, setRefundMsg] = useState("");
  const [serialInputs, setSerialInputs] = useState<Record<number, string>>({});
  const [linking, setLinking] = useState<number | null>(null);

  async function linkSerial(itemId: number, serialNumber: string) {
    const code = String(serialNumber || "").trim();
    if (!code) return;
    setLinking(itemId);
    try {
      await api("/api/serials/link-by-number", { method: "POST", body: JSON.stringify({ serialNumber: code, orderItemId: itemId }) });
      const updated = await api<any>(`/api/admin/orders/${selected!.id}`);
      setSelected(updated);
      setSerialInputs((prev) => ({ ...prev, [itemId]: "" }));
      toast("success", "Serial linked.");
    } catch (e: any) {
      toast("error", e.message || "Failed to link serial.");
    } finally {
      setLinking(null);
    }
  }

  async function updateStatus(orderId: number, status: string) {
    setStatusMsg("");
    try {
      await api(`/api/admin/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setStatusMsg(`Order #${orderId} → ${status}`);
      if (selected?.id === orderId) setSelected({ ...selected, status });
      refetch();
    } catch { setStatusMsg("Update failed."); }
  }

  async function openOrder(orderId: number) {
    try {
      const order = await api<any>(`/api/admin/orders/${orderId}`);
      setSelected(order);
      setRefundMsg("");
      setRefunds([]);
      api<any>(`/api/admin/orders/${orderId}/refunds`).then((r) => setRefunds(r.refunds || [])).catch(() => setRefunds([]));
      if (order.customerId) {
        api<any>(`/api/admin/customers/${order.customerId}`).then(setCustomerDetail).catch(() => setCustomerDetail(null));
      } else { setCustomerDetail(null); }
    } catch { toast("error", "Failed to load order"); }
  }

  async function issueRefund(amount: number, reason: string, orderItemId?: number, productId?: string) {
    setRefundMsg("");
    try {
      const body: any = { amount, reason };
      if (orderItemId !== undefined) body.orderItemId = orderItemId;
      if (productId !== undefined) body.productId = productId;
      await api(`/api/admin/orders/${selected.id}/refunds`, { method: "POST", body: JSON.stringify(body) });
      const updated = await api<any>(`/api/admin/orders/${selected.id}`);
      setSelected(updated);
      api<any>(`/api/admin/orders/${selected.id}/refunds`).then((r) => setRefunds(r.refunds || [])).catch(() => setRefunds([]));
      refetch();
      toast("success", "Refund issued.");
    } catch (e: any) {
      setRefundMsg(e.message || "Failed to issue refund.");
      toast("error", e.message || "Failed to issue refund.");
      throw e;
    }
  }

  useEffect(() => {
    if (!oData?.orders?.length) return;
    const ids = oData.orders.map((o) => o.id).join(",");
    api<{ credited: Record<number, boolean> }>(`/api/admin/credit-notes/order-status?orderIds=${ids}`).then((d) => setCreditedOrders(d.credited || {})).catch((e) => console.warn("[admin] Failed to load credit status:", e?.message));
  }, [oData]);

  async function printInvoice(orderId: number) {
    try {
      const res = await api<{ token: string }>("/api/admin/invoice-token/" + orderId, { method: "POST" });
      await downloadPdf(`/api/admin/orders/${orderId}/invoice?allowQueryToken=1&token=${encodeURIComponent(res.token)}`, `invoice-${orderId}.pdf`);
    } catch (e: any) {
      toast("error", "Failed to download invoice: " + (e?.message || "Unknown error"));
    }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const orders = oData?.orders || [];

  if (selected) {
    const o = selected;
    const total = o.subtotal + (o.shippingFee || 0);
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <button className="btn btn-sm btn-ghost" onClick={() => { setSelected(null); setCustomerDetail(null); }}>&larr; Back</button>
          <h1 style={{ margin: 0 }}>Order #{o.id}</h1>
        </div>
        {statusMsg && <p style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 1rem" }}>{statusMsg}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="panel">
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>Customer</h3>
            <p style={{ margin: "0.2rem 0" }}><strong>{escapeHtml(o.customerName || o.shippingName || "—")}</strong></p>
            <p style={{ margin: "0.2rem 0", fontSize: "0.9rem" }}>{escapeHtml(o.customerEmail || "")}</p>
            {customerDetail && (
              <>
                {customerDetail.phone && <p style={{ margin: "0.2rem 0", fontSize: "0.9rem" }}>Phone: {escapeHtml(customerDetail.phone)}</p>}
                <p style={{ margin: "0.2rem 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Status: <span style={{ color: customerDetail.is_active ? "var(--success)" : "var(--danger)" }}>{customerDetail.is_active ? "Active" : "Inactive"}</span>
                  {customerDetail.last_login && <> &middot; Last login: {new Date(customerDetail.last_login).toLocaleDateString("en-GB")}</>}
                </p>
                <p style={{ margin: "0.2rem 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  {customerDetail.orderCount} order{customerDetail.orderCount !== 1 ? "s" : ""} &middot; Total: {formatPrice(customerDetail.totalSpent)}
                </p>
              </>
            )}
          </div>
          <div className="panel">
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>Shipping</h3>
            <p style={{ margin: "0.2rem 0" }}>{escapeHtml(o.shippingName || "—")}</p>
            <p style={{ margin: "0.2rem 0", fontSize: "0.9rem" }}>
              {[o.shippingAddress, o.shippingCity, o.shippingCounty, o.shippingPostcode].filter(Boolean).join(", ") || "—"}
            </p>
            {o.shippingPhone && <p style={{ margin: "0.2rem 0", fontSize: "0.9rem" }}>{escapeHtml(o.shippingPhone)}</p>}
          </div>
          <div className="panel">
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>Status</h3>
            <p style={{ margin: "0.2rem 0" }}><span className="plan-status">{o.status}</span></p>
            <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
              {["confirmed", "shipped", "delivered", "cancelled"].map((s) => (
                <RippleButton key={s} size="small" variant={o.status === s ? "primary" : "ghost"} onClick={() => updateStatus(o.id, s)} disabled={o.status === s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </RippleButton>
              ))}
            </div>
          </div>
          <div className="panel">
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>Order Info</h3>
            <p style={{ margin: "0.2rem 0", fontSize: "0.9rem" }}>Date: {new Date(o.createdAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            <p style={{ margin: "0.2rem 0", fontSize: "0.9rem" }}>Channel: <span style={{ textTransform: "capitalize" }}>{escapeHtml(o.source || "storefront")}</span></p>
            <p style={{ margin: "0.2rem 0", fontSize: "0.9rem" }}>Subtotal: {formatPrice(o.subtotal)}</p>
            <p style={{ margin: "0.2rem 0", fontSize: "0.9rem" }}>Shipping: {formatPrice(o.shippingFee || 0)}</p>
            {o.discountAmount > 0 && <p style={{ margin: "0.2rem 0", fontSize: "0.9rem", color: "var(--success)" }}>Coupon: -{formatPrice(o.discountAmount)}</p>}
            {o.giftCardAmount > 0 && <p style={{ margin: "0.2rem 0", fontSize: "0.9rem", color: "var(--success)" }}>Gift card: -{formatPrice(o.giftCardAmount)}</p>}
            {o.amountRefunded > 0 && <p style={{ margin: "0.2rem 0", fontSize: "0.9rem", color: "var(--danger)" }}>Refunded: -{formatPrice(o.amountRefunded)}</p>}
            <p style={{ margin: "0.2rem 0", fontWeight: 700 }}>Total: {formatPrice(Math.max(0, total - (o.amountRefunded || 0)))}</p>
          </div>
        </div>

        {o.notes && (
          <div className="panel" style={{ marginBottom: "1rem" }}>
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>Notes</h3>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>{escapeHtml(o.notes)}</p>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 style={{ margin: 0 }}>Items</h2>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {creditedOrders[o.id] ? (
              <span className="btn btn-sm" style={{ background: "var(--success-light)", color: "var(--success-text)", cursor: "default" }}>Credit Note Created</span>
            ) : (
              <RippleButton onClick={async () => {
                const reason = await promptDialog({ title: "Create credit note", message: "Reason (optional):", confirmLabel: "Create" });
                if (reason === null) return;
                try {
                  await api("/api/admin/credit-notes", {
                    method: "POST",
                    body: JSON.stringify({ orderId: o.id, reason: reason || "" }),
                  });
                  setCreditedOrders((prev) => ({ ...prev, [o.id]: true }));
                  toast("success", "Credit note created.");
                } catch (e: any) { toast("error", e.message || "Failed to create credit note."); }
              }} style={{ background: "var(--primary)", color: "var(--surface)" }}>Credit Note</RippleButton>
            )}
            <RippleButton onClick={() => printInvoice(o.id)}>Print Invoice</RippleButton>
            <RippleButton variant="danger" onClick={async () => {
              const input = await promptDialog({ title: "Issue refund", message: "Enter the amount to refund.", placeholder: "Amount" });
              if (input === null) return;
              const amount = Number(input);
              if (!amount || amount <= 0) { setRefundMsg("Invalid amount."); toast("error", "Enter a valid refund amount."); return; }
              const reason = (await promptDialog({ title: "Issue refund", message: "Reason (optional):", confirmLabel: "Refund" })) || "";
              issueRefund(amount, reason).catch(() => {});
            }} style={{ background: "var(--danger)", color: "var(--surface)" }}>Refund</RippleButton>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Total</th><th>Warranty</th><th>Serial</th><th></th></tr></thead>
            <tbody>
              {(o.items || []).map((item: any, i: number) => (
                <tr key={item.id || i}>
                  <td>{escapeHtml(item.name)}{!!item.cancelled && <span style={{ marginLeft: "0.4rem", fontSize: "0.75rem", color: "var(--danger)" }}>(refunded)</span>}</td>
                  <td>{formatPrice(item.price)}</td>
                  <td>{item.quantity}</td>
                  <td>{formatPrice(item.lineTotal)}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
                      <input type="checkbox" checked={!!item.hasWarranty} onChange={async () => {
                        try {
                          await api(`/api/admin/order-items/${item.id}/warranty`, { method: "PATCH", body: JSON.stringify({ hasWarranty: !item.hasWarranty, warrantyDuration: item.warrantyDuration }) });
                          setSelected({ ...o, items: o.items.map((it: any) => it.id === item.id ? { ...it, hasWarranty: !item.hasWarranty ? 1 : 0 } : it) });
                        } catch { toast("error", "Failed to update warranty"); }
                      }} />
                      {item.hasWarranty ? (
                        <input type="number" min="0" style={{ width: 50 }} value={item.warrantyDuration || 0} onChange={async (e) => {
                          const v = Number(e.target.value);
                          try {
                            await api(`/api/admin/order-items/${item.id}/warranty`, { method: "PATCH", body: JSON.stringify({ hasWarranty: true, warrantyDuration: v }) });
                            setSelected({ ...o, items: o.items.map((it: any) => it.id === item.id ? { ...it, warrantyDuration: v } : it) });
                          } catch { toast("error", "Failed to update warranty"); }
                        }} />
                      ) : null}
                      <span>{item.hasWarranty ? "mo" : ""}</span>
                    </div>
                  </td>
                  <td>
                    {item.serialNumber ? (
                      <div style={{ fontSize: "0.82rem", fontFamily: "monospace", color: "var(--primary)" }}>{escapeHtml(item.serialNumber)}</div>
                    ) : (
                      <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                        <input
                          type="text"
                          placeholder="Scan serial"
                          value={serialInputs[item.id] || ""}
                          onChange={(e) => setSerialInputs({ ...serialInputs, [item.id]: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); linkSerial(item.id, serialInputs[item.id] || ""); } }}
                          style={{ width: 130, fontSize: "0.8rem", fontFamily: "monospace" }}
                        />
                        <RippleButton size="small" variant="ghost" loading={linking === item.id} onClick={() => linkSerial(item.id, serialInputs[item.id] || "")}>Link</RippleButton>
                      </div>
                    )}
                  </td>
                  <td>
                    {!item.cancelled && (
                      <RippleButton size="small" variant="ghost" onClick={async () => {
                        const amount = Number(await promptDialog({ title: "Refund line", message: "Enter the amount to refund.", placeholder: "Amount", defaultValue: String(item.lineTotal) }));
                        if (!amount || amount <= 0) return;
                        const reason = (await promptDialog({ title: "Refund line", message: "Reason (optional):", confirmLabel: "Refund" })) || "";
                        issueRefund(amount, reason, item.id, item.productId).catch(() => {});
                      }}>Refund line</RippleButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {refundMsg && <p style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 1rem", color: "var(--danger)" }}>{refundMsg}</p>}

        {refunds.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            <h2 style={{ margin: "0 0 0.75rem" }}>Refunds</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Amount</th><th>Reason</th><th>Date</th></tr></thead>
                <tbody>
                  {refunds.map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ color: "var(--danger)" }}>-{formatPrice(r.amount)}</td>
                      <td>{escapeHtml(r.reason || "—")}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{new Date(r.created_at).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <h1>Orders</h1>
      {statusMsg && <p style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 1rem" }}>{statusMsg}</p>}
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>#</th><th>Customer</th><th>Total</th><th>Channel</th><th>County</th><th>Status</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} style={{ cursor: "pointer" }} tabIndex={0} onClick={() => openOrder(o.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openOrder(o.id); } }}>
                <td>{o.id}</td>
                <td>{escapeHtml(o.shippingName || "—")}</td>
                <td>{formatPrice(o.subtotal + o.shippingFee)}</td>
                <td><span style={{ textTransform: "capitalize" }}>{escapeHtml((o as any).source || "storefront")}</span></td>
                <td>{o.shippingCounty || "—"}</td>
                <td><span className="plan-status">{o.status}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>{new Date(o.createdAt).toLocaleDateString("en-GB")}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <select defaultValue="" onChange={(e) => { if (e.target.value) updateStatus(o.id, e.target.value); }}>
                    <option value="" disabled>Update</option>
                    <option value="confirmed">Confirm</option>
                    <option value="shipped">Ship</option>
                    <option value="delivered">Deliver</option>
                    <option value="cancelled">Cancel</option>
                  </select>
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={8}><EmptyState icon="orders" title="No orders yet" description="Customer orders will appear here." /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ===================== USERS =====================
function AdminUsers() {
  const { data: sData, loading, error, refetch } = useFetch(() => api<{ staff: any[] }>("/api/staff"), []);
  const { data: rolesData } = useFetch(() => api<{ roles: any[] }>("/api/roles"), []);
  const { data: permsData } = useFetch(() => api<{ permissions: Record<string, string> }>("/api/permissions"), []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "", role: "technician" });
  const [saving, setSaving] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [userDirectPerms, setUserDirectPerms] = useState<string[]>([]);
  const [userEffectivePerms, setUserEffectivePerms] = useState<string[]>([]);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [pwForm, setPwForm] = useState({ password: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);
  const [msg, setMsg] = useState("");

  const allRoles = rolesData?.roles || [];
  const allPermissions = permsData?.permissions || {};

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await api("/api/staff", { method: "POST", body: JSON.stringify(form) }); setShowForm(false); setForm({ username: "", email: "", password: "", role: "technician" }); refetch(); toast("success", "Staff user created."); } catch (err: any) { toast("error", err.message); }
    finally { setSaving(false); }
  }

  async function deleteStaff(id: number) {
    if (!(await confirmDialog({ message: "Remove this user?", confirmLabel: "Remove", danger: true }))) return;
    if (!(await stepUpForHighRiskAction("remove this user"))) return;
    try { await api(`/api/staff/${id}`, { method: "DELETE" }); refetch(); if (selectedUser?.id === id) setSelectedUser(null); toast("success", "User removed."); } catch { toast("error", "Delete failed"); }
  }

  async function selectUser(user: any) {
    setSelectedUser(user);
    setEditName(user.username || "");
    setEditEmail(user.email || "");
    setPwForm({ password: "", confirm: "" });
    setMsg("");
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api<{ roles: any[] }>(`/api/staff/${user.id}/roles`),
        api<{ effective: string[]; direct: string[] }>(`/api/staff/${user.id}/permissions`),
      ]);
      setUserRoles(rolesRes.roles || []);
      setUserEffectivePerms(permsRes.effective || []);
      setUserDirectPerms(permsRes.direct || []);
    } catch { setUserRoles([]); setUserEffectivePerms([]); setUserDirectPerms([]); }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser || pwForm.password.length < 8) { toast("error", "Password must be at least 8 characters."); return; }
    if (pwForm.password !== pwForm.confirm) { toast("error", "Passwords do not match."); return; }
    setSavingPw(true);
    try {
      await api(`/api/staff/${selectedUser.id}/reset-password`, { method: "POST", body: JSON.stringify({ password: pwForm.password }) });
      setPwForm({ password: "", confirm: "" });
      toast("success", "Password reset successfully.");
    } catch (err: any) { toast("error", err.message); }
    finally { setSavingPw(false); }
  }

  async function toggleRole(roleId: string, assign: boolean) {
    try {
      if (assign) { await api(`/api/staff/${selectedUser.id}/roles/${roleId}`, { method: "POST" }); }
      else { await api(`/api/staff/${selectedUser.id}/roles/${roleId}`, { method: "DELETE" }); }
      const [rolesRes, permsRes] = await Promise.all([
        api<{ roles: any[] }>(`/api/staff/${selectedUser.id}/roles`),
        api<{ effective: string[]; direct: string[] }>(`/api/staff/${selectedUser.id}/permissions`),
      ]);
      setUserRoles(rolesRes.roles || []);
      setUserEffectivePerms(permsRes.effective || []);
    } catch (err: any) { toast("error", err.message); }
  }

  function toggleDirectPerm(perm: string) {
    setUserDirectPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  }

  async function saveAll() {
    if (!selectedUser) return;
    setSaving(true); setMsg("");
    try {
      const [updated] = await Promise.all([
        api<any>(`/api/staff/${selectedUser.id}`, {
          method: "PATCH", body: JSON.stringify({ username: editName.trim(), email: editEmail.trim() })
        }),
        api<{ effective: string[] }>(`/api/staff/${selectedUser.id}/permissions`, {
          method: "PUT", body: JSON.stringify({ permissions: userDirectPerms })
        }),
      ]);
      setSelectedUser(updated);
      setUserEffectivePerms(updated.effective || []);
      refetch();
      setMsg("Changes saved.");
    } catch (err: any) { setMsg("Error: " + err.message); }
    finally { setSaving(false); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const staff = sData?.staff || [];

  return (
    <>
      {!selectedUser && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h1 style={{ margin: 0 }}>Users</h1>
          <RippleButton size="small" onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ Add user"}</RippleButton>
        </div>
      )}
      {showForm && !selectedUser && (
        <div className="panel" style={{ marginBottom: "1rem", maxWidth: 400 }}>
          <form onSubmit={addStaff}>
            <div className="field"><label>Username<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></label></div>
            <div className="field"><label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label></div>
            <div className="field"><label>Password<input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label></div>
            <div className="field"><label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="admin">Admin</option><option value="owner">Owner</option><option value="technician">Technician</option><option value="manager">Manager</option><option value="provider">Provider</option><option value="staff">Staff</option></select></label></div>
            <RippleButton type="submit" loading={saving}>Add user</RippleButton>
          </form>
        </div>
      )}

      {selectedUser ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelectedUser(null)}>&larr; Back</button>
            <h1 style={{ margin: 0 }}>{escapeHtml(selectedUser.username)}</h1>
          </div>
          {msg && <p style={{ padding: "0.5rem 1rem", borderRadius: 8, background: msg.startsWith("Error") ? "var(--danger-light)" : "var(--success-light)", color: msg.startsWith("Error") ? "var(--danger-text)" : "var(--success-text)", marginBottom: "0.75rem", fontSize: "0.85rem" }}>{msg}</p>}

          <div className="panel" style={{ marginBottom: "1rem", maxWidth: 500 }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Account Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <div className="field" style={{ margin: 0 }}><label>Username<input value={editName} onChange={(e) => setEditName(e.target.value)} /></label></div>
              <div className="field" style={{ margin: 0 }}><label>Email<input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></label></div>
            </div>
            <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>Base role: <strong>{selectedUser.role}</strong></p>
          </div>

          <div className="panel" style={{ marginBottom: "1rem", maxWidth: 500 }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Reset Password</h3>
            <form onSubmit={resetPassword} style={{ display: "flex", gap: "0.5rem", alignItems: "end", flexWrap: "wrap" }}>
              <div className="field" style={{ margin: 0 }}><label>New password<input type="password" value={pwForm.password} onChange={(e) => setPwForm({ ...pwForm, password: e.target.value })} required minLength={8} /></label></div>
              <div className="field" style={{ margin: 0 }}><label>Confirm<input type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} required /></label></div>
              <RippleButton type="submit" size="small" loading={savingPw}>Reset</RippleButton>
            </form>
          </div>

          <div className="panel" style={{ marginBottom: "1rem", maxWidth: 500 }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Assigned Roles</h3>
            {allRoles.length === 0 && <p className="muted">No roles defined.</p>}
            {allRoles.map((r: any) => {
              const has = userRoles.some((ur: any) => ur.id === r.id);
              return (
                <label key={r.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0", cursor: "pointer", fontSize: "0.9rem" }}>
                  <input type="checkbox" checked={has} onChange={() => toggleRole(r.id, !has)} />
                  <span>{escapeHtml(r.name)}</span>
                  <span className="muted" style={{ fontSize: "0.8rem" }}>{r.isCustom ? "(custom)" : ""}</span>
                </label>
              );
            })}
          </div>

          <div className="panel" style={{ marginBottom: "1rem", maxWidth: 700 }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Direct Permissions</h3>
            <p className="muted" style={{ fontSize: "0.8rem", marginBottom: "0.5rem" }}>
              Green = directly granted. Gray = inherited from roles. Toggle any permission to grant or revoke it directly for this user.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", maxHeight: 350, overflowY: "auto", padding: "0.25rem 0" }}>
              {Object.entries(allPermissions).sort(([a], [b]) => a.localeCompare(b)).map(([key, label]) => {
                const isDirect = userDirectPerms.includes(key);
                const isInherited = !isDirect && userEffectivePerms.includes(key);
                return (
                  <label
                    key={key}
                    onClick={() => toggleDirectPerm(key)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "0.25rem", cursor: "pointer",
                      fontSize: "0.78rem", padding: "0.2rem 0.5rem", borderRadius: 6, userSelect: "none",
                      background: isDirect ? "var(--primary)" : isInherited ? "var(--border)" : "var(--bg)",
                      color: isDirect ? "var(--surface)" : isInherited ? "var(--text-secondary)" : "var(--text)",
                      border: isDirect ? "1px solid var(--primary)" : isInherited ? "1px solid transparent" : "1px solid var(--border)",
                      opacity: isInherited ? 0.8 : 1,
                    }}
                  >
                    {key}
                    <span style={{ fontSize: "0.65rem", opacity: 0.7, marginLeft: "0.15rem" }}>
                      {isDirect ? "✓" : isInherited ? "↳" : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <RippleButton onClick={saveAll} loading={saving}>Save changes</RippleButton>
        </>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Username</th><th>Email</th><th>Role</th><th></th></tr></thead>
            <tbody>
              {staff.map((s: any) => (
                <tr key={s.id} style={{ cursor: "pointer" }} tabIndex={0} onClick={() => selectUser(s)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectUser(s); } }}>
                  <td>{escapeHtml(s.username)}</td>
                  <td>{s.email ? escapeHtml(s.email) : <span className="muted">—</span>}</td>
                  <td><span className="plan-status">{s.role}</span></td>
                  <td><RippleButton size="small" variant="danger" onClick={(e) => { e.stopPropagation(); deleteStaff(s.id); }}>Remove</RippleButton></td>
                </tr>
              ))}
              {staff.length === 0 && <tr><td colSpan={4}><EmptyState icon="default" title="No users yet" description="Create your first staff user to get started." /></td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function AdminRoles() {
  const { toast } = useToast();
  const { data: rolesData, loading, error, refetch } = useFetch(() => api<{ roles: any[] }>("/api/roles"), []);
  const { data: permsData } = useFetch(() => api<{ permissions: Record<string, string> }>("/api/permissions"), []);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [newRole, setNewRole] = useState(false);
  const [roleForm, setRoleForm] = useState({ id: "", name: "", description: "", permissions: [] as string[], features: [] as string[] });
  const [saving, setSaving] = useState(false);

  const permissions = permsData?.permissions || {};
  const allRoles = rolesData?.roles || [];

  function openNew() { setNewRole(true); setEditingRole(null); setRoleForm({ id: "", name: "", description: "", permissions: [], features: [] }); }

  function openEdit(role: any) {
    setNewRole(false); setEditingRole(role);
    setRoleForm({ id: role.id, name: role.name, description: role.description || "", permissions: role.permissions || [], features: role.features || [] });
  }

  function togglePerm(perm: string) {
    setRoleForm((p) => ({ ...p, permissions: p.permissions.includes(perm) ? p.permissions.filter((x) => x !== perm) : [...p.permissions, perm] }));
  }

  async function saveRole(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { name: roleForm.name, description: roleForm.description, permissions: roleForm.permissions, features: roleForm.features };
      if (newRole) {
        await api("/api/roles", { method: "POST", body: JSON.stringify({ roleId: roleForm.id || roleForm.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), ...body }) });
      } else {
        await api(`/api/roles/${editingRole.id}`, { method: "PUT", body: JSON.stringify(body) });
      }
      setNewRole(false); setEditingRole(null); refetch(); toast("success", "Saved successfully");
    } catch (err: any) { toast("error", err.message); } finally { setSaving(false); }
  }

  async function deleteRole(id: string) {
    if (!(await confirmDialog({ message: `Delete this role? This only affects this store — other clients are unaffected. Users assigned to it will lose its permissions.`, confirmLabel: "Delete", danger: true }))) return;
    try { await api(`/api/roles/${id}`, { method: "DELETE" }); refetch(); toast("success", "Deleted successfully"); } catch (err: any) { toast("error", err.message); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  if (newRole || editingRole) {
    return (
      <div style={{ maxWidth: 600 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <RippleButton size="small" variant="ghost" onClick={() => { setNewRole(false); setEditingRole(null); }}>&larr; Back</RippleButton>
          <h2 style={{ margin: 0 }}>{newRole ? "New Role" : "Edit: " + escapeHtml(editingRole.name)}</h2>
        </div>
        <div className="panel">
          <form onSubmit={saveRole}>
            {newRole && <div className="field"><label>Role ID (slug)<input value={roleForm.id} onChange={(e) => setRoleForm({ ...roleForm, id: e.target.value })} placeholder="e.g. supervisor" required /></label></div>}
            <div className="field"><label>Name<input value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} required /></label></div>
            <div className="field"><label>Description<input value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} /></label></div>
            <div className="field">
              <label>Permissions</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", maxHeight: 300, overflowY: "auto", padding: "0.5rem 0" }}>
                {Object.entries(permissions).map(([key, label]) => (
                  <label key={key} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", cursor: "pointer", padding: "0.2rem 0.5rem", borderRadius: 6, background: roleForm.permissions.includes(key) ? "var(--primary)" : "var(--bg)", color: roleForm.permissions.includes(key) ? "var(--surface)" : "var(--text)" }}>
                    <input type="checkbox" checked={roleForm.permissions.includes(key)} onChange={() => togglePerm(key)} style={{ display: "none" }} />
                    <span title={label}>{key}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Features</label>
              <p className="muted" style={{ fontSize: "0.8rem", margin: "0 0 0.5rem" }}>Leave empty to inherit all plan features. Selecting features limits this role to those — a user's final set is plan features intersected with this selection.</p>
              <FeaturePicker selected={roleForm.features} onChange={(features) => setRoleForm((p) => ({ ...p, features }))} />
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <RippleButton type="submit" loading={saving}>Save</RippleButton>
              <RippleButton variant="secondary" onClick={() => { setNewRole(false); setEditingRole(null); }}>Cancel</RippleButton>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Role Definitions</h2>
        <RippleButton size="small" onClick={openNew}>+ New role</RippleButton>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
        {allRoles.map((r: any) => (
          <div key={r.id} className="panel" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>{escapeHtml(r.name)}</h3>
              <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
                <RippleButton size="small" variant="ghost" onClick={() => openEdit(r)}>Edit</RippleButton>
                {r.id !== "admin" && <RippleButton size="small" variant="danger" onClick={() => deleteRole(r.id)}>Delete</RippleButton>}
              </div>
            </div>
            {r.description && <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>{escapeHtml(r.description)}</p>}
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>{r.permissions.length} permission{r.permissions.length !== 1 ? "s" : ""} · {r.features && r.features.length > 0 ? `${r.features.length} feature${r.features.length !== 1 ? "s" : ""} restricted` : "All plan features"}</p>
            {r.permissions.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {r.permissions.slice(0, 10).map((p: string) => <span key={p} style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem", borderRadius: 4, background: "var(--primary-subtle)", color: "var(--primary)" }}>{p}</span>)}
                {r.permissions.length > 10 && <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>+{r.permissions.length - 10}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ===================== PLANS =====================
function AdminPlans() {
  const { data: pData, loading, error, refetch } = useFetch(() => api<{ plans: SubscriptionPlan[] }>("/api/admin/plans"), []);
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", price: 0, priceAnnual: 0, maxProducts: 10, syncToOthers: true, features: [] as string[] });
  const [customInput, setCustomInput] = useState("");
  const [saving, setSaving] = useState(false);

  function toId(v: string) { return v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  function parseFeatures(raw: any): string[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch {}
      return raw.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
    return [];
  }

  function openNew() {
    setEditing(null);
    setForm({ id: "", name: "", price: 0, priceAnnual: 0, maxProducts: 10, syncToOthers: true, features: [] });
    setShowForm(true);
  }

  function openEdit(plan: SubscriptionPlan) {
    setEditing(plan);
    setForm({ id: plan.id, name: plan.name, price: plan.price, priceAnnual: plan.priceAnnual || 0, maxProducts: plan.maxProducts, syncToOthers: plan.syncToOthers !== false, features: parseFeatures(plan.features) });
    setShowForm(true);
  }

  function toggleFeature(f: string) {
    setForm((prev) => ({
      ...prev,
      features: prev.features.includes(f) ? prev.features.filter((x) => x !== f) : [...prev.features, f],
    }));
  }

  function addCustom() {
    const v = customInput.trim();
    if (v && !form.features.includes(v)) { setForm({ ...form, features: [...form.features, v] }); }
    setCustomInput("");
  }

  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        id: form.id || toId(form.name),
        name: form.name,
        price: Number(form.price),
        priceAnnual: Number(form.priceAnnual) || null,
        maxProducts: Number(form.maxProducts),
        syncToOthers: form.syncToOthers,
        features: form.features,
      };
      if (editing) {
        await api(`/api/admin/plans/${encodeURIComponent(editing.id)}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await api("/api/admin/plans", { method: "POST", body: JSON.stringify(body) });
      }
      setShowForm(false);
      setEditing(null);
      refetch();
      toast("success", editing ? "Plan updated." : "Plan created.");
    } catch (err: any) { toast("error", err.message); }
    finally { setSaving(false); }
  }

  async function deletePlan(id: string) {
    if (!(await confirmDialog({ message: "Delete this plan?", confirmLabel: "Delete", danger: true }))) return;
    try { await api(`/api/admin/plans/${encodeURIComponent(id)}`, { method: "DELETE" }); refetch(); toast("success", "Plan deleted."); } catch { toast("error", "Delete failed"); }
  }

  async function toggleActive(id: string, current: boolean) {
    try { await api(`/api/admin/plans/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ isActive: !current }) }); refetch(); } catch { toast("error", "Failed to update"); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const plans = pData?.plans || [];

  if (showForm) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <RippleButton size="small" variant="ghost" onClick={() => { setShowForm(false); setEditing(null); }}>&larr; Back</RippleButton>
          <h1 style={{ margin: 0 }}>{editing ? "Edit: " + escapeHtml(editing.name) : "New Plan"}</h1>
        </div>
        <div className="panel" style={{ maxWidth: 600 }}>
          <form onSubmit={savePlan}>
            <div className="form-grid" style={{ gap: "var(--space-4) var(--space-5)" }}>
              <div className="field"><label>Plan ID (slug)<input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder={toId(form.name) || "e.g. premium"} /></label></div>
              <div className="field"><label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label></div>
              <div className="field"><label>Monthly price (KES)<input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required /></label></div>
              <div className="field"><label>Annual price (KES)<input type="number" value={form.priceAnnual} onChange={(e) => setForm({ ...form, priceAnnual: Number(e.target.value) })} placeholder="0 = no annual" /></label></div>
              <div className="field"><label>Max products<input type="number" value={form.maxProducts} onChange={(e) => setForm({ ...form, maxProducts: Number(e.target.value) })} required /></label></div>
              <div className="field" style={{ display: "flex", alignItems: "end" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.syncToOthers} onChange={(e) => setForm({ ...form, syncToOthers: e.target.checked })} />
                  Sync to other clients
                </label>
              </div>
            </div>
            <div className="field">
              <label>Features</label>
              <div style={{ marginBottom: "0.5rem" }}>
                <FeaturePicker selected={form.features} onChange={(features) => setForm({ ...form, features })} />
              </div>
              <div style={{ display: "flex", gap: "0.35rem" }}>
                <input value={customInput} onChange={(e) => setCustomInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} placeholder="Custom feature..." style={{ flex: 1 }} />
                <RippleButton size="small" onClick={addCustom}>Add</RippleButton>
              </div>
              {form.features.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.5rem" }}>
                  {form.features.map((f) => (
                    <span key={f} role="button" tabIndex={0} onClick={() => toggleFeature(f)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleFeature(f); } }} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", padding: "0.35rem 0.65rem", borderRadius: 999, background: "var(--border)", color: "var(--text)", cursor: "pointer" }}>
                      {f} &times;
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <RippleButton type="submit" loading={saving}>Save</RippleButton>
              <RippleButton variant="secondary" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</RippleButton>
            </div>
          </form>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Subscription Plans</h1>
        <RippleButton size="small" onClick={openNew}>+ Add plan</RippleButton>
      </div>
      <div className="product-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {plans.map((p) => {
          const features = parseFeatures(p.features);
          return (
            <div key={p.id} className="panel" style={{ position: "relative", display: "flex", flexDirection: "column", opacity: p.isActive === false ? 0.6 : 1 }}>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.25rem", marginBottom: "0.5rem" }}>
                <RippleButton size="small" onClick={() => toggleActive(p.id, p.isActive !== false)}>{p.isActive === false ? "Activate" : "Deactivate"}</RippleButton>
                <RippleButton size="small" onClick={() => openEdit(p)}>Edit</RippleButton>
                {!["starter", "basic", "pro", "enterprise"].includes(p.id) && (
                  <RippleButton size="small" variant="danger" onClick={() => deletePlan(p.id)}>Delete</RippleButton>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                <h3 style={{ marginTop: 0 }}>{escapeHtml(p.name)}</h3>
                <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: 4, background: p.isActive === false ? "var(--border)" : "var(--success)", color: p.isActive === false ? "var(--text-secondary)" : "var(--surface)", fontWeight: 600 }}>{p.isActive === false ? "Inactive" : "Active"}</span>
              </div>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--primary)", margin: "0 0 0.25rem" }}>{formatPrice(p.price)}<span style={{ fontSize: "0.8rem", fontWeight: 400, opacity: 0.6 }}>/mo</span></p>
              {p.priceAnnual != null && p.priceAnnual > 0 && <p style={{ fontSize: "0.9rem", color: "var(--primary)", margin: "0 0 0.25rem" }}>{formatPrice(p.priceAnnual)}<span style={{ fontSize: "0.8rem", fontWeight: 400, opacity: 0.6 }}>/yr</span></p>}
              <p className="muted" style={{ margin: "0 0 0.5rem" }}>Up to {p.maxProducts} products</p>
              {features.length > 0 && (
                <ul className="features-list" style={{ margin: 0, flex: 1 }}>{features.map((f, i) => <li key={i} style={{ fontSize: "0.85rem" }}>{f}</li>)}</ul>
              )}
            </div>
          );
        })}
        {plans.length === 0 && <div style={{ gridColumn: "1/-1" }}><EmptyState icon="plans" title="No plans yet" description="Create your first subscription plan." actionLabel="+ Add Plan" onAction={openNew} /></div>}
      </div>
    </>
  );
}

// ===================== PROVIDERS =====================
const AdminProviders = ProvidersPage;

// ===================== BRANCHES =====================
function AdminClients() {
  const { data: cData, loading, error, refetch } = useFetch(() => api<{ clients: Client[] }>("/api/admin/clients"), []);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);

  // Branch management for selected client
  const { data: brData, loading: brLoading, refetch: refetchBranches } = useFetch(
    () => selectedClient ? api<{ branches: Branch[] }>(`/api/admin/clients/${selectedClient.id}/branches`) : Promise.resolve(null as any),
    [selectedClient?.id]
  );
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState({ name: "", address: "", phone: "", email: "" });
  const [savingBranch, setSavingBranch] = useState(false);

  const clients = cData?.clients || [];
  const branches: Branch[] = brData?.branches || [];

  function openNew() {
    setForm({ name: "", email: "", phone: "", address: "" });
    setShowNewForm(true);
  }

  function openEdit(c: Client) {
    setForm({ name: c.name, email: c.email, phone: c.phone, address: c.address });
    setSelectedClient(c);
    setShowEditForm(true);
  }

  async function saveClient(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (showEditForm && selectedClient) {
        await api(`/api/admin/clients/${selectedClient.id}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await api("/api/admin/clients", { method: "POST", body: JSON.stringify(form) });
      }
      setShowNewForm(false);
      setShowEditForm(false);
      refetch();
      toast("success", showEditForm ? "Client updated." : "Client created.");
    } catch (err: any) { toast("error", err.message); }
    finally { setSaving(false); }
  }

  async function toggleClient(c: Client) {
    try {
      await api(`/api/admin/clients/${c.id}`, { method: "PUT", body: JSON.stringify({ isActive: !c.isActive }) });
      refetch();
    } catch (err: any) { toast("error", err.message); }
  }

  async function deleteClient(id: number) {
    if (!(await confirmDialog({ message: "Delete this client and all their data? This cannot be undone.", confirmLabel: "Delete", danger: true }))) return;
    try { await api(`/api/admin/clients/${id}`, { method: "DELETE" }); refetch(); toast("success", "Client deleted."); } catch (err: any) { toast("error", err.message); }
  }

  // Branch operations
  function openNewBranch() {
    setEditingBranch(null);
    setBranchForm({ name: "", address: "", phone: "", email: "" });
    setShowBranchForm(true);
  }

  function openEditBranch(b: Branch) {
    setEditingBranch(b);
    setBranchForm({ name: b.name, address: b.address, phone: b.phone, email: b.email });
    setShowBranchForm(true);
  }

  async function saveBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClient) return;
    setSavingBranch(true);
    try {
      const body = { name: branchForm.name.trim(), address: branchForm.address.trim(), phone: branchForm.phone.trim(), email: branchForm.email.trim() };
      if (editingBranch) {
        await api(`/api/admin/clients/${selectedClient.id}/branches/${editingBranch.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await api(`/api/admin/clients/${selectedClient.id}/branches`, { method: "POST", body: JSON.stringify(body) });
      }
      setShowBranchForm(false);
      setEditingBranch(null);
      refetchBranches();
      toast("success", editingBranch ? "Branch updated." : "Branch added.");
    } catch (err: any) { toast("error", err.message); }
    finally { setSavingBranch(false); }
  }

  async function deleteBranch(branchId: number) {
    if (!selectedClient || !(await confirmDialog({ message: "Delete this branch?", confirmLabel: "Delete", danger: true }))) return;
    try { await api(`/api/admin/clients/${selectedClient.id}/branches/${branchId}`, { method: "DELETE" }); refetchBranches(); toast("success", "Branch deleted."); } catch (err: any) { toast("error", err.message); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  // Client form (create/edit)
  if (showNewForm || showEditForm) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <RippleButton size="small" variant="ghost" onClick={() => { setShowNewForm(false); setShowEditForm(false); setSelectedClient(null); }}>&larr; Back</RippleButton>
          <h1 style={{ margin: 0 }}>{showEditForm ? "Edit Client" : "New Client"}</h1>
        </div>
        <div className="panel" style={{ maxWidth: 500 }}>
          <form onSubmit={saveClient}>
            <div className="field"><label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label></div>
            <div className="field"><label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label></div>
            <div className="field"><label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label></div>
            <div className="field"><label>Address<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label></div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <RippleButton type="submit" loading={saving}>{showEditForm ? "Update" : "Create"}</RippleButton>
              <RippleButton variant="secondary" onClick={() => { setShowNewForm(false); setShowEditForm(false); setSelectedClient(null); }}>Cancel</RippleButton>
            </div>
          </form>
        </div>
      </>
    );
  }

  // Client detail view (with branches)
  if (selectedClient && !showEditForm) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <RippleButton size="small" variant="ghost" onClick={() => { setSelectedClient(null); }}>&larr; Back</RippleButton>
          <h1 style={{ margin: 0 }}>{escapeHtml(selectedClient.name)}</h1>
        </div>
        <div className="panel" style={{ maxWidth: 500, marginBottom: "1.5rem" }}>
          <p><strong>Email:</strong> {escapeHtml(selectedClient.email || "—")}</p>
          <p><strong>Phone:</strong> {escapeHtml(selectedClient.phone || "—")}</p>
          <p><strong>Address:</strong> {escapeHtml(selectedClient.address || "—")}</p>
          <p><strong>Status:</strong> <span style={{ color: selectedClient.isActive ? "var(--success)" : "var(--danger)" }}>{selectedClient.isActive ? "Active" : "Inactive"}</span></p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Branches</h2>
          <RippleButton size="small" onClick={openNewBranch}>+ Add Branch</RippleButton>
        </div>

        {showBranchForm && (
          <div className="panel" style={{ maxWidth: 500, marginBottom: "1rem" }}>
            <form onSubmit={saveBranch}>
              <div className="field"><label>Name<input value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} required /></label></div>
              <div className="field"><label>Address<input value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} /></label></div>
              <div className="form-grid" style={{ gap: "var(--space-4) var(--space-5)" }}>
                <div className="field"><label>Phone<input value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} /></label></div>
                <div className="field"><label>Email<input type="email" value={branchForm.email} onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })} /></label></div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <RippleButton type="submit" loading={savingBranch}>{editingBranch ? "Update" : "Create"}</RippleButton>
                <RippleButton variant="secondary" onClick={() => { setShowBranchForm(false); setEditingBranch(null); }}>Cancel</RippleButton>
              </div>
            </form>
          </div>
        )}

        {brLoading ? <Spinner /> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Address</th><th>Phone</th><th>Email</th><th>Actions</th></tr></thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id}>
                    <td><strong>{escapeHtml(b.name)}</strong></td>
                    <td>{escapeHtml(b.address || "—")}</td>
                    <td>{escapeHtml(b.phone || "—")}</td>
                    <td>{escapeHtml(b.email || "—")}</td>
                    <td>
                      <div style={{ display: "flex", gap: "0.25rem" }}>
                        <RippleButton size="small" onClick={() => openEditBranch(b)}>Edit</RippleButton>
                        <RippleButton size="small" variant="danger" onClick={() => deleteBranch(b.id)}>Delete</RippleButton>
                      </div>
                    </td>
                  </tr>
                ))}
                {branches.length === 0 && <tr><td colSpan={5}><EmptyState icon="default" title="No branches yet" description="Add a branch to this client to start managing their locations." actionLabel="+ Add Branch" onAction={openNewBranch} /></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  // Client list view
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Clients</h1>
        <RippleButton size="small" onClick={openNew}>+ Add Client</RippleButton>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td><strong>{escapeHtml(c.name)}</strong></td>
                <td>{escapeHtml(c.email || "—")}</td>
                <td>{escapeHtml(c.phone || "—")}</td>
                <td><span style={{ color: c.isActive ? "var(--success)" : "var(--danger)", fontSize: "0.85rem" }}>{c.isActive ? "Active" : "Inactive"}</span></td>
                <td>
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    <RippleButton size="small" onClick={() => setSelectedClient(c)}>Manage</RippleButton>
                    <RippleButton size="small" variant="ghost" onClick={() => openEdit(c)}>Edit</RippleButton>
                    <RippleButton size="small" variant="ghost" onClick={() => toggleClient(c)}>{c.isActive ? "Deactivate" : "Activate"}</RippleButton>
                    <RippleButton size="small" variant="danger" onClick={() => deleteClient(c.id)}>Delete</RippleButton>
                  </div>
                </td>
              </tr>
            ))}
            {clients.length === 0 && <tr><td colSpan={5}><EmptyState icon="default" title="No clients yet" description="Create your first client to start managing multiple tenants." actionLabel="+ Add Client" onAction={openNew} /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ===================== BRANCHES =====================
function AdminBranches() {
  const { toast } = useToast();
  const { data: bData, loading, error, refetch } = useFetch(() => api<{ branches: Branch[] }>("/api/admin/branches"), []);
  const { data: sData } = useFetch(() => api<{ staff: { id: number; username: string; role: string }[] }>("/api/staff"), []);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "", managerId: "" });
  const [saving, setSaving] = useState(false);
  const [branchPlanEditId, setBranchPlanEditId] = useState<number | null>(null);
  const [allPlans, setAllPlans] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/plans/all").then(r => r.json()).then(setAllPlans).catch((e) => console.warn("[admin] Failed to load all plans:", e?.message));
  }, []);

  const owners = sData?.staff?.filter((u) => u.role === "owner") || [];

  function openNew() {
    setEditing(null);
    setForm({ name: "", address: "", phone: "", email: "", managerId: "" });
    setShowForm(true);
  }

  function openEdit(b: Branch) {
    setEditing(b);
    setForm({ name: b.name, address: b.address, phone: b.phone, email: b.email, managerId: b.managerId ? String(b.managerId) : "" });
    setShowForm(true);
  }

  async function saveBranch(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        managerId: form.managerId ? Number(form.managerId) : null,
      };
      if (editing) {
        await api(`/api/admin/branches/${editing.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await api("/api/admin/branches", { method: "POST", body: JSON.stringify(body) });
      }
      setShowForm(false);
      setEditing(null);
      refetch();
      toast("success", editing ? "Branch updated." : "Branch created.");
    } catch (err: any) { toast("error", err.message); }
    finally { setSaving(false); }
  }

  async function toggleBranch(b: Branch) {
    try {
      await api(`/api/admin/branches/${b.id}`, { method: "PUT", body: JSON.stringify({ isActive: !b.isActive }) });
      refetch();
    } catch (err: any) { toast("error", err.message); }
  }

  async function deleteBranch(id: number) {
    if (!(await confirmDialog({ message: "Delete this branch?", confirmLabel: "Delete", danger: true }))) return;
    if (!(await stepUpForHighRiskAction("delete this branch"))) return;
    try { await api(`/api/admin/branches/${id}`, { method: "DELETE" }); refetch(); toast("success", "Branch deleted."); } catch (err: any) { toast("error", err.message); }
  }

  async function changeBranchPlan(branchId: number, planId: string) {
    try {
      await api(`/api/admin/branches/${branchId}/plan`, { method: "PUT", body: JSON.stringify({ planId: planId || null }) });
      setBranchPlanEditId(null);
      refetch();
      toast("success", "Plan updated successfully");
    } catch (err: any) { toast("error", err.message); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const branches = bData?.branches || [];

  if (showForm) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <RippleButton size="small" variant="ghost" onClick={() => { setShowForm(false); setEditing(null); }}>&larr; Back</RippleButton>
          <h1 style={{ margin: 0 }}>{editing ? "Edit: " + escapeHtml(editing.name) : "New Branch"}</h1>
        </div>
        <div className="panel" style={{ maxWidth: 500 }}>
          <form onSubmit={saveBranch}>
            <div className="field"><label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label></div>
            <div className="field"><label>Address<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label></div>
            <div className="form-grid" style={{ gap: "var(--space-4) var(--space-5)" }}>
              <div className="field"><label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label></div>
              <div className="field"><label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label></div>
            </div>
            <div className="field">
              <label>Assigned Owner
                <select value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
                  <option value="">— No owner assigned —</option>
                  {owners.map((o) => <option key={o.id} value={o.id}>{escapeHtml(o.username)}</option>)}
                </select>
              </label>
              {owners.length === 0 && <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>No owner users found. Create an owner user in Users first.</p>}
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <RippleButton type="submit" loading={saving}>{editing ? "Update" : "Create"}</RippleButton>
              <RippleButton variant="secondary" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</RippleButton>
            </div>
          </form>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Branches</h1>
        <RippleButton size="small" onClick={openNew}>+ Add Branch</RippleButton>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Address</th><th>Phone</th><th>Email</th><th>Owner</th><th>Plan</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {branches.map((b) => {
              const currentPlan = allPlans.find((p: any) => p.id === b.planId);
              return (
                <tr key={b.id}>
                  <td><strong>{escapeHtml(b.name)}</strong></td>
                  <td>{escapeHtml(b.address || "—")}</td>
                  <td>{escapeHtml(b.phone || "—")}</td>
                  <td>{escapeHtml(b.email || "—")}</td>
                  <td>{b.managerName ? escapeHtml(b.managerName) : <span className="muted">Unassigned</span>}</td>
                  <td>
                    {branchPlanEditId === b.id ? (
                      <select
                        value={b.planId || ""}
                        onChange={(e) => changeBranchPlan(b.id, e.target.value)}
                        onBlur={() => setBranchPlanEditId(null)}
                        autoFocus
                        style={{ fontSize: "0.8rem", padding: "2px 4px" }}
                      >
                        <option value="">None</option>
                        {allPlans.map((p: any) => <option key={p.id} value={p.id}>{escapeHtml(p.name)}</option>)}
                      </select>
                    ) : (
                      <span
                        onClick={() => setBranchPlanEditId(b.id)}
                        style={{ cursor: "pointer", color: currentPlan ? "var(--primary)" : "var(--text-secondary)", fontSize: "0.85rem", textDecoration: "underline dotted" }}
                      >
                        {currentPlan ? escapeHtml(currentPlan.name) : "No plan"}
                      </span>
                    )}
                  </td>
                  <td><span className={`plan-status ${b.isActive ? "active" : ""}`} style={{ background: b.isActive ? "var(--success)" : "var(--danger)", color: "var(--surface)", padding: "2px 8px", borderRadius: 4, fontSize: "0.8rem" }}>{b.isActive ? "Active" : "Inactive"}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      <RippleButton size="small" onClick={() => openEdit(b)}>Edit</RippleButton>
                      <RippleButton size="small" variant="ghost" onClick={() => toggleBranch(b)}>{b.isActive ? "Deactivate" : "Activate"}</RippleButton>
                      <RippleButton size="small" variant="danger" onClick={() => deleteBranch(b.id)}>Delete</RippleButton>
                    </div>
                  </td>
                </tr>
              );
            })}
            {branches.length === 0 && <tr><td colSpan={8}><EmptyState icon="default" title="No branches yet" description="Create your first branch to start managing multi-location operations." actionLabel="+ Add Branch" onAction={openNew} /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ===================== INVOICES =====================
function SubscriptionInvoices() {
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const { data: iData, loading, error, refetch } = useFetch(() => {
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterSearch) params.set("search", filterSearch);
    if (filterDateFrom) params.set("dateFrom", filterDateFrom);
    if (filterDateTo) params.set("dateTo", filterDateTo);
    const qs = params.toString();
    return api<{ invoices: any[]; stats?: any; revenue?: any }>(`/api/admin/invoices${qs ? "?" + qs : ""}`);
  }, [filterStatus, filterSearch, filterDateFrom, filterDateTo]);

  async function markPaid(id: number) {
    try { await api(`/api/admin/invoices/${id}/pay`, { method: "POST" }); refetch(); toast("success", "Invoice marked as paid."); } catch { toast("error", "Failed to mark invoice as paid"); }
  }

  async function generateInvoice() {
    try { await api("/api/admin/invoices/generate", { method: "POST" }); refetch(); toast("success", "Invoice generated."); } catch { toast("error", "Invoice generation failed"); }
  }

  async function viewInvoice(id: number) {
    try {
      const token = getStaffToken();
      const res = await fetch(`/api/admin/invoices/${id}/view`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e: any) { toast("error", "Failed to open invoice: " + (e?.message || "Unknown")); }
  }

  async function downloadInvoicePdf(id: number) {
    try {
      const token = getStaffToken();
      const res = await fetch(`/api/admin/invoices/${id}/view?format=pdf`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `invoice-${id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast("error", "Failed to download invoice: " + (e?.message || "Unknown")); }
  }

  async function emailInvoice(id: number) {
    try {
      const data = await api<{ sent: boolean }>(`/api/admin/invoices/${id}/email`, { method: "POST" });
      toast(data.sent ? "success" : "error", data.sent ? "Invoice emailed successfully." : "Failed to send email. Check SMTP settings.");
    } catch (e: any) { toast("error", "Failed to send invoice email: " + (e?.message || "Unknown")); }
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterDateFrom) params.set("dateFrom", filterDateFrom);
    if (filterDateTo) params.set("dateTo", filterDateTo);
    const qs = params.toString();
    window.open(`/api/admin/invoices/export${qs ? "?" + qs : ""}`, "_blank");
  }

  const stats = iData?.stats;
  const invoices = iData?.invoices || [];

  return (
    <>
      {stats && (
        <div className="stat-grid" style={{ marginBottom: "1rem" }}>
          <div className="stat-card"><div className="stat-card__value">{stats.total}</div><div className="stat-card__label">Total Invoices</div></div>
          <div className="stat-card"><div className="stat-card__value" style={{ color: "var(--success)" }}>{stats.paid}</div><div className="stat-card__label">Paid</div></div>
          <div className="stat-card"><div className="stat-card__value" style={{ color: "var(--accent)" }}>{stats.pending}</div><div className="stat-card__label">Pending</div></div>
          <div className="stat-card"><div className="stat-card__value" style={{ color: "var(--danger)" }}>{stats.overdue}</div><div className="stat-card__label">Overdue</div></div>
        </div>
      )}

      <div className="panel" style={{ marginBottom: "1rem", padding: "0.75rem 1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <input type="text" placeholder="Search invoice #..." value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} style={{ padding: "0.4rem 0.75rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.85rem", minWidth: 160 }} />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "0.4rem 0.75rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.85rem" }}>
            <option value="">All Status</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="overdue">Overdue</option>
          </select>
          <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} style={{ padding: "0.4rem 0.75rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.85rem" }} />
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>to</span>
          <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} style={{ padding: "0.4rem 0.75rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.85rem" }} />
          <RippleButton size="small" variant="ghost" onClick={exportCsv}>Export CSV</RippleButton>
          <RippleButton size="small" onClick={generateInvoice}>+ Generate</RippleButton>
        </div>
      </div>

      {(() => {
        if (loading) return <Spinner />;
        if (error) return <ErrorMsg msg={error} />;
        return (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Invoice #</th><th>Provider</th><th>Plan</th><th>Amount</th><th>Due Date</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id}>
                    <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{escapeHtml(inv.invoiceNumber || `INV-${inv.id}`)}</td>
                    <td>{escapeHtml(inv.providerName || "Provider #" + inv.providerId)}</td>
                    <td>{escapeHtml(inv.planName || inv.planId)}</td>
                    <td>{formatPrice(inv.amount)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-GB") : "—"}</td>
                    <td><span className="plan-status" style={{ background: inv.status === "paid" ? "var(--success-light)" : inv.status === "overdue" ? "var(--danger-light)" : "var(--warning-light)", color: inv.status === "paid" ? "var(--success-text)" : inv.status === "overdue" ? "var(--danger-text)" : "var(--warning-text)" }}>{inv.status}</span></td>
                    <td style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                      {inv.status !== "paid" && <RippleButton size="small" style={{ background: "var(--success)", color: "var(--surface)" }} onClick={() => markPaid(inv.id)}>Pay</RippleButton>}
                      <button className="btn btn-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", padding: "0.2rem 0.5rem", borderRadius: 4, fontSize: "0.8rem" }} onClick={() => viewInvoice(inv.id)}>View</button>
                      <button className="btn btn-sm" style={{ background: "var(--danger)", color: "var(--surface)", cursor: "pointer", padding: "0.2rem 0.5rem", borderRadius: 4, fontSize: "0.8rem" }} onClick={() => downloadInvoicePdf(inv.id)}>PDF</button>
                      <button className="btn btn-sm" style={{ background: "var(--primary)", color: "var(--surface)", cursor: "pointer", padding: "0.2rem 0.5rem", borderRadius: 4, fontSize: "0.8rem" }} onClick={() => emailInvoice(inv.id)}>Email</button>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && <tr><td colSpan={7}><EmptyState icon="invoices" title="No invoices" description="Generate an invoice or adjust your filters." /></td></tr>}
              </tbody>
            </table>
          </div>
        );
      })()}
    </>
  );
}

function AdminInvoices() {
  const { data: oiData, loading: oiLoading, error: oiError, refetch: refetchOi } = useFetch(() => api<{ invoices: any[] }>("/api/admin/order-invoices"), []);
  const [oiStatusMsg, setOiStatusMsg] = useState("");
  const [creditedOrders, setCreditedOrders] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!oiData?.invoices?.length) return;
    const ids = [...new Set(oiData.invoices.map((inv: any) => inv.orderId))].join(",");
    if (!ids) return;
    api<{ credited: Record<number, boolean> }>(`/api/admin/credit-notes/order-status?orderIds=${ids}`).then((d) => setCreditedOrders(d.credited || {})).catch((e) => console.warn("[admin] Failed to load credit status:", e?.message));
  }, [oiData]);

  async function markOiPaid(id: number) {
    try { await api(`/api/admin/order-invoices/${id}/pay`, { method: "POST" }); setOiStatusMsg("Invoice marked as paid."); refetchOi(); toast("success", "Invoice marked as paid."); } catch { toast("error", "Failed to mark invoice as paid"); }
  }

  async function createCreditNote(orderId: number) {
    const reason = await promptDialog({ title: "Create credit note", message: "Reason (optional):", confirmLabel: "Create" });
    if (reason === null) return;
    try {
      const created = await api<any>("/api/admin/credit-notes", {
        method: "POST",
        body: JSON.stringify({ orderId, reason: reason.trim() }),
      });
      setCreditedOrders((prev) => ({ ...prev, [orderId]: true }));
      await downloadPdf(`/api/admin/credit-notes/${created.id}/view`, `credit-note-${created.id}.pdf`);
      toast("success", "Credit note created and downloaded.");
    } catch (err: any) {
      toast("error", err.message || "Failed to create credit note.");
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Invoices</h1>
      </div>
      <p className="muted" style={{ margin: "0 0 1rem" }}>Order invoices appear automatically when an order is shipped or delivered. Subscription invoices live on the Shop Subscription page.</p>

      {oiStatusMsg && <p style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 1rem", marginBottom: "0.75rem" }}>{oiStatusMsg}</p>}
      {(() => {
        if (oiLoading) return <Spinner />;
        if (oiError) return <ErrorMsg msg={oiError} />;
        const oinvoices = oiData?.invoices || [];
        return (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>#</th><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {oinvoices.map((inv: any) => (
                  <tr key={inv.id}>
                    <td>{inv.id}</td>
                    <td>#{inv.orderId}</td>
                    <td>{escapeHtml(inv.customer_name || "—")}</td>
                    <td>{formatPrice(inv.amount)}</td>
                    <td><span className="plan-status" style={{ background: inv.status === "paid" ? "var(--success-light)" : "var(--warning-light)", color: inv.status === "paid" ? "var(--success-text)" : "var(--warning-text)" }}>{inv.status}</span></td>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(inv.createdAt || inv.created_at).toLocaleDateString("en-GB")}</td>
                    <td>
                      {inv.status !== "paid" && <button className="btn btn-sm" style={{ background: "var(--success)", color: "var(--surface)" }} onClick={() => markOiPaid(inv.id)}>Mark paid</button>}
                      <button className="btn btn-sm btn-ghost" style={{ marginLeft: "0.25rem" }} onClick={async () => { try { const r = await api<{ token: string }>("/api/admin/invoice-token/" + inv.orderId, { method: "POST" }); const res = await fetch(`/api/admin/orders/${inv.orderId}/invoice?allowQueryToken=1&token=${encodeURIComponent(r.token)}`, { headers: { Authorization: `Bearer ${r.token}` } }); if (!res.ok) throw new Error(`HTTP ${res.status}`); const html = await res.text(); const blob = new Blob([html], { type: "text/html" }); const url = URL.createObjectURL(blob); window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 30000); } catch (e: any) { toast("error", "Failed to open invoice: " + (e?.message || "Unknown error")); } }}>View</button>
                      {creditedOrders[inv.orderId] ? (
                        <span className="btn btn-sm" style={{ marginLeft: "0.25rem", background: "var(--success-light)", color: "var(--success-text)", cursor: "default" }}>Credited</span>
                      ) : (
                        <button className="btn btn-sm" style={{ marginLeft: "0.25rem", background: "var(--primary)", color: "var(--surface)" }} onClick={() => createCreditNote(inv.orderId)}>Credit Note</button>
                      )}
                    </td>
                  </tr>
                ))}
                {oinvoices.length === 0 && <tr><td colSpan={7}><EmptyState icon="invoices" title="No order invoices" description="Order invoices appear automatically when an order is shipped or delivered." /></td></tr>}
              </tbody>
            </table>
          </div>
        );
      })()}
    </>
  );
}

// ===================== CREDIT NOTES =====================
const AdminCreditNotes = CreditNotesPage;

// ===================== MESSAGES =====================
function AdminMessages() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeCustomerId, setComposeCustomerId] = useState<number | null>(null);
  const [composeProviderId, setComposeProviderId] = useState<number | null>(null);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") loadMessages();
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  async function loadMessages() {
    try {
      const d = await api<{ messages: any[] }>("/api/admin/messages");
      setMessages(d.messages || []);
    } catch { }
    setLoading(false);
  }

  async function loadProvidersAndCustomers() {
    try {
      const [pRes, cRes] = await Promise.all([
        api<{ providers: any[] }>("/api/admin/providers").catch(() => ({ providers: [] })),
        api<{ customers: any[] }>("/api/admin/customers").catch(() => ({ customers: [] })),
      ]);
      setProviders(pRes.providers || []);
      setCustomers(cRes.customers || []);
    } catch { }
  }

  function groupConversations() {
    const groups: Record<string, { partner: string; messages: any[]; lastAt: string; unread: number }> = {};
    for (const m of messages) {
      const key = m.sender_role === "customer" ? `customer:${m.customer_id}` : `provider:${m.provider_id}`;
      if (!groups[key]) {
        groups[key] = { partner: m.customerName || m.providerName || `#${key}`, messages: [], lastAt: m.created_at, unread: 0 };
      }
      groups[key].messages.push(m);
      if (m.created_at > groups[key].lastAt) groups[key].lastAt = m.created_at;
      if (m.sender_role !== "admin" && !m.read_at) groups[key].unread++;
    }
    return Object.entries(groups).sort((a, b) => b[1].lastAt.localeCompare(a[1].lastAt));
  }

  async function sendReply() {
    if (!replyBody.trim() || !selectedConversation) return;
    const msgs = messages.filter((m) => {
      const key = m.sender_role === "customer" ? `customer:${m.customer_id}` : `provider:${m.provider_id}`;
      return key === selectedConversation;
    });
    const lastMsg = msgs[msgs.length - 1];
    if (!lastMsg) return;
    setSending(true);
    try {
      await api("/api/admin/messages", { method: "POST", body: JSON.stringify({ customerId: lastMsg.customer_id, providerId: lastMsg.provider_id, body: replyBody.trim(), subject: lastMsg.subject }) });
      setReplyBody("");
      await loadMessages();
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      toast("success", "Reply sent.");
    } catch (e: any) { toast("error", "Failed to send: " + (e?.message || "Unknown error")); }
    setSending(false);
  }

  async function sendCompose() {
    if (!composeBody.trim() || !composeCustomerId || !composeProviderId) { toast("error", "Select customer, provider and enter a message."); return; }
    setSending(true);
    try {
      await api("/api/admin/messages", { method: "POST", body: JSON.stringify({ customerId: composeCustomerId, providerId: composeProviderId, body: composeBody.trim(), subject: composeSubject.trim() }) });
      setComposeOpen(false); setComposeBody(""); setComposeSubject(""); setComposeCustomerId(null); setComposeProviderId(null);
      await loadMessages();
      toast("success", "Message sent.");
    } catch (e: any) { toast("error", "Failed to send: " + (e?.message || "Unknown error")); }
    setSending(false);
  }

  async function markRead(conversationKey: string) {
    const msgs = messages.filter((m) => {
      const key = m.sender_role === "customer" ? `customer:${m.customer_id}` : `provider:${m.provider_id}`;
      return key === conversationKey && !m.read_at;
    });
    for (const m of msgs) {
      try { await api(`/api/admin/messages/${m.id}/read`, { method: "PATCH" }); } catch { }
    }
    loadMessages();
  }

  const convos = useMemo(() => groupConversations(), [messages]);
  const activeMsgs = selectedConversation ? messages.filter((m) => {
    const key = m.sender_role === "customer" ? `customer:${m.customer_id}` : `provider:${m.provider_id}`;
    return key === selectedConversation;
  }).sort((a, b) => a.created_at.localeCompare(b.created_at)) : [];

  if (loading) return <><h1>Messages</h1><Spinner /></>;

  return (
    <>
      <h1 className="anim-fade-in-down">Messages</h1>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
        <RippleButton size="small" onClick={() => { setComposeOpen(!composeOpen); if (!composeOpen) loadProvidersAndCustomers(); }}>{composeOpen ? "Close" : "New Message"}</RippleButton>
      </div>
      {composeOpen && (
        <div className="panel" style={{ marginBottom: "1rem", padding: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Compose Message</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Customer</label>
              <select value={composeCustomerId || ""} onChange={(e) => setComposeCustomerId(Number(e.target.value) || null)}>
                <option value="">Select customer...</option>
                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name || c.email}</option>)}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Provider</label>
              <select value={composeProviderId || ""} onChange={(e) => setComposeProviderId(Number(e.target.value) || null)}>
                <option value="">Select provider...</option>
                {providers.map((p: any) => <option key={p.id} value={p.id}>{p.company_name || p.contact_name}</option>)}
              </select>
            </div>
          </div>
          <div className="field" style={{ margin: 0, marginBottom: "0.75rem" }}>
            <label>Subject</label>
            <input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Optional subject" />
          </div>
          <div className="field" style={{ margin: 0, marginBottom: "0.75rem" }}>
            <label>Message</label>
            <textarea rows={3} value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder="Type your message..." />
          </div>
          <RippleButton size="small" onClick={sendCompose} loading={sending}>Send</RippleButton>
        </div>
      )}
      <div style={{ display: "flex", gap: "1rem", minHeight: "500px" }}>
        <div style={{ flex: "0 0 280px", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: "0.85rem" }}>Conversations</div>
          <div style={{ overflowY: "auto", maxHeight: "450px" }}>
            {convos.length === 0 && <p style={{ padding: "1rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>No messages yet.</p>}
            {convos.map(([key, conv]) => (
              <div key={key} role="button" tabIndex={0} onClick={() => { setSelectedConversation(key); markRead(key); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedConversation(key); markRead(key); } }}
                style={{ padding: "0.75rem", borderBottom: "1px solid var(--border)", cursor: "pointer", background: selectedConversation === key ? "var(--bg-secondary)" : "transparent", transition: "background 0.15s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "0.85rem" }}>{conv.partner}</strong>
                  {conv.unread > 0 && <span style={{ background: "var(--primary)", color: "var(--surface)", borderRadius: 999, fontSize: "0.7rem", padding: "0.1rem 0.5rem", fontWeight: 600 }}>{conv.unread}</span>}
                </div>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {conv.messages[conv.messages.length - 1]?.body}
                </p>
                <p style={{ margin: "0.15rem 0 0", fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                  {new Date(conv.lastAt).toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!selectedConversation ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "0.9rem" }}>Select a conversation</div>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {activeMsgs.map((m: any) => {
                  const isMe = m.sender_role === "admin";
                  return (
                    <div key={m.id} style={{ maxWidth: "75%", alignSelf: isMe ? "flex-end" : "flex-start", background: isMe ? "var(--primary)" : "var(--bg-secondary)", color: isMe ? "var(--surface)" : "var(--text)", borderRadius: 12, padding: "0.6rem 0.9rem", fontSize: "0.85rem" }}>
                      {!isMe && <div style={{ fontSize: "0.7rem", fontWeight: 600, marginBottom: "0.2rem", opacity: 0.7 }}>{m.sender_role === "customer" ? (m.customerName || "Customer") : (m.providerName || "Provider")}</div>}
                      <div>{m.body}</div>
                      <div style={{ fontSize: "0.65rem", opacity: 0.6, marginTop: "0.2rem", textAlign: isMe ? "right" : "left" }}>
                        {new Date(m.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        {isMe && m.read_at ? " ✓✓" : isMe ? " ✓" : ""}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <div style={{ borderTop: "1px solid var(--border)", padding: "0.75rem", display: "flex", gap: "0.5rem" }}>
                <input style={{ flex: 1 }} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }} placeholder="Type a reply..." />
                <RippleButton size="small" onClick={sendReply} loading={sending}>Send</RippleButton>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ===================== ABOUT US =====================
const AdminAboutUs = AboutUsPage;

// ===================== SETTINGS =====================
function AdminStorefront({ onOpenBuilder }: { onOpenBuilder?: () => void }) {
  const [cfg, setCfg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState("default");
  const [themeCustom, setThemeCustom] = useState<any>(null);
  const [catList, setCatList] = useState<{ id: string; label: string }[]>([]);
  const [bannerInputs, setBannerInputs] = useState<{ title: string; subtitle: string }[]>([]);
  const [heroForm, setHeroForm] = useState({
    heroActive: true,
    badgeActive: true,
    identityBandActive: true,
    badgeText: "Summer Tech Sale — Up to 30% Off",
    badgeLink: "",
    headline: "Power Your",
    headlineAccent: "Next Build",
    subtitle: "Discover premium gaming PCs, laptops, graphics cards, servers, and accessories at unbeatable prices. Kenya\u2019s trusted all-in-one tech platform.",
    headlineVariants: [] as { headline: string; accent: string; subtitle: string }[],
    showTrustStrip: true,
    showWhatsApp: true,
    countdownLabel: "Offer ends in",
    countdownEnd: "",
    shopNowLabel: "Shop Now",
    shopNowLink: "/pc",
    browseLabel: "Browse Categories",
    browseLink: "/#categories",
    heroBgLight: "",
    heroBgDark: "",
    catChips: [
      { label: "Gaming PCs", href: "/pc" },
      { label: "Graphics Cards", href: "/graphics-cards" },
      { label: "Laptops", href: "/laptops" },
      { label: "Servers", href: "/servers" },
      { label: "Repairs", href: "/repairs" },
    ],
    stats: [
      { value: "", label: "Products" },
      { value: "", label: "Customers" },
      { value: "", label: "Orders" },
    ],
    highlights: ["Genuine Products", "Fast Delivery Across Kenya", "Secure Payments"],
    trustText: "Trusted by 5,000+ customers across Kenya",
  });

  async function load() {
    setLoading(true);
    try {
      const d = await api<any>("/api/admin/storefront-layout");
      setCfg(d);
      setTheme(d.theme || "default");
      setThemeCustom(d.themeCustom || null);
      setBannerInputs((d.banners || []).map((b: any) => ({ title: b.title || "", subtitle: b.subtitle || "" })));
      if (d.hero) {
        const h = { ...d.hero };
        if (h.countdownEnd) {
          const dt = new Date(h.countdownEnd);
          if (!isNaN(dt.getTime())) {
            const off = dt.getTimezoneOffset();
            h.countdownEnd = new Date(dt.getTime() - off * 60000).toISOString().slice(0, 16);
          }
        }
        setHeroForm((prev) => ({ ...prev, ...h }));
      }
      try { const cd = await api<any>("/api/categories"); setCatList(cd.categories || []); } catch {}
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const { allLayouts, refreshConfig } = useLayout();
  const layouts = allLayouts.length > 0
    ? allLayouts.map((l) => ({ key: l.layout_key, label: l.label, desc: l.description, type: l.layout_type, id: l.id, isActive: l.is_active }))
    : getLayoutList().map((l) => ({ ...l, type: "static" as const, id: 0, isActive: 0 }));

  async function switchLayout(key: string) {
    setSaving(true);
    try { await api("/api/admin/storefront-layout", { method: "PUT", body: JSON.stringify({ layout: key }) }); await load(); }
    catch {}
    finally { setSaving(false); }
  }

  async function saveBanners() {
    setSaving(true);
    try { await api("/api/admin/storefront-layout", { method: "PUT", body: JSON.stringify({ banners: bannerInputs.filter((b) => b.title.trim()) }) }); await load(); }
    catch {}
    finally { setSaving(false); }
  }

  async function saveHero() {
    setSaving(true);
    try {
      const payload = { ...heroForm };
      if (payload.countdownEnd) {
        const dt = new Date(payload.countdownEnd);
        payload.countdownEnd = isNaN(dt.getTime()) ? "" : dt.toISOString();
      }
      const hexOk = (v: string) => /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(v || "");
      payload.heroBgLight = hexOk(payload.heroBgLight) ? payload.heroBgLight : "";
      payload.heroBgDark = hexOk(payload.heroBgDark) ? payload.heroBgDark : "";
      await api("/api/admin/storefront-layout", { method: "PUT", body: JSON.stringify({ hero: payload }) }); await load();
    }
    catch {}
    finally { setSaving(false); }
  }

  async function saveTheme(key: string) {
    if (key === theme) return;
    setSaving(true);
    try { await api("/api/admin/storefront-layout", { method: "PUT", body: JSON.stringify({ theme: key }) }); setTheme(key); await load(); refreshConfig(); }
    catch {}
    finally { setSaving(false); }
  }

  function shadeHex(hex: string, percent: number): string {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
    if (!m) return hex;
    const num = parseInt(m[1], 16);
    const amt = Math.round(2.55 * percent);
    const clamp = (v: number) => Math.max(0, Math.min(255, v));
    const r = clamp((num >> 16) + amt);
    const g = clamp(((num >> 8) & 0xff) + amt);
    const b = clamp((num & 0xff) + amt);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  async function saveCustomTheme() {
    const t = themeCustom || {};
    const primary = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t.primary || "") ? t.primary : "#c2410c";
    const payload = {
      primary,
      primaryHover: shadeHex(primary, -12),
      accent: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t.accent || "") ? t.accent : "#f59e0b",
      bgLight: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t.bgLight || "") ? t.bgLight : "#fafaf9",
      bgDark: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t.bgDark || "") ? t.bgDark : "#0c0a09",
      heroBgLight: t.heroBgLight || "",
      heroBgDark: t.heroBgDark || "",
    };
    setSaving(true);
    try { await api("/api/admin/storefront-layout", { method: "PUT", body: JSON.stringify({ theme: "custom", themeCustom: payload }) }); setThemeCustom(payload); await load(); refreshConfig(); }
    catch {}
    finally { setSaving(false); }
  }

  const THEME_CARDS = [
    { key: "default", label: "Default", desc: "Till Orange on warm-black", swatches: ["#c2410c", "#f97316", "#f59e0b"] },
    { key: "kenyan", label: "Kenyan", desc: "Green primary with red & black accents — Kenyan flag inspired", swatches: ["#15803d", "#dc2626", "#0f172a"] },
    { key: "modern", label: "Modern", desc: "Violet + cyan — sleek and contemporary", swatches: ["#6d28d9", "#0891b2", "#a78bfa"] },
    { key: "custom", label: "My Brand", desc: "Use your own brand colors everywhere", swatches: ["#000000", "#ffffff", "#888888"] },
  ];

  if (loading) return <Spinner />;

  return (
    <>
      <h1>Storefront Layout</h1>
      <p className="muted">Choose how your store looks to customers. Layouts only change the presentation — no data is affected.</p>
      {onOpenBuilder && (
        <div style={{ marginBottom: "1rem" }}>
          <RippleButton onClick={onOpenBuilder}>+ Build a Custom Layout</RippleButton>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {layouts.map((l) => (
          <div key={l.key} className="panel" role="button" tabIndex={0} style={{ border: cfg?.layout === l.key ? "2px solid var(--primary)" : "1px solid var(--border)", cursor: "pointer" }} onClick={() => switchLayout(l.key)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); switchLayout(l.key); } }}>
            <div style={{ height: 120, borderRadius: 8, background: "var(--bg)", marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}>
              <Icon name={l.key === "original" ? "monitor" : l.key === "amazon" ? "box" : l.key === "jumia" ? "store" : l.type === "dynamic" ? "layout" : "monitor"} size={40} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h2 style={{ margin: "0 0 0.25rem", fontSize: "var(--text-lg)" }}>{l.label}</h2>
              <span style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem", borderRadius: 4, background: l.type === "static" ? "var(--info-light)" : "var(--warning-light)", color: l.type === "static" ? "var(--info)" : "var(--warning)" }}>{l.type}</span>
            </div>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>{l.desc}</p>
            {cfg?.layout === l.key && <span className="badge badge-green" style={{ marginTop: "0.5rem" }}>Active</span>}
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Store Theme</h2>
        <p className="muted" style={{ fontSize: "0.85rem" }}>Pick a color theme for the whole storefront. Applied instantly to your live site.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
          {THEME_CARDS.map((t) => (
            <div key={t.key} className="panel" role="button" tabIndex={0} style={{ border: theme === t.key ? "2px solid var(--primary)" : "1px solid var(--border)", cursor: "pointer", margin: 0 }} onClick={() => saveTheme(t.key)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); saveTheme(t.key); } }}>
              <div style={{ display: "flex", gap: "0.35rem", height: 36, borderRadius: 8, overflow: "hidden", marginBottom: "0.75rem" }}>
                {t.swatches.map((c) => <div key={c} style={{ flex: 1, background: c }} />)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h3 style={{ margin: 0, fontSize: "0.95rem" }}>{t.label}</h3>
                {theme === t.key && <span className="badge badge-green">Active</span>}
              </div>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {(theme === "custom" || themeCustom) && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: 0 }}>My Brand Colors</h3>
              <p className="muted" style={{ fontSize: "0.85rem", margin: "4px 0 0" }}>These colors are applied across the whole store — header, buttons, links, hero and footer.</p>
            </div>
            <RippleButton onClick={saveCustomTheme} loading={saving}>Apply Brand Colors</RippleButton>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
            {[
              { key: "primary", label: "Primary color" },
              { key: "accent", label: "Accent color" },
              { key: "bgLight", label: "Light background" },
              { key: "bgDark", label: "Dark background" },
              { key: "heroBgLight", label: "Hero background (light)" },
              { key: "heroBgDark", label: "Hero background (dark)" },
            ].map((f) => (
              <label key={f.key} style={{ display: "block" }}>
                <span style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>{f.label}</span>
                <input
                  type="color"
                  value={themeCustom?.[f.key] || (f.key === "bgLight" ? "#fafaf9" : f.key === "bgDark" ? "#0c0a09" : f.key === "accent" ? "#f59e0b" : "#c2410c")}
                  onChange={(e) => setThemeCustom((prev: any) => ({ ...(prev || {}), [f.key]: e.target.value }))}
                  style={{ width: "100%", height: 40, borderRadius: 6, border: "1px solid var(--border)", background: "none", cursor: "pointer", padding: 2 }}
                  aria-label={f.label}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3>Promotional Banners</h3>
        <p className="muted" style={{ fontSize: "0.85rem" }}>These appear on the homepage hero area.</p>
        {bannerInputs.map((b, i) => (
          <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
            <input value={b.title} onChange={(e) => { const copy = [...bannerInputs]; copy[i] = { ...copy[i], title: e.target.value }; setBannerInputs(copy); }} placeholder="Title" style={{ flex: 1 }} />
            <input value={b.subtitle} onChange={(e) => { const copy = [...bannerInputs]; copy[i] = { ...copy[i], subtitle: e.target.value }; setBannerInputs(copy); }} placeholder="Subtitle" style={{ flex: 1 }} />
            <RippleButton size="small" variant="danger" aria-label="Remove banner" onClick={() => setBannerInputs(bannerInputs.filter((_, j) => j !== i))}>✕</RippleButton>
          </div>
        ))}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
          <RippleButton size="small" variant="ghost" onClick={() => setBannerInputs([...bannerInputs, { title: "", subtitle: "" }])}>+ Add Banner</RippleButton>
          <RippleButton size="small" onClick={saveBanners} loading={saving}>Save Banners</RippleButton>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3>Hero Section</h3>
        <p className="muted" style={{ fontSize: "0.85rem" }}>Control the hero banner, headline, and calls-to-action on your homepage.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600 }}>
              <input type="checkbox" checked={heroForm.heroActive !== false} onChange={(e) => setHeroForm({ ...heroForm, heroActive: e.target.checked })} style={{ width: 18, height: 18 }} />
              Show hero section on storefront
            </label>
            <p className="muted" style={{ fontSize: "0.8rem", margin: "0.25rem 0 0 1.75rem" }}>Turn off to hide the entire hero banner from the website.</p>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={heroForm.badgeActive} onChange={(e) => setHeroForm({ ...heroForm, badgeActive: e.target.checked })} style={{ width: 18, height: 18 }} disabled={heroForm.heroActive === false} />
              Show announcement badge
            </label>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={heroForm.identityBandActive !== false} onChange={(e) => setHeroForm({ ...heroForm, identityBandActive: e.target.checked })} style={{ width: 18, height: 18 }} disabled={heroForm.heroActive === false} />
              Show shop &amp; repair band
            </label>
            <p className="muted" style={{ fontSize: "0.8rem", margin: "0.25rem 0 0 1.75rem" }}>The "Shop premium tech" and "Need a repair?" cards under the hero.</p>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.25rem" }}>Hero Background Color</label>
            <p className="muted" style={{ fontSize: "0.8rem", margin: "0 0 0.75rem" }}>Leave both empty to match the visitor's device theme automatically (dark or light). Set one or both to use your own colors.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Light theme background</label>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input type="color" value={heroForm.heroBgLight || "#f8fafc"} onChange={(e) => setHeroForm({ ...heroForm, heroBgLight: e.target.value })} style={{ width: 48, height: 36, padding: 0, border: "1px solid var(--border)", borderRadius: 6, background: "none", cursor: "pointer" }} />
                  <input value={heroForm.heroBgLight} onChange={(e) => setHeroForm({ ...heroForm, heroBgLight: e.target.value })} placeholder="Auto (follow device)" style={{ flex: 1 }} />
                </div>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Dark theme background</label>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input type="color" value={heroForm.heroBgDark || "#0b1120"} onChange={(e) => setHeroForm({ ...heroForm, heroBgDark: e.target.value })} style={{ width: 48, height: 36, padding: 0, border: "1px solid var(--border)", borderRadius: 6, background: "none", cursor: "pointer" }} />
                  <input value={heroForm.heroBgDark} onChange={(e) => setHeroForm({ ...heroForm, heroBgDark: e.target.value })} placeholder="Auto (follow device)" style={{ flex: 1 }} />
                </div>
              </div>
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              <RippleButton size="small" variant="ghost" onClick={() => setHeroForm({ ...heroForm, heroBgLight: "", heroBgDark: "" })}>Reset to auto (follow device theme)</RippleButton>
            </div>
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>Badge Text</label>
            <input value={heroForm.badgeText} onChange={(e) => setHeroForm({ ...heroForm, badgeText: e.target.value })} placeholder="Summer Tech Sale — Up to 30% Off" disabled={!heroForm.badgeActive} />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>Badge Link (optional)</label>
            <select value={heroForm.badgeLink} onChange={(e) => setHeroForm({ ...heroForm, badgeLink: e.target.value })} disabled={!heroForm.badgeActive}>
              <option value="">— no link —</option>
              <option value="/#categories">Homepage (#categories)</option>
              <option value="/deals">Deals</option>
              {catList.map((c) => <option key={c.id} value={"/" + c.id}>{c.label}</option>)}
            </select>
            <input value={heroForm.badgeLink} onChange={(e) => setHeroForm({ ...heroForm, badgeLink: e.target.value })} placeholder="or type custom path" style={{ marginTop: "0.25rem" }} disabled={!heroForm.badgeActive} />
          </div>

          <div className="field">
            <label>Headline (before accent)</label>
            <input value={heroForm.headline} onChange={(e) => setHeroForm({ ...heroForm, headline: e.target.value })} />
          </div>

          <div className="field">
            <label>Headline Accent</label>
            <input value={heroForm.headlineAccent} onChange={(e) => setHeroForm({ ...heroForm, headlineAccent: e.target.value })} />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>Subtitle</label>
            <textarea rows={3} value={heroForm.subtitle} onChange={(e) => setHeroForm({ ...heroForm, subtitle: e.target.value })} style={{ resize: "vertical" }} />
          </div>

          <div className="field">
            <label>Shop Now Label</label>
            <input value={heroForm.shopNowLabel} onChange={(e) => setHeroForm({ ...heroForm, shopNowLabel: e.target.value })} />
          </div>

          <div className="field">
            <label>Shop Now Link</label>
            <select value={heroForm.shopNowLink} onChange={(e) => setHeroForm({ ...heroForm, shopNowLink: e.target.value })}>
              <option value="">— none —</option>
              {catList.map((c) => <option key={c.id} value={"/" + c.id}>{c.label}</option>)}
            </select>
            <input value={heroForm.shopNowLink} onChange={(e) => setHeroForm({ ...heroForm, shopNowLink: e.target.value })} placeholder="or type custom path" style={{ marginTop: "0.25rem" }} />
          </div>

          <div className="field">
            <label>Browse Categories Label</label>
            <input value={heroForm.browseLabel} onChange={(e) => setHeroForm({ ...heroForm, browseLabel: e.target.value })} />
          </div>

          <div className="field">
            <label>Browse Categories Link</label>
            <select value={heroForm.browseLink} onChange={(e) => setHeroForm({ ...heroForm, browseLink: e.target.value })}>
              <option value="/#categories">Homepage (#categories)</option>
              <option value="/categories">All Categories Page</option>
              {catList.map((c) => <option key={c.id} value={"/" + c.id}>{c.label}</option>)}
            </select>
            <input value={heroForm.browseLink} onChange={(e) => setHeroForm({ ...heroForm, browseLink: e.target.value })} placeholder="or type custom path" style={{ marginTop: "0.25rem" }} />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>Trust Text</label>
            <input value={heroForm.trustText} onChange={(e) => setHeroForm({ ...heroForm, trustText: e.target.value })} />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: "0.5rem" }}>Marketing Boosters</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.5rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.85rem" }}>
                <input type="checkbox" checked={heroForm.showTrustStrip} onChange={(e) => setHeroForm({ ...heroForm, showTrustStrip: e.target.checked })} style={{ width: 17, height: 17 }} />
                Payment &amp; delivery trust strip
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.85rem" }}>
                <input type="checkbox" checked={heroForm.showWhatsApp} onChange={(e) => setHeroForm({ ...heroForm, showWhatsApp: e.target.checked })} style={{ width: 17, height: 17 }} />
                Chat on WhatsApp button
              </label>
            </div>
            <p className="muted" style={{ fontSize: "0.8rem", margin: "0.35rem 0 0" }}>WhatsApp button uses the store phone number in Settings. Countdown, headline rotation and sale badges below.</p>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: "0.5rem" }}>Sale Countdown</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Countdown Label</label>
                <input value={heroForm.countdownLabel} onChange={(e) => setHeroForm({ ...heroForm, countdownLabel: e.target.value })} placeholder="Offer ends in" />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Sale Ends At</label>
                <input type="datetime-local" value={heroForm.countdownEnd} onChange={(e) => setHeroForm({ ...heroForm, countdownEnd: e.target.value })} />
              </div>
            </div>
            <p className="muted" style={{ fontSize: "0.8rem", margin: "0.35rem 0 0" }}>Leave the end time empty to hide the countdown. It disappears automatically once the sale ends.</p>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: "0.5rem" }}>Rotating Headlines <span className="muted" style={{ fontWeight: 400 }}>(optional &mdash; cycles every 6s)</span></label>
            {heroForm.headlineVariants.map((v, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                <input value={v.headline} onChange={(e) => { const copy = [...heroForm.headlineVariants]; copy[i] = { ...copy[i], headline: e.target.value }; setHeroForm({ ...heroForm, headlineVariants: copy }); }} placeholder="Headline (before accent)" style={{ flex: 1 }} />
                <input value={v.accent} onChange={(e) => { const copy = [...heroForm.headlineVariants]; copy[i] = { ...copy[i], accent: e.target.value }; setHeroForm({ ...heroForm, headlineVariants: copy }); }} placeholder="Accent" style={{ flex: 1 }} />
                <input value={v.subtitle} onChange={(e) => { const copy = [...heroForm.headlineVariants]; copy[i] = { ...copy[i], subtitle: e.target.value }; setHeroForm({ ...heroForm, headlineVariants: copy }); }} placeholder="Subtitle (optional)" style={{ flex: 1 }} />
                <button className="btn btn-sm btn-ghost" aria-label="Remove headline variant" onClick={() => setHeroForm({ ...heroForm, headlineVariants: heroForm.headlineVariants.filter((_, j) => j !== i) })}>&times;</button>
              </div>
            ))}
            <RippleButton size="small" variant="ghost" onClick={() => setHeroForm({ ...heroForm, headlineVariants: [...heroForm.headlineVariants, { headline: "", accent: "", subtitle: "" }] })}>+ Add Headline Variant</RippleButton>
            <p className="muted" style={{ fontSize: "0.8rem", margin: "0.35rem 0 0" }}>When variants exist, they override the headline, accent, and subtitle above on a rotation.</p>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: "0.5rem" }}>Highlights</label>
            {heroForm.highlights.map((h, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                <input value={h} onChange={(e) => { const copy = [...heroForm.highlights]; copy[i] = e.target.value; setHeroForm({ ...heroForm, highlights: copy }); }} style={{ flex: 1 }} />
                <button className="btn btn-sm btn-ghost" aria-label="Remove highlight" onClick={() => setHeroForm({ ...heroForm, highlights: heroForm.highlights.filter((_, j) => j !== i) })}>&times;</button>
              </div>
            ))}
            <RippleButton size="small" variant="ghost" onClick={() => setHeroForm({ ...heroForm, highlights: [...heroForm.highlights, ""] })}>+ Add Highlight</RippleButton>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: "0.5rem" }}>Category Chips</label>
            {heroForm.catChips.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                <input value={c.label} onChange={(e) => { const copy = [...heroForm.catChips]; copy[i] = { ...copy[i], label: e.target.value }; setHeroForm({ ...heroForm, catChips: copy }); }} placeholder="Label" style={{ flex: 1 }} />
                <select value={c.href} onChange={(e) => { const copy = [...heroForm.catChips]; copy[i] = { ...copy[i], href: e.target.value }; setHeroForm({ ...heroForm, catChips: copy }); }} style={{ flex: 1 }}>
                  <option value="">— pick category —</option>
                  {catList.map((cat) => <option key={cat.id} value={"/" + cat.id}>{cat.label}</option>)}
                </select>
                <button className="btn btn-sm btn-ghost" aria-label="Remove category chip" onClick={() => setHeroForm({ ...heroForm, catChips: heroForm.catChips.filter((_, j) => j !== i) })}>&times;</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <RippleButton size="small" variant="ghost" onClick={() => setHeroForm({ ...heroForm, catChips: [...heroForm.catChips, { label: "", href: "" }] })}>+ Add Chip</RippleButton>
              <RippleButton size="small" variant="ghost" onClick={async () => {
                try { const d = await api<any>("/api/categories"); const cats = d.categories || []; setHeroForm({ ...heroForm, catChips: cats.map((c: any) => ({ label: c.label, href: "/" + c.id })) }); } catch { toast("error", "Failed to load categories"); }
              }}>Sync from Categories</RippleButton>
            </div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: "0.5rem" }}>Stats</label>
            {heroForm.stats.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                <input value={s.value} onChange={(e) => { const copy = [...heroForm.stats]; copy[i] = { ...copy[i], value: e.target.value }; setHeroForm({ ...heroForm, stats: copy }); }} placeholder="Value" style={{ width: 100 }} />
                <input value={s.label} onChange={(e) => { const copy = [...heroForm.stats]; copy[i] = { ...copy[i], label: e.target.value }; setHeroForm({ ...heroForm, stats: copy }); }} placeholder="Label" style={{ flex: 1 }} />
                <button className="btn btn-sm btn-ghost" aria-label="Remove stat" onClick={() => setHeroForm({ ...heroForm, stats: heroForm.stats.filter((_, j) => j !== i) })}>&times;</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <RippleButton size="small" variant="ghost" onClick={() => setHeroForm({ ...heroForm, stats: [...heroForm.stats, { value: "", label: "" }] })}>+ Add Stat</RippleButton>
              <RippleButton size="small" variant="ghost" onClick={async () => {
                try { const d = await api<any>("/api/storefront-stats"); setHeroForm({ ...heroForm, stats: [{ value: String(d.totalProducts) + "+", label: "Products" }, { value: String(d.totalCustomers) + "+", label: "Customers" }, { value: String(d.totalOrders) + "+", label: "Orders" }] }); } catch { toast("error", "Failed to load stats"); }
              }}>Populate from Live Data</RippleButton>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <RippleButton size="small" onClick={saveHero} loading={saving}>Save Hero Section</RippleButton>
        </div>
      </div>
    </>
  );
}

function AdminPaymentMethods({ initial }: { initial: any[] }) {
  const [methods, setMethods] = useState<any[]>(initial.length > 0 ? initial : [
    { id: "cash", name: "Cash", kraCode: "01", needsTender: true },
    { id: "mpesa", name: "M-Pesa", kraCode: "04", needsTender: false },
    { id: "card", name: "Card", kraCode: "02", needsTender: false },
  ]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setSaving(true); setMsg("");
    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify({ paymentMethods: methods }) });
      setMsg("Payment methods saved.");
    } catch (err: any) { setMsg("Error: " + err.message); }
    finally { setSaving(false); }
  }

  function addMethod() {
    setMethods([...methods, { id: "", name: "", kraCode: "01", needsTender: false }]);
  }

  function removeMethod(idx: number) {
    setMethods(methods.filter((_, i) => i !== idx));
  }

  function updateMethod(idx: number, field: string, value: any) {
    setMethods(methods.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  }

  return (
    <div>
      <div className="table-wrap payment-methods-table-wrap" style={{ marginBottom: "0.5rem" }}>
        <table className="data-table payment-methods-table">
          <colgroup>
            <col className="payment-methods-table__id" />
            <col className="payment-methods-table__name" />
            <col className="payment-methods-table__kra" />
            <col className="payment-methods-table__tender" />
            <col className="payment-methods-table__actions" />
          </colgroup>
          <thead><tr><th>ID</th><th>Name</th><th>KRA Code</th><th>Needs Tender</th><th></th></tr></thead>
          <tbody>
            {methods.map((m, i) => (
              <tr key={i}>
                <td><input className="payment-methods-table__input" value={m.id} onChange={(e) => updateMethod(i, "id", e.target.value)} placeholder="e.g. paypal" /></td>
                <td><input className="payment-methods-table__input" value={m.name} onChange={(e) => updateMethod(i, "name", e.target.value)} placeholder="e.g. PayPal" /></td>
                <td><select className="payment-methods-table__input" value={m.kraCode} onChange={(e) => updateMethod(i, "kraCode", e.target.value)}>
                  <option value="01">01 — Cash</option>
                  <option value="02">02 — Card</option>
                  <option value="03">03 — Cheque</option>
                  <option value="04">04 — Mobile</option>
                  <option value="05">05 — Bank Transfer</option>
                  <option value="06">06 — Other</option>
                </select></td>
                <td className="payment-methods-table__checkbox"><input type="checkbox" checked={m.needsTender} onChange={(e) => updateMethod(i, "needsTender", e.target.checked)} aria-label={`Needs tender for ${m.name || "payment method"}`} /></td>
                <td className="payment-methods-table__delete"><RippleButton size="small" variant="danger" onClick={() => removeMethod(i)}>Delete</RippleButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <p style={{ fontSize: "0.85rem", color: msg.startsWith("Error") ? "var(--danger)" : "var(--success)", marginBottom: "0.5rem" }}>{msg}</p>}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <RippleButton size="small" onClick={addMethod}>Add method</RippleButton>
        <RippleButton size="small" onClick={save} loading={saving}>Save methods</RippleButton>
      </div>
    </div>
  );
}

function AdminExchangeRates() {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editRates, setEditRates] = useState<Record<string, string>>({});

  useEffect(() => {
    api<{ rates: Record<string, number>; source: string }>("/api/rates").then((d) => {
      if (d?.rates) { setRates(d.rates); setMsg(`Source: ${d.source || "auto"}`); }
    }).catch(() => setMsg("Could not load rates"));
  }, []);

  const common = ["USD", "EUR", "GBP", "NGN", "ZAR", "EGP", "MAD", "GHS", "CAD", "BRL", "MXN", "JPY", "CNY", "HKD", "SGD", "AED", "INR", "THB", "KRW", "AUD", "NZD"];

  function startEdit() {
    const m: Record<string, string> = {};
    for (const code of common) { if (rates[code]) m[code] = String(rates[code]); }
    setEditRates(m); setEditMode(true);
  }

  async function saveRates() {
    setLoading(true);
    try {
      const payload: Record<string, number> = {};
      for (const [k, v] of Object.entries(editRates)) { if (v) payload[k] = Number(v); }
      await api("/api/rates", { method: "PUT", body: JSON.stringify({ rates: payload }) });
      setRates(payload); setMsg("Manual rates saved. Auto-fetch disabled."); setEditMode(false);
    } catch (err: any) { setMsg("Error: " + err.message); }
    finally { setLoading(false); }
  }

  async function clearRates() {
    try {
      await api("/api/rates", { method: "DELETE" });
      setRates({}); setMsg("Manual rates cleared. Auto-fetch will resume."); setEditMode(false);
    } catch (err: any) { setMsg("Error: " + err.message); }
  }

  return (
    <div className="panel" style={{ maxWidth: 500, marginBottom: "1rem" }}>
      {msg && <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem", color: "var(--text-secondary)" }}>{msg}</p>}
      {editMode ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          {common.filter((c) => c !== "KES").map((code) => (
            <div key={code} className="field" style={{ margin: 0 }}>
              <label style={{ fontSize: "0.8rem" }}>{code}<input type="number" step="0.0001" min="0" value={editRates[code] || ""} onChange={(e) => setEditRates({ ...editRates, [code]: e.target.value })} style={{ fontSize: "0.8rem" }} /></label>
            </div>
          ))}
          <div style={{ display: "flex", gap: "0.5rem", gridColumn: "1 / -1" }}>
            <RippleButton size="small" onClick={saveRates} loading={loading}>Save</RippleButton>
            <RippleButton size="small" variant="secondary" onClick={() => setEditMode(false)}>Cancel</RippleButton>
            <RippleButton size="small" variant="danger" onClick={clearRates}>Use auto rates</RippleButton>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            {common.filter((c) => rates[c]).slice(0, 10).map((code) => (
              <span key={code} style={{ fontSize: "0.8rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.15rem 0.4rem" }}>{code}: {rates[code].toFixed(4)}</span>
            ))}
          </div>
          <RippleButton size="small" onClick={startEdit}>Set Custom Rates</RippleButton>
        </div>
      )}
    </div>
  );
}

function AdminSplashes() {
  const [splashes, setSplashes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: "", text: "", bgColor: "#f59e0b", textColor: "#ffffff", isMarquee: true, isActive: true, startDate: "", endDate: "", imageUrl: "", linkUrl: "", sortOrder: 0 });

  useEffect(() => { loadSplashes(); }, []);

  async function loadSplashes() {
    setLoading(true);
    try {
      const d = await api<{ splashes: any[] }>("/api/admin/splashes");
      setSplashes(d.splashes || []);
    } catch {}
    setLoading(false);
  }

  function resetForm() {
    setForm({ title: "", text: "", bgColor: "#f59e0b", textColor: "#ffffff", isMarquee: true, isActive: true, startDate: "", endDate: "", imageUrl: "", linkUrl: "", sortOrder: 0 });
    setEditing(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.text.trim()) return;
    const body: any = { ...form };
    if (!body.startDate) body.startDate = null;
    if (!body.endDate) body.endDate = null;
    try {
      if (editing) {
        await api(`/api/admin/splashes/${editing.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await api("/api/admin/splashes", { method: "POST", body: JSON.stringify(body) });
      }
      resetForm();
      loadSplashes();
      toast("success", editing ? "Splash updated." : "Splash created.");
    } catch (err: any) { toast("error", err.message); }
  }

  async function handleDelete(id: number) {
    if (!(await confirmDialog({ message: "Delete this splash?", confirmLabel: "Delete", danger: true }))) return;
    try { await api(`/api/admin/splashes/${id}`, { method: "DELETE" }); loadSplashes(); toast("success", "Splash deleted."); } catch (err: any) { toast("error", err.message); }
  }

  const presets = [
    { label: "Black Friday", title: "Black Friday", text: "Massive deals this Black Friday! Up to 50% off on select items.", bgColor: "#111827", textColor: "#facc15" },
    { label: "Happy Hour", title: "Happy Hour", text: "Flash sale! Limited time offers - grab them before they're gone.", bgColor: "#f59e0b", textColor: "#fff" },
    { label: "Christmas", title: "Merry Christmas", text: "Season of giving! Special holiday prices for you and yours.", bgColor: "#dc2626", textColor: "#fff" },
    { label: "New Year Sale", title: "New Year Sale", text: "Kick off the new year with incredible savings!", bgColor: "#16a34a", textColor: "#fff" },
    { label: "Back to School", title: "Back to School", text: "Get ready for school with our tech deals for students.", bgColor: "#2563eb", textColor: "#fff" },
    { label: "Custom", title: "", text: "", bgColor: "#6366f1", textColor: "#ffffff" },
  ];

  function applyPreset(p: typeof presets[0]) {
    setForm({ ...form, title: p.title, text: p.text, bgColor: p.bgColor, textColor: p.textColor });
  }

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h3 style={{ marginTop: 0 }}>Promotional Banners &amp; Marquees</h3>
      <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
        Configure scrolling text banners and promotional messages. Kenyan holidays are auto-detected and displayed with themed colors.
      </p>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h4 style={{ marginTop: 0 }}>Quick presets</h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
          {presets.map((p) => (
            <button key={p.label} type="button" onClick={() => applyPreset(p)} style={{ padding: "0.3rem 0.7rem", border: `2px solid ${p.bgColor}`, background: p.bgColor, color: p.textColor, borderRadius: 6, cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>
              {p.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSave} style={{ maxWidth: 500 }}>
          <div className="field"><label>Title (optional)<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Black Friday" /></label></div>
          <div className="field"><label>Banner text *<input value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} required placeholder="e.g. Up to 50% off!" /></label></div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div className="field"><label>Background color<input type="color" value={form.bgColor} onChange={(e) => setForm({ ...form, bgColor: e.target.value })} style={{ width: 48, height: 32, padding: 0 }} /></label></div>
            <div className="field"><label>Text color<input type="color" value={form.textColor} onChange={(e) => setForm({ ...form, textColor: e.target.value })} style={{ width: 48, height: 32, padding: 0 }} /></label></div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem" }}>
              <input type="checkbox" checked={form.isMarquee} onChange={(e) => setForm({ ...form, isMarquee: e.target.checked })} style={{ width: 16, height: 16 }} />
              Scrolling marquee
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} style={{ width: 16, height: 16 }} />
              Active
            </label>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div className="field"><label>Start date<input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label></div>
            <div className="field"><label>End date<input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label></div>
          </div>
          <div className="field">
            <label>Image URL (optional)</label>
            <input type="url" value={form.imageUrl || ""} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://example.com/image.jpg" className="input" />
          </div>
          <div className="field">
            <label>Link URL (optional)</label>
            <input type="url" value={form.linkUrl || ""} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="/laptops or https://..." className="input" />
          </div>
          <div className="field">
            <label>Sort order</label>
            <input type="number" value={form.sortOrder ?? 0} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} className="input" style={{ width: 80 }} />
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <RippleButton type="submit" size="small">{editing ? "Update" : "Add banner"}</RippleButton>
            {editing && <RippleButton size="small" variant="secondary" type="button" onClick={resetForm}>Cancel</RippleButton>}
          </div>
        </form>
      </div>

      {loading ? <Spinner /> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Preview</th><th>Text</th><th>Image</th><th>Type</th><th>Sort</th><th>Dates</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {splashes.map((s) => (
                <tr key={s.id}>
                  <td style={{ minWidth: 200 }}>
                    <div style={{ background: s.bgColor, color: s.textColor, padding: "0.3rem 0.6rem", borderRadius: 4, fontSize: "0.75rem", fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: 200 }}>
                      {s.title ? `${s.title}: ` : ""}{s.text}
                    </div>
                  </td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{escapeHtml(s.title || s.text)}</td>
                  <td>{s.imageUrl ? <img src={s.imageUrl} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }} /> : <span className="muted">—</span>}</td>
                  <td>{s.isMarquee ? "Marquee" : "Static"}</td>
                  <td style={{ fontSize: "0.8rem" }}>{s.sortOrder ?? 0}</td>
                  <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{s.startDate || "—"} to {s.endDate || "—"}</td>
                  <td><span className={`plan-status`} style={{ background: s.isActive ? "var(--success-light)" : "var(--danger-light)", color: s.isActive ? "var(--success-text)" : "var(--danger-text)" }}>{s.isActive ? "Active" : "Inactive"}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: "0.3rem" }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => { setEditing(s); setForm({ title: s.title, text: s.text, bgColor: s.bgColor, textColor: s.textColor, isMarquee: s.isMarquee, isActive: s.isActive, startDate: s.startDate || "", endDate: s.endDate || "", imageUrl: s.imageUrl || "", linkUrl: s.linkUrl || "", sortOrder: s.sortOrder ?? 0 }); }}>Edit</button>
                      <button className="btn btn-sm btn-ghost" style={{ color: "var(--danger)" }} onClick={() => handleDelete(s.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {splashes.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)" }}>No banners configured. Kenyan holidays will auto-display.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminStoreInfo() {
  const { refreshSettings } = useApp();
  const { toast } = useToast();
  const { data: settings, loading, error } = useFetch(() => api<any>("/api/settings"), []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [faviconMsg, setFaviconMsg] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoMsg, setLogoMsg] = useState("");
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpSetup, setTotpSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpMsg, setTotpMsg] = useState("");
  const [totpDisablePassword, setTotpDisablePassword] = useState("");

  function handleFaviconChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFaviconMsg("");
    setFaviconFile(e.target.files?.[0] || null);
  }

  async function handleFaviconUpload(e: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) {
    if (e) e.preventDefault?.();
    if (!faviconFile) { setFaviconMsg("Select a favicon file first."); return; }
    setFaviconUploading(true); setFaviconMsg("");
    const formData = new FormData();
    formData.append("favicon", faviconFile);
    try {
      await api("/api/settings/favicon", { method: "POST", body: formData }, "staff");
      setFaviconMsg("Favicon updated successfully.");
      setFaviconFile(null);
      refreshSettings();
    } catch (err: any) { setFaviconMsg("Error: " + err.message); }
    finally { setFaviconUploading(false); }
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLogoMsg("");
    setLogoFile(e.target.files?.[0] || null);
  }

  async function handleLogoUpload(e: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) {
    if (e) e.preventDefault?.();
    if (!logoFile) { setLogoMsg("Select a logo file first."); return; }
    setLogoUploading(true); setLogoMsg("");
    const formData = new FormData();
    formData.append("image", logoFile);
    try {
      await api("/api/settings/logo", { method: "POST", body: formData }, "staff");
      setLogoMsg("Logo updated successfully.");
      setLogoFile(null);
      refreshSettings();
    } catch (err: any) { setLogoMsg("Error: " + err.message); }
    finally { setLogoUploading(false); }
  }

  useEffect(() => {
    api<{ enabled: boolean }>("/api/auth/2fa/status", { method: "GET" }, "staff")
      .then((d) => setTotpEnabled(d.enabled))
      .catch((e) => console.warn("[admin] Failed to load 2FA status:", e?.message));
  }, []);

  async function handleTotpSetup() {
    setTotpLoading(true); setTotpMsg(""); setTotpCode("");
    try {
      const data = await api<{ secret: string; otpauthUrl: string }>("/api/auth/2fa/setup", { method: "POST", body: "{}" }, "staff");
      setTotpSetup(data);
      setTotpMsg("Scan the QR code in your authenticator app, then enter the 6-digit code below.");
    } catch (err: any) {
      setTotpMsg("Error: " + err.message);
    } finally { setTotpLoading(false); }
  }

  async function handleTotpVerify() {
    if (!totpCode || totpCode.length !== 6) { setTotpMsg("Enter a valid 6-digit code."); return; }
    setTotpLoading(true); setTotpMsg("");
    try {
      await api("/api/auth/2fa/verify", { method: "POST", body: JSON.stringify({ code: totpCode }) }, "staff");
      setTotpEnabled(true);
      setTotpSetup(null);
      setTotpCode("");
      setTotpMsg("2FA enabled successfully.");
      toast?.("success", "2FA enabled successfully.");
    } catch (err: any) {
      setTotpMsg("Error: " + err.message);
    } finally { setTotpLoading(false); }
  }

  async function handleTotpDisable() {
    if (!totpDisablePassword) { setTotpMsg("Enter your password to disable 2FA."); return; }
    setTotpLoading(true); setTotpMsg("");
    try {
      await api("/api/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password: totpDisablePassword }) }, "staff");
      setTotpEnabled(false);
      setTotpSetup(null);
      setTotpDisablePassword("");
      setTotpMsg("2FA disabled.");
      toast?.("success", "2FA disabled.");
    } catch (err: any) {
      setTotpMsg("Error: " + err.message);
    } finally { setTotpLoading(false); }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setMsg("");
    const fd = new FormData(e.currentTarget);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          storeName: fd.get("storeName"),
          phone: fd.get("phone"),
          email: fd.get("email"),
          currency: fd.get("currency"),
          taxRate: Number(fd.get("taxRate")),
          logoPosition: fd.get("logoPosition"),
          springboardMenu: fd.get("springboardMenu") === "on",
        }),
      });
      setMsg("Settings saved.");
    } catch (err: any) { setMsg("Error: " + err.message); }
    finally { setSaving(false); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <>
      <h1>Store Info</h1>
      <form onSubmit={handleSave} style={{ maxWidth: 500 }}>
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Store details</h3>
          <div className="field"><label>Store name<input name="storeName" defaultValue={settings?.storeName || ""} /></label></div>
          <div className="field"><label>Phone<input name="phone" defaultValue={settings?.phone || ""} /></label></div>
          <div className="field"><label>Email<input name="email" defaultValue={settings?.email || ""} /></label></div>
          <div className="field"><label>Currency<input name="currency" defaultValue={settings?.currency || "KES"} /></label></div>
          <div className="field"><label>Tax Rate (%)<input name="taxRate" type="number" min="0" max="100" step="0.01" defaultValue={settings?.taxRate ?? 16} /></label></div>
        </div>
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Store favicon</h3>
          <div className="field" style={{ gap: "0.75rem", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              {settings?.storeFavicon ? (
                <img src={settings.storeFavicon} alt="Current favicon" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "contain", border: "1px solid var(--border)" }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 8, background: "var(--surface-hover)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>default</span>
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Current favicon</p>
                <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>Upload a PNG, ICO, SVG, JPEG, or WEBP file to replace the favicon.</p>
              </div>
            </div>
            <input type="file" accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.ico,.svg" onChange={handleFaviconChange} />
            <RippleButton type="button" onClick={handleFaviconUpload} loading={faviconUploading} disabled={!faviconFile}>Upload favicon</RippleButton>
            {faviconMsg && <p style={{ margin: 0, color: faviconMsg.startsWith("Error") ? "var(--danger-text)" : "var(--success-text)" }}>{faviconMsg}</p>}
          </div>
        </div>
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Store logo (invoices &amp; quotes)</h3>
          <div className="field" style={{ gap: "0.75rem", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              {settings?.storeLogo ? (
                <img src={settings.storeLogo} alt="Current logo" style={{ width: 80, height: 48, borderRadius: 8, objectFit: "contain", border: "1px solid var(--border)" }} />
              ) : (
                <div style={{ width: 80, height: 48, borderRadius: 8, background: "var(--surface-hover)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>no logo</span>
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Current logo</p>
                <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>Upload a PNG, JPEG, or WEBP file. This will appear on invoices, receipts, and quotes.</p>
              </div>
            </div>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} />
            <RippleButton type="button" onClick={handleLogoUpload} loading={logoUploading} disabled={!logoFile}>Upload logo</RippleButton>
            {logoMsg && <p style={{ margin: 0, color: logoMsg.startsWith("Error") ? "var(--danger-text)" : "var(--success-text)" }}>{logoMsg}</p>}
          </div>
          <div className="field" style={{ marginTop: "0.75rem" }}>
            <label>Logo position on documents</label>
            <select name="logoPosition" defaultValue={settings?.logoPosition || "top-left"}>
              <option value="top-left">Top left</option>
              <option value="top-middle">Top center</option>
              <option value="top-right">Top right</option>
            </select>
          </div>
          <div className="field" style={{ marginTop: "0.75rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input type="checkbox" name="springboardMenu" defaultChecked={settings?.springboardMenu ?? false} style={{ width: "auto" }} />
              Springboard category menu (dropdown instead of horizontal nav)
            </label>
            <p className="muted" style={{ fontSize: "0.8rem", margin: "0.25rem 0 0" }}>Replaces the horizontal category links with a collapsible dropdown menu for a cleaner header.</p>
          </div>
        </div>
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Two-Factor Authentication (2FA)</h3>
          <p className="muted" style={{ fontSize: "0.85rem", margin: "0 0 0.75rem" }}>Add an extra layer of security to your admin account. When enabled, you&apos;ll need to enter a 6-digit code from your authenticator app each time you sign in.</p>
          {totpEnabled ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--success-text)", fontWeight: 600, fontSize: "0.9rem" }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--success)" }}></span>
                2FA is enabled
              </div>
              <div className="field">
                <label style={{ fontSize: "0.85rem" }}>Password to disable 2FA</label>
                <input type="password" value={totpDisablePassword} onChange={(e) => setTotpDisablePassword(e.target.value)} placeholder="Enter your password" style={{ maxWidth: 300 }} />
              </div>
              <RippleButton type="button" loading={totpLoading} onClick={handleTotpDisable} style={{ maxWidth: 300 }}>Disable 2FA</RippleButton>
            </div>
          ) : totpSetup ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>1. Open your authenticator app (Google Authenticator, Authy, etc.)</p>
              <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem", wordBreak: "break-all", fontSize: "0.8rem", fontFamily: "monospace" }}>
                <p style={{ margin: "0 0 0.25rem", fontWeight: 600, fontSize: "0.85rem" }}>Manual entry key:</p>
                {totpSetup.secret}
              </div>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>2. Enter the 6-digit code from your authenticator app:</p>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  style={{ width: 160, letterSpacing: "0.25em", fontSize: "1.1rem", textAlign: "center" }}
                />
                <RippleButton type="button" loading={totpLoading} onClick={handleTotpVerify}>Verify & Enable</RippleButton>
                <RippleButton type="button" variant="secondary" onClick={() => { setTotpSetup(null); setTotpCode(""); setTotpMsg(""); }}>Cancel</RippleButton>
              </div>
            </div>
          ) : (
            <RippleButton type="button" loading={totpLoading} onClick={handleTotpSetup}>Enable 2FA</RippleButton>
          )}
          {totpMsg && <p style={{ marginTop: "0.5rem", padding: "0.4rem 0.75rem", borderRadius: 6, background: totpMsg.startsWith("Error") ? "var(--danger-light)" : "var(--success-light)", color: totpMsg.startsWith("Error") ? "var(--danger-text)" : "var(--success-text)", fontSize: "0.85rem" }}>{totpMsg}</p>}
        </div>
        {msg && <p style={{ padding: "0.5rem 1rem", borderRadius: 8, background: msg.startsWith("Error") ? "var(--danger-light)" : "var(--success-light)", color: msg.startsWith("Error") ? "var(--danger-text)" : "var(--success-text)", marginBottom: "0.75rem" }}>{msg}</p>}
        <RippleButton type="submit" loading={saving}>Save settings</RippleButton>
      </form>
    </>
  );
}

function AdminPayments() {
  const { data: settings, loading, error } = useFetch(() => api<any>("/api/settings"), []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setMsg("");
    const fd = new FormData(e.currentTarget);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          mpesaConsumerKey: fd.get("mpesaConsumerKey"),
          mpesaConsumerSecret: fd.get("mpesaConsumerSecret"),
          mpesaPasskey: fd.get("mpesaPasskey"),
          mpesaShortcode: fd.get("mpesaShortcode"),
          mpesaTillNumber: fd.get("mpesaTillNumber"),
          mpesaEnv: fd.get("mpesaEnv"),
        }),
      });
      setMsg("M-Pesa settings saved.");
    } catch (err: any) { setMsg("Error: " + err.message); }
    finally { setSaving(false); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <>
      <h1>Payments</h1>
      <form onSubmit={handleSave} style={{ maxWidth: 500 }}>
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>M-Pesa Configuration</h3>
          <div className="field"><label>Consumer Key<input name="mpesaConsumerKey" defaultValue={settings?.mpesaConsumerKey || ""} /></label></div>
          <div className="field"><label>Consumer Secret<input name="mpesaConsumerSecret" defaultValue={settings?.mpesaConsumerSecret || ""} /></label></div>
          <div className="field"><label>Passkey<input name="mpesaPasskey" defaultValue={settings?.mpesaPasskey || ""} /></label></div>
          <div className="field"><label>Shortcode<input name="mpesaShortcode" defaultValue={settings?.mpesaShortcode || ""} /></label></div>
          <div className="field"><label>Till Number<input name="mpesaTillNumber" defaultValue={settings?.mpesaTillNumber || ""} /></label></div>
          <div className="field"><label>Environment<select name="mpesaEnv" defaultValue={settings?.mpesaEnv || "sandbox"}><option value="sandbox">Sandbox</option><option value="production">Production</option></select></label></div>
        </div>
        {msg && <p style={{ padding: "0.5rem 1rem", borderRadius: 8, background: msg.startsWith("Error") ? "var(--danger-light)" : "var(--success-light)", color: msg.startsWith("Error") ? "var(--danger-text)" : "var(--success-text)", marginBottom: "0.75rem" }}>{msg}</p>}
        <RippleButton type="submit" loading={saving}>Save M-Pesa settings</RippleButton>
      </form>

      <div className="panel payment-methods-panel" style={{ marginBottom: "1rem", marginTop: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Payment Methods</h3>
        <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
          Configure payment methods shown on the POS page. Each method needs a unique ID, display name, KRA tax code, and whether it requires a tendered amount.
        </p>
        <AdminPaymentMethods initial={settings?.paymentMethods || []} />
      </div>

      <h3 style={{ marginTop: "1.5rem" }}>Exchange Rates</h3>
      <p className="muted" style={{ fontSize: "0.85rem" }}>Rates auto-fetch from open.er-api.com. Set custom rates below to override. Leave empty to use auto rates.</p>
      <AdminExchangeRates />
    </>
  );
}

function AdminCompliance() {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const { data: settings, loading, error } = useFetch(() => api<any>("/api/settings"), []);
  const [etimsMode, setEtimsMode] = useState("off");
  useEffect(() => { if (settings?.etimsMode) setEtimsMode(settings.etimsMode); }, [settings?.etimsMode]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setMsg("");
    const fd = new FormData(e.currentTarget);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          googleClientId: fd.get("googleClientId"),
          kraPin: fd.get("kraPin"),
          etimsSerialPrefix: fd.get("etimsSerialPrefix"),
          etimsMode: fd.get("etimsMode"),
          etimsBranchId: fd.get("etimsBranchId"),
          etimsDeviceSerial: fd.get("etimsDeviceSerial"),
          etimsVscuUrl: fd.get("etimsVscuUrl"),
          etimsOscuApiUrl: fd.get("etimsOscuApiUrl"),
          etimsOscuConsumerKey: fd.get("etimsOscuConsumerKey"),
          etimsOscuConsumerSecret: fd.get("etimsOscuConsumerSecret"),
        }),
      });
      setMsg("Compliance settings saved.");
    } catch (err: any) { setMsg("Error: " + err.message); }
    finally { setSaving(false); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <>
      <h1>Compliance</h1>
      <form onSubmit={handleSave} style={{ maxWidth: 500 }}>
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Google Sign-In</h3>
          <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
            Enter your OAuth Client ID to enable Google sign-in on the login pages.
            Get one from <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud Console</a>.
          </p>
          <div className="field"><label>Google Client ID<input name="googleClientId" defaultValue={settings?.googleClientId || ""} placeholder="123456789-xxxxx.apps.googleusercontent.com" /></label></div>
        </div>
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>eTIMS / KRA Compliance</h3>
          <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
            VSCU (Virtual Sales Control Unit) uses a local JAR bridge. OSCU (Online Sales Control Unit) communicates directly with KRA's cloud API.
          </p>
          <div className="field"><label>Integration Mode<select name="etimsMode" value={etimsMode} onChange={(e) => setEtimsMode(e.target.value)}><option value="off">Off</option><option value="vscu">VSCU (Local JAR)</option><option value="oscu">OSCU (Cloud API)</option></select></label></div>
          <div className="field"><label>KRA PIN<input name="kraPin" defaultValue={settings?.kraPin || ""} placeholder="P051234567Z" /></label></div>
          {etimsMode === "vscu" ? <>
            <div className="field"><label>Branch ID<input name="etimsBranchId" defaultValue={settings?.etimsBranchId || "00"} placeholder="00" /></label></div>
            <div className="field"><label>Device Serial No.<input name="etimsDeviceSerial" defaultValue={settings?.etimsDeviceSerial || "dvc001"} placeholder="dvc001" /></label></div>
            <div className="field"><label>VSCU Server URL<input name="etimsVscuUrl" defaultValue={settings?.etimsVscuUrl || "http://localhost:8088"} placeholder="http://localhost:8088" /></label></div>
            <div className="field"><label>eTIMS Serial Prefix<input name="etimsSerialPrefix" defaultValue={settings?.etimsSerialPrefix || "01"} placeholder="01" /></label></div>
          </> : <>
            <div className="field"><label>Branch ID<input name="etimsBranchId" defaultValue={settings?.etimsBranchId || "00"} placeholder="00" /></label></div>
            <div className="field"><label>OSCU API URL<input name="etimsOscuApiUrl" defaultValue={settings?.etimsOscuApiUrl || "https://etims.kra.go.ke/api"} placeholder="https://etims.kra.go.ke/api" /></label></div>
            <div className="field"><label>Consumer Key<input name="etimsOscuConsumerKey" type="password" autoComplete="new-password" defaultValue={settings?.etimsOscuConsumerKey || ""} placeholder="OSCU consumer key" /></label></div>
            <div className="field"><label>Consumer Secret<input name="etimsOscuConsumerSecret" type="password" autoComplete="new-password" defaultValue={settings?.etimsOscuConsumerSecret || ""} placeholder="OSCU consumer secret" /></label></div>
          </>}
        </div>
        {msg && <p style={{ padding: "0.5rem 1rem", borderRadius: 8, background: msg.startsWith("Error") ? "var(--danger-light)" : "var(--success-light)", color: msg.startsWith("Error") ? "var(--danger-text)" : "var(--success-text)", marginBottom: "0.75rem" }}>{msg}</p>}
        <RippleButton type="submit" loading={saving}>Save compliance settings</RippleButton>
      </form>
    </>
  );
}

function AdminContent() {
  const { data: settings, loading, error } = useFetch(() => api<any>("/api/settings"), []);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <>
      <h1>Content</h1>
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Image Storage</h3>
        <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
          Configure Cloudinary for cloud image storage. Leave blank to use local disk (not recommended in production — local files are lost on Render deploys). If set here, these override the environment variables.
        </p>
        <AdminImageStorage initial={settings} />
      </div>
      <AdminSplashes />
    </>
  );
}

function AdminImageStorage({ initial }: { initial: any }) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setMsg("");
    const fd = new FormData(e.currentTarget);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          backupImagesToDb: fd.get("backupImagesToDb") === "on",
          cloudinaryCloudName: fd.get("cloudinaryCloudName"),
          cloudinaryApiKey: fd.get("cloudinaryApiKey"),
          cloudinaryApiSecret: fd.get("cloudinaryApiSecret"),
          cloudinaryFolder: fd.get("cloudinaryFolder"),
        }),
      });
      setMsg("Image storage settings saved.");
    } catch (err: any) { setMsg("Error: " + err.message); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSave} style={{ maxWidth: 500 }}>
      <div style={{ display: "grid", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <div className="field"><label>Cloud Name<input name="cloudinaryCloudName" defaultValue={initial?.cloudinaryCloudName || ""} placeholder="e.g. dxxxxxxx" /></label></div>
        <div className="field"><label>API Key<input name="cloudinaryApiKey" defaultValue={initial?.cloudinaryApiKey || ""} placeholder="Cloudinary API key" /></label></div>
        <div className="field"><label>API Secret<input name="cloudinaryApiSecret" type="password" defaultValue={initial?.cloudinaryApiSecret || ""} placeholder="Cloudinary API secret" /></label></div>
        <div className="field"><label>Folder<input name="cloudinaryFolder" defaultValue={initial?.cloudinaryFolder || "gear-glitch"} placeholder="gear-glitch" /></label></div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
        <input type="checkbox" name="backupImagesToDb" defaultChecked={initial?.backupImagesToDb || false} style={{ width: 18, height: 18 }} />
        <span>Enable database backup for uploaded images</span>
      </label>
      {msg && <p style={{ padding: "0.5rem 1rem", borderRadius: 8, background: msg.startsWith("Error") ? "var(--danger-light)" : "var(--success-light)", color: msg.startsWith("Error") ? "var(--danger-text)" : "var(--success-text)", margin: "0.75rem 0" }}>{msg}</p>}
      <RippleButton type="submit" loading={saving} style={{ marginTop: "0.75rem" }}>Save image storage</RippleButton>
    </form>
  );
}

const NAV_ORDER_STATIC = [
  { id: "repairs", label: "Repairs" },
  { id: "cart", label: "Cart" },
  { id: "wishlist", label: "Wishlist" },
  { id: "about", label: "About Us" },
  { id: "contact", label: "Contact" },
];

function AdminNavOrder() {
  const [items, setItems] = useState<{ id: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/settings/nav-order").then(r => r.json()).catch(() => ({ navOrder: null })),
      fetch("/api/categories").then(r => r.json()).catch(() => ({ categories: [] })),
    ]).then(([d, catData]) => {
      if (cancelled) return;
      const saved = Array.isArray(d?.navOrder) && d.navOrder.length > 0 ? d.navOrder : null;
      if (saved) {
        setItems(saved);
      } else {
        const cats = (catData?.categories || []).map((c: any) => ({ id: String(c.id), label: c.label }));
        setItems([...cats, ...NAV_ORDER_STATIC]);
      }
    }).catch((e) => console.warn("[admin] Failed to load nav order:", e?.message)).finally(() => setLoaded(true));
    return () => { cancelled = true; };
  }, []);

  function handleDragStart(idx: number, e: React.DragEvent) {
    e.dataTransfer.setData("text/plain", String(idx));
    (e.target as HTMLElement).style.opacity = "0.5";
  }
  function handleDragEnd(e: React.DragEvent) { (e.target as HTMLElement).style.opacity = "1"; }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(targetIdx: number, e: React.DragEvent) {
    e.preventDefault();
    const sourceIdx = Number(e.dataTransfer.getData("text/plain"));
    if (sourceIdx === targetIdx) return;
    const updated = [...items];
    const [moved] = updated.splice(sourceIdx, 1);
    updated.splice(targetIdx, 0, moved);
    setItems(updated);
  }

  async function save() {
    setSaving(true); setMsg("");
    try {
      await api("/api/settings/nav-order", { method: "PUT", body: JSON.stringify({ navOrder: items }) });
      setMsg("Nav order saved. Refresh to see changes.");
    } catch (err: any) { setMsg("Error: " + err.message); }
    finally { setSaving(false); }
  }

  if (!loaded) return <p>Loading...</p>;

  return (
    <div>
      <h3>Navigation Menu Order</h3>
      <p className="muted" style={{ marginBottom: "0.75rem" }}>Drag and drop to reorder the links shown in your storefront header navigation. Saving replaces the demo site's default menu with this store's own categories.</p>
      {msg && <p style={{ marginBottom: "0.5rem", color: msg.startsWith("Error") ? "var(--danger)" : "var(--success)" }}>{msg}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", maxWidth: 400 }}>
        {items.map((item, idx) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(idx, e)}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(idx, e)}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, cursor: "grab" }}
          >
            <span style={{ cursor: "grab", color: "var(--muted)" }}>&#9776;</span>
            <span style={{ fontWeight: 500 }}>{item.label}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>({item.id})</span>
          </div>
        ))}
      </div>
      <button className="btn" onClick={save} disabled={saving} style={{ marginTop: "0.75rem" }}>{saving ? "Saving..." : "Save order"}</button>
    </div>
  );
}

function AdminFooterConfig() {
  const [config, setConfig] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings/footer-config").then(r => r.json()).then(d => {
      setConfig(d.footerConfig || {
        columns: [
          { title: "Shop", links: [{ label: "PCs", href: "/pc" }, { label: "Laptops", href: "/laptops" }, { label: "Graphics Cards", href: "/graphics-cards" }, { label: "Servers", href: "/servers" }, { label: "Printers", href: "/printers" }] },
          { title: "Account", links: [{ label: "Cart", href: "/cart" }, { label: "Wishlist", href: "/wishlist" }, { label: "Dashboard", href: "/dashboard" }, { label: "Repairs", href: "/repairs" }] },
          { title: "Company", links: [{ label: "About Us", href: "/about" }, { label: "Contact", href: "/contact" }] },
        ]
      });
    }).catch((e) => console.warn("[admin] Failed to load footer config:", e?.message));
  }, []);

  function updateLink(colIdx: number, linkIdx: number, field: string, value: string) {
    const updated = { ...config, columns: config.columns.map((col: any, ci: number) => ci === colIdx ? { ...col, links: col.links.map((l: any, li: number) => li === linkIdx ? { ...l, [field]: value } : l) } : col) };
    setConfig(updated);
  }

  function addLink(colIdx: number) {
    const updated = { ...config, columns: config.columns.map((col: any, ci: number) => ci === colIdx ? { ...col, links: [...col.links, { label: "New Link", href: "/" }] } : col) };
    setConfig(updated);
  }

  function removeLink(colIdx: number, linkIdx: number) {
    const updated = { ...config, columns: config.columns.map((col: any, ci: number) => ci === colIdx ? { ...col, links: col.links.filter((_: any, li: number) => li !== linkIdx) } : col) };
    setConfig(updated);
  }

  function updateColumnTitle(colIdx: number, title: string) {
    const updated = { ...config, columns: config.columns.map((col: any, ci: number) => ci === colIdx ? { ...col, title } : col) };
    setConfig(updated);
  }

  async function save() {
    setSaving(true); setMsg("");
    try {
      await api("/api/settings/footer-config", { method: "PUT", body: JSON.stringify({ footerConfig: config }) });
      setMsg("Footer config saved. Refresh to see changes.");
    } catch (err: any) { setMsg("Error: " + err.message); }
    finally { setSaving(false); }
  }

  if (!config) return <p>Loading...</p>;

  return (
    <div>
      <h3>Footer Configuration</h3>
      <p className="muted" style={{ marginBottom: "0.75rem" }}>Customize footer columns and links.</p>
      {msg && <p style={{ marginBottom: "0.5rem", color: msg.startsWith("Error") ? "var(--danger)" : "var(--success)" }}>{msg}</p>}
      {config.columns.map((col: any, colIdx: number) => (
        <div key={colIdx} className="panel" style={{ marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <input value={col.title} onChange={(e) => updateColumnTitle(colIdx, e.target.value)} className="input" style={{ fontWeight: 600, width: 150 }} />
            <button className="btn btn-sm btn-ghost" style={{ color: "var(--danger)" }} onClick={() => {
              setConfig({ ...config, columns: config.columns.filter((_: any, ci: number) => ci !== colIdx) });
            }}>Remove column</button>
          </div>
          {col.links.map((link: any, linkIdx: number) => (
            <div key={linkIdx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.35rem", alignItems: "center" }}>
              <input value={link.label} onChange={(e) => updateLink(colIdx, linkIdx, "label", e.target.value)} className="input" style={{ width: 120, fontSize: "0.85rem" }} placeholder="Label" />
              <input value={link.href} onChange={(e) => updateLink(colIdx, linkIdx, "href", e.target.value)} className="input" style={{ flex: 1, fontSize: "0.85rem" }} placeholder="/page" />
              <button className="btn btn-sm btn-ghost" aria-label="Remove link" style={{ color: "var(--danger)" }} onClick={() => removeLink(colIdx, linkIdx)}>&times;</button>
            </div>
          ))}
          <button className="btn btn-sm btn-ghost" onClick={() => addLink(colIdx)} style={{ marginTop: "0.25rem" }}>+ Add link</button>
        </div>
      ))}
      <button className="btn btn-sm btn-ghost" onClick={() => setConfig({ ...config, columns: [...config.columns, { title: "New Section", links: [] }] })} style={{ marginBottom: "1rem" }}>+ Add column</button>
      <br />
      <button className="btn" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save footer"}</button>
    </div>
  );
}

function AdminSystem() {
  return (
    <>
      <h1>System</h1>
      <div className="panel" style={{ maxWidth: 500, marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Database Backup</h3>
        <p className="muted" style={{ fontSize: "0.85rem" }}>Download a full backup of the store database.</p>
        <RippleButton onClick={async () => {
          try {
            const token = getStaffToken();
            const res = await fetch("/api/admin/backup", { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
            if (!res.ok) throw new Error("Backup failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = `store-backup-${new Date().toISOString().slice(0, 10)}.db`; a.click();
            URL.revokeObjectURL(url);
          } catch (e: any) { toast("error", e.message); }
        }}>Download Backup</RippleButton>
      </div>
      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <AdminNavOrder />
      </div>
      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <AdminFooterConfig />
      </div>
    </>
  );
}

// ===================== SHOP SUBSCRIPTION =====================
function AdminShopSubscription() {
  const { data: subData, loading, error, refetch } = useFetch(() => api<{ plan: SubscriptionPlan; activatedAt: string | null }>("/api/shop/subscription"), []);
  const { data: plans } = useFetch(() => api<{ plans: SubscriptionPlan[] }>("/api/plans"), []);
  const { data: reqData, refetch: refetchReqs } = useFetch(() => api<{ requests: any[] }>("/api/shop/subscription/requests"), []);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function activatePlan() {
    if (!selectedPlan) return;
    setSaving(true); setMsg("");
    try { await api("/api/shop/subscription", { method: "PUT", body: JSON.stringify({ planId: selectedPlan }) }); setMsg(`Plan changed to ${selectedPlan}.`); refetch(); toast("success", `Plan changed to ${selectedPlan}.`); } catch (err: any) { setMsg("Error: " + err.message); toast("error", err.message); } finally { setSaving(false); }
  }

  async function handleRequest(id: number, status: string) {
    try { await api(`/api/shop/subscription/requests/${id}`, { method: "PUT", body: JSON.stringify({ status }) }); refetch(); refetchReqs(); toast("success", status === "approved" ? "Subscription request approved." : "Subscription request rejected."); } catch (err: any) { toast("error", err.message); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const currentPlan = subData?.plan;
  const activatedAt = subData?.activatedAt;
  const allPlans = plans?.plans || [];
  const requests = reqData?.requests || [];
  const pending = requests.filter((r: any) => r.status === "pending");

  const daysRemaining = activatedAt ? Math.max(0, 30 - Math.floor((Date.now() - new Date(activatedAt).getTime()) / (1000 * 60 * 60 * 24))) : null;

  return (
    <>
      <h1>Shop Subscription</h1>
      {msg && <div className="panel" style={{ marginBottom: "1rem", background: msg.startsWith("Error") ? "var(--danger-light)" : "var(--success-light)", color: msg.startsWith("Error") ? "var(--danger-text)" : "var(--success-text)" }}>{msg}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__value">{currentPlan ? escapeHtml(currentPlan.name) : "—"}</div>
          <div className="stat-card__label">Current Plan</div>
          {currentPlan && <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--primary)", margin: "0.5rem 0 0" }}>{formatPrice(currentPlan.price)}<span style={{ fontSize: "0.8rem", fontWeight: 400, opacity: 0.6 }}>/mo</span></p>}
        </div>
        <div className="stat-card">
          <div className="stat-card__value" style={{ color: daysRemaining !== null && daysRemaining <= 7 ? "var(--danger)" : undefined }}>
            {daysRemaining !== null ? `${daysRemaining} days` : "—"}
          </div>
          <div className="stat-card__label">Until Renewal</div>
          {daysRemaining !== null && daysRemaining <= 7 && <p style={{ fontSize: "0.8rem", color: "var(--danger)", margin: "0.25rem 0 0" }}>Renew soon!</p>}
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{pending.length}</div>
          <div className="stat-card__label">Pending Requests</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "1rem", maxWidth: 400 }}>
        <h3 style={{ marginTop: 0 }}>Activate Plan</h3>
        <div className="field"><label>Plan<select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}><option value="">Select...</option>{allPlans.map((p) => <option key={p.id} value={p.id}>{escapeHtml(p.name)}</option>)}</select></label></div>
        <RippleButton onClick={activatePlan} loading={saving} disabled={!selectedPlan}>Activate</RippleButton>
      </div>

      {requests.length > 0 && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Change Requests</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>#</th><th>Requested Plan</th><th>Status</th><th>Notes</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {requests.map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{escapeHtml(r.plan_name)}</td>
                    <td><span className="plan-status" style={{ background: r.status === "pending" ? "var(--warning-light)" : r.status === "approved" ? "var(--success-light)" : "var(--danger-light)", color: r.status === "pending" ? "var(--warning-text)" : r.status === "approved" ? "var(--success-text)" : "var(--danger-text)" }}>{r.status}</span></td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{escapeHtml(r.notes || "—")}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(r.created_at).toLocaleDateString("en-GB")}</td>
                    <td>{r.status === "pending" && <div style={{ display: "flex", gap: "0.35rem" }}><RippleButton size="small" style={{ background: "var(--success)", borderColor: "var(--success)" }} onClick={() => handleRequest(r.id, "approved")}>Approve</RippleButton><RippleButton size="small" variant="danger" onClick={() => handleRequest(r.id, "rejected")}>Reject</RippleButton></div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Invoices</h3>
        <p className="muted" style={{ fontSize: "0.85rem", margin: "0 0 1rem" }}>Subscription invoices for this store. Generate, view, mark paid, or email them from here.</p>
        <SubscriptionInvoices />
      </div>
    </>
  );
}

// ===================== SPEC TEMPLATES =====================
function AdminSpecTemplates() {
  const { data: catData } = useFetch(() => api<{ categories: any[] }>("/api/categories"), []);
  const { data: fieldsData, loading, error, refetch } = useFetch(() => api<{ fields: any[] }>("/api/spec-templates"), []);
  const [selectedCat, setSelectedCat] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ fieldKey: "", fieldLabel: "", fieldType: "text", options: "", required: false, sortOrder: 0 });

  const categories = catData?.categories || [];
  const allFields = fieldsData?.fields || [];
  const filteredFields = selectedCat ? allFields.filter((f: any) => f.category === selectedCat) : allFields;

  function resetForm() { setForm({ fieldKey: "", fieldLabel: "", fieldType: "text", options: "", required: false, sortOrder: 0 }); setEditing(null); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCat && !editing) return;
    const body = { ...form, category: selectedCat || editing.category, options: form.options.split("\n").filter(Boolean) };
    try {
      if (editing) { await api(`/api/spec-templates/${editing.id}`, { method: "PUT", body: JSON.stringify(body) }); }
      else { await api("/api/spec-templates", { method: "POST", body: JSON.stringify(body) }); }
      refetch(); resetForm();
      toast("success", editing ? "Spec field updated." : "Spec field added.");
    } catch (err: any) { toast("error", err.message); }
  }

  async function handleDelete(id: number) {
    if (!(await confirmDialog({ message: "Delete this spec field?", confirmLabel: "Delete", danger: true }))) return;
    try { await api(`/api/spec-templates/${id}`, { method: "DELETE" }); refetch(); toast("success", "Spec field deleted."); } catch (err: any) { toast("error", err.message); }
  }

  function startEdit(f: any) {
    setEditing(f); setSelectedCat(f.category);
    setForm({ fieldKey: f.fieldKey, fieldLabel: f.fieldLabel, fieldType: f.fieldType, options: (f.options || []).join("\n"), required: f.required, sortOrder: f.sortOrder });
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  return (
    <>
      <h1>Spec Templates</h1>
      <p className="muted">Define spec fields per category. Products will show these fields when that category is selected.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <div>
          <form onSubmit={handleSave} className="panel">
            <h3 style={{ marginTop: 0 }}>{editing ? "Edit Spec Field" : "Add Spec Field"}</h3>
            <div className="field">
              <label>Category <select value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)} required={!editing}>
                <option value="">-- Select --</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select></label>
            </div>
            <div className="field"><label>Field Key <input value={form.fieldKey} onChange={(e) => setForm({ ...form, fieldKey: e.target.value })} placeholder="e.g. cpu" required /></label></div>
            <div className="field"><label>Field Label <input value={form.fieldLabel} onChange={(e) => setForm({ ...form, fieldLabel: e.target.value })} placeholder="e.g. Processor" required /></label></div>
            <div className="field">
              <label>Field Type <select value={form.fieldType} onChange={(e) => setForm({ ...form, fieldType: e.target.value })}>
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="select">Dropdown</option>
                <option value="multiselect">Multi-select</option>
              </select></label>
            </div>
            {(form.fieldType === "select" || form.fieldType === "multiselect") && (
              <div className="field"><label>Options (one per line)<textarea value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} rows={4} /></label></div>
            )}
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <label><input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} /> Required</label>
              <label>Sort Order<input type="number" style={{ width: 60 }} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></label>
            </div>
            <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
              <RippleButton size="small" type="submit">{editing ? "Update" : "Add"}</RippleButton>
              {editing && <RippleButton size="small" variant="secondary" onClick={resetForm}>Cancel</RippleButton>}
            </div>
          </form>
        </div>
        <div>
          <div className="field"><label>Filter by category <select value={selectedCat} onChange={(e) => { setSelectedCat(e.target.value); resetForm(); }}>
            <option value="">All categories</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select></label></div>
          <div className="table-wrap" style={{ marginTop: "0.5rem" }}>
            <table className="data-table">
              <thead><tr><th>Category</th><th>Key</th><th>Label</th><th>Type</th><th>Required</th><th>Order</th><th></th></tr></thead>
              <tbody>
                {filteredFields.map((f: any) => (
                  <tr key={f.id}>
                    <td>{f.category}</td><td>{f.fieldKey}</td><td>{f.fieldLabel}</td><td>{f.fieldType}</td>
                    <td>{f.required ? "✓" : ""}</td><td>{f.sortOrder}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <RippleButton size="small" onClick={() => startEdit(f)}>Edit</RippleButton>
                      <RippleButton size="small" variant="danger" style={{ marginLeft: "0.25rem" }} onClick={() => handleDelete(f.id)}>Del</RippleButton>
                    </td>
                  </tr>
                ))}
                {filteredFields.length === 0 && <tr><td colSpan={7}><EmptyState icon="default" title="No spec fields" description="Define spec fields for product categories." /></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ===================== QUOTATIONS =====================
function AdminQuotations() {
  return <QuotesPage />;
}

// ===================== REPORTS =====================
function AdminReports() {
  const hasVisitorAnalytics = useFeature("Visitor analytics");
  const [tab, setTab] = useState<"sales" | "employee-sales" | "tech-performance" | "purchases" | "stock" | "visitors">("sales");

  return (
    <>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <RippleButton size="small" variant={tab === "sales" ? "primary" : "ghost"} onClick={() => setTab("sales")}>Sales Report</RippleButton>
        <RippleButton size="small" variant={tab === "employee-sales" ? "primary" : "ghost"} onClick={() => setTab("employee-sales")}>Employee Sales</RippleButton>
        <RippleButton size="small" variant={tab === "tech-performance" ? "primary" : "ghost"} onClick={() => setTab("tech-performance")}>Technician Performance</RippleButton>
        <RippleButton size="small" variant={tab === "purchases" ? "primary" : "ghost"} onClick={() => setTab("purchases")}>Purchases</RippleButton>
        <RippleButton size="small" variant={tab === "stock" ? "primary" : "ghost"} onClick={() => setTab("stock")}>Stock Summary</RippleButton>
        {hasVisitorAnalytics && <RippleButton size="small" variant={tab === "visitors" ? "primary" : "ghost"} onClick={() => setTab("visitors")}>Visitors</RippleButton>}
      </div>
      {tab === "sales" && <AdminSalesReport />}
      {tab === "employee-sales" && <AdminEmployeeSales />}
      {tab === "tech-performance" && <AdminTechPerformance />}
      {tab === "purchases" && <AdminPurchasesReport />}
      {tab === "stock" && <AdminStockSummary />}
      {tab === "visitors" && <AdminVisitorsReport />}
    </>
  );
}

function csvCell(val: any): string {
  const s = String(val ?? "");
  if (/^[=+\-@]/.test(s)) return `"'${s}"`;
  return `"${s.replace(/"/g, '""')}"`;
}

function exportExcel(report: any, from: string, to: string) {
  const rows: string[] = [];
  rows.push("Sales Report," + from + " to " + to);
  rows.push("");
  rows.push("Metric,Value");
  rows.push("Total Orders," + report.totalOrders);
  rows.push("Total Revenue," + report.totalRevenue);
  rows.push("Paid Invoices," + report.paidInvoices);
  rows.push("Invoice Revenue," + report.invoiceRevenue);
  if (report.branchBreakdown) {
    rows.push("");
    rows.push("Branch,Orders,Revenue");
    for (const b of report.branchBreakdown) {
      rows.push(`${csvCell(b.branchName)},${b.orders},${b.revenue}`);
    }
  }
  if (report.topProducts?.length > 0) {
    rows.push("");
    rows.push("Product,Sold,Revenue");
    for (const p of report.topProducts) {
      rows.push(`${csvCell(p.name)},${p.totalSold},${p.revenue}`);
    }
  }
  if (report.orders?.length > 0) {
    rows.push("");
    rows.push("Order ID,Customer,Total,Status,Date");
    for (const o of report.orders) {
      rows.push(`${o.id},${csvCell(o.customer_name)},${(o.subtotal || 0) + (o.shipping_fee || 0)},${csvCell(o.status)},${csvCell(o.created_at)}`);
    }
  }
  const csv = rows.join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `sales-report-${from}-to-${to}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function exportPdf(report: any, from: string, to: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  const e = escapeHtml;
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sales Report</title>
<style>
  body { font-family: Arial, sans-serif; padding: 2rem; }
  h1 { margin-bottom: 0.25rem; }
  .meta { color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
  th, td { border: 1px solid var(--border); padding: 0.5rem 0.75rem; text-align: left; font-size: 0.85rem; }
  th { background: var(--surface-hover); font-weight: 600; }
  .stats { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
  .stat-card { border: 1px solid var(--border); border-radius: 8px; padding: 1rem; text-align: center; flex: 1; }
  .stat-value { font-size: 1.5rem; font-weight: 700; }
  .stat-label { font-size: 0.8rem; color: var(--text-secondary); }
  @media print { body { padding: 0.5in; } }
</style></head><body>
<h1>Sales Report</h1>
<p class="meta">${e(from)} to ${e(to)}${report.branchBreakdown ? " | Combined" : ""}</p>
<div class="stats">
  <div class="stat-card"><div class="stat-value">${report.totalOrders}</div><div class="stat-label">Orders</div></div>
  <div class="stat-card"><div class="stat-value">${report.totalRevenue.toLocaleString()}</div><div class="stat-label">Revenue</div></div>
  <div class="stat-card"><div class="stat-value">${report.paidInvoices}</div><div class="stat-label">Paid Invoices</div></div>
  <div class="stat-card"><div class="stat-value">${report.invoiceRevenue.toLocaleString()}</div><div class="stat-label">Invoice Revenue</div></div>
</div>`;
  if (report.branchBreakdown) {
    html += `<h3>Per-Branch Breakdown</h3><table><thead><tr><th>Branch</th><th>Orders</th><th>Revenue</th></tr></thead><tbody>`;
    for (const b of report.branchBreakdown) html += `<tr><td>${e(b.branchName)}</td><td>${b.orders}</td><td>${b.revenue.toLocaleString()}</td></tr>`;
    html += `</tbody></table>`;
  }
  if (report.topProducts?.length > 0) {
    html += `<h3>Top Products</h3><table><thead><tr><th>Product</th><th>Sold</th><th>Revenue</th></tr></thead><tbody>`;
    for (const p of report.topProducts) html += `<tr><td>${e(p.name)}</td><td>${p.totalSold}</td><td>${p.revenue.toLocaleString()}</td></tr>`;
    html += `</tbody></table>`;
  }
  if (report.orders?.length > 0) {
    html += `<h3>Orders in Period</h3><table><thead><tr><th>#</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody>`;
    for (const o of report.orders) html += `<tr><td>${e(String(o.id))}</td><td>${e(o.customer_name || "—")}</td><td>${((o.subtotal || 0) + (o.shipping_fee || 0)).toLocaleString()}</td><td>${e(o.status)}</td><td>${e(o.created_at)}</td></tr>`;
    html += `</tbody></table>`;
  }
  html += `<p style="text-align:center;color:#4b5563;font-size:0.8rem;margin-top:2rem">Generated on ${new Date().toLocaleDateString("en-GB")}</p>`;
  html += `</body></html>`;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

function AdminCoupons() {
  const { data, loading, error, refetch } = useFetch(() => api<{ coupons: any[] }>("/api/admin/coupons"), []);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const coupons = data?.coupons || [];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg("");
    const fd = new FormData(e.target as HTMLFormElement);
    const body: any = { code: fd.get("code"), type: fd.get("type"), value: fd.get("value"), min_order_amount: fd.get("min_order_amount"), max_uses: fd.get("max_uses"), expires_at: fd.get("expires_at") || null, is_active: fd.get("is_active") === "on" };
    try {
      if (editing) {
        await api(`/api/admin/coupons/${editing.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await api("/api/admin/coupons", { method: "POST", body: JSON.stringify(body) });
      }
      setShowForm(false); setEditing(null); refetch();
      toast("success", editing ? "Coupon updated." : "Coupon created.");
    } catch (e: any) { setMsg(e.message); toast("error", e.message); }
    finally { setSaving(false); }
  }

  async function deleteC(id: number) {
    if (!(await confirmDialog({ message: "Delete this coupon?", confirmLabel: "Delete", danger: true }))) return;
    try { await api(`/api/admin/coupons/${id}`, { method: "DELETE" }); refetch(); toast("success", "Coupon deleted."); } catch { toast("error", "Delete failed"); }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Coupons</h1>
        <RippleButton size="small" onClick={() => { setEditing(null); setShowForm(!showForm); setMsg(""); }}>{showForm ? "Cancel" : "+ New Coupon"}</RippleButton>
      </div>
      {showForm && (
        <form className="panel" onSubmit={save} style={{ maxWidth: 500, marginBottom: "1rem" }}>
          {msg && <ErrorMsg msg={msg} />}
          <div className="field"><label>Code<input name="code" defaultValue={editing?.code || ""} required pattern="[A-Za-z0-9_-]+" title="Letters, numbers, hyphen, underscore" /></label></div>
          <div className="field"><label>Type<select name="type" defaultValue={editing?.type || "percentage"}>
            <option value="percentage">Percentage</option><option value="fixed">Fixed Amount</option>
          </select></label></div>
          <div className="field"><label>Value<input name="value" type="number" step="any" defaultValue={editing?.value || ""} required /></label></div>
          <div className="field"><label>Min Order Amount<input name="min_order_amount" type="number" step="any" defaultValue={editing?.min_order_amount || "0"} /></label></div>
          <div className="field"><label>Max Uses (0 = unlimited)<input name="max_uses" type="number" defaultValue={editing?.max_uses || "0"} /></label></div>
          <div className="field"><label>Expires At<input name="expires_at" type="date" defaultValue={editing?.expires_at?.slice(0, 10) || ""} /></label></div>
          <div className="field"><label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><input name="is_active" type="checkbox" defaultChecked={editing ? editing.is_active : true} /> Active</label></div>
          <RippleButton type="submit" loading={saving}>Save</RippleButton>
        </form>
      )}
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min Order</th><th>Uses</th><th>Expires</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id}>
                <td><code>{escapeHtml(c.code)}</code></td>
                <td>{c.type}</td>
                <td>{c.type === "percentage" ? `${c.value}%` : formatPrice(c.value)}</td>
                <td>{formatPrice(c.min_order_amount)}</td>
                <td>{c.used_count}/{c.max_uses || "∞"}</td>
                <td>{c.expires_at ? new Date(c.expires_at).toLocaleDateString("en-GB") : "—"}</td>
                <td>{c.is_active ? "Yes" : "No"}</td>
                <td style={{ display: "flex", gap: "0.35rem" }}>
                  <RippleButton size="small" variant="ghost" onClick={() => { setEditing(c); setShowForm(true); setMsg(""); }}>Edit</RippleButton>
                  <RippleButton size="small" variant="danger" onClick={() => deleteC(c.id)}>Delete</RippleButton>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && <tr><td colSpan={8}><EmptyState icon="products" title="No coupons yet" description="Create discount coupons to attract customers." /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AdminGiftCards() {
  const { data, loading, error, refetch } = useFetch(() => api<{ giftCards: any[] }>("/api/admin/gift-cards"), []);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [redemptions, setRedemptions] = useState<any[] | null>(null);
  const [redemptionCard, setRedemptionCard] = useState<any | null>(null);

  const cards = data?.giftCards || [];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg("");
    const fd = new FormData(e.target as HTMLFormElement);
    const body: any = {
      code: fd.get("code"),
      initialValue: Number(fd.get("initialValue")) || 0,
      expiresAt: fd.get("expires_at") || null,
      notes: fd.get("notes") || "",
    };
    try {
      await api("/api/admin/gift-cards", { method: "POST", body: JSON.stringify(body) });
      setShowForm(false); refetch();
      toast("success", "Gift card created.");
    } catch (e: any) { setMsg(e.message); toast("error", e.message); }
    finally { setSaving(false); }
  }

  async function toggleActive(card: any) {
    try {
      await api(`/api/admin/gift-cards/${card.id}`, { method: "PUT", body: JSON.stringify({ is_active: card.is_active !== 1 }) });
      refetch();
    } catch (e: any) { toast("error", e.message); }
  }

  async function showRedemptions(card: any) {
    try {
      const r = await api<{ redemptions: any[] }>(`/api/admin/gift-cards/${card.id}/redemptions`);
      setRedemptions(r.redemptions || []);
      setRedemptionCard(card);
    } catch { setRedemptions([]); setRedemptionCard(card); }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Gift Cards</h1>
        <RippleButton size="small" onClick={() => { setShowForm(!showForm); setMsg(""); }}>{showForm ? "Cancel" : "+ New Gift Card"}</RippleButton>
      </div>
      {showForm && (
        <form className="panel" onSubmit={save} style={{ maxWidth: 500, marginBottom: "1rem" }}>
          {msg && <ErrorMsg msg={msg} />}
          <div className="field"><label>Code (blank = auto-generate)<input name="code" placeholder="GC-XXXX-XXXX-XXXX" /></label></div>
          <div className="field"><label>Value (KES)<input name="initialValue" type="number" step="any" min="1" required /></label></div>
          <div className="field"><label>Expires At<input name="expires_at" type="date" /></label></div>
          <div className="field"><label>Notes<input name="notes" /></label></div>
          <RippleButton type="submit" loading={saving}>Create</RippleButton>
        </form>
      )}
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {redemptionCard && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <h3 style={{ margin: 0 }}>Redemptions — {escapeHtml(redemptionCard.code)}</h3>
            <RippleButton size="small" variant="ghost" onClick={() => { setRedemptionCard(null); setRedemptions(null); }}>Close</RippleButton>
          </div>
          {redemptions && redemptions.length === 0 ? <p className="muted" style={{ margin: 0 }}>No redemptions yet.</p> : (
            <table className="data-table">
              <thead><tr><th>Order</th><th>Amount</th><th>Date</th></tr></thead>
              <tbody>
                {(redemptions || []).map((r) => (
                  <tr key={r.id}><td>#{r.order_id}</td><td>{formatPrice(r.amount)}</td><td style={{ whiteSpace: "nowrap" }}>{new Date(r.created_at).toLocaleString("en-GB")}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Code</th><th>Initial Value</th><th>Balance</th><th>Expires</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id}>
                <td><code>{escapeHtml(c.code)}</code></td>
                <td>{formatPrice(c.initial_value)}</td>
                <td>{formatPrice(c.balance)}</td>
                <td>{c.expires_at ? new Date(c.expires_at).toLocaleDateString("en-GB") : "Never"}</td>
                <td>{c.is_active ? "Yes" : "No"}</td>
                <td style={{ display: "flex", gap: "0.35rem" }}>
                  <RippleButton size="small" variant="ghost" onClick={() => showRedemptions(c)}>Redemptions</RippleButton>
                  <RippleButton size="small" variant={c.is_active ? "danger" : "primary"} onClick={() => toggleActive(c)}>{c.is_active ? "Deactivate" : "Activate"}</RippleButton>
                </td>
              </tr>
            ))}
            {cards.length === 0 && <tr><td colSpan={6}><EmptyState icon="products" title="No gift cards yet" description="Issue gift cards your customers can redeem at checkout." /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AdminCampaigns() {
  const { data, loading, error, refetch } = useFetch(() => api<{ campaigns: any[] }>("/api/admin/campaigns"), []);
  const { data: products } = useFetch(() => api<{ products: any[] }>("/api/products?includeHidden=1"), []);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const campaigns = data?.campaigns || [];
  const productList = products?.products || [];

  function openForm(c?: any) {
    setEditing(c || null);
    setSelected(c ? (() => { try { return JSON.parse(c.product_ids || "[]"); } catch { return []; } })() : []);
    setMsg("");
    setShowForm(true);
  }

  function toggleProduct(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg("");
    const fd = new FormData(e.target as HTMLFormElement);
    const body: any = {
      title: fd.get("title"),
      slug: fd.get("slug") || undefined,
      subtitle: fd.get("subtitle") || "",
      description: fd.get("description") || "",
      heroImage: fd.get("hero_image") || "",
      bannerColor: fd.get("banner_color") || "#111827",
      productIds: selected,
      isActive: fd.get("is_active") === "on",
    };
    try {
      if (editing) {
        await api(`/api/admin/campaigns/${editing.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await api("/api/admin/campaigns", { method: "POST", body: JSON.stringify(body) });
      }
      setShowForm(false); setEditing(null); refetch();
      toast("success", editing ? "Campaign updated." : "Campaign created.");
    } catch (e: any) { setMsg(e.message); toast("error", e.message); }
    finally { setSaving(false); }
  }

  async function del(id: number) {
    if (!(await confirmDialog({ message: "Delete this campaign? The campaign page will be removed.", confirmLabel: "Delete", danger: true }))) return;
    try { await api(`/api/admin/campaigns/${id}`, { method: "DELETE" }); refetch(); toast("success", "Campaign deleted."); } catch { toast("error", "Delete failed"); }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Campaign Pages</h1>
        <RippleButton size="small" onClick={() => showForm ? setShowForm(false) : openForm()}>{showForm ? "Cancel" : "+ New Campaign"}</RippleButton>
      </div>
      {showForm && (
        <form className="panel" onSubmit={save} style={{ marginBottom: "1rem" }}>
          {msg && <ErrorMsg msg={msg} />}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="field"><label>Title<input name="title" defaultValue={editing?.title || ""} required /></label></div>
            <div className="field"><label>Slug (page URL)<input name="slug" defaultValue={editing?.slug || ""} placeholder="summer-sale" /></label></div>
            <div className="field"><label>Subtitle<input name="subtitle" defaultValue={editing?.subtitle || ""} /></label></div>
            <div className="field"><label>Banner Color<input name="banner_color" type="color" defaultValue={editing?.banner_color || "#111827"} /></label></div>
            <div className="field" style={{ gridColumn: "1 / -1" }}><label>Hero Image URL<input name="hero_image" defaultValue={editing?.hero_image || ""} /></label></div>
          </div>
          <div className="field"><label>Description<textarea name="description" rows={3} defaultValue={editing?.description || ""} /></label></div>
          <div className="field">
            <label>Featured Products</label>
            <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem" }}>
              {productList.map((p) => (
                <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0", fontSize: "0.9rem" }}>
                  <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                  {escapeHtml(p.name)}
                </label>
              ))}
              {productList.length === 0 && <span className="muted">No products found.</span>}
            </div>
          </div>
          <div className="field"><label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><input name="is_active" type="checkbox" defaultChecked={editing ? editing.is_active : true} /> Active</label></div>
          <RippleButton type="submit" loading={saving}>Save</RippleButton>
          {editing && <span className="muted" style={{ marginLeft: "0.75rem" }}>Preview: /campaign/{escapeHtml(editing.slug)}</span>}
        </form>
      )}
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Title</th><th>Slug</th><th>Products</th><th>Active</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {campaigns.map((c) => {
              let count = 0;
              try { count = (JSON.parse(c.product_ids || "[]") || []).length; } catch {}
              return (
                <tr key={c.id}>
                  <td>{escapeHtml(c.title)}</td>
                  <td><code>/campaign/{escapeHtml(c.slug)}</code></td>
                  <td>{count}</td>
                  <td>{c.is_active ? "Yes" : "No"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(c.created_at).toLocaleDateString("en-GB")}</td>
                  <td style={{ display: "flex", gap: "0.35rem" }}>
                    <RippleButton size="small" variant="ghost" onClick={() => openForm(c)}>Edit</RippleButton>
                    <RippleButton size="small" variant="danger" onClick={() => del(c.id)}>Delete</RippleButton>
                  </td>
                </tr>
              );
            })}
            {campaigns.length === 0 && <tr><td colSpan={6}><EmptyState icon="products" title="No campaigns yet" description="Create landing pages to promote product collections." /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AdminAbandonedCarts() {
  const [data, setData] = useState<{ carts: any[]; reminders: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hours, setHours] = useState(24);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ id: number; text: string; error?: boolean } | null>(null);

  const carts = data?.carts || [];
  const reminders = data?.reminders || [];

  function reload() {
    setLoading(true); setError("");
    api<{ carts: any[]; reminders: any[] }>(`/api/admin/abandoned-carts?hours=${hours}`)
      .then(setData).catch((e: any) => setError(e.message)).finally(() => setLoading(false));
  }

  useEffect(() => { reload(); }, [hours]);

  async function sendReminder(cart: any) {
    setSendingId(cart.customer_id);
    setMsg(null);
    try {
      await api("/api/admin/abandoned-carts/send-reminder", {
        method: "POST",
        body: JSON.stringify({ customerId: cart.customer_id, cartTotal: cart.cart_total, channel: "email" }),
      });
      setMsg({ id: cart.customer_id, text: "Reminder sent." });
      reload();
    } catch (e: any) {
      setMsg({ id: cart.customer_id, text: e.message || "Failed to send.", error: true });
    } finally { setSendingId(null); }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ margin: 0 }}>Abandoned Carts</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <label className="muted" style={{ fontSize: "0.85rem" }}>Inactive for:
            <select value={hours} onChange={(e) => setHours(Number(e.target.value))} style={{ marginLeft: "0.4rem" }}>
              <option value={6}>6 hours</option>
              <option value={24}>24 hours</option>
              <option value={72}>3 days</option>
              <option value={168}>7 days</option>
            </select>
          </label>
          <RippleButton size="small" onClick={reload}>Refresh</RippleButton>
        </div>
      </div>
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      <div className="table-wrap" style={{ marginBottom: "1.5rem" }}>
        <table className="data-table">
          <thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Cart Value</th><th>Items</th><th>Last Activity</th><th></th></tr></thead>
          <tbody>
            {carts.map((c) => (
              <tr key={c.customer_id}>
                <td>{escapeHtml(c.name || "—")}</td>
                <td>{escapeHtml(c.email || "—")}</td>
                <td>{escapeHtml(c.phone || "—")}</td>
                <td>{formatPrice(c.cart_total)}</td>
                <td>{c.item_count}</td>
                <td style={{ whiteSpace: "nowrap" }}>{new Date(c.last_activity).toLocaleString("en-GB")}</td>
                <td>
                  {msg && msg.id === c.customer_id && <span style={{ fontSize: "0.8rem", color: msg.error ? "var(--danger)" : "var(--success)", marginRight: "0.5rem" }}>{msg.text}</span>}
                  <RippleButton size="small" onClick={() => sendReminder(c)} loading={sendingId === c.customer_id}>Send reminder</RippleButton>
                </td>
              </tr>
            ))}
            {carts.length === 0 && <tr><td colSpan={7}><EmptyState icon="cart" title="No abandoned carts" description="Carts that have been inactive for the selected period will appear here." /></td></tr>}
          </tbody>
        </table>
      </div>
      {reminders.length > 0 && (
        <>
          <h2 style={{ margin: "0 0 0.75rem" }}>Reminder History</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Customer</th><th>Cart Value</th><th>Channel</th><th>Date</th></tr></thead>
              <tbody>
                {reminders.map((r) => (
                  <tr key={r.id}>
                    <td>{escapeHtml(r.customer_name || "—")}</td>
                    <td>{formatPrice(r.cart_total)}</td>
                    <td>{r.channel}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(r.created_at).toLocaleString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function AdminSuppliers() {
  const { data, loading, error, refetch } = useFetch(() => api<{ suppliers: any[] }>("/api/admin/suppliers"), []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const suppliers = data?.suppliers || [];

  async function del(id: number) {
    if (!(await confirmDialog({ message: "Delete supplier?", confirmLabel: "Delete", danger: true }))) return;
    try { await api(`/api/admin/suppliers/${id}`, { method: "DELETE" }); refetch(); toast("success", "Supplier deleted."); } catch { toast("error", "Delete failed"); }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Suppliers</h1>
        <a href="/suppliers/new" className="btn btn-primary btn-sm">+ Add Supplier</a>
      </div>
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      <div className="table-wrap">
        <DataTable
          ariaLabel="Suppliers"
          columns={[
            { key: "name", label: "Name", sortable: true, value: (s) => s.name, render: (s) => escapeHtml(s.name) },
            { key: "contact", label: "Contact", value: (s) => s.contact_name || "", render: (s) => escapeHtml(s.contact_name || "—") },
            { key: "email", label: "Email", value: (s) => s.email || "", render: (s) => escapeHtml(s.email || "—") },
            { key: "phone", label: "Phone", value: (s) => s.phone || "", render: (s) => escapeHtml(s.phone || "—") },
            { key: "active", label: "Active", value: (s) => (s.is_active ? "Yes" : "No"), render: (s) => (s.is_active ? "Yes" : "No") },
            {
              key: "actions",
              label: "",
              render: (s) => (
                <span style={{ display: "flex", gap: "0.35rem" }}>
                  <a href={`/suppliers/${s.id}`} className="btn btn-sm btn-ghost">Edit</a>
                  <RippleButton size="small" variant="danger" onClick={() => del(s.id)}>Delete</RippleButton>
                </span>
              ),
            },
          ]}
          rows={suppliers}
          rowKey={(s) => s.id}
          empty={<EmptyState icon="products" title="No suppliers yet" />}
        />
      </div>
    </>
  );
}

function SalesTrendsChart({ from, to, branchId }: { from: string; to: string; branchId: string }) {
  const [trends, setTrends] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    let url = `/api/reports/sales/trends?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    if (branchId) url += `&branch_id=${encodeURIComponent(branchId)}`;
    api<{ trends: any[] }>(url).then(d => setTrends(d.trends)).catch(() => setTrends([])).finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="skeleton" style={{ height: 200 }} />;
  if (!trends || trends.length === 0) return <p className="muted">No trend data for this period.</p>;

  const maxRevenue = Math.max(...trends.map(t => t.revenue), 1);
  const barWidth = Math.max(12, Math.min(60, 600 / trends.length));
  const chartW = Math.max(300, trends.length * (barWidth + 4));
  const chartH = 200;

  return (
    <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
      <h3>Daily Revenue Trend</h3>
      <svg width={chartW} height={chartH} style={{ display: "block" }}>
        {trends.map((t, i) => {
          const barH = (t.revenue / maxRevenue) * (chartH - 20);
          const x = i * (barWidth + 4);
          const y = chartH - 10 - barH;
          return (
            <g key={t.day}>
              <rect x={x} y={y} width={barWidth} height={barH} fill="var(--primary)" rx={2}>
                <title>{t.day}: {formatPrice(t.revenue)} ({t.orders} orders)</title>
              </rect>
              {trends.length <= 14 && <text x={x + barWidth / 2} y={chartH - 2} textAnchor="middle" fontSize={9} fill="var(--text-secondary)">{t.day.slice(5)}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AdminVisitorsReport() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const [branchId, setBranchId] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { data: branches } = useFetch(() => api<{ branches: Branch[] }>("/api/admin/branches"), []);

  useEffect(() => { fetchStats(); }, []);

  function fetchStats() {
    setLoading(true); setError("");
    let url = `/api/reports/visitors?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    if (branchId) url += `&branch_id=${encodeURIComponent(branchId)}`;
    api<any>(url).then(setStats).catch((e: any) => setError(e.message)).finally(() => setLoading(false));
  }

  return (
    <>
      <h1>Visitor Analytics</h1>
      <div className="panel" style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "end", flexWrap: "wrap" }}>
        <div className="field" style={{ margin: 0 }}><label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label></div>
        <div className="field" style={{ margin: 0 }}><label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label></div>
        <div className="field" style={{ margin: 0 }}>
          <label>Branch
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">All Branches</option>
              {(branches?.branches || []).filter((b: any) => b.isActive).map((b: any) => (
                <option key={b.id} value={b.id}>{escapeHtml(b.name)}</option>
              ))}
            </select>
          </label>
        </div>
        <RippleButton onClick={fetchStats} loading={loading}>Generate</RippleButton>
      </div>
      {error && <ErrorMsg msg={error} />}
      {stats && (
        <>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-card__value">{stats.totalVisits}</div><div className="stat-card__label">Total Visits</div></div>
            <div className="stat-card"><div className="stat-card__value">{stats.uniqueSessions}</div><div className="stat-card__label">Unique Sessions</div></div>
          </div>
          {stats.dailyTrend?.length > 0 && (
            <VisitorTrendChart data={stats.dailyTrend} />
          )}
          {stats.topPages?.length > 0 && (
            <>
              <h3>Top Pages</h3>
              <div className="table-wrap" style={{ marginBottom: "1rem" }}>
                <table className="data-table">
                  <thead><tr><th>Page</th><th>Visits</th></tr></thead>
                  <tbody>
                    {stats.topPages.map((p: any, i: number) => (
                      <tr key={i}><td>{escapeHtml(p.path)}</td><td>{p.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {stats.topReferrers?.length > 0 && (
            <>
              <h3>Top Referrers</h3>
              <div className="table-wrap" style={{ marginBottom: "1rem" }}>
                <table className="data-table">
                  <thead><tr><th>Referrer</th><th>Visits</th></tr></thead>
                  <tbody>
                    {stats.topReferrers.map((r: any, i: number) => (
                      <tr key={i}><td>{escapeHtml(r.referrer)}</td><td>{r.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {stats.deviceBreakdown?.length > 0 && (
            <>
              <h3>Device Breakdown</h3>
              <div className="table-wrap" style={{ marginBottom: "1rem" }}>
                <table className="data-table">
                  <thead><tr><th>Device</th><th>Visits</th></tr></thead>
                  <tbody>
                    {stats.deviceBreakdown.map((d: any, i: number) => (
                      <tr key={i}><td>{escapeHtml(d.device_type)}</td><td>{d.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

function VisitorTrendChart({ data }: { data: any[] }) {
  const maxVal = Math.max(...data.map((d: any) => d.visits), 1);
  const barWidth = Math.max(12, Math.min(60, 600 / data.length));
  const chartW = Math.max(300, data.length * (barWidth + 4));
  const chartH = 200;

  return (
    <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
      <h3>Daily Visits Trend</h3>
      <svg width={chartW} height={chartH} style={{ display: "block" }}>
        {data.map((d: any, i: number) => {
          const barH = (d.visits / maxVal) * (chartH - 20);
          const x = i * (barWidth + 4);
          const y = chartH - 10 - barH;
          return (
            <g key={d.day}>
              <rect x={x} y={y} width={barWidth} height={barH} fill="var(--primary)" rx={2}>
                <title>{d.day}: {d.visits} visits, {d.sessions} sessions</title>
              </rect>
              {data.length <= 14 && <text x={x + barWidth / 2} y={chartH - 2} textAnchor="middle" fontSize={9} fill="var(--text-secondary)">{d.day.slice(5)}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AdminSalesReport() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const [branchId, setBranchId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { data: branches } = useFetch(() => api<{ branches: Branch[] }>("/api/admin/branches"), []);
  const { data: groups } = useFetch(() => api<{ groups: any[] }>("/api/admin/groups"), []);

  useEffect(() => { fetchReport(); }, []);

  function fetchReport() {
    setLoading(true); setError("");
    let url = `/api/reports/sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    if (branchId) url += `&branch_id=${encodeURIComponent(branchId)}`;
    if (groupId) url += `&group_id=${encodeURIComponent(groupId)}`;
    api<any>(url)
      .then(setReport).catch((e: any) => setError(e.message)).finally(() => setLoading(false));
  }

  return (
    <>
      <h1>Sales Report</h1>
      <div className="panel" style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "end", flexWrap: "wrap" }}>
        <div className="field" style={{ margin: 0 }}><label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label></div>
        <div className="field" style={{ margin: 0 }}><label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label></div>
        <div className="field" style={{ margin: 0 }}>
          <label>Branch
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">All Branches</option>
              {(branches?.branches || []).filter((b) => b.isActive).map((b) => (
                <option key={b.id} value={b.id}>{escapeHtml(b.name)}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Group
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">All Groups</option>
              {(groups?.groups || []).map((g) => (
                <option key={g.id} value={g.id}>{escapeHtml(g.name)}</option>
              ))}
            </select>
          </label>
        </div>
        <RippleButton onClick={fetchReport} loading={loading}>Generate</RippleButton>
        {report && (
          <>
            <RippleButton size="small" variant="secondary" onClick={() => exportExcel(report, from, to)}>Export Excel</RippleButton>
            <RippleButton size="small" variant="secondary" onClick={() => exportPdf(report, from, to)}>Export PDF</RippleButton>
          </>
        )}
      </div>
      {error && <ErrorMsg msg={error} />}
      {report && (
        <>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-card__value">{report.totalOrders}</div><div className="stat-card__label">Orders</div></div>
            <div className="stat-card"><div className="stat-card__value">{formatPrice(report.totalRevenue)}</div><div className="stat-card__label">Revenue</div></div>
            <div className="stat-card"><div className="stat-card__value">{report.paidInvoices}</div><div className="stat-card__label">Paid Invoices</div></div>
            <div className="stat-card"><div className="stat-card__value">{formatPrice(report.invoiceRevenue)}</div><div className="stat-card__label">Invoice Revenue</div></div>
          </div>

          <SalesTrendsChart from={from} to={to} branchId={branchId} />

          {report.channels && report.channels.length > 0 && (
            <>
              <h3>Sales by Channel</h3>
              <div className="table-wrap" style={{ marginBottom: "1rem" }}>
                <table className="data-table">
                  <thead><tr><th>Channel</th><th>Orders</th><th>Revenue</th><th>Share</th></tr></thead>
                  <tbody>
                    {report.channels.map((c: any, i: number) => {
                      const share = report.totalRevenue > 0 ? ((c.revenue / report.totalRevenue) * 100).toFixed(1) : "0";
                      return (
                        <tr key={i}>
                          <td style={{ textTransform: "capitalize" }}>{escapeHtml(c.channel)}</td>
                          <td>{c.orders}</td>
                          <td>{formatPrice(c.revenue)}</td>
                          <td>{share}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {report.topProducts?.length > 0 && (
            <>
              <h3>Top Products</h3>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Product</th><th>Sold</th><th>Revenue</th></tr></thead>
                  <tbody>
                    {report.topProducts.map((p: any) => (
                      <tr key={p.productId}><td>{escapeHtml(p.name)}</td><td>{p.totalSold}</td><td>{formatPrice(p.revenue)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {report.orders?.length > 0 && (
            <>
              <h3>Orders in Period</h3>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>#</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {report.orders.map((o: any) => (
                      <tr key={o.id}><td>{o.id}</td><td>{escapeHtml(o.customer_name || "—")}</td><td>{formatPrice((o.subtotal || 0) + (o.shipping_fee || 0))}</td><td><span className="plan-status">{o.status}</span></td><td style={{ whiteSpace: "nowrap" }}>{new Date(o.created_at).toLocaleDateString("en-GB")}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

// ===================== EMPLOYEE SALES REPORT =====================
function AdminEmployeeSales() {
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function fetchReport() {
    setLoading(true); setError("");
    api<any>(`/api/reports/employee-sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(setData).catch((e: any) => setError(e.message)).finally(() => setLoading(false));
  }

  useEffect(() => { fetchReport(); }, []);

  const rows = data?.employees || [];
  const totalOrders = rows.reduce((s: number, r: any) => s + (Number(r.totalOrders) || 0), 0);
  const totalRevenue = rows.reduce((s: number, r: any) => s + (Number(r.totalRevenue) || 0), 0);

  return (
    <>
      <h1>Employee Sales</h1>
      <div className="panel" style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "end", flexWrap: "wrap" }}>
        <div className="field" style={{ margin: 0 }}><label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label></div>
        <div className="field" style={{ margin: 0 }}><label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label></div>
        <RippleButton onClick={fetchReport} loading={loading}>Generate</RippleButton>
      </div>
      {error && <ErrorMsg msg={error} />}
      {data && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Staff</th><th>Orders</th><th>Revenue</th></tr></thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.staffId}>
                  <td>{escapeHtml(r.staffName || "—")}</td>
                  <td>{r.totalOrders}</td>
                  <td>{formatPrice(r.totalRevenue)}</td>
                </tr>
              ))}
              {rows.length > 0 && (
                <tr style={{ fontWeight: 700, background: "var(--bg-secondary)" }}>
                  <td>Total</td>
                  <td>{totalOrders}</td>
                  <td>{formatPrice(totalRevenue)}</td>
                </tr>
              )}
              {rows.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-secondary)" }}>No data for this period</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ===================== TECH PERFORMANCE REPORT =====================
function AdminTechPerformance() {
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function fetchReport() {
    setLoading(true); setError("");
    api<any>(`/api/reports/tech-performance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(setData).catch((e: any) => setError(e.message)).finally(() => setLoading(false));
  }

  useEffect(() => { fetchReport(); }, []);

  const rows = data?.technicians || [];
  const totalAssigned = rows.reduce((s: number, r: any) => s + (Number(r.ticketsAssigned) || 0), 0);
  const totalCompleted = rows.reduce((s: number, r: any) => s + (Number(r.ticketsCompleted) || 0), 0);
  const totalEarned = rows.reduce((s: number, r: any) => s + (Number(r.totalEarned) || 0), 0);

  return (
    <>
      <h1>Technician Performance</h1>
      <div className="panel" style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "end", flexWrap: "wrap" }}>
        <div className="field" style={{ margin: 0 }}><label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label></div>
        <div className="field" style={{ margin: 0 }}><label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label></div>
        <RippleButton onClick={fetchReport} loading={loading}>Generate</RippleButton>
      </div>
      {error && <ErrorMsg msg={error} />}
      {data && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Technician</th><th>Assigned</th><th>Completed</th><th>Revenue</th></tr></thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.staffId}>
                  <td>{escapeHtml(r.staffName || "—")}</td>
                  <td>{r.ticketsAssigned}</td>
                  <td>{r.ticketsCompleted}</td>
                  <td>{formatPrice(r.totalEarned)}</td>
                </tr>
              ))}
              {rows.length > 0 && (
                <tr style={{ fontWeight: 700, background: "var(--bg-secondary)" }}>
                  <td>Total</td>
                  <td>{totalAssigned}</td>
                  <td>{totalCompleted}</td>
                  <td>{formatPrice(totalEarned)}</td>
                </tr>
              )}
              {rows.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-secondary)" }}>No data for this period</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ===================== PURCHASES REPORT =====================
function AdminPurchasesReport() {
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function fetchReport() {
    setLoading(true); setError("");
    api<any>(`/api/reports/purchases?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(setData).catch((e: any) => setError(e.message)).finally(() => setLoading(false));
  }

  useEffect(() => { fetchReport(); }, []);

  return (
    <>
      <h1>Purchases Report</h1>
      <div className="panel" style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "end", flexWrap: "wrap" }}>
        <div className="field" style={{ margin: 0 }}><label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label></div>
        <div className="field" style={{ margin: 0 }}><label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label></div>
        <RippleButton onClick={fetchReport} loading={loading}>Generate</RippleButton>
      </div>
      {error && <ErrorMsg msg={error} />}
      {data && (
        <>
          {data.summary && (
            <div className="stat-grid" style={{ marginBottom: "1rem" }}>
              <div className="stat-card"><div className="stat-card__value">{data.summary.total_orders || 0}</div><div className="stat-card__label">Total Orders</div></div>
              <div className="stat-card"><div className="stat-card__value">{formatPrice(data.summary.total_cost || 0)}</div><div className="stat-card__label">Total Cost</div></div>
              <div className="stat-card"><div className="stat-card__value">{data.summary.received || 0}</div><div className="stat-card__label">Received</div></div>
              <div className="stat-card"><div className="stat-card__value">{data.summary.pending || 0}</div><div className="stat-card__label">Pending</div></div>
            </div>
          )}
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>#</th><th>Supplier</th><th>Items</th><th>Cost</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {(data.orders || []).map((o: any) => (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{escapeHtml(o.supplier_name || o.supplierName || "—")}</td>
                    <td>{o.item_count || 0}</td>
                    <td>{formatPrice(o.total_cost || 0)}</td>
                    <td><span className="plan-status">{o.status}</span></td>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(o.order_date || o.orderDate).toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
                {(!data.orders || data.orders.length === 0) && <tr><td colSpan={6} style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-secondary)" }}>No purchases for this period</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

// ===================== STOCK SUMMARY (ADMIN) =====================
function AdminStockSummary() {
  const [groupId, setGroupId] = useState("");
  const { data, loading, error, refetch } = useFetch(() => api<{ items: any[] }>(`/api/reports/stock-summary${groupId ? `?group_id=${encodeURIComponent(groupId)}` : ""}`), [groupId]);
  const { data: groups } = useFetch(() => api<{ groups: any[] }>("/api/admin/groups"), []);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  const items = data?.items || [];
  const totalProducts = items.length;
  const totalStock = items.reduce((s: number, i: any) => s + (i.quantityInStock ?? i.quantity_in_stock ?? 0), 0);
  const totalValue = items.reduce((s: number, i: any) => s + (i.quantityInStock ?? i.quantity_in_stock ?? 0) * (i.price || 0), 0);
  const outOfStock = items.filter((i: any) => (i.quantityInStock ?? i.quantity_in_stock ?? 0) === 0).length;

  return (
    <>
      <h1>Stock Summary</h1>
      <div className="panel" style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "end", flexWrap: "wrap" }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Group
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">All Groups</option>
              {(groups?.groups || []).map((g) => (
                <option key={g.id} value={g.id}>{escapeHtml(g.name)}</option>
              ))}
            </select>
          </label>
        </div>
        <RippleButton onClick={() => refetch()}>Refresh</RippleButton>
      </div>
      <div className="stat-grid" style={{ marginBottom: "1rem" }}>
        <div className="stat-card"><div className="stat-card__value">{totalProducts}</div><div className="stat-card__label">Products</div></div>
        <div className="stat-card"><div className="stat-card__value">{totalStock}</div><div className="stat-card__label">Total Units</div></div>
        <div className="stat-card"><div className="stat-card__value">{formatPrice(totalValue)}</div><div className="stat-card__label">Stock Value</div></div>
        <div className="stat-card"><div className="stat-card__value" style={{ color: outOfStock > 0 ? "var(--danger)" : "inherit" }}>{outOfStock}</div><div className="stat-card__label">Out of Stock</div></div>
      </div>
      <div className="table-wrap">
        <DataTable<any>
          ariaLabel="Stock summary"
          columns={[
            { key: "product", label: "Product", sortable: true, value: (i) => i.name, render: (i) => escapeHtml(i.name) },
            { key: "category", label: "Category", sortable: true, value: (i) => i.category || "", render: (i) => i.category || "—" },
            { key: "qty", label: "Qty", sortable: true, align: "right", value: (i) => i.quantityInStock ?? i.quantity_in_stock ?? 0, render: (i) => i.quantityInStock ?? i.quantity_in_stock ?? 0 },
            { key: "price", label: "Price", sortable: true, align: "right", value: (i) => i.price, render: (i) => formatPrice(i.price) },
            { key: "value", label: "Value", sortable: true, align: "right", value: (i) => (i.quantityInStock ?? i.quantity_in_stock ?? 0) * (i.price || 0), render: (i) => formatPrice((i.quantityInStock ?? i.quantity_in_stock ?? 0) * (i.price || 0)) },
          ]}
          rows={items}
          rowKey={(i) => i.id}
          empty={<EmptyState icon="stock" title="No stock data" description="No products with stock information." />}
        />
      </div>
    </>
  );
}

// ===================== STOCK ON HAND =====================
const AdminStockOnHand = () => <StockOnHandPage showAutoReorder={true} />;

// ===================== STOCK TRANSFERS =====================
function AdminStockTransfers() {
  const { toast } = useToast();
  const { data: tData, loading, error, refetch } = useFetch(() => api<{ transfers: any[] }>("/api/stock-transfers"), []);
  const { data: branches } = useFetch(() => api<{ branches: any[] }>("/api/admin/branches"), []);
  const { data: products } = useFetch(() => api<{ products: any[] }>("/api/products?includeHidden=1"), []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fromBranchId: "", toBranchId: "", productId: "", quantity: "", notes: "" });
  const [creating, setCreating] = useState(false);
  const [sourceStock, setSourceStock] = useState<number | null>(null);
  const [destStock, setDestStock] = useState<number | null>(null);
  const [loadingStockCheck, setLoadingStockCheck] = useState(false);

  const branchList = branches?.branches || [];
  const productList = products?.products || [];
  const transfers = tData?.transfers || [];

  useEffect(() => {
    if (!form.fromBranchId || !form.productId) { setSourceStock(null); return; }
    setLoadingStockCheck(true);
    api<any>(`/api/admin/stock/by-branch/${form.fromBranchId}`).then((data: any) => {
      const items = data.items || data || [];
      const found = Array.isArray(items) ? items.find((i: any) => String(i.productId ?? i.id) === String(form.productId)) : null;
      setSourceStock(found ? (found.quantityInStock ?? found.quantity_in_stock ?? 0) : 0);
    }).catch(() => setSourceStock(null)).finally(() => setLoadingStockCheck(false));
  }, [form.fromBranchId, form.productId]);

  useEffect(() => {
    if (!form.toBranchId || !form.productId) { setDestStock(null); return; }
    api<any>(`/api/admin/stock/by-branch/${form.toBranchId}`).then((data: any) => {
      const items = data.items || data || [];
      const found = Array.isArray(items) ? items.find((i: any) => String(i.productId ?? i.id) === String(form.productId)) : null;
      setDestStock(found ? (found.quantityInStock ?? found.quantity_in_stock ?? 0) : 0);
    }).catch(() => setDestStock(null));
  }, [form.toBranchId, form.productId]);

  async function createTransfer(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api("/api/stock-transfers", {
        method: "POST",
        body: JSON.stringify({
          fromBranchId: Number(form.fromBranchId), toBranchId: Number(form.toBranchId),
          productId: form.productId, quantity: Number(form.quantity), notes: form.notes || undefined,
        }),
      });
      setShowForm(false); setForm({ fromBranchId: "", toBranchId: "", productId: "", quantity: "", notes: "" });
      refetch(); toast("success", "Transfer created");
    } catch (err: any) { toast("error", err.message); } finally { setCreating(false); }
  }

  async function completeTransfer(id: number) {
    try { await api(`/api/admin/stock/transfer/${id}/complete`, { method: "PUT" }); refetch(); toast("success", "Transfer completed"); } catch (err: any) { toast("error", err.message); }
  }

  async function rejectTransfer(id: number) {
    try { await api(`/api/stock-transfers/${id}/reject`, { method: "POST" }); refetch(); toast("success", "Transfer rejected"); } catch (err: any) { toast("error", err.message); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Stock Transfers</h1>
        <RippleButton size="small" onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ New Transfer"}</RippleButton>
      </div>

      {showForm && (
        <div className="panel" style={{ marginBottom: "1rem", maxWidth: 500 }}>
          <h3 style={{ marginTop: 0 }}>New Stock Transfer</h3>
          <form onSubmit={createTransfer}>
            <div className="field"><label>From Branch<select value={form.fromBranchId} onChange={(e) => setForm({ ...form, fromBranchId: e.target.value })} required><option value="">Select source branch</option>{branchList.map((b: any) => <option key={b.id} value={b.id}>{escapeHtml(b.name)}</option>)}</select></label></div>
            <div className="field"><label>To Branch<select value={form.toBranchId} onChange={(e) => setForm({ ...form, toBranchId: e.target.value })} required><option value="">Select destination branch</option>{branchList.map((b: any) => <option key={b.id} value={b.id}>{escapeHtml(b.name)}</option>)}</select></label></div>
            <div className="field"><label>Product<select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required><option value="">Select product</option>{productList.map((p: any) => <option key={p.id} value={p.id}>{escapeHtml(p.name)}</option>)}</select></label></div>
            <div className="field"><label>Quantity<input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></label></div>
            {form.fromBranchId && form.productId && (
              <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem", fontSize: "0.85rem" }}>
                <div style={{ padding: "0.4rem 0.75rem", borderRadius: 6, background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Source stock: </span>
                  <strong>{loadingStockCheck ? "..." : sourceStock ?? "—"}</strong>
                </div>
                {form.toBranchId && (
                  <div style={{ padding: "0.4rem 0.75rem", borderRadius: 6, background: "var(--bg)", border: "1px solid var(--border)" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Destination stock: </span>
                    <strong>{destStock ?? "—"}</strong>
                  </div>
                )}
              </div>
            )}
            {sourceStock !== null && form.quantity && Number(form.quantity) > sourceStock && (
              <div style={{ padding: "0.5rem 0.75rem", borderRadius: 6, background: "var(--warning-light)", color: "var(--warning-text)", marginBottom: "0.75rem", fontSize: "0.85rem" }}>
                Warning: Source branch only has {sourceStock} unit(s) in stock. Transfer quantity ({form.quantity}) exceeds available stock.
              </div>
            )}
            <div className="field"><label>Notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></label></div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <RippleButton type="submit" loading={creating}>Create Transfer</RippleButton>
              <RippleButton variant="secondary" onClick={() => setShowForm(false)}>Cancel</RippleButton>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrap">
        <DataTable<any>
          ariaLabel="Stock transfers"
          columns={[
            { key: "id", label: "ID", value: (t) => `#${t.id}`, render: (t) => <span>#{t.id}</span> },
            { key: "from", label: "From", sortable: true, value: (t) => branchList.find((b: any) => b.id === t.fromBranchId)?.name || `#${t.fromBranchId}`, render: (t) => escapeHtml(branchList.find((b: any) => b.id === t.fromBranchId)?.name || `#${t.fromBranchId}`) },
            { key: "to", label: "To", sortable: true, value: (t) => branchList.find((b: any) => b.id === t.toBranchId)?.name || `#${t.toBranchId}`, render: (t) => escapeHtml(branchList.find((b: any) => b.id === t.toBranchId)?.name || `#${t.toBranchId}`) },
            { key: "product", label: "Product", sortable: true, value: (t) => productList.find((p: any) => p.id === t.productId)?.name || t.productId, render: (t) => escapeHtml(productList.find((p: any) => p.id === t.productId)?.name || t.productId) },
            { key: "qty", label: "Qty", sortable: true, align: "right", value: (t) => t.quantity, render: (t) => <span style={{ textAlign: "right" }}>{t.quantity}</span> },
            {
              key: "status",
              label: "Status",
              sortable: true,
              value: (t) => t.status,
              render: (t) => (
                <span className="plan-status" style={{ background: t.status === "completed" ? "var(--success-light)" : t.status === "rejected" ? "var(--danger-light)" : "var(--warning-light)", color: t.status === "completed" ? "var(--success-text)" : t.status === "rejected" ? "var(--danger-text)" : "var(--warning-text)" }}>{t.status}</span>
              ),
            },
            { key: "created", label: "Created", value: (t) => new Date(t.createdAt).toISOString(), render: (t) => <span style={{ whiteSpace: "nowrap" }}>{new Date(t.createdAt).toLocaleDateString("en-GB")}</span> },
            {
              key: "actions",
              label: "",
              render: (t) => (
                t.status === "pending" ? (
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    <RippleButton size="small" onClick={() => completeTransfer(t.id)}>Complete</RippleButton>
                    <RippleButton size="small" variant="danger" onClick={() => rejectTransfer(t.id)}>Reject</RippleButton>
                  </div>
                ) : null
              ),
            },
          ]}
          rows={transfers}
          rowKey={(t) => t.id}
          empty={<EmptyState icon="stock" title="No transfers" description="Create a stock transfer between branches." />}
        />
      </div>
    </>
  );
}

// ===================== STOCK TAKE =====================
const AdminStockTake = StockTakeListPage;

// ===================== CUSTOMERS =====================
function AdminCustomers() {
  const [fetched, setFetched] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPass, setFormPass] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formErr, setFormErr] = useState("");
  const [formOk, setFormOk] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [editErr, setEditErr] = useState("");
  const [editOk, setEditOk] = useState("");
  const [selected, setSelected] = useState<any>(null);

  function load() {
    setLoading(true); setError("");
    api<{ customers: any[] }>("/api/admin/customers?includeInactive=true")
      .then((d) => setFetched(d.customers))
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setFormErr(""); setFormOk("");
    if (!formName.trim() || !formEmail.trim() || !formPass.trim()) { setFormErr("Name, email, and password required."); return; }
    try {
      await api("/api/admin/customers", { method: "POST", body: JSON.stringify({ name: formName.trim(), email: formEmail.trim().toLowerCase(), password: formPass, phone: formPhone.trim() }) });
      setFormOk("Customer created.");
      setFormName(""); setFormEmail(""); setFormPass(""); setFormPhone(""); setShowForm(false);
      load();
      toast("success", "Customer created.");
    } catch (err: any) { setFormErr(err.message); toast("error", err.message); }
  }

  async function handleToggle(c: any) {
    try {
      await api(`/api/admin/customers/${c.id}/status`, { method: "PATCH", body: JSON.stringify({ isActive: !c.is_active }) });
      load();
    } catch {}
  }

  async function handleDelete(id: number) {
    if (!(await confirmDialog({ message: "Delete this customer and all their data? This cannot be undone.", confirmLabel: "Delete", danger: true }))) return;
    setDeleting(id);
    try { await api(`/api/admin/customers/${id}`, { method: "DELETE" }); load(); toast("success", "Customer deleted."); }
    catch { toast("error", "Delete failed"); }
    finally { setDeleting(null); }
  }

  function startEdit(c: any) {
    setEditing(c);
    setEditForm({ name: c.name || "", email: c.email || "", phone: c.phone || "", password: "" });
    setEditErr(""); setEditOk("");
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault(); setEditErr(""); setEditOk("");
    const body: any = { name: editForm.name.trim(), email: editForm.email.trim().toLowerCase(), phone: editForm.phone.trim() };
    if (editForm.password) body.password = editForm.password;
    try {
      await api(`/api/admin/customers/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setEditOk("Customer updated.");
      setEditing(null);
      load();
      toast("success", "Customer updated.");
    } catch (err: any) { setEditErr(err.message); toast("error", err.message); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const customers = fetched || [];

  return (
    <>
      <h1>Customer Accounts</h1>
      <RippleButton onClick={() => setShowForm(!showForm)} style={{ marginBottom: "1rem" }}>{showForm ? "Cancel" : "Add Customer"}</RippleButton>
      {showForm && (
        <div className="panel" style={{ marginBottom: "1rem", maxWidth: 400 }}>
          <form onSubmit={handleAdd}>
            {formErr && <div className="form-error">{formErr}</div>}
            {formOk && <div className="form-ok">{formOk}</div>}
            <div className="field"><label>Name<input value={formName} onChange={(e) => setFormName(e.target.value)} required /></label></div>
            <div className="field"><label>Email<input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required /></label></div>
            <div className="field"><label>Password<input type="password" value={formPass} onChange={(e) => setFormPass(e.target.value)} required /></label></div>
            <div className="field"><label>Phone<input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} /></label></div>
            <RippleButton type="submit">Create</RippleButton>
          </form>
        </div>
      )}
      {editing && (
        <div className="panel" style={{ marginBottom: "1rem", maxWidth: 400 }}>
          <h4 style={{ margin: "0 0 1rem" }}>Edit customer #{editing.id}</h4>
          <form onSubmit={handleUpdate}>
            {editErr && <div className="form-error">{editErr}</div>}
            {editOk && <div className="form-ok">{editOk}</div>}
            <div className="field"><label>Name<input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required /></label></div>
            <div className="field"><label>Email<input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required /></label></div>
            <div className="field"><label>Phone<input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></label></div>
            <div className="field"><label>New password (optional)<input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="Leave blank to keep current password" /></label></div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <RippleButton type="submit">Save</RippleButton>
              <RippleButton variant="ghost" onClick={() => setEditing(null)}>Cancel</RippleButton>
            </div>
          </form>
        </div>
      )}
      <div className="table-wrap">
        <DataTable<any>
          ariaLabel="Customer accounts"
          columns={[
            { key: "id", label: "#", value: (c) => c.id, render: (c) => <span>{c.id}</span> },
            { key: "name", label: "Name", sortable: true, value: (c) => c.name, render: (c) => escapeHtml(c.name) },
            { key: "email", label: "Email", sortable: true, value: (c) => c.email, render: (c) => escapeHtml(c.email) },
            { key: "phone", label: "Phone", value: (c) => c.phone || "", render: (c) => escapeHtml(c.phone || "-") },
            {
              key: "status",
              label: "Status",
              sortable: true,
              value: (c) => (c.is_active ? "Active" : "Inactive"),
              render: (c) => <span className={`badge ${c.is_active ? "badge-green" : "badge-red"}`}>{c.is_active ? "Active" : "Inactive"}</span>,
            },
            { key: "lastlogin", label: "Last Login", value: (c) => c.last_login ? new Date(c.last_login).toISOString() : "", render: (c) => <span style={{ whiteSpace: "nowrap" }}>{c.last_login ? new Date(c.last_login).toLocaleDateString("en-GB") : "-"}</span> },
            { key: "registered", label: "Registered", value: (c) => new Date(c.created_at).toISOString(), render: (c) => <span style={{ whiteSpace: "nowrap" }}>{new Date(c.created_at).toLocaleDateString("en-GB")}</span> },
            {
              key: "actions",
              label: "Actions",
              render: (c) => (
                <span style={{ whiteSpace: "nowrap" }}>
                  <RippleButton size="small" variant="ghost" onClick={(e) => { e.stopPropagation(); startEdit(c); }}>Edit</RippleButton>{" "}
                  <RippleButton size="small" variant="ghost" onClick={(e) => { e.stopPropagation(); handleToggle(c); }}>{c.is_active ? "Deactivate" : "Activate"}</RippleButton>{" "}
                  <RippleButton size="small" variant="danger" onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} loading={deleting === c.id}>Delete</RippleButton>
                </span>
              ),
            },
          ]}
          rows={customers}
          rowKey={(c) => c.id}
          onRowClick={(c) => setSelected(c)}
          empty={<EmptyState icon="customers" title="No customers" description="Customers will appear here after placing orders." />}
        />
      </div>
      {selected && <CustomerDetailPanel customer={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

// ===================== CUSTOMER 360 =====================
function CustomerDetailPanel({ customer, onClose }: { customer: any; onClose: () => void }) {
  const [tab, setTab] = useState("overview");
  const [orders, setOrders] = useState<any[] | null>(null);
  const [repairs, setRepairs] = useState<any[] | null>(null);
  const [serials, setSerials] = useState<any[] | null>(null);
  const [warranties, setWarranties] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOrders(null); setRepairs(null); setSerials(null); setWarranties(null); setTab("overview"); setLoading(true);
    let cancelled = false;
    const guard = <T,>(p: Promise<T | null>): Promise<T | null> => p.catch(() => null);
    Promise.all([
      guard(api<{ orders: any[] }>(`/api/admin/orders?customerId=${customer.id}`)),
      guard(api<{ tickets: any[] }>(`/api/repairs?customerId=${customer.id}`)),
      guard(api<{ serials: any[] }>(`/api/serials?customerId=${customer.id}`)),
      guard(api<{ warranties: any[] }>(`/api/admin/warranties?customerId=${customer.id}`)),
    ]).then(([o, r, s, w]) => {
      if (cancelled) return;
      setOrders(o?.orders || []); setRepairs(r?.tickets || []); setSerials(s?.serials || []); setWarranties(w?.warranties || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [customer.id]);

  const lifetimeValue = (orders || []).reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const activeWarranties = (warranties || []).filter((w) => w.status === "active" || w.status === "expiring");
  const openRepairs = (repairs || []).filter((r) => !["collected", "cancelled"].includes(r.status));

  const tabs: { key: string; label: string }[] = [
    { key: "overview", label: "Overview" },
    ...(orders && orders.length > 0 ? [{ key: "orders", label: `Orders (${orders.length})` }] : []),
    ...(serials && serials.length > 0 ? [{ key: "assets", label: `Assets (${serials.length})` }] : []),
    ...(repairs && repairs.length > 0 ? [{ key: "repairs", label: `Repairs (${repairs.length})` }] : []),
    ...(warranties && warranties.length > 0 ? [{ key: "warranty", label: `Warranty (${warranties.length})` }] : []),
  ];

  return (
    <div className="panel" style={{ marginTop: "1.25rem", marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0 }}>Customer #{customer.id} — {escapeHtml(customer.name)}</h3>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            {escapeHtml(customer.email || "")}{customer.phone ? ` · ${escapeHtml(customer.phone)}` : ""}
          </p>
        </div>
        <RippleButton variant="ghost" size="small" onClick={onClose}>Close</RippleButton>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          <Tabs tabs={tabs} active={tab} onChange={setTab} ariaLabel={`Customer ${customer.id} detail`} />
          {tab === "overview" && (
            <div className="stat-grid" style={{ marginTop: "1rem" }}>
              <div className="stat-card"><div className="stat-card__value">{orders?.length || 0}</div><div className="stat-card__label">Orders</div></div>
              <div className="stat-card"><div className="stat-card__value">{formatPrice(lifetimeValue)}</div><div className="stat-card__label">Lifetime value</div></div>
              <div className="stat-card"><div className="stat-card__value">{serials?.length || 0}</div><div className="stat-card__label">Serialised assets</div></div>
              <div className="stat-card"><div className="stat-card__value">{activeWarranties.length}</div><div className="stat-card__label">Active warranties</div></div>
              <div className="stat-card"><div className="stat-card__value">{openRepairs.length}</div><div className="stat-card__label">Open repairs</div></div>
            </div>
          )}
          {tab === "orders" && (
            <div className="table-wrap" style={{ marginTop: "1rem" }}>
              <DataTable<any>
                ariaLabel="Customer orders"
                columns={[
                  { key: "id", label: "#", value: (o) => o.id, render: (o) => <a href={`/admin?view=orders&order=${o.id}`}>#{o.id}</a> },
                  { key: "date", label: "Date", value: (o) => new Date(o.createdAt).toISOString(), render: (o) => <span style={{ whiteSpace: "nowrap" }}>{new Date(o.createdAt).toLocaleDateString("en-GB")}</span> },
                  { key: "status", label: "Status", value: (o) => o.status, render: (o) => <StatusBadge status={o.status} domain="orders" /> },
                  { key: "items", label: "Items", align: "right", value: (o) => o.items?.length || 0, render: (o) => <span style={{ textAlign: "right" }}>{o.items?.length || 0}</span> },
                  { key: "total", label: "Total", align: "right", value: (o) => Number(o.total) || 0, render: (o) => <strong>{formatPrice(Number(o.total) || 0)}</strong> },
                ]}
                rows={orders || []}
                rowKey={(o) => o.id}
              />
            </div>
          )}
          {tab === "assets" && (
            <div className="table-wrap" style={{ marginTop: "1rem" }}>
              <DataTable<any>
                ariaLabel="Customer serialised assets"
                columns={[
                  { key: "sn", label: "Serial", value: (s) => s.serial_number, render: (s) => <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{escapeHtml(s.serial_number)}</span> },
                  { key: "product", label: "Product", value: (s) => s.product_name || "", render: (s) => escapeHtml(s.product_name || "—") },
                  { key: "sold", label: "Sold", value: (s) => s.sold_at ? new Date(s.sold_at).toISOString() : "", render: (s) => <span style={{ whiteSpace: "nowrap" }}>{s.sold_at ? new Date(s.sold_at).toLocaleDateString("en-GB") : "—"}</span> },
                  { key: "warranty", label: "Warranty", value: (s) => s.warranty_expires ? new Date(s.warranty_expires).toISOString() : "", render: (s) => <span style={{ whiteSpace: "nowrap" }}>{s.warranty_expires ? new Date(s.warranty_expires).toLocaleDateString("en-GB") : "—"}</span> },
                ]}
                rows={serials || []}
                rowKey={(s) => s.serial_number}
              />
            </div>
          )}
          {tab === "repairs" && (
            <div className="table-wrap" style={{ marginTop: "1rem" }}>
              <DataTable<any>
                ariaLabel="Customer repairs"
                columns={[
                  { key: "id", label: "#", value: (r) => r.id, render: (r) => <span>#{r.id}</span> },
                  { key: "device", label: "Device", value: (r) => `${r.deviceType || ""} ${r.deviceModel || ""}`.trim(), render: (r) => escapeHtml(`${r.deviceType || ""}${r.deviceModel ? " " + r.deviceModel : ""}`.trim() || "—") },
                  { key: "date", label: "Created", value: (r) => new Date(r.createdAt).toISOString(), render: (r) => <span style={{ whiteSpace: "nowrap" }}>{new Date(r.createdAt).toLocaleDateString("en-GB")}</span> },
                  { key: "status", label: "Status", value: (r) => r.status, render: (r) => <StatusBadge status={r.status} domain="repairs" /> },
                ]}
                rows={repairs || []}
                rowKey={(r) => r.id}
              />
            </div>
          )}
          {tab === "warranty" && (
            <div className="table-wrap" style={{ marginTop: "1rem" }}>
              <DataTable<any>
                ariaLabel="Customer warranties"
                columns={[
                  { key: "product", label: "Product", value: (w) => w.productName, render: (w) => escapeHtml(w.productName) },
                  { key: "serial", label: "Serial", value: (w) => w.serialNumber || "", render: (w) => w.serialNumber ? <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{escapeHtml(w.serialNumber)}</span> : "—" },
                  { key: "start", label: "Start", value: (w) => w.startDate || "", render: (w) => <span style={{ whiteSpace: "nowrap" }}>{w.startDate || "—"}</span> },
                  { key: "expiry", label: "Expires", value: (w) => w.expiryDate || "", render: (w) => <span style={{ whiteSpace: "nowrap" }}>{w.expiryDate || "—"}</span> },
                  { key: "status", label: "Status", value: (w) => w.status, render: (w) => <StatusBadge status={w.status} domain="warranty" /> },
                ]}
                rows={warranties || []}
                rowKey={(w) => w.orderItemId}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ===================== STOCK CONTROL =====================
function AdminStockControl() {
  const { data: sData, loading, error } = useFetch(() => api<{ items: any[] }>("/api/reports/stock-summary"), []);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setChecked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function selectAll() { if (sData?.items) setChecked(new Set(sData.items.map((i) => i.productId))); }
  function clearAll() { setChecked(new Set()); }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const items = sData?.items || [];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Stock Control</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <RippleButton size="small" onClick={selectAll}>Select all</RippleButton>
          <RippleButton size="small" variant="ghost" onClick={clearAll}>Clear</RippleButton>
        </div>
      </div>
      <p className="muted">Tick items you want to count, then go to Stock Take to begin a session.</p>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th></th><th>Product</th><th>Category</th><th>System Qty</th><th>Threshold</th></tr></thead>
          <tbody>
            {items.map((i: any) => (
              <tr key={i.productId} style={checked.has(i.productId) ? { background: "var(--surface)" } : {}}>
                <td><input type="checkbox" checked={checked.has(i.productId)} onChange={() => toggle(i.productId)} /></td>
                <td>{escapeHtml(i.name)}</td>
                <td>{i.category || "—"}</td>
                <td>{i.quantityInStock}</td>
                <td>{i.lowStockThreshold}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {checked.size > 0 && <p style={{ marginTop: "0.5rem", opacity: 0.7 }}>{checked.size} item(s) selected for stock take.</p>}
    </>
  );
}

// ===================== PURCHASE ORDERS =====================
function AdminPurchases() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState({ supplierName: "", notes: "" });
  const [formItems, setFormItems] = useState<{ productId: string; productName: string; quantity: number; unitCost: number }[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [listMode, setListMode] = useState<"active" | "completed" | "deleted">("active");
  const [receiveInputs, setReceiveInputs] = useState<{ [itemId: number]: number }>({});
  const [receiveSerials, setReceiveSerials] = useState<{ [itemId: number]: string[] }>({});
  const [receiving, setReceiving] = useState<number | "all" | null>(null);
  const [serialModalItem, setSerialModalItem] = useState<any | null>(null);
  const [serialInput, setSerialInput] = useState("");
  const [serialMsg, setSerialMsg] = useState("");
  const [serialising, setSerialising] = useState<number | "all" | null>(null);
  const [listSearch, setListSearch] = useState("");

  async function loadOrders(mode?: string) {
    setLoading(true);
    try {
      const m = mode || listMode;
      const url = m === "deleted" ? "/api/purchases/deleted" : m === "completed" ? "/api/purchases/completed" : "/api/purchases";
      const d = await api<{ orders: any[] }>(url);
      setOrders(d.orders || []);
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  }

  async function loadFormDeps() {
    try {
      const [sRes, pRes] = await Promise.all([
        api<{ suppliers: any[] }>("/api/admin/suppliers").catch(() => ({ suppliers: [] })),
        api<{ products: any[] }>("/api/products?includeHidden=1").catch(() => ({ products: [] })),
      ]);
      setSuppliers(sRes.suppliers || []);
      setProducts(pRes.products || []);
    } catch {}
  }

  async function loadOrder(id: number) {
    try {
      const d = await api<any>(`/api/purchases/${id}`);
      const po = d.order || d;
      setViewing(po);
      const defaults: { [itemId: number]: number } = {};
      (po.items || []).forEach((i: any) => {
        defaults[i.id] = Math.max(0, (i.quantityOrdered || 0) - (i.quantityReceived || 0));
      });
      setReceiveInputs(defaults);
    } catch (err: any) { setMsg(err.message); }
  }

  function addFormItem(p: any) {
    if (formItems.find((i) => i.productId === p.id)) return;
    setFormItems([...formItems, { productId: p.id, productName: p.name, quantity: 1, unitCost: Number(p.price) || 0 }]);
    setSearch("");
  }

  function removeFormItem(idx: number) { setFormItems(formItems.filter((_, i) => i !== idx)); }

  function updateFormItem(idx: number, field: string, value: any) {
    const copy = [...formItems];
    (copy[idx] as any)[field] = field === "quantity" ? Math.max(1, Number(value)) : Number(value);
    setFormItems(copy);
  }

  async function createOrder() {
    if (!form.supplierName || formItems.length === 0) return;
    setSaving(true);
    try {
      await api("/api/purchases", { method: "POST", body: JSON.stringify({
        supplierName: form.supplierName, notes: form.notes,
        items: formItems.map((i) => ({ productId: i.productId, quantityOrdered: i.quantity, unitCost: i.unitCost })),
      })});
      setCreating(false); setForm({ supplierName: "", notes: "" }); setFormItems([]);
      loadOrders();
    } catch (err: any) { setMsg(err.message); }
    setSaving(false);
  }

  async function updateStatus(id: number, status: string) {
    try {
      await api(`/api/purchases/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      loadOrder(id); loadOrders();
      toast("success", `Purchase order marked as ${status}.`);
    } catch (err: any) { setMsg(err.message); toast("error", err.message); }
  }

  async function confirmMarkReceived() {
    if (!viewing) return;
    const lineCount = (viewing.items || []).length;
    const remainingLines = (viewing.items || []).filter((i: any) => (i.quantityOrdered - i.quantityReceived) > 0);
    const cost = remainingLines.reduce((s: number, i: any) => s + (i.unitCost || 0) * (i.quantityOrdered - i.quantityReceived), 0);
    const serialTracked = remainingLines.some((i: any) => i.serialTracking);
    const ok = await confirmDialog({
      title: "Mark all received?",
      message: `This receives all remaining quantities and adds ${formatPrice(cost)} to stock on hand.${serialTracked ? " Serial-tracked lines without serials already entered will be auto-generated." : ""}`,
      confirmLabel: "Mark All Received",
      danger: true,
    });
    if (!ok) return;
    setReceiving("all");
    try {
      const serialsByItem: { [itemId: number]: string[] } = {};
      remainingLines.forEach((i: any) => {
        const serials = receiveSerials[i.id] || [];
        if (serials.length) serialsByItem[i.id] = serials;
      });
      await api(`/api/purchases/${viewing.id}/receive-all`, { method: "POST", body: JSON.stringify({ serialsByItem }) });
      setReceiveInputs({}); setReceiveSerials({});
      if (viewing) loadOrder(viewing.id);
      loadOrders();
      toast("success", "All items received and added to stock.");
    } catch (err: any) { setMsg(err.message); toast("error", err.message); }
    setReceiving(null);
  }

  async function receiveItem(itemId: number) {
    const qty = receiveInputs[itemId];
    if (qty === undefined || qty < 0) return;
    setReceiving(itemId);
    try {
      const serials = receiveSerials[itemId] || [];
      await api(`/api/purchases/items/${itemId}/receive`, { method: "POST", body: JSON.stringify({ quantityReceived: qty, serials }) });
      setReceiveInputs((p) => { const n = { ...p }; delete n[itemId]; return n; });
      setReceiveSerials((p) => { const n = { ...p }; delete n[itemId]; return n; });
      if (serialModalItem?.id === itemId) { setSerialModalItem(null); setSerialInput(""); setSerialMsg(""); }
      if (viewing) loadOrder(viewing.id);
    } catch (err: any) { setMsg(err.message); }
    setReceiving(null);
  }

  async function serialiseItem(itemId: number, productId: string, count: number) {
    setSerialising(itemId);
    setSerialMsg("");
    try {
      const d = await api<{ serials: { serialNumber: string }[] }>("/api/serials/generate", { method: "POST", body: JSON.stringify({ productId, count, purchaseOrderItemId: itemId }) });
      const list = (d.serials || []).map((s) => s.serialNumber);
      setReceiveSerials((prev) => ({ ...prev, [itemId]: list }));
      setSerialInput("");
      toast("success", `Generated ${list.length} serial number${list.length !== 1 ? "s" : ""}.`);
    } catch (err: any) { setSerialMsg(err.message); toast("error", err.message); }
    setSerialising(null);
  }

  async function serialiseAllItems() {
    if (!viewing) return;
    const targets = (viewing.items || []).filter((i: any) => i.serialTracking && (i.quantityOrdered - i.quantityReceived) > 0);
    if (targets.length === 0) return;
    if (!(await confirmDialog({ message: `Generate serial numbers for ${targets.length} serial-tracked line${targets.length !== 1 ? "s" : ""}?`, confirmLabel: "Serialise Items" }))) return;
    setSerialising("all");
    try {
      let total = 0;
      const updates: { [itemId: number]: string[] } = {};
      for (const t of targets) {
        const count = t.quantityOrdered - t.quantityReceived;
        const d = await api<{ serials: { serialNumber: string }[] }>("/api/serials/generate", { method: "POST", body: JSON.stringify({ productId: t.productId, count, purchaseOrderItemId: t.id }) });
        const list = (d.serials || []).map((s) => s.serialNumber);
        updates[t.id] = list;
        total += list.length;
      }
      setReceiveSerials((prev) => ({ ...prev, ...updates }));
      toast("success", `Generated ${total} serial number${total !== 1 ? "s" : ""}.`);
    } catch (err: any) { setMsg(err.message); toast("error", err.message); }
    setSerialising(null);
  }

  async function deleteOrder(id: number) {
    if (!(await confirmDialog({ message: "Move this purchase order to trash? Any stock it added will be deducted from stock on hand and its serials voided. You can restore it later.", confirmLabel: "Move to Trash", danger: true }))) return;
    try {
      await api(`/api/purchases/${id}`, { method: "DELETE" });
      if (viewing && viewing.id === id) setViewing(null);
      loadOrders();
      toast("success", "Purchase order moved to trash.", undefined, { label: "Undo", onClick: () => restoreOrder(id) });
    } catch (err: any) { setMsg(err.message); toast("error", err.message); }
  }

  async function restoreOrder(id: number) {
    try {
      await api(`/api/purchases/${id}/restore`, { method: "POST" });
      loadOrders();
    } catch (err: any) { setMsg(err.message); }
  }

  async function recallOrder(id: number) {
    if (!(await confirmDialog({
      title: "Recall this purchase order?",
      message: "This reverses the receipt: it deducts the received quantities from stock on hand, voids its in-stock serial numbers, resets received quantities to 0, and moves the PO back to 'ordered'.",
      confirmLabel: "Recall PO",
      danger: true,
    }))) return;
    try {
      await api(`/api/purchases/${id}/recall`, { method: "POST" });
      if (viewing && viewing.id === id) loadOrder(id);
      loadOrders();
      toast("success", "Purchase order recalled — stock reversed.");
    } catch (err: any) { setMsg(err.message); toast("error", err.message); }
  }

  async function downloadPdf(id: number) {
    try {
      const r = await api<{ token: string }>(`/api/admin/purchase-pdf-token/${id}`, { method: "POST" });
      window.open(`/api/purchases/${id}/pdf?allowQueryToken=1&token=${encodeURIComponent(r.token)}`, "_blank");
    } catch (err: any) { toast("error", err.message); }
  }

  useEffect(() => { loadOrders(); }, []);

  const filteredSearch = search ? products.filter((p) => (p.name || "").toLowerCase().includes(search.toLowerCase())).slice(0, 10) : [];

  function formatDate(d: string) { try { return new Date(d).toLocaleDateString("en-GB"); } catch { return d; } }

  if (loading) return <><h1>Purchase Orders</h1><Spinner /></>;

  if (viewing) {
    const totalCost = (viewing.items || []).reduce((s: number, i: any) => s + (i.unitCost || 0) * (i.quantityOrdered || 0), 0);
    const totalReceived = (viewing.items || []).reduce((s: number, i: any) => s + (i.unitCost || 0) * (i.quantityReceived || 0), 0);
    const receivedUnits = (viewing.items || []).reduce((s: number, i: any) => s + (i.quantityReceived || 0), 0);
    const serialTargets = (viewing.items || []).filter((i: any) => i.serialTracking && (i.quantityOrdered - i.quantityReceived) > 0);
    return (
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h1 style={{ margin: 0 }}>PO #{viewing.id} — {escapeHtml(viewing.supplierName)}</h1>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <RippleButton size="small" variant="ghost" onClick={() => downloadPdf(viewing.id)}>Download PDF</RippleButton>
            <RippleButton size="small" variant="ghost" onClick={() => setViewing(null)}>&larr; Back</RippleButton>
          </div>
        </div>
        {msg && <ErrorMsg msg={msg} />}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div className="panel">
            <p><strong>Status:</strong> <span className="plan-status" style={{ background: viewing.status === "received" ? "var(--success-light)" : viewing.status === "cancelled" ? "var(--danger-light)" : viewing.status === "ordered" ? "var(--primary-light)" : "var(--warning-light)", color: viewing.status === "received" ? "var(--success-text)" : viewing.status === "cancelled" ? "var(--danger-text)" : viewing.status === "ordered" ? "var(--primary)" : "var(--warning-text)" }}>{viewing.status}</span></p>
            <p><strong>Date:</strong> {formatDate(viewing.orderDate || viewing.order_date)}</p>
            <p><strong>Created:</strong> {formatDate(viewing.createdAt || viewing.created_at)}</p>
            {viewing.notes && <p><strong>Notes:</strong> {escapeHtml(viewing.notes)}</p>}
          </div>
          <div className="panel">
            <div className="stat-grid">
              <div className="stat-card"><div className="stat-card__value">{(viewing.items || []).length}</div><div className="stat-card__label">Items</div></div>
              <div className="stat-card"><div className="stat-card__value">{formatPrice(totalCost)}</div><div className="stat-card__label">Ordered Cost</div></div>
              <div className="stat-card"><div className="stat-card__value">{formatPrice(totalReceived)}</div><div className="stat-card__label">Received Cost</div></div>
            </div>
            {viewing.status === "pending" && (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <RippleButton size="small" onClick={() => updateStatus(viewing.id, "ordered")}>Mark Ordered</RippleButton>
                <RippleButton size="small" variant="danger" onClick={async () => { if (await confirmDialog({ message: `Cancel purchase order ${viewing.id}? Ordered stock will not be received.`, confirmLabel: "Cancel Order", danger: true })) updateStatus(viewing.id, "cancelled"); }}>Cancel</RippleButton>
              </div>
            )}
            {viewing.status === "ordered" && (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                {serialTargets.length > 0 && (
                  <RippleButton size="small" loading={serialising === "all"} disabled={serialising !== null && serialising !== "all"} onClick={serialiseAllItems}>Serialise Items</RippleButton>
                )}
                <RippleButton size="small" loading={receiving === "all"} disabled={receiving !== null} onClick={confirmMarkReceived}>Mark All Received</RippleButton>
              </div>
            )}
            {(viewing.status === "received" || receivedUnits > 0) && (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                <RippleButton size="small" variant="danger" onClick={() => recallOrder(viewing.id)}>Recall</RippleButton>
              </div>
            )}
            <div style={{ marginTop: "0.75rem" }}>
              <RippleButton size="small" variant="ghost" onClick={() => deleteOrder(viewing.id)}>Delete</RippleButton>
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Product</th><th style={{ textAlign: "right" }}>Ordered</th><th style={{ textAlign: "right" }}>Received</th><th style={{ textAlign: "right" }}>Unit Cost</th><th style={{ textAlign: "right" }}>Line Total</th><th>Receive</th></tr></thead>
            <tbody>
              {(viewing.items || []).map((i: any) => {
                const maxReceive = i.quantityOrdered - i.quantityReceived;
                const inputVal = receiveInputs[i.id] !== undefined ? receiveInputs[i.id] : maxReceive;
                return (
                  <tr key={i.id}>
                    <td>{escapeHtml(i.productName)}</td>
                    <td style={{ textAlign: "right" }}>{i.quantityOrdered}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{i.quantityReceived}</td>
                    <td style={{ textAlign: "right" }}>{formatPrice(i.unitCost)}</td>
                    <td style={{ textAlign: "right" }}>{formatPrice(i.unitCost * i.quantityReceived)}</td>
                    <td>
                      {i.serialTracking && i.quantityReceived > 0 && i.serials && i.serials.length > 0 && (
                        <div style={{ marginBottom: "0.35rem", fontSize: "0.75rem", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                          {(i.serials || []).join(", ")}
                        </div>
                      )}
                      {viewing.status === "ordered" && maxReceive > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", alignItems: "flex-start" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                            <input
                              type="number"
                              min={0}
                              max={maxReceive}
                              value={inputVal}
                              onChange={(e) => setReceiveInputs({ ...receiveInputs, [i.id]: Math.min(maxReceive, Math.max(0, Number(e.target.value))) })}
                              style={{ width: 60, fontSize: "0.85rem", padding: "0.2rem 0.4rem" }}
                            />
                            <RippleButton
                              size="small"
                              variant="ghost"
                              loading={receiving === i.id}
                              disabled={receiving !== null || inputVal <= 0}
                              onClick={() => receiveItem(i.id)}
                            >Save</RippleButton>
                          </div>
                          {i.serialTracking && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", alignItems: "flex-start" }}>
                              <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                                <RippleButton size="small" variant="ghost" disabled={serialising !== null} onClick={() => { setSerialModalItem(i); setSerialInput(""); setSerialMsg(""); }}>
                                  Enter Serials ({(receiveSerials[i.id] || []).length}/{inputVal})
                                </RippleButton>
                                <RippleButton size="small" variant="ghost" loading={serialising === i.id} disabled={serialising !== null && serialising !== i.id} onClick={() => serialiseItem(i.id, i.productId, inputVal)}>Serialise</RippleButton>
                              </div>
                              {(receiveSerials[i.id] || []).length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                                  {(receiveSerials[i.id] || []).map((s, idx) => (
                                    <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "var(--primary-light)", color: "var(--primary)", padding: "0.1rem 0.5rem", borderRadius: 999, fontSize: "0.75rem", fontFamily: "monospace" }}>
                                      {s}
                                      <button type="button" onClick={() => setReceiveSerials({ ...receiveSerials, [i.id]: (receiveSerials[i.id] || []).filter((_, i2) => i2 !== idx) })} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1 }}>&times;</button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{maxReceive <= 0 ? "Complete" : "—"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!viewing.items || viewing.items.length === 0) && <tr><td colSpan={6} style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-secondary)" }}>No items</td></tr>}
            </tbody>
          </table>
        </div>
        {serialModalItem && (() => {
          const need = receiveInputs[serialModalItem.id] !== undefined ? receiveInputs[serialModalItem.id] : (serialModalItem.quantityOrdered - serialModalItem.quantityReceived);
          const cur = receiveSerials[serialModalItem.id] || [];
          const closeModal = () => { setSerialModalItem(null); setSerialInput(""); setSerialMsg(""); };
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200 }} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
              <div className="panel" style={{ width: 460, maxWidth: "94vw", maxHeight: "80vh", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                  <h3 style={{ margin: 0 }}>Serials — {escapeHtml(serialModalItem.productName)}</h3>
                  <RippleButton size="small" variant="ghost" onClick={closeModal}>&times;</RippleButton>
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0 0 0.75rem" }}>
                  Scan or type each serial number and press Enter. {cur.length} of {need} added.
                </p>
                {serialMsg && <ErrorMsg msg={serialMsg} />}
                <input
                  autoFocus
                  placeholder="Scan or type a serial number..."
                  value={serialInput}
                  onChange={(e) => setSerialInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { closeModal(); return; }
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const sn = serialInput.trim();
                    if (!sn) return;
                    if (cur.includes(sn)) { setSerialMsg(`Serial ${sn} is already in the list.`); return; }
                    if (cur.length >= need) { setSerialMsg(`You only need ${need} serial number${need !== 1 ? "s" : ""}.`); return; }
                    setReceiveSerials({ ...receiveSerials, [serialModalItem.id]: [...cur, sn] });
                    setSerialInput("");
                    setSerialMsg("");
                  }}
                  style={{ width: "100%", fontFamily: "monospace", fontSize: "0.9rem", padding: "0.4rem 0.5rem", boxSizing: "border-box" }}
                />
                {cur.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.6rem" }}>
                    {cur.map((s, idx) => (
                      <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "var(--primary-light)", color: "var(--primary)", padding: "0.15rem 0.55rem", borderRadius: 999, fontSize: "0.78rem", fontFamily: "monospace" }}>
                        {s}
                        <button type="button" onClick={() => setReceiveSerials({ ...receiveSerials, [serialModalItem.id]: cur.filter((_, i2) => i2 !== idx) })} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1 }}>&times;</button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.75rem" }}>
                  <RippleButton size="small" variant="ghost" loading={serialising === serialModalItem.id} disabled={serialising !== null && serialising !== serialModalItem.id} onClick={() => serialiseItem(serialModalItem.id, serialModalItem.productId, need)}>Serialise</RippleButton>
                  <RippleButton size="small" onClick={closeModal}>Done</RippleButton>
                </div>
              </div>
            </div>
          );
        })()}
      </>
    );
  }

  if (creating) {
    return (
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h1 style={{ margin: 0 }}>Create Purchase Order</h1>
          <RippleButton size="small" variant="ghost" onClick={() => { setCreating(false); setForm({ supplierName: "", notes: "" }); setFormItems([]); }}>&larr; Cancel</RippleButton>
        </div>
        {msg && <ErrorMsg msg={msg} />}
        <div className="panel" style={{ maxWidth: 700 }}>
          <div className="field">
            <label>Supplier</label>
            <select value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })}>
              <option value="">Select supplier...</option>
              {suppliers.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.name}>{escapeHtml(s.name)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <h4 style={{ marginBottom: "0.5rem" }}>Items</h4>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", position: "relative" }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." style={{ flex: 1 }} />
            {search && filteredSearch.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, zIndex: 20, maxHeight: 200, overflowY: "auto" }}>
                {filteredSearch.map((p) => (
                  <div key={p.id} role="button" tabIndex={0} onClick={() => addFormItem(p)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); addFormItem(p); } }} style={{ padding: "0.4rem 0.6rem", cursor: "pointer", borderBottom: "1px solid var(--border)", fontSize: "0.85rem" }}>
                    {escapeHtml(p.name)} — {formatPrice(Number(p.price) || 0)}
                  </div>
                ))}
              </div>
            )}
          </div>
          {formItems.length > 0 && (
            <div className="table-wrap" style={{ marginBottom: "0.75rem" }}>
              <table className="data-table">
                <thead><tr><th>Product</th><th>Qty</th><th>Unit Cost</th><th></th></tr></thead>
                <tbody>
                  {formItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>{escapeHtml(item.productName)}</td>
                      <td><input type="number" min="1" value={item.quantity} onChange={(e) => updateFormItem(idx, "quantity", e.target.value)} style={{ width: 60 }} /></td>
                      <td><input type="number" min="0" step="0.01" value={item.unitCost} onChange={(e) => updateFormItem(idx, "unitCost", e.target.value)} style={{ width: 100 }} /></td>
                      <td><RippleButton size="small" variant="danger" aria-label="Remove item" onClick={() => removeFormItem(idx)}>✕</RippleButton></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <RippleButton onClick={createOrder} loading={saving} disabled={!form.supplierName || formItems.length === 0}>Create Purchase Order</RippleButton>
        </div>
      </>
    );
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "0.4rem 0.9rem", borderRadius: 6, border: "1px solid var(--border)", background: active ? "var(--primary)" : "transparent",
    color: active ? "var(--surface)" : "var(--text)", cursor: "pointer", fontSize: "0.85rem", fontWeight: active ? 600 : 400,
  });

  return (
    <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <h1 style={{ margin: 0 }}>Purchase Orders</h1>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <input type="search" placeholder="Search PO # or supplier..." value={listSearch} onChange={(e) => setListSearch(e.target.value)} aria-label="Search purchase orders" style={{ padding: "0.4rem 0.75rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.85rem", minWidth: 160 }} />
            <button type="button" style={tabStyle(listMode === "active")} aria-pressed={listMode === "active"} onClick={() => { setListMode("active"); loadOrders("active"); }}>Active</button>
            <button type="button" style={tabStyle(listMode === "completed")} aria-pressed={listMode === "completed"} onClick={() => { setListMode("completed"); loadOrders("completed"); }}>Completed</button>
            <button type="button" style={tabStyle(listMode === "deleted")} aria-pressed={listMode === "deleted"} onClick={() => { setListMode("deleted"); loadOrders("deleted"); }}>Deleted</button>
            <RippleButton size="small" onClick={() => { setCreating(true); loadFormDeps(); }}>+ New PO</RippleButton>
          </div>
        </div>
      {error && <ErrorMsg msg={error} />}
      {msg && <ErrorMsg msg={msg} />}
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>#</th><th>Supplier</th><th>Items</th><th>Status</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {orders.filter((o: any) => !listSearch.trim() || String(o.id).includes(listSearch.trim().toLowerCase()) || (o.supplierName || "").toLowerCase().includes(listSearch.trim().toLowerCase())).map((o: any) => (
              <tr key={o.id} style={{ cursor: "pointer" }} tabIndex={0} onClick={() => loadOrder(o.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); loadOrder(o.id); } }}>
                <td>{o.id}</td>
                <td>{escapeHtml(o.supplierName)}</td>
                <td>{(o.items || []).length}</td>
                <td><span className="plan-status" style={{ background: o.status === "received" ? "var(--success-light)" : o.status === "cancelled" ? "var(--danger-light)" : o.status === "ordered" ? "var(--primary-light)" : "var(--warning-light)", color: o.status === "received" ? "var(--success-text)" : o.status === "cancelled" ? "var(--danger-text)" : o.status === "ordered" ? "var(--primary)" : "var(--warning-text)" }}>{o.status}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>{formatDate(o.orderDate || o.order_date)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <RippleButton size="small" onClick={(e) => { e.stopPropagation(); loadOrder(o.id); }}>View</RippleButton>
                  {listMode === "deleted" ? (
                    <RippleButton size="small" variant="ghost" style={{ marginLeft: "0.25rem" }} onClick={(e) => { e.stopPropagation(); restoreOrder(o.id); }}>Restore</RippleButton>
                  ) : (
                    <RippleButton size="small" variant="danger" style={{ marginLeft: "0.25rem" }} onClick={(e) => { e.stopPropagation(); deleteOrder(o.id); }}>Delete</RippleButton>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6}><EmptyState icon="stock" title={listMode === "deleted" ? "No deleted purchase orders" : listMode === "completed" ? "No completed purchase orders" : "No purchase orders"} description={listMode === "deleted" ? "Deleted purchase orders will appear here." : listMode === "completed" ? "Completed (received) purchase orders will appear here." : "Create a purchase order to start tracking supplier purchases."} /></td></tr>}
            {orders.length > 0 && !orders.some((o: any) => !listSearch.trim() || String(o.id).includes(listSearch.trim().toLowerCase()) || (o.supplierName || "").toLowerCase().includes(listSearch.trim().toLowerCase())) && <tr><td colSpan={6}><EmptyState icon="stock" title="No matches" description={`No purchase orders match "${listSearch}".`} actionLabel="Clear search" onAction={() => setListSearch("")} /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ===================== PRODUCT POSITIONING =====================
const AdminProductPositioning = ProductPositioningPage;

// ===================== EMAIL SETTINGS =====================
function AdminReviews() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function loadReviews(p: number) {
    setLoading(true);
    api<{ reviews: any[]; total: number; totalPages: number }>(`/api/admin/reviews?page=${p}`).then((d) => {
      setReviews(d.reviews); setTotal(d.total); setTotalPages(d.totalPages); setPage(p);
    }).catch((e) => console.warn("[admin] Failed to load reviews:", e?.message)).finally(() => setLoading(false));
  }

  useEffect(() => { loadReviews(1); }, []);

  async function deleteReview(id: number, productId: string) {
    if (!(await confirmDialog({ message: "Delete this review?", confirmLabel: "Delete", danger: true }))) return;
    setDeletingId(id);
    try {
      await api(`/api/admin/products/${encodeURIComponent(productId)}/reviews/${id}`, { method: "DELETE" });
      loadReviews(page);
      toast("success", "Review deleted.");
    } catch (e: any) { toast("error", e.message || "Failed to delete."); }
    finally { setDeletingId(null); }
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 0.5rem" }}>Product Reviews</h2>
      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0 0 1rem" }}>{total} total review{total !== 1 ? "s" : ""}</p>
      {loading ? <p>Loading...</p> : reviews.length === 0 ? <p className="muted">No reviews yet.</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {reviews.map((r: any) => (
            <div key={r.id} className="panel" style={{ padding: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--accent)" }}>{Array.from({ length: 5 }).map((_, i) => i < r.rating ? "★" : "☆").join("")}</span>
                    <strong style={{ fontSize: "0.85rem" }}>{escapeHtml(r.customer_name || "Anonymous")}</strong>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>on</span>
                    <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{escapeHtml(r.product_name || r.product_id)}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{new Date(r.created_at).toLocaleDateString("en-GB")}</span>
                  </div>
                  {r.title && <p style={{ fontWeight: 600, margin: "0.15rem 0", fontSize: "0.9rem" }}>{escapeHtml(r.title)}</p>}
                  {r.comment && <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0.15rem 0" }}>{escapeHtml(r.comment)}</p>}
                </div>
                <button className="btn btn-sm btn-ghost" style={{ color: "var(--danger)", whiteSpace: "nowrap" }} onClick={() => deleteReview(r.id, r.product_id)} disabled={deletingId === r.id}>{deletingId === r.id ? "..." : "Delete"}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1rem" }}>
          <button className="btn btn-sm btn-ghost" disabled={page <= 1} onClick={() => loadReviews(page - 1)}>Previous</button>
          <span style={{ fontSize: "0.85rem", padding: "0.3rem 0.75rem", color: "var(--text-secondary)" }}>Page {page} of {totalPages}</span>
          <button className="btn btn-sm btn-ghost" disabled={page >= totalPages} onClick={() => loadReviews(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

function AdminEmailSettings() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    api<any>("/api/settings").then((s) => { setSettings(s); setLoading(false); }).catch(() => setLoading(false));
    loadLogs();
  }, []);

  async function loadLogs() {
    setLogsLoading(true);
    try { const d = await api<{ logs: any[] }>("/api/admin/email-logs"); setLogs(d.logs || []); } catch { setLogs([]); }
    finally { setLogsLoading(false); }
  }

  async function saveEmailSettings() {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await api<any>("/api/settings", { method: "PUT", body: JSON.stringify({ emailSender: settings.emailSender, emailSenderName: settings.emailSenderName, emailNotificationsEnabled: settings.emailNotificationsEnabled }) });
      setSettings(updated);
      toast("success", "Email settings saved.");
    } catch (e: any) { toast("error", "Failed: " + e.message); }
    finally { setSaving(false); }
  }

  async function sendTestEmail() {
    if (!testEmail) return;
    setTestMsg("Sending...");
    try { const d = await api<{ ok: boolean; message: string }>("/api/admin/email/test", { method: "POST", body: JSON.stringify({ to: testEmail }) }); setTestMsg(d.message); }
    catch (e: any) { setTestMsg("Error: " + e.message); }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Email Settings</h1>
      <div className="panel" style={{ maxWidth: 600, marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Configuration</h3>
        <div className="field">
          <label>Sender Email Address
            <input type="email" value={settings?.emailSender || ""} onChange={(e) => setSettings({ ...settings, emailSender: e.target.value })} placeholder="noreply@yourstore.com" />
          </label>
        </div>
        <div className="field">
          <label>Sender Display Name
            <input type="text" value={settings?.emailSenderName || ""} onChange={(e) => setSettings({ ...settings, emailSenderName: e.target.value })} placeholder="My Shop" />
          </label>
        </div>
        <div className="field">
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input type="checkbox" checked={settings?.emailNotificationsEnabled !== false} onChange={(e) => setSettings({ ...settings, emailNotificationsEnabled: e.target.checked })} />
            Enable email notifications
          </label>
        </div>
        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0.5rem 0 1rem" }}>
          SMTP server is configured via environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS). The sender address above is used as the "From" field.
        </p>
        <RippleButton onClick={saveEmailSettings} loading={saving}>Save</RippleButton>
      </div>

      <div className="panel" style={{ maxWidth: 600, marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Test Email</h3>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}><label>Email address<input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@example.com" /></label></div>
          <RippleButton onClick={sendTestEmail}>Send Test</RippleButton>
        </div>
        {testMsg && <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: testMsg.includes("Error") || testMsg.includes("failed") ? "var(--danger)" : "var(--success)" }}>{testMsg}</p>}
      </div>

      <div className="panel" style={{ maxWidth: 800 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h3 style={{ margin: 0 }}>Email Log</h3>
          <RippleButton size="small" variant="ghost" onClick={loadLogs}>Refresh</RippleButton>
        </div>
        {logsLoading ? <Spinner /> : logs.length === 0 ? <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>No emails sent yet.</p> : (
          <div className="table-wrap">
            <table className="data-table" style={{ fontSize: "0.8rem" }}>
              <thead><tr><th>To</th><th>Subject</th><th>Type</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {logs.map((l: any) => (
                  <tr key={l.id}>
                    <td>{escapeHtml(l.to_email)}</td>
                    <td>{escapeHtml(l.subject)}</td>
                    <td><span style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: 4, background: "var(--border)" }}>{l.type}</span></td>
                    <td><span style={{ color: l.status === "sent" ? "var(--success)" : l.status === "failed" ? "var(--danger)" : "var(--text-secondary)" }}>{l.status}</span></td>
                    <td>{new Date(l.created_at).toLocaleString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Delivery Fees (admin-configurable per-county) ─────────────────────
function AdminDeliveryFees() {
  const [counties, setCounties] = useState<{ id: string; name: string; region: string; fee: number }[]>([]);
  const [fees, setFees] = useState<Record<string, number>>({});
  const [defaults, setDefaults] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = getStaffToken();
        const res = await fetch("/api/admin/delivery-fees", { headers: { ...(token ? { Authorization: "Bearer " + token } : {}) } });
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setCounties(data.counties || []);
        const o = data.overrides || {};
        setFees(o);
        const d: Record<string, number> = {};
        for (const c of (data.counties || [])) d[c.id] = c.fee;
        setDefaults(d);
      } catch (e: any) { setMsg({ text: e.message || "Failed to load", error: true }); }
      finally { setLoading(false); }
    })();
  }, []);

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const data = await api<{ message?: string; counties?: any[] }>("/api/admin/delivery-fees", {
        method: "PUT",
        body: JSON.stringify({ fees }),
      });
      setMsg({ text: data?.message || "Saved." });
      if (data?.counties) setCounties(data.counties);
    } catch (e: any) { setMsg({ text: e.message || "Save failed", error: true }); }
    finally { setSaving(false); }
  }

  async function reset() {
    if (!(await confirmDialog({ message: "Reset all delivery fees to defaults?", confirmLabel: "Reset", danger: true }))) return;
    setSaving(true); setMsg(null);
    try {
      const data = await api<{ message?: string; counties?: any[] }>("/api/admin/delivery-fees", { method: "DELETE" });
      setFees({}); setMsg({ text: data?.message || "Reset to defaults." });
      if (data?.counties) setCounties(data.counties);
      toast("success", data?.message || "Delivery fees reset.");
    } catch (e: any) { setMsg({ text: e.message || "Reset failed", error: true }); toast("error", e.message || "Reset failed"); }
    finally { setSaving(false); }
  }

  if (loading) return <Spinner />;
  if (counties.length === 0) return <EmptyState title="No counties" description="Could not load county list." />;

  // Group counties by region for readability
  const regions: Record<string, { id: string; name: string; fee: number }[]> = {};
  for (const c of counties) (regions[c.region] ||= []).push(c);

  return (
    <>
      <h1>Delivery Fees</h1>
      <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "1.5rem" }}>Set the delivery charge (in KES) for each Kenyan county. Customers see these fees at checkout.</p>
      {msg && <div className={"form-status " + (msg.error ? "error" : "success")} style={{ marginBottom: "1rem" }}>{msg.text}</div>}
      <div className="panel" style={{ maxWidth: 720 }}>
        {Object.entries(regions).map(([region, cs]) => (
          <div key={region} style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>{escapeHtml(region)}</h3>
            <div className="form-grid" style={{ gap: "0.75rem" }}>
              {cs.map((c) => (
                <div className="field" key={c.id} style={{ marginBottom: 0 }}>
                  <label>{escapeHtml(c.name)}
                    <input
                      type="number"
                      min={0}
                      step={10}
                      className="input"
                      value={fees[c.id] ?? defaults[c.id] ?? c.fee}
                      onChange={(e) => setFees((f) => ({ ...f, [c.id]: Number(e.target.value) }))}
                      placeholder={String(c.fee)}
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
          <RippleButton onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Fees"}</RippleButton>
          <RippleButton variant="ghost" onClick={reset} disabled={saving}>Reset to Defaults</RippleButton>
        </div>
      </div>
    </>
  );
}
