import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import Icon from "@/components/icons";
import type { ProductGroup } from "@/lib/types";
import { usePageTitle } from "@/lib/use-page-title";

export default function GroupsIndexPage() {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  usePageTitle("Product groups - Gear&Glitch");

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ groups: ProductGroup[] }>("/api/groups");
      setGroups(data.groups || []);
    } catch {
      setError("We couldn’t load product groups. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

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
        <div className="product-grid" role="status" aria-label="Loading product groups">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="product-card">
              <div className="skeleton" style={{ height: 180, borderRadius: "var(--radius-lg)", marginBottom: "var(--space-3)" }} />
              <div className="skeleton" style={{ height: "1rem", width: "60%" }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <div className="empty-state-icon"><Icon name="folder" size={28} /></div>
          <div className="empty-state-title">Product groups couldn’t load</div>
          <div className="empty-state-desc">{error}</div>
          <button type="button" className="btn btn-primary" onClick={() => void loadGroups()}>
            Try again
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="folder" size={28} /></div>
          <div className="empty-state-title">No groups yet</div>
          <div className="empty-state-desc">No product groups are available right now.</div>
          <a href="/" className="btn btn-primary">Browse all products</a>
        </div>
      ) : (
        <div className="product-grid">
          {groups.map((g) => (
            <Link key={g.id} href={`/group/${encodeURIComponent(g.id)}`} className="product-card">
              <div style={{ padding: "1.5rem 0", textAlign: "center", color: "var(--text-tertiary)" }}><Icon name="folder" size={40} /></div>
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
