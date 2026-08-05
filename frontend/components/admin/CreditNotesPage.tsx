import React, { useState } from "react";
import { api, downloadPdf } from "@/lib/api";
import RippleButton from "@/components/RippleButton";
import EmptyState from "@/components/EmptyState";
import { formatPrice, escapeHtml, useFetch, Spinner, ErrorMsg } from "./shared";
import { toast } from "@/components/Toast";

export default function CreditNotesPage() {
  const { data, loading, error, refetch } = useFetch(() => api<{ creditNotes: any[] }>('/api/admin/credit-notes'), []);
  const [search, setSearch] = useState("");

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  const creditNotes = data?.creditNotes || [];
  const filtered = search.trim()
    ? creditNotes.filter((n: any) =>
        String(n.orderId).toLowerCase().includes(search.trim().toLowerCase()) ||
        (n.customerName || n.customer_name || "").toLowerCase().includes(search.trim().toLowerCase()))
    : creditNotes;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: "0.5rem", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Credit Notes</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input type="search" placeholder="Search by order or customer..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search credit notes" style={{ padding: "0.4rem 0.75rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.85rem", minWidth: 180 }} />
          <RippleButton size="small" onClick={() => refetch()}>Refresh</RippleButton>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>#</th><th>Order</th><th>Customer</th><th>Amount</th><th>Reason</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.map((note: any) => (
              <tr key={note.id}>
                <td>#{note.id}</td>
                <td>#{note.orderId}</td>
                <td>{escapeHtml(note.customerName || note.customer_name || '—')}</td>
                <td>{formatPrice(note.totalAmount || 0)}</td>
                <td>{escapeHtml(note.reason || '—')}</td>
                <td><span className="plan-status" style={{ background: note.status === 'submitted' ? 'var(--success-light)' : 'var(--warning-light)', color: note.status === 'submitted' ? 'var(--success-text)' : 'var(--warning-text)' }}>{note.status}</span></td>
                <td>
                  <RippleButton size="small" variant="ghost" onClick={() => downloadPdf(`/api/admin/credit-notes/${note.id}/view`, `credit-note-${note.id}.pdf`).catch((e: any) => toast("error", "Failed to download credit note: " + (e?.message || "Unknown error")))}>View</RippleButton>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7}><EmptyState icon="invoices" title={creditNotes.length === 0 ? "No credit notes" : "No matches"} description={creditNotes.length === 0 ? "Credit notes created from invoices will appear here." : `No credit notes match "${search}".`} actionLabel={creditNotes.length === 0 ? "" : "Clear search"} onAction={() => setSearch("")} /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
