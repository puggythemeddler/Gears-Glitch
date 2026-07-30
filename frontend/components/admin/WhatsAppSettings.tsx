import React, { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import RippleButton from "@/components/RippleButton";

declare function api<T>(url: string, opts?: any): Promise<T>;
declare function escapeHtml(v: string): string;

function Spinner() { return <div style={{ textAlign: "center", padding: "2rem" }}><div className="loading-bar" /><p className="muted">Loading...</p></div>; }

export default function WhatsAppSettings() {
  const { refreshSettings } = useApp();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [testResult, setTestResult] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    api<any>("/api/settings").then((s) => { setSettings(s); setLoading(false); }).catch(() => setLoading(false));
    api<any>("/api/admin/whatsapp/config").then(setConfig).catch((e) => console.warn("[admin] Failed to load WhatsApp config:", e?.message));
    api<any>("/api/admin/whatsapp/stats").then(setStats).catch((e) => console.warn("[admin] Failed to load WhatsApp stats:", e?.message));
    api<any>("/api/admin/whatsapp/logs?limit=30").then((d) => setLogs(d.logs || [])).catch((e) => console.warn("[admin] Failed to load WhatsApp logs:", e?.message));
  }, []);

  async function saveWhatsAppSettings() {
    if (!settings) return;
    setSaving(true); setMsg("");
    try {
      const updated = await api<any>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          whatsappEnabled: settings.whatsappEnabled,
          whatsappPhoneNumberId: settings.whatsappPhoneNumberId,
          whatsappAccessToken: settings.whatsappAccessToken,
          whatsappAppSecret: settings.whatsappAppSecret,
          whatsappVerifyToken: settings.whatsappVerifyToken,
          whatsappBusinessAccountId: settings.whatsappBusinessAccountId,
        }),
      });
      setSettings(updated);
      setMsg("WhatsApp settings saved.");
      api<any>("/api/admin/whatsapp/config").then(setConfig).catch((e) => console.warn("[admin] Failed to reload WhatsApp config:", e?.message));
    } catch (e: any) { setMsg("Error: " + e.message); }
    finally { setSaving(false); }
  }

  async function testConnection() {
    setTestLoading(true); setTestResult("");
    try {
      const d = await api<any>("/api/admin/whatsapp/test", { method: "POST" });
      setTestResult(d.ok ? `Connected! Phone: ${d.phoneNumber}` : `Failed: ${d.error}`);
    } catch (e: any) { setTestResult("Error: " + e.message); }
    finally { setTestLoading(false); }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <h1 style={{ marginTop: 0 }}>WhatsApp Settings</h1>

      <div className="panel" style={{ maxWidth: 600, marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Connection</h3>
        {config && (
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.8rem", padding: "4px 10px", borderRadius: 6, background: config.enabled ? "var(--success-light, #d1fae5)" : "var(--border)", color: config.enabled ? "var(--success, #065f46)" : "var(--text-secondary)" }}>
              {config.enabled ? "Enabled" : "Disabled"}
            </span>
            <span style={{ fontSize: "0.8rem", padding: "4px 10px", borderRadius: 6, background: config.configured ? "var(--success-light, #d1fae5)" : "var(--warning-light, #fef3c7)", color: config.configured ? "var(--success, #065f46)" : "var(--warning, #92400e)" }}>
              {config.configured ? "Configured" : "Not Configured"}
            </span>
          </div>
        )}

        <div className="field">
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input type="checkbox" checked={settings?.whatsappEnabled || false} onChange={(e) => setSettings({ ...settings, whatsappEnabled: e.target.checked })} style={{ width: "auto" }} />
            Enable WhatsApp notifications
          </label>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0.25rem 0 0" }}>When enabled, messages sent through the system will also be sent via WhatsApp to the recipient.</p>
        </div>

        <div className="field"><label>Phone Number ID
          <input value={settings?.whatsappPhoneNumberId || ""} onChange={(e) => setSettings({ ...settings, whatsappPhoneNumberId: e.target.value })} placeholder="e.g. 123456789012345" />
        </label></div>
        <div className="field"><label>Access Token
          <input type="password" value={settings?.whatsappAccessToken || ""} onChange={(e) => setSettings({ ...settings, whatsappAccessToken: e.target.value })} placeholder="EAAxxxx..." />
        </label></div>
        <div className="field"><label>App Secret
          <input type="password" value={settings?.whatsappAppSecret || ""} onChange={(e) => setSettings({ ...settings, whatsappAppSecret: e.target.value })} placeholder="32-char hex" />
        </label></div>
        <div className="field"><label>Verify Token
          <input value={settings?.whatsappVerifyToken || ""} onChange={(e) => setSettings({ ...settings, whatsappVerifyToken: e.target.value })} placeholder="your-random-verify-token" />
        </label></div>
        <div className="field"><label>Business Account ID
          <input value={settings?.whatsappBusinessAccountId || ""} onChange={(e) => setSettings({ ...settings, whatsappBusinessAccountId: e.target.value })} placeholder="WABA ID" />
        </label></div>

        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0.5rem 0 1rem" }}>
          Get these values from <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener">Meta Developer Dashboard</a> → Your App → WhatsApp → API Setup.
        </p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <RippleButton onClick={saveWhatsAppSettings} loading={saving}>Save</RippleButton>
          <RippleButton variant="ghost" onClick={testConnection} loading={testLoading}>Test Connection</RippleButton>
        </div>
        {msg && <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: msg.startsWith("Error") ? "var(--danger)" : "var(--success)" }}>{msg}</p>}
        {testResult && <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: testResult.startsWith("Connected") ? "var(--success)" : "var(--danger)" }}>{testResult}</p>}
      </div>

      <div className="panel" style={{ maxWidth: 600, marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Webhook URL</h3>
        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
          Register this URL in Meta Developer Dashboard → WhatsApp → Configuration → Webhook:
        </p>
        <code style={{ display: "block", padding: "0.5rem 0.75rem", background: "var(--surface, #f8fafc)", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.8rem", wordBreak: "break-all" }}>
          {typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/whatsapp` : "/api/webhooks/whatsapp"}
        </code>
        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>
          Verify Token: <strong>{settings?.whatsappVerifyToken || "gear-glitch-wa-verify"}</strong>
        </p>
      </div>

      {stats && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h3>Stats</h3>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-card__value">{stats.totalSent}</div><div className="stat-card__label">Messages Sent</div></div>
            <div className="stat-card"><div className="stat-card__value">{stats.totalReceived}</div><div className="stat-card__label">Messages Received</div></div>
            <div className="stat-card"><div className="stat-card__value">{stats.conversations}</div><div className="stat-card__label">Conversations</div></div>
            <div className="stat-card"><div className="stat-card__value">{stats.failed}</div><div className="stat-card__label">Failed</div></div>
          </div>
        </div>
      )}

      <div className="panel" style={{ maxWidth: 800 }}>
        <h3 style={{ marginTop: 0 }}>Message Log</h3>
        {logs.length === 0 ? <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>No WhatsApp messages sent yet.</p> : (
          <div className="table-wrap">
            <table className="data-table" style={{ fontSize: "0.8rem" }}>
              <thead><tr><th>Phone</th><th>Direction</th><th>Type</th><th>Content</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {logs.map((l: any) => (
                  <tr key={l.id}>
                    <td>{escapeHtml(l.phone_number)}</td>
                    <td><span style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: 4, background: l.direction === "outbound" ? "var(--primary-light, #e0e7ff)" : "var(--success-light, #d1fae5)" }}>{l.direction}</span></td>
                    <td><span style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: 4, background: "var(--border)" }}>{l.message_type}</span></td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{escapeHtml(l.content)}</td>
                    <td><span style={{ color: l.status === "sent" || l.status === "received" ? "var(--success)" : l.status === "failed" ? "var(--danger)" : "var(--text-secondary)" }}>{l.status}</span></td>
                    <td>{new Date(l.created_at).toLocaleString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}