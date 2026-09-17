import { queryOne, queryAll, query } from "./db";
import { sendSlackAlert } from "./provision";
import {
  ingestHeartbeat,
  upsertAlert,
  resolveAlertsByDedupeKey,
  upsertDrift,
  resolveDrift,
  createIncident,
  addIncidentComment,
  getAlert,
  updateAlert,
  setReportResult,
  createReportRequest,
  getOpsSettingRaw,
  HeartbeatPayload,
} from "./ops-db";

// ─────────────────────────────────────────────────────────────────────────────
// Ops Center business logic: health-state derivation, alert detection, config
// drift, diagnostic reports, incidents-from-alerts, and the monitored sweeps.
// Pure functions are kept testable; anything touching the DB lives behind the
// helpers above.
// ─────────────────────────────────────────────────────────────────────────────

// Derived health state used by the table/overview. Mirrors the existing badge
// vocabulary (healthy / sleeping / down / unknown / provisioning / suspended)
// and adds degraded + maintenance + offline(alias of down for the new model).
export type DerivedStatus =
  | "healthy"
  | "degraded"
  | "sleeping"
  | "offline"
  | "unknown"
  | "provisioning"
  | "disabled"
  | "failed"
  | "maintenance";

export interface HealthState {
  status: DerivedStatus;
  reason: string;
}

const REQUIRED_ALERT_CATEGORIES = ["db", "storage", "payments"];

export const DEGRADED_UNCONFIGURED = ["mpesa", "whatsapp", "email"];

export function deriveHealthState(client: {
  status?: string;
  health_status?: string;
  last_health_check?: string | null;
  last_heartbeat?: string | null;
  latest_checks?: string | null;
}): HealthState {
  const status = client.status || "active";
  if (status === "provisioning") return { status: "provisioning", reason: "Provisioning in progress" };
  if (status === "failed") return { status: "failed", reason: "Provisioning failed" };
  if (status === "suspended" || status === "disabled") return { status: "disabled", reason: `Client ${status}` };

  const checks = parseChecks(client.latest_checks);
  const degradedReason = firstFailedRequired(checks);

  if (client.health_status === "down") return { status: "offline", reason: "Latest health check failed" };
  if (client.health_status === "sleeping") return { status: "sleeping", reason: "Service cold-start (Render free tier)" };
  if (client.health_status === "healthy") {
    if (degradedReason) return { status: "degraded", reason: `Required check failing: ${degradedReason}` };
    return { status: "healthy", reason: "All systems operational" };
  }
  if (status === "active") {
    if (degradedReason) return { status: "degraded", reason: `Required check failing: ${degradedReason}` };
    return { status: "unknown", reason: "No recent health signal" };
  }
  return { status: "unknown", reason: "Unknown state" };
}

function parseChecks(raw?: string | null): Record<string, any> {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function firstFailedRequired(checks: Record<string, any>): string | null {
  for (const k of REQUIRED_ALERT_CATEGORIES) {
    const c = checks[k];
    if (c && typeof c === "object" && c.status === "fail") return k;
  }
  // A heartbeat-reporter outage is a platform concern, not a client outage.
  return null;
}

export function heartbeatAgeMinutes(lastHeartbeat?: string | null, now = Date.now()): number | null {
  if (!lastHeartbeat) return null;
  const t = new Date(lastHeartbeat).getTime();
  if (isNaN(t)) return null;
  return Math.max(0, Math.round((now - t) / 60000));
}

// ─── ALERT + DRIFT EVALUATION ────────────────────────────────────────────────
async function numSetting(key: string, fallback: number): Promise<number> {
  const raw = await getOpsSettingRaw(key);
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

// Evaluates one client's conditions and creates/resolves alerts + drift rows.
// Runs after each health pull and on every heartbeat ingest.
export async function evaluateForClient(clientId: number): Promise<void> {
  const c: any = await queryOne(
    `SELECT id, name, status, health_status, last_health_check, last_heartbeat, created_at,
            usage_over_limit, subscription_expires, neon_db_url, app_version, schema_version, latest_checks
     FROM clients WHERE id = $1`,
    [clientId]
  );
  if (!c) return;
  if (c.status !== "active") return;

  const now = Date.now();
  const heartbeatStaleMin = await numSetting("heartbeat_stale_min", 10);
  const heartbeatMissingHours = await numSetting("heartbeat_missing_after_hours", 24);
  const backupStaleHours = await numSetting("backup_stale_hours", 48);

  // ── Alert conditions ──
  const heartbeatStale = c.last_heartbeat ? heartbeatAgeMinutes(c.last_heartbeat, now)! > heartbeatStaleMin : false;
  const clientDown = c.health_status === "down";
  const usageOver = c.usage_over_limit === true;
  const backupRecent = await isBackupRecent(c.id, backupStaleHours);
  const backupOverdue = !!c.neon_db_url && !backupRecent;
  const subExpiring = isSubExpiring(c.subscription_expires);

  const conditions: { key: string; on: boolean; alert: { category: string; severity: "info" | "warning" | "danger"; title: string; description: string } }[] = [
    {
      key: `heartbeat:stale:${c.id}`, on: heartbeatStale,
      alert: { category: "heartbeat", severity: "warning", title: `${c.name}: heartbeat stale`, description: `No heartbeat from this store for ${heartbeatStaleMin}+ minutes. The process may be up but the reporter is not reaching the control plane.` },
    },
    {
      key: `client_down:${c.id}`, on: clientDown,
      alert: { category: "availability", severity: "danger", title: `${c.name} is DOWN`, description: "Health check failed — store unreachable." },
    },
    {
      key: `usage_over_limit:${c.id}`, on: usageOver,
      alert: { category: "usage", severity: "danger", title: `${c.name} over plan limits`, description: "Usage exceeds plan limits." },
    },
    {
      key: `backup_overdue:${c.id}`, on: backupOverdue,
      alert: { category: "backup", severity: "warning", title: `${c.name}: backup overdue`, description: `No successful database backup in the last ${backupStaleHours}h.` },
    },
    {
      key: `sub_expiring:${c.id}`, on: subExpiring,
      alert: { category: "subscription", severity: "warning", title: `${c.name}: subscription expiring`, description: "Subscription expires within 7 days — confirm renewal payment or schedule suspension." },
    },
  ];

  const activeKeys: string[] = [];
  for (const cond of conditions) {
    if (!cond.on) continue;
    activeKeys.push(cond.key);
    const { created } = await upsertAlert({ clientId: c.id, key: cond.key, ...cond.alert });
    if (created && cond.alert.category === "heartbeat") {
      await sendSlackAlert(`:warning: *${c.name}* heartbeat is stale — reporter not reaching the control plane.`);
    }
  }

  // Auto-resolve conditions that cleared (only for self-healing conditions).
  const autoResolvableKeys = conditions
    .filter((x) => !x.on)
    .map((x) => x.key);
  await resolveAlertsByDedupeKey(autoResolvableKeys, "system", "Condition cleared");

  // ── Drift ──
  const checks = parseChecks(c.latest_checks);

  const latestVersionRow: any = await queryOne("SELECT version FROM changelog ORDER BY created_at DESC, id DESC LIMIT 1");
  const latestVersion = latestVersionRow ? String(latestVersionRow.version) : "";

  if (latestVersion && c.app_version) {
    if (c.app_version !== latestVersion) {
      await upsertDrift({
        clientId: c.id, key: "version_outdated", severity: "info",
        checkLabel: "Release version",
        expected: latestVersion, actual: c.app_version,
        recommendation: "Deploy the latest release to this client (Deploy All) after the test site is verified.",
      });
    } else {
      await resolveDrift(c.id, "version_outdated");
    }
  }

  const neverHeartbeated = !c.last_heartbeat && now - new Date(c.created_at).getTime() > heartbeatMissingHours * 3600000;
  if (neverHeartbeated) {
    await upsertDrift({
      clientId: c.id, key: "heartbeat_missing", severity: "warning",
      checkLabel: "Heartbeat reporter",
      expected: `Heartbeat within ${heartbeatStaleMin} min of deploy`,
      actual: "No heartbeat received",
      recommendation: "Set CONTROL_PLANE_URL and CONTROL_PLANE_SECRET on the client backend and confirm the heartbeat reporter runs.",
    });
  } else if (c.last_heartbeat) {
    await resolveDrift(c.id, "heartbeat_missing");
  }

  const checkDriftRules: { key: string; check: string; label: string; severity: "info" | "warning"; expectWhen: string; recommendation: string }[] = [
    {
      key: "mpesa_missing", check: "mpesa", label: "M-Pesa integration",
      severity: "warning", expectWhen: "Configured when the store accepts M-Pesa payments",
      recommendation: "Add M-Pesa credentials in the client's M-Pesa settings.",
    },
    {
      key: "whatsapp_missing", check: "whatsapp", label: "WhatsApp integration",
      severity: "info", expectWhen: "Configured for customer notifications",
      recommendation: "Connect the WhatsApp Business account in the client's integrations.",
    },
    {
      key: "email_missing", check: "email", label: "Email integration",
      severity: "info", expectWhen: "Configured for transactional email",
      recommendation: "Connect email credentials in the client's settings.",
    },
    {
      key: "backups_disabled", check: "backups", label: "Image backup to database",
      severity: "info", expectWhen: "Enabled for resilience",
      recommendation: "Enable 'backup images to database' in the client's settings.",
    },
  ];
  for (const rule of checkDriftRules) {
    const chk = checks[rule.check];
    if (!chk || typeof chk !== "object") continue;
    if (chk.status === "unconfigured" || chk.status === "disabled") {
      await upsertDrift({
        clientId: c.id, key: rule.key, severity: rule.severity,
        checkLabel: rule.label,
        expected: rule.expectWhen,
        actual: String(chk.detail || chk.status),
        recommendation: rule.recommendation,
      });
    } else {
      await resolveDrift(c.id, rule.key);
    }
  }
}

async function isBackupRecent(clientId: number, staleHours: number): Promise<boolean> {
  const row: any = await queryOne(
    "SELECT MAX(triggered_at) AS last FROM deploy_log WHERE client_id = $1 AND status = 'backup'",
    [clientId]
  );
  if (!row?.last) return false;
  const t = new Date(row.last).getTime();
  return Date.now() - t < staleHours * 3600000;
}

export function isSubExpiring(subscriptionExpires?: string | null): boolean {
  if (!subscriptionExpires) return false;
  const t = new Date(subscriptionExpires).getTime();
  if (isNaN(t)) return false;
  return t - Date.now() < 7 * 24 * 3600000;
}

// ─── CYCLE SWEEPS ────────────────────────────────────────────────────────────
export async function expireSupportAndMaintenance(): Promise<void> {
  try {
    await query("UPDATE support_access_sessions SET status = 'expired' WHERE status = 'active' AND expires_at < NOW()");
    await query("UPDATE maintenance_windows SET status = 'active' WHERE status = 'scheduled' AND starts_at <= NOW() AND ends_at > NOW()");
    await query("UPDATE maintenance_windows SET status = 'ended' WHERE status IN ('scheduled', 'active') AND ends_at <= NOW()");
  } catch (e: any) {
    console.warn("[ops] expire sweep failed:", e?.message);
  }
}

// ─── HEARTBEAT INGESTION ─────────────────────────────────────────────────────
const MAX_HEARTBEAT_BYTES = 20000;

export function normalizeHeartbeat(body: any): HeartbeatPayload | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const checks = body.checks && typeof body.checks === "object" && !Array.isArray(body.checks) ? body.checks : {};
  const capabilities = Array.isArray(body.capabilities) ? body.capabilities.map(String) : [];
  const payload: HeartbeatPayload = {
    appVersion: typeof body.appVersion === "string" ? body.appVersion : typeof body.version === "string" ? body.version : "",
    schemaVersion: typeof body.schemaVersion === "string" ? body.schemaVersion : "",
    envType: typeof body.envType === "string" ? body.envType : "",
    readiness: typeof body.readiness === "string" ? body.readiness : "ok",
    checks,
    capabilities,
    timestamp: typeof body.timestamp === "string" ? body.timestamp : undefined,
  };
  try {
    if (JSON.stringify(payload).length > MAX_HEARTBEAT_BYTES) return null;
  } catch {
    return null;
  }
  return payload;
}

export async function handleHeartbeat(clientId: number, body: any): Promise<{ ok: boolean; reason?: string }> {
  const payload = normalizeHeartbeat(body);
  if (!payload) return { ok: false, reason: "Invalid heartbeat payload" };
  await ingestHeartbeat(clientId, payload);
  // Re-evaluate this client's alerts/drift immediately (cheap, deduped).
  await evaluateForClient(clientId);
  return { ok: true };
}

// ─── DIAGNOSTIC REPORTS ──────────────────────────────────────────────────────
export async function buildDiagnosticReport(clientId: number, requestedBy: string): Promise<{ id: number; summary: any }> {
  const id = await createReportRequest(clientId, requestedBy);
  try {
    const client: any = await queryOne(
      `SELECT c.id, c.name, c.domain, c.admin_email, c.plan, c.status, c.health_status, c.uptime_pct,
              c.last_health_check, c.last_heartbeat, c.app_version, c.schema_version, c.env_type,
              c.latest_checks, c.usage_orders, c.usage_customers, c.usage_revenue,
              c.subscription_expires, c.created_at, c.render_service_url, c.notes
       FROM clients c WHERE c.id = $1`,
      [clientId]
    );
    if (!client) throw new Error("Client not found");

    const checks = parseChecks(client.latest_checks);
    const alerts = await queryAll(
      "SELECT category, severity, title, state, last_occurrence FROM alerts WHERE client_id = $1 ORDER BY last_occurrence DESC LIMIT 20",
      [clientId]
    );
    const incidents = await queryAll(
      "SELECT id, title, severity, status, updated_at FROM incidents WHERE client_id = $1 ORDER BY updated_at DESC LIMIT 10",
      [clientId]
    );
    const drift = await queryAll(
      "SELECT key, severity, check_label, expected, actual, recommendation, state FROM client_drift WHERE client_id = $1 ORDER BY detected_at DESC",
      [clientId]
    );
    const deploys = await queryAll(
      "SELECT status, triggered_at, started_at FROM (SELECT status, triggered_at, started_at FROM deploy_log WHERE client_id = $1 ORDER BY triggered_at DESC LIMIT 10) t",
      [clientId]
    );
    const usageHistory = await queryAll(
      "SELECT day, orders, customers, revenue FROM client_usage_history WHERE client_id = $1 ORDER BY day DESC LIMIT 14",
      [clientId]
    );
    const heartbeats = await queryAll(
      "SELECT received_at, app_version, schema_version, readiness FROM client_heartbeats WHERE client_id = $1 ORDER BY received_at DESC LIMIT 10",
      [clientId]
    );
    const maintenance = await queryAll(
      "SELECT reason, starts_at, ends_at, status FROM maintenance_windows WHERE client_id = $1 AND status IN ('scheduled','active') ORDER BY starts_at DESC",
      [clientId]
    );
    const support = await queryAll(
      "SELECT technician_name, scopes, status, starts_at, expires_at FROM support_access_sessions WHERE client_id = $1 AND status IN ('pending','active') ORDER BY created_at DESC",
      [clientId]
    );

    // Deliberately booleans/counts/versions only — never secrets (cp_secret,
    // Neon URLs, passwords, API keys) are included anywhere in this document.
    const report = {
      generatedAt: new Date().toISOString(),
      generatedBy: requestedBy,
      source: "snapshot",
      client: {
        id: client.id, name: client.name, domain: client.domain,
        plan: client.plan, status: client.status, adminEmail: client.admin_email,
        created: client.created_at, notes: client.notes,
      },
      health: deriveHealthState(client),
      platform: {
        uptimePct: Number(client.uptime_pct || 0),
        lastHealthCheck: client.last_health_check,
        lastHeartbeat: client.last_heartbeat,
        heartbeatAgeMin: heartbeatAgeMinutes(client.last_heartbeat),
        appVersion: client.app_version,
        schemaVersion: client.schema_version,
        envType: client.env_type,
      },
      checks: {
        integrations: {
          mpesaConfigured: checks.mpesa?.status === "configured",
          whatsappConfigured: checks.whatsapp?.status === "configured",
          emailConfigured: checks.email?.status === "configured",
          backupsEnabled: checks.backups?.status === "enabled",
        },
        notificationFailures24h: Number(checks.notifications?.fails24h || 0),
        raw: sanitizeChecksForReport(checks),
      },
      usage: {
        orders: Number(client.usage_orders || 0),
        customers: Number(client.usage_customers || 0),
        revenue: Number(client.usage_revenue || 0),
        history: usageHistory,
      },
      subscription: { expires: client.subscription_expires },
      reliability: {
        failedDeploys7d: Number((await getRecentFailures(clientId, "failed")).count),
        failedBackups7d: Number((await getRecentFailures(clientId, "backup_failed")).count),
        recentActivity: deploys,
      },
      alerts: alerts,
      incidents: incidents,
      drift: drift,
      maintenance: maintenance,
      supportAccess: support,
      heartbeats: heartbeats,
    };

    const slug = String(client.name || String(client.id)).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
    const filename = `diagnostic_${slug}_${new Date().toISOString().slice(0, 10)}.json`;
    await setReportResult(id, { status: "ready", payload: JSON.stringify(report, null, 2), filename });
    return { id, summary: report };
  } catch (e: any) {
    await setReportResult(id, { status: "failed", error: e?.message || String(e) });
    throw e;
  }
}

async function getRecentFailures(clientId: number, status: string): Promise<{ count: number }> {
  const row: any = await queryOne(
    "SELECT COUNT(*)::int AS count FROM deploy_log WHERE client_id = $1 AND status = $2 AND triggered_at > NOW() - INTERVAL '7 days'",
    [clientId, status]
  );
  return { count: Number(row?.count || 0) };
}

// Only primitive values survive; nested objects are flattened to {status, detail}
// so no accidental secret-shaped structures leak into reports.
function sanitizeChecksForReport(checks: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(checks || {})) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = { status: v.status || "unknown", detail: typeof v.detail === "string" ? v.detail.slice(0, 200) : undefined };
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ─── INCIDENT FROM ALERT ─────────────────────────────────────────────────────
export async function createIncidentFromAlert(alertId: number, opts: { assignee?: string; createdBy?: string; note?: string }): Promise<any> {
  const alert: any = await getAlert(alertId);
  if (!alert) throw new Error("Alert not found");
  const incident: any = await createIncident({
    clientId: alert.client_id,
    title: alert.title,
    description: alert.description,
    severity: alert.severity === "danger" ? "high" : alert.severity === "warning" ? "medium" : "low",
    assignee: opts.assignee,
    createdBy: opts.createdBy,
  });
  await updateAlert(alertId, { state: "investigating", related_incident_id: incident.id, updated_at: new Date().toISOString() });
  await addIncidentComment(incident.id, opts.createdBy || "system", opts.note || `Created from alert #${alertId} (${alert.category}).`);
  return incident;
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
export interface OpsSettingDef {
  key: string;
  default: number;
  type: "int";
  unit: string;
  label: string;
  help: string;
}

export const OPS_SETTINGS: OpsSettingDef[] = [
  { key: "heartbeat_stale_min", default: 10, type: "int", unit: "min", label: "Heartbeat stale threshold", help: "Minutes without a heartbeat before the client is flagged stale." },
  { key: "offline_stale_min", default: 15, type: "int", unit: "min", label: "Offline threshold", help: "Minutes without any signal before a client is treated as offline." },
  { key: "hb_retention_days", default: 30, type: "int", unit: "days", label: "Heartbeat retention", help: "How long raw heartbeat records are retained." },
  { key: "usage_retention_days", default: 365, type: "int", unit: "days", label: "Usage history retention", help: "How long daily usage rows are retained." },
  { key: "alert_reopen_cooldown_min", default: 720, type: "int", unit: "min", label: "Alert reopen cooldown", help: "Min time a resolved alert stays resolved before a recurrence reopens it." },
  { key: "backup_stale_hours", default: 48, type: "int", unit: "h", label: "Backup overdue threshold", help: "Hours without a successful control-plane database backup before alerting." },
  { key: "heartbeat_missing_after_hours", default: 24, type: "int", unit: "h", label: "Heartbeat reporter deadline", help: "Hours after provisioning before a missing heartbeat becomes a drift finding." },
];

export async function getOpsSettings(): Promise<{ settings: Record<string, { value: number; default: number; unit: string; label: string; help: string }> }> {
  const out: Record<string, any> = {};
  for (const def of OPS_SETTINGS) {
    const raw = await getOpsSettingRaw(def.key);
    const value = raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : def.default;
    out[def.key] = { value, default: def.default, unit: def.unit, label: def.label, help: def.help };
  }
  return { settings: out };
}

export async function updateOpsSetting(key: string, value: any): Promise<{ ok: boolean; error?: string }> {
  const def = OPS_SETTINGS.find((d) => d.key === key);
  if (!def) return { ok: false, error: "Unknown setting" };
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0 || v > 100000) return { ok: false, error: "Value must be a positive finite number" };
  const { setOpsSetting } = await import("./ops-db");
  await setOpsSetting(key, String(v));
  return { ok: true };
}