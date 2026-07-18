import React, { useEffect, useState } from "react";
import { api, isCustomerLoggedIn } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import type { CartItem, County } from "@/lib/types";

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export default function CartPage() {
  const { formatPrice } = useApp();
  const [items, setItems] = useState<CartItem[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [selectedCounty, setSelectedCounty] = useState("");
  const [shippingFee, setShippingFee] = useState(0);
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [tillNumber, setTillNumber] = useState("");
  const [shippingName, setShippingName] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState("");
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [pointsDiscount, setPointsDiscount] = useState(0);
  const [pointsMsg, setPointsMsg] = useState("");

  useEffect(() => {
    setMounted(true);
    const ok = isCustomerLoggedIn();
    setLoggedIn(ok);
    if (!ok) { setPageLoading(false); return; }
    loadCart();
    api<{ counties: County[] }>("/api/shipping/counties").then((d) => setCounties(d.counties || [])).catch(() => {});
    api<any>("/api/public-settings").then((s) => {
      if (s.mpesaTillNumber) setTillNumber(s.mpesaTillNumber);
    }).catch(() => {});
    api<{ points: number }>("/api/loyalty/points").then((d) => setLoyaltyPoints(d.points)).catch(() => {});
  }, []);

  async function loadCart() {
    try {
      const data = await api<{ items: CartItem[] }>("/api/cart");
      setItems(data.items || []);
    } catch { setItems([]); }
    finally { setPageLoading(false); }
  }

  function handleCountyChange(countyId: string) {
    setSelectedCounty(countyId);
    const county = counties.find((c) => c.id === Number(countyId));
    setShippingFee(county?.fee || 0);
  }

  async function updateQty(productId: string, quantity: number) {
    if (quantity < 1) return;
    try {
      await api(`/api/cart/${encodeURIComponent(productId)}`, { method: "PATCH", body: JSON.stringify({ quantity }) });
      await loadCart();
    } catch (err: any) { setStatusMsg({ text: err.message, error: true }); }
  }

  async function removeItem(productId: string) {
    try {
      await api(`/api/cart/${encodeURIComponent(productId)}`, { method: "DELETE" });
      await loadCart();
    } catch (err: any) { setStatusMsg({ text: err.message, error: true }); }
  }

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const total = subtotal + shippingFee - couponDiscount - pointsDiscount;

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setCouponMsg("");
    try {
      const res = await api<{ coupon: any; discount: number }>("/api/coupons/validate", { method: "POST", body: JSON.stringify({ code: couponCode.trim(), subtotal }) });
      setCouponDiscount(res.discount);
      setCouponMsg(`Coupon applied! You save ${formatPrice(res.discount)}`);
    } catch (e: any) {
      setCouponDiscount(0);
        setCouponMsg(e.message || "Invalid coupon");
    }
  }

  async function checkout() {
    setLoading(true);
    setStatusMsg(null);
    try {
      const order = await api<any>("/api/orders/create-pending", { method: "POST" });
      window.location.href = `/order?id=${order.id}`;
    } catch (err: any) {
      setStatusMsg({ text: err.message, error: true });
    } finally { setLoading(false); }
  }

  if (mounted && !loggedIn) {
    return (
      <>
        <h1>Cart</h1>
        <div className="empty-state">
          <div className="empty-state-icon" style={{ fontSize: "3rem" }}>🛒</div>
          <div className="empty-state-title">Sign in to view your cart</div>
          <div className="empty-state-desc">Please sign in to see the items in your shopping cart.</div>
          <a href="/login?redirect=/cart" className="btn btn-primary">Sign in</a>
        </div>
      </>
    );
  }

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><span aria-current="page">Cart</span></li>
        </ol>
      </nav>
      <h1>Shopping cart</h1>

      {pageLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card" style={{ display: "flex", gap: "var(--space-4)", padding: "var(--space-4)" }}>
              <div className="skeleton" style={{ width: 72, height: 72, borderRadius: "var(--radius-md)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: "1rem", width: "60%", marginBottom: "var(--space-2)" }} />
                <div className="skeleton" style={{ height: "1rem", width: "30%", marginBottom: "var(--space-2)" }} />
                <div className="skeleton" style={{ height: "0.75rem", width: "40%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ fontSize: "3rem" }}>🛒</div>
          <div className="empty-state-title">Your cart is empty</div>
          <div className="empty-state-desc">Looks like you haven't added anything to your cart yet.</div>
          <a href="/" className="btn btn-primary">Browse products</a>
        </div>
      ) : (
        <>
          {items.map((item) => (
            <div key={item.productId} className="cart-item">
              {item.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : <div style={{ width: 72, height: 72, background: "var(--surface)", borderRadius: 8 }} />}
              <div className="cart-item__info">
                <div className="cart-item__name">{escapeHtml(item.name)}</div>
                <div className="cart-item__price">{formatPrice(item.price)}</div>
                {item.hasWarranty && item.warrantyDuration ? (
                  <div style={{ fontSize: "0.8rem", color: "var(--primary)", marginTop: "0.25rem" }}>&#x1F6E1;&#xFE0F; {item.warrantyDuration}mo warranty</div>
                ) : null}
              </div>
              <div className="cart-item__actions">
                <button className="btn btn-sm btn-ghost" onClick={() => updateQty(item.productId, item.quantity - 1)} disabled={item.quantity <= 1}>−</button>
                <span className="cart-item__qty">{item.quantity}</span>
                <button className="btn btn-sm btn-ghost" onClick={() => updateQty(item.productId, item.quantity + 1)}>+</button>
                <button className="btn btn-sm btn-ghost" onClick={() => removeItem(item.productId)}>Remove</button>
              </div>
              <div style={{ fontWeight: 600 }}>{formatPrice(item.lineTotal)}</div>
            </div>
          ))}

          <div className="cart-summary">
            <div className="cart-summary__row">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {couponDiscount > 0 && <div className="cart-summary__row"><span style={{ color: "#16a34a" }}>Coupon discount</span><span style={{ color: "#16a34a" }}>-{formatPrice(couponDiscount)}</span></div>}
            {pointsDiscount > 0 && <div className="cart-summary__row"><span style={{ color: "#16a34a" }}>Points discount</span><span style={{ color: "#16a34a" }}>-{formatPrice(pointsDiscount)}</span></div>}
            <div className="cart-summary__row" style={{ flexWrap: "wrap", gap: "0.35rem" }}>
              <input type="text" className="input" placeholder="Coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} style={{ flex: 1, minWidth: 120, fontSize: "0.85rem" }} />
              <button className="btn btn-sm" onClick={applyCoupon} style={{ fontSize: "0.85rem" }}>Apply</button>
              {couponMsg && <span style={{ fontSize: "0.8rem", color: couponDiscount > 0 ? "var(--success, #16a34a)" : "var(--danger, #dc2626)", width: "100%" }}>{couponMsg}</span>}
            </div>
            {loyaltyPoints > 0 && (
              <div className="cart-summary__row" style={{ flexWrap: "wrap", gap: "0.35rem", padding: "0.5rem 0" }}>
                <span style={{ width: "100%", fontSize: "0.85rem", fontWeight: 600 }}>Loyalty Points: {loyaltyPoints} available</span>
                <input type="number" className="input" placeholder="Points to redeem" value={redeemPoints || ""} onChange={(e) => setRedeemPoints(Number(e.target.value))} min={1} max={loyaltyPoints} style={{ flex: 1, minWidth: 80, fontSize: "0.85rem" }} />
                <button className="btn btn-sm" onClick={() => {
                  if (!redeemPoints || redeemPoints < 1) { setPointsMsg("Enter a valid amount."); return; }
                  if (redeemPoints > loyaltyPoints) { setPointsMsg("Not enough points."); return; }
                  setPointsDiscount(redeemPoints); setPointsMsg(`Will redeem ${redeemPoints} points on checkout.`);
                }} style={{ fontSize: "0.85rem" }}>Redeem</button>
                {pointsMsg && <span style={{ fontSize: "0.8rem", color: pointsDiscount > 0 ? "var(--success, #16a34a)" : "var(--danger, #dc2626)", width: "100%" }}>{pointsMsg}</span>}
              </div>
            )}
            <div className="field">
              <label htmlFor="shippingName" className="input-label">Full name</label>
              <input id="shippingName" type="text" className="input" value={shippingName} onChange={(e) => setShippingName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="shippingAddress" className="input-label">Shipping address</label>
              <input id="shippingAddress" type="text" className="input" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="county" className="input-label">County (for shipping)</label>
              <select id="county" className="input" value={selectedCounty} onChange={(e) => handleCountyChange(e.target.value)}>
                <option value="">Select county…</option>
                {counties.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — {formatPrice(c.fee)}</option>
                ))}
              </select>
            </div>
            <div className="cart-summary__row">
              <span>Shipping</span>
              <span>{shippingFee > 0 ? formatPrice(shippingFee) : "—"}</span>
            </div>
            <div className="cart-summary__total cart-summary__row">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
            {tillNumber && <p style={{ fontSize: "0.85rem" }}>M-Pesa Till: <strong>{tillNumber}</strong></p>}
            <div className="field">
              <label htmlFor="mpesaPhone" className="input-label">M-Pesa phone number (optional)</label>
              <input id="mpesaPhone" type="tel" className="input" value={mpesaPhone} onChange={(e) => setMpesaPhone(e.target.value)} placeholder="e.g. 0712345678" />
            </div>
            {statusMsg && <p className={`form-status${statusMsg.error ? " error" : ""}`}>{statusMsg.text}</p>}
            <button className="btn btn-primary btn-block" onClick={checkout} disabled={loading}>
              {loading ? "Processing..." : "Checkout"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
