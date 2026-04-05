import React from "react";

const ICONS: Record<string, string> = {
  products: "\uD83D\uDCE6",
  orders: "\uD83D\uDCCB",
  staff: "\uD83D\uDC65",
  categories: "\uD83D\uDCC1",
  reports: "\uD83D\uDCCA",
  customers: "\uD83D\uDC64",
  messages: "\u2709\uFE0F",
  audit: "\uD83D\uDD0D",
  stock: "\uD83D\uDCE6",
  repairs: "\uD83D\uDD27",
  plans: "\uD83D\uDCCB",
  invoices: "\uD83E\uDDFE",
  default: "\uD83D\uDCE6",
};

export default function EmptyState({
  icon = "default",
  title = "Nothing here yet",
  description = "There are no items to display at the moment.",
  actionLabel,
  onAction,
}: {
  icon?: string;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{ICONS[icon] || ICONS.default}</div>
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-desc">{description}</div>
      {actionLabel && onAction && (
        <button className="btn" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
