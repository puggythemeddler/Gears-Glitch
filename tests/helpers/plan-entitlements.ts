import { isValidTestDbUrl } from "../../server/test-db";

/**
 * Grant a plan feature only in the explicitly configured disposable test DB.
 * The returned callback restores the exact original feature list.
 */
export async function grantShopPlanFeatureForTest(feature: string): Promise<() => Promise<void>> {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!isValidTestDbUrl(connectionString)) {
    throw new Error("Plan entitlement fixtures require a validated disposable TEST_DATABASE_URL.");
  }

  const { Pool } = require("pg");
  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query(
      `SELECT sp.id, sp.features
       FROM settings s
       JOIN subscription_plans sp ON sp.id = s.value
       WHERE s.key = 'shop_plan_id'
       LIMIT 1`
    );
    const plan = result.rows[0];
    if (!plan) throw new Error("The disposable test shop has no active subscription plan.");

    const original = plan.features;
    const parsed = typeof original === "string" ? JSON.parse(original || "[]") : original;
    if (!Array.isArray(parsed)) throw new Error("The disposable test plan feature list is invalid.");
    if (parsed.includes(feature)) return async () => {};

    await pool.query("UPDATE subscription_plans SET features = $1 WHERE id = $2", [JSON.stringify([...parsed, feature]), plan.id]);
    return async () => {
      await pool.query("UPDATE subscription_plans SET features = $1 WHERE id = $2", [JSON.stringify(parsed), plan.id]);
    };
  } finally {
    await pool.end();
  }
}
