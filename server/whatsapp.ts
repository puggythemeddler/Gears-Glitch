import { getSettings, upsertWhatsAppConversation, getWhatsAppConversationByPhone, logWhatsAppMessage, findCustomerByPhone, findProviderByPhone, sendMessage, storeWhatsAppMedia, getWhatsAppMedia, getWhatsAppTemplateByName } from "./db";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length >= 10) return "254" + digits.slice(1);
  if (digits.startsWith("254")) return digits;
  return digits;
}

function isWithin24Hours(lastIncomingAt: string | null): boolean {
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
    const url = `https://graph.facebook.com/v21.0/${mediaId}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${s.whatsappAccessToken}` },
    });
    if (!res.ok) return { ok: false, error: `Failed to get media URL: ${res.status}` };
    const meta = await res.json() as any;
    const downloadUrl = meta?.url;
    const mime = meta?.mime_type || "application/octet-stream";
    const filename = meta?.filename || "";
    if (!downloadUrl) return { ok: false, error: "No download URL in response" };
    const dl = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${s.whatsappAccessToken}` },
    });
    if (!dl.ok) return { ok: false, error: `Download failed: ${dl.status}` };
    const buf = Buffer.from(await dl.arrayBuffer());
    return { ok: true, data: buf, mimeType: mime, filename };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Media download error" };
  }
}

async function sendWhatsAppText(to: string, text: string): Promise<{ ok: boolean; waMessageId?: string; error?: string; retried?: boolean }> {
  const s = await getSettings();
  if (!s.whatsappEnabled || !s.whatsappPhoneNumberId || !s.whatsappAccessToken) {
    return { ok: false, error: "WhatsApp is not configured or not enabled." };
  }
  const url = `https://graph.facebook.com/v21.0/${s.whatsappPhoneNumberId}/messages`;
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
      if (res.status !== 400) {
        await new Promise(r => setTimeout(r, 3000));
        const retryRes = await fetch(url, {
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
        const retryData = await retryRes.json() as any;
        if (retryRes.ok) {
          const waMessageId = retryData?.messages?.[0]?.id;
          return { ok: true, waMessageId, retried: true };
        }
      }
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
  const url = `https://graph.facebook.com/v21.0/${s.whatsappPhoneNumberId}/messages`;
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
  const url = `https://graph.facebook.com/v21.0/${s.whatsappPhoneNumberId}/messages`;
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
  const url = `https://graph.facebook.com/v21.0/${s.whatsappPhoneNumberId}/messages`;
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

export async function sendWhatsAppMessage(to: string, text: string, entityType: string, entityId: number, entityName: string): Promise<void> {
  const normalizedTo = normalizePhone(to);
  const conversation = await getWhatsAppConversationByPhone(normalizedTo);
  const withinWindow = isWithin24Hours(conversation?.last_incoming_at || null);

  if (withinWindow) {
    const result = await sendWhatsAppText(normalizedTo, text);
    await logWhatsAppMessage(normalizedTo, "outbound", "text", text, result.ok ? "sent" : "failed", result.waMessageId, result.error);
    await upsertWhatsAppConversation(normalizedTo, entityType, entityId, entityName, "outbound");
  } else {
    const template = await getWhatsAppTemplateByName("general_notification");
    const templateName = template?.name || "general_notification";
    const lang = template?.language || "en";
    const result = await sendWhatsAppTemplate(normalizedTo, templateName, lang, [
      { type: "text", text: entityName || "Customer" },
      { type: "text", text: text },
    ]);
    await logWhatsAppMessage(normalizedTo, "outbound", "template", text, result.ok ? "sent" : "failed", result.waMessageId, result.error);
    await upsertWhatsAppConversation(normalizedTo, entityType, entityId, entityName, "outbound");
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

export async function verifyWhatsAppSignature(body: string | Buffer, signature: string | undefined): Promise<boolean> {
  const s = await getSettings();
  const appSecret = s.whatsappAppSecret;
  if (!appSecret || !signature) return false;
  try {
    const crypto = await import("crypto");
    const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(body).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function handleWhatsAppWebhook(body: any): Promise<void> {
  if (body.object !== "whatsapp_business_account") return;
  const entries = body.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field !== "messages") continue;
      const value = change.value || {};

      // Handle incoming messages
      const messages = value.messages || [];
      for (const msg of messages) {
        const from = normalizePhone(msg.from || "");
        const msgType = msg.type || "text";
        let content = msgType === "text" ? (msg.text?.body || "") : `[${msgType}]`;
        const contacts = value.contacts || [];
        const contactName = contacts[0]?.profile?.name || "";

        // Download and store media if present
        if (["image", "audio", "video", "document"].includes(msgType)) {
          const mediaId = msg[msgType]?.id || msg[msgType]?.media_id || "";
          if (mediaId) {
            const dl = await downloadWhatsAppMedia(mediaId);
            if (dl.ok && dl.data) {
              const base64 = dl.data.toString("base64");
              const filename = dl.filename || msg[msgType]?.filename || "";
              await storeWhatsAppMedia(msg.id, from, dl.mimeType || "application/octet-stream", base64, filename);
              content = `[${msgType}:${filename || dl.mimeType || msgType}]`;
            }
          }
        }

        await logWhatsAppMessage(from, "inbound", msgType, content, "received", msg.id);

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

      // Handle status updates
      const statuses = value.statuses || [];
      for (const status of statuses) {
        const phone = normalizePhone(status.recipient_id || "");
        const statusValue = status.status || "unknown";
        if (phone) {
          await logWhatsAppMessage(phone, "status", statusValue, "", statusValue, status.id);
        }
      }
    }
  }
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

export async function getWhatsAppConfig(): Promise<{ enabled: boolean; configured: boolean; phoneNumberId: string; businessAccountId: string }> {
  const s = await getSettings();
  return {
    enabled: s.whatsappEnabled,
    configured: !!(s.whatsappPhoneNumberId && s.whatsappAccessToken),
    phoneNumberId: s.whatsappPhoneNumberId,
    businessAccountId: s.whatsappBusinessAccountId,
  };
}

export async function testWhatsAppConnection(): Promise<{ ok: boolean; error?: string; phoneNumber?: string }> {
  const s = await getSettings();
  if (!s.whatsappPhoneNumberId || !s.whatsappAccessToken) {
    return { ok: false, error: "Phone Number ID and Access Token are required." };
  }
  try {
    const url = `https://graph.facebook.com/v21.0/${s.whatsappPhoneNumberId}`;
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
