import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { escapeHtml, Spinner } from "@/components/admin/shared";
import RippleButton from "@/components/RippleButton";
import { toast } from "@/components/Toast";

const EVENT_LABELS: Record<string, string> = {
  "order.created": "New order",
  "order.paid": "Order paid",
  "order.status_changed": "Order status changed",
  "payment.completed": "Payment completed",
  "payment.failed": "Payment failed",
  "customer.created": "New customer registered",
  "customer.login": "Customer logged in",
  "repair.created": "New repair ticket",
  "repair.status_changed": "Repair status changed",
  "repair.quote_sent": "Repair quote sent",
  "repair.quote_approved": "Repair quote approved",
  "repair.quote_declined": "Repair quote declined",
  "repair.completed": "Repair completed",
  "repair.ready": "Repair ready for pickup",
  "repair.cancelled": "Repair cancelled",
  "warranty.created": "New warranty claim",
  "warranty.status_changed": "Warranty status changed",
  "warranty.approved": "Warranty claim approved",
  "warranty.rejected": "Warranty claim rejected",
  "warranty.resolved": "Warranty claim resolved",
  "invoice.created": "Invoice generated",
  "invoice.paid": "Invoice paid",
  "invoice.overdue": "Invoice overdue",
  "subscription.changed": "Subscription changed",
  "subscription.expiring": "Subscription expiring",
  "subscription.expired": "Subscription expired",
};

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState<Record<string, { email: boolean; whatsapp: boolean }> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logLoading, setLogLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"prefs" | "log">("prefs");
  const [testNotifyLoading, setTestNotifyLoading] = useState(false);
  const [testNotifyResult, setTestNotifyResult] = useState("");

  function loadPrefs() {
    api<any>("/api/admin/notifications/preferences").then((p) => { setPrefs(p); setLoading(false); }).catch(() => setLoading(false));
  }
  function loadLogs() {
    api<any>("/api/admin/notifications/log?limit=50").then((d) => { setLogs(d.logs || []); setLogTotal(d.total || 0); setLogLoading(false); }).catch(() => setLogLoading(false));
  }

  useEffect(() => {
    loadPrefs();
    loadLogs();
  }, []);

  function toggle(event: string, channel: "email" | "whatsapp") {
    if (!prefs) return;
    setPrefs({
      ...prefs,
      [event]: { ...prefs[event], [channel]: !prefs[event][channel] },
    });
  }

  async function savePrefs() {
    if (!prefs) return;
    setSaving(true);
    try {
      const updated = await api<any>("/api/admin/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify(prefs),
      });
      setPrefs(updated);
      toast("success", "Notification preferences saved.");
    } catch (e: any) {
      toast("error", e.message || "Failed to save notification preferences.");
    } finally { setSaving(false); }
  }

  async function sendTestNotification() {
    setTestNotifyLoading(true); setTestNotifyResult("");
    try {
      const d = await api<any>("/api/admin/notify/test", { method: "POST" });
      const lines = [
        `Email (${d.email || "none"}): ${d.emailResult}`,
        `WhatsApp (${d.whatsapp || "none"}): ${d.whatsappResult}`,
      ];
      setTestNotifyResult(lines.join(" • "));
    } catch (e: any) { setTestNotifyResult("Error: " + e.message); }
    finally { setTestNotifyLoading(false); }
  }

  if (loading) return <Spinner />;

  const groups: { label: string; events: string[] }[] = [
    { label: "Orders & Payments", events: ["order.created", "order.paid", "order.status_changed", "payment.completed", "payment.failed"] },
    { label: "Customers", events: ["customer.created", "customer.login"] },
    { label: "Repairs", events: ["repair.created", "repair.status_changed", "repair.quote_sent", "repair.quote_approved", "repair.quote_declined", "repair.completed", "repair.ready", "repair.cancelled"] },
    { label: "Warranties", events: ["warranty.created", "warranty.status_changed", "warranty.approved", "warranty.rejected", "warranty.resolved"] },
    { label: "Invoices & Subscriptions", events: ["invoice.created", "invoice.paid", "invoice.overdue", "subscription.changed", "subscription.expiring", "subscription.expired"] },
  ];

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Notification Settings</h1>

      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <RippleButton variant={activeTab === "prefs" ? "primary" : "ghost"} onClick={() => setActiveTab("prefs")}>Preferences</RippleButton>
        <RippleButton variant={activeTab === "log" ? "primary" : "ghost"} onClick={() => setActiveTab("log")}>Notification Log ({logTotal})</RippleButton>
        <span style={{ flex: 1 }} />
        <RippleButton variant="ghost" onClick={sendTestNotification} loading={testNotifyLoading}>Send Test Notification</RippleButton>
      </div>
      {testNotifyResult && (
        <p style={{ marginBottom: "1rem", fontSize: "0.85rem", color: testNotifyResult.includes("failed") ? "var(--danger)" : "var(--success)" }}>{testNotifyResult}</p>
      )}
      <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0 0 1rem" }}>
        Choose which events send store-admin notifications and over which channels. Events are sent to the store admin email (Email settings) and the admin phone (WhatsApp settings). Failures never stop the underlying action from completing.
      </p>

      {activeTab === "prefs" && (
        <div className="panel" style={{ maxWidth: 760 }}>
          {groups.map((g) => (
            <div key={g.label} style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-secondary)" }}>{g.label}</h3>
              <div className="table-wrap" style={{ marginBottom: "1rem" }}>
                <table className="data-table" style={{ fontSize: "0.85rem" }}>
                  <thead><tr><th style={{ width: "60%" }}>Event</th><th style={{ textAlign: "center" }}>Email</th><th style={{ textAlign: "center" }}>WhatsApp</th></tr></thead>
                  <tbody>
                    {g.events.map((ev) => {
                      const p = prefs?.[ev] || { email: true, whatsapp: false };
                      return (
                        <tr key={ev}>
                          <td>
                            <strong>{EVENT_LABELS[ev] || ev}</strong>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontFamily: "monospace" }}>{ev}</div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <input type="checkbox" checked={!!p.email} onChange={() => toggle(ev, "email")} style={{ width: "auto" }} aria-label={`${EVENT_LABELS[ev] || ev} email`} />
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <input type="checkbox" checked={!!p.whatsapp} onChange={() => toggle(ev, "whatsapp")} style={{ width: "auto" }} aria-label={`${EVENT_LABELS[ev] || ev} whatsapp`} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <RippleButton onClick={savePrefs} loading={saving}>Save Preferences</RippleButton>
        </div>
      )}

      {activeTab === "log" && (
        <div className="panel" style={{ maxWidth: 900 }}>
          {logLoading ? <Spinner /> : logs.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>No notifications logged yet. Notifications above only log when the event fires and the channel is enabled.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table" style={{ fontSize: "0.8rem" }}>
                <thead><tr><th>Event</th><th>Channel</th><th>Recipient</th><th>Status</th><th>Entity</th><th>Date</th></tr></thead>
                <tbody>
                  {logs.map((l: any) => (
                    <tr key={l.id}>
                      <td><span style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{escapeHtml(l.event_type)}</span></td>
                      <td><span style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: 4, background: l.channel === "email" ? "var(--primary-light, #e0e7ff)" : "var(--success-light, #d1fae5)" }}>{l.channel}</span></td>
                      <td>{escapeHtml(l.recipient)}</td>
                      <td>
                        <span style={{ color: l.status === "sent" ? "var(--success)" : l.status === "failed" ? "var(--danger)" : "var(--text-secondary)", fontWeight: 600 }}>{l.status}</span>
                        {l.error_message ? <div style={{ fontSize: "0.7rem", color: "var(--danger)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.error_message}>{escapeHtml(l.error_message)}</div> : null}
                      </td>
                      <td><span style={{ fontSize: "0.75rem" }}>{escapeHtml(l.entity_type)}#{escapeHtml(String(l.entity_id))}</span></td>
                      <td>{new Date(l.created_at).toLocaleString("en-GB")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}