import React, { useEffect, useState } from "react";
import { api, isCustomerLoggedIn } from "@/lib/api";
import { escapeHtml } from "@/lib/sanitize";
import Icon from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePageTitle } from "@/lib/use-page-title";
import { toast } from "@/components/Toast";

interface Schedule {
  id: number;
  sequence: number;
  dueDate: string;
  amountCents: number;
  amountPaidCents: number;
  status: string;
}

interface Payment {
  id: number;
  paymentRef: string;
  amountCents: number;
  method: string;
  status: string;
  mpesaReceipt: string | null;
  createdAt: string;
}

interface Agreement {
  id: number;
  agreementNumber: string;
  productName: string;
  serialNumber: string;
  instalmentCents: number;
  termCount: number;
  frequency: string;
  status: string;
  possessionStatus: string;
  totalPaidCents: number;
  outstandingCents: number;
  hpPriceCents: number;
  schedules?: Schedule[];
  payments?: Payment[];
}

interface Application {
  id: number;
  applicationNumber: string;
  productName: string;
  status: string;
  createdAt: string;
}

interface Options {
  enabled: boolean;
  currency: string;
  permittedFrequencies: string[];
  minTerm: number;
  maxTerm: number;
  depositPercentMin: number | null;
  onlineApplicationAllowed: boolean;
}

const FREQ_LABEL: Record<string, string> = {
  daily: "daily",
  weekly: "weekly",
  biweekly: "every 2 weeks",
  monthly: "monthly",
  custom: "per period",
};

function money(cents: number): string {
  return `KES ${(Number(cents) || 0).toLocaleString("en-KE")}`;
}

function fmtDate(s: string | null): string {
  if (!s) return "\u2014";
  const first = String(s).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(first)) {
    const [y, m, d] = first.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB");
  }
  return new Date(s).toLocaleDateString("en-GB");
}

export default function FinancingPage() {
  usePageTitle("My financing");
  const [mounted, setMounted] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [options, setOptions] = useState<Options | null>(null);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [agrs, apps] = await Promise.all([
        api<Agreement[]>("/api/financing/my/agreements"),
        api<Application[]>("/api/financing/my/applications"),
      ]);
      setAgreements(agrs || []);
      setApplications(apps || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMounted(true);
    api<Options>("/api/financing/options").then(setOptions).catch(() => {});
    const ok = isCustomerLoggedIn();
    setLoggedIn(ok);
    if (ok) load();
  }, []);

  async function open(a: Agreement) {
    try { setSelected(await api<Agreement>(`/api/financing/my/agreements/${a.id}`)); } catch (e: any) { toast("error", e.message); }
  }

  if (mounted && !loggedIn) {
    return (
      <>
        <nav className="breadcrumbs"><ol><li><a href="/">Home</a></li><li><span aria-current="page">My financing</span></li></ol></nav>
        <h1>My financing</h1>
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="lock" size={28} /></div>
          <div className="empty-state-title">Sign in to view your plans</div>
          <div className="empty-state-desc">Sign in to see your Lipa Mdogo Mdogo agreements, schedules and payments.</div>
          <a href="/login?redirect=/financing" className="btn btn-primary">Sign in</a>
        </div>
      </>
    );
  }

  const enabled = !!options?.enabled;

  return (
    <>
      <nav className="breadcrumbs"><ol><li><a href="/">Home</a></li><li><a href="/account">Account</a></li><li><span aria-current="page">My financing</span></li></ol></nav>
      <h1>My financing</h1>
      <p className="page-intro">Buy now, pay in instalments. Track your plan, view the schedule, and pay by M-Pesa.</p>

      {!enabled && (
        <div className="card" style={{ padding: "var(--space-4)", marginBottom: "var(--space-4)" }}>
          <p className="muted" style={{ margin: 0 }}>Lipa Mdogo Mdogo is not available at this store right now.</p>
        </div>
      )}

      {error && <p className="product-error">{error}</p>}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton" style={{ height: "5rem", borderRadius: "var(--radius-md)" }} />)}
        </div>
      ) : agreements.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="card" size={28} /></div>
          <div className="empty-state-title">No financing plans yet</div>
          <div className="empty-state-desc">When you start a Lipa Mdogo Mdogo plan it will appear here.</div>
          {enabled && options?.onlineApplicationAllowed && <a href="#apply" className="btn btn-primary">Start an application</a>}
        </div>
      ) : (
        agreements.map((a) => (
          <div key={a.id} className="order-item" style={{ display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.5rem", flexWrap: "wrap" }}>
              <div>
                <strong>{escapeHtml(a.productName || a.agreementNumber)}</strong>
                <span className="muted" style={{ display: "block", fontSize: "0.8rem" }}>{escapeHtml(a.agreementNumber)} {"\u00b7"} {money(a.instalmentCents)} / {FREQ_LABEL[a.frequency] || a.frequency} {"\u00b7"} {a.termCount} instalments</span>
              </div>
              <StatusBadge status={a.status} domain="financingAgreement" />
            </div>
            <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", flexWrap: "wrap", fontSize: "0.9rem" }}>
              <span>Paid <strong>{money(a.totalPaidCents)}</strong></span>
              <span>Outstanding <strong>{money(a.outstandingCents)}</strong></span>
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => open(a)}>{selected?.id === a.id ? "Hide" : "View plan"}</button>
            </div>
          </div>
        ))
      )}

      {selected && <AgreementView agreement={selected} onChanged={async () => { await load(); open(selected); }} />}

      {applications.length > 0 && (
        <section style={{ marginTop: "var(--space-6)" }}>
          <h2>My applications</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {applications.map((a) => (
              <li key={a.id} className="order-item" style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                <span>{escapeHtml(a.productName || a.applicationNumber)} <span className="muted">{"\u00b7"} {escapeHtml(a.applicationNumber)}</span></span>
                <span style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
                  <StatusBadge status={a.status} domain="financingApplication" />
                  <span className="muted">{fmtDate(a.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {enabled && options?.onlineApplicationAllowed && <ApplyForm options={options} onCreated={load} />}
    </>
  );
}

function AgreementView({ agreement, onChanged }: { agreement: Agreement; onChanged: () => void }) {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(String(Math.max(1, Math.round((agreement.outstandingCents || agreement.instalmentCents) / 100))));
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (!phone.trim()) { toast("error", "Enter the M-Pesa phone number."); return; }
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) { toast("error", "Enter a valid amount."); return; }
    setBusy(true);
    try {
      await api(`/api/financing/my/agreements/${agreement.id}/mpesa`, { method: "POST", body: JSON.stringify({ phone, amountCents: cents }) });
      toast("success", "Check your phone and enter your M-Pesa PIN to complete the payment.");
      onChanged();
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" style={{ marginTop: "var(--space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h3 style={{ margin: 0 }}>{escapeHtml(agreement.productName || agreement.agreementNumber)}</h3>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>{escapeHtml(agreement.agreementNumber)} {"\u00b7"} {money(agreement.hpPriceCents)} total</p>
        </div>
        <span style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
          <StatusBadge status={agreement.status} domain="financingAgreement" />
          <StatusBadge status={agreement.possessionStatus} domain="financingPossession" />
        </span>
      </div>

      {agreement.status === "active" && agreement.outstandingCents > 0 && (
        <div className="card" style={{ padding: "var(--space-4)", marginTop: "var(--space-3)" }}>
          <strong>Pay by M-Pesa</strong>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.5rem" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              M-Pesa phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07..." inputMode="tel" />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              Amount (KES)
              <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 140 }} />
            </label>
            <button className="btn btn-primary" disabled={busy} onClick={pay}>Pay now</button>
          </div>
          <p className="muted" style={{ fontSize: "0.8rem", marginBottom: 0 }}>You will receive an STK push. The payment is only recorded once M-Pesa confirms it.</p>
        </div>
      )}

      <h4 style={{ marginTop: "var(--space-4)" }}>Schedule</h4>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>#</th><th>Due date</th><th style={{ textAlign: "right" }}>Amount</th><th style={{ textAlign: "right" }}>Paid</th><th>Status</th></tr></thead>
          <tbody>
            {(agreement.schedules || []).map((s) => (
              <tr key={s.id}>
                <td>{s.sequence}</td>
                <td>{fmtDate(s.dueDate)}</td>
                <td style={{ textAlign: "right" }}>{money(s.amountCents)}</td>
                <td style={{ textAlign: "right" }}>{money(s.amountPaidCents)}</td>
                <td><StatusBadge status={s.status} domain="financingSchedule" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(agreement.payments || []).length > 0 && (
        <>
          <h4 style={{ marginTop: "var(--space-4)" }}>Payments</h4>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Reference</th><th style={{ textAlign: "right" }}>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {(agreement.payments || []).map((p) => (
                  <tr key={p.id}>
                    <td>{escapeHtml(p.paymentRef)}{p.mpesaReceipt ? ` \u00b7 ${escapeHtml(p.mpesaReceipt)}` : ""}</td>
                    <td style={{ textAlign: "right" }}>{money(p.amountCents)}</td>
                    <td>{p.method}</td>
                    <td><StatusBadge status={p.status} domain="financingPayment" /></td>
                    <td>{fmtDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function ApplyForm({ options, onCreated }: { options: Options; onCreated: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [productId, setProductId] = useState("");
  const [depositPercent, setDepositPercent] = useState(String(options.depositPercentMin ?? 0));
  const [frequency, setFrequency] = useState(options.permittedFrequencies[0] || "weekly");
  const [termCount, setTermCount] = useState(String(options.minTerm || 4));
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorPhone, setGuarantorPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ products: any[] }>("/api/products").then((d) => setProducts(d.products || [])).catch(() => {});
  }, []);

  async function submit() {
    if (!consent) { toast("error", "Please tick the consent box."); return; }
    setBusy(true);
    try {
      await api("/api/financing/my/applications", {
        method: "POST",
        body: JSON.stringify({ productId: productId || null, depositPercent: Number(depositPercent), frequency, termCount: Number(termCount), guarantorName, guarantorPhone, notes, consent }),
      });
      toast("success", "Application submitted. We will review it and get back to you.");
      setConsent(false); setProductId(""); setNotes("");
      onCreated();
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="apply" className="panel" style={{ marginTop: "var(--space-6)" }}>
      <h2 style={{ marginTop: 0 }}>Start an application</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
        <label>Product
          <select value={productId} onChange={(e) => setProductId(e.target.value)} aria-label="Product">
            <option value="">Select a product...</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>Deposit (%)
          <input type="number" min={options.depositPercentMin ?? 0} max="100" value={depositPercent} onChange={(e) => setDepositPercent(e.target.value)} />
        </label>
        <label>Frequency
          <select value={frequency} onChange={(e) => setFrequency(e.target.value)} aria-label="Frequency">
            {options.permittedFrequencies.map((f) => <option key={f} value={f}>{FREQ_LABEL[f] || f}</option>)}
          </select>
        </label>
        <label>Number of instalments
          <input type="number" min={options.minTerm} max={options.maxTerm} value={termCount} onChange={(e) => setTermCount(e.target.value)} />
        </label>
        <label>Guarantor name (optional)
          <input value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)} />
        </label>
        <label>Guarantor phone (optional)
          <input value={guarantorPhone} onChange={(e) => setGuarantorPhone(e.target.value)} />
        </label>
      </div>
      <label style={{ display: "block", marginTop: "0.75rem" }}>Notes (optional)
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ width: "100%" }} />
      </label>
      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.75rem" }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        I understand this is a hire-purchase plan and that the item remains the seller's property until fully paid.
      </label>
      <div style={{ marginTop: "0.75rem" }}>
        <button className="btn btn-primary" disabled={busy} onClick={submit}>Submit application</button>
      </div>
    </section>
  );
}
