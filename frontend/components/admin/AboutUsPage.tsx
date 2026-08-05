import React, { useEffect, useRef, useState } from "react";
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

function AutoGrow({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "0px";
      el.style.height = Math.max(el.scrollHeight, 72) + "px";
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ overflow: "hidden", resize: "vertical", minHeight: 72, width: "100%" }}
    />
  );
}

export default function AboutUsPage() {
  const [data, setData] = useState<AboutData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      if (data.image) fd.append("previousUrl", data.image);
      const d = await api<any>("/api/admin/about-us/image", { method: "POST", body: fd });
      setData((s) => ({ ...s, image: d.url || "" }));
      toast("success", "Image uploaded.");
    } catch (err: any) { toast("error", "Upload failed: " + err.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
        <div>
          <h1 style={{ marginBottom: "var(--space-1)" }}>About Us</h1>
          <p className="muted" style={{ margin: 0 }}>Edit the content shown on the /about page.</p>
        </div>
        <RippleButton onClick={save} loading={saving}>Save Changes</RippleButton>
      </div>

      <div className="panel" style={{ width: "100%" }}>
        <div className="form-grid">
          <div className="field">
            <label>Title</label>
            <input value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} />
          </div>
          <div className="field">
            <label>Banner Image</label>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={uploadImage} />
            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
              {data.image ? (
                <img src={data.image} alt="About banner" style={{ width: 160, height: 90, objectFit: "cover", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }} />
              ) : (
                <div style={{ width: 160, height: 90, borderRadius: "var(--radius-md)", border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: "var(--text-xs)", textAlign: "center", padding: "var(--space-2)" }}>No banner image</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <button type="button" className="btn btn-secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? "Uploading..." : data.image ? "Replace Image" : "Upload Image"}
                </button>
                {data.image && (
                  <button type="button" className="btn btn-ghost" onClick={() => setData({ ...data, image: "" })}>Remove</button>
                )}
              </div>
            </div>
            <p className="input-hint" style={{ marginTop: "var(--space-1)" }}>Uploads to your store&apos;s Cloudinary folder. Shown as a banner at the top of the page; leave empty to hide.</p>
          </div>
        </div>

        <div className="field">
          <label>Content</label>
          <AutoGrow value={data.content} onChange={(v) => setData({ ...data, content: v })} placeholder="Tell visitors about your store..." />
        </div>

        <div className="form-grid">
          <div className="field"><label>Mission Title</label><input value={data.missionTitle} onChange={(e) => setData({ ...data, missionTitle: e.target.value })} /></div>
          <div className="field"><label>Vision Title</label><input value={data.visionTitle} onChange={(e) => setData({ ...data, visionTitle: e.target.value })} /></div>
        </div>

        <div className="form-grid">
          <div className="field"><label>Mission</label><AutoGrow value={data.mission} onChange={(v) => setData({ ...data, mission: v })} placeholder="Why the store exists..." /></div>
          <div className="field"><label>Vision</label><AutoGrow value={data.vision} onChange={(v) => setData({ ...data, vision: v })} placeholder="Where the store is heading..." /></div>
        </div>

        <div className="form-grid">
          <div className="field"><label>Address</label><input value={data.address} onChange={(e) => setData({ ...data, address: e.target.value })} placeholder="e.g. Moi Avenue, Nairobi" /></div>
          <div className="field"><label>Opening Hours</label><input value={data.hours} onChange={(e) => setData({ ...data, hours: e.target.value })} placeholder="e.g. Mon - Sat, 9am - 6pm" /></div>
        </div>

        <div className="field">
          <label>Stats <span className="muted">(up to 6)</span></label>
          {data.stats.map((st, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.6fr) auto", gap: "var(--space-2)", marginBottom: "var(--space-2)", alignItems: "start" }}>
              <input value={st.value} onChange={(e) => setStat(i, { value: e.target.value })} placeholder="Value" aria-label={`Stat ${i + 1} value`} />
              <input value={st.label} onChange={(e) => setStat(i, { label: e.target.value })} placeholder="Label" aria-label={`Stat ${i + 1} label`} />
              <button type="button" className="btn btn-ghost" onClick={() => removeStat(i)} aria-label="Remove stat">×</button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" onClick={addStat}>+ Add Stat</button>
          <p className="input-hint">Example: value "10k+", label "Happy customers".</p>
        </div>
      </div>
    </>
  );
}
