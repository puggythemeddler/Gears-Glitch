import React, { useMemo, useState } from "react";
import RippleButton from "@/components/RippleButton";
import { Field, Text, inputStyle } from "./studio-ui";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABELS,
  searchTemplates,
} from "@/lib/templates";
import type { StorefrontTemplate, TemplateCategory } from "@/lib/templates";

type Device = "desktop" | "tablet" | "mobile";

interface TemplateGalleryProps {
  templates: StorefrontTemplate[];
  /** Template most recently applied in this session (shows the revert affordance). */
  appliedTemplateId?: string | null;
  canRevert?: boolean;
  financingEnabled?: boolean;
  device?: Device;
  onApply: (template: StorefrontTemplate) => void;
  onRevert?: () => void;
}

function SectionGlyph({ type }: { type: string }) {
  switch (type) {
    case "product-grid":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
          {[0, 1, 2].map((i) => <span key={i} style={{ height: 14, borderRadius: 3, background: "var(--surface-hover)" }} />)}
        </div>
      );
    case "category-grid":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3 }}>
          {[0, 1, 2, 3].map((i) => <span key={i} style={{ height: 10, borderRadius: 999, background: "var(--surface-hover)" }} />)}
        </div>
      );
    case "banner":
      return <span style={{ display: "block", height: 12, borderRadius: 3, background: "var(--surface-hover)" }} />;
    case "stats":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
          {[0, 1, 2].map((i) => <span key={i} style={{ height: 10, borderRadius: 3, background: "var(--surface-hover)" }} />)}
        </div>
      );
    case "features":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
          {[0, 1, 2].map((i) => <span key={i} style={{ height: 12, borderRadius: 3, background: "var(--surface-hover)" }} />)}
        </div>
      );
    case "image":
      return <span style={{ display: "block", height: 20, borderRadius: 3, background: "var(--surface-hover)" }} />;
    case "text":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ height: 6, width: "55%", borderRadius: 3, background: "var(--surface-hover)" }} />
          <span style={{ height: 6, width: "80%", borderRadius: 3, background: "var(--surface-hover)" }} />
        </div>
      );
    default:
      return <span style={{ display: "block", height: 8, width: "45%", borderRadius: 3, background: "var(--surface-hover)" }} />;
  }
}

function TemplatePreview({ template }: { template: StorefrontTemplate }) {
  const { palette } = template;
  const sections = template.config.sections ?? [];
  return (
    <div
      aria-hidden="true"
      style={{
        background: palette.bg,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "0.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
        minHeight: 132,
      }}
    >
      <div style={{ background: palette.accent, color: palette.accentText, borderRadius: 3, padding: "0.4rem 0.5rem" }}>
        <span style={{ display: "block", height: 6, width: "60%", borderRadius: 3, background: palette.accentText, opacity: 0.9 }} />
      </div>
      {sections.slice(0, 4).map((s, i) => (
        <SectionGlyph key={i} type={s.type} />
      ))}
    </div>
  );
}

export default function TemplateGallery({
  templates,
  appliedTemplateId,
  canRevert,
  financingEnabled,
  device,
  onApply,
  onRevert,
}: TemplateGalleryProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TemplateCategory | "all">("all");

  const results = useMemo(
    () => searchTemplates(templates, { query, category }),
    [templates, query, category],
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
        <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.85rem" }}>Template library</h4>
        {appliedTemplateId && canRevert && onRevert && (
          <RippleButton size="small" variant="secondary" onClick={onRevert}>Revert last apply</RippleButton>
        )}
      </div>
      <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", margin: "0 0 0.75rem" }}>
        Applying a template replaces this draft&apos;s hero and sections with a starter design.
        Your products, prices, orders and customers are never changed.
        {device && device !== "desktop" ? ` Previewing at ${device}.` : ""}
      </p>

      <Field label="Search templates">
        <Text value={query} onChange={setQuery} placeholder="Minimal, sale, tech…" />
      </Field>

      <div role="group" aria-label="Filter templates by category" style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", margin: "0.5rem 0 0.75rem" }}>
        <button
          type="button"
          aria-pressed={category === "all"}
          onClick={() => setCategory("all")}
          style={{ ...categoryChip, ...(category === "all" ? categoryChipActive : {}) }}
        >
          All
        </button>
        {TEMPLATE_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            style={{ ...categoryChip, ...(category === c ? categoryChipActive : {}) }}
          >
            {TEMPLATE_CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>No templates match that search.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.75rem" }}>
          {results.map((t) => {
            const locked = t.requiresEntitlement === "financing" && !financingEnabled;
            const applied = appliedTemplateId === t.id;
            return (
              <article
                key={t.id}
                style={{
                  border: applied ? "2px solid var(--primary)" : "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.6rem",
                  background: "var(--bg)",
                }}
              >
                <TemplatePreview template={t} />
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.5rem" }}>
                  <strong style={{ fontSize: "0.88rem" }}>{t.name}</strong>
                  <span className="badge" style={{ fontSize: "0.62rem", padding: "0.05rem 0.35rem" }}>{TEMPLATE_CATEGORY_LABELS[t.category]}</span>
                  {applied && <span className="badge badge-success" style={{ fontSize: "0.62rem" }}>Applied</span>}
                </div>
                <p style={{ margin: "0.2rem 0 0.35rem", fontSize: "0.78rem", color: "var(--text-secondary)" }}>{t.tagline}</p>
                <p style={{ margin: "0 0 0.5rem", fontSize: "0.72rem", color: "var(--text-tertiary)" }}>{t.description}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.4rem" }}>
                  <span style={{ fontSize: "0.66rem", color: "var(--text-tertiary)" }}>Original · Gears&amp;Glitch v{t.version}</span>
                  <RippleButton
                    size="small"
                    variant={applied ? "secondary" : "primary"}
                    disabled={locked}
                    aria-label={locked ? `${t.name} requires the financing add-on` : `Apply ${t.name} template`}
                    onClick={() => onApply(t)}
                  >
                    {locked ? "Needs financing" : applied ? "Re-apply" : "Apply"}
                  </RippleButton>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

const categoryChip: React.CSSProperties = {
  padding: "0.25rem 0.6rem",
  fontSize: "0.72rem",
  fontWeight: 600,
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-secondary)",
  cursor: "pointer",
};
const categoryChipActive: React.CSSProperties = {
  background: "var(--primary-subtle)",
  borderColor: "var(--primary)",
  color: "var(--primary)",
};

// Exported for the Studio's palette-search styling parity when needed.
export const TEMPLATE_GALLERY_INPUT_STYLE = inputStyle;
