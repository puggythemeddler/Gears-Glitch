import React, { useEffect, useState, useRef } from "react";
import { api, getRole, getTokenForRole, downloadPdf } from "@/lib/api";
import type { Product } from "@/lib/types";
import PinLock from "@/components/PinLock";
import { useApp } from "@/lib/app-context";
import { escapeHtml } from "@/lib/sanitize";
import { confirmDialog, promptDialog } from "@/components/ConfirmDialog";

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);
}

const PRODUCTS_PER_PAGE = 24;

type StatusKind = "error" | "success" | "info";

interface StatusMessage {
  text: string;
  kind: StatusKind;
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
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [processing, setProcessing] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [lastChange, setLastChange] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [tenderedAmount, setTenderedAmount] = useState("");
  const [mpesaPhonePos, setMpesaPhonePos] = useState("");
  const [mpesaPending, setMpesaPending] = useState<{ orderId: number; phone: string } | null>(null);
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
  const [page, setPage] = useState(1);
  const [serialModal, setSerialModal] = useState<Product | null>(null);
  const [serialInput, setSerialInput] = useState("");
  const [serialMsg, setSerialMsg] = useState<StatusMessage | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const customerRef = useRef<HTMLDivElement>(null);
  const serialInputRef = useRef<HTMLInputElement>(null);
  const idempotencyKeyRef = useRef<string>("");

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
    setPage(1);
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
    if (mpesaPending) return;
    if (typeof product.stockOnHand === "number" && product.stockOnHand <= 0) return;
    if (product.serialTracking) {
      setSerialModal(product);
      setSerialInput("");
      setSerialMsg(null);
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
        setStatus(null);
        if (product.serialTracking) {
          setSerialModal(product);
          setSerialInput("");
          setSerialMsg({ text: "Barcode found — now scan serial number(s).", kind: "info" });
          return;
        }
        addToCart(product);
        return;
      }
    } catch { /* not a barcode — try serial below */ }
    try {
      const serial = await api<any>(`/api/serials/lookup/${encodeURIComponent(code)}`);
      if (serial && serial.product_id) {
        setStatus(null);
        addSerialToCart(serial.product_id, serial.serial_number);
        return;
      }
    } catch { /* not a serial either */ }
    setStatus({ text: "Not found: " + code, kind: "error" });
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
      if (!serial || !serial.product_id) { setSerialMsg({ text: "Serial not found.", kind: "error" }); return; }
      if (serial.product_id !== serialModal.id) { setSerialMsg({ text: `That serial belongs to ${serial.product_name || "another product"}.`, kind: "error" }); return; }
      if (serial.status === "sold" || serial.status === "void") { setSerialMsg({ text: "That serial is no longer available.", kind: "error" }); return; }
      addSerialToCart(serialModal.id, serial.serial_number);
      setSerialInput("");
      setSerialMsg({ text: `Added ${serial.serial_number}.`, kind: "success" });
    } catch {
      setSerialMsg({ text: "Serial not found.", kind: "error" });
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
    if (mpesaPending) return;
    if (qty <= 0) { setCart((prev) => prev.filter((i) => i.productId !== productId)); return; }
    setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, quantity: qty, lineTotal: qty * i.price } : i));
  }

  const subtotal = cart.reduce((s, i) => s + i.lineTotal, 0);
  const change = needsTender && Number(tenderedAmount) > subtotal ? Number(tenderedAmount) - subtotal : 0;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PER_PAGE));
  const clampedPage = Math.min(page, totalPages);
  const visibleProducts = filtered.slice((clampedPage - 1) * PRODUCTS_PER_PAGE, clampedPage * PRODUCTS_PER_PAGE);

  function validateCheckout(): string | null {
    for (const item of cart) {
      if (item.serialTracking && (item.serials || []).length !== item.quantity) {
        return `Scan ${item.quantity} serial number(s) for ${item.name}.`;
      }
    }
    if (needsTender && !tenderedAmount) return "Enter amount tendered.";
    if (needsTender && Number(tenderedAmount) < subtotal) return "Insufficient amount.";
    if (paymentMethod === "mpesa" && !mpesaPhonePos.trim()) return "Enter M-Pesa phone number.";
    return null;
  }

  function completeSale(orderId: number, changeAmt: number) {
    setLastOrderId(orderId);
    setLastChange(changeAmt);
    setStatus({ text: "Sale completed!", kind: "success" });
    setCart([]);
    setTenderedAmount("");
    setMpesaPhonePos("");
    setSelectedCustomer(null);
    setCustomerQuery("");
    setMpesaPending(null);
    idempotencyKeyRef.current = "";
  }

  async function checkout(idempotencyKey: string) {
    setProcessing(true);
    setStatus(null);
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
      const res = await api<{ order: { id: number }; change: number; mpesa?: { status: "pending" | "failed" | "disabled"; checkoutRequestId?: string | null } }>("/api/pos/checkout", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (paymentMethod === "mpesa" && res.mpesa?.status === "pending") {
        setMpesaPending({ orderId: res.order.id, phone: mpesaPhonePos.trim() });
        setStatus({ text: `M-Pesa prompt sent to ${mpesaPhonePos.trim()} — ask the customer to enter their PIN.`, kind: "info" });
        return;
      }
      if (paymentMethod === "mpesa") {
        setMpesaPending({ orderId: res.order.id, phone: mpesaPhonePos.trim() });
        setStatus({ text: "M-Pesa prompt failed to send. Retry the push or switch to cash.", kind: "error" });
        return;
      }
      completeSale(res.order.id, res.change || 0);
    } catch (e: any) { setStatus({ text: e.message || "Checkout failed.", kind: "error" }); }
    finally { setProcessing(false); }
  }

  async function requestCheckout() {
    if (cart.length === 0) return;
    const problem = validateCheckout();
    if (problem) { setStatus({ text: problem, kind: "error" }); return; }
    const pmtName = pmtConfig?.name || paymentMethod;
    const changePreview = needsTender && Number(tenderedAmount) > subtotal ? Number(tenderedAmount) - subtotal : 0;
    const ok = await confirmDialog({
      title: "Confirm sale",
      message: `Charge ${formatPrice(subtotal)} via ${pmtName}.${changePreview > 0 ? ` Change due: ${formatPrice(changePreview)}.` : ""} This will deduct stock and cannot be undone.`,
      confirmLabel: "Charge",
    });
    if (!ok) return;
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }
    await checkout(idempotencyKeyRef.current);
  }

  async function retryMpesaPush() {
    if (!mpesaPending) return;
    await checkout(idempotencyKeyRef.current);
  }

  async function confirmMpesaPayment() {
    if (!mpesaPending) return;
    setProcessing(true);
    try {
      const st = await api<{ paid: boolean; status: string; mpesaReceipt: string | null }>(`/api/pos/orders/${mpesaPending.orderId}/payment-status`);
      if (st.paid) {
        completeSale(mpesaPending.orderId, 0);
      } else {
        setStatus({ text: "Payment not confirmed yet. Check the customer's phone, then try again.", kind: "error" });
      }
    } catch (e: any) { setStatus({ text: e.message || "Could not verify payment.", kind: "error" }); }
    finally { setProcessing(false); }
  }

  async function switchToCash() {
    if (!mpesaPending) return;
    const amount = await promptDialog({
      title: "Switch to cash",
      message: `Order #${mpesaPending.orderId} — total ${formatPrice(subtotal)}. Enter the cash received.`,
      label: "Cash received",
      defaultValue: String(subtotal),
      confirmLabel: "Mark paid",
    });
    if (amount === null) return;
    const tendered = Number(amount);
    if (Number.isNaN(tendered) || tendered < 0) { setStatus({ text: "Invalid amount.", kind: "error" }); return; }
    setProcessing(true);
    try {
      const res = await api<{ change: number }>(`/api/pos/orders/${mpesaPending.orderId}/pay-cash`, {
        method: "POST",
        body: JSON.stringify({ tenderedAmount: tendered }),
      });
      completeSale(mpesaPending.orderId, res.change || 0);
    } catch (e: any) { setStatus({ text: e.message || "Could not switch to cash.", kind: "error" }); }
    finally { setProcessing(false); }
  }

  useEffect(() => {
    if (cart.length === 0) idempotencyKeyRef.current = "";
  }, [cart]);

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
          <input ref={searchRef} type="text" className="input" placeholder="Search products or scan barcode / serial..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const q = search.trim(); if (!q || mpesaPending) return; if (filtered.length === 1) { addToCart(filtered[0]); setSearch(""); return; } if (filtered.length > 1) { setStatus({ text: "Matches more than one product — scan barcode or refine search.", kind: "info" }); return; } handleScan(q); setSearch(""); } }} style={{ flex: 1, fontSize: "1.1rem" }} autoFocus disabled={!!mpesaPending} />
          <button type="button" onClick={toggleDark} aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.3rem 0.6rem", cursor: "pointer", fontSize: "0.85rem", color: "var(--text)", lineHeight: 1, whiteSpace: "nowrap" }}>{isDark ? "☀️" : "🌙"}</button>
        </div>
        <div className="pos-product-grid">
          {visibleProducts.map((p) => {
            const outOfStock = typeof p.stockOnHand === "number" && p.stockOnHand <= 0;
            return (
            <button key={p.id} type="button" className="panel" disabled={outOfStock || !!mpesaPending} style={{ cursor: outOfStock ? "not-allowed" : "pointer", textAlign: "left", padding: "0.5rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", opacity: outOfStock ? 0.5 : 1 }} onClick={() => addToCart(p)} aria-disabled={outOfStock}>
              {p.imageUrl ? <img src={p.imageUrl} alt={p.name} style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 4, marginBottom: "0.35rem" }} /> : <div style={{ width: "100%", height: 100, background: "var(--bg)", borderRadius: 4, marginBottom: "0.35rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", opacity: 0.3 }}>{escapeHtml(p.name.charAt(0))}</div>}
              <div style={{ fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text)" }}>{escapeHtml(p.name)}</div>
              <div style={{ fontSize: "0.9rem", color: "var(--primary)" }}>
                {p.salePrice ? <><span style={{ textDecoration: "line-through", color: "var(--muted)", fontSize: "0.85em" }}>{formatPrice(p.price)}</span> <span style={{ color: "var(--success)", fontWeight: 700 }}>{formatPrice(p.salePrice)}</span></> : formatPrice(p.price)}
              </div>
              {typeof p.stockOnHand === "number" && (
                <div style={{ fontSize: "0.7rem", color: p.stockOnHand <= 0 ? "var(--danger)" : p.stockOnHand <= 5 ? "var(--warning)" : "var(--text-secondary)", marginTop: 2 }}>
                  {p.stockOnHand <= 0 ? "Out of stock" : `Stock: ${p.stockOnHand}`}
                </div>
              )}
            </button>
            );
          })}
          {filtered.length === 0 && <p className="muted" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "2rem" }}>No products found.</p>}
        </div>
        {totalPages > 1 && (
          <div className="pos-pagination">
            <button type="button" className="btn btn-sm btn-ghost" disabled={clampedPage <= 1} onClick={() => setPage(clampedPage - 1)}>Prev</button>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Page {clampedPage} of {totalPages} · {filtered.length} items</span>
            <button type="button" className="btn btn-sm btn-ghost" disabled={clampedPage >= totalPages} onClick={() => setPage(clampedPage + 1)}>Next</button>
          </div>
        )}
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
                        <button type="button" onClick={() => removeSerial(item.productId, sn)} disabled={!!mpesaPending} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontWeight: 700, padding: 0, lineHeight: 1 }} title="Remove serial">&times;</button>
                      </span>
                    ))}
                    {(item.serials || []).length === 0 && <span style={{ fontSize: "0.75rem", color: "var(--danger)" }}>Scan serial number(s)</span>}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                {item.serialTracking ? (
                  <>
                    <button className="btn btn-sm btn-ghost" onClick={() => removeSerial(item.productId, (item.serials || [])[(item.serials || []).length - 1])} disabled={(item.serials || []).length === 0 || !!mpesaPending}>&minus;</button>
                    <span style={{ width: 28, textAlign: "center", fontWeight: 600 }}>{item.quantity}</span>
                    <button className="btn btn-sm btn-ghost" onClick={() => { const p = products.find((x) => x.id === item.productId); if (p) addToCart(p); }} disabled={!!mpesaPending}>+</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-sm btn-ghost" onClick={() => updateQty(item.productId, item.quantity - 1)} disabled={!!mpesaPending}>&minus;</button>
                    <span style={{ width: 28, textAlign: "center", fontWeight: 600 }}>{item.quantity}</span>
                    <button className="btn btn-sm btn-ghost" onClick={() => updateQty(item.productId, item.quantity + 1)} disabled={!!mpesaPending}>+</button>
                  </>
                )}
              </div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", minWidth: 80, textAlign: "right" }}>{formatPrice(item.lineTotal)}</div>
            </div>
          ))}
        </div>

        {!lastOrderId && !mpesaPending && (
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
          {change > 0 && !lastOrderId && !mpesaPending && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--success)" }}>
              <span>Change</span>
              <span>{formatPrice(change)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            <span>Total</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          {status && <p role="status" style={{ fontSize: "0.85rem", marginBottom: "0.5rem", color: status.kind === "error" ? "var(--danger)" : status.kind === "info" ? "var(--text-secondary)" : "var(--success)" }}>{status.text}</p>}
          {mpesaPending && !lastOrderId && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.6rem 0.75rem", marginBottom: "0.5rem", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)" }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>Awaiting M-Pesa payment — Order #{mpesaPending.orderId}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Prompt sent to {mpesaPending.phone}. Ask the customer to enter their M-Pesa PIN. The cart stays locked until payment is confirmed.</div>
              <button className="btn btn-sm btn-primary" onClick={confirmMpesaPayment} disabled={processing} style={{ justifyContent: "center" }}>{processing ? "Checking..." : "Payment confirmed"}</button>
              <button className="btn btn-sm btn-ghost" onClick={retryMpesaPush} disabled={processing} style={{ justifyContent: "center" }}>Retry M-Pesa prompt</button>
              <button className="btn btn-sm btn-ghost" onClick={switchToCash} disabled={processing} style={{ justifyContent: "center" }}>Switch to cash</button>
            </div>
          )}
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
                    setStatus({ text: err.message || "Download failed.", kind: "error" });
                  } finally {
                    setDownloadingPdf(false);
                  }
                }}
              >
                {downloadingPdf ? "Saving..." : "Save PDF"}
              </button>
              <button
                className="btn btn-ghost btn-block"
                style={{ textAlign: "center", fontSize: "0.95rem", padding: "0.5rem" }}
                onClick={() => {
                  window.open(`/api/pos/receipt/${lastOrderId}?allowQueryToken=1&token=${encodeURIComponent(getTokenForRole() || "")}`, "_blank");
                }}
              >
                Print Receipt (80mm)
              </button>
              <button
                className="btn btn-ghost btn-block"
                style={{ textAlign: "center", fontSize: "0.95rem", padding: "0.5rem" }}
                onClick={() => {
                  window.open(`/api/pos/receipt/${lastOrderId}?format=a4&allowQueryToken=1&token=${encodeURIComponent(getTokenForRole() || "")}`, "_blank");
                }}
              >
                Print Invoice (A4)
              </button>
              <button className="btn btn-ghost btn-block" onClick={() => { setLastOrderId(null); setStatus(null); setLastChange(0); }} style={{ fontSize: "0.9rem", padding: "0.4rem" }}>
                New Sale
              </button>
            </div>
          ) : (
            <button className="btn btn-primary btn-block" onClick={requestCheckout} disabled={cart.length === 0 || processing || !!mpesaPending} style={{ fontSize: "1.1rem", padding: "0.75rem" }}>
              {processing ? "Processing..." : `Charge ${formatPrice(subtotal)}`}
            </button>
          )}
        </div>
      </div>

      {serialModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="serial-dialog-title"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setSerialModal(null)}
          onKeyDown={(e) => { if (e.key === "Escape") setSerialModal(null); }}
        >
          <div className="panel" style={{ width: "min(420px, 92vw)", padding: "1.25rem" }} onClick={(e) => e.stopPropagation()}>
            <h3 id="serial-dialog-title" style={{ marginTop: 0, marginBottom: "0.25rem" }}>Scan serial number</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
              {serialModal.name} — scan each unit's serial (scanner or type + Enter).
            </p>
            <label htmlFor="serial-input" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.35rem" }}>Serial number</label>
            <input
              ref={serialInputRef}
              id="serial-input"
              type="text"
              className="input"
              placeholder="Serial number..."
              value={serialInput}
              onChange={(e) => setSerialInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitSerial(); } if (e.key === "Escape") { e.preventDefault(); setSerialModal(null); } }}
              style={{ width: "100%", fontSize: "1.05rem", marginBottom: "0.5rem" }}
            />
            {serialMsg && <p role="status" style={{ fontSize: "0.85rem", marginBottom: "0.5rem", color: serialMsg.kind === "error" ? "var(--danger)" : serialMsg.kind === "info" ? "var(--text-secondary)" : "var(--success)" }}>{serialMsg.text}</p>}
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