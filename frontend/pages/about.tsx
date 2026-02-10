import React, { useEffect, useState } from "react";

export default function AboutPage() {
  const [data, setData] = useState<{ title: string; content: string; mission: string; vision: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public-settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.aboutUs) setData(d.aboutUs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><span aria-current="page">About Us</span></li>
        </ol>
      </nav>
      {loading ? (
        <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>Loading...</p>
      ) : data ? (
        <>
          <h1>{data.title || "About Us"}</h1>
          <div className="panel" style={{ marginBottom: "1.5rem" }}>
            <p>{data.content}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            {data.mission && (
              <div className="panel">
                <h2>Our Mission</h2>
                <p>{data.mission}</p>
              </div>
            )}
            {data.vision && (
              <div className="panel">
                <h2>Our Vision</h2>
                <p>{data.vision}</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>No information available yet.</p>
      )}
    </>
  );
}
