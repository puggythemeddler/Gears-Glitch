import React, { useEffect, useState } from "react";
import { api, isCustomerLoggedIn } from "@/lib/api";
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
          return (
            <div key={o.id}>
              <a href={`/order?id=${o.id}`} className="order-item" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.5rem", flexWrap: "wrap" }}>
                  <div>
                    <strong>Order #{o.id}</strong> <span className="plan-status">{o.status}</span>
                  </div>
                  <span className="muted">{new Date(o.createdAt).toLocaleDateString("en-GB")}</span>
                </div>
                <p className="muted" style={{ fontSize: "0.9rem", margin: "0.5rem 0" }}>
                  {formatPrice(total)} — {o.items?.length || 0} item(s)
                </p>
                {o.shippingName && <p style={{ fontSize: "0.85rem" }}>{escapeHtml(o.shippingName)}{o.shippingCounty ? ` — ${escapeHtml(o.shippingCounty)}` : ""}</p>}
              </a>
            </div>
          );
        })
      )}
    </>
  );
}
