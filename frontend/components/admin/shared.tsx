import React, { useEffect, useRef, useState } from "react";

export function formatPrice(amount: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);
}

export function escapeHtml(v: string) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Runs an async loader on mount without the duplicate request React StrictMode
// causes in development.
//
// `reactStrictMode: true` (frontend/next.config.js) makes React mount, unmount,
// and remount every component in development so that missing effect cleanup is
// visible. A bare `useEffect(() => { load(); }, [])` therefore issues two
// identical GETs in dev and one in production, which makes local behaviour
// differ from what users actually get - and, for admin pages, doubles the load
// on a free-tier API.
//
// Fixing this by disabling StrictMode would throw away the safety net for every
// other effect in the app. Instead the effect below tracks completion in a ref
// that survives the simulated remount, so the second run is a no-op while the
// first request is still allowed to settle. The `cancelled` guard remains, so a
// genuine unmount (navigating away) still discards the response.
export function useInitialLoad(load: () => void) {
  const startedRef = useRef(false);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    loadRef.current();
  }, []);
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
