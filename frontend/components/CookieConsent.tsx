import React, { useEffect, useState } from "react";

// DRAFT cookie/consent banner.
//
// IMPORTANT: this is a UI + client-side preference store only. It records the
// visitor's choice so that non-essential scripts can be gated on it, but it
// does NOT itself load or block any third-party tracker (none are currently
// wired). Before adding analytics/marketing tags, gate them on
// getConsent().analytics / getConsent().marketing. Legal review required -
// see LEGAL_REVIEW_REQUIRED.md.

export const CONSENT_KEY = "gg_cookie_consent_v1";

export interface CookieConsent {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  ts: string;
}

export function getConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    return raw ? (JSON.parse(raw) as CookieConsent) : null;
  } catch {
    return null;
  }
}

function save(c: CookieConsent) {
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(c));
    window.dispatchEvent(new CustomEvent("gg-consent-changed", { detail: c }));
  } catch {
    /* storage unavailable - banner will simply reappear */
  }
}

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (!getConsent()) setVisible(true);
  }, []);

  if (!visible) return null;

  const decide = (a: boolean, m: boolean) => {
    save({ essential: true, analytics: a, marketing: m, ts: new Date().toISOString() });
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        background: "var(--surface, #fff)",
        color: "var(--text, #111)",
        borderTop: "1px solid var(--border, #ddd)",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.12)",
        padding: "1rem",
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}>
          We use essential cookies to run this site, and optional cookies to
          understand usage and improve marketing. You can accept all, reject
          non-essential cookies, or choose. See our{" "}
          <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms of Service</a>.
        </p>

        {showPrefs && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", margin: "0 0 0.75rem", fontSize: "0.9rem" }}>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input type="checkbox" checked disabled /> Essential (always on)
            </label>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} /> Analytics
            </label>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /> Marketing
            </label>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={() => decide(true, true)}>Accept all</button>
          <button type="button" className="btn btn-secondary" onClick={() => decide(false, false)}>Reject non-essential</button>
          {showPrefs ? (
            <button type="button" className="btn btn-ghost" onClick={() => decide(analytics, marketing)}>Save choices</button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setShowPrefs(true)}>Manage preferences</button>
          )}
        </div>
      </div>
    </div>
  );
}
