import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import RippleButton from "@/components/RippleButton";
import EmptyState from "@/components/EmptyState";
import { useFetch, Spinner, ErrorMsg } from "./shared";

export default function StockTakeListPage() {
  const { data: sessions, loading, error, refetch } = useFetch(() => api<{ sessions: any[] }>("/api/stock-take"), []);
  const [msg, setMsg] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [stockBranchFilter, setStockBranchFilter] = useState<number | null>(null);
  const [branchStockSummary, setBranchStockSummary] = useState<any[]>([]);

  useEffect(() => {
    api<{ branches: any[] }>("/api/admin/branches").then(d => setBranches(d.branches || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (stockBranchFilter) {
      fetch(`/api/admin/stock/by-branch/${stockBranchFilter}`).then(r => r.json()).then(setBranchStockSummary).catch(() => {});
    }
  }, [stockBranchFilter]);

  async function startSession() {
    try {
      const body: any = {};
      if (stockBranchFilter) body.branchId = stockBranchFilter;
      const data = await api<any>("/api/stock-take/start", { method: "POST", body: JSON.stringify(body) });
      if (data?.session) {
        window.location.href = `/stock-take/${data.session.id}`;
      }
    } catch (err: any) { setMsg(err.message); }
  }

  async function handleDelete(session: any, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this session? Only possible if no items have been counted.")) return;
    try {
      await api(`/api/stock-take/${session.id}`, { method: "DELETE" });
      refetch();
    } catch (err: any) { setMsg(err.message); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const sessionList = sessions?.sessions || [];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Stock Take</h1>
        <RippleButton size="small" onClick={startSession}>+ New Session</RippleButton>
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Branch</label>
            <select value={stockBranchFilter || ""} onChange={(e) => setStockBranchFilter(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Select branch for stock preview</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {stockBranchFilter && branchStockSummary.length > 0 && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Current Stock at {branches.find((b: any) => b.id === stockBranchFilter)?.name || "Selected Branch"}</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Product</th><th style={{ textAlign: "right" }}>Quantity</th></tr></thead>
              <tbody>
                {branchStockSummary.map((i: any) => (
                  <tr key={i.productId ?? i.id}>
                    <td>{i.name || i.productName || "—"}</td>
                    <td style={{ textAlign: "right" }}>{i.quantityInStock ?? i.quantity_in_stock ?? i.quantity ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {msg && <div className="panel" style={{ marginBottom: "1rem", background: "var(--danger-light, #fee2e2)", color: "var(--danger, #991b1b)" }}>{msg}</div>}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Status</th>
              <th>Created</th>
              <th>Completed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessionList.length === 0 && <tr><td colSpan={5}><EmptyState icon="stock" title="No stock take sessions" description="Start a new session to count inventory." /></td></tr>}
            {sessionList.map((s: any) => (
              <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => window.location.href = `/stock-take/${s.id}`}>
                <td>{s.id}</td>
                <td><span className="plan-status" style={{ background: s.status === "completed" ? "var(--success-light, #d1fae5)" : "var(--warning-light, #fef3c7)", color: s.status === "completed" ? "var(--success, #065f46)" : "var(--warning, #92400e)" }}>{s.status}</span></td>
                <td>{new Date(s.createdAt || s.created_at).toLocaleDateString("en-GB")}</td>
                <td>{s.completedAt || s.completed_at ? new Date(s.completedAt || s.completed_at).toLocaleDateString("en-GB") : "—"}</td>
                <td>
                  <RippleButton size="small" variant="danger" onClick={(e) => handleDelete(s, e)}>Delete</RippleButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
