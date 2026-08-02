import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { api, isCustomerLoggedIn } from "@/lib/api";
import { escapeHtml } from "@/lib/sanitize";

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
    try {
      await api(`/api/repairs/mine/${id}/message`, { method: "POST", body: JSON.stringify({ message: msg }) });
      setMsg("");
      const updated = await api<any>(`/api/repairs/mine/${id}`);
      setTicket(updated);
    } catch (err: any) { setError(err.message); }
    finally { setSending(false); }
  }

  if (mounted && !loggedIn) {
    return <><h1>Repair ticket</h1><div className="empty-state"><div className="empty-state-icon">🔒</div><div className="empty-state-title">Sign in to view ticket</div><div className="empty-state-desc">Please sign in to view this repair ticket.</div><a href={`/login?redirect=/repair-ticket?id=${id}`} className="btn btn-primary">Sign in</a></div></>;
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
          <div className="empty-state-icon">⚠️</div>
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

      <h1>Repair ticket #{ticket.id}</h1>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <span className="plan-status">{ticket.status}</span>
          <span className="muted">{formatDate(ticket.createdAt)}</span>
        </div>
        <table className="data-table">
          <tbody>
            <tr><td>Device</td><td>{escapeHtml(ticket.deviceType)} {ticket.deviceModel ? `(${escapeHtml(ticket.deviceModel)})` : ""}</td></tr>
            <tr><td>Issue</td><td>{escapeHtml(ticket.issueDescription)}</td></tr>
            {ticket.etaAt && <tr><td>Estimated completion</td><td>{formatDate(ticket.etaAt)}</td></tr>}
          </tbody>
        </table>
      </div>

      {ticket.quoteSentAt && (
        <div className="card" style={{ marginBottom: "1.5rem", border: "2px solid var(--primary)" }}>
          <h3 style={{ marginTop: 0 }}>Cost estimate</h3>
          <table className="data-table">
            <tbody>
              {ticket.laborCost > 0 && <tr><td>Labor</td><td style={{ textAlign: "right" }}>{new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(ticket.laborCost)}</td></tr>}
              {ticket.partsCost > 0 && <tr><td>Parts</td><td style={{ textAlign: "right" }}>{new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(ticket.partsCost)}</td></tr>}
              {ticket.softwareInstall && <tr><td>Software installation</td><td style={{ textAlign: "right" }}>Included</td></tr>}
              {ticket.softwareLicense && <tr><td>Software license</td><td style={{ textAlign: "right" }}>Included</td></tr>}
              <tr style={{ fontWeight: 700 }}><td>Total</td><td style={{ textAlign: "right" }}>{new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(ticket.totalCost)}</td></tr>
            </tbody>
          </table>
          {!ticket.quoteResponse ? (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button className="btn" onClick={() => handleQuote("accepted")} disabled={!!quoteResp}>
                {quoteResp === "accepted" ? "Accepting..." : "Accept estimate"}
              </button>
              <button className="btn btn-ghost" onClick={() => handleQuote("declined")} disabled={!!quoteResp}>
                {quoteResp === "declined" ? "Declining..." : "Decline"}
              </button>
            </div>
          ) : (
            <p style={{ margin: "0.5rem 0 0", fontWeight: 600, color: ticket.quoteResponse === "accepted" ? "var(--primary)" : "#e53e3e" }}>
              You {ticket.quoteResponse === "accepted" ? "accepted" : "declined"} this estimate.
            </p>
          )}
        </div>
      )}

      <h3>Updates</h3>
      {(ticket.updates || []).length === 0 ? (
        <p className="muted">No updates yet.</p>
      ) : (
        (ticket.updates || []).map((u: any) => (
          <div key={u.id} style={{ padding: "0.75rem", boxShadow: "inset 3px 0 0 0 var(--primary)", marginBottom: "0.75rem", background: "var(--surface)", borderRadius: "0 8px 8px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <strong style={{ fontSize: "0.85rem" }}>{u.updateType === "customer_note" ? "You" : u.staffName || "Staff"}</strong>
              <span className="muted" style={{ fontSize: "0.8rem" }}>{formatDate(u.createdAt)}</span>
            </div>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>{escapeHtml(u.message)}</p>
          </div>
        ))
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
