import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import { getProducts } from "@/components/ProductCard";
import { useLayout } from "@/layouts";
import { HeroSection, DynamicSectionView, DynamicLayoutConfig } from "@/layouts/dynamic-engine";
import RippleButton from "@/components/RippleButton";
import Icon from "@/components/icons";
import { Spinner, ErrorMsg } from "./shared";

type Section = NonNullable<DynamicLayoutConfig["sections"]>[number];

interface LayoutRow {
  id: number;
  layout_key: string;
  label: string;
  description: string;
  layout_type: "static" | "dynamic";
  config: any;
  is_active: number;
}

let idCounter = 0;
function uid(): string {
  idCounter += 1;
  return "sec-" + Date.now().toString(36) + "-" + idCounter;
}

const DEFAULT_CONFIG: DynamicLayoutConfig = {
  hero: {
    enabled: true,
    style: "carousel",
    headline: "Welcome to our store",
    subtitle: "Discover amazing products at great prices, delivered anywhere in Kenya.",
    ctaText: "Shop Now",
    ctaLink: "/pc",
    badge: "",
    buttons: [],
  },
  sections: [
    { id: uid(), type: "text", title: "Why shop with us", content: "Fast delivery across Kenya, genuine products and a support team that has your back.", align: "center" },
    { id: uid(), type: "product-grid", title: "Featured Products", productFilter: "all", columns: 4, limit: 8 },
  ],
  productCard: { style: "default", showRating: true, showSalePrice: true },
  colors: {},
};

const SECTION_TEMPLATES: { type: string; label: string; icon: string; defaults: any }[] = [
  { type: "text", label: "Text Block", icon: "T", defaults: { title: "New heading", content: "Add a short paragraph describing your store, a promotion, or anything else your customers should know.", align: "center" } },
  { type: "button", label: "Button", icon: "B", defaults: { label: "Shop Now", link: "/pc", variant: "primary", align: "center", size: "md" } },
  { type: "image", label: "Image", icon: "I", defaults: { imageUrl: "", alt: "", caption: "", rounded: true } },
  { type: "product-grid", label: "Products", icon: "P", defaults: { title: "Featured Products", productFilter: "all", columns: 4, limit: 8 } },
  { type: "category-grid", label: "Categories", icon: "C", defaults: { title: "Shop by Category", columns: 4, style: "cards" } },
  { type: "banner", label: "Banner", icon: "B", defaults: { text: "Big Sale — up to 30% off", bgColor: "#f97316", textColor: "#ffffff", link: "/pc", buttonLabel: "Shop Now", buttonLink: "/pc" } },
  { type: "stats", label: "Stats", icon: "S", defaults: { items: [{ value: "1000+", label: "Products" }, { value: "500+", label: "Customers" }, { value: "24/7", label: "Support" }] } },
  { type: "features", label: "Features", icon: "F", defaults: { title: "Why shop with us", columns: 3, items: [{ title: "Genuine products", text: "Authentic, sourced from official distributors." }, { title: "Fast delivery", text: "Nationwide delivery, Nairobi within 24h." }, { title: "Warranty", text: "Covered on every item we sell." }] } },
  { type: "spacer", label: "Spacer", icon: "S", defaults: { height: 48 } },
];

const SECTION_LABELS: Record<string, string> = {
  "product-grid": "Products", "category-grid": "Categories", banner: "Banner", stats: "Stats",
  text: "Text", button: "Button", image: "Image", features: "Features", spacer: "Spacer",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: "0.75rem" }}>
      <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.6rem", fontSize: "0.85rem", borderRadius: 6,
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
};

function Text({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input style={inputStyle} value={value || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

function Num({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return <input type="number" style={inputStyle} value={value ?? ""} min={min} max={max} onChange={(e) => onChange(parseInt(e.target.value || "0", 10))} />;
}

function Color({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="color" style={{ width: "100%", height: 36, borderRadius: 6, border: "1px solid var(--border)", background: "none", cursor: "pointer", padding: 2 }} value={value || "#c2410c"} onChange={(e) => onChange(e.target.value)} />;
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select style={inputStyle} value={value || ""} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export default function StorefrontBuilder() {
  const { refreshLayouts, refreshConfig, layout: activeLayout } = useLayout();
  const [layouts, setLayouts] = useState<LayoutRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<DynamicLayoutConfig>(DEFAULT_CONFIG);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function loadLayouts() {
    try {
      const rows = await api<LayoutRow[]>("/api/layouts");
      setLayouts(rows || []);
      return rows || [];
    } catch { return []; }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadLayouts();
      try { setProducts(await getProducts()); } catch {}
      try { const d = await api<any>("/api/categories"); setCategories(d.categories || []); } catch {}
      setLoading(false);
    })();
  }, []);

  const dynamicLayouts = useMemo(() => layouts.filter((l) => l.layout_type === "dynamic"), [layouts]);

  async function loadSelected(id: number) {
    setSelectedId(id);
    setSelectedSection(null);
    setSaving(true);
    try {
      const row = await api<LayoutRow>(`/api/admin/layouts/${id}`);
      setLabel(row.label);
      setDescription(row.description || "");
      setConfig(row.config && typeof row.config === "object" ? row.config : DEFAULT_CONFIG);
      setDirty(false);
    } catch (e: any) { setError(e.message || "Failed to load layout."); }
    finally { setSaving(false); }
  }

  function selectLayout(id: number) {
    if (id === selectedId) return;
    if (dirty) {
      if (!window.confirm("You have unsaved changes. Discard them?")) return;
    }
    loadSelected(id);
  }

  function updateConfig(patch: Partial<DynamicLayoutConfig>) {
    setConfig((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }

  function updateSection(idx: number, patch: Partial<Section>) {
    setConfig((prev) => {
      const sections = [...(prev.sections || [])];
      sections[idx] = { ...sections[idx], ...patch } as Section;
      return { ...prev, sections };
    });
    setDirty(true);
  }

  function addSection(template: any) {
    const section = { type: template.type, id: uid(), ...template.defaults };
    setConfig((prev) => ({ ...prev, sections: [...(prev.sections || []), section] }));
    setSelectedSection(sections.length);
    setDirty(true);
  }

  function removeSection(idx: number) {
    setConfig((prev) => ({ ...prev, sections: (prev.sections || []).filter((_, i) => i !== idx) }));
    setSelectedSection(null);
    setDirty(true);
  }

  function moveSection(idx: number, dir: -1 | 1) {
    setConfig((prev) => {
      const sections = [...(prev.sections || [])];
      const target = idx + dir;
      if (target < 0 || target >= sections.length) return prev;
      [sections[idx], sections[target]] = [sections[target], sections[idx]];
      return { ...prev, sections };
    });
    setSelectedSection((prev) => (prev === null ? null : prev + dir));
    setDirty(true);
  }

  function onDragStart(idx: number) { setDragIdx(idx); }
  function onDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDropIdx(idx); }
  function onDragEnd() { setDragIdx(null); setDropIdx(null); }
  function onDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDropIdx(null); return; }
    setConfig((prev) => {
      const sections = [...(prev.sections || [])];
      const [moved] = sections.splice(dragIdx, 1);
      sections.splice(idx, 0, moved);
      return { ...prev, sections };
    });
    setDragIdx(null); setDropIdx(null);
    setSelectedSection(idx);
    setDirty(true);
  }

  function updateHero(patch: Partial<NonNullable<DynamicLayoutConfig["hero"]>>) {
    setConfig((prev) => ({ ...prev, hero: { ...(prev.hero || {}), ...patch } }));
    setDirty(true);
  }

  function updateColors(patch: Partial<NonNullable<DynamicLayoutConfig["colors"]>>) {
    setConfig((prev) => ({ ...prev, colors: { ...(prev.colors || {}), ...patch } }));
    setDirty(true);
  }

  function updateCard(patch: Partial<NonNullable<DynamicLayoutConfig["productCard"]>>) {
    setConfig((prev) => ({ ...prev, productCard: { ...(prev.productCard || {}), ...patch } }));
    setDirty(true);
  }

  async function createLayout() {
    const baseLabel = window.prompt("Name your new layout:", "My Custom Layout");
    if (!baseLabel) return;
    const slug = baseLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
    const key = "custom-" + (slug || "layout");
    setSaving(true); setMsg("");
    try {
      const row = await api<LayoutRow>("/api/admin/layouts", {
        method: "POST",
        body: JSON.stringify({ layoutKey: key, label: baseLabel, description: "Custom layout built with the drag-and-drop builder.", layoutType: "dynamic", config: DEFAULT_CONFIG }),
      });
      await loadLayouts();
      await loadSelected(row.id);
      setMsg("Layout created. Add sections and save to publish.");
    } catch (e: any) { setMsg("Failed: " + e.message); }
    finally { setSaving(false); }
  }

  async function saveLayout() {
    if (!selectedId) return;
    setSaving(true); setMsg("");
    try {
      await api(`/api/admin/layouts/${selectedId}`, { method: "PUT", body: JSON.stringify({ label, description, config }) });
      setDirty(false);
      setMsg("Layout saved.");
      refreshLayouts();
    } catch (e: any) { setMsg("Failed: " + e.message); }
    finally { setSaving(false); }
  }

  async function activateLayout() {
    if (!selectedId) return;
    setSaving(true); setMsg("");
    try {
      await api(`/api/admin/layouts/${selectedId}/activate`, { method: "PUT" });
      await loadLayouts();
      refreshLayouts();
      refreshConfig();
      setMsg("Layout is now live on your storefront.");
    } catch (e: any) { setMsg("Failed: " + e.message); }
    finally { setSaving(false); }
  }

  async function deleteLayout() {
    if (!selectedId) return;
    if (!window.confirm("Delete this layout? This cannot be undone.")) return;
    setSaving(true); setMsg("");
    try {
      await api(`/api/admin/layouts/${selectedId}`, { method: "DELETE" });
      await loadLayouts();
      refreshLayouts();
      setSelectedId(null);
      setMsg("Layout deleted.");
    } catch (e: any) { setMsg("Failed: " + e.message); }
    finally { setSaving(false); }
  }

  function addHeroButton() {
    const hero = config.hero || {};
    updateHero({ buttons: [...(hero.buttons || []), { label: "Secondary", link: "/", variant: "secondary" }] });
  }

  if (loading) return <Spinner />;
  if (error && !layouts.length) return <ErrorMsg msg={error} />;

  const hero = config.hero || {};
  const sections = config.sections || [];
  const selectedSectionData: Section | null = selectedSection !== null ? sections[selectedSection] : null;

  const renderSectionPanel = (s: Section) => {
    switch (s.type) {
      case "text":
        return (<>
          <Field label="Heading"><Text value={s.title || ""} onChange={(v) => updateSection(selectedSection as number, { title: v })} /></Field>
          <Field label="Text"><textarea style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} value={s.content || ""} onChange={(e) => updateSection(selectedSection as number, { content: e.target.value })} /></Field>
          <Field label="Alignment"><Select value={s.align || "center"} onChange={(v) => updateSection(selectedSection as number, { align: v as any })} options={[{ value: "center", label: "Center" }, { value: "left", label: "Left" }]} /></Field>
        </>);
      case "button":
        return (<>
          <Field label="Label"><Text value={s.label || ""} onChange={(v) => updateSection(selectedSection as number, { label: v })} /></Field>
          <Field label="Link"><Text value={s.link || ""} onChange={(v) => updateSection(selectedSection as number, { link: v })} placeholder="/pc" /></Field>
          <Field label="Style"><Select value={s.variant || "primary"} onChange={(v) => updateSection(selectedSection as number, { variant: v as any })} options={[{ value: "primary", label: "Solid" }, { value: "secondary", label: "Neutral" }, { value: "outline", label: "Outline" }]} /></Field>
          <Field label="Size"><Select value={s.size || "md"} onChange={(v) => updateSection(selectedSection as number, { size: v as any })} options={[{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }]} /></Field>
          <Field label="Alignment"><Select value={s.align || "center"} onChange={(v) => updateSection(selectedSection as number, { align: v as any })} options={[{ value: "center", label: "Center" }, { value: "left", label: "Left" }]} /></Field>
        </>);
      case "image":
        return (<>
          <Field label="Image URL"><Text value={s.imageUrl || ""} onChange={(v) => updateSection(selectedSection as number, { imageUrl: v })} placeholder="https://...jpg" /></Field>
          <Field label="Alt text"><Text value={s.alt || ""} onChange={(v) => updateSection(selectedSection as number, { alt: v })} /></Field>
          <Field label="Caption"><Text value={s.caption || ""} onChange={(v) => updateSection(selectedSection as number, { caption: v })} /></Field>
          <Field label="Link (optional)"><Text value={s.link || ""} onChange={(v) => updateSection(selectedSection as number, { link: v })} /></Field>
          <Field label="Max width (px, optional)"><Num value={s.maxWidth || 0} onChange={(v) => updateSection(selectedSection as number, { maxWidth: v || undefined })} /></Field>
          <Check label="Rounded corners" checked={s.rounded !== false} onChange={(v) => updateSection(selectedSection as number, { rounded: v })} />
        </>);
      case "product-grid":
        return (<>
          <Field label="Heading"><Text value={s.title || ""} onChange={(v) => updateSection(selectedSection as number, { title: v })} /></Field>
          <Field label="Products to show"><Select value={s.productFilter || "all"} onChange={(v) => updateSection(selectedSection as number, { productFilter: v as any })} options={[{ value: "all", label: "All products" }, { value: "featured", label: "Featured (with image)" }, { value: "sale", label: "On sale" }, { value: "newest", label: "Newest first" }]} /></Field>
          <Field label="Columns"><Num value={s.columns || 4} min={1} max={6} onChange={(v) => updateSection(selectedSection as number, { columns: Math.min(6, Math.max(1, v)) })} /></Field>
          <Field label="Limit"><Num value={s.limit || 0} min={1} max={48} onChange={(v) => updateSection(selectedSection as number, { limit: v || undefined })} /></Field>
        </>);
      case "category-grid":
        return (<>
          <Field label="Heading"><Text value={s.title || ""} onChange={(v) => updateSection(selectedSection as number, { title: v })} /></Field>
          <Field label="Style"><Select value={s.style || "cards"} onChange={(v) => updateSection(selectedSection as number, { style: v as any })} options={[{ value: "cards", label: "Cards" }, { value: "icons", label: "Compact" }]} /></Field>
          <Field label="Columns"><Num value={s.columns || 4} min={1} max={6} onChange={(v) => updateSection(selectedSection as number, { columns: Math.min(6, Math.max(1, v)) })} /></Field>
        </>);
      case "banner":
        return (<>
          <Field label="Text"><Text value={s.text || ""} onChange={(v) => updateSection(selectedSection as number, { text: v })} /></Field>
          <Field label="Image URL (optional)"><Text value={s.imageUrl || ""} onChange={(v) => updateSection(selectedSection as number, { imageUrl: v })} /></Field>
          <Field label="Link"><Text value={s.link || ""} onChange={(v) => updateSection(selectedSection as number, { link: v })} /></Field>
          <Field label="Button label"><Text value={s.buttonLabel || ""} onChange={(v) => updateSection(selectedSection as number, { buttonLabel: v })} /></Field>
          <Field label="Button link"><Text value={s.buttonLink || ""} onChange={(v) => updateSection(selectedSection as number, { buttonLink: v })} /></Field>
          <Field label="Background color"><Color value={s.bgColor || ""} onChange={(v) => updateSection(selectedSection as number, { bgColor: v })} /></Field>
          <Field label="Text color"><Color value={s.textColor || ""} onChange={(v) => updateSection(selectedSection as number, { textColor: v })} /></Field>
        </>);
      case "stats":
        return (
          <div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0 0 0.5rem" }}>Stat items</p>
            {(s.items || []).map((item, j) => (
              <div key={j} style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem" }}>
                <Text value={item.value} onChange={(v) => { const items = [...(s.items || [])]; items[j] = { ...items[j], value: v }; updateSection(selectedSection as number, { items }); }} />
                <Text value={item.label} onChange={(v) => { const items = [...(s.items || [])]; items[j] = { ...items[j], label: v }; updateSection(selectedSection as number, { items }); }} />
                <RippleButton size="small" variant="danger" aria-label="Remove stat" onClick={() => updateSection(selectedSection as number, { items: (s.items || []).filter((_, k) => k !== j) })}>✕</RippleButton>
              </div>
            ))}
            <RippleButton size="small" onClick={() => updateSection(selectedSection as number, { items: [...(s.items || []), { value: "0", label: "New stat" }] })}>+ Add stat</RippleButton>
          </div>
        );
      case "features":
        return (
          <div>
            <Field label="Heading"><Text value={s.title || ""} onChange={(v) => updateSection(selectedSection as number, { title: v })} /></Field>
            <Field label="Columns"><Num value={s.columns || 3} min={1} max={6} onChange={(v) => updateSection(selectedSection as number, { columns: Math.min(6, Math.max(1, v)) })} /></Field>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0 0 0.5rem" }}>Feature items</p>
            {(s.items || []).map((item, j) => (
              <div key={j} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem", marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
                  <Field label="Icon"><Text value={item.icon || ""} onChange={(v) => { const items = [...(s.items || [])]; items[j] = { ...items[j], icon: v }; updateSection(selectedSection as number, { items }); }} /></Field>
                  <RippleButton size="small" variant="danger" aria-label="Remove feature" onClick={() => updateSection(selectedSection as number, { items: (s.items || []).filter((_, k) => k !== j) })}>✕</RippleButton>
                </div>
                <Field label="Title"><Text value={item.title || ""} onChange={(v) => { const items = [...(s.items || [])]; items[j] = { ...items[j], title: v }; updateSection(selectedSection as number, { items }); }} /></Field>
                <Field label="Text"><Text value={item.text || ""} onChange={(v) => { const items = [...(s.items || [])]; items[j] = { ...items[j], text: v }; updateSection(selectedSection as number, { items }); }} /></Field>
              </div>
            ))}
            <RippleButton size="small" onClick={() => updateSection(selectedSection as number, { items: [...(s.items || []), { title: "New feature", text: "Describe this feature." }] })}>+ Add feature</RippleButton>
          </div>
        );
      case "spacer":
        return (<>
          <Field label="Height (px)"><Num value={s.height || 40} min={0} max={200} onChange={(v) => updateSection(selectedSection as number, { height: v })} /></Field>
        </>);
      default:
        return null;
    }
  };

  const isActive = layouts.find((l) => l.id === selectedId)?.is_active === 1 || activeLayout === layouts.find((l) => l.id === selectedId)?.layout_key;

  return (
    <>
      <style>{`
        .sb-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .sb-toolbar-left { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
        .sb-grid { display: grid; grid-template-columns: 210px 1fr 300px; gap: 1rem; align-items: start; }
        @media (max-width: 1200px) { .sb-grid { grid-template-columns: 1fr; } }
        .sb-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }
        .sb-palette-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.6rem; border: 1px solid var(--border); border-radius: 8px; cursor: grab; margin-bottom: 0.5rem; font-size: 0.85rem; background: var(--bg); transition: border-color 0.15s; }
        .sb-palette-item:hover { border-color: var(--primary); }
        .sb-palette-icon { width: 26px; height: 26px; border-radius: 6px; background: var(--primary-subtle); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0; }
        .sb-section { position: relative; border: 1px solid transparent; }
        .sb-section.selected { border: 2px solid var(--primary); border-radius: 10px; }
        .sb-section.selected .sb-section-bar { display: flex; }
        .sb-section-bar { display: none; position: absolute; top: 6px; left: 6px; z-index: 20; align-items: center; gap: 0.3rem; background: var(--primary); color: #fff; border-radius: 6px; padding: 0.15rem 0.4rem; font-size: 0.7rem; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
        .sb-section-bar button { background: none; border: none; color: #fff; cursor: pointer; font-size: 0.75rem; padding: 0 0.2rem; line-height: 1; }
        .sb-section-bar .sb-grip { cursor: grab; }
        .sb-canvas { min-height: 300px; border: 1px dashed var(--border); border-radius: 12px; overflow: hidden; background: var(--bg); }
        .sb-empty { padding: 3rem 2rem; text-align: center; color: var(--text-tertiary); }
        .sb-msg { padding: 0.5rem 0.75rem; border-radius: 8px; margin-bottom: 0.75rem; font-size: 0.82rem; }
        .sb-msg-ok { background: #d1fae5; color: #065f46; }
        .sb-msg-err { background: #fee2e2; color: #991b1b; }
      `}</style>

      <div className="sb-toolbar">
        <div className="sb-toolbar-left">
          <h1 style={{ margin: 0 }}>Layout Builder</h1>
          <select value={selectedId ?? ""} onChange={(e) => selectLayout(Number(e.target.value))} style={{ ...inputStyle, width: 220 }}>
            <option value="" disabled>Select a custom layout…</option>
            {dynamicLayouts.map((l) => <option key={l.id} value={l.id}>{l.label}{l.is_active === 1 ? " (live)" : ""}</option>)}
          </select>
          <RippleButton onClick={createLayout} loading={saving}>+ New Layout</RippleButton>
        </div>
        {selectedId && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <RippleButton onClick={saveLayout} loading={saving}>{dirty ? "Save Changes" : "Saved"}</RippleButton>
            <RippleButton onClick={activateLayout} loading={saving} variant={isActive ? "secondary" : "primary"}>{isActive ? "Live" : "Publish to Storefront"}</RippleButton>
            <RippleButton onClick={deleteLayout} loading={saving} variant="danger">Delete</RippleButton>
            <a href="/" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">View Site ↗</a>
          </div>
        )}
      </div>

      {msg && <div className={`sb-msg ${msg.startsWith("Failed") ? "sb-msg-err" : "sb-msg-ok"}`}>{msg}</div>}

      {!selectedId ? (
        <div className="sb-panel">
          <h3 style={{ marginTop: 0 }}>Design your own storefront — no code needed</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", maxWidth: 720, lineHeight: 1.6 }}>
            Click <strong>+ New Layout</strong> to start. Drag and drop sections (products, buttons, images, stats, features…),
            reorder them, edit their text and colors, then <strong>Publish</strong> to make it live. Built-in layouts (Original, Amazon, Jumia)
            are shown under <strong>Storefront</strong> and can't be edited here.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem", marginTop: "1rem" }}>
            {dynamicLayouts.map((l) => (
              <div key={l.id} className="panel" role="button" tabIndex={0} style={{ cursor: "pointer", margin: 0, border: l.is_active === 1 ? "2px solid var(--primary)" : "1px solid var(--border)" }} onClick={() => loadSelected(l.id)} onKeyDown={(e) => { if (e.key === "Enter") loadSelected(l.id); }}>
                <div style={{ height: 80, borderRadius: 8, background: "var(--bg)", marginBottom: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}><Icon name="layout" size={32} /></div>
                <strong style={{ fontSize: "0.9rem" }}>{l.label}</strong>
                {l.is_active === 1 && <span className="badge badge-success" style={{ marginLeft: "0.4rem" }}>Live</span>}
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>{l.description}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="sb-grid">
          {/* Palette */}
          <div className="sb-panel">
            <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Add a section</h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: "0 0 0.75rem" }}>Click to add, then drag to reorder on the canvas.</p>
            {SECTION_TEMPLATES.map((t) => (
              <div key={t.type} className="sb-palette-item" onClick={() => addSection(t)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") addSection(t); }}>
                <span className="sb-palette-icon">{t.icon}</span>
                {t.label}
              </div>
            ))}
          </div>

          {/* Canvas */}
          <div>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
              <RippleButton size="small" variant={showPreview ? "secondary" : "primary"} onClick={() => setShowPreview(false)}>Edit</RippleButton>
              <RippleButton size="small" variant={showPreview ? "primary" : "secondary"} onClick={() => { setShowPreview(true); setSelectedSection(null); }}>Preview</RippleButton>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{showPreview ? "This is how your storefront looks to customers." : "Click a section's bar to edit it."}</span>
            </div>
            {showPreview ? (
              <div className="sb-canvas" style={{ overflowY: "auto", maxHeight: "70vh" }}>
                <HeroSection hero={hero} colors={config.colors} products={products} categories={categories} />
                {sections.map((s, i) => <DynamicSectionView key={(s as any).id || i} section={s} products={products} categories={categories} colors={config.colors} cardConfig={config.productCard} />)}
              </div>
            ) : (
              <div className="sb-canvas" style={{ overflowY: "auto", maxHeight: "70vh" }}>
                <div
                  className={`sb-section${selectedSection === null ? " selected" : ""}`}
                  onClick={() => setSelectedSection(null)}
                >
                  <div className="sb-section-bar">
                    <span className="sb-grip">≡</span>
                    <span>Hero</span>
                  </div>
                  <HeroSection hero={hero} colors={config.colors} products={products} categories={categories} />
                </div>
                {sections.length === 0 && (
                  <div className="sb-empty">No sections yet. Add one from the left.</div>
                )}
                {sections.map((s, i) => (
                  <div
                    key={(s as any).id || i}
                    className={`sb-section${selectedSection === i ? " selected" : ""}`}
                    onClick={() => setSelectedSection(i)}
                  >
                    <div className="sb-section-bar">
                      <span className="sb-grip" draggable onDragStart={() => onDragStart(i)} onDragOver={(e) => onDragOver(e, i)} onDragEnd={onDragEnd} onDrop={() => onDrop(i)} title="Drag to reorder">≡</span>
                      <span>{SECTION_LABELS[s.type] || s.type}</span>
                      <button type="button" aria-label="Move up" onClick={(e) => { e.stopPropagation(); moveSection(i, -1); }}>↑</button>
                      <button type="button" aria-label="Move down" onClick={(e) => { e.stopPropagation(); moveSection(i, 1); }}>↓</button>
                      <button type="button" aria-label="Remove section" onClick={(e) => { e.stopPropagation(); removeSection(i); }}>✕</button>
                    </div>
                    <DynamicSectionView section={s} products={products} categories={categories} colors={config.colors} cardConfig={config.productCard} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Properties */}
          <div className="sb-panel">
            <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>{selectedSectionData ? `Edit ${SECTION_LABELS[selectedSectionData.type] || "section"}` : "Layout settings"}</h3>

            <Field label="Layout name"><Text value={label} onChange={setLabel} /></Field>

            {selectedSectionData ? (
              <div>
                {renderSectionPanel(selectedSectionData)}
                <RippleButton size="small" variant="secondary" onClick={() => setSelectedSection(null)}>← Back to layout settings</RippleButton>
              </div>
            ) : (
              <div>
                <h4 style={{ margin: "1rem 0 0.5rem", fontSize: "0.85rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>Hero section</h4>
                <Check label="Show hero" checked={hero.enabled !== false} onChange={(v) => updateHero({ enabled: v })} />
                <Field label="Style"><Select value={hero.style || "carousel"} onChange={(v) => updateHero({ style: v as any })} options={[{ value: "carousel", label: "Carousel" }, { value: "split", label: "Split" }, { value: "minimal", label: "Minimal" }, { value: "none", label: "No hero" }]} /></Field>
                {hero.style !== "none" && (<>
                  <Field label="Badge text"><Text value={hero.badge || ""} onChange={(v) => updateHero({ badge: v })} placeholder="Summer sale — up to 30% off" /></Field>
                  <Field label="Headline"><Text value={hero.headline || ""} onChange={(v) => updateHero({ headline: v })} /></Field>
                  <Field label="Subtitle"><Text value={hero.subtitle || ""} onChange={(v) => updateHero({ subtitle: v })} /></Field>
                  <Field label="Main button label"><Text value={hero.ctaText || ""} onChange={(v) => updateHero({ ctaText: v })} /></Field>
                  <Field label="Main button link"><Text value={hero.ctaLink || ""} onChange={(v) => updateHero({ ctaLink: v })} /></Field>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Extra buttons</span>
                    <RippleButton size="small" onClick={addHeroButton}>+ Add</RippleButton>
                  </div>
                  {(hero.buttons || []).map((b, j) => (
                    <div key={j} style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem", alignItems: "center" }}>
                      <Text value={b.label} onChange={(v) => { const buttons = [...(hero.buttons || [])]; buttons[j] = { ...buttons[j], label: v }; updateHero({ buttons }); }} />
                      <Text value={b.link} onChange={(v) => { const buttons = [...(hero.buttons || [])]; buttons[j] = { ...buttons[j], link: v }; updateHero({ buttons }); }} />
                      <RippleButton size="small" variant="danger" aria-label="Remove button" onClick={() => updateHero({ buttons: (hero.buttons || []).filter((_, k) => k !== j) })}>✕</RippleButton>
                    </div>
                  ))}
                  <Field label="Background image (optional)"><Text value={hero.backgroundImage || ""} onChange={(v) => updateHero({ backgroundImage: v })} placeholder="https://...jpg" /></Field>
                </>)}

                <h4 style={{ margin: "1rem 0 0.5rem", fontSize: "0.85rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>Colors</h4>
                <Field label="Hero background"><Color value={config.colors?.heroBg || ""} onChange={(v) => updateColors({ heroBg: v })} /></Field>
                <Field label="Hero text"><Color value={config.colors?.heroText || ""} onChange={(v) => updateColors({ heroText: v })} /></Field>
                <Field label="Accent"><Color value={config.colors?.accent || ""} onChange={(v) => updateColors({ accent: v })} /></Field>
                <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", margin: "0.5rem 0 0" }}>Tip: to match the whole site to your brand (header, buttons, footer), use <strong>Storefront → My Brand Colors</strong>.</p>

                <h4 style={{ margin: "1rem 0 0.5rem", fontSize: "0.85rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>Product cards</h4>
                <Field label="Style"><Select value={config.productCard?.style || "default"} onChange={(v) => updateCard({ style: v as any })} options={[{ value: "default", label: "Default" }, { value: "compact", label: "Compact" }, { value: "detailed", label: "Detailed" }]} /></Field>
                <Check label="Show ratings" checked={config.productCard?.showRating !== false} onChange={(v) => updateCard({ showRating: v })} />
                <Check label="Show sale price" checked={config.productCard?.showSalePrice !== false} onChange={(v) => updateCard({ showSalePrice: v })} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
