import React, { useEffect, useState, useRef } from "react";
import { api, getRole, clearAllSessions } from "@/lib/api";
import type { Order, RepairTicket, WishlistItem, Message, Quote } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { useFeature } from "@/lib/features";
import { escapeHtml } from "@/lib/sanitize";
import { usePageTitle } from "@/lib/use-page-title";
import { useApp } from "@/lib/app-context";

type Section = "overview" | "orders" | "repairs" | "wishlist" | "messages" | "profile";

export default function DashboardPage() {
  const [role, setRole] = useState<"customer" | null>(null);
  const { formatPrice } = useApp();
  usePageTitle("My account - Gear&Glitch");
  const [userName, setUserName] = useState("");
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [orders, setOrders] = useState<Order[]>([]);
  const [repairs, setRepairs] = useState<RepairTicket[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [msgComposeOpen, setMsgComposeOpen] = useState(false);
  const [repairFormOpen, setRepairFormOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [selectedMsgKey, setSelectedMsgKey] = useState<string | null>(null);
  const { toast } = useToast();
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const isCustomer = role === "customer";
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
    if (r !== "customer") {
      window.location.href = "/login";
      return;
    }
    setRole("customer");
    const name = localStorage.getItem("customerStoreName") || "Customer";
    setUserName(name);
  }, []);

  useEffect(() => {
    if (!role) return;
    loadOrders();
    loadRepairs();
    loadWishlist();
    loadQuotes();
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
    try {
      const d = await api<{ messages: any[] }>("/api/messages");
      const msgs = d.messages || [];
      setMessages(msgs);
      return msgs.length;
    } catch { setMessages([]); return 0; }
  }

  async function loadProfile() {
    try { const d = await api("/api/customer/me"); setProfile(d); } catch { setProfile(null); }
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
            aria-current={activeSection === s.key ? "page" : undefined}
          >
            {s.label}
          </button>
        ))}
        <button onClick={logout} style={{ marginTop: "auto", color: "var(--primary)" }}>Sign out</button>
      </nav>

      <div className="dash-content">
        {/* OVERVIEW */}
        {activeSection === "overview" && (
          <div className="dash-section active">
            <h1>Welcome, {userName}</h1>
            <p className="page-intro">Manage your orders, repairs, and messages.</p>
            <div className="stat-grid">
              <div className="stat-card"><div className="stat-card__value">{orders.length}</div><div className="stat-card__label">Orders</div></div>
              <div className="stat-card"><div className="stat-card__value">{repairs.length}</div><div className="stat-card__label">Repairs</div></div>
              <div className="stat-card"><div className="stat-card__value">{wishlist.length}</div><div className="stat-card__label">Wishlist</div></div>
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
            {!featureFlags["Messaging"] ? <p className="muted">Messaging is not included in your current plan.</p> : <><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>Messages</h2>
              <button className="btn btn-sm btn-secondary" onClick={() => setMsgComposeOpen(!msgComposeOpen)}>
                {msgComposeOpen ? "Cancel" : "New message"}
              </button>
            </div>
            {msgComposeOpen && <MessageCompose onSent={() => { setMsgComposeOpen(false); loadMessages(); }} />}

            {messages.length === 0 ? <p className="muted">No messages.</p> : (
              (() => {
                // Group by conversation partner
                const groups = new Map<string, any[]>();
                for (const m of messages) {
                  const key = `p-${m.provider_id}`;
                  if (!groups.has(key)) groups.set(key, []);
                  groups.get(key)!.push(m);
                }

                // Sort conversations by latest message
                const convos = [...groups.entries()].map(([key, msgs]) => {
                  msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                  const latest = msgs[msgs.length - 1];
                  const partner = latest.providerName || "Provider";
                  return { key, msgs, latest, partner, unread: msgs.filter((m) => !m.read_at && m.sender_role === "provider").length };
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
                        <button type="button" key={c.key} onClick={() => selectConvo(c.key, c.msgs)} aria-current={selectedMsgKey === c.key ? "true" : undefined} style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          fontFamily: "inherit",
                          border: "none",
                          borderTop: "none",
                          padding: "0.75rem 1rem",
                          cursor: "pointer",
                          borderBottom: "1px solid var(--border)",
                          background: selectedMsgKey === c.key ? "var(--primary)" : "transparent",
                          color: selectedMsgKey === c.key ? "var(--surface)" : "var(--text)",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <strong style={{ fontSize: "0.9rem" }}>{escapeHtml(c.partner)}</strong>
                            {c.unread > 0 && <span style={{
                              background: selectedMsgKey === c.key ? "var(--surface)" : "var(--primary)",
                              color: selectedMsgKey === c.key ? "var(--primary)" : "var(--surface)",
                              borderRadius: 999, padding: "0.1rem 0.5rem", fontSize: "0.75rem", fontWeight: 600
                            }}>{c.unread}</span>}
                          </div>
                          <div style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {escapeHtml(c.latest.body)}
                          </div>
                          <div style={{ fontSize: "0.7rem", opacity: 0.5, marginTop: "0.15rem" }}>
                            {new Date(c.latest.created_at).toLocaleString("en-GB")}
                          </div>
                        </button>
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
                              const isMe = m.sender_role === "customer";
                              return (
                                <div key={m.id} style={{
                                  alignSelf: isMe ? "flex-end" : "flex-start",
                                  maxWidth: "75%",
                                  background: isMe ? "var(--primary)" : "var(--surface)",
                                  color: isMe ? "var(--surface)" : "var(--text)",
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
                              const latest = activeConvo.latest;
                              const payload: any = { subject: latest.subject || "", body: replyBody, providerId: latest.provider_id };
                              await api("/api/messages", { method: "POST", body: JSON.stringify(payload) });
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

        {/* PROFILE */}
        {activeSection === "profile" && (
          <div className="dash-section active">
            <h2>Profile</h2>
            {profile ? (
              <CustomerProfileForm profile={profile} onSaved={(p) => setProfile(p)} />
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
        {saved && <p style={{ color: "var(--success)" }}>Profile updated.</p>}
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

function MessageCompose({ onSent }: { onSent: () => void }) {
  const [recipientId, setRecipientId] = useState("");
  const [recipients, setRecipients] = useState<{ id: number; name: string }[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api<{ providers: { id: number; company_name: string; contact_name: string }[] }>("/api/messages/providers")
      .then((d) => setRecipients((d.providers || []).map((p) => ({ id: p.id, name: p.company_name || p.contact_name || `Provider #${p.id}` }))))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !recipientId) return;
    setError("");
    setSending(true);
    try {
      await api("/api/messages", { method: "POST", body: JSON.stringify({ providerId: Number(recipientId), subject, body }) });
      onSent();
    } catch (err: any) { setError(err.message); }
    finally { setSending(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: "1rem" }}>
      <div className="field">
        <label>Provider</label>
        <select value={recipientId} onChange={(e) => setRecipientId(e.target.value)} required>
          <option value="">Select a provider…</option>
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
