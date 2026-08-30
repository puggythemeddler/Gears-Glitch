import React from "react";
import Icon from "@/components/icons";

const ICONS: Record<string, string> = {
  products: "box",
  orders: "fileText",
  staff: "users",
  categories: "folder",
  reports: "chart",
  customers: "users",
  messages: "message",
  audit: "search",
  stock: "boxes",
  repairs: "wrench",
  plans: "layers",
  invoices: "receipt",
  quotes: "fileText",
  serials: "hash",
  warranty: "shieldCheck",
  inbox: "inbox",
  default: "inbox",
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
      <div className="empty-state-icon"><Icon name={ICONS[icon] || ICONS.default} size={28} /></div>
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-desc">{description}</div>
      {actionLabel && onAction && (
        <button className="btn btn-secondary btn-sm" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
