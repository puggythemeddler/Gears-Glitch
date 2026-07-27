import dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import { initControlPlaneDb, queryAll, queryOne, query } from "./db";
import {
  provisionClient,
  deployAllClients,
  checkClientHealth,
  deleteNeonProject,
  deleteRenderService,
  deleteVercelProject,
  fetchClientUsage,
  notifyAllClientsChangelog,
  type ProvisionResult,
} from "./provision";

const app = express();
const PORT = Number(process.env.PORT || 4000);
const API_KEY = process.env.CONTROL_PLANE_API_KEY || "";

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "..", "public")));

// ─── API KEY AUTH ────────────────────────────────────────
function requireApiKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!API_KEY) return next();
  const key = req.headers["x-api-key"] || req.query.key;
  if (key !== API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// ─── ROUTES ──────────────────────────────────────────────

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// List all clients
app.get("/api/clients", requireApiKey, async (_req, res) => {
  try {
    const clients = await queryAll(
      "SELECT id, name, domain, admin_email, plan, status, render_service_url, vercel_project_url, created_at, last_health_check, health_status FROM clients ORDER BY created_at DESC"
    );
    res.json({ clients });
  } catch (err: any) {
    console.error("[api] List clients error:", err.message);
    res.status(500).json({ error: "Failed to list clients" });
  }
});

// Get single client
app.get("/api/clients/:id", requireApiKey, async (req, res) => {
  try {
    const client = await queryOne(
      "SELECT * FROM clients WHERE id = $1",
      [Number(req.params.id)]
    );
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    res.json({ client });
  } catch (err: any) {
    console.error("[api] Get client error:", err.message);
    res.status(500).json({ error: "Failed to get client" });
  }
});

// Add client — starts provisioning
app.post("/api/clients", requireApiKey, async (req, res) => {
  try {
    const { name, adminEmail, plan, domain } = req.body || {};
    if (!name || !adminEmail) {
      res.status(400).json({ error: "name and adminEmail are required" });
      return;
    }

    // Insert placeholder immediately
    const insertResult = await query(
      `INSERT INTO clients (name, domain, admin_email, plan, status)
       VALUES ($1, $2, $3, $4, 'provisioning')
       RETURNING id`,
      [name, domain || "", adminEmail, plan || "starter"]
    );
    const clientId = insertResult.rows[0].id;

    // Provision in background
    provisionClient(name, adminEmail, plan || "starter", domain)
      .then(async (result: ProvisionResult) => {
        const subdomain = result.domain.replace(`.${process.env.DOMAIN_BASE || "gearglitch.com"}`, "");
        await query(
          `UPDATE clients SET
            domain = $1, status = 'active',
            neon_project_id = $2, neon_db_name = $3, neon_db_url = $4,
            render_service_id = $5, render_service_url = $6,
            vercel_project_id = $7, vercel_project_url = $8
          WHERE id = $9`,
          [
            result.domain,
            result.neon.projectId,
            `db_${subdomain}`,
            result.neon.dbUrl,
            result.render.serviceId,
            result.render.serviceUrl,
            result.vercel.projectId,
            result.vercel.projectUrl,
            clientId,
          ]
        );
        console.log(`[api] Client "${name}" provisioned successfully.`);
      })
      .catch(async (err: any) => {
        console.error(`[api] Provisioning failed for "${name}":`, err.message);
        await query(
          `UPDATE clients SET status = 'failed' WHERE id = $1`,
          [clientId]
        );
      });

    res.status(202).json({
      clientId,
      message: `Provisioning started for "${name}". Check status at /api/clients/${clientId}`,
    });
  } catch (err: any) {
    console.error("[api] Create client error:", err.message);
    res.status(500).json({ error: "Failed to create client" });
  }
});

// Add existing client (no provisioning — just records existing URLs)
app.post("/api/clients/existing", requireApiKey, async (req, res) => {
  try {
    const { name, adminEmail, plan, domain, backendUrl, frontendUrl } = req.body || {};
    if (!name || !adminEmail) {
      res.status(400).json({ error: "name and adminEmail are required" });
      return;
    }

    const result = await query(
      `INSERT INTO clients (name, domain, admin_email, plan, status, render_service_url, vercel_project_url, health_status)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, 'unknown')
       RETURNING id`,
      [name, domain || "", adminEmail, plan || "growth", backendUrl || "", frontendUrl || ""]
    );

    res.status(201).json({
      clientId: result.rows[0].id,
      message: `Client "${name}" added successfully.`,
    });
  } catch (err: any) {
    console.error("[api] Add existing client error:", err.message);
    res.status(500).json({ error: "Failed to add client" });
  }
});

// Delete client
app.delete("/api/clients/:id", requireApiKey, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [
      Number(req.params.id),
    ]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }

    // Best-effort cleanup of cloud resources
    const cleanupErrors: string[] = [];

    if (client.neon_project_id) {
      try { await deleteNeonProject(client.neon_project_id); } catch (e: any) { cleanupErrors.push(`Neon: ${e.message}`); }
    }
    if (client.render_service_id) {
      try { await deleteRenderService(client.render_service_id); } catch (e: any) { cleanupErrors.push(`Render: ${e.message}`); }
    }
    if (client.vercel_project_id) {
      try { await deleteVercelProject(client.vercel_project_id); } catch (e: any) { cleanupErrors.push(`Vercel: ${e.message}`); }
    }

    await query("DELETE FROM clients WHERE id = $1", [Number(req.params.id)]);

    res.json({
      message: `Client "${client.name}" deleted.`,
      cleanupErrors: cleanupErrors.length > 0 ? cleanupErrors : undefined,
    });
  } catch (err: any) {
    console.error("[api] Delete client error:", err.message);
    res.status(500).json({ error: "Failed to delete client" });
  }
});

// Deploy all clients
app.post("/api/deploy-all", requireApiKey, async (_req, res) => {
  try {
    const clients = await queryAll(
      "SELECT name, render_service_id FROM clients WHERE status = 'active'"
    );
    const results = await deployAllClients(
      clients as { name: string; render_service_id: string }[]
    );
    res.json({ results });
  } catch (err: any) {
    console.error("[api] Deploy all error:", err.message);
    res.status(500).json({ error: "Failed to deploy" });
  }
});

// Health check all clients
app.post("/api/health-check", requireApiKey, async (_req, res) => {
  try {
    const clients = await queryAll(
      "SELECT id, name, render_service_url FROM clients WHERE status = 'active'"
    );

    const results: { name: string; status: string; orders?: number; customers?: number; revenue?: number }[] = [];
    for (const c of clients as { id: number; name: string; render_service_url: string }[]) {
      const status = await checkClientHealth(c.render_service_url);

      // Track uptime
      await query(
        "UPDATE clients SET health_status = $1, last_health_check = NOW(), total_checks = total_checks + 1, failed_checks = failed_checks + CASE WHEN $1 != 'healthy' THEN 1 ELSE 0 END WHERE id = $2",
        [status, c.id]
      );
      await query(
        "INSERT INTO health_log (client_id, status) VALUES ($1, $2)",
        [c.id, c.id]
      );
      // Recalculate uptime
      const stats: any = await queryOne(
        "SELECT total_checks, failed_checks FROM clients WHERE id = $1",
        [c.id]
      );
      if (stats && stats.total_checks > 0) {
        const uptimePct = ((stats.total_checks - stats.failed_checks) / stats.total_checks) * 100;
        await query("UPDATE clients SET uptime_pct = $1 WHERE id = $2", [uptimePct, c.id]);
      }

      // Fetch usage stats from client backend
      const usage = await fetchClientUsage(c.render_service_url);
      if (usage) {
        await query(
          "UPDATE clients SET usage_orders = $1, usage_customers = $2, usage_revenue = $3 WHERE id = $4",
          [usage.orders || 0, usage.customers || 0, usage.revenue || 0, c.id]
        );
      }

      results.push({ name: c.name, status, orders: usage?.orders, customers: usage?.customers, revenue: usage?.revenue });
    }

    res.json({ results });
  } catch (err: any) {
    console.error("[api] Health check error:", err.message);
    res.status(500).json({ error: "Failed to check health" });
  }
});

// ─── SUSPEND / RESUME CLIENT ─────────────────────────────
app.put("/api/clients/:id/suspend", requireApiKey, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }

    await query("UPDATE clients SET status = 'suspended' WHERE id = $1", [Number(req.params.id)]);

    // Try to pause Render service
    if (client.render_service_id) {
      try {
        await fetch(`https://api.render.com/v1/services/${client.render_service_id}/suspend`, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.RENDER_API_KEY}`, "Content-Type": "application/json" },
        });
      } catch {}
    }

    res.json({ message: `Client "${client.name}" suspended.` });
  } catch (err: any) {
    console.error("[api] Suspend error:", err.message);
    res.status(500).json({ error: "Failed to suspend client" });
  }
});

app.put("/api/clients/:id/resume", requireApiKey, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }

    await query("UPDATE clients SET status = 'active' WHERE id = $1", [Number(req.params.id)]);

    // Resume Render service
    if (client.render_service_id) {
      try {
        await fetch(`https://api.render.com/v1/services/${client.render_service_id}/resume`, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.RENDER_API_KEY}`, "Content-Type": "application/json" },
        });
      } catch {}
    }

    res.json({ message: `Client "${client.name}" resumed.` });
  } catch (err: any) {
    console.error("[api] Resume error:", err.message);
    res.status(500).json({ error: "Failed to resume client" });
  }
});

// ─── UPDATE CLIENT ───────────────────────────────────────
app.put("/api/clients/:id", requireApiKey, async (req, res) => {
  try {
    const { plan, subscription_expires, notes, feature_flags } = req.body || {};
    const id = Number(req.params.id);
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [id]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }

    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (plan !== undefined) { fields.push(`plan = $${idx}`); params.push(plan); idx++; }
    if (subscription_expires !== undefined) { fields.push(`subscription_expires = $${idx}`); params.push(subscription_expires); idx++; }
    if (notes !== undefined) { fields.push(`notes = $${idx}`); params.push(notes); idx++; }
    if (feature_flags !== undefined) { fields.push(`feature_flags = $${idx}`); params.push(JSON.stringify(feature_flags)); idx++; }

    if (fields.length === 0) { res.json({ message: "No changes" }); return; }

    params.push(id);
    await query(`UPDATE clients SET ${fields.join(", ")} WHERE id = $${idx}`, params);

    res.json({ message: "Client updated." });
  } catch (err: any) {
    console.error("[api] Update client error:", err.message);
    res.status(500).json({ error: "Failed to update client" });
  }
});

// ─── HEALTH HISTORY ──────────────────────────────────────
app.get("/api/clients/:id/health-history", requireApiKey, async (req, res) => {
  try {
    const rows = await queryAll(
      "SELECT status, checked_at FROM health_log WHERE client_id = $1 ORDER BY checked_at DESC LIMIT 100",
      [Number(req.params.id)]
    );
    res.json({ history: rows });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get health history" });
  }
});

// ─── CHANGELOG ───────────────────────────────────────────
app.post("/api/changelog", requireApiKey, async (req, res) => {
  try {
    const { version, title, body } = req.body || {};
    if (!version || !title) { res.status(400).json({ error: "version and title required" }); return; }

    await query(
      "INSERT INTO changelog (version, title, body) VALUES ($1, $2, $3)",
      [version, title, body || ""]
    );

    // Notify all clients via email
    await notifyAllClientsChangelog(version, title, body || "");

    res.status(201).json({ message: "Changelog published and clients notified." });
  } catch (err: any) {
    console.error("[api] Changelog error:", err.message);
    res.status(500).json({ error: "Failed to publish changelog" });
  }
});

app.get("/api/changelog", requireApiKey, async (_req, res) => {
  try {
    const entries = await queryAll("SELECT * FROM changelog ORDER BY created_at DESC LIMIT 50");
    res.json({ entries });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get changelog" });
  }
});

// ─── DEPLOY LOG ──────────────────────────────────────────
app.get("/api/deploys", requireApiKey, async (_req, res) => {
  try {
    const entries = await queryAll(
      `SELECT d.*, c.name as client_name FROM deploy_log d
       JOIN clients c ON c.id = d.client_id
       ORDER BY d.triggered_at DESC LIMIT 100`
    );
    res.json({ entries });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get deploy log" });
  }
});

// ─── BACKUPS ─────────────────────────────────────────────
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execAsync = promisify(exec);
const BACKUP_DIR = path.join(__dirname, "..", "..", "backups");

app.post("/api/backups/run", requireApiKey, async (_req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const clients = await queryAll("SELECT id, name, neon_db_url FROM clients WHERE status = 'active' AND neon_db_url != ''");
    const results: { name: string; success: boolean; size?: string; error?: string }[] = [];

    for (const c of clients as { id: number; name: string; neon_db_url: string }[]) {
      const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
      const filename = `${slug}_${new Date().toISOString().split("T")[0]}.sql.gz`;
      const filepath = path.join(BACKUP_DIR, filename);

      try {
        await execAsync(`pg_dump "${c.neon_db_url}" | gzip > "${filepath}"`, { timeout: 120000 });
        const stats = fs.statSync(filepath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

        await query(
          "INSERT INTO deploy_log (client_id, status) VALUES ($1, $2)",
          [c.id, "backup"]
        );

        results.push({ name: c.name, success: true, size: `${sizeMB} MB` });
      } catch (e: any) {
        results.push({ name: c.name, success: false, error: e.message });
      }
    }

    // Cleanup backups older than 7 days
    try {
      const files = fs.readdirSync(BACKUP_DIR);
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      for (const f of files) {
        const fp = path.join(BACKUP_DIR, f);
        if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp);
      }
    } catch {}

    res.json({ results });
  } catch (err: any) {
    console.error("[api] Backup error:", err.message);
    res.status(500).json({ error: "Failed to run backups" });
  }
});

app.get("/api/backups", requireApiKey, async (_req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) { res.json({ files: [] }); return; }
    const files = fs.readdirSync(BACKUP_DIR).map(f => ({
      name: f,
      size: (fs.statSync(path.join(BACKUP_DIR, f)).size / 1024 / 1024).toFixed(2) + " MB",
      date: fs.statSync(BACKUP_DIR + "/" + f).mtime.toISOString(),
    })).sort((a, b) => b.date.localeCompare(a.date));
    res.json({ files });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to list backups" });
  }
});

// ─── CUSTOM PLANS (Control Plane) ──────────────────────────
app.get("/api/plans", requireApiKey, async (_req, res) => {
  try {
    const plans = await queryAll("SELECT * FROM custom_plans ORDER BY tier_level");
    res.json({ plans });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get plans" });
  }
});

app.post("/api/plans", requireApiKey, async (req, res) => {
  try {
    const { id, name, description, price, priceAnnual, tierLevel, maxProducts, maxBranches, features } = req.body || {};
    if (!name) { res.status(400).json({ error: "name required" }); return; }
    const planId = id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
    await query(
      `INSERT INTO custom_plans (id, name, description, price, price_annual, tier_level, max_products, max_branches, features)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT(id) DO UPDATE SET name=$2, description=$3, price=$4, price_annual=$5, tier_level=$6, max_products=$7, max_branches=$8, features=$9`,
      [planId, name, description || "", price || 0, priceAnnual || null, tierLevel || 1, maxProducts ?? 50, maxBranches ?? 1, JSON.stringify(features || [])]
    );
    res.status(201).json({ id: planId, message: `Plan "${name}" saved.` });
  } catch (err: any) {
    console.error("[api] Create plan error:", err.message);
    res.status(500).json({ error: "Failed to create plan" });
  }
});

app.put("/api/plans/:id", requireApiKey, async (req, res) => {
  try {
    const { name, description, price, priceAnnual, tierLevel, maxProducts, maxBranches, features, isActive } = req.body || {};
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx}`); params.push(name); idx++; }
    if (description !== undefined) { fields.push(`description = $${idx}`); params.push(description); idx++; }
    if (price !== undefined) { fields.push(`price = $${idx}`); params.push(price); idx++; }
    if (priceAnnual !== undefined) { fields.push(`price_annual = $${idx}`); params.push(priceAnnual); idx++; }
    if (tierLevel !== undefined) { fields.push(`tier_level = $${idx}`); params.push(tierLevel); idx++; }
    if (maxProducts !== undefined) { fields.push(`max_products = $${idx}`); params.push(maxProducts); idx++; }
    if (maxBranches !== undefined) { fields.push(`max_branches = $${idx}`); params.push(maxBranches); idx++; }
    if (features !== undefined) { fields.push(`features = $${idx}`); params.push(JSON.stringify(features)); idx++; }
    if (isActive !== undefined) { fields.push(`is_active = $${idx}`); params.push(isActive); idx++; }
    if (fields.length === 0) { res.json({ message: "No changes" }); return; }
    params.push(req.params.id);
    await query(`UPDATE custom_plans SET ${fields.join(", ")} WHERE id = $${idx}`, params);
    res.json({ message: "Plan updated." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update plan" });
  }
});

app.delete("/api/plans/:id", requireApiKey, async (req, res) => {
  try {
    await query("DELETE FROM custom_plans WHERE id = $1", [req.params.id]);
    res.json({ message: "Plan deleted." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete plan" });
  }
});

// Push plans to a specific client (sync control plane plans → client's DB)
app.post("/api/clients/:id/sync-plans", requireApiKey, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    if (!client.render_service_url) { res.status(400).json({ error: "Client has no backend URL" }); return; }

    const plans = await queryAll("SELECT * FROM custom_plans ORDER BY tier_level");
    const payload = plans.map((p: any) => ({
      id: p.id, name: p.name, description: p.description,
      price: p.price, priceAnnual: p.price_annual, tierLevel: p.tier_level,
      maxProducts: p.max_products, maxBranches: p.max_branches,
      features: typeof p.features === "string" ? JSON.parse(p.features) : p.features,
      isActive: p.is_active,
    }));

    const result = await fetch(`${client.render_service_url}/api/plans/sync`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plans: payload }),
    });

    if (!result.ok) {
      const text = await result.text();
      res.status(502).json({ error: `Client returned ${result.status}: ${text}` });
      return;
    }
    res.json({ message: `Synced ${plans.length} plans to "${client.name}".` });
  } catch (err: any) {
    console.error("[api] Sync plans error:", err.message);
    res.status(500).json({ error: "Failed to sync plans" });
  }
});

// Push plans to ALL active clients
app.post("/api/plans/sync-all", requireApiKey, async (_req, res) => {
  try {
    const clients = await queryAll("SELECT id, name, render_service_url FROM clients WHERE status = 'active' AND render_service_url != ''");
    const plans = await queryAll("SELECT * FROM custom_plans ORDER BY tier_level");
    const payload = plans.map((p: any) => ({
      id: p.id, name: p.name, description: p.description,
      price: p.price, priceAnnual: p.price_annual, tierLevel: p.tier_level,
      maxProducts: p.max_products, maxBranches: p.max_branches,
      features: typeof p.features === "string" ? JSON.parse(p.features) : p.features,
      isActive: p.is_active,
    }));

    const results: { name: string; success: boolean; error?: string }[] = [];
    for (const c of clients as { id: number; name: string; render_service_url: string }[]) {
      try {
        const r = await fetch(`${c.render_service_url}/api/plans/sync`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plans: payload }),
        });
        results.push({ name: c.name, success: r.ok });
      } catch (e: any) {
        results.push({ name: c.name, success: false, error: e.message });
      }
    }
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to sync all" });
  }
});

// ─── UPGRADE REQUESTS ────────────────────────────────────
// Fetch upgrade requests from a specific client
app.get("/api/clients/:id/upgrade-requests", requireApiKey, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    if (!client.render_service_url) { res.json({ requests: [] }); return; }

    const r = await fetch(`${client.render_service_url}/api/shop/subscription/requests`);
    if (!r.ok) { res.json({ requests: [] }); return; }
    const data = await r.json() as any;
    res.json({ requests: data.requests || [] });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get upgrade requests" });
  }
});

// Approve/reject an upgrade request on a client
app.put("/api/clients/:id/upgrade-requests/:reqId", requireApiKey, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    if (!client.render_service_url) { res.status(400).json({ error: "Client has no backend URL" }); return; }

    const { status } = req.body || {};
    if (!["approved", "rejected"].includes(status)) { res.status(400).json({ error: "status must be approved or rejected" }); return; }

    const r = await fetch(`${client.render_service_url}/api/shop/subscription/requests/${req.params.reqId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!r.ok) {
      const text = await r.text();
      res.status(502).json({ error: `Client returned ${r.status}: ${text}` });
      return;
    }
    res.json({ message: `Request ${status}.` });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update request" });
  }
});

// ─── AUTO HEALTH CHECK (every 5 min) ─────────────────────
setInterval(async () => {
  try {
    const clients = await queryAll("SELECT id, name, render_service_url FROM clients WHERE status = 'active'");
    for (const c of clients as { id: number; name: string; render_service_url: string }[]) {
      const status = await checkClientHealth(c.render_service_url);
      await query(
        "UPDATE clients SET health_status = $1, last_health_check = NOW(), total_checks = total_checks + 1, failed_checks = failed_checks + CASE WHEN $1 != 'healthy' THEN 1 ELSE 0 END WHERE id = $2",
        [status, c.id]
      );
      await query("INSERT INTO health_log (client_id, status) VALUES ($1, $2)", [c.id, status]);
      const stats: any = await queryOne("SELECT total_checks, failed_checks FROM clients WHERE id = $1", [c.id]);
      if (stats && stats.total_checks > 0) {
        const uptimePct = ((stats.total_checks - stats.failed_checks) / stats.total_checks) * 100;
        await query("UPDATE clients SET uptime_pct = $1 WHERE id = $2", [uptimePct, c.id]);
      }
      // Fetch usage
      const usage = await fetchClientUsage(c.render_service_url);
      if (usage) {
        await query("UPDATE clients SET usage_orders = $1, usage_customers = $2, usage_revenue = $3 WHERE id = $4", [usage.orders || 0, usage.customers || 0, usage.revenue || 0, c.id]);
      }
    }
    console.log(`[auto-health] Checked ${clients.length} clients.`);
  } catch (err: any) {
    console.error("[auto-health] Error:", err.message);
  }
}, 5 * 60 * 1000);

// ─── SPA FALLBACK ────────────────────────────────────────
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "public", "index.html"));
});

// ─── START ───────────────────────────────────────────────
async function start() {
  await initControlPlaneDb();
  app.listen(PORT, () => {
    console.log(`[control-plane] Running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("[control-plane] Fatal:", err);
  process.exit(1);
});
