import React, { useEffect, useRef, useState } from "react";
import { api, getStaffToken, downloadPdf } from "@/lib/api";
import type { Product, Order, Provider, SubscriptionPlan, Customer, Branch } from "@/lib/types";
import RippleButton from "@/components/RippleButton";
import { getLayoutList } from "@/layouts";
import { SkeletonStats, SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import AnimatedCounter from "@/components/AnimatedCounter";
import { useApp } from "@/lib/app-context";
import { useToast } from "@/components/Toast";
import QuotesPage from "./quotes";
import NotificationBell from "@/components/NotificationBell";
import { useFeature } from "@/lib/features";

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);
}

function escapeHtml(v: string) { return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }

type OwnerView = "dashboard" | "orders" | "products" | "providers" | "customers" | "messages" | "reports" | "invoices" | "credit-notes" | "stock-control" | "stock-take" | "tech-repairs" | "branches" | "audit" | "shop-subscription" | "storefront" | "about-us" | "quotes";

const NAV_ITEMS: { key: OwnerView; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "orders", label: "Orders" },
  { key: "products", label: "Products" },
  { key: "providers", label: "Providers" },
  { key: "customers", label: "Customers" },
  { key: "quotes", label: "Quotes" },
  { key: "messages", label: "Messages" },
  { key: "reports", label: "Reports" },
  { key: "invoices", label: "Invoices" },
  { key: "credit-notes", label: "Credit Notes" },
  { key: "stock-control", label: "Stock Control" },
  { key: "stock-take", label: "Stock Take" },
  { key: "tech-repairs", label: "Tech Repairs" },
  { key: "branches", label: "Branches" },
  { key: "shop-subscription", label: "Shop Subscription" },
  { key: "about-us", label: "About Us" },
  { key: "storefront", label: "Storefront" },
  { key: "audit", label: "Audit Log" },
];

export default function OwnerPage() {
  const { isDark, toggleDark, settings } = useApp();
  const [authed, setAuthed] = useState(false);
  const [view, setView] = useState<OwnerView>("dashboard");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const messagingEnabled = useFeature("Messaging");
  const branchManagementEnabled = useFeature("Branch management");

  useEffect(() => {
    if (getStaffToken()) {
      setAuthed(true);
      setStaffRole(localStorage.getItem("staffRole"));
    }
  }, []);

  const visibleNav = staffRole === "admin" ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.key !== "storefront");
  const filteredNav = visibleNav.filter((item) => (item.key !== "messages" || messagingEnabled) && (item.key !== "branches" || branchManagementEnabled));

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
        {filteredNav.map((item) => (
          <RippleButton key={item.key} variant="ghost" className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}>{item.label}</RippleButton>
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
            {messagingEnabled && <NotificationBell onClick={() => setView("messages")} />}
            <button type="button" onClick={toggleDark} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.3rem 0.6rem", cursor: "pointer", fontSize: "0.85rem", color: "var(--text)", lineHeight: 1 }}>{isDark ? "☀️" : "🌙"}</button>
          </div>
          <div className="dash-section active" key={view}>
            {view === "dashboard" && <OwnerDashboard onNavigate={setView} />}
            {view === "orders" && <OwnerOrders />}
            {view === "products" && <OwnerProducts />}
            {view === "providers" && <OwnerProviders />}
            {view === "customers" && <OwnerCustomers />}
            {view === "quotes" && <OwnerQuotes />}
            {view === "messages" && (messagingEnabled ? <OwnerMessages /> : <p className="muted">Messaging is not included in your current plan.</p>)}
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
  "Product listing", "Product reviews & ratings",
  "Purchase order management", "Quotations",
  "Repair ticketing", "Returns management",
  "Shop subscription", "SMS notifications",
  "Spec templates", "Stock take / inventory count",
  "Stock transfers", "Supplier management",
  "Theme customization",
  "Credit notes", "Admin messaging",
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
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

function OwnerProducts() {
  const { data: pData, loading, error, refetch } = useFetch(() => api<{ products: Product[] }>("/api/products"), []);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gallery, setGallery] = useState<any[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [selCategory, setSelCategory] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [specFields, setSpecFields] = useState<any[]>([]);
  const [specValues, setSpecValues] = useState<Record<string, string>>({});
  const empty: Product = { id: "", name: "", price: 0, currency: "KES", imageUrl: "", category: "", subcategory: "", inStock: true, isNonStock: false, specs: [], minTier: 0 };

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories || [])).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const cat = creating ? selCategory : (editing?.category || "");
    if (cat) {
      api<{ fields: any[] }>(`/api/spec-templates?category=${encodeURIComponent(cat)}`).then(d => {
        setSpecFields(d.fields || []);
        if (!creating && editing) {
          const vals: Record<string, string> = {};
          (editing.specs || []).forEach((s: any) => {
            if (typeof s === "string") { const m = s.match(/^([^:]+):\s*(.+)/); if (m) vals[m[1].toLowerCase().replace(/\s+/g, "_")] = m[2]; }
            else if (s && s.f) vals[s.f] = s.v;
          });
          setSpecValues(vals);
        }
      }).catch(() => setSpecFields([]));
    } else { setSpecFields([]); setSpecValues({}); }
  }, [creating, editing?.id, selCategory]);

  async function loadGallery(productId: string) {
    setGalleryLoading(true);
    try { const d = await api<{ images: any[] }>(`/api/products/${encodeURIComponent(productId)}/images`); setGallery(d.images || []); } catch { setGallery([]); }
    finally { setGalleryLoading(false); }
  }

  async function uploadPrimaryImage(productId: string, file: File) {
    const fd = new FormData();
    fd.append("image", file);
    try { await api(`/api/products/${encodeURIComponent(productId)}/image`, { method: "POST", body: fd }); refetch(); } catch (err: any) { alert("Primary upload failed: " + err.message); }
  }

  async function uploadGalleryImages(productId: string) {
    const files = galleryRef.current?.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("image", file);
      try { await api(`/api/products/${encodeURIComponent(productId)}/images`, { method: "POST", body: fd }); } catch (err: any) { alert("Upload failed: " + err.message); }
    }
    if (galleryRef.current) galleryRef.current.value = "";
    await loadGallery(productId);
  }

  async function deleteGalleryImage(productId: string, imageId: number) {
    if (!confirm("Remove this image?")) return;
    try { await api(`/api/products/${encodeURIComponent(productId)}/images/${imageId}`, { method: "DELETE" }); await loadGallery(productId); } catch { alert("Delete failed"); }
  }

  async function setPrimary(productId: string, imageId: number) {
    try { await api(`/api/products/${encodeURIComponent(productId)}/images/${imageId}/primary`, { method: "PUT" }); await loadGallery(productId); refetch(); } catch (err: any) { alert("Failed: " + err.message); }
  }

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  function onDragStart(idx: number) { setDragIdx(idx); }
  function onDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDropIdx(idx); }
  function onDragEnd() { setDragIdx(null); setDropIdx(null); }
  async function onDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx || !editing) { setDragIdx(null); setDropIdx(null); return; }
    const next = [...gallery];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setGallery(next);
    setDragIdx(null);
    setDropIdx(null);
    try {
      await api(`/api/products/${encodeURIComponent(editing.id)}/images/reorder`, { method: "PUT", body: JSON.stringify({ orderedIds: next.map((i: any) => i.id) }) });
    } catch (err: any) { alert("Reorder failed: " + err.message); await loadGallery(editing.id); }
  }

  function buildSpecsArray(): any[] {
    if (specFields.length > 0) {
      return specFields.map(f => ({ f: f.fieldKey, l: f.fieldLabel, v: specValues[f.fieldKey] || "" })).filter(s => s.v);
    }
    return [];
  }

  async function saveProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body: any = {
      name: fd.get("name"), price: Number(fd.get("price")), category: fd.get("category"),
      inStock: fd.get("inStock") === "true", isNonStock: fd.get("isNonStock") === "on",
      specs: buildSpecsArray(),
      salePrice: fd.get("salePrice") ? Number(fd.get("salePrice")) : null,
    };
    try {
      if (creating) {
        const created = await api<any>("/api/products", { method: "POST", body: JSON.stringify(body) });
        await uploadGalleryImages(created.id);
      } else if (editing) {
        await api(`/api/products/${encodeURIComponent(editing.id)}`, { method: "PUT", body: JSON.stringify(body) });
        await uploadGalleryImages(editing.id);
      }
      setEditing(null); setCreating(false); refetch();
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  }

  async function deleteProduct(id: string) {
    if (!confirm("Delete this product?")) return;
    try { await api(`/api/products/${encodeURIComponent(id)}`, { method: "DELETE" }); refetch(); } catch { alert("Delete failed"); }
  }

  useEffect(() => { if (editing && !creating && editing.id) loadGallery(editing.id); else setGallery([]); }, [editing?.id, creating]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const products = pData?.products || [];

  if (creating || editing) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <RippleButton size="small" variant="ghost" onClick={() => { setEditing(null); setCreating(false); }}>&larr; Back</RippleButton>
          <h1 style={{ margin: 0 }}>{creating ? "New Product" : "Edit: " + escapeHtml(editing!.name)}</h1>
        </div>
        <div className="panel" style={{ maxWidth: 560 }}>
          <form onSubmit={saveProduct} className="auth-form">
            {!creating && editing?.imageUrl && (
              <div style={{ marginBottom: "0.75rem", textAlign: "center" }}>
                <img src={editing.imageUrl} alt="" style={{ maxWidth: 300, maxHeight: 180, borderRadius: 8, objectFit: "cover" }} />
              </div>
            )}
            {!creating && (
              <div style={{ marginBottom: "0.75rem", textAlign: "center" }}>
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                  <label style={{ fontSize: "0.85rem", cursor: "pointer" }}>Replace primary image<input type="file" accept="image/*" style={{ display: "block", margin: "0.25rem auto" }} onChange={(e) => { const f = e.target.files?.[0]; if (f && editing) uploadPrimaryImage(editing.id, f); }} /></label>
                  {editing?.imageUrl && <button type="button" onClick={async () => { if (!editing || !confirm("Remove primary image?")) return; try { await api(`/api/products/${encodeURIComponent(editing.id)}/image`, { method: "DELETE" }); refetch(); } catch (err: any) { alert("Failed: " + err.message); } }} style={{ fontSize: "0.8rem", color: "var(--danger)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Remove image</button>}
                </div>
              </div>
            )}
            <div className="field"><label>Name<input name="name" defaultValue={editing?.name} required /></label></div>
            <div className="field"><label>Price (KES)<input name="price" type="number" defaultValue={editing?.price} required /></label></div>
            <div className="field"><label>Sale Price (KES, optional)<input name="salePrice" type="number" min="0" step="0.01" defaultValue={editing?.salePrice || ""} placeholder="Leave empty for no sale" /></label></div>
            <div className="field">
              <label>Category
                <select
                  name="category"
                  value={selCategory || editing?.category || ""}
                  onChange={(e) => setSelCategory(e.target.value)}
                  required
                >
                  <option value="">-- Select --</option>
                  {categories.map((cat: any) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                </select>
              </label>
            </div>
            <div className="field"><label>In stock<select name="inStock" defaultValue={String(editing?.inStock ?? true)}><option value="true">Yes</option><option value="false">No</option></select></label></div>
            <div className="field"><label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}><input type="checkbox" name="isNonStock" defaultChecked={editing?.isNonStock ?? false} /> Non-stock item</label></div>
            <div className="field"><label>Add images (multiple)<input type="file" ref={galleryRef} accept="image/*" multiple /></label></div>
            {specFields.length > 0 ? (
              <div>
                <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Specifications</p>
                {specFields.map(f => (
                  <div className="field" key={f.fieldKey}>
                    <label>{f.fieldLabel}{f.required ? " *" : ""}
                      {f.fieldType === "select" ? (
                        <select value={specValues[f.fieldKey] || ""} onChange={(e) => setSpecValues({ ...specValues, [f.fieldKey]: e.target.value })} required={f.required}>
                          <option value="">-- Select --</option>
                          {(f.options || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : f.fieldType === "multiselect" ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", paddingTop: "0.25rem" }}>
                          {(f.options || []).map((o: string) => (
                            <label key={o} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.85rem", cursor: "pointer" }}>
                              <input type="checkbox" checked={(specValues[f.fieldKey] || "").split(",").includes(o)} onChange={(e) => {
                                const cur = (specValues[f.fieldKey] || "").split(",").filter(Boolean);
                                const next = e.target.checked ? [...cur, o] : cur.filter((x: string) => x !== o);
                                setSpecValues({ ...specValues, [f.fieldKey]: next.join(",") });
                              }} /> {o}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <input type={f.fieldType === "number" ? "number" : "text"} value={specValues[f.fieldKey] || ""} onChange={(e) => setSpecValues({ ...specValues, [f.fieldKey]: e.target.value })} required={f.required} />
                      )}
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="field"><label>Specs (one per line)<textarea name="specs" rows={4} defaultValue={(editing?.specs || []).map(s => typeof s === "string" ? s : `${s.f}: ${s.v}`).join("\n")} /></label></div>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}><RippleButton type="submit" loading={saving}>Save</RippleButton><RippleButton variant="secondary" onClick={() => { setEditing(null); setCreating(false); }}>Cancel</RippleButton></div>
          </form>
          {!creating && gallery.length > 0 && (
            <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
              <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Gallery ({gallery.length}) — drag to reorder</p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {gallery.map((img: any, idx: number) => (
                  <div
                    key={img.id}
                    draggable
                    onDragStart={() => onDragStart(idx)}
                    onDragOver={(e) => onDragOver(e, idx)}
                    onDragEnd={onDragEnd}
                    onDrop={() => onDrop(idx)}
                    style={{
                      position: "relative", textAlign: "center", cursor: "grab",
                      opacity: dragIdx === idx ? 0.4 : 1,
                      outline: dropIdx === idx ? "2px solid var(--accent)" : "none",
                      outlineOffset: 2,
                      borderRadius: 8,
                      transition: "opacity 0.15s",
                    }}
                  >
                    <img src={img.image_url} alt="" style={{ width: 80, height: 80, borderRadius: 6, objectFit: "cover", border: img.is_primary ? "2px solid var(--accent)" : "1px solid var(--border)" }} />
                    <div style={{ marginTop: 2 }}>
                      {!img.is_primary && <button type="button" onClick={() => setPrimary(editing!.id, img.id)} style={{ fontSize: "0.7rem", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Set primary</button>}
                    </div>
                    <button type="button" onClick={() => deleteGalleryImage(editing!.id, img.id)} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: "#dc2626", color: "#fff", fontSize: 12, lineHeight: "20px", textAlign: "center", cursor: "pointer" }}>&times;</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Products</h1>
        <RippleButton size="small" onClick={() => { setCreating(true); setEditing(empty); }}>+ Add</RippleButton>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Image</th><th>Name</th><th>Price</th><th>Category</th><th>Stock</th><th></th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: "cover" }} /> : <span style={{ opacity: 0.3 }}>{'\u200B'}</span>}</td>
                <td>{escapeHtml(p.name)}</td>
                <td>{p.salePrice ? <><span style={{ textDecoration: "line-through", color: "#999", fontSize: "0.85em" }}>{formatPrice(p.price)}</span> <span style={{ color: "#dc2626", fontWeight: 600 }}>{formatPrice(p.salePrice)}</span></> : formatPrice(p.price)}</td>
                <td>{p.category || "—"}</td>
                <td>{p.inStock ? <span style={{ color: "#16a34a" }}>In stock</span> : <span style={{ color: "#dc2626" }}>Out</span>}</td>
                <td style={{ display: "flex", gap: "0.35rem" }}>
                  <RippleButton size="small" onClick={() => { setCreating(false); setEditing(p); }}>Edit</RippleButton>
                  <RippleButton size="small" variant="danger" onClick={() => deleteProduct(p.id)}>Delete</RippleButton>
                </td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={6}><EmptyState icon="products" title="No products yet" description="Products will appear here once added." /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ===================== PROVIDERS =====================
function OwnerProviders() {
  const { data: pData, loading, error, refetch } = useFetch(() => api<{ providers: Provider[] }>("/api/admin/providers"), []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ companyName: "", contactName: "", email: "", password: "", phone: "", pin: "" });
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  async function addProvider(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await api("/api/admin/providers", { method: "POST", body: JSON.stringify(form) }); setShowForm(false); setForm({ companyName: "", contactName: "", email: "", password: "", phone: "", pin: "" }); refetch(); } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
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
          <form onSubmit={editing ? saveEdit : addProvider}>
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
                <td><strong>{escapeHtml(p.companyName)}</strong></td><td>{escapeHtml(p.contactName)}</td><td>{escapeHtml(p.email)}</td><td>{escapeHtml(p.phone || "—")}</td><td><span className="plan-status">{p.status}</span></td>
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
function OwnerStockSummary() {
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
function OwnerStockTake() {
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

// ===================== SHOP SUBSCRIPTION =====================
function OwnerShopSubscription() {
  const { data: subData, loading, error, refetch } = useFetch(() => api<{ plan: SubscriptionPlan }>("/api/shop/subscription"), []);
  const { data: plansData } = useFetch(() => api<{ plans: SubscriptionPlan[] }>("/api/plans"), []);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

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

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const currentPlan = subData?.plan;
  const allPlans = plansData?.plans || [];

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
      </div>

      <div className="panel" style={{ marginBottom: "1rem", maxWidth: 500 }}>
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

function OwnerAboutUs() {
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

  if (loading) return <Spinner />;

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

function OwnerStorefront({ staffRole }: { staffRole: string | null }) {
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
                      <td>{inv.status !== "paid" && <RippleButton size="small" onClick={() => markPaid(inv.id)}>Mark paid</RippleButton>}</td>
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
                        {inv.status !== "paid" && <RippleButton size="small" onClick={() => markOiPaid(inv.id)}>Mark paid</RippleButton>}
                        <RippleButton size="small" variant="ghost" style={{ marginLeft: "0.25rem" }} onClick={async () => { try { const r = await api<{ token: string }>("/api/admin/invoice-token/" + inv.orderId, { method: "POST" }); await downloadPdf(`/api/admin/orders/${inv.orderId}/invoice?token=${encodeURIComponent(r.token)}`, `invoice-${inv.orderId}.pdf`); } catch (e: any) { alert("Failed to download invoice: " + (e?.message || "Unknown error")); } }}>View</RippleButton>
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

function OwnerCreditNotes() {
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
                  <RippleButton size="small" variant="ghost" onClick={() => downloadPdf(`/api/admin/credit-notes/${note.id}/view`, `credit-note-${note.id}.pdf`).catch((e: any) => alert("Failed to download credit note: " + (e?.message || "Unknown error")))}>View</RippleButton>
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
