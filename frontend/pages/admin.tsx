import React, { useEffect, useState, useRef } from "react";
import { api, getStaffToken } from "@/lib/api";
import type { Product, Order, SubscriptionPlan, Provider, Branch, Client } from "@/lib/types";
import RippleButton from "@/components/RippleButton";
import { SkeletonStats, SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import AnimatedCounter from "@/components/AnimatedCounter";
import { getLayoutList } from "@/layouts";
import { useApp } from "@/lib/app-context";
import NotificationBell from "@/components/NotificationBell";
import { useFeature } from "@/lib/features";
import { useToast } from "@/components/Toast";
import { formatPrice, escapeHtml, useFetch, Spinner, ErrorMsg } from "@/components/admin/shared";
import AdminProducts from "@/components/admin/AdminProducts";

declare global {
  interface Window {
    google?: { accounts: { id: { initialize: any; prompt: any; renderButton: any } } };
  }
}

export type AdminView = "dashboard" | "products" | "categories" | "orders" | "coupons" | "quotations" | "users" | "roles" | "plans" | "providers" | "invoices" | "reports" | "stock-take" | "stock-on-hand" | "stock-transfers" | "spec-templates" | "suppliers" | "clients" | "branches" | "shop-subscription" | "about-us" | "storefront" | "settings" | "credit-notes";

const NAV_GROUPS: { label: string; items: { key: AdminView; label: string }[] }[] = [
  {
    label: "Sales",
    items: [
      { key: "products", label: "Products" },
      { key: "categories", label: "Categories" },
      { key: "orders", label: "Orders" },
      { key: "coupons", label: "Coupons" },
      { key: "quotations", label: "Quotations" },
    ],
  },
  {
    label: "Administration",
    items: [
      { key: "users", label: "Users" },
      { key: "roles", label: "Roles" },
    ],
  },
  {
    label: "Clients",
    items: [
      { key: "clients", label: "Clients" },
      { key: "branches", label: "Branches" },
    ],
  },
  {
    label: "Operations",
    items: [
      { key: "plans", label: "Plans" },
      { key: "providers", label: "Providers" },
      { key: "invoices", label: "Invoices" },
      { key: "credit-notes", label: "Credit Notes" },
      { key: "reports", label: "Reports" },
      { key: "stock-on-hand", label: "Stock on Hand" },
      { key: "stock-transfers", label: "Stock Transfers" },
      { key: "stock-take", label: "Stock Take" },
    ],
  },
  {
    label: "System",
    items: [
      { key: "spec-templates", label: "Spec Templates" },
      { key: "suppliers", label: "Suppliers" },
      { key: "shop-subscription", label: "Shop Subscription" },
      { key: "about-us", label: "About Us" },
      { key: "storefront", label: "Storefront" },
      { key: "settings", label: "Settings" },
    ],
  },
];

export default function AdminPage() {
  const { isDark, toggleDark, settings, refreshSettings } = useApp();
  const [authed, setAuthed] = useState(false);
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
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["Sales", "Administration"]);
  const messagingEnabled = useFeature("Messaging");

  useEffect(() => {
    api<{ googleClientId: string }>("/api/storefront").then((d) => setGoogleClientId(d.googleClientId || "")).catch(() => {});
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
      localStorage.setItem("staffUserName", data.username || "Admin");
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
    if (getStaffToken()) setAuthed(true);
  }, []);

  useEffect(() => {
    if (authed) {
      api<{ requests: any[] }>("/api/shop/subscription/requests").then((d) => {
        setPendingCount((d.requests || []).filter((r) => r.status === "pending").length);
      }).catch(() => {});
    }
  }, [authed, view]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username: loginUsername, password: loginPassword }) });
      if (data.role !== "admin") { setLoginError("Admin access required."); return; }
      localStorage.setItem("computerStoreToken", data.token);
      localStorage.setItem("staffUserName", data.username || "Admin");
      setAuthed(true);
    } catch (err: any) { setLoginError(err.message); }
    finally { setLoginLoading(false); }
  }

  if (!authed) {
    return (
      <div className="auth-page" style={{ marginTop: "3rem" }}>
        <h1>Store Manager</h1>
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
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowForgotPw(false)}>
            <div className="panel" style={{ maxWidth: 400, width: "90%", position: "relative" }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginTop: 0 }}>Reset Password</h3>
              <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
                Enter your email address. If an admin account exists, we'll send a reset link.
              </p>
              <input value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@example.com" style={{ width: "100%", marginBottom: "0.75rem" }} />
              {forgotMsg && <p style={{ padding: "0.5rem", borderRadius: 6, background: "#d1fae5", color: "#065f46", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{forgotMsg}</p>}
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
    <div className="dash-layout">
      <nav className="dash-nav">
        <RippleButton
          variant="ghost"
          className={view === "dashboard" ? "active" : ""}
          onClick={() => setView("dashboard")}
          style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.5rem" }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1 }}>
              <span style={{ display: "block", width: 16, height: 3, background: "#000" }} />
              <span style={{ display: "block", width: 16, height: 3, background: "#BF1A2F" }} />
              <span style={{ display: "block", width: 16, height: 3, background: "#006600" }} />
            </span>
            Home
          </span>
        </RippleButton>
        {NAV_GROUPS.map((group) => {
          const isOpen = expandedGroups.includes(group.label);
          const isChildActive = group.items.some((item) => view === item.key);
          return (
            <div key={group.label} style={{ marginBottom: "0.25rem" }}>
              <div
                onClick={() => toggleGroup(group.label)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "0.4rem 0.5rem", cursor: "pointer", fontSize: "0.75rem",
                  fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
                  color: isChildActive ? "var(--primary)" : "var(--text-secondary)",
                  borderRadius: 6, userSelect: "none",
                }}
              >
                {group.label}
                <span style={{ fontSize: "0.6rem", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
              </div>
              {isOpen && group.items.map((item) => (
                <RippleButton
                  key={item.key}
                  variant="ghost"
                  className={view === item.key ? "active" : ""}
                  onClick={() => setView(item.key)}
                  style={{ paddingLeft: "1.25rem", fontSize: "0.85rem" }}
                >
                  {item.label}
                  {item.key === "shop-subscription" && pendingCount > 0 && <span className="bell-badge"><span className="bell-icon">🔔</span><span className="bell-count">{pendingCount}</span></span>}
                </RippleButton>
              ))}
            </div>
          );
        })}
        <RippleButton variant="ghost" style={{ color: "var(--primary)", marginTop: "0.5rem" }} onClick={() => { localStorage.removeItem("computerStoreToken"); window.location.href = "/"; }}>
          Sign out
        </RippleButton>
      </nav>
        <div className="dash-content">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {settings?.storeLogo && <img src={settings.storeLogo} alt="" style={{ height: 28, width: 28, objectFit: "contain", borderRadius: 4 }} />}
              <strong style={{ fontSize: "1rem" }}>{settings?.storeName || "Store"}</strong>
            </div>
            {messagingEnabled && <NotificationBell onClick={() => { window.location.href = "/owner"; }} />}
            <button type="button" onClick={toggleDark} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.3rem 0.6rem", cursor: "pointer", fontSize: "0.85rem", color: "var(--text)", lineHeight: 1 }}>{isDark ? "☀️" : "🌙"}</button>
          </div>
          <div className="dash-section active" key={view}>
            {view === "dashboard" && <AdminDashboard onNavigate={setView} />}
            {view === "products" && <AdminProducts />}
            {view === "categories" && <AdminCategories />}
            {view === "orders" && <AdminOrders />}
            {view === "coupons" && <AdminCoupons />}
            {view === "quotations" && <AdminQuotations />}
            {view === "users" && <AdminUsers />}
            {view === "roles" && <AdminRoles />}
            {view === "plans" && <AdminPlans />}
            {view === "providers" && <AdminProviders />}
            {view === "invoices" && <AdminInvoices />}
            {view === "credit-notes" && <AdminCreditNotes />}
            {view === "reports" && <AdminReports />}
            {view === "stock-on-hand" && <AdminStockOnHand />}
            {view === "stock-transfers" && <AdminStockTransfers />}
            {view === "stock-take" && <AdminStockTake />}
            {view === "clients" && <AdminClients />}
            {view === "branches" && <AdminBranches />}
            {view === "spec-templates" && <AdminSpecTemplates />}
            {view === "suppliers" && <AdminSuppliers />}
            {view === "shop-subscription" && <AdminShopSubscription />}
            {view === "about-us" && <AdminAboutUs />}
            {view === "storefront" && <AdminStorefront />}
            {view === "settings" && <AdminSettings />}
          </div>
          </div>
      </div>
  );
}

function AdminDashboard({ onNavigate }: { onNavigate: (v: AdminView) => void }) {
  const { data: stats, loading: statsLoading } = useFetch(() => api<any>("/api/backoffice/stats"), []);
  const { data: products, loading: prodLoading } = useFetch(() => api<{ products: Product[] }>("/api/products"), []);
  const { data: subReq, loading: subLoading } = useFetch(() => api<{ requests: any[] }>("/api/shop/subscription/requests"), []);

  const pendingReqs = (subReq?.requests || []).filter((r: any) => r.status === "pending").length;
  const loading = statsLoading || prodLoading || subLoading;

  if (loading) return <><h1>Dashboard</h1><SkeletonStats /></>;

  return (
    <>
      <h1 className="anim-fade-in-down">Dashboard</h1>
      <div className="stat-grid">
        <div className="stat-card card-hover" style={{ cursor: "pointer" }} onClick={() => onNavigate("products")}>
          <div className="stat-card__value"><AnimatedCounter value={products?.products?.length ?? 0} /></div>
          <div className="stat-card__label">Total Products</div>
        </div>
        <div className="stat-card card-hover" style={{ cursor: "pointer" }} onClick={() => onNavigate("users")}>
          <div className="stat-card__value"><AnimatedCounter value={stats?.totalStaff ?? 0} /></div>
          <div className="stat-card__label">Users</div>
        </div>
        <div className="stat-card card-hover" style={{ cursor: "pointer", borderColor: pendingReqs > 0 ? "#dc2626" : undefined }} onClick={() => onNavigate("shop-subscription")}>
          <div className="stat-card__value" style={{ color: pendingReqs > 0 ? "#dc2626" : undefined }}><AnimatedCounter value={pendingReqs} /></div>
          <div className="stat-card__label" style={{ color: pendingReqs > 0 ? "#dc2626" : undefined }}>Pending Sub. Requests</div>
        </div>
      </div>
    </>
  );
}

// ===================== PRODUCTS =====================
// ===================== CATEGORIES =====================
function AdminCategories() {
  const { data: cData, loading, error, refetch } = useFetch(() => api<any>("/api/categories"), []);
  const [detail, setDetail] = useState<{ mode: "add" | "edit"; cat: any } | null>(null);
  const [formLabel, setFormLabel] = useState("");
  const [formGroup, setFormGroup] = useState("");
  const [formShowOnPos, setFormShowOnPos] = useState(true);
  const [catSubs, setCatSubs] = useState<any[]>([]);
  const [newSubId, setNewSubId] = useState("");
  const [newSubName, setNewSubName] = useState("");
  const [editSubId, setEditSubId] = useState("");
  const [editSubName, setEditSubName] = useState("");

  async function deleteCat(id: string) {
    if (!confirm(`Delete category "${id}"?`)) return;
    try { await api(`/api/categories/${encodeURIComponent(id)}`, { method: "DELETE" }); refetch(); } catch { alert("Delete failed"); }
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
    } catch { alert("Failed to save category"); }
  }

  async function addSub() {
    if (!newSubId.trim() || !newSubName.trim()) return;
    const catId = detail?.cat?.id || formLabel.trim().toLowerCase().replace(/\s+/g, "-");
    try {
      await api("/api/subcategories", { method: "POST", body: JSON.stringify({ id: newSubId.trim(), name: newSubName.trim(), category_ids: [catId] }) });
      setNewSubId(""); setNewSubName(""); loadSubs();
    } catch { alert("Failed to add subcategory"); }
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
    } catch { alert("Failed to update subcategory"); }
  }

  async function deleteSub(id: string) {
    if (!confirm(`Delete subcategory "${id}"?`)) return;
    try { await api(`/api/subcategories/${encodeURIComponent(id)}`, { method: "DELETE" }); loadSubs(); } catch { alert("Delete failed"); }
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
          <div className="field"><label>Group<input value={formGroup} onChange={(e) => setFormGroup(e.target.value)} placeholder="e.g. Laptops, PCs" /></label></div>
          <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}><label style={{ margin: 0 }}>Show on POS</label><input type="checkbox" checked={formShowOnPos} onChange={(e) => setFormShowOnPos(e.target.checked)} style={{ width: "auto" }} /></div>
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
                        <RippleButton size="small" onClick={saveEditSub}>Save</RippleButton>
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
                  <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{c.group || "—"}</td>
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

// ===================== ORDERS =====================
function AdminOrders() {
  const { data: oData, loading, error, refetch } = useFetch(() => api<{ orders: Order[] }>("/api/admin/orders"), []);
  const [selected, setSelected] = useState<any | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [creditedOrders, setCreditedOrders] = useState<Record<number, boolean>>({});

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
      if (order.customerId) {
        api<any>(`/api/admin/customers/${order.customerId}`).then(setCustomerDetail).catch(() => setCustomerDetail(null));
      } else { setCustomerDetail(null); }
    } catch { alert("Failed to load order"); }
  }

  useEffect(() => {
    if (!oData?.orders?.length) return;
    const ids = oData.orders.map((o) => o.id).join(",");
    api<{ credited: Record<number, boolean> }>(`/api/admin/credit-notes/order-status?orderIds=${ids}`).then((d) => setCreditedOrders(d.credited || {})).catch(() => {});
  }, [oData]);

  async function printInvoice(orderId: number) {
    try {
      const res = await api<{ token: string }>("/api/admin/invoice-token/" + orderId, { method: "POST" });
      window.open(`/api/admin/orders/${orderId}/invoice?token=${encodeURIComponent(res.token)}`, "_blank");
    } catch {
      alert("Failed to generate invoice link.");
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
                  Status: <span style={{ color: customerDetail.is_active ? "#16a34a" : "#dc2626" }}>{customerDetail.is_active ? "Active" : "Inactive"}</span>
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
            <p style={{ margin: "0.2rem 0", fontSize: "0.9rem" }}>Subtotal: {formatPrice(o.subtotal)}</p>
            <p style={{ margin: "0.2rem 0", fontSize: "0.9rem" }}>Shipping: {formatPrice(o.shippingFee || 0)}</p>
            <p style={{ margin: "0.2rem 0", fontWeight: 700 }}>Total: {formatPrice(total)}</p>
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
              <span className="btn btn-sm" style={{ background: "#d1fae5", color: "#065f46", cursor: "default" }}>Credit Note Created</span>
            ) : (
              <RippleButton onClick={async () => {
                const reason = prompt("Reason for credit note (optional):");
                if (reason === null) return;
                try {
                  await api("/api/admin/credit-notes", {
                    method: "POST",
                    body: JSON.stringify({ orderId: o.id, reason: reason || "" }),
                  });
                  setCreditedOrders((prev) => ({ ...prev, [o.id]: true }));
                  alert("Credit note created.");
                } catch (e: any) { alert(e.message || "Failed to create credit note."); }
              }} style={{ background: "var(--primary)", color: "#fff" }}>Credit Note</RippleButton>
            )}
            <RippleButton onClick={() => printInvoice(o.id)}>Print Invoice</RippleButton>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Total</th><th>Warranty</th></tr></thead>
            <tbody>
              {(o.items || []).map((item: any, i: number) => (
                <tr key={item.id || i}>
                  <td>{escapeHtml(item.name)}</td>
                  <td>{formatPrice(item.price)}</td>
                  <td>{item.quantity}</td>
                  <td>{formatPrice(item.lineTotal)}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
                      <input type="checkbox" checked={!!item.hasWarranty} onChange={async () => {
                        try {
                          await api(`/api/admin/order-items/${item.id}/warranty`, { method: "PATCH", body: JSON.stringify({ hasWarranty: !item.hasWarranty, warrantyDuration: item.warrantyDuration }) });
                          setSelected({ ...o, items: o.items.map((it: any) => it.id === item.id ? { ...it, hasWarranty: !item.hasWarranty ? 1 : 0 } : it) });
                        } catch { alert("Failed to update warranty"); }
                      }} />
                      {item.hasWarranty ? (
                        <input type="number" min="0" style={{ width: 50 }} value={item.warrantyDuration || 0} onChange={async (e) => {
                          const v = Number(e.target.value);
                          try {
                            await api(`/api/admin/order-items/${item.id}/warranty`, { method: "PATCH", body: JSON.stringify({ hasWarranty: true, warrantyDuration: v }) });
                            setSelected({ ...o, items: o.items.map((it: any) => it.id === item.id ? { ...it, warrantyDuration: v } : it) });
                          } catch { alert("Failed"); }
                        }} />
                      ) : null}
                      <span>{item.hasWarranty ? "mo" : ""}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>Orders</h1>
      {statusMsg && <p style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 1rem" }}>{statusMsg}</p>}
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>#</th><th>Customer</th><th>Total</th><th>County</th><th>Status</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => openOrder(o.id)}>
                <td>{o.id}</td>
                <td>{escapeHtml(o.shippingName || "—")}</td>
                <td>{formatPrice(o.subtotal + o.shippingFee)}</td>
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
            {orders.length === 0 && <tr><td colSpan={7}><EmptyState icon="orders" title="No orders yet" description="Customer orders will appear here." /></td></tr>}
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
    try { await api("/api/staff", { method: "POST", body: JSON.stringify(form) }); setShowForm(false); setForm({ username: "", email: "", password: "", role: "technician" }); refetch(); } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function deleteStaff(id: number) {
    if (!confirm("Remove this user?")) return;
    try { await api(`/api/staff/${id}`, { method: "DELETE" }); refetch(); if (selectedUser?.id === id) setSelectedUser(null); } catch { alert("Delete failed"); }
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
    if (!selectedUser || pwForm.password.length < 8) { alert("Password must be at least 8 characters."); return; }
    if (pwForm.password !== pwForm.confirm) { alert("Passwords do not match."); return; }
    setSavingPw(true);
    try {
      await api(`/api/staff/${selectedUser.id}/reset-password`, { method: "POST", body: JSON.stringify({ password: pwForm.password }) });
      setPwForm({ password: "", confirm: "" });
      alert("Password reset successfully.");
    } catch (err: any) { alert(err.message); }
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
    } catch (err: any) { alert(err.message); }
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
            <div className="field"><label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="admin">Admin</option><option value="owner">Owner</option><option value="technician">Technician</option><option value="manager">Manager</option></select></label></div>
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
          {msg && <p style={{ padding: "0.5rem 1rem", borderRadius: 8, background: msg.startsWith("Error") ? "#fee2e2" : "#d1fae5", color: msg.startsWith("Error") ? "#991b1b" : "#065f46", marginBottom: "0.75rem", fontSize: "0.85rem" }}>{msg}</p>}

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
                      color: isDirect ? "#fff" : isInherited ? "var(--text-secondary)" : "var(--text)",
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

          <RippleButton onClick={saveAll} loading={saving}>Save Changes</RippleButton>
        </>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Username</th><th>Email</th><th>Role</th><th></th></tr></thead>
            <tbody>
              {staff.map((s: any) => (
                <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => selectUser(s)}>
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
  const [roleForm, setRoleForm] = useState({ id: "", name: "", description: "", permissions: [] as string[] });
  const [saving, setSaving] = useState(false);

  const permissions = permsData?.permissions || {};
  const allRoles = rolesData?.roles || [];

  function openNew() { setNewRole(true); setEditingRole(null); setRoleForm({ id: "", name: "", description: "", permissions: [] }); }

  function openEdit(role: any) {
    setNewRole(false); setEditingRole(role);
    setRoleForm({ id: role.id, name: role.name, description: role.description || "", permissions: role.permissions || [] });
  }

  function togglePerm(perm: string) {
    setRoleForm((p) => ({ ...p, permissions: p.permissions.includes(perm) ? p.permissions.filter((x) => x !== perm) : [...p.permissions, perm] }));
  }

  async function saveRole(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { name: roleForm.name, description: roleForm.description, permissions: roleForm.permissions };
      if (newRole) {
        await api("/api/roles", { method: "POST", body: JSON.stringify({ roleId: roleForm.id || roleForm.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), ...body }) });
      } else {
        await api(`/api/roles/${editingRole.id}`, { method: "PUT", body: JSON.stringify(body) });
      }
      setNewRole(false); setEditingRole(null); refetch(); toast("success", "Saved successfully");
    } catch (err: any) { toast("error", err.message); } finally { setSaving(false); }
  }

  async function deleteRole(id: string) {
    if (!confirm("Delete this role?")) return;
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
                  <label key={key} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", cursor: "pointer", padding: "0.2rem 0.5rem", borderRadius: 6, background: roleForm.permissions.includes(key) ? "var(--primary)" : "var(--bg)", color: roleForm.permissions.includes(key) ? "#fff" : "var(--text)" }}>
                    <input type="checkbox" checked={roleForm.permissions.includes(key)} onChange={() => togglePerm(key)} style={{ display: "none" }} />
                    <span title={label}>{key}</span>
                  </label>
                ))}
              </div>
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
                {r.isCustom && <RippleButton size="small" variant="danger" onClick={() => deleteRole(r.id)}>Delete</RippleButton>}
              </div>
            </div>
            {r.description && <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>{escapeHtml(r.description)}</p>}
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>{r.permissions.length} permission{r.permissions.length !== 1 ? "s" : ""}</p>
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
const COMMON_FEATURES = [
  "Analytics dashboard", "API access", "Audit log",
  "Barcode scanning", "Branch management", "Bulk import/export",
  "Bulk product edit", "Client/tenant management",
  "Custom branding", "Customer management",
  "Dedicated account manager", "Discount/coupon management",
  "Email notifications", "eTIMS/KRA compliance",
  "Google Sign-In", "Inventory forecasting",
  "Low stock alerts", "Loyalty program",
  "Messaging", "M-Pesa integration",
  "Multi-branch support", "Multi-currency support",
  "Multiple staff accounts", "Order management",
  "Payment method configuration", "POS integration",
  "Price history tracking", "Priority support",
  "Product listing", "Product reviews & ratings",
  "Purchase order management", "Quotations",
  "Repair ticketing", "Returns management",
  "Shop subscription", "SMS notifications",
  "Spec templates", "Stock take / inventory count",
  "Stock transfers", "Supplier management",
  "Theme customization",
];

function AdminPlans() {
  const { data: pData, loading, error, refetch } = useFetch(() => api<{ plans: SubscriptionPlan[] }>("/api/admin/plans"), []);
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", price: 0, maxProducts: 10, features: [] as string[] });
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
    setForm({ id: "", name: "", price: 0, maxProducts: 10, features: [] });
    setShowForm(true);
  }

  function openEdit(plan: SubscriptionPlan) {
    setEditing(plan);
    setForm({ id: plan.id, name: plan.name, price: plan.price, maxProducts: plan.maxProducts, features: parseFeatures(plan.features) });
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
        maxProducts: Number(form.maxProducts),
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
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function deletePlan(id: string) {
    if (!confirm("Delete this plan?")) return;
    try { await api(`/api/admin/plans/${encodeURIComponent(id)}`, { method: "DELETE" }); refetch(); } catch { alert("Delete failed"); }
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem" }}>
              <div className="field"><label>Plan ID (slug)<input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder={toId(form.name) || "e.g. premium"} /></label></div>
              <div className="field"><label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label></div>
              <div className="field"><label>Price (KES)<input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required /></label></div>
              <div className="field"><label>Max products<input type="number" value={form.maxProducts} onChange={(e) => setForm({ ...form, maxProducts: Number(e.target.value) })} required /></label></div>
            </div>
            <div className="field">
              <label>Features</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.5rem" }}>
                {COMMON_FEATURES.map((f) => (
                  <label key={f} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.85rem", cursor: "pointer", padding: "0.2rem 0.5rem", borderRadius: 6, background: form.features.includes(f) ? "var(--primary)" : "var(--bg)", color: form.features.includes(f) ? "#fff" : "var(--text)" }}>
                    <input type="checkbox" checked={form.features.includes(f)} onChange={() => toggleFeature(f)} style={{ display: "none" }} />
                    {f}
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.35rem" }}>
                <input value={customInput} onChange={(e) => setCustomInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} placeholder="Custom feature..." style={{ flex: 1 }} />
                <RippleButton size="small" onClick={addCustom}>Add</RippleButton>
              </div>
              {form.features.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.5rem" }}>
                  {form.features.map((f) => (
                    <span key={f} onClick={() => toggleFeature(f)} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", padding: "0.15rem 0.5rem", borderRadius: 999, background: "var(--border)", color: "var(--text)", cursor: "pointer" }}>
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
            <div key={p.id} className="panel" style={{ position: "relative", display: "flex", flexDirection: "column" }}>
              <div style={{ position: "absolute", top: "0.5rem", right: "0.5rem", display: "flex", gap: "0.25rem" }}>
                <RippleButton size="small" onClick={() => openEdit(p)}>Edit</RippleButton>
                {!["starter", "basic", "pro", "enterprise"].includes(p.id) && (
                  <RippleButton size="small" variant="danger" onClick={() => deletePlan(p.id)}>Delete</RippleButton>
                )}
              </div>
              <h3 style={{ marginTop: 0 }}>{escapeHtml(p.name)}</h3>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--primary)", margin: "0 0 0.25rem" }}>{formatPrice(p.price)}<span style={{ fontSize: "0.8rem", fontWeight: 400, opacity: 0.6 }}>/mo</span></p>
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
function AdminProviders() {
  const { data: pData, loading, error, refetch } = useFetch(() => api<{ providers: Provider[] }>("/api/admin/providers"), []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ companyName: "", contactName: "", email: "", password: "", phone: "", pin: "" });
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  async function createProvider(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await api("/api/admin/providers", { method: "POST", body: JSON.stringify(form) });
      setShowForm(false); setForm({ companyName: "", contactName: "", email: "", password: "", phone: "", pin: "" }); refetch();
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await api(`/api/admin/providers/${editing.id}`, { method: "PUT", body: JSON.stringify(form) });
      setEditing(null); setForm({ companyName: "", contactName: "", email: "", password: "", phone: "", pin: "" }); refetch();
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  }

  function openEdit(p: any) {
    setForm({ companyName: p.companyName, contactName: p.contactName, email: p.email, password: "", phone: p.phone || "", pin: "" });
    setEditing(p);
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const providers = pData?.providers || [];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Providers</h1>
        {!editing && <RippleButton size="small" onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ Add"}</RippleButton>}
      </div>
      {(showForm || editing) && (
        <div className="panel" style={{ marginBottom: "1rem", maxWidth: 400 }}>
          <form onSubmit={editing ? saveEdit : createProvider}>
            <h3 style={{ marginTop: 0 }}>{editing ? `Edit ${escapeHtml(editing.companyName)}` : "New Provider"}</h3>
            <div className="field"><label>Company<input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required /></label></div>
            <div className="field"><label>Contact name<input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} required /></label></div>
            <div className="field"><label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label></div>
            {editing ? (
              <div className="field"><label>New password (leave blank to keep)<input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label></div>
            ) : (
              <div className="field"><label>Password<input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label></div>
            )}
            <div className="field"><label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label></div>
            <div className="field"><label>PIN (min 6 digits, leave blank to keep)<input type="tel" value={form.pin} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setForm({ ...form, pin: v }); }} placeholder="e.g. 123456" minLength={6} /></label></div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <RippleButton type="submit" loading={saving}>{editing ? "Save" : "Add provider"}</RippleButton>
              {editing && <RippleButton variant="ghost" onClick={() => { setEditing(null); setForm({ companyName: "", contactName: "", email: "", password: "", phone: "", pin: "" }); }}>Cancel</RippleButton>}
            </div>
          </form>
        </div>
      )}
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Company</th><th>Contact</th><th>Email</th><th>Phone</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.id}>
                <td><strong>{escapeHtml(p.companyName)}</strong></td>
                <td>{escapeHtml(p.contactName)}</td>
                <td>{escapeHtml(p.email)}</td>
                <td>{escapeHtml(p.phone || "—")}</td>
                <td><span className="plan-status">{p.status}</span></td>
                <td><RippleButton size="small" variant="ghost" onClick={() => openEdit(p)}>Edit</RippleButton></td>
              </tr>
            ))}
            {providers.length === 0 && <tr><td colSpan={6}><EmptyState icon="default" title="No providers" description="Provider companies will appear here once added." /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

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
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function toggleClient(c: Client) {
    try {
      await api(`/api/admin/clients/${c.id}`, { method: "PUT", body: JSON.stringify({ isActive: !c.isActive }) });
      refetch();
    } catch (err: any) { alert(err.message); }
  }

  async function deleteClient(id: number) {
    if (!confirm("Delete this client and all their data?")) return;
    try { await api(`/api/admin/clients/${id}`, { method: "DELETE" }); refetch(); } catch (err: any) { alert(err.message); }
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
    } catch (err: any) { alert(err.message); }
    finally { setSavingBranch(false); }
  }

  async function deleteBranch(branchId: number) {
    if (!selectedClient || !confirm("Delete this branch?")) return;
    try { await api(`/api/admin/clients/${selectedClient.id}/branches/${branchId}`, { method: "DELETE" }); refetchBranches(); } catch (err: any) { alert(err.message); }
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
          <p><strong>Status:</strong> <span style={{ color: selectedClient.isActive ? "#16a34a" : "#dc2626" }}>{selectedClient.isActive ? "Active" : "Inactive"}</span></p>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem" }}>
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
                <td><span style={{ color: c.isActive ? "#16a34a" : "#dc2626", fontSize: "0.85rem" }}>{c.isActive ? "Active" : "Inactive"}</span></td>
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
  const { data: bData, loading, error, refetch } = useFetch(() => api<{ branches: Branch[] }>("/api/admin/branches"), []);
  const { data: sData } = useFetch(() => api<{ staff: { id: number; username: string; role: string }[] }>("/api/staff"), []);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "", managerId: "" });
  const [saving, setSaving] = useState(false);

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
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function toggleBranch(b: Branch) {
    try {
      await api(`/api/admin/branches/${b.id}`, { method: "PUT", body: JSON.stringify({ isActive: !b.isActive }) });
      refetch();
    } catch (err: any) { alert(err.message); }
  }

  async function deleteBranch(id: number) {
    if (!confirm("Delete this branch?")) return;
    try { await api(`/api/admin/branches/${id}`, { method: "DELETE" }); refetch(); } catch (err: any) { alert(err.message); }
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem" }}>
              <div className="field"><label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label></div>
              <div className="field"><label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label></div>
            </div>
            <div className="field">
              <label>Assigned Owner</label>
              <select value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
                <option value="">— No owner assigned —</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{escapeHtml(o.username)}</option>)}
              </select>
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
          <thead><tr><th>Name</th><th>Address</th><th>Phone</th><th>Email</th><th>Owner</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id}>
                <td><strong>{escapeHtml(b.name)}</strong></td>
                <td>{escapeHtml(b.address || "—")}</td>
                <td>{escapeHtml(b.phone || "—")}</td>
                <td>{escapeHtml(b.email || "—")}</td>
                <td>{b.managerName ? escapeHtml(b.managerName) : <span className="muted">Unassigned</span>}</td>
                <td><span className={`plan-status ${b.isActive ? "active" : ""}`} style={{ background: b.isActive ? "var(--success)" : "var(--danger)", color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: "0.8rem" }}>{b.isActive ? "Active" : "Inactive"}</span></td>
                <td>
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    <RippleButton size="small" onClick={() => openEdit(b)}>Edit</RippleButton>
                    <RippleButton size="small" variant="ghost" onClick={() => toggleBranch(b)}>{b.isActive ? "Deactivate" : "Activate"}</RippleButton>
                    <RippleButton size="small" variant="danger" onClick={() => deleteBranch(b.id)}>Delete</RippleButton>
                  </div>
                </td>
              </tr>
            ))}
            {branches.length === 0 && <tr><td colSpan={7}><EmptyState icon="default" title="No branches yet" description="Create your first branch to start managing multi-location operations." actionLabel="+ Add Branch" onAction={openNew} /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ===================== INVOICES =====================
function AdminInvoices() {
  const [tab, setTab] = useState<"provider" | "orders">("provider");
  const { data: iData, loading, error, refetch } = useFetch(() => api<{ invoices: any[] }>("/api/admin/invoices"), []);
  const { data: oiData, loading: oiLoading, error: oiError, refetch: refetchOi } = useFetch(() => api<{ invoices: any[] }>("/api/admin/order-invoices"), []);
  const [oiStatusMsg, setOiStatusMsg] = useState("");
  const [creditedOrders, setCreditedOrders] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (tab !== "orders" || !oiData?.invoices?.length) return;
    const ids = [...new Set(oiData.invoices.map((inv: any) => inv.orderId))].join(",");
    if (!ids) return;
    api<{ credited: Record<number, boolean> }>(`/api/admin/credit-notes/order-status?orderIds=${ids}`).then((d) => setCreditedOrders(d.credited || {})).catch(() => {});
  }, [oiData, tab]);

  async function markPaid(id: number) {
    try { await api(`/api/admin/invoices/${id}/pay`, { method: "POST" }); refetch(); } catch { alert("Failed"); }
  }

  async function markOiPaid(id: number) {
    try { await api(`/api/admin/order-invoices/${id}/pay`, { method: "POST" }); setOiStatusMsg("Invoice marked as paid."); refetchOi(); } catch { alert("Failed"); }
  }

  async function generateInvoice() {
    try { await api("/api/admin/invoices/generate", { method: "POST" }); refetch(); } catch { alert("Generation failed"); }
  }

  async function createCreditNote(orderId: number) {
    const reason = window.prompt("Reason for credit note (optional):");
    if (reason === null) return;
    try {
      const created = await api<any>("/api/admin/credit-notes", {
        method: "POST",
        body: JSON.stringify({ orderId, reason: reason.trim() }),
      });
      setCreditedOrders((prev) => ({ ...prev, [orderId]: true }));
      window.open(`/api/admin/credit-notes/${created.id}/view`, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      alert(err.message || "Failed to create credit note.");
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Invoices</h1>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <RippleButton size="small" variant={tab === "provider" ? "primary" : "ghost"} onClick={() => setTab("provider")}>Provider</RippleButton>
        <RippleButton size="small" variant={tab === "orders" ? "primary" : "ghost"} onClick={() => setTab("orders")}>Orders</RippleButton>
      </div>

      {tab === "provider" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
            <RippleButton size="small" onClick={generateInvoice}>Generate</RippleButton>
          </div>
          {(() => {
            if (loading) return <Spinner />;
            if (error) return <ErrorMsg msg={error} />;
            const invoices = iData?.invoices || [];
            return (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>#</th><th>Provider</th><th>Amount</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td>{inv.id}</td>
                        <td>{escapeHtml(inv.providerName || "—")}</td>
                        <td>{formatPrice(inv.amount)}</td>
                        <td><span className={`plan-status`} style={{ background: inv.status === "paid" ? "#d1fae5" : "#fef3c7", color: inv.status === "paid" ? "#065f46" : "#92400e" }}>{inv.status}</span></td>
                        <td>{inv.status !== "paid" && <button className="btn btn-sm" onClick={() => markPaid(inv.id)}>Mark paid</button>}</td>
                      </tr>
                    ))}
                    {invoices.length === 0 && <tr><td colSpan={5}><EmptyState icon="invoices" title="No invoices" description="Invoices will appear here once generated." /></td></tr>}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </>
      )}

      {tab === "orders" && (
        <>
          {oiStatusMsg && <p style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 1rem", marginBottom: "0.75rem" }}>{oiStatusMsg}</p>}
          {(() => {
            if (oiLoading) return <Spinner />;
            if (oiError) return <ErrorMsg msg={oiError} />;
            const invoices = oiData?.invoices || [];
            return (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>#</th><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th><th></th></tr></thead>
                  <tbody>
                    {invoices.map((inv: any) => (
                      <tr key={inv.id}>
                        <td>{inv.id}</td>
                        <td>#{inv.orderId}</td>
                        <td>{escapeHtml(inv.customer_name || "—")}</td>
                        <td>{formatPrice(inv.amount)}</td>
                        <td><span className="plan-status" style={{ background: inv.status === "paid" ? "#d1fae5" : "#fef3c7", color: inv.status === "paid" ? "#065f46" : "#92400e" }}>{inv.status}</span></td>
                        <td style={{ whiteSpace: "nowrap" }}>{new Date(inv.createdAt || inv.created_at).toLocaleDateString("en-GB")}</td>
                        <td>
                          {inv.status !== "paid" && <button className="btn btn-sm" onClick={() => markOiPaid(inv.id)}>Mark paid</button>}
                          <button className="btn btn-sm btn-ghost" style={{ marginLeft: "0.25rem" }} onClick={async () => { try { const r = await api<{ token: string }>("/api/admin/invoice-token/" + inv.orderId, { method: "POST" }); window.open(`/api/admin/orders/${inv.orderId}/invoice?token=${encodeURIComponent(r.token)}`, "_blank"); } catch { alert("Failed"); } }}>View</button>
                          {creditedOrders[inv.orderId] ? (
                            <span className="btn btn-sm" style={{ marginLeft: "0.25rem", background: "#d1fae5", color: "#065f46", cursor: "default" }}>Credited</span>
                          ) : (
                            <button className="btn btn-sm" style={{ marginLeft: "0.25rem", background: "var(--primary)", color: "#fff" }} onClick={() => createCreditNote(inv.orderId)}>Credit Note</button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {invoices.length === 0 && <tr><td colSpan={7}><EmptyState icon="invoices" title="No order invoices" description="Order invoices appear automatically when an order is shipped or delivered." /></td></tr>}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </>
      )}
    </>
  );
}

// ===================== CREDIT NOTES =====================
function AdminCreditNotes() {
  const { data, loading, error, refetch } = useFetch(() => api<{ creditNotes: any[] }>('/api/admin/credit-notes'), []);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  const creditNotes = data?.creditNotes || [];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Credit Notes</h1>
        <RippleButton size="small" onClick={() => refetch()}>Refresh</RippleButton>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>#</th><th>Order</th><th>Customer</th><th>Amount</th><th>Reason</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {creditNotes.map((note: any) => (
              <tr key={note.id}>
                <td>#{note.id}</td>
                <td>#{note.orderId}</td>
                <td>{escapeHtml(note.customerName || note.customer_name || '—')}</td>
                <td>{formatPrice(note.totalAmount || 0)}</td>
                <td>{escapeHtml(note.reason || '—')}</td>
                <td><span className="plan-status" style={{ background: note.status === 'submitted' ? '#d1fae5' : '#fef3c7', color: note.status === 'submitted' ? '#065f46' : '#92400e' }}>{note.status}</span></td>
                <td>
                  <button className="btn btn-sm btn-ghost" onClick={() => window.open(`/api/admin/credit-notes/${note.id}/view`, '_blank', 'noopener,noreferrer')}>View</button>
                </td>
              </tr>
            ))}
            {creditNotes.length === 0 && <tr><td colSpan={7}><EmptyState icon="invoices" title="No credit notes" description="Credit notes created from invoices will appear here." /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ===================== ABOUT US =====================
function AdminAboutUs() {
  const [data, setData] = useState({ title: "", content: "", mission: "", vision: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const d = await api<any>("/api/admin/about-us");
      setData({ title: d.title || "", content: d.content || "", mission: d.mission || "", vision: d.vision || "" });
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      await api("/api/admin/about-us", { method: "PUT", body: JSON.stringify(data) });
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <>
      <h1>About Us</h1>
      <p className="muted">Edit the content shown on the /about page.</p>
      <div className="panel" style={{ maxWidth: 700 }}>
        <div className="field"><label>Title<input value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} /></label></div>
        <div className="field"><label>Content<textarea value={data.content} onChange={(e) => setData({ ...data, content: e.target.value })} rows={4} /></label></div>
        <div className="field"><label>Mission<textarea value={data.mission} onChange={(e) => setData({ ...data, mission: e.target.value })} rows={3} /></label></div>
        <div className="field"><label>Vision<textarea value={data.vision} onChange={(e) => setData({ ...data, vision: e.target.value })} rows={3} /></label></div>
        <RippleButton onClick={save} loading={saving}>Save Changes</RippleButton>
      </div>
    </>
  );
}

// ===================== SETTINGS =====================
function AdminStorefront() {
  const [cfg, setCfg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bannerInputs, setBannerInputs] = useState<{ title: string; subtitle: string }[]>([]);

  async function load() {
    setLoading(true);
    try {
      const d = await api<any>("/api/admin/storefront-layout");
      setCfg(d);
      setBannerInputs((d.banners || []).map((b: any) => ({ title: b.title || "", subtitle: b.subtitle || "" })));
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const layouts = getLayoutList();

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

  if (loading) return <Spinner />;

  return (
    <>
      <h1>Storefront Layout</h1>
      <p className="muted">Choose how your store looks to customers. Layouts only change the presentation — no data is affected.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {layouts.map((l) => (
          <div key={l.key} className="panel" style={{ border: cfg?.layout === l.key ? "2px solid var(--primary)" : "1px solid var(--border)", cursor: "pointer" }} onClick={() => switchLayout(l.key)}>
            <div style={{ height: 120, borderRadius: 8, background: "var(--bg)", marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem" }}>
              {l.key === "original" ? "🏠" : l.key === "amazon" ? "📦" : l.key === "jumia" ? "🛒" : "📱"}
            </div>
            <h3 style={{ margin: "0 0 0.25rem" }}>{l.label}</h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>{l.desc}</p>
            {cfg?.layout === l.key && <span className="badge badge-green" style={{ marginTop: "0.5rem" }}>Active</span>}
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3>Promotional Banners</h3>
        <p className="muted" style={{ fontSize: "0.85rem" }}>These appear on the homepage hero area.</p>
        {bannerInputs.map((b, i) => (
          <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
            <input value={b.title} onChange={(e) => { const copy = [...bannerInputs]; copy[i] = { ...copy[i], title: e.target.value }; setBannerInputs(copy); }} placeholder="Title" style={{ flex: 1 }} />
            <input value={b.subtitle} onChange={(e) => { const copy = [...bannerInputs]; copy[i] = { ...copy[i], subtitle: e.target.value }; setBannerInputs(copy); }} placeholder="Subtitle" style={{ flex: 1 }} />
            <RippleButton size="small" variant="danger" onClick={() => setBannerInputs(bannerInputs.filter((_, j) => j !== i))}>✕</RippleButton>
          </div>
        ))}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
          <RippleButton size="small" variant="ghost" onClick={() => setBannerInputs([...bannerInputs, { title: "", subtitle: "" }])}>+ Add Banner</RippleButton>
          <RippleButton size="small" onClick={saveBanners} loading={saving}>Save Banners</RippleButton>
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
      {msg && <p style={{ fontSize: "0.85rem", color: msg.startsWith("Error") ? "#dc2626" : "#16a34a", marginBottom: "0.5rem" }}>{msg}</p>}
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

function AdminSettings() {
  const { refreshSettings } = useApp();
  const { data: settings, loading, error } = useFetch(() => api<any>("/api/settings"), []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [faviconMsg, setFaviconMsg] = useState("");
  const [etimsMode, setEtimsMode] = useState("off");
  useEffect(() => { if (settings?.etimsMode) setEtimsMode(settings.etimsMode); }, [settings?.etimsMode]);

  function handleFaviconChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFaviconMsg("");
    setFaviconFile(e.target.files?.[0] || null);
  }

  async function handleFaviconUpload(e: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) {
    if (e) e.preventDefault?.();
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

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
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
          mpesaConsumerKey: fd.get("mpesaConsumerKey"),
          mpesaConsumerSecret: fd.get("mpesaConsumerSecret"),
          mpesaPasskey: fd.get("mpesaPasskey"),
          mpesaShortcode: fd.get("mpesaShortcode"),
          mpesaTillNumber: fd.get("mpesaTillNumber"),
          mpesaEnv: fd.get("mpesaEnv"),
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
          backupImagesToDb: fd.get("backupImagesToDb") === "on",
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
      <h1>Settings</h1>
      <form onSubmit={handleSave} style={{ maxWidth: 500 }}>
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Store info</h3>
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
                <img src={settings.storeFavicon} alt="Current favicon" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "contain", border: "1px solid #ddd" }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 8, background: "#f1f5f9", border: "1px solid #ddd", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 12, color: "#334155" }}>default</span>
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Current favicon</p>
                <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                  Upload a PNG, ICO, SVG, JPEG, or WEBP file to replace the favicon.
                </p>
              </div>
            </div>
            <input
              type="file"
              accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.ico,.svg"
              onChange={handleFaviconChange}
            />
            <RippleButton type="button" onClick={handleFaviconUpload} loading={faviconUploading} disabled={!faviconFile}>
              Upload favicon
            </RippleButton>
            {faviconMsg && <p style={{ margin: 0, color: faviconMsg.startsWith("Error") ? "#991b1b" : "#065f46" }}>{faviconMsg}</p>}
          </div>
        </div>
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>M-Pesa Configuration</h3>
          <div className="field"><label>Consumer Key<input name="mpesaConsumerKey" defaultValue={settings?.mpesaConsumerKey || ""} /></label></div>
          <div className="field"><label>Consumer Secret<input name="mpesaConsumerSecret" defaultValue={settings?.mpesaConsumerSecret || ""} /></label></div>
          <div className="field"><label>Passkey<input name="mpesaPasskey" defaultValue={settings?.mpesaPasskey || ""} /></label></div>
          <div className="field"><label>Shortcode<input name="mpesaShortcode" defaultValue={settings?.mpesaShortcode || ""} /></label></div>
          <div className="field"><label>Till Number<input name="mpesaTillNumber" defaultValue={settings?.mpesaTillNumber || ""} /></label></div>
          <div className="field"><label>Environment<select name="mpesaEnv" defaultValue={settings?.mpesaEnv || "sandbox"}><option value="sandbox">Sandbox</option><option value="production">Production</option></select></label></div>
        </div>
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
            <div className="field"><label>Consumer Key<input name="etimsOscuConsumerKey" defaultValue={settings?.etimsOscuConsumerKey || ""} placeholder="OSCU consumer key" /></label></div>
            <div className="field"><label>Consumer Secret<input name="etimsOscuConsumerSecret" defaultValue={settings?.etimsOscuConsumerSecret || ""} placeholder="OSCU consumer secret" /></label></div>
          </>}
        </div>
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Image Storage</h3>
          <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
            Images are uploaded to Cloudinary (primary). Enable this to also keep a database backup of every uploaded image as a safety net. Backups are stored as base64 in PostgreSQL and served via <code>/api/images/:refId</code>.
          </p>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input type="checkbox" name="backupImagesToDb" defaultChecked={settings?.backupImagesToDb || false} style={{ width: 18, height: 18 }} />
            <span>Enable database backup for uploaded images</span>
          </label>
        </div>
        {msg && <p style={{ padding: "0.5rem 1rem", borderRadius: 8, background: msg.startsWith("Error") ? "#fee2e2" : "#d1fae5", color: msg.startsWith("Error") ? "#991b1b" : "#065f46", marginBottom: "0.75rem" }}>{msg}</p>}
        <RippleButton type="submit" loading={saving}>Save settings</RippleButton>
      </form>

      <div className="panel payment-methods-panel" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Payment Methods</h3>
        <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
          Configure payment methods shown on the POS page. Each method needs a unique ID, display name, KRA tax code, and whether it requires a tendered amount.
        </p>
        <AdminPaymentMethods initial={settings?.paymentMethods || []} />
      </div>

      <h3 style={{ marginTop: "1.5rem" }}>Exchange Rates</h3>
      <p className="muted" style={{ fontSize: "0.85rem" }}>Rates auto-fetch from open.er-api.com. Set custom rates below to override. Leave empty to use auto rates.</p>
      <AdminExchangeRates />

      <h3 style={{ marginTop: "1.5rem" }}>Database Backup</h3>
      <p className="muted" style={{ fontSize: "0.85rem" }}>Download a full backup of the store database.</p>
      <RippleButton onClick={async () => {
        try {
          const res = await fetch("/api/admin/backup", { headers: { Authorization: "Bearer " + (getStaffToken() || "") } });
          if (!res.ok) throw new Error("Backup failed");
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url; a.download = `store-backup-${new Date().toISOString().slice(0, 10)}.db`; a.click();
          URL.revokeObjectURL(url);
        } catch (e: any) { alert(e.message); }
      }}>Download Backup</RippleButton>
    </>
  );
}

// ===================== SHOP SUBSCRIPTION =====================
function AdminShopSubscription() {
  const { data: subData, loading, error, refetch } = useFetch(() => api<{ plan: SubscriptionPlan }>("/api/shop/subscription"), []);
  const { data: plans } = useFetch(() => api<{ plans: SubscriptionPlan[] }>("/api/plans"), []);
  const { data: reqData, refetch: refetchReqs } = useFetch(() => api<{ requests: any[] }>("/api/shop/subscription/requests"), []);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function activatePlan() {
    if (!selectedPlan) return;
    setSaving(true); setMsg("");
    try { await api("/api/shop/subscription", { method: "PUT", body: JSON.stringify({ planId: selectedPlan }) }); setMsg(`Plan changed to ${selectedPlan}.`); refetch(); } catch (err: any) { setMsg("Error: " + err.message); } finally { setSaving(false); }
  }

  async function handleRequest(id: number, status: string) {
    try { await api(`/api/shop/subscription/requests/${id}`, { method: "PUT", body: JSON.stringify({ status }) }); refetch(); refetchReqs(); } catch (err: any) { alert(err.message); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const currentPlan = subData?.plan;
  const allPlans = plans?.plans || [];
  const requests = reqData?.requests || [];
  const pending = requests.filter((r: any) => r.status === "pending");

  return (
    <>
      <h1>Shop Subscription</h1>
      {msg && <div className="panel" style={{ marginBottom: "1rem", background: msg.startsWith("Error") ? "#fee2e2" : "#d1fae5", color: msg.startsWith("Error") ? "#991b1b" : "#065f46" }}>{msg}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__value">{currentPlan ? escapeHtml(currentPlan.name) : "—"}</div>
          <div className="stat-card__label">Current Plan</div>
          {currentPlan && <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--primary)", margin: "0.5rem 0 0" }}>{formatPrice(currentPlan.price)}<span style={{ fontSize: "0.8rem", fontWeight: 400, opacity: 0.6 }}>/mo</span></p>}
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
                    <td><span className="plan-status" style={{ background: r.status === "pending" ? "#fef3c7" : r.status === "approved" ? "#d1fae5" : "#fee2e2", color: r.status === "pending" ? "#92400e" : r.status === "approved" ? "#065f46" : "#991b1b" }}>{r.status}</span></td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{escapeHtml(r.notes || "—")}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(r.created_at).toLocaleDateString("en-GB")}</td>
                    <td>{r.status === "pending" && <div style={{ display: "flex", gap: "0.35rem" }}><RippleButton size="small" style={{ background: "#16a34a", borderColor: "#16a34a" }} onClick={() => handleRequest(r.id, "approved")}>Approve</RippleButton><RippleButton size="small" variant="danger" onClick={() => handleRequest(r.id, "rejected")}>Reject</RippleButton></div>}</td>
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
    } catch (err: any) { alert(err.message); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this spec field?")) return;
    try { await api(`/api/spec-templates/${id}`, { method: "DELETE" }); refetch(); } catch (err: any) { alert(err.message); }
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
  const { toast } = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ productId: string; productName: string; quantity: number; unitPrice: number }[]>([]);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);

  useEffect(() => {
    api<{ customers: any[] }>("/api/admin/customers").then((d) => setCustomers(d.customers || [])).catch(() => {});
    api<{ products: any[] }>("/api/products").then((d) => setProducts(d.products || [])).catch(() => {});
    api<{ quotes: any[] }>("/api/admin/quotes").then((d) => setQuotes(d.quotes || [])).catch(() => {});
  }, []);

  const filteredProducts = search ? products.filter((p) =>
    (p.name || "").toLowerCase().includes(search.toLowerCase())
  ) : [];

  function addItem(p: any) {
    if (items.find((i) => i.productId === p.id)) return;
    setItems([...items, { productId: p.id, productName: p.name || p.id, quantity: 1, unitPrice: Number(p.price) || 0 }]);
    setSearch("");
  }

  function removeItem(idx: number) { setItems(items.filter((_, i) => i !== idx)); }

  function updateItem(idx: number, field: string, value: any) {
    const copy = [...items];
    (copy[idx] as any)[field] = field === "quantity" ? Math.max(1, Number(value)) : Number(value);
    setItems(copy);
  }

  async function createQuote() {
    if (!customerId || items.length === 0) return;
    setCreating(true);
    try {
      const result = await api<any>("/api/admin/quotes", {
        method: "POST", body: JSON.stringify({ customerId, notes, items }),
      });
      setCreated(result);
      api<{ quotes: any[] }>("/api/admin/quotes").then((d) => setQuotes(d.quotes || [])).catch(() => {});
      toast("success", `Quote ${result.quoteNumber} created`);
    } catch (err: any) { toast("error", err.message); }
    finally { setCreating(false); }
  }

  function formatDate(d: string) {
    try { return new Date(d).toLocaleDateString("en-GB"); } catch { return d; }
  }

  if (created || viewing) {
    const q = created || viewing;
    return (
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h1 style={{ margin: 0 }}>Quote {q.quoteNumber}</h1>
          <RippleButton size="small" variant="ghost" onClick={() => { setCreated(null); setViewing(null); setCustomerId(null); setNotes(""); setItems([]); }}>&larr; Back</RippleButton>
        </div>
        <div className="panel" style={{ maxWidth: 600 }}>
          <p><strong>Customer:</strong> {escapeHtml(customers.find((c) => c.id === q.customerId)?.name || "—")}</p>
          <p><strong>Status:</strong> <span className="plan-status" style={{ background: q.status === "draft" ? "#fef3c7" : q.status === "sent" ? "#dbeafe" : q.status === "accepted" ? "#d1fae5" : "#fee2e2", color: q.status === "draft" ? "#92400e" : q.status === "sent" ? "#1e40af" : q.status === "accepted" ? "#065f46" : "#991b1b" }}>{q.status}</span></p>
          <p><strong>Total:</strong> {formatPrice(q.total)}</p>
          {q.notes && <p><strong>Notes:</strong> {escapeHtml(q.notes)}</p>}
          {q.createdAt && <p><strong>Created:</strong> {formatDate(q.createdAt)}</p>}
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table className="data-table">
              <thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
              <tbody>
                {(q.items || []).map((i: any) => (
                  <tr key={i.id}><td>{escapeHtml(i.productName)}</td><td style={{textAlign:"center"}}>{i.quantity}</td><td style={{textAlign:"right",whiteSpace:"nowrap"}}>{formatPrice(i.unitPrice)}</td><td style={{textAlign:"right",whiteSpace:"nowrap"}}>{formatPrice(i.lineTotal)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <RippleButton size="small" style={{marginTop:"1rem"}} onClick={() => window.open(`/api/admin/quotes/${q.id}/generate`, "_blank")}>Generate</RippleButton>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Quotations</h1>
        <RippleButton size="small" onClick={() => setCreated({})}>+ New Quote</RippleButton>
      </div>

      {quotes.length > 0 && (
        <div className="table-wrap" style={{ marginBottom: "1.5rem" }}>
          <table className="data-table">
            <thead><tr><th>#</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {quotes.map((q: any) => (
                <tr key={q.id}>
                  <td>{q.quoteNumber}</td>
                  <td>{escapeHtml(customers.find((c) => c.id === q.customerId)?.name || "—")}</td>
                  <td>{formatPrice(q.total)}</td>
                  <td><span className="plan-status" style={{ background: q.status === "draft" ? "#fef3c7" : q.status === "sent" ? "#dbeafe" : q.status === "accepted" ? "#d1fae5" : "#fee2e2", color: q.status === "draft" ? "#92400e" : q.status === "sent" ? "#1e40af" : q.status === "accepted" ? "#065f46" : "#991b1b" }}>{q.status}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(q.createdAt)}</td>
                  <td><RippleButton size="small" onClick={() => setViewing(q)}>View</RippleButton></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {created && Object.keys(created).length === 0 && (
        <div className="panel" style={{ maxWidth: 700 }}>
          <h3 style={{ marginTop: 0 }}>Create New Quote</h3>
          <div className="field">
            <label>Customer</label>
            <select value={customerId || ""} onChange={(e) => setCustomerId(Number(e.target.value))}>
              <option value="">Select a customer...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{escapeHtml(c.name)} ({c.email})</option>)}
            </select>
          </div>
          <div className="field">
            <label>Notes (optional)</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <h4 style={{ marginBottom: "0.5rem" }}>Items</h4>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." style={{ flex: 1 }} />
            {search && filteredProducts.length > 0 && (
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, zIndex: 10, maxHeight: 200, overflowY: "auto", minWidth: 250 }}>
                  {filteredProducts.slice(0, 10).map((p) => (
                    <div key={p.id} onClick={() => addItem(p)} style={{ padding: "0.4rem 0.6rem", cursor: "pointer", borderBottom: "1px solid var(--border)", fontSize: "0.85rem" }}>
                      {escapeHtml(p.name || p.id)} — {formatPrice(Number(p.price) || 0)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {items.length > 0 && (
            <div className="table-wrap" style={{ marginBottom: "0.75rem" }}>
              <table className="data-table">
                <thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Total</th><th></th></tr></thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{escapeHtml(item.productName)}</td>
                      <td><input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} style={{ width: 60 }} /></td>
                      <td><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", e.target.value)} style={{ width: 100 }} /></td>
                      <td>{formatPrice(item.quantity * item.unitPrice)}</td>
                      <td><RippleButton size="small" variant="danger" onClick={() => removeItem(idx)}>✕</RippleButton></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <RippleButton onClick={createQuote} loading={creating} disabled={!customerId || items.length === 0}>Create Quote</RippleButton>
            <RippleButton variant="secondary" onClick={() => { setCreated(null); setCustomerId(null); setNotes(""); setItems([]); }}>Cancel</RippleButton>
          </div>
        </div>
      )}
    </>
  );
}

// ===================== REPORTS =====================
function AdminReports() {
  return <AdminSalesReport />;
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
  .meta { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.5rem 0.75rem; text-align: left; font-size: 0.85rem; }
  th { background: #f5f5f5; font-weight: 600; }
  .stats { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
  .stat-card { border: 1px solid #ccc; border-radius: 8px; padding: 1rem; text-align: center; flex: 1; }
  .stat-value { font-size: 1.5rem; font-weight: 700; }
  .stat-label { font-size: 0.8rem; color: #666; }
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
  html += `<p style="text-align:center;color:#999;font-size:0.8rem;margin-top:2rem">Generated on ${new Date().toLocaleDateString("en-GB")}</p>`;
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
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  async function deleteC(id: number) {
    if (!confirm("Delete this coupon?")) return;
    try { await api(`/api/admin/coupons/${id}`, { method: "DELETE" }); refetch(); } catch {}
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

function AdminSuppliers() {
  const { data, loading, error, refetch } = useFetch(() => api<{ suppliers: any[] }>("/api/admin/suppliers"), []);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const suppliers = data?.suppliers || [];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg("");
    const fd = new FormData(e.target as HTMLFormElement);
    const body = { name: fd.get("name"), contact_name: fd.get("contact_name"), email: fd.get("email"), phone: fd.get("phone"), address: fd.get("address"), notes: fd.get("notes"), is_active: fd.get("is_active") === "on" };
    try {
      if (editing) { await api(`/api/admin/suppliers/${editing.id}`, { method: "PUT", body: JSON.stringify(body) }); }
      else { await api("/api/admin/suppliers", { method: "POST", body: JSON.stringify(body) }); }
      setShowForm(false); setEditing(null); refetch();
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  async function del(id: number) {
    if (!confirm("Delete supplier?")) return;
    try { await api(`/api/admin/suppliers/${id}`, { method: "DELETE" }); refetch(); } catch {}
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Suppliers</h1>
        <RippleButton size="small" onClick={() => { setEditing(null); setShowForm(!showForm); setMsg(""); }}>{showForm ? "Cancel" : "+ Add Supplier"}</RippleButton>
      </div>
      {showForm && (
        <form className="panel" onSubmit={save} style={{ maxWidth: 500, marginBottom: "1rem" }}>
          {msg && <ErrorMsg msg={msg} />}
          <div className="field"><label>Company Name<input name="name" defaultValue={editing?.name || ""} required /></label></div>
          <div className="field"><label>Contact Person<input name="contact_name" defaultValue={editing?.contact_name || ""} /></label></div>
          <div className="field"><label>Email<input name="email" type="email" defaultValue={editing?.email || ""} /></label></div>
          <div className="field"><label>Phone<input name="phone" defaultValue={editing?.phone || ""} /></label></div>
          <div className="field"><label>Address<input name="address" defaultValue={editing?.address || ""} /></label></div>
          <div className="field"><label>Notes<textarea name="notes" rows={3} defaultValue={editing?.notes || ""} /></label></div>
          <div className="field"><label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><input name="is_active" type="checkbox" defaultChecked={editing ? editing.is_active : true} /> Active</label></div>
          <RippleButton type="submit" loading={saving}>Save</RippleButton>
        </form>
      )}
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Contact</th><th>Email</th><th>Phone</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td>{escapeHtml(s.name)}</td>
                <td>{escapeHtml(s.contact_name || "—")}</td>
                <td>{escapeHtml(s.email || "—")}</td>
                <td>{escapeHtml(s.phone || "—")}</td>
                <td>{s.is_active ? "Yes" : "No"}</td>
                <td style={{ display: "flex", gap: "0.35rem" }}>
                  <RippleButton size="small" variant="ghost" onClick={() => { setEditing(s); setShowForm(true); setMsg(""); }}>Edit</RippleButton>
                  <RippleButton size="small" variant="danger" onClick={() => del(s.id)}>Delete</RippleButton>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && <tr><td colSpan={6}><EmptyState icon="products" title="No suppliers yet" /></td></tr>}
          </tbody>
        </table>
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
              <rect x={x} y={y} width={barWidth} height={barH} fill="var(--primary, #2563eb)" rx={2}>
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

function AdminSalesReport() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const [branchId, setBranchId] = useState("");
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { data: branches } = useFetch(() => api<{ branches: Branch[] }>("/api/admin/branches"), []);

  useEffect(() => { fetchReport(); }, []);

  function fetchReport() {
    setLoading(true); setError("");
    let url = `/api/reports/sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    if (branchId) url += `&branch_id=${encodeURIComponent(branchId)}`;
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

          {report.branchBreakdown && report.branchBreakdown.length > 0 && (
            <>
              <h3>Per-Branch Breakdown</h3>
              <div className="table-wrap" style={{ marginBottom: "1rem" }}>
                <table className="data-table">
                  <thead><tr><th>Branch</th><th>Orders</th><th>Revenue</th></tr></thead>
                  <tbody>
                    {report.branchBreakdown.map((b: any) => (
                      <tr key={b.branchId}>
                        <td>{escapeHtml(b.branchName)}</td>
                        <td>{b.orders}</td>
                        <td>{formatPrice(b.revenue)}</td>
                      </tr>
                    ))}
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

// ===================== STOCK ON HAND =====================
function AdminStockOnHand() {
  const { toast } = useToast();
  const { data: sData, loading, error } = useFetch(() => api<{ items: any[] }>("/api/reports/stock-summary"), []);
  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().slice(0, 10));
  const [snapshot, setSnapshot] = useState<any>(null);
  const [dates, setDates] = useState<any[]>([]);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);

  useEffect(() => {
    api<{ dates: any[] }>("/api/stock-on-hand/history").then(d => setDates(d.dates || [])).catch(() => {});
  }, []);

  async function viewSnapshot() {
    if (!snapshotDate) return;
    setLoadingSnapshot(true);
    try {
      const data = await api<any>(`/api/stock-on-hand/${snapshotDate}`);
      setSnapshot(data);
    } catch (err: any) {
      setSnapshot(null);
      alert("No snapshot for this date.");
    } finally { setLoadingSnapshot(false); }
  }

  async function takeSnapshot() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await api("/api/stock-on-hand/snapshot", { method: "POST", body: JSON.stringify({ date: today }) });
      setSnapshotDate(today);
      const data = await api<any>(`/api/stock-on-hand/${today}`);
      setSnapshot(data);
      api<{ dates: any[] }>("/api/stock-on-hand/history").then(d => setDates(d.dates || [])).catch(() => {});
    } catch (err: any) { alert(err.message); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const items = sData?.items || [];
  const lowStock = items.filter((i) => i.quantityInStock <= i.lowStockThreshold);

  return (
    <>
      <h1>Stock on Hand</h1>

      {lowStock.length > 0 && (
        <div className="panel" style={{ marginBottom: "1rem", background: "#fef3c7", borderColor: "#f59e0b", color: "#92400e" }}>
          <strong>{lowStock.length}</strong> item(s) at or below low stock threshold.
          <RippleButton size="small" onClick={async () => {
            try { const r = await api<any>("/api/admin/auto-reorder", { method: "POST" }); toast("success", `Auto-reorder created ${r.created} items (${r.skipped} already on order)`); } catch (e: any) { toast("error", e.message); }
          }} style={{ marginLeft: "0.75rem" }}>Auto Reorder</RippleButton>
        </div>
      )}

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ margin: 0 }}>
            <label>View Stock on Hand for Date</label>
            <input type="date" value={snapshotDate} onChange={(e) => setSnapshotDate(e.target.value)} />
          </div>
          <RippleButton size="small" onClick={viewSnapshot} loading={loadingSnapshot}>View</RippleButton>
          <RippleButton size="small" onClick={takeSnapshot}>Snapshot Today</RippleButton>
        </div>
        {dates.length > 0 && (
          <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            {dates.map((d: any) => (
              <RippleButton key={d.date} size="small" variant="ghost" onClick={() => { setSnapshotDate(d.date); viewSnapshot(); }}>
                {d.date}
              </RippleButton>
            ))}
          </div>
        )}
      </div>

      {snapshot && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Snapshot: {snapshot.date}</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Product</th><th style={{ textAlign: "right" }}>Quantity</th></tr></thead>
              <tbody>
                {snapshot.items.map((i: any) => (
                  <tr key={i.productId}>
                    <td>{escapeHtml(i.productName)}</td>
                    <td style={{ textAlign: "right" }}>{i.quantity}</td>
                  </tr>
                ))}
                {snapshot.items.length === 0 && <tr><td colSpan={2}><EmptyState icon="stock" title="No snapshot data" description="Take a snapshot to record stock levels for this date." /></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h3>Current Stock Levels</h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Product</th><th>Category</th><th>In Stock</th><th>Reserved</th><th>Sold</th><th>Threshold</th><th>Status</th></tr></thead>
          <tbody>
            {items.map((i: any) => (
              <tr key={i.productId} style={i.quantityInStock <= i.lowStockThreshold ? { background: "var(--bg)" } : {}}>
                <td>{escapeHtml(i.name)}</td>
                <td>{i.category || "—"}</td>
                <td><strong>{i.quantityInStock}</strong></td>
                <td>{i.quantityReserved}</td>
                <td>{i.quantitySold}</td>
                <td>{i.lowStockThreshold}</td>
                <td>{i.quantityInStock <= i.lowStockThreshold ? <span style={{ color: "#dc2626", fontWeight: 600 }}>Low</span> : <span style={{ color: "#16a34a" }}>OK</span>}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7}><EmptyState icon="stock" title="No stock data" description="Stock levels will appear here once products are added." /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ===================== STOCK TRANSFERS =====================
function AdminStockTransfers() {
  const { toast } = useToast();
  const { data: tData, loading, error, refetch } = useFetch(() => api<{ transfers: any[] }>("/api/stock-transfers"), []);
  const { data: branches } = useFetch(() => api<{ branches: any[] }>("/api/admin/branches"), []);
  const { data: products } = useFetch(() => api<{ products: any[] }>("/api/products"), []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fromBranchId: "", toBranchId: "", productId: "", quantity: "", notes: "" });
  const [creating, setCreating] = useState(false);

  const branchList = branches?.branches || [];
  const productList = products?.products || [];
  const transfers = tData?.transfers || [];

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
    try { await api(`/api/stock-transfers/${id}/complete`, { method: "POST" }); refetch(); toast("success", "Transfer completed"); } catch (err: any) { toast("error", err.message); }
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
            <div className="field"><label>Notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></label></div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <RippleButton type="submit" loading={creating}>Create Transfer</RippleButton>
              <RippleButton variant="secondary" onClick={() => setShowForm(false)}>Cancel</RippleButton>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>ID</th><th>From</th><th>To</th><th>Product</th><th>Qty</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {transfers.map((t: any) => {
              const fromName = branchList.find((b: any) => b.id === t.fromBranchId)?.name || `#${t.fromBranchId}`;
              const toName = branchList.find((b: any) => b.id === t.toBranchId)?.name || `#${t.toBranchId}`;
              const pName = productList.find((p: any) => p.id === t.productId)?.name || t.productId;
              return (
                <tr key={t.id}>
                  <td>#{t.id}</td>
                  <td>{escapeHtml(fromName)}</td>
                  <td>{escapeHtml(toName)}</td>
                  <td>{escapeHtml(pName)}</td>
                  <td>{t.quantity}</td>
                  <td><span className="plan-status" style={{ background: t.status === "completed" ? "#d1fae5" : t.status === "rejected" ? "#fee2e2" : "#fef3c7", color: t.status === "completed" ? "#065f46" : t.status === "rejected" ? "#991b1b" : "#92400e" }}>{t.status}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(t.createdAt).toLocaleDateString("en-GB")}</td>
                  <td>{t.status === "pending" && <div style={{ display: "flex", gap: "0.25rem" }}><RippleButton size="small" onClick={() => completeTransfer(t.id)}>Complete</RippleButton><RippleButton size="small" variant="danger" onClick={() => rejectTransfer(t.id)}>Reject</RippleButton></div>}</td>
                </tr>
              );
            })}
            {transfers.length === 0 && <tr><td colSpan={8}><EmptyState icon="stock" title="No transfers" description="Create a stock transfer between branches." /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ===================== STOCK TAKE =====================
function AdminStockTake() {
  const { data: sessions, loading, error, refetch } = useFetch(() => api<{ sessions: any[] }>("/api/stock-take"), []);
  const [msg, setMsg] = useState("");

  async function startSession() {
    try {
      const data = await api<any>("/api/stock-take/start", { method: "POST" });
      if (data?.session) {
        window.location.href = `/stock-take/${data.session.id}`;
      }
    } catch (err: any) { setMsg(err.message); }
  }

  async function handleDelete(session: any, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this session? Only possible if no items have been counted.")) return;
    try {
      await api(`/api/stock-take/${session.id}`, { method: "DELETE" });
      refetch();
    } catch (err: any) { setMsg(err.message); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const sessionList = sessions?.sessions || [];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Stock Take</h1>
        <RippleButton size="small" onClick={startSession}>+ New Session</RippleButton>
      </div>
      {msg && <div className="panel" style={{ marginBottom: "1rem", background: "#fee2e2", color: "#991b1b" }}>{msg}</div>}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Status</th>
              <th>Created</th>
              <th>Completed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessionList.length === 0 && <tr><td colSpan={5}><EmptyState icon="stock" title="No stock take sessions" description="Start a new session to count inventory." /></td></tr>}
            {sessionList.map((s: any) => (
              <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => window.location.href = `/stock-take/${s.id}`}>
                <td>{s.id}</td>
                <td><span className="plan-status" style={{ background: s.status === "completed" ? "#d1fae5" : "#fef3c7", color: s.status === "completed" ? "#065f46" : "#92400e" }}>{s.status}</span></td>
                <td>{new Date(s.createdAt || s.created_at).toLocaleDateString("en-GB")}</td>
                <td>{s.completedAt || s.completed_at ? new Date(s.completedAt || s.completed_at).toLocaleDateString("en-GB") : "—"}</td>
                <td>
                  <RippleButton size="small" variant="danger" onClick={(e) => handleDelete(s, e)}>Delete</RippleButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
