import React from "react";

export interface TabItem {
  key: string;
  label: string;
}

export function Tabs({
  tabs,
  active,
  onChange,
  ariaLabel,
  className = "",
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={`ui-tabs${className ? " " + className : ""}`} role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          className={`ui-tab${active === t.key ? " active" : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
