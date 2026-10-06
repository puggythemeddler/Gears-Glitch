import React, { useEffect, useMemo, useState } from "react";
import { api, getStaffRole, getStaffPermissions, downloadPdf } from "@/lib/api";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import RippleButton from "@/components/RippleButton";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { confirmDialog, promptDialog } from "@/components/ConfirmDialog";
import { formatPrice, Spinner } from "./shared";

interface FinancingConfig {
  enabled: boolean;
  currency: string;
  minDepositCents: number;
  maxDepositCents: number | null;
  depositPercentMin: number | null;
  depositPercentMax: number | null;
  chargeModel: "fixed" | "percentage";
  chargeFixedCents: number | null;
  chargePercent: number | null;
  permittedFrequencies: string[];
  minTerm: number;
  maxTerm: number;
  gracePeriodDays: number;
  overdueThresholdDays: number;
  seriousOverdueThresholdDays: number;
  allowedPaymentMethods: string[];
  possessionModel: string;
  possessionThresholdCents: number | null;
  serialMandatory: boolean;
  guarantorRequired: boolean;
  manualApproval: boolean;
  onlineApplicationAllowed: boolean;
}

interface FinancingStats {
  enabled: boolean;
  currency: string;
  applications: { total: number; pending: number; approved: number; rejected: number };
  agreements: { active: number; completed: number; cancelled: number; overdue: number };
  totals: { financedCents: number; collectedCents: number; outstandingCents: number; overdueCents: number };
}

interface FinApplication {
  id: number;
  applicationNumber: string;
  customerId: number;
  customerName: string;
  customerPhone: string;
  productName: string;
  serialNumber: string;
  cashPriceCents: number;
  depositCents: number;
  frequency: string;
  termCount: number;
  firstDueDate: string | null;
  status: string;
  createdAt: string;
}

interface FinSchedule {
  id: number;
  sequence: number;
  dueDate: string;
  amountCents: number;
  amountPaidCents: number;
  waivedCents: number;
  status: string;
}

interface FinPayment {
  id: number;
  paymentRef: string;
  amountCents: number;
  method: string;
  status: string;
  source: string;
  mpesaReceipt: string | null;
  createdAt: string;
}

interface FinAgreement {
  id: number;
  agreementNumber: string;
  customerId: number;
  productName: string;
  serialNumber: string;
  cashPriceCents: number;
  depositCents: number;
  chargeCents: number;
  hpPriceCents: number;
  instalmentCents: number;
  termCount: number;
  frequency: string;
  firstDueDate: string | null;
  status: string;
  ownershipStatus: string;
  possessionStatus: string;
  totalPaidCents: number;
  outstandingCents: number;
  creditCents: number;
  schedules?: FinSchedule[];
  payments?: FinPayment[];
}

type Tab = "overview" | "applications" | "agreements" | "settings";

const FREQ_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  custom: "Custom",
};

function money(cents: number | null | undefined): string {
  return formatPrice((Number(cents) || 0) / 100);
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const first = String(s).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(first)) {
    const [y, m, d] = first.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB");
  }
  return new Date(s).toLocaleDateString("en-GB");
}

function toCents(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "applications", label: "Applications" },
  { key: "agreements", label: "Agreements" },
  { key: "settings", label: "Settings" },
];

export default function AdminFinancing() {
  const isAdmin = getStaffRole() === "admin" || getStaffRole() === "owner";
  const perms = getStaffPermissions();
  const canManage = isAdmin || perms.includes("financing:manage");
  const canApprove = isAdmin || perms.includes("financing:approve");
  const canPay = isAdmin || perms.includes("financing:payment");

  const [tab, setTab] = useState<Tab>("overview");
  const [config, setConfig] = useState<FinancingConfig | null>(null);
  const [stats, setStats] = useState<FinancingStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [c, s] = await Promise.all([
        api<FinancingConfig>("/api/financing/config"),
        api<FinancingStats>("/api/financing/stats"),
      ]);
      setConfig(c);
      setStats(s);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading && !config) return <Spinner />;
  if (error && !config) return <ErrorState message={error} onRetry={load} />;

  return (
    <>
      <h1>Lipa Mdogo Mdogo</h1>
      <p className="page-intro">
        Hire-purchase instalment plans: applications, agreements, schedules, payments and possession. All amounts are
        calculated and stored on the server.
      </p>

      {config && !config.enabled && (
        <div className="panel" style={{ borderColor: "var(--warning)", marginBottom: "1rem" }}>
          <strong>Financing is currently disabled.</strong>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            Customers cannot apply and no new agreements can be created until you enable it on the Settings tab.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {TABS.map((t) => (
          <RippleButton key={t.key} size="small" variant={tab === t.key ? "primary" : "ghost"} onClick={() => setTab(t.key)}>
            {t.label}
          </RippleButton>
        ))}
      </div>

      {tab === "overview" && <Overview stats={stats} onRefresh={load} canManage={canManage} config={config} />}
      {tab === "applications" && <Applications canManage={canManage} canApprove={canApprove} config={config} />}
      {tab === "agreements" && <Agreements canManage={canManage} canPay={canPay} config={config} />}
      {tab === "settings" && <Settings config={config!} canManage={canManage} onSaved={load} />}
    </>
  );
}

function Overview({ stats, onRefresh, canManage, config }: { stats: FinancingStats | null; onRefresh: () => void; canManage: boolean; config: FinancingConfig | null }) {
  const feedback = useFeedback();
  const [busy, setBusy] = useState(false);
  if (!stats) return <Spinner />;
  return (
    <>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-card__value">{stats.agreements.active}</div><div className="stat-card__label">Active agreements</div></div>
        <div className="stat-card"><div className="stat-card__value" style={{ color: "var(--danger)" }}>{stats.agreements.overdue}</div><div className="stat-card__label">Overdue agreements</div></div>
        <div className="stat-card"><div className="stat-card__value">{money(stats.totals.outstandingCents)}</div><div className="stat-card__label">Outstanding</div></div>
        <div className="stat-card"><div className="stat-card__value">{money(stats.totals.collectedCents)}</div><div className="stat-card__label">Collected to date</div></div>
      </div>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-card__value">{stats.applications.total}</div><div className="stat-card__label">Applications</div></div>
        <div className="stat-card"><div className="stat-card__value" style={{ color: "var(--warning)" }}>{stats.applications.pending}</div><div className="stat-card__label">Awaiting review</div></div>
        <div className="stat-card"><div className="stat-card__value">{stats.agreements.completed}</div><div className="stat-card__label">Completed</div></div>
        <div className="stat-card"><div className="stat-card__value" style={{ color: "var(--danger)" }}>{money(stats.totals.overdueCents)}</div><div className="stat-card__label">Overdue amount</div></div>
      </div>
      {canManage && (
        <div style={{ marginTop: "1rem" }}>
          <RippleButton
            size="small"
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api<{ updated: number }>("/api/financing/refresh-overdue", { method: "POST" });
                feedback.success({ title: `Recalculated ${r.updated} schedule${r.updated === 1 ? "" : "s"}` });
                onRefresh();
              } catch (e: any) {
                feedback.error({ title: "Schedules not recalculated", message: e.message });
              } finally {
                setBusy(false);
              }
            }}
          >
            Recalculate overdue
          </RippleButton>
        </div>
      )}
      {config && (
        <p className="muted" style={{ marginTop: "1rem" }}>
          Charge model: {config.chargeModel === "fixed" ? `${money(config.chargeFixedCents || 0)} per agreement` : `${config.chargePercent ?? 0}% of price`}. Possession: {config.possessionModel.replace(/_/g, " ")}.
        </p>
      )}
    </>
  );
}

function Applications({ canManage, canApprove, config }: { canManage: boolean; canApprove: boolean; config: FinancingConfig | null }) {
  const [apps, setApps] = useState<FinApplication[] | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setError("");
    try {
      const q = status ? `?status=${encodeURIComponent(status)}` : "";
      setApps(await api<FinApplication[]>(`/api/financing/applications${q}`));
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, [status]);

  const filtered = useMemo(() => {
    let list = apps || [];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((a) => (a.customerName || "").toLowerCase().includes(q) || (a.applicationNumber || "").toLowerCase().includes(q) || (a.productName || "").toLowerCase().includes(q));
    return list;
  }, [apps, search]);

  return (
    <>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter applications by status">
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, number, product…" aria-label="Search applications" style={{ minWidth: 220 }} />
        <span className="muted">{filtered.length} application{filtered.length === 1 ? "" : "s"}</span>
        <span style={{ flex: 1 }} />
        {canManage && <RippleButton size="small" variant="primary" onClick={() => setShowForm((v) => !v)}>{showForm ? "Close" : "New application"}</RippleButton>}
      </div>

      {showForm && canManage && <ApplicationForm config={config} onCreated={() => { setShowForm(false); load(); }} />}

      {error ? <ErrorState message={error} onRetry={load} /> : apps === null ? <Spinner /> : (
        <DataTable
          ariaLabel="Financing applications"
          rows={filtered}
          rowKey={(a) => a.id}
          defaultSort={{ key: "created", dir: "desc" }}
          columns={[
            { key: "number", label: "Application", render: (a) => <>{a.applicationNumber}</> },
            { key: "customer", label: "Customer", render: (a) => <>{a.customerName}<span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>{a.customerPhone || ""}</span></> },
            { key: "product", label: "Product", render: (a) => <>{a.productName || "—"}{a.serialNumber && <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>SN {a.serialNumber}</span>}</> },
            { key: "price", label: "Cash price", align: "right", value: (a) => a.cashPriceCents, render: (a) => money(a.cashPriceCents) },
            { key: "terms", label: "Terms", render: (a) => `${a.termCount} × ${FREQ_LABEL[a.frequency] || a.frequency}` },
            { key: "status", label: "Status", render: (a) => <StatusBadge status={a.status} domain="financingApplication" /> },
            { key: "created", label: "Created", value: (a) => a.createdAt || "", render: (a) => fmtDate(a.createdAt) },
            {
              key: "actions", label: "", render: (a) => <ApplicationActions app={a} canManage={canManage} canApprove={canApprove} onDone={load} />,
            },
          ]}
          empty={<EmptyState icon="invoices" title="No applications" description="Financing applications appear here when customers apply online or staff raise one in-store." />}
        />
      )}
    </>
  );
}

function ApplicationActions({ app, canManage, canApprove, onDone }: { app: FinApplication; canManage: boolean; canApprove: boolean; onDone: () => void }) {
  const feedback = useFeedback();
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<any>, msg: string) {
    setBusy(true);
    try { await fn(); feedback.success({ title: msg.replace(/\.$/, "") }); onDone(); } catch (e: any) { feedback.error({ title: "Action failed", message: e.message }); } finally { setBusy(false); }
  }
  if (app.status === "draft" && canManage) {
    return <RippleButton size="small" variant="primary" disabled={busy} onClick={() => run(() => api(`/api/financing/applications/${app.id}/submit`, { method: "POST" }), "Application submitted.")}>Submit</RippleButton>;
  }
  if (app.status === "submitted" && canManage) {
    return <RippleButton size="small" variant="secondary" disabled={busy} onClick={() => run(() => api(`/api/financing/applications/${app.id}`, { method: "PATCH", body: JSON.stringify({ status: "under_review" }) }), "Moved to review.")}>Start review</RippleButton>;
  }
  if ((app.status === "submitted" || app.status === "under_review") && canApprove) {
    return (
      <span style={{ display: "inline-flex", gap: "0.4rem" }}>
        <RippleButton size="small" variant="primary" disabled={busy} onClick={async () => {
          if (!(await confirmDialog({ title: "Approve application", message: `Approve ${app.applicationNumber} and create the agreement?`, confirmLabel: "Approve" }))) return;
          run(() => api(`/api/financing/applications/${app.id}/approve`, { method: "POST", body: JSON.stringify({ approve: true }) }), "Application approved.");
        }}>Approve</RippleButton>
        <RippleButton size="small" variant="ghost" disabled={busy} onClick={async () => {
          const reason = await promptDialog({ title: "Reject application", label: "Reason", message: "This is recorded on the application.", confirmLabel: "Reject", danger: true });
          if (reason === null) return;
          run(() => api(`/api/financing/applications/${app.id}/approve`, { method: "POST", body: JSON.stringify({ approve: false, reason }) }), "Application rejected.");
        }}>Reject</RippleButton>
      </span>
    );
  }
  return <span className="muted" style={{ fontSize: "0.8rem" }}>—</span>;
}

function ApplicationForm({ config, onCreated }: { config: FinancingConfig | null; onCreated: () => void }) {
  const feedback = useFeedback();
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [cashPrice, setCashPrice] = useState("");
  const [depositPercent, setDepositPercent] = useState("0");
  const [frequency, setFrequency] = useState(config?.permittedFrequencies?.[0] || "weekly");
  const [termCount, setTermCount] = useState(String(config?.minTerm || 4));
  const [firstDueDate, setFirstDueDate] = useState("");
  const [possessionModel, setPossessionModel] = useState(config?.possessionModel || "immediate");
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorPhone, setGuarantorPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [consent, setConsent] = useState(false);
  const [submit, setSubmit] = useState(true);
  const [quote, setQuote] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ customers: any[] }>("/api/admin/customers").then((d) => setCustomers(d.customers || [])).catch(() => {});
    api<{ products: any[] }>("/api/products?includeHidden=1").then((d) => setProducts(d.products || [])).catch(() => {});
  }, []);

  function pickProduct(id: string) {
    setProductId(id);
    const p = products.find((x) => String(x.id) === id);
    if (p) { setProductName(p.name || ""); setCashPrice(String(p.salePrice && p.salePrice > 0 ? p.salePrice : p.price || "")); }
  }

  const payload = () => ({
    customerId: Number(customerId),
    productId: productId || null,
    productName: productName || "",
    cashPriceCents: cashPrice ? toCents(cashPrice) : undefined,
    depositPercent: depositPercent ? Number(depositPercent) : undefined,
    frequency,
    termCount: Number(termCount),
    firstDueDate: firstDueDate || null,
    possessionModel,
    possessionThresholdCents: possessionModel === "threshold" ? toCents(cashPrice || "0") : undefined,
    guarantorName: guarantorName || undefined,
    guarantorPhone: guarantorPhone || undefined,
    customerNationalId: nationalId || undefined,
    consent,
  });

  async function preview() {
    setBusy(true);
    try {
      const body: any = { ...payload() };
      if (body.productId) { delete body.cashPriceCents; }
      setQuote(await api("/api/financing/quote", { method: "POST", body: JSON.stringify(body) }));
    } catch (e: any) { feedback.error({ title: "Quote unavailable", message: e.message }); } finally { setBusy(false); }
  }

  async function create() {
    if (!customerId) { feedback.error({ title: "Select a customer" }); return; }
    if (!consent) { feedback.error({ title: "Customer consent is required" }); return; }
    setBusy(true);
    try {
      await api("/api/financing/applications", { method: "POST", body: JSON.stringify({ ...payload(), submit }) });
      feedback.success({ title: "Application created" });
      onCreated();
    } catch (e: any) { feedback.error({ title: "Application not created", message: e.message }); } finally { setBusy(false); }
  }

  return (
    <div className="panel" style={{ marginBottom: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>New application</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
        <label>Customer
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} aria-label="Customer">
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>)}
          </select>
        </label>
        <label>Product (optional)
          <select value={productId} onChange={(e) => pickProduct(e.target.value)} aria-label="Product">
            <option value="">Custom amount…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>Item name
          <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. HP EliteBook 840" />
        </label>
        <label>Cash price (KES)
          <input type="number" min="0" value={cashPrice} onChange={(e) => setCashPrice(e.target.value)} disabled={!!productId} />
        </label>
        <label>Deposit (%)
          <input type="number" min="0" max="100" value={depositPercent} onChange={(e) => setDepositPercent(e.target.value)} />
        </label>
        <label>Frequency
          <select value={frequency} onChange={(e) => setFrequency(e.target.value)} aria-label="Frequency">
            {(config?.permittedFrequencies || ["weekly", "monthly"]).map((f) => <option key={f} value={f}>{FREQ_LABEL[f] || f}</option>)}
          </select>
        </label>
        <label>Number of instalments
          <input type="number" min={config?.minTerm || 1} max={config?.maxTerm || 52} value={termCount} onChange={(e) => setTermCount(e.target.value)} />
        </label>
        <label>First due date
          <input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} />
        </label>
        <label>Possession
          <select value={possessionModel} onChange={(e) => setPossessionModel(e.target.value)} aria-label="Possession model">
            <option value="immediate">Immediate (after deposit)</option>
            <option value="threshold">After threshold</option>
            <option value="on_full_payment">After full payment</option>
          </select>
        </label>
        <label>Guarantor name
          <input value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)} />
        </label>
        <label>Guarantor phone
          <input value={guarantorPhone} onChange={(e) => setGuarantorPhone(e.target.value)} />
        </label>
        <label>Customer national ID
          <input value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
        </label>
      </div>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.75rem" }}>
        <label style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> Customer has given informed consent
        </label>
        <label style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
          <input type="checkbox" checked={submit} onChange={(e) => setSubmit(e.target.checked)} /> Submit for review now
        </label>
        <span style={{ flex: 1 }} />
        <RippleButton size="small" variant="secondary" disabled={busy} onClick={preview}>Preview</RippleButton>
        <RippleButton size="small" variant="primary" disabled={busy} onClick={create}>Create application</RippleButton>
      </div>
      {quote && (
        <div className="panel" style={{ marginTop: "0.75rem", background: "var(--surface-2)" }}>
          <strong>Preview:</strong> {money(quote.instalmentCents)} × {quote.termCount} {FREQ_LABEL[quote.frequency] || quote.frequency}
          {quote.finalInstalmentCents && quote.finalInstalmentCents !== quote.instalmentCents ? ` (final ${money(quote.finalInstalmentCents)})` : ""} · HP price {money(quote.hpPriceCents)} · balance {money(quote.financedBalanceCents)}
        </div>
      )}
    </div>
  );
}

function Agreements({ canManage, canPay, config }: { canManage: boolean; canPay: boolean; config: FinancingConfig | null }) {
  const feedback = useFeedback();
  const [agreements, setAgreements] = useState<FinAgreement[] | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [selected, setSelected] = useState<FinAgreement | null>(null);

  async function load() {
    setError("");
    try {
      const q = new URLSearchParams();
      if (status) q.set("status", status);
      if (overdue) q.set("overdue", "true");
      setAgreements(await api<FinAgreement[]>(`/api/financing/agreements${q.toString() ? `?${q}` : ""}`));
    } catch (e: any) { setError(e.message); }
  }
  useEffect(() => { load(); }, [status, overdue]);

  async function open(a: FinAgreement) {
    try { setSelected(await api<FinAgreement>(`/api/financing/agreements/${a.id}`)); } catch (e: any) { feedback.error({ title: "Agreement unavailable", message: e.message }); }
  }

  return (
    <>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter agreements by status">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <label style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
          <input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} /> Overdue only
        </label>
        <span className="muted">{agreements?.length ?? 0} agreement{(agreements?.length ?? 0) === 1 ? "" : "s"}</span>
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : agreements === null ? <Spinner /> : (
        <DataTable
          ariaLabel="Financing agreements"
          rows={agreements}
          rowKey={(a) => a.id}
          defaultSort={{ key: "created", dir: "desc" }}
          columns={[
            { key: "number", label: "Agreement", render: (a) => a.agreementNumber },
            { key: "product", label: "Product", render: (a) => <>{a.productName || "—"}{a.serialNumber && <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>SN {a.serialNumber}</span>}</> },
            { key: "instalment", label: "Instalment", align: "right", value: (a) => a.instalmentCents, render: (a) => `${money(a.instalmentCents)} / ${FREQ_LABEL[a.frequency] || a.frequency}` },
            { key: "paid", label: "Paid", align: "right", value: (a) => a.totalPaidCents, render: (a) => money(a.totalPaidCents) },
            { key: "outstanding", label: "Outstanding", align: "right", value: (a) => a.outstandingCents, render: (a) => money(a.outstandingCents) },
            { key: "status", label: "Status", render: (a) => <StatusBadge status={a.status} domain="financingAgreement" /> },
            { key: "possession", label: "Possession", render: (a) => <StatusBadge status={a.possessionStatus} domain="financingPossession" /> },
            { key: "actions", label: "", render: (a) => <RippleButton size="small" variant="ghost" onClick={() => open(a)}>Open</RippleButton> },
          ]}
          empty={<EmptyState icon="invoices" title="No agreements" description="Approved applications become agreements, which appear here with their schedules and payments." />}
        />
      )}

      {selected && (
        <AgreementDetail
          agreement={selected}
          config={config}
          canManage={canManage}
          canPay={canPay}
          onClose={() => setSelected(null)}
          onChanged={async () => { await load(); open(selected); }}
        />
      )}
    </>
  );
}

function AgreementDetail({ agreement, config, canManage, canPay, onClose, onChanged }: { agreement: FinAgreement; config: FinancingConfig | null; canManage: boolean; canPay: boolean; onClose: () => void; onChanged: () => void }) {
  const feedback = useFeedback();
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [phone, setPhone] = useState("");

  const paidPct = agreement.hpPriceCents > 0 ? Math.min(100, Math.round((agreement.totalPaidCents / (agreement.hpPriceCents - agreement.depositCents)) * 100)) : 0;

  async function run(fn: () => Promise<any>, msg: string) {
    setBusy(true);
    try { await fn(); feedback.success({ title: msg.replace(/\.$/, "") }); onChanged(); } catch (e: any) { feedback.error({ title: "Action failed", message: e.message }); } finally { setBusy(false); }
  }

  return (
    <div className="panel" style={{ marginTop: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h3 style={{ margin: 0 }}>{agreement.agreementNumber} — {agreement.productName || "Agreement"}</h3>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            {money(agreement.instalmentCents)} / {FREQ_LABEL[agreement.frequency] || agreement.frequency} · {agreement.termCount} instalments · first due {fmtDate(agreement.firstDueDate)}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
          <StatusBadge status={agreement.status} domain="financingAgreement" />
          <RippleButton size="small" variant="ghost" disabled={busy} onClick={() => downloadPdf(`/api/financing/agreements/${agreement.id}/agreement`, `agreement-${agreement.agreementNumber}.pdf`).catch((e) => feedback.error({ title: "Agreement PDF unavailable", message: e.message }))}>Agreement PDF</RippleButton>
          <RippleButton size="small" variant="ghost" disabled={busy} onClick={() => downloadPdf(`/api/financing/agreements/${agreement.id}/statement`, `statement-${agreement.agreementNumber}.pdf`).catch((e) => feedback.error({ title: "Statement PDF unavailable", message: e.message }))}>Statement PDF</RippleButton>
          <RippleButton size="small" variant="ghost" onClick={onClose}>Close</RippleButton>
        </div>
      </div>

      <div className="stat-grid" style={{ marginTop: "1rem" }}>
        <div className="stat-card"><div className="stat-card__value">{money(agreement.hpPriceCents)}</div><div className="stat-card__label">HP price</div></div>
        <div className="stat-card"><div className="stat-card__value">{money(agreement.depositCents)}</div><div className="stat-card__label">Deposit</div></div>
        <div className="stat-card"><div className="stat-card__value">{money(agreement.totalPaidCents)}</div><div className="stat-card__label">Paid ({paidPct}%)</div></div>
        <div className="stat-card"><div className="stat-card__value">{money(agreement.outstandingCents)}</div><div className="stat-card__label">Outstanding</div></div>
      </div>

      {canManage && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "1rem 0" }}>
          {agreement.possessionStatus !== "released" && (
            <RippleButton size="small" variant="secondary" disabled={busy} onClick={() => run(() => api(`/api/financing/agreements/${agreement.id}/release`, { method: "POST" }), "Product released.")}>Release product</RippleButton>
          )}
          {agreement.status !== "completed" && agreement.status !== "cancelled" && (
            <RippleButton size="small" variant="ghost" disabled={busy} onClick={async () => {
              const reason = await promptDialog({ title: "Cancel agreement", label: "Reason", confirmLabel: "Cancel agreement", danger: true });
              if (reason === null) return;
              run(() => api(`/api/financing/agreements/${agreement.id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }), "Agreement cancelled.");
            }}>Cancel agreement</RippleButton>
          )}
        </div>
      )}

      {canPay && agreement.status !== "cancelled" && (
        <div className="panel" style={{ background: "var(--surface-2)", marginBottom: "1rem" }}>
          <strong>Record a payment</strong>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.5rem" }}>
            <label>Amount (KES)<input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 140 }} /></label>
            <label>Method
              <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Payment method">
                {(config?.allowedPaymentMethods || ["mpesa", "cash"]).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <RippleButton size="small" variant="primary" disabled={busy || !amount} onClick={() => run(() => api(`/api/financing/agreements/${agreement.id}/payments`, { method: "POST", body: JSON.stringify({ amountCents: toCents(amount), method }) }), "Payment recorded.")}>Record</RippleButton>
            <span className="muted">or</span>
            <label>M-Pesa phone<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" style={{ width: 150 }} /></label>
            <RippleButton size="small" variant="secondary" disabled={busy || !amount || !phone} onClick={() => run(() => api(`/api/financing/agreements/${agreement.id}/mpesa`, { method: "POST", body: JSON.stringify({ phone, amountCents: toCents(amount) }) }), "STK push sent — await confirmation.")}>Send STK push</RippleButton>
          </div>
        </div>
      )}

      <h4>Schedule</h4>
      <DataTable
        ariaLabel="Instalment schedule"
        rows={agreement.schedules || []}
        rowKey={(s) => s.id}
        defaultSort={{ key: "sequence", dir: "asc" }}
        columns={[
          { key: "sequence", label: "#", value: (s) => s.sequence, render: (s) => s.sequence },
          { key: "due", label: "Due date", value: (s) => s.dueDate, render: (s) => fmtDate(s.dueDate) },
          { key: "amount", label: "Amount", align: "right", value: (s) => s.amountCents, render: (s) => money(s.amountCents) },
          { key: "paid", label: "Paid", align: "right", value: (s) => s.amountPaidCents, render: (s) => money(s.amountPaidCents) },
          { key: "status", label: "Status", render: (s) => <StatusBadge status={s.status} domain="financingSchedule" /> },
        ]}
        empty={<EmptyState icon="invoices" title="No schedule" description="Schedules are generated when an application is approved." />}
      />

      <h4 style={{ marginTop: "1rem" }}>Payments</h4>
      <DataTable
        ariaLabel="Financing payments"
        rows={agreement.payments || []}
        rowKey={(p) => p.id}
        defaultSort={{ key: "created", dir: "desc" }}
        columns={[
          { key: "ref", label: "Reference", render: (p) => p.paymentRef },
          { key: "amount", label: "Amount", align: "right", value: (p) => p.amountCents, render: (p) => money(p.amountCents) },
          { key: "method", label: "Method", render: (p) => `${p.method}${p.mpesaReceipt ? ` · ${p.mpesaReceipt}` : ""}` },
          { key: "status", label: "Status", render: (p) => <StatusBadge status={p.status} domain="financingPayment" /> },
          { key: "created", label: "Date", value: (p) => p.createdAt || "", render: (p) => fmtDate(p.createdAt) },
          {
            key: "actions", label: "", render: (p) => (p.status === "succeeded" ? (
              <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                <RippleButton size="small" variant="ghost" onClick={() => downloadPdf(`/api/financing/payments/${p.id}/receipt`, `receipt-${p.paymentRef}.pdf`).catch((e) => feedback.error({ title: "Receipt unavailable", message: e.message }))}>Receipt</RippleButton>
                {canPay && (
                  <RippleButton size="small" variant="ghost" disabled={busy} onClick={async () => {
                    const reason = await promptDialog({ title: "Reverse payment", label: "Reason", message: "This reverses the allocation and restores the outstanding balance.", confirmLabel: "Reverse", danger: true });
                    if (reason === null) return;
                    run(() => api(`/api/financing/payments/${p.id}/reverse`, { method: "POST", body: JSON.stringify({ reason }) }), "Payment reversed.");
                  }}>Reverse</RippleButton>
                )}
              </div>
            ) : null),
          },
        ]}
        empty={<EmptyState icon="invoices" title="No payments" description="Payments recorded against this agreement appear here." />}
      />
    </div>
  );
}

function Settings({ config, canManage, onSaved }: { config: FinancingConfig; canManage: boolean; onSaved: () => void }) {
  const feedback = useFeedback();
  const [form, setForm] = useState<FinancingConfig>(config);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof FinancingConfig>(key: K, value: FinancingConfig[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setBusy(true);
    try {
      await api("/api/financing/config", { method: "PUT", body: JSON.stringify(form) });
      feedback.success({ title: "Financing settings saved" });
      onSaved();
    } catch (e: any) { feedback.error({ title: "Financing settings not saved", message: e.message }); } finally { setBusy(false); }
  }

  return (
    <div className={canManage ? "" : "is-disabled"} style={{ maxWidth: "52rem" }}>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Availability</h3>
        <label style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
          <input type="checkbox" checked={form.enabled} disabled={!canManage} onChange={(e) => set("enabled", e.target.checked)} />
          Enable Lipa Mdogo Mdogo financing
        </label>
        <div style={{ marginTop: "0.5rem" }}>
          <label style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
            <input type="checkbox" checked={form.onlineApplicationAllowed} disabled={!canManage} onChange={(e) => set("onlineApplicationAllowed", e.target.checked)} />
            Allow customers to apply online
          </label>
        </div>
        <div style={{ marginTop: "0.5rem" }}>
          <label style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
            <input type="checkbox" checked={form.manualApproval} disabled={!canManage} onChange={(e) => set("manualApproval", e.target.checked)} />
            Require manual approval before an agreement is created
          </label>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Pricing</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
          <label>Charge model
            <select value={form.chargeModel} disabled={!canManage} onChange={(e) => set("chargeModel", e.target.value as any)} aria-label="Charge model">
              <option value="fixed">Fixed fee per agreement</option>
              <option value="percentage">Percentage of cash price</option>
            </select>
          </label>
          {form.chargeModel === "fixed" ? (
            <label>Fixed charge (KES)
              <input type="number" min="0" value={(form.chargeFixedCents || 0) / 100} disabled={!canManage} onChange={(e) => set("chargeFixedCents", toCents(e.target.value))} />
            </label>
          ) : (
            <label>Charge percent (%)
              <input type="number" min="0" value={form.chargePercent ?? 0} disabled={!canManage} onChange={(e) => set("chargePercent", Number(e.target.value))} />
            </label>
          )}
          <label>Minimum deposit (%)
            <input type="number" min="0" max="100" value={form.depositPercentMin ?? 0} disabled={!canManage} onChange={(e) => set("depositPercentMin", Number(e.target.value))} />
          </label>
          <label>Min term (instalments)
            <input type="number" min="1" value={form.minTerm} disabled={!canManage} onChange={(e) => set("minTerm", Number(e.target.value))} />
          </label>
          <label>Max term (instalments)
            <input type="number" min="1" value={form.maxTerm} disabled={!canManage} onChange={(e) => set("maxTerm", Number(e.target.value))} />
          </label>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Possession &amp; collections</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
          <label>Possession model
            <select value={form.possessionModel} disabled={!canManage} onChange={(e) => set("possessionModel", e.target.value)} aria-label="Possession model">
              <option value="immediate">Immediate (after deposit)</option>
              <option value="threshold">After a payment threshold</option>
              <option value="on_full_payment">After full payment</option>
            </select>
          </label>
          <label>Overdue threshold (days)
            <input type="number" min="0" value={form.overdueThresholdDays} disabled={!canManage} onChange={(e) => set("overdueThresholdDays", Number(e.target.value))} />
          </label>
          <label>Serious overdue (days)
            <input type="number" min="0" value={form.seriousOverdueThresholdDays} disabled={!canManage} onChange={(e) => set("seriousOverdueThresholdDays", Number(e.target.value))} />
          </label>
          <label>Grace period (days)
            <input type="number" min="0" value={form.gracePeriodDays} disabled={!canManage} onChange={(e) => set("gracePeriodDays", Number(e.target.value))} />
          </label>
        </div>
        <div style={{ marginTop: "0.5rem" }}>
          <label style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
            <input type="checkbox" checked={form.serialMandatory} disabled={!canManage} onChange={(e) => set("serialMandatory", e.target.checked)} />
            Require a serial number
          </label>
        </div>
        <div style={{ marginTop: "0.5rem" }}>
          <label style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
            <input type="checkbox" checked={form.guarantorRequired} disabled={!canManage} onChange={(e) => set("guarantorRequired", e.target.checked)} />
            Require a guarantor
          </label>
        </div>
      </div>

      {canManage && (
        <RippleButton variant="primary" disabled={busy} onClick={save}>Save settings</RippleButton>
      )}
      {!canManage && <p className="muted">You have read-only access to financing settings.</p>}
    </div>
  );
}
