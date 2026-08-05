import React, { useState } from "react";
import { api } from "@/lib/api";
import type { Provider } from "@/lib/types";
import RippleButton from "@/components/RippleButton";
import EmptyState from "@/components/EmptyState";
import { formatPrice, escapeHtml, useFetch, Spinner, ErrorMsg } from "./shared";
import { toast } from "@/components/Toast";

export default function ProvidersPage() {
  const { data: pData, loading, error, refetch } = useFetch(() => api<{ providers: Provider[] }>("/api/admin/providers"), []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ companyName: "", contactName: "", email: "", password: "", phone: "", pin: "" });
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  async function createProvider(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await api("/api/admin/providers", { method: "POST", body: JSON.stringify(form) });
      setShowForm(false); setForm({ companyName: "", contactName: "", email: "", password: "", phone: "", pin: "" }); refetch();
      toast("success", "Provider added.");
    } catch (err: any) { toast("error", err.message); } finally { setSaving(false); }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await api(`/api/admin/providers/${editing.id}`, { method: "PUT", body: JSON.stringify(form) });
      setEditing(null); setForm({ companyName: "", contactName: "", email: "", password: "", phone: "", pin: "" }); refetch();
      toast("success", "Provider updated.");
    } catch (err: any) { toast("error", err.message); } finally { setSaving(false); }
  }

  function openEdit(p: any) {
    setForm({ companyName: p.companyName, contactName: p.contactName, email: p.email, password: "", phone: p.phone || "", pin: "" });
    setEditing(p);
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  const providers = pData?.providers || [];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Providers</h1>
        {!editing && <RippleButton size="small" onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ Add"}</RippleButton>}
      </div>
      {(showForm || editing) && (
        <div className="panel" style={{ marginBottom: "1rem", maxWidth: 400 }}>
          <form onSubmit={editing ? saveEdit : createProvider}>
            <h3 style={{ marginTop: 0 }}>{editing ? `Edit ${escapeHtml(editing.companyName)}` : "New Provider"}</h3>
            <div className="field"><label>Company<input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required /></label></div>
            <div className="field"><label>Contact name<input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} required /></label></div>
            <div className="field"><label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label></div>
            {editing ? (
              <div className="field"><label>New password (leave blank to keep)<input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label></div>
            ) : (
              <div className="field"><label>Password<input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label></div>
            )}
            <div className="field"><label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label></div>
            <div className="field"><label>PIN (min 6 digits, leave blank to keep)<input type="tel" value={form.pin} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setForm({ ...form, pin: v }); }} placeholder="e.g. 123456" minLength={6} /></label></div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <RippleButton type="submit" loading={saving}>{editing ? "Save" : "Add provider"}</RippleButton>
              {editing && <RippleButton variant="ghost" onClick={() => { setEditing(null); setForm({ companyName: "", contactName: "", email: "", password: "", phone: "", pin: "" }); }}>Cancel</RippleButton>}
            </div>
          </form>
        </div>
      )}
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Company</th><th>Contact</th><th>Email</th><th>Phone</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.id}>
                <td><strong>{escapeHtml(p.companyName)}</strong></td>
                <td>{escapeHtml(p.contactName)}</td>
                <td>{escapeHtml(p.email)}</td>
                <td>{escapeHtml(p.phone || "—")}</td>
                <td><span className="plan-status">{p.status}</span></td>
                <td><RippleButton size="small" variant="ghost" onClick={() => openEdit(p)}>Edit</RippleButton></td>
              </tr>
            ))}
            {providers.length === 0 && <tr><td colSpan={6}><EmptyState icon="default" title="No providers" description="Provider companies will appear here once added." /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
