import { useState, useEffect } from "react";

let cache: string[] | null = null;
let promise: Promise<string[]> | null = null;

export async function fetchActiveFeatures(): Promise<string[]> {
  if (cache) return cache;
  if (promise) return promise;
  promise = fetch("/api/shop/features")
    .then((r) => r.json())
    .then((d) => {
      cache = d.features || [];
      return cache!;
    })
    .catch(() => {
      cache = [];
      return cache!;
    });
  return promise;
}

export function hasFeature(features: string[], name: string): boolean {
  return features.some((f) => f.toLowerCase().trim() === name.toLowerCase().trim());
}

export function useFeature(featureName: string): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    fetchActiveFeatures().then((features) => {
      setEnabled(hasFeature(features, featureName));
    });
  }, [featureName]);
  return enabled;
}
