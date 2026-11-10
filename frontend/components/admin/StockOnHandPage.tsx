import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import RippleButton from "@/components/RippleButton";
import EmptyState from "@/components/EmptyState";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { DataTable } from "@/components/ui/DataTable";
import { formatPrice, useFetch, Spinner, ErrorMsg } from "./shared";

export default function StockOnHandPage({ showAutoReorder = false }: { showAutoReorder?: boolean }) {
  const feedback = useFeedback();
  const { data: sData, loading, error } = useFetch(() => api<{ items: any[] }>("/api/reports/stock-summary"), []);
  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().slice(0, 10));
  const [snapshot, setSnapshot] = useState<any>(null);
  const [dates, setDates] = useState<any[]>([]);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [stockBranchFilter, setStockBranchFilter] = useState<number | null>(null);
  const [branchStockSummary, setBranchStockSummary] = useState<any[]>([]);
  const [branchStockLoading, setBranchStockLoading] = useState(false);
  const [branchStockError, setBranchStockError] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [thresholdDrafts, setThresholdDrafts] = useState<Record<string, string>>({});
  const [thresholdBaselines, setThresholdBaselines] = useState<Record<string, number>>({});
  const [editingThreshold, setEditingThreshold] = useState<string | null>(null);
  const [savingThreshold, setSavingThreshold] = useState<string | null>(null);
  const [reorderSuggestions, setReorderSuggestions] = useState<any[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    api<{ branches: any[] }>("/api/admin/branches").then(d => setBranches(d.branches || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setThresholdDrafts({});
    setThresholdBaselines({});
    setEditingThreshold(null);
    setSnapshot(null);
    if (!stockBranchFilter) {
      setBranchStockSummary([]);
      setBranchStockError("");
      return;
    }
    let cancelled = false;
    setBranchStockLoading(true);
    setBranchStockError("");
    setBranchStockSummary([]);
    api<any>(`/api/admin/stock/by-branch/${stockBranchFilter}`)
      .then((d) => { if (!cancelled) setBranchStockSummary(d); })
      .catch((e: any) => { if (!cancelled) setBranchStockError(e?.message || "Branch stock could not be loaded."); })
      .finally(() => { if (!cancelled) setBranchStockLoading(false); });
    return () => { cancelled = true; };
  }, [stockBranchFilter]);

  useEffect(() => {
    const params = stockBranchFilter ? `?branchId=${stockBranchFilter}` : "";
    api<{ dates: any[] }>(`/api/stock-on-hand/history${params}`).then(d => setDates(d.dates || [])).catch(() => {});
  }, [stockBranchFilter]);

  function branchQuery() { return stockBranchFilter ? `?branchId=${stockBranchFilter}` : ""; }

  async function viewSnapshot(dateToLoad = snapshotDate) {
    if (!dateToLoad) return;
    setLoadingSnapshot(true);
    try {
      const data = await api<any>(`/api/stock-on-hand/${dateToLoad}${branchQuery()}`);
      setSnapshot(data);
    } catch (err: any) {
      setSnapshot(null);
      feedback.error({ title: "Snapshot not found", message: "No snapshot for this date." });
    } finally { setLoadingSnapshot(false); }
  }

  async function takeSnapshot() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await api("/api/stock-on-hand/snapshot", { method: "POST", body: JSON.stringify({ date: today, branchId: stockBranchFilter ?? undefined }) });
      setSnapshotDate(today);
      const data = await api<any>(`/api/stock-on-hand/${today}${branchQuery()}`);
      setSnapshot(data);
      api<{ dates: any[] }>(`/api/stock-on-hand/history${branchQuery()}`).then(d => setDates(d.dates || [])).catch(() => {});
      feedback.success({ title: "Snapshot saved", message: stockBranchFilter ? "This branch’s stock was recorded." : "All location quantities, including unassigned stock, were combined into one snapshot." });
    } catch (err: any) { feedback.error({ title: "Snapshot not taken", message: err.message }); }
  }

  async function saveThreshold(productId: string, currentThreshold: number) {
    const key = `${stockBranchFilter ?? "global"}:${productId}`;
    const raw = thresholdDrafts[key] ?? String(currentThreshold);
    const threshold = Number(raw);
    if (!Number.isInteger(threshold) || threshold < 0) {
      feedback.error({ title: "Invalid threshold", message: "Enter a whole number of zero or more." });
      return;
    }
    setSavingThreshold(key);
    try {
      await api(`/api/stock/${encodeURIComponent(productId)}`, {
        method: "PUT", body: JSON.stringify({ lowStockThreshold: threshold, branchId: stockBranchFilter ?? null }),
      });
      if (stockBranchFilter) setBranchStockSummary((current) => current.map((item) => String(item.productId ?? item.id) === productId ? { ...item, lowStockThreshold: threshold } : item));
      setThresholdDrafts((previous) => { const next = { ...previous }; delete next[key]; return next; });
      setThresholdBaselines((previous) => { const next = { ...previous }; delete next[key]; return next; });
      setEditingThreshold(null);
      feedback.success({ title: "Threshold saved", message: stockBranchFilter ? "This branch’s low stock alert level was updated." : "The global stock threshold was updated." });
    } catch (err: any) {
      feedback.error({ title: "Threshold not saved", message: err?.message || "Please try again." });
    } finally { setSavingThreshold(null); }
  }

  async function beginThresholdEdit(productId: string, displayedThreshold: number) {
    const key = `${stockBranchFilter ?? "global"}:${productId}`;
    try {
      let baseline = displayedThreshold;
      if (!stockBranchFilter) {
        const stock = await api<any>(`/api/stock/${encodeURIComponent(productId)}`);
        baseline = Number(stock?.lowStockThreshold ?? stock?.low_stock_threshold ?? 5);
      }
      setThresholdBaselines((previous) => ({ ...previous, [key]: baseline }));
      setThresholdDrafts((previous) => ({ ...previous, [key]: String(baseline) }));
      setEditingThreshold(key);
    } catch (err: any) {
      feedback.error({ title: "Threshold could not be loaded", message: err?.message || "Please try again." });
    }
  }

  async function loadReorderSuggestions() {
    setLoadingSuggestions(true);
    try {
      const result = await api<{ suggestions: any[] }>("/api/admin/reorder-suggestions");
      setReorderSuggestions(result.suggestions || []);
    } catch (err: any) {
      feedback.error({ title: "Suggestions unavailable", message: err?.message || "Please try again." });
    } finally { setLoadingSuggestions(false); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const items = stockBranchFilter ? branchStockSummary : (sData?.items || []);
  const availableStock = (item: any) => Math.max(0, (item.quantityInStock ?? item.quantity_in_stock ?? 0) - (item.quantityReserved ?? item.quantity_reserved ?? 0));
  const lowStock = items.filter((i: any) => availableStock(i) <= (i.lowStockThreshold ?? i.low_stock_threshold ?? 0));
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

      {(lowStock.length > 0 || showAutoReorder) && (
        <div className="panel" style={{ marginBottom: "1rem", background: "var(--warning-light)", borderColor: "var(--warning, #d97706)", color: "var(--warning-text)" }}>
          {lowStock.length > 0 ? <><strong>{lowStock.length}</strong> item(s) at or below the combined low stock threshold.</> : <span>Review low stock by location; a healthy total can hide shortages at an individual branch.</span>}
          {showAutoReorder && <RippleButton size="small" loading={loadingSuggestions} onClick={loadReorderSuggestions} style={{ marginLeft: "0.75rem" }}>Review reorder suggestions</RippleButton>}
        </div>
      )}

      {reorderSuggestions && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Reorder suggestions</h3>
          <p style={{ color: "var(--text-secondary)" }}>These are planning estimates only. No order has been created. Choose a real supplier and confirm each unit cost in Purchase Orders before placing an order.</p>
          {reorderSuggestions.length === 0 ? <EmptyState icon="stock" title="No reorder suggestions" description="Current stock is above the saved thresholds." /> : (
            <div className="table-wrap"><DataTable<any>
              ariaLabel="Reorder suggestions"
              columns={[
                { key: "product", label: "Product", render: (i) => i.name },
                { key: "branch", label: "Location", render: (i) => i.branchName || "Global stock" },
                { key: "available", label: "Available", align: "right", render: (i) => i.availableToTransfer },
                { key: "threshold", label: "Threshold", align: "right", render: (i) => i.lowStockThreshold },
                { key: "suggested", label: "Suggested qty", align: "right", render: (i) => <strong>{i.suggestedQuantity}</strong> },
                { key: "cost", label: "Catalog cost", align: "right", render: (i) => i.costPrice == null ? "Not set" : formatPrice(i.costPrice) },
              ]}
              rows={reorderSuggestions} rowKey={(i) => `${i.productId}:${i.branchId ?? "global"}`}
            /></div>
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
              <RippleButton key={d.date} size="small" variant="ghost" onClick={() => { setSnapshotDate(d.date); viewSnapshot(d.date); }}>
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
                { key: "product", label: "Product", sortable: true, value: (i) => i.productName, render: (i) => i.productName },
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
      {stockBranchFilter && branchStockLoading ? <Spinner /> : null}
      {stockBranchFilter && branchStockError ? <ErrorMsg msg={branchStockError} /> : null}
      {(!stockBranchFilter || (!branchStockLoading && !branchStockError)) && <div className="table-wrap">
        <DataTable<any>
          ariaLabel="Current stock levels"
          columns={[
            { key: "product", label: "Product", sortable: true, value: (i) => i.name, render: (i) => i.name },
            { key: "category", label: "Category", sortable: true, value: (i) => i.category || "", render: (i) => i.category || "—" },
            { key: "qty", label: "In Stock", sortable: true, align: "right", value: (i) => i.quantityInStock ?? i.quantity_in_stock ?? 0, render: (i) => <strong>{i.quantityInStock ?? i.quantity_in_stock ?? 0}</strong> },
            { key: "reserved", label: "Reserved", sortable: true, align: "right", value: (i) => i.quantityReserved ?? i.quantity_reserved ?? 0, render: (i) => i.quantityReserved ?? i.quantity_reserved ?? 0 },
            { key: "sold", label: "Sold", sortable: true, align: "right", value: (i) => i.quantitySold ?? i.quantity_sold ?? 0, render: (i) => i.quantitySold ?? i.quantity_sold ?? 0 },
            { key: "threshold", label: "Low stock threshold", sortable: true, align: "right", value: (i) => i.lowStockThreshold ?? i.low_stock_threshold ?? 0, render: (i) => {
              const threshold = i.lowStockThreshold ?? i.low_stock_threshold ?? 0;
              const productId = String(i.productId ?? i.id);
              const key = `${stockBranchFilter ?? "global"}:${productId}`;
              const baseline = thresholdBaselines[key] ?? threshold;
              if (editingThreshold !== key) return <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.35rem" }}>
                <span title={stockBranchFilter ? "Threshold for the selected branch" : "Combined threshold across locations"}>{stockBranchFilter ? threshold : `Combined: ${threshold}`}</span>
                <RippleButton size="small" variant="ghost" onClick={() => beginThresholdEdit(productId, threshold)}>{stockBranchFilter ? "Edit" : "Global threshold"}</RippleButton>
              </div>;
              const draft = thresholdDrafts[key] ?? String(baseline);
              return <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.35rem", alignItems: "center" }}>
                <input aria-label={`${stockBranchFilter ? "Branch" : "Global"} low stock threshold for ${i.name}`} type="number" min="0" step="1" value={draft} onChange={(e) => setThresholdDrafts((previous) => ({ ...previous, [key]: e.target.value }))} style={{ width: 76 }} />
                {draft !== String(baseline) && <RippleButton size="small" loading={savingThreshold === key} onClick={() => saveThreshold(productId, baseline)}>Save</RippleButton>}
                <RippleButton size="small" variant="ghost" onClick={() => setEditingThreshold(null)}>Cancel</RippleButton>
              </div>;
            } },
            {
              key: "status",
              label: "Status",
              sortable: true,
              value: (i) => availableStock(i) <= (i.lowStockThreshold ?? i.low_stock_threshold ?? 0) ? "Low" : "OK",
              render: (i) => {
                const threshold = i.lowStockThreshold ?? i.low_stock_threshold ?? 0;
                return availableStock(i) <= threshold ? <span style={{ color: "var(--danger)", fontWeight: 600 }}>Low</span> : <span style={{ color: "var(--success)" }}>OK</span>;
              },
            },
          ]}
          rows={filteredItems}
          rowKey={(i) => i.productId ?? i.id}
          empty={<EmptyState icon="stock" title={items.length === 0 ? "No stock data" : "No matches"} description={items.length === 0 ? "Stock levels will appear here once products are added." : `No products match "${search}".`} actionLabel={items.length === 0 ? "" : "Clear search"} onAction={() => setSearch("")} />}
        />
      </div>}
    </>
  );
}
