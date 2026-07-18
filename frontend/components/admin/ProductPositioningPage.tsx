import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import RippleButton from "@/components/RippleButton";
import { formatPrice, escapeHtml, useFetch, Spinner, ErrorMsg } from "./shared";

export default function ProductPositioningPage() {
  const { data: pData, loading, error, refetch } = useFetch(() => api<{ products: Product[] }>("/api/products"), []);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (pData?.products) setProducts(pData.products);
  }, [pData]);

  function onDragStart(idx: number) { setDragIdx(idx); }
  function onDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDropIdx(idx); }
  function onDragEnd() { setDragIdx(null); setDropIdx(null); }
  function onDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDropIdx(null); return; }
    const next = [...products];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setProducts(next);
    setDragIdx(null);
    setDropIdx(null);
  }

  async function saveOrder() {
    setSaving(true); setMsg("");
    try {
      await api("/api/admin/products/reorder", { method: "PUT", body: JSON.stringify({ orderedIds: products.map((p) => p.id) }) });
      setMsg("Order saved!");
    } catch (e: any) { setMsg("Failed: " + e.message); }
    finally { setSaving(false); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Product Positioning</h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Drag products to set their display order on the storefront. This controls the order products appear in category pages.</p>
        </div>
        <RippleButton onClick={saveOrder} loading={saving}>Save Order</RippleButton>
      </div>
      {msg && <div className="panel" style={{ marginBottom: "1rem", padding: "0.75rem 1rem", borderRadius: 8, background: msg.startsWith("Failed") ? "#fee2e2" : "#d1fae5", color: msg.startsWith("Failed") ? "#991b1b" : "#065f46", fontSize: "0.85rem" }}>{msg}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
        {products.map((p, idx) => (
          <div
            key={p.id}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragOver={(e) => onDragOver(e, idx)}
            onDragEnd={onDragEnd}
            onDrop={() => onDrop(idx)}
            style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.75rem", borderRadius: 8,
              background: "var(--surface)", border: "1px solid var(--border)",
              cursor: "grab", opacity: dragIdx === idx ? 0.4 : 1,
              outline: dropIdx === idx ? "2px solid var(--accent)" : "none",
              outlineOffset: 2, transition: "opacity 0.15s",
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", minWidth: 20 }}>{idx + 1}</span>
            {p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} /> : <div style={{ width: 48, height: 48, borderRadius: 6, background: "var(--border)", flexShrink: 0 }} />}
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{escapeHtml(p.name)}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{p.category}{p.salePrice ? " • Sale" : ""}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
