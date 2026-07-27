import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.CONTROL_PLANE_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function queryAll(text: string, params?: any[]) {
  const result = await query(text, params);
  return result.rows;
}

export async function queryOne(text: string, params?: any[]) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

export interface Client {
  id: number;
  name: string;
  domain: string;
  admin_email: string;
  plan: string;
  status: string;
  neon_project_id: string;
  neon_db_name: string;
  neon_db_url: string;
  render_service_id: string;
  render_service_url: string;
  vercel_project_id: string;
  vercel_project_url: string;
  created_at: string;
  last_health_check: string | null;
  health_status: string;
  uptime_pct: number;
  total_checks: number;
  failed_checks: number;
  subscription_expires: string | null;
  feature_flags: Record<string, boolean>;
  notes: string;
}

export async function initControlPlaneDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT UNIQUE NOT NULL,
      admin_email TEXT NOT NULL,
      plan TEXT DEFAULT 'starter',
      status TEXT DEFAULT 'provisioning',
      neon_project_id TEXT DEFAULT '',
      neon_db_name TEXT DEFAULT '',
      neon_db_url TEXT DEFAULT '',
      render_service_id TEXT DEFAULT '',
      render_service_url TEXT DEFAULT '',
      vercel_project_id TEXT DEFAULT '',
      vercel_project_url TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      last_health_check TIMESTAMP,
      health_status TEXT DEFAULT 'unknown',
      uptime_pct DOUBLE PRECISION DEFAULT 100,
      total_checks INTEGER DEFAULT 0,
      failed_checks INTEGER DEFAULT 0,
      subscription_expires TIMESTAMP,
      feature_flags TEXT DEFAULT '{}',
      notes TEXT DEFAULT ''
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS health_log (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      checked_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS changelog (
      id SERIAL PRIMARY KEY,
      version TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS deploy_log (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      triggered_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP
    )
  `);

  // Add columns for existing databases
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS uptime_pct DOUBLE PRECISION DEFAULT 100`); } catch {}
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_checks INTEGER DEFAULT 0`); } catch {}
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS failed_checks INTEGER DEFAULT 0`); } catch {}
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS subscription_expires TIMESTAMP`); } catch {}
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS feature_flags TEXT DEFAULT '{}'`); } catch {}
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT ''`); } catch {}
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS usage_orders INTEGER DEFAULT 0`); } catch {}
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS usage_customers INTEGER DEFAULT 0`); } catch {}
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS usage_revenue DOUBLE PRECISION DEFAULT 0`); } catch {}

  console.log("[control-plane] Database initialized.");
}
