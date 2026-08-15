import { useState, useEffect } from "react";
import { getStaffToken, getStaffRole } from "./api";

let state: { key: string; features: string[] } | null = null;
let promise: Promise<string[]> | null = null;
let promiseKey: string | null = null;

function currentKey(): string {
  if (typeof window === "undefined") return "ssr";
  return getStaffRole() || "public";
}

export async function fetchActiveFeatures(): Promise<string[]> {
  const key = currentKey();
  if (state && state.key === key) return state.features;
  if (promise && promiseKey === key) return promise;

  const headers: Record<string, string> = {};
  const token = typeof window !== "undefined" ? getStaffToken() : null;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  promise = fetch("/api/shop/features", { headers })
    .then((r) => r.json())
    .then((d) => {
      state = { key, features: d.features || [] };
      return state.features;
    })
    .catch(() => {
      state = { key, features: [] };
      return state.features;
    });
  promiseKey = key;
  return promise;
}

export function hasFeature(features: string[], name: string): boolean {
  return features.some((f) => f.toLowerCase().trim() === name.toLowerCase().trim());
}

export function useFeature(featureName: string): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchActiveFeatures().then((features) => {
      if (!cancelled) setEnabled(hasFeature(features, featureName));
    });
    return () => { cancelled = true; };
  }, [featureName]);
  return enabled;
}
