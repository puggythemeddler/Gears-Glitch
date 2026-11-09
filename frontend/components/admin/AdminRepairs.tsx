import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import RippleButton from "@/components/RippleButton";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatPrice, Spinner } from "./shared";
import { useFeedback } from "@/components/feedback/FeedbackProvider";

type AdminRepairsTab = "tickets" | "calendar" | "workflow" | "content";

const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  diagnosing: "Diagnosing",
  waiting_parts: "Waiting for parts",
  in_progress: "In progress",
  quality_check: "Quality check",
  ready: "Ready for collection",
  collected: "Collected",
  cancelled: "Cancelled",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
  unrepairable: "Unrepairable",
  on_hold: "On hold",
};
const STATUS_OPTIONS = Object.keys(STATUS_LABELS);

const BOOKING_DEVICE_TYPES = ["Laptop", "Desktop PC", "MacBook", "Tablet", "Printer", "Other"];

const BOOKING_SYMPTOMS = ["Won't turn on", "Slow performance", "Overheating", "Screen cracked", "Battery drains fast", "No display", "Keyboard not working", "Wi-Fi issues", "Software crash", "Virus / malware", "Data recovery", "Liquid damage", "Fan noise", "Other"];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function statusBadge(status: string) {
  return <StatusBadge status={status} domain="repairs" />;
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

export default function AdminRepairs({ adminOnly = true, canManagePayments = false, canVoidPayments = false }: { adminOnly?: boolean; canManagePayments?: boolean; canVoidPayments?: boolean }) {
  const [tab, setTab] = useState<AdminRepairsTab>("tickets");
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1>Repairs</h1>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <RippleButton variant={tab === "tickets" ? "primary" : "ghost"} onClick={() => setTab("tickets")}>Tickets</RippleButton>
          <RippleButton variant={tab === "calendar" ? "primary" : "ghost"} onClick={() => setTab("calendar")}>Calendar</RippleButton>
          {adminOnly && <RippleButton variant={tab === "workflow" ? "primary" : "ghost"} onClick={() => setTab("workflow")}>Workflow</RippleButton>}
          {adminOnly && <RippleButton variant={tab === "content" ? "primary" : "ghost"} onClick={() => setTab("content")}>Page Content</RippleButton>}
        </div>
      </div>

      {tab === "tickets" && (
        <TicketsTab
          openId={openTicketId}
          onOpen={setOpenTicketId}
          canManagePayments={canManagePayments}
          canVoidPayments={canVoidPayments}
        />
      )}
      {tab === "calendar" && (
        <CalendarTab
          onOpenTicket={(id) => { setOpenTicketId(id); setTab("tickets"); }}
        />
      )}
      {tab === "workflow" && adminOnly && <RepairWorkflowSettings />}
      {tab === "content" && <ContentTab />}
    </>
  );
}

function RepairWorkflowSettings() {
  const feedback = useFeedback();
  const [diagnosisSlaHours, setDiagnosisSlaHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<{ diagnosisSlaHours: number }>("/api/admin/repair-workflow")
      .then((data) => { if (active) setDiagnosisSlaHours(data.diagnosisSlaHours || 24); })
      .catch((e: any) => { if (active) setError(e?.message || "Repair workflow settings could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const result = await api<{ diagnosisSlaHours: number }>("/api/admin/repair-workflow", {
        method: "PUT",
        body: JSON.stringify({ diagnosisSlaHours }),
      });
      setDiagnosisSlaHours(result.diagnosisSlaHours);
      feedback.success({ title: "Workflow saved", message: "New technician assignments will use this diagnosis target." });
    } catch (e: any) {
      setError(e?.message || "Repair workflow settings could not be saved.");
      feedback.error({ title: "Workflow not saved", message: e?.message || "Please try again." });
    } finally { setSaving(false); }
  }

  return <section aria-labelledby="repair-workflow-heading">
    <h2 id="repair-workflow-heading">Repair workflow</h2>
    <p className="muted" style={{ maxWidth: "70ch" }}>Set the target for a technician to record a diagnosis after assignment. Missed targets raise the ticket priority and notify the assigned technician and admin once per day. On-hold tickets pause the diagnosis target and use their own review date.</p>
    {loading ? <div role="status"><Spinner /></div> : <div className="panel" style={{ maxWidth: 680 }}>
      <div className="field" style={{ maxWidth: 280 }}><label htmlFor="repair-diagnosis-sla">Diagnosis target (hours)</label><input id="repair-diagnosis-sla" type="number" min={1} max={168} step={1} value={diagnosisSlaHours} onChange={(e) => setDiagnosisSlaHours(Number(e.target.value))} /></div>
      <p className="muted" style={{ marginTop: 0 }}>Range: 1–168 hours. The default is 24 hours. This setting applies when a ticket is assigned or taken off hold; existing deadlines stay as they are.</p>
      {error && <p role="alert" className="error-text">{error}</p>}
      <RippleButton onClick={save} loading={saving} disabled={loading || !Number.isInteger(diagnosisSlaHours) || diagnosisSlaHours < 1 || diagnosisSlaHours > 168}>Save workflow settings</RippleButton>
    </div>}
  </section>;
}

// ===================== TICKETS =====================

interface TicketForm {
  status: string;
  priority: string;
  assignedTo: string;
  etaAt: string;
  scheduledAt: string;
  scheduledDurationMinutes: number;
  diagnosis: string;
  holdReason: string;
  holdRemindAt: string;
  hardwareValue: string;
  softwareInstall: boolean;
  softwareLicense: boolean;
}

function TicketsTab({ openId, onOpen, canManagePayments, canVoidPayments }: { openId: string | null; onOpen: (id: string | null) => void; canManagePayments: boolean; canVoidPayments: boolean }) {
  const feedback = useFeedback();
  const [tickets, setTickets] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [techFilter, setTechFilter] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [form, setForm] = useState<TicketForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [saving, setSaving] = useState(false);
  const [noteMsg, setNoteMsg] = useState("");
  const [noteVisible, setNoteVisible] = useState(true);
  const [partForm, setPartForm] = useState({ description: "", quantity: 1, unitCost: 0 });
  const [assetSerials, setAssetSerials] = useState<any[]>([]);
  const [assetWarranties, setAssetWarranties] = useState<any[]>([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [paymentLedger, setPaymentLedger] = useState<any>(null);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentRequestKey, setPaymentRequestKey] = useState("");
  const [paymentForm, setPaymentForm] = useState({ kind: "payment", amount: "", paymentMethod: "mpesa", reference: "", relatedPaymentId: "", reason: "" });

  async function loadList() {
    setLoading(true);
    setListError("");
    try {
      const q: string[] = [];
      if (statusFilter) q.push(`status=${encodeURIComponent(statusFilter)}`);
      if (techFilter) q.push(`assignedTo=${encodeURIComponent(techFilter)}`);
      const url = `/api/repairs${q.length ? "?" + q.join("&") : ""}`;
      const d = await api<{ tickets: any[] }>(url);
      setTickets(d.tickets || []);
    } catch (e: any) { setListError(e?.message || "Repair tickets could not be loaded. Please try again."); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadList(); }, [statusFilter, techFilter]);

  useEffect(() => {
    api<{ staff: any[] }>("/api/staff/technicians").then((d) => setStaff(d.staff || [])).catch(() => {});
  }, []);

  async function loadDetail(id: string) {
    setDetailLoading(true);
    setDetailError("");
    setDetail(null);
    setForm(null);
    setPaymentLedger(null);
    setPaymentError("");
    try {
      const d = await api<any>(`/api/repairs/${id}`);
      setDetail(d);
      if (canManagePayments) {
        try { setPaymentLedger(await api<any>(`/api/repairs/${id}/payments`)); }
        catch (e: any) { setPaymentError(e?.message || "The repair payment ledger could not be loaded."); }
      }
      if (d.customerId) {
        setAssetLoading(true);
        const [s, w] = await Promise.all([
          api<{ serials: any[] }>(`/api/serials?customerId=${d.customerId}`).catch(() => null),
          api<{ warranties: any[] }>(`/api/admin/warranties?customerId=${d.customerId}`).catch(() => null),
        ]);
        setAssetSerials(s?.serials || []);
        setAssetWarranties(w?.warranties || []);
        setAssetLoading(false);
      } else {
        setAssetSerials([]);
        setAssetWarranties([]);
        setAssetLoading(false);
      }
      setForm({
        status: d.status || "received",
        priority: d.priority || "normal",
        assignedTo: d.assignedTo != null ? String(d.assignedTo) : "",
        etaAt: d.etaAt ? String(d.etaAt).slice(0, 10) : "",
        scheduledAt: d.scheduledAt ? String(d.scheduledAt).replace(" ", "T").slice(0, 16) : "",
        scheduledDurationMinutes: Number(d.scheduledDurationMinutes) || 60,
        diagnosis: d.diagnosis || "",
        holdReason: d.holdReason || "",
        holdRemindAt: d.holdRemindAt ? (() => { const date = new Date(d.holdRemindAt); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); })() : "",
        hardwareValue: String(d.hardwareValue || 0),
        softwareInstall: Boolean(d.softwareInstall),
        softwareLicense: Boolean(d.softwareLicense),
      });
    } catch (e: any) {
      setDetail(null);
      setForm(null);
      setDetailError(e?.message || "Ticket details could not be loaded. Please try again.");
    } finally {
      setAssetLoading(false);
      setDetailLoading(false);
    }
  }

  function selectTicket(t: any) {
    const next = detail?.id === t.id ? null : t.id;
    if (!next) { setDetail(null); setForm(null); setDetailError(""); }
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
          priority: form.priority,
          assignedTo: form.assignedTo ? Number(form.assignedTo) : null,
          etaAt: form.etaAt || null,
          scheduledAt: form.scheduledAt || null,
          scheduledDurationMinutes: form.scheduledDurationMinutes,
          diagnosis: form.diagnosis,
          holdReason: form.holdReason,
          holdRemindAt: form.holdRemindAt ? new Date(form.holdRemindAt).toISOString() : null,
          hardwareValue: Number(form.hardwareValue) || 0,
          softwareInstall: form.softwareInstall,
          softwareLicense: form.softwareLicense,
        }),
      });
      await loadDetail(detail.id);
      await loadList();
      feedback.success({ title: "Repair updated", message: `Repair #${detail.id} was saved.` });
    } catch (e: any) { feedback.error({ title: "Repair not updated", message: e.message }); }
    finally { setSaving(false); }
  }

  async function sendQuote() {
    if (!detail) return;
    try {
      await api(`/api/repairs/${detail.id}/send-quote`, { method: "POST" });
      await loadDetail(detail.id);
      feedback.success({ title: "Quote PDF emailed", message: `The estimate PDF for repair #${detail.id} was emailed to the customer.` });
    } catch (e: any) { feedback.error({ title: "Quote not sent", message: e.message }); }
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
      feedback.success({ title: "Part added", message: `${partForm.quantity} × ${partForm.description || "part"} added to the repair.` });
    } catch (e: any) { feedback.error({ title: "Part not added", message: e.message }); }
  }

  async function removePart(partId: number) {
    if (!detail) return;
    try {
      await api(`/api/repairs/${detail.id}/parts/${partId}`, { method: "DELETE" });
      await loadDetail(detail.id);
      feedback.success({ title: "Part removed" });
    } catch (e: any) { feedback.error({ title: "Part not removed", message: e.message }); }
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
      feedback.success({ title: "Update added" });
    } catch (e: any) { feedback.error({ title: "Update not added", message: e.message }); }
  }

  async function saveRepairPayment() {
    if (!detail) return;
    setPaymentSaving(true);
    setPaymentError("");
    try {
      const requestKey = paymentRequestKey || crypto.randomUUID();
      if (!paymentRequestKey) setPaymentRequestKey(requestKey);
      const selectedOriginal = paymentLedger?.entries?.find((entry: any) => String(entry.id) === paymentForm.relatedPaymentId);
      const entry = await api<any>(`/api/repairs/${detail.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          kind: paymentForm.kind,
          amount: paymentForm.amount,
          paymentMethod: paymentForm.kind === "refund" ? selectedOriginal?.paymentMethod : paymentForm.paymentMethod,
          reference: paymentForm.reference,
          relatedPaymentId: paymentForm.kind === "refund" ? Number(paymentForm.relatedPaymentId) : null,
          reason: paymentForm.reason,
          idempotencyKey: requestKey,
        }),
      });
      setPaymentLedger(entry);
      setPaymentForm({ kind: "payment", amount: "", paymentMethod: "mpesa", reference: "", relatedPaymentId: "", reason: "" });
      setPaymentRequestKey("");
      await loadDetail(detail.id);
      feedback.success({ title: paymentForm.kind === "payment" ? "Payment recorded" : "Refund recorded", message: "The repair ledger and internal ticket history have been updated." });
    } catch (e: any) {
      setPaymentError(e?.message || "The ledger entry could not be saved.");
      feedback.error({ title: "Ledger entry not saved", message: e?.message || "Please review the amount, reference and remaining balance." });
    } finally { setPaymentSaving(false); }
  }

  async function voidPaymentEntry(entry: any) {
    if (!detail || !canVoidPayments || entry.voided || entry.kind === "void") return;
    if (!window.confirm(`Void ${entry.kind} ${entry.reference} for ${formatPrice(entry.amount)}? The original record will remain in the audit history.`)) return;
    const reason = window.prompt("Enter the reason for voiding this entry:")?.trim();
    if (!reason) return;
    setPaymentSaving(true);
    setPaymentError("");
    try {
      const ledger = await api<any>(`/api/repairs/${detail.id}/payments/${entry.id}/void`, {
        method: "POST",
        body: JSON.stringify({ reason, idempotencyKey: crypto.randomUUID() }),
      });
      setPaymentLedger(ledger);
      await loadDetail(detail.id);
      feedback.success({ title: "Entry voided", message: "The original entry remains in history and is excluded from active totals." });
    } catch (e: any) {
      setPaymentError(e?.message || "The entry could not be voided.");
      feedback.error({ title: "Entry not voided", message: e?.message || "Please review the entry and try again." });
    } finally { setPaymentSaving(false); }
  }

  const paymentRefundedByReceipt = new Map<number, number>();
  for (const entry of paymentLedger?.entries || []) if (entry.kind === "refund" && !entry.voided && entry.relatedPaymentId != null) {
    paymentRefundedByReceipt.set(entry.relatedPaymentId, (paymentRefundedByReceipt.get(entry.relatedPaymentId) || 0) + Number(entry.amount || 0));
  }
  const refundableReceipts = (paymentLedger?.entries || []).filter((entry: any) => entry.kind === "payment" && !entry.voided && Number(entry.amount) - (paymentRefundedByReceipt.get(Number(entry.id)) || 0) > 0.009);

  const partsTotal = Array.isArray(detail?.parts)
    ? detail.parts.reduce((s: number, p: any) => s + (Number(p.unitCost) || 0) * (Number(p.quantity) || 1), 0)
    : 0;
  const quotePending = detail?.quoteDeliveryStatus === "sending" && !!detail?.quoteSentAt && Date.now() - Date.parse(String(detail.quoteSentAt)) < 30 * 60 * 1000;
  const quoteActive = detail?.quoteDeliveryStatus === "sent" && !!detail?.quoteSentAt && Date.parse(String(detail.quoteExpiresAt || "")) > Date.now();
  const quoteSent = quotePending || quoteActive;
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
        {!listError && <span className="muted">{tickets.length} ticket(s)</span>}
      </div>

      {loading ? <Spinner /> : listError ? (
        <EmptyState icon="repairs" title="Couldn't load repair tickets" description={listError} actionLabel="Try again" onAction={() => void loadList()} />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>#</th><th>Priority</th><th>Request</th><th>Customer</th><th>Device</th><th>Status</th><th>Technician</th><th>ETA</th><th>Scheduled</th><th>Quote</th><th></th></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td><span className="plan-status" style={t.priority === "critical" ? { background: "var(--danger-light)", color: "var(--danger-text)" } : t.priority === "high" ? { background: "var(--warning-light)", color: "var(--warning-text)" } : undefined}>{String(t.priority || "normal").toUpperCase()}</span></td>
                  <td><span className="plan-status">{t.serviceKind === "planned_service" ? "Planned service" : "Diagnosis / repair"}</span></td>
                  <td>{t.customerName || ""}</td>
                  <td>{t.deviceType ? [t.deviceBrand, t.deviceType, t.deviceModel].filter(Boolean).join(" ") : "—"}{t.serialNumber && <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>SN {t.serialNumber}</span>}</td>
                  <td>{statusBadge(t.status)}</td>
                  <td>{t.assignedName ? t.assignedName : <span className="muted">Unassigned</span>}</td>
                  <td>{t.etaAt ? fmtDate(t.etaAt) : "—"}</td>
                  <td>{t.scheduledAt ? new Date(t.scheduledAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td>
                    {t.quoteDeliveryStatus === "expired" ? (
                      <span className="plan-status" style={{ background: "var(--danger-light)", color: "var(--danger-text)" }}>Expired · v{t.quoteVersion}</span>
                    ) : t.quoteSentAt ? (
                      <span className="plan-status" style={{ background: t.quoteResponse === "accepted" ? "var(--success-light)" : t.quoteResponse === "declined" ? "var(--danger-light)" : "var(--warning-light)", color: t.quoteResponse === "accepted" ? "var(--success-text)" : t.quoteResponse === "declined" ? "var(--danger-text)" : "var(--warning-text)" }}>
                        {t.quoteResponse || "Sent"}{t.quoteVersion ? ` · v${t.quoteVersion}` : " · legacy"}
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
                <tr><td colSpan={11}><EmptyState icon="repairs" title="No repair tickets" description="No repair tickets match the current filters. Clear the filters to see all tickets." actionLabel="Clear filters" onAction={() => { setStatusFilter(""); setTechFilter(""); }} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {detailLoading && <div className="panel" role="status" style={{ marginTop: "1rem" }}><Spinner /></div>}
      {detailError && !detailLoading && (
        <EmptyState icon="repairs" title="Couldn't load ticket details" description={detailError} actionLabel="Try again" onAction={() => openId && void loadDetail(openId)} />
      )}
      {detail && form && (
        <div className="panel" style={{ marginTop: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ minWidth: 0, maxWidth: "70ch" }}>
              <h3 style={{ margin: 0 }}>Ticket #{detail.id} — {[detail.deviceBrand, detail.deviceType, detail.deviceModel].filter(Boolean).join(" ")}</h3>
              <span className="plan-status" style={{ marginTop: "0.4rem" }}>{detail.serviceKind === "planned_service" ? "Planned service · no diagnosis deadline" : "Diagnosis / repair"}</span>
              {detail.issueSummary && <p style={{ margin: "0.5rem 0 0", fontWeight: 600 }}>{detail.issueSummary}</p>}
              <p className="muted" style={{ margin: "0.35rem 0 0" }}>{detail.issueDescription}</p>
            </div>
            {statusBadge(detail.status)}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: "0.5rem 1.5rem", marginTop: "1.25rem", padding: "0.75rem 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div className="input-label">Customer</div>
              <div>{detail.customerName}</div>
            </div>
            <div>
              <div className="input-label">Email</div>
              <div>{detail.customerEmail || "—"}</div>
            </div>
            {detail.deviceModel ? (
              <div>
                <div className="input-label">Device model</div>
                <div>{detail.deviceModel}</div>
              </div>
            ) : null}
            {detail.serialNumber ? (
              <div>
                <div className="input-label">Serial number</div>
                <div>{detail.serialNumber}</div>
              </div>
            ) : null}
            {(detail.requestedVisitDate || detail.requestedVisitTime) ? (
              <div>
                <div className="input-label">Customer requested drop-off</div>
                <div>{[detail.requestedVisitDate, detail.requestedVisitTime].filter(Boolean).join(" · ")}</div>
              </div>
            ) : null}
            {detail.customerNotes ? (
              <div>
                <div className="input-label">Customer notes</div>
                <div>{detail.customerNotes}</div>
              </div>
            ) : null}
            {detail.repairTypeName ? (
              <div>
                <div className="input-label">Repair type</div>
                <div>{detail.repairTypeName}</div>
              </div>
            ) : null}
            <div>
              <div className="input-label">Reported</div>
              <div>{detail.createdAt ? fmtDate(detail.createdAt) : "—"}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: "0 0.75rem", marginTop: "1.25rem" }}>
            <div className="field"><label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></label></div>
            <div className="field"><label>Priority<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label></div>
            <div className="field"><label>Technician<select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.username}</option>)}</select></label></div>
            <div className="field"><label>ETA date<input type="date" value={form.etaAt} onChange={(e) => setForm({ ...form, etaAt: e.target.value })} /></label></div>
            <div className="field"><label>Schedule (calendar)<input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></label></div>
            <div className="field"><label>Appointment length (minutes)<input type="number" min={15} max={480} step={15} value={form.scheduledDurationMinutes} onChange={(e) => setForm({ ...form, scheduledDurationMinutes: Number(e.target.value) })} /><small className="muted">15 minutes to 8 hours. Default: 60 minutes.</small></label></div>
          </div>

          {form.status === "on_hold" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: "0 0.75rem", padding: "0.75rem 0", borderTop: "1px solid var(--border)" }}>
            <div className="field"><label>Why is this on hold? <span aria-hidden="true">*</span><textarea rows={2} maxLength={500} required value={form.holdReason} onChange={(e) => setForm({ ...form, holdReason: e.target.value })} placeholder="For example, waiting for the customer's approval" /></label></div>
            <div className="field"><label>Remind technician on <span aria-hidden="true">*</span><input type="datetime-local" required value={form.holdRemindAt} onChange={(e) => setForm({ ...form, holdRemindAt: e.target.value })} /></label><small className="muted">After this time, the assigned technician and admin receive a daily reminder until the ticket leaves On hold.</small></div>
          </div>}

          {detail.diagnosisDueAt && !detail.diagnosis && <p className="muted" role="status">Diagnosis target: {new Date(detail.diagnosisDueAt).toLocaleString("en-GB")} · Priority rises if the target is missed.</p>}

          <div className="field"><label>{detail.serviceKind === "planned_service" ? "Service / installation notes (optional)" : "Diagnosis"}<textarea rows={3} value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></label></div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: "0 0.75rem" }}>
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
              <RippleButton onClick={saveDetail} loading={saving}>Save changes</RippleButton>
              <RippleButton variant="secondary" onClick={sendQuote} disabled={quoteSent}>
                {quotePending ? "Sending quote…" : quoteActive ? `Quote v${detail.quoteVersion} sent` : detail.quoteDeliveryStatus === "sent" ? "Send updated estimate" : "Send quote PDF to customer"}
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
              {quotePending ? `Quote v${detail.quoteVersion} is being emailed.` : quoteAccepted ? `Customer accepted quote v${detail.quoteVersion}` : quoteDeclined ? `Customer declined quote v${detail.quoteVersion}` : `Quote v${detail.quoteVersion} sent — awaiting response. Expires ${new Date(String(detail.quoteExpiresAt)).toLocaleDateString("en-KE")}.`}
            </div>
          )}
          {!quoteSent && detail.quoteDeliveryStatus === "expired" && <p role="status" className="muted">Quote v{detail.quoteVersion} expired on {new Date(String(detail.quoteExpiresAt)).toLocaleDateString("en-KE")}. Send an updated estimate when ready.</p>}

          {canManagePayments && <section aria-labelledby="repair-payments-heading" style={{ marginTop: "1.75rem", borderTop: "1px solid var(--border)", paddingTop: "1.25rem" }}>
            <h4 id="repair-payments-heading" style={{ margin: "0 0 0.35rem" }}>Payments &amp; refunds</h4>
            <p className="muted" style={{ marginTop: 0 }}>Staff-entered reconciliation only. A saved entry is not confirmation from M-Pesa, a bank, or a card provider. Voids keep the original record and require a separate permission.</p>
            {paymentError && <p role="alert" className="error-text">{paymentError}</p>}
            {paymentLedger ? <>
              <div className="stat-grid" style={{ marginBottom: "0.75rem" }}>
                <div><div className="input-label">Current estimate</div><strong>{formatPrice(paymentLedger.summary.estimate)}</strong></div>
                <div><div className="input-label">Recorded received</div><strong>{formatPrice(paymentLedger.summary.received)}</strong></div>
                <div><div className="input-label">Recorded refunds</div><strong>{formatPrice(paymentLedger.summary.refunded)}</strong></div>
                <div><div className="input-label">Net recorded</div><strong>{formatPrice(paymentLedger.summary.netReceived)}</strong></div>
                <div><div className="input-label">Remaining vs estimate</div><strong>{formatPrice(paymentLedger.summary.balance)}</strong></div>
                <div><div className="input-label">Voided entries</div><strong>{paymentLedger.summary.voidedEntries}</strong></div>
              </div>
              {paymentLedger.entries.length > 0 && <div className="table-wrap" style={{ marginBottom: "0.75rem" }}><table className="data-table">
                <thead><tr><th>Recorded</th><th>Entry</th><th>Status</th><th>Method</th><th>Reference</th><th>Related entry</th><th>Reason</th><th>By</th><th style={{ textAlign: "right" }}>Amount</th><th></th></tr></thead>
                <tbody>{paymentLedger.entries.map((entry: any) => <tr key={entry.id}>
                  <td>{new Date(entry.createdAt).toLocaleString("en-GB")}</td><td>{entry.kind === "payment" ? "Payment" : entry.kind === "refund" ? "Refund" : "Void"}</td><td>{entry.voided ? `Voided${entry.voidedBy ? ` by ${entry.voidedBy}` : ""}` : entry.kind === "void" ? "Audit entry" : "Active"}</td><td>{entry.paymentMethod}</td><td>{entry.reference}</td><td>{entry.relatedReference || "—"}</td><td>{entry.kind === "void" ? entry.reason : entry.voided ? entry.voidReason : entry.reason || "—"}</td><td>{entry.createdBy}</td><td style={{ textAlign: "right" }}>{formatPrice(entry.amount)}</td><td>{canVoidPayments && entry.kind !== "void" && !entry.voided && <RippleButton size="small" variant="danger" loading={paymentSaving} onClick={() => voidPaymentEntry(entry)}>Void</RippleButton>}</td>
                </tr>)}</tbody>
              </table></div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))", alignItems: "end", gap: "0 0.75rem" }}>
                <div className="field"><label htmlFor="repair-ledger-kind">Entry type</label><select id="repair-ledger-kind" value={paymentForm.kind} onChange={(e) => setPaymentForm({ ...paymentForm, kind: e.target.value, relatedPaymentId: "" })}><option value="payment">Payment received</option><option value="refund">Refund issued</option></select></div>
                <div className="field"><label htmlFor="repair-ledger-amount">Amount (KES)</label><input id="repair-ledger-amount" type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></div>
                {paymentForm.kind === "payment" ? <div className="field"><label htmlFor="repair-ledger-method">Method</label><select id="repair-ledger-method" value={paymentForm.paymentMethod} onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}><option value="mpesa">M-Pesa</option><option value="cash">Cash</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></div> : <div className="field"><label htmlFor="repair-ledger-original">Original receipt</label><select id="repair-ledger-original" value={paymentForm.relatedPaymentId} onChange={(e) => setPaymentForm({ ...paymentForm, relatedPaymentId: e.target.value })}><option value="">Choose receipt</option>{refundableReceipts.map((receipt: any) => <option key={receipt.id} value={receipt.id}>{receipt.reference} · {receipt.paymentMethod} · refundable {formatPrice(Number(receipt.amount) - (paymentRefundedByReceipt.get(Number(receipt.id)) || 0))}</option>)}</select></div>}
                <div className="field"><label htmlFor="repair-ledger-reference">Receipt / refund reference</label><input id="repair-ledger-reference" maxLength={128} value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} /></div>
                {paymentForm.kind === "refund" && <div className="field"><label htmlFor="repair-ledger-reason">Refund reason</label><input id="repair-ledger-reason" maxLength={500} value={paymentForm.reason} onChange={(e) => setPaymentForm({ ...paymentForm, reason: e.target.value })} /></div>}
                <RippleButton onClick={saveRepairPayment} loading={paymentSaving} disabled={!paymentLedger || (paymentForm.kind === "refund" && (!paymentForm.relatedPaymentId || !paymentForm.reason.trim())) || !paymentForm.amount || !paymentForm.reference.trim()}>{paymentForm.kind === "payment" ? "Record payment" : "Record refund"}</RippleButton>
              </div>
            </> : <p className="muted" role="status">{paymentError ? "Ledger unavailable." : "Loading payment ledger…"}</p>}
          </section>}

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
                        <td>{p.description}</td>
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
              <ul className="timeline" style={{ marginBottom: "0.75rem" }}>
                {detail.updates.map((u: any) => (
                  <li key={u.id} className="timeline-item done">
                    <span className="timeline-dot" aria-hidden="true" />
                    <div className="timeline-title">
                      {u.staffName || "Staff"}
                      {!u.customerVisible && <span className="badge badge-default" style={{ marginLeft: "0.5rem" }}>Internal</span>}
                    </div>
                    <div className="timeline-meta">{new Date(u.createdAt).toLocaleString("en-GB")}</div>
                    <div className="timeline-body" style={{ whiteSpace: "pre-wrap" }}>{u.message}</div>
                  </li>
                ))}
              </ul>
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

          {detail.customerId && (
            <div style={{ marginTop: "1.75rem", borderTop: "1px solid var(--border)", paddingTop: "1.25rem" }}>
              <h4 style={{ margin: "0 0 0.75rem" }}>Customer assets</h4>
              {assetLoading ? (
                <p className="muted">Loading assets…</p>
              ) : assetSerials.length > 0 ? (
                <div className="table-wrap" style={{ marginBottom: "0.75rem" }}>
                  <table className="data-table">
                    <thead><tr><th>Serial</th><th>Product</th><th>Sold</th><th>Warranty</th></tr></thead>
                    <tbody>
                      {assetSerials.map((s: any) => (
                        <tr key={s.serial_number}>
                          <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{s.serial_number}</td>
                          <td>{s.product_name || "—"}</td>
                          <td>{s.sold_at ? new Date(s.sold_at).toLocaleDateString("en-GB") : "—"}</td>
                          <td>{s.warranty_expires ? new Date(s.warranty_expires).toLocaleDateString("en-GB") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">No serialised assets found for this customer.</p>
              )}
              {assetWarranties.length > 0 && (
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  <strong style={{ color: "var(--text)" }}>{assetWarranties.length}</strong> item(s) under warranty —{" "}
                  <StatusBadge status="active" domain="warranty" />{" "}
                  <span className="muted">warranty register</span>
                </div>
              )}
            </div>
          )}
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
  const [error, setError] = useState("");

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError("");
    const from = localISODate(weekStart);
    const to = localISODate(addDays(weekStart, 7));
    try {
      const d = await api<{ tickets: any[] }>(`/api/repairs/calendar?from=${from}&to=${to}`);
      setTickets(d.tickets || []);
    } catch (e: any) {
      setError(e?.message || "The repair calendar could not be loaded. Please try again.");
    } finally { setLoading(false); }
  }, [weekStart]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

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

      {loading ? <Spinner /> : error ? (
        <EmptyState icon="repairs" title="Couldn't load the repair calendar" description={error} actionLabel="Try again" onAction={() => void loadCalendar()} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: "0.75rem" }}>
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
                      <div>{t.deviceType || ""}{t.deviceModel ? " " + t.deviceModel : ""}</div>
                      {t.assignedName && <div className="muted" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}><Icon name="user" size={12} /> {t.assignedName}</div>}
                      <div>{t.scheduledAt ? (() => { const start = new Date(t.scheduledAt); const end = new Date(start.getTime() + (Number(t.scheduledDurationMinutes) || 60) * 60000); const fmt = (date: Date) => date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); return `${fmt(start)}–${fmt(end)} · ${Number(t.scheduledDurationMinutes) || 60} min`; })() : ""} {statusBadge(t.status)}</div>
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
  const [loadError, setLoadError] = useState("");

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const [d, t] = await Promise.all([
        api<any>("/api/admin/repairs-page"),
        api<any>("/api/repairs/types").catch(() => ({ types: [] })),
      ]);
      setIntro(d.intro || "");
      setPanels(Array.isArray(d.panels) ? d.panels : []);
      setRepairTypes(t.types || []);
    } catch (e: any) { setLoadError(e?.message || "Repair page content could not be loaded. Please try again."); }
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
  if (loadError) return <EmptyState icon="repairs" title="Couldn't load repair page content" description={loadError} actionLabel="Try again" onAction={() => void load()} />;

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
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: "0.75rem" }}>
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
