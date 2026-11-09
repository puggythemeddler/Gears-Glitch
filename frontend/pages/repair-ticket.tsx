import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { api, isCustomerLoggedIn } from "@/lib/api";
import Icon from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePageTitle } from "@/lib/use-page-title";

function formatDate(d: string) {
  return new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function RepairTicketPage() {
  const router = useRouter();
  const { id } = router.query;
  const [ticket, setTicket] = useState<any>(null);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [quoteResp, setQuoteResp] = useState<string | null>(null);
  const quoteRecorded = ticket?.quoteDeliveryStatus === "sent" && !!ticket?.quoteSentAt;
  const quoteExpired = quoteRecorded && (!ticket?.quoteExpiresAt || Date.parse(String(ticket.quoteExpiresAt)) <= Date.now());
  usePageTitle(ticket ? `Repair ticket #${ticket.id}` : "Repair ticket");

  useEffect(() => {
    setMounted(true);
    const ok = isCustomerLoggedIn();
    setLoggedIn(ok);
    if (!ok || !id) return;
    api<any>(`/api/repairs/mine/${id}`).then(setTicket).catch((e) => setError(e.message));
  }, [id]);

  async function handleQuote(response: "accepted" | "declined") {
    setQuoteResp(response);
    try {
      await api(`/api/repairs/${id}/quote-response`, { method: "POST", body: JSON.stringify({ response }) });
      const updated = await api<any>(`/api/repairs/mine/${id}`);
      setTicket(updated);
    } catch (err: any) { setError(err.message); }
    finally { setQuoteResp(null); }
  }

  async function sendMessage() {
    if (!msg.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await api(`/api/repairs/mine/${id}/message`, { method: "POST", body: JSON.stringify({ message: msg }) });
      setMsg("");
      const updated = await api<any>(`/api/repairs/mine/${id}`);
      setTicket(updated);
    } catch (err: any) { setError(err.message || "Failed to send message."); }
    finally { setSending(false); }
  }

  if (mounted && !loggedIn) {
    return <><h1>Repair ticket</h1><div className="empty-state"><div className="empty-state-icon"><Icon name="lock" size={28} /></div><div className="empty-state-title">Sign in to view ticket</div><div className="empty-state-desc">Please sign in to view this repair ticket.</div><a href={`/login?redirect=/repair-ticket?id=${id}`} className="btn btn-primary">Sign in</a></div></>;
  }

  if (!mounted || !id || (!ticket && !error)) {
    return <><h1>Repair ticket</h1><div className="card"><div className="skeleton" style={{ height: "1rem", width: "40%", marginBottom: "var(--space-3)" }} /><div className="skeleton" style={{ height: "0.75rem", width: "60%", marginBottom: "var(--space-2)" }} /><div className="skeleton" style={{ height: "0.75rem", width: "30%" }} /></div></>;
  }

  if (error) {
    return (
      <>
        <nav className="breadcrumbs"><ol><li><a href="/">Home</a></li><li><a href="/repairs">Repairs</a></li><li><span aria-current="page">Ticket</span></li></ol></nav>
        <h1>Repair ticket</h1>
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="alertCircle" size={28} /></div>
          <div className="empty-state-title">Failed to load ticket</div>
          <div className="empty-state-desc">{error}</div>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </>
    );
  }

  return (
    <>
      <nav className="breadcrumbs">
        <ol>
          <li><a href="/">Home</a></li>
          <li><a href="/my-repairs">My repairs</a></li>
          <li><span aria-current="page">Ticket #{ticket.id}</span></li>
        </ol>
      </nav>

      <h1>{ticket.serviceKind === "planned_service" ? "Service request" : "Repair ticket"} #{ticket.id}</h1>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <StatusBadge status={ticket.status} domain="repairs" />
          <span className="muted">{formatDate(ticket.createdAt)}</span>
        </div>
        <table className="data-table">
          <tbody>
            <tr><td>Device</td><td>{[ticket.deviceBrand, ticket.deviceType, ticket.deviceModel].filter(Boolean).join(" ")}</td></tr>
            <tr><td>Request type</td><td>{ticket.serviceKind === "planned_service" ? "Planned software, installation, or upgrade" : "Diagnosis or repair"}</td></tr>
            {ticket.serialNumber && <tr><td>Serial number</td><td>{ticket.serialNumber}</td></tr>}
            {ticket.issueSummary && <tr><td>{ticket.serviceKind === "planned_service" ? "Service requested" : "Problem summary"}</td><td>{ticket.issueSummary}</td></tr>}
            <tr><td>{ticket.serviceKind === "planned_service" ? "Service details" : "Problem details"}</td><td>{ticket.issueDescription}</td></tr>
            {(ticket.requestedVisitDate || ticket.requestedVisitTime) && <tr><td>Requested drop-off</td><td>{[ticket.requestedVisitDate, ticket.requestedVisitTime].filter(Boolean).join(" · ")} (awaiting shop confirmation)</td></tr>}
            {ticket.etaAt && <tr><td>Estimated completion</td><td>{formatDate(ticket.etaAt)}</td></tr>}
          </tbody>
        </table>
      </div>

      {quoteRecorded && (
        <div className="card" style={{ marginBottom: "1.5rem", border: "2px solid var(--primary)" }}>
          <h3 style={{ marginTop: 0 }}>Cost estimate · version {ticket.quoteVersion}</h3>
          <p className="muted">Valid until {new Date(String(ticket.quoteExpiresAt)).toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" })}</p>
          <table className="data-table">
            <tbody>
              {ticket.laborCost > 0 && <tr><td>Labor</td><td style={{ textAlign: "right" }}>{new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(ticket.laborCost)}</td></tr>}
              {ticket.partsCost > 0 && <tr><td>Parts</td><td style={{ textAlign: "right" }}>{new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(ticket.partsCost)}</td></tr>}
              {ticket.softwareInstall && <tr><td>Software installation</td><td style={{ textAlign: "right" }}>Included</td></tr>}
              {ticket.softwareLicense && <tr><td>{ticket.softwareLicenseProductName || "Software license"}</td><td style={{ textAlign: "right" }}>{new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(Number(ticket.softwareLicensePrice) || 0)}</td></tr>}
              <tr style={{ fontWeight: 700 }}><td>Total</td><td style={{ textAlign: "right" }}>{new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(ticket.totalCost)}</td></tr>
            </tbody>
          </table>
          {!quoteExpired && <a className="btn btn-secondary" style={{ display: "inline-flex", marginTop: "0.5rem" }} href={`/api/repairs/mine/${encodeURIComponent(String(id))}/quote.pdf`}>Download estimate PDF</a>}
          {!ticket.quoteResponse && !quoteExpired ? (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button className="btn" onClick={() => handleQuote("accepted")} disabled={!!quoteResp}>
                {quoteResp === "accepted" ? "Accepting..." : "Accept estimate"}
              </button>
              <button className="btn btn-ghost" onClick={() => handleQuote("declined")} disabled={!!quoteResp}>
                {quoteResp === "declined" ? "Declining..." : "Decline"}
              </button>
            </div>
          ) : ticket.quoteResponse ? (
            <p style={{ margin: "0.5rem 0 0", fontWeight: 600, color: ticket.quoteResponse === "accepted" ? "var(--primary)" : "var(--danger)" }}>
              You {ticket.quoteResponse === "accepted" ? "accepted" : "declined"} estimate version {ticket.quoteVersion}.
            </p>
          ) : <p role="status" className="muted">This estimate has expired. Please contact the store for an updated estimate.</p>}
        </div>
      )}
      {ticket.quoteSentAt && ticket.quoteDeliveryStatus === "sending" && <div className="card" role="status" style={{ marginBottom: "1.5rem" }}>Your estimate PDF is being sent. Refresh this page in a moment to view it.</div>}
      {ticket.quoteSentAt && !ticket.quoteDeliveryStatus && <div className="card" role="status" style={{ marginBottom: "1.5rem" }}>The store needs to prepare a current PDF estimate before you can review or respond.</div>}
      {ticket.quoteDeliveryStatus === "sent" && !ticket.quoteSentAt && <div className="card" role="status" style={{ marginBottom: "1.5rem" }}>Estimate version {ticket.quoteVersion} is no longer current. Please wait for an updated estimate from the store.</div>}
      {ticket.quoteDeliveryStatus === "expired" && <div className="card" role="status" style={{ marginBottom: "1.5rem" }}>Estimate version {ticket.quoteVersion} has expired. Please contact the store for an updated estimate.</div>}

      <h3>Updates</h3>
      {(ticket.updates || []).length === 0 ? (
        <p className="muted">No updates yet.</p>
      ) : (
        <ul className="timeline">
          {(ticket.updates || []).map((u: any) => (
            <li key={u.id} className="timeline-item done">
              <span className="timeline-dot" aria-hidden="true" />
              <div className="timeline-title">{u.updateType === "customer_note" ? "You" : u.staffName || "Staff"}</div>
              <div className="timeline-meta">{formatDate(u.createdAt)}</div>
              <div className="timeline-body">{u.message}</div>
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: "1.5rem" }}>
        <h3>Send a message</h3>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <textarea
            rows={2}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Ask a question or provide additional info..."
            style={{ flex: 1 }}
          />
          <button className="btn" onClick={sendMessage} disabled={sending || !msg.trim()}>
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </>
  );
}
