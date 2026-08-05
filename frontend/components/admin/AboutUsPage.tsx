import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import RippleButton from "@/components/RippleButton";
import { Spinner } from "./shared";
import { toast } from "@/components/Toast";

interface Stat { value: string; label: string; }
interface AboutData {
  title: string;
  content: string;
  mission: string;
  vision: string;
  missionTitle: string;
  visionTitle: string;
  image: string;
  address: string;
  hours: string;
  stats: Stat[];
}

const EMPTY: AboutData = {
  title: "", content: "", mission: "", vision: "",
  missionTitle: "Our Mission", visionTitle: "Our Vision",
  image: "", address: "", hours: "", stats: [],
};

export default function AboutUsPage() {
  const [data, setData] = useState<AboutData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const d = await api<any>("/api/admin/about-us");
      setData({
        title: d.title || "", content: d.content || "", mission: d.mission || "", vision: d.vision || "",
        missionTitle: d.missionTitle || "Our Mission", visionTitle: d.visionTitle || "Our Vision",
        image: d.image || "", address: d.address || "", hours: d.hours || "",
        stats: Array.isArray(d.stats) ? d.stats.map((s: any) => ({ value: String(s.value || ""), label: String(s.label || "") })) : [],
      });
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

  function setStat(i: number, patch: Partial<Stat>) {
    setData((s) => {
      const stats = s.stats.map((st, idx) => (idx === i ? { ...st, ...patch } : st));
      return { ...s, stats };
    });
  }

  function addStat() {
    setData((s) => ({ ...s, stats: [...s.stats, { value: "", label: "" }] }));
  }

  function removeStat(i: number) {
    setData((s) => ({ ...s, stats: s.stats.filter((_, idx) => idx !== i) }));
  }

  if (loading) return <Spinner />;

  return (
    <>
      <h1>About Us</h1>
      <p className="muted">Edit the content shown on the /about page.</p>
      <div className="panel" style={{ maxWidth: 760 }}>
        <div className="field"><label>Title<input value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} /></label></div>
        <div className="field"><label>Content<textarea value={data.content} onChange={(e) => setData({ ...data, content: e.target.value })} rows={4} /></label></div>
        <div className="field">
          <label>Image URL
            <input value={data.image} onChange={(e) => setData({ ...data, image: e.target.value })} placeholder="https://..." />
          </label>
          <p className="input-hint">Optional banner image for the top of the page. Leave empty to hide.</p>
        </div>
        <div className="form-grid">
          <div className="field"><label>Mission Title<input value={data.missionTitle} onChange={(e) => setData({ ...data, missionTitle: e.target.value })} /></label></div>
          <div className="field"><label>Vision Title<input value={data.visionTitle} onChange={(e) => setData({ ...data, visionTitle: e.target.value })} /></label></div>
        </div>
        <div className="form-grid">
          <div className="field"><label>Mission<textarea value={data.mission} onChange={(e) => setData({ ...data, mission: e.target.value })} rows={3} /></label></div>
          <div className="field"><label>Vision<textarea value={data.vision} onChange={(e) => setData({ ...data, vision: e.target.value })} rows={3} /></label></div>
        </div>
        <div className="form-grid">
          <div className="field"><label>Address<input value={data.address} onChange={(e) => setData({ ...data, address: e.target.value })} placeholder="e.g. Moi Avenue, Nairobi" /></label></div>
          <div className="field"><label>Opening Hours<input value={data.hours} onChange={(e) => setData({ ...data, hours: e.target.value })} placeholder="e.g. Mon - Sat, 9am - 6pm" /></label></div>
        </div>
        <div className="field">
          <label>Stats <span className="muted">(up to 6)</span></label>
          {data.stats.map((st, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr auto", gap: "var(--space-2)", marginBottom: "var(--space-2)", alignItems: "start" }}>
              <input value={st.value} onChange={(e) => setStat(i, { value: e.target.value })} placeholder="Value" aria-label={`Stat ${i + 1} value`} />
              <input value={st.label} onChange={(e) => setStat(i, { label: e.target.value })} placeholder="Label" aria-label={`Stat ${i + 1} label`} />
              <button type="button" className="btn btn-ghost" onClick={() => removeStat(i)} aria-label="Remove stat">×</button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" onClick={addStat}>+ Add Stat</button>
          <p className="input-hint">Example: value "10k+", label "Happy customers".</p>
        </div>
        <RippleButton onClick={save} loading={saving}>Save Changes</RippleButton>
      </div>
    </>
  );
}
