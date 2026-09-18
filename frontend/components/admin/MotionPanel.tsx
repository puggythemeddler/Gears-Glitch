import React from "react";
import RippleButton from "@/components/RippleButton";
import {
  MOTION_PRESETS,
  MOTION_TRIGGERS,
  MOTION_EASINGS,
  MOTION_DIRECTIONS,
  MOTION_LIMITS,
  PRESET_LABELS,
  PRESET_CATEGORY,
  MotionConfig,
  MotionCategory,
  normalizeMotionConfig,
  normalizeMotionConfigSafe,
  clampNumber,
} from "@/lib/motion";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label style={{ display: "block", marginBottom: "0.75rem" }}>
    <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
    {children}
  </label>
);

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.6rem", fontSize: "0.85rem", borderRadius: 6,
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
};

const Num = ({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) => (
  <input type="number" style={inputStyle} value={value ?? ""} min={min} max={max} onChange={(e) => onChange(parseInt(e.target.value || "0", 10))} />
);

const CATEGORY_ORDER: MotionCategory[] = ["entrance", "interaction", "infinite", "editorial"];
const CATEGORY_LABELS: Record<MotionCategory, string> = {
  entrance: "Entrance",
  interaction: "On hover / click",
  infinite: "Looping",
  editorial: "Editorial",
};

export default function MotionPanel({
  value,
  onChange,
  onPreview,
}: {
  value?: unknown;
  onChange: (v: MotionConfig | null) => void;
  onPreview?: () => void;
}) {
  const conf = normalizeMotionConfig(value);
  const enabled = !!conf && !!value;
  const category = conf ? PRESET_CATEGORY[conf.preset] : null;

  const set = (patch: Partial<MotionConfig>) => onChange({ ...(conf || normalizeMotionConfigSafe(null, "fade-up")), ...patch });

  if (!enabled || !conf || !category) {
    return (
      <div>
        <RippleButton size="small" onClick={() => onChange(normalizeMotionConfigSafe(conf, "fade-up"))}>+ Add motion effect</RippleButton>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Motion effect</span>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {onPreview && <RippleButton size="small" variant="secondary" onClick={onPreview}>Preview</RippleButton>}
          <RippleButton size="small" variant="danger" onClick={() => onChange(null)}>Remove</RippleButton>
        </div>
      </div>

      <Field label="Preset">
        <select style={inputStyle} value={conf.preset} onChange={(e) => set({ preset: e.target.value as MotionConfig["preset"] })}>
          {CATEGORY_ORDER.map((cat) => (
            <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
              {MOTION_PRESETS.filter((p) => PRESET_CATEGORY[p] === cat).map((p) => (
                <option key={p} value={p}>{PRESET_LABELS[p]}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      {category === "entrance" && (
        <Field label="When">
          <select style={inputStyle} value={conf.trigger} onChange={(e) => set({ trigger: e.target.value as MotionConfig["trigger"] })}>
            {MOTION_TRIGGERS.map((t) => <option key={t} value={t}>{t === "viewport" ? "Enters the viewport" : "When the page loads"}</option>)}
          </select>
        </Field>
      )}

      {(category === "entrance" || category === "interaction") && (
        <Field label="Duration (ms)">
          <Num value={conf.duration} min={MOTION_LIMITS.duration.min} max={MOTION_LIMITS.duration.max} onChange={(v) => set({ duration: clampNumber(v, MOTION_LIMITS.duration.min, MOTION_LIMITS.duration.max, MOTION_LIMITS.duration.def) })} />
        </Field>
      )}

      {category === "entrance" && (
        <>
          <Field label="Delay (ms)">
            <Num value={conf.delay} min={MOTION_LIMITS.delay.min} max={MOTION_LIMITS.delay.max} onChange={(v) => set({ delay: clampNumber(v, MOTION_LIMITS.delay.min, MOTION_LIMITS.delay.max, MOTION_LIMITS.delay.def) })} />
          </Field>
          <Field label="Direction">
            <select style={inputStyle} value={conf.direction} onChange={(e) => set({ direction: e.target.value as MotionConfig["direction"] })}>
              {MOTION_DIRECTIONS.map((d) => <option key={d} value={d}>{d === "normal" ? "Normal" : "Reversed"}</option>)}
            </select>
          </Field>
        </>
      )}

      <Field label="Easing">
        <select style={inputStyle} value={conf.easing} onChange={(e) => set({ easing: e.target.value as MotionConfig["easing"] })}>
          {MOTION_EASINGS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>

      {(category === "entrance" || category === "infinite") && (
        <Field label="Repeat (extra times)">
          <Num value={conf.repeat} min={MOTION_LIMITS.repeat.min} max={MOTION_LIMITS.repeat.max} onChange={(v) => set({ repeat: clampNumber(v, MOTION_LIMITS.repeat.min, MOTION_LIMITS.repeat.max, MOTION_LIMITS.repeat.def) })} />
        </Field>
      )}

      {conf.preset === "stagger" && (
        <Field label="Stagger (ms between items)">
          <Num value={conf.stagger} min={MOTION_LIMITS.stagger.min} max={MOTION_LIMITS.stagger.max} onChange={(v) => set({ stagger: clampNumber(v, MOTION_LIMITS.stagger.min, MOTION_LIMITS.stagger.max, MOTION_LIMITS.stagger.def) })} />
        </Field>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
        <input type="checkbox" checked={conf.mobile !== false} onChange={(e) => set({ mobile: e.target.checked })} />
        Animate on small screens
      </label>

      <Field label="Reduced motion">
        <select style={inputStyle} value={conf.reducedMotion} onChange={(e) => set({ reducedMotion: e.target.value as MotionConfig["reducedMotion"] })}>
          <option value="respect">Respect user preference</option>
          <option value="disable">Always show static</option>
        </select>
      </Field>
    </div>
  );
}
