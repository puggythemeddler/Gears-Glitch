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
  type ProvisionResult,
} from "./provision";

const app = express();
const PORT = Number(process.env.PORT || 4000);
const API_KEY = process.env.CONTROL_PLANE_API_KEY || "";

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

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

    const results: { name: string; status: string }[] = [];
    for (const c of clients as { id: number; name: string; render_service_url: string }[]) {
      const status = await checkClientHealth(c.render_service_url);
      await query(
        "UPDATE clients SET health_status = $1, last_health_check = NOW() WHERE id = $2",
        [status, c.id]
      );
      results.push({ name: c.name, status });
    }

    res.json({ results });
  } catch (err: any) {
    console.error("[api] Health check error:", err.message);
    res.status(500).json({ error: "Failed to check health" });
  }
});

// ─── SPA FALLBACK ────────────────────────────────────────
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
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
