// Shared feature entitlement + branch-activation resolution.
//
// Single source of truth for plan features, control-plane overrides, role
// narrowing and per-branch activation. Financing (and any future gated
// feature) reuses this instead of introducing its own flag store.
//
// Layers stay separate: `getEffectiveFeatures` answers "is the tenant
// entitled?" (plan + overrides, narrowed by staff role). Branch overrides
// answer "is it switched on for this branch?".

import type { Request, Response, NextFunction } from "express";
import { getShopPlan, getStoreSetting, setStoreSetting } from "./db";
import { getUserRoleFeatures } from "./permissions";
import { getBearerToken, verifyToken } from "./auth";
import {
  applyFeatureOverrides,
  featureListIncludes,
  isBranchFeatureEnabled,
  normalizeBranchFeatureOverrides,
  parseBranchFeatureOverrides,
  parseFeatureOverrides,
  type BranchFeatureOverrides,
  type FeatureOverrides,
} from "./feature-rules";

const SHOP_OVERRIDES_KEY = "featureOverrides";
const BRANCH_OVERRIDES_KEY = "branchFeatureOverrides";

const STAFF_ROLES = new Set(["admin", "owner", "technician", "manager", "staff"]);

export async function getShopFeatureOverrides(): Promise<FeatureOverrides> {
  return parseFeatureOverrides(await getStoreSetting(SHOP_OVERRIDES_KEY));
}

export async function saveShopFeatureOverrides(overrides: unknown): Promise<void> {
  const clean = parseFeatureOverrides(JSON.stringify(overrides ?? {}));
  await setStoreSetting(SHOP_OVERRIDES_KEY, JSON.stringify(clean));
}

export async function getBranchFeatureOverrides(): Promise<BranchFeatureOverrides> {
  return parseBranchFeatureOverrides(await getStoreSetting(BRANCH_OVERRIDES_KEY));
}

export async function saveBranchFeatureOverrides(overrides: unknown): Promise<BranchFeatureOverrides> {
  const clean = normalizeBranchFeatureOverrides(overrides);
  await setStoreSetting(BRANCH_OVERRIDES_KEY, JSON.stringify(clean));
  return clean;
}

// Resolve the effective feature set for the current request: plan features,
// intersected with featureOverrides, then intersected with the caller's role
// features (staff). Customers and the public always see plan features; a role
// with no features configured is unrestricted (see getUserRoleFeatures).
export async function getEffectiveFeatures(req: Request): Promise<string[]> {
  const plan = await getShopPlan();
  const baseFeatures: string[] = plan?.features || [];
  const overrides = await getShopFeatureOverrides();
  let effective = applyFeatureOverrides(baseFeatures, overrides);
  const token = getBearerToken(req);
  if (token) {
    try {
      const user = verifyToken(token);
      if (STAFF_ROLES.has(String(user.role))) {
        const roleFeatures = await getUserRoleFeatures(user.sub);
        if (roleFeatures) {
          effective = effective.filter((f) => roleFeatures.includes(f));
        }
      }
    } catch {
      /* invalid/expired token - fall through to plan features */
    }
  }
  return effective;
}

// Server-side feature gate. Rejects the request when the tenant's plan (as
// resolved for the caller) does not include the named feature.
export function requireShopFeature(feature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const features = await getEffectiveFeatures(req);
      if (!featureListIncludes(features, feature)) {
        res.status(403).json({ error: "This feature is not included in your plan." });
        return;
      }
      next();
    } catch (err: any) {
      console.error("[requireShopFeature]", err?.message || err);
      next(err);
    }
  };
}

export function resolveRequestBranchId(req: Request): number | null {
  const body = (req.body || {}) as Record<string, unknown>;
  const query = (req.query || {}) as Record<string, unknown>;
  const params = (req.params || {}) as Record<string, unknown>;
  const raw = body.branchId ?? query.branchId ?? params.branchId ?? (req as any).user?.activeBranchId;
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// Branch-aware gate: entitlement plus the target branch not being disabled.
// `resolveBranchId` lets a route point at the record's branch (from a body,
// query, param or loaded record); the default reads the request fields.
export function requireBranchFeature(
  feature: string,
  resolveBranchId?: (req: Request) => number | null | undefined
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const features = await getEffectiveFeatures(req);
      if (!featureListIncludes(features, feature)) {
        res.status(403).json({ error: "This feature is not included in your plan." });
        return;
      }
      const branchId = resolveBranchId ? resolveBranchId(req) : resolveRequestBranchId(req);
      const branchOverrides = await getBranchFeatureOverrides();
      if (!isBranchFeatureEnabled(true, branchOverrides, feature, branchId)) {
        res.status(403).json({ error: "This feature is not enabled for this branch." });
        return;
      }
      next();
    } catch (err: any) {
      console.error("[requireBranchFeature]", err?.message || err);
      next(err);
    }
  };
}

// Imperative variant for handlers that only learn the branch after loading the
// record. Returns null when allowed, otherwise an operator-facing message.
export async function checkBranchFeature(
  feature: string,
  branchId: number | string | null | undefined
): Promise<string | null> {
  const branchOverrides = await getBranchFeatureOverrides();
  if (!isBranchFeatureEnabled(true, branchOverrides, feature, branchId)) {
    return "This feature is not enabled for this branch.";
  }
  return null;
}

export { isBranchFeatureEnabled };
