import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { api, isCustomerLoggedIn, requireCustomerLogin } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import type { Product, ProductImage } from "@/lib/types";

function escapeHtml(text: string) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

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
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewMsg, setReviewMsg] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const loggedIn = isCustomerLoggedIn();
  const [userReviewed, setUserReviewed] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<Product>(`/api/products/${encodeURIComponent(id as string)}`).then((p) => {
      setProduct(p);
      const initImg: ProductImage = { id: 0, productId: p.id, imageUrl: p.imageUrl, sortOrder: -1, isPrimary: 1 };
      setImages([initImg]);
      api<{ images: ProductImage[] }>(`/api/products/${encodeURIComponent(id as string)}/images`).then((d) => {
        if (d.images && d.images.length > 1) setImages(d.images);
      }).catch(() => {});
      api<{ reviews: any[]; rating: { average: number; count: number } }>(`/api/products/${encodeURIComponent(id as string)}/reviews`).then((d) => {
        setReviews(d.reviews); setReviewsRating(d.rating);
      });
      if (isCustomerLoggedIn()) {
        api<{ hasReviewed: boolean }>(`/api/products/${encodeURIComponent(id as string)}/reviews/check`).then((d) => setUserReviewed(d.hasReviewed)).catch(() => {});
      }
    }).catch(() => setProduct(null));
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
    setCurrentIndex(((index % len) + len) % len);
  }, [images.length]);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [images.length]);

  async function addToCart() {
    if (!requireCustomerLogin(`/product?id=${id}`)) return;
    try {
      await api("/api/cart", { method: "POST", body: JSON.stringify({ productId: id, quantity: 1 }) });
      setStatusMsg({ text: "Added to cart!" });
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

  async function submitReview() {
    if (!requireCustomerLogin(`/product?id=${id}`)) return;
    if (!reviewRating) { setReviewMsg("Please select a rating."); return; }
    setReviewSubmitting(true); setReviewMsg("");
    try {
      await api(`/api/products/${encodeURIComponent(id as string)}/reviews`, { method: "POST", body: JSON.stringify({ rating: reviewRating, title: reviewTitle, comment: reviewComment }) });
      setReviewMsg("Review submitted!");
      setUserReviewed(true);
      const d = await api<{ reviews: any[]; rating: { average: number; count: number } }>(`/api/products/${encodeURIComponent(id as string)}/reviews`);
      setReviews(d.reviews); setReviewsRating(d.rating);
    } catch (e: any) { setReviewMsg(e.message || "Failed to submit review."); }
    finally { setReviewSubmitting(false); }
  }

  if (!product) {
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
          <li><span aria-current="page">{product.name}</span></li>
        </ol>
      </nav>

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
          <p className="product-detail__price">{formatPrice(product.price)}</p>
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
        <h2>Customer Reviews {reviewsRating.count > 0 && <><span style={{ fontSize: "0.9rem", fontWeight: 400, opacity: 0.6 }}>({reviewsRating.average.toFixed(1)} avg &mdash; {reviewsRating.count} review{reviewsRating.count !== 1 ? "s" : ""})</span></>}</h2>
        {loggedIn && !userReviewed && (
          <div className="panel" style={{ maxWidth: 500, marginBottom: "1rem" }}>
            <h4 style={{ margin: "0 0 0.75rem" }}>Write a Review</h4>
            {reviewMsg && <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem", color: reviewMsg.startsWith("Error") ? "#dc2626" : "#16a34a" }}>{reviewMsg}</p>}
            <div className="field"><label>Rating<select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))} required><option value={0}>Select</option><option value={5}>5 &mdash; Excellent</option><option value={4}>4 &mdash; Good</option><option value={3}>3 &mdash; Average</option><option value={2}>2 &mdash; Poor</option><option value={1}>1 &mdash; Terrible</option></select></label></div>
            <div className="field"><label>Title<input value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} placeholder="Summary of your review" /></label></div>
            <div className="field"><label>Comment<textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={3} placeholder="Tell others about your experience" /></label></div>
            <button type="button" className="btn" onClick={submitReview} disabled={reviewSubmitting}>{reviewSubmitting ? "Submitting..." : "Submit Review"}</button>
          </div>
        )}
        {reviews.length === 0 ? <p className="muted">No reviews yet.</p> : reviews.map((r: any) => (
          <div key={r.id} style={{ padding: "0.75rem 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <strong>{escapeHtml(r.customer_name || "Anonymous")}</strong>
              <span style={{ fontSize: "0.85rem", color: "#f59e0b" }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{new Date(r.created_at).toLocaleDateString("en-GB")}</span>
            </div>
            {r.title && <p style={{ fontWeight: 600, margin: "0.25rem 0" }}>{escapeHtml(r.title)}</p>}
            {r.comment && <p style={{ fontSize: "0.9rem", margin: "0.25rem 0 0", color: "var(--text-secondary)" }}>{escapeHtml(r.comment)}</p>}
          </div>
        ))}
      </section>
    </>
  );
}
