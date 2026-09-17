import fs from "fs";
import path from "path";
import { queryOne } from "./db-helpers";
import { getSettings } from "./db";
import { isMpesaConfigured } from "./mpesa";

// ─────────────────────────────────────────────────────────────────────────────
// Client → control plane heartbeat reporter.
//
// Each Gear&Glitch store pushes a small, secret-free snapshot to the control
// plane on a fixed interval (CONTROL_PLANE_URL + CONTROL_PLANE_SECRET must be
// configured during provisioning). The control plane uses the push alongside
// its 5-minute pull to derive availability, detect stale reporters, compute
// config drift (M-Pesa/WhatsApp/email/backups) and track release versions.
//
// The reporter is intentionally dumb and idempotent: any failure is logged and
// retried on the next tick. It never blocks boot and unrefs its timer.
// ─────────────────────────────────────────────────────────────────────────────

let APP_VERSION = "unknown";
try {
  const pkgPath = [path.join(__dirname, "..", "package.json"), path.join(__dirname, "..", "..", "package.json")].find((p) => fs.existsSync(p));
  if (pkgPath) APP_VERSION = JSON.parse(fs.readFileSync(pkgPath, "utf8")).version || "unknown";
} catch { /* version stays unknown */ }

// Mirror of the checks the diagnostic/reporting surface renders. Statuses are
// deliberately coarse (ok / fail / configured / unconfigured / enabled /
// disabled) so the control plane can reason about them without any secrets.
export async function getHeartbeatChecks(): Promise<Record<string, any>> {
  const out: Record<string, any> = { db: { status: "ok" } };
  try {
    const settings = await getSettings();

    out.email = {
      status: settings.emailSender && settings.emailSenderName ? "configured" : "unconfigured",
      detail: settings.emailSender ? "emailSender set" : "emailSender not set",
    };
    out.whatsapp = {
      status: settings.whatsappEnabled && settings.whatsappPhoneNumberId && settings.whatsappAccessToken ? "configured" : "unconfigured",
      detail: settings.whatsappEnabled ? "whatsappEnabled" : "whatsapp disabled",
    };
    out.backups = {
      status: settings.backupImagesToDb ? "enabled" : "disabled",
      detail: settings.backupImagesToDb ? "backupImagesToDb on" : "backupImagesToDb off",
    };

    const notifFails = await queryOne(
      "SELECT COUNT(*)::int AS c FROM notification_log WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours'"
    ) as any;
    const whatsappFails = await queryOne(
      "SELECT COUNT(*)::int AS c FROM whatsapp_logs WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours'"
    ) as any;
    out.notifications = {
      status: Number(notifFails?.c || 0) === 0 ? "ok" : "fail",
      fails24h: Number(notifFails?.c || 0),
    };
    out.whatsappFailed24h = Number(whatsappFails?.c || 0);
  } catch (e: any) {
    out.email = { status: "unknown", detail: e?.message };
    out.whatsapp = { status: "unknown" };
    out.backups = { status: "unknown" };
    out.notifications = { status: "unknown" };
  }

  try {
    out.mpesa = {
      status: isMpesaConfigured() ? "configured" : "unconfigured",
      detail: isMpesaConfigured() ? "mpesa credentials present" : "no mpesa credentials",
    };
  } catch {
    out.mpesa = { status: "unknown" };
  }

  return out;
}

export async function getSchemaVersion(): Promise<string> {
  try {
    const row = await queryOne("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1") as any;
    return row?.version ? String(row.version) : "";
  } catch {
    return "";
  }
}

export async function buildHeartbeatPayload(): Promise<Record<string, any>> {
  const [checks, schemaVersion] = await Promise.all([getHeartbeatChecks(), getSchemaVersion()]);
  return {
    appVersion: APP_VERSION,
    schemaVersion,
    envType: process.env.NODE_ENV || "production",
    readiness: "ok",
    checks,
    capabilities: ["heartbeat", "usage", "suspension", "plans", "backup-images"],
    timestamp: new Date().toISOString(),
  };
}

const CP_URL = process.env.CONTROL_PLANE_URL || "";
const CP_SECRET = process.env.CONTROL_PLANE_SECRET || "";

export function heartbeatConfigured(): boolean {
  return CP_URL.length > 8 && CP_SECRET.length >= 16;
}

export async function sendHeartbeatOnce(): Promise<{ ok: boolean; error?: string }> {
  if (!heartbeatConfigured()) return { ok: false, error: "CONTROL_PLANE_URL/SECRET not configured" };
  try {
    const payload = await buildHeartbeatPayload();
    const res = await fetch(`${CP_URL.replace(/\/+$/, "")}/api/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-control-plane-key": CP_SECRET,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status} ${text.slice(0, 160)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

let reporterRunning = false;

export function startHeartbeatReporter(): void {
  if (!heartbeatConfigured()) {
    console.log("[heartbeat] CONTROL_PLANE_URL/CONTROL_PLANE_SECRET not set — heartbeat reporter disabled.");
    return;
  }
  const intervalMin = Math.max(0.25, Number(process.env.HEARTBEAT_INTERVAL_MIN) || 2);
  const tick = async () => {
    if (reporterRunning) return;
    reporterRunning = true;
    try {
      const r = await sendHeartbeatOnce();
      if (!r.ok) console.warn("[heartbeat] Send failed:", r.error);
    } finally {
      reporterRunning = false;
    }
  };
  tick();
  setInterval(tick, intervalMin * 60 * 1000).unref();
  console.log(`[heartbeat] Reporter active — pushing every ${intervalMin} min to control plane.`);
}