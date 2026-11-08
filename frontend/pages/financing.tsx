import React, { useEffect, useState } from "react";
import { api, isCustomerLoggedIn, downloadPdf } from "@/lib/api";
import Icon from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePageTitle } from "@/lib/use-page-title";
import { useFeedback } from "@/components/feedback/FeedbackProvider";

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
  depositPercentMax: number | null;
  guarantorRequired?: boolean;
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
  const feedback = useFeedback();
  usePageTitle("My financing");
  const [mounted, setMounted] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [options, setOptions] = useState<Options | null>(null);
  const [optionsError, setOptionsError] = useState("");
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
    api<Options>("/api/financing/options").then((value) => { setOptions(value); setOptionsError(""); }).catch((e: any) => setOptionsError(e.message || "Financing options could not be loaded."));
    const ok = isCustomerLoggedIn();
    setLoggedIn(ok);
    if (ok) load();
  }, []);

  async function open(a: Agreement) {
    try { setSelected(await api<Agreement>(`/api/financing/my/agreements/${a.id}`)); } catch (e: any) { feedback.error({ title: "Agreement not loaded", message: e.message }); }
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

      {optionsError && <div className="product-error" role="alert">{optionsError} <button type="button" className="btn btn-secondary btn-sm" onClick={() => api<Options>("/api/financing/options").then((value) => { setOptions(value); setOptionsError(""); }).catch((e: any) => setOptionsError(e.message || "Financing options could not be loaded."))}>Retry</button></div>}

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
                <strong>{a.productName || a.agreementNumber}</strong>
                <span className="muted" style={{ display: "block", fontSize: "0.8rem" }}>{a.agreementNumber} {"\u00b7"} {money(a.instalmentCents)} / {FREQ_LABEL[a.frequency] || a.frequency} {"\u00b7"} {a.termCount} instalments</span>
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
                <span>{a.productName || a.applicationNumber} <span className="muted">{"\u00b7"} {a.applicationNumber}</span></span>
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
  const feedback = useFeedback();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(String(Math.max(1, Math.round((agreement.outstandingCents || agreement.instalmentCents) / 100))));
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (!phone.trim()) { feedback.error({ title: "Payment not started", message: "Enter the M-Pesa phone number." }); return; }
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) { feedback.error({ title: "Payment not started", message: "Enter a valid amount." }); return; }
    setBusy(true);
    try {
      await api(`/api/financing/my/agreements/${agreement.id}/mpesa`, { method: "POST", body: JSON.stringify({ phone, amountCents: cents }) });
      feedback.success({ title: "Check your phone", message: "Enter your M-Pesa PIN to complete the payment." });
      onChanged();
    } catch (e: any) {
      feedback.error({ title: "Payment not started", message: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" style={{ marginTop: "var(--space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h3 style={{ margin: 0 }}>{agreement.productName || agreement.agreementNumber}</h3>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>{agreement.agreementNumber} {"\u00b7"} {money(agreement.hpPriceCents)} total</p>
        </div>
        <span style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
          <StatusBadge status={agreement.status} domain="financingAgreement" />
          <StatusBadge status={agreement.possessionStatus} domain="financingPossession" />
        </span>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "var(--space-3)" }}>
        <button className="btn btn-secondary" onClick={() => downloadPdf(`/api/financing/my/agreements/${agreement.id}/agreement`, `agreement-${agreement.agreementNumber}.pdf`).catch((e) => feedback.error({ title: "Agreement not downloaded", message: e.message }))}>Download agreement</button>
        <button className="btn btn-secondary" onClick={() => downloadPdf(`/api/financing/my/agreements/${agreement.id}/statement`, `statement-${agreement.agreementNumber}.pdf`).catch((e) => feedback.error({ title: "Statement not downloaded", message: e.message }))}>Download statement</button>
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
              <thead><tr><th>Reference</th><th style={{ textAlign: "right" }}>Amount</th><th>Method</th><th>Status</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {(agreement.payments || []).map((p) => (
                  <tr key={p.id}>
                    <td>{p.paymentRef}{p.mpesaReceipt ? ` \u00b7 ${p.mpesaReceipt}` : ""}</td>
                    <td style={{ textAlign: "right" }}>{money(p.amountCents)}</td>
                    <td>{p.method}</td>
                    <td><StatusBadge status={p.status} domain="financingPayment" /></td>
                    <td>{fmtDate(p.createdAt)}</td>
                    <td>{p.status === "succeeded" ? <button className="btn btn-ghost" style={{ fontSize: "0.8rem" }} onClick={() => downloadPdf(`/api/financing/my/payments/${p.id}/receipt`, `receipt-${p.paymentRef}.pdf`).catch((e) => feedback.error({ title: "Receipt not downloaded", message: e.message }))}>Receipt</button> : null}</td>
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
  const feedback = useFeedback();
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [productId, setProductId] = useState("");
  const [depositPercent, setDepositPercent] = useState(String(options.depositPercentMin ?? 0));
  const [frequency, setFrequency] = useState(options.permittedFrequencies[0] || "weekly");
  const [termCount, setTermCount] = useState(String(options.minTerm || 4));
  const [intervalDays, setIntervalDays] = useState("7");
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorPhone, setGuarantorPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState("");

  async function loadProducts() {
    setProductsLoading(true);
    setProductsError("");
    try {
      const d = await api<{ products: any[] }>("/api/products");
      setProducts(d.products || []);
    } catch (e: any) {
      setProductsError(e.message || "Products could not be loaded. Please try again.");
    } finally { setProductsLoading(false); }
  }

  useEffect(() => { void loadProducts(); }, []);

  function updateQuoteInput(update: () => void) {
    update();
    setQuote(null);
    setQuoteError("");
  }

  async function previewQuote() {
    if (!productId) { setQuoteError("Choose a product to see an estimate."); return; }
    const deposit = Number(depositPercent);
    const term = Number(termCount);
    if (!Number.isFinite(deposit) || deposit < (options.depositPercentMin ?? 0) || deposit > (options.depositPercentMax ?? 100)) {
      setQuoteError(`Enter a deposit between ${options.depositPercentMin ?? 0}% and ${options.depositPercentMax ?? 100}%.`);
      return;
    }
    if (!Number.isInteger(term) || term < options.minTerm || term > options.maxTerm) {
      setQuoteError(`Choose between ${options.minTerm} and ${options.maxTerm} instalments.`);
      return;
    }
    setQuoteBusy(true);
    setQuoteError("");
    try {
      const query = new URLSearchParams({ productId, depositPercent: String(deposit), frequency, termCount: String(term) });
      if (frequency === "custom") query.set("intervalDays", intervalDays);
      setQuote(await api<any>(`/api/financing/public/quote?${query.toString()}`));
    } catch (e: any) {
      setQuote(null);
      setQuoteError(e.message || "An estimate could not be prepared.");
    } finally { setQuoteBusy(false); }
  }

  async function submit() {
    if (!productId) { feedback.error({ title: "Application not submitted", message: "Choose a product first." }); return; }
    if (!quote) { feedback.error({ title: "Review the estimate first", message: "Preview your estimate before submitting the application." }); return; }
    if (options.guarantorRequired && (!guarantorName.trim() || !guarantorPhone.trim())) { feedback.error({ title: "Application not submitted", message: "A guarantor name and phone number are required for this plan." }); return; }
    if (!consent) { feedback.error({ title: "Application not submitted", message: "Please tick the consent box." }); return; }
    setBusy(true);
    try {
      await api("/api/financing/my/applications", {
        method: "POST",
        body: JSON.stringify({ productId, depositPercent: Number(depositPercent), frequency, intervalDays: frequency === "custom" ? Number(intervalDays) : null, termCount: Number(termCount), guarantorName, guarantorPhone, notes, consent }),
      });
      feedback.success({ title: "Application submitted", message: "We will review it and get back to you." });
      setConsent(false); setProductId(""); setNotes(""); setQuote(null);
      onCreated();
    } catch (e: any) {
      feedback.error({ title: "Application not submitted", message: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="apply" className="panel" style={{ marginTop: "var(--space-6)" }}>
      <h2 style={{ marginTop: 0 }}>Start an application</h2>
      <p className="muted">Choose an eligible product and review the estimated deposit and instalments before applying. This is an estimate; the shop confirms final terms after review.</p>
      {productsError ? <div role="alert" className="product-error">{productsError} <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadProducts()}>Retry</button></div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
        <label>Product
          <select value={productId} onChange={(e) => updateQuoteInput(() => setProductId(e.target.value))} aria-label="Product" required disabled={productsLoading || !!productsError}>
            <option value="">{productsLoading ? "Loading products…" : "Select a product..."}</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>Deposit (%)
          <input type="number" min={options.depositPercentMin ?? 0} max={options.depositPercentMax ?? 100} step="0.1" value={depositPercent} onChange={(e) => updateQuoteInput(() => setDepositPercent(e.target.value))} />
        </label>
        <label>Frequency
          <select value={frequency} onChange={(e) => updateQuoteInput(() => setFrequency(e.target.value))} aria-label="Frequency">
            {options.permittedFrequencies.map((f) => <option key={f} value={f}>{FREQ_LABEL[f] || f}</option>)}
          </select>
        </label>
        <label>Number of instalments
          <input type="number" min={options.minTerm} max={options.maxTerm} step="1" value={termCount} onChange={(e) => updateQuoteInput(() => setTermCount(e.target.value))} />
        </label>
        {frequency === "custom" && <label>Days between instalments
          <input type="number" min={1} max={365} step={1} value={intervalDays} onChange={(e) => updateQuoteInput(() => setIntervalDays(e.target.value))} />
        </label>}
        <label>Guarantor name {options.guarantorRequired ? "(required)" : "(optional)"}
          <input value={guarantorName} required={!!options.guarantorRequired} onChange={(e) => setGuarantorName(e.target.value)} />
        </label>
        <label>Guarantor phone {options.guarantorRequired ? "(required)" : "(optional)"}
          <input value={guarantorPhone} required={!!options.guarantorRequired} onChange={(e) => setGuarantorPhone(e.target.value)} />
        </label>
      </div>
      <label style={{ display: "block", marginTop: "0.75rem" }}>Notes (optional)
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ width: "100%" }} />
      </label>
      <div style={{ marginTop: "0.75rem" }}>
        <button type="button" className="btn btn-secondary" onClick={() => void previewQuote()} disabled={quoteBusy || productsLoading || !!productsError || !productId}>
          {quoteBusy ? "Preparing estimate…" : "Preview estimate"}
        </button>
      </div>
      {quoteError && <p role="alert" className="product-error">{quoteError}</p>}
      {quote && <div className="card" aria-live="polite" style={{ padding: "var(--space-4)", marginTop: "0.75rem" }}>
        <h3 style={{ marginTop: 0 }}>Estimated plan</h3>
        <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", margin: 0 }}>
          <div><dt className="muted">Cash price</dt><dd style={{ margin: 0, fontWeight: 600 }}>{money(quote.cashPriceCents)}</dd></div>
          <div><dt className="muted">Deposit ({quote.depositPercent}%)</dt><dd style={{ margin: 0, fontWeight: 600 }}>{money(quote.depositCents)}</dd></div>
          <div><dt className="muted">Financing charge</dt><dd style={{ margin: 0, fontWeight: 600 }}>{money(quote.financingChargeCents)}</dd></div>
          <div><dt className="muted">Total payable</dt><dd style={{ margin: 0, fontWeight: 600 }}>{money(quote.totalPayableCents)}</dd></div>
          <div><dt className="muted">Instalments</dt><dd style={{ margin: 0, fontWeight: 600 }}>{quote.termCount} {quote.frequency === "custom" ? `every ${quote.intervalDays} days` : (FREQ_LABEL[quote.frequency] || quote.frequency)}</dd></div>
          <div><dt className="muted">Typical instalment</dt><dd style={{ margin: 0, fontWeight: 600 }}>{money(quote.instalmentCents)}{quote.finalInstalmentCents !== quote.instalmentCents ? ` (final ${money(quote.finalInstalmentCents)})` : ""}</dd></div>
        </dl>
        <p className="muted" style={{ marginBottom: 0, fontSize: "0.85rem" }}>Estimate only. Approval, first due date, and final agreement terms are confirmed by the shop. No payment is taken by this estimate.</p>
      </div>}
      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.75rem" }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={!quote} />
        I understand this is a hire-purchase plan and that the item remains the seller's property until fully paid.
      </label>
      <div style={{ marginTop: "0.75rem" }}>
        <button className="btn btn-primary" disabled={busy || !quote || !consent} onClick={submit}>Submit application</button>
      </div>
    </section>
  );
}
