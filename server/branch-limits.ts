/**
 * Subscription plans use `-1` to mean that a resource is unlimited.
 * Keep that sentinel distinct from a literal zero allowance.
 */
export function isWithinBranchLimit(currentCount: number, maxBranches: number | null): boolean {
  if (maxBranches === null || maxBranches < 0) return true;
  return currentCount < maxBranches;
}
