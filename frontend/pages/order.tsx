import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { api, isCustomerLoggedIn, downloadPdf } from "@/lib/api";
import type { Order } from "@/lib/types";
import RippleButton from "@/components/RippleButton";

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);
}

function escapeHtml(v: string) { const d = document.createElement("div"); d.textContent = v; return d.innerHTML; }

export default function OrderDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setMounted(true);
    const ok = isCustomerLoggedIn();
    setLoggedIn(ok);
    if (!ok) return;
    if (!id) return;
    api<Order>(`/api/orders/${id}`).then(setOrder).catch((e) => setError(e.message));
  }, [id]);

  if (mounted && !loggedIn) {
    return <><h1>Order</h1><div className="empty-state"><div className="empty-state-icon">🔒</div><div className="empty-state-title">Sign in to view order</div><div className="empty-state-desc">Please sign in to view this order.</div><a href="/login?redirect=/orders" className="btn btn-primary">Sign in</a></div></>;
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
          <div className="empty-state-icon">⚠️</div>
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

  const total = order.total || order.subtotal + (order.shippingFee || 0);

  return (
    <>
      <nav className="breadcrumbs">
        <ol>
          <li><a href="/">Home</a></li>
          <li><a href="/orders">Orders</a></li>
          <li><span aria-current="page">Order #{order.id}</span></li>
        </ol>
      </nav>
      <h1>Order #{order.id}</h1>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <span className="plan-status">{order.status}</span>
          <span className="muted">{new Date(order.createdAt).toLocaleDateString("en-GB")}</span>
        </div>
        {(order.status === "shipped" || order.status === "delivered") && (
          <div style={{ marginBottom: "1rem" }}>
            <RippleButton onClick={async () => { try { const r = await api<{ token: string }>("/api/orders/invoice-token/" + order.id, { method: "POST" }); await downloadPdf(`/api/orders/${order.id}/invoice?token=${encodeURIComponent(r.token)}`, `invoice-${order.id}.pdf`); } catch (e: any) { alert("Failed to download invoice: " + (e?.message || "Unknown error")); } }}>Invoice</RippleButton>
          </div>
        )}

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

        {order.notes && (
          <>
            <h3>Notes</h3>
            <p>{escapeHtml(order.notes)}</p>
          </>
        )}
      </div>

      <h3>Items</h3>
      <table className="data-table">
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th><th>Warranty</th></tr>
        </thead>
        <tbody>
          {(order.items || []).map((i) => {
            let warrantyText = "\u2014";
            if (i.hasWarranty && i.warrantyDuration) {
              const expiry = new Date(order.createdAt);
              expiry.setMonth(expiry.getMonth() + i.warrantyDuration);
              warrantyText = `${i.warrantyDuration}mo (exp: ${expiry.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })})`;
            }
            return (
              <tr key={i.id}>
                <td>{escapeHtml(i.name)}</td>
                <td>{i.quantity}</td>
                <td>{formatPrice(i.price)}</td>
                <td>{formatPrice(i.lineTotal)}</td>
                <td style={{ fontSize: "0.85rem" }}>{warrantyText}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr><td colSpan={4} style={{ textAlign: "right" }}>Subtotal</td><td>{formatPrice(order.subtotal)}</td></tr>
          <tr><td colSpan={4} style={{ textAlign: "right" }}>Shipping</td><td>{formatPrice(order.shippingFee || 0)}</td></tr>
          <tr><td colSpan={4} style={{ textAlign: "right", fontWeight: 700 }}>Total</td><td style={{ fontWeight: 700 }}>{formatPrice(total)}</td></tr>
        </tfoot>
      </table>
    </>
  );
}
