import { useState, useEffect } from "react";
import { getStaffToken, getStaffRole } from "./api";

let state: { key: string; features: string[]; expiresAt: number } | null = null;
let promise: Promise<string[]> | null = null;
let promiseKey: string | null = null;

function currentKey(): string {
  if (typeof window === "undefined") return "ssr";
  return getStaffRole() || "public";
}

export async function fetchActiveFeatures(force = false): Promise<string[]> {
  const key = currentKey();
  if (force) {
    if (promise && promiseKey === key) return promise;
    state = null;
    promise = null;
    promiseKey = null;
  }
  if (state && state.key === key && state.expiresAt > Date.now()) return state.features;
  if (promise && promiseKey === key) return promise;

  const headers: Record<string, string> = {};
  const token = typeof window !== "undefined" ? getStaffToken() : null;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const request = fetch("/api/shop/features", { headers })
    .then((r) => r.json())
    .then((d) => {
      state = { key, features: d.features || [], expiresAt: Date.now() + 60_000 };
      return state.features;
    })
    .catch(() => {
      state = { key, features: [], expiresAt: Date.now() + 10_000 };
      return state.features;
    });
  promise = request;
  promiseKey = key;
  try {
    return await request;
  } finally {
    if (promise === request) {
      promise = null;
      promiseKey = null;
    }
  }
}

export function hasFeature(features: string[], name: string): boolean {
  return features.some((f) => f.toLowerCase().trim() === name.toLowerCase().trim());
}

export function useFeature(featureName: string): boolean {
  return useFeatureStatus(featureName) === true;
}

export function useFeatureStatus(featureName: string): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchActiveFeatures().then((features) => {
      if (!cancelled) setEnabled(hasFeature(features, featureName));
    });
    const refresh = () => {
      fetchActiveFeatures(true).then((features) => {
        if (!cancelled) setEnabled(hasFeature(features, featureName));
      });
    };
    if (typeof window !== "undefined") window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") window.removeEventListener("focus", refresh);
    };
  }, [featureName]);
  return enabled;
}
