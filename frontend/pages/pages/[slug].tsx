import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import type { Product } from "@/lib/types";
import { getProducts } from "@/components/ProductCard";
import { DynamicHomePage } from "@/layouts/dynamic-engine";
import type { DynamicLayoutConfig } from "@/layouts/dynamic-engine";
import { useApp } from "@/lib/app-context";

interface PublicPage {
  slug: string;
  title: string;
  description: string;
  config: DynamicLayoutConfig;
  updated_at: string;
}

export default function CmsPageView() {
  const router = useRouter();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";
  const { settings } = useApp();
  const siteName = settings?.storeName || "My Shop";

  const [page, setPage] = useState<PublicPage | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setStatus("loading");
    setPage(null);
    Promise.all([
      fetch(`/api/pages/${encodeURIComponent(slug)}`).then(async (r) => {
        if (r.status === 404) throw Object.assign(new Error("Page not found."), { code: "missing" });
        if (!r.ok) throw new Error("Failed to load page.");
        return r.json() as Promise<PublicPage>;
      }),
      getProducts(),
      fetch("/api/categories").then((r) => r.json()).then((d) => d.categories || []),
    ])
      .then(([p, prods, cats]) => {
        if (cancelled) return;
        setPage(p);
        setProducts(prods);
        setCategories(cats);
        setStatus("ok");
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus(e?.code === "missing" ? "missing" : "error");
      });
    return () => { cancelled = true; };
  }, [slug]);

  if (status === "loading") {
    return (
      <div style={{ width: "100%", padding: "var(--space-5)" }}>
        <div className="skeleton" style={{ height: 160, borderRadius: "var(--radius-xl)", marginBottom: "var(--space-6)" }} />
        <div className="skeleton" style={{ height: 200, borderRadius: "var(--radius-lg)" }} />
      </div>
    );
  }

  if (status !== "ok" || !page) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "45vh", padding: "2rem", textAlign: "center" }}>
        <div style={{ marginBottom: "1rem", opacity: 0.3 }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg></div>
        <h1 style={{ fontSize: "1.2rem", margin: "0 0 0.5rem" }}>Page not found</h1>
        <p style={{ color: "var(--text-secondary)", margin: "0 0 1rem" }}>
          {status === "error" ? "This page couldn't be loaded right now." : "This page doesn't exist or hasn't been published yet."}
        </p>
        <a href="/" className="btn btn-primary">Go to store</a>
      </div>
    );
  }

  const sections = Array.isArray(page.config.sections) ? page.config.sections : [];
  const hasContent = !!page.config.hero || sections.length > 0;

  return (
    <>
      <Head>
        <title>{page.title ? `${page.title} — ${siteName}` : siteName}</title>
        {page.description ? <meta name="description" content={page.description} /> : null}
      </Head>
      <div className="cms-page dynamic-layout">
        {!hasContent && (
          <div style={{ padding: "3rem 2rem", maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
            <h1 style={{ fontSize: "1.8rem", margin: "0 0 0.5rem" }}>{page.title}</h1>
            {page.description && <p style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>{page.description}</p>}
          </div>
        )}
        <DynamicHomePage products={products} categories={categories} banners={[]} config={page.config} />
      </div>
    </>
  );
}