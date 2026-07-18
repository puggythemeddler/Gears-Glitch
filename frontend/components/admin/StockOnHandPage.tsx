import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import RippleButton from "@/components/RippleButton";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { formatPrice, escapeHtml, useFetch, Spinner, ErrorMsg } from "./shared";

export default function StockOnHandPage({ showAutoReorder = false }: { showAutoReorder?: boolean }) {
  const { toast } = useToast();
  const { data: sData, loading, error } = useFetch(() => api<{ items: any[] }>("/api/reports/stock-summary"), []);
  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().slice(0, 10));
  const [snapshot, setSnapshot] = useState<any>(null);
  const [dates, setDates] = useState<any[]>([]);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);

  useEffect(() => {
    api<{ dates: any[] }>("/api/stock-on-hand/history").then(d => setDates(d.dates || [])).catch(() => {});
  }, []);

  async function viewSnapshot() {
    if (!snapshotDate) return;
    setLoadingSnapshot(true);
    try {
      const data = await api<any>(`/api/stock-on-hand/${snapshotDate}`);
      setSnapshot(data);
    } catch (err: any) {
      setSnapshot(null);
      alert("No snapshot for this date.");
    } finally { setLoadingSnapshot(false); }
  }

  async function takeSnapshot() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await api("/api/stock-on-hand/snapshot", { method: "POST", body: JSON.stringify({ date: today }) });
      setSnapshotDate(today);
      const data = await api<any>(`/api/stock-on-hand/${today}`);
      setSnapshot(data);
      api<{ dates: any[] }>("/api/stock-on-hand/history").then(d => setDates(d.dates || [])).catch(() => {});
    } catch (err: any) { alert(err.message); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const items = sData?.items || [];
  const lowStock = items.filter((i) => i.quantityInStock <= i.lowStockThreshold);

  return (
    <>
      <h1>Stock on Hand</h1>

      {lowStock.length > 0 && (
        <div className="panel" style={{ marginBottom: "1rem", background: "#fef3c7", borderColor: "#f59e0b", color: "#92400e" }}>
          <strong>{lowStock.length}</strong> item(s) at or below low stock threshold.
          {showAutoReorder && (
            <RippleButton size="small" onClick={async () => {
              try { const r = await api<any>("/api/admin/auto-reorder", { method: "POST" }); toast("success", `Auto-reorder created ${r.created} items (${r.skipped} already on order)`); } catch (e: any) { toast("error", e.message); }
            }} style={{ marginLeft: "0.75rem" }}>Auto Reorder</RippleButton>
          )}
        </div>
      )}

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ margin: 0 }}>
            <label>View Stock on Hand for Date</label>
            <input type="date" value={snapshotDate} onChange={(e) => setSnapshotDate(e.target.value)} />
          </div>
          <RippleButton size="small" onClick={viewSnapshot} loading={loadingSnapshot}>View</RippleButton>
          <RippleButton size="small" onClick={takeSnapshot}>Snapshot Today</RippleButton>
        </div>
        {dates.length > 0 && (
          <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            {dates.map((d: any) => (
              <RippleButton key={d.date} size="small" variant="ghost" onClick={() => { setSnapshotDate(d.date); viewSnapshot(); }}>
                {d.date}
              </RippleButton>
            ))}
          </div>
        )}
      </div>

      {snapshot && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Snapshot: {snapshot.date}</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Product</th><th style={{ textAlign: "right" }}>Quantity</th></tr></thead>
              <tbody>
                {snapshot.items.map((i: any) => (
                  <tr key={i.productId}>
                    <td>{escapeHtml(i.productName)}</td>
                    <td style={{ textAlign: "right" }}>{i.quantity}</td>
                  </tr>
                ))}
                {snapshot.items.length === 0 && <tr><td colSpan={2}><EmptyState icon="stock" title="No snapshot data" description="Take a snapshot to record stock levels for this date." /></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h3>Current Stock Levels</h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Product</th><th>Category</th><th>In Stock</th><th>Reserved</th><th>Sold</th><th>Threshold</th><th>Status</th></tr></thead>
          <tbody>
            {items.map((i: any) => (
              <tr key={i.productId} style={i.quantityInStock <= i.lowStockThreshold ? { background: "var(--bg)" } : {}}>
                <td>{escapeHtml(i.name)}</td>
                <td>{i.category || "—"}</td>
                <td><strong>{i.quantityInStock}</strong></td>
                <td>{i.quantityReserved}</td>
                <td>{i.quantitySold}</td>
                <td>{i.lowStockThreshold}</td>
                <td>{i.quantityInStock <= i.lowStockThreshold ? <span style={{ color: "#dc2626", fontWeight: 600 }}>Low</span> : <span style={{ color: "#16a34a" }}>OK</span>}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7}><EmptyState icon="stock" title="No stock data" description="Stock levels will appear here once products are added." /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
