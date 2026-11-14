import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import RippleButton from "@/components/RippleButton";
import EmptyState from "@/components/EmptyState";
import { useFetch, Spinner, ErrorMsg } from "./shared";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { confirmDialog } from "@/components/ConfirmDialog";

interface SerialRecord {
  id: number;
  serial_number: string;
  product_id: string;
  product_name?: string;
  product_category?: string;
  product_barcode?: string;
  serial_kind?: string;
  legacy_identifier?: string | null;
  asset_tag?: string | null;
  repair_history?: Array<{ id: string; status: string; createdAt: string; issueSummary: string }>;
  status: string;
  sold_at?: string;
  warranty_expires?: string;
  order_number?: string;
  order_created_at?: string;
  customer_name?: string;
  branch_id?: number | null;
  branch_name?: string | null;
  created_at: string;
}

function warrantyStatus(serial: SerialRecord): string {
  if (serial.status !== "sold") return "—";
  if (!serial.warranty_expires) return "No warranty";
  const exp = new Date(serial.warranty_expires);
  if (isNaN(exp.getTime())) return "No warranty";
  if (exp < new Date()) return "Expired";
  const days = Math.ceil((exp.getTime() - Date.now()) / 86400000);
  return `Valid (${days}d left)`;
}

export default function AdminSerials() {
  const feedback = useFeedback();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [lookup, setLookup] = useState<SerialRecord | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [createSerialNumber, setCreateSerialNumber] = useState("");
  const [createAssetTag, setCreateAssetTag] = useState("");
  const [createProduct, setCreateProduct] = useState("");
  const [createWarrantyExpiry, setCreateWarrantyExpiry] = useState("");
  const [createBranch, setCreateBranch] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [branches, setBranches] = useState<Array<{ id: number; name: string }>>([]);
  const [reconcileSerial, setReconcileSerial] = useState<SerialRecord | null>(null);
  const [reconcileNumber, setReconcileNumber] = useState("");
  const [reconcileAssetTag, setReconcileAssetTag] = useState("");
  const [reconcileBranch, setReconcileBranch] = useState("");
  const [reconcileVerified, setReconcileVerified] = useState(false);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);
  const lookupRef = useRef<HTMLInputElement>(null);
  const [reload, setReload] = useState(0);

  const { data, loading, error, refetch } = useFetch(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (branchFilter) params.set("branchId", branchFilter);
    return api<{ serials: SerialRecord[] }>("/api/serials?" + params.toString());
  }, [reload, statusFilter, branchFilter]);

  useEffect(() => {
    api<{ products: Product[] }>("/api/products?includeHidden=1").then((d) => setProducts(d.products || [])).catch(() => {});
  }, []);

  useEffect(() => {
    api<{ branches: Array<{ id: number; name: string }>; activeBranchId?: number | null; canViewAllBranches?: boolean }>("/api/pos/branches")
      .then((d) => {
        setBranches(d.branches || []);
        if (d.activeBranchId) {
          if (!d.canViewAllBranches) setBranchFilter(String(d.activeBranchId));
          setCreateBranch(String(d.activeBranchId));
          setReconcileBranch(String(d.activeBranchId));
        }
      })
      .catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    const query = branchFilter ? `?branchId=${encodeURIComponent(branchFilter)}` : "";
    api<{ discrepancies: any[] }>(`/api/serials/reconciliation${query}`)
      .then((d) => setDiscrepancies(d.discrepancies || []))
      .catch(() => setDiscrepancies([]));
  }, [branchFilter, reload]);

  function doRefresh() {
    setReload((r) => r + 1);
    refetch();
  }

  async function runLookup() {
    const code = search.trim();
    if (!code) return;
    setLookupLoading(true); setLookupError(""); setLookup(null);
    try {
      const serial = await api<SerialRecord>(`/api/serials/lookup/${encodeURIComponent(code)}`);
      setLookup(serial);
    } catch (e: any) {
      setLookupError(e.message || "Serial number not found.");
    } finally {
      setLookupLoading(false);
    }
  }

  async function createOne() {
    if (!createSerialNumber.trim() || !createProduct || !createBranch) { feedback.error({ title: "Serial not added", message: "Serial number, product, and stock location are required." }); return; }
    setCreateLoading(true);
    try {
      await api("/api/serials", { method: "POST", body: JSON.stringify({ serialNumber: createSerialNumber.trim(), assetTag: createAssetTag.trim() || undefined, productId: createProduct, branchId: createBranch === "central" ? null : Number(createBranch), warrantyExpires: createWarrantyExpiry || undefined }) });
      feedback.success({ title: "Serial added" });
      setCreateSerialNumber(""); setCreateAssetTag(""); setCreateProduct(""); setCreateWarrantyExpiry("");
      setShowCreate(false);
      doRefresh();
    } catch (e: any) { feedback.error({ title: "Serial not added", message: e.message }); }
    finally { setCreateLoading(false); }
  }

  function beginReconcile(sn: SerialRecord) {
    setReconcileSerial(sn);
    setReconcileNumber("");
    setReconcileAssetTag(sn.asset_tag || "");
    setReconcileBranch(branchFilter || (branches.length === 1 ? String(branches[0].id) : ""));
    setReconcileVerified(false);
  }

  async function reconcileOne() {
    if (!reconcileSerial || !reconcileNumber.trim() || !reconcileVerified || (reconcileSerial.status === "in_stock" && !reconcileBranch)) {
      feedback.error({ title: "Serial not reconciled", message: "Verify the manufacturer serial from the device label and choose its current stock location." });
      return;
    }
    setReconcileLoading(true);
    try {
      const body: Record<string, unknown> = { serialNumber: reconcileNumber.trim(), assetTag: reconcileAssetTag.trim() || undefined, verifiedFromDeviceLabel: true };
      if (reconcileSerial.status === "in_stock") body.branchId = reconcileBranch === "central" ? null : Number(reconcileBranch);
      await api(`/api/serials/${reconcileSerial.id}/reconcile`, { method: "POST", body: JSON.stringify(body) });
      feedback.success({ title: "Legacy serial reconciled", message: "The old identifier was retained for lookup and an audit entry was recorded." });
      setReconcileSerial(null);
      doRefresh();
    } catch (e: any) { feedback.error({ title: "Serial not reconciled", message: e.message }); }
    finally { setReconcileLoading(false); }
  }

  async function voidOne(sn: SerialRecord) {
    if (!(await confirmDialog({ message: `Void serial ${sn.serial_number}?`, confirmLabel: "Void", danger: true }))) return;
    try {
      await api(`/api/serials/${sn.id}/void`, { method: "POST" });
      feedback.success({ title: "Serial voided" });
      if (lookup && lookup.id === sn.id) setLookup(null);
      doRefresh();
    } catch (e: any) { feedback.error({ title: "Serial not voided", message: e.message }); }
  }

  const serials = data?.serials || [];
  const available = serials.filter((s) => s.status === "in_stock").length;
  const sold = serials.filter((s) => s.status === "sold").length;

  return (
    <>
      <h1>Serial Numbers</h1>

      <div className="panel" style={{ marginBottom: "1rem", padding: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            ref={lookupRef}
            type="text"
            className="input"
            placeholder="Scan a manufacturer serial or internal asset tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runLookup(); } }}
            style={{ flex: 1, minWidth: 220, fontSize: "0.95rem" }}
          />
          <RippleButton size="small" onClick={runLookup} loading={lookupLoading}>Check</RippleButton>
          <RippleButton size="small" onClick={() => setShowCreate(true)}>Add Manual</RippleButton>
        </div>
        {lookupError && <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginTop: "0.5rem" }}>{lookupError}</p>}
        {lookup && (
          <div style={{ marginTop: "0.75rem", border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem", background: "var(--bg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{lookup.serial_number}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{lookup.serial_kind === "manufacturer" ? "Manufacturer serial" : "Legacy · not yet verified"}{lookup.legacy_identifier ? ` · Previous ID ${lookup.legacy_identifier}` : ""}{lookup.asset_tag ? ` · Asset tag ${lookup.asset_tag}` : ""}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{lookup.product_name || lookup.product_id}{lookup.product_category ? ` · ${lookup.product_category}` : ""}</div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>Recorded location: {lookup.branch_name || "Central / no branch"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className={`badge ${lookup.status === "sold" ? "badge-success" : lookup.status === "in_stock" ? "badge-info" : "badge-danger"}`} style={{ textTransform: "capitalize" }}>{lookup.status.replace("_", " ")}</span>
                <div style={{ fontSize: "0.8rem", marginTop: "0.25rem", color: "var(--text-secondary)" }}>Warranty: <strong>{warrantyStatus(lookup)}</strong></div>
              </div>
            </div>
            {(lookup.status === "sold") && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                {lookup.customer_name && <span>Customer: <strong>{lookup.customer_name}</strong></span>}
                {lookup.order_number && <span>Order: <strong>#{lookup.order_number}</strong></span>}
                {lookup.sold_at && <span>Sold: <strong>{new Date(lookup.sold_at).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}</strong></span>}
                {lookup.warranty_expires && <span>Warranty until: <strong>{new Date(lookup.warranty_expires).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}</strong></span>}
              </div>
            )}
            {lookup.status === "in_stock" && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>In stock at {lookup.branch_name || "Central / no branch"} — available to sell.</div>
            )}
            {!!lookup.repair_history?.length && <div style={{ marginTop: "0.65rem", fontSize: "0.85rem" }}><strong>Repair history</strong><ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.2rem" }}>{lookup.repair_history.map((ticket) => <li key={ticket.id}>#{ticket.id} · {ticket.issueSummary || "Repair request"} · {ticket.status} · {new Date(ticket.createdAt).toLocaleDateString("en-GB")}</li>)}</ul></div>}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1rem" }}>
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ fontSize: "0.85rem", width: "auto" }}>
          <option value="">All statuses</option>
          <option value="in_stock">In stock</option>
          <option value="sold">Sold</option>
          <option value="void">Void</option>
          <option value="in_transit">In transit</option>
          <option value="reserved">Reserved</option>
          <option value="quarantined">Quarantined</option>
          <option value="disposed">Disposed</option>
        </select>
        <select className="input" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} style={{ fontSize: "0.85rem", width: "auto" }} aria-label="Filter serials by branch">
          <option value="">All locations</option>
          {branches.length === 0 && <option value="central">Central / no branch</option>}
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <span style={{ fontSize: "0.8rem", opacity: 0.6 }}>{serials.length} shown · {available} in stock · {sold} sold</span>
      </div>

      {discrepancies.length > 0 && (
        <section className="panel" aria-labelledby="serial-stock-check-title" style={{ marginBottom: "1rem", padding: "1rem" }}>
          <h2 id="serial-stock-check-title" style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Serial and stock counts need review</h2>
          <p style={{ margin: "0 0 0.65rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>These serial-tracked products have a different quantity in stock control and serial records. Reconcile the physical units before selling, transferring, or disposing of them.</p>
          <div style={{ display: "grid", gap: "0.4rem" }}>
            {discrepancies.map((d) => <div key={`${d.product_id}-${d.branch_id ?? "central"}`} style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: "0.4rem", fontSize: "0.85rem" }}>
              <span><strong>{d.product_name}</strong> · {d.branch_name || "Central / no branch"}</span>
              <span>Stock: <strong>{d.stock_quantity}</strong> · In-stock serials: <strong>{d.serial_quantity}</strong></span>
            </div>)}
          </div>
        </section>
      )}

      {error && <ErrorMsg msg={error} />}
      {loading ? <Spinner /> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Manufacturer serial</th><th>Previous identifier</th><th>Asset tag</th><th>Product</th><th>Branch</th><th>Status</th><th>Warranty</th><th>Sold to / Order</th><th>Added</th><th></th></tr></thead>
            <tbody>
              {serials.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{s.serial_number}<small style={{ display: "block", fontFamily: "inherit", color: "var(--text-secondary)" }}>{s.serial_kind === "manufacturer" ? "Verified manufacturer serial" : "Legacy · not yet verified"}</small></td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{s.legacy_identifier || "—"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{s.asset_tag || "—"}</td>
                  <td style={{ fontSize: "0.85rem" }}>{s.product_name || s.product_id}</td>
                  <td style={{ fontSize: "0.82rem" }}>{s.status === "in_transit" ? "In transit" : s.branch_name || "Central / no branch"}</td>
                  <td><span className={`badge ${s.status === "sold" ? "badge-success" : s.status === "in_stock" ? "badge-info" : "badge-danger"}`} style={{ textTransform: "capitalize" }}>{s.status.replace("_", " ")}</span></td>
                  <td style={{ fontSize: "0.82rem" }}>{s.status === "sold" ? (s.warranty_expires ? new Date(s.warranty_expires).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" }) : "No warranty") : "—"}</td>
                  <td style={{ fontSize: "0.82rem" }}>
                    {s.status === "sold" ? `${s.customer_name ? s.customer_name + " · " : ""}#${s.order_number || ""}` : "—"}
                  </td>
                  <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{new Date(s.created_at).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}</td>
                  <td>
                    {s.serial_kind === "legacy" && (s.status === "in_stock" || s.status === "sold") && (
                      <RippleButton size="small" onClick={() => beginReconcile(s)}>Verify device</RippleButton>
                    )}
                    {s.status === "in_stock" && (
                      <RippleButton size="small" variant="danger" onClick={() => voidOne(s)}>Void</RippleButton>
                    )}
                  </td>
                </tr>
              ))}
              {serials.length === 0 && <tr><td colSpan={10}><EmptyState icon="box" title="No device records" description="Scan manufacturer serials when receiving tracked hardware, or add a device manually." /></td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowCreate(false)}>
          <div className="panel" style={{ width: "min(520px, 92vw)", maxHeight: "90vh", overflowY: "auto", padding: "1.25rem" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Add Serial Manually</h3>
            <div className="field"><label>Manufacturer serial number<input className="input" value={createSerialNumber} onChange={(e) => setCreateSerialNumber(e.target.value)} placeholder="Read from the device label" /></label></div>
            <div className="field"><label>Internal asset tag (optional)<input className="input" value={createAssetTag} onChange={(e) => setCreateAssetTag(e.target.value)} placeholder="Your own inventory label" /></label></div>
            <div className="field"><label>Product
              <select className="input" value={createProduct} onChange={(e) => setCreateProduct(e.target.value)} style={{ width: "100%" }}>
                <option value="">-- Select product --</option>
                {products.filter((p) => p.serialTracking).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
              </select>
            </label></div>
            <div className="field"><label>Stock location
              <select className="input" value={createBranch} onChange={(e) => setCreateBranch(e.target.value)} style={{ width: "100%" }}>
                <option value="">-- Choose location --</option>
                {branches.length === 0 && <option value="central">Central / no branch</option>}
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label></div>
            <p style={{ marginTop: 0, color: "var(--text-secondary)", fontSize: "0.8rem" }}>Use the device’s real manufacturer serial. This records device identity only; it does not change stock quantity. Receive stock through a purchase order or stocktake.</p>
            <div className="field"><label>Warranty expiry (optional)<input className="input" type="date" value={createWarrantyExpiry} onChange={(e) => setCreateWarrantyExpiry(e.target.value)} /></label></div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <RippleButton variant="primary" loading={createLoading} onClick={createOne}>Add</RippleButton>
              <RippleButton onClick={() => setShowCreate(false)}>Cancel</RippleButton>
            </div>
          </div>
        </div>
      )}

      {reconcileSerial && (
        <div style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={() => setReconcileSerial(null)}>
          <div className="panel" style={{ width: "min(540px, 96vw)", maxHeight: "90vh", overflowY: "auto", padding: "1.25rem" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Verify legacy device</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Current legacy identifier: <strong>{reconcileSerial.serial_number}</strong>. It will be retained for future lookup. Do not guess: check the manufacturer label on the actual device.</p>
            <div className="field"><label>Manufacturer serial from device label<input className="input" value={reconcileNumber} onChange={(e) => setReconcileNumber(e.target.value)} placeholder="Read from the device itself" /></label></div>
            <div className="field"><label>Internal asset tag (optional)<input className="input" value={reconcileAssetTag} onChange={(e) => setReconcileAssetTag(e.target.value)} placeholder="Your own inventory label" /></label></div>
            {reconcileSerial.status === "in_stock" && <div className="field"><label>Current stock location
              <select className="input" value={reconcileBranch} onChange={(e) => setReconcileBranch(e.target.value)} style={{ width: "100%" }}>
                <option value="">-- Confirm location --</option>
                {branches.length === 0 && <option value="central">Central / no branch</option>}
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label></div>}
            {reconcileSerial.status === "sold" && <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>This unit is already sold; its order and customer history will be preserved. Its historical branch will not be changed.</p>}
            <label style={{ display: "flex", gap: "0.55rem", alignItems: "flex-start", margin: "0.75rem 0 1rem", fontSize: "0.85rem" }}>
              <input type="checkbox" checked={reconcileVerified} onChange={(e) => setReconcileVerified(e.target.checked)} />
              I checked this device’s label and verified the manufacturer serial above.
            </label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <RippleButton variant="primary" loading={reconcileLoading} onClick={reconcileOne}>Save verified details</RippleButton>
              <RippleButton onClick={() => setReconcileSerial(null)}>Cancel</RippleButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
