import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import RippleButton from "@/components/RippleButton";
import { escapeHtml, Spinner } from "./shared";

export interface Warranty {
  orderItemId: number;
  orderId: number;
  productId: string;
  productName: string;
  serialNumber: string;
  customerId: number;
  customerName: string;
  startDate: string | null;
  expiryDate: string | null;
  durationMonths: number;
  daysLeft: number | null;
  status: "active" | "expiring" | "expired";
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  const first = String(s).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(first)) {
    const [y, m, d] = first.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB");
  }
  return new Date(s).toLocaleDateString("en-GB");
}

export default function AdminWarranties({ customerId, embedded = false }: { customerId?: number; embedded?: boolean }) {
  const [warranties, setWarranties] = useState<Warranty[] | null>(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Warranty | null>(null);

  useEffect(() => {
    let cancelled = false;
    setWarranties(null);
    setError("");
    api<{ warranties: Warranty[] }>("/api/admin/warranties")
      .then((d) => { if (!cancelled) setWarranties(d.warranties || []); })
      .catch((e: any) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const scoped = useMemo(() => {
    let list = warranties || [];
    if (customerId) list = list.filter((w) => w.customerId === customerId);
    return list;
  }, [warranties, customerId]);

  const filtered = useMemo(() => {
    let list = scoped;
    if (statusFilter) list = list.filter((w) => w.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((w) =>
        w.productName.toLowerCase().includes(q) ||
        w.customerName.toLowerCase().includes(q) ||
        w.serialNumber.toLowerCase().includes(q)
      );
    }
    return list;
  }, [scoped, statusFilter, search]);

  const counts = useMemo(() => ({
    active: scoped.filter((w) => w.status === "active").length,
    expiring: scoped.filter((w) => w.status === "expiring").length,
    expired: scoped.filter((w) => w.status === "expired").length,
  }), [scoped]);

  if (error) {
    return (
      <>
        {!embedded && <h1>Warranty</h1>}
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </>
    );
  }

  return (
    <>
      {!embedded && (
        <>
          <h1>Warranty</h1>
          <p className="page-intro">Coverage attached to sold items — see what is active, what is expiring, and what has lapsed.</p>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-card__value" style={{ color: "var(--success)" }}>{counts.active}</div><div className="stat-card__label">Active</div></div>
            <div className="stat-card"><div className="stat-card__value" style={{ color: "var(--warning)" }}>{counts.expiring}</div><div className="stat-card__label">Expiring within 30 days</div></div>
            <div className="stat-card"><div className="stat-card__value" style={{ color: "var(--danger)" }}>{counts.expired}</div><div className="stat-card__label">Expired</div></div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", margin: "0.5rem 0 1rem" }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="expiring">Expiring soon</option>
              <option value="expired">Expired</option>
            </select>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, customer, serial…" aria-label="Search warranties" style={{ minWidth: 220 }} />
            <span className="muted">{filtered.length} warrant{filtered.length === 1 ? "y" : "ies"}</span>
          </div>
        </>
      )}

      {warranties === null ? <Spinner /> : (
        <DataTable
          ariaLabel="Warranties"
          rows={filtered}
          rowKey={(w) => w.orderItemId}
          defaultSort={{ key: "expiry", dir: "asc" }}
          columns={[
            {
              key: "product", label: "Product",
              render: (w) => (
                <>
                  {escapeHtml(w.productName)}
                  {w.serialNumber && <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>SN {escapeHtml(w.serialNumber)}</span>}
                </>
              ),
            },
            { key: "customer", label: "Customer", render: (w) => escapeHtml(w.customerName) },
            { key: "order", label: "Order", render: (w) => `#${w.orderId}` },
            { key: "start", label: "Purchased", value: (w) => w.startDate || "", render: (w) => fmtDate(w.startDate) },
            { key: "duration", label: "Coverage", align: "right", render: (w) => `${w.durationMonths} mo` },
            { key: "expiry", label: "Expires", value: (w) => w.expiryDate || "", render: (w) => fmtDate(w.expiryDate) },
            { key: "status", label: "Status", render: (w) => <StatusBadge status={w.status} domain="warranty" /> },
            {
              key: "actions", label: "",
              render: (w) => (
                <RippleButton size="small" variant="ghost" onClick={() => setSelected(selected?.orderItemId === w.orderItemId ? null : w)}>
                  {selected?.orderItemId === w.orderItemId ? "Close" : "View"}
                </RippleButton>
              ),
            },
          ]}
          empty={<EmptyState icon="warranty" title="No warranties yet" description="Warranties appear here when sold items include warranty coverage. Set warranty on a product, then sell it with warranty ticked at checkout or on the order." />}
        />
      )}

      {selected && (
        <div className="panel" style={{ marginTop: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ minWidth: 0, maxWidth: "70ch" }}>
              <h3 style={{ margin: 0 }}>{escapeHtml(selected.productName)}</h3>
              {selected.serialNumber && <p className="muted" style={{ margin: "0.25rem 0 0" }}>Serial {escapeHtml(selected.serialNumber)}</p>}
            </div>
            <StatusBadge status={selected.status} domain="warranty" />
          </div>

          <ul className="coverage-list" style={{ marginTop: "1rem" }}>
            <li><span className="coverage-label">Customer</span><span className="coverage-value">{escapeHtml(selected.customerName)}</span></li>
            <li><span className="coverage-label">Product</span><span className="coverage-value">{escapeHtml(selected.productName)}</span></li>
            <li><span className="coverage-label">Serial number</span><span className="coverage-value">{selected.serialNumber ? escapeHtml(selected.serialNumber) : "—"}</span></li>
            <li><span className="coverage-label">Order</span><span className="coverage-value">#{selected.orderId} · purchased {fmtDate(selected.startDate)}</span></li>
            <li><span className="coverage-label">Coverage</span><span className="coverage-value">{selected.durationMonths} months from purchase</span></li>
            <li><span className="coverage-label">Start</span><span className="coverage-value">{fmtDate(selected.startDate)}</span></li>
            <li><span className="coverage-label">Expiry</span><span className="coverage-value">{fmtDate(selected.expiryDate)}</span></li>
            <li>
              <span className="coverage-label">Remaining</span>
              <span className="coverage-value">
                {selected.daysLeft == null ? "—" : selected.daysLeft < 0 ? `Expired ${Math.abs(selected.daysLeft)} day${Math.abs(selected.daysLeft) === 1 ? "" : "s"} ago` : `${selected.daysLeft} day${selected.daysLeft === 1 ? "" : "s"}`}
              </span>
            </li>
          </ul>
        </div>
      )}
    </>
  );
}
