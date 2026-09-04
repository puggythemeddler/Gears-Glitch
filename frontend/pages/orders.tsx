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
  const [productImages, setProductImages] = useState<Record<string, string>>({});
  usePageTitle("My orders");

  useEffect(() => {
    setMounted(true);
    const ok = isCustomerLoggedIn();
    setLoggedIn(ok);
    if (!ok) return;
    api<{ orders: Order[] }>("/api/orders")
      .then((d) => {
        const ords = d.orders || [];
        setOrders(ords);
        const allIds = ords.flatMap((o) => (o.items || []).map((i) => i.productId)).filter(Boolean);
        const unique = [...new Set(allIds)];
        if (unique.length > 0) {
          api<{ images: Record<string, string> }>(`/api/products/batch-images?ids=${unique.join(",")}`)
            .then((img) => setProductImages(img.images || {}))
            .catch(() => {});
        }
      })
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
          const canInvoice = o.status !== "cancelled";
          const items = (o.items || []).filter((i) => !i.cancelled).slice(0, 3);
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
                  <span className="muted">{new Date(o.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                  {canInvoice && (
                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.preventDefault(); downloadInvoice(o.id); }} style={{ fontSize: "0.8rem" }}>
                      <Icon name="fileText" size={13} /> Invoice
                    </button>
                  )}
                </div>
              </div>
              <p className="muted" style={{ fontSize: "0.9rem", margin: "0.5rem 0" }}>
                {formatPrice(total)} — {o.items?.length || 0} item(s)
              </p>
              {items.length > 0 && (
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                  {items.map((i) => {
                    const img = productImages[i.productId];
                    return (
                      <div key={i.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.25rem 0.5rem", background: "var(--surface-hover)", borderRadius: "var(--radius-md)", fontSize: "0.8rem" }}>
                        {img && <img src={img} alt="" style={{ width: 22, height: 22, objectFit: "cover", borderRadius: 4 }} />}
                        <span>{escapeHtml(i.name)}</span>
                      </div>
                    );
                  })}
                  {(o.items?.length || 0) > 3 && <span className="muted" style={{ fontSize: "0.8rem", alignSelf: "center" }}>+{(o.items?.length || 0) - 3} more</span>}
                </div>
              )}
              {o.shippingName && <p style={{ fontSize: "0.85rem", marginTop: "0.4rem" }}>{escapeHtml(o.shippingName)}{o.shippingCounty ? ` — ${escapeHtml(o.shippingCounty)}` : ""}</p>}
            </div>
          );
        })
      )}
    </>
  );
}
