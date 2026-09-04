import React, { useEffect, useState } from "react";
import { api, isCustomerLoggedIn, getGuestCart, updateGuestCartQuantity, removeGuestCartItem } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import type { CartItem, County, Product } from "@/lib/types";
import { PageHead } from "@/components/ui";
import EmptyCartAnimation from "@/components/EmptyCartAnimation";
import SantaGearAnimation from "@/components/SantaGearAnimation";

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export default function CartPage() {
  const { formatPrice, refreshCartCount } = useApp();
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
  const [loggedIn, setLoggedIn] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState("");
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardDiscount, setGiftCardDiscount] = useState(0);
  const [giftCardMsg, setGiftCardMsg] = useState("");
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [pointsDiscount, setPointsDiscount] = useState(0);
  const [pointsMsg, setPointsMsg] = useState("");

  useEffect(() => {
    const ok = isCustomerLoggedIn();
    setLoggedIn(ok);
    if (!ok) {
      loadGuestCart();
      return;
    }
    loadCart();
    api<{ counties: County[] }>("/api/shipping/counties").then((d) => setCounties(d.counties || [])).catch(() => {});
    api<any>("/api/public-settings").then((s) => {
      if (s.mpesaTillNumber) setTillNumber(s.mpesaTillNumber);
    }).catch(() => {});
    api<{ points: number }>("/api/loyalty/points").then((d) => setLoyaltyPoints(d.points)).catch(() => {});
  }, []);

  async function loadGuestCart() {
    const guest = getGuestCart();
    const hydrated: CartItem[] = [];
    await Promise.all(guest.map(async (g) => {
      try {
        const p = await api<Product>(`/api/products/${encodeURIComponent(g.productId)}`);
        hydrated.push({
          productId: p.id,
          name: p.name,
          price: p.price,
          quantity: g.quantity,
          lineTotal: p.price * g.quantity,
          imageUrl: p.imageUrl,
          hasWarranty: p.hasWarranty,
          warrantyDuration: p.warrantyDuration,
        });
      } catch {}
    }));
    setItems(hydrated);
    setPageLoading(false);
  }

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
    if (isCustomerLoggedIn()) {
      try {
        await api(`/api/cart/${encodeURIComponent(productId)}`, { method: "PATCH", body: JSON.stringify({ quantity }) });
        await loadCart();
      } catch (err: any) { setStatusMsg({ text: err.message, error: true }); }
    } else {
      updateGuestCartQuantity(productId, quantity);
      setItems((prev) => prev.map((it) => it.productId === productId ? { ...it, quantity, lineTotal: it.price * quantity } : it));
      refreshCartCount();
    }
  }

  async function removeItem(productId: string) {
    if (isCustomerLoggedIn()) {
      try {
        await api(`/api/cart/${encodeURIComponent(productId)}`, { method: "DELETE" });
        await loadCart();
      } catch (err: any) { setStatusMsg({ text: err.message, error: true }); }
    } else {
      removeGuestCartItem(productId);
      setItems((prev) => prev.filter((it) => it.productId !== productId));
      refreshCartCount();
    }
  }

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const total = subtotal + shippingFee - couponDiscount - giftCardDiscount - pointsDiscount;
  const shippingCountyLabel = counties.find((c) => c.id === Number(selectedCounty))?.name || selectedCounty;

  async function applyGiftCard() {
    if (!giftCardCode.trim()) return;
    setGiftCardMsg("");
    try {
      const res = await api<{ balance: number; discount: number }>("/api/gift-cards/validate", { method: "POST", body: JSON.stringify({ code: giftCardCode.trim(), amount: subtotal - couponDiscount }) });
      setGiftCardDiscount(res.discount);
      setGiftCardMsg(`Gift card applied! You save ${formatPrice(res.discount)}`);
    } catch (e: any) {
      setGiftCardDiscount(0);
      setGiftCardMsg(e.message || "Invalid gift card");
    }
  }

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

  function reviewOrder() {
    if (!isCustomerLoggedIn()) {
      window.location.href = `/login?redirect=/cart`;
      return;
    }
    if (items.length === 0) return;
    if (!shippingName.trim() || !shippingAddress.trim() || !selectedCounty) {
      setStatusMsg({ text: "Please fill in name, address, and county.", error: true });
      return;
    }
    setStatusMsg(null);
    setReviewOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function placeOrder() {
    setLoading(true);
    setStatusMsg(null);
    try {
      const body: any = {
        shippingName: shippingName.trim(),
        shippingAddress: shippingAddress.trim(),
        shippingCounty: counties.find((c) => c.id === Number(selectedCounty))?.name || selectedCounty,
        shippingPhone: shippingPhone.trim(),
        notes: "",
      };
      if (mpesaPhone.trim()) body.mpesaPhone = mpesaPhone.trim();
      if (couponCode.trim()) body.couponCode = couponCode.trim();
      if (giftCardCode.trim()) body.giftCardCode = giftCardCode.trim();
      if (redeemPoints > 0) body.redeemPoints = redeemPoints;
      const order = await api<any>("/api/orders", { method: "POST", body: JSON.stringify(body) });
      if (order.mpesaRequested) {
        setStatusMsg({ text: "M-Pesa STK push sent to your phone. Complete payment to confirm order.", error: false });
      }
      localStorage.setItem("gg_order_just_placed", String(order.id));
      window.location.href = `/order?id=${order.id}`;
    } catch (err: any) {
      setStatusMsg({ text: err.message, error: true });
    } finally { setLoading(false); }
  }

  return (
    <>
      <PageHead title="Your cart - Gear&Glitch" description="Review the items in your cart and complete checkout." />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><span aria-current="page">Cart</span></li>
        </ol>
      </nav>
      <h1>Shopping cart</h1>
      <div style={{ marginBottom: "1rem" }}>
        <a href="/" className="btn btn-ghost btn-sm">&larr; Continue shopping</a>
      </div>

      {!loggedIn && items.length > 0 && (
        <div className="panel" style={{ marginBottom: "1rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.9rem" }}>Your cart is saved on this device. Sign in to check out and keep it synced.</span>
          <a href="/login?redirect=/cart" className="btn btn-sm btn-primary">Sign in</a>
        </div>
      )}

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
          <EmptyCartAnimation />
          {new Date().getMonth() === 11 && <SantaGearAnimation />}
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
            {couponDiscount > 0 && <div className="cart-summary__row"><span style={{ color: "var(--success)" }}>Coupon discount</span><span style={{ color: "var(--success)" }}>-{formatPrice(couponDiscount)}</span></div>}
            {giftCardDiscount > 0 && <div className="cart-summary__row"><span style={{ color: "var(--success)" }}>Gift card</span><span style={{ color: "var(--success)" }}>-{formatPrice(giftCardDiscount)}</span></div>}
            {pointsDiscount > 0 && <div className="cart-summary__row"><span style={{ color: "var(--success)" }}>Points discount</span><span style={{ color: "var(--success)" }}>-{formatPrice(pointsDiscount)}</span></div>}
            <div className="cart-summary__row" style={{ flexWrap: "wrap", gap: "0.35rem" }}>
              <input type="text" className="input" placeholder="Coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} style={{ flex: 1, minWidth: 120, fontSize: "0.85rem" }} />
              <button className="btn btn-sm" onClick={applyCoupon} style={{ fontSize: "0.85rem" }}>Apply</button>
              {couponMsg && <span style={{ fontSize: "0.8rem", color: couponDiscount > 0 ? "var(--success)" : "var(--danger)", width: "100%" }}>{couponMsg}</span>}
            </div>
            <div className="cart-summary__row" style={{ flexWrap: "wrap", gap: "0.35rem" }}>
              <input type="text" className="input" placeholder="Gift card code" value={giftCardCode} onChange={(e) => setGiftCardCode(e.target.value)} style={{ flex: 1, minWidth: 120, fontSize: "0.85rem" }} />
              <button className="btn btn-sm" onClick={applyGiftCard} style={{ fontSize: "0.85rem" }}>Apply</button>
              {giftCardMsg && <span style={{ fontSize: "0.8rem", color: giftCardDiscount > 0 ? "var(--success)" : "var(--danger)", width: "100%" }}>{giftCardMsg}</span>}
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
                {pointsMsg && <span style={{ fontSize: "0.8rem", color: pointsDiscount > 0 ? "var(--success)" : "var(--danger)", width: "100%" }}>{pointsMsg}</span>}
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
            <button className="btn btn-primary btn-block" onClick={reviewOrder} disabled={loading || items.length === 0}>
              {isCustomerLoggedIn() ? "Review order" : "Sign in to check out"}
            </button>
          </div>

          {reviewOpen && (
            <div className="panel" style={{ marginTop: "1.5rem" }}>
              <h3 style={{ margin: "0 0 0.25rem" }}>Review your order</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0 0 1rem" }}>Please confirm the details below before placing your order.</p>

              <div style={{ marginBottom: "1rem" }}>
                {items.map((item) => (
                  <div key={item.productId} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.5rem 0", borderBottom: "1px solid var(--border)", fontSize: "0.9rem" }}>
                    <span style={{ flex: 1 }}>{escapeHtml(item.name)} <span style={{ color: "var(--text-secondary)" }}>&times; {item.quantity}</span></span>
                    <span style={{ whiteSpace: "nowrap" }}>{formatPrice(item.lineTotal)}</span>
                  </div>
                ))}
              </div>

              <div className="cart-summary__row"><span>Shipping to</span><span style={{ textAlign: "right" }}>{escapeHtml(shippingName)}<br />{escapeHtml(shippingAddress)}, {escapeHtml(shippingCountyLabel)}</span></div>
              {shippingPhone.trim() && <div className="cart-summary__row"><span>Phone</span><span>{escapeHtml(shippingPhone)}</span></div>}
              {mpesaPhone.trim() && <div className="cart-summary__row"><span>M-Pesa number</span><span>{escapeHtml(mpesaPhone)}</span></div>}
              {couponDiscount > 0 && <div className="cart-summary__row"><span style={{ color: "var(--success)" }}>Coupon discount</span><span style={{ color: "var(--success)" }}>-{formatPrice(couponDiscount)}</span></div>}
              {giftCardDiscount > 0 && <div className="cart-summary__row"><span style={{ color: "var(--success)" }}>Gift card</span><span style={{ color: "var(--success)" }}>-{formatPrice(giftCardDiscount)}</span></div>}
              {pointsDiscount > 0 && <div className="cart-summary__row"><span style={{ color: "var(--success)" }}>Points discount</span><span style={{ color: "var(--success)" }}>-{formatPrice(pointsDiscount)}</span></div>}
              <div className="cart-summary__row"><span>Shipping</span><span>{shippingFee > 0 ? formatPrice(shippingFee) : "—"}</span></div>
              <div className="cart-summary__total cart-summary__row"><span>Total</span><span>{formatPrice(total)}</span></div>

              {tillNumber && <p style={{ fontSize: "0.85rem", margin: "0.5rem 0" }}>You'll pay via M-Pesa Till: <strong>{tillNumber}</strong></p>}

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
                <button className="btn btn-primary" onClick={placeOrder} disabled={loading}>
                  {loading ? "Placing order..." : "Place order"}
                </button>
                <button className="btn btn-ghost" onClick={() => { setReviewOpen(false); setStatusMsg(null); }} disabled={loading}>
                  Back to edit
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
