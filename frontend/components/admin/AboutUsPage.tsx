import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import RippleButton from "@/components/RippleButton";
import { Spinner } from "./shared";
import { toast } from "@/components/Toast";

export default function AboutUsPage() {
  const [data, setData] = useState({ title: "", content: "", mission: "", vision: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const d = await api<any>("/api/admin/about-us");
      setData({ title: d.title || "", content: d.content || "", mission: d.mission || "", vision: d.vision || "" });
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      await api("/api/admin/about-us", { method: "PUT", body: JSON.stringify(data) });
      toast("success", "About Us content saved.");
    } catch (e: any) { toast("error", e.message); }
    finally { setSaving(false); }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <h1>About Us</h1>
      <p className="muted">Edit the content shown on the /about page.</p>
      <div className="panel" style={{ maxWidth: 700 }}>
        <div className="field"><label>Title<input value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} /></label></div>
        <div className="field"><label>Content<textarea value={data.content} onChange={(e) => setData({ ...data, content: e.target.value })} rows={4} /></label></div>
        <div className="field"><label>Mission<textarea value={data.mission} onChange={(e) => setData({ ...data, mission: e.target.value })} rows={3} /></label></div>
        <div className="field"><label>Vision<textarea value={data.vision} onChange={(e) => setData({ ...data, vision: e.target.value })} rows={3} /></label></div>
        <RippleButton onClick={save} loading={saving}>Save Changes</RippleButton>
      </div>
    </>
  );
}
