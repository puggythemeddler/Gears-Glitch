import React, { useEffect, useState } from "react";
import { api, isCustomerLoggedIn } from "@/lib/api";
import type { WishlistItem, Quote } from "@/lib/types";
import { useApp } from "@/lib/app-context";
import { escapeHtml } from "@/lib/sanitize";
import { toast } from "@/components/Toast";
import { confirmDialog } from "@/components/ConfirmDialog";
import Icon from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePageTitle } from "@/lib/use-page-title";
import EmptyWishlistAnimation from "@/components/EmptyWishlistAnimation";

export default function WishlistPage() {
  const { formatPrice } = useApp();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteNotes, setQuoteNotes] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  usePageTitle("My wishlist");

  useEffect(() => {
    setMounted(true);
    const ok = isCustomerLoggedIn();
    setLoggedIn(ok);
    if (!ok) return;
    Promise.all([loadWishlist(), loadQuotes()]).finally(() => setLoading(false));
  }, []);

  async function loadWishlist() {
    try {
      const data = await api<{ items: WishlistItem[] }>("/api/wishlist");
      setItems(data.items || []);
    } catch { setItems([]); }
  }

  async function loadQuotes() {
    try {
      const data = await api<{ quotes: Quote[] }>("/api/quotes");
      setQuotes(data.quotes || []);
    } catch { setQuotes([]); }
  }

  async function removeFromWishlist(productId: string) {
    try {
      await api(`/api/wishlist/${encodeURIComponent(productId)}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.productId !== productId));
    } catch {}
  }

  async function requestQuote() {
    try {
      const result = await api<Quote>("/api/quotes/from-wishlist", {
        method: "POST",
        body: JSON.stringify({ notes: quoteNotes }),
      });
      toast("success", `Quote ${result.quoteNumber} created!`);
      setQuoteNotes("");
      loadQuotes();
    } catch (err: any) { toast("error", err.message); }
  }

  async function updateQuoteStatus(quoteId: number, status: string) {
    await api(`/api/quotes/${quoteId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    loadQuotes();
    setSelectedQuote(null);
  }

  const initials = (name: string) => name?.charAt(0) || "?";

  if (mounted && !loggedIn) {
    return (
      <>
        <h1>Wishlist</h1>
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="lock" size={28} /></div>
          <div className="empty-state-title">Sign in to view wishlist</div>
          <div className="empty-state-desc">Please sign in to view your wishlist.</div>
          <a href="/login?redirect=/wishlist" className="btn btn-primary">Sign in</a>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>My wishlist</h1>
      <p className="page-intro">Save products you're interested in and request a bulk quote.</p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <button className="btn" onClick={requestQuote} disabled={items.length === 0}>Request quote</button>
        <button className="btn btn-secondary" onClick={async () => {
          if (!(await confirmDialog({ message: "Clear all items from your wishlist?", confirmLabel: "Clear", danger: true }))) return;
          for (const item of items) await removeFromWishlist(item.productId);
        }}>Clear wishlist</button>
      </div>

      <div className="field">
        <label>Notes for quote (optional)</label>
        <textarea value={quoteNotes} onChange={(e) => setQuoteNotes(e.target.value)} rows={2} placeholder="Any special requests?" style={{ width: "100%", maxWidth: 400 }} />
      </div>

      <div className="wishlist-grid">
        {loading ? (
          <p className="muted">Loading wishlist…</p>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Icon name="heart" size={28} /></div>
            <div className="empty-state-title">Your wishlist is empty</div>
            <div className="empty-state-desc">Browse products and save the ones you're interested in.</div>
            <EmptyWishlistAnimation />
            <a href="/" className="btn btn-primary">Browse products</a>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.productId} className="wishlist-item">
              {item.productImage ? (
                <img src={item.productImage} alt={item.productName || ""} />
              ) : (
                <div style={{ width: 72, height: 72, background: "var(--surface)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: 700, color: "var(--border)" }}>
                  {initials(item.productName || "")}
                </div>
              )}
              <div className="wishlist-item__info">
                <div className="wishlist-item__name">
                  <a href={`/product?id=${encodeURIComponent(item.productId)}`}>{escapeHtml(item.productName || item.productId)}</a>
                </div>
                {item.productPrice != null && <div className="wishlist-item__price">{formatPrice(item.productPrice)}</div>}
                <div className="muted" style={{ fontSize: "0.8rem" }}>Added {new Date(item.createdAt).toLocaleDateString("en-GB")}</div>
              </div>
              <div className="wishlist-item__actions">
                <button className="btn btn-sm" onClick={async () => {
                  try {
                    await api("/api/cart", { method: "POST", body: JSON.stringify({ productId: item.productId, quantity: 1 }) });
                    toast("success", "Added to cart!");
                  } catch (err: any) { toast("error", err.message); }
                }}>Add to cart</button>
                <a href={`/product?id=${encodeURIComponent(item.productId)}`} className="btn btn-sm btn-ghost">View</a>
                <button className="btn btn-sm btn-ghost" style={{ color: "var(--danger)" }} onClick={() => removeFromWishlist(item.productId)}>Remove</button>
              </div>
            </div>
          ))
        )}
      </div>

      {quotes.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2>My quotes</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Quote #</th><th>Date</th><th>Status</th><th>Total</th><th></th></tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td>{escapeHtml(q.quoteNumber)}</td>
                    <td>{new Date(q.createdAt).toLocaleDateString("en-GB")}</td>
                    <td><StatusBadge status={q.status} domain="quotes" /></td>
                    <td>{formatPrice(q.total)}</td>
                    <td><button className="btn btn-sm" onClick={() => setSelectedQuote(q)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedQuote && (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <h3>Quote {escapeHtml(selectedQuote.quoteNumber)}</h3>
          <p>Status: <StatusBadge status={selectedQuote.status} domain="quotes" /></p>
          <p>Notes: {selectedQuote.notes || "—"}</p>
          <table className="data-table">
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
            <tbody>
              {selectedQuote.items.map((i) => (
                <tr key={i.id}>
                  <td>{escapeHtml(i.productName)}</td>
                  <td>{i.quantity}</td>
                  <td>{formatPrice(i.unitPrice)}</td>
                  <td>{formatPrice(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p><strong>Total: {formatPrice(selectedQuote.total)}</strong></p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn" onClick={() => updateQuoteStatus(selectedQuote.id, "accepted")}>Accept</button>
            <button className="btn btn-secondary" onClick={() => updateQuoteStatus(selectedQuote.id, "declined")}>Decline</button>
            <button className="btn btn-ghost" onClick={() => setSelectedQuote(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
