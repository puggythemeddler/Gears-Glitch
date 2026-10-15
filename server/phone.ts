// Phone-number normalisation helpers shared by the WhatsApp send path and the
// consent/opt-out policy. Kept in their own module so consent code can normalise
// numbers without importing (and creating a cycle with) server/whatsapp.ts.

// Normalizes Kenyan phone numbers to E.164-without-plus (2547XXXXXXXX). Accepts
// 07XXXXXXXX, 01XXXXXXXX, +2547XXXXXXXX and 254XXXXXXXXX; strips spaces, dashes
// and any other non-digit characters. Numbers that are not Kenyan are returned
// digit-only so callers can still attempt delivery.
export function normalizePhone(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length >= 10) return "254" + digits.slice(1);
  if (digits.startsWith("254") && digits.length > 9) return digits;
  return digits;
}

// True only for a complete Kenyan MSISDN in E.164-without-plus form
// (254 + 9 digits). Used to reject obviously malformed inbound senders before
// they are written to the conversation log.
export function isValidKenyanPhone(phone: string): boolean {
  return /^254\d{9}$/.test(normalizePhone(phone));
}
