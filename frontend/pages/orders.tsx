import React, { useEffect, useState } from "react";
import { api, isCustomerLoggedIn, downloadPdf } from "@/lib/api";
import type { Order } from "@/lib/types";
import { useApp } from "@/lib/app-context";
import { toast } from "@/components/Toast";
import Icon from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePageTitle } from "@/lib/use-page-title";

function escapeHtml(v: string) { return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }

export default function OrdersPage() {
  const { formatPrice } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  usePageTitle("My orders");

  useEffect(() => {
    setMounted(true);
    const ok = isCustomerLoggedIn();
    setLoggedIn(ok);
    if (!ok) return;
    api<{ orders: Order[] }>("/api/orders")
      .then((d) => setOrders(d.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (mounted && !loggedIn) {
    return <><h1>My orders</h1><div className="empty-state"><div className="empty-state-icon"><Icon name="lock" size={28} /></div><div className="empty-state-title">Sign in to view orders</div><div className="empty-state-desc">Please sign in to see your orders.</div><a href="/login?redirect=/orders" className="btn btn-primary">Sign in</a></div></>;
  }

  async function downloadInvoice(orderId: number) {
    try {
      const r = await api<{ token: string }>("/api/orders/invoice-token/" + orderId, { method: "POST" });
      await downloadPdf(`/api/orders/${orderId}/invoice?allowQueryToken=1&token=${encodeURIComponent(r.token)}`, `invoice-${orderId}.pdf`);
    } catch (e: any) { toast("error", "Failed to download invoice: " + (e?.message || "Unknown error")); }
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
      {loading ? (
        <p className="muted" style={{ padding: "1rem 0" }}>Loading orders…</p>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="inbox" size={28} /></div>
          <div className="empty-state-title">No orders yet</div>
          <div className="empty-state-desc">Browse products to place your first order.</div>
          <a href="/" className="btn btn-primary">Browse products</a>
        </div>
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
                  <StatusBadge status={o.status} domain="orders" />
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