import { query, queryAll, queryOne } from "./db";

// ─────────────────────────────────────────────────────────────────────────────
// Ops Center schema + data helpers. Follows the same conventions as db.ts:
// inline CREATE TABLE IF NOT EXISTS + ALTER ADD COLUMN IF NOT EXISTS (no
// migration files), snake_case columns, TEXT columns for JSON blobs.
// All new per-client tables FK to clients(id) so bulk deletes cascade.
// ─────────────────────────────────────────────────────────────────────────────

export type AlertState =
  | "open"
  | "acknowledged"
  | "investigating"
  | "suppressed"
  | "resolved";

export interface HeartbeatPayload {
  appVersion?: string;
  schemaVersion?: string;
  envType?: string;
  readiness?: string;
  checks?: Record<string, any>;
  capabilities?: string[];
  timestamp?: string;
}

export async function initOpsCenterDb(): Promise<void> {
  await query(`CREATE TABLE IF NOT EXISTS client_heartbeats (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    app_version TEXT DEFAULT '',
    schema_version TEXT DEFAULT '',
    env_type TEXT DEFAULT '',
    readiness TEXT DEFAULT 'ok',
    checks TEXT DEFAULT '{}',
    capabilities TEXT DEFAULT '[]',
    received_at TIMESTAMP DEFAULT NOW()
  )`);
  try { await query("CREATE INDEX IF NOT EXISTS idx_hb_client ON client_heartbeats (client_id, received_at DESC)"); } catch {}

  await query(`CREATE TABLE IF NOT EXISTS client_usage_history (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    orders INTEGER DEFAULT 0,
    customers INTEGER DEFAULT 0,
    revenue DOUBLE PRECISION DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (client_id, day)
  )`);

  await query(`CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    state TEXT DEFAULT 'open',
    dedupe_key TEXT UNIQUE,
    detected_at TIMESTAMP DEFAULT NOW(),
    last_occurrence TIMESTAMP DEFAULT NOW(),
    occurrence_count INTEGER DEFAULT 1,
    assigned_to TEXT DEFAULT '',
    related_incident_id INTEGER,
    notes TEXT DEFAULT '',
    resolved_at TIMESTAMP,
    resolved_by TEXT DEFAULT '',
    resolution TEXT DEFAULT '',
    suppressed_at TIMESTAMP,
    suppressed_by TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  try { await query("CREATE INDEX IF NOT EXISTS idx_alerts_client ON alerts (client_id, state)"); } catch {}
  try { await query("CREATE INDEX IF NOT EXISTS idx_alerts_state ON alerts (state, severity)"); } catch {}

  await query(`CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    severity TEXT DEFAULT 'medium',
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'open',
    assignee TEXT DEFAULT '',
    created_by TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,
    resolution_summary TEXT DEFAULT '',
    root_cause TEXT DEFAULT '',
    prevention TEXT DEFAULT ''
  )`);
  try { await query("CREATE INDEX IF NOT EXISTS idx_incidents_client ON incidents (client_id, status)"); } catch {}

  await query(`CREATE TABLE IF NOT EXISTS incident_comments (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    author TEXT DEFAULT '',
    body TEXT NOT NULL,
    visibility TEXT DEFAULT 'internal',
    created_at TIMESTAMP DEFAULT NOW()
  )`);

  await query(`CREATE TABLE IF NOT EXISTS diagnostic_reports (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    requested_by TEXT DEFAULT '',
    requested_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    payload TEXT DEFAULT '',
    filename TEXT DEFAULT '',
    error TEXT DEFAULT ''
  )`);

  await query(`CREATE TABLE IF NOT EXISTS support_access_sessions (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    technician_id INTEGER,
    technician_name TEXT DEFAULT '',
    reason TEXT DEFAULT '',
    scopes TEXT DEFAULT '[]',
    starts_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    status TEXT DEFAULT 'pending',
    created_by TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW(),
    approved_by TEXT DEFAULT '',
    approved_at TIMESTAMP,
    revoked_by TEXT DEFAULT '',
    revoked_at TIMESTAMP,
    revoke_reason TEXT DEFAULT ''
  )`);

  await query(`CREATE TABLE IF NOT EXISTS maintenance_windows (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    reason TEXT DEFAULT '',
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP NOT NULL,
    approved_by TEXT DEFAULT '',
    services TEXT DEFAULT '[]',
    client_message TEXT DEFAULT '',
    status TEXT DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT NOW()
  )`);

  await query(`CREATE TABLE IF NOT EXISTS client_drift (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    check_label TEXT DEFAULT '',
    expected TEXT DEFAULT '',
    actual TEXT DEFAULT '',
    recommendation TEXT DEFAULT '',
    state TEXT DEFAULT 'open',
    detected_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,
    UNIQUE (client_id, key)
  )`);

  await query(`CREATE TABLE IF NOT EXISTS cp_settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT '',
    updated_at TIMESTAMP DEFAULT NOW()
  )`);

  // Heartbeat fields lifted onto the client row for cheap filtering in tables.
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP`); } catch {}
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS app_version TEXT DEFAULT ''`); } catch {}
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS schema_version TEXT DEFAULT ''`); } catch {}
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS env_type TEXT DEFAULT ''`); } catch {}
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS heartbeat_caps TEXT DEFAULT '[]'`); } catch {}
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS latest_checks TEXT DEFAULT '{}'`); } catch {}
  try { await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS cp_secret TEXT DEFAULT ''`); } catch {} // no-op safety

  console.log("[ops-center] Database initialized.");
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
export async function getOpsSettingRaw(key: string): Promise<string | null> {
  const row = await queryOne("SELECT value FROM cp_settings WHERE key = $1", [key]);
  return row ? String(row.value) : null;
}

export async function setOpsSetting(key: string, value: string): Promise<void> {
  await query(
    "INSERT INTO cp_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
    [key, value]
  );
}

export async function listOpsSettingsRaw(): Promise<Record<string, string>> {
  const rows = await queryAll("SELECT key, value FROM cp_settings");
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = String(r.value);
  return out;
}

// ─── HEARTBEATS ──────────────────────────────────────────────────────────────
export async function ingestHeartbeat(clientId: number, p: HeartbeatPayload): Promise<void> {
  const appVersion = String(p.appVersion || "").slice(0, 100);
  const schemaVersion = String(p.schemaVersion || "").slice(0, 100);
  const envType = String(p.envType || "").slice(0, 40);
  const readiness = String(p.readiness || "ok").slice(0, 40);
  const checksJson = JSON.stringify(p.checks || {});
  const capsJson = JSON.stringify(p.capabilities || []);

  await query(
    `UPDATE clients SET last_heartbeat = NOW(), app_version = $2, schema_version = $3, env_type = $4,
       latest_checks = $5, heartbeat_caps = $6, health_status = CASE WHEN health_status = 'unknown' OR health_status = 'down' THEN 'unknown' ELSE health_status END
     WHERE id = $1`,
    [clientId, appVersion, schemaVersion, envType, checksJson, capsJson]
  );
  await query(
    `INSERT INTO client_heartbeats (client_id, app_version, schema_version, env_type, readiness, checks, capabilities)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [clientId, appVersion, schemaVersion, envType, readiness, checksJson, capsJson]
  );

  // Retention: heartbeats older than the configured window are deleted.
  const days = Number((await getOpsSettingRaw("hb_retention_days")) || 30);
  const keep = Number.isFinite(days) && days > 0 ? days : 30;
  await query(
    "DELETE FROM client_heartbeats WHERE client_id = $1 AND received_at < NOW() - ($2::int || ' days')::interval",
    [clientId, keep]
  );
}

export async function listHeartbeats(clientId: number, limit = 25): Promise<any[]> {
  return queryAll(
    `SELECT id, client_id, app_version, schema_version, env_type, readiness, checks, capabilities, received_at
     FROM client_heartbeats WHERE client_id = $1 ORDER BY received_at DESC LIMIT $2`,
    [clientId, Math.min(Math.max(Number(limit) || 25, 1), 200)]
  );
}

// ─── ALERTS ──────────────────────────────────────────────────────────────────
export interface AlertInput {
  clientId: number;
  key: string;
  category: string;
  severity: "info" | "warning" | "danger";
  title: string;
  description?: string;
}

// Upsert by dedupe key. Returns { id, created } where created=true when the
// alert did not previously exist (fresh detection). Suppressed alerts stay
// quiet. Resolved alerts only reopen after the configured cooldown.
export async function upsertAlert(a: AlertInput): Promise<{ id: number; created: boolean }> {
  const existing = await queryOne("SELECT id, state, last_occurrence FROM alerts WHERE dedupe_key = $1", [a.key]);
  if (!existing) {
    const r = await query(
      `INSERT INTO alerts (client_id, category, severity, title, description, dedupe_key)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [a.clientId, a.category, a.severity, a.title, a.description || "", a.key]
    );
    return { id: Number(r.rows[0].id), created: true };
  }
  if (existing.state === "suppressed") return { id: Number(existing.id), created: false };

  const cooldownRaw = await getOpsSettingRaw("alert_reopen_cooldown_min");
  const cooldownMin = getN(cooldownRaw, 720);
  if (existing.state === "resolved") {
    const lastOcc = new Date(existing.last_occurrence).getTime();
    if (Date.now() - lastOcc < cooldownMin * 60 * 1000) return { id: Number(existing.id), created: false };
    await query(
      `UPDATE alerts SET state = 'open', severity = $2, title = $3, description = $4, resolved_at = NULL,
         resolved_by = '', resolution = '', last_occurrence = NOW(), occurrence_count = occurrence_count + 1, updated_at = NOW()
       WHERE id = $1`,
      [existing.id, a.severity, a.title, a.description || ""]
    );
    return { id: Number(existing.id), created: false };
  }
  await query(
    "UPDATE alerts SET last_occurrence = NOW(), occurrence_count = occurrence_count + 1, updated_at = NOW() WHERE id = $1",
    [existing.id]
  );
  return { id: Number(existing.id), created: false };
}

export async function resolveAlertsByDedupeKey(keys: string[], resolver: string, resolution: string): Promise<void> {
  if (!keys.length) return;
  await query(
    `UPDATE alerts SET state = 'resolved', resolved_at = NOW(), resolved_by = $2, resolution = $3, updated_at = NOW()
     WHERE dedupe_key = ANY($1) AND state IN ('open', 'acknowledged', 'investigating')`,
    [keys, resolver, resolution]
  );
}

export async function getAlert(id: number): Promise<any | null> {
  return queryOne("SELECT * FROM alerts WHERE id = $1", [id]);
}

export async function listAlerts(opts: { clientId?: number; state?: string; severity?: string; limit?: number } = {}): Promise<any[]> {
  const conds: string[] = [];
  const params: any[] = [];
  if (opts.clientId) { params.push(opts.clientId); conds.push(`client_id = $${params.length}`); }
  if (opts.state) { params.push(opts.state); conds.push(`state = $${params.length}`); }
  if (opts.severity) { params.push(opts.severity); conds.push(`severity = $${params.length}`); }
  const where = conds.length ? ` WHERE ${conds.join(" AND ")}` : "";
  const limit = Math.min(Math.max(Number(opts.limit) || 200, 1), 500);
  return queryAll(
    `SELECT a.*, c.name AS client_name, c.status AS client_status
     FROM alerts a LEFT JOIN clients c ON c.id = a.client_id
     ${where} ORDER BY a.last_occurrence DESC LIMIT ${limit}`,
    params
  );
}

export async function updateAlert(id: number, patch: Record<string, any>): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = $${idx}`);
    params.push(v);
    idx++;
  }
  if (!sets.length) return;
  params.push(id);
  await query(`UPDATE alerts SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${idx}`, params);
}

export async function alertStateCounts(): Promise<Record<string, number>> {
  const rows = await queryAll(
    "SELECT state, COUNT(*)::int AS n FROM alerts WHERE state IN ('open','acknowledged','investigating','suppressed','resolved') GROUP BY state"
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.state] = Number(r.n);
  return out;
}

// ─── INCIDENTS ───────────────────────────────────────────────────────────────
export interface IncidentInput {
  clientId: number;
  title: string;
  description?: string;
  severity?: string;
  priority?: string;
  assignee?: string;
  createdBy?: string;
}

export async function createIncident(input: IncidentInput): Promise<any> {
  const r = await query(
    `INSERT INTO incidents (client_id, title, description, severity, priority, assignee, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [input.clientId, input.title, input.description || "", input.severity || "medium", input.priority || "normal", input.assignee || "", input.createdBy || ""]
  );
  return r.rows[0];
}

export async function getIncident(id: number): Promise<any | null> {
  return queryOne("SELECT * FROM incidents WHERE id = $1", [id]);
}

export async function listIncidents(opts: { clientId?: number; status?: string; limit?: number } = {}): Promise<any[]> {
  const conds: string[] = [];
  const params: any[] = [];
  if (opts.clientId) { params.push(opts.clientId); conds.push(`client_id = $${params.length}`); }
  if (opts.status) { params.push(opts.status); conds.push(`status = $${params.length}`); }
  const where = conds.length ? ` WHERE ${conds.join(" AND ")}` : "";
  const limit = Math.min(Math.max(Number(opts.limit) || 200, 1), 500);
  return queryAll(
    `SELECT i.*, c.name AS client_name
     FROM incidents i LEFT JOIN clients c ON c.id = i.client_id
     ${where} ORDER BY i.updated_at DESC LIMIT ${limit}`,
    params
  );
}

export async function updateIncident(id: number, patch: Record<string, any>): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = $${idx}`);
    params.push(v);
    idx++;
  }
  if (!sets.length) return;
  const status = patch.status ? String(patch.status) : "";
  params.push(status, id);
  await query(
    `UPDATE incidents SET ${sets.join(", ")}, updated_at = NOW(),
       resolved_at = CASE WHEN $${idx}::text IN ('resolved', 'closed') THEN COALESCE(resolved_at, NOW()) ELSE resolved_at END
     WHERE id = $${idx + 1}::int`,
    params
  );
}

export async function addIncidentComment(incidentId: number, author: string, body: string, visibility = "internal"): Promise<void> {
  await query(
    "INSERT INTO incident_comments (incident_id, author, body, visibility) VALUES ($1, $2, $3, $4)",
    [incidentId, author, body, visibility]
  );
}

export async function listIncidentComments(incidentId: number): Promise<any[]> {
  return queryAll("SELECT * FROM incident_comments WHERE incident_id = $1 ORDER BY created_at ASC", [incidentId]);
}

// ─── DIAGNOSTIC REPORTS ──────────────────────────────────────────────────────
export async function createReportRequest(clientId: number, requestedBy: string): Promise<number> {
  const r = await query(
    "INSERT INTO diagnostic_reports (client_id, status, requested_by) VALUES ($1, 'pending', $2) RETURNING id",
    [clientId, requestedBy]
  );
  return Number(r.rows[0].id);
}

export async function setReportResult(id: number, opts: { status: string; payload?: string; filename?: string; error?: string }): Promise<void> {
  const completedAt = opts.status === "ready" || opts.status === "failed" ? new Date().toISOString() : null;
  await query(
    `UPDATE diagnostic_reports SET status = $2, payload = $3, filename = $4, error = $5, completed_at = $6 WHERE id = $1`,
    [id, opts.status, opts.payload || "", opts.filename || "", opts.error || "", completedAt]
  );
}

export async function getReport(id: number): Promise<any | null> {
  return queryOne("SELECT * FROM diagnostic_reports WHERE id = $1", [id]);
}

export async function listReports(opts: { clientId?: number; limit?: number } = {}): Promise<any[]> {
  const conds: string[] = [];
  const params: any[] = [];
  if (opts.clientId) { params.push(opts.clientId); conds.push(`client_id = $${params.length}`); }
  const where = conds.length ? ` WHERE ${conds.join(" AND ")}` : "";
  const limit = Math.min(Math.max(Number(opts.limit) || 100, 1), 500);
  return queryAll(
    `SELECT r.*, c.name AS client_name FROM diagnostic_reports r LEFT JOIN clients c ON c.id = r.client_id
     ${where} ORDER BY r.requested_at DESC LIMIT ${limit}`,
    params
  );
}

// ─── SUPPORT ACCESS SESSIONS ────────────────────────────────────────────────
export async function createSupportSession(input: {
  clientId: number;
  technicianId?: number | null;
  technicianName?: string;
  reason?: string;
  scopes?: string[];
  startsAt?: string | null;
  expiresAt: string;
  createdBy?: string;
}): Promise<number> {
  const r = await query(
    `INSERT INTO support_access_sessions (client_id, technician_id, technician_name, reason, scopes, starts_at, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [input.clientId, input.technicianId || null, input.technicianName || "", input.reason || "", JSON.stringify(input.scopes || []), input.startsAt || null, input.expiresAt, input.createdBy || ""]
  );
  return Number(r.rows[0].id);
}

export async function getSupportSession(id: number): Promise<any | null> {
  return queryOne("SELECT * FROM support_access_sessions WHERE id = $1", [id]);
}

export async function listSupportSessions(opts: { clientId?: number; status?: string; limit?: number } = {}): Promise<any[]> {
  const conds: string[] = [];
  const params: any[] = [];
  if (opts.clientId) { params.push(opts.clientId); conds.push(`client_id = $${params.length}`); }
  if (opts.status) { params.push(opts.status); conds.push(`status = $${params.length}`); }
  const where = conds.length ? ` WHERE ${conds.join(" AND ")}` : "";
  const limit = Math.min(Math.max(Number(opts.limit) || 200, 1), 500);
  return queryAll(
    `SELECT s.*, c.name AS client_name FROM support_access_sessions s LEFT JOIN clients c ON c.id = s.client_id
     ${where} ORDER BY s.created_at DESC LIMIT ${limit}`,
    params
  );
}

export async function updateSupportSession(id: number, patch: Record<string, any>): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = $${idx}`);
    params.push(v);
    idx++;
  }
  if (!sets.length) return;
  params.push(id);
  await query(`UPDATE support_access_sessions SET ${sets.join(", ")}, created_at = created_at WHERE id = $${idx}`, params);
}

// ─── MAINTENANCE WINDOWS ─────────────────────────────────────────────────────
export async function createMaintenanceWindow(input: {
  clientId: number;
  reason?: string;
  startsAt: string;
  endsAt: string;
  approvedBy?: string;
  services?: string[];
  clientMessage?: string;
}): Promise<number> {
  const r = await query(
    `INSERT INTO maintenance_windows (client_id, reason, starts_at, ends_at, approved_by, services, client_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [input.clientId, input.reason || "", input.startsAt, input.endsAt, input.approvedBy || "", JSON.stringify(input.services || []), input.clientMessage || ""]
  );
  return Number(r.rows[0].id);
}

export async function getMaintenanceWindow(id: number): Promise<any | null> {
  return queryOne("SELECT * FROM maintenance_windows WHERE id = $1", [id]);
}

export async function listMaintenanceWindows(opts: { clientId?: number; status?: string; limit?: number } = {}): Promise<any[]> {
  const conds: string[] = [];
  const params: any[] = [];
  if (opts.clientId) { params.push(opts.clientId); conds.push(`client_id = $${params.length}`); }
  if (opts.status) { params.push(opts.status); conds.push(`status = $${params.length}`); }
  const where = conds.length ? ` WHERE ${conds.join(" AND ")}` : "";
  const limit = Math.min(Math.max(Number(opts.limit) || 200, 1), 500);
  return queryAll(
    `SELECT m.*, c.name AS client_name FROM maintenance_windows m LEFT JOIN clients c ON c.id = m.client_id
     ${where} ORDER BY m.starts_at DESC LIMIT ${limit}`,
    params
  );
}

export async function updateMaintenanceWindow(id: number, patch: Record<string, any>): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = $${idx}`);
    params.push(v);
    idx++;
  }
  if (!sets.length) return;
  params.push(id);
  await query(`UPDATE maintenance_windows SET ${sets.join(", ")} WHERE id = $${idx}`, params);
}

// ─── DRIFT ───────────────────────────────────────────────────────────────────
export interface DriftInput {
  clientId: number;
  key: string;
  severity: "info" | "warning" | "critical";
  checkLabel: string;
  expected?: string;
  actual?: string;
  recommendation?: string;
}

// One open row per (client, key): re-detection stays in place, and the resolver
// closes the row the moment the condition clears.
export async function upsertDrift(d: DriftInput): Promise<void> {
  await query(
    `INSERT INTO client_drift (client_id, key, severity, check_label, expected, actual, recommendation)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (client_id, key) DO UPDATE SET
       severity = EXCLUDED.severity,
       check_label = EXCLUDED.check_label,
       expected = EXCLUDED.expected,
       actual = EXCLUDED.actual,
       recommendation = EXCLUDED.recommendation`,
    [d.clientId, d.key, d.severity, d.checkLabel, d.expected || "", d.actual || "", d.recommendation || ""]
  );
}

export async function resolveDrift(clientId: number, key: string): Promise<void> {
  await query(
    "UPDATE client_drift SET state = 'resolved', resolved_at = NOW() WHERE client_id = $1 AND key = $2 AND state = 'open'",
    [clientId, key]
  );
}

export async function listDrift(opts: { clientId?: number; state?: string; limit?: number } = {}): Promise<any[]> {
  const conds: string[] = [];
  const params: any[] = [];
  if (opts.clientId) { params.push(opts.clientId); conds.push(`client_id = $${params.length}`); }
  if (opts.state) { params.push(opts.state); conds.push(`state = $${params.length}`); }
  const where = conds.length ? ` WHERE ${conds.join(" AND ")}` : "";
  const limit = Math.min(Math.max(Number(opts.limit) || 200, 1), 500);
  return queryAll(
    `SELECT d.*, c.name AS client_name FROM client_drift d LEFT JOIN clients c ON c.id = d.client_id
     ${where} ORDER BY d.detected_at DESC LIMIT ${limit}`,
    params
  );
}

// ─── USAGE HISTORY ───────────────────────────────────────────────────────────
export async function upsertUsageHistory(clientId: number, orders: number, customers: number, revenue: number): Promise<void> {
  await query(
    `INSERT INTO client_usage_history (client_id, day, orders, customers, revenue)
     VALUES ($1, CURRENT_DATE, $2, $3, $4)
     ON CONFLICT (client_id, day) DO UPDATE SET
       orders = EXCLUDED.orders, customers = EXCLUDED.customers,
       revenue = EXCLUDED.revenue, updated_at = NOW()`,
    [clientId, orders, customers, revenue]
  );
}

export async function aggregateUsageForClients(clients: any[]): Promise<void> {
  for (const c of clients) {
    try {
      await upsertUsageHistory(c.id, Number(c.usage_orders || 0), Number(c.usage_customers || 0), Number(c.usage_revenue || 0));
    } catch (e: any) {
      console.warn("[ops] usage history upsert failed for", c.id, e?.message);
    }
  }
}

export async function listUsageHistory(clientId: number, days = 30): Promise<any[]> {
  const d = Math.min(Math.max(Number(days) || 30, 1), 365);
  return queryAll(
    `SELECT day, orders, customers, revenue FROM client_usage_history
     WHERE client_id = $1 AND day >= CURRENT_DATE - ($2::int || ' days')::interval
     ORDER BY day ASC`,
    [clientId, d]
  );
}

// ─── OPS OVERVIEW (one row per client, cheap aggregates) ─────────────────────
export async function listOpsOverview(): Promise<any[]> {
  return queryAll(
    `SELECT
       c.id, c.name, c.domain, c.admin_email, c.status, c.plan, c.health_status,
       c.uptime_pct, c.last_health_check, c.last_heartbeat, c.app_version,
       c.schema_version, c.env_type, c.latest_checks, c.heartbeat_caps,
       c.usage_orders, c.usage_customers, c.usage_revenue, c.subscription_expires,
       c.created_at, c.render_service_url, c.vercel_project_url, c.is_test, c.notes,
       (SELECT COUNT(*)::int FROM alerts a WHERE a.client_id = c.id AND a.state IN ('open','acknowledged','investigating')) AS open_alerts,
       (SELECT COUNT(*)::int FROM incidents i WHERE i.client_id = c.id AND i.status NOT IN ('resolved','closed')) AS open_incidents,
       (SELECT COUNT(*)::int FROM client_drift d WHERE d.client_id = c.id AND d.state = 'open') AS drift_count,
       (SELECT COUNT(*)::int FROM maintenance_windows m WHERE m.client_id = c.id AND m.status IN ('scheduled','active')) AS maintenance_count,
       (SELECT MAX(triggered_at) FROM deploy_log b WHERE b.client_id = c.id AND b.status = 'backup') AS last_backup,
       (SELECT COUNT(*)::int FROM deploy_log f WHERE f.client_id = c.id AND f.status = 'failed' AND f.triggered_at > NOW() - INTERVAL '7 days') AS failed_deploys_7d,
       (SELECT COUNT(*)::int FROM deploy_log bf WHERE bf.client_id = c.id AND bf.status = 'backup_failed' AND bf.triggered_at > NOW() - INTERVAL '7 days') AS failed_backups_7d
     FROM clients c ORDER BY c.name ASC`
  );
}

function getN(raw: string | null, fallback: number): number {
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export async function pruneOpsData(): Promise<void> {
  const usageDays = Number((await getOpsSettingRaw("usage_retention_days")) || 365);
  const keepUsage = Number.isFinite(usageDays) && usageDays > 0 ? usageDays : 365;
  await query("DELETE FROM client_usage_history WHERE day < CURRENT_DATE - ($1::int || ' days')::interval", [keepUsage]);
}