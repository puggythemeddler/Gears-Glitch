import React, { useEffect, useRef, useState } from "react";
import { api, getStaffToken, downloadPdf, getCsrfToken, initCsrf } from "@/lib/api";
import type { Product, Order, Provider, SubscriptionPlan, Customer, Branch } from "@/lib/types";
import RippleButton from "@/components/RippleButton";
import { getLayoutList, useLayout } from "@/layouts";
import { SkeletonStats, SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import AnimatedCounter from "@/components/AnimatedCounter";
import { useApp } from "@/lib/app-context";
import { useToast } from "@/components/Toast";
import QuotesPage from "./quotes";
import NotificationBell from "@/components/NotificationBell";
import WhatsAppSettings from "@/components/admin/WhatsAppSettings";
import { useFeature } from "@/lib/features";
import AdminProducts from "@/components/admin/AdminProducts";
import ProvidersPage from "@/components/admin/ProvidersPage";
import CreditNotesPage from "@/components/admin/CreditNotesPage";
import AboutUsPage from "@/components/admin/AboutUsPage";
import ProductPositioningPage from "@/components/admin/ProductPositioningPage";
import StockTakeListPage from "@/components/admin/StockTakeListPage";
import StockOnHandPage from "@/components/admin/StockOnHandPage";

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);
}

function escapeHtml(v: string) { return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }

type OwnerView = "dashboard" | "orders" | "products" | "providers" | "customers" | "messages" | "reports" | "invoices" | "credit-notes" | "stock-control" | "stock-take" | "tech-repairs" | "branches" | "audit" | "shop-subscription" | "storefront" | "about-us" | "quotes" | "product-positioning" | "whatsapp-settings";

const NAV_GROUPS: { label: string; items: { key: OwnerView; label: string; feature?: string }[] }[] = [
  {
    label: "Sales",
    items: [
      { key: "orders", label: "Orders" },
      { key: "products", label: "Products" },
      { key: "customers", label: "Customers" },
      { key: "quotes", label: "Quotes", feature: "Quotations" },
    ],
  },
  {
    label: "Service",
    items: [
      { key: "providers", label: "Providers" },
      { key: "tech-repairs", label: "Tech Repairs", feature: "Repair ticketing" },
      { key: "messages", label: "Messages", feature: "Messaging" },
      { key: "reports", label: "Reports", feature: "Analytics dashboard" },
    ],
  },
  {
    label: "Finance",
    items: [
      { key: "invoices", label: "Invoices", feature: "Invoice/quote PDF downloads" },
      { key: "credit-notes", label: "Credit Notes", feature: "Credit notes" },
    ],
  },
  {
    label: "Stock",
    items: [
      { key: "stock-control", label: "Stock Control", feature: "Stock transfers" },
      { key: "stock-take", label: "Stock Take", feature: "Stock take / inventory count" },
      { key: "branches", label: "Branches", feature: "Branch management" },
    ],
  },
  {
    label: "Settings",
    items: [
      { key: "storefront", label: "Storefront" },
      { key: "product-positioning", label: "Product Positioning", feature: "Product positioning" },
      { key: "about-us", label: "About Us" },
      { key: "shop-subscription", label: "Subscription" },
      { key: "audit", label: "Audit Log", feature: "Audit log" },
      { key: "whatsapp-settings", label: "WhatsApp", feature: "WhatsApp integration" },
    ],
  },
];

export default function OwnerPage() {
  const { isDark, toggleDark, settings } = useApp();
  const [authed, setAuthed] = useState(false);
  const [view, setView] = useState<OwnerView>("dashboard");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const featureFlags: Record<string, boolean> = {
    "Messaging": useFeature("Messaging"),
    "Branch management": useFeature("Branch management"),
    "Credit notes": useFeature("Credit notes"),
    "Quotations": useFeature("Quotations"),
    "Repair ticketing": useFeature("Repair ticketing"),
    "Product positioning": useFeature("Product positioning"),
    "Email notifications": useFeature("Email notifications"),
    "Stock transfers": useFeature("Stock transfers"),
    "Invoice/quote PDF downloads": useFeature("Invoice/quote PDF downloads"),
    "Analytics dashboard": useFeature("Analytics dashboard"),
    "Audit log": useFeature("Audit log"),
    "Stock take / inventory count": useFeature("Stock take / inventory count"),
    "WhatsApp integration": useFeature("WhatsApp integration"),
    "Multi-currency support": useFeature("Multi-currency support"),
    "Product reviews & ratings": useFeature("Product reviews & ratings"),
  };
  const hasFeature = (f?: string) => !f || featureFlags[f] === true;

  useEffect(() => {
    if (getStaffToken()) {
      setAuthed(true);
      setStaffRole(localStorage.getItem("staffRole"));
    }
  }, []);

  const [expandedGroups, setExpandedGroups] = useState<string[]>(["Sales", "Settings"]);

  const isStorefrontAllowed = staffRole === "admin";

  const featureFlagsReady = Object.keys(featureFlags).length > 0;
  const filteredGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.key === "storefront") return isStorefrontAllowed;
      return hasFeature(item.feature);
    }),
  })).filter((group) => group.items.length > 0);
  const allVisibleKeys = filteredGroups.flatMap((g) => g.items.map((i) => i.key));

  useEffect(() => {
    if (view !== "dashboard" && !allVisibleKeys.includes(view)) setView("dashboard");
  }, [view, allVisibleKeys]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    try {
      const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username: loginUsername, password: loginPassword }) });
      if (data.role !== "admin" && data.role !== "owner") { setLoginError("Owner access requires admin or owner role."); return; }
      localStorage.setItem("computerStoreToken", data.token);
      localStorage.setItem("staffUserName", data.username || "Owner");
      localStorage.setItem("staffRole", data.role);
      setAuthed(true);
    } catch (err: any) { setLoginError(err.message); }
  }

  if (!authed) {
    return (
      <div className="auth-page" style={{ marginTop: "3rem" }}>
        <h1>Shop Owner</h1>
        <form onSubmit={handleLogin} className="auth-form">
          <div className="field"><label>Username or email<input value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} required /></label></div>
          <div className="field"><label>Password<input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required /></label></div>
          {loginError && <p className="error">{loginError}</p>}
          <RippleButton type="submit" className="btn-block">Sign in</RippleButton>
        </form>
      </div>
    );
  }

  return (
    <div className="dash-layout">
      <nav className="dash-nav">
        <RippleButton variant="ghost" className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>Dashboard</RippleButton>
        {filteredGroups.map((group) => (
          <div key={group.label}>
            <RippleButton variant="ghost" className="nav-group-header" onClick={() => setExpandedGroups((prev) => prev.includes(group.label) ? prev.filter((g) => g !== group.label) : [...prev, group.label])} style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.6, marginTop: "0.5rem" }}>
              {expandedGroups.includes(group.label) ? "▾" : "▸"} {group.label}
            </RippleButton>
            {expandedGroups.includes(group.label) && group.items.map((item) => (
              <RippleButton key={item.key} variant="ghost" className={view === item.key ? "active" : ""} onClick={() => setView(item.key)} style={{ paddingLeft: "1.5rem" }}>{item.label}</RippleButton>
            ))}
          </div>
        ))}
        <RippleButton variant="ghost" style={{ color: "var(--primary)" }} onClick={() => { localStorage.removeItem("computerStoreToken"); window.location.href = "/"; }}>
          Sign out
        </RippleButton>
      </nav>
      <div className="dash-content">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {settings?.storeLogo && <img src={settings.storeLogo} alt="" style={{ height: 28, width: 28, objectFit: "contain", borderRadius: 4 }} />}
              <strong style={{ fontSize: "1rem" }}>{settings?.storeName || "Store"}</strong>
            </div>
            {featureFlags["Messaging"] && <NotificationBell onClick={() => setView("messages")} />}
            <button type="button" onClick={toggleDark} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.3rem 0.6rem", cursor: "pointer", fontSize: "0.85rem", color: "var(--text)", lineHeight: 1 }}>{isDark ? "☀️" : "🌙"}</button>
          </div>
          <div className="dash-section active" key={view}>
            {view === "dashboard" && <OwnerDashboard onNavigate={setView} />}
            {view === "orders" && <OwnerOrders />}
            {view === "products" && <OwnerProducts />}
            {view === "product-positioning" && <OwnerProductPositioning />}
            {view === "providers" && <OwnerProviders />}
            {view === "customers" && <OwnerCustomers />}
            {view === "quotes" && <OwnerQuotes />}
            {view === "messages" && <OwnerMessages />}
            {view === "reports" && <OwnerReports />}
            {view === "invoices" && <OwnerInvoices />}
            {view === "credit-notes" && <OwnerCreditNotes />}
            {view === "stock-control" && <OwnerStockControl />}
            {view === "stock-take" && <OwnerStockTake />}
            {view === "tech-repairs" && <OwnerTechRepairs />}
            {view === "branches" && <OwnerBranches />}
            {view === "shop-subscription" && <OwnerShopSubscription />}
            {view === "about-us" && <OwnerAboutUs />}
            {view === "storefront" && <OwnerStorefront staffRole={staffRole} />}
            {view === "audit" && <OwnerAuditLog />}
            {view === "whatsapp-settings" && <WhatsAppSettings />}
          </div>
      </div>
    </div>
  );
}

function useFetch<T>(fetcher: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    fetcher().then((d) => { if (!cancelled) setData(d); }).catch((e: any) => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, deps);
  return { data, loading, error, refetch: () => { setLoading(true); fetcher().then(setData).catch((e: any) => setError(e.message)).finally(() => setLoading(false)); } };
}

function Spinner() { return <div style={{ textAlign: "center", padding: "2rem" }}><div className="loading-bar" /><p className="muted">Loading...</p></div>; }
function ErrorMsg({ msg }: { msg: string }) { return <p className="error">{msg}</p>; }

// ===================== DASHBOARD =====================
function OwnerDashboard({ onNavigate }: { onNavigate: (v: OwnerView) => void }) {
  const { data: stats, loading: statsLoading } = useFetch(() => api<any>("/api/backoffice/stats"), []);
  const { data: sales, loading: salesLoading } = useFetch(() => api<any>("/api/reports/sales"), []);
  const { data: stock, loading: stockLoading } = useFetch(() => api<{ items: any[] }>("/api/reports/stock-summary"), []);

  const loading = statsLoading || salesLoading || stockLoading;

  if (loading) return <><h1>Dashboard</h1><SkeletonStats /></>;

  return (
    <>
      <h1 className="anim-fade-in-down">Dashboard</h1>
      <div className="stat-grid">
        <div className="stat-card card-hover" style={{ cursor: "pointer" }} onClick={() => onNavigate("tech-repairs")}><div className="stat-card__value"><AnimatedCounter value={stats?.openRepairs ?? 0} /></div><div className="stat-card__label">Open Repairs</div></div>
        <div className="stat-card card-hover" style={{ cursor: "pointer" }} onClick={() => onNavigate("tech-repairs")}><div className="stat-card__value"><AnimatedCounter value={stats?.repairsDueToday ?? 0} /></div><div className="stat-card__label">Due Today</div></div>
        <div className="stat-card card-hover" style={{ cursor: "pointer" }} onClick={() => onNavigate("reports")}><div className="stat-card__value"><AnimatedCounter value={sales?.totalOrders ?? 0} /></div><div className="stat-card__label">Total Orders</div></div>
        <div className="stat-card card-hover" style={{ cursor: "pointer" }} onClick={() => onNavigate("reports")}><div className="stat-card__value">{formatPrice(sales?.totalRevenue ?? 0)}</div><div className="stat-card__label">Revenue</div></div>
      </div>
      <div className="stat-grid">
        <div className="stat-card card-hover" style={{ cursor: "pointer" }} onClick={() => onNavigate("reports")}><div className="stat-card__value"><AnimatedCounter value={stock?.items?.length ?? 0} /></div><div className="stat-card__label">Products in Stock</div></div>
        <div className="stat-card card-hover" style={{ cursor: "pointer" }} onClick={() => onNavigate("reports")}><div className="stat-card__value"><AnimatedCounter value={stock?.items?.filter((i: any) => i.quantityInStock <= i.lowStockThreshold)?.length ?? 0} /></div><div className="stat-card__label">Low Stock Items</div></div>
      </div>
    </>
  );
}

// ===================== PRODUCTS =====================
const COMMON_FEATURES_LIST = [
  "Analytics dashboard", "API access", "Audit log",
  "Barcode scanning", "Branch management", "Bulk import/export",
  "Bulk product edit", "Client/tenant management",
  "Custom branding", "Customer management",
  "Dedicated account manager", "Discount/coupon management",
  "Email notifications", "eTIMS/KRA compliance",
  "Google Sign-In", "Inventory forecasting",
  "Invoice/quote PDF downloads", "Low stock alerts", "Loyalty program",
  "Messaging", "M-Pesa integration",
  "Multi-branch support", "Multi-currency support",
  "Multiple staff accounts", "Order management",
  "Payment method configuration", "POS integration",
  "Price history tracking", "Priority support",
  "Product listing", "Product positioning", "Product reviews & ratings",
  "Purchase order management", "Quotations",
  "Repair ticketing", "Returns management",
  "Shop subscription", "SMS notifications",
  "Spec templates", "Stock take / inventory count",
  "Stock transfers", "Supplier management",
  "Theme customization",
  "Credit notes", "Admin messaging",
  "Hero customization", "Customer reviews",
];

function OwnerOrders() {
  const { data: oData, loading, error, refetch } = useFetch(() => api<{ orders: any[] }>("/api/admin/orders"), []);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);

  async function openDetail(id: number) {
    setDetailLoading(true);
    try {
      const order = await api<any>(`/api/admin/orders/${id}`);
      setDetail(order);
    } catch {}
    finally { setDetailLoading(false); }
  }

  async function handleStatus(id: number, status: string) {
    setUpdating(id);
    try {
      await api(`/api/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      if (detail && detail.id === id) setDetail((prev: any) => prev ? { ...prev, status } : prev);
      refetch();
    } catch {}
    finally { setUpdating(null); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  if (detail) {
    const o = detail;
    return (
      <>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
          <RippleButton variant="ghost" onClick={() => setDetail(null)}>&larr; Back</RippleButton>
          <h1 style={{ margin: 0 }}>Order #{o.id}</h1>
          <span className={`badge ${o.status === "delivered" ? "badge-green" : o.status === "cancelled" ? "badge-red" : "badge-blue"}`}>{o.status}</span>
        </div>
        <div className="form-grid" style={{ marginBottom: "1rem" }}>
          <div className="panel">
            <h3>Customer</h3>
            <p><strong>Name:</strong> {escapeHtml(o.customerName || "")}</p>
            <p><strong>Email:</strong> {escapeHtml(o.customerEmail || "")}</p>
          </div>
          <div className="panel">
            <h3>Shipping</h3>
            <p><strong>Name:</strong> {escapeHtml(o.shippingName || "")}</p>
            <p><strong>Address:</strong> {escapeHtml(o.shippingAddress || "")}</p>
            <p><strong>City:</strong> {escapeHtml(o.shippingCity || "")}</p>
            <p><strong>County:</strong> {escapeHtml(o.shippingCounty || "-")}</p>
            <p><strong>Postcode:</strong> {escapeHtml(o.shippingPostcode || "-")}</p>
            <p><strong>Phone:</strong> {escapeHtml(o.shippingPhone || "-")}</p>
          </div>
        </div>
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <h3 style={{ margin: 0 }}>Items</h3>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <strong>Status:</strong>
              <select value={o.status} onChange={(e) => handleStatus(o.id, e.target.value)} disabled={updating === o.id} style={{ padding: "0.25rem 0.5rem", borderRadius: 4, border: "1px solid var(--border)" }}>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <table className="data-table">
            <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Line Total</th></tr></thead>
            <tbody>
              {(o.items || []).map((item: any, i: number) => (
                <tr key={item.id || i}>
                  <td>{escapeHtml(item.name)}</td>
                  <td>{item.quantity}</td>
                  <td>{formatPrice(item.price)}</td>
                  <td>{formatPrice(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: "0.75rem", textAlign: "right" }}>
            <p><strong>Subtotal:</strong> {formatPrice(o.subtotal || 0)}</p>
            <p><strong>Shipping:</strong> {formatPrice(o.shippingFee || 0)}</p>
          </div>
        </div>
        {o.notes && (
          <div className="panel" style={{ marginBottom: "1rem" }}>
            <h3>Notes</h3>
            <p>{escapeHtml(o.notes)}</p>
          </div>
        )}
        <p className="muted" style={{ fontSize: "0.85rem" }}>Created: {new Date(o.createdAt).toLocaleString("en-GB")} &middot; Updated: {o.updatedAt ? new Date(o.updatedAt).toLocaleString("en-GB") : "-"}</p>
      </>
    );
  }

  const orders = oData?.orders || [];
  return (
    <>
      <h1>All Orders</h1>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>#</th><th>Customer</th><th>Email</th><th>Items</th><th>Subtotal</th><th>Shipping</th><th>County</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {orders.map((o: any) => (
              <tr key={o.id} onClick={() => openDetail(o.id)} style={{ cursor: "pointer" }} className="clickable-row">
                <td>{o.id}</td>
                <td>{escapeHtml(o.customerName || "")}</td>
                <td>{escapeHtml(o.customerEmail || "")}</td>
                <td>{(o.items || []).length}</td>
                <td>{formatPrice(o.subtotal || 0)}</td>
                <td>{formatPrice(o.shippingFee || 0)}</td>
                <td>{escapeHtml(o.shippingCounty || "-")}</td>
                <td><span className={`badge ${o.status === "delivered" ? "badge-green" : o.status === "cancelled" ? "badge-red" : "badge-blue"}`}>{o.status}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>{new Date(o.createdAt).toLocaleDateString("en-GB")}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={9}><EmptyState icon="orders" title="No orders" description="Orders will appear here after customers place them." /></td></tr>}
          </tbody>
        </table>
      </div>
      {detailLoading && <Spinner />}
    </>
  );
}

const OwnerProducts = AdminProducts;

// ===================== PROVIDERS =====================
const OwnerProviders = ProvidersPage;

// ===================== TECHNICIANS =====================
// ===================== CUSTOMERS =====================
function OwnerCustomers() {
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
    } catch (err: any) { setFormErr(err.message); }
  }

  async function handleToggle(c: any) {
    try {
      await api(`/api/admin/customers/${c.id}/status`, { method: "PATCH", body: JSON.stringify({ isActive: !c.is_active }) });
      load();
    } catch {}
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this customer and all their data?")) return;
    setDeleting(id);
    try { await api(`/api/admin/customers/${id}`, { method: "DELETE" }); load(); }
    catch {}
    finally { setDeleting(null); }
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
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Last Login</th><th>Registered</th><th>Actions</th></tr></thead>
          <tbody>
            {customers.map((c: any) => (
              <tr key={c.id} style={!c.is_active ? { opacity: 0.6 } : {}}>
                <td>{c.id}</td>
                <td>{escapeHtml(c.name)}</td>
                <td>{escapeHtml(c.email)}</td>
                <td>{escapeHtml(c.phone || "-")}</td>
                <td><span className={`badge ${c.is_active ? "badge-green" : "badge-red"}`}>{c.is_active ? "Active" : "Inactive"}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>{c.last_login ? new Date(c.last_login).toLocaleDateString("en-GB") : "-"}</td>
                <td style={{ whiteSpace: "nowrap" }}>{new Date(c.created_at).toLocaleDateString("en-GB")}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <RippleButton size="small" variant="ghost" onClick={() => handleToggle(c)}>{c.is_active ? "Deactivate" : "Activate"}</RippleButton>
                  <RippleButton size="small" variant="danger" onClick={() => handleDelete(c.id)} loading={deleting === c.id}>Delete</RippleButton>
                </td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan={8}><EmptyState icon="customers" title="No customers" description="Customers will appear here after placing orders." /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ===================== QUOTES =====================
function OwnerQuotes() {
  return <QuotesPage />;
}

// ===================== MESSAGES =====================
function OwnerMessages() {
  const { data: mData, loading, error, refetch } = useFetch(() => api<{ messages: any[] }>("/api/admin/messages"), []);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const { toast } = useToast();
  const prevCountRef = useRef(0);

  const allMessages = mData?.messages || [];

  // Poll for new messages
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const d = await api<{ messages: any[] }>("/api/admin/messages");
        const newMsgs = d.messages || [];
        const newCount = newMsgs.length;
        if (newCount > prevCountRef.current && prevCountRef.current > 0) {
          toast("info", `${newCount - prevCountRef.current} new message(s)`);
        }
        prevCountRef.current = newCount;
        refetch();
      } catch {}
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!prevCountRef.current && allMessages.length) prevCountRef.current = allMessages.length;

  if (loading && !mData) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  // Group messages by conversation (customer_id + provider_id)
  const groups = new Map<string, any[]>();
  for (const m of allMessages) {
    const key = `${m.customer_id}-${m.provider_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  // Build conversation list sorted by latest message
  const convos = [...groups.entries()].map(([key, msgs]) => {
    msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const latest = msgs[msgs.length - 1];
    return {
      key,
      msgs,
      latest,
      unread: msgs.filter((m) => !m.read_at).length,
      custName: latest.customer_name || "Customer",
      provName: latest.provider_company || "Provider",
      subj: latest.subject || "(no subject)",
    };
  });
  convos.sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime());

  const activeConvo = convos.find((c) => c.key === selectedKey);

  // Mark messages as read
  async function markRead(msgs: any[]) {
    const unread = msgs.filter((m) => !m.read_at);
    for (const m of unread) {
      try { await api(`/api/admin/messages/${m.id}/read`, { method: "PATCH" }); } catch {}
    }
    if (unread.length) refetch();
  }

  function selectConvo(key: string, msgs: any[]) {
    setSelectedKey(key);
    setReplyBody("");
    markRead(msgs);
  }

  return (
    <>
      <h1>Messages</h1>
      <div className="order-item" style={{ display: "flex", gap: "1rem", padding: 0, minHeight: "60vh" }}>
        {/* Conversation list */}
        <div style={{ width: 280, borderRight: "1px solid var(--border)", overflowY: "auto", flexShrink: 0 }}>
          {convos.length === 0 ? (
            <div style={{ padding: "1rem", textAlign: "center", opacity: 0.5 }}>No conversations</div>
          ) : convos.map((c) => (
            <div key={c.key} onClick={() => selectConvo(c.key, c.msgs)} style={{
              padding: "0.75rem 1rem",
              cursor: "pointer",
              borderBottom: "1px solid var(--border)",
              background: selectedKey === c.key ? "var(--primary)" : "transparent",
              color: selectedKey === c.key ? "#fff" : "var(--text)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "0.9rem" }}>{escapeHtml(c.custName)} ↔ {escapeHtml(c.provName)}</strong>
                {c.unread > 0 && <span style={{ background: selectedKey === c.key ? "#fff" : "var(--primary)", color: selectedKey === c.key ? "var(--primary)" : "#fff", borderRadius: 999, padding: "0.1rem 0.5rem", fontSize: "0.75rem", fontWeight: 600 }}>{c.unread}</span>}
              </div>
              <div style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {escapeHtml(c.latest.body)}
              </div>
              <div style={{ fontSize: "0.7rem", opacity: 0.5, marginTop: "0.15rem" }}>
                {new Date(c.latest.created_at).toLocaleString("en-GB")}
              </div>
            </div>
          ))}
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {!activeConvo ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4 }}>
              Select a conversation
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>
                {escapeHtml(activeConvo.subj)} — {escapeHtml(activeConvo.custName)} ↔ {escapeHtml(activeConvo.provName)}
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {activeConvo.msgs.map((m) => {
                  const isCustomer = m.sender_role === "customer";
                  return (
                    <div key={m.id} style={{
                      alignSelf: isCustomer ? "flex-start" : "flex-end",
                      maxWidth: "75%",
                      background: isCustomer ? "var(--surface)" : "var(--primary)",
                      color: isCustomer ? "var(--text)" : "#fff",
                      borderRadius: "12px",
                      padding: "0.6rem 1rem",
                      border: isCustomer ? "1px solid var(--border)" : "none",
                    }}>
                      <div style={{ fontSize: "0.85rem", marginBottom: "0.25rem", opacity: 0.8 }}>
                        {isCustomer ? escapeHtml(activeConvo.custName) : escapeHtml(activeConvo.provName)}
                      </div>
                      <div style={{ fontSize: "0.9rem" }}>{escapeHtml(m.body)}</div>
                      <div style={{ fontSize: "0.7rem", marginTop: "0.25rem", textAlign: "right", opacity: 0.7 }}>
                        {new Date(m.created_at).toLocaleString("en-GB")}
                        {m.read_at ? <span style={{ marginLeft: "0.5rem" }}>✓ Read {new Date(m.read_at).toLocaleString("en-GB")}</span> : <span style={{ marginLeft: "0.5rem" }}>●</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply input */}
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!replyBody.trim()) return;
                try {
                  await api("/api/admin/messages", {
                    method: "POST",
                    body: JSON.stringify({ customerId: activeConvo.latest.customer_id, providerId: activeConvo.latest.provider_id, subject: activeConvo.latest.subject, body: replyBody })
                  });
                  setReplyBody("");
                  refetch();
                } catch (err: any) { toast("error", err.message); }
              }} style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--border)", display: "flex", gap: "0.5rem" }}>
                <textarea rows={1} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Type a message..." required style={{ flex: 1, resize: "none" }} />
                <button type="submit" className="btn btn-sm">Send</button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ===================== REPORTS =====================
function OwnerReports() {
  const [tab, setTab] = useState<"sales" | "stock">("sales");

  return (
    <>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <RippleButton size="small" variant={tab === "sales" ? "primary" : "ghost"} onClick={() => setTab("sales")}>Sales Report</RippleButton>
        <RippleButton size="small" variant={tab === "stock" ? "primary" : "ghost"} onClick={() => setTab("stock")}>Stock on Hand</RippleButton>
      </div>
      {tab === "sales" && <OwnerSalesReport />}
      {tab === "stock" && <OwnerStockSummary />}
    </>
  );
}

// ===================== SALES REPORT =====================
function OwnerSalesReport() {
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
              {(branches?.branches || []).filter((b: Branch) => b.isActive).map((b: Branch) => (
                <option key={b.id} value={b.id}>{escapeHtml(b.name)}</option>
              ))}
            </select>
          </label>
        </div>
        <RippleButton onClick={fetchReport} loading={loading}>Generate</RippleButton>
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

// ===================== STOCK SUMMARY =====================
const OwnerStockSummary = () => <StockOnHandPage />;

// ===================== STOCK CONTROL =====================
function OwnerStockControl() {
  const { data: sData, loading, error, refetch } = useFetch(() => api<{ items: any[] }>("/api/reports/stock-summary"), []);
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

// ===================== STOCK TAKE =====================
const OwnerStockTake = StockTakeListPage;

// ===================== SHOP SUBSCRIPTION =====================
function OwnerShopSubscription() {
  const { data: subData, loading, error, refetch } = useFetch(() => api<{ plan: SubscriptionPlan; activatedAt: string | null }>("/api/shop/subscription"), []);
  const { data: plansData } = useFetch(() => api<{ plans: SubscriptionPlan[] }>("/api/plans"), []);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [branchPlans, setBranchPlans] = useState<any[]>([]);
  const [branchPlanEditId, setBranchPlanEditId] = useState<number | null>(null);
  const [branchPlanLoading, setBranchPlanLoading] = useState<number | null>(null);

  async function requestPlan() {
    if (!selectedPlan) return;
    setSaving(true); setMsg("");
    try {
      await api("/api/shop/subscription/request", { method: "POST", body: JSON.stringify({ planId: selectedPlan, notes }) });
      setMsg("Request submitted for admin approval.");
      setSelectedPlan(""); setNotes("");
      refetch();
    } catch (err: any) { setMsg("Error: " + err.message); }
    finally { setSaving(false); }
  }

  function parseFeatures(raw: any): string[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") { try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch {} return raw.split(",").map((s: string) => s.trim()).filter(Boolean); }
    return [];
  }

  useEffect(() => {
    fetch("/api/admin/branches").then(r => r.json()).then(d => setBranches(d.branches || [])).catch(() => {});
    fetch("/api/plans/all").then(r => r.json()).then(d => setBranchPlans(d.plans || d || [])).catch(() => {});
  }, []);

  const changeBranchPlan = async (branchId: number, planId: string) => {
    setBranchPlanLoading(branchId);
    try {
      if (!getCsrfToken()) await initCsrf();
      const res = await fetch(`/api/admin/branches/${branchId}/plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrfToken() || "" },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) throw new Error("Failed");
      setBranches(prev => prev.map(b => b.id === branchId ? { ...b, planId } : b));
      setMsg("Branch plan updated.");
    } catch {
      setMsg("Error: Failed to update branch plan.");
    } finally {
      setBranchPlanLoading(null);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const currentPlan = subData?.plan;
  const activatedAt = subData?.activatedAt;
  const allPlans = plansData?.plans || [];
  const daysRemaining = activatedAt ? Math.max(0, 30 - Math.floor((Date.now() - new Date(activatedAt).getTime()) / (1000 * 60 * 60 * 24))) : null;

  return (
    <>
      <h1>Shop Subscription</h1>
      {msg && <div className="panel" style={{ marginBottom: "1rem", background: msg.startsWith("Error") ? "#fee2e2" : "#d1fae5", color: msg.startsWith("Error") ? "#991b1b" : "#065f46" }}>{msg}</div>}

      {currentPlan && (
        <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
          <div className="stat-card">
            <div className="stat-card__value">{escapeHtml(currentPlan.name)}</div>
            <div className="stat-card__label">Current Plan</div>
            <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--primary)", margin: "0.5rem 0 0" }}>{formatPrice(currentPlan.price)}<span style={{ fontSize: "0.8rem", fontWeight: 400, opacity: 0.6 }}>/mo</span></p>
            {currentPlan.priceAnnual != null && currentPlan.priceAnnual > 0 && <p style={{ fontSize: "0.9rem", color: "var(--primary)", margin: "0.25rem 0 0" }}>{formatPrice(currentPlan.priceAnnual)}<span style={{ fontSize: "0.8rem", fontWeight: 400, opacity: 0.6 }}>/yr (save {Math.round((1 - currentPlan.priceAnnual / (currentPlan.price * 12)) * 100)}%)</span></p>}
          </div>
          <div className="stat-card">
            <div className="stat-card__value" style={{ color: daysRemaining !== null && daysRemaining <= 7 ? "#dc2626" : undefined }}>
              {daysRemaining !== null ? `${daysRemaining} days` : "—"}
            </div>
            <div className="stat-card__label">Until Renewal</div>
            {daysRemaining !== null && daysRemaining <= 7 && <p style={{ fontSize: "0.8rem", color: "#dc2626", margin: "0.25rem 0 0" }}>Renew soon!</p>}
          </div>
        </div>
      )}

      {branches.length > 1 && (
        <div className="space-y-3" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Branch Plans</h3>
          <p className="muted" style={{ fontSize: "0.85rem" }}>Each branch can have its own subscription plan independent of the shop-wide plan.</p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Current Plan</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {branches.map(b => {
                  const plan = branchPlans.find((p: any) => p.id === b.planId);
                  return (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 500 }}>{escapeHtml(b.name)}</td>
                      <td>
                        <span className="plan-status" style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 4, fontSize: "0.8rem" }}>
                          {plan ? escapeHtml(plan.name) : b.planId || "No plan"}
                        </span>
                      </td>
                      <td>
                        <span style={{ background: b.isActive ? "var(--success)" : "var(--danger)", color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: "0.8rem" }}>
                          {b.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {branchPlanEditId === b.id ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
                            <select
                              defaultValue={b.planId || ""}
                              onChange={e => changeBranchPlan(b.id, e.target.value)}
                              disabled={branchPlanLoading === b.id}
                              style={{ padding: "0.25rem 0.5rem", borderRadius: 4, border: "1px solid var(--border)", fontSize: "0.85rem" }}
                            >
                              {branchPlans.filter((p: any) => p.isActive !== false).map((p: any) => (
                                <option key={p.id} value={p.id}>{escapeHtml(p.name)}</option>
                              ))}
                            </select>
                            <RippleButton size="small" variant="ghost" onClick={() => setBranchPlanEditId(null)}>Cancel</RippleButton>
                          </div>
                        ) : (
                          <RippleButton size="small" variant="ghost" onClick={() => setBranchPlanEditId(b.id)} loading={branchPlanLoading === b.id}>Change Plan</RippleButton>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Available Plans</h3>
        <p className="muted">All prices shown as monthly and annual. Annual billing saves you money.</p>
        <div className="product-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", marginTop: "1rem" }}>
          {allPlans.map((p) => {
            const features = parseFeatures(p.features);
            const isCurrent = p.id === currentPlan?.id;
            const monthlySaved = p.priceAnnual != null && p.priceAnnual > 0 && p.price > 0 ? Math.round((1 - p.priceAnnual / (p.price * 12)) * 100) : 0;
            return (
              <div key={p.id} className="panel" style={{ border: isCurrent ? "2px solid var(--primary)" : undefined, opacity: isCurrent ? 0.7 : 1, display: "flex", flexDirection: "column" }}>
                <h3 style={{ marginTop: 0 }}>{escapeHtml(p.name)}</h3>
                <p style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--primary)", margin: "0" }}>{formatPrice(p.price)}<span style={{ fontSize: "0.8rem", fontWeight: 400, opacity: 0.6 }}>/mo</span></p>
                {p.priceAnnual != null && p.priceAnnual > 0 && <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--primary)", margin: "0.25rem 0 0" }}>{formatPrice(p.priceAnnual)}<span style={{ fontSize: "0.8rem", fontWeight: 400, opacity: 0.6 }}>/yr{monthlySaved > 0 && ` (save ${monthlySaved}%)`}</span></p>}
                <p className="muted" style={{ margin: "0.5rem 0" }}>Up to {p.maxProducts} products &bull; {p.maxBranches} branch{p.maxBranches !== 1 ? "es" : ""}</p>
                {features.length > 0 && <ul style={{ margin: "0.5rem 0", padding: "0 0 0 1.2rem", flex: 1, fontSize: "0.85rem" }}>{features.map((f, i) => <li key={i}>{f}</li>)}</ul>}
                {isCurrent ? (
                  <span className="plan-status" style={{ display: "inline-block", marginTop: "0.5rem", padding: "0.3rem 0.8rem", borderRadius: 6, background: "#d1fae5", color: "#065f46", fontSize: "0.85rem", fontWeight: 600, textAlign: "center" }}>Current Plan</span>
                ) : (
                  <RippleButton size="small" style={{ marginTop: "0.5rem" }} onClick={() => { setSelectedPlan(p.id); document.getElementById("request-form")?.scrollIntoView({ behavior: "smooth" }); }}>Switch to {escapeHtml(p.name)}</RippleButton>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div id="request-form" className="panel" style={{ maxWidth: 500 }}>
        <h3 style={{ marginTop: 0 }}>Request Plan Change</h3>
        <p className="muted">Submit a request to change your subscription plan. Admin will review and approve it.</p>
        <div className="field"><label>Plan<select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}><option value="">Select...</option>{allPlans.map((p) => <option key={p.id} value={p.id} disabled={p.id === currentPlan?.id}>{escapeHtml(p.name)} {p.id === currentPlan?.id ? "(current)" : ""}</option>)}</select></label></div>
        <div className="field"><label>Notes (optional)<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Reason for change..." /></label></div>
        <RippleButton onClick={requestPlan} loading={saving} disabled={!selectedPlan || selectedPlan === currentPlan?.id}>Submit Request</RippleButton>
      </div>
    </>
  );
}

// ===================== TECHNICIAN REPAIRS =====================
function OwnerTechRepairs() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { fetchReport(); }, []);

  function fetchReport() {
    setLoading(true); setError("");
    api<any>(`/api/reports/technician-repairs?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(setData).catch((e: any) => setError(e.message)).finally(() => setLoading(false));
  }

  const techs = data?.technicians || [];

  return (
    <>
      <h1>Technician Repair Report</h1>
      <div className="panel" style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "end", flexWrap: "wrap" }}>
        <div className="field" style={{ margin: 0 }}><label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label></div>
        <div className="field" style={{ margin: 0 }}><label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label></div>
        <RippleButton onClick={fetchReport} loading={loading}>Generate</RippleButton>
      </div>
      {error && <ErrorMsg msg={error} />}
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Technician</th><th>Total Repairs</th><th>Completed</th><th>Cancelled</th><th>Revenue</th></tr></thead>
          <tbody>
            {techs.map((t: any) => (
              <tr key={t.staff_id}><td>{escapeHtml(t.username)}</td><td>{t.total_repairs}</td><td>{t.completed}</td><td>{t.cancelled}</td><td>{formatPrice(t.total_revenue)}</td></tr>
            ))}
            {techs.length === 0 && <tr><td colSpan={5}><EmptyState icon="repairs" title="No repair data" description="Technician repair reports will appear here." /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function OwnerBranches() {
  const { data: bData, loading, error } = useFetch(() => api<{ branches: Branch[] }>("/api/admin/branches"), []);
  const owners = useRef<{ id: number; username: string }[]>([]);
  const [ownerMap, setOwnerMap] = useState<Record<number, string>>({});

  useEffect(() => {
    if (bData?.branches) {
      const map: Record<number, string> = {};
      bData.branches.forEach((b) => { if (b.managerId && b.managerName) map[b.managerId] = b.managerName; });
      setOwnerMap(map);
    }
  }, [bData]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const branches = bData?.branches || [];

  return (
    <>
      <h1>My Branches</h1>
      {branches.length === 0 ? (
        <EmptyState icon="default" title="No branches assigned" description="You have not been assigned to any branches yet. Contact your admin to get assigned." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Address</th><th>Phone</th><th>Email</th><th>Status</th></tr></thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id}>
                  <td><strong>{escapeHtml(b.name)}</strong></td>
                  <td>{escapeHtml(b.address || "—")}</td>
                  <td>{escapeHtml(b.phone || "—")}</td>
                  <td>{escapeHtml(b.email || "—")}</td>
                  <td><span style={{ background: b.isActive ? "var(--success)" : "var(--danger)", color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: "0.8rem" }}>{b.isActive ? "Active" : "Inactive"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const OwnerAboutUs = AboutUsPage;

function OwnerStorefront({ staffRole }: { staffRole: string | null }) {
  const [cfg, setCfg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState("default");
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
    shopNowLabel: "Shop Now",
    shopNowLink: "/pc",
    browseLabel: "Browse Categories",
    browseLink: "/#categories",
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
      setBannerInputs((d.banners || []).map((b: any) => ({ title: b.title || "", subtitle: b.subtitle || "" })));
      if (d.hero) {
        setHeroForm((prev) => ({ ...prev, ...d.hero }));
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
    try { await api("/api/admin/storefront-layout", { method: "PUT", body: JSON.stringify({ hero: heroForm }) }); await load(); }
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

  const THEME_CARDS = [
    { key: "default", label: "Default", desc: "Classic blue", swatches: ["#2563eb", "#60a5fa", "#f59e0b"] },
    { key: "kenyan", label: "Kenyan", desc: "Green primary with red & black accents — Kenyan flag inspired", swatches: ["#15803d", "#dc2626", "#0f172a"] },
    { key: "modern", label: "Modern", desc: "Violet + cyan — sleek and contemporary", swatches: ["#6d28d9", "#0891b2", "#a78bfa"] },
  ];

  if (loading) return <Spinner />;

  if (staffRole !== "admin") {
    return (
      <>
        <h1>Storefront Layout</h1>
        <p className="muted">Only admin users can manage the public storefront layout.</p>
        <div className="panel">
          <p className="muted">Your current role is <strong>{staffRole || "staff"}</strong>. Contact an admin to update the storefront design and banners.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>Storefront Layout</h1>
      <p className="muted">Choose how your store looks to customers. Layouts only change the presentation — no data is affected.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {layouts.map((l) => (
          <div key={l.key} className="panel" style={{ border: cfg?.layout === l.key ? "2px solid var(--primary)" : "1px solid var(--border)", cursor: "pointer" }} onClick={() => switchLayout(l.key)}>
            <div style={{ height: 120, borderRadius: 8, background: "var(--bg)", marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem" }}>
              {l.key === "original" ? "🏠" : l.key === "amazon" ? "📦" : l.key === "jumia" ? "🛒" : l.type === "dynamic" ? "🎨" : "📱"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h3 style={{ margin: "0 0 0.25rem" }}>{l.label}</h3>
              <span style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem", borderRadius: 4, background: l.type === "static" ? "var(--info-light)" : "var(--warning-light)", color: l.type === "static" ? "var(--info)" : "var(--warning)" }}>{l.type}</span>
            </div>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>{l.desc}</p>
            {cfg?.layout === l.key && <span className="badge badge-green" style={{ marginTop: "0.5rem" }}>Active</span>}
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3>Store Theme</h3>
        <p className="muted" style={{ fontSize: "0.85rem" }}>Pick a color theme for the whole storefront. Applied instantly to your live site.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
          {THEME_CARDS.map((t) => (
            <div key={t.key} className="panel" style={{ border: theme === t.key ? "2px solid var(--primary)" : "1px solid var(--border)", cursor: "pointer", margin: 0 }} onClick={() => saveTheme(t.key)}>
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

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3>Hero Section</h3>
        <p className="muted" style={{ fontSize: "0.85rem" }}>Control the hero banner, headline, and calls-to-action on your homepage.</p>

        <div className="form-grid" style={{ marginTop: "1rem" }}>
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
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: "0.5rem" }}>Highlights</label>
            {heroForm.highlights.map((h, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                <input value={h} onChange={(e) => { const copy = [...heroForm.highlights]; copy[i] = e.target.value; setHeroForm({ ...heroForm, highlights: copy }); }} style={{ flex: 1 }} />
                <button className="btn btn-sm btn-ghost" onClick={() => setHeroForm({ ...heroForm, highlights: heroForm.highlights.filter((_, j) => j !== i) })}>&times;</button>
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
                <button className="btn btn-sm btn-ghost" onClick={() => setHeroForm({ ...heroForm, catChips: heroForm.catChips.filter((_, j) => j !== i) })}>&times;</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <RippleButton size="small" variant="ghost" onClick={() => setHeroForm({ ...heroForm, catChips: [...heroForm.catChips, { label: "", href: "" }] })}>+ Add Chip</RippleButton>
              <RippleButton size="small" variant="ghost" onClick={async () => {
                try { const d = await api<any>("/api/categories"); const cats = d.categories || []; setHeroForm({ ...heroForm, catChips: cats.map((c: any) => ({ label: c.label, href: "/" + c.id })) }); } catch { alert("Failed to load categories"); }
              }}>Sync from Categories</RippleButton>
            </div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: "0.5rem" }}>Stats</label>
            {heroForm.stats.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                <input value={s.value} onChange={(e) => { const copy = [...heroForm.stats]; copy[i] = { ...copy[i], value: e.target.value }; setHeroForm({ ...heroForm, stats: copy }); }} placeholder="Value" style={{ width: 100 }} />
                <input value={s.label} onChange={(e) => { const copy = [...heroForm.stats]; copy[i] = { ...copy[i], label: e.target.value }; setHeroForm({ ...heroForm, stats: copy }); }} placeholder="Label" style={{ flex: 1 }} />
                <button className="btn btn-sm btn-ghost" onClick={() => setHeroForm({ ...heroForm, stats: heroForm.stats.filter((_, j) => j !== i) })}>&times;</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <RippleButton size="small" variant="ghost" onClick={() => setHeroForm({ ...heroForm, stats: [...heroForm.stats, { value: "", label: "" }] })}>+ Add Stat</RippleButton>
              <RippleButton size="small" variant="ghost" onClick={async () => {
                try { const d = await api<any>("/api/storefront-stats"); setHeroForm({ ...heroForm, stats: [{ value: String(d.totalProducts) + "+", label: "Products" }, { value: String(d.totalCustomers) + "+", label: "Customers" }, { value: String(d.totalOrders) + "+", label: "Orders" }] }); } catch { alert("Failed to load stats"); }
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

function OwnerInvoices() {
  const [tab, setTab] = useState<"provider" | "orders">("provider");
  const [iData, setIData] = useState<any[]>([]);
  const [iLoading, setILoading] = useState(true);
  const [oiData, setOiData] = useState<any[]>([]);
  const [oiLoading, setOiLoading] = useState(true);
  const [creditedOrders, setCreditedOrders] = useState<Record<number, boolean>>({});

  function load() {
    setILoading(true);
    api<{ invoices: any[] }>("/api/admin/invoices").then((d) => setIData(d.invoices || [])).catch(() => {}).finally(() => setILoading(false));
    setOiLoading(true);
    api<{ invoices: any[] }>("/api/admin/order-invoices").then((d) => {
      const invs = d.invoices || [];
      setOiData(invs);
      const ids = [...new Set(invs.map((inv: any) => inv.orderId))].join(",");
      if (ids) {
        api<{ credited: Record<number, boolean> }>(`/api/admin/credit-notes/order-status?orderIds=${ids}`).then((r) => setCreditedOrders(r.credited || {})).catch(() => {});
      }
    }).catch(() => {}).finally(() => setOiLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function markPaid(id: number) {
    try { await api(`/api/admin/invoices/${id}/pay`, { method: "POST" }); load(); } catch { alert("Failed"); }
  }

  async function markOiPaid(id: number) {
    try { await api(`/api/admin/order-invoices/${id}/pay`, { method: "POST" }); load(); } catch { alert("Failed"); }
  }

  async function generateInvoice() {
    try { await api("/api/admin/invoices/generate", { method: "POST" }); load(); } catch { alert("Generation failed"); }
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
      await downloadPdf(`/api/admin/credit-notes/${created.id}/view`, `credit-note-${created.id}.pdf`);
    } catch (err: any) {
      alert(err.message || "Failed to create credit note.");
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0 }}>Invoices</h2>
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
          {iLoading ? <p className="muted">Loading...</p> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>#</th><th>Provider</th><th>Amount</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {iData.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.id}</td>
                      <td>{escapeHtml(inv.providerName || "—")}</td>
                      <td>{formatPrice(inv.amount)}</td>
                      <td><span className="plan-status" style={{ background: inv.status === "paid" ? "#d1fae5" : "#fef3c7", color: inv.status === "paid" ? "#065f46" : "#92400e" }}>{inv.status}</span></td>
                      <td>{inv.status !== "paid" && <RippleButton size="small" style={{ background: "var(--success)", color: "#fff" }} onClick={() => markPaid(inv.id)}>Mark paid</RippleButton>}</td>
                    </tr>
                  ))}
                  {iData.length === 0 && <tr><td colSpan={5}><EmptyState icon="invoices" title="No invoices" description="Invoices will appear here once generated." /></td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "orders" && (
        <>
          {oiLoading ? <p className="muted">Loading...</p> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>#</th><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th><th></th></tr></thead>
                <tbody>
                  {oiData.map((inv: any) => (
                    <tr key={inv.id}>
                      <td>{inv.id}</td>
                      <td>#{inv.orderId}</td>
                      <td>{escapeHtml(inv.customer_name || "—")}</td>
                      <td>{formatPrice(inv.amount)}</td>
                      <td><span className="plan-status" style={{ background: inv.status === "paid" ? "#d1fae5" : "#fef3c7", color: inv.status === "paid" ? "#065f46" : "#92400e" }}>{inv.status}</span></td>
                      <td style={{ whiteSpace: "nowrap" }}>{new Date(inv.createdAt || inv.created_at).toLocaleDateString("en-GB")}</td>
                      <td>
                        {inv.status !== "paid" && <RippleButton size="small" style={{ background: "var(--success)", color: "#fff" }} onClick={() => markOiPaid(inv.id)}>Mark paid</RippleButton>}
                        <RippleButton size="small" variant="ghost" style={{ marginLeft: "0.25rem" }} onClick={async () => { try { const r = await api<{ token: string }>("/api/admin/invoice-token/" + inv.orderId, { method: "POST" }); const res = await fetch(`/api/admin/orders/${inv.orderId}/invoice?allowQueryToken=1&token=${encodeURIComponent(r.token)}`, { headers: { Authorization: `Bearer ${r.token}` } }); if (!res.ok) throw new Error(`HTTP ${res.status}`); const html = await res.text(); const blob = new Blob([html], { type: "text/html" }); const url = URL.createObjectURL(blob); window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 30000); } catch (e: any) { alert("Failed to open invoice: " + (e?.message || "Unknown error")); } }}>View</RippleButton>
                        {creditedOrders[inv.orderId] ? (
                          <span className="btn btn-sm" style={{ marginLeft: "0.25rem", background: "#d1fae5", color: "#065f46", cursor: "default" }}>Credited</span>
                        ) : (
                          <RippleButton size="small" style={{ marginLeft: "0.25rem" }} onClick={() => createCreditNote(inv.orderId)}>Credit Note</RippleButton>
                        )}
                      </td>
                    </tr>
                  ))}
                  {oiData.length === 0 && <tr><td colSpan={7}><EmptyState icon="invoices" title="No order invoices" description="Order invoices appear automatically when an order is shipped or delivered." /></td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

const OwnerCreditNotes = CreditNotesPage;

function OwnerAuditLog() {
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

// ===================== PRODUCT POSITIONING =====================
const OwnerProductPositioning = ProductPositioningPage;
