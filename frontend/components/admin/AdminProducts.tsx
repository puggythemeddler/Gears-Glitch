import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import RippleButton from "@/components/RippleButton";
import EmptyState from "@/components/EmptyState";
import { useFetch, Spinner, ErrorMsg, formatPrice, escapeHtml } from "./shared";

export default function AdminProducts() {
  const { data: pData, loading, error, refetch } = useFetch(() => api<{ products: Product[] }>("/api/products"), []);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gallery, setGallery] = useState<any[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [selCategory, setSelCategory] = useState("");
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [specFields, setSpecFields] = useState<any[]>([]);
  const [specValues, setSpecValues] = useState<Record<string, string>>({});

  const [showImport, setShowImport] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulk, setShowBulk] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");

  function downloadTemplate() {
    const headers = "name,price,category,inStock,isNonStock,hasWarranty,warrantyDuration,taxable,subcategory";
    const row = "Example Laptop,999.99,Electronics,TRUE,FALSE,FALSE,0,TRUE,gaming";
    const csv = headers + "\r\n" + row;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "product-import-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    const file = importFileRef.current?.files?.[0];
    if (!file) { setImportMsg("Error: Please select a CSV file"); return; }
    setImporting(true); setImportMsg("");
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { setImportMsg("Error: CSV file must have a header row and at least one data row"); setImporting(false); return; }
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const required = ["name", "price", "category"];
      const missingHeaders = required.filter(r => !headers.includes(r));
      if (missingHeaders.length > 0) { setImportMsg(`Error: Missing required columns: ${missingHeaders.join(", ")}`); setImporting(false); return; }
      const rows: any[] = [];
      const errors: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(",").map(v => v.trim());
        const row: any = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] || ""; });
        const missing = required.filter(r => !row[r]);
        if (missing.length > 0) { errors.push(`Row ${i + 1}: missing ${missing.join(", ")}`); continue; }
        if (isNaN(parseFloat(row.price)) || parseFloat(row.price) <= 0) { errors.push(`Row ${i + 1}: invalid price "${row.price}"`); continue; }
        rows.push(row);
      }
      if (errors.length > 0) { setImportMsg(`Error: ${errors.length} row(s) with errors:\n${errors.slice(0, 10).join("\n")}${errors.length > 10 ? `\n...and ${errors.length - 10} more` : ""}`); setImporting(false); return; }
      if (rows.length === 0) { setImportMsg("Error: No valid rows to import"); setImporting(false); return; }
      const res = await api<{ imported: number }>("/api/products/import", { method: "POST", body: { products: rows } });
      setImportMsg(`Success: Imported ${res.imported} product(s)`);
      refetch();
      if (importFileRef.current) importFileRef.current.value = "";
    } catch (e: any) {
      setImportMsg(`Error: ${e.message || "Import failed"}`);
    } finally { setImporting(false); }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function toggleSelectAll() {
    if (selectedIds.size === products.length) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(products.map((p) => p.id))); }
  }

  async function handleBulkEdit(e: React.FormEvent) {
    e.preventDefault();
    const productIds = Array.from(selectedIds);
    if (productIds.length === 0) return;
    setBulkSaving(true); setBulkMsg("");
    const fd = new FormData(e.target as HTMLFormElement);
    const updates: any = {};
    const price = fd.get("bulkPrice");
    const category = fd.get("bulkCategory");
    const inStock = fd.get("bulkInStock");
    if (price !== null && price !== "") updates.price = Number(price);
    if (category !== null && category !== "") updates.category = String(category).trim();
    if (inStock !== null && inStock !== "") updates.inStock = inStock === "true";
    if (Object.keys(updates).length === 0) { setBulkMsg("Set at least one field to update."); setBulkSaving(false); return; }
    try {
      const res = await api<{ updated: number }>("/api/admin/products/bulk-edit", { method: "POST", body: { productIds, updates } });
      setBulkMsg(`Updated ${res.updated} product(s).`);
      setSelectedIds(new Set()); setShowBulk(false); refetch();
    } catch (e: any) { setBulkMsg(e.message || "Bulk edit failed."); }
    finally { setBulkSaving(false); }
  }

  const empty: Product = { id: "", name: "", price: 0, currency: "KES", imageUrl: "", category: "", subcategory: "", inStock: true, isNonStock: false, hasWarranty: false, warrantyDuration: 0, taxable: true, specs: [], minTier: 0 };

  useEffect(() => {
    const cat = creating ? selCategory : (editing?.category || "");
    if (cat) {
      fetch(`/api/categories/${encodeURIComponent(cat)}/subcategories`).then(r => r.json()).then(d => setSubcategories(d.subcategories || [])).catch(() => setSubcategories([]));
      api<{ fields: any[] }>(`/api/spec-templates?category=${encodeURIComponent(cat)}`).then(d => {
        setSpecFields(d.fields || []);
        if (!creating && editing) {
          const vals: Record<string, string> = {};
          (editing.specs || []).forEach((s: any) => {
            if (typeof s === "string") { const m = s.match(/^([^:]+):\s*(.+)/); if (m) vals[m[1].toLowerCase().replace(/\s+/g, "_")] = m[2]; }
            else if (s && s.f) vals[s.f] = s.v;
          });
          setSpecValues(vals);
        }
      }).catch(() => setSpecFields([]));
    } else { setSpecFields([]); setSpecValues({}); }
  }, [creating, editing?.id, selCategory]);

  async function loadGallery(productId: string) {
    setGalleryLoading(true);
    try { const d = await api<{ images: any[] }>(`/api/products/${encodeURIComponent(productId)}/images`); setGallery(d.images || []); } catch { setGallery([]); }
    finally { setGalleryLoading(false); }
  }

  async function uploadPrimaryImage(productId: string, file: File) {
    const fd = new FormData();
    fd.append("image", file);
    try { await api(`/api/products/${encodeURIComponent(productId)}/image`, { method: "POST", body: fd }); refetch(); } catch (err: any) { alert("Primary upload failed: " + err.message); }
  }

  async function uploadGalleryImages(productId: string) {
    const files = galleryRef.current?.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("image", file);
      try { await api(`/api/products/${encodeURIComponent(productId)}/images`, { method: "POST", body: fd }); } catch (err: any) { alert("Upload failed: " + err.message); }
    }
    if (galleryRef.current) galleryRef.current.value = "";
    await loadGallery(productId);
  }

  async function setPrimary(productId: string, imageId: number) {
    try { await api(`/api/products/${encodeURIComponent(productId)}/images/${imageId}/primary`, { method: "PUT" }); await loadGallery(productId); refetch(); } catch (err: any) { alert("Failed: " + err.message); }
  }

  async function deleteGalleryImage(productId: string, imageId: number) {
    if (!confirm("Remove this image?")) return;
    try { await api(`/api/products/${encodeURIComponent(productId)}/images/${imageId}`, { method: "DELETE" }); await loadGallery(productId); } catch { alert("Delete failed"); }
  }

  function buildSpecsArray(): any[] {
    if (specFields.length > 0) {
      return specFields.map(f => ({ f: f.fieldKey, l: f.fieldLabel, v: specValues[f.fieldKey] || "" })).filter(s => s.v);
    }
    return [];
  }

  async function saveProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body: any = {
      name: fd.get("name"), price: Number(fd.get("price")), category: fd.get("category"),
      inStock: fd.get("inStock") === "true", isNonStock: fd.get("isNonStock") === "on",
      hasWarranty: fd.get("hasWarranty") === "on",
      warrantyDuration: Number(fd.get("warrantyDuration") || 0),
      taxable: fd.get("taxable") === "on",
      subcategory: fd.get("subcategory") || "",
      specs: buildSpecsArray(),
    };
    try {
      if (creating) {
        const created = await api<any>("/api/products", { method: "POST", body: JSON.stringify(body) });
        await uploadGalleryImages(created.id);
      } else if (editing) {
        await api(`/api/products/${encodeURIComponent(editing.id)}`, { method: "PUT", body: JSON.stringify(body) });
        await uploadGalleryImages(editing.id);
      }
      setEditing(null); setCreating(false); refetch();
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function deleteProduct(id: string) {
    if (!confirm("Delete this product?")) return;
    try { await api(`/api/products/${encodeURIComponent(id)}`, { method: "DELETE" }); refetch(); } catch { alert("Delete failed"); }
  }

  useEffect(() => { if (editing && !creating && editing.id) loadGallery(editing.id); else setGallery([]); }, [editing?.id, creating]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const products = pData?.products || [];

  if (creating || editing) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <RippleButton size="small" variant="ghost" onClick={() => { setEditing(null); setCreating(false); }}>&larr; Back</RippleButton>
          <h1 style={{ margin: 0 }}>{creating ? "New Product" : "Edit: " + escapeHtml(editing!.name)}</h1>
        </div>
        <div className="panel" style={{ maxWidth: 560 }}>
          <form onSubmit={saveProduct} className="auth-form">
            {!creating && (
              <div style={{ marginBottom: "0.75rem", textAlign: "center" }}>
                {editing?.imageUrl && <img src={editing.imageUrl} alt="" style={{ maxWidth: 300, maxHeight: 180, borderRadius: 8, objectFit: "cover", marginBottom: "0.5rem" }} />}
                <div><label style={{ fontSize: "0.85rem", cursor: "pointer" }}>Replace primary image<input type="file" accept="image/*" style={{ display: "block", margin: "0.25rem auto" }} onChange={(e) => { const f = e.target.files?.[0]; if (f && editing) uploadPrimaryImage(editing.id, f); }} /></label></div>
              </div>
            )}
            <div className="field"><label>Name<input name="name" defaultValue={editing?.name} required /></label></div>
            <div className="field"><label>Price (KES)<input name="price" type="number" defaultValue={editing?.price} required /></label></div>
            <div className="field"><label>Category<input name="category" defaultValue={editing?.category} onChange={(e) => setSelCategory(e.target.value)} /></label></div>
            {subcategories.length > 0 && (
              <div className="field"><label>Subcategory<select name="subcategory" defaultValue={editing?.subcategory || ""}><option value="">None</option>{subcategories.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
            )}
            <div className="field"><label>In stock<select name="inStock" defaultValue={String(editing?.inStock ?? true)}><option value="true">Yes</option><option value="false">No</option></select></label></div>
            <div className="field"><label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}><input type="checkbox" name="isNonStock" defaultChecked={editing?.isNonStock ?? false} /> Non-stock item</label></div>
            <div className="field"><label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}><input type="checkbox" name="hasWarranty" defaultChecked={editing?.hasWarranty ?? false} /> Has warranty</label></div>
            <div className="field"><label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}><input type="checkbox" name="taxable" defaultChecked={editing?.taxable !== false} /> Taxable (eTims-compatible)</label></div>
            <div className="field"><label>Warranty duration (months)<input name="warrantyDuration" type="number" min="0" defaultValue={editing?.warrantyDuration || 0} /></label></div>
            <div className="field"><label>Add images (multiple)<input type="file" ref={galleryRef} accept="image/*" multiple /></label></div>
            {specFields.length > 0 ? (
              <div>
                <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Specifications</p>
                {specFields.map(f => (
                  <div className="field" key={f.fieldKey}>
                    <label>{f.fieldLabel}{f.required ? " *" : ""}
                      {f.fieldType === "select" ? (
                        <select value={specValues[f.fieldKey] || ""} onChange={(e) => setSpecValues({ ...specValues, [f.fieldKey]: e.target.value })} required={f.required}>
                          <option value="">-- Select --</option>
                          {(f.options || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : f.fieldType === "multiselect" ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", paddingTop: "0.25rem" }}>
                          {(f.options || []).map((o: string) => (
                            <label key={o} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.85rem", cursor: "pointer" }}>
                              <input type="checkbox" checked={(specValues[f.fieldKey] || "").split(",").includes(o)} onChange={(e) => {
                                const cur = (specValues[f.fieldKey] || "").split(",").filter(Boolean);
                                const next = e.target.checked ? [...cur, o] : cur.filter((x: string) => x !== o);
                                setSpecValues({ ...specValues, [f.fieldKey]: next.join(",") });
                              }} /> {o}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <input type={f.fieldType === "number" ? "number" : "text"} value={specValues[f.fieldKey] || ""} onChange={(e) => setSpecValues({ ...specValues, [f.fieldKey]: e.target.value })} required={f.required} />
                      )}
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="field"><label>Specs (one per line)<textarea name="specs" rows={4} defaultValue={(editing?.specs || []).map(s => typeof s === "string" ? s : `${s.f}: ${s.v}`).join("\n")} /></label></div>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <RippleButton type="submit" loading={saving}>Save</RippleButton>
              <RippleButton variant="secondary" onClick={() => { setEditing(null); setCreating(false); }}>Cancel</RippleButton>
            </div>
          </form>
          {!creating && gallery.length > 0 && (
            <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
              <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Gallery ({gallery.length})</p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {gallery.map((img: any) => (
                  <div key={img.id} style={{ position: "relative", textAlign: "center" }}>
                    <img src={img.image_url} alt="" style={{ width: 80, height: 80, borderRadius: 6, objectFit: "cover", border: img.is_primary ? "2px solid var(--accent)" : "1px solid var(--border)" }} />
                    <div style={{ marginTop: 2 }}>
                      {!img.is_primary && <RippleButton size="small" variant="ghost" onClick={() => setPrimary(editing!.id, img.id)}>Set primary</RippleButton>}
                    </div>
                    <RippleButton size="small" variant="danger" onClick={() => deleteGalleryImage(editing!.id, img.id)} style={{ position: "absolute", top: -6, right: -6, minWidth: 24, height: 24, width: 24, padding: 0, borderRadius: "50%", fontSize: 12, lineHeight: 1 }}>&times;</RippleButton>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Products</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {selectedIds.size > 0 && <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{selectedIds.size} selected</span>}
          {selectedIds.size > 0 && <RippleButton size="small" variant="secondary" onClick={() => setShowBulk(true)}>Bulk Edit</RippleButton>}
          <RippleButton size="small" onClick={downloadTemplate}>Download Import Template</RippleButton>
          <RippleButton size="small" onClick={() => setShowImport(true)}>Import CSV</RippleButton>
          <RippleButton size="small" onClick={() => { setCreating(true); setEditing(empty); }}>+ Add</RippleButton>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th><input type="checkbox" checked={products.length > 0 && selectedIds.size === products.length} onChange={toggleSelectAll} /></th><th>Image</th><th>Name</th><th>Price</th><th>Category</th><th>Stock</th><th></th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                <td>{p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: "cover" }} /> : <span style={{ opacity: 0.3 }}>{'\u200B'}</span>}</td>
                <td>{escapeHtml(p.name)}</td>
                <td>{formatPrice(p.price)}</td>
                <td>{p.category || "—"}</td>
                <td>{p.inStock ? <span style={{ color: "#16a34a" }}>In stock</span> : <span style={{ color: "#dc2626" }}>Out</span>}</td>
                <td style={{ display: "flex", gap: "0.35rem" }}>
                  <RippleButton size="small" variant="ghost" onClick={() => { setCreating(false); setEditing(p); }}>Edit</RippleButton>
                  <RippleButton size="small" variant="danger" onClick={() => deleteProduct(p.id)}>Delete</RippleButton>
                </td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={7}><EmptyState icon="products" title="No products yet" description="Add your first product to start selling." actionLabel="+ Add Product" onAction={() => { setCreating(true); setEditing(empty); }} /></td></tr>}
          </tbody>
        </table>
      </div>

      {showBulk && (
        <div className="panel" style={{ maxWidth: 450, marginTop: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Bulk Edit {selectedIds.size} Product(s)</h3>
          <form onSubmit={handleBulkEdit}>
            <div className="field"><label>New Price (leave blank to keep)<input name="bulkPrice" type="number" step="any" /></label></div>
            <div className="field"><label>New Category (leave blank to keep)<input name="bulkCategory" /></label></div>
            <div className="field"><label>In Stock<select name="bulkInStock"><option value="">Keep current</option><option value="true">Yes</option><option value="false">No</option></select></label></div>
            {bulkMsg && <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem", color: bulkMsg.startsWith("Update") ? "var(--success)" : "var(--danger)" }}>{bulkMsg}</p>}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <RippleButton type="submit" loading={bulkSaving}>Apply</RippleButton>
              <RippleButton variant="secondary" onClick={() => { setShowBulk(false); setBulkMsg(""); }}>Cancel</RippleButton>
            </div>
          </form>
        </div>
      )}

      {showImport && (
        <div className="panel" style={{ maxWidth: 500, marginTop: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Import Products from CSV</h3>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Upload a CSV file with the following columns: <code>name, price, category, inStock, isNonStock, hasWarranty, warrantyDuration, taxable, subcategory</code>.
            Name, price, and category are required.
          </p>
          <div className="field">
            <label>CSV file
              <input type="file" accept=".csv" ref={importFileRef} />
            </label>
          </div>
          {importMsg && <p style={{ padding: "0.5rem 1rem", borderRadius: 8, background: importMsg.startsWith("Error") ? "#fee2e2" : importMsg.startsWith("Success") ? "#d1fae5" : "#fef3c7", color: importMsg.startsWith("Error") ? "#991b1b" : importMsg.startsWith("Success") ? "#065f46" : "#92400e", marginBottom: "0.75rem", fontSize: "0.85rem" }}>{importMsg}</p>}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <RippleButton size="small" onClick={handleImport} loading={importing}>Upload & Import</RippleButton>
            <RippleButton size="small" variant="secondary" onClick={() => { setShowImport(false); setImportMsg(""); }}>Cancel</RippleButton>
          </div>
        </div>
      )}
    </>
  );
}
