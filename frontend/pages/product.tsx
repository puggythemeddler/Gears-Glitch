import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { api, isCustomerLoggedIn, requireCustomerLogin } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import type { Product, ProductImage } from "@/lib/types";
import { escapeHtml } from "@/lib/sanitize";

function productInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default function ProductPage() {
  const router = useRouter();
  const { id } = router.query;
  const { formatPrice } = useApp();
  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lbOpen, setLbOpen] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsRating, setReviewsRating] = useState({ average: 0, count: 0 });
  const [reviewDistribution, setReviewDistribution] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewTotalPages, setReviewTotalPages] = useState(1);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewMsg, setReviewMsg] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const loggedIn = isCustomerLoggedIn();
  const [userReviewed, setUserReviewed] = useState(false);
  const [userReview, setUserReview] = useState<any>(null);
  const [editingReview, setEditingReview] = useState(false);
  const [deletingReview, setDeletingReview] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [subcategories, setSubcategories] = useState<{ id: string; name: string }[]>([]);
  const [categoryLabel, setCategoryLabel] = useState("");
  const [quantity, setQuantity] = useState(1);
  const userInteractedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    setLoadError("");
    api<Product>(`/api/products/${encodeURIComponent(id as string)}`).then((p) => {
      setProduct(p);
      const initImg: ProductImage = { id: 0, productId: p.id, imageUrl: p.imageUrl, sortOrder: -1, isPrimary: 1 };
      setImages([initImg]);
      api<{ images: ProductImage[] }>(`/api/products/${encodeURIComponent(id as string)}/images`).then((d) => {
        if (d.images && d.images.length >= 1) setImages(d.images);
      }).catch(() => {});
      api<{ reviews: any[]; rating: { average: number; count: number }; distribution: Record<number, number>; totalPages: number }>(`/api/products/${encodeURIComponent(id as string)}/reviews`).then((d) => {
        setReviews(d.reviews); setReviewsRating(d.rating); setReviewDistribution(d.distribution); setReviewTotalPages(d.totalPages);
      });
      if (isCustomerLoggedIn()) {
        api<{ hasReviewed: boolean; review: any }>(`/api/products/${encodeURIComponent(id as string)}/reviews/check`).then((d) => { setUserReviewed(d.hasReviewed); if (d.review) setUserReview(d.review); }).catch(() => {});
      }
      if (p.category) {
        fetch("/api/categories").then((r) => r.json()).then((d) => {
          const cat = (d.categories || []).find((c: any) => c.id === p.category);
          if (cat) setCategoryLabel(cat.label);
          const subs = (d.subcategories || []).filter((s: any) => Array.isArray(s.category_ids) && s.category_ids.includes(p.category));
          setSubcategories(subs);
        }).catch(() => {});
      }
    }).catch((e) => { setProduct(null); setLoadError(e.message || "Failed to load product."); });
  }, [id]);

  useEffect(() => {
    if (!id || !isCustomerLoggedIn()) return;
    api<{ inWishlist: boolean }>(`/api/wishlist/check/${encodeURIComponent(id as string)}`).then((d) => {
      setInWishlist(d.inWishlist);
    }).catch(() => {});
  }, [id]);

  const showImage = useCallback((index: number) => {
    const len = images.length;
    if (len === 0) return;
    userInteractedRef.current = true;
    setCurrentIndex(((index % len) + len) % len);
  }, [images.length]);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => {
      if (userInteractedRef.current) return;
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [images.length]);

  async function addToCart() {
    if (!requireCustomerLogin(`/product?id=${id}`)) return;
    try {
      await api("/api/cart", { method: "POST", body: JSON.stringify({ productId: id, quantity }) });
      setStatusMsg({ text: `Added ${quantity} item${quantity > 1 ? "s" : ""} to cart!` });
    } catch (err: any) {
      setStatusMsg({ text: err.message, error: true });
    }
  }

  async function toggleWishlist() {
    if (!requireCustomerLogin(`/product?id=${id}`)) return;
    try {
      if (inWishlist) {
        await api(`/api/wishlist/${encodeURIComponent(id as string)}`, { method: "DELETE" });
        setInWishlist(false);
      } else {
        await api("/api/wishlist", { method: "POST", body: JSON.stringify({ productId: id }) });
        setInWishlist(true);
      }
    } catch (err: any) {
      setStatusMsg({ text: err.message, error: true });
    }
  }

  function renderStars(rating: number, size: string = "1rem") {
    return <span style={{ fontSize: size, color: "#f59e0b", letterSpacing: 1 }}>{Array.from({ length: 5 }).map((_, i) => i < Math.round(rating) ? "★" : "☆").join("")}</span>;
  }

  async function fetchReviews(page: number = 1) {
    if (!id) return;
    const d = await api<{ reviews: any[]; rating: { average: number; count: number }; distribution: Record<number, number>; totalPages: number }>(`/api/products/${encodeURIComponent(id as string)}/reviews?page=${page}`);
    setReviews(d.reviews); setReviewsRating(d.rating); setReviewDistribution(d.distribution); setReviewTotalPages(d.totalPages); setReviewPage(page);
  }

  async function submitReview() {
    if (!requireCustomerLogin(`/product?id=${id}`)) return;
    if (!reviewRating) { setReviewMsg("Please select a rating."); return; }
    setReviewSubmitting(true); setReviewMsg("");
    try {
      await api(`/api/products/${encodeURIComponent(id as string)}/reviews`, { method: "POST", body: JSON.stringify({ rating: reviewRating, title: reviewTitle, comment: reviewComment }) });
      setReviewMsg("Review submitted!");
      setUserReviewed(true);
      setReviewRating(0); setReviewTitle(""); setReviewComment("");
      await fetchReviews(1);
    } catch (e: any) { setReviewMsg(e.message || "Failed to submit review."); }
    finally { setReviewSubmitting(false); }
  }

  async function updateReview() {
    if (!userReview || !id) return;
    if (!reviewRating) { setReviewMsg("Please select a rating."); return; }
    setReviewSubmitting(true); setReviewMsg("");
    try {
      await api(`/api/products/${encodeURIComponent(id as string)}/reviews/${userReview.id}`, { method: "PUT", body: JSON.stringify({ rating: reviewRating, title: reviewTitle, comment: reviewComment }) });
      setReviewMsg("Review updated!");
      setEditingReview(false);
      await fetchReviews(reviewPage);
      setUserReview({ ...userReview, rating: reviewRating, title: reviewTitle, comment: reviewComment });
    } catch (e: any) { setReviewMsg(e.message || "Failed to update review."); }
    finally { setReviewSubmitting(false); }
  }

  async function deleteReview() {
    if (!userReview || !id) return;
    if (!confirm("Are you sure you want to delete your review?")) return;
    setDeletingReview(true);
    try {
      await api(`/api/products/${encodeURIComponent(id as string)}/reviews/${userReview.id}`, { method: "DELETE" });
      setUserReviewed(false); setUserReview(null); setEditingReview(false);
      setReviewMsg("Review deleted.");
      await fetchReviews(1);
    } catch (e: any) { setReviewMsg(e.message || "Failed to delete review."); }
    finally { setDeletingReview(false); }
  }

  if (!product) {
    if (loadError) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "40vh", padding: "2rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem", opacity: 0.3 }}>&#9888;&#65039;</div>
          <p style={{ color: "var(--danger)", marginBottom: "1rem" }}>{loadError}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      );
    }
    return (
      <>
        <div className="skeleton" style={{ height: "1rem", width: "20%", marginBottom: "var(--space-4)" }} />
        <div className="product-detail">
          <div className="product-gallery">
            <div className="skeleton" style={{ width: "100%", aspectRatio: "1/1", borderRadius: "var(--radius-xl)" }} />
          </div>
          <div className="product-info">
            <div className="skeleton" style={{ height: "1.75rem", width: "80%", marginBottom: "var(--space-3)" }} />
            <div className="skeleton" style={{ height: "2rem", width: "40%", marginBottom: "var(--space-4)" }} />
            <div className="skeleton" style={{ height: "0.75rem", width: "30%", marginBottom: "var(--space-4)" }} />
            <div className="skeleton" style={{ height: "3rem", width: "100%", marginBottom: "var(--space-4)" }} />
            <div className="skeleton" style={{ height: "2.5rem", width: "50%" }} />
          </div>
        </div>
      </>
    );
  }

  const currentImage = images[currentIndex];
  const alt = product.imageAlt || product.name;

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          {product.category && <li><a href={`/${product.category}`}>{categoryLabel || product.category}</a></li>}
          {product.subcategory && <li><a href={`/${product.category}?subcategory=${encodeURIComponent(product.subcategory)}`}>{product.subcategory}</a></li>}
          <li><span aria-current="page">{product.name}</span></li>
        </ol>
      </nav>

      {subcategories.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "var(--space-4)", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 500 }}>Filter:</span>
          <a href={`/${product.category}`} className={`btn btn-sm ${!product.subcategory ? "btn-primary" : "btn-secondary"}`}>All</a>
          {subcategories.map((s: any) => (
            <a key={s.id} href={`/${product.category}?subcategory=${encodeURIComponent(s.id)}`} className={`btn btn-sm ${product.subcategory === s.id ? "btn-primary" : "btn-secondary"}`}>{s.name}</a>
          ))}
        </div>
      )}

      <article className="product-detail">
        <div className="product-detail__media">
          {product.imageUrl ? (
            <div className="product-gallery">
              <img
                className="product-gallery__main"
                src={currentImage?.imageUrl || product.imageUrl}
                alt={alt}
                onClick={() => setLbOpen(true)}
              />
              {images.length > 1 && (
                <div className="product-gallery__thumbs">
                  {images.map((img, i) => (
                    <img
                      key={img.id}
                      className={`product-gallery__thumb ${i === currentIndex ? "active" : ""}`}
                      src={img.imageUrl}
                      alt=""
                      onClick={() => showImage(i)}
                    />
                  ))}
                </div>
              )}
              <div className="product-gallery__counter">
                {currentIndex + 1} / {images.length}
              </div>
            </div>
          ) : (
            <div className="product-detail__placeholder">{productInitials(product.name)}</div>
          )}

          <div className={`product-gallery__lightbox ${lbOpen ? "open" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) setLbOpen(false); }}>
            <button className="product-gallery__lb-close" onClick={() => setLbOpen(false)}>&times;</button>
            <img className="product-gallery__lb-img" src={currentImage?.imageUrl || product.imageUrl} alt={alt} />
            <div className="product-gallery__lb-nav">
              <button className="btn btn-ghost" onClick={() => showImage(currentIndex - 1)}>Previous</button>
              <button className="btn btn-ghost" onClick={() => showImage(currentIndex + 1)}>Next</button>
            </div>
          </div>
        </div>

        <div className="product-detail__info">
          <h1>{product.name}</h1>
          <p className="product-detail__price" style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            {product.salePrice ? (
              <>
                <span style={{ textDecoration: "line-through", color: "var(--muted, #999)", fontSize: "0.8em" }}>{formatPrice(product.price)}</span>
                <span style={{ color: "#dc2626", fontWeight: 700 }}>{formatPrice(product.salePrice)}</span>
                <span style={{ display: "inline-block", background: "#dc2626", color: "#fff", fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: 999, textTransform: "uppercase" }}>Sale</span>
              </>
            ) : (
              formatPrice(product.price)
            )}
          </p>
          <p className={`product-stock ${product.inStock ? "in-stock" : "out-of-stock"}`}>
            {product.inStock ? "In stock" : "Enquire for availability"}
          </p>
          {product.hasWarranty && product.warrantyDuration ? (
            <p style={{ fontSize: "0.9rem", color: "var(--primary)", margin: "0.5rem 0" }}>
              &#x1F6E1;&#xFE0F; {product.warrantyDuration} month warranty
            </p>
          ) : null}
          {product.specs && product.specs.length > 0 && (
            <div className="product-detail__specs">
              <h3>Specifications</h3>
              <table>
                <tbody>
                  {product.specs.map((s, i) => {
                    if (typeof s === "string") {
                      const m = s.match(/^([^:]+):\s*(.+)/);
                      return <tr key={i}><td style={{ fontWeight: 600, paddingRight: "1rem", whiteSpace: "nowrap" }}>{m ? m[1] : ""}</td><td>{m ? m[2] : s}</td></tr>;
                    }
                    return <tr key={i}><td style={{ fontWeight: 600, paddingRight: "1rem", whiteSpace: "nowrap" }}>{s.l || s.f}</td><td>{s.v}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="product-detail__actions">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginRight: "0.5rem" }}>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}>−</button>
              <span style={{ minWidth: 32, textAlign: "center", fontWeight: 600 }}>{quantity}</span>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setQuantity((q) => q + 1)}>+</button>
            </div>
            <button type="button" className="btn" onClick={addToCart} disabled={!product.inStock}>
              Add to cart
            </button>
            <button
              type="button"
              className={`btn ${inWishlist ? "btn-ghost" : "btn-secondary"}`}
              onClick={toggleWishlist}
            >
              {inWishlist ? "Remove from wishlist" : "Add to wishlist"}
            </button>
            <a className="btn btn-secondary" href={`/contact?product=${encodeURIComponent(product.id)}&name=${encodeURIComponent(product.name)}`}>
              Enquire
            </a>
          </div>
          {statusMsg && (
            <p className={`form-status${statusMsg.error ? " error" : ""}`} role="status">
              {statusMsg.text}
            </p>
          )}
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            You must <a href={`/login?redirect=${encodeURIComponent(`/product?id=${product.id}`)}`}>sign in or create an account</a> to use the cart.
          </p>
        </div>
      </article>

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>Customer Reviews</h2>

        {reviewsRating.count > 0 && (
          <div style={{ display: "flex", gap: "2rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ textAlign: "center", minWidth: 120 }}>
              <div style={{ fontSize: "2.5rem", fontWeight: 700, lineHeight: 1 }}>{reviewsRating.average.toFixed(1)}</div>
              <div style={{ margin: "0.25rem 0" }}>{renderStars(reviewsRating.average, "1.2rem")}</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{reviewsRating.count} review{reviewsRating.count !== 1 ? "s" : ""}</div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              {[5, 4, 3, 2, 1].map((star) => {
                const count = reviewDistribution[star] || 0;
                const pct = reviewsRating.count > 0 ? (count / reviewsRating.count) * 100 : 0;
                return (
                  <div key={star} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: 4, cursor: "pointer" }} onClick={() => { const el = document.getElementById(`review-star-${star}`); if (el) el.scrollIntoView({ behavior: "smooth" }); }}>
                    <span style={{ fontSize: "0.8rem", width: 12, textAlign: "right" }}>{star}</span>
                    <span style={{ color: "#f59e0b", fontSize: "0.75rem" }}>★</span>
                    <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "#f59e0b", borderRadius: 4, transition: "width 0.3s" }} />
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", width: 24 }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loggedIn && !userReviewed && !editingReview && (
          <div className="panel" style={{ maxWidth: 500, marginBottom: "1.5rem" }}>
            <h4 style={{ margin: "0 0 0.75rem" }}>Write a Review</h4>
            {reviewMsg && <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem", color: reviewMsg.startsWith("Error") || reviewMsg.startsWith("Failed") ? "#dc2626" : "#16a34a" }}>{reviewMsg}</p>}
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Rating</label>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} type="button" onClick={() => setReviewRating(s)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: s <= reviewRating ? "#f59e0b" : "#d1d5db", padding: 0, lineHeight: 1, transition: "color 0.15s" }}>★</button>
                ))}
              </div>
            </div>
            <div className="field"><label>Title<input value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} placeholder="Summary of your review (optional)" maxLength={200} /></label></div>
            <div className="field"><label>Comment<textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={3} placeholder="Tell others about your experience (optional)" maxLength={2000} /></label></div>
            <button type="button" className="btn" onClick={submitReview} disabled={reviewSubmitting}>{reviewSubmitting ? "Submitting..." : "Submit Review"}</button>
          </div>
        )}

        {loggedIn && userReviewed && userReview && !editingReview && (
          <div className="panel" style={{ maxWidth: 500, marginBottom: "1.5rem", background: "var(--surface)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <h4 style={{ margin: 0 }}>Your Review</h4>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn btn-sm btn-ghost" onClick={() => { setEditingReview(true); setReviewRating(userReview.rating); setReviewTitle(userReview.title || ""); setReviewComment(userReview.comment || ""); setReviewMsg(""); }}>Edit</button>
                <button className="btn btn-sm btn-ghost" style={{ color: "#dc2626" }} onClick={deleteReview} disabled={deletingReview}>{deletingReview ? "Deleting..." : "Delete"}</button>
              </div>
            </div>
            <div style={{ marginBottom: "0.25rem" }}>{renderStars(userReview.rating)}</div>
            {userReview.title && <p style={{ fontWeight: 600, margin: "0.25rem 0" }}>{escapeHtml(userReview.title)}</p>}
            {userReview.comment && <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>{escapeHtml(userReview.comment)}</p>}
          </div>
        )}

        {editingReview && (
          <div className="panel" style={{ maxWidth: 500, marginBottom: "1.5rem" }}>
            <h4 style={{ margin: "0 0 0.75rem" }}>Edit Your Review</h4>
            {reviewMsg && <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem", color: reviewMsg.startsWith("Error") || reviewMsg.startsWith("Failed") ? "#dc2626" : "#16a34a" }}>{reviewMsg}</p>}
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Rating</label>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} type="button" onClick={() => setReviewRating(s)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: s <= reviewRating ? "#f59e0b" : "#d1d5db", padding: 0, lineHeight: 1, transition: "color 0.15s" }}>★</button>
                ))}
              </div>
            </div>
            <div className="field"><label>Title<input value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} placeholder="Summary (optional)" maxLength={200} /></label></div>
            <div className="field"><label>Comment<textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={3} placeholder="Your experience (optional)" maxLength={2000} /></label></div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" className="btn" onClick={updateReview} disabled={reviewSubmitting}>{reviewSubmitting ? "Saving..." : "Save Changes"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setEditingReview(false); setReviewMsg(""); }}>Cancel</button>
            </div>
          </div>
        )}

        {reviews.length === 0 ? <p className="muted">No reviews yet. Be the first to review this product!</p> : reviews.map((r: any) => (
          <div key={r.id} style={{ padding: "0.75rem 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <strong>{escapeHtml(r.customer_name || "Anonymous")}</strong>
              {renderStars(r.rating)}
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{new Date(r.created_at).toLocaleDateString("en-GB")}</span>
            </div>
            {r.title && <p style={{ fontWeight: 600, margin: "0.25rem 0" }}>{escapeHtml(r.title)}</p>}
            {r.comment && <p style={{ fontSize: "0.9rem", margin: "0.25rem 0 0", color: "var(--text-secondary)" }}>{escapeHtml(r.comment)}</p>}
          </div>
        ))}

        {reviewTotalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1rem" }}>
            <button className="btn btn-sm btn-ghost" disabled={reviewPage <= 1} onClick={() => fetchReviews(reviewPage - 1)}>Previous</button>
            <span style={{ fontSize: "0.85rem", padding: "0.3rem 0.75rem", color: "var(--text-secondary)" }}>Page {reviewPage} of {reviewTotalPages}</span>
            <button className="btn btn-sm btn-ghost" disabled={reviewPage >= reviewTotalPages} onClick={() => fetchReviews(reviewPage + 1)}>Next</button>
          </div>
        )}
      </section>
    </>
  );
}
