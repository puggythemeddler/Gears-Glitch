import React from "react";

type Tone = "default" | "success" | "warning" | "danger" | "info";

interface StatusMeta {
  label: string;
  tone: Tone;
}

const REPAIR_STATUS: Record<string, StatusMeta> = {
  received: { label: "Received", tone: "info" },
  diagnosing: { label: "Diagnosing", tone: "warning" },
  waiting_parts: { label: "Waiting for parts", tone: "warning" },
  in_progress: { label: "In progress", tone: "info" },
  quality_check: { label: "Quality check", tone: "info" },
  ready: { label: "Ready for collection", tone: "success" },
  collected: { label: "Collected", tone: "default" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

const ORDER_STATUS: Record<string, StatusMeta> = {
  pending: { label: "Pending", tone: "warning" },
  processing: { label: "Processing", tone: "info" },
  paid: { label: "Paid", tone: "success" },
  shipped: { label: "Shipped", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  refunded: { label: "Refunded", tone: "danger" },
};

const QUOTE_STATUS: Record<string, StatusMeta> = {
  pending: { label: "Pending", tone: "warning" },
  waiting_for_approval: { label: "Waiting for approval", tone: "info" },
  approved: { label: "Approved", tone: "success" },
  converted: { label: "Converted", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

const WARRANTY_STATUS: Record<string, StatusMeta> = {
  active: { label: "Active", tone: "success" },
  expiring: { label: "Expiring soon", tone: "warning" },
  expired: { label: "Expired", tone: "danger" },
};

const QUOTE_RESPONSE: Record<string, StatusMeta> = {
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
};

const FINANCING_APPLICATION_STATUS: Record<string, StatusMeta> = {
  draft: { label: "Draft", tone: "default" },
  submitted: { label: "Submitted", tone: "warning" },
  under_review: { label: "Under review", tone: "info" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "danger" },
  expired: { label: "Expired", tone: "default" },
};

const FINANCING_AGREEMENT_STATUS: Record<string, StatusMeta> = {
  draft: { label: "Draft", tone: "default" },
  active: { label: "Active", tone: "success" },
  restructured: { label: "Restructured", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  defaulted: { label: "Defaulted", tone: "danger" },
};

const FINANCING_SCHEDULE_STATUS: Record<string, StatusMeta> = {
  pending: { label: "Pending", tone: "default" },
  due: { label: "Due", tone: "warning" },
  partially_paid: { label: "Part paid", tone: "info" },
  paid: { label: "Paid", tone: "success" },
  overdue: { label: "Overdue", tone: "danger" },
  waived: { label: "Waived", tone: "default" },
  cancelled: { label: "Cancelled", tone: "default" },
};

const FINANCING_PAYMENT_STATUS: Record<string, StatusMeta> = {
  initiated: { label: "Initiated", tone: "info" },
  pending: { label: "Pending", tone: "warning" },
  succeeded: { label: "Succeeded", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  reversed: { label: "Reversed", tone: "danger" },
  refunded: { label: "Refunded", tone: "danger" },
};

const FINANCING_POSSESSION_STATUS: Record<string, StatusMeta> = {
  not_released: { label: "Not released", tone: "warning" },
  released: { label: "Released", tone: "success" },
  returned: { label: "Returned", tone: "default" },
};

const DOMAINS: Record<string, Record<string, StatusMeta>> = {
  repairs: REPAIR_STATUS,
  orders: ORDER_STATUS,
  quotes: QUOTE_STATUS,
  warranty: WARRANTY_STATUS,
  quoteResponse: QUOTE_RESPONSE,
  financingApplication: FINANCING_APPLICATION_STATUS,
  financingAgreement: FINANCING_AGREEMENT_STATUS,
  financingSchedule: FINANCING_SCHEDULE_STATUS,
  financingPayment: FINANCING_PAYMENT_STATUS,
  financingPossession: FINANCING_POSSESSION_STATUS,
};

function humanize(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function statusMeta(domain: string, status: string): StatusMeta {
  const known = DOMAINS[domain]?.[status];
  if (known) return known;
  return { label: humanize(status || "—"), tone: "default" };
}

export function StatusBadge({ status, domain = "orders", className = "" }: { status: string; domain?: string; className?: string }) {
  const meta = statusMeta(domain, status);
  return (
    <span className={`badge badge-${meta.tone}${className ? " " + className : ""}`}>
      {meta.label}
    </span>
  );
}
