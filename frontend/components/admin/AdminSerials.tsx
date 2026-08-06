import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import RippleButton from "@/components/RippleButton";
import EmptyState from "@/components/EmptyState";
import { useFetch, Spinner, ErrorMsg, escapeHtml } from "./shared";
import { toast } from "@/components/Toast";
import { confirmDialog } from "@/components/ConfirmDialog";

interface SerialRecord {
  id: number;
  serial_number: string;
  product_id: string;
  product_name?: string;
  product_category?: string;
  product_barcode?: string;
  status: string;
  sold_at?: string;
  warranty_expires?: string;
  order_number?: string;
  order_created_at?: string;
  customer_name?: string;
  branch_id?: number | null;
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [lookup, setLookup] = useState<SerialRecord | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [genProduct, setGenProduct] = useState("");
  const [genCount, setGenCount] = useState("5");
  const [genResult, setGenResult] = useState<string[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [createSerialNumber, setCreateSerialNumber] = useState("");
  const [createProduct, setCreateProduct] = useState("");
  const [createWarrantyExpiry, setCreateWarrantyExpiry] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const lookupRef = useRef<HTMLInputElement>(null);
  const [reload, setReload] = useState(0);

  const { data, loading, error, refetch } = useFetch(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    return api<{ serials: SerialRecord[] }>("/api/serials?" + params.toString());
  }, [reload, statusFilter]);

  useEffect(() => {
    api<{ products: Product[] }>("/api/products?includeHidden=1").then((d) => setProducts(d.products || [])).catch(() => {});
  }, []);

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

  async function generate() {
    if (!genProduct) { toast("error", "Select a product."); return; }
    setGenLoading(true); setGenResult([]);
    try {
      const res = await api<{ serials: { serialNumber: string }[] }>("/api/serials/generate", { method: "POST", body: JSON.stringify({ productId: genProduct, count: Number(genCount) || 1 }) });
      setGenResult((res.serials || []).map((s) => s.serialNumber));
      toast("success", "Serials generated.");
      doRefresh();
    } catch (e: any) { toast("error", e.message); }
    finally { setGenLoading(false); }
  }

  async function createOne() {
    if (!createSerialNumber.trim() || !createProduct) { toast("error", "Serial number and product are required."); return; }
    setCreateLoading(true);
    try {
      await api("/api/serials", { method: "POST", body: JSON.stringify({ serialNumber: createSerialNumber.trim(), productId: createProduct, warrantyExpires: createWarrantyExpiry || undefined }) });
      toast("success", "Serial added.");
      setCreateSerialNumber(""); setCreateProduct(""); setCreateWarrantyExpiry("");
      setShowCreate(false);
      doRefresh();
    } catch (e: any) { toast("error", e.message); }
    finally { setCreateLoading(false); }
  }

  async function voidOne(sn: SerialRecord) {
    if (!(await confirmDialog({ message: `Void serial ${sn.serial_number}?`, confirmLabel: "Void", danger: true }))) return;
    try {
      await api(`/api/serials/${sn.id}/void`, { method: "POST" });
      toast("success", "Serial voided.");
      if (lookup && lookup.id === sn.id) setLookup(null);
      doRefresh();
    } catch (e: any) { toast("error", e.message); }
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
            placeholder="Scan or type a serial number to check warranty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runLookup(); } }}
            style={{ flex: 1, minWidth: 220, fontSize: "0.95rem" }}
          />
          <RippleButton size="small" onClick={runLookup} loading={lookupLoading}>Check</RippleButton>
          <RippleButton size="small" variant="primary" onClick={() => setShowGenerate(true)}>Generate Serials</RippleButton>
          <RippleButton size="small" onClick={() => setShowCreate(true)}>Add Manual</RippleButton>
        </div>
        {lookupError && <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginTop: "0.5rem" }}>{lookupError}</p>}
        {lookup && (
          <div style={{ marginTop: "0.75rem", border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem", background: "var(--bg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{lookup.serial_number}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{lookup.product_name || lookup.product_id}{lookup.product_category ? ` · ${lookup.product_category}` : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className={`badge ${lookup.status === "sold" ? "badge-success" : lookup.status === "in_stock" ? "badge-info" : "badge-danger"}`} style={{ textTransform: "capitalize" }}>{lookup.status.replace("_", " ")}</span>
                <div style={{ fontSize: "0.8rem", marginTop: "0.25rem", color: "var(--text-secondary)" }}>Warranty: <strong>{warrantyStatus(lookup)}</strong></div>
              </div>
            </div>
            {(lookup.status === "sold") && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                {lookup.customer_name && <span>Customer: <strong>{escapeHtml(lookup.customer_name)}</strong></span>}
                {lookup.order_number && <span>Order: <strong>#{lookup.order_number}</strong></span>}
                {lookup.sold_at && <span>Sold: <strong>{new Date(lookup.sold_at).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}</strong></span>}
                {lookup.warranty_expires && <span>Warranty until: <strong>{new Date(lookup.warranty_expires).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}</strong></span>}
              </div>
            )}
            {lookup.status === "in_stock" && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>In stock at branch {lookup.branch_id ? `#${lookup.branch_id}` : "(central)"} — available to sell.</div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1rem" }}>
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ fontSize: "0.85rem", width: "auto" }}>
          <option value="">All statuses</option>
          <option value="in_stock">In stock</option>
          <option value="sold">Sold</option>
          <option value="void">Void</option>
        </select>
        <span style={{ fontSize: "0.8rem", opacity: 0.6 }}>{serials.length} shown · {available} in stock · {sold} sold</span>
      </div>

      {error && <ErrorMsg msg={error} />}
      {loading ? <Spinner /> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Serial</th><th>Product</th><th>Status</th><th>Warranty</th><th>Sold to / Order</th><th>Added</th><th></th></tr></thead>
            <tbody>
              {serials.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{escapeHtml(s.serial_number)}</td>
                  <td style={{ fontSize: "0.85rem" }}>{escapeHtml(s.product_name || s.product_id)}</td>
                  <td><span className={`badge ${s.status === "sold" ? "badge-success" : s.status === "in_stock" ? "badge-info" : "badge-danger"}`} style={{ textTransform: "capitalize" }}>{s.status.replace("_", " ")}</span></td>
                  <td style={{ fontSize: "0.82rem" }}>{s.status === "sold" ? (s.warranty_expires ? new Date(s.warranty_expires).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" }) : "No warranty") : "—"}</td>
                  <td style={{ fontSize: "0.82rem" }}>
                    {s.status === "sold" ? `${s.customer_name ? escapeHtml(s.customer_name) + " · " : ""}#${s.order_number || ""}` : "—"}
                  </td>
                  <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{new Date(s.created_at).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}</td>
                  <td>
                    {s.status === "in_stock" && (
                      <RippleButton size="small" variant="danger" onClick={() => voidOne(s)}>Void</RippleButton>
                    )}
                  </td>
                </tr>
              ))}
              {serials.length === 0 && <tr><td colSpan={7}><EmptyState icon="box" title="No serials" description="Generate or add serial numbers, or receive them on a purchase order." /></td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showGenerate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => { setShowGenerate(false); setGenResult([]); }}>
          <div className="panel" style={{ width: "min(480px, 92vw)", padding: "1.25rem" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Generate Serials</h3>
            <div className="field"><label>Product
              <select className="input" value={genProduct} onChange={(e) => setGenProduct(e.target.value)} style={{ width: "100%" }}>
                <option value="">-- Select product --</option>
                {products.filter((p) => p.serialTracking).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
              </select>
            </label></div>
            <div className="field"><label>Count<input className="input" type="number" min="1" max="500" value={genCount} onChange={(e) => setGenCount(e.target.value)} /></label></div>
            {genResult.length > 0 && (
              <div style={{ margin: "0.5rem 0", fontSize: "0.85rem" }}>
                <div style={{ marginBottom: "0.25rem" }}>Generated:</div>
                <div style={{ fontFamily: "monospace", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                  {genResult.map((s) => <span key={s} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.15rem 0.4rem", fontSize: "0.8rem" }}>{s}</span>)}
                </div>
                <p style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: "0.5rem" }}>Print these and stick them on the units. They are now in stock for this product.</p>
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <RippleButton variant="primary" loading={genLoading} onClick={generate}>Generate</RippleButton>
              <RippleButton onClick={() => { setShowGenerate(false); setGenResult([]); }}>Close</RippleButton>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowCreate(false)}>
          <div className="panel" style={{ width: "min(460px, 92vw)", padding: "1.25rem" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Add Serial Manually</h3>
            <div className="field"><label>Serial number<input className="input" value={createSerialNumber} onChange={(e) => setCreateSerialNumber(e.target.value)} placeholder="e.g. SN-000001" /></label></div>
            <div className="field"><label>Product
              <select className="input" value={createProduct} onChange={(e) => setCreateProduct(e.target.value)} style={{ width: "100%" }}>
                <option value="">-- Select product --</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
              </select>
            </label></div>
            <div className="field"><label>Warranty expiry (optional)<input className="input" type="date" value={createWarrantyExpiry} onChange={(e) => setCreateWarrantyExpiry(e.target.value)} /></label></div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <RippleButton variant="primary" loading={createLoading} onClick={createOne}>Add</RippleButton>
              <RippleButton onClick={() => setShowCreate(false)}>Cancel</RippleButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
