import React, { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import RippleButton from "@/components/RippleButton";
import Icon from "@/components/icons";
import { escapeHtml, Spinner } from "@/components/admin/shared";
import { toast } from "@/components/Toast";
import { confirmDialog } from "@/components/ConfirmDialog";
import type { AdminView } from "@/pages/admin";

interface HealthEntry {
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

interface GmailStatus {
  configured: boolean;
  status: string;
  email?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
  lastTestAt?: string;
  lastTestResult?: string;
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  connected: { text: "Connected", cls: "badge-success" },
  configured: { text: "Configured", cls: "badge-success" },
  not_configured: { text: "Not configured", cls: "badge-default" },
  disabled: { text: "Disabled", cls: "badge-default" },
  token_expired: { text: "Needs re-connect", cls: "badge-warning" },
  error: { text: "Error", cls: "badge-danger" },
};

function formatTime(iso?: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function ProviderCard({ entry, gmail, onConnect }: { entry: HealthEntry; gmail?: GmailStatus; onConnect(): void }) {
  const [testLoading, setTestLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const status = STATUS_LABEL[entry.status] || { text: entry.status, cls: "badge-muted" };
  const isGmail = entry.provider === "gmail";
  const connected = entry.status === "connected";

  async function runTest() {
    setTestLoading(true);
    try {
      await api("/api/integrations/gmail/test", { method: "POST" });
      toast("success", "Gmail connection test passed.");
      window.location.reload();
    } catch (e: any) {
      toast("error", e.message || "Connection test failed.");
      window.location.reload();
    } finally { setTestLoading(false); }
  }

  async function disconnect() {
    const ok = await confirmDialog({ title: "Disconnect Gmail?", message: "Gmail will no longer be used for sending email. Notifications fall back to SMTP or are logged only.", confirmLabel: "Disconnect" });
    if (!ok) return;
    setDisconnecting(true);
    try {
      await api("/api/integrations/gmail/disconnect", { method: "POST" });
      toast("success", "Gmail disconnected.");
      window.location.reload();
    } catch (e: any) { toast("error", e.message || "Failed to disconnect."); } finally { setDisconnecting(false); }
  }

  return (
    <div className="panel" style={{ padding: "1rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Icon name={isGmail ? "mail" : entry.provider === "whatsapp" ? "messageCircle" : entry.provider === "daraja" ? "smartphone" : "globe"} size={16} />
            <strong>{escapeHtml(entry.label)}</strong>
          </div>
          <span className={status.cls} style={{ marginTop: "0.35rem", display: "inline-block" }}>{escapeHtml(status.text)}</span>
          {entry.meta && (
            <div style={{ marginTop: "0.35rem", color: "var(--muted)", fontSize: "0.85rem" }}>
              {Object.entries(entry.meta).map(([k, v]) => v ? <span key={k} style={{ marginRight: "0.6rem" }}>{k}: <code>{escapeHtml(String(v))}</code></span> : null)}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", alignItems: "flex-end", flexShrink: 0 }}>
          {isGmail && !connected && <RippleButton size="small" variant="primary" onClick={onConnect}>Connect Gmail</RippleButton>}
          {isGmail && connected && <RippleButton size="small" variant="ghost" disabled={testLoading} loading={testLoading} onClick={runTest}>Test connection</RippleButton>}
          {isGmail && connected && <RippleButton size="small" variant="ghost" disabled={disconnecting} loading={disconnecting} onClick={disconnect}>Disconnect</RippleButton>}
        </div>
      </div>

      {gmail && isGmail && (
        <div style={{ marginTop: "0.6rem", fontSize: "0.85rem", color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: "0.6rem" }}>
          <div>Connected account: {gmail.email ? <strong>{escapeHtml(gmail.email)}</strong> : "—"}</div>
          <div>Last success: {formatTime((gmail as any).lastSuccessAt || entry.lastSuccessAt)}</div>
          <div>Last failure: {formatTime((gmail as any).lastFailureAt || entry.lastFailureAt)}</div>
          <div>Last test: {formatTime((gmail as any).lastTestAt || entry.lastTestAt)} {entry.lastTestResult ? `— ${escapeHtml(String(entry.lastTestResult))}` : ""}</div>
          {entry.lastError && <div>Last error: <code>{escapeHtml(entry.lastError)}</code></div>}
        </div>
      )}

      {!isGmail && (entry.lastError || entry.lastFailureAt) && (
        <div style={{ marginTop: "0.6rem", fontSize: "0.85rem", color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: "0.6rem" }}>
          {entry.lastFailureAt && <div>Last failure: {formatTime(entry.lastFailureAt)}</div>}
          {entry.lastError && <div>Last error: <code>{escapeHtml(entry.lastError)}</code></div>}
        </div>
      )}
    </div>
  );
}

export default function IntegrationsSettings({ onNavigate }: { onNavigate?: (view: AdminView) => void }) {
  const [checks, setChecks] = useState<HealthEntry[] | null>(null);
  const [gmail, setGmail] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectLoading, setConnectLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api<{ checks?: HealthEntry[] }>("/api/integrations/status").then((d) => setChecks(d.checks || [])).catch((e) => { toast("error", e.message || "Failed to load integration status."); setChecks([]); }).finally(() => setLoading(false));
    api<GmailStatus>("/api/integrations/gmail").then(setGmail).catch((e) => console.warn("[admin] Failed to load Gmail status:", e?.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function connectGmail() {
    setConnectLoading(true);
    try {
      const d = await api<{ url: string }>("/api/integrations/gmail/auth-url");
      window.location.href = d.url || "/admin?integration=gmail&error=no_url";
    } catch (e: any) {
      toast("error", e.message || "Unable to start Gmail connection.");
      setConnectLoading(false);
    }
  }

  function byProvider(p: HealthEntry["provider"]): HealthEntry | undefined {
    return checks?.find((c) => c.provider === p);
  }

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <h3>Integrations</h3>
        <RippleButton size="small" variant="ghost" onClick={load}>Refresh</RippleButton>
      </div>
      <p style={{ color: "var(--muted)", fontSize: "0.9rem", maxWidth: 720, marginTop: 0 }}>
        Health of the external providers used by this store. Secrets are never shown — only status and safe metadata.
      </p>

      {loading ? (
        <div className="panel" style={{ padding: "2rem", textAlign: "center" }}><Spinner /></div>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {byProvider("gmail") && <ProviderCard entry={byProvider("gmail")!} gmail={gmail || undefined} onConnect={connectGmail} />}
          {byProvider("whatsapp") && (
            <div className="panel" style={{ padding: "1rem" }}>
              <ProviderCard entry={byProvider("whatsapp")!} onConnect={() => {}} />
              <RippleButton size="small" variant="ghost" style={{ marginTop: "0.5rem" }} onClick={() => onNavigate?.("whatsapp-settings")}>Configure WhatsApp</RippleButton>
            </div>
          )}
          {byProvider("daraja") && (
            <div className="panel" style={{ padding: "1rem" }}>
              <ProviderCard entry={byProvider("daraja")!} onConnect={() => {}} />
              <RippleButton size="small" variant="ghost" style={{ marginTop: "0.5rem" }} onClick={() => onNavigate?.("settings-payments")}>Configure M-Pesa</RippleButton>
            </div>
          )}
          {byProvider("google") && <ProviderCard entry={byProvider("google")!} onConnect={() => {}} />}
        </div>
      )}

      <div className="panel" style={{ marginTop: "1rem", padding: "1rem", fontSize: "0.85rem", color: "var(--muted)" }}>
        <strong>How outbound email is routed</strong>
        <p style={{ marginBottom: 0, marginTop: "0.35rem" }}>
          When Google SMTP is connected, transactional admin email is sent through Gmail. If Gmail fails or is not
          connected, the app falls back to SMTP settings in System → Email, and otherwise logs the message without
          sending. Customer notifications are delivered through this page&apos;s status and the durable queue in the
          Notifications settings.
        </p>
      </div>
    </div>
  );
}