let _overrideCurrency = "";
let _overrideRates: Record<string, number> = {};

export function setFormatConfig(currency: string, rates: Record<string, number>) {
  _overrideCurrency = currency;
  _overrideRates = rates;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  KES: "KSh", USD: "$", EUR: "€", GBP: "£", NGN: "₦", ZAR: "R",
  EGP: "E£", MAD: "MAD", GHS: "GH¢", CAD: "CA$", BRL: "R$", MXN: "MX$",
  JPY: "¥", CNY: "¥", HKD: "HK$", SGD: "S$", AED: "د.إ", INR: "₹",
  THB: "฿", KRW: "₩", AUD: "A$", NZD: "NZ$", IDR: "Rp", MYR: "RM",
};

export function formatPrice(amount: number) {
  const code = _overrideCurrency;
  const rate = code && code !== "KES" ? _overrideRates[code] : undefined;
  if (!code || code === "KES" || !rate) {
    return new Intl.NumberFormat("en", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);
  }
  const converted = amount * rate;
  const sym = CURRENCY_SYMBOLS[code] || code;
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(converted);
  } catch {
    return `${sym} ${converted.toFixed(2)}`;
  }
}

export { escapeHtml } from "@/lib/sanitize";
