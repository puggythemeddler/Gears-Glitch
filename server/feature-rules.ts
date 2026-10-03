// Pure feature-entitlement rules. No database imports so this module can be
// unit-tested without Postgres. `feature-access.ts` wires these to the store.
//
// Feature identifiers are human-readable strings matched case-insensitively
// (the convention already used by subscription plans, e.g. "Repair ticketing").
//
// Three independent layers, never collapsed into one flag:
//   1. entitlement - the feature is in the tenant plan or an explicit override
//   2. activation  - the tenant (and optionally a branch) has switched it on
//   3. right       - the caller holds the permission required by the route
// Branch overrides only ever *disable* an entitled feature for a branch; an
// absent branch entry means "inherit the tenant entitlement".

export function normalizeFeatureName(name: unknown): string {
  return String(name ?? "").toLowerCase().trim();
}

export function featureListIncludes(features: string[] | null | undefined, name: string): boolean {
  const target = normalizeFeatureName(name);
  if (!target) return false;
  return (features || []).some((f) => normalizeFeatureName(f) === target);
}

export type FeatureOverrides = Record<string, boolean>;

export function parseFeatureOverrides(raw: string | null | undefined): FeatureOverrides {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: FeatureOverrides = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === "boolean") out[key] = value;
  }
  return out;
}

// Apply control-plane overrides to a base plan feature list: false removes a
// feature, true force-adds one.
export function applyFeatureOverrides(
  baseFeatures: string[] | null | undefined,
  overrides: FeatureOverrides
): string[] {
  const base = baseFeatures || [];
  const effective = base.filter((f) => overrides[f] !== false);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === true && !effective.includes(key)) effective.push(key);
  }
  return effective;
}

// Branch overrides are keyed by feature name, then by branch id:
//   { "Lipa Mdogo Mdogo": { "3": false } }
export type BranchFeatureOverrides = Record<string, Record<string, boolean>>;

export function parseBranchFeatureOverrides(raw: string | null | undefined): BranchFeatureOverrides {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: BranchFeatureOverrides = {};
  for (const [feature, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const perBranch: Record<string, boolean> = {};
    for (const [branchId, flag] of Object.entries(value as Record<string, unknown>)) {
      const id = Number(branchId);
      if (!Number.isFinite(id)) continue;
      if (typeof flag === "boolean") perBranch[String(id)] = flag;
    }
    if (Object.keys(perBranch).length) out[feature] = perBranch;
  }
  return out;
}

export function branchFeatureOverride(
  branchOverrides: BranchFeatureOverrides,
  feature: string,
  branchId: number | string | null | undefined
): boolean | undefined {
  if (branchId === null || branchId === undefined || branchId === "") return undefined;
  const perFeature = branchOverrides[feature];
  if (!perFeature) return undefined;
  const key = branchKey(branchId);
  return Object.prototype.hasOwnProperty.call(perFeature, key) ? perFeature[key] : undefined;
}

function branchKey(branchId: number | string): string {
  const n = Number(branchId);
  return Number.isFinite(n) ? String(n) : String(branchId);
}

// A branch can use a feature only when the tenant is entitled AND the branch is
// not explicitly disabled. branchId null (no branch context) inherits.
export function isBranchFeatureEnabled(
  entitled: boolean,
  branchOverrides: BranchFeatureOverrides,
  feature: string,
  branchId: number | string | null | undefined
): boolean {
  if (!entitled) return false;
  return branchFeatureOverride(branchOverrides, feature, branchId) !== false;
}

export function setBranchFeatureOverride(
  map: BranchFeatureOverrides,
  feature: string,
  branchId: number | string,
  value: boolean | null
): BranchFeatureOverrides {
  const next: BranchFeatureOverrides = { ...map, [feature]: { ...(map[feature] || {}) } };
  const key = branchKey(branchId);
  if (value === null) delete next[feature][key];
  else next[feature][key] = value;
  if (!Object.keys(next[feature]).length) delete next[feature];
  return next;
}

// Validate/normalize an untrusted branch-override payload before persisting.
export function normalizeBranchFeatureOverrides(input: unknown): BranchFeatureOverrides {
  const out: BranchFeatureOverrides = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const [feature, value] of Object.entries(input as Record<string, unknown>)) {
    if (!feature || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const perBranch: Record<string, boolean> = {};
    for (const [branchId, flag] of Object.entries(value as Record<string, unknown>)) {
      const id = Number(branchId);
      if (!Number.isFinite(id)) continue;
      if (typeof flag === "boolean") perBranch[String(id)] = flag;
    }
    if (Object.keys(perBranch).length) out[feature] = perBranch;
  }
  return out;
}
