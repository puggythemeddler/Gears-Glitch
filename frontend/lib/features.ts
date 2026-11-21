import { useState, useEffect } from "react";
import { getStaffToken, getStaffRole } from "./api";

let state: { key: string; features: string[]; loadedAt: number } | null = null;
const FEATURE_CACHE_TTL_MS = 30_000;
let promise: Promise<string[]> | null = null;
let promiseKey: string | null = null;

function currentKey(): string {
  if (typeof window === "undefined") return "ssr";
  return getStaffRole() || "public";
}

export async function fetchActiveFeatures(): Promise<string[]> {
  const key = currentKey();
  if (state && state.key === key && Date.now() - state.loadedAt < FEATURE_CACHE_TTL_MS) return state.features;
  if (promise && promiseKey === key) return promise;

  const headers: Record<string, string> = {};
  const token = typeof window !== "undefined" ? getStaffToken() : null;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const request = fetch("/api/shop/features", { headers })
    .then((r) => r.json())
    .then((d) => {
      state = { key, features: d.features || [], loadedAt: Date.now() };
      return state.features;
    })
    .catch(() => {
      state = { key, features: [], loadedAt: Date.now() };
      return state.features;
    });
  const tracked = request.finally(() => {
    if (promise === tracked) { promise = null; promiseKey = null; }
  });
  promise = tracked;
  promiseKey = key;
  return tracked;
}

export function invalidateActiveFeatures(): void {
  if (state) state.loadedAt = 0;
}

export function hasFeature(features: string[], name: string): boolean {
  return features.some((f) => f.toLowerCase().trim() === name.toLowerCase().trim());
}

export function useFeature(featureName: string): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => fetchActiveFeatures().then((features) => {
      if (!cancelled) setEnabled(hasFeature(features, featureName));
    });
    void refresh();
    const handleFocus = () => { invalidateActiveFeatures(); void refresh(); };
    if (typeof window !== "undefined") window.addEventListener("focus", handleFocus);
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") window.removeEventListener("focus", handleFocus);
    };
  }, [featureName]);
  return enabled;
}

export function useFeaturesReady(): boolean {
  const key = currentKey();
  const [ready, setReady] = useState(!!state && state.key === key);
  useEffect(() => {
    let cancelled = false;
    if (state && state.key === key) {
      setReady(true);
    } else {
      setReady(false);
      fetchActiveFeatures().finally(() => {
        if (!cancelled) setReady(true);
      });
    }
    return () => { cancelled = true; };
  }, [key]);
  return ready;
}
