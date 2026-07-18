import React, { useEffect, useState, useRef } from "react";
import { api, getRole, getTokenForRole } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useApp } from "@/lib/app-context";

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);
}
function escapeHtml(v: string) { const d = document.createElement("div"); d.textContent = v; return d.innerHTML; }

interface QuoteItem {
  id: number;
  quoteId: number;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discountType: string;
  discountValue: number;
}

interface Quote {
  id: number;
  customerId: number;
  customerName: string;
  customerPhone: string;
  quoteNumber: string;
  status: string;
  notes: string;
  total: number;
  discountType: string;
  discountValue: number;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "#f59e0b", bg: "#fef3c7" },
  waiting_for_approval: { label: "Waiting for Approval", color: "#3b82f6", bg: "#dbeafe" },
  cancelled: { label: "Cancelled", color: "#ef4444", bg: "#fee2e2" },
  approved: { label: "Approved", color: "#10b981", bg: "#d1fae5" },
};

export default function QuotesPage() {
  const { isDark } = useApp();
  const role = getRole();
  const isStaff = role === "staff" || role === "provider";

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [stats, setStats] = useState({ pending: 0, waiting_for_approval: 0, cancelled: 0, approved: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [viewQuote, setViewQuote] = useState<Quote | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  async function loadQuotes() {
    setLoading(true);
    try {
      if (isStaff) {
        const d = await api<{ quotes: Quote[]; stats: typeof stats }>("/api/admin/quotes");
        setQuotes(d.quotes || []);
        setStats(d.stats || { pending: 0, waiting_for_approval: 0, cancelled: 0, approved: 0, total: 0 });
      } else {
        const d = await api<{ quotes: Quote[] }>("/api/quotes");
        setQuotes(d.quotes || []);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { loadQuotes(); }, []);

  const filtered = filter ? quotes.filter((q) => q.status === filter) : quotes;

  async function approveQuote(q: Quote) {
    if (!confirm(`Approve quote ${q.quoteNumber}? This will create an order/invoice.`)) return;
    setActionLoading(true);
    try {
      const d = await api<{ order: any; invoiceNumber: string }>(`/api/admin/quotes/${q.id}/approve`, { method: "POST" });
      alert(`Quote approved! Order created with invoice: ${d.invoiceNumber}`);
      setViewQuote(null);
      loadQuotes();
    } catch (e: any) { alert(e.message || "Failed to approve."); }
    setActionLoading(false);
  }

  async function cancelQuote(q: Quote) {
    if (!confirm(`Cancel quote ${q.quoteNumber}?`)) return;
    setActionLoading(true);
    try {
      await api(`/api/admin/quotes/${q.id}/cancel`, { method: "POST" });
      setViewQuote(null);
      loadQuotes();
    } catch (e: any) { alert(e.message || "Failed to cancel."); }
    setActionLoading(false);
  }

  async function deleteQuote(q: Quote) {
    if (!confirm(`Delete quote ${q.quoteNumber}? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      await api(`/api/admin/quotes/${q.id}`, { method: "DELETE" });
      setViewQuote(null);
      loadQuotes();
    } catch (e: any) { alert(e.message || "Failed to delete."); }
    setActionLoading(false);
  }

  if (creating) return <QuoteCreator onBack={() => setCreating(false)} onCreated={() => { setCreating(false); loadQuotes(); }} />;

  if (viewQuote) return <QuoteDetail quote={viewQuote} onBack={() => setViewQuote(null)} onRefresh={() => { setViewQuote(null); loadQuotes(); }} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Quotes</h1>
        {isStaff && <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Create New Quote</button>}
      </div>

      {isStaff && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {(["pending", "waiting_for_approval", "cancelled", "approved"] as const).map((s) => {
            const cfg = STATUS_CONFIG[s];
            return (
              <button key={s} onClick={() => setFilter(filter === s ? "" : s)}
                style={{ padding: "1rem", borderRadius: 10, border: filter === s ? `2px solid ${cfg.color}` : "2px solid var(--border)", background: filter === s ? cfg.bg : "var(--surface)", color: "var(--text)", cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: cfg.color }}>{stats[s] || 0}</div>
                <div style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>{cfg.label}</div>
              </button>
            );
          })}
          <button onClick={() => setFilter(filter === "" ? "__none__" : "")}
            style={{ padding: "1rem", borderRadius: 10, border: "2px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.total || quotes.length}</div>
            <div style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>All Quotes</div>
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem" }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
          <p>No quotes found.</p>
          {isStaff && <button className="btn btn-primary" onClick={() => setCreating(true)}>Create your first quote</button>}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => {
                const cfg = STATUS_CONFIG[q.status] || STATUS_CONFIG.pending;
                return (
                  <tr key={q.id} style={{ cursor: "pointer" }} onClick={() => setViewQuote(q)}>
                    <td style={{ fontWeight: 600 }}>{escapeHtml(q.quoteNumber)}</td>
                    <td>{escapeHtml(q.customerName || "—")}</td>
                    <td>{q.items.length}</td>
                    <td style={{ fontWeight: 600 }}>{formatPrice(q.total)}</td>
                    <td>
                      <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, color: cfg.color, background: cfg.bg }}>
                        {cfg.label}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      {q.createdAt ? new Date(q.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); setViewQuote(q); }}>View</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QuoteDetail({ quote: initialQuote, onBack, onRefresh }: { quote: Quote; onBack: () => void; onRefresh: () => void }) {
  const [quote, setQuote] = useState<Quote>(initialQuote);
  const [actionLoading, setActionLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [editItems, setEditItems] = useState<{ productId: string; productName: string; quantity: number; unitPrice: number; discountType: string; discountValue: number }[]>([]);
  const [editDiscountType, setEditDiscountType] = useState(quote.discountType || "");
  const [editDiscountValue, setEditDiscountValue] = useState(quote.discountValue || 0);
  const [editNotes, setEditNotes] = useState(quote.notes || "");
  const cfg = STATUS_CONFIG[quote.status] || STATUS_CONFIG.pending;
  const isPending = quote.status === "pending";

  async function startEditing() {
    setEditItems(quote.items.map((i) => ({ productId: i.productId, productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice, discountType: i.discountType, discountValue: i.discountValue })));
    setEditDiscountType(quote.discountType || "");
    setEditDiscountValue(quote.discountValue || 0);
    setEditNotes(quote.notes || "");
    try {
      const d = await api<{ products: Product[] }>("/api/products");
      setProducts(d.products || []);
    } catch {}
    setEditing(true);
  }

  function toggleEditProduct(product: Product) {
    setEditItems((prev) => {
      const exists = prev.find((i) => i.productId === product.id);
      if (exists) return prev.filter((i) => i.productId !== product.id);
      return [...prev, { productId: product.id, productName: product.name, quantity: 1, unitPrice: product.salePrice && product.salePrice > 0 ? product.salePrice : product.price, discountType: "", discountValue: 0 }];
    });
  }

  function updateEditItemQty(productId: string, qty: number) {
    if (qty <= 0) { setEditItems((prev) => prev.filter((i) => i.productId !== productId)); return; }
    setEditItems((prev) => prev.map((i) => i.productId === productId ? { ...i, quantity: qty } : i));
  }

  function updateEditItemDiscount(productId: string, dt: string, dv: number) {
    setEditItems((prev) => prev.map((i) => i.productId === productId ? { ...i, discountType: dt, discountValue: dv } : i));
  }

  function calcEditItemTotal(item: { unitPrice: number; quantity: number; discountType: string; discountValue: number }) {
    let total = item.unitPrice * item.quantity;
    if (item.discountType === "percentage" && item.discountValue) total -= total * (item.discountValue / 100);
    else if (item.discountType === "amount" && item.discountValue) total -= item.discountValue;
    return total < 0 ? 0 : total;
  }

  async function saveEdits() {
    if (editItems.length === 0) { alert("Quote must have at least one item."); return; }
    setActionLoading(true);
    try {
      const d = await api<{ quote: Quote }>(`/api/admin/quotes/${quote.id}`, {
        method: "PUT",
        body: JSON.stringify({ items: editItems, discountType: editDiscountType, discountValue: editDiscountValue, notes: editNotes }),
      });
      setQuote(d.quote);
      setEditing(false);
    } catch (e: any) { alert(e.message || "Failed to save."); }
    setActionLoading(false);
  }

  async function approve() {
    if (!confirm(`Approve quote ${quote.quoteNumber}? This will create an order/invoice.`)) return;
    setActionLoading(true);
    try {
      const d = await api<{ order: any; invoiceNumber: string }>(`/api/admin/quotes/${quote.id}/approve`, { method: "POST" });
      alert(`Quote approved! Invoice: ${d.invoiceNumber}`);
      onRefresh();
    } catch (e: any) { alert(e.message || "Failed."); }
    setActionLoading(false);
  }

  async function cancel() {
    if (!confirm(`Cancel quote ${quote.quoteNumber}?`)) return;
    setActionLoading(true);
    try {
      await api(`/api/admin/quotes/${quote.id}/cancel`, { method: "POST" });
      onRefresh();
    } catch (e: any) { alert(e.message || "Failed."); }
    setActionLoading(false);
  }

  async function del() {
    if (!confirm(`Delete ${quote.quoteNumber}? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      await api(`/api/admin/quotes/${quote.id}`, { method: "DELETE" });
      onRefresh();
    } catch (e: any) { alert(e.message || "Failed."); }
    setActionLoading(false);
  }

  function openPdf() {
    window.open(`/api/admin/quotes/${quote.id}/pdf?token=${encodeURIComponent(getTokenForRole() || "")}`, "_blank");
  }

  const editSubtotal = editItems.reduce((s, i) => s + calcEditItemTotal(i), 0);
  let editGrandTotal = editSubtotal;
  if (editDiscountType === "percentage" && editDiscountValue) editGrandTotal -= editGrandTotal * (editDiscountValue / 100);
  else if (editDiscountType === "amount" && editDiscountValue) editGrandTotal -= editDiscountValue;
  if (editGrandTotal < 0) editGrandTotal = 0;

  if (editing) {
    const editFiltered = productSearch ? products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.id.toLowerCase().includes(productSearch.toLowerCase())) : products;
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>&larr; Cancel Edit</button>
          <h1 style={{ margin: 0 }}>Edit: {escapeHtml(quote.quoteNumber)}</h1>
        </div>
        <div className="panel" style={{ padding: "1rem", marginBottom: "1rem" }}>
          <input className="input" placeholder="Search products to add..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="panel" style={{ padding: "1rem", maxHeight: 450, overflowY: "auto" }}>
            <h3 style={{ marginTop: 0 }}>Products ({editFiltered.length})</h3>
            {editFiltered.map((p) => {
              const selected = editItems.some((i) => i.productId === p.id);
              return (
                <button key={p.id} onClick={() => toggleEditProduct(p)}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", textAlign: "left", padding: "0.5rem", marginBottom: "0.25rem", border: selected ? "2px solid var(--primary)" : "1px solid var(--border)", borderRadius: 8, background: selected ? "var(--primary-subtle)" : "var(--bg)", cursor: "pointer", color: "var(--text)" }}>
                  {p.imageUrl && <img src={p.imageUrl} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: "cover" }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{escapeHtml(p.name)}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--primary)" }}>{formatPrice(p.salePrice && p.salePrice > 0 ? p.salePrice : p.price)}</div>
                  </div>
                  {selected && <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>}
                </button>
              );
            })}
          </div>
          <div className="panel" style={{ padding: "1rem", maxHeight: 450, overflowY: "auto" }}>
            <h3 style={{ marginTop: 0 }}>Selected Items ({editItems.length})</h3>
            {editItems.length === 0 && <p style={{ color: "var(--text-secondary)" }}>Click products on the left to add them.</p>}
            {editItems.map((item) => (
              <div key={item.productId} style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{escapeHtml(item.productName)}</span>
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditItems((prev) => prev.filter((i) => i.productId !== item.productId))}>&times;</button>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.25rem", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <span style={{ fontSize: "0.8rem" }}>Qty:</span>
                    <input type="number" className="input" value={item.quantity} onChange={(e) => updateEditItemQty(item.productId, Number(e.target.value))} min={1} style={{ width: 60, padding: "0.2rem 0.4rem", fontSize: "0.8rem" }} />
                  </div>
                  <div style={{ fontSize: "0.8rem" }}>@ {formatPrice(item.unitPrice)}</div>
                </div>
                <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.25rem", alignItems: "center" }}>
                  <button className="btn btn-sm" style={{ fontSize: "0.7rem", padding: "2px 6px", background: item.discountType === "percentage" ? "var(--primary)" : "var(--bg)", color: item.discountType === "percentage" ? "#fff" : "var(--text)", border: "1px solid var(--border)" }}
                    onClick={() => updateEditItemDiscount(item.productId, item.discountType === "percentage" ? "" : "percentage", item.discountType === "percentage" ? 0 : 0)}>
                    % Discount
                  </button>
                  <button className="btn btn-sm" style={{ fontSize: "0.7rem", padding: "2px 6px", background: item.discountType === "amount" ? "var(--primary)" : "var(--bg)", color: item.discountType === "amount" ? "#fff" : "var(--text)", border: "1px solid var(--border)" }}
                    onClick={() => updateEditItemDiscount(item.productId, item.discountType === "amount" ? "" : "amount", item.discountType === "amount" ? 0 : 0)}>
                    KES Discount
                  </button>
                  {item.discountType && (
                    <input type="number" className="input" value={item.discountValue || ""} onChange={(e) => updateEditItemDiscount(item.productId, item.discountType, Number(e.target.value))} min={0} placeholder="0" style={{ width: 70, padding: "2px 4px", fontSize: "0.75rem" }} />
                  )}
                </div>
                <div style={{ textAlign: "right", fontWeight: 600, fontSize: "0.85rem", marginTop: "0.25rem" }}>{formatPrice(calcEditItemTotal(item))}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel" style={{ padding: "1rem", marginTop: "1rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Quote Discount:</span>
            <button className="btn btn-sm" style={{ background: editDiscountType === "percentage" ? "var(--primary)" : "var(--bg)", color: editDiscountType === "percentage" ? "#fff" : "var(--text)", border: "1px solid var(--border)" }}
              onClick={() => setEditDiscountType(editDiscountType === "percentage" ? "" : "percentage")}>Percentage</button>
            <button className="btn btn-sm" style={{ background: editDiscountType === "amount" ? "var(--primary)" : "var(--bg)", color: editDiscountType === "amount" ? "#fff" : "var(--text)", border: "1px solid var(--border)" }}
              onClick={() => setEditDiscountType(editDiscountType === "amount" ? "" : "amount")}>Amount</button>
            {editDiscountType && (
              <input type="number" className="input" value={editDiscountValue || ""} onChange={(e) => setEditDiscountValue(Number(e.target.value))} min={0} placeholder="0" style={{ width: 100, padding: "0.3rem", fontSize: "0.85rem" }} />
            )}
          </div>
          <div className="field" style={{ marginTop: "0.75rem" }}>
            <label style={{ fontSize: "0.85rem" }}>Notes</label>
            <textarea className="input" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
          </div>
          <div style={{ textAlign: "right", marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "2px solid var(--border)" }}>
            {editDiscountType && editDiscountValue > 0 && (
              <div style={{ fontSize: "0.9rem", color: "#10b981", marginBottom: "0.25rem" }}>
                Discount: {editDiscountType === "percentage" ? `${editDiscountValue}%` : formatPrice(editDiscountValue)}
              </div>
            )}
            <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>Grand Total: {formatPrice(editGrandTotal)}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button className="btn btn-ghost" onClick={() => setEditing(false)} disabled={actionLoading}>Cancel</button>
          <button className="btn btn-primary" onClick={saveEdits} disabled={actionLoading || editItems.length === 0}>
            {actionLoading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <button className="btn btn-sm btn-ghost" onClick={onBack}>&larr; Back</button>
        <h1 style={{ margin: 0 }}>{escapeHtml(quote.quoteNumber)}</h1>
        <span style={{ display: "inline-block", padding: "3px 12px", borderRadius: 999, fontSize: "0.8rem", fontWeight: 600, color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="panel" style={{ padding: "1rem" }}>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Customer</h3>
          <div style={{ fontWeight: 600 }}>{escapeHtml(quote.customerName || "—")}</div>
          {quote.customerPhone && <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{escapeHtml(quote.customerPhone)}</div>}
        </div>
        <div className="panel" style={{ padding: "1rem" }}>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Details</h3>
          <div style={{ fontSize: "0.85rem" }}>Created: {quote.createdAt ? new Date(quote.createdAt).toLocaleString("en-GB") : "—"}</div>
          <div style={{ fontSize: "0.85rem" }}>Updated: {quote.updatedAt ? new Date(quote.updatedAt).toLocaleString("en-GB") : "—"}</div>
          {quote.notes && <div style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>Notes: {escapeHtml(quote.notes)}</div>}
        </div>
      </div>

      <div className="panel" style={{ padding: "1rem", marginBottom: "1.5rem", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "0.5rem", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>Item</th>
              <th style={{ textAlign: "center", padding: "0.5rem", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>Qty</th>
              <th style={{ textAlign: "right", padding: "0.5rem", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>Unit Price</th>
              <th style={{ textAlign: "center", padding: "0.5rem", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>Discount</th>
              <th style={{ textAlign: "right", padding: "0.5rem", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item) => {
              const hasDiscount = item.discountType && item.discountValue > 0;
              return (
                <tr key={item.id}>
                  <td style={{ padding: "0.5rem", borderBottom: "1px solid var(--border)" }}>{escapeHtml(item.productName)}</td>
                  <td style={{ padding: "0.5rem", textAlign: "center", borderBottom: "1px solid var(--border)" }}>{item.quantity}</td>
                  <td style={{ padding: "0.5rem", textAlign: "right", borderBottom: "1px solid var(--border)" }}>{formatPrice(item.unitPrice)}</td>
                  <td style={{ padding: "0.5rem", textAlign: "center", borderBottom: "1px solid var(--border)", color: hasDiscount ? "#10b981" : "var(--text-secondary)" }}>
                    {hasDiscount ? (item.discountType === "percentage" ? `${item.discountValue}%` : formatPrice(item.discountValue)) : "—"}
                  </td>
                  <td style={{ padding: "0.5rem", textAlign: "right", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>{formatPrice(item.lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ textAlign: "right", padding: "1rem 0 0", borderTop: "2px solid var(--border)", marginTop: "0.5rem" }}>
          {quote.discountType && quote.discountValue > 0 && (
            <div style={{ fontSize: "0.9rem", marginBottom: "0.25rem", color: "#10b981" }}>
              Quote Discount: {quote.discountType === "percentage" ? `${quote.discountValue}%` : formatPrice(quote.discountValue)}
            </div>
          )}
          <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>Total: {formatPrice(quote.total)}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={openPdf} disabled={actionLoading}>Download PDF</button>
        {isPending && (
          <button className="btn" style={{ background: "#8b5cf6", color: "#fff" }} onClick={startEditing} disabled={actionLoading}>Edit Items</button>
        )}
        {(quote.status === "pending" || quote.status === "waiting_for_approval") && (
          <>
            <button className="btn" style={{ background: "#10b981", color: "#fff" }} onClick={approve} disabled={actionLoading}>Approve &amp; Convert to Invoice</button>
            <button className="btn" style={{ background: "#f59e0b", color: "#fff" }} onClick={cancel} disabled={actionLoading}>Cancel Quote</button>
          </>
        )}
        <button className="btn btn-danger" onClick={del} disabled={actionLoading}>Delete</button>
      </div>
    </div>
  );
}

function QuoteCreator({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<{ productId: string; productName: string; quantity: number; unitPrice: number; discountType: string; discountValue: number }[]>([]);
  const [quoteDiscountType, setQuoteDiscountType] = useState("");
  const [quoteDiscountValue, setQuoteDiscountValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api<{ products: Product[] }>("/api/products").then((d) => setProducts(d.products || [])).catch(() => {});
  }, []);

  const filteredProducts = search
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    : products;

  function toggleProduct(product: Product) {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.productId === product.id);
      if (exists) return prev.filter((i) => i.productId !== product.id);
      return [...prev, { productId: product.id, productName: product.name, quantity: 1, unitPrice: product.price, discountType: "", discountValue: 0 }];
    });
  }

  function updateItemQty(productId: string, qty: number) {
    if (qty <= 0) { setSelectedItems((prev) => prev.filter((i) => i.productId !== productId)); return; }
    setSelectedItems((prev) => prev.map((i) => i.productId === productId ? { ...i, quantity: qty } : i));
  }

  function updateItemDiscount(productId: string, dt: string, dv: number) {
    setSelectedItems((prev) => prev.map((i) => i.productId === productId ? { ...i, discountType: dt, discountValue: dv } : i));
  }

  function calcItemTotal(item: { unitPrice: number; quantity: number; discountType: string; discountValue: number }) {
    let total = item.unitPrice * item.quantity;
    if (item.discountType === "percentage" && item.discountValue) total -= total * (item.discountValue / 100);
    else if (item.discountType === "amount" && item.discountValue) total -= item.discountValue;
    return total < 0 ? 0 : total;
  }

  const subtotal = selectedItems.reduce((s, i) => s + calcItemTotal(i), 0);
  let grandTotal = subtotal;
  if (quoteDiscountType === "percentage" && quoteDiscountValue) grandTotal -= grandTotal * (quoteDiscountValue / 100);
  else if (quoteDiscountType === "amount" && quoteDiscountValue) grandTotal -= quoteDiscountValue;
  if (grandTotal < 0) grandTotal = 0;

  async function submit() {
    if (!customerName.trim()) { alert("Customer name is required."); return; }
    if (selectedItems.length === 0) { alert("Add at least one product."); return; }
    setSaving(true);
    try {
      await api("/api/admin/quotes", {
        method: "POST",
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          notes,
          items: selectedItems.map((i) => ({ productId: i.productId, productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice, discountType: i.discountType, discountValue: i.discountValue })),
          discountType: quoteDiscountType,
          discountValue: quoteDiscountValue,
        }),
      });
      onCreated();
    } catch (e: any) { alert(e.message || "Failed to create quote."); }
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
        <button className="btn btn-sm btn-ghost" onClick={onBack}>&larr; Back</button>
        <h1 style={{ margin: 0 }}>Create New Quote</h1>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {(["Client Details", "Add Products", "Review & Generate"] as const).map((label, idx) => (
          <div key={idx} style={{ flex: 1, textAlign: "center", padding: "0.5rem", borderRadius: 8, background: step === idx + 1 ? "var(--primary)" : step > idx + 1 ? "#10b981" : "var(--surface)", color: step === idx + 1 ? "#fff" : step > idx + 1 ? "#fff" : "var(--text-secondary)", fontWeight: 600, fontSize: "0.85rem" }}>
            {step > idx + 1 ? "✓ " : ""}{label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="panel" style={{ padding: "1.5rem", maxWidth: 500 }}>
          <h3 style={{ marginTop: 0 }}>Client Details</h3>
          <div className="field">
            <label>Customer Name *</label>
            <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. John Kamau" required />
          </div>
          <div className="field">
            <label>Phone Number</label>
            <input className="input" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="e.g. 0712 345 678" />
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={3} />
          </div>
          <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!customerName.trim()}>Next: Add Products &rarr;</button>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="panel" style={{ padding: "1rem", marginBottom: "1rem" }}>
            <input className="input" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="panel" style={{ padding: "1rem", maxHeight: 500, overflowY: "auto" }}>
              <h3 style={{ marginTop: 0 }}>All Products ({filteredProducts.length})</h3>
              {filteredProducts.map((p) => {
                const selected = selectedItems.some((i) => i.productId === p.id);
                return (
                  <button key={p.id} onClick={() => toggleProduct(p)}
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", textAlign: "left", padding: "0.5rem", marginBottom: "0.25rem", border: selected ? "2px solid var(--primary)" : "1px solid var(--border)", borderRadius: 8, background: selected ? "var(--primary-subtle)" : "var(--bg)", cursor: "pointer", color: "var(--text)" }}>
                    {p.imageUrl && <img src={p.imageUrl} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: "cover" }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{escapeHtml(p.name)}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--primary)" }}>{formatPrice(p.price)}</div>
                    </div>
                    {selected && <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>}
                  </button>
                );
              })}
            </div>
            <div className="panel" style={{ padding: "1rem", maxHeight: 500, overflowY: "auto" }}>
              <h3 style={{ marginTop: 0 }}>Selected Items ({selectedItems.length})</h3>
              {selectedItems.length === 0 && <p style={{ color: "var(--text-secondary)" }}>Click products on the left to add them.</p>}
              {selectedItems.map((item) => (
                <div key={item.productId} style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{escapeHtml(item.productName)}</span>
                    <button className="btn btn-sm btn-ghost" onClick={() => setSelectedItems((prev) => prev.filter((i) => i.productId !== item.productId))}>&times;</button>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.25rem", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <span style={{ fontSize: "0.8rem" }}>Qty:</span>
                      <input type="number" className="input" value={item.quantity} onChange={(e) => updateItemQty(item.productId, Number(e.target.value))} min={1} style={{ width: 60, padding: "0.2rem 0.4rem", fontSize: "0.8rem" }} />
                    </div>
                    <div style={{ fontSize: "0.8rem" }}>@ {formatPrice(item.unitPrice)}</div>
                  </div>
                  <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.25rem", alignItems: "center" }}>
                    <button className="btn btn-sm" style={{ fontSize: "0.7rem", padding: "2px 6px", background: item.discountType === "percentage" ? "var(--primary)" : "var(--bg)", color: item.discountType === "percentage" ? "#fff" : "var(--text)", border: "1px solid var(--border)" }}
                      onClick={() => updateItemDiscount(item.productId, item.discountType === "percentage" ? "" : "percentage", item.discountType === "percentage" ? 0 : 0)}>
                      % Discount
                    </button>
                    <button className="btn btn-sm" style={{ fontSize: "0.7rem", padding: "2px 6px", background: item.discountType === "amount" ? "var(--primary)" : "var(--bg)", color: item.discountType === "amount" ? "#fff" : "var(--text)", border: "1px solid var(--border)" }}
                      onClick={() => updateItemDiscount(item.productId, item.discountType === "amount" ? "" : "amount", item.discountType === "amount" ? 0 : 0)}>
                      $ Discount
                    </button>
                    {item.discountType && (
                      <input type="number" className="input" value={item.discountValue || ""} onChange={(e) => updateItemDiscount(item.productId, item.discountType, Number(e.target.value))} min={0} placeholder="0" style={{ width: 70, padding: "2px 4px", fontSize: "0.75rem" }} />
                    )}
                  </div>
                  <div style={{ textAlign: "right", fontWeight: 600, fontSize: "0.85rem", marginTop: "0.25rem" }}>{formatPrice(calcItemTotal(item))}</div>
                </div>
              ))}
              {selectedItems.length > 0 && (
                <div style={{ marginTop: "1rem", textAlign: "right", fontWeight: 700, fontSize: "1.1rem" }}>
                  Subtotal: {formatPrice(subtotal)}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>&larr; Back</button>
            <button className="btn btn-primary" onClick={() => setStep(3)} disabled={selectedItems.length === 0}>Next: Review &rarr;</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="panel" style={{ padding: "1.5rem", marginBottom: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Customer</div>
                <div style={{ fontWeight: 600 }}>{escapeHtml(customerName)}</div>
                {customerPhone && <div style={{ fontSize: "0.85rem" }}>{escapeHtml(customerPhone)}</div>}
              </div>
              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Items</div>
                <div>{selectedItems.length} products</div>
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.4rem", borderBottom: "1px solid var(--border)", fontSize: "0.75rem" }}>Item</th>
                  <th style={{ textAlign: "center", padding: "0.4rem", borderBottom: "1px solid var(--border)", fontSize: "0.75rem" }}>Qty</th>
                  <th style={{ textAlign: "right", padding: "0.4rem", borderBottom: "1px solid var(--border)", fontSize: "0.75rem" }}>Price</th>
                  <th style={{ textAlign: "center", padding: "0.4rem", borderBottom: "1px solid var(--border)", fontSize: "0.75rem" }}>Discount</th>
                  <th style={{ textAlign: "right", padding: "0.4rem", borderBottom: "1px solid var(--border)", fontSize: "0.75rem" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedItems.map((item) => {
                  const hasDisc = item.discountType && item.discountValue > 0;
                  return (
                    <tr key={item.productId}>
                      <td style={{ padding: "0.4rem", borderBottom: "1px solid var(--border)" }}>{escapeHtml(item.productName)}</td>
                      <td style={{ padding: "0.4rem", textAlign: "center", borderBottom: "1px solid var(--border)" }}>{item.quantity}</td>
                      <td style={{ padding: "0.4rem", textAlign: "right", borderBottom: "1px solid var(--border)" }}>{formatPrice(item.unitPrice)}</td>
                      <td style={{ padding: "0.4rem", textAlign: "center", borderBottom: "1px solid var(--border)", color: hasDisc ? "#10b981" : "var(--text-secondary)" }}>
                        {hasDisc ? (item.discountType === "percentage" ? `${item.discountValue}%` : formatPrice(item.discountValue)) : "—"}
                      </td>
                      <td style={{ padding: "0.4rem", textAlign: "right", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>{formatPrice(calcItemTotal(item))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ marginTop: "1rem" }}>
              <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>Quote Discount</h4>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button className="btn btn-sm" style={{ background: quoteDiscountType === "percentage" ? "var(--primary)" : "var(--bg)", color: quoteDiscountType === "percentage" ? "#fff" : "var(--text)", border: "1px solid var(--border)" }}
                  onClick={() => setQuoteDiscountType(quoteDiscountType === "percentage" ? "" : "percentage")}>Percentage</button>
                <button className="btn btn-sm" style={{ background: quoteDiscountType === "amount" ? "var(--primary)" : "var(--bg)", color: quoteDiscountType === "amount" ? "#fff" : "var(--text)", border: "1px solid var(--border)" }}
                  onClick={() => setQuoteDiscountType(quoteDiscountType === "amount" ? "" : "amount")}>Amount</button>
                {quoteDiscountType && (
                  <input type="number" className="input" value={quoteDiscountValue || ""} onChange={(e) => setQuoteDiscountValue(Number(e.target.value))} min={0} placeholder="0" style={{ width: 100, padding: "0.3rem", fontSize: "0.85rem" }} />
                )}
              </div>
            </div>

            <div style={{ textAlign: "right", marginTop: "1rem", paddingTop: "0.75rem", borderTop: "2px solid var(--border)" }}>
              {quoteDiscountType && quoteDiscountValue > 0 && (
                <div style={{ fontSize: "0.9rem", color: "#10b981", marginBottom: "0.25rem" }}>
                  Discount: {quoteDiscountType === "percentage" ? `${quoteDiscountValue}%` : formatPrice(quoteDiscountValue)}
                </div>
              )}
              <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>Grand Total: {formatPrice(grandTotal)}</div>
            </div>

            {notes && <p style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}><strong>Notes:</strong> {escapeHtml(notes)}</p>}
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-ghost" onClick={() => setStep(2)}>&larr; Back</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving} style={{ fontSize: "1.1rem", padding: "0.75rem 2rem" }}>
              {saving ? "Creating..." : "Generate Quote"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
