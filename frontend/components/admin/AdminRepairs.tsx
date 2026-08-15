import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import RippleButton from "@/components/RippleButton";
import EmptyState from "@/components/EmptyState";
import { formatPrice, escapeHtml, Spinner } from "./shared";
import { toast } from "@/components/Toast";

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

const BOOKING_DEVICE_TYPES = ["Laptop", "Desktop PC", "MacBook", "Tablet", "Printer", "Other"];

const BOOKING_SYMPTOMS = ["Won't turn on", "Slow performance", "Overheating", "Screen cracked", "Battery drains fast", "No display", "Keyboard not working", "Wi-Fi issues", "Software crash", "Virus / malware", "Data recovery", "Liquid damage", "Fan noise", "Other"];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function statusBadge(status: string) {
  const bg: Record<string, string> = {
    received: "var(--info-light)", diagnosing: "var(--warning-light)", waiting_parts: "var(--violet-light)",
    in_progress: "var(--success-light)", ready: "var(--indigo-light)", collected: "var(--neutral-light)", cancelled: "var(--danger-light)",
  };
  const fg: Record<string, string> = {
    received: "var(--info-text)", diagnosing: "var(--warning-text)", waiting_parts: "var(--violet-text)",
    in_progress: "var(--success-text)", ready: "var(--indigo-text)", collected: "var(--neutral-text)", cancelled: "var(--danger-text)",
  };
  return <span className="plan-status" style={{ background: bg[status] || "var(--neutral-light)", color: fg[status] || "var(--neutral-text)" }}>{STATUS_LABELS[status] || status}</span>;
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

export default function AdminRepairs({ adminOnly = true }: { adminOnly?: boolean }) {
  const [tab, setTab] = useState<AdminRepairsTab>("tickets");
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1>Repairs</h1>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <RippleButton variant={tab === "tickets" ? "primary" : "ghost"} onClick={() => setTab("tickets")}>Tickets</RippleButton>
          <RippleButton variant={tab === "calendar" ? "primary" : "ghost"} onClick={() => setTab("calendar")}>Calendar</RippleButton>
          {adminOnly && <RippleButton variant={tab === "content" ? "primary" : "ghost"} onClick={() => setTab("content")}>Page Content</RippleButton>}
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
      toast("success", "Repair updated.");
    } catch (e: any) { toast("error", e.message); }
    finally { setSaving(false); }
  }

  async function sendQuote() {
    if (!detail) return;
    try {
      await api(`/api/repairs/${detail.id}/send-quote`, { method: "POST" });
      await loadDetail(detail.id);
      toast("success", "Quote sent to customer.");
    } catch (e: any) { toast("error", e.message); }
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
      toast("success", "Part added.");
    } catch (e: any) { toast("error", e.message); }
  }

  async function removePart(partId: number) {
    if (!detail) return;
    try {
      await api(`/api/repairs/${detail.id}/parts/${partId}`, { method: "DELETE" });
      await loadDetail(detail.id);
      toast("success", "Part removed.");
    } catch (e: any) { toast("error", e.message); }
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
      toast("success", "Update added.");
    } catch (e: any) { toast("error", e.message); }
  }

  const partsTotal = Array.isArray(detail?.parts)
    ? detail.parts.reduce((s: number, p: any) => s + (Number(p.unitCost) || 0) * (Number(p.quantity) || 1), 0)
    : 0;
  const quoteSent = !!detail?.quoteSentAt;
  const quoteAccepted = detail?.quoteResponse === "accepted";
  const quoteDeclined = detail?.quoteResponse === "declined";

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
                      <span className="plan-status" style={{ background: t.quoteResponse === "accepted" ? "var(--success-light)" : t.quoteResponse === "declined" ? "var(--danger-light)" : "var(--warning-light)", color: t.quoteResponse === "accepted" ? "var(--success-text)" : t.quoteResponse === "declined" ? "var(--danger-text)" : "var(--warning-text)" }}>
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
                <tr><td colSpan={9}><EmptyState icon="repairs" title="No repair tickets" description="No repair tickets match the current filters. Clear the filters to see all tickets." actionLabel="Clear filters" onAction={() => { setStatusFilter(""); setTechFilter(""); }} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {detail && form && (
        <div className="panel" style={{ marginTop: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ minWidth: 0, maxWidth: "70ch" }}>
              <h3 style={{ margin: 0 }}>Ticket #{detail.id} — {escapeHtml(detail.deviceType)}</h3>
              <p className="muted" style={{ margin: "0.5rem 0 0" }}>{escapeHtml(detail.issueDescription)}</p>
            </div>
            {statusBadge(detail.status)}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.5rem 1.5rem", marginTop: "1.25rem", padding: "0.75rem 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div className="input-label">Customer</div>
              <div>{escapeHtml(detail.customerName)}</div>
            </div>
            <div>
              <div className="input-label">Email</div>
              <div>{escapeHtml(detail.customerEmail || "—")}</div>
            </div>
            {detail.deviceModel ? (
              <div>
                <div className="input-label">Device model</div>
                <div>{escapeHtml(detail.deviceModel)}</div>
              </div>
            ) : null}
            {detail.repairTypeName ? (
              <div>
                <div className="input-label">Repair type</div>
                <div>{escapeHtml(detail.repairTypeName)}</div>
              </div>
            ) : null}
            <div>
              <div className="input-label">Reported</div>
              <div>{detail.createdAt ? fmtDate(detail.createdAt) : "—"}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0 0.75rem", marginTop: "1.25rem" }}>
            <div className="field"><label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></label></div>
            <div className="field"><label>Technician<select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.username}</option>)}</select></label></div>
            <div className="field"><label>ETA date<input type="date" value={form.etaAt} onChange={(e) => setForm({ ...form, etaAt: e.target.value })} /></label></div>
            <div className="field"><label>Schedule (calendar)<input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></label></div>
          </div>

          <div className="field"><label>Diagnosis<textarea rows={3} value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></label></div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0 0.75rem" }}>
            <div className="field"><label>Hardware value (KES)<input type="number" min={0} value={form.hardwareValue} onChange={(e) => setForm({ ...form, hardwareValue: e.target.value })} /></label></div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", alignSelf: "end", marginBottom: "1rem", cursor: "pointer" }}>
              <input type="checkbox" checked={form.softwareInstall} onChange={(e) => setForm({ ...form, softwareInstall: e.target.checked })} />
              Software install (+KES 800)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", alignSelf: "end", marginBottom: "1rem", cursor: "pointer" }}>
              <input type="checkbox" checked={form.softwareLicense} onChange={(e) => setForm({ ...form, softwareLicense: e.target.checked })} />
              Software license (+KES 2,500)
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "1.25rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <RippleButton onClick={saveDetail} loading={saving}>Save</RippleButton>
              <RippleButton variant="secondary" onClick={sendQuote} disabled={quoteSent}>
                {quoteSent ? "Quote sent" : "Send quote to customer"}
              </RippleButton>
            </div>
            {detail.totalCost > 0 && (
              <div style={{ textAlign: "right" }}>
                <div className="input-label" style={{ marginBottom: 0 }}>Total</div>
                <div style={{ fontWeight: 600, fontSize: "1.05rem", fontVariantNumeric: "tabular-nums" }}>{formatPrice(detail.totalCost)}</div>
              </div>
            )}
          </div>
          {quoteSent && (
            <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", background: quoteAccepted ? "var(--success-light)" : quoteDeclined ? "var(--danger-light)" : "var(--warning-light)", color: quoteAccepted ? "var(--success-text)" : quoteDeclined ? "var(--danger-text)" : "var(--warning-text)" }}>
              {quoteAccepted ? "Customer accepted the quote" : quoteDeclined ? "Customer declined the quote" : "Quote sent to customer — awaiting response"}
            </div>
          )}

          <div style={{ marginTop: "1.75rem", borderTop: "1px solid var(--border)", paddingTop: "1.25rem" }}>
            <h4 style={{ margin: 0, display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
              Parts used <span className="muted" style={{ fontWeight: 400, fontVariantNumeric: "tabular-nums" }}>· total {formatPrice(partsTotal)}</span>
            </h4>
            {Array.isArray(detail.parts) && detail.parts.length > 0 && (
              <div className="table-wrap" style={{ marginTop: "0.75rem", marginBottom: "0.75rem" }}>
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

          <div style={{ marginTop: "1.75rem", borderTop: "1px solid var(--border)", paddingTop: "1.25rem" }}>
            <h4 style={{ margin: "0 0 0.75rem" }}>Updates &amp; notes</h4>
            {Array.isArray(detail.updates) && detail.updates.length > 0 && (
              <div style={{ marginBottom: "0.75rem" }}>
                {detail.updates.map((u: any) => (
                  <div key={u.id} className="order-item">
                    <strong>{escapeHtml(u.staffName || "Staff")}</strong> <span className="muted">· {new Date(u.createdAt).toLocaleString("en-GB")}</span>
                    {!u.customerVisible && <span className="plan-status" style={{ marginLeft: "0.5rem", background: "var(--neutral-light)", color: "var(--neutral-text)" }}>Internal</span>}
                    <p style={{ margin: "0.25rem 0 0", whiteSpace: "pre-wrap" }}>{escapeHtml(u.message)}</p>
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
                  {isToday && <span className="plan-status" style={{ marginLeft: "0.35rem", background: "var(--primary)", color: "var(--surface)" }}>Today</span>}
                </div>
                {dayTickets.length === 0 ? (
                  <p className="muted" style={{ fontSize: "0.85rem" }}>No scheduled repairs.</p>
                ) : (
                  dayTickets.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onOpenTicket(t.id)}
                      style={{ display: "block", width: "100%", textAlign: "left", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 6, padding: "0.4rem 0.5rem", marginBottom: "0.35rem", cursor: "pointer", fontSize: "0.8rem" }}
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
  const [panels, setPanels] = useState<any[]>([]);
  const [repairTypes, setRepairTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [d, t] = await Promise.all([
        api<any>("/api/admin/repairs-page"),
        api<any>("/api/repairs/types").catch(() => ({ types: [] })),
      ]);
      setIntro(d.intro || "");
      setPanels(Array.isArray(d.panels) ? d.panels : []);
      setRepairTypes(t.types || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function updatePanel(i: number, patch: any) {
    setPanels(panels.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  async function save() {
    if (!intro.trim()) { setStatusMsg({ text: "Intro is required.", error: true }); return; }
    if (panels.length === 0) { setStatusMsg({ text: "Add at least one service panel.", error: true }); return; }
    setSaving(true);
    setStatusMsg(null);
    try {
      const cleaned = panels.map((p) => ({
        ...p,
        id: String(p.id || "").trim() || slugify(p.title) || `panel-${Math.random().toString(36).slice(2, 8)}`,
      }));
      await api("/api/admin/repairs-page", {
        method: "PUT",
        body: JSON.stringify({ intro, panels: cleaned }),
      });
      setPanels(cleaned);
      setStatusMsg({ text: "Saved. The storefront /repairs page now shows this content." });
    } catch (e: any) { setStatusMsg({ text: e.message, error: true }); }
    finally { setSaving(false); }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <p className="muted">Edit the content shown on the public <strong>/repairs</strong> page. Any panel with <strong>"Booking button"</strong> enabled becomes a button that starts a pre-filled repair ticket.</p>
      <div className="panel" style={{ maxWidth: 820 }}>
        <div className="field"><label>Intro paragraph<textarea rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} /></label></div>

        <h4 style={{ margin: "1rem 0 0.5rem" }}>Service panels ({panels.length})</h4>
        {panels.map((p, i) => {
          const booking = p.booking || {};
          const enabled = !!booking.repairTypeId || !!booking.deviceType || !!booking.issueDescription || Array.isArray(booking.symptoms);
          return (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                <strong>Panel {i + 1}</strong>
                <RippleButton size="small" variant="danger" onClick={() => setPanels(panels.filter((_, idx) => idx !== i))}>Remove</RippleButton>
              </div>
              <div className="field" style={{ marginTop: "0.5rem" }}><label>Title<input value={p.title} onChange={(e) => updatePanel(i, { title: e.target.value })} /></label></div>
              <div className="field"><label>Description<textarea rows={2} value={p.description} onChange={(e) => updatePanel(i, { description: e.target.value })} /></label></div>

              <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", marginTop: "0.5rem", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "normal" }}>
                  <input type="checkbox" checked={p.active !== false} onChange={(e) => updatePanel(i, { active: e.target.checked })} />
                  Show on the /repairs page
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "normal" }}>
                  <input type="checkbox" checked={enabled} onChange={(e) => updatePanel(i, { booking: e.target.checked ? { ...booking } : undefined })} />
                  <strong>Booking button</strong> — click logs a pre-filled ticket
                </label>
              </div>
              {p.active === false && <p className="muted" style={{ fontSize: "0.85rem", margin: "0.25rem 0 0" }}>Hidden — customers won't see this panel.</p>}

              {enabled && (
                <div style={{ borderTop: "1px dashed var(--border)", marginTop: "0.6rem", paddingTop: "0.6rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                    <div className="field"><label>Repair type (sets the base price)<select value={booking.repairTypeId || ""} onChange={(e) => updatePanel(i, { booking: { ...booking, repairTypeId: e.target.value } })}><option value="">No repair type</option>{repairTypes.map((t) => <option key={t.id} value={t.id}>{t.name} — {formatPrice(t.basePrice)}</option>)}</select></label></div>
                    <div className="field"><label>Pre-fill device type<select value={booking.deviceType || ""} onChange={(e) => updatePanel(i, { booking: { ...booking, deviceType: e.target.value } })}><option value="">Don't pre-fill</option>{BOOKING_DEVICE_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}</select></label></div>
                  </div>
                  <div className="field"><label>Pre-fill issue description<textarea rows={2} value={booking.issueDescription || ""} onChange={(e) => updatePanel(i, { booking: { ...booking, issueDescription: e.target.value } })} placeholder="What should the customer's issue description say by default?" /></label></div>
                  <div className="field">
                    <label style={{ marginBottom: "0.3rem" }}>Pre-check symptoms</label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.25rem" }}>
                      {BOOKING_SYMPTOMS.map((s) => (
                        <label key={s} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: "normal", fontSize: "0.85rem" }}>
                          <input
                            type="checkbox"
                            checked={Array.isArray(booking.symptoms) && booking.symptoms.includes(s)}
                            onChange={(e) => {
                              const list = Array.isArray(booking.symptoms) ? booking.symptoms : [];
                              const next = e.target.checked ? [...list, s] : list.filter((x: string) => x !== s);
                              updatePanel(i, { booking: { ...booking, symptoms: next } });
                            }}
                          /> {s}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <RippleButton variant="secondary" onClick={() => setPanels([...panels, { title: "", description: "", active: true }])}>+ Add panel</RippleButton>

        <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <RippleButton onClick={save} loading={saving}>Save changes</RippleButton>
          {statusMsg && <span className={statusMsg.error ? "error" : "form-status"}>{statusMsg.text}</span>}
        </div>
      </div>
    </>
  );
}
