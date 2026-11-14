import React, { useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import RippleButton from "@/components/RippleButton";
import EmptyState from "@/components/EmptyState";
import { ErrorMsg, formatPrice, Spinner, useFetch } from "./shared";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { confirmDialog } from "@/components/ConfirmDialog";

type PricingProduct = Pick<Product, "id" | "name" | "category" | "price" | "salePrice" | "costPrice" | "inStock" | "isHidden" | "isNonStock">;
type MarkupMode = "percentage" | "fixed";
type PreviewRow = { product: PricingProduct; newPrice: number; skipReason?: string };

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function effectivePrice(product: PricingProduct) {
  return Number(product.salePrice) > 0 ? Number(product.salePrice) : Number(product.price) || 0;
}

function displayMarkup(product: PricingProduct, amount: boolean) {
  if (product.costPrice === null || product.costPrice === undefined) return "—";
  const difference = effectivePrice(product) - Number(product.costPrice);
  if (amount) return formatPrice(difference);
  const cost = Number(product.costPrice);
  return cost > 0 ? `${((difference / cost) * 100).toFixed(1)}%` : "—";
}

export default function ProductPriceList() {
  const feedback = useFeedback();
  const { data, loading, error, refetch } = useFetch(() => api<{ products: PricingProduct[] }>("/api/admin/pricing/products"), []);
  const products = data?.products || [];
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<MarkupMode>("percentage");
  const [markupValue, setMarkupValue] = useState("");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [applying, setApplying] = useState(false);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? products.filter((product) => `${product.name} ${product.category || ""}`.toLowerCase().includes(query)) : products;
  }, [products, search]);
  const selectedProducts = products.filter((product) => selectedIds.has(product.id));
  const eligiblePreview = (preview || []).filter((row) => !row.skipReason);
  const skippedPreview = (preview || []).filter((row) => row.skipReason);

  function toggleSelected(id: string) {
    setPreview(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleVisible() {
    setPreview(null);
    const allVisibleSelected = filteredProducts.length > 0 && filteredProducts.every((product) => selectedIds.has(product.id));
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const product of filteredProducts) {
        if (allVisibleSelected) next.delete(product.id); else next.add(product.id);
      }
      return next;
    });
  }

  function buildPreview() {
    const value = Number(markupValue);
    if (!selectedProducts.length) {
      feedback.error({ title: "Select products first", message: "Choose at least one product to preview." });
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      feedback.error({ title: "Enter a markup", message: "Markup must be greater than zero." });
      return;
    }
    setPreview(selectedProducts.map((product) => {
      if (product.costPrice === null || product.costPrice === undefined) return { product, newPrice: Number(product.price) || 0, skipReason: "No cost recorded" };
      if (Number(product.salePrice) > 0) return { product, newPrice: Number(product.price) || 0, skipReason: "Sale price is active" };
      const cost = Number(product.costPrice);
      const newPrice = roundMoney(mode === "percentage" ? cost * (1 + value / 100) : cost + value);
      return { product, newPrice };
    }));
  }

  async function applyMarkup() {
    if (!preview || eligiblePreview.length === 0) return;
    const value = Number(markupValue);
    const confirmed = await confirmDialog({
      title: "Apply markup to selected products?",
      message: `This will set the regular selling price for ${eligiblePreview.length} product${eligiblePreview.length === 1 ? "" : "s"} from its recorded cost. Existing sale-price products and products without a cost are excluded. Review the preview before continuing.`,
      confirmLabel: "Apply prices",
    });
    if (!confirmed) return;

    setApplying(true);
    try {
      const expected = Object.fromEntries(eligiblePreview.map(({ product }) => [product.id, {
        price: Number(product.price) || 0,
        costPrice: Number(product.costPrice),
        salePrice: product.salePrice === null || product.salePrice === undefined ? null : Number(product.salePrice),
      }]));
      const result = await api<{ updated: Array<{ id: string; name: string; oldPrice: number; newPrice: number }>; skipped: Array<{ id: string; name?: string; reason: string }> }>("/api/admin/products/apply-markup", {
        method: "POST",
        body: JSON.stringify({ productIds: eligiblePreview.map(({ product }) => product.id), mode, value, expected }),
      });
      const unchanged = result.updated.filter((product) => product.oldPrice === product.newPrice).length;
      feedback.success({ title: `${result.updated.length - unchanged} price${result.updated.length - unchanged === 1 ? "" : "s"} updated`, message: result.skipped.length ? `${result.skipped.length} product(s) skipped. Review their cost or sale price.` : undefined });
      setPreview(null);
      await refetch();
    } catch (err: any) {
      feedback.error({ title: "Prices not updated", message: err?.message || "Refresh the list and try the preview again." });
      setPreview(null);
      await refetch();
    } finally {
      setApplying(false);
    }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Price List</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>Review selling prices and gross profit. Markups use each product’s recorded cost.</p>
        </div>
        <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPreview(null); }} placeholder="Search products or categories" aria-label="Search price list" style={{ minWidth: 230, maxWidth: "100%" }} />
      </div>

      <section className="panel" aria-labelledby="markup-heading" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h2 id="markup-heading" style={{ fontSize: "1rem", margin: "0 0 0.3rem" }}>Set prices from cost</h2>
            <p className="muted" style={{ fontSize: "0.84rem", margin: 0 }}>Select products below, choose one markup, review the calculated prices, then apply.</p>
          </div>
          <span className="muted" aria-live="polite">{selectedIds.size} selected</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "0.65rem", flexWrap: "wrap", marginTop: "0.9rem" }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="price-markup-mode">Markup type</label>
            <select id="price-markup-mode" value={mode} onChange={(event) => { setMode(event.target.value as MarkupMode); setPreview(null); }}>
              <option value="percentage">Percentage on cost</option>
              <option value="fixed">Fixed amount on cost</option>
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="price-markup-value">{mode === "percentage" ? "Markup (%)" : "Markup (KES)"}</label>
            <input id="price-markup-value" type="number" min="0.01" step="0.01" value={markupValue} onChange={(event) => { setMarkupValue(event.target.value); setPreview(null); }} placeholder={mode === "percentage" ? "e.g. 15" : "e.g. 2500"} />
          </div>
          <RippleButton size="small" variant="secondary" onClick={buildPreview} disabled={selectedIds.size === 0 || !markupValue}>Preview prices</RippleButton>
        </div>
        <p className="muted" style={{ fontSize: "0.78rem", margin: "0.6rem 0 0" }}>Products without a saved cost or with an active sale price are excluded. Regular price changes are recorded in price history.</p>
      </section>

      {preview && (
        <section className="panel" aria-labelledby="price-preview-heading" style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <div>
              <h2 id="price-preview-heading" style={{ fontSize: "1rem", margin: "0 0 0.25rem" }}>Price preview</h2>
              <p className="muted" style={{ fontSize: "0.82rem", margin: 0 }}>{eligiblePreview.length} will update; {skippedPreview.length} excluded.</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <RippleButton size="small" variant="secondary" onClick={() => setPreview(null)} disabled={applying}>Cancel preview</RippleButton>
              <RippleButton size="small" onClick={applyMarkup} loading={applying} disabled={eligiblePreview.length === 0}>Apply prices</RippleButton>
            </div>
          </div>
          <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
            <table className="data-table">
              <thead><tr><th>Product</th><th style={{ textAlign: "right" }}>Current base price</th><th style={{ textAlign: "right" }}>Cost</th><th style={{ textAlign: "right" }}>New base price</th><th style={{ textAlign: "right" }}>Gross profit</th><th>Status</th></tr></thead>
              <tbody>
                {preview.map(({ product, newPrice, skipReason }) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatPrice(Number(product.price) || 0)}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{product.costPrice == null ? "—" : formatPrice(Number(product.costPrice))}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{skipReason ? "—" : formatPrice(newPrice)}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{skipReason || product.costPrice == null ? "—" : formatPrice(newPrice - Number(product.costPrice))}</td>
                    <td>{skipReason ? <span className="muted">Skipped · {skipReason}</span> : <span>Ready</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" aria-label="Select all visible products" checked={filteredProducts.length > 0 && filteredProducts.every((product) => selectedIds.has(product.id))} onChange={toggleVisible} /></th>
              <th>Product</th><th>Category</th><th style={{ textAlign: "right" }}>Selling price</th><th style={{ textAlign: "right" }}>Cost price</th><th style={{ textAlign: "right" }}>Gross profit</th><th style={{ textAlign: "right" }}>Markup %</th><th style={{ textAlign: "right" }}>Markup amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => {
              const cost = product.costPrice == null ? null : Number(product.costPrice);
              const selling = effectivePrice(product);
              const profit = cost === null ? null : selling - cost;
              return (
                <tr key={product.id}>
                  <td><input type="checkbox" checked={selectedIds.has(product.id)} onChange={() => toggleSelected(product.id)} aria-label={`Select ${product.name}`} /></td>
                  <td>{product.name}{product.isHidden && <span style={{ marginLeft: "0.35rem", fontSize: "0.72rem", color: "var(--text-secondary)" }}>Hidden</span>}</td>
                  <td>{product.category || "—"}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Number(product.salePrice) > 0 ? <><span style={{ textDecoration: "line-through", color: "var(--text-secondary)", marginRight: "0.35rem" }}>{formatPrice(Number(product.price) || 0)}</span><span>{formatPrice(selling)} <span className="muted" style={{ fontSize: "0.75rem" }}>sale</span></span></> : formatPrice(selling)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{cost === null ? <span className="muted">Not recorded</span> : formatPrice(cost)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: profit !== null && profit < 0 ? "var(--danger)" : undefined }}>{profit === null ? "—" : formatPrice(profit)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{displayMarkup(product, false)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{displayMarkup(product, true)}</td>
                </tr>
              );
            })}
            {filteredProducts.length === 0 && <tr><td colSpan={8}><EmptyState icon="products" title={products.length ? "No matching products" : "No products to price"} description={products.length ? "Try another product name or category." : "Add products to the catalog to review selling prices and margins."} /></td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
