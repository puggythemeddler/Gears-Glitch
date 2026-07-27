import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface LayoutRow {
  id: number;
  layout_key: string;
  label: string;
  description: string;
  layout_type: "static" | "dynamic";
  config: any;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const EXAMPLE_DYNAMIC_CONFIG = {
  hero: { enabled: true, style: "carousel", badge: "New Arrivals", headline: "Welcome to Our Store", subtitle: "Browse our latest collection", ctaText: "Shop Now", ctaLink: "/" },
  sections: [
    { type: "product-grid", title: "Featured Products", productFilter: "all", columns: 4, limit: 8 },
    { type: "category-grid", title: "Browse Categories", columns: 4, style: "cards" },
    { type: "stats", items: [{ icon: "📦", value: "100+", label: "Products" }, { icon: "⭐", value: "4.8", label: "Rating" }, { icon: "🚚", value: "Free", label: "Delivery" }] },
  ],
  productCard: { style: "default", showRating: true, showSalePrice: true },
  colors: { heroBg: "linear-gradient(135deg, #0f172a, #1e293b)", heroText: "#ffffff", accent: "#2563eb" },
};

export default function AdminLayouts({ inline }: { inline?: boolean }) {
  const [layouts, setLayouts] = useState<LayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ layoutKey: "", label: "", description: "", configText: JSON.stringify(EXAMPLE_DYNAMIC_CONFIG, null, 2) });
  const [editForm, setEditForm] = useState({ label: "", description: "", configText: "" });
  const [msg, setMsg] = useState("");

  function load() {
    setLoading(true);
    api<LayoutRow[]>("/api/admin/layouts")
      .then((d) => { if (d) setLayouts(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function activate(id: number) {
    try {
      await api(`/api/admin/layouts/${id}/activate`, { method: "PUT" });
      setMsg("Layout activated.");
      load();
    } catch (e: any) { setMsg(e.message || "Failed"); }
  }

  async function createLayout() {
    try {
      const config = JSON.parse(form.configText);
      await api("/api/admin/layouts", { method: "POST", body: JSON.stringify({ layoutKey: form.layoutKey, label: form.label, description: form.description, layoutType: "dynamic", config }) });
      setMsg("Layout created.");
      setShowCreate(false);
      setForm({ layoutKey: "", label: "", description: "", configText: JSON.stringify(EXAMPLE_DYNAMIC_CONFIG, null, 2) });
      load();
    } catch (e: any) { setMsg(e.message || "Failed to create layout"); }
  }

  async function saveEdit(id: number) {
    try {
      const config = JSON.parse(editForm.configText);
      await api(`/api/admin/layouts/${id}`, { method: "PUT", body: JSON.stringify({ label: editForm.label, description: editForm.description, config }) });
      setMsg("Layout saved.");
      setEditingId(null);
      load();
    } catch (e: any) { setMsg(e.message || "Failed to save"); }
  }

  async function deleteLayout(id: number) {
    if (!confirm("Delete this custom layout?")) return;
    try {
      await api(`/api/admin/layouts/${id}`, { method: "DELETE" });
      setMsg("Deleted.");
      load();
    } catch (e: any) { setMsg(e.message || "Failed to delete"); }
  }

  function startEdit(row: LayoutRow) {
    setEditingId(row.id);
    setEditForm({ label: row.label, description: row.description, configText: JSON.stringify(row.config || {}, null, 2) });
  }

  return (
    <div>
      {!inline && <>
        <h2 style={{ marginTop: 0 }}>Storefront Layouts</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1rem" }}>
          Manage storefront layouts. Static layouts are built-in code modules. Dynamic layouts are defined by JSON config and rendered by the generic engine.
        </p>
      </>}

      {msg && <div style={{ padding: "0.6rem 1rem", borderRadius: 6, background: "var(--primary-subtle)", color: "var(--primary)", marginBottom: "1rem", fontSize: "0.85rem" }}>{msg}<button onClick={() => setMsg("")} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", color: "var(--primary)", fontWeight: 700 }}>×</button></div>}

      <div style={{ marginBottom: "1rem" }}>
        <button onClick={() => setShowCreate(!showCreate)} style={{ padding: "0.5rem 1rem", borderRadius: 6, border: "1px solid var(--primary)", background: "var(--primary)", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
          {showCreate ? "Cancel" : "+ New Dynamic Layout"}
        </button>
      </div>

      {showCreate && (        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "1rem", marginBottom: "1.5rem", background: "var(--surface)" }}>
          <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Create Dynamic Layout</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div className="field"><label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Layout Key (unique)</label><input value={form.layoutKey} onChange={(e) => setForm({ ...form, layoutKey: e.target.value })} placeholder="e.g. my-custom" style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: 4, border: "1px solid var(--border)" }} /></div>
            <div className="field"><label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Label</label><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. My Custom Layout" style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: 4, border: "1px solid var(--border)" }} /></div>
          </div>
          <div className="field" style={{ marginBottom: "0.75rem" }}><label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Description</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: 4, border: "1px solid var(--border)" }} /></div>
          <div className="field" style={{ marginBottom: "0.75rem" }}><label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Layout Config (JSON)</label>
            <textarea value={form.configText} onChange={(e) => setForm({ ...form, configText: e.target.value })} rows={16} style={{ width: "100%", fontFamily: "monospace", fontSize: "0.8rem", padding: "0.5rem", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg)" }} />
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
            <strong>Config structure:</strong> <code>{`{ hero: {...}, sections: [...], productCard: {...}, colors: {...} }`}</code><br />
            Section types: <code>product-grid</code>, <code>category-grid</code>, <code>banner</code>, <code>stats</code>, <code>text</code>, <code>spacer</code>
          </div>
          <button onClick={createLayout} style={{ padding: "0.5rem 1.2rem", borderRadius: 6, border: "none", background: "var(--success)", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>Create Layout</button>
        </div>
      )}

      {!inline && (loading ? <p>Loading...</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {layouts.map((row) => (
            <div key={row.id} style={{ border: "1px solid " + (row.is_active ? "var(--primary)" : "var(--border)"), borderRadius: 8, padding: "1rem", background: row.is_active ? "var(--primary-subtle)" : "var(--surface)" }}>
              {editingId === row.id ? (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <div className="field"><label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Label</label><input value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: 4, border: "1px solid var(--border)" }} /></div>
                    <div className="field"><label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Description</label><input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: 4, border: "1px solid var(--border)" }} /></div>
                  </div>
                  <div className="field" style={{ marginBottom: "0.5rem" }}><label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Config (JSON)</label>
                    <textarea value={editForm.configText} onChange={(e) => setEditForm({ ...editForm, configText: e.target.value })} rows={14} style={{ width: "100%", fontFamily: "monospace", fontSize: "0.8rem", padding: "0.5rem", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg)" }} />
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button onClick={() => saveEdit(row.id)} style={{ padding: "0.4rem 1rem", borderRadius: 4, border: "none", background: "var(--success)", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem" }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ padding: "0.4rem 1rem", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", fontSize: "0.8rem" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{row.label}</span>
                    <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: 4, background: row.layout_type === "static" ? "var(--info-light)" : "var(--warning-light)", color: row.layout_type === "static" ? "var(--info)" : "var(--warning)" }}>{row.layout_type}</span>
                    <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--text-tertiary)" }}>{row.layout_key}</span>
                    {row.is_active ? <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: 4, background: "var(--success)", color: "#fff", fontWeight: 600 }}>Active</span> : null}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: 4 }}>{row.description}</div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                    {!row.is_active && <button onClick={() => activate(row.id)} style={{ padding: "0.3rem 0.75rem", borderRadius: 4, border: "1px solid var(--primary)", background: "var(--primary)", color: "#fff", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}>Activate</button>}
                    {row.layout_type === "dynamic" && <button onClick={() => startEdit(row)} style={{ padding: "0.3rem 0.75rem", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", fontSize: "0.78rem" }}>Edit</button>}
                    {row.layout_type === "dynamic" && <button onClick={() => deleteLayout(row.id)} style={{ padding: "0.3rem 0.75rem", borderRadius: 4, border: "1px solid var(--danger)", background: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.78rem" }}>Delete</button>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
