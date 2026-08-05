import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import RippleButton from "@/components/RippleButton";
import { toast } from "@/components/Toast";

export default function CategoryPositioningPage() {
  const [categories, setCategories] = useState<{ id: string; label: string; sortOrder?: number }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => {
      const cats = (d.categories || []).map((c: any, i: number) => ({ id: c.id, label: c.label, sortOrder: c.sortOrder ?? i }));
      cats.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
      setCategories(cats);
    }).catch(() => {});
  }, []);

  function handleDragStart(idx: number, e: React.DragEvent) {
    e.dataTransfer.setData("text/plain", String(idx));
    (e.target as HTMLElement).style.opacity = "0.5";
  }
  function handleDragEnd(e: React.DragEvent) { (e.target as HTMLElement).style.opacity = "1"; }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(targetIdx: number, e: React.DragEvent) {
    e.preventDefault();
    const sourceIdx = Number(e.dataTransfer.getData("text/plain"));
    if (sourceIdx === targetIdx) return;
    const updated = [...categories];
    const [moved] = updated.splice(sourceIdx, 1);
    updated.splice(targetIdx, 0, moved);
    setCategories(updated);
  }

  async function save() {
    setSaving(true);
    try {
      await api("/api/admin/categories/reorder", { method: "PUT", body: JSON.stringify({ orderedIds: categories.map((c) => c.id) }) });
      toast("success", "Category order saved.");
    } catch (err: any) { toast("error", "Error: " + err.message); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <h2>Category Positioning</h2>
      <p className="muted" style={{ marginBottom: "1rem" }}>Drag and drop to reorder categories. This affects the storefront navigation and category pages.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", maxWidth: 500 }}>
        {categories.map((cat, idx) => (
          <div
            key={cat.id}
            draggable
            onDragStart={(e) => handleDragStart(idx, e)}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(idx, e)}
            style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0.75rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, cursor: "grab" }}
          >
            <span style={{ color: "var(--muted)", fontSize: "0.85rem", minWidth: 20, textAlign: "right" }}>{idx + 1}</span>
            <span style={{ cursor: "grab", fontSize: "1.1rem", color: "var(--muted)" }}>&#9776;</span>
            <span style={{ fontWeight: 500 }}>{cat.label}</span>
          </div>
        ))}
      </div>
      <RippleButton onClick={save} loading={saving} style={{ marginTop: "1rem" }}>Save order</RippleButton>
    </div>
  );
}
