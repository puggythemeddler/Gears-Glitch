import React from "react";

export function SkeletonText({ lines = 1, width }: { lines?: number; width?: string }) {
  return (
    <>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton skeleton-text" style={i === lines - 1 && width ? { width } : undefined} />
      ))}
    </>
  );
}

export function SkeletonHeading({ width }: { width?: string }) {
  return <div className="skeleton skeleton-heading" style={width ? { width } : undefined} />;
}

export function SkeletonAvatar() {
  return <div className="skeleton skeleton-avatar" />;
}

export function SkeletonThumbnail() {
  return <div className="skeleton skeleton-thumbnail" />;
}

export function SkeletonCard() {
  return <div className="skeleton skeleton-card" />;
}

export function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="skeleton-row">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: "1em" }} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ padding: "1rem 0" }}>
      <SkeletonHeading />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} cols={cols} />
      ))}
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="stat-grid">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="stat-card" style={{ padding: "1.5rem" }}>
          <div className="skeleton" style={{ height: "2.5rem", width: "60%", margin: "0 auto 0.75rem", borderRadius: "6px" }} />
          <div className="skeleton" style={{ height: "1rem", width: "40%", margin: "0 auto", borderRadius: "6px" }} />
        </div>
      ))}
    </div>
  );
}
