import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import RippleButton from "@/components/RippleButton";
import { formatPrice, escapeHtml, Spinner } from "./shared";

type AdminRepairsTab = "tickets" | "calendar" | "content";

const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  diagnosing: "Diagnosing",
  waiting_parts: "Waiting for parts",
  in_progress: "In progress",
  ready: "Ready for collection",
  collected: "Collected",
  cancelled: "Cancelled",
};
const STATUS_OPTIONS = Object.keys(STATUS_LABELS);

function statusBadge(status: string) {
  const bg: Record<string, string> = {
    received: "#dbeafe", diagnosing: "#fef3c7", waiting_parts: "#ede9fe",
    in_progress: "#d1fae5", ready: "#c7d2fe", collected: "#e5e7eb", cancelled: "#fee2e2",
  };
  const fg: Record<string, string> = {
    received: "#1e40af", diagnosing: "#92400e", waiting_parts: "#5b21b6",
    in_progress: "#065f46", ready: "#3730a3", collected: "#374151", cancelled: "#991b1b",
  };
  return <span className="plan-status" style={{ background: bg[status] || "#e5e7eb", color: fg[status] || "#374151" }}>{STATUS_LABELS[status] || status}</span>;
}

function localISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
}

function fmtDate(s: string) {
  const first = String(s).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(first)) {
    const [y, m, d] = first.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB");
  }
  return new Date(s).toLocaleDateString("en-GB");
}

export default function AdminRepairs() {
  const [tab, setTab] = useState<AdminRepairsTab>("tickets");
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1>Repairs</h1>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <RippleButton variant={tab === "tickets" ? "primary" : "ghost"} onClick={() => setTab("tickets")}>Tickets</RippleButton>
          <RippleButton variant={tab === "calendar" ? "primary" : "ghost"} onClick={() => setTab("calendar")}>Calendar</RippleButton>
          <RippleButton variant={tab === "content" ? "primary" : "ghost"} onClick={() => setTab("content")}>Page Content</RippleButton>
        </div>
      </div>

      {tab === "tickets" && (
        <TicketsTab
          openId={openTicketId}
          onOpen={setOpenTicketId}
        />
      )}
      {tab === "calendar" && (
        <CalendarTab
          onOpenTicket={(id) => { setOpenTicketId(id); setTab("tickets"); }}
        />
      )}
      {tab === "content" && <ContentTab />}
    </>
  );
}

// ===================== TICKETS =====================

interface TicketForm {
  status: string;
  assignedTo: string;
  etaAt: string;
  scheduledAt: string;
  diagnosis: string;
  hardwareValue: string;
  softwareInstall: boolean;
  softwareLicense: boolean;
}

function TicketsTab({ openId, onOpen }: { openId: string | null; onOpen: (id: string | null) => void }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [techFilter, setTechFilter] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [form, setForm] = useState<TicketForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noteMsg, setNoteMsg] = useState("");
  const [noteVisible, setNoteVisible] = useState(true);
  const [partForm, setPartForm] = useState({ description: "", quantity: 1, unitCost: 0 });

  async function loadList() {
    setLoading(true);
    try {
      const q: string[] = [];
      if (statusFilter) q.push(`status=${encodeURIComponent(statusFilter)}`);
      if (techFilter) q.push(`assignedTo=${encodeURIComponent(techFilter)}`);
      const url = `/api/repairs${q.length ? "?" + q.join("&") : ""}`;
      const d = await api<{ tickets: any[] }>(url);
      setTickets(d.tickets || []);
    } catch { setTickets([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadList(); }, [statusFilter, techFilter]);

  useEffect(() => {
    api<{ staff: any[] }>("/api/staff/technicians").then((d) => setStaff(d.staff || [])).catch(() => {});
  }, []);

  async function loadDetail(id: string) {
    try {
      const d = await api<any>(`/api/repairs/${id}`);
      setDetail(d);
      setForm({
        status: d.status || "received",
        assignedTo: d.assignedTo != null ? String(d.assignedTo) : "",
        etaAt: d.etaAt ? String(d.etaAt).slice(0, 10) : "",
        scheduledAt: d.scheduledAt ? String(d.scheduledAt).replace(" ", "T").slice(0, 16) : "",
        diagnosis: d.diagnosis || "",
        hardwareValue: String(d.hardwareValue || 0),
        softwareInstall: Boolean(d.softwareInstall),
        softwareLicense: Boolean(d.softwareLicense),
      });
    } catch { /* ignore */ }
  }

  async function selectTicket(t: any) {
    const next = detail?.id === t.id ? null : t.id;
    if (next) { await loadDetail(next); } else { setDetail(null); setForm(null); }
    onOpen(next);
  }

  useEffect(() => {
    if (openId && detail?.id !== openId) loadDetail(openId);
  }, [openId]);

  async function saveDetail() {
    if (!detail || !form) return;
    setSaving(true);
    try {
      await api(`/api/repairs/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: form.status,
          assignedTo: form.assignedTo ? Number(form.assignedTo) : null,
          etaAt: form.etaAt || null,
          scheduledAt: form.scheduledAt || null,
          diagnosis: form.diagnosis,
          hardwareValue: Number(form.hardwareValue) || 0,
          softwareInstall: form.softwareInstall,
          softwareLicense: form.softwareLicense,
        }),
      });
      await loadDetail(detail.id);
      await loadList();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function sendQuote() {
    if (!detail) return;
    try {
      await api(`/api/repairs/${detail.id}/send-quote`, { method: "POST" });
      await loadDetail(detail.id);
    } catch (e: any) { alert(e.message); }
  }

  async function addPart() {
    if (!detail) return;
    try {
      await api(`/api/repairs/${detail.id}/parts`, {
        method: "POST",
        body: JSON.stringify({
          description: partForm.description,
          quantity: Number(partForm.quantity) || 1,
          unitCost: Number(partForm.unitCost) || 0,
        }),
      });
      setPartForm({ description: "", quantity: 1, unitCost: 0 });
      await loadDetail(detail.id);
    } catch (e: any) { alert(e.message); }
  }

  async function removePart(partId: number) {
    if (!detail) return;
    try {
      await api(`/api/repairs/${detail.id}/parts/${partId}`, { method: "DELETE" });
      await loadDetail(detail.id);
    } catch (e: any) { alert(e.message); }
  }

  async function addNote() {
    if (!detail || !noteMsg.trim()) return;
    try {
      await api(`/api/repairs/${detail.id}/updates`, {
        method: "POST",
        body: JSON.stringify({ message: noteMsg.trim(), customerVisible: noteVisible }),
      });
      setNoteMsg("");
      await loadDetail(detail.id);
    } catch (e: any) { alert(e.message); }
  }

  const partsTotal = Array.isArray(detail?.parts)
    ? detail.parts.reduce((s: number, p: any) => s + (Number(p.unitCost) || 0) * (Number(p.quantity) || 1), 0)
    : 0;

  return (
    <>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", margin: "0.5rem 0 1rem" }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={techFilter} onChange={(e) => setTechFilter(e.target.value)}>
          <option value="">All technicians</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.username}</option>)}
        </select>
        <span className="muted">{tickets.length} ticket(s)</span>
      </div>

      {loading ? <Spinner /> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>#</th><th>Customer</th><th>Device</th><th>Status</th><th>Technician</th><th>ETA</th><th>Scheduled</th><th>Quote</th><th></th></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{escapeHtml(t.customerName || "")}</td>
                  <td>{t.deviceType ? escapeHtml(t.deviceType + (t.deviceModel ? " " + t.deviceModel : "")) : "—"}</td>
                  <td>{statusBadge(t.status)}</td>
                  <td>{t.assignedName ? escapeHtml(t.assignedName) : <span className="muted">Unassigned</span>}</td>
                  <td>{t.etaAt ? fmtDate(t.etaAt) : "—"}</td>
                  <td>{t.scheduledAt ? new Date(t.scheduledAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td>
                    {t.quoteSentAt ? (
                      <span className="plan-status" style={{ background: t.quoteResponse === "accepted" ? "#d1fae5" : t.quoteResponse === "declined" ? "#fee2e2" : "#fef3c7", color: t.quoteResponse === "accepted" ? "#065f46" : t.quoteResponse === "declined" ? "#991b1b" : "#92400e" }}>
                        {t.quoteResponse || "Sent"}
                      </span>
                    ) : "—"}
                  </td>
                  <td>
                    <RippleButton size="small" variant="ghost" onClick={() => selectTicket(t)}>
                      {detail?.id === t.id ? "Close" : "View"}
                    </RippleButton>
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--muted)" }}>No repair tickets match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {detail && form && (
        <div className="panel" style={{ marginTop: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <h3 style={{ margin: 0 }}>Ticket #{detail.id} — {escapeHtml(detail.deviceType)}</h3>
            {statusBadge(detail.status)}
          </div>
          <p className="muted" style={{ marginTop: "0.5rem" }}>{escapeHtml(detail.issueDescription)}</p>
          <p className="muted">Customer: {escapeHtml(detail.customerName)} ({escapeHtml(detail.customerEmail || "")})</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", margin: "1rem 0" }}>
            <div className="field"><label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></label></div>
            <div className="field"><label>Technician<select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.username}</option>)}</select></label></div>
            <div className="field"><label>ETA date<input type="date" value={form.etaAt} onChange={(e) => setForm({ ...form, etaAt: e.target.value })} /></label></div>
            <div className="field"><label>Schedule (calendar)<input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></label></div>
          </div>

          <div className="field" style={{ marginBottom: "1rem" }}><label>Diagnosis<textarea rows={3} value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></label></div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
            <div className="field"><label>Hardware value (KES)<input type="number" min={0} value={form.hardwareValue} onChange={(e) => setForm({ ...form, hardwareValue: e.target.value })} /></label></div>
            <div className="field" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1.4rem" }}>
              <input type="checkbox" checked={form.softwareInstall} onChange={(e) => setForm({ ...form, softwareInstall: e.target.checked })} />
              <label style={{ fontWeight: "normal", margin: 0 }}>Software install (+KES 800)</label>
            </div>
            <div className="field" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1.4rem" }}>
              <input type="checkbox" checked={form.softwareLicense} onChange={(e) => setForm({ ...form, softwareLicense: e.target.checked })} />
              <label style={{ fontWeight: "normal", margin: 0 }}>Software license (+KES 2,500)</label>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <RippleButton onClick={saveDetail} loading={saving}>Save</RippleButton>
            <RippleButton variant="secondary" onClick={sendQuote} disabled={!!detail.quoteSentAt}>
              {detail.quoteSentAt ? "Quote sent" : "Send quote to customer"}
            </RippleButton>
            {detail.totalCost > 0 && <span style={{ fontWeight: 600, fontSize: "1.05rem" }}>Total: {formatPrice(detail.totalCost)}</span>}
            {detail.quoteSentAt && (
              <span className="plan-status" style={{ background: detail.quoteResponse === "accepted" ? "#d1fae5" : detail.quoteResponse === "declined" ? "#fee2e2" : "#fef3c7", color: detail.quoteResponse === "accepted" ? "#065f46" : detail.quoteResponse === "declined" ? "#991b1b" : "#92400e" }}>
                {detail.quoteResponse ? `Customer ${detail.quoteResponse}` : "Awaiting customer response"}
              </span>
            )}
          </div>

          <div style={{ marginTop: "1.5rem" }}>
            <h4 style={{ marginBottom: "0.5rem" }}>Parts used — total {formatPrice(partsTotal)}</h4>
            {Array.isArray(detail.parts) && detail.parts.length > 0 && (
              <div className="table-wrap" style={{ marginBottom: "0.75rem" }}>
                <table className="data-table">
                  <thead><tr><th>Description</th><th>Qty</th><th>Unit cost</th><th>Line total</th><th></th></tr></thead>
                  <tbody>
                    {detail.parts.map((p: any) => (
                      <tr key={p.id}>
                        <td>{escapeHtml(p.description)}</td>
                        <td>{p.quantity}</td>
                        <td>{formatPrice(p.unitCost)}</td>
                        <td>{formatPrice(p.unitCost * p.quantity)}</td>
                        <td><RippleButton size="small" variant="danger" onClick={() => removePart(p.id)}>Remove</RippleButton></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="field" style={{ flex: "1 1 220px" }}><label>Description<input value={partForm.description} onChange={(e) => setPartForm({ ...partForm, description: e.target.value })} placeholder="e.g. Replacement battery" /></label></div>
              <div className="field" style={{ width: 90 }}><label>Qty<input type="number" min={1} value={partForm.quantity} onChange={(e) => setPartForm({ ...partForm, quantity: Number(e.target.value) })} /></label></div>
              <div className="field" style={{ width: 130 }}><label>Unit cost<input type="number" min={0} value={partForm.unitCost} onChange={(e) => setPartForm({ ...partForm, unitCost: Number(e.target.value) })} /></label></div>
              <RippleButton size="small" variant="secondary" onClick={addPart}>Add part</RippleButton>
            </div>
          </div>

          <div style={{ marginTop: "1.5rem" }}>
            <h4 style={{ marginBottom: "0.5rem" }}>Updates &amp; notes</h4>
            {Array.isArray(detail.updates) && detail.updates.length > 0 && (
              <div style={{ marginBottom: "0.75rem" }}>
                {detail.updates.map((u: any) => (
                  <div key={u.id} className="order-item" style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
                    <div>
                      <strong>{escapeHtml(u.staffName || "Staff")}</strong> <span className="muted">· {new Date(u.createdAt).toLocaleString("en-GB")}</span>
                      {!u.customerVisible && <span className="plan-status" style={{ marginLeft: "0.5rem", background: "#f3f4f6", color: "#6b7280" }}>Internal</span>}
                      <p style={{ margin: "0.25rem 0 0", whiteSpace: "pre-wrap" }}>{escapeHtml(u.message)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="field" style={{ flex: "1 1 260px" }}><label>Message<textarea rows={2} value={noteMsg} onChange={(e) => setNoteMsg(e.target.value)} /></label></div>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
                <input type="checkbox" checked={noteVisible} onChange={(e) => setNoteVisible(e.target.checked)} />
                Visible to customer
              </label>
              <RippleButton size="small" variant="secondary" onClick={addNote} disabled={!noteMsg.trim()}>Add note</RippleButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ===================== CALENDAR =====================

function CalendarTab({ onOpenTicket }: { onOpenTicket: (id: string) => void }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const from = localISODate(weekStart);
    const to = localISODate(addDays(weekStart, 7));
    api<{ tickets: any[] }>(`/api/repairs/calendar?from=${from}&to=${to}`)
      .then((d) => setTickets(d.tickets || []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, [weekStart]);

  const todayStr = localISODate(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDay: Record<string, any[]> = {};
  days.forEach((d) => { byDay[localISODate(d)] = []; });
  tickets.forEach((t) => {
    if (!t.scheduledAt) return;
    const day = String(t.scheduledAt).slice(0, 10);
    if (byDay[day]) byDay[day].push(t);
  });

  return (
    <>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", margin: "0.5rem 0 1rem" }}>
        <RippleButton variant="ghost" onClick={() => setWeekStart((w) => addDays(w, -7))}>‹ Prev week</RippleButton>
        <RippleButton variant="ghost" onClick={() => setWeekStart(startOfWeek(new Date()))}>This week</RippleButton>
        <RippleButton variant="ghost" onClick={() => setWeekStart((w) => addDays(w, 7))}>Next week ›</RippleButton>
        <span className="muted">{days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – {days[6].toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
      </div>

      {loading ? <Spinner /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
          {days.map((d) => {
            const key = localISODate(d);
            const dayTickets = byDay[key] || [];
            const isToday = key === todayStr;
            return (
              <div key={key} className="panel" style={{ borderColor: isToday ? "var(--primary)" : undefined }}>
                <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                  {d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                  {isToday && <span className="plan-status" style={{ marginLeft: "0.35rem", background: "var(--primary)", color: "#fff" }}>Today</span>}
                </div>
                {dayTickets.length === 0 ? (
                  <p className="muted" style={{ fontSize: "0.85rem" }}>No scheduled repairs.</p>
                ) : (
                  dayTickets.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onOpenTicket(t.id)}
                      style={{ display: "block", width: "100%", textAlign: "left", border: "1px solid var(--border)", background: "var(--card-bg, #fff)", borderRadius: 6, padding: "0.4rem 0.5rem", marginBottom: "0.35rem", cursor: "pointer", fontSize: "0.8rem" }}
                    >
                      <strong>{t.id}</strong>
                      <div>{escapeHtml(t.deviceType || "")}{t.deviceModel ? " " + escapeHtml(t.deviceModel) : ""}</div>
                      {t.assignedName && <div className="muted">👤 {escapeHtml(t.assignedName)}</div>}
                      <div>{t.scheduledAt ? new Date(t.scheduledAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""} {statusBadge(t.status)}</div>
                    </button>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="muted" style={{ marginTop: "0.75rem" }}>Tip: open a ticket and set a date in "Schedule (calendar)" to place it on the calendar. Click any scheduled repair to jump to its ticket.</p>
    </>
  );
}

// ===================== PAGE CONTENT =====================

function ContentTab() {
  const [intro, setIntro] = useState("");
  const [panels, setPanels] = useState<{ title: string; description: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const d = await api<any>("/api/admin/repairs-page");
      setIntro(d.intro || "");
      setPanels(Array.isArray(d.panels) ? d.panels : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!intro.trim()) { setStatusMsg({ text: "Intro is required.", error: true }); return; }
    if (panels.length === 0) { setStatusMsg({ text: "Add at least one service panel.", error: true }); return; }
    setSaving(true);
    setStatusMsg(null);
    try {
      await api("/api/admin/repairs-page", {
        method: "PUT",
        body: JSON.stringify({ intro, panels }),
      });
      setStatusMsg({ text: "Saved. The storefront /repairs page now shows this content." });
    } catch (e: any) { setStatusMsg({ text: e.message, error: true }); }
    finally { setSaving(false); }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <p className="muted">Edit the content shown on the public <strong>/repairs</strong> page. These are the fields customers see when they visit the Repairs page.</p>
      <div className="panel" style={{ maxWidth: 760 }}>
        <div className="field"><label>Intro paragraph<textarea rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} /></label></div>

        <h4 style={{ margin: "1rem 0 0.5rem" }}>Service panels ({panels.length})</h4>
        {panels.map((p, i) => (
          <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
              <strong>Panel {i + 1}</strong>
              <RippleButton size="small" variant="danger" onClick={() => setPanels(panels.filter((_, idx) => idx !== i))}>Remove</RippleButton>
            </div>
            <div className="field" style={{ marginTop: "0.5rem" }}><label>Title<input value={p.title} onChange={(e) => setPanels(panels.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)))} /></label></div>
            <div className="field"><label>Description<textarea rows={2} value={p.description} onChange={(e) => setPanels(panels.map((x, idx) => (idx === i ? { ...x, description: e.target.value } : x)))} /></label></div>
          </div>
        ))}
        <RippleButton variant="secondary" onClick={() => setPanels([...panels, { title: "", description: "" }])}>+ Add panel</RippleButton>

        <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <RippleButton onClick={save} loading={saving}>Save changes</RippleButton>
          {statusMsg && <span className={statusMsg.error ? "error" : "form-status"}>{statusMsg.text}</span>}
        </div>
      </div>
    </>
  );
}
