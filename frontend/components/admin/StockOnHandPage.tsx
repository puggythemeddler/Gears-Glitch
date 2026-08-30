import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import RippleButton from "@/components/RippleButton";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { DataTable } from "@/components/ui/DataTable";
import { formatPrice, escapeHtml, useFetch, Spinner, ErrorMsg } from "./shared";

export default function StockOnHandPage({ showAutoReorder = false }: { showAutoReorder?: boolean }) {
  const { toast } = useToast();
  const { data: sData, loading, error } = useFetch(() => api<{ items: any[] }>("/api/reports/stock-summary"), []);
  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().slice(0, 10));
  const [snapshot, setSnapshot] = useState<any>(null);
  const [dates, setDates] = useState<any[]>([]);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [stockBranchFilter, setStockBranchFilter] = useState<number | null>(null);
  const [branchStockSummary, setBranchStockSummary] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api<{ branches: any[] }>("/api/admin/branches").then(d => setBranches(d.branches || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (stockBranchFilter) {
      api<any>(`/api/admin/stock/by-branch/${stockBranchFilter}`).then(setBranchStockSummary).catch(() => {});
    }
  }, [stockBranchFilter]);

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
      toast("error", "No snapshot for this date.");
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
      toast("success", "Snapshot taken.");
    } catch (err: any) { toast("error", err.message); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const items = stockBranchFilter ? branchStockSummary : (sData?.items || []);
  const lowStock = items.filter((i: any) => (i.quantityInStock ?? i.quantity_in_stock ?? 0) <= (i.lowStockThreshold ?? i.low_stock_threshold ?? 0));
  const filteredItems = search.trim() ? items.filter((i: any) => (i.name || "").toLowerCase().includes(search.trim().toLowerCase())) : items;

  return (
    <>
      <h1>Stock on Hand</h1>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Filter by Branch</label>
            <select value={stockBranchFilter || ""} onChange={(e) => setStockBranchFilter(e.target.value ? Number(e.target.value) : null)}>
              <option value="">All Branches</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 200 }}>
            <label>Search</label>
            <input type="search" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search products" />
          </div>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="panel" style={{ marginBottom: "1rem", background: "var(--warning-light)", borderColor: "var(--warning, #d97706)", color: "var(--warning-text)" }}>
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
            <DataTable<any>
              ariaLabel="Stock snapshot"
              columns={[
                { key: "product", label: "Product", sortable: true, value: (i) => i.productName, render: (i) => escapeHtml(i.productName) },
                { key: "quantity", label: "Quantity", sortable: true, align: "right", value: (i) => i.quantity, render: (i) => <strong>{i.quantity}</strong> },
              ]}
              rows={snapshot.items || []}
              rowKey={(i) => i.productId}
              empty={<EmptyState icon="stock" title="No snapshot data" description="Take a snapshot to record stock levels for this date." />}
            />
          </div>
        </div>
      )}

      <h3>Current Stock Levels</h3>
      <div className="table-wrap">
        <DataTable<any>
          ariaLabel="Current stock levels"
          columns={[
            { key: "product", label: "Product", sortable: true, value: (i) => i.name, render: (i) => escapeHtml(i.name) },
            { key: "category", label: "Category", sortable: true, value: (i) => i.category || "", render: (i) => i.category || "—" },
            { key: "qty", label: "In Stock", sortable: true, align: "right", value: (i) => i.quantityInStock ?? i.quantity_in_stock ?? 0, render: (i) => <strong>{i.quantityInStock ?? i.quantity_in_stock ?? 0}</strong> },
            { key: "reserved", label: "Reserved", sortable: true, align: "right", value: (i) => i.quantityReserved ?? i.quantity_reserved ?? 0, render: (i) => i.quantityReserved ?? i.quantity_reserved ?? 0 },
            { key: "sold", label: "Sold", sortable: true, align: "right", value: (i) => i.quantitySold ?? i.quantity_sold ?? 0, render: (i) => i.quantitySold ?? i.quantity_sold ?? 0 },
            { key: "threshold", label: "Threshold", sortable: true, align: "right", value: (i) => i.lowStockThreshold ?? i.low_stock_threshold ?? 0, render: (i) => i.lowStockThreshold ?? i.low_stock_threshold ?? 0 },
            {
              key: "status",
              label: "Status",
              sortable: true,
              value: (i) => (i.quantityInStock ?? i.quantity_in_stock ?? 0) <= (i.lowStockThreshold ?? i.low_stock_threshold ?? 0) ? "Low" : "OK",
              render: (i) => {
                const qty = i.quantityInStock ?? i.quantity_in_stock ?? 0;
                const threshold = i.lowStockThreshold ?? i.low_stock_threshold ?? 0;
                return qty <= threshold ? <span style={{ color: "var(--danger)", fontWeight: 600 }}>Low</span> : <span style={{ color: "var(--success)" }}>OK</span>;
              },
            },
          ]}
          rows={filteredItems}
          rowKey={(i) => i.productId ?? i.id}
          empty={<EmptyState icon="stock" title={items.length === 0 ? "No stock data" : "No matches"} description={items.length === 0 ? "Stock levels will appear here once products are added." : `No products match "${search}".`} actionLabel={items.length === 0 ? "" : "Clear search"} onAction={() => setSearch("")} />}
        />
      </div>
    </>
  );
}
