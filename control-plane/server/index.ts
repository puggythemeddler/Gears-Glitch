import dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { generateSecret, verifySync } from "otplib";
import { generateTOTP } from "@otplib/uri";
import { initControlPlaneDb, queryAll, queryOne, query, getCloudinaryConfig, setCloudinaryConfig } from "./db";
import {
  provisionClient,
  deployAllClients,
  checkClientHealth,
  deleteNeonProject,
  deleteRenderService,
  deleteVercelProject,
  fetchClientUsage,
  notifyAllClientsChangelog,
  cpHeaders,
  generateCpSecret,
  pushControlPlaneSecret,
  type ProvisionResult,
} from "./provision";

const app = express();
const PORT = Number(process.env.PORT || 4000);
const API_KEY = process.env.CONTROL_PLANE_API_KEY || "";
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "..", "public")));

// ─── AUTH: API KEY + JWT SESSION ──────────────────────────
interface AuthUser { id: number; username: string; role: string; }

function generateApiKey(): string {
  return "cp_" + crypto.randomBytes(24).toString("hex");
}

function signToken(user: AuthUser): string {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  // 1. Try Bearer JWT token (from login)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as AuthUser;
      (req as any).user = decoded;
      return next();
    } catch (e: any) { console.warn("[auth] JWT verification failed:", e?.message); }
  }
  // 2. Try x-api-key (legacy + per-user)
  const key = req.headers["x-api-key"] || req.query.key;
  if (key && typeof key === "string") {
    // First check the global legacy API key
    if (API_KEY && key === API_KEY) {
      (req as any).user = { id: 0, username: "system", role: "admin" };
      return next();
    }
    // Then check per-user API keys
    queryOne("SELECT id, username, role FROM cp_users WHERE api_key = $1", [key])
      .then((user) => {
        if (user) {
          (req as any).user = user;
          return next();
        }
        res.status(401).json({ error: "Invalid API key" });
      })
      .catch(() => {
        res.status(500).json({ error: "Auth error" });
      });
    return;
  }
  // 3. No auth provided
  res.status(401).json({ error: "Unauthorized. Provide Bearer token or x-api-key." });
}

function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const user = (req as any).user as AuthUser;
  if (user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

// ─── TOTP 2FA HELPERS ─────────────────────────────────────
function makeTotpSecret(username: string): { secret: string; otpauthUrl: string } {
  const secret = generateSecret();
  const otpauthUrl = generateTOTP({ issuer: "Gear&Glitch Control Plane", label: username, secret });
  return { secret, otpauthUrl };
}

function verifyTotp(secret: string, token: string): boolean {
  try {
    const result = verifySync({ token, secret });
    return result?.valid === true;
  } catch {
    return false;
  }
}

// ─── USER MANAGEMENT ─────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password, totpCode } = req.body || {};
    if (!username || !password) { res.status(400).json({ error: "Username and password required" }); return; }
    const user = await queryOne("SELECT * FROM cp_users WHERE username = $1", [username]);
    if (!user) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }

    // Step 2: 2FA verification
    if (user.totp_enabled) {
      // Allow API-key login to bypass 2FA (programmatic access)
      const isApiKeyLogin = req.headers["x-api-key"] && (req.headers["x-api-key"] === API_KEY || req.headers["x-api-key"] === user.api_key);
      if (!isApiKeyLogin) {
        if (!totpCode) {
          res.json({ totpRequired: true });
          return;
        }
        if (!verifyTotp(user.totp_secret, String(totpCode))) {
          res.status(401).json({ error: "Invalid 2FA code." });
          return;
        }
      }
    }

    await query("UPDATE cp_users SET last_login = NOW() WHERE id = $1", [user.id]);
    const token = signToken({ id: user.id, username: user.username, role: user.role });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, api_key: user.api_key, totpEnabled: !!user.totp_enabled } });
  } catch (err: any) {
    console.error("[auth] Login error:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

// ─── 2FA MANAGEMENT ──────────────────────────────────────
// Step 1: Generate a new TOTP secret (returns secret + QR URL). User must verify with a code to enable.
app.post("/api/auth/2fa/setup", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user as AuthUser;
    const { secret, otpauthUrl } = makeTotpSecret(user.username);
    // Store the pending secret temporarily — not enabled until verified
    await query("UPDATE cp_users SET totp_secret = $1 WHERE id = $2", [secret, user.id]);
    res.json({ secret, otpauthUrl, message: "Scan the QR code in your authenticator app, then verify with a 6-digit code to enable 2FA." });
  } catch (err: any) {
    console.error("[2fa] Setup error:", err.message);
    res.status(500).json({ error: "Failed to set up 2FA" });
  }
});

// Step 2: Verify the code and enable 2FA
app.post("/api/auth/2fa/enable", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user as AuthUser;
    const { totpCode } = req.body || {};
    if (!totpCode) { res.status(400).json({ error: "2FA code required" }); return; }
    const row = await queryOne("SELECT totp_secret FROM cp_users WHERE id = $1", [user.id]);
    if (!row || !row.totp_secret) { res.status(400).json({ error: "Run setup first" }); return; }
    if (!verifyTotp(row.totp_secret, String(totpCode))) {
      res.status(401).json({ error: "Invalid 2FA code. Try again." });
      return;
    }
    await query("UPDATE cp_users SET totp_enabled = true WHERE id = $1", [user.id]);
    res.json({ message: "2FA enabled successfully." });
  } catch (err: any) {
    console.error("[2fa] Enable error:", err.message);
    res.status(500).json({ error: "Failed to enable 2FA" });
  }
});

// Disable 2FA (requires password confirmation)
app.post("/api/auth/2fa/disable", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user as AuthUser;
    const { password } = req.body || {};
    if (!password) { res.status(400).json({ error: "Password required to disable 2FA" }); return; }
    const row = await queryOne("SELECT password_hash FROM cp_users WHERE id = $1", [user.id]);
    if (!row) { res.status(404).json({ error: "User not found" }); return; }
    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) { res.status(401).json({ error: "Invalid password" }); return; }
    await query("UPDATE cp_users SET totp_enabled = false, totp_secret = '' WHERE id = $1", [user.id]);
    res.json({ message: "2FA disabled." });
  } catch (err: any) {
    console.error("[2fa] Disable error:", err.message);
    res.status(500).json({ error: "Failed to disable 2FA" });
  }
});

// Check 2FA status
app.get("/api/auth/2fa/status", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user as AuthUser;
    const row = await queryOne("SELECT totp_enabled FROM cp_users WHERE id = $1", [user.id]);
    res.json({ enabled: !!(row && row.totp_enabled) });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get 2FA status" });
  }
});

app.post("/api/auth/register", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    if (!username || !password) { res.status(400).json({ error: "Username and password required" }); return; }
    const existing = await queryOne("SELECT id FROM cp_users WHERE username = $1", [username]);
    if (existing) { res.status(409).json({ error: "Username already exists" }); return; }
    const hash = await bcrypt.hash(password, 12);
    const apiKey = generateApiKey();
    const result = await query(
      "INSERT INTO cp_users (username, password_hash, role, api_key) VALUES ($1, $2, $3, $4) RETURNING id",
      [username, hash, role || "viewer", apiKey]
    );
    res.status(201).json({ id: result.rows[0].id, username, role: role || "viewer", api_key: apiKey, message: `User "${username}" created.` });
  } catch (err: any) {
    console.error("[auth] Register error:", err.message);
    res.status(500).json({ error: "Failed to create user" });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthUser;
  if (user.id === 0) { res.json({ user: { id: 0, username: "system", role: "admin", totpEnabled: false } }); return; }
  const full = await queryOne("SELECT id, username, role, api_key, created_at, last_login, totp_enabled FROM cp_users WHERE id = $1", [user.id]);
  res.json({ user: { ...full, totpEnabled: !!full?.totp_enabled } });
});

app.get("/api/users", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const users = await queryAll("SELECT id, username, role, api_key, created_at, last_login FROM cp_users ORDER BY created_at DESC");
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to list users" });
  }
});

app.put("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role, password } = req.body || {};
    const id = Number(req.params.id);
    const user = await queryOne("SELECT * FROM cp_users WHERE id = $1", [id]);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (role) {
      await query("UPDATE cp_users SET role = $1 WHERE id = $2", [role, id]);
    }
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      await query("UPDATE cp_users SET password_hash = $1 WHERE id = $2", [hash, id]);
    }
    res.json({ message: "User updated." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

app.post("/api/users/:id/regenerate-key", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const newKey = generateApiKey();
    await query("UPDATE cp_users SET api_key = $1 WHERE id = $2", [newKey, id]);
    res.json({ api_key: newKey, message: "API key regenerated." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to regenerate key" });
  }
});

app.delete("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const me = (req as any).user as AuthUser;
    if (me.id === id) { res.status(400).json({ error: "Cannot delete yourself" }); return; }
    await query("DELETE FROM cp_users WHERE id = $1", [id]);
    res.json({ message: "User deleted." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ─── SEED DEFAULT ADMIN (on startup) ────────────────────
async function seedDefaultAdmin() {
  const existing = await queryOne("SELECT id FROM cp_users WHERE username = $1", ["admin"]);
  if (existing) return;
  const defaultPassword = process.env.CP_ADMIN_PASSWORD || "gearglitch2024";
  const hash = await bcrypt.hash(defaultPassword, 12);
  const apiKey = generateApiKey();
  await query(
    "INSERT INTO cp_users (username, password_hash, role, api_key) VALUES ($1, $2, $3, $4)",
    ["admin", hash, "admin", apiKey]
  );
  console.log("[auth] Default admin user created. Username: admin, set CP_ADMIN_PASSWORD env var to configure.");
}

// ─── ROUTES ──────────────────────────────────────────────

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// List all clients
app.get("/api/clients", requireAuth, async (_req, res) => {
  try {
    const clients = await queryAll(
      "SELECT id, name, domain, admin_email, plan, status, render_service_url, vercel_project_url, created_at, last_health_check, health_status, uptime_pct, total_checks, failed_checks, usage_orders, usage_customers, usage_revenue, subscription_expires, feature_flags, notes FROM clients ORDER BY created_at DESC"
    );
    res.json({ clients });
  } catch (err: any) {
    console.error("[api] List clients error:", err.message);
    res.status(500).json({ error: "Failed to list clients" });
  }
});

// Get single client
app.get("/api/clients/:id", requireAuth, async (req, res) => {
  try {
    const client = await queryOne(
      "SELECT * FROM clients WHERE id = $1",
      [Number(req.params.id)]
    );
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    // Never expose per-client secrets through the API
    delete client.cp_secret;
    delete client.neon_db_url;
    res.json({ client });
  } catch (err: any) {
    console.error("[api] Get client error:", err.message);
    res.status(500).json({ error: "Failed to get client" });
  }
});

// Add client — starts provisioning
app.post("/api/clients", requireAuth, async (req, res) => {
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
            vercel_project_id = $7, vercel_project_url = $8,
            cp_secret = $9
          WHERE id = $10`,
          [
            result.domain,
            result.neon.projectId,
            `db_${subdomain}`,
            result.neon.dbUrl,
            result.render.serviceId,
            result.render.serviceUrl,
            result.vercel.projectId,
            result.vercel.projectUrl,
            result.cpSecret,
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
app.post("/api/clients/existing", requireAuth, async (req, res) => {
  try {
    const { name, adminEmail, plan, domain, backendUrl, frontendUrl, renderServiceId, cpSecret } = req.body || {};
    if (!name || !adminEmail) {
      res.status(400).json({ error: "name and adminEmail are required" });
      return;
    }

    // Use the provided secret (already configured on the client) or generate one
    // that must then be pushed via POST /api/clients/:id/push-secret.
    const secret = cpSecret || generateCpSecret();

    const result = await query(
      `INSERT INTO clients (name, domain, admin_email, plan, status, render_service_id, render_service_url, vercel_project_url, health_status, cp_secret)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, 'unknown', $8)
       RETURNING id`,
      [name, domain || "", adminEmail, plan || "growth", renderServiceId || "", backendUrl || "", frontendUrl || "", secret]
    );

    res.status(201).json({
      clientId: result.rows[0].id,
      cpSecretGenerated: !cpSecret,
      message: cpSecret
        ? `Client "${name}" added successfully.`
        : `Client "${name}" added. A control-plane secret was generated — push it to the client with POST /api/clients/${result.rows[0].id}/push-secret (requires renderServiceId) or set CONTROL_PLANE_SECRET manually.`,
    });
  } catch (err: any) {
    console.error("[api] Add existing client error:", err.message);
    res.status(500).json({ error: "Failed to add client" });
  }
});

// Push (or rotate) the control-plane secret onto a client's Render service.
// Enables full remote management for clients provisioned before secrets existed.
app.post("/api/clients/:id/push-secret", requireAuth, requireAdmin, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    if (!client.render_service_id) { res.status(400).json({ error: "Client has no Render service ID. Set it first (PUT /api/clients/:id) or configure CONTROL_PLANE_SECRET manually." }); return; }

    const rotate = Boolean(req.body?.rotate);
    const secret = (!rotate && client.cp_secret) ? client.cp_secret : generateCpSecret();

    await pushControlPlaneSecret(client.render_service_id, secret);
    await query("UPDATE clients SET cp_secret = $1 WHERE id = $2", [secret, client.id]);

    res.json({ message: `Control-plane secret ${rotate ? "rotated" : "pushed"} to "${client.name}". The service is redeploying.` });
  } catch (err: any) {
    console.error("[api] Push secret error:", err.message);
    res.status(500).json({ error: err.message || "Failed to push secret" });
  }
});

// Delete client
app.delete("/api/clients/:id", requireAuth, async (req, res) => {
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
app.post("/api/deploy-all", requireAuth, async (_req, res) => {
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

// ─── CLOUDINARY SYNC ────────────────────────────────────
// Push shared Cloudinary credentials to all active clients
app.post("/api/sync-cloudinary", requireAuth, async (_req, res) => {
  try {
    const cc = await getCloudinaryConfig();
    if (!cc || !cc.cloud_name || !cc.api_key || !cc.api_secret) {
      res.status(400).json({ error: "No Cloudinary config stored. Pull from a client first." });
      return;
    }

    const clients = await queryAll(
      "SELECT id, name, render_service_id FROM clients WHERE status = 'active' AND render_service_id != ''"
    );
    if (!clients.length) { res.json({ message: "No active clients.", results: [] }); return; }

    const results: { name: string; success: boolean; error?: string; folder?: string }[] = [];
    const RENDER_API_KEY = process.env.RENDER_API_KEY || "";

    for (const c of clients as { id: number; name: string; render_service_id: string }[]) {
      const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
      const folder = `gear-glitch/${slug}`;

      try {
        const r = await fetch(`https://api.render.com/v1/services/${c.render_service_id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${RENDER_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            envVars: [
              { key: "CLOUDINARY_CLOUD_NAME", value: cc.cloud_name },
              { key: "CLOUDINARY_API_KEY", value: cc.api_key },
              { key: "CLOUDINARY_API_SECRET", value: cc.api_secret },
              { key: "CLOUDINARY_FOLDER", value: folder },
            ],
          }),
        });

        if (r.ok) {
          await fetch(`https://api.render.com/v1/services/${c.render_service_id}/deploys`, {
            method: "POST",
            headers: { Authorization: `Bearer ${RENDER_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ clear_cache: false }),
          });
          results.push({ name: c.name, success: true, folder });
        } else {
          const text = await r.text();
          results.push({ name: c.name, success: false, error: `HTTP ${r.status}: ${text}` });
        }
      } catch (e: any) {
        results.push({ name: c.name, success: false, error: e.message });
      }
    }

    const ok = results.filter(r => r.success).length;
    const fail = results.filter(r => !r.success).length;
    res.json({ message: `Cloudinary synced: ${ok} ok, ${fail} failed`, results });
  } catch (err: any) {
    console.error("[api] Sync Cloudinary error:", err.message);
    res.status(500).json({ error: "Failed to sync Cloudinary" });
  }
});

// Pull Cloudinary config from a live client
app.post("/api/pull-cloudinary/:id", requireAuth, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    if (!client.render_service_url) { res.status(400).json({ error: "Client has no backend URL" }); return; }

    const r = await fetch(`${client.render_service_url}/api/cloudinary-config`, { headers: cpHeaders(client.cp_secret), signal: AbortSignal.timeout(15000) });
    if (!r.ok) { res.status(502).json({ error: `Client returned ${r.status}` }); return; }
    const data: any = await r.json();

    if (!data.configured) {
      res.status(400).json({ error: "Client has no Cloudinary configured" });
      return;
    }

    await setCloudinaryConfig(data.cloudName, data.apiKey, data.apiSecret, data.folder || "gear-glitch");
    res.json({ message: `Cloudinary config pulled from "${client.name}".`, folder: data.folder });
  } catch (err: any) {
    console.error("[api] Pull Cloudinary error:", err.message);
    res.status(500).json({ error: "Failed to pull Cloudinary config" });
  }
});

// Get stored Cloudinary config status
app.get("/api/cloudinary", requireAuth, async (_req, res) => {
  try {
    const cc = await getCloudinaryConfig();
    if (!cc || !cc.cloud_name) {
      res.json({ configured: false });
      return;
    }
    res.json({ configured: true, cloudName: cc.cloud_name, hasApiKey: !!cc.api_key, hasApiSecret: !!cc.api_secret, folder: cc.folder, updatedAt: cc.updated_at });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get Cloudinary config" });
  }
});

// Health check all clients
app.post("/api/health-check", requireAuth, async (_req, res) => {
  try {
    const clients = await queryAll(
      "SELECT id, name, render_service_url, cp_secret FROM clients WHERE status = 'active'"
    );

    const results: { name: string; status: string; orders?: number; customers?: number; revenue?: number }[] = [];
    for (const c of clients as { id: number; name: string; render_service_url: string; cp_secret: string }[]) {
      const status = await checkClientHealth(c.render_service_url, c.cp_secret);

      // Track uptime
      await query(
        "UPDATE clients SET health_status = $1, last_health_check = NOW(), total_checks = total_checks + 1, failed_checks = failed_checks + CASE WHEN $1 != 'healthy' THEN 1 ELSE 0 END WHERE id = $2",
        [status, c.id]
      );
      await query(
        "INSERT INTO health_log (client_id, status) VALUES ($1, $2)",
        [c.id, status]
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
      const usage = await fetchClientUsage(c.render_service_url, c.cp_secret);
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
app.put("/api/clients/:id/suspend", requireAuth, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }

    await query("UPDATE clients SET status = 'suspended' WHERE id = $1", [Number(req.params.id)]);

    // App-level suspend first (store returns 403 to visitors even if infra stays up)
    let appSuspended = false;
    if (client.render_service_url && client.cp_secret) {
      try {
        const r = await fetch(`${client.render_service_url}/api/control-plane/suspend`, {
          method: "POST",
          headers: cpHeaders(client.cp_secret),
          signal: AbortSignal.timeout(20000),
        });
        appSuspended = r.ok;
      } catch (e: any) { console.warn("[suspend] App-level suspend failed:", e?.message); }
    }

    // Then pause the Render service
    if (client.render_service_id) {
      try {
        await fetch(`https://api.render.com/v1/services/${client.render_service_id}/suspend`, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.RENDER_API_KEY}`, "Content-Type": "application/json" },
        });
      } catch (e: any) { console.warn("[render] API call failed:", e?.message); }
    }

    res.json({ message: `Client "${client.name}" suspended.`, appSuspended });
  } catch (err: any) {
    console.error("[api] Suspend error:", err.message);
    res.status(500).json({ error: "Failed to suspend client" });
  }
});

app.put("/api/clients/:id/resume", requireAuth, async (req, res) => {
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
      } catch (e: any) { console.warn("[render] API call failed:", e?.message); }
    }

    // Clear the app-level suspend flag (retry a few times while the service wakes)
    let appResumed = false;
    if (client.render_service_url && client.cp_secret) {
      for (let attempt = 0; attempt < 3 && !appResumed; attempt++) {
        try {
          const r = await fetch(`${client.render_service_url}/api/control-plane/resume`, {
            method: "POST",
            headers: cpHeaders(client.cp_secret),
            signal: AbortSignal.timeout(30000),
          });
          appResumed = r.ok;
        } catch (e: any) { console.warn("[resume] App-level resume attempt failed:", e?.message); }
        if (!appResumed) await new Promise(r => setTimeout(r, 10000));
      }
    }

    res.json({ message: `Client "${client.name}" resumed.`, appResumed, note: appResumed ? undefined : "App-level resume not confirmed; the flag will clear when the service is reachable — retry via PUT /api/clients/:id/resume." });
  } catch (err: any) {
    console.error("[api] Resume error:", err.message);
    res.status(500).json({ error: "Failed to resume client" });
  }
});

// ─── UPDATE CLIENT ───────────────────────────────────────
app.put("/api/clients/:id", requireAuth, async (req, res) => {
  try {
    const { plan, subscription_expires, notes, feature_flags, render_service_id } = req.body || {};
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
    if (render_service_id !== undefined) { fields.push(`render_service_id = $${idx}`); params.push(render_service_id); idx++; }

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
app.get("/api/clients/:id/health-history", requireAuth, async (req, res) => {
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
app.post("/api/changelog", requireAuth, async (req, res) => {
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

app.get("/api/changelog", requireAuth, async (_req, res) => {
  try {
    const entries = await queryAll("SELECT * FROM changelog ORDER BY created_at DESC LIMIT 50");
    res.json({ entries });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get changelog" });
  }
});

// ─── DEPLOY LOG ──────────────────────────────────────────
app.get("/api/deploys", requireAuth, async (_req, res) => {
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

app.post("/api/backups/run", requireAuth, async (_req, res) => {
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
    } catch (e: any) { console.warn("[startup] Failed to clean old backups:", e?.message); }

    res.json({ results });
  } catch (err: any) {
    console.error("[api] Backup error:", err.message);
    res.status(500).json({ error: "Failed to run backups" });
  }
});

app.get("/api/backups", requireAuth, async (_req, res) => {
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
app.get("/api/plans", requireAuth, async (_req, res) => {
  try {
    const plans = await queryAll("SELECT * FROM custom_plans ORDER BY tier_level");
    res.json({ plans });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get plans" });
  }
});

// Pull plans from a live client backend
app.post("/api/clients/:id/pull-plans", requireAuth, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    if (!client.render_service_url) { res.status(400).json({ error: "Client has no backend URL" }); return; }

    const result = await fetch(`${client.render_service_url}/api/plans/all`, { headers: cpHeaders(client.cp_secret), signal: AbortSignal.timeout(15000) });
    if (!result.ok) { res.status(502).json({ error: `Client returned ${result.status}` }); return; }
    const data: any = await result.json();
    const plans = data.plans || [];
    let imported = 0;
    for (const p of plans) {
      await query(
        `INSERT INTO custom_plans (id, name, description, price, price_annual, tier_level, max_products, max_branches, features, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT(id) DO UPDATE SET name=$2, description=$3, price=$4, price_annual=$5, tier_level=$6, max_products=$7, max_branches=$8, features=$9, is_active=$10`,
        [p.id, p.name, p.description || "", p.price || 0, p.priceAnnual || p.price_annual || null, p.tierLevel || p.tier_level || 1, p.maxProducts || p.max_products || 50, p.maxBranches || p.max_branches || 1, JSON.stringify(p.features || []), p.isActive !== undefined ? p.isActive : (p.is_active !== undefined ? p.is_active : true)]
      );
      imported++;
    }
    res.json({ message: `Imported ${imported} plans from "${client.name}".`, imported });
  } catch (err: any) {
    console.error("[api] Pull plans error:", err.message);
    res.status(500).json({ error: "Failed to pull plans from client" });
  }
});

// Import plans from the Gear&Glitch Store (first active client)
app.post("/api/plans/import-defaults", requireAuth, async (_req, res) => {
  try {
    const clients = await queryAll("SELECT id, name, render_service_url, cp_secret FROM clients WHERE status = 'active' AND render_service_url != ''");
    if (!clients.length) { res.status(400).json({ error: "No active clients found" }); return; }

    let imported = 0;
    for (const c of clients as { id: number; name: string; render_service_url: string; cp_secret: string }[]) {
      try {
        const result = await fetch(`${c.render_service_url}/api/plans/all`, { headers: cpHeaders(c.cp_secret), signal: AbortSignal.timeout(15000) });
        if (!result.ok) continue;
        const data: any = await result.json();
        const plans = data.plans || [];
        if (!plans.length) continue;

        for (const p of plans) {
          await query(
            `INSERT INTO custom_plans (id, name, description, price, price_annual, tier_level, max_products, max_branches, features, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT(id) DO UPDATE SET name=$2, description=$3, price=$4, price_annual=$5, tier_level=$6, max_products=$7, max_branches=$8, features=$9, is_active=$10`,
            [p.id, p.name, p.description || "", p.price || 0, p.priceAnnual || p.price_annual || null, p.tierLevel || p.tier_level || 1, p.maxProducts || p.max_products || 50, p.maxBranches || p.max_branches || 1, JSON.stringify(p.features || []), p.isActive !== undefined ? p.isActive : (p.is_active !== undefined ? p.is_active : true)]
          );
          imported++;
        }
        console.log(`[api] Imported ${plans.length} plans from "${c.name}".`);
        break;
      } catch (e: any) { console.warn("[plans] Operation failed:", e?.message); }
    }
    res.json({ message: `Imported ${imported} plans.`, imported });
  } catch (err: any) {
    console.error("[api] Import defaults error:", err.message);
    res.status(500).json({ error: "Failed to import plans" });
  }
});

app.post("/api/plans", requireAuth, async (req, res) => {
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

app.put("/api/plans/:id", requireAuth, async (req, res) => {
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

app.delete("/api/plans/:id", requireAuth, async (req, res) => {
  try {
    await query("DELETE FROM custom_plans WHERE id = $1", [req.params.id]);
    res.json({ message: "Plan deleted." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete plan" });
  }
});

// Push plans to a specific client (sync control plane plans → client's DB)
app.post("/api/clients/:id/sync-plans", requireAuth, async (req, res) => {
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
      headers: cpHeaders(client.cp_secret, { "Content-Type": "application/json" }),
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
app.post("/api/plans/sync-all", requireAuth, async (_req, res) => {
  try {
    const clients = await queryAll("SELECT id, name, render_service_url, cp_secret FROM clients WHERE status = 'active' AND render_service_url != ''");
    const plans = await queryAll("SELECT * FROM custom_plans ORDER BY tier_level");
    const payload = plans.map((p: any) => ({
      id: p.id, name: p.name, description: p.description,
      price: p.price, priceAnnual: p.price_annual, tierLevel: p.tier_level,
      maxProducts: p.max_products, maxBranches: p.max_branches,
      features: typeof p.features === "string" ? JSON.parse(p.features) : p.features,
      isActive: p.is_active,
    }));

    const results: { name: string; success: boolean; error?: string }[] = [];
    for (const c of clients as { id: number; name: string; render_service_url: string; cp_secret: string }[]) {
      try {
        const r = await fetch(`${c.render_service_url}/api/plans/sync`, {
          method: "PUT",
          headers: cpHeaders(c.cp_secret, { "Content-Type": "application/json" }),
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
app.get("/api/clients/:id/upgrade-requests", requireAuth, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    if (!client.render_service_url) { res.json({ requests: [] }); return; }

    const r = await fetch(`${client.render_service_url}/api/shop/subscription/requests`, { headers: cpHeaders(client.cp_secret) });
    if (!r.ok) { res.json({ requests: [] }); return; }
    const data = await r.json() as any;
    res.json({ requests: data.requests || [] });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get upgrade requests" });
  }
});

// Approve/reject an upgrade request on a client
app.put("/api/clients/:id/upgrade-requests/:reqId", requireAuth, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    if (!client.render_service_url) { res.status(400).json({ error: "Client has no backend URL" }); return; }

    const { status } = req.body || {};
    if (!["approved", "rejected"].includes(status)) { res.status(400).json({ error: "status must be approved or rejected" }); return; }

    const r = await fetch(`${client.render_service_url}/api/shop/subscription/requests/${req.params.reqId}`, {
      method: "PUT",
      headers: cpHeaders(client.cp_secret, { "Content-Type": "application/json" }),
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

// ─── CLIENT INVOICES (proxy to client backends) ──────────────
app.get("/api/clients/:id/invoices", requireAuth, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    if (!client.render_service_url) { res.json({ invoices: [], stats: null }); return; }

    const invoicesData = await fetch(`${client.render_service_url}/api/admin/invoices`, { headers: cpHeaders(client.cp_secret) }).then(r => r.ok ? r.json() : { invoices: [], stats: null }).catch(() => ({ invoices: [], stats: null })) as any;

    res.json({ invoices: invoicesData.invoices || [], stats: invoicesData.stats || null });
  } catch (err: any) {
    console.error("[api] Get client invoices error:", err.message);
    res.status(500).json({ error: "Failed to get invoices" });
  }
});

app.post("/api/clients/:id/invoices/generate", requireAuth, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    if (!client.render_service_url) { res.status(400).json({ error: "Client has no backend URL" }); return; }

    const r = await fetch(`${client.render_service_url}/api/admin/invoices/generate`, {
      method: "POST",
      headers: cpHeaders(client.cp_secret, { "Content-Type": "application/json" }),
      body: JSON.stringify(req.body || {}),
    });
    const data = await r.json();
    if (!r.ok) { res.status(r.status).json(data); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to generate invoice" });
  }
});

app.post("/api/clients/:id/invoices/:invId/pay", requireAuth, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    if (!client.render_service_url) { res.status(400).json({ error: "Client has no backend URL" }); return; }

    const r = await fetch(`${client.render_service_url}/api/admin/invoices/${req.params.invId}/pay`, { method: "POST", headers: cpHeaders(client.cp_secret) });
    const data = await r.json();
    if (!r.ok) { res.status(r.status).json(data); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to mark invoice paid" });
  }
});

app.get("/api/clients/:id/invoices/:invId/view", requireAuth, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    if (!client.render_service_url) { res.status(400).json({ error: "Client has no backend URL" }); return; }

    const format = req.query.format as string;
    const r = await fetch(`${client.render_service_url}/api/admin/invoices/${req.params.invId}/view${format === "pdf" ? "?format=pdf" : ""}`, { headers: cpHeaders(client.cp_secret) });
    if (!r.ok) { res.status(r.status).json({ error: `Client returned ${r.status}` }); return; }

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="invoice-${req.params.invId}.pdf"`);
      const buffer = await r.arrayBuffer();
      res.send(Buffer.from(buffer));
    } else {
      const html = await r.text();
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get invoice" });
  }
});

app.post("/api/clients/:id/invoices/:invId/email", requireAuth, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    if (!client.render_service_url) { res.status(400).json({ error: "Client has no backend URL" }); return; }

    const r = await fetch(`${client.render_service_url}/api/admin/invoices/${req.params.invId}/email`, { method: "POST", headers: cpHeaders(client.cp_secret) });
    const data = await r.json();
    if (!r.ok) { res.status(r.status).json(data); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to email invoice" });
  }
});

// Get subscription status from a client
app.get("/api/clients/:id/subscription", requireAuth, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    if (!client.render_service_url) { res.json({ plan: null, activatedAt: null }); return; }

    const r = await fetch(`${client.render_service_url}/api/shop/subscription`, { headers: cpHeaders(client.cp_secret) });
    if (!r.ok) { res.json({ plan: null, activatedAt: null }); return; }
    const data = await r.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get subscription" });
  }
});

// ─── CLIENT BRANCHES ─────────────────────────────────────
// Get branches from a client
app.get("/api/clients/:id/branches", requireAuth, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    if (client.status !== "active" && client.status !== "provisioning") { res.json([]); return; }
    if (!client.render_service_url) { res.json([]); return; }
    const resp = await fetch(`${client.render_service_url}/api/admin/branches`, { headers: cpHeaders(client.cp_secret), signal: AbortSignal.timeout(20000) });
    if (!resp.ok) { res.json([]); return; }
    const branches = await resp.json();
    res.json(Array.isArray(branches) ? branches : []);
  } catch (err: any) {
    res.json([]);
  }
});

// Get branch subscription from client
app.get("/api/clients/:id/branches/:branchId/subscription", requireAuth, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    if (!client.render_service_url) { res.status(400).json({ error: "Client has no backend URL" }); return; }
    const resp = await fetch(`${client.render_service_url}/api/admin/branches/${req.params.branchId}/subscription`, { headers: cpHeaders(client.cp_secret), signal: AbortSignal.timeout(20000) });
    if (!resp.ok) { res.status(resp.status).json({ error: "Client API error" }); return; }
    const sub = await resp.json();
    res.json(sub);
  } catch (err: any) {
    res.status(502).json({ error: "Client unreachable" });
  }
});

// Set branch plan on client
app.put("/api/clients/:id/branches/:branchId/plan", requireAuth, async (req, res) => {
  try {
    const client = await queryOne("SELECT * FROM clients WHERE id = $1", [Number(req.params.id)]);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    if (!client.render_service_url) { res.status(400).json({ error: "Client has no backend URL" }); return; }
    const resp = await fetch(`${client.render_service_url}/api/admin/branches/${req.params.branchId}/plan`, {
      method: "PUT",
      headers: cpHeaders(client.cp_secret, { "Content-Type": "application/json" }),
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) { res.status(resp.status).json({ error: "Client API error" }); return; }
    const sub = await resp.json();
    res.json(sub);
  } catch (err: any) {
    res.status(502).json({ error: "Client unreachable" });
  }
});

// ─── AUTO HEALTH CHECK (every 5 min) ─────────────────────
setInterval(async () => {
  try {
    const clients = await queryAll("SELECT id, name, render_service_url, cp_secret FROM clients WHERE status = 'active'");
    for (const c of clients as { id: number; name: string; render_service_url: string; cp_secret: string }[]) {
      const status = await checkClientHealth(c.render_service_url, c.cp_secret);
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
      const usage = await fetchClientUsage(c.render_service_url, c.cp_secret);
      if (usage) {
        await query("UPDATE clients SET usage_orders = $1, usage_customers = $2, usage_revenue = $3 WHERE id = $4", [usage.orders || 0, usage.customers || 0, usage.revenue || 0, c.id]);
      }
    }
    console.log(`[auto-health] Checked ${clients.length} clients.`);
  } catch (err: any) {
    console.error("[auto-health] Error:", err.message);
  }
}, 5 * 60 * 1000);

// ─── AUTO BACKUP (daily at 3 AM) ────────────────────────────
function scheduleAutoBackup() {
  const now = new Date();
  const next3AM = new Date(now);
  next3AM.setHours(3, 0, 0, 0);
  if (next3AM <= now) next3AM.setDate(next3AM.getDate() + 1);
  const delay = next3AM.getTime() - now.getTime();
  setTimeout(async () => {
    try {
      if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const clients = await queryAll("SELECT id, name, neon_db_url FROM clients WHERE status = 'active' AND neon_db_url != ''");
      for (const c of clients as { id: number; name: string; neon_db_url: string }[]) {
        const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
        const filepath = path.join(BACKUP_DIR, `${slug}_${new Date().toISOString().split("T")[0]}.sql.gz`);
        try {
          await execAsync(`pg_dump "${c.neon_db_url}" | gzip > "${filepath}"`, { timeout: 120000 });
          await query("INSERT INTO deploy_log (client_id, status) VALUES ($1, $2)", [c.id, "backup"]);
        } catch (e: any) { console.warn("[startup] Auto backup pg_dump failed:", e?.message); }
      }
      // Cleanup backups older than 7 days
      try {
        const files = fs.readdirSync(BACKUP_DIR);
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        for (const f of files) {
          const fp = path.join(BACKUP_DIR, f);
          if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp);
        }
      } catch (e: any) { console.warn("[startup] Failed to clean old auto-backups:", e?.message); }
      console.log(`[auto-backup] Backed up ${clients.length} clients.`);
    } catch (err: any) { console.error("[auto-backup] Error:", err.message); }
    scheduleAutoBackup();
  }, delay);
}

// ─── STARTUP PLAN IMPORT ─────────────────────────────────
async function autoImportPlans() {
  try {
    const existing = await queryOne("SELECT COUNT(*) AS count FROM custom_plans") as any;
    if (existing && Number(existing.count) > 0) {
      console.log("[startup-plans] Plans already exist, skipping auto-import.");
      return;
    }
    const clients = await queryAll("SELECT id, name, render_service_url FROM clients WHERE status = 'active' AND render_service_url != ''");
    if (!clients.length) { console.log("[startup-plans] No active clients found."); return; }

    for (const c of clients as { id: number; name: string; render_service_url: string }[]) {
      try {
        const result = await fetch(`${c.render_service_url}/api/plans/all`, { signal: AbortSignal.timeout(15000) });
        if (!result.ok) continue;
        const data: any = await result.json();
        const plans = data.plans || [];
        if (!plans.length) continue;

        for (const p of plans) {
          await query(
            `INSERT INTO custom_plans (id, name, description, price, price_annual, tier_level, max_products, max_branches, features, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT(id) DO UPDATE SET name=$2, description=$3, price=$4, price_annual=$5, tier_level=$6, max_products=$7, max_branches=$8, features=$9, is_active=$10`,
            [p.id, p.name, p.description || "", p.price || 0, p.priceAnnual || p.price_annual || null, p.tierLevel || p.tier_level || 1, p.maxProducts || p.max_products || 50, p.maxBranches || p.max_branches || 1, JSON.stringify(p.features || []), p.isActive !== undefined ? p.isActive : (p.is_active !== undefined ? p.is_active : true)]
          );
        }
        console.log(`[startup-plans] Imported ${plans.length} plans from "${c.name}".`);
        break;
      } catch (e: any) { console.warn("[startup] Failed to import plans from client:", e?.message); }
    }
  } catch (err: any) {
    console.error("[startup-plans] Error:", err.message);
  }
}

// ─── STARTUP CLOUDINARY IMPORT ────────────────────────────
async function autoImportCloudinary() {
  try {
    const existing = await getCloudinaryConfig();
    if (existing && existing.cloud_name) {
      console.log("[startup-cloudinary] Cloudinary config already stored, skipping.");
      return;
    }
    const clients = await queryAll("SELECT id, name, render_service_url FROM clients WHERE status = 'active' AND render_service_url != ''");
    if (!clients.length) { console.log("[startup-cloudinary] No active clients found."); return; }

    for (const c of clients as { id: number; name: string; render_service_url: string }[]) {
      try {
        const r = await fetch(`${c.render_service_url}/api/cloudinary-config`, { signal: AbortSignal.timeout(15000) });
        if (!r.ok) continue;
        const data: any = await r.json();
        if (!data.configured) continue;

        await setCloudinaryConfig(data.cloudName, data.apiKey, data.apiSecret, data.folder || "gear-glitch");
        console.log(`[startup-cloudinary] Imported Cloudinary config from "${c.name}" (folder: ${data.folder}).`);
        return;
      } catch (e: any) { console.warn("[startup] Failed to import Cloudinary config from client:", e?.message); }
    }
    console.log("[startup-cloudinary] No client had Cloudinary configured.");
  } catch (err: any) {
    console.error("[startup-cloudinary] Error:", err.message);
  }
}

// ─── STARTUP HEALTH CHECK ──────────────────────────────────
async function runStartupHealthCheck() {
  try {
    const clients = await queryAll("SELECT id, name, render_service_url FROM clients WHERE status = 'active'");
    if (!clients.length) return;
    console.log(`[startup-health] Checking ${clients.length} clients...`);
    for (const c of clients as { id: number; name: string; render_service_url: string }[]) {
      try {
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
        const usage = await fetchClientUsage(c.render_service_url);
        if (usage) {
          await query("UPDATE clients SET usage_orders = $1, usage_customers = $2, usage_revenue = $3 WHERE id = $4", [usage.orders || 0, usage.customers || 0, usage.revenue || 0, c.id]);
        }
      } catch (e: any) { console.warn("[startup] Health check failed for client:", e?.message); }
    }
    console.log("[startup-health] Done.");
  } catch (e: any) { console.warn("[startup] Health check routine failed:", e?.message); }
}

// ─── SPA FALLBACK ────────────────────────────────────────
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "public", "index.html"));
});

// ─── START ───────────────────────────────────────────────
async function start() {
  await initControlPlaneDb();
  await seedDefaultAdmin();
  app.listen(PORT, () => {
    console.log(`[control-plane] Running on http://localhost:${PORT}`);
    setTimeout(autoImportPlans, 3000);
    setTimeout(autoImportCloudinary, 4000);
    setTimeout(runStartupHealthCheck, 5000);
    scheduleAutoBackup();
  });
}

start().catch((err) => {
  console.error("[control-plane] Fatal:", err);
  process.exit(1);
});
