import React, { useEffect, useState } from "react";
import { api, getStaffToken } from "@/lib/api";
import { useRouter } from "next/router";
import Link from "next/link";
import { escapeHtml } from "@/lib/sanitize";

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);
}

function Spinner() { return <p style={{ textAlign: "center", padding: "2rem", opacity: 0.5 }}>Loading...</p>; }

export default function StockTakeSessionPage() {
  const router = useRouter();
  const { id } = router.query;
  const [authed, setAuthed] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [report, setReport] = useState<any>(null);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);

  useEffect(() => {
    if (getStaffToken()) setAuthed(true);
  }, []);

  useEffect(() => {
    if (authed && id) fetchSession();
  }, [authed, id]);

  async function fetchSession() {
    try {
      const data = await api<any>(`/api/stock-take/${id}`);
      setSession(data.session);
      setItems(data.items || []);
      const c: Record<string, number> = {};
      (data.items || []).forEach((item: any) => { if (item.countedQuantity !== null) c[item.productId] = item.countedQuantity; });
      setCounts(c);
    } catch (err: any) { setMsg("Error: " + err.message); }
  }

  async function loadProducts() {
    try {
      const d = await api<{ products: any[] }>("/api/products");
      setAllProducts(d.products || []);
    } catch {}
  }

  async function addProduct(productId: string) {
    if (items.some((i) => i.productId === productId)) { setProductSearch(""); setShowProductPicker(false); return; }
    setSaving(true);
    try {
      await api(`/api/stock-take/${id}/count`, { method: "POST", body: JSON.stringify({ productId, countedQuantity: 0 }) });
      await fetchSession();
      setProductSearch("");
      setShowProductPicker(false);
    } catch (err: any) { setMsg("Error: " + err.message); }
    finally { setSaving(false); }
  }

  async function saveCount(productId: string) {
    const qty = counts[productId];
    if (qty === undefined || qty < 0) return;
    setSaving(true);
    try {
      const data = await api<any>(`/api/stock-take/${id}/count`, { method: "POST", body: JSON.stringify({ productId, countedQuantity: qty }) });
      if (data.items) setItems(data.items);
    } catch (err: any) { setMsg("Error: " + err.message); }
    finally { setSaving(false); }
  }

  async function completeSession() {
    setSaving(true);
    try {
      const unsavedItems = items.filter((item: any) => {
        const localQty = counts[item.productId];
        return localQty !== undefined && localQty !== item.countedQuantity;
      });
      for (const item of unsavedItems) {
        await api(`/api/stock-take/${id}/count`, { method: "POST", body: JSON.stringify({ productId: item.productId, countedQuantity: counts[item.productId] }) });
      }
      const data = await api<any>(`/api/stock-take/${id}/complete`, { method: "POST" });
      setMsg("Stock take completed and stock levels adjusted!");
      if (data.report) setReport(data.report);
      if (data.session) setSession(data.session);
      await fetchSession();
    } catch (err: any) { setMsg("Error: " + err.message); }
    finally { setSaving(false); }
  }

  async function deleteSession() {
    if (!confirm("Delete this session? Only possible if no items have been counted.")) return;
    try {
      await api(`/api/stock-take/${id}`, { method: "DELETE" });
      router.push("/admin?view=stock-take");
    } catch (err: any) { setMsg("Error: " + err.message); }
  }

  const existingProductIds = new Set(items.map((i) => i.productId));
  const filteredProducts = productSearch ? allProducts.filter((p) =>
    !existingProductIds.has(p.id) && (p.name || "").toLowerCase().includes(productSearch.toLowerCase())
  ) : [];

  if (!authed) {
    return (
      <div className="auth-page" style={{ marginTop: "3rem" }}>
        <h1>Stock Take</h1>
        <p>Please <Link href="/admin">sign in</Link> as admin or owner.</p>
      </div>
    );
  }

  if (!session) return <Spinner />;

  return (
    <div className="dash-layout">
      <nav className="dash-nav" style={{ padding: "1rem" }}>
        <Link href="/admin?view=stock-take" style={{ display: "block", marginBottom: "1rem" }}>&larr; Back to Stock Take</Link>
        <p style={{ fontSize: "0.85rem", opacity: 0.6 }}>Session #{session.id}</p>
        <p style={{ fontSize: "0.85rem", opacity: 0.6 }}>Status: {session.status}</p>
        <p style={{ fontSize: "0.85rem", opacity: 0.6 }}>Created: {new Date(session.createdAt || session.created_at).toLocaleDateString("en-GB")}</p>
      </nav>
      <div className="dash-content" style={{ maxWidth: 900 }}>
        {msg && <div className="panel" style={{ marginBottom: "1rem", background: msg.startsWith("Error") ? "var(--danger-light)" : "var(--success-light)", color: msg.startsWith("Error") ? "var(--danger-text)" : "var(--success-text)" }}>{msg}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h1 style={{ margin: 0 }}>Stock Take #{session.id}</h1>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {session.status === "in_progress" && (
              <>
                <button className="button button-small" onClick={completeSession} disabled={saving}>Complete & Apply</button>
                <button className="button button-small button-ghost" style={{ color: "var(--danger)" }} onClick={deleteSession}>Delete</button>
              </>
            )}
          </div>
        </div>

        <div className="stat-grid" style={{ marginBottom: "1rem" }}>
          <div className="stat-card">
            <div className="stat-card__value">{items.length}</div>
            <div className="stat-card__label">Total Items</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{items.filter((i: any) => i.countedQuantity !== null && i.countedQuantity > 0).length}</div>
            <div className="stat-card__label">Counted</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{items.filter((i: any) => i.countedQuantity !== null && i.variance !== 0).length}</div>
            <div className="stat-card__label">With Variance</div>
          </div>
        </div>

        {session.status === "in_progress" && (
          <div className="panel" style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
              <div className="field" style={{ margin: 0, flex: 1, position: "relative" }}>
                <label>Add Product to Count</label>
                <input
                  value={productSearch}
                  onChange={(e) => { setProductSearch(e.target.value); setShowProductPicker(true); }}
                  onFocus={() => { setShowProductPicker(true); loadProducts(); }}
                  placeholder="Search products..."
                />
                {showProductPicker && filteredProducts.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, zIndex: 20, maxHeight: 250, overflowY: "auto" }}>
                    {filteredProducts.slice(0, 20).map((p) => (
                      <div key={p.id} onClick={() => addProduct(p.id)} style={{ padding: "0.5rem 0.75rem", cursor: "pointer", borderBottom: "1px solid var(--border)", fontSize: "0.85rem" }}>
                        {escapeHtml(p.name)} — {formatPrice(p.price)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th style={{ width: 80, textAlign: "right" }}>System Qty</th>
                <th style={{ width: 100, textAlign: "right" }}>Counted</th>
                <th style={{ width: 80, textAlign: "right" }}>Variance</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.productId}>
                  <td>{escapeHtml(item.productName)}</td>
                  <td style={{ textAlign: "right" }}>{item.systemQuantity}</td>
                  <td style={{ textAlign: "right" }}>
                    <input
                      type="number"
                      style={{ width: 80, textAlign: "right" }}
                      value={counts[item.productId] ?? ""}
                      onChange={(e) => setCounts({ ...counts, [item.productId]: Number(e.target.value) })}
                      onBlur={() => saveCount(item.productId)}
                      disabled={session.status === "completed"}
                    />
                  </td>
                  <td style={{ textAlign: "right", color: item.countedQuantity !== null ? (item.variance > 0 ? "var(--success)" : item.variance < 0 ? "var(--danger)" : "inherit") : "inherit" }}>
                    {item.countedQuantity !== null && item.countedQuantity > 0 ? (item.variance > 0 ? "+" : "") + item.variance : "\u2014"}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                  No products added yet. Use the search above to add products to count.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {report && (
          <div className="panel" style={{ marginTop: "1.5rem" }}>
            <h3 style={{ marginTop: 0 }}>Completion Report</h3>
            <div className="stat-grid" style={{ marginBottom: "1rem" }}>
              <div className="stat-card">
                <div className="stat-card__value">{report.totalItems}</div>
                <div className="stat-card__label">Total Items</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__value">{report.counted}</div>
                <div className="stat-card__label">Counted</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__value">{report.withVariance}</div>
                <div className="stat-card__label">With Variance</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__value">{report.totalVariance}</div>
                <div className="stat-card__label">Total Absolute Variance</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__value">{report.adjusted || 0}</div>
                <div className="stat-card__label">Items Adjusted</div>
              </div>
            </div>
            {report.items && report.items.filter((i: any) => i.variance !== 0).length > 0 && (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: "right" }}>System</th>
                      <th style={{ textAlign: "right" }}>Counted</th>
                      <th style={{ textAlign: "right" }}>Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.items.filter((i: any) => i.variance !== 0).map((i: any) => (
                      <tr key={i.productId}>
                        <td>{escapeHtml(i.productName)}</td>
                        <td style={{ textAlign: "right" }}>{i.systemQuantity}</td>
                        <td style={{ textAlign: "right" }}>{i.countedQuantity}</td>
                        <td style={{ textAlign: "right", color: i.variance > 0 ? "var(--success)" : "var(--danger)" }}>
                          {i.variance > 0 ? "+" : ""}{i.variance}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
