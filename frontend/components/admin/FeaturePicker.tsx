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
      "Low stock alerts", "Stock take / inventory count", "Stock transfers",
      "Supplier management", "Purchase order management", "Barcode scanning",
      "Bulk import/export", "Bulk product edit", "Inventory forecasting",
    ],
  },
  {
    group: "Invoicing & Finance",
    icon: "receipt",
    features: [
      "eTIMS/KRA compliance", "Invoice/quote PDF downloads", "Credit notes",
      "Quotations", "Price history tracking",
    ],
  },
  {
    group: "Repairs & Service",
    icon: "wrench",
    features: [
      "Repair ticketing", "Technician accounts",
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
    ],
  },
  {
    group: "Analytics & Security",
    icon: "chart",
    features: [
      "Analytics dashboard", "Audit log", "Visitor analytics",
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
}

export default function FeaturePicker({ selected, onChange }: FeaturePickerProps) {
  const toggle = (f: string) =>
    onChange(selected.includes(f) ? selected.filter((x) => x !== f) : [...selected, f]);

  const toggleGroup = (group: string[], allOn: boolean) =>
    onChange(allOn
      ? selected.filter((f) => !group.includes(f))
      : [...new Set([...selected, ...group])]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "60vh", overflowY: "auto", paddingRight: "0.25rem" }}>
      {FEATURE_GROUPS.map((grp) => {
        const allOn = grp.features.every((f) => selected.includes(f));
        const someOn = grp.features.some((f) => selected.includes(f)) && !allOn;
        return (
          <details key={grp.group} open style={{ border: "1px solid var(--border)", borderRadius: 8 }}>
            <summary style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", cursor: "pointer", background: someOn || allOn ? "var(--primary-subtle)" : "var(--bg)", fontWeight: 600, fontSize: "0.9rem", listStyle: "none", userSelect: "none" }}>
              <span style={{ fontSize: "0.7rem", opacity: 0.5, transition: "transform 0.2s", transform: someOn || allOn ? "rotate(90deg)" : "none" }}>&#9654;</span>
              <span style={{ display: "inline-flex", color: "var(--primary)" }}><Icon name={grp.icon} size={16} /></span>
              <span style={{ flex: 1 }}>{grp.group}</span>
              <span style={{ fontSize: "0.75rem", fontWeight: 400, opacity: 0.6 }}>{grp.features.filter((f) => selected.includes(f)).length}/{grp.features.length}</span>
              <label style={{ fontSize: "0.75rem", fontWeight: 400, padding: "0.1rem 0.4rem", borderRadius: 4, background: allOn ? "var(--primary)" : "var(--border)", color: allOn ? "var(--surface)" : "var(--text)", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); }}>
                <input type="checkbox" checked={allOn} onChange={() => toggleGroup(grp.features, allOn)} style={{ display: "none" }} />
                {allOn ? "All" : "Select all"}
              </label>
            </summary>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", padding: "0.5rem 0.75rem 0.75rem" }}>
              {grp.features.map((f) => (
                <label key={f} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.82rem", cursor: "pointer", padding: "0.2rem 0.5rem", borderRadius: 6, background: selected.includes(f) ? "var(--primary)" : "var(--bg)", color: selected.includes(f) ? "var(--surface)" : "var(--text)", border: "1px solid " + (selected.includes(f) ? "var(--primary)" : "var(--border)") }}>
                  <input type="checkbox" checked={selected.includes(f)} onChange={() => toggle(f)} style={{ display: "none" }} />
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
