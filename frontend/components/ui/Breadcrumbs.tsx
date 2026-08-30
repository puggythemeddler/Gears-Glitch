import React from "react";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, ariaLabel = "Breadcrumb" }: { items: Crumb[]; ariaLabel?: string }) {
  return (
    <nav className="breadcrumbs" aria-label={ariaLabel}>
      <ol>
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`}>
            {item.href ? (
              <a href={item.href}>{item.label}</a>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
