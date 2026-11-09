import React, { useEffect, useRef, useState } from "react";
import { api, isCustomerLoggedIn, requireCustomerLogin } from "@/lib/api";
import { PageHead } from "@/components/ui";

const SYMPTOMS = ["Won't turn on", "Slow performance", "Overheating", "Screen cracked", "Battery drains fast", "No display", "Keyboard not working", "Wi-Fi issues", "Software crash", "Virus / malware", "Data recovery", "Liquid damage", "Fan noise", "Other"];

const DEVICE_TYPES = ["Laptop", "Desktop PC", "MacBook", "Tablet", "Printer", "Other"];

function purchasedDeviceType(category: string): string | null {
  const value = category.trim().toLowerCase();
  if (value.includes("mac")) return "MacBook";
  if (value.includes("laptop")) return "Laptop";
  if (value.includes("desktop") || value === "pc" || value.includes("workstation")) return "Desktop PC";
  if (value.includes("tablet")) return "Tablet";
  if (value.includes("printer")) return "Printer";
  return null;
}

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
  const [serviceName, setServiceName] = useState("");
  const [serviceKind, setServiceKind] = useState<"diagnosis_repair" | "planned_service">("diagnosis_repair");
  const [devices, setDevices] = useState<Array<{ orderItemId: number; name: string; productId: string; quantity: number; category: string; serialNumbers: string[] }>>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState("");
  const repairTypeRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const ok = isCustomerLoggedIn();
    setLoggedIn(ok);
    if (!ok) {
      requireCustomerLogin();
    }
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    setDevicesLoading(true);
    api<{ devices: typeof devices }>("/api/repairs/my-devices")
      .then((result) => setDevices(result.devices || []))
      .catch(() => setDevices([]))
      .finally(() => setDevicesLoading(false));
  }, [loggedIn]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const serviceId = params.get("service");
    if (!serviceId) return;
    let cancelled = false;
    api<any>("/api/repairs-page").then((d) => {
      if (cancelled) return;
      const panel = Array.isArray(d?.panels) ? d.panels.find((p: any, idx: number) => String(p.id) === serviceId || String(idx) === serviceId) : null;
      if (!panel) return;
      const b = panel.booking;
      if (b?.repairTypeId) repairTypeRef.current = b.repairTypeId;
      setServiceName(panel.title);
      if (b?.deviceType && DEVICE_TYPES.includes(b.deviceType)) {
        const sel = document.querySelector<HTMLSelectElement>("select[name='deviceType']");
        if (sel) sel.value = b.deviceType;
      }
      const summary = document.querySelector<HTMLInputElement>("input[name='issueSummary']");
      if (summary && !summary.value) summary.value = panel.title;
      const desc = document.querySelector<HTMLTextAreaElement>("textarea[name='issueDescription']");
      if (desc && !desc.value) desc.value = b?.issueDescription || panel.description || "";
      if (Array.isArray(b?.symptoms)) {
        document.querySelectorAll<HTMLInputElement>("input[name='symptoms']").forEach((cb) => {
          if (b.symptoms!.includes(cb.value)) cb.checked = true;
        });
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireCustomerLogin()) return;
    setSubmitting(true);
    setStatusMsg(null);
    const fd = new FormData(e.currentTarget);
    const symptoms = serviceKind === "diagnosis_repair" ? getCheckedSymptoms(e.currentTarget.querySelectorAll("input[name='symptoms']")) : [];

    try {
      const ticket = await api("/api/repairs", {
        method: "POST",
        body: JSON.stringify({
          deviceType: fd.get("deviceType"),
          deviceBrand: fd.get("deviceBrand"),
          deviceModel: fd.get("deviceModel"),
          serialNumber: fd.get("serialNumber"),
          issueSummary: fd.get("issueSummary"),
          issueDescription: fd.get("issueDescription"),
          symptoms,
          requestedVisitDate: fd.get("requestedVisitDate"),
          requestedVisitTime: fd.get("requestedVisitTime"),
          notes: fd.get("notes"),
          repairType: repairTypeRef.current,
          serviceKind: fd.get("serviceKind"),
          orderItemId: fd.get("orderItemId") || null,
        }),
      });
      setStatusMsg({ text: `${serviceKind === "planned_service" ? "Service request" : "Repair ticket"} #${ticket.id} submitted! Redirecting...` });
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
      <PageHead title="Book a repair - Gear&Glitch" description="Tell us about your device and the issue. Default turnaround is 48 hours from receipt." />
      <nav className="breadcrumbs">
        <ol>
          <li><a href="/">Home</a></li>
          <li><a href="/repairs">Repairs</a></li>
          <li><span aria-current="page">Book a repair</span></li>
        </ol>
      </nav>
      <h1>Book a repair{serviceName ? ` — ${serviceName}` : ""}</h1>
      <p className="page-intro">Tell us about your device and the issue. Default turnaround is <strong>48 hours</strong> from receipt.</p>

      <form onSubmit={handleSubmit} className="auth-form" style={{ maxWidth: 600 }}>
        <fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "1.25rem", marginBottom: "1rem" }}>
          <legend style={{ fontWeight: 600, color: "var(--primary)" }}>What do you need?</legend>
          <div className="field"><label>Request type<select name="serviceKind" value={serviceKind} onChange={(e) => setServiceKind(e.target.value as typeof serviceKind)} style={{ width: "100%" }}><option value="diagnosis_repair">Diagnose or repair a problem</option><option value="planned_service">Software, installation, or upgrade</option></select></label></div>
          <p className="muted" style={{ marginBottom: 0 }}>{serviceKind === "diagnosis_repair" ? "We’ll assess the fault and keep you updated on the diagnosis." : "Tell us what you want installed or upgraded. This is handled as a planned service, without a hardware diagnosis deadline."}</p>
        </fieldset>

        <fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "1.25rem", marginBottom: "1rem" }}>
          <legend style={{ fontWeight: 600, color: "var(--primary)" }}>Device information</legend>
          <div className="field"><label>Which device did you buy from this store?<select name="orderItemId" value={selectedOrderItemId} onChange={(e) => {
            const itemId = e.target.value;
            setSelectedOrderItemId(itemId);
            const selected = devices.find((device) => String(device.orderItemId) === itemId);
            const model = document.querySelector<HTMLInputElement>("input[name='deviceModel']");
            const serial = document.querySelector<HTMLInputElement>("input[name='serialNumber']");
            const type = document.querySelector<HTMLSelectElement>("select[name='deviceType']");
            if (model) model.value = selected?.name || "";
            if (serial) serial.value = selected?.serialNumbers?.[0] || "";
            const guessedType = purchasedDeviceType(String(selected?.category || ""));
            if (type && guessedType) type.value = guessedType;
          }} style={{ width: "100%" }}><option value="">Other device / not purchased here</option>{devices.map((device) => <option key={device.orderItemId} value={device.orderItemId}>{device.name}{device.quantity > 1 ? ` · qty ${device.quantity}` : ""}{device.serialNumbers?.length ? ` · SN ${device.serialNumbers.join(", ")}` : ""}</option>)}</select></label><small className="muted">{devicesLoading ? "Loading your eligible purchases…" : devices.length ? "Choosing a purchase links the request to your order. You can still edit the device details below." : "No completed store purchases were found. You can enter the device details below."}</small></div>
          <div className="field"><label>Device type *<select name="deviceType" required style={{ width: "100%" }}><option value="">Select…</option>{DEVICE_TYPES.map((d) => <option key={d}>{d}</option>)}</select></label></div>
          <div className="field"><label>Brand (if known)<input name="deviceBrand" style={{ width: "100%" }} /></label></div>
          <div className="field"><label>Model<input name="deviceModel" style={{ width: "100%" }} /></label></div>
          <div className="field"><label>Serial number (if available)<input name="serialNumber" style={{ width: "100%" }} /></label></div>
        </fieldset>

        <fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "1.25rem", marginBottom: "1rem" }}>
          <legend style={{ fontWeight: 600, color: "var(--primary)" }}>{serviceKind === "diagnosis_repair" ? "Problem details" : "Service details"}</legend>
          <div className="field"><label>{serviceKind === "diagnosis_repair" ? "Problem summary *" : "Service requested *"}<input name="issueSummary" style={{ width: "100%" }} required placeholder={serviceKind === "planned_service" ? "For example, install Windows or upgrade RAM" : "Briefly describe the fault"} /></label></div>
          <div className="field"><label>{serviceKind === "diagnosis_repair" ? "Describe the problem *" : "Installation or upgrade details *"}<textarea name="issueDescription" rows={4} style={{ width: "100%" }} required placeholder={serviceKind === "planned_service" ? "Tell us what software or upgrade you need, including preferences or compatibility details." : "Describe what happened and when it started..."} /></label></div>
        </fieldset>

        {serviceKind === "diagnosis_repair" && <fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "1.25rem", marginBottom: "1rem" }}>
          <legend style={{ fontWeight: 600, color: "var(--primary)" }}>Symptoms</legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
            {SYMPTOMS.map((s) => (
              <label key={s} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "normal", fontSize: "0.9rem" }}>
                <input type="checkbox" name="symptoms" value={s} /> {s}
              </label>
            ))}
          </div>
        </fieldset>}

        <fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "1.25rem", marginBottom: "1rem" }}>
          <legend style={{ fontWeight: 600, color: "var(--primary)" }}>Scheduling</legend>
          <p className="muted" style={{ marginTop: 0 }}>Your preferred drop-off time is a request. The shop will confirm the appointment.</p>
          <div className="field"><label>Preferred date<input type="date" name="requestedVisitDate" style={{ width: "100%" }} /></label></div>
          <div className="field"><label>Preferred time<input type="time" name="requestedVisitTime" style={{ width: "100%" }} /></label></div>
          <div className="field"><label>Additional notes<textarea name="notes" rows={2} style={{ width: "100%" }} /></label></div>
        </fieldset>

        {statusMsg && <p className={`form-status${statusMsg.error ? " error" : ""}`}>{statusMsg.text}</p>}
        <button type="submit" className="btn" disabled={submitting}>{submitting ? "Submitting..." : "Submit repair request"}</button>
      </form>
    </>
  );
}
