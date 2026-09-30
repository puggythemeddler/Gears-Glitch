import React from "react";
export { default as RippleButton } from "@/components/RippleButton";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: "0.75rem" }}>
      <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      {children}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.6rem", fontSize: "0.85rem", borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
};

export function Text({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input style={inputStyle} value={value || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Num({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return <input type="number" style={inputStyle} value={value ?? ""} min={min} max={max} onChange={(e) => onChange(parseInt(e.target.value || "0", 10))} />;
}

export function Color({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="color" style={{ width: "100%", height: 36, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "none", cursor: "pointer", padding: 2 }} value={value || "#c2410c"} onChange={(e) => onChange(e.target.value)} />;
}

export function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select style={inputStyle} value={value || ""} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}