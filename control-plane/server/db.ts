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
  cp_secret: string;
}

export async function getCloudinaryConfig() {
  const row = await queryOne("SELECT * FROM cloudinary_config ORDER BY id DESC LIMIT 1");
  return row || null;
}

export async function getSmtpConfig() {
  const row = await queryOne("SELECT * FROM smtp_config ORDER BY id DESC LIMIT 1");
  return row || null;
}

export async function setSmtpConfig(host: string, port: number, user: string, pass: string, fromEmail: string, fromName: string) {
  const existing = await queryOne("SELECT id FROM smtp_config LIMIT 1");
  if (existing) {
    await query(
      'UPDATE smtp_config SET host = $1, port = $2, "user" = $3, pass = $4, from_email = $5, from_name = $6, updated_at = NOW() WHERE id = $7',
      [host, port, user, pass, fromEmail, fromName, existing.id]
    );
  } else {
    await query(
      'INSERT INTO smtp_config (host, port, "user", pass, from_email, from_name) VALUES ($1, $2, $3, $4, $5, $6)',
      [host, port, user, pass, fromEmail, fromName]
    );
  }
}

export async function setCloudinaryConfig(cloudName: string, apiKey: string, apiSecret: string, folder: string) {
  const existing = await queryOne("SELECT id FROM cloudinary_config LIMIT 1");
  if (existing) {
    await query(
      "UPDATE cloudinary_config SET cloud_name = $1, api_key = $2, api_secret = $3, folder = $4, updated_at = NOW() WHERE id = $5",
      [cloudName, apiKey, apiSecret, folder, existing.id]
    );
  } else {
    await query(
      "INSERT INTO cloudinary_config (cloud_name, api_key, api_secret, folder) VALUES ($1, $2, $3, $4)",
      [cloudName, apiKey, apiSecret, folder]
    );
  }
}

export async function logAudit(
  userId: number,
  username: string,
  action: string,
  targetType: string,
  targetId?: number | null,
  targetName?: string,
  details?: string
) {
  try {
    await query(
      "INSERT INTO audit_log (user_id, username, action, target_type, target_id, target_name, details) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [userId, username, action, targetType, targetId || null, targetName || "", details || ""]
    );
  } catch (e: any) {
    console.warn("[audit] Failed to log:", e?.message);
  }
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
  // Per-client shared secret for authenticated control-plane → client calls
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS cp_secret TEXT DEFAULT ''`); } catch {}
  // Admin password set during provisioning
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS admin_password TEXT DEFAULT ''`); } catch {}
  // Contact fields
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT ''`); } catch {}
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS address TEXT DEFAULT ''`); } catch {}
  // Usage enforcement
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS usage_over_limit BOOLEAN DEFAULT false`); } catch {}
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_limit_warning TIMESTAMP`); } catch {}

  await query(`
    CREATE TABLE IF NOT EXISTS custom_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price DOUBLE PRECISION DEFAULT 0,
      price_annual DOUBLE PRECISION,
      tier_level INTEGER DEFAULT 1,
      max_products INTEGER DEFAULT 50,
      max_branches INTEGER DEFAULT 1,
      features TEXT DEFAULT '[]',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS cp_users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'viewer',
      api_key TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      last_login TIMESTAMP
    )
  `);

  // TOTP 2FA columns for cp_users
  try { await query(`ALTER TABLE cp_users ADD COLUMN IF NOT EXISTS totp_secret TEXT DEFAULT ''`); } catch {}
  try { await query(`ALTER TABLE cp_users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false`); } catch {}

  await query(`
    CREATE TABLE IF NOT EXISTS upgrade_requests (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      current_plan TEXT DEFAULT '',
      requested_plan TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      reviewed_at TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS cloudinary_config (
      id SERIAL PRIMARY KEY,
      cloud_name TEXT DEFAULT '',
      api_key TEXT DEFAULT '',
      api_secret TEXT DEFAULT '',
      folder TEXT DEFAULT 'gear-glitch',
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS smtp_config (
      id SERIAL PRIMARY KEY,
      host TEXT DEFAULT '',
      port INTEGER DEFAULT 587,
      "user" TEXT DEFAULT '',
      pass TEXT DEFAULT '',
      from_email TEXT DEFAULT 'noreply@gearglitch.com',
      from_name TEXT DEFAULT 'Gear&Glitch',
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER DEFAULT 0,
      username TEXT DEFAULT '',
      action TEXT NOT NULL,
      target_type TEXT DEFAULT '',
      target_id INTEGER,
      target_name TEXT DEFAULT '',
      details TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log("[control-plane] Database initialized.");
}
