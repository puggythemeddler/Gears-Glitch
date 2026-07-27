import React, { useEffect, useState } from "react";
import { api, getStaffToken } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useFeature } from "@/lib/features";

function escapeHtml(v: string) { const d = document.createElement("div"); d.textContent = v; return d.innerHTML; }

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);
}

type BackofficeView = "dashboard" | "repairs" | "calendar" | "stock";

const NAV_ITEMS: { key: BackofficeView; label: string; feature?: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "repairs", label: "Repair tickets", feature: "Repair ticketing" },
  { key: "calendar", label: "Calendar" },
  { key: "stock", label: "Stock Control", feature: "Stock take / inventory count" },
];

export default function BackofficePage() {
  const { isDark, toggleDark, settings } = useApp();
  const [authed, setAuthed] = useState(false);
  const [view, setView] = useState<BackofficeView>("dashboard");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const featureFlags: Record<string, boolean> = {
    "Messaging": useFeature("Messaging"),
    "Repair ticketing": useFeature("Repair ticketing"),
    "Stock take / inventory count": useFeature("Stock take / inventory count"),
  };
  const hasFeature = (f?: string) => !f || featureFlags[f] === true;
  const visibleNav = NAV_ITEMS.filter((i) => hasFeature(i.feature));

  useEffect(() => {
    if (view !== "dashboard" && !visibleNav.some((i) => i.key === view)) setView("dashboard");
  }, [view, visibleNav]);

  useEffect(() => {
    if (getStaffToken()) setAuthed(true);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    try {
      const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username: loginUsername, password: loginPassword }) });
      localStorage.setItem("computerStoreToken", data.token);
      localStorage.setItem("staffUserName", data.user?.username || "Staff");
      setAuthed(true);
    } catch (err: any) { setLoginError(err.message); }
  }

  if (!authed) {
    return (
      <div className="auth-page" style={{ marginTop: "3rem" }}>
        <h1>Back office</h1>
        <form onSubmit={handleLogin} className="auth-form">
          <div className="field"><label>Username or email<input value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} required /></label></div>
          <div className="field"><label>Password<input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required /></label></div>
          {loginError && <p className="error">{loginError}</p>}
          <button type="submit" className="btn btn-block">Sign in</button>
        </form>
      </div>
    );
  }

  return (
    <div className="dash-layout">
      <nav className="dash-nav">
        {visibleNav.map((item) => (
          <button key={item.key} className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}>{item.label}</button>
        ))}
        <a href="/" className="nav-logout-btn" style={{ textAlign: "left" }} target="_blank" rel="noreferrer">View shop &nearr;</a>
        <button onClick={() => { localStorage.removeItem("computerStoreToken"); window.location.href = "/"; }} style={{ color: "var(--primary)" }}>Sign out</button>
      </nav>
      <div className="dash-content">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {settings?.storeLogo && <img src={settings.storeLogo} alt="" style={{ height: 28, width: 28, objectFit: "contain", borderRadius: 4 }} />}
            <strong style={{ fontSize: "1rem" }}>{settings?.storeName || "Store"}</strong>
          </div>
            <button type="button" onClick={toggleDark} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.3rem 0.6rem", cursor: "pointer", fontSize: "0.85rem", color: "var(--text)", lineHeight: 1 }}>{isDark ? "☀️" : "🌙"}</button>
          </div>
        {view === "dashboard" && <BackofficeDashboard />}
        {view === "repairs" && <BackofficeRepairs />}
        {view === "calendar" && <BackofficeCalendar />}
        {view === "stock" && <BackofficeStock />}
      </div>
    </div>
  );
}

function BackofficeDashboard() {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => { api<any>("/api/backoffice/stats").then(setStats).catch(() => {}); }, []);

  return (
    <>
      <h1>Dashboard</h1>
      <div className="stat-grid">
        {stats && (
          <>
            <div className="stat-card"><div className="stat-card__value">{stats.openRepairs || 0}</div><div className="stat-card__label">Open Repairs</div></div>
            <div className="stat-card"><div className="stat-card__value">{stats.dueToday || 0}</div><div className="stat-card__label">Due Today</div></div>
            <div className="stat-card"><div className="stat-card__value">{stats.scheduled || 0}</div><div className="stat-card__label">Scheduled</div></div>
            <div className="stat-card"><div className="stat-card__value">{stats.unassigned || 0}</div><div className="stat-card__label">Unassigned</div></div>
          </>
        )}
      </div>
    </>
  );
}

function BackofficeRepairs() {
  const [repairs, setRepairs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [form, setForm] = useState({ diagnosis: "", hardwareValue: 0, laborCost: 0, partsCost: 0, softwareInstall: false, softwareLicense: false });

  useEffect(() => {
    const url = statusFilter ? `/api/repairs?status=${encodeURIComponent(statusFilter)}` : "/api/repairs";
    api<{ tickets: any[] }>(url).then((d) => setRepairs(d.tickets || [])).catch(() => {});
  }, [statusFilter]);

  async function loadDetail(id: string) {
    try {
      const d = await api<any>(`/api/repairs/${id}`);
      setDetail(d);
      setForm({
        diagnosis: d.diagnosis || "",
        hardwareValue: d.hardwareValue || 0,
        laborCost: d.laborCost || 0,
        partsCost: d.partsCost || 0,
        softwareInstall: d.softwareInstall || false,
        softwareLicense: d.softwareLicense || false,
      });
    } catch {}
  }

  function selectTicket(t: any) {
    setSelected(selected?.id === t.id ? null : t);
    if (selected?.id !== t.id) { loadDetail(t.id); }
    else setDetail(null);
  }

  async function updateTicket(id: string) {
    try {
      await api(`/api/repairs/${id}`, { method: "PATCH", body: JSON.stringify(form) });
      await loadDetail(id);
    } catch (e: any) { alert(e.message); }
  }

  async function sendQuote(id: string) {
    try {
      await api(`/api/repairs/${id}/send-quote`, { method: "POST" });
      await loadDetail(id);
    } catch (e: any) { alert(e.message); }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1>Repair tickets</h1>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All open statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>#</th><th>Customer</th><th>Device</th><th>Status</th><th>ETA</th><th>Quote</th><th></th></tr></thead>
          <tbody>
            {repairs.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>{escapeHtml(t.customerName || "")}</td>
                <td>{t.deviceModel ? escapeHtml(t.deviceModel) : t.deviceType ? escapeHtml(t.deviceType) : "—"}</td>
                <td><span className="plan-status">{t.status}</span></td>
                <td>{t.etaAt ? new Date(t.etaAt).toLocaleDateString("en-GB") : "—"}</td>
                <td>
                  {t.quoteSentAt ? (
                    <span className="plan-status" style={{ background: t.quoteResponse === "accepted" ? "#d1fae5" : t.quoteResponse === "declined" ? "#fee2e2" : "#fef3c7", color: t.quoteResponse === "accepted" ? "#065f46" : t.quoteResponse === "declined" ? "#991b1b" : "#92400e" }}>
                      {t.quoteResponse ? t.quoteResponse : "Sent"}
                    </span>
                  ) : "—"}
                </td>
                <td><button className="btn btn-sm" onClick={() => selectTicket(t)}>
                  {selected?.id === t.id ? "Close" : "Update"}
                </button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <h3>Ticket #{detail.id} — {escapeHtml(detail.deviceType)}</h3>
          <p className="muted">{escapeHtml(detail.issueDescription)}</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
            <div className="field"><label>Diagnosis<textarea rows={3} value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></label></div>
            <div>
              <div className="field"><label>Hardware value<input type="number" value={form.hardwareValue} onChange={(e) => setForm({ ...form, hardwareValue: Number(e.target.value) })} /></label></div>
              <div className="field"><label>Parts cost<input type="number" value={form.partsCost} onChange={(e) => setForm({ ...form, partsCost: Number(e.target.value) })} /></label></div>
              <div className="field" style={{ marginTop: "0.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input type="checkbox" checked={form.softwareInstall} onChange={(e) => setForm({ ...form, softwareInstall: e.target.checked })} />
                  Software install
                </label>
              </div>
              <div className="field">
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input type="checkbox" checked={form.softwareLicense} onChange={(e) => setForm({ ...form, softwareLicense: e.target.checked })} />
                  Software license
                </label>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-sm" onClick={() => updateTicket(detail.id)}>Save costs</button>
            <button className="btn btn-sm btn-secondary" onClick={() => sendQuote(detail.id)} disabled={!!detail.quoteSentAt}>
              {detail.quoteSentAt ? "Quote sent" : "Send quote to customer"}
            </button>
            {detail.totalCost > 0 && <span style={{ fontWeight: 600, fontSize: "1.1rem" }}>{formatPrice(detail.totalCost)}</span>}
            {detail.quoteSentAt && (
              <span className="plan-status" style={{
                background: detail.quoteResponse === "accepted" ? "#d1fae5" : detail.quoteResponse === "declined" ? "#fee2e2" : "#fef3c7",
                color: detail.quoteResponse === "accepted" ? "#065f46" : detail.quoteResponse === "declined" ? "#991b1b" : "#92400e"
              }}>
                {detail.quoteResponse ? `Customer ${detail.quoteResponse}` : "Awaiting customer response"}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function BackofficeCalendar() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tickets, setTickets] = useState<any[]>([]);

  useEffect(() => {
    const from = date;
    const to = new Date(new Date(date).getTime() + 86400000).toISOString().slice(0, 10);
    api<{ tickets: any[] }>(`/api/repairs/calendar?from=${from}&to=${to}`).then((d) => setTickets(d.tickets || [])).catch(() => {});
  }, [date]);

  return (
    <>
      <h1>Schedule</h1>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {tickets.length === 0 ? <p className="muted">No tickets scheduled for this date.</p> : (
        tickets.map((t) => (
          <div key={t.id} className="order-item">
            <strong>#{t.id}</strong> — {escapeHtml(t.deviceType || t.deviceModel || "")} <span className="plan-status">{t.status}</span>
          </div>
        ))
      )}
    </>
  );
}

function BackofficeStock() {
  const [stock, setStock] = useState<any[]>([]);

  useEffect(() => {
    api<{ stock: any[] }>("/api/stock").then((d) => setStock(d.stock || [])).catch(() => {});
  }, []);

  async function updateStock(productId: string, quantity: number) {
    try {
      await api("/api/stock", { method: "PUT", body: JSON.stringify({ productId, quantity }) });
      window.location.reload();
    } catch {}
  }

  return (
    <>
      <h1>Stock Control</h1>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Product</th><th>Stock</th><th></th></tr></thead>
          <tbody>
            {stock.map((s) => (
              <tr key={s.productId}>
                <td>{escapeHtml(s.productName || s.productId)}</td>
                <td>{s.quantity ?? "—"}</td>
                <td>
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => updateStock(s.productId, Math.max(0, (s.quantity || 0) - 1))}>−</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => updateStock(s.productId, (s.quantity || 0) + 1)}>+</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
