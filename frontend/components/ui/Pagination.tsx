import React from "react";

export function Pagination({
  page,
  totalPages,
  onChange,
  label = "Pagination",
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  label?: string;
}) {
  if (totalPages <= 1) return null;
  const pages: (number | "…")[] = [];
  for (let n = 1; n <= totalPages; n++) {
    const show = totalPages <= 7 || n === 1 || n === totalPages || Math.abs(n - page) <= 1;
    if (show) pages.push(n);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  function goTo(n: number) {
    onChange(Math.min(Math.max(1, n), totalPages));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return (
    <nav className="pagination" aria-label={label} style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem", margin: "2rem 0", flexWrap: "wrap" }}>
      <button className="btn btn-sm btn-ghost" onClick={() => goTo(page - 1)} disabled={page <= 1} aria-label="Previous page">&larr; Previous</button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} style={{ color: "var(--text-tertiary)" }}>…</span>
        ) : (
          <button
            key={p}
            className={`btn btn-sm ${p === page ? "btn-primary" : "btn-ghost"}`}
            onClick={() => goTo(p)}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        )
      )}
      <button className="btn btn-sm btn-ghost" onClick={() => goTo(page + 1)} disabled={page >= totalPages} aria-label="Next page">Next &rarr;</button>
      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", width: "100%", textAlign: "center" }}>
        Page {page} of {totalPages}
      </span>
    </nav>
  );
}
