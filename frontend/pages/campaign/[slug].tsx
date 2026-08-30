import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { ProductCard } from "@/components/ProductCard";
import Icon from "@/components/icons";
import type { Product } from "@/lib/types";

export default function CampaignPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [campaign, setCampaign] = useState<any | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/campaigns/${encodeURIComponent(String(slug).toLowerCase())}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Campaign not found." : "Failed to load campaign.");
        return r.json();
      })
      .then((d) => { if (!cancelled) { setCampaign(d.campaign); setProducts(d.products || []); } })
      .catch((e) => { if (!cancelled) setError(e.message || "Failed to load campaign."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  const heroBg = campaign?.banner_color || "#111827";
  const heroImg = campaign?.hero_image || "";

  return (
    <>
      <Head>
        <title>{campaign?.title || "Campaign"} — My Shop</title>
        {campaign?.description ? <meta name="description" content={campaign.description} /> : null}
      </Head>
      {loading ? (
        <div className="product-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="product-card">
              <div className="skeleton" style={{ height: 180, borderRadius: "var(--radius-lg)", marginBottom: "var(--space-3)" }} />
              <div className="skeleton" style={{ height: "1rem", width: "70%", marginBottom: "var(--space-2)" }} />
              <div className="skeleton" style={{ height: "1.25rem", width: "40%", marginBottom: "var(--space-2)" }} />
              <div className="skeleton" style={{ height: "0.75rem", width: "50%" }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "30vh", gap: "1rem", textAlign: "center" }}>
          <div className="empty-state-icon"><Icon name="megaphone" size={22} /></div>
          <p style={{ color: "var(--danger)" }}>{error}</p>
          <a href="/" className="btn btn-primary">Back to home</a>
        </div>
      ) : campaign ? (
        <>
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <ol>
              <li><a href="/">Home</a></li>
              <li><span aria-current="page">{campaign.title}</span></li>
            </ol>
          </nav>
          <div className="card" style={{ background: `linear-gradient(135deg, ${heroBg}, ${heroBg}dd)`, color: "#fff", marginBottom: "1.5rem", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap", padding: "1.5rem" }}>
              {heroImg && (
                <img src={heroImg} alt={campaign.title} style={{ width: 220, maxHeight: 140, objectFit: "cover", borderRadius: "var(--radius-lg)", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 240 }}>
                <h1 style={{ margin: 0, color: "#fff" }}>{campaign.title}</h1>
                {campaign.subtitle && <p style={{ margin: "0.5rem 0 0", fontSize: "1.1rem", opacity: 0.9 }}>{campaign.subtitle}</p>}
                {campaign.description && <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", opacity: 0.85 }}>{campaign.description}</p>}
              </div>
            </div>
          </div>
          {products.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Icon name="box" size={22} /></div>
              <div className="empty-state-title">No products in this campaign yet</div>
              <a href="/" className="btn btn-primary">Browse all products</a>
            </div>
          ) : (
            <div className="product-grid">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
