import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getProducts } from "@/components/ProductCard";
import type { Product } from "@/lib/types";
import { DynamicSectionView, HeroSection } from "@/layouts/dynamic-engine";
import type { DynamicSection, DynamicSectionViewProps } from "@/layouts/dynamic-engine";
import { normalizeSlug, uidSection } from "@/lib/sections";
import type { Section } from "@/lib/sections";
import { confirmDialog, promptDialog } from "@/components/ConfirmDialog";
import { Spinner, ErrorMsg } from "./shared";
import { Field, Text, Select, Check, Color, RippleButton, inputStyle } from "./studio-ui";

interface PageRow {
  id: number;
  slug: string;
  title: string;
  description: string;
  config: any;
  is_published: number;
  sort_order: number;
}

const SLUG_HINT = "Lowercase letters, numbers & dashes, 3–80 chars. Served at /pages/<slug>; one page per slug. Reserved: admin, api, product(s), category/ies, cart, about, contact, login …";
const SLUG_ERROR = "Slug must be 3–80 lowercase letters, numbers and dashes.";

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

const SECTION_TYPES: { value: Section["type"]; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "image", label: "Image" },
  { value: "banner", label: "Banner" },
  { value: "stats", label: "Stats" },
  { value: "features", label: "Features" },
  { value: "product-grid", label: "Products" },
  { value: "category-grid", label: "Categories" },
  { value: "spacer", label: "Spacer" },
];

function PageRowItem({ row, active, onSelect }: { row: PageRow; active: boolean; onSelect: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect(); }}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem",
        padding: "0.6rem 0.7rem", borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: "0.85rem",
        border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
        background: active ? "var(--primary-subtle)" : "var(--surface)",
      }}
    >
      <span style={{ fontWeight: 600 }}>{row.title || row.slug}</span>
      <span style={{ fontSize: "0.68rem", color: row.is_published === 1 ? "var(--success-text)" : "var(--text-secondary)", background: row.is_published === 1 ? "var(--success-light)" : "var(--surface-hover)", padding: "0.15rem 0.5rem", borderRadius: "var(--radius-full)", fontWeight: 700 }}>
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

  useEffect(() => {
    let cancelled = false;
    getProducts().then((p) => { if (!cancelled) setProducts(p); }).catch(() => {});
    fetch("/api/categories").then((r) => r.json()).then((d) => { if (!cancelled) setCategories(d.categories || []); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function loadPages() {
    setLoading(true); setError("");
    try {
      const rows = await api<PageRow[]>("/api/admin/pages");
      setPages(rows || []);
    } catch (e: any) {
      setError(e.message || "Failed to load pages.");
    } finally {
      setLoading(false);
    }
  }

  async function createPage() {
    const raw = await promptDialog({ title: "New page", label: "Page title", placeholder: "e.g. Our Story", confirmLabel: "Create" });
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

  // Saves the current draft to the server. Returns true only when the save
  // actually succeeded; throws on a hard failure. Does not manage messages or
  // the saving spinner so both Save Draft and Publish can drive it.
  async function performSave(): Promise<boolean> {
    if (!selectedId) return false;
    const normalized = normalizeSlug(slug);
    if (!normalized) return false;
    const row = await api<PageRow>(`/api/admin/pages/${selectedId}`, {
      method: "PUT",
      body: JSON.stringify({ slug: normalized, title, description, config: { ...config, sections: config.sections || [] } }),
    });
    setSlug(row.slug);
    setTitle(row.title);
    setDescription(row.description || "");
    setConfig(row.config || DEFAULT_PAGE);
    setDirty(false);
    return true;
  }

  async function savePage() {
    if (!selectedId) return;
    setSaving(true); setMsg("");
    try {
      if (!normalizeSlug(slug)) { setMsg(SLUG_ERROR); return; }
      await performSave();
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
      if (dirty) {
        // Publishing is only allowed after the draft actually saves. A failed
        // save (invalid slug, collision, server error) must stop the publish.
        const saved = await performSave();
        if (!saved) {
          setMsg(normalizeSlug(slug) ? "Couldn't save your draft — fix the errors above, then publish again." : SLUG_ERROR);
          return;
        }
      } else {
        if (!normalizeSlug(slug)) { setMsg(SLUG_ERROR); return; }
        if (!title.trim()) { setMsg("Title is required before publishing."); return; }
      }
      await api<any>(`/api/admin/pages/${selectedId}`, {
        method: "PUT",
        body: JSON.stringify({ is_published: 1 }),
      });
      await loadPages();
      setDirty(false);
      setMsg("Page is live. Visit /pages/" + (normalizeSlug(slug) || slug) + " on your storefront.");
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
    const ok = await confirmDialog({
      title: "Delete this page?",
      message: `"${title || slug}" will be permanently deleted. This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setSaving(true); setMsg("");
    try {
      await api<any>(`/api/admin/pages/${selectedId}`, { method: "DELETE" });
      setSelectedId(null);
      await loadPages();
      setMsg("Page deleted.");
    } catch (e: any) { setMsg("Failed: " + e.message); }
    finally { setSaving(false); }
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

  function setHero(patch: any) {
    setConfig((prev: any) => ({ ...prev, hero: { ...(prev.hero || {}), ...patch } }));
    setDirty(true);
  }

  const hero = config.hero || {};
  // Hero presence is explicit: no hero key, disabled, or style "none" means no
  // hero is rendered (never an empty object treated as a configured hero).
  const heroActive = !!config.hero && config.hero.enabled !== false && config.hero.style !== "none";

  const viewProps: Omit<DynamicSectionViewProps, "section"> = {
    products,
    categories,
    colors: config.colors,
    cardConfig: config.productCard,
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: "1rem", alignItems: "start" }}>
      <style>{`
        .sb-edit-field { margin-bottom: 0.5rem; }
        .sb-item-card { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.5rem; margin-bottom: 0.5rem; }
      `}</style>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>Pages</h2>
          <RippleButton onClick={createPage} loading={saving}>＋ New</RippleButton>
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: "0 0 0.75rem" }}>
          Build custom pages (About, FAQ, landing pages…). Each gets its own public URL under /pages/.
        </p>
        {loading ? <Spinner /> : error ? <ErrorMsg msg={error} /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {pages.length === 0 && <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>No pages yet.</p>}
            {pages.map((p) => (
              <PageRowItem key={p.id} row={p} active={p.id === selectedId} onSelect={() => { setSelectedId(p.id); setSlug(p.slug); setTitle(p.title); setDescription(p.description || ""); setConfig(p.config || DEFAULT_PAGE); setDirty(false); }} />
            ))}
          </div>
        )}
      </div>

      {!selectedId ? (
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "0.75rem", color: "var(--text-tertiary)", fontSize: "0.85rem" }}>
          Select a page on the left to edit it, or create a new one.
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.75rem" }}>
            <RippleButton variant={dirty ? "primary" : "secondary"} onClick={savePage} loading={saving}>Save Draft</RippleButton>
            <RippleButton onClick={publish} loading={saving}>Publish</RippleButton>
            <RippleButton variant="danger" onClick={unpublish} loading={saving}>Unpublish</RippleButton>
            <RippleButton variant="danger" onClick={deletePage} loading={saving}>Delete</RippleButton>
            <a href={`/pages/${slug}`} target="_blank" rel="noopener" style={{ fontSize: "0.8rem" }}>View ↗</a>
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
                <button key={d} type="button" onClick={() => setDevice(d)} aria-pressed={device === d} style={{ padding: "0.4rem 0.7rem", fontSize: "0.75rem", border: "none", cursor: "pointer", fontWeight: 600, background: device === d ? "var(--primary)" : "transparent", color: device === d ? "var(--on-primary)" : "var(--text-secondary)" }}>{d}</button>
              ))}
            </div>
          </div>

          {tab !== "preview" && (
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "1rem", alignItems: "start" }}>
              <div>
                <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>Add section</h4>
                {SECTION_TYPES.map((t) => (
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

                <div className="sb-item-card">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                    <strong style={{ fontSize: "0.78rem" }}>Hero (top of page)</strong>
                    <span style={{ flex: 1 }} />
                    <Check label="Show" checked={hero.enabled !== false} onChange={(v) => setHero({ enabled: v })} />
                  </div>
                  {hero.enabled !== false && (
                    <>
                      <Field label="Style">
                        <Select
                          value={hero.style || "carousel"}
                          onChange={(v) => setHero({ style: v })}
                          options={[
                            { value: "carousel", label: "Carousel" },
                            { value: "split", label: "Split" },
                            { value: "minimal", label: "Minimal" },
                            { value: "none", label: "None" },
                          ]}
                        />
                      </Field>
                      <Field label="Badge"><Text value={hero.badge || ""} onChange={(v) => setHero({ badge: v })} placeholder="e.g. New arrivals" /></Field>
                      <Field label="Headline"><Text value={hero.headline || ""} onChange={(v) => setHero({ headline: v })} placeholder="Welcome to our store" /></Field>
                      <Field label="Subtitle"><Text value={hero.subtitle || ""} onChange={(v) => setHero({ subtitle: v })} /></Field>
                      <Field label="Button label"><Text value={hero.ctaText || ""} onChange={(v) => setHero({ ctaText: v })} placeholder="Shop now" /></Field>
                      <Field label="Button link"><Text value={hero.ctaLink || ""} onChange={(v) => setHero({ ctaLink: v })} placeholder="/" /></Field>
                    </>
                  )}
                </div>

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
                      <span className="drag-handle" style={{ cursor: "grab", color: "var(--text-tertiary)" }}>⋮⋮</span>
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
              <Field label="Hero background"><Color value={config.colors?.heroBg || ""} onChange={(v) => { setConfig((prev: any) => ({ ...prev, colors: { ...(prev.colors || {}), heroBg: v } })); setDirty(true); }} /></Field>
              <Field label="Hero text"><Color value={config.colors?.heroText || ""} onChange={(v) => { setConfig((prev: any) => ({ ...prev, colors: { ...(prev.colors || {}), heroText: v } })); setDirty(true); }} /></Field>
              <Check label="Show product ratings" checked={config.productCard?.showRating !== false} onChange={(v) => { setConfig((prev: any) => ({ ...prev, productCard: { ...(prev.productCard || {}), showRating: v } })); setDirty(true); }} />
            </div>
          )}

          {tab === "preview" && (
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
              <div style={{ background: "var(--surface-hover)", padding: "0.4rem 0.75rem", fontSize: "0.75rem", color: "var(--text-secondary)" }}>/pages/{slug} · {device}</div>
              <div style={{ maxHeight: "65vh", overflow: "auto" }}>
                {(config.sections || []).length === 0 && !heroActive && <p style={{ padding: "2rem", textAlign: "center", color: "var(--text-tertiary)", fontSize: "0.85rem" }}>Nothing to preview yet.</p>}
                {heroActive && <HeroSection hero={config.hero} colors={config.colors} products={products} categories={categories} forceTrigger={undefined} />}
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