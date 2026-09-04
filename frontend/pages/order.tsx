import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { api, isCustomerLoggedIn, downloadPdf } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import type { Order } from "@/lib/types";
import { escapeHtml } from "@/lib/sanitize";
import { toast } from "@/components/Toast";
import Icon from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePageTitle } from "@/lib/use-page-title";
import OrderCelebrationAnimation from "@/components/OrderCelebrationAnimation";

export default function OrderDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { formatPrice, refreshCartCount } = useApp();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [productImages, setProductImages] = useState<Record<string, string>>({});
  const [reordering, setReordering] = useState(false);
  const [reorderMsg, setReorderMsg] = useState<string | null>(null);
  usePageTitle(order ? `Order #${order.id}` : "Order");

  const [shippingName, setShippingName] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCounty, setShippingCounty] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [mpesaMsg, setMpesaMsg] = useState("");
  const [notes, setNotes] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    setMounted(true);
    const ok = isCustomerLoggedIn();
    setLoggedIn(ok);
    if (!ok) return;
    if (!id) return;
    const justPlaced = localStorage.getItem("gg_order_just_placed");
    if (justPlaced && String(justPlaced) === String(id)) {
      setShowCelebration(true);
      localStorage.removeItem("gg_order_just_placed");
    }
    api<Order>(`/api/orders/${id}`).then((o) => {
      setOrder(o);
      setShippingName(o.shippingName || "");
      setShippingAddress(o.shippingAddress || "");
      setShippingCounty(o.shippingCounty || "");
      setShippingPhone(o.shippingPhone || "");
      setPaymentMethod(o.paymentMethod || "");
      setNotes(o.notes || "");
      const productIds = (o.items || []).map((i) => i.productId).filter(Boolean);
      if (productIds.length > 0) {
        api<{ images: Record<string, string> }>(`/api/products/batch-images?ids=${productIds.join(",")}`)
          .then((d) => setProductImages(d.images || {}))
          .catch(() => {});
      }
    }).catch((e) => setError(e.message));
    api<any>("/api/public-settings").then((s) => {
      if (s.paymentMethods) setPaymentMethods(s.paymentMethods);
    }).catch(() => {});
  }, [id]);

  async function saveDetails() {
    if (!shippingName.trim() || !shippingAddress.trim() || !shippingCounty.trim()) {
      setSaveMsg({ text: "Name, address, and county are required.", error: true });
      return;
    }
    if (paymentMethod === "mpesa" && !mpesaPhone.trim()) {
      setSaveMsg({ text: "M-Pesa phone number is required.", error: true });
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    setMpesaMsg("");
    try {
      const body: any = { shippingName, shippingAddress, shippingCounty, shippingPhone, paymentMethod, notes };
      if (paymentMethod === "mpesa") body.mpesaPhone = mpesaPhone.trim();
      const updated = await api<Order>(`/api/orders/${order!.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setOrder(updated);
      if ((updated as any).mpesaRequested) {
        setMpesaMsg("M-Pesa STK push sent to your phone. Complete payment to confirm.");
      }
      setSaveMsg({ text: "Order details saved!" });
    } catch (e: any) {
      setSaveMsg({ text: e.message || "Failed to save.", error: true });
    } finally { setSaving(false); }
  }

  async function downloadInvoice() {
    try {
      const r = await api<{ token: string }>("/api/orders/invoice-token/" + order!.id, { method: "POST" });
      await downloadPdf(`/api/orders/${order!.id}/invoice?allowQueryToken=1&token=${encodeURIComponent(r.token)}`, `invoice-${order!.id}.pdf`);
    } catch (e: any) { toast("error", "Failed to download invoice: " + (e?.message || "Unknown error")); }
  }

  async function reorder() {
    if (!order) return;
    setReordering(true);
    setReorderMsg(null);
    try {
      const d = await api<{ added: number; total: number }>(`/api/orders/${order.id}/reorder`, { method: "POST" });
      refreshCartCount();
      setReorderMsg(`Added ${d.added} of ${d.total} item(s) to your cart.`);
      toast("success", "Items added to cart!");
    } catch (e: any) {
      setReorderMsg(e.message || "Failed to reorder.");
    } finally { setReordering(false); }
  }

  if (mounted && !loggedIn) {
    return <><h1>Order</h1><div className="empty-state"><div className="empty-state-icon"><Icon name="lock" size={28} /></div><div className="empty-state-title">Sign in to view order</div><div className="empty-state-desc">Please sign in to view this order.</div><a href="/login?redirect=/orders" className="btn btn-primary">Sign in</a></div></>;
  }

  if (!mounted || !id) {
    return <><h1>Order</h1><div className="card"><div className="skeleton" style={{ height: "1rem", width: "30%", marginBottom: "var(--space-3)" }} /><div className="skeleton" style={{ height: "2rem", width: "100%", marginBottom: "var(--space-3)" }} /><div className="skeleton" style={{ height: "1rem", width: "60%" }} /></div></>;
  }

  if (error) {
    return (
      <>
        <nav className="breadcrumbs"><ol><li><a href="/">Home</a></li><li><a href="/orders">Orders</a></li><li><span aria-current="page">Order</span></li></ol></nav>
        <h1>Order #{id}</h1>
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="alertCircle" size={28} /></div>
          <div className="empty-state-title">Failed to load order</div>
          <div className="empty-state-desc">{error}</div>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </>
    );
  }

  if (!order) {
    return <><h1>Order #{id}</h1><div className="card"><div className="skeleton" style={{ height: "1rem", width: "30%", marginBottom: "var(--space-3)" }} /><div className="skeleton" style={{ height: "2rem", width: "100%", marginBottom: "var(--space-3)" }} /><div className="skeleton" style={{ height: "1rem", width: "60%" }} /></div></>;
  }

  const isPending = order.status === "pending";
  const canInvoice = order.status !== "cancelled";
  const total = order.total || order.subtotal + (order.shippingFee || 0);
  const activeItems = (order.items || []).filter((i) => !i.cancelled);
  const cancelledItems = (order.items || []).filter((i) => i.cancelled);

  const createdDate = new Date(order.createdAt);
  const daysSince = Math.floor((Date.now() - createdDate.getTime()) / 86400000);
  let estimatedDelivery = "";
  if (order.status === "pending") estimatedDelivery = "After confirmation";
  else if (order.status === "processing") estimatedDelivery = "1-2 business days";
  else if (order.status === "shipped") estimatedDelivery = daysSince <= 3 ? `${3 - daysSince} day(s) remaining` : "Arriving soon";
  else if (order.status === "delivered") estimatedDelivery = "Delivered";

  return (
    <>
      {showCelebration && <OrderCelebrationAnimation onDone={() => setShowCelebration(false)} />}
      <nav className="breadcrumbs">
        <ol>
          <li><a href="/">Home</a></li>
          <li><a href="/orders">Orders</a></li>
          <li><span aria-current="page">Order #{order.id}</span></li>
        </ol>
      </nav>
      <h1>Order #{order.id}</h1>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <StatusBadge status={order.status} domain="orders" />
            {order.paymentMethod && <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Payment: {escapeHtml(order.paymentMethod)}</span>}
          </div>
          <span className="muted">{createdDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>

        {estimatedDelivery && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", padding: "0.6rem 0.9rem", background: "var(--primary-subtle)", borderRadius: "var(--radius-md)", fontSize: "0.9rem", color: "var(--primary)" }}>
            <Icon name="truck" size={16} />
            <span><strong>Estimated delivery:</strong> {estimatedDelivery}</span>
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
          {canInvoice && (
            <button className="btn btn-secondary" onClick={downloadInvoice}>
              <Icon name="fileText" size={15} /> Download Invoice
            </button>
          )}
          {activeItems.length > 0 && order.status !== "pending" && (
            <button className="btn btn-ghost" onClick={reorder} disabled={reordering}>
              <Icon name="refresh" size={15} /> {reordering ? "Adding..." : "Reorder"}
            </button>
          )}
        </div>
        {reorderMsg && <p style={{ fontSize: "0.85rem", color: "var(--success)", marginBottom: "1rem" }}>{reorderMsg}</p>}

        {isPending ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 500 }}>
            <h3>Delivery Details</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>Fill in your delivery details and select a payment method below.</p>
            <div className="field">
              <label htmlFor="oName" className="input-label">Full name</label>
              <input id="oName" type="text" className="input" value={shippingName} onChange={(e) => setShippingName(e.target.value)} placeholder="e.g. John Mwangi" />
            </div>
            <div className="field">
              <label htmlFor="oAddress" className="input-label">Delivery address</label>
              <input id="oAddress" type="text" className="input" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder="e.g. 123 Kenyatta Ave, Nairobi" />
            </div>
            <div className="field">
              <label htmlFor="oCounty" className="input-label">County</label>
              <input id="oCounty" type="text" className="input" value={shippingCounty} onChange={(e) => setShippingCounty(e.target.value)} placeholder="e.g. Nairobi" />
            </div>
            <div className="field">
              <label htmlFor="oPhone" className="input-label">Phone number</label>
              <input id="oPhone" type="tel" className="input" value={shippingPhone} onChange={(e) => setShippingPhone(e.target.value)} placeholder="e.g. 0712345678" />
            </div>
            {paymentMethods.length > 0 && (
              <div className="field">
                <label htmlFor="oPayment" className="input-label">Payment method</label>
                <select id="oPayment" className="input" value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setMpesaMsg(""); }}>
                  <option value="">Select payment method…</option>
                  {paymentMethods.filter((m: any) => m.active !== false).map((m: any) => (
                    <option key={m.id} value={m.id}>{m.label || m.id}</option>
                  ))}
                </select>
              </div>
            )}
            {paymentMethod === "mpesa" && (
              <div className="field">
                <label htmlFor="oMpesaPhone" className="input-label">M-Pesa phone number</label>
                <input id="oMpesaPhone" type="tel" className="input" value={mpesaPhone} onChange={(e) => setMpesaPhone(e.target.value)} placeholder="e.g. 0712345678" />
              </div>
            )}
            <div className="field">
              <label htmlFor="oNotes" className="input-label">Delivery instructions (optional)</label>
              <textarea id="oNotes" className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Leave at the gate, call on arrival…" />
            </div>
            {saveMsg && <p style={{ fontSize: "0.85rem", color: saveMsg.error ? "var(--danger)" : "var(--success)" }}>{saveMsg.text}</p>}
            {mpesaMsg && <p style={{ fontSize: "0.85rem", color: "var(--success)" }}>{mpesaMsg}</p>}
            <button className="btn btn-primary" onClick={saveDetails} disabled={saving} style={{ alignSelf: "flex-start" }}>{saving ? "Saving…" : "Save details"}</button>
          </div>
        ) : (
          <>
            {order.shippingName && (
              <>
                <h3>Shipping details</h3>
                <table className="data-table">
                  <tbody>
                    <tr><td>Name</td><td>{escapeHtml(order.shippingName || "")}</td></tr>
                    <tr><td>Address</td><td>{escapeHtml(order.shippingAddress || "")}</td></tr>
                    {order.shippingCity && <tr><td>City</td><td>{escapeHtml(order.shippingCity)}</td></tr>}
                    <tr><td>County</td><td>{escapeHtml(order.shippingCounty || "")}</td></tr>
                    {order.shippingPhone && <tr><td>Phone</td><td>{escapeHtml(order.shippingPhone)}</td></tr>}
                  </tbody>
                </table>
              </>
            )}
            {order.notes && (
              <>
                <h3>Notes</h3>
                <p>{escapeHtml(order.notes)}</p>
              </>
            )}
          </>
        )}
      </div>

      <h3>Items</h3>
      <table className="data-table">
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th><th>Status</th></tr>
        </thead>
        <tbody>
          {activeItems.map((i) => {
            const img = productImages[i.productId];
            return (
              <tr key={i.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    {img && <img src={img} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }} />}
                    <a href={`/product?id=${encodeURIComponent(i.productId)}`} style={{ color: "var(--text)", textDecoration: "none" }}>
                      <span style={{ fontWeight: 500 }}>{escapeHtml(i.name)}</span>
                    </a>
                  </div>
                </td>
                <td>{i.quantity}</td>
                <td>{formatPrice(i.price)}</td>
                <td>{formatPrice(i.lineTotal)}</td>
                <td style={{ fontSize: "0.85rem", color: "var(--success)" }}>Active</td>
              </tr>
            );
          })}
          {cancelledItems.map((i) => {
            const img = productImages[i.productId];
            return (
              <tr key={i.id} style={{ opacity: 0.5, textDecoration: "line-through" }}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    {img && <img src={img} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }} />}
                    <span>{escapeHtml(i.name)}</span>
                  </div>
                </td>
                <td>{i.quantity}</td>
                <td>{formatPrice(i.price)}</td>
                <td>{formatPrice(i.lineTotal)}</td>
                <td style={{ fontSize: "0.85rem", color: "var(--danger)" }}>Cancelled</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr><td colSpan={3} style={{ textAlign: "right" }}>Subtotal</td><td>{formatPrice(order.subtotal)}</td><td /></tr>
          <tr><td colSpan={3} style={{ textAlign: "right" }}>Shipping</td><td>{formatPrice(order.shippingFee || 0)}</td><td /></tr>
          {cancelledItems.length > 0 && (
            <tr><td colSpan={3} style={{ textAlign: "right", color: "var(--danger)" }}>Cancelled items</td><td style={{ color: "var(--danger)" }}>-{formatPrice(cancelledItems.reduce((s, i) => s + i.lineTotal, 0))}</td><td /></tr>
          )}
          <tr><td colSpan={3} style={{ textAlign: "right", fontWeight: 700 }}>Total</td><td style={{ fontWeight: 700 }}>{formatPrice(total)}</td><td /></tr>
        </tfoot>
      </table>
    </>
  );
}
