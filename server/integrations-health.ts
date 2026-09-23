import { getGmailStatus } from "./gmail";
import { getMpesaConfig, isMpesaConfigured } from "./mpesa";
import { getSettings, getStoreSetting } from "./db";
import { queryOne } from "./db-helpers";

export interface IntegrationHealthEntry {
  provider: "gmail" | "daraja" | "whatsapp" | "google";
  label: string;
  configured: boolean;
  connected: boolean;
  status: string;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  lastError?: string | null;
  lastTestAt?: string | null;
  lastTestResult?: string | null;
  meta?: Record<string, unknown>;
}

// Aggregates external-provider health for the admin Integrations page and the
// control-plane heartbeat. Never exposes secrets — config fingerprints only
// (env, shortcodes, phone number id, connected email).
export async function getIntegrationsHealth(): Promise<IntegrationHealthEntry[]> {
  const entries: IntegrationHealthEntry[] = [];

  try {
    const gmail = await getGmailStatus();
    entries.push({
      provider: "gmail",
      label: "Gmail (outbound email)",
      configured: gmail.configured,
      connected: gmail.status === "connected",
      status: gmail.status,
      lastSuccessAt: gmail.lastSuccessAt,
      lastFailureAt: gmail.lastFailureAt,
      lastError: gmail.lastError,
      lastTestAt: gmail.lastTestAt,
      lastTestResult: gmail.lastTestResult,
      meta: gmail.email ? { email: gmail.email } : undefined,
    });
  } catch (err: any) {
    entries.push({ provider: "gmail", label: "Gmail (outbound email)", configured: false, connected: false, status: "error", lastError: err?.message });
  }

  try {
    const cfg = getMpesaConfig();
    const configured = isMpesaConfigured();
    let lastCallback: string | null = null;
    let lastCallbackResult: string | null = null;
    try {
      const cb = await queryOne("SELECT processed_at, error, status FROM webhook_events WHERE provider = 'mpesa' ORDER BY received_at DESC LIMIT 1");
      if (cb?.processed_at) lastCallback = String((cb as any).processed_at);
      if (cb?.status === "failed") lastCallbackResult = String((cb as any).error || "processing failed");
    } catch { /* ledger query is best-effort */ }
    entries.push({
      provider: "daraja",
      label: "M-Pesa Daraja",
      configured,
      connected: false,
      status: configured ? "configured" : "not_configured",
      lastSuccessAt: lastCallback,
      lastError: lastCallbackResult,
      meta: { env: cfg.env, shortcode: cfg.shortcode, tillNumber: cfg.tillNumber },
    });
  } catch (err: any) {
    entries.push({ provider: "daraja", label: "M-Pesa Daraja", configured: false, connected: false, status: "error", lastError: err?.message });
  }

  try {
    const s = await getSettings();
    const configured = !!(s.whatsappAccessToken && s.whatsappPhoneNumberId);
    entries.push({
      provider: "whatsapp",
      label: "WhatsApp Business",
      configured,
      connected: configured && !!s.whatsappEnabled,
      status: !configured ? "not_configured" : s.whatsappEnabled ? "connected" : "disabled",
      meta: { phoneNumberId: s.whatsappPhoneNumberId, apiVersion: s.whatsappApiVersion },
    });
  } catch (err: any) {
    entries.push({ provider: "whatsapp", label: "WhatsApp Business", configured: false, connected: false, status: "error", lastError: err?.message });
  }

  try {
    const clientId = (await getStoreSetting("google_client_id")) || process.env.GOOGLE_CLIENT_ID || "";
    entries.push({
      provider: "google",
      label: "Google Sign-In",
      configured: !!clientId,
      connected: !!clientId,
      status: clientId ? "configured" : "not_configured",
    });
  } catch (err: any) {
    entries.push({ provider: "google", label: "Google Sign-In", configured: false, connected: false, status: "error", lastError: err?.message });
  }

  return entries;
}