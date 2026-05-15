import React, { useEffect, useState, useRef } from "react";
import { api, isCustomerLoggedIn } from "@/lib/api";
import type { Product } from "@/lib/types";

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);
}

interface POSItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
  imageUrl: string;
}

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  kraCode: string;
  needsTender: boolean;
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<POSItem[]>([]);
  const [status, setStatus] = useState("");
  const [processing, setProcessing] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [lastChange, setLastChange] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [tenderedAmount, setTenderedAmount] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const customerRef = useRef<HTMLDivElement>(null);

  const pmtConfig = paymentMethods.find((m) => m.id === paymentMethod);
  const needsTender = pmtConfig?.needsTender ?? false;
  const change = needsTender && Number(tenderedAmount) > subtotal ? Number(tenderedAmount) - subtotal : 0;

  useEffect(() => {
    setLoggedIn(isCustomerLoggedIn());
    api<{ products: Product[] }>("/api/products").then((d) => {
      setProducts(d.products || []);
      setFiltered(d.products || []);
    }).catch(() => {});
    api<{ methods: PaymentMethod[] }>("/api/pos/payment-methods").then((d) => {
      const methods = d.methods || [];
      setPaymentMethods(methods);
      if (methods.length > 0 && !paymentMethod) setPaymentMethod(methods[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const q = search.toLowerCase().trim();
    if (!q) { setFiltered(products); return; }
    setFiltered(products.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)));
  }, [search, products]);

  useEffect(() => {
    if (customerQuery.trim().length < 2) { setCustomers([]); return; }
    const timer = setTimeout(() => {
      api<{ customers: Customer[] }>("/api/pos/customers?q=" + encodeURIComponent(customerQuery)).then((d) => {
        const q = customerQuery.toLowerCase();
        setCustomers((d.customers || []).filter((c: Customer) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.phone || "").includes(q)));
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) setShowCustomerDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1, lineTotal: (i.quantity + 1) * i.price } : i);
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1, lineTotal: product.price, imageUrl: product.imageUrl }];
    });
    setSearch("");
    searchRef.current?.focus();
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) { setCart((prev) => prev.filter((i) => i.productId !== productId)); return; }
    setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, quantity: qty, lineTotal: qty * i.price } : i));
  }

  const subtotal = cart.reduce((s, i) => s + i.lineTotal, 0);

  async function checkout() {
    if (cart.length === 0) return;
    if (needsTender && !tenderedAmount) { setStatus("Enter amount tendered."); return; }
    if (needsTender && Number(tenderedAmount) < subtotal) { setStatus("Insufficient amount."); return; }
    setProcessing(true);
    setStatus("");
    const idempotencyKey = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try {
      const body: any = {
        customerName: selectedCustomer ? selectedCustomer.name : "Walk-in Customer",
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        paymentMethod,
        idempotencyKey,
      };
      if (selectedCustomer) body.customerId = selectedCustomer.id;
      if (needsTender) body.tenderedAmount = Number(tenderedAmount);
      const res = await api<{ order: { id: number }; change: number }>("/api/pos/checkout", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setLastOrderId(res.order.id);
      setLastChange(res.change || 0);
      setStatus("Sale completed!");
      setCart([]);
      setTenderedAmount("");
      setSelectedCustomer(null);
      setCustomerQuery("");
    } catch (e: any) { setStatus(e.message || "Checkout failed."); }
    finally { setProcessing(false); }
  }

  if (!loggedIn) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div className="panel" style={{ textAlign: "center" }}>
          <h2>Point of Sale</h2>
          <p>Please sign in to use POS.</p>
          <a href="/login?redirect=/pos" className="btn btn-primary">Sign in</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - var(--nav-height, 60px))", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)" }}>
        <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--border)" }}>
          <input ref={searchRef} type="text" className="input" placeholder="Search products by name or ID..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", fontSize: "1.1rem" }} autoFocus />
        </div>
        <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.5rem", padding: "0.75rem" }}>
          {filtered.map((p) => (
            <button key={p.id} type="button" className="panel" style={{ cursor: "pointer", textAlign: "left", padding: "0.5rem", border: "1px solid var(--border)", background: "var(--surface)" }} onClick={() => addToCart(p)}>
              {p.imageUrl ? <img src={p.imageUrl} alt={p.name} style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 4, marginBottom: "0.35rem" }} /> : <div style={{ width: "100%", height: 100, background: "var(--bg)", borderRadius: 4, marginBottom: "0.35rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", opacity: 0.3 }}>{p.name.charAt(0)}</div>}
              <div style={{ fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
              <div style={{ fontSize: "0.9rem", color: "var(--primary)" }}>{formatPrice(p.price)}</div>
            </button>
          ))}
          {filtered.length === 0 && <p className="muted" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "2rem" }}>No products found.</p>}
        </div>
      </div>

      <div style={{ width: 380, display: "flex", flexDirection: "column", background: "var(--surface)" }}>
        <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: "1.1rem" }}>Cart ({cart.length})</div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem" }}>
          {cart.length === 0 ? <p className="muted" style={{ textAlign: "center", padding: "2rem" }}>Cart is empty</p> : cart.map((item) => (
            <div key={item.productId} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{formatPrice(item.price)} each</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <button className="btn btn-sm btn-ghost" onClick={() => updateQty(item.productId, item.quantity - 1)}>&minus;</button>
                <span style={{ width: 28, textAlign: "center", fontWeight: 600 }}>{item.quantity}</span>
                <button className="btn btn-sm btn-ghost" onClick={() => updateQty(item.productId, item.quantity + 1)}>+</button>
              </div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", minWidth: 80, textAlign: "right" }}>{formatPrice(item.lineTotal)}</div>
            </div>
          ))}
        </div>

        {!lastOrderId && (
          <div style={{ padding: "0.5rem 0.75rem", borderTop: "1px solid var(--border)", fontSize: "0.85rem" }}>
            <div ref={customerRef} style={{ position: "relative", marginBottom: "0.5rem" }}>
              <input type="text" className="input" placeholder="Search customer (optional)..." value={customerQuery} onChange={(e) => { setCustomerQuery(e.target.value); setShowCustomerDropdown(true); setSelectedCustomer(null); }} onFocus={() => setShowCustomerDropdown(true)} style={{ width: "100%", fontSize: "0.85rem" }} />
              {selectedCustomer && <div style={{ fontSize: "0.8rem", color: "var(--primary)", marginTop: 2 }}>{selectedCustomer.name} — {selectedCustomer.phone || selectedCustomer.email}</div>}
              {showCustomerDropdown && customers.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, maxHeight: 160, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
                  {customers.map((c) => (
                    <button key={c.id} type="button" style={{ display: "block", width: "100%", textAlign: "left", padding: "0.4rem 0.6rem", border: "none", background: "transparent", cursor: "pointer", fontSize: "0.85rem", borderBottom: "1px solid var(--border)" }} onMouseDown={() => { setSelectedCustomer(c); setCustomerQuery(c.name); setShowCustomerDropdown(false); }}>
                      <strong>{c.name}</strong> {c.phone ? `· ${c.phone}` : ""} <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>{c.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ width: "100%", fontSize: "0.85rem", marginBottom: "0.4rem" }}>
              {paymentMethods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            {needsTender && (
              <input type="number" className="input" placeholder="Amount tendered" value={tenderedAmount} onChange={(e) => setTenderedAmount(e.target.value)} min="0" step="0.01" style={{ width: "100%", fontSize: "0.85rem" }} />
            )}
          </div>
        )}

        <div style={{ padding: "0.75rem", borderTop: "1px solid var(--border)" }}>
          {change > 0 && !lastOrderId && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem", fontWeight: 700, marginBottom: "0.5rem", color: "#16a34a" }}>
              <span>Change</span>
              <span>{formatPrice(change)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            <span>Total</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          {status && <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem", color: status.startsWith("Error") || status.startsWith("Insufficient") || status.startsWith("Enter") ? "#dc2626" : "#16a34a" }}>{status}</p>}
          {lastOrderId ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ fontSize: "0.9rem", textAlign: "center" }}>Order #{lastOrderId}</div>
              {lastChange > 0 && <div style={{ fontSize: "1rem", textAlign: "center", color: "#16a34a", fontWeight: 700 }}>Change: {formatPrice(lastChange)}</div>}
              <a href={`/api/pos/receipt/${lastOrderId}?format=thermal`} target="_blank" className="btn btn-primary btn-block" style={{ textAlign: "center", fontSize: "1rem", padding: "0.6rem" }}>
                Print Thermal Receipt
              </a>
              <a href={`/api/pos/receipt/${lastOrderId}?format=a4`} target="_blank" className="btn btn-ghost btn-block" style={{ textAlign: "center", fontSize: "1rem", padding: "0.6rem" }}>
                Print A4 Invoice
              </a>
              <button className="btn btn-ghost btn-block" onClick={() => { setLastOrderId(null); setStatus(""); setLastChange(0); }} style={{ fontSize: "0.9rem", padding: "0.4rem" }}>
                New Sale
              </button>
            </div>
          ) : (
            <button className="btn btn-primary btn-block" onClick={checkout} disabled={cart.length === 0 || processing} style={{ fontSize: "1.1rem", padding: "0.75rem" }}>
              {processing ? "Processing..." : `Charge ${formatPrice(subtotal)}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}