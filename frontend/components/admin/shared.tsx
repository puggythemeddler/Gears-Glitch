import React, { useEffect, useState } from "react";

export function formatPrice(amount: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);
}

export function escapeHtml(v: string) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function useFetch<T>(fetcher: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetcher().then((d) => { if (!cancelled) setData(d); }).catch((e: any) => { if (!cancelled) setError(e.message); })
    .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, deps);
  return {
    data, loading, error,
    refetch: () => { setLoading(true); fetcher().then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false)); },
  };
}

export function Spinner() {
  return <div style={{ textAlign: "center", padding: "2rem" }}><div className="loading-bar" /><p className="muted">Loading...</p></div>;
}

export function ErrorMsg({ msg }: { msg: string }) {
  return <p className="error">{msg}</p>;
}
