import React from "react";
import { useApp, CURRENCY_NAMES } from "@/lib/app-context";

const POPULAR_CURRENCIES = ["KES", "USD", "EUR", "GBP", "NGN", "ZAR"];

export default function CurrencySelector() {
  const { selectedCurrency, exchangeRates, setCurrency } = useApp();

  const available = Object.keys(exchangeRates).length > 0
    ? POPULAR_CURRENCIES.filter((c) => c === "KES" || exchangeRates[c])
    : ["KES"];

  if (available.length <= 1) return null;

  return (
    <select
      value={selectedCurrency || "KES"}
      onChange={(e) => setCurrency(e.target.value)}
      style={{
        fontSize: "0.8rem", padding: "0.2rem 0.4rem", borderRadius: 6,
        border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
        cursor: "pointer", maxWidth: 160,
      }}
      aria-label="Select currency"
    >
      {available.map((code) => (
        <option key={code} value={code}>
          {code} — {CURRENCY_NAMES[code] || code}
        </option>
      ))}
    </select>
  );
}
