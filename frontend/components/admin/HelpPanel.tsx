import React from "react";

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "?", action: "Open this help panel" },
  { keys: "g then d", action: "Go to Dashboard" },
  { keys: "g then p", action: "Go to Products" },
  { keys: "g then o", action: "Go to Orders" },
  { keys: "g then c", action: "Go to Customers" },
  { keys: "g then u", action: "Go to Users" },
  { keys: "g then r", action: "Go to Repairs" },
  { keys: "g then s", action: "Go to Stock on Hand" },
  { keys: "g then i", action: "Go to Invoices" },
];

const STATUS_GLOSSARY: { term: string; meaning: string }[] = [
  { term: "Order — pending / paid / shipped / delivered / cancelled", meaning: "Storefront purchase lifecycle. Pending means payment is not yet confirmed; paid means the sale is captured; cancelled removes the order from fulfilment." },
  { term: "Purchase order — pending / ordered / received", meaning: "Supplier order lifecycle. Pending waits for the order to be placed; ordered means it has been sent to the supplier; received adds the ordered stock to inventory and cannot be reverted from the list (adjust quantities per line if needed)." },
  { term: "Purchase order — trash / restore", meaning: "Deleting a PO moves it to the Deleted tab where it can be restored. The trash keeps the order until you hard-delete it." },
  { term: "Repair — Received / Diagnosing / Waiting for parts / In progress / Ready / Collected", meaning: "Repair ticket lifecycle. Each step is tracked with a timestamp and visible to the customer in their My Repairs view." },
  { term: "Subscription request — pending / approved / rejected", meaning: "A customer or provider requested a plan change. Approving switches their plan; rejecting leaves the current plan in place." },
  { term: "Invoice — pending / paid / overdue", meaning: "Billing status for provider subscriptions. Overdue invoices are automatically flagged when the due date passes unpaid." },
  { term: "Credit note", meaning: "Issued against an invoice to reverse part or all of the amount. Downloads as a PDF and is recorded in the Credit Notes view." },
  { term: "Non-stock item", meaning: "A product or service that is sold but not tracked against inventory (for example a service or a drop-shipped item)." },
  { term: "eTIMS / KRA / OSCU", meaning: "Kenya's tax compliance system. OSCU (Offline Sales Control Unit) is the eTIMS offline mode used when the store cannot reach the KRA servers. The compliance settings hold the OSCU URL, consumer key and secret from your KRA dashboard." },
  { term: "Audit log", meaning: "A record of who changed what and when, kept for sensitive entities. It is read-only and used to trace disputes." },
  { term: "Branches & staff roles", meaning: "Branches let you filter stock by location. Staff accounts carry a base role (Admin, Owner, Manager, Technician, Provider, Staff) plus assigned roles that bundle permissions deciding which views and actions each account can use. Provider is a staff role for managing products, stock, quotes, orders, repairs and customer messages." },
];

function Term({ k }: { k: string }) {
  return (
    <span className="plan-status" style={{ background: "var(--primary-subtle)", color: "var(--primary)", fontWeight: 600 }}>
      {k}
    </span>
  );
}

export default function HelpPanel() {
  return (
    <>
      <h1>Help &amp; Reference</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        A quick reference for the staff portal. Secrets shown here are masked until you re-enter your admin password to reveal them.
      </p>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Keyboard shortcuts</h3>
        <div style={{ display: "grid", gap: "0.4rem", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {SHORTCUTS.map((s) => (
            <div key={s.keys} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span className="plan-status" style={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>{s.keys}</span>
              <span style={{ fontSize: "0.85rem" }}>{s.action}</span>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: "0.8rem", marginBottom: 0 }}>Shortcuts are ignored while you are typing in an input. Press Escape to clear a pending shortcut.</p>
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Status glossary</h3>
        <div style={{ display: "grid", gap: "0.9rem" }}>
          {STATUS_GLOSSARY.map((g) => (
            <div key={g.term}>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.2rem" }}>{g.term}</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{g.meaning}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Terms you may see</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.9rem" }}>
          <Term k="OSCU" />
          <Term k="eTIMS" />
          <Term k="KRA" />
          <Term k="GST" />
          <Term k="Non-stock item" />
          <Term k="Low-stock threshold" />
          <Term k="Branch" />
          <Term k="Role" />
          <Term k="Permission" />
          <Term k="Soft delete" />
        </div>
        <p style={{ fontSize: "0.85rem", marginBottom: 0 }}>
          <strong>OSCU</strong> and <strong>eTIMS</strong> relate to Kenya's KRA tax integration. <strong>GST</strong> (VAT) is applied to taxable products at checkout. <strong>Soft delete</strong> means an item is moved to a trash/restore view instead of being removed immediately (purchase orders). <strong>Low-stock threshold</strong> is the quantity at or below which an item is flagged for reordering.
        </p>
      </div>
    </>
  );
}
