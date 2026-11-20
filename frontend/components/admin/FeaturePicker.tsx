import React from "react";
import Icon from "@/components/icons";

// Master catalog of storefront/admin features, grouped for plan and role editors.
// `icon` is a name from components/icons.tsx.
export const FEATURE_GROUPS = [
  {
    group: "Core Commerce",
    icon: "creditCard",
    features: [
      "Product listing", "Order management", "POS integration",
      "Payment method configuration", "M-Pesa integration",
      "Discount/coupon management", "Returns management", "Customer management",
      "Gift cards",
    ],
  },
  {
    group: "Inventory & Stock",
    icon: "boxes",
    features: [
      "Low stock alerts", "Stock take", "Stock control", "Stock transfers",
      "Supplier management", "Purchase order management", "Barcode scanning",
      "Bulk import/export", "Bulk product edit", "Inventory forecasting",
    ],
  },
  {
    group: "Invoicing & Finance",
    icon: "receipt",
    features: [
      "Tax invoices with VAT breakdown", "eTIMS/KRA compliance", "Invoice/quote PDF downloads", "Credit notes",
      "Quotations", "Price history tracking",
    ],
  },
  {
    group: "Financing",
    icon: "card",
    features: [
      "Lipa Mdogo Mdogo",
    ],
  },
  {
    group: "Repairs & Service",
    icon: "wrench",
    features: [
      "Repair ticketing", "Warranty management", "Serial number tracking",
      "Software license tracking", "Technician accounts", "Service catalogue",
    ],
  },
  {
    group: "Customer Engagement",
    icon: "message",
    features: [
      "Messaging", "Admin messaging", "Email notifications",
      "SMS notifications", "Product reviews & ratings",
      "Customer reviews", "Loyalty program",
    ],
  },
  {
    group: "WhatsApp & Communication",
    icon: "smartphone",
    features: [
      "WhatsApp integration",
    ],
  },
  {
    group: "Multi-Location",
    icon: "building",
    features: [
      "Branch management", "Multi-branch support", "Client/tenant management",
    ],
  },
  {
    group: "Marketing & Storefront",
    icon: "globe",
    features: [
      "Product positioning", "Hero customization", "Theme customization",
      "Custom branding", "Shop subscription", "Campaign pages", "Cart recovery",
      "Custom pages & landing pages",
    ],
  },
  {
    group: "Analytics & Security",
    icon: "chart",
    features: [
      "Analytics dashboard", "Audit log", "Visitor analytics", "Database backup and export",
    ],
  },
  {
    group: "Support & Account",
    icon: "shield",
    features: [
      "Google Sign-In", "Multiple staff accounts", "Spec templates",
      "Priority support", "Dedicated account manager",
    ],
  },
  {
    group: "Payments & Currency",
    icon: "card",
    features: [
      "Multi-currency support", "API access",
    ],
  },
];

export function allFeatureNames(): string[] {
  return FEATURE_GROUPS.flatMap((g) => g.features);
}

interface FeaturePickerProps {
  selected: string[];
  onChange: (next: string[]) => void;
  availableFeatures?: string[];
}

export default function FeaturePicker({ selected, onChange, availableFeatures }: FeaturePickerProps) {
  const [search, setSearch] = React.useState("");
  const [openGroups, setOpenGroups] = React.useState<Set<string>>(() => new Set());
  const query = search.trim().toLowerCase();
  const availableSet = availableFeatures ? new Set(availableFeatures.map((feature) => feature.toLowerCase().trim())) : null;
  const canSelect = (feature: string) => !availableSet || availableSet.has(feature.toLowerCase().trim());
  const availableCount = FEATURE_GROUPS.flatMap((group) => group.features).filter(canSelect).length;
  const toggle = (f: string) =>
    onChange(selected.includes(f) ? selected.filter((x) => x !== f) : [...selected, f]);

  const toggleGroup = (group: string[], allOn: boolean) =>
    onChange(allOn
      ? selected.filter((f) => !group.includes(f))
      : [...new Set([...selected, ...group])]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "60vh", overflowY: "auto", paddingRight: "0.25rem" }}>
      <label style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--surface)", padding: "0.25rem 0" }}>
        <span className="sr-only">Search plan features</span>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search features…" aria-label="Search plan features" style={{ width: "100%" }} />
        <span style={{ display: "block", marginTop: "0.25rem", fontSize: "0.75rem", opacity: 0.7 }} aria-live="polite">{selected.filter(canSelect).length} selected · {availableCount} available</span>
      </label>
      {FEATURE_GROUPS.map((grp) => {
        const availableGroup = grp.features.filter(canSelect);
        const visibleFeatures = availableGroup.filter((feature) => !query || feature.toLowerCase().includes(query));
        if (visibleFeatures.length === 0) return null;
        const allOn = availableGroup.length > 0 && availableGroup.every((f) => selected.includes(f));
        const someOn = availableGroup.some((f) => selected.includes(f)) && !allOn;
        return (
          <details key={grp.group} open={Boolean(query) || openGroups.has(grp.group)} onToggle={(event) => setOpenGroups((current) => {
            const next = new Set(current);
            if (event.currentTarget.open) next.add(grp.group); else next.delete(grp.group);
            return next;
          })} style={{ border: "1px solid var(--border)", borderRadius: 8 }}>
            <summary style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", cursor: "pointer", background: someOn || allOn ? "var(--primary-subtle)" : "var(--bg)", fontWeight: 600, fontSize: "0.9rem", listStyle: "none", userSelect: "none" }}>
              <span style={{ fontSize: "0.7rem", opacity: 0.5, transition: "transform 0.2s", transform: someOn || allOn ? "rotate(90deg)" : "none" }}>&#9654;</span>
              <span style={{ display: "inline-flex", color: "var(--primary)" }}><Icon name={grp.icon} size={16} /></span>
              <span style={{ flex: 1 }}>{grp.group}</span>
              <span style={{ fontSize: "0.75rem", fontWeight: 400, opacity: 0.6 }}>{availableGroup.filter((f) => selected.includes(f)).length}/{availableGroup.length}</span>
              <label className="feature-chip" style={{ fontSize: "0.75rem", fontWeight: 400, padding: "0.1rem 0.4rem", borderRadius: "var(--radius-sm)", background: allOn ? "var(--primary)" : "var(--border)", color: allOn ? "var(--on-primary)" : "var(--text)", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); }}>
                <input type="checkbox" className="sr-only" aria-label={`Select all ${grp.group} features`} checked={allOn} onChange={() => toggleGroup(availableGroup, allOn)} />
                {allOn ? "All" : "Select all"}
              </label>
            </summary>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", padding: "0.5rem 0.75rem 0.75rem" }}>
              {visibleFeatures.map((f) => (
                <label key={f} className="feature-chip" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.82rem", cursor: "pointer", padding: "0.2rem 0.5rem", borderRadius: "var(--radius-sm)", background: selected.includes(f) ? "var(--primary)" : "var(--bg)", color: selected.includes(f) ? "var(--on-primary)" : "var(--text)", border: "1px solid " + (selected.includes(f) ? "var(--primary)" : "var(--border)") }}>
                  <input type="checkbox" className="sr-only" checked={selected.includes(f)} onChange={() => toggle(f)} />
                  {f}
                </label>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
