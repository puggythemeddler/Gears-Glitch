import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

import { initControlPlaneDb, query, queryOne, queryAll } from "../server/db";
import {
  initOpsCenterDb,
  ingestHeartbeat,
  upsertAlert,
  resolveAlertsByDedupeKey,
  updateAlert,
  getAlert,
  listAlerts,
  createIncident,
  updateIncident,
  getIncident,
  addIncidentComment,
  listIncidentComments,
  createSupportSession,
  getSupportSession,
  updateSupportSession,
  listSupportSessions,
  getReport,
  createMaintenanceWindow,
  getMaintenanceWindow,
  listMaintenanceWindows,
  upsertDrift,
  resolveDrift,
  listDrift,
  upsertUsageHistory,
  listUsageHistory,
  getOpsSettingRaw,
} from "../server/ops-db";
import {
  handleHeartbeat,
  evaluateForClient,
  createIncidentFromAlert,
  expireSupportAndMaintenance,
  updateOpsSetting,
  getOpsSettings,
  buildDiagnosticReport,
} from "../server/ops";

const HAS_DB = !!process.env.CONTROL_PLANE_DATABASE_URL;

describe("ops center (db)", { skip: !HAS_DB && "CONTROL_PLANE_DATABASE_URL not set (CI/isolated DB only)" }, () => {
  let seq = 0;

  const seedClient = async (opts: Record<string, any> = {}) => {
    const name = `Ops Test ${++seq}`;
    const r = await query(
      `INSERT INTO clients (name, domain, admin_email, plan, status, health_status, cp_secret, neon_db_url)
       VALUES ($1, $2, $3, 'starter', 'active', 'unknown', $4, $5) RETURNING id`,
      [name, `ops-${seq}-${Date.now()}.test`, `${name.toLowerCase().replace(/ /g, "-")}@test.dev`, opts.cp_secret || "", opts.neon_db_url || ""]
    );
    return Number(r.rows[0].id);
  };

  before(async () => {
    await initControlPlaneDb();
    await initOpsCenterDb();
  });

  // ── HEARTBEATS ─────────────────────────────────────────────────────────────
  it("ingests a heartbeat onto the client row and into history", async () => {
    const c = await seedClient();
    const res = await handleHeartbeat(c, {
      appVersion: "1.2.3",
      schemaVersion: "s1",
      envType: "production",
      readiness: "ok",
      checks: { db: { status: "ok" } },
      capabilities: ["mpesa"],
    });
    assert.equal(res.ok, true);

    const client = await queryOne("SELECT last_heartbeat, app_version, schema_version, env_type, latest_checks FROM clients WHERE id = $1", [c]) as any;
    assert.ok(client.last_heartbeat, "last_heartbeat is stamped");
    assert.equal(client.app_version, "1.2.3");
    assert.equal(client.schema_version, "s1");
    assert.equal(client.env_type, "production");
    const checks = JSON.parse(client.latest_checks);
    assert.equal(checks.db.status, "ok");

    const rows = await queryAll("SELECT * FROM client_heartbeats WHERE client_id = $1", [c]) as any[];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].readiness, "ok");
  });

  it("rejects invalid and oversized heartbeat payloads", async () => {
    const c = await seedClient();
    const res = await handleHeartbeat(c, null);
    assert.equal(res.ok, false);
    assert.equal(res.reason, "Invalid heartbeat payload");
    const big = await handleHeartbeat(c, { checks: { blob: "x".repeat(30000) } });
    assert.equal(big.ok, false);
  });

  // ── ALERTS ─────────────────────────────────────────────────────────────────
  it("dedupes alerts by key and bumps occurrence_count", async () => {
    const c = await seedClient();
    const first = await upsertAlert({ clientId: c, key: "alert:dup", category: "heartbeat", severity: "warning", title: "Dup", description: "d" });
    assert.equal(first.created, true);
    const second = await upsertAlert({ clientId: c, key: "alert:dup", category: "heartbeat", severity: "warning", title: "Dup", description: "d" });
    assert.equal(second.created, false);
    assert.equal(second.id, first.id);
    const a = await getAlert(first.id) as any;
    assert.equal(a.occurrence_count, 2);
  });

  it("keeps resolved alerts resolved within the reopen cooldown, then reopens them after", async () => {
    const c = await seedClient();
    const { id } = await upsertAlert({ clientId: c, key: "alert:cooldown", category: "availability", severity: "danger", title: "Down", description: "d" });
    await resolveAlertsByDedupeKey(["alert:cooldown"], "tests", "resolved for test");

    const withinCooldown = await upsertAlert({ clientId: c, key: "alert:cooldown", category: "availability", severity: "danger", title: "Down", description: "d" });
    assert.equal(withinCooldown.created, false);
    let a = await getAlert(id) as any;
    assert.equal(a.state, "resolved");

    await query("UPDATE alerts SET last_occurrence = NOW() - INTERVAL '2 days' WHERE id = $1", [id]);
    const reopened = await upsertAlert({ clientId: c, key: "alert:cooldown", category: "availability", severity: "danger", title: "Down", description: "d" });
    assert.equal(reopened.created, false);
    a = await getAlert(id) as any;
    assert.equal(a.state, "open");
    assert.equal(a.occurrence_count, 2);
    assert.equal(a.resolved_at, null, "resolved_at cleared on reopen");
  });

  it("leaves suppressed alerts quiet", async () => {
    const c = await seedClient();
    const { id } = await upsertAlert({ clientId: c, key: "alert:suppressed", category: "availability", severity: "warning", title: "S", description: "s" });
    await updateAlert(id, { state: "suppressed" });
    const again = await upsertAlert({ clientId: c, key: "alert:suppressed", category: "availability", severity: "warning", title: "S", description: "s" });
    assert.equal(again.created, false);
    const a = await getAlert(id) as any;
    assert.equal(a.state, "suppressed");
    assert.equal(a.occurrence_count, 1, "suppressed alerts do not accumulate occurrences");
  });

  it("evaluateForClient raises a stale-heartbeat alert and auto-resolves it once the heartbeat returns", async () => {
    const c = await seedClient();
    await updateOpsSetting("heartbeat_stale_min", 1);
    try {
      await query("UPDATE clients SET last_heartbeat = NOW() - INTERVAL '30 minutes' WHERE id = $1", [c]);
      await evaluateForClient(c);
      let alerts = await listAlerts({ clientId: c }) as any[];
      const stale = alerts.find((a) => a.dedupe_key === `heartbeat:stale:${c}`);
      assert.ok(stale, "stale heartbeat alert exists");
      assert.equal(stale.state, "open");

      await query("UPDATE clients SET last_heartbeat = NOW() WHERE id = $1", [c]);
      await evaluateForClient(c);
      alerts = await listAlerts({ clientId: c }) as any[];
      const after = alerts.find((a) => a.dedupe_key === `heartbeat:stale:${c}`);
      assert.equal(after.state, "resolved", "cleared condition auto-resolves");
    } finally {
      await updateOpsSetting("heartbeat_stale_min", 10);
    }
  });

  // ── INCIDENTS ──────────────────────────────────────────────────────────────
  it("regression: updateIncident sets resolved_at for resolved/closed without param mismatch", async () => {
    const c = await seedClient();
    const incident = await createIncident({ clientId: c, title: "Reg", description: "d", severity: "medium", createdBy: "tester" }) as any;

    await updateIncident(incident.id, { status: "resolved" });
    const resolved = await getIncident(incident.id) as any;
    assert.equal(resolved.status, "resolved");
    assert.ok(resolved.resolved_at, "resolved_at stamped on resolve");

    await updateIncident(incident.id, { status: "closed" });
    const closed = await getIncident(incident.id) as any;
    assert.equal(closed.status, "closed");
    assert.ok(closed.resolved_at, "closed keeps resolved_at stamped");
  });

  it("updateIncident with empty patch is a no-op", async () => {
    const c = await seedClient();
    const incident = await createIncident({ clientId: c, title: "Noop", createdBy: "tester" }) as any;
    await updateIncident(incident.id, {});
    const got = await getIncident(incident.id) as any;
    assert.equal(got.title, "Noop");
  });

  it("createIncidentFromAlert links the alert, maps severity, and adds a comment", async () => {
    const c = await seedClient();
    const { id: alertId } = await upsertAlert({ clientId: c, key: "alert:incident", category: "availability", severity: "danger", title: "Store DOWN", description: "unreachable" });
    const incident = await createIncidentFromAlert(alertId, { assignee: "ops@team", createdBy: "admin", note: "investigating" }) as any;

    assert.equal(incident.client_id, c);
    assert.equal(incident.severity, "high", "danger alert maps to high incident");
    const alert = await getAlert(alertId) as any;
    assert.equal(alert.state, "investigating");
    assert.equal(alert.related_incident_id, incident.id);
    const comments = await listIncidentComments(incident.id) as any[];
    assert.equal(comments.length, 1);
    assert.match(comments[0].body, /alert #/);
  });

  // ── DRIFT ──────────────────────────────────────────────────────────────────
  it("upsertDrift keeps one row per (client, key) and resolveDrift closes it", async () => {
    const c = await seedClient();
    await upsertDrift({ clientId: c, key: "drift:x", severity: "info", checkLabel: "Label", expected: "exp", actual: "act", recommendation: "fix" });
    await upsertDrift({ clientId: c, key: "drift:x", severity: "warning", checkLabel: "Label v2", expected: "exp", actual: "act2", recommendation: "fix now" });
    let open = await listDrift({ clientId: c, state: "open" }) as any[];
    assert.equal(open.length, 1);
    assert.equal(open[0].key, "drift:x");
    assert.equal(open[0].severity, "warning");

    await resolveDrift(c, "drift:x");
    open = await listDrift({ clientId: c, state: "open" }) as any[];
    assert.equal(open.length, 0);
    const all = await listDrift({ clientId: c }) as any[];
    assert.equal(all[0].state, "resolved");
    assert.ok(all[0].resolved_at);
  });

  // ── SUPPORT ACCESS + MAINTENANCE ───────────────────────────────────────────
  it("lists support sessions per client and expires active past-due sessions", async () => {
    const c1 = await seedClient();
    const c2 = await seedClient();
    const future = new Date(Date.now() + 2 * 3600000).toISOString();
    const past = new Date(Date.now() - 2 * 3600000).toISOString();

    await createSupportSession({ clientId: c1, technicianName: "T1", scopes: ["db"], startsAt: null, expiresAt: future, createdBy: "admin" });
    const futureSession = await createSupportSession({ clientId: c1, technicianName: "T2", scopes: ["logs"], startsAt: null, expiresAt: past, createdBy: "admin" });
    await createSupportSession({ clientId: c2, technicianName: "T3", scopes: ["db"], startsAt: null, expiresAt: future, createdBy: "admin" });

    const c1Sessions = await listSupportSessions({ clientId: c1 }) as any[];
    assert.equal(c1Sessions.length, 2, "client filter excludes the other client's sessions");
    assert.equal(c1Sessions.every((s) => s.client_id === c1), true);

    await updateSupportSession(futureSession, { status: "active" });
    await expireSupportAndMaintenance();
    const expired = await getSupportSession(futureSession) as any;
    assert.equal(expired.status, "expired");
    const pending = await getSupportSession(c1Sessions.find((s) => s.id !== futureSession)!.id) as any;
    assert.notEqual(pending.status, "expired", "future-dated sessions are untouched");
  });

  it("maintenance windows progress scheduled -> active -> ended and end when past", async () => {
    const c = await seedClient();
    const now = Date.now();
    const future = new Date(now + 3600000).toISOString();
    const justPast = new Date(now - 1000).toISOString();
    const farPast = new Date(now - 5 * 3600000).toISOString();

    const ended = await createMaintenanceWindow({ clientId: c, reason: "past", startsAt: farPast, endsAt: justPast, approvedBy: "admin" });
    const active = await createMaintenanceWindow({ clientId: c, reason: "in-flight", startsAt: justPast, endsAt: future, approvedBy: "admin" });
    const scheduled = await createMaintenanceWindow({ clientId: c, reason: "upcoming", startsAt: future, endsAt: new Date(now + 2 * 3600000).toISOString(), approvedBy: "admin" });

    await expireSupportAndMaintenance();
    assert.equal((await getMaintenanceWindow(ended) as any).status, "ended");
    assert.equal((await getMaintenanceWindow(active) as any).status, "active");
    assert.equal((await getMaintenanceWindow(scheduled) as any).status, "scheduled");

    const activeList = await listMaintenanceWindows({ clientId: c, status: "active" }) as any[];
    assert.equal(activeList.length, 1);
    assert.equal(activeList[0].id, active);
  });

  // ── USAGE HISTORY ──────────────────────────────────────────────────────────
  it("upserts daily usage per client and lists it", async () => {
    const c = await seedClient();
    await upsertUsageHistory(c, 1, 2, 3.5);
    await upsertUsageHistory(c, 5, 6, 7.25);
    const rows = await listUsageHistory(c, 3) as any[];
    assert.equal(rows.length, 1, "same-day upsert overwrites in place");
    assert.equal(Number(rows[0].orders), 5);
    assert.equal(Number(rows[0].customers), 6);
    assert.equal(Number(rows[0].revenue), 7.25);
  });

  // ── SETTINGS ───────────────────────────────────────────────────────────────
  it("updateOpsSetting validates and persists values", async () => {
    const ok = await updateOpsSetting("heartbeat_stale_min", 15);
    assert.equal(ok.ok, true);
    assert.equal(await getOpsSettingRaw("heartbeat_stale_min"), "15");
    const settings = await getOpsSettings();
    assert.equal(settings.settings.heartbeat_stale_min.value, 15);

    assert.equal((await updateOpsSetting("bogus_key", 5)).ok, false);
    assert.equal((await updateOpsSetting("heartbeat_stale_min", 0)).ok, false);
    assert.equal((await updateOpsSetting("heartbeat_stale_min", -3)).ok, false);
    assert.equal((await updateOpsSetting("heartbeat_stale_min", "abc")).ok, false);
    assert.equal(await getOpsSettingRaw("heartbeat_stale_min"), "15", "invalid values do not clobber the stored setting");
  });

  // ── DIAGNOSTIC REPORTS ─────────────────────────────────────────────────────
  it("diagnostic report redacts secrets and never leaks db URLs", async () => {
    const c = await seedClient();
    await query("UPDATE clients SET cp_secret = $2, neon_db_url = $3 WHERE id = $1", [c, "SUPER_SECRET_123", "postgres://user:pass@internal.example/db"]);
    await ingestHeartbeat(c, { appVersion: "2.0.0", envType: "faas", checks: { mpesa: { status: "unconfigured" } } } as any);

    const { id, summary } = await buildDiagnosticReport(c, "auditor");
    const blob = JSON.stringify(summary);

    assert.ok(summary.client.id === c);
    assert.ok(!blob.includes("SUPER_SECRET_123"), "cp_secret must never appear in a report");
    assert.ok(!blob.includes("postgres://user:pass@internal.example/db"), "neon_db_url must never appear in a report");

    const report = await getReport(id) as any;
    assert.equal(report.status, "ready");
    assert.match(report.filename, /^diagnostic_.+\.json$/);
  });
});