import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import { getProducts } from "@/components/ProductCard";
import { useLayout } from "@/layouts";
import { HeroSection, DynamicSectionView } from "@/layouts/dynamic-engine";
import type { DynamicLayoutConfig } from "@/layouts/dynamic-engine";
import RippleButton from "@/components/RippleButton";
import Icon from "@/components/icons";
import { Spinner, ErrorMsg } from "./shared";
import MotionPanel from "./MotionPanel";
import { createHistory, pushHistory, undoHistory, redoHistory, canUndo, canRedo } from "@/lib/history";
import type { HistoryState } from "@/lib/history";
import { isSafeHref } from "@/lib/links";

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

interface PaletteTemplate {
  type: string;
  label: string;
  group: string;
  keywords: string;
  icon: string;
  defaults: any;
}

const SECTION_TEMPLATES: PaletteTemplate[] = [
  { type: "text", label: "Text Block", group: "Sections", keywords: "text paragraph heading copy", icon: "T", defaults: { title: "New heading", content: "Add a short paragraph describing your store, a promotion, or anything else your customers should know.", align: "center" } },
  { type: "button", label: "Button", group: "Sections", keywords: "button cta link action", icon: "B", defaults: { label: "Shop Now", link: "/pc", variant: "primary", align: "center", size: "md" } },
  { type: "image", label: "Image", group: "Sections", keywords: "image picture photo media", icon: "I", defaults: { imageUrl: "", alt: "", caption: "", rounded: true } },
  { type: "banner", label: "Banner", group: "Sections", keywords: "banner promo offer sale strip", icon: "N", defaults: { text: "Big Sale — up to 30% off", bgColor: "#f97316", textColor: "#ffffff", link: "/pc", buttonLabel: "Shop Now", buttonLink: "/pc" } },
  { type: "stats", label: "Stats", group: "Sections", keywords: "stats numbers counters metrics", icon: "S", defaults: { items: [{ value: "1000+", label: "Products" }, { value: "500+", label: "Customers" }, { value: "24/7", label: "Support" }] } },
  { type: "features", label: "Features", group: "Sections", keywords: "features benefits reasons cards", icon: "F", defaults: { title: "Why shop with us", columns: 3, items: [{ title: "Genuine products", text: "Authentic, sourced from official distributors." }, { title: "Fast delivery", text: "Nationwide delivery, Nairobi within 24h." }, { title: "Warranty", text: "Covered on every item we sell." }] } },
  { type: "spacer", label: "Spacer", group: "Sections", keywords: "spacer space gap padding", icon: "S", defaults: { height: 48 } },
  { type: "product-grid", label: "Products", group: "Commerce", keywords: "products grid catalog shop items", icon: "P", defaults: { title: "Featured Products", productFilter: "all", columns: 4, limit: 8 } },
  { type: "category-grid", label: "Categories", group: "Commerce", keywords: "categories categories shop links", icon: "C", defaults: { title: "Shop by Category", columns: 4, style: "cards" } },
];

const SECTION_LABELS: Record<string, string> = {
  "product-grid": "Products", "category-grid": "Categories", banner: "Banner", stats: "Stats",
  text: "Text", button: "Button", image: "Image", features: "Features", spacer: "Spacer",
};

const EDITABLE_FIDS = [
  /^hero\.badge$/, /^hero\.headline$/, /^hero\.subtitle$/, /^hero\.ctaText$/, /^hero\.buttons\.\d+\.label$/,
  /^sections\.\d+\.title$/, /^sections\.\d+\.content$/, /^sections\.\d+\.label$/,
  /^sections\.\d+\.text$/, /^sections\.\d+\.buttonLabel$/, /^sections\.\d+\.caption$/,
  /^sections\.\d+\.items\.\d+\.title$/, /^sections\.\d+\.items\.\d+\.text$/,
  /^sections\.\d+\.items\.\d+\.value$/, /^sections\.\d+\.items\.\d+\.label$/,
];

type Device = "desktop" | "tablet" | "mobile";
const DEVICES: { id: Device; label: string; width: number | null }[] = [
  { id: "desktop", label: "Desktop", width: null },
  { id: "tablet", label: "Tablet", width: 768 },
  { id: "mobile", label: "Mobile", width: 390 },
];

interface StudioSnapshot {
  label: string;
  description: string;
  config: DynamicLayoutConfig;
}

function getAtPath(obj: any, path: string): unknown {
  let cur = obj;
  for (const part of path.split(".")) {
    if (cur == null) return undefined;
    cur = Array.isArray(cur) ? cur[Number(part)] : cur[part];
  }
  return cur;
}

function setAtPath(obj: any, path: string, value: unknown): any {
  const [head, ...rest] = path.split(".");
  if (rest.length === 0) return { ...obj, [head]: value };
  const child = obj && obj[head];
  const nextChild = Array.isArray(child)
    ? child.map((c: any, i: number) => (String(i) === rest[0] ? setAtPath(c, rest.slice(1).join("."), value) : c))
    : child && typeof child === "object"
      ? setAtPath(child, rest.join("."), value)
      : setAtPath({}, rest.join("."), value);
  return { ...obj, [head]: nextChild };
}

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

function LinkHint({ value }: { value: string }) {
  const v = (value || "").trim();
  if (!v || isSafeHref(v)) return null;
  return (
    <span style={{ display: "block", fontSize: "0.7rem", color: "var(--danger)", marginTop: "0.25rem" }}>
      This link will be blocked for safety. Use /page, #anchor, https://, wa.me, mailto: or tel:.
    </span>
  );
}

function InlineEditOverlay({ fid, rect }: { fid: string; rect: { top: number; left: number; width: number; height: number } }) {
  return (
    <div
      data-sb-overlay
      style={{
        position: "absolute",
        top: rect.top, left: rect.left, width: rect.width, minHeight: Math.max(rect.height, 28),
        pointerEvents: "none",
        borderRadius: 6,
        background: "color-mix(in srgb, var(--primary) 8%, transparent)",
        border: "1.5px dashed var(--primary)",
        boxSizing: "border-box",
        zIndex: 30,
      }}
    >
      <span
        data-sb-overlay
        style={{
          position: "absolute", top: -22, left: -1.5,
          background: "var(--primary)", color: "#fff",
          fontSize: "0.62rem", fontWeight: 600, letterSpacing: "0.04em",
          padding: "0.15rem 0.5rem", borderRadius: "6px 6px 0 0",
          whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis",
          pointerEvents: "none",
        }}
      >
        EDIT · {fid}
      </span>
    </div>
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
  const [previewAnim, setPreviewAnim] = useState<number | "hero" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const [paletteQuery, setPaletteQuery] = useState("");
  const [tab, setTab] = useState<"content" | "design" | "layout">("content");
  const [editField, setEditField] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editOriginal, setEditOriginal] = useState("");
  const [editRect, setEditRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const [hist, setHist] = useState<HistoryState<StudioSnapshot>>(() => createHistory({ label: "", description: "", config: DEFAULT_CONFIG }, 120));
  const pushTimer = useRef<number | null>(null);
  const configRef = useRef(config);
  const labelRef = useRef(label);
  const descRef = useRef(description);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { labelRef.current = label; }, [label]);
  useEffect(() => { descRef.current = description; }, [description]);

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

  function scheduleHistory() {
    if (pushTimer.current) window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => {
      pushTimer.current = null;
      setHist((h) => pushHistory(h, { label: labelRef.current, description: descRef.current, config: configRef.current }));
    }, 400);
  }

  function cancelPendingHistory() {
    if (pushTimer.current) { window.clearTimeout(pushTimer.current); pushTimer.current = null; }
  }

  function resetHistory(snapshot: StudioSnapshot) {
    cancelPendingHistory();
    setHist(createHistory(snapshot, 120));
  }

  function mutateConfig(next: DynamicLayoutConfig) {
    setConfig(next);
    setDirty(true);
    scheduleHistory();
  }

  function applySnapshot(snap: StudioSnapshot) {
    setLabel(snap.label);
    setDescription(snap.description);
    setConfig(snap.config);
    setDirty(true);
    setEditField(null);
    setEditRect(null);
  }

  function undo() {
    cancelPendingHistory();
    const res = undoHistory(hist);
    if (!res.value) return;
    setHist(res.state);
    applySnapshot(res.value);
  }

  function redo() {
    cancelPendingHistory();
    const res = redoHistory(hist);
    if (!res.value) return;
    setHist(res.state);
    applySnapshot(res.value);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (k === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hist]);

  async function loadSelected(id: number) {
    setSelectedId(id);
    setSelectedSection(null);
    setSaving(true);
    try {
      const row = await api<LayoutRow>(`/api/admin/layouts/${id}`);
      const newConfig = row.config && typeof row.config === "object" ? row.config : DEFAULT_CONFIG;
      setLabel(row.label);
      setDescription(row.description || "");
      setConfig(newConfig);
      setDirty(false);
      resetHistory({ label: row.label, description: row.description || "", config: newConfig });
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
    mutateConfig({ ...configRef.current, ...patch });
  }

  function updateLabel(next: string) {
    setLabel(next);
    setDirty(true);
    scheduleHistory();
  }

  function updateSection(idx: number, patch: Partial<Section>) {
    const sections = [...(configRef.current.sections || [])];
    sections[idx] = { ...(sections[idx] || {}), ...patch } as Section;
    mutateConfig({ ...configRef.current, sections });
  }

  function addSection(template: PaletteTemplate) {
    const section = { type: template.type, id: uid(), ...template.defaults };
    const sections = [...(configRef.current.sections || []), section];
    mutateConfig({ ...configRef.current, sections });
    setSelectedSection(sections.length - 1);
    setTab("content");
  }

  function removeSection(idx: number) {
    const sections = (configRef.current.sections || []).filter((_, i) => i !== idx);
    mutateConfig({ ...configRef.current, sections });
    setSelectedSection(null);
  }

  function moveSection(idx: number, dir: -1 | 1) {
    const sections = [...(configRef.current.sections || [])];
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    [sections[idx], sections[target]] = [sections[target], sections[idx]];
    mutateConfig({ ...configRef.current, sections });
    setSelectedSection((prev) => (prev === null ? null : prev + dir));
  }

  function onDragStart(idx: number) { setDragIdx(idx); }
  function onDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDropIdx(idx); }
  function onDragEnd() { setDragIdx(null); setDropIdx(null); }
  function onDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDropIdx(null); return; }
    const sections = [...(configRef.current.sections || [])];
    const [moved] = sections.splice(dragIdx, 1);
    sections.splice(idx, 0, moved);
    mutateConfig({ ...configRef.current, sections });
    setDragIdx(null); setDropIdx(null);
    setSelectedSection(idx);
  }

  function updateHero(patch: Partial<NonNullable<DynamicLayoutConfig["hero"]>>) {
    mutateConfig({ ...configRef.current, hero: { ...(configRef.current.hero || {}), ...patch } });
  }

  function updateColors(patch: Partial<NonNullable<DynamicLayoutConfig["colors"]>>) {
    mutateConfig({ ...configRef.current, colors: { ...(configRef.current.colors || {}), ...patch } });
  }

  function updateCard(patch: Partial<NonNullable<DynamicLayoutConfig["productCard"]>>) {
    mutateConfig({ ...configRef.current, productCard: { ...(configRef.current.productCard || {}), ...patch } });
  }

  function applyFieldPath(fid: string, value: string) {
    setConfig((prev) => setAtPath(prev, fid, value) as DynamicLayoutConfig);
    setDirty(true);
    scheduleHistory();
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
      setMsg("Layout created. Add sections, then save and publish.");
    } catch (e: any) { setMsg("Failed: " + e.message); }
    finally { setSaving(false); }
  }

  async function saveLayout() {
    if (!selectedId) return;
    setSaving(true); setMsg("");
    try {
      await api(`/api/admin/layouts/${selectedId}`, { method: "PUT", body: JSON.stringify({ label, description, config }) });
      setDirty(false);
      setHist((h) => pushHistory(h, { label, description, config }));
      setMsg("Draft saved.");
      refreshLayouts();
    } catch (e: any) { setMsg("Failed: " + e.message); }
    finally { setSaving(false); }
  }

  async function publishLayout() {
    if (!selectedId) return;
    setSaving(true); setMsg("");
    try {
      if (dirty) {
        await api(`/api/admin/layouts/${selectedId}`, { method: "PUT", body: JSON.stringify({ label, description, config }) });
        setDirty(false);
        setHist((h) => pushHistory(h, { label, description, config }));
      }
      await api(`/api/admin/layouts/${selectedId}/activate`, { method: "PUT" });
      await loadLayouts();
      refreshLayouts();
      refreshConfig();
      setMsg("Layout published — it's now live on your storefront.");
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
    const hero = configRef.current.hero || {};
    updateHero({ buttons: [...(hero.buttons || []), { label: "Secondary", link: "/", variant: "secondary" }] });
  }

  function startEdit(fid: string, value: string) {
    const el = canvasRef.current?.querySelector(`[data-fid="${fid}"]`) as HTMLElement | null;
    if (!el || !canvasRef.current) return;
    const c = canvasRef.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setEditRect({ top: r.top - c.top, left: r.left - c.left, width: r.width, height: r.height });
    setEditOriginal(value);
    setEditDraft(value);
    setEditField(fid);
  }

  function onCanvasClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (!showPreview && target.closest("a")) e.preventDefault();
    if (target.closest("[data-sb-overlay]")) return;
    if (showPreview) return;
    const fieldEl = target.closest("[data-fid]");
    if (fieldEl) {
      const fid = fieldEl.getAttribute("data-fid") || "";
      if (fid === "hero") { setSelectedSection(null); setTab("content"); }
      else if (fid.startsWith("sections.")) {
        const n = Number(fid.split(".")[1]);
        if (!Number.isNaN(n)) setSelectedSection(n);
      }
      e.stopPropagation();
      if (EDITABLE_FIDS.some((re) => re.test(fid))) {
        startEdit(fid, String(getAtPath(config, fid) ?? ""));
      } else {
        setEditField(null);
        setEditRect(null);
      }
    } else {
      setEditField(null);
      setEditRect(null);
    }
  }

  function closeEdit(commit: boolean) {
    if (editField) {
      if (!commit) applyFieldPath(editField, editOriginal);
    }
    setEditField(null);
    setEditRect(null);
  }

  if (loading) return <Spinner />;
  if (error && !layouts.length) return <ErrorMsg msg={error} />;

  const hero = config.hero || {};
  const sections = config.sections || [];
  const selectedSectionData: Section | null = selectedSection !== null ? sections[selectedSection] : null;
  const canUndoNow = canUndo(hist);
  const canRedoNow = canRedo(hist);
  const isActive = layouts.find((l) => l.id === selectedId)?.is_active === 1 || activeLayout === layouts.find((l) => l.id === selectedId)?.layout_key;
  const deviceWidth = DEVICES.find((d) => d.id === device)?.width ?? null;

  const renderContentTab = (s: Section, idx: number) => {
    switch (s.type) {
      case "text":
        return (<>
          <Field label="Heading"><Text value={s.title || ""} onChange={(v) => updateSection(idx, { title: v })} /></Field>
          <Field label="Text"><textarea style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} value={s.content || ""} onChange={(e) => updateSection(idx, { content: e.target.value })} /></Field>
        </>);
      case "button":
        return (<>
          <Field label="Label"><Text value={s.label || ""} onChange={(v) => updateSection(idx, { label: v })} /></Field>
          <Field label="Link"><Text value={s.link || ""} onChange={(v) => updateSection(idx, { link: v })} placeholder="/pc" /><LinkHint value={s.link || ""} /></Field>
        </>);
      case "image":
        return (<>
          <Field label="Image URL"><Text value={s.imageUrl || ""} onChange={(v) => updateSection(idx, { imageUrl: v })} placeholder="https://...jpg" /></Field>
          <Field label="Alt text"><Text value={s.alt || ""} onChange={(v) => updateSection(idx, { alt: v })} /></Field>
          <Field label="Caption"><Text value={s.caption || ""} onChange={(v) => updateSection(idx, { caption: v })} /></Field>
          <Field label="Link (optional)"><Text value={s.link || ""} onChange={(v) => updateSection(idx, { link: v })} /><LinkHint value={s.link || ""} /></Field>
        </>);
      case "product-grid":
        return (<>
          <Field label="Heading"><Text value={s.title || ""} onChange={(v) => updateSection(idx, { title: v })} /></Field>
          <Field label="Products to show"><Select value={s.productFilter || "all"} onChange={(v) => updateSection(idx, { productFilter: v as any })} options={[{ value: "all", label: "All products" }, { value: "featured", label: "Featured (with image)" }, { value: "sale", label: "On sale" }, { value: "newest", label: "Newest first" }]} /></Field>
          <Field label="Limit"><Num value={s.limit || 0} min={1} max={48} onChange={(v) => updateSection(idx, { limit: v || undefined })} /></Field>
        </>);
      case "category-grid":
        return (<>
          <Field label="Heading"><Text value={s.title || ""} onChange={(v) => updateSection(idx, { title: v })} /></Field>
        </>);
      case "banner":
        return (<>
          <Field label="Text"><Text value={s.text || ""} onChange={(v) => updateSection(idx, { text: v })} /></Field>
          <Field label="Image URL (optional)"><Text value={s.imageUrl || ""} onChange={(v) => updateSection(idx, { imageUrl: v })} /></Field>
          <Field label="Banner link"><Text value={s.link || ""} onChange={(v) => updateSection(idx, { link: v })} /><LinkHint value={s.link || ""} /></Field>
          <Field label="Button label"><Text value={s.buttonLabel || ""} onChange={(v) => updateSection(idx, { buttonLabel: v })} /></Field>
          <Field label="Button link"><Text value={s.buttonLink || ""} onChange={(v) => updateSection(idx, { buttonLink: v })} /><LinkHint value={s.buttonLink || ""} /></Field>
        </>);
      case "stats":
        return (
          <div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0 0 0.5rem" }}>Stat items</p>
            {(s.items || []).map((item, j) => (
              <div key={j} style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem" }}>
                <Text value={item.value} onChange={(v) => { const items = [...(s.items || [])]; items[j] = { ...items[j], value: v }; updateSection(idx, { items }); }} />
                <Text value={item.label} onChange={(v) => { const items = [...(s.items || [])]; items[j] = { ...items[j], label: v }; updateSection(idx, { items }); }} />
                <RippleButton size="small" variant="danger" aria-label="Remove stat" onClick={() => updateSection(idx, { items: (s.items || []).filter((_, k) => k !== j) })}>✕</RippleButton>
              </div>
            ))}
            <RippleButton size="small" onClick={() => updateSection(idx, { items: [...(s.items || []), { value: "0", label: "New stat" }] })}>+ Add stat</RippleButton>
          </div>
        );
      case "features":
        return (
          <div>
            <Field label="Heading"><Text value={s.title || ""} onChange={(v) => updateSection(idx, { title: v })} /></Field>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0 0 0.5rem" }}>Feature items</p>
            {(s.items || []).map((item, j) => (
              <div key={j} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem", marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
                  <Field label="Icon"><Text value={item.icon || ""} onChange={(v) => { const items = [...(s.items || [])]; items[j] = { ...items[j], icon: v }; updateSection(idx, { items }); }} /></Field>
                  <RippleButton size="small" variant="danger" aria-label="Remove feature" onClick={() => updateSection(idx, { items: (s.items || []).filter((_, k) => k !== j) })}>✕</RippleButton>
                </div>
                <Field label="Title"><Text value={item.title || ""} onChange={(v) => { const items = [...(s.items || [])]; items[j] = { ...items[j], title: v }; updateSection(idx, { items }); }} /></Field>
                <Field label="Text"><Text value={item.text || ""} onChange={(v) => { const items = [...(s.items || [])]; items[j] = { ...items[j], text: v }; updateSection(idx, { items }); }} /></Field>
              </div>
            ))}
            <RippleButton size="small" onClick={() => updateSection(idx, { items: [...(s.items || []), { title: "New feature", text: "Describe this feature." }] })}>+ Add feature</RippleButton>
          </div>
        );
      case "spacer":
        return (<>
          <Field label="Height (px)"><Num value={s.height || 40} min={0} max={200} onChange={(v) => updateSection(idx, { height: v })} /></Field>
        </>);
      default:
        return null;
    }
  };

  const renderDesignTab = (s: Section, idx: number) => {
    switch (s.type) {
      case "button":
        return (<>
          <Field label="Style"><Select value={s.variant || "primary"} onChange={(v) => updateSection(idx, { variant: v as any })} options={[{ value: "primary", label: "Solid" }, { value: "secondary", label: "Neutral" }, { value: "outline", label: "Outline" }]} /></Field>
          <Field label="Size"><Select value={s.size || "md"} onChange={(v) => updateSection(idx, { size: v as any })} options={[{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }]} /></Field>
          <Field label="Alignment"><Select value={s.align || "center"} onChange={(v) => updateSection(idx, { align: v as any })} options={[{ value: "center", label: "Center" }, { value: "left", label: "Left" }]} /></Field>
        </>);
      case "image":
        return (<>
          <Field label="Max width (px)"><Num value={s.maxWidth || 0} onChange={(v) => updateSection(idx, { maxWidth: v || undefined })} /></Field>
          <Check label="Rounded corners" checked={s.rounded !== false} onChange={(v) => updateSection(idx, { rounded: v })} />
        </>);
      case "product-grid":
      case "features":
        return (<>
          <Field label="Columns (desktop)"><Num value={s.columns || (s.type === "product-grid" ? 4 : 3)} min={1} max={6} onChange={(v) => updateSection(idx, { columns: Math.min(6, Math.max(1, v)) })} /></Field>
          {s.type === "product-grid" && (
            <Check label="Show ratings" checked={configRef.current.productCard?.showRating !== false} onChange={(v) => updateCard({ showRating: v })} />
          )}
        </>);
      case "category-grid":
        return (<>
          <Field label="Style"><Select value={s.style || "cards"} onChange={(v) => updateSection(idx, { style: v as any })} options={[{ value: "cards", label: "Cards" }, { value: "icons", label: "Compact" }]} /></Field>
          <Field label="Columns (desktop)"><Num value={s.columns || 4} min={1} max={6} onChange={(v) => updateSection(idx, { columns: Math.min(6, Math.max(1, v)) })} /></Field>
        </>);
      case "banner":
        return (<>
          <Field label="Background color"><Color value={s.bgColor || ""} onChange={(v) => updateSection(idx, { bgColor: v })} /></Field>
          <Field label="Text color"><Color value={s.textColor || ""} onChange={(v) => updateSection(idx, { textColor: v })} /></Field>
        </>);
      case "text":
        return (<>
          <Field label="Alignment"><Select value={s.align || "center"} onChange={(v) => updateSection(idx, { align: v as any })} options={[{ value: "center", label: "Center" }, { value: "left", label: "Left" }]} /></Field>
        </>);
      default:
        return <p style={{ fontSize: "0.82rem", color: "var(--text-tertiary)" }}>No design options for this section.</p>;
    }
  };

  const renderLayoutTab = (s: Section, idx: number) => {
    const isGrid = s.type === "product-grid" || s.type === "category-grid" || s.type === "features";
    return (<>
      {isGrid && (<>
        <Field label="Columns (tablet)"><Num value={(s as any).columnsTablet || 0} min={1} max={6} onChange={(v) => updateSection(idx, { columnsTablet: Math.min(6, Math.max(1, v)) } as any)} /></Field>
        <Field label="Columns (mobile)"><Num value={(s as any).columnsMobile || 0} min={1} max={4} onChange={(v) => updateSection(idx, { columnsMobile: Math.min(4, Math.max(1, v)) } as any)} /></Field>
      </>)}
      <Check label="Hide on mobile" checked={!!(s as any).hideOnMobile} onChange={(v) => updateSection(idx, { hideOnMobile: v } as any)} />
      <p style={{ fontSize: "0.78rem", color: "var(--text-tertiary)", marginTop: "0.5rem" }}>
        Use the Preview mode and the Desktop / Tablet / Mobile switcher to see the effect.
      </p>
    </>);
  };

  const renderLayoutSettings = () => (
    <>
      <div style={{ display: "flex", gap: "0.35rem", borderBottom: "1px solid var(--border)", marginBottom: "1rem" }}>
        {(["content", "design"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} style={{ ...tabChip, ...(tab === t ? tabChipActive : {}) }}>{t === "content" ? "Hero" : "Design"}</button>
        ))}
      </div>

      {tab === "content" && (<>
        <Field label="Layout name"><Text value={label} onChange={updateLabel} /></Field>
        <h4 style={{ margin: "0.5rem 0 0.5rem", fontSize: "0.85rem" }}>Hero section</h4>
        <Check label="Show hero" checked={hero.enabled !== false} onChange={(v) => updateHero({ enabled: v })} />
        <Field label="Style"><Select value={hero.style || "carousel"} onChange={(v) => updateHero({ style: v as any })} options={[{ value: "carousel", label: "Carousel" }, { value: "split", label: "Split" }, { value: "minimal", label: "Minimal" }, { value: "none", label: "No hero" }]} /></Field>
        {hero.style !== "none" && (<>
          <Field label="Badge text"><Text value={hero.badge || ""} onChange={(v) => updateHero({ badge: v })} placeholder="Summer sale — up to 30% off" /></Field>
          <Field label="Headline"><Text value={hero.headline || ""} onChange={(v) => updateHero({ headline: v })} /></Field>
          <Field label="Subtitle"><Text value={hero.subtitle || ""} onChange={(v) => updateHero({ subtitle: v })} /></Field>
          <Field label="Main button label"><Text value={hero.ctaText || ""} onChange={(v) => updateHero({ ctaText: v })} /></Field>
          <Field label="Main button link"><Text value={hero.ctaLink || ""} onChange={(v) => updateHero({ ctaLink: v })} /><LinkHint value={hero.ctaLink || ""} /></Field>
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
      </>)}

      {tab === "design" && (<>
        <div style={{ borderTop: "1px solid var(--border)", marginTop: "0.25rem", paddingTop: "0.75rem" }}>
          <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.85rem" }}>Hero animation</h4>
          <MotionPanel value={hero.animation} onChange={(a) => updateHero({ animation: a })} onPreview={() => setPreviewAnim("hero")} />
        </div>
        <h4 style={{ margin: "1rem 0 0.5rem", fontSize: "0.85rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>Colors</h4>
        <Field label="Hero background"><Color value={config.colors?.heroBg || ""} onChange={(v) => updateColors({ heroBg: v })} /></Field>
        <Field label="Hero text"><Color value={config.colors?.heroText || ""} onChange={(v) => updateColors({ heroText: v })} /></Field>
        <Field label="Accent"><Color value={config.colors?.accent || ""} onChange={(v) => updateColors({ accent: v })} /></Field>
        <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", margin: "0.5rem 0 0" }}>Tip: to match the whole site to your brand (header, buttons, footer), use <strong>Storefront → My Brand Colors</strong>.</p>
        <h4 style={{ margin: "1rem 0 0.5rem", fontSize: "0.85rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>Product cards</h4>
        <Field label="Style"><Select value={config.productCard?.style || "default"} onChange={(v) => updateCard({ style: v as any })} options={[{ value: "default", label: "Default" }, { value: "compact", label: "Compact" }, { value: "detailed", label: "Detailed" }]} /></Field>
        <Check label="Show ratings" checked={config.productCard?.showRating !== false} onChange={(v) => updateCard({ showRating: v })} />
        <Check label="Show sale price" checked={config.productCard?.showSalePrice !== false} onChange={(v) => updateCard({ showSalePrice: v })} />
      </>)}
    </>
  );

  const tabChip: React.CSSProperties = {
    padding: "0.4rem 0.9rem", fontSize: "0.8rem", fontWeight: 600, borderRadius: "8px 8px 0 0",
    border: "none", borderBottom: "2px solid transparent", cursor: "pointer",
    background: "transparent", color: "var(--text-secondary)",
  };
  const tabChipActive: React.CSSProperties = {
    background: "var(--surface-hover)", color: "var(--text)", borderBottomColor: "var(--primary)",
  };

  const renderTabs = () => (
    <div style={{ display: "flex", gap: "0.35rem", borderBottom: "1px solid var(--border)", marginBottom: "1rem" }}>
      {(["content", "design", "layout"] as const).map((t) => (
        <button key={t} type="button" onClick={() => setTab(t)} style={{ ...tabChip, ...(tab === t ? tabChipActive : {}) }}>
          {t === "content" ? "Content" : t === "design" ? "Design" : "Layout"}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <style>{`
        .sb-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .sb-toolbar-left { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
        .sb-grid { display: grid; grid-template-columns: 220px 1fr 300px; gap: 1rem; align-items: start; }
        @media (max-width: 1200px) { .sb-grid { grid-template-columns: 1fr; } }
        .sb-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }
        .sb-palette-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.6rem; border: 1px solid var(--border); border-radius: 8px; cursor: grab; margin-bottom: 0.5rem; font-size: 0.85rem; background: var(--bg); transition: border-color 0.15s; }
        .sb-palette-item:hover { border-color: var(--primary); }
        .sb-palette-icon { width: 26px; height: 26px; border-radius: 6px; background: var(--primary-subtle); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0; }
        .sb-section { position: relative; border: 1px solid transparent; }
        .sb-section:hover { outline: 1px dashed var(--border-hover); outline-offset: 2px; }
        .sb-section.selected { border-color: var(--primary); border-style: solid; border-width: 2px; border-radius: 10px; }
        .sb-section.selected .sb-section-bar { display: flex; }
        .sb-section-bar { display: none; position: absolute; top: 6px; left: 6px; z-index: 20; align-items: center; gap: 0.3rem; background: var(--primary); color: #fff; border-radius: 6px; padding: 0.15rem 0.4rem; font-size: 0.7rem; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
        .sb-section-bar button { background: none; border: none; color: #fff; cursor: pointer; font-size: 0.75rem; padding: 0 0.2rem; line-height: 1; }
        .sb-section-bar .sb-grip { cursor: grab; }
        .sb-canvas { min-height: 300px; border: 1px solid var(--border); border-radius: 12px; overflow: auto; background: var(--bg); }
        .sb-empty { padding: 3rem 2rem; text-align: center; color: var(--text-tertiary); }
        .sb-msg { padding: 0.5rem 0.75rem; border-radius: 8px; margin-bottom: 0.75rem; font-size: 0.82rem; }
        .sb-msg-ok { background: #d1fae5; color: #065f46; }
        .sb-msg-err { background: #fee2e2; color: #991b1b; }
        .sb-status { font-size: 0.72rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 999px; letter-spacing: 0.03em; }
      `}</style>

      <div className="sb-toolbar">
        <div className="sb-toolbar-left">
          <h1 style={{ margin: 0 }}>Website Studio</h1>
          <select value={selectedId ?? ""} onChange={(e) => selectLayout(Number(e.target.value))} style={{ ...inputStyle, width: 220 }}>
            <option value="" disabled>Select a custom layout…</option>
            {dynamicLayouts.map((l) => <option key={l.id} value={l.id}>{l.label}{l.is_active === 1 ? " (live)" : ""}</option>)}
          </select>
          <RippleButton onClick={createLayout} loading={saving}>+ New Layout</RippleButton>
        </div>
        {selectedId && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            {isActive
              ? <span className="sb-status" style={{ background: "var(--success-light)", color: "var(--success-text)" }}>LIVE</span>
              : dirty
                ? <span className="sb-status" style={{ background: "var(--warning-light)", color: "var(--warning-text)" }}>UNSAVED DRAFT</span>
                : <span className="sb-status" style={{ background: "var(--surface-hover)", color: "var(--text-secondary)" }}>SAVED DRAFT</span>}
            <RippleButton onClick={saveLayout} loading={saving} variant={dirty ? "primary" : "secondary"}>{!dirty ? "Saved" : "Save Draft"}</RippleButton>
            <RippleButton onClick={publishLayout} loading={saving} variant={isActive ? "secondary" : "primary"}>{isActive ? "Published ✓" : "Publish to Storefront"}</RippleButton>
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
            reorder them, double-click any text on the canvas to edit it in place, then <strong>Publish</strong> to make it live.
            Built-in layouts (Original, Amazon, Jumia) are shown under <strong>Storefront</strong> and can't be edited here.
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
          <div className="sb-panel">
            <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Add a section</h3>
            <Field label="Search"><Text value={paletteQuery} onChange={setPaletteQuery} placeholder="Products, banner, stats…" /></Field>
            {(["Sections", "Commerce"]).map((group) => {
              const items = SECTION_TEMPLATES.filter((t) => t.group === group && (t.label + " " + t.keywords).toLowerCase().includes(paletteQuery.trim().toLowerCase()));
              if (!items.length) return null;
              return (
                <div key={group}>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0.4rem 0 0.4rem" }}>{group}</div>
                  {items.map((t) => (
                    <div key={t.type} className="sb-palette-item" onClick={() => addSection(t)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") addSection(t); }}>
                      <span className="sb-palette-icon">{t.icon}</span>
                      {t.label}
                    </div>
                  ))}
                </div>
              );
            })}
            {!sections.length && <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.5rem" }}>Your page is empty — add a section to start.</p>}
          </div>

          <div>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <RippleButton size="small" variant={!showPreview ? "primary" : "secondary"} onClick={() => { setShowPreview(false); setEditField(null); setEditRect(null); }}>Edit</RippleButton>
              <RippleButton size="small" variant={showPreview ? "primary" : "secondary"} onClick={() => { setShowPreview(true); setSelectedSection(null); setEditField(null); setEditRect(null); }}>Preview</RippleButton>
              <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                {DEVICES.map((d) => (
                  <button key={d.id} type="button" onClick={() => { setDevice(d.id); setEditField(null); setEditRect(null); }} aria-pressed={device === d.id} style={{ padding: "0.4rem 0.8rem", fontSize: "0.78rem", fontWeight: 600, border: "none", cursor: "pointer", background: device === d.id ? "var(--primary)" : "transparent", color: device === d.id ? "#fff" : "var(--text-secondary)" }}>{d.label}</button>
                ))}
              </div>
              <span style={{ fontSize: "0.78rem", color: "var(--text-tertiary)" }}>Ctrl/Cmd+Z undo · Ctrl/Cmd+Shift+Z redo</span>
            </div>
            <div style={{ display: "flex", justifyContent: device === "desktop" ? "flex-start" : "center" }}>
              <div
                className="sb-canvas"
                ref={canvasRef}
                onClickCapture={onCanvasClickCapture}
                style={{
                  width: "100%",
                  maxWidth: deviceWidth ?? "100%",
                  maxHeight: "70vh",
                  position: "relative",
                  transition: "max-width 0.25s ease",
                }}
              >
                {showPreview ? (
                  <>
                    <HeroSection key={previewAnim === "hero" ? "hero-anim" : "hero-static"} hero={hero} colors={config.colors} products={products} categories={categories} forceTrigger={previewAnim === "hero" ? "load" : undefined} />
                    {sections.map((s, i) => <DynamicSectionView key={(s as any).id || i} section={s} products={products} categories={categories} colors={config.colors} cardConfig={config.productCard} index={i} />)}
                  </>
                ) : (
                  <>
                    <div
                      className={`sb-section${selectedSection === null ? " selected" : ""}`}
                      onClick={() => { setSelectedSection(null); setTab("content"); }}
                    >
                      <div className="sb-section-bar">
                        <span className="sb-grip">≡</span>
                        <span>Hero</span>
                      </div>
                      <HeroSection key={previewAnim === "hero" ? "hero-anim" : "hero-static"} hero={hero} colors={config.colors} products={products} categories={categories} forceTrigger={previewAnim === "hero" ? "load" : undefined} />
                    </div>
                    {sections.length === 0 && (
                      <div className="sb-empty">No sections yet. Add one from the left palette.</div>
                    )}
                    {sections.map((s, i) => (
                      <div
                        key={`${(s as any).id || i}-${previewAnim === i ? "anim" : "static"}`}
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
                        <DynamicSectionView section={s} products={products} categories={categories} colors={config.colors} cardConfig={config.productCard} forceTrigger={previewAnim === i ? "load" : undefined} index={i} />
                      </div>
                    ))}
                    {editField && editRect && (
                      <>
                        <InlineEditOverlay fid={editField} rect={editRect} />
                        <input
                          autoFocus
                          value={editDraft}
                          data-sb-overlay
                          onChange={(e) => { setEditDraft(e.target.value); applyFieldPath(editField, e.target.value); }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); }
                            else if (e.key === "Escape") { closeEdit(false); }
                          }}
                          onBlur={() => closeEdit(true)}
                          onFocus={(e) => (e.target as HTMLInputElement).select()}
                          style={{
                            position: "absolute",
                            top: editRect.top,
                            left: editRect.left,
                            width: Math.max(editRect.width, 40),
                            font: "inherit",
                            color: "var(--text)",
                            padding: "0.1rem 0.25rem",
                            margin: 0,
                            boxSizing: "border-box",
                            background: "var(--surface)",
                            border: "1.5px solid var(--primary)",
                            borderRadius: "0 6px 6px 6px",
                            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                            zIndex: 40,
                            minHeight: 22,
                          }}
                        />
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="sb-panel">
            <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>
              {selectedSectionData ? `Properties — ${SECTION_LABELS[selectedSectionData.type] || "section"}` : "Properties — Page"}
            </h3>

            {selectedSectionData ? (
              <>
                {renderTabs()}
                {tab === "content" && renderContentTab(selectedSectionData, selectedSection as number)}
                {tab === "design" && (<>
                  {renderDesignTab(selectedSectionData, selectedSection as number)}
                  <div style={{ borderTop: "1px solid var(--border)", marginTop: "1rem", paddingTop: "0.75rem" }}>
                    <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.85rem" }}>Animation</h4>
                    <MotionPanel value={(selectedSectionData as any).animation} onChange={(a) => updateSection(selectedSection as number, { animation: a })} onPreview={() => setPreviewAnim(selectedSection)} />
                  </div>
                </>)}
                {tab === "layout" && renderLayoutTab(selectedSectionData, selectedSection as number)}
                <div style={{ borderTop: "1px solid var(--border)", marginTop: "1rem", paddingTop: "0.75rem" }}>
                  <RippleButton size="small" variant="secondary" onClick={() => { setSelectedSection(null); setTab("content"); }}>← Back to page settings</RippleButton>
                </div>
              </>
            ) : (
              renderLayoutSettings()
            )}
          </div>
        </div>
      )}
    </>
  );
}