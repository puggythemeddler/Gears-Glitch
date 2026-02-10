import React, { useEffect, useState } from "react";
import { api, isCustomerLoggedIn, requireCustomerLogin } from "@/lib/api";

function getCheckedSymptoms(checkboxes: NodeListOf<HTMLInputElement>): string[] {
  const result: string[] = [];
  checkboxes.forEach((cb) => { if (cb.checked) result.push(cb.value); });
  return result;
}

export default function RepairBookPage() {
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setMounted(true);
    const ok = isCustomerLoggedIn();
    setLoggedIn(ok);
    if (!ok) {
      requireCustomerLogin("/repair-book");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireCustomerLogin("/repair-book")) return;
    setSubmitting(true);
    setStatusMsg(null);
    const fd = new FormData(e.currentTarget);
    const symptoms = getCheckedSymptoms(e.currentTarget.querySelectorAll("input[name='symptoms']"));

    try {
      const ticket = await api("/api/repairs", {
        method: "POST",
        body: JSON.stringify({
          deviceType: fd.get("deviceType"),
          deviceBrand: fd.get("deviceBrand"),
          deviceModel: fd.get("deviceModel"),
          serialNumber: fd.get("serialNumber"),
          purchaseYear: fd.get("purchaseYear"),
          issueSummary: fd.get("issueSummary"),
          issueDescription: fd.get("issueDescription"),
          symptoms,
          devicePassword: fd.get("devicePassword"),
          dataBackedUp: fd.get("dataBackedUp"),
          preferredDate: fd.get("preferredDate"),
          preferredTime: fd.get("preferredTime"),
          notes: fd.get("notes"),
        }),
      });
      setStatusMsg({ text: `Repair ticket #${ticket.id} submitted! Redirecting...` });
      setTimeout(() => { window.location.href = "/my-repairs"; }, 2500);
    } catch (err: any) {
      setStatusMsg({ text: err.message, error: true });
    } finally { setSubmitting(false); }
  }

  if (mounted && !loggedIn) {
    return <><h1>Book a repair</h1><p className="product-error">Please <a href="/login?redirect=/repair-book">sign in</a> to book a repair.</p></>;
  }

  return (
    <>
      <nav className="breadcrumbs">
        <ol>
          <li><a href="/">Home</a></li>
          <li><a href="/repairs">Repairs</a></li>
          <li><span aria-current="page">Book a repair</span></li>
        </ol>
      </nav>
      <h1>Book a repair</h1>
      <p className="page-intro">Tell us about your device and the issue. Default turnaround is <strong>48 hours</strong> from receipt.</p>

      <form onSubmit={handleSubmit} className="auth-form" style={{ maxWidth: 600 }}>
        <fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "1.25rem", marginBottom: "1rem" }}>
          <legend style={{ fontWeight: 600, color: "var(--primary)" }}>Device information</legend>
          <div className="field"><label>Device type *<select name="deviceType" required style={{ width: "100%" }}><option value="">Select…</option><option>Laptop</option><option>Desktop PC</option><option>MacBook</option><option>Tablet</option><option>Printer</option><option>Other</option></select></label></div>
          <div className="field"><label>Brand *<input name="deviceBrand" style={{ width: "100%" }} required /></label></div>
          <div className="field"><label>Model<input name="deviceModel" style={{ width: "100%" }} /></label></div>
          <div className="field"><label>Serial number<input name="serialNumber" style={{ width: "100%" }} /></label></div>
        </fieldset>

        <fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "1.25rem", marginBottom: "1rem" }}>
          <legend style={{ fontWeight: 600, color: "var(--primary)" }}>Issue details</legend>
          <div className="field"><label>Issue summary *<input name="issueSummary" style={{ width: "100%" }} required /></label></div>
          <div className="field"><label>Detailed description *<textarea name="issueDescription" rows={4} style={{ width: "100%" }} required placeholder="Describe the issue in detail..." /></label></div>
        </fieldset>

        <fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "1.25rem", marginBottom: "1rem" }}>
          <legend style={{ fontWeight: 600, color: "var(--primary)" }}>Symptoms</legend>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            {["Won't turn on", "Slow performance", "Overheating", "Screen cracked", "Battery drains fast", "No display", "Keyboard not working", "Wi-Fi issues", "Software crash", "Virus / malware", "Data recovery", "Liquid damage", "Fan noise", "Other"].map((s) => (
              <label key={s} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "normal", fontSize: "0.9rem" }}>
                <input type="checkbox" name="symptoms" value={s} /> {s}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "1.25rem", marginBottom: "1rem" }}>
          <legend style={{ fontWeight: 600, color: "var(--primary)" }}>Scheduling</legend>
          <div className="field"><label>Preferred date<input type="date" name="preferredDate" style={{ width: "100%" }} /></label></div>
          <div className="field"><label>Additional notes<textarea name="notes" rows={2} style={{ width: "100%" }} /></label></div>
        </fieldset>

        {statusMsg && <p className={`form-status${statusMsg.error ? " error" : ""}`}>{statusMsg.text}</p>}
        <button type="submit" className="btn" disabled={submitting}>{submitting ? "Submitting..." : "Submit repair request"}</button>
      </form>
    </>
  );
}
