import React, { useEffect, useState, useRef } from "react";
import { api, getRole, getTokenForRole, downloadPdf } from "@/lib/api";
import type { Product } from "@/lib/types";
import PinLock from "@/components/PinLock";
import { useApp } from "@/lib/app-context";
import { escapeHtml } from "@/lib/sanitize";

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
  serialTracking?: boolean;
  serials?: string[];
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
  const { isDark, toggleDark } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<POSItem[]>([]);
  const [status, setStatus] = useState("");
  const [processing, setProcessing] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [lastChange, setLastChange] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [tenderedAmount, setTenderedAmount] = useState("");
  const [mpesaPhonePos, setMpesaPhonePos] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [pinUnlocked, setPinUnlocked] = useState(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("posUnlocked")) return true;
    return false;
  });
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [serialModal, setSerialModal] = useState<Product | null>(null);
  const [serialInput, setSerialInput] = useState("");
  const [serialMsg, setSerialMsg] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const customerRef = useRef<HTMLDivElement>(null);
  const serialInputRef = useRef<HTMLInputElement>(null);

  const pmtConfig = paymentMethods.find((m) => m.id === paymentMethod);
  const needsTender = pmtConfig?.needsTender ?? false;

  useEffect(() => {
    const role = getRole();
    setLoggedIn(!!role);
    if (sessionStorage.getItem("posUnlocked")) setPinUnlocked(true);
    // Skip PIN lock for already-logged-in staff/technician/owner — they're already authenticated
    else if (role && role !== "customer") setPinUnlocked(true);
    const savedCat = sessionStorage.getItem("posCategory");
    if (savedCat) setSelectedCategory(savedCat);
    api<{ products: Product[] }>("/api/products?includeHidden=1").then((d) => {
      setProducts(d.products || []);
      setFiltered(d.products || []);
    }).catch(() => {});
    api<{ methods: PaymentMethod[] }>("/api/pos/payment-methods").then((d) => {
      const methods = d.methods || [];
      setPaymentMethods(methods);
      if (methods.length > 0 && !paymentMethod) setPaymentMethod(methods[0].id);
    }).catch(() => {});
    api<{ categories: { id: string; label: string }[] }>("/api/pos/categories").then((d) => {
      setCategories(d.categories || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const q = search.toLowerCase().trim();
    const cat = selectedCategory;
    let list = products;
    if (cat) list = list.filter((p) => p.category === cat);
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    setFiltered(list);
  }, [search, products, selectedCategory]);

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
    if (typeof product.stockOnHand === "number" && product.stockOnHand <= 0) return;
    if (product.serialTracking) {
      setSerialModal(product);
      setSerialInput("");
      setSerialMsg("");
      return;
    }
    const effectivePrice = product.salePrice && product.salePrice > 0 ? product.salePrice : product.price;
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1, lineTotal: (i.quantity + 1) * i.price } : i);
      return [...prev, { productId: product.id, name: product.name, price: effectivePrice, quantity: 1, lineTotal: effectivePrice, imageUrl: product.imageUrl }];
    });
    setSearch("");
    searchRef.current?.focus();
  }

  async function handleScan(raw: string) {
    const code = String(raw || "").trim();
    if (!code) return;
    try {
      const product = await api<Product>(`/api/products/by-barcode/${encodeURIComponent(code)}`);
      if (product && product.id) {
        setStatus("");
        if (product.serialTracking) {
          setSerialModal(product);
          setSerialInput("");
          setSerialMsg("Barcode found — now scan serial number(s).");
          return;
        }
        addToCart(product);
        return;
      }
    } catch { /* not a barcode — try serial below */ }
    try {
      const serial = await api<any>(`/api/serials/lookup/${encodeURIComponent(code)}`);
      if (serial && serial.product_id) {
        setStatus("");
        addSerialToCart(serial.product_id, serial.serial_number);
        return;
      }
    } catch { /* not a serial either */ }
    setStatus("Not found: " + code);
  }

  function addSerialToCart(productId: string, serial: string) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        if (existing.serials?.includes(serial)) return prev;
        const serials = [...(existing.serials || []), serial];
        return prev.map((i) => i.productId === productId ? { ...i, serials, quantity: serials.length, lineTotal: serials.length * i.price } : i);
      }
      const product = products.find((p) => p.id === productId);
      if (!product) return prev;
      const effectivePrice = product.salePrice && product.salePrice > 0 ? product.salePrice : product.price;
      return [...prev, { productId: product.id, name: product.name, price: effectivePrice, quantity: 1, lineTotal: effectivePrice, imageUrl: product.imageUrl, serialTracking: true, serials: [serial] }];
    });
    setSearch("");
    searchRef.current?.focus();
  }

  async function submitSerial() {
    const code = String(serialInput || "").trim();
    if (!code || !serialModal) return;
    try {
      const serial = await api<any>(`/api/serials/lookup/${encodeURIComponent(code)}`);
      if (!serial || !serial.product_id) { setSerialMsg("Serial not found."); return; }
      if (serial.product_id !== serialModal.id) { setSerialMsg(`That serial belongs to ${serial.product_name || "another product"}.`); return; }
      if (serial.status === "sold" || serial.status === "void") { setSerialMsg("That serial is no longer available."); return; }
      addSerialToCart(serialModal.id, serial.serial_number);
      setSerialInput("");
      setSerialMsg(`Added ${serial.serial_number}.`);
    } catch {
      setSerialMsg("Serial not found.");
    }
  }

  function removeSerial(productId: string, serial: string) {
    setCart((prev) => prev.map((i) => {
      if (i.productId !== productId) return i;
      const serials = (i.serials || []).filter((s) => s !== serial);
      return { ...i, serials, quantity: serials.length, lineTotal: serials.length * i.price };
    }));
  }

  useEffect(() => {
    if (serialModal) setTimeout(() => serialInputRef.current?.focus(), 50);
  }, [serialModal]);

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) { setCart((prev) => prev.filter((i) => i.productId !== productId)); return; }
    setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, quantity: qty, lineTotal: qty * i.price } : i));
  }

  const subtotal = cart.reduce((s, i) => s + i.lineTotal, 0);
  const change = needsTender && Number(tenderedAmount) > subtotal ? Number(tenderedAmount) - subtotal : 0;

  async function checkout() {
    if (cart.length === 0) return;
    for (const item of cart) {
      if (item.serialTracking && (item.serials || []).length !== item.quantity) {
        setStatus(`Scan ${item.quantity} serial number(s) for ${item.name}.`);
        return;
      }
    }
    if (needsTender && !tenderedAmount) { setStatus("Enter amount tendered."); return; }
    if (needsTender && Number(tenderedAmount) < subtotal) { setStatus("Insufficient amount."); return; }
    if (paymentMethod === "mpesa" && !mpesaPhonePos.trim()) { setStatus("Enter M-Pesa phone number."); return; }
    setProcessing(true);
    setStatus("");
    const idempotencyKey = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try {
      const body: any = {
        customerName: selectedCustomer ? selectedCustomer.name : "Walk-in Customer",
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity, serials: i.serials || [] })),
        paymentMethod,
        idempotencyKey,
      };
      if (selectedCustomer) body.customerId = selectedCustomer.id;
      if (needsTender) body.tenderedAmount = Number(tenderedAmount);
      if (paymentMethod === "mpesa") body.mpesaPhone = mpesaPhonePos.trim();
      const res = await api<{ order: { id: number }; change: number }>("/api/pos/checkout", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setLastOrderId(res.order.id);
      setLastChange(res.change || 0);
      setStatus("Sale completed!");
      setCart([]);
      setTenderedAmount("");
      setMpesaPhonePos("");
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
          <p>Please log in to use POS.</p>
          <a href="/dashboard" className="btn btn-primary">Go to Dashboard</a>
        </div>
      </div>
    );
  }

  if (!pinUnlocked) {
    return <PinLock storageKey="posPin" title="POS PIN" onUnlock={() => { sessionStorage.setItem("posUnlocked", "1"); setPinUnlocked(true); }} />;
  }

  return (
    <div className="pos-shell">

      {/* Category sidebar */}
      <div className="pos-category-bar">
        <button
          onClick={() => { setSelectedCategory(""); sessionStorage.removeItem("posCategory"); }}
          style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.75rem", border: "none", background: !selectedCategory ? "var(--primary)" : "transparent", color: !selectedCategory ? "var(--surface)" : "var(--text)", cursor: "pointer", fontSize: "0.82rem", fontWeight: !selectedCategory ? 600 : 400 }}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setSelectedCategory(cat.id); sessionStorage.setItem("posCategory", cat.id); }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.75rem", border: "none", background: selectedCategory === cat.id ? "var(--primary)" : "transparent", color: selectedCategory === cat.id ? "var(--surface)" : "var(--text)", cursor: "pointer", fontSize: "0.82rem", fontWeight: selectedCategory === cat.id ? 600 : 400 }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="pos-main-column">
        <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--border)", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input ref={searchRef} type="text" className="input" placeholder="Search products or scan barcode / serial..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScan(search); setSearch(""); } }} style={{ flex: 1, fontSize: "1.1rem" }} autoFocus />
          <button type="button" onClick={toggleDark} aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.3rem 0.6rem", cursor: "pointer", fontSize: "0.85rem", color: "var(--text)", lineHeight: 1, whiteSpace: "nowrap" }}>{isDark ? "☀️" : "🌙"}</button>
        </div>
        <div className="pos-product-grid">
          {filtered.map((p) => (
            <button key={p.id} type="button" className="panel" style={{ cursor: "pointer", textAlign: "left", padding: "0.5rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }} onClick={() => addToCart(p)}>
              {p.imageUrl ? <img src={p.imageUrl} alt={p.name} style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 4, marginBottom: "0.35rem" }} /> : <div style={{ width: "100%", height: 100, background: "var(--bg)", borderRadius: 4, marginBottom: "0.35rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", opacity: 0.3 }}>{escapeHtml(p.name.charAt(0))}</div>}
              <div style={{ fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text)" }}>{escapeHtml(p.name)}</div>
              <div style={{ fontSize: "0.9rem", color: "var(--primary)" }}>
                {p.salePrice ? <><span style={{ textDecoration: "line-through", color: "var(--muted)", fontSize: "0.85em" }}>{formatPrice(p.price)}</span> <span style={{ color: "var(--danger)", fontWeight: 700 }}>{formatPrice(p.salePrice)}</span></> : formatPrice(p.price)}
              </div>
              {typeof p.stockOnHand === "number" && (
                <div style={{ fontSize: "0.7rem", color: p.stockOnHand <= 0 ? "var(--danger)" : p.stockOnHand <= 5 ? "var(--warning)" : "var(--text-secondary)", marginTop: 2 }}>
                  {p.stockOnHand <= 0 ? "Out of stock" : `Stock: ${p.stockOnHand}`}
                </div>
              )}
            </button>
          ))}
          {filtered.length === 0 && <p className="muted" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "2rem" }}>No products found.</p>}
        </div>
      </div>

      <div className="pos-cart-panel">
        <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: "1.1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Cart ({cart.length})</span>
          <button onClick={() => { localStorage.removeItem("posPin"); sessionStorage.removeItem("posUnlocked"); sessionStorage.removeItem("posCategory"); setPinUnlocked(false); setSelectedCategory(""); }} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline" }}>Change PIN</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem" }}>
          {cart.length === 0 ? <p className="muted" style={{ textAlign: "center", padding: "2rem" }}>Cart is empty</p> : cart.map((item) => (
            <div key={item.productId} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{formatPrice(item.price)} each</div>
                {item.serialTracking && (
                  <div style={{ marginTop: "0.25rem" }}>
                    {(item.serials || []).map((sn) => (
                      <span key={sn} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.1rem 0.4rem", fontSize: "0.72rem", marginRight: "0.25rem", marginBottom: "0.25rem" }}>
                        {sn}
                        <button type="button" onClick={() => removeSerial(item.productId, sn)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontWeight: 700, padding: 0, lineHeight: 1 }} title="Remove serial">&times;</button>
                      </span>
                    ))}
                    {(item.serials || []).length === 0 && <span style={{ fontSize: "0.75rem", color: "var(--danger)" }}>Scan serial number(s)</span>}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                {item.serialTracking ? (
                  <>
                    <button className="btn btn-sm btn-ghost" onClick={() => removeSerial(item.productId, (item.serials || [])[(item.serials || []).length - 1])} disabled={(item.serials || []).length === 0}>&minus;</button>
                    <span style={{ width: 28, textAlign: "center", fontWeight: 600 }}>{item.quantity}</span>
                    <button className="btn btn-sm btn-ghost" onClick={() => { const p = products.find((x) => x.id === item.productId); if (p) addToCart(p); }}>+</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-sm btn-ghost" onClick={() => updateQty(item.productId, item.quantity - 1)}>&minus;</button>
                    <span style={{ width: 28, textAlign: "center", fontWeight: 600 }}>{item.quantity}</span>
                    <button className="btn btn-sm btn-ghost" onClick={() => updateQty(item.productId, item.quantity + 1)}>+</button>
                  </>
                )}
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
            {paymentMethod === "mpesa" && (
              <div style={{ marginBottom: "0.4rem" }}>
                <input type="tel" className="input" placeholder="M-Pesa phone (e.g. 0712345678)" value={mpesaPhonePos} onChange={(e) => setMpesaPhonePos(e.target.value)} style={{ width: "100%", fontSize: "0.85rem" }} />
              </div>
            )}
          </div>
        )}

        <div style={{ padding: "0.75rem", borderTop: "1px solid var(--border)" }}>
          {change > 0 && !lastOrderId && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--success)" }}>
              <span>Change</span>
              <span>{formatPrice(change)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            <span>Total</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          {status && <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem", color: status.startsWith("Error") || status.startsWith("Insufficient") || status.startsWith("Enter") ? "var(--danger)" : "var(--success)" }}>{status}</p>}
          {lastOrderId ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ fontSize: "0.9rem", textAlign: "center" }}>Order #{lastOrderId}</div>
              {lastChange > 0 && <div style={{ fontSize: "1rem", textAlign: "center", color: "var(--success)", fontWeight: 700 }}>Change: {formatPrice(lastChange)}</div>}
              <button
                className="btn btn-primary btn-block"
                style={{ textAlign: "center", fontSize: "1rem", padding: "0.6rem" }}
                disabled={downloadingPdf}
                onClick={async () => {
                  setDownloadingPdf(true);
                  try {
                    await downloadPdf(`/api/pos/receipt/${lastOrderId}`, `invoice-${lastOrderId}.pdf`);
                  } catch (err: any) {
                    setStatus(err.message || "Download failed.");
                  } finally {
                    setDownloadingPdf(false);
                  }
                }}
              >
                {downloadingPdf ? "Saving..." : "Save Invoice"}
              </button>
              <button
                className="btn btn-ghost btn-block"
                style={{ textAlign: "center", fontSize: "1rem", padding: "0.6rem" }}
                onClick={() => {
                  window.open(`/api/pos/receipt/${lastOrderId}?format=a4&allowQueryToken=1&token=${encodeURIComponent(getTokenForRole() || "")}`, "_blank");
                }}
              >
                Print Invoice
              </button>
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

      {serialModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setSerialModal(null)}>
          <div className="panel" style={{ width: "min(420px, 92vw)", padding: "1.25rem" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: "0.25rem" }}>Scan serial number</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
              {serialModal.name} — scan each unit's serial (scanner or type + Enter).
            </p>
            <input
              ref={serialInputRef}
              type="text"
              className="input"
              placeholder="Serial number..."
              value={serialInput}
              onChange={(e) => setSerialInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitSerial(); } }}
              style={{ width: "100%", fontSize: "1.05rem", marginBottom: "0.5rem" }}
            />
            {serialMsg && <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem", color: serialMsg.startsWith("Added") ? "var(--success)" : "var(--danger)" }}>{serialMsg}</p>}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={submitSerial}>Add Serial</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSerialModal(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}