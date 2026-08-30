import React, { useEffect, useState } from "react";
import { api, isCustomerLoggedIn } from "@/lib/api";
import type { RepairTicket } from "@/lib/types";
import { escapeHtml } from "@/lib/sanitize";
import Icon from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePageTitle } from "@/lib/use-page-title";

export default function MyRepairsPage() {
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [mounted, setMounted] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  usePageTitle("My repair tickets");

  useEffect(() => {
    setMounted(true);
    const ok = isCustomerLoggedIn();
    setLoggedIn(ok);
    if (!ok) return;
    setLoading(true);
    api<{ tickets: RepairTicket[] }>("/api/repairs/mine").then((d) => setTickets(d.tickets || [])).catch((e) => setFetchError(e.message)).finally(() => setLoading(false));
  }, []);

  if (mounted && !loggedIn) {
    return <><h1>My repairs</h1><div className="empty-state"><div className="empty-state-icon"><Icon name="lock" size={28} /></div><div className="empty-state-title">Sign in to view repairs</div><div className="empty-state-desc">Please sign in to see your repair tickets.</div><a href="/login?redirect=/my-repairs" className="btn btn-primary">Sign in</a></div></>;
  }

  return (
    <>
      <nav className="breadcrumbs">
        <ol>
          <li><a href="/">Home</a></li>
          <li><a href="/repairs">Repairs</a></li>
          <li><span aria-current="page">My repairs</span></li>
        </ol>
      </nav>
      <h1>My repair tickets</h1>
      {fetchError && <p className="product-error">{fetchError}</p>}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                <div className="skeleton" style={{ height: "1rem", width: "40%" }} />
                <div className="skeleton" style={{ height: "1rem", width: "20%" }} />
              </div>
              <div className="skeleton" style={{ height: "0.75rem", width: "60%" }} />
            </div>
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="wrench" size={28} /></div>
          <div className="empty-state-title">No repair tickets</div>
          <div className="empty-state-desc">You haven't booked any repairs yet.</div>
          <a href="/repair-book" className="btn btn-primary">Book a repair</a>
        </div>
      ) : (
        tickets.map((t) => (
          <a key={t.id} href={`/repair-ticket?id=${t.id}`} className="order-item" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.5rem", flexWrap: "wrap" }}>
              <div>
                <strong>#{t.id}</strong> — {escapeHtml(t.deviceType)}
                {t.deviceModel ? ` (${escapeHtml(t.deviceModel)})` : ""}
                <StatusBadge status={t.status} domain="repairs" />
              </div>
              <span className="muted">{new Date(t.createdAt).toLocaleDateString("en-GB")}</span>
            </div>
            <p className="muted" style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>{escapeHtml(t.issueDescription)}</p>
          </a>
        ))
      )}
      <div style={{ marginTop: "1.5rem" }}>
        <a href="/repair-book" className="btn btn-primary">Book another repair</a>
      </div>
    </>
  );
}
