import crypto from "crypto";
import { getSettings, upsertWhatsAppConversation, getWhatsAppConversationByPhone, logWhatsAppMessage, findCustomerByPhone, findProviderByPhone, sendMessage, storeWhatsAppMedia, getWhatsAppMedia, getWhatsAppTemplateByName } from "./db";
import { claimWebhookEvent, completeWebhookClaim, failWebhookClaim, type WebhookClaim } from "./integrations-store";
import { normalizePhone, isValidKenyanPhone } from "./phone";
import { isWhatsAppSendingAllowed, detectOptOutKeyword, recordOptOut, type MessageCategory } from "./whatsapp-consent";

// Re-exported for backwards compatibility (many callers/tests import these from
// server/whatsapp). The implementation lives in server/phone.ts.
export { normalizePhone, isValidKenyanPhone };

export function isWithin24Hours(lastIncomingAt: string | null): boolean {
  if (!lastIncomingAt) return false;
  const last = new Date(lastIncomingAt);
  if (isNaN(last.getTime())) return false;
  const now = new Date();
  return (now.getTime() - last.getTime()) < 24 * 60 * 60 * 1000;
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<{ ok: boolean; data?: Buffer; mimeType?: string; filename?: string; error?: string }> {
  const s = await getSettings();
  if (!s.whatsappAccessToken) return { ok: false, error: "WhatsApp not configured" };
  try {
    const url = `https://graph.facebook.com/${s.whatsappApiVersion || "v21.0"}/${mediaId}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${s.whatsappAccessToken}` },
    });
    if (!res.ok) return { ok: false, error: `Failed to get media URL: ${res.status}` };
    const meta = await res.json() as any;
    const downloadUrl = meta?.url;
    const mime = meta?.mime_type || "application/octet-stream";
    let filename = meta?.filename || "";
    if (!downloadUrl) return { ok: false, error: "No download URL in response" };
    const dl = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${s.whatsappAccessToken}` },
    });
    if (!dl.ok) return { ok: false, error: `Download failed: ${dl.status}` };
    const buf = Buffer.from(await dl.arrayBuffer());
    // Security: cap stored media size (16 MB) to protect the database and prevent
    // malicious oversized uploads from abusing the media storage.
    if (buf.length > 16 * 1024 * 1024) return { ok: false, error: "Media exceeds the 16 MB size limit." };
    // Sanitize the remote filename: strip path separators, control chars and quotes
    // so it can never inject content into HTML or Content-Disposition headers.
    filename = String(filename || "").replace(/[\r\n\x00-\x1f"/\\]/g, "").replace(/\.+/g, ".").trim().slice(0, 128);
    return { ok: true, data: buf, mimeType: mime, filename };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Media download error" };
  }
}

async function sendWhatsAppText(to: string, text: string): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
  const s = await getSettings();
  if (!s.whatsappEnabled || !s.whatsappPhoneNumberId || !s.whatsappAccessToken) {
    return { ok: false, error: "WhatsApp is not configured or not enabled." };
  }
  const url = `https://graph.facebook.com/${s.whatsappApiVersion || "v21.0"}/${s.whatsappPhoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${s.whatsappAccessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text },
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) {
      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      // No blind retry: a lost HTTP response after the request reached Meta
      // would otherwise resend the message to the recipient (duplicate delivery).
      return { ok: false, error: errMsg };
    }
    const waMessageId = data?.messages?.[0]?.id;
    return { ok: true, waMessageId };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Network error" };
  }
}

async function sendWhatsAppTemplate(to: string, templateName: string, languageCode: string, params: { type: string; text: string }[]): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
  const s = await getSettings();
  if (!s.whatsappEnabled || !s.whatsappPhoneNumberId || !s.whatsappAccessToken) {
    return { ok: false, error: "WhatsApp is not configured or not enabled." };
  }
  const url = `https://graph.facebook.com/${s.whatsappApiVersion || "v21.0"}/${s.whatsappPhoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${s.whatsappAccessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: params.length > 0 ? [{ type: "body", parameters: params }] : [],
        },
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) {
      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      return { ok: false, error: errMsg };
    }
    const waMessageId = data?.messages?.[0]?.id;
    return { ok: true, waMessageId };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Network error" };
  }
}

export async function sendWhatsAppInteractiveButtons(to: string, bodyText: string, buttons: { id: string; title: string }[]): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
  const s = await getSettings();
  if (!s.whatsappEnabled || !s.whatsappPhoneNumberId || !s.whatsappAccessToken) {
    return { ok: false, error: "WhatsApp is not configured or not enabled." };
  }
  const url = `https://graph.facebook.com/${s.whatsappApiVersion || "v21.0"}/${s.whatsappPhoneNumberId}/messages`;
  const payload: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map(b => ({
          type: "reply",
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${s.whatsappAccessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json() as any;
    if (!res.ok) return { ok: false, error: data?.error?.message || `HTTP ${res.status}` };
    const waMessageId = data?.messages?.[0]?.id;
    return { ok: true, waMessageId };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Network error" };
  }
}

export async function sendWhatsAppListMessage(to: string, bodyText: string, buttonText: string, sections: { title: string; rows: { id: string; title: string; description?: string }[] }[]): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
  const s = await getSettings();
  if (!s.whatsappEnabled || !s.whatsappPhoneNumberId || !s.whatsappAccessToken) {
    return { ok: false, error: "WhatsApp is not configured or not enabled." };
  }
  const url = `https://graph.facebook.com/${s.whatsappApiVersion || "v21.0"}/${s.whatsappPhoneNumberId}/messages`;
  const payload: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: bodyText },
      action: {
        button: buttonText.slice(0, 20),
        sections: sections.map(s => ({
          title: s.title.slice(0, 24),
          rows: s.rows.map(r => ({
            id: r.id,
            title: r.title.slice(0, 24),
            description: r.description ? r.description.slice(0, 72) : undefined,
          })),
        })),
      },
    },
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${s.whatsappAccessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json() as any;
    if (!res.ok) return { ok: false, error: data?.error?.message || `HTTP ${res.status}` };
    const waMessageId = data?.messages?.[0]?.id;
    return { ok: true, waMessageId };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Network error" };
  }
}

export async function sendWhatsAppMessage(to: string, text: string, entityType: string, entityId: number, entityName: string, category: MessageCategory = "transactional"): Promise<{ ok: boolean; messageId?: string; error?: string; blocked?: boolean }> {
  const normalizedTo = normalizePhone(to);

  // Central consent/opt-out gate. Evaluated immediately before sending so a
  // queued or retried message can never bypass a stop that arrived in between.
  const decision = await isWhatsAppSendingAllowed(normalizedTo, category);
  if (!decision.allowed) {
    await logWhatsAppMessage(normalizedTo, "outbound", "blocked", text, "blocked", undefined, decision.reason);
    console.warn(`[whatsapp] Outbound blocked (${category}): ${decision.reason}`);
    return { ok: false, error: decision.reason, blocked: true };
  }

  const conversation = await getWhatsAppConversationByPhone(normalizedTo);
  const withinWindow = isWithin24Hours(conversation?.last_incoming_at || null);

  // Preserve an existing customer/provider entity on this number so admin/staff
  // notifications never overwrite a real conversation relationship (security:
  // an admin phone that is also a customer/provider keeps its linked entity).
  let storeType = entityType;
  let storeId = entityId;
  let storeName = entityName;
  if (conversation && (conversation.entity_type === "customer" || conversation.entity_type === "provider") && Number(conversation.entity_id) > 0 && entityType === "staff") {
    storeType = conversation.entity_type;
    storeId = Number(conversation.entity_id);
    storeName = conversation.entity_name || entityName;
  }

  if (withinWindow) {
    const result = await sendWhatsAppText(normalizedTo, text);
    await logWhatsAppMessage(normalizedTo, "outbound", "text", text, result.ok ? "sent" : "failed", result.waMessageId, result.error);
    await upsertWhatsAppConversation(normalizedTo, storeType, storeId, storeName, "outbound");
    return { ok: result.ok, messageId: result.waMessageId, error: result.error };
  } else {
    const template = await getWhatsAppTemplateByName("general_notification");
    if (!template) {
      // Fail with a useful error rather than silently sending to a template that
      // may not exist (Meta returns a 400 the customer never sees otherwise).
      const errMsg = "Fallback template 'general_notification' is not found in the WhatsApp template store. Add it to enable outbound notifications outside the 24-hour window.";
      await logWhatsAppMessage(normalizedTo, "outbound", "template", text, "failed", undefined, errMsg);
      console.warn("[whatsapp]" + errMsg);
      return { ok: false, error: errMsg };
    }
    const templateName = template.name || "general_notification";
    const lang = template?.language || "en";
    const result = await sendWhatsAppTemplate(normalizedTo, templateName, lang, [
      { type: "text", text: storeName || "Customer" },
      { type: "text", text: text },
    ]);
    await logWhatsAppMessage(normalizedTo, "outbound", "template", text, result.ok ? "sent" : "failed", result.waMessageId, result.error);
    await upsertWhatsAppConversation(normalizedTo, storeType, storeId, storeName, "outbound");
    return { ok: result.ok, messageId: result.waMessageId, error: result.error };
  }
}

export async function notifyAdminWhatsApp(text: string): Promise<void> {
  const s = await getSettings();
  if (!s.whatsappEnabled || !s.whatsappPhoneNumberId || !s.whatsappAccessToken) return;
  if (!s.adminWhatsAppEnabled) return;
  const phone = (s.adminWhatsAppPhone || s.phone || "").replace(/\D/g, "");
  if (!phone) return;
  await sendWhatsAppMessage(phone, text, "staff", 0, s.storeName || "My Shop").catch((err: any) =>
    console.warn("[whatsapp] Admin notification failed:", err?.message || err)
  );
}

// Meta signs every webhook POST with HMAC-SHA256 over the *raw* request bytes:
//   x-hub-signature-256: sha256=<64 lowercase hex>
export function buildWhatsAppSignature(body: string | Buffer, appSecret: string): string {
  return "sha256=" + crypto.createHmac("sha256", appSecret).update(body).digest("hex");
}

// Constant-time comparison that is safe against mismatched lengths/encodings.
// crypto.timingSafeEqual throws when the buffers differ in length, so the length
// guard must come first or a malformed header would throw (and previously left a
// pre-auth code path exploitable).
export function signaturesMatch(expected: string, provided: string): boolean {
  if (typeof provided !== "string") return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function verifyWhatsAppSignature(body: string | Buffer, signature: string | undefined): Promise<boolean> {
  // Reject early on an empty body or a malformed/absent header, before touching
  // the database or running any comparison. Meta only ever sends "sha256=" + 64
  // hex chars over a non-empty body.
  if (!body || !(body as any).length || typeof signature !== "string" || !/^sha256=[0-9a-f]{64}$/i.test(signature)) return false;
  const s = await getSettings();
  const appSecret = s.whatsappAppSecret;
  if (!appSecret) return false;
  try {
    return signaturesMatch(buildWhatsAppSignature(body, appSecret), signature.toLowerCase());
  } catch {
    return false;
  }
}

export interface WhatsAppWebhookResult {
  // ok === true only when nothing failed AND nothing was deferred (in-progress
  // elsewhere). The HTTP layer must return a retryable status otherwise.
  ok: boolean;
  processed: number;
  skipped: number;   // duplicates already processed successfully
  deferred: number;  // in-progress elsewhere; safely retryable
  failed: number;
  errors: string[];
}

// Maps a webhook outcome to the HTTP status Meta receives. Kept as a pure
// function so the acknowledgement contract is unit-testable:
//   500 -> a real failure; Meta should redeliver
//   503 -> still in progress elsewhere; do NOT ack, Meta should redeliver
//   200 -> fully handled (or a safe idempotent duplicate)
export function whatsAppWebhookHttpStatus(result: WhatsAppWebhookResult): number {
  if (result.failed > 0) return 500;
  if (result.deferred > 0) return 503;
  return 200;
}

// Processes one inbound message: downloads/stores media, logs it, links it to a
// customer/provider conversation and mirrors it into the internal thread. Any
// throw here is caught by the caller, recorded against the durable ledger and
// surfaced as a non-2xx so Meta retries the payload.
async function processInboundMessage(msg: any, value: any): Promise<void> {
  const from = normalizePhone(msg.from || "");
  const msgType = msg.type || "text";
  let content = msgType === "text" ? (msg.text?.body || "") : `[${msgType}]`;
  const contacts = Array.isArray(value.contacts) ? value.contacts : [];
  const contactName = contacts[0]?.profile?.name || "";

  // Download and store media if present. A media-download failure is
  // non-fatal: the message is still logged with its type placeholder.
  if (["image", "audio", "video", "document"].includes(msgType)) {
    const mediaId = msg[msgType]?.id || msg[msgType]?.media_id || "";
    if (mediaId) {
      const dl = await downloadWhatsAppMedia(mediaId);
      if (dl.ok && dl.data) {
        const base64 = dl.data.toString("base64");
        const filename = dl.filename || msg[msgType]?.filename || "";
        await storeWhatsAppMedia(msg.id, from, dl.mimeType || "application/octet-stream", base64, filename);
        content = `[${msgType}:${filename || dl.mimeType || msgType}]`;
      } else if (!dl.ok) {
        console.warn(`[whatsapp] media download failed for ${msg.id}: ${dl.error}`);
      }
    }
  }

  await logWhatsAppMessage(from, "inbound", msgType, content, "received", msg.id);

  // Opt-out keywords (STOP/UNSUBSCRIBE/CANCEL/END/QUIT) are persisted idempotently
  // before any other processing. A throw here fails the event so Meta redelivers
  // and the opt-out is never silently lost. Ordinary inbound messages never
  // restore consent — only an explicit recordConsentGrant call does.
  if (msgType === "text" && detectOptOutKeyword(content)) {
    const recorded = await recordOptOut(from, "inbound_keyword");
    console.log(`[whatsapp] Opt-out recorded for ${from} (${recorded})`);
  }

  const customer = await findCustomerByPhone(from);
  const provider = await findProviderByPhone(from);

  if (customer) {
    const existingConvo = await getWhatsAppConversationByPhone(from);
    await upsertWhatsAppConversation(from, "customer", customer.id, customer.name || contactName, "inbound");
    if (existingConvo) {
      const providerId = existingConvo.entity_type === "provider" ? existingConvo.entity_id : 0;
      if (providerId) await sendMessage(customer.id, providerId, "WhatsApp Message", content, "customer");
    }
  } else if (provider) {
    const existingConvo = await getWhatsAppConversationByPhone(from);
    await upsertWhatsAppConversation(from, "provider", provider.id, provider.company_name || provider.contact_name || contactName, "inbound");
    if (existingConvo) {
      const customerId = existingConvo.entity_type === "customer" ? existingConvo.entity_id : 0;
      if (customerId) await sendMessage(customerId, provider.id, "WhatsApp Message", content, "provider");
    }
  } else {
    await upsertWhatsAppConversation(from, "customer", 0, contactName, "inbound");
  }
}

// Dependency seam: production uses the real ledger + processing functions; tests
// inject a throwing processInbound to exercise the per-event failure path without
// mocking the whole database module.
export interface WhatsAppWebhookDeps {
  claim: (provider: string, eventKey: string, payload: any) => Promise<WebhookClaim>;
  complete: (provider: string, eventKey: string, token: string, httpStatus?: number) => Promise<boolean>;
  fail: (provider: string, eventKey: string, token: string, error: string) => Promise<boolean>;
  processInbound: (msg: any, value: any) => Promise<void>;
}

const defaultWebhookDeps: WhatsAppWebhookDeps = {
  claim: claimWebhookEvent,
  complete: completeWebhookClaim,
  fail: failWebhookClaim,
  processInbound: processInboundMessage,
};

// Processes a Meta webhook payload and reports per-event outcomes. Each inbound
// message and each delivery status is individually claimed in the durable
// `webhook_events` ledger (migration 0018 + lease columns in 0030), so:
//   * a redelivery of an already-processed event is skipped (no duplicates),
//   * a delivery status is processed exactly once,
//   * an event still owned elsewhere is DEFERRED (not acked) and retried,
//   * a failed event is retried on the next Meta redelivery,
//   * a partially-successful payload does not re-run the events that succeeded,
//     and one broken event cannot lose its independent siblings.
export async function handleWhatsAppWebhook(body: any, deps: WhatsAppWebhookDeps = defaultWebhookDeps): Promise<WhatsAppWebhookResult> {
  const result: WhatsAppWebhookResult = { ok: true, processed: 0, skipped: 0, deferred: 0, failed: 0, errors: [] };
  // Unsupported but structurally valid payloads (other objects/fields) are
  // acknowledged safely with an empty result.
  if (!body || body.object !== "whatsapp_business_account") return result;
  const entries = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      if (change?.field !== "messages") continue;
      const value = change.value || {};

      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const msg of messages) {
        const id = String(msg?.id || "");
        if (!id) { result.skipped++; continue; }
        const eventKey = `message:${id}`;
        const claim = await deps.claim("whatsapp", eventKey, msg);
        if (claim.decision === "duplicate") { result.skipped++; continue; }
        if (claim.decision === "in_progress" || !claim.token) { result.deferred++; continue; }
        try {
          await deps.processInbound(msg, value);
          const owned = await deps.complete("whatsapp", eventKey, claim.token, 200);
          if (owned) result.processed++;
          else { result.deferred++; result.errors.push(`${eventKey}: lease lost before completion`); }
        } catch (err: any) {
          const message = err?.message || String(err);
          await deps.fail("whatsapp", eventKey, claim.token, message);
          result.failed++;
          result.errors.push(`${eventKey}: ${message}`);
        }
      }

      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const status of statuses) {
        const id = String(status?.id || "");
        if (!id) { result.skipped++; continue; }
        const statusValue = status.status || "unknown";
        const eventKey = `status:${id}:${statusValue}`;
        const claim = await deps.claim("whatsapp", eventKey, status);
        if (claim.decision === "duplicate") { result.skipped++; continue; }
        if (claim.decision === "in_progress" || !claim.token) { result.deferred++; continue; }
        try {
          const phone = normalizePhone(status.recipient_id || "");
          if (phone) await logWhatsAppMessage(phone, "status", statusValue, "", statusValue, status.id);
          const owned = await deps.complete("whatsapp", eventKey, claim.token, 200);
          if (owned) result.processed++;
          else { result.deferred++; result.errors.push(`${eventKey}: lease lost before completion`); }
        } catch (err: any) {
          const message = err?.message || String(err);
          await deps.fail("whatsapp", eventKey, claim.token, message);
          result.failed++;
          result.errors.push(`${eventKey}: ${message}`);
        }
      }
    }
  }
  result.ok = result.failed === 0 && result.deferred === 0;
  return result;
}

export async function verifyWhatsAppWebhook(mode: string, token: string, challenge: string): Promise<{ ok: boolean; response?: string }> {
  return verifyWhatsAppChallenge(mode, token, challenge);
}

export async function verifyWhatsAppChallenge(mode: string, verifyToken: string, challenge: string): Promise<{ ok: boolean; response?: string }> {
  const settings = await getSettings();
  if (mode === "subscribe" && verifyToken === settings.whatsappVerifyToken) {
    return { ok: true, response: challenge };
  }
  return { ok: false };
}

// Meta's handshake verifies against the stored token; when the merchant has not
// set one the server falls back to this default (see db.ts getSettings). The
// admin UI needs to know whether a *custom* token exists without ever being told
// the token itself (GET /api/settings redacts it).
export const DEFAULT_WHATSAPP_VERIFY_TOKEN = "gear-glitch-wa-verify";

export async function getWhatsAppConfig(): Promise<{
  enabled: boolean;
  configured: boolean;
  phoneNumberId: string;
  businessAccountId: string;
  verifyTokenConfigured: boolean;
  webhookUrl: string;
}> {
  const s = await getSettings();
  // The webhook is a server-to-server endpoint and must resolve to the API host
  // (BASE_URL), NOT the storefront origin (FRONTEND_URL / window.location).
  const apiBase = String(process.env.BASE_URL || "").trim().replace(/\/$/, "");
  return {
    enabled: s.whatsappEnabled,
    configured: !!(s.whatsappPhoneNumberId && s.whatsappAccessToken),
    phoneNumberId: s.whatsappPhoneNumberId,
    businessAccountId: s.whatsappBusinessAccountId,
    verifyTokenConfigured: !!s.whatsappVerifyToken && s.whatsappVerifyToken !== DEFAULT_WHATSAPP_VERIFY_TOKEN,
    webhookUrl: apiBase ? `${apiBase}/api/webhooks/whatsapp` : "/api/webhooks/whatsapp",
  };
}

export async function testWhatsAppConnection(): Promise<{ ok: boolean; error?: string; phoneNumber?: string }> {
  const s = await getSettings();
  if (!s.whatsappPhoneNumberId || !s.whatsappAccessToken) {
    return { ok: false, error: "Phone Number ID and Access Token are required." };
  }
  try {
    const url = `https://graph.facebook.com/${s.whatsappApiVersion || "v21.0"}/${s.whatsappPhoneNumberId}`;
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${s.whatsappAccessToken}` },
    });
    const data = await res.json() as any;
    if (!res.ok) {
      return { ok: false, error: data?.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true, phoneNumber: data.display_phone_number || s.whatsappPhoneNumberId };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Connection failed" };
  }
}

export async function uploadWhatsAppMedia(file: Blob | Buffer | Uint8Array, filename?: string, mimeType?: string): Promise<{ ok: boolean; mediaId?: string; error?: string }> {
  try {
    const s = await getSettings();
    if (!s.whatsappEnabled || !s.whatsappAccessToken || !s.whatsappPhoneNumberId) return { ok: false, error: "WhatsApp not configured" };
    const apiVersion = s.whatsappApiVersion || "v21.0";

    const fileBlob = file instanceof Blob ? file : new Blob([file] as any);
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", mimeType || fileBlob.type || "application/pdf");
    form.append("file", fileBlob as any, filename || "file.pdf");

    const url = `https://graph.facebook.com/${apiVersion}/${s.whatsappPhoneNumberId}/media`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${s.whatsappAccessToken}` },
      body: form as any,
    });

    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: txt || `Failed to upload media: ${res.status}` };
    }
    const data = await res.json();
    if (!data?.id) return { ok: false, error: "No media ID in response" };
    return { ok: true, mediaId: data.id };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Media upload failed" };
  }
}

export async function sendWhatsAppDocumentMessage(to: string, mediaId: string, caption?: string, category: MessageCategory = "utility"): Promise<{ ok: boolean; messageId?: string; error?: string; blocked?: boolean }> {
  try {
    const phone = normalizePhone(to);
    const decision = await isWhatsAppSendingAllowed(phone, category);
    if (!decision.allowed) {
      await logWhatsAppMessage(phone, "outbound", "blocked", caption || "", "blocked", undefined, decision.reason);
      return { ok: false, error: decision.reason, blocked: true };
    }
    const s = await getSettings();
    if (!s.whatsappEnabled || !s.whatsappAccessToken || !s.whatsappPhoneNumberId) return { ok: false, error: "WhatsApp not configured" };
    const apiVersion = s.whatsappApiVersion || "v21.0";

    const url = `https://graph.facebook.com/${apiVersion}/${s.whatsappPhoneNumberId}/messages`;
    const payload: any = {
      messaging_product: "whatsapp",
      to: phone,
      type: "document",
      document: { id: mediaId },
    };
    if (caption) payload.document.caption = caption;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${s.whatsappAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text();
      await logWhatsAppMessage(phone, "outbound", "document", caption || "", "failed", undefined, txt || res.statusText);
      await upsertWhatsAppConversation(phone, "store", 0, caption || "invoice", "outbound");
      return { ok: false, error: txt || `Failed to send document: ${res.status}` };
    }
    const data = await res.json();
    const messageId = data?.messages?.[0]?.id;
    await logWhatsAppMessage(phone, "outbound", "document", caption || "", "sent", messageId);
    await upsertWhatsAppConversation(phone, "store", 0, caption || "invoice", "outbound");
    return { ok: true, messageId };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Document send failed" };
  }
}

export async function sendWhatsAppDocument(
  to: string,
  pdf: Blob | Buffer | Uint8Array | null | undefined,
  filename?: string,
  caption?: string,
  category: MessageCategory = "utility"
): Promise<{ ok: boolean; messageId?: string; error?: string; blocked?: boolean }> {
  try {
    const phone = normalizePhone(to);
    const decision = await isWhatsAppSendingAllowed(phone, category);
    if (!decision.allowed) {
      await logWhatsAppMessage(phone, "outbound", "blocked", caption || "", "blocked", undefined, decision.reason);
      return { ok: false, error: decision.reason, blocked: true };
    }
    const s = await getSettings();
    if (!s.whatsappEnabled || !s.whatsappAccessToken || !s.whatsappPhoneNumberId) return { ok: false, error: "WhatsApp not configured" };
    const apiVersion = s.whatsappApiVersion || "v21.0";

    // Try to upload PDF as media if provided
    if (pdf) {
      const upload = await uploadWhatsAppMedia(pdf, filename, "application/pdf");
      if (upload.ok && upload.mediaId) {
        const sent = await sendWhatsAppDocumentMessage(phone, upload.mediaId, caption, category);
        if (sent.ok) return sent;
        if (sent.blocked) return sent;
        return { ok: false, error: sent.error || "Failed to send document message" };
      }
      // If upload failed, fall through to template fallback below
    }

    // Fallback: try approved template if available (within 24h window constraint applies)
    const templateName = "invoice_notification";
    try {
      const tmpl = await getWhatsAppTemplateByName(templateName);
      if (tmpl && tmpl.language) {
        const bodyVars = caption ? [caption] : [];
        const url = `https://graph.facebook.com/${apiVersion}/${s.whatsappPhoneNumberId}/messages`;
        const payload: any = {
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: templateName,
            language: { code: tmpl.language },
          },
        };
        if (bodyVars.length > 0) {
          payload.template.components = [{ type: "body", parameters: bodyVars.map((v) => ({ type: "text", text: v })) }];
        }
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${s.whatsappAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          const messageId = data?.messages?.[0]?.id;
          await logWhatsAppMessage(phone, "outbound", "template", templateName, "sent", messageId);
          await upsertWhatsAppConversation(phone, "store", 0, templateName, "outbound");
          return { ok: true, messageId };
        }
        const txt = await res.text();
        await logWhatsAppMessage(phone, "outbound", "template", templateName, "failed", undefined, txt || res.statusText);
        await upsertWhatsAppConversation(phone, "store", 0, templateName, "outbound");
      }
    } catch (e: any) {
      // ignore template errors
    }

    return { ok: false, error: "No approved WhatsApp document template (invoice_notification) configured and no PDF media available" };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Document send failed" };
  }
}
