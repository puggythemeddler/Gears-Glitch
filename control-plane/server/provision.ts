import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { execSync } from "child_process";
import { getCloudinaryConfig, getSmtpConfig } from "./db";

const NEON_API_KEY = process.env.NEON_API_KEY || "";
const NEON_ORG_ID = process.env.NEON_ORG_ID || "";
const RENDER_API_KEY = process.env.RENDER_API_KEY || "";
const RENDER_OWNER_ID = process.env.RENDER_OWNER_ID || "";
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || "";
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || "";
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || "";
const DOMAIN_BASE = process.env.DOMAIN_BASE || "gearglitch.com";
const FRONTEND_GIT_REPO = process.env.FRONTEND_GIT_REPO || "puggythemeddler/Gears-Glitch";
const DEFAULT_GIT_REPO_OWNER = "puggythemeddler";

function parseGitRepo(repo: string): { owner: string; name: string; full: string } {
  const trimmed = repo.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0 || slash === trimmed.length - 1) {
    throw new Error(`FRONTEND_GIT_REPO must be owner/repo (e.g. puggythemeddler/Gears-Glitch), got: ${repo}`);
  }
  const owner = trimmed.slice(0, slash);
  const name = trimmed.slice(slash + 1);
  return { owner, name, full: `${owner}/${name}` };
}

const GIT_REPO = parseGitRepo(FRONTEND_GIT_REPO);
if (GIT_REPO.owner !== DEFAULT_GIT_REPO_OWNER) {
  console.warn(
    `[provision] FRONTEND_GIT_REPO owner is "${GIT_REPO.owner}"; expected "${DEFAULT_GIT_REPO_OWNER}" for Vercel git integration`
  );
}

function vercelApiUrl(path: string): string {
  const base = `https://api.vercel.com${path}`;
  if (!VERCEL_TEAM_ID) return base;
  const sep = path.includes("?") ? "&" : "?";
  return `${base}${sep}teamId=${encodeURIComponent(VERCEL_TEAM_ID)}`;
}

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
      repo: `https://github.com/${GIT_REPO.full}`,
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

  // Push env vars via service PATCH (same pattern as pushControlPlaneSecret)
  const patchRes = await fetch(`https://api.render.com/v1/services/${serviceId}`, {
    method: "PATCH",
    headers: headers(RENDER_API_KEY),
    body: JSON.stringify({
      envVars: envVars.map((e: any) => ({ key: e.key, value: e.value })),
    }),
  });
  if (!patchRes.ok) {
    console.error(`[provision] Warning: env var PATCH failed: ${patchRes.status} ${await patchRes.text().catch(() => "")}`);
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

/** Resolve the Vercel org/team ID for .vercel/project.json */
async function getVercelOrgId(): Promise<string> {
  if (VERCEL_TEAM_ID) return VERCEL_TEAM_ID;
  const res = await fetch("https://api.vercel.com/v2/user", {
    headers: headers(VERCEL_TOKEN),
  });
  if (!res.ok) return "";
  const data: any = await res.json();
  return data.user?.uid || "";
}

/** Fallback: use the Vercel CLI (via npx) to build and deploy without a git link. */
async function deployViaVercelCli(slug: string, projectId: string, backendUrl: string, vercelProjectName: string): Promise<string> {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const frontendDir = path.join(repoRoot, "frontend");

  try {
    await fs.access(frontendDir);
  } catch {
    throw new Error("frontend/ directory not found (not in monorepo checkout)");
  }

  const orgId = await getVercelOrgId();
  if (!orgId) throw new Error("Could not determine Vercel org ID (set VERCEL_TEAM_ID or ensure token has access)");

  const tmpDir = path.join(os.tmpdir(), `vercel-deploy-${slug}`);

  try {
    await fs.rm(tmpDir, { recursive: true, force: true });

    // Mimic the monorepo structure so the project's rootDirectory:"frontend" resolves correctly
    const frontendTmp = path.join(tmpDir, "frontend");
    await fs.cp(frontendDir, frontendTmp, { recursive: true });

    // .vercel/project.json goes in cwd (tmpDir) so vercel deploy finds it
    await fs.mkdir(path.join(tmpDir, ".vercel"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, ".vercel", "project.json"),
      JSON.stringify({ projectId, orgId }, null, 2)
    );

    // .env goes in the frontend directory for Next.js build
    await fs.writeFile(
      path.join(frontendTmp, ".env"),
      [
        `BACKEND_URL=${backendUrl}`,
        `NEXT_PUBLIC_SITE_URL=https://${vercelProjectName}.vercel.app`,
        `NEXT_PUBLIC_MARKETING_ENABLED=false`,
      ].join("\n")
    );

    console.log(`[provision] Running Vercel CLI deploy (this may take a few minutes)...`);
    const scopeFlag = VERCEL_TEAM_ID ? ` --scope ${VERCEL_TEAM_ID}` : "";
    const output = execSync(
      `npx --yes vercel deploy --prod --yes${scopeFlag} --token "${VERCEL_TOKEN}"`,
      { cwd: tmpDir, timeout: 600_000, maxBuffer: 10 * 1024 * 1024, env: { ...process.env, VERCEL_TOKEN } }
    );

    const stdout = output.toString().trim();
    // Pick the last URL with .vercel.app (the aliased production URL)
    const matches = [...stdout.matchAll(/https:\/\/[^\s]+\.vercel\.app/g)];
    const deployUrl = matches.length > 0 ? matches[matches.length - 1][0] : `https://${vercelProjectName}.vercel.app`;

    console.log(`[provision] Vercel CLI deploy succeeded: ${deployUrl}`);
    return deployUrl;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Try a git-based deploy via the Vercel API (only works when the Vercel GitHub app is installed). */
async function deployViaGitApi(slug: string, projectId: string, repoId: number, vercelProjectName: string): Promise<boolean> {
  const depRes = await fetch(vercelApiUrl("/v13/deployments"), {
    method: "POST",
    headers: headers(VERCEL_TOKEN),
    body: JSON.stringify({
      name: `${slug}-frontend`,
      project: projectId,
      target: "production",
      gitSource: {
        type: "github",
        org: GIT_REPO.owner,
        repo: GIT_REPO.name,
        repoId,
        ref: "main",
      },
    }),
  });

  if (depRes.ok) {
    const depData: any = await depRes.json();
    console.log(`[provision] Vercel deploy triggered: url=${depData.url || "?"} id=${depData.id || "?"} state=${depData.state || "?"}`);
    return true;
  }

  const depErr = await depRes.text().catch(() => "");
  console.warn(`[provision] Vercel git deploy failed (${depRes.status}): ${depErr}`);
  return false;
}

async function createVercelProject(clientName: string, backendUrl: string) {
  console.log(`[provision] Creating Vercel project for "${clientName}"...`);

  const slug = slugify(clientName);
  const vercelProjectName = `${slug}-frontend`;

  const vercelBody: any = {
    name: vercelProjectName,
    framework: "nextjs",
    gitRepository: { repo: GIT_REPO.full, type: "github" },
    rootDirectory: "frontend",
  };

  const res = await fetch(vercelApiUrl("/v10/projects"), {
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
  const repoId: number | null = data.gitRepository?.repoId || null;

  // Fetch the actual production domain alias (may differ from data.name)
  let projectUrl = `https://${data.name}.vercel.app`;
  try {
    const domRes = await fetch(vercelApiUrl(`/v9/projects/${projectId}/domains`), {
      headers: headers(VERCEL_TOKEN),
    });
    if (domRes.ok) {
      const domData: any = await domRes.json();
      const prodDomain = domData.domains?.find((d: any) => !d.redirect);
      if (prodDomain) projectUrl = `https://${prodDomain.name}`;
    }
  } catch {}

  console.log(`[provision] Vercel project created: ${projectId}${repoId ? ` (repoId: ${repoId})` : " (git not linked)"}`);

  // Add BACKEND_URL env var
  const envRes = await fetch(vercelApiUrl(`/v10/projects/${projectId}/env`), {
    method: "POST",
    headers: headers(VERCEL_TOKEN),
    body: JSON.stringify({
      key: "BACKEND_URL",
      value: backendUrl,
      type: "encrypted",
      target: ["production", "preview", "development"],
    }),
  });
  if (!envRes.ok) {
    console.warn(`[provision] Vercel env var warning: ${envRes.status} ${await envRes.text().catch(() => "")}`);
  }

  // Try git-based deploy first, then fall back to Vercel CLI
  let deployed = false;
  if (repoId) {
    deployed = await deployViaGitApi(slug, projectId, repoId, vercelProjectName);
  }

  if (!deployed) {
    console.log(`[provision] Trying Vercel CLI deploy (no git link available)...`);
    try {
      const cliUrl = await deployViaVercelCli(slug, projectId, backendUrl, vercelProjectName);
      return { projectId, projectUrl: cliUrl };
    } catch (cliErr: any) {
      console.warn(`[provision] Vercel CLI deploy failed: ${cliErr.message}`);
      console.log(`[provision] Manual step: connect repo at https://vercel.com/${data.name}/~/git`);
    }
  }

  return { projectId, projectUrl };
}

export async function deleteVercelProject(projectId: string) {
  console.log(`[provision] Deleting Vercel project ${projectId}...`);
  await fetch(vercelApiUrl(`/v9/projects/${projectId}`), {
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
export async function deployRenderService(renderServiceId: string) {
  const res = await fetch(
    `https://api.render.com/v1/services/${renderServiceId}/deploys`,
    {
      method: "POST",
      headers: headers(RENDER_API_KEY),
      body: JSON.stringify({ clear_cache: false }),
    }
  );
  return res.ok;
}

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
      const ok = await deployRenderService(client.render_service_id);
      results.push({ name: client.name, success: ok, error: ok ? undefined : `HTTP error` });
    } catch (e: any) {
      results.push({ name: client.name, success: false, error: e.message });
    }
  }
  return results;
}

// ─── SLACK ALERTING ──────────────────────────────────────
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";

export async function sendSlackAlert(message: string) {
  if (!SLACK_WEBHOOK_URL) return;
  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
  } catch (e: any) {
    console.warn("[slack] Failed to send alert:", e?.message);
  }
}

// ─── USAGE ENFORCEMENT ──────────────────────────────────
export async function enforceUsageLimits() {
  try {
    const { queryAll, queryOne, query } = await import("./db");
    const clients: any[] = await queryAll(
      "SELECT id, name, plan, usage_orders, usage_revenue, usage_customers, usage_over_limit, last_limit_warning, health_status FROM clients WHERE status = 'active'"
    );
    for (const c of clients) {
      const plan: any = await queryOne("SELECT * FROM custom_plans WHERE id = $1", [c.plan]);
      if (!plan) continue;
      let overLimit = false;
      const issues: string[] = [];
      if (plan.max_products > 0 && (c.usage_orders || 0) > plan.max_products) {
        overLimit = true;
        issues.push(`products (${c.usage_orders}/${plan.max_products})`);
      }
      if (overLimit && !c.usage_over_limit) {
        await query("UPDATE clients SET usage_over_limit = true WHERE id = $1", [c.id]);
        const msg = `:warning: *${c.name}* exceeded plan limits: ${issues.join(", ")}`;
        await sendSlackAlert(msg);
      } else if (!overLimit && c.usage_over_limit) {
        await query("UPDATE clients SET usage_over_limit = false WHERE id = $1", [c.id]);
        await sendSlackAlert(`:white_check_mark: *${c.name}* is back within plan limits`);
      }
    }
  } catch (e: any) {
    console.warn("[enforce] Error:", e?.message);
  }
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
export async function getSmtpTransport() {
  const cfg = await getSmtpConfig();
  const host = cfg?.host || process.env.SMTP_HOST || "";
  const port = cfg?.port || Number(process.env.SMTP_PORT || 587);
  const user = cfg?.user || process.env.SMTP_USER || "";
  const pass = cfg?.pass || process.env.SMTP_PASS || "";
  const fromEmail = cfg?.from_email || process.env.FROM_EMAIL || "noreply@gearglitch.com";
  const fromName = cfg?.from_name || process.env.FROM_NAME || "Gear&Glitch";
  if (!host || !user || !pass) return null;
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host, port, secure: port === 465,
    auth: { user, pass },
  });
  return { transporter, fromEmail, fromName };
}

async function sendWelcomeEmail(
  toEmail: string,
  clientName: string,
  frontendUrl: string,
  backendUrl: string,
  adminPassword: string,
  plan: string
) {
  const st = await getSmtpTransport();
  if (!st) {
    console.log("[email] SMTP not configured — skipping welcome email.");
    return;
  }

  try {

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

    await st.transporter.sendMail({
      from: `"${st.fromName}" <${st.fromEmail}>`,
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
  const st = await getSmtpTransport();
  if (!st) {
    console.log("[email] SMTP not configured — skipping changelog notification.");
    return;
  }

  try {
    const { queryAll } = await import("./db");
    const clients = await queryAll("SELECT name, admin_email FROM clients WHERE status = 'active' AND admin_email != ''");

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
        await st.transporter.sendMail({
          from: `"${st.fromName}" <${st.fromEmail}>`,
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
