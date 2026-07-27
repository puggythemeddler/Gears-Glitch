import React, { useEffect, useState, useRef } from "react";
import { api, getRole, getCustomerToken, getProviderToken, clearAllSessions } from "@/lib/api";
import type { Order, RepairTicket, WishlistItem, Message, Quote } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { useFeature } from "@/lib/features";

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);
}

function escapeHtml(v: string) { const d = document.createElement("div"); d.textContent = v; return d.innerHTML; }

type Section = "overview" | "orders" | "repairs" | "wishlist" | "messages" | "sales" | "invoices" | "profile";

export default function DashboardPage() {
  const [role, setRole] = useState<"customer" | "provider" | null>(null);
  const [userName, setUserName] = useState("");
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [orders, setOrders] = useState<Order[]>([]);
  const [repairs, setRepairs] = useState<RepairTicket[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [sales, setSales] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [msgComposeOpen, setMsgComposeOpen] = useState(false);
  const [repairFormOpen, setRepairFormOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [selectedMsgKey, setSelectedMsgKey] = useState<string | null>(null);
  const { toast } = useToast();
  const [salesFrom, setSalesFrom] = useState(() => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [salesTo, setSalesTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const isCustomer = role === "customer";
  const isProvider = role === "provider";
  const featureFlags: Record<string, boolean> = {
    "Messaging": useFeature("Messaging"),
    "Repair ticketing": useFeature("Repair ticketing"),
    "Order management": useFeature("Order management"),
    "Invoice/quote PDF downloads": useFeature("Invoice/quote PDF downloads"),
    "Product reviews & ratings": useFeature("Product reviews & ratings"),
    "Quotations": useFeature("Quotations"),
  };
  const hasFeature = (f?: string) => !f || featureFlags[f] === true;

  useEffect(() => {
    const r = getRole();
    if (!r || r === "staff") {
      window.location.href = "/login";
      return;
    }
    setRole(r);
    const name = localStorage.getItem(r === "customer" ? "customerStoreName" : "providerStoreName") || r;
    setUserName(name);
  }, []);

  useEffect(() => {
    if (!role) return;
    if (isCustomer) {
      loadOrders();
      loadRepairs();
      loadWishlist();
      loadQuotes();
    }
    if (isProvider) {
      loadSales();
    }
    loadMessages().then((c) => { prevMsgCountRef.current = c; });
    loadProfile();
  }, [role]);

  const prevMsgCountRef = useRef(0);

  useEffect(() => {
    if (!role) return;
    const interval = setInterval(async () => {
      try {
        const newCount = await loadMessages();
        if (newCount > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
          const diff = newCount - prevMsgCountRef.current;
          toast("info", `${diff} new message${diff > 1 ? "s" : ""}`);
        }
        prevMsgCountRef.current = newCount;
      } catch {}
    }, 30000);
    return () => clearInterval(interval);
  }, [role]);

  async function loadOrders() {
    try { const d = await api<{ orders: Order[] }>("/api/orders"); setOrders(d.orders || []); } catch { setOrders([]); }
  }

  async function loadRepairs() {
    try { const d = await api<{ tickets: RepairTicket[] }>("/api/repairs/mine"); setRepairs(d.tickets || []); } catch { setRepairs([]); }
  }

  async function loadWishlist() {
    try { const d = await api<{ items: WishlistItem[] }>("/api/wishlist"); setWishlist(d.items || []); } catch { setWishlist([]); }
  }

  async function loadQuotes() {
    try { const d = await api<{ quotes: Quote[] }>("/api/quotes"); setQuotes(d.quotes || []); } catch { setQuotes([]); }
  }

  async function loadMessages() {
    const endpoint = isCustomer ? "/api/messages" : "/api/provider/messages";
    try {
      const d = await api<{ messages: any[] }>(endpoint);
      const msgs = d.messages || [];
      setMessages(msgs);
      return msgs.length;
    } catch { setMessages([]); return 0; }
  }

  async function loadSales() {
    try { const d = await api<any>(`/api/provider/sales?from=${encodeURIComponent(salesFrom)}&to=${encodeURIComponent(salesTo)}`); setSales(d); } catch { setSales(null); }
  }

  async function loadProfile() {
    const endpoint = isCustomer ? "/api/customer/me" : "/api/provider/me";
    try { const d = await api(endpoint); setProfile(d); } catch { setProfile(null); }
  }

  function logout() {
    clearAllSessions();
    window.location.href = "/";
  }

  const sections: { key: Section; label: string; show: boolean; feature?: string }[] = [
    { key: "overview", label: "Overview", show: true },
    { key: "orders", label: "Orders", show: isCustomer, feature: "Order management" },
    { key: "repairs", label: "Repairs", show: isCustomer, feature: "Repair ticketing" },
    { key: "wishlist", label: "Wishlist", show: isCustomer },
    { key: "messages", label: "Messages", show: true, feature: "Messaging" },
    { key: "sales", label: "Sales Report", show: isProvider, feature: "Order management" },
    { key: "invoices", label: "Invoices", show: isProvider, feature: "Invoice/quote PDF downloads" },
    { key: "profile", label: "Profile", show: true },
  ];

  const visibleSections = sections.filter((s) => s.show && hasFeature(s.feature));

  return (
    <div className="dash-layout">
      <nav className="dash-nav">
        {visibleSections.map((s) => (
          <button
            key={s.key}
            className={activeSection === s.key ? "active" : ""}
            onClick={() => setActiveSection(s.key)}
          >
            {s.label}
          </button>
        ))}
        {isProvider && <button onClick={() => window.location.href = "/pos"} style={{ color: "var(--primary)" }}>POS</button>}
        <button onClick={logout} style={{ marginTop: "auto", color: "var(--primary)" }}>Sign out</button>
      </nav>

      <div className="dash-content">
        {/* OVERVIEW */}
        {activeSection === "overview" && (
          <div className="dash-section active">
            <h1>Welcome, {userName}</h1>
            <p className="page-intro">{isProvider ? "View your sales report and manage your profile." : "Manage your orders, repairs, and messages."}</p>
            <div className="stat-grid">
              {isCustomer && (
                <>
                  <div className="stat-card"><div className="stat-card__value">{orders.length}</div><div className="stat-card__label">Orders</div></div>
                  <div className="stat-card"><div className="stat-card__value">{repairs.length}</div><div className="stat-card__label">Repairs</div></div>
                  <div className="stat-card"><div className="stat-card__value">{wishlist.length}</div><div className="stat-card__label">Wishlist</div></div>
                </>
              )}
              {isProvider && (
                <>
                  <div className="stat-card"><div className="stat-card__value">{sales?.totalOrders ?? 0}</div><div className="stat-card__label">Total Orders</div></div>
                  <div className="stat-card"><div className="stat-card__value">{formatPrice(sales?.totalRevenue ?? 0)}</div><div className="stat-card__label">Revenue</div></div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ORDERS */}
        {activeSection === "orders" && (
          <div className="dash-section active">
            <h2>My orders</h2>
            {orders.length === 0 ? <p className="muted">No orders yet.</p> : (
              orders.map((o) => (
                <a key={o.id} href={`/order?id=${o.id}`} className="order-item" style={{ display: "block", textDecoration: "none", color: "inherit", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.5rem", flexWrap: "wrap" }}>
                    <div>
                      <strong>Order #{o.id}</strong> <span className="plan-status">{o.status}</span>
                    </div>
                    <span className="muted">{new Date(o.createdAt).toLocaleDateString("en-GB")}</span>
                  </div>
                  <p className="muted" style={{ fontSize: "0.9rem" }}>{formatPrice(o.total || o.subtotal + (o.shippingFee || 0))} — {o.items?.length || 0} item(s)</p>
                </a>
              ))
            )}
          </div>
        )}

        {/* REPAIRS */}
        {activeSection === "repairs" && (
          <div className="dash-section active">
            <h2>My repairs</h2>
            {repairs.length === 0 ? <p className="muted">No repair tickets.</p> : (
              repairs.map((t) => (
                <a key={t.id} href={`/repair-ticket?id=${t.id}`} className="order-item" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.5rem" }}>
                    <div>
                      <strong>{escapeHtml(t.deviceType)}</strong>
                      {t.deviceModel ? ` — ${escapeHtml(t.deviceModel)}` : ""}
                      <span className="plan-status">{escapeHtml(t.status)}</span>
                    </div>
                    <span className="muted">{new Date(t.createdAt).toLocaleDateString("en-GB")}</span>
                  </div>
                  <p className="muted" style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>{escapeHtml(t.issueDescription)}</p>
                </a>
              ))
            )}
            <h3 style={{ marginTop: "2rem" }}>Request a repair</h3>
            <button className="btn" onClick={() => window.location.href = "/repair-book"}>Book a repair</button>
          </div>
        )}

        {/* WISHLIST */}
        {activeSection === "wishlist" && (
          <div className="dash-section active">
            <h2>My wishlist</h2>
            {wishlist.length === 0 ? <p className="muted">Your wishlist is empty. <a href="/">Browse products</a>.</p> : (
              <>
                {wishlist.slice(0, 10).map((item) => (
                  <div key={item.productId} className="wishlist-item" style={{ marginBottom: "0.5rem" }}>
                    <div className="wishlist-item__info">
                      <div className="wishlist-item__name"><a href={`/product?id=${encodeURIComponent(item.productId)}`}>{escapeHtml(item.productName || item.productId)}</a></div>
                      {item.productPrice != null && <div className="wishlist-item__price">{formatPrice(item.productPrice)}</div>}
                    </div>
                  </div>
                ))}
                <a href="/wishlist" className="btn btn-secondary">Full wishlist</a>
              </>
            )}
          </div>
        )}

        {/* MESSAGES */}
        {activeSection === "messages" && (
          <div className="dash-section active">
            {!messagingEnabled ? <p className="muted">Messaging is not included in your current plan.</p> : <><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>Messages</h2>
              <button className="btn btn-sm btn-secondary" onClick={() => setMsgComposeOpen(!msgComposeOpen)}>
                {msgComposeOpen ? "Cancel" : "New message"}
              </button>
            </div>
            {msgComposeOpen && <MessageCompose isCustomer={isCustomer} onSent={() => { setMsgComposeOpen(false); loadMessages(); }} />}

            {messages.length === 0 ? <p className="muted">No messages.</p> : (
              (() => {
                // Group by conversation partner
                const groups = new Map<string, any[]>();
                for (const m of messages) {
                  const key = isCustomer ? `p-${m.provider_id}` : `c-${m.customer_id}`;
                  if (!groups.has(key)) groups.set(key, []);
                  groups.get(key)!.push(m);
                }

                // Sort conversations by latest message
                const convos = [...groups.entries()].map(([key, msgs]) => {
                  msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                  const latest = msgs[msgs.length - 1];
                  const partner = isCustomer ? (latest.providerName || "Provider") : (latest.customerName || "Customer");
                  return { key, msgs, latest, partner, unread: msgs.filter((m) => !m.read_at && (isCustomer ? m.sender_role === "provider" : m.sender_role === "customer")).length };
                });
                convos.sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime());

                const activeConvo = convos.find((c) => c.key === selectedMsgKey);

                // Mark read helper
                async function markRead(msgs: any[]) {
                  const unread = msgs.filter((m) => !m.read_at);
                  for (const m of unread) {
                    try { await api(`/api/messages/${m.id}/read`, { method: "PATCH" }); } catch {}
                  }
                  if (unread.length) loadMessages();
                }

                function selectConvo(key: string, msgs: any[]) {
                  setSelectedMsgKey(key);
                  setReplyBody("");
                  markRead(msgs);
                }

                return (
                  <div className="order-item" style={{ display: "flex", gap: "1rem", padding: 0, minHeight: "55vh" }}>
                    {/* Conversation list */}
                    <div style={{ width: 260, borderRight: "1px solid var(--border)", overflowY: "auto", flexShrink: 0 }}>
                      {convos.map((c) => (
                        <div key={c.key} onClick={() => selectConvo(c.key, c.msgs)} style={{
                          padding: "0.75rem 1rem",
                          cursor: "pointer",
                          borderBottom: "1px solid var(--border)",
                          background: selectedMsgKey === c.key ? "var(--primary)" : "transparent",
                          color: selectedMsgKey === c.key ? "#fff" : "var(--text)",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <strong style={{ fontSize: "0.9rem" }}>{escapeHtml(c.partner)}</strong>
                            {c.unread > 0 && <span style={{
                              background: selectedMsgKey === c.key ? "#fff" : "var(--primary)",
                              color: selectedMsgKey === c.key ? "var(--primary)" : "#fff",
                              borderRadius: 999, padding: "0.1rem 0.5rem", fontSize: "0.75rem", fontWeight: 600
                            }}>{c.unread}</span>}
                          </div>
                          <div style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {escapeHtml(c.latest.body)}
                          </div>
                          <div style={{ fontSize: "0.7rem", opacity: 0.5, marginTop: "0.15rem" }}>
                            {new Date(c.latest.created_at).toLocaleString("en-GB")}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Chat area */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                      {!activeConvo ? (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4 }}>
                          Select a conversation
                        </div>
                      ) : (
                        <>
                          <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>
                            {escapeHtml(activeConvo.partner)}
                          </div>
                          <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {activeConvo.msgs.map((m) => {
                              const isMe = isCustomer ? m.sender_role === "customer" : m.sender_role === "provider";
                              return (
                                <div key={m.id} style={{
                                  alignSelf: isMe ? "flex-end" : "flex-start",
                                  maxWidth: "75%",
                                  background: isMe ? "var(--primary)" : "var(--surface)",
                                  color: isMe ? "#fff" : "var(--text)",
                                  borderRadius: "12px",
                                  padding: "0.6rem 1rem",
                                  border: isMe ? "none" : "1px solid var(--border)",
                                }}>
                                  <div style={{ fontSize: "0.9rem" }}>{escapeHtml(m.body)}</div>
                                  <div style={{ fontSize: "0.7rem", marginTop: "0.25rem", textAlign: "right", opacity: 0.7 }}>
                                    {new Date(m.created_at).toLocaleString("en-GB")}
                                    {isMe && (m.read_at ? <span style={{ marginLeft: "0.5rem" }}>✓ Read</span> : <span style={{ marginLeft: "0.5rem" }}>●</span>)}
                                    {!isMe && !m.read_at && <span style={{ marginLeft: "0.5rem" }}>●</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (!replyBody.trim()) return;
                            try {
                              const endpoint = isCustomer ? "/api/messages" : "/api/provider/messages";
                              const latest = activeConvo.latest;
                              const payload: any = { subject: latest.subject || "", body: replyBody };
                              if (isCustomer) payload.providerId = latest.provider_id;
                              else payload.customerId = latest.customer_id;
                              await api(endpoint, { method: "POST", body: JSON.stringify(payload) });
                              setReplyBody("");
                              loadMessages();
                            } catch (err: any) { toast("error", err.message); }
                          }} style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--border)", display: "flex", gap: "0.5rem" }}>
                            <textarea rows={1} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Type a message..." required style={{ flex: 1, resize: "none" }} />
                            <button type="submit" className="btn btn-sm">Send</button>
                          </form>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()
            )}
          </>}
          </div>
        )}

        {/* SALES REPORT */}
        {activeSection === "sales" && (
          <div className="dash-section active">
            <h2>Sales Report</h2>
            <div className="panel" style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "end", flexWrap: "wrap" }}>
              <div className="field" style={{ margin: 0 }}><label>From<input type="date" value={salesFrom} onChange={(e) => setSalesFrom(e.target.value)} /></label></div>
              <div className="field" style={{ margin: 0 }}><label>To<input type="date" value={salesTo} onChange={(e) => setSalesTo(e.target.value)} /></label></div>
              <button className="btn" onClick={loadSales}>Generate</button>
            </div>
            {sales ? (
              <>
                <div className="stat-grid" style={{ marginBottom: "1rem" }}>
                  <div className="stat-card"><div className="stat-card__value">{sales.totalOrders}</div><div className="stat-card__label">Orders</div></div>
                  <div className="stat-card"><div className="stat-card__value">{formatPrice(sales.totalRevenue)}</div><div className="stat-card__label">Revenue</div></div>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>#</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>
                      {(sales.orders || []).map((o: any) => (
                        <tr key={o.id}>
                          <td>{o.id}</td>
                          <td>{escapeHtml(o.customer_name || "—")}</td>
                          <td>{formatPrice((o.subtotal || 0) + (o.shipping_fee || 0))}</td>
                          <td><span className="plan-status">{o.status}</span></td>
                          <td style={{ whiteSpace: "nowrap", fontSize: "0.85rem" }}>{new Date(o.created_at).toLocaleDateString("en-GB")}</td>
                        </tr>
                      ))}
                      {(!sales.orders || sales.orders.length === 0) && <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem", opacity: 0.5 }}>No orders found.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            ) : <p className="muted">Select a date range and click Generate.</p>}
          </div>
        )}

        {/* INVOICES */}
        {activeSection === "invoices" && (
          <div className="dash-section active">
            <h2>Invoices</h2>
            {sales ? (
              (sales.orders || []).length === 0 ? <p className="muted">No invoices yet.</p> : (
                (sales.orders || []).map((o: any) => (
                  <div key={o.id} className="order-item">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                      <div>
                        <strong>Invoice #ORD-{o.id}</strong> — {escapeHtml(o.customer_name || "—")}
                        <br /><span className={`plan-status ${o.status}`}>{o.status}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <strong>{formatPrice((o.subtotal || 0) + (o.shipping_fee || 0))}</strong>
                        <br /><span className="muted" style={{ fontSize: "0.8rem" }}>{new Date(o.created_at).toLocaleDateString("en-GB")}</span>
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : <p className="muted">Visit Sales Report first to load data.</p>}
          </div>
        )}

        {/* PROFILE */}
        {activeSection === "profile" && (
          <div className="dash-section active">
            <h2>Profile</h2>
            {profile ? (
              isCustomer ? (
                <CustomerProfileForm profile={profile} onSaved={(p) => setProfile(p)} />
              ) : (
                <ProviderProfileForm profile={profile} onSaved={(p) => setProfile(p)} />
              )
            ) : <p className="muted">Loading profile...</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function CustomerProfileForm({ profile, onSaved }: { profile: any; onSaved: (p: any) => void }) {
  const [name, setName] = useState(profile.name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaved(false); setSaving(true);
    try {
      const result = await api("/api/customer/me", { method: "PUT", body: JSON.stringify({ name, phone }) });
      setSaved(true);
      onSaved(result.customer);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword) { setError("Both password fields are required."); return; }
    setError(""); setSaved(false); setSaving(true);
    try {
      await api("/api/customer/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
      setSaved(true);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ maxWidth: 400 }}>
      <form onSubmit={handleSave} className="auth-form">
        <h3>Account details</h3>
        <div className="field"><label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label></div>
        <div className="field"><label>Email<input value={profile.email || ""} disabled style={{ opacity: 0.6 }} /></label></div>
        <div className="field"><label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label></div>
        {error && <p className="error">{error}</p>}
        {saved && <p style={{ color: "var(--success, #16a34a)" }}>Profile updated.</p>}
        <button className="btn" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
      </form>
      <form onSubmit={handlePasswordChange} className="auth-form" style={{ marginTop: "2rem" }}>
        <h3>Change password</h3>
        <div className="field"><label>Current password<input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></label></div>
        <div className="field"><label>New password<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} /></label></div>
        <button className="btn" disabled={saving}>{saving ? "Updating..." : "Change password"}</button>
      </form>
    </div>
  );
}

function ProviderProfileForm({ profile, onSaved }: { profile: any; onSaved: (p: any) => void }) {
  const [companyName, setCompanyName] = useState(profile.companyName || profile.company_name || "");
  const [contactName, setContactName] = useState(profile.contactName || profile.contact_name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaved(false); setSaving(true);
    try {
      const result = await api("/api/provider/me", { method: "PUT", body: JSON.stringify({ companyName, contactName, phone }) });
      setSaved(true);
      onSaved(result.provider);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" style={{ maxWidth: 400 }}>
      <div className="field"><label>Company name<input value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></label></div>
      <div className="field"><label>Contact name<input value={contactName} onChange={(e) => setContactName(e.target.value)} /></label></div>
      <div className="field"><label>Email<input value={profile.email || ""} disabled style={{ opacity: 0.6 }} /></label></div>
      <div className="field"><label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label></div>
      {error && <p className="error">{error}</p>}
      {saved && <p style={{ color: "var(--success, #16a34a)" }}>Profile updated.</p>}
      <button className="btn" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
    </form>
  );
}

function MessageCompose({ isCustomer, onSent }: { isCustomer: boolean; onSent: () => void }) {
  const [recipientId, setRecipientId] = useState("");
  const [recipients, setRecipients] = useState<{ id: number; name: string }[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isCustomer) {
      api<{ providers: { id: number; company_name: string; contact_name: string }[] }>("/api/messages/providers")
        .then((d) => setRecipients((d.providers || []).map((p) => ({ id: p.id, name: p.company_name || p.contact_name || `Provider #${p.id}` }))))
        .catch(() => {});
    } else {
      api<{ customers: { id: number; name: string }[] }>("/api/provider/messages/customers")
        .then((d) => setRecipients((d.customers || []).map((c) => ({ id: c.id, name: c.name || `Customer #${c.id}` }))))
        .catch(() => {});
    }
  }, [isCustomer]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !recipientId) return;
    setError("");
    setSending(true);
    try {
      const endpoint = isCustomer ? "/api/messages" : "/api/provider/messages";
      const payload = isCustomer
        ? { providerId: Number(recipientId), subject, body }
        : { customerId: Number(recipientId), subject, body };
      await api(endpoint, { method: "POST", body: JSON.stringify(payload) });
      onSent();
    } catch (err: any) { setError(err.message); }
    finally { setSending(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: "1rem" }}>
      <div className="field">
        <label>{isCustomer ? "Provider" : "Customer"}</label>
        <select value={recipientId} onChange={(e) => setRecipientId(e.target.value)} required>
          <option value="">Select {isCustomer ? "a provider" : "a customer"}…</option>
          {recipients.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Subject</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div className="field">
        <label>Message</label>
        <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} required />
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={sending || !recipientId}>{sending ? "Sending..." : "Send"}</button>
    </form>
  );
}
