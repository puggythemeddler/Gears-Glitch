import { isValidTestDbUrl } from "../../server/test-db";

/**
 * Grant a plan feature only in the explicitly configured disposable test DB.
 * The returned callback restores the exact original feature list.
 */
export async function grantShopPlanFeaturesForTest(features: string[]): Promise<() => Promise<void>> {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!isValidTestDbUrl(connectionString)) {
    throw new Error("Plan entitlement fixtures require a validated disposable TEST_DATABASE_URL.");
  }

  const { Client } = require("pg");
  const client = new Client({ connectionString });
  const lockName = "gears-glitch-test-shop-plan-entitlements";
  await client.connect();
  // Integration files can run concurrently against the same disposable shop.
  // Keep the plan mutation isolated until the owning suite restores it.
  await client.query("SELECT pg_advisory_lock(hashtext($1))", [lockName]);
  let original: string[] | null = null;
  let planId: string | null = null;
  let changed = false;
  try {
    const result = await client.query(
      `SELECT sp.id, sp.features
       FROM settings s
       JOIN subscription_plans sp ON sp.id = s.value
       WHERE s.key = 'shop_plan_id'
       LIMIT 1`
    );
    const plan = result.rows[0];
    if (!plan) throw new Error("The disposable test shop has no active subscription plan.");

    const rawFeatures = typeof plan.features === "string" ? JSON.parse(plan.features || "[]") : plan.features;
    if (!Array.isArray(rawFeatures)) throw new Error("The disposable test plan feature list is invalid.");
    original = rawFeatures as string[];
    planId = String(plan.id);
    const next = [...new Set([...original, ...features])];
    changed = next.length !== original.length;
    if (changed) {
      await client.query("UPDATE subscription_plans SET features = $1 WHERE id = $2", [JSON.stringify(next), planId]);
    }
  } catch (error) {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockName]).catch(() => {});
    await client.end().catch(() => {});
    throw error;
  }

  let restored = false;
  return async () => {
    if (restored) return;
    restored = true;
    try {
      if (changed && original && planId) {
        await client.query("UPDATE subscription_plans SET features = $1 WHERE id = $2", [JSON.stringify(original), planId]);
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockName]).catch(() => {});
      await client.end();
    }
  };
}

export async function grantShopPlanFeatureForTest(feature: string): Promise<() => Promise<void>> {
  return grantShopPlanFeaturesForTest([feature]);
}
