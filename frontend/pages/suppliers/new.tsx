import React, { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { api, getStaffToken } from "@/lib/api";

function Spinner() { return <p style={{ textAlign: "center", padding: "2rem", opacity: 0.5 }}>Loading...</p>; }

export default function NewSupplierPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  React.useEffect(() => {
    if (getStaffToken()) setAuthed(true);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg("");
    const fd = new FormData(e.target as HTMLFormElement);
    const body = {
      name: fd.get("name"),
      contact_name: fd.get("contact_name"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      address: fd.get("address"),
      notes: fd.get("notes"),
      is_active: fd.get("is_active") === "on",
    };
    try {
      await api("/api/admin/suppliers", { method: "POST", body: JSON.stringify(body) });
      router.push("/admin?view=suppliers");
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  if (!authed) {
    return (
      <div style={{ maxWidth: 600, margin: "3rem auto", padding: "0 1rem" }}>
        <h1>Add Supplier</h1>
        <p>Please <Link href="/admin">sign in</Link> as admin or owner.</p>
      </div>
    );
  }

  return (
    <div className="dash-layout">
      <nav className="dash-nav" style={{ padding: "1rem" }}>
        <Link href="/admin?view=suppliers" style={{ display: "block", marginBottom: "1rem" }}>&larr; Back to Suppliers</Link>
      </nav>
      <div className="dash-content" style={{ maxWidth: 600 }}>
        <h1>Add Supplier</h1>

        {msg && (
          <div className="panel" style={{ marginBottom: "1rem", background: "var(--danger-light)", color: "var(--danger-text)", padding: "0.75rem", borderRadius: 6 }}>
            {msg}
          </div>
        )}

        <form className="panel" onSubmit={save}>
          <div className="field">
            <label>Company Name <span style={{ color: "var(--danger)" }}>*</span></label>
            <input name="name" required placeholder="e.g. Tech Supplies Ltd" />
          </div>
          <div className="field">
            <label>Contact Person</label>
            <input name="contact_name" placeholder="e.g. John Doe" />
          </div>
          <div className="field">
            <label>Email</label>
            <input name="email" type="email" placeholder="e.g. john@supplier.com" />
          </div>
          <div className="field">
            <label>Phone</label>
            <input name="phone" placeholder="e.g. 0712345678" />
          </div>
          <div className="field">
            <label>Address</label>
            <input name="address" placeholder="e.g. Nairobi, Kenya" />
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea name="notes" rows={3} placeholder="Any additional notes..." />
          </div>
          <div className="field">
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input name="is_active" type="checkbox" defaultChecked /> Active
            </label>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Supplier"}</button>
            <Link href="/admin?view=suppliers" className="btn btn-ghost">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
