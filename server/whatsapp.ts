import { getSettings, upsertWhatsAppConversation, getWhatsAppConversationByPhone, logWhatsAppMessage, findCustomerByPhone, findProviderByPhone, sendMessage } from "./db";

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

async function sendWhatsAppText(to: string, text: string): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
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

export async function sendWhatsAppMessage(to: string, text: string, entityType: string, entityId: number, entityName: string): Promise<void> {
  const normalizedTo = normalizePhone(to);
  const conversation = await getWhatsAppConversationByPhone(normalizedTo);
  const withinWindow = isWithin24Hours(conversation?.last_incoming_at || null);

  if (withinWindow) {
    const result = await sendWhatsAppText(normalizedTo, text);
    await logWhatsAppMessage(normalizedTo, "outbound", "text", text, result.ok ? "sent" : "failed", result.waMessageId, result.error);
    await upsertWhatsAppConversation(normalizedTo, entityType, entityId, entityName, "outbound");
  } else {
    const result = await sendWhatsAppTemplate(normalizedTo, "general_notification", "en", [
      { type: "text", text: entityName || "Customer" },
      { type: "text", text: text },
    ]);
    await logWhatsAppMessage(normalizedTo, "outbound", "template", text, result.ok ? "sent" : "failed", result.waMessageId, result.error);
    await upsertWhatsAppConversation(normalizedTo, entityType, entityId, entityName, "outbound");
  }
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
        const content = msgType === "text" ? (msg.text?.body || "") : `[${msgType}]`;
        const contacts = value.contacts || [];
        const contactName = contacts[0]?.profile?.name || "";

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
