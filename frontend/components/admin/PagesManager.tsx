import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getProducts } from "@/components/ProductCard";
import type { Product } from "@/lib/types";
import { DynamicSectionView } from "@/layouts/dynamic-engine";
import type { DynamicSection, DynamicSectionViewProps } from "@/layouts/dynamic-engine";
import { normalizeSlug, uidSection } from "@/lib/sections";
import type { Section } from "@/lib/sections";
import { isSafeHref } from "@/lib/links";
import { Spinner, ErrorMsg } from "./shared";
import { Field, Text, Num, Select, Check, Color, RippleButton, inputStyle } from "./studio-ui";

interface PageRow {
  id: number;
  slug: string;
  title: string;
  description: string;
  config: any;
  is_published: number;
  sort_order: number;
}

const SLUG_HINT = "Lowercase letters, numbers & dashes, 3–60 chars. One page per slug; the storefront uses it as the URL. Reserved: admin, api, product(s), category/ies, cart, about, contact, login …";

const DEFAULT_PAGE = {
  colors: {},
  sections: [] as Section[],
};

const BLANK_SECTION: Section = {
  id: "",
  type: "text",
  title: "",
  content: "",
  align: "center",
};

function PageRowItem({ row, active, onSelect }: { row: PageRow; active: boolean; onSelect: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect(); }}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem",
        padding: "0.6rem 0.7rem", borderRadius: 10, cursor: "pointer", fontSize: "0.85rem",
        border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
        background: active ? "var(--primary-subtle)" : "var(--surface)",
      }}
    >
      <span style={{ fontWeight: 600 }}>{row.title || row.slug}</span>
      <span style={{ fontSize: "0.68rem", color: row.is_published === 1 ? "var(--success-text)" : "var(--text-secondary)", background: row.is_published === 1 ? "var(--success-light)" : "var(--surface-hover)", padding: "0.15rem 0.5rem", borderRadius: 999, fontWeight: 700 }}>
        {row.is_published === 1 ? "LIVE" : "draft"}
      </span>
    </div>
  );
}

export default function PagesManager() {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<PageRow | null>(null);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<any>(DEFAULT_PAGE);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [tab, setTab] = useState<"content" | "design" | "preview">("content");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [dragging, setDragging] = useState<number | null>(null);

  const configRef = useRef(config);
  const selectedRef = useRef(selected);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  async function loadPages() {
    setLoading(true); setError("");
    try {
      const rows = await api<PageRow[]>("/api/pages");
      setPages(rows || []);
    } catch (e: any) {
      setError(e.message || "Failed to load pages.");
    } finally {
      setLoading(false);
    }
  }

  async function createPage() {
    const raw = window.prompt("Page title (also used to suggest a slug):");
    if (!raw || !raw.trim()) return;
    const title = raw.trim();
    let slug = normalizeSlug(title) || "";
    if (!slug) {
      // fall back to a date-based slug so creation always succeeds server-side
      slug = uidSection();
    }
    setSaving(true); setMsg("");
    try {
      const row = await api<PageRow>("/api/admin/pages", {
        method: "POST",
        body: JSON.stringify({ slug, title, description: "", config: DEFAULT_PAGE, is_published: 0 }),
      });
      await loadPages();
      setSelectedId(row.id);
      setSelected(row);
      setSlug(row.slug);
      setTitle(row.title);
      setDescription(row.description || "");
      setConfig(row.config && row.config.sections ? row.config : DEFAULT_PAGE);
      setDirty(false);
      setMsg("Page created. Add sections, then publish.");
    } catch (e: any) {
      setMsg("Failed: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function savePage() {
    if (!selectedId) return;
    setSaving(true); setMsg("");
    try {
      const normalized = normalizeSlug(slug);
      if (!normalized) {
        setMsg("Slug must be 3–60 lowercase letters, numbers and dashes.");
        return;
      }
      const row = await api<PageRow>(`/api/admin/pages/${selectedId}`, {
        method: "PUT",
        body: JSON.stringify({ slug: normalized, title, description, config: { ...config, sections: config.sections || [] } }),
      });
      setSelected(row);
      setSlug(row.slug);
      setTitle(row.title);
      setDescription(row.description || "");
      setConfig(row.config || DEFAULT_PAGE);
      setDirty(false);
      setMsg("Draft saved.");
    } catch (e: any) {
      setMsg("Failed: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!selectedId) return setMsg("Select a page first.");
    setSaving(true); setMsg("");
    try {
      if (dirty) await savePage();
      await api<any>(`/api/admin/pages/${selectedId}`, {
        method: "PUT",
        body: JSON.stringify({ is_published: 1 }),
      });
      await loadPages();
      setDirty(false);
      setMsg("Page is live. Visit /" + slug + " on your storefront.");
    } catch (e: any) {
      setMsg("Failed: " + e.message);
    } finally { setSaving(false); }
  }

  async function unpublish() {
    if (!selectedId) return;
    setSaving(true); setMsg("");
    try {
      await api<any>(`/api/admin/pages/${selectedId}`, {
        method: "PUT",
        body: JSON.stringify({ is_published: 0 }),
      });
      await loadPages();
      setMsg("Page unpublished.");
    } catch (e: any) { setMsg("Failed: " + e.message); }
    finally { setSaving(false); }
  }

  async function deletePage() {
    if (!selectedId) return;
    if (!window.confirm("Delete this page? This can't be undone.")) return;
    setSaving(true); setMsg("");
    try {
      await api<any>(`/api/admin/pages/${selectedId}`, { method: "DELETE" });
      setSelectedId(null); setSelected(null);
      await loadPages();
      setMsg("Page deleted.");
    } catch (e: any) { setMsg("Failed: " + e.message); }
    finally { setSaving(false); }
  }

  function updateSection(idx: number, patch: Partial<Section>) {
    setConfig((prev: any) => {
      const sections = [...(prev.sections || [])];
      sections[idx] = { ...(sections[idx] || {}), ...patch };
      return { ...prev, sections };
    });
    setDirty(true);
  }

  function addSection(type: Section["type"]) {
    setConfig((prev: any) => ({
      ...prev,
      sections: [...(prev.sections || []), { ...BLANK_SECTION, type, id: uidSection() }],
    }));
    setDirty(true);
  }

  function removeSection(idx: number) {
    setConfig((prev: any) => ({ ...prev, sections: (prev.sections || []).filter((_: any, i: number) => i !== idx) }));
    setDirty(true);
  }

  function moveSection(idx: number, dir: -1 | 1) {
    setConfig((prev: any) => {
      const sections = [...(prev.sections || [])];
      const target = idx + dir;
      if (target < 0 || target >= sections.length) return prev;
      [sections[idx], sections[target]] = [sections[target], sections[idx]];
      return { ...prev, sections };
    });
    setDirty(true);
  }

  function onDropSection(idx: number) {
    if (dragging === null || dragging === idx) { setDragging(null); return; }
    setConfig((prev: any) => {
      const sections = [...(prev.sections || [])];
      const [moved] = sections.splice(dragging, 1);
      sections.splice(idx, 0, moved);
      return { ...prev, sections };
    });
    setDragging(null);
    setDirty(true);
  }

  const sectionTypes: { value: Section["type"]; label: string }[] = [
    { value: "text", label: "Text" },
    { value: "hero", label: "Hero" },
    { value: "image", label: "Image" },
    { value: "banner", label: "Banner" },
    { value: "stats", label: "Stats" },
    { value: "features", label: "Features" },
    { value: "product-grid", label: "Products" },
    { value: "category-grid", label: "Categories" },
    { value: "spacer", label: "Spacer" },
  ];

  const viewProps: DynamicSectionViewProps = {
    products,
    categories,
    colors: config.colors,
    cardConfig: config.productCard,
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: "1rem", alignItems: "start" }}>
      <style>{`
        .sb-edit-field { margin-bottom: 0.5rem; }
        .sb-item-card { border: 1px solid var(--border); border-radius: 10px; padding: 0.5rem; margin-bottom: 0.5rem; }
      `}</style>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>Pages</h2>
          <RippleButton onClick={createPage} loading={saving}>＋ New</RippleButton>
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: "0 0 0.75rem" }}>
          Build custom pages (About, FAQ, landing pages…). Each gets its own public URL.
        </p>
        {loading ? <Spinner /> : error ? <ErrorMsg msg={error} /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {pages.length === 0 && <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>No pages yet.</p>}
            {pages.map((p) => (
              <PageRowItem key={p.id} row={p} active={p.id === selectedId} onSelect={() => { setSelectedId(p.id); setSelected(p); setSlug(p.slug); setTitle(p.title); setDescription(p.description || ""); setConfig(p.config || DEFAULT_PAGE); setDirty(false); }} />
            ))}
          </div>
        )}
      </div>

      {!selectedId ? (
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "0.75rem", color: "var(--text-tertiary)", fontSize: "0.85rem" }}>
          Select a page on the left to edit it, or create a new one.
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.75rem" }}>
            <RippleButton variant={dirty ? "primary" : "secondary"} onClick={savePage} loading={saving}>Save Draft</RippleButton>
            <RippleButton onClick={publish} loading={saving}>Publish</RippleButton>
            <RippleButton variant="danger" onClick={unpublish} loading={saving}>Unpublish</RippleButton>
            <RippleButton variant="danger" onClick={deletePage} loading={saving}>Delete</RippleButton>
            <a href={`/${slug}`} target="_blank" rel="noopener" style={{ fontSize: "0.8rem" }}>View ↗</a>
          </div>

          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
            {(["content", "design", "preview"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  padding: "0.4rem 0.8rem", fontSize: "0.8rem", fontWeight: 600, borderRadius: 8, cursor: "pointer",
                  border: tab === t ? "1px solid var(--primary)" : "1px solid var(--border)",
                  background: tab === t ? "var(--primary-subtle)" : "var(--surface)",
                  color: tab === t ? "var(--primary)" : "var(--text-secondary)",
                }}
              >
                {t === "content" ? "Content" : t === "design" ? "Design" : "Preview"}
              </button>
            ))}
            <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
              {(["desktop", "tablet", "mobile"] as const).map((d) => (
                <button key={d} type="button" onClick={() => setDevice(d)} aria-pressed={device === d} style={{ padding: "0.4rem 0.7rem", fontSize: "0.75rem", border: "none", cursor: "pointer", fontWeight: 600, background: device === d ? "var(--primary)" : "transparent", color: device === d ? "#fff" : "var(--text-secondary)" }}>{d}</button>
              ))}
            </div>
          </div>

          {tab !== "preview" && (
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "1rem", alignItems: "start" }}>
              <div>
                <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>Add section</h4>
                {sectionTypes.map((t) => (
                  <button key={t.value} type="button" onClick={() => addSection(t.value)} style={{ display: "block", width: "100%", textAlign: "left", ...inputStyle, marginBottom: "0.35rem", cursor: "pointer" }}>{t.label}</button>
                ))}
              </div>
              <div>
                {tab === "content" && (
                  <Field label="Page title"><Text value={title} onChange={(v) => { setTitle(v); setDirty(true); }} /></Field>
                )}
                <Field label="Slug (URL)">
                  <Text value={slug} onChange={(v) => { setSlug(v); setDirty(true); }} placeholder="my-page" />
                  <span style={{ fontSize: "0.68rem", color: "var(--text-tertiary)" }}>{SLUG_HINT}</span>
                </Field>
                <Field label="Description"><Text value={description} onChange={(v) => { setDescription(v); setDirty(true); }} /></Field>

                {(config.sections || []).length === 0 && (
                  <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>No sections yet — add one from the left.</p>
                )}

                {(config.sections || []).map((s: Section, i: number) => (
                  <div
                    key={s.id || i}
                    className="sb-item-card"
                    draggable
                    onDragStart={() => setDragging(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); onDropSection(i); }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
                      <span style={{ cursor: "grab", color: "var(--text-tertiary)" }}>⋮⋮</span>
                      <strong style={{ fontSize: "0.78rem", textTransform: "capitalize" }}>{s.type}</strong>
                      <span style={{ flex: 1 }} />
                      <button type="button" aria-label="Move up" onClick={() => moveSection(i, -1)} style={{ border: "none", background: "none", cursor: "pointer" }}>↑</button>
                      <button type="button" aria-label="Move down" onClick={() => moveSection(i, 1)} style={{ border: "none", background: "none", cursor: "pointer" }}>↓</button>
                      <button type="button" aria-label="Remove" onClick={() => removeSection(i)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--danger)" }}>✕</button>
                    </div>
                    <DynamicSectionView section={s} {...viewProps} forceTrigger={undefined} index={i} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "design" && (
            <div>
              <Field label="Accent color"><Color value={config.colors?.accent || ""} onChange={(v) => { setConfig((prev: any) => ({ ...prev, colors: { ...(prev.colors || {}), accent: v } })); setDirty(true); }} /></Field>
              <Check label="Show product ratings" checked={config.productCard?.showRating !== false} onChange={(v) => { setConfig((prev: any) => ({ ...prev, productCard: { ...(prev.productCard || {}), showRating: v } })); setDirty(true); }} />
            </div>
          )}

          {tab === "preview" && (
            <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ background: "var(--surface-hover)", padding: "0.4rem 0.75rem", fontSize: "0.75rem", color: "var(--text-secondary)" }}>/{slug} · {device}</div>
              <div style={{ maxHeight: "65vh", overflow: "auto" }}>
                {(config.sections || []).length === 0 && <p style={{ padding: "2rem", textAlign: "center", color: "var(--text-tertiary)", fontSize: "0.85rem" }}>Nothing to preview yet.</p>}
                <DynamicSectionView section={{ type: "hero", id: "hero", title: title || "", content: description || "", align: "center" } as any} products={products} categories={categories} colors={config.colors} cardConfig={config.productCard} forceTrigger={undefined} />
                {(config.sections || []).map((s: Section, i: number) => (
                  <DynamicSectionView key={s.id || i} section={s} products={products} categories={categories} colors={config.colors} cardConfig={config.productCard} forceTrigger={undefined} index={i} />
                ))}
              </div>
            </div>
          )}
          {msg && <p style={{ fontSize: "0.82rem", color: msg.startsWith("Failed") ? "var(--danger)" : "var(--success-text)", marginTop: "0.6rem" }}>{msg}</p>}
        </div>
      )}
    </div>
  );
}
