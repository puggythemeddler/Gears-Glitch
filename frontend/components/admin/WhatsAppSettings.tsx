import React, { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import RippleButton from "@/components/RippleButton";
import { api } from "@/lib/api";
import { escapeHtml } from "@/components/admin/shared";

function Spinner() { return <div style={{ textAlign: "center", padding: "2rem" }}><div className="loading-bar" /><p className="muted">Loading...</p></div>; }

function MediaPreview({ content, logs }: { content: string; logs: any[] }) {
  const match = content.match(/^\[image:(.*)\]$/);
  if (!match) return <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>{escapeHtml(content)}</span>;
  const filename = match[1];
  const log = logs.find(l => l.content === content);
  if (!log?.id) return <span>{escapeHtml(content)}</span>;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "var(--primary)" }}>{"📷"} {escapeHtml(filename || "image")}</span>;
}

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
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesTab, setTemplatesTab] = useState(false);
  const [interactiveTab, setInteractiveTab] = useState(false);

  // Template form
  const [newTmpl, setNewTmpl] = useState({ name: "", bodyText: "", language: "en", category: "UTILITY", headerType: "none", headerText: "", footerText: "" });
  const [tmplMsg, setTmplMsg] = useState("");

  // Interactive message form
  const [intPhone, setIntPhone] = useState("");
  const [intType, setIntType] = useState<"buttons" | "list">("buttons");
  const [intBody, setIntBody] = useState("");
  const [intBtns, setIntBtns] = useState([{ id: "btn_1", title: "Option 1" }, { id: "btn_2", title: "Option 2" }]);
  const [intListBtn, setIntListBtn] = useState("Options");
  const [intSections, setIntSections] = useState([{ title: "Section 1", rows: [{ id: "row_1", title: "Item 1", description: "" }] }]);
  const [intResult, setIntResult] = useState("");

  function loadAll() {
    api<any>("/api/settings").then((s) => { setSettings(s); setLoading(false); }).catch(() => setLoading(false));
    api<any>("/api/admin/whatsapp/config").then(setConfig).catch((e) => console.warn("[admin] Failed to load WhatsApp config:", e?.message));
    api<any>("/api/admin/whatsapp/stats").then(setStats).catch((e) => console.warn("[admin] Failed to load WhatsApp stats:", e?.message));
    api<any>("/api/admin/whatsapp/logs?limit=30").then((d) => setLogs(d.logs || [])).catch((e) => console.warn("[admin] Failed to load WhatsApp logs:", e?.message));
    api<any>("/api/admin/whatsapp/templates").then((d) => setTemplates(d.templates || [])).catch((e) => console.warn("[admin] Failed to load templates:", e?.message));
  }

  useEffect(() => { loadAll(); }, []);

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

  async function createTemplate() {
    setTmplMsg("");
    if (!newTmpl.name.trim() || !newTmpl.bodyText.trim()) { setTmplMsg("Name and body text are required."); return; }
    try {
      const d = await api<any>("/api/admin/whatsapp/templates", {
        method: "POST",
        body: JSON.stringify(newTmpl),
      });
      if (d.ok) {
        setTemplates([...templates, d.template]);
        setNewTmpl({ name: "", bodyText: "", language: "en", category: "UTILITY", headerType: "none", headerText: "", footerText: "" });
        setTmplMsg("Template created.");
      } else { setTmplMsg(d.error || "Failed to create template"); }
    } catch (e: any) { setTmplMsg("Error: " + e.message); }
  }

  async function deleteTemplate(id: number) {
    if (!confirm("Delete this WhatsApp template?")) return;
    try {
      await api<any>(`/api/admin/whatsapp/templates/${id}`, { method: "DELETE" });
      setTemplates(templates.filter(t => t.id !== id));
    } catch (e: any) { setTmplMsg("Error: " + e.message); }
  }

  async function sendInteractive() {
    setIntResult("");
    if (!intPhone.trim()) { setIntResult("Phone number is required."); return; }
    try {
      const d = await api<any>("/api/admin/whatsapp/send-interactive", {
        method: "POST",
        body: JSON.stringify({
          to: intPhone.trim(),
          type: intType === "list" ? "list" : "buttons",
          bodyText: intBody,
          buttons: intBtns.slice(0, 3),
          buttonText: intListBtn,
          sections: intSections,
        }),
      });
      setIntResult(d.ok ? `Sent! Message ID: ${d.waMessageId || "N/A"}` : `Failed: ${d.error}`);
    } catch (e: any) { setIntResult("Error: " + e.message); }
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

      <div className="panel" style={{ maxWidth: 800, marginBottom: "1.5rem" }}>
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
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <MediaPreview content={l.content} logs={logs} />
                    </td>
                    <td><span style={{ color: l.status === "sent" || l.status === "received" ? "var(--success)" : l.status === "failed" ? "var(--danger)" : "var(--text-secondary)" }}>{l.status}</span></td>
                    <td>{new Date(l.created_at).toLocaleString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem" }}>
        <RippleButton variant={templatesTab ? "primary" : "ghost"} onClick={() => setTemplatesTab(!templatesTab)}>Templates</RippleButton>
        <RippleButton variant={interactiveTab ? "primary" : "ghost"} onClick={() => setInteractiveTab(!interactiveTab)}>Send Interactive</RippleButton>
      </div>

      {templatesTab && (
        <div className="panel" style={{ maxWidth: 700, marginBottom: "1.5rem" }}>
          <h3 style={{ marginTop: 0 }}>WhatsApp Templates</h3>
          {templates.length === 0 ? <p style={{ color: "var(--text-secondary)" }}>No templates yet. Messages will use the hardcoded "general_notification" template.</p> : (
            <div className="table-wrap" style={{ marginBottom: "1rem" }}>
              <table className="data-table" style={{ fontSize: "0.8rem" }}>
                <thead><tr><th>Name</th><th>Category</th><th>Header</th><th>Body</th><th></th></tr></thead>
                <tbody>
                  {templates.map((t: any) => (
                    <tr key={t.id}>
                      <td><strong>{escapeHtml(t.name)}</strong></td>
                      <td>{escapeHtml(t.category)}</td>
                      <td><span style={{ fontSize: "0.75rem" }}>{t.header_type !== "none" ? escapeHtml(t.header_text) : "-"}</span></td>
                      <td style={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{escapeHtml(t.body_text)}</td>
                      <td><RippleButton variant="danger" size="small" onClick={() => deleteTemplate(t.id)}>Delete</RippleButton></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h4>Create Template</h4>
          <div className="field"><label>Name <input value={newTmpl.name} onChange={e => setNewTmpl({ ...newTmpl, name: e.target.value })} placeholder="e.g. order_confirmation" /></label></div>
          <div className="field"><label>Body Text <textarea rows={3} value={newTmpl.bodyText} onChange={e => setNewTmpl({ ...newTmpl, bodyText: e.target.value })} placeholder="Hello {{1}}, your order is confirmed!" /></label></div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <div className="field" style={{ flex: 1 }}><label>Language <input value={newTmpl.language} onChange={e => setNewTmpl({ ...newTmpl, language: e.target.value })} placeholder="en" /></label></div>
            <div className="field" style={{ flex: 1 }}><label>Category
              <select value={newTmpl.category} onChange={e => setNewTmpl({ ...newTmpl, category: e.target.value })}>
                <option value="UTILITY">UTILITY</option>
                <option value="MARKETING">MARKETING</option>
                <option value="AUTHENTICATION">AUTHENTICATION</option>
              </select>
            </label></div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <div className="field" style={{ flex: 1 }}><label>Header Type
              <select value={newTmpl.headerType} onChange={e => setNewTmpl({ ...newTmpl, headerType: e.target.value })}>
                <option value="none">None</option>
                <option value="text">Text</option>
              </select>
            </label></div>
            {newTmpl.headerType !== "none" && <div className="field" style={{ flex: 1 }}><label>Header Text <input value={newTmpl.headerText} onChange={e => setNewTmpl({ ...newTmpl, headerText: e.target.value })} /></label></div>}
            <div className="field" style={{ flex: 1 }}><label>Footer <input value={newTmpl.footerText} onChange={e => setNewTmpl({ ...newTmpl, footerText: e.target.value })} placeholder="Optional footer" /></label></div>
          </div>
          <RippleButton onClick={createTemplate}>Create Template</RippleButton>
          {tmplMsg && <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: tmplMsg.startsWith("Error") ? "var(--danger)" : "var(--success)" }}>{tmplMsg}</p>}
        </div>
      )}

      {interactiveTab && (
        <div className="panel" style={{ maxWidth: 600, marginBottom: "1.5rem" }}>
          <h3 style={{ marginTop: 0 }}>Send Interactive Message</h3>
          <div className="field"><label>Phone Number <input value={intPhone} onChange={e => setIntPhone(e.target.value)} placeholder="254712345678" /></label></div>
          <div className="field"><label>Message Body <textarea rows={2} value={intBody} onChange={e => setIntBody(e.target.value)} placeholder="What would you like to do?" /></label></div>
          <div className="field"><label>Type
            <select value={intType} onChange={e => setIntType(e.target.value as any)}>
              <option value="buttons">Reply Buttons</option>
              <option value="list">List Menu</option>
            </select>
          </label></div>
          {intType === "buttons" ? (
            <div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Up to 3 buttons:</p>
              {intBtns.map((b, i) => (
                <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                  <input style={{ flex: 1 }} value={b.title} onChange={e => { const a = [...intBtns]; a[i] = { ...a[i], title: e.target.value }; setIntBtns(a); }} placeholder="Button title" />
                  <input style={{ width: 100 }} value={b.id} onChange={e => { const a = [...intBtns]; a[i] = { ...a[i], id: e.target.value }; setIntBtns(a); }} placeholder="ID" />
                  {intBtns.length > 1 && <RippleButton variant="ghost" size="small" onClick={() => setIntBtns(intBtns.filter((_, j) => j !== i))}>X</RippleButton>}
                </div>
              ))}
              {intBtns.length < 3 && <RippleButton variant="ghost" size="small" onClick={() => setIntBtns([...intBtns, { id: `btn_${intBtns.length + 1}`, title: `Option ${intBtns.length + 1}` }])}>+ Add Button</RippleButton>}
            </div>
          ) : (
            <div>
              <div className="field"><label>List Button Text <input value={intListBtn} onChange={e => setIntListBtn(e.target.value)} placeholder="Options" /></label></div>
              {intSections.map((s, si) => (
                <div key={si} style={{ marginBottom: "0.75rem", padding: "0.5rem", border: "1px solid var(--border)", borderRadius: 6 }}>
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input style={{ flex: 1 }} value={s.title} onChange={e => { const a = [...intSections]; a[si] = { ...a[si], title: e.target.value }; setIntSections(a); }} placeholder="Section title" />
                    {intSections.length > 1 && <RippleButton variant="ghost" size="small" onClick={() => setIntSections(intSections.filter((_, j) => j !== si))}>X</RippleButton>}
                  </div>
                  {s.rows.map((r, ri) => (
                    <div key={ri} style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem", alignItems: "center" }}>
                      <input style={{ flex: 1 }} value={r.title} onChange={e => { const a = [...intSections]; a[si].rows[ri] = { ...a[si].rows[ri], title: e.target.value }; setIntSections(a); }} placeholder="Row title" />
                      <input style={{ width: 120 }} value={r.id} onChange={e => { const a = [...intSections]; a[si].rows[ri] = { ...a[si].rows[ri], id: e.target.value }; setIntSections(a); }} placeholder="Row ID" />
                      {s.rows.length > 1 && <RippleButton variant="ghost" size="small" onClick={() => { const a = [...intSections]; a[si].rows = a[si].rows.filter((_, j) => j !== ri); setIntSections(a); }}>X</RippleButton>}
                    </div>
                  ))}
                  {s.rows.length < 10 && <RippleButton variant="ghost" size="small" onClick={() => { const a = [...intSections]; a[si].rows.push({ id: `row_${a[si].rows.length + 1}`, title: `Item ${a[si].rows.length + 1}`, description: "" }); setIntSections(a); }}>+ Add Row</RippleButton>}
                </div>
              ))}
              <RippleButton variant="ghost" size="small" onClick={() => setIntSections([...intSections, { title: `Section ${intSections.length + 1}`, rows: [{ id: `row_1`, title: "Item 1", description: "" }] }])}>+ Add Section</RippleButton>
            </div>
          )}
          <div style={{ marginTop: "1rem" }}>
            <RippleButton onClick={sendInteractive}>Send Message</RippleButton>
          </div>
          {intResult && <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: intResult.startsWith("Sent") ? "var(--success)" : "var(--danger)" }}>{intResult}</p>}
        </div>
      )}
    </>
  );
}
