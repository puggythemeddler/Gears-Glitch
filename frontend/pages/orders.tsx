import React, { useEffect, useState } from "react";
import { api, isCustomerLoggedIn, downloadPdf } from "@/lib/api";
import type { Order } from "@/lib/types";

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);
}

function escapeHtml(v: string) { return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [mounted, setMounted] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setMounted(true);
    const ok = isCustomerLoggedIn();
    setLoggedIn(ok);
    if (!ok) return;
    api<{ orders: Order[] }>("/api/orders").then((d) => setOrders(d.orders || [])).catch(() => {});
  }, []);

  if (mounted && !loggedIn) {
    return <><h1>Orders</h1><p className="product-error">Please <a href="/login?redirect=/orders">sign in</a> to view your orders.</p></>;
  }

  async function downloadInvoice(orderId: number) {
    try {
      const r = await api<{ token: string }>("/api/orders/invoice-token/" + orderId, { method: "POST" });
      await downloadPdf(`/api/orders/${orderId}/invoice?allowQueryToken=1&token=${encodeURIComponent(r.token)}`, `invoice-${orderId}.pdf`);
    } catch (e: any) { alert("Failed to download invoice: " + (e?.message || "Unknown error")); }
  }

  return (
    <>
      <nav className="breadcrumbs">
        <ol>
          <li><a href="/">Home</a></li>
          <li><span aria-current="page">Orders</span></li>
        </ol>
      </nav>
      <h1>My orders</h1>
      {orders.length === 0 ? (
        <p className="muted">No orders yet. <a href="/">Browse products</a>.</p>
      ) : (
        orders.map((o) => {
          const total = o.total || o.subtotal + (o.shippingFee || 0);
          const canInvoice = o.status === "shipped" || o.status === "delivered";
          return (
            <div key={o.id} className="order-item" style={{ marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.5rem", flexWrap: "wrap" }}>
                <div>
                  <a href={`/order?id=${o.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <strong>Order #{o.id}</strong>
                  </a>{" "}
                  <span className="plan-status">{o.status}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className="muted">{new Date(o.createdAt).toLocaleDateString("en-GB")}</span>
                  {canInvoice && (
                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.preventDefault(); downloadInvoice(o.id); }} style={{ fontSize: "0.8rem" }}>
                      Invoice
                    </button>
                  )}
                </div>
              </div>
              <p className="muted" style={{ fontSize: "0.9rem", margin: "0.5rem 0" }}>
                {formatPrice(total)} — {o.items?.length || 0} item(s)
              </p>
              {o.shippingName && <p style={{ fontSize: "0.85rem" }}>{escapeHtml(o.shippingName)}{o.shippingCounty ? ` — ${escapeHtml(o.shippingCounty)}` : ""}</p>}
            </div>
          );
        })
      )}
    </>
  );
}
