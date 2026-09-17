import express from "express";
import rateLimit from "express-rate-limit";
import {
  listOpsOverview,
  listAlerts,
  getAlert,
  updateAlert,
  alertStateCounts,
  listIncidents,
  getIncident,
  createIncident,
  updateIncident,
  addIncidentComment,
  listIncidentComments,
  listReports,
  getReport,
  listHeartbeats,
  listDrift,
  listUsageHistory,
  listSupportSessions,
  getSupportSession,
  updateSupportSession,
  createSupportSession,
  listMaintenanceWindows,
  getMaintenanceWindow,
  updateMaintenanceWindow,
  createMaintenanceWindow,
} from "./ops-db";
import {
  handleHeartbeat,
  deriveHealthState,
  heartbeatAgeMinutes,
  buildDiagnosticReport,
  createIncidentFromAlert,
  getOpsSettings,
  updateOpsSetting,
} from "./ops";
import { queryOne, queryAll } from "./db";

interface Deps {
  requireAuth: express.RequestHandler;
  requireAdmin: express.RequestHandler;
  auditLog: (req: any, action: string, targetType: string, targetId?: number | null, targetName?: string, details?: string) => Promise<void>;
}

const VALID_ALERT_STATES = ["open", "acknowledged", "investigating", "suppressed", "resolved"];
const VALID_ALERT_SEVERITIES = ["info", "warning", "danger"];
const VALID_INCIDENT_STATUS = ["open", "assigned", "investigating", "waiting_client", "waiting_vendor", "monitoring", "resolved", "closed"];
const VALID_INCIDENT_SEVERITY = ["low", "medium", "high", "critical"];
const VALID_INCIDENT_PRIORITY = ["low", "normal", "high", "urgent"];
const VALID_SUPPORT_STATUS = ["pending", "active", "revoked", "expired", "declined"];
const VALID_MAINTENANCE_STATUS = ["scheduled", "active", "ended", "cancelled"];
const SUPPORT_SCOPES = ["diagnostics", "configuration", "data", "billing", "full_access"];

export function registerOpsRoutes(app: express.Application, deps: Deps): void {
  const { requireAuth, requireAdmin, auditLog } = deps;

  // Heartbeat ingestion is server-to-server from the client backends, which
  // authenticate with their per-client secret (resolved by requireAuth). A
  // generous per-IP limit keeps a chatty client from ever wedging ingest.
  const hbLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Heartbeat rate limit exceeded." },
  });

  app.post("/api/heartbeat", hbLimiter, requireAuth, async (req: any, res) => {
    try {
      if (req.user?.role !== "client") {
        res.status(403).json({ error: "Heartbeats must come from an authenticated client." });
        return;
      }
      const result = await handleHeartbeat(req.user.id, req.body);
      if (!result.ok) {
        res.status(400).json({ error: result.reason || "Invalid heartbeat" });
        return;
      }
      res.json({ ok: true, ts: new Date().toISOString() });
    } catch (err: any) {
      console.error("[heartbeat] Error:", err?.message);
      res.status(500).json({ error: "Failed to ingest heartbeat" });
    }
  });

  // ─── OVERVIEW ─────────────────────────────────────────────────────────────
  app.get("/api/ops/overview", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const rows = await listOpsOverview();
      const enriched = rows.map((c: any) => {
        const hs = deriveHealthState(c);
        return {
          ...c,
          derived: hs,
          heartbeatAgeMin: heartbeatAgeMinutes(c.last_heartbeat),
          checks: safeParse(c.latest_checks),
          capabilities: safeParseArray(c.heartbeat_caps),
        };
      });
      const counts = {
        total: enriched.length,
        byStatus: enriched.reduce((acc: Record<string, number>, c: any) => {
          acc[c.derived.status] = (acc[c.derived.status] || 0) + 1;
          return acc;
        }, {}),
        openAlerts: sum(enriched, "open_alerts"),
        openIncidents: sum(enriched, "open_incidents"),
        drift: sum(enriched, "drift_count"),
        maintenance: sum(enriched, "maintenance_count"),
      };
      res.json({ clients: enriched, counts });
    } catch (err: any) {
      console.error("[ops] Overview error:", err?.message);
      res.status(500).json({ error: "Failed to load ops overview" });
    }
  });

  // ─── ALERTS ───────────────────────────────────────────────────────────────
  app.get("/api/ops/alerts", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { state, severity, client_id: clientIdRaw } = req.query as Record<string, string>;
      const alerts = await listAlerts({
        state: VALID_ALERT_STATES.includes(state || "") ? state : undefined,
        severity: VALID_ALERT_SEVERITIES.includes(severity || "") ? severity : undefined,
        clientId: clientIdRaw ? Number(clientIdRaw) : undefined,
      });
      res.json({ alerts });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to load alerts" });
    }
  });

  app.get("/api/ops/alerts/summary", requireAuth, requireAdmin, async (_req, res) => {
    try {
      res.json({ counts: await alertStateCounts() });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to load alert summary" });
    }
  });

  async function loadAlert(req: any, res: express.Response): Promise<any | null> {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid alert id" }); return null; }
    const alert = await getAlert(id);
    if (!alert) { res.status(404).json({ error: "Alert not found" }); return null; }
    return alert;
  }

  app.post("/api/ops/alerts/:id/ack", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const alert = await loadAlert(req, res);
      if (!alert) return;
      await updateAlert(alert.id, { state: "acknowledged", assigned_to: req.user.username, resolved_at: null, resolution: "" });
      await auditLog(req, "ack_alert", "alert", alert.id, alert.title);
      res.json({ message: "Alert acknowledged." });
    } catch (err: any) { res.status(500).json({ error: "Failed to acknowledge alert" }); }
  });

  app.post("/api/ops/alerts/:id/assign", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const alert = await loadAlert(req, res);
      if (!alert) return;
      const assignee = String(req.body?.assignee || "").trim().slice(0, 120);
      if (!assignee) { res.status(400).json({ error: "assignee required" }); return; }
      await updateAlert(alert.id, { assigned_to: assignee, state: alert.state === "resolved" ? "open" : alert.state });
      await auditLog(req, "assign_alert", "alert", alert.id, alert.title, `→ ${assignee}`);
      res.json({ message: `Alert assigned to ${assignee}.` });
    } catch (err: any) { res.status(500).json({ error: "Failed to assign alert" }); }
  });

  app.post("/api/ops/alerts/:id/note", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const alert = await loadAlert(req, res);
      if (!alert) return;
      const note = String(req.body?.notes || "").trim().slice(0, 4000);
      const existing = alert.notes || "";
      const next = (existing ? existing + "\n" : "") + `[${req.user.username}] ${note}`;
      await updateAlert(alert.id, { notes: next.trim().slice(0, 8000) });
      res.json({ message: "Note added." });
    } catch (err: any) { res.status(500).json({ error: "Failed to add note" }); }
  });

  app.post("/api/ops/alerts/:id/resolve", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const alert = await loadAlert(req, res);
      if (!alert) return;
      const resolution = String(req.body?.resolution || "").trim().slice(0, 4000) || "Resolved manually";
      await updateAlert(alert.id, {
        state: "resolved", resolved_at: new Date().toISOString(),
        resolved_by: req.user.username, resolution,
      });
      await auditLog(req, "resolve_alert", "alert", alert.id, alert.title, resolution);
      res.json({ message: "Alert resolved." });
    } catch (err: any) { res.status(500).json({ error: "Failed to resolve alert" }); }
  });

  app.post("/api/ops/alerts/:id/reopen", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const alert = await loadAlert(req, res);
      if (!alert) return;
      await updateAlert(alert.id, { state: "open", resolved_at: null, resolved_by: "", resolution: "" });
      await auditLog(req, "reopen_alert", "alert", alert.id, alert.title);
      res.json({ message: "Alert reopened." });
    } catch (err: any) { res.status(500).json({ error: "Failed to reopen alert" }); }
  });

  app.post("/api/ops/alerts/:id/suppress", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const alert = await loadAlert(req, res);
      if (!alert) return;
      const reason = String(req.body?.reason || "").trim();
      if (reason.length < 3) { res.status(400).json({ error: "A reason (3+ characters) is required." }); return; }
      await updateAlert(alert.id, {
        state: "suppressed", suppressed_at: new Date().toISOString(), suppressed_by: req.user.username,
        notes: (alert.notes ? alert.notes + "\n" : "") + `[${req.user.username}] suppressed: ${reason}`.slice(0, 8000),
      });
      await auditLog(req, "suppress_alert", "alert", alert.id, alert.title, reason);
      res.json({ message: "Alert suppressed." });
    } catch (err: any) { res.status(500).json({ error: "Failed to suppress alert" }); }
  });

  app.post("/api/ops/alerts/:id/unsuppress", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const alert = await loadAlert(req, res);
      if (!alert) return;
      await updateAlert(alert.id, { state: "open", suppressed_at: null, suppressed_by: "" });
      await auditLog(req, "unsuppress_alert", "alert", alert.id, alert.title);
      res.json({ message: "Alert unsuppressed." });
    } catch (err: any) { res.status(500).json({ error: "Failed to unsuppress alert" }); }
  });

  app.post("/api/ops/alerts/:id/incident", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const alert = await loadAlert(req, res);
      if (!alert) return;
      const incident = await createIncidentFromAlert(alert.id, {
        assignee: String(req.body?.assignee || "").trim().slice(0, 120) || undefined,
        createdBy: req.user.username,
        note: String(req.body?.note || "").trim().slice(0, 2000) || undefined,
      });
      await auditLog(req, "create_incident_from_alert", "incident", incident.id, incident.title, `from alert #${alert.id}`);
      res.json({ message: "Incident created from alert.", incident });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to create incident: " + (err?.message || "") });
    }
  });

  // ─── INCIDENTS ────────────────────────────────────────────────────────────
  app.get("/api/ops/incidents", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { status, client_id: clientIdRaw } = req.query as Record<string, string>;
      const incidents = await listIncidents({
        status: VALID_INCIDENT_STATUS.includes(status || "") ? status : undefined,
        clientId: clientIdRaw ? Number(clientIdRaw) : undefined,
      });
      res.json({ incidents });
    } catch (err: any) { res.status(500).json({ error: "Failed to load incidents" }); }
  });

  app.get("/api/ops/incidents/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const incident = await getIncident(id);
      if (!incident) { res.status(404).json({ error: "Incident not found" }); return; }
      const comments = await listIncidentComments(id);
      const client: any = await queryOne("SELECT id, name FROM clients WHERE id = $1", [incident.client_id]);
      res.json({ incident: { ...incident, client_name: client?.name || "" }, comments });
    } catch (err: any) { res.status(500).json({ error: "Failed to load incident" }); }
  });

  app.post("/api/ops/incidents", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const clientId = Number(req.body?.clientId);
      if (!Number.isInteger(clientId) || clientId <= 0) { res.status(400).json({ error: "clientId required" }); return; }
      const client: any = await queryOne("SELECT id, name FROM clients WHERE id = $1", [clientId]);
      if (!client) { res.status(404).json({ error: "Client not found" }); return; }
      const title = String(req.body?.title || "").trim().slice(0, 300);
      if (!title) { res.status(400).json({ error: "title required" }); return; }
      const incident = await createIncident({
        clientId, title,
        description: String(req.body?.description || "").trim().slice(0, 8000),
        severity: VALID_INCIDENT_SEVERITY.includes(req.body?.severity) ? req.body.severity : "medium",
        priority: VALID_INCIDENT_PRIORITY.includes(req.body?.priority) ? req.body.priority : "normal",
        assignee: String(req.body?.assignee || "").trim().slice(0, 120),
        createdBy: req.user.username,
      });
      await auditLog(req, "create_incident", "incident", incident.id, incident.title, client.name);
      res.json({ message: "Incident created.", incident });
    } catch (err: any) { res.status(500).json({ error: "Failed to create incident" }); }
  });

  app.put("/api/ops/incidents/:id", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await getIncident(id);
      if (!existing) { res.status(404).json({ error: "Incident not found" }); return; }
      const b = req.body || {};
      const patch: Record<string, any> = {};
      if (b.status !== undefined) {
        if (!VALID_INCIDENT_STATUS.includes(b.status)) { res.status(400).json({ error: "Invalid status" }); return; }
        patch.status = b.status;
      }
      if (b.severity !== undefined) {
        if (!VALID_INCIDENT_SEVERITY.includes(b.severity)) { res.status(400).json({ error: "Invalid severity" }); return; }
        patch.severity = b.severity;
      }
      if (b.priority !== undefined) {
        if (!VALID_INCIDENT_PRIORITY.includes(b.priority)) { res.status(400).json({ error: "Invalid priority" }); return; }
        patch.priority = b.priority;
      }
      if (b.assignee !== undefined) patch.assignee = String(b.assignee || "").trim().slice(0, 120);
      if (b.title !== undefined) patch.title = String(b.title || "").trim().slice(0, 300);
      if (b.description !== undefined) patch.description = String(b.description || "").trim().slice(0, 8000);
      if (b.resolution_summary !== undefined) patch.resolution_summary = String(b.resolution_summary || "").trim().slice(0, 8000);
      if (b.root_cause !== undefined) patch.root_cause = String(b.root_cause || "").trim().slice(0, 4000);
      if (b.prevention !== undefined) patch.prevention = String(b.prevention || "").trim().slice(0, 4000);
      if (!Object.keys(patch).length) { res.status(400).json({ error: "No fields to update" }); return; }
      await updateIncident(id, patch);
      await auditLog(req, "update_incident", "incident", id, existing.title, JSON.stringify(patch).slice(0, 500));
      res.json({ message: "Incident updated." });
    } catch (err: any) { res.status(500).json({ error: "Failed to update incident" }); }
  });

  app.post("/api/ops/incidents/:id/comments", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await getIncident(id);
      if (!existing) { res.status(404).json({ error: "Incident not found" }); return; }
      const body = String(req.body?.body || "").trim().slice(0, 8000);
      if (!body) { res.status(400).json({ error: "body required" }); return; }
      const visibility = req.body?.visibility === "client" ? "client" : "internal";
      await addIncidentComment(id, req.user.username, body, visibility);
      await auditLog(req, "incident_comment", "incident", id, existing.title);
      res.json({ message: "Comment added." });
    } catch (err: any) { res.status(500).json({ error: "Failed to add comment" }); }
  });

  // ─── CLIENT-SCOPED OPS DATA ───────────────────────────────────────────────
  async function clientExists(req: any, res: express.Response): Promise<number | null> {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid client id" }); return null; }
    const c = await queryOne("SELECT id FROM clients WHERE id = $1", [id]);
    if (!c) { res.status(404).json({ error: "Client not found" }); return null; }
    return id;
  }

  app.get("/api/ops/clients/:id/heartbeats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = await clientExists(req, res);
      if (!id) return;
      res.json({ heartbeats: await listHeartbeats(id, Number(req.query.limit) || 25) });
    } catch (err: any) { res.status(500).json({ error: "Failed to load heartbeats" }); }
  });

  app.get("/api/ops/clients/:id/drift", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = await clientExists(req, res);
      if (!id) return;
      res.json({ drift: await listDrift({ clientId: id }) });
    } catch (err: any) { res.status(500).json({ error: "Failed to load drift" }); }
  });

  app.get("/api/ops/drift", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { state, severity } = req.query as Record<string, string>;
      const all = await listDrift({ state: state === "resolved" || state === "open" ? state : undefined });
      const filtered = severity ? all.filter((d) => d.severity === severity) : all;
      res.json({ drift: filtered });
    } catch (err: any) { res.status(500).json({ error: "Failed to load drift" }); }
  });

  app.get("/api/ops/clients/:id/alerts", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = await clientExists(req, res);
      if (!id) return;
      res.json({ alerts: await listAlerts({ clientId: id }) });
    } catch (err: any) { res.status(500).json({ error: "Failed to load alerts" }); }
  });

  app.get("/api/ops/clients/:id/incidents", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = await clientExists(req, res);
      if (!id) return;
      res.json({ incidents: await listIncidents({ clientId: id }) });
    } catch (err: any) { res.status(500).json({ error: "Failed to load incidents" }); }
  });

  app.get("/api/ops/clients/:id/usage", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = await clientExists(req, res);
      if (!id) return;
      res.json({ usage: await listUsageHistory(id, Number(req.query.days) || 30) });
    } catch (err: any) { res.status(500).json({ error: "Failed to load usage history" }); }
  });

  // ─── DIAGNOSTIC REPORTS ───────────────────────────────────────────────────
  app.post("/api/ops/clients/:id/report", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const id = await clientExists(req, res);
      if (!id) return;
      const client: any = await queryOne("SELECT id, name FROM clients WHERE id = $1", [id]);
      const { summary } = await buildDiagnosticReport(id, req.user.username);
      await auditLog(req, "generate_diagnostic", "client", id, client?.name || "", "Generated diagnostic report");
      res.json({ message: "Report generated.", report: summary });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to generate report: " + (err?.message || "") });
    }
  });

  app.get("/api/ops/clients/:id/reports", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = await clientExists(req, res);
      if (!id) return;
      res.json({ reports: await listReports({ clientId: id }) });
    } catch (err: any) { res.status(500).json({ error: "Failed to load reports" }); }
  });

  app.get("/api/ops/reports", requireAuth, requireAdmin, async (_req, res) => {
    try {
      res.json({ reports: await listReports({ limit: 100 }) });
    } catch (err: any) { res.status(500).json({ error: "Failed to load reports" }); }
  });

  app.get("/api/ops/reports/:id/download", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const report = await getReport(id);
      if (!report) { res.status(404).json({ error: "Report not found" }); return; }
      if (report.status !== "ready" || !report.payload) { res.status(409).json({ error: "Report is not ready." }); return; }
      const client: any = await queryOne("SELECT name FROM clients WHERE id = $1", [report.client_id]);
      await auditLog(req, "download_diagnostic", "client", report.client_id, client?.name || "", `Downloaded report #${id} (${report.filename})`);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${report.filename || "diagnostic.json"}"`);
      res.send(report.payload);
    } catch (err: any) { res.status(500).json({ error: "Failed to download report" }); }
  });

  // ─── SUPPORT ACCESS ───────────────────────────────────────────────────────
  app.get("/api/ops/support", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { status, client_id } = req.query as Record<string, string>;
      const clientId = client_id && Number.isInteger(Number(client_id)) && Number(client_id) > 0 ? Number(client_id) : undefined;
      res.json({
        sessions: await listSupportSessions({
          clientId,
          status: VALID_SUPPORT_STATUS.includes(status || "") ? status : undefined,
        }),
        technicians: await queryAll("SELECT id, username FROM cp_users ORDER BY username ASC"),
      });
    } catch (err: any) { res.status(500).json({ error: "Failed to load support sessions" }); }
  });

  app.post("/api/ops/support", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const clientId = Number(req.body?.clientId);
      if (!Number.isInteger(clientId) || clientId <= 0) { res.status(400).json({ error: "clientId required" }); return; }
      const client: any = await queryOne("SELECT id, name FROM clients WHERE id = $1", [clientId]);
      if (!client) { res.status(404).json({ error: "Client not found" }); return; }

      const technicianId = Number(req.body?.technicianId) || null;
      let technicianName = "";
      if (technicianId) {
        const tech: any = await queryOne("SELECT id, username FROM cp_users WHERE id = $1", [technicianId]);
        if (!tech) { res.status(400).json({ error: "Technician not found" }); return; }
        technicianName = tech.username;
      } else {
        technicianName = req.user.username;
      }

      const scopes = Array.isArray(req.body?.scopes) ? req.body.scopes.filter((s: string) => SUPPORT_SCOPES.includes(s)) : [];
      if (!scopes.length) { res.status(400).json({ error: "At least one scope required" }); return; }

      const durationHours = Math.min(Math.max(Number(req.body?.durationHours) || 24, 1), 720);
      const startsAt = req.body?.startsAt ? new Date(String(req.body.startsAt)).toISOString() : new Date().toISOString();
      const expiresAt = new Date(new Date(startsAt).getTime() + durationHours * 3600000).toISOString();

      const id = await createSupportSession({
        clientId, technicianId, technicianName,
        reason: String(req.body?.reason || "").trim().slice(0, 2000),
        scopes, startsAt, expiresAt,
        createdBy: req.user.username,
      });
      await auditLog(req, "request_support_access", "client", clientId, client.name, `scopes=${scopes.join(",")} ${durationHours}h`);
      res.json({ message: "Support access session requested.", id, expiresAt });
    } catch (err: any) { res.status(500).json({ error: "Failed to create support session" }); }
  });

  app.post("/api/ops/support/:id/approve", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const session = await getSupportSession(id);
      if (!session) { res.status(404).json({ error: "Session not found" }); return; }
      if (session.status !== "pending") { res.status(409).json({ error: "Only pending sessions can be approved." }); return; }
      await updateSupportSession(id, { status: "active", approved_by: req.user.username, approved_at: new Date().toISOString() });
      await auditLog(req, "approve_support_access", "client", session.client_id, session.technician_name, `session #${id}`);
      res.json({ message: "Session approved and activated." });
    } catch (err: any) { res.status(500).json({ error: "Failed to approve session" }); }
  });

  app.post("/api/ops/support/:id/revoke", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const session = await getSupportSession(id);
      if (!session) { res.status(404).json({ error: "Session not found" }); return; }
      if (!["pending", "active"].includes(session.status)) { res.status(409).json({ error: "Session is not revocable in its current state." }); return; }
      await updateSupportSession(id, {
        status: "revoked", revoked_by: req.user.username, revoked_at: new Date().toISOString(),
        revoke_reason: String(req.body?.reason || "").trim().slice(0, 2000),
      });
      await auditLog(req, "revoke_support_access", "client", session.client_id, session.technician_name, `session #${id}`);
      res.json({ message: "Session revoked." });
    } catch (err: any) { res.status(500).json({ error: "Failed to revoke session" }); }
  });

  // ─── MAINTENANCE WINDOWS ──────────────────────────────────────────────────
  app.get("/api/ops/maintenance", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { status, client_id } = req.query as Record<string, string>;
      const clientId = client_id && Number.isInteger(Number(client_id)) && Number(client_id) > 0 ? Number(client_id) : undefined;
      res.json({
        windows: await listMaintenanceWindows({
          clientId,
          status: VALID_MAINTENANCE_STATUS.includes(status || "") ? status : undefined,
        }),
      });
    } catch (err: any) { res.status(500).json({ error: "Failed to load maintenance windows" }); }
  });

  app.post("/api/ops/maintenance", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const clientId = Number(req.body?.clientId);
      if (!Number.isInteger(clientId) || clientId <= 0) { res.status(400).json({ error: "clientId required" }); return; }
      const client: any = await queryOne("SELECT id, name FROM clients WHERE id = $1", [clientId]);
      if (!client) { res.status(404).json({ error: "Client not found" }); return; }

      const startsAt = new Date(String(req.body?.startsAt || ""));
      const endsAt = new Date(String(req.body?.endsAt || ""));
      if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime()) || endsAt.getTime() <= startsAt.getTime()) {
        res.status(400).json({ error: "Valid startsAt and endsAt (ends after start) required" });
        return;
      }
      const services = Array.isArray(req.body?.services) ? req.body.services.filter((s: string) => typeof s === "string").map(String).slice(0, 20) : ["all"];

      const id = await createMaintenanceWindow({
        clientId,
        reason: String(req.body?.reason || "").trim().slice(0, 2000),
        startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
        approvedBy: req.user.username,
        services,
        clientMessage: String(req.body?.clientMessage || "").trim().slice(0, 2000),
      });
      await auditLog(req, "schedule_maintenance", "client", clientId, client.name, `${startsAt.toISOString()} → ${endsAt.toISOString()}`);
      res.json({ message: "Maintenance window scheduled.", id });
    } catch (err: any) { res.status(500).json({ error: "Failed to schedule maintenance" }); }
  });

  app.post("/api/ops/maintenance/:id/cancel", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const window = await getMaintenanceWindow(id);
      if (!window) { res.status(404).json({ error: "Window not found" }); return; }
      if (!["scheduled", "active"].includes(window.status)) { res.status(409).json({ error: "Window cannot be cancelled in its current state." }); return; }
      await updateMaintenanceWindow(id, { status: "cancelled" });
      await auditLog(req, "cancel_maintenance", "client", window.client_id, window.reason || "", `window #${id}`);
      res.json({ message: "Maintenance window cancelled." });
    } catch (err: any) { res.status(500).json({ error: "Failed to cancel window" }); }
  });

  // ─── SETTINGS ─────────────────────────────────────────────────────────────
  app.get("/api/ops/settings", requireAuth, requireAdmin, async (_req, res) => {
    try {
      res.json(await getOpsSettings());
    } catch (err: any) { res.status(500).json({ error: "Failed to load ops settings" }); }
  });

  app.put("/api/ops/settings", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const b = req.body?.settings;
      if (!b || typeof b !== "object") { res.status(400).json({ error: "settings object required" }); return; }
      const updates: Record<string, string> = {};
      for (const [key, value] of Object.entries(b)) {
        const r = await updateOpsSetting(key, value);
        if (!r.ok) { res.status(400).json({ error: `Invalid value for "${key}": ${r.error}` }); return; }
        updates[key] = String(value);
      }
      await auditLog(req, "update_ops_settings", "ops", null, "", JSON.stringify(updates).slice(0, 500));
      res.json({ message: "Settings updated.", settings: (await getOpsSettings()).settings });
    } catch (err: any) { res.status(500).json({ error: "Failed to update settings" }); }
  });

  // ─── RELEASES ─────────────────────────────────────────────────────────────
  app.get("/api/ops/releases", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const latest: any = await queryOne("SELECT * FROM changelog ORDER BY created_at DESC, id DESC LIMIT 1");
      const clients = await queryAll(
        "SELECT id, name, app_version, status, is_test, last_heartbeat FROM clients ORDER BY name ASC"
      );
      const deploys = await queryAll(
        `SELECT d.*, c.name AS client_name FROM deploy_log d LEFT JOIN clients c ON c.id = d.client_id
         ORDER BY d.triggered_at DESC LIMIT 100`
      );
      const outdated = clients.filter((c: any) => latest && latest.version && c.app_version && c.app_version !== latest.version);
      res.json({ latest: latest || null, clients, deploys, outdatedCount: outdated.length });
    } catch (err: any) { res.status(500).json({ error: "Failed to load release status" }); }
  });
}

function safeParse(raw: string): Record<string, any> {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function safeParseArray(raw: string): string[] {
  try { const v = raw ? JSON.parse(raw) : []; return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
}

function sum(arr: Record<string, any>[], key: string): number {
  return arr.reduce((acc, x) => acc + (Number(x[key]) || 0), 0);
}