import crypto from "crypto";
import { getCloudinaryConfig } from "./db";

const NEON_API_KEY = process.env.NEON_API_KEY || "";
const NEON_ORG_ID = process.env.NEON_ORG_ID || "";
const RENDER_API_KEY = process.env.RENDER_API_KEY || "";
const RENDER_OWNER_ID = process.env.RENDER_OWNER_ID || "";
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || "";
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || "";
const DOMAIN_BASE = process.env.DOMAIN_BASE || "gearglitch.com";
const FRONTEND_GIT_REPO = process.env.FRONTEND_GIT_REPO || "puggythemeddler/Gears-Glitch";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@gearglitch.com";
const FROM_NAME = process.env.FROM_NAME || "Gear&Glitch";

function randomPassword(len = 20) {
  return crypto.randomBytes(len).toString("base64url").slice(0, len);
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
}

function headers(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

// ─── NEON ────────────────────────────────────────────────
async function createNeonDatabase(clientName: string) {
  console.log(`[provision] Creating Neon database for "${clientName}"...`);

  const slug = slugify(clientName);

  // Create project
  const res = await fetch("https://console.neon.tech/api/v2/projects", {
    method: "POST",
    headers: headers(NEON_API_KEY),
    body: JSON.stringify({
      project: { name: slug, region_id: "aws-us-east-2", ...(NEON_ORG_ID ? { org_id: NEON_ORG_ID } : {}) },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Neon project creation failed: ${res.status} ${err}`);
  }

  const data: any = await res.json();
  const projectId = data.project.id;

  let dbUrl = "";
  if (data.connection_uris?.length > 0) {
    dbUrl = data.connection_uris[0].connection_uri || "";
  } else if (data.databases?.length > 0 && data.roles?.length > 0) {
    // Build URL from roles/databases as fallback
    const db = data.databases[0];
    const role = data.roles[0];
    const epHost = `ep-${projectId}.us-east-2.aws.neon.tech`;
    dbUrl = `postgresql://${role.name}:${role.password}@${epHost}/${db.name}?sslmode=require`;
  }

  console.log(`[provision] Neon project created: ${projectId}`);
  console.log(`[provision] dbUrl ${dbUrl ? "obtained" : "EMPTY"} (length: ${dbUrl.length})`);
  return { projectId, dbUrl };
}

export async function deleteNeonProject(projectId: string) {
  console.log(`[provision] Deleting Neon project ${projectId}...`);
  await fetch(`https://console.neon.tech/api/v2/projects/${projectId}`, {
    method: "DELETE",
    headers: headers(NEON_API_KEY),
  });
}

// ─── RENDER ──────────────────────────────────────────────
interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
}

async function createRenderService(clientName: string, dbUrl: string, clientSlug: string, cloudinary: CloudinaryCredentials | null | undefined, cpSecret: string, adminEmail: string, adminPassword: string) {
  console.log(`[provision] Creating Render service for "${clientName}"...`);

  const slug = slugify(clientName);

  const envVars: { key: string; value: string }[] = [
    { key: "NODE_ENV", value: "production" },
    { key: "DATABASE_URL", value: dbUrl },
    { key: "JWT_SECRET", value: randomPassword(40) },
    { key: "PORT", value: "8020" },
    { key: "DB_SSL_REJECT", value: "false" },
    { key: "CONTROL_PLANE_SECRET", value: cpSecret },
    // Admin seed credentials — the backend creates this admin user on first boot
    { key: "ADMIN_USERNAME", value: "admin" },
    { key: "ADMIN_EMAIL", value: adminEmail },
    { key: "ADMIN_PASSWORD", value: adminPassword },
    // Technician seed (optional; lets the operator log in as a non-admin too)
    { key: "TECH_USERNAME", value: "technician" },
    { key: "TECH_EMAIL", value: `tech@${clientSlug}.com` },
    { key: "TECH_PASSWORD", value: randomPassword(16) },
  ];

  // Add Cloudinary env vars if available (shared account, per-client folder)
  if (cloudinary && cloudinary.cloudName && cloudinary.apiKey && cloudinary.apiSecret) {
    envVars.push(
      { key: "CLOUDINARY_CLOUD_NAME", value: cloudinary.cloudName },
      { key: "CLOUDINARY_API_KEY", value: cloudinary.apiKey },
      { key: "CLOUDINARY_API_SECRET", value: cloudinary.apiSecret },
      { key: "CLOUDINARY_FOLDER", value: `gear-glitch/${clientSlug}` }
    );
    console.log(`[provision] Cloudinary configured for folder: gear-glitch/${clientSlug}`);
  }

  const res = await fetch("https://api.render.com/v1/services", {
    method: "POST",
    headers: headers(RENDER_API_KEY),
    body: JSON.stringify({
      type: "web_service",
      name: `${slug}-backend`,
      repo: `https://github.com/${FRONTEND_GIT_REPO}`,
      branch: "main",
      ...(RENDER_OWNER_ID ? { ownerId: RENDER_OWNER_ID } : {}),
      envVars,
      serviceDetails: {
        runtime: "node",
        envSpecificDetails: {
          buildCommand: "NODE_ENV=development npm ci && cd server && npx tsc && cd ..",
          startCommand: "node dist/server/index.js",
        },
        plan: "free",
        region: "oregon",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Render service creation failed: ${res.status} ${err}`);
  }

  const data: any = await res.json();
  const serviceId = data.service.id;
  const serviceUrl = data.service.service_url || `https://${slug}-backend.onrender.com`;

  console.log(`[provision] Render service created: ${serviceId}`);

  // Set env vars via the dedicated env-vars endpoint (more reliable than create)
  const envVarsBody = envVars.map((e: any) => ({ key: e.key, value: e.value, type: "env_var" }));
  const envRes = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars`, {
    method: "PATCH",
    headers: headers(RENDER_API_KEY),
    body: JSON.stringify(envVarsBody),
  });
  if (!envRes.ok) {
    console.error(`[provision] Warning: env var setup failed: ${envRes.status} ${await envRes.text().catch(() => "")}`);
  } else {
    // Trigger deploy so env vars take effect
    const depRes = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
      method: "POST",
      headers: headers(RENDER_API_KEY),
      body: JSON.stringify({ clear_cache: false }),
    });
    if (!depRes.ok) {
      console.warn(`[provision] Deploy trigger warning: ${depRes.status}`);
    }
  }

  return { serviceId, serviceUrl };
}

export async function deleteRenderService(serviceId: string) {
  console.log(`[provision] Deleting Render service ${serviceId}...`);
  await fetch(`https://api.render.com/v1/services/${serviceId}`, {
    method: "DELETE",
    headers: headers(RENDER_API_KEY),
  });
}

// ─── VERCEL ──────────────────────────────────────────────
async function createVercelProject(clientName: string, backendUrl: string) {
  console.log(`[provision] Creating Vercel project for "${clientName}"...`);

  const slug = slugify(clientName);

  const vercelBody: any = {
    name: `${slug}-frontend`,
    framework: "nextjs",
    gitRepository: {
      repo: FRONTEND_GIT_REPO,
      type: "github",
    },
    rootDirectory: "frontend",
  };

  const res = await fetch("https://api.vercel.com/v10/projects", {
    method: "POST",
    headers: headers(VERCEL_TOKEN),
    body: JSON.stringify(vercelBody),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vercel project creation failed: ${res.status} ${err}`);
  }

  const data: any = await res.json();
  const projectId = data.id;
  const projectUrl = `https://${data.name}.vercel.app`;

  // Add BACKEND_URL env var after project creation
  await fetch(`https://api.vercel.com/v10/projects/${projectId}/env`, {
    method: "POST",
    headers: headers(VERCEL_TOKEN),
    body: JSON.stringify({
      key: "BACKEND_URL",
      value: backendUrl,
      type: "encrypted",
      target: ["production", "preview", "development"],
    }),
  }).catch(() => {});

  console.log(`[provision] Vercel project created: ${projectId}`);

  // Trigger an initial deploy
  const depRes = await fetch(`https://api.vercel.com/v13/deployments`, {
    method: "POST",
    headers: headers(VERCEL_TOKEN),
    body: JSON.stringify({ project: projectId, target: "production" }),
  });
  if (depRes.ok) {
    const depData: any = await depRes.json();
    console.log(`[provision] Vercel deploy triggered: ${depData.url || depData.id || "unknown"}`);
  } else {
    console.warn(`[provision] Vercel deploy trigger failed: ${depRes.status} ${await depRes.text().catch(() => "")}`);
  }

  return { projectId, projectUrl };
}

export async function deleteVercelProject(projectId: string) {
  console.log(`[provision] Deleting Vercel project ${projectId}...`);
  await fetch(`https://api.vercel.com/v9/projects/${projectId}?teamId=`, {
    method: "DELETE",
    headers: headers(VERCEL_TOKEN),
  });
}

// ─── CLOUDFLARE ──────────────────────────────────────────
async function setupCloudflareDns(subdomain: string, targetUrl: string) {
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
    console.log("[provision] Skipping Cloudflare DNS — no token configured.");
    return null;
  }

  console.log(`[provision] Adding CNAME record for ${subdomain}.${DOMAIN_BASE}...`);

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "CNAME",
        name: subdomain,
        content: targetUrl.replace("https://", ""),
        ttl: 1,
        proxied: false,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`[provision] Cloudflare DNS failed: ${err}`);
    return null;
  }

  console.log(`[provision] DNS record added.`);
  return true;
}

// ─── MAIN PROVISIONING ───────────────────────────────────
export interface ProvisionResult {
  clientName: string;
  domain: string;
  adminPassword: string;
  cpSecret: string;
  neon: { projectId: string; dbUrl: string };
  render: { serviceId: string; serviceUrl: string };
  vercel: { projectId: string; projectUrl: string };
  dns: boolean | null;
}

// Headers for authenticated control-plane → client backend calls
export function cpHeaders(cpSecret: string, extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...(extra || {}) };
  if (cpSecret) h["x-control-plane-key"] = cpSecret;
  return h;
}

export function generateCpSecret(): string {
  return "cps_" + crypto.randomBytes(24).toString("hex");
}

// Push (or rotate) the control-plane secret on an existing client's Render service
export async function pushControlPlaneSecret(renderServiceId: string, cpSecret: string): Promise<void> {
  const res = await fetch(`https://api.render.com/v1/services/${renderServiceId}`, {
    method: "PATCH",
    headers: headers(RENDER_API_KEY),
    body: JSON.stringify({ envVars: [{ key: "CONTROL_PLANE_SECRET", value: cpSecret }] }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to set CONTROL_PLANE_SECRET: ${res.status} ${err}`);
  }
  // Redeploy so the new env var takes effect
  await fetch(`https://api.render.com/v1/services/${renderServiceId}/deploys`, {
    method: "POST",
    headers: headers(RENDER_API_KEY),
    body: JSON.stringify({ clear_cache: false }),
  });
}

export async function provisionClient(
  clientName: string,
  adminEmail: string,
  plan: string,
  domain?: string
): Promise<ProvisionResult> {
  const subdomain = slugify(clientName);
  const clientDomain = domain || `${subdomain}.${DOMAIN_BASE}`;
  const adminPassword = randomPassword(16);
  const cpSecret = generateCpSecret();

  console.log(`\n[provision] ══════════════════════════════════════`);
  console.log(`[provision] Provisioning: ${clientName}`);
  console.log(`[provision] Domain: ${clientDomain}`);
  console.log(`[provision] Plan: ${plan}`);
  console.log(`[provision] ══════════════════════════════════════\n`);

  // 1. Create Neon database
  const neon = await createNeonDatabase(clientName);

  // 2. Pull Cloudinary config from DB
  const cloudinaryConfig = await getCloudinaryConfig();
  const cloudinary = cloudinaryConfig && cloudinaryConfig.cloud_name
    ? { cloudName: cloudinaryConfig.cloud_name, apiKey: cloudinaryConfig.api_key, apiSecret: cloudinaryConfig.api_secret, folder: cloudinaryConfig.folder || "gear-glitch" }
    : null;

  // 3. Create Render service
  const render = await createRenderService(clientName, neon.dbUrl, subdomain, cloudinary, cpSecret, adminEmail, adminPassword);

  // 3. Create Vercel project
  const vercel = await createVercelProject(clientName, render.serviceUrl);

  // 4. Setup DNS
  const sub = clientDomain.replace(`.${DOMAIN_BASE}`, "");
  const dns = await setupCloudflareDns(sub, vercel.projectUrl);

  console.log(`\n[provision] ✅ Provisioning complete for "${clientName}"`);
  console.log(`[provision] Backend:  ${render.serviceUrl}`);
  console.log(`[provision] Frontend: ${vercel.projectUrl}`);
  console.log(`[provision] Domain:   https://${clientDomain}`);
  console.log(`[provision] Admin credentials sent via welcome email.\n`);

  // 5. Send welcome email
  await sendWelcomeEmail(adminEmail, clientName, vercel.projectUrl, render.serviceUrl, adminPassword, plan);

  return {
    clientName,
    domain: clientDomain,
    adminPassword,
    cpSecret,
    neon,
    render,
    vercel,
    dns,
  };
}

// ─── DEPLOY ALL CLIENTS ──────────────────────────────────
export async function deployAllClients(
  clients: { render_service_id: string; name: string }[]
) {
  console.log(`[deploy] Triggering deploy for ${clients.length} clients...`);

  const results: { name: string; success: boolean; error?: string }[] = [];

  for (const client of clients) {
    if (!client.render_service_id) {
      results.push({ name: client.name, success: false, error: "No Render service ID" });
      continue;
    }
    try {
      const res = await fetch(
        `https://api.render.com/v1/services/${client.render_service_id}/deploys`,
        {
          method: "POST",
          headers: headers(RENDER_API_KEY),
          body: JSON.stringify({ clear_cache: false }),
        }
      );
      results.push({
        name: client.name,
        success: res.ok,
        error: res.ok ? undefined : `HTTP ${res.status}`,
      });
    } catch (e: any) {
      results.push({ name: client.name, success: false, error: e.message });
    }
  }

  return results;
}

// ─── HEALTH CHECK ────────────────────────────────────────
export async function checkClientHealth(
  renderServiceUrl: string,
  cpSecret?: string
): Promise<"healthy" | "sleeping" | "down"> {
  if (!renderServiceUrl) return "down";
  try {
    const res = await fetch(`${renderServiceUrl}/api/health`, {
      headers: cpHeaders(cpSecret || ""),
      signal: AbortSignal.timeout(45000),
    });
    if (res.ok) return "healthy";
    // Render free tier returns 503 while waking from sleep
    if (res.status === 503 || res.status === 502) return "sleeping";
    return "down";
  } catch {
    return "sleeping";
  }
}

// ─── WELCOME EMAIL ───────────────────────────────────────
async function sendWelcomeEmail(
  toEmail: string,
  clientName: string,
  frontendUrl: string,
  backendUrl: string,
  adminPassword: string,
  plan: string
) {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log("[email] SMTP not configured — skipping welcome email.");
    return;
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 2rem;">
        <h1 style="color: #3b82f6; margin-bottom: 0.5rem;">Welcome to Gear&Glitch!</h1>
        <p style="color: #666; font-size: 1.1rem;">Your store <strong>${clientName}</strong> is ready.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 1.5rem 0;">

        <h3 style="margin-top: 1rem;">Your Login Details</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
          <tr><td style="padding: 0.5rem; color: #666;">Email:</td><td style="padding: 0.5rem; font-weight: 600;">${toEmail}</td></tr>
          <tr><td style="padding: 0.5rem; color: #666;">Password:</td><td style="padding: 0.5rem; font-weight: 600; font-family: monospace;">${adminPassword}</td></tr>
          <tr><td style="padding: 0.5rem; color: #666;">Plan:</td><td style="padding: 0.5rem; font-weight: 600; text-transform: capitalize;">${plan}</td></tr>
        </table>

        <div style="background: #f8fafc; border-radius: 8px; padding: 1.25rem; margin: 1.5rem 0;">
<h3 style="margin-top: 0;">Your Links</h3>
          <p><a href="${frontendUrl}" style="color: #3b82f6;">Storefront</a> - ${frontendUrl}</p>
          <p><a href="${frontendUrl}/login" style="color: #3b82f6;">Admin Login</a> - ${frontendUrl}/login</p>
          <p><a href="${backendUrl}" style="color: #3b82f6;">API (Backend)</a> - ${backendUrl}</p>
        </div>

        <p style="color: #666; font-size: 0.9rem; margin-top: 1rem;">
          Log in at <a href="${frontendUrl}/login" style="color: #3b82f6;">${frontendUrl}/login</a>
          using the admin credentials above to start setting up your store.
        </p>

        <p style="color: #999; font-size: 0.85rem; margin-top: 2rem;">
          Please change your password after your first login for security.<br>
          If you need any help, contact support@gearglitch.com
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: toEmail,
      subject: `Welcome to Gear&Glitch — Your Store "${clientName}" is Ready!`,
      html,
    });

    console.log(`[email] Welcome email sent to ${toEmail} for "${clientName}"`);
  } catch (err: any) {
    console.error(`[email] Failed to send welcome email: ${err.message}`);
  }
}

// ─── CHANGELOG NOTIFICATION ──────────────────────────────
export async function notifyAllClientsChangelog(version: string, title: string, body: string) {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log("[email] SMTP not configured — skipping changelog notification.");
    return;
  }

  try {
    const { queryAll } = await import("./db");
    const clients = await queryAll("SELECT name, admin_email FROM clients WHERE status = 'active' AND admin_email != ''");

    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 2rem;">
        <h1 style="color: #3b82f6;">System Update — ${version}</h1>
        <h2 style="color: #333;">${title}</h2>
        <div style="color: #555; line-height: 1.6; margin: 1rem 0;">${body.replace(/\n/g, "<br>")}</div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 1.5rem 0;">
        <p style="color: #999; font-size: 0.85rem;">This update has been automatically applied to your store.</p>
      </div>
    `;

    for (const c of clients as { name: string; admin_email: string }[]) {
      try {
        await transporter.sendMail({
          from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
          to: c.admin_email,
          subject: `Gear&Glitch Update ${version} — ${title}`,
          html,
        });
      } catch (e: any) { console.warn("[email] Changelog email send failed:", e?.message); }
    }

    console.log(`[email] Changelog "${title}" sent to ${clients.length} clients.`);
  } catch (err: any) {
    console.error(`[email] Changelog notification failed: ${err.message}`);
  }
}

// ─── CLIENT USAGE STATS (via client health endpoint) ─────
export async function fetchClientUsage(backendUrl: string, cpSecret?: string): Promise<{ orders?: number; revenue?: number; customers?: number; version?: string; suspended?: boolean } | null> {
  if (!backendUrl) return null;
  try {
    const res = await fetch(`${backendUrl}/api/health`, { headers: cpHeaders(cpSecret || ""), signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data: any = await res.json();
    return { orders: data.orders, revenue: data.revenue, customers: data.customers, version: data.version, suspended: data.suspended };
  } catch {
    return null;
  }
}
