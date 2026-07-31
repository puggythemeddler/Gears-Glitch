import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ProductGroup } from "@/lib/types";

export default function GroupsIndexPage() {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ groups: ProductGroup[] }>("/api/groups")
      .then((d) => setGroups(d.groups || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><span aria-current="page">Groups</span></li>
        </ol>
      </nav>
      <h1>Product Groups</h1>
      <p className="muted">Browse our collections by group.</p>
      {loading ? (
        <div className="product-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="product-card">
              <div className="skeleton" style={{ height: 180, borderRadius: "var(--radius-lg)", marginBottom: "var(--space-3)" }} />
              <div className="skeleton" style={{ height: "1rem", width: "60%" }} />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🗂️</div>
          <div className="empty-state-title">No groups yet</div>
          <div className="empty-state-desc">No product groups are available right now.</div>
          <a href="/" className="btn btn-primary">Browse all products</a>
        </div>
      ) : (
        <div className="product-grid">
          {groups.map((g) => (
            <Link key={g.id} href={`/group/${encodeURIComponent(g.id)}`} className="product-card">
              <div style={{ fontSize: "2.5rem", padding: "1.5rem", textAlign: "center", opacity: 0.8 }}>🗂️</div>
              <div style={{ fontWeight: 600 }}>{g.name}</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                {g.productCount} product{g.productCount === 1 ? "" : "s"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
