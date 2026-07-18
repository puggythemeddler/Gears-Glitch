import React from "react";
import { api, downloadPdf } from "@/lib/api";
import RippleButton from "@/components/RippleButton";
import EmptyState from "@/components/EmptyState";
import { formatPrice, escapeHtml, useFetch, Spinner, ErrorMsg } from "./shared";

export default function CreditNotesPage() {
  const { data, loading, error, refetch } = useFetch(() => api<{ creditNotes: any[] }>('/api/admin/credit-notes'), []);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  const creditNotes = data?.creditNotes || [];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Credit Notes</h1>
        <RippleButton size="small" onClick={() => refetch()}>Refresh</RippleButton>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>#</th><th>Order</th><th>Customer</th><th>Amount</th><th>Reason</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {creditNotes.map((note: any) => (
              <tr key={note.id}>
                <td>#{note.id}</td>
                <td>#{note.orderId}</td>
                <td>{escapeHtml(note.customerName || note.customer_name || '—')}</td>
                <td>{formatPrice(note.totalAmount || 0)}</td>
                <td>{escapeHtml(note.reason || '—')}</td>
                <td><span className="plan-status" style={{ background: note.status === 'submitted' ? '#d1fae5' : '#fef3c7', color: note.status === 'submitted' ? '#065f46' : '#92400e' }}>{note.status}</span></td>
                <td>
                  <RippleButton size="small" variant="ghost" onClick={() => downloadPdf(`/api/admin/credit-notes/${note.id}/view`, `credit-note-${note.id}.pdf`).catch((e: any) => alert("Failed to download credit note: " + (e?.message || "Unknown error")))}>View</RippleButton>
                </td>
              </tr>
            ))}
            {creditNotes.length === 0 && <tr><td colSpan={7}><EmptyState icon="invoices" title="No credit notes" description="Credit notes created from invoices will appear here." /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
